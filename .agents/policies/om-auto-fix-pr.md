# om-auto-fix-pr repository policy

Always apply `.agents/policies/security.md` and the atomic ownership protocol in `.ai/trackers/github.md`.

Extends the installed skill: read `.agents/skills/om-auto-fix-pr/SKILL.md` and follow it. The following additions apply.

Start only from an explicit request in Cezar. Acquire the PR claim before any mutation and release it on every exit. A terminal run must acquire a new claim before resuming writes. An existing review thread never starts or re-arms this workflow by itself.

One addition to the stabilization loop's exit criteria:

- Before declaring the review approvable, run **list-review-threads** and require zero threads that are unresolved and not outdated. An open thread that the `om-auto-review-pr --autofix` stage fixed but did not resolve is closed here with **reply-review-comment** and **resolve-review-thread** (the repo override of `om-auto-review-pr` says how). An open thread the stage declined is settled the way that override says, by a specialist's verdict, before the loop ends; only a thread still open after that ends it with `changes-requested`, never `merge-queue`, and counts as a failed round of `om-pr-autopilot`'s loop.

One addition to every push:

- The claim step stops on a merged or closed PR only at the start. Immediately before each `git push` to the PR head (base merge, CI fixes), run **get-pr** and read `state`, in the same command as the push. Anything other than `OPEN` stops the run: do not push, release the claim, post one comment saying why the run stopped, and report the commits that were not pushed. A push to a merged PR's head recreates the branch GitHub deleted on merge (money-tracker.online #447, 2026-09-24).

Six rules for the whole run:

- **Find the dev server from the descriptor.** Read `baseUrl` from `.ai/qa/test-env.json` (`sh .ai/scripts/test-env-up.sh` writes it); never grep `.dev.vars*`, which the deny rules refuse. Quote every path that holds a variable, and never `cd` into a route path such as `src/routes/_app/trips/$tripId` unquoted: the shell expands `$tripId` to nothing.

One addition to the UI verification stage:

- **QA runs through the unattended sign-off.** Where the chain reaches the QA stage of a PR that touches a user-facing surface, run `om-auto-qa-pr {prNumber} --self-qa-signoff` (the repo override of `om-auto-qa-pr` says how the sign-off is decided) instead of the evidence-only call. The installed "evidence-only" call and "never adds `qa-approved`" rule bind this orchestrator, not the QA skill it dispatches; `risk-high` and `security` PRs go through it too (ADR 0035). After a fix for a `qa-failed` the QA panel set (a `🤖 QA-PANEL: FAIL head=<sha>` comment for the PR's current head marks it) is pushed, remove that label so QA runs again on the new head; a `qa-failed` without that comment is a person's and is left alone.

## Shared PR and CI evidence

Use `node .ai/scripts/pr-state.mjs <pr>` for the read-only state snapshot and add `--wait` for
one bounded CI wait. Reuse its required-check and workflow-run evidence instead of rebuilding
API/polling loops in the agent. `unknown` is never green; inspect the warning rather than treating
unreadable external checks as passed. This helper does not replace fresh-head checks before
mutations, claims, unresolved-thread handling, security verdicts or current-head QA approval.
