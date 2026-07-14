from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models import ImportBatchModel


class ImportBatchRepository:
    def __init__(self, session: Session) -> None:
        self._session = session

    def get_by_user_and_identifier(
        self,
        user_id: str,
        batch_identifier: str,
    ) -> ImportBatchModel | None:
        statement = select(ImportBatchModel).where(
            ImportBatchModel.user_id == user_id,
            ImportBatchModel.batch_identifier == batch_identifier,
        )
        return self._session.scalar(statement)

    def create(
        self,
        *,
        user_id: str,
        batch_identifier: str,
        preview_fingerprint: str,
        filename: str,
        source: str,
        status: str = "processing",
    ) -> ImportBatchModel:
        batch = ImportBatchModel(
            user_id=user_id,
            batch_identifier=batch_identifier,
            preview_fingerprint=preview_fingerprint,
            filename=filename,
            source=source,
            status=status,
        )
        self._session.add(batch)
        self._session.flush()
        return batch

    def mark_completed(
        self,
        batch: ImportBatchModel,
        *,
        imported_count: int,
        skipped_count: int,
        error_count: int,
    ) -> ImportBatchModel:
        batch.status = "completed"
        batch.imported_count = imported_count
        batch.skipped_count = skipped_count
        batch.error_count = error_count
        batch.completed_at = datetime.now(UTC)
        self._session.flush()
        return batch
