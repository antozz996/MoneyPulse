from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ImportedTransactionModel


class ImportedTransactionRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def exists(
        self,
        *,
        bank_account_id: int,
        external_transaction_id: str,
    ) -> bool:
        statement = select(ImportedTransactionModel.id).where(
            ImportedTransactionModel.bank_account_id == bank_account_id,
            ImportedTransactionModel.external_transaction_id == external_transaction_id,
        )
        return self._session.scalar(statement) is not None

    def create(
        self,
        *,
        user_id: str,
        bank_connection_id: int,
        bank_account_id: int,
        transaction_id: int,
        external_transaction_id: str,
    ) -> ImportedTransactionModel:
        imported_transaction = ImportedTransactionModel(
            user_id=user_id,
            bank_connection_id=bank_connection_id,
            bank_account_id=bank_account_id,
            transaction_id=transaction_id,
            external_transaction_id=external_transaction_id,
        )
        self._session.add(imported_transaction)
        self._session.commit()
        self._session.refresh(imported_transaction)
        return imported_transaction
