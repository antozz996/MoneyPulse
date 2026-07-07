from __future__ import annotations

from datetime import UTC, datetime

from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from app.models import (
    AccountModel,
    BankAccountModel,
    BankConnectionModel,
    CheckpointModel,
    GoalModel,
    ImportedTransactionModel,
    RecurringEventModel,
    TransactionModel,
    UserModel,
)
from app.repositories.accounts import AccountRepository
from app.repositories.bank_accounts import BankAccountRepository
from app.repositories.checkpoints import CheckpointRepository
from app.repositories.goals import GoalRepository
from app.repositories.recurring_events import RecurringEventRepository
from app.repositories.transactions import TransactionRepository
from app.repositories.users import UserRepository
from app.schemas.accounts import AccountRead
from app.schemas.auth import UserRead
from app.schemas.bank_sync import BankConnectionRead
from app.schemas.checkpoints import CheckpointRead
from app.schemas.goals import GoalRead
from app.schemas.me import UserDataExportRead
from app.schemas.recurring_events import RecurringEventRead
from app.schemas.transactions import TransactionRead


class MeService:
    def __init__(self, session: Session) -> None:
        self._session = session
        self._users = UserRepository(session)
        self._accounts = AccountRepository(session)
        self._transactions = TransactionRepository(session)
        self._goals = GoalRepository(session)
        self._recurring_events = RecurringEventRepository(session)
        self._checkpoints = CheckpointRepository(session)
        self._bank_accounts = BankAccountRepository(session)

    def export_user_data(self, user_id: str) -> UserDataExportRead:
        user = self._users.get_by_id(user_id)
        accounts = self._accounts.list_by_user(user_id)
        transactions = self._transactions.list_by_user(user_id)
        goals = self._goals.list_by_user(user_id)
        recurring_events = self._recurring_events.list_by_user(user_id)
        checkpoints = self._checkpoints.list_by_user(user_id)
        bank_connections = list(
            self._session.scalars(
                select(BankConnectionModel)
                .where(BankConnectionModel.user_id == user_id)
                .order_by(BankConnectionModel.created_at.asc(), BankConnectionModel.id.asc())
            )
        )

        return UserDataExportRead(
            generated_at=datetime.now(UTC),
            user=UserRead.model_validate(user, from_attributes=True),
            accounts=[
                AccountRead.model_validate(account, from_attributes=True)
                for account in accounts
            ],
            transactions=[
                TransactionRead.model_validate(transaction, from_attributes=True)
                for transaction in transactions
            ],
            goals=[GoalRead.model_validate(goal, from_attributes=True) for goal in goals],
            recurring_events=[
                RecurringEventRead.model_validate(recurring_event, from_attributes=True)
                for recurring_event in recurring_events
            ],
            checkpoints=[
                CheckpointRead.model_validate(checkpoint, from_attributes=True)
                for checkpoint in checkpoints
            ],
            bank_connections=[
                BankConnectionRead(
                    id=connection.id,
                    provider=connection.provider,
                    status=connection.status,
                    institution_name=connection.institution_name,
                    last_sync_at=connection.last_sync_at,
                    created_at=connection.created_at,
                    linked_accounts=len(
                        self._bank_accounts.list_by_connection(connection.id)
                    ),
                )
                for connection in bank_connections
            ],
        )

    def delete_user_account(self, user_id: str) -> None:
        self._users.get_by_id(user_id)

        self._session.execute(
            delete(ImportedTransactionModel).where(
                ImportedTransactionModel.user_id == user_id
            )
        )
        self._session.execute(
            delete(BankAccountModel).where(BankAccountModel.user_id == user_id)
        )
        self._session.execute(
            delete(BankConnectionModel).where(BankConnectionModel.user_id == user_id)
        )
        self._session.execute(
            delete(CheckpointModel).where(CheckpointModel.user_id == user_id)
        )
        self._session.execute(
            delete(RecurringEventModel).where(RecurringEventModel.user_id == user_id)
        )
        self._session.execute(delete(GoalModel).where(GoalModel.user_id == user_id))
        self._session.execute(
            delete(TransactionModel).where(TransactionModel.user_id == user_id)
        )
        self._session.execute(delete(AccountModel).where(AccountModel.user_id == user_id))
        self._session.execute(delete(UserModel).where(UserModel.id == user_id))
        self._session.commit()
