#!/usr/bin/env bash
# Validation-gate step: the committed generated files match their sources.
# Mirrors the four drift checks in .github/workflows/ci.yml. All four files are
# generated and committed; a hand edit or a forgotten regeneration is caught here
# rather than as a mystery type error (route tree), a query against a column that
# does not exist (migrations), a spec index that quietly stops matching the
# directory it describes, or a binding the types do not know about.
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

echo "==> worker configuration"
# Its generator is `wrangler types`, and until the agent layer was vendored this file was the one
# of the four with no drift check at all - a PreToolUse hook refused to let it be edited instead
# (ADR 0025). A hand edit survived exactly until the next `pnpm cf-typegen`, on one machine only.
pnpm cf-typegen
git add --intent-to-add -- worker-configuration.d.ts
if ! git diff --exit-code -- worker-configuration.d.ts; then
  echo "ERROR: worker-configuration.d.ts is stale. Run 'pnpm cf-typegen' and commit the result." >&2
  exit 1
fi

echo "generated files are current"
