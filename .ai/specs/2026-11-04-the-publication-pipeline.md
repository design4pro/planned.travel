# The publication pipeline

| Field | Value |
| --- | --- |
| **Status** | ready |
| **Issue** | none |
| **Spec PR** | #1846 |
| **Implementation** | none |
| **Plan** | 13-S1 (docs/plans/13-community-gallery.md) |

## TLDR

Plan stage 13-S1 in `docs/plans/13-community-gallery.md` establishes a workspace-admin submission pipeline for a reviewed gallery publication. The private preview foundation and unmounted publication dialog are implemented; lifecycle callbacks remain caller-owned until the runtime slices land. It stores an explicitly selected, tenant-isolated snapshot and provides an unmounted publish dialog; subsequent stages mount the dialog, curate and expose the gallery.

## Problem

A workspace cannot submit a trip for curation or withdraw its submission. Publishing a trip requires an explicit disclosure boundary so private trip data cannot leak through a future public view.

## Critical design decisions

The plan predates the current tenant isolation, storage admission, queue and deletion contracts; implementation must reconcile those contracts and safely handle retries and concurrent changes before this specification can be ready for slicing.

## Proposed solution and boundaries

This stage owns submission, a private immutable version for review, withdrawal and the standalone dialog. No route mounts the dialog, and no public gallery or curator UI is introduced. Later stages must approve the exact stored version and gate public reads against current authoritative D1 state. A queued release handler in this stage has no publish producer; it must not make private snapshots public. Preserve the previously approved version while an update is under review. A withdrawal prevents new authoritative reads and schedules retraction; already downloaded or cached copies cannot be recalled.

The plan's wave-0 schema and quota prerequisites did not land: searches of `src/server` and `drizzle` find no community tables, metric or queue kinds. Existing `trips.ts` locale files and `collab.tsx` already exist. The plan's file ownership is a starting point, not permission to reproduce obsolete APIs: the changed architecture requires the additional storage, migration, recovery and deletion integration below. No dependency, route or binding is added.

## Architecture and data

`src/server/repos/community.ts` owns publication state, tenant-scoped writes and quota admission. Extend `src/server/db/schema.ts` and generate an additive migration for:

- `community_trips`: `id`, `organization_id`, `trip_id`, status (`in_review`, `changes_requested`, `published`, `withdrawn`), current version, nullable live version, submitted/reviewed timestamps and actor IDs, review note, nullable slug, and public title, summary, attribution and show-dates choice. Use org-led indexes, a unique `(organization_id, trip_id)` and a unique nullable slug. A publication is live for quota purposes whenever status is not `withdrawn`.
- `community_publication_versions`: tenant and publication IDs, version, snapshot state, frozen snapshot JSON, immutable storage key and counts. Uniqueness on `(organization_id, publication_id, version)`; retain the currently live version independently of the pending one. Approval must identify both version and immutable key. Foreign keys and checks prevent negative counts and invalid states.
- A tenant-owned work/outbox record with unique operation id, kind, publication and version, state, retry timing and attempts. Persist the pending operation atomically with its transition using the existing D1 batch mechanism. Queue payloads and dead letters contain identifiers only, never snapshot contents.

Use a single atomic conditional SQL transition, including the effective quota and live count, to admit insertion or withdrawn-to-review reactivation. Concurrent submissions at the last slot cannot both succeed. Resubmitting an already-live row increments version without consuming a new slot; a unique constraint and conditional updates settle races. `resolveLimits()` remains authoritative, including overrides. Add the `community_trips` usage metric and operational tier defaults free 1, starter 10, pro 100, business unlimited; these are limits, not catalogue prices. Test every tier and override. A rejected admission leaves no row, work, object or charge.

At submit, capture the allowlisted document into the tenant-scoped version row in the same real D1 transaction as admission and the outbox insert. A single deterministic ordered SQL capture statement observes one consistent source state; never emulate a transaction with sequential writes. Enforce at most 366 days, 1,000 places and 512 KiB of encoded JSON inside the same atomic operation. Exceeding any bound rejects the whole submission with no slot or partial state; no truncation. If D1 cannot guarantee these bounds and atomicity, fail closed rather than use mixed-time reads. The queue worker reads this frozen JSON, never the live trip, and copies it to R2. A capture that has not yet reached R2 remains pending, not ready for review.

