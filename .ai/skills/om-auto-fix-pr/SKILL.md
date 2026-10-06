---
name: om-auto-fix-pr
description: planned.travel extension of the installed om-auto-fix-pr skill. The loop is not done while a review thread is open; the develop ruleset blocks the merge on it even after an approving review.
---

Extends the installed skill: read `.claude/skills/om-auto-fix-pr/SKILL.md` and follow it. The following additions apply.

Start only from an explicit request in Cezar. Acquire the PR claim before any mutation and release it on every exit. A terminal run must acquire a new claim before resuming writes. An existing review thread never starts or re-arms this workflow by itself.

One addition to the stabilization loop's exit criteria:

- Before declaring the review approvable, run **list-review-threads** and require zero threads that are unresolved and not outdated. An open thread that the `om-auto-review-pr --autofix` stage fixed but did not resolve is closed here with **reply-review-comment** and **resolve-review-thread** (the repo override of `om-auto-review-pr` says how). An open thread the stage declined is settled the way that override says, by a specialist's verdict, before the loop ends; only a thread still open after that ends it with `changes-requested`, never `merge-queue`, and counts as a failed round of `om-pr-autopilot`'s loop.

One addition to every push:

- The claim step stops on a merged or closed PR only at the start. Immediately before each `git push` to the PR head (base merge, CI fixes), run **get-pr** and read `state`, in the same command as the push. Anything other than `OPEN` stops the run: do not push, release the claim, post one comment saying why the run stopped, and report the commits that were not pushed. A push to a merged PR's head recreates the branch GitHub deleted on merge (money-tracker.online #447, 2026-09-24).

Six rules for the whole run:

- **A lesson stays in the worktree.** A lesson worth keeping goes in a `## Lessons` section of the PR body or the run's handoff file, where `afk-lessons` collects it. Never write it to `~/.claude/CLAUDE.md` or any other file outside the worktree: the write is refused under `dontAsk` and fails the run (runs b9d6b3a5, c9625ca3).
- **A fix Claude Code refuses to write is handed over, not forced.** When the fix needs a file the run may not write (`.husky/*`, `.claude/settings.json`, `.claude/hooks/*`), stop trying after the first refusal: never retry through `cp`, `sed`, `tee` or another path. Get a configuration guardian verdict through `.ai/skills/afk-decide/SKILL.md`, and end with the exact patch and that verdict in the PR body or the report, so applying it is one step for a human (run a9e39d80).
- **Protected writes are declared up front, and a refusal is handed over once.** Check the intended write paths before diagnosis or implementation. ADR 0025 removes upstream ownership, not runtime permissions: protected configuration (`.claude/**`, `.husky/*`) can still require supervision. Declare known protected writes in Cezar `writePaths` (or `cezar task --write-path`) before bootstrap or diagnosis, when the dispatch mechanism allows it, so preflight can stop before expensive work. After a denial, stop the unattended run once and hand the exact diff, the worktree and the paths, with the configuration guardian verdict from `.ai/skills/afk-decide/SKILL.md`, to a supervised run with approval limited to those paths. Never enable global `bypassPermissions`, switch tools to evade denial, or repeat diagnosis and tests for the same refusal. Changes outside this repository belong in their own pull request.
- **Find the dev server from the descriptor.** Read `baseUrl` from `.ai/qa/test-env.json` (`sh .ai/scripts/test-env-up.sh` writes it); never grep `.dev.vars*`, which the deny rules refuse. Quote every path that holds a variable, and never `cd` into a route path such as `src/routes/_app/trips/$tripId` unquoted: the shell expands `$tripId` to nothing.
- **Never try a denied command; use its allowed equivalent.** A command `permissions.deny` refuses ends the run on the first denial under `dontAsk` (run d232173a in money-tracker.online died on an improvised `git reset --hard origin/<branch>`). Move the worktree to the PR head with `git fetch origin <head>` and `git checkout -B <head> origin/<head>`, after checking `git status --short` is clean and `git log origin/<head>..HEAD` is empty: `checkout -B` refuses only when it would overwrite a local change, and it drops a local branch's unpushed commits. Never force-push a rebased branch (denied, `--force-with-lease` included): merge the base instead, or push a new branch. Never `--no-verify`: fix what the hook reports.
- **Never open a file `permissions.deny` lists under `Read(...)`, not even redacted through `cat` or `sed`.** It ends the run the same way (run b6eb30ef died on `cat .ai/qa/test-env.env`). The login's `passwordEnv` name is in `.ai/qa/test-env.json`; load the values with `set -a; . "$(jq -r .credentialsFile .ai/qa/test-env.json)"; set +a` and use `"$TEST_DEMO_PASSWORD"` in the command (AGENTS.md).

One addition to the UI verification stage:

- **QA runs through the unattended sign-off.** Where the chain reaches the QA stage of a PR that touches a user-facing surface, run `om-auto-qa-pr {prNumber} --self-qa-signoff` (the repo override of `om-auto-qa-pr` says how the sign-off is decided) instead of the evidence-only call. The installed "evidence-only" call and "never adds `qa-approved`" rule bind this orchestrator, not the QA skill it dispatches; `risk-high` and `security` PRs go through it too (ADR 0035). After a fix for a `qa-failed` the QA panel set is pushed, remove that label so QA runs again on the new head.
