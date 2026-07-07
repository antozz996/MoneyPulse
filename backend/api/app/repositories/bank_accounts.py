from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import BankAccountModel


class BankAccountRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_by_connection(self, connection_id: int) -> list[BankAccountModel]:
        statement = (
            select(BankAccountModel)
            .where(BankAccountModel.bank_connection_id == connection_id)
            .order_by(BankAccountModel.id.asc())
        )
        return list(self._session.scalars(statement))

    def get_by_external_account(
        self,
        *,
        connection_id: int,
        external_account_id: str,
    ) -> BankAccountModel | None:
        statement = select(BankAccountModel).where(
            BankAccountModel.bank_connection_id == connection_id,
            BankAccountModel.external_account_id == external_account_id,
        )
        return self._session.scalar(statement)

    def create(
        self,
        *,
        user_id: str,
        connection_id: int,
        account_id: int,
        external_account_id: str,
        name: str,
        currency: str,
    ) -> BankAccountModel:
        bank_account = BankAccountModel(
            user_id=user_id,
            bank_connection_id=connection_id,
            account_id=account_id,
            external_account_id=external_account_id,
            name=name,
            currency=currency,
        )
        self._session.add(bank_account)
        self._session.commit()
        self._session.refresh(bank_account)
        return bank_account

    def update(
        self,
        bank_account: BankAccountModel,
        *,
        name: str,
        currency: str,
    ) -> BankAccountModel:
        bank_account.name = name
        bank_account.currency = currency
        self._session.commit()
        self._session.refresh(bank_account)
        return bank_account
