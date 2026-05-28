import json
from openai import AsyncOpenAI
from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.models.schemas import DiaryRequest, DiaryResponse

# /api/diary 하위 경로를 담당하는 라우터 (main.py에서 prefix로 /api/diary 붙임)
router = APIRouter()

MOOD_LABEL = {
    "☺️": "만족스러운",
    "😭": "슬픈",
    "😮": "놀라운",
    "😍": "행복한",
    "😡": "후회스러운",
}

DIARY_PROMPT_TEMPLATE = """[분량 제한 — 절대 준수]
- 전체 글자 수: 150자 이내
- diary_lines: 반드시 4개, 각 항목 한 문장 30자 이내
- 문단(단락) 금지. 짧은 한 줄 문장 4개만.
- 인스타그램 피드 감성: 감각적·간결·위트 있게. 설명체 절대 금지.

너는 소비 일기를 써주는 AI야.
아래 소비 정보를 바탕으로 짧은 소비 일기를 한국어로 써줘.
일기의 톤과 내용은 반드시 아래 '모임방 특징'에 맞게 맞춰야 해.

소비 정보:
- 품목: {item_name}
- 카테고리: {category}
- 금액: {price}원
- 가게: {store_name}
- AI 분석 설명: {description}
- 소비 기분: {mood_label} ({mood})
- 사용자 메모: {emotion_text}
- 모임방 특징: {group_description}

반드시 아래 JSON 형식으로만 응답해. 다른 텍스트는 절대 포함하지 마.
{{
  "title": "일기 제목 (10자 이내)",
  "diary_lines": ["짧은 한 줄1", "짧은 한 줄2", "짧은 한 줄3", "짧은 한 줄4"]
}}

규칙:
- diary_lines: 정확히 4개, 각 문장 30자 이내
- 전체 diary_lines 합산 120자 이내
- 위트 있고 감각적인 말투, JSON만 출력"""


def _get_client() -> AsyncOpenAI:
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY가 설정되지 않았습니다.")
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


async def generate_diary(req: DiaryRequest) -> DiaryResponse:
    client = _get_client()

    mood_label = MOOD_LABEL.get(req.mood or "", "평범한")
    prompt = DIARY_PROMPT_TEMPLATE.format(
        item_name=req.item_name or "알 수 없음",
        category=req.category or "기타",
        price=int(req.price) if req.price is not None else 0,
        store_name=req.store_name or "알 수 없음",
        description=req.description or "",
        mood=req.mood or "",
        mood_label=mood_label,
        # DB emotions_text.text — 없으면 빈 문자열로 대체
        emotion_text=req.emotion_text or "없음",
        group_description=req.group_description or "일반 소비 모임",
    )

    response = await client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        response_format={"type": "json_object"},
        temperature=0.7,
        max_tokens=300,
    )

    content = response.choices[0].message.content
    if not content:
        raise HTTPException(status_code=500, detail="OpenAI 응답이 비어있습니다.")

    try:
        data = json.loads(content)
        return DiaryResponse(
            title=data["title"],
            diary_lines=data["diary_lines"],
            # 프론트에서 보내준 방 번호 태그를 그대로 응답에 실어서 돌려줌
            tags=req.tags or [],
        )
    except (json.JSONDecodeError, KeyError) as e:
        raise HTTPException(status_code=500, detail=f"일기 생성 파싱 실패: {e} | raw: {content[:200]}")


# POST /api/diary/generate — 소비 정보를 받아 LLM으로 일기를 생성하는 엔드포인트
@router.post("/generate", response_model=DiaryResponse)
async def generate_diary_endpoint(req: DiaryRequest):
    return await generate_diary(req)