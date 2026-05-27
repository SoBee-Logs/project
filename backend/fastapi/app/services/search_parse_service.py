import json
import logging
from openai import AsyncOpenAI
from app.core.config import settings

logger = logging.getLogger(__name__)
client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

_SYSTEM_PROMPT = """당신은 한국 금융상품 검색 어시스턴트입니다.
사용자의 자연어 검색어를 분석해 다음 JSON 형식으로만 응답하세요.

{
  "product_types": ["card", "savings", "insurance"],
  "company": "회사/브랜드명 또는 null",
  "category": "카테고리명 또는 null",
  "keywords": ["키워드1", "키워드2"],
  "ai_text": "사용자에게 보여줄 AI 분석 문구"
}

규칙:
- product_types: 검색어 의도에 맞는 타입만 선택. 특정 타입 언급 없으면 모두 포함.
  (카드/혜택/할인 → card, 예금/적금/금리/이자 → savings, 보험/보장/사고 → insurance)
- company: 언급된 카드사/은행/보험사 브랜드명. 예) "롯데카드 추천해줘" → "롯데", "신한은행 적금" → "신한". 없으면 null.
- category: 카드 혜택 카테고리. 쇼핑·교통·주유·음식점·여행·통신·의료·교육·편의점·영화·스포츠·마트·카페·온라인·해외 중 하나 또는 null.
- keywords: 핵심 한국어 키워드 1~3개 (짧을수록 좋음).
- ai_text: 친근한 한국어 1~2문장으로 검색 결과를 소개하는 문구."""


async def parse_search_query(query: str) -> dict:
    try:
        response = await client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": _SYSTEM_PROMPT},
                {"role": "user", "content": f"검색어: {query}"},
            ],
            response_format={"type": "json_object"},
            temperature=0.3,
            max_tokens=300,
        )
        result = json.loads(response.choices[0].message.content)

        if not result.get("product_types"):
            result["product_types"] = ["card", "savings", "insurance"]
        if not result.get("keywords"):
            result["keywords"] = [query]
        if not result.get("ai_text"):
            result["ai_text"] = f"'{query}' 관련 상품을 찾았어요."
        result.setdefault("company", None)
        result.setdefault("category", None)

        return result
    except Exception as e:
        logger.error("GPT 파싱 실패: %s", e)
        return {
            "product_types": ["card", "savings", "insurance"],
            "company": None,
            "category": None,
            "keywords": [query],
            "ai_text": f"'{query}' 관련 상품을 찾았어요.",
        }
