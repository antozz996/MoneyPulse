# Deployment Guide

## Chosen Architecture

MoneyPulse should deploy as **two Vercel projects**:

1. `moneypulse-web`
   Uses the repository root with the root [vercel.json](/root/MONEY%20PULSE/vercel.json) and builds `apps/web`.
2. `moneypulse-api`
   Uses `backend/api` as the Vercel root with [backend/api/vercel.json](/root/MONEY%20PULSE/backend/api/vercel.json).

This is the simplest compatible approach with the current repository:

- the frontend is a Vite SPA inside a pnpm monorepo;
- the backend is a separate FastAPI service;
- secrets stay server-side;
- the frontend can call the backend through `VITE_API_BASE_URL`;
- no live AI or Supabase client logic needs to be enabled yet;
- persisted financial data can run through the backend against Supabase Postgres without exposing database admin credentials to the browser.

## Current Supabase Status

MoneyPulse is still **backend-mediated for persistence**.

That means:

- use the **Postgres connection string** now if you want the FastAPI backend to run against Supabase Postgres;
- use the **Project URL** and **anon/publishable key** only for future direct client features, not for the current persistence path;
- use the **service role key** only for future backend-only Supabase admin operations.

For Sprint 18, the live preview can already work with:

- Vercel-hosted frontend
- Vercel-hosted FastAPI backend
- Supabase Postgres as the database, if you want persistent cloud data

The app does **not** need live OpenAI.
The Copilot remains on deterministic mock fallback by default.
The app also does **not** need frontend Supabase SDK configuration to persist user financial data in Sprint 20.

## Vercel Projects

### Web Project

- Project name: `moneypulse-web`
- Repository root in Vercel: `/root/MONEY PULSE`
- Framework preset: `Other`
- Build config comes from [vercel.json](/root/MONEY%20PULSE/vercel.json)

What it does:

- installs the pnpm workspace from the repo root;
- builds `@moneypulse/web`;
- serves `apps/web/dist`;
- rewrites SPA routes to `index.html`.

### Backend Project

- Project name: `moneypulse-api`
- Root directory in Vercel: `backend/api`
- Framework preset: `Other`
- Entry point: [backend/api/api/index.py](/root/MONEY%20PULSE/backend/api/api/index.py)
- Build and routing config come from [backend/api/vercel.json](/root/MONEY%20PULSE/backend/api/vercel.json)

What it does:

- deploys the FastAPI app as a Vercel Python function;
- serves the existing REST routes, including:
  - `GET /api/health`
  - `POST /api/copilot/chat`

## Environment Variables

## Web Public Env

Set these in the **web** Vercel project.

- `VITE_APP_ENV=production`
- `VITE_AUTH_MODE=app`
- `VITE_DEFAULT_CURRENCY=EUR`
- `VITE_API_BASE_URL=https://your-api-project.vercel.app`
- `VITE_COPILOT_PROVIDER=mock`
- `VITE_COPILOT_ENABLE_LIVE=false`
- `VITE_COPILOT_BACKEND_PATH=/api/copilot/chat`
- `VITE_SUPABASE_URL=...`
- `VITE_SUPABASE_ANON_KEY=...`

Notes:

- `VITE_AUTH_MODE=app` is the production-safe default.
- Use `VITE_AUTH_MODE=demo` only for local preview or explicit demo environments where the backend also runs with demo auth enabled.
- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are safe to expose publicly.
- `VITE_SUPABASE_PUBLISHABLE_KEY` can be used instead of `VITE_SUPABASE_ANON_KEY` if you standardize on that naming later.
- `VITE_API_BASE_URL` is required when the frontend calls the separate backend project.
- Sprint 20 does not require the frontend to use these Supabase public keys yet, because financial persistence stays behind the backend API.
- Keep `VITE_COPILOT_PROVIDER=mock` by default. Change to `remote` only after the backend preview is deployed and verified.

Never set:

- `VITE_OPENAI_API_KEY`
- `VITE_SUPABASE_SERVICE_ROLE_KEY`
- `VITE_SUPABASE_SECRET_KEY`

## Backend Server-Only Env

Set these in the **backend** Vercel project.

