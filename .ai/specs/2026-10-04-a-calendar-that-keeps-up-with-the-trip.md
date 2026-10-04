# A calendar that keeps up with the trip: a one-off download and a live calendar link

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
as it is now, no account and no decision. **A live calendar link**: a private link a calendar app polls, so the
trip keeps itself current; one link per trip, and one for "every trip I am on in this workspace". Both come
from one pure calendar builder, so a snapshot and a feed can never disagree about what a trip contains.

A calendar link is a **bearer credential**: whoever holds the URL reads the places, times, addresses
and notes of the trips it covers, with no account. So the stage is built around that fact: the secret is
stored only as a SHA-256 digest, the link is shown once, rotating and turning off are as reachable as
copying, every failure is the same byte-identical `404`, and the person who owns the link is re-checked
(workspace membership, ban, trip readability) on **every** fetch.

Four phases, each usable on its own and built one after the other: the download (Phase 1), the live
per-trip feed with its storage, resolver, route and dialog (Phase 2), rotation (Phase 3) and the
workspace feed (Phase 4). The browser evidence the stage owes is written with the phase that ships each
behaviour. In traveller-facing copy the credential is called a **calendar link** (never "subscription",
which in this product already means a paid plan); the domain term in `CONTEXT.md` is **Calendar feed**.

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
phone. The one-off download is for a person who wants a file (to attach, to import once); the live link
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

| Phase | Slice id | Labels (risk)           | Traveller can…                                                | Needs a table / route / amendment |
| ----- | -------- | ----------------------- | ------------------------------------------------------------- | --------------------------------- |
| 1     | `06-S5a` | `risk-low`              | download the trip as an `.ics` file                           | no                                |
| 2     | `06-S5b` | `risk-high`, `security` | get a live link for one trip, and turn it off                 | yes, all three                    |
| 3     | `06-S5c` | `risk-medium`           | replace a link they lost or leaked, without turning it off    | no                                |
| 4     | `06-S5d` | `risk-high`, `security` | get one live link for every trip they are on in the workspace | no                                |

#### Phase 1 (06-S5a) — the download

The whole calendar model, and the one phase with no credential and no session-less surface, so it is
first: it fixes what a trip **means** as events before anything publishes it. Phase 1 gives the traveller
a file and nothing else; the file is built by the same code a feed will use.

**`src/server/calendar/ics.ts` — the writer** (pure, no I/O, no repository import). Folding at 75
**octets** (never inside a UTF-8 sequence), CRLF line ends, text escaping (`\\`, `\;`, `\,`, newline →
`\n`), `DATE` and `DATE-TIME` value forms, one `VCALENDAR` with `PRODID:-//planned.travel//Calendar//EN`,
`VERSION:2.0`, `CALSCALE:GREGORIAN`, `METHOD:PUBLISH`, `X-WR-CALNAME`, and the refresh hints
`REFRESH-INTERVAL;VALUE=DURATION:PT1H` and `X-PUBLISHED-TTL:PT1H`. It is the inverse of
`src/server/queue/ics.ts` and shares no code with it; the test round-trips its output through the existing
reader (`unfoldIcsLines`, `unescapeIcsText`, `parseIcsProperty`, `parseIcsDate`), which is the strongest
cheap check available.

**`src/server/calendar/zone.ts` — local time to an instant** (pure; used for legs and transports only,
the two records that carry their own zone). `zonedToUtc(date, time, zone)` turns a stored wall-clock time
and an IANA zone into a UTC instant with `Intl.DateTimeFormat(..., { timeZone,
timeZoneName: 'longOffset' })` (numeric offsets `GMT+09:00`, never names, so workerd and WebKit cannot
disagree, SPEC §9 rule 5; this module runs only in the Worker). A time that does not exist (spring-forward
gap) takes the offset in force just before the gap; a time that happens twice (autumn overlap) takes the
first occurrence. A zone `Intl` rejects (`RangeError`) is treated as no zone, and the event is then emitted
floating (below).

**`src/server/calendar/feed.ts` — the builder** (pure over an in-memory `FeedSource`; no SQL).
`buildCalendar(source, { name })` returns the iCalendar text. It is what the download, the per-trip feed
and the workspace feed all call, so there is one answer to "what is in a trip's calendar".

**`src/server/repos/calendar-feeds.ts` — `readFeedSource(scope, selection)`** in this phase, with the
signature the later phases need, stated now: `selection` is `{ kind: 'trips'; tripIds: string[] }` (Phases
1 and 2) or `{ kind: 'member-trips' }` (Phase 4, below). It reads the trips through `readableTrips(scope)`
(a trip the caller may not read is simply absent) and then **one statement per table for the whole set**:
days, stops, stays, places, reservations, transports, legs, day notes. Eight statements however many
trips, not eight per trip: a feed is polled by every device that subscribed, and per-trip loops multiplied
by a poll rate are how a cheap feature becomes a bill. The `member-trips` mode caps at 50 trips, so the
ids plus the tenant stay under `MAX_BOUND_PARAMETERS` = 100 (`src/server/repos/batch.ts`); a `trips`
selection is one id.

**Every one of those statements names the columns it needs.** The repository handles' `findMany` is a bare
`select()` of every column (`src/server/repos/base.ts`), which would load `confirmation_number`,
`price_minor`, `url`, `seat` and `booking_code` into the Worker on a path with no session and rely on the
builder to drop them afterwards; ACCESS §3.7 rule 1 forbids exactly that ("not hidden by a serializer").
`readFeedSource` therefore builds explicit column selections on `tenantFilter(scope, …)` and
`readableTripFilter(scope)` (SQL stays in `server/repos`, the tenant filter is not removable), and
`FeedSource` is **typed as that projection**: a field that was never selected is not on the type and cannot
be emitted by a later edit. The read side's test captures the issued SQL and asserts it names none of the
excluded columns (listed in the Verification section).

**`src/server/fns/calendar.ts` — `downloadTripIcsFn`** (`GET`, `{ tripId }`): `appScope()`, `requireTrip`,
`readFeedSource(scope, { kind: 'trips', tripIds: [tripId] })`, `buildCalendar`, and a raw `Response` (`text/calendar; charset=utf-8`,
`content-disposition: attachment; filename*=UTF-8''<trip slug>.ics`, `cache-control: private, no-store`),
the shape `downloadTripFileFn` already uses.

**`src/components/modules/files/calendar-panel.tsx`** (new), mounted on `files.tsx` under its own
"Calendar" card (a heading at the same level as its sibling sections): one action, **Download calendar
file (.ics)**, with a sentence saying it is a snapshot that does not update, and, when the trip has no
dates, one more sentence saying that only dated reservations and journeys will appear until it has some.
The file is saved through the same blob helper the other downloads use (`download.ts`); the Phase 1
browser evidence includes a note of what iOS Safari does with it, and a plain same-origin link is the
follow-up if it saves to Files instead of offering "Add to Calendar". A failed download is a `toast`
carrying `download.error`. The panel exists from Phase 1 and later phases add to it. The Files screen is
this stage's home for the card; the trips list's `TripActionsMenu` (`src/routes/_app/-ui/trip-actions.tsx`)
is the natural second entry ("Add to calendar"), and making the card easier to find from it and from the
trip header is a follow-up issue the implementation run files. The download action carries `loading` and
`disabled` through `useAction`, so a slow connection cannot produce two files.

**What the calendar contains.** An event exists when **its own date is known**; a trip with no dates still
carries its dated reservations and transports, and an undated stop (no `days.date`) produces nothing.
The privacy rule is `docs/ACCESS.md` §3.1's, applied to the one surface that crosses the same line: **no
confirmation number, booking reference, seat, price, provider URL, participant, email or file is ever
emitted**, and nothing names the workspace. A field that is never selected cannot leak (above). The
visible set is listed in `docs/ACCESS.md` §3, and it includes what the file does carry: the event ids
(`UID`, which embed row ids) and the source rows' edit timestamps.

| Event                    | From                                                                                                                              | Form                                                                                                                                                                                                                                                                    |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The trip                 | `trips.start_date`..`end_date` (inclusive), title, summary                                                                        | all-day `DATE`; `DTEND` is the end date plus one day (exclusive)                                                                                                                                                                                                        |
| A stop with a start time | `day_assignments` + place (name, address) + its note; end from `end_time`, else `duration_minutes`, else the place's duration     | timed; `LOCATION` is the address; with no end and no duration the stop is one hour                                                                                                                                                                                      |
| A day summary            | a day that has a title, a day note or untimed stops                                                                               | all-day; title is `days.title`, else `<trip title> · <n>`; description lists untimed stops and day notes                                                                                                                                                                |
| A stay                   | `day_accommodations`: name, address, check-in/out times in the description                                                        | all-day, start day through end day **inclusive** (`DTEND` is the end day plus one), so the check-out day shows the stay and its check-out time                                                                                                                          |
| A leg or a transport     | a transport **with legs** emits its legs only, each in its own zone; one without legs emits itself from `departure_*`/`arrival_*` | timed, UTC instants; the departure date falls back to the departure day's date; a leg is titled `<from> → <to>` plus its service number when it has one (a public timetable fact); `LOCATION` is the departure endpoint; an endpoint with no arrival time omits `DTEND` |
| A reservation            | `reservations` with a start date that is **not linked** to a stop, a transport or a stay                                          | timed when it has a time, else all-day                                                                                                                                                                                                                                  |

A reservation **linked** to a stop, a transport or a stay is carried by that record, so one reservation is
one event. When the linked record has no time of its own and the reservation has one, the record's event takes
the reservation's date and time: a reserved time is never lost to the link. `cancelled` reservations and
transports produce no event (a live feed then removes the event on the next poll). `confirmed`/`completed`
emit `STATUS:CONFIRMED`; `pending`/`none`/`idea` emit `STATUS:TENTATIVE`.

