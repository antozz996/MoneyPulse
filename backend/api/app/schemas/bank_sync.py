from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


BankProviderName = Literal["mock"]


class BankConnectStartCreate(BaseModel):
    provider: BankProviderName = "mock"
    institution_id: str | None = Field(default=None, max_length=255)


class BankConnectStartRead(BaseModel):
    connection_id: int
    provider: BankProviderName
    status: Literal["pending"]
    institution_name: str
    start_reference: str
    authorize_url: str


class BankConnectCompleteCreate(BaseModel):
    connection_id: int = Field(gt=0)


class BankConnectionRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    provider: BankProviderName
    status: str
    institution_name: str
    last_sync_at: datetime | None
    created_at: datetime
    linked_accounts: int


class BankSyncCreate(BaseModel):
    connection_id: int | None = Field(default=None, gt=0)


class BankSyncRead(BaseModel):
    connections_synced: int
    accounts_upserted: int
    imported_transactions: int
    duplicate_transactions: int
