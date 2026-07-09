# Changelog

All notable changes to MoneyPulse will be documented in this file.

## 2026-07-08

### Changed

- Added a frontend internationalization foundation with Italian, English, French, and Spanish dictionaries, browser-language detection on first visit, local language persistence, and a settings-based language selector.
- Extracted the web app's visible UI copy into translation dictionaries and localized auth, Today, Before You Buy, Money, Goals, Settings, bank sync, coach cards, and loading, empty, and error states.
- Added locale-aware date and currency formatting helpers plus frontend tests for language detection, persistence, switching helpers, translated copy, and formatting behavior.
- Updated the web client to render localized deterministic Today and Before You Buy explanations from structured backend data instead of depending on backend English prose.
- Hardened the web client for private-beta QA with typed API errors, clearer offline messaging, and automatic session-expiry recovery back to the login screen.
- Fixed hash-based screen navigation so direct `#today`, `#money`, `#goals`, `#buy`, and `#insights` links stay in sync after in-app navigation.
- Polished small-screen layouts for the MoneyPulse mobile surfaces and added automated responsive overflow coverage for `360px`, `390px`, `430px`, and tablet widths.
- Expanded Playwright coverage to include logout and session recovery, mock bank sync, coach-backed Today validation, and responsive layout verification.
- Added frontend API-client tests for authentication and network error handling, plus backend privacy coverage for export data that includes recurring events and bank connections.
- Added a beta release checklist and known-limitations documents, and expanded the README with a cleaner Docker, smoke-test, and beta-QA setup path.

## 2026-07-09

### Changed

- Added a centralized frontend financial engine under `apps/web/src/lib/engine` with pure deterministic modules for money math, salary-cycle handling, recurring expansion, budgets, goals, risk assessment, affordability simulation, forecasting, and deterministic explanations.
- Added frontend unit coverage for salary-cycle behavior, calendar fallback, real availability, protected balance breach, safe daily spend, goal priorities, installment simulation, and GREEN/YELLOW/RED/BLACK affordability decisions.
- Refactored the web app to consume the new engine for financial summaries, next-checkpoint forecasting, and purchase/coach explanation inputs so UI components no longer perform the main financial calculations directly.
- Added a deterministic AI Copilot foundation under `apps/web/src/lib/ai` with intent classification, safe engine-backed copilot tools, minimal structured context building, a non-inventive system prompt, and a mock copilot that answers supported finance questions without any live AI dependency.
- Added frontend unit coverage for copilot intent routing, tool wrappers, prompt safety rules, survival-plan generation, unknown-intent fallback, and affordability answers grounded in engine outputs.
- Added a user-facing Copilot screen to the web app with localized suggested prompts, an in-memory conversation thread, deterministic mock answers, and mobile-first UI wired only to existing engine-backed copilot tools.
- Added frontend and Playwright coverage for Copilot rendering, prompt sending, supported and unknown questions, and deterministic mock replies with no live AI or API dependency.
- Added a provider-based Copilot adapter layer with `copilotService`, a default mock provider, and a safely gated OpenAI provider stub that falls back without requiring keys, network calls, or a live backend path.
- Refactored the Copilot UI to call the provider service instead of the mock directly, while preserving the existing deterministic behavior, local in-memory history, and E2E flow.

## 2026-07-07

### Changed

- Fixed the Docker web healthcheck so the container validates its own internal preview URL without depending on `curl`, and aligned local Docker CORS defaults with the published `14173` web port.
- Updated the smoke test to accept `WEB_URL` and `API_URL`, added a Docker-internal fallback for sandboxed environments that block host port access, and documented the local and CI usage more clearly.
- Added private-beta operational foundations with Docker Compose, backend and frontend production env templates, a deployment README, and a smoke test script.
- Added PWA installability basics for the web app, including a manifest, app icons, service worker registration, and an offline-friendly shell cache.
- Added privacy-first `GET /me/export` and `DELETE /me` endpoints so authenticated users can export or remove their MoneyPulse data.
- Added backend readiness checks, structured request logging with request IDs, and basic auth rate limiting for register and login endpoints.
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
