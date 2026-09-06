#!/usr/bin/env bash
# Start one `housekeeping` run (.ai/cezar/workflows/housekeeping.yml) on the cezar cockpit of
# this host. launchd calls it three times a day (.ai/scripts/launchd/); a human may call it any
# time. Cezar has no scheduler of its own, so this POST is the schedule (ADR 0018).
#
#   .ai/scripts/housekeeping.sh
#
# Env: CEZ_API (default http://localhost:4321), CEZ_PROJECT (default planned-travel).
# Falls back to a headless `cezar run` in the main checkout when the cockpit is not up; that
# run still lands in the cockpit's history, it just does not share its queue.
set -euo pipefail

API="${CEZ_API:-http://localhost:4321}/api/v1/p/${CEZ_PROJECT:-planned-travel}/runs"
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
BODY='{"workflow":"housekeeping","task":"housekeeping","worktree":true,"autonomous":true,"variants":1,"generateFollowups":false}'

if out=$(curl -sS --max-time 10 -X POST "$API" -H 'content-type: application/json' -d "$BODY" -w '\n%{http_code}' 2>/dev/null); then
  code=$(tail -1 <<<"$out")
  case "$code" in
    200|201) printf 'housekeeping queued: %s\n' "$(sed '$d' <<<"$out" | jq -r '.run.id // .id // "?"' 2>/dev/null)"; exit 0 ;;
    *) printf 'POST %s -> %s: %s\n' "$API" "$code" "$(sed '$d' <<<"$out")" >&2 ;;
  esac
else
  printf 'cockpit unreachable at %s, running headless\n' "$API" >&2
fi

cd "$ROOT"
exec npx --yes @open-mercato/cezar@0.10.1 run "housekeeping" --workflow housekeeping
