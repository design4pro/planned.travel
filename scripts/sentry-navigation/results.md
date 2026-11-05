# Sentry navigation investigation, 2026-11-05

Issue: #1849. **Runtime repair is incomplete.** This change supplies diagnostic instrumentation
and results, not a production correction. No runtime source, sampling, privacy, event format,
transport, console policy or CI configuration changed. Keep the issue open: `Refs #1849`.

## Revisions and method

- Develop at run start: `2e28a8e3c06fb394d29a40a8c9e51ec1b77900f8`.
- Recorded affected PR #1821 candidate: `9ed0a446d2d5692e43fb6bdb1b0de65bca08c4fc`
  (conversation comment6633147975). Rebuilds are instrumented, not the historical CI artifact.
- Identical package/lockfiles and four production telemetry modules at both refs. Installed
  Sentry 10.72.0; Chromium 151.0.7922.34; Playwright WebKit 26.5; synthetic unauthenticated contexts.
- Full-app current build: 615 JS assets,
  digest `ffd15823e2c710bfa61a15d8db5c5d422ece5cb6edd3b188a2cb228cf1681b8a`.
  Affected: 539 assets,
  digest `e08b44e80f6b68247b564656d908489e403a7c13d0b989196a69cf4518cf7410`.
- Full hydration and route tree are retained in app probes. Reduced fixtures isolate forced
  lifecycle/size conditions. Owned discard-only collectors, no external telemetry, retained
  payloads, credentials, storage states, traces, HARs or screenshots. See README commands/limits.

## Corrected reduced SDK matrix

128/128 trials and all navigations completed; provisional creation followed replacement-request
start in every trial. 12 native transport controls passed. Each staging cell combines two trials
per revision. Selection requires trace plus diagnostic operation, and final receipts are joined by
its envelope ID. The collector retained 757 packet receipts; controls have unique prefixes.

| Engine   | Padding | Navigation           | Staging trials | Final receipt join | SDK 204 observed | Fatal trials |
| -------- | ------: | -------------------- | -------------: | -----------------: | ---------------: | -----------: |
| chromium |     256 | early-spa            |              4 |                  4 |                4 |            0 |
| chromium |     256 | early-document       |              4 |                  4 |                0 |            0 |
| chromium |     256 | settled-document     |              4 |                  4 |                4 |            0 |
| chromium |     256 | provisional-document |              4 |                  4 |                4 |            0 |
| chromium |   65000 | early-spa            |              4 |                  4 |                4 |            0 |
| chromium |   65000 | early-document       |              4 |                  4 |                0 |            0 |
| chromium |   65000 | settled-document     |              4 |                  4 |                4 |            0 |
| chromium |   65000 | provisional-document |              4 |                  4 |                4 |            0 |
| webkit   |     256 | early-spa            |              4 |                  4 |                4 |            0 |
| webkit   |     256 | early-document       |              4 |                  4 |                0 |            0 |
| webkit   |     256 | settled-document     |              4 |                  4 |                4 |            0 |
| webkit   |     256 | provisional-document |              4 |                  4 |                4 |            0 |
| webkit   |   65000 | early-spa            |              4 |                  4 |                4 |            0 |
| webkit   |   65000 | early-document       |              4 |                  3 |                0 |            0 |
| webkit   |   65000 | settled-document     |              4 |                  4 |                4 |            0 |
| webkit   |   65000 | provisional-document |              4 |                  0 |                0 |            4 |

Production-configured sampling selected11/64 spans; the remainder
were explicitly unsampled. This random synthetic sample is not production failure incidence.

Controls verified 204 responses, exposed 429/backoff headers and subsequent transaction backoff,
the 40-entry browser buffer, queue-overflow recording and a successful send after draining.
Intentional 429 resource errors remain visible and separate from navigation console assertions.

## Full-application observations

All prepared public navigations completed. Receipt of the selected diagnostic is not proof that
an automatic pageload transaction arrived. Cohorts are kept separate because instrumentation and
race timing differ.

| Cohort                                       | Trials | SDK access-control fatal trials | Limits                                                                                                                      |
| -------------------------------------------- | -----: | ------------------------------: | --------------------------------------------------------------------------------------------------------------------------- |
| Affected, initial prepared/hydrated baseline |     24 |                               4 | Old trace-only selection; primary delivery totals are not identity-certified.                                               |
| Affected, passive transport observer         |     16 |                               1 | One old primary-selection mismatch retained; the attributed settled-document case below has a correctly identified control. |
| Current, trace+operation selection           |     16 |                               2 | Both failed pageloads lack receipts; all 16 selected diagnostics arrived. Inherited preload warnings are kept separate.     |
| Current, guard-counter repetition            |     16 |                               0 | Zero collector origin/path/body/count rejections; no SDK fatal error in this repetition.                                    |

- Affected WebKit settled-document 1: diagnostic `c5e08d258ee14155a4744cbfb3c32f75` arrived 204.
  Pageload `e9d3e18097d449b78fcb7460c76175f5`, approximately 205402 serialized characters,
  rejected with TypeError; network_error was recorded and no matching collector receipt exists.
