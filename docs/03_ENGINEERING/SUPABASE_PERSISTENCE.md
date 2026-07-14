# Supabase Persistence Foundation

## Chosen Access Pattern

MoneyPulse uses a **backend-mediated persistence layer** for Sprint 20.

That means:

- the frontend continues to talk to the FastAPI backend;
- the backend continues to own database access;
- Supabase Postgres is treated as a managed Postgres target, not as a direct browser data API;
- no Supabase service role key is exposed to the frontend;
- no Supabase anon key is required for the current product flow.

This matches the current architecture best because the app already has:

- authenticated REST routes;
- server-side validation;
- a deterministic decision engine adapter;
- an existing SQLAlchemy plus Alembic persistence path.

## Auth Alignment

Sprint 21 hardens auth around the backend as the authority for `user_id`.

Current supported backend auth modes:

- `app`
  MoneyPulse-issued JWTs from the current register/login flow.
- `demo`
  Explicit local/demo mode that resolves a deterministic demo user server-side.
- `supabase`
  Preparatory mode for Supabase Auth JWT verification when `SUPABASE_JWT_SECRET` is configured.

Important rules:

- persisted financial routes always derive `user_id` from the backend auth dependency;
- the client payload cannot choose or override `user_id`;
- frontend demo mode must be paired with backend demo mode if you want the app to stay usable without login.

## What This Sprint Adds

- Alembic migration `20260712_000004_persistence_foundation`
- `user_financial_profiles`
- `categories`
- `budgets`
- richer persistence columns on existing core tables
- a backend `GET /financial-data` bundle route
- a frontend data-source abstraction with API and demo fallback modes
- authenticated and demo-safe manual transaction CRUD through the backend layer
- authenticated and demo-safe goals CRUD through the backend layer
- authenticated and demo-safe budgets CRUD through the backend layer
- authenticated and demo-safe recurring-item CRUD through the backend layer
- engine mapper coverage so persisted planning data can drive Today, Before You Buy, forecast, and Copilot context
- Alembic migration `20260712_000005_csv_import_batches`
- authenticated and demo-safe CSV transaction import preview and commit routes
- import-batch persistence for idempotent CSV commits
- Alembic migration `20260712_000006_transaction_categorization_rules`
- backend-mediated deterministic transaction categorization rules and user correction learning

## Manual Transactions Contract

Manual transactions remain backend-mediated.

Current routes:

- `GET /transactions`
- `POST /transactions`
- `PATCH /transactions/{transaction_id}`
- `DELETE /transactions/{transaction_id}`
- `POST /transactions/categorize`
- `POST /transactions/{transaction_id}/categorization-feedback`
- `POST /transactions/recategorize`
- `POST /transactions/import/preview`
- `POST /transactions/import/commit`

`GET /transactions` returns:

- `items`
- `total`
- `limit`
- `offset`

Persisted transaction fields exposed to the frontend include:

- `id`
- `account_id`
- `category_id`
- `amount`
- `currency`
- `type`
- `date`
- `description`
- `merchant`
- `source`
- `status`
- `created_at`
- `updated_at`

Additional notes:

- backend auth remains the authority for `user_id`;
- client payloads cannot set `user_id`;
- `account_id` is ownership-checked against the authenticated user;
- when exactly one owned account exists, the backend can still auto-attach it for backwards-compatible callers;
- `category_id` is optional and ownership-checked when present;
- archived transactions are excluded from normal reads and from the financial-data bundle.
- transaction categorization rules are stored per user in `transaction_categorization_rules`;
- explicit category selection always wins over learned or system suggestions;
- learned user rules run before merchant aliases;
- merchant aliases run before deterministic system rules;
- deterministic system rules run before historical user-transaction matches;
- correction learning is isolated per user and never affects another user's transactions or imports.

## CSV Import Contract

CSV import remains backend-mediated and uses a two-step preview plus commit flow.

Preview route:

- `POST /transactions/import/preview`

Commit route:

- `POST /transactions/import/commit`

