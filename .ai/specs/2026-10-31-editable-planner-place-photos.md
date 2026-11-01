# Editable planner place photos

| Field              | Value |
| ------------------ | ----- |
| **Status**         | ready |
| **Issue**          | #1318 |
| **Spec PR**        | none  |
| **Implementation** | none  |

## TLDR

Travellers will upload, replace, remove, crop and rotate a planner place photo, with one saved
selection reused across planner surfaces. Places without an explicit selection retain a stable
relevant stock default when an approved provider is available, otherwise the existing deterministic
category illustration. This is a design-only deliverable: a person merges the specification before
`afk-to-tickets` creates implementation tickets; it references #1318 without closing it.

## Scope and current evidence

The supplied screenshot and issue's approved planner-only interaction define the scope. No TREK
source, assets or implementation were inspected (clean-room rule). Trip covers, journal galleries,
collection covers, coordinates and itinerary ordering are excluded. No credentials, account,
dependency, production configuration or live provider integration is obtained by this task.

Verified at the authoring HEAD: `src/server/repos/places.ts` accepts `imageUrl`; this is a display
URL, not photo provenance or ownership. `PlaceThumb` has a category/id-based fallback and an image
error state; that state currently survives a URL change, so replacement must reset it per selection.
`PlaceMarker` passes the URL to `PlacePin`; the planner's `-server/plan.ts` and `-ui/plan-model.ts`
carry the URL. `files.ts` guards writable trips and metadata before storage access; file-policy
permits markup attachments and is not an inline-image sanitizer. `ObjectStore` is an injectable
byte-storage port, not a decoder. No image-transformation binding or server codec is configured.

## Resolved assumptions (autonomous defaults)

| #   | Question                            | Applied default                                                                                                                                                      | Why                                                                                                                                                              |
| --- | ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Provider and transformation policy? | Ship deterministic fallback and local policy first; Unsplash stays disabled pending separate compliance/operator approval; uploads require a trusted server decoder. | Independent security/architecture specialist, high confidence: no existing decoder or permission to store API photos; browser Canvas is not a security boundary. |
| 2   | Split the design?                   | One selection/lifecycle contract with independently shippable local and provider phases.                                                                             | Independent specialist, high confidence: precedence, removal and ownership have one owner; the issue explicitly requests the complete experience.                |

## Proposed solution

One place-photo owner resolves explicit choice, stable default and deterministic fallback.
Originals, transformed display bytes and provider provenance are distinct from the URL sent to a
renderer. Existing places without new metadata continue rendering their existing image URL.

## Ownership and architecture

- `src/server/repos/place-photos.ts` (new) owns tenant-scoped metadata, quota reservations,
  selection/version compare-and-set and cleanup claims. Reuse trip readability/write guards and
  tenant base access. It never imports a Worker binding. Every method has tenant and trip isolation
  tests. No SQL is added to a function, route or storage helper.
- `src/server/place-photos/service.ts` (new) owns the operation lifecycle through injected
  ObjectStore, decoder, provider and clock ports. The decoder is one narrow interface, not a new
  media framework. Reuse `storage/objects.ts` for byte copy/deletion and the existing outbound
  metering mechanism for each actual provider attempt. Functions compose bindings once; no server
  function calls another server function.
- `src/server/fns/place-photos.ts` (new) exposes validated reads/writes and authenticated byte
  delivery. Product UI belongs in the planner's route-local `-ui/` directory; shared `PlaceThumb`,
  `PlacePin` and `PlaceMarker` remain render-only. A single resolved projection flows through
  `-server/plan.ts` and `-ui/plan-model.ts` to details, itinerary, rail and markers.
- Byte keys remain inside the existing swept family:
  `trips/<organizationId>/<tripId>/place-photos/<photoId>/<variant>`; no client chooses a key.
  Include stages and garbage under this prefix so workspace deletion reaches them. Trip/place
  purge and trip copy explicitly enumerate metadata; do not assume file-row discovery finds it.

## Persistence and compatibility

Proposed additive tenant tables (generated migrations only):

