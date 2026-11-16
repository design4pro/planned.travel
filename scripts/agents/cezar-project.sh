#!/bin/sh
# Start the managed Cezar CLI with project-isolated Codex children.
set -eu
project_codex=$(command -v codex-project) || {
  echo 'cezar-project: install codex-project on PATH first' >&2
  exit 2
}
managed_cezar="${CEZ_HOME:-$HOME/.cezar}/versions/current/node_modules/@open-mercato/cezar/dist/index.js"
if [ ! -f "$managed_cezar" ]; then
  echo 'cezar-project: the managed Cezar CLI is not installed' >&2
  exit 2
fi
project_node=$(command -v cezar-project-node) || {
  echo 'cezar-project: install cezar-project-node on PATH first' >&2
  exit 2
}
exec env CEZ_CODEX_BIN="$project_codex" "$project_node" "$managed_cezar" "$@"
