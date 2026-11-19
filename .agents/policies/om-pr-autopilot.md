# om-pr-autopilot repository policy

Always apply `.agents/policies/security.md` and the atomic ownership protocol in `.ai/trackers/github.md`.

Extends the installed skill: read `.agents/skills/om-pr-autopilot/SKILL.md` and follow it. The following additions apply.

Diagnosis reads the PR state once, at the start, but a human may merge or close the PR while the run works. This rule covers every push the run makes, including those of the chained skills that push to the PR head (`om-auto-continue-pr`, `om-auto-continue-pr-loop`, `om-auto-fix-pr`, `om-auto-review-pr` in autofix), whether or not their own overrides were read:

- Immediately before each `git push` to the PR head, run **get-pr** and read `state`. Keep the check and the push in one command so nothing runs between them.
- Anything other than `OPEN` stops the run: do not push, release the claim, post one comment saying why the run stopped, and report the commits that were not pushed.

GitHub deletes a merged PR's head branch, and a push to it recreates that branch on the remote. It happened on money-tracker.online #447 (2026-09-24): the PR was merged while the base-merge gate ran, and the push that followed brought the deleted head branch back.

**"Approvable" in the state matrix follows the ruleset, not a habit.** A PR is approvable (row 9) when no review requests changes, no review thread is unresolved, and the base branch's ruleset requirements for approvals and code-owner review are met - with `required_approving_review_count: 0` and no code-owner review, that holds without any approving review. Read the ruleset exactly as `.agents/policies/om-approve-merge-pr.md` step 3 says. A missing approval on a PR this run cannot approve itself (its own account authored it) is not a reason to stop at merge-ready under `--allow-merge` when the ruleset requires none.

**`--allow-merge` means a merge into `develop` only.** Every PR here, agent or human, is authored by the owner's one account, so the author tells nothing apart. A PR whose base is not `develop`, or that carries `do-not-merge`, ends at merge-ready under `--allow-merge` too: the `develop` -> `main` promotion deploys production and is the owner's to merge (`.agents/policies/om-approve-merge-pr.md`).

- **QA runs through the unattended sign-off.** Where the chain reaches the QA stage (state matrix rows 7 and 10) of a PR that touches a user-facing surface, run `om-auto-qa-pr {pr} --self-qa-signoff` (the repo override of `om-auto-qa-pr` says how its specialist panel decides) instead of the evidence-only call. The installed "never applies the QA-approval label" rule binds the orchestrator itself, not the QA skill it dispatches. Row 10 never stops to request a person's sign-off: it runs that QA stage, and it also covers a `qa-approved` whose `QA head:` is not the PR's current head (a push after the sign-off makes it stale). After a successful sign-off, re-read the QA labels and continue with row 9 under `--allow-merge` in the same run. Nothing here waits for a person into `develop`, `risk-high` and `security` included (owner decision 2026-10-06, ADR 0035).

- **A `risk-high` or `security` PR merges on a security verdict.** A PR is one when it carries either label or its diff touches the `risk-high` paths of `SDLC.md` § This repository, so a lowered label does not skip the verdict. Before row 9 merges one, whether or not it touches a user-facing surface, ask the security and tenancy reviewer (`persona-workspace-owner`) through `.agents/policies/decisions.md` to judge the diff at the current head (write the diff to `$TMPDIR` and give its path in the brief: the persona agents can read files, not run `git`). `ship` is the approving verdict; `ship with fixes`, `do not ship` and a "human decides" on money are a refusal. Merge only on an approving verdict, recorded in the PR body's Resolved assumptions table with the head it judged; the QA panel's verdict from the same persona on the current head (the `om-auto-qa-pr` override) counts, so ask once per head. A refusal is a failed round of the loop below: post its findings in a 🤖 comment and link it from the round comment, so `om-auto-fix-pr` has the fix list. A verdict on an older head does not count.

