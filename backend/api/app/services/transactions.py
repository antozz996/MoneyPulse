from sqlalchemy.orm import Session

from app.errors import validation_error
from app.repositories.accounts import AccountRepository
from app.repositories.categories import CategoryRepository
from app.models import TransactionModel
from app.repositories.transactions import TransactionRepository
from app.schemas.transactions import (
    TransactionCreate,
    TransactionListResponse,
    TransactionRead,
    TransactionUpdate,
)


class TransactionService:
    def __init__(self, session: Session) -> None:
        self._repository = TransactionRepository(session)
        self._accounts = AccountRepository(session)
        self._categories = CategoryRepository(session)

    def list_transactions(
        self,
        user_id: str,
        *,
        date_from=None,
        date_to=None,
        transaction_type: str | None = None,
        account_id: int | None = None,
        category_id: int | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> TransactionListResponse:
        transactions, total = self._repository.list_page_for_user(
            user_id,
            date_from=date_from,
            date_to=date_to,
            transaction_type=transaction_type,
            account_id=account_id,
            category_id=category_id,
            limit=limit,
            offset=offset,
        )
        return TransactionListResponse(
            items=[
                TransactionRead.model_validate(transaction, from_attributes=True)
                for transaction in transactions
            ],
            total=total,
            limit=limit,
            offset=offset,
        )

    def create_transaction(
        self,
        user_id: str,
        payload: TransactionCreate,
    ) -> TransactionModel:
        resolved_account_id, resolved_category_id = self._validate_relations(
            user_id,
            account_id=payload.account_id,
            category_id=payload.category_id,
            transaction_type=payload.type,
        )
        return self._repository.create(
            user_id=user_id,
            account_id=resolved_account_id,
            category_id=resolved_category_id,
            description=payload.description,
            amount=payload.amount,
            currency=payload.currency.upper(),
            transaction_type=payload.type,
            transaction_category=self._derive_internal_category(
                payload.type,
                legacy_category=payload.legacy_category,
            ),
            merchant=payload.merchant,
            transaction_date=payload.date,
            source="manual",
        )

    def update_transaction(
        self,
        user_id: str,
        transaction_id: int,
        payload: TransactionUpdate,
    ) -> TransactionModel:
        existing_transaction = self._repository.get_for_user(user_id, transaction_id)
        resolved_type = payload.type or existing_transaction.direction
        resolved_account_id, resolved_category_id = self._validate_relations(
            user_id,
            account_id=payload.account_id
            if "account_id" in payload.model_fields_set
            else existing_transaction.account_id,
            category_id=payload.category_id
            if "category_id" in payload.model_fields_set
            else existing_transaction.category_id,
            transaction_type=resolved_type,
        )
        return self._repository.update(
            user_id=user_id,
            transaction_id=transaction_id,
            account_id=resolved_account_id,
            category_id=resolved_category_id,
            description=payload.description,
            amount=payload.amount,
            currency=payload.currency.upper() if payload.currency else None,
            transaction_type=payload.type,
            transaction_category=(
                self._derive_internal_category(
                    resolved_type,
                    legacy_category=payload.legacy_category,
                )
                if payload.type is not None or payload.legacy_category is not None
                else None
            ),
            transaction_date=payload.date,
            merchant=payload.merchant if "merchant" in payload.model_fields_set else existing_transaction.merchant,
        )

    def delete_transaction(self, user_id: str, transaction_id: int) -> None:
        self._repository.delete(user_id=user_id, transaction_id=transaction_id)

    def _validate_relations(
        self,
        user_id: str,
        *,
        account_id: int | None,
        category_id: int | None,
        transaction_type: str,
    ) -> tuple[int | None, int | None]:
        existing_accounts = self._accounts.list_by_user(user_id)

        if existing_accounts and account_id is None:
            if len(existing_accounts) == 1:
                account_id = existing_accounts[0].id
            else:
                raise validation_error(
                    "account_id is required when multiple accounts exist.",
                    {"field": "account_id"},
                )

        if account_id is not None:
            self._accounts.get_for_user(user_id, account_id)

        if category_id is not None:
            category = self._categories.get_for_user(user_id, category_id)
            if transaction_type == "transfer":
                raise validation_error(
                    "Transfers do not support category_id.",
                    {"field": "category_id"},
                )
            if category.entry_type != transaction_type:
                raise validation_error(
                    "category_id does not match the transaction type.",
                    {"field": "category_id"},
                )

        return account_id, category_id

    def _derive_internal_category(
        self,
        transaction_type: str,
        *,
        legacy_category: str | None = None,
    ) -> str | None:
        if legacy_category is not None:
            return legacy_category

        if transaction_type == "expense":
            # Until we add explicit expense-classification UX, manual expenses use the
            # same conservative committed classification already used by imported spend.
            return "committed"

        return None
