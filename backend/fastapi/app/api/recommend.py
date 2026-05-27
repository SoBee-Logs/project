from fastapi import APIRouter
from app.models.schemas import RecommendRequest, RecommendResponse
from app.services.recommend_service import get_recommendations

router = APIRouter()

@router.post("", response_model=list[RecommendResponse])
async def recommend_products(request: RecommendRequest):
    return await get_recommendations(request)