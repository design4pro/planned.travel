#!/usr/bin/env bash
# PreToolUse hook (Edit|Write): blocks hand-edits of generated files.
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
  */e2e/__screenshots__/*)
    echo "BLOCKED: Playwright baselines change only via 'pnpm e2e:update' (darwin) or the update-snapshots.yml workflow (linux), never by direct edits." >&2
    exit 2
    ;;
esac

exit 0
