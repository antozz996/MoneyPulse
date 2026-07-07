from sqlalchemy.orm import Session

from app.models import AccountModel
from app.repositories.accounts import AccountRepository
from app.schemas.accounts import AccountCreate, AccountUpdate


class AccountService:
    def __init__(self, session: Session) -> None:
        self._repository = AccountRepository(session)

    def list_accounts(self, user_id: str) -> list[AccountModel]:
        return self._repository.list_by_user(user_id)

    def create_account(self, user_id: str, payload: AccountCreate) -> AccountModel:
        return self._repository.create(
            user_id=user_id,
            name=payload.name,
            balance=payload.balance,
            currency=payload.currency.upper(),
        )

    def update_account(
        self,
        user_id: str,
        account_id: int,
        payload: AccountUpdate,
    ) -> AccountModel:
        return self._repository.update(
            user_id=user_id,
            account_id=account_id,
            name=payload.name,
            balance=payload.balance,
            currency=payload.currency.upper(),
        )

    def delete_account(self, user_id: str, account_id: int) -> None:
        self._repository.delete(user_id=user_id, account_id=account_id)
