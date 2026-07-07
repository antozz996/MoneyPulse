from fastapi import APIRouter, Depends

from app.dependencies import get_current_user, get_decisioning_service
from app.models import UserModel
from app.schemas.decisioning import BeforeYouBuyCreate, BeforeYouBuyRead
from app.services.decisioning import DecisioningService

router = APIRouter(tags=["before-you-buy"])


@router.post("/before-you-buy", response_model=BeforeYouBuyRead)
async def evaluate_before_you_buy(
    payload: BeforeYouBuyCreate,
    service: DecisioningService = Depends(get_decisioning_service),
    current_user: UserModel = Depends(get_current_user),
) -> BeforeYouBuyRead:
    return BeforeYouBuyRead.model_validate(
        service.evaluate_before_you_buy(current_user.id, payload)
    )
