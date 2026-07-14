import base64
import csv
import hashlib
import io
import json
from datetime import UTC, date, datetime

from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.config import Settings
from app.errors import conflict_error, validation_error
from app.repositories.accounts import AccountRepository
from app.repositories.categories import CategoryRepository
from app.repositories.import_batches import ImportBatchRepository
from app.repositories.transactions import TransactionRepository
from app.schemas.csv_import import (
    CSVImportCommitRequest,
    CSVImportCommitResponse,
    CSVImportPreviewRequest,
    CSVImportPreviewResponse,
    CSVImportRow,
    ColumnMapping,
    ImportError,
)
from app.schemas.transaction_categorization import TransactionCategorizationInputRow
from app.services.transaction_categorization import (
    TransactionCategorizationService,
    normalize_lookup_text,
)
from app.services.transaction_classification import derive_internal_transaction_category

_SUPPORTED_EXTENSIONS = (".csv", ".txt", ".tsv")
_SUPPORTED_ENCODINGS = ("utf-8-sig", "utf-8", "cp1252", "iso-8859-1")
_SUPPORTED_DELIMITERS = (",", ";", "\t")
_FORMULA_PREFIXES = ("=", "+", "-", "@")


def _sanitize_preview_text(value: str | None) -> tuple[str | None, list[str]]:
    if value is None:
        return None, []

    normalized = value.strip()
    if not normalized:
        return None, []

    warnings: list[str] = []
    if normalized.startswith(_FORMULA_PREFIXES):
        warnings.append("Formula-like text was treated as plain text.")
    return normalized, warnings