- `place_photo_assets`: organization, trip, place, generated asset id, original/display keys,
  verified content type, dimensions and exact byte counts, lifecycle (`staged`, `ready`, `garbage`),
  operation id, created/expiry timestamps. Each asset belongs to exactly one place in one trip;
  original and derivative keys are immutable. Assets are not ordinary trip files, cannot be linked
  as covers/receipts and have no general file-library delete action.
- `place_photo_selections`: organization, trip, unique place, version (initially zero), explicit
  asset id nullable, default provider/id/approved hotlink nullable, photographer/profile/source
  attribution, default-resolution state and timestamps. Default provenance survives upload/removal.
  No keys or original bytes appear in general place projections. Foreign keys include parent
  ownership invariants; repository checks bind all parents to the same workspace and trip.
- A quota reservation records the operation's maximum bytes while processing, with an expiry and
  idempotent settlement. Reuse a suitable existing atomic quota reservation if available at
  implementation HEAD; otherwise this module owns an additive tenant row. Never check the sum
  and then write unconditionally. All storage usage readers include ready, staged and retained
  garbage bytes plus live reservations without double counting. Before activation, every existing writer spending these shared quotas (attachment uploads,
  cover writes and trip-copy paths included) must use the same atomic admission mechanism.
  `recordFile` currently checks usage then inserts; that existing sequence does not prevent
  photo-versus-attachment races and must not be treated as atomic. File-count quota counts each
  retained original and derivative as one stored object; temporary reservation reserves two slots.

`places.image_url` is retained as the legacy fallback. No backfill fetches arbitrary existing
URLs. No new photo metadata means old behavior. A successful new upload supersedes a legacy URL;
removal thereafter restores the stable default/local illustration, never silently reinstates the
legacy URL. Add optional photo projection fields to existing outputs, preserve `imageUrl` and all
old input shapes for at least one release. `imageUrl` for new private selections is an authenticated
application URL, never an R2 key. Old place updates that omit photo fields leave selections alone;
an explicit legacy `imageUrl` change, including null, is serialized through the same photo owner,
bumps version and cannot leave hidden owned assets. Preserve that legacy caller's visible result.
Do not widen old trip-room enums incompatibly: use an optional invalidation field or the existing
protocol-version migration. The read resolver reconciles old rows rather than rewriting them.

**Rollback constraint:** deploy readers/lifecycle guards before enabling uploads. Once private
photo writes are enabled, rolling back behind those guards is unsafe: an old binary could remove
rows without cleanup or omit quota usage. Disable new writes and retain compatible delivery,
cleanup and accounting code; do not drop tables/columns or activate a public bucket as recovery.

## Authorization and delivery

Resolve `appScope()` and the workspace claim on every call. Tenant filtering alone is insufficient:
resolve the stored place's trip and current trip readability before metadata or bytes. A supplied
trip id must equal the stored parent. Mutation also requires a current owner/editor seat and a
non-archived writable trip; workspace administration alone confers no photo write privilege.
Repeat/bind these predicates at commit, including trip deletion/archive and membership changes.
A reservation taken before permission loss cannot authorize a later save.

| Caller/state                                                     | Read metadata/display                   | Upload/replace/remove/crop/rotate |
| ---------------------------------------------------------------- | --------------------------------------- | --------------------------------- |
| Current workspace member, trip owner/editor, active              | Yes                                     | Yes                               |
| Current trip viewer                                              | Yes                                     | No                                |
| Nonmember of organization-visible trip                           | Yes, if normal trip readability permits | No                                |
| Nonmember of private trip                                        | Indistinguishable not-found             | Indistinguishable not-found       |
| Archived trip, otherwise readable                                | Yes                                     | No, including stage/finalize      |
| Foreign tenant, workspace departure, inaccessible/deleted parent | Indistinguishable not-found             | Indistinguishable not-found       |
| Public Share token, anonymous reader                             | No private photo fields/bytes           | No                                |

