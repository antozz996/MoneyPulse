# Architecture

Version: 1.0
Status: Draft
Owner: Engineering

## System Shape

MoneyPulse starts as a modular monolith with clear boundaries and a shared TypeScript decision core.

## Repository Structure

- `apps/web` contains the customer-facing web app and PWA shell.
- `backend/api` contains the REST API, orchestration endpoints, and persistence-facing backend.
- `packages/core` contains deterministic decision logic and shared domain types.
- `packages/ui` contains reusable UI primitives for the web product.
- `docs` contains the source of truth for product and engineering decisions.

## Architectural Rules

- Core business logic lives in `packages/core`.
- UI packages may format data but must not redefine core financial rules.
- Backend coordinates I/O, auth, storage, and integrations, but decision logic must remain explicit and testable.
- Contracts between backend and clients must be simple REST payloads.

## Bounded Responsibilities

### Web

Owns presentation, interaction, local state, and explanation rendering.

### API

Owns request validation, persistence, authentication, and orchestration of external systems.

### Core

Owns deterministic affordability rules, simulation logic, explanation generation, and shared financial vocabulary.

### UI

Owns reusable presentational building blocks and design consistency.

## Data Flow

1. The client captures user inputs or synchronized financial data.
2. The API validates and stores raw data.
3. The Decision Engine receives normalized inputs and returns recommendation outputs plus explanations.
4. The client renders the recommendation and decision context.

## Foundation Technology Choices

- Frontend: React, Vite, TypeScript.
- Backend: FastAPI, PostgreSQL.
- Core: TypeScript, pure functions, no side effects.
- UI: React component package.

## Persistence Boundary

Database models must never leak directly into the Decision Engine.

The engine operates on normalized domain inputs, not ORM entities.

## Explainability Boundary

Every recommendation response must include:

- the primary number;
- the confidence or risk label;
- the top reasons;
- the model version used.

## Evolution Path

Phase 1 is a modular monolith.

Phase 2 may extract services only when the product proves clear scale or ownership boundaries.

## Quality Bar

- strict TypeScript for product packages;
- pure core logic;
- thin API controllers;
- documented decisions before implementation;
- tests for all core financial rules.

