# Editable saved day routes with eligible-provider selection

| Field              | Value |
| ------------------ | ----- |
| **Status**         | ready |
| **Issue**          | #1319 |
| **Spec PR**        | #1683 |
| **Implementation** | none  |

## TLDR

Travellers will calculate, adjust and explicitly save one driving or walking route for a day.
The saved mode and intermediate points are shared under trip permissions; reopening recomputes
vendor results for the reader. Random selection uses only verified, activated, capable providers
with an available allowance. This is a design-only deliverable: a person merges the spec PR,
which uses `Fixes #1319` to close the design task; `afk-to-tickets` then slices implementation.

## Problem and scope

The reporter requests draggable routing and save/reopen, not changes to places or automatic stop
ordering. The Agent Brief narrows this to one current route per day. #662 owns the foundation:
routed times, road distances, road-following lines and the HERE adapter. This extension composes
that foundation through one routing interface, adding authored constraints, persistence and the
provider-selection policy. It must not create a second HERE proxy or another road-distance owner.

Out of scope: history, multiple saved alternatives, automatic optimisation, navigation, live GPS,
additional modes, user-entered vendor keys, generic multi-domain provider failover, account or paid
plan creation, production activation and changes to spend limits. No implementation, schema,
credentials, external routing request or legal commitment is part of this spec-task PR.

## Verified premises and ownership

Checked at this worktree's HEAD on 2026-10-31:

- `src/lib/map/routes.ts` still joins ordered coordinates and computes great-circle distances.
  `src/components/map/day-routes.tsx` renders dashed lines, not routing-engine results. Its style
  epoch handling must survive the extension. `plan-screen.tsx` supplies the day coordinates;
  `planner-day-tools.tsx` owns the existing day tools. The brief's premise remains correct.
- `src/server/metering/outbound.ts` owns `callProvider`: provider configuration is memoised for
  60 seconds, counters are recorded asynchronously, and gate/recording failures fail open.
  `policy: block` means refuse at the configured ceiling, not disable unconditionally. Missing
  rows, `allow` and null ceilings do not refuse calls. Do not infer activation from these states.
- `src/server/metering/rate.ts` owns `spendRateUnit`: UTC calendar-month keys and a 40-day TTL,
  KV read-modify-write and fail-open errors. These are approximate allowances, not reservations.
  `billing/limits.ts` has no routing metric yet. `catalog/provider-usage.ts` supports UTC day/month
  provider ceilings; API call counts are not vendor credits, money or a live vendor balance.
- `repos/days.ts` owns `requireTripDay`; trip visibility and role rules live in `repos/trips.ts`
  and its `trip-roles.ts` vocabulary. The existing planner write path in
  `routes/_app/trips/$tripId/-server/plan.ts` composes `requireTrip`, `requireTripDay` and
  `assertTripRole(..., TRIP_WRITE_ROLES)`. New functions belong under `src/server/fns` and reuse
  these guards, without importing or calling another server function.
- ADR 0019 is the routing design authority, not evidence that #662 has shipped. ADR 0036 is
  **proposed**, not an accepted replacement. No waiting saved-route specification was found by
  searching `.ai/specs/` for routing, `DayRoutes`, `routeCollection` and saved routes.

One concept, one owner:

| Concept                                                                | Owner in the eventual implementation                                                             |
| ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| Authored day-route shape and canonical stop snapshot                   | New `src/lib/map/day-route.ts`, pure and isomorphic                                              |
| Eligibility, uniform selection, bounded attempts and normalized result | New `src/server/routing/routes.ts`, injected Runtime; reuse #662's adapter and geometry decoding |
| Geoapify wire translation                                              | New `src/server/routing/geoapify.ts`, fixed host and validated wire data                         |
| Binding composition and credentials                                    | One routing `bindings.ts` seam, reusing existing credential seams                                |
| Tenant route reads and compare-and-swap save                           | New `src/server/repos/day-routes.ts`, tenant base repository                                     |
| Global routing activation and suppression metadata                     | Existing provider catalogue owner, `src/server/catalog/provider-usage.ts`                        |
| Authentication, read/edit checks and input validation                  | New `src/server/fns/day-routes.ts`                                                               |
| Draft, generation and focus state                                      | New route-local `-ui/day-route-editor.tsx`, composed by `plan-screen.tsx` and day tools          |
| Map layers and drag events                                             | Extend `components/map/day-routes.tsx`; no server imports or fetching there                      |

The names above are proposed owners, not claims that those new modules exist. Before slicing,
reconcile #662's landed interface against this contract; keep its canonical adapter rather than
copying it. Persistence/UI work can proceed with fakes while #662 is pending, but production
routing release depends on that foundation and the operator activation conditions below.

## Provider decision and dated evidence

[ADR 0047](../../docs/adr/0047-eligible-providers-for-editable-day-routes.md) proposes replacing
ADR 0019's exclusive HERE choice and ADR 0036 decision 1 with random selection among eligible
providers. It preserves their credential and HERE-specific restrictions. The reopening evidence
is Geoapify's routing-specific permission, not a claim of measured exhaustion before #662 ships.

Public official pages were retrieved on **2026-10-31**, without credentials or routing API calls:

