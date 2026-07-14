from sqlalchemy.orm import Session

from app.errors import validation_error
from app.models import TransactionModel
from app.repositories.accounts import AccountRepository
from app.repositories.categories import CategoryRepository
from app.repositories.transactions import TransactionRepository
from app.schemas.transaction_categorization import (
    TransactionCategorizationFeedbackRequest,
    TransactionCategorizationRequest,
    TransactionCategorizationResponse,
    TransactionCategorizationSuggestion,
    TransactionRecategorizeItem,
    TransactionRecategorizeRequest,
    TransactionRecategorizeResponse,
)
from app.schemas.transactions import (
    TransactionCreate,
    TransactionListResponse,
    TransactionRead,
    TransactionUpdate,
)
from app.services.transaction_categorization import TransactionCategorizationService
from app.services.transaction_classification import derive_internal_transaction_category


class TransactionService:
    def __init__(self, session: Session) -> None:
        self._repository = TransactionRepository(session)
        self._accounts = AccountRepository(session)
        self._categories = CategoryRepository(session)
        self._categorization = TransactionCategorizationService(session)

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
                user_id=user_id,
                transaction_type=payload.type,
                legacy_category=payload.legacy_category,
                category_id=resolved_category_id,
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
                    user_id=user_id,
                    transaction_type=resolved_type,
                    legacy_category=payload.legacy_category,
                    category_id=resolved_category_id,
                )
                if (
                    payload.type is not None
                    or payload.legacy_category is not None
                    or "category_id" in payload.model_fields_set
                )
                else None
            ),
            transaction_date=payload.date,
            merchant=(
                payload.merchant
                if "merchant" in payload.model_fields_set
                else existing_transaction.merchant
            ),
        )

    def delete_transaction(self, user_id: str, transaction_id: int) -> None:
        self._repository.delete(user_id=user_id, transaction_id=transaction_id)

    def categorize_transactions(
        self,
        user_id: str,
        payload: TransactionCategorizationRequest,
    ) -> TransactionCategorizationResponse:
        return TransactionCategorizationResponse(
            items=[
                TransactionCategorizationSuggestion(
                    source_row_number=item.source_row_number,
                    suggested_category_id=suggestion.suggested_category_id,
                    normalized_merchant=suggestion.normalized_merchant,
                    confidence=suggestion.confidence,
                    matched_rule_source=suggestion.matched_rule_source,
                    explanation=suggestion.explanation,
                    needs_review=suggestion.needs_review,
                    warnings=list(suggestion.warnings),
                )
                for item in payload.items
                for suggestion in [self._categorization.suggest_for_row(user_id, item)]
            ]
        )

    def record_categorization_feedback(
        self,
        user_id: str,
        transaction_id: int,
        payload: TransactionCategorizationFeedbackRequest,
    ) -> TransactionModel:
        transaction = self._repository.get_for_user(user_id, transaction_id)
        category = self._categories.get_for_user(user_id, payload.confirmed_category_id)
        if category.entry_type != transaction.direction:
            raise validation_error(
                "confirmed_category_id does not match the transaction type.",
                {"field": "confirmed_category_id"},
            )

        transaction = self._repository.update(
            user_id=user_id,
            transaction_id=transaction_id,
            account_id=transaction.account_id,
            category_id=payload.confirmed_category_id,
            transaction_category=self._derive_internal_category(
                user_id=user_id,
                transaction_type=transaction.direction,
                category_id=payload.confirmed_category_id,
            ),
            merchant=payload.confirmed_merchant or transaction.merchant,
        )
        self._categorization.learn_user_correction(
            user_id=user_id,
            category_id=payload.confirmed_category_id,
            description=transaction.name,
            merchant=payload.confirmed_merchant or transaction.merchant,
            source="user_correction",
            apply_to_similar=payload.apply_to_similar,
        )
        return transaction

    def recategorize_transactions(
        self,
        user_id: str,
        payload: TransactionRecategorizeRequest,
    ) -> TransactionRecategorizeResponse:
        transactions = self._repository.list_for_recategorization(
            user_id,
            overwrite_existing=payload.overwrite_existing,
            limit=payload.limit,
        )
        items: list[TransactionRecategorizeItem] = []
        updated_count = 0

        for transaction in transactions:
            suggestion = self._categorization.suggest_for_row(
                user_id,
                TransactionCreate(
                    account_id=transaction.account_id,
                    category_id=None,
                    amount=transaction.amount,
                    currency=transaction.currency,
                    type=transaction.direction,
                    date=transaction.effective_date,
                    description=transaction.name,
                    merchant=transaction.merchant,
                ),
            )

            updated = False
            if (
                payload.commit
                and suggestion.suggested_category_id is not None
                and (payload.overwrite_existing or transaction.category_id is None)
            ):
                self._repository.update(
                    user_id=user_id,
                    transaction_id=transaction.id,
                    account_id=transaction.account_id,
                    category_id=suggestion.suggested_category_id,
                    transaction_category=self._derive_internal_category(
                        user_id=user_id,
                        transaction_type=transaction.direction,
                        category_id=suggestion.suggested_category_id,
                    ),
                    merchant=transaction.merchant,
                )
                updated = True
                updated_count += 1

            items.append(
                TransactionRecategorizeItem(
                    transaction_id=transaction.id,
                    description=transaction.name,
                    merchant=transaction.merchant,
                    previous_category_id=transaction.category_id,
                    suggested_category_id=suggestion.suggested_category_id,
                    normalized_merchant=suggestion.normalized_merchant,
                    confidence=suggestion.confidence,
                    explanation=suggestion.explanation,
                    needs_review=suggestion.needs_review,
                    updated=updated,
                )
            )

        return TransactionRecategorizeResponse(
            commit=payload.commit,
            evaluated_count=len(transactions),
            updated_count=updated_count,
            items=items,
        )

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
        *,
        user_id: str,
        transaction_type: str,
        legacy_category: str | None = None,
        category_id: int | None = None,
    ) -> str | None:
        if legacy_category is not None:
            return legacy_category

        category_key = None
        if category_id is not None:
            category_key = self._categories.get_for_user(user_id, category_id).key

        return derive_internal_transaction_category(
            transaction_type,
            legacy_category=legacy_category,
            category_key=category_key,
        )
