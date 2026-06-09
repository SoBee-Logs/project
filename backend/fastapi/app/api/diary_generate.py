import json
from openai import AsyncOpenAI
from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.core.constants import MOOD_LABEL
from app.models.schemas import DiaryRequest, DiaryResponse
from app.core.prompt_store import register, get_prompt

from langsmith import traceable
from langsmith.wrappers import wrap_openai

router = APIRouter()

# 모임방 카테고리별 일기 작성 테마 지침
# room_category 값이 없거나 알 수 없는 경우 DEFAULT 사용
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

# ── 프롬프트 템플릿 ───────────────────────────────────────────────
SYSTEM_PROMPT_TEMPLATE = """\
한국 20대가 카톡·인스타 스토리에 올리는 소비 일기 작가야.
짧고 툭툭 던지는 문장으로, 친구한테 보내는 카톡처럼 써줘.

[규칙]
1. 전체 한국어로 작성.
2. {line_guide}
3. 문장은 짧고 간결하게. 한 문장에 너무 많은 내용 넣지 말 것.
4. 이모지·ㅋㅋ·ㅠㅠ 자연스럽게 1-2개씩.
5. 유행어·줄임말은 전체 기준 2~3개만. 억지로 넣지 말 것.
   - 소비 표현: 긁었다, 질렀다, 지갑 털림, 탕진, 합리화 완료, 가성비
   - 감탄 표현: ㄹㅇ, 찐, 존맛, 미쳤다, 실화냐
6. "~을 샀습니다" 같은 기계적 표현 절대 금지.
7. 사용자 기분·메모의 말투를 일기 전체 톤에 자연스럽게 녹여줘.
   - 메모가 짧고 구어체면 일기도 그 느낌으로.
   - 감탄사·줄임말이 있으면 그 에너지를 살려서 써.
   - 기분을 직접 언급하지 말고 문체에 녹여낼 것.
8. 욕설·비속어는 사용하지 않는다. 단, "미쳤다", "레전드", "존맛" 등 일반적인 감탄 표현은 허용.
9. 아래 JSON만 출력 (마크다운 백틱 제외).

[예시]
"오늘 점심 부찌 ㄹㅇ 맛남"
"라면사리까지 존맛 🔥"
"지갑 털렸는데 후회 없음 ㅋㅋ"

{{
  "title": "제목 (이모지 1개 포함, 10자 이내, 임팩트 있게)",
  "diary_lines": ["짧은 문장1", "짧은 문장2", ...]
}}
"""

# 매핑된 사진(결제 내역 연결 완료) 프롬프트
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

# 미매핑 사진(결제 내역 미연결) 프롬프트
# 가격·가게명 등 결제 정보가 없으므로 환각 방지를 위해 장면·감정 위주로만 작성하도록 안내
USER_PROMPT_UNMATCHED_TEMPLATE = """\
[주의] 이 사진은 결제 내역과 아직 연결되지 않은 소비 사진이에요.
item, price, store 정보를 사실인 것처럼 언급하거나 추측하지 마세요.
AI 사진 분석과 사용자 감정·메모만을 근거로 소비 장면과 감정 위주의 일기를 작성해주세요.

[Photo & Mood Info]
- User mood: {mood} (사진 순서대로 각 사진의 기분 이모지, 공백 구분)
- User memo: {emotion_text}
- Group theme: {group_description}
- Room writing theme: {room_theme}
- AI photo analysis: {description}

Write a JSON consumption diary based on the above.
"""

register("diary_system", SYSTEM_PROMPT_TEMPLATE)
register("diary_user_matched", USER_PROMPT_TEMPLATE)
register("diary_user_unmatched", USER_PROMPT_UNMATCHED_TEMPLATE)


def _get_client() -> AsyncOpenAI:
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY가 설정되지 않았습니다.")
    return wrap_openai(AsyncOpenAI(api_key=settings.OPENAI_API_KEY))  # wrap_openai 추가


@traceable(name="일기 생성")
async def generate_diary(req: DiaryRequest) -> DiaryResponse:
    client = _get_client()

    mood_label = MOOD_LABEL.get(req.mood or "", "평범한")
    line_guide = _get_line_guide(req.photo_count or 1)

    # room_category로 테마 지침 조회 — 없으면 DEFAULT 사용
    room_theme = ROOM_CATEGORY_THEME.get(
        (req.room_category or "").upper(),
        ROOM_CATEGORY_THEME["DEFAULT"]
    )

    system_content = get_prompt("diary_system").format(line_guide=line_guide)

    # 미매핑 사진(matched=False 또는 None)은 장면·감정 위주 프롬프트로 대체
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
        # 미매핑: 결제 정보 없이 사진 분석·감정만으로 일기 생성
        user_content = get_prompt("diary_user_unmatched").format(
            mood=req.mood or "",
            emotion_text=req.emotion_text or "없음",
            group_description=req.group_description or "일반 소비",
            room_theme=room_theme,
            description=req.description or "특이사항 없음",
        )

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_content},
            {"role": "user", "content": user_content},
        ],
        response_format={"type": "json_object"},
        temperature=0.75,
        max_tokens=600,
    )

    content = response.choices[0].message.content
    if not content:
        raise HTTPException(status_code=500, detail="OpenAI 응답이 비어있습니다.")

    try:
        data = json.loads(content)
        return DiaryResponse(
            title=data["title"],
            diary_lines=data["diary_lines"],
            tags=req.tags or [],
        )
    except (json.JSONDecodeError, KeyError) as e:
        raise HTTPException(status_code=500, detail=f"일기 생성 파싱 실패: {e} | raw: {content[:200]}")


# POST /api/diary/generate
@router.post("/generate", response_model=DiaryResponse)
async def generate_diary_endpoint(req: DiaryRequest):
    return await generate_diary(req)
