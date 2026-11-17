# Sentry navigation investigation - 2026-11-16

Issue: #1849. Baseline evidence below explains why the original memory-only candidates were
rejected. The issue was subsequently amended in Agent Brief comment6932022515 to permit bounded
transaction-only write-ahead recovery. That implementation and its new evidence are recorded in
**Amended implementation** below. Earlier partial verdicts remain historical, not current scope.

## Revisions and fidelity

- Current develop pinned at `c3d1504856683fb8848d51cdee796efd00fc7949`.
- Affected source pinned at `9ed0a446d2d5692e43fb6bdb1b0de65bca08c4fc`.
- Installed Sentry React/browser/core 10.72.0; Chromium 158.0.8127.18; Playwright WebKit 27.2; Playwright 1.65.0.
- The four production telemetry modules are byte-identical at both refs. Package/lockfiles differ.
- Native transport trials use the installed SDK; reduced fixtures reconstruct revision-owned initialization/router/privacy code against the current dependency graph and record both lockfile hashes. They are not exact historical application builds.
- The full current application was rebuilt from its matching lockfile, with real hydration and complete route tree. The affected complete application was not rebuilt against its historical dependency graph.
- Previous PR #1861 at `152086de1fa11cdcf11f1f5b9744641cdaf5ab45` is closed and unmerged. Its older measurements are historical, separate from all counts below.

## Native installed SDK transport

Each browser ran 120 trials: two owned origins, early/settled/provisional document replacement, ten body/concurrency profiles and two repetitions. All navigations completed; provisional sends are certified using this trial's replacement token and every page dispatch timestamp.
Envelopes join collector receipts by ID, serialized-byte SHA-256 and byte count. SDK buffer/backoff behavior is retained.

| Browser  | Trials | Attempts | Matched receipts | SDK 204 observed | SDK rejections | Fatal-console trials |
| -------- | -----: | -------: | ---------------: | ---------------: | -------------: | -------------------: |
| chromium |    120 |      132 |              108 |               72 |             24 |                    0 |
| webkit   |    120 |      132 |               92 |               56 |             56 |                   40 |

WebKit still fails oversized provisional sends even to the same origin. UTF-8 and overlapping keepalive bodies also exceed the native byte quota. Chromium's clean console does not imply every attempted envelope arrived. A receipt with no observed response is distinct from loss; all departed-document terminal diagnostics remain unknown.

## Real SDK initialization source matrix

| Source revision | Trials | Fatal-console trials | Sampled staging | Sampled production |
| --------------- | -----: | -------------------: | --------------: | -----------------: |
| `c3d15048`      |     64 |                    3 |              32 |                  4 |
| `9ed0a446`      |     64 |                    2 |              32 |                  6 |

128/128 source-fixture trials and 12/12 response/backoff/buffer controls completed. Fatal trials were sampled WebKit oversized provisional sends. Unsampled production transactions are explicit outcomes; random sampling counts are not failure incidence. Controls exercise real 204, exposed 429/backoff and 40-entry buffer overflow/drain. Intentional 429 console messages remain visible in their separate controls.

## Full current application

16/16 public `/` to `/pricing` navigations completed. Four WebKit document-navigation trials had SDK access-control page errors; Chromium had none. All four rejected automatic pageload IDs have no matching collector receipt. The selected small diagnostic transactions are separate events; their successful responses do not certify pageload delivery.

Client build: 616 JS assets; SHA-256 `659d832b6aebabedbd9d520b03f36622e7585ff678150c27083e947dc6a5d201`.

| Condition                 | Rejected pageload ID               | Matching receipt |
| ------------------------- | ---------------------------------- | ---------------- |
| WebKit early-document 1   | `fc19c5a659cf41e083a23cb2123ebb81` | none             |
| WebKit early-document 2   | `c83c7324876b4f2db66f36429644fa35` | none             |
| WebKit settled-document 1 | `7761e7c5746b4ed1a1be505499bc6d95` | none             |
| WebKit settled-document 2 | `aca05e89a686423f83521cc6ec3228bf` | none             |

## Isolated memory-only worker relay

The real SDK transport delegates requests through a message channel. The worker fetches the unchanged synthetic body and returns the real status and both rate-limit headers. There is no disk queue, native fallback, speculative retry or production registration.

