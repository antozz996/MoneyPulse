# Tasks

Version: 1.0
Status: Draft
Owner: Management

## Current Program

Build the MoneyPulse foundation around a documented product, a deterministic decision engine, and a minimal product skeleton.

## Milestones

### Milestone 1: Foundation

- Finalize governance, product, engineering, AI, and management documents.
- Create the monorepo structure.
- Establish the Decision Engine package contract.
- Stand up a basic web shell and backend health endpoint.

### Milestone 2: First Working Loop

- Implement manual onboarding for core financial inputs.
- Compute safe-to-spend with core package logic.
- Render daily recommendation in the web app.
- Expose decision endpoints in the API.

### Milestone 3: Before You Buy

- Add purchase simulation workflow.
- Show recommendation delta after a hypothetical purchase.
- Add explanation messaging for tradeoffs.

### Milestone 4: Persistence

- Introduce PostgreSQL schema for users, accounts, obligations, and goals.
- Persist normalized inputs and recommendation snapshots.

## Immediate Backlog

- Add package installation instructions and CI workflow.
- Implement unit tests for `packages/core`.
- Add API contract tests.
- Create onboarding and daily briefing screens.
- Define data model for obligations and goals.

## Definition Of Done

- Documentation is updated.
- Changelog is updated.
- Core logic is deterministic and tested.
- API and web layers only implement documented behavior.

