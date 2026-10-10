# Leave planner: log a day, a run of days and the company's days on the year grid

| Field              | Value                                    |
| ------------------ | ---------------------------------------- |
| **Status**         | ready                                    |
| **Issue**          | none                                     |
| **Spec PR**        | none                                     |
| **Implementation** | none                                     |
| **Plan**           | 08-S5 (docs/plans/08-product-modules.md) |

## 📝 TLDR

Plan stage `08-S5` is the month-grid half of the leave planner (reference rows `ADD-03`, and `ADD-02` which the allowance spec
hands to this stage). Today `/vacay` draws twelve month grids and a traveller can click none of them: a day is a `<span title=...>`,
and the repository writers that would record a day, a run of days or a company holiday have no caller. This stage turns the grid
into the way a traveller records leave, as **six tickets that are each a full path from repository to screen**:

1. **08-S5a - log and clear one of your own days.** A day is a button; activating it opens a kind picker (leave, half day, sick,
   remote, public holiday, other) with what each kind costs; the year is one keyboard grid; a failed write reverts and says so; the
   atomic, guarded repository writers behind it; the carry-over recompute after every write.
2. **08-S5b - the year reads in your week and your language.** The week start comes from the settings that already exist (a Sunday
   workspace reads a Sunday-first year, weekends move with it) and the rest of the screen's English literals become catalogue keys.
3. **08-S5c - log and clear a run of days.** A two-tap "from / to" that works for touch, mouse, keyboard and screen reader alike
   (Shift+arrows and mouse drag as shortcuts), one atomic chunked write, a 366-day cap, and one "Clear" for the selection.
4. **08-S5d - trips you are on show through.** A marker on the days a trip of the viewer's occupies, read only from trips the viewer is
   a member of.
5. **08-S5e - company holidays.** A mode control, shown to the plan's owner, in which the same gestures record or clear a company
   holiday.
6. **08-S5f - the plan's two display switches.** "Block weekends" and the company-holiday switch, as rows in the allowance spec's
   settings dialog and honoured by every path above. Closes `ADD-02`.

No schema change, no migration, no route added, no package added, no queue message.

**What is deliberately not here.** Public holidays from an external source (no day rows exist anywhere in the schema and there is no
feed), and therefore any control for the holiday-calendar subscriptions and the third display switch (`holidaysEnabled`): a control
that paints nothing is a placeholder (`docs/SPEC.md` §7.5). `ADD-03` therefore stays `partial` (Resolved assumption 1).

This spec describes the work that is **left** at HEAD (`4ed3a555`). It departs from the plan's stage block wherever the code the
plan cites has changed or a specialist found the plan wrong; every departure is a row of the Resolved assumptions table. It builds on
the merged allowance spec (`.ai/specs/2026-10-08-leave-planner-allowances-and-carry-over.md`, tickets 08-S1a, 08-S1b and 08-S1c),
**which is not implemented at HEAD**: the guards, `src/routes/_app/-server/vacay.ts`, `src/components/vacay/` and the carry-over
recompute do not exist yet, so each ticket here is blocked by the allowance ticket it needs (Phasing). Later stages are named here by
what they ship (the shared-plan stage, the journal stage), never by id: the backlog reads any mention of a stage id in a spec as that
stage being specified already.

## 📝 Problem Statement

Verified against the repository at HEAD:

- **A read-only grid.** `src/routes/_app/vacay.tsx` renders `loadVacay` (`src/routes/_app/-server/library.ts`). A day cell is a
  `<span title={label}>` (neither focusable nor announced); the kind of a marked day appears only in that `title` and in the month's
  badge row, and every kind is painted in the traveller's own colour, so a sick day and a leave day look the same. Month and weekday
  names are English literals (`MONTH_NAMES`, `WEEKDAY_INITIALS`), the header is Monday-first, and `loadVacay` publishes an unread
  `weekStartsOn: 1`.
- **Complete writers nobody calls.** `src/server/repos/vacay.ts` exports `setEntry`, `setEntryRange`, `removeEntry`,
  `addCompanyHoliday`, `removeCompanyHoliday`, `addHolidayCalendar` and `removeHolidayCalendar`. `grep` finds callers only in the dev
  seeder (`src/routes/api/dev/-seed/apply.ts`) and the repository suites.
- **`setEntryRange` is not atomic and fails on a fortnight.** It runs the updates of existing days through `runBatch`, then inserts
  the missing days with a separate `vacayEntriesRepository.insertMany`. `insertMany` is one unchunked `INSERT ... VALUES`; a
  `vacay_entries` row binds seven to nine parameters and D1 refuses a statement with more than 100 (`MAX_BOUND_PARAMETERS`,
  `src/server/repos/batch.ts`), so more than eleven or twelve new days fail, after the updates have already committed. The plan's
  "one D1 batch, one transaction" is wrong at HEAD. `calendarRange` also silently truncates at 732 days instead of refusing.
- **Row-id removers check only the workspace.** `removeEntry(scope, entryId)` and `removeCompanyHoliday(scope, id)` call
  `requireRemove`; every writer resolves the plan with `requireById`, which proves the plan is in the workspace and nothing more.
  `setEntryInput.userId` is a caller-supplied id with no foreign key.
- **The plan's trip read would leak.** The plan filters `trips` with `tenantFilter()` only, but a trip is private to its members unless
  its `visibility` is `organization` (ADR 0007; `readableTripFilter`, `memberTripIds` in `src/server/repos/trips.ts`). A tenant-only
  read would give a workspace member the titles and dates of private trips they cannot open.
- **A company holiday is per plan, not per workspace.** `vacay_company_holidays` is unique on `(plan_id, date)` and every traveller owns
  their own plan (`ensurePlan`), so a company holiday covers the people on the plan that records it. Copy must not say "the whole
  workspace".
- **Nothing exempts a weekend or a company-holiday date from the allowance.** `ENTRY_KIND_COST` charges a `vacation` row 1 and a
  `half_day` row 0.5 on any date, and `getPlanOverview` sums it without looking at the date. Two weeks selected Monday to Sunday cost
  fourteen days, not ten.
- **Holiday calendars paint nothing.** `vacay_holiday_calendars` is a subscription record (`region`, `label`, `colour`) with no day
  rows anywhere in the schema, and nothing under `src/routes/_app/vacay*` reads `calendars`.
- **The week start is a shipped setting nobody reads here.** `getEffectiveSettings(scope, userId)` resolves
  `user_settings.week_starts_on ?? organization_settings.week_starts_on`, both editing surfaces ship, and
  `profile.weekStart.hint` already promises "Applies to every calendar, including the vacay year grid." The promise is false until
  this stage.
- **Two words that collide.** The entry kind `holiday` (a personal day that costs nothing) sits beside "company holiday", and the
  shipped `en` catalogue is British English, where "holiday" is annual leave. `CONTEXT.md` defines **Day** as a trip day.
- **The screen is English.** `vacay.tsx` carries its copy as literals (`docs/SPEC.md` §9). The allowance spec localises the lines it
  rewrites; the rest is this stage's.

