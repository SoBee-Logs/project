"""
category_mapping_service.py
"""
import json
import logging
from typing import Optional
from google import genai
from google.genai import types

from app.db import category_mapping_repository as repo
from app.models.schemas import CategoryResolveResponse
from app.core.config import settings


logger = logging.getLogger(__name__)


def _get_gemini_client():
    return genai.Client(api_key=settings.GEMINI_API_KEY)

STANDARD_CATEGORIES = [
    (1,  "식비",      "한식, 일식, 양식, 중식, 분식 등 일반 음식점. 식당, 분식집, 패스트푸드, 배달음식 등 식사 목적의 소비. 편의점 도시락/삼각김밥도 식비. 카페/베이커리 전문점은 제외(→2). 주점/술집은 제외(→8)."),
    (2,  "카페/간식", "커피전문점, 베이커리, 디저트, 버블티. 카페나 베이커리에서 구매한 음료, 케이크, 빵, 마카롱, 크로플 등은 반드시 이 카테고리. 카드사가 서양식/일반대중음식으로 잘못 분류해도 가맹점명에 coffee/카페/커피/베이커리 포함되면 이 카테고리. 편의점은 생활(→15)."),
    (3,  "온라인쇼핑", "쿠팡, 11번가, G마켓, 위메프, 지그재그 등 종합 인터넷 쇼핑몰. 패션 전문몰(무신사, 에이블리, 29CM)은 패션/쇼핑(→4). 구글플레이/앱스토어는 문화/여가(→7)."),
    (4,  "패션/쇼핑",  "옷, 신발, 가방, 액세서리, 잡화, 패션 전문몰(무신사, 에이블리, 29CM, ZARA, H&M). 소품샵 피규어도 포함. 종합 쇼핑몰은 온라인쇼핑(→3). 화장품/뷰티는 뷰티/미용(→10)."),
    (5,  "교통",      "택시(카카오T, 티머니), 버스, 지하철, 고속버스, 철도(KTX/SRT), 주유, 주차, 기후동행카드. 해외 대중교통도 포함. 여행사/숙박은 제외(→6)."),
    (6,  "여행/숙박",  "항공권, 호텔/펜션/모텔/리조트, 여행사(하나투어, 모두투어), 면세점. 해외 가맹점이라도 지하철/버스/기차는 교통(→5). 해외 잡화점(돈키호테 등)은 여행/숙박."),
    (7,  "문화/여가",  "영화(CGV, 롯데시네마), 공연/티켓(인터파크), 도서(교보문고), OTT(넷플릭스, 웨이브), 앱스토어(Apple/구글플레이), AI 구독(Claude, ChatGPT), 게임, 노래방, PC방, 오락실, 놀이공원, 스키장, 완구점, 인형뽑기 등 여가 활동."),
    (8,  "술/유흥",   "주점, 호프집, 이자카야, 바, 클럽, 포차, 루프탑바. 와인/맥주/소주 등 주류 구매도 포함. 심야(자정 이후) 편의점도 포함 가능."),
    (9,  "의료/건강",  "병원, 의원, 약국, 안경원, 건강식품(GNC), 영양제, 의료용품, 건강검진, 피트니스(헬스장, 필라테스), 비대면진료(닥터나우). 미용 목적 피부과는 뷰티/미용(→10)."),
    (10, "뷰티/미용",  "미용실, 네일샵, 왁싱, 피부과(미용 목적), 마사지, 피부관리, 화장품(이니스프리, 에뛰드, 올리브영, 시코르). 치료 목적 의원은 의료/건강(→9)."),
    (11, "주거/통신",  "관리비, 전기/가스/수도 공과금, 휴대폰 요금(SKT/KT/LG), 인터넷 요금, 방역(세스코), 청소 서비스, 가구(이케아)."),
    (12, "교육/학습",  "학원, 온라인 강의(클래스101, Coursera), 교재, 전자책(밀리의서재, 리디북스), 스터디카페, 자격증 응시료. 일반 서점은 문화/여가(→7)."),
    (13, "금융",      "보험료, 카드 연회비, 증권 수수료, 협회비 등 금융 관련 소비. 카카오/네이버페이는 가맹점명만으로 판단 불가 시 이 카테고리."),
    (14, "경조/선물",  "꽃집, 케이크샵, 선물 전문점(텐바이텐, 마켓비), 상품권(카카오선물하기, 백화점상품권), 경조사비(결혼식, 장례식, 생일), 후원/기부."),
    (15, "생활",      "편의점(GS25, CU, 세븐일레븐), 대형마트(이마트, 홈플러스, 롯데마트), 슈퍼마켓, 생활용품(다이소), 세탁소, 인쇄소, 당근마켓. 일상 생활에 필요한 지출."),
    (16, "기타",      "위 15개 카테고리로 절대 분류 불가능한 경우에만 사용. 최후의 수단."),
]
ETC_payment_category_id = 16


