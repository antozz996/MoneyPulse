# MoneyPulse

**Decision Intelligence for Personal Finance.**

MoneyPulse helps people understand how much they can safely spend today and what happens before they buy something.

## Product Promise

> Know tomorrow. Decide today.

## MVP Promise

> In under 30 seconds, MoneyPulse tells the user how much they can safely spend today.

## Core Experiences

1. **Today** — daily financial briefing.
2. **Before You Buy** — purchase simulation before spending.
3. **Money** — accounts, cash flow and transactions.
4. **Goals** — saving goals and future impact.
5. **Settings** — bank sync controls while manual mode stays available.

## Architecture

MoneyPulse starts as a modular monolith with a shared TypeScript core.

- `apps/web` — React + Vite + TypeScript PWA.
- `backend/api` — FastAPI + PostgreSQL.
- `packages/core` — pure Decision Engine.
- `packages/ui` — shared UI components.
- `docs` — source of truth for product and engineering.

## Operating Rule

Documentation is the source of truth. Code follows documentation.

## Run Locally

### Prerequisites

- Node.js 20+
- `pnpm` via Corepack
- Python 3.11+

### Install

```bash
corepack pnpm@10.22.0 install
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -e backend/api[dev]
```

### Frontend Env

Use [apps/web/.env.example](/root/MONEY%20PULSE/apps/web/.env.example) as the starting point.

- `VITE_API_PROXY_TARGET` is the easiest local setup because the browser stays on one origin.
- `VITE_API_BASE_URL` is useful when the frontend must call a separate backend origin directly.
- `VITE_DEFAULT_CURRENCY` controls the initial form currency.

### Start The Backend

```bash
cd backend/api
../../.venv/bin/moneypulse-init-db
MONEYPULSE_CORS_ALLOW_ORIGINS=http://127.0.0.1:4173 ../../.venv/bin/uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

Optional demo data:

```bash
cd backend/api
../../.venv/bin/python -m app.seed_demo
```

Database notes:

- `moneypulse-init-db` applies Alembic migrations to the configured database.
- Existing local databases from earlier foundations are bootstrapped to the current schema and then stamped to the latest revision.
- Demo mode still uses a single shared user and intentionally does not include authentication.

### Start The Frontend

```bash
cd /root/MONEY\ PULSE
VITE_API_PROXY_TARGET=http://127.0.0.1:8000 corepack pnpm@10.22.0 --filter @moneypulse/web dev
```

Open `http://127.0.0.1:4173/`.

## Authentication

- MoneyPulse now requires a real user account instead of demo-only access.
- Register from the web app with name, email, and password.
- The frontend stores the JWT access token locally and sends it as a bearer token on protected API requests.
- `POST /auth/logout` clears the current web session; because access tokens are stateless, local logout is the source of truth for ending the session.

### Backend Auth Env

- `MONEYPULSE_AUTH_SECRET_KEY` configures JWT signing.
- `MONEYPULSE_AUTH_ACCESS_TOKEN_TTL_MINUTES` controls access token lifetime and defaults to `720`.

### Local CORS Notes

- Development defaults allow the local Vite origins used by MoneyPulse.
- Production is closed by default unless `MONEYPULSE_CORS_ALLOW_ORIGINS` is explicitly set.
- If you use `VITE_API_BASE_URL`, make sure the backend origin is listed in `MONEYPULSE_CORS_ALLOW_ORIGINS`.

## Bank Sync Foundation

- Sprint 8 adds a mock open-banking provider that simulates a GoCardless/Nordigen-style connect and sync flow.
- The backend never stores bank credentials and does not call a paid provider yet.
- Imported balances create or refresh linked accounts, and imported posted transactions appear in both Money and Today.
- Duplicate imports are prevented with external transaction tracking.
- Manual mode remains available even if no bank connection is active or after a connection is disconnected.

## Verification

```bash
corepack pnpm@10.22.0 --filter @moneypulse/core test
cd backend/api && ../../.venv/bin/pytest
cd /root/MONEY\ PULSE && corepack pnpm@10.22.0 --filter @moneypulse/web test
cd /root/MONEY\ PULSE && MONEYPULSE_PYTHON_BIN=/root/MONEY\ PULSE/.venv/bin/python PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/google-chrome corepack pnpm@10.22.0 --filter @moneypulse/web test:e2e
cd /root/MONEY\ PULSE && corepack pnpm@10.22.0 typecheck
cd /root/MONEY\ PULSE && corepack pnpm@10.22.0 build
```

Sprint 6 adds persistent CRUD for accounts, transactions, goals, recurring events, and checkpoints. The mobile web app now supports editing and deleting accounts, transactions, and goals, plus recurring event management against the real backend.
Sprint 7 adds multi-user registration, login, logout, protected REST endpoints, and authenticated frontend sessions.
