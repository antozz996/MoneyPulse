# Changelog

All notable changes to MoneyPulse will be documented in this file.

## 2026-07-07

### Changed

- Added an AI Coach layer with deterministic fallback summaries for Today, Before You Buy, and a 7-day weekly view, all grounded in existing Decision Engine outputs.
- Added backend Coach service abstraction, provider registry, and an optional LLM interface that stays disabled by default and falls back to deterministic mode.
- Added new authenticated coach endpoints for decision explanation, daily summary, and weekly summary, plus API tests proving the Coach does not override engine outputs.
- Added frontend Coach cards inside Today and Before You Buy with clear sections for why the result looks safe or risky, what changed, and what to do next.
- Added a bank sync foundation with a mock open-banking provider, provider abstraction layer, and new REST endpoints for connect, complete, list, disconnect, and sync flows.
- Added persistent bank connection, bank account mapping, and imported transaction tracking models plus an Alembic migration for the new schema.
- Imported bank balances now create or refresh linked accounts, imported posted transactions appear in Money and Today, and duplicate imports are prevented across repeated syncs.
- Expanded the mobile web app with a Settings-based bank sync screen, explicit manual-mode messaging, and source badges that distinguish manual records from imported ones.
- Added backend coverage for provider determinism, end-to-end mock sync behavior, duplicate prevention, and authenticated user isolation for bank connections.
- Added real multi-user authentication with registration, login, logout, password hashing, and JWT bearer access tokens.
- Protected all user data endpoints and scoped accounts, transactions, goals, recurring events, checkpoints, Today, and Before You Buy to the authenticated user.
- Added backend auth services, schemas, security helpers, and Alembic migration support for user email and password hash fields.
- Added frontend authentication screens, local session persistence, automatic bearer-token usage, and logout handling.
- Added backend auth coverage for registration, login, duplicate email rejection, invalid credentials, endpoint protection, and cross-user data isolation.
- Added Alembic migration scaffolding plus a `moneypulse-init-db` command so backend schema setup no longer depends only on metadata creation.
- Expanded backend persistence with update and delete endpoints for accounts, transactions, and goals, plus CRUD foundations for recurring events and checkpoints.
- Added structured backend validation and not-found error responses with a stable JSON `error` envelope for frontend and test consumers.
- Updated the decisioning adapter so recurring events can contribute deterministic income and spending to the `/today` snapshot.
- Expanded the mobile web app with real edit and delete flows for accounts, transactions, and goals, and added recurring event management against the live backend.
- Extended Playwright coverage to the persistent create, edit, and delete flows used in daily data management.
- Fixed lingering merge markers in `packages/core` tests and tightened coverage configuration so the core test gate measures source files only.
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
