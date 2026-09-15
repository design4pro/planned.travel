#!/usr/bin/env bash
# Validation-gate step: the Playwright critical journeys against a seeded local
# app. Brings the test environment up (or reuses a healthy one) through the
# om-prepare-test-env entrypoint and points the suite at its base URL.
# Extra arguments go to `pnpm e2e` (e.g. `-g "sign in"`).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
# Exit 75 from here means the port pool stayed full and the suite never ran (issue #324);
# `set -e` passes that status through unchanged, so keep the call bare.
sh .ai/scripts/test-env-up.sh
BASE_URL=$(jq -r '.baseUrl' .ai/qa/test-env.json)
PLAYWRIGHT_BASE_URL="$BASE_URL" pnpm e2e --project=chromium "$@"
