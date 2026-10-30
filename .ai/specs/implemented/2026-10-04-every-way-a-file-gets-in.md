# Every way a file gets in: paste, the wallet pass, and a refusal that says why

| Field              | Value                                        |
| ------------------ | -------------------------------------------- |
| **Status**         | implemented                                  |
| **Issue**          | none                                         |
| **Spec PR**        | #866                                         |
| **Implementation** | #1236, #1248, #1261, #1273, #1283            |
| **Plan**           | 06-S1 (docs/plans/06-documents-and-media.md) |

## 📝 TLDR

Plan stage `06-S1` closes reference row `DOC-01` (`partial` → `done`) on the trip Files screen
(`/trips/$tripId/files`). A file already gets in by **drop** and by **pick**. Three things are missing:
**paste** (a screenshot or a copied image goes straight into the upload queue on a desktop browser), the
**wallet pass** (`.pkpass` is refused today as an unsupported type), and a **refusal list** that stops
XML-family markup being stored, with a message in the traveller's language. The drop zone also gets
the small repairs that make "drop" trustworthy: it reacts to files only, it stops flickering when the
pointer crosses a child element, and its drag-over fill animates opacity only.

Nothing is migrated, no route is added, no quota metric changes, no package is added. Four phases,
each a path a traveller can use on its own, built one after the other because they all edit
`file-policy.ts`, `files.ts` or `file-library.tsx`: the wallet pass (Phase 1), the refusal list
(Phase 2), paste (Phase 3) and the drop zone (Phase 4). The browser evidence the stage owes is
written with the phase that ships each behaviour, not as a phase of its own.

This spec describes the work that is **left** at HEAD (`3f2ea931`). It departs from the plan's stage
block where the plan was written before ADR 0016, before the code it cites changed, or before a
specialist looked at it. Every departure is a row of the Resolved assumptions table.

## 📝 Problem Statement

