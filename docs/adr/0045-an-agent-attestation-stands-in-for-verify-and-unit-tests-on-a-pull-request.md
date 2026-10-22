# 0045. An agent attestation stands in for `verify` and `unit tests` on a pull request

Status: accepted
Date: 2026-10-22
Amends: ADR 0021 (decision 2: `lint · typecheck · build` and `unit tests` no longer always run on a pull request; they run when no valid attestation covers the head). The merge authority, the required-check names and the deploy gate are unchanged.

## Context

A pull request waits on `verify` and `unit tests` on the VPS pool before it can merge. The unit
suite alone measured 532 s on a `ci` slot (run 35968476152, see the comment above `test` in
`ci.yml`), and the pool has two slots. The agent that wrote the change has already run the same
commands: `validation.commands` is the gate it must pass before it opens a pull request (SDLC.md §
Validation gate). The second run on the same code, on a slower machine, rarely tells the reader
anything the first did not.

ADR 0021 is why this cannot be "trust the agent's report". Before it, CI gated nothing, and a
reader trusted the agent's own account of the gate. Over 50 merged pull requests CI then caught real
defects, four of them in the merge result that a branch-level run cannot see. So the report has to
be something CI can check, not something it must believe.

## Decision

1. **The agent leaves an attestation**, a pull request comment found by the marker
   `<!-- agent-attestation -->`, written by `node scripts/ci/attestation.mjs attest --pr <n>`. The
   script itself runs `validation.commands` of the committed head, in order, from a clean tree, and
   records each exit code. It posts nothing when a command fails. The comment carries the head's
   **tree hash**, not its SHA: a rebase that keeps the content keeps the attestation, and one more
   commit voids it.
2. **A new job `attestation` judges it** (`attestation.mjs verify`, GitHub-hosted, seconds). The
   record is accepted only when all of these hold; otherwise `verify` and `test` run as before:
   - a trusted author wrote it (`OWNER`, `MEMBER` or `COLLABORATOR`; anyone can comment on a public
     pull request);
   - its tree hash is the tree CI checked out at the pull request head;
   - it ran exactly the **base branch's** `validation.commands`, in order, each with exit 0 - read
     from the base, so a pull request cannot shorten the gate it is judged by;
   - the diff touches none of the paths that define the gate or are `risk-high` (`.github/`,
     `scripts/`, `.ai/agentic.config.json`, `package.json`, the lockfile, test and build config,
     `src/server/auth|billing|public`, `repos/base.ts`, `db/schema.ts`, `drizzle/`);
   - the diff is non-empty and shorter than the files API's limit.
3. **`verify` and `unit tests` are skipped on a valid attestation.** A skipped required check counts
   as passed, so the rulesets keep requiring the same four names and nothing changes in GitHub
   settings. A push to `develop` or `main` never skips them: the full gate runs on the merge commit
   and the deploys still wait on it (ADR 0021 decision 4, #531).
4. **The journeys are untouched.** `e2e` runs on every pull request whose diff can reach a screen,
   as ADR 0016 and ADR 0021 decide: they need a clean database and a browser, which the local gate
   does not provide, and that is the class of failure ADR 0021 measured.

## Consequences

- **Fail-open to the old behaviour.** A missing comment, a stale one, an API error in the judging
  job or a diff in the excluded paths all end in the full jobs running. The only way to a skipped
  gate is a positive, checkable record.
- **A merge-result failure now surfaces after the merge**, not on the pull request: the attestation
  proves the head, and `strict_required_status_checks_policy` is already off (ADR 0037). The push run
  on `develop` still runs the whole gate and blocks the deploy, so a red merge commit never ships; it
  does hold `develop` red until the next fix. ADR 0021 counts this class at 4 of 24 failed attempts.
- **Trust is a collaborator's.** A collaborator could post a false attestation, as one can already
  merge a pull request; the tree binding and the post-merge run bound what that is worth. Signing the
  record was rejected: it needs keys, which the zero-config rule of this repository forbids.
- **Agents must attest last.** Any later push to the head changes the tree and voids the record. The
  four skills that push (`om-auto-create-pr`, `om-auto-continue-pr` and their `-loop` variants) run
  the attest step after their final push and the e2e journeys stay in CI.
- **Three seconds-long jobs leave the pool.** `attestation`, `scope` and `e2e-report` run on
  `ubuntu-latest`: over 25 green pull request runs they queued a median 31-44 min for a pool slot to
  do a few seconds of work, ahead of and after the jobs that need the pool. This does not use
  `vars.RUNNER_CI`; the recovery path of ADR 0027 still moves everything else.
- **A draft until the last push.** A chain opens its PR as a draft and marks it ready after its last
  push and attestation (SDLC.md § Draft until the last push), so CI starts once on the final head
  instead of on every checkpoint: 146 of 300 recent CI runs were cancelled by a later push.
  Review and QA fix rounds push to the draft.
- **Rollback** is reverting the `attestation` job and the two `needs`/`if` edits in `ci.yml`; no
  setting outside the repository moved.
