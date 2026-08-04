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

## Evidence recorded for issue #38

- Workers Build `c034ce08-abde-4407-b625-e666f545d5b8` built and deployed commit
  `1913319` successfully; the deploy log confirms the staging D1, KV, R2,
  Queue, and `planned-travel-embeddings-staging` Vectorize binding.
- The deployed staging Worker version is
  `16133a53-ad76-4318-a232-b2f1bbd79e91`; earlier versions remain listed for
  rollback.
- GitHub CI run `30839282999` passed quality gates, fresh-D1 migrations,
  artifacts, secret scan, and Chromium staging E2E. The local 18-test staging
  suite and five Maestro mobile flows also passed with visual snapshot,
  accessibility, responsive, keyboard, and performance evidence.

## Production cutover and rollback closure

On 2026-08-04, commit `4afe731d7a43d8461b6e0117ebde2b235b363099` was deployed
through the Workers Builds production trigger `Deploy default branch`. Build
`e423e5f2-adc3-4ae6-9c0d-1e0800c4c77c` completed successfully. The resulting
production deployment is version
`2fdd8c22-d193-4df5-9b26-78adf15e6384`; it exposes both `fetch` and `queue`
handlers and retains the production D1, KV, R2, Vectorize, Browser Rendering,
AI, Images, Durable Object, and queue bindings.

Post-deploy smoke checks against
`https://planned-travel-web.design4pro.workers.dev` passed for `/api/health`,
all EN/PL public routes, `/app`, and the unauthenticated `/api/trips` access
gate (401).

Rollback closure is complete. The immediately previous production version
`aec87012-3019-44ad-b1c2-51a484d6b42a` remains deployed and available for
rollback; earlier version `0d0af063-cddf-4b9d-aeda-8dcd294f669c` is also
retained. No Worker, storage resource, or D1 migration was deleted or renamed,
and no destructive down-migration was run. The release can therefore be
rolled back without changing storage state.

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

The `pnpm release:check` step also verifies the release contract itself: CI
still contains every required gate and staging E2E target, the runbook retains
the non-destructive rollback safeguards, migrations contain no destructive
down-migration statements, and superseded runtime dependencies are absent from
workspace manifests. This catches accidental weakening of release safety before
the normal quality jobs run.
