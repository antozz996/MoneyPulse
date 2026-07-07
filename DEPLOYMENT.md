# Deployment README

## Private Beta Stack

MoneyPulse private beta runs as:

- `db`: PostgreSQL
- `api`: FastAPI + deterministic core adapter
- `web`: Vite production preview serving the built web app

## Production Env Files

- Backend template: [backend/api/.env.production.example](/root/MONEY%20PULSE/backend/api/.env.production.example)
- Frontend template: [apps/web/.env.production.example](/root/MONEY%20PULSE/apps/web/.env.production.example)
- Environment guide: [PRODUCTION_ENVIRONMENT.md](/root/MONEY%20PULSE/docs/03_ENGINEERING/PRODUCTION_ENVIRONMENT.md)

## Start With Docker Compose

```bash
docker compose up --build -d
```

Default local ports:

- Web: `http://127.0.0.1:14173`
- API: `http://127.0.0.1:18000`

## Smoke Test

Run after the stack is healthy:

```bash
MONEYPULSE_WEB_BASE_URL=http://127.0.0.1:14173 \
MONEYPULSE_API_BASE_URL=http://127.0.0.1:18000 \
bash scripts/smoke_test.sh
```

Override endpoints when needed:

```bash
MONEYPULSE_WEB_BASE_URL=https://app.example.com \
MONEYPULSE_API_BASE_URL=https://api.example.com \
bash scripts/smoke_test.sh
```

## Readiness Checklist

- `GET /health` returns `ok`
- `GET /ready` returns `ready`
- Web root loads
- User registration works
- Today and Coach endpoints answer for an authenticated user
- PWA manifest and service worker are served by the web app

## Privacy Notes

- User export is available through `GET /me/export`
- User deletion is available through `DELETE /me`
- Bank sync stores no bank credentials
- Coach stays deterministic by default
