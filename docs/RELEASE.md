# Release and rollback runbook

This runbook describes the non-destructive production cutover for the web
Worker. It is intentionally separate from feature work: a release must be
safe to abort even when a dependent migration or service is unavailable.

## Before cutover

1. Confirm the CI `Quality gates` and `Secret scan` jobs passed for the exact
   commit being released.
2. Apply the current migrations to an isolated staging D1 with
   `pnpm db:check` (local) and `wrangler d1 migrations apply planned-travel
   --remote --config apps/web/wrangler.jsonc` (staging).
3. Deploy the Worker to its staging/preview hostname. Run the health check,
   authentication gate, trip creation, invitation, realtime, reservation,
   document, cost, notification, billing, and PDF smoke flows that are
   enabled in the target environment.
4. Record the deployed Worker version, migration list, commit SHA, and the
   baseline p75 LCP/INP/CLS values in the release ticket.
5. Verify that the previous Worker version, D1, KV, R2, and Durable Object
   resources remain available. Cutover must not delete or rename them.

## Isolated staging

The staging Worker is `planned-travel-web-staging` at
`https://planned-travel-web-staging.design4pro.workers.dev`. It uses separate
Cloudflare resources and must never receive production IDs:

- D1: `planned-travel-staging` (`dd1d78b8-a16e-4132-881a-b2c8e33a5e64`)
- KV: `PLANNED_TRAVEL_STAGING_KV` and `PLANNED_TRAVEL_STAGING_SESSION`
- R2: `planned-travel-staging-media`
- Queue: `planned-travel-staging-jobs`
- Vectorize: `planned-travel-embeddings-staging` (768 dimensions, cosine)

From `apps/web`, apply migrations and deploy with the staging environment
selected at build time:

```sh
pnpm migrate:staging
pnpm deploy:staging
pnpm e2e:staging
```

The staging build binds the separate Vectorize index above; semantic-search
requests therefore cannot read or mutate the production index.

The current evidence gate also runs Axe accessibility checks, EN/PL language
checks, dark-mode and 390px responsive checks, keyboard focus checks, and a
five-sample p75 LCP/INP/CLS performance report for desktop and mobile. The
committed regression budgets are in `apps/web/e2e/performance-baseline.json`.
Native mobile
evidence is collected with Maestro on the iOS simulator; it requires staging
credentials and a locally built Expo development client.

## Evidence recorded for issue #33

- Staging build `fc43aa7e-3f9-4f6f-82e5-0b07c21a8387` built and deployed commit
  `2f3200e` successfully; the deploy log confirms the staging D1, KV, R2,
  Queue, and `planned-travel-embeddings-staging` Vectorize binding.
- The deployed staging Worker version is
  `17cce863-0cdb-4fe6-8ae0-b8bed5ebc2ed`; earlier versions remain listed for
  rollback.
- GitHub CI run `30833319109` passed quality gates, secret scan, and Chromium
  staging E2E. The local 18-test staging suite also passed with visual snapshot
  comparisons and the performance budget.

## Cutover

Deploy the already-tested commit through Workers Builds, then run the health
and authentication smoke checks against the production hostname. Route traffic
only after those checks pass. Keep the previous Worker and storage resources
unchanged for the rollback window.

## Rollback

If smoke checks or monitored error/performance budgets fail, route traffic back
to the previous Worker version and keep the new version available for
investigation. Do not run a destructive D1 down-migration: migrations are
forward-only and the old application must remain compatible with any additive
schema changes. Restore data from the latest verified backup only if required.

Record the trigger, timestamps, Worker versions, migration state, observed
metrics, and the decision to retry or abandon the release. Remove superseded
compatibility routes and prototype assets only after the rollback
window is closed and the next release has passed the same staging checks.

## CI contract

The repository workflow runs install, fresh local-D1 migrations, typecheck,
lint, tests, builds, artifact upload, and TruffleHog secret scanning on pull requests and
on `main`/`develop` pushes. Workers Builds remains the deployment mechanism;
the GitHub workflow is the pre-deploy quality gate, not a second production
deployment path.
