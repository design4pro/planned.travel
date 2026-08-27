#!/usr/bin/env bash
# The deterministic validation ladder for a sandcastle sandbox — no LLM on the
# green path. Run by main.ts via sandbox.exec() after the reviewer, and again
# after every fix-loop resume.
#
#   TARGET_BRANCH=<integration branch> bash .sandcastle/validate.sh --json-out <path> \
#     [--force-e2e] [--skip-e2e] [--update-snapshots]
#
# Always: route-tree freshness gate, typecheck, lint, vitest.
# When the diff since TARGET_BRANCH touches UI paths (glob heuristic below):
# setup-e2e.sh --if-needed, then the Playwright suite against the -linux
# baselines (this container is CI's exact Playwright image).
#
# Verdict JSON: {uiTouched, steps: [{name, ok, durationMs}], e2e: {failed: []}, ok}
set -uo pipefail

JSON_OUT=""
FORCE_E2E=0
SKIP_E2E=0
UPDATE_SNAPSHOTS=0
while [ $# -gt 0 ]; do
  case "$1" in
    --json-out) JSON_OUT="$2"; shift 2 ;;
    --force-e2e) FORCE_E2E=1; shift ;;
    --skip-e2e) SKIP_E2E=1; shift ;;
    --update-snapshots) UPDATE_SNAPSHOTS=1; shift ;;
    *) echo "unknown flag: $1" >&2; exit 2 ;;
  esac
done

STEPS_JSON="[]"
OVERALL_OK=1

record_step() { # name ok durationMs
  STEPS_JSON=$(jq -c --arg name "$1" --argjson ok "$2" --argjson ms "$3" \
    '. + [{name: $name, ok: ($ok == 1), durationMs: $ms}]' <<<"$STEPS_JSON")
  [ "$2" -eq 1 ] || OVERALL_OK=0
}

run_step() { # name command...
  local name="$1"; shift
  local start end ok
  start=$(date +%s%3N 2>/dev/null || date +%s000)
  if "$@" > >(tail -c 200000 >"/tmp/validate-${name//[^a-zA-Z0-9]/-}.log") 2>&1; then ok=1; else ok=0; fi
  end=$(date +%s%3N 2>/dev/null || date +%s000)
  record_step "$name" "$ok" $((end - start))
  if [ "$ok" -eq 0 ]; then
    echo "==> STEP FAILED: $name (log tail follows)" >&2
    tail -40 "/tmp/validate-${name//[^a-zA-Z0-9]/-}.log" >&2
  else
    echo "==> $name OK" >&2
  fi
}

route_tree_gate() { pnpm generate-routes && git diff --exit-code src/routeTree.gen.ts; }

run_step "route-tree" route_tree_gate
run_step "typecheck" pnpm typecheck
run_step "lint" pnpm lint
run_step "vitest" pnpm test

# ---------------------------------------------------------------------------
# UI-touched heuristic. Deliberately excludes src/server/** — server-only
# issues get vitest here and the full e2e once per iteration from the Auditor;
# billing every issue 5-10 min of e2e buys little marginal signal. format*,
# theme, fonts drive rendered pixels; scripts/seed is what screenshots
# photograph.
# ---------------------------------------------------------------------------
UI_TOUCHED=0
BASE=$(git merge-base "${TARGET_BRANCH:?TARGET_BRANCH must be set}" HEAD 2>/dev/null || true)
if [ -n "$BASE" ]; then
  if git diff --name-only "$BASE"...HEAD | grep -qE \
    '^(src/components/|src/routes/|src/styles/|src/router\.tsx|src/routeTree\.gen\.ts|src/lib/(map|atlas|i18n)/|src/lib/(theme|fonts|cn|format|format-tables)\.ts|e2e/|playwright\.config\.ts|vite\.config|package\.json|pnpm-lock\.yaml|scripts/seed/)'; then
    UI_TOUCHED=1
  fi
else
  echo "==> WARN: cannot resolve merge-base with ${TARGET_BRANCH}; treating as UI-touched" >&2
  UI_TOUCHED=1
fi
[ "$FORCE_E2E" -eq 1 ] && UI_TOUCHED=1
[ "$SKIP_E2E" -eq 1 ] && UI_TOUCHED=0

E2E_FAILED_JSON="[]"
if [ "$UI_TOUCHED" -eq 1 ] && [ "$OVERALL_OK" -eq 1 ]; then
  run_step "e2e-env" bash .sandcastle/setup-e2e.sh --if-needed
  if [ "$OVERALL_OK" -eq 1 ]; then
    PW_ARGS=(--workers=1 --reporter=line --reporter=json --reporter=html)
    [ "$UPDATE_SNAPSHOTS" -eq 1 ] && PW_ARGS+=(--update-snapshots)
    start=$(date +%s%3N 2>/dev/null || date +%s000)
    if PLAYWRIGHT_BASE_URL=http://localhost:3010 PLAYWRIGHT_JSON_OUTPUT_NAME=test-results/results.json \
      pnpm exec playwright test "${PW_ARGS[@]}" > >(tail -c 200000 >/tmp/validate-e2e.log) 2>&1; then ok=1; else ok=0; fi
    end=$(date +%s%3N 2>/dev/null || date +%s000)
    record_step "e2e" "$ok" $((end - start))
    if [ -f test-results/results.json ]; then
      # Failed test titles + first error line + snapshot-diff flag, capped at
      # 40. Playwright nests suites recursively — walk the whole tree.
      E2E_FAILED_JSON=$(jq -c '[.. | objects | select(has("specs")) | .specs[] | select(.ok == false) | {title: .title, error: ((.tests[0].results[0].error.message // "") | split("\n")[0] | .[0:300]), snapshotDiff: ((.tests[0].results[0].error.message // "") | test("toHaveScreenshot|screenshot comparison"))}] | .[0:40]' test-results/results.json 2>/dev/null || echo '[]')
    fi
    [ "$ok" -eq 0 ] && { echo "==> e2e FAILED (log tail follows)" >&2; tail -60 /tmp/validate-e2e.log >&2; }
  fi
fi

VERDICT=$(jq -n -c \
  --argjson uiTouched "$UI_TOUCHED" \
  --argjson steps "$STEPS_JSON" \
  --argjson failed "$E2E_FAILED_JSON" \
  --argjson ok "$OVERALL_OK" \
  '{uiTouched: ($uiTouched == 1), steps: $steps, e2e: {failed: $failed}, ok: ($ok == 1)}')

echo "$VERDICT"
[ -n "$JSON_OUT" ] && printf '%s\n' "$VERDICT" > "$JSON_OUT"

[ "$OVERALL_OK" -eq 1 ]
