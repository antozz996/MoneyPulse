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
        payload = {
            "action": "today",
            "snapshot": snapshot.to_core_payload(),
        }

        try:
            return self._run(payload)
        except (OSError, RuntimeError):
            return self._calculate_today_fallback(snapshot)

    def evaluate_purchase(
        self,
        snapshot: SnapshotInput,
        purchase: BeforeYouBuyCreate,
    ) -> dict[str, Any]:
        payload = {
            "action": "before-you-buy",
            "snapshot": snapshot.to_core_payload(),
            "purchase": {
                "amount": purchase.amount,
                "currency": purchase.currency.upper(),
                "description": purchase.description,
            },
        }

        try:
            return self._run(payload)
        except (OSError, RuntimeError):
            return self._evaluate_purchase_fallback(snapshot, purchase)

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

    def _calculate_today_fallback(self, snapshot: SnapshotInput) -> dict[str, Any]:
        available_to_spend_today, _ = self._calculate_available_to_spend(snapshot)
        confidence = self._build_confidence(snapshot.model_version)

        return {
            "available_to_spend_today": available_to_spend_today,
            "risk_level": "hold" if available_to_spend_today == 0 else "safe",
            "currency": snapshot.currency,
            "model_version": snapshot.model_version,
            "explanations": [
                f"Started from {snapshot.currency} {snapshot.available_balance:.2f} available today.",
                f"Added {snapshot.currency} {snapshot.expected_income_today:.2f} of expected income today.",
                f"Reserved {snapshot.currency} {snapshot.essential_obligations:.2f} for essentials and {snapshot.currency} {snapshot.safety_buffer:.2f} as a safety buffer.",
                f"Protected {snapshot.currency} {snapshot.planned_goal_contribution:.2f} for goals and {snapshot.currency} {snapshot.committed_spending:.2f} already committed to discretionary spending.",
            ],
            "inputs": {
                "available_balance": snapshot.available_balance,
                "expected_income_today": snapshot.expected_income_today,
                "essential_obligations": snapshot.essential_obligations,
                "committed_spending": snapshot.committed_spending,
                "safety_buffer": snapshot.safety_buffer,
                "planned_goal_contribution": snapshot.planned_goal_contribution,
            },
            "confidence": confidence,
        }

    def _evaluate_purchase_fallback(
        self,
        snapshot: SnapshotInput,
        purchase: BeforeYouBuyCreate,
    ) -> dict[str, Any]:
        purchase_currency = purchase.currency.upper()
        if purchase_currency != snapshot.currency:
            raise ValueError("Money values must use the same currency.")

        current_available_to_spend, _ = self._calculate_available_to_spend(snapshot)
        purchase_amount = round(purchase.amount, 2)
        raw_remaining = round(current_available_to_spend - purchase_amount, 2)
        available_to_spend_after_purchase = max(0.0, raw_remaining)
        can_afford = purchase_amount <= current_available_to_spend

        if purchase_amount == 0:
            decision = "safe"
        elif purchase_amount > current_available_to_spend:
            decision = "hold"
        elif raw_remaining == 0:
            decision = "caution"
        else:
            decision = "safe"

        confidence = self._build_confidence(
            snapshot.model_version,
            purchase_context="matched-currency",
        )

        return {
            "current_available_to_spend": current_available_to_spend,
            "purchase_amount": purchase_amount,
            "available_to_spend_after_purchase": available_to_spend_after_purchase,
            "delta": round(purchase_amount * -1, 2),
            "can_afford": can_afford,
            "decision": decision,
            "currency": snapshot.currency,
            "model_version": snapshot.model_version,
            "explanations": [
                f"Current available to spend is {snapshot.currency} {current_available_to_spend:.2f}.",
                f"Evaluated a purchase of {snapshot.currency} {purchase_amount:.2f}.",
                f"Projected remaining discretionary headroom is {snapshot.currency} {available_to_spend_after_purchase:.2f}.",
            ],
            "confidence": confidence,
        }

    def _calculate_available_to_spend(self, snapshot: SnapshotInput) -> tuple[float, float]:
        raw_available = round(
            snapshot.available_balance
            + snapshot.expected_income_today
            - snapshot.essential_obligations
            - snapshot.committed_spending
            - snapshot.safety_buffer
            - snapshot.planned_goal_contribution,
            2,
        )
        return (max(0.0, raw_available), raw_available)

    def _build_confidence(
        self,
        model_version: str,
        *,
        purchase_context: str = "not-provided",
    ) -> dict[str, Any]:
        return {
            "mode": "deterministic",
            "input_completeness": "complete",
            "uses_documented_inputs_only": True,
            "purchase_context": purchase_context,
            "supported_inputs": [
                "availableBalance",
                "expectedIncomeToday",
                "essentialObligations",
                "committedSpending",
                "safetyBuffer",
                "plannedGoalContribution",
            ],
            "model_version": model_version,
        }


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