The preview request currently sends:

- `filename`
- `content_base64`
- optional `mapping`
- optional `account_id`
- `currency`

Preview returns:

- `batch_identifier`
- `preview_fingerprint`
- detected `delimiter`
- detected `encoding`
- detected `mapping`
- `available_columns`
- normalized `rows`
- `rejected_rows`
- top-level `warnings`

Normalized preview rows include:

- `source_row_number`
- `date`
- `description`
- `merchant`
- `amount`
- `type`
- `account_id`
- `category_id`
- `suggested_category_id`
- `currency`
- `selected`
- `confidence`
- `normalized_merchant`
- `explanation`
- `matched_rule_source`
- `needs_review`
- `apply_to_similar`
- `warnings`
- `duplicate_candidate`

Commit accepts only normalized rows from the preview flow plus:

- `filename`
- `batch_identifier`
- `preview_fingerprint`
- `mapping`
- `rows`
- optional `confirm_duplicate_candidates`

Commit returns:

- `batch_id`
- `batch_identifier`
- `imported_count`
- `skipped_count`
- `error_count`
- `warnings`

Additional CSV import notes:

- backend auth remains the authority for `user_id`;
- the client payload cannot choose or override `user_id`;
- imported rows are persisted as normal transactions with source `csv_import`;
- preview never persists transaction rows;
- commit revalidates rows server-side before insert;
- commit verifies a deterministic `preview_fingerprint` before reserving the batch;
- deterministic categorization suggestions now run during preview using the same backend categorizer used by manual entry and recategorization flows;
- when `apply_to_similar` is enabled for a selected row, the confirmed category can seed a user-specific future matching rule during commit;
- duplicate candidates are detected conservatively from current user, account, date, amount, and normalized description or merchant;
- duplicate candidates are not imported unless the user explicitly selects the row and sets `confirm_duplicate_candidates` to `true`;
- import batch reservation, selected-row validation, transaction inserts, optional learning writes, and final batch completion happen in one database transaction;
- if any selected row fails, the backend rolls back both inserted transactions and the batch reservation;
- completed import batches are stored so repeated commits with the same authenticated user, `batch_identifier`, and `preview_fingerprint` return the stored result instead of duplicating transactions;
- if the backend encounters a non-completed batch row for the same authenticated user and `batch_identifier`, it returns a conflict instead of risking duplicate writes.

Supported import behavior in Sprint 24:

- UTF-8, UTF-8 BOM, CP1252, and ISO-8859-1 decoding
- comma, semicolon, and tab delimiters
- decimal comma parsing
- single signed amount columns
- separate debit and credit columns
- common European and ISO date formats

Current CSV limits:

- default file size limit: `262144` bytes
- default row limit: `300` rows

## Planning Data Contracts

Planning inputs remain backend-mediated and are always scoped to the authenticated or demo-resolved current user.

Current routes:

- `GET /goals`
- `POST /goals`
- `PATCH /goals/{goal_id}`
- `DELETE /goals/{goal_id}`
- `GET /budgets`
- `POST /budgets`
- `PATCH /budgets/{budget_id}`
- `DELETE /budgets/{budget_id}`
- `GET /recurring-items`
- `POST /recurring-items`
- `PATCH /recurring-items/{recurring_id}`
- `DELETE /recurring-items/{recurring_id}`

Persisted goal fields exposed to the frontend include:

- `id`
- `name`
- `target_amount`
- `current_amount`
- `monthly_contribution`
- `priority`
- `deadline`
- `status`
- `currency`
- `created_at`
- `updated_at`

Additional goal notes:

- backend auth remains the authority for `user_id`;
- client payloads cannot set `user_id`;
- amounts are validated as non-negative;
- priorities are restricted to `ESSENTIAL`, `IMPORTANT`, and `FLEXIBLE`;
- archived goals are excluded from normal reads and from the financial-data bundle;
- legacy goal payloads remain normalized server-side for backwards-compatible callers.

Persisted budget fields exposed to the frontend include:

