from fastapi import APIRouter, Depends, status

from app.dependencies import get_demo_user_id, get_goal_service
from app.schemas.goals import GoalCreate, GoalRead
from app.services.goals import GoalService

router = APIRouter(tags=["goals"])


@router.get("/goals", response_model=list[GoalRead])
async def list_goals(
    service: GoalService = Depends(get_goal_service),
    demo_user_id: str = Depends(get_demo_user_id),
) -> list[GoalRead]:
    return [GoalRead.model_validate(goal) for goal in service.list_goals(demo_user_id)]


@router.post("/goals", response_model=GoalRead, status_code=status.HTTP_201_CREATED)
async def create_goal(
    payload: GoalCreate,
    service: GoalService = Depends(get_goal_service),
    demo_user_id: str = Depends(get_demo_user_id),
) -> GoalRead:
    goal = service.create_goal(demo_user_id, payload)
    return GoalRead.model_validate(goal)
