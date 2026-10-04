# Every way a file gets in: paste, the wallet pass, and a refusal that says why

| Field              | Value                                        |
| ------------------ | -------------------------------------------- |
| **Status**         | ready                                        |
| **Issue**          | none                                         |
| **Spec PR**        | none                                         |
| **Implementation** | none                                         |
| **Plan**           | 06-S1 (docs/plans/06-documents-and-media.md) |

## 📝 TLDR

Plan stage `06-S1` closes reference row `DOC-01` (`partial` → `done`) on the trip Files screen
(`/trips/$tripId/files`). A file already gets in by **drop** and by **pick**. Three things are missing:
**paste** (a screenshot or a copied file goes straight into the upload queue), the **wallet pass**
(`.pkpass` is refused today as an unsupported type, and an airline's pass would leave as a generic
file), and a **refusal list** that stops XML-family markup being stored, with a message in the
traveller's language. The drop zone also gets the small repairs that make "drop" trustworthy: it
reacts to files only, it stops flickering when the pointer crosses a child element, and its
drag-over fill animates opacity only.

Nothing is migrated, no route is added, no quota metric changes, no package is added. Five phases,
each a path a traveller can use on its own: the wallet pass (Phase 1), the refusal list (Phase 2),
paste (Phase 3), the drop zone (Phase 4), and the browser evidence the stage owes (Phase 5).

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
  that _claims_ `text/html` as `text/html`: the claimed type wins when it is on the list.
- **A drop zone that misleads.** `onDragLeave` (`file-library.tsx:425`) fires when the pointer
  crosses onto a child element, so the zone's active state flickers; any drag, including selected
  text, turns it on; and its drag-over fill transitions `background-color` and `border-color`
  rather than opacity and transform (`DESIGN.md`, motion).

The reader this serves: someone who has just been sent a boarding pass or taken a screenshot of a
hotel voucher and wants it on the trip in one step, on a laptop or a phone.

## 📝 Proposed Solution

### What the stage owns and what it does not

