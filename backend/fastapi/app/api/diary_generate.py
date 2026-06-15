import json
import time as _time
import asyncio
from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.core.constants import MOOD_LABEL
from app.models.schemas import DiaryRequest, DiaryResponse
from app.core.prompt_store import register, get_prompt
from app.core.life_stage_prompt import get_system_prompt

from langsmith import traceable
from google import genai
from google.genai import types

router = APIRouter()

ROOM_CATEGORY_THEME = {
    "EXERCISE": "이 방은 운동 기록 방이야. 운동 후의 뿌듯함, 땀, 근육통, 성취감을 역동적이고 생동감 있게 표현해줘. 건강한 에너지가 느껴지도록.",
    "HOBBY":    "이 방은 취미 생활 방이야. 취미에 빠져드는 몰입감, 설렘, 소소한 행복을 위트 있고 감성적으로 표현해줘.",
    "TRAVEL":   "이 방은 여행/아웃도어 방이야. 낯선 장소의 설렘, 자연의 풍경, 여행의 자유로움을 생생하고 감각적으로 묘사해줘.",
    "FAMILY":   "이 방은 가족/육아 방이야. 소중한 가족과의 따뜻한 순간, 아이의 귀여운 모습, 가족 간의 애정을 따뜻하고 다정하게 표현해줘.",
    "DAILY":    "이 방은 일상 기록 방이야. 평범하지만 소중한 하루의 순간들을 감각적이고 담담하게, 그러나 특별하게 느껴지도록 표현해줘.",
    "FOOD":     "이 방은 맛집/음식 방이야. 음식의 맛, 향, 식감과 함께 카페나 식당의 분위기와 비주얼을 인스타 감성으로 트렌디하게 묘사해줘.",
    "PET":      "이 방은 반려동물 방이야. 귀여운 반려동물과의 교감, 일상 속 소소한 웃음 포인트를 사랑스럽고 유쾌하게 표현해줘.",
    "DEFAULT":  "소비의 감정, 분위기, 장소의 특징을 자연스럽게 녹여 인스타그램 피드 감성으로 표현해줘.",
}

def _get_line_guide(photo_count: int) -> str:
    if photo_count <= 0:
        return "Write the diary_lines array with exactly 4 sentences. Each sentence should flow naturally into the next, forming one cohesive diary entry."
    elif photo_count == 1:
        return "Write the diary_lines array with exactly 6 sentences. Each sentence should flow naturally into the next, forming one cohesive diary entry."
    elif photo_count == 2:
        return "Write the diary_lines array with exactly 8 sentences. Each sentence should flow naturally into the next, forming one cohesive diary entry."
    else:
        return (
            "Write the diary_lines array with exactly 10 sentences. "
            "Each sentence must END naturally and lead into the NEXT sentence — no comma-joining of items inside one sentence. "
            "Use sentence-opening transitions to connect consecutive sentences "
            "(e.g. 그러다가~, 근데 심지어~, 결국엔~, 거기다가~, 그 와중에~, 집에 오는 길엔~). "
            "The result must feel like one continuous diary monologue, not a list."
        )

USER_PROMPT_TEMPLATE = """\
[Today's Consumption Info]
- Item: {item_name}
- Category: {category}
- Amount paid: {price} KRW
- Store: {store_name}
- User mood: {mood} (사진 순서대로 각 사진의 기분 이모지, 공백 구분)
- User memo: {emotion_text}
- Group theme: {group_description}
- Room writing theme: {room_theme}
- AI photo analysis: {description}

Write a JSON consumption diary based on the above.
"""

USER_PROMPT_UNMATCHED_TEMPLATE = """\
[주의] 이 사진은 결제 내역과 아직 연결되지 않은 소비 사진이에요.
item, price, store 정보를 사실인 것처럼 언급하거나 추측하지 마세요.
모임방 설명(group theme)은 일기 톤·분위기 참고용으로만 사용하고,
절대 일기 내용에 직접 언급하거나 반영하지 마세요.
AI 사진 분석과 사용자 감정·메모만을 근거로 감정 위주의 일기를 작성해주세요.

[Photo & Mood Info]
- User mood: {mood}
- User memo: {emotion_text}
- Room writing theme: {room_theme}
- AI photo analysis: {description}
- Group theme (톤 참고용, 내용에 직접 언급 금지): {group_description}

Write a JSON consumption diary based on the above.
"""

register("diary_user_matched", USER_PROMPT_TEMPLATE)
register("diary_user_unmatched", USER_PROMPT_UNMATCHED_TEMPLATE)


def _get_client() -> genai.Client:
    if not settings.GEMINI_API_KEY:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY가 설정되지 않았습니다.")
    return genai.Client(api_key=settings.GEMINI_API_KEY)


@traceable(name="일기 생성")
async def generate_diary(req: DiaryRequest) -> DiaryResponse:
    client = _get_client()

    line_guide = _get_line_guide(req.photo_count or 1)

    room_theme = ROOM_CATEGORY_THEME.get(
        (req.room_category or "").upper(),
        ROOM_CATEGORY_THEME["DEFAULT"]
    )

    # life_stage_code로 시스템 프롬프트 선택
    system_content = get_system_prompt(
        getattr(req, "life_stage_code", None)
    ).format(line_guide=line_guide)

    is_matched = req.matched is True
    if is_matched:
        user_content = get_prompt("diary_user_matched").format(
            item_name=req.item_name or "알 수 없음",
            category=req.category or "기타",
            price=f"{int(req.price):,}" if req.price is not None else "0",
            store_name=req.store_name or "알 수 없음",
            mood=req.mood or "",
            emotion_text=req.emotion_text or "없음",
            group_description=req.group_description or "일반 소비",
            room_theme=room_theme,
            description=req.description or "특이사항 없음",
        )
    else:
        user_content = get_prompt("diary_user_unmatched").format(
            mood=req.mood or "",
            emotion_text=req.emotion_text or "없음",
            group_description=req.group_description or "일반 소비",
            room_theme=room_theme,
            description=req.description or "특이사항 없음",
        )

    _t0 = _time.monotonic()
    response = await asyncio.get_event_loop().run_in_executor(
        None,
        lambda: client.models.generate_content(
            model="gemini-2.5-flash",
            contents=user_content,
            config=types.GenerateContentConfig(
                temperature=0.75,
                max_output_tokens=2048,
                response_mime_type="application/json",
                system_instruction=system_content,
            ),
        )
    )
    from app.core.metrics import record
    record("diary", round((_time.monotonic() - _t0) * 1000))

    content = response.text.strip() if response.text else ""
    print(f"[Gemini diary 응답] {repr(content[:300])}")
    if not content:
        raise HTTPException(status_code=500, detail="Gemini 응답이 비어있습니다.")

    if content.startswith("```"):
        content = content.split("```")[1]
        if content.startswith("json"):
            content = content[4:]
        content = content.strip()

    try:
        data = json.loads(content)
        return DiaryResponse(
            title=data["title"],
            diary_lines=data["diary_lines"],
            tags=req.tags or [],
        )
    except (json.JSONDecodeError, KeyError) as e:
        print(f"[일기 생성 에러] {e} | raw: {content[:500]}")
        raise HTTPException(status_code=500, detail=f"일기 생성 파싱 실패: {e} | raw: {content[:200]}")


@router.post("/generate", response_model=DiaryResponse)
async def generate_diary_endpoint(req: DiaryRequest):
    return await generate_diary(req)