# Export the trip plan: a button for the document the queue already knows how to write

| Field              | Value                                        |
| ------------------ | -------------------------------------------- |
| **Status**         | ready                                        |
| **Issue**          | none                                         |
| **Spec PR**        | none                                         |
| **Implementation** | none                                         |
| **Plan**           | 06-S3 (docs/plans/06-documents-and-media.md) |

## 📝 TLDR

Plan stage `06-S3` takes reference row `DOC-06` from `partial` to `done` **for the trip-plan document**.
The queue already has a complete `pdf-export` handler (`src/server/queue/handlers/pdf-export.ts`) that
renders a print-ready document into R2, and nothing in the product ever enqueues it: no producer, no
button, no way to read what it wrote. This stage builds the producer and the entry point on the trip
Files screen (`/trips/$tripId/files`): an **Export the plan** panel that asks for a document, waits for
it without a spinner that lies, lists the artifacts that exist and downloads one.

It is also a **storage stage**. Every export writes bytes into R2 that no row counts, and today nothing
deletes them (the KV pointer expires after seven days, the objects never do). The stage therefore owns
the retention of what it makes possible: a prune that rides the job, a purge of a deleted trip's
artifacts, and the first `assertQuota` call site the `exports` metric has ever had.

No schema change, no migration, no route added, no package added. Five phases, built in the order below
because each rests on the one before it: the artifact the handler writes (Phase 1), the monthly allowance
(Phase 2), requesting, listing and downloading (Phase 3), the purge of a deleted trip's artifacts
(Phase 4) and the panel with its browser evidence (Phase 5). The journey-book variant of `DOC-06` is
**not** built here and is **not** assigned to any stage; it is named under Out of scope as unowned work
for the next planning round.

This spec describes the work that is **left** at HEAD (`e75063c7`). It departs from the plan's stage
block where the code the plan cites has changed or a specialist found the plan wrong. Every departure is
a row of the Resolved assumptions table.

## 📝 Problem Statement

What exists at HEAD, measured:

- **A handler nobody calls.** `handlePdfExport` takes `{ tripId, requestedBy, document, notify? }`, writes
  `exports/<orgId>/<tripId>/<taskId>.html` (and a `.pdf` beside it when `BROWSER_RENDERING_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID` are set) into the `FILES` bucket, writes a KV pointer with a seven-day TTL and
  optionally enqueues an `email` task. `grep -rn "pdf-export" src` finds the consumer's table, the payload
  schema and the handler's two tests (`handlers/__tests__/metering.test.ts`); no server function enqueues it.
- **No way to ask, to see or to fetch.** No server function, no route and no component mentions an export.
  Nothing lists `exports/<orgId>/<tripId>/` and nothing serves an object under it.
- **A link that goes nowhere.** The "ready" email links to `${APP_URL}/app/trips/<tripId>/exports/<taskId>`
  (`pdf-export.ts:196`). This router has no `/app` prefix and no `exports` child route.
- **English in the shell.** The handler hardcodes `<html lang="en">`, the word "generated" in the footer,
  and the email subject and body. `docs/SPEC.md` §9 bans hardcoded copy, and an Arabic trip would be
  rendered left-to-right and announced as English.
- **Bytes that never expire.** `EXPORT_TTL_SECONDS` is applied to the KV pointer only. Nothing in `src/`
  deletes an object under `exports/`. The weekly cron `17 4 * * 1` is registered as "retention prune of
  expired backups and export artifacts" (`wrangler.jsonc:178`), and `src/server/worker.ts` still answers
  that half with `logger.warn('cron half has no handler yet')`. A trip deleted today takes its attachments
  with it (`trip-purge`, from `listTripStorageKeys`) and would leave its exports behind, because an export is
  not a `trip_files` row.
- **A metric sold and never enforced.** `exports` is in `USAGE_METRICS` and in `PLAN_QUOTAS` (free 3,
  starter 25, pro 250, business unlimited, per month). `grep -rn "assertQuota(" src/server/repos` finds ten
  call sites (`journey.ts`, `files.ts` twice, `trips.ts` four times, `members.ts` twice, `places.ts`,
  `collections.ts`), none of them `exports`.

The reader this serves: a traveller who wants to hand the plan to someone who has no account (a parent,
a driver, a travelling companion on a different workspace) as one file that opens on any phone and prints.
The reference product has no server-side renderer at all: it prints through the reader's own browser dialog,
which caps fidelity and makes "send me the file" impossible. We already render on the server, off the request
path, into R2, and `docs/plans/README.md` names that as one of the four things we are ahead on. This stage
keeps it.

## 📝 Proposed Solution

### What the stage owns and what it does not

