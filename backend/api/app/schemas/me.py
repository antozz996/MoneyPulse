from datetime import datetime

from pydantic import BaseModel, Field

from app.schemas.accounts import AccountRead
from app.schemas.auth import UserRead
from app.schemas.bank_sync import BankConnectionRead
from app.schemas.budgets import BudgetRead
from app.schemas.checkpoints import CheckpointRead
from app.schemas.financial_data import CategoryRead, FinancialProfileRead
from app.schemas.goals import GoalRead
from app.schemas.recurring_events import RecurringEventRead
from app.schemas.transactions import TransactionRead


class UserDataExportRead(BaseModel):
    generated_at: datetime
    user: UserRead
    financial_profile: FinancialProfileRead | None = None
    categories: list[CategoryRead] = Field(default_factory=list)
    budgets: list[BudgetRead] = Field(default_factory=list)
    accounts: list[AccountRead]
    transactions: list[TransactionRead]
    goals: list[GoalRead]
    recurring_events: list[RecurringEventRead]
    checkpoints: list[CheckpointRead]
    bank_connections: list[BankConnectionRead]
