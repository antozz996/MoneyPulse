from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.accounts import AccountRead, normalize_currency
from app.schemas.bank_sync import BankConnectionRead
from app.schemas.budgets import BudgetRead
from app.schemas.goals import GoalRead
from app.schemas.recurring_events import RecurringEventRead
from app.schemas.transactions import TransactionRead


RiskProfile = Literal["CONSERVATIVE", "BALANCED", "AGGRESSIVE"]
CycleMode = Literal["SALARY_CYCLE", "CALENDAR_MONTH"]
CategoryType = Literal["income", "expense", "transfer"]
BudgetPeriod = Literal["MONTHLY", "SALARY_CYCLE"]


def normalize_locale(value: str) -> str:
    normalized = value.strip()
    if len(normalized) < 2:
        raise ValueError("Locale must contain at least 2 characters.")
    return normalized


class FinancialProfileRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str
    currency: str
    locale: str
    salary_day: int | None
    protected_balance: float
    risk_profile: RiskProfile
    default_cycle_mode: CycleMode
    status: str
    created_at: datetime
    updated_at: datetime


class FinancialProfileUpdate(BaseModel):
    currency: str = Field(min_length=3, max_length=3, default="EUR")
    locale: str = Field(min_length=2, max_length=16, default="en")
    salary_day: int | None = Field(default=None, ge=1, le=31)
    protected_balance: float = Field(ge=0, default=0)
    risk_profile: RiskProfile = "BALANCED"
    default_cycle_mode: CycleMode = "CALENDAR_MONTH"

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        return normalize_currency(value)

    @field_validator("locale")
    @classmethod
    def validate_locale(cls, value: str) -> str:
        return normalize_locale(value)


class CategoryRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str
    name: str
    key: str
    entry_type: CategoryType
    icon_key: str | None
    color_key: str | None
    is_system: bool
    status: str
    created_at: datetime
    updated_at: datetime


class FinancialDataRead(BaseModel):
    mode: Literal["api", "demo"]
    financial_profile: FinancialProfileRead
    categories: list[CategoryRead]
    budgets: list[BudgetRead]
    accounts: list[AccountRead]
    transactions: list[TransactionRead]
    recurring_events: list[RecurringEventRead]
    goals: list[GoalRead]
    bank_connections: list[BankConnectionRead]
