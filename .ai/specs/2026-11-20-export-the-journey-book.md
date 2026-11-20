# Export the Journey book

| Field              | Value |
| ------------------ | ----- |
| **Status**         | ready |
| **Issue**          | #1288 |
| **Spec PR**        | none  |
| **Implementation** | none  |

## Problem

A traveller can export a trip plan, but cannot take the story and photographs of one Journey with them. The trip export requires a trip ID and accepts a text document snapshot. A Journey can have no trip, and neither the trip access check nor the text-only document represents a Journey book.

## Proposed solution

On the authenticated Journey detail screen, any current reader can request a private, printable A4 landscape PDF for their own download. The book contains the Journey title, date range and all visible entries with their entry-linked photos and captions. Unattached library photos, hidden metadata, coordinates from photo metadata, and unrelated trip content are excluded. An empty Journey has a title page with a localized empty-story message.

### Ownership and scope

Stage [06-S8](../../docs/plans/06-documents-and-media.md#stage-06-s8--export-the-journey-book) owns the Journey book portion of DOC-06 in wave 7, after 00-S4 and 07-S8 for the shared TASKS contract and after 08-S3, 08-S7 and 08-S10 for the Journey screen. 06-S3 owns the existing trip plan document. The 06-S8 consumer contract lands first, followed by text export and then photograph support. Enable the authenticated Journey action only after all slices pass the integrated gate.

Out of scope: generic or bulk Journal export, single-day export, photo selection, public sharing, email, a trip export redesign, and the trip-export retention cron follow-up.

### Book and layout

- Emit A4 landscape pages (297 × 210 mm) with 12 mm margins. The title, dates, entry headings, body text and captions use the request locale and direction. Render text as selectable, escaped text. Preserve authored line breaks and allow long text and captions to wrap and continue.
- Use entry date, sort order and ID for entries, and sort order and ID for each entry's photos, as in the Journey story reader. Within each entry, render its heading and text before the photo group. With zero usable photos, render only the story text. With one photo, use a single centered wide slot. With two to four, use up to two columns and two rows, with equal-width slots and the last odd photo centered in its row. For more than four, continue in groups of four, applying the same rules to the final group. Keep each image and its leading caption together and preserve aspect ratio without cropping or stretching. A photo group that cannot fit in the remaining space starts a new page. No text or image may cross the printable margin.
- A missing, unsupported, invalid or wrongly scoped photo is unavailable. Exclude it before assigning slots and include an omission count in the book and completed status. With all photos unavailable, the result remains readable as a text book. Temporary storage, normalization or rendering infrastructure failures retry without publishing a falsely complete file.
- Initial maximums are 100 entries, 100 attached photo references, 50,000 UTF-8 text bytes across the projection, 10 MiB source bytes and 24 megapixels per photo, 12 MiB total normalized image bytes and 20 MiB output. Normalize images to at most 1,600 px on their longest side, with orientation applied and metadata removed. Enforce limits before unbounded buffering or allocating decoded pixels. Bound concurrency and memory under the deployed Worker profile. An exceeded book budget returns a localized too-large failure without a partial book. Runtime review must verify these ceilings together against a worst-case render before enabling the feature.

### Request, progress and download

Use one action on the authenticated Journey detail screen with localized request, queued, rendering, ready, ready-with-omissions, expired, too-large and failed states. Announce status changes without moving focus. On reload, show the current request if the reader is still authorized. Allow a fresh request after terminal failure or expiry. Repeated requests while an export is active reuse one request per requester and Journey. Reuse a ready artifact only while its source and access revisions still match. Access loss removes the panel on refresh and yields the same unavailable response as an unknown Journey or request. Disable new requests when the approved renderer is unavailable. No HTML download fallback for Journey books.

Poll through a requester-scoped status interface, stop at terminal state or unmount, and distinguish transport failure from export failure. Use the existing Journey-detail interaction patterns, 23-locale parity, keyboard operation, and mobile and desktop browser verification. Completion shows a download action with an accessible PDF label and expiration time. Use a sanitized filename without user-controlled headers and a private, no-store response.

### Visual change expected

The Journey detail screen gains a single export action and its status area. Verify keyboard focus, live announcements, RTL, and no clipped actions at mobile widths. Capture the repository's blind A/B browser evidence for the changed screen at desktop and mobile sizes in both themes. Include representative printable pages separately.

### Copy

Use the Journey locale catalogue for the action and all panel messages. Include catalogued document labels for the empty story and omitted-photo count, with plural forms and a locale-formatted expiry. Verify parity across all 23 locales. Preserve authored entry text and captions as entered.

## Architecture and compatibility

### Queue and document

Add a separate strict TASKS discriminant `journey-book-export` to the canonical union with payload `{ exportId }`. The existing envelope supplies the workspace. Validate the envelope and resolve the authoritative export record by its workspace and export ID. Derive the acting user from that record’s requester and re-authorize them against current primary membership. No Journey text, photo URLs, storage keys or access grants in messages. Preserve the existing `pdf-export` discriminator, payload, document and handler, including already queued messages and the trip fallback. Register the consumer first with admission disabled. Record consumer deployment evidence for each environment before enabling its producer. Disable producers and drain pending Journey jobs before rollback to a consumer that predates the discriminator.

After authorization, project a typed Journey document in-process from the current scoped repository. The Journey model has ordered entry text and normalized owned images with optional captions. Keep layout deterministic and independent of the renderer. The renderer accepts bounded self-contained markup with escaped content and embedded normalized bytes. Disable external resource loads and reject raw URLs and raw markup from source data. Only a processor whose private-data handling and isolation passed runtime security review may render it.

### Artifact and authority

An additive tenant-scoped export record stores opaque export ID, Journey ID, requester ID, locale, state, attempt token, source and access revisions, timestamps and bounded outcome metadata. Workspace is part of every lookup. Allocate attempts with compare-and-set. Use an immutable per-attempt object key under a canonical workspace/Journey export prefix. Publish a ready pointer only via a guarded write for the current attempt. Uncommitted objects are inaccessible. Retries reconcile the same request, cannot overwrite a newer result, and clean abandoned objects idempotently. Durable admission and queue send must be recoverable after interruption, including a lost acknowledgement, without stranding a request in queued state.

Run all authorization checks through current primary workspace membership and the Journey readability predicate in ADR 0020 and ADR 0034. A trip-linked Journey follows its trip, including private trip membership. A Journey that never had a trip is readable to current workspace members. An Orphaned journey is readable only to its owner while that person remains a workspace member. An Orphaned journey owned by a Former member stays unreadable under ADR 0043. A reader can request and download their own artifact only. A workspace role or a public share link grants no independent export bypass. Bind queue creation to an authenticated, rate-limited admission and the stored requester, and keep queue consumption private to the Worker.

Check authority at request, status, consumption, publication and download. Use a consistent readable source projection or reject the attempt if its revisions changed. Bind photo reads to authorized entry/photo associations and validate each object key against the canonical workspace and Journey storage ownership before loading bytes. Historical unsafe keys are unavailable. Fence ready publication against source edits, photo changes, deletion, reattachment, workspace deletion and access loss during rendering. The guarded write must check current revisions at statement execution. A revoke-and-regrant or leave-and-rejoin changes the grant generation. It cannot revive the old artifact. If current schema lacks the required monotonic revisions, add and test the necessary generations and their writers before enabling a producer. Validate revisions again when opening the authenticated download stream, with a final primary check after opening the private object and before responding. Treat absent, expired, cross-workspace and unreadable downloads identically. Stream through the application without direct or signed bucket URLs.

Ready files expire after 24 hours from publication. Enforce expiry on every status and download independently of physical cleanup. Remove invalidated, expired and abandoned objects and stale request records with bounded, idempotent cleanup and retry. Journey deletion, workspace deletion and erasure must cover the export records and dedicated object namespace without walking trip-export prefixes. Publication must fail closed during active workspace deletion. Track queue latency, outcomes, omissions and stale-object cleanup without logging rendered content, photo identifiers, storage keys or signed data. Verify cleanup convergence after an in-flight write races with deletion.

## Acceptance criteria

1. An authorized reader can export and download a complete A4 landscape Journey book from the Journey detail screen. The same flow supports a trip-linked Journey, a Journey that never had a trip, and an owner-readable Orphaned journey.
2. Real layout tests exercise 0, 1, 2, 3, 4 and 5 usable photos, multiple entries, long text, RTL, all photos unavailable, partial omissions and each limit at and above the boundary. Check page dimensions, stable order, aspect ratios and continuation. A browser/print check verifies dimensions and visible layout in a PDF from the approved renderer.
3. Existing trip messages, exports and retrieval still work. The canonical consumer rejects invalid Journey payloads, treats replays idempotently, and is deployed before a producer sends the new kind.
4. Cross-workspace requests and downloads, non-requester access, an unreadable private trip, a non-owner orphan read and a Former-member-owned orphan all fail closed. Revoke access at each asynchronous boundary, edit/remove photos during render, orphan or delete the Journey, depart and rejoin, and begin workspace deletion. Verify no stale ready state, usable artifact or unauthorized photo fetch.
5. The Journey screen shows localized queued, rendering, success, omissions and failure states. Duplicate clicks and reload preserve the active request, expired downloads are inaccessible, and injected storage/queue faults leave no durable pending state or orphaned object after reconciliation.

## Phasing

### Phase 1 - Admit, authorize and reconcile the job

Own the canonical envelope, consumer registration and durable request/status transitions. Deploy an inert consumer. Prove the request-to-consumer seam with a tenant-scoped repository, local D1 and a controlled queue adapter, including mismatch, duplicate delivery, interruption and old trip envelopes. Acceptance is a recoverable authorized request lifecycle behind disabled admission. **Depends on:** 00-S4, 07-S8. **Risk:** high, shared queue, schema and authorization.

### Phase 2 - Request and download a text Journey book

Connect the Journey action to the queue, real in-process text layout, the approved renderer seam, private artifact storage and authenticated download. Use local bucket adapters and a fake for the external renderer in tests. Cover source/grant generation changes, retries, tenant boundaries, deletion, expiry and cleanup; run the authenticated browser journey in both directions and both themes at desktop and mobile sizes. Acceptance is a complete text book from a text-only Journey in the scoped test environment. Keep release admission off. **Depends on:** Phase 1 deployed, 08-S3, 08-S7, 08-S10. **Risk:** high, private content and artifact lifecycle.

### Phase 3 - Render the complete photo book and enable admission

Extend the in-process Journey model with authorized photos and count-driven layout. Exercise actual photo normalization/layout and real repository authorization against local storage. Use the renderer fake for error and concurrency tests and an approved processor for a print smoke test with synthetic data. Verify every acceptance criterion and the deployment evidence before enabling producer admission. **Depends on:** Phase 2 and fresh security approval of the photo and processor boundary. **Risk:** high, private photo access and external rendering.

Each runtime ticket requires a fresh security and tenancy verdict before claim, with its conditions added to acceptance. All phases run the configured gate. Implement each regression at the named module interface before the corresponding change.

## Resolved assumptions

| Question                                                                 | Applied default                                                                                                                | Why                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| What belongs in the book when photos are missing or the Journey is long? | Export the full readable story with entry-linked photos. Reflow with visible omissions. Fail whole books above audited limits. | Independent product owner, high confidence. The story reader already owns entry/photo order and the separate media library includes unattached material.                                                                                |
| How should queued exports preserve access and privacy?                   | Use an additive ID-only task, a primary-authorized requester record, fenced publication and private mediated download.         | Independent security and tenancy reviewer, high confidence. Trip export snapshots and once-per-job trip checks do not model the Journey's changing reader set or photo ownership. The runtime gates above carry the verdict conditions. |
