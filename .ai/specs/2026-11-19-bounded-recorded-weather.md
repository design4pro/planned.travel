# Bounded recorded weather and independent forecasts

| Field              | Value |
| ------------------ | ----- |
| **Status**         | ready |
| **Issue**          | #1193 |
| **Spec PR**        | none  |
| **Implementation** | none  |

## Problem and scope

A traveller opening a mixed trip can wait for NASA POWER before reading today's MET Norway forecast. A traveller opening a long past trip can trigger one shared-cache read per recorded date and an arbitrarily wide NASA daily request for a cell. On a finished trip, the 12-location limit can exclude days before the server even groups their locations into recorded-weather cells.

At the design baseline, `loadTripWeather` checks trip access before constructing `WeatherRuntime`. `resolveTripWeather` selects four-decimal location keys before grouping recorded dates, `fetchRecorded` spans the earliest and latest misses in a cell, and `useTripWeather` receives one response for all kinds. The [per-day weather spec](2026-09-19-per-day-weather.md) describes these choices in its Amendment.

Deliver today's forecast independently and make recorded work finite per request and per initial view. Each further batch requires demand from the traveller. This spec uses the existing [day-row mockup](assets/per-day-weather/mockup-01-day-rows.html) for badge placement and adds a single continuation control to the existing recorded-day surface. Provider choice and attribution follow [ADR 0038](../../docs/adr/0038-met-norway-and-nasa-power-for-weather.md). Allowance amounts, trip visibility, badge styling and recorded opt-in are outside scope. This PR delivers the design. Runtime slices need their own risk assessment and fresh approvals where required.

## Delivery and priority

1. Open a weather view after the planner paints. The first response resolves MET forecasts with the existing forecast eligibility, grouping, cache freshness and location limit. It makes zero NASA calls and completes independently of both NASA paths. A successful forecast renders as soon as that response arrives. It remains visible while other kinds load.
2. If estimates are enabled and eligible, start the estimate phase after forecast admission has settled. Apply estimates to estimate days and to forecast candidates that require fallback under the existing rules. A forecast that arrived successfully wins over any late estimate. An estimate-only trip takes the same sequence with an empty forecast phase.
3. If recorded weather is enabled, load at most one initial recorded batch after higher-priority admission has settled. A finished trip can skip provider work for both earlier phases. The board shows pending for eligible recorded days outside completed batches. Expose one accessible, localized control to load the next batch, while a continuation exists. Keep completed badges visible even if a later batch fails. An idle view does no further recorded work. A click starts at most one batch, with a single request in flight for that view. Repeated clicks during the same request do not start more batches. Keep focus on the control while it remains actionable. On exhaustion, announce completion and move focus to the recorded section if the control is removed while focused. Badge names, loading and continuation messages follow the 23-locale catalogue.

Order provider admission within each authorized view as forecast, estimate, then recorded. A response deadline can first return settled results, but cannot issue proof for the next phase before the current phase's admission is settled. If the deadline arrives before admission has settled, close that phase to further admissions before handing off. Work already admitted may complete using the existing request lifetime mechanism. The browser does not have to wait for a NASA provider to paint forecasts. Priority applies within a view. Concurrent independent views share the existing best-effort allowance and have no cross-view priority guarantee.

## Recorded batching

A cell is the existing NASA coordinate rounded to one decimal, including the existing zero normalization. Classify dates using the trip's effective clock and the existing provider first date and publication lag. Group eligible recorded days by cell before any cap. Deduplicate (cell, date) pairs and retain a mapping back to every trip day ID. Each pair is processed once per traversal. Compute sun times per original day and location under the existing zone rules.

Order cells by their first eligible trip day in stable calendar and day-ID order, breaking ties by canonical cell key. Within each cell, order distinct dates ascending. Starting at the first unassigned date, form a window with requested dates falling through that date plus 31 calendar days inclusive. Process these windows in order. Pack up to four windows and 32 pairs into a batch, taking a prefix of a window if it reaches the pair budget and continuing at the first unprocessed pair. The batch boundary depends on authorized input and the budget, regardless of whether the cache is warm. Form a NASA request only for a window with misses, between the earliest and latest missing _requested_ dates in the admitted window. Dates in gaps may be returned by NASA. Read, write and render only requested pairs.

