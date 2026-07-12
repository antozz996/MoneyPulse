from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import BudgetModel


class BudgetRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_by_user(self, user_id: str) -> list[BudgetModel]:
        statement = (
            select(BudgetModel)
            .where(
                BudgetModel.user_id == user_id,
                BudgetModel.status != "archived",
            )
            .order_by(BudgetModel.created_at.asc(), BudgetModel.id.asc())
        )
        return list(self._session.scalars(statement))