Private display delivery uses authenticated fetch through the existing workspace-claim
middleware, then a browser Blob URL, because an ordinary `<img src>` does not send the claim
header. A planner-owned image resolver fetches each asset/version once, distributes the resulting
Blob URL to all four surfaces, aborts obsolete requests and revokes URLs on selection change,
unmount, logout or workspace/session change. No Blob URL is persisted or sent in room frames.
The server projection carries a read descriptor, not bytes; existing `imageUrl` stays populated
with the authenticated reference for compatibility, and an old client unable to resolve it shows
its safe fallback. Never fall back to a public object URL after a fetch refusal. The authenticated
read function returns only the ready display variant after rechecking access;
private originals are available only to an authorized editor opening this place's editor.
A separate staged-original read is limited to the staging actor, a currently writable parent, a
nonexpired operation and its processing lease rules; it never appears in planner projections.
It serves only normalized raster bytes with the same private/no-store headers, not raw input. Neither
an asset id, display URL, forged key, legacy external URL nor guessed variant grants access.
Use `Cache-Control: private, no-store`, `X-Content-Type-Options: nosniff`, exact raster Content-Type,
inline disposition with a generated safe filename, and a sandbox CSP on byte responses. No public
R2 domain, presigned bearer URL, CDN cache or service-worker cache for private bytes. Public
projections retain existing fields but never include new private application URLs or metadata.
Old legacy public-image behavior is unchanged. A logout/session change invalidates editor drafts
and discards pending client results. Original EXIF is never exposed in display bytes.

## Image policy and transformation prerequisite

Accept one JPEG, PNG or WebP, at most **10 MiB**, nonempty, each decoded side **1..8192 px**, at most
**24 million pixels** and one frame. Reject animation, SVG/XML/HTML, GIF, AVIF/HEIC, unknown formats,
malformed/truncated data and claimed type/signature mismatch. The generic attachment allow-list
is not widened or tightened. Signature sniffing alone is insufficient: a trusted server decoder
must fully decode within pixel, memory and time limits before an asset can become ready.

Normalize EXIF orientation, discard EXIF/GPS/other metadata and re-encode a canonical private
original as WebP, maximum 4096 px on its longest side, at most 10 MiB. Keep it solely for later
edits; discard the untrusted uploaded input after normalization. Crop is a rectangle normalized to
the oriented canonical original (finite coordinates, inside bounds, positive width/height), then
rotate clockwise by 0/90/180/270 degrees. Re-encode a WebP display variant, longest side 1600 px,
at most 4 MiB. The preview uses the same order. All surfaces use the same composition, `object-fit:
cover` only for their frame; thumbnails need no additional stored derivatives. Non-square crops
are allowed. Re-edit from canonical original, never from the previously cropped display.

The implementation must supply a trusted, resource-bounded decoder/encoder. There is **no existing
runtime capability to assume**. Its provisioning, cost and pinned-stack compatibility need a
separate approved infrastructure change before the upload phase can ship. This spec authorizes
neither a package nor a paid Images binding. If that prerequisite is absent, upload/edit controls
remain unavailable with explanation; the complete fallback phase still ships. Client Canvas may
preview but cannot certify content or dimensions. Decoder invocation is bounded to 10 seconds;
no retries of malformed input. Runtime must enforce limits during decoding, not after allocating
an unbounded bitmap. Test actual decoding/encoding in process, not a fake that trusts file headers.

## Failure-safe writes, quotas and cleanup

1. Validate scalar input with Zod and file shape/stream length, authorize the stored parent and
   atomically reserve 14 MiB/two objects against workspace storage/file ceilings. Preserve the old
   photo. Enforce the input byte limit while streaming even without Content-Length. Operation ids
   are client-generated bounded UUIDs scoped to actor/workspace/place; the server owns asset ids.
2. Decode and normalize at stage time; write the immutable canonical object and a durable staged
   record. On Save, acquire the operation lease, validate the submitted crop/rotation and transform
   that canonical into the display object; record exact
   sizes and durable staged ownership before exposing either. A transform/output exceeding limits
   fails. No stored raw upload survives the request. Exact retained bytes count against quota.
3. In one conditional D1 batch, revalidate ownership/role/archive/version, publish the ready asset,
   swap the explicit selection and version, settle its reservation and mark superseded assets as
   garbage. Return the current version and resolved projection. A partial object write or refused
   commit never changes the previous selection; compensate staged bytes idempotently.
