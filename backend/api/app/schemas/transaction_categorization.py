from datetime import date as DateValue
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.accounts import normalize_text
from app.schemas.transactions import TransactionType


CategorizationMatchType = Literal["exact", "contains", "prefix"]
CategorizationMatchSource = Literal[
    "explicit",
    "user_rule_exact",
    "merchant_alias",
    "user_rule_partial",
    "history",
    "system_rule",
    "fallback",
]


class TransactionCategorizationInputRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_row_number: int | None = Field(default=None, ge=1)
    description: str = Field(min_length=1, max_length=255)
    merchant: str | None = Field(default=None, max_length=255)
    amount: float | None = Field(default=None, gt=0)
    type: TransactionType
    date: DateValue | None = None
    account_id: int | None = Field(default=None, ge=1)
    category_id: int | None = Field(default=None, ge=1)
    currency: str | None = Field(default=None, min_length=3, max_length=3)

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


class TransactionCategorizationRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[TransactionCategorizationInputRow] = Field(min_length=1, max_length=50)


class TransactionCategorizationSuggestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_row_number: int | None = Field(default=None, ge=1)
    suggested_category_id: int | None = Field(default=None, ge=1)
    normalized_merchant: str | None = None
    confidence: float = Field(ge=0, le=1)
    matched_rule_source: CategorizationMatchSource
    explanation: str
    needs_review: bool = False
    warnings: list[str] = Field(default_factory=list)


class TransactionCategorizationResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    items: list[TransactionCategorizationSuggestion]


class TransactionCategorizationFeedbackRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    confirmed_category_id: int = Field(ge=1)
    confirmed_merchant: str | None = Field(default=None, max_length=255)
    apply_to_similar: bool = False

    @field_validator("confirmed_merchant")
    @classmethod
    def validate_confirmed_merchant(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class TransactionRecategorizeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    commit: bool = False
    overwrite_existing: bool = False
    limit: int = Field(default=25, ge=1, le=100)


class TransactionRecategorizeItem(BaseModel):
    model_config = ConfigDict(extra="forbid")

    transaction_id: int
    description: str
    merchant: str | None
    previous_category_id: int | None = None
    suggested_category_id: int | None = None
    normalized_merchant: str | None = None
    confidence: float = Field(ge=0, le=1)
    explanation: str
    needs_review: bool
    updated: bool = False


class TransactionRecategorizeResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    commit: bool
    evaluated_count: int
    updated_count: int
    items: list[TransactionRecategorizeItem]
