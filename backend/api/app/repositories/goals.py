from sqlalchemy import select
from sqlalchemy.orm import Session

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
