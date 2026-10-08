# Leave planner: set your allowance, carry the leftover, and the plan's own settings

| Field              | Value                                    |
| ------------------ | ---------------------------------------- |
| **Status**         | ready                                    |
| **Issue**          | none                                     |
| **Spec PR**        | none                                     |
| **Implementation** | none                                     |
| **Plan**           | 08-S1 (docs/plans/08-product-modules.md) |

## 📝 TLDR

Plan stage `08-S1` takes reference row `ADD-02` from `partial` to `done`. The leave planner (`/vacay`) shows a traveller's
allowance, their used days and the days carried in from last year, and lets them change none of it: the repository
functions that would write an allowance or the plan's switches exist and no server function reaches them. This stage adds
the write half:

1. **Set your allowance in place.** The "Days" tile of the allowance panel becomes an inline editor. The "Carried" tile does
   too, but only where it is an opening balance (the traveller has no row for the year before), because every other year's
   carried-over figure is derived.
2. **The leftover follows the traveller.** Whole days left at the end of one year become the next year's carried-over figure,
   recomputed in the same request as any write that changes them.
3. **The plan's own settings.** A dialog with four switches (block weekends, public holidays, company holidays, carry-over)
   and a default allowance, for the plan's owner.

No schema change, no migration, no route added, no package added. **Three tickets**, in this order: the carry-over walk and
the guarded repository writes (08-S1a), edit your allowance (08-S1b), the plan settings dialog (08-S1c).

This spec describes the work that is **left** at HEAD (`ee99d50d`). It departs from the plan's stage block where the code the
plan cites has changed or a specialist found the plan wrong. Every departure is a row of the Resolved assumptions table.

## 📝 Problem Statement

What exists at HEAD, measured:

- **A read-only screen over a complete data layer.** `src/routes/_app/vacay.tsx` renders `loadVacay`
  (`src/routes/_app/-server/library.ts`). `src/server/repos/vacay.ts` exports `updatePlan`, `setEntitlement`, `setEntry`,
  `setEntryRange`, `removeEntry`, `addCompanyHoliday`, `addHolidayCalendar`, `invitePlanMember`, `setPlanMemberStatus` and
  `setUserColour`; `grep` finds no production caller of any of them (the dev seeder and the repository suites reach them).
  This stage reaches `updatePlan` and `setEntitlement`.
- **A carried-over figure nothing maintains.** `vacay_user_years.carried_over_days` is a stored `integer NOT NULL` column
  (`src/server/db/schema.ts`, table `vacay_user_years`) and `getPlanOverview` reads it. Nothing computes it: a traveller's
  leftover days do not follow them into the next year.
- **Half days make the leftover fractional.** `ENTRY_KIND_COST` in `vacay.ts` costs a `half_day` entry 0.5, while
  `entitlement_days` and `carried_over_days` are integers behind `>= 0` CHECKs. `setEntitlementInput` caps both at 365, so
  `365 + 365 - 0` is a legal leftover that the input schema refuses to store.
- **`vacay_years` is a table nobody reads.** `ensureYear` and `listYears` are reached by the dev seeder and the suites only.
  The plan's walk "from the earliest `vacay_years` row" would visit nothing in production. The data a walk needs is on
  `vacay_user_years` (entitlement, carried) and `vacay_entries` (used).
- **Two writers with no actor check.** `updatePlan` and `setEntitlement` resolve the plan with `requireById`, which proves the
  plan is in the caller's workspace and nothing more. `setEntitlementInput.userId` is a caller-supplied id with no foreign key
  (`userRef` is a bare `text` column), so any workspace member who knows a plan id could write an allowance row for any
  string, or flip another traveller's carry-over switch.
- **A word that already means something else.** `CONTEXT.md` defines **Entitlement** as a capability granted by the billing
  plan. The panel is labelled "Entitlement {year}" (`vacay.tsx`) and the plan names its new component `EntitlementPanel`. The
  leave figure is an **allowance** in everything new this stage writes; the existing repository names (`setEntitlement`,
  `entitlement_days`) stay.
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