| Recorded work                                            | Maximum | Accounting                                                                           |
| -------------------------------------------------------- | ------: | ------------------------------------------------------------------------------------ |
| Inclusive calendar days per NASA daily call              |      32 | UTC-independent calendar-date arithmetic across month, year and leap-day boundaries  |
| Distinct cells per batch                                 |       4 | Multiple locations in the same cell use one cell slot                                |
| Windows per batch                                        |       4 | Sparse dates in a single cell can use more than one window                           |
| Unique cell-date pairs per batch                         |      32 | Deduplicated before any weather-cache IO                                             |
| Weather-cache reads per batch                            |      36 | At most 32 day reads and one daily failure-marker read per admitted cell with a miss |
| Weather-cache writes per batch                           |      36 | At most 32 requested cold days and one failure marker per admitted cell              |
| NASA daily call attempts per batch                       |       4 | One per cold admitted window, no inline retries                                      |
| Concurrent cache operations and daily attempts per batch |       4 | Shared limit across both, including same-cell windows                                |
| Recorded batches on open or per subsequent load action   |       1 | No background drain or periodic polling                                              |

Deduplicate failure-marker reads and writes within a batch. Dispatch every granted window once. Settle each window independently, then coalesce any daily failure-marker writes for the cell. The marker suppresses misses in later batches while it lives. A warm batch reads only its admitted day keys, makes zero NASA calls, writes nothing and spends zero units. Empty cached days remain unavailable for the existing one-hour retention. A missed day that skips admission because an applicable failure marker exists or the allowance is exhausted remains unavailable for that view. Unadmitted dates beyond the batch remain pending until their batch. Neither a spent allowance nor an operator block suppresses valid cache hits.

On 101 contiguous dates in one cell, a cold traversal completes in four successful calls of 32, 32, 32 and 5 days over four batches. On 13 one-day cells, a cold traversal completes over four batches of 4, 4, 4 and 1 cell. After the first response in either example, eligible unprocessed days remain pending. Continued demand makes progress even when each new batch is warm or some cells fail. Provider success, returned data and sufficient allowance yield a reading for every eligible day.

## Access, continuation and metering

- Each request validates its phase and continuation with Zod, then obtains current app scope and checks trip readability before reading day locations, subscription, shared weather cache or provider services. Reuse the existing not-found behavior for private, foreign and newly inaccessible trips. Derive coordinates, dates, workspace allowance and effective trip zone server-side.
- An authenticated, opaque, purpose-bound continuation identifies the next phase or batch. It expires ten minutes after issue, carries no readable IDs or coordinates, and binds to the current reader and workspace, trip, view generation, recorded and estimate opt-ins, effective zone and date window, and a fingerprint of ordered day IDs, dates and locations. Keep continuation data out of logs, cache keys and provider inputs. Validate binding and expiry before weather work. An invalid or stale continuation starts no provider work. Offer an explicit refresh from the first phase and ignore responses from superseded generations. A token never substitutes for fresh trip authorization.
- Return partial results keyed by day ID. Supply results for the admitted portion with its continuation, including after a provider timeout, and carry forward already delivered results. A skipped date before the supported provider start is `none`, a date within the publication lag is `not-yet-recorded`, and an eligible date awaiting a later batch is pending. A processed date for which a reading could not be obtained is `unavailable`. A transport failure leaves the affected batch retryable by explicit action. After refresh, recompute the plan instead of applying stale positions to edited days.
- Keep the existing public per-day cache keys and retention. Recorded values keep 24 hours for recent dates under 90 days and 30 days for settled dates. Empty values keep one hour and daily failure markers five minutes. Existing forecast and climatology cache rules and their separate failure kinds carry forward. Store no trip or workspace identifiers in weather-cache data. Vendor requests still carry only the rounded coordinates and required date window, with existing provider headers and attribution.
- Count each outbound attempt once in the workspace allowance and provider ledger, including an actual request that fails or times out. Cache hits, cached failures, deferred windows and operator-blocked calls spend zero workspace units. Preserve the ledger's distinct blocked-demand accounting. Coordinate operator gating with the ordered grant so the grant is for dispatchable attempts. Use the existing bulk workspace accounting discipline or an independently reviewed equivalent with the same semantics. Parallel per-call writes to the same KV rate-counter key are unsafe. Weather-cache limits in the table cover weather KV operations. Account separately for the workspace counter transaction and provider ledger operations in acceptance evidence.
- During rollout, keep the old `loadTripWeather` input fields, opt-ins, day array and status vocabulary for old tabs. That endpoint may wait for all requested kinds and uses the same limits for a single recorded batch. It retains the existing unavailable fallback for past days the single response cannot cover. The staged consumer uses the new continuation contract and never treats a batch-cap deferral as unavailable. Verify legacy input without opt-ins still returns `none` for past days. Remove legacy behavior only after the server-function compatibility window and in a separately reviewed change.

