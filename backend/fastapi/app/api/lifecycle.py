from fastapi import APIRouter
from app.models.schemas import LifecycleRequest, LifecycleResponse
from app.services.lifecycle_service import predict_lifecycle, get_lifecycle, get_lifecycle_peers

router = APIRouter()

# POST /api/lifecycle
@router.post("", response_model=LifecycleResponse)
async def post_lifecycle(request: LifecycleRequest):
    return await predict_lifecycle(request)

# GET /api/lifecycle/{user_id}
@router.get("/{user_id}", response_model=LifecycleResponse)
async def get_lifecycle_route(user_id: int):
    return await get_lifecycle(user_id)

# GET /api/lifecycle/{user_id}/peers
@router.get("/{user_id}/peers")
async def get_lifecycle_peers_route(user_id: int):
    return await get_lifecycle_peers(user_id)