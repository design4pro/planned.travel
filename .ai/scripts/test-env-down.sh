#!/bin/sh
# om-prepare-test-env: generated teardown (contract v2)
# Stops exactly what test-env-up.sh started. Safe to run twice.
set -eu
cd "$(git rev-parse --show-toplevel)"
QA_DIR=".ai/qa"
DESCRIPTOR="$QA_DIR/test-env.json"

# A stale PID can now belong to another checkout or an unrelated process.
node .ai/scripts/dev-server-process.mjs stop
rm -rf "$QA_DIR/test-env.lock"
if [ -f "$DESCRIPTOR" ]; then
  sed -i.bak 's/"status": *"running"/"status": "stopped"/' "$DESCRIPTOR" && rm -f "$DESCRIPTOR.bak"
fi
echo "TEST_ENV_STATUS=stopped"
