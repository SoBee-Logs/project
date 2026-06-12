import asyncio
import base64
import io
import json
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

import boto3
from openai import AsyncOpenAI
from google import genai as google_genai
from google.genai import types as genai_types
from PIL import Image
from fastapi import HTTPException

from langsmith import traceable
from langsmith.wrappers import wrap_openai

from app.core.config import settings
from app.core.constants import MOOD_EXPRESSION_EN, MOOD_KO, MOOD_NAME_TO_EMOJI
from app.core.prompt_store import register, get_prompt
from app.db.transaction_repository import (
    get_transactions_by_date_range, get_mapped_transactions_with_vlm,
    get_photo_emotions_by_taken_at,
)
from app.core.emotion import pick_top_mood_name
from app.db.user_repository import update_user_avatar, get_user_life_stage
from app.services.ai_insight_service import LIFE_STAGE_KO
from app.services.category_mapping_service import STANDARD_CATEGORIES
from app.models.schemas import AvatarRequest, AvatarResponse

import logging
log = logging.getLogger(__name__)

_AVATAR_PROMPT = """
Preserve the mascot's core identity — body colors (sky blue upper, yellow lower), wings, antennae, and overall silhouette — from the reference image.
The character may freely change pose, gesture, expression, clothing, and interaction with props.
Do not create a completely different bee character, but allow natural variation in posture and presentation.

A single wide illustration in soft 3D clay render. Overall canvas: 16:9 landscape (wide horizontal).

CRITICAL COMPOSITION RULE — HIGHEST PRIORITY, NON-NEGOTIABLE:
FULL BODY SHOT ONLY. Wide camera. Zoomed-out. Long-shot composition.
The character (antennae tip to feet) occupies 40–50% of the total canvas height.
At least 20–25% empty space above the antennae. At least 20–25% empty space below the feet.
ABSOLUTELY NO CROPPING. Every body part — antennae, wings, arms, hands, legs, feet — must remain fully inside the canvas.
If in doubt, zoom out further and make the character smaller.
DO NOT create a close-up or medium shot. DO NOT zoom in on the face.
The surrounding environment should occupy more visual space than the character itself.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. CHARACTER
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cute, round bee mascot in Pixar-style soft 3D clay render. Centered horizontally and vertically.
Very chubby soft oval body. Upper: bright sky blue. Lower: yellow. Middle: bold yellow + thick dark navy stripe.
Short rounded arms and legs, yellow feet. Dark navy antennae with sky-blue ball tips. Semi-transparent white wings.
Face: small glossy black round eyes, soft light pink blush on cheeks, wide smiling mouth with small pink tongue.

DO NOT change: body shape, colors (blue/yellow), wings, antennae.

Consumer persona traits — apply ONLY to the following 4 elements:

Lifestyle: {lifestyle}
Consumption habits: {consumption_habit}
Active time pattern: {time_pattern}
Personality vibe (derived from the user's most frequently used emoji): {personality}

1. CLOTHING: ONE outfit matching lifestyle and consumption habits.
   Keep base bee body (blue/yellow) visible — only add clothing on top.
   Clothing and accessories must harmonize with the mascot's blue and yellow body.
   Prefer soft, pastel, finance-app-friendly colors. Avoid neon or clashing colors.
   Examples: casual streetwear, office wear, sporty outfit, cozy homewear, trendy fashion

2. FACIAL EXPRESSION — HIGHEST PRIORITY AFTER COMPOSITION. NON-NEGOTIABLE.
   The face MUST show: {emoji}.
   DO NOT default to a smile. DO NOT soften, reinterpret, or override this expression.
   Replicate this exact emotional state on the bee's face, even if it looks sad, angry, or surprised.
   If the expression is sad or crying, the mouth must curve downward and eyes must look teary — not smiling.
   This expression overrides the reference image's default happy face.

3. POSE/MOTION: One dynamic pose reflecting the time pattern and personality.
   Examples: walking confidently, sitting relaxed, holding something up, waving, stretching.

4. PROPS: ONE iconic prop the character is holding or interacting with.
   Must represent the user's actual consumed item: {top_items}.
   Choose the single most visually iconic object from the item name above.
   If the item above is empty, ambiguous, or hard to depict, fall back to a category-based prop: {props_hint}.
   Immediately recognizable. Occupies less than 15% of the image area.
   Never cover the bee mascot's body.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. BACKGROUND
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Background fills the canvas behind and around the character.
Reflects the persona's lifestyle and active time of day: {time_pattern}.

Time-based mood:
- dawn (0–5h): quiet blue-tinted city streets, calm early morning atmosphere
- morning (5–10h): bright fresh sunlight, energetic start of day
- lunch (10–15h): vibrant daytime activity, bright and lively
- evening (15–20h): soft sunset ambience, warm but balanced lighting
- late night (20–24h): city lights, calm deep-blue atmosphere

Background should be simple and supportive.
Use soft shapes and light environmental cues.
Avoid highly detailed people, crowds, tiny objects, or intricate scenery.
The mascot receives significantly more visual detail than the background.
Background characters, if present, should appear as soft silhouettes — no detailed faces or clothing.

Requirements:
* Bright, clean, balanced lighting — no overly warm or yellow cast
* Soft pastel palette, balanced left-right composition
* Seamlessly integrated with the character — not a composited cutout

Clean and appealing mobile-app illustration quality.
Prioritize mascot readability over ultra-high background detail.
"""


