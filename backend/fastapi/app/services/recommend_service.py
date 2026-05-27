from app.models.schemas import RecommendRequest, RecommendResponse

async def get_recommendations(request: RecommendRequest) -> list[RecommendResponse]:
    # TODO: 임베딩 기반 문맥 검색으로 금융상품 추천
    return [
        RecommendResponse(
            product_id=1,
            product_name="우리 청년 적금",
            reason="카페 지출이 많은 20대 패턴에 적합한 상품입니다."
        )
    ]