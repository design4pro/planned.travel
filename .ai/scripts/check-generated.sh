#!/usr/bin/env bash
# Validation-gate step: the committed generated files match their sources.
# Shared by the local validation gate and .github/workflows/ci.yml. All three files are
# generated and committed; a hand edit or a forgotten regeneration is caught here
# rather than as a mystery type error (route tree), a query against a column that
# does not exist (migrations), or a spec index that quietly stops matching the
# directory it describes.
#
# `worker-configuration.d.ts` is deliberately not here: it is generated and then
# adjusted to avoid circular imports. Binding/variable parity is checked by
# src/server/__tests__/wrangler-config.test.ts instead of a raw typegen diff.
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
echo "==> spec index"
# .ai/specs/README.md is rendered from the metadata table in each spec. The
# assertions those tables must satisfy are a test
# (scripts/specs/__tests__/spec-registry.test.ts); this only catches an index
# nobody regenerated after moving a spec or appending a pull request to one.
pnpm generate-spec-index
git add --intent-to-add -- .ai/specs/README.md
if ! git diff --exit-code -- .ai/specs/README.md; then
  echo "ERROR: .ai/specs/README.md is stale. Run 'pnpm generate-spec-index' and commit the result." >&2
  exit 1
fi

echo "generated files are current"