What a traveller can do today on the Files screen (`src/components/modules/files/file-library.tsx`):
drag files onto a dashed zone, or press "Choose files" (or the header's "Upload files"). Each file
goes through one shared policy (`src/server/fns/file-policy.ts`, `checkUpload`), one sequential
upload queue with real progress, and a per-file refusal row. That half is built and stays.

What is missing, measured at HEAD:

- **Paste.** `grep -n paste src/components/modules/files/*.ts*` finds nothing. A screenshot of a
  boarding pass, copied to the clipboard, cannot be pasted in; the traveller saves it to disk first.
- **The wallet pass.** `grep -rn pkpass src/server/fns/file-policy.ts` finds only a comment. `ACCEPTED`
  has no `application/vnd.apple.pkpass`, `BY_EXTENSION` has no `pkpass`, so `boarding.pkpass` is
  refused by `checkUpload` as `unsupported-type`. Airlines mostly send passes as
  `application/octet-stream`, so the extension fallback is the path that must work.
- **A stated refusal list.** The policy is an allow-list. That is sound today (`.xml`, `.xhtml`,
  `.svgz` are not on it), but nothing says so in code or in a test, so a later widening of the list
  could re-admit a markup carrier by accident. And `resolveContentType` stores a file named `x.pdf`
  that _claims_ `text/html` as `text/html`, and a file named `x.png` that claims `image/svg+xml` as
  SVG: the claimed type wins when it is on the list.
- **A drop zone that misleads.** `onDragLeave` (`file-library.tsx:425`) fires when the pointer
  crosses onto a child element, so the zone's active state flickers; any drag, including selected
  text, turns it on; and its drag-over fill transitions `background-color` and `border-color`
  rather than opacity and transform (`DESIGN.md`, motion).

The reader this serves: someone who has just been sent a boarding pass or taken a screenshot of a
hotel voucher and wants it on the trip in one step. On a laptop that step is paste or drop; on a
phone, which has no paste gesture outside a text field, it is "Choose files".

## 📝 Proposed Solution

### What the stage owns and what it does not

| Owned (this stage writes it)                                                                                                                                                                                          | Not owned (read only, or left alone)                                                                         |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/server/fns/file-policy.ts` — edit: pkpass, refusal list, binding, `safePastedFilename`, `attachmentHeaders`, the 25 MB docblock                                                                                  | `src/server/db/schema.ts`, `drizzle/` — **no schema change, no migration**                                   |
| `src/server/fns/files.ts` — edit: params on a refusal, headers through the new helper                                                                                                                                 | `src/server/repos/files.ts` — no repository change (its tenant scoping and `recordFile` quota are unchanged) |
| `src/server/storage/objects.ts` and `storage/__tests__/fake-bucket.ts` — edit: `copyObject` carries `contentDisposition` over with `contentType`; `src/lib/i18n/__tests__/coverage.test.ts` — edit: `DEAD_KEYS` 9 → 8 | `src/server/worker.ts`, `wrangler.jsonc`, `src/styles/tokens.css`, `src/components/ui/**`                    |
| `src/components/modules/files/screening.ts` — edit: `describeRejection`, the "too many" sentence from the catalogue                                                                                                   | `package.json`, `pnpm-lock.yaml` (frozen, `docs/SPEC.md` §3)                                                 |
| `src/components/modules/files/upload-queue.ts` — edit: a failure may carry a `DeferredMessage`                                                                                                                        | `src/routes/_app/trips/$tripId/files.tsx` — **not edited** (hardcoded English there is named debt, below)    |
| `src/components/modules/files/upload.ts` — edit: pass `params` through on a refusal                                                                                                                                   | `src/components/modules/book/**` (the booking import uses the same policy; its tests must stay green)        |
| `src/components/modules/files/download.ts` — edit: re-type a markup blob before it gets an object URL                                                                                                                 | `src/server/queue/**` (the `trip-purge` sweep and the import readers are untouched)                          |
| `src/components/modules/files/paste.ts` — new, pure                                                                                                                                                                   | `playwright.config.ts` (these tests write no fixture, so its `workers` comment stays true)                   |
| `src/components/modules/files/file-library.tsx` — edit: paste listener, hint, drop zone                                                                                                                               |                                                                                                              |
| `src/components/modules/files/__tests__/upload-policy.test.ts`, `upload-queue.test.ts` — edit; `paste.test.ts`, `download.test.ts` — new                                                                              |                                                                                                              |
| `src/server/fns/__tests__/file-policy.test.ts` — edit                                                                                                                                                                 |                                                                                                              |
| `src/lib/i18n/messages/<locale>/modules.ts` — edit, **all 23 locales**, two keys                                                                                                                                      |                                                                                                              |
| `e2e/documents-and-media.spec.ts` — new (this plan's spec file, `12-verification-protocol.md` §4)                                                                                                                     |                                                                                                              |
| This spec's `Status` / `Implementation` rows, the regenerated `.ai/specs/README.md`, and any document the Phase 1 grep names                                                                                          |                                                                                                              |

`src/server/fns/files.ts` was edited by `00-S3` (the audit trail: `trail(...)` after the row in
upload and delete, already landed); this stage starts from HEAD, not from the plan's line numbers.
`src/components/modules/files/file-library.tsx` is edited later by `06-S2` (wave 2) and `06-S4`
(wave 3), one stage at a time.

### How a file gets in, after this stage

Three entry points, one path. Drop, pick and paste all end in `add(files)` in `file-library.tsx`,
which runs `screenFiles` (the same policy the server runs), enqueues what passed, and renders a
refusal row for what did not. The server still trusts none of it.

### Phase 1 (06-S1a) — the wallet pass

In `file-policy.ts`:

- `ACCEPTED` gains `['application/vnd.apple.pkpass', 'ticket']`; `BY_EXTENSION` gains
  `['pkpass', { type: 'application/vnd.apple.pkpass', kind: 'ticket' }]`; `ACCEPT_ATTRIBUTE` gains
  `.pkpass`. The extension fallback is the path that fires for `application/octet-stream` and for an
  empty type, and a test asserts exactly that.
- **`IMPORT_READERS` is not touched.** The booking import still refuses a `.pkpass` by name
  (`import-dialog.test.tsx:144`, `file-policy.test.ts:15`): it is a zip the import cannot read. Storing
  one in the library and importing one are different questions, and the file already says so.
- **`attachmentHeaders({ filename, contentType, sizeBytes })` — new, pure.** Returns the header set
  `downloadTripFileFn` builds inline today (`files.ts:332-340`): `content-type` (the stored media
  type, echoed verbatim, never re-derived), `content-length`, `content-disposition: attachment;
filename*=UTF-8''…`, `cache-control: private, no-store`, and `x-content-type-options: nosniff`. A
  second export, `contentDispositionFor(filename)`, is the one disposition string, used by
  `attachmentHeaders` and by the `bucket.put` metadata at `files.ts:162` so the two cannot drift. The
  handler calls the helper; its behaviour changes only by the added `nosniff`. This is what makes the
  header assertable in a unit test without a Worker: a `.pkpass` row is served as
  `application/vnd.apple.pkpass`, and a 200 alone would not prove it.
- **What the traveller gets is "a file that downloads with its pass type"**, nothing more is promised.
  The in-app download is a `fetch` into a blob saved through a hidden `<a download>` link
  (`download.ts:53-64`). Whether a phone then offers an Add-to-Wallet sheet or leaves the pass in
  Downloads is **not verified** by this stage and is not claimed; `application/vnd.apple.pkpass`
  reaching the receiving device is the part the stage controls.
- The kind filter chips already count `ticket` (`file-library.tsx:571-597`), so a wallet pass shows up
  under "Tickets" without a UI change.
- **The Docs-and-CI grep.** Search `docs/`, `AGENTS.md`, `README.md` and `.ai/` for `pkpass`,
  `ACCEPT_ATTRIBUTE` and `unsupported-type`, and update every document that states the accepted
  formats. `docs/plans/03-reservations-and-transport.md:3002`, `docs/plans/11-boundaries-and-blockers.md:556`
  and ADR 0012 say the booking **import** refuses `.pkpass`; that stays true and they are not edited.
  A dated record of what a design saw is history and is not rewritten.
- **Follow-up issue (filed by this phase's run, labelled `security`).** `uploadTripFileFn`,
  `updateTripFileFn` and `deleteTripFileFn` check only that the caller can see the trip
  (`requireTrip`); none of them calls `assertTripRole` or the writable-trip guard, so a trip viewer can
  upload, rename and delete files, including on an archived trip. The rule ("viewer: reading only",
  `CONTEXT.md`) is already settled, so the fix is not a product decision, but it changes who may
  write and is a separate ticket from this stage's paths. The paste listener adds one more entry to
  the same write, which is why it is named here.

### Phase 2 (06-S1b) — the refusal list, and a message in the traveller's language

**The decision, and why it departs from the plan.** The plan refuses `.html`, `.htm`, `.xhtml`,
`.xml` and `.svgz`. `.html` and `.htm` are accepted **on purpose**: a hotel's confirmation page saved
from a browser is a format the booking import reads (`IMPORT_READERS`, ADR 0012, spec
`2026-09-11-booking-confirmation-import`, whose import dialog uploads through the same
`uploadTripFileFn`; there is no flag that tells an import from a library upload). Refusing them
would delete a shipped capability. A security and tenancy specialist chose to keep them as a
documented exception on the same footing as `.svg`, and to refuse the rest:

1. **Refused by extension, whatever media type is claimed:** `.xhtml`, `.xml`, `.svgz`. Code
   `blocked-type`. In `checkUpload` the order is: `empty`, then `blocked-type`, then `too-large`,
   then the allow-list, then `quota`, so an oversized `.xml` gets `blocked-type` on the pre-flight
   and on the server alike, and a future widening of the allow-list cannot re-admit these.
2. **Refused by claimed media type, under any filename:** `application/xhtml+xml`,
   `application/xml`, `text/xml` — except when the extension is `.gpx`, the one XML-based format
   the product stores (an operating system may label it `application/xml`). That exception is
   written in the table, not implied.
3. **`text/html` and `image/svg+xml` are bound to their extensions.** When the filename has an
   extension and it is not `.html`/`.htm` (for `text/html`) or `.svg` (for `image/svg+xml`), the
   claimed type is ignored and the extension decides: `x.pdf` claiming `text/html` is stored as
   `application/pdf`, `x.png` claiming `image/svg+xml` is stored as `image/png`, and `x.exe` claiming
   either is refused as `unsupported-type`. A file with no extension keeps its claimed type, because
   the import reads an extensionless stored file by its media type (`IMPORT_READERS_BY_TYPE`).
4. **`.svg`, `.html` and `.htm` stay accepted, and the argument is written into `file-policy.ts`
   and not assumed.** A stored-script attack needs a same-origin navigation to the markup, and this
   product offers none. Five controls together are the mitigation, and **any one going away reopens
   the decision**:
   - (a) the `FILES` bucket is **served to a browser** only through `downloadTripFileFn` (the booking-import queue handler, `queue/handlers/booking-import.ts:381`, reads it server-side)
     (`grep -rn FILES_PUBLIC_BASE src/` finds only its type, `queue/types.ts:476`);
   - (b) that response is `content-disposition: attachment`, `cache-control: private, no-store` and
     `x-content-type-options: nosniff`. This protects a **direct** fetch of the URL. It does not
     protect the in-app download, because `download.ts` reads the response into a blob that keeps the
     stored media type and the app sets no Content-Security-Policy header;
   - (c) every **uploaded** object (`uploadTripFileFn`) is **stored** with `contentDisposition: attachment` (`files.ts:159-163`), so a
     public domain would serve it as a download. `trip-copy` copies objects through `copyObject`
     (`src/server/storage/objects.ts:122-126`), which today keeps only `contentType`; this phase makes
     it carry `contentDisposition` too, so a copied trip's cover object keeps the same disposition (`trip-copy` uses `copyObject` for the cover only, `queue/handlers/trip-copy.ts:156-184`), with a
     unit assertion beside the existing `copyObject` tests;
   - (d) **no client code gives the user a same-origin object URL typed `text/html` or
     `image/svg+xml`.** `download.ts` re-types a blob of those two types to
     `application/octet-stream` before `URL.createObjectURL`, and leaves every other type (the wallet
     pass included) as it is. A `download.test.ts` asserts it for both types and asserts
     `application/vnd.apple.pkpass` and `application/pdf` pass through unchanged;
   - (e) the preview in `06-S4` (which inherits this list) never shows an `image/svg+xml` file
     through a same-origin blob or object URL: an SVG gets no inline preview, or a sandboxed or
     rasterised one. "No open-in-new-tab button" is not enough, because the browser's own context
     menu offers "Open image in new tab" on any `<img>`.

   **Hand-off, stated where the next reader will meet it:** `wrangler.jsonc:71` declares
   `FILES_PUBLIC_BASE: https://files.planned.travel`, and `docs/plans/13-content-studio.md` plans to
   serve a public bucket for `cms/` keys. Whether a custom domain is bound to the `FILES` bucket is
   not visible from the repository. Before any stage binds that domain, it must confirm that **every key outside `cms/`** is unreachable through it: `trips/`, `exports/` (`queue/handlers/pdf-export.ts:153-158` stores HTML as `text/html` with no attachment disposition) and the dead-letter prefix (`queue/consumer.ts:230-234`).

**The message.** `checkUpload` returns `{ code: 'blocked-type', message, params: { name } }`.
`message` is an English fallback (the type stays `UploadRejection.message: string`), and the words
the traveller reads come from the catalogue:

- `UploadRejection` gains `params?: Readonly<Record<string, string | number>>`; `UploadFailure`
  (`files.ts`) gains the same optional field, and `refuse(code, message, params)` forwards it.
  `upload.ts` carries it through.
- `describeRejection(code, params, fallback): DeferredMessage | string` — new, in `screening.ts`.
  `blocked-type` maps to `modules.files.reject.blockedType`; every other code returns its
  `fallback` string as today. **The client maps by `code`, on both paths**: the pre-flight
  (`screenFiles`) and the server's `UploadFailure` answer in `file-library.tsx`. A file only the
  server refuses (a spoofed client) still renders in the traveller's language.
- `screenFiles` returns `rejected: { file, message: DeferredMessage | string }`; `UploadQueueAction`'s
  `fail` takes `DeferredMessage | string` (`reject` already does). `file-library.tsx` already
  resolves a `DeferredMessage` in `announcementsFor` output (`typeof line.description === 'string'
? … : resolve(...)`), so the plumbing is small.
- **The "too many at once" sentence uses the key that already exists.** `files.error.tooMany` is in
  all 23 locales and nothing renders it, while `screenFiles` builds the same sentence in English
  (`screening.ts:41`). Since `screenFiles` now returns a `DeferredMessage`, that case returns
  `{ key: 'modules.files.error.tooMany', params: { count: MAX_FILES_PER_UPLOAD, name } }` (the `MessageKey` form `upload-queue.ts:264` uses). No new key, and `src/lib/i18n/__tests__/coverage.test.ts` lowers `DEAD_KEYS` from 9 to 8, with its docblock list of the blocked keys, in the same change.
- The sentence "the rest of the batch is unaffected" already ships (`files.queue.someFailed`) and is
  reused. No second sentence is added.

The four older refusal sentences (`empty`, `too-large`, `unsupported-type`, `quota`) are English
strings built in code. They are **pre-existing debt**, named in Out of scope, not repaired here.

**The 25 MB ceiling stays.** The plan took this decision explicitly and it stands: `MAX_FILE_BYTES`
is a storage-cost decision, and the reference product's larger ceiling would double the worst case
of every plan's `storage_bytes` without moving a published number. Its docblock gains the reason
(a change to it is a pricing change, not an edit). `checkUpload`'s `too-large` case and the
batch-budget case are covered by tests already; this phase adds the exact-boundary pair (25 MB
admitted, 25 MB + 1 byte refused) if it is not there.

### Phase 3 (06-S1c) — paste

`src/components/modules/files/paste.ts` (new, pure, no DOM globals beyond the types):

- `filesFromClipboard(data: Pick<DataTransfer, 'files' | 'items'>): Array<File>` — reads
  `data.files` first; only when it is empty, falls back to `items` of `kind === 'file'` through
  `getAsFile()`. **It never merges the two**, or one paste would upload a screenshot twice. A text
  paste returns `[]`.
- `nameForPaste(files, now, seen)` — renames a file only when its name is empty or matches
  `^image\.[a-z0-9]+$` (case-insensitive), the placeholder browsers give a pasted screenshot. A file
  copied from a file manager keeps its real name (`Hotel-Lisbon-booking.pdf`). Renamed files use
  `safePastedFilename`, and `seen` (a `Map<string, number>` the screen keeps for its whole life, in
  a ref) makes every name unique across **all** pastes of that screen, not only within one.
- `shouldTakePaste(event)` — false when `event.defaultPrevented`; when the target is `input`,
  `textarea`, `select` or `isContentEditable`; or when the target is inside `[role=dialog]`,
  `[role=alertdialog]` or `[role=menu]`.

`safePastedFilename(mediaType, now, sequence)` in `file-policy.ts`: **`YYYYMMDD-HHmmss.<ext>`**, with
`-<n>` before the extension when `sequence` is 2 or more. There is no English word in the name,
because it is shown in the queue row, the toast and the files table in all 23 locales; the digits are
the browser's local time. The extension is found by a reverse lookup over the accepted-format table,
so a pasted PNG lands as `.png`; a type not in the table takes the **media subtype** when the type is
`image/*` (a pasted `image/tiff` becomes `….tiff`, so the refusal names the thing the traveller
pasted), and `.bin` otherwise. The result goes through `sanitiseFilename`, not beside it.

**Where the listener is.** On the whole Files screen, not on the panel. A traveller who copies a
screenshot, opens Files and presses ⌘V expects it to work without first clicking into a panel; with
a panel-scoped listener nothing would happen and they would decide paste is broken. In
`file-library.tsx`, one `useEffect` adds a `paste` listener to `document` and removes it on unmount,
so a paste on any other screen never uploads to this trip. The handler:

1. returns when `shouldTakePaste` is false, or when `editing !== null` or `confirm !== null` (the
   details dialog's description field, the confirmation) — so pasting text into a field never
   uploads and never gets its default behaviour cancelled;
2. extracts files with `filesFromClipboard`; **calls `preventDefault` only when it found files**;
3. names them, and feeds them to the existing `add()`, so each file shows as a queue row and the
   batch toast reports the outcome, exactly as a drop does;
4. **brings the queue into view** — in an effect that runs after the render that shows the pasted rows (the queue list only renders once `queue.tasks.length > 0`, so the handler itself has no target on a first paste) with `scrollIntoView({ block: 'center', behavior: 'instant' })` on the queue list (see the amendment below) — so that
   on a long library the traveller sees the upload begin and does not paste a second time.

The panel is **not** made focusable (a departure from the plan, which made it `tabIndex={0}` with an
accessible name): a `tabIndex` stop that does nothing on its own is an extra tab stop that needs a
role to be valid. A keyboard user pastes from wherever focus already is, and still has the "Choose
files" button as the keyboard path for picking. What a screen reader hears for a paste is the same as
for a drop: **one polite sonner toast per finished batch** (`announcementsFor`,
`file-library.tsx:336-354`), and a file refused before upload produces the `failedOne` toast with its
reason as the description. There is no `aria-live` region in the files module and this stage adds none.

**The hint.** One line in the drop zone, as its own paragraph below the two existing lines, **key
caps first**: `<KbdSequence keys={['Mod', 'V']} />` followed by `modules.files.drop.pasteHint`
("pastes a copied image or screenshot"), the same order as `collab.hint.*` (`thread.tsx:735`), so
every locale can put its verb after the keys. The key's docblock in the catalogue states the order.

- The **whole line**, text and key caps, is removed with CSS under `(hover: none), (pointer:
coarse)`: a phone has no paste shortcut, and a screen reader must never read a bare "Ctrl V".
- `Kbd` renders `Ctrl` on the server and `⌘` after mount on Apple platforms, in a cap with a
  _minimum_ width, so the swap can re-centre the line. The line therefore reserves its height from
  the first paint and is shown with an `opacity` change once mounted (`useHasMounted`), at `duration-base` on `--ease-out-quint` like the overlay, so nothing
  moves and a Mac never shows the wrong key.
- The empty state is unchanged (its description is a string and cannot host a key cap, and the drop
  zone sits directly above it in both states).

### Phase 4 (06-S1d) — the drop zone

In `file-library.tsx`, on the existing drop `<div>`:

- `data-part="file-drop"` and `data-state="idle" | "active"` — stable selectors the e2e spec and the
  frames reach, instead of a class name.
- **Files only.** `dragenter` / `dragover` set the active state only when
  `event.dataTransfer.types` includes `'Files'`. Selected text dragged over the page does nothing.
- **No flicker.** Entering a child element no longer clears the active state: a depth counter
  incremented on `dragenter` and decremented on `dragleave`, or a `relatedTarget` containment
  check — the implementer picks one, and the test covers a `dragleave` whose target is a child.
  `drop` always clears it.
- **Opacity only.** The drag-over fill moves from a `background-color`/`border-color` transition to
  an absolutely positioned overlay (`--color-brand-subtle` fill, `--color-brand` hairline) whose
  `opacity` transitions at `duration-base` (220 ms) on `--ease-out-quint`. The overlay is drawn
  **behind** the zone's icon, text and "Choose files" button (the content is `relative` above it), so
  "Drop to upload" stays readable on the same ink-on-`--color-brand-subtle` pair in both themes. No
  bespoke reduced-motion code: the global rule at `src/styles/styles.css` already collapses every
  transition. The overlay is `aria-hidden` and `pointer-events-none`; the zone's text still changes
  to `files.drop.active`. Dark re-declares its own surface through the tokens.

### Alternatives considered, and why they lost

| Alternative                                                              | Why not                                                                                                                                                                         |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Refuse `.html`/`.htm` as the plan says                                   | Deletes the shipped booking import of a saved hotel page (ADR 0012), whose dialog shares the upload function and cannot be told apart from it.                                  |
| An "import" flag on the upload so only imports may carry `.html`         | A client-controlled flag would decide a security policy.                                                                                                                        |
| Store `.html` as `text/plain`                                            | The stored `content_type` would say something other than what the file is; the download rule is "echoed verbatim".                                                              |
| Panel-scoped paste (focus the panel first)                               | Silent failure for the commonest gesture (copy, open Files, paste), and an inert tab stop.                                                                                      |
| Move every refusal sentence into the catalogue now                       | Touches every `checkUpload` caller and test for four codes this stage does not change; `describeRejection` makes it one code at a time later.                                   |
| A `pasted-` prefix from the catalogue                                    | A new key in 23 locales to name a file the traveller can rename; a name made of digits needs none.                                                                              |
| Stacked card list for the table at 360px (the plan's Definition of done) | Not described in the plan's UI section; `06-S2`, `06-S4` and `06-S6` all edit the same row again, so a layout designed now is reworked three times. Deferred, see Out of scope. |

## 📝 Architecture

| Concept                                       | Owner module                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| What may be stored: types, refusals, ceilings | `src/server/fns/file-policy.ts` (pure; the picker, the pre-flight and the handler all import it)        |
| The download header set and the disposition   | `file-policy.ts` (`attachmentHeaders`, `contentDispositionFor`); `files.ts` calls them                  |
| How a refusal reaches the reader              | `screening.ts` (`describeRejection`); the catalogue holds the words                                     |
| Reading the clipboard, naming a pasted file   | `paste.ts` (pure) and `file-policy.ts` (`safePastedFilename`, because the name must pass the sanitiser) |
| What type a saved blob carries                | `download.ts` — the only client code that makes an object URL for a stored file                         |
| The listener and the drop zone                | `file-library.tsx` — the only component that owns the upload queue                                      |
| Row creation, quota and tenant scoping        | `src/server/repos/files.ts` — unchanged                                                                 |

**The R2 write ordering is not touched, and is restated because this stage edits the function that
owns it** (`uploadTripFileFn`): the object is written to R2 **first** (`bucket.put`), **then** the
quota is asserted and the row inserted (`recordFile` calls `assertQuota(scope, 'files', …)` and
`assertQuota(scope, 'storage_bytes', …)` before the insert), **and if that throws the object just
written is deleted again**. A dangling object is a sweep job; a dangling row is a broken download.
The audit `trail` entry still goes after the row. This stage adds the wallet-pass kind resolution
inside that sequence and moves none of its steps.

**Dependency direction.** `paste.ts` and `screening.ts` import from `file-policy.ts`; nothing in
`file-policy.ts` imports from `components/`. `components/ui` is untouched and never fetches.

## 📝 Data Model

None. `trip_files` (`schema.ts`) already carries `content_type`, `size_bytes`, `kind` (with its
`trip_files_kind_chk` enum, which already contains `ticket`), `description`, `uploaded_by` and the
unique `storage_key`. A wallet pass is a media type and a kind, not a column. No migration.

**Retention, stated because this is the stage that stores bytes.** An uploaded object lives in
`FILES` under `trips/<organizationId>/<tripId>/<fileId>-<filename>`. It is deleted when the traveller
removes the file (`deleteTripFileFn`: row first, then the object) and, since PRD #104, when the trip
is deleted: `deleteTripFn` reads the keys through `readTripForDelete`, which calls `listTripStorageKeys` before the cascade
(`src/routes/_app/-server/trip-lifecycle.ts:311`) and enqueues the `trip-purge` task
(`src/server/queue/handlers/trip-purge.ts`), which deletes them. **The plan's "nothing sweeps R2 when
a trip is deleted" is stale and is not repeated here.** There is **no time-based expiry**, and this
stage adds none: a boarding pass is the traveller's until they remove it, and a product that silently
deleted a document after ninety days would be worse than one that charges for the storage. What
bounds the cost is the plan ceiling, enforced live on every write (see Quota). The trash window
belongs to `06-S2`.

## 📝 API Contracts

No new server function and no new Zod schema. The scalar bag in `files.ts` gains no field: the
pasted name is produced in the browser and re-sanitised on the server (`sanitiseFilename`), so
nothing new crosses the boundary untyped. Where an existing schema is touched it uses the v4 forms.

| Change                        | Shape                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `UploadRejectionCode`         | gains `'blocked-type'`                                                               |
| `UploadRejection`             | gains `params?: Readonly<Record<string, string \| number>>`                          |
| `UploadFailure` (`files.ts`)  | gains `params?` with the same shape; `message` stays required (the English fallback) |
| `downloadTripFileFn` response | unchanged on the wire except the added `x-content-type-options: nosniff`             |

**Authorisation, stated as it is.** `uploadTripFileFn`, `updateTripFileFn` and `deleteTripFileFn`
start with `appScope()` and `requireTrip(scope, tripId)` before anything is read or written, which
proves the trip belongs to the caller's workspace and that the caller can see it. **They checked no
trip role and no writable-trip guard**, so a viewer could upload, rename and delete files, on an
archived trip too. That gap was not decided here and not widened by this stage; Phase 1 filed it as
a `security` follow-up (above), which #1233 closed: the file writers in `src/server/repos/files.ts`
run `requireWritableTrip` then `assertTripRole(['owner', 'editor'])` on the trip the stored file
names, and the upload function runs the same pair before its bucket write. A trip id from the
browser is a claim, not an authorisation.
Nothing is slow enough to enqueue.

**Quota.** The metrics are `files` and `storage_bytes`, both already enforced on this write path by
`recordFile` (`PLAN_QUOTAS`: free 50, starter 500, pro 5 000, business unlimited; `storage_bytes`
from `resolveLimits()`), from live `COUNT(*)`/`SUM(...)` in `getStorageUsage`, never from
`usage_records`. **No metric is added**, nothing changes in `resolveLimits()` or `PLAN_QUOTAS`, and
no case is added to `src/server/billing/__tests__/limits.test.ts`. A paste is an upload and meets the
same ceiling.

## 📝 UI/UX

- **Route:** none added, none edited. `pnpm generate-routes` does not run.
- **Components:** existing primitives only — `KbdSequence`, `Button`, `Badge`, `EmptyState`, `Alert`,
  `Progress`, `toast`, and `ModulePanel`, `useAction` from `modules/shared`. Nothing is filed to
  foundations.
- **States.** _Empty_ — the existing `EmptyState`, unchanged. _Skeleton_ — `FilesPending` is
  unchanged and its row height does not move. _Error_ — a refusal is per file on its own row with its
  reason, and the existing sentence says the rest of the batch is unaffected. _Loading_ — sequential
  uploads with real per-file progress; one polite toast per finished batch: unchanged.
- **Keyboard and screen reader.** A pasted file produces the same queue row and the same toast as a
  dropped one. The hint's key caps are real `<kbd>` elements, always announced with the words of the line, never alone. There is no new tab stop. The drag overlay is `aria-hidden`; the text change to "Drop to
  upload" is the cue.
- **360px.** The drop zone and the refusal rows are designed to be usable there; the hint is absent on
  touch. The file _table_ is left as it is (it hides "added by" and "when" below `sm`); its 360px
  frames are captured in Phase 4 as evidence, and a defect in them is reported, not fixed here (Out of
  scope).

## 📝 Visual change expected

Route `/trips/$tripId/files`, light and dark, 360 / 1280 / 2560 px:

- **Resting, a pointer device:** the drop zone gains one hint line (copy below) under the two existing
  lines, fading in on mount into a height reserved from the first paint.
- **Resting, a touch device:** the whole hint line is absent and takes no height; nothing else
  differs on `mobile-safari`.
- **Drag over (`data-state="active"`):** an opacity-only overlay fades in behind the zone's content;
  the text reads "Drop to upload" and stays legible. Reached only by a drag carrying files.
- **Upload refused:** a refusal row for an `.xml` file, with the new sentence.

## 📝 Copy

Every string is a catalogue key in `src/lib/i18n/messages/en/modules.ts` and must land in all 23
locales in the same change (`i18n-messages` skill, the parity test). The plan's "English (en-GB)
only" note is superseded by that rule.

| Key (`modules.` prefix in code) | `en` text                                                                                                                                           |
| ------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `files.reject.blockedType`      | `“{name}” was not added: XML and compressed SVG files are not stored here, for safety. Save it as a PDF or an image and add that instead.`          |
| `files.drop.pasteHint`          | `pastes a copied image or screenshot` (rendered **after** the `Ctrl`/`⌘` + `V` key caps; the catalogue docblock says every locale keeps that order) |

Reused as they are: `files.drop.idle`, `files.drop.active`, `files.queue.someFailed`,
`files.action.choose`, and now `files.error.tooMany`. The English fallback `message` that
`checkUpload` returns for `blocked-type` is a code-side string, not a catalogue key.

## 📝 Edge Cases & Failure Scenarios

| Case                                                      | Behaviour                                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Paste of plain text (not in a field)                      | No files, no `preventDefault`, no upload; the browser's default stands.                                       |
| Paste into the details dialog's description, or any input | Ignored by `shouldTakePaste`; text pastes normally.                                                           |
| Paste while a dialog or menu is open                      | Ignored.                                                                                                      |
| `clipboardData.files` empty, `items` holds a file         | Read from `items`; never both.                                                                                |
| Two screenshots in one paste                              | `20261004-123456.png` and `20261004-123456-2.png`: unique labels in the queue.                                |
| The same screenshot pasted twice in one second            | Two uploads, two distinct names (`…-2` continues across pastes), no de-duplication.                           |
| A pasted `image/tiff` (macOS Preview)                     | Named `….tiff`, refused `unsupported-type` with that name: the refusal names what was pasted, not `….bin`.    |
| A file copied from a file manager                         | Keeps its real name.                                                                                          |
| A long library, paste from the top of the page            | The queue list is scrolled into view; the traveller sees the upload begin.                                    |
| `boarding.pkpass` as `application/octet-stream` or `''`   | Accepted by extension as `application/vnd.apple.pkpass`, kind `ticket`; downloads under that type.            |
| `boarding.pkpass` claiming `application/pdf`              | Stored as `application/pdf` (the claimed allow-listed type wins, as for every file); not served as a pass.    |
| `x.xml`, `x.xhtml`, `x.svgz`, any claimed type            | `blocked-type`, in the traveller's language, on both the pre-flight and the server path.                      |
| An oversized `x.xml`                                      | `blocked-type` (checked before `too-large`).                                                                  |
| `x.gpx` claiming `application/xml`                        | Accepted (the named exception).                                                                               |
| `x.pdf` claiming `text/html`; `x.png` claiming SVG        | Stored as `application/pdf` and `image/png`.                                                                  |
| `page.html`, `page.htm`, `logo.svg`                       | Still accepted; the booking import still reads the html pages.                                                |
| Download of a `text/html` or `image/svg+xml` row          | The blob is re-typed `application/octet-stream` before the object URL; the file saves under its own name.     |
| 25 MB exactly / 25 MB + 1 byte                            | Admitted / refused `too-large`.                                                                               |
| Quota exhausted mid-paste                                 | Per-file `quota` refusal rows, as for a drop; the compensating R2 delete still runs on a server-side refusal. |
| Drag of selected text over the page                       | The zone stays idle.                                                                                          |
| Pointer crosses onto the zone's button mid-drag           | The zone stays active.                                                                                        |
| Paste on another screen                                   | The listener is removed on unmount; nothing uploads to this trip.                                             |
| A phone                                                   | No hint line; "Choose files" is the path.                                                                     |

## 📝 Observability

No new log or metric. The audit trail entry (`FILE_UPLOADED`) written after the row by `00-S3` is
unchanged and covers a pasted file like any other.

## ✅ Acceptance criteria

1. `boarding.pkpass` with an empty or `application/octet-stream` type passes `checkUpload`, resolves
   to `application/vnd.apple.pkpass` and kind `ticket`; the picker's `accept` lists `.pkpass`.
2. `attachmentHeaders` echoes the stored media type verbatim and always sets
   `content-disposition: attachment`, `cache-control: private, no-store` and
   `x-content-type-options: nosniff`, including for a `text/html` row and a `.pkpass` row.
3. `.xhtml`, `.xml` and `.svgz` are refused with `blocked-type` whatever media type is claimed (an
   oversized one too), and so are `application/xhtml+xml`, `application/xml`, `text/xml` under any
   filename except `.gpx`. `.html` and `.htm` still pass `checkUpload` and `importReaderFor`.
4. A claimed `text/html` on a filename whose extension is not `html`/`htm`, and a claimed
   `image/svg+xml` on one whose extension is not `svg`, are not stored under the claimed type.
5. A `blocked-type` refusal is worded from the catalogue on the pre-flight path **and** when only the
   server refuses; the 23-locale parity test passes.
6. `download.ts` hands `URL.createObjectURL` a blob typed `application/octet-stream` for a
   `text/html` or `image/svg+xml` file, and the stored type for every other file; `copyObject` carries
   `contentDisposition` over.
7. A paste of files, anywhere on the Files screen outside an editable field or an open dialog, puts
   each file in the upload queue and brings the queue into view; a paste of text does nothing and is
   not cancelled.
8. A pasted screenshot is named `YYYYMMDD-HHmmss.<ext>` with the extension from its media type (the
   subtype for an unlisted `image/*`); a file copied from a file manager keeps its name; names are
   unique across every paste of the screen.
9. The hint line shows the key caps first, whole line hidden on touch, without a layout shift.
10. The drop zone turns active only for a drag carrying files, does not flicker over children, carries
    `data-part="file-drop"`, and animates opacity only, with its text legible.
11. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `bash .ai/scripts/check-generated.sh`, `pnpm build` are
    green; the booking-import tests (`import-dialog.test.tsx`, `booking-import.test.ts`,
    `file-policy.test.ts`) are green unchanged.
12. Phases 2, 3 and 4 each leave their part of `e2e/documents-and-media.spec.ts` green (Phase 1 owes no browser test: the pass type is proved by the `attachmentHeaders` unit test) on `chromium` and
    `mobile-safari` (layout-shift skipped, stated, on WebKit), with a silent console.

## 📝 Risks & Impact Review

| Risk                                                                     | Mitigation                                                                                                                                                                                              |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Markup (`.html`, `.svg`) stays storable                                  | The five-control mitigation in Phase 2, written into `file-policy.ts`; tests assert `attachment` and `nosniff`, the blob re-type and the `copyObject` disposition; the public-domain hand-off is named. |
| A public domain on the bucket is unverified from the repo                | Hand-off to whichever stage binds `FILES_PUBLIC_BASE`; controls (b), (c) and (d) already cover a direct fetch, a copied trip and the in-app download.                                                   |
| A document-level listener could swallow a paste meant for something else | `preventDefault` only when files were found; ignored for editable targets, dialogs, menus and `defaultPrevented`.                                                                                       |
| An operating system labels a real `.gpx` as `application/xml`            | The `.gpx` exception.                                                                                                                                                                                   |
| A viewer can write files (existing gap)                                  | Named in API Contracts, filed as a `security` follow-up by Phase 1; not widened here.                                                                                                                   |
| The four phases edit shared files                                        | They are serialised (Phasing): 1 → 2 → 3 → 4, so no two unattended runs touch `file-policy.ts`, `files.ts` or the drop-zone block of `file-library.tsx` at once.                                        |
| Paste of a _copied file_ may arrive as an icon on some browsers          | The hint says "copied image or screenshot" only; widening it needs recorded evidence (Phase 3 step 5).                                                                                                  |

### Out of scope

- **The files table at 360px.** The plan's Definition of done asks for a stacked card list. It is
  not described in the plan's UI section, and later stages edit the same row. Phase 4 captures the
  table's 360px frames; if they show the likely defect (`table-fixed` plus columns of 112, 96 and
  48 px leave the file name about 70 px), that run files a follow-up issue with the frames attached.
  The plan's card box is **not ticked** here.
- **Hardcoded English, one follow-up issue.** The four older refusal sentences (`empty`,
  `too-large`, `unsupported-type`, `quota`), `StorageMeter` (`"unlimited"`, `"of"`, the stat-card
  labels), `src/routes/_app/trips/$tripId/files.tsx` (including the error-state title "The files did
  not load"), `` `${visible.length} of ${files.length}` `` at `file-library.tsx:569`, and the English
  errors in `download.ts`. Phase 4's run files the one issue that names them all.
- Starring and trash (`06-S2`), the preview and lightbox (`06-S4`, which inherits control (e)), file
  links (`06-S6`).
- Raising the 25 MB ceiling, thumbnails, any time-based expiry.
- `.pkpass` import: the booking import still refuses it by name.
- Whether a phone offers an Add-to-Wallet sheet for a downloaded pass.

## 📋 Phasing

| Phase | Slice    | What a traveller can do when it merges                                                       | Blocked by |
| ----- | -------- | -------------------------------------------------------------------------------------------- | ---------- |
| 1     | `06-S1a` | Upload an airline's wallet pass and download it under its pass type                          | —          |
| 2     | `06-S1b` | Be told, in their language, why an XML or compressed SVG file was not stored                 | Phase 1    |
| 3     | `06-S1c` | Paste a screenshot or a copied image onto the Files screen                                   | Phase 2    |
| 4     | `06-S1d` | Drag files over the zone and see it react to files only, without flicker; the stage's frames | Phase 3    |

The chain is a line on purpose. Phases 1 and 2 both edit `file-policy.ts`, `files.ts` and the
`checkUpload` tests; Phases 2, 3 and 4 all edit `file-library.tsx` (Phase 2 the server-answer mapping,
Phase 3 the listener and the hint, Phase 4 the drop-zone block the hint sits in), and 2 and 3 share the
types in `screening.ts` and `upload-queue.ts`. The first phase to reach `e2e/documents-and-media.spec.ts`
(Phase 2) creates it; the later ones append a `test` to the same `describe`.

## 📋 Implementation Plan

### Phase 1 — the wallet pass

1. `file-policy.ts`: the three pkpass entries; `attachmentHeaders` (with `nosniff`) and
   `contentDispositionFor`.
2. `files.ts`: `downloadTripFileFn` builds its headers through the helper; `bucket.put` uses
   `contentDispositionFor`.
3. Tests (`upload-policy.test.ts`, `file-policy.test.ts`): `.pkpass` with `''` and
   `application/octet-stream` → `application/vnd.apple.pkpass`, kind `ticket`; `attachmentHeaders`
   echoes `application/vnd.apple.pkpass` and, for a `text/html` row, still `attachment` and `nosniff`;
   `importReaderFor('pass.pkpass', …)` stays `null`.
4. The Docs-and-CI grep, with the exclusions named under Phase 1 above.
5. File the `security` follow-up for the viewer write gap, naming the three functions.

### Phase 2 — the refusal list

1. `file-policy.ts`: `blocked-type` code and `params`; the extension list and the claimed-type list
   (with the `.gpx` exception) in the stated order; the `text/html` and `image/svg+xml` binding in
   `resolveContentType`; the five-control exception comment; the 25 MB docblock.
2. `files.ts`: `UploadFailure.params`, `refuse(code, message, params)`.
3. `download.ts`: re-type a `text/html` or `image/svg+xml` blob to `application/octet-stream` before
   `URL.createObjectURL`. `storage/objects.ts`: widen the `ObjectStore` type (`objects.ts:28-39`) and `storage/__tests__/fake-bucket.ts` (`FakeObject`, `get`, `put`) with `contentDisposition?` on `httpMetadata`, and make `copyObject` forward it only when the source has one (the two existing tests, `{ body }` for a source without metadata and `{ body, contentType }` for one with only a type, stay as they are).
4. `screening.ts`, `upload-queue.ts`, `upload.ts`, `file-library.tsx`: `describeRejection`; the
   `modules.files.error.tooMany` sentence (and `coverage.test.ts`'s `DEAD_KEYS`, 9 → 8); `fail` takes `DeferredMessage | string`; the answer handler maps by
   code.
5. `files.reject.blockedType` in all 23 locales.
6. Tests: `blocked-type` for each of the three extensions with each claimed type, including
   `application/pdf`, `text/html` and `image/svg+xml`, and an oversized one; each XML media type under
   a neutral filename; `.gpx` + `application/xml` accepted; `.html`/`.htm`/`.svg` accepted; `x.pdf` +
   `text/html` stored as PDF; `x.png` + `image/svg+xml` stored as PNG; `x.exe` + `text/html` refused;
   both paths in `upload-queue.test.ts` render the catalogue message; `download.test.ts` (both markup
   types re-typed, `application/vnd.apple.pkpass` and `application/pdf` unchanged); a `copyObject`
   assertion for the disposition.
7. Browser test, creating `e2e/documents-and-media.spec.ts`: attaching `notes.xml` through the hidden
   input renders a refusal row in the catalogue language with no request sent, and the `failedOne`
   toast carries `files.reject.blockedType` as its description; console silent.

### Phase 3 — paste

1. `safePastedFilename` in `file-policy.ts`; `paste.ts` with the three pure functions.
2. `paste.test.ts`: names are stable, sortable and sanitised for each accepted image type, and an
   unlisted `image/tiff` is named `.tiff`; a payload with `files` and one with only `items` produce the
   same upload input; both populated never double; plain text produces nothing; a file with a real
   name keeps it; two screenshots in one paste, and the same one pasted twice in a second, get distinct
   names; `shouldTakePaste` is false for `input`, `textarea`, `[contenteditable]`, inside
   `[role=dialog]` and when `defaultPrevented`.
3. `file-library.tsx`: the effect, the `editing`/`confirm` guard, `preventDefault` only on files, the post-render `scrollIntoView` of the queue; the hint (key caps first, whole line hidden on touch, mount-gated
   fade into reserved height); `files.drop.pasteHint` in all 23 locales.
4. Browser tests (same file): (a) a synthetic `ClipboardEvent('paste')` on `document` carrying a File
   named `image.png` produces one upload request for `YYYYMMDD-HHmmss.png` and the queue list is in the viewport afterwards; (b) a paste of text into
   the details dialog's description uploads nothing and is not cancelled; (c) on `chromium` only, with
   clipboard permissions granted, an `image/png` `ClipboardItem` is written, focus is put on "Choose
   files", `ControlOrMeta+V` is pressed, and the same request is made: this is the proof that a real
   keyboard paste reaches `document` with focus on a non-editable control. Console silent in each.
5. **The hint promises a copied _image_, not a copied file.** What a browser puts on the clipboard for a file copied in a file manager (the file, or its icon as `image.png`) is not verifiable unattended, so the hint does not promise it. A later change may widen the wording to "copied file" only with a recorded real paste per target browser, noting what Chromium uploads. A file that does arrive keeps its real name (`nameForPaste`).

### Phase 4 — the drop zone

1. `file-library.tsx`: `data-part`, `data-state`, files-only detection, the flicker fix, the opacity
   overlay behind the content.
2. A component test for the zone (`.test.tsx`, `ui` project): a text drag leaves it idle; a files
   drag sets it active; a `dragleave` whose target is a child leaves it active; `drop` clears it.
3. Browser tests (same file): a drag carrying `Files` sets `[data-part="file-drop"]` to
   `data-state="active"` and a text-only drag does not; the no-layout-shift check described under
   Verification.
4. Frames and issues: the `capture.mjs` frames and the spec's `drop-active` and `upload-refused`
   screenshots (Verification), the files table's 360px frames; the follow-up issue for the table if
   they show the defect; the one issue naming the hardcoded English (Out of scope).

## Verification

**Command gate, in order:** `pnpm typecheck`, `pnpm lint`, `pnpm test`,
`bash .ai/scripts/check-generated.sh`, `pnpm build` (`validation.commands`).

**Unit tests, by file and invariant.** Listed per phase above. The download header is asserted
through the pure helper, so no Worker is needed.

**Tenant isolation.** This stage changes no repository code, so it adds no `describe` block to
`src/server/repos/__tests__/tenant-isolation.test.ts`; the existing coverage is cited, and the
Phase 1 ticket confirms it still passes: the generic `isolationCase('files', tripFilesRepository, …)`
(read, update, delete of a foreign row by id), `recordFile` onto a foreign trip id (the "a foreign
parent id is rejected" block), and `getStorageUsage` staying inside the tenant ("aggregates and
summaries"). `recordFile` calls `requireTrip` before it asserts anything, so a file cannot be
recorded onto another tenant's trip.

**Browser evidence.** `e2e/documents-and-media.spec.ts`, one `test.describe('06-S1 — every way a
file gets in', …)`; the plan's `.visual.` spec file, baselines, `shoot.ts` imports and
`auditServerClock` are retired (ADR 0016). It imports `visit` and `watchConsole`
(`helpers/console.ts`), `settle` and `settleMutations` (`helpers/settle.ts`), `useSession` and
`hasSession` (`helpers/session.ts`), `applyTheme` and `THEMES` (`helpers/routes.ts`), and
re-implements none. The spec exists for what no lower layer can produce: a real `paste` event
reaching a real `FileLibrary` in a real browser. Each test is written in the phase that ships its
behaviour (Implementation Plan).

- **Nothing here writes to the shared demo workspace** (`trips-core.spec.ts` and `places-and-maps.spec.ts`
  give the same reason: an upload is an additive write both browser projects share). Tests that
  reach an upload intercept the upload request with `page.route(...)` and fulfil it with
  `{ ok: true, … }`; they assert on the request the browser made (the multipart body names the
  pasted file `YYYYMMDD-HHmmss.png`), not on a stored row.
- **Selectors** (`[data-part="file-drop"]`, `[data-state]`) are verified against a running server
  with `page.locator(sel).count()` returning `1` before any frame is filed. Reading the JSX is not a
  verification.
- **Console silent.** `watchConsole(page, route)` before navigation, `fatal` asserted empty at the end
  of every test in the block; nothing is added to `TOLERATED_CONSOLE_WARNINGS`.
- **No layout shift after paint.** A `layout-shift` `PerformanceObserver` as an init script
  (entries with `hadRecentInput` excluded), `visit()` then `settle()`, `performance.now()` as the
  mark, then the active drop state is entered and a file refused; the sum after the mark is `0`. The hint's `Ctrl` → `⌘` swap happens at mount, **before** this mark, so this check does not measure it; what proves it is the reserved height: the hint line's `boundingBox().height` is read right after `visit()` and again once its opacity has reached 1, and the two are equal, plus the resting frames. Gated on `PerformanceObserver.supportedEntryTypes`, with a stated skip
  on `mobile-safari` (the pattern is `places-and-maps.spec.ts`'s).
- **Frames**, read by a human, outside the repository: `scripts/visual/capture.mjs` for the resting
  route (light and dark at 360x800, 1280x900, 2560x1440, `--auth`, `PT_SERVER_TODAY=2026-08-20`,
  quoted in full in the evidence). The two declared non-resting states, `drop-active` and
  `upload-refused`, cannot be reached by `--click` (a drag is not a click), so the spec screenshots
  them at the same six viewport/theme pairs as test attachments; the `drop-active` frames show the
  "Drop to upload" text readable in light and dark. The 360px frames of the **files table** are
  included, for the Out of scope note.
- Nothing is compared to a stored pixel, and `maxDiffPixelRatio` is not mentioned.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                              | Applied default                                                                                                                                                                                                                                                                                           | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Does the stage refuse `.html`/`.htm` as the plan says?                                | No. Keep them as a documented exception; refuse `.xhtml`, `.xml`, `.svgz` by extension and `application/xhtml+xml`, `application/xml`, `text/xml` by claimed type (`.gpx` excepted); bind `text/html` (and, after panel review, `image/svg+xml`) to their extensions.                                     | Decided by security and tenancy sub-agent (confidence medium): `.html` is what the in-progress booking import reads through the same upload function (ADR 0012, spec 2026-09-11); the SVG argument applies equally; closing it later is a one-line edit. Conditions applied above, including the public-domain hand-off.                                                                                                                                                                                     |
| 2   | Where does paste listen, and what does it rename?                                     | A `document` listener while `FileLibrary` is mounted, ignoring editable targets, dialogs and menus; no `tabIndex` on the panel. Rename only empty or `image.<ext>` names.                                                                                                                                 | Decided by UX (traveller) sub-agent (confidence medium): a panel-scoped paste fails silently for the commonest gesture and adds an inert tab stop; real file names must survive. Departs from the plan's panel-scoped wording.                                                                                                                                                                                                                                                                               |
| 3   | Is the stacked card list at 360px in this stage? Is the drop-zone work?               | Card list: no, deferred, plan box not ticked, table's 360px frames captured. Drop zone: yes, including the opacity-only overlay, files-only detection, no flicker, `data-part`. Hint: yes. Evidence: live protocol. Isolation test: cite existing, add none.                                              | Decided by product owner sub-agent (confidence medium): the card is not described in the plan and three later stages edit the row again; the overlay is one element and removes the one motion-rule breach on the element being rewritten. Existing isolation cases (`:921`, `:1311`, `:1667`) already cover the unchanged repository.                                                                                                                                                                       |
| 4   | Table follow-up: file an issue now?                                                   | The spec names it under Out of scope; the implementation run files the issue only if its 360px frames show the defect.                                                                                                                                                                                    | The product owner asked for an issue to be filed; `afk-plan-to-spec` forbids this run filing tickets, so the exit is carried into the implementation phase. Applied by the spec author. The same carry applies to the `security` follow-up (row 20) and the English-debt issue.                                                                                                                                                                                                                              |
| 5   | Where does the `blocked-type` sentence live?                                          | In the 23-locale catalogue (`files.reject.blockedType`), mapped by code on the pre-flight and server paths; the four older sentences stay as named debt. `message` remains an English fallback.                                                                                                           | Decided by software architect sub-agent (confidence medium): the plan's "English only" predates the 23-locale rule; `DeferredMessage` and the queue already carry it; reversible one code at a time.                                                                                                                                                                                                                                                                                                         |
| 6   | How is the stage evidenced?                                                           | `e2e/documents-and-media.spec.ts` (no `.visual.` infix), existing helpers, request interception so nothing is written to the demo workspace, console and layout-shift assertions, frames from `capture.mjs` plus spec screenshots.                                                                        | Same architect verdict: ADR 0016 retired baselines, `shoot.ts` and `auditServerClock`; `places-and-maps.spec.ts` is the pattern. The plan's §7.2/§7.3 blockers concern baselines and are dropped (`file-library.tsx` no longer builds its own `Intl.DateTimeFormat`).                                                                                                                                                                                                                                        |
| 7   | Does the 25 MB per-object ceiling change?                                             | No; its docblock gains the cost reason and an exact-boundary test.                                                                                                                                                                                                                                        | The plan decided it explicitly (storage cost, `PLAN_QUOTAS`); applied as written.                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 8   | Is "nothing sweeps R2 when a trip is deleted" still true?                             | No: `trip-purge` deletes the objects since PRD #104. The spec states the real retention.                                                                                                                                                                                                                  | Measured: `listTripStorageKeys` is called at `src/routes/_app/-server/trip-lifecycle.ts:311` and the handler is `queue/handlers/trip-purge.ts`; the plan predates both.                                                                                                                                                                                                                                                                                                                                      |
| 9   | Does the download need a behaviour change to echo the media type?                     | No. It already echoes `row.contentType`; the stage extracts `attachmentHeaders` so the header is unit-testable and adds the assertions.                                                                                                                                                                   | `files.ts:332-340` at HEAD.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 10  | Is the hint added to the empty state?                                                 | No, only to the drop zone, which is directly above the empty state in both states.                                                                                                                                                                                                                        | `EmptyState`'s description is a string and cannot host a key cap; avoids a duplicate. Applied by the spec author.                                                                                                                                                                                                                                                                                                                                                                                            |
| 11  | How are pasted screenshots named, and in which clock?                                 | `YYYYMMDD-HHmmss.<ext>`, `-<n>` suffix for the second and later file of the same second across all pastes of the screen, browser local time, extension from the accepted-format table, else the `image/*` subtype, else `.bin`.                                                                           | Applied after the UX panel (round 1): an English prefix would show in all 23 locales, and `.bin` would make a refusal read as if a pasted image were not an image. Supersedes the first draft's `pasted-…` name.                                                                                                                                                                                                                                                                                             |
| 12  | Does a file named `x.pkpass` claiming `application/pdf` become a pass?                | No: the claimed allow-listed type wins as for every file; the extension is the fallback, never the override. (`text/html` and `image/svg+xml` are the two exceptions, bound to their extensions.)                                                                                                         | `resolveContentType`'s documented rule; the exceptions come from the security panel verdict (row 14).                                                                                                                                                                                                                                                                                                                                                                                                        |
| 13  | Panel round 1: product owner                                                          | **approve with conditions**, applied: evidence is no longer a phase and each browser test ships with the phase it proves; Phase 4 is blocked by Phase 3; acceptance wording says 23 locales; `file-library.tsx:569` is named debt.                                                                        | Decided by product owner sub-agent (confidence medium).                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 14  | Panel round 1: security and tenancy                                                   | **approve with conditions**, applied: the argument rewritten around the real blob download path with five controls; `download.ts` re-types markup blobs; `copyObject` keeps the disposition; SVG bound to `.svg`; the authorisation gap stated; `nosniff` added.                                          | Decided by security and tenancy sub-agent (confidence medium).                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| 15  | Panel round 1: software architect                                                     | **approve with conditions**, applied: phases serialised 1 → 2 → 3 → 4 with the real reason; trip-lifecycle path corrected; `checkUpload` order stated; the Phase 1 grep names the import-boundary documents it must not edit.                                                                             | Decided by software architect sub-agent (confidence high).                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 16  | Panel round 1: accessibility                                                          | **approve with conditions**, applied: overlay behind the content; the announcement is the batch toast, not an `aria-live` region; whole hint hidden on touch; key caps first; a real `Ctrl+V` test and a manual cross-browser check.                                                                      | Decided by accessibility sub-agent (confidence medium).                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 17  | Panel round 1: UX (traveller)                                                         | **approve with conditions**, applied: locale-neutral names unique across pastes; hint reordered; mount-gated hint with reserved height; subtype extension; queue scrolled into view; `files.error.tooMany` reused; promises reworded for the phone and the wallet; softer refusal copy.                   | Decided by UX sub-agent (confidence medium).                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 18  | Does `copyObject` change?                                                             | Yes, one line: it carries `contentDisposition` with `contentType`.                                                                                                                                                                                                                                        | The security panel offered either a hand-off note or this; a one-line fix with an assertion removes the hand-off for copied trips. Applied by the spec author.                                                                                                                                                                                                                                                                                                                                               |
| 19  | Does the hint promise "copied file"?                                                  | No: "pastes a copied image or screenshot". Widening to "copied file" waits for a recorded real paste per target browser.                                                                                                                                                                                  | Decided by UX (traveller) sub-agent round 2 (confidence medium): an unattended run cannot do the manual cross-browser check, and a copied PDF may arrive as a picture of its icon, which a traveller would take for their booking.                                                                                                                                                                                                                                                                           |
| 20  | The viewer can write files today: fix it here?                                        | No. Stated plainly, and Phase 1's run files a `security` follow-up.                                                                                                                                                                                                                                       | The rule is settled (`CONTEXT.md`), but changing who may write is not this stage's paths and would need its own tests; `afk-plan-to-spec` files no tickets, so the filing is carried into the implementation phase. Applied by the spec author.                                                                                                                                                                                                                                                              |
| 21  | Panel round 2: product owner                                                          | **approve**, no conditions. One wording note carried: Phase 1 owes no e2e test (AC 12 says so).                                                                                                                                                                                                           | Decided by product owner sub-agent (confidence high).                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 22  | Panel round 2: software architect                                                     | **approve with conditions**, applied: `files.error.tooMany` written as `modules.files.error.tooMany` with `coverage.test.ts`'s `DEAD_KEYS` lowered; the object-store types and `fake-bucket.ts` widened for `copyObject`; the `readTripForDelete` wording.                                                | Decided by software architect sub-agent (confidence high).                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 23  | Panel round 2: security and tenancy                                                   | **approve with conditions**, applied (wording only): control (a) says "served to a browser", (c) says "uploaded" and names the cover-only `copyObject`, and the hand-off covers every key outside `cms/` (`exports/`, dead letters). The reviewer approves for unattended implementation once these land. | Decided by security and tenancy sub-agent (confidence high).                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 24  | Panel round 2: accessibility                                                          | **approve with conditions**, applied: the layout-shift claim corrected (the swap is outside the mark; reserved height is the proof); the hint fade uses `duration-base` on `--ease-out-quint`.                                                                                                            | Decided by accessibility sub-agent (confidence high).                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 25  | Panel round 2: UX (traveller)                                                         | **approve with conditions**, applied: the hint promises a copied image; the queue scroll runs after the render that shows the rows and is asserted in browser test (a); the layout-shift claim corrected.                                                                                                 | Decided by UX sub-agent (confidence medium).                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 26  | Layout-shift check, Phase 4: is the sum 0 after the zone fills and a file is refused? | No for the refusal. Entering the active state is asserted to shift nothing (0 entries); the refusal is measured as a separate step: at most one entry and a sum below 0.1. The mark is the number of entries logged, not `performance.now()`.                                                             | Decided by test engineer sub-agent (confidence medium): the refusal inserts its row into the queue below the zone and pushes what follows down (measured 0.0275, one entry), which is the queue appearing and not the zone moving; reserving its height would reverse the queue's "appears when there is something" behaviour. `visit()` pins the clock with `page.clock`, which fakes `performance.now()` while an entry's `startTime` stays real, so a timestamp mark made the first draft pass vacuously. |

## Amendment

Implementation notes from #1283 (Phase 4), followed by later corrections.

- **The layout-shift check is split, and the refusal is bounded rather than zero.** Verification and Phase 4 step 3 say the sum of layout shifts after the mark is `0` when the active state is entered _and a file refused_. Measured on a running server, entering the active state shifts nothing, but the refused file's row is inserted into the queue list below the zone and pushes the content under it down: one entry, 0.0275. That is the queue appearing, which Phase 3 designs (and scrolls into view), not the zone moving. `e2e/documents-and-media.spec.ts` therefore asserts `[]` after the zone fills, and for the refusal at most one entry and a sum below 0.1. The mark is the count of entries logged, not `performance.now()`: `visit()` pins the clock with `page.clock`, which fakes `performance.now()` while an entry's `startTime` stays on the real clock, so a timestamp mark made the check pass even when a 300 px block was injected after it.
- **The two follow-up issues** are #1281 (the Files table at 360 px: the frames show the file name cut to about 70 px, the likely defect) and #1282 (the hardcoded English listed under Out of scope).
- **WebKit.** The Phase 4 browser tests were run on `chromium` only in the implementing run, whose host lacks the libraries WebKit needs; `mobile-safari` is the nightly `e2e-webkit` run's to confirm. The layout-shift test is skipped there, stated in the test.

- **Pasted queue visibility (#1308).** Scroll instantly to the center rather than smoothly to the nearest edge. Centering clears the sticky trip header; an instant scroll avoids targeting stale geometry when upload completion removes the progress bars. The E2E check keeps the viewport assertion and also checks that the queue owns the element at its midpoint, so a queue covered by sticky chrome cannot pass.

## Amendment - GPX markup safeguards

Follow-up #1249 extends the implemented markup safeguards to `application/gpx+xml`: a claimed
GPX type is bound to `.gpx` when an extension is present, and the download helper re-types GPX
blobs (including parameterized types, extensionless claims and existing objects) to
`application/octet-stream` without changing bytes or filenames. The original decisions above
describe the HTML/SVG scope.
