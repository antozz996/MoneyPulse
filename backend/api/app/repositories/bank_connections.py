from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import not_found_error, validation_error
from app.models import BankConnectionModel


class BankConnectionRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def create_pending(
        self,
        *,
        user_id: str,
        provider: str,
        institution_id: str | None,
        institution_name: str,
        connection_reference: str,
    ) -> BankConnectionModel:
        connection = BankConnectionModel(
            user_id=user_id,
            provider=provider,
            status="pending",
            institution_id=institution_id,
            institution_name=institution_name,
            connection_reference=connection_reference,
        )
        self._session.add(connection)
        self._session.commit()
        self._session.refresh(connection)
        return connection

    def list_visible_by_user(self, user_id: str) -> list[BankConnectionModel]:
        statement = (
            select(BankConnectionModel)
            .where(
                BankConnectionModel.user_id == user_id,
                BankConnectionModel.status != "disconnected",
            )
            .order_by(BankConnectionModel.created_at.asc(), BankConnectionModel.id.asc())
        )
        return list(self._session.scalars(statement))

    def list_active_by_user(self, user_id: str) -> list[BankConnectionModel]:
        statement = (
            select(BankConnectionModel)
            .where(
                BankConnectionModel.user_id == user_id,
                BankConnectionModel.status == "active",
            )
            .order_by(BankConnectionModel.created_at.asc(), BankConnectionModel.id.asc())
        )
        return list(self._session.scalars(statement))

    def get_for_user(self, user_id: str, connection_id: int) -> BankConnectionModel:
        statement = select(BankConnectionModel).where(
            BankConnectionModel.user_id == user_id,
            BankConnectionModel.id == connection_id,
            BankConnectionModel.status != "disconnected",
        )
        connection = self._session.scalar(statement)
        if connection is None:
            raise not_found_error("bank_connection", connection_id)
        return connection

    def activate(
        self,
        connection: BankConnectionModel,
        *,
        institution_id: str | None,
        institution_name: str,
        external_connection_id: str,
    ) -> BankConnectionModel:
        if connection.status == "disconnected":
            raise validation_error("Disconnected bank connections cannot be reactivated.")

        connection.status = "active"
        connection.institution_id = institution_id
        connection.institution_name = institution_name
        connection.external_connection_id = external_connection_id
        self._session.commit()
        self._session.refresh(connection)
        return connection

    def mark_synced(
        self,
        connection: BankConnectionModel,
        *,
        synced_at: datetime,
    ) -> BankConnectionModel:
        connection.last_sync_at = synced_at
        self._session.commit()
        self._session.refresh(connection)
        return connection

    def disconnect(self, connection: BankConnectionModel) -> None:
        connection.status = "disconnected"
        self._session.commit()