_LIFE_STAGE_VIBE = {
    'TEEN':       "넘치는 에너지와 호기심, 트렌드에 민감하고 감각적인 젊음",
    'UNI':        "자유롭고 유연한 생활, 새로운 경험을 탐험하는 청춘의 활기",
    'NEW_JOB':    "사회에 첫 발을 내딛는 설렘과 도전, 바쁜 일상 속 작은 여유",
    'NEW_WED':    "함께하는 일상의 따뜻함, 둘이서 만들어가는 새로운 생활",
    'CHILD_BABY': "아이 중심의 세심한 일상, 가족을 위한 따뜻한 헌신",
    'CHILD_TEEN': "바쁜 육아와 교육 사이, 가족의 일상을 단단히 이어가는 에너지",
    'CHILD_UNI':  "자녀의 독립을 응원하며 자신의 삶도 돌아보는 여유",
    'GOLLIFE':    "풍부한 경험과 여유, 삶을 깊이 즐길 줄 아는 성숙함",
    'SECLIFE':    "제2의 전성기를 준비하는 활력, 새로운 시작의 설렘",
    'RETIR':      "느긋하고 풍요로운 일상, 오랜 지혜로 삶을 음미하는 여유",
}


_ANALYSIS_PROMPT = """
다음은 사용자의 최근 결제 내역 요약입니다:
{summary}

이번 아바타 생성에 반영된 핵심 데이터:
- 대표 이모지: {emoji_input} (감정: {emoji_mood_ko})
- 결제 카테고리 1위: {top_category}
- 주 활동 시간대: {dominant_slot} {slot_emoji}
- VLM 분석 소비 아이템: {top_items}

사용자 에너지와 감성: {life_stage_vibe}

이 소비 데이터를 분석하여 아래 JSON 형식으로만 응답하세요 (다른 설명 없이):
{{
    "title": "이 사람의 소비 습관({top_items}/{top_category}/{dominant_slot})을 바탕으로 유쾌하고 센스 있는 '칭호'를 부여해주세요. 반드시 [특정 소비처/아이템] + [지정된 칭호 어미] 구조로만 작성해야 합니다. \n[허용된 칭호 어미]: 대주주, 장인, 요정, VIP, 큰손, 출석왕, 폭격기, 마스터, 지배자, 빌런. \n(예: '심야 편의점 지배자', '택시비 폭격기', '아메리카노 대주주', '야식 빌런', '텅장 장인'). 부연 설명 없이 3어절의 칭호만 정확히 출력하세요."
    "description": "이 페르소나를 한 문장으로 소개하는 설명. 반드시 '소비자'라는 단어로 끝낼 것. 예: 'OO를 즐기는 소비자'. (공백 포함 최대 30자)",
    "change_reason": {{
        "emoji": {{
            "header": "반드시 '{emoji_input}' 이모지로 시작하고, '{emoji_mood_ko}' 감정을 한 줄로 표현 (공백포함 11자)",
            "context": "이번 주 소비 사진에서 '{emoji_input}({emoji_mood_ko})' 이모지를 가장 많이 선택했어요. 이 감정이 아바타에 어떻게 담겼는지 친구에게 말해주듯이 (공백포함 35자)"
        }},
        "background": {{
            "header": "카테고리와 소비 스타일을 담은 감성 한 줄 (예: '카페 없인 못 사는 타입') (공백포함 11자)",
            "context": "1위 소비 카테고리가 아바타 배경과 의상에 어떻게 반영됐는지 한 문장. (공백포함 35자)"
        }},
        "time": {{
            "header": "활동 시간대의 감성을 담은 한 줄 (예: '점심시간 = 황금시간대') (공백포함 11자)",
            "context": "이번 주 결제 시간대가 아바타 배경 분위기에 어떻게 반영됐는지 한 문장. (공백포함 35자)"
        }},
        "item": {{
            "header": "소비 아이템을 감각적으로 표현한 한 줄 (예: '아메리카노 & 마카롱 홀릭') (공백포함 11자)",
            "context": "VLM이 포착한 아이템이 어떻게 아바타 반영됐는지 한 문장. (공백포함 35자)"
        }}
    }}
}}
"""

