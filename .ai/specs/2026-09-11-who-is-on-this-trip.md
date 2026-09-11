# Who is on this trip: the people route, the membership guards, and the visibility switch

| Field              | Value |
| ------------------ | ----- |
| **Status**         | draft |
| **Issue**          | #118  |
| **Spec PR**        | none  |
| **Implementation** | none  |

`01-S6a` · FR #118 · Parent PRD #104 · Stage `01-S6` of `docs/plans/01-trips-core.md` (frozen), its **first slice**; PRD decisions 1b, 6, 11 and 16.

Source plan: `docs/plans/01-trips-core.md`, stage `01-S6` — "Who is on this trip, including the people without accounts". That stage is cut in two. This spec is the member half. Guests — the `trip_guests` table, the guest writers, the guest-into-member merge and its relinker registry — are `01-S6b` (#119) and are named here only where this slice has to leave a seam for them.

## 📝 TLDR

A trip's people get their own route. Today there is no people surface at all, and the three membership writers in `src/server/repos/trips.ts` are unguarded in three distinct ways — they accept a user id from outside the caller's organization, they will remove a trip's last owner, and not one of them asserts the owner role. This spec puts the guards **inside the writers**, so they hold for a route, a queue consumer and a seed script alike; adds `listTripParticipants` as the one read model every later participant picker will consume; and ships `/trips/$tripId/people` — the members list, the invite control and the workspace-visibility switch — reached from the sub-navigation's Share button.

It is a route, not an eighth tab: `TRIP_TABS` stays at seven. A membership change is a statistics write (PRD decision 11), so adding or removing a member enqueues one `travel-stats` envelope for that person through the fan-out `trip-lifecycle.ts` already owns.

## 📝 Problem Statement

**Who has it.** Anybody who plans a trip with other people. A trip can have members — `trip_members` has been on disk since the foundations — and there is no screen in the product that lists them, no way to change somebody's role, no way to take somebody off a trip, no way to leave one, and no way to decide whether the rest of the workspace can see the trip at all. The owner's only route to any of it is the database.

**The evidence, measured in the tree at `e53d97c3`:**

- `src/routes/_app/trips/$tripId/` holds nine route files (`index`, `route`, `plan`, `costs`, `collab`, `book`, `files`, `lists`, `transports`). None of them is a people surface.
- `listTripParticipants` does not exist: zero matches across `src/` and `e2e/`.
- `addTripMember` (`src/server/repos/trips.ts:1459`) parses its input, calls `requireTrip`, and inserts. It never checks that `values.userId` belongs to the caller's organization, so a well-formed id for _any_ account in the database becomes a membership row.
- `removeTripMember` (`:1483`) is a bare `tripMembersRepository.requireRemove`. Removing a trip's last `owner` leaves a trip on which `assertTripRole(scope, tripId, ['owner'])` refuses every write for ever — `updateTrip`, `archiveTrip`, `deleteTrip` and this spec's own visibility switch all route through `requireOwnedTrip`.
- `updateTripMember` (`:1471`) is a bare `requireUpdate`: no `requireTrip`, no role assert. An editor can promote themselves, and **demoting a sole owner reaches the same unownable trip the removal guard exists to prevent** — by a different verb.
- None of the three calls `assertTripRole`, the guard `01-S1` added at `:433` and which `transports.ts`, `itinerary.ts` and the lifecycle handlers all use.
- `listTripMembers` (`:1422`) orders by `asc(tripMembers.createdAt)` alone. `created_at` is a millisecond timestamp, so an owner and a member created inside one request tie, and SQLite may return tied rows in either order.
- `src/components/layout/trip-sub-nav.tsx:161` — the Share button is a `Link to="/trips/$tripId/collab"`, the conversation tab, which is not a people surface and not a sharing surface either.
- The one existing caller of the three writers outside tests is `src/routes/api/dev/-seed/apply-trip.ts` (`:158`, `:165`), which calls them with an `owner`-scoped seed principal.

**What it costs.** Two different things, and they deserve separating. The missing screen is a product hole: a collaborative trip planner cannot say who is on the trip. The missing guards are an integrity hole that is worse than it looks, because `01-S8`'s initial-members picker and `01-S9`'s participant vocabulary are both scheduled to call these same writers — a guard added at one call site would be a guard the next call site does not have. That is precisely the failure `docs/SPEC.md` §8 is written against, and it is why the guards ship on their own pull request ahead of the screen.

## 📝 Proposed Solution

Four moves, in dependency order, and nothing wider.

1. **The guards go inside the writers** (`src/server/repos/trips.ts`). `addTripMember` resolves the target through `getMembership` (`src/server/repos/members.ts:144`) and refuses a user who is not in the caller's workspace. `removeTripMember` refuses the trip's last `owner`, and `updateTripMember` refuses to demote them — one trip invariant, two verbs that reach it. All three call `assertTripRole(scope, tripId, ['owner'])`, with one documented exception: the **self-removal** path, where the membership row being removed is the acting user's own. The exception lives inside `removeTripMember`, not beside it, so there is no second path around the guard.

2. **`listTripParticipants(scope, tripId)` becomes the one read model.** It calls `requireTrip` **first** — the specific trap being that `listTripMembers` answers a foreign trip id with `[]` through the tenant filter rather than raising, so a reader that skips `requireTrip` reports "a trip with no people" instead of refusing. It returns one array of a discriminated union whose `guest` variant is **declared and never produced** until `01-S6b`, which is what makes every later picker exhaustive over `kind` from this slice on.

3. **A route-local server module** (`-server/people.ts`) holds one loader and five writes. It contributes the tenant scope, a Zod boundary and the payload shape; every authorisation decision is already made in the repository. `setTripVisibilityFn` writes through the existing `updateTrip`, whose `requireOwnedTrip` is the owner guard decision 6 asks for, and refuses `'public'` at its own validator because this switch has two positions.

4. **The screen** is two columns above `lg` and a stack below it, invite first.

**Alternatives considered.**

- _A modal on the trip index, instead of a route._ Rejected, and the plan's argument stands measurement: a route buys a shareable address, a mobile layout that is a full page rather than a squeezed sheet, and a URL the e2e block can visit. A modal buys one fewer file.
- _Guards at the server-function layer._ Rejected: it is the shape the bug already has. `apply-trip.ts` calls these writers today and `01-S8`/`01-S9` will tomorrow; a handler-level guard is one that every non-handler caller silently lacks. This rejection is why the demotion guard in move 1 is in `updateTripMember` rather than in `setTripRoleFn`, at the cost of two edited test cases (Resolved assumption A4).
- _A new `trip-participants.ts` repository module._ Rejected for this slice — see Resolved assumption A1.

## 📝 Architecture

| Layer        | File                                                        | What it owns                                                                                   |
| ------------ | ----------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Repository   | `src/server/repos/trips.ts` (edit)                          | The four guards, the total order on `listTripMembers`, and `listTripParticipants`              |
| Route server | `src/routes/_app/trips/$tripId/-server/people.ts` (new)     | Tenant scope, Zod validators, the payload shape, the notification, the statistics fan-out call |
| Route server | `src/routes/_app/-server/trip-lifecycle.ts` (edit)          | Unchanged behaviour; exports one narrow helper so the fan-out keeps a single owner             |
| Route        | `src/routes/_app/trips/$tripId/people.tsx` (new)            | Loader wiring, `pendingComponent`, `errorComponent`                                            |
| UI           | `src/routes/_app/trips/$tripId/-ui/people-screen.tsx` (new) | The screen, built entirely from `src/components/ui`                                            |
| Layout       | `src/components/layout/trip-sub-nav.tsx` (edit)             | The Share button's destination                                                                 |

**Authorisation, said once.** Who may _see_ the trip is `requireTrip`, whose refusal is `NotFoundError` and is indistinguishable from a foreign tenant's (ADR 0007). Who may _change_ it is `assertTripRole`, whose refusal is `FORBIDDEN` and is safe precisely because it is reached only after `requireTrip`. Reading the people list requires membership **or** `visibility = 'organization'`, which `requireTrip` establishes inside the caller's scope. `beforeLoad` on the new route is UX — it makes the page fail gracefully — and is never the boundary.

**The statistics fan-out keeps one owner.** `enqueueTravelStats` (`src/routes/_app/-server/trip-lifecycle.ts:321`) and `affectedStatYears` (`:275`) are module-private, and they carry three decisions in their doc comment that must not be re-derived: the recipient set is the trip's members and not the workspace, the envelope ids are `00-S4`'s so a burst collapses onto one recompute per `(user, year)`, and a queue refusal is caught and logged rather than failing the write. This spec adds **one exported wrapper** to that module —

```ts
export async function enqueueTripStatsFor(
  scope: TenantScope,
  trip: Trip,
  recipients: ReadonlyArray<string>,
): Promise<void>
```

— which is `enqueueTravelStats(scope, trip.id, affectedStatYears(trip.startDate), recipients)` and nothing else. `people.ts` calls it with a one-element `recipients` array after an add and after a remove. No fan-out arithmetic is written twice.

**A removal enqueues for the person who left, and only them.** Their trip count changed; nobody else's did. The `recipients` parameter already exists on the private helper for exactly this reason — `deleteTrip` uses it because the cascade destroys its own recipient list — so this slice adds no new mechanism.

## 📝 Data Model

**No migration, no schema change, no new table.** This slice writes only rows that already exist:

- `trip_members` — read, inserted, updated and removed by the guarded writers.
- `trips.visibility` — `text` with `trips_visibility_chk` over `TRIP_VISIBILITIES = ['private','organization','public']` (`src/server/db/schema.ts:262`, `:698`, `:751`), default `'private'`. This slice writes two of the three values and refuses the third.
- `notifications` — one row per invitation, through the existing `notify()` (`src/server/repos/notifications.ts:129`).

`trip_guests` is `01-S6b`'s table and is filed there, not here. The union's `guest` variant is a **type-level** declaration in this slice: no column, no query, no row.

**Sensitive data.** `MemberProfile` (`src/server/repos/members.ts:118`, `:210`) carries `email`. The people payload carries **none of it**. `listTripParticipants` projects `{ name, image }` off the joined profile and drops the address; the invitable list does the same. This is asserted directly rather than assumed — see the seam test in the Implementation Plan. No `z.string().email()` appears anywhere in the module: the picker searches profiles the server already resolved, so an address is never an identifier on the wire.

## 📝 API Contracts

All in `src/routes/_app/trips/$tripId/-server/people.ts`. Zod v4, `z.strictObject()` with the `error` parameter, and `z.enum(TRIP_MEMBER_ROLES)` reading the tuple `src/server/db/schema.ts:263` already exports rather than restating it.

| Function              | Method | Input                        | Returns                  |
| --------------------- | ------ | ---------------------------- | ------------------------ |
| `loadTripPeople`      | GET    | `{ tripId }`                 | `TripPeoplePayload`      |
| `addTripMemberFn`     | POST   | `{ tripId, userId, role }`   | `{ memberId }`           |
| `setTripRoleFn`       | POST   | `{ tripId, memberId, role }` | `{ memberId, role }`     |
| `removeTripMemberFn`  | POST   | `{ tripId, memberId }`       | `{ removed: true }`      |
| `leaveTripFn`         | POST   | `{ tripId }`                 | `{ removed: true }`      |
| `setTripVisibilityFn` | POST   | `{ tripId, visibility }`     | `{ tripId, visibility }` |

```ts
export type TripParticipant =
  | {
      readonly kind: 'member'
      readonly memberId: string
      readonly userId: string
      readonly role: TripRole
      readonly colour: string | null
      readonly name: string
      readonly image: string | null
    }
  // Declared, never produced until 01-S6b (#119). Every `kind` switch is
  // exhaustive from this slice on, so the guest variant lands as data and not
  // as a new shape every picker has to learn.
  | {
      readonly kind: 'guest'
      readonly guestId: string
      readonly displayName: string
      readonly colour: string | null
    }

export interface TripPeoplePayload {
  readonly tripId: string
  readonly visibility: TripVisibility
  readonly viewerUserId: string
  readonly viewerRole: TripRole | null
  readonly participants: ReadonlyArray<TripParticipant>
  readonly invitable: ReadonlyArray<{
    readonly userId: string
    readonly name: string
    readonly image: string | null
  }>
}
```

**`colour` is in the union and is not rendered by this screen.** `trip_members.colour` (`schema.ts:772`) is the per-trip tint the participant surfaces use — the expense-split rows in `04-*`, the planner's participant chips in `01-S9`. It belongs to the read model those surfaces consume, which is what `listTripParticipants` is for; the people list identifies people by avatar and name and has nothing to tint. Carrying it costs one column of one query and saves every later picker a second read.

**`loadTripPeople` sends an answer, not a directory.** `invitable` is the workspace's members (`listMemberProfiles`) minus everybody already on the trip, computed on the server, so the client never receives a list it then has to subtract from. For a non-owner it is `[]` — a reader who cannot invite is not handed the workspace roster.

**`viewerRole` is `null` for an organization-visible trip the caller holds no membership on.** That is a real state after ADR 0007, and it is what makes the screen read-only rather than broken.

**`setTripVisibilityFn` accepts `z.enum(['private','organization'])` only.** `'public'` is the share plan's value (`COL-10`/`COL-11`, `07-collaboration-and-sharing.md`) and this switch has two positions; a payload carrying it is a validator refusal, not a silent downgrade.

**`loadTripPeople`'s decisions live in an exported `readTripPeople(scope, tripId)`.** Outside a Start build a `createServerFn` handler's return value is unreachable from a unit test — a direct call runs the handler and discards its result. The handler therefore becomes the tenant scope plus the validator, and everything it decides sits in a plain async function the tests call directly. Writes are read back through the repository; a read cannot be, which is why only the read needs this.

**Repository signatures added or changed in `src/server/repos/trips.ts`:**

```ts
export async function listTripParticipants(
  scope: TenantScope,
  tripId: string,
): Promise<Array<TripParticipant>>
```

`requireTrip` first, then `listTripMembers`, then `listUserProfiles` for the ids, then the projection and the ordering. `addTripMember`, `updateTripMember` and `removeTripMember` keep their signatures exactly; only their bodies gain guards. That matters for `BACKWARD_COMPATIBILITY.md`: no exported signature changes, so nothing downstream needs a migration — but the _behaviour_ of three existing writers tightens, which is called out under Risks.

## 📝 UI/UX

**Route.** `src/routes/_app/trips/$tripId/people.tsx`, default SSR, the same loader/pending/error shape every sibling route uses (`collab.tsx:23-27` is the pattern).

**It is a route, not an eighth tab.** `TRIP_TABS` (`src/components/layout/nav-model.ts`) stays at seven, which `src/lib/__tests__/trip-tab.test.ts:26` asserts with a literal `toHaveLength(7)`. The screen is reached from the sub-navigation's existing Share button, whose `Link` destination moves from `/trips/$tripId/collab` to `/trips/$tripId/people` — a one-line change at `trip-sub-nav.tsx:161`. The button's words do not change: the screen holds the visibility switch now and will hold link sharing when `COL-10`/`COL-11` land, so "Share" stays honest.

**Layout.** Above `lg`, two columns. Left: the members list. Right: the invite control, then the visibility card, then the space the link-sharing card will occupy. Below `lg` the columns stack **invite first**, because on a phone the reason you opened this page is to add somebody.

**The reserved link-sharing card renders nothing.** `docs/SPEC.md` §7 bans placeholder copy, and a card announcing a feature that does not exist is exactly that. What this slice ships is the column that reserves the space, and a comment in the aside naming `COL-10` and `COL-11` (`docs/plans/07-collaboration-and-sharing.md`) as the tickets that fill it.

**The member row.** `Avatar`, the person's name, a role `Badge`, an owner marking, and a `Badge` reading "You" on the caller's own row. A non-owner row carries a remove `IconButton`; the caller's own row carries a **leave** affordance instead — a different verb, a different icon, and a different consequence, because leaving redirects to `/trips` and removing does not move you anywhere. The role control is a `Select` on each row, owner-only, and it is **absent from the row of a trip's sole owner**, because the only role change available there is the demotion `updateTripMember` now refuses.

**There is no handle on the row.** The ticket's Desired behaviour names one; `user` has `name`, `email` and `image` and nothing else identity-shaped, so a handle can only be derived from the address. Resolved assumption A3 records the decision and its reasoning.

**The visibility card.** A `Card` with one `Switch` reading "Visible to everyone in the workspace" and its current state in words beneath it. Rendered interactive for the `owner`; rendered as the sentence alone, with no control, for everybody else. Flipping it is a plain toggle rather than a dialog — it is reversible — but the sentence changes with it so the consequence is read rather than inferred.

**No new primitive.** Everything on the screen comes from `src/components/ui`; `components/ui` itself is not touched and nothing is added to it.

**States.**

- _Empty._ The members list always has at least the owner, so it has no empty state. The **invite** control does: a workspace whose every member is already on the trip shows a resolved empty state pointing at workspace invitations rather than an endlessly empty dropdown.
- _Skeleton._ The route's `pendingComponent` renders two column skeletons of the loaded lists' height, reusing `RowsSkeleton` from `src/routes/_app/-ui/scaffold.tsx`.
- _Error._ The route's `errorComponent` uses the shipped `ErrorPanel`, as every other trip route does. A failed write leaves its own row in an error state carrying the server's message and a Retry, and never clears the list.
- _Destructive confirmation._ Removing somebody states that they lose access and that what they added stays; leaving states that you lose access until somebody adds you back. Both are `Dialog`s with a `loading` button, never a browser `confirm`.

**Accessibility, where this screen is not the house default.** The remove and leave controls are `IconButton`s whose accessible names include the person's name, so a screen-reader user never meets three identically-named buttons. Focus after a removal moves to the list heading rather than being dropped on a detached node. The `Switch` is labelled by the sentence it governs and announces its state through the primitive's own `role="switch"`/`aria-checked`. Everything else — contrast, keyboard order, the five interaction states — is `docs/SPEC.md` §2, which applies without being restated.

**Motion.** Rows enter on opacity and a small lift, staggered and capped, within the §2 duration and easing tokens; a removed row leaves on opacity. `prefers-reduced-motion: reduce` collapses both to opacity.

## 📝 Visual change expected

| Route                   | State                                                                           | Viewports       | Themes      |
| ----------------------- | ------------------------------------------------------------------------------- | --------------- | ----------- |
| `/trips/$tripId/people` | Owner, two-column: members, invite, visibility switch                           | 360, 1280, 2560 | light, dark |
| `/trips/$tripId/people` | Owner, invite `Combobox` open                                                   | 360, 1280       | light, dark |
| `/trips/$tripId/people` | Owner, remove-confirmation `Dialog`                                             | 1280            | light, dark |
| `/trips/$tripId/people` | Editor / viewer: no role control, no invite, visibility as a read-only sentence | 360, 1280       | light, dark |
| `/trips/$tripId/people` | Stacked layout below `lg`, invite first                                         | 360             | light, dark |
| Any trip route          | Sub-navigation Share button now leads to the people route                       | 1280            | light       |

No existing screen changes visually. The sub-navigation change is a destination, not a repaint.

## 📝 Copy

Thirty-one new keys. All land in the existing `trips` namespace, in **all 23 locales in this same change**, per `docs/SPEC.md` §9 and the `i18n-messages` skill; the parity test enforces it. `error.people` joins the namespace's existing per-tab failure-title block (`error.trip`, `error.plan`, `error.costs`, `error.collab`, `error.book`, `error.transports`, `src/lib/i18n/messages/en/trips.ts:27-32`); everything else is prefixed `people.`.

| Key (`trips` namespace)          | `en` text                                                                      |
| -------------------------------- | ------------------------------------------------------------------------------ |
| `error.people`                   | The people did not load                                                        |
| `people.title`                   | People                                                                         |
| `people.description`             | Who is on this trip, and who can find it                                       |
| `people.members.title`           | On this trip                                                                   |
| `people.role.label`              | Role                                                                           |
| `people.role.owner`              | Owner                                                                          |
| `people.role.editor`             | Editor                                                                         |
| `people.role.viewer`             | Viewer                                                                         |
| `people.you`                     | You                                                                            |
| `people.owner.hint`              | A trip always keeps at least one owner                                         |
| `people.remove.action`           | Remove {name} from this trip                                                   |
| `people.remove.title`            | Remove {name} from this trip?                                                  |
| `people.remove.body`             | They lose access to the plan straight away. What they added stays on the trip. |
| `people.remove.confirm`          | Remove                                                                         |
| `people.leave.action`            | Leave this trip                                                                |
| `people.leave.title`             | Leave this trip?                                                               |
| `people.leave.body`              | You lose access to the plan until somebody on the trip adds you back.          |
| `people.leave.confirm`           | Leave                                                                          |
| `people.cancel`                  | Cancel                                                                         |
| `people.invite.title`            | Add somebody                                                                   |
| `people.invite.placeholder`      | Search the people in this workspace                                            |
| `people.invite.action`           | Add to trip                                                                    |
| `people.invite.role`             | They join as                                                                   |
| `people.invite.empty`            | Everybody in this workspace is already on this trip                            |
| `people.invite.emptyHint`        | Somebody new joins the workspace first, in Settings                            |
| `people.visibility.title`        | Who can find this trip                                                         |
| `people.visibility.switch`       | Visible to everyone in the workspace                                           |
| `people.visibility.private`      | Only the people listed here can see this trip                                  |
| `people.visibility.organization` | Anyone in this workspace can open this trip                                    |
| `people.error.lastOwner`         | A trip keeps at least one owner. Make somebody else an owner first.            |
| `people.error.notInWorkspace`    | That person is not in this workspace                                           |

**`people.error.lastOwner` answers both verbs.** It is what the screen shows whether the refusal came from removing the last owner or from demoting them, because from the reader's side it is one rule.

**`people.cancel` is namespace-local on purpose.** The catalogue has no shared action namespace — `modules.action.cancel` and `console.dialog.cancel` are each their own — and inventing one is a cross-cutting change this slice does not own.

**The notification needs no new key.** `addTripMemberFn` writes `titleKey: 'shell.notification.trip.invited.title'` and `bodyKey: 'shell.notification.trip.invited.body'`, both already in the catalogue (`src/lib/i18n/messages/en/shell.ts:172-173`), with `{ tripTitle }` and `{ actorName }` as params, the trip's own URL as `actionUrl` and the trip id as the entity. One notification per invitation, so no fan-out and no chunking question — `notifyMany` is not used and the queue is not touched by the notification.

**No composed sentences.** Nothing on this screen concatenates two messages: the namespace's own doc comment records why, and a state sentence that changes with a switch is two whole messages rather than one with a slot.

## 📝 Edge Cases & Failure Scenarios

| Case                                                           | Behaviour                                                                                                                                                                                   |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Adding a user id from another organization                     | `getMembership` answers `null`; `addTripMember` raises. The screen shows `people.error.notInWorkspace`. The picker cannot produce such an id — the guard is for every other caller.         |
| Adding somebody already on the trip                            | They are not in `invitable`, so the picker cannot offer them. A direct call inserts a second row; the unique constraint on `trip_members` is the backstop, and the screen never reaches it. |
| Removing the trip's last owner                                 | Refused in `removeTripMember`. The screen shows `people.error.lastOwner` and the row stays.                                                                                                 |
| Demoting the trip's last owner                                 | Refused in `updateTripMember`, with the same message. The screen does not offer a role control on a sole owner's row, so the guard is for every other caller.                               |
| The sole owner tries to leave                                  | Same refusal, same message: leaving _is_ self-removal, and the last-owner guard runs before the self-removal exemption.                                                                     |
| An editor tries any membership write                           | `assertTripRole` raises `FORBIDDEN`. The screen never offers the control; the guard is for everybody else.                                                                                  |
| A non-member opens a private trip's people route               | `requireTrip` raises `NotFoundError`. The route's `errorComponent` renders `ErrorPanel`; the reader learns nothing about whether the trip exists.                                           |
| A non-member opens an organization-visible trip's people route | Readable. `viewerRole` is `null`, `invitable` is `[]`, every control is absent, and the visibility state is a sentence.                                                                     |
| `setTripVisibilityFn` receives `'public'`                      | Validator refusal before any repository call.                                                                                                                                               |
| The queue binding is unavailable when a membership changes     | `enqueueTravelStats` catches, logs once and returns. D1 is already written; a stale statistics panel is a far smaller harm than a save that appears to have failed.                         |
| `notify()` fails on an invitation                              | The membership row is already written. The notification is awaited inside the same handler, so a failure surfaces as a write error on a write that partly succeeded — see Risks.            |
| Two members created in the same millisecond                    | `listTripMembers` breaks the `created_at` tie on `id`, which is `newId()` and time-sortable, so the list is totally ordered and "owner first" is stable.                                    |
| A member who has left the workspace                            | `listUserProfiles` returns no row for them. The participant is dropped from the list rather than rendered nameless, and they are not invitable.                                             |

## 📝 Risks & Impact Review

**Blast radius: three existing repository writers tighten.** Their signatures do not change, so nothing fails to compile; their _refusals_ change, so a caller relying on the unguarded path breaks at runtime. A repo-wide scan finds exactly one non-test caller — `src/routes/api/dev/-seed/apply-trip.ts:158,165` — which calls them with an `owner`-scoped seed principal and is therefore unaffected by the role assert. It seeds within one organization, so the workspace guard passes too. The seed is exercised by `pnpm worktree:bootstrap` and by the e2e fixtures, so a mistake here fails loudly rather than quietly.

**Two test fixtures depend on the states the guards make unreachable, and both are declared work.**

- `src/server/queue/__tests__/reminders.test.ts:257` — the `dropTripMember` helper builds an ownerless or memberless trip through `removeTripMember`, for the two cases at `:742` and `:755` that assert what the reminder sweep does when it meets one. That assertion is still worth having: the state is unreachable through the product but not unreachable in the table, for rows predating the guard or a member whose account has left the workspace. The helper deletes the row through the harness database instead, with the reason written down beside it. Test-only, and it lands **before** the guard so the suite is never red between two steps.
- `src/server/repos/__tests__/tenant-isolation.test.ts:3311` and `:3341` — both demote a sole owner through `updateTripMember` on the way to asserting something else entirely (that a demoted owner gets `FORBIDDEN` rather than `NOT_FOUND`, and that a delete refused to a demoted owner leaves the trip intact). Each gains a second owner before the demotion; what they assert is unchanged. Two lines in two cases, in a file this spec already owns.

**`BACKWARD_COMPATIBILITY.md`.** Nothing on its protected list is broken. The new route is additive; the new server functions are additive; `listTripParticipants` is a new read rather than a changed one; no migration runs; no exported signature changes. The tightening of three writers is a behaviour change to an internal repository surface with one in-repo caller, not to a published contract.

**PRD decision 11 versus the frozen plan.** The plan's `01-S6` server section says "nothing slow, nothing enqueued". FR #118's Definition of Done requires that a membership change enqueue a `travel-stats` task, citing decision 11. The ticket is the execution surface and it wins; the enqueue is implemented through the existing fan-out so the plan's real concern — not inventing a second queue mechanism — is honoured. Recorded here so a reviewer reading the frozen plan beside this spec does not read the difference as drift.

**Reversibility.** Every state change on this screen is undone by its opposite on the same screen: a removal by an invitation, a role change by a role change, a visibility flip by the flip back. Leaving is the one exception — a member who leaves cannot re-add themselves, which is why it is a dialog and why its copy says so. No migration means no rollback story: reverting a phase's pull request restores the previous behaviour exactly.

**Review focus.** `risk-high` is right on the ticket. A reviewer should spend their attention on three things: that the guards are in the writers rather than in the handlers, that `listTripParticipants` calls `requireTrip` before it calls anything that would answer `[]`, and that no email reaches the payload.

## 📝 Owned paths, and the twenty-seven this spec adds

FR #118's Owned paths, unchanged:

- `src/server/repos/trips.ts` — edit.
- `src/routes/_app/trips/$tripId/-server/people.ts` — new.
- `src/routes/_app/trips/$tripId/people.tsx` — new.
- `src/routes/_app/trips/$tripId/-ui/people-screen.tsx` — new.
- `src/components/layout/trip-sub-nav.tsx` — edit.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append, **plus two existing cases edited** (`:3311`, `:3341`; see Risks and A4).
- `src/server/repos/__tests__/member-isolation.test.ts` — append.
- `e2e/trips-core.spec.ts` — append.

Added by this spec, each with the reason it could not be avoided:

- `src/lib/i18n/messages/{23 locales}/trips.ts` — edit, **23 files**. `docs/SPEC.md` §9 and `CLAUDE.md` require a new key in every locale in the same change, and the parity test enforces it. The ticket named the obligation without naming the files.
- `src/routes/_app/-server/trip-lifecycle.ts` — edit. One exported wrapper over the module's own private fan-out. The alternative is a second implementation of a fan-out whose doc comment holds three decisions, which `docs/SPEC.md` §8 forbids.
- `src/server/repos/__tests__/trip-people.test.ts` — new. The ticket names unit invariants (last owner by both verbs, the workspace guard, the role guards, self-removal, participants owner-first, the `requireTrip`-before-answering trap, the millisecond tie) and no unit-test path to hold them.
- `src/routes/_app/trips/$tripId/-server/__tests__/people.test.ts` — new. The seam invariants: the invitable subtraction, a person who has left the workspace, the notification's keys and params, the per-person `travel-stats` envelope, no email on the wire, `'public'` refused.
- `src/server/queue/__tests__/reminders.test.ts` — edit, test-only. See Risks.

That is 23 + 4 = **27**. `src/routeTree.gen.ts` is **not** an owned path and is never hand-edited: `pnpm generate-routes` is a step of Phase 2 and the regenerated tree travels in the diff, which is the one mechanical exception the plan grants a stage that adds a route file. `.ai/specs/README.md` is regenerated by `pnpm generate-spec-index` and travels with this spec.

## 📝 Resolved assumptions (autonomous defaults)

Six Open Questions, resolved under `om-spec-writing --autonomous`. Each is here to be overruled before merge.

**A1 — `listTripParticipants` lives in `src/server/repos/trips.ts`, not in a new module.** The frozen plan puts it in `src/server/repos/trip-guests.ts`, a file `01-S6b` creates. This slice has no guests module and FR #118's Owned paths name no new repository file. Putting it beside `listTripMembers`, whose result it shapes, adds no file, no barrel export line and no import cycle. `01-S6b` may move it to `trip-guests.ts` when it fills the guest variant; at that point it has exactly one consumer, so the move is cheap. The **union type and its discriminant are the contract** and do not change either way — that is what later pickers depend on. _Rationale: least new surface; the plan's placement is driven by a file this slice does not create._

**A2 — the statistics fan-out is reached by exporting one wrapper from `trip-lifecycle.ts`.** The alternatives were re-implementing the envelope arithmetic inside `people.ts`, which duplicates a concept carrying three decisions in its doc comment, or dropping the requirement, which contradicts the ticket's Definition of Done. The export is additive and changes no existing behaviour. _Rationale: `docs/SPEC.md` §8, one concept one owner; the added owned path is one file and one line of public surface._

**A3 — the member row shows no handle.** FR #118's Desired behaviour names "avatar, name, handle, role badge"; the `user` table has `name`, `email` and `image` and nothing else identity-shaped, so a handle in this slice can only be the local part of an email address. That contradicts the same ticket's "no email appears anywhere" more than it honours the row description, and it would put a fragment of an address in front of every trip member when today the full address is rendered only on the admin-gated workspace screen (`src/routes/_app/admin.tsx:388`). The row ships as avatar, name, role badge, owner marking and the "You" badge. A real handle is a `user` column and belongs to the account area. _Rationale: does not widen what the workspace already exposes; reversible — a handle is additive once a column exists. Overrule this if a derived `@local-part` is wanted on the row._

**A4 — demoting a trip's sole owner is refused in `updateTripMember`, not in the server function, and two existing test cases are edited to make room for it.** FR #118 names three guards and demotion is not among them — but this slice is what makes demotion **reachable**, because before it nothing in the product changed a role, and a demoted sole owner leaves exactly the unownable trip the removal guard exists to prevent. Guarding it in the handler instead was considered and rejected: it is the shape this spec's own Proposed Solution rejects, and `01-S8` and `01-S9` will call `updateTripMember` without going through `setTripRoleFn`. The cost is two lines in two existing cases in `tenant-isolation.test.ts` (`:3311`, `:3341`), both of which demote a sole owner incidentally on the way to asserting something else; each gains a second owner first and its assertion is untouched. The file is already this slice's, with disposition _append_ — editing two cases inside it is the one place this spec steps past that disposition, and it does so deliberately rather than leaving a reachable way to make a trip unownable. _Overrule this if the demotion guard should instead be a separate ticket against `01-S1`, in which case the role control must stay off a sole owner's row regardless._

**A5 — the Share button keeps its words.** Its destination moves from the conversation tab to the people route; the label stays `shell.trip.nav.share`. The screen holds the visibility switch today and the link-sharing card when `COL-10`/`COL-11` land, so "Share" is not a lie, and renaming a shell key is a 23-locale change for a word this slice was not asked to change. _Rationale: smallest scope; trivially reversible._

**A6 — the e2e evidence is one behavioural block in `e2e/trips-core.spec.ts`, with no screenshots.** The frozen plan specifies `e2e/trips-core.visual.spec.ts` and a capture ritual; ADR 0016 retired the visual gate and FR #118 names the behavioural file. The ticket and the ADR agree with each other and disagree with the frozen plan, and they win. Browser evidence for the screen comes from `om-auto-qa-pr` on Phase 2's pull request, which is what `needs-qa` is for. _Rationale: follows the current ADR; no baselines are recorded or moved._

## 📋 Phasing

**Two phases, two pull requests, in this order.** They are independently deployable and the first is independently valuable: `01-S8`'s initial-members picker and `01-S9`'s participant vocabulary need the guards and the read model, not the screen, and shipping a `risk-high` authorisation change on its own pull request is what gives a reviewer a diff they can actually hold in their head.

- **Phase 1 — the membership writers hold, and there is one read model.** Steps 1-7. No user-visible change: no route, no copy, no screen. Its pull request carries `Refs #118` and `skip-qa`.
- **Phase 2 — the people route.** Steps 8-13, on top of Phase 1. Its pull request carries `Closes #118` and `needs-qa`.

**The visibility switch stays in Phase 2 rather than becoming a third phase.** It is a different column, a different PRD decision and a different repository function from the membership writers, and on those grounds it is separable — but it is on the same route, in the same loader payload, and a people screen that cannot say who can find the trip answers half of the question the ticket asks. Splitting it would buy a smaller diff and cost a coherent screen.

## 📋 Implementation Plan

Each step leaves the application working — including the test suite, which is why Step 1 precedes the guard it exists to make room for. The gate is `.ai/agentic.config.json`'s `validation.commands`; individual steps run the targeted subset, and the full gate runs at the end of each phase.

### Phase 1 — the membership writers hold

**Step 1 — free the reminder fixtures from `removeTripMember`.** `dropTripMember` (`src/server/queue/__tests__/reminders.test.ts:257`) deletes the membership row through the harness database rather than through the repository, with the reason written beside it: the sweep's behaviour on an ownerless trip is still worth asserting because the row can exist even once the writer refuses to create one. _Verified by:_ `pnpm test src/server/queue` green, with the cases at `:742` and `:755` unchanged in what they assert.

**Step 2 — give the two demotion cases a second owner.** `tenant-isolation.test.ts:3311` and `:3341` add a second `owner` membership before demoting the first. _Verified by:_ `pnpm test src/server/repos` green; both cases still assert `FORBIDDEN` on `archiveTrip` and on `deleteTrip` respectively.

**Step 3 — the total order on `listTripMembers`.** Add `asc(tripMembers.id)` after `asc(tripMembers.createdAt)` (`src/server/repos/trips.ts:1428`), with a comment naming the millisecond tie. _Verified by:_ a new case in `src/server/repos/__tests__/trip-people.test.ts` that inserts two memberships with an **identical `created_at` and ids in the opposite order to their insertion**, and asserts the read returns them in id order. The case must be shown to fail with the tie-break removed — an ordering test that passes either way is asserting the engine's rowid order, not the query's promise.

**Step 4 — the workspace guard on `addTripMember`.** Resolve `values.userId` through `getMembership` and raise when it is absent. _Verified by:_ `trip-people.test.ts` — a user id from a second organization raises and writes no row; and the appended `tenant-isolation.test.ts` block — `addTripMember` with a user id from B's organization raises in A's scope.

**Step 5 — the last-owner guard on both verbs.** `removeTripMember` counts the trip's `owner` rows and refuses when the target is the last one; `updateTripMember` refuses a patch that moves the last `owner` off the `owner` role. _Verified by:_ `trip-people.test.ts` — removing the sole owner raises and the row survives; demoting the sole owner raises and the role is unchanged; both succeed once a second owner exists.

**Step 6 — the owner assert on all three writers, with the self-removal exemption.** `addTripMember`, `updateTripMember` and `removeTripMember` call `assertTripRole(scope, tripId, ['owner'])`; `updateTripMember` and `removeTripMember` gain the `requireTrip` that resolves the trip id from the membership row first. `removeTripMember` skips the assert — and only the assert — when the target row's `userId` is `scope.ctx.userId`. _Verified by:_ `trip-people.test.ts` — an editor is refused `FORBIDDEN` on all three; a viewer removes their own membership successfully; a viewer is refused removing somebody else's. Plus the appended `member-isolation.test.ts` block: a non-member of a private trip gets `NotFoundError`, an editor gets `FORBIDDEN` from every membership write and from the visibility write, and organization visibility makes the read available without enabling any write.

**Step 7 — `listTripParticipants`, and the fan-out wrapper.** `requireTrip` first, then `listTripMembers`, then `listUserProfiles` for the member ids, projected to `{ name, image }` and ordered owner-first over Step 3's total order; the `guest` variant declared and never produced. Alongside it, `enqueueTripStatsFor` exported from `trip-lifecycle.ts`. _Verified by:_ `trip-people.test.ts` — participants come back owner-first with the discriminant intact, no `email` field appears on any element, and a member with no workspace profile is dropped rather than rendered nameless; `tenant-isolation.test.ts` — B's trip id raises `NotFoundError` rather than returning `[]`, which is the trap the ordering of `requireTrip` exists to close; and `trip-lifecycle-side-effects.test.ts` unchanged and green, which is what proves the wrapper changed no behaviour in the module it was added to. The wrapper's own behaviour is asserted in Step 9, at its first caller.

**Step 8 — Phase 1's gate.** Every command in `validation.commands`, in order. Phase 1's pull request opens here.

### Phase 2 — the people route

**Step 9 — the server module.** `src/routes/_app/trips/$tripId/-server/people.ts`: the six functions, the Zod validators, `readTripPeople` holding the loader's decisions, the invitation notification, and the per-person statistics enqueue after an add and after a remove. _Verified by:_ `src/routes/_app/trips/$tripId/-server/__tests__/people.test.ts` — the invitable list subtracts the trip's members and is `[]` for a non-owner, a person who has left the workspace appears in neither list, the notification carries `shell.notification.trip.invited.*` with `{ tripTitle, actorName }`, an add and a remove each produce exactly one `travel-stats` envelope naming that one person, the serialised payload contains no seeded email address, and `'public'` is refused by the validator before any repository call.

**Step 10 — the copy.** Thirty-one keys into `src/lib/i18n/messages/en/trips.ts` and all 22 other locales, per the `i18n-messages` skill. _Verified by:_ the i18n parity test in `pnpm test`.

**Step 11 — the screen, the route and the sub-navigation.** `-ui/people-screen.tsx`, `people.tsx`, then `pnpm generate-routes`; then the one-line destination change at `trip-sub-nav.tsx:161`, which needs the route to exist for the typed `Link` to resolve. _Verified by:_ `pnpm typecheck` — a route file missing from the generated tree fails here rather than in the browser — and `pnpm lint`.

**Step 12 — the e2e block.** One `test.describe('01-S6a — Who is on this trip')` appended to `e2e/trips-core.spec.ts`, declaring its own route table, with `watchConsole` attached and `fatal` empty:

1. The Share button in the sub-navigation reaches `/trips/$tripId/people`.
2. The route renders the members list with the owner's row and the visibility card.
3. The invite control opens and offers a workspace member who is not on the trip.
4. A non-owner reader sees no role control, no remove control, no invite control, and the visibility state as a sentence with no switch.

Case 4 is the one that carries the role-dependent rendering the unit tests cannot reach. _Verified by:_ `bash .ai/scripts/e2e.sh`.

**Step 13 — Phase 2's gate and its evidence.** Every command in `validation.commands`, in order, with `bash .ai/scripts/check-generated.sh` confirming the route tree and the spec index are generated output rather than a hand-edit. The screen's visual and accessibility commitments — both themes, three viewports, the stacked layout, focus after a removal — are evidenced by `om-auto-qa-pr` on this phase's pull request, which is what its `needs-qa` label is for.
