---
name: om-code-review
description: planned.travel extension of the installed om-code-review skill. Adds the repo's blocker floor (suppressions, skipped tests, generated files, dependencies, tenant isolation, locale parity).
---

Extends the installed skill: read `.claude/skills/om-code-review/SKILL.md` and follow it. `CODE_REVIEW.md` at the repo root is the full rule set; these are the mechanical blockers to check first, on the diff alone:

- Added `@ts-ignore`, `@ts-expect-error`, `eslint-disable*` → blocker.
- Added `.skip`, `.only`, `.todo`, `.fixme`, `xit`, `xdescribe`, `xtest` in a test file → blocker.
- Deleted `*.test.ts(x)`, `*.spec.ts` or `e2e/**` spec without the tested code being deleted in the same PR → blocker.
- Diff in `src/routeTree.gen.ts` or `drizzle/` that `bash .ai/scripts/check-generated.sh` does not reproduce → blocker. A hand-written `drizzle/*.sql` → blocker.
- `package.json` dependency change or unexplained `pnpm-lock.yaml` diff outside a `dependencies`-labelled PR → blocker.
- New or changed method in `src/server/repos` without a tenant-isolation test → blocker. SQL outside `src/server/repos` and `src/server/catalog` → blocker.
- New user-facing string not present as a key in every locale under `src/lib/i18n/messages/` → blocker.
- Server function called from another server function's handler → blocker (`scripts/check-server-fn-manifest.mjs` explains the production failure).

Apply `BACKWARD_COMPATIBILITY.md` to every touched surface. Smells from docs/agents/CODING_STANDARDS.md are judgement findings (minor), never blockers.
