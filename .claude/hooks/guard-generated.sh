#!/usr/bin/env bash
# PreToolUse hook (Edit|Write): blocks hand-edits of generated files, and in agent runs
# (CEZ_TASK_ID or GITHUB_ACTIONS) the paths that configure the agent itself (ADR 0015).
# Contract: exit 2 blocks the tool call and feeds stderr back to the model; exit 0 allows.
set -euo pipefail

input=$(cat)
file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')

[ -z "$file_path" ] && exit 0

case "$file_path" in
  */src/routeTree.gen.ts)
    echo "BLOCKED: src/routeTree.gen.ts is generated. Run 'pnpm generate-routes' instead of editing it." >&2
    exit 2
    ;;
  */drizzle/*.sql)
    echo "BLOCKED: drizzle/ migrations are generated. Run 'pnpm db:generate' after changing the schema instead of editing SQL by hand." >&2
    exit 2
    ;;
esac

[ -n "${CEZ_TASK_ID:-}" ] || [ -n "${GITHUB_ACTIONS:-}" ] || exit 0

root="${CLAUDE_PROJECT_DIR:-$(pwd)}"
rel="${file_path#"$root"/}"
if printf '%s' "$rel" | grep -Eq '^(\.github/|\.claude/|\.husky/|\.ai/cezar/|scripts/agent/|\.npmrc$|pnpm-workspace\.yaml$)'; then
  echo "BLOCKED (agent run): '$rel' configures the agent; a run never edits it. Note it under 'Noticed but not touching' and carry on." >&2
  exit 2
fi

exit 0
