from fastapi import APIRouter, HTTPException
from app.models.schemas import AvatarRequest, AvatarResponse
from app.services.avatar_service import generate_avatar
from app.db.user_repository import get_user_avatar

router = APIRouter()

@router.get("/{user_id}")
async def get_avatar(user_id: int):
    data = await get_user_avatar(user_id)
    if data is None:
        raise HTTPException(status_code=404, detail="Avatar not found")
    return data

@router.post("", response_model=AvatarResponse)
async def create_avatar(request: AvatarRequest):
    return await generate_avatar(request)