async def resolve_category(
    payment_category: str,
    payment_place: Optional[str],
) -> CategoryResolveResponse:
    """카드사 raw 데이터 → 표준 16개 카테고리 매핑."""
    result = await repo.find_mapping(payment_category, payment_place)

    if result:
        return CategoryResolveResponse(
            payment_category_id=result["payment_category_id"],
            category_name=result["category_name"],
            matched_by=result["matched_by"],
        )

    etc = await repo.get_etc_category()
    return CategoryResolveResponse(
        payment_category_id=etc["payment_category_id"],
        category_name=etc["category_name"],
        matched_by="etc",
    )


async def resolve_and_update_all_unmapped() -> dict:
    """transactions 중 payment_category_id가 NULL인 것들 일괄 룰베이스 매핑.
    룰베이스로 못 잡은 기타(16) 건은 자동으로 LLM 파이프라인으로 넘김.
    """
    unmapped = await repo.get_unmapped_transactions()

    matched_count = 0
    etc_count = 0
    pair_cache: dict[tuple, dict] = {}

    for tx in unmapped:
        pair = (tx["payment_category"], tx["payment_place"])

        if pair not in pair_cache:
            pair_cache[pair] = await repo.find_mapping(
                tx["payment_category"], tx["payment_place"]
            )

        result = pair_cache[pair]

        if result:
            await repo.update_transaction_category(tx["payment_id"], result["payment_category_id"])
            matched_count += 1
        else:
            await repo.update_transaction_category(tx["payment_id"], ETC_payment_category_id)
            etc_count += 1

    # Fix: 기타로 떨어진 건이 있으면 LLM 파이프라인 자동 실행
    llm_result = {}
    if etc_count > 0:
        logger.info(f"룰베이스 미매핑 {etc_count}건 → LLM 분류 시작")
        llm_result = await process_llm_for_etc_transactions(batch_size=etc_count + 10)

    return {
        "total": len(unmapped),
        "matched": matched_count,
        "etc": etc_count,
        "llm": llm_result,
    }


