from sqlalchemy.orm import Session

from app.errors import validation_error
from app.repositories.budgets import BudgetRepository
from app.repositories.categories import CategoryRepository
from app.schemas.budgets import BudgetCreate, BudgetUpdate


class BudgetService:
    def __init__(self, session: Session) -> None:
        self._repository = BudgetRepository(session)
        self._categories = CategoryRepository(session)

    def list_budgets(self, user_id: str):
        return self._repository.list_by_user(user_id)

    def create_budget(self, user_id: str, payload: BudgetCreate):
        self._validate_category(user_id, payload.category_id)
        return self._repository.create(
            user_id=user_id,
            category_id=payload.category_id,
            amount=payload.amount,
            currency=payload.currency,
            period=payload.period,
            status=payload.status,
        )

    def update_budget(self, user_id: str, budget_id: int, payload: BudgetUpdate):
        existing_budget = self._repository.get_for_user(user_id, budget_id)
        next_category_id = (
            payload.category_id
            if "category_id" in payload.model_fields_set
            else existing_budget.category_id
        )
        if next_category_id is None:
            raise validation_error(
                "Budget category_id is required.",
                {"field": "category_id"},
            )
        self._validate_category(user_id, next_category_id)
        return self._repository.update(
            user_id=user_id,
            budget_id=budget_id,
            category_id=next_category_id,
            amount=payload.amount
            if "amount" in payload.model_fields_set and payload.amount is not None
            else existing_budget.amount,
            currency=payload.currency
            if "currency" in payload.model_fields_set and payload.currency is not None
            else existing_budget.currency,
            period=payload.period
            if "period" in payload.model_fields_set and payload.period is not None
            else existing_budget.period,
            status=payload.status
            if "status" in payload.model_fields_set and payload.status is not None
            else existing_budget.status,
        )

    def delete_budget(self, user_id: str, budget_id: int) -> None:
        self._repository.delete(user_id=user_id, budget_id=budget_id)

    def _validate_category(self, user_id: str, category_id: int) -> None:
        category = self._categories.get_for_user(user_id, category_id)
        if category.entry_type != "expense":
            raise validation_error(
                "Budgets only support expense categories.",
                {"field": "category_id"},
            )