| Owned (this stage writes it)                                                                                                 | Not owned (read only, or left alone)                                                                         |
| ---------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `src/server/fns/file-policy.ts` — edit: pkpass, refusal list, `safePastedFilename`, `attachmentHeaders`, the 25 MB docblock  | `src/server/db/schema.ts`, `drizzle/` — **no schema change, no migration**                                   |
| `src/server/fns/files.ts` — edit: params on a refusal, headers through the new helper                                        | `src/server/repos/files.ts` — no repository change (its tenant scoping and `recordFile` quota are unchanged) |
| `src/components/modules/files/screening.ts` — edit: `describeRejection`                                                      | `src/server/worker.ts`, `wrangler.jsonc`, `src/styles/tokens.css`, `src/components/ui/**`                    |
| `src/components/modules/files/upload-queue.ts` — edit: a failure may carry a `DeferredMessage`                               | `package.json`, `pnpm-lock.yaml` (frozen, `docs/SPEC.md` §3)                                                 |
| `src/components/modules/files/upload.ts` — edit: pass `params` through on a refusal                                          | `src/routes/_app/trips/$tripId/files.tsx` — **not edited** (hardcoded English there is out of scope, below)  |
| `src/components/modules/files/paste.ts` — new, pure                                                                          | `src/components/modules/book/**` (the booking import uses the same policy; its tests must stay green)        |
| `src/components/modules/files/file-library.tsx` — edit: paste listener, hint, drop zone                                      | `src/server/queue/**` (the `trip-purge` sweep and the import readers are untouched)                          |
| `src/components/modules/files/__tests__/upload-policy.test.ts`, `upload-queue.test.ts` — edit; `paste.test.ts` — new         |                                                                                                              |
| `src/server/fns/__tests__/file-policy.test.ts` — edit                                                                        |                                                                                                              |
| `src/lib/i18n/messages/<locale>/modules.ts` — edit, **all 23 locales**, two keys                                             |                                                                                                              |
| `e2e/documents-and-media.spec.ts` — new (this plan's spec file, `12-verification-protocol.md` §4)                            |                                                                                                              |
| This spec's `Status` / `Implementation` rows, the regenerated `.ai/specs/README.md`, and any document the Phase 1 grep names |                                                                                                              |

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
filename*=UTF-8''…`, `cache-control: private, no-store`. A second export,
  `contentDispositionFor(filename)`, is the one disposition string, used by `attachmentHeaders` and by
  the `bucket.put` metadata at `files.ts:162` so the two cannot drift. The handler calls the helper;
  its behaviour does not change. This is what makes the header assertable in a unit test without a
  Worker: a `.pkpass` row leaves as `application/vnd.apple.pkpass` so the receiving operating system
  offers the wallet, and a 200 alone would not prove it.
- The kind filter chips already count `ticket` (`file-library.tsx:571-597`), so a wallet pass shows up
  under "Tickets" without a UI change.

### Phase 2 (06-S1b) — the refusal list, and a message in the traveller's language

**The decision, and why it departs from the plan.** The plan refuses `.html`, `.htm`, `.xhtml`,
`.xml` and `.svgz`. `.html` and `.htm` are accepted **on purpose**: a hotel's confirmation page saved
from a browser is a format the booking import reads (`IMPORT_READERS`, ADR 0012, spec
`2026-09-11-booking-confirmation-import`, whose import dialog uploads through the same
`uploadTripFileFn`; there is no flag that tells an import from a library upload). Refusing them
would delete a shipped capability. A security and tenancy specialist chose to keep them as a
documented exception on the same footing as `.svg`, and to refuse the rest:

1. **Refused by extension, whatever media type is claimed:** `.xhtml`, `.xml`, `.svgz`. Code
   `blocked-type`, checked **before** the allow-list, so a future widening of the list cannot
   re-admit them.
2. **Refused by claimed media type, under any filename:** `application/xhtml+xml`,
   `application/xml`, `text/xml` — except when the extension is `.gpx`, the one XML-based format
   the product stores (an operating system may label it `application/xml`). That exception is
   written in the table, not implied.
3. **`text/html` is bound to its extensions.** When the filename has an extension and it is not
   `.html` or `.htm`, a claimed `text/html` is ignored and the extension decides (`x.pdf` claiming
   `text/html` is stored as `application/pdf`; `x.exe` claiming it is refused as
   `unsupported-type`). A file with no extension keeps its claimed type, because the import reads an
   extensionless stored file by its media type (`IMPORT_READERS_BY_TYPE`).
4. **`.svg` stays accepted, `.html` and `.htm` stay accepted, and the argument is written into
   `file-policy.ts` and not assumed.** A stored-script attack needs a same-origin navigation to the
   markup, and this product has none. Four things together are the mitigation, and **any one going
   away reopens the decision**: (a) the `FILES` bucket is read only through `downloadTripFileFn`
   (`grep -rn FILES_PUBLIC_BASE src/` finds only its type, `queue/types.ts:476`); (b) that response is
   `content-disposition: attachment` and `cache-control: private, no-store`; (c) every object is
   also _stored_ with `contentDisposition: attachment` in its R2 metadata (`files.ts:159-163`), so
   even a public domain would serve it as a download; (d) the preview in `06-S4` renders an image
   only through `<img>` and offers no "open in a new tab" for `image/svg+xml` or `text/html`.
   **Hand-off, stated where the next reader will meet it:** `wrangler.jsonc:71` declares
   `FILES_PUBLIC_BASE: https://files.planned.travel`, and `docs/plans/13-content-studio.md` plans to
   serve a public bucket for `cms/` keys. Whether a custom domain is bound to the `FILES` bucket is
   not visible from the repository. Before any stage binds that domain, it must confirm `trips/`
   keys are unreachable through it.

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
- The sentence "the rest of the batch is unaffected" already ships (`files.queue.someFailed`) and is
  reused. No second sentence is added.

The four older refusal sentences (`empty`, `too-large`, `unsupported-type`, `quota`) and the
`MAX_FILES_PER_UPLOAD` sentence in `screening.ts` are English strings built in code. They are
**pre-existing debt**, named in Out of scope for a follow-up, not repaired here.

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
- `nameForPaste(files, now)` — renames a file only when its name is empty or matches
  `^image\.[a-z0-9]+$` (case-insensitive), the placeholder browsers give a pasted screenshot. A file
  copied from a file manager keeps its real name (`Hotel-Lisbon-booking.pdf`). Renamed files use
  `safePastedFilename` and are unique within one paste.
- `shouldTakePaste(event)` — false when `event.defaultPrevented`; when the target is `input`,
  `textarea`, `select` or `isContentEditable`; or when the target is inside `[role=dialog]`,
  `[role=alertdialog]` or `[role=menu]`.

`safePastedFilename(mediaType, now, sequence?)` in `file-policy.ts`:
`pasted-YYYYMMDD-HHmmss.<ext>`, with `-<n>` before the extension for the second and later file of one
paste. The timestamp is the browser's local time (the traveller's own clock) and is locale-neutral
digits. The extension is derived from the accepted-format table (a reverse lookup over
`BY_EXTENSION`), so a pasted PNG lands as `.png` and never as `.bin`; an unknown type gets `.bin`
and is then refused by the policy like any other. The result goes through `sanitiseFilename`, not
beside it.

