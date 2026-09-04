#!/usr/bin/env bash
# Run vitest on named files under a scrubbed environment. Allowlisted for agent steps, so
# the argument space is closed: only paths inside the repo's test roots, plus a root-level
# `*.test.ts`, and no flags.
#
#   scripts/agent/cez-test.sh <file.test.ts> [...]
set -euo pipefail
. "$(dirname "$0")/cez-lib.sh"

[ $# -gt 0 ] || die "usage: cez-test.sh <test file> [...]"
for f in "$@"; do
  case "$f" in
    -*) die "flags are not accepted: $f" ;;
    *..*) die "path not allowed: $f" ;;
    src/*|server/*|scripts/*) ;;
    */*) die "path outside the test roots: $f" ;;
    # A root-level spec has no directory to vouch for it, so the name does. The `tooling` project
    # collects `vite.config.test.ts` there, and run c9ac1079 could not run its own new test
    # through this script: it reached for `pnpm exec vitest run` instead and git-guardrails.sh
    # blocked that, leaving the whole suite as the only way to see one assertion.
    *.test.ts) ;;
    *) die "not a test file: $f" ;;
  esac
  [ -f "$f" ] || die "no such file: $f"
done

heartbeat
clean_env -- pnpm exec vitest run "$@"