- `ENVIRONMENT=production`
- `DATABASE_URL=postgresql+psycopg://...`
- `SUPABASE_DATABASE_URL=postgresql+psycopg://...` if you prefer this alias
- `SUPABASE_URL=https://YOUR_PROJECT.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY=...` only if backend-only Supabase admin access is needed later
- `CORS_ALLOWED_ORIGINS=https://your-web-project.vercel.app`
- `MONEYPULSE_DEFAULT_CURRENCY=EUR`
- `MONEYPULSE_MODEL_VERSION=1.0.0`
- `MONEYPULSE_AUTH_SECRET_KEY=long-random-secret`
- `MONEYPULSE_AUTH_MODE=app`
- `MONEYPULSE_AUTH_ACCESS_TOKEN_TTL_MINUTES=720`
- `MONEYPULSE_AUTH_RATE_LIMIT_WINDOW_SECONDS=60`
- `MONEYPULSE_AUTH_RATE_LIMIT_MAX_REQUESTS=10`
- `SUPABASE_JWT_SECRET=` optional, only when `MONEYPULSE_AUTH_MODE=supabase`
- `SUPABASE_JWT_ISSUER=` optional
- `SUPABASE_JWT_AUDIENCE=` optional
- `SUPABASE_JWKS_URL=` optional, documented but not yet executed by the backend verifier
- `MONEYPULSE_COACH_PROVIDER=deterministic`
- `MONEYPULSE_COACH_LLM_ENABLED=false`
- `COPILOT_PROVIDER=mock`
- `COPILOT_LIVE_AI_ENABLED=false`
- `OPENAI_API_KEY=` optional
- `OPENAI_MODEL=` optional
- `COPILOT_MAX_INPUT_CHARS=500`
- `COPILOT_MAX_HISTORY_MESSAGES=12`
- `COPILOT_TIMEOUT_SECONDS=15`
- `MONEYPULSE_LOG_LEVEL=INFO`

Notes:

- The backend supports both the existing `MONEYPULSE_*` env names and the generic aliases above for deployment convenience.
- `MONEYPULSE_AUTH_MODE=app` keeps the current backend-issued JWT flow.
- `MONEYPULSE_AUTH_MODE=demo` is intended only for local/demo environments and lets the backend resolve a deterministic demo user without a bearer token.
- `MONEYPULSE_AUTH_MODE=supabase` prepares backend-side verification for Supabase JWTs when `SUPABASE_JWT_SECRET` is configured.
- If `MONEYPULSE_AUTH_MODE=supabase` is enabled with only `SUPABASE_JWKS_URL`, the backend currently returns a clear auth error because JWKS verification is not implemented yet.
- `OPENAI_API_KEY` is optional and server-only.
- `SUPABASE_SERVICE_ROLE_KEY` must stay server-only.
- If you are only using Supabase Postgres, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` can remain unset for now.
- Sprint 20 persistence works with `DATABASE_URL` or `SUPABASE_DATABASE_URL` alone.

## Supabase Setup

1. Create a new Supabase project.
2. Open the project dashboard.
3. Copy:
   - Project URL
   - anon/publishable key
   - Postgres connection string from the Connect section
   - service role key only if backend-only admin access is needed later
4. Put the Postgres connection string into the backend Vercel project as:
   - `DATABASE_URL`
   or
   - `SUPABASE_DATABASE_URL`
5. If you later wire frontend Supabase features, add:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`

## Migrations And Database Readiness

MoneyPulse already has Alembic migrations under [backend/api/alembic](/root/MONEY%20PULSE/backend/api/alembic).

To apply them against Supabase Postgres locally:

```bash
cd backend/api
MONEYPULSE_DATABASE_URL='postgresql+psycopg://...' ../../.venv/bin/moneypulse-init-db
```

Safe note:

- this applies the existing schema migrations only;
- do not run destructive SQL manually unless you intentionally want to reset the database.
- Sprint 20 adds `user_financial_profiles`, `categories`, `budgets`, and richer persistence columns to the existing financial tables.

Optional demo seed:

```bash
cd backend/api
MONEYPULSE_DATABASE_URL='postgresql+psycopg://...' ../../.venv/bin/python -m app.seed_demo
```

Use the seed only for preview/demo environments.

## Auth Modes

MoneyPulse now supports three backend auth modes:

- `app`
  Uses MoneyPulse-issued bearer tokens from the existing register/login flow. This is the current production-ready path.
- `demo`
  Creates or reuses the deterministic demo user from backend settings and allows authenticated product routes without a bearer token. Use this only for local preview or shared demos.
- `supabase`
  Verifies bearer tokens against `SUPABASE_JWT_SECRET` and then resolves the matching MoneyPulse user by `sub`. This mode is preparatory: if the authenticated Supabase user is not mirrored in the MoneyPulse `users` table, the backend rejects the request instead of inventing a local user record.

