# CSV Import

## Purpose

Sprint 24 adds a backend-mediated CSV transaction import flow for MoneyPulse.

The goal is simple:

- upload a bank CSV;
- preview normalized rows without persistence;
- surface warnings and duplicate candidates;
- import only the selected rows into the existing transaction layer.

## Why This Stays Backend-Mediated

MoneyPulse keeps the backend as the authority for:

- authenticated user scope;
- account and category ownership validation;
- duplicate detection;
- idempotent import batches;
- final transaction persistence.

The frontend never sends or controls `user_id`.

## Supported Formats In Sprint 24

- `.csv`, `.txt`, `.tsv`
- UTF-8 and UTF-8 BOM
- CP1252
- ISO-8859-1
- comma, semicolon, and tab delimiters
- signed amount columns
- separate debit and credit columns
- common European and ISO date formats
- decimal comma values such as `1.234,56`

## Current Limits

- default raw file size limit: `262144` bytes
- default row limit: `300`

These limits are configurable through backend settings:

- `MONEYPULSE_CSV_IMPORT_MAX_BYTES`
- `MONEYPULSE_CSV_IMPORT_MAX_ROWS`

## API Flow

### 1. Preview

`POST /transactions/import/preview`

Request includes:

- `filename`
- `content_base64`
- optional `mapping`
- optional `account_id`
- `currency`

Preview returns:

- detected delimiter and encoding
- detected or corrected column mapping
- normalized preview rows
- rejected rows
- a deterministic `preview_fingerprint`
- warnings
- `batch_identifier`

Preview does **not** persist transactions.

### 2. Commit

`POST /transactions/import/commit`

Request includes:

- `filename`
- `batch_identifier`
- normalized selected rows from preview
- optional `confirm_duplicate_candidates`

Commit:

- verifies the `preview_fingerprint` against the commit payload before any write;
- revalidates the selected rows;
- rechecks duplicates server-side;
- reserves the import batch and persists transactions as source `csv_import` in one database transaction;
- stores the completed import batch for idempotency only after the transaction succeeds.

## Duplicate Behavior

Duplicate detection is conservative.

A row is flagged when MoneyPulse finds an existing transaction for the same current user with the same:

- account
- date
- amount
- normalized description or merchant

Duplicate candidates are surfaced in preview and default to unselected.

They are not imported unless the user explicitly selects the row and sets `confirm_duplicate_candidates = true`.

## Categorization Behavior

Categorization is deterministic only in Sprint 24 and follows the shared backend precedence:

Priority order:

1. explicit category already present on the preview row
2. learned user correction rules, first exact then partial
3. known merchant aliases
4. simple built-in merchant or description system rules
5. authenticated user's categorized transaction history
6. uncategorized fallback

No live AI categorization is used.

## Current Limitations

- no XLSX import
- no PDF import
- no OCR
- no persisted merchant-rule training UI yet
- no background import job queue
- no raw CSV file storage

## Atomicity And Retry Behavior

Commit is all-or-nothing for selected rows.

- if any selected row fails validation or insertion, the backend rolls back all imported rows and the batch reservation;
- failed attempts leave no completed batch record behind, so retrying the same preview behaves like a fresh first successful commit;
- retrying a completed batch with the same authenticated user, `batch_identifier`, and `preview_fingerprint` returns the stored result instead of inserting duplicates;
- if the backend encounters a non-completed batch row for the same authenticated user and `batch_identifier`, it returns a conflict instead of risking duplicate writes.

## Preview Binding

The backend binds commit to preview with a deterministic `preview_fingerprint`.

The fingerprint currently covers:

- `filename`
- `batch_identifier`
- detected column mapping
- immutable normalized preview-row data such as source row number, date, description, merchant, amount, type, suggested category, currency, confidence, normalized merchant, explanation, warnings, and duplicate flags

This allows the user to keep making explicit review choices such as:

- selecting or skipping a row
- changing `account_id`
- changing `category_id`
- toggling `apply_to_similar`

But it rejects commits where the source-derived preview content was altered after preview instead of re-previewed.

## Frontend UX Notes

The mobile-first Money screen now exposes:

- file picker
- preview action
- column mapping correction
- warning and rejected-row display
- per-row account/category correction
- row selection before commit
- import summary after commit

After a successful import, the app refreshes:

- financial data bundle
- transaction list
- Today context
- Copilot context
