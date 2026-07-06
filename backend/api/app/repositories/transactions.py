from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import TransactionModel


class TransactionRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_by_user(self, user_id: str) -> list[TransactionModel]:
        statement = (
            select(TransactionModel)
            .where(TransactionModel.user_id == user_id)
            .order_by(TransactionModel.effective_date.asc(), TransactionModel.id.asc())
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
        effective_date: date,
    ) -> TransactionModel:
        transaction = TransactionModel(
            user_id=user_id,
            name=name,
            amount=amount,
            currency=currency,
            direction=direction,
            category=category,
            effective_date=effective_date,
        )
        self._session.add(transaction)
        self._session.commit()
        self._session.refresh(transaction)
        return transaction
