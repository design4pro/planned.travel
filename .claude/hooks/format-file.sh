#!/usr/bin/env bash
# PostToolUse hook (Edit|Write): auto-formats the edited file so formatting
# never consumes an agent turn or a CI run. Always exits 0 — formatting
# failures must not block the edit that already happened.
set -uo pipefail

input=$(cat)
file_path=$(printf '%s' "$input" | jq -r '.tool_input.file_path // empty')

[ -z "$file_path" ] && exit 0
[ -f "$file_path" ] || exit 0

cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
pnpm exec prettier --write --ignore-unknown "$file_path" >/dev/null 2>&1 || true

exit 0
