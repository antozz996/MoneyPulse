from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime

from sqlalchemy.orm import Session

from app.errors import validation_error
from app.models import AccountModel, BankConnectionModel
from app.repositories.accounts import AccountRepository
from app.repositories.bank_accounts import BankAccountRepository
from app.repositories.bank_connections import BankConnectionRepository
from app.repositories.imported_transactions import ImportedTransactionRepository
from app.repositories.transactions import TransactionRepository
from app.schemas.bank_sync import (
    BankConnectCompleteCreate,
    BankConnectStartCreate,
    BankConnectStartRead,
    BankConnectionRead,
    BankSyncCreate,
    BankSyncRead,
)
from app.services.bank_providers import (
    BankProvider,
    ProviderBankAccount,
    ProviderBankTransaction,
)


@dataclass(frozen=True)
class BankSyncProviders:
    providers: dict[str, BankProvider]

    def get(self, provider_name: str) -> BankProvider:
        provider = self.providers.get(provider_name)
        if provider is None:
            raise validation_error(f"Unsupported bank provider: {provider_name}.")
        return provider


class BankSyncService:
    def __init__(self, session: Session, providers: BankSyncProviders) -> None:
        self._session = session
        self._providers = providers
        self._accounts = AccountRepository(session)
        self._transactions = TransactionRepository(session)
        self._bank_connections = BankConnectionRepository(session)
        self._bank_accounts = BankAccountRepository(session)
        self._imported_transactions = ImportedTransactionRepository(session)

    def start_connection(
        self,
        user_id: str,
        payload: BankConnectStartCreate,
    ) -> BankConnectStartRead:
        provider = self._providers.get(payload.provider)
        started = provider.start_connection(
            user_id=user_id,
            institution_id=payload.institution_id,
        )
        connection = self._bank_connections.create_pending(
            user_id=user_id,
            provider=payload.provider,
            institution_id=payload.institution_id,
            institution_name=started.institution_name,
            connection_reference=started.provider_reference,
        )
        return BankConnectStartRead(
            connection_id=connection.id,
            provider=payload.provider,
            status="pending",
            institution_name=started.institution_name,
            start_reference=started.provider_reference,
            authorize_url=started.authorize_url,
        )

    def complete_connection(
        self,
        user_id: str,
        payload: BankConnectCompleteCreate,
    ) -> BankConnectionRead:
        connection = self._bank_connections.get_for_user(user_id, payload.connection_id)
        provider = self._providers.get(connection.provider)
        completed = provider.complete_connection(
            provider_reference=connection.connection_reference,
        )
        connection = self._bank_connections.activate(
            connection,
            institution_id=completed.institution_id,
            institution_name=completed.institution_name,
            external_connection_id=completed.external_connection_id,
        )
        for provider_account in completed.accounts:
            self._upsert_bank_account(user_id, connection, provider_account)

        return self._serialize_connection(connection)

    def list_connections(self, user_id: str) -> list[BankConnectionRead]:
        return [
            self._serialize_connection(connection)
            for connection in self._bank_connections.list_visible_by_user(user_id)
        ]

    def delete_connection(self, user_id: str, connection_id: int) -> None:
        connection = self._bank_connections.get_for_user(user_id, connection_id)
        self._bank_connections.disconnect(connection)

    def sync(self, user_id: str, payload: BankSyncCreate) -> BankSyncRead:
        if payload.connection_id is None:
            connections = self._bank_connections.list_active_by_user(user_id)
        else:
            connection = self._bank_connections.get_for_user(user_id, payload.connection_id)
            if connection.status != "active":
                raise validation_error("Only active bank connections can be synced.")
            connections = [connection]

        if not connections:
            raise validation_error("No active bank connections are available to sync.")

        accounts_upserted = 0
        imported_transactions = 0
        duplicate_transactions = 0
        synced_at = datetime.now(UTC)

        for connection in connections:
            provider = self._providers.get(connection.provider)
            if not connection.external_connection_id:
                raise validation_error("Bank connection is missing an external reference.")

            synced = provider.sync_connection(
                external_connection_id=connection.external_connection_id,
            )
            for provider_account in synced.accounts:
                self._upsert_bank_account(user_id, connection, provider_account)
                accounts_upserted += 1

            for provider_transaction in synced.transactions:
                if self._import_transaction(user_id, connection, provider_transaction):
                    imported_transactions += 1
                else:
                    duplicate_transactions += 1

            self._bank_connections.mark_synced(connection, synced_at=synced_at)

        return BankSyncRead(
            connections_synced=len(connections),
            accounts_upserted=accounts_upserted,
            imported_transactions=imported_transactions,
            duplicate_transactions=duplicate_transactions,
        )

    def _upsert_bank_account(
        self,
        user_id: str,
        connection: BankConnectionModel,
        provider_account: ProviderBankAccount,
    ):
        existing_mapping = self._bank_accounts.get_by_external_account(
            connection_id=connection.id,
            external_account_id=provider_account.external_account_id,
        )
        if existing_mapping is None:
            internal_account = self._accounts.create(
                user_id=user_id,
                name=provider_account.name,
                balance=provider_account.balance,
                currency=provider_account.currency.upper(),
                source="bank_import",
            )
            return self._bank_accounts.create(
                user_id=user_id,
                connection_id=connection.id,
                account_id=internal_account.id,
                external_account_id=provider_account.external_account_id,
                name=provider_account.name,
                currency=provider_account.currency.upper(),
            )

        internal_account = self._accounts.update_bank_account(
            user_id=user_id,
            account_id=existing_mapping.account_id,
            name=provider_account.name,
            balance=provider_account.balance,
            currency=provider_account.currency.upper(),
        )
        return self._bank_accounts.update(
            existing_mapping,
            name=internal_account.name,
            currency=internal_account.currency,
        )

    def _import_transaction(
        self,
        user_id: str,
        connection: BankConnectionModel,
        provider_transaction: ProviderBankTransaction,
    ) -> bool:
        bank_account = self._bank_accounts.get_by_external_account(
            connection_id=connection.id,
            external_account_id=provider_transaction.external_account_id,
        )
        if bank_account is None:
            raise validation_error("Bank account mapping is missing for imported transactions.")

        if self._imported_transactions.exists(
            bank_account_id=bank_account.id,
            external_transaction_id=provider_transaction.external_transaction_id,
        ):
            return False

        direction = "income" if provider_transaction.amount >= 0 else "expense"
        normalized_amount = round(abs(provider_transaction.amount), 2)

        transaction = self._transactions.create(
            user_id=user_id,
            name=provider_transaction.description,
            amount=normalized_amount,
            currency=provider_transaction.currency.upper(),
            direction=direction,
            # Imported bank expenses are normalized as committed because the mock
            # provider foundation does not classify essentials.
            category="committed" if direction == "expense" else None,
            effective_date=provider_transaction.booked_date,
            source="bank_import",
        )
        self._imported_transactions.create(
            user_id=user_id,
            bank_connection_id=connection.id,
            bank_account_id=bank_account.id,
            transaction_id=transaction.id,
            external_transaction_id=provider_transaction.external_transaction_id,
        )
        return True

    def _serialize_connection(self, connection: BankConnectionModel) -> BankConnectionRead:
        linked_accounts = len(self._bank_accounts.list_by_connection(connection.id))
        return BankConnectionRead(
            id=connection.id,
            provider=connection.provider,
            status=connection.status,
            institution_name=connection.institution_name,
            last_sync_at=connection.last_sync_at,
            created_at=connection.created_at,
            linked_accounts=linked_accounts,
        )
