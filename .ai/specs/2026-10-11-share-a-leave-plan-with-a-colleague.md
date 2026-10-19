# Leave planner: share a plan with a colleague, log for each other, and step out without losing a day

| Field              | Value                                    |
| ------------------ | ---------------------------------------- |
| **Status**         | ready                                    |
| **Issue**          | none                                     |
| **Spec PR**        | #1122                                    |
| **Implementation** | none                                     |
| **Plan**           | 08-S8 (docs/plans/08-product-modules.md) |

## 📝 TLDR

Plan stage `08-S8` is the shared half of the leave planner (reference row `ADD-04`). Today `/vacay` is one person's diary: the
four repository writers that would put a second person on a plan (`invitePlanMember`, `setPlanMemberStatus`, `removePlanMember`,
`setUserColour`) have no production caller except the dev seeder, check only that the plan is in the workspace, and nothing
decides which plan an accepted colleague should see. This stage lets a colleague be invited, accept, appear in the same year with
their own colour, have days logged for them by the other person, and step out again taking every day with them. It ships as
**five tickets that are each a full path from repository to screen**:

1. **08-S8a - see the plan you are on.** The read side: the viewer's active plan, the people on it in a members panel, other people's
   days narrowed to dates and never reasons, and the rule that a person's own writes land on their active plan. A colleague the dev
   seeder puts on the plan appears on the grid. Risk-high (data scoping).
2. **08-S8b - join and leave a shared plan.** The plan's owner invites a current workspace member; the invitee is told in the inbox and
   accepts or declines on `/vacay`; accepting **moves the invitee's days and allowance rows onto the shared plan** and gives them an
   unused colour; "Go back to my own leave plan" moves everything home. Risk-high.
3. **08-S8c - log and clear a day for a colleague.** A subject selector in the grid header; the owner or any accepted member may write
   (vacation, half day, remote) and clear days for any accepted member on that member's active plan, and the person concerned is told once
   per action. Risk-high.
4. **08-S8d - the owner manages the plan's people.** Remove an accepted member (the same lossless move), cancel an invitation, invite a
   declined person again; a member reads the plan settings read-only; a plan whose owner left the workspace stays usable. Risk-high.
5. **08-S8e - pick your own colour.** A picker of measured, named swatches, your own colour only. Risk-medium.

No schema change, no migration, no route added, no package added, no queue message, no Durable Object.

**What is deliberately not here.** Live sync (the only realtime primitive is the per-trip `TripRoom`; the grid re-reads on
invalidation, Resolved assumption 1), email for an invitation (an in-app row only, Resolved assumption 9), telling the inviter
that the answer came in, reassigning a plan whose owner left, inviting a person who is not yet in the workspace, and letting a
colleague see another person's sick days (a legal question about health data that is not this spec's to widen).

