from sqlalchemy import select
from sqlalchemy.orm import Session

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