| Owned (this stage writes it)                                                                                                                                                       | Not owned (read only, or left alone)                                                                                                       |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/vacay/carry-over.ts` - new, pure: the one carry-over walk, its rounding rule and `wholeDaysThatCarry`                                                                     | `src/server/db/schema.ts`, `drizzle/` - **no schema change, no migration**                                                                 |
| `src/lib/vacay/__tests__/carry-over.test.ts` - new                                                                                                                                 | `src/routes/_app/-server/library.ts` - held by `08-S3` in this wave; `loadVacay` is **not** edited                                         |
| `src/server/repos/vacay.ts` - edit: `requirePlanActor`, `requirePlanOwner`, `listUserYearsForUser`, `saveAllowance`, `recomputeCarryOver`, `updatePlanSettings`, two error classes | `setEntry`, `setEntryRange`, `removeEntry`, `invitePlanMember`, `setPlanMemberStatus`, `removePlanMember`, `deletePlan` (`08-S5`, `08-S8`) |
| `src/routes/_app/-server/vacay.ts` - new: `loadVacayAllowance`, `setAllowanceFn`, `updateVacayPlanFn` (grown by `08-S5`, `08-S8`)                                                  | `src/routes/_app/-ui/scaffold.tsx`, `-lib/format.ts`, `-lib/tone.ts` - imported, not touched                                               |
| `src/routes/_app/-server/__tests__/vacay.test.ts` - new                                                                                                                            | `src/server/billing/**`, `src/lib/plans.ts` - no quota, no `MODULE_KEYS` entry (`08-S10` states that once for the plan)                    |
| `src/routes/_app/vacay.tsx` - edit: mounts the two components, loads the allowance context, extends `VacayPending`; the month grid is untouched                                    | `e2e/helpers/**` - reused, not edited                                                                                                      |
| `src/components/vacay/allowance-panel.tsx`, `plan-settings-dialog.tsx`, `index.ts` - new (the module's directory, `docs/SPEC.md` §6)                                               | `src/components/ui/**`, `src/styles/tokens.css` - no primitive and no token is missing                                                     |
| `src/components/vacay/__tests__/allowance-panel.test.tsx`, `plan-settings-dialog.test.tsx` - new                                                                                   | `src/lib/i18n/messages/en/shell.ts` (`nav.vacay`)                                                                                          |
| `src/lib/i18n/messages/<locale>/modules.ts` - edit, **all 23 locales**                                                                                                             |                                                                                                                                            |
| `src/server/repos/__tests__/tenant-isolation.test.ts` - append one `describe`; `repositories.test.ts` - append the `saveAllowance` / `recomputeCarryOver` cases                    |                                                                                                                                            |
| `e2e/product-modules.spec.ts` - new: this plan's spec file (`docs/plans/12-verification-protocol.md` §4: one file per plan, named from `08-product-modules.md`)                    |                                                                                                                                            |

Departures from the plan's owned paths (Resolved assumptions 5, 7, 9, 11): the walk lives in `src/lib/vacay/`, not
`src/components/vacay/carry-over.ts`; `modules.ts` in all 23 locales joins the list (the plan forgot the catalogue);
`e2e/product-modules.spec.ts` replaces `product-modules.visual.spec.ts` and the four re-recorded `vacay-*` PNGs, because ADR
0016 removed the baselines; and `vacay.tsx` gets its allowance context from a new GET function instead of an edit to
`loadVacay`.

### The allowance, in the traveller's terms

- A traveller has, for each year, an **allowance** (days they may take), a **carried-over** figure (whole days brought in
  from the year before), **used** days (derived from their entries) and **days left** (derived). Only the first two are stored.
- **The "Days" tile is always editable** by its owner. A traveller who never set one sees the plan's default allowance, marked
  as the default; the first save writes a row.
- **The "Carried" tile is editable only as an opening balance.** It is an opening balance when the traveller has **no row for
  the previous calendar year** (the first year they used the planner, or the first after a gap). In every other year it is
  derived and read-only, captioned "Carried from {year}". A typed value could never survive there: the next edit of an
  earlier year would overwrite it.
- **Only whole days carry.** The leftover of a year is `entitlement + carried - used`; the next year's carried-over is that
  value floored, clamped at `0` (a debt never carries) and capped at `365` (the stored maximum). When flooring drops half a
  day the panel says so in one line, and only then.
- **Carry-over off hides, it does not erase.** Stored carried-over figures are maintained whatever the plan's carry-over
  switch says; the switch only changes what is displayed (`getPlanOverview` already zeroes the figure). Turning it off and on
  again therefore loses nothing, and flipping it needs no recompute.
- **Half-day allowances are not supported.** The allowance is a whole number of days from 0 to 365, as the column is.

### Who may do what

One rule, in the repository, because the writers that follow (`08-S5`, `08-S8`) must not be able to forget it:

- `requirePlanActor(scope, planId)` resolves the plan inside the workspace and returns it with `isOwner`. The caller must be
  the plan's **owner** or an **accepted** member (`pending` and `declined` grant nothing). Anyone else in the workspace gets
  `NotFoundError`: a plan you may not see looks like a plan that does not exist (`CONTEXT.md`, **Trip member**, applied here).
- `requirePlanOwner(scope, planId)` is that, plus `isOwner`, else `PlanOwnerOnlyError` (a `RepositoryError`; a diagnostic, so
  the reader sees the caller's localised fallback and `AUTHORED_ERROR_NAMES` stays closed, `docs/SPEC.md` §9 rule 10).
- **Your own allowance:** `requirePlanActor`. **Someone else's** (an explicit `userId` other than the caller): owner only, and
  the target must be an accepted plan member **and** a current workspace member (`getMembership`), else `NotFoundError` with
  nothing written. The workspace role (`owner` / `admin` / `member`) gives no override: a leave plan is personal, as a trip's
  people are.
- **Plan settings:** `requirePlanOwner`. A plan member sees the dialog read-only; that view ships with `08-S8`, which is the
  first stage that makes another person's plan visible. Today `loadVacay` loads only the caller's own plan.
- The server refuses; hiding a control is not the guard.

### Phase 1 (08-S1a) - the carry-over walk and the guarded repository writes

Backend only, fully tested at the repository, no screen change.

**`src/lib/vacay/carry-over.ts` (new, pure, no React, no server imports).** The one owner of the rule (`docs/SPEC.md` §8).

- `walkCarryOver(rows)`: `rows` is one traveller's `{ year, entitlementDays, carriedOverDays, usedDays }`, sorted ascending
  by year. Returns the carried-over figure each row **should** hold. A row with no row for `year - 1` is an opening balance and
  keeps its stored value. Any other row gets `clamp(floor(prev.entitlement + prevCarried - prev.used), 0, 365)`, where
  `prevCarried` is the value this walk just computed, so the leftover compounds down the chain. A missing year breaks the
  chain; the walk never invents a row or bridges a gap.
- `wholeDaysThatCarry(remaining)`: the same clamp-floor-cap on one number, used by the panel to decide whether to show the
  "half a day does not carry" line, so the screen and the walk cannot disagree.

**`src/server/repos/vacay.ts` (edit).** All SQL stays here; every statement is an existing `tenantFilter()`-bound call or a
`createTenantRepository` method.

- `requirePlanActor`, `requirePlanOwner` and `PlanOwnerOnlyError` as above, plus `CarriedOverDerivedError` (a
  `RepositoryError`; thrown when a caller sends `carriedOverDays` for a year that has a predecessor row).
- `listUserYearsForUser(scope, planId, userId)`: the traveller's rows, ascending by year.
- `recomputeCarryOver(scope, planId, userId)`: reads the traveller's rows and their entries **once** (`listVacayEntries`
  without a year, bucketed by calendar year in memory with `ENTRY_KIND_COST`), calls `walkCarryOver`, and writes **only the
  rows whose figure changed**, as one `runBatch` of tenant-filtered `UPDATE`s (`setEntryRange` is the precedent). It inserts
  no row. It is idempotent and returns `[{ year, carriedOverDays }]` for the rows it changed. One batch per traveller is
  atomic (a chain whose middle is stale is the failure to avoid) and each statement binds two or three values, far below
  `MAX_BOUND_PARAMETERS`.
- `saveAllowance(scope, input)`: `input` is `setEntitlementInput`. It resolves the target (`userId ?? caller`), applies the
  actor rules above, **rejects `carriedOverDays` when the year has a predecessor row**, calls the existing `setEntitlement`
  (unchanged: its contract stays "write one row"), then `recomputeCarryOver`. A row inserted for year N+1 while year N has a
  row is seeded by that same recompute, in the same request, so the leftover follows the traveller without a second edit.
- `updatePlanSettings(scope, planId, input)`: `requirePlanOwner`, then the existing `updatePlan`. `updatePlanInput` accepts
  `name`; the settings input is `updatePlanInput.omit({ name: true })`, so the server function never writes a field the
  dialog does not show. Changing the default allowance changes what travellers **without** a row see, and rewrites no stored
  row.

`recomputeCarryOver` is not exposed as a server function and there is no "Recalculate" button (Resolved assumption 4): in this
stage `used` changes only through seeded data, because nothing writes an entry until `08-S5`, and `08-S5`'s entry writes call
`recomputeCarryOver` themselves.

### Phase 2 (08-S1b) - edit your allowance

**`src/routes/_app/-server/vacay.ts` (new).**

- `loadVacayAllowance` (GET, `{ year }`): calls `ensurePlan`, then returns `{ planId, hasRow, openingBalance, previousYear }`
  for the viewer: whether they have a row this year, whether the year is an opening balance for them, and the year to name in
  "Carried from {year}". One indexed read. It exists because `library.ts` is held by `08-S3` this wave; the route loader runs it
  beside `loadVacay` with `Promise.all`.
- `setAllowanceFn` (POST): validator is `setEntitlementInput` (the repository schema, `z.object` like its siblings; the
  plan's `z.strictObject()` is not used because neither repository input is strict and "reuse it" is the stronger instruction).
  The handler is `appScope()` then `saveAllowance`, and returns the recomputed balance list for the year on screen. No
  authorisation lives only here.

**`src/components/vacay/allowance-panel.tsx` (new)** replaces the read-only block at `vacay.tsx` (the "Entitlement" panel).
The oversized numeral, the `Progress` bar and the three figure tiles stay as designed; what changes is in
[UI/UX](#-uiux). The route calls `router.invalidate()` after a save, so the screen shows what the database holds.

### Phase 3 (08-S1c) - the plan settings dialog

- `updateVacayPlanFn` (POST) in `src/routes/_app/-server/vacay.ts`: validator `updatePlanInput.omit({ name: true })` with a
  `planId`; the handler calls `updatePlanSettings` and returns the updated plan row.
- **`src/components/vacay/plan-settings-dialog.tsx` (new):** a `Dialog` with four `Switch` rows and one numeric `Input`,
  opened from a settings `Button` in the `PageHeader` actions beside the year switcher. It is shown to the plan's owner; today
  that is every viewer, because only their own plan loads.
- There is **no preview of what turning carry-over off would cost**: the switch hides figures and erases none, so there is
  nothing to preview.

### Alternatives considered, and why they lost

| Alternative                                                              | Why it lost                                                                                                                                  |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| Walk `vacay_years` as the plan wrote it                                  | No production code writes that table; the walk would visit nothing.                                                                          |
| Two walks (preview in `components`, write in the repository) plus a test | One concept true in two places (`docs/SPEC.md` §8). With the preview gone there is one consumer; the pure walk stays in `src/lib` for tests. |
| A manual-override flag so a typed carried figure survives a recompute    | Needs a column; plan 08 files no migration.                                                                                                  |
| Round half up, or widen the column to hold halves                        | The first credits leave that does not exist; the second is a migration.                                                                      |
| The actor check only in the handler                                      | `08-S5` / `08-S8` writers take only a row id; a check on the client's `planId` cannot protect them. The repository is where trips do it.     |
| Edit `loadVacay` to carry the allowance context                          | `library.ts` is `08-S3`'s in wave 1.                                                                                                         |

## 📝 Architecture

- **One concept, one owner (`docs/SPEC.md` §8).** The carry-over rule and its rounding: `src/lib/vacay/carry-over.ts`.
  Persisting it, and the actor rules: `src/server/repos/vacay.ts` (the only SQL owner). Plan settings values and defaults:
  `vacay_plans` through the existing `updatePlan` and its Zod input. Inline edit and dialog rendering: `src/components/vacay/`,
  which consume `wholeDaysThatCarry` and own no calculation. The server functions validate, forward and own no rule.
- **Seams.** Route loader, then `loadVacay` and `loadVacayAllowance`; a write goes route component, server function,
  `appScope()`, `saveAllowance` / `updatePlanSettings`, repository functions. The repository does not import from
  `src/server/auth`, so the owner-only refusal is a repository error class, not `AuthRequirementError`.
- **`components/ui` never fetches or imports `server/`**; the new components call the server functions through the route's
  existing `useServerFn` pattern and take plain props.
- **Cloudflare cost.** A write is one point read of the plan, one of the member rows, the existing upsert, one entries read for
  the traveller, and at most one batch of single-digit `UPDATE`s. Nothing is queued, no realtime patch.

## 📝 Data Model

**No schema change and no migration.** Written columns: `vacay_user_years.entitlement_days`, `carried_over_days`;
`vacay_plans.block_weekends`, `holidays_enabled`, `company_holidays_enabled`, `carry_over_enabled`,
`default_entitlement_days`. No index is added: reads and writes are by `(organization_id, plan_id, user_id, year)`, served by
the `(organization_id, plan_id)` prefix of `vacay_user_years_org_plan_idx` with a residual scan of a plan's member count; the
unique `(plan_id, user_id, year)` index carries no tenant column and is not the tenant guard (the guard is `tenantFilter()`
and the insert stamp). It does make `setEntitlement`'s read-then-write safe under a race: two concurrent first saves collide on
it instead of leaving two rows.

## 📝 API Contracts

| Function             | Method | Input                                                                                       | Output                                             |
| -------------------- | ------ | ------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| `loadVacayAllowance` | GET    | `{ year }`                                                                                  | `{ planId, hasRow, openingBalance, previousYear }` |
| `setAllowanceFn`     | POST   | `setEntitlementInput` (`planId`, `userId?`, `year`, `entitlementDays?`, `carriedOverDays?`) | the year's `VacayBalance` list after the recompute |
| `updateVacayPlanFn`  | POST   | `{ planId } & updatePlanInput.omit({ name })`                                               | the updated plan row                               |

Errors: a plan the caller may not see, or a target who is not a current member, is `NotFoundError`; a non-owner changing
settings or someone else's allowance is `PlanOwnerOnlyError`; `carriedOverDays` for a derived year is
`CarriedOverDerivedError`. All three reach the reader as the screen's localised fallback; the UI never offers the action.

## 📝 UI/UX

Route `/vacay` (`src/routes/_app/vacay.tsx`) exists: no route file, no `pnpm generate-routes`. SSR stays the default.

- **Allowance panel.** Reuses `Progress`, `Button`, `Input`, `Alert`, `Panel`. "Days" and (when an opening balance) "Carried"
  are `<button>` tiles carrying `data-part="allowance-tile"` and `data-field="entitlement" | "carried"`. Pressing one swaps the
  figure for a numeric `Input` (`inputMode="numeric"`, whole numbers 0 to 365) in place; `Enter` or blur commits, `Escape`
  cancels, focus returns to the tile. Every numeral keeps `tabular-nums` so the swap does not reflow the row.
- **Tile states.** A default (no row): the tile shows the plan default with the caption "Default allowance. Select to set
  your own." Derived "Carried": read-only, captioned "Carried from {year}". Carry-over switched off: "Carried" is muted and
  read-only, captioned "Carry-over is off". When the walk floored half a day: one line, "Only whole days carry into the next
  year; the leftover half day does not." There is no "empty" state: the viewer's balance is always present (the plan's owner
  is always in `balances`), so the plan's "Set an allowance..." copy and its branch are deleted, not restyled.
- **Saving, error.** The committing tile takes `aria-busy` and keeps its last value; a failed write keeps the field open with
  the typed value, shows a `danger` `Alert` inside the panel (`role="alert"`) naming what failed, and offers "Try again". A
  success is announced in a polite live region ("Allowance saved."). The loader's own failure keeps the existing `ErrorPanel`.
- **Settings dialog.** `Dialog` primitive (focus trap, `Escape`, focus returns to the settings button): title, one-line
  description, four `Switch` rows each with a visible label and hint, one number `Input` labelled "Default allowance (days per
  year)" with the note that it applies to years where the traveller has not set their own, and Save / Cancel. Save takes
  `loading`. At 360px it becomes a full-height sheet.
- **Skeleton.** `VacayPending` is extended with the panel's control row so skeleton and settled layout have the same height.
- **Motion.** Tile-to-input swap: 150ms opacity plus 2px translate on `--ease-out-quint`; the dialog uses the primitive's own.
  `prefers-reduced-motion: reduce` collapses both to opacity. No layout-affecting property animates.
- **Tokens.** None missing. The one non-token colour is a traveller's stored swatch (`inkOn()` in `-lib/tone.ts`).
- **Accessibility.** Each tile's name states the field, the value and the action ("Edit days, currently 25"); the input is
  labelled "{field} for {year}"; switches have programmatic names and hints (`aria-describedby`); status and error are live
  regions; contrast meets WCAG 2.2 AA in both themes; touch targets are at least 24px (target size, 2.5.8).

## 📝 Visual change expected

Route `/vacay`, light and dark, desktop (1280) and mobile (360), plus 2560:

- Resting: the allowance panel gains a control affordance on "Days" (and "Carried" when an opening balance), a settings button
  in the page header actions, and the panel's label reads "Allowance {year}".
- Editing: a tile swapped for an input (`--state editing`, click `[data-part="allowance-tile"][data-field="entitlement"]`).
- Settings open (`--state settings`, click `[data-part="vacay-settings"]`); at 360px a full-height sheet.
- Skeleton: the extended `VacayPending`. Error: the in-panel `Alert`, reached with `page.route()` failing the write.

The month grid, legend and traveller list do not change.

## 📝 Copy

New keys in `src/lib/i18n/messages/en/modules.ts` (namespace `modules`, prefix `vacay.`), each landing in all 23 locales in the
same change (`i18n-messages` skill; the parity test enforces it). "Allowance" is the traveller's word; **Entitlement** is the
billing term and is not used.

| Key                                    | `en` text                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------- |
| `vacay.allowance.label`                | `Allowance {year}`                                                          |
| `vacay.allowance.daysLeft`             | plural: `{count} day left` / `{count} days left`                            |
| `vacay.allowance.tile.days`            | `Days`                                                                      |
| `vacay.allowance.tile.used`            | `Used`                                                                      |
| `vacay.allowance.tile.carried`         | `Carried`                                                                   |
| `vacay.allowance.tile.edit`            | `Edit {field}, currently {value}`                                           |
| `vacay.allowance.input.label`          | `{field} for {year}`                                                        |
| `vacay.allowance.input.invalid`        | `Enter a whole number from 0 to 365.`                                       |
| `vacay.allowance.default.hint`         | `Default allowance. Select to set your own.`                                |
| `vacay.allowance.carried.from`         | `Carried from {year}`                                                       |
| `vacay.allowance.carried.opening`      | `Days brought in from before`                                               |
| `vacay.allowance.carried.off`          | `Carry-over is off`                                                         |
| `vacay.allowance.carried.wholeDays`    | `Only whole days carry into the next year; the leftover half day does not.` |
| `vacay.allowance.saved`                | `Allowance saved.`                                                          |
| `vacay.allowance.error`                | `Your allowance could not be saved.`                                        |
| `vacay.allowance.retry`                | `Try again`                                                                 |
| `vacay.settings.open`                  | `Plan settings`                                                             |
| `vacay.settings.title`                 | `Leave plan settings`                                                       |
| `vacay.settings.description`           | `How days are counted in your leave plan.`                                  |
| `vacay.settings.blockWeekends`         | `Block weekends`                                                            |
| `vacay.settings.blockWeekends.hint`    | `Weekends cannot be marked as leave.`                                       |
| `vacay.settings.holidays`              | `Public holidays`                                                           |
| `vacay.settings.holidays.hint`         | `Show public holidays on the calendar.`                                     |
| `vacay.settings.companyHolidays`       | `Company holidays`                                                          |
| `vacay.settings.companyHolidays.hint`  | `Show the days your company is closed.`                                     |
| `vacay.settings.carryOver`             | `Carry unused days into the next year`                                      |
| `vacay.settings.carryOver.hint`        | `Turning this off hides carried days; it does not erase them.`              |
| `vacay.settings.defaultAllowance`      | `Default allowance (days per year)`                                         |
| `vacay.settings.defaultAllowance.hint` | `Applies to years where you have not set your own allowance.`               |
| `vacay.settings.save`                  | `Save settings`                                                             |
| `vacay.settings.cancel`                | `Cancel`                                                                    |
| `vacay.settings.saved`                 | `Plan settings saved.`                                                      |
| `vacay.settings.error`                 | `The plan settings could not be saved.`                                     |

The settings copy says "your leave plan", never "owner", so nobody reads it as the workspace role.

## 📝 Edge Cases & Failure Scenarios

| Case                                                | Behaviour                                                                                                                           |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Leftover is `365 + 365 - 0`                         | Next year's carried-over is capped at 365; the recompute never throws a `ZodError` mid-chain.                                       |
| Used exceeds the allowance                          | Leftover is negative; carried-over is `0`; days left shows the debt for the year that incurred it.                                  |
| Leftover `4.5`                                      | Carries `4`; the panel shows the whole-days line.                                                                                   |
| A year with no row between two rows                 | The chain breaks; the later year is an opening balance, editable.                                                                   |
| Editing an earlier year's allowance                 | Every later derived year is rewritten in the same request, stopping at the first missing row.                                       |
| `carriedOverDays` sent for a derived year           | `CarriedOverDerivedError`, nothing written.                                                                                         |
| Two tabs save at once                               | Last write wins on the tile; the recompute is idempotent and converges; first-save race hits the unique index, not a duplicate row. |
| The write succeeds and the recompute batch fails    | The stored chain is stale until the next write on it (each write re-runs the walk); the error is reported.                          |
| Target `userId` left the workspace or never existed | `NotFoundError`, no row written, even when a stale `vacay_plan_members` row remains.                                                |
| Plan owner leaves the workspace                     | Their plan and rows remain and nobody can change the settings. Recorded for `08-S8` (Out of scope).                                 |
| Pending or declined plan member calls a write       | `NotFoundError`.                                                                                                                    |
| Carry-over switched off then on                     | Stored figures were maintained throughout; nothing is lost and nothing needs recomputing.                                           |

## ✅ Acceptance criteria

1. `walkCarryOver` compounds the leftover down a chain, floors it, clamps at 0, caps at 365, breaks at a gap year and leaves an
   opening balance's stored value alone; `wholeDaysThatCarry` agrees with it on every input (a shared table test).
2. `saveAllowance` writes the row, rejects a carried-over figure for a derived year, rewrites only the changed later rows in
   one batch, inserts none, and seeds a newly inserted year's carried-over from the year before.
3. The repository actor rules hold: non-member and `pending` member get `NotFoundError`; a member editing a colleague gets
   `PlanOwnerOnlyError` while the owner's identical call succeeds; a target who left the workspace or never existed writes
   nothing; a member changing the plan settings is refused.
4. On `/vacay` a traveller sets their allowance and, where it is an opening balance, their carried-over figure; the figures
   update from the database after the write; `Enter` commits, `Escape` cancels, keyboard alone reaches and operates the tile.
5. A failed write keeps the typed value, shows the alert and offers a retry; a success is announced.
6. The settings dialog saves the four switches and the default allowance for the plan's owner and the screen reflects them;
   turning carry-over off zeroes the displayed "Carried" and turning it on restores it with no recompute.
7. The panel's half-day line appears exactly when `wholeDaysThatCarry` differs from the leftover.
8. Tenant isolation: in A's scope, against B's plan id, `updatePlan`, `saveAllowance`, `recomputeCarryOver`, `ensureYear` and
   `updatePlanSettings` reject with `NotFoundError` and B's `vacay_plans`, `vacay_years`, `vacay_user_years` rows are
   byte-identical afterwards; `getPlanOverview` in B's scope for A's plan id is `NotFoundError`; `listUserYears(scopeB,
aPlanId, year)` is `[]` (the distinction matters: `requireById` throws, `findMany` returns `[]`); `saveAllowance` in A's scope
   with an explicit `userId` belonging to B writes nothing, and B's `vacay_user_years` count is unchanged.
9. All copy exists in 23 locales; no console message on `/vacay`; zero layout shift after settle; both themes at 360, 1280, 2560.

## 📝 Risks & Impact Review

- **New write paths acting on another person's data from client-sent ids (`planId`, `userId`).** The panel's security verdict
  is risk-medium, not high: the workspace filter is untouched, there is no migration, no quota and no money. Mitigation: the
  actor rules sit in the repository and are tested before any screen uses them (Phase 1).
- **Existing writers are still open.** `setEntry`, `setEntryRange`, `removeEntry`, `setPlanMemberStatus`, `removePlanMember`,
  `invitePlanMember`, `setUserColour` and `deletePlan` check only the workspace. Nothing calls them yet. `08-S5` and `08-S8`
  must put `requirePlanActor` / `requirePlanOwner` in front of each before they get a caller (named under Out of scope).
- **The floored half day is a visible loss.** It is explained in one line, and reversible: the figure is derived, so widening
  the column later and recomputing restores halves.
- **Backward compatibility.** Additive only: new exports and functions, no signature changed, `setEntitlement` untouched.

### Out of scope

- The month grid, entries, the week start wiring, localising the rest of `vacay.tsx` (`08-S5`). Its entry writes call
  `recomputeCarryOver` and the new actor helpers.
- Inviting plan members, the read-only settings view for a member, and what becomes of a plan whose owner leaves the
  workspace (`removeMember` leaves every `vacay_*` row behind): `08-S8` decides keep, reassign or remove.
- A "Recalculate" action, a carry-over cost preview, half-day allowances, any module entitlement gate (`08-S10`).

## 📋 Phasing

| Phase | Ticket | Slice a person can see work                                      |
| ----- | ------ | ---------------------------------------------------------------- |
| 1     | 08-S1a | The leftover carries (repository and tests; no UI)               |
| 2     | 08-S1b | A traveller sets their allowance and opening balance on `/vacay` |
| 3     | 08-S1c | The plan owner changes the plan's switches and default allowance |

## 📋 Implementation Plan

### Phase 1 - the carry-over walk and the guarded repository writes (08-S1a)

1. `src/lib/vacay/carry-over.ts` and its test, test first (table of cases from Edge Cases).
2. `requirePlanActor`, `requirePlanOwner`, the two error classes, `listUserYearsForUser`, `recomputeCarryOver`,
   `saveAllowance`, `updatePlanSettings` in `src/server/repos/vacay.ts`; cases in `repositories.test.ts`.
3. The tenant-isolation `describe` and the actor-rule cases.

### Phase 2 - edit your allowance (08-S1b)

1. `src/routes/_app/-server/vacay.ts` (`loadVacayAllowance`, `setAllowanceFn`) and `__tests__/vacay.test.ts`.
2. `allowance-panel.tsx`, `index.ts`, the `vacay.tsx` edit, the extended `VacayPending`, and the `modules.ts` keys in 23 locales.
3. `e2e/product-modules.spec.ts` with a `test.describe('08-S1 ...')` for the allowance.

### Phase 3 - the plan settings dialog (08-S1c)

1. `updateVacayPlanFn` and its tests.
2. `plan-settings-dialog.tsx`, the header button, the settings keys in 23 locales.
3. The dialog's `test.describe` in the same spec file.

## Verification

- The gate in `validation.commands` (`.ai/agentic.config.json`) on every phase's last commit.
- Unit: `src/lib/vacay/__tests__/carry-over.test.ts`; `src/routes/_app/-server/__tests__/vacay.test.ts` (non-member
  `NotFoundError`, `pending` refused, member-edits-colleague refused while the owner's call succeeds, target who left or never
  existed writes nothing, `updateVacayPlanFn` by a non-owner refused); `allowance-panel.test.tsx` (tile commits on `Enter`,
  reverts on `Escape`, reachable by keyboard, a rejected write keeps the typed value and renders the alert, the half-day line
  appears only when it should); `plan-settings-dialog.test.tsx`.
- Repository: `saveAllowance` rewrites only the changed rows, inserts none, and the written values equal `walkCarryOver`'s
  output for the same rows (replaces the plan's preview-equals-write test).
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

| #   | Question                                                                       | Applied default                                                                                                                                                                                                                                              | Why                                                                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | A half-day leftover meets an integer column: what carries?                     | `clamp(floor(leftover), 0, 365)`, with a one-line explanation shown only when flooring dropped a half day                                                                                                                                                    | Decided by product owner sub-agent (confidence medium): never credits leave that does not exist; reversible by recompute if the column is ever widened; the cap avoids a mid-chain `ZodError`.                                                                                                    |
| 2   | The "Carried" tile is editable and derived: which wins?                        | Editable only when the traveller has no row for the previous year (opening balance); derived and read-only otherwise; enforced in the repository; a write recomputes later years in the same request; a newly inserted year is seeded by that recompute      | Decided by product owner sub-agent (confidence high), architect concurring on recompute in the repository: avoids a silent overwrite and a new column.                                                                                                                                            |
| 3   | Who changes the plan settings?                                                 | The plan's owner only; a member's read-only view ships with `08-S8`                                                                                                                                                                                          | Decided by product owner and security and tenancy sub-agents (confidence high): the settings change every member's display; narrowest and easiest to widen.                                                                                                                                       |
| 4   | Keep the plan's "Recalculate" action and the cost-of-turning-off preview?      | Dropped; stored carried-over is maintained regardless of the switch                                                                                                                                                                                          | Decided by product owner sub-agent (confidence high): nothing real to recalculate until `08-S5`; the switch hides, it does not erase, so there is nothing to preview.                                                                                                                             |
| 5   | Where does the pure walk live?                                                 | `src/lib/vacay/carry-over.ts`, one implementation; the chain is the traveller's `vacay_user_years` rows, not `vacay_years`                                                                                                                                   | Decided by software architect sub-agent (confidence high): `docs/SPEC.md` §8; `vacay_years` has no production writer.                                                                                                                                                                             |
| 6   | Where does the recompute run and how is it written?                            | In the repository (`saveAllowance`), one `runBatch` per traveller, changed rows only, no inserts                                                                                                                                                             | Decided by software architect sub-agent (confidence medium): derived data is derived where its source is written; the batch is atomic, bounded and has precedent in `setEntryRange`.                                                                                                              |
| 7   | Who may call the writers, and where is the rule?                               | `requirePlanActor` / `requirePlanOwner` in the repository; non-participants get `NotFoundError`; another traveller's allowance is owner-only and the target must be an accepted plan member and a current workspace member; workspace roles give no override | Decided by security and tenancy sub-agent (confidence medium): a handler-only check cannot protect row-id writers; `userRef` has no foreign key and `removeMember` leaves plan rows behind.                                                                                                       |
| 8   | The owner-only refusal class                                                   | `PlanOwnerOnlyError extends RepositoryError`, a diagnostic; not `AuthRequirementError`                                                                                                                                                                       | Applied default: the panel suggested `AuthRequirementError('insufficient-role', ...)`, but repositories import nothing from `src/server/auth` and the UI never offers the action, so the localised fallback suffices and the authored-error set stays closed. Overturning it is a review finding. |
| 9   | Name for the leave figure                                                      | "Allowance" in all new names and copy; repository names unchanged                                                                                                                                                                                            | Decided by product owner and security sub-agents: `CONTEXT.md` reserves **Entitlement** for billing.                                                                                                                                                                                              |
| 10  | The plan's "empty" panel state                                                 | Removed: the viewer's balance is always present; the no-row case is a default tile instead                                                                                                                                                                   | Applied default, verified against `getPlanOverview` (`plan.ownerUserId` is always in `balances`).                                                                                                                                                                                                 |
| 11  | Plan paths that no longer exist: baselines, `shoot.ts`, `scripts/ultrabuild`   | `e2e/product-modules.spec.ts` (no snapshots), `scripts/visual/capture.mjs`, the shared `e2e/helpers`                                                                                                                                                         | Applied default: ADR 0016 and `docs/plans/12-verification-protocol.md` at HEAD.                                                                                                                                                                                                                   |
| 12  | The plan's `modules.ts` omission and `z.strictObject` wording                  | `modules.ts` in 23 locales is owned; validators reuse the repository schemas (`z.object`), `name` omitted from the settings input                                                                                                                            | Applied default: `docs/SPEC.md` §9; the repository schemas are not strict; the dialog has no name field.                                                                                                                                                                                          |
| 13  | How does the screen get the allowance context while `library.ts` is `08-S3`'s? | A new GET `loadVacayAllowance` in `-server/vacay.ts`, run beside `loadVacay`                                                                                                                                                                                 | Applied default: the plan's own wave-1 allocation of `library.ts`.                                                                                                                                                                                                                                |