| Browser  | Readiness               | Trials | Early receipts / envelopes | Settled receipts / envelopes | Provisional receipts / envelopes | Fatal trials |
| -------- | ----------------------- | -----: | -------------------------: | ---------------------------: | -------------------------------: | -----------: |
| chromium | ready before send       |     18 |                      8 / 8 |                        8 / 8 |                            8 / 8 |            0 |
| chromium | registration delayed 1s |     18 |                      0 / 8 |                        8 / 8 |                            0 / 8 |            0 |
| webkit   | ready before send       |     18 |                      8 / 8 |                        8 / 8 |                            8 / 8 |            0 |
| webkit   | registration delayed 1s |     18 |                      0 / 8 |                        8 / 8 |                            0 / 8 |            0 |

The ready control creates the SDK transport immediately, then waits for the worker before its first synthetic send. It does not certify a returning-user installation, worker termination or arbitrary cold startup. Delayed registration exposes the pre-readiness handoff gap: all 16 early/provisional envelopes per browser lack receipts despite a clean console. Page-side attempts in this candidate are relay submissions, not independently observed worker-native dispatches. A remaining console-free loss is a failed correction.

An earlier ready-control cohort awaited registration before transport construction: 18 trials per browser, 24/24 receipts. It was superseded by the immediate-transport-construction control above. No cohort is silently discarded. The failed delayed candidate makes production adoption unjustified; further worker-termination/installation modes are not attested.

## SharedWorker cold-source counterexample

The same real-SDK relay seam also uses `new SharedWorker()` with a MessagePort, avoiding an asynchronous registration dependency. A 1-second worker-source delay tests whether synchronously queuing a message alone guarantees a handoff. Each expected page-side submission is correlated before early navigation; provisional cases retain the dispatch-time certification.

| Browser  | Trials | Early receipts / envelopes | Settled receipts / envelopes | Provisional receipts / envelopes | Fatal trials |
| -------- | -----: | -------------------------: | ---------------------------: | -------------------------------: | -----------: |
| chromium |     18 |                      0 / 8 |                        8 / 8 |                            0 / 8 |            0 |
| webkit   |     18 |                      0 / 8 |                        8 / 8 |                            0 / 8 |            0 |

The SharedWorker also fails the cold-source window with clean console output. This is a counterexample to this candidate, not proof about every possible worker design or inline/blob startup. No SharedWorker option or production adoption is approved. An independent architect's separate 16-trial, non-SDK probe corroborates the delayed-source early failures; its provisional timers were not certified and are not merged into this real-SDK matrix. An initial CLI-mode validation failure occurred before browser startup and was corrected before this matrix.

## Inline/blob startup certification

Inline worker source removes the network download but does not make worker execution synchronous. The first `blob` cohort constructed its worker during module evaluation, before several Playwright round trips. It initially appeared successful. The `cold` cohort instead constructs its worker lazily at the first real SDK send; early navigation calls `send()` and `location.assign()` in the same JavaScript task with no readiness wait. The `blocked` cohort adds a bounded 1-second worker-execution delay independently of network loading. Provisional sends also construct the worker only after this trial's document request begins.

| Browser | Cohort | Trials | Early receipts / envelopes | Settled receipts / envelopes | Provisional receipts / envelopes | Fatal trials |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| chromium | blob | 18 | 8 / 8 | 8 / 8 | 8 / 8 | 0 |
| chromium | cold | 18 | 6 / 8 | 8 / 8 | 8 / 8 | 0 |
| chromium | blocked | 18 | 0 / 8 | 8 / 8 | 0 / 8 | 0 |
| webkit | blob | 18 | 8 / 8 | 8 / 8 | 8 / 8 | 0 |
| webkit | cold | 18 | 0 / 8 | 8 / 8 | 0 / 8 | 6 |
| webkit | blocked | 18 | 0 / 8 | 8 / 8 | 0 / 8 | 6 |

**The genuinely cold cases reject the blob adapter as a complete correction.** WebKit loses early/provisional bodies and reports access-control errors for blob worker startup during provisional navigation. Chromium also loses bodies when worker execution is delayed. The earlier preconstructed-worker success is retained as a control, not promoted into runtime acceptance. Page-side `attempt` metadata remains submission to the adapter rather than proof of worker dispatch. No production transport was changed.