- Affected early-document 2: pageload `a 84840d8aa62430b84fb49a0d0436f7b` rejected, but its
  204944-byte body arrived and the server completed 204. This is response failure, not proven loss.
- Current settled-document 1/2: pageloads `0df8aa335016446ead38e1d7500050ec` (234249 characters)
  and `3204897f1c9940819c7f01d78b9bc4c1` (234269) rejected; neither has a receipt. Both selected
  diagnostics arrived.

Calculated characters are not bytes. Client-wide outcome counters cannot independently assign a
loss reason to one envelope. Rejection counters were added in a later repetition; its zero SDK
failures do not erase earlier failures. Missing observations remain bounded/unknown. No production
ingestion, customer-impact or historical-error universal-cause claim is made.

## Supported streaming candidate

The installed public `spanStreamingIntegration()` and `withStreamedSpan(scrubTelemetry)` were
assessed through real v2 span membership, not transaction counts. The final reproducible run
completed 24/24 navigations, emitted 824 v2 members and identity-correlated 620 received
members. Native request SHA-256 values match streamed collector-body digests; bodies are discarded.
Earlier byte-length-only associations are superseded. Four WebKit trials were fatal; zero collector
validation rejections were recorded.

| Engine/condition                   | Created | Received span IDs | Fatal trials |
| ---------------------------------- | ------: | ----------------: | -----------: |
| Chromium, all cases                |     412 |               412 |            0 |
| WebKit, settled cases              |     206 |               206 |            0 |
| WebKit, provisional small          |       2 |                 2 |            0 |
| WebKit, provisional 65k span       |       2 |                 0 |            2 |
| WebKit, provisional 101-span batch |     202 |                 0 |            2 |

The approximately 67KB single-span and 283KB multi-span failures repeated twice, with TypeError
transport rejection, network_error/category span, access-control pageerrors and no matching span
receipt. Separate successful session responses were not treated as span delivery. Cases used 256 or
65000 padding characters, or 100 children with 2000 characters plus their root. This does not certify
production ingestion, physical Safari, saturated streaming buffers, span rate limits or all privacy
surfaces. No production adoption is approved.

## Disposition

The installed fetch transport already chooses keepalive only at at most 60000 cumulative body
characters and fewer than 15 pending requests. Forcing it on does not remove the browser quota.
Streaming defaults permit 1000 spans/5MB, five-second flushing and a 500ms segment-end timer; batching
still creates oversized lifecycle-sensitive packets. Neither console suppression, trace reduction,
beacon substitution nor unverified compression/persistence is adopted.

A flag-only streaming negative probe was incomplete. An initial premise that the Browser SDK
lacked the public integration was wrong and corrected by source/runtime inspection; the rejection
above uses the complete supported configuration. Independent architecture and security reviews
found no verified narrow correction under the current contracts. Reliable oversized-event delivery
during document replacement needs a separately reviewed delivery design. A passing runtime
regression and clean WebKit document navigation remain unmet acceptance criteria. Keep priority-medium:
production frequency and material customer impact remain unknown.

## Validation and retained failures

- Test-first collector import failed before implementation; final collector/observer seam tests
  pass 9/9. They verify original promise/receiver/envelope preservation, safe reporting failures,
  body identity, boundaries and rate-limit response metadata.
- Fixture tree-shaking, an intentional429 incorrectly asserted console-clean, a replaced-context
  evaluation race and tsx `__name` serialization were harness failures. An unmigrated app run had
  24 navigations/18 fatal-console trials and is excluded. Migration, hydration and replay-payload
  collector limits were corrected before prepared measurements.
- Older trace-only 192/128 matrices retain console observations, but their primary receipt totals
  are superseded by operation-aware selection. A 24-trial partial run rejected an invalid provisional
  timing condition. A 120-trial partial run expired its old four-minute collector; neither is complete
  matrix evidence. Expiry and invalid conditions are now explicit.
- Build+probe calls hit host foreground limits/kills; phases were split. A migration command timed
  out. Failed/killed preparations are not counted as measurements.
- The unsharded server project hit 540s. Four shards cover 6809 tests; one account-security hook
  timeout passed all 21 tests in isolation. Unsharded UI hit 540s with load failures; four single-worker
  shards passed 6980 tests. Tooling had a boundary-scan timeout under load, passed alone, then the
  complete single-worker project passed 826 tests. No threshold or assertion was weakened.
- Ad-hoc no-undef first lacked environment globals; the explicit Node/browser check passed.
  Global /tmp inode exhaustion was observed; only this task’s logs were moved to private scratch.

Reference check: inspected TREK demo HTML and client dependency manifest exposed no comparable
Sentry solution. No implementation was copied; this limited inspection does not establish absence
from the whole reference product.

Final gate: typecheck and lint passed (inherited no-shadow warnings only); all three test projects
covered 14615 tests as detailed above. Generated-file check passed with no drift, and the ordinary
production build passed. Source-map uploads were disabled. Final targeted tests pass 9/9, explicit
Node/browser no-undef check passes, and staged diff whitespace checks pass. No runtime regression
is fixed: the diagnostic WebKit failures above are expected evidence, not a passing repair test.