The reader this serves: a traveller who plans leave around their trips and needs to record "I am away 3 to 14 August" without
leaving the keyboard, on a phone, in their own language, and to see the allowance move as they do it. The reference behaviour (twelve
months at a glance, click to log with a kind, per-person colours, a marker where a trip already occupies the day, a mode in which the
same click records a day the plan's people are away that costs no allowance - `wiki: Vacay-Calendar`) is delivered in planned.travel's
own vocabulary, and the public-holiday feed is not.

## 📝 Proposed Solution

### What the stage owns and what it does not

| Owned (this stage writes it)                                                                                                                                                                                                                                                          | Not owned (read only, or left alone)                                                                                                                               |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/server/repos/vacay.ts` - edit: `setEntry`, `setEntryRange` (rewritten), `addCompanyHoliday`, `removeCompanyHoliday` guarded in place; new `clearEntries`, `setCompanyHolidayRange`, `clearCompanyHolidays`, `listTripDateRanges`; the cost table moves out                       | `src/server/db/schema.ts`, `drizzle/` - **no schema change, no migration**                                                                                         |
| `src/lib/vacay/` - new modules beside the allowance spec's `carry-over.ts`: `entry-kinds.ts` (kinds, cost table, `MAX_ENTRY_RANGE_DAYS`), `week.ts` (rotation, weekend rule), `range-select.ts` (the pure anchor/focus model and the days a selection resolves to), with `__tests__/` | `src/routes/_app/-server/library.ts` - held by the journal stage this wave; `loadVacay` is **not** edited and its `weekStartsOn: 1` literal is left for that stage |
| `src/routes/_app/-server/vacay.ts` - edit (created by the allowance tickets): `loadVacayGridFn` and the write functions; `__tests__/vacay.test.ts`                                                                                                                                    | `addHolidayCalendar`, `removeHolidayCalendar`, `removeEntry`, `invitePlanMember`, `setPlanMemberStatus`, `removePlanMember`, `deletePlan` - stay unreachable       |
| `src/routes/_app/vacay.tsx` - edit: composes the grid, the picker and the status regions; `VacayPending` to twelve months                                                                                                                                                             | `src/routes/_app/-ui/scaffold.tsx`, `-lib/format.ts`, `-lib/tone.ts` - imported, not touched                                                                       |
| `src/components/vacay/` - `month-grid.tsx`, `day-cell.tsx`, `day-picker.tsx`, `range-bar.tsx`, `mode-control.tsx`, `index.ts` + `__tests__/`                                                                                                                                          | `src/components/ui/**`, `src/styles/tokens.css` - no primitive and no token is missing                                                                             |
| `src/lib/i18n/messages/<locale>/modules.ts` - edit, **all 23 locales**                                                                                                                                                                                                                | `src/lib/i18n/messages/en/shell.ts` (`nav.vacay`), `src/server/billing/**`, `src/lib/plans.ts` - no quota, no `MODULE_KEYS` entry                                  |
| `src/server/repos/__tests__/tenant-isolation.test.ts`, `repositories.test.ts` - append; the allowance spec's structural allowlist test - edit (criterion 5 there)                                                                                                                     | `e2e/helpers/**` - reused, not edited                                                                                                                              |
| `e2e/product-modules.spec.ts` - create or append (no baselines, ADR 0016)                                                                                                                                                                                                             |                                                                                                                                                                    |
| `CONTEXT.md` - glossary: **Leave day** (08-S5a), **Company holiday** (08-S5e)                                                                                                                                                                                                         |                                                                                                                                                                    |
| `src/components/vacay/plan-settings-dialog.tsx` (created by the allowance tickets) - edit in 08-S5f only                                                                                                                                                                              |                                                                                                                                                                    |
| `src/routes/api/dev/-seed/apply.ts` - only if a guard makes it fail (it writes the owner's and accepted members' entries with an explicit `userId`, which the guard's owner rule still admits)                                                                                        |                                                                                                                                                                    |

Departures from the plan's owned paths (Resolved assumptions 1, 8, 10, 14): no `holiday-manager.tsx`; the pure logic lives in
`src/lib/vacay/` not in `src/components/vacay/`; no `e2e/product-modules.visual.spec.ts` and no re-recorded `vacay-*` PNGs because
ADR 0016 removed the baselines; `modules.ts` in all 23 locales and `CONTEXT.md` join the list; `listTripDateRanges` stays in
`vacay.ts` (the plan's reason, that another stage holds `trips.ts`, still stands).

### Who may do what

One rule, in the repository, as the allowance spec fixes it (its Resolved assumptions 7, 20 and 21). The functions it adds -
`requirePlanActor(scope, planId)` (the plan's owner or an accepted member, else `NotFoundError`) and `requirePlanOwner(scope,
planId)` (plus `isOwner`, else `PlanOwnerOnlyError`) - are **prerequisites**, not rewritten here.

- **A personal entry is the caller's own.** Every server function this stage adds has a strict input with **no `userId` key**: a
  request that carries one is refused, not ignored. Logging for a colleague belongs to the shared-plan stage; nothing can create a
  second person on a plan today. `setEntry` and `setEntryRange` call `requirePlanActor` in place (an explicit `userId` other than the
  caller's follows the allowance spec's rule - owner only, target an accepted plan member and a current workspace member - which keeps
  the dev seeder working).
- **Clearing is by plan, caller and date range.** `clearEntries(scope, { planId, from, to })` calls `requirePlanActor`, then deletes
  with `plan_id = ?` and `user_id = scope.ctx.userId` and the range, in one statement (`removeWhere`). There is no row-id path to
  another person's day; a colleague's rows on the same dates are untouched; clearing nothing is not an error. `removeEntry` stays
  unreachable and off the allowlist.
- **A company holiday belongs to the plan**, so only its owner records or clears one: `addCompanyHoliday`,
  `removeCompanyHoliday` (resolve the row, then `requirePlanOwner(row.planId)`), `setCompanyHolidayRange` and `clearCompanyHolidays`
  all call `requirePlanOwner`; an accepted non-owner gets `PlanOwnerOnlyError`. The mode control is not rendered for a non-owner at
  all (not disabled with no explanation).
- **Hiding a control is not the guard.** The server refuses. Every handler starts with `appScope()` and never forwards a
  client-supplied user id.
- **Tenancy.** Every statement is `tenantFilter()`-bound or stamps `organization_id` from the scope; the one new upsert adds a
  `setWhere` on the organization (its conflict target, `vacay_entries_plan_user_date_unq`, carries no tenant column, so the plan
  resolved inside the workspace is what scopes it and the `setWhere` is belt and braces).
- **The structural allowlist** of the allowance spec (its criterion 5) is edited by each ticket for the functions it reaches, and
  only those: `setEntry`, `clearEntries` (08-S5a), `setEntryRange` (08-S5c), `listTripDateRanges` (08-S5d), `addCompanyHoliday`,
  `removeCompanyHoliday`, `setCompanyHolidayRange`, `clearCompanyHolidays` (08-S5e). `addHolidayCalendar`, `removeHolidayCalendar`
  and `removeEntry` stay off it.

### Phase 1 (08-S5a) - log and clear one of your own days

**Shared pure module `src/lib/vacay/entry-kinds.ts`.** The one owner of the kind list's order, the allowance cost of each kind
(`ENTRY_KIND_COST`, moved out of `vacay.ts`, which imports it) and `MAX_ENTRY_RANGE_DAYS = 366`. Day arithmetic reuses
`inclusiveDays` and `shiftDate` from `src/lib/trip-dates.ts`; no new date helper is written, and `calendarRange` in `vacay.ts` is
replaced by them.

**Repository (`src/server/repos/vacay.ts`).**

- `setEntry`: `requirePlanActor`, then the existing upsert-by-read; ends with `recomputeCarryOver(scope, planId, userId)` (the
  allowance spec's carry-over function, which the entry writers must call).
- `clearEntries(scope, { planId, from, to })`: as above; returns the number removed; ends with `recomputeCarryOver`.
- `setEntryRangeInput` / the clear input gain the cap: `to` before `from` and a span over `MAX_ENTRY_RANGE_DAYS` are refused by
  the repository schema, once, so the server-function validator, the range model and the repository agree (Phase 3 uses it).

**Server functions (`src/routes/_app/-server/vacay.ts`).**

- `loadVacayGridFn` (GET, `{ year }`): `{ today }` from `todayIso()` (`serialise.ts`; server-resolved, so `aria-current` and the empty
  state's action never read `new Date()` at render and cannot differ between server and client). 08-S5b adds `weekStartsOn`, 08-S5d adds
  `tripWindows`. It takes no plan id and calls no `ensurePlan`, so the route loader runs it in parallel with `loadVacay`
  (`Promise.all`), then the allowance function with that plan's id, as the allowance spec orders it.
- `setVacayEntryFn` (POST): `z.strictObject({ planId, date, kind })`, the handler is `appScope()` then `setEntry`.
- `clearVacayEntriesFn` (POST): `z.strictObject({ planId, from, to })`; a single day is `from === to`.
- Zod v4, `z.strictObject()` with the `error` parameter, reusing the repository's `idSchema` / `dateSchema` / kind enum.

**UI (`src/components/vacay/`).** See [UI/UX](#-uiux): the interactive grid, the picker, the states.

**Cost labels.** The picker states what each kind costs from the same table the repository uses; one test asserts the label set and
`ENTRY_KIND_COST` agree.

### Phase 2 (08-S5b) - the year reads in your week and your language

- `loadVacayGridFn` gains `weekStartsOn`: one call to `getEffectiveSettings(scope, scope.ctx.userId)`
  (`src/server/repos/settings.ts`), read and never written, narrowed at the boundary with `z.number().int().min(0).max(6).catch(1)`.
  No per-plan copy, no second resolver, no column. (`getEffectiveSettings` runs `ensureOrganizationSettings`, an insert on a
  workspace's first read; `loadShell` already does so on every app request, so this adds nothing.)
- `src/lib/vacay/week.ts` (pure): the seven weekday indices in column order for a `weekStartsOn`; the leading blanks of a month;
  `isWeekend(date)` by the **actual weekday** (Saturday and Sunday, fixed - there is no weekend setting - Resolved assumption 12), not
  by column, so the inset moves with the rotation; `Home`/`End` targets. Table-tested over `weekStartsOn` of `0`, `1` and `6`; `6` is
  in the table because it is the only value at which the weekend straddles both edges of the row.
- Month and weekday names come from `monthName` / `weekdayName` in `src/lib/format.ts` (the frozen tables; **never** `Intl` at
  render, which hydrates differently on workerd and WebKit). Headings render the `short` form; `NameWidth` has no narrower form. If a
  locale's short form does not fit its column at the four-column layout (`ar`, `pl`, `vi`, `zh` are the ones that can), an e2e
  no-overflow check fails and the fix is a narrow form in `format.ts` with the long name as the accessible text.
- The rest of `vacay.tsx`'s literals become keys: the header (eyebrow, title from `nav.vacay`, description), the travellers panel and
  its "(you)" suffix, the legend, the empty state. The year switcher, loading text and error title were localised by the allowance
  spec.

### Phase 3 (08-S5c) - log and clear a run of days

- **The range model (`src/lib/vacay/range-select.ts`, pure).** Anchor, focus and direction; the inclusive date list a selection
  resolves to, backwards or forwards, across a month edge (the UI keeps a selection inside the year on screen, so the cap is not
  reachable from it); `MAX_ENTRY_RANGE_DAYS` imported from `entry-kinds.ts`. A pure `daysToWrite(selection, { blockWeekends,
companyHolidayDates })` returns the days a write will touch and their allowance cost; in this ticket it skips nothing, 08-S5f adds
  the skips. The server uses the same function so the cost the picker shows is the cost that is charged (Resolved assumption 13).
- **`setEntryRange` rewritten (atomic).** Chunked multi-row `INSERT ... ON CONFLICT (plan_id, user_id, date) DO UPDATE` statements,
  chunk size from `chunkFor(boundParametersPerRow(vacayEntries))`, **all** handed to one `runBatch` (one D1 batch, so a half-written
  fortnight is not a reachable state), then `recomputeCarryOver`. `organization_id` is stamped from the scope and the conflict clause
  has a `setWhere` on it; there is no `.returning()`. Semantics kept from today: `kind` is in `SET` only when supplied (an omitted kind
  keeps the existing value; a new row takes the column default), `note` is `coalesce(excluded.note, vacay_entries.note)`, `updated_at`
  is set. It returns the number of days written; the old return value (every entry of the user in every year) is dropped - the seeder
  and `repositories.test.ts` ignore it. `requirePlanActor` first. 366 days is about 34 statements in the batch; with the guard reads
  and the recompute that is under 50, but the implementer confirms the figure against the deployed D1 plan's per-invocation query
  limit and reports it.
- **Server functions.** `setVacayEntryRangeFn` (POST, `z.strictObject({ planId, from, to, kind })`); `clearVacayEntriesFn` already
  takes a range. On any failure the client calls `router.invalidate()` so the screen shows stored truth, not a guess (a failed
  recompute leaves entries written and the carry stale until the next write on that chain; that is stated, not hidden).
- **Gestures (all produce the same value from the same model).** The required path is the two-tap "from / to" started from the
  picker's "Select more days". Shift+arrow (keyboard) and Shift+click and a mouse drag (`pointerType === 'mouse'` only) are
  shortcuts; touch keeps the default `touch-action`, so the page scrolls normally.
- **Clear.** "Clear {n} marked days" in the picker applies to the selection and names the count; no confirmation dialog (the count is
  the warning; Resolved assumption 4).

### Phase 4 (08-S5d) - trips you are on show through

- `listTripDateRanges(scope, { year })` in `vacay.ts`: `tenantFilter()` on `trips` plus
  `inArray(trips.id, memberTripIds(scope, scope.ctx.userId))` as a **sub-select** (not a materialised id list: the 100-parameter
  ceiling, as `atlas.ts` does), `is_archived = false`, both dates set, overlapping `[year-01-01, year-12-31]`; it selects `{ tripId,
title, startDate, endDate }` and nothing else, has no `userId` parameter and does not edit `trips.ts`. The window is the
  server-validated year, never a client-supplied range. These are the trips the viewer is **on**: an organization-visible trip they
  are not a member of is not their travel and is not drawn.
- `loadVacayGridFn` gains `tripWindows`.
- The marker: a hairline along the top edge of the cell, drawn in `currentColor` (the measured `inkOn` ink, so it keeps contrast on
  any traveller colour, `warning-soft` and `surface-inset`), against the other-traveller underline along the bottom; two facts never
  share a mark. The day's accessible name carries `Trip: {title}`. The copy says "trip", never "diary" (the Journal module's word).

### Phase 5 (08-S5e) - company holidays

- **Mode control (`mode-control.tsx`).** A `RadioGroup` of two, labelled "Mark days as": "My time off" / "Company holiday", shown only
  to the plan's owner. Not `PillNav` (primary navigation: a `<nav>` of links), not `Tabs` (there is no tab panel), and not a `Switch`
  (its off state would leave the default mode unnamed). Changing it is announced politely; each month grid's accessible name carries
  the mode.
- **In company mode** the same gestures (tap, two-tap range, Shift+arrows) record or clear company holidays instead; the picker offers
  "Mark as company holiday" and "Clear {n} company holidays" and no kinds; the hover/selection preview takes the `warning-soft` tone.
- **Repository.** `setCompanyHolidayRange(scope, { planId, from, to })` - chunked `INSERT ... ON CONFLICT (plan_id, date) DO NOTHING`
  in one `runBatch` (about 14 rows per statement; a holiday row binds seven parameters); `clearCompanyHolidays(scope, { planId, from,
to })` - one `removeWhere`; both `requirePlanOwner`, both capped at `MAX_ENTRY_RANGE_DAYS`. `addCompanyHoliday` and
  `removeCompanyHoliday` are guarded in place (they stay exported for the seeder and tests). No label is edited here: a recorded day
  has a null label, and an existing label shows in the cell's accessible name.
- **Server functions.** `setCompanyHolidaysFn` and `clearCompanyHolidaysFn` (POST, strict). Neither enqueues anything. They do not
  recompute carry-over: company holidays change no one's used days.
- A company holiday on a date that already holds the owner's own entry leaves the entry in place, still charged, with both marks
  visible and named (Resolved assumption 11).
- Copy never says "the whole workspace": a company holiday applies to everyone on this leave plan.

### Phase 6 (08-S5f) - the plan's two display switches

- `plan-settings-dialog.tsx` (allowance spec) gains two `CheckboxField` rows: **Block weekends** and **Company holidays** (show them
  and honour them). `updateVacayPlanFn`'s `pick` widens to `blockWeekends` and `companyHolidaysEnabled`. `holidaysEnabled` is not
  offered and stays at its column default.
- **Block weekends on (the column default is `true`).** Saturday and Sunday cells cannot be activated for a new write (`aria-disabled`,
  never native `disabled`, so arrows still land on them and the tab stop is kept; activating one says why); a run skips them **on the
  server** (the same `daysToWrite`); a single-day write on a blocked day is refused by a diagnostic repository error. An entry that
  already exists on a weekend stays visible and its picker offers only "Clear this day". Applies in both modes.
- **Company holidays on (default `true`).** A company-holiday date cannot be activated for a personal write; a personal run skips
  them; the cell shows the tint. **Off:** company holidays are not drawn, the mode control is not offered, the rows are kept (hidden,
  not deleted, like the allowance spec's carry-over switch), and those dates can be logged as personal days.
- Because all three columns default to `true`, **every existing plan changes behaviour the day this ticket ships** (weekends become
  inert). Existing weekend entries stay visible and clearable. The PR body says so.

### Alternatives considered, and why they lost

| Alternative                                                                 | Why it lost                                                                                                                                                                  |
| --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ship the holiday-calendar subscription list the plan describes              | The calendar paints nothing; a control with no visible effect is a placeholder (`docs/SPEC.md` §7.5). The repository functions stay unreachable and the feed stays deferred. |
| Keep the two-phase `setEntryRange` and only chunk the insert                | Leaves the committed-updates-then-failed-inserts state the plan promises not to have.                                                                                        |
| Queue the range write                                                       | A 366-row write belongs in the request path (`batch.ts`).                                                                                                                    |
| Row-id removal (`removeEntry`) guarded by loading the row                   | A second guard to remember; by plan, caller and range there is no path to another person's row, and it serves one day and a run.                                             |
| `tenantFilter()`-only trip read; or `readableTrips`                         | The first leaks private trips; the second also draws organization-visible trips the viewer is not on.                                                                        |
| `PillNav`, `Tabs` or `Switch` as the mode control                           | Navigation role / no tab panel / an unnamed default state. A two-option `RadioGroup` has the right role.                                                                     |
| Record the default kind on tap, picker to change it                         | A stray tap while scrolling twelve months on a phone silently spends allowance.                                                                                              |
| Touch drag or long-press for a range                                        | A drag fights page scroll; long-press is undiscoverable and collides with the OS callout and screen-reader gestures; a drag-only range fails WCAG 2.5.1 and 2.5.7.           |
| Exclude weekends and company holidays from the _count_ instead of the write | Three owners of one rule (`getPlanOverview`, `countUsedDays`, the carry-over walk) would have to agree.                                                                      |
| One tab stop per month (the plan)                                           | Arrows and PageUp/PageDown already cross months, so twelve remembered days disagree with where the arrows go and getting past the year takes twelve Tab presses.             |
| Edit `loadVacay`                                                            | `library.ts` is the journal stage's this wave.                                                                                                                               |

## 📝 Architecture

- **One concept, one owner (`docs/SPEC.md` §8).** Kind order, cost and the range cap: `src/lib/vacay/entry-kinds.ts`. Week
  rotation and the weekend rule: `week.ts`. The selection model and the days a write touches: `range-select.ts`. Persistence, the
  actor rules and every statement: `src/server/repos/vacay.ts` (the only SQL owner). Names of months and weekdays: `format.ts`.
  The week start: `getEffectiveSettings`. Components render and own no rule; the server functions validate, forward and own no rule.
- **Seams.** Route loader: `Promise.all([loadVacay, loadVacayGridFn])`, then the allowance function with the plan id. A write goes
  component, server function, `appScope()`, repository function (guard, statements, `recomputeCarryOver`), then the component calls
  `router.invalidate()` so every figure on screen is the database's. `components/ui` never fetches or imports `server/`; the vacay
  components take plain props and call the server functions directly, as the allowance spec's do.
- **Cloudflare cost.** A day write is the guard reads, one upsert and the recompute (an entries read and at most one batch of
  single-digit updates): more D1 calls per click, no more stored rows. A range is one batch of at most about 34 statements. Nothing is
  queued, no realtime patch, no Durable Object.

## 📝 Data Model

**No schema change and no migration.** Written: `vacay_entries` (`kind`, `note`, `date` behind the unique
`vacay_entries_plan_user_date_unq`, which makes a day idempotent: choosing twice sets, it never duplicates), and
`vacay_company_holidays` (unique `(plan_id, date)`). Read: `trips` (via the viewer's membership), `organization_settings` /
`user_settings` (week start), `vacay_plans` (the two switches). `vacay_holiday_calendars` is neither read nor written. Dates stay
`YYYY-MM-DD` text. No index is added: entries are read by `(plan_id, date)` and `(organization_id, plan_id)`, trips by the existing
membership index `(organization_id, user_id)`.

## 📝 API Contracts

| Function                 | Method | Input (all `z.strictObject`, no `userId`) | Output                                                   | Ticket                    |
| ------------------------ | ------ | ----------------------------------------- | -------------------------------------------------------- | ------------------------- |
| `loadVacayGridFn`        | GET    | `{ year }`                                | `{ today, weekStartsOn, tripWindows }` (grows by ticket) | a, b, d                   |
| `setVacayEntryFn`        | POST   | `{ planId, date, kind }`                  | the entry row                                            | a                         |
| `clearVacayEntriesFn`    | POST   | `{ planId, from, to }`                    | `{ removed }`                                            | a (c reuses it for a run) |
| `setVacayEntryRangeFn`   | POST   | `{ planId, from, to, kind }`              | `{ written }`                                            | c                         |
| `setCompanyHolidaysFn`   | POST   | `{ planId, from, to }`                    | `{ written }`                                            | e                         |
| `clearCompanyHolidaysFn` | POST   | `{ planId, from, to }`                    | `{ removed }`                                            | e                         |

Errors: a plan the caller may not see is `NotFoundError`; a non-owner recording a company holiday is `PlanOwnerOnlyError`; a write on a
blocked day is a diagnostic repository error. None is authored copy (`AUTHORED_ERROR_NAMES` stays closed), so each crosses the wire as
`{ kind: 'unexpected' }`: the UI never offers the action, and after any failure it re-reads the page rather than reading the error's
class (the allowance spec's pattern).

## 📝 UI/UX

Route `/vacay` exists: no route file, no `pnpm generate-routes`. SSR stays the default. `data-part` attributes this stage publishes:
`vacay-day` (with `data-date`), `vacay-mode` (with `data-value`), `vacay-range-bar`.

### The grid (08-S5a)

- **Structure.** One `<table role="grid">` per month, named by the month and year (`formatMonthYear`), column headers `th scope="col"`
  with the long weekday as `abbr`, and in each `gridcell` a real `<button>` (`DayCell`). The precedent for the key model is
  `src/components/ui/calendar.tsx` (grid role, roving tab stop, RTL-aware arrows, `PageUp`/`PageDown`, polite month status).
- **One roving tab stop for the whole year.** Arrow keys move by day (they follow reading direction in RTL), `PageUp`/`PageDown` by
  month, `Home`/`End` to the ends of that week (derived from `weekStartsOn`, never from Monday and Sunday), and they cross month
  edges. `Shift`+arrow extends a pending range (08-S5c). `Enter`/`Space` activates.
- **Disabled and in-flight cells use `aria-disabled` (and `aria-busy` in flight), never native `disabled`** (a disabled button cannot
  take focus and would orphan the roving tab stop). Activating one explains why. An in-flight cell keeps its numeral, drops to 60%
  opacity, and a second activation is ignored by a guard in the handler.
- **Accessible name of a day**: the localised full date, then the parts that apply joined with `formatList`: the kind, "Company
  holiday", "Trip: {title}", "{n} other travellers away". The `title` attribute goes. The mode is **not** repeated in each day's name;
  it is in each grid's name and the picker's title. `aria-current="date"` marks `today` from the loader. A day that opens the picker
  has `aria-haspopup="dialog"`.
- **Non-colour cues.** Each of the six kinds is told apart without colour: `half_day` by a half fill, the other four non-leave kinds
  by a small corner glyph in `currentColor`; all listed, with the trip hairline and the other-traveller underline, in the legend.
  Markers use the measured `inkOn` ink so they keep 3:1 on any traveller colour in both themes.
- **Focus ring inside the cell** (`focusRingInset`), visible on every fill, so a focused day cannot reflow a week or be clipped by
  the card. Every cell carries the `scroll-mt-*` the sticky header needs (WCAG 2.4.11); moving focus never uses smooth scroll.
- **Targets.** The chip stays on today's 28px module; its hit area fills the column and is at least 40px tall under
  `pointer: coarse`, never under 24x24 (WCAG 2.5.8).

### The picker (08-S5a)

- `Popover` anchored to the day on a fine pointer, bottom `Sheet` on a narrow or coarse screen (`src/lib/breakpoints.ts`). Its title
  is the localised long date. Six kind options, the current kind marked (`aria-pressed`), each with a **cost line** under the name:
  "Uses 1 day of your allowance" / "Uses half a day of your allowance" / "Doesn't use your allowance". "Clear this day" appears only if
  the day is marked. Choosing a kind records it and closes the picker at once. No note field in this slice (on a phone it would raise
  the keyboard over the sheet).
- Kind names never say a bare "holiday" (Resolved assumption 9): Leave, Half day of leave, Sick day, Working remotely, Public holiday,
  Other. The month badges and the legend use the same keys, and `humaniseToken(kind)` leaves the screen.
- Focus returns to the day that opened the picker after a choice or `Escape` (the `Popover` anchored rather than triggered needs
  `onCloseAutoFocus` to focus the cell).

### Success, failure, empty and loading (08-S5a)

- **Success.** The cell fills at once (optimistic), `router.invalidate()` re-reads the balances, and one polite live region mounted at
  first render says "Marked {date} as {kind}." (a run: "Marked {n} days as {kind}, {from} to {to}.").
- **Failure.** The cell reverts to its previous fill and **one** `Alert tone="danger"` (`role="alert"`) appears in a region anchored
  to the bottom of the viewport, so at 360px, where the year is one month per row, it is on screen wherever the traveller has
  scrolled. It names the date(s), says nothing was saved for them, and offers "Try again" (re-sends exactly the failed writes) only
  for a transport error or a 5xx; any other failure just re-reads the page. Focus stays on the day. The alert clears on the next
  success. A failed range reverts every day in it.
- **Empty.** The "Nothing marked in {year}" card stays; its description names the gesture ("Select any day to mark it as time off.
  Weekends and company holidays show up on their own.") and its action, "Go to {month}", scrolls to and focuses today in the current
  year or 1 January in any other (not "the first of the current month").
- **Loading.** `VacayPending` renders twelve month cards of `Skeleton` cells at the settled cell size, so the grid does not jump.
- **Motion.** A cell's fill transitions over 150ms on `--ease-out-quint`; the range preview is opacity only; nothing animates a layout
  property; the global reduced-motion block removes the transition.
- **Layout.** At 360px the year is one month per row with a sticky month header; at 2560px it stays on the four-column grid (no
  stretching). Every stored traveller colour is checked against the numeral `inkOn()` puts on it in both themes.

### A run of days (08-S5c)

- "Select more days" in the picker closes it and outlines that day as the start. A bar anchored to the bottom (`data-part=
"vacay-range-bar"`, above the safe-area inset; the grid has matching bottom padding) says "From {date}. Select the last day." in a
  polite status and offers a visible Cancel (at least 44px). The next tap on any day, either side of the start and across months,
  sets the end and reopens the picker for the whole range: its title is "{from} to {to}" with the day count, each kind's cost line
  shows the real cost of **this** range ("Uses 10 days of your allowance"), "Clear {n} marked days" applies to the selection.
  Selecting the start day again returns to the single-day picker. `Escape`, Cancel or a year change leave range mode with nothing
  written.
- Cells in a selection carry `aria-selected="true"`; each grid is `aria-multiselectable`. A short hint tied to the grids with
  `aria-describedby` names the keyboard path ("Hold Shift and use the arrow keys, or choose Select more days").

### The mode control (08-S5e) and the settings rows (08-S5f)

- `RadioGroup` in the page header actions, owner only; the dialog rows are `CheckboxField`s (the allowance spec's decision: `Switch`
  is reserved for effects that apply immediately).

## 📝 Visual change expected

Route `/vacay`, light and dark, desktop (1280), mobile (360) and 2560:

- Resting: every day is a control with a focus ring and hover/active states; marked days carry their kind cue; trip hairline (08-S5d);
  a mode control in the header for the plan's owner (08-S5e); a legend with the new rows; localised month and weekday names in the
  user's week (08-S5b).
- States: the kind picker open over a day (`--state kind-picker --click '[data-part="vacay-day"][data-date="2026-08-19"]'`); a
  pending range with the bottom bar (`--state range`); company mode (`--state company --click '[data-part="vacay-mode"]
[data-value="company"]'`); the failure alert (reached with `page.route()` failing a write); the twelve-card skeleton.
- Frames are the blind A/B pair from `scripts/visual/capture.mjs`; nothing is compared to a stored image (ADR 0016).

## 📝 Copy

New keys in `src/lib/i18n/messages/en/modules.ts` (namespace `modules`, prefix `vacay.`), each landing in all 23 locales in the same
change that first uses it (`i18n-messages` skill; the parity and `coverage` tests enforce it). Rules the allowance spec set apply: one
full key per phrase (no `{field}` slots), every key that puts a number before a noun is a plural key (`count` selects the branch,
`value` is the number already formatted with `formatNumber(locale)`), the six kind names come from a literal table typed
`Record<Kind, MessageKey>` and never a template key. Dates go through `formatDate` / `formatMonthYear`, month and weekday names
through `monthName` / `weekdayName`. A `copy-rules.test.ts` modelled on `src/components/atlas/__tests__/copy-rules.test.ts` covers the
new components (no literal JSX text or props, logical properties).

| Key                                                  | `en` text                                                                                                                               | Ticket                         |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| `vacay.kind.vacation` / `.half_day` / `.sick`        | `Leave` / `Half day of leave` / `Sick day`                                                                                              | a                              |
| `vacay.kind.remote` / `.holiday` / `.other`          | `Working remotely` / `Public holiday` / `Other`                                                                                         | a                              |
| `vacay.kind.cost.full` / `.half` / `.none`           | `Uses 1 day of your allowance` / `Uses half a day of your allowance` / `Doesn't use your allowance`                                     | a                              |
| `vacay.picker.title`                                 | `Mark {date}`                                                                                                                           | a                              |
| `vacay.picker.clear`                                 | `Clear this day`                                                                                                                        | a                              |
| `vacay.picker.more`                                  | `Select more days`                                                                                                                      | c                              |
| `vacay.day.name`                                     | `{date}. {details}`                                                                                                                     | a                              |
| `vacay.day.part.companyHoliday`                      | `Company holiday`                                                                                                                       | a                              |
| `vacay.day.part.trip`                                | `Trip: {title}`                                                                                                                         | d                              |
| `vacay.day.part.others`                              | plural on `count`: `{value} other traveller away` / `{value} other travellers away`                                                     | a                              |
| `vacay.grid.hint`                                    | `Select a day to mark it. To mark several, hold Shift and use the arrow keys, or choose Select more days.`                              | a (c adds the second sentence) |
| `vacay.status.marked`                                | `Marked {date} as {kind}.`                                                                                                              | a                              |
| `vacay.status.cleared`                               | `Cleared {date}.`                                                                                                                       | a                              |
| `vacay.error.write`                                  | plural on `count`: `{dates} was not saved. Nothing changed for that day.` / `{dates} were not saved. Nothing changed for those days.`   | a                              |
| `vacay.error.retry` / `.dismiss`                     | `Try again` / `Dismiss`                                                                                                                 | a                              |
| `vacay.empty.title`                                  | `Nothing marked in {year}`                                                                                                              | a                              |
| `vacay.empty.description`                            | `Select any day to mark it as time off. Weekends and company holidays show up on their own.`                                            | a                              |
| `vacay.empty.action`                                 | `Go to {month}`                                                                                                                         | a                              |
| `vacay.legend.title`                                 | `Legend`                                                                                                                                | a                              |
| `vacay.legend.mine` / `.companyHoliday` / `.weekend` | `Your time off` / `Company holiday` / `Weekend`                                                                                         | a                              |
| `vacay.legend.others` / `.trip` / `.halfDay`         | `Someone else away` / `Your trip` / `Half day`                                                                                          | a, d                           |
| `vacay.page.eyebrow` / `.description`                | `Time off` / `Plan the days you are away and see them against everyone else's`                                                          | b                              |
| `vacay.travellers.title` / `.you`                    | `Travellers` / `{name} (you)`                                                                                                           | b                              |
| `vacay.range.bar`                                    | `From {date}. Select the last day.`                                                                                                     | c                              |
| `vacay.range.cancel`                                 | `Cancel`                                                                                                                                | c                              |
| `vacay.range.title`                                  | `{from} to {to}`                                                                                                                        | c                              |
| `vacay.range.count`                                  | plural on `count`: `{value} day` / `{value} days`                                                                                       | c                              |
| `vacay.kind.cost.days`                               | plural on `count`: `Uses {value} day of your allowance` / `Uses {value} days of your allowance`                                         | c                              |
| `vacay.picker.clear.range`                           | plural on `count`: `Clear {value} marked day` / `Clear {value} marked days`                                                             | c                              |
| `vacay.status.markedRange`                           | plural on `count`: `Marked {value} day as {kind}, {from} to {to}.` / `Marked {value} days as {kind}, {from} to {to}.`                   | c                              |
| `vacay.status.clearedRange`                          | plural on `count`: `Cleared {value} day, {from} to {to}.` / `Cleared {value} days, {from} to {to}.`                                     | c                              |
| `vacay.mode.label`                                   | `Mark days as`                                                                                                                          | e                              |
| `vacay.mode.mine` / `.company`                       | `My time off` / `Company holiday`                                                                                                       | e                              |
| `vacay.grid.name.mode`                               | `{month}, marking {mode}`                                                                                                               | e                              |
| `vacay.status.mode`                                  | `Marking {mode}`                                                                                                                        | e                              |
| `vacay.company.mark`                                 | `Mark as company holiday`                                                                                                               | e                              |
| `vacay.company.clear`                                | plural on `count`: `Clear {value} company holiday` / `Clear {value} company holidays`                                                   | e                              |
| `vacay.company.hint`                                 | `A company holiday applies to everyone on this leave plan and uses no one's allowance.`                                                 | e                              |
| `vacay.settings.blockWeekends` / `.hint`             | `Block weekends` / `Saturdays and Sundays cannot be marked as time off.`                                                                | f                              |
| `vacay.settings.companyHolidays` / `.hint`           | `Company holidays` / `Show company holidays and skip them when marking time off. Turning this off hides them; it does not delete them.` | f                              |
| `vacay.blocked.weekend` / `.companyHoliday`          | `Weekends are blocked in this leave plan.` / `This day is a company holiday.`                                                           | f                              |

## 📝 Edge Cases & Failure Scenarios

| Case                                                                           | Behaviour                                                                                                                |
| ------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------ |
| Choose the same kind twice, or two tabs write the same day                     | Idempotent: the unique `(plan, user, date)` index; last write wins, no duplicate row.                                    |
| Tap a day whose write is in flight                                             | Ignored by a guard in the handler; the cell is `aria-busy`, focus stays.                                                 |
| A range write fails                                                            | Nothing is written (one batch); every day in it reverts; one alert names the dates; the page re-reads.                   |
| The write succeeds and the recompute fails                                     | Entries are written, the carry is stale until the next write on that chain; the error is reported and the page re-reads. |
| A range of 366 days; a 367-day or inverted range                               | 366 writes in about 34 statements in one batch; the others are refused by the repository schema and write nothing.       |
| Range crosses a month or a year edge                                           | The model is contiguous across months; the UI keeps a selection inside the year on screen.                               |
| A 20-day range over existing and new days                                      | One upsert batch: existing days keep their note, an omitted kind keeps theirs.                                           |
| `Escape`, Cancel, a year change with a pending range                           | Range mode ends, nothing written.                                                                                        |
| A day with an entry and a company holiday                                      | Both marks drawn and named; the entry stays charged.                                                                     |
| Weekend with an existing entry, weekends blocked                               | Visible; the picker offers only "Clear this day".                                                                        |
| A non-owner opens the screen                                                   | No mode control; a company-holiday call is refused with `PlanOwnerOnlyError` (and the page re-reads).                    |
| A request carries `userId`                                                     | Refused by the strict schema.                                                                                            |
| Clearing a range in which a colleague has entries on the same dates            | Only the caller's rows go.                                                                                               |
| Cross-workspace plan id                                                        | `NotFoundError`, nothing written.                                                                                        |
| A trip with a null date, an archived trip, an organization-visible trip not on | Not drawn.                                                                                                               |
| A private trip of a colleague                                                  | Not drawn, title not sent.                                                                                               |
| `weekStartsOn` stored out of range                                             | Narrowed to `1` at the boundary.                                                                                         |
| Sunday-first workspace, the weekend                                            | Saturday is column seven, Sunday column one; the inset follows the weekday.                                              |
| Hydration                                                                      | `today` and every name come from the loader and the frozen tables; nothing reads `new Date()` or `Intl` at render.       |
| Browser back with the bottom sheet open (mobile)                               | May leave `/vacay` and drop a half-built range; nothing was written. Accepted, noted.                                    |
| Signed-out or removed member                                                   | The write is refused by the guard; nothing is written.                                                                   |

## ✅ Acceptance criteria

Each criterion belongs to one ticket.

**08-S5a (log and clear one day)**

1. Every day on `/vacay` is a `<button>` in a `role="grid"` month; one tab stop for the year; arrows, `PageUp`/`PageDown`,
   `Home`/`End` move focus across month edges; a `document.activeElement` assertion covers each.
2. Activating a day opens the picker (Popover on a fine pointer, Sheet at 360px) titled with the localised date; choosing a kind
   records it, closes the picker, returns focus to the same day, updates the "days left" figure from the database and announces it
   once; "Clear this day" removes it. Choosing the same kind twice writes one row.
3. Each of the six kinds is distinguishable without colour; the legend lists them; the accessible name of a day carries date, kind,
   company holiday and other travellers; there is no `title` attribute.
4. A failed write reverts the cell, shows one alert naming the date at the bottom of the viewport at 360 and 1280, keeps focus on the
   day, and offers a retry only for transport / 5xx failures; the page re-reads.
5. `setVacayEntryFn` / `clearVacayEntriesFn` reject a request carrying `userId`; `setEntry` and `clearEntries` call
   `requirePlanActor` and `recomputeCarryOver`; a non-member, a pending and a declined member get `NotFoundError`; clearing leaves a
   colleague's rows on the same dates untouched; the allowlist test is edited for exactly `setEntry` and `clearEntries`.
6. Tenant isolation: in A's scope against B's plan, `setEntry` and `clearEntries` reject with `NotFoundError` and B's `vacay_entries`
   count is unchanged; `listVacayEntries(scopeB, aPlanId)` is `[]` and `vacayEntriesRepository.requireById(scopeB, aEntryId)`
   throws (both asserted: a `findMany` and a `requireById` fail differently).
7. `ENTRY_KIND_COST` lives in `src/lib/vacay/entry-kinds.ts`, `vacay.ts` imports it, and a test asserts the cost-line set and the
   table agree. The empty state names the gesture and its action focuses today (current year) or 1 January.
8. All 08-S5a copy exists in 23 locales; `CONTEXT.md` carries **Leave day**; the twelve-card skeleton matches the settled height; no
   console message on `/vacay`; zero layout shift after settle on `chromium`; both themes at 360, 1280, 2560.

**08-S5b (week and language)**

9. A traveller with no override reads the workspace week start; an override of `0` beats a workspace `1`; clearing the override
   returns the workspace value. At `weekStartsOn` of `0`, `1` and `6` the headings start on the named day, the first of the month
   lands in the right column, `Home`/`End` reach that week's own ends, and the weekend inset is on Saturday and Sunday.
10. Month and weekday names come from `format.ts` in the reader's locale; no `Intl` at render; no horizontal overflow of the
    headings at the four-column layout in `ar`, `pl`, `vi` and `zh`. `profile.weekStart.hint` is now true.
11. The page header, travellers panel and legend carry no English literal; `loadVacay` and `library.ts` are untouched.

**08-S5c (a run of days)**

12. A selection resolves to the same inclusive list backwards, forwards, across a month edge, by Shift+arrows, by mouse drag and by
    the two-tap path (one shared test); the model, the repository schema and the server-function validator share
    `MAX_ENTRY_RANGE_DAYS`, and a test asserts they agree.
13. `setEntryRange` writes more than twelve new days, a mix of existing and new days, and 366 days in one batch with no partial
    state; an inverted range and a 367-day range are refused and write nothing; an omitted kind keeps existing kinds; the carry-over
    recompute runs after it.
14. On a 360px viewport a traveller logs a run of days with taps only, sees the real allowance cost of the range before choosing, and
    clears a selection with one choice that names the count; `Escape` / Cancel / a year change write nothing; the page still
    scrolls during selection (`touch-action` is the default).
15. Cells in a selection are `aria-selected`; the bar is announced politely and does not cover the last week.

**08-S5d (trips)**

16. `listTripDateRanges(scopeA)` returns none of B's trips; inside one workspace a colleague's private trip and an
    organization-visible trip the viewer is not on are not returned; only the four fields are sent; the marker and the "Trip: {title}"
    name are distinct from the other-traveller underline.

**08-S5e (company holidays)**

17. The plan's owner switches to company mode and records and clears company holidays with every gesture of the earlier tickets; a
    plan member does not see the control and a forged call gets `PlanOwnerOnlyError`; in A's scope against B's plan every company
    holiday writer rejects with `NotFoundError` and B's rows are unchanged; the range write is one batch.
18. Copy and `CONTEXT.md` (**Company holiday**) say "everyone on this leave plan", never "the whole workspace".

**08-S5f (display switches)**

19. The owner turns "Block weekends" off and on in the dialog and the grid follows: on, weekend cells are `aria-disabled` and explain
    why, a run skips them on the server, and the cost shown equals the cost charged; existing weekend entries stay visible and
    clearable. Companyholidays off hides the tint and the mode control and keeps the rows; on, a personal run skips them.
20. `holidaysEnabled` has no control; `addHolidayCalendar` / `removeHolidayCalendar` have no production caller; reference row
    `ADD-02` is closed by this ticket's PR.

## 📝 Risks & Impact Review

- **New write paths acting on client-sent ids (`planId`, dates).** The security and tenancy verdict is risk-medium, no `security`
  label: the workspace filter is untouched, no migration, no quota, no money. Any ticket whose diff reaches
  `src/server/repos/base.ts`, `schema.ts`, `drizzle/` or `src/server/auth` becomes risk-high. Mitigation: guards in the repository,
  strict inputs with no `userId`, the allowlist edited per ticket.
- **More D1 calls per click** (guards, upsert, recompute). Bounded and measured by the implementer against the deployed plan's query
  limit; no more stored rows.
- **Behaviour change on merge of the last ticket.** The switch columns default to `true`, so every plan's weekends become inert.
  Existing entries remain. Stated in the PR body.
- **Pre-existing exposure, not widened.** `loadVacay` already sends every plan member's entries including `kind` and `note` to the
  client. Today only the owner's own plan loads and nothing invites members (the dev seeder does, so the demo workspace shows it); this
  stage reads others' entries only to underline a date. The shared-plan stage narrows the payload before another person's plan
  becomes visible; the allowance spec hands it `getPlanOverview`'s row-less fallback for the same reason (handoff item 4, carried).
- **Existing writers still open.** `removeEntry`, `addHolidayCalendar`, `removeHolidayCalendar` stay exported with the workspace
  check only and off the allowlist.
- **Departed members.** A removed member's plan and entries stay and nobody can change them; the shared-plan stage decides. Not made
  worse here.
- **Latent bug in the precedent.** `src/components/ui/calendar.tsx` puts `tabIndex={0}` on a native `disabled` button when the roving
  date lands on a disabled day, which orphans the tab stop; this stage's cells use `aria-disabled`. The calendar itself is not edited
  here; a follow-up issue is for a person to file.
- **Backward compatibility.** Additive: new exports and functions; `setEntryRange`'s return type changes from rows to a count (no
  caller reads it); `ENTRY_KIND_COST` moves, its values do not change.
- **Not checkable from this run.** Contrast of `--color-info`, `--color-warning-soft`, `--color-surface-inset` and a traveller's own
  colour against the markers in both themes (needs resolved tokens; the `currentColor` rule removes most of the risk), screen-reader
  announcements of twelve named grids on real devices, text widths of the kind labels at 360px in `de`, `pl`, `ru`, and the time
  between paint and hydration on a slow connection (a button does nothing until hydrated). The implementer measures or states each.

### Out of scope

- Public holidays from an external source, the holiday-calendar subscription controls, the `holidaysEnabled` switch: deferred behind
  the day-source decision recorded in `docs/plans/11-boundaries-and-blockers.md`. Nothing built here becomes wrong if a feed arrives
  (the rows it would fill are the rows this stage writes).
- Logging for another traveller, inviting plan members, the read-only settings view for a member (the shared-plan stage).
- Editing a company holiday's label; a note on a day; undo of a clear (the count in the choice is the warning).
- Cross-year ranges from the UI; a per-locale weekend definition.

### Reference-row disposition

`ADD-03` stays `partial`: the plan closes it "done", but the row expects public holidays from an external source and that half is
deferred; every other path it names ships. `ADD-02` (allowance, carry-over, settings) closes with 08-S5f, as the allowance spec hands
over.

## 📋 Phasing

| Phase | Ticket | Slice a person can see work                                    | Blocked by                                                                                                  |
| ----- | ------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1     | 08-S5a | Log and clear one of your own days, with its kind and its cost | allowance tickets 08-S1a (guards, `-server/vacay.ts`, `components/vacay`) and 08-S1b (carry-over recompute) |
| 2     | 08-S5b | The year reads in the week you start on and in your language   | 08-S5a                                                                                                      |
| 3     | 08-S5c | Log and clear a run of days, on a phone too                    | 08-S5a                                                                                                      |
| 4     | 08-S5d | A trip you are on shows through the days it occupies           | 08-S5b                                                                                                      |
| 5     | 08-S5e | The plan's owner records company holidays                      | 08-S5c (and 08-S1a for `requirePlanOwner`)                                                                  |
| 6     | 08-S5f | The owner switches weekend blocking and company holidays       | 08-S5c, 08-S5e and allowance ticket 08-S1c (the settings dialog)                                            |

The tickets edit the same few files (`month-grid.tsx`, `day-cell.tsx`, `vacay.tsx`, `modules.ts`), so they run serially in the order
above. If a ticket does not fit one context window, 08-S5a is cut at the repository/server boundary only by folding the cut back into
the next slice - never by layer.

## 📋 Implementation Plan

### Phase 1 - log and clear one day (08-S5a)

1. `entry-kinds.ts` and its test; move `ENTRY_KIND_COST`; replace `calendarRange` with `inclusiveDays`/`shiftDate`.
2. `setEntry` guarded, `clearEntries`, the cap in the schema, the recompute call; tests first: the actor rules, tenant isolation, the
   colleague-rows case, the allowlist edit.
3. `loadVacayGridFn`, `setVacayEntryFn`, `clearVacayEntriesFn`, `__tests__/vacay.test.ts` on the pattern of
   `src/server/fns/__tests__/atlas.test.ts` (plain exported functions for anything that returns a result).
4. `DayCell`, `MonthGrid` (extracted from `vacay.tsx`), `DayPicker`, the live region and alert region, `VacayPending`, the keys in 23
   locales, `CONTEXT.md`.
5. `e2e/product-modules.spec.ts`: `test.describe('08-S5a ...')`.

### Phase 2 - week and language (08-S5b)

1. `week.ts` and its table test; `weekStartsOn` in `loadVacayGridFn` with the three override cases.
2. Rotate the grid; names from `format.ts`; localise the remaining literals; the overflow check in `ar`, `pl`, `vi`, `zh`.

### Phase 3 - a run of days (08-S5c)

1. `range-select.ts` (with `daysToWrite`) and its test; the cap agreement test.
2. `setEntryRange` rewritten, tests for >12 new days, a mix, omitted kind, atomicity, cap, cross-workspace; `setVacayEntryRangeFn`.
3. `RangeBar`, Shift+arrows, mouse drag, the range picker, the live-region messages, keys.

### Phase 4 - trips (08-S5d)

1. `listTripDateRanges` and the tenant-isolation and visibility cases first; `tripWindows` in `loadVacayGridFn`.
2. The marker, the name part, the legend row, keys.

### Phase 5 - company holidays (08-S5e)

1. Guard `addCompanyHoliday` / `removeCompanyHoliday` in place; `setCompanyHolidayRange`, `clearCompanyHolidays`; tests and the
   allowlist edit.
2. The two server functions, `ModeControl`, the company picker, the grid name, keys, `CONTEXT.md`.

### Phase 6 - switches (08-S5f)

1. Widen the `pick`; the two dialog rows; keys.
2. `daysToWrite` skips; the inert cells; the diagnostic repository error; the cost line follows; tests for both modes and the
   existing-entry cases.

## Verification

- The gate in `validation.commands` (`.ai/agentic.config.json`) on every phase's last commit.
- Unit: `src/lib/vacay/__tests__/{entry-kinds,week,range-select}.test.ts` (the `ui` project: no server imports);
  `src/routes/_app/-server/__tests__/vacay.test.ts`; `src/components/vacay/__tests__/` - `month-grid` (one tab stop; arrows,
  `PageUp`/`PageDown`, `Home`/`End`; RTL; `aria-disabled` keeps the stop), `day-cell` (names, cues), `day-picker` (focus returns, one
  write for a double activation), `range-bar`, `mode-control` (absent for a member), `copy-rules.test.ts`.
- Repository: the cases of Phases 1, 3, 4 and 5 in `repositories.test.ts` and `tenant-isolation.test.ts` (one `describe` per
  phase); the allowance spec's structural allowlist test, edited per ticket.
- Browser, per `docs/plans/12-verification-protocol.md` (ADR 0016: no baselines, no pixel comparison): `e2e/product-modules.spec.ts`
  asserts `/vacay?year=2026` (`PINNED_YEAR`) answers, hydrates, says nothing in the console (`watchConsole`) and can be acted on:
  keyboard-only logging of a day and a run, the 360px two-tap run, no horizontal overflow of headings in `ar`, `pl`, `vi`, `zh`, zero
  layout shift after settle on `chromium` (a skip on `mobile-safari`). The describes that write are
  `test.describe.configure({ mode: 'serial' })`, run in `chromium` only, restore what they change, and are named among the fixture
  writers in `playwright.config.ts`'s `workers` comment. Run `PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test
--project=setup`, then `... pnpm exec playwright test e2e/product-modules.spec.ts`, with the port from `bash .ai/scripts/e2e.sh`.
- Frames, the blind A/B pair a person reads at review: `PT_SERVER_TODAY=2026-08-20 node scripts/visual/capture.mjs --url
"http://localhost:$PORT/vacay?year=2026" --out "<scratchpad>/shots/08-S5" --label B --viewports 360x800,1280x900,2560x1440 --themes
light,dark --auth`, with the states named under Visual change expected. Each selector is verified to resolve by the spec run passing.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                            | Applied default                                                                                                                                                                                              | Why                                                                                                                                                                                                                                                         |
| --- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Ship the holiday-calendar subscription controls the plan describes? | No. No calendar control, server function or list; the repository functions stay unreachable; `ADD-03` stays `partial`                                                                                        | Decided by product owner sub-agent (confidence high): a calendar paints nothing (no day rows, nothing reads `calendars`), a placeholder under `docs/SPEC.md` §7.5, the allowance spec's own argument.                                                       |
| 2   | The display switches the allowance spec handed over                 | Ship `blockWeekends` and `companyHolidaysEnabled` (08-S5f); withhold `holidaysEnabled`                                                                                                                       | Decided by product owner sub-agent (confidence medium): the first two have a visible effect once cells are controls; the third has nothing to show without a day source.                                                                                    |
| 3   | Ticket cut                                                          | Six serial tickets, each repository to screen (day, week and language, run, trips, company holidays, switches); no holiday-manager dialog                                                                    | Decided by product owner sub-agent (confidence medium): each switch is one concept so its row and every honouring path land together (§8); the manager mostly existed for calendars.                                                                        |
| 4   | Clearing a run                                                      | One "Clear {n} marked days" in the picker, applies to the selection, names the count, no confirmation dialog                                                                                                 | Decided by product owner sub-agent (confidence high), security and tenancy condition 8 met by the count in the choice: a run you can log but only clear day by day is half a promise.                                                                       |
| 5   | `userId` on the new server functions                                | Omitted; a request carrying one is refused; logging for a colleague is the shared-plan stage's                                                                                                               | Decided by security and tenancy sub-agent (confidence high): no code can create a second person on a plan; it would add the hardest rule to the first slice.                                                                                                |
| 6   | Guard shape for removals and company holidays                       | `clearEntries(planId, from, to)` deletes only the caller's rows; `removeEntry` stays unreachable; company-holiday writers guarded in place with `requirePlanOwner`                                           | Decided by security and tenancy sub-agent (confidence high): no row-id path to another person's day; no unguarded twin left to import by mistake (allowance spec rows 20 and 21).                                                                           |
| 7   | Which trips are drawn                                               | The viewer's member trips (`memberTripIds`), not archived, both dates, overlapping the year; the client gets `{ tripId, title, startDate, endDate }`                                                         | Decided by security and tenancy sub-agent (confidence high), verified against ADR 0007 and `trips.ts`: the plan's tenant-only read leaks private trips.                                                                                                     |
| 8   | Where the pure logic lives                                          | `src/lib/vacay/` (`entry-kinds`, `week`, `range-select`), reusing `trip-dates.ts`; components stay thin                                                                                                      | Decided by software architect sub-agent (confidence high): the cap and the weekend rule are shared by server and client; the allowance spec already put `carry-over.ts` there.                                                                              |
| 9   | Atomic range write                                                  | Chunked multi-row `INSERT ... ON CONFLICT DO UPDATE` in one `runBatch`, then the recompute; returns a count; cap 366 enforced once in the repository schema                                                  | Decided by software architect sub-agent (confidence high): removes the update-then-insert gap and the pre-read; a queue is wrong for 366 rows (`batch.ts`). The upsert is the first on a tenant table, so it stamps the org and has its own isolation test. |
| 10  | Where the grid's extra read lives and its order                     | A new GET `loadVacayGridFn({ year })` in `-server/vacay.ts`, parallel with `loadVacay`, before the allowance call                                                                                            | Decided by software architect sub-agent (confidence medium): `library.ts` is another stage's; no plan id, so no `ensurePlan` race; `loadShell` already runs the settings insert.                                                                            |
| 11  | Dependency on the unimplemented allowance spec                      | A hard prerequisite expressed as `Blocked by` per ticket; guards are not rewritten here; a company holiday on a date with the owner's own entry leaves the entry in place, still charged, both marks visible | Decided by software architect sub-agent (confidence high) and product owner sub-agent: a second owner of the guards would violate §8 and the allowance spec's criterion 5.                                                                                  |
| 12  | Weekend definition                                                  | Saturday and Sunday by actual weekday, fixed; the inset moves with the week rotation                                                                                                                         | Applied default (product owner condition): there is no weekend setting and no per-locale definition; the grid draws it this way today.                                                                                                                      |
| 13  | A run charges weekends and company holidays                         | One shared `daysToWrite` decides the days and their cost on client and server; the picker shows the true cost; 08-S5f makes it skip blocked days                                                             | Decided by UX and product owner sub-agents: showing a cost that differs from the charge is a silent allowance error; one owner of the rule (§8).                                                                                                            |
| 14  | Plan paths that no longer exist                                     | `e2e/product-modules.spec.ts` (no snapshots), `scripts/visual/capture.mjs`; no `holiday-manager.tsx`; `modules.ts` in 23 locales                                                                             | Applied default: ADR 0016 and `docs/plans/12-verification-protocol.md` at HEAD; `docs/SPEC.md` §9.                                                                                                                                                          |
| 15  | Keyboard model                                                      | `role="grid"` per month with buttons in gridcells, ONE roving tab stop for the year, the `calendar.tsx` key model                                                                                            | Decided by accessibility sub-agent (confidence high): a two-dimensional set; arrows already cross months so twelve remembered days would disagree.                                                                                                          |
| 16  | Mode control                                                        | A two-option `RadioGroup` ("Mark days as"), owner only, not rendered otherwise                                                                                                                               | Decided by accessibility sub-agent (confidence medium): `PillNav` is navigation, `Tabs` needs a panel, a `Switch` leaves the default mode unnamed.                                                                                                          |
| 17  | Activating a day, and a run on a phone                              | The tap opens the kind picker; a run is a two-tap "from / to" started from the picker; Shift+arrows and mouse drag are shortcuts; no touch drag, no long-press                                               | Decided by UX and accessibility sub-agents (confidence medium / high): a stray tap must not spend allowance; a drag fights scroll and fails WCAG 2.5.1 and 2.5.7.                                                                                           |
| 18  | Failure and empty states                                            | One bottom-anchored danger alert naming the dates, retry only for transport/5xx, focus stays on the day; the empty action goes to today or 1 January; the description says "select"                          | Decided by UX sub-agent (confidence medium): at 360px an alert above January is a screen away. "Select" is neutral across touch and mouse (the sub-agent suggested device-specific words; not adopted, one key serves both).                                |
| 19  | Kind names and the cost line                                        | Leave, Half day of leave, Sick day, Working remotely, Public holiday, Other, each with a cost line; no bare "holiday"; non-colour cue per kind                                                               | Decided by UX and accessibility sub-agents: the shipped `en` is British ("holiday" is leave) while the `holiday` kind costs nothing; the kind is invisible on a phone today.                                                                                |
| 20  | Risk label                                                          | `risk-medium`, no `security` label; a ticket whose diff reaches `base.ts`, `schema.ts`, `drizzle/` or `src/server/auth` becomes `risk-high`                                                                  | Decided by security and tenancy sub-agent (confidence medium): `SDLC.md` defines risk-high by path; this stage touches none.                                                                                                                                |
| 21  | Term for "diary"                                                    | The copy says "trip"                                                                                                                                                                                         | Applied default (UX sub-agent): "diary" collides with the Journal module.                                                                                                                                                                                   |
| 22  | Name later stages by id in this spec?                               | No; only the allowance tickets (already specified) and this stage's own tickets carry ids                                                                                                                    | Applied default, verified in `.ai/scripts/backlog-status.mjs` (`coversStage`): another stage's id in a spec's text hides that stage from `--plan`.                                                                                                          |

Panel verdicts: filled in below once the panel has run.
