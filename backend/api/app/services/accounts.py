from sqlalchemy.orm import Session

from app.models import AccountModel
from app.repositories.accounts import AccountRepository
from app.schemas.accounts import AccountCreate


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
