# The confirmation file that fills the desk in: a producer, a model branch and a review surface

| Field              | Value       |
| ------------------ | ----------- |
| **Status**         | in-progress |
| **Issue**          | #178        |
| **Spec PR**        | #433        |
| **Implementation** | #435        |

`03-S7` · FR #178 · Parent PRD #167 · Stage `03-S7` of `docs/plans/03-reservations-and-transport.md` (frozen), rows `BKG-03` and `BKG-04`. Decision: `docs/adr/0012-workers-ai-for-confirmation-extraction.md`.

Source plan: `docs/plans/03-reservations-and-transport.md`, stage `03-S7` — "The confirmation file that fills the desk in". Measured against the tree at `4a6c33d9`; where this spec departs from the frozen plan it says so and gives the measurement that forced it.

## 📝 TLDR

The booking-import queue handler is finished and has never run. `src/server/queue/handlers/booking-import.ts` reads an R2 object, parses a calendar or a JSON export, classifies rows, extracts reference codes, caps at 500, stages the result in KV for a day and pokes the trip's room — and **nothing in the repository enqueues a `booking-import` task**. There is also no surface on which a reader could see what was read.

This spec attaches the three missing pieces and one branch. A producer (`startBookingImportFn`) turns an uploaded file into a queued task; **one branch in front of the parse** turns a PDF, an email, a web page, a photo or an Office document into text and then into staged reservations through the `AI` binding that already exists; a review dialog shows what was read and lets a reader prune it; a **global** widget in the application shell carries the job across navigation and reload; and a bulk confirm writes only the rows that survived pruning — with the source file attached, a lodging place created and pinned where possible, and `imported_at` set.

Three refusals are designed rather than surfaced: a format the conversion does not accept is refused **at the upload boundary naming the formats that work**, the extraction ceiling refuses **in its own words** rather than in the transit search's, and a price the document did not clearly state is **left empty**.

No column is declared, no second parsing engine is written, and no dependency is added.

## 📝 Problem Statement

**Who has it.** Anyone who has just booked anything. A traveller's inbox holds a PDF from the airline, an HTML page from the hotel and a photograph of a printed voucher. The product asks them to retype all of it into a form. `wiki: AI-Booking-Import` states the behaviour this ticket exists for: a traveller hands the product a confirmation file rather than retyping it.

**The evidence, measured in the tree at `4a6c33d9`:**

