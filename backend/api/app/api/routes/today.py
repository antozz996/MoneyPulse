from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, get_decisioning_service
from app.models import UserModel
from app.schemas.decisioning import TodayRead
from app.services.decisioning import DecisioningService

router = APIRouter(tags=["today"])


@router.get("/today", response_model=TodayRead)
async def get_today(
    service: DecisioningService = Depends(get_decisioning_service),
    current_user: UserModel = Depends(get_current_user),
) -> TodayRead:
    return TodayRead.model_validate(service.get_today(current_user.id))
