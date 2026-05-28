"""
api/category_mapping.py
─────────────────────────────────────────────────────────
카테고리 매핑 FastAPI 엔드포인트.
prefix/tags는 main.py의 include_router에서 부여됨.
"""
from fastapi import APIRouter

from app.services import category_mapping_service as service
from app.models.schemas import (
    CategoryResolveRequest,
    CategoryResolveResponse,
    MappingRequest,
    MappingResponse,
)


router = APIRouter()


@router.post("/resolve", response_model=CategoryResolveResponse)
async def resolve_category(body: CategoryResolveRequest):
    """
    카드사 raw 카테고리/가맹점명 → 표준 카테고리 매핑 (단건 조회).

    Response의 matched_by:
      - tier2: (유형+가맹점명) 매칭됨
      - tier1: 유형만으로 매칭됨
      - etc:   매핑 실패, 16번(기타) 반환됨
    """
    return await service.resolve_category(
        payment_category=body.payment_category,
        payment_place=body.payment_place,
    )


@router.post("/map-all")
async def map_all_unmapped(body: MappingRequest):
    """
    transactions 중 payment_category_id가 NULL인 것들 일괄 처리.
    1단계: 룰베이스 매핑
    2단계: 룰베이스로 못 잡은 기타(16) 건 → LLM 자동 재분류
    """
    return await service.resolve_and_update_all_unmapped()


@router.post("/llm-reclassify")
async def llm_reclassify():
    """
    기타(16)로 남아있는 트랜잭션 페어를 LLM으로 재분류.
    /map-all 에서 자동 체이닝되지만, 수동으로도 호출 가능.
    """
    return await service.process_llm_for_etc_transactions(batch_size=100)