- `grep -rn "startBookingImport\|getBookingImport\|confirmBookingImport" src/ e2e/` returns **nothing**. None of the three verbs exists.
- `grep -rn "enqueueTask" src/` reaches exactly two live producers — `src/server/auth/email.ts:289` (`kind: 'email'`) and `src/server/fns/atlas.ts:441` (`kind: 'travel-stats'`). **No call site anywhere passes `kind: 'booking-import'`.** The handler has never executed in this product.
- `src/server/extract/` does not exist. `src/components/modules/book/` holds `booking-dialog.tsx`, `booking-form.ts`, `bookings-timeline.tsx`, `grouping.ts` and `index.ts` — no import dialog, no widget, no drafts module.
- `src/server/fns/file-policy.ts` accepts `.ics` (`:80`, `:104`) and `.json` (`:86`, `:108`) — the two formats a _machine_ exports. It also already accepts `.pdf`, the raster images, `.txt` and the two Office types as _documents_; what it has no notion of is which of them an **import** can read, which is a different question from which of them may be **stored**.
- The writer this spec confirms into is on disk: `markReservationsImported` (`src/server/repos/reservations.ts:470`), `clearReservationImported` (`:495`), `reservations.imported_at` (`src/server/db/schema.ts:1286`) and its index (`:1318`), and `syncReservationExpense` (`src/server/fns/reservations.ts:279`). All landed in `03-S4` (#176).

**What it costs.** The most expensive machinery in this feature — a queue, an envelope schema, a consumer registry, a parser, a stager, a room notification — is built, tested and completely unreachable. A reader cannot get a single booking into the desk without typing it.

## 📝 Proposed Solution

Two new server modules, three server functions, three new client modules, and one branch inserted into a handler that is otherwise untouched.

1. **`src/server/extract/document.ts` (new) — bytes to text, and never a reservation.** `env.AI.toMarkdown()` for the formats it converts, a direct UTF-8 read for plain text, and the mail message read as text with its long base64 runs stripped by a bounded regex. It returns a string. Splitting here is what lets the thing that reads a file and the thing that understands a booking be tested apart.
2. **`src/server/extract/booking.ts` (new) — text to `StagedReservation[]`.** `env.AI.run()` behind an **injected** model port, a Zod validator on the model's answer, and the field rules — including the one about money, which this module exists to enforce rather than to apply loosely.
3. **`src/server/queue/handlers/booking-import.ts` (edit) — one branch in front of the parse.** When the format is not `ics` or `json`, the bytes become text and the text becomes staged rows. **The staged output is the same `StagedImport` either way**, so the KV staging, the 500-row cap, the TTL and the room notification are reused untouched and untested-again.
4. **`src/server/fns/booking-import.ts` (new) — the three verbs.** `startBookingImportFn` enqueues through `enqueueTask(taskQueue(), …)`, the same pair `auth/email.ts:289` already ships; `getBookingImportFn` reads the staged record and re-checks its `orgId` and `tripId` against the caller's scope; `confirmBookingImportFn` writes the accepted rows, attaches the file, creates and pins the lodging place, stamps the marker in chunks that fit D1's 100 bound parameters, and deletes the staged entry **only** on full success.
5. **`src/components/modules/book/import-drafts.ts` (new) — the pure half of the client.** The staged-row-to-draft mapping, the total kind mapping, the floating-time resolution against the trip's zone, and the selection reducer. Testable without a DOM.
6. **`src/components/modules/book/import-dialog.tsx` and `import-widget.tsx` (new).** The dialog is the entry point and the review list; the widget is global, mounted in the application shell, and outlives the dialog that started the job.

### Three corrections to the frozen plan, each measured

The plan is frozen and this spec does not edit it. It does have to be built against the tree, and on three points the tree disagrees with it.

**1. The widget's mount point is `src/routes/_app/route.tsx`, not `src/components/layout/app-frame.tsx`.** The ticket names the impersonation bar as the precedent, and the precedent is right — but `app-frame.tsx` is not where it lives. `app-frame.tsx` is 55 lines exporting `AppFrame` (a `<main>` content well) and `AppSections` (a flex helper); every page renders one **inside itself**, so a widget mounted there unmounts and remounts on every navigation — precisely the property the ticket requires it not to have. `ImpersonationBar` is mounted at `src/routes/_app/route.tsx:106`, beside `TopNav`, `<Outlet/>` and `MobileNav`, which is the one component tree that survives a route change inside the app. Following the stated precedent means mounting there. `app-frame.tsx` is not edited at all.

**2. The extraction meter and its ceiling already exist; nothing is filed on a foundations stage.** The plan asks for a per-tenant monthly tally "passing a different metric name to the same meter" and files the ceiling onto the wave-4 quota stage. Both have landed: `src/server/metering/rate.ts` exports `spendRateUnit(store, { metric, organizationId, ceiling, now })` and `RateCeilingError`, its header names `03-S7` as one of the three callers it was minted for, and `src/server/billing/limits.ts:120` already carries `extraction_calls_per_month` in `RATE_METRICS` with `PLAN_RATE_CEILINGS` at `0 / 100 / 400`. The `AI` binding is declared in both deployed environments (`wrangler.jsonc:129`, `:244`) and `src/server/ai/bindings.ts` exports `aiBinding()` whose docblock says in as many words: _"There is no caller yet, and that is the ticket."_ This spec is that caller. It adds no metric, no ceiling and no binding.

**3. The ceiling's words are chosen in the client, because `RateCeilingError`'s are the transit search's.** `rate.ts:91-104` hard-codes two English sentences — _"Connection search is not part of this workspace's plan"_ and _"…used all N of its searches this month"_ — and `rate.ts` is not an owned path. The error already carries what is needed to do better: `readonly metric`, `readonly ceiling`, `readonly spent`. The server function therefore maps a `RateCeilingError` to a typed refusal (`{ code: 'ceiling', ceiling }`) and **never forwards `error.message`**, and the widget renders the extraction's own copy from the two keys under `modules.book.import.ceiling.*`. That also keeps the refusal inside the 23-locale catalogue, which a server-side `Error.message` never is. That `rate.ts` speaks only the transit search's words is a real, pre-existing narrowness; it is reported here rather than repaired, because the file belongs to no stage in this wave.

## 📝 Architecture

The request path writes nothing and waits for nothing. It validates, resolves the file through the tenant-scoped repository, and hands one envelope to the queue.

```
browser                     request path                    queue                       browser
───────                     ────────────                    ─────                       ───────
uploadFile() ──────────────► uploadTripFileFn
  (existing XHR path)         └─ recordFile: assertQuota(files, storage_bytes)
                                 └─ { fileId }
startBookingImportFn ──────► appScope → requireTrip → getFile
                              └─ enqueueTask(taskQueue(), {
                                   kind: 'booking-import',
                                   id: `booking-import:${tripId}:${fileId}`,
                                   payload: { tripId, requestedBy,
                                              sourceKey, sourceName, format } })
                                                              │
                                                              ▼
                                                    handleBookingImport
                                                     ├─ FILES.get(sourceKey), ≤ 5 MiB
                                                     ├─ format 'ics' | 'json' → the parsers
                                                     └─ format 'document' →
                                                          spendRateUnit(extraction_calls_per_month)
                                                          → documentToText(ai, …)
                                                          → textToReservations(ai, …)
                                                     ├─ KV.put(stagedImportKey(taskId), 24 h)
                                                     └─ TRIP_ROOM poke
getBookingImportFn ◄──────── KV read + scope re-check ◄───────┘            (bounded poll, 2 s)
confirmBookingImportFn ────► createReservation × n
                              ├─ syncReservationExpense
                              ├─ updateFile({ reservationId })
                              ├─ createPlace + forwardGeocode (lodging only)
                              ├─ markReservationsImported(scope, tripId, writtenIds) ← chunked statements
                              └─ KV.delete  ── only when every accepted row was written
```

**Everything crossing a trust boundary is re-derived, never carried.** The client sends a **file id**, never a storage key: a storage key from a client is a path into a shared bucket. The client sends a **job id**, and a job id is not an authorisation — the staged record's own `orgId` and `tripId` are compared with the scope the caller just proved, because a KV key is a guessable string and KV is not tenant-scoped by construction the way a repository is.

**The model is a branch, not a replacement.** `.ics` and `.json` never reach it: a format with a grammar is better read by a parser than by a model, and the deterministic path also costs nothing against the meter.

**The meter is spent inside the handler, after the cache-free read and before the model call.** There is no cache to sit in front of — ADR 0012 records that this is the only one of the three metered dependencies with none, because each file is unique — so the order is simply: read the object, spend the unit, call the model. A refusal at the ceiling is a `TaskPermanentError` carrying the refusal code, so the handler dead-letters it rather than retrying a call the workspace may not make.

### Sequencing five files without a coordination table

The ticket asks for up to five files per drop, "queued as separate tasks and parsed sequentially per user so one large document cannot starve the others". Cloudflare Queues offers no per-key ordering, and this spec declares no table to build one.

All five are enqueued **at drop time**, staggered by `delaySeconds = index × EXTRACTION_BUDGET_SECONDS` (20). One act of enqueueing, so a closed tab strands nothing; a spacing wide enough that the ordinary case never overlaps; and no new state anywhere. The imprecision is stated rather than hidden: a file that takes longer than its budget can overlap the next one. Two concurrent extractions for one workspace is not starvation, and the meter bounds the spend either way. The alternative — the client starting file _n+1_ only when _n_ finishes — is truly sequential and was rejected because it makes the browser the scheduler for durable work, which is the property the queue exists to remove.

## 📝 Data Model

**No schema change. This spec declares no column and generates no migration.** `pnpm db:generate` is not run and `drizzle/` is untouched.

Everything it writes already exists:

| Column                      | Declared by       | Written here                                                        |
| --------------------------- | ----------------- | ------------------------------------------------------------------- |
| `reservations.imported_at`  | `03-S4` (#176)    | `markReservationsImported(scope, tripId, ids)` — chunked statements |
| `trip_files.reservation_id` | on disk (`:1653`) | `updateFile(scope, tripId, fileId, { reservationId })`              |
| `places.*`                  | on disk           | `createPlace` — lodging only, and only when none matches            |

**The staged import stays in KV.** An unreviewed import is not durable state, and a table for it would be something a tenant has to clean up. `STAGED_IMPORT_TTL_SECONDS` (24 h) expires it whether it is confirmed or not.

**`StagedImport` gains one field, and it is the field a partial failure needs.**

```ts
export interface StagedImport {
  /* …unchanged… */
  format: 'ics' | 'json' | 'document'
  /** Rows already written by a confirm, so a retry writes only the remainder. */
  written?: ReadonlyArray<{
    readonly index: number
    readonly reservationId: string
  }>
}
```

`written` is optional so every record staged before this change still parses. The confirm writes the record back with `written` extended **before** it returns a partial failure, and deletes the key only when every accepted row is present in it. An earlier reading of the ticket deleted the entry unconditionally and still promised the reader a partial retry; the two cannot both be true, because once the staged record is gone there is nothing to retry from.

**A row is identified by its index, and the frozen plan's index-and-external-id pair is not needed.** The staged array is written once and never reordered — nothing in the product mutates a staged record's `reservations` — so the index is unambiguous on its own, and a composite key would be a checksum against a change that cannot happen. `accept` is therefore `z.array(z.number().int().min(0).max(499)).max(500)`.

**Money.** A staged row carries no amount today and gains no float. When the extractor reads one confidently it produces `{ priceMinor: number; currency: string }` — an integer count of minor units beside an ISO-4217 code — and when it does not, **both fields are absent** and the draft is marked "needs a look". Nothing is rounded, inferred from a half-recognised symbol, or carried across from another line on the page.

## 📝 API Contracts

### Queue — `src/server/queue/types.ts` (edit)

```ts
export const bookingImportPayloadSchema = z.object({
  tripId: z.string().min(1).max(64),
  requestedBy: z.string().min(1).max(64),
  sourceKey: z.string().min(1).max(1024),
  /** Sanitised filename; `toMarkdown` converts by extension and the R2 port exposes no content type. */
  sourceName: z.string().min(1).max(200),
  format: z.enum(['ics', 'json', 'document']),
})
```

**One new member, not one per media type.** The handler's branch is binary — a grammar the parsers know, or text a model reads — and the conversion itself dispatches on the filename. `sourceName` is added because `TaskBindings.FILES.get` returns `{ body, size }` and nothing else (`types.ts:398-401`): the content type is simply not reachable through the declared port, and widening a structural port that every test fake implements is a larger change than one string on a payload. `sanitiseFilename` has already run on it by the time `trip_files.filename` holds it.

### Extraction — `src/server/extract/document.ts` (new)

```ts
/** The slice of the `AI` binding this module uses. A stub satisfies it; no test touches the network. */
export interface DocumentConverter {
  toMarkdown: (input: { name: string; blob: Blob }) => Promise<{ data: string }>
}

export const IMPORT_TEXT_MAX_CHARS = 40_000

export type DocumentTextFailure = 'unreadable' | 'empty'

export async function documentToText(
  converter: DocumentConverter,
  input: { readonly name: string; readonly bytes: ArrayBuffer },
): Promise<string>
```

Three routes, decided by extension:

| Extension                                         | Route                                      |
| ------------------------------------------------- | ------------------------------------------ |
| `.pdf`, `.html`, `.htm`, `.docx`, `.xlsx`, images | `converter.toMarkdown({ name, blob })`     |
| `.txt`, `.md`                                     | UTF-8 decode. It is already text.          |
| `.eml`                                            | UTF-8 decode, then the base64 strip below. |

**The mail message, without a MIME parser.** `toMarkdown` does not list `message/rfc822`, and a MIME package is a `pnpm add` the dependency freeze forbids (docs/SPEC.md §3). Writing one by hand is quoted-printable, nested multipart and boundary handling — a real cost for a structural parse the extractor does not need, because it is looking for a reference code, two dates and a place. `document.ts` therefore decodes the bytes as text and removes runs of 200-plus base64 characters with one bounded regex before capping. **What that gives up is stated rather than hidden:** a confirmation whose only detail sits inside a base64 attachment comes back needing fields filled in, which is the same "recorded, needs review" outcome any thin document gets. Uploading that attachment directly is a format this spec now accepts anyway.

`.pkpass` is **not** accepted, and its absence is a decision: it is a zip, so it needs central-directory reading and an inflate — our own code, for a format rarer than either the PDF or the mail this spec does add.

Text is capped at `IMPORT_TEXT_MAX_CHARS` before it reaches the model, so one 200-page scan cannot turn into an unbounded prompt. A conversion that yields nothing after trimming throws `TaskPermanentError('empty')` — "we could not find a booking in that file" is a designed outcome, not a stack trace.

### Extraction — `src/server/extract/booking.ts` (new)

```ts
/** The slice of the `AI` binding this module uses. Injected, so no test touches the network. */
export interface BookingModel {
  run: (model: string, input: unknown) => Promise<unknown>
}

export const EXTRACTION_MODEL = '@cf/meta/llama-3.1-8b-instruct'

export async function textToReservations(
  model: BookingModel,
  input: { readonly text: string; readonly sourceName: string },
): Promise<Array<StagedReservation>>
```

`StagedReservation` is **imported from the handler module**, not re-declared, so the staged shape has exactly one definition.

The model's answer is parsed by a Zod schema and never trusted structurally. The three rules it enforces:

- **A malformed answer is rejected whole** — `TaskPermanentError`, never a half-filled draft. A model that returned four good rows and one unparseable one yields four rows.
- **An unparseable amount is dropped**, and the row carries `needsReview: true`. Never rounded, never inferred.
- **A date the model invented is not detectable and is not pretended to be.** What the design does instead is make every extracted row visibly machine-written: it reaches the review list before anything is written, and every row it writes carries `imported_at`, which `03-S6` renders as "Unchecked import". This is ADR 0012's load-bearing consequence, stated where it is implemented.

### Queue handler — `src/server/queue/handlers/booking-import.ts` (edit)

`handleBookingImport` gains the branch and nothing else. The R2 read, the 5 MiB refusal, the 500-row cap, the KV staging, the TTL and the room poke are untouched.

```ts
const parsed =
  payload.format === 'ics'
    ? parseIcsCalendar(source).map(icsEventToReservation)
    : payload.format === 'json'
      ? parseJsonImport(source)
      : await extractFromDocument(payload, object, context)
```

`extractFromDocument` spends one `extraction_calls_per_month` unit through `spendRateUnit(context.env.KV, …)` before it reaches the binding, converts a `RateCeilingError` into `TaskPermanentError` carrying the code `ceiling`, then runs `documentToText` and `textToReservations`. The ceiling comes from `resolveLimits()` for the envelope's organization, never from a constant in this module.

### Server functions — `src/server/fns/booking-import.ts` (new)

**Authorisation, stated once for all three.** `appScope()`, then `requireTrip`, then — for the two that take a job id — the staged record's own `orgId` and `tripId` compared against that scope.

| Function                 | Method | Input                                 | Answer                           |
| ------------------------ | ------ | ------------------------------------- | -------------------------------- |
| `startBookingImportFn`   | POST   | `{ tripId, fileId }`                  | `{ jobId }`                      |
| `getBookingImportFn`     | GET    | `{ tripId, jobId }`                   | `{ status, staged? , refusal? }` |
| `confirmBookingImportFn` | POST   | `{ tripId, jobId, accept: number[] }` | `{ written, failed, remaining }` |

- **`startBookingImportFn`.** The **only** enqueue site. `getFile(scope, fileId)` supplies the storage key and the filename, and its `tripId` is compared with the trip; the format is derived server-side from the stored filename through the new `importFormatFor()` in `file-policy.ts`, not taken from the client. The envelope id is **`booking-import:${tripId}:${fileId}`** — 15 + 25 + 1 + 25 + 1 = 67 characters, inside the envelope's `max(128)`. Three properties follow from that one choice: a double submit is one job, because a completed job's marker lives under `task:done:<id>` for 24 hours; a corrected file is a different job, because it is a new upload with a new id; and the staged result is findable without a second identifier, because the handler stages under `stagedImportKey(context.taskId)`. **The trip id is in the key on purpose** — keyed on the file alone, one uploaded confirmation could be imported into exactly one trip ever.
- **`getBookingImportFn`.** Returns `working` while nothing is staged, `ready` with the staged record, or `refused` with a typed code (`ceiling`, `unreadable`, `empty`, `too-large`). It never forwards a raw `Error.message`: the reader's words come from the catalogue.
- **`confirmBookingImportFn`.** Re-reads the staged record, re-checks the scope, skips any index already in `written`, and for each remaining accepted row: `createReservation` → `syncReservationExpense` → `updateFile(scope, tripId, fileId, { reservationId })` → for an `accommodation`, `createPlace` when the trip holds no place of that name, then `forwardGeocode` for the pin. It then stamps **one** `markReservationsImported(scope, trip.id, writtenIds)` for the whole batch and asserts the returned count equals the number it wrote — a shortfall is an id that did not resolve inside its own scope, which is a bug and is logged as one. One `trip` patch is mirrored into the room, so other tabs refresh once rather than five hundred times.

**The geocoding proxy is called and not re-minted, and the call site is this module.** The frozen plan puts the proxy behind `src/routes/_app/trips/$tripId/-server/geocode.ts`; **that file does not exist** — `grep -rn "forwardGeocode" src/` reaches `src/server/geo/geocode.ts` and three test files and nothing else, so this spec is the proxy's first production caller. It assembles the runtime with `geocodeRuntime()` from `src/server/geo/bindings.ts` and calls `forwardGeocode`, exactly as a route-local module would. **A failed lookup is not a failed import**: `GeoProviderError`, `RateCeilingError` and `ProviderBlockedError` are all caught around the lookup alone, the place is written without coordinates, and the map already filters those rows.

### Upload policy — `src/server/fns/file-policy.ts` (edit)

The accepted-media-type table is not widened: every format below is already storable. What is added is the answer to a **different** question — which stored formats an _import_ can read — because refusing at the upload boundary needs it and nothing on the branch can answer it:

```ts
export const IMPORT_ACCEPT_ATTRIBUTE =
  '.pdf,.html,.htm,.eml,.txt,.md,.png,.jpg,.jpeg,.webp,.heic,.docx,.xlsx,.ics,.json'
export const MAX_IMPORT_FILES = 5

export type ImportFormat = 'ics' | 'json' | 'document'

/** The format an import would read this file as, or `null` when it cannot read it at all. */
export function importFormatFor(
  filename: string,
  contentType: string,
): ImportFormat | null
```

Two entries are added to `ACCEPTED` and `BY_EXTENSION` because the import needs them and the library does not hold them today: `text/html` (`.html`, `.htm`) and `message/rfc822` (`.eml`), both as `document`. The per-object ceiling is **not** raised: `MAX_IMPORT_BYTES` (5 MiB) is the engine's existing refusal and it stays, because a confirmation that does not fit in 5 MiB is a scan at a resolution nobody needs.

## 📝 UI/UX

**Entry point.** An **Import** action beside the existing `NewBookingAction` in the desk header (`src/routes/_app/trips/$tripId/book.tsx`). Always visible: an entry point that appears and disappears based on a server capability is a single-tenant idea, and the engine is always present. No route file is added, so `pnpm generate-routes` is not run and `src/routeTree.gen.ts` is not touched.

**The dialog** is a drop target with a click-to-browse fallback, stating the formats it reads. A file it cannot read is refused **there, by name** — `"voucher.pkpass" is not a file this import can read` followed by the list that works — rather than accepted and failed later, because a refusal a reader understands beats a rejection they have to guess at. Up to five files; each is uploaded through the existing `uploadFile` (`src/components/modules/files/upload.ts`), which posts over `XMLHttpRequest` and therefore reports **real** bytes leaving the machine. This spec writes no second uploader.

**The dialog can be closed and the work continues.** That is the whole reason the widget exists. Job ids live in `localStorage` under `planned.book-imports` — the product prefix — with their trip id and filename; the widget re-reads them on mount, so the job survives closing the dialog, navigating to another trip and reloading the page.

**How the widget learns the parse is done.** By a **bounded poll** of `getBookingImportFn`, every 2 seconds, for at most 20 seconds per file, after which it stops and offers an explicit **Check again**. The frozen plan expects the trip-room subscription to carry the signal; on this tree `useTripRoom` (`src/components/modules/collab/use-trip-room.ts`) is **per trip** and is mounted by `PresenceBar` on one screen, while this widget is global and deliberately outlives the trip route — it has no trip to subscribe to. A bounded poll with a manual escape is the honest mechanism, and it is never an unbounded poll against a queue. Generalising the subscription is `07-S1`'s and is not taken here.

**The review list.** One row per detected booking, grouped by the file it came from when there is more than one: type, title, dates, location, reference. Each row deselectable, with select-all and select-none and a live count in the confirm button ("Add 7 bookings"). A row the extractor filled only partially is marked **before** it is written, not after, and a row whose price was dropped says so in its own words.

**Confirm** writes the selected rows, closes the dialog, and lands the reader back on the desk with the new rows carrying `03-S6`'s "Unchecked import" marker.

**States.**

- _Empty._ Two. The drop target at rest on `--color-surface-2`, carrying the formats and the size limit; and a parse that found nothing, which names the file and offers another. The second is a real outcome — the engine raises it as a permanent error — and is designed rather than surfaced as a stack trace.
- _Skeleton._ Five placeholder rows shaped like the rows that replace them, while the staged result is fetched.
- _Error._ Three, each recoverable: an upload that failed (retry the upload), a parse that failed permanently (the reason, in the catalogue's words, and a way to pick another file), and a confirm that partially failed (the written rows listed, the rest still selected, and a retry that writes **only** those — which works because the staged entry survives a partial failure).
- _Refused at the ceiling._ Its own state, worded as what it is, never as a generic failure.
- _The widget._ Working with a count; done, which lingers long enough to be clicked and then dismisses itself; and failed, which does **not** dismiss itself, because a failure nobody saw is a failure that will be reported as data loss.
- _Every control._ Rest, hover, focus-visible, active, disabled and loading on the drop target, every checkbox, select-all, the confirm and the cancel. The confirm is disabled with a reason while nothing is selected, and shows its spinner without changing width.

**Motion.** Review rows enter with the standard 20–30 ms stagger capped at eight, `--duration` on `--ease-out-quint`, transform and opacity only, collapsed under `prefers-reduced-motion: reduce`. The progress bar is a real measurement and is not animated beyond its own value.

**Tokens.** None missing. The drop target's active border is `--color-brand` on `--color-brand-subtle`, the partial-parse marker is `--color-warning-soft`, and the counts carry `tabular-nums`. All checked at AA in both themes.

**Accessibility.** The drop target is a `<button>` wrapping a visually hidden `<input type="file">`, so it is reachable and operable by keyboard without a drag. The widget is an `aria-live="polite"` region announcing the count, not each row. The review list is a list of labelled checkboxes with a real `<fieldset>` legend, and select-all is a button rather than a tri-state checkbox.

## 📝 Visual change expected

| Route                 | State                                                  | Themes       | Widths            |
| --------------------- | ------------------------------------------------------ | ------------ | ----------------- |
| `/trips/$tripId/book` | The desk header with **Import** beside **New booking** | light + dark | 360 / 1280 / 2560 |
| `/trips/$tripId/book` | The import dialog at rest on its drop target           | light + dark | 360 / 1280        |
| `/trips/$tripId/book` | The review list populated, one row deselected          | light + dark | 360 / 1280        |
| `/trips/$tripId/book` | The refusal state — an unaccepted format, named        | light + dark | 1280              |
| any `_app` route      | The global widget working, then done                   | light + dark | 360 / 1280        |

Judged by the blind A/B pair (`scripts/visual/capture.mjs`), which docs/SPEC.md §7.4 makes the whole of the visual judgement since ADR 0016. The frozen plan's `e2e/reservations-and-transport.visual.spec.ts` and its `__screenshots__/` directory are **not** owned paths here: ADR 0016 retired the screenshot gate, and #178 says so and names `e2e/journeys.spec.ts` instead. Behaviour is the assertion.

## 📝 Copy

Forty-one new keys in the `modules` namespace under `modules.book.import.*`, beside the existing `book.*` keys in `src/lib/i18n/messages/<locale>/modules.ts`, landing in all 23 locales in the same change (docs/SPEC.md §9, procedure in the `i18n-messages` skill).

**Entry point and drop target**

| Key                        | `en`                                                                                          |
| -------------------------- | --------------------------------------------------------------------------------------------- |
| `book.import.action`       | Import                                                                                        |
| `book.import.title`        | Import bookings from a file                                                                   |
| `book.import.description`  | Drop a confirmation and we will read it. Nothing is added to the trip until you have seen it. |
| `book.import.drop.idle`    | Drop files here, or browse                                                                    |
| `book.import.drop.active`  | Release to add                                                                                |
| `book.import.drop.formats` | PDF, saved email, web page, photo, Word, Excel, calendar or JSON export.                      |
| `book.import.drop.limits`  | Up to {files} files at a time, each up to {size}.                                             |
| `book.import.drop.browse`  | Browse files                                                                                  |

**Refused at the upload boundary**

| Key                            | `en`                                                                                                                                                             |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `book.import.refused.format`   | “{filename}” is not a file this import can read. It reads a PDF, a saved email, a web page, a photo, a Word or Excel document, a calendar file or a JSON export. |
| `book.import.refused.tooMany`  | Only {files} files at a time. The rest were not added.                                                                                                           |
| `book.import.refused.tooLarge` | “{filename}” is {size}. An import reads files up to {limit}.                                                                                                     |
| `book.import.refused.empty`    | “{filename}” is empty, so there is nothing to read.                                                                                                              |

**The extraction ceiling, in its own words**

| Key                            | `en`                                                                                                                           |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `book.import.ceiling.title`    | This workspace has read all its confirmations this month                                                                       |
| `book.import.ceiling.body`     | The plan includes {ceiling} file readings a month, and the allowance renews on the first. You can still add a booking by hand. |
| `book.import.ceiling.none`     | Reading a confirmation file is not part of this workspace’s plan                                                               |
| `book.import.ceiling.noneBody` | Upgrade to have a confirmation read for you. Adding a booking by hand is always available.                                     |

**The widget**

| Key                          | `en`                                |
| ---------------------------- | ----------------------------------- |
| `book.import.widget.title`   | Reading confirmations               |
| `book.import.widget.working` | {done} of {total} read              |
| `book.import.widget.file`    | Reading “{filename}”                |
| `book.import.widget.done`    | {count} bookings ready to review    |
| `book.import.widget.review`  | Review                              |
| `book.import.widget.failed`  | “{filename}” could not be read      |
| `book.import.widget.stalled` | This is taking longer than expected |
| `book.import.widget.check`   | Check again                         |
| `book.import.widget.dismiss` | Dismiss                             |

**The review list**

| Key                                  | `en`                                                                              |
| ------------------------------------ | --------------------------------------------------------------------------------- |
| `book.import.review.title`           | What we read                                                                      |
| `book.import.review.from`            | From “{filename}”                                                                 |
| `book.import.review.selectAll`       | Select all                                                                        |
| `book.import.review.selectNone`      | Select none                                                                       |
| `book.import.review.confirm`         | Add {count} bookings                                                              |
| `book.import.review.confirmNone`     | Select a booking to add                                                           |
| `book.import.review.cancel`          | Cancel                                                                            |
| `book.import.review.needsReview`     | Needs a look                                                                      |
| `book.import.review.needsReviewHint` | Some fields were not in the document. Open the booking after adding it.           |
| `book.import.review.noPrice`         | No price read                                                                     |
| `book.import.review.noPriceHint`     | The document did not state one clearly, so it was left empty rather than guessed. |
| `book.import.review.untitled`        | Untitled booking                                                                  |

**Outcomes**

| Key                         | `en`                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `book.import.empty.title`   | We could not find a booking in that file                                                               |
| `book.import.empty.body`    | “{filename}” had nothing that looks like a confirmation. Try another file, or add the booking by hand. |
| `book.import.failed.title`  | “{filename}” could not be read                                                                         |
| `book.import.failed.body`   | The file opened but nothing could be made of it. Try another file, or add the booking by hand.         |
| `book.import.failed.retry`  | Try another file                                                                                       |
| `book.import.uploadFailed`  | “{filename}” did not upload                                                                            |
| `book.import.uploadRetry`   | Try again                                                                                              |
| `book.import.actionFailed`  | Try again in a moment.                                                                                 |
| `book.import.toast.added`   | {count} bookings added                                                                                 |
| `book.import.partial.title` | {written} of {total} bookings were added                                                               |
| `book.import.partial.body`  | The rest are still selected. Adding again writes only those.                                           |
| `book.import.partial.retry` | Add the rest                                                                                           |

Booking type names (`modules.book.type.*`) and status names (`modules.book.status.*`) are reused as they stand; this spec adds none and changes none.

## 📝 Edge Cases & Failure Scenarios

| Case                                                                | Behaviour                                                                                                                    |
| ------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| The same file dropped twice                                         | One job. The envelope id is `booking-import:<tripId>:<fileId>` and the completed job's marker lives 24 h under `task:done:`. |
| The same file imported into a second trip                           | A different job — the trip id is in the key.                                                                                 |
| A message redelivered by the queue                                  | A no-op after success, by the same marker.                                                                                   |
| A confirm that writes 3 of 7 rows, then fails                       | The staged entry **survives** with `written` holding the 3. The retry writes only the 4, and never duplicates a booking.     |
| A confirm that writes every accepted row                            | The KV entry is deleted. Only then.                                                                                          |
| A job id whose staged record carries another organization's `orgId` | Refused, even though the KV key resolves.                                                                                    |
| A file id belonging to another organization                         | `NotFoundError` from `getFile`, and **no message is enqueued**.                                                              |
| A file id of this organization but another trip                     | `NotFoundError`.                                                                                                             |
| The workspace has spent `extraction_calls_per_month`                | `TaskPermanentError('ceiling')` before the binding is touched; the widget renders the extraction's own refusal.              |
| The plan's extraction ceiling is `0` (Free)                         | The same path, and the `ceiling.none` copy — a plan boundary, not a rate limit.                                              |
| A `.pkpass`, a `.zip`, a video                                      | Refused at the upload boundary, named, with the list that works. No job is created.                                          |
| A sixth file in one drop                                            | The first five are taken; the reader is told the rest were not.                                                              |
| A PDF larger than 5 MiB                                             | Refused at the boundary by the existing ceiling.                                                                             |
| A conversion that yields no text                                    | `TaskPermanentError('empty')` → the designed "we could not find a booking" state.                                            |
| A model answer that does not validate                               | Rejected whole. No half-filled draft is ever staged.                                                                         |
| A price the document did not clearly state                          | Both money fields absent, the row marked "needs a look". Never rounded, never inferred.                                      |
| An `.eml` whose booking is only in a base64 attachment              | Imported as a thin row needing fields filled in — the same outcome any thin document gets. Stated in the dialog's own copy.  |
| A lodging whose place already exists on the trip by name            | No second place. The reservation points at the existing one.                                                                 |
| A geocoding lookup that fails, is refused, or is blocked            | The place is written **without** coordinates. The import succeeds; the map already filters those rows.                       |
| The places quota is already spent                                   | `assertQuota` refuses inside `createPlace`; the reservation is still written and the row is marked for review.               |
| A floating time in the source                                       | Resolved against the **trip's** zone through `src/lib/time.ts`, never the runtime's or the browser's.                        |
| A staged row with no title                                          | Falls back to the catalogue's "Untitled booking" without throwing.                                                           |
| The reader closes the dialog mid-parse                              | The work continues. The widget carries it across navigation and reload from `localStorage`.                                  |
| Nothing arrives within 20 s for a file                              | The poll stops and offers **Check again**. Never an unbounded poll.                                                          |
| One file of five is unreadable                                      | That file fails and no other. The other four are staged and reviewable.                                                      |
| A staged record written before this change (no `written`)           | Parses — the field is optional.                                                                                              |

## 📝 Risks & Impact Review

| Risk                                                                                    | Mitigation                                                                                                                                                                               |
| --------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **A machine-written booking reaches D1 unreviewed** — breaks ADR 0012, not a preference | Nothing is written by the queue at all. The confirm is the only writer, it takes an explicit index list, and every row it writes carries `imported_at`. Asserted by test, not by review. |
| **An unmetered model call on our credential**                                           | `spendRateUnit` runs before the binding is reached, inside the handler, against `resolveLimits()`. A `0` ceiling is refused before the store is touched.                                 |
| **A wrong price in a shared trip's costs**                                              | An amount that does not parse into minor units is dropped and the row marked. Asserted by test.                                                                                          |
| **A KV key is guessable**                                                               | The staged record's `orgId` and `tripId` are compared with the caller's scope on both read paths. Asserted by the tenant-isolation block.                                                |
| **A duplicate booking on a retry**                                                      | `written` on the staged record, and a delete only on full success.                                                                                                                       |
| **`src/server/queue/types.ts` is a shared file**                                        | The change is additive: one union member and one required payload field. The envelope stays a discriminated union and every existing arm is untouched.                                   |
| **Backward compatibility of the payload**                                               | `sourceName` is required on a payload **nothing has ever produced** — the handler has never run, so no in-flight message can lack it. Recorded rather than assumed.                      |
| **A non-deterministic model makes tests flaky**                                         | Both extraction modules take their binding as an injected port. No test touches the network; the fixtures are text in, rows out.                                                         |
| **The base64 strip mangles a legitimate body**                                          | Bounded to runs of 200-plus base64 characters, which no prose reaches. Covered by a fixture holding both.                                                                                |

## 📝 Owned paths

Exactly the ticket's list, minus one and plus three, each named with its reason.

**As the ticket states them:** `src/server/fns/booking-import.ts` (new) · `src/components/modules/book/import-dialog.tsx` (new) · `src/components/modules/book/import-drafts.ts` (new) · `src/components/modules/book/__tests__/import-drafts.test.ts` (new) · `src/components/modules/book/import-widget.tsx` (new) · `src/components/modules/book/index.ts` (edit) · `src/server/queue/handlers/booking-import.ts` (edit) · `src/server/queue/types.ts` (edit) · `src/server/extract/document.ts` (new) · `src/server/extract/booking.ts` (new) · `src/server/extract/__tests__/` (new) · `src/server/fns/file-policy.ts` (edit) · `src/routes/_app/trips/$tripId/book.tsx` (edit) · `src/server/repos/__tests__/tenant-isolation.test.ts` (append) · `e2e/journeys.spec.ts` (append).

**Removed:** `src/components/layout/app-frame.tsx` — it is a content well rendered inside every page, not the shell; see the first correction above.

**Added:**

- `src/routes/_app/trips/$tripId/book.tsx`'s sibling is not enough — `src/routes/_app/route.tsx` (edit) is where the widget mounts, beside `ImpersonationBar`, which is the precedent the ticket names. One line and one import.
- `src/server/fns/__tests__/booking-import.test.ts` (new) — the three functions' own tests. The ticket lists the tenant-isolation append but no home for the ordinary cases.
- `src/lib/i18n/messages/*/modules.ts` (edit, 23 files) — the copy. Implied by the ticket's closing paragraph and by docs/SPEC.md §9; named here so the diff is not a surprise.

`src/server/queue/consumer.ts`, `src/server/queue/jobs.ts`, `src/server/auth/env.ts`, `src/server/fns/context.ts`, `src/server/metering/rate.ts`, `src/server/billing/limits.ts`, `src/server/geo/**` and `src/server/repos/**` are **not** owned and are not edited. The engine is complete, the producer helper is complete, the meter is minted and the proxy exists; this spec attaches to all four.

## 📝 Resolved assumptions (autonomous defaults)

`om-spec-writing --autonomous` resolved these. Each is reversible; say the word on the spec PR and the answer changes before anything is built.

| #   | Question                                                                                                            | Answer                                                                                    | Why                                                                                                                                                                                                                                                                                                    |
| --- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q1  | The ticket says the widget is mounted in `app-frame.tsx`. Is it?                                                    | **No — `src/routes/_app/route.tsx`.**                                                     | `app-frame.tsx` is a 55-line `<main>` rendered inside every page, so a widget there remounts on every navigation — the one property the ticket forbids. `ImpersonationBar`, the precedent the ticket names, is mounted at `route.tsx:106`. Following the precedent means following it to where it is.  |
| Q2  | How are five files "parsed sequentially per user" with no per-key ordering and no new table?                        | **All five enqueued at drop time, staggered by `delaySeconds = index × 20`.**             | Queues offers no ordering and this spec declares no state. A stagger is one act of enqueueing (so a closed tab strands nothing) and bounds concurrent extractions per workspace to one in the ordinary case. Client-driven chaining was rejected: it makes the browser the scheduler for durable work. |
| Q3  | How does the global widget learn a parse finished?                                                                  | **A bounded poll of `getBookingImportFn`, 2 s apart, 20 s per file, then "Check again".** | `useTripRoom` is per trip and mounted by `PresenceBar` on one screen; a global widget has no trip to subscribe to. Generalising the subscription is `07-S1`'s. A bounded poll with a manual escape is honest and is never unbounded.                                                                   |
| Q4  | Does the `format` union gain one member or one per media type?                                                      | **One: `'document'`.**                                                                    | The handler's branch is binary — a grammar the parsers know, or text a model reads — and the conversion dispatches on the filename. A member per media type would put the conversion's routing table on the queue envelope.                                                                            |
| Q5  | How does the handler learn the media type, given `TaskBindings.FILES.get` returns `{ body, size }`?                 | **`sourceName` on the payload.**                                                          | The content type is not reachable through the declared port. Widening a structural port every test fake implements is a larger change than one string. `sanitiseFilename` has already run on it.                                                                                                       |
| Q6  | Does `accept` identify a row by index, or by the plan's index-and-external-id pair?                                 | **Index alone.**                                                                          | A staged record is written once and never reordered, so the index is unambiguous and the pair would be a checksum against a change that cannot happen.                                                                                                                                                 |
| Q7  | The ticket demands the ceiling "refuse in its own words", but `RateCeilingError`'s words are the transit search's.  | **The client chooses the copy from `error.metric`; `rate.ts` is not edited.**             | The error already carries `metric`, `ceiling` and `spent`. The function maps it to a typed refusal and never forwards `message`, which also keeps the refusal inside the 23-locale catalogue — a server-side `Error.message` never is. `rate.ts` belongs to no stage in this wave.                     |
| Q8  | The frozen plan files the `AI` binding and the extraction ceiling onto a foundations stage. Are they still missing? | **No — both exist.**                                                                      | `wrangler.jsonc:129` and `:244`, `aiBinding()`, `RATE_METRICS` carrying `extraction_calls_per_month`, and `PLAN_RATE_CEILINGS` at `0 / 100 / 400`. The plan was written before they landed. This spec files nothing and blocks on nothing.                                                             |
| Q9  | Browser evidence: the plan's visual spec file, or the ticket's `e2e/journeys.spec.ts`?                              | **The ticket's.**                                                                         | ADR 0016 retired the screenshot gate and #178 says so. Behaviour is the assertion; the blind A/B pair carries the visual judgement per docs/SPEC.md §7.4.                                                                                                                                              |
| Q10 | Is this one spec, or should the extraction and the review surface be two?                                           | **One**, on docs/SPEC.md §8 grounds.                                                      | Neither half leaves the repository self-consistent alone: a producer with no review surface writes nothing a reader can reach, and a review surface with no producer has nothing to review. Splitting it is the horizontal cut the ticket explicitly refuses.                                          |
| Q11 | Which locale namespace takes the copy?                                                                              | **`modules.book.import.*`.**                                                              | The existing desk copy is `modules.book.*` in `messages/<locale>/modules.ts`. `trips.book.*` is the route's chrome, not the module's.                                                                                                                                                                  |

## 📋 Phasing

**Phase 1 — Bytes become text, and text becomes bookings.** The two extraction modules and their fixtures. Shippable and inert: nothing imports them.

**Phase 2 — The engine reads a document.** The payload widening, the handler branch, the meter spend, the upload-policy answer. Shippable and inert: nothing enqueues a `document` job, because nothing enqueues anything.

**Phase 3 — The three verbs.** The server functions and the tenant-isolation block. Shippable and inert: no UI calls them.

**Phase 4 — The reader can see it.** The drafts module, the dialog, the widget, the shell mount, the route wiring, the copy and the e2e block. The capability lands here.

Each phase leaves the validation gate green and leaves the desk behaving exactly as it does today until Phase 4's final step.

## 📋 Implementation Plan

### Phase 1 — Bytes become text, and text becomes bookings

1. **`src/server/extract/document.ts`.** `DocumentConverter`, `IMPORT_TEXT_MAX_CHARS`, `documentToText` — the three routes by extension, the bounded base64 strip, the cap, and `TaskPermanentError('empty')` on nothing readable. _Verify:_ `src/server/extract/__tests__/document.test.ts` — a PDF name routes to `toMarkdown` and a `.txt` does not; a `.eml` fixture holding a 400-character base64 run and ordinary prose keeps the prose and drops the run; text past the cap is truncated at it; a converter returning `''` throws `empty`; a converter that throws is surfaced as `unreadable`.
2. **`src/server/extract/booking.ts`.** `BookingModel`, `EXTRACTION_MODEL`, the answer's Zod schema and `textToReservations`, importing `StagedReservation` from the handler module. _Verify:_ `src/server/extract/__tests__/booking.test.ts` — a well-formed answer maps to `StagedReservation[]`; an answer missing a required field is rejected **whole** and stages nothing; an amount that does not parse into minor units leaves both money fields absent and marks the row; a row with no title survives; the stub is the only model and no test opens a socket.

### Phase 2 — The engine reads a document

3. **`src/server/queue/types.ts`** — `format` gains `'document'`, the payload gains `sourceName`. _Verify:_ `pnpm typecheck`; a schema case that an `ics` envelope still parses and that a `document` envelope without `sourceName` is rejected.
4. **`src/server/queue/handlers/booking-import.ts`** — `extractFromDocument`: `spendRateUnit` against `resolveLimits()` for the envelope's org, `RateCeilingError` → `TaskPermanentError('ceiling')`, then `documentToText` → `textToReservations`. The three-way branch in front of the parse; `StagedImport.written` added as optional; `StagedImport.format` widened. Nothing else in the file changes. _Verify:_ `src/server/queue/handlers/__tests__/booking-import.test.ts` — driven directly with a fake `FILES`, a fake `KV`, a stub converter and a stub model: a `document` job stages the extractor's rows; the meter is spent **before** the binding is reached; a spent ceiling raises `ceiling` and never calls the model; an `ics` job spends **nothing**; redelivery of a staged job is a no-op; a record staged without `written` still parses.
5. **`src/server/fns/file-policy.ts`** — `IMPORT_ACCEPT_ATTRIBUTE`, `MAX_IMPORT_FILES`, `ImportFormat`, `importFormatFor`, and the two entries (`text/html`, `message/rfc822`) in `ACCEPTED`, `ACCEPT_ATTRIBUTE` and `BY_EXTENSION`. _Verify:_ cases appended to the file-policy tests — `.ics` → `ics`, `.json` → `json`, `.pdf`/`.eml`/`.html`/`.jpg`/`.docx` → `document`, `.pkpass`/`.zip`/`.mp4` → `null`; the existing `checkUpload` cases are unchanged; every extension in `IMPORT_ACCEPT_ATTRIBUTE` resolves to a non-null format.

### Phase 3 — The three verbs

6. **`src/server/fns/booking-import.ts` — `startBookingImportFn`.** `appScope` → `requireTrip` → `getFile` → `importFormatFor` on the stored filename → `enqueueTask(taskQueue(), …)` with the deterministic id and the staggered `delaySeconds`. _Verify:_ `pnpm typecheck`, `pnpm lint`, and function cases: the envelope id is `booking-import:<tripId>:<fileId>` and is ≤ 128 characters; a file whose format is `null` is refused and **nothing is enqueued**; the format comes from the stored filename and a client-supplied one is not read.
7. **`getBookingImportFn`.** The KV read, the Zod parse of the staged shape, the `orgId`/`tripId` re-check, and the typed refusal codes. _Verify:_ cases — a staged record of another org is refused though the key resolves; a record of this org but another trip is refused; a missing key answers `working`; a refusal code is returned and no `Error.message` is forwarded.
8. **`confirmBookingImportFn`.** The per-row write chain, the single `markReservationsImported`, the `written` write-back, the delete only on full success, and the one room patch. _Verify:_ cases — 7 accepted rows write 7 reservations and one marker statement; a failure at row 4 leaves the staged entry present with 3 in `written` and the retry writes only the remaining 4; a full confirm deletes the key; a geocoding failure leaves a place with no coordinates and the import still succeeds; a lodging whose place name already exists on the trip creates no second place; a row whose price was dropped writes `price_minor` null.
9. **The tenant-isolation block**, one `describe` appended to `src/server/repos/__tests__/tenant-isolation.test.ts`, covering `createReservation` and `getFile` only — `markReservationsImported` is covered by `03-S4`'s block where it is defined and is not duplicated. The four cases from the ticket, including the queue double that records sends, so "did not write" is distinguished from "did not enqueue", and B's reservation count and `imported_at` values re-read and identical after every attempt. _Verify:_ `pnpm exec vitest run src/server/repos/__tests__/tenant-isolation.test.ts`.

### Phase 4 — The reader can see it

10. **`src/components/modules/book/import-drafts.ts`.** The staged-row-to-draft mapping, the kind mapping (`lodging → accommodation`, `flight`/`transport` → `transport`, `activity` → `activity`, everything else → `other`), the floating-time resolution through `src/lib/time.ts`, and the selection reducer. _Verify:_ `__tests__/import-drafts.test.ts` — the kind mapping is **total** over `RESERVATION_KINDS` and lands only in `RESERVATION_TYPES`; a floating time resolves against the trip's zone and not the runtime's; deselecting a row removes it from the accepted set and from the count and from nothing else; a staged row with no title falls back without throwing; a row with no price is marked and carries no zero.
11. **The forty-one locale keys**, `en` first and then all 23, per the `i18n-messages` skill. _Verify:_ the i18n parity test in `pnpm test`.
12. **`src/components/modules/book/import-dialog.tsx`.** The drop target (button-wrapped hidden input), the boundary refusals by name, `uploadFile` for each of up to five files, the review list with select-all/none and the live count, and the five states. _Verify:_ `pnpm typecheck`, `pnpm lint`; a rendering test asserting the refusal names the file and lists the formats, the confirm is disabled with a reason while nothing is selected, and the drop target is operable by keyboard.
13. **`src/components/modules/book/import-widget.tsx`.** The `localStorage` register under `planned.book-imports`, the bounded poll, the three widget states, and the `aria-live` region. _Verify:_ a rendering test with a fake clock and a stubbed `getBookingImportFn` — the poll stops at 20 s and offers **Check again**; the failed state does not self-dismiss; the done state does; a job id in storage is picked up on mount. _Since #806:_ the register, the poll and the stall budget live in `import-jobs.ts`, one store per account and workspace that the widget and the dialog both read; the widget renders it.
14. **`src/routes/_app/route.tsx`** mounts `<BookImportWidget />` beside `<ImpersonationBar />`. _Verify:_ `pnpm typecheck`, `pnpm build`, and the e2e block in step 16.
15. **`src/routes/_app/trips/$tripId/book.tsx`** mounts the Import action beside `NewBookingAction` and the dialog beside it; **`index.ts`** gains the new exports. _Verify:_ `pnpm typecheck`, `pnpm lint`, `pnpm test`.
16. **The e2e block**, appended to `e2e/journeys.spec.ts`: open `/trips/<demo>/book`, open the dialog, drop a small fixture calendar through the real upload path, wait for the review list, deselect one row, confirm, assert the desk shows the remaining rows with the unchecked-import marker; then assert the refusal state for an unaccepted format and the ceiling message with the rate read stubbed; and assert a silent console throughout. _Verify:_ `bash .ai/scripts/e2e.sh e2e/journeys.spec.ts`.
17. **The blind A/B pair** on the five declared states, per docs/SPEC.md §7.4 and the `verifying-changes` skill. _Verify:_ `scripts/visual/capture.mjs` at 360, 1280 and 2560 in both themes, the critic's verdict attached to the PR.
18. **The full gate**, in order: `pnpm typecheck`, `pnpm lint`, `pnpm test`, `bash .ai/scripts/check-generated.sh`, `pnpm build`, `bash .ai/scripts/e2e.sh`. _Verify:_ every command green, nothing skipped or waived.

## 📝 Out of scope

A second parsing engine. A MIME parser. `.pkpass`. Any schema change — this spec declares no column. A per-tenant model credential or any operator construct ADR 0012's `11-S1` refused. Generalising the trip-room subscription (`07-S1`). Repairing `RateCeilingError`'s transit-only wording, which is reported above and belongs to no stage in this wave.

Four modules are used and never edited: the queue consumer, the queue job helpers, the auth environment and the function context. The engine is complete and so is the producer helper; this spec attaches to both, importing `appScope` from the context module exactly as every other function module does, and taking the queue binding through `taskQueue()` rather than a new sibling of `filesBucket()`.

## 📝 Amendment

Built by **#435**. The design above is left as it was written; everything below is where the build
disagreed with it and why. Each entry names what the tree forced.

### The engine and the extraction (Phases 1–3)

1. **A refused document job stages its refusal instead of only throwing.** `stageRefusal`
   (`src/server/queue/handlers/booking-import.ts:463`) writes a staged record carrying the refusal
   code before the `TaskPermanentError` leaves the handler. The spec had the ceiling and the
   unreadable file raise and stop, which leaves the widget polling a key that will never appear
   until its 20-second budget runs out — a reader is told "this is taking longer than expected"
   about a file the product already decided it cannot read. It runs only for
   `payload.format === 'document'`; the `ics` and `json` paths are untouched.
2. **The `AI` binding reaches the handler through `TaskBindings.AI?`, not an import.** The handler is
   driven directly in its tests, and every one of them constructs the bindings object; an optional
   field on that port keeps the handler drivable with a stub, where a module-level `aiBinding()` call
   would drag `cloudflare:workers` into the `server` Vitest project.
3. **`MAX_IMPORT_BYTES` lives in `src/server/fns/file-policy.ts:305`,** with the handler re-exporting
   it (`:124`) for the callers that had it from there. The size limit belongs beside the upload
   policy that also has to refuse on it, not in the consumer that reads the object afterwards.
4. **`importFormatFor` is keyed by extension, not by media type.** The stored filename is what the
   payload carries (Q5), so the format decision is made from the same string rather than from a
   content type the declared `FILES` port does not return.
5. **The ceiling read is an injected seam.** `BookingImportSeams.ceilingFor`
   (`booking-import.ts:273`) hands the handler its ceiling; the default implementation is the
   `resolveLimits()` read the spec described. A test can then exercise "spent" and "not part of the
   plan" without a billing fixture.
6. **`src/server/fns/context.ts` gained `importStore()`** (`:45`), which the "not owned" list said it
   would not. Every other binding a function module reaches is taken from that file; a second
   accessor somewhere else would have been the only exception in the directory.
7. **The staged-row-to-draft mapping is server-owned.** `BookingImportDraft`
   (`src/server/fns/booking-import.ts:160`) is built by `bookingImportView`, and
   `import-drafts.ts` keeps only the selection reducer and the presentation. The mapping needs the
   trip's zone and the staged record, both of which the function already holds; shipping it to the
   client would have sent the staged shape over the wire so the client could reduce it.
8. **`startBookingImportFn` takes an `index` input** (`:98`), because the stagger
   (`delaySeconds = index × EXTRACTION_BUDGET_SECONDS`, `:472`) is computed per call and the caller
   is the only party that knows which of the five files this is.
9. **`EXTRACTION_BUDGET_SECONDS = 20`** (`:87`) is one exported constant rather than the literal the
   spec wrote twice — the stagger and the poll budget are the same number by design, and Q3 is only
   honest while they stay equal.

### The reader's surface (Phase 4)

10. **48 locale keys, not forty-one, and three of them are plural objects.** `widget.done`,
    `review.confirm` and `toast.added` all count bookings, so they are `{ one, other }` selected off
    `params.count`; the rest of the overage is the partial-write and upload-failure copy the spec
    described in prose without listing keys for. All 48 landed in `en` and in the other 22 locales
    in the same change.
11. **The drop target's `<input type="file">` is a sibling of the button, not a child.** A hidden
    input inside a `<button>` is a nested interactive control; the input sits beside it and the
    button drives it through a ref, which keeps the target operable by keyboard without a nested
    control.
12. **`?import=<jobId>` is the widget-to-dialog hand-off** (`src/routes/_app/trips/$tripId/book.tsx`).
    The widget's **Review** is pressed from any screen, so it navigates to the desk with the job in
    the search params and the desk opens the review list from there. The spec left the hand-off
    unstated, and shared module state would not have survived the navigation it exists for.
13. **The widget is mounted last in the `_app` subtree** (`src/routes/_app/route.tsx:122`), after
    `<Outlet />` and the mobile nav, rather than literally beside `<ImpersonationBar />`. Same
    component tree, same survival across navigation — but a fixed, `z-dropdown` overlay declared
    before the content it floats over is a stacking accident waiting for its first sibling.
14. **`confirmBookingImport` takes a `ConfirmBookingImportPorts` argument** (`:208`). Reaching the
    geocoding proxy and the repositories from inside the function body pulled them into the client
    bundle through the server-function module graph; passing them in at the `createServerFn` handler
    keeps the boundary where the build expects it.
15. **The widget clears the feedback actor rather than sitting beside it.**
    `bottom-[calc(var(--safe-bottom)+8.5rem)] lg:bottom-[4.5rem]` on the terms `#sentry-feedback`
    sets for itself in `src/styles/styles.css`. The first build used `lg:bottom-6`, and the blind A/B
    pair caught the "Report a problem" actor covering the **Review** button outright at every desktop
    width — the failure mode `src/routes/__root.tsx` already writes down. Fixed in `2900ff9e` and
    re-checked with `document.elementFromPoint` at the button's centre at 360 and 1280.
16. **`src/server/geo/__tests__/seam.test.ts` was rewritten,** as its own comment said it would have
    to be: the proxy had no caller outside its directory, and this build gave it one. The case now
    names `server/fns/booking-import.ts` and counts shipped modules only.
17. **The e2e ceiling journey produces the refusal from a refused job, not from a real ceiling.** The
    allowance is charged only inside `extractFromDocument`, so an `.ics` import — the only import a
    browser can drive locally — is not ceiling-gated at all. The journey asserts the refusal copy
    reaches the reader; the two ceiling sentences (ceiling 200 and ceiling 0) are graded in the unit
    layer, which is where the branch actually lives.
18. **Three of the five visual states were captured by a throwaway driver.**
    `scripts/visual/capture.mjs` takes one `--click`, and the review list, the boundary refusal and
    the widget's working state each need a file put through a real `<input type="file">` and a wait
    on a queue. A gitignored scratch driver reproduced the script's discipline (`emulateMedia`, the
    motion-suppressing style tag, the same `fullPage` shutter options) rather than the shared tooling
    growing a mode for one spec.
19. **The e2e flows use `.ics`, not a PDF.** The calendar path is a parser
    (`src/server/queue/ics.ts`); a document goes to Workers AI, which has no local simulator and
    proxies to the real service. A browser journey that reads a PDF would be a journey against
    production inference.

## Amendment - atomic import markers (#929)

The implementation PR for #929 supersedes the post-insert marker design above (including
its original one-statement batch and the later chunked variant from #924). Each accepted row
is now created through `createImportedReservation(scope, input, importedAt)`: the marker is
part of the reservation INSERT, with one server-chosen instant shared by all rows of a confirm.
Both creation paths use one helper for input parsing, tenant trip resolution, role and reference
checks, then the tenant-scoped insert. Public create/update payloads are unchanged and cannot
set or clear the marker. There is no `stamp` step or marker-error swallowing in confirm.

The existing marker writer and clearing remain available and unchanged. Staging, the 500-row
ceiling, retry rules and the confirm result shape are unchanged: a retry creates only pending
rows and never re-marks rows already recorded as written. Regression coverage exercises
7 and 101 rows, checks one shared instant and no separate marker
UPDATE, and re-reads successful rows unchanged after a partial confirm and retry. Repository
coverage refuses unmarked INSERTs and includes foreign tenants, viewer refusal and references
from another trip.

The frozen reservations plan retains its historical post-insert marker description.