- **Every rejection goes back to the agents, three rounds at most.** A failed check, `changes-requested`, a `qa-failed` the QA panel set (a `🤖 QA-PANEL: FAIL head=<sha>` comment for the PR's current head carries the verdicts; every account here is the owner's, so that comment, not the label's actor, tells the panel's `qa-failed` from a person's) and a refused security verdict all route to `om-auto-fix-pr {pr}` with the findings, and then to review, QA and the security verdict again on the new head - never to a stop that asks for a person. Row 0c's failed-QA stop applies to every `qa-failed` without that comment (a person set it); `om-auto-fix-pr` removes the panel's `qa-failed` once its fix is pushed. Each round opens with a 🤖 comment `Autopilot round <n>/3: <what failed>`, counted from the PR's comments newer than the last `blocked` a person removed, so the count survives across runs and a retry after a person lifts `blocked` starts at round 1. A failure after round 3's fix is the third failed round: add `blocked` and post one comment that starts `🤖 HUMAN-ONLY: ` and lists what each round tried and what still fails: that is the only way this loop hands a PR to a person, with two exceptions that add `blocked` and the comment at once, without spending a round: a runtime-denied write (the protected-writes rule below) and a review finding the run agrees with but cannot act on (the `om-auto-review-pr` override's fourth outcome).

- **A spec-only PR ends at merge-ready, except the one `plan-to-spec` opens.** A diff that touches only `paths.specs` is merged by a person, whatever `--allow-merge` says: the spec flow of `om-auto-write-spec` is "a human merges it" (AGENTS.md, `docs/agents/issue-tracker.md`). The exception is a spec PR written from a plan stage, which a specialist panel reviewed instead of a person: its branch is `spec/<slug>`, its body records the panel's verdicts, every spec it adds carries a `Plan` row (the generated `.ai/specs/README.md` aside), and it is not `blocked`. Under `--allow-merge` it goes through the state matrix like any other `develop` PR - row 3's specification review, then row 9, promoting a draft with **mark-pr-ready** first - and is squash-merged once CI is green (ADR 0033). Missing any of the four, it ends at merge-ready like the rest. Every other spec-only PR keeps the person's merge, the `om-auto-write-spec` flow's and a spec task's (`implement-ticket` writing the spec a request too large for a few slices needs; an `Issue` row and no `Plan` row) among them. A PR that marks delivered plan stages (`docs/plan-delivered-<plan-slug>`) touches only `docs/plans/`, so it is docs-only, not spec-only, and nothing in this rule stops it.

The shared safety policy applies to this run and every chained skill. Additional operational rules:

- **Find the dev server from the descriptor.** Read `baseUrl` from `.ai/qa/test-env.json` (`sh .ai/scripts/test-env-up.sh` writes it); never grep `.dev.vars*`, which the deny rules refuse. Quote every path that holds a variable, and never `cd` into a route path such as `src/routes/_app/trips/$tripId` unquoted: the shell expands `$tripId` to nothing.

## Native delivery

The prepare node retains the exact atomic PR lock and `in-progress` for this run. Publish
passing independent reports with the markers from the review and QA policies. For a required
security or configuration verdict, publish the approving independent report with
`Cezar gate: security <full-head-sha> approved` and record it with the same
`record-evidence security <pr> <report-url> <head> <base>` command. For the plan-to-spec
exception, add `Cezar gate: plan-to-spec panel approved` only after verifying that panel.

Before the ready verdict, check `--check-delivery` with the primary checkout's validator from
the candidate worktree. Run the configured gate with `--for-commit` once if the exact result
is missing. Hand the exact ready PR back to the graph. The native check verifies the lock, current reports,
holds, review threads, exact head/base and executed CI and submits the protected merge.

## Shared PR and CI evidence

Use `node .ai/scripts/pr-state.mjs <pr>` for the read-only state snapshot and add `--wait` for
one bounded CI wait. Reuse its required-check and workflow-run evidence instead of rebuilding
API/polling loops in the agent. `unknown` is never green; inspect the warning rather than treating
unreadable external checks as passed. This helper does not replace fresh-head checks before
mutations, claims, unresolved-thread handling, security verdicts or current-head QA approval.
