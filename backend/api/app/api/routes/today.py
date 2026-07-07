from fastapi import APIRouter, Depends

from app.dependencies import get_decisioning_service, get_demo_user_id
from app.schemas.decisioning import TodayRead
from app.services.decisioning import DecisioningService

router = APIRouter(tags=["today"])


@router.get("/today", response_model=TodayRead)
async def get_today(
    service: DecisioningService = Depends(get_decisioning_service),
    demo_user_id: str = Depends(get_demo_user_id),
) -> TodayRead:
    return TodayRead.model_validate(service.get_today(demo_user_id))
