from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import not_found_error
from app.models import RecurringEventModel


class RecurringEventRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_by_user(self, user_id: str) -> list[RecurringEventModel]:
        statement = (
            select(RecurringEventModel)
            .where(RecurringEventModel.user_id == user_id)
            .order_by(RecurringEventModel.start_date.asc(), RecurringEventModel.id.asc())
        )
        return list(self._session.scalars(statement))

    def create(
        self,
        *,
        user_id: str,
        name: str,
        amount: float,
        currency: str,
        direction: str,
        category: str | None,
        cadence: str,
        start_date,
        active: bool,
    ) -> RecurringEventModel:
        recurring_event = RecurringEventModel(
            user_id=user_id,
            name=name,
            amount=amount,
            currency=currency,
            direction=direction,
            category=category,
            cadence=cadence,
            start_date=start_date,
            active=active,
        )
        self._session.add(recurring_event)
        self._session.commit()
        self._session.refresh(recurring_event)
        return recurring_event

    def get_for_user(self, user_id: str, recurring_event_id: int) -> RecurringEventModel:
        statement = select(RecurringEventModel).where(
            RecurringEventModel.user_id == user_id,
            RecurringEventModel.id == recurring_event_id,
        )
        recurring_event = self._session.scalar(statement)
        if recurring_event is None:
            raise not_found_error("recurring_event", recurring_event_id)
        return recurring_event

    def update(
        self,
        *,
        user_id: str,
        recurring_event_id: int,
        name: str,
        amount: float,
        currency: str,
        direction: str,
        category: str | None,
        cadence: str,
        start_date,
        active: bool,
    ) -> RecurringEventModel:
        recurring_event = self.get_for_user(user_id, recurring_event_id)
        recurring_event.name = name
        recurring_event.amount = amount
        recurring_event.currency = currency
        recurring_event.direction = direction
        recurring_event.category = category
        recurring_event.cadence = cadence
        recurring_event.start_date = start_date
        recurring_event.active = active
        self._session.commit()
        self._session.refresh(recurring_event)
        return recurring_event

    def delete(self, *, user_id: str, recurring_event_id: int) -> None:
        recurring_event = self.get_for_user(user_id, recurring_event_id)
        self._session.delete(recurring_event)
        self._session.commit()