## Failures and limits retained

- First native WebKit launch: zero trials because the pinned browser was missing; Chromium/WebKit installation then succeeded.
- Initial source matrix: 64 current-source trials and six controls, then historical lockfile mismatch. This is not a successful two-revision rebuild. The explicitly reconstructed source fixture is reported separately.
- One candidate edit initially failed parsing, and a new CLI mode initially failed validation before browser startup; both were corrected before their measured cohorts.
- Provisional-certification regression: test first failed because a late creation callback could certify an earlier dispatch; every expected dispatch is now checked.
- Relay malformed-response regression: test first failed because a non-status acknowledgement resolved; malformed messages now reject rather than claim ingestion success.
- No real Sentry ingestion, production frequency, customer impact, physical Safari, authenticated routes or exact historical full-build comparison was established.
- Synthetic loopback receipts and response metadata are the evidence. Bodies, credentials, traces, HARs and browser storage snapshots were never retained; the full-app snapshot was removed.

## Historical disposition before the scope amendment

The default transport has a reproducible lifecycle defect. The new relay succeeds only under sufficient startup/readiness headroom; genuinely cold inline-worker cases also fail. It is not a completed implementation of #1849. No runtime adoption is approved.

Independent security approves bounded diagnostic work only. The architect identifies synchronous write-ahead storage plus the relay as a possible next direction, requiring explicit byte/count/age limits, account/location scope and cleanup, real-response acknowledgement, backoff, duplicates/unknown outcomes and storage-failure semantics. The current client has no early server-derived delivery-scope generation, and large Replay persistence remains unsolved. A short logical expiry does not ensure physical deletion while the tab is suspended.

The independent product specialist confirms that payload retention is outside this brief and cannot be introduced as a transport-only fix. A ready spec or another diagnostic PR cannot stand in for runtime completion. Continue within the no-retention constraint or explicitly amend scope before designing persistent recovery; no reserved HUMAN-ONLY/security refusal is invented.

## Historical validation before runtime implementation

Every configured gate command was executed, with `pnpm test` split into its projects/shards under the repository policy. **The local gate is not green under Node 26.13.0 / ICU 79.1.**

- `pnpm typecheck`: passed.
- `pnpm lint`: passed, six inherited shadow warnings and no diagnostic warnings.
- Server projects/shards: 7,328 passed. Tooling: 776 passed, including 21 focused diagnostic interface tests.
- UI shards: 7,074 passed / 2 failed of 7,076 tests. The unchanged Vietnamese plural/parity tests fail because this host's ICU 79.1 adds category `one`; `git diff HEAD -- src/lib/i18n` is empty. Focused rerun reproduced the same failures independently.
- CI selects Node 24.x. The official Node 24.22.3 archive checksum was verified; both affected suites pass there, 183/183 tests. No translation catalogues or plural policy were changed to accommodate the host. This targeted rerun is not a complete Node-24 gate or native CI attestation.
- Generated routes/schema/spec index: current.
- Production build: passed on Node 24.22.3 with telemetry/source-map uploads disabled; all 200 server-function references resolve.
- Full-app diagnostic build/probe completed independently, retaining its failed delivery outcomes.

No commit, push, PR, native CI, passing runtime acceptance or QA approval is claimed. All changes remain staged under `scripts/sentry-navigation`.

## Lessons

A clean console is insufficient delivery evidence. Certify the same request's lifecycle ordering and join its actual serialized identity, digest and bytes. A ready-worker result cannot certify a first visit. Retention, unknown outcomes and scope cleanup are design contracts rather than transport flags.

## Amended implementation

The explicit amended Agent Brief permits bounded transaction recovery. The actual client now
uses synchronous session-storage admission before asynchronous worker startup, with a narrow
configured-DSN worker sender and recovery under matching fresh server-confirmed session/effective
workspace context. Auth mutation start/pending/finally fences, generation-fenced loader results,
workspace changes, cross-tab retirement, BFCache and sensitive locations prevent stale reactivation.
No Replay persistence, dependency, sampling, console-policy or CI change was introduced.

