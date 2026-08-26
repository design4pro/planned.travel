# Documents and media

## Area brief

This area is everything a trip accumulates that is not a row someone typed: the boarding pass, the
hotel voucher, the museum ticket, the export a traveller hands to somebody who does not have an
account, the calendar their phone keeps in step with the plan, and the weather the day is going to
have. Eight rows of `.claude/ultrabuild/recon/gap-rows.json` live here, and one of them does not
port to a hosted product at all.

### What is on disk today

The file half is real and running, which is why six of the eight rows are `partial` rather than
`absent`. The parts a plan must extend rather than re-invent:

| Thing               | Where                                                                                       | What it already does                                                                                                                                                |
| ------------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The upload policy   | `src/server/fns/file-policy.ts`                                                             | One pure module: a 25 MB per-object ceiling, 12 objects per request, a media-type allow-list, an extension fallback, filename sanitising and the storage-key shape. |
| The write path      | `src/server/fns/files.ts:114-215`                                                           | A `FormData` server function that streams into the `FILES` R2 bucket, records the row, and deletes the object again if the row is refused.                          |
| The read path       | `src/server/fns/files.ts:273-310`                                                           | A `GET` server function returning a raw `Response` streamed from R2 with `content-disposition: attachment` and `cache-control: private, no-store`.                  |
| The repository      | `src/server/repos/files.ts` (201 lines)                                                     | Tenant-scoped reads, `recordFile`, `updateFile`, `deleteFile`, per-trip and per-workspace byte sums.                                                                |
| The screen          | `src/routes/_app/trips/$tripId/files.tsx` + `src/components/modules/files/**` (1 776 lines) | A drop target, a sequential `XMLHttpRequest` upload queue with real progress, kind filter chips with counts, a details dialog and a storage meter.                  |
| The export renderer | `src/server/queue/handlers/pdf-export.ts`                                                   | Print-styled self-contained HTML into `FILES`, plus a real PDF through the browser-rendering REST interface when the secrets are configured, plus a KV pointer.     |
| The calendar reader | `src/server/queue/ics.ts` (181 lines)                                                       | An iCalendar **parser** for booking imports. There is no writer.                                                                                                    |

And the parts that are absent outright: no starred column, no trash, no lightbox, no link table, no
producer for the export handler, no feed endpoint, no weather anything.

### Where this plan disagrees with the matrix, and on what evidence

`README.md` requires a plan that contradicts a row to say so and give its own evidence. Two:

1. **`DOC-02` says "no count badges". They exist.** `file-library.tsx:571-597` renders a `KindChip`
   per kind with a `count` prop, inside `FilterRow` from `src/components/modules/shared`, plus an
   "Everything" chip carrying the total. What `DOC-02` is actually missing is the two _conditional_
   tabs, the starred-first sort, the inline document preview and the image lightbox. `06-S4` closes
   those and does not rebuild the chips.
2. **`DOC-01` says clipboard paste "is not wired" and reads as the smaller half of the row.** It is,
   but the row's larger half is a decision nobody has taken: our per-object ceiling is 25 MB
   (`file-policy.ts:13`), the reference's is twice that, and doubling it is a storage-cost decision
   rather than a constant. `06-S1` takes it explicitly rather than quietly matching the reference.

### The eight rows

| Row      | Stage        | Wave | Moves                                                                      |
| -------- | ------------ | ---- | -------------------------------------------------------------------------- |
| `DOC-01` | `06-S1`      | 1    | partial → done                                                             |
| `DOC-03` | `06-S2`      | 2    | absent → done                                                              |
| `DOC-06` | `06-S3`      | 2    | partial → done for the trip plan; the journey book stays open and unowned  |
| `DOC-02` | `06-S4`      | 3    | partial → done                                                             |
| `DOC-07` | `06-S5`      | 3    | absent → done                                                              |
| `DOC-04` | `06-S6`      | 4    | partial → done, both entry points: the file side and the booking side      |
| `DOC-08` | `06-S7`      | 6    | absent → absent. **BLOCKED** on a provider decision that is not ours here. |
| `DOC-05` | **no stage** | —    | out-of-scope; see below                                                    |

**`DOC-05` is excluded from this plan and is planned nowhere in it.** It is the connection to a
photo library running on the operator's own private network, and it is one of the ten hosted-model
exclusions argued in `docs/plans/11-boundaries-and-blockers.md` (`11-S1`, under its own `DOC-05`
heading): the capability needs an instance-level allowance to reach a private network and an escape
hatch that skips certificate verification, neither of which a multi-tenant Worker can offer to one
customer without offering it to all of them. Its named hosted equivalent is a first-party picker
over the `FILES` bucket, which is `DOC-01` here plus `ADD-08` in `08-product-modules.md`. No stage
below claims it, no stage below plans around it, and it appears in this file exactly once — here.

### Storage is the bill, so retention is stated and never assumed

`docs/ARCHITECTURE.md` §8 measures it: at 10 000 users, R2 (\$23.85) and D1 storage (\$11.25) are
**76% of the whole platform bill**, and the model's named levers are "the file retention policy,
thumbnail sizes, and whether the basemap needs to be the whole planet". Compute is noise below about
a thousand users; bytes are not.

So every stage in this file that causes a byte to be stored states, under **Data and migration**,
three things: what is written, how long it is kept, and who deletes it. A stage that adds stored
bytes and says nothing about their retention is incomplete even if the feature works, and the three
stages that add bytes — `06-S1` (uploads), `06-S3` (export artifacts) and, in the negative,
`06-S4` (thumbnails, which it deliberately does not create) — each answer it in their own words.

One measured fact the whole file inherits: **nothing sweeps R2 when a trip is deleted.**
`listTripStorageKeys` (`src/server/repos/files.ts:195-201`) exists, its docblock says it is "used
when a trip is deleted to sweep R2", and `grep -rn listTripStorageKeys src/` returns only its own
definition and its test. `deleteTrip` (`src/server/repos/trips.ts:386`) cascades the D1 rows and
leaves every object behind. That is a foundations-shaped repair on a path `01-S1`
(`01-trips-core.md`, wave 1) owns; no stage here claims it, and each stage that stores bytes names
it as the standing leak it is.

### The R2 write ordering, stated once and restated where it is used

The product already has one ordering for a byte-and-row pair, it is deliberate, and it is written
down in two places on disk:

1. **Write the object into R2 first** — `src/server/fns/files.ts:158-173`, `bucket.put(storageKey, …)`.
2. **Then assert the quota and insert the row** — `recordFile` (`src/server/repos/files.ts:165-174`)
   re-reads live usage and calls `assertQuota(scope, 'files', usage.fileCount)` and
   `assertQuota(scope, 'storage_bytes', usage.bytes, values.sizeBytes)` **before**
   `tripFilesRepository.insert`.
3. **If the assertion throws, delete the object again** — `src/server/fns/files.ts:198-213`, the
   `catch` that calls `bucket.delete(storageKey)` and answers with the refusal.

The reason is in the module docblock and is not re-litigated by any stage: "a dangling object is a
sweep job, a dangling row is a broken download". `06-S1` and `06-S2` are the two stages that touch
this ordering, and both restate it in full under their own headings, because a stage that assumes it
from the brief is a stage that can get it backwards.

### The copy language, and the reference

All user-visible copy in this file is English (`en-GB`), sentence case, formatted through
`src/lib/format.ts` — the same rule `09-S5` states for every stage in the product until the locale
row is unblocked. Behaviours are sourced from `wiki: Documents-and-Files`, `wiki: PDF-Export`,
`wiki: Calendar-Feeds` and `wiki: Weather-Forecasts`, read to learn what a feature does and restated
here in our own vocabulary against the tables that already exist in `src/server/db/schema.ts`.

---

## Stage 06-S1 — Every way a file gets in, and what it costs to keep it

### Stage id

`06-S1` · Wave 1 · effort **M**. First in this file because five of the other six rows read or write
the row it completes, and because `DOC-01` has the highest direct in-degree in the whole matrix —
six rows name it in their own `dependsOn` (`README.md`, "What leads, and on what measurement").

### Reference rows

- `DOC-01` partial → **done**. The three ways in (drop, pick, paste), the per-object ceiling, the
  accepted-format list including the wallet pass, the download that preserves the filename and the
  media type, and the browser-side pre-flight that refuses a file before a byte leaves the machine.

Behaviours sourced from `wiki: Documents-and-Files`, restated in our own vocabulary. Two of its
rules are taken as stated because they are security rules rather than product ones: markup and
script carriers must be refused **server-side** and not merely filtered out of the picker, and the
wallet pass must be served under its own media type or the receiving operating system silently
degrades it to a generic download.

**Six rows name `DOC-01` in their own `dependsOn`, and they are all six of them** — counted over
`gap-rows.json` rather than recalled, so a reader knows exactly what slips if this slips: `DOC-02`,
`DOC-03` and `DOC-04` in this file, `BKG-03` (`03-reservations-and-transport.md`, the confirmation
file a booking is imported from), `COL-07` (`07-collaboration-and-sharing.md`) and `ADD-08`
(`08-product-modules.md`, journal photos). A seventh surface depends on this write path without being
an edge in the matrix and is named separately for that reason: the trip cover image in `01-S8`
(`01-trips-core.md`) uploads through this same server function and reuses the same R2 ordering, which
that stage states from its own side rather than re-deriving.

### Owned paths

- `src/server/fns/file-policy.ts` — edit. The ceiling, the accepted-format table, the refusal list
  and the paste-name helper.
- `src/server/fns/files.ts` — edit. The upload handler's kind resolution and the download handler's
  media-type and disposition rules.
- `src/components/modules/files/screening.ts` — edit. The pre-flight gains the refusal reasons the
  policy adds.
- `src/components/modules/files/upload.ts` — edit. Carries a caller-supplied filename for a pasted
  blob.
- `src/components/modules/files/file-library.tsx` — edit. The paste target, the drop-state design and
  the refusal list.
- `src/components/modules/files/__tests__/upload-policy.test.ts` — edit.
- `src/components/modules/files/__tests__/paste.test.ts` — new.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. One new `describe` block that
  edits none of the existing ones.
- `e2e/documents-and-media.visual.spec.ts` — new. This plan's spec file, per
  `12-verification-protocol.md` §4.
- `e2e/__screenshots__/documents-and-media.visual.spec.ts/` — new. Its baseline directory.

**One path is owned by another plan in an earlier wave and is named here with its sibling stage id**
so this file's cross-plan check resolves rather than merely passes. `src/server/fns/files.ts` is held
by **`00-S3`** (`00-foundations.md`, wave 0), which makes upload and deletion write an audit-trail
row. Wave 0 closes before wave 1 opens, so this is not a same-wave claim, and this stage starts from
that landed edit rather than from HEAD.

**Not owned by this stage, and listed to be excluded:** the schema module and `drizzle/`,
`src/styles/tokens.css`, `src/components/ui/**`, `src/server/worker.ts`, `wrangler.jsonc`,
`src/routeTree.gen.ts`, `package.json` and `pnpm-lock.yaml`. None of the six shared paths is claimed
by any stage in this file, and no route file is added by this stage, so `pnpm generate-routes` does
not run here.

### Data and migration

**No schema change, and no migration.** `trip_files` (`src/server/db/schema.ts:987-1026`) already
carries `content_type`, `size_bytes`, `kind` with its `trip_files_kind_chk` enum check, `description`,
`uploaded_by` and the unique `storage_key`. The wallet pass is a media type and a kind, not a column.

**Retention policy for the bytes this stage stores, stated because this is the stage that stores
them.** An uploaded object lives in `FILES` under
`trips/<organizationId>/<tripId>/<fileId>-<filename>` (`file-policy.ts:187-201`) and is deleted in
exactly one place today: `deleteTripFileFn` (`src/server/fns/files.ts:243-266`), which removes the
row and then the object. There is **no time-based expiry and this stage does not add one**: a
traveller's boarding pass is theirs until they remove it, and a product that silently deleted a
document after ninety days would be worse than one that charges for the storage. What bounds the
cost instead is the plan ceiling, enforced live rather than from a counter — `storage_bytes` and
`files` in `resolveLimits()`, asserted on every write (see **Quota**).

Three consequences of that choice, all stated rather than left to be discovered:

- **The per-object ceiling is a cost decision and is taken here: it stays at 25 MB.** `wiki:
Documents-and-Files` records 50 MB, and matching it would double the worst case of every plan's
  storage ceiling without moving any of the published numbers. `ARCHITECTURE.md` §8 assumes 150 MB
  of files per active user per month; six 25 MB objects already exceed that, and the free plan's 50
  files at 25 MB is 1.25 GB against a `storage_bytes` ceiling the catalogue sells. The constant
  stays, its docblock gains the reason, and a change to it is a pricing change rather than an edit.