| Owned (this stage writes it)                                                                                                                                                    | Not owned (read only, or left alone)                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `src/server/storage/export-artifacts.ts` — new, pure: the `exports/` key family, the grouping of a listing into artifacts, the prune, `listExportKeys`                          | `src/server/db/schema.ts`, `drizzle/` — **no schema change, no migration**                                                |
| `src/server/storage/__tests__/export-artifacts.test.ts` — new; `fake-bucket.ts` — edit: a `list` verb                                                                           | `src/server/worker.ts`, `wrangler.jsonc` (the weekly cron half stays unwritten, Out of scope)                             |
| `src/server/queue/handlers/pdf-export.ts` — edit: locale, working ready link, prune; key helpers move out to the storage module                                                 | `src/server/queue/consumer.ts`, `src/server/queue/jobs.ts`                                                                |
| `src/server/queue/types.ts` — edit: **one** optional `locale` field on `pdfExportPayloadSchema`                                                                                 | `src/server/queue/handlers/trip-purge.ts` — unchanged: its namespace guard already admits `exports/<org>/…`               |
| `src/server/queue/handlers/__tests__/pdf-export.test.ts` — new; `metering.test.ts` — edit: its `FILES` fake gains `list`                                                        | `src/server/repos/files.ts`, `src/server/fns/files.ts` (`06-S2` and `06-S1`'s paths; no export row is a `trip_files` row) |
| `src/server/repos/exports.ts` — new: reserve and release one unit of the monthly allowance; `repos/index.ts` — append one export line                                           | `src/server/repos/billing.ts` — used as is (`bumpUsage`, `getMonthlyUsage`, `resolveQuotas`)                              |
| `src/server/repos/__tests__/exports.test.ts` — new; `tenant-isolation.test.ts` — append one `describe`                                                                          | `src/styles/tokens.css`, `src/components/ui/**` — no token and no primitive is missing                                    |
| `src/server/fns/export-document.ts` — new, pure: trip data → `ExportDocument`, in the requester's language                                                                      | `package.json`, `pnpm-lock.yaml` (frozen, `docs/SPEC.md` §3)                                                              |
| `src/server/fns/exports.ts` — new: request, list, download; `src/server/fns/__tests__/export-document.test.ts`, `exports.test.ts` — new                                         | `src/routes/_app/trips/$tripId/-ui/**`, the planner screen (held by `01-S2`, `01-S4`, `07-S1`)                            |
| `src/routes/_app/-server/trip-lifecycle.ts` — edit, **additive**: `deleteTripFn` also hands a deleted trip's export keys to `trip-purge`                                        | `src/routes/_app/-server/trip.ts` (`loadTripFiles`) — the panel loads its own list after hydration                        |
| `src/components/modules/files/export-panel.tsx` — new; `files/index.ts` — append one line                                                                                       | `src/components/modules/files/file-library.tsx`, `upload-queue.ts`, `screening.ts` (`06-S1`, `06-S2`, `06-S4`)            |
| `src/routes/_app/trips/$tripId/files.tsx` — edit: mounts the panel, reads the `export` search parameter                                                                         | `src/routeTree.gen.ts` — no route file is added, so `pnpm generate-routes` does not run                                   |
| `src/lib/i18n/messages/<locale>/modules.ts` — edit, **all 23 locales**; `coverage.test.ts` is touched only if a key has no reader                                               |                                                                                                                           |
| `e2e/documents-and-media.spec.ts` — a `06-S3` describe block (the file is this plan's spec file; whichever of `06-S1` and this stage lands first creates it, the other appends) |                                                                                                                           |
| `CONTEXT.md` — one glossary entry (**Plan export**) if the Phase 1 grep finds no term; this spec's `Status`/`Implementation` rows and the regenerated `.ai/specs/README.md`     |                                                                                                                           |

Three plan statements are stale at HEAD and the spec does not repeat them. `src/server/queue/handlers/__tests__/`
**exists** (seven files already, including the handler's current tests in `metering.test.ts`). The weekly cron is
**partly written**: the audit prune and the provider-usage roll-up run in that slot, and only the retention half
is missing. And `00-S4`'s claim on `queue/types.ts` has not changed what this stage needs from it, which is one
optional field.

**Departures from the plan that touch a file the plan told this stage to leave alone** (rows 2 and 3 of the
Resolved assumptions): `src/server/queue/types.ts` gets one additive optional field, and
`src/routes/_app/-server/trip-lifecycle.ts` gets one additive call. Both edits are small enough to merge cleanly
beside whatever `00-S4`, `07-S8` or a later `01-S*` stage does to those files, and neither is optional: without the
first the document's shell cannot be written in the traveller's language, and without the second a deleted trip's
whole plan stays in the bucket for ever.

### What an export is, and who sees it

An export is **a document the trip has**, produced from the plan as it stands when the traveller presses the
button. It is a snapshot, not a live view: editing the plan afterwards does not change an existing export, and
exporting again makes a new one.

- **Who may ask.** A trip `owner` or `editor`. A request spends one unit of the **workspace's** monthly allowance
  (three on the free plan, shared by everyone in it) and writes bytes into the workspace's storage, which is the
  reason the booking import already refuses a viewer before it enqueues (`startBookingImport`). The guard is
  `assertTripRole(scope, tripId, ['owner', 'editor'])`, the idiom eleven other call sites use.
- **Who may see and fetch one.** Everyone who can read the trip: a viewer, and any workspace member who can read
  an `organization`-visible trip with no trip role at all (`readableTripFilter`). The document contains only what
  those readers can already see on screen, so listing and downloading expose nothing new. Every list and every
  download re-runs `requireTrip`, so a person who leaves the trip or the workspace loses access at once. Say so
  in the panel for a viewer (copy below) instead of hiding the section: they came here for the document.
- **An archived trip can be exported.** Exporting reads; `requireTrip`, not `requireWritableTrip`. A finished
  trip is the commonest thing to hand over as a document.
- **A share-link guest is not here.** Guests never reach `appScope()`; these functions are for members.

### Phase 1 (06-S3a) — the artifact the handler writes

The handler's output is the thing a traveller will hold, so it is made right before anything can request it.

**`src/server/storage/export-artifacts.ts` (new, pure).** The `exports/` key family is one concept with one
owner, and three callers need it (the handler, the list and download functions, the trip purge), so it lives
here and the handler imports it. It takes the bucket as a **parameter** typed structurally, as
`src/server/storage/objects.ts` does, so a queue handler and a server function can both call it and the module
pulls no `cloudflare:workers` into the consumer's graph.

- `EXPORT_TTL_SECONDS` (`7 * 24 * 60 * 60`) and `EXPORT_KEEP_COUNT = 5` move here. `exportObjectKey` and
  `exportPointerKey` move here and are re-exported from the handler's module only if `grep` finds an importer
  outside it (at HEAD none does but the two handler tests, which import `handlePdfExport` alone).
- `exportPrefix(orgId, tripId)` → `exports/<orgId>/<tripId>/`. **The trailing slash is the point**: without it
  `exports/<org>/<trip>` also matches a trip whose id begins with the same characters.
- `listExportArtifacts(bucket, orgId, tripId)` → pages `list` over the prefix with `cursor` while `truncated`,
  and groups the objects by task id (the file name minus its extension) into
  `{ taskId, format: 'pdf' | 'html', sizeBytes, createdAt }`: **`pdf` when a `.pdf` object exists for that task,
  else `html`**, the size and instant of the object the format names. An object whose name does not parse as
  `<taskId>.html|pdf` is ignored, not deleted. Newest first.
- `listExportKeys(bucket, orgId, tripId)` → every key under the prefix, for the purge (Phase 4).
- `pruneExportArtifacts(bucket, orgId, tripId, { now })` → deletes **every object of every artifact** that is older
  than `EXPORT_TTL_SECONDS`, then every artifact beyond the newest `EXPORT_KEEP_COUNT`, through the existing
  chunked `deleteObjects` of `storage/objects.ts`. Bounded by construction: one paged listing and a handful of
  delete calls. A trip exported twice a day converges on five artifacts instead of growing.

**`pdf-export.ts` (edit).**

- **The prune runs after the artifact is durable**, never before: the new object is written, the pointer is
  written, and only then are the old ones removed, so a failed prune can never cost the traveller the document
  they asked for. The prune is wrapped in `try/catch` and a failure is a `logger.warn` with the trip and the
  error, not a retry and not a failed job (a redelivered job would write the artifacts twice).
- **A `locale` on the payload.** `pdfExportPayloadSchema` gains `locale: z.string().max(16).optional()` in
  `src/server/queue/types.ts`: a string and not an enum, so an envelope enqueued by a later build that knows a
  twenty-fourth locale never dead-letters. The handler resolves it with `isSupportedLocale` and falls back to
  `en`. A message already on the queue parses unchanged, because the field is optional.
- **The shell is written from the catalogue**, through `loadCatalogue(locale)` and `createTranslator`, the way
  `renderNotificationEmail` does it (`src/server/notifications/dispatch.ts`): `<html lang>` from the locale,
  `dir` from `directionOf(locale)`, the footer, and the email subject, body and link text. `renderExportDocument`
  takes the locale and the translated footer as arguments, so it stays a pure function.
- **The ready link is a route that exists:** `${APP_URL}/trips/<tripId>/files?export=<taskId>`, built with
  `encodeURIComponent` on both ids, the one Phase 5's panel reads to scroll to and mark the artifact. A link in an
  email nobody has received yet is still a broken link, and it would have been received the first time Phase 3
  ran.
- **`escapeHtml` stays the only way text reaches the markup**, and the new `<html dir>` and `lang` attributes
  come from a closed set (a supported locale tag), never from the document.
- **The `.html` artifact is served as an attachment** (Phase 3), never rendered inline by the app, and its content
  is escaped text and a literal print stylesheet: it carries no script, no remote resource and no form.

**Tests.** The seven invariants are listed under Verification. The existing `pdf export` block in
`metering.test.ts` keeps passing unchanged apart from its `FILES` fake gaining a `list` that answers an empty
listing, and the shared `fake-bucket.ts` gains a `list` verb (prefix, cursor, `uploaded`) so the storage tests and
the handler tests use one fake.

**The Docs-and-CI grep (the stage's first ticket runs it).** Search `docs/`, `AGENTS.md`, `README.md`,
`CONTEXT.md`, `wrangler.jsonc`, `src/` and `.ai/` for `pdf-export`, `exports/`, `EXPORT_TTL`, `/app/trips`,
`export artifact` and `retention`. Update every document that states what the handler writes, how long it is
kept or where its link points, and add **Plan export** to `CONTEXT.md` if no entry covers it (a snapshot document
of one trip's plan, made on request, kept for seven days, at most five per trip). Dated records of what a run saw
(`.ai/runs/`, merged PR bodies, the body of another spec) are history and are not rewritten. The pull request
body names the terms searched.

### Phase 2 (06-S3b) — the monthly allowance

**`src/server/repos/exports.ts` (new).** Small on purpose: two functions whose whole job is that the ceiling is
asserted where every other ceiling is, in a repository.

- `reserveExport(scope, tripId, { month })` →
  1. `assertTripRole(scope, tripId, ['owner', 'editor'])`: **the role guard comes first**, so a viewer can never
     spend a unit, and it lives here so it holds for any future caller, not only the server function (the
     argument `ARCHITECTURE.md` §6 makes for quota and `assertTripRole`'s own docblock makes for roles);
  2. `bumpUsage(scope, 'exports', 1, month)`: **reserve first**. The increment is in SQL (`MAX(value + 1, 0)` with
     `.returning()`), so the row it returns carries the post-increment value;
  3. `assertQuota(scope, 'exports', row.value - 1)` on that value. If it throws `QuotaExceededError`, the unit is
     released (`bumpUsage(…, -1, month)`, best effort) and the error is rethrown. The ceiling comes from
     `resolveLimits()` through `assertQuota` like every other metric.
     Returns `{ used: row.value }`.
- `releaseExport(scope, { month })` → `bumpUsage(scope, 'exports', -1, month)`. Called by the server function when
  a step after the reserve fails, so a refusal before the enqueue costs nothing. If the release itself fails the
  caller logs it and lets the unit leak: a lost unit is the safe direction.
- `exportAllowance(scope, { month })` → `{ used, limit | null }` for the panel's "n of 3 used", from
  `getMonthlyUsage` and `resolveQuotas`. It is **display only**: it is never the gate, because a read that is
  followed by a write is the check-then-act race the reserve-first order removes.

**Why reserve first and not the plan's check, build, bump, enqueue.** `assertQuota` is a pure comparison of a
value the caller read earlier. With a read, a document build (several repository reads) and a bump, two
concurrent requests on the free plan can both read two and both bump, ending at four of three. `bumpUsage` is
atomic in SQL, so using its returned value as the gate means at most `limit` requests get through.
`bumpUsage` defaults its period to `'all'`: the call **must** pass the `YYYY-MM` month, or the monthly counter
never moves and the unit is spent against the cumulative bucket.

**The month** is `serverToday().slice(0, 7)` (`src/server/clock.ts`), the clock the rest of the product reads, so
a pinned test day and the counter agree.

**Stated deviation from `ARCHITECTURE.md` §6.** This is the one ceiling in the plan read from `usage_records`
and not from a live `COUNT(*)`. There is no table of exports to count, and the alternative, counting R2 objects,
is a listing the prune deliberately keeps short, so it would under-count by design. A job that dead-letters after
it was enqueued keeps its unit: the counter counts requests accepted, and the panel says "used", not "made".

**Known and accepted: the first bump of a month.** `bumpUsage` reads before it inserts, so two simultaneous first
exports of a month can both try the insert; the unique index on `(organization_id, metric, period)` makes the
loser throw, having reserved nothing. It fails closed, with one error on the rare simultaneous first export and no
unit leaked. One retry of the bump on a constraint error is allowed and optional.

**`src/server/repos/index.ts`** gains one `export * from './exports'` line (append). `src/server/billing/__tests__/limits.test.ts`
gains no case: it catches a metric added to the catalogue and not to the resolver, and this stage adds neither.

**Tenant isolation test** (appended as one `describe`, editing no existing block): see Verification.

### Phase 3 (06-S3c) — ask for an export, list the exports, download one

**`src/server/fns/export-document.ts` (new, pure).** `buildExportDocument(input, t, locale)` turns the plan into
the existing `ExportDocument` (`src/server/queue/types.ts`): a title, an optional subtitle and up to 60 sections of
up to 500 `label` / `value` / `meta` rows. **It does not add a second payload shape**: the document is a value of
the type the payload schema already nests, and a test parses the built payload with `pdfExportPayloadSchema`.

- _Title_ is the trip's title; the _subtitle_ is the destination and the date range, the dates through
  `src/lib/format.ts` (`docs/SPEC.md` §9 rule 5, no raw `Intl`).
- _Overview_ section: the trip's summary (a `note`) and its status, timezone and number of days as rows.
- _One section per day_, headed `Day N · <date>`: one row per stop, in order, `label` the place's name, `value`
  its address or city, `meta` the start time. A day with no stops is a section with a note and no rows. Notes
  the planner already stores for the day go in the section's `note`.
- _Bookings_ section: one row per reservation in date order, `label` the title, `value` the provider, location
  and `Ref. <confirmation number>`, `meta` the date and time. **The confirmation reference is in the document on
  purpose**: it is the thing a driver or a companion needs, and it is only shown to people who can already read
  it on screen.
- _Where we are staying_ section: one row per stay, `label` the name, `value` the address, `meta` the nights.
- **Sizes are held by construction, and a cut is said out loud.** The schema allows 60 sections and 500 rows per
  section; every string is sliced to its bound. A plan longer than 56 days (60 minus overview, bookings, stays and
  one spare) keeps its first 56 days and says so in the overview note; a list longer than 500 rows keeps its first
  500 and its section note says "Showing the first 500 of N". A document that would fail the schema at the enqueue
  is a failed request with the traveller's plan in it, which is the worse outcome.
- **The locale is the requester's:** `getEffectiveSettings(scope).locale` through `negotiate`, the same chain the
  shell uses, and the headings come from the catalogue through `loadCatalogue` and `createTranslator` (keys
  below), with `en` as the fallback for a locale tag the catalogue does not carry. User-entered text (titles,
  notes, place names) is copied as entered and never translated.

**`src/server/fns/exports.ts` (new).** Three functions; **none of them renders anything**, and each starts at
`appScope()`.

| Function               | Method | Input                         | Returns                                                                                                            |
| ---------------------- | ------ | ----------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `requestTripExportFn`  | POST   | `{ tripId, notify: boolean }` | `{ ok: true, taskId, queuedAt }` or `{ ok: false, reason: 'quota', limit, used, resetsOn }`                        |
| `listTripExportsFn`    | GET    | `{ tripId }`                  | `{ artifacts: [{ taskId, format, sizeBytes, createdAt }], canRequest, allowance: { used, limit \| null, month } }` |
| `downloadTripExportFn` | GET    | `{ tripId, taskId }`          | a raw `Response` streamed from R2, or a 404 / 410 `Response` with a JSON `error`                                   |

- **`requestTripExportFn`** in this order, each step before the next can cost anything: `requireTrip`;
  `reserveExport` (the role guard, then the reserve, then the ceiling); build the document from tenant-scoped
  repository reads (`getTripItinerary`, `listTripDayNotes`, `listTripReservations`); `enqueueTask(taskQueue(),
{ kind: 'pdf-export', orgId, payload })` with **no `id`**, so the queue assigns a fresh UUID; return as soon as
  the message is on the queue. If anything after the reserve throws, `releaseExport` runs and the error is
  rethrown. `notify: true` puts the **session user's own email**, read on the server, into the payload; the browser
  never supplies an address. `payload.requestedBy` is `scope.ctx.userId`, `payload.locale` the requester's locale.
  A `QuotaExceededError` is **returned**, not thrown: it is not in `AUTHORED_ERROR_NAMES`, so a thrown one would
  reach the browser as a redacted failure, and the panel needs the numbers to write a sentence. `resetsOn` is the
  first day of the next month in `YYYY-MM-DD`.
- **Why a fresh id and not a deterministic one.** The consumer's `task:done:<id>` marker is written only after the
  handler succeeds, so it protects redelivery of one message (the id travels with the envelope) and nothing else.
  A deterministic `export:<tripId>:<minute>` would, once the first job finished, ack the second press as a
  duplicate and produce nothing while the unit was still charged. One request, one unit, one artifact, one id. The
  disabled-while-pending button is a courtesy; the allowance is the guard, and a double press costs two units and
  two artifacts, never an overshoot.
- **`listTripExportsFn`** runs `requireTrip`, lists through `listExportArtifacts` on `filesBucket()` for the
  caller's own `orgId` and the resolved trip's id, and answers `canRequest` from the caller's trip role. **R2 is the
  ground truth** for what exists: no index is kept, and the KV pointer stays the handler's own record and is not
  the list's source.
- **`downloadTripExportFn`** runs `requireTrip`, validates `taskId` against the id pattern the queue mints
  (`^[A-Za-z0-9-]{1,128}$`, so no `/` and no `..`), **derives the object key from the caller's own organization
  id and the resolved trip id**, never from a value the browser supplied, tries the `.pdf` object and then the
  `.html`, and streams the one it finds with `content-type`, `content-length`,
  `content-disposition: attachment; filename*=UTF-8''<sanitised trip title>-<date>.<ext>`,
  `cache-control: private, no-store` and `x-content-type-options: nosniff`. A task id from another workspace
  resolves to a key inside the caller's own prefix, which does not exist: a 404. **There is no id-shaped path into
  another tenant's artifact, and the KV pointer is never consulted.** An object that was pruned between the list
  and the download is a 410 with a sentence, as `downloadTripFileFn` does for a missing stored copy.
- **The media type is the object's own** (`application/pdf` or `text/html; charset=utf-8`, set by the handler),
  echoed, never re-derived from a name the browser sent. The filename is built with `sanitiseFilename`
  (`src/server/fns/file-policy.ts`) from the trip title; if `06-S1`'s `attachmentHeaders` has landed when this
  phase is built, the header set comes from it, otherwise this phase builds the same five headers inline and
  the follow-up is a one-line swap. The two must not diverge, and a test asserts the five headers.
- **Zod (v4 idiom).** `z.strictObject()` with the `error` parameter; ids as the existing trimmed bounded string;
  `notify` as `z.boolean()`. Validation is shape and decides nothing about permission.
- **Authorisation is decided in the handler**: `appScope()` then `requireTrip()` before anything is read, built or
  enqueued. `beforeLoad` is UX and is not a data boundary here or anywhere.

### Phase 4 (06-S3d) — a deleted trip takes its exports with it

`deleteTripFn` already hands the keys of the trip's attachments and its cover to the `trip-purge` handler, which
deletes only keys in its payload and refuses any key whose second segment is not the organization. An export is
not a `trip_files` row, so its artifacts are not in that list: today a deleted trip's whole plan (booking
references included) would stay in R2 for ever, and once the trip is gone `requireTrip` refuses every request, so
the Phase 1 prune can never run for it. The product tells the owner a deleted trip is deleted.

- `enqueueTripPurge(scope, tripId, keys)` (`trip-lifecycle.ts`) is given the export keys too:
  `listExportKeys(filesBucket(), orgId, tripId)` is read **before the early return on an empty list** (a trip with
  no attachments and one export must not be skipped), **inside the existing try/catch** that never fails the
  delete, and added to the key list that the existing chunking (`MAX_PURGE_KEYS`) and `tripPurgeTaskId` already
  handle. No new task kind, no new payload field.
- `trip-purge.ts` is **unchanged**: `exports/<org>/<trip>/<task>.pdf` has the organization in the second segment,
  which is the position its `belongsTo` guard reads.
- **Two cases remain and are stated, not hidden:** an export still in flight when the trip is deleted can write
  its object after the purge ran, and a trip exported once and then never touched keeps its artifact until the
  weekly retention cron half is written. The Phase 4 run files **one follow-up issue** for that cron half (it
  needs `worker.ts`, a shared entry, and prunes `exports/` prefix-wide and the orphaned upload objects the plan's
  area brief names), labelled for the foundations plan; it is not folded into this slice.

### Phase 5 (06-S3e) — the panel on the Files screen

**Route.** `/trips/$tripId/files`, an existing file, edited to mount one section. It gains
`validateSearch: z.object({ export: z.string().max(128).optional() })` so the email's link can name an artifact; no
route file is added, `src/routeTree.gen.ts` is untouched, the route stays on the default SSR.

**Why the Files tab and not the planner.** The reference puts the trigger in the day plan's toolbar. An export
**is** a document the trip now has, so it belongs where the trip's documents are; and the planner screen is held
by `01-S2`, `01-S4` and `07-S1`, so a trigger there would be a same-wave claim on a file another stage is
rewriting. The planner may grow a shortcut later; it is not needed for the row.

**`export-panel.tsx` (new)** — one product component inside the module this plan owns, from existing primitives
only: `Card`/`ModulePanel` with `SectionLabel`, `Button`, `Switch`, `Badge`, `Spinner`, `Skeleton`, `EmptyState`,
`Alert`, `Table`, `toast`, plus `useAction` from `modules/shared`. No new primitive, nothing filed to foundations.

- **The panel** sits under the file library as its own `ModulePanel`: one sentence on what an export is, the
  request `Button` (`data-part="export-request"`), the notify `Switch` ("Email me when it is ready"), the
  allowance line, and the artifacts that exist with format, size, age and a download action.
- **The list is read after hydration** through `listTripExportsFn` (the Files loader is untouched), so the list has
  a genuine pending state.
- **Waiting, without a spinner that lies.** The artifact does not exist when the button returns; it exists when the
  consumer has written it. The panel holds the returned `taskId` as a **pending row** and polls the list every
  `EXPORT_POLL_MS = 3000` for at most `EXPORT_POLL_WINDOW_MS = 90000`. When the artifact appears the row becomes
  real; when the window closes the row becomes a plain "Still working. Refresh in a moment." with a Refresh
  button, not an animation that never stops. Both numbers are named constants beside the reason, and the poll
  **stops when the tab is hidden** (`document.visibilityState`) and resumes, with a fresh window, when it is shown.
- **A viewer** sees the list, the download actions and one sentence ("Only owners and editors can create an
  export. You can download the ones that exist."), and no request button, no switch. The server refuses the
  request regardless (`canRequest` only draws the affordance).
- **`?export=<taskId>`** scrolls to that artifact's row once the list has loaded and marks it
  (`aria-current="true"` plus a visible emphasis that is not colour alone). An id that is not in the list does
  nothing: the email's link may outlive the artifact, and the panel says nothing rather than something false.
- **A refused request** with `reason: 'quota'` renders its sentence inline in the panel (`Alert`), from the
  numbers the server returned: how many exports the plan includes and the date the count starts again. "Quota
  exceeded" is not a sentence anybody can act on. Any other failure is the failure toast of `useAction`.
- **States, named.** _Empty_: an `EmptyState` on `--color-surface-2` with the `FileDown` icon, one sentence about
  handing the plan to somebody without an account, and the request button as its action. _Skeleton_: three
  `Skeleton` rows at the artifact row's exact height on `--color-surface-2`, so the panel does not change height
  when the list lands. _Error_: a failed **list** is an `Alert` with a Retry, and the request button still works;
  a failed **request** is the toast; a failed **download** reuses `modules.files.toast.downloadFailed`.
  _Loading_: the request `Button` carries `loading` while the enqueue is in flight and is `disabled` while a
  pending row exists.
- **Download** reuses the pattern of `download.ts` (a `fetch` into a blob saved through a hidden link) through a
  small function in the panel's own module; it does not edit `download.ts`, which `06-S1` edits. An `.html`
  artifact is re-typed `application/octet-stream` before its object URL is made, for the reason `06-S1` records
  for markup in the library (a blob URL of `text/html` is navigable).
- **Tokens.** None missing. Sizes, ages and the allowance carry `tabular-nums`. Motion 150–260 ms on
  `--ease-out-quint`, transform and opacity only, `prefers-reduced-motion: reduce` honoured, for the pending row
  settling into a real row.

### Alternatives considered, and why they lost

| Alternative                                                       | Why it lost                                                                                                                                                  |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Print from the reader's browser, as the reference does            | Caps fidelity, depends on the reader's print settings and makes "send me the file" impossible. We are ahead here and the README forbids regressing.          |
| A `trip_files` row per export, so the library lists and counts it | Puts a generated artifact inside the traveller's own file list and inside their `files` quota, and `getStorageUsage` would then count bytes that expire.     |
| An export index table                                             | A migration and a second source of truth that must be kept in step with R2; the list is read from R2, which is the truth, and the prune keeps it short.      |
| Render inside the request                                         | A request that timed out building the document would be a request that rendered; the handler exists so the request returns when the message is on the queue. |
| Count the allowance in the handler                                | The queue consumer has no `TenantScope`, and a new unscoped counter write would put SQL outside the tenant-scoped repositories.                              |
| A shortcut on the planner toolbar                                 | Same-wave claim on screens `01-S2`, `01-S4` and `07-S1` own. Left for a later stage.                                                                         |
| Ship the document in English only                                 | Hardcoded copy is banned (`docs/SPEC.md` §9); a localised body in an English shell is the same defect, smaller.                                              |
| Build the journey book here                                       | The payload requires a `tripId` and the document shape has no image; see Out of scope.                                                                       |

## 📝 Architecture

- **One concept, one owner (`docs/SPEC.md` §8).** The `exports/` key family, its listing, its grouping, its prune
  and its purge list are `storage/export-artifacts.ts`. The allowance is `repos/exports.ts`. Turning a plan into
  a document is `fns/export-document.ts`. Rendering is the handler and only the handler. The three server functions
  orchestrate and own no rule of their own.
- **Seams.** Request path: `exports.ts` fn → `reserveExport` (repository, tenant-scoped) → reads through existing
  repositories → `enqueueTask` → queue. Worker path: consumer → `handlePdfExport` → `export-artifacts` → R2/KV →
  `enqueueTask(email)`. Fetch path: `listTripExportsFn` / `downloadTripExportFn` → `export-artifacts` → R2. The
  bucket is passed as a parameter on both sides of the request boundary, as `storage/objects.ts` does.
- **All SQL stays in `server/repos`.** The only new SQL is `bumpUsage` and `getMonthlyUsage`, which already exist
  and are already tenant-scoped; `server/catalog` is not involved.
- **`components/ui` is untouched** and nothing under it fetches or imports from `server/`; the panel is a module
  component that calls the server functions through `useAction` and a plain `useServerFn`.
- **Cloudflare cost.** One queue message and one KV write per export (both already in the handler), at most three
  R2 `put`s and a listing per job, a bounded number of `delete`s, and the optional Browser Rendering call that is
  already metered through `context.callProvider` and degrades to the HTML artifact over its ceiling.

## 📝 Data Model

**No schema change and no migration.** Nothing about an export is a domain row: the artifact is an R2 object, the
pointer is a KV entry, and the only durable count is a `usage_records` row (`metric = 'exports'`,
`period = 'YYYY-MM'`) the billing repository already writes with its existing unique index.

**Retention, stated in one place because it is the reason this is a storage stage.**

| What                              | Where                              | Kept                                                                                             | Removed by                                                                                               |
| --------------------------------- | ---------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `<taskId>.html`, `<taskId>.pdf`   | `FILES` at `exports/<org>/<trip>/` | Seven days **per artifact**, and at most five artifacts per trip                                 | The prune that follows every successful job (Phase 1); the trip purge when the trip is deleted (Phase 4) |
| The KV pointer `export:<taskId>`  | `KV`                               | Seven days (`expirationTtl`)                                                                     | Its TTL. Nothing reads it; it stays the handler's own record                                             |
| The `exports` counter             | `usage_records`, period `YYYY-MM`  | Per month, as billing keeps every counter                                                        | Not removed; a new month is a new row                                                                    |
| A trip exported once, never again | `FILES`                            | Until the weekly retention cron half is written (Out of scope, follow-up issue filed by Phase 4) | Nothing yet — stated, not hidden                                                                         |

**Export artifacts are not counted by `getStorageUsage`**, which sums `trip_files` rows, and an export writes
none. Stated so that nobody later "fixes" the count by inserting a `trip_files` row per export.

## 📝 API Contracts

All three are `createServerFn`s in `src/server/fns/exports.ts`, validated with `z.strictObject()`.

```ts
// request
input:  { tripId: string /* trimmed, 1..64 */, notify: boolean }
output: { ok: true; taskId: string; queuedAt: number }
      | { ok: false; reason: 'quota'; limit: number; used: number; resetsOn: string /* YYYY-MM-DD */ }
// refusals that throw (authored or redacted by the existing boundary): NotFoundError (trip not visible),
// TripRoleError (a viewer), a validation failure.

// list
input:  { tripId: string }
output: { artifacts: Array<{ taskId: string; format: 'pdf' | 'html'; sizeBytes: number; createdAt: number }>;
          canRequest: boolean;
          allowance: { used: number; limit: number | null; month: string /* YYYY-MM */ } }

// download
input:  { tripId: string; taskId: string /* ^[A-Za-z0-9-]{1,128}$ */ }
output: Response  // 200 attachment | 404 { error } | 410 { error }
```

The queue payload is the existing `pdfExportPayloadSchema` plus one optional `locale: string (max 16)`.

## 📝 UI/UX

- **Route:** `/trips/$tripId/files`, edited; no route added, `pnpm generate-routes` does not run.
- **Components:** the primitives named in Phase 5, plus one product component. Nothing filed to foundations.
- **Keyboard and screen reader.** The request button, the notify switch and each download are real controls with
  visible focus and accessible names that carry the artifact (`Download the PDF made 4 Oct`), never "Download"
  alone. The pending state is announced through a **polite live region** (`role="status"`), once on "preparing" and
  once on "ready", rather than by motion alone; the pending row's spinner is `aria-hidden`. The marked artifact
  from `?export=` is announced by `aria-current`, not only styled. Focus is not moved by the polling.
- **360px.** A designed layout: the artifact row stacks its meta (format, size, age) under its name and the
  download action sits on its own line; nothing scrolls sideways.
- **Right-to-left.** Logical properties only; the download and `FileDown` icons do not carry direction.
- **Copy** is below and lives in the catalogue in all 23 locales.

## 📝 Visual change expected

Route `/trips/$tripId/files`, light and dark, 360 / 1280 / 2560 px:

- **Resting, empty:** under the file library a new card, "Export the plan", with its one-sentence description,
  the request button and the notify switch, and the empty state ("No exports yet") on `--color-surface-2`.
- **Resting, one artifact:** the same card with one row (format badge, size, age, Download).
- **Skeleton:** three rows at the row's exact height; the card does not change height when the list lands.
- **Pending (`data-state="pending"` on the row):** the pending row with its spinner and the live-region text;
  the request button disabled.
- **Quota refusal:** an inline `Alert` under the button with the sentence below.
- **List error:** an `Alert` with Retry in place of the rows.
- **A viewer:** the card without button or switch and with the explanatory sentence.
- **Elsewhere on the screen:** nothing changes.

## 📝 Copy

Every key is `modules.files.export.*` in `src/lib/i18n/messages/en/modules.ts` (the `modules` namespace file;
written there as `files.export.*`, as the existing `files.toast.removed` is), landed in **all 23 locales** in the
same change per the `i18n-messages` skill. Every key must have a literal reader in the source (the dead-key
census in `src/lib/i18n/__tests__/coverage.test.ts` counts keys by literal), so none is composed at run time.

Panel:

| Key                               | `en`                                                                                                                 |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `files.export.label`              | `Export the plan`                                                                                                    |
| `files.export.description`        | `A printable copy of the plan: the day-by-day itinerary, bookings and stays. Hand it to someone who has no account.` |
| `files.export.request`            | `Export the plan`                                                                                                    |
| `files.export.notify`             | `Email me when it is ready`                                                                                          |
| `files.export.allowance`          | `{used} of {limit} exports used this month`                                                                          |
| `files.export.allowanceUnlimited` | `{used} exports this month`                                                                                          |
| `files.export.kept`               | `Kept for {days} days`                                                                                               |
| `files.export.empty.title`        | `No exports yet`                                                                                                     |
| `files.export.empty.body`         | `Make a printable copy of the plan to send to someone who has no account.`                                           |
| `files.export.pending`            | `Preparing your export…`                                                                                             |
| `files.export.pendingSlow`        | `Still working. Refresh in a moment.`                                                                                |
| `files.export.refresh`            | `Refresh`                                                                                                            |
| `files.export.ready`              | `Your export is ready`                                                                                               |
| `files.export.format.pdf`         | `PDF`                                                                                                                |
| `files.export.format.html`        | `Printable page`                                                                                                     |
| `files.export.artifact`           | `Plan export, {date}`                                                                                                |
| `files.export.download`           | `Download`                                                                                                           |
| `files.export.downloadLabel`      | `Download the {format} made {date}`                                                                                  |
| `files.export.error.list`         | `The list of exports did not load.`                                                                                  |
| `files.export.retry`              | `Try again`                                                                                                          |
| `files.export.error.quota`        | `This workspace has used all {limit} exports its plan includes this month. The count starts again on {date}.`        |
| `files.export.error.request`      | `The export was not started`                                                                                         |
| `files.export.viewer`             | `Only owners and editors can create an export. You can download the ones that exist.`                                |

Document and email (read by the server function and the handler, in the requester's locale):

| Key                              | `en`                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| `files.export.doc.overview`      | `Overview`                                                                                      |
| `files.export.doc.days`          | `Days`                                                                                          |
| `files.export.doc.status`        | `Status`                                                                                        |
| `files.export.doc.timezone`      | `Time zone`                                                                                     |
| `files.export.doc.day`           | `Day {number} · {date}`                                                                         |
| `files.export.doc.dayUndated`    | `Day {number}`                                                                                  |
| `files.export.doc.dayEmpty`      | `Nothing planned yet.`                                                                          |
| `files.export.doc.bookings`      | `Bookings`                                                                                      |
| `files.export.doc.reference`     | `Ref. {code}`                                                                                   |
| `files.export.doc.stays`         | `Where we are staying`                                                                          |
| `files.export.doc.nights`        | `{count, plural, one {# night} other {# nights}}` (each locale carries its own plural branches) |
| `files.export.doc.truncatedDays` | `This plan has more days than fit in one document. The first {count} are shown.`                |
| `files.export.doc.truncatedRows` | `Showing the first {count} of {total}.`                                                         |
| `files.export.doc.footer`        | `{app} · generated {when} UTC`                                                                  |
| `files.export.email.subject`     | `{title} is ready to download`                                                                  |
| `files.export.email.body`        | `Your trip plan is ready.`                                                                      |
| `files.export.email.action`      | `Download {title}`                                                                              |
| `files.export.email.text`        | `Your trip plan is ready: {url}`                                                                |

The existing `files.toast.downloadFailed` is reused for a failed download. Real translations, made from our
English; a placeholder keeps its name in every locale; the plural keys carry the branches each locale needs.

## 📝 Edge Cases & Failure Scenarios

| Case                                                                   | What happens                                                                                                                              |
| ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| The free plan's fourth export of a month                               | Refused after the reserve is released; the panel shows the sentence with the limit and the first of next month. The counter is unchanged. |
| Two simultaneous requests at two of three                              | Exactly one passes: the second reserve returns four, fails the ceiling and is released.                                                   |
| A viewer calls `requestTripExportFn` directly                          | `TripRoleError` before any bump; the counter does not move.                                                                               |
| The enqueue throws                                                     | The unit is released and the error is rethrown; the toast says the export was not started.                                                |
| The release itself fails                                               | Logged; the unit leaks. A lost unit is the safe direction.                                                                                |
| The job dead-letters after it was accepted                             | The unit stays spent. The panel's pending row ends in "Still working. Refresh in a moment." after 90 s and the traveller can ask again.   |
| `BROWSER_RENDERING_API_TOKEN` absent, or the provider over its ceiling | The handler writes the HTML artifact only; the panel labels it "Printable page", never "PDF".                                             |
| An artifact is pruned between the list and the click                   | A 410 with a sentence; the panel reloads the list.                                                                                        |
| A task id from another workspace, or `../`                             | Fails the id pattern or resolves inside the caller's own prefix to nothing: a 404, indistinguishable from "not there".                    |
| A trip with 90 days, or 700 bookings                                   | The document is cut to the schema's bounds and says so in a note; the request does not fail.                                              |
| A title containing `<script>`                                          | Escaped through `escapeHtml` in the title, the headings and every row; the artifact carries no script.                                    |
| An archived trip                                                       | Exportable; the panel's request button is available to owner and editor.                                                                  |
| A tab goes to the background mid-poll                                  | The poll stops; it resumes with a fresh 90 s window when the tab is shown, and the list is reread immediately.                            |
| The traveller leaves the page while pending                            | The job completes anyway; the artifact is in the list on the next visit, and the email, if asked for, carries a working link.             |
| The email link names an artifact that has been pruned                  | The Files screen loads; the panel marks nothing and says nothing.                                                                         |
| A member is removed from the trip after exporting                      | `requireTrip` refuses their next list or download; the artifact stays for the others.                                                     |
| A locale tag the catalogue does not carry                              | The handler and the builder fall back to `en`; nothing dead-letters.                                                                      |
| Right-to-left locale                                                   | `<html lang dir="rtl">` on the artifact; the panel uses logical properties.                                                               |
| A trip deleted with no attachments and one export                      | The export keys are listed before the empty-list early return, so the purge still runs.                                                   |

## 📝 Observability

- The handler's existing completion line (`trip export written`: trip, key, format, bytes) gains
  `pruned: <count>` and `locale`. A prune that fails logs `export prune failed` at `warn` with the trip and the
  error, and the job still succeeds.
- `reserveExport` logs nothing on the happy path; a failed release logs `export allowance release failed` at
  `warn` with the organization, so a leaked unit is findable.
- The Phase 4 enqueue is inside the existing try/catch whose `warn` already names the trip and the key count.
- No new metric and no new alert; the provider meter already counts the Browser Rendering calls.

## ✅ Acceptance criteria

1. `handlePdfExport` writes the artifact, then the pointer, then prunes: every object of every artifact older than
   seven days is deleted, and of the rest only the newest five artifacts are kept; with fewer than six artifacts and
   none older than seven days nothing is deleted; a failing `list` or `delete` leaves the job successful and logs a
   warning.
2. The document's `<html lang>` and `dir` come from the payload's `locale` (`ar` → `rtl`), an absent or unsupported
   tag renders `en`, and the footer and the email subject, body and link text come from the catalogue.
3. The email links to `/trips/<tripId>/files?export=<taskId>` with both ids URL-encoded; the path resolves in this
   router.
4. `pdfExportPayloadSchema` accepts a payload with and without `locale`; a message queued before this change still
   parses.
5. `reserveExport` refuses a viewer before the counter moves, admits the third export of a month on the free plan
   and refuses the fourth with the counter back at three, never refuses on an unlimited plan, passes the month and
   not `'all'`, and takes the month from the pinned clock.
6. Two concurrent reserves at two of three admit exactly one.
7. `requestTripExportFn` parses the payload it builds with `pdfExportPayloadSchema`, enqueues with no `id`, releases
   the unit when the enqueue throws, returns `{ ok: false, reason: 'quota', … }` instead of throwing, and takes the
   `notify` address from the session and never from the input.
8. The built document stays inside the schema's bounds for a 90-day trip and a 700-booking trip and says it was cut.
9. `downloadTripExportFn` derives its key from the caller's organization id and the resolved trip id and ignores any
   other value; a malformed or foreign task id is a 404; the five headers are set and the media type is the
   object's own.
10. `listTripExportsFn` answers `canRequest: false` for a viewer, who can still list and download.
11. Deleting a trip whose only stored objects are exports enqueues a `trip-purge` carrying those keys; deleting one
    trip never lists or deletes another workspace's prefix.
12. The panel's request button is disabled while a pending row exists, the poll stops after 90 s and when the tab is
    hidden, the pending and ready states are announced through a polite live region, and a viewer sees no request
    control.
13. All new keys exist in all 23 locales; the parity test and the dead-key census pass.
14. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `bash .ai/scripts/check-generated.sh`, `pnpm build` are green; the
    existing `metering.test.ts` pdf-export tests pass with only their fake's `list` added.
15. Phase 5 leaves its `06-S3` block of `e2e/documents-and-media.spec.ts` green on `chromium` and `mobile-safari`
    (layout-shift skipped, stated, on WebKit) with a silent console.

## 📝 Risks & Impact Review

| Risk                                                                             | Mitigation                                                                                                                                                                                                          |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A cross-tenant read of an artifact                                               | The key is derived from the caller's organization id and the resolved trip id, never accepted; the task id is pattern-validated; the KV pointer is never consulted; an isolation test per function.                 |
| A viewer drains the workspace allowance                                          | The role guard is the first line of `reserveExport`, before the counter; a direct-call test.                                                                                                                        |
| Two requests overshoot the ceiling                                               | Reserve first, check the returned value; a concurrency test. The first-bump-of-a-month race fails closed.                                                                                                           |
| Generated markup is an XSS carrier                                               | Every value goes through `escapeHtml`; locale-derived attributes come from a closed set; the stylesheet is literal; served as `attachment` with `nosniff`; the panel re-types an `.html` blob before it gets a URL. |
| A deleted trip's plan stays in R2                                                | Phase 4 hands the export keys to `trip-purge`; the two remaining gaps (in-flight job, exported-once trip) are stated, and a follow-up issue is filed for the cron half.                                             |
| The edit to `trip-lifecycle.ts` and `queue/types.ts` collides with another stage | Both are one additive hunk in a region the other stages do not touch; named as departures; the ticket merges the base before it pushes.                                                                             |
| A prune deletes something it should not                                          | It lists only the prefix of one organization and one trip, ends in `/`, ignores names that do not parse as `<taskId>.html\|pdf`, and runs after the new artifact is durable.                                        |
| Polling logs or shifts the layout                                                | Silent-console and layout-shift assertions run across the pending → real transition; the skeleton is the row's exact height.                                                                                        |
| The Browser Rendering binding is absent                                          | Already the designed fallback: the HTML artifact stands, the panel labels it by its real format, and the tests cover both paths. Adding the binding changes cost, not this stage.                                   |
| The consumer's retry writes a second artifact                                    | The envelope id is stable across redelivery; the consumer's `task:done:` marker acks the repeat; the prune is not retried.                                                                                          |

### Out of scope

- **The journey-book variant of `DOC-06` is open and has no owner.** The row's name also asks for a "journey book
  (A4 landscape, count-driven photo layouts)". It is not built here and is **not deferred to another stage**: the
  only candidate, `08-S7`, plans no export of any kind, and writing "deferred to `08-S7`" would mark a behaviour
  done in this plan that is planned in neither. It is a different piece of work for two measured reasons:
  `pdfExportPayloadSchema` requires a `tripId` while `journeys.trip_id` is nullable, and `exportDocumentSchema`
  has no shape for an image, so photo layouts cannot be expressed in it. A later stage must widen the document
  shape in the wave that owns `queue/types.ts` and mount an entry point on the journal screen. It is written down
  here so the next planning round can carve it.
- **The weekly retention cron half** (`worker.ts`, `wrangler.jsonc`): a foundations requirement; Phase 4 files the
  follow-up issue.
- **A planner-toolbar shortcut**, an export for a journal, an export per day, a re-run of an old export, and an
  email to someone other than the requester.
- **The `BROWSER_RENDERING` binding** (`11-S3`): a cost-model change and the owner's decision; this stage ships
  against both paths.
- **Hardcoded English elsewhere on the Files screen** (`files.tsx`'s own headings and stat cards): named debt,
  not touched beyond the lines this stage adds.

## 📋 Phasing

| Phase | Ticket | Delivers                                                                                             | Needs       |
| ----- | ------ | ---------------------------------------------------------------------------------------------------- | ----------- |
| 1     | 06-S3a | The artifact the handler writes: key module, locale, working link, prune, the Docs-and-CI grep       | nothing     |
| 2     | 06-S3b | The monthly allowance: `reserveExport`, `releaseExport`, `exportAllowance`, the isolation `describe` | nothing     |
| 3     | 06-S3c | The document builder and the three server functions                                                  | Phases 1, 2 |
| 4     | 06-S3d | A deleted trip's exports leave with it; the follow-up issue for the cron half                        | Phase 1     |
| 5     | 06-S3e | The panel, the route edit, the copy in 23 locales, the browser evidence                              | Phase 3     |

Phases 1 and 2 are independent of each other and are sliced as two tickets; 3 waits for both because it calls the
module Phase 1 creates and the repository Phase 2 creates; 4 touches `trip-lifecycle.ts`, a file no other phase
edits, and needs only Phase 1's `listExportKeys`; 5 is the only phase a traveller sees. Five tickets, inside the
eight a slicing run may file. The copy lands with the phase that reads it: the document and email keys with
Phases 1 and 3, the panel keys with Phase 5, each in all 23 locales, so the parity test is green after every
merge.

## 📋 Implementation Plan

### Phase 1 — the artifact the handler writes (06-S3a)

1. Run the Docs-and-CI grep named above and note the terms in the PR body.
2. `src/server/storage/export-artifacts.ts` and `fake-bucket.ts`'s `list`, test-first: the prefix with its trailing
   slash, the grouping (`pdf` wins over `html`, an unparseable name is ignored), the paging over `truncated`, the
   prune (older than seven days, then the newest five, nothing under the thresholds), `listExportKeys`.
3. `pdfExportPayloadSchema` gains `locale`; the handler imports the key helpers, takes the locale, writes the
   shell from the catalogue, builds the working link, prunes after the pointer in a `try/catch`.
4. The handler's keys (footer, email) land in all 23 locales; `metering.test.ts`'s fake gains `list`.
5. `pdf-export.test.ts` (new): see Verification.

### Phase 2 — the monthly allowance (06-S3b)

1. `src/server/repos/exports.ts`, test-first against the real in-memory repository harness the other repository
   tests use: the role refusal, the third admitted and the fourth refused with the counter restored, an unlimited
   tier, the month from the pinned clock, the concurrent pair.
2. `repos/index.ts` one export line. The isolation `describe`.

### Phase 3 — ask, list, download (06-S3c)

1. `export-document.ts`, test-first: the sections, the escaping is **not** its job (the handler escapes), the
   bounds, the truncation notes, the locale.
2. `exports.ts`: the three functions in the order named above; the tests listed under Verification.
3. The document keys land in all 23 locales.

### Phase 4 — a deleted trip takes its exports with it (06-S3d)

1. `enqueueTripPurge` reads `listExportKeys` before its early return, inside its try/catch; a test in the
   existing `trip-lifecycle` side-effect suite and a two-tenant case.
2. File the follow-up issue for the weekly retention cron half.

### Phase 5 — the panel (06-S3e)

1. `export-panel.tsx` and `files/index.ts`; the route edit with `validateSearch`; the panel keys in all 23 locales.
2. Component tests for the states the panel owns (empty, skeleton, pending to real, slow, quota refusal, list
   error, viewer).
3. The `06-S3` block of `e2e/documents-and-media.spec.ts` and the frames, below.

## Verification

**Command gate, in order:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `bash .ai/scripts/check-generated.sh`,
`pnpm build` (`validation.commands`).

**Unit tests, by file and invariant.**

- `storage/__tests__/export-artifacts.test.ts` (new): the prefix ends in `/` and `exports/<org>/<trip>` does not
  match `<trip>2`; grouping prefers `pdf` and takes its size and instant; paging follows `cursor`; the prune keeps
  the newest five and deletes nothing under the thresholds; a name that does not parse is neither listed nor
  deleted; `listExportKeys` returns both objects of an artifact.
- `queue/handlers/__tests__/pdf-export.test.ts` (new): every section renders and `<`, `>`, `&` and quotes in a
  real trip title are escaped (through `renderExportDocument`, not a string literal); the KV pointer carries the
  `.pdf` key when the renderer answered and the `.html` key when it did not; `lang`/`dir` follow the locale and
  fall back to `en`; the link is `/trips/<id>/files?export=<task>` with both ids encoded; the prune runs after the
  pointer and a rejecting `list` leaves the job successful with a warning; a payload without `locale` still works.
- `repos/__tests__/exports.test.ts` (new): criteria 5 and 6.
- `fns/__tests__/export-document.test.ts` (new): bounds for a 90-day and a 700-booking fixture; the truncation
  notes; dates through the format helpers; the built value parses with `exportDocumentSchema`.
- `fns/__tests__/exports.test.ts` (new): criteria 7, 9 and 10, with the queue and the bucket faked and the real
  repositories; the download key ignores an organization id supplied in the input.
- A case in the existing `trip-lifecycle` side-effects suite for Phase 4 (criterion 11).
- Component tests for the panel (Phase 5).

**Tenant isolation.** One new `describe` appended to `src/server/repos/__tests__/tenant-isolation.test.ts`, editing
no existing block. In organization A's scope, against organization B's rows: `reserveExport` for B's trip
(`NotFoundError`, and A's `exports` counter has not moved); the list function for B's trip id (`NotFoundError`);
the download of B's artifact by its real task id (a 404, because the key is derived from A's organization id and
no such object exists in A's prefix); afterwards B's usage records and B's bucket prefix are byte-identical. And
the case specific to a counter rather than a row: A's reserve sees only A's count when B has already spent its
month's allowance, so a neighbour cannot exhaust A's plan. A viewer case: refused to request, allowed to list and
download. Functions covered: `reserveExport`, `releaseExport`, `exportAllowance`, `listExportArtifacts`,
`listExportKeys`.

**Browser evidence.** `e2e/documents-and-media.spec.ts`, one `test.describe('06-S3 — trip export', …)`. It imports
`visit` and `watchConsole` (`helpers/console.ts`), `settle` and `settleMutations` (`helpers/settle.ts`),
`useSession` and `hasSession` (`helpers/session.ts`), `applyTheme` and `THEMES` (`helpers/routes.ts`) and
re-implements none; the visual gate and baselines are retired (ADR 0016), and nothing is compared to a stored
pixel.

- **Nothing here writes to the shared demo workspace.** A real request would spend the demo workspace's monthly
  allowance and write R2, and the local dev server runs no queue consumer. The tests intercept the three server
  functions with `page.route(...)` and fulfil them with fixtures (an empty list, a list with one artifact, a
  `quota` refusal, a failed list); they assert on the requests the browser made (the request body carries
  `notify` and no email address), not on a stored artifact. The server behaviour is proved by the unit and
  isolation tests above, which is where it can be.
- **Selectors** (`[data-part="export-request"]`, the pending row's `data-state`) are verified against a running
  server with `page.locator(sel).count()` returning `1` before any frame is filed.
- **Console silent.** `watchConsole(page, route)` before navigation, `fatal` asserted empty at the end of every
  test in the block, including the polling one: a poll that logs is a poll that will log every three seconds in
  production. Nothing is added to `TOLERATED_CONSOLE_WARNINGS`.
- **No layout shift after paint.** A `layout-shift` `PerformanceObserver` as an init script (entries with
  `hadRecentInput` excluded), `visit()` then `settle()`, `performance.now()` as the mark; the sum after the mark,
  across the moment the pending row becomes a real artifact row, is `0`. Gated on `supportedEntryTypes`, with the
  WebKit skip stated as a skip.
- **A real keyboard path:** Tab reaches the switch and the button; Enter requests; the live region's text changes;
  the download is reachable without a pointer.
- **Frames**, read by a human, outside the repository: `scripts/visual/capture.mjs` for the resting route in the
  empty state and with one artifact (light and dark at 360x800, 1280x900, 2560x1440, `--auth`,
  `PT_SERVER_TODAY=2026-08-20`, the command quoted in full in the evidence). The pending, quota-refusal and
  list-error states cannot be reached by `--click` against the live server without writing, so the spec
  screenshots them at the same six viewport/theme pairs as test attachments from the intercepted fixtures.
- **Manual check for the checklist, not automated:** open a downloaded `.html` artifact and the PDF in a real
  viewer for one Arabic and one Polish trip.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                       | Applied default                                                                                                                                                                                                                                | Why                                                                                                                                                                                                                                      |
| --- | ------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Who may request, list and download an export?                                  | Request: trip `owner` and `editor`, guard inside `reserveExport`, before the counter. List and download: everyone who can read the trip, a viewer included. Archived trips are exportable.                                                     | Decided by the security and tenancy sub-agent (confidence high): a request spends a shared allowance (the booking-import precedent); a viewer already reads every field in the document.                                                 |
| 2   | In what language is the document, and does the payload change?                 | The requester's negotiated locale; one optional `locale: z.string().max(16)` on `pdfExportPayloadSchema`; the handler resolves it with `isSupportedLocale`, falls back to `en`, and writes `lang`, `dir`, footer and email from the catalogue. | Decided by the software architect sub-agent (confidence high): hardcoded copy is banned; `dispatch.ts` is the precedent; the field is additive and a string so a later locale never dead-letters. The plan's English-only rule is stale. |
| 3   | Does a deleted trip's export leave with it, and is the weekly cron half taken? | Yes for the first: `deleteTripFn` adds `listExportKeys` to the `trip-purge` keys. No for the second: stated as a follow-up issue filed by Phase 4; the in-flight and exported-once gaps are named.                                             | Decided by the software architect (confidence medium-high) and the security and tenancy reviewer (high): the product tells the owner a deleted trip is gone, and no other stage writes the purge for this key family.                    |
| 4   | Is the job id deterministic?                                                   | No: a fresh id per request. One request, one unit, one artifact.                                                                                                                                                                               | Decided by the software architect (confidence high): the `task:done:` marker covers redelivery only; a deterministic id would ack a second press as a duplicate while the unit was charged.                                              |
| 5   | When is the allowance counted, and how is the ceiling made race-free?          | At request time, reserve first: bump with the `YYYY-MM` period, assert on the returned value, release on refusal or failure after the reserve. `exportAllowance` is display only.                                                              | Decided by the software architect (confidence high): the plan's read, build, bump order overshoots under concurrency; the handler has no `TenantScope`, so counting there would put SQL outside the repositories.                        |
| 6   | How does a quota refusal reach the panel?                                      | `requestTripExportFn` returns `{ ok: false, reason: 'quota', limit, used, resetsOn }`; the panel writes the sentence from the catalogue.                                                                                                       | `QuotaExceededError` is not in `AUTHORED_ERROR_NAMES`, so a thrown one reaches the browser redacted; the plan's "say how many exports the plan includes and when it resets" needs the numbers.                                           |
| 7   | Where does the `exports/` key logic live?                                      | `src/server/storage/export-artifacts.ts`, bucket as a parameter; the handler imports it.                                                                                                                                                       | Three callers across the request boundary need it (handler, list/download, purge); `docs/SPEC.md` §8, and the `storage/objects.ts` precedent.                                                                                            |
| 8   | Prune before or after the new artifact is written?                             | After the artifact and the pointer are written, in a `try/catch` that logs and does not fail the job.                                                                                                                                          | A failed prune must never cost the traveller the document they asked for; a retried job would write the artifacts twice.                                                                                                                 |
| 9   | What happens to a plan longer than the document schema allows?                 | Cut to the bounds (56 days, 500 rows per section, sliced strings) with a localised note saying so.                                                                                                                                             | A document that fails the schema at the enqueue is a failed request with the plan in it; a visible cut is the smaller harm.                                                                                                              |
| 10  | Is the confirmation reference in the document?                                 | Yes, in the bookings section.                                                                                                                                                                                                                  | It is the thing a driver or companion needs, and it is shown only to people who can already read it on screen.                                                                                                                           |
| 11  | Files tab or planner toolbar?                                                  | The Files tab; the planner may grow a shortcut later.                                                                                                                                                                                          | The plan's reason stands: an export is a document the trip has, and the planner screen belongs to three other stages.                                                                                                                    |
| 12  | What happens to the journey-book variant of `DOC-06`?                          | Left open and unowned, named under Out of scope; not deferred to `08-S7`.                                                                                                                                                                      | The plan's measured reasons hold at HEAD: the payload needs a `tripId` and the document shape has no image.                                                                                                                              |
| 13  | How is the stage evidenced?                                                    | `e2e/documents-and-media.spec.ts`, existing helpers, server functions intercepted so nothing is written to the demo workspace, console and layout-shift assertions, frames from `capture.mjs` plus spec screenshots.                           | ADR 0016 retired the baselines and the `.visual.` spec; the local server has no queue consumer, and the demo workspace's monthly allowance is a shared resource.                                                                         |
| 14  | Does the stage keep the `trip_files`-row alternative or an index table?        | No to both; the list is read from R2.                                                                                                                                                                                                          | An export row would sit inside the traveller's file list and `files` quota; an index would be a second source of truth for a listing the prune keeps short.                                                                              |
| 15  | Is `attachmentHeaders` (from `06-S1`) required?                                | No. Used if present when Phase 3 is built; otherwise the same five headers are built inline, with a test.                                                                                                                                      | The two specs are independent and may land in either order; the headers must not diverge, which the test asserts.                                                                                                                        |