# 사진 데이터 없을 때 — transactions만 기반
_ANALYSIS_PROMPT_NO_VLM = """
다음은 사용자의 최근 결제 내역 요약입니다 (소비 사진 데이터 없음):
{summary}

이번 아바타 생성에 반영된 핵심 데이터:
- 결제 카테고리 1위: {top_category}
- 주 활동 시간대: {dominant_slot} {slot_emoji}
- 대표 소비 항목: {top_items}

사용자 에너지와 감성: {life_stage_vibe}

소비 사진이 없으므로 이모지/VLM 데이터는 없습니다. 결제 내역만으로 분석하세요.
아래 JSON 형식으로만 응답하세요 (다른 설명 없이):
{{
    "title": "이 사람의 소비 습관({top_items}/{top_category}/{dominant_slot})을 바탕으로 유쾌하고 센스 있는 '칭호'를 부여해주세요. 반드시 [특정 소비처/아이템] + [지정된 칭호 어미] 구조로만 작성해야 합니다. \n[허용된 칭호 어미]: 대주주, 장인, 요정, VIP, 큰손, 출석왕, 폭격기, 마스터, 지배자, 빌런. \n(예: '심야 편의점 지배자', '택시비 폭격기', '아메리카노 대주주', '야식 빌런', '텅장 장인'). 부연 설명 없이 3어절의 칭호만 정확히 출력하세요."
    "description": "이 페르소나를 한 문장으로 소개하는 설명. 반드시 '소비자'라는 단어로 끝낼 것. 예: 'OO를 즐기는 소비자'. (공백 포함 최대 30자)",
    "change_reason": {{
        "emoji": {{
            "header": "소비 패턴에서 느껴지는 감성 한 줄 (공백포함 11자)",
            "context": "결제 데이터로 파악한 이 사람의 소비 성향을 친구에게 말해주듯이 (공백포함 35자)"
        }},
        "background": {{
            "header": "카테고리와 소비 스타일을 담은 감성 한 줄 (예: '카페 없인 못 사는 타입') (공백포함 11자)",
            "context": "1위 소비 카테고리가 아바타 배경과 의상에 어떻게 반영됐는지 한 문장. (공백포함 35자)"
        }},
        "time": {{
            "header": "활동 시간대의 감성을 담은 한 줄 (예: '점심시간 = 황금시간대') (공백포함 11자)",
            "context": "이번 주 결제 시간대가 아바타 배경 분위기에 어떻게 반영됐는지 한 문장. (공백포함 35자)"
        }},
        "item": {{
            "header": "대표 소비 항목을 감각적으로 표현한 한 줄 (공백포함 11자)",
            "context": "결제 내역 기반 대표 소비 항목이 아바타에 어떻게 반영됐는지 한 문장. (공백포함 35자)"
        }}
    }}
}}
"""