**Time form.** A leg or a transport carries its own IANA zone, so its times are **UTC instants**
computed from that zone: a flight lands at the same moment in every reader's calendar. A stop or a
reservation is a wall-clock time at a **place**, and a place has no zone (`11-S3` decides the provider),
so it is emitted as a **floating** local time (no `Z`, no `TZID`): the reader's calendar shows the planned
clock time wherever the reader is. That is right for the traveller on the trip and never moves a 09:00
museum visit to 09:00 UTC; it is also why the feed does **not** anchor stops to `trips.timezone`, a single
free-text field that is wrong for any trip that crosses a zone (a 09:00 museum in Tokyo on a trip tagged
`Europe/Lisbon` would land at 17:00 Tokyo time). The one honest limit is a reader who is not on the trip's
clock, who sees a floating stop at its planned clock time next to a flight at its absolute moment; the
copy says so (`timesNote`, shown in the Phase 1 card as well as the Revealed state, and introduced in
Phase 1). `DTSTART` and `DTEND` of one event always use the same form: an event is UTC only when **every** endpoint it
uses has a valid zone (a leg whose arrival zone is missing is floating at both ends, and so is a zoned
transport that adopts a linked reservation's wall-clock time), otherwise it is floating at both ends; a
floating stop whose end time is earlier than its start ends on the next day. **No `VTIMEZONE`
component is ever written**: hand-rolling daylight-saving rules would put a wrong offset on exactly the
days people travel, and a UTC instant cannot be wrong about an offset it does not carry.

**Identity.** `UID` is `<kind>-<rowId>@planned.travel` (`trip`, `stop`, `day`, `stay`, `leg`, `transport`,
`reservation`), derived from the row and never from the feed, so a client updates an event in place and a
link rotation moves nothing. The kinds are permanent once a calendar has subscribed (renaming one would
duplicate every event of that kind), which is why the record is called `reservation` as in `CONTEXT.md`.
`DTSTAMP` and `LAST-MODIFIED` are the source row's `updated_at`, not the request time, so an unchanged
event is byte-identical on every poll. Every event also carries `URL:` the **login-protected** app address
of its trip (`appUrl()` plus `/trips/<id>`), so a calendar entry has a way back to what the feed does not
carry (confirmation numbers, prices, files); the address is useless without a session. The calendar's
`X-WR-CALNAME` is the trip's title for a trip feed and a download, and the fixed brand string
`planned.travel` for the workspace feed (a brand name, not catalogue copy, and never the workspace's own
name).

**Text.** The feed has no session and so no locale, and a calendar app shows dates in its own language.
Event text is therefore the traveller's own words only (titles, place names, addresses, notes); the one
fallback, a day without a title, is `<trip title> · <n>`. No English label is invented inside the feed.

**Evidence, written with the phase** (Phase 1): `ics.test.ts`, `zone.test.ts`, `feed.test.ts` and
`calendar-feeds.test.ts` (read side) below; the panel test; and the browser check that the download action
is present on `/trips/$tripId/files` and answers `text/calendar`. Phase 1 creates
`e2e/documents-and-media.spec.ts` if `06-S1` has not (whichever stage lands second appends).

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

- `enableFeed(scope, { scope: 'trip' | 'workspace', tripId? })` — find-or-issue, as **one statement**:
  `INSERT … ON CONFLICT (…) WHERE scope = … DO UPDATE SET token_digest = excluded.token_digest,
revoked_at = NULL, rotated_at = now` (Drizzle `onConflictDoUpdate` with `targetWhere`; the trip and the
  workspace partial indexes are two statements). D1 has no interactive transaction, so a find-then-insert
  would throw a unique violation on a double tap; the single statement re-arms the existing row, **revoked
  or not**, with a fresh secret and never reinstates an old digest. Returns the secret **once**. Two
  concurrent calls leave one row, the later secret wins and the earlier link stops, which the Edge Cases
  table states. `organization_id` is stamped on insert, never accepted. A trip feed first runs
  `requireTrip` **and** checks the caller is **on the trip** (`memberTripIds` contains it): a person who can
  read a trip only because it is visible to the whole workspace cannot publish it as a bearer link, for the
  same reason the workspace feed carries only trips a person is on (below), and a foreign or unreadable id
  cannot parent a row. One row per (person, scope, trip) for ever: toggling never grows the table, and the
  access log survives.
- `rotateFeed(scope, feedId)` — new secret, digest overwritten, `rotated_at` set, returned once. No
  history is kept, so the old URL stops on the next request: revocation is total, not eventual.
- `revokeFeed(scope, feedId)` — sets `revoked_at`.
- `listFeeds(scope)` / `getFeed(scope, feedId)` — the caller's own rows only (`user_id = scope.ctx.userId`),
  never a secret.
- `touchFeed(scope, feedId, now)` — `UPDATE … SET last_served_at = now WHERE id = ?`, issued **only when**
  the resolver's own `lastServedAt` is null or older than an hour (decided in code from the row already
  read, so a poll inside the hour issues no statement at all), run in `waitUntil` so the response never
  waits for it. This is a deliberate, bounded departure from ACCESS §3.6's "through the queue, never
  inline": at most one row written per feed per hour, amended into §3.6 for this route.
- `openFeedScope(db, found)` — the **only** place a scope is built from a resolved feed. It accepts only a
  `ResolvedFeed`, a branded type **declared in `src/server/catalog/calendar-feeds.ts`** (the catalog
  isolation test forbids it importing from `repos/`, so `repos/` imports the type, `import type`) that
  `findLiveFeedByDigest` alone produces. The brand is a compile-time guard against a mistake, not against
  malicious code. See below.
- `revokeFeedsForMember(db-or-scope, userId)` — sets `revoked_at` on every feed the person holds in the
  workspace. **It must run on the paths that really remove a member.** `removeMember`
  (`src/server/repos/members.ts:187`) has no production caller (only tests): membership changes go through
  the Better Auth `organization()` plugin (`src/server/auth/index.ts`), whose endpoints delete the `member`
  row directly, and its `trip_members` rows survive. So the revoke is attached to the plugin's
  member-removal and leave paths through its organization hooks (the implementation run reads the
  installed version for the exact hook names, and routes the paths through `removeMember` instead if that
  is simpler), and `removeMember` calls it too, **revoking first and deleting the member second** (or in
  one `runBatch`, `src/server/repos/batch.ts`) so a failure between them leaves the safe state. A person
  removed and later re-added gets no resurrected link. This is the **revoke** half of offboarding; the
  per-fetch membership read below is the deny half and stays as defence in depth. The offboarding test goes
  through the **real removal path**, not through a helper no one calls.

Managing a feed is the **owner's** and nobody else's: every function above resolves the feed id inside the
caller's scope **and** `user_id = scope.ctx.userId`, so another member's feed (same workspace) is a
`NotFoundError`, as is another workspace's.

**The third unscoped read — `src/server/catalog/calendar-feeds.ts`.** `findLiveFeedByDigest(db, digest)`
takes a plain `Database`, because until the row is found there is no tenant: the row **is** the tenant
resolution. It is shaped exactly like `listDueTripReminders` (`src/server/catalog/reminders.ts`): session-less,
**projection-only** (`{ id, organizationId, userId, scope, tripId, lastServedAt }`, never content), a point lookup on
`calendar_feeds_token_unq`, `null` for a revoked row, no import from `src/server/repos/**`
(`src/server/catalog/__tests__/isolation.test.ts` walks every module under `catalog/` and picks the new
file up without an edit). **The contract is amended in this phase, completely**, because each of these
states the list as closed at two and would be left lying: `docs/SPEC.md` §5 ("exactly two members", the
closing "Two members… closed" paragraph) and §6 (the carve-out bullet, "Two, and closed", and the
`server/public` bullet: "derived from the share record it resolved" is widened to a feed record);
`CODE_REVIEW.md` ("global tables plus one cron discovery read"); `docs/agents/CODING_STANDARDS.md` (its
statement of the `catalog` exception); the `.ai/skills/om-*/SKILL.md` overrides that mention the single
exception (a grep confirms they stay true); `docs/ACCESS.md` §3 ("Three surfaces"
and §3.7's "Nothing else … reads without a session"); and `PRODUCT.md` or `AGENTS.md` wherever they restate
the exception (a grep of "exactly two", "closed list", "cron discovery" finds them). The "twelve
names"/"eleven names" count is made consistent in the same edit (§5 lists twelve tables; §6 and the
`reminders.ts` docblock say eleven). §5 also names the properties that stand in for the two writer
clauses the existing members have: session-less, projection-only, a point lookup on a unique index, no
`repos/` import, and the live membership revalidation. The decision is recorded as **ADR 0035** (ADR 0005
was the vehicle for the second exception, and a third unscoped read plus a bearer credential is a decision
a later reader will look for). `07-S6`'s share-link resolver, when it lands, needs its own amendment or
adopts this one.

**The session-less handler — `src/server/public/calendar-feed.ts`** (new directory, the one SPEC §6 and
ACCESS §3.7 name). `serveCalendarFeed(request, runtime)` holds no SQL and **constructs no scope** (ACCESS
§3.7 rule 2; it calls `openFeedScope`). In order:

1. Method is `GET` or `HEAD` (`HEAD` gets the headers and no body); anything else is `405`.
2. The path is `/api/feed/<secret>.ics`; the secret must match `^[A-Za-z0-9_-]{32}$` **exactly**, else the
   not-found response, before any hash, lookup or KV call. Nothing in the path or query is read as an
   id, a trip id or an organization id.
3. `findLiveFeedByDigest(db, hashFeedSecret(secret))`, then the budgets below.
4. `openFeedScope(db, found)` builds a provisional least-privileged scope from the **row's own**
   `organizationId` and `userId`, asks one question with it (the owner's `member` row **and** that they
   are not banned, one tenant-scoped join; **refused when `banned = 1 AND (ban_expires IS NULL OR
ban_expires > now)`**, because a temporary ban lifts itself only at the person's next sign-in,
   `src/server/auth/index.ts`), and only then
   builds the content scope with the **live** role read from `member`. No `member` row, a ban, or a role
   outside `ORGANIZATION_ROLES` is the not-found response. This one indexed read is the whole of
   offboarding that no other statement covers: `removeMember` deletes only the `member` row and leaves
   `trip_members` rows that `readableTripFilter` trusts (and a ban and an account deletion never
   go through `removeMember`),
   and a ban leaves the `member` row in place. It is a **deny**: nothing is written by it.
5. Content is `readFeedSource(scope, …)` then `buildCalendar`. A trip feed is served only while its owner is
   **still on the trip** (`memberTripIds`, the same test that let them create it) **and** can still read
   it; a trip they were removed from, private or `organization`-visible, is the not-found response.
   An archived trip keeps serving a trip feed (the person turned it on); the workspace feed leaves
   archived trips out.
6. The only write a visit can cause is `touchFeed`, in `waitUntil`, and only when `lastServedAt` is stale.
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

**Rate limiting is ACCESS §3.6's design, adapted for one fact §3.6 did not meet: calendar providers
fetch for every subscriber from a few shared addresses.** A per-IP budget that every request spends would
throttle one workspace's calendars because of another's traffic, so for this route (amended into §3.6):

