from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, date, datetime
from typing import Protocol


@dataclass(frozen=True)
class ProviderStartResponse:
    provider_reference: str
    authorize_url: str
    institution_name: str


@dataclass(frozen=True)
class ProviderBankAccount:
    external_account_id: str
    name: str
    currency: str
    balance: float


@dataclass(frozen=True)
class ProviderBankTransaction:
    external_transaction_id: str
    external_account_id: str
    description: str
    amount: float
    currency: str
    booked_date: date


@dataclass(frozen=True)
class ProviderCompleteResponse:
    external_connection_id: str
    institution_id: str | None
    institution_name: str
    accounts: list[ProviderBankAccount]


@dataclass(frozen=True)
class ProviderSyncResponse:
    accounts: list[ProviderBankAccount]
    transactions: list[ProviderBankTransaction]


class BankProvider(Protocol):
    provider_name: str

    def start_connection(
        self,
        *,
        user_id: str,
        institution_id: str | None,
    ) -> ProviderStartResponse:
        ...

    def complete_connection(
        self,
        *,
        provider_reference: str,
    ) -> ProviderCompleteResponse:
        ...

    def sync_connection(
        self,
        *,
        external_connection_id: str,
    ) -> ProviderSyncResponse:
        ...


class MockBankProvider:
    provider_name = "mock"

    def start_connection(
        self,
        *,
        user_id: str,
        institution_id: str | None,
    ) -> ProviderStartResponse:
        normalized_institution_id = institution_id or "mock-sandbox"
        provider_reference = f"mock-start::{user_id}::{normalized_institution_id}"
        return ProviderStartResponse(
            provider_reference=provider_reference,
            authorize_url=f"https://mock-bank.local/connect/{normalized_institution_id}",
            institution_name="Mock Bank Sandbox",
        )

    def complete_connection(
        self,
        *,
        provider_reference: str,
    ) -> ProviderCompleteResponse:
        _, user_id, institution_id = provider_reference.split("::", 2)
        external_connection_id = f"mock-connection::{user_id}::{institution_id}"
        return ProviderCompleteResponse(
            external_connection_id=external_connection_id,
            institution_id=institution_id,
            institution_name="Mock Bank Sandbox",
            accounts=self._accounts_for_connection(external_connection_id),
        )

    def sync_connection(
        self,
        *,
        external_connection_id: str,
    ) -> ProviderSyncResponse:
        accounts = self._accounts_for_connection(external_connection_id)
        today = datetime.now(UTC).date()

        return ProviderSyncResponse(
            accounts=accounts,
            transactions=[
                ProviderBankTransaction(
                    external_transaction_id=f"{external_connection_id}::chk::salary::{today.isoformat()}",
                    external_account_id=f"{external_connection_id}::checking",
                    description="Mock payroll",
                    amount=2200,
                    currency="EUR",
                    booked_date=today,
                ),
                ProviderBankTransaction(
                    external_transaction_id=f"{external_connection_id}::chk::groceries::{today.isoformat()}",
                    external_account_id=f"{external_connection_id}::checking",
                    description="Mock groceries",
                    amount=-48.5,
                    currency="EUR",
                    booked_date=today,
                ),
                ProviderBankTransaction(
                    external_transaction_id=f"{external_connection_id}::sav::transfer::{today.isoformat()}",
                    external_account_id=f"{external_connection_id}::savings",
                    description="Mock transfer",
                    amount=-75,
                    currency="EUR",
                    booked_date=today,
                ),
            ],
        )

    def _accounts_for_connection(
        self,
        external_connection_id: str,
    ) -> list[ProviderBankAccount]:
        return [
            ProviderBankAccount(
                external_account_id=f"{external_connection_id}::checking",
                name="Mock checking",
                currency="EUR",
                balance=1850,
            ),
            ProviderBankAccount(
                external_account_id=f"{external_connection_id}::savings",
                name="Mock savings",
                currency="EUR",
                balance=900,
            ),
        ]
