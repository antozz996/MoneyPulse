from sqlalchemy.orm import Session

from app.models import CheckpointModel
from app.repositories.checkpoints import CheckpointRepository
from app.schemas.checkpoints import CheckpointCreate, CheckpointUpdate


class CheckpointService:
    def __init__(self, session: Session) -> None:
        self._repository = CheckpointRepository(session)

    def list_checkpoints(self, user_id: str) -> list[CheckpointModel]:
        return self._repository.list_by_user(user_id)

    def create_checkpoint(self, user_id: str, payload: CheckpointCreate) -> CheckpointModel:
        return self._repository.create(
            user_id=user_id,
            name=payload.name,
            amount=payload.amount,
            currency=payload.currency.upper(),
            effective_date=payload.effective_date,
            note=payload.note,
        )

    def update_checkpoint(
        self,
        user_id: str,
        checkpoint_id: int,
        payload: CheckpointUpdate,
    ) -> CheckpointModel:
        return self._repository.update(
            user_id=user_id,
            checkpoint_id=checkpoint_id,
            name=payload.name,
            amount=payload.amount,
            currency=payload.currency.upper(),
            effective_date=payload.effective_date,
            note=payload.note,
        )

    def delete_checkpoint(self, user_id: str, checkpoint_id: int) -> None:
        self._repository.delete(user_id=user_id, checkpoint_id=checkpoint_id)
