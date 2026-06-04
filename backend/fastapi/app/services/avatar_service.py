import asyncio
import base64
import io
import json
from collections import defaultdict
from datetime import datetime, timedelta
from pathlib import Path

import boto3
from openai import OpenAI
from PIL import Image
from fastapi import HTTPException

from app.core.config import settings
from app.db.transaction_repository import get_transactions_by_date_range, get_mapped_transactions_with_vlm
from app.db.user_repository import update_user_avatar, get_user_life_stage
from app.services.ai_insight_service import LIFE_STAGE_KO
from app.services.category_mapping_service import STANDARD_CATEGORIES
from app.models.schemas import AvatarRequest, AvatarResponse

_AVATAR_PROMPT = """
Preserve the mascot's core identity — body colors (sky blue upper, yellow lower), wings, antennae, and overall silhouette — from the reference image.
The character may freely change pose, gesture, expression, clothing, and interaction with props.
Do not create a completely different bee character, but allow natural variation in posture and presentation.

A single wide illustration in Pixar-style soft 3D clay render. Overall canvas: 16:9 landscape (wide horizontal).

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

2. FACIAL EXPRESSION: One clear emotion matching the personality vibe.
   Reflect the emotional vibe conveyed by the user's emoji input.
   Must be immediately recognizable at small mobile-app sizes.
   Examples: cheerful smile, cool confident look, relaxed calm, excited energetic, curious.

3. POSE/MOTION: One dynamic pose reflecting the time pattern and personality.
   Examples: walking confidently, sitting relaxed, holding something up, waving, stretching.

4. PROPS: ONE iconic prop the character is holding or interacting with.
   From: {top_category} ({props_hint}). Immediately recognizable. Occupies less than 15% of the image area.
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
- 대표 이모지: {emoji_input}
- 결제 카테고리 1위: {top_category}
- 주 활동 시간대: {dominant_slot} {slot_emoji}
- VLM 분석 소비 아이템: {top_items}

사용자 에너지와 감성: {life_stage_vibe}

이 소비 데이터를 분석하여 아래 JSON 형식으로만 응답하세요 (다른 설명 없이):
{{
    "title": "아바타 타이틀 — 3~4어절의 한국어. 이 사람의 에너지와 감성({life_stage_vibe})을 소비 패턴과 자연스럽게 녹여낸 감성적인 별명. 생애주기 단어를 직접 쓰지 말 것.",
    "description": "이 페르소나를 한 문장으로 소개하는 설명. 캐릭터의 성격과 라이프스타일 중심으로.",
    "change_reason": {{
        "emoji": {{
            "header": "이모지를 실제 문자로 쓴 짧은 감성 한 줄 (예: '😊 에너지 넘치는 표정')",
            "context": "이번 달 사진 속 대표 이모지를 보고 느낀 점을 MZ 말투로 한 문장. 아바타 표정에 어떻게 녹아들었는지 자연스럽게 풀어쓰기. 딱딱하지 않게, 친구한테 말하듯이."
        }},
        "background": {{
            "header": "카테고리와 소비 스타일을 담은 감성 한 줄 (예: '카페 없인 못 사는 타입')",
            "context": "1위 소비 카테고리가 아바타 배경과 의상에 어떻게 반영됐는지 MZ 말투로 한 문장. 데이터를 딱딱하게 나열하지 말고, 이 사람의 소비 성격을 콕 집어서 재밌게."
        }},
        "time": {{
            "header": "활동 시간대의 감성을 담은 한 줄 (예: '점심시간 = 황금시간대')",
            "context": "주 활동 시간대가 아바타 배경 분위기에 어떻게 반영됐는지 MZ 말투로 한 문장. 시간대의 느낌과 이 사람의 라이프스타일을 연결해서 생동감 있게."
        }},
        "item": {{
            "header": "소비 아이템을 감각적으로 표현한 한 줄 (예: '아메리카노 & 마카롱 홀릭')",
            "context": "VLM이 포착한 아이템이 아바타 손에 들려있다는 걸 MZ 말투로 한 문장. '이거 혹시 당신 얘기 아니에요?' 하는 느낌으로 공감 유도."
        }}
    }},
    "lifestyle": "Lifestyle description in English (2-3 sentences)",
    "consumption_habit": "Consumption habit description in English (2-3 sentences)",
    "time_pattern": "Active time pattern description in English (1-2 sentences)",
    "personality": "Personality vibe description in English (1-2 sentences)"
}}
"""

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


def _generate_image_sync(prompt: str) -> bytes:
    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    with open(_REFERENCE_IMAGE_PATH, "rb") as ref:
        response = client.images.edit(
            model="gpt-image-2",
            image=ref,
            prompt=prompt,
            size="1536x1024",
            quality="medium",
            n=1,
        )

    image_bytes = base64.b64decode(response.data[0].b64_json)
    return image_bytes


