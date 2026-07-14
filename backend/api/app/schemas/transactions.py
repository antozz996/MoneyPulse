from datetime import date as DateValue, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.accounts import normalize_currency, normalize_text


TransactionType = Literal["income", "expense", "transfer"]
LegacyExpenseCategory = Literal["essential", "committed"]


class TransactionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    account_id: int | None = Field(default=None, ge=1)
    category_id: int | None = Field(default=None, ge=1)
    amount: float = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3, default="EUR")
    type: TransactionType
    date: DateValue
    description: str = Field(min_length=1, max_length=255)
    merchant: str | None = Field(default=None, max_length=255)
    legacy_category: LegacyExpenseCategory | None = Field(default=None)

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_aliases(cls, raw_value: object) -> object:
        if not isinstance(raw_value, dict):
            return raw_value

        normalized = dict(raw_value)
        if "type" not in normalized and "direction" in normalized:
            normalized["type"] = normalized.pop("direction")
        if "date" not in normalized and "effective_date" in normalized:
            normalized["date"] = normalized.pop("effective_date")
        if "description" not in normalized and "name" in normalized:
            normalized["description"] = normalized.pop("name")
        if "legacy_category" not in normalized and "category" in normalized:
            normalized["legacy_category"] = normalized.pop("category")
        return normalized

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        return normalize_currency(value)

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str) -> str:
        return normalize_text(value)

    @field_validator("merchant")
    @classmethod
    def validate_merchant(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized = value.strip()
        return normalized or None

    @model_validator(mode="after")
    def validate_legacy_category(self) -> "TransactionCreate":
        if self.legacy_category is not None and self.type != "expense":
            raise ValueError("Legacy expense category is supported only for expense transactions.")
        return self


class TransactionUpdate(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    account_id: int | None = Field(default=None, ge=1)
    category_id: int | None = Field(default=None, ge=1)
    amount: float | None = Field(default=None, gt=0)
    currency: str | None = Field(default=None, min_length=3, max_length=3)
    type: TransactionType | None = None
    date: DateValue | None = None
    description: str | None = Field(default=None, min_length=1, max_length=255)
    merchant: str | None = Field(default=None, max_length=255)
    legacy_category: LegacyExpenseCategory | None = Field(default=None)

    @model_validator(mode="before")
    @classmethod
    def normalize_legacy_aliases(cls, raw_value: object) -> object:
        if not isinstance(raw_value, dict):
            return raw_value

        normalized = dict(raw_value)
        if "type" not in normalized and "direction" in normalized:
            normalized["type"] = normalized.pop("direction")
        if "date" not in normalized and "effective_date" in normalized:
            normalized["date"] = normalized.pop("effective_date")
        if "description" not in normalized and "name" in normalized:
            normalized["description"] = normalized.pop("name")
        if "legacy_category" not in normalized and "category" in normalized:
            normalized["legacy_category"] = normalized.pop("category")
        return normalized

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return normalize_currency(value)

    @field_validator("description")
    @classmethod
    def validate_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return normalize_text(value)

    @field_validator("merchant")
    @classmethod
    def validate_merchant(cls, value: str | None) -> str | None:
        if value is None:
            return None

        normalized = value.strip()
        return normalized or None

    @model_validator(mode="after")
    def validate_not_empty(self) -> "TransactionUpdate":
        if not self.model_fields_set:
            raise ValueError("At least one field must be provided.")
        if self.legacy_category is not None and self.type not in (None, "expense"):
            raise ValueError("Legacy expense category is supported only for expense transactions.")
        return self


class TransactionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    account_id: int | None
    category_id: int | None
    amount: float
    currency: str
    type: TransactionType
    date: DateValue
    description: str
    merchant: str | None
    source: str
    status: str
    created_at: datetime
    updated_at: datetime

    @model_validator(mode="before")
    @classmethod
    def normalize_read_aliases(cls, raw_value: object) -> object:
        if isinstance(raw_value, dict):
            normalized = dict(raw_value)
            if "type" not in normalized and "direction" in normalized:
                normalized["type"] = normalized.pop("direction")
            if "date" not in normalized and "effective_date" in normalized:
                normalized["date"] = normalized.pop("effective_date")
            if "description" not in normalized and "name" in normalized:
                normalized["description"] = normalized.pop("name")
            return normalized

        if raw_value is None:
            return raw_value

        return {
            "id": getattr(raw_value, "id"),
            "account_id": getattr(raw_value, "account_id"),
            "category_id": getattr(raw_value, "category_id"),
            "amount": getattr(raw_value, "amount"),
            "currency": getattr(raw_value, "currency"),
            "type": getattr(raw_value, "direction"),
            "date": getattr(raw_value, "effective_date"),
            "description": getattr(raw_value, "name"),
            "merchant": getattr(raw_value, "merchant"),
            "source": getattr(raw_value, "source"),
            "status": getattr(raw_value, "status"),
            "created_at": getattr(raw_value, "created_at"),
            "updated_at": getattr(raw_value, "updated_at"),
        }


class TransactionListResponse(BaseModel):
    items: list[TransactionRead]
    total: int
    limit: int
    offset: int
