# Sentry navigation diagnostics (#1849)

Opt-in diagnostics only. Nothing here is imported by the application or changes CI, dependencies,
SDK sampling, scrubbing, Replay masking or sensitive-location retirement. **A successful process
exit means the experiment completed, not that delivery or the console passed.** Read `results.md`.

The original tooling came from the closed, unmerged PR #1861, commit
`152086de1fa11cdcf11f1f5b9744641cdaf5ab45`. This continuation updates revision comparison,
certifies provisional conditions using every attempted dispatch rather than a late creation
callback, and preserves the rejected memory-only worker experiments as historical evidence.
The amended issue additionally permits the bounded transaction recovery implemented in
`src/lib/sentry-delivery`; `recovery.mjs` verifies that actual transport with the real SDK.

## Requirements and commands

Use the locked installation and `pnpm exec playwright install chromium webkit`. Run from the
repository root. Save output in an ignored private scratch directory, not in a telemetry system.
All URLs are owned loopback listeners; no production DSN or credential is required.

```sh
mkdir -p .ai/tmp/sentry-navigation

# Native installed SDK transport: 120 trials per browser, including actual UTF-8 byte limits.
timeout 520 node --import tsx scripts/sentry-navigation/fetch-lifecycle.mjs chromium \
  > .ai/tmp/sentry-navigation/chromium.json
timeout 520 node --import tsx scripts/sentry-navigation/fetch-lifecycle.mjs webkit \
  > .ai/tmp/sentry-navigation/webkit.json

# Same transport seam, isolated candidate. Run each mode/browser separately.
# relay-warm waits for readiness before sending; SDK transport creation remains immediate.
# relay-slow delays registration response 1s and does not wait before sending.
timeout 300 node --import tsx scripts/sentry-navigation/fetch-lifecycle.mjs webkit relay-warm \
  > .ai/tmp/sentry-navigation/relay-ready.json
timeout 300 node --import tsx scripts/sentry-navigation/fetch-lifecycle.mjs webkit relay-slow \
  > .ai/tmp/sentry-navigation/relay-cold.json
# `shared-slow` exercises SharedWorker handoff with a 1s source delay.
# `shared-blob` preconstructs an inline worker (startup-headroom control).
# `shared-blob-cold` constructs it at send time with same-task early navigation.
# `shared-blob-blocked` also delays worker execution 1s. All are diagnostic candidates.
# Repeat with chromium. relay-cold (ordinary first registration) and relay-fail (503 script)
# are also available for further diagnosis. They are not certified correction paths.

# Reduced fixture with revision-owned Sentry initialization, router tracing and privacy modules.
timeout 520 node --import tsx scripts/sentry-navigation/run.mjs \
  c3d1504856683fb8848d51cdee796efd00fc7949 \
  9ed0a446d2d5692e43fb6bdb1b0de65bca08c4fc \
  > .ai/tmp/sentry-navigation/reconstructed.json

timeout 60 pnpm exec vitest run --project tooling scripts/sentry-navigation/__tests__
```

`run.mjs` reconstructs both revisions' telemetry source using the **current installed dependency
graph**, with SDK version and both lockfile hashes recorded. Historical source plus current
libraries is not an exact rebuild of the affected historical application. The native experiment
asserts that the four telemetry source files are byte-identical at the pinned current HEAD and
affected revision; it records package/lock hashes without assuming they are identical.

`app.mjs` separately prepares the complete application from a pinned revision in a disposable
snapshot. It requires that revision's lockfile to match the current installation, so it refuses
an incompatible historical rebuild. Set `TMPDIR` to an absolute private scratch directory, then
run `prepare`, `probe`, and `cleanup` as separate bounded commands:

```sh
TMPDIR="$PWD/.ai/tmp/sentry-navigation" timeout 520 node --import tsx \
  scripts/sentry-navigation/app.mjs c3d1504856683fb8848d51cdee796efd00fc7949 \
  prepare "$PWD/.ai/tmp/sentry-navigation/app.json"
TMPDIR="$PWD/.ai/tmp/sentry-navigation" timeout 300 node --import tsx \
  scripts/sentry-navigation/app.mjs c3d1504856683fb8848d51cdee796efd00fc7949 \
  probe "$PWD/.ai/tmp/sentry-navigation/app.json"
TMPDIR="$PWD/.ai/tmp/sentry-navigation" timeout 60 node --import tsx \
  scripts/sentry-navigation/app.mjs c3d1504856683fb8848d51cdee796efd00fc7949 \
  cleanup "$PWD/.ai/tmp/sentry-navigation/app.json"
```

