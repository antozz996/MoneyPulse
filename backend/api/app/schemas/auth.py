from __future__ import annotations

from datetime import datetime
import re

from pydantic import BaseModel, Field, field_validator


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _require_text(value: str, *, label: str) -> str:
    normalized = value.strip()
    if not normalized:
        raise ValueError(f"{label} must not be empty.")
    return normalized


class UserRead(BaseModel):
    id: str
    name: str
    email: str
    created_at: datetime


class RegisterUserCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=8, max_length=255)

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        return _require_text(value, label="Name")

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = _require_text(value, label="Email").lower()
        if not EMAIL_PATTERN.match(normalized):
            raise ValueError("Email must be valid.")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _require_text(value, label="Password")


class LoginCreate(BaseModel):
    email: str = Field(min_length=3, max_length=255)
    password: str = Field(min_length=1, max_length=255)

    @field_validator("email")
    @classmethod
    def validate_email(cls, value: str) -> str:
        normalized = _require_text(value, label="Email").lower()
        if not EMAIL_PATTERN.match(normalized):
            raise ValueError("Email must be valid.")
        return normalized

    @field_validator("password")
    @classmethod
    def validate_password(cls, value: str) -> str:
        return _require_text(value, label="Password")


class AuthSessionRead(BaseModel):
    access_token: str
    token_type: str
    expires_in_seconds: int
    user: UserRead
