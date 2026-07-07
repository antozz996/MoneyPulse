# MoneyPulse API

FastAPI foundation for MoneyPulse orchestration, persistence, and REST contracts.

## Endpoints

- `GET /health`
- `GET /ready`
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /me/export`
- `DELETE /me`
- `POST /bank/connect/start`
- `POST /bank/connect/complete`
- `GET /bank/connections`
- `DELETE /bank/connections/{connection_id}`
- `POST /bank/sync`
- `GET /accounts`
- `POST /accounts`
- `PUT /accounts/{account_id}`
- `DELETE /accounts/{account_id}`
- `GET /transactions`
- `POST /transactions`
- `PUT /transactions/{transaction_id}`
- `DELETE /transactions/{transaction_id}`
- `GET /goals`
- `POST /goals`
- `PUT /goals/{goal_id}`
- `DELETE /goals/{goal_id}`
- `GET /recurring-events`
- `POST /recurring-events`
- `PUT /recurring-events/{recurring_event_id}`
- `DELETE /recurring-events/{recurring_event_id}`
- `GET /checkpoints`
- `POST /checkpoints`
- `PUT /checkpoints/{checkpoint_id}`
- `DELETE /checkpoints/{checkpoint_id}`
- `GET /today`
- `POST /before-you-buy`
- `POST /coach/explain-decision`
- `GET /coach/today-summary`
- `GET /coach/weekly-summary`

## Goal

Keep the API thin while the Decision Engine remains deterministic, explainable, and well documented.

## Local Notes

- CORS is configurable through `MONEYPULSE_CORS_ALLOW_ORIGINS`.
- Development defaults allow the local MoneyPulse Vite origins.
- Production stays closed unless allowed origins are explicitly configured.
- Initialize persistent databases with `moneypulse-init-db`.
- Schema changes are managed through Alembic in [backend/api/alembic](/root/MONEY%20PULSE/backend/api/alembic).
- Demo data can be seeded with `python -m app.seed_demo`.
- Validation and not-found responses return a stable JSON envelope under `error`.
- Authenticated data endpoints require `Authorization: Bearer <token>`.
- Access tokens are signed with `MONEYPULSE_AUTH_SECRET_KEY`.
- Auth endpoints use basic in-memory rate limiting keyed by client IP or forwarded IP.
- Production logging is structured and includes a request ID per response.
- Bank sync currently uses a deterministic mock provider for local development and tests.
- Imported bank transactions are tracked to prevent duplicates across repeated sync runs.
- Manual account and transaction entry remains available even when bank sync is enabled.
- Coach explanations default to a deterministic provider that only explains existing engine outputs.
- The optional LLM coach interface is disabled by default and never replaces the Decision Engine result.
- Authenticated users can export their data through `GET /me/export` and permanently delete their account through `DELETE /me`.
