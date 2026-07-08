# Beta Release Checklist

Version: 1.0
Status: Draft
Owner: Engineering + Product

## Goal

Confirm that MoneyPulse is ready for a private beta without adding new product scope.

## Product QA

- Registration creates a private user account successfully.
- Login restores access to the existing account successfully.
- Logout clears the local session and returns to the auth screen.
- Account create, edit, and delete flows work end to end.
- Transaction create, edit, and delete flows work end to end.
- Goal create, edit, and delete flows work end to end.
- Recurring event create, edit, and delete flows work end to end.
- Mock bank connection can be created, synced, and disconnected.
- Today shows a real safe-to-spend answer from backend data.
- Before You Buy returns a real deterministic decision.
- Coach cards render real deterministic explanations for Today and Before You Buy.
- `GET /me/export` returns a privacy-first data export for the authenticated user.
- `DELETE /me` removes the authenticated user account and invalidates future access.

## UX QA

- Loading states are visible for auth, Today, resource lists, and coach cards.
- Empty states explain what the user should add next.
- Error states explain backend reachability or request failures clearly.
- Unauthorized states return the user to login with a session-expired message.
- Network-unavailable states explain offline or unreachable API conditions clearly.
- Mobile layouts are usable at `360px`, `390px`, and `430px`.
- Tablet layout is usable at `768px` width.
- No horizontal overflow appears on the main product screens.

## Automated Verification

- `cd backend/api && ../../.venv/bin/pytest`
- `corepack pnpm@10.22.0 test`
- `corepack pnpm@10.22.0 --filter @moneypulse/web test:e2e`
- `corepack pnpm@10.22.0 typecheck`
- `corepack pnpm@10.22.0 build`

## Docker Verification

- Start from a clean stack with `docker-compose down --remove-orphans`.
- Rebuild with `docker-compose up --build -d`.
- Confirm `docker-compose ps` reports healthy `db`, `api`, and `web`.
- Run `WEB_URL=http://127.0.0.1:14173 API_URL=http://127.0.0.1:18000 bash scripts/smoke_test.sh`.
- If host ports are blocked by a sandbox, use `SMOKE_TEST_ALLOW_DOCKER_FALLBACK=1`.

## Release Gate

- `CHANGELOG.md` is updated.
- `README.md` reflects the current beta setup.
- `docs/KNOWN_LIMITATIONS.md` reflects all non-blocking limitations.
- No known blocker remains for the private beta.
