# Decision Engine

Version: 1.0
Status: Draft
Owner: AI + Product

## Purpose

The Decision Engine converts financial context into a clear, deterministic recommendation about what the user can safely spend.

## Primary Output

The main output is `safeToSpendToday`.

This number answers the product's most important question without requiring the user to interpret a spreadsheet.

## Input Model

The foundation model uses:

- available balance today;
- income expected today;
- essential obligations due soon;
- already committed discretionary spending;
- required safety buffer;
- planned goal contributions.

## Output Model

The foundation output contains:

- safe-to-spend amount;
- risk level;
- short explanation list;
- model version;
- key normalized values used for the result.

## Core Rule

`safeToSpendToday = max(0, available + expectedIncome - essentials - commitments - buffer - goals)`

The formula may evolve, but every evolution must remain explainable and versioned.

## Decision Labels

- `safe` when discretionary headroom is healthy.
- `caution` when headroom exists but is tight.
- `hold` when spending would likely create stress or shortfall.

## Explainability Rules

- Show the top drivers of the decision.
- Avoid opaque confidence language.
- Use user-friendly wording while preserving numerical truth.
- Always include the model version.

## Determinism Rules

- Same input must yield the same output.
- No randomization in production recommendations.
- No hidden state between runs.
- No external API call is allowed inside the core calculation path.

## Model Governance

Any future heuristic or ML-assisted layer must:

- sit outside the deterministic core unless explicitly approved;
- never replace the explainable baseline without measurable gains;
- degrade gracefully to deterministic mode.

## First Engine Responsibilities

- daily affordability;
- pre-purchase simulation;
- future-impact explanation;
- goal tradeoff summary.