The snapshot contains tracked source, linked locked dependencies, a disposable synthetic auth key
and empty local D1 migrations. It copies no credentials, browser storage or customer data.
The default preview port is owned `127.0.0.1:3039`; `PLAYWRIGHT_BASE_URL` can select 3030-3040.
The collector binds before browser startup; a conflicting listener refuses. Always clean up a
snapshot after a preparation/probe failure. Full-app output ends with `SENTRY_APP_RESULT=<json>`.

## Interpretation and safety

Read navigation, attempted send, matching collector receipt and response observation independently.
A collector receipt does not prove the departing document observed a response. A different
transaction in the same trace is not a matching response. Native and relay receipts require the
envelope ID, actual serialized byte count and SHA-256; bodies are streamed into a hash and discarded.
For reduced/full-app SDK hooks, operation plus trace selects the diagnostic event; collector IDs
join its receipt. Full-app size observations are serialized characters, not byte counts.

Native observation calls the original fetch exactly once with its receiver/options and returns
its exact promise. The relay variant instead observes **submission to the relay adapter**. Its
recorded `keepalive` is the SDK's requested value, not the worker's actual fetch setting; worker
fetches use `keepalive: false`. Its provisional certification establishes page-side submission
ordering, not an independently observed worker dispatch timestamp. No “message accepted” result
is treated as ingestion success: only the worker's real HTTP status and rate-limit headers resolve
the transport. Pending registration, worker failure and response uncertainty are not delivery.

The optional SharedWorker candidate uses a synchronous message port without registration. Its delayed script still leaves an ownership/startup gap; it has no persistent storage either.

The ready-before-send relay is a control, not proof that cold startup works. It introduces no disk
queue, no native fallback, no duplicate retry and no production registration. Browser contexts are
disposable. No guarantee of delivery after process/worker termination is claimed.

The unchanged `watchConsole()` attaches before the first navigation. Failures are retained without
suppression. Intentional 429 controls are separate from clean-console navigation conditions.
Unsampled production transactions, SDK rate-limit drops and the 40-entry buffer's expected overflow
are separate outcomes. The destroyed document's terminal diagnostics remain unknown; a clean
successor cannot attest them. The reduced fixture substitutes route content and hydration; only
the full-app probe retains the complete route tree and real hydration.

Collectors bind only `127.0.0.1`, validate owned endpoints/origins and have bounded body size,
request count and lifetime. Native/candidate: 280,000 bytes, 2,000 requests, 480 seconds; reduced
fixture: 128 KiB/1,024 requests; full app: 21 MB/256 requests (Replay can be much larger than a
transaction). External destinations are blocked before SDK startup; the relay worker accepts only
its embedded owned collector URL. No proxying, payload files, traces, HARs, screenshots, auth
storage states or real credentials are retained. Full-app fonts are substituted locally.

Native source comparison and version assertions intentionally fail when assumptions change.
Do not loosen them to erase a failed reproduction. A successful diagnostic harness is not a
runtime repair and must not automatically close #1849.

## Bounded recovery verification

Run `timeout 300 node --import tsx scripts/sentry-navigation/recovery.mjs webkit` and repeat
with `chromium`. The harness builds the actual client initialization and worker asset from the
working tree, retaining real sampling/privacy/Replay setup; only React hydration is omitted in
this narrow fixture. It asserts synchronous admission, cold same-task navigation, sends during
provisional document replacement, settled delivery, changed-scope/sensitive-location discard,
and matching stored-body SHA-256/bytes/event ID at the discard-only collector. Five controls
exercise actual 204/413/429/503 responses, SDK transaction backoff and40/41 buffer drain.
Automatic pageload completes before controlled buffer measurement. Intentional HTTP-error
console entries are retained in controls, separate from clean lifecycle assertions.

`app.mjs ... prepare ... --index` overlays staged application source on the pinned base and
records each source hash, then builds the full application with hydration. Its probe enables
ServiceWorkers for that recovery snapshot; the unchanged native baseline blocks them. Never
use an unstaged change as claimed snapshot evidence. `node --import tsx` avoids the `tsx` CLI's
Unix socket path limit in deeply nested Cezar temporary directories. Use the repository CI's
Node major for final verification.