## Reconciliation with per-day weather

- Amendment 24's single grant and unlimited cold-date span give way to ordered admission and bounded windows. A cache hit still spends zero. Amendment 39's priority remains forecast, estimate, then recorded, within a single view.
- Amendment 27's provider first-date filtering happens before batching. Amendment 29's lag and known publication uncertainty remain applicable. This change relies on the installed adapter's existing eligibility contract and introduces no new vendor assumptions.
- Amendment 28's 12-location limit governs forecast and estimate selection as before. Recorded weather plans separately by one-decimal cell and continues over subsequent batches. The historical cap behavior remains documented in the original spec. Its implementation successor is specified here.
- Existing sun-time, weather-kind, attribution and privacy rules apply. The new pending state is a delivery status for a recorded reading.

## Implementation slices and verification

### 1. Deliver forecasts independently

Ship the staged weather reader and consumer through forecast and estimate. Retain legacy callers and a separate recorded path so current opted-in past days continue to work through the existing presentation, bounded to the compatibility batch while slice 2 is prepared. This slice owns the phase order, continuation validation, legacy adapter and metering contract. It also owns the bounded compatibility batch implementation reused by slice 2. Demonstrate today's forecast alongside still-loading past and estimate days on a mixed trip.

- At the reader and `useTripWeather` seams, keep controllable daily and climatology promises unresolved. Assert that a successful MET forecast exits loading and renders before either NASA promise resolves or the clock reaches its timeout. Assert that later NASA failure or a stale response cannot overwrite it.
- At `WeatherRuntime`, test cache-before-grant, separate blocked-demand accounting, actual attempted calls and priority at ceilings of zero, one and two. Include mixed cold and warm inputs and provider timeouts. Prove a delayed grant cannot enable a lower-priority spend before higher-priority admission closes.
- At the reader seam, test private, foreign, revoked and invalid continuation cases with zero weather-cache/provider/counter operations. Prove old requests with and without opt-ins still decode and receive the expected status union. Verify the compatibility batch has the same numeric limits as the new path.

### 2. Continue recorded weather on demand

Depends on slice 1. Connect the bounded recorded batches to the day list and advance through authorized continuations. Render deferred, unpublished and unavailable as distinct states. Add localized loading and completion behavior to the existing day rows and continuation control.

- At the weather module boundary, use fake external providers and a recording cache implementing `WeatherRuntime`. Assert the exact spans and batch sizes for 101 contiguous cold days, then seed them and assert zero writes, calls and spend, with no more than 32 day reads per batch. Include sparse dates crossing month/year bounds, mixed warm and cold windows, actual daily failures, failure-marker reuse, empty provider dates and all published-date filters. Count reads, writes, attempts and in-flight operations, including through errors and deadline paths.
- Place 13 stays in distinct cells and verify all eligible days get readings with enough allowance. Include distinct hotel locations and dates sharing a cell and assert they consume one cell slot. At the weather module interface, inject two queries for the same cell and date and assert one pair is read and both queries receive the outcome. Under exhausted allowance, assert warm and empty entries retain their status, processed misses are unavailable with zero provider attempts, and later batches remain pending until requested.
- At the reader and consumer boundaries, prove repeated clicks start one request, previous results survive a partial batch failure, stale generations cannot write over an edited trip, completion removes the continuation, and the initial view never drains later batches. Verify the control with keyboard and screen reader, and use the existing browser journey for mixed, finished and lagged trip days.

## Open questions

No blocking questions remain. Limits are application policy and can be tuned under the same acceptance scenarios.

## Resolved assumptions

| #   | Question                                                 | Applied default                                                                                                                 | Why                                                                                                                                                                                                  |
| --- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | What should issue #1193 deliver?                         | One ready design with implementation slices.                                                                                    | Product-owner specialist at triage, high confidence. Bounds, eventual coverage and independent delivery require a single contract.                                                                   |
| 2   | How should work be bounded and delivered?                | Admit forecast, estimate and recorded in order. Use demand-driven recorded batches with 32 days per call and the budgets above. | Software architect, high confidence. Independent phases release forecast rendering and deterministic cell-date pages limit both warm and cold work.                                                  |
| 3   | What protects access and allowance with multiple phases? | Reauthorize every phase, bind continuation to the approved view, and meter actual attempts after gating.                        | Security and tenancy specialist, high confidence. Conditions include zero work for denied requests, unchanged shared-cache privacy, bounded compatibility and fresh risk review for runtime tickets. |
