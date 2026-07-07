#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${MONEYPULSE_API_BASE_URL:-http://127.0.0.1:8000}"
WEB_BASE_URL="${MONEYPULSE_WEB_BASE_URL:-http://127.0.0.1:4173}"
STAMP="$(date +%s)"
EMAIL="smoke-${STAMP}@example.com"

echo "Checking web shell at ${WEB_BASE_URL}"
curl -fsS "${WEB_BASE_URL}/" >/dev/null

echo "Checking API health"
curl -fsS "${API_BASE_URL}/health" >/dev/null
curl -fsS "${API_BASE_URL}/ready" >/dev/null

echo "Registering a smoke-test user"
REGISTER_RESPONSE="$(
  curl -fsS -X POST "${API_BASE_URL}/auth/register" \
    -H 'Content-Type: application/json' \
    -d "{\"name\":\"Smoke Test\",\"email\":\"${EMAIL}\",\"password\":\"password123\"}"
)"

ACCESS_TOKEN="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["access_token"])' <<<"${REGISTER_RESPONSE}")"

echo "Creating a baseline account"
curl -fsS -X POST "${API_BASE_URL}/accounts" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Smoke cash","balance":850,"currency":"EUR"}' >/dev/null

echo "Validating deterministic decision and coach endpoints"
curl -fsS "${API_BASE_URL}/today" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" >/dev/null
curl -fsS "${API_BASE_URL}/coach/today-summary" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" >/dev/null

curl -fsS -X POST "${API_BASE_URL}/before-you-buy" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"amount":45,"currency":"EUR","description":"Coffee beans"}' >/dev/null

curl -fsS -X POST "${API_BASE_URL}/coach/explain-decision" \
  -H "Authorization: Bearer ${ACCESS_TOKEN}" \
  -H 'Content-Type: application/json' \
  -d '{"amount":45,"currency":"EUR","description":"Coffee beans"}' >/dev/null

echo "Smoke test passed."