`src/server/community/snapshot.ts` owns a strict versioned schema and builder. Its allowlist is public title, summary, attribution, show-dates, country codes and ordered days with optional date/title and places containing only name, category, optional coordinates and order. Strip dates entirely when the choice is false. Never include travellers, membership, notes, files, costs, reservations or arbitrary source JSON. Validate on both write and read, reject unknown keys, bound document size and return a visible failure when it cannot fit; do not silently truncate. Free-text fields must be presented to the submitter as public content, and cannot be represented as automatically scrubbed of personal information.

The existing queue envelope carries organization context. A handler opens a tenant scope from that trusted envelope, verifies the operation belongs to it, and reads content only through scoped repositories. Do not introduce the plan's unscoped whole-row resolver. Any discovery function for recovery follows SPEC §5 FU-3: `Unscoped` suffix, file-header justification, one named production caller, bounded indexed scan and identifiers/timing only. No tenant content crosses that boundary. Scoped reads also enforce the source trip's private membership rules; workspace admin alone is not a bypass.

`src/server/queue/types.ts`, `consumer.ts` and new `handlers/community-snapshot.ts` and `community-release.ts` own task validation and dispatch. Keep work pending until the handler commits a terminal outcome, not merely until queue send succeeds. An indexed bounded periodic dispatcher on the existing scheduler retries pending work with backoff. Lost sends, duplicate delivery and crashes after send are safe; terminal failure is visible and allows an explicit new retry. Consume new kinds before enabling producers. CAS fences include tenant, operation, publication, version and expected state: a stale task, update, withdrawal or trip deletion cannot install or resurrect a version. Each attempt owns a unique candidate key and may clean up only its own candidate. A completed version is never overwritten by a retry.

`src/server/repos/storage-admission.ts` and `src/server/storage/admission.ts` remain the only owners of byte/object admission and fencing. Under ADR 0050 reserve before a create-only R2 put; settle the reservation only when the version key is atomically installed. Extend retained-object reference detection so pending/live snapshot keys are not collected, and use the existing cancellation tombstone and retry rules for abandoned candidates. Use `trips/<organizationId>/<tripId>/gallery/<publicationId>/<version>/<candidate>` keys, matching existing storage validation and trip cleanup. Extend trip purge and workspace erasure paths under ADRs 0043 and 0048; cascades alone do not delete R2 objects. Deletion, failed cleanup, quota charges, concurrent upload/teardown and absence of D1 fail closed. Do not claim global KV invalidation is immediate.

## Confirmed snapshot preview

