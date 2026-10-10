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
   remote, public holiday, other) with what each kind costs; the year is one keyboard grid in the reader's language; a failed write
   reverts and says so; the guarded, atomic repository writers behind it; the carry-over recompute after every write; and the plan's
   **stored** block-weekends and company-holiday settings are honoured from the first write, so no ticket ever charges a weekend the
   plan blocks.
2. **08-S5b - the year reads in your week.** The week start comes from the settings that already exist (a Sunday workspace reads a
   Sunday-first year, weekends move with it) and the rest of the screen's English literals become catalogue keys.
3. **08-S5c - log and clear a run of days.** A two-tap "from / to" that works for touch, mouse, keyboard and screen reader alike
   (Shift+arrows and mouse drag as shortcuts), one atomic chunked write, a 366-day cap, and one "Clear" for the selection.
4. **08-S5d - the owner switches weekend blocking.** The "Block weekends" row in the allowance spec's settings dialog; the grid
   follows it.
5. **08-S5e - trips you are on show through.** A marker on the days a trip of the viewer's occupies, read only from trips the viewer
   is a member of.
6. **08-S5f - company holidays.** A mode control, shown to the plan's owner, in which the same gestures record or clear a company
   holiday, and the "Company holidays" row of the settings dialog. Closes `ADD-02`.

No schema change, no migration, no route added, no package added, no queue message.

**What is deliberately not here.** Public holidays from an external source (no day rows exist anywhere in the schema and there is no
feed), and therefore any control for the holiday-calendar subscriptions and the third display switch (`holidaysEnabled`): a control
that paints nothing is a placeholder (`docs/SPEC.md` §7.5). `ADD-03` therefore stays `partial` (Resolved assumption 1). The open
half of `ADD-03` (the day-source decision, the subscription controls and `holidaysEnabled`) has an owner: the plan records the
blocker only in its own stage block (`docs/plans/08-product-modules.md`, Stage 08-S5, Blockers) and says it is also recorded in
`docs/plans/11-boundaries-and-blockers.md`, **which does not mention it**. The follow-up issue #1107, filed with this spec and named in the PR
body, carries it; choosing a feed is a licence and cost decision, so it is a person's.

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
- **`setEntry` is a read then a write.** Two tabs recording the same new day can race into the unique-index violation.
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
  fourteen days, not ten. The plan's `vacay_plans` row stores `block_weekends`, `holidays_enabled` and `company_holidays_enabled`, all
  `true` by default, and nothing reads them.
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
- **Mobile chrome.** Below `lg` a fixed tab bar (`src/components/layout/mobile-nav.tsx`) and a "Report a problem" button sit at the
  bottom; `AppToaster` already clears both with `offset="calc(var(--safe-bottom) + 5.5rem)"`
  (`src/components/layout/app-toaster.tsx`). Anything this stage anchors to the bottom has to clear them too.