async def _generate_image(prompt: str) -> bytes:
    return await asyncio.to_thread(_generate_image_sync, prompt)


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
    today = datetime.today()
    this_monday = today - timedelta(days=today.weekday())
    last_monday = this_monday - timedelta(days=7)
    last_sunday = last_monday + timedelta(days=6)
    return last_monday.strftime("%Y-%m-%d"), last_sunday.strftime("%Y-%m-%d")


def _analyze_persona_sync(
    summary: str,
    emoji_input: str,
    top_category: str,
    dominant_slot: str,
    slot_emoji: str,
    top_items: str,
    life_stage_code: str,
) -> dict:
    client = OpenAI(api_key=settings.OPENAI_API_KEY)
    prompt = _ANALYSIS_PROMPT.format(
        summary=summary,
        emoji_input=emoji_input,
        top_category=top_category,
        dominant_slot=dominant_slot,
        slot_emoji=slot_emoji,
        top_items=top_items,
        life_stage_vibe=_LIFE_STAGE_VIBE.get(life_stage_code, "활기찬 일상을 살아가는 에너지"),
    )

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )

    return json.loads(response.choices[0].message.content)


async def _analyze_persona(
    summary: str,
    emoji_input: str,
    top_category: str,
    dominant_slot: str,
    slot_emoji: str,
    top_items: str,
    life_stage_code: str,
) -> dict:
    return await asyncio.to_thread(
        _analyze_persona_sync,
        summary, emoji_input, top_category, dominant_slot, slot_emoji, top_items,
        life_stage_code,
    )


async def _generate_and_save_avatar(user_id: int, start_date: str, end_date: str) -> AvatarResponse:
    # 1. transactions 조회
    transactions = await get_transactions_by_date_range(user_id, start_date, end_date)
    if not transactions:
        raise HTTPException(
            status_code=404,
            detail=f"No transactions found for user_id={user_id} ({start_date}~{end_date})"
        )

    # 2. VLM 매핑 데이터 조회 및 추출
    mapped = await get_mapped_transactions_with_vlm(user_id, start_date, end_date)
    vlm_items = list(dict.fromkeys(r["vlm_item_name"] for r in mapped if r.get("vlm_item_name")))  # 중복 제거
    vlm_descriptions = [r["vlm_description"] for r in mapped if r.get("vlm_description")]
    emoji = next((r["emoji"] for r in mapped if r.get("emoji")), "😊")

    # 3. 페르소나 핵심 요소 추출
    elements = _extract_persona_elements(transactions, vlm_items, emoji)
    top_category = elements["top_category"]
    dominant_slot = elements["dominant_slot"]
    props_hint = elements["props_hint"]
    slot_en = TIME_SLOTS.get(dominant_slot, {}).get("en", dominant_slot)
    slot_emoji = TIME_SLOTS.get(dominant_slot, {}).get("emoji", "")
    top_items = " & ".join(vlm_items[:2]) if vlm_items else top_category

    # 4. LLM 소비 분석 (change_reason 구조 포함)
    summary = _build_transaction_summary(transactions, vlm_items, vlm_descriptions)
    life_stage_code = await get_user_life_stage(user_id) or "NEW_JOB"
    life_stage_ko = LIFE_STAGE_KO.get(life_stage_code, "회원")
    analysis = await _analyze_persona(
        summary=summary,
        emoji_input=emoji,
        top_category=top_category,
        dominant_slot=dominant_slot,
        slot_emoji=slot_emoji,
        top_items=top_items,
        life_stage_code=life_stage_code,
    )

    # 5. 이미지 프롬프트 조립
    time_pattern = f"{slot_en} — {analysis['time_pattern']}"
    prompt = _AVATAR_PROMPT.format(
        lifestyle=analysis["lifestyle"],
        consumption_habit=analysis["consumption_habit"],
        time_pattern=time_pattern,
        personality=analysis["personality"],
        top_category=top_category,
        props_hint=props_hint,
    )

    # 6. 이미지 생성 및 S3 업로드
    image_bytes = await _generate_image(prompt)
    avatar_image_url = _upload_to_s3(image_bytes, user_id)

    # 7. DB 저장 (모두 LLM 분석 결과로 통일)
    change_reason = analysis["change_reason"]
    await update_user_avatar(
        user_id=user_id,
        avatar_name=analysis["title"],
        avatar_explain=analysis["description"],
        avatar_img_url=avatar_image_url,
        avatar_change_reason=json.dumps(change_reason, ensure_ascii=False) if isinstance(change_reason, dict) else change_reason,
    )

    change_reason_summary = f"이모지: {emoji} / 카테고리: {top_category} / 시간대: {dominant_slot} {slot_emoji} / 아이템: {top_items}"

    return AvatarResponse(
        avatar_title=analysis["title"],
        avatar_description=analysis["description"],
        avatar_image=avatar_image_url,
        generated_period=f"{start_date} ~ {end_date}",
        change_reason_summary=change_reason_summary,
    )


async def generate_avatar(request: AvatarRequest) -> AvatarResponse:
    start_date, end_date = _get_last_week_range()
    return await _generate_and_save_avatar(request.user_id, start_date, end_date)