- **per feed**, spent only by a request that resolved to a live feed: 60 per minute
  (`public:rl:<v>:feed:<feed id>`, keyed by the feed's id, never its digest, which stays in D1), `429` with `Retry-After` over budget;
- **per IP, for refusals only**, 20 per minute: **every** refusal (unknown, malformed-but-shaped, revoked,
  rotated away, owner gone or banned, trip unreadable) spends it identically, so the status and the body of
  a refusal never say which kind it was (timing is **not** claimed to be equal: a wrong-shape secret is
  rejected before any read), and over budget a refusal is `429` with `Retry-After`;
- a request that resolves to a live feed is **never** refused on an IP's account, and the §3.6 per-IP
  budget across all public routes (120/min) does not apply to this route;
- **KV unavailable fails open, and token resolution never does**.

`src/server/public/rate-limit.ts` is the one implementation (its first caller is this route; `07-S6` is
its second), written to the `RateCounterStore` shape `src/server/metering/rate.ts` already states, with
the same honest note that KV has no atomic increment. A refusal costs up to three KV operations (read,
write, expiry); a flood below the edge is a Cloudflare zone rule, outside this repository. The per-poll
cost of a **valid** feed is: one D1 point read, one membership/ban read, one trips read, eight content
reads, at most one `touchFeed` write per hour, and its KV counters.

**The route — `src/routes/api/feed/$.ts`** (a new route file, so `pnpm generate-routes` runs and the
regenerated `src/routeTree.gen.ts` travels in the diff; it is never hand-edited). It declares only
`server: { handlers: { GET, HEAD } }`, following `src/routes/api/tiles/$.ts`, and calls
`serveCalendarFeed`. **An SSR loader never fetches its own server route**: the route and the server
functions both call the modules and neither calls the other.

**The secret in telemetry: what this repository controls, and what it does not.** The secret is in the URL
path (a calendar app cannot send a header), so every channel that records a request URL records it.

- _Controlled here._ `src/lib/sentry-scrub.ts` strips the query string but keeps the path, and
  `src/server/observability/sentry.ts` runs `beforeSend` only. `scrubEvent` is extended to redact
  `/api/feed/<segment>` to `/api/feed/[redacted]` in **every** place a URL lands: `request.url`, the
  `transaction` name, breadcrumb and span URLs and tags, with a `beforeSendTransaction` and a
  `beforeSendSpan` registered beside `beforeSend`, and a test for each. The handler logs the feed **id**,
  never the path, the secret or the digest, **does not call `requestFields`** (`src/server/observability/logger.ts`
  logs `url.pathname`, and the Sentry log sink would carry it), and a test inspects the captured log lines for
  the secret. A `beforeSendLog` redaction is registered beside the other hooks, because Sentry logs skip
  `beforeSend`.
- _The browser._ Sentry Session Replay records 10% of sessions and every session with an error
  (`src/client.tsx`), and its recordings do not pass through `beforeSend`; the hand-off links carry the
  secret in an `href` (percent-encoded inside `cid=` and `url=`, so a path pattern would not match it). The
  Revealed region is therefore marked `sentry-block` (Replay's block class, verified against the installed
  SDK by the implementation run) **and** the three hand-off targets are built at click time from the
  in-memory secret instead of living in the page as `href`s, with a test that no `href` in the Revealed
  DOM contains the secret. The browser's own history keeps whatever URL a hand-off opens (and may sync it
  across devices); `docs/ACCESS.md` says so, and it is a reason the link is rotatable.
- _Not controlled here._ `wrangler.jsonc` sets `observability` with `invocation_logs: true` and exports
  platform traces to Sentry (OTLP); those records carry the request URL and are written by Cloudflare, so
  no code in this repository can scrub them. The residual exposure is that anyone with Cloudflare log or
  Sentry trace access can read live link secrets, and `pnpm sentry-triage` copies production data into
  GitHub. It is stated in `docs/ACCESS.md` §3 and in the Risks table, and it is the one item of this stage
  a person must settle: **the Phase 2 pull request carries it as an explicit line, and `risk-high`
  already requires the owner's `qa-approved` before merge** (`SDLC.md`), so the decision is taken at the
  gate the pipeline already has: accept it (with log and trace access restricted to the people who
  already read production data), switch invocation logs off for this Worker (`wrangler.jsonc`, production
  and the staging block, which exports to the same Sentry destination), or add scrubbing on the Sentry and
  Cloudflare side, which are account settings. The same line asks the owner to put a Cloudflare zone rate
  limit on `/api/feed/*`: the per-IP budget cannot limit work, because a request is known to be a refusal
  only after its D1 read, and a live feed must never be refused on a shared provider IP's account. The
  Phase 4 PR restates the decision, because a workspace link exposes more than a trip link. Rotation (Phase 3) and removal are the remedy after the fact.

**Server functions — `src/server/fns/calendar.ts`**, all starting `appScope()`; Zod v4 `z.strictObject`
with trimmed, bounded ids:

| Function               | Method | Input                               | Returns                                                                                                                 |
| ---------------------- | ------ | ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `loadCalendarFeedsFn`  | GET    | `{ tripId }`                        | the caller's feed state for this trip: on/off, `lastServedAt`; never a secret (Phase 4 adds the workspace feed's state) |
| `enableCalendarFeedFn` | POST   | `{ tripId }` (Phase 4 adds `scope`) | `{ url, webcalUrl }` — the secret, once                                                                                 |
| `revokeCalendarFeedFn` | POST   | `{ feedId }`                        | `{ revoked: true }`                                                                                                     |

(`rotateCalendarFeedFn` is Phase 3.) The absolute URL is built from `appUrl()` only, never from a request
header: a link built from a spoofable `Host` is a link an attacker can point at their own origin.

**The dialog (`calendar-panel.tsx`).** "Live calendar link" opens a `Dialog`. The panel's state machine is
four states, held in one component **above** any `Tabs`, so the revealed secret survives a tab switch:

1. **Off.** The decision itself, not an illustration. The warning sentence sits **before** the button in
   the page order and is also its accessible description (`aria-describedby`): "Anyone with this link can
   read this trip's places, times, addresses and notes, with no account. Treat it like a password."
   Then **Create a link**. A trip with no dates says, once (`undated`, the key Phase 1 introduces), that only dated
   reservations and journeys appear until it has some.
2. **Revealed** (the link was made in this dialog session). The link is shown **once**: the address as
   real text in a labelled region (`Link address`, visible text, `aria-labelledby`), then the hand-offs
   from the same in-memory secret: **Open in your calendar app** (`webcal://`), **Add to Google
   Calendar** (`https://calendar.google.com/calendar/r?cid=<webcal url, encoded>`: Android has no
   `webcal://` handler and the Google Calendar phone apps cannot add by URL, so the web hand-off is the
   one expected to work there; whether the Google Calendar phone web view really adds a calendar by
   URL is verified on a real device and noted in the Phase 2 PR, and `link.fallback` is shown beside the
   hand-offs if it does not), **Add to Outlook** (`https://outlook.live.com/calendar/0/addfromweb?url=<https
url, encoded>&name=<trip title, or `planned.travel` for the workspace link, encoded>`), and **Copy link**. The three hand-offs are anchors (`Button asChild`, so they have the link role), the two web ones
   open in a new tab with `rel="noopener noreferrer"` and say so in their accessible name; the traveller's own click hands the link to the provider they
   chose, which is stated in `docs/ACCESS.md` §3. The dialog says in words that the link is shown only
   once, that a lost link is replaced and not recovered, what stays in planned.travel (confirmation
   numbers, prices, files), and that calendar apps can take up to a day to show an edit. An explicit
   **Done** leaves this state. **Closing is guarded until the link has been copied**:
   the dialog's `onOpenChange` is guarded, so Escape, an overlay tap, the built-in close (X) and **Done**
   all open a `ConfirmDialog` ("Close without copying the link?") instead of discarding a link that cannot
   be shown again. Only a **successful copy** lowers the guard: opening a hand-off does not, because on a
   device with no `webcal://` handler the tap does nothing. A browser back gesture, a refresh or a dropped
   tab are not guarded; that is stated as an accepted limit, and the recovery is cheap (turn off, create
   again).
3. **On** (reopened later). State only: "Calendar link is on", "Last fetched <when>" or "Not fetched
   yet", **Make a new link** (Phase 3) and **Turn off**. It **cannot show the link again**, a deliberate
   cost of "a leaked database row must not yield a working URL", paid in copy rather than hidden. When
   `lastServedAt` is null nothing has used the link yet, so **Make a new link** skips the "calendars stop
   updating" confirmation, and in Phase 2 **Turn off** uses the shorter confirmation `off.confirmBodyUnused`
   (nothing to lose). A link that is on with no link on screen (an enable whose response was lost) is
   recovered by **Turn off** then **Create a link**, which `error.enable` says in words. State is reloaded when the window regains focus, so "Last fetched just now"
   confirms that a calendar did connect; `<when>` uses the repository's frozen relative formatter in
   `src/lib/format.ts` (SPEC §9 rule 5).
4. **Error.** An `Alert` (`role="alert"`) with a **Try again** button. After **any** failed change the
   panel **reloads the real state** (`loadCalendarFeedsFn`) and shows what is true; a reload, here and on
   window focus, refreshes **in place** (no `Skeleton`, nothing focused is removed) and **never leaves the
   Revealed state**, so returning from a hand-off tab cannot discard the link; the messages claim nothing about the server's state,
   because the server may have finished and only the response been lost. A link on screen is cleared on a
   failed enable or rotate.

Components, exactly: **Copy link** is a `Button` whose label is the catalogue key `link.copy` (not
`CopyValue`, whose visible text is the value itself, upper-cased, with a hard-coded English name and no
announcement, and which is not changed here), with a **polite live region** announcing `link.copied` or
`link.copyFailed`; after a failed copy the link stays on screen and the message tells the person to select
the address and copy it by hand. The address is text, not an `<input>`, with `dir="ltr"`, `translate="no"`,
`overflow-wrap: anywhere`, no `uppercase`, selectable, and `tabindex="0"` with a name only if it can scroll; it
does not scroll sideways at a 320 CSS px viewport. Every control in the dialog is at least 24 by 24 CSS
px. `ConfirmDialog` gains three optional props (`src/components/modules/shared/controls.tsx`, backward
compatible, defaults unchanged): `busyLabel` (default `ui.status.removing`) so a confirmation reads "Making
a new link…" or "Turning off…" and not "Removing"; `cancelLabel` (default `ui.action.keep`) so the close
guard reads "Keep open"; and `onCloseAutoFocus` so the panel, not the primitive, decides where focus goes
once the inner dialog closes. These are the changes to a shared primitive in this stage, with their own
tests. The **Copy link** failure path moves focus to the address and selects its text
(`Selection.selectAllChildren`) so Ctrl/Cmd+C completes the copy by keyboard; the live region exists, empty,
when the Revealed state mounts and is cleared before each result so a repeat is announced again.

