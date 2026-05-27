import base64
import io
import json
from collections import defaultdict
from datetime import datetime, timedelta

import boto3
from openai import AsyncOpenAI
from PIL import Image
from fastapi import HTTPException

from app.core.config import settings
from app.db.transaction_repository import get_transactions_by_date_range, get_mapped_transactions_with_vlm
from app.db.user_repository import update_user_avatar
from app.models.schemas import AvatarRequest, AvatarResponse

_AVATAR_PROMPT = """
A single wide illustration in Pixar-style soft 3D clay render. Overall canvas: 16:9 landscape (wide horizontal).

The scene contains TWO elements seamlessly combined:

1. CHARACTER (centered horizontally and vertically on the canvas — the character is the focal point of the entire composition):
A cute chubby bee-inspired mascot character in high-quality 3D render style, based on a simple flat illustration design.
The character has a rounded blob-shaped body with a soft matte clay texture, pastel blue upper body, and a yellow-and-blue striped belly.
Small translucent wings on both sides, short blue antennae on top of the head, tiny black dot eyes, and a warm smiling face.
Rounded yellow feet and tiny stubby arms.
Pixar-style 3D character design, clean topology, soft global illumination, subtle ambient occlusion, smooth shading, toy-like proportions, highly appealing mascot design.
Front-facing full body pose, placed exactly at the horizontal and vertical center of the canvas. The ENTIRE character from the tip of the antennae to the bottom of the feet must be fully visible — do not cut off any part of the body.
Minimal but expressive facial features, soft lighting, modern mobile app mascot aesthetic, polished 3D animation studio quality.

Consumer persona traits applied to the character:
- Lifestyle: {lifestyle}
- Consumption habits: {consumption_habit}
- Active time pattern: {time_pattern}
- Personality vibe: {personality}

Based on these traits, naturally generate on the character:
- fitting fashion and accessories
- matching facial expression and pose
- suitable props and items

2. BACKGROUND (fills the entire canvas behind and around the character):
A richly detailed environment that reflects the persona's lifestyle and active time pattern.
Same Pixar 3D clay render art style and color palette as the character — fully cohesive visual language.
Cozy, vibrant, and emotionally expressive setting. Soft pastel colors, warm lighting.
The background wraps symmetrically around the centered character — balanced left and right, with depth and context extending in all directions.

The character and background must feel like one seamlessly integrated scene — not a composited cutout.
Final result: a premium wide banner card for a mobile finance app, cute and emotionally appealing, with the mascot character prominently centered.
"""

_ANALYSIS_PROMPT = """
다음은 사용자의 최근 결제 내역 요약입니다:
{summary}

이 소비 데이터를 분석하여 아래 JSON 형식으로만 응답하세요 (다른 설명 없이):
{{
    "title": "아바타 타이틀 (예: '야행성 도시 탐험가'처럼 2-4단어의 감성적 한국어 별명)",
    "description": "이 페르소나를 한 문장으로 소개하는 설명. 캐릭터의 성격과 라이프스타일 중심으로.",
    "change_reason": "이번 주 소비 데이터에서 눈에 띄는 패턴을 근거로, 아바타가 이렇게 선정된 이유를 2문장 이내 한국어로 서술. 실제 데이터 수치 언급.",
    "lifestyle": "Lifestyle description in English (2-3 sentences)",
    "consumption_habit": "Consumption habit description in English (2-3 sentences)",
    "time_pattern": "Active time pattern description in English (1-2 sentences)",
    "personality": "Personality vibe description in English (1-2 sentences)"
}}
"""


