from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, model_validator


TransactionDirection = Literal["income", "expense"]
TransactionCategory = Literal["essential", "committed"]


class TransactionCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    amount: float = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3, default="EUR")
    direction: TransactionDirection
    category: TransactionCategory | None = None
    effective_date: date

    @model_validator(mode="after")
    def validate_category(self) -> "TransactionCreate":
        if self.direction == "income" and self.category is not None:
            raise ValueError("Income transactions cannot include an expense category.")
        if self.direction == "expense" and self.category is None:
            raise ValueError("Expense transactions must include a category.")
        return self


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    amount: float
    currency: str
    direction: TransactionDirection
    category: TransactionCategory | None
    effective_date: date
    created_at: datetime
