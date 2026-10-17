# Planner undo through existing write interfaces

| Field              | Value |
| ------------------ | ----- |
| **Status**         | ready |
| **Issue**          | #124  |
| **Spec PR**        | #1333 |
| **Implementation** | none  |

## TLDR

Proposed: a memory-only, bounded undo ring for adding a Place, scheduling a Place, reordering and removing a Stop. This design preserves all four promised operations, but **live undo must not ship under the current no-server-change constraint**: existing interfaces cannot guarantee complete restoration or protect a racing traveller's changes. The specification is ready for review and slicing; it is not authorization to enable unsafe inverses. [Day detail](2026-10-16-planner-day-detail.md) is independently implementable now. Its first slice preserves the current weather Popover; migration of the existing weather renderer and badge focus is a separate integration slice, as explicitly amended in the weather specification.

## Problem and reviewed scope decision

Issue #124 asks for inverses through existing planner server functions and no undo endpoint or server history. Its Agent Brief requires any unfulfillable promise to receive an explicit reviewed decision. Read-only inspection found three concrete blockers: no atomic expected-version check on writers, missing restoration fields, and composite ordering writes without a shared transaction. A client refresh immediately before undo does not close the read/write race.

Independent product/UX and security/tenancy specialists selected the reversible option: specify the full intended contract, ship Day detail separately, and gate active undo until a separate server compatibility design resolves those blockers. This run adds no server work or new issues. Do not silently narrow “undo” to deleting the recreated Stop while losing its metadata, links or another traveller's work. A person reviews and merges this design PR with `Refs #124`; this issue stays open for subsequent spec-to-tickets slicing. No general undo endpoint, server history or redo is proposed.

## Verified current interfaces

Paths below are relative to `src/routes/_app/trips/$tripId/` unless stated otherwise.

| Promise        | Existing forward and candidate inverse                                                           | What is achievable today; exact gap                                                                                                                                                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Add Place      | `-server/plan.ts:createPlanPlaceFn` -> `deletePlanPlaceFn`                                       | Forward returns `placeId` and nullable `assignmentId`. Delete removes Place and cascading Stops; another traveller may have edited or reused it. No expected revision or provenance guard; destructive inverse unsafe under a race. Optional immediate schedule is a composite forward operation.       |
| Schedule Place | `schedulePlaceFn({tripId,placeId,dayId,index})` -> `unschedulePlaceFn({tripId,assignmentId})`    | New Stop id is returned. Inverse must remove only that created Stop, leaving Place and every older Stop. Concurrent metadata, participants and Reservation links may have been added; no guarded delete exists.                                                                                         |
| Reorder        | `reorderPlanFn({tripId,days})` -> prior affected-Day runs through the same function              | Stops and Notes only, max 4 Days and 200 items per Day; `clearTime` can erase times. Transport/Leg placement needs `reorderDayTransportsFn` separately, max 400 total refs, 200 Stop/Note refs. No conditional write, no shared atomic result; restoring order alone cannot restore dropped Note times. |
| Remove Stop    | `unschedulePlaceFn` -> `schedulePlaceFn`, then `updateStopFn`, reorder and Transport restatement | New assignment id; metadata restore is separate. `updateStopFn` accepts start/end, duration, notes, reservation status, but not `transportMode` or participants. Board omits transportMode and participants. Reservation links cleared on delete are not restored by scheduling.                        |

`src/server/db/schema.ts:dayAssignments` stores `transportMode` in addition to the board's fields; `assignmentParticipants` cascades on Stop deletion. Reservation `assignmentId` and `placeId` use `onDelete: 'set null'`. Restoring links using generic `updateBookingFn` would also enter its ledger and other side effects and still would not give an atomic restoration transaction. Do not treat it as a safe undo adapter by inference.

The current Place board projection is not a complete archival copy of a Place either. Place deletion is not itself a tracked forward action: undo of creation removes only the just-created object if an eventual atomic guard proves it has not acquired foreign dependants or edits. The ring stores no re-creation promise for arbitrary Place deletion.

## Reference research

Read on 2026-10-16: OpenStreetMap iD's primary-source [undo toolbar](https://github.com/openstreetmap/iD/blob/develop/modules/ui/tools/undo_redo.js) and [history interface](https://github.com/openstreetmap/iD/blob/develop/modules/core/history.ts). The map editor names the action to reverse and disables the action when no annotation is available or editing is unavailable. Adopt that action-specific affordance and permission gating. Its graph history/redo architecture is not evidence that remote planner mutations are reversible; deliberately omit redo and do not transplant its storage model. The Day-panel refinements come from the issue's supplied behavioral observations, not copied reference source or an asserted live walkthrough.

