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
            current_amount=payload.current_amount,
            monthly_contribution=payload.monthly_contribution,
            planned_contribution=payload.monthly_contribution,
            reserved_amount=payload.current_amount,
            currency=payload.currency,
            kind=payload.kind,
            priority=payload.priority,
            deadline=payload.deadline,
            status=payload.status,
        )

    def update_goal(self, user_id: str, goal_id: int, payload: GoalUpdate) -> GoalModel:
        existing_goal = self._repository.get_for_user(user_id, goal_id)
        return self._repository.update(
            user_id=user_id,
            goal_id=goal_id,
            name=payload.name if payload.name is not None else existing_goal.name,
            target_amount=(
                payload.target_amount
                if payload.target_amount is not None
                else existing_goal.target_amount
            ),
            current_amount=(
                payload.current_amount
                if payload.current_amount is not None
                else existing_goal.current_amount
            ),
            monthly_contribution=(
                payload.monthly_contribution
                if payload.monthly_contribution is not None
                else existing_goal.monthly_contribution
            ),
            planned_contribution=(
                payload.monthly_contribution
                if payload.monthly_contribution is not None
                else existing_goal.planned_contribution
            ),
            reserved_amount=(
                payload.current_amount
                if payload.current_amount is not None
                else existing_goal.reserved_amount
            ),
            currency=payload.currency if payload.currency is not None else existing_goal.currency,
            kind=payload.kind if payload.kind is not None else existing_goal.kind,
            priority=payload.priority if payload.priority is not None else existing_goal.priority,
            deadline=payload.deadline if "deadline" in payload.model_fields_set else existing_goal.deadline,
            status=payload.status if payload.status is not None else existing_goal.status,
        )

    def delete_goal(self, user_id: str, goal_id: int) -> None:
        self._repository.delete(user_id=user_id, goal_id=goal_id)