| Provider and official source                                                                                                                                                 | Finding                                                                                                                                                                                                                                                                                                                     | Eligibility, display and retention consequence                                                                                                                                                                                                                                                                                                                                                                                                                                |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [Geoapify Routing API](https://www.geoapify.com/routing-api/), [API documentation](https://apidocs.geoapify.com/docs/routing/)                                               | Driving/walking, ordered waypoints and intermediate `through_stop`/`pass_through` semantics are documented. The routing page states: “you can store and redistribute your results.” GeoJSON display uses common map libraries.                                                                                              | Suitable candidate for the existing OSM-derived MapLibre map and cross-member results. No HERE-derived Japan exclusion is copied to this provider; availability still depends on routable coverage, returned response and applicable account/regional restrictions. No guarantee of worldwide routability.                                                                                                                                                                    |
| [Geoapify terms](https://www.geoapify.com/terms-and-conditions/) and [pricing](https://www.geoapify.com/pricing/)                                                            | Pricing explicitly permits commercial Free production within quotas, feature limits and attribution. General terms retain production limitations/contact wording. OSM attribution is always required; Geoapify credit is mandatory on Free. Distributing requests among accounts/projects to fit lower plans is prohibited. | Before activation the operator confirms the applicable account terms and commercial limits; neither a geocoding key nor this spec proves routing is enabled. Keep OSM and linked Geoapify credits on every result, including paid plans for one consistent implementation. Store no geometry in this slice despite the more permissive grant; no retention duration is invented from silence. Use one legitimate account per service, never account sharding to evade quotas. |
| [HERE Platform terms](https://www.here.com/en-gb/terms/here-platform-terms), read with ADR 0019                                                                              | §6.4(a) permits attributed layering subject to its exclusions; (h)/(l) restrict reuse and scaling a request to multiple users. Exhibit 2 §1.3 makes cacheability depend on response headers.                                                                                                                                | Conditional candidate through #662, not a shared-result cache. All HERE result data, including derived distances and times, stays with the requesting member. Preserve ADR 0019's conservative Japan exclusion, HERE/data credits and end-user terms/privacy links. Operator must complete the account/Base Plan and price checks ADR 0019 left open.                                                                                                                         |
| [Google Routes policies](https://developers.google.com/maps/documentation/routes/policies)                                                                                   | Map-displayed Routes results require a Google map; most content caching is restricted.                                                                                                                                                                                                                                      | Ineligible for the current map. No adapter, result storage or automatic Google fallback. A future map change requires its own design.                                                                                                                                                                                                                                                                                                                                         |
| [Mapbox Directions](https://docs.mapbox.com/api/navigation/directions/), [service terms](https://www.mapbox.com/legal/service-terms)                                         | Directions documents driving/walking and waypoints. The fetched service-terms page did not yield a verifiable applicable routing display/retention grant.                                                                                                                                                                   | Candidate only, excluded until commercial/account, own-basemap, regions, attribution, retention and cross-member rights are verified. API capability documentation is not a licence.                                                                                                                                                                                                                                                                                          |
| [openrouteservice Directions](https://giscience.github.io/openrouteservice/api-reference/endpoints/directions/), [terms URL](https://openrouteservice.org/terms-of-service/) | API documentation is available, but the terms URL and old restrictions/policies URLs returned HTTP 404. Hosted-service commercial and distribution rights were not verified.                                                                                                                                                | Candidate only. Open-source software licensing is not permission to consume the hosted API. No activation, cache or sharing rights assumed.                                                                                                                                                                                                                                                                                                                                   |

The Geoapify pricing documentation also charges by waypoint pairs and distance, with optional
outputs increasing credits. A counted HTTP attempt is not necessarily one credit. Request only
geometry/distance/duration, no stop optimisation, elevation or detailed instructions. Provider
ceilings are administrator-configured **call ceilings**; the operator maps them conservatively to
its account/credit allowance, shared use by other domains and any paid exposure. Do not hardcode
free-tier quantities or promise that remaining internal calls equal remaining vendor credits.

HERE and Geoapify are the two conditional adapter targets; there may initially be zero or one
activated provider. Random selection over one provider is valid, but is not a HERE-only product
policy. Named candidates never become eligible by supplying a key alone. Each reviewed descriptor
records mode support, waypoint/payload limits, region exclusions, attribution, member-display
scope, retention policy version and operator approval. All unmatched cases are ineligible.

### Retention and cross-member display

Persist **only user-authored intent**. Never turn a snapped vendor coordinate or a decoded line
vertex into a saved shaping point: store the user's raw drag/coordinate input. Do not store vendor
geometry, snapped coordinates, distances, durations, instructions or result tokens in D1, KV, R2,
rooms, audit payloads, exports or browser storage. No generated result is sent to an AI model.

Vendor results are held only in the current member's page memory; HTTP responses use
`Cache-Control: private, no-store`. Clear on logout, workspace/trip change, permission loss,
recalculation, stop changes and page exit. Set display expiry to five minutes from calculation,
shortened by a more restrictive provider/header rule. For HERE `no-store` or absent permission to
cache, allow only immediate display of the current response, with no reuse on another calculation
or reopen. Five minutes is a product maximum, never a claim of granted HERE retention. Remove the
line and derived figures at expiry; an explicit recompute is required. No background polling.

Every authorized reader receives the same authored mode/points, then requests a new result for
that reader. No cross-member deduplication of HERE calls or geometry. Geoapify's redistribution
grant does not require a shared cache, so it uses the same conservative lifecycle. A future shared
cache is separate work requiring a provider-specific design. Provider selection may change the
road line on reopening; saving preserves intent, not identical future street geometry. Explain this
before Save. Attribution follows the provider actually returned, never the selected default.

## UI/UX and route lifecycle

The existing day tools open a route editor for the selected day. Default a new unsaved draft to
walking; restore the saved mode when one exists. Driving/walking are the only modes. The editor
shows ordered geolocated stops and names unlocated stops omitted from calculation. A leg joins consecutive **geolocated** stops: in A(located),
B(unlocated), C(located), A→C is a valid leg while B remains in the source snapshot. Locating B
invalidates A→C constraints and requires explicit review/reset before recalculation. Fewer than two
distinct valid coordinates disables calculation with a reason. Preserve every stop identity in the
snapshot even where adjacent coordinates coincide; zero-length legs add no fictitious distance.
Do not route across a flight/train/ferry separator: report a split day and direct the traveller to
edit its day plan; supporting multiple independently saved segments is outside this slice.

Calculate is explicit. Dragging the **route line** inserts a shaping point into its identified
consecutive-geolocated-stop leg; dragging that point moves only that constraint. Place markers retain their
existing distinct reposition flow and are not draggable through this editor. Pointer movement is
local preview only; calculate once on release, with a 300 ms debounce for repeated releases.
Never route each pointermove. Remove/reorder shaping points through the ordered editor list.

Keyboard alternative: choose a leg by its two stop names, Add intermediate point, enter labelled
latitude/longitude fields, then Apply. Every point has Move earlier/later within its leg and Remove
controls. Inputs use decimal degrees, finite longitude [-180,180] and latitude [-90,90], with
localized validation. Map dragging is an enhancement, not the only way to make the same saved
intent. On mobile use the existing sheet pattern; preserve map pan outside a point drag and offer
Cancel drag/Escape. Do not trap page scrolling in the editor.

States: unsaved, calculating, preview, saving, saved intent awaiting calculation, expired,
stale stops, conflict, no eligible provider and retryable error. Render the saved route and draft
as distinct labelled states; do not silently mark a preview saved. The existing geodesic line may
remain dashed and labelled as straight-line distance, with no road time. Never present it as a
successful driving/walking calculation or enable Save on that basis.

Save requires a successful calculation for this exact draft generation and stop snapshot. Replacing
an existing route requires explicit confirmation; Cancel leaves the saved row untouched. Leaving
with an unsaved draft asks whether to discard; changing day cancels that draft after confirmation.
A failed calculation or refused save does not replace the row. A transport error during save is
an **unknown outcome**: re-read before retry, compare the mutation ID, and report success if it
committed. If reconciliation also fails, retain draft and ID, show unknown state and offer Check
saved route; do not issue an automatic second write.

Capture request generation, workspace claim, trip/day, saved revision and canonical draft key
before each async call. Apply a result only if every captured value is still current. Increment
on mode/point/stop/day/session changes and Cancel; abort the fetch where possible, but never rely
on abort to prove a vendor call was not made. Disable duplicate Calculate/Save while pending.
Room/loader invalidation may trigger a safe authored-state read, never an automatic paid routing
request. A role downgrade immediately removes edit controls; server checks remain authoritative.

Use labelled radios, visible focus, a polite live status region and an alert for refusal. Announce
point addition/removal and calculation/save outcomes. After removal focus goes to the surviving
point or Add control; after save to the route heading, after Cancel to the opening day tool,
after conflict to its explanation/reload control. Return errors to the initiating generation only.
Use existing design tokens, logical properties and non-colour distinctions, including RTL.

## Data model and compatibility

Add one tenant table `day_routes` through Drizzle schema and generated additive migrations:
`id`, `organization_id`, `trip_id`, `day_id`, `format_version` (1), `revision` (positive integer),
`mode` (`driving` or `walking`), authored `constraints_json`, `source_snapshot_json`,
`last_mutation_id`, `created_by`, `updated_by`, `created_at`, `updated_at`.
Unique `(organization_id, day_id)` enforces one current route; relate day/trip within the same
organization and delete the row when that day/trip is deleted. Workspace deletion, trip copying,
erasure and audit projections must explicitly account for this new table: workspace deletion
removes it, copying a trip does not copy routes in this slice, erased authors follow the existing
Former member convention, and audit contains IDs/action/revision, never coordinates/results.
Do not add an unsanctioned auth-table SQL path.

Constraints are an ordered array of `{ id, fromStopId, toStopId, longitude, latitude }`, keyed to
consecutive geolocated itinerary stops, with stable opaque IDs. They contain no place name, address or provider
payload. Source snapshot is a canonical versioned JSON array of the day's ordered itinerary
item IDs, place IDs, exact current coordinates (including null) and transport separators. The same ordered SQL JSON expression generates it for reads and
conditional writes, with deterministic tie ordering; the client echoes this opaque value. Never
re-serialize it independently in JavaScript, including exponent-valued coordinates or empty days.
Place label changes do not invalidate routes; coordinate, inclusion, order or separator changes do.
Constrain a calculation to at most **25 total geolocated stops plus shaping points**, at most
**10 shaping points**, and **16 KiB** authored input. These are conservative product bounds, not
assertions of a vendor's allowance. A provider's stricter documented capability wins; return an
explicit unsupported-size state instead of dropping points. Validate bounded decoded output:
1 MiB, 20,000 geometry coordinates, finite coordinates, nonnegative finite metres/seconds and
expected waypoint order/leg coverage. Abort oversized streams before buffering an unbounded body.

A stop change makes the saved route stale; retain authored intent for review, hide its computed
line, disable replacement and offer Recalculate for current stops. Never silently rebase a point
onto a different leg. User-confirmed reset clears constraints for changed/removed legs; retained
constraints must still refer to consecutive current geolocated stop IDs. Mode survives. With fewer than two
usable coordinates the row remains saved but not calculable. No itinerary writer deletes it merely
because the route cannot currently be shown. Deleting the day itself removes its route.

### Atomic save and concurrent edits

`readDayRoute` returns the current authored row, its revision and current source snapshot through
trip visibility. `saveDayRoute` uses a single tenant-scoped conditional writing statement, not
check-then-write: bind expected revision (0 means absent), expected source snapshot and current
edit permission into the operation; generate the ordered current snapshot from source rows in
that statement and require exact equality. The SQL predicate joins the day to its trip and current
trip membership/role through the application `trip_members` table, and checks archived/editability
rules as the planner does. Active workspace membership remains the existing authentication guard
at the server boundary, rechecked after long-running work; never add raw SQL against Better Auth
identity tables to this repository statement. Organization scope is
mandatory on every source/join. Use a conditional insert with unique conflict handling for first
save, and a revision-checked update for replacement. No broad read-modify-write of a day row.

Use ordered SQL JSON aggregation/subquery for snapshot equality; bind snapshot and constraints as
JSON values instead of expanding one placeholder per stop. This avoids the documented D1
[100 bound-parameter ceiling](https://developers.cloudflare.com/d1/platform/limits/).
SQLite tests must run this real statement and race both stop writes and two saves, including a
place move through a different writer. A statement failure returns a typed conflict/refusal,
re-reads safely and never falls through to an unconditional update. Any implementation that
chooses a revision-based invalidation alternative must update **every** source writer; that is
not assumed by this design.

A UUID mutation ID makes retry of the same normalized intent idempotent. Reuse the ID only for
that identical payload and expected snapshot/revision. If the row already records it and the
payload agrees, return its revision; a different payload with the same ID is invalid. If another
save replaced it, refuse/reconcile instead of replaying it. Save does not need another vendor
call: the authenticated calculation returns a short-lived server-authenticated receipt binding
member, workspace, trip/day, draft digest, source snapshot and expiry (five minutes maximum, shorter
if required by result policy). Verify it at save, including membership and current generation
inputs; never accept a client boolean claiming successful routing. Use `security/secret.ts`
`deriveSubkey` with a new closed purpose `day-route-calculation/v1` and the existing server auth
secret supplied at the binding seam. Add that purpose and isolation tests to the canonical security
leaf; never reuse `trip-invite-link/v1` or interpret a receipt as a bearer access grant. Sign a
versioned canonical JSON payload (at most 4 KiB; includes purpose/version, member, workspace,
trip/day, draft digest, source-snapshot digest, issued-at and expiry) using Web Crypto HMAC-SHA256,
verify with `crypto.subtle.verify`,
and Zod-validate every field and expiry before use. Key rotation invalidates pending receipts and
requires recalculation, without losing saved intent. No new credential. Store no receipt or result
in the route row. Expired receipt
requires explicit recalculation, preserving the draft and saved row.

This PR adds no table or functions. Eventual migrations only add the table/indexes; old Workers
ignore them. New functions may require their initial schemas, but existing #662 functions gain
only optional input fields for one release. No existing route path or response meaning changes.
An implementation rollback hides the new controls and retains authored rows. Re-enabled code
validates `format_version` and refuses unsupported future shapes rather than erasing them.

## Server and routing contracts

All new functions use Zod, `appScope()` and the current workspace claim. Never accept an
organization ID, credential, provider URL, allowance, role or trusted result from the client.
Read membership and trip visibility even on warm paths; `requireTripDay` prevents substituting a
day from another trip. Do not expose these projections via public share/feed endpoints or MCP.

| Function              | Input and permission                                                                                                                    | Result                                                                                                                     |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `getDayRouteFn`       | Trip/day IDs; current authenticated trip reader                                                                                         | Authored row or null, revision, current snapshot, stale/editability state; no vendor call                                  |
| `calculateDayRouteFn` | Trip/day IDs, mode, bounded constraints and expected snapshot; owner/editor and non-archived planner editability                        | Normalized result plus calculation receipt, or typed refusal; never writes saved route                                     |
| `showSavedDayRouteFn` | Trip/day IDs and expected saved revision; authenticated reader                                                                          | Recompute exactly the saved, current intent for this member; no arbitrary point input, no receipt granting edit permission |
| `saveDayRouteFn`      | Trip/day IDs, expected revision/snapshot, mode, bounded constraints, receipt, mutation ID; owner/editor and current planner editability | Saved authored row/revision, or stale/conflict/refusal                                                                     |

A viewer may read saved intent and explicitly choose Show saved route, consuming the workspace
routing allowance for that member-specific computation. This is a deliberate read experience,
not permission for connection search or arbitrary preview calculations. Enforce server-side
per-member/day throttling: one active request per page, plus a routing-owned server KV cooldown
`routing:show:v1:<organizationId>:<userId>:<dayId>` recording last acceptance, TTL 60 seconds,
with a target ten-second interval. This follows the existing KV limiter idiom but is explicitly
**approximate across concurrent tabs**, not an atomic security or cost bound. Fail closed if this
cooldown cannot be read/written; its value contains only the last acceptance time. Workspace
deletion, departure and erasure remove known keys where feasible; the 60-second TTL bounds
remaining member-keyed metadata, which is never logged. Test two concurrent admissions and expiry
without claiming an impossible globally exact interval. Recheck workspace allowance
on every dispatched attempt. No paid calculation on loader, room invalidation or page reopen.
Removed members and invisible/private trips are indistinguishable from missing resources. A
viewer forging Calculate or Save is refused before any routing call or write. Re-check permission
when returning results and saving after a long-running request; a departed member gets no geometry.

The injected routing Runtime supplies clock, random draw, provider adapters, fresh eligibility and
suppression access, outbound runtime and workspace rate store. Fixed allowlisted HTTPS endpoints,
redirect rejection, request timeout of 8 seconds and total calculation deadline of 18 seconds bound
external work. Send only mode, ordered coordinates and needed routing options; no workspace/member
IDs, labels or personal notes. API keys remain server-only, URL/key values are redacted from errors
and structured logs. External response validation lives in adapters, SQL in repos/catalog only.
Node tests import no `cloudflare:workers` seam. Uniform random selection uses an injected draw for
repeatable tests; choose from the filtered pool, without weights or preferred-vendor ordering.

The normalized result identifies provider and policy version, geometry, distance in metres,
duration in seconds, attribution, generated/expiry time and source/draft identity. Refusals use
closed codes: insufficient-stops, split-day, unsupported-size, stale-stops, forbidden, conflict,
allowance-exhausted, no-eligible-provider, no-path, unavailable, invalid-provider-response and unknown-save.
Map these to catalogue copy, never render vendor error text. Results for the whole day come from
one provider; an adapter must preserve ordered stops and shaping points in one attempt. No silent
per-leg mixture of licences or partial route presented as complete.

## Allowance, selection and failure policy

The console configures explicit routing activation plus a provider call ceiling and UTC day/month
window; an activated provider without an agreed blocking ceiling is ineligible. Zero ceiling means
no calls. Reuse `provider:configure`, platform audit and existing console controls, adding only the
routing activation/cooldown visibility this operation needs. Display existing operator provider
policy faithfully; `allow` is not a sufficient safety gate for routing activation. A deliberate
routing disable is separate from the existing ceiling policy. No credential entry controls.

Add `routing_calls_per_month` to the canonical `RATE_METRICS` and every plan's rate record via the
billing owner. Do not invent entitlements in the feature module or silently borrow transit units.
Initial production ceilings are zero until the operator configures the approved plan/provider
limits; local tests inject positive limits. Publish no marketing promise of a specific included
quantity from this design. Workspace counters reset at the first instant of each UTC month;
provider ceilings reset at UTC midnight or month start according to configuration. These internal
windows may differ from the vendor's contractual window, which activation must reconcile.

For each explicit calculation or show-saved operation:

1. Authenticate, guard permissions, validate snapshot/input, then read **fresh**, uncached routing
   activation, configured ceiling, observed usage and global suppression. Filter by reviewed rights,
   credentials present, mode, all coordinate regions, waypoint bounds, operator disable and known
   exhaustion. A read failure refuses routing; do not weaken other domains' fail-open posture.
2. Draw uniformly among eligible providers. Each operation tries at most **two distinct providers**,
   each once; adapters perform no hidden retries or chunk fan-out. Revalidate current gates before
   each attempt. A provider rejected locally is never contacted and costs no workspace unit.
3. Every actual HTTP attempt goes through `callProvider`. Its `beforeSend` invokes
   `spendRateUnit` with this workspace's resolved routing ceiling. A refused workspace allowance
   terminates the operation without selecting another provider. A dispatched timeout/error still
   spends a workspace unit and records the attempt. A reselected provider spends a second unit.
4. On explicit vendor quota exhaustion, synchronously persist provider-wide routing suppression
   until the configured next reset, extended by a later valid `Retry-After`. On 429 without an
   explicit quota signal use `Retry-After` or 60 seconds (minimum 60 seconds, maximum 24 hours).
   For 5xx, timeout or malformed result use 60 seconds; invalid credentials suppress until operator
   reactivation. A valid no-path response returns `no-path`, preserves the saved route, offers point
   editing and triggers neither provider suppression nor automatic second attempt. Invalid user
   input also terminates without suppression/reselection.
5. Refilter and optionally draw the second provider only after suppression is acknowledged. When
   none is eligible or the deadline/attempt bound is reached, return an honest refusal with a
   retry time where known. Never turn exhaustion into another account/project on the same vendor.

Add a small **global routing availability** record, not tenant content, under the provider catalogue
owner: provider/operation, activation, suppression reason/until and policy version. Store no
coordinates, trip/member IDs, keys or response payload. This is a new global-table exception:
the eventual implementation must update SPEC §5/§6's closed catalogue list and boundary tests in
the same change, or use an existing approved global configuration shape without adding a table.
Reads and suppression writes are synchronously awaited and fail closed for routing. A suppression
write failure ends this operation without reselection. Every new routing dispatch must consult the
authoritative record without KV/isolate caching; use D1 primary reads rather than a stale replica.
Suppression updates are atomic and monotonic: concurrent transient errors cannot shorten a quota
block, and an invalid-credential hold clears only through audited operator reactivation. A late
success never clears a newer failure hold. Test concurrent 60-second and reset-window failures.
After a successful suppression, later admissions do not call that provider until expiry/reactivation.
Concurrent calls already admitted may finish. No global hard exclusion or spending cap is promised
while admissions race with failures or a persistence outage. Report these residual risks explicitly;
if strict monetary guarantees become required, a separate atomic reservation design is needed.

Do not change `callProvider` or `spendRateUnit` semantics for email, geocoding, transit or other
consumers. Their approximate, fail-open counts remain visible alongside routing's fail-closed
eligibility. No internal count is advertised as an exact remaining vendor balance, paid-credit
balance or hard financial cap. Record only safe provider/operation/outcome metrics; never coordinates.

## Acceptance coverage and test seams

These are tests for the eventual implementation, not claims that this documentation ran routing.
Write each failing seam test before its production change; no live paid request is required.

| Seam                                  | Required scenarios                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure authored contract                | Both modes; finite coordinate and size limits; ordered stops/constraints; duplicate adjacent coordinates; null locations; changed inclusion/order/coordinate/separator invalidates snapshot; label-only edit does not; A→C point with omitted B invalidates when B gains coordinates; wrong-leg points rejected                                                                                                                         |
| Routing interface with provider fakes | Uniform selection via deterministic draws; zero/one/two eligible vendors; no preference; capability/region/terms/credentials/activation/ceiling filters; HERE Japan excluded before dispatch; no Google/Mapbox/ORS without review                                                                                                                                                                                                       |
| Runtime and metering                  | Before-send unit per actual attempt; failed attempts remain spent; block/no eligibility spends zero; workspace exhaustion ends chain; max two distinct attempts; deadlines; 429/quota/reset boundaries; suppression acknowledged before reselection; later request observes suppression; storage failure refuses; already-admitted concurrent calls documented; day/month UTC rollover; call counts distinguished from Geoapify credits |
| Wire adapters                         | Fixed URLs/no redirects; malformed/oversized streams; invalid geometry/order/partial route; no-path; pass-through versus itinerary stop mapping; both modes; attribution and expiry; keys absent from outputs/logs. #662's HERE fixtures remain canonical                                                                                                                                                                               |
| Real SQLite repository interface      | Workspace A cannot read/save B's route; wrong trip/day rejected; no membership/private trip denial; viewer save denied; unique first-save race; two saves with same revision yield one winner; stop move/reorder/remove races reject stale write; SQL snapshot numeric/exponent/empty-day equality; idempotent retry; same ID/different payload invalid; audit has no coordinates; day/trip/workspace deletion and author erasure rules |
| Handler guards                        | Forged organization/provider/role/receipt; cross-purpose/tampered/oversized/expired/wrong-member receipt; key rotation; workspace switch; role downgrade during calculate/save; viewer may only recompute saved current intent; stale saved revision refused; archived edits refused; no paid call from read/load                                                                                                                       |
| UI with deferred promises             | Mode/point changes discard earlier result; Cancel/day/workspace changes discard results; stop-change conflict; save lost response reconciles and does not duplicate; reconciliation failure retains draft; confirmation and keyboard focus; snapshot stale but saved row survives; expiry hides old geometry; no geodesic success label                                                                                                 |
| Browser with provider fakes           | Drag road line, verify places unchanged, Save, reopen and explicit recompute; driving/walking; keyboard-equivalent edit; view-only cannot save; dark/light style swaps retain layer/credits; desktop/mobile/RTL; role/workspace transition cannot leak geometry                                                                                                                                                                         |

Browser evidence uses the provisioned app and configured browser provider, with fake external
providers at the runtime boundary. Restart the dev server in a Cezar worktree after edits and
verify a new source token before trusting results. Capture the repository's required light/dark,
desktop/mobile blind A/B evidence during implementation; no fake screenshots claim this spec is built.

## Visual change expected

Future `/trips/$tripId/plan` day tools and map: route editor, mode switch, shaping handles, keyboard
point list, explicit calculate/save/replace/cancel, unsaved/saved labels, expiry/conflict/refusal
states and provider attribution. Check light/dark, desktop/mobile and RTL; preserve map controls,
existing place markers, geodesic lines and layer rebuilding across style changes. Future console
provider controls add routing activation and suppression status. This spec PR itself changes no UI.

## Copy

Proposed catalogue keys and English intent below are **design copy**, not application literals.
Reuse existing common Save/Cancel/Retry/Close, coordinate, validation and mode keys where equivalent;
new keys land in all 23 locales in the implementation. Dynamic stop/provider names are escaped.
Credits retain required provider spelling/links and are never hidden by translations.

| New key                                | English text                                                                                      |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `planner.route.edit`                   | Edit day route                                                                                    |
| `planner.route.calculate`              | Calculate route                                                                                   |
| `planner.route.showSaved`              | Show saved route                                                                                  |
| `planner.route.modeLabel`              | Travel mode                                                                                       |
| `planner.route.driving`                | Driving                                                                                           |
| `planner.route.walking`                | Walking                                                                                           |
| `planner.route.leg`                    | Between {from} and {to}                                                                           |
| `planner.route.addPoint`               | Add intermediate point                                                                            |
| `planner.route.point`                  | Intermediate point {number}                                                                       |
| `planner.route.moveEarlier`            | Move point earlier                                                                                |
| `planner.route.moveLater`              | Move point later                                                                                  |
| `planner.route.removePoint`            | Remove point                                                                                      |
| `planner.route.applyPoint`             | Apply point                                                                                       |
| `planner.route.pointAdded`             | Intermediate point added.                                                                         |
| `planner.route.pointRemoved`           | Intermediate point removed.                                                                       |
| `planner.route.cancelDrag`             | Cancel drag                                                                                       |
| `planner.route.calculating`            | Calculating route…                                                                                |
| `planner.route.calculated`             | Route calculated. Review it before saving.                                                        |
| `planner.route.unsaved`                | Unsaved route                                                                                     |
| `planner.route.saved`                  | Day route saved.                                                                                  |
| `planner.route.intentOnly`             | Saved mode and intermediate points. Calculate to show the current route.                          |
| `planner.route.recomputed`             | The road route may change when it is calculated again.                                            |
| `planner.route.replaceTitle`           | Replace saved day route?                                                                          |
| `planner.route.replaceBody`            | This replaces the current saved mode and intermediate points for everyone who can view this trip. |
| `planner.route.replace`                | Replace saved route                                                                               |
| `planner.route.discardTitle`           | Discard unsaved route changes?                                                                    |
| `planner.route.discard`                | Discard changes                                                                                   |
| `planner.route.insufficient`           | Add coordinates for at least two different stops to calculate a route.                            |
| `planner.route.omitted`                | Stops without coordinates are not included: {stops}.                                              |
| `planner.route.splitDay`               | This day contains a separate journey. Adjust the day plan before calculating one route.           |
| `planner.route.tooLarge`               | Use at most 25 stops and intermediate points in total, including at most 10 intermediate points.  |
| `planner.route.unsupported`            | No available provider supports this route. Adjust its points or try later.                        |
| `planner.route.stale`                  | The day's stops changed. Review the saved points before recalculating.                            |
| `planner.route.recalculate`            | Recalculate for current stops                                                                     |
| `planner.route.resetChanged`           | Reset points on changed legs                                                                      |
| `planner.route.conflict`               | Someone changed this route. Reload the saved route before replacing it.                           |
| `planner.route.reload`                 | Reload saved route                                                                                |
| `planner.route.expired`                | This calculated route has expired. Calculate it again to see a current route.                     |
| `planner.route.exhausted`              | This workspace has used its routing allowance.                                                    |
| `planner.route.unavailable`            | No routing provider is available. Your saved route has not changed.                               |
| `planner.route.retryAt`                | Try again after {time}.                                                                           |
| `planner.route.noPath`                 | No road route connects these points in this mode. Adjust the intermediate points or mode.         |
| `planner.route.failed`                 | The route could not be calculated. Review its points or try again later.                          |
| `planner.route.unknownSave`            | We could not confirm whether the route was saved. Check the saved route before trying again.      |
| `planner.route.checkSaved`             | Check saved route                                                                                 |
| `planner.route.readOnly`               | You can view this route, but cannot save changes.                                                 |
| `planner.route.straightLine`           | Straight lines between stops, not a calculated road route.                                        |
| `planner.route.attribution`            | Route provided by {provider}                                                                      |
| `console.providers.routingEnabled`     | Enable routing for this provider                                                                  |
| `console.providers.routingSuppressed`  | Routing is temporarily unavailable until {time}.                                                  |
| `console.providers.routingNeedsReview` | Routing needs account and terms review before activation.                                         |
| `console.providers.routingApproximate` | Counts are approximate API calls, not vendor credits or a spending guarantee.                     |
| `console.providers.routingReactivate`  | Reactivate routing after resolving the provider error                                             |

## Risks, activation and rollout

This specification authorizes no service use. Operator-only prerequisites are: verify commercial
account terms and regional coverage, read current prices/free/paid limits and any shared account
usage, approve call ceilings and workspace plan quantities, enable the relevant APIs in legitimate
accounts, and provision platform Cloudflare secrets if missing. No unattended step accepts terms,
creates paid accounts or changes production spend. If new binding names are actually needed,
update `.dev.vars.example`, bootstrap, `docs/DEPLOY.md` and generated types together; never place
key values in D1/UI/logs. Existing `HERE_API_KEY`/`GEOAPIFY_API_KEY` seams are preferred.

Random choice sends coordinates to different approved processors. Update privacy/provider
notices and HERE end-user links before activation; expose provider attribution on each result.
Security review of this design does not approve the future migrations, guards or diff. Each
risk-high implementation ticket needs its applicable security/tenancy verdict before claim/merge.
No production feature is marketed as ready while its eligible provider pool is empty.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                        | Applied default                                                                                                                                 | Why                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Is this an implementation task?                                 | Design only; one ready spec and proposed superseding ADR; human spec merge, then ticket slicing.                                                | Agent Brief explicitly approves this scope, including security conditions, not production implementation.                                                                                                |
| 2   | Which provider policy can replace single-vendor design?         | Closed reviewed pool; HERE and Geoapify conditional, uniform random selection among eligible providers. Google excluded; Mapbox/ORS unapproved. | Independent software architect, high confidence: terms research opens ADR 0036's candidate-terms condition, but account approval and unread rights must remain gates.                                    |
| 3   | Can existing meters guarantee cost or stop repeated exhaustion? | Keep approximate counters; add fresh fail-closed routing admission and acknowledged shared suppression; max two distinct attempts.              | Independent software architect, high confidence: asynchronous usage and KV read-modify-write are not reservations. Already-admitted concurrency remains explicit.                                        |
| 4   | Is a separate gateway spec required?                            | One cohesive day-route spec; no reusable cross-domain gateway project.                                                                          | Independent software architect, high confidence: selection is the execution policy of this same calculate/save/reopen operation.                                                                         |
| 5   | What is saved and shared?                                       | One authored mode/constraint set, not vendor results; each reader explicitly recomputes.                                                        | Agent Brief security verdict separates authored intent and licensed results; the conservative common retention model avoids cross-member HERE reuse.                                                     |
| 6   | Are history and alternatives required?                          | No. Explicit replacement of one current route.                                                                                                  | Agent Brief product-owner verdict: optional reporter suggestion, outside this complete first slice.                                                                                                      |
| 7   | May a viewer recompute saved intent, and are cooldowns strict?  | Explicit show-saved only; per-member/day KV cooldown is approximate and fails closed on storage errors.                                         | Independent security/tenancy reviewer, high confidence, approved design only: no arbitrary preview/write, renewed access checks, workspace allowance, bounded metadata TTL and no hard spending promise. |

## Review corrections

Independent scope review required explicit A→C routable-leg behavior when B has no coordinates,
a distinct no-path refusal with no suppression/reselection, and one SQL snapshot encoding for
read/write comparisons. All are incorporated above. Independent security review required a new
domain-separated receipt purpose, explicit approximate KV cooldown limits and correction of the
nonexistent `repos/trip-members.ts` path; all are incorporated. These are design-review corrections,
not claims of implementation test coverage.

## Implementation Plan

This is the design-phase output. A person merges it before `afk-to-tickets` creates dependency-linked
implementation tickets. #662 remains the foundational routing owner; do not file a duplicate of it.
Each phase below leaves the application working and is validated at its interface before code.

### Phase 1: Reviewed routing admission and provider integration

1. Add failing runtime tests for eligibility, uniform choice, exhaustion, two-attempt bound and
   storage failure. Reconcile the #662 interface; add the Geoapify adapter behind disabled routing
   activation, with wire fakes, bounds and credits. Update provider/schema/type inventories,
   catalogue exception docs/tests, canonical billing rate records and console configuration copy.
2. Add routing availability metadata through generated additive migration if required; implement
   guarded/audited configuration and synchronous suppression. Preserve other domains' meter
   behavior. Verify concurrent admissions and UTC windows with fakes/SQLite; default all new
   production activation/plan units off. Run the full configured gate. No paid smoke test.

### Phase 2: Saved authored routes and member-specific calculation

3. Write SQLite isolation/role/race tests first; implement the tenant table, snapshot predicate,
   idempotent revision save, deletion/copy/erasure rules and audit projection. Generate migrations,
   stage generated output and run the gate. No browser entry point yet.
4. Add failing handler-interface tests, then guarded read/calculate/show/save functions with Zod,
   receipt validation, fixed provider endpoints, no-store/member result policies and per-reader
   throttle. Verify wrong workspace/day, stale source, viewer attacks and permission loss. Keep
   the product controls hidden until the vertical user flow in Phase 3 is complete.

### Phase 3: Complete edit, save and reopen experience

5. Start with deferred UI tests for generations, cancel, conflicts and unknown save outcomes; add
   route-local editor, map drag integration and equivalent keyboard controls. Land copy in every
   locale, glossary/doc updates, expiry/attribution and day/role/workspace recovery in the same
   slice. Preserve #662 result ownership and existing geodesic labels. No real provider required.
6. Browser-verify drag and place stability, both modes, Save/reopen, viewer access, exhaustion,
   focus, mobile/RTL and light/dark style changes with provider fakes. Attach required visual
   evidence, run the configured full gate and obtain security/tenancy review of the final diff.
   Only a later explicit operator activation can enable real routing under the recorded terms,
   account and spend approvals; otherwise the recoverable no-provider state remains truthful.