register("avatar_image", _AVATAR_PROMPT)
register("avatar_analysis", _ANALYSIS_PROMPT)
register("avatar_analysis_no_vlm", _ANALYSIS_PROMPT_NO_VLM)

TIME_SLOTS = {
    "새벽": {"range": (0, 4),   "emoji": "🌅", "en": "dawn (0-5h)"},
    "아침": {"range": (5, 9),   "emoji": "☀️", "en": "morning (5-10h)"},
    "점심": {"range": (10, 14), "emoji": "🍽️", "en": "lunch time (10-15h)"},
    "저녁": {"range": (15, 19), "emoji": "🌃", "en": "evening (15-20h)"},
    "심야": {"range": (20, 23), "emoji": "🌙", "en": "late night (20-24h)"},
}

CATEGORY_ID_MAP: dict[int, str] = {cat_id: name for cat_id, name, _ in STANDARD_CATEGORIES}

CATEGORY_PROPS_MAP = {
    "경조/선물":  "gift box, bouquet",
    "교육/학습":  "textbook, pencil, notebook",
    "교통":       "transit card, bus pass",
    "금융":       "coin, credit card, piggy bank",
    "문화/여가":  "movie ticket, popcorn",
    "뷰티/미용":  "makeup brush, perfume bottle",
    "생활":       "grocery bag, household items",
    "술/유흥":    "cocktail glass, beer mug",
    "식비":       "fork and knife, food tray",
    "여행/숙박":  "luggage, passport, camera",
    "온라인쇼핑": "shopping bag, delivery box",
    "의료/건강":  "vitamin bottle, running shoes",
    "주거/통신":  "smartphone, wifi router",
    "카페/간식":  "coffee cup, dessert plate",
    "패션/쇼핑":  "shopping bag, clothing tag",
    "기타":       "a recognizable item related to the spending category",
}


def _classify_time_slot(hour: int) -> str:
    for slot, info in TIME_SLOTS.items():
        start, end = info["range"]
        if start <= hour <= end:
            return slot
    return "심야"


def _get_props_hint(category: str) -> str:
    return CATEGORY_PROPS_MAP.get(category, CATEGORY_PROPS_MAP["기타"])


def _extract_persona_elements(transactions: list[dict], vlm_items: list[str], emoji: str) -> dict:
    category_spend: dict[str, int] = defaultdict(int)
    slot_count: dict[str, int] = defaultdict(int)

    for t in transactions:
        cat_id = t.get("payment_category_id")
        category = CATEGORY_ID_MAP.get(cat_id, "기타") if cat_id else "기타"
        category_spend[category] += int(t.get("payment_out") or 0)

        hour = _extract_hour(t.get("payment_time"))
        if hour is not None:
            slot_count[_classify_time_slot(hour)] += 1

    top_category = max(category_spend, key=lambda k: category_spend[k]) if category_spend else "기타"
    dominant_slot = max(slot_count, key=lambda k: slot_count[k]) if slot_count else "심야"

    return {
        "top_category": top_category,
        "dominant_slot": dominant_slot,
        "props_hint": _get_props_hint(top_category),
        "emoji": emoji if emoji else "😊",
    }


