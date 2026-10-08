# Leave planner: set your allowance, carry the leftover, and the plan's own settings

| Field              | Value                                    |
| ------------------ | ---------------------------------------- |
| **Status**         | ready                                    |
| **Issue**          | none                                     |
| **Spec PR**        | none                                     |
| **Implementation** | none                                     |
| **Plan**           | 08-S1 (docs/plans/08-product-modules.md) |

## 📝 TLDR

Plan stage `08-S1` moves reference row `ADD-02` (the leave planner's allowance, carry-over and settings) towards `done`. The
leave planner (`/vacay`) shows a traveller's allowance, their used days and the days carried in from last year, and lets them
change none of it: the repository functions that would write an allowance or the plan's settings exist and no server function
reaches them. This stage adds the write half, as **three tickets that are each a full path from repository to screen**:

1. **08-S1a - set your allowance.** The "Days" tile of the allowance panel becomes an inline editor, behind a repository-level
   actor guard, with its copy in 23 locales and the glossary terms it introduces.
2. **08-S1b - the leftover follows the traveller.** Whole days left at the end of one year become the next year's
   carried-over figure, recomputed in the request that changes them; the "Carried" tile is editable only where it is an opening
   balance and is derived everywhere else.
3. **08-S1c - the plan's own settings.** A dialog with the carry-over switch and the default allowance, for the plan's owner.
   The three display switches (block weekends, public holidays, company holidays) move to `08-S5`, which owns the month grid
   that would honour them (Resolved assumption 14).

No schema change, no migration, no route added, no package added.

This spec describes the work that is **left** at HEAD (`ee99d50d`). It departs from the plan's stage block where the code the
plan cites has changed or a specialist found the plan wrong. Every departure is a row of the Resolved assumptions table.

## 📝 Problem Statement

What exists at HEAD, measured:

- **A read-only screen over a complete data layer.** `src/routes/_app/vacay.tsx` renders `loadVacay`
  (`src/routes/_app/-server/library.ts`). `src/server/repos/vacay.ts` exports `updatePlan`, `setEntitlement`, `setEntry`,
  `setEntryRange`, `removeEntry`, `addCompanyHoliday`, `addHolidayCalendar`, `invitePlanMember`, `setPlanMemberStatus` and
  `setUserColour`; `grep` finds no production caller of any of them (the dev seeder and the repository suites reach them).
- **A carried-over figure nothing maintains.** `vacay_user_years.carried_over_days` is a stored `integer NOT NULL` column
  (`src/server/db/schema.ts`, table `vacay_user_years`) and `getPlanOverview` reads it. Nothing computes it.
- **Half days make the leftover fractional.** `ENTRY_KIND_COST` in `vacay.ts` costs a `half_day` entry 0.5, while
  `entitlement_days` and `carried_over_days` are integers behind `>= 0` CHECKs. `setEntitlementInput` caps both at 365, so
  `365 + 365 - 0` is a legal leftover that the input schema refuses to store.
- **`vacay_years` is a table nobody reads.** `ensureYear` and `listYears` are reached by the dev seeder and the suites only.
  The plan's walk "from the earliest `vacay_years` row" would visit nothing in production. The data a walk needs is on
  `vacay_user_years` (entitlement, carried) and `vacay_entries` (used).
- **A row-less year shows the wrong carry.** `getPlanOverview` falls back to `row?.carriedOverDays ?? 0` and the plan's default
  allowance for a year the traveller has no row for, even when the year before has a leftover.
- **Two writers with no actor check.** `updatePlan` and `setEntitlement` resolve the plan with `requireById`, which proves the
  plan is in the caller's workspace and nothing more. `setEntitlementInput.userId` is a caller-supplied id with no foreign key
  (`userRef` is a bare `text` column), so any workspace member who knows a plan id could write an allowance row for any
  string, or flip another traveller's carry-over setting. `removeMember` leaves a departed member's `vacay_plan_members` row
  behind, so a plan-member row does not prove current workspace membership.
- **Three of the plan's switches change nothing on screen.** `grep` in `vacay.tsx` finds `carryOverEnabled` (the muted
  "Carried" tile) and nothing for `blockWeekends`, `holidaysEnabled` or `companyHolidaysEnabled`. A switch that does nothing is
  a placeholder (`docs/SPEC.md` §7.5); the month grid that would honour them is `08-S5`'s.
- **A word that already means something else.** `CONTEXT.md` defines **Entitlement** as a capability granted by the billing
  plan. The panel is labelled "Entitlement {year}" (`vacay.tsx`) and the plan names its new component `EntitlementPanel`. The
  leave figure is an **allowance** in everything new this stage writes; the existing repository names (`setEntitlement`,
  `entitlement_days`) stay. "Allowance", "carry-over" and "leave plan" are not in the glossary yet.
- **A week-start literal that no consumer reads.** `loadVacay` publishes `weekStartsOn: 1` and the screen hard-codes a
  Monday-first header. The week start is already a shipped setting (`organization_settings` / `user_settings`,
  `getEffectiveSettings`), so this stage adds no second one; wiring the grid to it is `08-S5`'s. Nothing here reads or writes it.
- **The screen is English.** `vacay.tsx` carries its copy as literals (`docs/SPEC.md` §9 bans that). This stage localises
  everything it writes or rewrites; the month grid, the legend and the traveller list are `08-S5`'s and stay as they are.

The reader this serves: a traveller who plans leave around their trips and needs the screen to say how many days they have,
not how many a seeder gave them. The reference behaviour is a plan that exists without being created by hand, an allowance
edited where it is read, used and remaining derived rather than stored, and leftover days carried into the following year
(`wiki: Vacay-Overview`); this stage gets there in planned.travel's own vocabulary.

## 📝 Proposed Solution

### What the stage owns and what it does not

