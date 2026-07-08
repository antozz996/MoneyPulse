# Known Limitations

Version: 1.0
Status: Draft
Owner: Product + Engineering

## Purpose

Track non-blocking limitations that remain acceptable for the MoneyPulse private beta.

## Current Limitations

- Bank sync uses only the mock provider today. Real open-banking providers are not enabled yet.
- Data export and account deletion are available through authenticated API endpoints, not through a dedicated web settings flow yet.
- The PWA currently offers an offline-friendly shell only. Authenticated data refresh and mutations still require a live backend connection.
- Password reset, email verification, and account recovery flows are not implemented yet.
- The Coach remains deterministic by default and does not use a paid external AI provider.
- Docker Compose is the supported beta stack for local validation. A production reverse proxy or CDN layer is not included in this repository.

## Beta Interpretation

These limitations do not block a private beta because the core daily decision loop, authenticated data isolation, mock bank validation, privacy endpoints, and deterministic explanations are all available today.