## Architecture and ownership

Future `-ui/plan-undo.ts` owns a pure bounded ring, with named exports and no React/network. `-ui/plan-inverse.ts` owns pure inverse planning and identifier substitution. A screen-owned coordinator in `-ui/use-plan-undo.ts` owns serialized effects, reconciliation and notifications; it reuses the screen's write ownership rather than creating a second concurrent write path. Existing `plan-board.ts`, `plan-move.ts` and `plan-transport-model.ts` remain the canonical read, move and Transport-restatement logic.

One ring per mounted Trip, scoped to current workspace, user and access generation. Do not persist it to storage, URLs, telemetry or browser history. Payloads include personal Notes and potentially Reservation relationships; discard all references on navigation, reload, logout, workspace/Trip switch, loss of edit permission or archive. Unmounting the workspace discards history. “Session” here means that mounted client lifetime, not the account's server session. No redo stack.

### Ring interface and invariants

The pure interface accepts immutable completed entries and provides `push`, `peek`, `takeLatest`, `clear` and `remapStopIds`; the exact TypeScript spelling is internal. `push` of the 21st completed operation evicts the oldest. Capacity is **20**, a product decision balancing recovery and retained data, not a platform limit. No time expiry; a transient notification disappearing does not remove undo availability.

Each entry has operation kind, localized action-key parameters, forward result ids, before/restoration data, expected post-write fingerprint/revision, affected Day ids and authoritative generation. Retain only fields needed for the inverse. Do not retain the entire Trip or unrelated Reservation records. `peek` is read-only; `takeLatest` consumes exactly once before effects, so refusal cannot retry automatically. Two undos consume reverse chronological entries. Undo writes never create new entries.

Record only after every subwrite and authoritative reconciliation of a forward operation succeeds. A failure before any committed write adds nothing. A known or ambiguous partial success clears the ring, fetches current state and explains the partial result; never invent a snapshot matching optimistic UI. Ordinary untracked writes invalidate existing entries because they may change assumptions: Note edits, Stay changes, Place edits/deletion, visit/participant changes, Transport edits and title/date changes if later supported.

### Execution and invalidation

All tracked forward operations, undo and relevant untracked local writes share one coordinator. While busy, prevent another planner mutation or undo activation; read-only map and panel actions continue. Do not queue a payload computed from stale UI. Await primary write, Transport restatement, and authoritative reconciliation in that order. Only then return to idle and show the next available action.

Any room update not provably this exact operation's echo clears the ring. Existing room signals must be inspected during implementation; no actor/operation correlation is assumed. Snapshot equality alone does not prove authorship. Reconnect, sequence gap, unknown-source reload or incomplete read clears history. A known local reconciliation may retain history only when its fingerprint matches the expected result and no external generation intervened. Foreign update during an in-flight operation prevents recording its inverse; reconcile its actual outcome and clear the rest.

Fingerprint comparison is a client invalidation aid, never concurrency protection. A separately reviewed server contract must atomically compare expected versions and authorize every affected object in the same transaction as the inverse. Until then the coordinator has no enabled production inverse adapter. A feature flag alone is not sufficient if the unsafe adapter can still be invoked.

### Complete restoration and identifiers

An inverse restores the previous user-visible arrangement and retained metadata, not original timestamps or audit ids. Before removal retain Day/Place references, full Stop start/end/duration/transportMode/notes/reservation status, participants, and exact Reservation links, with prior affected-Day runs including Notes and departing journeys. Current readers/writers cannot provide that complete set; the future contract must resolve it explicitly before capture is enabled.

If restoration creates Stop S2 for old S1, atomically remap every remaining entry that refers to S1: forward results, before/after snapshots, expected versions, typed Stop refs and relationship targets. Keep Place ids, Note ids and Transport/Leg ids unchanged even when their string equals S1. Chain mappings transitively; no dangling old id may be sent by the next undo. Perform the remap only after complete restoration succeeds, then reconcile expectations for older entries against the new authoritative state. A remap cannot invent a missing relationship or manufacture a version. Two consecutive undos, including an earlier schedule or reorder referring to S1, must use S2.

`updateStopFn` represents missing times/notes with empty strings and null duration with zero. Do not conflate a Place's default duration with the Stop override. Its inability to restore transportMode and participants is a blocker, not a conversion rule. Restoring a timed move also requires original Note/Stop time values; never clear times merely to force a visually identical order.

### Merged ordering and composite effects

Capture and compare the rendered order through `planBoard`, which sorts clock time before position and expands journeys into departure, travelling and arrival rows. Use typed refs, not raw indexes across id spaces. A schedule index counts Stops, not the mixed timeline; reconcile using canonical move/reorder and journey-restatement logic rather than passing a merged index to `schedulePlaceFn`.

