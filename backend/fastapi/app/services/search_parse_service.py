import json
import logging
from google import genai
from google.genai import types
from app.core.config import settings

logger = logging.getLogger(__name__)

_PROPER_NOUN_CATEGORIES: dict[str, str] = {
    "롯데월드": "영화", "에버랜드": "영화", "캐리비안베이": "영화", "워터파크": "영화",
    "유니버설": "영화", "놀이공원": "영화", "테마파크": "영화",
    "스타벅스": "카페", "이디야": "카페", "투썸플레이스": "카페", "투썸": "카페",
    "커피빈": "카페", "할리스": "카페", "폴바셋": "카페", "메가커피": "카페",
    "컴포즈커피": "카페", "빽다방": "카페",
    "맥도날드": "음식점", "버거킹": "음식점", "롯데리아": "음식점", "KFC": "음식점",
    "맘스터치": "음식점", "서브웨이": "음식점",
    "배달의민족": "음식점", "배민": "음식점", "쿠팡이츠": "음식점", "요기요": "음식점",
    "이마트": "마트", "홈플러스": "마트", "코스트코": "마트", "롯데마트": "마트",
    "CU": "편의점", "GS25": "편의점", "세븐일레븐": "편의점", "미니스톱": "편의점",
    "emart24": "편의점",
    "넷플릭스": "영화", "왓챠": "영화", "웨이브": "영화", "티빙": "영화",
    "시즌": "영화", "CGV": "영화", "메가박스": "영화", "롯데시네마": "영화",
    "야놀자": "여행", "여기어때": "여행", "에어비앤비": "여행",
    "SKT": "통신", "KT": "통신", "LG유플러스": "통신", "LGU+": "통신",
    "카카오페이": "온라인", "네이버페이": "온라인", "쿠팡": "온라인",
    "11번가": "온라인", "지마켓": "온라인", "옥션": "온라인",
    "SK에너지": "주유", "GS칼텍스": "주유", "현대오일뱅크": "주유", "S오일": "주유",
    "헬스장": "스포츠", "피트니스": "스포츠", "골프": "스포츠",
    "올리브영": "의료",
}

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
- company: 카드사/은행/보험사 등 금융기관 브랜드명만 추출. 예) "롯데카드 추천해줘" → "롯데", "신한은행 적금" → "신한". 롯데월드·스타벅스·이마트 등 일반 브랜드/장소/가맹점명은 null.
- category: 카드 혜택 카테고리. 음식점·카페·교통·주유·쇼핑·마트·편의점·영화·통신·여행·해외·의료·교육·스포츠·온라인 중 가장 가까운 것 하나 또는 null.
  (식비/외식/밥/점심/저녁/레스토랑 → 음식점, 커피/카페/베이커리/스타벅스 → 카페,
   버스/지하철/택시/KTX/고속버스 → 교통, 기름/주유/전기차/충전 → 주유,
   백화점/온라인쇼핑/쿠팡/네이버쇼핑 → 쇼핑, 대형마트/이마트/홈플러스/SSM → 마트,
   CU/GS25/세븐일레븐/편의점 → 편의점,
   영화/OTT/넷플릭스/공연/전시/테마파크/놀이공원/롯데월드/에버랜드/워터파크 → 영화,
   헬스장/피트니스/골프/스포츠/수영 → 스포츠,
   여행/숙박/호텔/리조트/항공/면세점 → 여행,
   해외결제/해외직구/환전/달러 → 해외,
   병원/약국/의원/치과/한의원 → 의료,
   학원/교육/학습지/어린이집/유치원 → 교육,
   통신/SKT/KT/LG유플러스/휴대폰요금 → 통신,
   쇼핑몰/앱결제/간편결제/카카오페이/네이버페이 → 온라인)
- keywords: 핵심 한국어 키워드 1~3개 (짧을수록 좋음).
- ai_text: 친근한 한국어 3~4문장으로 작성. 반드시 아래 순서로 구성:
  1) 검색 의도 파악 ("~을 찾고 계시는군요!" 형태)
  2) 어떤 기준으로 상품을 추천하는지 이유 (카테고리·혜택 방식·금리 등)
  3) 선택 시 도움이 되는 실용 팁 1가지
  중요: 각 문장은 반드시 20자 이내로 간결하게 작성하고, 문장마다 줄바꿈 없이 이어서 작성.
  예) "카페 할인 카드를 찾고 계시는군요! 카페 혜택이 강한 카드들을 모아봤어요. 자주 갈수록 절약 효과가 커요. 연회비와 비교해 골라보세요." """

_client = genai.Client(api_key=settings.GEMINI_API_KEY)


def _detect_proper_noun_category(query: str) -> str | None:
    for noun, category in _PROPER_NOUN_CATEGORIES.items():
        if noun.lower() in query.lower():
            return category
    return None


async def parse_search_query(query: str) -> dict:
    try:
        response = await _client.aio.models.generate_content(
            model="gemini-2.5-flash",
            contents=f"{_SYSTEM_PROMPT}\n\n검색어: {query}",
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                temperature=0.3,
                thinking_config=types.ThinkingConfig(thinking_budget=0),
            ),
        )
        result = json.loads(response.text)

        if not result.get("product_types"):
            result["product_types"] = ["card", "savings", "insurance"]
        if not result.get("keywords"):
            result["keywords"] = [query]
        if not result.get("ai_text"):
            result["ai_text"] = f"'{query}' 관련 상품을 찾았어요."
        result.setdefault("company", None)
        result.setdefault("category", None)

        proper_category = _detect_proper_noun_category(query)
        if proper_category:
            result["category"] = proper_category

        return result
    except Exception as e:
        logger.error("Gemini 파싱 실패: %s", e)
        proper_category = _detect_proper_noun_category(query)
        return {
            "product_types": ["card", "savings", "insurance"],
            "company": None,
            "category": proper_category,
            "keywords": [query],
            "ai_text": f"'{query}' 관련 상품을 찾았어요.",
        }