| Owned (this stage writes it)                                                                                                                                                                       | Not owned (read only, or left alone)                                                                                                       |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/server/repos/vacay.ts` - edit: `requirePlanActor`, `requirePlanOwner`, `saveAllowance`, `getAllowance`, `recomputeCarryOver`, `listUserYearsForUser`, `updatePlanSettings`, two error classes | `src/server/db/schema.ts`, `drizzle/` - **no schema change, no migration**                                                                 |
| `src/lib/vacay/carry-over.ts` + `__tests__/carry-over.test.ts` - new, pure: the one carry-over walk, its rounding rule and `wholeDaysThatCarry` (08-S1b)                                           | `src/routes/_app/-server/library.ts` - held by `08-S3` this wave; `loadVacay` is **not** edited                                            |
| `src/routes/_app/-server/vacay.ts` - new: `loadVacayAllowance`, `setAllowanceFn`, `updateVacayPlanFn` (grown by `08-S5`, `08-S8`); `__tests__/vacay.test.ts` - new                                 | `setEntry`, `setEntryRange`, `removeEntry`, `invitePlanMember`, `setPlanMemberStatus`, `removePlanMember`, `deletePlan` (`08-S5`, `08-S8`) |
| `src/routes/_app/vacay.tsx` - edit: loads the allowance context, mounts the two components, extends `VacayPending`; the month grid is untouched                                                    | `src/routes/_app/-ui/scaffold.tsx`, `-lib/format.ts`, `-lib/tone.ts` - imported, not touched                                               |
| `src/components/vacay/allowance-panel.tsx`, `plan-settings-dialog.tsx`, `index.ts` + `__tests__/` - new (the module's directory, `docs/SPEC.md` §6)                                                | `src/components/ui/**`, `src/styles/tokens.css` - no primitive and no token is missing                                                     |
| `src/lib/i18n/messages/<locale>/modules.ts` - edit, **all 23 locales**                                                                                                                             | `src/server/billing/**`, `src/lib/plans.ts` - no quota, no `MODULE_KEYS` entry (`08-S10` states that once for the plan)                    |
| `src/server/repos/__tests__/tenant-isolation.test.ts` - append one `describe`; `repositories.test.ts` - append the allowance / carry-over cases                                                    | `e2e/helpers/**` - reused, not edited                                                                                                      |
| `e2e/product-modules.spec.ts` - new: this plan's spec file (`docs/plans/12-verification-protocol.md` §4: one file per plan, named from `08-product-modules.md`)                                    | `src/lib/i18n/messages/en/shell.ts` (`nav.vacay`)                                                                                          |
| `CONTEXT.md` - three glossary entries (08-S1a): **Allowance**, **Carry-over** (with the opening-balance rule), **Leave plan**                                                                      |                                                                                                                                            |

Departures from the plan's owned paths (Resolved assumptions 5, 11, 12, 13): the walk lives in `src/lib/vacay/`, not
`src/components/vacay/carry-over.ts`; `modules.ts` in all 23 locales and `CONTEXT.md` join the list; `e2e/product-modules.spec.ts`
replaces `product-modules.visual.spec.ts` and the four re-recorded `vacay-*` PNGs, because ADR 0016 removed the baselines; and
`vacay.tsx` gets its allowance context from a new GET function instead of an edit to `loadVacay`.

### The allowance, in the traveller's terms

- A traveller has, for each year, an **allowance** (days they may take), a **carried-over** figure (whole days brought in
  from the year before), **used** days (derived from their entries) and **days left** (derived). Only the first two are stored.
- **The "Days" tile is always editable** by its owner. A traveller who never set one sees the plan's default allowance, marked
  as the default; the first save writes a row, **including a save of the unchanged default** (that is how a traveller starts a
  chain without changing the number).
- **The "Carried" tile is editable only as an opening balance.** It is an opening balance when the traveller has **no row for
  the previous calendar year** (the first year they used the planner, or the first after a gap). In every other year it is
  derived and plain text, captioned "Carried from {year}". A typed value could never survive there: the next edit of an
  earlier year would overwrite it.
- **Only whole days carry.** The leftover of a year is `entitlement + carried - used`; the next year's carried-over is that
  value floored, clamped at `0` (a debt never carries) and capped at `365` (the stored maximum).
- **A year with no row still shows its carry.** `loadVacayAllowance` computes the viewer's effective balance for the year on
  screen with the same walk, adding a virtual row (plan default allowance) when the year before has a row; the panel shows that
  figure and computes nothing. `0` when carry-over is off. Nothing is written by a read.
- **Carry-over off hides, it does not erase.** Stored carried-over figures are maintained whatever the plan's carry-over
  setting says; the setting only changes what is displayed (`getPlanOverview` already zeroes the figure). Turning it off and on
  again therefore loses nothing, and flipping it needs no recompute.
- **Adding an earlier year can supersede an opening balance the traveller typed.** If a traveller saves year N-1 while year N
  holds a typed opening balance, year N becomes derived and its figure is recomputed. That is never silent: the write reports
  the superseded years and the old values, and the panel announces it (`vacay.allowance.superseded`).
- **Half-day allowances are not supported.** The allowance is a whole number of days from 0 to 365, as the column is.

### Who may do what

One rule, in the repository, because the writers that follow (`08-S5`, `08-S8`) must not be able to forget it:

- `requirePlanActor(scope, planId)` resolves the plan inside the workspace (`requireById`) and returns it with `isOwner`. The
  caller must be the plan's **owner** or an **accepted** member (`pending` and `declined` grant nothing). Anyone else in the
  workspace gets `NotFoundError`: a plan you may not see looks like a plan that does not exist (`CONTEXT.md`, **Trip member**).
- `requirePlanOwner(scope, planId)` is that, plus `isOwner`, else `PlanOwnerOnlyError`.
- **Your own allowance:** `requirePlanActor`. **Someone else's** (an explicit `userId` other than the caller): owner only, and
  the target must be an accepted plan member **and** a current workspace member (`getMembership`), else `NotFoundError` with
  nothing written. The workspace role (`owner` / `admin` / `member`) gives no override: a leave plan is personal.
- **Plan settings:** `requirePlanOwner`. A plan member sees the dialog read-only; that view ships with `08-S8`, the first stage
  that makes another person's plan visible. Today `loadVacay` loads only the caller's own plan.
- The server refuses; hiding a control is not the guard. `recomputeCarryOver` is **repository-internal**: it resolves the plan
  with `requireById`, accepts no client-supplied figure, is called only by `saveAllowance` after the guard has passed, and no
  server function exposes it. The `VacayBalance` list `setAllowanceFn` returns is read after that guard, in the same handler.

### Phase 1 (08-S1a) - set your allowance

**`src/server/repos/vacay.ts` (edit).** All SQL stays here; every statement is an existing `tenantFilter()`-bound call or a
`createTenantRepository` method.

- `requirePlanActor`, `requirePlanOwner`; `PlanOwnerOnlyError extends RepositoryError` (a diagnostic: the reader sees the
  caller's localised fallback and `AUTHORED_ERROR_NAMES` stays closed, `docs/SPEC.md` §9 rule 10); `CarriedOverDerivedError
extends RepositoryError` (thrown when `carriedOverDays` is sent for a year that has a predecessor row; used from 08-S1b).
- `saveAllowance(scope, input)`: `input` is `setEntitlementInput`. It resolves the target (`userId ?? caller`), applies the
  actor rules, calls the existing `setEntitlement` (unchanged: its contract stays "write one row") and returns the row. In
  08-S1a it writes the row and nothing derived; 08-S1b adds the recompute and the derived-year rule inside it.
- `getAllowance(scope, planId, userId, year)`: the viewer's effective balance for one year (see 08-S1b for the walk; in
  08-S1a it is the stored row or the plan default, `used` from entries). Returns `{ hasRow, entitlementDays, carriedOverDays,
usedDays, remainingDays }`.

**`src/routes/_app/-server/vacay.ts` (new).**

- `loadVacayAllowance` (GET, `{ planId, year }`): `requirePlanActor`, then `getAllowance` for the caller, plus `openingBalance`
  and `previousYear` (08-S1b). It does **not** call `ensurePlan`: the route loader runs it **after** `loadVacay`, which has
  already created the plan, and passes that plan's id and resolved year (`await loadVacay(...)` then `await
loadVacayAllowance(...)`). Two concurrent `ensurePlan` calls would race on `vacay_plans_org_owner_unq`.
- `setAllowanceFn` (POST): validator `setEntitlementInput` (the repository schema, `z.object` like its siblings; the plan's
  `z.strictObject()` is not used because neither repository input is strict). The handler is `appScope()` then `saveAllowance`,
  and returns the year's balance list. The guard is in the repository, not only here.

**`src/components/vacay/allowance-panel.tsx` (new)** replaces the read-only block at `vacay.tsx` (the "Entitlement" panel);
see [UI/UX](#-uiux). The panel calls the server function directly and then `router.invalidate()` (the precedent is
`src/routes/_app/notifications.tsx`; there is no `useServerFn` use in `src`), so the screen shows what the database holds.

**`CONTEXT.md`:** **Allowance** (the leave days a traveller may take in a year; _Avoid_: "entitlement" for it), **Carry-over**
(unused whole days brought into the next year, and the opening-balance rule: a traveller's first year in a chain is entered,
every later year is calculated), **Leave plan** (a traveller's personal planner of leave; distinct from the billing plan and from
a trip's plan).

### Phase 2 (08-S1b) - the leftover follows the traveller

**`src/lib/vacay/carry-over.ts` (new, pure, no React, no server imports).** The one owner of the rule (`docs/SPEC.md` §8).

- `walkCarryOver(rows)`: `rows` is one traveller's `{ year, entitlementDays, carriedOverDays, usedDays }`, sorted ascending
  by year. Returns the carried-over figure each row **should** hold. A row with no row for `year - 1` is an opening balance and
  keeps its stored value. Any other row gets `clamp(floor(prev.entitlement + prevCarried - prev.used), 0, 365)`, where
  `prevCarried` is the value this walk just computed, so the leftover compounds down the chain. A missing year breaks the
  chain; the walk never bridges a gap.
- `wholeDaysThatCarry(remaining)`: the same clamp-floor-cap on one number. The panel uses it to decide whether to show the
  half-day line, so the screen and the walk cannot disagree.

**`src/server/repos/vacay.ts` (edit).**

- `listUserYearsForUser(scope, planId, userId)`: the traveller's rows, ascending by year.
- `recomputeCarryOver(scope, planId, userId)`: repository-internal. Resolves the plan (`requireById`), reads the traveller's
  rows and their entries **once** (`listVacayEntries` without a year, bucketed by calendar year with `ENTRY_KIND_COST`), calls
  `walkCarryOver`, and writes **only the rows whose figure changed**, as one `runBatch` of tenant-filtered `UPDATE`s
  (`setEntryRange` is the precedent). It inserts no row and is idempotent. It returns the changed years, and the **superseded
  opening balances**: rows that had no predecessor before the triggering write, have one now, and held a non-zero typed value.
  One batch per traveller is atomic (a chain whose middle is stale is the failure to avoid) and each statement binds two or
  three values, far below `MAX_BOUND_PARAMETERS`.
- `saveAllowance` now: rejects `carriedOverDays` for a year that has a predecessor row (`CarriedOverDerivedError`), writes the
  row, then calls `recomputeCarryOver`. A row inserted for year N+1 while year N has a row is seeded by that same recompute,
  in the same request. It returns the row and the superseded list.
- `getAllowance` now runs the walk over the traveller's rows plus a **virtual row** for the requested year (plan default
  allowance, no stored carry) when none exists and the year before has one; carried is `0` when carry-over is off.

`recomputeCarryOver` is not a server function and there is no "Recalculate" button (Resolved assumption 4): in this stage `used`
changes only through seeded data, because nothing writes an entry until `08-S5`, and `08-S5`'s entry writes call
`recomputeCarryOver` themselves.

### Phase 3 (08-S1c) - the plan settings dialog

- `updatePlanSettings(scope, planId, input)` in the repository: `requirePlanOwner`, then the existing `updatePlan`. The input is
  `updatePlanInput.pick({ carryOverEnabled, defaultEntitlementDays })`; an empty patch is a no-op that returns the plan. The
  repository schema already accepts the other three switches and `name`; `08-S5` widens the `pick` when it wires the grid.
  Changing the default allowance changes what travellers **without** a row see, and rewrites no stored row.
- `updateVacayPlanFn` (POST) in `src/routes/_app/-server/vacay.ts`: `{ planId }` plus that input; the handler calls
  `updatePlanSettings` and returns the updated plan row.
- **`src/components/vacay/plan-settings-dialog.tsx` (new):** a `Dialog` with one `Checkbox` row (carry unused days into the next
  year) and one numeric `Input` (default allowance), opened from a "Leave plan settings" button in the `PageHeader` actions beside
  the year switcher. Shown to the plan's owner; today that is every viewer, because only their own plan loads.
- There is **no preview of what turning carry-over off would cost**: the setting hides figures and erases none.

### Alternatives considered, and why they lost

| Alternative                                                              | Why it lost                                                                                                                                |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Walk `vacay_years` as the plan wrote it                                  | No production code writes that table; the walk would visit nothing.                                                                        |
| Two walks (preview in `components`, write in the repository) plus a test | One concept true in two places (`docs/SPEC.md` §8). With the preview gone there is one writer; the pure walk stays in `src/lib` for tests. |
| A manual-override flag so a typed carried figure survives a recompute    | Needs a column; plan 08 files no migration.                                                                                                |
| Round half up, or widen the column to hold halves                        | The first credits leave that does not exist; the second is a migration.                                                                    |
| The actor check only in the handler                                      | `08-S5` / `08-S8` writers take only a row id; a check on the client's `planId` cannot protect them. The repository is where trips do it.   |
| Edit `loadVacay` to carry the allowance context                          | `library.ts` is `08-S3`'s in wave 1.                                                                                                       |
| Commit the inline editor on blur                                         | On touch there is no `Escape` and a Cancel tap would blur-commit first; explicit Save / Cancel is unambiguous (Resolved assumption 15).    |
| Ship all four switches and let three do nothing yet                      | A control with no visible effect is a placeholder (`docs/SPEC.md` §7.5); they ship with the grid that honours them.                        |

## 📝 Architecture

- **One concept, one owner (`docs/SPEC.md` §8).** The carry-over rule and its rounding: `src/lib/vacay/carry-over.ts`.
  Persisting it, and the actor rules: `src/server/repos/vacay.ts` (the only SQL owner). Plan settings values and defaults:
  `vacay_plans` through the existing `updatePlan`. Inline edit and dialog rendering: `src/components/vacay/`, which consume
  `wholeDaysThatCarry` and own no calculation. The server functions validate, forward and own no rule.
- **Seams.** Route loader: `await loadVacay`, then `await loadVacayAllowance` with that plan's id. A write goes component, server
  function, `appScope()`, `saveAllowance` / `updatePlanSettings`, repository functions. The repository does not import from
  `src/server/auth`, so the owner-only refusal is a repository error class, not `AuthRequirementError`.
- **`components/ui` never fetches or imports `server/`**; the new components take plain props and call the server functions
  directly, then `router.invalidate()`.
- **Cloudflare cost.** A write is a point read of the plan and the member rows, the existing upsert, one entries read for the
  traveller, and at most one batch of single-digit `UPDATE`s. Nothing is queued, no realtime patch.

## 📝 Data Model

**No schema change and no migration.** Written columns: `vacay_user_years.entitlement_days`, `carried_over_days`;
`vacay_plans.carry_over_enabled`, `default_entitlement_days`. No index is added: reads and writes are by `(organization_id,
plan_id, user_id, year)`, served by the `(organization_id, plan_id)` prefix of `vacay_user_years_org_plan_idx` with a residual
scan of a plan's member count; the unique `(plan_id, user_id, year)` index carries no tenant column and is not the tenant guard
(the guard is `tenantFilter()` and the insert stamp). It does make `setEntitlement`'s read-then-write safe under a race: two
concurrent first saves collide on it instead of leaving two rows.

## 📝 API Contracts

| Function             | Method | Input                                                                                       | Output                                                                                                |
| -------------------- | ------ | ------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `loadVacayAllowance` | GET    | `{ planId, year }`                                                                          | `{ hasRow, openingBalance, previousYear, entitlementDays, carriedOverDays, usedDays, remainingDays }` |
| `setAllowanceFn`     | POST   | `setEntitlementInput` (`planId`, `userId?`, `year`, `entitlementDays?`, `carriedOverDays?`) | the year's `VacayBalance` list and `superseded: [{ year, was }]`                                      |
| `updateVacayPlanFn`  | POST   | `{ planId } & updatePlanInput.pick({ carryOverEnabled, defaultEntitlementDays })`           | the updated plan row                                                                                  |

Errors: a plan the caller may not see, or a target who is not a current member, is `NotFoundError`; a non-owner changing
settings or someone else's allowance is `PlanOwnerOnlyError`; `carriedOverDays` for a derived year is
`CarriedOverDerivedError`. All three reach the reader as a localised message (see UI/UX errors); the UI never offers the action.

## 📝 UI/UX

Route `/vacay` (`src/routes/_app/vacay.tsx`) exists: no route file, no `pnpm generate-routes`. SSR stays the default.

### The allowance panel

- **Structure.** The `dl > div > dt + dd` of the figure tiles stays; the `<button>` lives **inside** the `dd`. "Days" and (when
  an opening balance) "Carried" are buttons with `data-part="allowance-tile"` and `data-field="entitlement" | "carried"`. A
  derived or switched-off "Carried" is plain text, not a disabled button. The `Progress` gets an accessible name
  (`vacay.allowance.progress`).
- **Names.** One full key per field (`vacay.allowance.tile.edit.days`, `.edit.carried`), so the accessible name contains the
  visible label word for word in every locale (WCAG 2.5.3); numbers go through `formatNumber(locale)`. The default hint is
  linked to the tile with `aria-describedby`.
- **Affordance.** An `aria-hidden` pencil glyph in a token that reaches 3:1 on the tile in both themes (a `surface-2` tile on
  the card is about 1.1:1 without it). Hover, `focus-visible` ring, active and pending states are named in the component. The
  muted "Carried" text keeps its token (about 4.8:1 light, 5.1:1 dark) with no opacity layered on it.
- **The editor.** Pressing a tile swaps the figure for a numeric `Input` (`inputMode="numeric"`, whole numbers 0 to 365) with
  visible **Save** and **Cancel** icon buttons; focus moves into the input with its text selected; one editor is open at a time.
  - `Enter` saves, `Escape` cancels; focus returns to the same tile button after either (the tile has a stable key across
    `router.invalidate()`).
  - **Blur never commits.** Blur with an unchanged or empty value closes the editor with no write; blur with a changed value
    leaves the editor open with Save and Cancel visible. An invalid value (`Enter` or Save) does not submit, keeps focus in the
    input and shows `vacay.allowance.input.invalid` as visible text with `aria-invalid="true"` linked by `aria-describedby`.
  - Arabic-Indic and other locale digits are normalised before parsing (a test under `ar`).
  - **Pending.** The input is `readOnly` plus `aria-busy` (never `disabled`, which drops focus), a second `Enter` or Save does
    not submit again, and a visible "Saving..." indicator (`vacay.allowance.saving`) shows the typed value until the reload.
- **States.** _Default_ (no row): the tile shows the plan default with the hint "Default allowance. Select to set your own."
  _Derived carried:_ "Carried from {year}". _Carry-over off:_ "Carry-over is off". _Opening balance:_ "Brought in from before
  {year}. Select to edit." _Whole-days line:_ shown only when carry-over is on and the leftover is positive with a fractional
  part (`wholeDaysThatCarry(remaining) !== remaining`), never for a debt or a capped value. _Negative balance:_ "{count} days
  over", not "-3 days left". There is no "empty" state: the viewer's balance is always present, so the plan's "Set an allowance..."
  copy and its branch are deleted, not restyled.
- **Errors.** A failed write keeps the editor open with the typed value and shows a `danger` `Alert` (`role="alert"`) naming the
  field and that nothing was lost (one key per field). "Try again" is offered for transport and 5xx failures only. A refusal
  (`CarriedOverDerivedError`, for example after a write from another tab) reloads the panel and says why the figure is now
  calculated (`vacay.allowance.error.derived`), with no retry. The loader's own failure keeps the existing `ErrorPanel`.
- **Status.** One polite live region mounted at first render, starting empty, outside the swapping tile and outside the dialog
  portal, receives "Allowance saved.", the superseded-balance notice and the settings-saved message.
- **Skeleton.** `VacayPending` is extended with the panel's control row so skeleton and settled layout have the same height.
- **Motion.** The tile-to-input swap is 150ms opacity plus a 2px translate on `--ease-out-quint` using the CSS motion tokens
  only; the translated element carries `data-motion-transform` so the global reduced-motion reset removes the translate.
- **Layout.** At 360px captions sit full width under the three-tile row, not inside the tiles. The settings button is at least
  44px on touch.

### The settings dialog

- `Dialog` primitive with `DialogTitle` and `DialogDescription`; one `Checkbox` row whose whole label is the hit target
  (at least 24px, WCAG 2.5.8) and one numeric `Input` labelled "Default allowance (days per year)" with its note, through
  `Field` with `error` (`vacay.settings.defaultAllowance.invalid`). Save and Cancel; Save takes `loading`.
- **Failure:** the dialog stays open with the values kept and a `danger` `Alert` in `DialogBody`; focus moves to that alert
  (`tabIndex={-1}`), because the loading Save button has dropped focus. **Success:** the dialog closes, focus returns to the
  settings button, and the saved message goes to the live region.
- The settings button is an `IconButton` (or a `Button` with visible text), size `sm` or larger, labelled "Leave plan settings",
  with `data-part="vacay-settings"`. The label says "leave plan", never "owner" and never bare "plan" (the billing term).
- At 360px the dialog is a full-height sheet whose footer (Save) stays visible above the on-screen keyboard.

## 📝 Visual change expected

Route `/vacay`, light and dark, desktop (1280) and mobile (360), plus 2560:

- Resting: the allowance panel gains a pencil affordance on "Days" (and "Carried" when an opening balance), a "Leave plan
  settings" button in the page header actions, and the panel's label reads "Allowance {year}".
- Editing: a tile swapped for an input with Save and Cancel (`--state editing`, click
  `[data-part="allowance-tile"][data-field="entitlement"]`).
- Settings open (`--state settings`, click `[data-part="vacay-settings"]`); at 360px a full-height sheet.
- Skeleton: the extended `VacayPending`. Error: the in-panel `Alert`, reached with `page.route()` failing the write.

The month grid, legend and traveller list do not change.

## 📝 Copy

New keys in `src/lib/i18n/messages/en/modules.ts` (namespace `modules`, prefix `vacay.`), each landing in all 23 locales in the
same change that first uses it (`i18n-messages` skill; the parity test enforces it). "Allowance" is the traveller's word;
**Entitlement** is the billing term and is not used. Fields are never a `{field}` slot: one key per field, so inflected locales
translate whole sentences.

| Key                                       | `en` text                                                                                   | Ticket |
| ----------------------------------------- | ------------------------------------------------------------------------------------------- | ------ |
| `vacay.allowance.label`                   | `Allowance {year}`                                                                          | S1a    |
| `vacay.allowance.daysLeft`                | plural: `{count} day left` / `{count} days left`                                            | S1a    |
| `vacay.allowance.daysOver`                | plural: `{count} day over` / `{count} days over`                                            | S1a    |
| `vacay.allowance.progress`                | `{used} of {total} days used`                                                               | S1a    |
| `vacay.allowance.tile.days`               | `Days`                                                                                      | S1a    |
| `vacay.allowance.tile.used`               | `Used`                                                                                      | S1a    |
| `vacay.allowance.tile.carried`            | `Carried`                                                                                   | S1a    |
| `vacay.allowance.tile.edit.days`          | `Edit days, currently {value}`                                                              | S1a    |
| `vacay.allowance.tile.edit.carried`       | `Edit carried days, currently {value}`                                                      | S1b    |
| `vacay.allowance.input.days`              | `Your allowance for {year}`                                                                 | S1a    |
| `vacay.allowance.input.carried`           | `Carried days brought into {year}`                                                          | S1b    |
| `vacay.allowance.input.invalid`           | `Enter a whole number from 0 to 365.`                                                       | S1a    |
| `vacay.allowance.save` / `.cancel`        | `Save` / `Cancel`                                                                           | S1a    |
| `vacay.allowance.saving`                  | `Saving...`                                                                                 | S1a    |
| `vacay.allowance.default.hint`            | `Default allowance. Select to set your own.`                                                | S1a    |
| `vacay.allowance.saved`                   | `Allowance saved.`                                                                          | S1a    |
| `vacay.allowance.error.days`              | `Your allowance could not be saved. {year} still shows {value} days.`                       | S1a    |
| `vacay.allowance.error.carried`           | `Your carried days could not be saved. {year} still shows {value} days.`                    | S1b    |
| `vacay.allowance.error.derived`           | `Carried days for {year} are now calculated from {previousYear}, so they cannot be edited.` | S1b    |
| `vacay.allowance.retry`                   | `Try again`                                                                                 | S1a    |
| `vacay.allowance.carried.from`            | `Carried from {year}`                                                                       | S1b    |
| `vacay.allowance.carried.opening`         | `Brought in from before {year}. Select to edit.`                                            | S1b    |
| `vacay.allowance.carried.off`             | `Carry-over is off`                                                                         | S1b    |
| `vacay.allowance.carried.wholeDays`       | `Only whole days carry into the next year; the leftover half day does not.`                 | S1b    |
| `vacay.allowance.superseded`              | `Carried days for {year} are now calculated from {previousYear}. You had entered {value}.`  | S1b    |
| `vacay.settings.open`                     | `Leave plan settings`                                                                       | S1c    |
| `vacay.settings.title`                    | `Leave plan settings`                                                                       | S1c    |
| `vacay.settings.description`              | `How unused leave days are counted in your leave plan.`                                     | S1c    |
| `vacay.settings.carryOver`                | `Carry unused days into the next year`                                                      | S1c    |
| `vacay.settings.carryOver.hint`           | `Turning this off hides carried days; it does not erase them.`                              | S1c    |
| `vacay.settings.defaultAllowance`         | `Default allowance (days per year)`                                                         | S1c    |
| `vacay.settings.defaultAllowance.hint`    | `Applies to years where you have not set your own allowance.`                               | S1c    |
| `vacay.settings.defaultAllowance.invalid` | `Enter a whole number from 0 to 365.`                                                       | S1c    |
| `vacay.settings.save` / `.cancel`         | `Save settings` / `Cancel`                                                                  | S1c    |
| `vacay.settings.saved`                    | `Leave plan settings saved.`                                                                | S1c    |
| `vacay.settings.error`                    | `The leave plan settings could not be saved. Nothing was changed.`                          | S1c    |

## 📝 Edge Cases & Failure Scenarios

| Case                                                   | Behaviour                                                                                                                                           |
| ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Leftover is `365 + 365 - 0`                            | Next year's carried-over is capped at 365; the recompute never throws a `ZodError` mid-chain.                                                       |
| Used exceeds the allowance                             | Leftover is negative; carried-over is `0`; the panel says "{count} days over" for the year that incurred it.                                        |
| Leftover `4.5`                                         | Carries `4`; the panel shows the whole-days line.                                                                                                   |
| A year with a row for N-1 and none for N               | The panel shows N-1's whole-day leftover as "Carried from N-1" and in days left, before any save in N; saving the unchanged default writes the row. |
| A year with no row between two rows                    | The chain breaks; the later year is an opening balance, editable.                                                                                   |
| Editing an earlier year's allowance                    | Every later derived year is rewritten in the same request, stopping at the first missing row.                                                       |
| Saving N-1 while N holds a typed opening balance       | N becomes derived and is recomputed; the write returns `superseded: [{ year: N, was }]` and the panel announces it. Nothing is silent.              |
| `carriedOverDays` sent for a derived year              | `CarriedOverDerivedError`, nothing written; the panel reloads and explains.                                                                         |
| `Enter` then the blur it causes; "Try again" then blur | Exactly one write.                                                                                                                                  |
| Two tabs save at once                                  | Last write wins on the tile; the recompute is idempotent and converges; a first-save race hits the unique index, not a duplicate row.               |
| The write succeeds and the recompute batch fails       | The stored chain is stale until the next write on it (each write re-runs the walk); the error is reported.                                          |
| Target `userId` left the workspace or never existed    | `NotFoundError`, no row written, even when a stale accepted `vacay_plan_members` row remains.                                                       |
| Pending or declined plan member calls a write          | `NotFoundError`.                                                                                                                                    |
| A traveller with no plan opens `/vacay`                | `loadVacay` creates it, then `loadVacayAllowance` runs against it; no concurrent `ensurePlan`.                                                      |
| Carry-over switched off then on                        | Stored figures were maintained throughout; nothing is lost and nothing needs recomputing.                                                           |
| Settings saved with nothing changed                    | The dialog closes without a call; the server treats an empty patch as a no-op.                                                                      |

## ✅ Acceptance criteria

Each criterion belongs to one ticket.

**08-S1a (set your allowance)**

1. A traveller sets their "Days" allowance on `/vacay` with the keyboard alone and the figures update from the database after the
   write; saving the unchanged default writes a row. After the swap, focus is in the input; after `Enter`, `Escape` or Save it
   is back on the same tile (`document.activeElement` assertions).
2. Blur never commits; an invalid value keeps the editor open with the linked message; `Enter` followed by blur sends exactly
   one write; the input is `readOnly` and `aria-busy` while pending.
3. A failed write keeps the typed value, shows the alert and offers a retry only for transport / 5xx failures; a success is
   announced in the live region.
4. The repository actor rules hold: a non-member, a `pending` member and a `declined` member get `NotFoundError`; a member
   editing a colleague gets `PlanOwnerOnlyError` while the owner's identical call succeeds; a target with an accepted plan-member
   row but no workspace `member` row, a target who left the workspace and one who never existed write nothing.
5. Nothing under `src/routes/**` or `src/server/fns/**` imports `setEntitlement` or `updatePlan` (a structural test reading
   imports, as `trip-lifecycle-side-effects.test.ts` does); only `saveAllowance` / `updatePlanSettings` are reachable.
6. Tenant isolation: in A's scope, against B's plan id, `saveAllowance`, `updatePlan`, `ensureYear` and `getAllowance` reject
   with `NotFoundError` and B's `vacay_plans`, `vacay_years`, `vacay_user_years` rows are byte-identical afterwards;
   `getPlanOverview` in B's scope for A's plan id is `NotFoundError`; `listUserYears(scopeB, aPlanId, year)` is `[]` (the
   distinction matters: `requireById` throws, `findMany` returns `[]`); `saveAllowance` in A's scope with an explicit `userId`
   belonging to B writes nothing, and B's `vacay_user_years` count is unchanged.
7. A traveller with no plan opens `/vacay` and the allowance loads (no `ensurePlan` race).
8. All S1a copy exists in 23 locales; `CONTEXT.md` carries the three entries; no console message on `/vacay`; zero layout shift
   after settle; both themes at 360, 1280, 2560.

**08-S1b (the leftover follows the traveller)**

9. `walkCarryOver` compounds the leftover down a chain, floors it, clamps at 0, caps at 365, breaks at a gap year and leaves an
   opening balance's stored value alone; `wholeDaysThatCarry` agrees with it on every input (a shared table test).
10. `saveAllowance` rewrites only the changed later rows in one batch, inserts none, seeds a newly inserted year's carried-over
    from the year before, rejects `carriedOverDays` for a derived year, and reports superseded opening balances; the written
    values equal `walkCarryOver`'s output for the same rows.
11. `recomputeCarryOver` for a plan id from another workspace rejects with `NotFoundError` and changes nothing (tenant-isolation
    block extended).
12. A traveller with a row for N-1 and none for N sees N-1's whole-day leftover as "Carried" and in days left before any save in
    N; with carry-over off the figure is `0`.
13. "Carried" is an editable tile only for an opening balance; derived and switched-off "Carried" are plain text; the half-day
    line appears exactly when carry-over is on and the leftover is positive with a fractional part.
14. Saving N-1 while N holds a typed opening balance announces the superseded value.

**08-S1c (settings)**

15. The plan's owner changes the carry-over setting and the default allowance in the dialog and the screen reflects them:
    turning carry-over off zeroes the displayed "Carried" and turning it on restores it with no recompute; a new default
    changes the figure of a traveller without a row and rewrites no stored row.
16. A non-owner calling `updateVacayPlanFn` is refused; a failed save keeps the dialog open with the values kept and moves focus
    to the alert; a success closes it and returns focus to the settings button.
17. All S1c copy exists in 23 locales; both themes at 360, 1280, 2560, with the dialog open.

## 📝 Risks & Impact Review

- **New write paths acting on another person's data from client-sent ids (`planId`, `userId`).** The security and tenancy
  verdict is risk-medium, not high: the workspace filter is untouched, there is no migration, no quota and no money.
  Mitigation: the actor rules sit in the repository and are tested before any screen uses them (08-S1a).
- **Existing writers and readers are still open.** `setEntitlement` and `updatePlan` stay exported with only the workspace
  check (nothing in `src/routes/**` or `src/server/fns/**` may import them; criterion 5). `setEntry`, `setEntryRange`,
  `removeEntry`, `setPlanMemberStatus`, `removePlanMember`, `invitePlanMember`, `setUserColour` and `deletePlan` check only the
  workspace, and `getPlanOverview`, `listUserYears`, `listVacayEntries` and `listPlanMembers` take a client `planId` with only
  `requireById` or `findMany`. Nothing calls them yet. `08-S5` and `08-S8` must put `requirePlanActor` / `requirePlanOwner` in
  front of each before it gets a caller, and `08-S8` must do so before another person's plan becomes visible (those rows hold
  colleagues' sick days).
- **The floored half day is a visible loss.** It is explained in one line, and reversible: the figure is derived, so widening
  the column later and recomputing restores halves.
- **Backward compatibility.** Additive only: new exports and functions, no signature changed, `setEntitlement` untouched.

### Out of scope

- The month grid, entries, the week start wiring, localising the rest of `vacay.tsx` (`08-S5`). Its entry writes call
  `recomputeCarryOver` and the actor helpers. The three display switches (block weekends, public holidays, company holidays)
  land in the dialog with `08-S5`, which owns the grid that honours them; reference row `ADD-02` therefore closes with that
  stage, not this one.
- Inviting plan members, the read-only settings view for a member, and what becomes of a plan whose owner leaves the
  workspace (`removeMember` leaves every `vacay_*` row behind, and nobody can then change that plan): `08-S8` decides keep,
  reassign or remove.
- A "Recalculate" action, a carry-over cost preview, half-day allowances, any module entitlement gate (`08-S10`).

## 📋 Phasing

| Phase | Ticket | Slice a person can see work                                                                  |
| ----- | ------ | -------------------------------------------------------------------------------------------- |
| 1     | 08-S1a | A traveller sets their allowance on `/vacay`, behind the repository guard                    |
| 2     | 08-S1b | The leftover carries into the next year; the "Carried" tile is an opening balance or derived |
| 3     | 08-S1c | The plan's owner switches carry-over and sets the default allowance                          |

If a ticket does not fit one context window, 08-S1a and 08-S1b are folded into one ticket (two tickets), never re-cut by layer.

## 📋 Implementation Plan

### Phase 1 - set your allowance (08-S1a)

1. `requirePlanActor`, `requirePlanOwner`, the two error classes, `saveAllowance`, `getAllowance` and their tests, test first;
   the tenant-isolation `describe`, the actor-rule cases and the structural import test.
2. `src/routes/_app/-server/vacay.ts` (`loadVacayAllowance`, `setAllowanceFn`) and `__tests__/vacay.test.ts`.
3. `allowance-panel.tsx`, `index.ts`, the `vacay.tsx` edit (sequential loader), the extended `VacayPending`, the S1a keys in 23
   locales, the `CONTEXT.md` entries.
4. `e2e/product-modules.spec.ts` with a `test.describe('08-S1 ...')` for the allowance.

### Phase 2 - the leftover follows the traveller (08-S1b)

1. `src/lib/vacay/carry-over.ts` and its test, test first (the Edge Cases table as cases).
2. `listUserYearsForUser`, `recomputeCarryOver`, the derived-year rule and the superseded report in `saveAllowance`, the virtual
   row in `getAllowance`; repository cases.
3. The opening-balance tile, the derived / off / whole-days states, the S1b keys in 23 locales, the e2e `describe`.

### Phase 3 - the plan settings dialog (08-S1c)

1. `updatePlanSettings` and `updateVacayPlanFn` with their tests.
2. `plan-settings-dialog.tsx`, the header button, the S1c keys in 23 locales.
3. The dialog's `test.describe` in the same spec file.

## Verification

- The gate in `validation.commands` (`.ai/agentic.config.json`) on every phase's last commit.
- Unit: `src/lib/vacay/__tests__/carry-over.test.ts`; `src/routes/_app/-server/__tests__/vacay.test.ts`;
  `allowance-panel.test.tsx` (commit keys, focus assertions, one write for `Enter`+blur, invalid message linkage, a rejected
  write keeps the typed value, the half-day line only when it should, `ar` digits); `plan-settings-dialog.test.tsx` (failure
  keeps values and focuses the alert, success returns focus).
- Browser, per `docs/plans/12-verification-protocol.md` (ADR 0016: no baselines, no pixel comparison, no
  `e2e/__screenshots__`): `e2e/product-modules.spec.ts` asserts the screen answers, renders, hydrates, says nothing in the
  console (`watchConsole`) and can be acted on. It declares `/vacay?year=2026` (`PINNED_YEAR`), restores any allowance it
  changes, and is named among the fixture writers in `playwright.config.ts`'s `workers` comment if that comment lists them.
  Run `PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup` then
  `... pnpm exec playwright test e2e/product-modules.spec.ts`, with the port from `bash .ai/scripts/e2e.sh`.
- Frames, the blind A/B pair a person reads at review, from `scripts/visual/capture.mjs` (the plan's `scripts/ultrabuild`
  path does not exist):
  `PT_SERVER_TODAY=2026-08-20 node scripts/visual/capture.mjs --url "http://localhost:$PORT/vacay?year=2026" --out "<scratchpad>/shots/08-S1" --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth`,
  plus `--state editing --click '[data-part="allowance-tile"][data-field="entitlement"]'` and
  `--state settings --click '[data-part="vacay-settings"]'`. Both selectors are verified to resolve by the spec run passing.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                          | Applied default                                                                                                                                                                                                                                          | Why                                                                                                                                                                                                                                                                            |
| --- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | A half-day leftover meets an integer column: what carries?                        | `clamp(floor(leftover), 0, 365)`, with a one-line explanation shown only for a positive fractional leftover with carry-over on                                                                                                                           | Decided by product owner sub-agent (confidence medium): never credits leave that does not exist; reversible by recompute if the column is ever widened; the cap avoids a mid-chain `ZodError`.                                                                                 |
| 2   | The "Carried" tile is editable and derived: which wins?                           | Editable only when the traveller has no row for the previous year (opening balance); derived and plain text otherwise; enforced in the repository; a write recomputes later years in the same request; a newly inserted year is seeded by that recompute | Decided by product owner sub-agent (confidence high), architect concurring on recompute in the repository: avoids a silent overwrite and a new column.                                                                                                                         |
| 3   | Who changes the plan settings?                                                    | The plan's owner only; a member's read-only view ships with `08-S8`                                                                                                                                                                                      | Decided by product owner and security and tenancy sub-agents (confidence high): the settings change every member's display; narrowest and easiest to widen.                                                                                                                    |
| 4   | Keep the plan's "Recalculate" action and the cost-of-turning-off preview?         | Dropped; stored carried-over is maintained regardless of the setting                                                                                                                                                                                     | Decided by product owner sub-agent (confidence high): nothing real to recalculate until `08-S5`; the setting hides, it does not erase, so there is nothing to preview.                                                                                                         |
| 5   | Where does the pure walk live?                                                    | `src/lib/vacay/carry-over.ts`, one implementation; the chain is the traveller's `vacay_user_years` rows, not `vacay_years`                                                                                                                               | Decided by software architect sub-agent (confidence high): `docs/SPEC.md` §8; `vacay_years` has no production writer.                                                                                                                                                          |
| 6   | Where does the recompute run and how is it written?                               | In the repository (`saveAllowance`), one `runBatch` per traveller, changed rows only, no inserts                                                                                                                                                         | Decided by software architect sub-agent (confidence medium): derived data is derived where its source is written; the batch is atomic, bounded and has precedent in `setEntryRange`.                                                                                           |
| 7   | Who may call the writers, and where is the rule?                                  | `requirePlanActor` / `requirePlanOwner` in the repository; non-participants get `NotFoundError`; another traveller's allowance is owner-only and the target must be an accepted plan member and a current workspace member; no workspace-role override   | Decided by security and tenancy sub-agent (confidence medium): a handler-only check cannot protect row-id writers; `userRef` has no foreign key and `removeMember` leaves plan rows behind.                                                                                    |
| 8   | The owner-only refusal class                                                      | `PlanOwnerOnlyError extends RepositoryError`, a diagnostic; not `AuthRequirementError`, not `ForbiddenError`                                                                                                                                             | Applied default, accepted by the security and tenancy panel: repositories import nothing from `src/server/auth`; `ForbiddenError(action, roles)` names workspace roles and plan ownership is not one; the authored-error set stays closed. Overturning it is a review finding. |
| 9   | Name for the leave figure                                                         | "Allowance" in all new names and copy, glossary entries added; repository names unchanged                                                                                                                                                                | Decided by product owner and security sub-agents: `CONTEXT.md` reserves **Entitlement** for billing.                                                                                                                                                                           |
| 10  | The plan's "empty" panel state                                                    | Removed: the viewer's balance is always present; the no-row case is a default tile instead                                                                                                                                                               | Applied default, verified against `getPlanOverview` (`plan.ownerUserId` is always in `balances`).                                                                                                                                                                              |
| 11  | Plan paths that no longer exist: baselines, `shoot.ts`, `scripts/ultrabuild`      | `e2e/product-modules.spec.ts` (no snapshots), `scripts/visual/capture.mjs`, the shared `e2e/helpers`                                                                                                                                                     | Applied default: ADR 0016 and `docs/plans/12-verification-protocol.md` at HEAD.                                                                                                                                                                                                |
| 12  | The plan's `modules.ts` omission, `z.strictObject` wording and `EntitlementPanel` | `modules.ts` in 23 locales is owned; validators reuse the repository schemas (`z.object`); the component is `AllowancePanel`                                                                                                                             | Applied default: `docs/SPEC.md` §9; the repository schemas are not strict; `CONTEXT.md` vocabulary.                                                                                                                                                                            |
| 13  | How does the screen get the allowance context while `library.ts` is `08-S3`'s?    | A new GET `loadVacayAllowance` in `-server/vacay.ts`, run **after** `loadVacay` with its plan id                                                                                                                                                         | Applied default (plan's wave-1 allocation of `library.ts`); sequential because two concurrent `ensurePlan` calls race on `vacay_plans_org_owner_unq` (architect panel).                                                                                                        |
| 14  | Ship the three display switches (weekends, public holidays, company holidays)?    | No: the dialog has the carry-over setting and the default allowance; the three move to `08-S5`; `ADD-02` closes with that stage                                                                                                                          | Decided by UX panel sub-agent, verified by grep (`vacay.tsx` reads only `carryOverEnabled`): a control with no visible effect is a placeholder (`docs/SPEC.md` §7.5).                                                                                                          |
| 15  | Does the inline editor commit on blur?                                            | No: explicit Save / Cancel icon buttons plus `Enter` / `Escape`; unchanged blur closes, changed blur keeps the editor open                                                                                                                               | Decided by UX and accessibility panel sub-agents: iOS numeric keypads have no return or `Escape`, and a Cancel tap would blur-commit first.                                                                                                                                    |
| 16  | Dialog control for the carry-over setting                                         | `Checkbox` under Save / Cancel, not `Switch`                                                                                                                                                                                                             | Decided by accessibility panel sub-agent: `src/components/ui/switch.tsx` reserves `Switch` for immediate effect.                                                                                                                                                               |
| 17  | A row-less year, and a typed opening balance superseded by an earlier year        | The panel shows the walked carry for a row-less year (no write); a superseded typed value is reported and announced, never silent                                                                                                                        | Decided by product owner, UX and architect panel sub-agents.                                                                                                                                                                                                                   |
| 18  | Ticket cut                                                                        | Three tickets, each a full path from repository to screen (allowance, carry-over, settings); fold to two if one does not fit                                                                                                                             | Decided by product owner panel sub-agent: a repository-only first ticket is a layer, not a slice (`SDLC.md`, `afk-to-tickets`).                                                                                                                                                |

Panel verdicts, round 1: product owner, software architect, security and tenancy, accessibility and UX specialists each answered
**approve with conditions**; every condition is applied in this revision (rows 8, 13 to 18 and the sections above).
