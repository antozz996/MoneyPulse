# MoneyPulse API

FastAPI foundation for MoneyPulse orchestration, persistence, and REST contracts.

## Initial Endpoints

- `GET /health`
- `GET /accounts`
- `POST /accounts`
- `GET /transactions`
- `POST /transactions`
- `GET /goals`
- `POST /goals`
- `GET /today`
- `POST /before-you-buy`

## Goal

Keep the API thin while the Decision Engine remains deterministic, explainable, and well documented.

## Local Notes

- CORS is configurable through `MONEYPULSE_CORS_ALLOW_ORIGINS`.
- Development defaults allow the local MoneyPulse Vite origins.
- Production stays closed unless allowed origins are explicitly configured.
- Demo data can be seeded with `python -m app.seed_demo`.
