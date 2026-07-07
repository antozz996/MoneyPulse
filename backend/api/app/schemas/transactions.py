from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


TransactionDirection = Literal["income", "expense"]
TransactionCategory = Literal["essential", "committed"]


class TransactionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    amount: float = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3, default="EUR")
    direction: TransactionDirection
    category: TransactionCategory | None = None
    effective_date: date

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        normalized = value.strip()
        if not normalized:
            raise ValueError("Transaction name must not be empty.")
        return normalized

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        normalized = value.strip().upper()
        if len(normalized) != 3:
            raise ValueError("Currency must be a 3-letter code.")
        return normalized

    @model_validator(mode="after")
    def validate_category(self) -> "TransactionCreate":
        if self.direction == "income" and self.category is not None:
            raise ValueError("Income transactions cannot include an expense category.")
        if self.direction == "expense" and self.category is None:
            raise ValueError("Expense transactions must include a category.")
        return self


class TransactionUpdate(TransactionCreate):
    pass


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    amount: float
    currency: str
    direction: TransactionDirection
    category: TransactionCategory | None
    source: str
    effective_date: date
    created_at: datetime
