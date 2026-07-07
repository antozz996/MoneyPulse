from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import not_found_error
from app.models import AccountModel


class AccountRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_by_user(self, user_id: str) -> list[AccountModel]:
        statement = (
            select(AccountModel)
            .where(AccountModel.user_id == user_id)
            .order_by(AccountModel.id.asc())
        )
        return list(self._session.scalars(statement))

    def create(
        self,
        *,
        user_id: str,
        name: str,
        balance: float,
        currency: str,
    ) -> AccountModel:
        account = AccountModel(
            user_id=user_id,
            name=name,
            balance=balance,
            currency=currency,
        )
        self._session.add(account)
        self._session.commit()
        self._session.refresh(account)
        return account

    def get_for_user(self, user_id: str, account_id: int) -> AccountModel:
        statement = select(AccountModel).where(
            AccountModel.user_id == user_id,
            AccountModel.id == account_id,
        )
        account = self._session.scalar(statement)
        if account is None:
            raise not_found_error("account", account_id)
        return account

    def update(
        self,
        *,
        user_id: str,
        account_id: int,
        name: str,
        balance: float,
        currency: str,
    ) -> AccountModel:
        account = self.get_for_user(user_id, account_id)
        account.name = name
        account.balance = balance
        account.currency = currency
        self._session.commit()
        self._session.refresh(account)
        return account

    def delete(self, *, user_id: str, account_id: int) -> None:
        account = self.get_for_user(user_id, account_id)
        self._session.delete(account)
        self._session.commit()
