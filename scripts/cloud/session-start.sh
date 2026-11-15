#!/bin/bash
#
# Legacy explicit compatibility dispatcher; no project hook installs it.
# New Cezar/Codex sessions call scripts/worktree/bootstrap.sh directly with
# --profile worktree or --profile cloud. Keep the legacy environment variables
# here for existing callers; the shared bootstrap owns provisioning.

set -euo pipefail

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

# A cezar run (CEZ_TASK_ID is set) gets its app from its workflow's own bootstrap step, so the full
# bootstrap has nothing to add there. It still cost every session 2.5-10.6 minutes before the first
# turn: the basemap check never passes on the host, so `--if-needed` never skips and each session
# restarted vite, re-seeded and re-verified a server no automated flow uses (2026-09-24/25 run logs).
# Dependencies are the exception: implement-ticket, lessons, triage and
# spec-to-tickets have no bootstrap step, and a test run without node_modules finds no vitest or
# resolves the main checkout's packages. Same check and same HUSKY=0 as step 1 of bootstrap.sh.
if [ -n "${CEZ_TASK_ID-}" ]; then
  if [ ! -d node_modules/.bin ]; then
    HUSKY=0 pnpm install --frozen-lockfile --prefer-offline
  fi
  exit 0
fi

if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  exec bash scripts/worktree/bootstrap.sh --profile cloud
fi

exec bash scripts/worktree/bootstrap.sh --profile worktree --if-needed