class TransactionImportService:
    def __init__(self, session: Session, settings: Settings) -> None:
        self._session = session
        self._settings = settings
        self._accounts = AccountRepository(session)
        self._categories = CategoryRepository(session)
        self._transactions = TransactionRepository(session)
        self._import_batches = ImportBatchRepository(session)
        self._categorization = TransactionCategorizationService(session)

    def preview_csv(
        self,
        user_id: str,
        payload: CSVImportPreviewRequest,
    ) -> CSVImportPreviewResponse:
        raw_bytes = self._decode_file(payload)
        encoding = payload.encoding or self._detect_encoding(raw_bytes)
        decoded_text = self._decode_text(raw_bytes, encoding)
        delimiter = payload.delimiter or self._detect_delimiter(decoded_text)
        reader = csv.DictReader(io.StringIO(decoded_text), delimiter=delimiter)
        headers = [header.strip() for header in (reader.fieldnames or []) if header and header.strip()]

        if not headers:
            raise validation_error("The CSV file must include a header row.")

        mapping = payload.mapping or self._detect_mapping(headers)
        rows: list[dict[str, str]] = list(reader)
        if len(rows) > self._settings.csv_import_max_rows:
            raise validation_error(
                f"CSV import supports at most {self._settings.csv_import_max_rows} rows per file.",
                {"limit": self._settings.csv_import_max_rows},
            )

        warnings: list[str] = []
        required_mapping = self._missing_required_mapping(mapping)
        batch_identifier = self._build_batch_identifier(
            filename=payload.filename,
            raw_bytes=raw_bytes,
            account_id=payload.account_id,
            mapping=mapping,
        )
        if required_mapping:
            warnings.append(
                "We could not confidently map all required columns. Confirm date, description, and amount before importing."
            )
            return CSVImportPreviewResponse(
                batch_identifier=batch_identifier,
                filename=payload.filename,
                detected_delimiter=delimiter,
                detected_encoding=encoding,
                detected_mapping=mapping,
                available_columns=headers,
                rows=[],
                rejected_rows=[
                    ImportError(
                        source_row_number=None,
                        code="mapping_incomplete",
                        message=f"Missing mapping for: {', '.join(required_mapping)}.",
                    )
                ],
                preview_fingerprint=self._build_preview_fingerprint(
                    filename=payload.filename,
                    batch_identifier=batch_identifier,
                    mapping=mapping,
                    rows=[],
                ),
                warnings=warnings,
                generated_at=datetime.now(UTC),
            )

        accounts = self._accounts.list_by_user(user_id)
        categories = self._categories.ensure_defaults(user_id)
        account_id = self._resolve_default_account_id(
            user_id,
            accounts=accounts,
            requested_account_id=payload.account_id,
            warnings=warnings,
        )

        preview_rows: list[CSVImportRow] = []
        rejected_rows: list[ImportError] = []

        for row_index, raw_row in enumerate(rows, start=2):
            if self._is_blank_row(raw_row):
                continue

            try:
                preview_rows.append(
                    self._normalize_row(
                        user_id=user_id,
                        row=raw_row,
                        row_index=row_index,
                        mapping=mapping,
                        fallback_currency=payload.currency,
                        account_id=account_id,
                        categories=categories,
                    )
                )
            except ValueError as error:
                rejected_rows.append(
                    ImportError(
                        source_row_number=row_index,
                        code="row_invalid",
                        message=str(error),
                    )
                )

        return CSVImportPreviewResponse(
            batch_identifier=batch_identifier,
            filename=payload.filename,
            detected_delimiter=delimiter,
            detected_encoding=encoding,
            detected_mapping=mapping,
            available_columns=headers,
            rows=preview_rows,
            rejected_rows=rejected_rows,
            preview_fingerprint=self._build_preview_fingerprint(
                filename=payload.filename,
                batch_identifier=batch_identifier,
                mapping=mapping,
                rows=preview_rows,
            ),
            warnings=warnings,
            generated_at=datetime.now(UTC),
        )

    def commit_csv(
        self,
        user_id: str,
        payload: CSVImportCommitRequest,
    ) -> CSVImportCommitResponse:
        if len(payload.rows) > self._settings.csv_import_max_rows:
            raise validation_error(
                f"CSV import supports at most {self._settings.csv_import_max_rows} rows per file.",
                {"limit": self._settings.csv_import_max_rows},
            )

        selected_rows = [row for row in payload.rows if row.selected]
        if not selected_rows:
            raise validation_error("Select at least one row before committing the CSV import.")

        expected_preview_fingerprint = self._build_preview_fingerprint(
            filename=payload.filename,
            batch_identifier=payload.batch_identifier,
            mapping=payload.mapping,
            rows=payload.rows,
        )
        if payload.preview_fingerprint != expected_preview_fingerprint:
            raise validation_error(
                "The import preview no longer matches this commit payload. Run preview again before importing.",
                {"field": "preview_fingerprint"},
            )

        warnings: list[str] = []
        imported_count = 0
        skipped_count = 0
        batch = None

        try:
            existing_batch = self._import_batches.get_by_user_and_identifier(
                user_id,
                payload.batch_identifier,
            )
            if existing_batch is not None:
                if existing_batch.preview_fingerprint != payload.preview_fingerprint:
                    raise conflict_error(
                        "This batch identifier is already bound to a different preview fingerprint.",
                        {"field": "batch_identifier"},
                    )
                if existing_batch.status == "completed":
                    return CSVImportCommitResponse(
                        batch_id=existing_batch.id,
                        batch_identifier=existing_batch.batch_identifier,
                        imported_count=existing_batch.imported_count,
                        skipped_count=existing_batch.skipped_count,
                        error_count=existing_batch.error_count,
                        warnings=[
                            "This import batch was already processed. Returning the stored result."
                        ],
                    )
                raise conflict_error(
                    "This import batch is already being processed. Retry after it finishes or preview again.",
                    {"field": "batch_identifier"},
                )

            accounts = self._accounts.list_by_user(user_id)
            categories = self._categories.ensure_defaults(user_id, commit=False)
            batch = self._import_batches.create(
                user_id=user_id,
                batch_identifier=payload.batch_identifier,
                preview_fingerprint=payload.preview_fingerprint,
                filename=payload.filename,
                source="csv",
            )

            for row in payload.rows:
                if not row.selected:
                    skipped_count += 1
                    continue

                resolved_account_id = self._resolve_commit_account_id(
                    user_id,
                    accounts=accounts,
                    account_id=row.account_id,
                )
                resolved_category_id = self._validate_category_id(
                    user_id=user_id,
                    category_id=row.category_id,
                    transaction_type=row.type,
                )
                is_duplicate = self._is_duplicate_candidate(
                    user_id=user_id,
                    account_id=resolved_account_id,
                    transaction_date=row.date,
                    amount=row.amount,
                    description=row.description,
                    merchant=row.merchant,
                )
                if is_duplicate and not payload.confirm_duplicate_candidates:
                    skipped_count += 1
                    warnings.append(
                        f"Skipped duplicate candidate from row {row.source_row_number}. Confirm duplicates to import it."
                    )
                    continue

                self._transactions.create(
                    user_id=user_id,
                    account_id=resolved_account_id,
                    category_id=resolved_category_id,
                    description=row.description,
                    amount=row.amount,
                    currency=row.currency.upper(),
                    transaction_type=row.type,
                    transaction_category=self._derive_internal_category(
                        category_id=resolved_category_id,
                        categories=categories,
                        transaction_type=row.type,
                    ),
                    merchant=row.merchant,
                    transaction_date=row.date,
                    source="csv_import",
                    commit=False,
                )
                if row.apply_to_similar and row.category_id is not None:
                    self._categorization.learn_user_correction(
                        user_id=user_id,
                        category_id=row.category_id,
                        description=row.description,
                        merchant=row.merchant,
                        source="import",
                        apply_to_similar=True,
                        commit=False,
                    )
                imported_count += 1

            self._import_batches.mark_completed(
                batch,
                imported_count=imported_count,
                skipped_count=skipped_count,
                error_count=0,
            )
            self._session.commit()
        except IntegrityError as error:
            self._session.rollback()
            raise conflict_error(
                "This import batch was already reserved by another request. Retry with a fresh preview if needed.",
                {"field": "batch_identifier"},
            ) from error
        except Exception:
            self._session.rollback()
            raise

        return CSVImportCommitResponse(
            batch_id=batch.id if batch is not None else None,
            batch_identifier=payload.batch_identifier,
            imported_count=imported_count,
            skipped_count=skipped_count,
            error_count=0,
            warnings=warnings,
        )

    def _decode_file(self, payload: CSVImportPreviewRequest) -> bytes:
        if not payload.filename.lower().endswith(_SUPPORTED_EXTENSIONS):
            raise validation_error("Only CSV or text bank exports are supported in this sprint.")

        try:
            raw_bytes = base64.b64decode(payload.content_base64, validate=True)
        except ValueError as error:
            raise validation_error("The uploaded CSV payload is not valid base64 data.") from error

        if not raw_bytes:
            raise validation_error("The uploaded CSV file is empty.")
        if len(raw_bytes) > self._settings.csv_import_max_bytes:
            raise validation_error(
                f"CSV import supports files up to {self._settings.csv_import_max_bytes} bytes.",
                {"limit": self._settings.csv_import_max_bytes},
            )
        if b"\x00" in raw_bytes:
            raise validation_error("Binary files are not supported. Upload a CSV text export.")
        return raw_bytes

    def _detect_encoding(self, raw_bytes: bytes) -> str:
        for encoding in _SUPPORTED_ENCODINGS:
            try:
                raw_bytes.decode(encoding)
                return encoding
            except UnicodeDecodeError:
                continue
        raise validation_error("The CSV encoding is not supported.")

    def _decode_text(self, raw_bytes: bytes, encoding: str) -> str:
        try:
            return raw_bytes.decode(encoding)
        except UnicodeDecodeError as error:
            raise validation_error(f"Could not decode the CSV using {encoding}.") from error

    def _detect_delimiter(self, content: str) -> str:
        sample = "\n".join(content.splitlines()[:5])
        try:
            dialect = csv.Sniffer().sniff(sample, delimiters=_SUPPORTED_DELIMITERS)
            return dialect.delimiter
        except csv.Error:
            counts = {delimiter: sample.count(delimiter) for delimiter in _SUPPORTED_DELIMITERS}
            best = max(counts, key=counts.get)
            return best if counts[best] > 0 else ","

    def _detect_mapping(self, headers: list[str]) -> ColumnMapping:
        normalized_headers = {header: normalize_lookup_text(header) for header in headers}

        def match(*keywords: str) -> str | None:
            for header, normalized in normalized_headers.items():
                if any(keyword == normalized or keyword in normalized for keyword in keywords):
                    return header
            return None

        return ColumnMapping(
            date=match("date", "data", "booking date", "operation date", "valuta"),
            description=match("description", "descrizione", "details", "causale", "narrative"),
            merchant=match("merchant", "beneficiary", "payee", "negozio", "esercente"),
            amount=match("amount", "importo", "value", "totale"),
            debit=match("debit", "addebito", "uscite", "outflow"),
            credit=match("credit", "accredito", "entrate", "inflow"),
            currency=match("currency", "valuta divisa", "divisa"),
        )

    def _missing_required_mapping(self, mapping: ColumnMapping) -> list[str]:
        missing: list[str] = []
        if not mapping.date:
            missing.append("date")
        if not mapping.description and not mapping.merchant:
            missing.append("description")
        if not mapping.amount and not (mapping.debit and mapping.credit):
            missing.append("amount")
        return missing

    def _normalize_row(
        self,
        *,
        user_id: str,
        row: dict[str, str],
        row_index: int,
        mapping: ColumnMapping,
        fallback_currency: str,
        account_id: int | None,
        categories,
    ) -> CSVImportRow:
        description_value, description_warnings = _sanitize_preview_text(
            self._read_column(row, mapping.description) or self._read_column(row, mapping.merchant)
        )
        merchant_value, merchant_warnings = _sanitize_preview_text(self._read_column(row, mapping.merchant))
        warnings = [*description_warnings, *merchant_warnings]

        if description_value is None:
            raise ValueError("Description is required.")

        transaction_date = self._parse_date(self._read_column(row, mapping.date), row_index)
        amount, transaction_type = self._parse_amounts(row, mapping)
        currency = (self._read_column(row, mapping.currency) or fallback_currency).strip().upper()
        if len(currency) != 3:
            warnings.append("Currency was missing or invalid. Using the selected import currency.")
            currency = fallback_currency

        if account_id is None:
            warnings.append("Choose an account before importing these rows.")

        categorization = self._categorization.suggest_for_row(
            user_id,
            TransactionCategorizationInputRow(
                source_row_number=row_index,
                description=description_value,
                merchant=merchant_value,
                amount=amount,
                type=transaction_type,
                date=transaction_date,
                account_id=account_id,
                currency=currency,
            ),
        )
        if categorization.warnings:
            warnings.extend(categorization.warnings)

        duplicate_candidate = self._is_duplicate_candidate(
            user_id=user_id,
            account_id=account_id,
            transaction_date=transaction_date,
            amount=amount,
            description=description_value,
            merchant=merchant_value,
        )
        if duplicate_candidate:
            warnings.append("Potential duplicate detected from an existing transaction.")

        confidence = round(min(0.99, categorization.confidence + (0.05 if account_id else 0)), 2)

        return CSVImportRow(
            source_row_number=row_index,
            date=transaction_date,
            description=description_value,
            merchant=merchant_value,
            amount=amount,
            type=transaction_type,
            account_id=account_id,
            category_id=categorization.suggested_category_id,
            suggested_category_id=categorization.suggested_category_id,
            currency=currency,
            selected=account_id is not None and not duplicate_candidate,
            confidence=confidence,
            normalized_merchant=categorization.normalized_merchant,
            explanation=categorization.explanation,
            matched_rule_source=categorization.matched_rule_source,
            needs_review=categorization.needs_review,
            warnings=warnings,
            duplicate_candidate=duplicate_candidate,
        )

    def _read_column(self, row: dict[str, str], column_name: str | None) -> str | None:
        if not column_name:
            return None
        raw_value = row.get(column_name)
        if raw_value is None:
            return None
        normalized = raw_value.strip()
        return normalized or None

    def _parse_date(self, raw_value: str | None, row_index: int) -> date:
        if raw_value is None:
            raise ValueError("Date is required.")

        normalized = raw_value.strip()
        if "T" in normalized:
            normalized = normalized.split("T", 1)[0]
        if " " in normalized and normalized.count("/") >= 2:
            normalized = normalized.split(" ", 1)[0]

        formats = (
            "%Y-%m-%d",
            "%d/%m/%Y",
            "%d-%m-%Y",
            "%d.%m.%Y",
            "%m/%d/%Y",
            "%Y/%m/%d",
        )
        for fmt in formats:
            try:
                return datetime.strptime(normalized, fmt).date()
            except ValueError:
                continue
        raise ValueError(f"Unsupported date format on row {row_index}: {raw_value}.")

    def _parse_amounts(
        self,
        row: dict[str, str],
        mapping: ColumnMapping,
    ) -> tuple[float, str]:
        if mapping.amount:
            raw_amount = self._read_column(row, mapping.amount)
            if raw_amount is None:
                raise ValueError("Amount is required.")
            parsed_amount = self._parse_decimal(raw_amount)
            if parsed_amount == 0:
                raise ValueError("Amount cannot be zero.")
            return abs(parsed_amount), "income" if parsed_amount > 0 else "expense"

        debit_value = self._read_column(row, mapping.debit)
        credit_value = self._read_column(row, mapping.credit)
        debit = self._parse_decimal(debit_value) if debit_value else 0.0
        credit = self._parse_decimal(credit_value) if credit_value else 0.0
        if debit and credit:
            raise ValueError("Rows cannot include both debit and credit values.")
        if debit:
            return abs(debit), "expense"
        if credit:
            return abs(credit), "income"
        raise ValueError("Amount is required.")

    def _parse_decimal(self, raw_value: str) -> float:
        normalized = (
            raw_value.replace("\u00a0", "")
            .replace(" ", "")
            .replace("EUR", "")
            .replace("€", "")
            .strip()
        )
        if not normalized:
            return 0.0

        if "," in normalized and "." in normalized:
            if normalized.rfind(",") > normalized.rfind("."):
                normalized = normalized.replace(".", "").replace(",", ".")
            else:
                normalized = normalized.replace(",", "")
        elif normalized.count(",") == 1 and normalized.count(".") == 0:
            normalized = normalized.replace(",", ".")
        elif normalized.count(".") > 1:
            normalized = normalized.replace(".", "")

        return round(float(normalized), 2)

    def _resolve_default_account_id(
        self,
        user_id: str,
        *,
        accounts,
        requested_account_id: int | None,
        warnings: list[str],
    ) -> int | None:
        if requested_account_id is not None:
            self._accounts.get_for_user(user_id, requested_account_id)
            return requested_account_id
        if len(accounts) == 1:
            return accounts[0].id
        if len(accounts) == 0:
            warnings.append("Create an account before committing imported transactions.")
        else:
            warnings.append("Multiple accounts detected. Pick the destination account before importing.")
        return None

    def _resolve_commit_account_id(self, user_id: str, *, accounts, account_id: int | None) -> int | None:
        if account_id is None:
            if len(accounts) == 1:
                return accounts[0].id
            raise ValueError("account_id is required when multiple accounts exist.")
        self._accounts.get_for_user(user_id, account_id)
        return account_id

    def _validate_category_id(self, *, user_id: str, category_id: int | None, transaction_type: str) -> int | None:
        if category_id is None:
            return None
        category = self._categories.get_for_user(user_id, category_id)
        if category.entry_type != transaction_type:
            raise ValueError("category_id does not match the transaction type.")
        return category_id

    def _derive_internal_category(self, *, category_id: int | None, categories, transaction_type: str) -> str | None:
        category_key = None
        if category_id is not None:
            category = next((item for item in categories if item.id == category_id), None)
            category_key = category.key if category is not None else None
        return derive_internal_transaction_category(
            transaction_type,
            category_key=category_key,
        )

    def _is_duplicate_candidate(
        self,
        *,
        user_id: str,
        account_id: int | None,
        transaction_date: date,
        amount: float,
        description: str,
        merchant: str | None,
    ) -> bool:
        candidates = self._transactions.list_duplicate_candidates(
            user_id=user_id,
            account_id=account_id,
            transaction_date=transaction_date,
            amount=amount,
        )
        description_key = normalize_lookup_text(description)
        merchant_key = normalize_lookup_text(merchant)
        imported_keys = {key for key in (description_key, merchant_key) if key}
        if not imported_keys:
            return False

        for candidate in candidates:
            candidate_keys = {
                key
                for key in (
                    normalize_lookup_text(candidate.name),
                    normalize_lookup_text(candidate.merchant),
                )
                if key
            }
            if imported_keys & candidate_keys:
                return True
        return False

    def _build_batch_identifier(
        self,
        *,
        filename: str,
        raw_bytes: bytes,
        account_id: int | None,
        mapping: ColumnMapping,
    ) -> str:
        digest = hashlib.sha256()
        digest.update(filename.encode("utf-8"))
        digest.update(raw_bytes)
        digest.update(str(account_id).encode("utf-8"))
        digest.update(json.dumps(mapping.model_dump(), sort_keys=True).encode("utf-8"))
        return digest.hexdigest()

    def _build_preview_fingerprint(
        self,
        *,
        filename: str,
        batch_identifier: str,
        mapping: ColumnMapping,
        rows: list[CSVImportRow],
    ) -> str:
        digest = hashlib.sha256()
        digest.update(filename.encode("utf-8"))
        digest.update(batch_identifier.encode("utf-8"))
        digest.update(json.dumps(mapping.model_dump(), sort_keys=True).encode("utf-8"))
        digest.update(
            json.dumps(
                [self._serialize_preview_row(row) for row in rows],
                sort_keys=True,
                separators=(",", ":"),
            ).encode("utf-8")
        )
        return digest.hexdigest()

    def _serialize_preview_row(self, row: CSVImportRow) -> dict[str, object]:
        return {
            "source_row_number": row.source_row_number,
            "date": row.date.isoformat(),
            "description": row.description,
            "merchant": row.merchant,
            "amount": row.amount,
            "type": row.type,
            "suggested_category_id": row.suggested_category_id,
            "currency": row.currency,
            "confidence": row.confidence,
            "normalized_merchant": row.normalized_merchant,
            "explanation": row.explanation,
            "matched_rule_source": row.matched_rule_source,
            "needs_review": row.needs_review,
            "warnings": list(row.warnings),
            "duplicate_candidate": row.duplicate_candidate,
        }

    def _is_blank_row(self, row: dict[str, str]) -> bool:
        return all(not (value or "").strip() for value in row.values())
