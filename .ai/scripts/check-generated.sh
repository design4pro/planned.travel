#!/usr/bin/env bash
# Validation-gate step: the committed generated files match their sources.
# Mirrors the two drift checks in .github/workflows/ci.yml. Both files are
# generated and committed; a hand edit or a forgotten regeneration is caught here
# rather than as a mystery type error (route tree) or a query against a column
# that does not exist (migrations).
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

echo "==> route tree"
pnpm generate-routes
# --intent-to-add: `git diff` is blind to a file git has never seen, so a first
# route in a new directory would otherwise report clean.
git add --intent-to-add -- src/routeTree.gen.ts
git diff --exit-code -- src/routeTree.gen.ts

echo "==> migrations"
# `< /dev/null`: drizzle-kit prompts on a rename it cannot infer; with stdin
# closed that is an immediate error instead of a hang.
pnpm db:generate < /dev/null
git add --intent-to-add -- drizzle/
if ! git diff --exit-code -- drizzle/; then
  echo "ERROR: the schema and drizzle/ disagree. Run 'pnpm db:generate' and commit the result." >&2
  exit 1
fi
echo "generated files are current"
