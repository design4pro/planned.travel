# Curation: review, verdicts and release to KV

| Field | Value |
| --- | --- |
| **Status** | ready |
| **Issue** | none |
| **Spec PR** | none |
| **Implementation** | none |
| **Plan** | 13-S2 (docs/plans/13-community-gallery.md) |

## TLDR

Stage 13-S2 of `docs/plans/13-community-gallery.md` will let platform curators inspect an explicitly submitted immutable trip snapshot, approve that exact version, request changes or take a publication down. It also mounts the predecessor's publish dialog in the trip's Collab tab. Public browsing remains stage 13-S3; saved trips and imports remain 13-S4.

## Problem and verified starting point

No community tables, queue kinds, repository, snapshot builder or gallery components exist in `src/` or `drizzle/` at this revision. The ready predecessor, `2026-11-04-the-publication-pipeline.md` (13-S1, Spec PR #1846), designs those prerequisites but has no implementation. Implement its four phases first; slicing this spec must give every dependent ticket an explicit blocker on the corresponding predecessor implementation. This design does not repeat the submission pipeline.

The plan predates the platform console, the closed SQL exceptions, ADR 0050 storage admission and the predecessor's confirmed immutable versions. Its proposed review workspace, whole-row unscoped access, versionless verdicts, mutable KV-only authority and screenshot baselines are superseded in this design. The source plan stays historical; this spec names the current work.

Reference check on 2026-11-06: the reference demo answered HTTP 200, and its public product description describes registry extensions. That check does not establish an equivalent hosted curation queue. The plan's behavioral source remains `wiki: Plugins`: human review before listing and a reason when changes are requested. No reference implementation, copy or asset is reused.

## Proposed solution and scope

Use `/console/curation` inside the existing platform console, rather than a second `/curation` surface or `COMMUNITY_REVIEW_ORG_ID`. Platform standing never grants membership in the publisher's trip. The queue exposes only explicitly submitted public content and bounded review metadata, never the current trip. Requesting changes affects the pending version; a previously live version remains live. Approval is accepted first and released asynchronously; the UI never calls an enqueued release published.

The complete slice is submission-to-review integration, verdicts, recoverable release/retraction, localized publisher notifications and the two mounted surfaces. No public gallery route, recommendation engine, saved-trip table, import, bulk moderation, new binding or dependency is introduced.

## Architecture and owners

| Owner | Responsibility and change |
| --- | --- |
| `src/server/repos/community.ts` | Extend 13-S1's tenant repository with version-specific transitions, durable work, policy tombstones and the explicitly admitted moderation capability below. |
| `src/server/fns/console/community.ts` | Sole production caller of all gallery moderation Unscoped functions; permissions, snapshot reads, result projection and orchestration. Plain async handlers. |
| `src/routes/_app/console/-server/community.ts` | The only createServerFn wrappers on each console RPC path, with strict Zod validators. |
| `src/routes/_app/console/curation.tsx`, `src/components/gallery/curation-screen.tsx` | Route orchestration and presentation-only review UI. |
| `src/routes/_app/console/-ui/console-nav.tsx` | Add the curation link using the existing console capability mechanism. No workspace shell isCurator flag or user-menu duplicate. |
| `src/server/community/read-model.ts` | Strict versioned public document schemas, immutable key helpers and bounded page rendering. |
| `src/server/queue/handlers/community-release.ts` | Complete 13-S1's release/retract worker, version fencing and publication progress; use its durable recovery dispatcher. |
| `src/server/community/release-index.ts` | Own generation construction, KV writes and recovery orchestration; no SQL here. |
| `src/server/catalog/community-index.ts` | Sole SQL owner of a new platform index-control singleton, with no tenant-repository import or tenant content projection. Supply its guarded statements for the same D1 transaction as visibility changes. |
| `src/server/notifications/dispatch.ts` and gallery notification work in the community repository | Extend the existing event dispatch contract, recipients, translations and durable exactly-once in-app admission. |
| `src/routes/_app/trips/$tripId/collab.tsx` and its server loader | Mount 13-S1's existing dialog and expose server-derived canPublish, independent of the section-configuration action. |
| `src/lib/i18n/messages/<locale>/console.ts`, `trips.ts` | Curation chrome in console, submission and notification copy in trips, all 23 locales. |
| `src/server/db/schema.ts`, generated `drizzle/`, queue schemas/dispatch/recovery, deletion registries | Additive coordination fields and durable work integration below; retain the existing schema and scheduler owners. |
| `docs/SPEC.md`, `docs/ACCESS.md`, `BACKWARD_COMPATIBILITY.md`, new focused ADR, related owner docblocks | Admit the exact moderation/public-projection exceptions and semantics before enabling the implementation. |

Tests travel with their owners: `repos/__tests__/community.test.ts`, `tenant-isolation.test.ts`, new console handler/wire tests, `community/__tests__/read-model.test.ts` and release-index tests, queue handler tests, UI tests and `e2e/community-gallery.spec.ts`. Preserve the catalog isolation graph tests unchanged. Regenerate routes and migrations with their existing commands; never hand-edit generated files. No `.visual.spec.ts` or screenshot baseline directory.

## Authorization and the closed cross-tenant capability

Explicitly amend SPEC §5 FU-3/§6 and ACCESS's permission/projection sections in the implementation. Existing permissions are reused with these newly enumerated gallery meanings, not presumed to authorize tenant content today:

| Call | Permission |
| --- | --- |
| Queue and immutable submitted preview | catalog:read |
| Request changes | catalog:write |
| Approve | catalog:publish |
| Policy takedown | share:revoke |

Each call uses the existing `openConsoleCall` / `requirePermission` and primary session-authority path. No active workspace is needed for platform curation. Tenant owners/admins with platform role user, banned operators and impersonated sessions are refused before any data access. Navigation is a courtesy; direct RPC calls enforce the same permission. Recheck current operator standing in the atomic verdict commit so revocation during preview or I/O cannot authorize a mutation.

Admit the three console moderation functions `listGalleryReviewQueueUnscoped`, `readGalleryReviewVersionUnscoped` and `commitGalleryVerdictUnscoped`, all in the community repository with file-header justification and the sole named production caller `src/server/fns/console/community.ts`. The queue returns at most 50 rows per keyset page, ordered by submitted time and id, filtered to a closed status enum; bound and validate the cursor. Projection: publication/version IDs, publisher workspace display name, public title, preparation/review/release states and timestamps. No member lists, emails, raw source rows or free-form source JSON. Counts are indexed, bounded operational summaries, never a scan of snapshots.

Detail resolves only the requested publication and immutable version. The server-only result may include that version's validated storage handle and digest for the handler; no storage key reaches the browser or logs. The handler re-parses the R2 bytes through the predecessor's strict schema, verifies the frozen D1 bytes/digest and installed version identity, and returns only the allowlisted snapshot and review token. Corrupt, missing, oversized or mismatched objects cannot be approved. Render free text as text, never HTML.

The review token is opaque, short-lived (15 minutes), bound to operator, publication, version and immutable identity, and stored by the repository with at most one active token per operator/publication. Replace on refreshed preview, expire in bounded indexed cleanup, remove during trip/workspace erasure. Approve and decline require this token: an older tab cannot approve content it never displayed. Atomic commit checks token expiry, current version/identity, ready preparation, review status, tenant/trip existence, deletion fences and current operator authority. A stale conflict changes nothing.

No global catalog module imports the tenant repository. Do not mint a fake tenant-member scope for platform access or broaden existing share moderation. Tenant scopes for queued effects are derived from a validated stored publication/work item, never client org IDs; workers retain 13-S1's atomically checked submitter membership, role, private-trip access and deletion constraints.

## Data and verdict transitions

Reuse 13-S1's community_trips, immutable versions and durable outbox. Extend additively where its implemented schema lacks: approved version/digest, per-publication release revision and phase/error, permanent policy-takedown fence, review-token records, and durable notification delivery identity. At most one pending and one live snapshot remains, including release and cleanup races, as required by the predecessor. Do not duplicate its quota metric; verdicts consume no publication slot.

A first approval mints a stable slug using an ASCII-folded public title prefix up to 48 characters (fallback `trip`) and the full opaque publication id, not its first six characters. Validate URL-safe IDs, keep the existing unique constraint, and settle any constraint conflict with a fresh bounded retry; never assert a six-character prefix is collision-free. Updates keep the slug. Public metadata always comes from the approved immutable version.

- **Approve:** compare-and-set the exact ready pending version. Atomically record verdict/actor/time, audit, approved identity, durable publish work and notification intent. Preserve live version until release installation succeeds. Duplicate identical approval returns current progress without a second side effect; a different stale verdict conflicts.
- **Request changes:** require trimmed note 1–500 characters and matching review token/version. Atomically record review note/actor/time, audit and notification intent; keep previous live version. The note is publisher-visible but never public.
- **Policy takedown:** require trimmed reason 1–500 and expected publication revision; no review token required because it removes access rather than approves content. Atomically set withdrawn plus permanent policy fence, clear authoritative public pointers, fence all pending release/install work, audit and enqueue retraction/cleanup. Later re-submit is refused for this publication, including races with submission; the publisher sees the reason. Ordinary author withdrawal remains 13-S1's reversible operation.

Atomic D1 transitions and their durable work/audit are one conditional batch, with no sequential fallback. Audit uses the existing platform audit writer/action registry and minimal actor/target/version/reason metadata; never snapshot content or keys. Add the named action contracts to ACCESS and its registry tests. A failed audit or outbox insert aborts the verdict.

Policy takedown leaves an opaque, non-personal fence that survives required cleanup. Frozen JSON, preview/review tokens, snapshots, notes and attribution are erased through the predecessor's deletion/erasure paths and ADRs 0043/0048/0050; deletion failure stays pending and charged, and permanent storage cancellation fences are retained. Future 13-S4 must check the policy fence before save/read/materialize and deny retained saved references after takedown. There are no saved-trip rows to delete today. Do not promise recall of downloaded content or already materialized independent trips.

## Release and public-read protocol

KV is an eventually consistent cache, never authorization. Use strict schemas on write and read. A detail document contains only the approved snapshot, stable slug and publishedAt, with schema version, immutable version and digest in its internal envelope. No org/actor IDs, review notes, storage handles or private source fields. Keys are version-qualified and immutable, e.g. `gallery:v1:trip:<publicationId>:<version>:<digest>`; public routes must resolve slugs and authoritative live identity before reading them.

Publish writes the validated immutable detail first. The tenant-scoped worker then atomically installs the live version/publishedAt only if approved identity, operation/revision, submitter authority, source/deletion state and policy fence still match. Failed predicates cannot promote a version. Retraction removes authority first; cache cleanup never authorizes access. Missing D1 or an unverified/mismatched KV object fails closed. No old publisher can resurrect a withdrawn version. Release retry keeps the same frozen bytes and semantic timestamp; cleanup can remove only its own unreferenced candidates.

The browse index uses one bounded immutable generation document, never concurrent read-modify-write of a shared array. Add a platform `community_gallery_index_control` singleton with visibility revision, active generation and generation revision, owned only by `catalog/community-index.ts`. Explicitly admit this coordination table and its transaction-composition API in SPEC §5/§6; it holds opaque control state, not tenant content. Catalog continues to import no tenant repository. The community repository composes the catalog-owned revision-increment statement into the same conditional D1 batch as every live activation, withdrawal, policy takedown and trip/workspace visibility removal. Audit and durable index-rebuild work participate in that batch. Deletion cannot cascade away the work needed to clear public authority.

A builder reads the control revision and a consistent bounded projection of current eligible live versions in one authoritative D1 snapshot. The community repository owns this tenant-content projection through `readGalleryIndexCandidateUnscoped`, sole caller `src/server/community/release-index.ts`; add its exact allowlisted metadata/digest projection and caller guard to SPEC/ACCESS. Workers never scan source trips. Render entries ordered by publishedAt descending with publication id tie-breaker. Fields are slug, public title/summary/attribution, day/place counts, country codes and publishedAt from the approved live version, plus internal version identity for validation.

Write to a fresh unpredictable `gallery:v1:index:<generation>` key, then activate with D1 CAS only if visibility revision is still the one observed. A losing builder leaves no authoritative pointer, records retry work and rebuilds from current state; a delayed old write has its own key and cannot overwrite an active generation. Duplicate builders contend on the control revision/active-generation pair. Keep rebuild intent pending until a matching generation is installed, not merely until a queue message is sent; bounded scheduler recovery retries lost sends and crashes. New visibility transactions create new work even when older work is already complete.

Initial capacity is 1,000 live entries and 1 MiB UTF-8 encoded index bytes. The live-install transaction checks the count and exact encoded projected size of the prospective index under the same write serialization as its revision update. A limit failure leaves the approved version awaiting release, preserves any previous live version and shows an operational-limit error; it cannot silently drop entries or disable other publications. Increasing either limit requires page sharding in a future spec, not an unbounded array. Withdrawals and takedowns always remain possible at capacity.

Index candidates expire after seven days; the existing bounded recovery scheduler refreshes the active generation daily, and missing/expired objects trigger rebuild. Retired/candidate generations therefore cannot grow without bound, even when a put completes after its builder loses CAS. A future public reader uses only the D1-selected generation. If its generation revision differs from the current visibility revision, return a retryable unavailable result and trigger durable rebuild, rather than presenting an incomplete index as current. A missing KV object also fails closed. This can temporarily make browse unavailable during rebuild; it is a deliberate availability trade-off. Immutable detail reads remain available when their own authoritative version is valid.

Stage 13-S3 must implement the corresponding closed public resolver as a separately named SPEC/ACCESS amendment: primary authoritative D1 live identity and policy/deletion checks before serving bytes, no store of publicly cacheable responses that bypasses those checks. KV index entries are verified against current D1 live state; tombstoned, deleted or withdrawn versions never pass. This stage supplies tested server-only public projection contracts but no anonymously callable route. The old plan's KV-only/no-session-read language cannot override that boundary.

## Notification effects and recovery

Use the predecessor's durable work with a deterministic verdict-event identity (publication, version, verdict revision, event type). Resolve publisher workspace owner/admin recipients through the existing tenant member API, verify membership and preferences, and render title/body keys with localized params via existing dispatch. Do not notify every trip member or expose the private review note to non-admins.

In-app notification insertion and delivery receipt commit atomically per recipient and event, with a uniqueness constraint; retries cannot duplicate rows, including crash after insertion. Recipient pagination/chunks obey dispatch's D1 parameter limits. Do not call bare notifyMany then mark work complete in another transaction. Optional external channels keep existing preference, retry and idempotency semantics, without a new exactly-once delivery promise.

An approval acknowledgement says approved/awaiting release; a published notification is emitted only after live installation, with live-version title and slug. Changes-requested notification links to the authorized trip dialog and explains how to view the note. Publish send failure, KV failure, crashes and exhausted retries remain visible in D1; reuse bounded outbox recovery and explicit retry of the same approved operation, not reapproval or recapture. Manual retry is permission-checked and cannot revive a policy-taken-down/deleted/withdrawn operation.

## Server contracts

All public server-function inputs use Zod strict objects; no organization, actor or storage key is accepted. Route wrappers call plain server handlers once, following the providers console pattern; binding-free wire/handler modules permit Node tests.

| Function | Input and result |
| --- | --- |
| loadCurationQueue (GET) | `{ status?, cursor? }`; bounded page plus cursor and operational counts. |
| loadCurationDetail (POST) | `{ publicationId, version }`; allowlisted snapshot, review metadata, review token/expiry, permissions and live/pending/release status. POST because it issues a stored review token. |
| approveSubmissionFn (POST) | `{ publicationId, version, reviewToken }`; accepted/current progress or stale conflict. |
| declineSubmissionFn (POST) | Above plus `note`; committed changes-requested result or stale conflict. |
| takedownPublicationFn (POST) | `{ publicationId, expectedRevision, note }`; authoritative withdrawn state plus cleanup progress. |
| retryGalleryReleaseFn (POST) | `{ publicationId, version, expectedRevision }`; existing or newly retried durable work, authorized with catalog:publish. |

Use existing diagnostic/refusal conventions and localized client fallbacks; add no authored-error exception. The mounted dialog reuses 13-S1's load, preview, submit, withdraw and retry-preparation functions, disclosure and complete preview contract unchanged. Changing form fields or source invalidates confirmation as before. Server-derived canPublish requires tenant admin/owner AND private-trip access and current writable trip state. Platform curator status alone never enables publishing.

## UI/UX

The queue uses existing Card/Table/Badge/EmptyState/Alert/Skeleton/Button/Dialog/Textarea primitives. Default view is oldest ready in-review submissions; preparation failures and release failures have separate labelled filters so they cannot look ready to approve. Select a row via a real link retaining the selected ID/version in validated route search. At 360px use cards; desktop uses queue and detail panel. Support pagination without loading unbounded snapshot lists.

The review panel displays every allowlisted field of the exact snapshot, including date choice, days, places, coordinates and public attribution; never approve an abbreviated summary. Show pending and live versions separately. Decline and takedown confirms require a reason; explain that takedown stops publication and resubmission. Include empty, loading, error/retry, corrupt snapshot, stale preview, expired review token, approved/awaiting release, release failed/retry, published and cleanup-pending states. During release failure preserve the previous live version and label it explicitly. Authorization refusal exposes no queue data; use the existing console route denial behavior rather than invent a workspace locked state.

Mount the publish trigger beside Collab's header actions. Render an explanation available to keyboard/screen-reader users for a non-admin; a disabled button with a hover-only tooltip is insufficient. Follow 13-S1's five faces plus preparation/update failures, complete snapshot preview and live/pending status. No route is manufactured for component evidence.

Use labels and descriptions, visible focus, logical properties/RTL, WCAG 2.2 AA contrast in both themes, keyboard-operable selection and dialogs. Maintain focus when a selected item leaves the queue; move it to the next row or queue heading and announce the outcome once. Trap/restore dialog focus, associate note errors, focus invalid input after refusal, and preserve typed notes on failure. Mark asynchronous status using a polite live region; validation errors use an appropriate alert. Respect reduced motion and use existing tokens, never new colors or a duplicate primitive.

## Visual change expected

`/console/curation`, console navigation and `/trips/$tripId/collab` change in both themes at 360, 1280 and 2560px, including Arabic RTL. Capture queue populated/empty/loading/error, full review, reasons and invalid-note states, stale/corrupt review, denied direct access, pending/failed release, and mounted publish-dialog faces. Use ADR 0016 journeys and `docs/plans/12-verification-protocol.md`; no pixel baselines. This design step has no rendered mockup/current-app frame: this worktree has no shared `.ai/qa/test-env.json` descriptor. UI proposals are text requirements, not claimed visual approval.

## Copy

Reuse predecessor keys under trips.gallery.publish and existing generic actions/validation. Add these en keys and original translations to all 23 locales in the implementing slice; console keys belong in console.ts, publisher/notification keys in trips.ts. Interpolate formatted numbers, not raw locale-dependent values.

| Key | English |
| --- | --- |
| console.curation.title | Review shared trips |
| console.curation.emptyTitle | The queue is clear |
| console.curation.emptyBody | New submissions appear here when they are ready for review. |
| console.curation.preparing | Preparing for review |
| console.curation.inReview | Ready for review |
| console.curation.changesRequested | Changes requested |
| console.curation.approve | Approve this version |
| console.curation.decline | Request changes |
| console.curation.takedown | Take down publication |
| console.curation.reason | Reason |
| console.curation.reasonRequired | Enter a reason. |
| console.curation.reasonTooLong | Use 500 characters or fewer. |
| console.curation.takedownConfirm | This stops publication and prevents resubmission. Previously downloaded copies may remain. |
| console.curation.loadFailed | We could not load the review. Try again. |
| console.curation.invalidSnapshot | This snapshot could not be verified and cannot be approved. |
| console.curation.stale | This submission changed. Open the latest version before deciding. |
| console.curation.expired | Your review expired. Reload the snapshot before deciding. |
| console.curation.approved | Approved. Publication is being prepared. |
| console.curation.releaseFailed | Publication failed. Retry this approved version. |
| console.curation.published | This version is published. |
| console.curation.previousLive | Version {version} is still published. |
| console.curation.cleanupPending | Access is stopped. Cleanup is still in progress. |
| console.curation.preparationFailed | Preparation failed |
| console.curation.liveVersion | Published version |
| console.curation.pendingVersion | Submitted version |
| console.curation.reviewChanged | The queue was updated. |
| trips.gallery.publish.policyRemoved | This publication was taken down and cannot be submitted again. |
| trips.gallery.notifications.approved.title | Your trip was approved |
| trips.gallery.notifications.approved.body | {title} was approved and is being prepared for publication. |
| trips.gallery.notifications.published.title | Your trip is published |
| trips.gallery.notifications.published.body | {title} is now available in the Gallery. |
| trips.gallery.notifications.changesRequested.title | Changes are needed |
| trips.gallery.notifications.changesRequested.body | Open {title} to read the review and submit an updated version. |
| trips.gallery.notifications.takenDown.title | Publication stopped |
| trips.gallery.notifications.takenDown.body | Open {title} to read the reason for the takedown. |

Re-use the existing localized pagination, retry, cancel and generic field labels. If missing, the implementation adds equivalent keys to every locale in the same commit, following i18n-messages. Dates, counts, status and notification rendering must agree across SSR/hydration.

## Verification, rollout and risks

Unit/repository tests prove the exact projection and schema allowlist; every tenant-scoped 13-S1 read/write given tenant B IDs in tenant A scope remains not-found with B unchanged. Direct console RPCs from tenant owner/admin platform users, banned or impersonated operators, expired/revoked sessions and forged inputs return no content and no writes. Authoritative transaction tests cover operator revocation, current submitter authority, private access, deletion fences and source existence at commit, including changes after R2 reads.

Use local D1/workerd concurrency/fault tests for stale/reordered approvals, decline-vs-approve, withdrawn and policy-taken-down publications, tampered/missing snapshots, duplicate actions/audit/notifications, queue send loss, worker crashes and index interleavings. Cover initial release and update failure retaining the old live version, later release recovery, full slug collision, each document/page limit and one above it. Deletion tests delay a put across actual cleanup and prove retained ADR 0050 fences prevent resurrection. Missing D1 always fails closed.

Component tests cover all states, complete preview, keyboard/focus/error announcements and notes retained on failure; i18n parity must pass. Playwright only covers actual routing/session/hydration, direct unauthorized calls and keyboard-operable mounted approve/decline/publish paths that lower layers cannot prove. Attach console monitoring before navigation, report layout shifts with engine support limits, and restart the cezar-worktree server before reading browser results as evidence. Test primary-authoritative reads with a deliberately stale KV cache.

Run the full configured gate in order for implementation; generate/stage routes, migrations and spec index before check-generated. Roll out schema and queue consumers before enabling verdict producers or navigation. Rollback disables producers, preserves state/fences, drains cleanup and keeps authoritative read denial active; never roll back to an old KV-only public reader. Main risks are cross-tenant disclosure, mistaken version approval and stale cache resurrection; all are explicit guarded contracts and required tests, not deferred hardening.

## Phasing and implementation plan

At most seven tracer-bullet tickets after the predecessor's implementation, each leaving the app deployable:

1. **Contracts and state:** SPEC/ACCESS/BC amendments, focused ADR, exact capability/action registry, additive version/review-token/takedown/notification/index coordination schema and bounded repository tests. No enabled producer.
2. **Review preview and queue:** guarded read handlers/wrappers, review-token lifecycle, full allowlisted R2 preview validation, console route/navigation, all queue/detail copy and accessibility tests. No verdict control enabled until its backend lands.
3. **Version-specific decisions:** approval/request-changes, atomic audit/work, operator and submitter fences, conflict behavior, guarded controls, localized in-app notifications with durable dedupe and failure tests. Approval reads awaiting-release while release consumer is unavailable.
4. **Release and index:** consumer-first immutable detail/index generation, authoritative live install, durable retries/progress, publisher published notification and complete concurrency tests; enable approved-release work only when consumer deployment is verified.
5. **Policy takedown and cleanup:** persistent fence, revoked public pointers, resubmission refusal, durable retraction, deletion/erasure/accounting integration, guarded confirmation and cleanup status. Test pending/live races and delayed puts.
6. **Publish-dialog mount:** Collab loader capability and existing complete 13-S1 dialog, preview/submit/withdraw/preparation-retry wiring, translated affordance and focus tests. No public Gallery route required.
7. **Integration evidence:** real D1/workerd interleavings across slices, mounted critical journeys and browser/accessibility/frame evidence, complete configured gate. Do not use this ticket to defer earlier slices' own regression tests.

## Resolved assumptions (autonomous defaults)

| # | Question | Applied default | Why |
| --- | --- | --- | --- |
| 1 | Which curation authority and SQL boundary apply? | Platform console, existing explicitly amended permission meanings, closed named community moderation exceptions. | Security and tenancy specialist, high confidence: option B respects the current role separation; no invented tenant membership or catalog graph widening. |
| 2 | What must verdicts and takedown preserve? | Exact immutable review, atomic audit/work, D1 authority, policy fence and existing storage/deletion lifecycle. | Security and tenancy specialist, high confidence: prevents stale approvals and resurrected content; no fictional saved-trip implementation. |
| 3 | How is the shared index safe under concurrent workers? | Immutable bounded generations and primary D1 CAS activation; explicit catalog control-table admission and a separately named projection. | Architect specialist, high confidence: stale puts cannot overwrite the winning generation; durable rebuild prevents permanent omission. |
| 4 | What stage scope and missing foundations are assumed? | Complete stage after 13-S1 implementation; no public routes or saved-trip implementation. | Architect specialist, high confidence: keep dependency and complete review-to-release scope explicit. |
| 5 | How are slug collisions handled? | Full opaque publication-id suffix, fixed non-Latin fallback and unique-index bounded collision retry. | Architect specialist, high confidence, identifies the plan's six-character collision claim as false; the full-id variant preserves identity without a new ID facility. |
| 6 | What limits apply? | 1,000 live entries, 1 MiB index, 50 queue rows, 15-minute bounded review tokens; fail visibly at capacity. | Applied conservative design defaults within the architect's bounded-generation condition; public availability may pause during rebuild. |
| 7 | Why no mockup or implementation proof? | Text-only design; gate and PR publication belong to the next two workflow steps. | The current assignment is step 1 of 3, and this worktree has no shared browser environment descriptor. |
