from sqlalchemy.orm import Session

from app.models import GoalModel
from app.repositories.goals import GoalRepository
from app.schemas.goals import GoalCreate, GoalUpdate


class GoalService:
    def __init__(self, session: Session) -> None:
        self._repository = GoalRepository(session)

    def list_goals(self, user_id: str) -> list[GoalModel]:
        return self._repository.list_by_user(user_id)

    def create_goal(self, user_id: str, payload: GoalCreate) -> GoalModel:
        return self._repository.create(
            user_id=user_id,
            name=payload.name,
            target_amount=payload.target_amount,
            planned_contribution=payload.planned_contribution,
            reserved_amount=payload.reserved_amount,
            currency=payload.currency.upper(),
            kind=payload.kind,
        )

    def update_goal(self, user_id: str, goal_id: int, payload: GoalUpdate) -> GoalModel:
        return self._repository.update(
            user_id=user_id,
            goal_id=goal_id,
            name=payload.name,
            target_amount=payload.target_amount,
            planned_contribution=payload.planned_contribution,
            reserved_amount=payload.reserved_amount,
            currency=payload.currency.upper(),
            kind=payload.kind,
        )

    def delete_goal(self, user_id: str, goal_id: int) -> None:
        self._repository.delete(user_id=user_id, goal_id=goal_id)
