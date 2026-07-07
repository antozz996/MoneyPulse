from fastapi import APIRouter, Depends

from app.dependencies import get_coach_service, get_current_user
from app.models import UserModel
from app.schemas.coach import (
    CoachDecisionExplainRead,
    CoachTodaySummaryRead,
    CoachWeeklySummaryRead,
)
from app.schemas.decisioning import BeforeYouBuyCreate
from app.services.coach import CoachService

router = APIRouter(tags=["coach"])


@router.post("/coach/explain-decision", response_model=CoachDecisionExplainRead)
async def explain_decision(
    payload: BeforeYouBuyCreate,
    service: CoachService = Depends(get_coach_service),
    current_user: UserModel = Depends(get_current_user),
) -> CoachDecisionExplainRead:
    return service.explain_decision(current_user.id, payload)


@router.get("/coach/today-summary", response_model=CoachTodaySummaryRead)
async def get_today_summary(
    service: CoachService = Depends(get_coach_service),
    current_user: UserModel = Depends(get_current_user),
) -> CoachTodaySummaryRead:
    return service.get_today_summary(current_user.id)


@router.get("/coach/weekly-summary", response_model=CoachWeeklySummaryRead)
async def get_weekly_summary(
    service: CoachService = Depends(get_coach_service),
    current_user: UserModel = Depends(get_current_user),
) -> CoachWeeklySummaryRead:
    return service.get_weekly_summary(current_user.id)
