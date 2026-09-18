# A guest on a trip: the record, the refusal of duplicates, the bound, and the merge into a member

| Field              | Value       |
| ------------------ | ----------- |
| **Status**         | implemented |
| **Issue**          | #119        |
| **Spec PR**        | #553        |
| **Implementation** | #574        |

`01-S6b` · FR #119 · Parent PRD #104 · Stage `01-S6` of `docs/plans/01-trips-core.md` (frozen), its **second slice**; PRD decisions 7 and 7b.

Source plan: `docs/plans/01-trips-core.md`, stage `01-S6` — "Who is on this trip, including the people without accounts". The stage is cut in two. `01-S6a` (#118, spec `.ai/specs/2026-09-11-who-is-on-this-trip.md`, shipped) built the member half: the `/trips/$tripId/people` route, the three membership guards, the visibility switch, and `listTripParticipants` with a `guest` variant **declared and never produced**. This spec is the guest half, and it fills that variant.

## 📝 TLDR

A guest is a person on a trip who has no account: the child, the friend invited by phone, the companion who will never sign in. The `trip_guests` table has been on disk since `0013_confused_nightcrawler.sql`, and nothing reads it — `listTripGuests` does not exist, the people screen has no guest list, and the `guest` branch of `TripParticipant` is a type with no rows behind it.

This spec adds the repository module that owns the guest record, the four owner-only writes over it, two rules that are the reason the record is interesting at all — a duplicate name is **refused inline rather than suffixed**, and a trip holds at most **fifty** guests — and the guest-into-member **merge**: an irreversible, owner-only operation that hands everything pointing at a guest to a member who has since joined, through a relinker registry that later plans register into.

It is one capability delivered in two independently shippable phases: the record (Phase 1) and the merge (Phase 2). No migration: this spec owns no schema.

## 📝 Problem Statement

**Who has it.** Anybody who travels with somebody who does not have an account in the workspace — which, on a personal trip, is most of the people on it.

**The evidence, measured in the tree at `027c9f84`:**

- `src/server/db/schema.ts:801-818` declares `tripGuests` with `trip_guests_org_trip_idx` and `trip_guests_trip_name_unq`, and `drizzle/0013_confused_nightcrawler.sql` carries the migration. `grep -rn "tripGuests" src/server/repos src/routes` returns **nothing**: the table has no reader, no writer, and no test.
- `TripParticipant` (`src/server/repos/trips.ts:1726-1741`) declares `{ kind: 'guest', guestId, displayName, colour }`. `listTripParticipants` (`:1758`) produces only `member` rows. Every `kind` switch written since `01-S6a` is exhaustive over a branch that can never occur.
- `src/routes/_app/trips/$tripId/-ui/people-screen.tsx` renders one list. There is no second list, no guest badge, and no add-a-guest control.
- The three plans that will link a guest to something — `04-budget-and-currencies.md` (expense shares), `05-packing-and-todos.md` (which already files `assigned_guest_id` in the agreed shape), and the day-plan participants row — have no read model to build a picker against and no write to register a merge into.

**Why it matters, stated as the failure it prevents.** The upstream product this stage is sourced from appends an ordinal to a duplicate guest name: a second "Anna" becomes "Anna 2". The server cannot tell a second Anna from the same Anna typed twice, so the silent suffix is how a cost gets split onto a person who does not exist, and how a packing item gets assigned to nobody. Refusing the name and making the reader supply the distinguishing word is the whole point of decision 7.

**The out-of-scope note on the ticket is stale.** FR #119 says the `trip_guests` table "does not exist" and that this ticket "cannot start until it exists". The table shipped additively in `b97cb368` / PR #288, ahead of its readers, exactly as the wave-3 schema stage was asked to. The prerequisite is met; this spec adds no migration and does not edit `src/server/db/schema.ts`.

## 📝 Proposed Solution

One new repository module, `src/server/repos/trip-guests.ts`, owns the guest concept end to end: the record, the two rules, the participant read model, and the merge with its registry. Every write goes through `requireTrip` then `assertTripRole(scope, tripId, ['owner'])`, so the decision is inside the repository and holds for a route, a seed script and a queue consumer alike — the posture `01-S6a` established for members.

Four things are deliberately **not** done:

- **No quota.** A guest cannot sign in, cannot be notified and exists inside one trip. It is not a seat, and `assertQuota` is for numbers we sell. What bounds guests is `MAX_TRIP_GUESTS = 50`, a repository invariant declared next to the reason it exists.
- **No notification.** `addTripMemberFn` calls `notify()`; the guest writers call nothing. A guest has no account and no address — that is what being a guest means.
- **No schema.** The `guest_id` columns that let a guest hold an expense share or a packing item belong to the plans that own those surfaces. This spec gives them the read model (`listTripParticipants`) and the write (`registerGuestRelinker`) and nothing else.
- **No colour picker.** `trip_guests.colour` exists and the repository accepts it; no server function exposes it, because no screen offers one yet.

**The alternative that lost.** A guest could have been a `trip_members` row with a null `user_id`. It would have reused every member writer and every member guard — and it would have put a nullable identity column into the one table whose `user_id` every membership read joins on, forced `trip_members_trip_user_unq` to tolerate nulls, and made "is this person a member" a question with three answers. The separate table is what the schema already chose and what decision 7b's `user_id` **xor** `guest_id` link shape is written against.

## 📝 Architecture

**`src/server/repos/trip-guests.ts` — new, and the only module that knows what a guest is.**

```
listTripGuests(scope, tripId)                        read,  membership or org-visible
createTripGuest(scope, { tripId, displayName, colour? })   write, owner
renameTripGuest(scope, guestId, displayName)          write, owner
removeTripGuest(scope, guestId)                       write, owner
mergeTripGuest(scope, tripId, guestId, userId)        write, owner, irreversible
listTripParticipants(scope, tripId)                   read,  moved here from trips.ts
registerGuestRelinker(name, relink): () => void       module-load registration
```

**`listTripParticipants` moves from `trips.ts` into this module.** The frozen plan puts it here; `01-S6a`'s assumption A1 parked it in `trips.ts` because this module did not exist yet and explicitly licensed the move ("`01-S6b` may move it to `trip-guests.ts` when it fills the guest variant; at that point it has exactly one consumer, so the move is cheap"). The move is not cosmetic: keeping it in `trips.ts` would make `trips.ts` import `listTripGuests` while `trip-guests.ts` imports `requireTrip` and `assertTripRole` from `trips.ts` — a runtime import cycle between two repository modules where none exists today. Moving it runs the dependency one way.

The **`TripParticipant` type stays in `trips.ts`**, imported here as a type-only import. It is the contract later pickers depend on, it is already exported through the barrel, and a type import adds no runtime edge. Every consumer imports from `#/server/repos`, so the barrel re-export makes the move invisible: `src/routes/_app/trips/$tripId/-server/people.ts`, `tenant-isolation.test.ts`, `member-isolation.test.ts` and `trip-people.test.ts` all import from `#/server/repos` today and change not one line.

**`src/server/repos/index.ts`** gains one `export * from './trip-guests'` line. Nothing is reordered or removed.

**`src/routes/_app/trips/$tripId/-server/people.ts`** gains four writes and one payload field. It keeps its stated posture: the tenant scope, a Zod boundary, the payload shape — and no authorisation decision of its own.

**`src/routes/_app/trips/$tripId/-ui/people-screen.tsx`** gains a second list beneath the members, and the dialogs the two destructive verbs need.

### The relinker registry

A module-level `Map<string, GuestRelinker>`. Insertion order is registration order, which is the order the plan requires. Registration happens at module load, from the module that owns the `guest_id` column:

```ts
/** What one relinker will move, and the statements that move it. */
export interface GuestRelinkPlan {
  readonly count: number
  readonly statements: ReadonlyArray<BatchStatement>
}

export type GuestRelinker = (
  scope: TenantScope,
  tripId: string,
  guestId: string,
  userId: string,
) => Promise<GuestRelinkPlan>

/** Registers a relinker. Returns the function that unregisters it. */
export function registerGuestRelinker(
  name: string,
  relink: GuestRelinker,
): () => void
```

**Why a relinker returns a plan and not a count.** The frozen plan writes the signature as `(scope, tripId, guestId, userId) => Promise<number>`, and in the same paragraph requires that every relinker run "in registration order inside one `runBatch`" and — FR #119's Definition of Done — that the merge "leaves everything in place when a relinker throws". Those three clauses cannot all hold of a function that performs its own write and resolves to a row count: relinker 1 has already committed by the time relinker 2 throws, and D1 has no interactive transaction to take it back (`src/server/repos/batch.ts`, the module comment). Splitting the relinker into a **plan phase** that reads and builds statements, and one **batch** that runs every statement the plan phase produced, satisfies all three: the order is the order the statements are concatenated in, the batch is one `db.batch()` round trip, and a relinker that throws throws before a single statement has run.

This is the one place this spec departs from the frozen plan's literal text, and it carries a `⚠ NEEDS HUMAN CONFIRMATION` marker below, because it fixes the contract `04-budget-and-currencies.md` and `05-packing-and-todos.md` must both build against.

**The merge, in order:**

1. `requireTrip(scope, tripId)` — a trip the caller may not see is a `NotFoundError` that discloses nothing.
2. `assertTripRole(scope, tripId, ['owner'])`.
3. Resolve the guest through the tenant repository and refuse a guest whose `tripId` is not this trip.
4. Resolve the target: the `userId` must already hold a `trip_members` row **on this trip**. Not a workspace member — a trip member. A merge onto somebody who is not on the trip would hand assignments to a person with no access to them.
5. Run every registered relinker, in registration order, collecting `(name, plan)` pairs. Nothing is written yet.
6. `runBatch(scope, [...every plan's statements in order, the guest delete])`.
7. Return `Record<string, number>` — the per-relinker counts, so the screen can say what moved.

**Removing a guest is not a merge.** `removeTripGuest` deletes the row and runs no relinker. Every `guest_id` column a later plan adds must be declared `references(() => tripGuests.id, { onDelete: 'cascade' })`, so the guest's links go with the guest. That is the seam this spec leaves, stated as a requirement on the plans that fill it, exactly as `01-S6a` left this one.

## 📝 Data Model

No migration. `trip_guests` (`src/server/db/schema.ts:801-818`) is read as it stands:

| Column            | Read as                                                             |
| ----------------- | ------------------------------------------------------------------- |
| `id`              | The guest id every write addresses and every later `guest_id` holds |
| `organization_id` | The tenant filter, through `createTenantRepository`                 |
| `trip_id`         | Scoping and the uniqueness domain                                   |
| `display_name`    | Stored trimmed, case preserved as typed                             |
| `colour`          | Accepted by the repository, exposed by no server function yet       |
| `created_by`      | `scope.ctx.userId` at creation                                      |

`tripGuestsRepository = createTenantRepository(tripGuests, 'trip guest')`, matching `tripsRepository` and `tripMembersRepository` (`src/server/repos/trips.ts:102-110`).

**The duplicate rule is in the repository, and the index is the backstop.** `trip_guests_trip_name_unq` carries SQLite's default `BINARY` collation, so it refuses only a byte-identical name — which the schema's own comment says is deliberate, because `COLLATE NOCASE` would widen a backstop rather than implement the rule. The rule the reader meets is: a name that matches an existing guest on the same trip **after trimming and case folding** is refused inline.

The fold is done in TypeScript, not in SQL, and the fifty-guest bound is what makes that affordable:

```ts
const foldGuestName = (name: string) =>
  name.trim().normalize('NFC').toLowerCase()
```

SQLite's `lower()` folds ASCII only, so a SQL-side comparison would refuse `ANNA` beside `anna` and accept `ÉLODIE` beside `élodie` — a rule that works in English and quietly stops working in nine of the twenty-three languages this product ships in. Reading the trip's guests (at most fifty rows, on an index this table already has) and folding in JavaScript is exact in every locale and costs one query that `createTripGuest` needs anyway for the bound.

**What the index therefore does not backstop, said plainly.** `trip_guests_trip_name_unq` is `BINARY`, so it catches the byte-identical race — two owners adding `Anna` in the same instant — and nothing else. Two owners adding `Anna` and `ANNA` in the same instant both pass the read-then-check and both insert, and the rule the reader meets is broken by a path the index cannot see. Closing it needs a stored folded column with its own unique index, which is a schema change and `docs/SPEC.md` §8 gives the schema module one owner: **this spec files `display_name_folded` — `text not null`, and `trip_guests_trip_folded_unq` on `(trip_id, display_name_folded)` — as a requirement on the next foundations schema stage**, the same way `01-S6` filed `trip_guests` itself. Until it lands, the window is two owner-role writes of variant spellings of one name inside one round trip, the result is two guest rows an owner can see and rename or merge, and it is recorded here rather than papered over. It is not routed around with a retry loop: the plan's own words are that there is no attempt loop.

## 📝 API Contracts

**Repository errors**, both `RepositoryError` subclasses alongside `TripLastOwnerError` (`trips.ts:1544`):

| Class                       | Code                      | Raised by                            |
| --------------------------- | ------------------------- | ------------------------------------ |
| `TripGuestNameTakenError`   | `TRIP_GUEST_NAME_TAKEN`   | `createTripGuest`, `renameTripGuest` |
| `TripGuestLimitError`       | `TRIP_GUEST_LIMIT`        | `createTripGuest`                    |
| `TripGuestMergeTargetError` | `TRIP_GUEST_MERGE_TARGET` | `mergeTripGuest`                     |

`TripGuestLimitError` carries `MAX_TRIP_GUESTS` so the refusal names the bound rather than describing it.

**Server functions** — appended to `src/routes/_app/trips/$tripId/-server/people.ts`:

| Function            | Method | Input                              | Returns                                          |
| ------------------- | ------ | ---------------------------------- | ------------------------------------------------ |
| `addTripGuestFn`    | POST   | `{ tripId, displayName }`          | `{ guestId, displayName }`                       |
| `renameTripGuestFn` | POST   | `{ tripId, guestId, displayName }` | `{ guestId, displayName }`                       |
| `removeTripGuestFn` | POST   | `{ tripId, guestId }`              | `{ removed: true }`                              |
| `mergeTripGuestFn`  | POST   | `{ tripId, guestId, memberId }`    | `{ memberId, relinked: Record<string, number> }` |

Each is wrapped in the module's existing `attempted()` helper, so an expected refusal crosses the wire as a code and never as a server-authored sentence (`docs/SPEC.md` §9). `PeopleRefusal` widens by three members — `'guestNameTaken'`, `'guestLimit'`, `'guestMergeTarget'` — and `refusalOf` maps the three error codes onto them. Everything else (`FORBIDDEN`, `NOT_FOUND`, a validator) propagates untouched, because the screen offers no control for those states.

**The merge takes a `memberId` on the wire and a `userId` in the repository.** The screen's combobox is over the trip's members, and a membership row is what it has; the repository's relinkers rewrite `guest_id` to `user_id`, and a user id is what they need. `mergeTripGuestFn` resolves the one into the other through the membership row it must read anyway to prove the target is on the trip.

**`loadTripPeople`'s payload gains `guests: ReadonlyArray<TripGuest>`.** Additive to an existing server-function output (`BACKWARD_COMPATIBILITY.md` §2): no field is removed, no field changes type.

**Zod v4**, matching the module: `z.strictObject()` with the `error` parameter, `displayName` trimmed and bounded by the shared `shortTextSchema`, ids as plain strings. No `z.string().email()` — a guest has no address.

## 📝 UI/UX

Two dependency-free static reproductions sit beside this spec, and they are what the implementation is measured against: [`assets/a-guest-on-a-trip/mockup-01-guests-list.html`](../assets/a-guest-on-a-trip/mockup-01-guests-list.html) — the loaded list, the inline duplicate refusal, and the empty state in dark — and [`assets/a-guest-on-a-trip/mockup-02-merge-dialog.html`](../assets/a-guest-on-a-trip/mockup-02-merge-dialog.html) — the merge dialog with its combobox open, and what it reports when no relinker is registered.

**The guest list**, beneath the members list in the left column of `/trips/$tripId/people`. Each row: the name, a guest `Badge`, and — for the `owner` only — rename, merge and remove controls. Every component is already in `src/components/ui`: `Card`, `SectionLabel`, `Badge`, `Button`, `IconButton`, `Combobox`, `Input`, `Field`, `Dialog`, `EmptyState`. No new primitive is proposed.

**The empty state is designed, not tolerated.** A trip with no guests is the common first state, so the list shows an `EmptyState` explaining what a guest is — somebody travelling with you who does not need an account — with the add control as its action, rather than an empty box.

**Add.** An `Input` and a button. A duplicate name comes back as `people.error.guestNameTaken` rendered **inline on the field**, with the typed name in it, and the field keeps its value so the reader adds the distinguishing word rather than retyping. The fifty-guest refusal renders the same way and names the bound and its reason.

**Rename** is the same field in a `Dialog`, under the same rule.

**Remove** is a `Dialog` that states what goes with the guest. Today that is nothing beyond the guest itself — no table references `guest_id` yet — and the copy says exactly that rather than warning about a cascade that does not exist. The plan that adds the first `guest_id` column owns widening this sentence; the copy key is written so that widening it is a copy change and not a structural one.

**Merge** is the irreversible one. The control reads "This is now…", opens a `Dialog` holding a `Combobox` over the trip's **members**, and the dialog says the merge cannot be undone and names the member who will inherit. On success the screen reports what moved, from the per-relinker counts. With no relinkers registered the counts are empty and the screen says the guest became that member and nothing else moved — honest, and the state the product is actually in until `04-*` lands.

**Accessibility.** The rename, remove and merge controls are icon buttons, so each carries the guest's name in its accessible label — a list of identical "Remove" labels is a list a screen reader cannot tell apart, which is why `people.remove.action` already interpolates `{name}` for members. The inline refusal is wired to the field through `aria-describedby` and announced. Both dialogs use the shipped `Dialog` with a `loading` confirm button, never a browser `confirm`.

**Motion and tokens.** The list inherits the member list's row enter and leave (opacity and a 4px lift over 220 ms on `--ease-out-quint`, staggered 24 ms, capped at eight; 150 ms leave; reduced motion collapses to opacity). No token is missing and none is filed.

## 📝 Edge Cases & Failure Scenarios

| Case                                                                      | Behaviour                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `  anna  ` added while `Anna` is on the trip                              | Refused inline with `people.error.guestNameTaken`; the unique index is never reached                                                                                                                                                                                                                                       |
| `ÉLODIE` added while `élodie` is on the trip                              | Refused; the fold is `NFC` + `toLowerCase()` in TypeScript, not SQLite's ASCII-only `lower()`                                                                                                                                                                                                                              |
| Renaming a guest to its own name in another case                          | Allowed — the guest's own row is excluded from the comparison                                                                                                                                                                                                                                                              |
| The 51st guest                                                            | Refused with `TripGuestLimitError`, naming `MAX_TRIP_GUESTS`                                                                                                                                                                                                                                                               |
| Two owners adding the 50th guest at the same instant                      | The bound is read-then-write and can be exceeded by one under a true race. Accepted: a trip with 51 guests is benign and an owner can remove one, unlike the unownable trip the last-owner guard defends against with an in-statement predicate. Documented in the module, not defended with machinery it does not need    |
| Two owners adding the byte-identical name at the same instant             | The index refuses the second with a constraint error, surfaced as the module's generic write failure. The rule is the repository check; the index is the backstop, as the schema comment says                                                                                                                              |
| Two owners adding `Anna` and `ANNA` at the same instant                   | **Both succeed.** The `BINARY` index cannot see a folded collision, so the read-then-check has no backstop on this path. Accepted and filed: the folded column and its unique index are this spec's requirement on the next schema stage (Data Model). The result is visible to the owner and fixable with rename or merge |
| Two owners merging the same guest at the same instant                     | The second merge's `requireById` finds no guest — the first batch deleted the row — and answers `NotFoundError`. A merge racing a remove resolves the same way. The relinkers of the losing merge never run, because the guest is resolved before any of them is called                                                    |
| A relinker throws                                                         | Nothing has been written — the throw happens in the plan phase, before `runBatch` — so the guest stays and no row moves. The error propagates                                                                                                                                                                              |
| `runBatch` on a driver without `batch()`                                  | Falls back to sequential execution and is **not** atomic. D1 and the test proxy driver both support `batch()`; the fallback exists for drivers this product does not deploy on, and the merge inherits the repository-wide compromise rather than inventing a second one                                                   |
| A relinker counts rows, then a concurrent write adds one before the batch | The reported count is one low; the `UPDATE`'s own `WHERE guest_id = ?` still moves the new row. The number shown is a report, not a guarantee, and the data is right either way                                                                                                                                            |
| Merge target is not on the trip                                           | `TripGuestMergeTargetError`; nothing runs                                                                                                                                                                                                                                                                                  |
| Merge target is on **another** trip in the same workspace                 | Same refusal — the membership lookup is scoped to `tripId`                                                                                                                                                                                                                                                                 |
| Guest id from another tenant                                              | `NotFoundError` from the tenant repository, before any role assert can leak the trip's existence                                                                                                                                                                                                                           |
| `listTripParticipants` on a foreign trip id                               | `NotFoundError`. `requireTrip` runs **first**, which is `01-S6a`'s trap: `listTripMembers` answers a foreign trip with `[]` rather than raising, so a reader that skipped the guard would report "a trip with nobody on it" instead of refusing. Filling the guest branch must not reorder that                            |
| A member with no workspace profile                                        | Unchanged from `01-S6a`: dropped rather than rendered nameless. Guests have no profile and are never dropped                                                                                                                                                                                                               |

## 📝 Risks & Impact Review

**Blast radius.** `TripParticipant` is read by `01-S8`'s picker and the expense-split rows in `04-*`. Its shape does not change — the `guest` branch was declared by `01-S6a` precisely so that filling it is a data change and not a shape change. What does change is that the branch now occurs, so any `kind` switch that was exhaustive-in-theory becomes exercised in practice. That is the designed outcome, and `trip-people.test.ts` running unchanged and green is what proves the member half was not disturbed.

**Compatibility.** `BACKWARD_COMPATIBILITY.md` §1 (schema) — untouched, no migration. §2 (server-function outputs) — `loadTripPeople` gains a field, additive; four new functions, additive. §4 (route paths) — no route added; `/trips/$tripId/people` already exists. §5 (locale catalogue) — new keys land in all 23 locales in this change, which the parity test enforces. Nothing is removed or renamed.

**The move of `listTripParticipants`** is the one change that touches shipped, working code. It is a file move of one function behind an unchanged barrel export, with an unchanged signature and an unchanged return type, and `trip-people.test.ts`, `tenant-isolation.test.ts` and `member-isolation.test.ts` all exercise it through `#/server/repos`. If it goes wrong, `pnpm typecheck` says so before anything runs.

**Rollback.** Phase 1 is additive and reverts cleanly. Phase 2 is additive and reverts cleanly. A merge already performed is **not** reversible — that is decision 7b and the dialog says so. With no relinkers registered, a merge today moves nothing and deletes one guest row, so the practical exposure until `04-*` lands is one deleted name.

**Risk label.** `risk-high` is right: an irreversible multi-table operation and a cross-cutting extension point two other plans will build against.

## 📋 Resolved assumptions (autonomous defaults)

Written by `om-auto-write-spec` without a human in the loop. Each is the most reversible answer to a question the ticket left open; override any of them on this PR before it merges.

| #      | Question                                                                                                                                                          | Resolution                                                                                                                                                                                                                                                                               | Rationale                                                                                                                                                                                                                                                         |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Q1** | A relinker cannot both perform its own write and resolve to a count **and** leave nothing behind when a later one throws. Which clause of the frozen plan yields? | A relinker returns `GuestRelinkPlan` = `{ count, statements }`; the merge concatenates the statements in registration order and runs one `runBatch`. **⚠ NEEDS HUMAN CONFIRMATION** — this fixes the contract `04-budget-and-currencies.md` and `05-packing-and-todos.md` build against. | The plan's prose ("in one batch", "in registration order") and FR #119's Definition of Done ("leaves everything in place when a relinker throws") are the binding requirements; the literal `Promise<number>` signature is the clause that cannot hold with them. |
| **Q2** | Does `listTripParticipants` stay in `trips.ts` or move to `trip-guests.ts`?                                                                                       | Move; the `TripParticipant` type stays in `trips.ts` and is imported type-only.                                                                                                                                                                                                          | The frozen plan's placement, licensed by `01-S6a`'s assumption A1, and the only arrangement without a runtime import cycle. Invisible to every consumer — all import from the barrel.                                                                             |
| **Q3** | Is the guest capability one spec or two? The record ships without the merge; the merge does not ship without the record.                                          | One spec, two phases. Phase 1 is the record, Phase 2 the merge; each leaves the app working.                                                                                                                                                                                             | Not an independent bundle but a dependency chain, so splitting buys two tickets and a shared type; phasing buys the same shippability for free.                                                                                                                   |
| **Q4** | Does a guest get a colour on creation?                                                                                                                            | The repository accepts `colour`; no server function exposes it.                                                                                                                                                                                                                          | Least new surface. `trip_guests.colour` exists and `TripParticipant` already carries it; a picker is a UI feature nobody asked for.                                                                                                                               |
| **Q5** | E2E against `e2e/trips-core.spec.ts` (the ticket) or `e2e/trips-core.visual.spec.ts` (the frozen plan)?                                                           | `e2e/trips-core.spec.ts`, behaviour asserted, console silent.                                                                                                                                                                                                                            | ADR 0016 retired the visual gate after the plan was frozen; the ticket reflects the current repository and the plan does not.                                                                                                                                     |
| **Q6** | What does the remove dialog say it cascades, when nothing references a guest yet?                                                                                 | That the guest goes and nothing else does.                                                                                                                                                                                                                                               | The honest sentence today. The plan that adds the first `guest_id` column widens the copy key, which is a copy change and not a structural one.                                                                                                                   |
| **Q7** | Does a duplicate registration name replace, throw, or append?                                                                                                     | `registerGuestRelinker` returns its own unregister function; a duplicate name throws.                                                                                                                                                                                                    | Two plans registering under one name is a bug that should be loud. Returning the unregister function is what lets the tests register fakes without a test-only reset export.                                                                                      |

## 📋 Visual change expected

| Route                   | State                                                     | Themes      | Viewports       |
| ----------------------- | --------------------------------------------------------- | ----------- | --------------- |
| `/trips/$tripId/people` | Guests list with rows (name, guest badge, three controls) | light, dark | 360, 1280, 2560 |
| `/trips/$tripId/people` | Guests list empty state with its add action               | light, dark | 360, 1280, 2560 |
| `/trips/$tripId/people` | Add-guest field showing the inline duplicate refusal      | light, dark | 360, 1280       |
| `/trips/$tripId/people` | Remove-guest dialog                                       | light, dark | 360, 1280       |
| `/trips/$tripId/people` | Merge dialog with the member combobox open                | light, dark | 360, 1280       |

The members list, the invite control and the visibility card are unchanged; the left column grows a second section beneath the members.

## 📋 Copy

Every key lands in all 23 locales in the same change (`docs/SPEC.md` §9, the `i18n-messages` skill). Namespace `trips`, beside the existing `people.*` keys in `src/lib/i18n/messages/<locale>/trips.ts`.

| Key                               | `en`                                                                                                                           |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| `people.guests.title`             | Travelling with you                                                                                                            |
| `people.guests.description`       | People on this trip who do not have an account                                                                                 |
| `people.guests.empty`             | Nobody yet                                                                                                                     |
| `people.guests.emptyHint`         | A guest is somebody travelling with you who does not need an account. Add them by name.                                        |
| `people.guest.badge`              | Guest                                                                                                                          |
| `people.guest.add.label`          | Their name                                                                                                                     |
| `people.guest.add.placeholder`    | Anna                                                                                                                           |
| `people.guest.add.action`         | Add a guest                                                                                                                    |
| `people.guest.rename.action`      | Rename {name}                                                                                                                  |
| `people.guest.rename.title`       | Rename {name}                                                                                                                  |
| `people.guest.rename.confirm`     | Rename                                                                                                                         |
| `people.guest.remove.action`      | Remove {name} from this trip                                                                                                   |
| `people.guest.remove.title`       | Remove {name} from this trip?                                                                                                  |
| `people.guest.remove.body`        | The guest goes. Nothing else on the trip changes.                                                                              |
| `people.guest.remove.confirm`     | Remove                                                                                                                         |
| `people.guest.merge.action`       | {name} is now…                                                                                                                 |
| `people.guest.merge.title`        | {name} is now one of the people on this trip                                                                                   |
| `people.guest.merge.body`         | Everything assigned to {name} moves to the person you choose, and the guest goes. This cannot be undone.                       |
| `people.guest.merge.placeholder`  | Choose somebody on this trip                                                                                                   |
| `people.guest.merge.confirm`      | Merge                                                                                                                          |
| `people.guest.merge.done`         | {name} is now {member}                                                                                                         |
| `people.guest.merge.nothingMoved` | Nothing was assigned to them yet                                                                                               |
| `people.error.guestNameTaken`     | A guest named {name} is already on this trip                                                                                   |
| `people.error.guestLimit`         | A trip holds at most {limit} guests, because a longer list makes the participant pickers and the split arithmetic hard to read |
| `people.error.guestMergeTarget`   | Choose somebody who is already on this trip                                                                                    |

## 📋 Phasing

**Phase 1 — the guest record.** The module, the four reads and writes without the merge, the two rules, the filled participant branch, the server functions, the list and its three controls, the copy, the isolation cases. Ships on its own: a trip can hold guests and they appear in every participant surface.

**Phase 2 — the merge.** The relinker registry, `mergeTripGuest`, `mergeTripGuestFn`, the combobox dialog and the report of what moved. Ships on top of Phase 1 and is a no-op for anybody who never uses it.

## 📋 Implementation Plan

### Phase 1 — the guest record

**Step 1 — the module and its reads.** `src/server/repos/trip-guests.ts`: `tripGuestsRepository`, `MAX_TRIP_GUESTS = 50` with the reason beside it, `foldGuestName`, the three `RepositoryError` subclasses, and `listTripGuests` ordered by `display_name`. One `export * from './trip-guests'` line in `src/server/repos/index.ts`. _Verified by:_ `src/server/repos/__tests__/trip-guests.test.ts` — guests come back in name order; a foreign trip id answers `[]`.

**Step 2 — `createTripGuest`.** `requireTrip`, `assertTripRole(['owner'])`, one read of the trip's guests serving both rules, then the insert. _Verified by:_ `trip-guests.test.ts` — `Anna` then `  anna  ` is `TripGuestNameTakenError`; `ÉLODIE` then `élodie` is the same; the 50th succeeds and the 51st is `TripGuestLimitError` naming the bound; a spy on the table access proves the insert is never attempted for a duplicate, which is what "the index is never reached" means.

**Step 3 — `renameTripGuest` and `removeTripGuest`.** `requireById` first so the trip comes from the row, then the guards. Rename excludes the guest's own row from the comparison. _Verified by:_ `trip-guests.test.ts` — renaming onto an existing name is refused; renaming `Anna` to `ANNA` succeeds; removing leaves the other guests untouched.

**Step 4 — `listTripParticipants` moves and fills.** Move the function into `trip-guests.ts`, keep `TripParticipant` in `trips.ts` and import it type-only, append the guest rows after the members in name order. _Verified by:_ `trip-people.test.ts` unchanged and green — owner still first, no `email` on any element, a member with no profile still dropped — plus one new case asserting guests arrive with `kind: 'guest'` and the discriminant intact.

**Step 5 — the isolation cases.** Seed one guest per tenant in `seedWorld` so the generic tenant cases cover `tripGuestsRepository` without a special case; append `describe('trip guests')` to `tenant-isolation.test.ts` and the editor block to `member-isolation.test.ts`. _Verified by:_ `createTripGuest` onto B's trip, and `renameTripGuest` / `removeTripGuest` against B's guest id, all raise `NotFoundError` and leave B byte-identical; `listTripGuests` on B's trip is `[]`; `listTripParticipants` on B's trip raises rather than answering an empty set; an editor gets `FORBIDDEN` from every guest write.

**Step 6 — the server functions.** `addTripGuestFn`, `renameTripGuestFn`, `removeTripGuestFn` through `attempted()`; `PeopleRefusal` gains `'guestNameTaken'` and `'guestLimit'`; `refusalOf` maps the two codes; `loadTripPeople` gains `guests`. _Verified by:_ the module's existing `-server/__tests__` suite — a duplicate answers `{ ok: false, reason: 'guestNameTaken' }`, a `FORBIDDEN` still propagates untouched, and the payload carries the guests.

**Step 7 — the copy.** The `people.guest*` and `people.error.guest*` keys in `en`, then all 23 locales per the `i18n-messages` skill. _Verified by:_ the i18n parity test — no missing key, no orphan key.

**Step 8 — the guests list.** The second section in `people-screen.tsx`: rows with the badge, the add field with its inline refusal, the rename and remove dialogs, the empty state. _Verified by:_ the screen's own test — the list renders, the refusal is wired to the field, the dialogs are owner-only — and one appended block in `e2e/trips-core.spec.ts` adding and removing a guest with a silent console.

### Phase 2 — the merge

**Step 9 — the registry and `mergeTripGuest`.** `GuestRelinkPlan`, `GuestRelinker`, `registerGuestRelinker` returning its unregister function, and the seven-step merge. _Verified by:_ `trip-guests.test.ts` — two fake relinkers run in registration order, their statements reach one `runBatch` call, the guest row is gone, both counts come back; a target who is not on the trip is `TripGuestMergeTargetError` and nothing runs; a relinker that throws leaves the guest and every row in place; a duplicate registration name throws.

**Step 10 — `mergeTripGuestFn`.** Resolves `memberId` to `userId` through the membership row it reads to prove the target is on the trip; `PeopleRefusal` gains `'guestMergeTarget'`. _Verified by:_ the `-server/__tests__` suite — the relinked counts reach the payload, a target off the trip answers the refusal code.

**Step 11 — the merge dialog.** The "is now…" control, the `Combobox` over the trip's members, the irreversible warning naming the inheriting member, and the report of what moved (or that nothing did). The copy keys land with it. _Verified by:_ the screen's test and one appended block in `e2e/trips-core.spec.ts` opening the merge dialog, with a silent console.

**Step 12 — the gate.** `node .ai/scripts/agent-kit-check.mjs`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, `bash .ai/scripts/check-generated.sh`, `pnpm build`, then `pnpm e2e`. _Verified by:_ all green, and no file outside FR #119's Owned paths touched, with `src/server/repos/trips.ts` changed only by the removal of `listTripParticipants` and the export of its type.

## Amendment

What shipped in #574 differs from the design above in these places. Both phases shipped on that one pull request.

1. **The payload carries no separate `guests` field.** `loadTripPeople` already answers `participants`, and the guest rows are its `guest` branch. A second list would carry the same rows twice. The screen filters `participants` by `kind`. The payload gains `guestLimit` instead, so that the client can name the bound in the refusal copy without importing a server constant.
2. **The refusal reasons are kebab-case**: `guest-name-taken`, `guest-limit` and `guest-merge-target`. They are not `guestNameTaken`, `guestLimit` and `guestMergeTarget`, because they match the reasons `PeopleRefusal` already carried (`last-owner`, `not-in-workspace`).
3. **A merge into a member of another organization is `TripGuestMergeTargetError`, not `NotFoundError`.** The target is looked up among the trip's own memberships, which are tenant-scoped. A foreign user therefore gives the same answer as any user who is not on the trip, and that answer says nothing about the other organization. The guest and the trip keep the `NotFoundError` the design names. `mergeTripGuestFn` treats a `memberId` it cannot find on the trip the same way.
4. **The merge report shows the total and no per-relinker lines.** It reads "{name} is now {member}", and adds "Nothing was assigned to them yet" when every count is zero. No relinker is registered yet. Per-relinker copy belongs to the plans that register the first real relinkers.
5. **The screen's test covers the guest row and the two guest dialogs in isolation**, following `note-dialog.test.tsx`: owner-only controls, the refusal on the field, the confirm disarmed until somebody is chosen. It does not mount the whole route. Nothing covered the whole route before this change either.
