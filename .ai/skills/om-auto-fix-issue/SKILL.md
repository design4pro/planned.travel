---
name: om-auto-fix-issue
description: planned.travel extension of the installed om-auto-fix-issue skill. Repo-specific rules only; the installed skill's workflow and safety rules apply unchanged.
---

Extends the installed skill: read `.claude/skills/om-auto-fix-issue/SKILL.md` and follow it. On top:

- No label starts this skill (ADR 0032): a person starts the `issue-autofix` workflow from the Cezar cockpit. Never add a label outside the Open Mercato taxonomy (`.ai/trackers/github.md`).
- The implementing PR body carries `Closes #{issueId}`. GitHub will not close the issue on merge because PRs target `develop`, not the default branch; `om-close-fixed-issues` (the housekeeping workflow) closes it. Keep the keyword anyway: that is what housekeeping reads.
- Never add, remove or upgrade a dependency (`pnpm add|remove|update`): the stack is pinned (docs/SPEC.md §3). A fix that needs one ends as `Status: blocked` naming the dependency.
- A diff touching `src/routes`, `src/components`, `src/styles`, `src/server/email` or a locale file under `src/lib/i18n/messages` is UI-touching: step 10 (`om-auto-qa-pr`) is mandatory and the PR keeps `needs-qa`.
- Read `AGENTS.md`, `CODE_REVIEW.md` and `BACKWARD_COMPATIBILITY.md` before delegating; the chain skills inherit their rules through their own overrides in `.ai/skills/`.

## Readiness verifier

A ticket that fails the ticket-level tier of the Definition of Ready is not stopped at once. The
gap is usually one the repository already answers, and a human reading it used to write "ready as
is"; the `readiness-verifier` sub-agent (`.claude/agents/readiness-verifier.md`) now makes that
call. This replaces the stop in the feature route's triage gate (`references/fr-triage.md` step 4)
and nothing else - the bug route, the lock check and the already-implemented check are unchanged.

1. A human waiver on the ticket ("ready as is") still satisfies the tier without the verifier.
2. A `readiness verified` comment already on the issue, with no human comment newer than it, is the
   verdict: reuse it and do not run the verifier again.
3. Otherwise delegate to `readiness-verifier` with the issue number, title, body, labels, author,
   every comment (author, timestamp, whether it is an agent's) and the missing items. The verifier
   refuses out-of-scope asks and a vetoed verdict itself, so pass every issue and let it decide. With no sub-agent tool on this backend, skip it and stop as the
   installed skill says - never verify your own triage.
4. `READINESS: VERIFIED` - post the table as one idempotent comment (find the marker via
   **list-issue-comments**, update it in place via **update-comment** when the table changed), treat
   the tier as satisfied, and continue:

   ```markdown
   🤖 `readiness-verifier` — readiness verified

   The ticket-level Definition of Ready items below were missing. They are resolved here so the
   pipeline can build this issue without waiting for a human.

   {the verifier's table}

   Reply `veto` to revoke this and send the issue back to a human.
   ```

5. `READINESS: NEEDS_HUMAN` - settle each `NEEDS_HUMAN` row that is a missing out-of-scope section or an
   open question through `.ai/skills/afk-decide/SKILL.md`, exactly as `.ai/skills/om-auto-manage-issues/SKILL.md`
   does, and record the verdicts as non-blocking Resolved assumptions rows. Never do this when the
   verifier stopped on a `veto`, on `docs/agents/out-of-scope.md` or on an ADR contradiction: those stay
   with a human. Post the installed skill's not-ready comment listing only the rows nothing settled,
   with both readings where the verifier named two, and stop with `NOT_READY`.

**Protected writes are declared up front, and a refusal is handed over once.** Check the intended write paths before diagnosis or implementation. ADR 0025 removes upstream ownership, not runtime permissions: protected configuration (`.claude/**`, `.husky/*`) can still require supervision. Declare known protected writes in Cezar `writePaths` (or `cezar task --write-path`) before bootstrap or diagnosis, when the dispatch mechanism allows it, so preflight can stop before expensive work. After a denial, stop the unattended run once and hand the exact diff, the worktree and the paths, with the configuration guardian verdict from `.ai/skills/afk-decide/SKILL.md`, to a supervised run with approval limited to those paths. Never enable global `bypassPermissions`, switch tools to evade denial, or repeat diagnosis and tests for the same refusal. Changes outside this repository belong in their own pull request.
