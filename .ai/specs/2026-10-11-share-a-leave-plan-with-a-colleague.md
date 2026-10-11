# Leave planner: share a plan with a colleague, log for each other, and step out without losing a day

| Field              | Value                                    |
| ------------------ | ---------------------------------------- |
| **Status**         | ready                                    |
| **Issue**          | none                                     |
| **Spec PR**        | none                                     |
| **Implementation** | none                                     |
| **Plan**           | 08-S8 (docs/plans/08-product-modules.md) |

## 📝 TLDR

Plan stage `08-S8` is the shared half of the leave planner (reference row `ADD-04`). Today `/vacay` is one person's diary: the
four repository writers that would put a second person on a plan (`invitePlanMember`, `setPlanMemberStatus`, `removePlanMember`,
`setUserColour`) have no production caller except the dev seeder, check only that the plan is in the workspace, and nothing
decides which plan an accepted colleague should see. This stage lets a colleague be invited, accept, appear in the same year with
their own colour, have days logged for them by the other person, and step out again taking every day with them. It ships as
**four tickets that are each a full path from repository to screen**:

1. **08-S8a - join and leave a shared plan.** The plan's owner invites a current workspace member; the invitee is told in the
   inbox and accepts or declines on `/vacay`; accepting **moves the invitee's days and allowance rows onto the shared plan** and
   gives them an unused colour; `/vacay` shows the plan the viewer is on; "Go back to my own plan" moves everything home. The
   payload a second person can see is narrowed before anyone can see it. Risk-high.
2. **08-S8b - log and clear a day for a colleague.** A subject selector in the grid header; the owner or any accepted member may
   write and clear days for any accepted member, and the person concerned is told once per action. Risk-high.
3. **08-S8c - the owner manages the plan's people.** Remove an accepted member (the same lossless move), cancel a pending invitation,
   clear a declined one; a member reads the plan settings read-only; a plan whose owner left the workspace stays usable. Risk-high.
4. **08-S8d - pick your own colour.** A picker of measured swatches, your own colour only. Risk-medium.

No schema change, no migration, no route added, no package added, no queue message, no Durable Object.

**What is deliberately not here.** Live sync (the only realtime primitive is the per-trip `TripRoom`; the grid re-reads on
invalidation, Resolved assumption 1), email for an invitation (an in-app row only, Resolved assumption 9), telling the inviter
that the answer came in, reassigning a plan whose owner left, inviting a person who is not yet in the workspace, and letting a
colleague see another person's sick days (a legal question about health data that is not this spec's to widen).

This spec describes the work that is **left** at HEAD (`ec5182b2`). It departs from the plan's stage block wherever the code the plan
cites has changed or a specialist found the plan incomplete; every departure is a row of the Resolved assumptions table. It builds on
two merged specs that are **not implemented at HEAD**: the allowance spec (`.ai/specs/2026-10-08-leave-planner-allowances-and-carry-over.md`,
tickets 08-S1a to 08-S1c: `requirePlanActor`, `requirePlanOwner`, `recomputeCarryOver`, `src/routes/_app/-server/vacay.ts`,
`src/components/vacay/`) and the year-grid spec (`.ai/specs/2026-10-10-log-your-leave-days-on-the-year-grid.md`, tickets 08-S5a to
08-S5f: the grid, `loadVacayGridFn`, `setVacayEntryFn`, `clearVacayEntriesFn`, `day-rules.ts`). Each ticket here is therefore blocked by
the tickets it edits (Phasing). Later stages of the plan are named by what they ship, never by id: the backlog reads any stage id in a
spec as that stage being specified already.

## 📝 Problem Statement

Verified against the repository at HEAD:

- **Nothing puts a second person on a plan.** `invitePlanMember`, `setPlanMemberStatus(memberId, anyStatus)`, `removePlanMember(memberId)`
  and `setUserColour` (`src/server/repos/vacay.ts:207-265`) are called only by the dev seeder (`src/routes/api/dev/-seed/apply.ts:658-670`;
  `removePlanMember` by nobody) and the repository suites. They check `requireById` / `requireRemove` (the workspace) and nothing else:
  any workspace member could mark any invitation accepted.
- **`invitePlanMember` swallows a re-invite.** It returns an existing row unchanged, so a person who declined can never be asked again.
  `vacay_plan_members.user_id` is a `userRef` with no foreign key, so a user id from another workspace would be stored.
- **There is no "which plan do I see".** `loadVacay` (`src/routes/_app/-server/library.ts:114`) calls `ensurePlan(scope)`: always the viewer's
  **own** plan. An accepted member would see their own empty plan, and the owner's grid would never include them. Every read and every
  allowance is keyed by `plan_id`, so a member's days must live on **one** plan to appear on the shared grid.
- **A second person's data is sent unnarrowed.** `getPlanOverview` (`vacay.ts:572`) returns every member's entries with `kind` and
  free-text `note` (the screen prints the kind and counts it in its legend), and a balance row for every member row **whatever its
  status**: a pending or declined invitee shows a made-up allowance. `sick` costs nothing, so used days do not reveal it, but the kind
  does. Both merged specs hand the narrowing to this stage ("those rows hold colleagues' sick days").
- **Every owner already has two roles on their own plan.** `ensurePlan` writes an `accepted` membership row for the owner
  (`vacay.ts:152-156`), so "a traveller's accepted rows" cannot be a plain count, and the owner's row is "the viewer's own row" on
  their plan.
- **Leaving a workspace takes only the membership.** People leave through Better Auth's endpoints (`src/server/auth/index.ts`), not
  through `removeMember` in `members.ts` (which only tests call): every `vacay_*` row stays behind. The precedent for such rows
  (an orphaned journey, a stranded trip) is "kept, resolved at read time, comes back if the person returns".
- **`notify()` writes one in-app row and consults nothing.** `src/server/repos/notifications.ts:129` stamps `senderUserId` and inserts;
  it never reads the preference matrix and queues no email. The composition layer `src/server/notifications/dispatch.ts` resolves its
  recipients from a trip (or a workspace's administrators), so it cannot address one colleague. An `action`-type notification would
  get inline Accept/Decline buttons from the notification-matrix stage that only **record** an answer, which would make them lie.
- **The plan's realtime row is not buildable here.** `TripRoom` is one Durable Object per trip, bound in `wrangler.jsonc` and exported from
  `src/server/worker.ts`, two of the six shared paths no feature stage may claim.

The reader this serves: two colleagues who plan leave around the same project and want to see who is away when, to put a day in for
the one who forgot, and to stop sharing without anyone's year disappearing. The reference behaviour (an invitation a colleague
accepts or declines, a merged year in which several people's absences sit side by side, days logged on somebody's behalf, a
separation that leaves both histories intact - `wiki: Vacay-Sharing`) is delivered in planned.travel's vocabulary.

## 📝 Proposed Solution

### What the stage owns and what it does not

