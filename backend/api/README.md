# MoneyPulse API

FastAPI foundation for MoneyPulse orchestration, persistence, and REST contracts.

## Endpoints

- `GET /health`
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
