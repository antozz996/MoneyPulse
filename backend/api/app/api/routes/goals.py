from fastapi import APIRouter, Depends, status

from app.dependencies import get_current_user, get_goal_service
from app.models import UserModel
from app.schemas.goals import GoalCreate, GoalRead, GoalUpdate
from app.services.goals import GoalService

router = APIRouter(tags=["goals"])


@router.get("/goals", response_model=list[GoalRead])
async def list_goals(
    service: GoalService = Depends(get_goal_service),
    current_user: UserModel = Depends(get_current_user),
) -> list[GoalRead]:
    return [GoalRead.model_validate(goal) for goal in service.list_goals(current_user.id)]


@router.post("/goals", response_model=GoalRead, status_code=status.HTTP_201_CREATED)
async def create_goal(
    payload: GoalCreate,
    service: GoalService = Depends(get_goal_service),
    current_user: UserModel = Depends(get_current_user),
) -> GoalRead:
    goal = service.create_goal(current_user.id, payload)
    return GoalRead.model_validate(goal)


@router.patch("/goals/{goal_id}", response_model=GoalRead)
async def update_goal(
    goal_id: int,
    payload: GoalUpdate,
    service: GoalService = Depends(get_goal_service),
    current_user: UserModel = Depends(get_current_user),
) -> GoalRead:
    goal = service.update_goal(current_user.id, goal_id, payload)
    return GoalRead.model_validate(goal)


@router.put("/goals/{goal_id}", response_model=GoalRead)
async def replace_goal(
    goal_id: int,
    payload: GoalCreate,
    service: GoalService = Depends(get_goal_service),
    current_user: UserModel = Depends(get_current_user),
) -> GoalRead:
    goal = service.update_goal(
        current_user.id,
        goal_id,
        GoalUpdate(**payload.model_dump()),
    )
    return GoalRead.model_validate(goal)


@router.delete("/goals/{goal_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_goal(
    goal_id: int,
    service: GoalService = Depends(get_goal_service),
    current_user: UserModel = Depends(get_current_user),
) -> None:
    service.delete_goal(current_user.id, goal_id)