def _build_transaction_summary(
    transactions: list[dict],
    vlm_items: list[str],
    vlm_descriptions: list[str],
) -> str:
    category_spend: dict[str, int] = defaultdict(int)
    slot_count: dict[str, int] = defaultdict(int)
    place_count: dict[str, int] = defaultdict(int)

    for t in transactions:
        cat_id = t.get("payment_category_id")
        category = CATEGORY_ID_MAP.get(cat_id, "기타") if cat_id else "기타"
        category_spend[category] += int(t.get("payment_out") or 0)

        hour = _extract_hour(t.get("payment_time"))
        if hour is not None:
            slot_count[_classify_time_slot(hour)] += 1

        place = (t.get("payment_place") or "").strip()
        if place:
            place_count[place] += 1

    top_categories = sorted(category_spend.items(), key=lambda x: x[1], reverse=True)[:5]
    dominant_slot = max(slot_count, key=lambda k: slot_count[k]) if slot_count else "심야"
    slot_emoji = TIME_SLOTS.get(dominant_slot, {}).get("emoji", "")
    top_places = sorted(place_count.items(), key=lambda x: x[1], reverse=True)[:3]

    lines = [
        f"총 결제 건수: {len(transactions)}건",
        f"카테고리별 지출 (상위 5): " + ", ".join(f"{c} {a:,}원" for c, a in top_categories),
        f"주 활동 시간대: {dominant_slot} {slot_emoji}",
        f"자주 방문 가맹점: " + ", ".join(p for p, _ in top_places),
    ]
    if vlm_items:
        lines.append("소비 항목 (VLM 분석): " + ", ".join(vlm_items[:10]))
    if vlm_descriptions:
        lines.append("소비 사진 설명: " + " / ".join(vlm_descriptions[:5]))

    return "\n".join(lines)



