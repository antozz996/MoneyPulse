from sqlalchemy.orm import Session

from app.models import UserFinancialProfileModel
from app.repositories.accounts import AccountRepository
from app.repositories.bank_accounts import BankAccountRepository
from app.repositories.bank_connections import BankConnectionRepository
from app.repositories.budgets import BudgetRepository
from app.repositories.categories import CategoryRepository
from app.repositories.financial_profiles import UserFinancialProfileRepository
from app.repositories.goals import GoalRepository
from app.repositories.recurring_events import RecurringEventRepository
from app.repositories.transactions import TransactionRepository
from app.schemas.financial_data import FinancialProfileUpdate


class FinancialDataService:
    def __init__(self, session: Session, *, default_currency: str) -> None:
        self._default_currency = default_currency
        self._profiles = UserFinancialProfileRepository(session)
        self._categories = CategoryRepository(session)
        self._budgets = BudgetRepository(session)
        self._accounts = AccountRepository(session)
        self._bank_accounts = BankAccountRepository(session)
        self._transactions = TransactionRepository(session)
        self._recurring_events = RecurringEventRepository(session)
        self._goals = GoalRepository(session)
        self._bank_connections = BankConnectionRepository(session)

    def get_or_create_profile(self, user_id: str) -> UserFinancialProfileModel:
        return self._profiles.get_or_create_default(
            user_id=user_id,
            currency=self._default_currency,
            locale="en",
        )

    def update_profile(
        self,
        user_id: str,
        payload: FinancialProfileUpdate,
    ) -> UserFinancialProfileModel:
        profile = self.get_or_create_profile(user_id)
        return self._profiles.update(
            profile,
            currency=payload.currency,
            locale=payload.locale,
            salary_day=payload.salary_day,
            protected_balance=payload.protected_balance,
            risk_profile=payload.risk_profile,
            default_cycle_mode=payload.default_cycle_mode,
        )

    def list_categories(self, user_id: str):
        return self._categories.ensure_defaults(user_id)

    def list_budgets(self, user_id: str):
        return self._budgets.list_by_user(user_id)

    def load_financial_data(self, user_id: str) -> dict[str, object]:
        profile = self.get_or_create_profile(user_id)
        categories = self._categories.ensure_defaults(user_id)
        budgets = self._budgets.list_by_user(user_id)
        accounts = self._accounts.list_by_user(user_id)
        transactions = self._transactions.list_by_user(user_id)
        recurring_events = self._recurring_events.list_by_user(user_id)
        goals = self._goals.list_by_user(user_id)
        bank_connections = self._bank_connections.list_visible_by_user(user_id)
        serialized_bank_connections = [
            {
                "id": connection.id,
                "provider": connection.provider,
                "status": connection.status,
                "institution_name": connection.institution_name,
                "last_sync_at": connection.last_sync_at,
                "created_at": connection.created_at,
                "linked_accounts": len(
                    self._bank_accounts.list_by_connection(connection.id)
                ),
            }
            for connection in bank_connections
        ]

        return {
            "mode": "api",
            "financial_profile": profile,
            "categories": categories,
            "budgets": budgets,
            "accounts": accounts,
            "transactions": transactions,
            "recurring_events": recurring_events,
            "goals": goals,
            "bank_connections": serialized_bank_connections,
        }
