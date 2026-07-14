from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.schemas.accounts import normalize_currency, normalize_text
SupportedDelimiter = Literal[",", ";", "\t"]
CSVTransactionType = Literal["income", "expense"]


class ColumnMapping(BaseModel):
    model_config = ConfigDict(extra="forbid")

    date: str | None = None
    description: str | None = None
    merchant: str | None = None
    amount: str | None = None
    debit: str | None = None
    credit: str | None = None
    currency: str | None = None

    @field_validator("date", "description", "merchant", "amount", "debit", "credit", "currency")
    @classmethod
    def normalize_optional_value(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class ImportError(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_row_number: int | None = None
    code: str
    message: str


class CSVImportRow(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_row_number: int = Field(ge=1)
    date: date
    description: str = Field(min_length=1, max_length=255)
    merchant: str | None = Field(default=None, max_length=255)
    amount: float = Field(gt=0)
    type: CSVTransactionType
    account_id: int | None = Field(default=None, ge=1)
    category_id: int | None = Field(default=None, ge=1)
    suggested_category_id: int | None = Field(default=None, ge=1)
    currency: str = Field(min_length=3, max_length=3, default="EUR")
    selected: bool = True
    confidence: float = Field(ge=0, le=1)
    normalized_merchant: str | None = Field(default=None, max_length=255)
    explanation: str = Field(min_length=1, max_length=255)
    matched_rule_source: str = Field(min_length=1, max_length=32)
    needs_review: bool = False
    apply_to_similar: bool = False
    warnings: list[str] = Field(default_factory=list)
    duplicate_candidate: bool = False

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

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        return normalize_currency(value)


class CSVImportPreviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    filename: str = Field(min_length=1, max_length=255)
    content_base64: str = Field(min_length=1)
    mapping: ColumnMapping | None = None
    account_id: int | None = Field(default=None, ge=1)
    currency: str = Field(min_length=3, max_length=3, default="EUR")
    delimiter: SupportedDelimiter | None = None
    encoding: str | None = Field(default=None, max_length=32)

    @field_validator("filename")
    @classmethod
    def validate_filename(cls, value: str) -> str:
        return normalize_text(value)

    @field_validator("currency")
    @classmethod
    def validate_currency(cls, value: str) -> str:
        return normalize_currency(value)

    @field_validator("encoding")
    @classmethod
    def validate_encoding(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip().lower()
        return normalized or None


class CSVImportPreviewResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    batch_identifier: str
    filename: str
    detected_delimiter: SupportedDelimiter
    detected_encoding: str
    detected_mapping: ColumnMapping
    available_columns: list[str]
    rows: list[CSVImportRow]
    rejected_rows: list[ImportError]
    preview_fingerprint: str
    warnings: list[str] = Field(default_factory=list)
    generated_at: datetime


class CSVImportCommitRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    filename: str = Field(min_length=1, max_length=255)
    batch_identifier: str = Field(min_length=8, max_length=128)
    preview_fingerprint: str = Field(min_length=8, max_length=128)
    mapping: ColumnMapping
    rows: list[CSVImportRow]
    confirm_duplicate_candidates: bool = False

    @field_validator("filename")
    @classmethod
    def validate_filename(cls, value: str) -> str:
        return normalize_text(value)


class CSVImportCommitResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    batch_id: int | None
    batch_identifier: str
    imported_count: int
    skipped_count: int
    error_count: int
    warnings: list[str] = Field(default_factory=list)
