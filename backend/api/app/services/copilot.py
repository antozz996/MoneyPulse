from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models import GoalModel, TransactionModel
from app.config import Settings
from app.errors import validation_error
from app.repositories.goals import GoalRepository
from app.repositories.recurring_events import RecurringEventRepository
from app.repositories.transactions import TransactionRepository
from app.schemas.copilot import (
    CopilotChatCreate,
    CopilotContextRead,
    CopilotGoalSummaryRead,
    CopilotMoneyAmountRead,
    CopilotRecentDecisionSummaryRead,
    CopilotReplyRead,
    CopilotSnapshotSummaryRead,
    CopilotBudgetSummaryRead,
)
from app.schemas.decisioning import BeforeYouBuyCreate, BeforeYouBuyRead, TodayRead
from app.services.copilot_providers import (
    CopilotGoalState,
    CopilotProviderContext,
    CopilotProviders,
    classify_copilot_message,
)
from app.services.decisioning import DecisioningService
from app.services.recurring_events import RecurringEventService


@dataclass(frozen=True)
class WeeklyWindowSummary:
    documented_income: float
    documented_outgoing: float
    upcoming_items_count: int


class CopilotService:
    def __init__(
        self,
        session: Session,
        decisioning: DecisioningService,
        providers: CopilotProviders,
        settings: Settings,
    ) -> None:
        self._decisioning = decisioning
        self._providers = providers
        self._settings = settings
        self._goals = GoalRepository(session)
        self._transactions = TransactionRepository(session)
        self._recurring_events = RecurringEventRepository(session)

    def chat(
        self,
        user_id: str,
        payload: CopilotChatCreate,
        *,
        reference_date: date | None = None,
    ) -> CopilotReplyRead:
        self._validate_payload(payload)
        resolved_date = reference_date or date.today()
        today = TodayRead.model_validate(
            self._decisioning.get_today(user_id, reference_date=resolved_date)
        )
        classification = classify_copilot_message(payload.message)
        purchase_decision = self._maybe_evaluate_purchase(
            user_id=user_id,
            payload=payload,
            classification=classification,
            reference_date=resolved_date,
            fallback_currency=today.currency,
        )
        goal_state = self._build_goal_state(user_id)
        weekly = self._build_weekly_summary(user_id, resolved_date)
        safe_context = self._build_safe_context(
            locale=payload.locale,
            today=today,
            goal_state=goal_state,
            purchase_decision=purchase_decision,
            reference_date=resolved_date,
        )

        return self._providers.generate_reply(
            CopilotProviderContext(
                request=payload,
                classification=classification,
                safe_context=safe_context,
                today=today,
                goal_state=goal_state,
                upcoming_items_count=weekly.upcoming_items_count,
                documented_income=weekly.documented_income,
                documented_outgoing=weekly.documented_outgoing,
                purchase_decision=purchase_decision,
            )
        )

    def _validate_payload(self, payload: CopilotChatCreate) -> None:
        if len(payload.message) > self._settings.copilot_max_input_chars:
            raise validation_error(
                "Copilot message exceeds the configured maximum length.",
                {
                    "max_length": self._settings.copilot_max_input_chars,
                    "field": "message",
                },
            )

        if len(payload.history) > self._settings.copilot_max_history_messages:
            raise validation_error(
                "Copilot history exceeds the configured maximum number of messages.",
                {
                    "max_messages": self._settings.copilot_max_history_messages,
                    "field": "history",
                },
            )

    def _maybe_evaluate_purchase(
        self,
        *,
        user_id: str,
        payload: CopilotChatCreate,
        classification,
        reference_date: date,
        fallback_currency: str,
    ) -> BeforeYouBuyRead | None:
        amount = classification.entities.amount
        if classification.intent != "affordability_check" or amount is None:
            return None

        currency = classification.entities.currency or fallback_currency
        decision = self._decisioning.evaluate_before_you_buy(
            user_id,
            BeforeYouBuyCreate(
                amount=amount,
                currency=currency,
                description=payload.message,
            ),
            reference_date=reference_date,
        )
        return BeforeYouBuyRead.model_validate(decision)

    def _build_goal_state(self, user_id: str) -> CopilotGoalState:
        goals = self._goals.list_by_user(user_id)
        return CopilotGoalState(
            goals_count=len(goals),
            safety_buffer_reserved=round(
                sum(goal.reserved_amount for goal in goals if goal.kind == "safety_buffer"),
                2,
            ),
            planned_goal_contribution=round(
                sum(goal.planned_contribution for goal in goals if goal.kind == "goal"),
                2,
            ),
        )

    def _build_weekly_summary(
        self,
        user_id: str,
        reference_date: date,
    ) -> WeeklyWindowSummary:
        period_end = reference_date + timedelta(days=6)
        transactions = self._transactions.list_by_user(user_id)
        recurring_events = self._recurring_events.list_by_user(user_id)
        documented_income = 0.0
        documented_outgoing = 0.0
        upcoming_items_count = 0

        for transaction in transactions:
            if reference_date <= transaction.effective_date <= period_end:
                upcoming_items_count += 1
                if transaction.direction == "income":
                    documented_income += transaction.amount
                else:
                    documented_outgoing += transaction.amount

        for day_offset in range(0, 7):
            current_date = reference_date + timedelta(days=day_offset)
            for recurring_event in recurring_events:
                if RecurringEventService.occurs_on(recurring_event, current_date):
                    upcoming_items_count += 1
                    if recurring_event.direction == "income":
                        documented_income += recurring_event.amount
                    else:
                        documented_outgoing += recurring_event.amount

        return WeeklyWindowSummary(
            documented_income=round(documented_income, 2),
            documented_outgoing=round(documented_outgoing, 2),
            upcoming_items_count=upcoming_items_count,
        )

    def _build_safe_context(
        self,
        *,
        locale: str,
        today: TodayRead,
        goal_state: CopilotGoalState,
        purchase_decision: BeforeYouBuyRead | None,
        reference_date: date,
    ) -> CopilotContextRead:
        current_amount = CopilotMoneyAmountRead(
            amount=today.available_to_spend_today,
            currency=today.currency,
        )
        recent_decision = None
        if purchase_decision is not None:
            recent_decision = CopilotRecentDecisionSummaryRead(
                level=self._decision_to_level(purchase_decision.decision),
                status=self._decision_to_status(purchase_decision.decision),
                purchase_amount=CopilotMoneyAmountRead(
                    amount=purchase_decision.purchase_amount,
                    currency=purchase_decision.currency,
                ),
                remaining_after_purchase=CopilotMoneyAmountRead(
                    amount=purchase_decision.available_to_spend_after_purchase,
                    currency=purchase_decision.currency,
                ),
            )

        return CopilotContextRead(
            locale=locale,
            currency=today.currency,
            risk_profile="BALANCED",
            snapshot_summary=CopilotSnapshotSummaryRead(
                cycle_start=reference_date,
                cycle_end=reference_date,
                real_availability_now=current_amount,
                projected_availability=current_amount,
                safe_daily_spend=current_amount,
                decision_level=self._decision_to_level(today.risk_level),
            ),
            budget_summary=CopilotBudgetSummaryRead(
                overall="HEALTHY",
                over_limit_categories=[],
                near_limit_categories=[],
            ),
            goal_summary=CopilotGoalSummaryRead(
                essential_covered=goal_state.safety_buffer_reserved > 0,
                important_covered=goal_state.planned_goal_contribution <= today.available_to_spend_today,
                flexible_deferred=goal_state.goals_count > 0,
                remaining_this_cycle=CopilotMoneyAmountRead(
                    amount=goal_state.planned_goal_contribution,
                    currency=today.currency,
                ),
            ),
            recent_decision_summary=recent_decision,
        )

    @staticmethod
    def _decision_to_level(decision: str) -> str:
        if decision == "safe":
            return "GREEN"
        if decision == "caution":
            return "YELLOW"
        return "RED"

    @staticmethod
    def _decision_to_status(decision: str) -> str:
        if decision == "safe":
            return "ALLOW"
        if decision == "caution":
            return "ALLOW_WITH_CAUTION"
        return "NOT_RECOMMENDED"