| Owned (this stage writes it)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Not owned (read only, or left alone)                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/repos/vacay.ts` - edit: `resolveActivePlan`, `activePlanIdOf` (private), `invitePlanMember` (guarded, re-invite), `respondToPlanInvite` (replaces the exported `setPlanMemberStatus`), `leavePlan`, `removePlanMember` (guarded), `cancelPlanInvite`, `setUserColour` (guarded), the private `movePersonalData` both directions call, `getPlanOverview` (narrowing), the "for another person" rule of `setEntry` / `setEntryRange` / `clearEntries` (the year-grid spec's owner-only rule is replaced), `countEntriesByKind` (masks) | `src/server/db/schema.ts`, `drizzle/` - **no schema change, no migration**                                                                                              |
| `src/lib/vacay/swatches.ts` - new, pure: the palette, `firstUnusedSwatch`, `isSelectableSwatch`; `src/lib/vacay/__tests__/swatches.test.ts`                                                                                                                                                                                                                                                                                                                                                                                                      | `src/routes/_app/-server/library.ts` - held by the library stage this wave; `loadVacay` is **not edited** (Resolved assumption 2)                                       |
| `src/routes/_app/-server/vacay.ts` - edit: `loadVacayPlanFn` (new), `invitePlanMemberFn`, `respondToPlanInviteFn`, `leavePlanFn`, `removePlanMemberFn`, `cancelPlanInviteFn`, `setPlanColourFn`; `loadVacayGridFn` gains the active plan's id; the `for` key on the three entry functions; `__tests__/vacay.test.ts`                                                                                                                                                                                                                             | `src/server/repos/members.ts`, `src/server/auth/**` - **no edit** (a departure is resolved at read time; `src/server/auth` would make a ticket risk-high on path alone) |
| `src/routes/_app/vacay.tsx` - edit: loader order, `PlanMembers` replaces the "Travellers" panel, the invitation `Alert`, the subject selector                                                                                                                                                                                                                                                                                                                                                                                                    | `src/server/notifications/dispatch.ts`, `src/server/repos/notifications.ts` - imported, not edited                                                                      |
| `src/components/vacay/` - `plan-members.tsx`, `invite-dialog.tsx`, `invitation-alert.tsx`, `subject-selector.tsx`, `colour-picker.tsx`, `index.ts`, `__tests__/` for each; `plan-settings-dialog.tsx` edit in 08-S8c (read-only view); `day-cell.tsx` / `day-picker.tsx` edit in 08-S8b (a subject)                                                                                                                                                                                                                                              | `src/components/ui/**`, `src/styles/tokens.css` - no primitive and no token is missing                                                                                  |
| `src/lib/i18n/messages/<locale>/modules.ts` and `shell.ts` (the stored `notification.vacay.*` templates) - edit, **all 23 locales**                                                                                                                                                                                                                                                                                                                                                                                                              | `src/server/billing/**`, `src/lib/plans.ts` - no quota, no `MODULE_KEYS` entry                                                                                          |
| `src/routes/api/dev/-seed/apply.ts` - edit (08-S8a): it uses `setPlanMemberStatus` and an owner-written accept; it inserts the demo members as `accepted` rows directly                                                                                                                                                                                                                                                                                                                                                                          | `e2e/helpers/**` - reused, not edited                                                                                                                                   |
| `src/server/repos/__tests__/tenant-isolation.test.ts`, `repositories.test.ts` - append; the allowance spec's structural allowlist test - edit per ticket                                                                                                                                                                                                                                                                                                                                                                                         |                                                                                                                                                                         |
| `e2e/product-modules.spec.ts` - append (no baselines, ADR 0016)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |                                                                                                                                                                         |
| `CONTEXT.md` - glossary: **Shared leave plan** and **Plan member** (08-S8a)                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |                                                                                                                                                                         |

Departures from the plan's owned paths (Resolved assumptions 2, 12, 13): no `e2e/product-modules.visual.spec.ts` and no re-recorded
`vacay-*` PNGs because ADR 0016 removed the baselines (`e2e/product-modules.spec.ts` replaces them, as in the earlier specs of this plan);
`modules.ts` and `shell.ts` in all 23 locales, `CONTEXT.md`, the seeder and `src/lib/vacay/swatches.ts` join the list; the plan's
`invite-dialog.tsx` / `plan-members.tsx` / `colour-picker.tsx` stay, with `invitation-alert.tsx` and `subject-selector.tsx` beside them.

### The model, in the traveller's terms

- A traveller is on **exactly one plan at a time**: the **active plan**. It is the plan they accepted a place on, otherwise their own.
  Their days and their allowance rows live on the active plan, and the screen shows only that plan. The word on screen is "plan"; the
  copy never says "fuse", "merge" or "dissolve", and never a bare "leave" for the exit (it collides with leave as time off): the exit is
  **Go back to my own plan**.
- **Joining moves your days in; going back moves them home.** Accepting moves the invitee's entries and allowance rows from their own
  plan onto the shared plan; going back (or being removed) moves them to the person's own plan. One private function,
  `movePersonalData(scope, fromPlanId, toPlanId, userId)`, is both directions, so they cannot diverge. Their own plan stays as a
  dormant plan (its settings and company holidays are untouched) and takes no writes while they are away from it.
- **A colleague sees dates, not reasons.** Another person's `sick` and `other` days reach the viewer as the neutral `other` ("Away");
  their `note` is never sent; their allowance, carried-over and remaining figures are not sent to anyone but themselves. Used days are
  shown (a sick day costs nothing, so they reveal nothing). No role overrides this, the plan's owner included.
- **Pending and declined grant nothing.** A pending or declined invitee sees only the inviter's name and the plan's name; they get no
  entries, no balances, no people. Only the owner sees pending and declined rows.
- **A person who left the workspace disappears from every read** (grid, list, balances, subject selector) but their rows stay and come back
  if they return. Nothing is deleted, moved or reassigned by the workspace departure.

### Who may do what

All in the repository; the handlers call it and own no rule. `requirePlanActor` and `requirePlanOwner` are the allowance spec's
prerequisites, not rewritten here. A structural test (the allowance spec's criterion 5) lists the functions with a production caller; each
ticket edits it for the functions it reaches.

| Action                                                       | Who                                                                                                                                                             | Refusal                                                                                                |
| ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Invite                                                       | The plan's owner (`requirePlanOwner`); the target is a **current workspace member** (`getMembership`), not the owner, not already accepted                      | `NotFoundError` for a target outside the workspace; `PlanOwnerOnlyError`; `AlreadyOnPlanError`         |
| Re-invite                                                    | Same. A `declined` row returns to `pending` and one notification is written; a `pending` row changes nothing and writes nothing                                 | -                                                                                                      |
| Accept or decline                                            | Only the invitee: the row's `user_id` equals `scope.ctx.userId` and its status is `pending`; the handler takes the membership id and nothing else               | `NotFoundError` (a forged id, another workspace's id, someone else's row, an answered row)             |
| Accept, extra guards                                         | The caller holds no `accepted` row on a plan they do not own, and their own plan has no other accepted member who is still in the workspace                     | `PlanBusyError` with `reason: 'on-another-plan' \| 'owns-shared-plan'`                                 |
| Go back to my own plan                                       | The caller, from an accepted non-owner membership                                                                                                               | `NotFoundError`; the owner of a plan **cannot** leave it (the owner empties it by removing people)     |
| Remove, cancel an invitation                                 | The plan's owner, on a row of that plan that is not their own                                                                                                   | `PlanOwnerOnlyError`; `NotFoundError`                                                                  |
| Log or clear a day for **another** person                    | `requirePlanActor` (owner or accepted member), and the person is an accepted member of that plan, still in the workspace, **and the plan is their active plan** | `NotFoundError`; a `sick` / `other` day of theirs is skipped and counted, never overwritten or cleared |
| Log or clear your own day                                    | As the year-grid spec, plus the plan must be your active plan                                                                                                   | `NotFoundError`                                                                                        |
| Allowance of another person, company holidays, plan settings | **Owner only**, unchanged (a member reads the settings read-only)                                                                                               | `PlanOwnerOnlyError`                                                                                   |
| Colour                                                       | Your own, on your active plan, from the palette, not used by another accepted member                                                                            | `NotFoundError`; a refused colour                                                                      |

- **Hiding a control is not the guard.** Every handler starts with `appScope()`, forwards no client-supplied acting user, and resolves
  the plan inside the workspace before anything else.
- **"The plan is their active plan" is the rule that makes a same-date collision unreachable.** Without it, the owner of a dormant plan
  could still write to it through a forged `planId`, and a later move would meet a duplicate (Resolved assumption 4).
- **No row-id path to someone else's day.** Clearing is by plan, person and date range, as before; `removeEntry` stays unreachable and off
  the allowlist, as do `addHolidayCalendar`, `removeHolidayCalendar`, `listPlansForUser`, `deletePlan` and `countUsedDays`. `deletePlan`
  has no access check and the foreign keys cascade, so a caller added later must put `requirePlanOwner` in front of it first.
- **Tenancy.** Every statement is `tenantFilter()`-bound or stamps `organization_id` from the scope, **including each sub-select** of
  the move; both plan ids are resolved with `requireById` in the same scope before any statement is built, so rows cannot land in a plan
  of another workspace even when both ids come from the client.

### Phase 1 (08-S8a) - join and leave a shared plan

**Repository (`src/server/repos/vacay.ts`).**

- `resolveActivePlan(scope)`: an `accepted` membership of `scope.ctx.userId` on a plan whose owner is someone else, and the plan is
  returned without creating anything; otherwise `ensurePlan(scope)`. The private `activePlanIdOf(scope, userId)` is the same lookup for
  another person and **never creates a plan** (an own plan only if it exists). `loadVacayPlanFn` is the only caller that may create a
  plan on a read, which keeps the "no concurrent `ensurePlan`" order of the earlier specs.
- `invitePlanMember(scope, planId, userId)` returns `{ member, changed }`: the guards of the table above; `changed` is true for a new
  row or a `declined` row put back to `pending`, and only then does the handler write the notification.
- `respondToPlanInvite(scope, membershipId, response)`:
  1. Read the row; refuse unless it is `pending` and belongs to the caller (`NotFoundError`).
  2. `decline`: `UPDATE ... SET status = 'declined' WHERE id = ? AND status = 'pending' AND user_id = ?`, then settle the notification.
  3. `accept`: the two `PlanBusyError` guards; read how many of the caller's days would replace a row on the shared plan; then **one
     `runBatch`** in this order, the membership change **last** so a failure on the sequential test driver leaves the old state:
     (a) `DELETE` the shared plan's rows of this person that collide by date, (b) `UPDATE vacay_entries SET plan_id = shared` for the
     person's rows on their own plan, (c) the same two statements for `vacay_user_years` keyed on `year`, (d) insert the person's colour
     row (`firstUnusedSwatch` over the shared plan's colours, the owner's default counted as used when the owner has no row), (e)
     `UPDATE vacay_plan_members SET status = 'accepted' WHERE id = ? AND status = 'pending' AND user_id = ? AND NOT EXISTS (another
accepted non-owner row of this person)`.
  4. After the batch, `recomputeCarryOver` for the moved person on the shared plan (the allowance spec's function; derived and
     idempotent, so a failed recompute is logged and the next write repairs it, like every entry write). Then settle the notification.
     Returns `{ movedEntries, replacedEntries, movedYears, replacedYears }`.
     The move reads only the person's **own** plan, so it is idempotent: two accept clicks at once, or accepting two invitations at once,
     cannot corrupt anything; the loser's move finds nothing and its guarded status update does not match.
- `leavePlan(scope, planId)` and the member case of `removePlanMember`: refuse the plan's owner; `ensurePlan(scope, userId)` for the
  destination (a leftover empty plan after a failed batch is harmless and idempotent; the destination is created **outside** the batch,
  which is why the guarantee below is about rows and not about that empty plan); one `runBatch`: the same delete-then-update for entries
  and `vacay_user_years`, delete the person's `vacay_user_colours` row on the plan being left, and **last** delete the membership row.
  Then `recomputeCarryOver` on the destination. Returns the same counts. Years with no stored allowance row on the destination take the
  destination's `default_entitlement_days`; explicit rows keep their values.
- **The move, precisely.** Statements bind at most six parameters, so neither the number of days nor the number of years needs chunking: a
  fixed count of statements (at most eight) however many rows move. The collision rule is **the moving row replaces the destination
  row** (Resolved assumption 4): a person cannot be away twice on one date, so what is lost is at most a kind, never a day, and the count
  is reported. Aborting instead would leave a traveller who cannot go back and cannot see the row that blocks them.
- `getPlanOverview(scope, planId, year)` narrows **for the viewer** (`scope.ctx.userId`) in the repository, never in a handler or a
  component: other people's `note` is `null`; their `sick` becomes `other`; members who are not in the workspace, and for a non-owner
  viewer members who are not `accepted`, are left out of `members`, `entries` and `balances`. `loadVacay`, which stays callable because
  its file is not this stage's to edit, calls this function, so it is narrowed too and the exposure is closed at the one place that reads
  (Resolved assumption 2). `countEntriesByKind` counts the masked kind. A test fails if any module under `src/` imports `loadVacay`.
- **Notification.** `invitePlanMemberFn` calls `notify()` when `changed`: `type: 'navigate'`, `scope: 'user'`, `actionUrl: '/vacay'`,
  `entityType: 'vacay_plan_member'`, `entityId` the membership id, `titleKey` and `bodyKey` the stored templates
  `notification.vacay.invited.title` / `.body` with `{ actorName, planName }` params. **Never a rendered sentence** (the module stores
  keys so a row written a year ago renders in the reader's language). `respondToPlanInviteFn` finds the row by recipient, entity type
  and membership id (never a client-sent notification id) and calls `respondToNotification`, so the inbox row shows Accepted / Declined
  and leaves the unread count. A write that succeeded never fails because the notification did: the failure is logged and swallowed, as
  the existing dispatch call sites do. Cancelling an invitation leaves the inbox row linking to a working `/vacay` with no alert.

**Server functions (`src/routes/_app/-server/vacay.ts`).** Zod v4, `z.strictObject()` with the `error` parameter, all `POST` except the
loader. `loadVacayPlanFn` (GET, `{ year }`): resolves the active plan **from the session**, takes no plan id from the client, and returns
the complete narrowed payload the route needs - `plan` (with `ownerUserId`, `isOwner`, `ownerPresent`), the viewer's membership, `members`
(`membershipId`, `userId`, `status`, `isOwner`), `people`, `entries`, `companyHolidays`, `colours`, `balances` as `{ userId, usedDays }` only,
`invitations` (the viewer's own pending rows: membership id, inviter's name, plan name, and `busyReason: 'on-another-plan' |
'owns-shared-plan' | null` so the Accept button can say why it is inert) - and exports its payload type, which `vacay.tsx` imports in
place of `VacayPayload`. `invitePlanMemberFn { planId, userId }`, `respondToPlanInviteFn { membershipId, response }`, `leavePlanFn
{ planId }`. The route loader awaits `loadVacayPlanFn` first, then `Promise.all([loadVacayAllowance(planId, year), loadVacayGridFn(planId)])`;
`loadVacayGridFn` gains the plan id (re-guarded by `requirePlanActor`) and computes `isOwner` and "company holidays on" from **that**
plan, so a member never receives the owner's controls.

**UI.** `PlanMembers` replaces the "Travellers" panel; `InviteDialog` (owner); `InvitationAlert` above the grid for an invitee; "Go back to
my own plan" with a confirmation that names where the days go. The grid itself is unchanged and draws the other people's days as the
year-grid spec does. See [UI/UX](#-uiux).

**Seeder.** The demo members are inserted as `accepted` rows through `vacayPlanMembersRepository`, and `setPlanMemberStatus` loses its
export (an unguarded status writer must not outlive its only caller). Their entries stay on the owner's plan, which is their active plan.

### Phase 2 (08-S8b) - log and clear a day for a colleague

- The three entry functions (`setVacayEntryFn`, `setVacayEntryRangeFn`, `clearVacayEntriesFn`) gain an optional `forUserId`; absent
  means the caller. The repository's input keeps its optional `userId` for the dev seeder, under the rule of the table above (this
  replaces the year-grid spec's "owner only").
- When the target is not the caller, `daysToWrite` gains the reason `'private'`: a day on which the target's **stored** kind is `sick` or
  `other` is skipped for the write and left in place by the clear (`DELETE ... AND kind NOT IN ('sick','other')`), and counted in the
  result next to the count the function already returns. The picker shows such a day as "Away - only {name} can change it".
- One `notify()` per call to the person concerned, only when that person is not the caller, never one per day: `type: 'info'`,
  `notification.vacay.days_logged` / `.days_cleared`, params `{ actorName, count, from, to }`, `actionUrl: '/vacay?year=<year>'`.
- Allowance of another person stays owner-only; there is no control for it in this stage.
- **UI.** `SubjectSelector` in the grid header, offered to anyone who may write for another person: their own name by default, an accepted
  colleague when chosen; it changes the cell preview colour and every cell's accessible name, so it is never ambiguous whose day a tap takes;
  choosing a subject does not refetch the year.

### Phase 3 (08-S8c) - the owner manages the plan's people

- `removePlanMember(scope, membershipId)` (accepted member: the same move as leaving; owner's row refused), `cancelPlanInvite(scope,
membershipId)` (a `pending` or `declined` row: delete it, nothing moves; the person can be invited again).
- A member opens `plan-settings-dialog.tsx` **read-only** with a line saying only the owner changes them; the closed handoff item about
  `getPlanOverview`'s row-less fallback is resolved by publishing no other person's allowance figures (their used days only), so the
  fallback stays reachable only through `loadVacay`'s view of the viewer's own plan.
- **A plan whose owner left the workspace** stays usable: `ownerPresent` is false, owner-only actions answer `PlanOwnerOnlyError`, accepted
  members can still log, log for each other and go back to their own plans; the members' screen says the owner has left and that going back
  keeps every day. No reassignment (a product decision, out of scope). This makes the erasure spec's collision of two anonymised owners on
  `vacay_plans_org_owner_unq` reachable; that spec owns it and no erasure-registry row changes here.
- A departed accepted member is invisible and cannot be written for; `removePlanMember` on such a row answers `NotFoundError` (nothing to act
  on; the rows stay).

### Phase 4 (08-S8d) - pick your own colour

- `src/lib/vacay/swatches.ts` is the one owner of the palette: ten swatches chosen from the categorical chart colours, each checked in a
  test against **both** inks of `inkOn` (`src/routes/_app/-lib/tone.ts`) at 4.5:1, so the numeral on a day in that colour is always readable.
  `isSelectableSwatch(colour, takenByOthers)` is used by the repository to refuse a colour that is not in the palette (the stored value is
  also accepted, so a seeded colour never traps its owner) or is another accepted member's.
- `setUserColour(scope, planId, userId, colour)` becomes: the caller's own row, on their active plan, `requirePlanActor`; there is no
  `userId` input on `setPlanColourFn`. `ColourPicker` is a `Popover` of swatches, the taken ones disabled with their owner named.
- This is the one ticket that can slip behind the others without breaking the stage's promise, because 08-S8a already gives every joiner
  an unused colour.

### Alternatives considered, and why they lost

| Alternative                                                           | Why it lost                                                                                                                                                                    |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Accept only flips the status; the days stay on the invitee's own plan | Every read is by `plan_id`: the joiner's year vanishes from their own screen and never reaches the colleague they joined for.                                                  |
| Edit `loadVacay` in `library.ts`                                      | The plan reserves that file for the library stage in this wave (one claimant per wave); a new loader and narrowing in the repository close the same exposure without the edit. |
| Union the plans on the client                                         | Allowances, carry-over and writes are per plan; it would also keep sending every `note` and `kind`.                                                                            |
| A Durable Object for the leave plan                                   | Edits `worker.ts` and `wrangler.jsonc`, two shared paths a feature stage may not claim; re-reading on invalidation meets the outcome (Resolved assumption 1).                  |
| `type: 'action'` notification                                         | The inbox would show Accept/Decline buttons that only record an answer; `navigate` links to the only place the answer is real.                                                 |
| `dispatch()` for the invitation                                       | It resolves recipients from a trip or a workspace's administrators and cannot address one colleague.                                                                           |
| Abort the move on a same-date collision                               | The traveller could neither go back nor see the blocking row; the write guard makes a collision unreachable and the replace rule reports the rare leftover.                    |
| "Destination row wins" on a collision                                 | On leaving, the destination is the unused own plan: it would keep the stale invisible row and drop the one people were looking at.                                             |
| Show colleagues each other's allowance                                | The allowance spec reads a balance as the person's and the owner's only, and the screen needs only used days.                                                                  |
| Let the owner see unmasked `sick` days                                | A leave plan is personal; the workspace role gives no override and health data is not widened by a spec (Resolved assumption 6).                                               |
| Edit `removeMember` to clean up plans                                 | People leave through Better Auth, so it would never run; `src/server/auth` is a risk-high path.                                                                                |

## 📝 Architecture

- **One concept, one owner (`docs/SPEC.md` §8).** Which plan a person is on: `resolveActivePlan` / `activePlanIdOf`. Moving a person's data
  between plans: `movePersonalData`. What another viewer may see of a person's day: `getPlanOverview` and `countEntriesByKind`. The palette:
  `src/lib/vacay/swatches.ts`. All SQL: `src/server/repos/vacay.ts`. Components render and own no rule; server functions validate, forward
  and own no rule.
- **Seams.** Route loader: `loadVacayPlanFn`, then `Promise.all([loadVacayAllowance, loadVacayGridFn])` with its plan id. A write goes
  component, server function, `appScope()`, repository (guard, batch, recompute, notification), then `router.invalidate()` so every figure
  is the database's. `components/ui` never fetches or imports `server/`.
- **Cloudflare cost.** Join and leave are one batch of at most eight statements plus a handful of guard reads and the recompute; nothing is
  queued and no Durable Object is added. A notification is one insert.
- **Follow-up for another stage.** `loadVacay`, `VacayPayload` and `VacayEntryRow` in `library.ts` have no caller after this stage; the
  library stage deletes them (a test already fails if one appears).

## 📝 Data Model

**No schema change and no migration.** Written: `vacay_plan_members` (`status`), `vacay_entries` and `vacay_user_years` (`plan_id` only),
`vacay_user_colours`, and `notifications` (one insert; `entity_type = 'vacay_plan_member'` is a free-text column). The unique keys
`vacay_entries_plan_user_date_unq`, `vacay_user_years_plan_user_year_unq`, `vacay_plan_members_plan_user_unq` and
`vacay_plans_org_owner_unq` are what the replace rule, the one-row-per-person rule and the one-plan-per-owner rule lean on. `vacay_years`
is read by no grid code and nothing moves with it. Nothing records who wrote a day on someone's behalf; the notification to the person
concerned (`senderUserId`) is the only trace, by design (Resolved assumption 7).

## 📝 API Contracts

All `createServerFn`, Zod v4 `z.strictObject()` inputs, ids as the repository's `idSchema`, dates as `dateSchema`.

| Function                | Method | Input                                                  | Returns / refuses                                                                    |
| ----------------------- | ------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| `loadVacayPlanFn`       | GET    | `{ year }`                                             | The narrowed payload above; no plan id in                                            |
| `invitePlanMemberFn`    | POST   | `{ planId, userId }` (a **workspace member's** id)     | `{ status: 'pending' }`; `PlanOwnerOnlyError`, `NotFoundError`, `AlreadyOnPlanError` |
| `respondToPlanInviteFn` | POST   | `{ membershipId, response: 'accepted' \| 'declined' }` | Move counts; `NotFoundError`, `PlanBusyError`                                        |
| `leavePlanFn`           | POST   | `{ planId }`                                           | Move counts; `NotFoundError`                                                         |
| `removePlanMemberFn`    | POST   | `{ membershipId }`                                     | Move counts; `PlanOwnerOnlyError`, `NotFoundError`                                   |
| `cancelPlanInviteFn`    | POST   | `{ membershipId }`                                     | `{ ok: true }`                                                                       |
| `setPlanColourFn`       | POST   | `{ planId, colour }` (no `userId`)                     | The colour; `NotFoundError`, a refused-colour error                                  |
| the three entry fns     | POST   | the year-grid spec's inputs plus optional `forUserId`  | The counts it returns plus `skippedPrivate`                                          |

`invitePlanMemberFn` takes a workspace member only; bringing in a stranger is the administration stage's invitation system and this stage
links to it (the dialog's empty state) rather than growing a second one.

## 📝 UI/UX

### The members panel (08-S8a, completed in 08-S8c)

- **Where.** `PlanMembers` takes the "Travellers" panel's place (`Panel` from `-ui/scaffold.tsx`). Each row: swatch, `Avatar`, name (with
  "(you)" on the viewer's own row), used days in `tabular-nums`, and the status as a `Badge` **with text, never tone alone** ("Invited" muted,
  "Declined" struck through and dimmed, accepted shows none). The owner's row says "Owner". At 360px the panel sits **above** the grid.
- **Actions.** Owner only: "Invite a colleague" and a per-row overflow menu (Remove / Cancel invitation). The viewer's own accepted
  non-owner row: "Go back to my own plan" whose confirmation names where the days go ("Your {n} days and your allowance move back to your own
  plan. Nothing is lost.") and, after a move that replaced rows, reports how many.
- **States.** _Alone:_ on `--color-surface-2`, "Only you on this plan", one line on what sharing does and the invite action beside it.
  _Skeleton:_ three rows at the settled height. _Error:_ a failed invite keeps the dialog open with the person selected; a failed
  go-back shows a `danger` `Alert` that says explicitly **nothing was moved** (the batch is atomic and a traveller who has just been told
  "failed" needs to know their year is intact). _Loading:_ every action takes `loading` and `disabled`.
- **Invite dialog.** A `Combobox` over workspace members not already on the plan (avatar and name), the effect in one line before it is sent
  ("They will see your plan's dates, not the reason for a sick day. They choose whether to join."), focus returns to the trigger; a
  full-height sheet at 360px.
- **Invitation alert (invitee).** A persistent `Alert` above the grid naming the inviter and the plan, with Accept and Decline; when
  `busyReason` is set the Accept button is inert and the line says why ("You are already on {name}'s plan" / "Remove your colleagues from your
  plan first"). The accept line states that logged days and allowance come along, go back if they leave, and follow the shared plan's
  settings while there. Declining collapses it and it does not return on reload. More than one pending invitation lists each.
- **Subject selector (08-S8b).** In the grid header beside the year switcher, a labelled `Select` ("Logging days for"), shown only to people who
  may write for another. A colleague's masked day is announced "Away - only {name} can change it".
- **Colour picker (08-S8d).** A `Popover` of ten swatches in a labelled radiogroup; a taken swatch is disabled and named.
- **Motion.** Rows enter on 200ms opacity and 4px translate on `--ease-out-quint`, staggered 24ms, capped at eight; the popover uses the
  primitive's own transition; `prefers-reduced-motion: reduce` collapses to opacity.

## 📝 Visual change expected

Route `/vacay` only, light and dark, desktop and mobile. 08-S8a: the "Travellers" panel becomes the members panel; an invitation alert
above the grid for an invitee; the invite dialog; the go-back confirmation; the grid shows a second person's days in their colour.
08-S8b: the subject selector in the header and the subject-coloured preview. 08-S8c: the overflow menu, the read-only settings dialog and
the owner-left alert. 08-S8d: the colour popover. `/notifications` and the bell: three new stored sentences render. No other route changes.
Frames per `docs/plans/12-verification-protocol.md`: the merged grid with two travellers, the invitation alert, the invite dialog open, and
the subject selector open, captured with `scripts/visual/capture.mjs` at 360x800, 1280x900 and 2560x1440, light and dark.

## 📝 Copy

Every key lands in all 23 locales per the `i18n-messages` skill (`modules.ts`; the stored notification templates in `shell.ts`). English:

| Key                                               | Text                                                                                                                              |
| ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `vacay.members.title`                             | People on this plan                                                                                                               |
| `vacay.members.alone`                             | Only you on this plan                                                                                                             |
| `vacay.members.aloneHint`                         | Invite a colleague to see each other's days in one year and to log days for each other.                                           |
| `vacay.members.you`                               | {name} (you)                                                                                                                      |
| `vacay.members.owner`                             | Owner                                                                                                                             |
| `vacay.members.status.pending`                    | Invited                                                                                                                           |
| `vacay.members.status.declined`                   | Declined                                                                                                                          |
| `vacay.members.remove` / `.cancelInvite`          | Remove from plan / Cancel invitation                                                                                              |
| `vacay.members.goBack`                            | Go back to my own plan                                                                                                            |
| `vacay.members.goBackConfirm`                     | Your {days} days and your allowance move back to your own plan. Nothing is lost.                                                  |
| `vacay.members.goBackReplaced`                    | {count} days already on your own plan were replaced by the ones you brought back.                                                 |
| `vacay.members.goBackFailed`                      | Nothing was moved. Your days are where they were. Try again.                                                                      |
| `vacay.members.ownerLeft`                         | The owner is no longer in this workspace. You can keep logging, or go back to your own plan; no day is lost.                      |
| `vacay.invite.action` / `.title`                  | Invite a colleague / Invite someone to this plan                                                                                  |
| `vacay.invite.effect`                             | They will see your dates, not the reason for a sick day. They choose whether to join.                                             |
| `vacay.invite.empty`                              | Everyone in this workspace is already on this plan. To bring in someone new, invite them to the workspace first.                  |
| `vacay.invite.send` / `.sent`                     | Send invitation / Invitation sent to {name}                                                                                       |
| `vacay.invite.failed`                             | The invitation was not sent. Try again.                                                                                           |
| `vacay.invitation.title`                          | {name} invited you to share {plan}                                                                                                |
| `vacay.invitation.effect`                         | Your logged days and your allowance come with you and go back if you leave. They follow this plan's settings while you are on it. |
| `vacay.invitation.accept` / `.decline`            | Accept / Decline                                                                                                                  |
| `vacay.invitation.busy.onAnother`                 | You are already on {name}'s plan. Go back to your own plan first.                                                                 |
| `vacay.invitation.busy.ownsShared`                | You share your own plan with colleagues. Remove them first.                                                                       |
| `vacay.invitation.accepted` / `.declined`         | You joined {plan} / Invitation declined                                                                                           |
| `vacay.subject.label` / `.self`                   | Logging days for / Myself                                                                                                         |
| `vacay.subject.private`                           | Away - only {name} can change this day                                                                                            |
| `vacay.subject.skipped`                           | {count} days were left as they were because only {name} can change them.                                                          |
| `vacay.day.nameFor`                               | {date}, {name}, {kind}                                                                                                            |
| `vacay.colour.label` / `.taken`                   | Your colour / Used by {name}                                                                                                      |
| `vacay.settings.readOnly`                         | Only the plan's owner can change these settings.                                                                                  |
| `notification.vacay.invited.title` / `.body`      | {actorName} invited you to share {planName} / Open the leave planner to accept or decline.                                        |
| `notification.vacay.days_logged.title` / `.body`  | {actorName} logged days for you / {count} days from {from} to {to}.                                                               |
| `notification.vacay.days_cleared.title` / `.body` | {actorName} cleared days for you / {count} days from {from} to {to}.                                                              |

Plural-bearing keys use the catalogue's plural forms; dates render through `formatDateRange`, never `Intl` at render. The words "fuse",
"merge" and "dissolve" and a bare "leave" for the exit appear in no key.

## 📝 Edge Cases & Failure Scenarios

- **Accept or go-back fails mid-way.** The batch is atomic on D1; rows are unchanged and the alert says so. The destination plan of a
  go-back may exist empty afterwards (it is created outside the batch); harmless and idempotent.
- **Two accept clicks, or two invitations accepted at once.** The move reads only the person's own plan, so the loser moves nothing and its
  status update does not match; the second request sees a row that is no longer `pending` and gets `NotFoundError`.
- **Same date on both plans.** Unreachable through the product (the active-plan write rule); if it exists anyway the moving row replaces the
  destination row and the count is reported.
- **A person invited to two plans.** Both stay pending; accepting the second while on the first is `PlanBusyError('on-another-plan')`.
- **An owner with colleagues is invited elsewhere.** The invitation exists; accepting is `PlanBusyError('owns-shared-plan')` and the alert says
  why. A solo owner may accept; their own plan stays dormant and nothing is deleted.
- **Re-invite.** After a decline, a removal or a go-back it works; a pending row is left alone and no second notification is written.
- **Workspace departures.** A departed member is invisible and cannot be written for; the owner leaving leaves the plan usable (Phase 3).
  A returning person finds their rows. A departed owner's dormant plan is untouched.
- **Years with no allowance row** take the destination plan's default; the accept alert and the go-back confirmation state it.
- **A masked day.** A colleague cannot overwrite or clear a `sick` / `other` day of someone else; the result counts and says it.
- **A failed notification.** Logged and swallowed; the write stands.
- **Stale grid.** A colleague's change appears on the next load or the person's next write (no live sync).
- **Forged ids.** A membership, plan or user id from another workspace is `NotFoundError` and writes nothing.

## ✅ Acceptance criteria

**08-S8a**

1. The owner invites a workspace member; a user id from another workspace, the owner's own id and an already-accepted person are refused
   and write no row; a declined person returns to `pending` with one notification; a pending person changes nothing.
2. The invitee finds a stored, key-based notification (`type: 'navigate'`, entity = the membership) in the inbox; its text renders in the
   reader's locale; answering on `/vacay` marks it answered and read; the notification failing does not fail the invite.
3. Only the invitee can answer; the owner, another workspace member and another workspace's user get `NotFoundError`, and the row is
   unchanged (isolation test).
4. Accepting moves the invitee's entries and `vacay_user_years` onto the shared plan, assigns an unused swatch, flips the status last, and
   recomputes carry-over; `/vacay` then shows the shared plan for the invitee and for the owner, each in their own colour.
5. The two `PlanBusyError` cases refuse with their reason, move nothing, and the alert says why.
6. Going back moves everything home in one batch with the membership change last; the owner cannot go back; a forced failure moves
   nothing; the confirmation names the destination; the same-date replace rule reports its count.
7. Another person's `note` is never in any payload; their `sick` arrives as `other`; no allowance or remaining figure of another person is
   sent; pending and declined invitees receive no entries, balances or people; a person who left the workspace is in no list. A test fails
   if `loadVacay` is imported anywhere under `src/`, and `loadVacay`'s payload is narrowed too.
8. A personal write to a plan that is not the target's active plan is refused.
9. The seeder still produces the demo workspace with its accepted members; nothing imports `setPlanMemberStatus`.

**08-S8b**

10. The owner and an accepted member can log, log a run and clear for any accepted member still in the workspace; a pending, declined or
    departed person's target is refused; allowance, company holidays and plan settings for another person stay owner-only.
11. A target's `sick` / `other` day is never overwritten or cleared by someone else, and the result counts it; the person themself can.
12. One notification per call, not per day, and none when the target is the caller; the cell names whose day it is.

**08-S8c**

13. The owner removes an accepted member (the same move, counts reported), cancels a pending invitation, clears a declined one; a member
    cannot; a forged membership id from another workspace is `NotFoundError`.
14. A member opens the settings read-only; with the owner out of the workspace, owner actions answer `PlanOwnerOnlyError`, members can still
    log and go back, and the screen says so.

**08-S8d**

15. Every swatch reaches 4.5:1 against the ink `inkOn` picks, in both themes; the repository refuses a colour outside the palette that is
    not the stored one, or one another accepted member holds; there is no `userId` input.

**All tickets**

16. In A's scope against B's ids every new or changed repository function rejects with `NotFoundError` and B's `vacay_plan_members`,
    `vacay_user_colours`, `vacay_entries` and `vacay_user_years` counts are unchanged; two cases carry the block: inviting a user id that
    exists only in B's workspace, and a go-back in A's scope while B has entries on the same dates (A's move touches B's rows not at all).
17. Copy: every key in all 23 locales (parity test green); no hard-coded string; the exit action is never a bare "leave".
18. Keyboard end to end; WCAG 2.2 AA in both themes; status conveyed by text as well as tone; focus returns to the trigger of every dialog;
    reduced motion honoured; 360px through 2560px with no horizontal overflow in `ar`, `pl`, `vi`, `zh`; console silent; zero layout shift after
    settle on `chromium`.
19. The structural allowlist test lists exactly the functions with a production caller after each ticket.

## 📝 Risks & Impact Review

- **Risk label.** The security and tenancy reviewer reads this as `risk-high` for 08-S8a, 08-S8b and 08-S8c and `risk-medium` for 08-S8d,
  no `security` label: no path of `SDLC.md` § Risk here is touched, but `SDLC.md` counts data scoping as risk-high and says to take the
  higher label when signals conflict. It is the first stage to show one person's leave data to another, to let one person write another's rows,
  and the only operation in the module that moves rows between two plans. Those tickets go to a security and tenancy reviewer before they are
  claimed and again on the diff.
- **A replaced kind.** The replace rule can lose a day's _kind_ (never a day) when a collision exists despite the write guard; reported.
- **A kind is a coarse trace.** There is no "written by" column; the notification to the person concerned is the only record that a colleague
  changed their days. Adding an audit row is a follow-up if review wants one.
- **`loadVacay` stays exported.** It is narrowed at the repository and a test pins that nothing imports it; deleting it is the library stage's.
- **Erasure.** A departed owner's plan, kept, makes two anonymised owners colliding on `vacay_plans_org_owner_unq` reachable (the erasure spec
  records the collision); no registry row changes here.
- **Existing accepted members at deploy.** Production should hold none (only the dev seeder wrote accepted non-owner rows); if any exist,
  their days on their own plan stop showing under the active-plan loader. The seeder's demo members are unaffected (their rows are on the
  owner's plan).
- **Backward compatibility.** Additive: new exports and functions; `setPlanMemberStatus` loses its export (no production caller);
  `invitePlanMember`'s return type gains `changed`; `getPlanOverview` returns narrowed rows (its shape is unchanged).
- **Not checkable from this run.** The colours of the ten swatches (the test fixes the rule); atomicity of the conditional status update
  under two truly concurrent requests on real D1 (the move's idempotency does not depend on it).

### Out of scope

- Live sync of a colleague's change (a future stage files the binding through the foundations wave rather than editing `worker.ts` and
  `wrangler.jsonc`); a re-read on window focus.
- Email for an invitation: `notify()` consults no preference, and a member-addressed event in `dispatch.ts` is a follow-up; no preference
  switch is added for it (a switch that governs nothing is a placeholder, `docs/SPEC.md` §7.5). Telling the inviter that the answer arrived.
- Reassigning a plan whose owner left; inviting someone who is not yet in the workspace; editing another person's allowance in the UI;
  letting a colleague see a `sick` kind (an opt-in is a legal question about health data, a person's decision).
- Public holidays, holiday calendars (the year-grid spec's follow-up).

### Reference-row disposition

`ADD-04` partial -> **done** with these residues stated in the PR: no live sync (re-read on invalidation), in-app only.

## 📋 Phasing

| Phase | Ticket | Slice a person can see work                                                                            | Blocked by     |
| ----- | ------ | ------------------------------------------------------------------------------------------------------ | -------------- |
| 1     | 08-S8a | A colleague is invited, told, accepts, appears with their own colour, and can go back taking every day | 08-S1a, 08-S5a |
| 2     | 08-S8b | Either person logs and clears a day for the other and the other is told                                | 08-S8a, 08-S5c |
| 3     | 08-S8c | The owner removes or cancels, a member reads the settings, a plan without its owner still works        | 08-S8a, 08-S1c |
| 4     | 08-S8d | A person picks their own measured colour                                                               | 08-S8a         |

If 08-S8a does not fit one context window, it is cut by behaviour: first the read side (`loadVacayPlanFn`, the narrowing, the members panel
and the seeder's accepted members, so a seeded colleague appears), then invite, accept and go back together. Never accept without going back.

## 📋 Implementation Plan

### Phase 1 - join and leave (08-S8a)

1. `resolveActivePlan`, `activePlanIdOf`, the narrowing in `getPlanOverview`, `countEntriesByKind`, the "target's active plan" write rule; tests.
2. `swatches.ts` `firstUnusedSwatch`; `movePersonalData`; `respondToPlanInvite`, `leavePlan`, guarded `invitePlanMember`; tests incl. isolation.
3. `loadVacayPlanFn` and the five functions; the notification and its settle; tests.
4. `PlanMembers`, `InviteDialog`, `InvitationAlert`, the route loader; copy in 23 locales; `CONTEXT.md`; the seeder; `e2e/product-modules.spec.ts`.

### Phase 2 - log for a colleague (08-S8b)

1. The "for another person" rule and the `'private'` reason; notification; tests. 2. `forUserId` on the three functions. 3. `SubjectSelector`, cell names, copy, e2e.

### Phase 3 - manage the people (08-S8c)

1. `removePlanMember`, `cancelPlanInvite`. 2. The read-only settings dialog, `ownerPresent` and its alert. 3. Copy, tests, e2e.

### Phase 4 - colour (08-S8d)

1. The palette and its contrast test. 2. Guarded `setUserColour` and `setPlanColourFn`. 3. `ColourPicker`, copy, e2e.

## Verification

- The gate in `validation.commands` (`.ai/agentic.config.json`) on every phase's last commit.
- Unit: `src/lib/vacay/__tests__/swatches.test.ts`; `src/routes/_app/-server/__tests__/vacay.test.ts`; `src/components/vacay/__tests__/`
  for `plan-members` (owner sees remove, a member does not; own row offers go-back; the confirmation names the destination; status is text),
  `invite-dialog` (people already on the plan are absent; a rejected invite keeps the selection; focus returns), `invitation-alert`,
  `subject-selector`, `colour-picker`.
- Repository: the cases above in `repositories.test.ts` and one `describe` per ticket in `tenant-isolation.test.ts`; the harness refuses a
  statement over `MAX_BOUND_PARAMETERS` and rolls a failed batch back, which the move tests use for the "forced failure moves nothing" case.
- Browser (ADR 0016: no baselines): `e2e/product-modules.spec.ts` asserts `/vacay?year=2026` answers, hydrates, is silent in the console and
  can be acted on: invite as one demo user, accept as another, see both in the grid, log for the other with the keyboard, go back and find the
  days home. Writing describes are serial, `chromium` only, and restore what they change. Frames: `scripts/visual/capture.mjs` with
  `--state invite --click '[data-part="vacay-invite"]'` and `--state subject`.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                       | Applied default                                                                                                                                                                                                         | Why                                                                                                                                                                                                                              |
| --- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The plan's live sync over named events                         | Deferred: re-read on invalidation plus the notification; a future stage files the binding through the foundations wave                                                                                                  | Applied default, verified in `wrangler.jsonc` / `src/server/worker.ts`: the only Durable Object is per trip and both files are shared paths no feature stage may claim.                                                          |
| 2   | Which plan an accepted member sees, and where the loader lives | `resolveActivePlan` in the repository; a new `loadVacayPlanFn` in `-server/vacay.ts`; `loadVacay` not edited but narrowed through `getPlanOverview`; a test forbids importing it                                        | Decided by software architect sub-agent (confidence high) and security and tenancy sub-agent (confidence medium): editing `library.ts` is the library stage's; narrowing at the one read closes the still-callable endpoint.     |
| 3   | Accepting: flip the status only, or move the days              | Move the invitee's entries and allowance rows onto the shared plan in one batch, mirror image of going back, through one `movePersonalData`; membership change last                                                     | Decided by software architect (confidence medium-high) and product owner (confidence high) sub-agents: every read is by `plan_id`; flipping alone hides the joiner's year.                                                       |
| 4   | A same-date collision when moving                              | Prevent it (a personal write must target the person's active plan); if one exists the **moving row replaces the destination row** and the count is reported                                                             | Decided by security and tenancy sub-agent (confidence medium); the architect (destination wins) and product owner (abort) disagreed; replace chosen as the one that never traps a traveller and keeps the row people were using. |
| 5   | How many plans, who may accept, who may leave                  | One accepted non-owner plan per person; an owner with accepted colleagues may be invited but not accept; a solo owner may accept; the owner never leaves their own plan                                                 | Decided by all three sub-agents (security, architect, product owner): allowances are per plan; an owner cannot leave themselves.                                                                                                 |
| 6   | What a colleague sees of another's day                         | `note` never; `sick` as `other`; no allowance figures of others; used days shown; pending/declined receive nothing; no role override. An opt-in to show `sick` is not applied                                           | Decided by security and tenancy sub-agent (confidence high); the product owner agreed on masking. Widening health data is a person's legal decision.                                                                             |
| 7   | Who may write for whom, and a trace                            | Owner and accepted members for any accepted member in the workspace on their active plan; masked days never overwritten; one notification per call to the person; allowance, company holidays, settings stay owner-only | Decided by security and tenancy sub-agent (confidence medium): the plan promises either person can log for the other; `senderUserId` on the notification is the trace without a schema change.                                   |
| 8   | Departed workspace members and a departed owner                | Keep everything; resolve at read time; no edit to `members.ts` or `src/server/auth`; the owner leaving leaves the plan usable, no reassignment                                                                          | Decided by security and tenancy (confidence medium) and product owner sub-agents: people leave through Better Auth, not `removeMember`; the orphaned-journey precedent.                                                          |
| 9   | Notification type, channel, who is told                        | `notify()`, `type: 'navigate'`, in-app only; the invitation is marked answered on `/vacay`; the inviter is not notified; no preference switch; the plan's "ACC-05 must have landed" blocker dropped                     | Decided by product owner sub-agent (confidence medium): `action` would get buttons that only record; `notify()` consults no matrix; verified in `notifications.ts`.                                                              |
| 10  | Ticket cut                                                     | Four tickets: join and leave together, log for a colleague, manage the people, colour; accept never ships without going back                                                                                            | Decided by product owner sub-agent (confidence medium): join without exit is a one-way door; colour is the one ticket that can slip.                                                                                             |
| 11  | Risk label                                                     | `risk-high` for the first three tickets, `risk-medium` for colour; no `security` label                                                                                                                                  | Decided by security and tenancy sub-agent (confidence medium): data scoping is risk-high in `SDLC.md`; the diff is where a missing filter would go unnoticed.                                                                    |
| 12  | Plan paths that no longer exist                                | `e2e/product-modules.spec.ts`, no PNG baselines; `modules.ts` and `shell.ts` in 23 locales; seeder, `swatches.ts` and `CONTEXT.md` join the owned list                                                                  | Applied default: ADR 0016 and `docs/plans/12-verification-protocol.md`; the same departure the two earlier specs record.                                                                                                         |
| 13  | The exit action's name                                         | "Go back to my own plan"; no "fuse", "merge", "dissolve" or bare "leave" in copy                                                                                                                                        | Applied default (product owner sub-agent condition): "leave" collides with leave as time off.                                                                                                                                    |
| 14  | Years with no allowance row after a move                       | They take the destination plan's default; explicit rows keep their values; the confirmations say so                                                                                                                     | Decided by software architect and product owner sub-agents: only years with no stored row anywhere are affected.                                                                                                                 |
| 15  | The row-less balance fallback handed to this stage             | Closed by publishing no other person's allowance figures; it stays reachable only through `loadVacay`'s view of the viewer's own plan                                                                                   | Applied default: the payload carries `{ userId, usedDays }` for others, which needs no fallback.                                                                                                                                 |
| 16  | Name later stages by id in this spec?                          | No; only the earlier specs' tickets and this stage's own carry ids                                                                                                                                                      | Applied default, verified in `.ai/scripts/backlog-status.mjs`: any stage id in a spec reads as that stage being specified.                                                                                                       |
