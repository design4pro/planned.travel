# Nomi surfaces the next useful action on the dashboard

| Field              | Value |
| ------------------ | ----- |
| **Status**         | ready |
| **Issue**          | #1316 |
| **Spec PR**        | none  |
| **Implementation** | none  |

## TLDR

Proposed behavior: an original dashboard mascot presents one relevant, authorized suggestion and opens a separately supplied AI chat, with a useful unavailable state until that service exists. Preserve Nomi's original Arctic tern art, inline SVG/CSS animation, pause and static reduced-motion pose. This document delivers design only; a person merges its specification PR, then separate implementation tickets deliver the slices below. `ready` means the design can be sliced, not that its external integrations exist.

## Problem Statement

Issue #1316 requests notifications, upcoming reservations/events, nearby attractions and an AI chat entry point. It establishes a desired experience, not measured evidence of missed events. The current dashboard already offers trip and reservation navigation; the notification inbox remains the authority for delivered notifications. A second reminder-delivery system would add competing semantics without solving the interaction need.

### Evidence at HEAD and corrected premises

- `src/routes/_app/dashboard.tsx`: `UpNext` renders a blank-slate card or the trip hero and `TripHeroStrip`. No Nomi or AI chat control is mounted. The plan's old line numbers are historical, not implementation instructions.
- `src/routes/_app/-server/overview.ts`: `loadDashboard` returns `DashboardPayload.today`, `upNext`, `upcoming`, `mine` and `reservations`. `TripCard` includes the caller's role and archival flag; `ReservationCard` has date/time strings but no timezone. Notifications are only counted in this payload.
- `src/server/repos/dashboard.ts`: the dashboard loads at most five upcoming reservations. `listUpcomingReservations` in `src/server/repos/reservations.ts` includes `pending` and `confirmed`, with a lower date bound. That query enforces tenant scoping but does not check Trip readability or archival state. Filtering those five cannot promise a complete seven-day event list or establish Trip authorization by itself.
- `src/server/clock.ts`: `serverToday()` is a UTC calendar date (development/test pin supported), not the traveller's local calendar day. Keep that convention for the existing dashboard; do not silently reinterpret it as local time.
- `listNotifications(scope, userId)` filters both workspace and recipient. The generic `notificationsRepository` and `markRead` are not independently recipient-scoped; `readNotification` checks the recipient before writing. Reuse the scoped list, not a generic repository read assumed to be recipient-safe.
- Searches of `src/`, waiting specifications and `docs/adr/` found no AI chat-launch implementation or supplying dependency. Do not confuse trip collaboration conversation with AI chat. The proposed contracts below are future capabilities, not existing endpoints.

### Reference and infrastructure boundaries

The existing plan records `wiki: Plugins` behavior; preserve its clean-room original-art direction. No reference code, assets, names or strings enter the implementation. Agent reference browsing is forbidden by `docs/agents/reference.md`; this design relies on the plan's existing observations, not a fresh reference inspection.

