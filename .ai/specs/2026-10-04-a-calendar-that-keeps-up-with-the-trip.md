# A calendar that keeps up with the trip: a one-off download and a live subscription

| Field              | Value                                        |
| ------------------ | -------------------------------------------- |
| **Status**         | ready                                        |
| **Issue**          | none                                         |
| **Spec PR**        | none                                         |
| **Implementation** | none                                         |
| **Plan**           | 06-S5 (docs/plans/06-documents-and-media.md) |

## 📝 TLDR

Plan stage `06-S5` closes reference row `DOC-07` (`absent` → `done`). A traveller can put a trip in the
calendar app they already live in, in two ways. **A download**: one `.ics` file, a snapshot of the trip
as it is now, no account and no decision. **A subscription**: a private link a calendar app polls, so the
trip keeps itself current; one link per trip, and one for "every trip I am on in this workspace". Both come
from one pure calendar builder, so a snapshot and a feed can never disagree about what a trip contains.

A subscription link is a **bearer credential**: whoever holds the URL reads the places, times, addresses
and notes of the trips it covers, with no account. So the stage is built around that fact: the secret is
stored only as a SHA-256 digest, the link is shown once, rotating and turning off are as reachable as
copying, every failure is the same byte-identical `404`, and the person who owns the link is re-checked
(workspace membership, ban, trip readability) on **every** fetch.

Four phases, each usable on its own and built one after the other: the download (Phase 1), the live
per-trip feed with its storage, resolver, route and dialog (Phase 2), rotation (Phase 3) and the
workspace feed (Phase 4). The browser evidence the stage owes is written with the phase that ships each
behaviour.

This spec describes the work that is **left** at HEAD (`e75063c7`). It departs from the plan's stage
block in several places, because the plan was written before ADR 0007 made trips private to their
members, before ADR 0016 retired the visual gate, and before it was measured against `docs/SPEC.md` §5/§6
and `docs/ACCESS.md` §3. The two that matter most are stated first, because following the plan would have
been a defect, not a style choice:

- The plan argues that "workspace membership, not trip membership, is this product's read boundary" and
  builds the workspace feed from every non-archived trip in the workspace. **That is stale.** ADR 0007
  scopes every trip read to the trip's members (and to the whole workspace only when
  `visibility = 'organization'`); `requireTrip` and `listTrips` go through `readableTrips`
  (`src/server/repos/trips.ts:255-300, 389, 607`). A feed built the plan's way would put colleagues'
  private trips into a stranger's calendar. The workspace feed here carries **the trips its owner is a
  member of**, and nothing else.
- The plan's unscoped token resolver is a **third unscoped-SQL exception** to `docs/SPEC.md` §5/§6, which
  state that list as closed at two ("a third one is a change to this contract"). The plan did not know.
  This stage amends the contract in the same change that needs it (Phase 2).

Every other departure is a row of the Resolved assumptions table.

## 📝 Problem Statement

What a traveller can do today: nothing. `grep -rn "text/calendar\|BEGIN:VCALENDAR" src` finds file-type
mappings and test fixtures; `src/server/queue/ics.ts` is an `.ics` **reader** for booking imports and there
is no writer. A trip's plan lives only inside planned.travel; to know on Tuesday whether the museum is at
09:00 or 11:00 the traveller opens the app, and a hotel check-in time, a flight and a dinner booking are
three places to look and none of them is the phone's calendar.

The reader this serves: a traveller who plans in planned.travel and lives in Google, Apple or Outlook
calendar, and a travelling companion who never opens planned.travel at all but wants the plan on their
phone. The one-off download is for a person who wants a file (to attach, to import once); the subscription
is for a person who wants the calendar to follow the plan as it changes.

What exists and is reused, measured at HEAD:

- Every row a calendar needs is already readable through tenant-scoped repository handles:
  `daysRepository`, `dayAssignmentsRepository`, `dayAccommodationsRepository`, `placesRepository`,
  `reservationsRepository`, `transportsRepository`, `transportLegsRepository`, `dayNotesRepository`
  (`src/server/repos/{days,itinerary,places,reservations,transports}.ts`). No table is read that is not
  already read elsewhere.
- Times are stored as local wall-clock text (`HH:MM`) and dates as `YYYY-MM-DD`
  (`day_assignments.start_time`, `reservations.start_date`/`start_time`, `transports.departure_*`).
  Transports and legs carry an IANA zone (`departure_timezone`, `arrival_timezone`, `transport_legs.from_timezone`,
  `to_timezone`). **Places have no time zone.** `trips.timezone` is nullable free text (`shortTextSchema`).
- `readableTrips(scope)` is the only door for a trip read on a person's behalf (ADR 0007), and
  `memberTripIds(scope, userId)` is the repository's own answer to "the trips I am on"
  (`src/server/repos/trips.ts:335-367`).
- Routes under `src/routes/api/**` are reached with no session and no CSRF check (`src/start.ts` filters
  the CSRF middleware to `handlerType === 'serverFn'`). `src/routes/api/tiles/$.ts` is the precedent for a
  `server: { handlers }` route that calls a pure `serve*(request, runtime)`.
- `APP_URL` is read by `appUrl()` (`src/server/auth/env.ts`); the `KV` binding exists; `CopyValue` and
  `ConfirmDialog` exist in `src/components/modules/shared`.

What is missing, and what the plan said was somebody else's:

- **No `calendar_feeds` table, no migration** (latest: `drizzle/0015_low_may_parker.sql`). The plan assigns
  the table to `00-foundations.md`; wave 0 is long past and nothing created it.
- **No digest helper and no resolver.** The plan imports `hashShareToken` from `07-S6`, which has not
  landed: `share_links.token` is stored in plaintext (`schema.ts:1752-1773`) and no module resolves a token
  to a tenant.
- **No `src/server/public/`**, the directory `docs/SPEC.md` §6 and `docs/ACCESS.md` §3.7 name as "the only
  sessionless read path".

## 📝 Proposed Solution

### What the stage owns and what it does not

Owns: the iCalendar **writer** and the pure calendar builder; the `calendar_feeds` table and its
repository; the one session-less route and its handler; the dialog; the amendments to `docs/SPEC.md` §5/§6
and `docs/ACCESS.md` §3 that the route requires.

Does not own: share links (`07-S6`; they keep their plaintext token and their own resolver, which needs its
own amendment or may adopt this stage's), per-place time zones (`11-S3` decides the geocoding provider
first; this stage adds no `places.timezone`), the PDF export (`06-S3`), reminders or `VALARM` alarms,
two-way sync, and RSVP. `src/server/queue/ics.ts` is not edited.

### Phases

The stage is cut into four slices, each a complete thing a traveller can use, built in order. They share
files (`feed.ts`, `calendar-panel.tsx`, `calendar-feeds.ts`), so they are serial, not parallel.

| Phase | Slice id | Traveller can…                                                           | Needs a table / route / amendment |
| ----- | -------- | ------------------------------------------------------------------------ | --------------------------------- |
| 1     | `06-S5a` | download the trip as an `.ics` file                                      | no                                |
| 2     | `06-S5b` | subscribe to one trip, and turn the subscription off                     | yes, all three                    |
| 3     | `06-S5c` | replace a link they lost or leaked, without turning the subscription off | no                                |
| 4     | `06-S5d` | subscribe to every trip they are on in the workspace with one link       | no                                |

#### Phase 1 (06-S5a) — the download

The whole calendar model, and the one phase with no security surface, so it is first: it fixes what a
trip **means** as events before anything publishes it.

**`src/server/calendar/ics.ts` — the writer** (pure, no I/O, no repository import). Folding at 75
**octets** (never inside a UTF-8 sequence), CRLF line ends, text escaping (`\\`, `\;`, `\,`, newline →
`\n`), `DATE` and `DATE-TIME` value forms, one `VCALENDAR` with `PRODID:-//planned.travel//Calendar//EN`,
`VERSION:2.0`, `CALSCALE:GREGORIAN`, `METHOD:PUBLISH`, `X-WR-CALNAME`, and the refresh hints
`REFRESH-INTERVAL;VALUE=DURATION:PT1H` and `X-PUBLISHED-TTL:PT1H`. It is the inverse of
`src/server/queue/ics.ts` and shares no code with it; the test round-trips its output through the existing
reader (`unfoldIcsLines`, `unescapeIcsText`, `parseIcsProperty`, `parseIcsDate`), which is the strongest
cheap check available.

