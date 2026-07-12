from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import not_found_error
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

    def create(
        self,
        *,
        user_id: str,
        category_id: int,
        amount: float,
        currency: str,
        period: str,
        status: str,
    ) -> BudgetModel:
        budget = BudgetModel(
            user_id=user_id,
            category_id=category_id,
            amount=amount,
            currency=currency,
            period=period,
            status=status,
        )
        self._session.add(budget)
        self._session.commit()
        self._session.refresh(budget)
        return budget

    def get_for_user(self, user_id: str, budget_id: int) -> BudgetModel:
        statement = select(BudgetModel).where(
            BudgetModel.user_id == user_id,
            BudgetModel.id == budget_id,
            BudgetModel.status != "archived",
        )
        budget = self._session.scalar(statement)
        if budget is None:
            raise not_found_error("budget", budget_id)
        return budget

    def update(
        self,
        *,
        user_id: str,
        budget_id: int,
        category_id: int,
        amount: float,
        currency: str,
        period: str,
        status: str,
    ) -> BudgetModel:
        budget = self.get_for_user(user_id, budget_id)
        budget.category_id = category_id
        budget.amount = amount
        budget.currency = currency
        budget.period = period
        budget.status = status
        self._session.commit()
        self._session.refresh(budget)
        return budget

    def delete(self, *, user_id: str, budget_id: int) -> None:
        budget = self.get_for_user(user_id, budget_id)
        budget.status = "archived"
        self._session.commit()
