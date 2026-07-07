from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import not_found_error
from app.models import GoalModel


class GoalRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_by_user(self, user_id: str) -> list[GoalModel]:
        statement = (
            select(GoalModel)
            .where(GoalModel.user_id == user_id)
            .order_by(GoalModel.id.asc())
        )
        return list(self._session.scalars(statement))

    def create(
        self,
        *,
        user_id: str,
        name: str,
        target_amount: float,
        planned_contribution: float,
        reserved_amount: float,
        currency: str,
        kind: str,
    ) -> GoalModel:
        goal = GoalModel(
            user_id=user_id,
            name=name,
            target_amount=target_amount,
            planned_contribution=planned_contribution,
            reserved_amount=reserved_amount,
            currency=currency,
            kind=kind,
        )
        self._session.add(goal)
        self._session.commit()
        self._session.refresh(goal)
        return goal

    def get_for_user(self, user_id: str, goal_id: int) -> GoalModel:
        statement = select(GoalModel).where(
            GoalModel.user_id == user_id,
            GoalModel.id == goal_id,
        )
        goal = self._session.scalar(statement)
        if goal is None:
            raise not_found_error("goal", goal_id)
        return goal

    def update(
        self,
        *,
        user_id: str,
        goal_id: int,
        name: str,
        target_amount: float,
        planned_contribution: float,
        reserved_amount: float,
        currency: str,
        kind: str,
    ) -> GoalModel:
        goal = self.get_for_user(user_id, goal_id)
        goal.name = name
        goal.target_amount = target_amount
        goal.planned_contribution = planned_contribution
        goal.reserved_amount = reserved_amount
        goal.currency = currency
        goal.kind = kind
        self._session.commit()
        self._session.refresh(goal)
        return goal

    def delete(self, *, user_id: str, goal_id: int) -> None:
        goal = self.get_for_user(user_id, goal_id)
        self._session.delete(goal)
        self._session.commit()
