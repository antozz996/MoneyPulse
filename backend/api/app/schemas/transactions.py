from datetime import date as DateValue, datetime
from typing import Literal

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator, model_validator

from app.schemas.accounts import normalize_currency, normalize_text


TransactionType = Literal["income", "expense", "transfer"]
LegacyExpenseCategory = Literal["essential", "committed"]


class TransactionCreate(BaseModel):
    model_config = ConfigDict(extra="forbid", populate_by_name=True)

    account_id: int | None = Field(default=None, ge=1)
    category_id: int | None = Field(default=None, ge=1)
    amount: float = Field(gt=0)
    currency: str = Field(min_length=3, max_length=3, default="EUR")
    type: TransactionType = Field(validation_alias=AliasChoices("type", "direction"))
    date: DateValue = Field(validation_alias=AliasChoices("date", "effective_date"))
    description: str = Field(
        min_length=1,
        max_length=255,
        validation_alias=AliasChoices("description", "name"),
    )
    merchant: str | None = Field(default=None, max_length=255)
    legacy_category: LegacyExpenseCategory | None = Field(
        default=None,
        validation_alias="category",
        exclude=True,
    )

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
    type: TransactionType | None = Field(
        default=None,
        validation_alias=AliasChoices("type", "direction"),
    )
    date: DateValue | None = Field(
        default=None,
        validation_alias=AliasChoices("date", "effective_date"),
    )
    description: str | None = Field(
        default=None,
        min_length=1,
        max_length=255,
        validation_alias=AliasChoices("description", "name"),
    )
    merchant: str | None = Field(default=None, max_length=255)
    legacy_category: LegacyExpenseCategory | None = Field(
        default=None,
        validation_alias="category",
        exclude=True,
    )

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
    type: TransactionType = Field(validation_alias="direction")
    date: DateValue = Field(validation_alias="effective_date")
    description: str = Field(validation_alias="name")
    merchant: str | None
    source: str
    status: str
    created_at: datetime
    updated_at: datetime


class TransactionListResponse(BaseModel):
    items: list[TransactionRead]
    total: int
    limit: int
    offset: int
