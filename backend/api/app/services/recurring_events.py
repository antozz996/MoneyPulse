from datetime import date

from sqlalchemy.orm import Session

from app.models import RecurringEventModel
from app.repositories.recurring_events import RecurringEventRepository
from app.schemas.recurring_events import RecurringEventCreate, RecurringEventUpdate


class RecurringEventService:
    def __init__(self, session: Session) -> None:
        self._repository = RecurringEventRepository(session)

    def list_recurring_events(self, user_id: str) -> list[RecurringEventModel]:
        return self._repository.list_by_user(user_id)

    def create_recurring_event(
        self,
        user_id: str,
        payload: RecurringEventCreate,
    ) -> RecurringEventModel:
        return self._repository.create(
            user_id=user_id,
            name=payload.name,
            amount=payload.amount,
            currency=payload.currency.upper(),
            direction=payload.direction,
            category=payload.category,
            cadence=payload.cadence,
            start_date=payload.start_date,
            active=payload.active,
        )

    def update_recurring_event(
        self,
        user_id: str,
        recurring_event_id: int,
        payload: RecurringEventUpdate,
    ) -> RecurringEventModel:
        return self._repository.update(
            user_id=user_id,
            recurring_event_id=recurring_event_id,
            name=payload.name,
            amount=payload.amount,
            currency=payload.currency.upper(),
            direction=payload.direction,
            category=payload.category,
            cadence=payload.cadence,
            start_date=payload.start_date,
            active=payload.active,
        )

    def delete_recurring_event(self, user_id: str, recurring_event_id: int) -> None:
        self._repository.delete(
            user_id=user_id,
            recurring_event_id=recurring_event_id,
        )

    @staticmethod
    def occurs_on(recurring_event: RecurringEventModel, reference_date: date) -> bool:
        if not recurring_event.active or reference_date < recurring_event.start_date:
            return False

        if recurring_event.cadence == "daily":
            return True

        if recurring_event.cadence == "weekly":
            delta_days = (reference_date - recurring_event.start_date).days
            return delta_days % 7 == 0

        month_distance = (
            (reference_date.year - recurring_event.start_date.year) * 12
            + reference_date.month
            - recurring_event.start_date.month
        )
        return month_distance >= 0 and reference_date.day == recurring_event.start_date.day
