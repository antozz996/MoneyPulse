from datetime import datetime

from pydantic import BaseModel

from app.schemas.accounts import AccountRead
from app.schemas.auth import UserRead
from app.schemas.bank_sync import BankConnectionRead
from app.schemas.checkpoints import CheckpointRead
from app.schemas.goals import GoalRead
from app.schemas.recurring_events import RecurringEventRead
from app.schemas.transactions import TransactionRead


class UserDataExportRead(BaseModel):
    generated_at: datetime
    user: UserRead
    accounts: list[AccountRead]
    transactions: list[TransactionRead]
    goals: list[GoalRead]
    recurring_events: list[RecurringEventRead]
    checkpoints: list[CheckpointRead]
    bank_connections: list[BankConnectionRead]