Bounds and response contracts are recorded in ADR0052, SPEC, DEPLOY and BACKWARD_COMPATIBILITY.
The English privacy template accurately describes masked Replay and diagnostic storage, without
claiming consent compliance or physical deletion during suspension. No new domain term is needed.

### Current real-SDK browser fixture

| Engine      | Lifecycle cases | Positive matching ID/body digest receipts | Correct scope/sensitive discards | Fatal lifecycle console | HTTP/backoff/buffer controls |
| ----------- | --------------: | ----------------------------------------: | -------------------------------: | ----------------------: | ---------------------------: |
| Chromium158 |           10/10 |                                       6/6 |                              4/4 |                       0 |                          5/5 |
| WebKit27.2  |           10/10 |                                       6/6 |                              4/4 |                       0 |                          5/5 |

Cold send+navigation share one JavaScript task. Provisional sends occur100ms into a replacement
request held600ms, with the departing-document flag verified. Worker asset response is delayed800ms.
Collector evidence matches the actual admitted/recovered event ID, UTF-8 byte count and SHA-256.
The five controls use the actual SDK transport and emitted worker:204,413,429/transaction backoff,
503 and40accepted/41stfiltered/subsequent drain. Automatic pageload is flushed before buffer
measurement. Intentional HTTP error console entries remain separate from clean lifecycle cases.

### Complete application

The staged-source snapshot builds the full route tree and actual React hydration.16/16 public
navigations across Chromium/WebKit, SPA/document and early/settled timings complete with0fatal
console trials. All16selected diagnostic transaction IDs and all12observed automatic pageload
IDs have collector receipts, including every observed WebKit document-navigation pageload.
Departed-document SDK response visibility remains unknown in some cases; receipt is not confused
with page acknowledgement. Three original-page diagnostics report network_error while the same
ID reaches the collector through recovery, an explicit unknown-outcome case rather than loss.
Source hashes are retained with the snapshot metadata; subsequent changes to auth/client.ts only
restore unrelated existing formatting, and additional tests/docs do not alter emitted runtime logic.

### Independent review and additional QA

Fresh security/tenancy implementation review:APPROVE, high confidence, ESCALATE:no. The reviewer
independently ran34module tests after verifying all reported cancellation/reactivation/header
regressions were fixed. Further boundary/lifecycle tests bring focused coverage to38/38.
Locale/scope65/65pass. Worker-vs-browser formatter parity passes in Chromium and WebKit; public
Chromium journey and four browser assertions of the rendered privacy template pass with clean
console. A screenshot and concise QA metadata are published as cockpit assets.

Final configured gate results are recorded in the task handoff and delivery report. No commit,
push, PR, native CI, deployment or issue closure occurs in implementation step1.

### Final local validation disposition

**Implementation complete; full validation blocked by unchanged harness infrastructure.** On
verified CI-major Node24.22.3: typecheck, lint (six inherited warnings), generated freshness and
production build pass. Full server7331/7331 and UI7114/7114 pass. Tooling775/776pass; the one
failure is `scripts/ci/__tests__/validation.test.mjs` concurrent-temp cleanup. The timeout path's
SIGKILL during `phase:close` returns EPERM, so the helper correctly refuses to certify termination
and returns infrastructure1 instead of expected timeout124. Isolated Node24 and Node26 runs
reproduce17/18pass with that same failure. `scripts/ci` and `scripts/sentry-triage` are byte-unchanged
against the base. Earlier overload timeouts, optional-scope test expectation and ambient-DSN
fixture determinism were resolved and their relevant reruns pass. The old Node26 Vietnamese
plural failures are absent from the full Node24 UI run.

Independent architect and configuration guardian both require a separate harness investigation,
with no change treating EPERM as ESRCH, no weakened assertion, no bypass and no green-gate
attestation. The evidence does not prove the process group terminated. Native CI is still required
and has not run. Current implementation output is `Status: blocked` solely for full validation;
there is no security refusal, HUMAN-ONLY decision, new issue hold or claim transfer.

All diagnostic snapshots were cleaned through their owning helper, the owned development server
was stopped, and no run-owned browser/probe/test/build process remained at the final process
check. Changes remain staged, without commit, push, PR, deploy or issue closure.