Frontend auth behavior:

- `VITE_AUTH_MODE=app` keeps the existing login/register UX.
- `VITE_AUTH_MODE=demo` boots the web app with a deterministic in-memory demo session and sends no bearer token, so it should be paired with backend `demo` auth mode.

## Persistence Data Bundle

Sprint 20 adds:

- `GET /financial-data`
- `GET /financial-profile`
- `PUT /financial-profile`
- `GET /categories`
- `GET /budgets`

The frontend now prefers the backend `financial-data` bundle for persisted profile, categories, budgets, accounts, transactions, recurring items, goals, and bank-connection metadata.

When Supabase is not configured:

- the backend still runs on local SQLite;
- the same API contract works unchanged;
- the frontend does not hard crash and can still fall back to demo-safe defaults.

## RLS Preparation

Prepared Supabase RLS policies live in:

- [supabase/sql/20260712_user_owned_policies.sql](/root/MONEY%20PULSE/supabase/sql/20260712_user_owned_policies.sql)

These policies are intentionally **not auto-applied** in Sprint 20 because the product still authenticates through the backend rather than through Supabase Auth JWT claims. See also [SUPABASE_PERSISTENCE.md](/root/MONEY%20PULSE/docs/03_ENGINEERING/SUPABASE_PERSISTENCE.md).

## Vercel Dashboard Steps

### A. Create The Backend Project

1. Import the GitHub repository into Vercel.
2. Create a project named `moneypulse-api`.
3. Set **Root Directory** to `backend/api`.
4. Add the backend environment variables listed above.
5. Deploy.
6. Verify:
   - `GET https://your-api-project.vercel.app/api/health`
   - `POST https://your-api-project.vercel.app/api/copilot/chat`

Expected:

- `/api/health` returns `{ "ok": true }`
- Copilot still returns mock fallback when live AI is disabled

### B. Create The Web Project

1. Create a second Vercel project named `moneypulse-web`.
2. Point it to the same GitHub repository.
3. Leave **Root Directory** at the repository root.
4. Add the web environment variables listed above.
5. Set `VITE_API_BASE_URL` to the deployed backend URL.
6. Deploy.
7. Verify:
   - the web URL loads;
   - registration/login work;
   - Today loads;
   - Copilot tab still works with mock fallback.

### C. Optional Remote Copilot Preview

Only after the backend route is confirmed:

1. In the web Vercel project, change:
   - `VITE_COPILOT_PROVIDER=remote`
2. Redeploy the web project.
3. Verify Copilot still answers.

The backend will still fall back to deterministic mock unless live AI is explicitly enabled.

## CORS

For the backend Vercel project, set:

- `CORS_ALLOWED_ORIGINS=https://your-web-project.vercel.app`

If you use a custom domain, include that too.

For local development, keep:

- `http://127.0.0.1:4173`
- `http://localhost:4173`

You can provide multiple origins as a comma-separated string.

## Local Docker And Preview Are Still Supported

Docker Compose remains useful for local full-stack validation:

```bash
docker compose up --build -d
```

Smoke test:

```bash
WEB_URL=http://127.0.0.1:14173 \
API_URL=http://127.0.0.1:18000 \
bash scripts/smoke_test.sh
```

## Verification Checklist

- backend deploy responds on `/api/health`
- backend auth works
- backend `/api/copilot/chat` works with mock fallback
- web loads from Vercel
- web points to the correct backend via `VITE_API_BASE_URL`
- Copilot still works with mock by default
- no frontend env contains OpenAI or Supabase service-role secrets

## Manual Steps Still Required

- create the Supabase project
- copy the Postgres connection string into backend env
- set Vercel Preview and Production environment variables in both projects
- create the two separate Vercel projects
- enable `VITE_COPILOT_PROVIDER=remote` only when you intentionally want frontend-to-backend Copilot traffic

## Files To Start From

- Root env template: [.env.example](/root/MONEY%20PULSE/.env.example)
- Web env template: [apps/web/.env.example](/root/MONEY%20PULSE/apps/web/.env.example)
- Backend env template: [backend/api/.env.example](/root/MONEY%20PULSE/backend/api/.env.example)
- Web Vercel config: [vercel.json](/root/MONEY%20PULSE/vercel.json)
- Backend Vercel config: [backend/api/vercel.json](/root/MONEY%20PULSE/backend/api/vercel.json)
