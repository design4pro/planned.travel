---
name: om-close-fixed-issues
description: Deterministic merged-PR issue reconciliation for planned.travel.
---

Extends `.claude/skills/om-close-fixed-issues/SKILL.md`. For this repository,
replace its merged-PR parsing and mutation steps with
`scripts/agents/close-fixed-issues.mjs`. The housekeeping workflow runs this
command directly; do not reproduce its decisions with an LLM.

GitHub's `closingIssuesReferences` is structurally empty for feature PRs here:
they target `develop`, while the default branch is `main`. Step 3.1 therefore
yields no links for those PRs. The explicit English closing keywords in the PR
title and body (step 3.2) are the only live signal. `Refs`, bare mentions,
cross-repository references and examples inside code do not authorize closing.
Keep indented code (including quoted indented code) out of the parser too;
removing code must never join a keyword to a distant issue number.
PRs from `spec/` branches are design-only and never close implementation issues,
even if a PR body mistakenly uses a closing keyword. The `documentation` label
alone does not imply design-only work.
The script reads `baseBranch` from `.ai/agentic.config.json`.

Preview (the default is read-only):

```bash
node scripts/agents/close-fixed-issues.mjs --dry-run --limit 50
```

Apply only when the invocation authorizes mutations:

```bash
node scripts/agents/close-fixed-issues.mjs --apply --limit 50
```

`--dry-run` overrides `--apply`. `--since YYYY-MM-DD` selects the lower bound;
the default `last-release` resolves the topmost release date in `CHANGELOG.md`.
An unreadable or malformed latest release fails the run and requires an explicit
`--since`; never replace that boundary with a moving seven-day window. `--repo owner/name` optionally selects the
repository. Unlike the generic skill, the script does not resolve git refs, inspect unmerged
PRs, or extend the built-in keyword vocabulary.

Every pair re-reads the issue and skips closed issues and `do-not-close`,
`blocked`, or `in-progress` labels. This bounded reconciler does not acquire
claims or edit labels/assignees. It posts the linked comment before closing:
a failed comment cannot leave a context-free closure, and a failed close is
retried without duplicating the comment. Comments carry a stable PR/action
marker checked against the current actor's comments. Non-base merges only get
an informational comment, once. Already closed issues receive no mutations.
The workflow must not run concurrent copies of the housekeeping reconciler;
GitHub does not provide atomic compare-and-close or unique comment insertion.

PR bodies are used only for parsing, never copied into comments or logs. Each
PR without a recognized link is reported as skipped; no bare reference causes
a tracker mutation. Per-pair errors make the command fail while allowing other
pairs to finish, so operational failures cannot look like successful cleanup.
