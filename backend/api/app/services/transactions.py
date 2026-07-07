from sqlalchemy.orm import Session

from app.models import TransactionModel
from app.repositories.transactions import TransactionRepository
from app.schemas.transactions import TransactionCreate, TransactionUpdate


class TransactionService:
    def __init__(self, session: Session) -> None:
        self._repository = TransactionRepository(session)

    def list_transactions(self, user_id: str) -> list[TransactionModel]:
        return self._repository.list_by_user(user_id)

    def create_transaction(
        self,
        user_id: str,
        payload: TransactionCreate,
    ) -> TransactionModel:
        return self._repository.create(
            user_id=user_id,
            name=payload.name,
            amount=payload.amount,
            currency=payload.currency.upper(),
            direction=payload.direction,
            category=payload.category,
            effective_date=payload.effective_date,
            source="manual",
        )

    def update_transaction(
        self,
        user_id: str,
        transaction_id: int,
        payload: TransactionUpdate,
    ) -> TransactionModel:
        return self._repository.update(
            user_id=user_id,
            transaction_id=transaction_id,
            name=payload.name,
            amount=payload.amount,
            currency=payload.currency.upper(),
            direction=payload.direction,
            category=payload.category,
            effective_date=payload.effective_date,
        )

    def delete_transaction(self, user_id: str, transaction_id: int) -> None:
        self._repository.delete(user_id=user_id, transaction_id=transaction_id)