4. Delete garbage only after it is durably unreferenced. Failed deletes retain accounting and a
   retryable cleanup claim; periodic bounded, tenant-scoped cleanup retries and reaps stages after
   one hour. A processing lease covers stage normalization and is renewed for Save transformation;
   after stage completes the reservation remains until save/cancel/expiry. A conditional
   cancellation/expiry claim cannot win against an active processing/finalization lease. Recheck status
   and ownership when claiming cleanup, never follow arbitrary keys from a request. Cleanup does
   not decrement usage before deletion succeeds. Workspace deletion already sweeps the key family;
   trip purge includes it, and both operations tolerate missing metadata/objects and retries.

Exactly one finalization wins for an expected version; a concurrent upload/removal/default job
cannot overwrite a newer explicit choice. A conflict reloads the saved selection, retains the local
preview for an explicit retry and announces what changed. The same operation retry returns its
recorded outcome without another transform/quota charge. On lost response, query operation status
and selection before offering retry; unknown status is explained, not treated as failure. Client
results apply only to the dialog/place/session generation that started them.

Removal clears explicit selection and marks its owned assets garbage in the same conditional
batch; the previously saved default returns. Crop/rotate create a completely new asset: copy the canonical original to its new owned key,
then generate the display derivative. The old asset owns only its old keys and becomes garbage
after the swap; no original key is shared. Reserve 14 MiB/two slots for this operation too. Account for
all live old/new objects during replacement, so a full workspace may refuse editing until space is
freed. Cancellation deletes only the caller's staged operation; it never deletes a ready selection.

No cross-place/trip/workspace shared private assets or reference counting. Copying a trip makes
independent byte copies and metadata within destination quota, with new keys/ids. Copying to a
collection drops private photo bytes/URLs because collection photos are out of scope. Copying from
a collection cannot claim ownership from its URL. Trip-copy fails and rolls back the destination
if an owned photo cannot be copied; never reports a complete copy with a broken private photo.
Provider attribution/default identity may be copied without duplicating bytes. Place deletion
marks its assets garbage before deleting references; both plain deletion and itinerary-aware
journey cleanup paths must call the owner. Trip/workspace deletion captures ownership before
cascades and sweeps the exact prefix, never a foreign prefix. A departed uploader loses access but
the trip retains the photo; account erasure strips actor attribution per the existing erasure
policy without deleting shared trip content. Export includes display bytes only for an authorized
trip export, never originals/keys; public exports omit private photos.

## Provider policy and current official evidence

**Optional candidate: Unsplash API; disabled by default.** No provider activation is required for
the local phases. Current official pages checked on **2026-10-31**:

