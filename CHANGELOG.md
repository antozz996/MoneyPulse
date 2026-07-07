# Changelog

All notable changes to MoneyPulse will be documented in this file.

## 2026-07-07

### Changed

- Replaced the static `apps/web` placeholder with a mobile-first MVP connected to the real backend endpoints for Today, Before You Buy, Money, Goals, and Insights.
- Added a typed frontend API client, currency/date formatting helpers, and real loading, empty, and error states across the main screens.
- Wired the Today screen to `GET /today` and the purchase check flow to `POST /before-you-buy`, including confidence, reasons, next checkpoint, and optional alternatives rendering.
- Added real account, transaction, and goal management flows backed by the API foundation instead of mocked financial values.
- Added frontend Vitest coverage for shared formatting helpers and updated the Vite setup so local development can proxy to the configured backend target.
- Added configurable backend CORS handling for local, development, and production deployment shapes.
- Added an idempotent demo seed command for the backend so the MVP can be populated quickly in local and beta environments.
- Added frontend environment scaffolding, improved recovery messaging for API failures, and clearer empty states across Money, Goals, Buy, and Insights.
- Added Playwright end-to-end coverage for account creation, transaction creation, goal creation, Today loading, and the Before You Buy decision flow.
- Added a GitHub Actions workflow that runs core tests, backend tests, frontend tests, full typecheck, build, and Playwright validation.
- Expanded the root and backend README instructions for running the full stack locally, seeding demo data, and validating the MVP.

## 2026-07-06

### Added

- Established the MoneyPulse foundation documentation across governance, product, engineering, AI, and management.
- Scaffolded the monorepo structure for `apps/web`, `backend/api`, `packages/core`, and `packages/ui`.
- Added initial TypeScript workspace configuration and FastAPI service skeletons.

### Changed

- Rebuilt `packages/core` as a pure TypeScript Decision Engine foundation with domain entities, value objects, and a reusable engine skeleton.
- Added deterministic `calculateAvailableToSpend()`, `evaluatePurchase()`, `forecast()`, and `confidence()` flows based only on documented inputs.
- Added Vitest coverage-backed unit tests for the Decision Engine foundation with `95%+` coverage enforcement.
- Replaced the backend scaffold with a FastAPI foundation that includes demo-user mode, SQLAlchemy models, repository and service layers, and REST endpoints for accounts, transactions, goals, today, and before-you-buy.
- Connected `backend/api` to `packages/core` through a dedicated Node adapter so the API uses the documented decision logic instead of duplicating it.
- Added end-to-end backend endpoint tests covering health, CRUD foundations, today briefing, and before-you-buy evaluation.
