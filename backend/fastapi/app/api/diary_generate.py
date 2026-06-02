import json
from openai import AsyncOpenAI
from fastapi import APIRouter, HTTPException

from app.core.config import settings
from app.models.schemas import DiaryRequest, DiaryResponse

router = APIRouter()

MOOD_LABEL = {
    "☺️": "만족스러운",
    "😭": "슬픈",
    "😮": "놀라운",
    "😍": "행복한",
    "😡": "후회스러운",
}

# System Prompt: 페르소나 + 절대 규칙 (소비 데이터 없이 규칙만)
SYSTEM_PROMPT_TEMPLATE = """너는 20대 직장인/대학생이 인스타 스머프 계정이나 에브리타임, 개인 블로그에 올리는 솔직하고 유쾌한 소비 일기를 대신 써주는 작가야.
유저의 소비 내역과 사진 분석 결과를 보고, 그 소비의 감정과 분위기를 자연스럽게 녹여서 써줘.

[절대 규칙 - 무조건 지켜]
1. 말투: 음/슴체 또는 가벼운 반말. 딱딱한 경어나 과장된 감탄("정말!", "너무너무") 금지.
2. 금지어: "마법 같은", "환상적인", "~을 샀습니다", "소비했습니다", "경험했습니다", "느꼈습니다" 같은 설명체·AI 냄새나는 표현 절대 금지.
3. 제목(title): 10자 이내. 유튜브 썸네일이나 해시태그처럼 핵심만 짤막하게.
4. 분량: diary_lines 배열을 정확히 {line_guide} 작성.
5. 각 줄: 한 문장 최대 35자. 짧은 호흡으로 끊어서 써.
6. 출력 형식: 반드시 아래 JSON만 출력 (마크다운 백틱, 설명 텍스트 모두 금지).

{{
  "title": "제목 (10자 이내)",
  "diary_lines": ["줄1", "줄2", ...]
}}
"""

# User Prompt: 소비 데이터만
USER_PROMPT_TEMPLATE = """[소비 정보]
- 품목: {item_name}
- 카테고리: {category}
- 결제 금액: {price}원
- 장소(가게): {store_name}
- 기분: {mood_label} ({mood})
- 메모: {emotion_text}
- 모임방 테마/특징: {group_description}
- 사진 분석 결과: {description}
"""


def _get_line_guide(photo_count: int) -> str:
    if photo_count <= 1:
        return "2~3개"
    elif photo_count <= 3:
        return "4~5개"
    else:
        return "6~8개"


def _get_client() -> AsyncOpenAI:
    if not settings.OPENAI_API_KEY:
        raise HTTPException(status_code=500, detail="OPENAI_API_KEY가 설정되지 않았습니다.")
    return AsyncOpenAI(api_key=settings.OPENAI_API_KEY)


async def generate_diary(req: DiaryRequest) -> DiaryResponse:
    client = _get_client()

    mood_label = MOOD_LABEL.get(req.mood or "", "평범한")
    line_guide = _get_line_guide(req.photo_count or 1)

    system_content = SYSTEM_PROMPT_TEMPLATE.format(line_guide=line_guide)
    user_content = USER_PROMPT_TEMPLATE.format(
        item_name=req.item_name or "알 수 없음",
        category=req.category or "기타",
        price=f"{int(req.price):,}" if req.price is not None else "0",
        store_name=req.store_name or "알 수 없음",
        mood=req.mood or "",
        mood_label=mood_label,
        emotion_text=req.emotion_text or "없음",
        group_description=req.group_description or "일반 소비",
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