def _build_llm_prompt(items: list[dict]) -> str:
    """OpenAI 프롬프트 생성."""
    categories_str = "\n".join([f"  {cid}. {cname} - {desc}" for cid, cname, desc in STANDARD_CATEGORIES])
    items_str = "\n".join([
        f'  {i+1}. 가맹점명="{item["payment_place"] or ""}", 카드사분류(신뢰불가/무시가능)="{item["payment_category"]}"'
        for i, item in enumerate(items)
    ])

    return f"""당신은 한국 카드 결제 데이터를 분류하는 전문가입니다.

## 분류 규칙
1. **가맹점명만으로 판단하세요.** 카드사분류는 신뢰할 수 없으며 무시해도 됩니다.
2. 가맹점명에 커피/카페/베이커리/coffee 포함 → 무조건 카페/간식(2). 카드사가 뭐라 해도 무시.
3. PG 계열(결제대행, 인터넷상거래, 인터넷P/G 등)은 업종이 아닙니다. 반드시 가맹점명으로만 판단하세요.
4. 법인명 패턴(주식회사 OO, (주)OO) → 실제 상호명으로 판단하세요.
5. 가맹점명에 `+`가 포함된 경우 첫 번째 단어가 실제 상호명입니다. 
6. 특수문자 깨진 경우(편+의+점, 화+++원) → 원래 단어로 복원해서 판단하세요.
6. 16번(기타)은 최후의 수단입니다. 위 15개로 분류 불가능한 경우에만 사용하세요.
7. 아래는 자주 틀리는 케이스입니다. 반드시 지키세요:

   [패션/쇼핑(4) 고정 - 온라인쇼핑(3) 아님]
   - 무신사, 에이블리, 29CM, SSF샵, 에프알엘코리아(유니클로) → 패션/쇼핑(4)
   - 나이키, 아디다스 등 스포츠 브랜드 → 패션/쇼핑(4)

   [교육/학습(12) 고정 - 온라인쇼핑(3) 아님]
   - 클래스101, 밀리의서재, 리디북스, 웅진씽크빅, 해커스, Coursera → 교육/학습(12)
   - 스터디카페 → 교육/학습(12), 카페(2) 아님
   - ANTHROPIC, CLAUDE.AI, ChatGPT, OpenAI 등 AI 구독 → 문화/여가(7)

   [뷰티/미용(10) 고정 - 온라인쇼핑(3) 아님]
   - COSRX, 글로시박스 등 뷰티 브랜드 → 뷰티/미용(10)

   [카페/간식(2) 고정]
   - 파리바게뜨, 뚜레쥬르, 성심당 등 베이커리 체인 → 카페/간식(2)
   - 스타벅스, 투썸플레이스 등 카페 체인 → 카페/간식(2)
   - 카드사가 일반대중음식/서양식으로 분류해도 카페/베이커리면 카페/간식(2)

   [술/유흥(8) 고정]
   - 봉구비어, 안주야, 포차, 호프 포함 가맹점 → 술/유흥(8)

   [경조/선물(14) 고정]
   - 꽃집, 플라워, 화원 포함 가맹점 → 경조/선물(14)
   - 이마트선물세트 등 선물 구매 → 경조/선물(14)

   [문화/여가(7) 고정]
   - 케치팡, 완구점, 인형뽑기 → 문화/여가(7)
   - 구글페이먼트코리 → 문화/여가(7)
   - Apple + 결제대행(PG) → 문화/여가(7), 금융(13) 아님

   [주거/통신(11) 고정]
   - 이케아 → 주거/통신(11), 생활(15) 아님
   - 세스코, 청소업체, 세탁특공대 → 주거/통신(11)
   - 휴대폰메시지 → 주거/통신(11)

   [생활(15) 고정]
   - 당근마켓 → 생활(15), 온라인쇼핑(3) 아님

   [금융(13) 고정]
   - 카카오페이, 네이버페이포인트, 페이코 → 금융(13)
   - 삼성카드, 현대카드 등 카드회사 → 금융(13)

   [여행/숙박(6) 고정 - PG여도 무조건]
   - 모두투어, 하나투어 → 여행/숙박(6)
   - 공항특산품점 → 여행/숙박(6)
   - DON QUIJOTE(돈키호테) 등 해외 잡화점 → 여행/숙박(6), 교통(5) 아님

## 표준 카테고리
{categories_str}

## 분류할 결제 목록
{items_str}

JSON으로만 응답하세요:
{{
  "results": [
    {{"index": 1, "payment_category_id": <1-16 사이 정수>}},
    ...
  ]
}}"""

async def _call_gemini_classify(items: list[dict]) -> list[dict]:
    """Gemini 2.5 flash로 일괄 분류 요청."""
    client = _get_gemini_client()
    response = client.models.generate_content(
        model="gemini-2.5-flash",
        contents=_build_llm_prompt(items),
        config=types.GenerateContentConfig(
            response_mime_type="application/json",
            temperature=0,
        ),
    )
    return json.loads(response.text).get("results", [])


async def process_llm_for_etc_transactions(batch_size: int = 50) -> dict:
    """transactions에서 payment_category_id=16인 페어 추출 → OpenAI 분류 → 백필."""
    pairs = await repo.get_pending_llm_pairs(limit=batch_size)

    if not pairs:
        return {"message": "처리할 페어 없음", "processed": 0, "transactions_backfilled": 0}

    try:
        llm_results = await _call_gemini_classify(pairs)
    except Exception as e:
        logger.exception("OpenAI 호출 실패")
        return {
            "message": f"LLM 호출 실패: {str(e)}",
            "processed": 0,
            "transactions_backfilled": 0,
        }

    result_by_index = {r["index"]: r for r in llm_results}
    total_backfilled = 0
    processed = 0

    for i, pair in enumerate(pairs):
        idx = i + 1
        if idx not in result_by_index:
            logger.warning(f"LLM이 index={idx} 누락")
            continue

        payment_category_id = result_by_index[idx]["payment_category_id"]

        if not (1 <= payment_category_id <= 16):
            logger.warning(f"잘못된 payment_category_id={payment_category_id}, 16으로 fallback")
            payment_category_id = ETC_payment_category_id

        await repo.insert_llm_mapping(
            payment_category=pair["payment_category"],
            payment_place=pair["payment_place"],
            payment_category_id=payment_category_id,
        )

        backfilled = await repo.backfill_transactions_by_pair(
            payment_category=pair["payment_category"],
            payment_place=pair["payment_place"],
            payment_category_id=payment_category_id,
        )
        total_backfilled += backfilled
        processed += 1

    return {
        "message": "처리 완료",
        "processed": processed,
        "transactions_backfilled": total_backfilled,
    }
