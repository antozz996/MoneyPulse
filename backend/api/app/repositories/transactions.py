from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import not_found_error
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

    def get_for_user(self, user_id: str, transaction_id: int) -> TransactionModel:
        statement = select(TransactionModel).where(
            TransactionModel.user_id == user_id,
            TransactionModel.id == transaction_id,
        )
        transaction = self._session.scalar(statement)
        if transaction is None:
            raise not_found_error("transaction", transaction_id)
        return transaction

    def update(
        self,
        *,
        user_id: str,
        transaction_id: int,
        name: str,
        amount: float,
        currency: str,
        direction: str,
        category: str | None,
        effective_date: date,
    ) -> TransactionModel:
        transaction = self.get_for_user(user_id, transaction_id)
        transaction.name = name
        transaction.amount = amount
        transaction.currency = currency
        transaction.direction = direction
        transaction.category = category
        transaction.effective_date = effective_date
        self._session.commit()
        self._session.refresh(transaction)
        return transaction

    def delete(self, *, user_id: str, transaction_id: int) -> None:
        transaction = self.get_for_user(user_id, transaction_id)
        self._session.delete(transaction)
        self._session.commit()
