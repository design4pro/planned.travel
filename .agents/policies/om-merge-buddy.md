# om-merge-buddy repository policy

Always apply `.agents/policies/security.md` and the atomic ownership protocol in `.ai/trackers/github.md`.

Extends `.agents/skills/om-merge-buddy/SKILL.md`; all existing safety gates apply.

## Shared PR and CI evidence

Use `node .ai/scripts/pr-state.mjs <pr>` for the read-only state snapshot and add `--wait` for
one bounded CI wait. Reuse its required-check and workflow-run evidence instead of rebuilding
API/polling loops in the agent. `unknown` is never green; inspect the warning rather than treating
unreadable external checks as passed. This helper does not replace fresh-head checks before
mutations, claims, unresolved-thread handling, security verdicts or current-head QA approval.
