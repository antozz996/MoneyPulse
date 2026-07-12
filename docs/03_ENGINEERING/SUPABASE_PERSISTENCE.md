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
