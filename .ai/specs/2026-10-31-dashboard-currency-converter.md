# Dashboard currency converter with metered public rates

| Field              | Value |
| ------------------ | ----- |
| **Status**         | ready |
| **Issue**          | #1317 |
| **Spec PR**        | none  |
| **Implementation** | none  |

## TLDR

A traveller will convert an amount in the dashboard's desktop widget column or mobile sheet,
using dated public reference rates. A new public-only rate read will share the existing provider
meter and KV binding, without looking up private frozen rates or changing saved money.
This PR delivers the design only. A person merges it before `afk-to-tickets` creates the complete
implementation slice below; it must reference #1317 without closing it.

## Problem and scope

The #1317 visual brief (`wiki: Dashboard-Widgets`) asks for amount, source/target selectors,
result, swap, refresh and unit rate. `src/lib/clock-zones.ts` currently registers clock, bookings,
trip mix and storage, but no converter. The column and mobile sheet already share one widget set.
No reference source, strings or assets are used by this design.

The next implementation will deliver one complete dashboard converter with operator visibility.
Out of scope: display-currency activation elsewhere, re-basing, budget entry/payment writes,
frozen-rate changes, settlement, charts, paid subscriptions, account creation, production
configuration, new dependencies and redesigning other widgets. A reference estimate is not a
transaction quote or a rate to save onto a budget entry.

## Verified premises and ownership

- `src/server/repos/rates.ts` owns `RateSource`, `resolveRate`, private frozen-rate queries and
  display rates. `resolveRate` checks manual, then readable private frozen rates, then an injected
  source. Calling it for this widget would mix private observations into a public feature.
  The widget must never call it. No `RateSource` is injected into existing consumers here.
- `src/lib/money.ts` owns `parseMoney`, `convertMinor`, minor-unit digits and money/rate formatting.
  `convertMinor` uses major-per-major direction, scales for both currencies, rounds half away from
  zero once and refuses unsafe integers. Keep it unchanged unless a separately demonstrated bug
  needs correction. `src/lib/currency-list.ts` supplies favourites/runtime currencies, not a closed
  list of 32 codes; its ordering and the existing localised currency names are reusable.
- `src/server/metering/outbound.ts` owns every actual attempt through `callProvider`.
  `src/server/db/schema.ts` owns `METERED_PROVIDERS`; types derive from it. Registry/configuration,
  usage and console remain owned by `catalog/provider-usage.ts`, `fns/console/providers.ts` and
  `routes/_app/console/-server/providers.ts`. Policies are `allow` and `block`, with warning/critical
  percentages, not a new `warn` policy.
- Plan `04-S7` proposes a public cache behind `RateSource`, then automatically enables display
  consumers. This design adopts the public source/cache ownership idea, but deliberately does not
  activate that stage or claim its reference rows. Its proposed per-pair/day physical cache and
  workspace-plan allowance are not requirements for this widget: one public daily snapshot serves
  every pair, and operator provider metering is distinct from workspace billing. Future `04-S7`
  work may adapt this public module to `RateSource` without duplicating its cache or changing the
  private precedence rules. Plans `01-S5` and `11-S3` remain historical context, not proof of shipment.

The implementation owner is one new module, `src/server/rates/public-rates.ts`, owning the snapshot,
cache, freshness and refresh policy through an injected runtime (fetch, KV, clock, outbound runtime).
A provider-specific adapter `src/server/rates/frankfurter.ts` owns wire validation and the fixed URL.
This follows the existing weather adapter/policy separation; no generic provider framework is added.
`src/server/fns/public-rates.ts` owns the new authenticated function and binding composition.
`src/routes/_app/-ui/currency-converter.tsx` owns the product UI; `components/ui` stays data-free.
Client amount/pair conversion composes existing money helpers inside that widget, with a route-local
pure helper only if needed to test input/error behaviour. No SQL, table or migration is needed for
public rates; existing platform catalogue SQL stays in its current owner.

## Provider decision and primary evidence