**`src/server/calendar/zone.ts` — local time to an instant** (pure). `zonedToUtc(date, time, zone)` turns a
stored wall-clock time and an IANA zone into a UTC instant with `Intl.DateTimeFormat(..., { timeZone,
timeZoneName: 'longOffset' })` (numeric offsets `GMT+09:00`, never names, so workerd and WebKit cannot
disagree, SPEC §9 rule 5; this module runs only in the Worker). A time that does not exist (spring-forward
gap) takes the offset in force just before the gap; a time that happens twice (autumn overlap) takes the
first occurrence. A zone `Intl` rejects (`RangeError`) is treated as no zone.

**`src/server/calendar/feed.ts` — the builder** (pure over an in-memory `FeedSource`; no SQL).
`buildCalendar(source, { name })` returns the iCalendar text. It is what the download, the per-trip feed
and the workspace feed all call, so there is one answer to "what is in a trip's calendar".

**`src/server/repos/calendar-feeds.ts` — `readFeedSource(scope, tripIds)`** in this phase. It reads the
trips through `readableTrips(scope)` (a trip the caller may not read is simply absent) and then **one
statement per table for the whole set** (`inArray(table.tripId, ids)` on the existing repository handles):
days, stops, stays, places, reservations, transports, legs, day notes. Eight statements however many trips
(cap: 50 trips, so 50 ids plus the tenant stays under `MAX_BOUND_PARAMETERS` = 100), not eight per trip.
A feed is polled by every device that subscribed, and per-trip loops multiplied by a poll rate are how a
cheap feature becomes a bill.

**`src/server/fns/calendar.ts` — `downloadTripIcsFn`** (`GET`, `{ tripId }`): `appScope()`, `requireTrip`,
`readFeedSource(scope, [tripId])`, `buildCalendar`, and a raw `Response` (`text/calendar; charset=utf-8`,
`content-disposition: attachment; filename*=UTF-8''<trip slug>.ics`, `cache-control: private, no-store`),
the shape `downloadTripFileFn` already uses.

**`src/components/modules/files/calendar-panel.tsx`** (new), mounted on `files.tsx` under its own
"Calendar" card: one action, **Download .ics**, with a sentence saying it is a snapshot that does not
update. The panel exists from Phase 1 and later phases add to it.

**What the calendar contains.** An event exists when **its own date is known**; a trip with no dates still
carries its dated reservations and transports, and an undated stop (no `days.date`) produces nothing.
The privacy rule is `docs/ACCESS.md` §3.1's, applied to the one surface that crosses the same line: **no
confirmation number, booking reference, seat, price, provider URL, participant, email or file is ever
emitted**, and nothing names the workspace. A projection that never selects a field cannot leak it.

| Event                    | From                                                                                                                              | Form                                                                                                     |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| The trip                 | `trips.start_date`..`end_date` (inclusive), title, summary                                                                        | all-day `DATE`; `DTEND` is the end date plus one day (exclusive)                                         |
| A stop with a start time | `day_assignments` + place (name, address) + its note; end from `end_time`, else `duration_minutes`, else the place's duration     | timed; `LOCATION` is the address                                                                         |
| A day summary            | a day that has a title, a day note or untimed stops                                                                               | all-day; title is `days.title`, else `<trip title> · <n>`; description lists untimed stops and day notes |
| A stay                   | `day_accommodations`: name, address, check-in/out times in the description                                                        | all-day, start day to end day, `DTEND` exclusive = the end day (check-out morning is not a night)        |
| A leg or a transport     | a transport **with legs** emits its legs only, each in its own zone; one without legs emits itself from `departure_*`/`arrival_*` | timed, UTC instants; the departure date falls back to the departure day's date                           |
| A reservation            | `reservations` with a start date that is **not linked** to a stop, a transport or a stay                                          | timed when it has a time, else all-day                                                                   |

A reservation **linked** to a stop, a transport or a stay is carried by that record, so one booking is one
event. When the linked record has no time of its own and the reservation has one, the record's event takes
the reservation's date and time: a booked time is never lost to the link. `cancelled` reservations and
transports produce no event (a live feed then removes the event on the next poll). `confirmed`/`completed`
emit `STATUS:CONFIRMED`; `pending`/`none`/`idea` emit `STATUS:TENTATIVE`.

**Time form.** A timed event is anchored to its record's own zone when it has one (legs, transports). A
stop or reservation has none, so it takes `trips.timezone` when that is a valid IANA zone and is emitted as
a UTC instant, consistent with the transports around it in any reader's zone. With no valid trip zone it is
emitted as a **floating** local time (no `Z`, no `TZID`): the reader's calendar shows the planned clock
time wherever the reader is, which is right for the traveller on the trip and never moves a 09:00 museum
visit to 09:00 UTC. `DTSTART` and `DTEND` of one event always use the same form. **No `VTIMEZONE`
component is ever written**: hand-rolling daylight-saving rules would put a wrong offset on exactly the
days people travel, and a UTC instant cannot be wrong about an offset it does not carry.

**Identity.** `UID` is `<kind>-<rowId>@planned.travel` (`trip`, `stop`, `day`, `stay`, `leg`, `transport`,
`booking`), derived from the row and never from the feed, so a client updates an event in place and a link
rotation moves nothing. `DTSTAMP` and `LAST-MODIFIED` are the source row's `updated_at`, not the request
time, so an unchanged event is byte-identical on every poll.

**Text.** The feed has no session and so no locale, and a calendar app shows dates in its own language.
Event text is therefore the traveller's own words only (titles, place names, addresses, notes); the one
fallback, a day without a title, is `<trip title> · <n>`. No English label is invented inside the feed.

**Evidence, written with the phase** (Phase 1): `ics.test.ts`, `zone.test.ts`, `feed.test.ts` and
`calendar-feeds.test.ts` (read side) below; the panel test; and the browser check that the download action
is present on `/trips/$tripId/files` and answers `text/calendar`.

#### Phase 2 (06-S5b) — one trip, live

**Storage — `calendar_feeds`** (this stage adds it; `src/server/db/schema.ts` is an owned path for exactly
this table, and the migration is generated by `pnpm db:generate`, never hand-edited):

| Column                    | Type                                    | Null     | Meaning                                                           |
| ------------------------- | --------------------------------------- | -------- | ----------------------------------------------------------------- |
| `id`                      | `pk()`                                  | not null | `newId()`                                                         |
| `organization_id`         | `orgRef()`                              | not null | leading column of every index; `on delete cascade` as every table |
| `user_id`                 | `userRef('user_id')`                    | not null | whose feed it is; its contents are resolved as this person        |
| `trip_id`                 | `text` → `trips.id` `on delete cascade` | nullable | the trip for `scope = 'trip'`; null for `workspace`               |
| `scope`                   | `text`                                  | not null | `trip` or `workspace`, `calendar_feeds_scope_chk`                 |
| `token_digest`            | `text`                                  | not null | SHA-256 hex of the secret; the secret is never stored             |
| `revoked_at`              | `integer` timestamp_ms                  | nullable | non-null: every request answers the same `404`                    |
| `rotated_at`              | `integer` timestamp_ms                  | nullable | when the digest was last replaced                                 |
| `last_served_at`          | `integer` timestamp_ms                  | nullable | the access log, in one column                                     |
| `created_at`/`updated_at` | `timestamps()`                          | not null | house convention                                                  |

