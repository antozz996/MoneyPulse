from dataclasses import dataclass
from datetime import date
import json
from subprocess import CalledProcessError, run
from typing import Any, Protocol

from sqlalchemy.orm import Session

from app.config import Settings
from app.models import AccountModel, GoalModel, RecurringEventModel, TransactionModel
from app.repositories.accounts import AccountRepository
from app.repositories.goals import GoalRepository
from app.repositories.recurring_events import RecurringEventRepository
from app.repositories.transactions import TransactionRepository
from app.schemas.decisioning import BeforeYouBuyCreate
from app.services.recurring_events import RecurringEventService


@dataclass(frozen=True)
class SnapshotInput:
    available_balance: float
    expected_income_today: float
    essential_obligations: float
    committed_spending: float
    safety_buffer: float
    planned_goal_contribution: float
    currency: str
    model_version: str

    def to_core_payload(self) -> dict[str, Any]:
        return {
            "availableBalance": self.available_balance,
            "expectedIncomeToday": self.expected_income_today,
            "essentialObligations": self.essential_obligations,
            "committedSpending": self.committed_spending,
            "safetyBuffer": self.safety_buffer,
            "plannedGoalContribution": self.planned_goal_contribution,
            "currency": self.currency,
            "modelVersion": self.model_version,
        }


class DecisionEngineAdapter(Protocol):
    def calculate_today(self, snapshot: SnapshotInput) -> dict[str, Any]:
        ...

    def evaluate_purchase(
        self,
        snapshot: SnapshotInput,
        purchase: BeforeYouBuyCreate,
    ) -> dict[str, Any]:
        ...


class CoreCliDecisionEngineAdapter:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings

    def calculate_today(self, snapshot: SnapshotInput) -> dict[str, Any]:
        return self._run(
            {
                "action": "today",
                "snapshot": snapshot.to_core_payload(),
            }
        )

    def evaluate_purchase(
        self,
        snapshot: SnapshotInput,
        purchase: BeforeYouBuyCreate,
    ) -> dict[str, Any]:
        return self._run(
            {
                "action": "before-you-buy",
                "snapshot": snapshot.to_core_payload(),
                "purchase": {
                    "amount": purchase.amount,
                    "currency": purchase.currency.upper(),
                    "description": purchase.description,
                },
            }
        )

    def _run(self, payload: dict[str, Any]) -> dict[str, Any]:
        try:
            completed = run(
                self._settings.core_cli_command,
                cwd=self._settings.repo_root,
                input=json.dumps(payload),
                capture_output=True,
                check=True,
                text=True,
            )
        except CalledProcessError as exc:
            message = exc.stderr.strip() or exc.stdout.strip() or "Decision engine failed."
            raise RuntimeError(message) from exc

        return json.loads(completed.stdout)


class DecisioningService:
    def __init__(
        self,
        *,
        session: Session,
        settings: Settings,
        adapter: DecisionEngineAdapter,
    ) -> None:
        self._settings = settings
        self._adapter = adapter
        self._accounts = AccountRepository(session)
        self._transactions = TransactionRepository(session)
        self._goals = GoalRepository(session)
        self._recurring_events = RecurringEventRepository(session)

    def get_today(self, user_id: str, *, reference_date: date | None = None) -> dict[str, Any]:
        snapshot = self._build_snapshot(
            user_id=user_id,
            reference_date=reference_date or date.today(),
            fallback_currency=self._settings.default_currency,
        )
        return self._adapter.calculate_today(snapshot)

    def evaluate_before_you_buy(
        self,
        user_id: str,
        payload: BeforeYouBuyCreate,
        *,
        reference_date: date | None = None,
    ) -> dict[str, Any]:
        snapshot = self._build_snapshot(
            user_id=user_id,
            reference_date=reference_date or date.today(),
            fallback_currency=payload.currency.upper(),
        )
        return self._adapter.evaluate_purchase(snapshot, payload)

    def _build_snapshot(
        self,
        *,
        user_id: str,
        reference_date: date,
        fallback_currency: str,
    ) -> SnapshotInput:
        accounts = self._accounts.list_by_user(user_id)
        transactions = self._transactions.list_by_user(user_id)
        goals = self._goals.list_by_user(user_id)
        recurring_events = self._recurring_events.list_by_user(user_id)

        currency = self._resolve_currency(
            accounts,
            transactions,
            goals,
            recurring_events,
            fallback_currency,
        )
        todays_transactions = [
            transaction
            for transaction in transactions
            if transaction.effective_date == reference_date
            and transaction.source != "bank_import"
        ]
        todays_recurring_events = [
            recurring_event
            for recurring_event in recurring_events
            if RecurringEventService.occurs_on(recurring_event, reference_date)
        ]

        return SnapshotInput(
            available_balance=round(sum(account.balance for account in accounts), 2),
            expected_income_today=round(
                sum(
                    transaction.amount
                    for transaction in todays_transactions
                    if transaction.direction == "income"
                ),
                2,
            )
            + round(
                sum(
                    recurring_event.amount
                    for recurring_event in todays_recurring_events
                    if recurring_event.direction == "income"
                ),
                2,
            ),
            essential_obligations=round(
                sum(
                    transaction.amount
                    for transaction in todays_transactions
                    if transaction.direction == "expense"
                    and transaction.category == "essential"
                ),
                2,
            )
            + round(
                sum(
                    recurring_event.amount
                    for recurring_event in todays_recurring_events
                    if recurring_event.direction == "expense"
                    and recurring_event.category == "essential"
                ),
                2,
            ),
            committed_spending=round(
                sum(
                    transaction.amount
                    for transaction in todays_transactions
                    if transaction.direction == "expense"
                    and transaction.category == "committed"
                ),
                2,
            )
            + round(
                sum(
                    recurring_event.amount
                    for recurring_event in todays_recurring_events
                    if recurring_event.direction == "expense"
                    and recurring_event.category == "committed"
                ),
                2,
            ),
            safety_buffer=round(
                sum(goal.reserved_amount for goal in goals if goal.kind == "safety_buffer"),
                2,
            ),
            planned_goal_contribution=round(
                sum(
                    goal.planned_contribution for goal in goals if goal.kind == "goal"
                ),
                2,
            ),
            currency=currency,
            model_version=self._settings.model_version,
        )

    def _resolve_currency(
        self,
        accounts: list[AccountModel],
        transactions: list[TransactionModel],
        goals: list[GoalModel],
        recurring_events: list[RecurringEventModel],
        fallback_currency: str,
    ) -> str:
        currencies = {
            record.currency.upper()
            for record in [*accounts, *transactions, *goals, *recurring_events]
            if record.currency
        }
        if not currencies:
            return fallback_currency.upper()
        if len(currencies) > 1:
            raise ValueError("Demo mode supports a single currency across finance records.")
        return next(iter(currencies))