**Choose Frankfurter v2, restricted to its ECB provider route**, with no blended-feed fallback:
`https://api.frankfurter.dev/v2/providers/ecb/rates?base=EUR`.
One server request fetches all supported quotations for one effective date. No key, account,
paid subscription or new binding is required. A provider change requires a new rights review and
cache namespace, not a tenant-provided URL or credential.

Primary documentation and live responses were fetched on **2026-10-31**:

| Evidence                                                                                                                                                       | Verified fact and design consequence                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Frankfurter API documentation](https://frankfurter.dev/)                                                                                                      | Provider-specific routes return JSON; no API key; no daily/monthly quotas, but abuse rate limiting with no guaranteed numeric throughput. Cache instead of treating “no quota” as unlimited capacity. Local storage is explicitly encouraged.                                                                                                                                                                                                                                            |
| [Frankfurter license and data terms](https://frankfurter.dev/license/)                                                                                         | MIT covers software/docs, not a blanket grant over all underlying data. Provider terms apply. Selecting ECB narrows the rights and provenance review to one institution. API/data are supplied without warranty.                                                                                                                                                                                                                                                                         |
| [ECB copyright and disclaimer](https://www.ecb.europa.eu/services/using-our-site/disclaimer/html/index.en.html)                                                | Free reuse of information with accurate reproduction and ECB source citation; disclose calculations/modifications. For incorporation in sold documents, tell buyers before subscription/payment and on each access that the information is freely available from ECB. No commercial-use exclusion or cache/retention duration is stated for these reference figures. Retaining a daily snapshot is reproduction under those conditions, not an inferred right from the software license. |
| [ECB euro reference rates](https://www.ecb.europa.eu/stats/policy_and_exchange_rates/euro_reference_exchange_rates/html/index.en.html)                         | Publication normally around 16:00 CET on working days other than TARGET closing days; information purposes, not transaction execution. Do not promise intraday updates or a new observation every calendar day.                                                                                                                                                                                                                                                                          |
| [Live ECB JSON feed](https://api.frankfurter.dev/v2/providers/ecb/rates?base=EUR)                                                                              | The sample had 30 rows, including EUR identity, all dated 2026-10-30: EUR/EUR 1, EUR/USD 1.1172, EUR/JPY 175.68, EUR/GBP 0.8338. These are sample observations, never application defaults or an expected current price.                                                                                                                                                                                                                                                                 |
| [KV consistency](https://developers.cloudflare.com/kv/concepts/how-kv-works/) and [KV writes](https://developers.cloudflare.com/kv/api/write-key-value-pairs/) | KV is eventually consistent; updates may take 60 seconds or more to appear elsewhere. It is not a distributed lock. Same-key writes have a one-write-per-second limit; expiration TTL has a 60-second minimum. The five-minute attempt marker is advisory, not a hard global throttle.                                                                                                                                                                                                   |

Initial supported codes from that snapshot are AUD, BRL, CAD, CHF, CNY, CZK, DKK, EUR, GBP, HKD,
HUF, IDR, ILS, INR, ISK, JPY, KRW, MXN, MYR, NOK, NZD, PHP, PLN, RON, SEK, SGD, THB, TRY, USD,
ZAR. Keep the reviewed code allowlist in the adapter, filtering current valid snapshot coverage.
Use `currency-list.ts` ordering and localised names, intersected with this coverage. Do not silently
substitute a different currency. An old selected code absent from a newer snapshot stays visible
with an unsupported-pair state. New provider codes require review before being offered.

**Attribution is part of delivery**, not a follow-up: every non-identity result shows “ECB reference
rates via Frankfurter”, effective date, a freely available ECB-source link and a notice that the
result is calculated for information. Link ECB in its own full browser page, with no framed embed;
use no institution logo or suggestion of endorsement. On `/pricing` and the checkout review before
any subscription/payment, add a localised disclosure that these ECB rates are free at the source.
Apply it to every existing paid entry path, including console checkout entry points; it does not
change price, consent or billing. This conservatively satisfies the sold-document condition even
though this feature is an interactive planner. A fresh account must see it before paying, and an
existing subscriber on every widget access. Rate observations may be cached, but retain them only
for the bounded fallback below, not as a new historical archive.

Alternatives rejected: the blended API has broader coverage but draws on many institutions with
separate terms; direct ECB XML adds parsing work for no user benefit when the reviewed JSON route
already provides the same source. No automatic secondary provider, self-hosted infrastructure or
paid fallback is introduced.

## Public snapshot, cache and authenticated interface

A snapshot is version 1, provider `frankfurter-ecb`, source `ECB`, `base: EUR`, an ISO calendar
`effectiveOn`, server `fetchedAt`, and an allowlisted map of currency codes to finite positive
major-per-EUR rates. EUR must equal 1. Validate both network and KV values with Zod; require one
base/date across all rows, unique codes, a real nonfuture date, nonempty coverage including EUR,
and a bounded payload (64 rows, 64 KiB decoded body). Reject duplicate, mixed-date, zero, negative,
NaN, infinite, malformed and out-of-range rates (use the existing `MIN_EXCHANGE_RATE` and
`MAX_EXCHANGE_RATE` bounds). Ignore additive wire fields, not invalid known fields. An invalid
response is a provider error and never overwrites a good snapshot. Ignore unreviewed codes.
The response-size limit must bound bytes read, not only check after buffering an unbounded body.
Reject redirects so the fixed trusted host cannot be turned into another outbound destination.

Physical KV keys are `fx:public:frankfurter-ecb:v1:latest` and
`fx:public:frankfurter-ecb:v1:attempt`. Neither contains workspace/user/trip IDs, amounts or private
rates. The snapshot records only public observations/provenance; the attempt marker holds only an
attempt timestamp and retry time. This canonical source/date snapshot prevents each pair from
creating a separate upstream request. There is no tenant content in this global cache.

New `getPublicRatesFn` uses `createServerFn` POST and a strict Zod input `{ refresh?: boolean }`,
default false. It takes no workspace, member, trip, amount, provider URL or date from the client.
Call `appScope()` and the current membership guard before reading even a warm cache; attribute a
miss to `scope.ctx.organizationId` only. Anonymous, removed-member and stale-workspace sessions
are refused through the existing auth error path. The function calls the public module directly,
not another server function, and never a frozen-rate repo. Bindings are composed in the server-only
handler; the policy and adapter are importable by Node tests through injected interfaces.

Return a discriminated result:

- `available`: snapshot, `freshness: fresh | stale`, `reason` (null or provider-failed,
  provider-blocked, throttled, cache-unavailable, old-observation), `checkedAt` and `retryAt` when
  a refresh is temporarily unavailable. Public metadata only, no operator counters or tenant IDs.
- `unavailable`: reason (provider-failed, provider-blocked, throttled, cache-unavailable or
  expired), `retryAt` where known and no rates. No partial malformed snapshot or invented 1:1.

Authentication failures remain auth failures, not these availability values. The client handles
its own invalid-amount and unsupported-pair states without calling the server. This is a new
function, not a change to old input/output contracts; later fields must be optional/additive.

### Freshness and attempts

1. A valid snapshot checked less than one hour ago is a cache hit. It is fresh only while its
   effective date is at most four calendar days old in UTC; an older eligible snapshot is visibly
   stale even immediately after a successful fetch. Dates aged over seven calendar days are never
   used for conversion. At UTC midnight, date-age decisions change independently of fetch time.
2. After one hour, a visible widget may request revalidation. Manual refresh bypasses the hour,
   but neither bypasses the five-minute shared attempt cooldown. Both read the good snapshot
   before considering an attempt. Same-currency identity performs no rate request or meter check.
3. Record an attempt marker before starting upstream, including failed or blocked attempts, with
   a five-minute expiration (300 seconds). Do not rewrite it on hits or suppressed refreshes.
   An isolate-local single-flight promise coalesces concurrent starts; waiters share the result.
   Clear it on success and failure. Cross-isolate KV races may still produce duplicate requests.
4. If KV read or attempt-marker write fails, do not start upstream from that request. Return the
   last validated isolate-held snapshot if still eligible, labelled stale/cache-unavailable,
   otherwise unavailable. This prevents a cache outage becoming unlimited requests. If a snapshot
   write fails after a successful metered fetch, return that validated value to this caller and
   keep it in bounded isolate memory; keep the attempt cooldown, and never claim durable caching.
5. Fresh hits do not consult the provider gate. A stale snapshot remains usable through seven
   days if a fetch fails, is blocked or is cooling down, with the specific reason visible.
   A successful response with the same effective date updates fetched/check time but never resets
   observation age. An older response must not replace a newer snapshot the same isolate knows;
   cross-isolate write order is eventually consistent, so every reader revalidates date/age.
   Persist snapshots with seven-day storage TTL; usability is still checked by effective date.
6. One request has a 5-second timeout. No automatic retry is shipped initially. A timeout, 429,
   non-2xx, malformed JSON or rejected payload is an error; no failed response is cached as a rate.
   Honour a valid Retry-After (seconds or HTTP-date), bounded to 24 hours, by extending the attempt
   marker's retry time/TTL. Save that deadline immediately in isolate memory and return it to
   the client. Schedule the KV extension through supervised `waitUntil`, no earlier than one second
   after the initial marker write, respecting KV's same-key write limit. If the extension fails,
   retain the local deadline; other isolates may see only the shorter marker or no extension, a
   documented best-effort limit. Without Retry-After, use five minutes. A future retry implementation
   must meter each individual attempt, not the whole retry loop. Provider-blocked is not retried.
7. Automatic reads occur only when mounted/visible and needed, on becoming visible or returning
   to the tab after the hour. No per-keystroke or tight background poll. Unmounting a widget does
   not corrupt a shared in-flight result; an old response must not replace a newer UI generation.

No guarantee of one global request or an absolute ceiling is claimed. KV propagation/cache misses,
write races and isolate-local single-flight permit some duplicate demand. They remain observable
through the existing meter. A future requirement for strict serialization would need a separately
reviewed Durable Object design; this feature does not introduce one.

## Provider meter and operator policy

Add `frankfurter` to `METERED_PROVIDERS` when the adapter ships; the feed identity remains
`frankfurter-ecb` in provenance/cache. Audit all derived provider enums, console labels, fixtures and
call-graph assertions; do not hardcode a second provider list. Current registry slug is free text,
so adding this runtime vocabulary requires no schema migration.

Every actual network attempt uses `callProvider(runtime, { provider: 'frankfurter',
operation: 'rates.latest', organizationId: serverDerivedWorkspace }, attempt)`.
Validate status, JSON and rate payload **inside** the metered attempt; throw validation errors
there, so a malformed 200 is counted as an error as well as a call. A non-2xx is counted once,
not again in a wrapper. Retries/refresh are separate attempts. No unmetered metadata/health fetch,
no automatic redirect and no browser-to-provider request is allowed.

The initiating workspace receives attribution for the shared miss; cache readers and single-flight
waiters receive no new usage, and no private attribution is saved in the snapshot. Two racing
isolates each attribute their actual attempt to their own initiating workspace. No workspace
allowance is decremented, and `resolveLimits` gains no currency metric. Operator configuration
uses existing `provider:configure`, the catalogue and audit path; provider usage remains guarded by
`provider:read`. Normal travellers never set policy or read other workspaces' usage.

Keep the existing default of no agreed ceiling (`callLimit: null`, `policy: allow`); do not invent
an allowance the free provider does not publish. An operator may choose day/month limit, allow
with warning/critical percentages, or block. Cache hits still work at an exhausted ceiling.
A blocked attempted miss/refresh records blocked demand with zero upstream calls; the widget shows
stale-with-blocked or unavailable-with-blocked. Console tests must show calls, errors and blocked
demand separately, including initiating workspace attribution.

`callProvider` currently fails open on gate read faults, records asynchronously with `waitUntil`,
swallows recording failures and memoises registry configuration for 60 seconds per isolate.
Parallel checks can overshoot a ceiling before recorded usage is visible. Preserve and document
that behaviour; a configured block is a best-effort operational ceiling, not a contractual hard cap.
This cache's conservative failure rule does not silently change the shared meter for other vendors.

## Amount, conversion and display contract

Initial state is **1 EUR to USD**. Amount and pair live only in the current dashboard/widget
session; no new durable record or URL parameter. Swapping exchanges codes and keeps the typed
source amount; it recalculates rather than rounding the result back into the input.

- Reuse the existing locale-aware `parseMoney` and currency minor-unit table. Accept zero through
  1,000,000,000 source major units inclusive, text length at most 64. Blank, negative, malformed,
  nonfinite, exponent notation and unsafe input are invalid. The current parser rounds surplus
  fraction digits half-up into source minor units; keep that contract and normalise the input on
  blur, rather than silently using unrounded fractions. Changing source currency reparses the
  current text under that currency's precision.
- Cross rate is `rates[to] / rates[from]`, where entries are major units per EUR. Convert using
  `convertMinor(sourceMinor, crossRate, from, to)` and catch its refused/overflow result as invalid
  amount. Require a finite positive bounded cross rate as well as valid individual entries.
  Never multiply by the inverse or assume every currency has two decimal digits.
- Format using existing locale-aware money and exchange-rate helpers, with an explicit ISO code
  beside ambiguous symbols. The unit line is `1 {from} = {rate} {to}`; its displayed precision never
  becomes the computational rate. Results are rounded to target minor units once. Source parsing
  and target conversion are the two distinct existing money boundaries.
- If both codes are the same valid currency, identity uses rate 1 and returns parsed minor units
  unchanged, without network, cache, provenance claim or provider warning. Rate-independent
  identity works even when that valid currency is outside provider coverage. For distinct codes,
  absent quotation means unsupported, never identity or a private-rate fallback.

Deterministic fake examples: with EUR/USD 1.25 and EUR/JPY 150, 100 EUR is 125 USD; 100 USD is
80 EUR; 100 USD is 12,000 JPY. EUR 0.01 at USD rate 1.5 becomes USD 0.02 under half-up rounding.
Test zero, JPY zero digits, a three-digit currency at the money seam, and a converted result beyond
safe integer range. These are test vectors, not market-rate promises.

## UI/UX

Add widget ID `currency` and its label to the canonical registry/menu. Newly absent preferences
use the new default set including it. An existing valid `shown` record is preserved exactly,
including `shown: []`; never append the new widget during parse/migration. Keep `zones` unchanged.
Users with a saved record opt in through the existing menu. No storage-key rename or preference
reset. Hiding all widgets still collapses the column and leaves the header menu usable.

Render one product component in the existing desktop column and mobile sheet, using house input,
select/combobox, button, card and status primitives. Keep the amount and pair in their shared
route owner so changing responsive presentation does not reset an in-progress conversion.
Mount only one active requester; opening the mobile sheet triggers its first cross-rate read.
The skeleton reserves the final result/status footprint; no collapse when a request settles.

Order: title, amount, source selector, swap, target selector, read-only result, unit line,
effective date/source, informational/free-source notice and refresh. Maintain visible labels for
both selectors; code/name search uses existing localised currency names. Swap and refresh have
localised accessible names. Use tabular numerals, ISO-code isolation and logical spacing for RTL.
At narrow widths controls wrap without horizontal scrolling; long translations and large figures
wrap within the card. No drag or hover-only affordance.

| State                      | Visible behaviour and next action                                                                                                        |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Loading with no snapshot   | Reserved result skeleton and polite loading status; amount/selectors remain editable.                                                    |
| Ready                      | Converted amount, unit line, effective date and source/free-source notice. Editing amount uses the held snapshot only.                   |
| Same currency              | Identity result and unit line; no misleading ECB date/source.                                                                            |
| Invalid amount             | Localised inline error connected by `aria-describedby`, `aria-invalid`; no numeric result, no server read caused by typing.              |
| Unsupported pair           | Keep selected codes visible; show unavailable result and explain the pair. Offer supported selections.                                   |
| Provider failure / offline | No invented number. Keep eligible old result only with stale/error wording; refresh becomes available after retry time.                  |
| Stale                      | Keep eligible value, effective date and explicit stale reason; refresh subject to cooldown. More than seven days old removes the number. |
| Exhausted block ceiling    | Explain rate service limit; eligible cache stays visible with its date. No paid-upgrade suggestion.                                      |
| Refresh cooling down       | Keep result and explain when another request is allowed; no upstream attempt.                                                            |

Use a polite live region for settled results/status, without announcing every keystroke. Avoid
moving focus when a result arrives. Refresh exposes busy state with `aria-disabled` and guards
re-entry while retaining focus; on failure it remains the named recovery target. If hiding the
widget removes focused content, return focus to the widget-menu trigger; sheet close uses the
existing focus-return contract. Out-of-order reads are rejected by request generation and current
session/workspace, including a workspace switch while a request is pending.

## Visual change expected

The implementation changes `/dashboard` in light/dark, desktop column and mobile sheet, including
menu on/off, loading, ready, identity, invalid, unsupported, stale, failed and blocked states.
Arabic RTL, keyboard-only operation, 360 px width and long translated labels are required.
`/pricing` and each paid checkout review gain a small free-source disclosure, using existing styles.
This design PR changes no rendered route and claims no browser QA. Implementation supplies actual
light/dark desktop/mobile blind A/B evidence and does not reuse reporter pixels as product assets.

## Copy

Proposed English keys below belong to the implementation, when every key must land in all 23
locale catalogues in the same change. Reuse existing currency names and common loading/error keys
where their meaning matches; add no English literals to JSX. Dates, numbers and retry times are
formatted in the reader's locale. Names ECB and Frankfurter identify factual sources.

| Key                                    | English text                                                                                 |
| -------------------------------------- | -------------------------------------------------------------------------------------------- |
| `shell.dashboard.currency.label`       | Currency converter                                                                           |
| `shell.dashboard.currency.amount`      | Amount                                                                                       |
| `shell.dashboard.currency.from`        | From currency                                                                                |
| `shell.dashboard.currency.to`          | To currency                                                                                  |
| `shell.dashboard.currency.result`      | Converted amount                                                                             |
| `shell.dashboard.currency.swap`        | Swap currencies                                                                              |
| `shell.dashboard.currency.refresh`     | Refresh rates                                                                                |
| `shell.dashboard.currency.loading`     | Loading reference rates…                                                                     |
| `shell.dashboard.currency.invalid`     | Enter an amount from 0 to 1,000,000,000.                                                     |
| `shell.dashboard.currency.unsupported` | Reference rates are unavailable for {from} to {to}.                                          |
| `shell.dashboard.currency.failed`      | Reference rates could not be updated.                                                        |
| `shell.dashboard.currency.unavailable` | Reference rates are unavailable.                                                             |
| `shell.dashboard.currency.stale`       | These rates may be out of date.                                                              |
| `shell.dashboard.currency.blocked`     | The rate service has reached its request limit.                                              |
| `shell.dashboard.currency.retryAt`     | You can refresh again at {time}.                                                             |
| `shell.dashboard.currency.effective`   | Rates dated {date}                                                                           |
| `shell.dashboard.currency.source`      | ECB reference rates via Frankfurter                                                          |
| `shell.dashboard.currency.freeSource`  | Reference rates are available free from the European Central Bank.                           |
| `shell.dashboard.currency.notice`      | Calculated for information only. Your payment provider may use a different rate.             |
| `shell.dashboard.currency.identity`    | The currencies are the same; no reference rate is needed.                                    |
| `shell.dashboard.currency.rateLine`    | 1 {from} = {rate} {to}                                                                       |
| `billing.currencyReferenceDisclosure`  | Currency conversion uses ECB reference rates, available free from the European Central Bank. |

Both free-source disclosures link to the primary ECB rates page. Pair/source codes are structured
placeholders rendered with bidi isolation, not concatenated translated fragments. Copy keys here
are a design inventory, not a partial addition to the live catalogue.

## Acceptance tests and security conditions

The implementation starts with a failing test through the module interface for each behaviour,
then code. Its unit tests use an injected external-provider fake, map-backed cache and controlled
clock, never the public service. The saved live-response sample documents wire expectations;
it is not a substitute for negative fixtures. No tests are added here to pretend unbuilt runtime
behaviour already exists; existing spec-registry tests validate this document's lifecycle.

| Seam                          | Required observable cases                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adapter inside `callProvider` | Live-shape fixture; empty/duplicate/mixed date/base, future date, bad rate, invalid JSON, oversized body, redirect, timeout, 429 with both Retry-After formats, 5xx. A malformed 200 increments calls and errors once and leaves cache intact.                                                                                                                                                                                                        |
| Public policy/cache           | Cold miss fetches one snapshot; any other pair and another workspace hit it with zero upstream calls. One-hour boundary, forced refresh, five-minute cooldown after success/error/block, Retry-After, four/seven-day UTC boundaries, same-date refetch not renewing age, expired/corrupt cache and older response are exercised.                                                                                                                      |
| Failure paths                 | Read/attempt-marker write failure suppresses network; snapshot write failure returns only the validated current result and keeps local cooldown. Stale eligible result vs no rate; no manual/frozen fallback on any path.                                                                                                                                                                                                                             |
| Concurrency                   | Deferred same-isolate requests share one attempt; resolve/reject clears in-flight entry. Separate-isolate fakes may race and both attempts count; no false assertion of exactly-one global fetch. Same-key KV write failure is handled. A 429 at 100 ms with Retry-After 3600 stores its deadline locally, writes no extension before one second, and permits no local retry before that deadline even if the deferred write fails.                   |
| Meter/console                 | Fresh hit, refresh success, provider error, blocked zero-call demand; allow vs block thresholds; server-derived initiating-workspace attribution and no usage for waiters. Gate/record fault and config memo tests retain documented fail-open/overshoot semantics. Only provider-configure may change settings.                                                                                                                                      |
| Auth/privacy                  | Anonymous, expired session, removed membership and foreign workspace input are refused before cache/provider. Two workspaces share public rates but cannot read each other's counters or frozen/manual data. Put distinct secret frozen rates on private trips in both and prove the widget never returns/caches them. Upstream URL/headers/body and KV entries contain no amounts or tenant/person/trip IDs. Log no payload or raw personal context. |
| Money interface               | Direction and cross-rate examples above; localised parsing, fractions/rounding, negative/blank/overflow rejection, zero, source-currency change and identity without any provider call. Formatting/unit-line precision never changes arithmetic.                                                                                                                                                                                                      |
| Widget preferences/UI         | New fallback includes currency; old records including empty shown/zones round-trip intact. Show/hide/reopen, zero widgets, swap preserving source amount, amount typing without requests, unsupported code retention, focus on hide/failure and stale request completion after pair/workspace changes.                                                                                                                                                |
| Browser journeys              | Seed user opens desktop then mobile sheet, enters amount, swaps, refreshes, hides/re-enables; deterministic available/stale/blocked/failure endpoints; light/dark and Arabic RTL at 360 px, keyboard only, no card overflow or widget-attributed layout shift.                                                                                                                                                                                        |
| Existing money                | Existing frozen-rate, display-currency, re-basing, budget entry/payment and export tests remain green; no new provider injected or stored monetary rows changed.                                                                                                                                                                                                                                                                                      |
| Source disclosure             | Before each paid entry path, user can read/open the free ECB source; result repeats notice/date/calculation disclosure. All 23 locale keys and placeholders match.                                                                                                                                                                                                                                                                                    |

Review security on the eventual runtime diff even though triage approved design work. All SQL
continues through existing scoped repositories/catalogue; changed repo methods must ship isolation
tests. No caller chooses attribution, no public/share endpoint is added and no platform secret is
needed. Logs may include provider/operation/status but never input amounts or cached tenant data.

## Risks, compatibility and rollback

Provider/source availability is best effort and terms can change; recheck the cited primary pages
before implementing. ECB coverage is intentionally narrower than the product's general currency
picker. Missing supported data is a product state, not a reason to blend another source. Daily
reference data cannot promise the rate a card issuer charges.

Only additive server-function/provider vocabulary and locale keys ship. Local widget preferences
retain their key and meaning; old clients may discard an unknown widget ID if they subsequently
save preferences, which is tolerated rather than fixed with an unrelated migration. No schema or
backfill is needed. Removing the widget from its registry and disabling the new entry point rolls
back the feature; private money remains untouched and public KV entries expire. Keep an already
shipped server-function contract accepted for the compatibility window. Do not change deployment
secrets, billing allowances or paid commitments as part of this task.

## Resolved assumptions (autonomous defaults)

| #   | Question                                              | Applied default                                                                                                 | Why                                                                                                                                                                                                                                       |
| --- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Runtime work or specification now?                    | Ready design-only document; no runtime changes or follow-up tickets before merge.                               | Triage product-owner verdict and security/tenancy approval explicitly require design first. A person merges this spec.                                                                                                                    |
| 2   | Which free provider and rights?                       | Frankfurter v2 ECB-only JSON with source/free-access/calculation notices.                                       | Independent architect via `afk-decide`, high confidence: one reviewed institution, no dependency/key, no broad blended-source rights assumption. Primary evidence is recorded above.                                                      |
| 3   | Cache, refresh and concurrent demand?                 | Hourly recheck, five-minute advisory attempt cooldown, seven-day maximum observation age; no automatic retries. | Independent architect via `afk-decide`, high confidence: daily data can be reused across pairs/workspaces while KV/meter limits are disclosed. The four-day fresh-observation bound makes old data visible even after a successful fetch. |
| 4   | Defaults and remembered selections?                   | 1 EUR to USD; keep amount/pair in route session, preserve all old visibility records.                           | Independent architect via `afk-decide`, high confidence: no persistent preference change beyond the requested widget visibility, no surprise reopening of hidden columns.                                                                 |
| 5   | Does Retry-After require a second immediate KV write? | Keep its deadline locally and defer the supervised KV extension until the one-second write interval.            | Independent security/tenancy review found that a fast 429 would violate the documented KV limit; the corrected test covers failed propagation without promising a global lock.                                                            |
| 6   | New domain terms or an ADR?                           | Add Reference rate and Currency converter to CONTEXT.md; keep the reversible provider choice in this spec.      | The new planning estimate must be distinct from an existing private Frozen rate; no irreversible contract or paid commitment justifies a separate ADR.                                                                                    |

## Phasing

One implementation phase, **a usable dashboard converter with operator controls and source
rights notices**, ships as one complete vertical slice. Provider/cache scaffolding alone is not a
user-facing release. Existing display-currency consumers and future `04-S7` activation remain
separate work, with no follow-up issue created by this design task.

## Implementation Plan

1. **Test the complete seam first.** Add failing adapter/public-policy tests, authenticated privacy
   and provider-console cases, money/widget UI cases and the deterministic desktop/mobile journey
   from the table. Capture the current dashboard A frame. Verify failures reflect absent converter
   behaviour rather than binding imports; use existing fakes and shared browser helpers.
2. **Deliver the converter end to end in the same slice.** Add public-rates policy/adapter and
   authenticated function, register the metered provider with all derived labels/tests, wire the
   widget/menu/shared responsive state, every listed failure path and the 23-locale copy. Add source
   disclosures on all paid entry paths. Prove the private rate path is never called. Each working
   commit keeps existing routes usable; do not expose a disabled placeholder widget before its
   function works. Tests and code can be separate local steps but belong to the same deployable PR.
3. **Verify and review that slice.** Run targeted seam tests, the complete configured validation
   gate and actual browser journeys with a restarted worktree dev server. Capture B frames in all
   requested themes/viewports/RTL, compare with A, and obtain security/tenancy and accessibility
   review. Update this spec's lifecycle/implementation links only under the registry rules. Do not
   mark it implemented until the whole converter and source disclosures have shipped.
