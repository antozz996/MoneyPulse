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
- no live AI or Supabase client logic needs to be enabled yet.

## Current Supabase Status

MoneyPulse is **not yet wired to a Supabase client SDK in the frontend**.

Supabase is only relevant today as a deployment-ready backend platform:

- use the **Project URL** and **anon/publishable key** only when frontend Supabase features are introduced later;
- use the **Postgres connection string** now if you want the FastAPI backend to run against Supabase Postgres;
- use the **service role key** only for future backend-only operations that require it.

For Sprint 18, the live preview can already work with:

- Vercel-hosted frontend
- Vercel-hosted FastAPI backend
- Supabase Postgres as the database, if you want persistent cloud data

The app does **not** need live OpenAI.
The Copilot remains on deterministic mock fallback by default.

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
- `VITE_DEFAULT_CURRENCY=EUR`
- `VITE_API_BASE_URL=https://your-api-project.vercel.app`
- `VITE_COPILOT_PROVIDER=mock`
- `VITE_COPILOT_ENABLE_LIVE=false`
- `VITE_COPILOT_BACKEND_PATH=/api/copilot/chat`
- `VITE_SUPABASE_URL=...`
- `VITE_SUPABASE_ANON_KEY=...`

Notes:

- `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are safe to expose publicly.
- `VITE_SUPABASE_PUBLISHABLE_KEY` can be used instead of `VITE_SUPABASE_ANON_KEY` if you standardize on that naming later.
- `VITE_API_BASE_URL` is required when the frontend calls the separate backend project.
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
- `MONEYPULSE_AUTH_ACCESS_TOKEN_TTL_MINUTES=720`
- `MONEYPULSE_AUTH_RATE_LIMIT_WINDOW_SECONDS=60`
- `MONEYPULSE_AUTH_RATE_LIMIT_MAX_REQUESTS=10`
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
- `OPENAI_API_KEY` is optional and server-only.
- `SUPABASE_SERVICE_ROLE_KEY` must stay server-only.
- If you are only using Supabase Postgres, `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` can remain unset for now.

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

Optional demo seed:

```bash
cd backend/api
MONEYPULSE_DATABASE_URL='postgresql+psycopg://...' ../../.venv/bin/python -m app.seed_demo
```

Use the seed only for preview/demo environments.

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
