from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.errors import validation_error
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
from app.schemas.financial_data import FinancialProfileUpdate, OnboardingUpdate


@dataclass(frozen=True)
class OnboardingSummary:
    can_complete: bool
    recommended_next_action: str | None
    has_accounts: bool
    has_income_schedule: bool
    has_fixed_commitments: bool
    has_goals: bool
    has_budgets: bool
    has_transaction_history: bool
    missing_setup_fields: list[str]
    setup_quality_score: int


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

    def get_financial_profile_payload(self, user_id: str) -> dict[str, object]:
        profile = self.get_or_create_profile(user_id)
        summary = self._sync_onboarding_summary(user_id, profile)
        return self._serialize_profile(profile, summary)

    def update_profile(
        self,
        user_id: str,
        payload: FinancialProfileUpdate,
    ) -> UserFinancialProfileModel:
        profile = self.get_or_create_profile(user_id)
        updated = self._profiles.update(
            profile,
            currency=payload.currency,
            locale=payload.locale,
            salary_day=payload.salary_day,
            protected_balance=payload.protected_balance,
            risk_profile=payload.risk_profile,
            default_cycle_mode=payload.default_cycle_mode,
        )
        self._sync_onboarding_summary(user_id, updated)
        return updated

    def list_categories(self, user_id: str):
        return self._categories.ensure_defaults(user_id)

    def list_budgets(self, user_id: str):
        return self._budgets.list_by_user(user_id)

    def load_financial_data(self, user_id: str) -> dict[str, object]:
        profile = self.get_or_create_profile(user_id)
        summary = self._sync_onboarding_summary(user_id, profile)
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
            "financial_profile": self._serialize_profile(profile, summary),
            "categories": categories,
            "budgets": budgets,
            "accounts": accounts,
            "transactions": transactions,
            "recurring_events": recurring_events,
            "goals": goals,
            "bank_connections": serialized_bank_connections,
        }

    def get_onboarding_summary(self, user_id: str) -> dict[str, object]:
        profile = self.get_or_create_profile(user_id)
        summary = self._sync_onboarding_summary(user_id, profile)
        return self._serialize_onboarding(profile, summary)

    def start_onboarding(self, user_id: str) -> dict[str, object]:
        profile = self.get_or_create_profile(user_id)
        if profile.onboarding_status == "not_started":
            profile.onboarding_status = "in_progress"
        if not profile.onboarding_step:
            profile.onboarding_step = "basics"
        profile = self._profiles.save(profile)
        summary = self._sync_onboarding_summary(user_id, profile)
        return self._serialize_onboarding(profile, summary)

    def update_onboarding(
        self,
        user_id: str,
        payload: OnboardingUpdate,
    ) -> dict[str, object]:
        profile = self.get_or_create_profile(user_id)

        if payload.currency is not None:
            profile.currency = payload.currency
        if payload.locale is not None:
            profile.locale = payload.locale
        if "salary_day" in payload.model_fields_set:
            profile.salary_day = payload.salary_day
        if payload.protected_balance is not None:
            profile.protected_balance = payload.protected_balance
            profile.protected_balance_configured = True
        if payload.default_cycle_mode is not None:
            profile.default_cycle_mode = payload.default_cycle_mode
            profile.cycle_configured = True
        if payload.protected_balance_configured is not None:
            profile.protected_balance_configured = payload.protected_balance_configured
        if payload.zero_balance_declared is not None:
            profile.zero_balance_declared = payload.zero_balance_declared
        if payload.cycle_configured is not None:
            profile.cycle_configured = payload.cycle_configured
        if payload.onboarding_status is not None:
            profile.onboarding_status = payload.onboarding_status
        elif profile.onboarding_status == "not_started":
            profile.onboarding_status = "in_progress"
        if payload.onboarding_step is not None:
            profile.onboarding_step = payload.onboarding_step
        elif not profile.onboarding_step:
            profile.onboarding_step = "basics"
        if profile.onboarding_status != "completed":
            profile.onboarding_completed_at = None

        profile = self._profiles.save(profile)
        summary = self._sync_onboarding_summary(user_id, profile)
        return self._serialize_onboarding(profile, summary)

    def complete_onboarding(self, user_id: str) -> dict[str, object]:
        profile = self.get_or_create_profile(user_id)
        summary = self._compute_onboarding_summary(user_id, profile)
        if not summary.can_complete:
            raise validation_error(
                "Complete the required onboarding steps before finishing setup.",
                {"missing_setup_fields": summary.missing_setup_fields},
            )

        profile.onboarding_status = "completed"
        profile.onboarding_step = "completed"
        profile.onboarding_completed_at = datetime.now(UTC)
        profile.protected_balance_configured = (
            profile.protected_balance_configured
            or profile.protected_balance >= 0
        )
        profile.cycle_configured = profile.cycle_configured or (
            profile.default_cycle_mode == "CALENDAR_MONTH"
            or profile.salary_day is not None
        )
        profile = self._profiles.save(profile)
        summary = self._sync_onboarding_summary(user_id, profile)
        return self._serialize_onboarding(profile, summary)

    def _compute_onboarding_summary(
        self,
        user_id: str,
        profile: UserFinancialProfileModel,
    ) -> OnboardingSummary:
        budgets = self._budgets.list_by_user(user_id)
        accounts = self._accounts.list_by_user(user_id)
        transactions = self._transactions.list_by_user(user_id)
        recurring_events = self._recurring_events.list_by_user(user_id)
        goals = self._goals.list_by_user(user_id)

        has_accounts = any(account.status != "archived" for account in accounts)
        has_transaction_history = any(
            transaction.status != "archived" for transaction in transactions
        )
        active_recurring = [
            recurring_event
            for recurring_event in recurring_events
            if recurring_event.status == "active" and recurring_event.active
        ]
        has_income_schedule = any(
            recurring_event.direction == "income" for recurring_event in active_recurring
        ) or profile.salary_day is not None
        has_fixed_commitments = any(
            recurring_event.direction == "expense" for recurring_event in active_recurring
        )
        has_goals = any(goal.status == "active" for goal in goals)
        has_budgets = any(budget.status == "active" for budget in budgets)
        legacy_setup_context = (
            has_accounts
            or has_transaction_history
            or has_income_schedule
            or has_fixed_commitments
            or has_goals
            or has_budgets
        )

        cycle_configured = profile.cycle_configured or profile.salary_day is not None
        if (
            not cycle_configured
            and legacy_setup_context
            and profile.default_cycle_mode == "CALENDAR_MONTH"
        ):
            cycle_configured = True

        protected_balance_configured = (
            profile.protected_balance_configured
            or profile.protected_balance > 0
            or (legacy_setup_context and profile.protected_balance == 0)
        )
        account_configured = has_accounts or profile.zero_balance_declared

        missing_setup_fields: list[str] = []
        if not cycle_configured:
            missing_setup_fields.append("cycle_mode")
        if profile.default_cycle_mode == "SALARY_CYCLE" and profile.salary_day is None:
            missing_setup_fields.append("salary_day")
        if not account_configured:
            missing_setup_fields.append("primary_account")
        if not protected_balance_configured:
            missing_setup_fields.append("protected_balance")
        if not has_income_schedule:
            missing_setup_fields.append("income_schedule")
        if not has_fixed_commitments:
            missing_setup_fields.append("fixed_commitments")
        if not has_goals:
            missing_setup_fields.append("goals")
        if not has_budgets:
            missing_setup_fields.append("budgets")
        if not has_transaction_history:
            missing_setup_fields.append("transaction_history")

        setup_quality_score = 0
        if cycle_configured and not (
            profile.default_cycle_mode == "SALARY_CYCLE" and profile.salary_day is None
        ):
            setup_quality_score += 15
        if account_configured:
            setup_quality_score += 20
        if protected_balance_configured:
            setup_quality_score += 15
        if has_income_schedule:
            setup_quality_score += 15
        if has_fixed_commitments:
            setup_quality_score += 15
        if has_goals:
            setup_quality_score += 10
        if has_budgets:
            setup_quality_score += 5
        if has_transaction_history:
            setup_quality_score += 5

        completion_blockers = {
            "cycle_mode",
            "salary_day",
            "primary_account",
            "protected_balance",
        }
        can_complete = not any(
            field in completion_blockers for field in missing_setup_fields
        )
        recommended_next_action = (
            missing_setup_fields[0] if missing_setup_fields else "review"
        )

        return OnboardingSummary(
            can_complete=can_complete,
            recommended_next_action=recommended_next_action,
            has_accounts=has_accounts,
            has_income_schedule=has_income_schedule,
            has_fixed_commitments=has_fixed_commitments,
            has_goals=has_goals,
            has_budgets=has_budgets,
            has_transaction_history=has_transaction_history,
            missing_setup_fields=missing_setup_fields,
            setup_quality_score=setup_quality_score,
        )

    def _sync_onboarding_summary(
        self,
        user_id: str,
        profile: UserFinancialProfileModel,
    ) -> OnboardingSummary:
        summary = self._compute_onboarding_summary(user_id, profile)
        serialized_missing = ",".join(summary.missing_setup_fields) or None
        needs_save = (
            profile.setup_quality_score != summary.setup_quality_score
            or profile.missing_setup_fields != serialized_missing
        )

        if needs_save:
            profile.setup_quality_score = summary.setup_quality_score
            profile.missing_setup_fields = serialized_missing
            profile = self._profiles.save(profile)

        return summary

    def _serialize_profile(
        self,
        profile: UserFinancialProfileModel,
        summary: OnboardingSummary,
    ) -> dict[str, object]:
        return {
            "id": profile.id,
            "user_id": profile.user_id,
            "currency": profile.currency,
            "locale": profile.locale,
            "salary_day": profile.salary_day,
            "protected_balance": profile.protected_balance,
            "risk_profile": profile.risk_profile,
            "default_cycle_mode": profile.default_cycle_mode,
            "onboarding_status": profile.onboarding_status,
            "onboarding_step": profile.onboarding_step,
            "onboarding_completed_at": profile.onboarding_completed_at,
            "setup_quality_score": summary.setup_quality_score,
            "missing_setup_fields": summary.missing_setup_fields,
            "protected_balance_configured": profile.protected_balance_configured,
            "zero_balance_declared": profile.zero_balance_declared,
            "cycle_configured": profile.cycle_configured or profile.salary_day is not None,
            "status": profile.status,
            "created_at": profile.created_at,
            "updated_at": profile.updated_at,
        }

    def _serialize_onboarding(
        self,
        profile: UserFinancialProfileModel,
        summary: OnboardingSummary,
    ) -> dict[str, object]:
        return {
            "profile": self._serialize_profile(profile, summary),
            "can_complete": summary.can_complete,
            "recommended_next_action": summary.recommended_next_action,
            "has_accounts": summary.has_accounts,
            "has_income_schedule": summary.has_income_schedule,
            "has_fixed_commitments": summary.has_fixed_commitments,
            "has_goals": summary.has_goals,
            "has_budgets": summary.has_budgets,
            "has_transaction_history": summary.has_transaction_history,
        }
