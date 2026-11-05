# Sentry navigation diagnostics (#1849)

Opt-in experiments for the installed real SDK/native browser transport. They change no production
source or CI policy. Exit zero means the experiment completed: inspect `failure`, trial phases,
console output, packet receipts and transport results before drawing a delivery conclusion.

Run from the repository root with locked dependencies, Playwright browsers and both commits
available locally. Use a private temporary directory; keep the same `TMPDIR` for all phases:

```sh
SENTRY_NAV_TMP=$(mktemp -d "${TMPDIR:-/tmp}/sentry-nav.XXXXXX")

# Reduced route fixture: both browsers/sampling environments/sizes, four navigation conditions.
TMPDIR="$SENTRY_NAV_TMP" timeout 520 pnpm exec tsx scripts/sentry-navigation/run.mjs \
  2e28a8e3c06fb394d29a40a8c9e51ec1b77900f8 \
  9ed0a446d2d5692e43fb6bdb1b0de65bca08c4fc > "$SENTRY_NAV_TMP/matrix.json"

# Full application. Separate build/probe phases stay below the host's foreground-call limit.
TMPDIR="$SENTRY_NAV_TMP" timeout 520 pnpm exec tsx scripts/sentry-navigation/app.mjs \
  2e28a8e3c06fb394d29a40a8c9e51ec1b77900f8 prepare "$SENTRY_NAV_TMP/current.json"
TMPDIR="$SENTRY_NAV_TMP" timeout 300 pnpm exec tsx scripts/sentry-navigation/app.mjs \
  2e28a8e3c06fb394d29a40a8c9e51ec1b77900f8 probe "$SENTRY_NAV_TMP/current.json" \
  > "$SENTRY_NAV_TMP/current-results.log"
TMPDIR="$SENTRY_NAV_TMP" timeout 60 pnpm exec tsx scripts/sentry-navigation/app.mjs \
  2e28a8e3c06fb394d29a40a8c9e51ec1b77900f8 cleanup "$SENTRY_NAV_TMP/current.json"

# Repeat those three phases with the affected SHA and a different artifact filename.
# PLAYWRIGHT_BASE_URL may select an owned 127.0.0.1 port in 3030-3040 (default3039).
# strictPort refuses another listener; do not run two probes against the same artifact.

# Assess the complete supported streaming candidate, without enabling it in the app.
TMPDIR="$SENTRY_NAV_TMP" timeout 240 pnpm exec tsx scripts/sentry-navigation/streaming.mjs \
  > "$SENTRY_NAV_TMP/streaming.json"
```

`app.mjs prepare` archives tracked source, links installed dependencies, creates only a dummy local
auth key, applies local D1 migrations without users and builds using the repository configuration.
No credential or local state is copied. Artifact descriptors are restricted to `TMPDIR`; snapshots
must be its `sentry-app-*` children. `probe` closes browsers/servers but retains the prepared build
for repeat measurements; `cleanup` removes it and its descriptor. Call cleanup after failures too.
The collector binds before any browser opens; if its reserved port was taken during compilation,
the probe refuses without sending telemetry. Output ends in `SENTRY_APP_RESULT=<json>` after
build/runtime messages, with original source hashes and a client-asset digest.

Full-app probes retain real hydration and the complete route tree. They wait for the same React
fiber readiness predicate as `e2e/helpers/settle.ts`, serialized inline because `tsx` name helpers
cannot run inside Playwright's evaluated function. They navigate `/` to `/pricing` through the real
router or document replacement, before/after the selected diagnostic transaction response.
Selection requires both trace and operation: different envelopes can share a trace. Test-only
hooks installed before hydration retain all automatic transaction observations. The transport
observer calls the original send once and returns its exact original promise; private `_outcomes`
are client-wide counters, not per-envelope loss proof. Calculated transaction size is an approximate
serialized-character count, not a byte count. Observation and extra serialization can change
race timing slightly; keep these cohorts separate from minimally instrumented runs.

The reduced fixture replaces hydration/route content but retains revision-owned initialization,
replay setup, scrubbers and router integration. It generates256 or65000 padding characters.
`early-spa`/`early-document` navigate after diagnostic envelope emission; `settled-document` first
observes its SDK response. `provisional-document` schedules the old document's span250ms after
scheduling replacement, holding the replacement document1500ms. Creation must occur after its
request begins; a failed timing condition is retained as `condition-not-established`, never counted
as lifecycle evidence. Two trials per condition. Staging must sample; production keeps its0.1
rate and explicitly records unsampled probes. Replay's stochastic sampling is unchanged.

`streaming.mjs` tests the public `spanStreamingIntegration()` with
`withStreamedSpan(scrubTelemetry)`, rather than a flag-only configuration. It identifies real v2
span members, records SDK outcomes and associates native request bodies with collector receipts
by SHA-256. Equal byte lengths are not identity proof. It tests small/large/many-span cases in
settled/provisional navigation. It is a candidate assessment, not an adoption or privacy/ingestion
certification. The installed SDK/version-specific serializer is pinned explicitly.

Every context blocks external destinations before SDK initialization. Owned collector requests
bypass Playwright routing and use native HTTP/CORS. App probes substitute an empty font stylesheet
without fetching a CDN and make no visual claim. The unchanged `watchConsole()` attaches before
navigation. Fatal outcomes remain visible; intentional HTTP429 controls can produce native
resource errors and are kept separate from clean-console navigation assertions.

Collectors bind only127.0.0.1 and the owned origin/envelope endpoint, with bounded lifetime/counts
and streamed body discarding. Reduced fixture:128KiB/1024 requests; full app:21MB/256 requests
(the installed Replay buffer permits20MB); streaming candidate:2MB/32 requests per trial. Lifetime
is at most eight minutes. Header IDs, byte counts, body digests, response metadata and guard-rejection
enums survive; payloads, credentials, browser storage states, traces, HARs and screenshots do not.

Read four outcomes independently: navigation completion, SDK emission/native dispatch, matching
collector receipt, and server/browser/SDK response observations. Collector `status` is the planned
response; `finished` records response completion. A body receipt with a rejected response is not
loss. A null SDK status can also represent an expected SDK drop; actual transport rejection is
recorded separately. Receipt snapshots are bounded; all collector records allow later ID joins.
Unmatched/unobservable outcomes remain unknown. Preserve expected buffer/backoff controls and all
failed preparation runs. See `results.md`; runtime repair remains unresolved, so use `Refs #1849`.
