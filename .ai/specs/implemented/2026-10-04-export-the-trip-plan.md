# Trip export: a button for the document the queue already knows how to write

| Field              | Value                                        |
| ------------------ | -------------------------------------------- |
| **Status**         | implemented                                  |
| **Issue**          | #885                                         |
| **Spec PR**        | #875                                         |
| **Implementation** | #1260, #1286, #1289, #1297, #1303                   |
| **Plan**           | 06-S3 (docs/plans/06-documents-and-media.md) |

## 📝 TLDR

Plan stage `06-S3` takes reference row `DOC-06` from `partial` to `done` **for the trip document** (the journey-book
variant is not built here, see Out of scope). The queue already has a complete `pdf-export` handler
(`src/server/queue/handlers/pdf-export.ts`) that renders a print-ready document into R2, and nothing in the product ever
enqueues it: no producer, no button, no way to read what it wrote. This stage builds the producer and the entry point on
the trip Files screen (`/trips/$tripId/files`): a **Trip export** panel that asks for a document, waits for it without a
spinner that lies, lists the artifacts that exist and downloads one.

It is also a **storage stage**. Every export writes bytes into R2 that no row counts, and today nothing deletes them (the
KV pointer expires after seven days, the objects never do). The stage therefore owns the retention of what it makes
possible: a prune that rides the job, a read side that never serves an expired artifact, a purge of a deleted trip's
artifacts, and the first `assertQuota` call site the `exports` metric has ever had.

No schema change, no migration, no route added, no package added. **Four tickets**, each a slice a traveller or a
maintainer can see work, in this order: the artifact the handler writes (06-S3a), an owner exports the trip and downloads
it (06-S3b), everyone else on the trip and the email (06-S3c), a deleted trip's exports leave with it (06-S3d).

This spec describes the work that is **left** at HEAD (`e75063c7`). It departs from the plan's stage block where the code
the plan cites has changed or a specialist found the plan wrong. Every departure is a row of the Resolved assumptions table.

## 📝 Problem Statement

What exists at HEAD, measured:

- **A handler nobody calls.** `handlePdfExport` takes `{ tripId, requestedBy, document, notify? }`, writes
  `exports/<orgId>/<tripId>/<taskId>.html` (and a `.pdf` beside it when `BROWSER_RENDERING_API_TOKEN` and
  `CLOUDFLARE_ACCOUNT_ID` are set) into the `FILES` bucket, writes a KV pointer with a seven-day TTL and optionally
  enqueues an `email` task. `grep -rn "pdf-export" src` finds the consumer's table, the payload schema and the handler's
  tests (`handlers/__tests__/metering.test.ts`); no server function enqueues it.
- **No way to ask, to see or to fetch.** No server function, no route and no component mentions an export. Nothing lists
  `exports/<orgId>/<tripId>/` and nothing serves an object under it.
- **A link that goes nowhere.** The "ready" email links to `${APP_URL}/app/trips/<tripId>/exports/<taskId>`
  (`pdf-export.ts:196`). This router has no `/app` prefix and no `exports` child route.
- **English in the shell.** The handler hardcodes `<html lang="en">`, the word "generated" in the footer, and the email
  subject and body. `docs/SPEC.md` §9 bans hardcoded copy, and an Arabic trip would be rendered left-to-right and announced
  as English.
- **A document that fails two checks of its own.** `td.meta` and `footer` are `#89877f` on white (about 3.6:1, under the
  4.5:1 WCAG 2.2 AA asks for at 8 to 10.5 pt), the bold label cell is not a row header, and `td.meta` is
  `text-align: right`, which is wrong for a right-to-left document.
- **Bytes that never expire.** `EXPORT_TTL_SECONDS` is applied to the KV pointer only. Nothing in `src/` deletes an object
  under `exports/`. The weekly cron `17 4 * * 1` is registered as "retention prune of expired backups and export artifacts"
  (`wrangler.jsonc:178`), and `src/server/worker.ts` still answers that half with `logger.warn('cron half has no handler
yet')`. A trip deleted today takes its attachments with it (`trip-purge`, from `listTripStorageKeys`) and would leave its
  exports behind, because an export is not a `trip_files` row.
- **A metric sold and never enforced.** `exports` is in `USAGE_METRICS` and in `PLAN_QUOTAS` (free 3, starter 25, pro 250,
  business unlimited, per month). `grep -rn "assertQuota(" src/server/repos` finds eleven call sites (`journey.ts`,
  `files.ts` twice, `trips.ts` four times, `members.ts` twice, `places.ts`, `collections.ts`), none of them `exports`.

The reader this serves: a traveller who wants to hand the trip to someone who has no account (a parent, a driver, a
travelling companion in another workspace) as one file that opens on any phone and prints. The reference product has no
server-side renderer at all: it prints through the reader's own browser dialog (`wiki: PDF-Export`), which caps fidelity and
makes "send me the file" impossible. We already render on the server, off the request path, into R2, and
`docs/plans/README.md` names that as one of the four things we are ahead on. This stage keeps it.

## 📝 Proposed Solution

### What the stage owns and what it does not