- [API documentation](https://unsplash.com/documentation): API host/authentication, random-photo
  query support and required direct CDN URLs.
- [API guidelines](https://help.unsplash.com/en/articles/2511245-unsplash-api-guidelines):
  attribution, selection tracking, confidential keys and non-automated authentic use.
- [License](https://unsplash.com/license) and [API terms](https://unsplash.com/api-terms): general
  photo permission is distinct from API obligations; this design claims no right to redistribute
  an API photo as a stored application asset.

Choose direct API hotlinking rather than downloading/rehosting stock photos. No stock originals,
proxy thumbnails or cropped stock derivatives enter R2 or private storage. Crop/rotate applies to
uploads only; an editor wanting a custom composition uploads their own image. Preserve provider
URLs and required query parameters. Render photographer and Unsplash links with attribution and
referral parameters on every photo-bearing surface (compact credit controls adjacent to row/pin;
keyboard-focusable, not hidden in hover-only popovers). If a compact surface cannot provide the
required credit, render the local fallback there. Stock does not replace an upload during loading.

**Activation gates:** operator supplies credentials and approves request-data disclosure; provider
confirms the automatic default-selection use complies with the current non-automated-use guideline;
implementation rechecks terms, metering and all credit surfaces. Do not silently reinterpret that
policy as permission. No activation, signup, legal commitment or contact with the provider occurs
in this task. The provider phase is not ready to ship until those gates are satisfied. No claim is
made that every place has a stock match or that this design completes #1318 after local delivery.

When approved, a first owner/editor request resolves a default once for a place with no explicit
choice. Do not call a provider on viewer read, anonymous/public read or every reload. Send only a
bounded public locality/landmark query derived from an explicitly confirmed public place name and
city/country; never notes, exact private coordinates, dates, traveller identities or private
addresses. Private/manual places use local fallback unless the editor explicitly confirms the
public query. Show the query and disclosure before the first request; store only consent/query
state needed for this operation, never arbitrary full provider responses.

Ask the random-photo endpoint for one landscape result with the approved query and strict content
filter; randomness is at selection time only. Reject a result without matching returned public
locality/name metadata rather than treating keyword relevance as geographic proof. No verified
match means fallback; an empty result is an acceptable complete outcome. Persist validated photo
id, exact hotlink and attribution once using a compare-and-set on unresolved default state.
Track inclusion using the documented download-location endpoint without fetching the photo bytes.
A transient lookup/tracking failure keeps local fallback; an explicit editor retry is permitted,
no automatic retry storm. Existing saved defaults are stable across reloads and place renaming.
Default resolution may never clear/replace explicit selection, including an upload saved while a
lookup was running. Removal reveals the saved default; it does not roll another random result.

Only fixed HTTPS `api.unsplash.com` API paths and vetted `images.unsplash.com` image URLs are
accepted. Construct API paths from validated ids; never fetch a caller-supplied URL or blindly
follow `download_location`. Reject redirects (including API-to-private/internal destinations),
userinfo, nonstandard ports, private/literal IPs and unrecognized hosts. Keys remain server-side
in Authorization headers and never enter URLs/logs/projections. Limit JSON to 256 KiB, five-second
attempt timeout, at most one attempt per explicit operation; respect denial/rate limits with local
fallback. Meter every attempt with existing provider policy and deployment ceilings. Rate-limit
per workspace/place/actor; deduplicate simultaneous default jobs. There is no arbitrary image URL
proxy. Browser hotlinks disclose IP/browser metadata to the CDN; use `referrerPolicy="no-referrer"`
and disclose that before opting into stock. Missing credentials, refusal, unsafe response, missing
attribution or broken hotlink yields deterministic local artwork and no blind reselection.

## API contracts

New functions use Zod on JSON scalars and a validated bounded FormData file stream, keep application
workspace-claim middleware, and return typed codes mapped to catalogue copy. New functions may
require their own fields; changes to existing functions add optional fields only.

| Operation        | Input                                                           | Result                                                                            |
| ---------------- | --------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Read selection   | placeId                                                         | version, source kind, display URL, safe credit, capabilities                      |
| Stage upload     | placeId, operationId, file, expectedVersion                     | staged operation id, private preview/read capability, expiry; no published change |
| Save upload/edit | placeId, operationId, expectedVersion, crop rectangle, rotation | committed version and selection or typed refusal/conflict                         |
| Remove           | placeId, operationId, expectedVersion                           | committed default/fallback selection                                              |
| Cancel/status    | placeId, operationId                                            | current operation state; cancel only own uncommitted stage                        |
| Resolve default  | placeId, operationId, expectedVersion, confirmed public query   | persisted default or fallback state                                               |

Server-derived dimensions/ownership/provenance override client claims. No storageKey, arbitrary
source URL, quota count or tenant id is accepted. Read responses expose neither original URLs nor
private keys. Editing an existing upload stages a new operation bound to its current asset/version;
only the editor receives a short-lived authenticated original route, reauthorized at delivery.
Denials distinguish role/archive only after readability is established; inaccessible ids always
use the same not-found shape. A new operation's id reused with a different payload is refused.

## UI/UX and Visual change expected

On `/trips/$tripId` planner, selecting a place exposes its image and a Change image action to an
owner/editor. The modal (mobile sheet with the same content) provides upload, crop, rotate, remove,
Save and Cancel. It previews without changing the saved image elsewhere. A viewer sees the image
and attribution without editing controls; archived trips explain read-only state. Local fallback
uses existing category artwork, not an empty or broken image. Crop/rotate is unavailable for stock
with an explanation directing the traveller to upload their own photo. No source URL field.

Crop supports numeric labelled x/y/width/height percentage fields and a reset action as well as
dragging; rotate is a labelled button, not a gesture requirement. Keep min/max constraints visible,
permit keyboard-only completion and zoom, and announce rotation and validation through a live
region. Controls meet 44px touch targets, RTL logical alignment and contrast in light/dark. File
picker accepts the narrow raster policy but the server revalidates it. Preview has a useful
localized label; repeated itinerary thumbnails remain decorative beside the place name.

Uploading/processing and saving have distinct status/progress text; a cancel remains reachable
while staging. On submit move focus to the status/heading before disabling Save; return focus to
the Change image trigger on success/close, or the live error summary on refusal. Keep file/draft
and previous image after validation/decoder/storage failure so a traveller can correct/retry.
For permission loss/archive, reload capabilities and explain the refusal; if that read fails,
retain the draft but stop writes and offer Reload. Do not reuse stale intent automatically.
A removed trigger returns focus to the selected place heading. Drawer switches and session changes
invalidate pending results. Unmount cleanup does not cancel a commit that may already have won.

After acknowledged save/remove, update all four planner surfaces through the same selection
projection, then invalidate route data and mirror existing room invalidations. Broken-image state
is keyed by photo version/URL so a later valid photo renders. A failed reload after successful save
says saved, refresh unavailable; it does not invite a duplicate upload. External stock credits
remain readable and keyboard accessible on desktop/mobile; no credits on generated local artwork.

No runtime UI changes in this specification PR. Future verification covers light/dark at 360px and
1280px, selected/empty/uploading/cropping/saved/error/role-loss/archive states; include Arabic RTL,
long localized copy and browser zoom. No image mockup or new visual asset is needed to define this
existing-dialog interaction; the supplied screenshot is reference evidence, not executable design.

## Copy

Proposed new `en` keys below must land in **all 23 locales** together in each implementation slice;
reuse existing Save/Cancel/Reload and generic file errors where semantically identical. No runtime
catalogue key is introduced by this design-only PR.

| Key                              | English text                                                                                                                                                                       |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| planner.photo.change             | Change image                                                                                                                                                                       |
| planner.photo.upload             | Upload your photo                                                                                                                                                                  |
| planner.photo.remove             | Remove your photo                                                                                                                                                                  |
| planner.photo.removeHint         | Your photo will be deleted. The saved default image or category illustration will return.                                                                                          |
| planner.photo.crop               | Crop image                                                                                                                                                                         |
| planner.photo.rotate             | Rotate clockwise                                                                                                                                                                   |
| planner.photo.resetCrop          | Reset crop                                                                                                                                                                         |
| planner.photo.cropX              | Horizontal start (%)                                                                                                                                                               |
| planner.photo.cropY              | Vertical start (%)                                                                                                                                                                 |
| planner.photo.cropWidth          | Width (%)                                                                                                                                                                          |
| planner.photo.cropHeight         | Height (%)                                                                                                                                                                         |
| planner.photo.preview            | Image preview for {place}                                                                                                                                                          |
| planner.photo.rotated            | Rotated to {degrees} degrees                                                                                                                                                       |
| planner.photo.processing         | Preparing your image…                                                                                                                                                              |
| planner.photo.saving             | Saving image…                                                                                                                                                                      |
| planner.photo.saved              | Image saved                                                                                                                                                                        |
| planner.photo.limit              | Use a single-frame JPEG, PNG or WebP up to 10 MiB and 24 million pixels, with neither side above 8192 pixels.                                                                      |
| planner.photo.invalid            | This image could not be read safely. Choose another image.                                                                                                                         |
| planner.photo.failed             | The image was not changed. Try again or choose another image.                                                                                                                      |
| planner.photo.quota              | There is not enough workspace storage to keep both the current and replacement image.                                                                                              |
| planner.photo.conflict           | The saved image changed while you were editing. Review it before trying again.                                                                                                     |
| planner.photo.unknown            | We could not confirm whether the image was saved. Check its status before trying again.                                                                                            |
| planner.photo.savedRefreshFailed | Your image was saved, but the view could not refresh. Reload to see it everywhere.                                                                                                 |
| planner.photo.permissionChanged  | Your access changed. Reload before editing this image.                                                                                                                             |
| planner.photo.archived           | Images cannot be changed on an archived trip.                                                                                                                                      |
| planner.photo.unavailable        | Image uploads are unavailable. The current image is kept.                                                                                                                          |
| planner.photo.stockUploadHint    | To crop or rotate, upload your own photo.                                                                                                                                          |
| planner.photo.stockConsent       | Find an image for “{query}” with Unsplash? This sends the public search text to Unsplash. Loading the image shares your IP address and browser information with its image service. |
| planner.photo.stockFind          | Find a default image                                                                                                                                                               |
| planner.photo.stockUnavailable   | No verified default image is available. The category illustration is shown.                                                                                                        |
| planner.photo.credit             | Photo by {photographer} on Unsplash                                                                                                                                                |
| planner.photo.creditOpen         | Image credit for {place}                                                                                                                                                           |

Credit uses separately rendered safe links, not translated HTML. Interpolation values are escaped;
error messages never echo object keys, provider tokens or unbounded provider responses.

## Acceptance tests and failure/race matrix

This is a specification, so the test-first requirement applies to the future implementation seams,
not a fabricated failing runtime test in this PR. Existing spec-registry tests validate this artifact.
Every implementation step starts with a failing test through the public interface it adds.

- Service tests use tenant repository fixtures with two organizations, public/private/archived
  trips, owner/editor/viewer/nonmember, and an ObjectStore fake supporting partial writes/deletes.
  Run every operation in the authorization matrix, asserting denied calls spend no provider,
  decoder or storage work. Include same-tenant wrong-trip ids, forged variants, actor departure,
  archive/delete between stage and finalize, and authenticated GET after access revocation.
- Real in-process transformation tests: EXIF orientation/metadata stripping, crop/rotate order,
  edge rectangles, invalid/nonfinite/out-of-bounds coordinates, empty/truncated/polyglot/markup,
  MIME mismatch, animated formats, byte/pixel/decompression limits and timeout. Decode the result
  and check actual dimensions/pixels plus metadata absence. Never mock away the trust boundary.
- Fake only the external provider at its adapter seam: match/no match/unsafe or malformed response,
  missing credit/keys, redirect/private endpoint attempts, limits, timeouts and tracking refusal.
  No live call or key needed for the suite. Activation needs a live known-place sample and current
  policy approval separately; no synthetic fixture proves geographic relevance or API rights.
- Lost response after committed save: status read recovers exactly one charge and selection.
  Status read failure remains unknown. Two simultaneous operations on the same version yield one
  winner; default lookup cannot overwrite an upload, remove cannot clear a later replacement,
  stale room refresh cannot replace the acknowledged new image, and stale dialog/session results
  do not affect a newly opened place. Bind authorization/version into the write, not a prior read.
- Quota near ceiling with two concurrent stages: at most one is admitted. Race a photo stage
  against an attachment, cover write and trip copy sharing storage/file quota; the total must
  never exceed the ceiling. Cover stage expiry vs
  active lease, write/transform failure, compensation failure, garbage retry, every delete path,
  trip-copy independence, copy rollback, collection-copy omission, workspace-prefix ownership and
  erasure actor cleanup. Original+derivative+stages+garbage account for real retained bytes.
- UI tests exercise keyboard numeric crop and rotate, cancellation, focus on success/error/retry,
  unknown write status, claim-header byte fetch, Blob revocation on workspace change, failed capability reload, changed-role/archive refusal, URL error reset,
  and catalogue parity/interpolation across 23 locales. Do not depend on jest-dom matchers.
- Browser journey: owner uploads a real raster, crops/rotates and saves; compare all four surfaces,
  reload, edit again, cancel, replace, remove and reload the stable fallback. Viewer reads but raw
  write requests fail; second workspace cannot fetch a copied display URL. Check broken URL,
  missing provider, limits and quota failure preserve old image, plus light/dark desktop/mobile,
  Arabic RTL, keyboard and credit access. Restart worktree server before collecting UI evidence.

## Risks and independent review gates

Private photo delivery, quota reservations and deletion are high risk. No upload/provider
implementation is authorized by triage's design-only approval. An independent security and tenancy
review must approve this specification and each relevant implementation diff; its conditions are
acceptance criteria. Runtime transformation provisioning and provider activation are explicit
prerequisites, not unresolved defaults to be silently guessed by an implementer. A person merges
the spec PR; it never says `Closes #1318` or claims runtime feature completion.

Local fallback requires no third party. Stock hotlinks can disappear and reveal browser metadata;
keeping a stable identity cannot guarantee permanent availability. New asset storage consumes
workspace quota and replacement temporarily needs both versions. No public/collection photo
feature is smuggled into this planner work. A future provider must undergo a fresh rights and
disclosure review; an arbitrary URL field is never an integration substitute.

### Independent review outcome

On 2026-10-31 an independent security/tenancy and architecture reviewer approved this design
with high confidence after re-reading the corrected specification and repository contracts.
Corrections clarified canonical-object ownership on re-edit, actor-only staged preview delivery,
stage-versus-Save ordering, atomic admission shared with existing file writers, and claim-protected
fetch-to-Blob image transport. The reviewer approved one cohesive design with separate phases.
This reviews the specification only; no decoder, provider key or future runtime was tested or
approved. Implementation and activation still require the gates above.

## Phasing

1. **Selection and fallback:** independent release preserving legacy URLs and resolving one stable
   photo projection everywhere, with secure unavailable controls until runtime prerequisites land.
2. **Private photo editing:** after approved decoder provisioning, one complete upload/edit/remove
   journey including delivery, lifecycle, quotas, copy/purge and accessibility. No partial unsafe
   upload endpoint is released.
3. **Optional stock defaults:** after provider compliance/operator gates, one complete sourced
   default with consent, attribution, persistence and fallback. Local editing works without it.

## Implementation Plan

### Phase 1 - selection and local fallback

1. Write repository/interface tests for absent metadata, legacy updates, explicit/default
   precedence, tenant/trip isolation and conditional versioning. Generate additive schema and
   introduce the owner/resolver without changing old callers. Test old-input compatibility.
2. Thread the resolved optional projection through planner loaders/models and all four surfaces;
   fix per-selection image-error recovery and retain deterministic fallback. Ship no provider calls
   or private byte routes. Verify render and stale-result tests plus localized unavailable states.

### Phase 2 - complete private editor

3. Independently approve/provision a resource-bounded decoder capability without a feature PR
   dependency change. First write failing real-codec safety/transformation tests; implement and
   measure decoder bounds in the target runtime before exposing upload. Without this evidence the
   phase is blocked, while Phase 1 remains useful and safe.
4. First test quota reservation/finalization/compensation, concurrent role/archive/version changes,
   authenticated claim-protected byte access, shared-quota writer races, cleanup and all
   copy/delete/export/erasure paths. Build service,
   functions and queue lifecycle as one backend slice kept disabled until its delivery and cleanup
   tests pass. Audit metadata never includes image bytes, query secrets or keys exposed to readers.
5. Write failing product tests and the browser journey, then implement upload/crop/rotate/remove
   using existing dialogs, file progress and route invalidation patterns. Land catalogue parity,
   keyboard/RTL/focus/error recovery with it; enable only after independent security and tenancy
   approval and the full configured gate. This phase is independently useful without stock.

### Phase 3 - optional compliant default

6. Obtain provider/operator activation evidence outside this task, recheck official terms and a
   known-place live sample. First test the disabled adapter and every fake-provider refusal/race;
   implement the bounded metered adapter and stable selection with no R2 stock copies.
7. First test consent and credits on every photo surface and explicit-choice races, then implement
   the optional UI and provider default. Full gate plus independent security/accessibility review
   and browser reload evidence are required before activation. Keep #1318 open until all required
   delivered behavior is verified; fallback alone does not satisfy stock-enabled delivery.
