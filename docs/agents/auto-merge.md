# Automatic merges into develop

`.github/workflows/auto-merge-develop.yml` inspects open PRs every five minutes on the default branch. It prints a JSON decision for each PR and merges at most one, oldest eligible PR per run. `scripts/agents/auto-merge-develop.mjs` defaults to dry-run; `--apply` is the only write mode. The workflow remains in dry-run until the repository variable `AUTO_MERGE_DEVELOP_APPLY` is exactly `true`.

The controller does not run PR code. In write mode it reads the live PR, linked implementation issues, current `develop` tip, review threads, reviews, QA evidence and required GitHub Actions checks twice. The merge API receives the expected head SHA and the branch ruleset remains the final authority. PRs to `main`, drafts, forks, security work and PRs without exactly one `risk-low` or `risk-medium` label on both PR and every linked issue stay manual. It recognizes implementation issues through the same explicit closing-keyword parser as post-merge housekeeping; `Refs #n` alone does not qualify.

An approval must be a GitHub `APPROVED` review on the current head by an account in `AUTO_MERGE_REVIEWERS`, distinct from the PR author, with this exact line in its body:

```
Reviewed SHA: <full 40-character head SHA>
```

An implementation self-check or a `COMMENTED` review does not qualify. Cezar's independent reviewer records that line already; its publishing identity must be separate from the author to produce the GitHub approval. Until such an identity is provisioned for agent-authored PRs, a trusted human approval can satisfy this gate. Keep the reviewer allowlist narrow and configure it as a comma-separated repository variable.

For a PR labeled `needs-qa`, a person in the comma-separated `AUTO_MERGE_QA_REVIEWERS` variable must apply `qa-approved` and post this exact line in a PR comment:

```
QA-approved SHA: <full 40-character head SHA>
```

A new push changes the SHA and invalidates the evidence. Existing QA evidence without that line is sufficient for the manual merge path but cannot authorize the controller.

For write mode, install a dedicated GitHub App on this repository with Contents and Pull requests write, Issues and Checks read, and no ruleset bypass. Set `AUTO_MERGE_APP_ID` and the secret `AUTO_MERGE_APP_PRIVATE_KEY`. The workflow creates a short-lived installation token only in write mode. GitHub Actions' default token is used for dry-run. The App token also lets the merge's push start CI on `develop`.

Before enabling write mode:

1. Merge this workflow to `develop`, then promote it to the default branch `main` by the normal human-reviewed merge commit. Scheduled workflows load from `main`.
2. Set the `develop` ruleset's required status checks to strict (up-to-date branch required). Preserve the four required contexts, review-thread resolution and all bypass restrictions.
3. Configure the reviewer and QA allowlists, install the App, and observe at least 24 hours of dry-run output. Investigate every eligible decision and API failure. `node scripts/agents/auto-merge-develop.mjs --dry-run` is the local inspection command.
4. Set `AUTO_MERGE_DEVELOP_APPLY=true`. Observe the first `risk-low` merge through the subsequent CI push and issue housekeeping. Unset the variable to stop automatic merges without changing manual merge controls.

No merge is authorized by a PR label alone. `merge-queue` is a routing label, and `qa-approved` is valid for the controller only with current-SHA evidence. A failed or incomplete API read fails closed for that PR and makes the workflow run red.
