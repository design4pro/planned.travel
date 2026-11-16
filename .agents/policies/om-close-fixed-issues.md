# om-close-fixed-issues repository policy

Always apply `.agents/policies/security.md` and the atomic ownership protocol in `.ai/trackers/github.md`.

Extends `.agents/skills/om-close-fixed-issues/SKILL.md`. Use the deterministic
`scripts/agents/close-fixed-issues.mjs` only to report candidates and parse explicit closing
links. Its legacy `--apply` entrypoint is retired. The installed skill owns every tracker
write, acquiring atomic ownership for each issue before re-reading and applying a decision.

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
node scripts/agents/close-fixed-issues.mjs --dry-run --checkpoint
```

For each proposed closure, acquire the installed skill's atomic issue lock, then re-read
state, complete comments, labels, assignees and active work. Preserve `do-not-close`, `blocked`,
foreign claims and human holds. Post the linked idempotent comment before closing; a failed
comment cannot leave a context-free closure. Release only this run's exact lock on every exit.
A non-base merge may receive an informational comment, never a closure. Already closed issues
receive no mutation. Read-only reports never authorize a write without those fresh checks.

`--since YYYY-MM-DD` selects the report's lower bound; the default `last-release` uses
CHANGELOG.md. An unreadable boundary fails rather than silently shortening the window.

PR bodies are used only for parsing, never copied into comments or logs. Each
PR without a recognized link is reported as skipped; no bare reference causes
a tracker mutation. Per-pair errors make the command fail while allowing other
pairs to finish, so operational failures cannot look like successful cleanup.

`--pr N` reports one confirmed merge. Spec-only diffs and epics remain open; epic acceptance is not inferred from closing keywords.

When a delivery workflow supplies one confirmed merged PR, restrict enumeration to that PR. This narrows the scope without bypassing any issue claim, hold, parser or freshness check. Report a blocked closure explicitly; do not treat the merged PR alone as a completed issue.
