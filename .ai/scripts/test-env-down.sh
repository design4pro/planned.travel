#!/bin/sh
# om-prepare-test-env: generated teardown (contract v2)
# Stops exactly what test-env-up.sh started. Safe to run twice.
set -eu
cd "$(git rev-parse --show-toplevel)"
QA_DIR=".ai/qa"
DESCRIPTOR="$QA_DIR/test-env.json"
PID_FILE="$QA_DIR/dev-server.pid"

PID=$(cat "$PID_FILE" 2>/dev/null || true)
[ -z "$PID" ] && [ -f "$DESCRIPTOR" ] && PID=$(sed -n 's/.*"pid": *\([0-9]*\).*/\1/p' "$DESCRIPTOR" | head -1)
if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
  kill "$PID" 2>/dev/null || true
  for _ in 1 2 3 4 5; do kill -0 "$PID" 2>/dev/null || break; sleep 1; done
  kill -9 "$PID" 2>/dev/null || true
  echo "stopped dev server (pid $PID)"
fi
rm -f "$PID_FILE"
rm -rf "$QA_DIR/test-env.lock"
if [ -f "$DESCRIPTOR" ]; then
  sed -i.bak 's/"status": *"running"/"status": "stopped"/' "$DESCRIPTOR" && rm -f "$DESCRIPTOR.bak"
fi
echo "TEST_ENV_STATUS=stopped"