Checks: `calendar_feeds_scope_trip_chk` — `(scope = 'trip' AND trip_id IS NOT NULL) OR (scope = 'workspace'
AND trip_id IS NULL)`. Indexes: `calendar_feeds_token_unq` unique on `(token_digest)`, the resolver's only
lookup; **two partial unique indexes that enforce "one feed per person per scope" in the database**, because
SQLite treats NULLs as distinct and a repository check alone loses a race: `calendar_feeds_workspace_unq`
on `(organization_id, user_id) WHERE scope = 'workspace'` and `calendar_feeds_trip_unq` on `(organization_id,
user_id, trip_id) WHERE scope = 'trip'` (partial-index precedent: `schema.ts:3104-3107`);
`calendar_feeds_trip_idx` on `(trip_id)` for the cascade. Additive: the previous Worker never reads the
table. No backfill. No `expires_at` and no counter column: nothing sets an expiry, and a per-request
counter would be a D1 write per poll (below).

**Secret and digest.** `src/server/calendar/secret.ts`: `mintFeedSecret()` is `nanoid(32)` (about 190
bits); `hashFeedSecret(secret)` is Web Crypto SHA-256, hex, **applied on write and on read** and imported
by nothing in `src/server/catalog/**` (the catalog module receives a digest). One-function module, unit
tested; `07-S6` may re-point to a shared helper later. An unsalted fast hash is sound because the input is
a high-entropy random secret, not a password.

**Repository — `src/server/repos/calendar-feeds.ts`.** All SQL for the feed rows, on `tenantFilter()`:

- `enableFeed(scope, { scope: 'trip' | 'workspace', tripId? })` — find-or-issue. Finds this person's row
  for that scope and, **revoked or not, re-arms that same row** with a fresh secret (clears `revoked_at`,
  sets `rotated_at`, never reinstates an old digest); otherwise inserts. Returns the secret **once**.
  `organization_id` is stamped on insert, never accepted. A trip feed runs `requireTrip` first, so a
  foreign or unreadable trip id cannot parent a row. One row per (person, scope, trip) for ever: toggling
  never grows the table, and the access log survives.
- `rotateFeed(scope, feedId)` — new secret, digest overwritten, `rotated_at` set, returned once. No
  history is kept, so the old URL stops on the next request: revocation is total, not eventual.
- `revokeFeed(scope, feedId)` — sets `revoked_at`.
- `listFeeds(scope)` / `getFeed(scope, feedId)` — the caller's own rows only (`user_id = scope.ctx.userId`),
  never a secret.
- `touchFeed(scope, feedId, now)` — one statement, `UPDATE … SET last_served_at = now WHERE id = ? AND
(last_served_at IS NULL OR last_served_at < now - 1h)`: at most one row written per feed per hour,
  however often it is polled, run in `waitUntil` so the response never waits for it.
- `openFeedScope(db, found)` — the **only** place a scope is built from a resolved feed. See below.

Managing a feed is the **owner's** and nobody else's: every function above resolves the feed id inside the
caller's scope **and** `user_id = scope.ctx.userId`, so another member's feed (same workspace) is a
`NotFoundError`, as is another workspace's.

**The third unscoped read — `src/server/catalog/calendar-feeds.ts`.** `findLiveFeedByDigest(db, digest)`
takes a plain `Database`, because until the row is found there is no tenant: the row **is** the tenant
resolution. It is shaped exactly like `listDueTripReminders` (`src/server/catalog/reminders.ts`): session-less,
**projection-only** (`{ id, organizationId, userId, scope, tripId }`, never content), a point lookup on
`calendar_feeds_token_unq`, `null` for a revoked row, no import from `src/server/repos/**`
(`src/server/catalog/__tests__/isolation.test.ts` walks every module under `catalog/` and picks the new
file up without an edit). **`docs/SPEC.md` §5 and §6 are amended in this phase**: the closed list becomes
three, the "twelve names"/"eleven names" counts are made consistent (§5 lists twelve tables; §6 and the
`reminders.ts` docblock still say eleven), and §6's "derived from the share record it resolved" is widened
to a feed record. `07-S6`'s share-link resolver, when it lands, needs its own amendment or adopts this one.

**The session-less handler — `src/server/public/calendar-feed.ts`** (new directory, the one SPEC §6 and
ACCESS §3.7 name). `serveCalendarFeed(request, runtime)` holds no SQL and **constructs no scope** (ACCESS
§3.7 rule 2; it calls `openFeedScope`). In order:

1. Method is `GET` or `HEAD` (`HEAD` gets the headers and no body); anything else is `405`.
2. The path is `/api/feed/<secret>.ics`; the secret must match `^[A-Za-z0-9_-]{32}$` **exactly**, else the
   not-found response, before any hash, lookup or KV call. Nothing in the path or query is read as an
   id, a trip id or an organization id.
3. Rate limit (ACCESS §3.6, below), then `findLiveFeedByDigest(db, hashFeedSecret(secret))`.
4. `openFeedScope(db, found)` builds a provisional least-privileged scope from the **row's own**
   `organizationId` and `userId`, asks one question with it (the owner's `member` row **and** that they
   are not banned: `user.banned` with no unexpired `ban_expires`, one tenant-scoped join), and only then
   builds the content scope with the **live** role read from `member`. No `member` row, a ban, or a role
   outside `ORGANIZATION_ROLES` is the not-found response. This one indexed read is the whole of
   offboarding: `removeMember` deletes only the `member` row and leaves `trip_members` rows that
   `readableTripFilter` trusts, so without it a person who left the workspace would still read their old
   private trips through an old URL; and a ban leaves the `member` row in place. It is a **deny, not a
   revoke** — nothing is written, so a person removed by mistake and re-added has their devices working on
   the next poll with no new link.
5. Content is `readFeedSource(scope, …)` then `buildCalendar`. A trip feed is `readFeedSource(scope,
[feed.tripId])`: a trip the owner can no longer read (a **private** trip they were removed from) yields
   no trip and is the not-found response, exactly as it would be on their screen; an `organization`-visible
   trip keeps serving, also exactly as on their screen. An archived trip keeps serving a trip feed (the
   person turned it on); the workspace feed leaves archived trips out.
6. The only write a visit can cause is `touchFeed`, in `waitUntil`.
7. **A session on the request is ignored**: pasting the URL into a logged-in browser returns the same
   bytes as a calendar app gets. A token upgraded by the reader's own session would return different bytes
   to different readers of one URL, which is not a feed.

