#!/usr/bin/env bash
# Provisions this checkout inside a design4pro sandbox (github.com/design4pro/sandbox).
# The sandbox exports APP_PORT (the dev server port) and APP_URL (the public preview URL).
set -euo pipefail

# The `cloud` profile writes throwaway secrets, installs deps and migrates the local D1.
# The basemap is skipped unless CLOUDFLARE_API_TOKEN and E2E_TILES_KEY are set (docs/CLOUD.md §2.3).
bash scripts/worktree/bootstrap.sh --profile cloud --port "$APP_PORT" --no-seed

# Better Auth builds every callback from APP_URL, so it must be the public preview host,
# not localhost. Rewritten on every run because bootstrap resets it to the local port.
# Written the way bootstrap.sh writes it: no `sed -i` (GNU-only), no URL inside a sed expression,
# and appended when the line is missing.
DEV_VARS_TMP=".dev.vars.$$.part"
grep -v '^APP_URL=' .dev.vars > "$DEV_VARS_TMP" || true
printf 'APP_URL=%s\n' "$APP_URL" >> "$DEV_VARS_TMP"
mv -f "$DEV_VARS_TMP" .dev.vars
