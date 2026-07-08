#!/usr/bin/env bash
set -euo pipefail

API_BASE_URL="${API_URL:-${MONEYPULSE_API_BASE_URL:-http://127.0.0.1:8000}}"
WEB_BASE_URL="${WEB_URL:-${MONEYPULSE_WEB_BASE_URL:-http://127.0.0.1:4173}}"
SMOKE_TEST_ALLOW_DOCKER_FALLBACK="${SMOKE_TEST_ALLOW_DOCKER_FALLBACK:-0}"
STAMP="$(date +%s)"
EMAIL="smoke-${STAMP}@example.com"

docker_compose() {
  if command -v docker-compose >/dev/null 2>&1; then
    docker-compose "$@"
    return
  fi

  docker compose "$@"
}

check_host_url() {
  local url="$1"
  curl -fsS "${url}" >/dev/null
}

run_host_flow() {
  echo "Checking web shell at ${WEB_BASE_URL}"
  check_host_url "${WEB_BASE_URL}/"

  echo "Checking API health at ${API_BASE_URL}"
  check_host_url "${API_BASE_URL}/health"
  check_host_url "${API_BASE_URL}/ready"

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

  echo "Smoke test passed through host URLs."
}

run_docker_fallback() {
  echo "Host port access is unavailable. Falling back to Docker internal checks."

  docker_compose exec -T web node -e "fetch('http://127.0.0.1:4173/').then((response) => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))"

  docker_compose exec -T -e SMOKE_EMAIL="${EMAIL}" api bash -lc '
    set -euo pipefail

    curl -fsS http://127.0.0.1:8000/health >/dev/null
    curl -fsS http://127.0.0.1:8000/ready >/dev/null

    REGISTER_RESPONSE="$(
      curl -fsS -X POST http://127.0.0.1:8000/auth/register \
        -H "Content-Type: application/json" \
        -d "{\"name\":\"Smoke Test\",\"email\":\"${SMOKE_EMAIL}\",\"password\":\"password123\"}"
    )"

    ACCESS_TOKEN="$(python -c "import json,sys; print(json.load(sys.stdin)[\"access_token\"])" <<<"${REGISTER_RESPONSE}")"

    curl -fsS -X POST http://127.0.0.1:8000/accounts \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{\"name\":\"Smoke cash\",\"balance\":850,\"currency\":\"EUR\"}" >/dev/null

    curl -fsS http://127.0.0.1:8000/today \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" >/dev/null
    curl -fsS http://127.0.0.1:8000/coach/today-summary \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" >/dev/null
    curl -fsS -X POST http://127.0.0.1:8000/before-you-buy \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{\"amount\":45,\"currency\":\"EUR\",\"description\":\"Coffee beans\"}" >/dev/null
    curl -fsS -X POST http://127.0.0.1:8000/coach/explain-decision \
      -H "Authorization: Bearer ${ACCESS_TOKEN}" \
      -H "Content-Type: application/json" \
      -d "{\"amount\":45,\"currency\":\"EUR\",\"description\":\"Coffee beans\"}" >/dev/null
  '

  echo "Smoke test passed through Docker internal fallback."
}

if check_host_url "${WEB_BASE_URL}/" && check_host_url "${API_BASE_URL}/health" && check_host_url "${API_BASE_URL}/ready"; then
  run_host_flow
  exit 0
fi

if [[ "${SMOKE_TEST_ALLOW_DOCKER_FALLBACK}" == "1" ]]; then
  run_docker_fallback
  exit 0
fi

cat <<EOF
Smoke test could not reach the configured host URLs.

- WEB_URL: ${WEB_BASE_URL}
- API_URL: ${API_BASE_URL}

If you are running inside a sandbox that blocks host port access, rerun with:

SMOKE_TEST_ALLOW_DOCKER_FALLBACK=1 bash scripts/smoke_test.sh

That fallback verifies the same flow from inside the running Docker containers.
EOF

exit 1
