from sqlalchemy import select
from sqlalchemy.orm import Session

from app.errors import not_found_error
from app.models import CheckpointModel


class CheckpointRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def list_by_user(self, user_id: str) -> list[CheckpointModel]:
        statement = (
            select(CheckpointModel)
            .where(CheckpointModel.user_id == user_id)
            .order_by(CheckpointModel.effective_date.asc(), CheckpointModel.id.asc())
        )
        return list(self._session.scalars(statement))

    def create(
        self,
        *,
        user_id: str,
        name: str,
        amount: float,
        currency: str,
        effective_date,
        note: str | None,
    ) -> CheckpointModel:
        checkpoint = CheckpointModel(
            user_id=user_id,
            name=name,
            amount=amount,
            currency=currency,
            effective_date=effective_date,
            note=note,
        )
        self._session.add(checkpoint)
        self._session.commit()
        self._session.refresh(checkpoint)
        return checkpoint

    def get_for_user(self, user_id: str, checkpoint_id: int) -> CheckpointModel:
        statement = select(CheckpointModel).where(
            CheckpointModel.user_id == user_id,
            CheckpointModel.id == checkpoint_id,
        )
        checkpoint = self._session.scalar(statement)
        if checkpoint is None:
            raise not_found_error("checkpoint", checkpoint_id)
        return checkpoint

    def update(
        self,
        *,
        user_id: str,
        checkpoint_id: int,
        name: str,
        amount: float,
        currency: str,
        effective_date,
        note: str | None,
    ) -> CheckpointModel:
        checkpoint = self.get_for_user(user_id, checkpoint_id)
        checkpoint.name = name
        checkpoint.amount = amount
        checkpoint.currency = currency
        checkpoint.effective_date = effective_date
        checkpoint.note = note
        self._session.commit()
        self._session.refresh(checkpoint)
        return checkpoint

    def delete(self, *, user_id: str, checkpoint_id: int) -> None:
        checkpoint = self.get_for_user(user_id, checkpoint_id)
        self._session.delete(checkpoint)
        self._session.commit()
