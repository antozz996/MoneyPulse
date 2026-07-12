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

## Manual Transactions Contract

Manual transactions remain backend-mediated.

Current routes:

- `GET /transactions`
- `POST /transactions`
- `PATCH /transactions/{transaction_id}`
- `DELETE /transactions/{transaction_id}`

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

## What Is Still Not Implemented

- direct frontend Supabase CRUD
- bank sync changes for persisted categories or budgets
- CSV import
- full Supabase Auth as the product auth source
- automatic RLS-enforced direct client reads
- backend JWKS-based Supabase verification from `SUPABASE_JWKS_URL`
- automatic local user mirroring for first-time Supabase-authenticated users
- dedicated frontend edit flows for every planning entity in all screens; the backend `PATCH` contracts are ready and the current UI prioritizes create/list/delete for the core planning path

## Migration Apply Steps

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