**Focus after each change of state**, all asserted in `calendar-panel.test.tsx`: Create a link → the
revealed link's region; Turn off confirmed → **Create a link**; Make a new link confirmed → the new link's
region; a failure → the error `Alert`; a close-guard **Keep open** → the element focused before; **Close
anyway** → the trigger; a confirmed **Done** or close returns focus to the trigger. Every programmatic
focus target (the link region, the `Alert`) has `tabindex="-1"` and the shared focus ring, and the address
itself takes `tabindex="0"` only when it can scroll. The inner `ConfirmDialog` would otherwise return focus
to a button that no longer exists, and jsdom runs no exit animation, so each target is asserted in the
**browser** keyboard journey as well as in `calendar-panel.test.tsx`. The
loading state is a two-row `Skeleton` at the control's exact height with `aria-busy` on the panel, so
nothing reflows when state lands; every action carries `loading` and the others are `disabled` for that
window.

**Also in this phase**: a `CONTEXT.md` entry **Calendar feed** (a session-less, owner-bound, read-only
calendar of the trips named by a link; revocable; distinct from a Share token, which names one trip
resource; _Avoid_: subscription, which is a paid plan) and `docs/ACCESS.md` §3 gains a visible /
never-visible table for the feed (visible: trip title and dates, stop names, addresses, times and
notes, day titles and notes, stay names and addresses, reservation and transport titles, leg endpoints
and service numbers, **the event ids and edit timestamps, and the app address of the trip** (login
required); **never**: confirmation numbers, booking references, seats, prices, provider URLs,
participants, emails, user ids, workspace identity, files, other trips' data), the surface count ("Three
surfaces") and §3.7's "nothing else" wording, a §3.5 line for the `noindex` header, §3.6's adaptation for
this route (above), who may create (a person who is on the trip) and who may rotate or revoke (only the
person whose feed it is; the trip's owner can neither see nor revoke feeds others made on their trip, and a
workspace owner's remedy for a member's leaked link is removing the member, which revokes their feeds, or
taking them off the trip: see Out of scope), and the platform-telemetry exposure stated in Phase 2.

**Phase 2 is one ticket.** It is the largest slice and the one most likely to be cut into layers nobody can
use, so `afk-to-tickets` files it whole (`SDLC.md`: a change that works only once a later ticket lands is a
layer). The parts that protect the traveller (the close guard, the web hand-offs, the reload after a
failure, the refusal matrix, the budgets, the redaction and the projection) are not separable from the
dialog that shows a link once, and nothing sensible is left for a second ticket. If a run proves it
cannot fit, it stops and says so rather than shipping a layer.

#### Phase 3 (06-S5c) — a new link

`rotateFeed` plus `rotateCalendarFeedFn` (`POST`, `{ feedId }`, returns `{ url, webcalUrl }` once) and a
**Make a new link** action behind a `ConfirmDialog` (skipped when `lastServedAt` is null, above) that says
what breaks: every calendar already subscribed stops updating until it is given the new link, and the old
link stops at once. After rotation the dialog is in the Revealed state with the new link. UIDs are
unchanged by rotation, so a re-subscribed calendar updates its events instead of duplicating them. Until
this phase ships, the way to replace a link is **Turn off**, then **Create a link** (`enableFeed` re-arms
the same row), and the Phase 2 copy says so without naming a button that does not exist yet. Evidence: a
vitest case that the old digest no longer resolves and the new one does; the browser journey below.

#### Phase 4 (06-S5d) — every trip I am on

The dialog gains a second tab ("My trips") for `scope = 'workspace'`, on `Tabs` with
`activationMode="manual"` so an arrow key cannot discard a link that is shown once;
`enableCalendarFeedFn` accepts `scope: 'trip' | 'workspace'` (`z.enum`) and `loadCalendarFeedsFn` returns
the state of both feeds. The workspace feed is named `planned.travel` in the calendar app (`X-WR-CALNAME`,
above).

**What a workspace feed carries — decided here, once.** Exactly the trips its owner is a **member of**,
not archived, up to **50**, newest start date first (undated last): `readableTrips(scope).findMany` with
`inArray(trips.id, memberTripIds(scope, scope.ctx.userId))` as a **sub-select** (never a materialised id
list, which `MAX_BOUND_PARAMETERS` would refuse for a traveller with a few hundred lifetime trips), in
`readFeedSource`'s `member-trips` mode. It is re-evaluated on every fetch, so joining a trip adds it and
leaving it removes it. There is no "ended more than N days ago" cut-off: archive is the exit a traveller
already controls (`CONTEXT.md`, **Archive**), and silently dropping a trip from a calendar deletes it from
the subscriber's history. A trip the person may read through `visibility = 'organization'` but is not on is
**not** in the feed, and cannot have a trip feed either (it is a trip they _may_ open, not one they are
travelling on; ADR 0007, `memberTripIds`' docblock). This keeps the credential's blast radius to the
traveller's own trips, and widening a feed later is a change to one read, while a leak cannot be undone.
Someone in two workspaces makes two links: merging them would be the first row in the product whose
contents cross a tenant boundary. Both calendars are named `planned.travel` (the workspace's name is never
emitted), so the person renames one in their calendar app; the dialog says so.

The dialog states the scope in its own warning, `workspace.warning` ("Anyone with this link can read every
trip you are on in this workspace that is not archived, up to 50, newest first, with no account. New trips
appear on their own. Treat it like a password."), before the enable control and as its accessible
description. It is its own key because the single-trip `warning` would understate what this link exposes.

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

| Concept                                                   | Owner module                                                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| iCalendar text: folding, escaping, value forms            | `src/server/calendar/ics.ts` (pure writer)                                                                                           |
| Wall-clock time + zone → instant (legs, transports)       | `src/server/calendar/zone.ts` (pure)                                                                                                 |
| What a trip means as events; the privacy projection       | `src/server/calendar/feed.ts` (`buildCalendar`, pure over a `FeedSource` that is typed as the column projection)                     |
| Minting and digesting a secret                            | `src/server/calendar/secret.ts`                                                                                                      |
| Feed rows, the trip set, the batched column-selected read | `src/server/repos/calendar-feeds.ts` (all tenant-scoped SQL; `openFeedScope` builds the scope for a `ResolvedFeed`)                  |
| Revoking a leaver's feeds                                 | `src/server/repos/calendar-feeds.ts` (`revokeFeedsForMember`), called from the organization hooks and `removeMember`                 |
| Token digest → tenant (the third unscoped read)           | `src/server/catalog/calendar-feeds.ts`                                                                                               |
| Session-less request handling, the budgets                | `src/server/public/calendar-feed.ts`, `src/server/public/rate-limit.ts`                                                              |
| The HTTP contract                                         | `src/routes/api/feed/$.ts` (declares `server` only)                                                                                  |
| The app's reads and writes                                | `src/server/fns/calendar.ts`                                                                                                         |
| The dialog                                                | `src/components/modules/files/calendar-panel.tsx`; `ConfirmDialog` gains `busyLabel` in `src/components/modules/shared/controls.tsx` |
| The decision to admit a third unscoped read               | `docs/adr/0035-…` (and the amendments listed in Phase 2)                                                                             |

**Dependency direction.** `calendar/*` imports nothing from `repos/`, `catalog/` or `public/`. `catalog/`
imports nothing from `repos/`. `public/` imports `catalog/` and `repos/` and builds no scope and holds no
SQL. `fns/calendar.ts` and `public/calendar-feed.ts` both call `repos/calendar-feeds.ts` and
`calendar/feed.ts`; neither calls the other. `components/ui` is untouched and never fetches.

## 📝 Data Model

One new table, `calendar_feeds`, specified in Phase 2, with the migration generated by `pnpm db:generate`.
It stores one small row per person per scope per trip and **no bytes**: the response is built per request
and never persisted, so there is nothing to expire or sweep. Rows go with their trip
(`ON DELETE CASCADE`) and with their workspace (`organization_id` cascade). A removed member's rows are
revoked by `removeMember`. **Account deletion** removes the `member` row by cascade, which makes the feed
answer `404` at once, but leaves the row (`user_id` is a `userRef()` with no foreign key,
`schema.ts:154`); it is inert, holds a digest and a date, and is listed under Out of scope.

## 📝 API Contracts

| Surface                                  | Contract                                                                                              |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `GET`/`HEAD /api/feed/<secret>.ics`      | `200 text/calendar` or the one `404`; `429` + `Retry-After`; `405` for other methods; session ignored |
| `downloadTripIcsFn`                      | raw `Response`, the same body the feed would serve for that trip                                      |
| `loadCalendarFeedsFn`                    | state only, never a secret                                                                            |
| `enable`/`rotate`/`revokeCalendarFeedFn` | the secret is returned once, by the two that mint one                                                 |

**Authorisation.** In the app: `appScope()`, then `requireTrip` for a trip, and a feed id resolved only
inside the caller's scope **and** as the caller's own row. **Creating a trip feed requires being on the
trip** (a `trip_members` row of any role, `memberTripIds`): a viewer on the trip may; a workspace member who
can read the trip only through `visibility = 'organization'` may not. The download needs only read access,
because it hands the person a file and publishes nothing. On the HTTP contract: the secret, and only the
secret, re-checked against live membership, ban and trip membership and readability on every request. (The
files functions' separate viewer-write gap is not this stage's and is not widened.)

**Quota.** A `calendar_feeds` row is bounded by construction (one per person per trip plus one per person
per workspace, enforced by two partial unique indexes), and a tenant cannot grow it independently of
`trips` and `members`, both already metered. No metric is added to `resolveLimits()` or `PLAN_QUOTAS`, no
`assertQuota` call site, no case in `limits.test.ts`. If a later change let a person hold arbitrarily many
feeds, that bound disappears and the metric becomes necessary in the same change. The unauthenticated
endpoint's ceiling is the KV budgets above, which protect the platform and sell nothing.

## 📝 UI/UX

- **Route:** one new route file, `src/routes/api/feed/$.ts` (an HTTP endpoint, no screen, no loader);
  `files.tsx` is edited to mount the panel.
- **Components:** existing primitives only — `Dialog`, `Button`, `Tabs` (Phase 4, `activationMode="manual"`),
  `Alert`, `Skeleton`, `toast`, `ConfirmDialog` from `modules/shared` (plus its new optional `busyLabel`),
  `useAction`. One new product component, `calendar-panel.tsx`. `CopyValue` is **not** used (Phase 2
  explains why). No new primitive, nothing filed to foundations.
- **Keyboard and screen reader.** Focus moves into the dialog, and back to its trigger on close, and to the
  named target after each state change (Phase 2); the warning precedes the enable button in page order and
  is its accessible description; the address is labelled text with its own **Copy link** button, and the
  copy result is announced politely, success or failure; **Make a new link** and **Turn off** are real
  buttons with names that say what they do; no state is conveyed by colour alone; the confirm dialogs read
  an action-specific busy label.
- **320 and 360px.** The address wraps anywhere inside an inset well and never scrolls the dialog
  sideways at 320 CSS px; actions stack; the dialog is the existing sheet-sized layout below `sm`.
- **Motion.** The disclosure and dialog use `--ease-out-quint` at 150–260 ms, transform and opacity only,
  and honour `prefers-reduced-motion: reduce`.
- **Tokens.** None missing; the well is `--color-surface-inset` on `--radius-md`; "last fetched" carries
  `tabular-nums`; every control is at least 24 by 24 CSS px.

## 📝 Visual change expected

Route `/trips/$tripId/files`, light and dark, 360 / 1280 / 2560 px:

- **Resting:** a new "Calendar" card with **Download calendar file (.ics)** and, from Phase 2, **Live
  calendar link**.
- **Dialog, Off** (`data-part="calendar-subscribe"` opens it): the warning above **Create a link**, on
  `--color-surface-2`.
- **Dialog, Revealed** (`data-part="calendar-enable"`): the link shown once with its hand-offs, the "shown
  once" sentence and **Done**.
- **Dialog, On:** state, **Make a new link** (Phase 3) and **Turn off** side by side.
- **Dialog, "My trips" tab** (Phase 4): its own warning above the enable control.
- **Confirm dialogs:** close without copying; make a new link; turn off.

## 📝 Copy

Every string is a catalogue key in `src/lib/i18n/messages/en/modules.ts` under `files.calendar.*` and lands
in all 23 locales **in the phase that first shows it** (`i18n-messages` skill, the parity test). In
traveller-facing text the credential is a **calendar link**, never a "subscription". Keys (`modules.`
prefix in code):

**Phase 1**

| Key (`files.calendar.…`) | `en` text                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `title`                  | `Calendar`                                                                                                                                  |
| `description`            | `Take this trip into the calendar app you already use.`                                                                                     |
| `download.action`        | `Download calendar file (.ics)`                                                                                                             |
| `download.hint`          | `A snapshot of the trip as it is now. It does not update.`                                                                                  |
| `undated`                | `This trip has no dates yet, so only dated reservations and journeys will appear.`                                                          |
| `download.error`         | `We couldn’t prepare the file. Try again.`                                                                                                  |
| `timesNote`              | `Journeys with a time zone show at the same moment everywhere. Everything else shows at its planned clock time, wherever your calendar is.` |

**Phase 2**

| Key (`files.calendar.…`) | `en` text                                                                                                                                                 |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `live.action`            | `Live calendar link`                                                                                                                                      |
| `live.title`             | `Live calendar link`                                                                                                                                      |
| `warning`                | `Anyone with this link can read this trip’s places, times, addresses and notes, with no account. Treat it like a password.`                               |
| `enable.action`          | `Create a link`                                                                                                                                           |
| `link.once`              | `Copy it now - we show it only once. If you lose it, turn this link off and create a new one; the old one stops working.`                                 |
| `link.address`           | `Link address`                                                                                                                                            |
| `link.copy`              | `Copy link`                                                                                                                                               |
| `link.copied`            | `Link copied`                                                                                                                                             |
| `link.copyFailed`        | `We couldn’t copy it. Select the address and copy it yourself.`                                                                                           |
| `link.open`              | `Open in your calendar app`                                                                                                                               |
| `link.google`            | `Add to Google Calendar`                                                                                                                                  |
| `link.outlook`           | `Add to Outlook`                                                                                                                                          |
| `link.done`              | `Done`                                                                                                                                                    |
| `link.stays`             | `Confirmation numbers, prices and files stay in planned.travel.`                                                                                          |
| `freshness`              | `Calendar apps can take several hours, sometimes longer, to show an edit.`                                                                                |
| `state.on`               | `Calendar link is on`                                                                                                                                     |
| `state.lastFetched`      | `A calendar last checked this link {when}`                                                                                                                |
| `state.neverFetched`     | `Not fetched yet`                                                                                                                                         |
| `off.action`             | `Turn off`                                                                                                                                                |
| `off.confirmTitle`       | `Turn off this calendar link?`                                                                                                                            |
| `off.confirmBody`        | `The link stops working now. Calendars keep the events they already have but stop updating.`                                                              |
| `off.confirm`            | `Turn off`                                                                                                                                                |
| `off.busy`               | `Turning off…`                                                                                                                                            |
| `closeGuard.title`       | `Close without copying the link?`                                                                                                                         |
| `closeGuard.body`        | `We can’t show it again. You would have to make a new one.`                                                                                               |
| `closeGuard.confirm`     | `Close anyway`                                                                                                                                            |
| `closeGuard.cancel`      | `Keep open` (passed as `ConfirmDialog`'s `cancelLabel`)                                                                                                   |
| `error.enable`           | `We couldn’t confirm that the link was created. The current state is shown below. If a link is on but you never saw it, turn it off and create it again.` |
| `error.off`              | `We couldn’t confirm that the link was turned off. The current state is shown below; try again if you need to.`                                           |
| `error.load`             | `We couldn’t check this trip’s calendar link. Try again.`                                                                                                 |
| `retry`                  | `Try again`                                                                                                                                               |
| `off.confirmBodyUnused`  | `Nothing has used this link yet. It stops working now.`                                                                                                   |
| `link.fallback`          | `If your phone can’t add it, open this page on a computer.`                                                                                               |

**Phase 3** (`link.once` is rewritten to name the button that now exists)

| Key (`files.calendar.…`) | `en` text                                                                                                   |
| ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `link.once`              | `Copy it now - we show it only once. If you lose it, make a new link; the old one stops working.`           |
| `rotate.action`          | `Make a new link`                                                                                           |
| `rotate.confirmTitle`    | `Make a new link?`                                                                                          |
| `rotate.confirmBody`     | `The old link stops working now. Calendars that use it stop updating until you give them the new link.`     |
| `rotate.confirm`         | `Make a new link`                                                                                           |
| `rotate.busy`            | `Making a new link…`                                                                                        |
| `error.rotate`           | `We couldn’t confirm that a new link was made. The current state is shown below; try again if you need to.` |

**Phase 4**

| Key (`files.calendar.…`) | `en` text                                                                                                                                                                                                             |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `tab.trip`               | `This trip`                                                                                                                                                                                                           |
| `tab.workspace`          | `My trips`                                                                                                                                                                                                            |
| `workspace.warning`      | `Anyone with this link can read every trip you are on in this workspace that is not archived, with no account: the {count} with the latest start dates, and new trips appear on their own. Treat it like a password.` |

The feed's own text (event titles, notes) is the traveller's, not catalogue copy; the `404` body is a
machine status line. The Files screen around the card is already hard-coded English
(`src/routes/_app/trips/$tripId/files.tsx`), which this stage does not touch and files as a follow-up.

## 📝 Edge Cases & Failure Scenarios

| Case                                                       | Behaviour                                                                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Unknown, malformed, wrong-length or revoked secret         | The one `404`; a wrong-length secret is refused before any hash or lookup                                                                  |
| Secret rotated away                                        | The old URL is the same `404` on the next request                                                                                          |
| Owner removed from the workspace                           | `removeMember` revokes their feeds; the same `404`; a re-added owner needs a new link                                                      |
| Owner banned (`banned = 1`, no expiry or an unexpired one) | The same `404`; nothing written; an expired temporary ban serves again                                                                     |
| Account deleted                                            | The `member` row is gone: the same `404`; the inert feed row is left (Out of scope)                                                        |
| Owner removed from a trip                                  | That trip feed is the same `404` (private or `organization`-visible alike); the workspace feed drops the trip                              |
| A trip is archived                                         | A trip feed keeps serving; the workspace feed leaves it out                                                                                |
| A trip is deleted                                          | The feed row cascades; its link is the same `404`                                                                                          |
| Trip with no dates                                         | Dated reservations and transports still appear; stops, days, stays and the trip event do not; the card says so                             |
| An unset or invalid leg/transport zone                     | That event is emitted floating                                                                                                             |
| A leg at a time that does not exist / happens twice (DST)  | Offset just before the gap / the first occurrence                                                                                          |
| A reservation linked to a stop, transport or stay          | One event, carried by the linked record, which takes the reservation's time if it has none                                                 |
| A transport with legs                                      | Legs only; never the parent as well                                                                                                        |
| A stop with no end time and no duration                    | One hour; a leg with no arrival time omits `DTEND`                                                                                         |
| Cancelled reservation or transport                         | No event; the next poll removes it                                                                                                         |
| 51 or more trips on a workspace feed                       | The 50 with the latest start dates; the dialog states the cap                                                                              |
| KV unavailable                                             | The limiter fails open; resolution still answers or `404`s                                                                                 |
| A shared calendar-provider IP polls many feeds             | Live feeds are never refused on the IP's account; only that IP's refusals spend its miss budget                                            |
| Two taps on **Create a link** / a race with another tab    | One statement per call; one row; the later secret wins and the earlier link stops                                                          |
| The response to a change is lost                           | The panel reloads the real state and shows it; the messages claim nothing about the server                                                 |
| The dialog is dismissed while a new link is uncopied       | A confirmation first (Escape, overlay, X, **Done**); a completed copy dismisses freely; a browser back gesture or a refresh is not guarded |
| `HEAD`                                                     | The same status and headers as `GET`, no body                                                                                              |
| A person pastes the URL into a signed-in browser           | The feed, not the app; the session is ignored                                                                                              |

## 📝 Observability

The handler logs `calendar_feed.served` with the feed **id**, scope and duration, and
`calendar_feed.refused` with a coarse reason bucket (`unresolved`, `rate-limited`, `owner-gone`), never the
path, the secret or the digest. `scrubEvent` and the two new Sentry hooks redact the path. `last_served_at`
is the access log the dialog shows.

## ✅ Acceptance criteria

Each criterion belongs to the phase named, so every ticket has its own contract.

**Phase 1 — the download (`06-S5a`)**

1. A traveller downloads a `.ics` for a trip from `/trips/$tripId/files`; it is `text/calendar` and its
   first line is `BEGIN:VCALENDAR`; a trip with no dates says what will appear.
2. The writer folds at 75 octets (not characters), escapes `\`, `;`, `,` and newlines, and its output
   round-trips through `src/server/queue/ics.ts`.
3. The calendar never contains a `VTIMEZONE`, a confirmation number, a booking reference, a seat, a price,
   a provider URL, a participant, an email, a user id or the workspace's name; `readFeedSource` selects
   explicit columns, `FeedSource` is typed as that projection, and the captured SQL names none of the
   excluded columns.
4. A leg departing 09:00 in `Asia/Tokyo` is `T000000Z`; across a European DST change the offset that
   applies on that date is used; a stop or a reservation is a floating local time and never gets a `Z` or a
   `TZID`; `DTSTART` and `DTEND` of one event share a form.
5. A reservation linked to a stop, transport or stay is one event; a transport with legs is its legs only;
   a stay shows through its check-out day; cancelled records produce no event; every event carries the
   login-protected `URL` of its trip.
6. A UID is derived from the row (`reservation`, not `booking`) and an unchanged event is byte-identical on
   every poll.
7. In a different workspace, `readFeedSource` returns nothing for another tenant's trip ids.
8. The Phase 1 copy is in 23 locales and the parity test passes; the card is usable at 360px in light and
   dark with a silent console.

**Phase 2 — one trip, live (`06-S5b`)**

9. `calendar_feeds` exists, additive, with the digest unique index and the two partial unique indexes; the
   secret is stored nowhere.
10. `enableFeed` is a single `INSERT … ON CONFLICT … DO UPDATE` statement: twice, after a revoke, and
    concurrently it leaves **one row** and a different secret per call.
11. Creating a trip feed for a trip the caller is not on (including an `organization`-visible one) is a
    `NotFoundError`; another member's feed and another workspace's feed are a `NotFoundError` to read,
    rotate or revoke.
12. `findLiveFeedByDigest` returns `null` for a revoked row and an unknown digest, returns coordinates and
    `lastServedAt` and no content, and the scope built from B's digest is B's organization;
    `openFeedScope` accepts only a `ResolvedFeed`.
13. The contract is amended completely (every file in Phase 2's list), ADR 0035 exists, the §5/§6 table
    count is consistent, and the catalog isolation test passes with the new module.
14. The route answers `200` to a request with no session and `404` for every refusal with
    **byte-identical** status, headers and body (including `HEAD`); a wrong-length secret never reaches a
    hash.
15. A removed workspace member (feeds revoked on the **real removal path**), a banned user with `banned = 1 AND
(ban_expires IS NULL OR ban_expires > now)` and a trip the owner was removed from are each the same
    `404`; an expired temporary ban is not refused.
16. The budgets are those of Phase 2 (per feed, per IP for refusals, a live feed never refused on an IP's
    account); `429` carries `Retry-After`; every refusal kind spends the miss budget identically; a KV
    outage fails open without serving anything the resolver would refuse.
17. The secret does not appear in any Sentry event the application emits (`request.url`, `transaction`,
    breadcrumb, span, log, Session Replay) or in an application log line; the platform channels it cannot reach are stated in
    `docs/ACCESS.md` and in the Phase 2 pull request for the owner's `qa-approved`.
18. The dialog says what the link exposes before it is created, shows the link once with the hand-offs and
    **Done**, guards closing while it is uncopied, shows state only afterwards, and **Turn off** is as
    reachable as **Copy link**.
19. Accessibility: **Copy link** has a catalogue label and a polite live region for success and failure;
    focus moves to the named target after each state change; the address is labelled `dir="ltr"` text with
    no sideways scroll at 320 CSS px; every control is at least 24 by 24 CSS px; `ConfirmDialog` reads an
    action-specific busy label.
20. The Phase 2 copy is in 23 locales, the dialog is usable at 360px in light and dark, no layout shift
    after paint, a silent console.

**Phase 3 — a new link (`06-S5c`)**

21. After **Make a new link** the old digest no longer resolves and the new one does; UIDs are unchanged;
    the confirmation is skipped while `lastServedAt` is null; the Revealed state, focus and close guard
    behave as after enabling; `link.once` now names the button.

**Phase 4 — every trip I am on (`06-S5d`)**

22. A workspace feed contains the owner's non-archived trips they are **on** (up to 50), and **not** an
    `organization`-visible trip they are not on, a private trip they are not on, or another workspace's;
    the feed is named `planned.travel`.
23. The "My trips" tab has its own warning key, uses manual activation, and a link revealed on one tab
    survives a switch.
24. The Phase 4 copy is in 23 locales; usable at 360px in light and dark.

## 📝 Risks & Impact Review

| Risk                                                                        | Severity | Mitigation                                                                                                                                                                                                                                                                            |
| --------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A bearer URL leaks (chat, screenshot, a shared device)                      | High     | Digest-only storage, shown once, warning before creation, rotate and turn off as reachable as copy, `no-store`, `noindex`                                                                                                                                                             |
| A private trip reaches a person who may not read it                         | High     | Every content read goes through `readableTrips`; both feeds carry only trips the owner is on; a member-isolation test                                                                                                                                                                 |
| An offboarded or banned person keeps reading                                | High     | `removeMember` revokes; membership and ban re-checked on every fetch; an offboarding test where `trip_members` rows survive                                                                                                                                                           |
| A token-to-tenant lookup becomes a general cross-tenant read                | High     | Projection-only, point lookup, no `repos/**` import, branded `ResolvedFeed`, walked by the isolation test, SPEC amended, ADR 0035                                                                                                                                                     |
| A booking reference reaches the no-session path through a bare `select()`   | High     | Explicit column selects; `FeedSource` typed as the projection; a test on the captured SQL                                                                                                                                                                                             |
| The secret is recorded by platform logging and trace export                 | Medium   | The app redacts every Sentry channel it controls and logs only the id; Cloudflare invocation logs and the OTLP trace export are written by the platform and **cannot** be scrubbed from this repository, so the Phase 2 PR states the exposure and the owner decides at `qa-approved` |
| An unauthenticated endpoint is probed or flooded                            | Medium   | Shape check before hashing, refusal budget per IP, per-feed budget, fail-open limiter that never gates authorisation; the zone edge is outside the repo                                                                                                                               |
| Shared provider IPs turn a per-IP budget into a lever against other tenants | Medium   | Live feeds are never refused on an IP's account; only refusals spend the IP budget                                                                                                                                                                                                    |
| A poll costs more than the feature is worth                                 | Medium   | Eight batched reads regardless of trip count, cap 50, at most one write per feed per hour                                                                                                                                                                                             |
| A wrong offset moves an event by an hour                                    | Medium   | No `VTIMEZONE`; legs in UTC from numeric offsets; stops floating; pinned DST gap and overlap tests                                                                                                                                                                                    |
| The lost-link cost (a link cannot be shown again)                           | Low      | Said in the copy; close guard; Phase 3 replaces a link without turning it off                                                                                                                                                                                                         |

### Out of scope

- Reminders and `VALARM` alarms, two-way sync, RSVP, an `.ics` import round trip beyond the writer's test.
- A per-place time zone (`11-S3` decides the provider first), and anchoring stops to it when it exists.
- **A trip owner or workspace admin seeing or revoking feeds others made on a trip**, and an admin "revoke
  this member's feeds" action. Today the remedies are removing the member (which revokes their feeds) or
  taking them off the trip; the implementation run files one issue for both (`afk-plan-to-spec` files no
  tickets).
- Sweeping `calendar_feeds` rows left by account deletion; they are inert (the resolver denies them at the
  membership read) and the implementation run files an issue for the deletion flow.
- Making the card findable from the trip header or the trips list, and the hard-coded English around it on
  the Files screen: follow-up issues the implementation run files.
- Fixing `CopyValue` (its hard-coded name and missing announcement affect its other callers).
- Share links (`07-S6`) storing their token in plaintext; it is that stage's, and it may adopt
  `hashFeedSecret`.
- Edge rate limiting of unknown-token floods (a Cloudflare zone rule).
- A localised feed; stable UIDs make adding labels later additive.

## 📋 Phasing

| Phase | Slice    | Labels                  | Depends on | What a traveller has afterwards                      |
| ----- | -------- | ----------------------- | ---------- | ---------------------------------------------------- |
| 1     | `06-S5a` | `risk-low`              | none       | a downloadable `.ics` of a trip                      |
| 2     | `06-S5b` | `risk-high`, `security` | 1          | a live per-trip link that can be turned off          |
| 3     | `06-S5c` | `risk-medium`           | 2          | a way to replace a lost or leaked link               |
| 4     | `06-S5d` | `risk-high`, `security` | 2          | one link for every trip they are on in the workspace |

Serial, not parallel: they all edit `calendar-panel.tsx`, `feed.ts` or `repos/calendar-feeds.ts`. Phases 3
and 4 both depend only on Phase 2 and are serialised by the shared files, not by a design dependency. The
labels are per phase on purpose: stacking `risk-high` and `security` on four serial pull requests would
hold four waits for the owner's `qa-approved` and trip the three-PRs-waiting gate that stops the backlog.
Phase 1 holds no credential, and Phase 3 introduces no new surface; Phases 2 and 4 carry the bearer
credential, the unscoped read and the widened blast radius. Phase 2 is one ticket (see its section). Four
tickets result.

## 📋 Implementation Plan

### Phase 1 — the download

1. `src/server/calendar/ics.ts`, `zone.ts` and their tests; `feed.ts` with `FeedSource` and `buildCalendar`
   and its tests (the event table above, the privacy projection as the `FeedSource` type, the
   linked-reservation rule, legs, cancelled, undated).
2. `repos/calendar-feeds.ts`: `readFeedSource(scope, selection)` with explicit column selects (readable
   trips, eight batched statements), its test file and the SQL-capture assertion; `repos/index.ts` gains the
   export line.
3. `fns/calendar.ts`: `downloadTripIcsFn`; `calendar-panel.tsx` with the download action and the undated
   note; mounted in `files.tsx`; `modules/files/index.ts` export; the Phase 1 copy in 23 locales.
4. Tests: the unit tests, the panel test, the tenant-isolation and member-isolation cases for
   `readFeedSource`, and the browser block's first test (creating `e2e/documents-and-media.spec.ts` if
   `06-S1` has not).

### Phase 2 — one trip, live

1. Schema + `pnpm db:generate` migration; `secret.ts`; `repos/calendar-feeds.ts` write functions,
   `openFeedScope`, `ResolvedFeed`; `removeMember`'s revoke statement; `catalog/calendar-feeds.ts`.
2. The contract amendments (every file listed in Phase 2) and ADR 0035.
3. `public/rate-limit.ts`, `public/calendar-feed.ts`, `routes/api/feed/$.ts` and `pnpm generate-routes`;
   `sentry-scrub.ts` and the Sentry hooks.
4. `fns/calendar.ts`: load, enable, revoke; the dialog's four states with the close guard, focus, live
   region and hand-offs; `ConfirmDialog` `busyLabel`; the Phase 2 copy.
5. `CONTEXT.md` and `docs/ACCESS.md` §3; the isolation and contract tests; the browser block; the PR body
   carries the platform-telemetry line for the owner.

### Phase 3 — a new link

`rotateFeed`, `rotateCalendarFeedFn`, the **Make a new link** action and its confirm (skipped for an unused
link), the `link.once` rewrite, the Phase 3 copy and tests.

### Phase 4 — every trip I am on

The `member-trips` selection in `readFeedSource`, `enableCalendarFeedFn` taking `scope`, the second tab and
its copy, the member-isolation cases for the workspace feed; tests.

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
- `src/server/calendar/__tests__/feed.test.ts` — the event table row by row; legs in UTC, stops and
  reservations floating, never a `TZID`; a stay through its check-out day; the privacy projection (a
  `FeedSource` built from the typed projection cannot carry a confirmation number, seat, price, URL or
  participant); linked-reservation de-duplication and the adopted time; legs only; leg titles; default
  one-hour stop; cancelled; an undated trip; the event `URL`; UIDs and `DTSTAMP` stable across two builds
  and across a rotation.
- `src/server/calendar/__tests__/secret.test.ts` — 32 characters from the URL-safe alphabet; hashing is
  deterministic and 64 hex characters.
- `src/server/repos/__tests__/calendar-feeds.test.ts` — `enableFeed` twice, after revoke and **concurrently**
  is one row with different digests; creating a trip feed for a trip the caller is not on (including an
  `organization`-visible one) fails; `rotateFeed` invalidates the old digest; removing a member **through the real path** (the organization plugin's hook, not only `removeMember`)
  revokes the leaver's feeds and no one else's; `readFeedSource` issues nine statements for ten trips (the
  trips read plus eight content reads, counted),
  respects the 50 cap and the sub-select, and **its captured SQL names none of `confirmation_number`,
  `booking_code`, `price_minor`, `url`, `seat`**; `openFeedScope` returns `null` for a removed member, for an
  active temporary ban and for a permanent ban, serves after an expired ban, and carries the live role for
  a demoted one; `touchFeed` is not issued when `lastServedAt` is under an hour old.
- `src/server/catalog/__tests__/` — the existing isolation walk covers `calendar-feeds.ts`;
  `findLiveFeedByDigest` returns `null` for revoked/unknown, returns coordinates and `lastServedAt` and no
  content, and the organization on the result is the organization of the digest presented.
- `src/server/public/__tests__/calendar-feed.test.ts` — through the pure `serveCalendarFeed(request,
runtime)` against the test database and a map-backed KV: `200` headers, `HEAD`, `405`; **the `404` is
  byte-identical** for unknown, malformed, wrong-length, revoked, rotated, removed-owner, banned-owner and
  trip-removed; a wrong-length secret reaches neither a hash nor a query; the per-feed `429` with
  `Retry-After`; **many live feeds fetched from one IP are never refused**; refusals of every kind spend
  the miss budget identically; a KV outage fails open; a request carrying a session cookie gets the same
  bytes; the module constructs no scope (a source-level assertion, ACCESS §3.7).
- `src/lib/__tests__/sentry-scrub.test.ts` — the `/api/feed/<segment>` path is redacted in `request.url`,
  the `transaction`, breadcrumbs and span data, and the two new hooks are registered.
- `src/components/modules/shared/__tests__/` — `ConfirmDialog` reads `busyLabel` while working and today's
  label when none is given.
- `src/components/modules/files/__tests__/calendar-panel.test.tsx` — the warning precedes the button and is
  its accessible description; the link is shown once and not again; **Copy link** announces success and
  failure in a polite live region and a failed copy keeps the link; the close guard opens while the link is
  uncopied (Escape, overlay, X and **Done** alike) and not after a successful copy; a window-focus reload leaves a revealed link in place; focus lands on each named target (create, turn off, rotate, failure,
  done, close); `Make a new link` and `Turn off` each open a confirm (rotate skipped for an unused link);
  an error reloads the real state; the revealed link survives a tab switch and an arrow key (Phase 4).

**Tenant isolation.** Appended to `src/server/repos/__tests__/tenant-isolation.test.ts` as one new
`describe` block that edits no existing block: in A's scope, enabling a feed for **B's** trip id, and
reading, rotating or revoking **B's** feed by id, are each a `NotFoundError` and B's rows are byte-identical
afterwards; A's feed read in B's scope is a `NotFoundError`; `listFeeds` never returns B's rows;
`readFeedSource` over B's trip ids in A's scope returns nothing. Appended to `member-isolation.test.ts`: in
one workspace, a member who is **not on a private trip** gets no event, row or count of it from
`readFeedSource`, `openFeedScope` or a workspace feed; an `organization`-visible trip the owner is not on is
in **neither** a trip feed (it cannot be created) nor a workspace feed; and the **offboarding case**: after
`removeMember`, `trip_members` rows still exist, the person's feeds are revoked and the feed still answers
the one `404`.

**Browser evidence** (ADR 0016; `docs/plans/12-verification-protocol.md`): `e2e/documents-and-media.spec.ts`,
one `test.describe('06-S5 — a calendar that keeps up with the trip', …)`, appended to the file `06-S1`
creates, or created by Phase 1 if `06-S1` has not landed (the `.visual.` suffix, baselines and `shoot.ts`
are retired). It reuses `visit`, `watchConsole`, `settle`, `useSession`, `applyTheme` and re-implements
none.

- **Selectors** (`[data-part="calendar-subscribe"]`, `[data-part="calendar-enable"]`) are verified against a
  running server with `page.locator(sel).count()` returning `1` before any frame is filed.
- **Read-only tests** (both projects): the download action is present and its request answers
  `text/calendar`; the dialog opens on the Off state with the warning as the control's description; an
  unauthenticated `GET` of an unknown secret answers `404`.
- **The one write journey runs on `chromium` only** (the two browser projects share the demo workspace,
  and `csrf.spec.ts` is the precedent for a project-gated HTTP claim): enable → an unauthenticated `GET` of
  the issued URL **in a fresh request context** (200, `text/calendar`, `no-store`, `noindex`, a body
  beginning `BEGIN:VCALENDAR`) → rotate → the old URL is `404` with the same body an unknown secret gets →
  turn off in a `finally`, so the demo row ends revoked. It is idempotent on re-run because enabling again
  re-arms the same row.
- **Keyboard-only journey**: Tab to **Live calendar link**, Enter, focus lands inside the dialog; create
  the link, focus lands on it; copy, a status message appears; Escape before copying opens the close guard;
  after a copy, Escape closes without the guard and focus returns to the trigger (as **Done** does); the same journey covers **Turn off** and both close-guard exits; arrow keys between the two tabs (Phase 4)
  do not lose the link; at a 320 CSS px viewport nothing overflows sideways; every control measures at
  least 24 by 24 CSS px.
- **Console must be silent** (`watchConsole`, `fatal` empty) in every test of the block.
- **No layout shift after paint**, measured after the settle mark across revealing the link (the monospace
  block is exactly the shape that shifts a panel); gated on `PerformanceObserver.supportedEntryTypes`, with
  the WebKit skip stated as a skip.
- **Frames**, read by a human, outside the repository: `scripts/visual/capture.mjs` for the resting route
  and for the two declared non-resting states (`--click '[data-part="calendar-subscribe"]'`, then
  `--click '[data-part="calendar-enable"]'`), light and dark at 360x800, 1280x900 and 2560x1440, `--auth`,
  `PT_SERVER_TODAY=2026-08-20`. Nothing is compared to a stored pixel. A note of what iOS Safari does with
  the downloaded file, from a real device, goes in the Phase 1 PR.

**What each layer proves.** vitest: the contract, the refusal matrix, revocation and offboarding,
isolation, the column projection. Browser: that the route is registered under `src/routes/api/**` with no
session and no CSRF check, that the dialog works by keyboard, and that the rendered states are readable. A
real calendar client's polling cadence and a platform log's contents cannot be exercised unattended; the
dialog's freshness sentence and the Phase 2 PR's telemetry line are written for exactly that.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                                                                      | Applied default                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| --- | ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Which trips does a workspace feed carry, given ADR 0007?                                                                      | The trips the owner is a **member of**, not archived, up to 50, newest start first, via `readableTrips` + `memberTripIds` as a sub-select; no date cut-off. Not the plan's "every non-archived trip", and not `listTrips`'s wider "may read".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Decided by product owner sub-agent (confidence medium) and confirmed by the security and tenancy sub-agent (confidence medium): ADR 0007 makes the plan's argument stale; `memberTripIds`' docblock says "trips I am a member of" is what a traveller means by "my trips"; a leak cannot be taken back while widening is one read.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 2   | One spec for the whole stage, and how is it cut?                                                                              | One spec, four serial slices: download, per-trip live, rotate, workspace.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Decided by product owner sub-agent (confidence high): `SDLC.md` SLC says a change that works only once a later ticket lands is a layer; a writer-only or storage-only phase would be one.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 3   | `hashShareToken` (07-S6) does not exist: where does the digest live?                                                          | `src/server/calendar/secret.ts`, owned by this stage; `07-S6` may adopt it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Decided by software architect sub-agent (confidence high): a shared module nobody consumes is speculative; the move later is a one-file rename.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 4   | Who owns the `calendar_feeds` table and migration? Table or stateless token?                                                  | This stage, additive, generated by `pnpm db:generate`; a table, not an HMAC token.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Decided by software architect sub-agent (confidence high): the plan carries the design, nothing else created it, and a stateless token cannot be rotated per person, revoked or counted.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 5   | How does a session-less lookup respect SPEC §5/§6 and ACCESS §3.7?                                                            | Amend §5/§6 (and every document that states the list as closed) to three exceptions and record ADR 0035; `findLiveFeedByDigest` in `catalog/`, handler in `public/`, scope built only in `repos/` (`openFeedScope`, accepting only a branded `ResolvedFeed`).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Decided by software architect (confidence medium) and security and tenancy (confidence high) sub-agents: option B breaks the closed list without amending it; option C builds a scope from an unauthenticated claim. ACCESS §3.7 rule 2 adds the `openFeedScope` seam; the panel's review widened the amendment list and added the ADR and the brand.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 6   | Revoke, rotate and re-enable semantics.                                                                                       | Enabling again **re-arms the same row** with a new secret in one `INSERT … ON CONFLICT DO UPDATE` statement; two partial unique indexes enforce one row per person per scope per trip; the access log survives.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Decided by security and tenancy sub-agent (confidence high): deleting loses the only access record; a new row per toggle is unbounded. The single-statement form is the software architect's panel condition (D1 has no interactive transaction).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 7   | Posture of the unauthenticated endpoint and its rate limits.                                                                  | Exact-length shape check before hashing; a per-feed budget (60/min) spent only by live feeds; a per-IP budget (20/min) spent **only by refusals, identically for every kind**; live feeds never refused on an IP's account; KV fail-open; one `404`; `last_served_at` written at most hourly in `waitUntil`.                                                                                                                                                                                                                                                                                                                                                                                                                                             | Security and tenancy sub-agent (confidence high) chose the shape check and, in review, the refusal-only per-IP budget after finding that calendar providers fetch from shared IPs, which makes ACCESS §3.6's all-requests per-IP budget a lever against other tenants; the §3.6 amendment records the adaptation. The ban, Sentry, `HEAD`, byte-identical `404` and `appUrl()` conditions are the sub-agent's.                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 8   | What does the feed say, with no locale?                                                                                       | Locale-free event text; a day without a title is `<trip title> · <n>`; legs are titled `<from> → <to>` plus a service number; the workspace feed is named `planned.travel`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Decided by software architect sub-agent (confidence medium) and refined by the UX panel (leg titles, the brand name): a localised feed reads the owner's settings on every poll for one fallback; adding labels later is additive.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 9   | Time form for a stop at a place with no zone.                                                                                 | Stops and reservations are **floating** local times always; legs and transports are UTC instants from their own zones. `trips.timezone` is not used.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Overturned from round 1 (the software architect had anchored stops to a valid `trips.timezone`) on the UX panel's evidence (confidence medium) with the product owner's earlier preference (confidence low): a single free-text trip zone is wrong for any trip crossing a zone and wrongs a stop by hours; floating is never wrong on the traveller's own clock and is upgradable when places get zones. The cost, a reader off the trip's clock sees a floating stop beside an absolute flight, is in `timesNote`.                                                                                                                                                                                                                                                                                                                                 |
| 10  | Which events, and de-duplication.                                                                                             | The full set in the table, "an event exists when its own date is known", linked reservations carried by the linked record which adopts their time, cancelled omitted, legs only, a stay shown through its check-out day, an event `URL` back to the trip.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Decided by product owner sub-agent (confidence medium): a trip calendar without flights and hotel nights is not complete; the de-duplication matches `CONTEXT.md` (Stay, Stop, Reservation). Check-out-day and `URL` come from the UX panel.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 11  | Do confirmation numbers go into event descriptions?                                                                           | **No.** No confirmation number, booking reference, seat, price, provider URL or participant is emitted, and the read never selects them.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | The product owner sub-agent's condition to put a confirmation number in the description is overridden by `docs/ACCESS.md` §3.1, which redacts them on every session-less surface; the security panel made the never-selected projection a condition (ACCESS §3.7 rule 1). The UX panel's `URL` property and `link.stays` copy are the way back to what stays in the app.                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 12  | Evidence.                                                                                                                     | Contract and refusal matrix in vitest through the pure handler; browser for wiring, states and a keyboard-only journey; one chromium-only write journey that ends revoked; `e2e/documents-and-media.spec.ts`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Decided by software architect sub-agent (confidence medium) with its condition (an unauthenticated `GET` of the issued URL inside the journey) applied; the accessibility panel added the keyboard journey.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 13  | Is the link recoverable after the first view?                                                                                 | No: digest-only storage, shown once, a new link replaces a lost one; a close guard protects an uncopied link.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | The plan decided digest-only on purpose and its own "show link" disclosure contradicts it; the UX panel judged the cost acceptable with the close guard and the unused-link shortcut (confidence medium).                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 14  | Where does the panel sit, given the export panel (06-S3) is unbuilt?                                                          | Its own "Calendar" card on the Files screen from Phase 1; an entry from the trips list's `TripActionsMenu` is a follow-up issue.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | The plan's "beside the export panel" cannot be built; the UX panel would like a second entry, which round 2 found a natural home for (`TripActionsMenu` exists), but adding a menu item to a screen this stage does not otherwise touch is filed rather than done here.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 15  | `expires_at`, `serve_count` and the plan's fetch-count display.                                                               | None of the three exists; "Last fetched" is the access log.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Nothing sets an expiry; "Last fetched" already answers "is anyone using my link". ACCESS §3.6 sends view counts through the queue rather than forbidding a write; this stage writes one bounded timestamp inline, once an hour, as a stated departure rather than a queue consumer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 16  | Labels for the implementation tickets.                                                                                        | Phase 1 `risk-low`; Phase 2 `risk-high` + `security`; Phase 3 `risk-medium`; Phase 4 `risk-high` + `security`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | The security and tenancy sub-agent's condition (a bearer credential, a new unscoped read, a migration, a contract amendment) for Phases 2 and 4, and the architect's: stacking them on four serial pull requests would trip the three-PRs-waiting gate.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 17  | Phase 2 is the largest slice: one ticket or layers?                                                                           | One ticket, not split.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Round 1: product owner (one unit) and software architect (may split) disagreed and the spec allowed at most two traveller-usable tickets. Round 2: the product owner showed the split puts the close guard, the web hand-offs and the reload-on-failure (the things rows 13 and 22 rely on) in the second ticket, so the first would not be a complete slice and its error copy would be untrue for one merge; the one-ticket rule is applied.                                                                                                                                                                                                                                                                                                                                                                                                       |
| 18  | The security reviewer's `ESCALATE: yes`: may live feed secrets sit in Cloudflare invocation logs and the Sentry trace export? | The application redacts every Sentry channel it controls and logs only the id; the platform channels are stated in `docs/ACCESS.md` and the Phase 2 PR, and the owner decides at the `qa-approved` that `risk-high` already requires. The spec is not blocked.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | `afk-decide` §5 reserves account settings and the owner's QA sign-off for a person; no change in this repository can scrub what Cloudflare writes, so the decision is placed at the gate the pipeline already has, before anything merges.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 19  | A removed member who is re-added: do old links come back?                                                                     | No: the leaver's feeds are revoked on the paths that really remove a member (the organization plugin's hooks, and `removeMember`), revoke first; the per-fetch membership read stays as the deny for a ban and an account deletion.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | The security panel flagged the resurrection as a product call and recommended revoking; round 2 found that `removeMember` has no production caller, so the revoke is attached to the real path. The more secure option is also the cheaper to explain, and re-creating a link costs the person one click.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 20  | Who may create a trip feed?                                                                                                   | Only a person on the trip (`trip_members`); a trip feed is served only while its owner is still on the trip.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Security and tenancy panel (confidence medium): the same blast-radius argument as the workspace feed; for the planned share links only the trip owner creates one.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 21  | What is the read's shape?                                                                                                     | Explicit column selects on `tenantFilter` and `readableTripFilter`, `FeedSource` typed as the projection, a test on the captured SQL.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Security and tenancy panel (confidence high): the base repository's `findMany` is a bare `select()`; ACCESS §3.7 rule 1 forbids relying on a serializer.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 22  | Hand-offs for the link.                                                                                                       | **Open in your calendar app** (`webcal://`), **Add to Google Calendar**, **Add to Outlook**, **Copy link**; the plan's add-by-URL hand-off is restored as Copy link plus the two web hand-offs.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | UX panel (confidence medium): Android has no `webcal://` handler and the Google Calendar phone apps cannot add by URL, so without the web hand-offs the first reader the spec names reaches a dead end.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 23  | `CopyValue` and `ConfirmDialog`.                                                                                              | A dedicated **Copy link** `Button` with a live region; `CopyValue` is untouched; `ConfirmDialog` gains an optional `busyLabel`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Accessibility and UX panels (both, medium): `CopyValue` shows the value upper-cased, names itself in hard-coded English, announces nothing and says nothing on failure; `ConfirmDialog` reads "Removing" for every confirmation.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 24  | Name in copy.                                                                                                                 | "Calendar link" (never "subscription"); `CONTEXT.md` entry **Calendar feed**, with `Avoid: subscription`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | UX panel (confidence medium): "Turn off the subscription?" reads like cancelling a paid plan in a product that has them.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 25  | Where is the third exception recorded?                                                                                        | ADR 0035 records it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Security and tenancy panel: ADR 0005 was the vehicle for the second exception.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 26  | Panel verdicts, round 1.                                                                                                      | Product owner: approve with conditions (medium). Software architect: approve with conditions (medium). Security and tenancy: approve with conditions (medium), with `ESCALATE: yes` on the platform telemetry (row 18). Accessibility: approve with conditions (medium). UX (traveller): approve with conditions (medium). Every condition was applied except the product owner's one-ticket condition, which round 1 compromised (row 17) and round 2 applied in full.                                                                                                                                                                                                                                                                                  | Recorded per `afk-plan-to-spec` § 5.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 27  | Panel verdicts, round 2 (final).                                                                                              | Product owner: approve with conditions (medium). Software architect: approve with conditions (medium). Security and tenancy: approve with conditions (medium); `ESCALATE: yes` **withdrawn** on the terms that the Phase 2 PR carries the telemetry decision on its own line with the third option (switch invocation logs off) and a zone rate limit, and that Phase 4 restates it; **approves Phases 2 and 4 for unattended implementation as `risk-high` + `security` work** once the revoke-on-real-path, Session Replay and log-sink conditions are in the spec. Accessibility: approve with conditions (medium). UX (traveller): approve with conditions (medium). Every condition is applied in this revision; no specialist answered **revise**. | Recorded per `afk-plan-to-spec` § 5 after the second and last round. Round 2 applied: one ticket for Phase 2; `ResolvedFeed` declared in `catalog/`; nine counted statements; the amendment list gains `docs/agents/CODING_STANDARDS.md`; revoke before delete on the organization plugin's real removal path; Session Replay block and click-time hand-off URLs; feed-id rate-limit keys; the timing claim withdrawn; `beforeSendLog` and no `requestFields`; `ConfirmDialog` `cancelLabel` and `onCloseAutoFocus`; focus targets with `tabindex="-1"`; failed copy selects the address; in-place reloads; the guard covers X and **Done** and is lowered only by a copy; `timesNote` and `freshness` reworded; the all-or-nothing event form; `undated`, `retry`, `off.confirmBodyUnused`, `link.fallback` keys; `{count}` in `workspace.warning`. |
