from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy.orm import Session

from app.models import TransactionModel
from app.repositories.recurring_events import RecurringEventRepository
from app.repositories.transactions import TransactionRepository
from app.schemas.coach import (
    CoachDecisionExplainRead,
    CoachTodaySummaryRead,
    CoachWeeklySummaryRead,
)
from app.schemas.decisioning import BeforeYouBuyCreate, BeforeYouBuyRead, TodayRead
from app.services.coach_providers import (
    CoachProviders,
    DecisionCoachContext,
    TodayCoachContext,
    UpcomingItem,
    WeeklyCoachContext,
)
from app.services.decisioning import DecisioningService
from app.services.recurring_events import RecurringEventService


@dataclass(frozen=True)
class WeeklyWindow:
    period_start: date
    period_end: date
    documented_income: float
    documented_outgoing: float
    upcoming_items: tuple[UpcomingItem, ...]


class CoachService:
    def __init__(
        self,
        session: Session,
        decisioning: DecisioningService,
        providers: CoachProviders,
    ) -> None:
        self._decisioning = decisioning
        self._provider = providers.resolve()
        self._transactions = TransactionRepository(session)
        self._recurring_events = RecurringEventRepository(session)

    def get_today_summary(
        self,
        user_id: str,
        *,
        reference_date: date | None = None,
    ) -> CoachTodaySummaryRead:
        today = TodayRead.model_validate(
            self._decisioning.get_today(user_id, reference_date=reference_date)
        )
        return self._provider.summarize_today(TodayCoachContext(today=today))

    def explain_decision(
        self,
        user_id: str,
        payload: BeforeYouBuyCreate,
        *,
        reference_date: date | None = None,
    ) -> CoachDecisionExplainRead:
        today = TodayRead.model_validate(
            self._decisioning.get_today(user_id, reference_date=reference_date)
        )
        decision = BeforeYouBuyRead.model_validate(
            self._decisioning.evaluate_before_you_buy(
                user_id,
                payload,
                reference_date=reference_date,
            )
        )
        return self._provider.explain_decision(
            DecisionCoachContext(
                today=today,
                decision=decision,
                purchase_description=payload.description,
            )
        )

    def get_weekly_summary(
        self,
        user_id: str,
        *,
        reference_date: date | None = None,
    ) -> CoachWeeklySummaryRead:
        resolved_date = reference_date or date.today()
        today = TodayRead.model_validate(
            self._decisioning.get_today(user_id, reference_date=resolved_date)
        )
        weekly_window = self._build_weekly_window(user_id, resolved_date, today.currency)
        return self._provider.summarize_weekly(
            WeeklyCoachContext(
                today=today,
                period_start=weekly_window.period_start,
                period_end=weekly_window.period_end,
                documented_income=weekly_window.documented_income,
                documented_outgoing=weekly_window.documented_outgoing,
                upcoming_items=weekly_window.upcoming_items,
            )
        )

    def _build_weekly_window(
        self,
        user_id: str,
        reference_date: date,
        currency: str,
    ) -> WeeklyWindow:
        period_end = reference_date + timedelta(days=6)
        transactions = self._transactions.list_by_user(user_id)
        recurring_events = self._recurring_events.list_by_user(user_id)

        upcoming_items: list[UpcomingItem] = []
        documented_income = 0.0
        documented_outgoing = 0.0

        for transaction in transactions:
            if reference_date <= transaction.effective_date <= period_end:
                upcoming_items.append(
                    self._transaction_to_upcoming_item(transaction)
                )
                if transaction.direction == "income":
                    documented_income += transaction.amount
                else:
                    documented_outgoing += transaction.amount

        for day_offset in range(0, 7):
            current_date = reference_date + timedelta(days=day_offset)
            for recurring_event in recurring_events:
                if RecurringEventService.occurs_on(recurring_event, current_date):
                    upcoming_items.append(
                        UpcomingItem(
                            date=current_date,
                            label=recurring_event.name,
                            amount=round(recurring_event.amount, 2),
                            direction=recurring_event.direction,
                            currency=recurring_event.currency.upper(),
                        )
                    )
                    if recurring_event.direction == "income":
                        documented_income += recurring_event.amount
                    else:
                        documented_outgoing += recurring_event.amount

        normalized_items = tuple(
            sorted(
                upcoming_items,
                key=lambda item: (item.date.isoformat(), item.label, item.amount),
            )
        )

        return WeeklyWindow(
            period_start=reference_date,
            period_end=period_end,
            documented_income=round(documented_income, 2),
            documented_outgoing=round(documented_outgoing, 2),
            upcoming_items=normalized_items,
        )

    @staticmethod
    def _transaction_to_upcoming_item(transaction: TransactionModel) -> UpcomingItem:
        return UpcomingItem(
            date=transaction.effective_date,
            label=transaction.name,
            amount=round(transaction.amount, 2),
            direction=transaction.direction,
            currency=transaction.currency.upper(),
        )