Implementation note (#1884): the private preview foundation lives in `server/community/snapshot.ts`, `server/repos/community.ts` and the unmounted `components/gallery/preview.tsx`. Its scheduled expiry uses bounded FU-3 identifiers/timing discovery from `server/community/expiry.ts`; the exact stored SQL JSON bytes remain authoritative. Trip/workspace cascades and personal erasure remove the private documents. This slice adds no submission producer, object writer, public reader or mounted route.

Before submission, `previewGallerySubmissionFn` uses the same scoped authorization, deterministic capture, schema and bounds as submission and returns the complete allowlisted document, including all days, dates when enabled, places, coordinates, country codes and public metadata. Render every included value in the dialog in a readable, accessible scrollable preview, including explicit empty values; never hide entries behind an abbreviated count. Preview exposes no excluded fields. Editing a public form field invalidates the confirmation and requires a fresh preview.

Bind confirmation to the exact canonical UTF-8 document through a short-lived opaque server-side preview record scoped to the actor, organization and trip; a client-provided document or digest is not authority. On submit, reauthorize and atomically recapture the canonical document with the same deterministic SQL, compare it byte-for-byte with the stored preview, and admit, freeze and enqueue only on equality in the same atomic operation. A changed source or expired preview returns a stale-preview result, creates no publication, work or charge, retains form values, and requires a new preview and explicit confirmation. A replay cannot bypass current authorization, quotas or version fencing. Fail closed if D1 cannot provide the atomic comparison and capture. The submitted immutable bytes must equal the document the user confirmed. The scoped repository owns preview records: allow at most one per actor and trip, atomically replace the prior preview, enforce the 512 KiB document bound and a 15-minute expiry, and index expiry for bounded scheduled cleanup. Delete previews during trip purge and workspace erasure, including failed or expired previews; deletion failures keep erasure pending. Test replacement, expiry cleanup, limits, tenant isolation and both deletion paths, including cleanup failure.

## Server contract

Add `src/server/fns/community.ts` with Zod strict input schemas. Resolve session and tenant using `appScope()`, require workspace admin/owner and `requireTrip` access on every submission and withdrawal; never accept organization or actor from the client. Reads of publication state are from scoped D1 and require trip access. Unknown or cross-tenant identifiers follow existing not-found behaviour.

- `previewGallerySubmissionFn` (POST): `{ tripId, publicTitle, summary, attribution, showDates }`; validate and authorize as for submit, return the full preview and opaque preview identifier, with expiry.
- `submitToGalleryFn` (POST): `{ tripId, publicTitle, summary, attribution, showDates, previewId }`; trimmed title 1–120, summary 1–280, attribution 1–80, boolean dates. Insert or resubmit the same publication, atomically advance the version and enqueue durable snapshot work. Return the state and version, not a public URL. An accepted submission has a frozen D1 document queued for preparation, not an approved or public version.
- `withdrawFromGalleryFn` (POST): `{ publicationId }`; resolve the scoped publication and trip, mark withdrawn, fence pending versions and atomically create retraction work. Return current state. Repeat withdrawal safely.
- `loadGalleryPublicationFn` (GET): `{ tripId }`; return null or the tenant's status, latest and live versions, submitted fields, review note and progress/failure needed for the dialog. Never expose storage keys or another tenant's content.

The release/retract handler can process an idempotent retraction but a future public reader must consult authoritative current publication/version state before serving a snapshot; a KV entry alone is not authorization. The curator and public-route stages own their own closed projections and any SPEC amendment required for a new cross-tenant read. The implementation here must not create an unscoped tenant-content exception in anticipation.

## UI/UX and visual change expected

Add `src/components/gallery/publish-dialog.tsx` and `publication-status.ts` using existing UI primitives and the 23-locale catalogue. It is an unmounted component, so no product route changes in this stage. Its five faces are never shared, in review, changes requested, published and withdrawn. Show an explicit public-field and exclusion list and the complete confirmed snapshot preview before submit; default `showDates` to false. Show both the still-live version and pending version during an update, and do not describe an enqueued submission as published. The published face links to the future gallery URL only when a slug and live version exist. Withdrawal requires confirmation and explains that previously saved copies persist and cached copies cannot be recalled.

Prefill title from the trip. Show the submitted date and summary during review; show the curator note and previous values when changes are requested; offer publish again after withdrawal and copy-link confirmation for a live version. Keep form values on failed submission and the previous live version on update failure. Support long text and mobile scrolling in both themes. Represent loading, failure with retry, pending and disabled states. The future caller supplies publication data and load/reload, submit, withdraw and retry-preparation and preview callbacks; the component performs no fetch. Use labelled controls, keyboard and focus management through the existing dialog primitives, accessible status/error announcements, light/dark themes, reduced motion and mobile/desktop layouts. Verify all faces as a component; in-app browser evidence belongs to the later mount. Do not create a route solely for a screenshot.

## Copy

Add these English keys under `trips.gallery.publish` and equivalent translations in every supported locale, following the i18n skill. Names may be grouped in the existing namespace but all meanings and states must exist:

| Key | English |
| --- | --- |
| `title` | Share this trip with the community |
| `publicFields` | Your title, summary, display name, country codes, day titles, place names and categories, and any place coordinates may be public. Dates are included only if you choose them. |
| `privateFields` | Travellers, notes, files, costs and reservations are not included. |
| `freeTextWarning` | Check the title, summary, display name, day titles and place names for personal information before submitting. |
| `publicTitle` | Public title |
| `summary` | Summary |
| `attribution` | Display name |
| `showDates` | Include trip dates |
| `preview` | Preview what will be shared |
| `stalePreview` | This trip changed. Review the updated preview before submitting. |
| `submit` | Submit for review |
| `submitAgain` | Submit again |
| `inReview` | In review |
| `changesRequested` | Changes requested |
| `published` | Published |
| `withdrawn` | Withdrawn |
| `liveAndPending` | Version {live} is live; version {pending} is in review. |
| `update` | Publish an update |
| `withdraw` | Withdraw |
| `withdrawConfirm` | New readers will no longer have access after withdrawal. Saved and previously downloaded copies may remain. |
| `retry` | Try again |
| `captureFailed` | We could not prepare this submission. Try again. |
| `tooLarge` | This trip is too large to submit for review. |
| `adminOnly` | A workspace admin can submit a trip. |
| `copyLink` | Copy link |
| `linkCopied` | Link copied |
| `loadFailed` | We could not load the publication. |
| `required` | This field is required. |
| `saving` | Saving… |
| `cancel` | Cancel |

Reuse existing localized generic validation and loading messages wherever they already express these meanings; otherwise provide localized maximum-length errors for 120, 280 and 80 characters in all locales. Preserve entered text on validation errors. Avoid inventing a new pricing promise. The implementation adds any necessary interpolation and validation variants to all 23 locales in the same change.

Implementation note (#1889): `components/gallery/publish-dialog.tsx` composes the private preview with caller-owned load, submit, withdraw and retry callbacks. `publication-status.ts` distinguishes preparation, review and live updates. No route mounts it; component and browser-harness checks do not replace the later mounted visual and manual screen-reader acceptance.

## Failure and security cases

A failed send leaves durable work eligible for redispatch. A storage quota failure produces a retryable visible failure without a false successful snapshot. A failed candidate put or settlement stays accounted until fenced or deleted. A retry never changes the frozen bytes or advances the version. Two submitters at the quota boundary cannot overspend; two re-shares cannot produce the same version. Revoked membership, deleted trip or tenant mismatch fails closed; the worker checks the submitting actor’s current membership, workspace role and private-trip access atomically with installation. Withdrawal wins against stale snapshot/release completions; previously downloaded content remains beyond recall. Re-publishing a withdrawn trip is a new review/version and consumes a slot. A corrupt snapshot fails strict parsing and is never served. No claims are made about an immediate cross-region KV purge.

## Verification and rollout

Tests cover same-tenant and cross-tenant get/submit/withdraw/snapshot operations, admin without private-trip access, forged org IDs and unchanged victim rows. Exercise admission at the boundary concurrently, re-share and withdrawn reactivation; storage reserve/settle, GC references, deletion and accounting across failures; queue send failure, duplicate delivery, reverse order, crashes, stale version and concurrent withdrawal. Preview tests prove all included values are displayed and excluded values never appear, cross-tenant and unauthorized preview access is denied, and editing source or form data after preview rejects submission without writes, work or charges; unchanged confirmation freezes exactly the previewed bytes. Test expiry, replay and concurrent edits at the transaction boundary. Snapshot tests prove strict parsing, allowlisted fields, dates opt-in, each bound and one over it, atomic capture during concurrent edits, commit failure and immutable bytes. Component tests cover all faces, accessible names, pending/errors and disclosure; the 23-locale parity test passes. Apply `docs/plans/12-verification-protocol.md` instead of historical pixel-baseline instructions. Run the configured gate in `.ai/agentic.config.json`; use generated migration and stage generated files before its generated-file check. Roll out additive schema and consumers before producers; rollback disables producers first and retains existing records and objects until cleanup can safely run.

## Phasing and implementation plan

Each slice is independently deployable, and none exposes a gallery route:

1. **Foundation:** additive schema, indexed constraints, metric and tier/override tests. No producers enabled. Generate migration.
2. **Admission and durable work:** scoped repository, concurrency-safe quota/version transitions, outbox and consumer-first queue schemas, recovery dispatcher and scoped isolation tests. No public release and no externally reachable submission writes until slice 3 has landed.
3. **Snapshots and lifecycle:** bounded allowlisted builder, immutable candidate admission and CAS, retry/withdrawal fencing, accounting, GC, trip deletion and workspace erasure integration; fault and concurrency tests.
4. **Submission contract and dialog:** validated server functions, standalone accessible dialog, complete locale copy and component tests. Producer activation follows deployed consumers; future curation and route integration remain separate.

## Review clarifications

The submit transaction rechecks current organization role, private-trip membership, tenant/trip binding and workspace deletion state inside the same D1 atomic operation as quota admission, frozen JSON, version and outbox. Earlier request authorization alone cannot close the race. The snapshot capture uses explicitly scoped joins, stable sort with ID tie-breakers and an indexed precondition of at most 1,000 included day-place assignments before JSON aggregation, in addition to the day, place and UTF-8 byte caps. All failed predicates abort the whole batch; no sequential fallback. Prove the actual statement, transaction semantics and bounded work with local D1/workerd tests, including each boundary, concurrent role revocation, deletion and source edits. Unsupported SQL or a bound failure returns a localized failure and no partial write.

Store all public metadata in the immutable version, including title, summary, attribution and date setting. Public reads must use only the approved live version's metadata and bytes. At most one pending and one live version may remain per publication; resubmit fences the old operation and securely removes its unreferenced data only after workers and storage cleanup settle; while cleanup remains unresolved, reject another resubmit with a retryable status so the bound cannot be exceeded. Live and pending may point to the same version. Deletion and erasure remove all frozen JSON; repeated resubmissions must not grow retained D1 data without bound.

The worker uses its organization-scoped durable operation to read only the frozen version, without pretending to be a private-trip member. The same conditional D1 batch that performs version CAS and reservation settlement must check the submitting actor's current organization role, membership and private-trip access and workspace deletion state; no earlier read may authorize the commit. Test revocation after put but before batch commit: no installation, and the candidate is safely fenced. Neither CAS nor settlement may succeed alone; losing attempts cancel only their own reservations and keys. Test crashes between put, CAS, settlement and cleanup. Queue send failure leaves the same pending operation for bounded scheduler redispatch. On exhausted attempts the durable operation moves to failed and stops automatic redispatch; state is visible to the submitter. `retryGalleryPreparationFn` accepts `{ publicationId, version }`, requires current admin and trip access, and atomically creates one fresh operation for the same frozen version only when failed and still current; duplicate retry requests reuse that operation. It never recaptures or increments version. Withdrawal fences the operation and subsequent retry fails; a failed retry send remains recoverable.

Dialog status derives from the publication plus current-version preparation: `preparing` while pending/running, `preparation_failed` on terminal failure, `in_review` only after immutable R2 installation, and otherwise `changes_requested`, `published` or `withdrawn` from review state. With a live version, show its live status separately from pending, failure or review status of the update. Use `liveAndPending` only after the pending version is review-ready; use `preparingUpdate` or `failedUpdate` in the corresponding states. Display distinct quota, snapshot-too-large, storage-full, preparation failure and load failure messages with an actionable retry where applicable. Quota refusal explains that withdrawing another publication frees a slot; no message implies automatic deletion of saved copies. The tier defaults are internal `free`/`starter`/`pro`/`business` values; `resolveLimits()` maps actual catalogue plans and overrides, which tests must cover.

Before final workspace erasure, preserve an erasure ledger that survives the workspace cascade and records every outstanding snapshot candidate and storage fence. Stop new admissions, drain or fence every candidate with create-only tombstones, confirm no old writer can later put content, then sweep the tenant namespace while permanently retaining every zero-byte candidate fence and its cascade-surviving ledger record. Fence keys contain only opaque non-personal identifiers and are never reused; the final sweep must not delete these fences. This explicitly extends ADR 0050 for gallery candidates. Failed fencing or cleanup keeps erasure pending and retryable; do not declare completion or release accounting. The required workerd integration test delays a put until after the actual final sweep and proves the retained fence rejects it. D1 unavailable during cleanup is also tested. If the existing deletion ledger cannot uphold this invariant, extend it as part of this slice; do not promise erasure based solely on cascading D1 rows.

Additional English copy (translate to every locale): `preparing`: “Preparing for review”; `preparationFailed`: “Preparation failed”; `quotaExceeded`: “Publication limit reached. Withdraw another publication to free a slot.”; `storageFull`: “Not enough workspace storage to prepare this publication.”; `captureUnavailable`: “We could not submit this trip. Try again.”


Accessibility: provide `DialogTitle`, intentional initial focus, trapped Tab/Shift+Tab, Escape and close, focus restoration and usable scrolling at 360px and zoom. Keep focus within a withdrawal confirmation and return focus to its control on cancel. Bind errors to fields with `aria-describedby` and `aria-invalid`; focus the error summary or first invalid field on submit failure and announce asynchronous changes once without relying on colour. Explain admin-only access to keyboard and screen-reader users, not solely via a disabled control's tooltip. Component tests exercise keyboard, focus, errors and status announcements; the later mounted stage includes manual screen-reader and visual checks.

Additional copy: `preparingUpdate`: “Your update is being prepared. The previous version is still live.”; `reviewingUpdate`: “Your update is in review. The previous version is still live.”; `failedUpdate`: “Your update could not be prepared. The previous version is still live.”; `publishAgain`: “Publish again”. Translate all keys in every locale.

## Resolved assumptions (autonomous defaults)

| # | Question | Applied default | Why |
| --- | --- | --- | --- |
| 1 | What ships in this stage? | Scoped pipeline and unmounted dialog, not curation or public gallery. | Product owner specialist, high confidence: the plan separates later stages. |
| 2 | What quota defaults apply? | 1 / 10 / 100 / unlimited for free / starter / pro / business, with existing overrides. | Product owner specialist, medium confidence: matches existing `journeys` operational limits. |
| 3 | How are tenant, queue and storage boundaries handled? | Scoped repository, durable work, version fencing and ADR 0050 storage accounting. | Security and tenancy specialist, high confidence: the plan's unscoped row and object-first write violate current contracts. |
| 4 | What replaces the missing foundations? | Include additive schema and quota integration in this design. | Software architect specialist, high confidence: searches found neither prerequisite in the repository. |
| 5 | When is source data frozen? | Capture a bounded coherent D1 snapshot atomically with submission; copy that frozen document asynchronously. | Security specialist, medium confidence, settling disagreement with architect: mixed-time capture can publish a combination that never existed. |
| 6 | Is the stage complete and sliceable? | Approve. | Product owner specialist, high confidence, round 2: scope, same-version retry and preparation states are explicit. |
| 7 | Are architecture and module seams implementable? | Approve, subject to the specified fail-closed D1 tests. | Software architect specialist, medium confidence, round 2; independent narrow review approved the atomic authorization correction with high confidence. |
| 8 | Are tenancy, erasure and publication boundaries safe to implement? | Approve. | Security and tenancy specialist, high confidence: final narrow review accepted persistent fences and atomic authorization after two rounds of revisions. |
| 9 | Is the dialog accessible to implement? | Approve. | Accessibility specialist, high confidence, round 2: keyboard, focus, error and announcement requirements are explicit. |
| 11 | How is informed snapshot consent preserved across edits? | Show the complete authorized preview and atomically compare its canonical bytes at submit; stale previews require renewed confirmation. | Independent PR reviewer approved the corrected preview, atomic comparison and bounded preview-record lifecycle; this prevents unseen content from being submitted and retains deletion guarantees. |
| 10 | Is the disclosure and dialog flow specified? | Approve. | UX specialist, high confidence: final check accepted the loading, progress and localized validation conditions. |
