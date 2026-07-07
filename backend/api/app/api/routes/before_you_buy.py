from fastapi import APIRouter, Depends

from app.dependencies import get_decisioning_service, get_demo_user_id
from app.schemas.decisioning import BeforeYouBuyCreate, BeforeYouBuyRead
from app.services.decisioning import DecisioningService

router = APIRouter(tags=["before-you-buy"])


@router.post("/before-you-buy", response_model=BeforeYouBuyRead)
async def evaluate_before_you_buy(
    payload: BeforeYouBuyCreate,
    service: DecisioningService = Depends(get_decisioning_service),
    demo_user_id: str = Depends(get_demo_user_id),
) -> BeforeYouBuyRead:
    return BeforeYouBuyRead.model_validate(
        service.evaluate_before_you_buy(demo_user_id, payload)
    )