| Owned (this stage writes it)                                                                                                                                                                                                                       | Not owned (read only, or left alone)                                                                                          |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `src/server/storage/export-artifacts.ts` - new, pure: the `exports/` key family, the grouping of a listing into artifacts, the prune, `listExportKeys`                                                                                             | `src/server/db/schema.ts`, `drizzle/` - **no schema change, no migration**                                                    |
| `src/server/storage/__tests__/export-artifacts.test.ts` - new; `fake-bucket.ts` - edit: a `list` verb with a page size                                                                                                                             | `src/server/worker.ts`, `wrangler.jsonc` (the weekly cron half stays unwritten, Out of scope)                                 |
| `src/server/queue/handlers/pdf-export.ts` - edit: scope re-check, locale, working ready link, document accessibility, completion order, prune; key helpers move out to the storage module                                                          | `src/server/queue/consumer.ts`, `src/server/queue/jobs.ts`                                                                    |
| `src/server/queue/types.ts` - edit: **one** optional `locale` field on `pdfExportPayloadSchema`                                                                                                                                                    | `src/server/queue/handlers/trip-purge.ts` - unchanged: its namespace guard already admits `exports/<org>/...`                 |
| `src/server/queue/handlers/__tests__/pdf-export.test.ts` - new; `metering.test.ts` - edit: its `FILES` fake gains `list` and its environment gains what the scope re-check reads                                                                   | `src/server/repos/files.ts`, `src/server/fns/files.ts` (`06-S2` and `06-S1`'s paths; no export row is a `trip_files` row)     |
| `src/server/repos/exports.ts` - new: reserve and release one unit of the monthly allowance, and the display-only allowance; `repos/index.ts` - append one export line                                                                              | `src/server/repos/billing.ts`, `transports.ts`, `reservations.ts` - used as they are                                          |
| `src/server/repos/__tests__/exports.test.ts` - new; `tenant-isolation.test.ts` - append one `describe`                                                                                                                                             | `src/styles/tokens.css`, `src/components/ui/**` - no token and no primitive is missing                                        |
| `src/server/fns/export-document.ts` - new, pure: trip data to `ExportDocument`, in the requester's language                                                                                                                                        | `package.json`, `pnpm-lock.yaml` (frozen, `docs/SPEC.md` §3)                                                                  |
| `src/server/fns/exports.ts` - new: request, list, download; `src/server/fns/__tests__/export-document.test.ts`, `exports.test.ts` - new                                                                                                            | `src/routes/_app/trips/$tripId/-ui/**`, the planner screen (held by `01-S2`, `01-S4`, `07-S1`)                                |
| `src/routes/_app/-server/trip-lifecycle.ts` - edit, **additive**: `deleteTripFn` also hands a deleted trip's export keys to `trip-purge`                                                                                                           | `src/routes/_app/-server/trip.ts` (`loadTripFiles`) - the panel loads its own list after hydration                            |
| `src/components/modules/files/export-panel.tsx` (and a small `export-pending.ts` for the persisted pending row) - new; `files/index.ts` - append; `src/components/modules/shared/panel.tsx` - additive `headingProps` passthrough on `ModulePanel` | `src/components/modules/files/file-library.tsx`, `download.ts`, `upload-queue.ts`, `screening.ts` (`06-S1`, `06-S2`, `06-S4`) |
| `src/routes/_app/trips/$tripId/files.tsx` - edit: mounts the panel, reads the `export` search parameter, one header action                                                                                                                         | `src/routeTree.gen.ts` - no route file is added, so `pnpm generate-routes` does not run                                       |
| `src/lib/i18n/messages/<locale>/modules.ts` - edit, **all 23 locales**                                                                                                                                                                             | The hardcoded English elsewhere on the Files screen (`06-S1` files one issue for it)                                          |
| `e2e/documents-and-media.spec.ts` - a `06-S3` describe block (the file is this plan's spec file; whichever of `06-S1` and this stage lands first creates it, the other appends)                                                                    |                                                                                                                               |
| `docs/ACCESS.md` - one line in §3 (a trip export carries confirmation codes only when asked); `CONTEXT.md` - the **Trip export** glossary entry; this spec's `Status` and `Implementation` rows and the regenerated `.ai/specs/README.md`          |                                                                                                                               |

Three plan statements are stale at HEAD and the spec does not repeat them. `src/server/queue/handlers/__tests__/`
**exists** (seven files already, including the handler's current tests in `metering.test.ts`). The weekly cron is **partly
written**: the audit prune and the provider-usage roll-up run in that slot, and only the retention half is missing. And
`00-S4`'s claim on `queue/types.ts` has not changed what this stage needs from it, which is one optional field.

**Departures from the plan that touch a file the plan told this stage to leave alone** (Resolved assumptions 2 and 3):
`src/server/queue/types.ts` gets one additive optional field, and `src/routes/_app/-server/trip-lifecycle.ts` gets one
additive call. Both are small enough to merge cleanly beside whatever `00-S4`, `07-S8` or a later `01-S*` stage does to
those files, and neither is optional: without the first the document's shell cannot be written in the traveller's language,
and without the second a deleted trip's whole plan stays in the bucket for ever.

### What a trip export is, and who sees it

A **trip export** is a document the trip has, produced from the trip as it stands when the traveller presses the button. It
is a snapshot, not a live view: editing the trip afterwards does not change an existing export, and exporting again makes a
new one. It covers the plan and the record (days, stops, reservations, transport and stays), which is why the glossary term
is **Trip export** and not "plan export": `CONTEXT.md` defines a trip's plan as excluding its record.

- **Who may ask.** A trip `owner` or `editor`. A request spends one unit of the **workspace's** monthly allowance (three on
  the free plan, shared by everyone in it) and writes bytes into the workspace's storage, which is the reason the booking
  import already refuses a viewer before it enqueues (`startBookingImport`).
- **Who may see and fetch one.** Everyone who can read the trip: a viewer, and any workspace member who can read an
  `organization`-visible trip with no trip role at all (`readableTripFilter`). Every list and every download re-runs
  `requireTrip`, so a person who leaves the trip or the workspace loses access at once, and a member who is not on a
  private trip gets `NotFoundError` (ADR 0007). The panel tells a viewer why they cannot make one instead of hiding the
  section: they came here for the document.
- **Confirmation codes are off by default.** `docs/ACCESS.md` §3.1 says people without an account never see reservation
  confirmation codes, ticket numbers or booking references, and a trip export exists to be handed to exactly those people.
  The request carries `includeReferences: boolean`, default `false`, drawn as a checkbox ("Include confirmation codes").
  Without it the document still lists each reservation and transport with its title, provider, place and time.
- **An archived trip can be exported.** Exporting reads; `requireTrip`, not `requireWritableTrip`. A finished trip is the
  commonest thing to hand over as a document.
- **A share-link guest is not here.** Guests never reach `appScope()`; these functions are for members.

### Phase 1 (06-S3a) - the artifact the handler writes

The handler's output is the thing a traveller will hold, so it is made right before anything can request it.

**`src/server/storage/export-artifacts.ts` (new, pure).** The `exports/` key family is one concept with one owner, and three
callers need it (the handler, the list and download functions, the trip purge), so it lives here and the handler imports it.
It takes a **minimal structural port**, `ExportStore = { list(options), delete(keys) }` (the shape `R2Bucket` and
`TaskBindings.FILES` already satisfy: `FILES` carries `list`, `head` and `delete`), so a queue handler and a server function
can both call it and the module pulls no `cloudflare:workers` into the consumer's graph. The download does **not** go through
the port: it streams through the real `R2Bucket` from `filesBucket()`, because `ObjectStore` in `storage/objects.ts` has no
`list` and `TaskBindings.FILES.get` returns only `{ body, size }`.

- `EXPORT_TTL_SECONDS` (`7 * 24 * 60 * 60`) and `EXPORT_KEEP_COUNT = 5` move here. `exportObjectKey` and `exportPointerKey`
  move here and are re-exported from the handler's module only if `grep` finds an importer outside it.
- `exportPrefix(orgId, tripId)` is `exports/<orgId>/<tripId>/`. **The trailing slash is the point**: without it
  `exports/<org>/<trip>` also matches a trip whose id begins with the same characters.
- **R2's paging contract is part of the design.** `list` answers at most 1000 objects per call, with a `cursor` and a
  `truncated` flag, and in **lexicographic key order, not by time**. So every function here pages the **whole** prefix
  (`while truncated`) and only then sorts by `uploaded`; none trusts the order a page arrives in.
- **An artifact is ready when its `.html` exists.** The handler writes the `.pdf` (when it renders one) **first** and the
  `.html` **last**, then the pointer, so the `.html` is the completion marker. `listExportArtifacts(store, orgId, tripId,
{ now })` groups the objects by task id (the file name minus its extension) and returns an artifact only when its `.html`
  is present: `{ taskId, format: 'pdf' | 'html', sizeBytes, createdAt }`, **`pdf` when a `.pdf` object also exists, else
  `html`**, the size and instant of the object the format names. An object whose name does not parse as `<taskId>.html|pdf`
  is ignored, not deleted. Newest first. A poll can therefore never see "ready" and then watch the format change under the
  reader.
- **The read side enforces the retention.** `isExpired(createdAt, now)` is `now - createdAt > EXPORT_TTL_SECONDS * 1000`;
  `listExportArtifacts` omits an expired artifact and the download refuses one (Phase 2). The prune is what frees the bytes;
  the read side is what keeps "kept for 7 days" true for a trip exported once and never again, until the weekly cron half is
  written.
- `listExportKeys(store, orgId, tripId)` is every key under the prefix, for the purge (Phase 4).
- `pruneExportArtifacts(store, orgId, tripId, { now })` deletes **every object of every artifact** that is older than
  `EXPORT_TTL_SECONDS`, then every artifact beyond the newest `EXPORT_KEEP_COUNT`, through the existing chunked
  `deleteObjects`. Bounded by construction: one paged listing and a handful of delete calls. A trip exported twice a day
  converges on five artifacts instead of growing. It also deletes a lone `.pdf` whose `.html` never arrived once it is older
  than the TTL.

**`pdf-export.ts` (edit).**

- **The scope is re-checked before anything is written.** The handler rebuilds the requester's scope the way `trip-copy.ts`
  does (`databaseFor(context.env.DB)`, `getMembership`, `scopeFor`, then `requireTrip`), and a requester who has left the
  workspace or a trip that is gone is a `TaskPermanentError` **before** an object is written or an email is sent. A missing
  `DB` binding is a `TaskConfigurationError`, as there. This closes two gaps the plan did not see: an export still in flight
  when the trip is deleted, and a "ready" email to someone who has left. The handler reads for authorisation only; the
  document stays the one the request built.
- **The prune runs after the artifact is durable**, never before: the `.pdf` (if any), then the `.html`, then the pointer,
  and only then the old ones are removed, so a failed prune can never cost the traveller the document they asked for. The
  prune is wrapped in `try/catch` and a failure is a `logger.warn` with the trip and the error, **not a failed job**: a failed
  prune is housekeeping, and failing the job would make the queue retry a render that already succeeded.
- **A retry costs a render, not a duplicate.** The artifact keys are deterministic on the envelope id (`context.taskId`), so a
  redelivered job overwrites the same keys; what a retry really costs is a second metered Browser Rendering call, which
  `context.callProvider` already meters.
- **A `locale` on the payload.** `pdfExportPayloadSchema` gains `locale: z.string().max(16).optional()` in
  `src/server/queue/types.ts`: a string and not an enum, so an envelope enqueued by a later build that knows a
  twenty-fourth locale never dead-letters. The handler resolves it with `isSupportedLocale` and falls back to `en`. A message
  already on the queue parses unchanged, because the field is optional.
- **The shell is written from the catalogue**, through `loadCatalogue(locale)` and `createTranslator`, the way
  `renderNotificationEmail` does it (`src/server/notifications/dispatch.ts`): `<html lang>` from the locale, `dir` from
  `directionOf(locale)`, the footer and the email subject, body and link text. `renderExportDocument` takes the locale and the
  translated footer as arguments, so it stays a pure function. The footer's time goes through the locale formatters of
  `src/lib/format.ts`, not an ISO slice.
- **The document is accessible.** `td.meta` and `footer` move to `#6e6d65` (about 5.2:1, a colour the sheet already uses);
  the bold label cell is a `<th scope="row" class="label">` and the stylesheet selects `th, td` and `th.label { text-align: start; font-weight: 500 }` (a `th` is centred and bold by default, which would centre the label column in both directions); `td.meta` is `text-align: end`; one `<h1>`, one `<h2>` per
  section; and `tagged: true` is passed explicitly in the Browser Rendering `pdfOptions` instead of relying on a library
  default.
- **The ready link is a route that exists:** `${APP_URL}/trips/<tripId>/files?export=<taskId>`, with `encodeURIComponent` on
  both ids, the one Phase 3's panel reads to mark the artifact. The link opens a page, so the email's action is "Open
  {title}", and the body says how long the export is kept.
- **`escapeHtml` stays the only way text reaches the markup, and it runs after interpolation.** The email HTML escapes the
  **translated string with the title already in it** (the precedent at `dispatch.ts:429`), not the title alone; a test uses a
  `<script>` title. The `<html dir>` and `lang` attributes come from a closed set (a supported locale tag), never from the
  document.
- **The `.html` artifact is served as an attachment** (Phase 2), never rendered inline by the app, and its content is escaped
  text and a literal print stylesheet: no script, no remote resource, no form.

**Tests.** The invariants are listed under Verification. The existing `pdf export` block in `metering.test.ts` keeps
passing, with its `FILES` fake gaining a `list` that answers an empty listing and its environment gaining what the scope
re-check reads; the shared `fake-bucket.ts` gains a `list` verb (prefix, cursor, `uploaded`, **a small page size**) so the
storage tests and the handler tests use one fake and exercise the cursor loop.

**The Docs-and-CI grep (this ticket runs it).** Search `docs/`, `AGENTS.md`, `README.md`, `CONTEXT.md`, `wrangler.jsonc`,
`src/` and `.ai/` for `pdf-export`, `exports/`, `EXPORT_TTL`, `/app/trips`, `export artifact` and `retention`. Update every
document that states what the handler writes, how long it is kept or where its link points; the hits known at HEAD are
`docs/CATALOG.md`, `wrangler.jsonc:178` (a comment, correct as written until the cron half lands) and the dated
`.ai/specs/implemented/2026-09-07-copy-a-trip.md` (a record, not rewritten). Add **Trip export** to `CONTEXT.md` (a snapshot
document of one trip's plan and record, made on request, kept for seven days, at most five per trip). The pull request body
names the terms searched.

### Phase 2 (06-S3b) - an owner exports the trip and downloads it

One ticket that ends with something a traveller can do: press the button, wait, and hold the file. It is the largest, and it
is cut along no layer: the allowance, the document builder, the three server functions and the panel's core states ship
together, because none of them is usable alone.

**`src/server/repos/exports.ts` (new).** Small on purpose: the ceiling is asserted where every other ceiling is, in a
repository.

- `reserveExport(scope, tripId, { month })`:
  1. `requireTrip(scope, tripId)`, **then** `assertTripRole(scope, tripId, ['owner', 'editor'])`: the order
     `startBookingImport` and `readTripForDelete` use, so "not yours" and "not there" stay indistinguishable (ADR 0007: a
     trip in another workspace is `NotFoundError`, never `TripRoleError`), and a viewer is refused **before** the counter
     moves. Both live here so they hold for any future caller, not only the server function;
  2. `bumpUsage(scope, 'exports', 1, month)`: **reserve first**. The increment is in SQL with `.returning()`, so the row it
     returns carries the post-increment value. `bumpUsage` reads before it inserts, so two simultaneous first exports of a
     month can both try the insert and the unique index on `(organization_id, metric, period)` makes the loser throw having
     reserved nothing: the bump is **retried once** on a constraint error (required, not optional), so a legitimate first
     export of the month is never a redacted failure;
  3. `assertQuota(scope, 'exports', row.value - 1)` on that value. If it throws `QuotaExceededError`, the unit is released
     **once, here** (`bumpUsage(..., -1, month)`, best effort) and the error is rethrown. The ceiling comes from
     `resolveLimits()` through `assertQuota` like every other metric.
     Returns `{ used: row.value, month }`.
- `releaseExport(scope, { month })` is `bumpUsage(scope, 'exports', -1, month)`. **It covers only a failure after
  `reserveExport` has returned, up to and including the `queue.send`.** A quota refusal was already released inside
  `reserveExport` and is never released again; a reserve that throws (the first-insert constraint error after its retry)
  released nothing and the caller releases nothing. The release uses the `month` the reserve returned, not a fresh clock read.
  If the release itself fails the caller logs it and lets the unit leak: a lost unit is the safe direction.
- `exportAllowance(scope, { month })` returns `{ used, limit | null }` for the panel's "n of 3 used", from `getMonthlyUsage`
  and `resolveQuotas`. It is **display only**: it is never the gate, because a read followed by a write is the check-then-act
  race the reserve-first order removes.

**Why reserve first and not the plan's check, build, bump, enqueue.** `assertQuota` is a pure comparison of a value the
caller read earlier. With a read, a document build (several repository reads) and a bump, two concurrent requests on the
free plan can both read two and both bump, ending at four of three. `bumpUsage` is atomic in SQL, so using its returned value
as the gate means at most `limit` requests get through. `bumpUsage` defaults its period to `'all'`: the call **must** pass the
`YYYY-MM` month, or the monthly counter never moves and the unit is spent against the cumulative bucket. The month is
`serverToday().slice(0, 7)` (`src/server/clock.ts`), the clock the rest of the product reads, so a pinned test day and the
counter agree.

**Stated deviation from `ARCHITECTURE.md` §6.** This is the one ceiling in the plan read from `usage_records` and not from a
live `COUNT(*)`. There is no table of exports to count, and counting R2 objects is a listing the prune deliberately keeps
short, so it would under-count by design. A job that dead-letters after it was enqueued keeps its unit: the counter counts
requests accepted, and the panel says "used", not "made". The business tier is unlimited and so has **no rate limit**: every
export can spend the platform's Browser Rendering and Resend ceilings (see Risks).

**`src/server/fns/export-document.ts` (new, pure).** `buildExportDocument(input, t, locale, { includeReferences })` turns the
trip into the existing `ExportDocument` (`src/server/queue/types.ts`): a title, an optional subtitle and up to 60 sections of
up to 500 `label` / `value` / `meta` rows. **It does not add a second payload shape**: a test parses the built payload with
`pdfExportPayloadSchema`.

- _Title_ is the trip's title; the _subtitle_ is the destination and the date range, the dates through `src/lib/format.ts`
  (`docs/SPEC.md` §9 rule 5, no raw `Intl`).
- _Overview_ section: the trip's summary as a note, and its time zone and number of days as rows. **There is no status row**:
  a raw status value would be untranslated, and a document someone else reads has no use for it.
- _One section per day_, headed `Day N - <date>`: one row per stop, in order, `label` the place's name, `value` its address or
  city, `meta` the start time. A day with no stops is a section with a note and no rows. Notes the planner already stores for
  the day go in the section's `note`.
- _Reservations_ section (**not** "Bookings": `CONTEXT.md` says to avoid that word for a Reservation): one row per
  reservation in date order, `label` the title, `value` the provider and location, `meta` the date and time. **`cancelled`
  reservations are left out.** `Ref. <confirmation number>` is appended to `value` **only when `includeReferences` is true.**
- _Transport_ section: one row per transport record from `listTripTransports(scope, tripId)` (travel order, dated first),
  `label` the title, carrier and service number, `value` the route and the seat, `meta` the departure date and time. The route
  is joined through the catalogue key `files.export.doc.route` (`{from} to {to}`), **never a literal arrow or an English "to"**:
  an arrow is not mirrored and points the wrong way in an Arabic document. **`cancelled` and `idea` transports are left out**:
  there is no status row, so a reader could not tell a flight someone only considered from a booked one. `Ref. <booking code>` is appended only
  when `includeReferences` is true. A chained journey is one record in this section: its legs are not listed. A flight on a
  trip must not export without the flight, and a day plan that leaves out the train a driver must meet is the half of the
  document the reader came for.
- _Where we are staying_ section: one row per stay **by stay id** (`getTripItinerary` repeats an accommodation on every day it
  spans, so the builder keeps the first occurrence), `label` the name, `value` the address, `meta` the nights.
  `Ref. <confirmation number>` (the stay's `confirmationNumber`) is appended to `value` **only when `includeReferences` is
  true**, so the checkbox covers every code in the file, the hotel's included.
- **Sizes are held by construction, and a cut is said out loud.** The schema allows 60 sections and 500 rows per section;
  every string is sliced to its bound. A plan longer than 56 days (60 minus overview, reservations, transport and stays) keeps
  its first 56 days and says so in the overview note; a list longer than 500 rows keeps its first 500 and its section note
  says "Showing the first 500 of N". **The schema's bounds are not the real ceiling: the document travels inside the queue
  message, and a Queues message body is capped at 128 KB** (`src/server/queue/types.ts`, which says so for `trip-purge` too).
  500 rows of 175 bytes is already 88 KB, and Arabic, Japanese or Polish text costs two to three bytes a character. So the
  builder also holds a **serialised-size budget of 100 KB** (`new TextEncoder().encode(JSON.stringify(document)).length`): when
  the document is over it, the builder drops rows from the end of the longest section, one at a time, until it fits, and the
  same truncation note says how many were shown. The test uses a multibyte fixture (a 700-reservation trip with Japanese
  titles). A document that would fail the schema, or the queue's cap, at the enqueue is a failed request with the traveller's
  plan in it, which is the worse outcome.
- **The locale is the requester's:** `getEffectiveSettings(scope).locale` through `negotiate`, the same chain the shell uses,
  and the headings come from the catalogue through `loadCatalogue` and `createTranslator`, with `en` as the fallback for a
  locale tag the catalogue does not carry. User-entered text (titles, notes, place names) is copied as entered and never
  translated.

**`src/server/fns/exports.ts` (new).** Three functions; **none of them renders anything**, and each starts at `appScope()`.

| Function               | Method | Input                                   | Returns                                                                                                                      |
| ---------------------- | ------ | --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `requestTripExportFn`  | POST   | `{ tripId, notify, includeReferences }` | `{ ok: true, taskId, queuedAt }` or `{ ok: false, reason: 'quota', limit, used, resetsOn }`                                  |
| `listTripExportsFn`    | GET    | `{ tripId }`                            | `{ artifacts: [{ taskId, format, sizeBytes, createdAt }], canRequest, allowance: { used, limit \| null, month, resetsOn } }` |
| `downloadTripExportFn` | GET    | `{ tripId, taskId }`                    | a raw `Response` streamed from R2, or a 404 `Response` with the JSON code `{ error: 'missing' }`                             |

- **`requestTripExportFn`** in this order, each step before the next can cost anything: `requireTrip`; `reserveExport` (trip
  visibility, role, the reserve, the ceiling); build the document from tenant-scoped repository reads (`getTripItinerary`,
  `listTripDayNotes`, `listTripReservations`, `listTripTransports`); `enqueueTask(taskQueue(), { kind: 'pdf-export', orgId,
payload })` with **no `id`**, so the queue assigns a fresh UUID; return as soon as the message is on the queue. If anything
  after the reserve returned throws, `releaseExport` runs with the reserve's `month` and the error is rethrown. `notify: true`
  puts the **session user's own email**, read on the server, into the payload; the browser never supplies an address.
  `payload.requestedBy` is `scope.ctx.userId`, `payload.locale` the requester's locale. A `QuotaExceededError` is **returned**,
  not thrown: it is not in `AUTHORED_ERROR_NAMES`, so a thrown one would reach the browser as a redacted failure, and the
  panel needs the numbers to write a sentence. `resetsOn` is the first day of the next month in `YYYY-MM-DD`.
- **Why a fresh id and not a deterministic one.** The consumer's `task:done:<id>` marker is written only after the handler
  succeeds, so it protects redelivery of one message (the id travels with the envelope) and nothing else. A deterministic
  `export:<tripId>:<minute>` would, once the first job finished, ack the second press as a duplicate and produce nothing while
  the unit was still charged. One request, one unit, one artifact, one id. The disabled-while-pending button is a courtesy; the
  allowance is the guard, and a double press costs two units and two artifacts, never an overshoot.
- **`listTripExportsFn`** runs `requireTrip`, lists through `listExportArtifacts` on `filesBucket()` for the caller's own
  `orgId` and the resolved trip's id with the server clock (so expired artifacts are omitted), and answers `canRequest` from
  the caller's trip role. **R2 is the ground truth** for what exists: no index is kept, and the KV pointer stays the handler's
  own record and is never the list's source.
- **`downloadTripExportFn`** runs `requireTrip`, validates `taskId` against the id pattern the queue mints
  (`^[A-Za-z0-9-]{1,128}$`, so no `/` and no `..`), **derives the object key from the caller's own organization id and the
  resolved trip id**, never from a value the browser supplied, requires the `.html` completion marker, tries the `.pdf` and
  then the `.html`, refuses an expired artifact, and streams the one it finds. **Every miss is the same 404** with the code
  `{ error: 'missing' }`: "pruned" and "never existed" cannot be told apart without the KV pointer, which is keyed
  `export:<taskId>` with no organization in it and must stay unread, and a code (not an English sentence) lets the panel say it
  in the traveller's language. Headers:
  - `content-type` from **a fixed map on the extension the server tried** (`pdf` to `application/pdf`, `html` to
    `text/html; charset=utf-8`), never the stored object's metadata and never anything the browser sent;
  - `content-length`, `cache-control: private, no-store`, `x-content-type-options: nosniff`;
  - `content-disposition: attachment; filename*=UTF-8''<encodeURIComponent(sanitiseFilename(<trip title>-<date>.<ext>))>`,
    built as `files.ts:336` builds it;
  - for the `.html` response, `content-security-policy: sandbox; default-src 'none'; style-src 'unsafe-inline'`.
    If `06-S1`'s `attachmentHeaders` has landed when this ticket is built the header set comes from it; otherwise it is built
    inline and the follow-up is a one-line swap. The two must not diverge, and a test asserts the headers.
    A task id from another workspace resolves to a key inside the caller's own prefix, which does not exist: a 404. **There is
    no id-shaped path into another tenant's artifact.**
- **Zod (v4 idiom).** `z.strictObject()` with the `error` parameter; ids as the existing trimmed bounded string (`taskId`
  `z.string().trim().min(1).max(128)`: **the id pattern is checked in the handler and answers the 404, not in the schema**, so
  a malformed id and a foreign one are the same answer); `notify` and `includeReferences` as `z.boolean()`. Validation is shape
  and decides nothing about permission.
- **Authorisation is decided in the handler**: `appScope()` then `requireTrip()` before anything is read, built or enqueued.
  `beforeLoad` is UX and is not a data boundary here or anywhere.

**`export-panel.tsx` (new)** - the core of the panel, one product component inside the module this plan owns, built from
existing primitives only: `ModulePanel` with `SectionLabel`, `Button`, `CheckboxField`, `Badge`, `Spinner`, `Skeleton`,
`EmptyState`, `Alert`, `ModuleRow`, `toast`, plus `useAction` from `modules/shared`. No new primitive, nothing filed to
foundations. It sits under the file library as its own `ModulePanel` and holds, in this ticket: the description and the
`kept` line, the request `Button` (`data-part="export-request"`), the confirmation-codes `CheckboxField` (off by default),
the artifact list as a `div role="list"` of `ModuleRow`, the pending row, and the empty, skeleton, list-error and quota-refusal states. The
state design, focus and live-region rules are under "The panel's states, focus and announcements" below and apply from this
ticket; 06-S3c adds the notify checkbox, the allowance line, the viewer view, the email and the link. **The request button
and the confirmation-codes checkbox are drawn only when `canRequest` is true from this ticket**, so a viewer never meets a
button that always answers `TripRoleError`; the viewer's sentence and empty state arrive in 06-S3c.

### Phase 3 (06-S3c) - everyone else on the trip, and the email

- **The allowance line** ("2 of 3 exports used this month") from `exportAllowance`. When `used >= limit` the panel shows the
  quota sentence **as plain text linked to the disabled request button with `aria-describedby`**, using the `resetsOn` the list
  returns (so the client does no date arithmetic), and **disables the request button before the traveller presses it**; the
  server stays the gate. The `danger` `Alert` (`role="alert"`) is kept for a refusal **after** a press, otherwise it would be
  announced on every page load.
- **The notify checkbox** ("Email me when it is ready") sets `notify`; the handler's email (Phase 1) is what arrives.
- **A viewer** sees the list, the download actions and one sentence ("Only owners and editors can create an export. You can
  download the ones that exist."), **shown only when at least one artifact exists** (the empty state carries its own line),
  and no request button, no checkboxes. The server refuses the request regardless (`canRequest` only draws the affordance). A
  viewer's empty state has no action and says an owner or editor can make one. **A viewer is never told to do what they
  cannot:** the `missing` and `linkGone` sentences have viewer variants without "export again" / "make a new one".
- **`?export=<taskId>`.** The route gains `validateSearch` for `export` with the same `^[A-Za-z0-9-]{1,128}$` pattern and a
  `.catch` so a damaged link yields no search value instead of the English route error. The panel matches the value **against
  the list it holds**, never puts it into a selector or into markup. On a match the row gets the text badge "From your link",
  the live region says the export is ready and names it, and the row is scrolled to **instantly** (`behavior: 'instant'`:
  `html` is smooth-scrolled outside reduced motion and a long smooth scroll breaks the 400 ms rule) with a `scroll-mt-*` that
  clears the sticky top nav and the trip sub-nav. An id that is **not** in the list shows one line, "That export is no longer
  kept. Make a new one below.", because the email's link may outlive the artifact and saying nothing would look like a broken
  page. **The line appears only after a list has loaded successfully**: never while the skeleton is up and never after a failed
  first load, or every email link would briefly say the export is gone. It goes through the **same `role="status"` region**, so
  it is announced; the e2e asserts the region's text both when the id matches and when it does not.
- **A secondary header action** in `TripModuleHeader`'s `actions` slot ("Go to exports") scrolls to the panel and focuses its
  heading, because under a long file list on a 360 px phone nobody would find it. It calls `focus({ preventScroll: true })` and
  then `scrollIntoView({ behavior: 'instant', block: 'start' })`, and the heading carries the same `scroll-mt-*` as the marked
  row so it lands below the sticky header (the e2e asserts the heading's top edge is below the header's bottom edge). It is a
  navigation aid, not a second request control, and its name differs from the request button's.
- **A reload while an export is pending keeps the pending row.** The panel keeps pending `{ taskId, queuedAt }` pairs per trip
  in `sessionStorage` (`export-pending.ts`) and restores them on mount while they are inside the 90 s window, with the request
  button still disabled: a traveller who reloads must not spend one of the free plan's three exports to find out.

### Phase 4 (06-S3d) - a deleted trip takes its exports with it

`deleteTripFn` already hands the keys of the trip's attachments and its cover to the `trip-purge` handler, which deletes only
keys in its payload and refuses any key whose second segment is not the organization. An export is not a `trip_files` row, so
its artifacts are not in that list: today a deleted trip's whole plan would stay in R2 for ever, and once the trip is gone
`requireTrip` refuses every request, so the Phase 1 prune can never run for it.

- `enqueueTripPurge(scope, tripId, keys)` (`trip-lifecycle.ts`) is given the export keys too. In `enqueueTripPurge` the early
  return on an empty key list comes **before** its `try`, so the export keys are read **before that early return, in a
  `try/catch` of their own**: `listExportKeys(filesBucket(), orgId, tripId)`; a failed listing logs a `warn` and the purge
  **continues with the keys from D1**, so the delete never fails and the attachment purge is never dropped. The export keys are
  then added to the list the existing chunking (`MAX_PURGE_KEYS`) and `tripPurgeTaskId` already handle. No new task kind, no
  new payload field. A trip with no attachments and one export is not skipped.
- `trip-purge.ts` is **unchanged**: `exports/<org>/<trip>/<task>.pdf` has the organization in the second segment, which is the
  position its `belongsTo` guard reads.
- **What remains is stated, not hidden:** a trip exported once and never touched keeps its (unreadable, past seven days)
  artifact until the weekly retention cron half is written. This ticket files **two follow-up issues**: the cron half (it needs
  `worker.ts`, a shared entry, and prunes `exports/` prefix-wide and the orphaned upload objects the plan's area brief names,
  labelled for the foundations plan), and the **journey book** (see Out of scope). The in-flight case is narrowed by Phase 1's
  scope re-check to a short window (a job that passed the re-check just before the delete can still write an artifact the purge
  never listed); that artifact is unreadable once `requireTrip` refuses the trip, and the cron half frees its bytes.

### The panel's states, focus and announcements (applies from 06-S3b)

**Route.** `/trips/$tripId/files`, an existing file, edited to mount one section. No route file is added,
`src/routeTree.gen.ts` is untouched, the route stays on the default SSR.

**Why the Files tab and not the planner.** The reference puts the trigger in the day plan's toolbar. A trip export **is** a
document the trip now has, so it belongs where the trip's documents are; and the planner screen is held by `01-S2`, `01-S4`
and `07-S1`, so a trigger there would be a same-wave claim on a file another stage is rewriting.

- **The list is read after hydration** through `listTripExportsFn` (the Files loader is untouched), so the list has a genuine
  pending state. Sizes are `formatStorageSize(bytes, locale)` (`src/components/layout/storage-size.ts`), ages `formatRelative`,
  `resetsOn` `formatDate` (not `formatStorage` in `src/lib/plans.ts`, which prints English units). **A time reaches the
  traveller through one catalogue key**, `files.export.madeAt` (`{date}, {time}`): `{date}` and
  `{time}` are **both read in the same zone**, the reader's browser time zone: `{time}` through `zoneClockTime(zone, atMs, locale)`
  (`src/lib/clock-zones.ts`), and `{date}` as `formatDate` of the **local calendar date in that zone** (`YYYY-MM-DD` taken from
  `Intl.DateTimeFormat` with the zone, not from the instant), because `formatDate` reads the UTC fields and would print
  "4 Oct" beside "8:05 AM" for a traveller in Tokyo at 08:05 on the 5th. A zone the runtime cannot format (`zoneClockTime`
  returns `null`) falls back to UTC for both halves, so the two are never in different zones. The download label's and the artifact label's `{date}` are this string, so **two exports made the
  same day have different names** (a test asserts it). The document footer's `{when}` is the same key with the generation date
  and clock time **in the trip's time zone**, both halves in it, and in UTC when `trips.timezone` is null or unformattable.
- **Waiting, without a spinner that lies.** The artifact does not exist when the button returns; it exists when the consumer
  has written the `.html`. The panel holds the returned `taskId` as a **pending row** and polls the list every
  `EXPORT_POLL_MS = 3000` for at most `EXPORT_POLL_WINDOW_MS = 90000`; both are named constants beside the reason. When the
  artifact appears the row becomes real. When the window closes the row says "This is taking longer than usual. It will appear
  here when it is ready. If it does not, export again." with a Refresh button (one re-read), and **the request button is enabled
  again**. The poll **stops when the tab is hidden** (`document.visibilityState`) and resumes, with a fresh window, when it is
  shown. **A failed poll keeps the rows and the pending row** and retries on the next tick; only a failure of the **first**
  load shows the list-error `Alert`. The pending text says the traveller can leave the page.
- **States, named.** The request button is **drawn once, in one fixed place above the list, in every state**, so the focused
  control is never unmounted and mounted again when the pending row replaces the empty state. _Empty_ (owner or editor): an
  `EmptyState` on `--color-surface-2` with the `FileDown` icon and one sentence about handing the trip to somebody without an
  account, **with no action of its own** (the one request button above it is the action; a second control with the same name
  would break the `count() === 1` selector check). _Empty_ (viewer): the same, naming who can make one. _Skeleton_: three `Skeleton` rows at the artifact
  row's exact height on `--color-surface-2`, the list container `aria-busy`, so the panel does not change height when the list
  lands. _Pending_, _slow_, _ready_ as above. _Error_: a failed **first load** is an `Alert tone="danger"` with a Retry; a
  failed **request** is the failure toast of `useAction`; a failed **download** reuses `files.error.downloadFailed` and a
  `404 { error: 'missing' }` is `files.export.error.missing`, then the list is re-read. _Quota refusal_: an
  `Alert tone="danger"` under the button with the sentence from the numbers the server returned. _Loading_: the request
  `Button` carries `loading` while the enqueue is in flight and is `disabled` while a pending row exists.
- **`useAction` is configured, not defaulted.** The request and download actions pass `invalidate: false` (otherwise the button
  stays loading while the whole Files loader reruns, and if that rerun fails the pending row is replaced by the route error),
  and pass `fallback` and `failure` from the catalogue so the English defaults never appear (the request's toast title is
  `files.export.error.request`, its description `files.export.error.requestBody`, which also answers the free-plan traveller's
  first question: was one of my three lost?). An `{ ok: false }` result shows no success toast.
- **Download** is a `fetch` into a blob saved through a hidden link, written as a small function in the panel's own module
  (`download.ts` is `06-S1`'s and is not edited). Each row's control carries `loading` and is `disabled` while its fetch runs, so
  a slow connection cannot double-download. The saved file name is read from the response's `content-disposition`
  (`filename*`), with the `files.export.artifact` label and the format's extension as the fallback, because a blob save uses
  `anchor.download` and ignores the header. An `.html` artifact is re-typed `application/octet-stream` before its object URL is
  made, for the reason `06-S1` records for markup in the library (a blob URL of `text/html` is navigable).
- **Controls.** The request button and each download are real controls with visible focus. The two options are
  `CheckboxField` (`src/components/ui/checkbox.tsx`), **not** `Switch`: a switch is for a setting that applies immediately, and
  these are parameters of the next request; the wrapping label also gives the control a name and a target larger than its box.
  Each download's accessible name carries the artifact and its time (`files.export.downloadLabelPdf` /
  `downloadLabelHtml`: two literal keys, because a noun interpolated into a sentence cannot decline in `pl`, `ru` or `ar`), and
  every locale's label contains that locale's `files.export.download` word.
- **One live region.** Exactly one `role="status"` element, mounted empty with the panel and kept **outside** the rows that get
  replaced. It announces pending, ready (and the artifact named by `?export=`) and the slow state, once each. The pending row's
  spinner is `Spinner label={null}` (the primitive's default is its own `role="status"`, which would announce twice) and is
  `aria-hidden`. The quota refusal and the list error use `Alert tone="danger"` (`role="alert"`); a `warning` or `info` Alert
  is inserted already holding its text and is not reliably announced.
- **Focus is named for every case.** When the focused request button becomes `disabled` for up to 90 s, focus moves to the
  pending row (`tabIndex={-1}`, with the same `scroll-mt-*` as the marked row) and returns to the button when it re-enables
  **only if focus is still on the pending row or on `body`**; otherwise it is left where it is. When Retry, Refresh or a `404`
  re-read unmounts the focused control, focus moves to the panel's heading (`tabIndex={-1}`, same `scroll-mt-*`). A Download
  control loses focus while it is `loading` (`Button` sets native `disabled`); when its fetch ends and focus is on `body`, focus
  goes back to that control, and the e2e checks `document.activeElement` after a download. The polling never moves focus.
  `ModulePanel` renders its `h2` with no way to give it `tabIndex={-1}` or a ref, so this ticket adds an **additive
  `headingProps` passthrough** to `ModulePanel` in `src/components/modules/shared/panel.tsx` (named under Owned).
- **Table is not used.** `Table` wraps its rows in `overflow-x-auto`, which contradicts "nothing scrolls sideways", and stacking
  cells at 360 px strips table semantics. `ModuleRow` renders a `div`, so the list is a `div role="list"` whose rows, the
  pending row included, are `ModuleRow`s with `role="listitem"` (a `ul` would hold `div` children); a component test counts the
  `listitem` elements.
- **Tokens.** None missing. Sizes, ages and the allowance carry `tabular-nums`. Motion 150-260 ms on `--ease-out-quint`,
  transform and opacity only, `prefers-reduced-motion: reduce` honoured, for the pending row settling into a real row.

### Alternatives considered, and why they lost

| Alternative                                                       | Why it lost                                                                                                                                                                                                                                  |
| ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Print from the reader's browser, as the reference does            | Caps fidelity, depends on the reader's print settings and makes "send me the file" impossible. We are ahead here and the README forbids regressing.                                                                                          |
| A `trip_files` row per export, so the library lists and counts it | Puts a generated artifact inside the traveller's own file list and inside their `files` quota, and `getStorageUsage` would then count bytes that expire.                                                                                     |
| An export index table                                             | A migration and a second source of truth that must be kept in step with R2; the list is read from R2, which is the truth, and the prune keeps it short.                                                                                      |
| Render inside the request                                         | A request that timed out building the document would be a request that rendered; the handler exists so the request returns when the message is on the queue.                                                                                 |
| Count the allowance in the handler                                | The handler does rebuild a requester's scope now (for the permission re-check, as `trip-copy.ts` does), but a counter written after the work is the check-then-act race the reserve-first order removes, and a failed job would still count. |
| A shortcut on the planner toolbar                                 | Same-wave claim on screens `01-S2`, `01-S4` and `07-S1` own. Left for a later stage.                                                                                                                                                         |
| Ship the document in English only                                 | Hardcoded copy is banned (`docs/SPEC.md` §9); a localised body in an English shell is the same defect, smaller.                                                                                                                              |
| Confirmation codes always in the document                         | Contradicts `docs/ACCESS.md` §3.1 for the very readers the file is made for. A request-time checkbox, off by default, keeps the choice with the traveller.                                                                                   |
| Build the journey book here                                       | The payload requires a `tripId` and the document shape has no image; see Out of scope.                                                                                                                                                       |

## 📝 Architecture

- **One concept, one owner (`docs/SPEC.md` §8).** The `exports/` key family, its listing, its grouping, its prune, its read-side
  expiry and its purge list are `storage/export-artifacts.ts`. The allowance is `repos/exports.ts`. Turning a trip into a
  document is `fns/export-document.ts`. Rendering is the handler and only the handler. The three server functions orchestrate
  and own no rule of their own.
- **Seams.** Request path: `exports.ts` fn, then `reserveExport` (repository, tenant-scoped), then reads through existing
  repositories, then `enqueueTask`, then the queue. Worker path: consumer, `handlePdfExport` (scope re-check, then
  `export-artifacts`, R2/KV, `enqueueTask(email)`). Fetch path: `listTripExportsFn` / `downloadTripExportFn`, then
  `export-artifacts` (list through the port) and the real bucket (stream). The `ExportStore` port is passed as a parameter on
  both sides of the request boundary, as `storage/objects.ts` does.
- **All SQL stays in `server/repos`.** The only new SQL is `bumpUsage` and `getMonthlyUsage`, which already exist and are
  already tenant-scoped; the handler's scope re-check reads through `getMembership` and `requireTrip`; `server/catalog` is not
  involved.
- **`components/ui` is untouched** and nothing under it fetches or imports from `server/`; the panel is a module component that
  calls the server functions through `useAction` and a plain `useServerFn`.
- **Cloudflare cost.** One queue message and one KV write per export (both already in the handler), at most three R2 `put`s and
  a paged listing per job, a bounded number of `delete`s, the scope re-check's two D1 reads, and the optional Browser Rendering
  call that is already metered through `context.callProvider` and degrades to the HTML artifact over its ceiling.

## 📝 Data Model

**No schema change and no migration.** Nothing about an export is a domain row: the artifact is an R2 object, the pointer is a
KV entry, and the only durable count is a `usage_records` row (`metric = 'exports'`, `period = 'YYYY-MM'`) the billing
repository already writes with its existing unique index.

**Retention, stated in one place because it is the reason this is a storage stage.**

| What                                 | Where                              | Kept                                                                                                    | Removed by                                                                                               |
| ------------------------------------ | ---------------------------------- | ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `<taskId>.pdf`, then `<taskId>.html` | `FILES` at `exports/<org>/<trip>/` | Seven days **per artifact** (enforced on read), at most five artifacts per trip                         | The prune that follows every successful job (Phase 1); the trip purge when the trip is deleted (Phase 4) |
| The KV pointer `export:<taskId>`     | `KV`                               | Seven days (`expirationTtl`)                                                                            | Its TTL. Nothing reads it; it stays the handler's own record                                             |
| The `exports` counter                | `usage_records`, period `YYYY-MM`  | Per month, as billing keeps every counter                                                               | Not removed; a new month is a new row                                                                    |
| A trip exported once, never again    | `FILES`                            | Unreadable after seven days; the bytes stay until the weekly retention cron half is written (follow-up) | Nothing yet - stated, not hidden                                                                         |

**Export artifacts are not counted by `getStorageUsage`**, which sums `trip_files` rows, and an export writes none. Stated so
that nobody later "fixes" the count by inserting a `trip_files` row per export.

## 📝 API Contracts

All three are `createServerFn`s in `src/server/fns/exports.ts`, validated with `z.strictObject()`.

```ts
// request
input:  { tripId: string /* trimmed, 1..64 */, notify: boolean, includeReferences: boolean }
output: { ok: true; taskId: string; queuedAt: number }
      | { ok: false; reason: 'quota'; limit: number; used: number; resetsOn: string /* YYYY-MM-DD */ }
// refusals that throw (authored or redacted by the existing boundary): NotFoundError (trip not visible, including
// another workspace's), TripRoleError (a viewer on a trip they can see), a validation failure.

// list
input:  { tripId: string }
output: { artifacts: Array<{ taskId: string; format: 'pdf' | 'html'; sizeBytes: number; createdAt: number }>;
          canRequest: boolean;
          allowance: { used: number; limit: number | null; month: string /* YYYY-MM */; resetsOn: string /* YYYY-MM-DD, the first of next month */ } }

// download
input:  { tripId: string; taskId: string /* trimmed, 1..128; the ^[A-Za-z0-9-]{1,128}$ pattern is checked in the handler and answers the 404 */ }
output: Response  // 200 attachment | 404 { error: 'missing' }
```

The queue payload is the existing `pdfExportPayloadSchema` plus one optional `locale: string (max 16)`.

## 📝 UI/UX

- **Route:** `/trips/$tripId/files`, edited; no route added, `pnpm generate-routes` does not run.
- **Components:** the primitives named above, plus one product component. Nothing filed to foundations.
- **Keyboard and screen reader.** See "The panel's states, focus and announcements": one live region, named focus targets,
  full accessible names on every download, `aria-current="true"` on the marked row **plus** the live-region text and a visible
  text badge (a screen reader reaches `aria-current` only when it happens to land on the row, and scrolling moves nothing for
  it).
- **360 px and 320 px.** A designed layout: the artifact row stacks its meta (format, size, age) under its name and the
  download action sits on its own line; nothing scrolls sideways at 320 CSS px, the width reflow is measured at.
- **Right-to-left.** Logical properties only; the download and `FileDown` icons do not carry direction. The generated document
  is `dir="rtl"` for `ar` and `he` and its columns align to the logical end.
- **Copy** is below and lives in the catalogue in all 23 locales.

## 📝 Visual change expected

Route `/trips/$tripId/files`, light and dark, 360 / 1280 / 2560 px:

- **Resting, empty:** under the file library a new card, "Export the trip", with its description, the `kept` line, the two
  checkboxes, the request button and the allowance line, and the empty state ("No exports yet") on `--color-surface-2`.
- **Resting, one artifact:** the same card with one row (format badge, size, age, Download).
- **Skeleton:** three rows at the row's exact height; the card does not change height when the list lands.
- **Pending (`data-state="pending"` on the row):** the pending row with its spinner and the live-region text; the request
  button disabled.
- **Slow:** the pending row's "taking longer than usual" text with Refresh, the request button enabled again.
- **Quota refusal:** an inline danger `Alert` under the button with the sentence below; with the allowance used up, the request
  button already disabled.
- **List error:** an `Alert` with Retry in place of the rows.
- **A viewer:** the card without button or checkboxes and with the explanatory sentence.
- **Marked artifact (`?export=`):** the row with its text badge; with an unknown id, the one "no longer kept" line.
- **Elsewhere on the screen:** the header gains one secondary action; nothing else changes.

## 📝 Copy

Every key is a flat `files.export.*` entry in `src/lib/i18n/messages/en/modules.ts` (the `modules` namespace file, where the
existing `files.status.*` and `files.toast.*` keys live), landed in **all 23 locales** in the same change per the
`i18n-messages` skill. Every key must have a literal reader in the source (the dead-key census in
`src/lib/i18n/__tests__/coverage.test.ts` counts keys by literal), so none is composed at run time. **A key with a number in it
is a plural object, `{ one, other }`, as the catalogue already writes them** (`files.status.uploadingCount`); the catalogue has
no `{count, plural, ...}` parser, and `pl`, `ru`, `uk`, `cs` and `ar` carry the extra forms they need. `{count}` is the number
the plural turns on.

Panel (ticket 06-S3b unless marked 06-S3c):

| Key                                         | `en`                                                                                                                                                                                                                                                                       |
| ------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `files.export.label`                        | `Export the trip`                                                                                                                                                                                                                                                          |
| `files.export.description`                  | `A printable copy of the trip: days, stops, reservations, transport and stays. Hand it to someone who has no account.`                                                                                                                                                     |
| `files.export.kept`                         | `{ one: 'Each export is kept for {count} day.', other: 'Each export is kept for {count} days.' }`                                                                                                                                                                          |
| `files.export.request`                      | `Export the trip`                                                                                                                                                                                                                                                          |
| `files.export.includeReferences`            | `Include confirmation codes`                                                                                                                                                                                                                                               |
| `files.export.includeReferencesHint`        | `Leave this off if you will send the file to someone outside your workspace.`                                                                                                                                                                                              |
| `files.export.notify` (06-S3c)              | `Email me when it is ready`                                                                                                                                                                                                                                                |
| `files.export.allowance` (06-S3c)           | `{ one: '{used} of {count} export used this month', other: '{used} of {count} exports used this month' }` (`{count}` is the limit)                                                                                                                                         |
| `files.export.allowanceUnlimited` (06-S3c)  | `{ one: '{count} export this month', other: '{count} exports this month' }` (`{count}` is the number used)                                                                                                                                                                 |
| `files.export.empty.title`                  | `No exports yet`                                                                                                                                                                                                                                                           |
| `files.export.empty.body`                   | `Make a printable copy of the trip to send to someone who has no account.`                                                                                                                                                                                                 |
| `files.export.empty.bodyViewer` (06-S3c)    | `An owner or editor of this trip can make one.` (the title already says "No exports yet")                                                                                                                                                                                  |
| `files.export.pending`                      | `Preparing your export. You can leave this page; it will be in this list when it is ready.`                                                                                                                                                                                |
| `files.export.pendingSlow`                  | `This is taking longer than usual. It will appear here when it is ready. If it does not, export again.`                                                                                                                                                                    |
| `files.export.refresh`                      | `Refresh`                                                                                                                                                                                                                                                                  |
| `files.export.ready`                        | `Your export is ready`                                                                                                                                                                                                                                                     |
| `files.export.format.pdf`                   | `PDF`                                                                                                                                                                                                                                                                      |
| `files.export.format.html`                  | `Printable page`                                                                                                                                                                                                                                                           |
| `files.export.madeAt`                       | `{date}, {time}` (`{date}` is `formatDate`, `{time}` the clock time in the reader's time zone; the one place a time reaches the traveller)                                                                                                                                 |
| `files.export.artifact`                     | `Trip export, {date}` (`{date}` is the `madeAt` string)                                                                                                                                                                                                                    |
| `files.export.download`                     | `Download`                                                                                                                                                                                                                                                                 |
| `files.export.downloadLabelPdf`             | `Download the PDF made {date}` (`{date}` is the `madeAt` string, so two exports of one day have different names)                                                                                                                                                           |
| `files.export.downloadLabelHtml`            | `Download the printable page made {date}` (`{date}` is the `madeAt` string)                                                                                                                                                                                                |
| `files.export.error.list`                   | `The list of exports did not load.`                                                                                                                                                                                                                                        |
| `files.export.retry`                        | `Try again`                                                                                                                                                                                                                                                                |
| `files.export.error.quota`                  | `{ one: "This workspace's subscription includes {count} export a month, and all of it is used. The count starts again on {date}.", other: "This workspace's subscription includes {count} exports a month, and all of them are used. The count starts again on {date}." }` |
| `files.export.error.request`                | `The export was not started`                                                                                                                                                                                                                                               |
| `files.export.error.requestBody`            | `This attempt was not counted. Try again in a moment.`                                                                                                                                                                                                                     |
| `files.export.error.missing`                | `That export is no longer kept. Export the trip again.`                                                                                                                                                                                                                    |
| `files.export.error.missingViewer` (06-S3c) | `That export is no longer kept.`                                                                                                                                                                                                                                           |
| `files.export.viewer` (06-S3c)              | `Only owners and editors can create an export. You can download the ones that exist.` (shown only when at least one artifact exists)                                                                                                                                       |
| `files.export.jump` (06-S3c)                | `Go to exports`                                                                                                                                                                                                                                                            |
| `files.export.fromLink` (06-S3c)            | `From your link`                                                                                                                                                                                                                                                           |
| `files.export.linkGone` (06-S3c)            | `That export is no longer kept. Make a new one below.`                                                                                                                                                                                                                     |
| `files.export.linkGoneViewer` (06-S3c)      | `That export is no longer kept.`                                                                                                                                                                                                                                           |

Document and email (read by the builder and the handler, in the requester's locale; the email keys and
`files.export.doc.footer` land with 06-S3a, the other document keys with 06-S3b):

| Key                              | `en`                                                                                                                                                                                         |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `files.export.doc.overview`      | `Overview`                                                                                                                                                                                   |
| `files.export.doc.timezone`      | `Time zone`                                                                                                                                                                                  |
| `files.export.doc.days`          | `Days`                                                                                                                                                                                       |
| `files.export.doc.day`           | `Day {number} - {date}`                                                                                                                                                                      |
| `files.export.doc.dayUndated`    | `Day {number}`                                                                                                                                                                               |
| `files.export.doc.dayEmpty`      | `Nothing planned yet.`                                                                                                                                                                       |
| `files.export.doc.reservations`  | `Reservations`                                                                                                                                                                               |
| `files.export.doc.transport`     | `Transport`                                                                                                                                                                                  |
| `files.export.doc.reference`     | `Ref. {code}`                                                                                                                                                                                |
| `files.export.doc.route`         | `{from} to {to}` (never a literal arrow: it is not mirrored in a right-to-left document)                                                                                                     |
| `files.export.doc.stays`         | `Where we are staying`                                                                                                                                                                       |
| `files.export.doc.nights`        | `{ one: '{count} night', other: '{count} nights' }`                                                                                                                                          |
| `files.export.doc.truncatedDays` | `{ one: 'This plan has more days than fit in one document. The first {count} day is shown.', other: 'This plan has more days than fit in one document. The first {count} days are shown.' }` |
| `files.export.doc.truncatedRows` | `{ one: 'Showing the first {count} of {total}.', other: 'Showing the first {count} of {total}.' }` (a plural object in every locale, `en` included, turning on `{count}`)                    |
| `files.export.doc.footer`        | `{app} - generated {when}`                                                                                                                                                                   |
| `files.export.email.subject`     | `{title} is ready`                                                                                                                                                                           |
| `files.export.email.body`        | `{ one: 'Your trip export is ready. It is kept for {count} day.', other: 'Your trip export is ready. It is kept for {count} days.' }`                                                        |
| `files.export.email.action`      | `Open {title}`                                                                                                                                                                               |
| `files.export.email.text`        | `Your trip export is ready: {url}`                                                                                                                                                           |

The existing `files.error.downloadFailed` is reused for a failed download. Real translations, made from our English; a
placeholder keeps its name in every locale; no key interpolates a translated noun into another sentence.

## 📝 Edge Cases & Failure Scenarios

| Case                                                                           | What happens                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The free plan's fourth export of a month                                       | Refused; the unit reserved is released once inside `reserveExport`; the panel shows the sentence with the limit and the first of next month. The counter is unchanged. Three refusals in a row at 3 of 3 leave the counter at 3.                                                              |
| Two simultaneous requests at two of three                                      | Exactly one passes: the second reserve returns four, fails the ceiling and is released.                                                                                                                                                                                                       |
| Two simultaneous first exports of a month                                      | The loser's insert hits the unique index; the bump is retried once and succeeds, so neither is a redacted failure.                                                                                                                                                                            |
| A viewer calls `requestTripExportFn` directly                                  | `TripRoleError` after `requireTrip` and before any bump; the counter does not move.                                                                                                                                                                                                           |
| A caller names a trip in another workspace, or a private trip they are not on  | `NotFoundError` from `requireTrip`, never `TripRoleError`; the counter does not move.                                                                                                                                                                                                         |
| The enqueue throws                                                             | The unit is released with the reserve's month and the error is rethrown; the toast says the export was not started.                                                                                                                                                                           |
| The release itself fails                                                       | Logged; the unit leaks. A lost unit is the safe direction.                                                                                                                                                                                                                                    |
| The job dead-letters after it was accepted                                     | The unit stays spent. The pending row ends in the "taking longer" state after 90 s and the traveller can ask again.                                                                                                                                                                           |
| The trip is deleted, or the requester leaves, while the job is queued          | The handler's scope re-check ends the job with `TaskPermanentError` before anything is written or emailed; a job that passed the re-check just before the delete can still write an artifact the purge never listed, which is unreadable once the trip is gone and is freed by the cron half. |
| `BROWSER_RENDERING_API_TOKEN` absent, or the provider over its ceiling         | The handler writes the HTML artifact only; the panel labels it "Printable page", never "PDF".                                                                                                                                                                                                 |
| The poll lands between the `.pdf` and the `.html`                              | The artifact is not listed yet: the `.html` is the completion marker, so "ready" never precedes the file or changes format afterwards.                                                                                                                                                        |
| An artifact is older than seven days, or was pruned between the list and click | The list omits it; a download is the same 404 `missing`, which the panel says in the traveller's language and then re-reads the list.                                                                                                                                                         |
| A task id from another workspace, or `../`                                     | Fails the id pattern or resolves inside the caller's own prefix to nothing: a 404, indistinguishable from "not there".                                                                                                                                                                        |
| A trip with 90 days, or 700 reservations, or a long plan in a multibyte script | The document is cut to the schema's bounds and to the 100 KB queue budget and says so in a note; the request does not fail.                                                                                                                                                                   |
| A cancelled reservation or transport                                           | Left out of the document.                                                                                                                                                                                                                                                                     |
| A title containing `<script>`                                                  | Escaped through `escapeHtml` in the title, the headings, every row and the email (after interpolation); the artifact carries no script.                                                                                                                                                       |
| A trip exported with `includeReferences` off                                   | Reservations and transport are listed without `Ref.` codes.                                                                                                                                                                                                                                   |
| An archived trip                                                               | Exportable; the request button is available to owner and editor.                                                                                                                                                                                                                              |
| A tab goes to the background mid-poll                                          | The poll stops; it resumes with a fresh 90 s window when the tab is shown, and the list is reread immediately.                                                                                                                                                                                |
| A poll request fails                                                           | The rows and the pending row stay; the next tick retries; no error `Alert` after the first load.                                                                                                                                                                                              |
| The traveller reloads while pending                                            | The pending row is restored from `sessionStorage` while inside the window, with the button still disabled.                                                                                                                                                                                    |
| The traveller leaves the page while pending                                    | The job completes anyway; the artifact is in the list on the next visit, and the email, if asked for, carries a working link.                                                                                                                                                                 |
| The email link names an artifact that has been pruned, or is damaged           | The Files screen loads; the panel shows the one "no longer kept" line; a malformed `export` value is dropped, not an English route error.                                                                                                                                                     |
| A member is removed from the trip after exporting                              | `requireTrip` refuses their next list or download; the artifact stays for the others.                                                                                                                                                                                                         |
| A locale tag the catalogue does not carry                                      | The handler and the builder fall back to `en`; nothing dead-letters.                                                                                                                                                                                                                          |
| Right-to-left locale                                                           | `<html lang dir="rtl">` on the artifact; the panel uses logical properties.                                                                                                                                                                                                                   |
| A trip deleted with no attachments and one export                              | The export keys are listed before the empty-list early return, so the purge still runs; a failed listing logs and the attachment purge continues.                                                                                                                                             |

## 📝 Observability

- The handler's existing completion line (`trip export written`: trip, key, format, bytes) gains `pruned: <count>` and
  `locale`. A prune that fails logs `export prune failed` at `warn` with the trip and the error, and the job still succeeds.
- `reserveExport` logs nothing on the happy path; a failed release logs `export allowance release failed` at `warn` with the
  organization, so a leaked unit is findable.
- The Phase 4 listing and enqueue sit in `try/catch` blocks whose `warn` names the trip and the key count.
- No new metric and no new alert; the provider meter already counts the Browser Rendering calls.

## ✅ Acceptance criteria

1. `handlePdfExport` writes the `.pdf` (when it renders one), then the `.html`, then the pointer, then prunes: every object of
   every artifact older than seven days is deleted, and of the rest only the newest five artifacts are kept; with fewer than
   six artifacts and none older than seven days nothing is deleted; a failing `list` or `delete` leaves the job successful and
   logs a warning.
2. A requester who has left the workspace, or a trip that is gone, ends the job with `TaskPermanentError` before an object is
   written or an email sent.
3. The document's `<html lang>` and `dir` come from the payload's `locale` (`ar` is `rtl`), an absent or unsupported tag renders
   `en`, and the footer and the email subject, body and link text come from the catalogue; the document has one `<h1>`, one
   `<h2>` per section, `th[scope=row]` label cells, no `#89877f` and `text-align: end` meta cells, and the PDF is requested
   with `tagged: true`.
4. The email links to `/trips/<tripId>/files?export=<taskId>` with both ids URL-encoded; the path resolves in this router; a
   `<script>` title is escaped in the email after interpolation.
5. `pdfExportPayloadSchema` accepts a payload with and without `locale`; a message queued before this change still parses.
6. `listExportArtifacts` pages the whole prefix, lists an artifact only when its `.html` exists, prefers `pdf`, omits an
   artifact older than seven days and never matches a trip whose id begins with the same characters.
7. `reserveExport` refuses another workspace's trip with `NotFoundError` and a viewer with `TripRoleError`, both before the
   counter moves, admits the third export of a month on the free plan and refuses the fourth with the counter back at three
   (and still at three after three refusals in a row), never refuses on an unlimited plan, passes the month and not `'all'`,
   takes the month from the pinned clock and retries a first-bump constraint error once.
8. Two concurrent reserves at two of three admit exactly one.
9. `requestTripExportFn` parses the payload it builds with `pdfExportPayloadSchema`, enqueues with no `id`, releases the unit
   (with the reserve's month) when the enqueue throws and never when the reserve refused, returns
   `{ ok: false, reason: 'quota', ... }` instead of throwing, and takes the `notify` address from the session and never from
   the input.
10. The built document stays inside the schema's bounds **and under 100 KB serialised** for a 90-day trip and a
    700-reservation trip, the second with multibyte titles, and says it was cut; it
    lists transport, leaves out cancelled reservations and cancelled and `idea` transports, and carries `Ref.` codes on
    reservations, transport and stays only with `includeReferences`.
11. `downloadTripExportFn` derives its key from the caller's organization id and the resolved trip id and ignores any other
    value; a malformed, foreign, expired or incomplete task id is the same 404 `{ error: 'missing' }`; the content type comes from
    the fixed map, the `.html` response carries the sandbox `content-security-policy`, and the headers are the ones listed.
12. `listTripExportsFn` answers `canRequest: false` for a viewer, who can still list and download.
13. Deleting a trip whose only stored objects are exports enqueues a `trip-purge` carrying those keys; a failing export listing
    does not drop the attachment purge; deleting one trip never lists or deletes another workspace's prefix.
14. The panel's request button is disabled while a pending row exists and enabled again when the window closes, the poll stops
    after 90 s and when the tab is hidden, a failed poll keeps the rows, a reload restores the pending row, the pending, ready
    and slow states are announced through the one polite live region, and a viewer sees no request control.
15. All new keys exist in all 23 locales, every number-bearing key is a plural object, and the parity test and the dead-key
    census pass.
16. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `bash .ai/scripts/check-generated.sh`, `pnpm build` are green; the existing
    `metering.test.ts` pdf-export tests pass with their fakes extended **and the handler built through a
    `createPdfExportHandler(databaseFor)` seam**, the way `trip-copy.ts:336-345` does it, because the scope re-check reads D1
    and `db/client.ts` reads the ambient environment, which `consumer.ts` must not need to load in Node.
17. The `06-S3` block of `e2e/documents-and-media.spec.ts` is green on `chromium` and `mobile-safari` (layout-shift skipped,
    stated, on WebKit) with a silent console.

## 📝 Risks & Impact Review

| Risk                                                                             | Mitigation                                                                                                                                                                                                                                                                                                    |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A cross-tenant read of an artifact                                               | The key is derived from the caller's organization id and the resolved trip id, never accepted; the task id is pattern-validated; the KV pointer is never consulted; isolation tests at the server-function layer.                                                                                             |
| A viewer drains the workspace allowance                                          | `requireTrip` then the role guard are the first lines of `reserveExport`, before the counter; a direct-call test.                                                                                                                                                                                             |
| Two requests overshoot the ceiling                                               | Reserve first, check the returned value; a concurrency test. The first-bump race is retried once.                                                                                                                                                                                                             |
| Confirmation codes leave the workspace                                           | Off by default, a request-time checkbox, recorded in `docs/ACCESS.md` §3; the document is a snapshot the traveller chose to make and hand over.                                                                                                                                                               |
| Generated markup is an XSS carrier                                               | Every value goes through `escapeHtml` (the email after interpolation); locale-derived attributes come from a closed set; the stylesheet is literal; served as `attachment` with `nosniff`, a fixed content type and a sandbox CSP; the panel re-types an `.html` blob before it gets a URL.                   |
| A deleted trip's plan stays in R2                                                | Phase 4 hands the export keys to `trip-purge`; the handler's scope re-check narrows the in-flight case to a short window; the one remaining gap (a trip exported once) is unreadable after seven days and has a follow-up issue for the cron half.                                                            |
| An unlimited (`business`) workspace can request without a rate limit             | Every export can spend the platform-wide Browser Rendering and Resend ceilings (`provider_registry`), which degrade the artifact to HTML and withhold the email rather than failing. Whether to cap exports in flight per trip is **a person's call and is not blocking**; this spec does not invent a limit. |
| The edit to `trip-lifecycle.ts` and `queue/types.ts` collides with another stage | Both are one additive hunk in a region the other stages do not touch; named as departures; the ticket merges the base before it pushes.                                                                                                                                                                       |
| A prune deletes something it should not                                          | It lists only the prefix of one organization and one trip, ends in `/`, ignores names that do not parse as `<taskId>.html\|pdf`, and runs after the new artifact is durable.                                                                                                                                  |
| Polling logs or shifts the layout                                                | Silent-console and layout-shift assertions run across the pending to real transition; the skeleton is the row's exact height.                                                                                                                                                                                 |
| The Browser Rendering binding is absent                                          | Already the designed fallback: the HTML artifact stands, the panel labels it by its real format, and the tests cover both paths. Adding the binding changes cost, not this stage.                                                                                                                             |
| A consumer retry                                                                 | The artifact keys are deterministic on the envelope id, so a retry overwrites the same keys; the real cost is a second metered render. The prune is not retried because a failed prune must not fail the job.                                                                                                 |

### Out of scope

- **The journey-book variant of `DOC-06` is open and has no owner.** The row's name also asks for a "journey book (A4
  landscape, count-driven photo layouts)". It is not built here and is **not deferred to another stage**: the only candidate,
  `08-S7`, plans no export of any kind, and writing "deferred to `08-S7`" would mark a behaviour done in this plan that is
  planned in neither. It is a different piece of work for two measured reasons: `pdfExportPayloadSchema` requires a `tripId`
  while `journeys.trip_id` is nullable, and `exportDocumentSchema` has no shape for an image, so photo layouts cannot be
  expressed in it. **Phase 4's ticket files one issue for it**, stating those two prerequisites and that the work needs a
  planning stage that widens `queue/types.ts` in the wave that owns that file, so triage treats it as a spec task and not a
  ticket; the issue is the work's handle and is not assigned to a stage.
- **The weekly retention cron half** (`worker.ts`, `wrangler.jsonc`): a foundations requirement; Phase 4 files the follow-up.
- **A planner-toolbar shortcut**, an export for a journal, an export per day, a re-run of an old export, and an email to someone
  other than the requester.
- **The `BROWSER_RENDERING` binding** (`11-S3`): a cost-model change and the owner's decision; this stage ships against both
  paths.
- **Hardcoded English elsewhere on the Files screen** (`files.tsx`'s own headings and stat cards): the one issue `06-S1`'s
  Phase 4 run files names them (`.ai/specs/implemented/2026-10-04-every-way-a-file-gets-in.md`, "Hardcoded English, one follow-up issue");
  this stage touches only the lines it adds and does not file a second.

## 📋 Phasing

| Phase | Ticket | Delivers                                                                                                                                                                       | Needs   |
| ----- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| 1     | 06-S3a | The artifact the handler writes: key module, scope re-check, locale, working link, accessible document, completion order, prune, the Docs-and-CI grep, the glossary entry      | none    |
| 2     | 06-S3b | An owner exports the trip and downloads it: allowance, document builder with transport, request / list / download, the panel's core states, the `ACCESS.md` line, the e2e core | Phase 1 |
| 3     | 06-S3c | Everyone else on the trip and the email: allowance line and pre-disable, viewer view, notify checkbox, `?export=` marking and header action, pending survives a reload         | Phase 2 |
| 4     | 06-S3d | A deleted trip's exports leave with it; the two follow-up issues (the cron half, the journey book)                                                                             | Phase 1 |

Four tickets, inside the eight a slicing run may file, each ending in something a test can show: a document that is right (06-S3a, proved by the
handler and document tests, because nothing calls it until 06-S3b), a button that works, the same button for everyone and an
email that opens, a deletion that deletes (06-S3d, which lands after 06-S3b in practice, since nothing can make an export
before it). Phase 2 is the largest; if a slicing
run finds it does not fit one context it cuts along a user-visible seam (the request and the pending row, then the list and the
download), never along a layer. Phases 2 and 4 are independent of each other and both need only Phase 1. The copy lands with
the phase that reads it (marked in the Copy table), each key in all 23 locales, so the parity test is green after every merge.

## 📋 Implementation Plan

### Phase 1 - the artifact the handler writes (06-S3a)

1. Run the Docs-and-CI grep named above, add the **Trip export** glossary entry, and note the terms in the PR body.
2. `src/server/storage/export-artifacts.ts` and `fake-bucket.ts`'s `list` (with a small page size), test-first: the prefix with
   its trailing slash, the paging over `truncated`, the `.html` completion marker, `pdf` winning over `html`, an unparseable
   name ignored, the read-side expiry, the prune (older than seven days, then the newest five, nothing under the thresholds),
   `listExportKeys`.
3. `pdfExportPayloadSchema` gains `locale`; the handler imports the key helpers, re-checks the scope, takes the locale, writes
   the shell from the catalogue, fixes the stylesheet and markup, builds the working link, writes `.pdf` then `.html` then the
   pointer, prunes in a `try/catch`.
4. The email and footer keys land in all 23 locales; `metering.test.ts`'s fakes are extended.
5. `pdf-export.test.ts` (new): see Verification.

### Phase 2 - an owner exports the trip and downloads it (06-S3b)

1. `src/server/repos/exports.ts`, test-first against the real in-memory repository harness the other repository tests use: the
   trip and role refusals, the third admitted and the fourth refused with the counter restored, three refusals in a row, an
   unlimited tier, the month from the pinned clock, the first-bump retry, the concurrent pair. `repos/index.ts` one export line;
   the isolation `describe`.
2. `export-document.ts`, test-first: the sections, the transport and cancelled rules, `includeReferences`, the bounds, the
   truncation notes, the locale.
3. `exports.ts`: the three functions in the order named above; the tests listed under Verification.
4. `export-panel.tsx`, the `files.tsx` edit and the panel keys in all 23 locales; component tests for the states the ticket
   owns; the core of the e2e block; the `docs/ACCESS.md` line.

### Phase 3 - everyone else on the trip, and the email (06-S3c)

1. The allowance line, the pre-disable, the viewer view, the notify checkbox.
2. `?export=`: `validateSearch`, the marking, the live-region text, the "no longer kept" line, the header action.
3. `export-pending.ts` and the reload test.
4. The remaining keys in all 23 locales; the rest of the e2e block.

### Phase 4 - a deleted trip takes its exports with it (06-S3d)

1. `enqueueTripPurge` reads `listExportKeys` before its early return, in a `try/catch` of its own; a test in the existing
   `trip-lifecycle` side-effects suite and a two-tenant case.
2. File the two follow-up issues (the weekly retention cron half, the journey book).

## Verification

**Command gate, in order:** `pnpm typecheck`, `pnpm lint`, `pnpm test`, `bash .ai/scripts/check-generated.sh`, `pnpm build`
(`validation.commands`).

**Unit tests, by file and invariant.**

- `storage/__tests__/export-artifacts.test.ts` (new): the prefix ends in `/` and `exports/<org>/<trip>` does not match
  `<trip>2`; **paging with a page size of 2 follows `cursor` to the end and sorts by `uploaded` after paging** (R2 lists
  lexicographically, not by time); an artifact with a `.pdf` and no `.html` is not listed; grouping prefers `pdf` and takes
  its size and instant; an expired artifact is omitted; the prune keeps the newest five, deletes nothing under the thresholds
  and deletes a stale lone `.pdf`; a name that does not parse is neither listed nor deleted; `listExportKeys` returns both
  objects of an artifact.
- `queue/handlers/__tests__/pdf-export.test.ts` (new): a departed requester and a missing trip end in `TaskPermanentError` with
  nothing written; every section renders and `<`, `>`, `&` and quotes in a real trip title are escaped (through
  `renderExportDocument`, not a string literal); one `<h1>`, one `<h2>` per section, `th[scope=row]`, no `#89877f`,
  `text-align: end`; `tagged: true` is passed; the `.pdf` is written before the `.html`, and the pointer carries the `.pdf` key
  when the renderer answered and the `.html` key when it did not; `lang`/`dir` follow the locale and fall back to `en`; the link
  is `/trips/<id>/files?export=<task>` with both ids encoded; the email HTML escapes a `<script>` title after interpolation; the
  prune runs after the pointer and a rejecting `list` leaves the job successful with a warning; a payload without `locale` still
  works.
- `repos/__tests__/exports.test.ts` (new): criteria 7 and 8.
- `fns/__tests__/export-document.test.ts` (new): bounds for a 90-day and a 700-reservation fixture; the truncation notes; the
  transport rows and the cancelled and `idea` rules; `Ref.` on reservations, transport and stays only with `includeReferences`; dates through the format helpers; the built
  value parses with `exportDocumentSchema`.
- `fns/__tests__/exports.test.ts` (new): criteria 9, 11 and 12, with the queue and the bucket faked and the real repositories;
  the download key ignores an organization id supplied in the input; the headers and the sandbox CSP.
- A case in the existing `trip-lifecycle` side-effects suite for Phase 4 (criterion 13).
- Component tests for the panel (empty for both roles, skeleton, pending to real, slow with the button re-enabled, a failed
  poll, quota refusal, list error, viewer, a restored pending row).
- A catalogue test that every locale's `files.export.downloadLabelPdf` and `downloadLabelHtml` contain that locale's
  `files.export.download` text.

**Tenant isolation.** One new `describe` appended to `src/server/repos/__tests__/tenant-isolation.test.ts`, editing no existing
block, **driven at the server-function layer as well as the storage functions** (the pure storage functions take `orgId` as a
parameter, so testing them alone proves nothing about tenancy). In organization A's scope, against organization B's rows:
`reserveExport` for B's trip (`NotFoundError`, and A's `exports` counter has not moved); the list function for B's trip id
(`NotFoundError`); **with a real object put at `exports/<orgB>/<tripB>/<taskB>.html` in the same fake bucket A reads from**,
A's download of `taskB` through A's own trip is a 404; afterwards B's usage records and B's bucket prefix are byte-identical.
The case specific to a counter: A's reserve sees only A's count when B has already spent its month's allowance. A
same-workspace **private-trip** case (ADR 0007): a member who is not on private trip Y gets `NotFoundError` on request, list and
download for Y. A listing for trip `T` leaves out objects under `exports/<org>/<T>2/`. A viewer case: refused to request,
allowed to list and download. Functions covered: `reserveExport`, `releaseExport`, `exportAllowance`, `listExportArtifacts`,
`listExportKeys`, `requestTripExportFn`, `listTripExportsFn`, `downloadTripExportFn`.

**Browser evidence.** `e2e/documents-and-media.spec.ts`, one `test.describe('06-S3 - trip export', ...)`. It imports `visit` and
`watchConsole` (`helpers/console.ts`), `settle` and `settleMutations` (`helpers/settle.ts`), `useSession` and `hasSession`
(`helpers/session.ts`), `applyTheme` and `THEMES` (`helpers/routes.ts`) and re-implements none; the visual gate and baselines are
retired (ADR 0016), and nothing is compared to a stored pixel.

- **Nothing here writes to the shared demo workspace.** A real request would spend the demo workspace's monthly allowance and
  write R2, and the local dev server runs no queue consumer. **No server-function frame is forged**: `e2e/journeys.spec.ts` records that "seroval frames are not a format to forge, and
  a fabricated one deserialises to `undefined` rather than failing". The tests intercept `requestTripExportFn` with
  `page.route(...)` and assert on the request the browser made (the body carries `notify` and `includeReferences` and no email
  address), answering the real server's own response fetched with `intercepted.fetch()` and rewritten only where the code is a
  plain value. The states the browser can reach honestly are asserted in e2e: the empty list, a list that fails (a status-500
  response), and the raw download `Response` (headers, a 404). The states that need a populated list (the pending row turning
  into a real one, `aria-current` on the marked row, the Download names, focus after a download, the quota sentence) are
  **component tests of `export-panel.tsx`** with the server functions mocked at the module boundary, where a hand-made
  value is a typed value and not a wire frame. The server behaviour is proved by the unit and isolation tests above.
- **Selectors** (`[data-part="export-request"]`, the pending row's `data-state`) are verified against a running server with
  `page.locator(sel).count()` returning `1` before any frame is filed.
- **Console silent.** `watchConsole(page, route)` before navigation, `fatal` asserted empty at the end of every test in the
  block, including the polling one: a poll that logs is a poll that will log every three seconds in production. Nothing is
  added to `TOLERATED_CONSOLE_WARNINGS`.
- **No layout shift after paint.** A `layout-shift` `PerformanceObserver` as an init script (entries with `hadRecentInput`
  excluded), `visit()` then `settle()`, `performance.now()` as the mark; the sum after the mark, across the moment the pending
  row becomes a real artifact row, is `0`. Gated on `supportedEntryTypes`, with the WebKit skip stated as a skip.
- **The keyboard and announcement path, asserted:**
  - the status region exists and is empty before the press, then shows the pending text, then the ready text, and the slow text
    through `page.clock` with no real 90 s wait;
  - `document.activeElement` is not `body` after the press, after Retry and after Refresh;
  - Space toggles each checkbox and its checked state changes;
  - each Download is found by its full accessible name;
  - a known `?export=` id gives exactly one `[aria-current="true"]` whose top edge sits below the bottom of the sticky header,
    and an unknown id gives none and shows the "no longer kept" line;
  - `scrollWidth <= clientWidth` at 320 CSS px and under `ar` with `html[dir="rtl"]`;
  - one pass under `page.emulateMedia({ reducedMotion: 'reduce' })`, following the precedent at `e2e/journeys.spec.ts:1229`;
  - a reload during pending restores the pending row and keeps the request button disabled;
  - the status region's text is asserted both when `?export=` matches (the ready text naming the export) and when it does not
    (the "no longer kept" line), and the line is absent while the skeleton is up and after a failed first load;
  - after "Go to exports" the panel heading's top edge is below the sticky header's bottom edge and holds focus;
  - after a download finishes, `document.activeElement` is that Download control, not `body`;
  - with the allowance used up, the request button is disabled, the quota text is linked to it with `aria-describedby`, and no
    `role="alert"` is present until a refused press;
  - two artifacts made the same day expose different accessible download names.
    `axe` is not a dependency and `package.json` is frozen, so these role and state assertions are the proof.
- **Frames**, read by a human, outside the repository: `scripts/visual/capture.mjs` for the resting route in the empty state and
  with one artifact (light and dark at 360x800, 1280x900, 2560x1440, `--auth`, `PT_SERVER_TODAY=2026-08-20`, the command quoted
  in full in the evidence). The pending, quota-refusal and list-error states cannot be reached by `--click` against the live
  server without writing, so the spec screenshots them at the same six viewport/theme pairs as test attachments from the
  intercepted fixtures.
- **Manual check for the checklist, not automated:** open a downloaded `.html` artifact and the PDF in a real viewer for one
  Arabic and one Polish trip, and read the Arabic `.html` once with a screen reader.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                                | Applied default                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Why                                                                                                                                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Who may request, list and download an export?                                           | Request: trip `owner` and `editor`, guards (`requireTrip`, then the role) inside `reserveExport`, before the counter. List and download: everyone who can read the trip, a viewer included. Archived trips are exportable.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Decided by the security and tenancy sub-agent (confidence high): a request spends a shared allowance (the booking-import precedent); a viewer already reads every field in the document. The panel review fixed the guard order so "not yours" and "not there" stay indistinguishable.                         |
| 2   | In what language is the document, and does the payload change?                          | The requester's negotiated locale; one optional `locale: z.string().max(16)` on `pdfExportPayloadSchema`; the handler resolves it with `isSupportedLocale`, falls back to `en`, and writes `lang`, `dir`, footer and email from the catalogue.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Decided by the software architect sub-agent (confidence high): hardcoded copy is banned; `dispatch.ts` is the precedent; the field is additive and a string so a later locale never dead-letters. The plan's English-only rule is stale.                                                                       |
| 3   | Does a deleted trip's export leave with it, and is the weekly cron half taken?          | Yes for the first: `deleteTripFn` adds `listExportKeys` to the `trip-purge` keys (own `try/catch`, before the empty-list early return). No for the second: a follow-up issue filed by Phase 4; the in-flight gap is closed by the handler's scope re-check.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Decided by the software architect (confidence medium-high) and the security and tenancy reviewer (high): the product tells the owner a deleted trip is gone, and no other stage writes the purge for this key family.                                                                                          |
| 4   | Is the job id deterministic?                                                            | No: a fresh id per request. One request, one unit, one artifact.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Decided by the software architect (confidence high): the `task:done:` marker covers redelivery only; a deterministic id would ack a second press as a duplicate while the unit was charged.                                                                                                                    |
| 5   | When is the allowance counted, and how is the ceiling made race-free?                   | At request time, reserve first: bump with the `YYYY-MM` period, assert on the returned value, release once on a refusal and on a failure after the reserve. `exportAllowance` is display only.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Decided by the software architect (confidence high): the plan's read, build, bump order overshoots under concurrency; a counter written after the work is the same race and a failed job would still count. (The earlier claim that the consumer has no scope was wrong: `trip-copy.ts:355-368` rebuilds one.) |
| 6   | How does a quota refusal reach the panel?                                               | `requestTripExportFn` returns `{ ok: false, reason: 'quota', limit, used, resetsOn }`; the panel writes the sentence from the catalogue.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | `QuotaExceededError` is not in `AUTHORED_ERROR_NAMES`, so a thrown one reaches the browser redacted; the plan's "say how many exports the plan includes and when it resets" needs the numbers.                                                                                                                 |
| 7   | Where does the `exports/` key logic live, and through what port?                        | `src/server/storage/export-artifacts.ts`, over a minimal structural `ExportStore = { list, delete }`; the download streams through the real bucket.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Three callers across the request boundary need it; `docs/SPEC.md` §8, the `storage/objects.ts` precedent; `ObjectStore` has no `list` and `TaskBindings.FILES.get` returns no metadata, and the port keeps `cloudflare:workers` out of the consumer graph.                                                     |
| 8   | Prune before or after the new artifact is written?                                      | After the artifact and the pointer are written, in a `try/catch` that logs and does not fail the job.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | A failed prune must never cost the traveller the document they asked for, and failing the job would retry a render that already succeeded.                                                                                                                                                                     |
| 9   | What happens to a plan longer than the document schema allows?                          | Cut to the bounds (56 days, 500 rows per section, sliced strings) with a localised note saying so.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | A document that fails the schema at the enqueue is a failed request with the plan in it; a visible cut is the smaller harm.                                                                                                                                                                                    |
| 10  | Are confirmation codes in the document?                                                 | **Only when the requester ticks "Include confirmation codes" at request time; off by default.** Recorded as a line in `docs/ACCESS.md` §3.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Decided by the security and tenancy reviewer in the panel: `docs/ACCESS.md` §3.1 keeps codes from people without an account, and this file is made to be handed to them. This reverses the first draft's "always".                                                                                             |
| 11  | Files tab or planner toolbar?                                                           | The Files tab, with one secondary "Go to exports" action in the header; the planner may grow a shortcut later.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | The plan's reason stands, and the UX review found a panel under a long file list unfindable on a phone.                                                                                                                                                                                                        |
| 12  | What happens to the journey-book variant of `DOC-06`?                                   | Left open and unowned, with an issue filed by Phase 4 as its handle; not deferred to `08-S7`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | The plan's measured reasons hold at HEAD: the payload needs a `tripId` and the document shape has no image. A requirement named only in prose that becomes history is lost.                                                                                                                                    |
| 13  | How is the stage evidenced?                                                             | `e2e/documents-and-media.spec.ts`, existing helpers, server functions intercepted so nothing is written to the demo workspace, console, layout-shift, focus and live-region assertions, frames from `capture.mjs` plus spec screenshots.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | ADR 0016 retired the baselines and the `.visual.` spec; the local server has no queue consumer, and the demo workspace's monthly allowance is a shared resource.                                                                                                                                               |
| 14  | Does the stage keep the `trip_files`-row alternative or an index table?                 | No to both; the list is read from R2.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | An export row would sit inside the traveller's file list and `files` quota; an index would be a second source of truth for a listing the prune keeps short.                                                                                                                                                    |
| 15  | Is `attachmentHeaders` (from `06-S1`) required?                                         | No. Used if present when Phase 2 is built; otherwise the same headers are built inline, with a test.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | The two specs are independent and may land in either order; the headers must not diverge, which the test asserts.                                                                                                                                                                                              |
| 16  | How is the work cut into tickets?                                                       | Four vertical tickets (artifact, owner exports and downloads, everyone else and the email, purge), not five layered phases.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Panel (product owner): `SDLC.md:72` and `afk-to-tickets` tell the slicer to merge a repository nobody calls and a panel for another phase's functions, so the spec's own cut would have been overruled.                                                                                                        |
| 17  | Does the document include transport, and cancelled items?                               | Yes: one **Transport** section from `listTripTransports` (one row per record, legs of a chain not listed); cancelled reservations and transports are left out; no trip status row.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Panel (product owner, UX): a flight or train is the first thing a driver needs and the first draft left it out; a raw status would be untranslated. A single section avoids matching transports to days.                                                                                                       |
| 18  | When is an artifact "ready", and does the read side enforce the seven days?             | The `.pdf` is written before the `.html`, so the `.html` is the completion marker; listing and download both require it and both refuse an artifact older than seven days.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Panel (architect): otherwise a poll announces "ready" for an html-only artifact and the format changes under the reader, and a trip exported once serves a three-week-old file under "kept for 7 days".                                                                                                        |
| 19  | Does the handler re-check the requester's scope?                                        | Yes, as `trip-copy.ts` does: a departed requester or a gone trip is a `TaskPermanentError` before anything is written or emailed.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Panel (security): closes the in-flight-deletion gap and the "ready" email to someone who has left, for two D1 reads.                                                                                                                                                                                           |
| 20  | Does a missing download say "gone" or "missing", and in which language?                 | One 404 with the code `{ error: 'missing' }` for every miss; the panel maps it to a catalogue key.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Panel (security, UX): "pruned" and "never existed" cannot be told apart without the KV pointer, which must stay unread; an English sentence from the server would break `docs/SPEC.md` §9.                                                                                                                     |
| 21  | Switch or checkbox for the options, and a table or a list for the artifacts?            | `CheckboxField` for both options; a `div role="list"` of `ModuleRow` for the artifacts.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Panel (accessibility): a `Switch` is for a setting that applies immediately; `Table` scrolls sideways and loses its semantics when stacked at 360 px.                                                                                                                                                          |
| 22  | What does the traveller see while waiting, after a reload, and after the window closes? | A pending row kept in `sessionStorage` per trip; "taking longer than usual" with Refresh and the request button enabled again; a failed poll keeps the rows; one live region announces each state once.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Panel (UX, accessibility): a reload must not spend one of three free exports, and a button disabled for good after a dead-lettered job is a trap.                                                                                                                                                              |
| 23  | What is the term, and what is the panel called?                                         | **Trip export**, the panel "Export the trip"; the reservations section is "Reservations".                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Panel (UX): `CONTEXT.md` defines a trip's plan as excluding its record and says to avoid "booking" for a Reservation.                                                                                                                                                                                          |
| 24  | Panel verdicts, round 1                                                                 | Product owner, software architect, security and tenancy, accessibility and UX each answered **approve with conditions** (no `revise`, no `ESCALATE`). Every condition is applied in this revision.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Round 2 is row 25.                                                                                                                                                                                                                                                                                             |
| 25  | Panel verdicts, round 2 (final)                                                         | Software architect **approve**; security and tenancy **approve** (no conditions; two nits applied: the in-flight window is "narrowed" not "closed", and the task-id pattern is checked in the handler so a malformed id is the same 404). Product owner, accessibility and UX each answered **approve with conditions**, every one applied in the follow-up commit: stays carry `Ref.` only with `includeReferences`; the footer key lands with 06-S3a; the list is `div role="list"` of `listitem` rows; named focus targets and an additive `ModulePanel` `headingProps`; `linkGone` announced through the status region and shown only after a successful load; a time reaches the traveller through one `madeAt` key; `th`/`td` styles; one fixed request button and no `EmptyState` action; `truncatedRows` and every number-bearing key a plural object; a request-failure body key; `resetsOn` in the list answer and the pre-press quota text with `aria-describedby`; a `route` key instead of an arrow; `idea` transports left out; viewer variants of the copy. | No `revise` and no `ESCALATE`; the two-round limit is reached and every condition is met, so the spec is mergeable by this pipeline.                                                                                                                                                                           |
| 26  | Independent review of this PR (om-auto-review-pr, specification review)                 | Three majors and seven minors, all applied in the spec text: a 100 KB serialised-size budget for the document (the queue message cap is 128 KB); `{date}` and `{time}` of `madeAt` read in the same zone, UTC when the zone is null; no forged server-function frames in e2e (populated-list states are component tests); the stay list is de-duplicated by id; the button is gated on `canRequest` from 06-S3b; the ticket wording says what each ticket shows; the handler is built through a `createPdfExportHandler(databaseFor)` seam.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Decided by an independent reviewer sub-agent (verdict: request changes on the head `13749077`; each finding checked against the code before it was applied).                                                                                                                                                   |
| 27  | Which governs the Free plan: the `pdfExport` module flag or `PLAN_QUOTAS`?              | `PLAN_QUOTAS` (3 exports a month on Free): nothing else enforces the `pdfExport` flag today, and the quota is what the ticket meters and shows. A dead-lettered job keeps its unit (the refund trade-off in the failure rows stays as written), and the Phase 4 listing is tested with `#/server/auth/env` mocked and `filesBucket()` imported dynamically, as `trip-lifecycle-side-effects.test.ts` does.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Decided on the reviewer's evidence (`src/lib/plans.ts`, the existing purge test): the smaller, reversible reading.                                                                                                                                                                                             |