For affected Days the candidate restoration first writes Stop/Note runs, then restates departing journeys using `journeyWritesFor`/`journeyWrites`. Travelling and arrival rows are derived and never written from those Days. Verify the reloaded merged order and metadata, not merely `{moved}` or `{placed}` counts: existing writers may drop stale ids or splice omitted rows. Persisted fractional values need not match old numbers if the same visible order is restored; time-bearing items must obey the existing clock policy.

These current multi-call effects are not atomic. If any subwrite fails after an earlier success, dispose the entry, clear older dependent history, reload and show “Only part of the change was reversed. Review the updated plan.” Do not automatically compensate or retry with stale data. A timeout is ambiguous; read authoritative state, never repeat a destructive call to find out. This recovery is required even after a future contract improves atomicity, for effects outside its transaction; it does not waive the gate for current multi-write restoration.

### Refusals and permissions

A rejected inverse is consumed and reports “This change could not be undone. The plan has been refreshed.” Other entries may survive only if authoritative state still proves their assumptions; otherwise clear them. Expected-version conflicts clear history. Permission or session loss clears all history immediately and invokes existing auth handling. Every existing writer still re-resolves Trip, Day and row under the authenticated tenant and write role; retained ids are never authorization. Future precondition design must preserve NotFound non-disclosure, owner/editor and archived-Trip guards.

## Required contract gate before live undo

The security/tenancy specialist approves design-only work with the following conditions. A separate compatibility specification must define atomic preconditions, complete Stop/read restoration, Reservation/participant restoration and ordering semantics, then receive security/tenancy approval before implementation of destructive inverses. This document does not introduce an endpoint, schema or required input. If existing server functions gain fields later, additive optional inputs must preserve old clients per BACKWARD_COMPATIBILITY §2, without letting the new undo client bypass its mandatory safety path.

The downstream slicer may schedule Day detail now. It must not generate an executable live-undo ticket merely because this document says `ready`. No enabled network undo, including apparently simple creation or schedule inverses, is within the current no-server slice. The ring and inverse planner may be designed/tested as internal modules together with the eventual complete capability; a disconnected utility is not a user-facing SLC release. Further server design is an explicit prerequisite, not work authorized by this task, and no follow-up issues are filed here.

## Visual change expected

Future only: an Undo control at the itinerary rail head, present only for nonempty eligible history; label names the next action, busy disables repeat activation and status uses the existing live notification surface. It remains absent under the current contract gate. No keyboard shortcut is introduced. Future QA covers desktop/mobile, light/dark, RTL, read-only/archived, and slow/refused writes without hiding map interaction. This design PR changes no rendered screen.

## Copy

Planned keys only; implementation adds every activated key in all 23 locales in the same slice. No user-facing safety claims such as “All changes restored” before authoritative verification.

| Key                              | English text                                                   |
| -------------------------------- | -------------------------------------------------------------- |
| `trips.plan.undo.addPlace`       | Undo adding {place}                                            |
| `trips.plan.undo.schedule`       | Undo scheduling {place}                                        |
| `trips.plan.undo.reorder`        | Undo reordering the plan                                       |
| `trips.plan.undo.removeStop`     | Undo removing {place} from {day}                               |
| `trips.plan.undo.busy`           | Undoing change…                                                |
| `trips.plan.undo.done`           | Change undone.                                                 |
| `trips.plan.undo.rejected`       | This change could not be undone. The plan has been refreshed.  |
| `trips.plan.undo.invalidated`    | The plan changed elsewhere. Undo history was cleared.          |
| `trips.plan.undo.partial`        | Only part of the change was reversed. Review the updated plan. |
| `trips.plan.undo.forwardPartial` | Only part of the change was saved. Review the updated plan.    |

## Observable test contract

Test first through pure ring/inverse interfaces and coordinator write adapters substituted at their boundary, using real ring/planning logic. Do not assert only mocked call counts. Each case compares returned state and the final authoritative arrangement.