def _extract_hour(payment_time) -> int | None:
    """aiomysql TIME → timedelta, 또는 None 처리"""
    if payment_time is None:
        return None
    if hasattr(payment_time, "total_seconds"):
        return int(payment_time.total_seconds() // 3600)
    try:
        return int(str(payment_time)[:2])
    except (ValueError, TypeError):
        return None


def _build_transaction_summary(transactions: list[dict], vlm_descriptions: list[str] | None = None) -> str:
    category_spend: dict[str, int] = defaultdict(int)
    time_buckets = {"morning (6-12)": 0, "afternoon (12-18)": 0, "evening (18-22)": 0, "night (22-6)": 0}
    place_count: dict[str, int] = defaultdict(int)

    for t in transactions:
        category = (t.get("payment_category") or "기타").strip() or "기타"
        amount = int(t.get("payment_out") or 0)
        category_spend[category] += amount

        hour = _extract_hour(t.get("payment_time"))
        if hour is not None:
            if 6 <= hour < 12:
                time_buckets["morning (6-12)"] += 1
            elif 12 <= hour < 18:
                time_buckets["afternoon (12-18)"] += 1
            elif 18 <= hour < 22:
                time_buckets["evening (18-22)"] += 1
            else:
                time_buckets["night (22-6)"] += 1

        place = (t.get("payment_place") or "").strip()
        if place:
            place_count[place] += 1

    top_categories = sorted(category_spend.items(), key=lambda x: x[1], reverse=True)[:5]
    dominant_time = max(time_buckets, key=lambda k: time_buckets[k])
    top_places = sorted(place_count.items(), key=lambda x: x[1], reverse=True)[:3]

    lines = [
        f"총 결제 건수: {len(transactions)}건",
        f"카테고리별 지출 (상위 5): " + ", ".join(f"{c} {a:,}원" for c, a in top_categories),
        f"주 활동 시간대: {dominant_time}",
        f"자주 방문 가맹점: " + ", ".join(p for p, _ in top_places),
    ]
    if vlm_descriptions:
        lines.append("소비 사진 설명: " + " / ".join(vlm_descriptions[:10]))
    return "\n".join(lines)


async def _analyze_persona(summary: str) -> dict:
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    prompt = _ANALYSIS_PROMPT.format(summary=summary)

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
    )

    return json.loads(response.choices[0].message.content)


def _crop_to_ratio(image_bytes: bytes, width_ratio: int, height_ratio: int) -> bytes:
    img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    w, h = img.size
    target = width_ratio / height_ratio
    current = w / h

    if current > target:
        new_w = int(h * target)
        left = (w - new_w) // 2
        img = img.crop((left, 0, left + new_w, h))
    elif current < target:
        new_h = int(w / target)
        top = (h - new_h) // 2
        img = img.crop((0, top, w, top + new_h))

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return buf.getvalue()


async def _generate_image(prompt: str) -> bytes:
    client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

    response = await client.images.generate(
        model="gpt-image-1",
        prompt=prompt,
        size="1536x1024",  # 3:2 landscape, 16:9로 크롭
        quality="high",
        n=1,
    )

    image_bytes = base64.b64decode(response.data[0].b64_json)
    return _crop_to_ratio(image_bytes, width_ratio=16, height_ratio=9)


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


async def _generate_and_save_avatar(user_id: int, start_date: str, end_date: str) -> AvatarResponse:
    """B(전체 결제) + A∩C(매핑된 VLM description) → 페르소나 생성 → S3 업로드 → users 저장"""
    transactions = await get_transactions_by_date_range(user_id, start_date, end_date)
    if not transactions:
        raise HTTPException(
            status_code=404,
            detail=f"No transactions found for user_id={user_id} ({start_date}~{end_date})"
        )

    mapped = await get_mapped_transactions_with_vlm(user_id, start_date, end_date)
    vlm_descriptions = [r["vlm_description"] for r in mapped if r.get("vlm_description")]

    summary = _build_transaction_summary(transactions, vlm_descriptions)
    analysis = await _analyze_persona(summary)

    prompt = _AVATAR_PROMPT.format(
        lifestyle=analysis["lifestyle"],
        consumption_habit=analysis["consumption_habit"],
        time_pattern=analysis["time_pattern"],
        personality=analysis["personality"],
    )

    image_bytes = await _generate_image(prompt)
    avatar_image_url = _upload_to_s3(image_bytes, user_id)

    await update_user_avatar(
        user_id=user_id,
        avatar_name=analysis["title"],
        avatar_explane=analysis["description"],
        avatar_img_url=avatar_image_url,
        avatar_change_reason=analysis["change_reason"],
    )

    return AvatarResponse(
        avatar_title=analysis["title"],
        avatar_description=analysis["description"],
        avatar_image=avatar_image_url,
    )


async def generate_avatar(request: AvatarRequest) -> AvatarResponse:
    start_date, end_date = _get_last_week_range()
    return await _generate_and_save_avatar(request.user_id, start_date, end_date)
