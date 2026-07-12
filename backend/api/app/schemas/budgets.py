from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.accounts import normalize_currency


BudgetPeriod = Literal["MONTHLY", "SALARY_CYCLE"]


class BudgetCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category_id: int = Field(ge=1)
    amount: float = Field(ge=0)
    currency: str = Field(min_length=3, max_length=3, default="EUR")
    period: BudgetPeriod = "MONTHLY"
    status: str = Field(min_length=1, max_length=32, default="active")

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        return normalize_currency(value)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str) -> str:
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("Budget status must not be empty.")
        return normalized


class BudgetUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category_id: int | None = Field(default=None, ge=1)
    amount: float | None = Field(default=None, ge=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    period: BudgetPeriod | None = None
    status: str | None = Field(default=None, min_length=1, max_length=32)

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return normalize_currency(value)

    @field_validator("status")
    @classmethod
    def validate_status(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        if not normalized:
            raise ValueError("Budget status must not be empty.")
        return normalized


class BudgetRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    user_id: str
    category_id: int | None
    amount: float
    currency: str
    period: BudgetPeriod
    status: str
    created_at: datetime
    updated_at: datetime