The reporter names Cloudflare and Flue. The [Cloudflare Agents documentation](https://developers.cloudflare.com/agents/) was fetched on 2026-10-31; its overview identifies Agents, but does not verify a Flue contract or an application chat dependency. This is not evidence Flue cannot be used. Treat it as an infrastructure direction for the future chat owner to verify against primary documentation, pinned stack and a separate dependency decision. This design adds no package, binding, paid generation or provider commitment. Geoapify geocoding in ADR 0013 does not approve a nearby-attractions API or sending a traveller's location to it.

## Proposed Solution

One owner for the interaction policy, with independently useful implementation slices. The mascot's energy remains tied to the next trip; prompt ranking never changes the trip countdown or pretends to be an urgency/safety classifier. A nearby suggestion must never suppress a reservation happening today.

### Reconciliation with `14-dashboard-mascot.md`

This specification extends that plan's decorative-only scope for issue #1316. It supersedes only the claims that pause is the sole interactive control, that the figure has no action, and that all interactive data already exists on the dashboard wire. New event adapters are owned here; no plugin runtime is introduced. Existing decorative-stage work must implement the shared art/state contract once, not ship a competing second mascot.

Retain the plan's original Arctic tern silhouette and props, its day bands (`settled` above 30, `eager` 8-30, `countdown` 1-7, `travelling` day zero through the inclusive end date, `drifting` for missing/expired dates), the 7-to-1 tile and no zero tile. Preserve original art rather than the reporter's reference luggage character. CSS keyframes only; no rAF loop or asset-generation dependency. Keep `planned.mascot` pause preference, background-tab pause and post-mount preference read. Both the OS and any effective application reduced-motion preference force a completely static pose; no new product-wide motion-setting mechanism is commissioned here.

With no `upNext`, the art stays hidden as in the plan. A reserved prompt row below the blank-slate action can still offer inbox/chat availability without covering the invitation. It never creates a fake trip or countdown. Pending/error states use the existing route skeleton/error panel; do not add a competing loading mascot.

## Architecture

| Owner                                                              | Responsibility and boundary                                                                                                                                                                  |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proposed `src/routes/_app/-lib/mascot-state.ts`                    | Pure decorative state and prompt selection. Explicit clock/data/suppression inputs; no fetching, storage or ambient clock reads.                                                             |
| Proposed `src/routes/_app/-ui/mascot.tsx`                          | Original SVG, native chat button, prompt link, dismiss and pause controls. Reuse house primitives, `cn()` and translations. No SQL or provider calls.                                        |
| Proposed dashboard adapter in `src/server/fns/dashboard-mascot.ts` | Zod-validated, bounded, authorized prompt projection. Compose repositories; never call another server function. Reuse existing dashboard data for slice 1, not a duplicate dashboard loader. |
| Existing `src/server/repos`                                        | All later application SQL via tenant-scoped base repository. Recipient and trip-access checks belong here; every changed method gets isolation tests.                                        |
| Future chat owner                                                  | Supplies open/focus/availability adapter, session and authorization checks. No second chat backend in the mascot.                                                                            |
| Future nearby-attractions owner                                    | Supplies consent-gated bounded lookup; approves privacy, provider and retention separately. No automatic provider selection here.                                                            |

Route orchestration passes data and adapters to the UI. Do not put fetching into `components/ui`, add route-local SQL, or make a server function call `loadDashboard`/`loadNotifications`. Existing route-local overview functions remain in place; new server functions follow the current `src/server/fns` convention. Notifications keep their existing keys/params and read state; a prompt neither delivers a Reminder nor writes a notification.

## Data Model and API Contracts

No migration, persistent entity or public API is added by this design task. Future normalized candidates are a narrow projection: stable source kind/id, occurrence key, authorized internal destination, localized message key/params, date or validated instant/zone, and ranking fields. Do not pass whole `ReservationCard` objects: confirmation numbers, notes, prices and provider URLs are unnecessary. A candidate is never an authorization grant.

A **dashboard prompt** is one passive suggestion based on data the current traveller may read. Its owner is the dashboard interaction policy. A **nearby suggestion** is a dashboard prompt based on a separately consented approximate location lookup, not a saved Place or a delivered Reminder. These terms are added to `CONTEXT.md`.

### Event selection and time

Pure selector input: `{ today, nowMs, candidates, dismissed, currentScope }`; output: one candidate or `null`. `today` comes from the existing dashboard and `nowMs` from an injected clock. SSR and the first hydrated render share the same snapshot; revalidation, return to a visible dashboard and date rollover can refresh it. No ticking visual timer or background polling. A visible page schedules only its next UTC date boundary; on visibility restoration recompute from one refreshed snapshot. Tests inject both values explicitly.

| Family            | Eligibility                                                                                                                                                                                                                         | Suggested action                                                                                                                                                                                              |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Notification      | Current workspace and recipient, unread, `createdAt` in `[now - 7 × 24h, now]`; type `action` additionally requires `response === null`. Invalid or future timestamps excluded.                                                     | Open `/notifications`. Never directly execute or trust `actionUrl`, accept an invitation, mark read or submit a response. Render the generic localized prompt below rather than exposing notification bodies. |
| Reservation       | Authorized readable, non-archived Trip; `confirmed`; valid `startDate` in inclusive `[today, today + 7 calendar days]`. `pending`, cancelled, undated or expired rows excluded.                                                     | Open the existing Trip Book route `/trips/$tripId/book` with a validated trip id, read-only where necessary. No external provider URL or automatic booking/change.                                            |
| Scheduled event   | Future adapter for authorized dated itinerary items on non-archived Trips, not a newly invented Event table. Same inclusive seven-day window. Cancelled/completed occurrences excluded; title never makes an undated item eligible. | Open the existing Trip Plan route `/trips/$tripId/plan`; no direct edit suggestion for viewers, non-members or archived trips.                                                                                |
| Nearby attraction | Only after opt-in and a successful, non-expired lookup. At most three approved results within 5 km of approximate location. No fabricated opening hours, availability or booking claims.                                            | Open an approved existing internal place-detail destination; no auto-save or external arbitrary URL. If no supported destination exists, adapter is unavailable.                                              |

Slice 1 deliberately uses only reservations whose `tripId` matches a non-archived `TripCard` already returned in `upNext`, `upcoming` or `mine`. Those trip lists use the readable-trip path (`listUpcomingTrips` / `listTripsForUser`); do not infer readability from tenant membership or `ReservationCard` alone. Omit every reservation without this positive match, even if that leaves no prompt. A matched `role: null` permits read-only navigation, never a write. This intersection adds no query and makes no new authorization grant. Add selector tests proving unmatched/private/archived candidates are omitted and organization-readable viewer destinations stay read-only. Its acceptance is a useful suggestion from loaded data, never completeness or timed alerts. Slice 2 owns the bounded seven-day query, authorization filtering **before** limiting, and itinerary mapping. It must provide at most 50 notification candidates and 50 scheduled candidates after eligibility filtering, ordered by the selector's family order; show one, with the inbox/Book/Plan as the full lists. No unbounded query or pagination loop. New optional projection fields must not change old DTO meanings.

Existing date-only reservations use UTC `today`; `startTime` without a timezone is display data, never parsed as UTC or the browser's zone. They remain eligible throughout their calendar start date and copy explicitly says the day, not that departure is still ahead. The future event adapter supplies either date-only data with the same rule, or a valid UTC instant plus IANA zone. For timed events, derive the event's local day and local today from that zone; require local day offset 0-7 and `startInstant >= now`. A missing/invalid zone downgrades to valid date-only behavior with no hourly promise. Ambiguous/nonexistent DST wall time without an explicit instant also downgrades; never guess an offset. Compare date ordinals rather than dividing local milliseconds by 24 hours.

Ranking: (1) today's reservations/events; (2) unanswered action notifications; (3) later reservations/events; (4) other notifications; (5) nearby attractions. Sort scheduled candidates by day offset, then known instant (date-only last for the same day), then source kind and binary lexical id. Notifications sort newest first, then id; nearby results by approximate distance then id. Stable IDs make ties deterministic; no locale-dependent string sorting. Missing/error families contribute no candidates and cannot starve working families.

### Suppression and refresh

Exactly one passive prompt, no automatic carousel, sound, focus change or repeated live announcement. Dismiss hides the prompt row until the traveller next enters the dashboard; do not immediately replace it with another candidate. Remember the exact occurrence for 24 hours in `sessionStorage`, keyed by user and workspace, storing only source/id/occurrence and expiry, bounded to the latest 50 entries. No titles, notification bodies or coordinates. An occurrence is source + id + scheduled date/instant; a notification uses its immutable id/creation instant. A date change creates a new occurrence; text edits do not.

At exactly expiry the occurrence is eligible again. Clear memory, outstanding work, cached candidates and displayed context on user/workspace changes; remove the old scope's suppression entries on logout. Corrupt/blocked storage falls back to current-entry memory and never breaks the dashboard. Cross-device or cross-tab synchronization is not promised. Dismiss never marks the inbox read. A newly fetched candidate must not replace a visible focused prompt; update after focus leaves or next dashboard entry. Authorization loss removes it immediately and returns focus to the mascot control if required.

### Chat-launch contract (proposed internal client interface)

Availability is `available | unavailable`; absent adapter means unavailable. Proposed `open({ source: 'dashboard-mascot', entity?: { kind: 'trip' | 'reservation' | 'itinerary-item', id: string } })` resolves when the existing chat panel is open and focused. The integration owns idempotent open-or-focus semantics. No notification text/id, free text, traveller identity, workspace identifier, coordinates, reservation code or notes enter this payload. Omit the entity for notification/nearby prompts or where authorization is uncertain. The chat owner resolves current session/workspace and reauthorizes any entity; a stale context must not expose data.

A native button has one `click` handler for pointer, Enter and Space; no parallel `keydown` opener. While opening, coalesce activations into the same operation, set busy state and prevent duplicate dispatch. If already open, focus it. On rejection, availability change or 10-second timeout, restore the control and display the unavailable panel. The adapter must invalidate a timed-out attempt so a late completion cannot open a second panel; use an abortable attempt or equivalent generation guard. Component unmount/workspace change invalidates the attempt and clears entity context. No automatic retry. This is one open attempt per user activation, not an exactly-once backend delivery claim.

When unavailable, activation opens a small non-modal explanation panel with a working inbox link and Close. Keep the button usable, with `aria-expanded`/`aria-controls`; Escape closes the panel and returns focus. No fake chat field, route or model. When available, the actual chat owns its focus management and closing behavior.

### Location and nearby capability

Do not call geolocation or even prompt for consent until an approved nearby adapter is available. Its default state is unavailable, with explanatory text; all other prompt families work. A separate explicit control explains one-time approximate lookup, recipient and retention before the browser permission request. Clicking Nomi/chat is never location consent.

After that action use one `getCurrentPosition` call, `enableHighAccuracy: false`, `maximumAge: 0`, timeout 10 seconds; never `watchPosition`. Keep raw coordinates only long enough to round latitude/longitude to two decimal places. The future same-origin server boundary accepts only finite bounded rounded coordinates, radius at most 5 km and an allowlisted locale; validate with Zod, derive tenant/user from the session and enforce quotas/rate limits. Return at most three approved results, distance approximate and id/destination validated. No account, trip context or workspace id is transmitted to an external provider.

Coordinate/result memory expires after 15 minutes and is discarded on navigation away, opt-out, logout or workspace/user switch; cancel outstanding requests and ignore late results. Expiry removes nearby prompts and requires another explicit action, never automatic refresh. Neither raw nor rounded coordinates go to D1, KV, R2, URLs, browser persistent/session storage, analytics, logs, Sentry or chat. No background collection or location history. Logs must redact request bodies at every proxy/provider boundary.

This task authorizes no external transmission. Before enabling the adapter, a separate security/privacy review must name the provider and endpoint, approve recipient/retention/terms and privacy notice, and verify logging minimization. Until then no geolocation request occurs. A new location data flow cannot inherit ADR 0013's public-address cache permissions. Denied, unsupported, timeout, offline, empty results and provider unavailable each have a stable localized state and an inbox fallback. Denial never triggers an automatic repeat prompt; retry is explicit after the traveller changes permission. Stopping location does not claim to revoke browser permission, and explains browser settings if asked.

## UI/UX and Visual change expected

Only `/dashboard` changes in later implementation: populated hero with Nomi/chat/pause, a bounded prompt row, empty hero without art, unavailable explanation and nearby consent/status. This design PR changes no screen. No accepted prototype is claimed.

Keep fixed mascot stage dimensions from the decorative plan, logical positioning and mirrored art for RTL. Reserve prompt space in the hero from first paint; long translated text wraps inside that space or uses an accessible expandable detail, never covers the title, badge row, TripHeroStrip or Open plan. At 320/360 px and 200% zoom, put prompt controls in a reserved row below the main hero content; no horizontal scrolling. Use logical spacing; numbers retain bidi isolation. Both inverse light/dark heroes use existing contrast tokens.

The SVG and flap digit remain `aria-hidden`; the enclosing native chat button has localized accessible text. No nested links/buttons inside it: pause, prompt link, dismiss and nearby controls are siblings. Use at least 44px touch targets and visible focus, with keyboard order matching visual order. Motion is not the only indication of any event. Pause is independent from prompt dismissal and chat availability; `aria-pressed` reflects the preference. Reduced motion removes all mascot loops/transitions/flap movement; changing that preference while mounted also freezes the pose. Read preferences before starting motion; storage failure has a static safe initial render.

Display prompt updates as ordinary content, not an alert. Announce an explicit chat-opening failure once through a polite status region. Busy chat activation retains a predictable focus target. Non-modal panels close on Escape, do not trap focus and have explicit headings. The route's real error/retry controls remain accessible if a source fails; the mascot adds no blocking overlay.

## Copy

Proposed keys below are in the `shell` namespace (full keys shown). They are a design inventory, not added runtime strings. Each implementing slice lands the keys it renders in all 23 locales using `i18n-messages`, plus copy-rule sweep coverage; reuse existing common keys where their meaning matches. Nomi's name stays out of product copy. Dates use the existing locale formatter; no raw status tokens or hand-built English plurals.

| Key                                           | English text                                                                                                                                                                                               |
| --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shell.dashboard.mascot.pause`                | Pause animation                                                                                                                                                                                            |
| `shell.dashboard.mascot.resume`               | Resume animation                                                                                                                                                                                           |
| `shell.dashboard.mascot.openChat`             | Open travel chat                                                                                                                                                                                           |
| `shell.dashboard.mascot.openingChat`          | Opening travel chat…                                                                                                                                                                                       |
| `shell.dashboard.mascot.chatUnavailableTitle` | Travel chat is unavailable                                                                                                                                                                                 |
| `shell.dashboard.mascot.chatUnavailableBody`  | You can still check your notifications and trip details.                                                                                                                                                   |
| `shell.dashboard.mascot.close`                | Close                                                                                                                                                                                                      |
| `shell.dashboard.mascot.dismiss`              | Dismiss this suggestion                                                                                                                                                                                    |
| `shell.dashboard.mascot.notification`         | You have an unread notification.                                                                                                                                                                           |
| `shell.dashboard.mascot.actionNotification`   | A notification is waiting for your response.                                                                                                                                                               |
| `shell.dashboard.mascot.openInbox`            | Open notifications                                                                                                                                                                                         |
| `shell.dashboard.mascot.reservation`          | A confirmed reservation starts on {date}.                                                                                                                                                                  |
| `shell.dashboard.mascot.event`                | A planned event starts on {date}.                                                                                                                                                                          |
| `shell.dashboard.mascot.openReservation`      | View reservations                                                                                                                                                                                          |
| `shell.dashboard.mascot.openEvent`            | View trip plan                                                                                                                                                                                             |
| `shell.dashboard.mascot.empty`                | No suggestions right now.                                                                                                                                                                                  |
| `shell.dashboard.mascot.sourceUnavailable`    | Some suggestions could not be loaded.                                                                                                                                                                      |
| `shell.dashboard.mascot.retry`                | Try again                                                                                                                                                                                                  |
| `shell.dashboard.mascot.nearbyUnavailable`    | Nearby suggestions are unavailable.                                                                                                                                                                        |
| `shell.dashboard.mascot.locationConsent`      | Use your approximate location once to find nearby attractions. Location and results stay for up to 15 minutes while this dashboard is open. {recipient} receives the approximate location for this lookup. |
| `shell.dashboard.mascot.useLocation`          | Find nearby attractions                                                                                                                                                                                    |
| `shell.dashboard.mascot.stopLocation`         | Stop using this location                                                                                                                                                                                   |
| `shell.dashboard.mascot.locating`             | Finding your approximate location…                                                                                                                                                                         |
| `shell.dashboard.mascot.locationDenied`       | Location access is off. You can change it in your browser settings.                                                                                                                                        |
| `shell.dashboard.mascot.locationUnsupported`  | This browser cannot provide your location.                                                                                                                                                                 |
| `shell.dashboard.mascot.locationFailed`       | Your location could not be found.                                                                                                                                                                          |
| `shell.dashboard.mascot.locationExpired`      | Location has expired. Choose Find nearby attractions to use it again.                                                                                                                                      |
| `shell.dashboard.mascot.nearbyEmpty`          | No nearby attractions were found.                                                                                                                                                                          |
| `shell.dashboard.mascot.nearby`               | An attraction is about {distance} away.                                                                                                                                                                    |
| `shell.dashboard.mascot.openAttraction`       | View attraction                                                                                                                                                                                            |

The future location slice supplies the approved recipient's public name in `{recipient}` before enabling consent, plus a link to the approved privacy notice. A missing recipient is an unavailable adapter, never an empty placeholder. Requesting and lookup share the busy status; timeout/offline use `locationFailed` with explicit retry, provider failure uses `nearbyUnavailable`. No additional provider prose bypasses the catalogue.

## Verification matrix and failure scenarios

This design introduces no executable logic, so test-first here is a specification review against the brief and existing registry guard. Future implementation must write the following failing tests at public seams before code, observe the failures, then implement. No sentence in this design claims those runtime tests have run.

| Seam                    | Required boundary/assertion                                                                                                                                                                                                                                                         |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pure selector           | Day offsets -1/0/7/8; month/year and leap-day rollover; notification exactly 7 days old eligible, one ms older excluded, future excluded; cancelled/pending/read/responded excluded.                                                                                                |
| Time normalization      | UTC midnight differs from browser local day without hydration divergence; timed event at now eligible, one ms past excluded; DST gap/fold with explicit instant; invalid/missing zone uses date-only path.                                                                          |
| Ranking                 | Today's event before action notification, action before later reservation, other notifications before nearby; tied ids stable across locales and input permutations; no valid candidates returns null.                                                                              |
| Suppression             | Dismiss renders none for rest of entry; occurrence still suppressed at 24h minus 1 ms and eligible at 24h; text edit does not resurface, date edit does; scope changes and corrupt/blocked storage safe.                                                                            |
| Repository adapter      | User B and tenant B data invisible; recipient filter enforced even in same workspace; unreadable/deleted/archived trip excluded before limit; 51st eligible record does not cause unbounded reads; stale role cannot grant writes.                                                  |
| Component + fake chat   | Pointer/Enter/Space each dispatch one open; double activation while opening coalesces; already-open focuses; absent adapter, rejection, timeout and late completion create no duplicate panel; unavailable inbox link works; Escape returns focus.                                  |
| Location + fake adapter | No request on mount/chat click/unavailable adapter; one explicit permission request; denial no automatic retry; 10s timeout; 15min expiry; rounding and bounds; no coordinates in storage/log/telemetry/chat; navigation/scope change ignores late result.                          |
| Browser journeys        | Light/dark, desktop and mobile, 320/360px, 200% zoom, Arabic RTL and long translations; keyboard order/names, no nested controls, focus during refresh; pause persistence and hidden-tab pause; live reduced-motion change fully static.                                            |
| Browser layout          | Reserve stage and prompt area before hydration; source load/failure/dismiss, digit change and translation do not move hero actions. Attribute layout shifts to the mascot/hero section; report unrelated shell shifts separately. Prove the assertion catches an intentional shift. |
| Existing gates          | Locale parity and copy rules, spec registry/index, typecheck/lint, server/tooling/UI projects, generated files, production build. Preserve existing dashboard journeys and visual capture conventions (ADR 0016).                                                                   |

Delete/revoke between loading and activation: existing destination reauthorizes and may return not-found; clear stale prompt on refresh, never disclose the hidden title. Empty all families shows the neutral empty message and chat control. Source error shows the partial-data message and explicit retry; no automatic repeated error announcements. Losing all dashboard data uses the existing route error panel, not the empty state.

## Risks & Impact Review

Design-only risk remains medium: no auth, tenancy, schema, CI/config or runtime contract changes occur here. Future recipient/trip queries, chat context and location transmission require their own security/tenancy assessment and approval before claim; `ready` on this design does not grant that approval. In particular, general tenant scoping does not prove trip readability or notification recipient ownership.

The ranking and seven-day windows are reversible product defaults, not a guarantee that every important event is detected. Slice 1 is intentionally incomplete data; slice 2 removes that limitation within explicit bounds. Nearby/provider and real chat capabilities can remain unavailable without disabling trip navigation. Do not mark the whole interactive feature implemented until all requested families and the chat integration have evidence.

Compatibility: existing routes and server-function fields retain meaning; new fields are optional for old clients and new clients tolerate absence for one release under `BACKWARD_COMPATIBILITY.md`. No schema or dependency addition is authorized. Rollback removes dashboard consumers; old fields, notification read state and actual Reminder delivery remain intact. Suppression is disposable local UI state. No server or browser coordinate retention needs a backfill or cleanup migration.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                         | Applied default                                                                                                                                     | Why                                                                                                                                                    |
| --- | ---------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | One specification or separate designs per capability?            | One dashboard interaction policy, separately useful implementation slices; no tickets before human design merge.                                    | Independent product/UX specialist, high confidence: selection, suppression and launch share one owner; splitting documents would defer their contract. |
| 2   | Event eligibility, ranking and repeat behavior?                  | Seven-day windows, confirmed reservations, scoped unread notifications, explicit future itinerary adapter; today first; dismiss occurrence for 24h. | Independent product/UX specialist, high confidence: deterministic bounded rules provide relevant actions without a parallel Reminder system.           |
| 3   | Does the dashboard already contain every event and notification? | No; initial subset is explicit and later query filters before limits. Only scoped notification list is recipient-safe.                              | Specialist verified five-reservation cap and generic repository limitation against `dashboard.ts`, `reservations.ts`, `notifications.ts`.              |
| 4   | Chat contract and availability?                                  | Optional internal open-or-focus adapter, minimal authorized entity id, 10s bounded attempt and usable inbox fallback.                               | Independent product/UX specialist, high confidence: no existing AI backend was found and a second one is out of scope.                                 |
| 5   | Location defaults and provider?                                  | Explicit one-time opt-in only with approved adapter; two-decimal coordinates, 5km/3 results, 15min memory; provider/transmission approval separate. | Independent product/UX specialist, high confidence: avoids background tracking and assumes no commercial/provider authorization.                       |
| 6   | Art, motion and empty hero?                                      | Retain original Nomi plan and hidden art without trip; reserve a separate prompt row including empty hero.                                          | Specialist requires original SVG/CSS and no overlap; retaining hidden art preserves the plan's empty composition while keeping controls useful.        |

## Architectural review

An independent fresh-context reviewer requested changes: the initial draft called the five-reservation subset authorized without checking its parent Trip. Corrected Phase 1 to require a matching readable, non-archived loaded TripCard and to omit unknown matches; Phase 2 still owns complete server projection. The same reviewer rechecked the correction and returned **approve**, with no remaining blocking scope or contract findings. No runtime security fix is claimed. Review covers design coherence and repository contracts, not browser behavior or provider integrations.

## Phasing

1. **Dashboard interaction shell:** original Nomi, positively matched readable/non-archived Trip reservation-subset prompt, suppression, accessible chat unavailable panel, motion/copy/layout verification. Useful without future services; not completion of all #1316 behavior.
2. **Authorized event coverage:** recipient notifications and bounded reservation/itinerary projection. Depends on slice 1's selector/UI contract. Security/tenancy approval required for the data-access diff. Independently useful with chat and location unavailable.
3. **Nearby suggestions:** consent, bounded provider adapter and privacy-approved integration. Depends on slice 1, provider/security approval and a supported place destination; does not depend on chat. Without that dependency it stays unavailable and is not represented as delivered.
4. **Real AI chat integration:** future chat capability verified against pinned stack, availability and open-or-focus contract. Depends on slice 1 and the actual supplying service, not an invented issue number; notifications and nearby work without it.

## Implementation Plan

### Phase 1 - useful dashboard interaction

- **Step 1:** Write failing pure tests for decorative bands, reservation subset selection/ranking and suppression, including injected date/instant boundaries and positive readable/non-archived Trip matching. Reject reservations with no matching loaded TripCard. Implement one `mascot-state` owner; preserve existing hero data and countdown behavior.
- **Step 2:** Write component tests using a fake chat adapter, including unavailable and timeout/late-result states. Add original SVG/CSS, separate semantic controls, reserved prompt area and safe storage handling. No live chat backend.
- **Step 3:** Add rendered copy to all 23 locales and copy-rule file coverage. Verify browser keyboard, both themes, mobile/RTL, pause/reduced motion and local layout stability with an intentional failing shift probe. Preserve dashboard baselines via repository-native capture tooling.

### Phase 2 - complete bounded event sources

- **Step 4:** Obtain the data slice's security/tenancy approval; write failing repository-interface tests for other tenants, recipients and unreadable trips plus filter-before-limit. Add bounded projections through repos and Zod-validated server functions; preserve old DTOs and route authorization.
- **Step 5:** Map real itinerary items without a new Event table. Test timezone/DST normalization, ranking, all empty/error states and refresh focus. Connect the new optional candidate projection; omit missing families on old responses.

### Phase 3 - explicit nearby lookup

- **Step 6:** Verify the actual provider/endpoint, terms, attribution, retention, logging and supported internal destination; obtain independent security/privacy approval. Do not add a package without a separate approved stack decision. Write fake-boundary tests for consent, denied/unsupported/offline/expired and late-result states first.
- **Step 7:** Implement one-time approximate lookup with validated limits, no persistent coordinates and approved notice/copy in all locales. Browser-check that navigation, scope switch and opt-out erase memory and that the remaining dashboard remains useful on failure.

### Phase 4 - actual chat service

- **Step 8:** Identify and verify the separately supplied chat capability; record its real dependency reference when it exists. Write integration tests for authorized context, open/focus, repeated input and cancellation/timeout. Wire the adapter without widening payloads or introducing a second backend.
- **Step 9:** Run cross-family browser journeys and full validation gate. Record implemented PRs against this spec only as phases actually land; no decorative-only completion claim. A person merges this design PR before implementation slicing.