**Where the listener is.** On the whole Files screen, not on the panel. A traveller who copies a
screenshot, opens Files and presses ⌘V expects it to work without first clicking into a panel; with
a panel-scoped listener nothing would happen and they would decide paste is broken. In
`file-library.tsx`, one `useEffect` adds a `paste` listener to `document` and removes it on unmount,
so a paste on any other screen never uploads to this trip. The handler:

1. returns when `shouldTakePaste` is false, or when `editing !== null` or `confirm !== null` (the
   details dialog's description field, the confirmation) — so pasting text into a field never
   uploads and never gets its default behaviour cancelled;
2. extracts files with `filesFromClipboard`; **calls `preventDefault` only when it found files**;
3. names them, and feeds them to the existing `add()`, so each file shows as a queue row
   immediately and the batch toast reports the outcome, exactly as a drop does.

The panel is **not** made focusable (a departure from the plan, which made it `tabIndex={0}` with an
accessible name): a `tabIndex` stop that does nothing on its own is an extra tab stop that needs a
role to be valid. A keyboard user pastes from wherever focus already is, and still has the "Choose
files" button as the keyboard path for picking.

**The hint.** One line in the drop zone, under the drop copy: the key
`modules.files.drop.pasteHint` followed by `<KbdSequence keys={['Mod', 'V']} />` (`Kbd` renders `⌘`
on Apple platforms and `Ctrl` elsewhere, after mount, in a fixed-width cap, so nothing reflows). The
paste part is hidden under `(hover: none)` or `(pointer: coarse)`, because a phone has no paste
shortcut to press; it is hidden with CSS so the layout does not shift. The empty state is unchanged
(its description is a string and cannot host a key cap, and the drop zone sits directly above it in
both states).

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
  `opacity` transitions at `duration-base` (220 ms) on `--ease-out-quint`. No bespoke
  reduced-motion code: the global rule at `src/styles/styles.css` already collapses every transition.
  The overlay is `aria-hidden` and `pointer-events-none`; the zone's text still changes to
  `files.drop.active`. Dark re-declares its own surface through the tokens.

### Phase 5 (06-S1e) — the browser evidence

The plan's Verification block is written for the visual gate ADR 0016 retired. The live protocol is
`docs/plans/12-verification-protocol.md` §2-§6, and this phase is that, not the plan's text. See
Verification.

### Alternatives considered, and why they lost

| Alternative                                                              | Why not                                                                                                                                                                         |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Refuse `.html`/`.htm` as the plan says                                   | Deletes the shipped booking import of a saved hotel page (ADR 0012), whose dialog shares the upload function and cannot be told apart from it.                                  |
| An "import" flag on the upload so only imports may carry `.html`         | A client-controlled flag would decide a security policy.                                                                                                                        |
| Store `.html` as `text/plain`                                            | The stored `content_type` would say something other than what the file is; the download rule is "echoed verbatim".                                                              |
| Panel-scoped paste (focus the panel first)                               | Silent failure for the commonest gesture (copy, open Files, paste), and an inert tab stop.                                                                                      |
| Move every refusal sentence into the catalogue now                       | Touches every `checkUpload` caller and test for four codes this stage does not change; `describeRejection` makes it one code at a time later.                                   |
| Stacked card list for the table at 360px (the plan's Definition of done) | Not described in the plan's UI section; `06-S2`, `06-S4` and `06-S6` all edit the same row again, so a layout designed now is reworked three times. Deferred, see Out of scope. |

## 📝 Architecture

| Concept                                       | Owner module                                                                                            |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| What may be stored: types, refusals, ceilings | `src/server/fns/file-policy.ts` (pure; the picker, the pre-flight and the handler all import it)        |
| The download header set and the disposition   | `file-policy.ts` (`attachmentHeaders`, `contentDispositionFor`); `files.ts` calls them                  |
| How a refusal reaches the reader              | `screening.ts` (`describeRejection`); the catalogue holds the words                                     |
| Reading the clipboard, naming a pasted file   | `paste.ts` (pure) and `file-policy.ts` (`safePastedFilename`, because the name must pass the sanitiser) |
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
is deleted: `deleteTripFn` reads the keys through `listTripStorageKeys` before the cascade and
enqueues the `trip-purge` task (`src/server/queue/handlers/trip-purge.ts`), which deletes them. **The
plan's "nothing sweeps R2 when a trip is deleted" is stale and is not repeated here.** There is **no
time-based expiry**, and this stage adds none: a boarding pass is the traveller's until they remove
it, and a product that silently deleted a document after ninety days would be worse than one that
charges for the storage. What bounds the cost is the plan ceiling, enforced live on every write
(see Quota). The trash window belongs to `06-S2`.

## 📝 API Contracts

No new server function and no new Zod schema. The scalar bag in `files.ts` gains no field: the
pasted name is produced in the browser and re-sanitised on the server (`sanitiseFilename`), so
nothing new crosses the boundary untyped. Where an existing schema is touched it uses the v4 forms.

| Change                        | Shape                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------ |
| `UploadRejectionCode`         | gains `'blocked-type'`                                                               |
| `UploadRejection`             | gains `params?: Readonly<Record<string, string \| number>>`                          |
| `UploadFailure` (`files.ts`)  | gains `params?` with the same shape; `message` stays required (the English fallback) |
| `downloadTripFileFn` response | unchanged on the wire; built through `attachmentHeaders`                             |

**Authorisation is unchanged and decided in the handler:** `appScope()`, then `requireTrip(scope,
tripId)` before anything is read or written. A trip id from the browser is a claim, not an
authorisation. Nothing is slow enough to enqueue.

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
  uploads, real per-file progress, an `aria-live` announcement on each settle: unchanged.
- **Keyboard and screen reader.** A pasted file produces the same queue row and the same live
  announcement as a dropped one. The hint's key caps are real `<kbd>` elements. There is no new tab
  stop. The drag overlay is `aria-hidden`; the text change to "Drop to upload" is the cue.
- **360px.** The drop zone, the hint and the refusal rows are designed to be usable there. The file
  _table_ is left as it is (it hides "added by" and "when" below `sm`); its 360px frames are captured
  in Phase 5 as evidence, and a defect in them is reported, not fixed here (Out of scope).

## 📝 Visual change expected

Route `/trips/$tripId/files`, light and dark, 360 / 1280 / 2560 px:

- **Resting:** the drop zone gains one hint line (copy below) under the drop copy; on a touch device
  only the lead-in is hidden, the line takes no height when hidden by `(hover: none)`.
- **Drag over (`data-state="active"`):** an opacity-only overlay fades in over the zone; the text
  reads "Drop to upload". Reached only by a drag carrying files.
- **Upload refused:** a refusal row for an `.xml` file, with the new sentence.
- Mobile Safari: the paste part of the hint is absent; nothing else differs.

## 📝 Copy

Every string is a catalogue key in `src/lib/i18n/messages/en/modules.ts` and must land in all 23
locales in the same change (`i18n-messages` skill, the parity test). The plan's "English (en-GB)
only" note is superseded by that rule.

| Key (`modules.` prefix in code) | `en` text                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `files.reject.blockedType`      | `“{name}” was not added. XML and compressed SVG files can carry script, so files of that kind are not stored. Export it as a PDF or an image instead.` |
| `files.drop.pasteHint`          | `Or paste a copied file or screenshot with`                                                                                                            |

Reused as they are: `files.drop.idle`, `files.drop.active`, `files.queue.someFailed`,
`files.action.choose`. The English fallback `message` that `checkUpload` returns for `blocked-type`
is a code-side string, not a catalogue key.

## 📝 Edge Cases & Failure Scenarios

| Case                                                      | Behaviour                                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| Paste of plain text (not in a field)                      | No files, no `preventDefault`, no upload; the browser's default stands.                                       |
| Paste into the details dialog's description, or any input | Ignored by `shouldTakePaste`; text pastes normally.                                                           |
| Paste while a dialog or menu is open                      | Ignored.                                                                                                      |
| `clipboardData.files` empty, `items` holds a file         | Read from `items`; never both.                                                                                |
| Two screenshots in one paste                              | `pasted-…-<ts>.png` and `pasted-…-<ts>-2.png`: unique labels in the queue.                                    |
| A file copied from a file manager                         | Keeps its real name.                                                                                          |
| `boarding.pkpass` as `application/octet-stream` or `''`   | Accepted by extension as `application/vnd.apple.pkpass`, kind `ticket`; downloads under that type.            |
| `boarding.pkpass` claiming `application/pdf`              | Stored as `application/pdf` (the claimed allow-listed type wins, as for every file); not served as a pass.    |
| `x.xml`, `x.xhtml`, `x.svgz`, any claimed type            | `blocked-type`, in the traveller's language, on both the pre-flight and the server path.                      |
| `x.gpx` claiming `application/xml`                        | Accepted (the named exception).                                                                               |
| `x.pdf` claiming `text/html`                              | Stored as `application/pdf`.                                                                                  |
| `page.html`, `page.htm`                                   | Still accepted; the booking import still reads them.                                                          |
| 25 MB exactly / 25 MB + 1 byte                            | Admitted / refused `too-large`.                                                                               |
| Quota exhausted mid-paste                                 | Per-file `quota` refusal rows, as for a drop; the compensating R2 delete still runs on a server-side refusal. |
| Drag of selected text over the page                       | The zone stays idle.                                                                                          |
| Pointer crosses onto the zone's button mid-drag           | The zone stays active.                                                                                        |
| Paste on another screen                                   | The listener is removed on unmount; nothing uploads to this trip.                                             |

## 📝 Observability

No new log or metric. The audit trail entry (`FILE_UPLOADED`) written after the row by `00-S3` is
unchanged and covers a pasted file like any other.

## ✅ Acceptance criteria

1. `boarding.pkpass` with an empty or `application/octet-stream` type passes `checkUpload`, resolves
   to `application/vnd.apple.pkpass` and kind `ticket`; the picker's `accept` lists `.pkpass`.
2. `attachmentHeaders` echoes the stored media type verbatim and always sets
   `content-disposition: attachment` and `cache-control: private, no-store`, including for a
   `text/html` row and a `.pkpass` row.
3. `.xhtml`, `.xml` and `.svgz` are refused with `blocked-type` whatever media type is claimed, and
   so are `application/xhtml+xml`, `application/xml`, `text/xml` under any filename except `.gpx`.
   `.html` and `.htm` still pass `checkUpload` and `importReaderFor`.
4. A claimed `text/html` on a filename whose extension is not `html`/`htm` is not stored as
   `text/html`.
5. A `blocked-type` refusal is worded from the catalogue on the pre-flight path **and** when only the
   server refuses; both locales' parity test passes.
6. A paste of files, anywhere on the Files screen outside an editable field or an open dialog, puts
   each file in the upload queue; a paste of text does nothing and is not cancelled.
7. A pasted screenshot is named `pasted-YYYYMMDD-HHmmss.<ext>` with the extension from its media
   type; a file copied from a file manager keeps its name; names are unique within one paste.
8. The drop zone turns active only for a drag carrying files, does not flicker over children, carries
   `data-part="file-drop"`, and animates opacity only.
9. `pnpm typecheck`, `pnpm lint`, `pnpm test`, `bash .ai/scripts/check-generated.sh`, `pnpm build` are
   green; the booking-import tests (`import-dialog.test.tsx`, `booking-import.test.ts`,
   `file-policy.test.ts`) are green unchanged.
10. The e2e block `06-S1 — every way a file gets in` passes on `chromium` and `mobile-safari`
    (layout-shift skipped, stated, on WebKit), with a silent console.

## 📝 Risks & Impact Review

| Risk                                                                     | Mitigation                                                                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Markup (`.html`, `.svg`) stays storable                                  | The four-part mitigation in Phase 2, written into `file-policy.ts`; a test asserts `attachment` for a `text/html` row; the public-domain hand-off is named.                                                                                                                                      |
| A public domain on the bucket is unverified from the repo                | Hand-off to whichever stage binds `FILES_PUBLIC_BASE`; `trip-copy.ts` copies objects with `copyObject`, which keeps only `contentType`, so a copied object loses its stored disposition — the download path ignores object metadata, so this does not weaken it, but it is noted for that stage. |
| A document-level listener could swallow a paste meant for something else | `preventDefault` only when files were found; ignored for editable targets, dialogs, menus and `defaultPrevented`.                                                                                                                                                                                |
| An operating system labels a real `.gpx` as `application/xml`            | The `.gpx` exception.                                                                                                                                                                                                                                                                            |
| Two phases edit `file-library.tsx`                                       | Phase 3 (listener, hint) and Phase 4 (drop zone) touch different blocks; they are sequential tickets.                                                                                                                                                                                            |

### Out of scope

- **The files table at 360px.** The plan's Definition of done asks for a stacked card list. It is
  not described in the plan's UI section, and later stages edit the same row. This stage captures
  the table's 360px frames; if they show the likely defect (`table-fixed` plus columns of 112, 96
  and 48 px leave the file name about 70 px), the implementation run files a follow-up issue with
  the frames attached. The plan's card box is **not ticked** here.
- Moving the four older refusal sentences, and `MAX_FILES_PER_UPLOAD`'s, into the catalogue
  (`describeRejection` makes it one code at a time).
- The hardcoded English in `src/routes/_app/trips/$tripId/files.tsx` and `StorageMeter`
  (`"unlimited"`, `"of"`, the stat-card labels).
- Starring and trash (`06-S2`), the preview and lightbox (`06-S4`), file links (`06-S6`).
- Raising the 25 MB ceiling, thumbnails, any time-based expiry.
- `.pkpass` import: the booking import still refuses it by name.

## 📋 Phasing

| Phase | Slice    | What a traveller can do when it merges                                       | Blocked by |
| ----- | -------- | ---------------------------------------------------------------------------- | ---------- |
| 1     | `06-S1a` | Upload an airline's wallet pass and download it as one                       | —          |
| 2     | `06-S1b` | Be told, in their language, why an XML or compressed SVG file was not stored | —          |
| 3     | `06-S1c` | Paste a screenshot or a copied file onto the Files screen                    | Phase 2    |
| 4     | `06-S1d` | Drag files over the zone and see it react to files only, without flicker     | —          |
| 5     | `06-S1e` | (Evidence) the stage's e2e block and frames                                  | Phases 1-4 |

Phase 3 is `Blocked by` Phase 2 because both edit `screening.ts`/`upload-queue.ts` types and paste's
refusal rows use `describeRejection`.

## 📋 Implementation Plan

### Phase 1 — the wallet pass

1. `file-policy.ts`: the three pkpass entries; `attachmentHeaders` and `contentDispositionFor`.
2. `files.ts`: `downloadTripFileFn` builds its headers through the helper; `bucket.put` uses
   `contentDispositionFor`.
3. Tests (`upload-policy.test.ts`, `file-policy.test.ts`): `.pkpass` with `''` and
   `application/octet-stream` → `application/vnd.apple.pkpass`, kind `ticket`; `attachmentHeaders`
   echoes `application/vnd.apple.pkpass` and, for a `text/html` row, still `attachment`;
   `importReaderFor('pass.pkpass', …)` stays `null`.
4. Run the Docs-and-CI grep (`AGENTS.md`): search `docs/`, `AGENTS.md`, `README.md`, `.ai/` for
   `pkpass`, `ACCEPT_ATTRIBUTE`, `unsupported-type` and update every document that states the
   accepted formats.

### Phase 2 — the refusal list

1. `file-policy.ts`: `blocked-type` code and `params`; the extension list and the claimed-type list
   (with the `.gpx` exception) checked before the allow-list; the `text/html` binding in
   `resolveContentType`; the four-part exception comment; the 25 MB docblock.
2. `files.ts`: `UploadFailure.params`, `refuse(code, message, params)`.
3. `screening.ts`, `upload-queue.ts`, `upload.ts`, `file-library.tsx`: `describeRejection`; `fail`
   takes `DeferredMessage | string`; the answer handler maps by code.
4. `files.reject.blockedType` in all 23 locales.
5. Tests: `blocked-type` for each of the three extensions with each claimed type, including
   `application/pdf`, `text/html` and `image/svg+xml`; each XML media type under a neutral filename;
   `.gpx` + `application/xml` accepted; `.html`/`.htm` accepted; `x.pdf` + `text/html` stored as PDF;
   `x.exe` + `text/html` refused; both paths in `upload-queue.test.ts` render the catalogue message.

### Phase 3 — paste

1. `safePastedFilename` in `file-policy.ts`; `paste.ts` with the three pure functions.
2. `paste.test.ts`: names are stable, sortable and sanitised for each accepted image type; a payload
   with `files` and one with only `items` produce the same upload input; both populated never double;
   plain text produces nothing; a file with a real name keeps it; two screenshots in one paste get
   distinct names; `shouldTakePaste` is false for `input`, `textarea`, `[contenteditable]`, inside
   `[role=dialog]` and when `defaultPrevented`.
3. `file-library.tsx`: the effect, the `editing`/`confirm` guard, `preventDefault` only on files;
   the hint line with `KbdSequence`; `files.drop.pasteHint` in all 23 locales.

### Phase 4 — the drop zone

1. `file-library.tsx`: `data-part`, `data-state`, files-only detection, the flicker fix, the opacity
   overlay.
2. A component test for the zone (`.test.tsx`, `ui` project): a text drag leaves it idle; a files
   drag sets it active; a `dragleave` whose target is a child leaves it active; `drop` clears it.

### Phase 5 — the evidence

Described under Verification. Last, so it measures the finished screen.

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
reaching a real `FileLibrary` in a real browser.

- **Nothing here writes to the shared demo workspace** (`trips-core.spec.ts` and `places-and-maps.spec.ts`
  give the same reason: an upload is an additive write both browser projects share). Tests that
  reach an upload intercept the upload request with `page.route(...)` and fulfil it with
  `{ ok: true, … }`; they assert on the request the browser made (the multipart body names the
  pasted file `pasted-…png`), not on a stored row.
- **Tests.** (1) A synthetic `ClipboardEvent('paste')` carrying a `File` named `image.png` on
  `document` produces one upload request for `pasted-YYYYMMDD-HHmmss.png`. (2) A paste of text into
  the details dialog's description uploads nothing. (3) A drag carrying `Files` sets
  `[data-part="file-drop"]` to `data-state="active"`; a text-only drag does not. (4) Attaching
  `notes.xml` through the hidden input renders a refusal row in the catalogue language with no
  request sent.
- **Selectors** (`[data-part="file-drop"]`, `[data-state]`) are verified against a running server
  with `page.locator(sel).count()` returning `1` before any frame is filed. Reading the JSX is not a
  verification.
- **Console silent.** `watchConsole(page, route)` before navigation, `fatal` asserted empty at the end
  of every test in the block; nothing is added to `TOLERATED_CONSOLE_WARNINGS`.
- **No layout shift after paint.** A `layout-shift` `PerformanceObserver` as an init script
  (entries with `hadRecentInput` excluded), `visit()` then `settle()`, `performance.now()` as the
  mark, then the active drop state is entered and a file refused; the sum after the mark is `0`.
  Gated on `PerformanceObserver.supportedEntryTypes`, with a stated skip on `mobile-safari`
  (the pattern is `places-and-maps.spec.ts`'s).
- **Frames**, read by a human, outside the repository: `scripts/visual/capture.mjs` for the resting
  route (light and dark at 360x800, 1280x900, 2560x1440, `--auth`, `PT_SERVER_TODAY=2026-08-20`,
  quoted in full in the evidence). The two declared non-resting states, `drop-active` and
  `upload-refused`, cannot be reached by `--click` (a drag is not a click), so the spec screenshots
  them at the same six viewport/theme pairs as test attachments. The 360px frames of the **files
  table** are included, for the Out of scope note.
- Nothing is compared to a stored pixel, and `maxDiffPixelRatio` is not mentioned.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                | Applied default                                                                                                                                                                                                                                              | Why                                                                                                                                                                                                                                                                                                                                    |
| --- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Does the stage refuse `.html`/`.htm` as the plan says?                  | No. Keep them as a documented exception; refuse `.xhtml`, `.xml`, `.svgz` by extension and `application/xhtml+xml`, `application/xml`, `text/xml` by claimed type (`.gpx` excepted); bind `text/html` to its extensions.                                     | Decided by security and tenancy sub-agent (confidence medium): `.html` is what the in-progress booking import reads through the same upload function (ADR 0012, spec 2026-09-11); the SVG argument applies equally; closing it later is a one-line edit. Conditions applied above, including the public-domain hand-off.               |
| 2   | Where does paste listen, and what does it rename?                       | A `document` listener while `FileLibrary` is mounted, ignoring editable targets, dialogs and menus; no `tabIndex` on the panel. Rename only empty or `image.<ext>` names.                                                                                    | Decided by UX (traveller) sub-agent (confidence medium): a panel-scoped paste fails silently for the commonest gesture and adds an inert tab stop; real file names must survive. Departs from the plan's panel-scoped wording.                                                                                                         |
| 3   | Is the stacked card list at 360px in this stage? Is the drop-zone work? | Card list: no, deferred, plan box not ticked, table's 360px frames captured. Drop zone: yes, including the opacity-only overlay, files-only detection, no flicker, `data-part`. Hint: yes. Evidence: live protocol. Isolation test: cite existing, add none. | Decided by product owner sub-agent (confidence medium): the card is not described in the plan and three later stages edit the row again; the overlay is one element and removes the one motion-rule breach on the element being rewritten. Existing isolation cases (`:921`, `:1311`, `:1667`) already cover the unchanged repository. |
| 4   | Table follow-up: file an issue now?                                     | The spec names it under Out of scope; the implementation run files the issue only if its 360px frames show the defect.                                                                                                                                       | The product owner asked for an issue to be filed; `afk-plan-to-spec` forbids this run filing tickets, so the exit is carried into the implementation phase. Applied by the spec author.                                                                                                                                                |
| 5   | Where does the `blocked-type` sentence live?                            | In the 23-locale catalogue (`files.reject.blockedType`), mapped by code on the pre-flight and server paths; the four older sentences stay as named debt. `message` remains an English fallback.                                                              | Decided by software architect sub-agent (confidence medium): the plan's "English only" predates the 23-locale rule; `DeferredMessage` and the queue already carry it; reversible one code at a time.                                                                                                                                   |
| 6   | How is the stage evidenced?                                             | `e2e/documents-and-media.spec.ts` (no `.visual.` infix), existing helpers, request interception so nothing is written to the demo workspace, console and layout-shift assertions, frames from `capture.mjs` plus spec screenshots.                           | Same architect verdict: ADR 0016 retired baselines, `shoot.ts` and `auditServerClock`; `places-and-maps.spec.ts` is the pattern. The plan's §7.2/§7.3 blockers concern baselines and are dropped (`file-library.tsx` no longer builds its own `Intl.DateTimeFormat`).                                                                  |
| 7   | Does the 25 MB per-object ceiling change?                               | No; its docblock gains the cost reason and an exact-boundary test.                                                                                                                                                                                           | The plan decided it explicitly (storage cost, `PLAN_QUOTAS`); applied as written.                                                                                                                                                                                                                                                      |
| 8   | Is "nothing sweeps R2 when a trip is deleted" still true?               | No: `trip-purge` deletes the objects since PRD #104. The spec states the real retention.                                                                                                                                                                     | Measured: `listTripStorageKeys` is called at `trip-lifecycle.ts:311` and the handler is `queue/handlers/trip-purge.ts`; the plan predates both.                                                                                                                                                                                        |
| 9   | Does the download need a behaviour change to echo the media type?       | No. It already echoes `row.contentType`; the stage extracts `attachmentHeaders` so the header is unit-testable and adds the assertions.                                                                                                                      | `files.ts:332-340` at HEAD.                                                                                                                                                                                                                                                                                                            |
| 10  | Is the hint added to the empty state?                                   | No, only to the drop zone, which is directly above the empty state in both states.                                                                                                                                                                           | `EmptyState`'s description is a string and cannot host a key cap; avoids a duplicate. Applied by the spec author (the specialist suggested reuse; the drop zone already shows it).                                                                                                                                                     |
| 11  | How are two pasted screenshots named, and in which clock?               | `pasted-YYYYMMDD-HHmmss.<ext>`, `-<n>` suffix from the second file of one paste, browser local time, extension from the accepted-format table (`.bin` for an unknown type).                                                                                  | Applied by the spec author: unique queue labels and locale-neutral digits were conditions of verdict 2.                                                                                                                                                                                                                                |
| 12  | Does a file named `x.pkpass` claiming `application/pdf` become a pass?  | No: the claimed allow-listed type wins as for every file; the extension is the fallback, never the override.                                                                                                                                                 | `resolveContentType`'s documented rule; unchanged.                                                                                                                                                                                                                                                                                     |