- **Deleting a trip still orphans its objects** — the standing leak named in the area brief. This
  stage does not repair it (the delete path is `01-S1`'s) and does not pretend otherwise.
- **The `FILES` bucket is not publicly readable, and that is load-bearing for the format rules
  below.** `wrangler.jsonc:48` declares `FILES_PUBLIC_BASE`, and `grep -rn FILES_PUBLIC_BASE src/`
  returns exactly one line — its own type declaration at `src/server/queue/types.ts:273`. No code
  reads it. Every byte therefore leaves through the authenticated download server function, and a
  stage that later publishes the bucket must revisit the SVG rule below before it does.

### Server (repo, server function, Zod)

**Repository — `src/server/repos/files.ts`, unchanged and named because this stage writes rows through
it.** `recordFile`, `updateFile`, `deleteFile` and the two byte sums are already what this stage
needs, and the ordering they participate in is stated below unchanged. Its tenant scoping is the
product's standard one and is restated so this stage's writes are not read as an exception:
`tripFilesRepository` is built by `createTenantRepository(tripFiles, 'file')` (`files.ts:25`), which
**stamps `organization_id` on every insert and omits it from the caller's payload type**, so a row
cannot be written into another tenant; every read is built on `tenantFilter()` from
`src/server/repos/base.ts`, which starts from `eq(tripFiles.organizationId, scope.ctx.organizationId)`
and only ever `AND`s further predicates onto it. The isolation case that holds this is under **Tenant
isolation test** below.

**`src/server/fns/file-policy.ts` — edit.** Four changes, all inside the pure module so the same
rules run in the picker, in the browser pre-flight and in the handler that trusts neither:

1. **The wallet pass is accepted.** `application/vnd.apple.pkpass` joins the accepted map as kind
   `ticket`, `pkpass` joins the extension fallback table, and `.pkpass` joins `ACCEPT_ATTRIBUTE`.
   Wallet passes arrive from airlines with `application/octet-stream` more often than not, so the
   extension fallback is the path that will actually fire, and a test asserts exactly that.
2. **A refusal list is added and it is checked before the allow-list.** `.html`, `.htm`, `.xhtml`,
   `.xml` and `.svgz` are refused by extension whatever media type is claimed, with the new
   `UploadRejectionCode` value `blocked-type` and a message that says why in one sentence. The
   allow-list is unchanged in spirit — this is an explicit refusal in front of it, so a future
   widening of the allow-list cannot re-admit a markup carrier by accident.
3. **`.svg` stays accepted, and the argument is written down rather than assumed.** It is a
   legitimate map and diagram format, it is already in the allow-list, and removing it would delete a
   capability from a bucket that may already hold one. The stored-cross-site-scripting vector it
   carries needs a **same-origin navigation** to attacker-controlled markup, and this product has
   none: the bucket is not publicly served (above), the download response sets
   `content-disposition: attachment` and `cache-control: private, no-store`
   (`src/server/fns/files.ts:300-306`), and `06-S4`'s preview renders an image only through an
   `<img>` element, in which scripts are inert, and refuses "open in a new tab" for
   `image/svg+xml`. Those three together are the mitigation; any one of them going away brings the
   decision back.
4. **`safePastedFilename(mediaType, now)`** — the name a pasted blob gets, because the clipboard
   supplies bytes and a media type and no name at all. `pasted-YYYYMMDD-HHmmss.<ext>`, derived from
   the accepted-format table so a pasted PNG cannot land as `.bin`, and passed through the existing
   `sanitiseFilename` rather than beside it.

**`src/server/fns/files.ts` — edit.** Two handlers, no new endpoint.

- `uploadTripFileFn` keeps its shape exactly — including the ordering, restated here in full because
  this stage edits the function that owns it: **the object goes into R2 first**
  (`bucket.put` at `:158`), **then the quota is asserted and the row inserted**
  (`recordFile` → `assertQuota(scope, 'files', …)` and
  `assertQuota(scope, 'storage_bytes', …, sizeBytes)` at `src/server/repos/files.ts:170-171`, both
  before the insert), **and if the assertion throws the object just written is deleted again**
  (`bucket.delete(storageKey)` in the `catch` at `:202`). A dangling object is a sweep job; a
  dangling row is a broken download. This stage adds the wallet-pass kind resolution inside that
  sequence and moves none of its three steps.
- `downloadTripFileFn` keeps `content-disposition: attachment` for everything and gains one
  behaviour: the stored `content_type` is echoed verbatim, so a `.pkpass` leaves as
  `application/vnd.apple.pkpass` and the receiving operating system offers to add it to the wallet
  instead of dropping a generic file into a downloads folder. Getting that header wrong is invisible
  in a test that only asserts a 200, so the test asserts the header.

**Zod (v4 idiom).** The scalar bag at `src/server/fns/files.ts:77-81` gains no field; the pasted name
is produced in the browser and re-sanitised on the server, so nothing new crosses the boundary
untyped. Where a schema is touched it uses the v4 forms — `z.strictObject()`, the `error` parameter,
top-level formats — and never `z.string().email()`. Validation is shape; it decides nothing about
permission.

**Authorisation** is unchanged and is decided in the handler: `appScope()` then
`requireTrip(scope, tripId)` before anything is read or written. A trip id from the browser is a
claim, not an authorisation. Nothing here is slow enough to enqueue, and nothing new goes to `TASKS`.

### UI (route, components)

**Route.** None added, none edited. `/trips/$tripId/files` already exists and already loads through
`loadTripFiles` (`src/routes/_app/-server/trip.ts:654-685`). No route file changes, so
`pnpm generate-routes` does not run and `src/routeTree.gen.ts` is untouched.

**Components — existing primitives only, no new primitive.** `Alert`, `Badge`, `Button`,
`EmptyState`, `IconButton`, `Progress`, `Table`, `toast` from `src/components/ui`, and
`ModulePanel`, `FilterRow`, `RowMenu`, `ConfirmDialog`, `useAction` from
`src/components/modules/shared`. Nothing is filed to `00-foundations.md`: none of the 42 shipped
primitives is missing for this stage.

**The paste path**, which is the visible half of the row:

- A `paste` listener on the library panel, attached to the panel element rather than to `document`,
  so pasting into the details dialog's description field does not upload a file. It reads
  `event.clipboardData.files` first and falls back to the `items` list for the platforms that only
  populate that, names each blob with `safePastedFilename`, and pushes it through the identical
  `screenFiles` → upload queue path a drop uses. One code path, three entry points.
- The panel is focusable (`tabIndex={0}`) with an accessible name, because a paste target that
  cannot be reached by keyboard is a mouse feature wearing a keyboard event, and a visible
  `focus-visible` ring on `--color-brand` in both themes.
- A one-line hint under the drop copy names all three ways in, including the paste shortcut rendered
  with the `Kbd` primitive.

**States, named rather than gestured at.**

- _Empty_ — the existing `EmptyState` (`file-library.tsx:556-565`, dashed, brand tone, `Paperclip`)
  keeps its copy and gains the paste hint in its description. It sits on `--color-surface-2`.
- _Skeleton_ — `RowsSkeleton` behind `FilesPending` (`files.tsx:118-130`) already reserves the table's
  room on `--color-surface-2`; the row height is unchanged by this stage, so nothing reflows when the
  payload lands.
- _Error_ — a refusal is per file and already renders on its own row with the reason. This stage adds
  the `blocked-type` message to that set and keeps the existing rule that the rest of the batch is
  unaffected, which is stated on the screen in one sentence.
- _Loading_ — unchanged and already right: sequential uploads, per-file progress from the real
  request body, the primary action `disabled` while the queue drains, and an `aria-live` polite
  region announcing each settle.

**Drop state.** The drag-over state is a 150–260ms transition on `--ease-out-quint`, opacity and
transform only, over a `--color-brand-subtle` fill and a `--color-brand` hairline; it collapses to an
opacity change under `prefers-reduced-motion: reduce`. Dark re-declares its own surface and shadow
step rather than reusing the light one.

**Tokens.** None missing. Colour, spacing, radius, shadow, easing and z-index all resolve from
`src/styles/tokens.css`; spacing is on the 4px grid from `--space-*`; every byte count and progress
percentage carries `font-variant-numeric: tabular-nums`.

### Quota

**The metrics are `files` and `storage_bytes`, and both are already enforced on this write path.**
`recordFile` (`src/server/repos/files.ts:165-174`) is the call site, inside the repository, before
the insert:

- `assertQuota(scope, 'files', usage.fileCount)` — `files` is a `TierMetric` in `PLAN_QUOTAS`
  (`src/server/db/types.ts:41-70`: free 50, starter 500, pro 5 000, business unlimited).
- `assertQuota(scope, 'storage_bytes', usage.bytes, values.sizeBytes)` — `storage_bytes` is one of
  the three `CATALOGUE_METRICS` (`types.ts:28`), so its ceiling comes from the published plan through
  `resolveLimits()` and never from a constant.

Both counts come from live `COUNT(*)`/`SUM(...)` in `getStorageUsage`, never from `usage_records`, so
a counter that drifted cannot let a tenant past its ceiling. **No metric is added**, nothing changes
in `resolveLimits()` or `PLAN_QUOTAS`, and therefore no case is added to
`src/server/billing/__tests__/limits.test.ts`.

For the R2 half, the order is the one restated above: object first, assert second, compensating
delete on throw.

### Tenant isolation test

Appended to `src/server/repos/__tests__/tenant-isolation.test.ts` as one new `describe` block that
edits no existing block. `recordFile` and `getStorageUsage` already have cases there
(`tenant-isolation.test.ts` imports both); this stage adds the ones its changes make reachable.

In organization A's scope, against organization B's rows: read B's file by id, update B's file by id,
delete B's file by id, and record a file **onto B's trip** with a well-formed B trip id. Every one is
a `NotFoundError` — `recordFile` calls `requireTrip` before it asserts anything — and B's rows are
byte-identical afterwards. Then the mirror: A's own new row read back in B's scope by id is a
`NotFoundError`. And one assertion that belongs to this stage specifically: A's `getStorageUsage`
does not move when B uploads, so a neighbour cannot consume A's plan.

Functions covered: `recordFile`, `updateFile`, `deleteFile`, `getFile`, `listTripFiles`,
`getStorageUsage`, `getTripStorageBytes`.

### Verification

**Command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests, by file and invariant.**

- `src/components/modules/files/__tests__/upload-policy.test.ts` (edit) — a `.pkpass` with an empty
  media type resolves to `application/vnd.apple.pkpass` and kind `ticket`; `.html`, `.htm`, `.xhtml`,
  `.xml` and `.svgz` are refused with `blocked-type` **even when the claimed media type is
  `application/pdf`**, which is the case the allow-list alone would pass; the 25 MB ceiling refuses
  25 MB + 1 byte and admits exactly 25 MB; the batch budget still refuses the tenth 5 MB file when
  the ninth has already consumed the allowance.
- `src/components/modules/files/__tests__/paste.test.ts` (new) — `safePastedFilename` produces a
  stable, sortable, sanitised name for each accepted image type; a clipboard payload with `files`
  and one with only `items` produce the same upload input; a paste of plain text produces no upload
  at all.
- The download header assertion lives with the policy tests rather than needing a Worker: the
  handler's header construction is exercised through the pure helpers it uses, and the media type is
  asserted to be echoed rather than re-derived.

**Browser evidence.** Spec file `e2e/documents-and-media.visual.spec.ts`, `describe` block named
`06-S1 — file upload`. It imports `visit`, `settle`, `shoot`, `applyTheme`, `THEMES`, `useSession`
and `watchConsole` from `./helpers/shoot.ts` and re-implements none of them, and it calls
`auditServerClock(page, <this spec's own route table>)` once in a `describe` of its own, because a
route declared in a module spec is in nobody else's `APP_ROUTES` (`12-verification-protocol.md` §4).

- Route: `/trips/$tripId/files` on the seeded demo trip.
- Frame set: light and dark at **360px, 1280px and 2560px** — six frames at rest.
- **Declared non-resting state**, because the point of this stage is a state the screen is not in
  when it loads: the drop target in its drag-over state, named `--state drop-active`, six more
  frames. It is reached by dispatching a `dragenter` with a `DataTransfer` at
  `[data-part="file-drop"]` — a stable attribute this stage ships, not a class name — and **the
  selector is verified against a running server with `page.locator(sel).count()` returning 1 before
  any frame is filed.** Reading the JSX and believing it is not a verification.
- A second declared state, `--state upload-refused`, showing the per-file refusal rows: reached by
  attaching a blocked-type file through the hidden input, which is a real refusal from the real
  policy and needs no route interception.
- The capture invocation is quoted in full in the evidence, including
  `PT_SERVER_TODAY=2026-08-20`, which `capture.mjs` does not default
  (`12-verification-protocol.md` §2).

**Console must be silent.** `watchConsole(page, route)` is attached before navigation and its `fatal`
list asserted empty at the end of every test in the block, frame-only tests included. Nothing is
added to `TOLERATED_CONSOLE_WARNINGS`.

**No layout shift after paint.** A `PerformanceObserver` for `layout-shift` installed as an init
script, accumulating `entry.value` where `hadRecentInput` is false; `visit()` then `settle()`, then
`performance.now()` as the mark; then the drop state is entered and a file refused; then the sum
after the mark is asserted `0`. Gated on `PerformanceObserver.supportedEntryTypes`, so
`mobile-safari` records a stated skip rather than a false pass, and the value is reported either way.

### Definition of done

The six repository-wide items of `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test`
passes; the feature is visually verified in a real browser, light and dark, desktop and mobile; no
TODO, placeholder copy, `console.log` or commented-out code is left behind; and no file outside
**Owned paths** is touched.

On top of those, the `docs/SPEC.md` §2 visual clauses, ticked for every surface this stage ships:

- [ ] Spacing on the 4px grid from `--space-*`, no eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states — the
      drop panel, the upload action, the per-row menu and the retry control.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each on
      `--color-surface-2`.
- [ ] Motion 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured.
- [ ] Full parity in light **and** dark, with dark shadows re-declared rather than reused.
- [ ] Responsive 360px → 2560px at the three evidence widths, where 360px is a designed layout: the
      file table becomes a stacked card list rather than a horizontally scrolling table.
- [ ] Keyboard navigable end to end — including the paste target — sensible focus order, accessible
      names, WCAG 2.2 AA contrast in both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.
- [ ] `font-variant-numeric: tabular-nums` on every byte count, percentage and file count.

### Blockers

**One, inherited rather than introduced, and it is this file's first stage to meet it.**

- **`12-verification-protocol.md` §7.2 — seven abbreviated-month call sites still ask the platform.**
  `src/components/modules/files/file-library.tsx:116-121` constructs its own
  `Intl.DateTimeFormat(LOCALE, { day, month: 'short', year })`, and the Worker runtime and WebKit
  resolve `month: 'short'` from different ICU builds. §7.2 records the defect as latent "until a trip
  tab is baselined" — this stage is the first to baseline one, so it inherits it. Disposition:
  **record, and shoot around it.** The stage does not repair `src/lib/format.ts` (not its ownership)
  and does not widen `maxDiffPixelRatio`, which §5 forbids absolutely. It states in its evidence
  which frames contain an abbreviated month, and a `mobile-safari` difference confined to those
  strings is reported as this defect rather than as a design regression.
- **`12-verification-protocol.md` §7.3** applies as it does to every stage: the `mobile-safari`
  renderer is unpinned, so these baselines are a single-machine regression net and are not claimed as
  cross-machine truth.

No package outside the `docs/SPEC.md` §3 pinned set is needed: the clipboard is a DOM event, the
media types are strings, and the bucket binding already exists. No binding is required.

---

## Stage 06-S2 — A star, a trash you can come back from, and bytes that keep counting

### Stage id

`06-S2` · Wave 2 · effort **M**. Wave 2 because it needs `06-S1`'s completed upload path and the two
columns it asks wave 0 for, and because `06-S4`'s conditional tabs and starred-first sort are
downstream of it.

### Reference rows

- `DOC-03` absent → **done**. Starring, soft delete into a per-trip trash, restore, permanent
  delete of one file, and emptying the trash in one action.

Sourced from `wiki: Documents-and-Files`. Two of its open questions are decided here rather than
carried:

- **A star is a property of the file, not of the reader.** One shared star per file, visible to
  every member of the trip. A per-reader star would need a row per reader per file — a join table
  whose cardinality is members × files for a feature whose whole job is to move one row to the top of
  a list. If a later row wants a personal star it adds one; this stage does not build the
  more expensive shape speculatively.
- **A trashed file keeps its links.** Restore brings them back with it; permanent delete drops them
  with the row. `06-S6` builds those links and inherits this rule rather than restating it.

### Owned paths

- `src/server/repos/files.ts` — edit. The trash-aware reads and the five lifecycle writers.
- `src/server/fns/files.ts` — edit. Five server functions beside the four that exist.
- `src/components/modules/files/file-library.tsx` — edit. The star control, the trash view and the
  two confirmations.
- `src/components/modules/files/trash-view.tsx` — new. The trash list, its empty state and its bulk
  action.
- `src/components/modules/files/index.ts` — append. One export line; see the note below.
- `src/components/modules/files/__tests__/trash.test.ts` — new.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/documents-and-media.visual.spec.ts` — append. A `describe` block of its own; the file is
  created by `06-S1` in wave 1.
- `e2e/__screenshots__/documents-and-media.visual.spec.ts/` — this stage's own baselines only.

**Cross-wave sharing, named with the sibling stage id.** `src/server/fns/files.ts` is held by
**`00-S3`** (`00-foundations.md`, wave 0, the audit trail) and by **`06-S1`** (wave 1, above); this
claim is wave 2 and starts from both. `src/components/modules/files/file-library.tsx` is held by
`06-S1` (wave 1) and by `06-S4` (wave 3) in this same file — three waves, one at a time, never
concurrently. `src/server/repos/files.ts` is claimed by this stage in wave 2 and by `06-S6` in wave
4, and by nothing in any sibling plan.

None of the six shared paths is claimed.

### Data and migration

**Two columns and one index are required, and they belong to `00-foundations.md`.** This section
states the requirement; the schema edit itself is a wave-0 stage, because `src/server/db/schema.ts`
is a shared path and a wave-2 stage cannot supply its own precondition.

On `trip_files` (`src/server/db/schema.ts:987-1026`):

| Column       | Type                                  | Null     | Default | Meaning                                              |
| ------------ | ------------------------------------- | -------- | ------- | ---------------------------------------------------- |
| `starred_at` | `integer('starred_at', timestamp_ms)` | nullable | none    | Non-null means starred; the instant is the sort key. |
| `deleted_at` | `integer('deleted_at', timestamp_ms)` | nullable | none    | Null means active; non-null means in the trash.      |

Plus one index, `trip_files_org_trip_deleted_idx` on `(organization_id, trip_id, deleted_at)` —
`organization_id` leading, as every composite index in this schema does, because the active list and
the trash list are the two highest-frequency reads on this table and D1 bills rows **scanned**
(`ARCHITECTURE.md`, D1 notes), not rows returned.

**Additive only, and a rollback keeps working.** No column is dropped, renamed or narrowed. The
previous Worker reads neither column, so a rollback sees every file as active — which is the correct
degradation: a trashed file reappears in the list rather than disappearing from the product. No
`CHECK` is added: drizzle-kit rebuilds a whole SQLite table for a constraint change, and there is no
constraint to express here that nullability does not already give.

`starred_at` as an instant rather than a boolean is deliberate: it is one column that answers both
"is it starred" and "which starred file first", so the starred-first sort `06-S4` needs is a column
read rather than a second one.

**Migration.** Generated by `pnpm db:generate` in the wave-0 series, as `0003_*` or whichever ordinal
that series reaches. **It backfills nothing**: every existing row is active and unstarred, which is
exactly what two nulls mean.

**Retention, which is the decision this stage exists to make honestly.** A trashed file's bytes are
still in R2. Three rules, and the third is the one that stops the trash from becoming free storage:

1. **The trash has a stated window: 30 days.** After that a trashed file is permanently deleted,
   row and object. The window is a named constant beside its reason, and the trash view states it in
   words on the screen — "files here are deleted permanently after 30 days" — so the policy is
   something a traveller was told rather than something that happened to them.
2. **The sweep runs on the write path, never on a read.** Every call to `trashFile`, `restoreFile`,
   `purgeFile` and `emptyTrash` first purges that trip's rows whose `deleted_at` is older than the
   window, capped at 25 objects per call so one request cannot turn into an unbounded R2 loop. A
   loader that deletes rows while rendering a page is a worse bug than a late sweep.
3. **The correct long-term home is the weekly retention cron, and it does not exist.**
   `wrangler.jsonc:113` declares `"17 4 * * 1"` with the comment "Weekly retention prune of expired
   backups and export artifacts", and `src/server/worker.ts:60-66` answers it with
   `logger.warn('cron has no handler yet')`. Wiring it is a foundations requirement — the Worker
   entry is a shared path — and it is stated here rather than taken: a workspace-wide sweep would
   also close the orphaned-object leak from the area brief. Until it lands, rule 2 is what makes rule
   1 true, and rule 1 is not claimed to hold for a trip nobody opens.

**Trashed bytes keep counting against the plan, and that is a rule rather than an oversight.**
`getStorageUsage` sums every row in the tenant, trashed or not, and this stage does not change it.
A trash that stopped counting would be an unmetered storage tier reachable by pressing Delete, and
the traveller's own reading of "you are using 4.2 GB of 5 GB" would stop matching what R2 holds. The
trash view says so in one line, next to the storage meter that is already on the screen.

### Server (repo, server function, Zod)

**Repository — `src/server/repos/files.ts` (edit).** All SQL is here. Every query is built on
`tenantFilter()` from `src/server/repos/base.ts`, so `organization_id` leads the predicate and a
caller without a `TenantScope` cannot express one of these calls.

- `listTripFiles(scope, tripId, options)` — **behaviour change, stated because it is a change:** the
  predicate gains `isNull(tripFiles.deletedAt)`, so every existing caller (the files loader, and
  `listFilesForEntity`) stops seeing trashed rows without being edited. The order becomes
  `desc(starredAt) NULLS LAST, desc(createdAt)`, expressed the way SQLite orders nulls.
- `listTrashedFiles(scope, tripId)` — `isNotNull(deletedAt)`, ordered by `desc(deletedAt)`.
- `setFileStarred(scope, fileId, starred)` — writes `starred_at` to the instant or to null through
  `requireUpdate`, so a foreign id is a `NotFoundError` rather than a silent no-op.
- `trashFile(scope, fileId)` — sets `deleted_at`; **the object is not touched.** Returns the row.
- `restoreFile(scope, fileId)` — clears `deleted_at`. Refuses a row that is not trashed with a
  `RepositoryError`, because restoring an active file is a bug in the caller and not a no-op.
- `purgeFile(scope, fileId)` and `purgeTrashedFiles(scope, tripId, options)` — remove the rows and
  **return the storage keys** for the caller to delete, exactly as `deleteFile` already does
  (`files.ts:184-192`) and for the same reason its docblock gives: the row goes first, because a
  dangling object is a cleanup job and a dangling row is a broken download. `purgeTrashedFiles`
  takes `{ olderThan?, limit }` so both the 30-day sweep and "empty the trash now" are the same
  function with different arguments rather than two implementations of one idea.

**The R2 ordering on the delete side, stated in full because this stage owns the deletes.** It is the
mirror of the upload ordering in `06-S1` and it is the existing one: **the D1 row is removed first,
then the object.** If the object delete fails, the object is orphaned and the sweep in rule 2 above
will meet it again; if the order were reversed, a failed row delete would leave a file the product
lists and cannot download. For the write side nothing moves: an upload still writes the object,
then asserts the quota inside `recordFile`, then deletes the object if the assertion throws
(`src/server/fns/files.ts:158-213`, `src/server/repos/files.ts:170-171`).

**Server functions — `src/server/fns/files.ts` (edit).** Five, each `createServerFn({ method: 'POST' })`,
each mirroring to the trip room with the existing `filesChangedAt` patch the module already uses
(`files.ts:181-183`), so no new patch kind is declared in `src/server/do/protocol.ts` — a shared file
this stage does not claim and does not need:

| Function               | Input                         | Returns                |
| ---------------------- | ----------------------------- | ---------------------- |
| `setTripFileStarredFn` | `{ tripId, fileId, starred }` | `{ starred: boolean }` |
| `trashTripFileFn`      | `{ tripId, fileId }`          | `{ trashed: true }`    |
| `restoreTripFileFn`    | `{ tripId, fileId }`          | `{ restored: true }`   |
| `purgeTripFileFn`      | `{ tripId, fileId }`          | `{ purged: true }`     |
| `emptyTripTrashFn`     | `{ tripId }`                  | `{ purged: number }`   |

`deleteTripFileFn` keeps its name and its signature and **becomes the trash move** rather than the
destroy, because it is already wired to the row menu and because "Delete" meaning "recoverable for
30 days" is the behaviour this row asks for. Its docblock says so; the destroying operation is
`purgeTripFileFn`, which the trash view is the only caller of.

**Zod (v4 idiom).** `z.strictObject()` with the `error` parameter; ids as the existing trimmed
bounded string; `starred` as `z.boolean()`. Validation is shape, never permission.

**Authorisation** is decided in each handler: `appScope()`, then `requireTrip(scope, tripId)`, then a
repository call that resolves the file inside that scope. A well-formed file id from a browser is not
an authorised file id. Nothing is enqueued: a soft delete is one UPDATE, and the capped purge is at
most 25 R2 deletes, which is well inside a request.

### UI (route, components)

**Route.** None added, none edited — the trash is a view of the same screen, not a second URL, so a
reader who reloads is where they were and `pnpm generate-routes` does not run.

**Components.** Existing primitives: `IconButton` (the star), `Button`, `Badge`, `EmptyState`,
`Table`, `Alert`, `toast`, plus `ConfirmDialog`, `ModulePanel` and `useAction` from
`src/components/modules/shared`. One new product component, `trash-view.tsx`, inside the module this
plan owns. No new primitive, so nothing is filed to `00-foundations.md`.

- **The star** is an `IconButton` in the row's leading cell with `aria-pressed`, an accessible name
  that says which file it refers to, and an optimistic update through the module's existing
  `useOptimistic`/`optimisticReducer` pair — the list re-sorts immediately and rolls back on failure
  with a toast that says what failed. The icon fills on `--color-warning` in both themes, and the
  fill transition is 150ms, opacity and transform only.
- **The trash view** is reached by a toggle in the panel toolbar carrying a count badge, and it
  replaces the list in place with a 220ms cross-fade on `--ease-out-quint`. Each row shows the file,
  its size, when it was trashed and how long it has left, with Restore and Delete permanently.
- **Two confirmations, and they are not the same weight.** Permanently deleting one file is a
  `ConfirmDialog` naming the file. Emptying the trash is a `ConfirmDialog` naming the count and the
  bytes it will free, with the destructive `Button` variant, and it is the only bulk destroy in this
  module.

**States.**

- _Empty (active list)_ — unchanged from `06-S1`.
- _Empty (trash)_ — its own `EmptyState` on `--color-surface-2`, `Trash2` icon, copy that says
  nothing has been deleted and that deletions are recoverable for 30 days. An empty trash is a good
  outcome and the copy reads like one.
- _Skeleton_ — the trash list reuses `RowsSkeleton` at the same row height as the active list, so
  toggling between them shifts nothing.
- _Error_ — a failed restore or purge renders an `Alert` on `--color-surface-2` inside the panel with
  the reason and a retry affordance; the row stays where it was and the optimistic move rolls back.
- _Loading_ — every one of the five actions carries a `loading` state on its control and disables the
  row's other actions for that window, so a file cannot be purged and restored in the same instant.

**Tokens.** None missing. Countdown days, counts and byte totals all carry `tabular-nums`.

### Quota

**This stage creates no countable row**, and it deliberately does not release one either. It writes
two columns on rows that already exist and deletes rows that already exist. `files` and
`storage_bytes` stay asserted where they are, in `recordFile`
(`src/server/repos/files.ts:170-171`), and this stage changes neither the metrics nor the moment they
are checked.

The rule that matters here is the one under **Data and migration**: a trashed file still consumes
`files` and `storage_bytes` until it is purged, because `getStorageUsage` counts rows and not
lifecycle states. That is the enforced behaviour and it is what the screen tells the reader.

No metric is added, so nothing changes in `resolveLimits()` or `PLAN_QUOTAS` and no case is added to
`src/server/billing/__tests__/limits.test.ts`.

### Tenant isolation test

Appended as one new `describe` block that edits no existing block.

In organization A's scope, against organization B's rows: star, unstar, trash, restore and purge B's
file by id; list B's trash by B's trip id; and empty B's trash by B's trip id. Every one is a
`NotFoundError`, and afterwards B's file rows are byte-identical — including `starred_at` and
`deleted_at` — and B's storage total has not moved. The mirror case: A trashes its own file and B
cannot see it in either list.

One assertion specific to the sweep: `purgeTrashedFiles` called in A's scope with an `olderThan` far
in the future purges only A's rows, never B's, even though both tenants hold rows older than that
instant. A sweep that forgets the tenant filter is the exact shape of bug that only shows up in
production, so it is asserted before it can exist.

Functions covered: `setFileStarred`, `trashFile`, `restoreFile`, `purgeFile`, `purgeTrashedFiles`,
`listTrashedFiles`, and `listTripFiles` under its new active-only predicate.

### Verification

**Command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests, by file and invariant.**

- `src/components/modules/files/__tests__/trash.test.ts` (new) — the starred-first comparator puts a
  starred file above an unstarred newer one and orders two starred files by when they were starred;
  the days-remaining calculation is a whole number, is never negative, and is derived from the same
  clock the rest of the product reads rather than from a second one; the optimistic star rolls back
  to the exact previous order on failure.
- `src/server/repos/__tests__/tenant-isolation.test.ts` (append) — the cases above.
- The repository's own behaviour is covered in the isolation file rather than in a second repository
  test module, because every one of these functions is a tenant-scoped write and the isolation
  harness is where the two-tenant fixture already exists.

**Browser evidence.** `describe` block `06-S2 — starring and the trash` in
`e2e/documents-and-media.visual.spec.ts`.

- Route: `/trips/$tripId/files`.
- Frame set: light and dark at **360px, 1280px and 2560px** at rest, with at least one file starred
  so the sort is visible rather than asserted.
- **Declared non-resting states**, two, because both are the point of the stage:
  `--state trash-view` (the toggle clicked, reached by `--click '[data-part="files-trash-toggle"]'`)
  and `--state empty-trash-confirm` (the destructive confirmation open, reached by a second
  `--click '[data-part="files-empty-trash"]'`). Six frames each.
- Both selectors are `data-part` attributes this stage ships and **both are verified against a
  running server with `page.locator(sel).count()` returning 1 before any frame is filed.**
- The empty-trash confirmation is also the stage's error-state frame: `page.route()` fails the
  server-function request so the `Alert` renders from a real failure path rather than a prop.

**Console must be silent**, asserted through `watchConsole` in every test in the block, with nothing
added to `TOLERATED_CONSOLE_WARNINGS`.

**No layout shift after paint**, measured after the settle mark as `12-verification-protocol.md` §6
specifies, across the toggle between the two views — the view swap is the most likely place in this
stage for a shift — and gated on `supportedEntryTypes` with the WebKit skip stated as a skip.

### Definition of done

The six repository-wide items of `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test`
passes; the feature is visually verified in a real browser, light and dark, desktop and mobile; no
TODO, placeholder copy, `console.log` or commented-out code is left behind; and no file outside
**Owned paths** is touched.

The `docs/SPEC.md` §2 visual clauses, ticked for every surface this stage ships:

- [ ] Spacing on the 4px grid from `--space-*`, no eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states — the
      star, the trash toggle, Restore, Delete permanently and Empty trash.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each on
      `--color-surface-2` — including the trash's own empty state, which is a different sentence
      from the library's.
- [ ] Motion 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured — the view cross-fade and the star fill.
- [ ] Full parity in light **and** dark, with dark shadows re-declared rather than reused.
- [ ] Responsive 360px → 2560px, where 360px is a designed layout: the trash row's two actions become
      a row menu rather than two squeezed buttons.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names — the star announces its
      pressed state — WCAG 2.2 AA contrast in both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.
- [ ] `font-variant-numeric: tabular-nums` on every count, size and days-remaining number.

### Blockers

**One dependency and one inherited harness note; no package and no binding.**

- **The two columns are a wave-0 dependency.** `starred_at`, `deleted_at` and the composite index are
  stated above and executed by `00-foundations.md`. This stage cannot start until that migration
  lands, which is what wave 2 means; it is named here so nobody schedules it earlier.
- **`12-verification-protocol.md` §7.2** is inherited exactly as `06-S1` records it — this stage
  baselines the same trip tab and the same abbreviated-month strings.

No package outside the `docs/SPEC.md` §3 pinned set is needed, and no binding is required: this is
two nullable columns, five repository functions and one view.

The retention cron remains unwired (`src/server/worker.ts:60-66`) and is recorded as a foundations
requirement rather than a blocker, because the write-path sweep above makes the 30-day policy true
for any trip anybody opens and the cron only makes it true for the ones nobody does.

---

## Stage 06-S3 — The export nobody could ask for

### Stage id

`06-S3` · Wave 2 · effort **M**. Wave 2 because the entry point it adds sits on the files screen
`06-S1` completes, and because it is a producer for a consumer that already exists — the smallest
distance between a finished piece of infrastructure and a thing a traveller can press.

### Reference rows

- `DOC-06` partial → **done for the trip-plan document, which is the whole of the row's recorded
  gap**: "`repo-platform.md` §4 confirms nothing enqueues it and there is no UI trigger". A complete
  queue handler with no producer is not a half-built feature, it is a whole feature nobody can reach,
  and this stage builds the producer and the entry point it was missing.
- **The journey-book variant of `DOC-06` is left OPEN, owned by nobody, and named here as unowned.**
  The row's name also asks for "journey book (A4 landscape, count-driven photo layouts)". This stage
  does not build it and **does not defer it to another stage either**, because the only candidate,
  `08-S7` (`08-product-modules.md`, wave 2, which closes `ADD-08`), plans no export of any kind: it
  never mentions PDF, this row, or this stage. Writing "deferred to `08-S7`" would have marked a
  behaviour done in this plan while it was planned in neither — which is precisely the defect this
  file was rejected for at `06-S6`, and it is not going to be repeated here in different words.

**Why the journey book is genuinely a different piece of work rather than a section this stage could
have added, in two measurements.** Both are properties of `src/server/queue/types.ts`, which this
stage must not edit — `00-S4` (`00-foundations.md`, wave 0) and `07-S8`
(`07-collaboration-and-sharing.md`, wave 4) hold that file:

1. **`pdfExportPayloadSchema` requires a `tripId`** (`:67-75`, `z.string().min(1).max(64)`), and
   `journeys.trip_id` (`src/server/db/schema.ts:1338`) is **nullable** — a journal written about no
   particular trip could not be enqueued at all.
2. **`exportDocumentSchema` has no shape for an image** (`:42-63`): a section is a heading, an
   optional note and up to 500 rows of `label`, `value` and optional `meta`, all strings. "Count-driven
   photo layouts" cannot be expressed in it. Widening it is a change to the payload contract two other
   stages hold, and this stage's own rule — one payload schema, never a second — forbids the obvious
   workaround of declaring a parallel one in `fns/`.

So the honest disposition is **open, with an owner to be assigned**: a later stage must widen
`exportDocumentSchema` in the wave that owns `queue/types.ts`, and mount its entry point on the
journal screen in a wave `08-S3` (w1), `08-S7` (w2) and `08-S10` (w3) do not hold — wave 4 or later
for `src/routes/_app/journey/$journeyId.tsx`. That is a stage-shaped piece of work and it is written
down here so the next planning round can carve it, rather than being hidden inside a row this plan
calls done.

`gap-rows.json` records `DOC-06 → ADD-07`. That edge is carried entirely by the open journey-book
variant; the trip-plan export reads trips, days, assignments, places and reservations, none of which
the journal module owns. `ADD-07` is wave 1 in any case, so the edge is satisfied either way.

Behaviours sourced from `wiki: PDF-Export`. **One deliberate divergence, and it is a divergence
upward.** The reference has no server-side renderer: it prints through the reader's own browser
dialog, which caps fidelity, depends on that reader's print settings, and makes "send me the file"
impossible. We already render on the server, into R2, off the request path
(`src/server/queue/handlers/pdf-export.ts`). `README.md` names that as one of four things we are
ahead on and forbids regressing it to match. This stage keeps it and builds the producer it was
missing.

### Owned paths

- `src/server/queue/handlers/pdf-export.ts` — edit. The trip-plan document sections, the artifact
  prune, and the corrected ready-link.
- `src/server/queue/handlers/__tests__/pdf-export.test.ts` — new. The directory does not exist yet;
  `00-S4` creates it in wave 0 for its own handler test, and this file is a sibling inside it.
- `src/server/repos/exports.ts` — new. The export allowance: the quota assertion and the counter.
- `src/server/repos/__tests__/exports.test.ts` — new.
- `src/server/repos/index.ts` — append. One `export * from './exports'` line.
- `src/server/fns/exports.ts` — new. Request an export, list the artifacts, download one.
- `src/server/fns/__tests__/exports.test.ts` — new.
- `src/components/modules/files/export-panel.tsx` — new.
- `src/components/modules/files/index.ts` — append. One export line; see the note below.
- `src/routes/_app/trips/$tripId/files.tsx` — edit. Mounts the panel.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/documents-and-media.visual.spec.ts` — append.
- `e2e/__screenshots__/documents-and-media.visual.spec.ts/` — this stage's own baselines only.

**Cross-wave sharing, named with sibling stage ids.** `src/server/repos/index.ts` is held by
**`01-S6`** (`01-trips-core.md`, wave 4) and **`07-S10`** (`07-collaboration-and-sharing.md`, wave 5);
this claim is wave 2, it adds one export line, and it touches nothing either of them changes.
`src/server/queue/handlers/__tests__/` is created by **`00-S4`** (`00-foundations.md`, wave 0) for
`travel-stats.test.ts`; this stage adds a second file in that directory and edits neither the
directory's other contents nor `src/server/queue/types.ts` or `consumer.ts`, which `00-S4` (wave 0)
and `07-S8` (wave 4) hold.

**Same-wave disjointness inside this file, checked rather than assumed.** `06-S2` is the other wave-2
stage. It claims `src/server/repos/files.ts`, `src/server/fns/files.ts`, `file-library.tsx` and
`trash-view.tsx`; this stage claims none of those, and `06-S2` claims none of this stage's. The three
paths both stages touch — `src/components/modules/files/index.ts`, the isolation test and the plan's
spec file — are claimed by both as **append**, which `check-plan-collisions.mjs` treats as the
cooperative pattern it is: each adds its own export line, its own `describe` block and its own test
block, and neither rewrites the other's.

None of the six shared paths is claimed. No route **file** is added — `files.tsx` already exists —
so `pnpm generate-routes` does not run.

### Data and migration

**No schema change and no migration.** Nothing about an export is a domain row: the artifact is an
R2 object, the pointer is a KV entry, and the only durable count is a `usage_records` row the
billing repository already writes.

**Retention policy for the bytes this stage stores, which is the reason it is a storage stage and
not just a button.** Every export writes at least one object into `FILES` under
`exports/<orgId>/<tripId>/<taskId>.html`, and a second, `.pdf`, when the rendering secrets are
configured (`pdf-export.ts:20-27, 133-155`). Three rules:

1. **Seven days, and it is already half-true.** `EXPORT_TTL_SECONDS` (`pdf-export.ts:18`) is
   `7 * 24 * 60 * 60` and is applied to the KV pointer with `expirationTtl`. **The R2 objects have no
   expiry at all** — measured: nothing in `src/` deletes an object under `exports/`, so today the
   pointer expires after a week and the bytes stay for ever. That is the storage curve
   `ARCHITECTURE.md` §8 warns about, arriving through a feature nobody has been able to press yet.
2. **The prune rides the job.** Before it writes, `handlePdfExport` lists
   `exports/<orgId>/<tripId>/` and deletes every object older than `EXPORT_TTL_SECONDS`, then keeps
   at most the five newest and deletes the rest. Bounded by construction — one `list` and a handful
   of `delete` calls, inside a queue consumer that may run for minutes — and self-healing: a trip
   exported twice a day converges on five artifacts rather than growing.
3. **A workspace-wide sweep is a foundations requirement, stated and not taken.** `wrangler.jsonc:113`
   already declares `"17 4 * * 1"` as the "weekly retention prune of expired backups and export
   artifacts" and `src/server/worker.ts:60-66` answers it with `logger.warn('cron has no handler yet')`.
   Wiring it needs the Worker entry, which is a shared path. Rule 2 makes the policy true for every
   trip that is exported again; the cron is what would make it true for a trip exported once and
   never revisited, and for the orphaned upload objects named in the area brief.

The published storage number stays honest under all three, because export artifacts are **not**
counted by `getStorageUsage` — that sums `trip_files` rows, and an export writes none. Stated so
that nobody later "fixes" the count by inserting a `trip_files` row per export, which would put a
generated artifact inside the traveller's own file list and inside their `files` quota.

### Server (repo, server function, Zod)

**The payload schema is the existing one, and this stage does not add a second.**
`pdfExportPayloadSchema` (`src/server/queue/types.ts:67-75`) already validates
`{ tripId, requestedBy, document, notify? }` with `exportDocumentSchema` (`:42-63`) nested inside it —
title, optional subtitle, and up to 60 sections of up to 500 label/value/meta rows. The producer
builds a value of that type and hands it to `enqueueTask` (`src/server/queue/jobs.ts:66-77`), which
parses the whole envelope through `taskEnvelopeSchema` before it sends. The discriminated union
means an envelope with the wrong payload cannot be enqueued at all. **A second schema shaped like
this one, in a `fns/` module, would be the drift the union exists to prevent**, and `queue/types.ts`
is claimed by `00-S4` and `07-S8` in other waves, so this stage neither edits nor duplicates it.

**Repository — `src/server/repos/exports.ts` (new).** Small on purpose: one function, whose whole job
is that the ceiling is asserted where every other ceiling is.

- `assertExportAllowance(scope, { month })` — reads the live monthly counter with `getMonthlyUsage`
  (`src/server/repos/billing.ts:214-227`), calls
  **`assertQuota(scope, 'exports', used)`**, and returns the count. `exports` is a `TierMetric`
  already present in `PLAN_QUOTAS` (`src/server/db/types.ts:41-70`: free 3, starter 25, pro 250,
  business unlimited) and reaches `assertQuota` through `resolveLimits()` like every other metric.
- `recordExportRequested(scope, { month })` — `bumpUsage(scope, 'exports', 1, month)`, which
  increments in SQL (`billing.ts:200-206`) so two concurrent requests cannot both read the same value
  and write it back.
- The month is `serverToday().slice(0, 7)` (`src/server/clock.ts:73`), the same clock the rest of the
  product reads, so a pinned test day and the counter agree instead of disagreeing once a month.

Both are built on the tenant-scoped billing repository (`src/server/repos/billing.ts`), whose
`usageRecordsRepository` comes from `createTenantRepository` and therefore **stamps `organization_id`
on the row it writes and leads every read predicate with it** through `tenantFilter()`; neither
function can be called without a `TenantScope`, and the row this stage's quota check counts is one
tenant's and no other's. The isolation case is under **Tenant isolation test** below.

**Server functions — `src/server/fns/exports.ts` (new).** Three, and none of them renders anything.

| Function               | Method | Input                         | Returns                                                     |
| ---------------------- | ------ | ----------------------------- | ----------------------------------------------------------- |
| `requestTripExportFn`  | POST   | `{ tripId, notify: boolean }` | `{ taskId, queuedAt }`                                      |
| `listTripExportsFn`    | GET    | `{ tripId }`                  | `{ artifacts: [{ taskId, format, sizeBytes, createdAt }] }` |
| `downloadTripExportFn` | GET    | `{ tripId, taskId }`          | a raw `Response` streamed from R2                           |

- `requestTripExportFn` resolves `appScope()`, then `requireTrip(scope, tripId)`, then
  `assertExportAllowance`, then builds the `ExportDocument` from tenant-scoped repository reads —
  `listTripDays`, the itinerary assignments, `listTripPlaces`, `listReservations`, the day
  accommodations — then `recordExportRequested`, then `enqueueTask(env.TASKS, { kind: 'pdf-export', … })`
  with a deterministic id of the shape `export:<tripId>:<instant>` so a double submit is one job.
  **The rendering never happens in the request**: the handler is what writes the artifact, and the
  server function returns as soon as the message is on the queue. The document is built from reads
  the request already affords; a request that timed out building it would be a request that rendered.
- `listTripExportsFn` lists `exports/<orgId>/<tripId>/` on the `FILES` bucket through the existing
  `filesBucket()` accessor in `src/server/fns/context.ts` and maps the objects to their task ids. R2
  is the ground truth for what exists, so no index has to be kept in step with it; the KV pointer
  remains the handler's own record and is not the list's source.
- `downloadTripExportFn` resolves the scope first, re-resolves the trip, **derives the object key
  from the caller's own organization id** — `exportObjectKey(scope.ctx.organizationId, tripId, taskId, format)`,
  never from a value the browser supplied — and streams the object with
  `content-disposition: attachment` and `cache-control: private, no-store`, exactly as
  `downloadTripFileFn` does. Because the key is derived and not accepted, a task id belonging to
  another workspace resolves to a key inside the caller's own prefix, which does not exist, which is
  a 404. There is no id-shaped path into another tenant's artifact.

**The ready-link in the notification email is wrong today, and this stage fixes it.** `pdf-export.ts:163`
builds `${APP_URL}/app/trips/<tripId>/exports/<taskId>` — a path with no route: there is no `/app`
prefix in this router and no `exports` child route. It becomes
`${APP_URL}/trips/<tripId>/files?export=<taskId>`, which is a route that exists and which the panel
below reads to scroll to and highlight the artifact. A link in an email nobody has received yet is
still a broken link, and it would have been received the first time this stage's producer ran.

**Zod (v4 idiom).** `z.strictObject()` with the `error` parameter for all three inputs; ids as the
existing trimmed bounded string; `notify` as `z.boolean()`. The payload itself is validated by the
existing envelope union at enqueue time. Validation is shape; it decides nothing about permission.

**Authorisation** is decided in the handler: `appScope()` then `requireTrip()` before anything is read,
built or enqueued, and the download derives its key from the resolved scope. `beforeLoad` is UX and
is not a data boundary here or anywhere.

### UI (route, components)

**Route.** `/trips/$tripId/files` — an existing file, edited to mount one section. No route file is
added, so `pnpm generate-routes` does not run and `src/routeTree.gen.ts` is untouched. The route stays
on the default SSR.

**Why the files screen and not the planner sidebar.** `wiki: PDF-Export` puts the trigger in the day
plan's toolbar. Ours goes on the Files tab, for two reasons that are ours rather than the
reference's: an export **is** a document the trip now has, so it belongs where the trip's documents
are; and the planner screen is held by `01-S2`, `01-S4` and `07-S1` across waves 1 and 2, so a
trigger there would be a same-wave claim on a file another stage is rewriting. The planner may grow a
shortcut later; it is not needed for the row.

**Components.** Existing primitives only: `Card`, `Button`, `Badge`, `Spinner`, `EmptyState`,
`Alert`, `SectionLabel`, `Switch` (the "email me when it is ready" choice), `Table`, `toast`, plus
`ModulePanel` and `useAction` from `src/components/modules/shared`. One new product component,
`export-panel.tsx`, inside the module this plan owns. No new primitive, nothing filed to foundations.

**The panel** sits under the file library as its own `ModulePanel` labelled with a `SectionLabel`: a
one-sentence description of what an export is, the request `Button`, the notify `Switch`, and a list
of the artifacts that exist with their format, size and age, each with a download action.

**Waiting, without a spinner that lies.** The artifact does not exist the moment the button returns —
it exists when the consumer has written it. The panel therefore holds the returned `taskId` as a
pending row and polls `listTripExportsFn` every 3 seconds for at most 90 seconds. When the artifact
appears the row becomes real; when the window closes, the pending row becomes a plain "still
working — refresh" affordance rather than an animation that never stops. The poll interval and the
cap are named constants beside the reason, and the poll stops when the tab is hidden.

**States, named.**

- _Empty_ — no artifact yet: an `EmptyState` on `--color-surface-2` with the `FileDown` icon, one
  sentence about what a plan export is for (handing the trip to somebody without an account), and the
  request button as its action.
- _Skeleton_ — the panel fetches its list after hydration, so the list has a genuine pending state: a
  three-row `Skeleton` at the artifact row's exact height on `--color-surface-2`, so the panel does
  not change height when the list lands.
- _Error_ — two, and they read differently. A failed **list** renders an `Alert` with a retry, and
  the panel stays useful because the request button does not depend on it. A refused **request**
  renders the reason inline: a quota refusal says how many exports the plan includes this month and
  when the count resets, because "quota exceeded" is not a sentence anybody can act on.
- _Loading_ — the request `Button` carries `loading` while the enqueue is in flight and is `disabled`
  while a pending row exists, so one trip cannot queue five renders by impatience.

**Tokens.** None missing. Sizes, ages and the monthly allowance counter all carry `tabular-nums`.

### Quota

**The metric is `exports`, and this stage is its first `assertQuota` call site in the product.**
Measured: `grep -rn "assertQuota(" src/server/repos/*.ts` returns eight call sites — `collections.ts:300`,
`files.ts:170` and `:171`, `journey.ts:507`, `members.ts:160` and `:276`, `places.ts:269`,
`trips.ts:315` — and none of them is `exports`. The metric has been sold in `PLAN_QUOTAS` since the
schema landed and has never been enforced.

- Call site: `assertExportAllowance` in `src/server/repos/exports.ts`, **inside the repository,
  before the counter is bumped and before the job is enqueued** — the write it guards is the
  `usage_records` row and the R2 object the job will produce.
- The ceiling comes from `resolveLimits()` like every other metric; nothing is added to
  `PLAN_QUOTAS` or to the catalogue, because `exports` is already in both the type and the table.
  **No case is therefore added to `src/server/billing/__tests__/limits.test.ts`** — that test catches
  a metric added to the catalogue and not to the resolver, and this stage adds neither.
- The counter is monthly (`period = 'YYYY-MM'`), which is the shape a per-month allowance needs, and
  it is the one place in this plan where a ceiling is read from `usage_records` rather than from a
  live `COUNT(*)`. Stated because it is a deviation from the rule in `ARCHITECTURE.md` §6 and it has
  a reason: there is no table of exports to count, and the alternative — counting R2 objects — is a
  storage listing that the prune above deliberately keeps short, so it would under-count by design.

For the R2 half, the ordering is the file module's and is not re-derived: the artifact is written by
the queue handler, which is not inside a request and has no quota to lose a race with.

### Tenant isolation test

Appended as one new `describe` block that edits no existing block.

In organization A's scope, against organization B's rows: request an export for B's trip by id
(`NotFoundError` from `requireTrip`, and A's `exports` counter has not moved); list exports for B's
trip id (`NotFoundError`); download B's artifact by its real task id (a 404, because the key is
derived from A's organization id and no such object exists inside A's prefix). Afterwards B's usage
records are byte-identical.

And the case that is specific to a counter rather than a row: A's `assertExportAllowance` sees only
A's count when B has already spent its month's allowance, so a neighbour cannot exhaust A's plan.

Functions covered: `assertExportAllowance` and `recordExportRequested` in
`src/server/repos/exports.ts`.

### Verification

**Command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests, by file and invariant.**

- `src/server/queue/handlers/__tests__/pdf-export.test.ts` (new) — the document renders every section
  and escapes `<`, `>`, `&` and quotes in a trip title (the existing `escapeHtml` is exercised through
  a real title, not a string literal); the prune deletes objects older than `EXPORT_TTL_SECONDS` and
  keeps the five newest, and deletes nothing at all when there are fewer than five; the KV pointer
  carries the `.pdf` key when the renderer answered and the `.html` key when it did not; the
  ready-link is a path this router can resolve.
- `src/server/repos/__tests__/exports.test.ts` (new) — the allowance refuses the fourth export of a
  month on the free tier and admits the third; an unlimited tier never refuses; the month string is
  taken from the pinned clock rather than from `Date.now()`.
- `src/server/fns/__tests__/exports.test.ts` (new) — the built payload parses against
  `pdfExportPayloadSchema` (which is the assertion that this stage did not invent a second shape);
  the enqueue id is deterministic for the same trip and instant; the download key is derived from the
  scope and ignores an organization id supplied in the input.

**Browser evidence.** `describe` block `06-S3 — trip export` in
`e2e/documents-and-media.visual.spec.ts`.

- Route: `/trips/$tripId/files`.
- Frame set: light and dark at **360px, 1280px and 2560px** at rest, with the panel in its
  empty state, and a second rest set with one artifact present.
- **Declared non-resting state**: `--state export-pending` — the pending row with its poll running —
  reached by `--click '[data-part="export-request"]'`, a `data-part` this stage ships. **Verified
  against a running server with `page.locator(sel).count()` returning 1 before any frame is filed.**
- The error frame is reached with `page.route()` failing the list request, so the `Alert` comes from
  a real failed request rather than from a prop.

**Console must be silent**, asserted through `watchConsole` in every test in the block, including the
polling one — a poll that logs is a poll that will log every three seconds in production.

**No layout shift after paint**, measured after the settle mark, across the moment the pending row
becomes a real artifact row, which is the most likely place in this stage for one. Gated on
`supportedEntryTypes`, with the WebKit skip stated as a skip.

### Definition of done

The six repository-wide items of `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test`
passes; the feature is visually verified in a real browser, light and dark, desktop and mobile; no
TODO, placeholder copy, `console.log` or commented-out code is left behind; and no file outside
**Owned paths** is touched.

The `docs/SPEC.md` §2 visual clauses, ticked for every surface this stage ships:

- [ ] Spacing on the 4px grid from `--space-*`, no eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states — the
      request button, the notify switch and each artifact's download action.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each on
      `--color-surface-2`.
- [ ] Motion 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured — the pending row settling into a real row.
- [ ] Full parity in light **and** dark, with dark shadows re-declared rather than reused.
- [ ] Responsive 360px → 2560px, where 360px is a designed layout: the artifact row stacks its meta
      under its name rather than scrolling sideways.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes; the pending state is announced through a polite live region rather than by motion
      alone.
- [ ] Zero console errors or warnings, and zero layout shift after paint.
- [ ] `font-variant-numeric: tabular-nums` on every size, age and allowance number.

### Blockers

**One binding, absent, and the feature works without it — which is the point.**

- **`BROWSER` (browser rendering) is absent from `wrangler.jsonc` in both environments.**
  `11-S3` (`11-boundaries-and-blockers.md`) records it, and records what exists instead: the handler
  already renders a real PDF through the same service's REST interface when
  `BROWSER_RENDERING_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are configured as secrets
  (`pdf-export.ts:192-215`), and writes self-contained print markup when they are not
  (`renderPdf` returns `null`, `pointer.format` stays `'html'`). Disposition: **substitute**, already
  implemented. This stage ships against both paths, its tests cover both, and the panel labels the
  artifact by its real format rather than promising a PDF it may not have. Adding the binding is a
  cost-model change and the user's decision; it improves fidelity and changes nothing this stage
  builds.
- **The journey-book variant of `DOC-06` is open and unowned**, for the two schema reasons measured
  under **Reference rows**. Disposition: **defer, with no owner named**, because naming an owner that
  has not planned the work is what turns a deferral into a lie. It blocks nothing this stage ships —
  the trip-plan document is a complete, reachable feature on its own — and it is carried out of this
  plan as work for the next planning round rather than left implied by a row's status.
- **`12-verification-protocol.md` §7.2 and §7.3** are inherited as `06-S1` records them: this stage
  baselines the same trip tab.

No package outside the `docs/SPEC.md` §3 pinned set is needed. The document is a data structure, the
markup is a template string in a handler that already exists, and the queue, the bucket and the KV
namespace are all bindings we already have.

---

## Stage 06-S4 — Finding one file among ninety, and looking at it without leaving

### Stage id

`06-S4` · Wave 3 · effort **M**. Wave 3 because its two conditional tabs are conditions `06-S2`
creates — a starred tab needs something starred — and because a lightbox over a list that hides
trashed rows is a different lightbox from one that does not.

### Reference rows

- `DOC-02` partial → **done**. The filter tabs with live counts including the two conditional ones,
  the starred-first order, the inline document preview and the image lightbox with its arrows,
  keyboard, swipe and thumbnail strip.

Sourced from `wiki: Documents-and-Files`. The row's evidence line says there are no count badges;
there are (`file-library.tsx:571-597`, a `KindChip` per kind with a `count` prop plus an
"Everything" chip). This stage keeps them and adds what is genuinely missing.

### Owned paths

- `src/components/modules/files/file-library.tsx` — edit. The two conditional tabs and the row's
  preview affordance.
- `src/components/modules/files/file-preview.tsx` — new. The document preview and the image
  lightbox, one component with two shapes.
- `src/components/modules/files/download.ts` — edit. One new export beside `downloadTripFile`, which
  is re-expressed in terms of it. **Server** below records what this module does today, why the
  preview cannot use it as it stands, and why the fix belongs inside it rather than beside it.
- `src/components/modules/files/filters.ts` — new. The bucketing, the counts and the order, as pure
  functions.
- `src/components/modules/files/index.ts` — append. Two export lines.
- `src/components/modules/files/__tests__/filters.test.ts` — new.
- `src/components/modules/files/__tests__/file-preview.test.tsx` — new.
- `src/components/modules/files/__tests__/download.test.ts` — new.
- `e2e/fixtures/documents-and-media/` — new. The six images this stage uploads through the shipped
  control so the viewer has bytes to show. **Verification** says why a fixture directory is needed at
  all, which is the least obvious decision in this stage.
- `e2e/documents-and-media.visual.spec.ts` — append.
- `e2e/__screenshots__/documents-and-media.visual.spec.ts/` — this stage's own baselines only.

**Cross-wave sharing inside this file, named.** `file-library.tsx` is held by `06-S1` (wave 1) and
`06-S2` (wave 2); this claim is wave 3 and is the last of the three. `index.ts` is held by `06-S2`
and `06-S3` in wave 2. `download.ts` is claimed by **no other stage in any plan** — measured with
`grep -rn 'modules/files/download.ts' docs/plans/`, which returns this stage and nothing else — so
this is its first and only claim, in any wave. `e2e/fixtures/` is claimed by nothing at all; the same
grep over `e2e/fixtures` returns this stage only. No sibling plan claims anything in
`src/components/modules/files/`.

Nothing in `src/server/**` is claimed: this stage adds no endpoint, no repository function, no
migration and no schema.

None of the six shared paths is claimed, and no route file is added.

### Data and migration

**No schema change, no migration, and — deliberately — no new stored bytes.**

The row asks for a thumbnail strip, and a thumbnail is a derived object. This stage creates none, and
that is a decision rather than an omission:

- **There is nothing to make one with.** The image-transformation binding is absent from
  `wrangler.jsonc` in both environments (`11-S3`'s binding register), the `thumbnail` task kind is
  declared in `src/server/queue/types.ts:87-101` with **no handler** in `consumer.ts`, and a Worker
  cannot decode a JPEG without one. Writing a producer for a handler that does not exist would
  dead-letter every message — measured behaviour, `repo-platform.md` §4.
- **The strip does not need one.** It shows the images that are already on the screen, at strip size,
  from the same object the viewer displays; a trip's image set is bounded by the `files` quota and
  the strip renders at most the current filter's images with `loading="lazy"` and fixed dimensions.
  For a plan whose file ceiling is 50 on the free tier, a second stored rendition of every image
  would be a storage line item bought to save a few hundred kilobytes of transfer.
- **If thumbnails are ever generated, their retention is stated here in advance**, because
  `ARCHITECTURE.md` §8 names thumbnail sizes as one of three cost levers: a derived rendition lives
  and dies with its parent row, is deleted in the same call that purges the parent, and counts inside
  `storage_bytes` like any other byte. A derived object with an independent lifetime is an orphan
  waiting to happen.

So the answer to "what does this stage store and for how long" is **nothing, and not at all** — in
the product.

**The one place this stage does put bytes in a bucket is its own evidence run, and it has a retention
policy too.** The browser block under **Verification** uploads six fixture images into the local
development bucket, because the demo seeder writes file rows and no objects. Those bytes are deleted
by the same block's teardown, in the same run that created them, through the shipped delete path — so
they never accumulate across runs, never enter a deployed bucket, and never appear in the storage
meter of anything but the machine that ran the suite. A test that leaves bytes behind is a test that
slowly rewrites its own baseline.

### Server (repo, server function, Zod)

**Nothing is added on the server — no repository function, no server function, no schema.** This
stage is read-side work over a payload that already exists (`loadTripFiles`,
`src/routes/_app/-server/trip.ts:654-685`, which after `06-S2` returns active files with their star
state), plus bytes fetched through `downloadTripFileFn`, which already exists
(`src/server/fns/files.ts`, the `downloadTripFileFn` handler) and is **not** edited here.

**The one client-side module that does change, and the measurement that forces it.** An earlier draft
of this stage said the preview would read bytes through the existing `downloadTripFile` helper,
"already a blob-producing wrapper over `downloadTripFileFn`". It is not one, and the stage would have
been unbuildable as written. `src/components/modules/files/download.ts` exports exactly one function,
`downloadTripFile({ tripId, fileId, filename })`, typed
`Promise<{ readonly filename: string }>`. It calls `downloadTripFileFn`, reads `await
response.blob()`, and then **spends** the blob: `URL.createObjectURL`, a synthetic `<a download>`,
`anchor.click()`, `anchor.remove()`, and a `setTimeout` that revokes the object URL sixty seconds
later. It returns a filename and nothing else. A preview calling it would save the file to the
reader's disk and still have no bytes to render, and opening the same image twice would leave two
copies in the downloads folder.

So this stage splits it, **inside the module that owns it**, which is why `download.ts` is an owned
path above:

- `fetchTripFileBytes({ tripId, fileId })` — new export, returning the `Blob`. Same single
  authenticated call, same endpoint, no bucket URL and no second network path. On a non-`ok` response
  it throws a `FileBytesError` carrying `status` and the server's own message, so the caller can tell
  the **410** (`The stored copy of this file is missing.`) from the 404 and from everything else —
  which is exactly what the designed error state below needs in order to say the right sentence.
- `downloadTripFile` — **kept, with its signature, its return type and its observable behaviour
  unchanged**, re-expressed as `fetchTripFileBytes` followed by the anchor dance it already performs.
  Its existing callers are untouched. Adding a second fetch path beside it instead would be the
  duplicate-implementation defect `README.md` names, and the two would drift the first time the
  refusal shape changed.
- **The object URL's lifetime belongs to the viewer, not to a timer.** The preview creates one object
  URL per displayed file and revokes it in the effect cleanup — on close, and on moving to another
  image — so browsing ninety images holds one blob rather than ninety. The sixty-second
  `REVOKE_DELAY_MS` in the save path stays where it is and is **not** reused: it exists because a
  browser may still be reading the blob after the click that saves it, which is not something that
  happens to an `<img>` whose unmount we control.

Two server-side rules the preview must not break, restated because they are what make it safe:

- **The bytes still leave through the authenticated endpoint.** The preview does not construct a URL
  to the bucket; there is none to construct (`FILES_PUBLIC_BASE` has no reader —
  `src/server/queue/types.ts:273` is its only occurrence in `src/`).
- **The SVG rule from `06-S1` is enforced on this side.** An `image/svg+xml` file renders in the
  lightbox through an `<img>` element, where script content is inert, and the "open in a new tab"
  action is **not offered** for it — the only action is download, which already carries
  `content-disposition: attachment`. A blob URL inherits our origin, so navigating to one is the one
  path that would turn a stored file into stored script; it is closed here rather than warned about.

### UI (route, components)

**Route.** None added, none edited. `pnpm generate-routes` does not run.

**Components.** Existing primitives: `Dialog` (both shapes — the product does not need a second
overlay implementation), `IconButton`, `Kbd`, `ScrollArea`, `Badge`, `Skeleton`, `Alert`,
`EmptyState`, `Spinner`. New product components: `file-preview.tsx` and the pure `filters.ts`. **No
new primitive is filed to `00-foundations.md`**: a lightbox is a `Dialog` with a different body, and
adding a second overlay primitive beside `Dialog` and `Sheet` would be the duplicate-primitive defect
`README.md` names.

**The tabs.** `filters.ts` derives the whole toolbar as data: the kind buckets with counts, plus
**Starred**, present only when at least one active file is starred, and **Shared in chat**, present
only when at least one file is referenced by a collaboration message. The second condition is read
from the payload rather than invented: `collab_messages.file_id`
(`src/server/db/schema.ts:1070`) already links a message to a file, and the count travels in the
loader payload `07-S2` is extending in wave 1. If that field is absent the tab simply does not
render — a conditional tab whose condition cannot be evaluated is a tab that is off, not a crash.

**The order.** Starred first by `starred_at` descending, then everything else by `created_at`
descending. The comparator is in `filters.ts` and is the same one the repository orders by
(`06-S2`), so the optimistic star and the server agree on where the row lands.

**The preview**, one component with two shapes:

- **Document** — a `Dialog` at a comfortable reading width holding an `<iframe>` over a blob URL,
  with download and open-in-new-tab in the header. Offered for `application/pdf` and `text/plain`
  only; anything else goes straight to download, because a preview that renders a `.docx` as
  mojibake is worse than no preview.
- **Image** — a full-bleed `Dialog` with previous and next `IconButton`s, a thumbnail strip in a
  `ScrollArea` along the bottom, the filename and index in the header, and download. It navigates the
  images **of the current filter**, so what the arrows do matches what the reader can see.
- **Keyboard**: `ArrowLeft` / `ArrowRight` navigate, `Escape` closes (Radix already does), `Home` and
  `End` jump to the ends, and the shortcuts are shown once with `Kbd` in the header rather than being
  folklore. Focus is trapped by the `Dialog` and returns to the row that opened it.
- **Touch**: a horizontal swipe navigates, implemented with pointer events and a distance threshold,
  and it does not fight the strip's own horizontal scroll — the strip owns horizontal gestures inside
  its own box.

**States.**

- _Empty_ — a filter that matches nothing gets its own `EmptyState` on `--color-surface-2` naming the
  filter and offering to clear it. The library's global empty state is unchanged.
- _Skeleton_ — the preview shows a `Skeleton` at the image's aspect ratio while the blob is fetched,
  so opening a 4 MB photo does not flash an empty dialog; the strip renders skeleton tiles at the
  same size as real ones.
- _Error_ — a file whose object has gone (the download function answers 410 for exactly this,
  `src/server/fns/files.ts:294-298`) renders an `Alert` inside the preview saying the stored copy is
  missing, with the row still listed and a way back. That is a real state of this system, not a
  hypothetical: the orphan and sweep paths in `06-S2` can produce it.
- _Loading_ — the arrows and the strip are `disabled` while the next image's bytes are in flight, and
  the header shows a `Spinner`; a reader mashing the arrow key never gets two decodes racing.

**Motion.** The dialog enters at 220ms on `--ease-out-quint` and leaves at 150ms, opacity and
transform only. Moving between images cross-fades at 150ms, and under
`prefers-reduced-motion: reduce` both collapse to an opacity change. The strip's active tile is
marked with a token-coloured outline rather than a scale animation, so nothing about the current
position depends on motion.

**Tokens.** None missing; the lightbox scrim uses `--color-overlay` and the dialog `--z-modal`, both
already declared. Counts and the image index carry `tabular-nums`.

### Quota

**This stage creates no countable row.** It reads a payload and renders overlays. No metric, no
`assertQuota` call site, nothing added to `resolveLimits()`, `PLAN_QUOTAS` or
`src/server/billing/__tests__/limits.test.ts`.

The one quota-adjacent decision it takes is under **Data and migration**: it does not create derived
image renditions, so it adds nothing to `storage_bytes`.

### Tenant isolation test

**No case is appended to `src/server/repos/__tests__/tenant-isolation.test.ts`**, because this stage
adds no repository function and writes no row. Every byte it renders is fetched through
`downloadTripFileFn`, which resolves the scope and re-resolves the trip before it touches R2
(`src/server/fns/files.ts:281-282`), and whose isolation is covered by `06-S1`'s block. Naming that
here is the point: a stage with nothing to add says which existing case covers it rather than leaving
the heading to be read as an oversight.

### Verification

**Command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests, by file and invariant.**

- `src/components/modules/files/__tests__/filters.test.ts` (new) — the Starred tab appears at one
  starred file and disappears at zero; the chat tab appears only when a reference exists; every
  bucket's count equals the number of rows the same filter yields, for every bucket, so a badge can
  never disagree with the list; the comparator puts starred first and is stable for equal keys.
- `src/components/modules/files/__tests__/file-preview.test.tsx` (new) — `ArrowRight` at the last
  image stays at the last image rather than wrapping; the viewer navigates only the filtered set;
  an `image/svg+xml` file renders through an `<img>` and exposes no open-in-new-tab action; a 410
  from the download path renders the missing-copy alert rather than an empty frame; focus returns to
  the invoking row on close; and moving from one image to the next revokes the previous object URL
  exactly once, asserted against a spied `URL.revokeObjectURL`, because a leak here is invisible until
  a reader's tab is holding ninety photographs.
- `src/components/modules/files/__tests__/download.test.ts` (new) — `fetchTripFileBytes` returns the
  blob and creates **no** object URL and no anchor, so the preview path cannot save a file as a side
  effect; a 410 response throws a `FileBytesError` whose `status` is 410 and whose message is the
  server's own, and a 404 throws one whose `status` is 404, so the viewer can say two different true
  sentences; a non-`Response` return value throws rather than being coerced; and `downloadTripFile`
  still resolves to `{ filename }` and still clicks exactly one anchor with the `download` attribute
  set to the caller's filename — the regression test for the refactor, written before it.

**Browser evidence.** `describe` block `06-S4 — browsing and preview` in
`e2e/documents-and-media.visual.spec.ts`.

**The demo fixture has file rows and no file bytes. This is measured, and it decides the whole
block.** The seeder records `trip_files` rows through `recordFile`
(`src/routes/api/dev/-seed/apply-trip.ts:524-545`) and writes nothing to R2:
`grep -rn 'FILES|filesBucket|\.put\(' src/routes/api/dev/-seed/` returns no hit, and every seeded row
carries a hand-authored `storage_key` — `demo/tokyo-and-kyoto/…` in
`src/routes/api/dev/-seed/dataset/flagship.ts:2482` onwards — under which no object has ever been
written. `downloadTripFileFn` therefore answers **410 for every seeded file**
(`src/server/fns/files.ts:294-298`). An earlier draft of this stage declared lightbox frames over the
seeded images; not one of them could have been produced, and the block would have filed six
photographs of an error alert while calling them a viewer. So this block gets its bytes the only way
the product actually offers, through the upload path `06-S1` ships, and it turns the seeded rows into
the error evidence they genuinely already are.

- Route: `/trips/$tripId/files` on the seeded demo trip.
- **At rest, filed first and before anything is uploaded**: light and dark at **360px, 1280px and
  2560px** over the seeded library exactly as `/api/dev/seed` leaves it. Six frames. No row in them
  carries a wall-clock timestamp, so they are stable from one day to the next.
- **`--state preview-missing`, filed second and filed from the seeded set.** Opening the preview on a
  seeded image renders the missing-copy `Alert`, because the stored copy really is absent: a real 410
  from the real endpoint over a real row, with no `page.route()`, no interception and no fake. Six
  frames. This is the cheapest honest error evidence in the plan, and it exists because of the
  fixture's shape rather than in spite of it.
- **Then the block makes its own bytes.** A setup step attaches the six images in
  `e2e/fixtures/documents-and-media/` to the hidden input `06-S1` ships, waits for six accepted
  answers, and then asserts that fetching one of them back returns **200** rather than 410. That
  assertion is the guard: if the upload path ever regresses, this block fails there instead of
  quietly filing frames of a broken viewer. The fixtures are flat-colour PNGs authored for this repo —
  no third-party asset, nothing derived from the reference product — three at 1200×800 and three at
  800×1200, so the aspect-ratio change between neighbours is real and the layout-shift assertion below
  has something to prove. Under 60 KB in total.
- **`--state lightbox`** — the viewer open on the first uploaded image — and **`--state
lightbox-strip`** — the strip scrolled with a later tile active. Six frames each. Neither frame
  contains a date, an upload time or a byte count: the header carries the filename and the index, so
  nothing in them moves with the clock.
- **`--state tab-starred`.** The tab exists only when something is starred and the seed stars nothing,
  so the block stars one seeded file through the row affordance `06-S2` ships, waits for the write to
  settle, files six frames at `--click '[data-part="files-tab-starred"]'`, and unstars it again. The
  frames are of the seeded library, so they carry the same rows as the at-rest set.
- **A teardown deletes all six uploads** through the shipped delete path and leaves the star as it
  found it, so the library, its counts and its storage meter return to the seeded state. If teardown
  ever fails, the next run's at-rest frames differ and the suite goes red — a loud failure rather than
  a baseline that drifts one file at a time, which is the failure mode worth choosing.
- Every `data-part` selector named here is an attribute this stage ships, and **each is verified
  against a running server with `page.locator(sel).count()` returning 1 before any frame is filed.**
- The 360px lightbox frame is the one that matters most and is called out: a full-screen viewer with
  a thumbnail strip is where a squeezed desktop shows itself.

**Console must be silent**, asserted through `watchConsole` in every test in the block — including
the lightbox tests, because an image decode failure logs and would otherwise pass unnoticed.

**No layout shift after paint**, measured after the settle mark across opening the lightbox and
moving between two images of different aspect ratios, which is the shift this design most has to
earn. Gated on `supportedEntryTypes`, with the WebKit skip stated as a skip.

### Definition of done

The six repository-wide items of `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test`
passes; the feature is visually verified in a real browser, light and dark, desktop and mobile; no
TODO, placeholder copy, `console.log` or commented-out code is left behind; and no file outside
**Owned paths** is touched.

The `docs/SPEC.md` §2 visual clauses, ticked for every surface this stage ships:

- [ ] Spacing on the 4px grid from `--space-*`, no eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states — the
      tabs, the arrows, every thumbnail tile and the two header actions.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each on
      `--color-surface-2` — including the per-filter empty state, which names the filter.
- [ ] Motion 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured.
- [ ] Full parity in light **and** dark, with dark shadows re-declared rather than reused — the
      lightbox scrim and the strip's elevation are declared per theme.
- [ ] Responsive 360px → 2560px, where 360px is a designed layout: the strip becomes a compact dot
      row and the arrows move to the thumb-reachable edges rather than shrinking in place.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes; the viewer announces "image 3 of 9" rather than relying on the strip.
- [ ] Zero console errors or warnings, and zero layout shift after paint.
- [ ] `font-variant-numeric: tabular-nums` on every count and index.

### Blockers

**None that stop the stage; two facts recorded so nobody re-derives them.**

- **The image-transformation binding is absent** (`11-S3`), so the `thumbnail` task kind stays without
  a handler and this stage generates no renditions. Disposition: **substitute** — the strip renders
  the stored objects at strip size. This is a stated design decision, not a deferral: if the binding
  arrives, the strip can be pointed at renditions without changing anything a reader sees.
- **`12-verification-protocol.md` §7.2 and §7.3** are inherited as `06-S1` records them.

No package outside the `docs/SPEC.md` §3 pinned set is needed: the overlay is `Dialog` from our own
primitives, the gestures are pointer events, and the bytes come from a function that already exists.

---

## Stage 06-S5 — A calendar that keeps up with the trip

### Stage id

`06-S5` · Wave 3 · effort **L**. Wave 3 because `gap-rows.json` puts `DOC-07 → COL-10`, and `COL-10`
is `07-S6` in wave 2: the token digest helper and the argued unscoped-resolver pattern land there,
and this stage reuses both rather than inventing a second way to turn a secret in a URL into a tenant.

### Reference rows

- `DOC-07` absent → **done**. The one-off download, the live per-trip feed, the live all-trips feed,
  token issuance, rotation and revocation, stable event identifiers, and the refresh hints a calendar
  client reads.

Sourced from `wiki: Calendar-Feeds`. Three of its properties are ours to decide differently and are
decided here, each with its reason:

- **A workspace feed contains exactly the trips that person's own `/trips` screen contains, and the
  repository read that produces it is named here so the two cannot drift.** The reference is
  single-tenant, so "every trip you own or joined" is unambiguous. Ours is not, and there are two
  candidate answers in this codebase, so the choice is made once, here, rather than implied twice.
  **Workspace membership, not trip membership, is this product's read boundary** - measured, not
  assumed: `requireTrip` is `tripsRepository.requireById(scope, tripId)` with no member predicate
  (`src/server/repos/trips.ts:152`), and the trips screen loads
  `listTrips(scope, { archived: false, ... })` (`src/routes/_app/-server/overview.ts:266`), which has
  no user predicate either (`src/server/repos/trips.ts:210`). `listTripsForUser`
  (`src/server/repos/trips.ts:414`) does filter through `trip_members`, but its only caller is the
  dashboard's "yours" rail (`src/server/repos/dashboard.ts:69`); it is an affordance, not a permission
  boundary, and this stage does not promote it into one.

  So a workspace feed is built from **one** read - `listTrips(scope, { archived: false, limit: 100 })`
  inside the scope of step 5 below - with the ended-more-than-90-days floor applied as a pure
  predicate over the returned rows against `trips.end_date` (`schema.ts:345`), because
  `listTripsInput` (`src/server/repos/trips.ts:98-107`) carries no date filter and this stage may not
  add SQL to a repository file it does not own. A feed that showed less than the screen would be a
  support ticket; one that showed more would be a leak; equal is neither, and it is the only answer
  that needs no second visibility model.

  Two consequences, stated as consequences rather than left as omissions. **The link carries every
  non-archived trip of that workspace, including trips its owner never joined** - so the dialog says
  that in those words before the link is revealed (see **UI**), because the mitigation for a wide
  bearer credential is that the person issuing it knows how wide it is, next to rotation, revocation
  and the resolve-time membership check in step 3. And **somebody in two workspaces subscribes
  twice**: merging them would be the first row in this product whose contents cross a tenant
  boundary, and no URL is worth that.

- **The token is stored as a digest, never as the secret.** `07-S6` establishes it for share links
  and its argument is identical here: a leaked database row must not yield a working URL.
- **No time-zone blocks are emitted at all**, so there is nothing to deduplicate. See below.

This stage unblocks nothing else: no row in `gap-rows.json` names `DOC-07` in its `dependsOn`,
counted over the file rather than assumed.

### Owned paths

- `src/server/calendar/ics.ts` — new. The iCalendar **writer**: folding, escaping, and the value
  forms.
- `src/server/calendar/feed.ts` — new. The one server-only module: resolve a feed, build its
  calendar.
- `src/server/calendar/__tests__/ics.test.ts` — new.
- `src/server/calendar/__tests__/feed.test.ts` — new.
- `src/server/repos/calendar-feeds.ts` — new. The feed rows: issue, rotate, revoke, resolve.
- `src/server/repos/__tests__/calendar-feeds.test.ts` — new. The unscoped resolver's own file.
- `src/server/repos/index.ts` — append. One `export * from './calendar-feeds'` line.
- `src/server/fns/calendar.ts` — new. The app's entry: manage a feed, download a snapshot.
- `src/routes/api/feed/$.ts` — new. The HTTP contract. **A new route file, so `pnpm generate-routes`
  runs and the regenerated `src/routeTree.gen.ts` travels in this stage's diff. It is never
  hand-edited and is not listed as an owned path.**
- `src/components/modules/files/calendar-panel.tsx` — new. The subscribe dialog and its two feeds.
- `src/components/modules/files/index.ts` — append. One export line.
- `src/components/modules/files/__tests__/calendar-panel.test.tsx` — new.
- `src/routes/_app/trips/$tripId/files.tsx` — edit. Mounts the panel.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/documents-and-media.visual.spec.ts` — append.
- `e2e/__screenshots__/documents-and-media.visual.spec.ts/` — this stage's own baselines only.

**Same-wave disjointness inside this file, checked rather than assumed.** `06-S4` is the other wave-3
stage. It claims `file-library.tsx`, `file-preview.tsx`, `filters.ts` and their tests; this stage
claims none of those. The two paths they both touch — `src/components/modules/files/index.ts` and the
plan's spec file — are claimed by both as **append**, which `check-plan-collisions.mjs` treats as the
cooperative pattern it is: each adds its own line or its own `describe` block and neither rewrites
the other's.

**Cross-wave sharing, named with sibling stage ids.** `src/server/repos/index.ts` is appended to by
`06-S3` (wave 2) here and is held by `01-S6` (`01-trips-core.md`, wave 4) and `07-S10`
(`07-collaboration-and-sharing.md`, wave 5). `src/routes/_app/trips/$tripId/files.tsx` is held by
`06-S3` in wave 2 and by this stage in wave 3, and by no sibling plan.

None of the six shared paths is claimed. `src/server/db/schema.ts` is **not** claimed even though this
stage needs a table — see below.

### Data and migration

**One new table is required, and it belongs to `00-foundations.md`.** This section states the
requirement; a wave-3 stage cannot supply its own precondition and may not touch the schema module.

`calendar_feeds`:

| Column                      | Type                                    | Null     | Meaning                                                       |
| --------------------------- | --------------------------------------- | -------- | ------------------------------------------------------------- |
| `id`                        | `pk()`                                  | not null | `newId()`, as every table.                                    |
| `organization_id`           | `orgRef()`                              | not null | Leading column of every index, as every table.                |
| `user_id`                   | `userRef('user_id')`                    | not null | Whose feed it is. Its contents are resolved as this person.   |
| `trip_id`                   | `text` → `trips.id` `on delete cascade` | nullable | The trip for a trip feed; null for a workspace feed.          |
| `scope`                     | `text`                                  | not null | `trip` or `workspace`, with `calendar_feeds_scope_chk`.       |
| `token_digest`              | `text`                                  | not null | SHA-256 hex of the secret. The secret itself is never stored. |
| `expires_at`                | `integer` timestamp_ms                  | nullable | Optional hard expiry. Null means it lives until revoked.      |
| `revoked_at`                | `integer` timestamp_ms                  | nullable | Non-null means every request 404s.                            |
| `rotated_at`                | `integer` timestamp_ms                  | nullable | When the digest was last replaced.                            |
| `last_served_at`            | `integer` timestamp_ms                  | nullable | The access log, in one column.                                |
| `serve_count`               | `integer` default 0                     | not null | With `calendar_feeds_serve_count_chk` non-negative.           |
| `created_at` / `updated_at` | `timestamps()`                          | not null | The house convention.                                         |

Indexes: `calendar_feeds_token_unq` unique on `(token_digest)` — the resolver's only lookup;
`calendar_feeds_org_user_idx` on `(organization_id, user_id, scope)`;
`calendar_feeds_org_trip_idx` on `(organization_id, trip_id)`.

**Additive only.** A new table breaks no rollback: the previous Worker does not read it, and the
route that would has not been deployed.

**Migration.** Generated by `pnpm db:generate` in the wave-0 series. **It backfills nothing** — no
feed can exist before the write path does.

**One SQLite behaviour that has to be handled in the repository rather than by the index.** A unique
index on `(organization_id, user_id, scope, trip_id)` would not stop a second workspace feed, because
SQLite treats two NULL `trip_id` values as distinct and the index would admit both. So the "one feed
per person per scope" rule is enforced by the repository's find-or-issue path, and the test asserts
that calling it twice returns the same row rather than two. Writing the index and assuming it holds
is the version of this that looks correct and is not.

**Retention.** This stage stores no bytes at all: a feed is one small row and its response is
generated per request and never persisted. The row is deleted with its trip (`on delete cascade`) and
by the traveller turning the feed off. Nothing to expire, nothing to sweep.

### Server (repo, server function, Zod)

**One server-only module, two entry points — and that shape is the point of this stage.**

`src/server/calendar/feed.ts` holds every decision: how a secret resolves to a feed, which trips a
feed covers, what events a trip contributes, and what the response headers are. It is imported by
exactly two callers:

1. **The HTTP contract — `src/routes/api/feed/$.ts`, a server route.** Declares only
   `server: { handlers: { GET, HEAD } }`, following `src/routes/api/tiles/$.ts:58-66`, so the handler
   and the bindings stay out of the client bundle. This is what a calendar application fetches, and
   it must keep working unchanged for years — a subscription URL is a thing people paste into a
   device and forget.
2. **The application — `src/server/fns/calendar.ts`, server functions.** The dialog's reads and
   writes, and the one-off snapshot download, which returns the same body the route would return for
   the same feed.

**An SSR loader must never fetch its own server route.** `fetch('/api/feed/…')` inside a loader is not
portable — a loader is isomorphic and runs on both sides, and on the server there is no origin to
resolve a relative URL against. That is why the module exists in the middle: the route and the server
function both **call the module**, and neither calls the other. Any surface of ours that needs the
calendar body calls `buildFeed()` directly; a loader that fetched the route would be one deployment
change away from breaking, and it would authenticate itself with a token instead of a session.

**Repository — `src/server/repos/calendar-feeds.ts` (new).** All SQL for this stage is here.

- `issueFeed(scope, { scope: 'trip' | 'workspace', tripId? })` — finds this person's existing feed for
  that scope or inserts one, mints a secret with `nanoid(32)`, stores **only** its digest, and returns
  the secret **once**. Built on `tenantFilter()`; `organization_id` is stamped on insert, never
  accepted, and a trip feed calls `requireTrip` first so a foreign trip id cannot parent a row.
- `rotateFeed(scope, feedId)` — mints a new secret, overwrites the digest, sets `rotated_at`, returns
  the new secret once. The old URL stops resolving on the next request; no history is kept, which is
  what makes revocation total rather than eventual.
- `revokeFeed(scope, feedId)` — sets `revoked_at`. The URL 404s from then on and the row stays, so the
  access log survives the revocation that the leak caused.
- `listFeeds(scope, { userId })` and `getFeed(scope, feedId)` — scoped reads for the dialog.
- `touchFeed(scope, feedId, at)` — `serve_count + 1` and `last_served_at`, expressed in SQL so two
  concurrent fetches cannot lose an increment.
- `findLiveFeedByDigest(db, digest)` — **the one deliberately unscoped query in this stage**, argued
  rather than slipped in, and shaped exactly like `07-S6`'s `findLiveShareLinkByToken`: it takes a
  `Database` rather than a `TenantScope`, because until the row is found there is no tenant to scope
  by — the row **is** the tenant resolution. It matches the unique digest index, returns null for a
  revoked or expired row, and returns only `{ id, organizationId, userId, scope, tripId }`. It never
  returns trip content, so a caller that forgets to build a scope has nothing to render.

The digest helper is **not re-implemented**: `hashShareToken` lands in `src/server/repos/trips.ts` in
`07-S6` (wave 2) and this module imports it. One transformation, applied on write and on read, cannot
drift between two modules if there is only one of it.

**How an unauthenticated request resolves a tenant, step by step, because this is the second surface
in the product a request without a session can reach:**

1. The URL carries **one** value: an opaque secret in the path, `/api/feed/<secret>.ics`. Nothing in
   the path or the query is read as an id, a trip id or an organization id.
2. The secret is hashed and matched against the unique digest index. A miss, a revoked row and an
   expired row are **the same 404**, with the same body — nothing distinguishes "never existed" from
   "was turned off", because the difference is information about somebody's trip.
3. **The owner's workspace membership is revalidated on every single request, and this is where
   offboarding is answered.** A provisional least-privileged scope is built from the matched row -
   `createScope(getDb(), { organizationId: feed.organizationId, userId: feed.userId, role: 'member' })` -
   and used for exactly one read, `getMembership(scope, feed.userId)`
   (`src/server/repos/members.ts:144`). Its provisional role decides nothing, because that read
   filters on `organization_id` and `user_id` and on nothing else. `null` is **the same 404 as step
   2, with the same body**. That one indexed lookup on `member_organization_id_user_id_unique`
   (`src/server/db/auth-schema.ts:220`) closes all three ways an owner stops belonging: removed from
   the workspace (`removeMember` hard-deletes the row through `requireRemove`,
   `src/server/repos/members.ts:187`), the workspace itself deleted, and the account deleted, since
   `member.user_id` references `user.id` `on delete cascade` (`src/server/db/auth-schema.ts:213-215`).
   The check sits at resolve time rather than in the offboarding paths **deliberately**: a feed that
   dies only when some other stage remembers to sweep it is a feed that outlives the person, and this
   stage owns none of those files. It is a **deny, not a revoke** - nothing is written, so a person
   removed by mistake and re-added has their existing devices working again on the next poll, with no
   re-issue and no new URL.
4. **"Removed from the trip" is a different question, and the answer is that it changes nothing -
   because it changes nothing in the app either.** `trip_members` is a collaborator list, not a read
   gate: `requireTrip` is tenant-scoped only (`src/server/repos/trips.ts:152`), so a workspace member
   who was never added to a trip can already open it on screen. A trip feed therefore keeps serving
   after its owner's `trip_members` row is deleted, exactly as their browser would, and stops when
   their **workspace** membership goes in step 3, when the trip is deleted (the feed row cascades with
   it), or when they rotate or revoke. This is written down because the absence of a `tripRoleFor`
   call here is a decision and not a gap: `tripRoleFor` (`src/server/repos/trips.ts:460`) exists, and
   calling it would make the feed narrower than the screen, which the **Reference rows** section has
   already refused.
5. The tenant of every content read is then the matched row carrying the **live** role from step 3:
   `createScope(getDb(), { organizationId: feed.organizationId, userId: feed.userId, role: membership.role })`.
   The identity is the feed's owner, which is what makes "the trips this person can see" a defined
   thing, and the role is read from `member` rather than assumed, so an owner demoted to `member`
   serves a member's feed on the next fetch. A `role` value outside `ORGANIZATION_ROLES` fails
   `requireTenantContext` (`src/server/repos/context.ts:96`); the route maps **every** resolution
   failure, that one included, to the same 404 rather than to a 500, so a corrupt row leaks nothing
   and pages nobody.
6. Every read after that is an ordinary tenant-scoped repository call - `listTrips` for a workspace
   feed, `requireTrip` for a trip feed - so even a corrupted row cannot read across a boundary.
7. The only write the visit can cause is `touchFeed`, in the same scope.
8. **A session on the request is ignored.** If the fetch happens to carry our cookies — a person
   pasting the URL into their own browser — the response is still the feed the token names and
   nothing more. A token that could be upgraded by the reader's own session would return different
   bytes to different readers of the same URL, which is not a calendar feed.

**The safety rule the UI must carry, stated here because it is a security property and not a
sentence.** The token in the URL **is** the credential: anyone holding the link reads the places,
times, addresses, notes and confirmation details of every trip the feed covers - one trip for a trip
feed, every non-archived trip of the workspace for a workspace feed - with no account and no audit
trail beyond `serve_count`. So: the dialog says so in plain words before the link is revealed, not in a footnote;
the link is shown once on issue and thereafter only through an explicit "show" action; the response
carries `cache-control: private, no-store` and `x-robots-tag: noindex, nofollow` so an intermediary
or a crawler does not keep a copy; and the panel offers Rotate and Turn off side by side with the
copy actions, because the fix for a leaked link has to be as reachable as the mistake was.

**Rate limiting, because an unauthenticated endpoint is a public one.** Each resolved feed keeps a
counter in `KV` under `feed:<digest-prefix>:<minute>` with a 120-second TTL; beyond a stated
per-minute ceiling the route answers `429` with a `retry-after`. Calendar clients poll on the order of
hours, so the ceiling is generous and the only traffic it refuses is traffic no calendar produces.
The `KV` binding already exists and no new one is asked for.

**Server functions — `src/server/fns/calendar.ts` (new).**

| Function               | Method | Input                | Returns                                         |
| ---------------------- | ------ | -------------------- | ----------------------------------------------- |
| `loadCalendarFeedsFn`  | GET    | `{ tripId }`         | both feeds' state, never a secret               |
| `issueCalendarFeedFn`  | POST   | `{ tripId?, scope }` | `{ url, webcalUrl }` — the secret, once         |
| `rotateCalendarFeedFn` | POST   | `{ feedId }`         | `{ url, webcalUrl }` — the new secret, once     |
| `revokeCalendarFeedFn` | POST   | `{ feedId }`         | `{ revoked: true }`                             |
| `downloadTripIcsFn`    | GET    | `{ tripId }`         | a raw `Response`: the snapshot, `text/calendar` |

The absolute URL is built from `APP_URL` (`wrangler.jsonc:40`, overridden per environment and in
`.dev.vars`), never from a request header. A feed URL built from a spoofable `Host` is a feed URL an
attacker can point at their own origin.

**Zod (v4 idiom).** `z.strictObject()` with the `error` parameter; `z.enum(['trip', 'workspace'])`;
ids as the existing trimmed bounded string; the route's own path parameter validated as a
`[A-Za-z0-9_-]{16,64}` secret **before** it is hashed, so a pathological path never reaches the
digest. Validation is shape; it decides nothing about permission.

**Authorisation.** Inside the app: `appScope()` then `requireTrip()` for a trip feed, and a feed row is
only ever resolved by id inside the caller's scope, so managing somebody else's feed is a
`NotFoundError`. On the HTTP contract: the token, and only the token, per the six steps above.

**What the calendar contains, and why there is no `VTIMEZONE` block to deduplicate.**

- One all-day event for the trip itself, spanning `trips.start_date` to `trips.end_date`
  (`schema.ts:344-345`), carrying the trip summary.
- One timed event per day assignment that has a `start_time` (`day_assignments.start_time`,
  `schema.ts:545`), titled with the place name, located at the place address, described with the
  assignment note.
- One all-day summary event per day that has untimed places or notes, titled with `days.title` and
  falling back to `Day <n>` from `days.day_number`.
- Reservations with a placeable date (`reservations.start_date`/`start_time`, `schema.ts:716-719`),
  and transports from their departure and arrival endpoints, **each in its own stored zone**:
  `transports.departure_timezone` and `arrival_timezone` already exist (`schema.ts:666`, `:673`).
  A reservation with no date is skipped, as the reference does, because an event with no time is not
  an event.
- **Every timed event is emitted as a UTC instant** — `DTSTART:20260817T090000Z` — computed from the
  stored local time and its zone with `Intl.DateTimeFormat(..., { timeZone, timeZoneName: 'longOffset' })`.
  All-day events are emitted as `DATE` values, which are floating by definition and correct in every
  reader's zone. Consequently **no `VTIMEZONE` component is ever written**, and the deduplication the
  row asks for has nothing to deduplicate. This is not a shortcut around the requirement: hand-rolling
  `VTIMEZONE` means emitting daylight-saving transition rules, and a wrong rule moves an event by an
  hour on exactly the days people are travelling. A UTC instant cannot be wrong about an offset it
  does not carry.
- **Places have no time zone column and this stage does not ask for one.** A timed assignment is
  anchored to `trips.timezone` (`schema.ts:346`) and then to `UTC`, in that order, and the fallback is
  stated on the dialog in one sentence. Adding `places.timezone` would produce a column nothing can
  fill until the geocoding provider decision in `11-S3` is taken — `11-S3` states the sequence as
  decision, then column, then feature, and this stage obeys it.
- **UIDs are stable and derived**, `<kind>-<rowId>@planned.travel`, so a re-fetch updates an event
  instead of duplicating it, and they survive a token rotation because they are derived from the row
  and not from the feed.
- **Refresh hints**: `REFRESH-INTERVAL;VALUE=DURATION:PT1H` and `X-PUBLISHED-TTL:PT1H`, with
  `cache-control: private, no-store` on the response. Clients treat the hints as suggestions and some
  poll far less often, so the dialog says an edit can take hours to appear rather than letting a
  traveller conclude the feature is broken.

**`src/server/calendar/ics.ts` is a writer, not a second parser.** `src/server/queue/ics.ts` exports
`unfoldIcsLines`, `unescapeIcsText`, `parseIcsProperty` and `parseIcsDate` — four readers and no
writer. Folding, escaping and value formatting are the inverse operations; they share no code with
their inverses, and putting a request-side serialiser inside the queue tree would put it behind a
module the request path has no other reason to import.

**Nothing here is enqueued.** A feed response is a few dozen rows and a string; it is generated in the
request, which is what "live" means.

### UI (route, components)

**Route.** One new route **file**, `src/routes/api/feed/$.ts`, which is an HTTP endpoint and not a
screen: it declares only `server`, renders nothing, and has no loader. **Adding it means running
`pnpm generate-routes`**; `src/routeTree.gen.ts` is regenerated, travels in the diff, and is never
hand-edited. `src/routes/_app/trips/$tripId/files.tsx` is edited to mount the panel and is not a new
file.

**Components.** Existing primitives: `Dialog`, `Button`, `IconButton`, `Switch`, `Alert`, `Badge`,
`SectionLabel`, `Tabs` (this trip / all trips), `Tooltip`, `toast`, and `CopyValue` from
`src/components/modules/shared`, which already implements copy-to-clipboard with its own confirmation
state — a second copy button would be the duplicate-component defect. One new product component,
`calendar-panel.tsx`. No new primitive.

**The panel** sits beside the export panel under the same "take it with you" heading on the files
screen, because both answer the same question — how does this trip leave the app. It offers:

- the one-off download, which needs no token and no decision, as the plain first action;
- the subscription, behind an explicit enable step, with the three hand-off paths a calendar
  application understands: an add-by-URL link, a `webcal://` link the operating system routes, and the
  raw `https://` URL behind a "show link" disclosure;
- for the workspace feed, the same controls on a second tab, with the scope written out in the words
  the resolver actually implements - **every non-archived trip in this workspace, including trips you
  are not a collaborator on, minus the ones that ended more than 90 days ago** - placed above the
  enable control and tied to it with `aria-describedby`, so nobody issues a workspace link believing
  it carries only their own trips.
- **Rotate** and **Turn off**, each behind a `ConfirmDialog` that says what breaks — rotation kills
  every device already subscribed, and both are irreversible in the direction that matters.

**States.**

- _Empty_ — no feed yet: not an `EmptyState` illustration but the enable step itself, with the
  one-sentence warning above it, on `--color-surface-2`. The empty state of a security control should
  read like a decision, not like a missing thing.
- _Skeleton_ — the panel reads feed state after hydration, so a two-row `Skeleton` at the control's
  exact height holds the space; nothing reflows when the state lands.
- _Error_ — a failed issue or rotation renders an `Alert` on `--color-surface-2` with the reason and a
  retry; the previously shown link is **cleared** rather than left on screen, because a link that may
  or may not still work is worse than none.
- _Loading_ — every action carries `loading` and the others are `disabled` for that window, so a feed
  cannot be rotated and revoked in the same instant.

**Tokens.** None missing; the disclosed URL uses `--color-surface-inset` and a `--radius-md` well.
`serve_count` and the "last fetched" relative time carry `tabular-nums`.

### Quota

**This stage creates a countable row, and it is deliberately not metered.** A `calendar_feeds` row is
bounded by construction: one per person per trip, plus one per person per workspace, enforced by the
repository's find-or-issue path. A tenant cannot grow it independently of `trips` and `members`, both
of which are already metered — `trips` in `createTrip` (`src/server/repos/trips.ts:315`) and `members`
in `src/server/repos/members.ts:160` and `:276`.

So: no metric is added to `resolveLimits()` or `PLAN_QUOTAS`, no `assertQuota` call site is added, and
no case is added to `src/server/billing/__tests__/limits.test.ts`. Stated with its bound rather than
waved past: if a later stage let a person hold arbitrarily many feeds, that bound disappears and the
metric becomes necessary in the same change.

The one resource this stage does add is **outbound-free inbound traffic** on an unauthenticated
endpoint, and its ceiling is the per-minute KV counter described above rather than a plan metric,
because it protects the platform rather than selling anything.

### Tenant isolation test

Two files, for two different properties.

**Appended to `src/server/repos/__tests__/tenant-isolation.test.ts`** as one new `describe` block that
edits no existing block: in organization A's scope, issue a feed for **B's** trip id, and read, rotate,
revoke and touch **B's** feed by id. Every one is a `NotFoundError`, and afterwards B's feed rows are
byte-identical — including `token_digest` and `serve_count`. The mirror: A's own feed read back in B's
scope by id is a `NotFoundError`. A's `listFeeds` never returns a row of B's, even when both people
have a workspace feed.

**`src/server/repos/__tests__/calendar-feeds.test.ts` (new)** holds the unscoped resolver, because an
unscoped query deserves a test file that says so in its name: `findLiveFeedByDigest` returns null for
a revoked row, null for an expired row and null for an unknown digest; the row it returns carries no
trip content; the scope built from it has B's organization id when B's digest is presented and A's
when A's is, so the resolution cannot be steered by anything in the request; and issuing twice for the
same person and scope returns one row, which is the SQLite NULL-uniqueness case from **Data and
migration**.

Functions covered: `issueFeed`, `rotateFeed`, `revokeFeed`, `listFeeds`, `getFeed`, `touchFeed`,
`findLiveFeedByDigest`.

### Verification

**Command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`. Plus
`pnpm generate-routes` before the gate, because this stage adds a route file.

**Unit tests, by file and invariant.**

- `src/server/calendar/__tests__/ics.test.ts` (new) — a line longer than 75 octets folds at the octet
  and not at the character, and unfolding it with the existing reader in `src/server/queue/ics.ts`
  returns the original (round-trip against our own parser, which is the strongest cheap check
  available); commas, semicolons, backslashes and newlines are escaped in `SUMMARY` and `DESCRIPTION`;
  an all-day event emits `VALUE=DATE` and no time; the output contains no `VTIMEZONE` component.
- `src/server/calendar/__tests__/feed.test.ts` (new) — a 09:00 assignment in `Asia/Tokyo` emits
  `T000000Z`; the same assignment on a European daylight-saving transition day emits the offset that
  applies on that date rather than the one that applies today; a reservation with no date produces no
  event; the workspace feed excludes an archived trip and one that ended 91 days before the pinned
  day and includes one that ended 89 days before it; a workspace feed includes a trip whose owner has
  no `trip_members` row, which is the visibility rule argued in **Reference rows** rather than an
  accident; deleting the owner's `member` row makes the resolver answer with the same 404 body an
  unknown digest gets, and re-inserting that row makes the same URL serve again with no re-issue; a
  trip feed still serves after its owner's `trip_members` row is deleted; a UID is unchanged across a
  token rotation.
- `src/server/repos/__tests__/calendar-feeds.test.ts` (new) — as above.

**Browser evidence.** `describe` block `06-S5 — calendar subscription` in
`e2e/documents-and-media.visual.spec.ts`.

- Route: `/trips/$tripId/files`.
- Frame set: light and dark at **360px, 1280px and 2560px** at rest.
- **Declared non-resting states**, two: `--state feed-dialog` (the dialog open on the enable step,
  showing the warning, reached by `--click '[data-part="calendar-subscribe"]'`) and
  `--state feed-enabled` (the link revealed, with rotate and turn-off present, reached by a further
  `--click '[data-part="calendar-enable"]'`). Six frames each; both selectors are `data-part`
  attributes this stage ships and **both are verified against a running server with
  `page.locator(sel).count()` returning 1 before any frame is filed.**
- **The HTTP contract is verified as a contract, not as a picture**, in the same spec: a `request`
  fixture `GET`s the issued URL with no session and asserts `200`, `content-type: text/calendar`,
  the `no-store` and `noindex` headers, and a body beginning `BEGIN:VCALENDAR`; then rotates the feed
  and asserts the same URL now answers `404` with the identical body an unknown token gets. That
  second assertion is the whole security model, expressed once.

**Console must be silent**, asserted through `watchConsole` in every test in the block.

**No layout shift after paint**, measured after the settle mark across revealing the link — the
disclosure grows a block of monospace text, which is exactly the shape that shifts a panel. Gated on
`supportedEntryTypes`, with the WebKit skip stated as a skip.

### Definition of done

The six repository-wide items of `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test`
passes; the feature is visually verified in a real browser, light and dark, desktop and mobile; no
TODO, placeholder copy, `console.log` or commented-out code is left behind; and no file outside
**Owned paths** is touched.

The `docs/SPEC.md` §2 visual clauses, ticked for every surface this stage ships:

- [ ] Spacing on the 4px grid from `--space-*`, no eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states — the
      enable action, the three hand-off links, the disclosure, copy, rotate and turn off.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each on
      `--color-surface-2`.
- [ ] Motion 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured — the disclosure and the dialog.
- [ ] Full parity in light **and** dark, with dark shadows re-declared rather than reused.
- [ ] Responsive 360px → 2560px, where 360px is a designed layout: the URL wraps in a scrollable
      inset well with the copy action pinned, rather than pushing the dialog sideways.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes; the warning is associated with the enable control by `aria-describedby` so it is
      read before the action, not after it.
- [ ] Zero console errors or warnings, and zero layout shift after paint.
- [ ] `font-variant-numeric: tabular-nums` on the fetch count and the last-fetched time.

### Blockers

**One dependency on another plan, one on wave 0, and no package or binding.**

- **`07-S6` (`07-collaboration-and-sharing.md`, wave 2) must land first**, for `hashShareToken` and
  for the argued unscoped-resolver pattern this stage copies deliberately rather than re-deciding.
  That is what `DOC-07 → COL-10` means and it is why this stage is wave 3.
- **The `calendar_feeds` table is a wave-0 dependency**, stated above and executed by
  `00-foundations.md`.
- **`12-verification-protocol.md` §7.2 and §7.3** are inherited as `06-S1` records them.

No package outside the `docs/SPEC.md` §3 pinned set is needed: iCalendar is a text format and this
stage writes about two hundred lines of it; the zone arithmetic is `Intl`, which the Worker runtime
carries; the token is `nanoid`, already a dependency and already used for ids; the digest is Web
Crypto. No binding is required — `KV` and `DB` already exist.

---

## Stage 06-S6 — One boarding pass, several places it belongs

### Stage id

`06-S6` · Wave 4 · effort **M**. Wave 4 because `gap-rows.json` puts `DOC-04 → BKG-02`, and `BKG-02`
is wave 3 in `03-reservations-and-transport.md`: a reservation has to exist, and to have an editor,
before a file can be linked to one.

### Reference rows

- `DOC-04` partial → **done**, with **both** entry points. Many-to-many linking from a file to
  several places and several reservations, with the file's own note edited in the same place;
  reachable from the file side in the library, and from the booking side in the reservation editor.

**The booking-side entry point is this stage's, and an earlier draft got that wrong.** That draft
deferred it to `03-S4` (`03-reservations-and-transport.md`, wave 3, which closes `BKG-02`). `03-S4`
refuses it in writing, under its own **Reference rows**: attachments are "`DOC-04`'s, in
`06-documents-and-media.md` at wave 4", and that stage "adds no attachment UI and no attachment write,
and says so here so that nobody builds a second one". Two plans each pointing at the other is how a
row gets marked done with the behaviour planned nowhere, and it is the exact defect this file was
rejected for. It is settled here, once, in the direction the dependency already points: the
`DOC-04 → BKG-02` edge makes the reservation the **record** and this stage the **surface**, so the
surface is built here, on the editor `03-S4` will have finished one wave earlier. That is the whole
reason this stage is wave 4, and it is why the booking editor is an owned path below rather than a
sentence about somebody else's plan.

**One row names `DOC-04` in its `dependsOn`**, counted over `gap-rows.json`: `MAP-03`
(`02-places-and-maps.md`, wave 5), the place form, which attaches a file to a place through the join
this stage builds.

Sourced from `wiki: Documents-and-Files`.

### Owned paths

- `src/server/repos/files.ts` — edit. The link writers and the reverse read.
- `src/server/fns/files.ts` — edit. Two server functions.
- `src/components/modules/files/link-dialog.tsx` — new. The assign modal, including the note.
- `src/components/modules/files/entity-attachments.tsx` — new. The reverse view: the files already
  linked to one target, with attach and detach. It is a files-module component so that no attachment
  logic lands in the bookings module and no second implementation is written for the place form.
- `src/components/modules/files/file-dialogs.tsx` — edit. The details dialog hands the note to the
  link dialog instead of owning two copies of it.
- `src/components/modules/files/file-library.tsx` — edit. The row's link affordance and its count.
- `src/components/modules/files/index.ts` — append.
- `src/components/modules/book/booking-dialog.tsx` — edit. **The booking-side entry point.** One
  import and one mount: the attachments section, rendered only when the dialog is editing an existing
  booking. See **UI** for why creating cannot carry it.
- `src/components/modules/files/__tests__/link-dialog.test.tsx` — new.
- `src/components/modules/files/__tests__/entity-attachments.test.tsx` — new.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append.
- `e2e/documents-and-media.visual.spec.ts` — append.
- `e2e/__screenshots__/documents-and-media.visual.spec.ts/` — this stage's own baselines only.

**The loader is deliberately not extended, and the reason is a measurement.** The obvious shape for
the per-row link count is one more field on `loadTripFiles` in `src/routes/_app/-server/trip.ts`.
That file is claimed at **wave 4** by `05-S3` (`05-packing-and-todos.md`), and two stages taking one
file exclusively in the same wave clobber each other — `node scripts/ultrabuild/check-plan-collisions.mjs 06`
reported exactly that pair before this stage was re-shaped. So the counts come from this stage's own
server function instead (below), which is a second request on a screen that already makes several and
costs one indexed query. The alternative — asking `05-S3` to carry a field it has no use for — moves
the coupling rather than removing it.

**Cross-wave sharing, named with sibling stage ids.** `src/server/fns/files.ts` is held by `00-S3`
(`00-foundations.md`, wave 0), `06-S1` (wave 1) and `06-S2` (wave 2); `src/server/repos/files.ts` by
`06-S2` (wave 2); `src/components/modules/files/file-library.tsx` by `06-S1`, `06-S2` and `06-S4` in
waves 1 to 3. Every one is an earlier wave in this file or in foundations, and this stage is the only
wave-4 stage in this file, so no same-wave claim of any kind remains.

`src/components/modules/book/booking-dialog.tsx` is the one path this stage takes outside its own
area, and it is named with both its siblings: **`03-S4`** (`03-reservations-and-transport.md`,
**wave 3**, the stop picker and the ledger notice) and **`03-S8`** (same plan, **wave 6**, the stay
branch). Three claims, three different waves — 3, 4, 6 — so this is a legal cross-wave path and not a
clobber, which `node scripts/ultrabuild/check-plan-collisions.mjs 06` reports under its own heading
and which is transcribed under **Cross-plan collisions** at the end of this file. The claim is kept as
narrow as a claim can be: one import, one conditional mount, no change to the booking draft, no change
to `booking-form.ts`, and nothing at all in `src/components/modules/book/index.ts`, which `03-S4`,
`03-S7` and `03-S8` all hold.

None of the six shared paths is claimed, and no route file is added — `pnpm generate-routes` does not
run.

### Data and migration

**One new table is required and it belongs to `00-foundations.md`**, together with a backfill this
stage specifies precisely.

`trip_file_links`:

| Column            | Type                                         | Null     | Meaning                                                                                 |
| ----------------- | -------------------------------------------- | -------- | --------------------------------------------------------------------------------------- |
| `id`              | `pk()`                                       | not null | `newId()`.                                                                              |
| `organization_id` | `orgRef()`                                   | not null | Leading column of every index.                                                          |
| `file_id`         | `text` → `trip_files.id` `on delete cascade` | not null | The file.                                                                               |
| `target_type`     | `text`                                       | not null | `place`, `reservation`, `transport`, `expense`, with `trip_file_links_target_type_chk`. |
| `target_id`       | `text`                                       | not null | The row it is attached to.                                                              |
| `created_at`      | `timestamps()`                               | not null | House convention.                                                                       |

Indexes: `trip_file_links_unq` unique on `(organization_id, file_id, target_type, target_id)` — the
"link it twice" case, resolved by the database rather than by a read-then-write race;
`trip_file_links_org_target_idx` on `(organization_id, target_type, target_id)` for the reverse read.

**No foreign key on `target_id`**, because four different tables can be the target and SQLite cannot
express that. The referential rule is enforced where the rest of them are: the repository resolves the
target inside the tenant scope before it writes, so a link to a row that does not exist, or belongs to
another tenant, is a `NotFoundError`. Cascade on the target side is handled by the same sweep the
repository does when a target is deleted — stated as a requirement for whichever stage deletes each
target type, and, for the file side, covered by the `on delete cascade` above.

**Additive only, and the four existing columns are kept.** `trip_files.place_id`, `reservation_id`,
`transport_id` and `expense_id` (`schema.ts:995-1000`) are **not dropped, not renamed and not
narrowed** in this stage. They stop being written and start being ignored by every read; dropping them
belongs to a later stage, after a release in which nothing writes them, because `ARCHITECTURE.md` §9
requires a rollback to keep working against the new schema — and a rolled-back Worker reads exactly
those four columns.

**Backfill, executed in the migration**: one `INSERT ... SELECT` per column, copying every non-null
`place_id`, `reservation_id`, `transport_id` and `expense_id` into a `trip_file_links` row with the
matching `target_type` and the file's own `organization_id`. It is idempotent under the unique index.
The demo fixture writes some of those columns, so the backfill is exercised the first time anybody
re-seeds rather than being a statement nobody runs.

**Retention.** No bytes. A link row is ~80 bytes, is bounded by the per-file cap below, and dies with
its file.

### Server (repo, server function, Zod)

**Repository — `src/server/repos/files.ts` (edit).** All SQL here, every query on `tenantFilter()`.

- `setFileLinks(scope, fileId, targets)` — the whole set for one file, replaced in one `db.batch()`
  so a partial application cannot survive a failure (D1 runs a batch as a transaction and rolls the
  whole sequence back on error). It resolves the file in scope, resolves **every** target in scope
  before it writes anything, deletes the file's existing rows and inserts the new set.
- `listFileLinks(scope, fileId)` and `listFileLinksForFiles(scope, fileIds)` — the second one exists
  so the files loader reads every file's links in one query instead of one per row; a list screen that
  issues a query per row is how a D1 bill stops being a rounding error.
- `listFilesForEntity(scope, entity)` — **rewritten over the join** and keeping its signature, so its
  existing (unreached) callers and `BKG-02`'s future one need no change. It also gains
  `isNull(tripFiles.deletedAt)` so a trashed file does not surface on a reservation, which is the rule
  `06-S2` set.
- `updateFile` keeps the four legacy columns in its input type for one release and ignores them; its
  docblock says why and names the stage that will remove them.

**The per-file cap, and why it is not a plan metric.** A file may hold at most 50 links, enforced in
`setFileLinks` with a `RepositoryError('…', 'TOO_MANY_LINKS')`. It is a structural bound rather than
something we sell: a per-plan ceiling on join rows would be a number we would have to publish, price
and explain, for a row whose only purpose is to make one file findable from a second screen. The cap
exists so that a scripted client cannot turn one file into ten thousand rows.

**Server functions — `src/server/fns/files.ts` (edit).**

| Function                    | Method | Input                                                      | Returns                                                                                 |
| --------------------------- | ------ | ---------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `setTripFileLinksFn`        | POST   | `{ tripId, fileId, targets: [{ type, id }], description }` | `{ links: number }`                                                                     |
| `listTripFileLinksFn`       | GET    | `{ tripId }`                                               | every file's links on this trip, in one read                                            |
| `listTripFileAttachmentsFn` | GET    | `{ tripId, target: { type, id } }`                         | `{ attached: [file + its whole link set], available: [id, filename, kind, sizeBytes] }` |

`listTripFileLinksFn` is one call for the whole screen, built on `listFileLinksForFiles`, and it is
what the library reads on mount to fill the per-row count. One indexed query per screen rather than
one per row, and the loader stays somebody else's.

`listTripFileAttachmentsFn` is the **booking side's** read and the reason `DOC-04` can be called done
in one stage rather than in two plans that each expect the other to finish it. It composes three reads
that already exist or are defined above — `listFilesForEntity` for the attached set,
`listFileLinksForFiles` for those files' whole link sets, and `listTripFiles`
(`src/server/repos/files.ts:67-80`) for the rest of the trip's files — and returns them in one
response, so the reservation editor can render both the attached list and the attach picker without a
second round trip. It adds **no repository function**: it is composition in the handler over SQL that
lives where all of it lives.

**Why the attached files come back carrying their whole link set, which looks like overreach and is
not.** Detaching a file from a booking is, in the data model, "this file's link set minus one target",
and the only writer is `setTripFileLinksFn`, which takes the whole set. Returning each attached file's
existing links with the read is what lets the booking side compute that set locally and send one
request. The alternative — a second, narrower writer that removes a single link — would be a second
write path onto the same table, and the two would disagree about the 50-link cap and the note the
first time either changed. One writer, two readers.

The `available` list carries **only** `id`, `filename`, `kind` and `sizeBytes`, never link sets and
never descriptions: it feeds a searchable picker, it is bounded by the `files` quota rather than by
anything a client chooses, and a picker does not need the rows it is not showing.

The note travels with the links because it is edited in the same dialog, so saving the dialog is one
request and one optimistic update rather than two that can half-fail. Both mirror to the trip room
with the existing `filesChangedAt` patch; no new patch kind is declared and
`src/server/do/protocol.ts` is not touched.

**Zod (v4 idiom).** `z.strictObject()` with the `error` parameter; `targets` as
`z.array(z.strictObject({ type: z.enum(['place','reservation','transport','expense']), id: idSchema })).max(50)`;
the note as the existing bounded long text. Validation is shape: a well-formed target id is not an
authorised target id, which is why every one of them is resolved in scope before a row is written.

**Authorisation** is decided in the handler and the repository: `appScope()`, `requireTrip()`, then
per-target resolution inside the scope. Nothing is enqueued; the batch is a handful of rows.

### UI (route, components)

**Route.** None added and none edited, so `pnpm generate-routes` does not run and
`src/routeTree.gen.ts` is untouched.

**Components.** Existing primitives: `Dialog`, `Checkbox`, `Textarea`, `Field`, `Badge`, `Chip`,
`Button`, `IconButton`, `EmptyState`, `Skeleton`, `Alert`, `ScrollArea`, `toast`, plus `ModulePanel`
and `useAction` from `src/components/modules/shared`. Two new product components, `link-dialog.tsx`
and `entity-attachments.tsx`. No new primitive.

**The dialog** lists the trip's places and reservations in two labelled groups, each row a `Checkbox`
with the name and its date or address as secondary text, a search field when either group exceeds a
dozen rows, and the file's note in a `Textarea` underneath. One Save. The file row in the library
grows a link affordance showing the current count as a `Badge`, and the count is the same number the
dialog will open with — a badge that disagrees with what opens is worse than no badge.

**The booking side, which is the entry point this stage stopped deferring.**
`entity-attachments.tsx` takes a `target` (`{ type, id }`) and a `tripId` and renders the files linked
to that one row: a compact list of file chips carrying the filename, the kind and the size, each with
a download action and a detach action, under a section label, plus an **Attach a file** control that
opens a searchable picker over the trip's other files. Detaching sends that file's link set minus this
target; attaching sends its set plus this target. Both go through `setTripFileLinksFn`, so the file
side and the booking side can never disagree about what is linked.

`src/components/modules/book/booking-dialog.tsx` mounts it in exactly one place, and the mount is
conditional in a way the data forces rather than a way we chose: the dialog's props are
`booking?: BookingRow` (`booking-dialog.tsx:118`), and the create path has no `booking`, so there is no
row id for a link to point at until the booking has been saved. So **the section renders only when the
dialog is editing an existing booking**, and on the create path it renders nothing at all — not a
disabled shell, not a greyed panel, and above all not a control that writes a link into the void. The
one sentence a reader gets on the create path is on the save confirmation: the newly saved booking's
editor is where files are attached, which is the affordance they now have.

No other bookings-module file changes: `booking-form.ts` does not learn about attachments, the draft
does not carry them, and saving the booking neither reads nor writes a link. The section owns its own
read and its own writes. That is what keeps this a one-import claim on a file two stages of
`03-reservations-and-transport.md` also hold.

**States.**

- _Empty_ — a trip with no places and no reservations gets an `EmptyState` inside the dialog on
  `--color-surface-2` explaining what a link is for and pointing at the plan screen, rather than an
  empty checklist that looks broken.
- _Skeleton_ — the dialog's lists come from the loader payload and are already present when it opens,
  so the only skeleton is the link count on each row while `listTripFileLinksFn` is in flight, which
  uses the existing `Skeleton` at the badge's exact size so the row cannot change height when the
  counts land.
- _Error_ — a save that fails renders an `Alert` inside the dialog with the reason, keeps every
  checkbox as the reader left it, and keeps the dialog open. A refusal that discards a half-made
  selection is a worse bug than the refusal.
- _Loading_ — Save carries `loading`; the checkboxes and the note are `disabled` for that window.

**The booking-side section carries the same four states in its own shapes**, because it is a list and
the quality bar does not exempt a list for being small:

- _Empty_ — a booking with nothing attached shows an `EmptyState` on `--color-surface-2` saying what
  an attachment is for on a booking — the confirmation, the ticket, the receipt — with the attach
  control as its action, rather than an empty box under a heading.
- _Skeleton_ — `listTripFileAttachmentsFn` is fetched when the editor opens, and the section shows two
  `Skeleton` chips at the exact height of a real chip, so the dialog does not grow under the reader's
  cursor when the answer lands.
- _Error_ — a failed read renders an `Alert` inside the section with a retry, and the rest of the
  booking editor stays fully usable: a file list that cannot load must not take the booking form down
  with it. A failed attach or detach puts the chip back exactly as it was and says why.
- _Loading_ — the attach control carries `loading` while a write is in flight, and the chip being
  detached is `disabled` rather than removed until the server agrees, so a refusal does not have to
  resurrect a row the reader watched disappear.

**Tokens.** None missing. The link count and every file size carry `tabular-nums`.

### Quota

**This stage creates a countable row that is deliberately not metered**, and the reasoning is the
paragraph above: a link is bounded per file by a repository cap, and the file itself is already
metered by `files` and `storage_bytes` in `recordFile`
(`src/server/repos/files.ts:170-171`). Nothing is added to `resolveLimits()` or `PLAN_QUOTAS`, and no
case is added to `src/server/billing/__tests__/limits.test.ts`.

No R2 object is written or deleted by this stage, so the object-first ordering does not arise here; it
is unchanged where it lives, in `06-S1`'s upload path and `06-S2`'s purge path.

### Tenant isolation test

Appended as one new `describe` block that edits no existing block.

In organization A's scope, against organization B's rows: set links on B's file by id; link A's own
file to **B's** place, B's reservation, B's transport and B's expense, one per call; list links for
B's file; and call `listFilesForEntity` with B's reservation id. Every one is a `NotFoundError`, and
afterwards B's link rows and B's file rows are byte-identical. The mirror: a link A creates on its own
file is invisible to B's `listFilesForEntity` for a target id that happens to collide across tenants —
which is the case the unique index on `(organization_id, file_id, target_type, target_id)` makes
possible to test honestly, because `target_id` has no foreign key to narrow it.

Functions covered: `setFileLinks`, `listFileLinks`, `listFileLinksForFiles`, `listFilesForEntity`.
`listTripFileLinksFn` and `listTripFileAttachmentsFn` are covered on the server-function side by the
same block, each asked for B's trip id in A's scope, which is a `NotFoundError` from `requireTrip`
before a link is ever read. `listTripFileAttachmentsFn` gets one case of its own beyond that, because
its `available` list is the widest thing this stage returns: asked in A's scope for A's own trip but
with **B's reservation id** as the target, it must answer `NotFoundError` from the target resolution
and must not fall back to returning A's file list with an empty `attached` set — a read that degrades
into "here is everything, nothing is linked" is how a tenant boundary turns into a directory
listing.

### Verification

**Command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**Unit tests, by file and invariant.**

- `src/components/modules/files/__tests__/link-dialog.test.tsx` (new) — toggling a row and saving
  sends exactly the resulting set, not a diff; the note travels in the same request; the 50-link cap
  disables further checkboxes with a stated reason rather than failing on save; the search narrows
  both groups and keeps checked rows visible.
- `src/components/modules/files/__tests__/entity-attachments.test.tsx` (new) — detaching a file sends
  that file's whole link set **minus** this target and leaves its other targets intact, which is the
  invariant that stops the booking side quietly unlinking a file from a place; attaching sends the set
  plus this target; a failed detach restores the chip and shows the reason; the picker excludes files
  already attached, so the same file cannot be attached twice; the empty state renders its action
  rather than a bare heading; and the component renders nothing when given no target, which is the
  create path of the booking editor.
- `src/server/repos/__tests__/tenant-isolation.test.ts` (append) — the cases above.
- The backfill is asserted in the repository tests the wave-0 migration stage owns: after it, a file
  that had `reservation_id` set has exactly one link row of type `reservation`, and a file with all
  four columns set has four.

**Browser evidence.** `describe` block `06-S6 — file links` in
`e2e/documents-and-media.visual.spec.ts`.

**Two routes, because this stage ships two entry points and a stage that photographs one of them has
photographed half of itself.**

- Route: `/trips/$tripId/files`. Frame set: light and dark at **360px, 1280px and 2560px** at rest,
  with at least one file already linked so the badge is visible. The seeded fixture supplies that
  without any setup: `src/routes/api/dev/-seed/dataset/flagship.ts:2482` onwards writes files carrying
  `reservationKey` and `transportKey`, and the wave-0 backfill turns exactly those columns into link
  rows, so the demo trip opens with linked files on the first run after the migration.
- **Declared non-resting state**: `--state link-dialog` — the dialog open with two rows checked —
  reached by `--click '[data-part="file-link-open"]'`.
- Route: `/trips/$tripId/book`, the booking side. Frame set: light and dark at **360px, 1280px and
  2560px** with the editor open on a **seeded reservation that already has a file linked to it**
  (`res-gracery` in the same dataset), so the attachments section is photographed populated rather
  than empty, and a second frame set with `--state attach-picker` — the picker open over the trip's
  other files. Reached by `--click '[data-part="booking-edit"]'` then
  `--click '[data-part="file-attach-open"]'`.
- The 360px booking frame is called out: a dialog that already carries a form gaining a file list is
  exactly where a small screen turns into a scroll tunnel, and the frame is what proves it did not.
- Every `data-part` named here is an attribute this stage ships, and **each is verified against a
  running server with `page.locator(sel).count()` returning 1 before any frame is filed.**
- The error frames — one per side — are reached with `page.route()` failing the write, so the
  in-dialog `Alert` with its preserved selection, and the restored chip on the booking side, are both
  photographed from a real failure rather than from a mocked-up component.

**Console must be silent**, asserted through `watchConsole` in every test in the block.

**No layout shift after paint**, measured after the settle mark across opening the dialog and toggling
a row — the badge count changing in the row behind the dialog is the shift to watch. Gated on
`supportedEntryTypes`, with the WebKit skip stated as a skip.

### Definition of done

The six repository-wide items of `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test`
passes; the feature is visually verified in a real browser, light and dark, desktop and mobile; no
TODO, placeholder copy, `console.log` or commented-out code is left behind; and no file outside
**Owned paths** is touched.

The `docs/SPEC.md` §2 visual clauses, ticked for every surface this stage ships:

- [ ] Spacing on the 4px grid from `--space-*`, no eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states — every
      checkbox row, the search field, the note and Save.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each on
      `--color-surface-2`.
- [ ] Motion 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured.
- [ ] Full parity in light **and** dark, with dark shadows re-declared rather than reused.
- [ ] Responsive 360px → 2560px, where 360px is a designed layout: the dialog becomes a full-height
      sheet with a sticky Save, rather than a desktop dialog with a scrollbar.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names — each checkbox names the
      place or booking it links to, not just "link", and each detach control names the file it
      detaches — WCAG 2.2 AA contrast in both themes.
- [ ] Both entry points meet every clause above, not just the one on the files screen: the booking
      editor's attachments section is checked at all three widths, in both themes, with its empty,
      skeleton, error and loading states, because it is the entry point this stage exists to stop
      deferring.
- [ ] Zero console errors or warnings, and zero layout shift after paint.
- [ ] `font-variant-numeric: tabular-nums` on the link count.

### Blockers

**Two dependencies, no package and no binding.**

- **`03-S4` (`03-reservations-and-transport.md`, wave 3, closing `BKG-02`)** must land first, for two
  reasons that are now the same reason. Linking to a reservation needs reservations that can be
  created and edited — that is the `DOC-04 → BKG-02` edge, and `03-S4` cites the same cut from its own
  side, so the two plans agree about which is the record and which is the surface. And this stage
  mounts its attachments section into `src/components/modules/book/booking-dialog.tsx`, which `03-S4`
  edits in wave 3, so this stage starts from that landed edit rather than from HEAD. It is why this
  stage is wave 4, and why its claim on that file is one import and one conditional mount and nothing
  else. `03-S8` holds the same file in wave 6 and starts from **this** stage's edit in turn; the three
  waves are 3, 4 and 6, and none of them runs beside another.
- **The `trip_file_links` table and its backfill are a wave-0 dependency**, stated above and executed
  by `00-foundations.md`.
- **`12-verification-protocol.md` §7.2 and §7.3** are inherited as `06-S1` records them.

No package outside the `docs/SPEC.md` §3 pinned set is needed: one join table, one batched write and
one dialog.

---

## Stage 06-S7 — Per-day weather: BLOCKED

### Stage id

`06-S7` · Wave 6 · effort **S**. **BLOCKED.** The effort is for the record this stage ships, not for
the feature — `gap-rows.json` scores `DOC-08` at `L`, and none of that work can start until the
decision below is taken. A blocked stage carrying a large effort roll-up is a stage somebody
schedules.

### Reference rows

- `DOC-08` absent → **absent**, and the reason it does not move is this stage's whole content.

Sourced from `wiki: Weather-Forecasts` for the behaviours: a compact badge on each day row, a fuller
panel with minimum and maximum temperature, precipitation probability and amount, wind, sunrise and
sunset and a coarse hourly strip; a source that changes with how far away the day is; and a visible
marker distinguishing an estimate from a forecast.

**What is deferred, and to where: all of it, to a re-planned `06-S7` in the wave after the block is
lifted.** No part is picked off early, because the cheap halves are the expensive kind. A badge with
no source switching shows a blank square for every day beyond the forecast window, which is most of
the days on most trips at the moment somebody plans them; and a climate estimate rendered without its
marker is a forecast we invented, which is worse than no weather at all.

**Nothing is scheduled behind this stage, and that is measured rather than hoped.** No row in
`gap-rows.json` names `DOC-08` in its `dependsOn`. The one edge that touched it, `TRP-06 → DOC-08`,
was cut in round 3 and the surviving edge points the other way — `DOC-08 → TRP-06`, recorded in
`.claude/ultrabuild/recon/gap-cuts.json` with the reason "the planner workspace is the host surface;
the per-day weather badge is placed into it". So this stage slipping delays this row and no other, and
`README.md`'s wave table puts it alone in wave 6 for exactly that reason.

### Owned paths

**None.** This stage creates and edits no repository file. Its output is the decision recorded here
and the two constraints below, so that no other stage in this plan — or in `01-trips-core.md`, which
owns the planner surface the badge would sit on — invents a weather mechanism on the way past.

Recording the shape without claiming the files is deliberate: a blocked stage that reserved
`plan-screen.tsx` or a settings module would be a stage holding paths hostage across three waves for
work nobody can start.

### Data and migration

**No schema change, and it would be premature by an argument this plan set has already made.**
`11-S3` states the sequence — decision, then column, then feature — because what a provider licenses
us to **retain**, and for how long, differs between providers and is usually the binding term. A
`day_weather` table designed against a provider we have not chosen is a table whose TTL column may be
illegal the day the contract is signed.

`journey_entries.weather` and `temperature_celsius` already exist and are **not** this row: they store
what a traveller wrote about a day they lived, not what a service predicts about a day they have not.
Nothing is filed for a wave-0 foundations schema stage.

**The caching shape it would need, stated now because it is the part that decides the bill, and
because getting it wrong is how a metered provider becomes an unmetered cost.** The cache is `KV`,
which already exists as a binding — no new binding is asked for:

| What             | Shape                                                                                                                                                                                               |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Key              | `wx:<kind>:<lat>:<lng>:<date>`, where `<kind>` is `forecast`, `archive` or `climate`, and the two coordinates are rounded to four decimal places (about 11 m).                                      |
| Value            | The normalised reading **in metric units only**, plus `fetchedAt` and the `kind` that produced it.                                                                                                  |
| TTL — `forecast` | **1 hour**, for a day from yesterday to sixteen days out.                                                                                                                                           |
| TTL — `archive`  | **24 hours**, for a day more than one day in the past. Recorded history does not change.                                                                                                            |
| TTL — `climate`  | **24 hours**, for a day beyond the forecast window, derived from the same calendar date a year earlier.                                                                                             |
| Miss behaviour   | A miss is a miss, never an error: a malformed or stale-shaped entry is discarded and re-fetched, the shape `src/server/billing/entitlements.ts:110-136` already establishes for KV in this product. |

Three properties of that shape, each with its reason:

- **The key contains no tenant data.** A forecast for a latitude, a longitude and a date is a public
  fact, so one tenant's fetch legitimately answers another's — which is the rule `11-S3` states, and
  the same rule forbids a key containing a trip id, a place id or a member id.
- **Units are not in the key.** The reference caches per unit system, which doubles every entry and
  serves a stale value in the wrong unit the moment somebody changes the setting. We store metric and
  convert at render, so switching between Celsius and Fahrenheit costs no request and can never show a
  number in the other one.
- **The badge never fetches on the request path when the cache can answer**, and a whole trip's days
  are resolved in one batched read rather than one call per row — `ARCHITECTURE.md` §4 owns the
  caching layer and `11-S3` restates it for provider calls specifically. A per-day fetch on a
  fourteen-day trip is fourteen outbound calls per page view, which is precisely the pattern that
  turns a free tier into a licence problem and a paid one into a bill.

The per-reader unit preference would live beside the other display preferences in
`src/lib/display-preferences.ts`, which `09-S8` (`09-account-and-settings.md`, wave 3) creates.
**No column is filed for it now**, for the same decision-then-column reason: whether wind is coupled
to the temperature unit, and what the default is, are product decisions that ride with the provider.

### Server (repo, server function, Zod)

**Nothing is added.** No repository module, no `createServerFn`, no schema, no queue kind.

Four constraints are recorded because they bind whoever builds it, and each is a decision this plan
set has already taken somewhere else:

1. **The provider credential is a secret**, set with `wrangler secret put` and read from the task or
   request environment — never a checked-in variable, and never a value a tenant supplies. A
   per-tenant third-party credential is the shape that made `BKG-09` out-of-scope in `11-S1`.
2. **The outbound call is metered by somebody**, so its rate belongs in `resolveLimits()` like every
   other ceiling rather than in a constant inside a weather module. The published number is the
   enforced number applies to a provider call as much as to a row.
3. **The read is a server function, never a browser fetch to the provider.** A key in a client bundle
   is a key that has left the building, and a browser-side call would also bypass the cache that makes
   the feature affordable.
4. **A missing reading renders as missing**, never as an invented number and never as a zero. The
   product has one precedent for this and it is deliberate: `04-S1` refuses to write an expense with
   an unavailable rate rather than guessing one.

### UI (route, components)

**No route and no component.** Two design consequences are stated so that whoever builds it does not
re-derive them, and so that no other stage designs around a weather badge that does not exist:

- **The estimate marker is not decoration.** A climate estimate and a forecast look identical as a
  number and an icon, so the estimate carries a visible marker and an accessible name that says which
  it is. A reader who packs for an estimate believing it is a forecast has been misled by our
  typography.
- **The day row must not reflow when weather arrives.** Whatever the badge's final design, its box is
  reserved at the row's existing height so a late reading cannot shift the itinerary under a reader's
  cursor — `docs/SPEC.md` §2's zero-layout-shift clause, applied to the one surface in this file that
  would populate after paint.

**Tokens.** None needed today. Worth recording for whoever unblocks this: the condition palette must
come from the existing semantic tokens (`--color-info`, `--color-warning`, `--color-danger` and their
`-soft` companions) rather than from a set of weather colours, because a new colour ramp is a token
change and `src/styles/tokens.css` is a shared path.

### Quota

**No countable row.** This stage writes nothing: no metric, no `assertQuota` call site, no addition to
`resolveLimits()`, `PLAN_QUOTAS` or `src/server/billing/__tests__/limits.test.ts`.

The quota note that survives the block is constraint 2 above: when a provider is adopted, the call
rate is a ceiling like any other, because a metered outbound call made on one tenant's behalf is a
cost every other tenant pays for.

### Tenant isolation test

**No case is appended to `src/server/repos/__tests__/tenant-isolation.test.ts`**, because this stage
adds no repository function and writes no row.

One isolation rule is recorded for whoever unblocks it, and it is the one a cache makes easy to get
wrong: a cached provider result keyed only by its query is shared across tenants, which is correct for
a public fact; anything derived from a tenant's own rows is tenant data and must be scoped like tenant
data. The key shape above contains a coordinate and a date and nothing else, and the test that will
matter is the one asserting a key derived from a trip cannot be constructed by the module.

### Verification

**How this would be run, when it is.** `docs/plans/12-verification-protocol.md` owns the procedure and
is cited here to say what this stage does not owe, rather than to leave the heading empty. A blocked
stage quoting a command it never runs is a stage that looks verified.

**The command gate still applies and is trivially satisfied:** `pnpm lint`, `pnpm typecheck`,
`pnpm test`, `pnpm build`, all unchanged because no source file is touched.

**No Playwright invocation is owed.** This stage ships no surface and appends no `test.describe`
block to `e2e/documents-and-media.visual.spec.ts`, so there is nothing to point a project at.

**No unit tests**, because there is no new logic.

**No browser evidence, and that is a claim rather than a gap.** A frame filed under this stage id
would be a frame of somebody else's work. When the block is lifted, the re-planned stage owes the full
set — light and dark at 360px, 1280px and 2560px, on the planner surface, plus a declared non-resting
state for the fuller panel and a declared state for the estimate marker, which is the one thing a
resting frame of a near-term trip would never show.

**Console and layout shift** are not asserted here for the same reason: no surface, no assertion.

### Definition of done

The six repository-wide items of `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm lint`
and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test` passes; the
feature is verified in a real browser, light and dark, desktop and mobile; nothing is left behind — no
TODO, no placeholder copy, no `console.log`, no commented-out code; and no file outside **Owned
paths** is touched, which for this stage is every file in the repository.

The `docs/SPEC.md` §2 visual clauses are listed unchanged and every one is ticked as **not applicable:
this stage ships no surface** — the honest reading for a stage whose output is a decision:

- [ ] Spacing on the 4px grid — not applicable, no surface.
- [ ] Hover, focus-visible, active, disabled and loading states — not applicable, no surface.
- [ ] Empty, skeleton and error states on `--color-surface-2` — not applicable, no surface.
- [ ] Motion 150–260ms on `--ease-out-quint`, `prefers-reduced-motion` honoured — not applicable.
- [ ] Light and dark parity with re-declared dark shadows — not applicable.
- [ ] Responsive 360px → 2560px — not applicable.
- [ ] Keyboard navigable, accessible names, WCAG 2.2 AA — not applicable.
- [ ] Zero console errors and zero layout shift — not applicable.

This stage is done only if the decision below is left **open with its constraint stated**, and is not
silently resolved by naming a provider. Choosing one here would be the worst outcome available: a plan
is not where a commercial commitment gets made.

### Blockers

**One, and it is a commercial decision rather than an engineering one.**

- **No weather provider is chosen, and none may be chosen here.**
  `docs/plans/11-boundaries-and-blockers.md` (`11-S3`, "The provider decisions, all three open")
  records weather as the second of three open capabilities and lists `DOC-08` in its own table as
  waiting on it. The binding constraint is stated there and is restated here because it is the whole
  reason this stage is blocked rather than merely unscheduled: **a tier whose terms exclude a
  commercial, subscription-funded product is unusable to us at any traffic level.** We charge for
  subscriptions through Stripe, so a "free for non-commercial use" endpoint — the shape that makes a
  self-hosted build's "no key required" weather possible — is a licence breach dressed as a saving,
  however small our volume.
  Two further terms decide the cost more than the per-call price does, and both have to be read at the
  same time: **what we may cache and for how long**, which the TTL table above depends on entirely,
  and **what attribution is required on screen**, which is a design constraint on a badge that has not
  been designed.
  Disposition: **defer.** This stage writes no client for an unnamed service, assumes no free tier,
  and ships nothing degraded in order to avoid asking.

- **No binding is missing.** Unlike `DOC-06`'s rendering and `ADD-08`'s image work, this row needs no
  new Cloudflare binding: `KV` for the cache and outbound `fetch` are both already available. The only
  thing missing is the answer to a question only the user can answer.

No package outside the `docs/SPEC.md` §3 pinned set would be needed either — the call is `fetch`, the
cache is `KV`, and the formatting is `Intl`. The freeze is not what blocks this row.

---

## Cross-plan collisions

Two stages in the same wave that both take an exclusive disposition on one file clobber each other,
because the runs that execute them go in parallel. That judgement is not made by reading the sibling
plans — round 8 produced two real collisions that way, with every plan carrying an acceptance
criterion about it — it is measured:

```sh
node scripts/ultrabuild/check-plan-collisions.mjs 06
node scripts/ultrabuild/check-plan-refs.mjs 06
```

The second one is here for the same reason as the first: a stage id cited in prose is a claim about a
sibling plan, and a `NN-Sn` token that no `## Stage` heading defines is a dangling reference that
reads exactly like a real one. Both outputs are pasted verbatim.

```
plans 13 · stages 91 · owned paths 543

4 stage(s) state no parseable wave and cannot be checked: 11-S1 11-S2 11-S3 04-S2

no same-wave exclusive collisions

touched by more than one plan in different waves (3) — legal; each plan must name the other:
  src/server/fns/files.ts
      00-foundations.md  00-S3  wave 0  (edit)
      06-documents-and-media.md  06-S1  wave 1  (edit)
      06-documents-and-media.md  06-S2  wave 2  (edit)
      06-documents-and-media.md  06-S6  wave 4  (edit)
  src/server/repos/index.ts
      01-trips-core.md  01-S6  wave 4  (edit)
      06-documents-and-media.md  06-S3  wave 2  (append)
      06-documents-and-media.md  06-S5  wave 3  (append)
      07-collaboration-and-sharing.md  07-S10  wave 5  (edit)
  src/components/modules/book/booking-dialog.tsx
      03-reservations-and-transport.md  03-S4  wave 3  (edit)
      03-reservations-and-transport.md  03-S8  wave 6  (edit)
      06-documents-and-media.md  06-S6  wave 4  (edit)
```

```
plan 06: 0 dangling stage reference(s), 0 plan(s) missing a Playwright invocation
```

**No same-wave exclusive collision involves this plan**, which is the line that gates it. **Zero
dangling stage references**, which is the line that gates every `03-S4`, `05-S3`, `08-S7`, `11-S1`
and `02-S11` this file cites at a sibling.

**All three cross-wave paths are named in the stage that owns them**, as required:

| Path                                             | This plan's claims                       | The sibling claims, named where                                                                                                                                                                        |
| ------------------------------------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/server/fns/files.ts`                        | `06-S1` w1, `06-S2` w2, `06-S6` w4       | `00-S3` (`00-foundations.md`, wave 0, the audit trail) — named under **Owned paths** in all three of `06-S1`, `06-S2` and `06-S6`.                                                                     |
| `src/server/repos/index.ts`                      | `06-S3` w2 (append), `06-S5` w3 (append) | `01-S6` (`01-trips-core.md`, wave 4) and `07-S10` (`07-collaboration-and-sharing.md`, wave 5) — named under **Owned paths** in `06-S3` and `06-S5`.                                                    |
| `src/components/modules/book/booking-dialog.tsx` | `06-S6` w4                               | `03-S4` (`03-reservations-and-transport.md`, wave 3, the stop picker) and `03-S8` (same plan, wave 6, the stay branch) — named under **Owned paths** in `06-S6`, with the reason it is claimed at all. |

**The third row is new, and it is the repair of a defect rather than an extension of scope.** `06-S6`
used to defer the booking-side attachment picker to `03-S4`, and `03-S4` refuses it in writing. The
behaviour was therefore planned in neither plan while `DOC-04` was marked done in this one. Taking one
narrow, correctly-waved claim on the booking editor is what makes the row honest; leaving the claim
out and marking the row done was the finding.

**One collision existed and was removed rather than argued away.** An earlier draft of `06-S6`
extended `loadTripFiles` in `src/routes/_app/-server/trip.ts`, and the check reported it against
`05-S3` (`05-packing-and-todos.md`), which claims the same file in the same wave 4. The stage now
reads its link counts through its own server function; the reasoning is under `06-S6`'s **Owned
paths** rather than here, because that is where an agent executing the stage will read it.

**Every stage in this file states its wave in the form the script parses**, so none of them is
invisible to the check:

| Stage   | Wave | Effort | Row                |
| ------- | ---- | ------ | ------------------ |
| `06-S1` | 1    | M      | `DOC-01`           |
| `06-S2` | 2    | M      | `DOC-03`           |
| `06-S3` | 2    | M      | `DOC-06`           |
| `06-S4` | 3    | M      | `DOC-02`           |
| `06-S5` | 3    | L      | `DOC-07`           |
| `06-S6` | 4    | M      | `DOC-04`           |
| `06-S7` | 6    | S      | `DOC-08` (blocked) |

**The four stages the report says have no parseable wave are not in this file.** `11-S1`, `11-S2` and
`11-S3` belong to the register plan, which writes its wave in prose rather than in the `` `id` · Wave
n `` form. The fourth, `04-S2`, is **not** `04-budget-and-currencies.md`'s `04-S2`, which states
`Wave 1` and parses: it is the illustrative `## Stage 04-S2` heading inside the fenced example at
`12-verification-protocol.md:26`, which the script reads as a stage because it cannot tell a fenced
example from a real heading.

**What the header numbers are worth.** `plans 13 · stages 91 · owned paths 543` is a snapshot of a
set several runs were still writing while this file was being written — it does not even move
monotonically, because a sibling plan can drop a claim between two runs of the script, and this one
read `owned paths 553` minutes before it read `538`, then `543` on the re-run that produced the block
above. Earlier in the same session it read
`plans 8 · stages 48 · owned paths 284` at the start of this plan's own session,
`plans 12 · stages 69 · owned paths 442` an hour later, `plans 12 · stages 71 · owned paths 448`
twenty minutes after that, `plans 13 · stages 80 · owned paths 498` after that, and
`plans 13 · stages 84 · owned paths 524` when the previous revision of this section was written —
because `02-places-and-maps.md`, `03-reservations-and-transport.md`, `05-packing-and-todos.md` and
`08-product-modules.md` all appeared in between. The header will not reproduce exactly and it is not
the part that matters. The findings under it are properties of **this** file's ownership and hold
until a sibling changes what it claims. **The stage that executes
any part of this file re-runs the script first**, reads the same three things, and treats a new
same-wave line as a blocker rather than as a note. That re-run is part of this plan's gate, not a
courtesy.