| Case                    | Observable assertion                                                                                                                                                                     |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Capacity                | Complete 21 operations, newest 20 available; oldest evicted without invoking an inverse.                                                                                                 |
| Two undos               | Second then first inverse; history length decreases once per activation; inverse writes add no entries.                                                                                  |
| Add Place               | Only the forward-created Place and its owned Stop removed; foreign reuse/edit refuses under atomic precondition. Other Places survive.                                                   |
| Schedule                | Remove the created Stop only; Place stays, other-Day Stops survive; foreign metadata/link change refuses.                                                                                |
| Reorder                 | Restore mixed Stop/Note/departing Transport order, timed moves and original times; travelling/arrival rows are derived. No Transport-only or Note-only edit is silently tracked.         |
| Remove Stop             | Restore all retained metadata, transportMode, participants, exact Reservation relationships and merged position, with a fresh id.                                                        |
| Identifier chain        | Remove/recreate then undo an older schedule/reorder using the new id; transitive remap touches Stop refs only, including identical strings in other id spaces.                           |
| Rejection               | One attempt, entry discarded, truthful message, authoritative reload; no retry loop or fabricated row.                                                                                   |
| Partial forward/inverse | Fail each subwrite in turn and simulate ambiguous timeout; clear dependent history, read actual state, message partial outcome.                                                          |
| Invalidation            | Foreign update, unknown echo, sequence gap, reconnect, untracked write or incomplete reconciliation clears entries; exact own result alone may retain them.                              |
| Concurrency race        | Foreign write between client preflight and inverse execution is refused atomically without overwriting it. This test must fail under today's contracts and remain the live-release gate. |
| Isolation               | Other tenant and same-tenant inaccessible Trip ids disclose/mutate nothing; stale viewer/archive or revoked role refuses through real authorization boundaries.                          |
| Lifecycle               | Reload, unmount, Trip/workspace/user switch and permission loss discard data; no persistent browser history payload.                                                                     |
| Serialization           | Double activation sends one operation; forward action cannot race undo; busy controls re-enable after reconciliation.                                                                    |

Browser journeys eventually perform each of the four edits through the real planner, then undo and reload to prove persistence, including two consecutive undos after recreation and merged Transport placement. A second traveller races undo; their committed edit survives. Viewer/archived controls remain absent, rejected/partial writes are announced, console stays silent. No browser test is claimed to have passed for this unbuilt capability.

## Resolved assumptions (autonomous defaults)

| #   | Question                           | Applied default                                                                                        | Why                                                                                                                                                                                                  |
| --- | ---------------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Bundle panel and undo?             | Separate specs; panel can ship independently.                                                          | Independent product/UX specialist, high confidence: different readiness and no runtime dependency.                                                                                                   |
| 2   | Accept client-only stale checking? | No active undo until separate reviewed server preconditions and full restoration exist.                | Security/tenancy specialist, high confidence: no CAS, missing transportMode/participants and cleared Reservation links; product specialist independently agreed. ESCALATE: no for design-only scope. |
| 3   | Capacity and lifetime?             | 20 completed edits, oldest eviction, mounted Trip memory only, no redo or time expiry.                 | Product/UX specialist, high confidence: bounded recovery without persistent personal data. Security specialist requires scope/access changes to clear history.                                       |
| 4   | Partial success?                   | Discard affected history, authoritative refresh, report partial result without automatic compensation. | Security specialist requires explicit partial-result semantics; current Transport writes are separate and cannot be described as atomic.                                                             |

## Review limits and compatibility

The specifications were checked against repository interfaces; no live undo or new server contract was tested or approved. Current endpoints remain unchanged. Full restoration and race rejection cannot be demonstrated with them: those are explicit implementation gates, not passing assertions in this design. Read the eventual server compatibility design before any implementation claim. The current issue label remains risk-medium because this deliverable is documentation; destructive/stale-state implementation is risk-high and requires security/tenancy approval before claim and on the resulting diff.

## Design review evidence

Independent architecture review approved both documents after checking scope cohesion and the cited read/ordering contracts. Independent security/tenancy review approved **design-only**, conditional on preserving the live-undo gate, access-scoped cache and exact joins; it does not approve the future server contract. Product/UX review approved after its panel-local Escape correction was applied. These are design verdicts, not runtime QA evidence.

## Implementation Plan

1. **Contract design prerequisite, separate from this no-server task.** Resolve expected-version atomicity, complete projections, typed id remapping, relationship restoration and composite effects. Security/tenancy reviewer must approve the complete proposal; document backwards-compatible deployment. Do not create a production adapter or runnable implementation ticket before this condition is met.
2. **One complete undo capability, after that prerequisite ships.** Start with failing tests at the ring, inverse planner and coordinator adapter seams above. Implement all four tracked edits end-to-end with authoritative snapshots, one writer, correct remaps and foreign-update invalidation. Existing write adapters remain the only effect boundary; do not add server history or an undo endpoint. Ship control and all 23 locales together. No release containing only a detached ring or one misleading partial inverse.
3. **Release verification in the same slice.** Prove real tenant/member isolation, atomic race refusal and full restoration through interface tests, then the browser journeys and visual evidence. Run the committed validation gate, security/tenancy review of destructive calls and stale restoration, and required QA. Enable only after all gates pass; otherwise control stays absent and the panel release is unaffected.
