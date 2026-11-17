#!/usr/bin/env bash
# Run the required E2E suites against this checkout's seeded local environment.
# A native .e2e.ts selector routes to e2e-inc; browser journey selectors use its custom engine. No arguments runs both Chromium suites.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"
# Exit 75 means the port pool stayed full; no test result exists in that case.
sh .ai/scripts/test-env-up.sh
BASE_URL=$(jq -r '.baseUrl' .ai/qa/test-env.json)
export E2E_BASE_URL="$BASE_URL" PLAYWRIGHT_BASE_URL="$BASE_URL"
# This entry point owns a dev server, whose fixture clock still needs its header.
unset E2E_PREVIEW

if [ "$#" -eq 0 ]; then
  native_status=0
  browser_status=0
  pnpm e2e:native --target chromium || native_status=$?
  pnpm e2e:browser --target chromium || browser_status=$?
  if [ "$native_status" -ne 0 ]; then exit "$native_status"; fi
  exit "$browser_status"
fi

native=0
browser=0
e2e_arguments=()
e2e_options=1
while [ "$#" -gt 0 ]; do
  e2e_argument="$1"
  shift
  if [ "$e2e_options" -eq 1 ]; then
    case "$e2e_argument" in
      --) e2e_options=0 ;;
      -g|--grep|--grep-invert)
        if [ "$e2e_argument" = -g ]; then e2e_argument=--grep; fi
        e2e_arguments+=("$e2e_argument")
        if [ "$#" -gt 0 ]; then
          e2e_arguments+=("$1")
          shift
        fi
        continue
        ;;
    esac
  fi
  case "$e2e_argument" in
    e2e/native/*.e2e.ts|e2e/native/*.e2e.ts:*) native=1 ;;
    e2e/browser/*.e2e.ts|e2e/browser/*.e2e.ts:*) browser=1 ;;
  esac
  e2e_arguments+=("$e2e_argument")
done
set -- "${e2e_arguments[@]}"
if [ "$native" -eq 1 ] && [ "$browser" -eq 1 ]; then
  echo 'Select native and browser journey files in separate filtered commands.' >&2
  exit 2
fi
if [ "$native" -eq 1 ]; then
  exec pnpm e2e:native --target chromium "$@"
fi
exec pnpm e2e:browser --target chromium "$@"
