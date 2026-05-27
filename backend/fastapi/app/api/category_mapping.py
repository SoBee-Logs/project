"""
api/category_mapping.py
─────────────────────────────────────────────────────────
카테고리 매핑 FastAPI 엔드포인트.
prefix/tags는 main.py의 include_router에서 부여됨.
"""
from fastapi import APIRouter

from app.services import category_mapping_service as service
from app.models.schemas import CategoryResolveRequest, CategoryResolveResponse


router = APIRouter()


@router.post("/resolve", response_model=CategoryResolveResponse)
async def resolve_category(body: CategoryResolveRequest):
    """
    카드사 raw 카테고리/가맹점명 → 표준 카테고리 매핑.

    Response의 matched_by:
      - tier2: (유형+가맹점명) 매칭됨
      - tier1: 유형만으로 매칭됨
      - etc:   매핑 실패, 16번(기타) 반환됨
    """
    return await service.resolve_category(
        payment_category=body.payment_category,
        payment_place=body.payment_place,
    )