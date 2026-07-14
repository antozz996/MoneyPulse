from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.errors import not_found_error
from app.models import TransactionModel


class TransactionRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_by_user(
        self,
        user_id: str,
    ) -> list[TransactionModel]:
        transactions, _ = self.list_page_for_user(user_id)
        return transactions

    def list_page_for_user(
        self,
        user_id: str,
        *,
        date_from: date | None = None,
        date_to: date | None = None,
        transaction_type: str | None = None,
        account_id: int | None = None,
        category_id: int | None = None,
        limit: int | None = None,
        offset: int = 0,
    ) -> tuple[list[TransactionModel], int]:
        filters = [
            TransactionModel.user_id == user_id,
            TransactionModel.status != "archived",
        ]

        if date_from is not None:
            filters.append(TransactionModel.effective_date >= date_from)
        if date_to is not None:
            filters.append(TransactionModel.effective_date <= date_to)
        if transaction_type is not None:
            filters.append(TransactionModel.direction == transaction_type)
        if account_id is not None:
            filters.append(TransactionModel.account_id == account_id)
        if category_id is not None:
            filters.append(TransactionModel.category_id == category_id)

        statement = (
            select(TransactionModel)
            .where(*filters)
            .order_by(TransactionModel.effective_date.desc(), TransactionModel.id.desc())
        )
        count_statement = select(func.count()).select_from(TransactionModel).where(*filters)

        if offset:
            statement = statement.offset(offset)
        if limit is not None:
            statement = statement.limit(limit)

        return (
            list(self._session.scalars(statement)),
            int(self._session.scalar(count_statement) or 0),
        )

    def create(
        self,
        *,
        user_id: str,
        description: str,
        amount: float,
        currency: str,
        transaction_type: str,
        transaction_category: str | None,
        transaction_date: date,
        account_id: int | None = None,
        category_id: int | None = None,
        merchant: str | None = None,
        status: str = "posted",
        source: str = "manual",
        commit: bool = True,
    ) -> TransactionModel:
        transaction = TransactionModel(
            user_id=user_id,
            account_id=account_id,
            category_id=category_id,
            name=description,
            amount=amount,
            currency=currency,
            direction=transaction_type,
            category=transaction_category,
            merchant=merchant,
            status=status,
            source=source,
            effective_date=transaction_date,
        )
        self._session.add(transaction)
        if commit:
            self._session.commit()
            self._session.refresh(transaction)
        else:
            self._session.flush()
        return transaction

    def get_for_user(self, user_id: str, transaction_id: int) -> TransactionModel:
        statement = select(TransactionModel).where(
            TransactionModel.user_id == user_id,
            TransactionModel.id == transaction_id,
            TransactionModel.status != "archived",
        )
        transaction = self._session.scalar(statement)
        if transaction is None:
            raise not_found_error("transaction", transaction_id)
        return transaction

    def update(
        self,
        *,
        user_id: str,
        transaction_id: int,
        description: str | None = None,
        amount: float | None = None,
        currency: str | None = None,
        transaction_type: str | None = None,
        transaction_category: str | None = None,
        transaction_date: date | None = None,
        account_id: int | None = None,
        category_id: int | None = None,
        merchant: str | None = None,
        commit: bool = True,
    ) -> TransactionModel:
        transaction = self.get_for_user(user_id, transaction_id)
        if description is not None:
            transaction.name = description
        if amount is not None:
            transaction.amount = amount
        if currency is not None:
            transaction.currency = currency
        if transaction_type is not None:
            transaction.direction = transaction_type
            transaction.category = transaction_category
        elif transaction_category is not None:
            transaction.category = transaction_category
        if transaction_date is not None:
            transaction.effective_date = transaction_date
        transaction.account_id = account_id
        transaction.category_id = category_id
        transaction.merchant = merchant
        if commit:
            self._session.commit()
            self._session.refresh(transaction)
        else:
            self._session.flush()
        return transaction

    def delete(self, *, user_id: str, transaction_id: int) -> None:
        transaction = self.get_for_user(user_id, transaction_id)
        transaction.status = "archived"
        self._session.commit()
    def list_categorized_for_user(self, user_id: str) -> list[TransactionModel]:
        statement = (
            select(TransactionModel)
            .where(
                TransactionModel.user_id == user_id,
                TransactionModel.status != "archived",
                TransactionModel.category_id.is_not(None),
            )
            .order_by(TransactionModel.id.desc())
        )
        return list(self._session.scalars(statement))

    def list_for_recategorization(
        self,
        user_id: str,
        *,
        overwrite_existing: bool,
        limit: int,
    ) -> list[TransactionModel]:
        filters = [
            TransactionModel.user_id == user_id,
            TransactionModel.status != "archived",
        ]
        if not overwrite_existing:
            filters.append(TransactionModel.category_id.is_(None))

        statement = (
            select(TransactionModel)
            .where(*filters)
            .order_by(TransactionModel.effective_date.desc(), TransactionModel.id.desc())
            .limit(limit)
        )
        return list(self._session.scalars(statement))
