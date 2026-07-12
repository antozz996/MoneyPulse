from datetime import date

from sqlalchemy.orm import Session

from app.errors import validation_error
from app.models import RecurringEventModel
from app.repositories.accounts import AccountRepository
from app.repositories.categories import CategoryRepository
from app.repositories.recurring_events import RecurringEventRepository
from app.schemas.recurring_events import RecurringEventCreate, RecurringEventUpdate


class RecurringEventService:
    def __init__(self, session: Session) -> None:
        self._repository = RecurringEventRepository(session)
        self._accounts = AccountRepository(session)
        self._categories = CategoryRepository(session)

    def list_recurring_events(self, user_id: str) -> list[RecurringEventModel]:
        return self._repository.list_by_user(user_id)

    def create_recurring_event(
        self,
        user_id: str,
        payload: RecurringEventCreate,
    ) -> RecurringEventModel:
        self._validate_relations(
            user_id=user_id,
            account_id=payload.account_id,
            category_id=payload.category_id,
            entry_type=payload.direction,
        )
        return self._repository.create(
            user_id=user_id,
            account_id=payload.account_id,
            category_id=payload.category_id,
            name=payload.name,
            amount=payload.amount,
            currency=payload.currency,
            direction=payload.direction,
            category=payload.category,
            cadence=payload.cadence,
            start_date=payload.start_date,
            next_due_date=payload.next_due_date,
            active=payload.active,
            status=payload.status,
        )

    def update_recurring_event(
        self,
        user_id: str,
        recurring_event_id: int,
        payload: RecurringEventUpdate,
    ) -> RecurringEventModel:
        existing_event = self._repository.get_for_user(user_id, recurring_event_id)
        next_account_id = (
            payload.account_id
            if "account_id" in payload.model_fields_set
            else existing_event.account_id
        )
        next_category_id = (
            payload.category_id
            if "category_id" in payload.model_fields_set
            else existing_event.category_id
        )
        next_direction = (
            payload.direction
            if payload.direction is not None
            else existing_event.direction
        )
        self._validate_relations(
            user_id=user_id,
            account_id=next_account_id,
            category_id=next_category_id,
            entry_type=next_direction,
        )
        return self._repository.update(
            user_id=user_id,
            recurring_event_id=recurring_event_id,
            account_id=next_account_id,
            category_id=next_category_id,
            name=payload.name if payload.name is not None else existing_event.name,
            amount=payload.amount if payload.amount is not None else existing_event.amount,
            currency=payload.currency if payload.currency is not None else existing_event.currency,
            direction=next_direction,
            category=payload.category if "category" in payload.model_fields_set else existing_event.category,
            cadence=payload.cadence if payload.cadence is not None else existing_event.cadence,
            start_date=(
                payload.start_date
                if payload.start_date is not None
                else existing_event.start_date
            ),
            next_due_date=(
                payload.next_due_date
                if payload.next_due_date is not None
                else existing_event.next_due_date
            ),
            active=payload.active if payload.active is not None else existing_event.active,
            status=payload.status if payload.status is not None else existing_event.status,
        )

    def delete_recurring_event(self, user_id: str, recurring_event_id: int) -> None:
        self._repository.delete(
            user_id=user_id,
            recurring_event_id=recurring_event_id,
        )

    @staticmethod
    def occurs_on(recurring_event: RecurringEventModel, reference_date: date) -> bool:
        anchor_date = recurring_event.start_date
        if not recurring_event.active or reference_date < anchor_date:
            return False

        if recurring_event.cadence == "daily":
            return True

        if recurring_event.cadence == "weekly":
            delta_days = (reference_date - anchor_date).days
            return delta_days % 7 == 0

        month_distance = (
            (reference_date.year - anchor_date.year) * 12
            + reference_date.month
            - anchor_date.month
        )
        return month_distance >= 0 and reference_date.day == anchor_date.day

    def _validate_relations(
        self,
        *,
        user_id: str,
        account_id: int | None,
        category_id: int | None,
        entry_type: str,
    ) -> None:
        if account_id is not None:
            self._accounts.get_for_user(user_id, account_id)

        if category_id is None:
            return

        category = self._categories.get_for_user(user_id, category_id)
        if entry_type == "income" and category.entry_type != "income":
            raise validation_error(
                "Recurring income requires an income category when category_id is provided.",
                {"field": "category_id"},
            )
        if entry_type == "expense" and category.entry_type != "expense":
            raise validation_error(
                "Recurring expense requires an expense category when category_id is provided.",
                {"field": "category_id"},
            )