The reader this serves: a traveller who plans leave around their trips and needs to record "I am away 3 to 14 August" without
leaving the keyboard, on a phone, in their own language, and to see the allowance move as they do it. The reference behaviour (twelve
months at a glance, click to log with a kind, per-person colours, a marker where a trip already occupies the day, a mode in which the
same click records a day the plan's people are away that costs no allowance - `wiki: Vacay-Calendar`) is delivered in planned.travel's
own vocabulary, and the public-holiday feed is not.

## 📝 Proposed Solution

### What the stage owns and what it does not

| Owned (this stage writes it)                                                                                                                                                                                                                                                                                                                          | Not owned (read only, or left alone)                                                                                                                               |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/server/repos/vacay.ts` - edit: `setEntry` (now the single-day case of one upsert helper), `setEntryRange` (rewritten), `addCompanyHoliday`, `removeCompanyHoliday` guarded in place; new `clearEntries`, `setCompanyHolidayRange`, `clearCompanyHolidays`, `listTripDateRanges`; the cost table moves out                                        | `src/server/db/schema.ts`, `drizzle/` - **no schema change, no migration**                                                                                         |
| `src/lib/vacay/` - new modules beside the allowance spec's `carry-over.ts`: `entry-kinds.ts` (kinds, cost table, `MAX_ENTRY_RANGE_DAYS`), `day-rules.ts` (weekend rule, which days a write touches and costs), `week.ts` (`Home`/`End` targets from 08-S5a, rotation from 08-S5b), `range-select.ts` (the pure anchor/focus model), with `__tests__/` | `src/routes/_app/-server/library.ts` - held by the journal stage this wave; `loadVacay` is **not** edited and its `weekStartsOn: 1` literal is left for that stage |
| `src/routes/_app/-server/vacay.ts` - edit (created by the allowance tickets): `loadVacayGridFn` and the write functions; `__tests__/vacay.test.ts`                                                                                                                                                                                                    | `addHolidayCalendar`, `removeHolidayCalendar`, `removeEntry`, `invitePlanMember`, `setPlanMemberStatus`, `removePlanMember`, `deletePlan` - stay unreachable       |
| `src/routes/_app/vacay.tsx` - edit: composes the grid, the picker and the bottom region; `VacayPending` to twelve months                                                                                                                                                                                                                              | `src/routes/_app/-ui/scaffold.tsx`, `-lib/format.ts`, `-lib/tone.ts` - imported, not touched                                                                       |
| `src/components/vacay/` - `month-grid.tsx`, `day-cell.tsx`, `day-picker.tsx`, `bottom-region.tsx`, `range-bar.tsx`, `mode-control.tsx`, `index.ts` + `__tests__/`                                                                                                                                                                                     | `src/components/ui/**`, `src/styles/tokens.css` - no primitive and no token is missing                                                                             |
| `src/lib/i18n/messages/<locale>/modules.ts` - edit, **all 23 locales**                                                                                                                                                                                                                                                                                | `src/lib/i18n/messages/en/shell.ts` (`nav.vacay`), `src/server/billing/**`, `src/lib/plans.ts` - no quota, no `MODULE_KEYS` entry                                  |
| `src/server/repos/__tests__/tenant-isolation.test.ts`, `repositories.test.ts` - append; the allowance spec's structural allowlist test - edit (criterion 5 there)                                                                                                                                                                                     | `e2e/helpers/**` - reused, not edited                                                                                                                              |
| `e2e/product-modules.spec.ts` - create or append (no baselines, ADR 0016)                                                                                                                                                                                                                                                                             | `src/components/ui/calendar.tsx` - its latent disabled-button tab-stop bug is noted, not fixed here                                                                |
| `CONTEXT.md` - glossary: **Leave day** and **Company holiday** (08-S5a: both reach the screen in its legend and day names)                                                                                                                                                                                                                            |                                                                                                                                                                    |
| `src/components/vacay/plan-settings-dialog.tsx` (created by the allowance tickets) - edit in 08-S5d and 08-S5f only                                                                                                                                                                                                                                   |                                                                                                                                                                    |
| `src/routes/api/dev/-seed/apply.ts` - edit in 08-S5c: it calls `setEntryRange` over whole ranges, which now skip blocked weekends and company-holiday dates, so it counts the returned `written` and accepts leaner demo data; the guard's owner rule still admits its explicit `userId`                                                              |                                                                                                                                                                    |
| `src/server/repos/batch.ts` and its test - edit: `chunkFor` takes an optional count of parameters the statement reserves (default 0, existing callers unchanged)                                                                                                                                                                                      |                                                                                                                                                                    |

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
  second person on a plan today. `setEntry` and `setEntryRange` call `requirePlanActor` in place; their repository input keeps the
  optional `userId` only for the dev seeder, under the allowance spec's rule: a `userId` other than the caller's is **owner only**
  (an accepted non-owner gets `PlanOwnerOnlyError`), the target must be an accepted plan member **and** a current workspace member
  (else `NotFoundError`), and nothing is written on a refusal. Both paths are tested (criteria 5 and 13).
- **Clearing is by plan, caller and date range.** `clearEntries(scope, { planId, from, to })` calls `requirePlanActor`, then deletes
  with `plan_id = ?` and `user_id = scope.ctx.userId` and the range, in one statement (`removeWhere`). There is no row-id path to
  another person's day; a colleague's rows on the same dates are untouched; clearing nothing is not an error. `removeEntry` stays
  unreachable and off the allowlist.
- **A company holiday belongs to the plan**, so only its owner records or clears one: `addCompanyHoliday`,
  `removeCompanyHoliday` (resolve the row inside the workspace, then `requirePlanOwner(row.planId)`), `setCompanyHolidayRange` and
  `clearCompanyHolidays` all call `requirePlanOwner`; an accepted non-owner gets `PlanOwnerOnlyError`. The mode control is not
  rendered for a non-owner at all (not disabled with no explanation).
- **The repository decides which days a write touches.** `setEntry` and `setEntryRange` read the plan's `blockWeekends` and
  `companyHolidaysEnabled` and the plan's company-holiday dates in the range **themselves** and pass them to `daysToWrite`. The
  server-function inputs carry no such field, so the cost the picker shows and the cost charged cannot diverge by client input.
- **Hiding a control is not the guard.** The server refuses. Every handler starts with `appScope()` and never forwards a
  client-supplied user id.
- **Tenancy.** Every statement is `tenantFilter()`-bound or stamps `organization_id` from the scope; the one new upsert adds a
  `setWhere` on the organization (its conflict target, `vacay_entries_plan_user_date_unq`, carries no tenant column, so the plan
  resolved inside the workspace is what scopes it and the `setWhere` is belt and braces). The upsert's values are built on the server,
  never spread from the input.
- **The structural allowlist** of the allowance spec (its criterion 5) is edited by each ticket for the functions it reaches, and
  only those: `setEntry`, `clearEntries` (08-S5a), `setEntryRange` (08-S5c), `listTripDateRanges` (08-S5e), `addCompanyHoliday`,
  `removeCompanyHoliday`, `setCompanyHolidayRange`, `clearCompanyHolidays` (08-S5f). `addHolidayCalendar`, `removeHolidayCalendar`
  and `removeEntry` stay off it.

### Phase 1 (08-S5a) - log and clear one of your own days

**Shared pure modules.**

- `src/lib/vacay/entry-kinds.ts`: the one owner of the kind list's order, the allowance cost of each kind (`ENTRY_KIND_COST`, moved
  out of `vacay.ts`, which imports it) and `MAX_ENTRY_RANGE_DAYS = 366`. Day arithmetic reuses `inclusiveDays` and `shiftDate` from
  `src/lib/trip-dates.ts`; no new date helper is written, and `calendarRange` in `vacay.ts` is replaced by them.
- `src/lib/vacay/day-rules.ts`: `isWeekend(date)` by the **actual weekday** (Saturday and Sunday, fixed - there is no weekend
  setting - Resolved assumption 12); `blockedReason(date, plan)` (`'weekend' | 'companyHoliday' | null`) from the plan's stored
  `blockWeekends`, `companyHolidaysEnabled` and company-holiday dates; and `daysToWrite(dates, kind, plan)`, which returns `{ days,
skipped, cost }`: the dates a write will touch, those left out and the allowance cost of the days written. It is the **one owner**
  of "what does this write touch and cost", used by the repository to write and by the picker to show the cost (Resolved assumption
  13).

**Repository (`src/server/repos/vacay.ts`).**

- One private upsert helper builds the statements for a set of dates: chunked multi-row `INSERT ... ON CONFLICT (plan_id, user_id,
date) DO UPDATE`, written so `SET` binds nothing (`kind = excluded.kind` when a kind is supplied, `note = coalesce(excluded.note,
vacay_entries.note)`, `updated_at = excluded.updated_at`) and the only value the conflict clause binds is the organization id of
  its `setWhere`. **Chunk size is derived, not assumed, and `chunkFor` in `src/server/repos/batch.ts` stays its one owner** (it gains an optional count of reserved parameters; `setCompanyHolidayRange` uses the same derivation): `floor((MAX_BOUND_PARAMETERS - conflictParameters) / columnsPerRow)`, with
  `vacay_entries` at nine columns and one conflict parameter that is 11 rows (100 parameters) and 34 statements for 366 days. If the
  built statement binds more than that (for example a literal `updated_at` bound in `SET`), the chunk shrinks to 10 rows and 37
  statements. A unit test builds a full-size chunk and asserts `toSQL().params.length <= MAX_BOUND_PARAMETERS`: the Node SQLite the
  tests run on does not refuse a 101-parameter statement, so only that assertion catches the D1 failure.
- `setEntry` is the **single-day case of that helper** (no read-then-write, so two tabs on the same new day cannot trip the unique
  index): `requirePlanActor`, `blockedReason` (a blocked day is refused by a diagnostic repository error), one statement, then
  `recomputeCarryOver(scope, planId, userId)` (the allowance spec's function, which the entry writers must call).
- `clearEntries(scope, { planId, from, to })`: as above; returns the number removed; then `recomputeCarryOver`.
- `setEntryRange` is **not touched** in this ticket (no production caller; only the dev seeder and the repository suites call it); 08-S5c guards and rewrites it together.
- **A recompute failure does not fail a write that succeeded.** The writers run the recompute after the write, catch its failure, log
  it (not throw) and return normally; the carry is stale until the next write on that chain repairs it. The screen therefore never
  says "not saved" about a day that was saved (Edge Cases).
- The repository input schemas gain the cap: `to` before `from` and a span over `MAX_ENTRY_RANGE_DAYS` are refused by the repository
  schema, once, so the server-function validator, the range model and the repository agree (Phase 3 uses it).

**Server functions (`src/routes/_app/-server/vacay.ts`).**

- `loadVacayGridFn` (GET, `{ year }`): `{ today }` from `todayIso()` (`serialise.ts`; server-resolved, so `aria-current` and the empty
  state's action never read `new Date()` at render and cannot differ between server and client). 08-S5b adds `weekStartsOn`, 08-S5e
  adds `tripWindows`. It takes no plan id and calls no `ensurePlan`, so the route loader runs it in parallel with `loadVacay`
  (`Promise.all`), then the allowance function with that plan's id, as the allowance spec orders it.
- `setVacayEntryFn` (POST): `z.strictObject({ planId, date, kind })`, the handler is `appScope()` then `setEntry`.
- `clearVacayEntriesFn` (POST): `z.strictObject({ planId, from, to })`; a single day is `from === to`.
- Zod v4, `z.strictObject()` with the `error` parameter, reusing the repository's `idSchema` / `dateSchema` / kind enum.

**Language of the grid.** Month and weekday names come from `monthName` / `weekdayName` in `src/lib/format.ts` (the frozen tables;
**never** `Intl` at render, which hydrates differently on workerd and WebKit), so the extracted `month-grid.tsx` carries no English
literal from the day it exists. Headings render the `short` form; `NameWidth` has no narrower form. If a locale's short form does
not fit its column at the four-column layout (`ar`, `pl`, `vi`, `zh` are the ones that can), an e2e no-overflow check fails and the
fix is a narrow form in `format.ts` with the long name as the accessible text. The legend is rewritten in this ticket and uses the
kind keys. The header stays Monday-first until 08-S5b.

**UI (`src/components/vacay/`).** See [UI/UX](#-uiux): the interactive grid, the picker, the states.

**Cost labels.** The picker states what each kind costs from the same table the repository uses; one test asserts the label set and
`ENTRY_KIND_COST` agree.

**What is honoured from this ticket.** The plan's stored `blockWeekends` and `companyHolidaysEnabled` (both `true` by default) and its
company-holiday rows are honoured by `daysToWrite` from the first write, though their dialog rows ship later (08-S5d, 08-S5f).
Nothing was writable before this ticket, so nothing changes for a traveller who had logged days; any existing weekend entry stays visible and clearable (UI/UX).

### Phase 2 (08-S5b) - the year reads in your week

- `loadVacayGridFn` gains `weekStartsOn`: one call to `getEffectiveSettings(scope, scope.ctx.userId)`
  (`src/server/repos/settings.ts`), read and never written, narrowed at the boundary with `z.number().int().min(0).max(6).catch(1)`.
  No per-plan copy, no second resolver, no column. (`getEffectiveSettings` runs `ensureOrganizationSettings`, an insert on a
  workspace's first read; `loadShell` already does so on every app request, so this adds nothing.)
- `src/lib/vacay/week.ts` (pure): the seven weekday indices in column order for a `weekStartsOn`; the leading blanks of a month;
  `Home`/`End` targets (created in 08-S5a with the constant `1`). The weekend inset follows `isWeekend` (by weekday, `day-rules.ts`), not the column, so it moves with the
  rotation. Table-tested over `weekStartsOn` of `0`, `1` and `6`; `6` is in the table because it is the only value at which the
  weekend straddles both edges of the row.
- The rest of `vacay.tsx`'s literals become keys: the header (eyebrow, title from `nav.vacay`, description), the travellers panel and
  its "(you)" suffix. The year switcher, loading text and error title were localised by the
  allowance spec.

### Phase 3 (08-S5c) - log and clear a run of days

- **The range model (`src/lib/vacay/range-select.ts`, pure).** Anchor, focus and direction; the inclusive date list a selection
  resolves to, backwards or forwards, across a month edge (the UI keeps a selection inside the year on screen, so the cap is not
  reachable from it); `MAX_ENTRY_RANGE_DAYS` imported from `entry-kinds.ts`. The picker feeds the selection to `daysToWrite`
  (`day-rules.ts`) and shows the true count and cost; the repository runs the same function, so the cost shown is the cost charged.
- **`setEntryRange` rewritten (atomic).** The Phase 1 upsert helper over the whole range: **all** statements handed to one
  `runBatch` (one D1 batch, so a half-written fortnight is not a reachable state), then `recomputeCarryOver`. `organization_id` is
  stamped from the scope; there is no `.returning()`. Semantics kept from today: `kind` is in `SET` only when supplied (an omitted
  kind keeps the existing value; a new row takes the column default), `note` is `coalesce(excluded.note, vacay_entries.note)`,
  `updated_at` is set. Days `daysToWrite` leaves out (a blocked weekend, a company holiday) are skipped, not an error. It returns the
  number of days written; the old return value (every entry of the user in every year) is dropped - the seeder and
  `repositories.test.ts` ignore it. `requirePlanActor` first.
- **The D1 limit is a design constraint with a number.** Batch statements count toward the Worker invocation's D1 query limit (50 on
  the Workers Free plan, 1000 on Paid). The worst case is 4 guard statements (the plan, the membership, the plan's company-holiday dates and the flag read), at most 37 upsert statements and the recompute (the allowance spec's `recomputeCarryOver`: the plan, the years and the entries reads, then one update per later year that holds an allowance row, `k`): 44 + `k`, inside 50 while `k` is at most 6. A test counts the statements a 366-day write issues and fails above 37 for the upsert batch or above 7 outside it and the recompute's `k` updates; `k` is bounded by the later years with a stored allowance row, a single digit in practice, and if it can exceed 6 the lower cap below is the answer. If a future limit is lower, the answer is a smaller
  `MAX_ENTRY_RANGE_DAYS` in `entry-kinds.ts`, the one place it lives.
- **Server functions.** `setVacayEntryRangeFn` (POST, `z.strictObject({ planId, from, to, kind })`; no weekend or holiday fields);
  `clearVacayEntriesFn` already takes a range. On any failure the client calls `router.invalidate()` so the screen shows stored
  truth, not a guess.
- **Gestures (all produce the same value from the same model).** The required path is the two-tap "from / to" started from the
  picker's "Select more days". Shift+arrow (keyboard) and Shift+click and a mouse drag (`pointerType === 'mouse'` only) are
  shortcuts; touch keeps the default `touch-action`, so the page scrolls normally. Either end of a run may be a blocked weekend: "I am
  away from Saturday the 1st" still works, because the run skips the blocked days.
- **Clear.** "Clear {n} marked days" in the picker applies to the selection and names the count; no confirmation dialog (the count is
  the warning; Resolved assumption 4).

### Phase 4 (08-S5d) - the owner switches weekend blocking

- `plan-settings-dialog.tsx` (allowance spec) gains one `CheckboxField` row, **Block weekends**; `updateVacayPlanFn`'s `pick` widens
  to `blockWeekends`. Nothing else changes in the grid: it already follows the stored value (Phase 1), so turning it off makes weekend
  cells writable on the next read and turning it on makes them inert again (existing weekend entries stay visible and clearable).
- The cell's reason text switches from `vacay.blocked.weekend` to `vacay.blocked.weekendChange`, which names the switch (a new key, so the 22 translated locales cannot keep stale text under an edited one).
- The slice a person sees: "I work Saturdays" turns blocking off and logs a Saturday. Resolved assumption 24 records that a fixed
  Saturday-Sunday weekend blocks Sunday, a working day for many `ar` readers, and that this switch is their remedy.

### Phase 5 (08-S5e) - trips you are on show through

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

### Phase 6 (08-S5f) - company holidays

- **Mode control (`mode-control.tsx`).** A `RadioGroup` of two, labelled "Mark days as": "My time off" / "Company holiday", shown only
  to the plan's owner and only while the plan's company holidays are on. Not `PillNav` (primary navigation: a `<nav>` of links), not
  `Tabs` (there is no tab panel), and not a `Switch` (its off state would leave the default mode unnamed). Changing it is announced
  politely; each month grid's accessible name carries the mode.
- **In company mode** the same gestures (tap, two-tap range, Shift+arrows) record or clear company holidays instead; the picker offers
  "Mark as company holiday" and "Clear {n} company holidays" and no kinds; the selection preview takes the `warning-soft` tone.
- **Repository.** `setCompanyHolidayRange(scope, { planId, from, to })` - chunked `INSERT ... ON CONFLICT (plan_id, date) DO NOTHING`
  in one `runBatch` (`DO NOTHING` binds nothing extra, so the same `chunkFor` derivation gives 14 rows of seven parameters, 98 per statement);
  `clearCompanyHolidays(scope, { planId, from, to })` - one `removeWhere`; both `requirePlanOwner`, both capped at
  `MAX_ENTRY_RANGE_DAYS`. `addCompanyHoliday` and `removeCompanyHoliday` are guarded in place (they stay exported for the seeder and
  tests). No label is edited here: a recorded day has a null label, and an existing label shows in the cell's accessible name.
- **Server functions.** `setCompanyHolidaysFn` and `clearCompanyHolidaysFn` (POST, strict). Neither enqueues anything. They do not recompute carry-over: company holidays change no one's used days. The grid announces company-mode results through the `vacay.status.company.*` keys, not the kind lines.
- **The settings row.** `plan-settings-dialog.tsx` gains the **Company holidays** `CheckboxField`; `updateVacayPlanFn`'s `pick`
  widens to `companyHolidaysEnabled`. On (default): company-holiday dates are drawn and personal runs skip them. **Off:** they are not
  drawn, the mode control is not offered, the rows are kept (hidden, not deleted, like the allowance spec's carry-over switch), and
  those dates can be logged as personal days. `holidaysEnabled` is not offered and stays at its column default; it moves with the
  open half of `ADD-03` (Out of scope).
- A company holiday on a date that already holds the owner's own entry leaves the entry in place, still charged, with both marks
  visible and named (Resolved assumption 11).
- Copy never says "the whole workspace": a company holiday applies to everyone on this leave plan. Until the shared-plan stage lets a
  second person onto a plan, that is the owner alone, and the ticket says so in its description: it behaves much like the personal
  "Public holiday" kind, and the demo seeder's members show the shared case.

### Alternatives considered, and why they lost

| Alternative                                                                 | Why it lost                                                                                                                                                                     |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Ship the holiday-calendar subscription list the plan describes              | The calendar paints nothing; a control with no visible effect is a placeholder (`docs/SPEC.md` §7.5). The repository functions stay unreachable and the feed stays deferred.    |
| Keep the two-phase `setEntryRange` and only chunk the insert                | Leaves the committed-updates-then-failed-inserts state the plan promises not to have.                                                                                           |
| Keep `setEntry` as read-then-write beside an upsert range                   | Two statement builders for one row, and a race on a new day; one helper is one owner.                                                                                           |
| Queue the range write                                                       | A 366-row write belongs in the request path (`batch.ts`).                                                                                                                       |
| Row-id removal (`removeEntry`) guarded by loading the row                   | A second guard to remember; by plan, caller and range there is no path to another person's row, and it serves one day and a run.                                                |
| `tenantFilter()`-only trip read; or `readableTrips`                         | The first leaks private trips; the second also draws organization-visible trips the viewer is not on.                                                                           |
| `PillNav`, `Tabs` or `Switch` as the mode control                           | Navigation role / no tab panel / an unnamed default state. A two-option `RadioGroup` has the right role.                                                                        |
| Record the default kind on tap, picker to change it                         | A stray tap while scrolling twelve months on a phone silently spends allowance.                                                                                                 |
| Touch drag or long-press for a range                                        | A drag fights page scroll; long-press is undiscoverable and collides with the OS callout and screen-reader gestures; a drag-only range fails WCAG 2.5.1 and 2.5.7.              |
| Exclude weekends and company holidays from the _count_ instead of the write | Three owners of one rule (`getPlanOverview`, `countUsedDays`, the carry-over walk) would have to agree.                                                                         |
| Honour the block-weekends setting only in the ticket that ships its row     | Every ticket before it would charge a Monday-to-Sunday fortnight 14 days and the last one would change every existing plan at once; honouring from the first write avoids both. |
| One tab stop per month (the plan)                                           | Arrows and PageUp/PageDown already cross months, so twelve remembered days disagree with where the arrows go and getting past the year takes twelve Tab presses.                |
| Edit `loadVacay`                                                            | `library.ts` is the journal stage's this wave.                                                                                                                                  |

## 📝 Architecture

- **One concept, one owner (`docs/SPEC.md` §8).** Kind order, cost and the range cap: `src/lib/vacay/entry-kinds.ts`. The weekend
  rule and which days a write touches and costs: `day-rules.ts`. Week rotation: `week.ts`. The selection model: `range-select.ts`.
  Persistence, the actor rules and every statement: `src/server/repos/vacay.ts` (the only SQL owner). Names of months and weekdays:
  `format.ts`. The week start: `getEffectiveSettings`. Components render and own no rule; the server functions validate, forward and
  own no rule.
- **Seams.** Route loader: `Promise.all([loadVacay, loadVacayGridFn])`, then the allowance function with the plan id. A write goes
  component, server function, `appScope()`, repository function (guard, statements, `recomputeCarryOver`), then the component calls
  `router.invalidate()` so every figure on screen is the database's. `components/ui` never fetches or imports `server/`; the vacay
  components take plain props and call the server functions directly, as the allowance spec's do.
- **Cloudflare cost.** A day write is the guard reads, one upsert and the recompute (an entries read and at most one batch of
  single-digit updates): more D1 calls per click, no more stored rows. A range is one batch of at most 37 upsert statements (34 when
  the conflict clause binds one parameter); the invocation total is bounded in Phase 3. Nothing is queued, no realtime patch, no
  Durable Object.

## 📝 Data Model

**No schema change and no migration.** Written: `vacay_entries` (`kind`, `note`, `date` behind the unique
`vacay_entries_plan_user_date_unq`, which makes a day idempotent: choosing twice sets, it never duplicates), and
`vacay_company_holidays` (unique `(plan_id, date)`). Read: `trips` (via the viewer's membership), `organization_settings` /
`user_settings` (week start), `vacay_plans` (the switches `blockWeekends` and `companyHolidaysEnabled`, written by 08-S5d and
08-S5f), `vacay_company_holidays` (to decide the days a personal write touches). `vacay_holiday_calendars` is neither read nor
written. Dates stay `YYYY-MM-DD` text. No index is added: entries are read by `(plan_id, date)` and `(organization_id, plan_id)`,
trips by the existing membership index `(organization_id, user_id)`.

## 📝 API Contracts

| Function                 | Method | Input (all `z.strictObject`, no `userId`) | Output                                                   | Ticket                    |
| ------------------------ | ------ | ----------------------------------------- | -------------------------------------------------------- | ------------------------- |
| `loadVacayGridFn`        | GET    | `{ year }`                                | `{ today, weekStartsOn, tripWindows }` (grows by ticket) | a, b, e                   |
| `setVacayEntryFn`        | POST   | `{ planId, date, kind }`                  | the entry row                                            | a                         |
| `clearVacayEntriesFn`    | POST   | `{ planId, from, to }`                    | `{ removed }`                                            | a (c reuses it for a run) |
| `setVacayEntryRangeFn`   | POST   | `{ planId, from, to, kind }`              | `{ written, skipped }`                                   | c                         |
| `setCompanyHolidaysFn`   | POST   | `{ planId, from, to }`                    | `{ written }`                                            | f                         |
| `clearCompanyHolidaysFn` | POST   | `{ planId, from, to }`                    | `{ removed }`                                            | f                         |

Errors: a plan the caller may not see is `NotFoundError`; a non-owner recording a company holiday is `PlanOwnerOnlyError`; a write on a
blocked day is a diagnostic repository error. None is authored copy (`AUTHORED_ERROR_NAMES` stays closed), so each crosses the wire as
`{ kind: 'unexpected' }`: the UI never offers the action, and after any failure it re-reads the page rather than reading the error's
class (the allowance spec's pattern).

## 📝 UI/UX

Route `/vacay` exists: no route file, no `pnpm generate-routes`. SSR stays the default. `data-part` attributes this stage publishes:
`vacay-day` (with `data-date`), `vacay-mode` (with `data-value`), `vacay-range-bar`, `vacay-bottom-region`.

### The grid (08-S5a)

- **Structure.** One `<table role="grid">` per month, named by the month and year (`formatMonthYear`), column headers `th scope="col"`
  with the long weekday as `abbr`, and in each `gridcell` a real `<button>` (`DayCell`, keyed by its date so it keeps its identity
  across an optimistic re-render and the focus-return nodes stay connected). The precedent for the key model is
  `src/components/ui/calendar.tsx` (grid role, roving tab stop, RTL-aware arrows, `PageUp`/`PageDown`, polite month status).
- **One roving tab stop for the whole year.** At first render it is on today in the current year and on 1 January in any other year.
  Arrow keys move by day (they follow reading direction in RTL), `PageUp`/`PageDown` by month, `Home`/`End` to the ends of that week
  (derived from `weekStartsOn`, never from Monday and Sunday: 08-S5a calls the `week.ts` helper with the constant `1`, 08-S5b passes the loaded value), and they cross month edges but **stop at 1 January and 31 December**:
  no wrap, no year change. `Enter`/`Space` activates. `Shift`+arrow extends a pending range (08-S5c); after it `Enter`/`Space` opens
  the range picker and `Escape` clears the selection.
- **Blocked, disabled and in-flight cells use `aria-disabled` (and `aria-busy` in flight), never native `disabled`** (a disabled
  button cannot take focus and would orphan the roving tab stop). In "My time off" mode a blocked empty weekend or company-holiday cell (in company mode a company-holiday cell is operable: it is the cell the owner clears) answers an activation with its reason as **visible text** in the bottom region, tied to the cell with `aria-describedby` while it shows and **also written into the polite live region**, because a description added to an already-focused cell is not reliably read out. A
  blocked day that **already holds an entry** is not `aria-disabled`: it opens the picker with only "Clear this day". An in-flight
  cell keeps its numeral, drops to 60% opacity, and a second activation on it is ignored (its busy state is the answer; no message).
  While a write is in flight the cell shows its own optimistic fill; a re-read triggered by another write does not wipe it until
  **its own** write settles (a per-date pending map overrides the loaded value), so marking 3 and then 4 August never flickers.
- **Accessible name of a day**: the localised full date, then the parts that apply joined with `formatList`: the kind, "Company
  holiday", "Trip: {title}", "{n} other travellers away". The `title` attribute goes. The mode is **not** repeated in each day's name;
  it is in each grid's name, and the picker offers the company option by name (the picker title does not repeat it). `aria-current="date"` marks `today` from the loader. A day that opens the picker has `aria-haspopup="dialog"`. A day with no parts is named by the date alone.
- **Non-colour cues, each distinguishable from the others without colour.** The six kinds: `half_day` by a half fill, the other four
  non-leave kinds by a small corner glyph in `currentColor`. A **company holiday** by an inset **dashed** border (WCAG 1.4.1: the
  `warning-soft` tint is never the only mark). A **selected** cell (a pending range, 08-S5c) by an inset **solid** 1px border and the
  outlined start. The **focus ring** is a 2px solid inset ring. Every cue except the focus ring is listed in the legend, with the trip hairline and the other-traveller underline (the kind rows reuse the kind keys; the selected-cell row ships with 08-S5c).
- **Focus ring inside the cell** (`focusRingInset`), so a focused day cannot reflow a week or be clipped by the card. It is drawn in
  `currentColor` - the cell's own ink, which is `inkOn(fill)` on a filled cell and the page ink on an empty one - not in
  `--color-ring`, because `--color-ring` equals the brand fallback fill (`var(--color-brand)`, `src/routes/_app/vacay.tsx`) in both
  themes and would vanish on your own marked days (WCAG 2.4.7, 1.4.11). The ring must reach 3:1 against the brand fallback, the
  seeded traveller colours, `warning-soft` and `surface-inset` in both themes.
- **Focus not obscured (WCAG 2.4.11).** Every cell carries a `scroll-mt-*` that includes the sticky month header at 360px as well as
  the top nav, and a `scroll-mb-*`, and the scroll container gets `scroll-padding-bottom` equal to the measured height of the bottom
  region (`ResizeObserver`) while it is showing, so an arrow-key focus never lands under it. Moving focus never uses smooth scroll.
- **Targets.** The chip stays on today's 28px module; its hit area fills the column and is at least 40px tall under
  `pointer: coarse`, never under 24x24 (WCAG 2.5.8).
- **Numerals.** `inkOn()` tops out near 4.08:1 on a mid-luminance colour, and the colour schema accepts any hex including alpha, so
  4.5:1 for the numerals cannot be guaranteed for an arbitrary stored colour. The measured set is the seeded palette plus the brand
  fallback in both themes; an arbitrary hex is a known exception, listed under Risks.

### The picker (08-S5a)

- `Popover` anchored to the day on a fine pointer, bottom `Sheet` on a narrow or coarse screen (`src/lib/breakpoints.ts`). Its title
  reads `Mark {date}` with the localised long date; the Popover content is a `role="dialog"` named by `aria-labelledby` on that
  visible title, and the Sheet uses `SheetTitle`. Six kind options, the current kind marked (`aria-pressed`), each with a **cost
  line** under the name: "Uses 1 day of your allowance" / "Uses half a day of your allowance" / "Doesn't use your allowance".
  "Clear this day" appears only if the day is marked. Choosing a kind records it and closes the picker at once. No note field in this
  slice (on a phone it would raise the keyboard over the sheet).
- Kind names never say a bare "holiday" (Resolved assumption 19): Leave, Half day of leave, Sick day, Working remotely, Public
  holiday, Other. The month badges and the legend use the same keys, and `humaniseToken(kind)` leaves the screen.
- Focus returns to the day that opened the picker after a choice or `Escape` (the `Popover` anchored rather than triggered needs
  `onCloseAutoFocus` to focus the cell; the cell must still be connected, hence keying by date). The Sheet restores focus to its
  opener only while that node is connected (`src/components/ui/sheet.tsx`).

### The bottom region, success, failure, empty and loading (08-S5a)

- **One bottom region** (`data-part="vacay-bottom-region"`) holds, stacked from the bottom: the transient status strip, the range bar
  (08-S5c) and the failure alert. It is fixed with the same clearance `AppToaster` uses (`calc(var(--safe-bottom) + 5.5rem)` on
  desktop widths, `5.25rem` below the mobile breakpoint), so it never sits under the mobile tab bar or the "Report a problem" button,
  and the grid has matching bottom padding. A polite live region is mounted **empty at first render** inside it and only its content
  changes (a `role="status"` that mounts already holding its text is not reliably announced).
- **Success.** The cell fills at once (optimistic), `router.invalidate()` re-reads the balances, and the status strip shows - visibly,
  for a few seconds, and through the live region - "{kind}: {date}." followed by the allowance spec's `vacay.allowance.daysLeft`
  line with the new figure, because below `xl` the allowance panel is a screen away from August and the traveller has to see what the
  mark cost. A run: "{kind}: {range}, {n} days marked."
- **Failure.** The cell reverts to its previous fill and **one** `Alert tone="danger"` (`role="alert"`) appears in the bottom
  region. It names the date - or, for a run, the range through `formatDateRange` - says nothing was saved for
  them, and offers "Try again" (re-sends exactly the failed writes) only for a transport error or a 5xx; any other failure just
  re-reads the page. Focus stays on the day. The alert clears on the next success. A failed range reverts every day in it. A succeeded write whose carry-over recompute failed is **not** a failure here (Phase 1). The alert is shown after the `router.invalidate()` re-read, not before: when the response was lost but the write committed, the re-read already shows the intended state and the success status is shown instead.
- **Empty.** The "Nothing marked in {year}" card stays; its description names the gesture ("Select any day to mark it as time off.")
  and its action, "Go to {month}", scrolls to and focuses today in the current year or 1 January in any other (not "the first of the
  current month"). It makes no claim about weekends or company holidays showing up on their own: a company holiday appears only if
  the owner records one.
- **Loading.** `VacayPending` renders twelve month cards of `Skeleton` cells at the settled cell size, so the grid does not jump.
- **Motion.** A cell's fill transitions over 150ms on `--ease-out-quint`; the range preview is opacity only; nothing animates a layout
  property; the global reduced-motion block removes the transition.
- **Layout.** At 360px the year is one month per row with a sticky month header; at 2560px it stays on the four-column grid (no
  stretching). The visible keyboard hint shows on `pointer: fine` only (it mentions Shift); it is always available to assistive
  technology through `aria-describedby`.

### A run of days (08-S5c)

- "Select more days" in the picker closes it and outlines that day as the start. The range bar in the bottom region says "From
  {date}. Select the last day." through the live region and offers a visible Cancel (at least 44px). The next tap on any day, either
  side of the start and across months, sets the end and reopens the picker for the whole range: its title is the range through `formatDateRange` with the day count, each kind's cost line shows the real cost of **this** range ("Uses 10 days of your allowance") from `daysToWrite`,
  and, when days are left out, one line says how many ("4 days left out (blocked weekends or company holidays)") so a title of 14 days
  beside a cost of 10 is never unexplained; "Clear {n} marked days" applies to the selection. Selecting the start day again returns to
  the single-day picker. `Escape`, Cancel or a year change leave range mode with nothing written.
- Cells in a selection carry `aria-selected="true"`; each grid is `aria-multiselectable`. The hint tied to the grids with `aria-describedby` names the keyboard path through the new key `vacay.grid.hint.range`, read after `vacay.grid.hint`.
- When the bar or an alert is showing, `scroll-padding-bottom` makes sure it **never covers the focused day**.

### The settings rows (08-S5d, 08-S5f) and the mode control (08-S5f)

- The dialog rows are `CheckboxField`s (the allowance spec's decision: `Switch` is reserved for effects that apply immediately).
- `RadioGroup` in the page header actions, owner only; announced politely on change.

## 📝 Visual change expected

Route `/vacay`, light and dark, desktop (1280), mobile (360) and 2560:

- Resting: every day is a control with a focus ring and hover/active states; marked days carry their kind cue; company holidays carry
  the dashed border; trip hairline (08-S5e); a mode control in the header for the plan's owner (08-S5f); a legend with the new rows;
  localised month and weekday names (08-S5a) in the user's week (08-S5b).
- States: the kind picker open over a day (`--state kind-picker --click '[data-part="vacay-day"][data-date="2026-08-19"]'`); a
  pending range with the bottom bar (`--state range`); company mode (`--state company --click '[data-part="vacay-mode"]
[data-value="company"]'`); the failure alert (reached with `page.route()` failing a write); a blocked weekend's reason in the bottom
  region; the twelve-card skeleton.
- Frames are the blind A/B pair from `scripts/visual/capture.mjs`; nothing is compared to a stored image (ADR 0016).

## 📝 Copy

New keys in `src/lib/i18n/messages/en/modules.ts` (namespace `modules`, prefix `vacay.`), each landing in all 23 locales in the same
change that first uses it (`i18n-messages` skill; the parity and `coverage` tests enforce it). Rules the allowance spec set apply: one
full key per phrase (no `{field}` slots; a label is never dropped into a sentence, because case and word order break in `pl`, `ru`
and `de`), every key that puts a number before a noun is a plural key (`count` selects the branch, `value` is the number already
formatted with `formatNumber(locale)`), the six kind names come from a literal table typed `Record<Kind, MessageKey>` and never a
template key. Dates go through `formatDate` / `formatMonthYear` / `formatDateRange`, month and weekday names through `monthName` /
`weekdayName`. A `copy-rules.test.ts` modelled on `src/components/atlas/__tests__/copy-rules.test.ts` covers the new components (no
literal JSX text or props, logical properties). The success line reuses the allowance spec's `vacay.allowance.daysLeft`. A kind name may only open a key as a label followed by a colon (`{kind}: {date}.`), never sit inside a sentence.

| Key                                                  | `en` text                                                                                                                                       | Ticket |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| `vacay.kind.vacation` / `.half_day` / `.sick`        | `Leave` / `Half day of leave` / `Sick day`                                                                                                      | a      |
| `vacay.kind.remote` / `.holiday` / `.other`          | `Working remotely` / `Public holiday` / `Other`                                                                                                 | a      |
| `vacay.kind.cost.full` / `.half` / `.none`           | `Uses 1 day of your allowance` / `Uses half a day of your allowance` / `Doesn't use your allowance`                                             | a      |
| `vacay.picker.title`                                 | `Mark {date}`                                                                                                                                   | a      |
| `vacay.picker.clear`                                 | `Clear this day`                                                                                                                                | a      |
| `vacay.picker.more`                                  | `Select more days`                                                                                                                              | c      |
| `vacay.day.name`                                     | `{date}. {details}`                                                                                                                             | a      |
| `vacay.day.part.companyHoliday`                      | `Company holiday`                                                                                                                               | a      |
| `vacay.day.part.trip`                                | `Trip: {title}`                                                                                                                                 | e      |
| `vacay.day.part.others`                              | plural on `count`: `{value} other traveller away` / `{value} other travellers away`                                                             | a      |
| `vacay.grid.hint`                                    | `Select a day to mark it.`                                                                                                                      | a      |
| `vacay.grid.hint.range`                              | `To mark several, hold Shift and use the arrow keys, or choose Select more days.`                                                               | c      |
| `vacay.status.marked`                                | `{kind}: {date}.`                                                                                                                               | a      |
| `vacay.status.cleared`                               | `Cleared {date}.`                                                                                                                               | a      |
| `vacay.error.write`                                  | `{date} was not saved. Nothing changed for that day.`                                                                                           | a      |
| `vacay.error.writeRange`                             | `{range} was not saved. Nothing changed for those days.`                                                                                        | c      |
| `vacay.error.retry` / `.dismiss`                     | `Try again` / `Dismiss`                                                                                                                         | a      |
| `vacay.blocked.weekend`                              | `Weekends are blocked in this leave plan.`                                                                                                      | a      |
| `vacay.blocked.weekendChange`                        | `Weekends are blocked in this leave plan. To mark them, turn off Block weekends in Leave plan settings.`                                        | d      |
| `vacay.blocked.companyHoliday`                       | `This day is a company holiday, so it can't be marked as time off.`                                                                             | a      |
| `vacay.empty.title`                                  | `Nothing marked in {year}`                                                                                                                      | a      |
| `vacay.empty.description`                            | `Select any day to mark it as time off.`                                                                                                        | a      |
| `vacay.empty.action`                                 | `Go to {month}`                                                                                                                                 | a      |
| `vacay.legend.title`                                 | `Legend`                                                                                                                                        | a      |
| `vacay.legend.mine` / `.companyHoliday` / `.weekend` | `Your time off` / `Company holiday` / `Weekend`                                                                                                 | a      |
| `vacay.legend.others` / `.trip`                      | `Someone else away` / `Your trip`                                                                                                               | a / e  |
| `vacay.page.eyebrow` / `.description`                | `Time off` / `Plan the days you are away and see them against everyone else's`                                                                  | b      |
| `vacay.travellers.title` / `.you`                    | `Travellers` / `{name} (you)`                                                                                                                   | b      |
| `vacay.range.bar`                                    | `From {date}. Select the last day.`                                                                                                             | c      |
| `vacay.range.cancel`                                 | `Cancel`                                                                                                                                        | c      |
| `vacay.legend.selected`                              | `Selected days`                                                                                                                                 | c      |
| `vacay.range.count`                                  | plural on `count`: `{value} day` / `{value} days`                                                                                               | c      |
| `vacay.range.skipped`                                | plural on `count`: `{value} day left out (blocked weekend or company holiday)` / `{value} days left out (blocked weekends or company holidays)` | c      |
| `vacay.kind.cost.days`                               | plural on `count`: `Uses {value} day of your allowance` / `Uses {value} days of your allowance`                                                 | c      |
| `vacay.picker.clear.range`                           | plural on `count`: `Clear {value} marked day` / `Clear {value} marked days`                                                                     | c      |
| `vacay.status.markedRange`                           | plural on `count`: `{kind}: {range}, {value} day marked.` / `{kind}: {range}, {value} days marked.`                                             | c      |
| `vacay.status.clearedRange`                          | plural on `count`: `Cleared {value} day, {range}.` / `Cleared {value} days, {range}.`                                                           | c      |
| `vacay.settings.blockWeekends` / `.hint`             | `Block weekends` / `Saturdays and Sundays cannot be marked as time off.`                                                                        | d      |
| `vacay.mode.label`                                   | `Mark days as`                                                                                                                                  | f      |
| `vacay.mode.mine` / `.company`                       | `My time off` / `Company holiday`                                                                                                               | f      |
| `vacay.grid.name.mine` / `.company`                  | `{month}, marking your time off` / `{month}, marking company holidays`                                                                          | f      |
| `vacay.status.mode.mine` / `.company`                | `Marking your time off` / `Marking company holidays`                                                                                            | f      |
| `vacay.company.mark`                                 | `Mark as company holiday`                                                                                                                       | f      |
| `vacay.company.clear`                                | plural on `count`: `Clear {value} company holiday` / `Clear {value} company holidays`                                                           | f      |
| `vacay.company.hint`                                 | `A company holiday applies to everyone on this leave plan and uses no one's allowance.`                                                         | f      |
| `vacay.status.company.marked` / `.cleared`           | `Company holiday on {date}.` / `Company holiday cleared on {date}.`                                                                             | f      |
| `vacay.status.company.markedRange`                   | plural on `count`: `Marked {value} company holiday, {range}.` / `Marked {value} company holidays, {range}.`                                     | f      |
| `vacay.status.company.clearedRange`                  | plural on `count`: `Cleared {value} company holiday, {range}.` / `Cleared {value} company holidays, {range}.`                                   | f      |
| `vacay.settings.companyHolidays` / `.hint`           | `Company holidays` / `Show company holidays and skip them when marking time off. Turning this off hides them; it does not delete them.`         | f      |

## 📝 Edge Cases & Failure Scenarios

| Case                                                                           | Behaviour                                                                                                                                                   |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Choose the same kind twice, or two tabs write the same day                     | Idempotent: one upsert on the unique `(plan, user, date)` index; last write wins, no duplicate row, no unique-index error.                                  |
| Tap a day whose write is in flight                                             | Ignored by a guard in the handler; the cell is `aria-busy`, focus stays; the busy state is the answer.                                                      |
| Mark 3 August, then 4 August before the first re-read returns                  | Each cell keeps its own optimistic fill until its own write settles; nothing flickers.                                                                      |
| A range write fails                                                            | Nothing is written (one batch); every day in it reverts; one alert names the range ("{from} to {to}"); the page re-reads.                                   |
| The write succeeds and the recompute fails                                     | The write reports success; the failure is logged; the carry is stale until the next write on that chain; the day shows as marked. No "not saved" message.   |
| The write commits but the response is lost (dropped connection)                | The re-read decides: if it shows the intended state the success status is shown, otherwise the alert.                                                       |
| A range of 366 days; a 367-day or inverted range                               | 366 writes in at most 37 statements in one batch; the others are refused by the repository schema and write nothing.                                        |
| Range crosses a month or a year edge                                           | The model is contiguous across months; the UI keeps a selection inside the year on screen.                                                                  |
| A 20-day range over existing and new days                                      | One upsert batch: existing days keep their note, an omitted kind keeps theirs.                                                                              |
| A run whose end is a blocked weekend                                           | Allowed; the blocked days are left out of the write and counted in the "left out" line; the cost shown is the cost charged.                                 |
| Tap an empty blocked weekend or company-holiday day                            | Nothing is written; the reason shows as visible text in the bottom region and is tied to the cell.                                                          |
| `Escape`, Cancel, a year change with a pending range                           | Range mode ends, nothing written.                                                                                                                           |
| A day with an entry and a company holiday                                      | Both marks drawn and named; the entry stays charged.                                                                                                        |
| Weekend with an existing entry, weekends blocked                               | Visible; the cell is not `aria-disabled`; the picker offers only "Clear this day".                                                                          |
| A non-owner opens the screen                                                   | No mode control; a company-holiday call is refused with `PlanOwnerOnlyError` (and the page re-reads).                                                       |
| A request carries `userId`                                                     | Refused by the strict schema.                                                                                                                               |
| Clearing a range in which a colleague has entries on the same dates            | Only the caller's rows go.                                                                                                                                  |
| Cross-workspace plan id                                                        | `NotFoundError`, nothing written.                                                                                                                           |
| A trip with a null date, an archived trip, an organization-visible trip not on | Not drawn.                                                                                                                                                  |
| A private trip of a colleague                                                  | Not drawn, title not sent.                                                                                                                                  |
| `weekStartsOn` stored out of range                                             | Narrowed to `1` at the boundary.                                                                                                                            |
| Sunday-first workspace, the weekend                                            | Saturday is column seven, Sunday column one; the inset follows the weekday.                                                                                 |
| Hydration                                                                      | `today` and every name come from the loader and the frozen tables; nothing reads `new Date()` or `Intl` at render.                                          |
| Browser back with the bottom sheet open (mobile)                               | May leave `/vacay` and drop a half-built range; nothing was written. Accepted, noted. A year change cancels a pending range silently (nothing was written). |
| Signed-out or removed member                                                   | The write is refused by the guard; nothing is written.                                                                                                      |

## ✅ Acceptance criteria

Each criterion belongs to one ticket.

**08-S5a (log and clear one day)**

1. Every day on `/vacay` is a `<button>` in a `role="grid"` month; one tab stop for the year (today in the current year, 1 January
   otherwise); arrows, `PageUp`/`PageDown`, `Home`/`End` move focus across month edges and stop at 1 January and 31 December; a
   `document.activeElement` assertion covers each.
2. Activating a day opens the picker (Popover on a fine pointer, Sheet at 360px) named by its visible `Mark {date}` title; choosing a
   kind records it, closes the picker, returns focus to the same day, shows and announces the status line with the new "days left"
   figure from the database; "Clear this day" removes it. Choosing the same kind twice writes one row; `setEntry` is the single-day case of the upsert helper and does not read before it writes. A second activation of an in-flight cell sends no second write and leaves the cell `aria-busy`; marking 3 and then 4 August before the first re-read returns keeps both fills with no flicker.
3. Each of the six kinds is distinguishable without colour; a company holiday has the dashed border and the legend lists every cue;
   the accessible name of a day carries date, kind, company holiday and other travellers; there is no `title` attribute. The focus
   ring is drawn in the cell's own ink and reaches 3:1 against the brand fallback, the seeded traveller colours, `warning-soft` and
   `surface-inset` in both themes.
4. A failed write reverts the cell, shows one alert naming the date in the bottom region at 360 and 1280, keeps focus on the day, and
   offers a retry only for transport / 5xx failures; the page re-reads. At 360px with the page scrolled to December, "Try again" is
   tappable and not under the tab bar or the "Report a problem" button. A write whose recompute fails reports success. When the response is lost but the write committed, the alert is shown only after the re-read and only if the re-read does not already show the intended state; if it does, the success status shows instead. At 360px, moving focus with the arrow keys down into December and back up under the sticky month header while the status strip or the alert shows, the focused day is never hidden by the bottom region, the sticky header or the top nav (WCAG 2.4.11).
5. `setVacayEntryFn` / `clearVacayEntriesFn` reject a request carrying `userId`; `setEntry` and `clearEntries` call
   `requirePlanActor` and `recomputeCarryOver`; a non-member, a pending and a declined member get `NotFoundError`; clearing leaves a
   colleague's rows on the same dates untouched; the allowlist test is edited for exactly `setEntry` and `clearEntries`. In
   repository tests, an accepted non-owner passing someone else's `userId` to `setEntry` gets `PlanOwnerOnlyError` and nothing is
   written; the owner targeting a `userId` with no accepted plan-member row, or with no current workspace membership, gets
   `NotFoundError` and nothing is written.
6. Tenant isolation: in A's scope against B's plan, `setEntry` and `clearEntries` reject with `NotFoundError` and B's `vacay_entries`
   count is unchanged; `listVacayEntries(scopeB, aPlanId)` is `[]` and `vacayEntriesRepository.requireById(scopeB, aEntryId)`
   throws (both asserted: a `findMany` and a `requireById` fail differently). Every row the upsert writes carries the scope's
   `organization_id`.
7. `ENTRY_KIND_COST` lives in `src/lib/vacay/entry-kinds.ts`, `vacay.ts` imports it, and a test asserts the cost-line set and the
   table agree. The empty state names the gesture (and claims nothing about weekends or holidays) and its action focuses today
   (current year) or 1 January. A unit test builds a full-size upsert chunk and asserts `toSQL().params.length` is at most
   `MAX_BOUND_PARAMETERS`.
8. The stored `blockWeekends` and `companyHolidaysEnabled` are honoured from this ticket: an empty weekend (or company-holiday) cell
   is `aria-disabled`, activating it shows its reason as visible text in the bottom region, tied to the cell and written into the polite live region so it is announced ("Weekends are blocked in this leave plan."; 08-S5d adds the pointer to the switch); this applies in "My time off" mode only; a single-day write on it is refused by the repository; a weekend cell that already holds an entry is not `aria-disabled` and offers only "Clear this day".
9. Month and weekday names come from `format.ts` in the reader's locale; no `Intl` at render; no horizontal overflow of the headings
   at the four-column layout in `ar`, `pl`, `vi` and `zh`; the extracted `month-grid.tsx` and the legend carry no English literal.
10. All 08-S5a copy exists in 23 locales; `CONTEXT.md` carries **Leave day** and **Company holiday**; the twelve-card skeleton matches the settled height; no
    console message on `/vacay`; zero layout shift after settle on `chromium`; both themes at 360, 1280, 2560.

**08-S5b (week)**

11. A traveller with no override reads the workspace week start; an override of `0` beats a workspace `1`; clearing the override
    returns the workspace value. At `weekStartsOn` of `0`, `1` and `6` the headings start on the named day, the first of the month
    lands in the right column, `Home`/`End` reach that week's own ends, and the weekend inset is on Saturday and Sunday.
    `profile.weekStart.hint` is now true.
12. The page header and the travellers panel carry no English literal; `loadVacay` and `library.ts` are untouched.

**08-S5c (a run of days)**

13. A selection resolves to the same inclusive list backwards, forwards, across a month edge, by Shift+arrows, by mouse drag and by
    the two-tap path (one shared test); the model, the repository schema and the server-function validator share
    `MAX_ENTRY_RANGE_DAYS`, and a test asserts they agree.
14. `setEntryRange` writes more than twelve new days, a mix of existing and new days, and 366 days in one batch with no partial
    state, and skips (never charges) the days `daysToWrite` leaves out; an inverted range and a 367-day range are refused and write
    nothing; an omitted kind keeps existing kinds; the carry-over recompute runs after it. A test counts the statements of a 366-day
    write and fails above 37 for the upsert batch or above 7 other statements plus the recompute's updates. In tenant-isolation tests, in A's scope `setEntryRange` against B's
    plan rejects with `NotFoundError` and B's `vacay_entries` rows are unchanged. Every row a 366-day `setEntryRange` writes, across every chunk, carries the scope's `organization_id`. A workspace member who is not on the plan, a pending member and a declined member calling `setEntryRange` get `NotFoundError` and nothing is written. In repository tests, an accepted non-owner passing
    someone else's `userId` gets `PlanOwnerOnlyError`, and the owner targeting a `userId` that is not an accepted plan member or not a
    current workspace member gets `NotFoundError`, with nothing written in either case. `setVacayEntryRangeFn`'s strict input carries
    no weekend or holiday field.
15. On a 360px viewport a traveller logs a run of days with taps only, sees the real allowance cost of the range - and how many days
    are left out - before choosing, and clears a selection with one choice that names the count; either end may be a blocked weekend;
    `Escape` / Cancel / a year change write nothing; the page still scrolls during selection (`touch-action` is the default); "Cancel"
    is tappable at 360px with the page scrolled to December and is not under the tab bar or the "Report a problem" button.
16. Cells in a selection are `aria-selected` and carry the solid inset border; the bar is announced through the live region mounted
    at first render and **never covers the focused day** (`scroll-padding-bottom`); a failed run names its range through `formatDateRange`, as do the run's title and status lines; the legend lists the selected-cell cue (`vacay.legend.selected`); a run whose response is lost but which committed shows success, not the alert.

**08-S5d (weekend blocking switch)**

17. The owner turns "Block weekends" off and on in the dialog and the grid follows without a reload of the page's other state, and the weekend reason gains its pointer to the switch (`vacay.blocked.weekendChange`): off,
    weekend cells become writable and a run no longer leaves them out; on, they are inert again; existing weekend entries stay
    visible and clearable either way. `updateVacayPlanFn` accepts `blockWeekends` and nothing else new.

**08-S5e (trips)**

18. `listTripDateRanges(scopeA)` returns none of B's trips; inside one workspace a colleague's private trip and an
    organization-visible trip the viewer is not on are not returned; only the four fields are sent; the marker and the "Trip: {title}"
    name are distinct from the other-traveller underline.

**08-S5f (company holidays)**

19. The plan's owner switches to company mode and records and clears company holidays with every gesture of the earlier tickets; a
    plan member does not see the control and a forged call gets `PlanOwnerOnlyError`; in A's scope against B's plan every company
    holiday writer rejects with `NotFoundError` and B's rows are unchanged; the range write is one batch. `removeCompanyHoliday` by
    row id: a row id from B's workspace, called in A's scope, gets `NotFoundError`; a workspace member who is not on the plan gets
    `NotFoundError`; an accepted non-owner gets `PlanOwnerOnlyError`; the row survives every one of these calls.
20. Copy and `CONTEXT.md` (**Company holiday**) say "everyone on this leave plan", never "the whole workspace"; the ticket text says
    that until the shared-plan stage lands a plan has one person. The mode change is announced through the live region and carried in each grid's name; mode copy uses two full keys, not a label in a sentence. The blocked rule applies in "My time off" mode only: in company mode a company-holiday cell is operable (it is the cell the owner clears), and recording or clearing company holidays shows and announces the `vacay.status.company.*` lines.
21. "Company holidays" off hides the dashed border/tint and the mode control and keeps the rows; on, a personal run leaves those dates
    out. `holidaysEnabled` has no control; `addHolidayCalendar` / `removeHolidayCalendar` have no production caller; reference row
    `ADD-02` is closed by this ticket's PR; `holidaysEnabled` and the subscription controls stay with the open half of `ADD-03`.

## 📝 Risks & Impact Review

- **New write paths acting on client-sent ids (`planId`, dates).** The security and tenancy verdict is risk-medium, no `security`
  label: the workspace filter is untouched, no migration, no quota, no money. `SDLC.md` (§ Risk here) makes a PR `risk-high` when
  its diff touches `src/server/auth`, `src/server/repos/base.ts`, `src/server/billing`, `src/server/db/schema.ts`, `drizzle/` or
  `src/server/public`; a ticket here that does becomes risk-high. Because a risk-medium PR merges without a security reviewer looking
  at its diff, the isolation, actor and `userId` tests are written into the acceptance criteria above. Mitigation: guards in the
  repository, strict inputs with no `userId`, the allowlist edited per ticket.
- **More D1 calls per click** (guards, upsert, recompute). Bounded by a design constraint and a test (Phase 3); no more stored rows.
- **A fixed Saturday-Sunday weekend** blocks Sunday for readers of locales where it is a working day (`ar`); the traveller's remedy is
  the 08-S5d switch (Resolved assumption 24). A per-locale weekend is out of scope.
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
  colour against the markers and the focus ring in both themes (needs resolved tokens; the `currentColor` rule removes most of the
  risk); numeral contrast for an **arbitrary stored hex** colour, which `inkOn()` cannot guarantee at 4.5:1 (the measured set is the
  seeded palette and the brand fallback); screen-reader announcements of twelve named grids on real devices; whether `scroll-padding`
  interacts correctly with the sticky month header at 360px; text widths of the kind labels at 360px in `de`, `pl`, `ru`; and the
  time between paint and hydration on a slow connection (a button does nothing until hydrated). The implementer measures or states
  each.

### Out of scope

- Public holidays from an external source, the holiday-calendar subscription controls, the `holidaysEnabled` switch: deferred behind
  the day-source decision. The plan records that blocker in its own stage block only (it points at
  `docs/plans/11-boundaries-and-blockers.md`, which does not mention it), and follow-up issue #1107, named in this spec's PR body, owns the open half of
  `ADD-03`. Choosing a feed is a licence, cost and outbound-subrequest decision, so that issue is a person's. Nothing
  built here becomes wrong if a feed arrives (the rows it would fill are the rows this stage writes).
- Logging for another traveller, inviting plan members, the read-only settings view for a member (the shared-plan stage).
- Editing a company holiday's label; a note on a day; undo of a clear (the count in the choice is the warning).
- Cross-year ranges from the UI; a per-locale weekend definition.

### Reference-row disposition

`ADD-03` stays `partial`: the plan closes it "done", but the row expects public holidays from an external source and that half is
deferred to the follow-up issue together with the subscription controls and `holidaysEnabled`; every other path it names ships.
`ADD-02` (allowance, carry-over, settings) closes with 08-S5f, the last ticket that adds a settings row, as the allowance spec hands
over.

## 📋 Phasing

| Phase | Ticket | Slice a person can see work                                                      | Blocked by                                                                                                  |
| ----- | ------ | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 1     | 08-S5a | Log and clear one of your own days, with its kind and its cost, in your language | allowance tickets 08-S1a (guards, `-server/vacay.ts`, `components/vacay`) and 08-S1b (carry-over recompute) |
| 2     | 08-S5b | The year reads in the week you start on                                          | 08-S5a                                                                                                      |
| 3     | 08-S5c | Log and clear a run of days, on a phone too                                      | 08-S5a                                                                                                      |
| 4     | 08-S5d | The owner switches weekend blocking and the grid follows                         | 08-S5c and allowance ticket 08-S1c (the settings dialog)                                                    |
| 5     | 08-S5e | A trip you are on shows through the days it occupies                             | 08-S5b                                                                                                      |
| 6     | 08-S5f | The plan's owner records company holidays and switches them on or off            | 08-S5c, 08-S5d and 08-S1a (for `requirePlanOwner`)                                                          |

The tickets edit the same few files (`month-grid.tsx`, `day-cell.tsx`, `vacay.tsx`, `modules.ts`), so they run serially in the order
above. If 08-S5a does not fit one context window, it is cut **by behaviour**, each part still going from repository to screen:
part one logs one day with its kind (guarded `setEntry`, `setVacayEntryFn`, the button grid, the picker, the status line) **including the revert-on-failure alert and the blocked-day cells (criteria 4 and 8)**, so part one never shows a day as saved that was not; part two clears a day (`clearEntries`, `clearVacayEntriesFn`) and adds the empty and loading states. Never by layer.

## 📋 Implementation Plan

### Phase 1 - log and clear one day (08-S5a)

1. `entry-kinds.ts`, `day-rules.ts` and their tests; move `ENTRY_KIND_COST`; replace `calendarRange` with
   `inclusiveDays`/`shiftDate`.
2. The upsert helper, `setEntry` as its single-day case, `clearEntries`, the cap in the schema, the recompute call (a failure is
   logged, not thrown); tests first: the actor rules, the explicit-`userId` paths, tenant isolation, the colleague-rows case, the
   chunk-parameter assertion, the allowlist edit.
3. `loadVacayGridFn`, `setVacayEntryFn`, `clearVacayEntriesFn`, `__tests__/vacay.test.ts` on the pattern of
   `src/server/fns/__tests__/atlas.test.ts` (plain exported functions for anything that returns a result).
4. `DayCell`, `MonthGrid` (extracted from `vacay.tsx`, names from `format.ts`), `DayPicker`, `BottomRegion` (status strip, alert),
   `VacayPending`, the keys in 23 locales, `CONTEXT.md`.
5. `e2e/product-modules.spec.ts`: `test.describe('08-S5a ...')`.

### Phase 2 - week (08-S5b)

1. `week.ts` and its table test; `weekStartsOn` in `loadVacayGridFn` with the three override cases.
2. Rotate the grid; localise the header and travellers panel.

### Phase 3 - a run of days (08-S5c)

1. `range-select.ts` and its test; the cap agreement test.
2. `setEntryRange` rewritten over the helper, tests for >12 new days, a mix, omitted kind, skipped days, atomicity, the statement
   count, cap, cross-workspace, the explicit-`userId` paths; `setVacayEntryRangeFn`.
3. `RangeBar`, Shift+arrows, mouse drag, the range picker, the live-region messages, keys.
4. The dev seeder counts the returned `written`; the existing `repositories.test.ts` `setEntryRange` cases that cross a weekend or a company holiday are updated for the skip.

### Phase 4 - weekend blocking switch (08-S5d)

1. Widen the `pick`; the dialog row; keys; tests for both states and the existing-entry cases.

### Phase 5 - trips (08-S5e)

1. `listTripDateRanges` and the tenant-isolation and visibility cases first; `tripWindows` in `loadVacayGridFn`.
2. The marker, the name part, the legend row, keys.

### Phase 6 - company holidays (08-S5f)

1. Guard `addCompanyHoliday` / `removeCompanyHoliday` in place; `setCompanyHolidayRange`, `clearCompanyHolidays`; tests and the
   allowlist edit.
2. The two server functions, `ModeControl`, the company picker, the grid name, the settings row and its `pick`, keys,
   `CONTEXT.md`.

## Verification

- The gate in `validation.commands` (`.ai/agentic.config.json`) on every phase's last commit.
- Unit: `src/lib/vacay/__tests__/{entry-kinds,day-rules,week,range-select}.test.ts` (the `ui` project: no server imports);
  `src/routes/_app/-server/__tests__/vacay.test.ts`; `src/components/vacay/__tests__/` - `month-grid` (one tab stop; arrows,
  `PageUp`/`PageDown`, `Home`/`End`; no wrap at the year edges; RTL; `aria-disabled` keeps the stop), `day-cell` (names, cues),
  `day-picker` (focus returns, one write for a double activation), `bottom-region`, `range-bar`, `mode-control` (absent for a
  member), `copy-rules.test.ts`.
- Repository: the cases of Phases 1, 3, 5 and 6 in `repositories.test.ts` and `tenant-isolation.test.ts` (one `describe` per phase);
  the allowance spec's structural allowlist test, edited per ticket.
- Browser, per `docs/plans/12-verification-protocol.md` (ADR 0016: no baselines, no pixel comparison): `e2e/product-modules.spec.ts`
  asserts `/vacay?year=2026` (`PINNED_YEAR`) answers, hydrates, says nothing in the console (`watchConsole`) and can be acted on:
  keyboard-only logging of a day and a run, the 360px two-tap run with Cancel and "Try again" tappable with the page scrolled to
  December, no horizontal overflow of headings in `ar`, `pl`, `vi`, `zh`, zero layout shift after settle on `chromium` (a skip on
  `mobile-safari`). The describes that write are `test.describe.configure({ mode: 'serial' })`, run in `chromium` only, restore what
  they change, and are named among the fixture writers in `playwright.config.ts`'s `workers` comment. Run
  `PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup`, then `... pnpm exec playwright test
e2e/product-modules.spec.ts`, with the port from `bash .ai/scripts/e2e.sh`.
- Frames, the blind A/B pair a person reads at review: `PT_SERVER_TODAY=2026-08-20 node scripts/visual/capture.mjs --url
"http://localhost:$PORT/vacay?year=2026" --out "<scratchpad>/shots/08-S5" --label B --viewports 360x800,1280x900,2560x1440 --themes
light,dark --auth`, with the states named under Visual change expected. Each selector is verified to resolve by the spec run passing.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                          | Applied default                                                                                                                                                                                                                                              | Why                                                                                                                                                                                                                                                         |
| --- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Ship the holiday-calendar subscription controls the plan describes?               | No. No calendar control, server function or list; the repository functions stay unreachable; `ADD-03` stays `partial`; a follow-up issue owns the open half                                                                                                  | Decided by product owner sub-agent (confidence high): a calendar paints nothing (no day rows, nothing reads `calendars`), a placeholder under `docs/SPEC.md` §7.5, the allowance spec's own argument.                                                       |
| 2   | The display switches the allowance spec handed over                               | Ship `blockWeekends` (08-S5d) and `companyHolidaysEnabled` (08-S5f), each with the concept it governs; withhold `holidaysEnabled` (moves with the open half of `ADD-03`)                                                                                     | Decided by product owner sub-agent (confidence medium): the first two have a visible effect once cells are controls; the third has nothing to show without a day source; each switch lands with its concept (§8).                                           |
| 3   | Ticket cut                                                                        | Six serial tickets, each repository to screen (day, week, run, weekend switch, trips, company holidays); no holiday-manager dialog; 08-S5a falls back to a cut by behaviour (log a day, then clear it and the states), never by layer                        | Decided by product owner sub-agent (confidence medium) with the architect's `Blocked by` edges.                                                                                                                                                             |
| 4   | Clearing a run                                                                    | One "Clear {n} marked days" in the picker, applies to the selection, names the count, no confirmation dialog                                                                                                                                                 | Decided by product owner sub-agent (confidence high), security and tenancy condition met by the count in the choice: a run you can log but only clear day by day is half a promise.                                                                         |
| 5   | `userId` on the new server functions                                              | Omitted; a request carrying one is refused; logging for a colleague is the shared-plan stage's                                                                                                                                                               | Decided by security and tenancy sub-agent (confidence high): no code can create a second person on a plan; it would add the hardest rule to the first slice.                                                                                                |
| 6   | Guard shape for removals and company holidays                                     | `clearEntries(planId, from, to)` deletes only the caller's rows; `removeEntry` stays unreachable; company-holiday writers guarded in place with `requirePlanOwner`                                                                                           | Decided by security and tenancy sub-agent (confidence high): no row-id path to another person's day; no unguarded twin left to import by mistake (allowance spec rows 20 and 21).                                                                           |
| 7   | Which trips are drawn                                                             | The viewer's member trips (`memberTripIds`), not archived, both dates, overlapping the year; the client gets `{ tripId, title, startDate, endDate }`                                                                                                         | Decided by security and tenancy sub-agent (confidence high), verified against ADR 0007 and `trips.ts`: the plan's tenant-only read leaks private trips.                                                                                                     |
| 8   | Where the pure logic lives                                                        | `src/lib/vacay/` (`entry-kinds`, `day-rules`, `week`, `range-select`), reusing `trip-dates.ts`; components stay thin                                                                                                                                         | Decided by software architect sub-agent (confidence high): the cap and the weekend rule are shared by server and client; the allowance spec already put `carry-over.ts` there.                                                                              |
| 9   | Atomic range write                                                                | One upsert helper, chunk size derived from the conflict clause's bound parameters (11 rows if one, 10 if two), all statements in one `runBatch`, then the recompute; `setEntry` is its single-day case; returns a count; cap 366 enforced once in the schema | Decided by software architect sub-agent (confidence high): removes the update-then-insert gap and the race on a new day; a queue is wrong for 366 rows (`batch.ts`). Panel condition: 9 columns + the `setWhere` parameter is 100, a bound `SET` value 101. |
| 10  | Where the grid's extra read lives and its order                                   | A new GET `loadVacayGridFn({ year })` in `-server/vacay.ts`, parallel with `loadVacay`, before the allowance call                                                                                                                                            | Decided by software architect sub-agent (confidence medium): `library.ts` is another stage's; no plan id, so no `ensurePlan` race; `loadShell` already runs the settings insert.                                                                            |
| 11  | Dependency on the unimplemented allowance spec                                    | A hard prerequisite expressed as `Blocked by` per ticket; guards are not rewritten here; a company holiday on a date with the owner's own entry leaves the entry in place, still charged, both marks visible                                                 | Decided by software architect sub-agent (confidence high) and product owner sub-agent: a second owner of the guards would violate §8 and the allowance spec's criterion 5.                                                                                  |
| 12  | Weekend definition                                                                | Saturday and Sunday by actual weekday, fixed; the inset moves with the week rotation                                                                                                                                                                         | Applied default (product owner condition): there is no weekend setting and no per-locale definition; the grid draws it this way today.                                                                                                                      |
| 13  | A run charges weekends and company holidays                                       | One `daysToWrite` in `day-rules.ts` decides the days and their cost; the repository reads the plan's stored flags and company-holiday dates itself and the picker shows the same numbers; the server-function inputs carry no such fields                    | Decided by UX, product owner and architect sub-agents: a cost shown that differs from the charge is a silent allowance error; one owner of the rule (§8); the client cannot influence the cost.                                                             |
| 14  | Plan paths that no longer exist                                                   | `e2e/product-modules.spec.ts` (no snapshots), `scripts/visual/capture.mjs`; no `holiday-manager.tsx`; `modules.ts` in 23 locales                                                                                                                             | Applied default: ADR 0016 and `docs/plans/12-verification-protocol.md` at HEAD; `docs/SPEC.md` §9.                                                                                                                                                          |
| 15  | Keyboard model                                                                    | `role="grid"` per month with buttons in gridcells, ONE roving tab stop for the year (today, else 1 January), no wrap at the year edges, the `calendar.tsx` key model                                                                                         | Decided by accessibility sub-agent (confidence high): a two-dimensional set; arrows already cross months so twelve remembered days would disagree.                                                                                                          |
| 16  | Mode control                                                                      | A two-option `RadioGroup` ("Mark days as"), owner only, not rendered otherwise                                                                                                                                                                               | Decided by accessibility sub-agent (confidence medium): `PillNav` is navigation, `Tabs` needs a panel, a `Switch` leaves the default mode unnamed.                                                                                                          |
| 17  | Activating a day, and a run on a phone                                            | The tap opens the kind picker; a run is a two-tap "from / to" started from the picker; Shift+arrows and mouse drag are shortcuts; no touch drag, no long-press                                                                                               | Decided by UX and accessibility sub-agents (confidence medium / high): a stray tap must not spend allowance; a drag fights scroll and fails WCAG 2.5.1 and 2.5.7.                                                                                           |
| 18  | Failure and empty states                                                          | One bottom-region danger alert naming the date or range, retry only for transport/5xx, focus stays on the day; the empty action goes to today or 1 January; the description says "select" and claims nothing about weekends or holidays                      | Decided by UX sub-agent (confidence medium): at 360px an alert above January is a screen away, and the bottom region must clear the mobile tab bar like `AppToaster` does. "Select" is neutral across touch and mouse.                                      |
| 19  | Kind names and the cost line                                                      | Leave, Half day of leave, Sick day, Working remotely, Public holiday, Other, each with a cost line; no bare "holiday"; non-colour cue per kind                                                                                                               | Decided by UX and accessibility sub-agents: the shipped `en` is British ("holiday" is leave) while the `holiday` kind costs nothing; the kind is invisible on a phone today.                                                                                |
| 20  | Risk label                                                                        | `risk-medium`, no `security` label; a ticket whose diff reaches a path in `SDLC.md` § Risk here (`auth`, `base.ts`, `billing`, `schema.ts`, `drizzle/`, `public`) becomes `risk-high`; the isolation tests are acceptance criteria                           | Decided by security and tenancy sub-agent (confidence high): `SDLC.md` defines risk-high by path; this stage touches none, and risk-medium merges without a security reviewer on the diff, so the tests must be criteria.                                   |
| 21  | Term for "diary"                                                                  | The copy says "trip"                                                                                                                                                                                                                                         | Applied default (UX sub-agent): "diary" collides with the Journal module.                                                                                                                                                                                   |
| 22  | Name later stages by id in this spec?                                             | No; only the allowance tickets (already specified) and this stage's own tickets carry ids                                                                                                                                                                    | Applied default, verified in `.ai/scripts/backlog-status.mjs` (`coversStage`): another stage's id in a spec's text hides that stage from `--plan`.                                                                                                          |
| 23  | Honour the stored block-weekends and company-holiday flags from which ticket?     | From the first write (08-S5a); the dialog rows ship in 08-S5d and 08-S5f                                                                                                                                                                                     | Decided by product owner and UX sub-agents (panel round 1): otherwise tickets a to c charge a Monday-to-Sunday fortnight 14 days and the last one changes every plan at once. Nothing was writable before, so nothing existing changes.                     |
| 24  | A fixed Saturday-Sunday weekend blocks Sunday for `ar` readers                    | Accepted; the remedy is the "Block weekends" switch (08-S5d); a per-locale weekend is out of scope                                                                                                                                                           | Decided by UX sub-agent (panel round 1): recorded as asked; no weekend setting exists.                                                                                                                                                                      |
| 25  | A recompute that fails after a successful write                                   | The write reports success, the failure is logged and the carry is stale until the next write on that chain                                                                                                                                                   | Decided by UX sub-agent (panel round 1): the screen must never say "not saved" about a day that was saved.                                                                                                                                                  |
| 26  | Where bottom-anchored UI sits and how it answers                                  | One bottom region with `AppToaster`'s clearance, a live region mounted empty at first render, a visible status strip; blocked-day reasons are visible text tied to the cell and written into the live region; in-flight taps are ignored                     | Decided by UX and accessibility sub-agents (panel round 1): a polite region is invisible on a phone, fixed bars must not cover the focused day (WCAG 2.4.11, 4.1.3).                                                                                        |
| 27  | D1 per-invocation query limit                                                     | A design constraint with a number: at most 37 upsert statements, 7 others and the recompute's `k` updates (44 + `k`, inside 50 for `k` at most 6) for a 366-day write, tested; a lower future limit lowers `MAX_ENTRY_RANGE_DAYS`                            | Decided by software architect sub-agent (panel round 1): an open "implementer confirms" gives an unattended run nothing to decide on.                                                                                                                       |
| 28  | Copy that changes meaning between tickets (the weekend reason, the keyboard hint) | A later ticket adds a new key and switches to it; it never edits the text of a key an earlier ticket shipped                                                                                                                                                 | Decided by UX sub-agent (panel round 2): the parity test checks that keys exist, so 22 translated locales would quietly keep the old text under an edited key.                                                                                              |
| 29  | The dev seeder after `setEntryRange` skips blocked days                           | The seeder counts the returned `written` and accepts leaner demo data; it is an owned file of 08-S5c                                                                                                                                                         | Decided by software architect sub-agent (panel round 2): a skip is not a failure, so the guard-only wording would have left the seeder silently overstating its rows.                                                                                       |
| 30  | A write that committed but whose response was lost                                | The failure alert waits for the re-read; if the re-read shows the intended state the success status shows instead                                                                                                                                            | Decided by UX sub-agent (panel round 2): on a bad connection the screen must not say "nothing changed" about a day that is marked.                                                                                                                          |
| 31  | Where chunk arithmetic lives                                                      | `chunkFor` in `batch.ts` stays the one owner and gains an optional reserved-parameter count; the entry upsert and the company-holiday range both use it                                                                                                      | Decided by software architect sub-agent (panel round 2): one owner of chunking (§8).                                                                                                                                                                        |
| 32  | Mode of the blocked rule                                                          | Weekend and company-holiday blocking applies in "My time off" mode only; in company mode a company-holiday cell is operable                                                                                                                                  | Decided by accessibility sub-agent (panel round 2): the owner must be able to clear that same cell; the state has to match what the control does (WCAG 4.1.2).                                                                                              |

Panel verdicts. **Round 1** (product owner, software architect, security and tenancy reviewer, accessibility specialist, UX specialist):
all five answered **approve with conditions**; every condition was applied in the revision before round 2. **Round 2** (the same five,
checking that each round-1 condition was met and that the rewrite introduced no defect): all five answered **approve with
conditions**, none answered **revise**, and the security and tenancy reviewer granted approval for unattended slicing and
implementation (confidence high), calling its two remaining edits mechanical. Every round-2 condition is applied in the final
revision: the weekend reason and the keyboard hint are split into new keys per ticket instead of being edited; the **Company holiday**
glossary entry moves to 08-S5a; the cut-by-behaviour fallback keeps the failure revert and the blocked cells in its first part; the
D1 statement budget is derived (44 + `k`) with its test; `chunkFor` in `batch.ts` stays the one owner of chunking; the dev seeder is
named as an owned file of 08-S5c; the range-write isolation and actor criteria are complete; the focus-not-obscured check, the
selected-cell legend key, the company-mode blocking rule and status lines, the announced blocked reason, `Home`/`End` in 08-S5a and the
unmarked day's name are in; a lost response is decided by the re-read; the run's dates use one form (`formatDateRange`); the status
keys are label-first. Final verdicts: product owner approve with conditions (medium to high confidence), software architect approve
with conditions (medium), security and tenancy approve with conditions, approval granted (high), accessibility approve with
conditions (medium), UX approve with conditions (medium). The panel ran its two rounds; the conditions of round 2 are the last word.
