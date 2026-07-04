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
5. **Insights** — useful patterns, not vanity charts.

## Architecture

MoneyPulse starts as a modular monolith with a shared TypeScript core.

- `apps/web` — React + Vite + TypeScript PWA.
- `backend/api` — FastAPI + PostgreSQL.
- `packages/core` — pure Decision Engine.
- `packages/ui` — shared UI components.
- `docs` — source of truth for product and engineering.

## Operating Rule

Documentation is the source of truth. Code follows documentation.