This spec describes the work that is **left** at HEAD (`ec5182b2`). It departs from the plan's stage block wherever the code the plan
cites has changed or a specialist found the plan incomplete; every departure is a row of the Resolved assumptions table. It builds on
two merged specs that are **not implemented at HEAD**: the allowance spec (`.ai/specs/implemented/2026-10-08-leave-planner-allowances-and-carry-over.md`,
tickets 08-S1a to 08-S1c: `requirePlanActor`, `requirePlanOwner`, `recomputeCarryOver` (08-S1b), `src/routes/_app/-server/vacay.ts`,
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
  free-text `note` (the screen prints the kind and counts it in its legend), and a balance row for every member row **and every user with an
  entry**, whatever the status: a pending or declined invitee shows a made-up allowance. `sick` costs nothing, so used days do not reveal it,
  but the kind does. `getPlanOverview` and `countEntriesByKind` also check only that the plan is in the workspace. Both merged specs hand the
  narrowing to this stage ("those rows hold colleagues' sick days").
- **Every owner already has two roles on their own plan.** `ensurePlan` writes an `accepted` membership row for the owner
  (`vacay.ts:152-156`), so "a traveller's accepted rows" cannot be a plain count, and the owner's row is "the viewer's own row" on
  their plan.
- **Leaving a workspace takes only the membership.** People leave through Better Auth's endpoints (`src/server/auth/index.ts`), not
  through `removeMember` in `members.ts` (which only tests call): every `vacay_*` row stays behind. The precedent for such rows
  (an orphaned journey, a stranded trip) is "kept, resolved at read time, comes back if the person returns".
- **`notify()` writes one in-app row and consults nothing.** `src/server/repos/notifications.ts:129` stamps `senderUserId` and inserts
  (its params are `titleParams` / `bodyParams`); it never reads the preference matrix and queues no email. The composition layer
  `src/server/notifications/dispatch.ts` resolves its recipients from a trip (or a workspace's administrators), so it cannot address one
  colleague. An `action`-type notification would get inline Accept/Decline buttons from the notification-matrix stage that only
  **record** an answer, which would make them lie.
- **A plan's stored name is not a thing a reader can be shown.** Every plan is named by the column default `'Vacay'`
  (`src/server/db/schema.ts:2382`), nothing renames it, and a stored English word cannot be translated, so no sentence in this stage names
  a plan by its stored name: a plan is named by its **owner** (`{name}`).
- **The plan's realtime row is not buildable here.** `TripRoom` is one Durable Object per trip, bound in `wrangler.jsonc` and exported from
  `src/server/worker.ts`, two of the six shared paths no feature stage may claim.

The reader this serves: two colleagues who plan leave around the same project and want to see who is away when, to put a day in for
the one who forgot, and to stop sharing without anyone's year disappearing. The reference behaviour (an invitation a colleague
accepts or declines, a merged year in which several people's absences sit side by side, days logged on somebody's behalf, a
separation that leaves both histories intact - `wiki: Vacay-Sharing`) is delivered in planned.travel's vocabulary.

## 📝 Proposed Solution

### What the stage owns and what it does not

| Owned (this stage writes it)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Not owned (read only, or left alone)                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/repos/vacay.ts` - edit: `resolveActivePlan`, `activePlanIdOf` (private), `invitePlanMember` (guarded, re-invite), `respondToPlanInvite` (replaces the exported `setPlanMemberStatus`), `leavePlan`, `removePlanMember` (guarded), `cancelPlanInvite`, `setUserColour` (guarded), the private `movePersonalData` both directions call, `getPlanOverview` and `countEntriesByKind` (guarded and narrowed), the "for another person" rule of `setEntry` / `setEntryRange` / `clearEntries`; the new errors `AlreadyOnPlanError`, `PlanBusyError`, `ColourRefusedError`, beside the allowance spec's `PlanOwnerOnlyError` | `src/server/db/schema.ts`, `drizzle/` - **no schema change, no migration**                                                                                              |
| `src/lib/vacay/swatches.ts` - new, pure: the palette, `firstUnusedSwatch`, `isSelectableSwatch`; `src/lib/vacay/__tests__/swatches.test.ts` (a test-only dependency on the two fixed ink hexes of `src/styles/tokens.css`, because `inkOn` returns a CSS variable, not a hex; `swatches.ts` itself imports nothing from `routes`)                                                                                                                                                                                                                                                                                                 | `src/routes/_app/-server/library.ts` - held by the library stage this wave; `loadVacay` is **not edited** (Resolved assumption 2)                                       |
| `src/lib/vacay/day-rules.ts` and its test - edit (08-S8c): `daysToWrite` takes the target's protected dates and returns the new reason `'private'`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | `src/server/repos/members.ts`, `src/server/auth/**` - **no edit** (a departure is resolved at read time; `src/server/auth` would make a ticket risk-high on path alone) |
| `src/routes/_app/-server/vacay.ts` - edit: `loadVacayPlanFn` (new), `invitePlanMemberFn`, `respondToPlanInviteFn`, `leavePlanFn`, `removePlanMemberFn`, `cancelPlanInviteFn`, `setPlanColourFn`; `loadVacayGridFn` gains the active plan's id; the `forUserId` key on the three entry functions; `__tests__/vacay.test.ts`                                                                                                                                                                                                                                                                                                        | `src/server/notifications/dispatch.ts`, `src/server/repos/notifications.ts` - imported, not edited                                                                      |
| `src/routes/_app/vacay.tsx` - edit: loader order, `PlanMembers` replaces the "Travellers" panel, the invitation alerts, the subject selector                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | `src/components/ui/**`, `src/styles/tokens.css` - no primitive and no token is missing                                                                                  |
| `src/components/vacay/` - `plan-members.tsx`, `invite-dialog.tsx`, `invitation-alert.tsx`, `subject-selector.tsx`, `colour-picker.tsx`, `index.ts`, `__tests__/` for each; `src/routes/_app/-ui/plan-settings-dialog.tsx` edit in 08-S8d (read-only view); `day-cell.tsx` / `day-picker.tsx` edit in 08-S8c (a subject)                                                                                                                                                                                                                                                                                                           | `src/server/billing/**`, `src/lib/plans.ts` - no quota, no `MODULE_KEYS` entry                                                                                          |
| `src/lib/i18n/messages/<locale>/modules.ts` and `shell.ts` (the stored `notification.vacay.*` templates) - edit, **all 23 locales**; the `vacay.travellers.*` keys the new panel replaces are removed from all 23                                                                                                                                                                                                                                                                                                                                                                                                                 | `e2e/helpers/**` - reused, not edited                                                                                                                                   |
| `src/routes/api/dev/-seed/apply.ts` - edit (08-S8a, and 08-S8c where it drops `userId` from `setEntryRange`; its `setUserColour` call at line 668 moves to `vacayUserColoursRepository` before 08-S8e guards `setUserColour`): it uses `setPlanMemberStatus` and an owner-written accept; it inserts the demo members as `accepted` rows through `vacayPlanMembersRepository`                                                                                                                                                                                                                                                     |                                                                                                                                                                         |
| `src/server/repos/__tests__/tenant-isolation.test.ts`, `repositories.test.ts` - append; the allowance spec's structural allowlist test - edit per ticket                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |                                                                                                                                                                         |
| `e2e/product-modules.spec.ts` - append (no baselines, ADR 0016)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |                                                                                                                                                                         |
| `CONTEXT.md` - glossary: **Shared leave plan** and **Plan member** (08-S8a); each states the one-active-plan rule and that an owner always holds an accepted row on their own plan                                                                                                                                                                                                                                                                                                                                                                                                                                                |                                                                                                                                                                         |

Departures from the plan's owned paths (Resolved assumptions 2, 12, 13): no `e2e/product-modules.visual.spec.ts` and no re-recorded
`vacay-*` PNGs because ADR 0016 removed the baselines (`e2e/product-modules.spec.ts` replaces them, as in the earlier specs of this plan);
`modules.ts` and `shell.ts` in all 23 locales, `CONTEXT.md`, the seeder, `day-rules.ts` and `src/lib/vacay/swatches.ts` join the list; the
plan's `invite-dialog.tsx` / `plan-members.tsx` / `colour-picker.tsx` stay, with `invitation-alert.tsx` and `subject-selector.tsx` beside them.

### The model, in the traveller's terms

- A traveller is on **exactly one plan at a time**: the **active plan**. It is the plan they accepted a place on, otherwise their own.
  Their days and their allowance rows live on the active plan, and the screen shows only that plan. A plan is named by its owner; the copy
  says "leave plan" (the module's own word; `CONTEXT.md` holds only "Leave planner" at HEAD and gains "Leave plan" with 08-S1a), never "fuse", "merge" or "dissolve", and never a bare "leave" for the exit (it
  collides with leave as time off): the exit is **Go back to my own leave plan**.
- **Joining moves your days in; going back moves them home.** Accepting moves the invitee's entries and allowance rows from their own
  plan onto the shared plan; going back (or being removed) moves them to the person's own plan. One private function,
  `movePersonalData(scope, fromPlanId, toPlanId, userId)`, is both directions, so they cannot diverge. Their own plan stays as a
  dormant plan (its settings and company holidays are untouched) and takes no writes of that person's days while they are away from it.
- **A plan with colleagues is never a dormant plan.** A person who owns a plan with accepted colleagues cannot join another plan, and a
  person who has joined another plan can neither send nor accept an invitation into their own: nobody is ever invited to, or moved
  onto, a plan whose owner is looking at a different one.
- **A colleague sees dates, not reasons.** Another person's `sick` and `other` days reach the viewer as the neutral `other` ("Away");
  their `note` is never sent. Allowance, carried-over and remaining figures are visible to the person and to the plan's owner (the allowance
  spec's rule, which the owner needs to set them) and to **nobody else**; every other viewer receives used days only (a sick day costs
  nothing, so used days reveal nothing). Masking of `sick` / `other` has no role override: the owner is masked from too.
- **Pending and declined grant nothing.** A pending or declined invitee sees the inviter's name and the invitation, nothing of the
  plan: no entries, no balances, no people. Only the owner sees pending and declined rows.
- **A person who left the workspace disappears from every read** (grid, list, balances, subject selector) but their rows stay and come back
  if they return. Nothing is deleted, moved or reassigned by the workspace departure.

### Who may do what

All in the repository; the handlers call it and own no rule. `requirePlanActor` and `requirePlanOwner` are the allowance spec's
prerequisites, not rewritten here. A structural test (the allowance spec's criterion 5) lists the functions with a production caller; each
ticket edits it for the functions it reaches.

| Action                                                       | Who                                                                                                                                                                                                                                                                                            | Refusal                                                                                                                             |
| ------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Read a plan's overview or counts                             | `requirePlanActor` (the owner or an accepted member), inside `getPlanOverview` and `countEntriesByKind` themselves                                                                                                                                                                             | `NotFoundError`                                                                                                                     |
| Invite                                                       | The plan's owner (`requirePlanOwner`) **on the plan they are active on**; the target is a **current workspace member** (`getMembership`), not the owner, not already accepted                                                                                                                  | `NotFoundError` for a target outside the workspace; `PlanOwnerOnlyError`; `AlreadyOnPlanError`; `PlanBusyError('owner-away')`       |
| Re-invite                                                    | Same. A `declined` row returns to `pending` and one notification is written; a `pending` row changes nothing and writes nothing                                                                                                                                                                | -                                                                                                                                   |
| Accept or decline                                            | Only the invitee: the row's `user_id` equals `scope.ctx.userId` and its status is `pending`; the handler takes the membership id and nothing else                                                                                                                                              | `NotFoundError` (a forged id, another workspace's id, someone else's row, an answered row)                                          |
| Accept, extra guards                                         | The caller holds no accepted row on a plan they do not own; their own plan has **no accepted colleague at all** (whether or not that colleague is still in the workspace); the invited plan's owner is **still a member of the workspace** and holds no accepted row on a plan they do not own | `PlanBusyError` with `reason: 'on-another-plan' \| 'owns-shared-plan' \| 'owner-away'`                                              |
| Accept, effect on the caller's own invitations               | The caller's own pending invitations to colleagues are deleted in the same batch and each of those colleagues is told once                                                                                                                                                                     | -                                                                                                                                   |
| Go back to my own plan                                       | The caller, from an accepted non-owner membership                                                                                                                                                                                                                                              | `NotFoundError`; the owner of a plan **cannot** go back from it (the owner empties it by removing people)                           |
| Remove, cancel an invitation                                 | The plan's owner, on a row of that plan that is not their own                                                                                                                                                                                                                                  | `PlanOwnerOnlyError`; `NotFoundError`                                                                                               |
| Log or clear a day for **another** person                    | `requirePlanActor`; the plan is the **caller's** active plan; the person is an accepted member of that plan, still in the workspace, **and the plan is their active plan**; the kind is `vacation`, `half_day` or `remote`; no `note`                                                          | `NotFoundError`; a `sick` / `other` kind or a note for another person is a validation error; a protected day is skipped and counted |
| Log or clear your own day                                    | As the year-grid spec, plus the plan must be your active plan                                                                                                                                                                                                                                  | `NotFoundError`                                                                                                                     |
| Allowance of another person, company holidays, plan settings | **Owner only**, unchanged (a member reads the settings read-only). The owner's allowance write on their own dormant plan is accepted: the replace rule absorbs it                                                                                                                              | `PlanOwnerOnlyError`                                                                                                                |
| Colour                                                       | Your own, on your active plan, from the palette, not used by another accepted member                                                                                                                                                                                                           | `NotFoundError`; `ColourRefusedError`                                                                                               |

- **Hiding a control is not the guard.** Every handler starts with `appScope()`, forwards no client-supplied acting user, and resolves
  the plan inside the workspace before anything else.
- **"The plan is their active plan" is the rule that makes a same-date collision unreachable.** Without it, the owner of a dormant plan
  could still write to it through a forged `planId`, and a later move would meet a duplicate (Resolved assumption 4). The caller's own
  active plan is required too, so a solo owner who has joined another plan keeps no write power on the plan they left.
- **No row-id path to someone else's day.** Clearing is by plan, person and date range, as before; `removeEntry` stays unreachable and off
  the allowlist, as do `addHolidayCalendar`, `removeHolidayCalendar`, `listPlansForUser`, `deletePlan` and `countUsedDays`. `deletePlan`
  has no access check and the foreign keys cascade, so a caller added later must put `requirePlanOwner` in front of it first.
- **Tenancy.** Every statement is `tenantFilter()`-bound or stamps `organization_id` from the scope, **including each sub-select and each
  `EXISTS`** of the move; both plan ids are resolved with `requireById` in the same scope before any statement is built, so rows cannot land in a
  plan of another workspace even when both ids come from the client.
- **Who may be in a read.** Entries, balances, colours and people of a plan are restricted to the plan's owner and the people holding an
  **accepted** row on it who are **currently members of the workspace** (the read filters through `stillInWorkspace(scope, <user id column>)` of `src/server/repos/members.ts`, the single home of that test), not to "everyone with an entry". Pending
  and declined rows appear only in `members`, only for the owner, and never get a balance row for any viewer.

### Phase 1 (08-S8a) - see the plan you are on

**Repository (`src/server/repos/vacay.ts`).**

- `resolveActivePlan(scope)`: an `accepted` membership of `scope.ctx.userId` on a plan whose owner is someone else, and that plan is
  returned without creating anything; otherwise `ensurePlan(scope)`. The private `activePlanIdOf(scope, userId)` is the same lookup for
  another person and **never creates a plan** (an own plan only if it exists). `loadVacayPlanFn` is the only caller that may create a
  plan on a read, which keeps the "no concurrent `ensurePlan`" order of the earlier specs.
- `getPlanOverview(scope, planId, year)` calls `requirePlanActor` itself and narrows **for the viewer** (`scope.ctx.userId`) in the repository,
  never in a handler or a component: other people's `note` is `null`; their `sick` becomes `other`; `members`, `entries`, `balances` and
  `colours` are restricted as in "Who may be in a read"; a balance row carries the full figures (`entitlementDays`, `carriedOverDays`,
  `remainingDays`) for the viewer's own row and for every row when the viewer is the plan's owner, and for every other row only
  `{ userId, usedDays }`. The result type is a union (`PlanBalance = FullBalance | UsedOnlyBalance`), never zeroed figures that would read as a
  real balance. `loadVacay` (still callable because its file is not this stage's to edit) always shows the viewer's own plan, where the viewer is
  the owner, so it receives full balances and the same masking; a test fails if any module under `src/` imports `loadVacay`
  (Resolved assumption 2). `countEntriesByKind` calls `requirePlanActor` and counts the masked kind.
- **The write rule.** A write of the viewer's own days (`setEntry`, `setEntryRange`, `clearEntries`) must target the viewer's active plan
  (`NotFoundError` otherwise). The rule lives **in the write statement too**, not only in a pre-read: the insert is `INSERT ... SELECT ... WHERE
EXISTS` the person's accepted membership of that plan (or ownership, for the owner on their own plan), so a write racing a go-back or a
  removal inserts nothing instead of leaving a day on a plan the person no longer belongs to, and the function reports what it skipped. It lands in
  this ticket because it is the half of the rule that makes the read side honest.

**Server functions (`src/routes/_app/-server/vacay.ts`).** `loadVacayPlanFn` (GET, `{ year }`): resolves the active plan **from the session**, takes
no plan id from the client, and returns the narrowed payload the route needs - `plan` (`id`, `ownerUserId`, `isOwner`, `ownerPresent`), the viewer's
membership, `members` (`membershipId`, `userId`, `status`, `isOwner`), `people`, `entries`, `companyHolidays`, `colours`, `balances` - and exports
its payload type, which `vacay.tsx` imports in place of `VacayPayload`. The route loader awaits `loadVacayPlanFn` first, then
`Promise.all([loadVacayAllowance(planId, year), loadVacayGridFn(planId)])`; `loadVacayGridFn` gains the plan id (re-guarded by `requirePlanActor`)
and computes `isOwner` and "company holidays on" from **that** plan, so a member never receives the owner's controls.

**UI.** `PlanMembers` replaces the "Travellers" panel (read-only in this ticket: swatch, avatar, name, used days, status; no actions yet, and the _alone_ state shows `vacay.members.alone` only - `vacay.members.aloneHint` and the invite action arrive with 08-S8b). The
grid is unchanged and draws the other people's days as the year-grid spec does. See [UI/UX](#-uiux).

**Seeder.** The demo members are inserted as `accepted` rows through `vacayPlanMembersRepository`, and `setPlanMemberStatus` loses its export (an
unguarded status writer must not outlive its only caller). Their entries stay on the owner's plan, which is their active plan.

### Phase 2 (08-S8b) - join and leave a shared plan

- `invitePlanMember(scope, planId, userId)` returns `{ member, changed }`: the guards of the table above; `changed` is true for a new
  row or a `declined` row put back to `pending`, and only then does the handler write the notification.
- `respondToPlanInvite(scope, membershipId, response)`:
  1. Read the row; refuse unless it is `pending` and belongs to the caller (`NotFoundError`).
  2. `decline`: `UPDATE ... SET status = 'declined' WHERE id = ? AND status = 'pending' AND user_id = ?`, then settle the notification.
  3. `accept`: the `PlanBusyError` guards; read how many of the caller's days would replace a row on the shared plan; then **one `runBatch`**.
     Every statement of it carries the same guard predicate **G** - the caller's membership row is still `pending` and theirs, **the caller holds no
     accepted row on a plan they do not own**, the invited plan's owner is still a member of the workspace (`stillInWorkspace` over `vacayPlans.ownerUserId`, as is the invitee's own term over `vacayPlanMembers.userId`) and still holds no accepted row on a plan
     they do not own, and the caller's own plan still has **no accepted colleague at all** (the same predicate as the pre-read and `busyReason`) -
     written as `AND EXISTS (SELECT 1 FROM vacay_plan_members WHERE organization_id = ? AND id = ? AND user_id = ? AND status = 'pending')` and its
     companions, all tenant-filtered. A statement whose G fails changes nothing, so a cancel, a decline in another tab, a second accept by the same person, or the owner
     accepting elsewhere between the pre-read and the batch moves nothing. In this order, the membership change **last** so G holds
     throughout (`runBatch` is atomic only where the driver has `batch`, as D1 and the test harness do; its sequential fallback is not a guarantee, and no such driver exists in the repository today):
     (a) delete the caller's own pending invitations to colleagues, (b) delete the shared plan's rows of this person that collide by date,
     (c) `UPDATE vacay_entries SET plan_id = shared` for the person's rows on their own plan, (d) the same two statements for
     `vacay_user_years` keyed on `year`, (e) `INSERT ... ON CONFLICT (plan_id, user_id) DO NOTHING` the person's colour row
     (`firstUnusedSwatch` over the shared plan's colours, the owner's default counted as used when the owner has no row; when all ten swatches are in use it returns the **least-used** one, first in palette order on a tie, so an eleventh member is never refused or errored for want of a colour), (f)
     `UPDATE vacay_plan_members SET status = 'accepted' WHERE id = ? AND status = 'pending' AND user_id = ? AND NOT EXISTS (<G's other terms, including any other accepted row of this person>)`.
  4. After the batch, **re-read** the membership: if it is not `accepted`, answer `NotFoundError` (or the `PlanBusyError` that G failed on)
     and say nothing was moved. Then `recomputeCarryOver` for the moved person on the shared plan (the allowance spec's function; derived and
     idempotent, so a failed recompute is logged and the next write repairs it, like every entry write). Then settle the notifications and write
     one `invitation_cancelled` notification to each colleague whose pending invitation (a) deleted.
     Returns `{ movedEntries, replacedEntries, movedYears, replacedYears }`. The move reads only the person's **own** plan, so it is idempotent:
     two accept clicks at once cannot corrupt anything; the second sees a row that is no longer `pending` and gets `NotFoundError`.
- `leavePlan(scope, planId)` and the member case of `removePlanMember`: refuse the plan's owner; `ensurePlan(scope, userId)` for the
  destination (created **outside** the batch, so a failed batch may leave an empty own plan behind: harmless and idempotent, which is why the
  guarantee below is about rows); one `runBatch` whose every statement is conditional on the accepted row still existing: the same
  delete-then-update for entries and `vacay_user_years`, delete the person's `vacay_user_colours` row on the plan being left, and **last** delete
  the membership row. Then re-read, `recomputeCarryOver` on the destination, and the counts. Years with no stored allowance row on the
  destination take the destination's `default_entitlement_days`; explicit rows keep their values.
- **The move, precisely.** Every statement binds a fixed number of parameters whatever the number of rows (G has five or six tenant-filtered `EXISTS` terms, so the
  largest guarded statement binds roughly 25 to 35, under `MAX_BOUND_PARAMETERS = 100` of `src/server/repos/batch.ts`, which the harness enforces and a test
  pins), so neither the number of days nor the number of years needs chunking: a fixed number of statements (at most ten) however many rows move. The collision rule is **the moving row replaces the destination
  row** (Resolved assumption 4): a person cannot be away twice on one date, so what is lost is at most a kind, never a day, and the count is
  reported.
- **Notifications.** `invitePlanMemberFn` calls `notify()` when `changed`: `type: 'navigate'`, `scope: 'user'`, `actionUrl: '/vacay'`,
  `entityType: 'vacay_plan_member'`, `entityId` the membership id, `titleKey` / `bodyKey` the stored templates
  `notification.vacay.invited.title` / `.body`, `titleParams: { actorName }`. **Never a rendered sentence, never a plan name, never a date**
  (the module stores keys so a row written a year ago renders in the reader's language). `respondToPlanInviteFn` settles **every** unanswered
  `navigate` notification of this caller and this membership (a re-invite makes several), found by `listForEntity(scope, 'vacay_plan_member', membershipId)` (it filters on the entity only) narrowed in code to
  `recipientUserId === caller` and no response yet - never by a client-sent notification id - then `respondToNotification` per row, so the inbox rows show Accepted / Declined and
  leave the unread count. A write that succeeded never fails because the notification did: the failure is logged and swallowed, as the
  existing dispatch call sites do. `cancelPlanInvite` and the owner-removal write the matching `info` notification to the person
  (Phase 4) so a stale inbox row has an explanation next to it.

**Server functions.** `invitePlanMemberFn { planId, userId }`, `respondToPlanInviteFn { membershipId, response }`, `leavePlanFn { planId }`.
`loadVacayPlanFn` gains `invitations`: the viewer's own pending rows (membership id, inviter's name, and `busyReason: 'on-another-plan' |
'owns-shared-plan' | 'owner-away' | null` so the Accept button can say why it is inert).

**UI.** `InviteDialog` (owner), `InvitationAlert` directly under the page header at every width, "Go back to my own leave plan" with a confirmation
that names where the days go. See [UI/UX](#-uiux).

### Phase 3 (08-S8c) - log and clear a day for a colleague

- The three entry functions (`setVacayEntryFn`, `setVacayEntryRangeFn`, `clearVacayEntriesFn`) gain an optional `forUserId`; absent
  means the caller. The guarded functions take `forUserId` only (the optional `userId` of the repository input is removed; the dev seeder writes colleague days and colours directly through `vacayEntriesRepository` and `vacayUserColoursRepository`, so it needs no exemption and keeps its demo notes) (this
  replaces the year-grid spec's "owner only").
- The statement also carries the target's membership: the insert is `INSERT ... SELECT ... WHERE EXISTS` the target's accepted membership of that plan (or ownership), so a write racing the target's go-back or removal inserts nothing and is counted as skipped.
- For another person the kind is `vacation`, `half_day` or `remote` and **no note** is accepted: a colleague never creates health data on someone's
  behalf, and never creates a day they could not then undo.
- When the target is not the caller, `daysToWrite` (`src/lib/vacay/day-rules.ts`, pure) takes the target's **protected dates** and returns the reason
  `'private'` for them. The guard lives **in the statement** too: the write's `ON CONFLICT DO UPDATE` carries `WHERE vacay_entries.kind NOT IN
('sick','other')` and the clear carries `AND kind NOT IN ('sick','other')`, so a sick day the target logs between the read and the write is never
  overwritten or cleared; `skippedPrivate` is counted from what the statement actually skipped, not from the earlier read. The picker shows such
  a day as "Away - only {name} can change this day".
- One `notify()` per call to the person concerned, only when that person is not the caller, never one per day: `type: 'info'`,
  `notification.vacay.days_logged` / `.days_cleared`, `bodyParams: { count, days }` (`count` picks the plural form, `days` is the number printed) and `titleParams: { actorName }`, `actionUrl: '/vacay?year=<year>'`.
  Ten single-day taps are ten inbox rows; this is accepted (the actor is named, the person was away from the screen, and collapsing rows is a
  follow-up if it proves noisy).
- Allowance of another person stays owner-only; there is no control for it in this stage.
- **UI.** `SubjectSelector` in the grid header, offered to anyone who may write for another person and hidden in the owner's company mode: their own
  name by default, an accepted colleague when chosen; it changes the cell preview colour and every cell's accessible name, so it is never
  ambiguous whose day a tap takes; choosing a subject does not refetch the year; it resets to "Myself" on a year change, on a reload, on entering company mode and when the
  chosen colleague disappears from a re-read (announced).

### Phase 4 (08-S8d) - the owner manages the plan's people

- `removePlanMember(scope, membershipId)` (accepted member: the same move as leaving; owner's row refused) writes the `removed` `info`
  notification to the person. `cancelPlanInvite(scope, membershipId)` (a `pending` or `declined` row: delete it, nothing moves) writes the
  `invitation_cancelled` `info` notification for a `pending` row only. A declined person can be invited again from the row ("Invite again").
- A member opens `plan-settings-dialog.tsx` **read-only**: values render as text, not faded `disabled` controls, with a line saying only the
  owner changes them; the hand-off item about `getPlanOverview`'s row-less fallback is closed by publishing no other person's allowance figures to
  anyone but the owner, so the fallback stays reachable only through the owner's view.
- **A plan whose owner left the workspace** stays usable: `ownerPresent` is false, owner-only actions answer `PlanOwnerOnlyError`, accepted
  members can still log, log for each other and go back to their own plans; the members' screen says the owner has left and that going back
  keeps every day. No reassignment (a product decision, out of scope). This makes the erasure spec's collision of two anonymised owners on
  `vacay_plans_org_owner_unq` reachable; that spec owns it and no erasure-registry row changes here.
- A departed accepted member is invisible and cannot be written for or removed (`NotFoundError`; the rows stay). **If an administrator re-adds
  that person later they regain their place on the plan and their right to write on it** - there is no owner action in between because there is
  nothing to show. This is documented in Risks and pinned by a test (Resolved assumption 21).

### Phase 5 (08-S8e) - pick your own colour

- `src/lib/vacay/swatches.ts` is the one owner of the palette: ten swatches, each with an id, a **localised name** and a hex. Every swatch reaches
  4.5:1 against the ink `inkOn` (`src/routes/_app/-lib/tone.ts`) picks for it (no colour can reach 4.5:1 against both inks, the worst-case ceiling
  there is about 4.08:1), and at least 3:1 against the surface in both themes (`--color-surface` `#ffffff` and `#1a1a18`), because a Leave fill has
  no other cue. As a hint only (the test is the rule): the feasible bands are roughly relative luminance 0.21-0.30 with the dark ink, or 0.13-0.17
  with the light ink. `isSelectableSwatch(colour, takenByOthers)` is used by the repository to refuse a colour that is not in the palette (the
  stored value is also accepted, so a seeded colour never traps its owner) or is another accepted member's.
- `setUserColour(scope, planId, userId, colour)` becomes: the caller's own row, on their active plan, `requirePlanActor`; there is no `userId`
  input on `setPlanColourFn`.
- This is the one ticket that can slip behind the others without breaking the stage's promise, because 08-S8b already gives every joiner an
  unused colour.

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
| Show colleagues each other's allowance                                | The screen needs only used days; the allowance spec reads a balance as the person's and the owner's only.                                                                      |
| Let the owner see unmasked `sick` days                                | A leave plan is personal; the workspace role gives no override and health data is not widened by a spec (Resolved assumption 6).                                               |
| Edit `removeMember` to clean up plans                                 | People leave through Better Auth, so it would never run; `src/server/auth` is a risk-high path.                                                                                |
| A `RadioGroup` for the swatches                                       | Its arrow keys select as they move, which would write a colour on every keypress; the picker is a roving group of toggle buttons that commit on Enter or Space.                |

## 📝 Architecture

- **One concept, one owner (`docs/SPEC.md` §8).** Which plan a person is on: `resolveActivePlan` / `activePlanIdOf`. Moving a person's data
  between plans: `movePersonalData`. What another viewer may see of a person's day or figures: `getPlanOverview` and `countEntriesByKind`. The
  palette: `src/lib/vacay/swatches.ts`. Which days a stranger may write: `daysToWrite` and the statement guard. All SQL:
  `src/server/repos/vacay.ts`. Components render and own no rule; server functions validate, forward and own no rule.
- **Seams.** Route loader: `loadVacayPlanFn`, then `Promise.all([loadVacayAllowance, loadVacayGridFn])` with its plan id. A write goes
  component, server function, `appScope()`, repository (guard, batch, recompute) and then `notify()` in the server function when the repository reports `changed`, then `router.invalidate()` so every figure
  is the database's. `components/ui` never fetches or imports `server/`.
- **Cloudflare cost.** Join and leave are one batch of at most ten statements plus a handful of guard reads and the recompute (about 25 queries
  in all, well inside the Worker's subrequest budget); nothing is queued and no Durable Object is added. A notification is one insert.
- **Follow-up for another stage.** `loadVacay`, `VacayPayload` and `VacayEntryRow` in `library.ts` have no caller after this stage; the
  library stage deletes them (a test already fails if one appears).

## 📝 Data Model

**No schema change and no migration.** Written: `vacay_plan_members` (`status`), `vacay_entries` and `vacay_user_years` (`plan_id` only),
`vacay_user_colours`, and `notifications` (inserts; `entity_type = 'vacay_plan_member'` is a free-text column). The unique keys
`vacay_entries_plan_user_date_unq`, `vacay_user_years_plan_user_year_unq`, `vacay_plan_members_plan_user_unq`, `vacay_user_colours_plan_user_unq` and
`vacay_plans_org_owner_unq` are what the replace rule, the one-row-per-person rule, the colour insert's `ON CONFLICT` and the one-plan-per-owner
rule lean on. `vacay_years` is read by no grid code and nothing moves with it. Nothing records who wrote a day on someone's behalf; the
notification to the person concerned (`senderUserId`) is the only trace, by design (Resolved assumption 7).

## 📝 API Contracts

All `createServerFn`, Zod v4 `z.strictObject()` inputs, ids as the repository's `idSchema`, dates as `dateSchema`.

| Function                | Method | Input                                                  | Returns / refuses                                                                                     |
| ----------------------- | ------ | ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `loadVacayPlanFn`       | GET    | `{ year }`                                             | The narrowed payload above; no plan id in                                                             |
| `invitePlanMemberFn`    | POST   | `{ planId, userId }` (a **workspace member's** id)     | `{ status: 'pending' }`; `PlanOwnerOnlyError`, `NotFoundError`, `AlreadyOnPlanError`, `PlanBusyError` |
| `respondToPlanInviteFn` | POST   | `{ membershipId, response: 'accepted' \| 'declined' }` | Move counts; `NotFoundError`, `PlanBusyError`                                                         |
| `leavePlanFn`           | POST   | `{ planId }`                                           | Move counts; `NotFoundError`                                                                          |
| `removePlanMemberFn`    | POST   | `{ membershipId }`                                     | Move counts; `PlanOwnerOnlyError`, `NotFoundError`                                                    |
| `cancelPlanInviteFn`    | POST   | `{ membershipId }`                                     | `{ ok: true }`                                                                                        |
| `setPlanColourFn`       | POST   | `{ planId, colour }` (no `userId`)                     | The colour; `NotFoundError`, `ColourRefusedError`                                                     |
| the three entry fns     | POST   | the year-grid spec's inputs plus optional `forUserId`  | The counts it returns plus `skippedPrivate`                                                           |

`invitePlanMemberFn` takes a workspace member only; bringing in a stranger is the administration stage's invitation system and this stage
links to it (the dialog's empty state) rather than growing a second one.

## 📝 UI/UX

### The members panel (08-S8a read-only, completed in 08-S8b and 08-S8d)

- **Where.** `PlanMembers` takes the "Travellers" panel's place (`Panel` from `-ui/scaffold.tsx`, whose heading is an `h2`). Each row: swatch,
  `Avatar`, name (with "(you)" on the viewer's own row), used days with a plural label ("{value} days used"), and the status as a `Badge`
  **with text, never tone alone** ("Invited" muted, "Declined" in a measured muted ink with no strike-through, accepted shows none). The owner's
  row says "Owner". At 360px the panel sits **above** the grid, but the invitation and owner-left alerts sit directly **under the page header at
  every width**, above the aside, so an invitee arriving from the bell sees the question without scrolling.
- **Actions.** Owner only (08-S8b/d): "Invite a colleague" and a per-row overflow menu whose `IconButton` is labelled "Actions for {name}" (Remove
  / Cancel invitation / Invite again). The viewer's own accepted non-owner row (08-S8b): "Go back to my own leave plan" whose dialog is titled
  and has two buttons (all keys below), names where the days go, says which days ("every year you have days"), and after a move that replaced rows
  reports how many.
- **Focus and announcements.** An action that removes its own control names where focus goes, and its result is announced through the app toaster
  (`AppToaster`), a live region that survives `router.invalidate()` - never a region inside an alert that unmounts:

  | After                  | Focus goes to                                                                                      |
  | ---------------------- | -------------------------------------------------------------------------------------------------- |
  | Accept, Go back        | the members panel heading (`h2`, `tabIndex={-1}`)                                                  |
  | Decline                | the next invitation's Accept button, otherwise the members panel heading                           |
  | Remove, Cancel         | the next row's menu trigger, otherwise the previous one, otherwise the "Invite a colleague" button |
  | A dialog closed by Esc | its trigger                                                                                        |

- **Honest failure.** A failed Accept / Go back / Remove shows its failure line only **after the `router.invalidate()` re-read**; if the re-read
  shows the move happened (a lost response), it shows the success line instead. "Nothing was moved" is therefore always true when it is shown. If the re-read itself fails, the line is `vacay.members.checkFailed`. Cancel and Clear declined invitation take `loading` and `disabled` and follow the same re-read rule, so a second tap never reports a failure for an invitation that was in fact cancelled. An invite that fails with `AlreadyOnPlanError` shows `vacay.invite.alreadyOn`, not "Try again".
  While Accept or Decline is in flight both buttons of the alert take `loading` and `disabled`; so do the go-back and remove confirm buttons.
- **States.** _Alone_ (on `--color-surface-2`): "Only you on this leave plan", one line on what sharing does and the invite action beside it.
  _Skeleton:_ three rows at the settled height. _Error:_ a failed invite keeps the dialog open with the person selected and an
  `Alert tone="danger"` in the dialog; a failed colour shows `role="alert"` copy under the swatches.
- **Invite dialog.** A `Combobox` with a visible label over workspace members not already on the plan (avatar and name; declined people are
  absent, they are re-invited from their row), the effect in one line before it is sent, focus returns to the trigger; a full-height sheet at
  360px. When there is nobody to invite it says one of three things: "You are the only person in this workspace" (to an administrator with the link to workspace invitations, `emptyAloneAdmin`; to anyone else the ask-an-administrator line, `emptyAlone`) or "Everyone in this workspace is already on this leave plan".
- **Invitation alert (invitee).** A persistent region (`Alert` with its `role="status"` overridden to `region` **and its `aria-live` removed** - `src/components/ui/alert.tsx` sets both - plus `aria-labelledby`, so a
  re-render does not re-announce it) directly under the page header, naming the inviter, with Accept and Decline. When `busyReason` is set Accept
  is `aria-disabled` (never `disabled` or `inert`) with `aria-describedby` on the visible reason. The text states what the move does: your logged
  days and allowance come along and go back if you leave, years without your own allowance use this plan's default, the plan's owner can see and
  change your allowance while you are on it, and colleagues see your dates but not the reason for a sick day. With several invitations each is a
  group labelled by its title. Declining collapses it and it does not return on reload.
- **Subject selector (08-S8c).** In the grid header beside the year switcher, a labelled `Select` ("Logging days for"), shown only to people who
  may write for another and hidden in company mode; at 360px it has its own row under the header controls. Its change is announced politely through
  `vacay.status.subject`. A colleague's masked day follows the merged blocked-cell pattern: `aria-disabled`, never native `disabled`, its reason
  visible in the bottom region, tied with `aria-describedby` and written to the polite live region.
- **Cell and picker when a colleague is the subject.** The cell's accessible name is the merged composition `vacay.day.name` + `formatList` with the
  **subject's part first**, then company holiday, trip and the others (the viewer's own entry becomes one of the others); the fill, the kind cue,
  the picker's `aria-pressed` and "Clear this day" reflect the subject's entry. The picker title names the person, the cost lines, the status line
  and the range bar's left-out line use the third-person keys below and drop the viewer's own days left. With a colleague selected the picker offers only vacation, half day and remote and no note field. **Who is away is not colour only:** the
  neutral marker of the year-grid spec stays, the accessible name gets an "Away: {names}" part built with `formatList`, and the picker lists the
  people visibly.
- **Colour picker (08-S8e).** A `Popover` of ten swatches in a labelled group, each a toggle button with a localised colour name; arrow keys move
  focus, **Enter or Space commits**, the popover stays open after a write, Escape closes it and returns focus to the trigger ("Your colour:
  {colour}"). A taken swatch is `aria-disabled` (never native `disabled`, which would drop it from the roving order) and stays reachable by arrows, and the chosen swatch takes focus when the popover opens; it shows the owner's initials on it, with "{colour}, used by {name}" as its accessible name (a hover
  title is not enough). The chosen swatch has a check glyph in the `inkOn` ink plus a ring, not the `Radio` primitive's `bg-brand`. Swatches are
  at least 24x24 CSS px, and 44px under `pointer: coarse`.
- **Read-only settings (08-S8d).** Values render as text, `vacay.settings.readOnly` is the dialog's `aria-describedby`.
- **Motion.** Rows enter on 200ms opacity and 4px translate on `--ease-out-quint`, staggered 24ms, capped at eight; the popover uses the
  primitive's own transition; `prefers-reduced-motion: reduce` collapses to opacity.

## 📝 Visual change expected

Route `/vacay` only, light and dark, desktop and mobile. 08-S8a: the "Travellers" panel becomes the members panel; the grid shows a second
person's days in their colour. 08-S8b: an invitation alert under the header for an invitee; the invite dialog; the go-back dialog; the
toasts. 08-S8c: the subject selector in the header and the subject-coloured preview. 08-S8d: the overflow menu, the read-only settings dialog and
the owner-left alert. 08-S8e: the colour popover. `/notifications` and the bell: five new stored sentences render. No other route changes.
Frames per `docs/plans/12-verification-protocol.md`: the merged grid with two travellers, the invitation alert, the invite dialog open, and
the subject selector open, captured with `scripts/visual/capture.mjs` at 360x800, 1280x900 and 2560x1440, light and dark.

## 📝 Copy

Every key lands in all 23 locales per the `i18n-messages` skill (`modules.ts`; the stored notification templates in `shell.ts`, whose rule is
that a row stores keys and params, **never a date or a plan name**). Plural-bearing keys are marked **(plural on `count`)** and use the catalogue's
`one` / `other` shape with `{value}` pre-formatted by `formatNumber`; dates are never in a stored row and elsewhere render through
`formatDateRange`. The removed `vacay.travellers.*` keys leave all 23 locales with this change. A plan is named by its owner, in a whole key a
translator can inflect; the words "fuse", "merge" and "dissolve" and a bare "leave" for the exit appear in no key.

| Key                                                       | English text                                                                                                                                                                                                                                                                                                                           |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vacay.members.title`                                     | People on this leave plan                                                                                                                                                                                                                                                                                                              |
| `vacay.members.alone`                                     | Only you on this leave plan                                                                                                                                                                                                                                                                                                            |
| `vacay.members.aloneHint`                                 | Invite a colleague to see each other's days in one year and to log days for each other.                                                                                                                                                                                                                                                |
| `vacay.members.you`                                       | {name} (you)                                                                                                                                                                                                                                                                                                                           |
| `vacay.members.owner`                                     | Owner                                                                                                                                                                                                                                                                                                                                  |
| `vacay.members.usedDays`                                  | {value} days used (plural on `count`)                                                                                                                                                                                                                                                                                                  |
| `vacay.members.status.pending` / `.declined`              | Invited / Declined                                                                                                                                                                                                                                                                                                                     |
| `vacay.members.actions`                                   | Actions for {name}                                                                                                                                                                                                                                                                                                                     |
| `vacay.members.remove` / `.removeTitle`                   | Remove from leave plan / Remove {name}?                                                                                                                                                                                                                                                                                                |
| `vacay.members.removeConfirm`                             | Their logged days and allowance go back to their own leave plan. Nothing is lost.                                                                                                                                                                                                                                                      |
| `vacay.members.removed` / `.removeFailed`                 | {name} is back on their own leave plan. / Nothing was changed. Try again.                                                                                                                                                                                                                                                              |
| `vacay.members.removedReplaced`                           | {count} of their days replaced days already on their own leave plan. (plural on `count`)                                                                                                                                                                                                                                               |
| `vacay.members.checkFailed`                               | We could not check where your days are. Reload this page to see.                                                                                                                                                                                                                                                                       |
| `vacay.members.cancelInvite` / `.clearDeclined`           | Cancel invitation / Clear declined invitation                                                                                                                                                                                                                                                                                          |
| `vacay.members.inviteAgain`                               | Invite again                                                                                                                                                                                                                                                                                                                           |
| `vacay.members.inviteCancelled` / `.cancelFailed`         | Invitation to {name} cancelled. / Nothing was changed. Try again.                                                                                                                                                                                                                                                                      |
| `vacay.members.goBack`                                    | Go back to my own leave plan                                                                                                                                                                                                                                                                                                           |
| `vacay.members.goBackTitle`                               | Go back to your own leave plan?                                                                                                                                                                                                                                                                                                        |
| `vacay.members.goBackConfirm`                             | Your logged days and your allowance, in every year, move back to your own leave plan. Nothing is lost. You will no longer see your colleagues' days there.                                                                                                                                                                             |
| `vacay.members.goBackAction` / `.goBackCancel`            | Go back / Stay on this leave plan                                                                                                                                                                                                                                                                                                      |
| `vacay.members.goBackDone`                                | You are back on your own leave plan.                                                                                                                                                                                                                                                                                                   |
| `vacay.members.goBackReplaced`                            | {count} days already on your own leave plan were replaced by the ones you brought back. (plural on `count`)                                                                                                                                                                                                                            |
| `vacay.members.goBackFailed`                              | Nothing was moved. Your days are where they were. Try again.                                                                                                                                                                                                                                                                           |
| `vacay.members.ownerLeft`                                 | The owner is no longer in this workspace. You can keep logging, or go back to your own leave plan; no day is lost.                                                                                                                                                                                                                     |
| `vacay.invite.action` / `.title`                          | Invite a colleague / Invite someone to this leave plan                                                                                                                                                                                                                                                                                 |
| `vacay.invite.label`                                      | Colleague                                                                                                                                                                                                                                                                                                                              |
| `vacay.invite.effect`                                     | They will see your dates, not the reason for a sick day. They choose whether to join.                                                                                                                                                                                                                                                  |
| `vacay.invite.emptyAlone`                                 | You are the only person in this workspace. Ask a workspace administrator to invite your colleagues first.                                                                                                                                                                                                                              |
| `vacay.invite.emptyAloneAdmin`                            | You are the only person in this workspace. Invite your colleagues to the workspace first.                                                                                                                                                                                                                                              |
| `vacay.invite.alreadyOn`                                  | {name} is already on this leave plan.                                                                                                                                                                                                                                                                                                  |
| `vacay.invite.emptyAllOn`                                 | Everyone in this workspace is already on this leave plan.                                                                                                                                                                                                                                                                              |
| `vacay.invite.send` / `.sent`                             | Send invitation / Invitation sent to {name}                                                                                                                                                                                                                                                                                            |
| `vacay.invite.failed`                                     | The invitation was not sent. Try again.                                                                                                                                                                                                                                                                                                |
| `vacay.invite.ownerAway`                                  | You are on the leave plan of {name}, so you cannot invite anyone to your own. Go back first.                                                                                                                                                                                                                                           |
| `vacay.invitation.title`                                  | {name} invited you to share their leave plan                                                                                                                                                                                                                                                                                           |
| `vacay.invitation.effect`                                 | Your logged days and your allowance come with you. If you go back to your own leave plan, they come back with you. Years without your own allowance use {value} days here (plural on `count`). The owner can see and change your allowance while you are on this leave plan. Colleagues see your dates, not the reason for a sick day. |
| `vacay.invitation.accept` / `.decline`                    | Accept / Decline                                                                                                                                                                                                                                                                                                                       |
| `vacay.invitation.busy.onAnother`                         | You are already on the leave plan of {name}. Go back to your own leave plan first.                                                                                                                                                                                                                                                     |
| `vacay.invitation.busy.ownsShared`                        | You share your own leave plan with colleagues. They need to go back to their own leave plans first.                                                                                                                                                                                                                                    |
| `vacay.invitation.busy.ownerAway`                         | {name} is on another leave plan right now, so this invitation cannot be accepted.                                                                                                                                                                                                                                                      |
| `vacay.invitation.accepted` / `.acceptedReplaced`         | You joined the leave plan of {name}. / {count} of your days replaced days already on it. (plural on `count`)                                                                                                                                                                                                                           |
| `vacay.invitation.declined`                               | Invitation declined.                                                                                                                                                                                                                                                                                                                   |
| `vacay.invitation.acceptFailed` / `.declineFailed`        | Nothing changed. Try again.                                                                                                                                                                                                                                                                                                            |
| `vacay.subject.label` / `.self`                           | Logging days for / Myself                                                                                                                                                                                                                                                                                                              |
| `vacay.subject.private`                                   | Away - only {name} can change this day                                                                                                                                                                                                                                                                                                 |
| `vacay.subject.skipped`                                   | {count} days were left as they were because only {name} can change them. (plural on `count`)                                                                                                                                                                                                                                           |
| `vacay.status.subject` / `.subjectSelf`                   | Now logging days for {name}. / Now logging your own days.                                                                                                                                                                                                                                                                              |
| `vacay.grid.name.for`                                     | The year grid, marking {name}'s time off                                                                                                                                                                                                                                                                                               |
| `vacay.picker.titleFor`                                   | Mark {date} for {name}                                                                                                                                                                                                                                                                                                                 |
| `vacay.kind.costFor.*`                                    | Uses {value} day of {name}'s allowance (plural on `count`; one key each for vacation, half day and remote - the only kinds offered for another person)                                                                                                                                                                                 |
| `vacay.status.markedFor` / `.markedRangeFor`              | Marked for {name}: {kind}, {date}. / Marked for {name}: {kind}, {dates}. ({dates} formatted by `formatDateRange`; no days-left line)                                                                                                                                                                                                   |
| `vacay.range.skippedPrivate`                              | {count} days were left out because only {name} can change them. (plural on `count`)                                                                                                                                                                                                                                                    |
| `vacay.day.away`                                          | Away: {names}                                                                                                                                                                                                                                                                                                                          |
| `vacay.colour.label` / `.trigger`                         | Your colour / Your colour: {colour}                                                                                                                                                                                                                                                                                                    |
| `vacay.colour.name.<id>`                                  | One localised name per palette entry (ten keys)                                                                                                                                                                                                                                                                                        |
| `vacay.colour.taken`                                      | {colour}, used by {name}                                                                                                                                                                                                                                                                                                               |
| `vacay.colour.saved` / `.failed`                          | Colour changed. / The colour was not changed. Try again.                                                                                                                                                                                                                                                                               |
| `vacay.settings.readOnly`                                 | Only the owner of this leave plan can change these settings.                                                                                                                                                                                                                                                                           |
| `notification.vacay.invited.title` / `.body`              | {actorName} invited you to share their leave plan / Open Vacay to accept or decline.                                                                                                                                                                                                                                                   |
| `notification.vacay.days_logged.title` / `.body`          | {actorName} logged days for you / {days} days were added to your leave plan. Check your allowance in Vacay. (stored `{ count, days }`: `count` picks the plural form, `days` is the number shown)                                                                                                                                      |
| `notification.vacay.days_cleared.title` / `.body`         | {actorName} cleared days for you / {days} days were cleared from your leave plan. (stored `{ count, days }`)                                                                                                                                                                                                                           |
| `notification.vacay.invitation_cancelled.title` / `.body` | {actorName} withdrew the invitation to their leave plan / Your own leave plan is unchanged.                                                                                                                                                                                                                                            |
| `notification.vacay.removed.title` / `.body`              | {actorName} removed you from their leave plan / Your days are back on your own leave plan. Nothing was lost.                                                                                                                                                                                                                           |

## 📝 Edge Cases & Failure Scenarios

- **Accept or go-back fails mid-way.** The batch is atomic on D1; rows are unchanged and the failure line says so only after the re-read has
  confirmed it. The destination plan of a go-back may exist empty afterwards (it is created outside the batch); harmless and idempotent.
- **Accept races a cancel, a decline in another tab, or the owner accepting elsewhere.** Every statement carries the guard predicate G, so the
  loser moves nothing; the post-batch re-read answers `NotFoundError` / `PlanBusyError`; nobody ends up with days on a plan they are not a member of.
- **Two accept clicks, or two invitations accepted at once from two tabs.** The second sees a row that is no longer `pending`, or G's "holds no accepted row elsewhere" term fails: `NotFoundError` / `PlanBusyError('on-another-plan')`, nothing moves, and the UI shows the success the re-read proves for the first. A person is never accepted on two plans.
- **An owner whose only colleague left the workspace** cannot join another plan until that colleague is back or has gone back (the predicate counts accepted colleagues whether or not they are still in the workspace, so a plan with a member is never dormant); an accepted limitation, listed in Risks; the owner-visible "no longer in this workspace" row with a delete-only removal is the follow-up `afk-to-tickets` files with this spec's parent issue.
- **An invitation from an owner who has left the workspace** cannot be accepted (`PlanBusyError('owner-away')`, with its visible reason).
- **Same date on both plans.** Unreachable through the product (the active-plan write rule); if it exists anyway the moving row replaces the
  destination row and the count is reported.
- **All ten swatches are in use when someone is accepted.** `firstUnusedSwatch` returns the least-used swatch (palette order on a tie), so the
  eleventh member shares a colour with someone and can change it in the picker; accept never fails for want of a colour.
- **A person invited to two plans.** Both stay pending; accepting the second while on the first is `PlanBusyError('on-another-plan')`.
- **An owner with colleagues is invited elsewhere.** The invitation exists; accepting is `PlanBusyError('owns-shared-plan')` and the alert says
  why. **A solo owner may accept**: their own pending invitations are deleted in the same batch and each of those colleagues gets an
  `invitation_cancelled` notice; their own plan stays dormant, nothing is deleted, and from then on `invitePlanMember` on it answers
  `PlanBusyError('owner-away')` until they go back.
- **Re-invite.** After a decline, a removal or a go-back it works; a pending row is left alone and no second notification is written.
- **Workspace departures.** A departed member is invisible and cannot be written for; the owner leaving leaves the plan usable (Phase 4).
  A returning person finds their rows and their place (Risks). A departed owner's dormant plan is untouched.
- **Years with no allowance row** take the destination plan's default; the accept alert states it (going back lands on the person's own plan, whose default is their own setting).
- **A masked day.** A colleague cannot overwrite or clear a `sick` / `other` day of someone else, even one logged a moment ago; the result
  counts and says it. A colleague cannot create one either.
- **A failed notification.** Logged and swallowed; the write stands.
- **Stale grid.** A colleague's change appears on the next load or the person's next write (no live sync).
- **Forged ids.** A membership, plan or user id from another workspace is `NotFoundError` and writes nothing.

## ✅ Acceptance criteria

**08-S8a**

1. `loadVacayPlanFn` returns the viewer's active plan from the session and takes no plan id; `loadVacayGridFn` is re-guarded by
   `requirePlanActor` and computes `isOwner` and "company holidays on" from that plan; a member never receives the owner's controls.
2. Another person's `note` is never in any payload; their `sick` arrives as `other`; a balance of anyone other than the viewer carries
   `{ userId, usedDays }` unless the viewer is the plan's owner (full figures); pending and declined invitees receive no entries, balances or people;
   a person who left the workspace, and a user with entries but no accepted row, is in no list.
3. `getPlanOverview` and `countEntriesByKind` call `requirePlanActor` themselves; `countEntriesByKind` counts the masked kind.
4. A test fails if `loadVacay` is imported anywhere under `src/`, and `loadVacay`'s payload is masked too.
5. A write of one's own days to a plan that is not the viewer's active plan is refused.
6. The seeder still produces the demo workspace with its accepted members and the demo grid shows them; nothing imports `setPlanMemberStatus`.

**08-S8b**

7. The owner invites a workspace member; a user id from another workspace, the owner's own id and an already-accepted person are refused
   and write no row; a declined person returns to `pending` with one notification; a pending person changes nothing; an owner who is on another
   plan cannot invite (`PlanBusyError('owner-away')`).
8. The invitee finds a stored, key-based notification (`type: 'navigate'`, entity = the membership, no plan name, no date) in the inbox; its
   text renders in the reader's locale; answering on `/vacay` settles **every** unanswered row of that membership and leaves the unread count;
   the notification failing does not fail the invite.
9. Only the invitee can answer; the owner, another workspace member and another workspace's user get `NotFoundError`, and the row is
   unchanged (isolation test).
10. Accepting moves the invitee's entries and `vacay_user_years` onto the shared plan, assigns an unused swatch (the least-used one when all ten are taken; two accepts at the very same moment may pick the same swatch, which the picker then lets either person change, so the criterion is asserted for sequential accepts), flips the status last, deletes the
    caller's own pending invitations (notifying those colleagues), re-reads, and recomputes carry-over; `/vacay` then shows the shared plan for the
    invitee and for the owner, each in their own colour.
11. The three `PlanBusyError` cases refuse with their reason, move nothing, and the alert says why. A second accept by the same person from another tab, an owner whose colleague left the workspace, a cancel or a decline between the pre-read and
    the batch moves nothing (repository test).
12. Going back moves everything home in one batch with the membership change last; the owner cannot go back; a forced failure moves nothing;
    the confirmation names the destination; the same-date replace rule reports its count.

**08-S8c**

13. The owner and an accepted member can log, log a run and clear for any accepted member still in the workspace on the shared plan that is both
    their active plan; a pending, declined or departed person's target is refused, as is the call from a plan that is not the caller's active
    plan; allowance, company holidays and plan settings for another person stay owner-only.
14. For another person only `vacation`, `half_day` and `remote` are accepted and no note; a target's `sick` / `other` day is never overwritten or
    cleared by someone else - including one logged between the read and the write - and the result counts what the statement skipped; the person
    themself can.
15. One notification per call, not per day, and none when the target is the caller; the cell names whose day it is, in the subject's third person.

**08-S8d**

16. The owner removes an accepted member (the same move, counts reported, the person notified), cancels a pending invitation (the person
    notified), invites a declined person again; a member cannot; a forged membership id from another workspace is `NotFoundError`.
17. A member opens the settings read-only; with the owner out of the workspace, owner actions answer `PlanOwnerOnlyError`, members can still
    log and go back, and the screen says so. A person who leaves the workspace and is re-added regains their place; a test pins it.

**08-S8e**

18. Every swatch reaches 4.5:1 against the ink `inkOn` picks and 3:1 against the surface in both themes; the repository refuses a colour outside
    the palette that is not the stored one, or one another accepted member holds; there is no `userId` input; arrow keys never write.

**All tickets**

19. In A's scope against B's ids every new or changed repository function rejects with `NotFoundError` and B's `vacay_plan_members`,
    `vacay_user_colours`, `vacay_entries` and `vacay_user_years` counts are unchanged. The cases cover: inviting a user id that exists only in B's
    workspace, a go-back in A's scope while B has entries on the same dates, `forUserId` set to a workspace-B user on all three entry functions, B's
    membership id on `respondToPlanInviteFn`, `removePlanMemberFn` and `cancelPlanInviteFn`, and B's plan id on `setPlanColourFn`.
20. Copy: every key in all 23 locales (parity test green); no hard-coded string; the exit action is never a bare "leave"; no stored row carries a
    date or a plan name; plural keys render "1 day" in every locale.
21. Keyboard end to end; WCAG 2.2 AA in both themes; status conveyed by text as well as tone; every action's focus target and announcement
    as in the table above; focus returns to the trigger of every dialog; reduced motion honoured; 360px through 2560px with no horizontal
    overflow in `ar`, `pl`, `vi`, `zh`; console silent; zero layout shift after settle on `chromium`.
22. The structural allowlist test lists exactly the functions with a production caller after each ticket.

## 📝 Risks & Impact Review

- **Risk label.** The security and tenancy reviewer reads this as `risk-high` for 08-S8a to 08-S8d and `risk-medium` for 08-S8e, no `security`
  label: no path of `SDLC.md` § Risk here is touched, but `SDLC.md` counts data scoping as risk-high and says to take the higher label when
  signals conflict. It is the first stage to show one person's leave data to another, to let one person write another's rows, and the only
  operation in the module that moves rows between two plans. Those tickets go to a security and tenancy reviewer before they are claimed and
  again on the diff.
- **A replaced kind.** The replace rule can lose a day's _kind_ (never a day) when a collision exists despite the write guard; reported.
- **A kind is a coarse trace.** There is no "written by" column; the notification to the person concerned is the only record that a colleague
  changed their days. Adding an audit row is a follow-up if review wants one.
- **A plan whose only colleague left the workspace stays "occupied".** The accept guard counts accepted colleagues whether or not they are still in the workspace, so the owner cannot join another plan until that colleague is back or has gone back; the alternative (counting only present colleagues) would leave a dormant plan holding a member who returns. Pinned by a test; the owner-visible departed row is the follow-up, as for the re-added member below.
- **Re-adding a departed member restores their place.** If an administrator re-adds a person who left the workspace, they regain their accepted
  place and their right to write on the plan, and the owner had no action in between. Accepted as the precedent for orphaned rows; pinned by a
  test; an owner-visible "no longer in this workspace" row with a lossless removal is the follow-up if this proves wrong.
- **`loadVacay` stays exported.** It is masked at the repository and a test pins that nothing imports it; deleting it is the library stage's.
- **Erasure.** A departed owner's plan, kept, makes two anonymised owners colliding on `vacay_plans_org_owner_unq` reachable (the erasure spec
  records the collision); no registry row changes here.
- **Existing accepted members at deploy.** Production should hold none (only the dev seeder wrote accepted non-owner rows); if any exist,
  their days on their own plan stop showing under the active-plan loader. The seeder's demo members are unaffected (their rows are on the
  owner's plan).
- **Backward compatibility.** Additive: new exports and functions; `setPlanMemberStatus` loses its export (no production caller);
  `invitePlanMember`'s return type gains `changed`; `getPlanOverview`'s balance type becomes a union (the full variant is unchanged).
- **Not checkable from this run.** The colours of the ten swatches (the test fixes the rule); atomicity of the guard predicate under two truly
  concurrent requests on real D1 (the batch is one transaction, and the post-batch re-read does not depend on it); how the inbox renders a
  `navigate` row with a response badge on a phone.

### Out of scope

- Live sync of a colleague's change (a future stage files the binding through the foundations wave rather than editing `worker.ts` and
  `wrangler.jsonc`); a re-read on window focus.
- Email for an invitation: `notify()` consults no preference, and a member-addressed event in `dispatch.ts` is a follow-up; no preference
  switch is added for it (a switch that governs nothing is a placeholder, `docs/SPEC.md` §7.5). Telling the inviter that the answer arrived.
- Reassigning a plan whose owner left; inviting someone who is not yet in the workspace; editing another person's allowance in the UI;
  letting a colleague see a `sick` kind (an opt-in is a legal question about health data, a person's decision); collapsing many "days logged" rows.
- Public holidays, holiday calendars (the year-grid spec's follow-up).

### Reference-row disposition

`ADD-04` partial -> **done** with these residues stated in the PR: no live sync (re-read on invalidation), in-app only.

## 📋 Phasing

| Phase | Ticket | Slice a person can see work                                                                                   | Blocked by                             |
| ----- | ------ | ------------------------------------------------------------------------------------------------------------- | -------------------------------------- |
| 1     | 08-S8a | The plan you are on, its people and their dates (never their reasons) on the grid, a seeded colleague visible | 08-S1a, 08-S5b, 08-S5c, 08-S5e, 08-S5f |
| 2     | 08-S8b | A colleague is invited, told, accepts, appears with their own colour, and can go back taking every day        | 08-S8a, 08-S1b                         |
| 3     | 08-S8c | Either person logs and clears a day for the other and the other is told                                       | 08-S8b, 08-S5c                         |
| 4     | 08-S8d | The owner removes or cancels, a member reads the settings, a plan without its owner still works               | 08-S8c, 08-S1c, 08-S5d, 08-S5f         |
| 5     | 08-S8e | A person picks their own measured colour                                                                      | 08-S8d                                 |

08-S8c, 08-S8d and 08-S8e all edit `vacay.tsx`, `plan-members.tsx` and `modules.ts`, so they land in that order (each blocked by the one before) and the colour ticket, the one that can slip, is last. 08-S8a is also blocked by the year-grid ticket that adds trip windows to `loadVacayGridFn` (08-S5e), because it changes that function's input and 08-S8c composes the trip part into the cell name.

## 📋 Implementation Plan

### Phase 1 - the plan you are on (08-S8a)

1. `resolveActivePlan`, `activePlanIdOf`, the guarded and narrowed `getPlanOverview` / `countEntriesByKind`, the own-write active-plan rule; tests.
2. `loadVacayPlanFn`, the grid function's plan id, the route loader; tests.
3. `PlanMembers` (read-only), copy in 23 locales (removing `vacay.travellers.*`), `CONTEXT.md`, the seeder; `e2e/product-modules.spec.ts`.

### Phase 2 - join and leave (08-S8b)

1. `swatches.ts` `firstUnusedSwatch`; `movePersonalData`; guarded `invitePlanMember`, `respondToPlanInvite`, `leavePlan`; tests incl. isolation and races.
2. The three functions, the notifications and their settle; the `invitations` part of the payload; tests.
3. `InviteDialog`, `InvitationAlert`, the go-back dialog, toasts and focus; copy; e2e (keyboard-only accept and go back, asserting where focus lands).

### Phase 3 - log for a colleague (08-S8c)

1. The "for another person" rule, `daysToWrite`'s `'private'`, the statement guard, the notification; tests. 2. `forUserId` on the three functions.
2. `SubjectSelector`, the cell names and picker copy, e2e.

### Phase 4 - manage the people (08-S8d)

1. `removePlanMember`, `cancelPlanInvite`, re-invite, their notifications. 2. The read-only settings dialog, `ownerPresent` and its alert.
2. Row actions and confirmations, copy, tests, e2e (keyboard-only remove, asserting focus).

### Phase 5 - colour (08-S8e)

1. The palette and its contrast test. 2. Guarded `setUserColour` and `setPlanColourFn`. 3. `ColourPicker`, copy (ten names), e2e.

## Verification

- The gate in `validation.commands` (`.ai/agentic.config.json`) on every phase's last commit.
- Unit: `src/lib/vacay/__tests__/swatches.test.ts`; `src/routes/_app/-server/__tests__/vacay.test.ts`; `src/components/vacay/__tests__/`
  for `plan-members` (owner sees remove, a member does not; own row offers go-back; the confirmation names the destination; status is text),
  `invite-dialog` (people already on the plan are absent; a rejected invite keeps the selection; focus returns), `invitation-alert`,
  `subject-selector`, `colour-picker`.
- Repository: the cases above in `repositories.test.ts` and one `describe` per ticket in `tenant-isolation.test.ts`; the harness refuses a
  statement over `MAX_BOUND_PARAMETERS` and rolls a failed batch back, which the move tests use for the "forced failure moves nothing" case.
- Browser (ADR 0016: no baselines): `e2e/product-modules.spec.ts` asserts `/vacay?year=2026` answers, hydrates, is silent in the console and
  can be acted on. The invite-and-accept flow needs a workspace member who is not on the plan: the demo workspace seeds all three colleagues
  (`mika`, `jonas`, `priya`) as accepted, so the describe's setup returns `mika` to their own plan through the UI's own "Go back to my own leave plan" action (a browser test cannot call a repository function),
  invites as the owner, accepts as `mika` (the describe signs in as `mika` directly, as `trips-core.spec.ts` does, since `signIn` in `e2e/helpers/session.ts` is fixed to the demo user and helpers are reused, not edited; the 10-per-minute sign-in limit holds), sees both in the grid, logs for the other with the keyboard, goes back and finds the days home, and
  restores the seeded state afterwards by inviting and accepting again (days are restored; `mika`'s seeded colour is replaced by the next unused swatch, which the test does not assert). Writing describes are serial, `chromium` only, and restore what they change. Frames:
  `scripts/visual/capture.mjs` with `--state invite --click '[data-part="vacay-invite"]'` and `--state subject`.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                         | Applied default                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Why                                                                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The plan's live sync over named events                           | Deferred: re-read on invalidation plus the notification; a future stage files the binding through the foundations wave                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Applied default, verified in `wrangler.jsonc` / `src/server/worker.ts`: the only Durable Object is per trip and both files are shared paths no feature stage may claim.                                                                                       |
| 2   | Which plan an accepted member sees, and where the loader lives   | `resolveActivePlan` in the repository; a new `loadVacayPlanFn` in `-server/vacay.ts`; `loadVacay` not edited but masked through `getPlanOverview`; a test forbids importing it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Decided by software architect sub-agent (confidence high) and security and tenancy sub-agent (confidence medium): editing `library.ts` is the library stage's; narrowing at the one read closes the still-callable endpoint.                                  |
| 3   | Accepting: flip the status only, or move the days                | Move the invitee's entries and allowance rows onto the shared plan in one batch, mirror image of going back, through one `movePersonalData`; membership change last                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Decided by software architect (confidence medium-high) and product owner (confidence high) sub-agents: every read is by `plan_id`; flipping alone hides the joiner's year.                                                                                    |
| 4   | A same-date collision when moving                                | Prevent it (a personal write must target the person's active plan); if one exists the **moving row replaces the destination row** and the count is reported                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Decided by security and tenancy sub-agent (confidence medium); the architect (destination wins) and product owner (abort) disagreed; replace chosen as the one that never traps a traveller and keeps the row people were using.                              |
| 5   | How many plans, who may accept, who may leave                    | One accepted non-owner plan per person; an owner with accepted colleagues may be invited but not accept; a solo owner may accept (their pending invitations are deleted); the owner never goes back from their own plan                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Decided by all three sub-agents (security, architect, product owner); the solo-owner consequence added on panel round 1 (architect, product owner).                                                                                                           |
| 6   | What a colleague sees of another's day                           | `note` never; `sick` as `other`; used days for everyone; allowance figures to the person and the plan's owner only; pending/declined receive nothing; no role override on masking. An opt-in to show `sick` is not applied                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Decided by security and tenancy sub-agent (confidence high; allowance rule corrected on panel round 1 to match the allowance spec). Widening health data is a person's legal decision.                                                                        |
| 7   | Who may write for whom, and a trace                              | Owner and accepted members for any accepted member in the workspace, on the caller's and the target's active plan; masked days never overwritten; one notification per call to the person; allowance, company holidays, settings owner-only                                                                                                                                                                                                                                                                                                                                                                                                                                   | Decided by security and tenancy sub-agent (confidence medium): the plan promises either person can log for the other; `senderUserId` on the notification is the trace without a schema change.                                                                |
| 8   | Departed workspace members and a departed owner                  | Keep everything; resolve at read time; no edit to `members.ts` or `src/server/auth`; the owner leaving leaves the plan usable, no reassignment                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Decided by security and tenancy (confidence medium) and product owner sub-agents: people leave through Better Auth, not `removeMember`; the orphaned-journey precedent.                                                                                       |
| 9   | Notification type, channel, who is told                          | `notify()`, `type: 'navigate'`, in-app only; the invitation is marked answered on `/vacay`; the inviter is not notified of the answer; `info` notices for removal and withdrawal; no preference switch                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Decided by product owner sub-agent (confidence medium): `action` would get buttons that only record; `notify()` consults no matrix; verified in `notifications.ts`. The two notices added on panel round 1 (UX).                                              |
| 10  | Ticket cut                                                       | Five tickets: the read side, join and leave together, log for a colleague, manage the people, colour; accept never ships without going back                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Decided by product owner sub-agent (confidence medium), re-cut on panel round 1 (product owner): the first ticket carried nine criteria, a notification, the seeder and the 23 locales; the read side now lands alone in front of the security reviewer.      |
| 11  | Risk label                                                       | `risk-high` for the first four tickets, `risk-medium` for colour; no `security` label                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Decided by security and tenancy sub-agent (confidence medium): data scoping is risk-high in `SDLC.md`; the diff is where a missing filter would go unnoticed.                                                                                                 |
| 12  | Plan paths that no longer exist                                  | `e2e/product-modules.spec.ts`, no PNG baselines; `modules.ts` and `shell.ts` in 23 locales; seeder, `swatches.ts`, `day-rules.ts` and `CONTEXT.md` join the owned list                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Applied default: ADR 0016 and `docs/plans/12-verification-protocol.md`; the same departure the two earlier specs record.                                                                                                                                      |
| 13  | The exit action's name and the module's word                     | "Go back to my own leave plan"; "leave plan" throughout; no "fuse", "merge", "dissolve" or bare "leave" in copy                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Applied default (product owner and UX conditions): "leave" collides with leave as time off, a bare "plan" collides with the billing plan in the same inbox, and `CONTEXT.md` says "leave planner".                                                            |
| 14  | Years with no allowance row after a move                         | They take the destination plan's default; explicit rows keep their values; the accept alert says so                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Decided by software architect and product owner sub-agents: only years with no stored row anywhere are affected.                                                                                                                                              |
| 15  | The row-less balance fallback handed to this stage               | Closed by publishing no other person's allowance figures to anyone but the owner; the used-only variant needs no fallback                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Applied default: the payload's balance type is a union (full or `{ userId, usedDays }`).                                                                                                                                                                      |
| 16  | Name later stages by id in this spec?                            | No; only the earlier specs' tickets and this stage's own carry ids                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Applied default, verified in `.ai/scripts/backlog-status.mjs`: any stage id in a spec reads as that stage being specified.                                                                                                                                    |
| 17  | A plan whose owner is looking at another plan                    | Invite and accept refuse (`PlanBusyError('owner-away')`); accepting elsewhere deletes the caller's own pending invitations and tells those people; every statement of the accept batch carries the guard predicate                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Decided by software architect and product owner sub-agents on panel round 1: otherwise a colleague can be moved onto a plan nobody can manage.                                                                                                                |
| 18  | Can a colleague write `sick` or `other` for someone else         | No: only `vacation`, `half_day` and `remote`, and no note; a masked day cannot be overwritten, even one logged between the read and the write                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Decided by security and tenancy and product owner sub-agents on panel round 1: otherwise a colleague creates a health record they cannot see or undo.                                                                                                         |
| 19  | Race between accept and cancel / decline                         | Every statement of the batch is conditional on the pending row (guard G), the colour insert is `ON CONFLICT DO NOTHING`, the membership flip is last, and the function re-reads and answers honestly                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Decided by software architect and security and tenancy sub-agents on panel round 1: an `UPDATE` that matches nothing does not roll a batch back.                                                                                                              |
| 20  | Read guards and who may appear in a read                         | `getPlanOverview` and `countEntriesByKind` call `requirePlanActor`; entries, balances, colours and people are restricted to the owner and accepted members still in the workspace                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Decided by security and tenancy sub-agent on panel round 1 (the allowance spec requires the guard before another person's plan becomes visible).                                                                                                              |
| 21  | A departed member who is re-added                                | They regain their place and write right; documented in Risks and pinned by a test; an owner-visible departed row is a follow-up                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Decided by security and tenancy sub-agent on panel round 1 (its stated fallback): the lossless move for a non-member needs a plan owned by a non-member, which this stage does not create.                                                                    |
| 22  | How a plan is named in a sentence                                | By its owner (`{name}`); the stored name `'Vacay'` is shown nowhere and the invitation notification stores no plan name                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Decided by product owner and UX sub-agents on panel round 1: the stored default is untranslatable English in all 23 locales.                                                                                                                                  |
| 23  | Dates and plurals in stored notification rows                    | A stored row carries only the actor's name and a count; the destination is `actionUrl`; plural keys are marked in the Copy table                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Decided by UX sub-agent on panel round 1 (`src/lib/i18n/messages/en/shell.ts:28-34` forbids a writer-formatted date).                                                                                                                                         |
| 24  | Focus, announcement and failure rules for the new actions        | The focus table, the toast as the announcement channel, "failure only after the re-read", third-person grid and picker copy, the swatch group as toggle buttons with names                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Decided by accessibility and UX sub-agents on panel round 1: five actions remove the control that triggered them and the year-grid copy says "your" with a colleague selected.                                                                                |
| 25  | Who sees allowance, who sees the swatches' taken state           | Allowance: person and owner; a taken swatch shows initials and a name as text                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Decided by security and tenancy and accessibility sub-agents on panel round 1.                                                                                                                                                                                |
| 26  | Panel round 2 (all five specialists: approve with conditions)    | The conditions are applied in the commit that follows: 08-S5e among the blockers and the three later tickets serialised; guard G gains the "no accepted row elsewhere" term and counts a departed colleague; the write statements carry the target's membership; the picker offers three kinds for a colleague; the alert drops `aria-live`; a taken swatch is `aria-disabled`; the subject resets on company mode; `{count, days}` in stored bodies; check-failed copy                                                                                                                                                                                                       | Decided by product owner, software architect, security and tenancy, accessibility and UX sub-agents on panel round 2.                                                                                                                                         |
| 27  | Final panel verdicts                                             | Round 1: product owner, software architect, security and tenancy, accessibility, UX - each **approve with conditions**, all applied in the second commit. Round 2: product owner **approve with conditions** (confidence high), architect **approve with conditions** (high), security and tenancy **approve with conditions** (medium; approves unattended implementation as risk-high for 08-S8a to 08-S8d and risk-medium for 08-S8e once conditions are applied), accessibility **approve with conditions** (high), UX **approve with conditions** (high); every concrete condition applied, no specialist answered revise, no second repair round (the skill allows two) | Decided by the five specialist sub-agents (`afk-decide`, panel of `afk-plan-to-spec` § 5).                                                                                                                                                                    |
| 28  | Independent specification review of the PR (`om-auto-review-pr`) | Verdict **request changes** (one major, no blocker), resolved in the spec: with all ten swatches in use `firstUnusedSwatch` returns the least-used one, so an eleventh member is never refused. Minors applied: `stillInWorkspace` named as the membership test, the 100-parameter ceiling, the sequential-driver sentence, the `listForEntity` narrowing, the seeder's second ticket, a concurrent-accept swatch note, the e2e sign-in as `mika`, the notification seam, `CONTEXT.md` wording, numbering. Not applied: the simpler solo-owner accept (refuse until the owner's own invitations are cancelled)                                                                | Decided by an independent reviewer sub-agent (read-only), every finding checked against the code; the simpler accept was rejected because it makes a solo owner cancel invitations by hand before they can join a colleague, which the panel settled in row 5 |
