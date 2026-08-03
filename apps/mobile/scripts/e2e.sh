#!/usr/bin/env bash
set -euo pipefail

set -a
# shellcheck disable=SC1091
source .env
set +a

if [[ "${EXPO_PUBLIC_API_URL:-}" != *"staging"* ]]; then
  echo "Mobile E2E must target the isolated staging Worker (EXPO_PUBLIC_API_URL contains staging)." >&2
  exit 1
fi

metro_pid=""
metro_log="${TMPDIR:-/tmp}/planned-travel-metro.log"
cleanup() {
  if [[ -n "$metro_pid" ]] && kill -0 "$metro_pid" 2>/dev/null; then
    kill "$metro_pid" 2>/dev/null || true
    wait "$metro_pid" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

metro_ready() {
  curl --silent --fail http://localhost:8081/status >/dev/null 2>&1
}

if ! metro_ready; then
  pnpm exec expo start --dev-client --localhost >"$metro_log" 2>&1 &
  metro_pid=$!
  for _ in $(seq 1 60); do
    if metro_ready; then break; fi
    sleep 1
  done
fi

if ! metro_ready; then
  echo "Metro did not become ready; see $metro_log" >&2
  exit 1
fi

e2e_run_id="$(date +%s)"
export E2E_TRIP_TITLE="Mobile E2E $e2e_run_id"
export E2E_COLLAB_TRIP_TITLE="Mobile collaboration E2E $e2e_run_id"
export E2E_COLLAB_TRIP_ID="trip-Mobile-collaboration-E2E-$e2e_run_id"
export E2E_REALTIME_TRIP_TITLE="Mobile realtime E2E $e2e_run_id"
export E2E_MAP_TRIP_TITLE="Mobile map E2E $e2e_run_id"

for flow in e2e/*.yaml; do
  maestro test \
    -e E2E_EMAIL="$E2E_EMAIL" \
    -e E2E_PASSWORD="$E2E_PASSWORD" \
    -e E2E_MEMBER_EMAIL="$E2E_MEMBER_EMAIL" \
    -e E2E_MEMBER_PASSWORD="$E2E_MEMBER_PASSWORD" \
    -e E2E_TRIP_TITLE="$E2E_TRIP_TITLE" \
    -e E2E_COLLAB_TRIP_TITLE="$E2E_COLLAB_TRIP_TITLE" \
    -e E2E_COLLAB_TRIP_ID="$E2E_COLLAB_TRIP_ID" \
    -e E2E_REALTIME_TRIP_TITLE="$E2E_REALTIME_TRIP_TITLE" \
    -e E2E_MAP_TRIP_TITLE="$E2E_MAP_TRIP_TITLE" \
    "$flow"
done
