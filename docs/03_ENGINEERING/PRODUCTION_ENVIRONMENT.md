# Production Environment

Version: 1.0
Status: Draft
Owner: Engineering

## Goal

Prepare MoneyPulse for a small private beta without changing the documented product behavior.

## Environment Shape

- Web app served as a production Vite build with PWA basics enabled.
- API served through FastAPI with PostgreSQL persistence.
- Decision Engine still runs through the shared deterministic TypeScript core.
- Coach defaults to deterministic mode.

## Required Backend Env

- `MONEYPULSE_ENVIRONMENT=production`
- `MONEYPULSE_DATABASE_URL`
- `MONEYPULSE_CORS_ALLOW_ORIGINS`
- `MONEYPULSE_AUTH_SECRET_KEY`
- `MONEYPULSE_AUTH_ACCESS_TOKEN_TTL_MINUTES`
- `MONEYPULSE_AUTH_RATE_LIMIT_WINDOW_SECONDS`
- `MONEYPULSE_AUTH_RATE_LIMIT_MAX_REQUESTS`
- `MONEYPULSE_COACH_PROVIDER`
- `MONEYPULSE_COACH_LLM_ENABLED`
- `MONEYPULSE_LOG_LEVEL`

Reference: `backend/api/.env.production.example`

## Required Frontend Env

- `VITE_APP_ENV=production`
- `VITE_DEFAULT_CURRENCY`
- `VITE_API_BASE_URL`

Reference: `apps/web/.env.production.example`

## Production Safety Rules

- Keep the Decision Engine deterministic.
- Do not enable paid external AI by default.
- Keep auth endpoints rate limited.
- Keep request logging structured.
- Keep readiness tied to database availability.
- Keep export and deletion endpoints available to authenticated users.

## Operational Checks

- `GET /health` must answer basic liveness.
- `GET /ready` must confirm database readiness.
- `scripts/smoke_test.sh` must pass against the deployed stack.
- `WEB_URL` and `API_URL` are the preferred smoke-test overrides for local, CI, and deployed environments.
- If a sandbox blocks host port access, `SMOKE_TEST_ALLOW_DOCKER_FALLBACK=1` may be used to validate the same flow from inside running Docker containers.