**One response for every refusal.** Unknown, malformed, revoked, rotated-away, owner-removed, owner-banned
and trip-unreadable are **one `404`**: the same status, headers and body (`text/plain; charset=utf-8`,
`Not found`), byte for byte, because a difference is information about somebody's trip. A failure inside
resolution (a corrupt row, a thrown error) maps to the same `404`, never a `500` that pages nobody and
leaks nothing. The body is not a catalogue key: no traveller reads it; it is the status text of a machine
client (SPEC §9 rule 10's exception is for refusals that reach a screen).

**Success headers**: `200`, `content-type: text/calendar; charset=utf-8`, `cache-control: private,
no-store`, `x-robots-tag: noindex, nofollow` (ACCESS §3.5), `referrer-policy: no-referrer`,
`x-content-type-options: nosniff`. `robots.txt` does not `Disallow` the path, for ACCESS §3.5's reason.

**Rate limiting is ACCESS §3.6's, not a new design**: per feed (`public:rl:<v>:tok:<sha256>`, 60/min), per
IP across public routes (120/min) and per IP for failed resolutions (20/min), KV counters with a 60 s TTL;
over budget is `429` with `Retry-After`; **KV unavailable fails open, token resolution never does**.
`src/server/public/rate-limit.ts` is the one implementation of those three budgets (its first caller is
this route; `07-S6` is its second), written to the `RateCounterStore` shape `src/server/metering/rate.ts`
already states, with the same honest note that KV has no atomic increment. A probe costs up to two KV
writes; ACCESS §3.6 accepts that for the protection it buys, and a flood below the edge is a Cloudflare
zone rule, outside this repository. The per-poll cost of a **valid** feed is: one D1 point read, one
membership/ban read, eight content reads, at most one `touchFeed` write per hour, and its KV counters.

**The route — `src/routes/api/feed/$.ts`** (a new route file, so `pnpm generate-routes` runs and the
regenerated `src/routeTree.gen.ts` travels in the diff; it is never hand-edited). It declares only
`server: { handlers: { GET, HEAD } }`, following `src/routes/api/tiles/$.ts`, and calls
`serveCalendarFeed`. **An SSR loader never fetches its own server route**: the route and the server
functions both call the modules and neither calls the other.

**Secrets never leave the Worker in telemetry.** The secret is in the URL path, and `src/lib/sentry-scrub.ts`
strips the query string but keeps the path, so any Sentry event from this route would carry a live secret
(and `pnpm sentry-triage` copies production data into GitHub). `scrubEvent` is extended to redact the
`/api/feed/<segment>` path to `/api/feed/[redacted]`, with a test; the handler logs the feed **id** and
never the path or the secret.

**Server functions — `src/server/fns/calendar.ts`**, all starting `appScope()`; Zod v4 `z.strictObject`
with trimmed, bounded ids:

| Function               | Method | Input                               | Returns                                                                       |
| ---------------------- | ------ | ----------------------------------- | ----------------------------------------------------------------------------- |
| `loadCalendarFeedsFn`  | GET    | `{ tripId }`                        | the caller's feed state for this trip: on/off, `lastServedAt`; never a secret |
| `enableCalendarFeedFn` | POST   | `{ tripId }` (Phase 4 adds `scope`) | `{ url, webcalUrl }` — the secret, once                                       |
| `revokeCalendarFeedFn` | POST   | `{ feedId }`                        | `{ revoked: true }`                                                           |

(`rotateCalendarFeedFn` is Phase 3.) The absolute URL is built from `appUrl()` only, never from a request
header: a link built from a spoofable `Host` is a link an attacker can point at their own origin.

**The dialog (`calendar-panel.tsx`).** "Subscribe in your calendar" opens a `Dialog`. **Before** any link
exists the empty state is the decision itself, not an illustration: one warning sentence ("Anyone with this
link can read this trip's places, times, addresses and notes, with no account. Share it like a password."),
tied to the **Create a link** button with `aria-describedby` so it is read before the action. After
enabling, the dialog shows the link **once** with three hand-offs from the same in-memory secret — an
"Open in your calendar app" `webcal://` link, **Copy link** (`CopyValue`), and the raw `https://` URL in
an inset, wrapping, scrollable well — and says in words that it is shown only once and that a lost link is
replaced, not recovered. The secret is not stored (only its digest), so a reopened dialog shows state
("Subscription is on", "Last fetched …") and **Turn off**; **it cannot show the link again**. That is a
deliberate cost of "a leaked database row must not yield a working URL", paid in copy rather than hidden;
Phase 3 gives the replacement. **Turn off** sits behind a `ConfirmDialog` that says what stops. The dialog
also says, once, that calendar apps check every few hours so an edit can take a while to appear, and that
times show as planned at the local clock time.

States: _empty_ is the decision above; _loading_ is a two-row `Skeleton` at the control's exact height so
nothing reflows when state lands; _error_ is an `Alert` with the reason and a retry, and a failed
enable/turn-off **clears any link on screen** (a link that may or may not work is worse than none);
every action carries `loading` and the others are `disabled` for that window.

**Also in this phase**: a `CONTEXT.md` entry **Calendar feed** (a session-less, owner-bound, read-only
calendar of the trips named by a link; revocable; distinct from a Share token, which names one trip
resource) and `docs/ACCESS.md` §3 gains a visible / never-visible table for the feed (visible: trip title
and dates, stop names, addresses, times and notes, day titles and notes, stay names and addresses,
reservation and transport titles, places and times; **never**: confirmation numbers, booking references,
seats, prices, provider URLs, participants, emails, user ids, workspace identity, files, other trips'
data), a §3.5 line for the `noindex` header, §3.6's note that the feed uses those budgets, and who may
rotate or revoke (only the person whose feed it is; a workspace owner's remedy for a member's leaked link
is removing the member or taking them off the trip — see Out of scope).

#### Phase 3 (06-S5c) — a new link

`rotateFeed` plus `rotateCalendarFeedFn` (`POST`, `{ feedId }`, returns `{ url, webcalUrl }` once) and a
**Make a new link** action behind a `ConfirmDialog` that says what breaks: every calendar already
subscribed stops updating until it is given the new link, and the old link stops at once. After rotation
the dialog shows the new link exactly as after enabling. UIDs are unchanged by rotation, so a re-subscribed
calendar updates its events instead of duplicating them. Evidence: a vitest case that the old digest no
longer resolves and the new one does; the browser journey below.

#### Phase 4 (06-S5d) — every trip I am on

The dialog gains a second tab ("My trips") for `scope = 'workspace'`; `enableCalendarFeedFn` accepts
`scope: 'trip' | 'workspace'` (`z.enum`).

**What a workspace feed carries — decided here, once.** Exactly the trips its owner is a **member of**,
not archived, up to **50**, newest start date first (undated last): `readableTrips(scope).findMany` with
`inArray(trips.id, memberTripIds(scope, scope.ctx.userId))` as a **sub-select** (never a materialised id
list, which `MAX_BOUND_PARAMETERS` would refuse for a traveller with a few hundred lifetime trips), in
`readFeedSource`. It is re-evaluated on every fetch, so joining a trip adds it and leaving it removes it.
There is no "ended more than N days ago" cut-off: archive is the exit a traveller already controls
(`CONTEXT.md`, **Archive**), and silently dropping a trip from a calendar deletes it from the subscriber's
history. A trip the person may read through `visibility = 'organization'` but is not on is **not** in the
feed (it is a trip they _may_ open, not one they are travelling on; ADR 0007, `memberTripIds`'
docblock); its own per-trip feed still serves it. This keeps the credential's blast radius to the
traveller's own trips, and widening a feed later is a change to one read, while a leak cannot be undone.
Someone in two workspaces subscribes twice: merging them would be the first row in the product whose
contents cross a tenant boundary.

The dialog states the scope in those words ("Every trip you are on in this workspace that is not archived,
up to 50, newest first. New trips appear on their own.") above the enable control, tied to it with
`aria-describedby`.

### Alternatives considered, and why they lost

- **The plan's workspace feed (every non-archived trip in the workspace).** Rejected: contradicts ADR 0007
  and would publish private trips. The corrected "every trip I am on" won over "every trip I may read"
  (what `listTrips` returns) because a leaked link then exposes fewer trips and widening later is cheap.
- **A stateless signed token (HMAC) with no row.** Cannot be rotated per person, revoked, or counted, and
  cannot say "last fetched". A table is the smaller thing.
- **Storing the secret encrypted so the dialog can show it again.** Better recovery, but a key to manage and
  a database row that can yield a working URL once the key leaks. The plan chose digest-only on purpose and
  this spec keeps it; the cost is paid in copy and Phase 3.
- **The organization id in the URL so a scope can be built without an unscoped query.** Builds a scope from
  an unauthenticated claim (ACCESS §3.7 rule 2) and puts a tenant id in a URL anyone can read.
- **A `VTIMEZONE` block per event.** Hand-rolled daylight-saving rules are a wrong-by-an-hour bug waiting on
  the days people travel; UTC instants and floating local times are correct by construction.
- **A localised feed.** Reading the owner's locale on every poll for one fallback title next to a date the
  calendar already shows in its own language; adding labels later is additive, and stable UIDs let clients
  update in place.

## 📝 Architecture

| Concept                                             | Owner module                                                                                       |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| iCalendar text: folding, escaping, value forms      | `src/server/calendar/ics.ts` (pure writer)                                                         |
| Wall-clock time + zone → instant                    | `src/server/calendar/zone.ts` (pure)                                                               |
| What a trip means as events; the privacy projection | `src/server/calendar/feed.ts` (`buildCalendar`, pure over a `FeedSource`)                          |
| Minting and digesting a secret                      | `src/server/calendar/secret.ts`                                                                    |
| Feed rows, the trip set, the batched content read   | `src/server/repos/calendar-feeds.ts` (all tenant-scoped SQL; builds the scope for a resolved feed) |
| Token digest → tenant (the third unscoped read)     | `src/server/catalog/calendar-feeds.ts`                                                             |
| Session-less request handling, the three budgets    | `src/server/public/calendar-feed.ts`, `src/server/public/rate-limit.ts`                            |
| The HTTP contract                                   | `src/routes/api/feed/$.ts` (declares `server` only)                                                |
| The app's reads and writes                          | `src/server/fns/calendar.ts`                                                                       |
| The dialog                                          | `src/components/modules/files/calendar-panel.tsx`                                                  |

**Dependency direction.** `calendar/*` imports nothing from `repos/`, `catalog/` or `public/`. `catalog/`
imports nothing from `repos/`. `public/` imports `catalog/` and `repos/` and builds no scope and holds no
SQL. `fns/calendar.ts` and `public/calendar-feed.ts` both call `repos/calendar-feeds.ts` and
`calendar/feed.ts`; neither calls the other. `components/ui` is untouched and never fetches.

## 📝 Data Model

One new table, `calendar_feeds`, specified in Phase 2, with the migration generated by `pnpm db:generate`.
It stores one small row per person per scope per trip and **no bytes**: the response is built per request
and never persisted, so there is nothing to expire or sweep. Rows go with their trip
(`ON DELETE CASCADE`) and with their workspace (`organization_id` cascade). **Account deletion** removes the
`member` row by cascade, which makes the feed answer `404` at once, but leaves the row (`user_id` is a
`userRef()` with no foreign key, `schema.ts:154`); it is inert, holds a digest and a date, and is listed
under Out of scope.

## 📝 API Contracts

| Surface                                  | Contract                                                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `GET`/`HEAD /api/feed/<secret>.ics`      | `200 text/calendar` or the one `404`; `429` + `Retry-After`; `405` for other methods; session ignored |
| `downloadTripIcsFn`                      | raw `Response`, the same body the feed would serve for that trip                                      |
| `loadCalendarFeedsFn`                    | state only, never a secret                                                                            |
| `enable`/`rotate`/`revokeCalendarFeedFn` | the secret is returned once, by the two that mint one                                                 |

**Authorisation.** In the app: `appScope()`, then `requireTrip` for a trip, and a feed id resolved only
inside the caller's scope **and** as the caller's own row. On the HTTP contract: the secret, and only the
secret, re-checked against live membership, ban and trip readability on every request. **Viewers may
create a feed for a trip they can read**: a feed is a read, and it grants nothing the viewer's own screen
does not (the files functions' separate viewer-write gap is not this stage's and is not widened).

**Quota.** A `calendar_feeds` row is bounded by construction (one per person per trip plus one per person
per workspace, enforced by two partial unique indexes), and a tenant cannot grow it independently of
`trips` and `members`, both already metered. No metric is added to `resolveLimits()` or `PLAN_QUOTAS`, no
`assertQuota` call site, no case in `limits.test.ts`. If a later change let a person hold arbitrarily many
feeds, that bound disappears and the metric becomes necessary in the same change. The unauthenticated
endpoint's ceiling is the KV budgets above, which protect the platform and sell nothing.

## 📝 UI/UX

- **Route:** one new route file, `src/routes/api/feed/$.ts` (an HTTP endpoint, no screen, no loader);
  `files.tsx` is edited to mount the panel.
- **Components:** existing primitives only — `Dialog`, `Button`, `IconButton`, `Tabs`, `Alert`, `Skeleton`,
  `Badge`, `toast`, `CopyValue` and `ConfirmDialog` from `modules/shared`, `useAction`. One new product
  component, `calendar-panel.tsx`. No new primitive, nothing filed to foundations.
- **Keyboard and screen reader.** Focus moves into the dialog and back to its trigger on close; the
  warning is tied to the enable button with `aria-describedby`; the revealed link is a labelled read-only
  value with its own **Copy link** button and the copy confirmation is announced politely; **Make a new
  link** and **Turn off** are real buttons with names that say what they do; no state is conveyed by
  colour alone.
- **360px.** The URL wraps in an inset scrollable well with the copy action pinned, never pushing the
  dialog sideways; actions stack; the dialog is a sheet-sized layout, not a squeezed desktop one.
- **Motion.** The disclosure and dialog use `--ease-out-quint` at 150–260 ms, transform and opacity only,
  and honour `prefers-reduced-motion: reduce`.
- **Tokens.** None missing; the well is `--color-surface-inset` on `--radius-md`; "last fetched" carries
  `tabular-nums`.

## 📝 Visual change expected

Route `/trips/$tripId/files`, light and dark, 360 / 1280 / 2560 px:

- **Resting:** a new "Calendar" card with the **Download .ics** action and, from Phase 2, **Subscribe in
  your calendar**.
- **Dialog, enable step** (`data-part="calendar-subscribe"` opens it): the warning above **Create a link**,
  on `--color-surface-2`.
- **Dialog, enabled** (`data-part="calendar-enable"`): the link shown once with its three hand-offs, the
  "shown once" sentence, **Make a new link** (Phase 3) and **Turn off** side by side.
- **Dialog, "My trips" tab** (Phase 4): the scope sentence above the enable control.
- **Confirm dialogs:** make a new link; turn off.

## 📝 Copy

Every string is a catalogue key in `src/lib/i18n/messages/en/modules.ts` under `files.calendar.*` and lands
in all 23 locales in the same change (`i18n-messages` skill, the parity test). Keys (`modules.` prefix in
code):

| Key (`files.calendar.…`) | `en` text                                                                                                                   |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------- |
| `title`                  | `Calendar`                                                                                                                  |
| `description`            | `Take this trip into the calendar app you already use.`                                                                     |
| `download.action`        | `Download .ics`                                                                                                             |
| `download.hint`          | `A snapshot of the trip as it is now. It does not update.`                                                                  |
| `download.error`         | `We couldn’t prepare the file. Try again.`                                                                                  |
| `subscribe.action`       | `Subscribe in your calendar`                                                                                                |
| `subscribe.title`        | `Subscribe in your calendar`                                                                                                |
| `warning`                | `Anyone with this link can read this trip’s places, times, addresses and notes, with no account. Share it like a password.` |
| `enable.action`          | `Create a link`                                                                                                             |
| `link.once`              | `Copy it now - we show it only once. If you lose it, make a new link; the old one stops working.`                           |
| `link.open`              | `Open in your calendar app`                                                                                                 |
| `link.copy`              | `Copy link`                                                                                                                 |
| `link.address`           | `Link address`                                                                                                              |
| `freshness`              | `Calendar apps check for changes every few hours, so an edit can take a while to appear.`                                   |
| `timesNote`              | `Times show as planned, at the local clock time.`                                                                           |
| `state.on`               | `Subscription is on`                                                                                                        |
| `state.lastFetched`      | `Last fetched {when}`                                                                                                       |
| `state.neverFetched`     | `Not fetched yet`                                                                                                           |
| `rotate.action`          | `Make a new link`                                                                                                           |
| `rotate.confirmTitle`    | `Make a new link?`                                                                                                          |
| `rotate.confirmBody`     | `The old link stops working now. Calendars that use it stop updating until you give them the new link.`                     |
| `rotate.confirm`         | `Make new link`                                                                                                             |
| `off.action`             | `Turn off`                                                                                                                  |
| `off.confirmTitle`       | `Turn off the subscription?`                                                                                                |
| `off.confirmBody`        | `The link stops working now. Calendars keep the events they already have but stop updating.`                                |
| `off.confirm`            | `Turn off`                                                                                                                  |
| `error.enable`           | `We couldn’t create the link. Nothing was changed. Try again.`                                                              |
| `error.rotate`           | `We couldn’t make a new link. The old one still works. Try again.`                                                          |
| `error.off`              | `We couldn’t turn it off. The link still works. Try again.`                                                                 |
| `error.load`             | `We couldn’t load the subscription. Try again.`                                                                             |
| `tab.trip`               | `This trip`                                                                                                                 |
| `tab.workspace`          | `My trips`                                                                                                                  |
| `workspace.scope`        | `Every trip you are on in this workspace that is not archived, up to 50, newest first. New trips appear on their own.`      |

The feed's own text (event titles, notes) is the traveller's, not catalogue copy; the `404` body is a
machine status line.

## 📝 Edge Cases & Failure Scenarios

| Case                                                          | Behaviour                                                                                                               |
| ------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Unknown, malformed, wrong-length or revoked secret            | The one `404`; a wrong-length secret is refused before any hash or lookup                                               |
| Secret rotated away                                           | The old URL is the same `404` on the next request                                                                       |
| Owner removed from the workspace / account deleted / banned   | The same `404`; nothing written; re-added owner's old link works again                                                  |
| Owner removed from a **private** trip                         | That trip's feed is the same `404`; the workspace feed drops the trip                                                   |
| Owner removed from an `organization` trip                     | A trip feed keeps serving (the screen does); the workspace feed drops it (they are no longer on it)                     |
| A trip is archived                                            | A trip feed keeps serving; the workspace feed leaves it out                                                             |
| A trip is deleted                                             | The feed row cascades; its link is the same `404`                                                                       |
| Trip with no dates                                            | Dated reservations and transports still appear; stops, days, stays and the trip event do not                            |
| `trips.timezone` unset or not an IANA zone                    | Stops and reservations are floating local times; legs and transports keep their own zones                               |
| A stop at a time that does not exist / happens twice (DST)    | Offset just before the gap / the first occurrence                                                                       |
| A booking linked to a stop, transport or stay                 | One event, carried by the linked record, which takes the booking's time if it has none                                  |
| A transport with legs                                         | Legs only; never the parent as well                                                                                     |
| Cancelled reservation or transport                            | No event; the next poll removes it from the calendar                                                                    |
| 51 or more trips on a workspace feed                          | The 50 with the latest start dates; the dialog states the cap                                                           |
| KV unavailable                                                | The limiter fails open; resolution still answers or `404`s                                                              |
| Two taps on **Create a link** / a race with another tab       | The partial unique index makes one row; the second call re-arms it and returns its own new secret, the first link stops |
| `HEAD`                                                        | The same status and headers as `GET`, no body                                                                           |
| Enable fails after the row is written but before the response | The link was never shown and is replaced by the next enable; nothing is leaked                                          |
| A person pastes the URL into a signed-in browser              | The feed, not the app; the session is ignored                                                                           |

## 📝 Observability

The handler logs `calendar_feed.served` with the feed **id**, scope and duration, and
`calendar_feed.refused` with a coarse reason bucket (`unresolved`, `rate-limited`, `owner-gone`), never the
path, the secret or the digest. `scrubEvent` redacts the path for Sentry. `last_served_at` is the access
log the dialog shows.

## ✅ Acceptance criteria

1. A traveller downloads a `.ics` for a trip from `/trips/$tripId/files`; it is `text/calendar` and its
   first line is `BEGIN:VCALENDAR`.
2. The writer folds at 75 octets (not characters), escapes `\`, `;`, `,` and newlines, and its output
   round-trips through `src/server/queue/ics.ts`.
3. The calendar never contains a `VTIMEZONE`, a confirmation number, a booking reference, a seat, a price,
   a provider URL, a participant, an email, a user id or the workspace's name.
4. A 09:00 stop in a trip whose zone is `Asia/Tokyo` is `T000000Z` (00:00 UTC); across a European DST change the offset
   that applies on that date is used; an unset or invalid zone gives a floating time, not UTC.
5. A booking linked to a stop, transport or stay is one event; a transport with legs is its legs only;
   cancelled records produce no event.
6. A UID is unchanged across a rotation, and an unchanged event is byte-identical on every poll.
7. `calendar_feeds` exists, additive, with the digest unique index and the two partial unique indexes; the
   secret is stored nowhere.
8. `enableFeed` twice (and after a revoke) returns **one row**, with a different secret each time.
9. Another member's feed, and another workspace's feed, is a `NotFoundError` to read, rotate or revoke.
10. `findLiveFeedByDigest` returns `null` for a revoked row and an unknown digest, returns coordinates and
    no content, and the scope built from B's digest is B's organization.
11. `SPEC.md` §5/§6 say three, and are consistent about the table count; `ACCESS.md` §3 lists what the
    feed shows and never shows; the catalog isolation test passes with the new module.
12. The route answers `200` to a request with no session and `404` for every refusal with **byte-identical**
    status, headers and body (including `HEAD`); a wrong-length secret never reaches a hash.
13. A removed workspace member, a banned user, a private trip the owner was removed from, and a rotated or
    revoked link are each the same `404`; re-adding the member restores the link with no new URL.
14. The per-minute budgets of ACCESS §3.6 are enforced, `429` carries `Retry-After`, and a KV outage fails
    open without serving anything the resolver would refuse.
15. The secret does not appear in a Sentry event or a log line.
16. The dialog says what the link exposes before it is created, shows the link once, shows state only
    afterwards, and makes **Make a new link** and **Turn off** as reachable as **Copy link**.
17. A workspace feed contains the owner's non-archived member trips (up to 50) and **not** an
    `organization`-visible trip they are not on, nor a private trip they are not on, nor another
    workspace's.
18. All of the copy is in 23 locales and the parity test passes; the dialog is usable at 360px in light and
    dark with no layout shift after paint and a silent console.

## 📝 Risks & Impact Review

| Risk                                                         | Severity | Mitigation                                                                                                                           |
| ------------------------------------------------------------ | -------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| A bearer URL leaks (chat, screenshot, a shared device)       | High     | Digest-only storage, shown once, warning before creation, rotate and turn off as reachable as copy, `no-store`, `noindex`            |
| A private trip reaches a person who may not read it          | High     | Every content read goes through `readableTrips`; the workspace feed is member trips only; a member-isolation test                    |
| An offboarded or banned person keeps reading                 | High     | Membership and ban re-checked on every fetch; an offboarding test where `trip_members` rows survive                                  |
| A token-to-tenant lookup becomes a general cross-tenant read | High     | Projection-only, point lookup, no `repos/**` import, walked by the isolation test, SPEC amended                                      |
| An unauthenticated endpoint is probed or flooded             | Medium   | Shape check before hashing, ACCESS §3.6 budgets, fail-open limiter that never gates authorisation; the zone edge is outside the repo |
| The URL is recorded by platform logging                      | Medium   | Platform setting (Workers log URLs) is outside this repository; the app redacts Sentry and logs only the id                          |
| A poll costs more than the feature is worth                  | Medium   | Eight batched reads regardless of trip count, cap 50, at most one write per feed per hour                                            |
| A wrong offset moves an event by an hour                     | Medium   | No `VTIMEZONE`; UTC instants from numeric offsets; pinned DST gap and overlap tests                                                  |
| The lost-link cost (a link cannot be shown again)            | Low      | Said in the copy; Phase 3 replaces a link without turning the subscription off                                                       |

### Out of scope

- Reminders and `VALARM` alarms, two-way sync, RSVP, an `.ics` import round trip beyond the writer's test.
- A per-place time zone (`11-S3` decides the provider first).
- **A workspace owner or admin revoking another member's feed.** Today the remedies are removing the member
  or taking them off the trip; the implementation run files an issue for an admin "revoke this member's
  feeds" action (`afk-plan-to-spec` files no tickets).
- Sweeping `calendar_feeds` rows left by account deletion; they are inert (the resolver denies them at the
  membership read) and the implementation run files an issue for the deletion flow.
- Share links (`07-S6`) storing their token in plaintext; it is that stage's, and it may adopt
  `hashFeedSecret`.
- Edge rate limiting of unknown-token floods (a Cloudflare zone rule).
- A localised feed; stable UIDs make adding labels later additive.

## 📋 Phasing

| Phase | Slice    | Depends on | What a traveller has afterwards                      |
| ----- | -------- | ---------- | ---------------------------------------------------- |
| 1     | `06-S5a` | none       | a downloadable `.ics` of a trip                      |
| 2     | `06-S5b` | 1          | a live per-trip subscription that can be turned off  |
| 3     | `06-S5c` | 2          | a way to replace a lost or leaked link               |
| 4     | `06-S5d` | 2          | one link for every trip they are on in the workspace |

Serial, not parallel: they all edit `calendar-panel.tsx`, `feed.ts` or `repos/calendar-feeds.ts`. Phases 3
and 4 both depend only on Phase 2 and are serialised by the shared files, not by a design dependency.
Labels for the implementing tickets: `risk-high` and `security` (a bearer credential, a new unscoped read,
a schema migration, a contract amendment), so each waits for the owner's `qa-approved`.

## 📋 Implementation Plan

### Phase 1 — the download

1. `src/server/calendar/ics.ts`, `zone.ts` and their tests; `feed.ts` with `FeedSource` and `buildCalendar`
   and its tests (the event table above, the privacy projection as an explicit field whitelist, the
   linked-booking rule, legs, cancelled, undated).
2. `repos/calendar-feeds.ts`: `readFeedSource(scope, tripIds)` (readable trips, eight batched statements,
   the 50 cap) and its test file; `repos/index.ts` gains the export line.
3. `fns/calendar.ts`: `downloadTripIcsFn`; `calendar-panel.tsx` with the download action; mounted in
   `files.tsx`; `modules/files/index.ts` export; the copy keys in 23 locales.
4. Tests: the unit tests, the panel test, the tenant-isolation and member-isolation cases for
   `readFeedSource` (below), and the browser block's first test.

### Phase 2 — one trip, live

1. Schema + `pnpm db:generate` migration; `secret.ts`; `repos/calendar-feeds.ts` write functions,
   `openFeedScope`; `catalog/calendar-feeds.ts`; `docs/SPEC.md` §5/§6 amendment.
2. `public/rate-limit.ts`, `public/calendar-feed.ts`, `routes/api/feed/$.ts` and `pnpm generate-routes`;
   `sentry-scrub.ts` redaction.
3. `fns/calendar.ts`: load, enable, revoke; the dialog's enable step, enabled state, turn off; copy.
4. `CONTEXT.md` and `docs/ACCESS.md` §3; the isolation and contract tests; the browser block.

### Phase 3 — a new link

`rotateFeed`, `rotateCalendarFeedFn`, the **Make a new link** action and its confirm; copy; tests.

### Phase 4 — every trip I am on

The workspace scope in `readFeedSource`, `enableCalendarFeedFn` taking `scope`, the second tab and its
copy, the member-isolation cases for the workspace feed; tests.

## Verification

**Command gate, in order:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `bash .ai/scripts/check-generated.sh`,
`pnpm build` (`validation.commands`). Plus `pnpm db:generate` and `pnpm generate-routes` (Phase 2) before the
gate; their output travels in the diff and is never hand-edited.

**Unit tests, by file and invariant.**

- `src/server/calendar/__tests__/ics.test.ts` — folds at the octet (a multi-byte character straddling
  octet 75 is not split); escapes; `VALUE=DATE` all-day; no `VTIMEZONE`; round-trip through
  `src/server/queue/ics.ts`.
- `src/server/calendar/__tests__/zone.test.ts` — `Asia/Tokyo` 09:00 → `T000000Z`; `Europe/Warsaw` on
  2026-03-29 (gap) and 2026-10-25 (overlap); an invalid zone is "no zone".
- `src/server/calendar/__tests__/feed.test.ts` — the event table row by row; floating vs zoned; the privacy
  projection (a source row with a confirmation number, seat, price, URL and participant produces none of
  them); linked-booking de-duplication and the adopted time; legs only; cancelled; an undated trip; UIDs and
  `DTSTAMP` stable across two builds and across a rotation.
- `src/server/calendar/__tests__/secret.test.ts` — 32 characters from the URL-safe alphabet; hashing is
  deterministic and 64 hex characters.
- `src/server/repos/__tests__/calendar-feeds.test.ts` — `enableFeed` twice and after revoke is one row with
  two different digests; `rotateFeed` invalidates the old digest; `touchFeed` writes at most once per hour;
  `readFeedSource` issues eight statements for ten trips (counted) and respects the 50 cap; the workspace
  trip set (Phase 4); `openFeedScope` returns `null` for a removed member and a banned user and carries the
  live role for a demoted one.
- `src/server/catalog/__tests__/` — the existing isolation walk covers `calendar-feeds.ts`;
  `findLiveFeedByDigest` returns `null` for revoked/unknown, returns coordinates and no content, and the
  organization on the result is the organization of the digest presented.
- `src/server/public/__tests__/calendar-feed.test.ts` — through the pure `serveCalendarFeed(request,
runtime)` against the test database and a map-backed KV: `200` headers, `HEAD`, `405`; **the `404` is
  byte-identical** for unknown, malformed, wrong-length, revoked, rotated, removed-owner, banned-owner and
  unreadable-trip; a wrong-length secret reaches neither a hash nor a query; `429` with `Retry-After`; a KV
  outage fails open; a request carrying a session cookie gets the same bytes; the module constructs no
  scope (a source-level assertion, ACCESS §3.7).
- `src/lib/__tests__/sentry-scrub.test.ts` — the `/api/feed/<segment>` path is redacted.
- `src/components/modules/files/__tests__/calendar-panel.test.tsx` — the warning is the accessible
  description of **Create a link**; the link is shown once and not again; **Make a new link** and
  **Turn off** each open a confirm; an error clears the link.

**Tenant isolation.** Appended to `src/server/repos/__tests__/tenant-isolation.test.ts` as one new
`describe` block that edits no existing block: in A's scope, enabling a feed for **B's** trip id, and
reading, rotating or revoking **B's** feed by id, are each a `NotFoundError` and B's rows are byte-identical
afterwards; A's feed read in B's scope is a `NotFoundError`; `listFeeds` never returns B's rows;
`readFeedSource` over B's trip ids in A's scope returns nothing. Appended to `member-isolation.test.ts`: in
one workspace, a member who is **not on a private trip** and **not** reading it through `visibility` gets no
event, row or count of it from `readFeedSource`, from `openFeedScope` or from a workspace feed; an
`organization`-visible trip the owner is not on is in a per-trip feed and **not** in the workspace feed; and
the **offboarding case**: after `removeMember`, `trip_members` rows still exist and the feed still answers
the one `404`.

**Browser evidence** (ADR 0016; `docs/plans/12-verification-protocol.md`): `e2e/documents-and-media.spec.ts`,
one `test.describe('06-S5 — a calendar that keeps up with the trip', …)`, appended to the file `06-S1`
creates (whichever stage lands second appends; the `.visual.` suffix, baselines and `shoot.ts` are retired).
It reuses `visit`, `watchConsole`, `settle`, `useSession`, `applyTheme` and re-implements none.

- **Selectors** (`[data-part="calendar-subscribe"]`, `[data-part="calendar-enable"]`) are verified against a
  running server with `page.locator(sel).count()` returning `1` before any frame is filed.
- **Read-only tests** (both projects): the download action is present and its request answers
  `text/calendar`; the dialog opens on the enable step with the warning as the control's description; an
  unauthenticated `GET` of an unknown secret answers `404`.
- **The one write journey runs on `chromium` only** (the two browser projects share the demo workspace,
  and `csrf.spec.ts` is the precedent for a project-gated HTTP claim): enable → an unauthenticated `GET` of
  the issued URL **in a fresh request context** (200, `text/calendar`, `no-store`, `noindex`, a body
  beginning `BEGIN:VCALENDAR`) → rotate → the old URL is `404` with the same body an unknown secret gets →
  turn off in a `finally`, so the demo row ends revoked. It is idempotent on re-run because enabling again
  re-arms the same row.
- **Console must be silent** (`watchConsole`, `fatal` empty) in every test of the block.
- **No layout shift after paint**, measured after the settle mark across revealing the link (the monospace
  block is exactly the shape that shifts a panel); gated on `PerformanceObserver.supportedEntryTypes`, with
  the WebKit skip stated as a skip.
- **Frames**, read by a human, outside the repository: `scripts/visual/capture.mjs` for the resting route
  and for the two declared non-resting states (`--click '[data-part="calendar-subscribe"]'`, then
  `--click '[data-part="calendar-enable"]'`), light and dark at 360x800, 1280x900 and 2560x1440, `--auth`,
  `PT_SERVER_TODAY=2026-08-20`. Nothing is compared to a stored pixel.

**What each layer proves.** vitest: the contract, the refusal matrix, revocation and offboarding, isolation.
Browser: that the route is registered under `src/routes/api/**` with no session and no CSRF check, that the
dialog works, and that the rendered states are readable. A real calendar client's polling cadence cannot be
exercised unattended; the dialog's freshness sentence is written for exactly that.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                     | Applied default                                                                                                                                                                                                                               | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Which trips does a workspace feed carry, given ADR 0007?                     | The trips the owner is a **member of**, not archived, up to 50, newest start first, via `readableTrips` + `memberTripIds` as a sub-select; no date cut-off. Not the plan's "every non-archived trip", and not `listTrips`'s wider "may read". | Decided by product owner sub-agent (confidence medium) and confirmed by the security and tenancy sub-agent (confidence medium): ADR 0007 makes the plan's argument stale; `memberTripIds`' docblock says "trips I am a member of" is what a traveller means by "my trips"; a leak cannot be taken back while widening is one read. Both panelists noted the brief's option B (`listTripsForUser`) is the same set as A since ADR 0007.                                                          |
| 2   | One spec for the whole stage, and how is it cut?                             | One spec, four serial slices: download, per-trip live, rotate, workspace.                                                                                                                                                                     | Decided by product owner sub-agent (confidence high): `SDLC.md` SLC says a change that works only once a later ticket lands is a layer; a writer-only or storage-only phase would be one.                                                                                                                                                                                                                                                                                                       |
| 3   | `hashShareToken` (07-S6) does not exist: where does the digest live?         | `src/server/calendar/secret.ts`, owned by this stage; `07-S6` may adopt it.                                                                                                                                                                   | Decided by software architect sub-agent (confidence high): a shared module nobody consumes is speculative; the move later is a one-file rename.                                                                                                                                                                                                                                                                                                                                                 |
| 4   | Who owns the `calendar_feeds` table and migration? Table or stateless token? | This stage, additive, generated by `pnpm db:generate`; a table, not an HMAC token.                                                                                                                                                            | Decided by software architect sub-agent (confidence high): the plan carries the design, nothing else created it, and a stateless token cannot be rotated per person, revoked or counted.                                                                                                                                                                                                                                                                                                        |
| 5   | How does a session-less lookup respect SPEC §5/§6 and ACCESS §3.7?           | Amend §5/§6 to three exceptions; `findLiveFeedByDigest` in `catalog/`, handler in `public/`, scope built only in `repos/` (`openFeedScope`).                                                                                                  | Decided by software architect (confidence medium) and security and tenancy (confidence high) sub-agents: option B breaks the closed list without amending it; option C builds a scope from an unauthenticated claim. ACCESS §3.7 rule 2 (no scope built under `public/`) adds the `openFeedScope` seam; applied by the spec author.                                                                                                                                                             |
| 6   | Revoke, rotate and re-enable semantics.                                      | Enabling again **re-arms the same row** with a new secret; two partial unique indexes enforce one row per person per scope per trip; the access log survives.                                                                                 | Decided by security and tenancy sub-agent (confidence high): deleting loses the only access record; a new row per toggle is unbounded.                                                                                                                                                                                                                                                                                                                                                          |
| 7   | Posture of the unauthenticated endpoint.                                     | Exact-length shape check before hashing; **ACCESS §3.6's three budgets** (per token, per IP, per-IP misses), KV fail-open, one `404`; a `last_served_at` write at most hourly in `waitUntil`; Sentry path redaction; ban refusal.             | Security and tenancy sub-agent (confidence high) chose the shape check and no probe counter; **the spec departs on the probe budget** because ACCESS §3.6 is the repository's documented public-route contract and already prescribes a per-IP miss budget, and on `serve_count`, dropped because §3.6 forbids a D1 write per public read. Applied by the spec author; the final panel reviews it. The ban, Sentry, `HEAD`, byte-identical `404` and `appUrl()` conditions are the sub-agent's. |
| 8   | What does the feed say, with no locale?                                      | Locale-free event text; a day without a title is `<trip title> · <n>`.                                                                                                                                                                        | Decided by software architect sub-agent (confidence medium): a localised feed reads the owner's settings on every poll for one fallback; adding labels later is additive.                                                                                                                                                                                                                                                                                                                       |
| 9   | Time form for a stop at a place with no zone.                                | Anchored to a **valid** `trips.timezone` as a UTC instant; otherwise **floating**; legs and transports keep their zones. Never the plan's UTC fallback.                                                                                       | Software architect sub-agent (confidence medium) chose this; the product owner sub-agent (confidence low) preferred floating everywhere, which would mix floating stops with UTC flights and misorder them for a reader in another zone. The architect's is applied.                                                                                                                                                                                                                            |
| 10  | Which events, and de-duplication.                                            | The full set in the table, "an event exists when its own date is known", linked bookings carried by the linked record which adopts their time, cancelled omitted, legs only.                                                                  | Decided by product owner sub-agent (confidence medium): a trip calendar without flights and hotel nights is not complete; the de-duplication matches `CONTEXT.md` (Stay, Stop).                                                                                                                                                                                                                                                                                                                 |
| 11  | Do confirmation numbers go into event descriptions?                          | **No.** No confirmation number, booking reference, seat, price, provider URL or participant is emitted.                                                                                                                                       | The product owner sub-agent's condition to put a confirmation number in the description is overridden by `docs/ACCESS.md` §3.1, which redacts them on every session-less surface, and by the plan's own caution that a calendar syncs to third-party providers. Applied by the spec author; the final panel reviews it.                                                                                                                                                                         |
| 12  | Evidence.                                                                    | Contract and refusal matrix in vitest through the pure handler; browser for wiring and states; one chromium-only write journey that ends revoked; `e2e/documents-and-media.spec.ts`.                                                          | Decided by software architect sub-agent (confidence medium) with its condition (an unauthenticated `GET` of the issued URL inside the journey) applied.                                                                                                                                                                                                                                                                                                                                         |
| 13  | Is the link recoverable after the first view?                                | No: digest-only storage, shown once, a new link replaces a lost one (Phase 3).                                                                                                                                                                | The plan decided digest-only on purpose and its own "show link" disclosure contradicts it; applied by the spec author. The UX reviewer judges the cost.                                                                                                                                                                                                                                                                                                                                         |
| 14  | Where does the panel sit, given the export panel (06-S3) is unbuilt?         | Its own "Calendar" card on the Files screen from Phase 1.                                                                                                                                                                                     | The plan's "beside the export panel" cannot be built; applied by the spec author.                                                                                                                                                                                                                                                                                                                                                                                                               |
| 15  | `expires_at` and `serve_count`.                                              | Neither column exists.                                                                                                                                                                                                                        | Nothing sets an expiry; a counter is a D1 write per poll (ACCESS §3.6). Applied by the spec author.                                                                                                                                                                                                                                                                                                                                                                                             |
| 16  | Labels for the implementation tickets.                                       | `risk-high` and `security`, owner's `qa-approved` before merge.                                                                                                                                                                               | The security and tenancy sub-agent's condition (a bearer credential, a new unscoped read, a migration, a contract amendment).                                                                                                                                                                                                                                                                                                                                                                   |
