# E2E migration verification

All 32 original files now have e2e-inc owners. The portable engine replaces 11
original Chromium instances with 20 independent behaviors; the public browser
engine retains all 229 other original Chromium instances. The exact collected
title mapping is checked by `scripts/e2e/__tests__/inventory.test.mjs`. The current
inventory includes all five landing-comparison locale cases added by #1926 to the PR base.

## Required evidence

Use Node 24.x, matching `.github/actions/setup/action.yml`. Record the Node and
ICU versions with the receipt; changing the runtime changes the gate inputs.

Run these sequentially against the seeded local `E2E_BUILD=1` preview:

```sh
export E2E_PREVIEW=1
pnpm e2e:verify-engine
CI=true E2E_WEBKIT=1 pnpm e2e:native
CI=true pnpm e2e:browser --target chromium
CI=true E2E_WEBKIT=1 pnpm e2e:browser --target mobile-safari
SENTRY_AUTH_TOKEN= VITE_SENTRY_DSN= VALIDATION_MAX_WORKERS=1 GOMAXPROCS=2 node scripts/ci/validation.mjs
```

Set `E2E_BASE_URL` to this checkout's owned origin before running either engine.
The browser suite has existing Chromium-only exclusions and an optional weather
picture export; neither missing fixture auth nor a missing browser is a valid
reason to silently pass. The engine probes explicitly skip the iPhone check
only in CI without `E2E_WEBKIT=1`.

Portable results are written to `.e2e/report.json`; browser journey results to
`.e2e/browser/report.json`. Both contain `run.summary`, JUnit and Markdown beside
them. Preserve each completed target's report before running another target.
All `.e2e/` output, including private sessions, is ignored by Git. CI uploads
only the named reports, trace pages, PNGs and bounded JSON evidence.

The canonical executor writes its command results, input digest, durations and
log paths under `.ai/tmp/validation/`. A green receipt requires every configured
command and all three Vitest projects, without a resume-based CI claim. Freeze
source inputs until it completes. The worker override can only reduce the
existing ceiling; it changes no test deadline or assertion.
Stage new input files first: the executor fingerprints tracked Git content.
Keep concurrent untracked inputs untouched and compare their hashes before and
after validation. A changed checkout requires a fresh gate.

Retain failed and interrupted receipts as diagnostic evidence. They never authorize
changing a host service, evading a denied termination or reporting a stale result
as green. Use only the current completed receipt and actual target summaries.

This local verification does not claim an executed GitHub Actions run, merge
approval or a production deployment. GitHub must execute the same committed
configurations on the eventual pull request. Codex authors and diagnoses the
tests; no model credentials are needed for their deterministic Actions runs.
