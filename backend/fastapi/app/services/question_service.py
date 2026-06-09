import json
import random
from google import genai

from google.genai import types
from app.core.config import settings

_PROMPT = """
금융 상품 검색 앱의 추천 질문을 생성합니다.
이 앱에서는 신용카드/체크카드, 예금/적금 두 종류의 상품을 검색할 수 있습니다.

사용자 정보:
- 생애주기: {lifecycle}
- 이번 달 소비 상위 카테고리: {top_categories}

위 정보를 바탕으로 사용자가 검색창에 직접 입력할 법한 질문 10개를 만들어주세요.

조건:
- 카드 6개, 예적금 4개
- 생애주기와 소비 카테고리를 자연스럽게 녹여서 작성
  예) 생애주기가 사회초년생이고 식비 지출이 많다면 → "사회초년생이 쓰기 좋은 카드 뭐야?", "음식점 혜택 있는 카드 추천해줘"
  예) 생애주기가 신혼이고 카페 지출이 많다면 → "신혼부부 혜택 카드 알려줘", "카페 할인 잘 되는 카드는?"
- 구어체 한국어 (예: "~해줘", "~뭐야?", "~알려줘", "~있어?")
- 20자 이내로 간결하게
- 상품 고유명칭 사용 금지 (특정 카드명, 은행명 언급 금지)
- 표현 방식과 각도를 최대한 다양하게 작성

다음 JSON 형식으로만 응답하세요:
{{"questions": ["질문1", "질문2", ..., "질문10"]}}
"""

FALLBACK_QUESTIONS = [
    "사회초년생 카드 추천해줘",
    "식비 혜택 좋은 카드는?",
    "카페 할인 카드 뭐가 좋아?",
    "금리 좋은 적금 알려줘",
    "첫 적금 뭐로 시작해?",
]

_client = genai.Client(api_key=settings.GEMINI_API_KEY)


async def generate_recommend_questions(category_price: dict, lifecycle_label: str) -> list[str]:
    top_categories = sorted(category_price.items(), key=lambda x: x[1], reverse=True)[:3]
    top_categories_str = ", ".join(cat for cat, _ in top_categories) if top_categories else "데이터 없음"

    prompt = _PROMPT.format(
        lifecycle=lifecycle_label or "정보 없음",
        top_categories=top_categories_str,
    )

    try:
        response = await _client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=1.0,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        data = json.loads(response.text)
        pool = data.get("questions", [])
        if len(pool) >= 5:
            return random.sample(pool, 5)
        return pool if pool else FALLBACK_QUESTIONS
    except Exception as e:
        import traceback
        print(f"[question_service] Gemini 호출 실패: {e}")
        traceback.print_exc()
        return FALLBACK_QUESTIONS
