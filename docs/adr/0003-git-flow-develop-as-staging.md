# 0003. Git Flow with develop-as-staging

Status: accepted (backfill — the decision predates this record)
Date: 2026-08-26

## Context

The project deploys two long-lived environments from one repository and needs agent branches to land somewhere continuously verifiable before production.

## Decision

Feature branches (`feat/*`, `fix/*`, `claude/*`, `sandcastle/*`) target `develop` via PR. Merging `develop` auto-deploys staging. Promotion is a PR `develop` → `main`, which deploys production. CI runs the full gate (lint, typecheck, unit, build, visual e2e) on every PR; _ADR 0016 replaced the visual e2e half with the critical journeys, which compare no pixels, and ADR 0021 skips them on a PR whose diff stops at documentation;_ database migrations are additive so a running Worker survives the migrate-then-deploy window.

A promotion pull request is merged with **"Create a merge commit"** — never "Squash and merge", never "Rebase and merge". Feature branches into `develop` keep squashing; the rule is about the one leg where both sides are long-lived.

## Consequences

Agents always cut from and target `develop`. Staging is the human-QA surface; QA findings return to the backlog as GitHub issues. `main` only ever receives what staging has already run.

The merge-commit rule on the promotion leg is what keeps that possible. `main` and `develop` promote into each other forever, and only a merge commit records `develop`'s tip as a second parent of `main` — which is what makes the merge base advance. A squashed promotion copies `develop`'s content onto `main` under a new commit id instead: the merge base stays where it was, so the squash itself reads as `main`'s edit to every file it touched, and the next `develop` change to any of those files then looks like an independent edit on both sides, which is what Git reports as a conflict. A file the squash touched but nobody edits again still merges cleanly — the conflict needs that second edit. That is not a one-release cost — it compounds on every promotion after it, until the ancestry is repaired. #370, #373 and #377 were squashed, left the merge base three releases behind, and blocked #383.

Discipline alone already failed once, so the rule is meant to be held up by two guards rather than by memory: the `main` branch ruleset restricting its allowed merge methods to `merge`, so GitHub offers no other button, and `.ai/skills/om-approve-merge-pr/SKILL.md` reading the merge method off the pull request's base branch, so the automation cannot squash a promotion either. Both sit outside what an agent run may change — repository settings on one side, `guard-generated.sh` on the other — so a human applies them.

**Recovery, if a promotion is squashed anyway.** Repair the ancestry with a back-merge, not a revert: on `develop`, merge `origin/main` in. The merge commit puts `main` back in `develop`'s ancestry, so the next promotion diffs cleanly again.

Merge it plainly first — `git merge origin/main` — and read the conflicts instead of pre-empting them. There will be some, and they are the point: every file the squash copied and `develop` has since edited conflicts. Each one shows `main`'s side as one of two things, and they look different. A stale copy of content `develop` already carries is the squash showing through — resolve to `develop`. Content `develop` never saw is a genuine hotfix that only ever lived on `main`, and it has to be kept.

`git merge -X ours origin/main` is the shortcut that answers all of those conflicts in `develop`'s favour at once. It is safe only once you know there is no hotfix among them, because it gives no sign of what it discarded: a conflicting hotfix is dropped, the result comes out byte-identical to `develop`'s pre-merge tree, and `git diff --stat <develop-tip-before-the-merge> HEAD` prints nothing — exactly what a clean recovery prints. That check sees only `main`'s _non_-conflicting content, which `-X ours` merges in regardless, since it is a merge _option_ and not `-s ours`; anything it prints is `main`-only content to decide about deliberately rather than to carry along. Worth running before pushing, but it is not what tells you a hotfix survived. #394 is the worked example.