- `id`
- `category_id`
- `amount`
- `currency`
- `period`
- `status`
- `created_at`
- `updated_at`

Additional budget notes:

- backend auth remains the authority for `user_id`;
- client payloads cannot set `user_id`;
- amounts are validated as non-negative;
- category ownership is enforced against the current user or allowed system categories;
- archived budgets are excluded from normal reads and from the financial-data bundle.

Persisted recurring-item fields exposed to the frontend include:

- `id`
- `account_id`
- `category_id`
- `name`
- `amount`
- `currency`
- `type`
- `frequency`
- `next_due_date`
- `status`
- `created_at`
- `updated_at`

Additional recurring-item notes:

- backend auth remains the authority for `user_id`;
- client payloads cannot set `user_id`;
- amounts are validated as positive;
- `next_due_date` is required;
- account and category ownership are validated for the current user when provided;
- archived recurring items are excluded from normal reads and from the financial-data bundle;
- legacy `direction` and `cadence` callers remain normalized server-side for backwards-compatible clients.

## Current Fallback Behavior

If Supabase is **not configured**, the app still works:

- backend defaults to local SQLite;
- frontend still reads from the backend API;
- demo fallback remains available in the frontend data abstraction;
- tests, build, and E2E do not require Supabase.

## E2E Isolation Notes

The private-beta Playwright suite now isolates Money flows more aggressively.

Current guardrails:

- each test bootstraps a unique authenticated user;
- onboarding is marked as skipped through the backend before the page loads when the scenario is not explicitly testing onboarding;
- the web app points directly at the local API base URL during E2E runs for auth and CSV-import setup paths that should not depend on proxy timing;
- Playwright runs with `workers: 1` for this suite to avoid accidental cross-test state leakage;
- temporary debug specs matching `tmp-*.spec.ts` are ignored by the checked-in Playwright config and must not be relied on as part of the suite.

## What Is Still Not Implemented

- direct frontend Supabase CRUD
- bank sync changes for persisted categories or budgets
- full Supabase Auth as the product auth source
- automatic RLS-enforced direct client reads
- backend JWKS-based Supabase verification from `SUPABASE_JWKS_URL`
- automatic local user mirroring for first-time Supabase-authenticated users
- dedicated frontend edit flows for every planning entity in all screens; the backend `PATCH` contracts are ready and the current UI prioritizes create/list/delete for the core planning path
- XLSX, PDF, and image-based statement import
- persisted merchant-rule learning beyond deterministic exact-match history

## Migration Apply Steps

Any local SQLite database used for development, preview, validation, or E2E must run the Alembic migration chain before use.

Do not rely on ad-hoc table creation or stale local files. MoneyPulse expects the schema to match the current migration head before application startup or tests touch persisted state.

Local SQLite:

```bash
cd backend/api
../../.venv/bin/moneypulse-init-db
```

Supabase Postgres:

```bash
cd backend/api
MONEYPULSE_DATABASE_URL='postgresql+psycopg://...' ../../.venv/bin/moneypulse-init-db
```

Supabase-auth preparation:

```bash
export MONEYPULSE_AUTH_MODE=supabase
export SUPABASE_JWT_SECRET='...'
export SUPABASE_JWT_ISSUER='https://YOUR_PROJECT.supabase.co/auth/v1'
export SUPABASE_JWT_AUDIENCE='authenticated'
```

Local/demo preview:

```bash
export MONEYPULSE_AUTH_MODE=demo
export VITE_AUTH_MODE=demo
```

## RLS Preparation

Prepared Supabase RLS policies live in:

- [supabase/sql/20260712_user_owned_policies.sql](/root/MONEY%20PULSE/supabase/sql/20260712_user_owned_policies.sql)

These policies are **not applied automatically** in Sprint 20 because the current app uses backend-issued JWTs, not Supabase Auth JWT claims.

Apply them only after moving reads or writes to Supabase-authenticated client traffic, or after the backend starts forwarding compatible auth claims.