def _extract_hour(payment_time) -> int | None:
    if payment_time is None:
        return None
    if hasattr(payment_time, "total_seconds"):
        return int(payment_time.total_seconds() // 3600)
    try:
        return int(str(payment_time)[:2])
    except (ValueError, TypeError):
        return None


_REFERENCE_IMAGE_PATH = Path(__file__).parent.parent / "resource" / "wibee.png"


@traceable(name="아바타 이미지 생성")
async def _generate_image(prompt: str) -> bytes:
    client = wrap_openai(AsyncOpenAI(api_key=settings.OPENAI_API_KEY))
    image_data = io.BytesIO(_REFERENCE_IMAGE_PATH.read_bytes())
    image_data.name = "wibee.png"
    response = await client.images.edit(
        model="gpt-image-2",
        image=image_data,
        prompt=prompt,
        size="1536x1024",
        quality="low",
        n=1,
    )
    return base64.b64decode(response.data[0].b64_json)


def _upload_to_s3(image_bytes: bytes, user_id: int) -> str:
    s3 = boto3.client(
        "s3",
        aws_access_key_id=settings.AWS_ACCESS_KEY_ID,
        aws_secret_access_key=settings.AWS_SECRET_ACCESS_KEY,
        region_name=settings.AWS_REGION,
    )
    key = f"avatars/{user_id}/{datetime.now().strftime('%Y%m%d_%H%M%S')}.png"
    s3.put_object(
        Bucket=settings.S3_BUCKET_NAME,
        Key=key,
        Body=image_bytes,
        ContentType="image/png",
    )
    return f"https://{settings.S3_BUCKET_NAME}.s3.{settings.AWS_REGION}.amazonaws.com/{key}"


def _get_last_week_range() -> tuple[str, str]:
    from zoneinfo import ZoneInfo
    today = datetime.now(ZoneInfo("Asia/Seoul")).date()
    this_monday = today - timedelta(days=today.weekday())
    last_monday = this_monday - timedelta(days=7)
    last_sunday = last_monday + timedelta(days=6)
    return str(last_monday), str(last_sunday)


@traceable(name="아바타 페르소나 분석")
async def _analyze_persona(
    summary: str,
    emoji_input: str,
    top_category: str,
    dominant_slot: str,
    slot_emoji: str,
    top_items: str,
    life_stage_code: str,
    has_vlm: bool = True,
) -> dict:
    client = google_genai.Client(api_key=settings.GEMINI_API_KEY)
    emoji_mood_ko = MOOD_KO.get(emoji_input, "감정")
    if has_vlm:
        prompt = get_prompt("avatar_analysis").format(
            summary=summary,
            emoji_input=emoji_input,
            emoji_mood_ko=emoji_mood_ko,
            top_category=top_category,
            dominant_slot=dominant_slot,
            slot_emoji=slot_emoji,
            top_items=top_items,
            life_stage_vibe=_LIFE_STAGE_VIBE.get(life_stage_code, "활기찬 일상을 살아가는 에너지"),
        )
    else:
        prompt = get_prompt("avatar_analysis_no_vlm").format(
            summary=summary,
            top_category=top_category,
            dominant_slot=dominant_slot,
            slot_emoji=slot_emoji,
            top_items=top_items,
            life_stage_vibe=_LIFE_STAGE_VIBE.get(life_stage_code, "활기찬 일상을 살아가는 에너지"),
        )
    response = await client.aio.models.generate_content(
        model="gemini-3.5-flash",
        contents=prompt,
        config=genai_types.GenerateContentConfig(
            response_mime_type="application/json",
            thinking_config=genai_types.ThinkingConfig(thinking_level="minimal"),
        ),
    )
    # thinking 파트를 제외한 실제 텍스트만 추출
    text = next(
        (p.text for p in response.candidates[0].content.parts
         if not getattr(p, "thought", False) and getattr(p, "text", None)),
        response.text,
    )
    # thinking 잔여물이 JSON 앞뒤에 붙는 경우 outermost {} 블록만 파싱
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        text = text[start:end + 1]
    return json.loads(text)


@traceable(name="아바타 생성", project_name="sobee-avatar")
async def _generate_and_save_avatar(user_id: int, start_date: str, end_date: str) -> AvatarResponse:
    # 1. DB 병렬 조회
    transactions, mapped, photo_emotions, life_stage_code_raw = await asyncio.gather(
        get_transactions_by_date_range(user_id, start_date, end_date),
        get_mapped_transactions_with_vlm(user_id, start_date, end_date),
        get_photo_emotions_by_taken_at(user_id, start_date, end_date),
        get_user_life_stage(user_id),
    )
    if not transactions:
        raise HTTPException(
            status_code=404,
            detail=f"No transactions found for user_id={user_id} ({start_date}~{end_date})"
        )
    life_stage_code = life_stage_code_raw or "NEW_JOB"

    # 2. VLM 데이터 추출
    vlm_items = list(dict.fromkeys(r["vlm_item_name"] for r in mapped if r.get("vlm_item_name")))
    vlm_descriptions = [r["vlm_description"] for r in mapped if r.get("vlm_description")]
    # 감정 집계: 리포트 주차별 감정(weekly_top_emotion)과 동일한 모집단(taken_at 기준, 사진 단위)·
    # 동일한 동률 규칙(최빈, 동률 시 최근 사진 우선)을 공유 함수로 적용해 화면 표기와 통일한다.
    top_mood = pick_top_mood_name(photo_emotions)  # emotions_text.emoji는 enum 이름(HAPPY/SAD...)
    # enum 이름 → 실제 이모지 글자 변환 (report_service와 동일 규칙). 미등록 enum이면 경고 후 무시.
    if top_mood and top_mood not in MOOD_NAME_TO_EMOJI:
        log.warning(f"[avatar] 알 수 없는 감정 enum: {top_mood!r} (user_id={user_id})")
    emoji = MOOD_NAME_TO_EMOJI.get(top_mood) if top_mood else None
    has_vlm = bool(vlm_items or emoji)

    # 3. 페르소나 핵심 요소 추출
    elements = _extract_persona_elements(transactions, vlm_items, emoji or "")
    top_category = elements["top_category"]
    dominant_slot = elements["dominant_slot"]
    props_hint = elements["props_hint"]
    slot_en = TIME_SLOTS.get(dominant_slot, {}).get("en", dominant_slot)
    slot_emoji = TIME_SLOTS.get(dominant_slot, {}).get("emoji", "")
    top_items = " & ".join(vlm_items[:2]) if vlm_items else top_category

    # 4. 이미지 프롬프트 직접 조립
    life_stage_vibe = _LIFE_STAGE_VIBE.get(life_stage_code, "활기찬 일상을 살아가는 에너지")
    face_vibe = MOOD_EXPRESSION_EN.get(emoji, "calm neutral") if emoji else "calm neutral"
    face_expression = MOOD_EXPRESSION_EN.get(emoji, f"{emoji} expression") if emoji else "calm neutral expressionless face"
    image_prompt = get_prompt("avatar_image").format(
        lifestyle=f"{life_stage_vibe}. Primarily spends on {top_category}.",
        consumption_habit=f"Top spending category: {top_category}. Key consumed item: {top_items}.",
        time_pattern=TIME_SLOTS.get(dominant_slot, {}).get("en", dominant_slot),
        personality=f"{face_vibe} vibe. {life_stage_vibe}.",
        props_hint=props_hint,
        emoji=face_expression,
        top_items=top_items,
    )

    # 5. LLM 분석 + 이미지 생성 병렬 실행
    import time as _time
    summary = _build_transaction_summary(transactions, vlm_items, vlm_descriptions)
    _t0 = _time.monotonic()
    analysis, image_bytes = await asyncio.gather(
        _analyze_persona(
            summary=summary,
            emoji_input=emoji or "",
            top_category=top_category,
            dominant_slot=dominant_slot,
            slot_emoji=slot_emoji,
            top_items=top_items,
            life_stage_code=life_stage_code,
            has_vlm=has_vlm,
        ),
        _generate_image(image_prompt),
    )
    from app.core.metrics import record
    record("avatar", round((_time.monotonic() - _t0) * 1000))

    # 6. S3 업로드 및 DB 저장
    avatar_image_url = _upload_to_s3(image_bytes, user_id)
    change_reason = analysis["change_reason"]
    if emoji and isinstance(change_reason, dict) and isinstance(change_reason.get("emoji"), dict):
        import re as _re
        header = change_reason["emoji"].get("header", "")
        # 첫 한글 이전의 이모지·공백을 제거하고 실제 emoji로 교체
        header_text = _re.sub(r"^[^가-힣]+", "", header).strip()
        change_reason["emoji"]["header"] = f"{emoji} {header_text}"
    week_monday = datetime.strptime(start_date, "%Y-%m-%d")
    await update_user_avatar(
        user_id=user_id,
        avatar_name=analysis["title"],
        avatar_explain=analysis["description"],
        avatar_img_url=avatar_image_url,
        avatar_change_reason=json.dumps(change_reason, ensure_ascii=False) if isinstance(change_reason, dict) else change_reason,
        avatar_created_at=week_monday,
    )

    if has_vlm:
        change_reason_summary = f"이모지: {emoji} / 카테고리: {top_category} / 시간대: {dominant_slot} {slot_emoji} / 아이템: {top_items}"
    else:
        change_reason_summary = f"카테고리: {top_category} / 시간대: {dominant_slot} {slot_emoji} / 아이템: {top_items}"

    return AvatarResponse(
        avatar_title=analysis["title"],
        avatar_description=analysis["description"],
        avatar_image=avatar_image_url,
        generated_period=f"{start_date} ~ {end_date}",
        change_reason_summary=change_reason_summary,
    )


def _is_valid_date(value: str) -> bool:
    try:
        datetime.strptime(value, "%Y-%m-%d")
        return True
    except (ValueError, TypeError):
        return False


async def generate_avatar(request: AvatarRequest) -> AvatarResponse:
    start_date = request.start_date
    end_date = request.end_date
    if not start_date or not end_date or not _is_valid_date(start_date) or not _is_valid_date(end_date):
        start_date, end_date = _get_last_week_range()
    return await _generate_and_save_avatar(request.user_id, start_date, end_date)
