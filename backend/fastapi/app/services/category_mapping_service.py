"""
category_mapping_service.py
"""
import json
import logging
from typing import Optional
from openai import AsyncOpenAI

from app.db import category_mapping_repository as repo
from app.models.schemas import CategoryResolveResponse
from app.core.config import settings


logger = logging.getLogger(__name__)

_openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)

STANDARD_CATEGORIES = [
    (1, "식비"), (2, "카페/간식"), (3, "온라인쇼핑"), (4, "패션/쇼핑"),
    (5, "교통"), (6, "여행/숙박"), (7, "문화/여가"), (8, "술/유흥"),
    (9, "의료/건강"), (10, "뷰티/미용"), (11, "주거/통신"), (12, "교육/학습"),
    (13, "금융"), (14, "경조/선물"), (15, "생활"), (16, "기타"),
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
    """transactions 중 payment_category_id가 NULL인 것들 일괄 룰베이스 매핑."""
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
    
    return {
        "total": len(unmapped),
        "matched": matched_count,
        "etc": etc_count,
    }


def _build_llm_prompt(items: list[dict]) -> str:
    """OpenAI 프롬프트 생성."""
    categories_str = "\n".join([f"  {cid}. {cname}" for cid, cname in STANDARD_CATEGORIES])
    items_str = "\n".join([
        f'  {i+1}. payment_category="{item["payment_category"]}", payment_place="{item["payment_place"] or ""}"'
        for i, item in enumerate(items)
    ])
    
    return f"""다음은 카드사 결제 데이터의 (카테고리 유형, 가맹점명) 페어 목록입니다.
각 페어를 아래 16개 표준 카테고리 중 가장 적합한 것으로 분류해주세요.

[표준 카테고리]
{categories_str}

[분류할 페어]
{items_str}

JSON 형식으로만 응답하세요:
{{
  "results": [
    {{"index": 1, "payment_category_id": <1-16 사이 정수>}},
    ...
  ]
}}

판단이 어려운 경우 16번(기타)을 선택하세요."""


async def _call_openai_classify(items: list[dict]) -> list[dict]:
    """OpenAI gpt-4o-mini로 일괄 분류 요청."""
    response = await _openai_client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": "당신은 카드 결제 데이터를 정확하게 분류하는 분석가입니다."},
            {"role": "user", "content": _build_llm_prompt(items)},
        ],
        response_format={"type": "json_object"},
        temperature=0,
    )
    return json.loads(response.choices[0].message.content).get("results", [])


async def process_llm_for_etc_transactions(batch_size: int = 50) -> dict:
    """transactions에서 payment_category_id=16인 페어 추출 → OpenAI 분류 → 백필."""
    pairs = await repo.get_pending_llm_pairs(limit=batch_size)
    
    if not pairs:
        return {"message": "처리할 페어 없음", "processed": 0, "transactions_backfilled": 0}
    
    try:
        llm_results = await _call_openai_classify(pairs)
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