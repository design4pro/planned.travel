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

## The persona panel

Five reviewers in `.claude/agents/persona-*.md` read the change from a seat this checklist does not
occupy: `persona-traveller` (the person using it), `persona-workspace-owner` (the person paying for
it and administering the data), `persona-product-owner` (the promise the ticket made),
`persona-manual-tester` (the states nobody wrote a test for), `persona-accessibility-auditor`
(WCAG 2.2 AA). They are read-only and advisory - they return findings in this file's severity
vocabulary, they never edit and they never decide.

Consult a persona with the `Agent` tool when the diff reaches its seat, and not otherwise:

| The diff touches                                                        | Consult                         |
| ----------------------------------------------------------------------- | ------------------------------- |
| a rendered surface, a message, a default a user meets                   | `persona-traveller`             |
| a component, a form, a dialog, a chart, a page                          | `persona-accessibility-auditor` |
| tenancy, roles, sharing, deletion, export, invitations, anything billed | `persona-workspace-owner`       |
| a screen, a form, a list, or a server function                          | `persona-manual-tester`         |
| a capability added or narrowed, or a ticket claimed done                | `persona-product-owner`         |

Send each one the diff and the ticket, and run the ones that apply in a single message so they work
in parallel. Fold what comes back into your own report rather than pasting it: a persona finding
that maps onto a blocker in this file is a blocker, and everything else is a judgement finding you
weigh and may reject with a reason. A panel that found nothing is worth one line saying so.

Folding is for findings. The sections that are not findings - `## What I could not check` in every
report, `## Human decides`, `## Acceptance criteria` and `## Cases worth a test` where the persona
returns them - are carried into your own report verbatim under the persona's name rather than
weighed against this file's severities. These reviews mostly run unattended and nothing else
surfaces a subagent's output, so your report is the only place the human those sections were
written for will ever read them.

Skip the panel entirely on a diff that reaches no seat - a dependency bump, a generated file, a
docs-only change. Consulting nobody is the correct outcome there, and cheaper than five reports
saying the same.
