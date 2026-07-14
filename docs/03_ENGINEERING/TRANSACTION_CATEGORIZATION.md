# Transaction Categorization

## Goal

MoneyPulse categorizes manual and imported transactions with a deterministic backend pipeline.

The categorizer is designed to:

- stay explainable;
- never depend on live AI;
- learn only from the current user's corrections;
- improve CSV import preview and manual-entry guidance without forcing categories automatically.

## Matching Order

The backend evaluates category suggestions in this order:

1. explicit category selected by the user
2. learned user rule from a previous correction
   exact rules are checked before partial (`contains` or `prefix`) rules
3. exact known merchant alias
4. deterministic system rule
5. historical user transaction match
6. uncategorized fallback

This order is intentional:

- explicit user choice always wins;
- learned user corrections beat generic alias or system logic;
- merchant aliases stay conservative and beat generic system rules;
- system rules only help when the user has not taught the app a better answer yet and no strong alias match exists;
- historical matches are a later fallback than explicit rules, aliases, and system rules.

## Normalization

Normalization is deterministic and local.

It currently handles:

- case folding;
- accent removal;
- punctuation cleanup;
- common payment/banking prefixes such as `PAYPAL`, `POS`, and `ADDEBITO SEPA`;
- simple merchant noise tokens such as marketplace or location suffixes when they do not add category signal.

Examples:

- `PAYPAL *NETFLIX.COM` -> `Netflix`
- `POS ESSO NAPOLI 1234` -> `Esso`
- `AMZN MKTP IT` -> `Amazon`
- `ADDEBITO SEPA VODAFONE` -> `Vodafone`

The normalizer is conservative on purpose. If the backend cannot derive a reliable merchant identity, it keeps the suggestion low-confidence instead of over-merging unrelated payees.

## Confidence

Confidence is bounded between `0` and `1`.

Current intent:

- exact user correction: highest confidence
- known merchant alias: high confidence
- partial learned rule: medium-high confidence
- historical match: medium confidence
- generic system rule: cautious confidence
- fallback: low confidence and `needs_review = true`

Confidence is meant for UX prioritization, not for silently auto-committing categories.

## Stored Learning

User correction learning is stored in:

- `transaction_categorization_rules`

Each rule is scoped by:

- `user_id`
- `normalized_pattern`
- `match_type`

Rules also store:

- `category_id`
- `normalized_merchant`
- `priority`
- `source`
- `usage_count`
- `confidence`
- `is_active`

## API Surface

Routes:

- `POST /transactions/categorize`
- `POST /transactions/{transaction_id}/categorization-feedback`
- `POST /transactions/recategorize`
- `POST /transactions/import/preview`
- `POST /transactions/import/commit`

### `POST /transactions/categorize`

Use this for:

- manual-entry suggestions
- CSV preview enrichment
- future bank-sync preview flows

It returns structured suggestion data, including:

- `suggested_category_id`
- `normalized_merchant`
- `confidence`
- `matched_rule_source`
- `explanation`
- `needs_review`
- `warnings`

### `POST /transactions/{transaction_id}/categorization-feedback`

Use this when a user confirms or corrects a category and optionally wants the correction to apply to similar future transactions.

### `POST /transactions/recategorize`

Use this to preview or commit suggestions for existing transactions.

Rules:

- bounded batch size
- current user only
- dry-run by default
- no cross-user access

## CSV Import Integration

CSV preview rows now carry categorization metadata directly.

Important fields:

- `category_id`
- `suggested_category_id`
- `normalized_merchant`
- `confidence`
- `explanation`
- `matched_rule_source`
- `needs_review`
- `apply_to_similar`

This keeps import review grounded in backend outputs instead of duplicating heuristics in the frontend.

## Import Commit Interaction

CSV import does not trust the preview blindly.

- preview returns a deterministic `preview_fingerprint`;
- commit recomputes that fingerprint from the immutable preview content plus detected mapping;
- user review choices such as `selected`, `account_id`, `category_id`, and `apply_to_similar` remain separately editable and revalidated;
- commit is rejected if the source-derived preview payload was changed after preview instead of re-previewed.

## Privacy And Isolation

- rules are stored per user;
- no client payload can choose another `user_id`;
- user corrections never affect another user's categorization;
- raw transaction data is not sent to external AI providers for categorization in this sprint.

## Current Limitations

- regex rule matching is intentionally not enabled;
- the system rule catalog is intentionally small and maintainable;
- recurring-event create, edit, and delete coverage now runs in the private-beta Playwright suite and is tracked independently from categorization logic.
