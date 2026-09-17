# Trips core, what remains: the list read two ways, one trip form, an arrangeable planner, and a reminder you can set

| Field              | Value |
| ------------------ | ----- |
| **Status**         | draft |
| **Issue**          | #104  |
| **Spec PR**        | none  |
| **Implementation** | none  |

PRD #104 · `docs/plans/01-trips-core.md` (frozen) · the **six stages of waves 5 and 6 that have not
shipped**: `01-S7` (#120), `01-S8a` (#121), `01-S8b` (#122), `01-S9a` (#123), `01-S9b` (#124),
`01-S10` (#125).

This spec is written at the PRD's own altitude and is **not** an eleventh stage. It says what is left
of the trips area, what the six remaining stages share, and what "trips core is finished" asserts. The
per-stage detail — owned paths, statement-by-statement server work, frame lists — stays in the frozen
plan and is not copied here. Each phase below is one stage issue, built on its own pull request.

## 📝 TLDR

Seven of the ten trips-core stages have shipped and each has its own spec in this directory: the read
predicate and the lifecycle (`01-S1`), the writable day note (`01-S2`), the remembered tab and the
preference module (`01-S3`), the merged day timeline (`01-S4`), the dashboard's reference column
(`01-S5`), and the people route (`01-S6a`). `01-S6b` — guests — is designed
(`.ai/specs/2026-09-17-a-guest-on-a-trip.md`, #119) and unbuilt.

What is left is the **surface**: six stages that add no schema, one repository function between them,
and no new authorization decision. They are the reason a reader still cannot switch the trip list to
a list, still cannot give a trip a summary, a cover or a reminder from the form that creates it, still
cannot drag a planner rail to a width they can work at, and still cannot see or choose the reminder
that is already being sent on their behalf at a default of three days.

This document fixes the four things those six stages share and would otherwise each decide
separately — the two remaining browser-preference declarations and their areas, the one trip form,
the no-scheduler rule, and the e2e block convention the frozen plan is stale about — and states the
acceptance contract for the area as a whole. **Six phases, six pull requests, six stage issues.** This
spec is never built as one change.

## 📝 Problem Statement

**Who has it.** Every reader of the product. These are not edge surfaces: `/trips`, `/dashboard`, the
dialog that creates a trip, and the planner are the four screens the product is used through.

**The evidence, measured in the tree at `521d329b`:**

- **The list has one mode.** `src/routes/_app/trips/index.tsx:32-35` validates `status`, `q` and
  `scope`. There is no `view`. There is no `src/routes/_app/-lib/view-mode.ts`, no
  `trip-list-row.tsx`, and no archived fold — `scope=archived` is a filter that replaces the list,
  not a section at its foot.
- **A layout toggle would cost a D1 read.** `loaderDeps: ({ search }) => search`
  (`trips/index.tsx:46`) forwards the whole search object, so adding `view` to the schema without
  narrowing `loaderDeps` makes every mode switch re-invoke `loadTrips`. The defect is one line and it
  is in the tree today, waiting for the feature that would trip it.
- **The form asks five questions.** `src/routes/_app/-ui/trip-form.tsx` (210 lines) is already the
  single field set both frames render — its own module comment says so, and reserves the widening:
  "`01-S8` widens this to the full field set over the whole ISO-4217 list, and does it here". It
  holds title, destination, two dates and a currency drawn from a nine-code array at `:33-43`. There
  is no summary, no cover, no duration, no reminder, no initial members.
- **The server boundary is narrower than the column set.** `createTripInputSchema`
  (`-server/trip-lifecycle.ts:165-173`) accepts those same five. `updateTripInputSchema` (`:180-190`)
  adds `summary` and nothing else. `trips.cover_image_key`, `cover_image_url` and `reminder_days` are
  columns with no path from a form to them, and `updateTripInput` in the repository
  (`src/server/repos/trips.ts:140`) has accepted `reminderDays` — capped at 365 — the whole time.
- **The reminder fires at a default nobody can see.** `src/server/catalog/reminders.ts:213` selects
  on `gt(trips.reminderDays, 0)` and `src/server/queue/reminders.ts:305` sends with
  `days: trip.reminderDays`. Every trip with a future start date is being reminded at three days
  because that is the column's default. `grep -rn reminderDays src/routes` returns nothing: the value
  reaches no form, no sheet and no validator at the server-function boundary.
- **The planner has none of its chrome.** `plan-screen.tsx` is **1923 lines** — the frozen plan
  measured 1437, and four stages have landed in it since. `grep -n 'separator\|resize\|splash\|undo'`
  over it and over `src/components/planner/rail.tsx` returns nothing but the `GlassPanel` imports.
  There is no `plan-workspace.tsx`, no `day-detail.tsx`, no `plan-undo.ts`, no `plan-layout.ts`.
- **Two of the five preference declarations are unwritten.** `src/lib/local-preference.ts` (323
  lines) ships with three consumers — `src/lib/trip-tab.ts` (`01-S3`), `src/lib/clock-zones.ts`
  (`01-S5`) and `components/modules/book/bookings-timeline.tsx` (another plan). `planned.trips-view`
  and the planner's two records do not exist.
- **The e2e file the plan names does not exist.** The frozen plan routes every remaining stage's
  frames into `e2e/trips-core.visual.spec.ts`. ADR 0016 retired the visual gate after the plan was
  frozen. What ships is `e2e/trips-core.spec.ts`, with one behaviour-asserting `test.describe` per
  stage — `01-S3`, `01-S1`, `01-S1d`, `01-S2`, `01-S4b`, `01-S5`, `01-S6a`, in that file, today.

**Why it matters, stated as the failure it prevents.** Six stages, six implementers, four shared
decisions. Without this document each of the six meets the same four questions cold: which storage
area does my preference take, do I widen the form or write a second one, may I call the reminder
scheduler, and which e2e file do I append to. A stage that answers the first one wrong hands the
reader the grid back every morning; a stage that answers the third one wrong reintroduces the
schedule-at-write model ADR 0005 exists to prevent, and it would pass review, because the defect is
the _presence_ of a call that looks entirely reasonable.

## 📝 Proposed Solution

**Six phases, each one stage issue, each one pull request.** The phase order is the frozen plan's
order, and it is a dependency order, not a preference: `01-S7` and `01-S8` and `01-S9` all wait on
`01-S6`, and `01-S10` waits on `01-S8`. Nothing in this spec reorders them.

**Four contracts, fixed once here, binding on all six.**

1. **Two preference declarations remain, and their areas are part of the requirement, not a detail.**
   `planned.trips-view` is **`area: 'local'`** — `TRP-01` asks for a mode "persisted client-side", so
   a session lifetime fails the row on its own wording. `planned.planner-layout` (rail widths, day
   detail minimised) is **`local`**, keyed by trip, limit 8. `planned.planner-days` (which days are
   unfolded) is **`session`**, keyed by trip, limit 8 — the only `session` consumer in the product,
   because which days you have open is where you are in this sitting, and a fold restored a week later
   hides the days a collaborator has added since. Each is one exported declaration read by every
   consumer, so a skeleton and a switch can never disagree about the key.

2. **A stored preference is never the sole source of a layout-affecting first paint.** This is
   decision 13 of the PRD and it is where `01-S7` and `01-S9` would each otherwise improvise. The view
   mode is projected into the URL's `view` search parameter — the URL is truth, storage supplies only
   the default for in-app navigation — and `loaderDeps` narrows to `status`, `q`, `scope` in the same
   change, so a mode switch re-renders and never re-reads D1. The rail widths apply behind the
   first-open splash, as overlays above a full-bleed canvas, so a corrected width repaints a floating
   panel and never reflows the document.

3. **One trip form, widened where it already is.** `trip-form.tsx` exists and both frames render it.
   `01-S8a` widens that module; it does not create a second field set and it does not move the one
   that ships. The duration is derived when both dates are set, editable when neither is, and never
   stored — `syncTripDays` is the single writer of the day run and a `day_count` column would be a
   second source of truth for a number `days` already answers.

4. **No write path schedules, cancels or re-registers a reminder.** ADR 0005's scan model is already
   in production: the `*/15` sweep reads due, unarchived trips straight from D1 and computes the
   08:00 UTC anchor from the row it just read. `01-S10` adds a control and a `0..30` validator at the
   server-function boundary, and calls nothing. **A scheduler call added anywhere in these six phases
   is a defect**, and `01-S10` asserts its absence structurally rather than trusting review to notice.

**What this spec deliberately does not do.**

- **It does not restate the frozen plan.** Owned paths, per-stage SQL, component inventories and frame
  tables are in `docs/plans/01-trips-core.md`, stage by stage, and the stage issues carry that text.
  A second copy here would be a second source of truth that drifts on its first edit.
- **It adds no decision the PRD did not already take.** Where this document differs from the frozen
  plan it is because the tree moved after the freeze (the e2e file, the already-extracted form, the
  planner's line count), and each difference is named in Resolved assumptions.
- **It is not the implementation ticket.** #104 is a PRD. The implementation tickets are #120–#125,
  and each is built from this spec's phase plus its own stage text.

## 📝 Architecture

**No schema, no migration, across all six phases.** Every column the six stages write exists:
`trips.title`, `summary`, `destination`, `start_date`, `end_date`, `currency`, `cover_image_key`,
`cover_image_url`, `reminder_days`, `is_archived` (`src/server/db/schema.ts:338-354`, `:547`,
`:635`), `trip_favourites` from `00-S6`, `trip_guests` from the wave-3 schema stage. Waves 5 and 6 sit
after the last schema stage this plan files into, and nothing is filed for them.

**One repository function is added, in one phase.** `countTripPeople(scope, tripIds)` on
`src/server/repos/trip-guests.ts` — a `Map<string, number>` of members plus guests per trip, in two
grouped queries over `(organization_id, trip_id)`, never one query per card. D1 bills rows **read**,
and the trips index is the one screen in this plan that could regress that. It follows
`countTripsByStatus` (`src/server/repos/trips.ts:268-292`), which already does exactly this.

**The module it lands in does not exist yet.** `src/server/repos/trip-guests.ts` is created by
`01-S6b` (#119, spec merged, unbuilt). Phase 1 therefore has a hard dependency on #119 and is not
re-homed to work around it: putting `countTripPeople` in `trips.ts` would put the guest count in the
module that does not own guests, against `docs/SPEC.md` §8.

**No new authorization decision anywhere in the six.** Every read the six phases perform is already
narrowed by `01-S1`'s read predicate — a private trip the caller is not on is not in the payload
(PRD decision 1, ADR 0007). Every write they invoke is an existing server function whose role check
is in the repository (decision 6). Menus hide items the caller's role cannot exercise **as a
courtesy**; the repository stays the control. The undo ring issues inverse calls through the same
validated, tenant-scoped server functions the original edits used, so an undo is authorised exactly
as its edit was and cannot become a way to write something the caller could not have written
directly.

**One module is extracted, and the extraction is part of a stage rather than a refactor smuggled into
it.** `plan-screen.tsx` is the largest module in `src/` and has grown 34% since the plan measured it.
`01-S9a` moves the chrome — rail widths, resize handles, the splash, the narrow-viewport overlays —
into `plan-workspace.tsx`, and leaves the three things the screen's own header says it owns where
they are: the optimistic arrangement, the selection reducer, and the writes.

**Two behaviours this planner already has beyond the reference must not regress**, and they are named
here so no phase trades one away for a described feature: the fold-aware camera padding, which is why
a pin never hides behind glass when a rail opens, and the optimistic-with-rollback drag, which is why
a drop feels instant while the write is in the air. The shipped planner tests passing unchanged is
the gate that proves it.

## 📝 Data Model

**No migration in any phase.** The one table read that is new is the grouped count above. Two dead
columns stay dead and stay documented: `trips.is_favourite` (superseded by `trip_favourites`, PRD
decision 5) and the `'archived'` value in the status `CHECK` (never written since `01-S1`, PRD
decision 2). Dropping either is a table rebuild and is out of scope by the PRD's own wording.

**Zero is the reminder's off switch and needs no column.** `reminder_days = 0` is permitted by the
column's non-negative `CHECK` and already honoured by the sweep's `reminder_days > 0` predicate
(`src/server/catalog/reminders.ts:213`). A `reminder_enabled` boolean would be a second way to say
the same thing and the two would disagree.

**The product bound is narrower than the column's, deliberately.** The column caps at 365 and the
repository validator already does (`src/server/repos/trips.ts:140`). The product sells `0..30`, and
that bound is asserted at the **server-function** boundary — narrowing at the boundary rather than in
the column means the decision can change without a migration.

**A trip with no start date has nothing to anchor to, and that is not an error.** The sweep's
`start_date IS NOT NULL` predicate skips the row; the control renders, states that the reminder starts
working once a departure date exists, and stores the choice either way, so filling the date in later
needs no second visit.

**The three browser records, with their areas:**

| Key                      | Area      | Keyed by | Limit | Holds                                 | Phase |
| ------------------------ | --------- | -------- | ----- | ------------------------------------- | ----- |
| `planned.trips-view`     | `local`   | no       | —     | View mode, archived-fold open state   | 1     |
| `planned.planner-layout` | `local`   | trip id  | 8     | Two rail widths, day-detail minimised | 4     |
| `planned.planner-days`   | `session` | trip id  | 8     | Which days are unfolded               | 4     |

Every one is a versioned payload discarded whole on mismatch, every read and write is
failure-tolerant, and `local` records propagate across tabs on the storage event — all of which
`src/lib/local-preference.ts` already implements and none of which is re-decided per phase.

**The undo ring is not persisted at all.** An undo offered after a reload would reverse an edit the
reader has forgotten making, and possibly one somebody else has since built on.

## 📝 API Contracts

**No new endpoint in any of the six phases.** Three existing payloads widen, one existing validator
widens, and one narrows.

| Change                                                                                                                                                           | Where                                 | Kind                     | Phase |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------ | ----- |
| `loadTrips` returns archived trips as their own array beside the active list, adds the companion count per card, marks each card with the **caller's** favourite | `src/routes/_app/-server/overview.ts` | additive output          | 1     |
| `loadDashboard` adds the companion count and the server-computed elapsed fraction for the hero trip                                                              | `src/routes/_app/-server/overview.ts` | additive output          | 1     |
| `createTripFn` accepts `summary`, `durationDays`, `coverImageKey`, `coverImageUrl`, `reminderDays`, `members`                                                    | `-server/trip-lifecycle.ts`           | additive input           | 2, 3  |
| `updateTripFn` accepts `coverImageKey`, `coverImageUrl`, `reminderDays`                                                                                          | `-server/trip-lifecycle.ts`           | additive input           | 2, 6  |
| `reminderDays` bounded to an integer `0..30` at the boundary                                                                                                     | `-server/trip-lifecycle.ts`           | **narrowing, new field** | 6     |

Every one is additive under `BACKWARD_COMPATIBILITY.md` §2: no field is removed and none changes
type. The `0..30` bound is narrower than the repository's 365 but it is narrowing a field that has
never been accepted at this boundary, so nothing that works today stops working.

**`loadTrips` keeps its `archived` search filter.** The archived **scope** and the archived
**section** are different readings, and a URL that names the scope must keep working after the fold
exists.

**Zod v4 throughout**, matching the modules: `z.strictObject()` with the `error` parameter, blank
string clears an optional field, `undefined` leaves it unchanged (`docs/SPEC.md` §5, §6; ADR 0002).
`tripFilterSchema` on `loadTrips` gains nothing — the view mode never reaches the server.

**`01-S9` adds no server surface at all.** No repository function, no server function, no Zod schema,
no SQL, no authorization decision. The day detail reads from `loadPlanBoard`'s existing payload; the
undo ring calls existing planner server functions with inverse payloads.

## 📝 UI/UX

**No route is added or moved in any of the six phases**, so `pnpm generate-routes` is not run and
`src/routeTree.gen.ts` is not touched. `/trips`, `/dashboard` and `/trips/$tripId/plan` all exist.

**No new primitive is proposed, and none is required.** Every control the six phases need is in
`src/components/ui` or `src/components/planner` today: `Card`, `Progress`, `AvatarStack`, `Badge`,
`Chip`, `Dialog`, `Sheet`, `Field`, `Input`, `Textarea`, `Combobox`, `MultiCombobox`, `DatePicker`,
`DateRangePicker`, `RadioGroup`, `GlassPanel`, `ScrollArea`, `Tooltip`, `Skeleton`, `EmptyState`,
`Alert`, `Separator`. `DateRangePicker` and `MultiCombobox` are two of the primitives `repo-ui.md`
records as built, tested and imported by no screen; Phase 2 is where they get their first consumer,
which is better than adding a fifth unconsumed one.

**The list mode is a different information order, not a narrow grid.** Grid keeps `TripTile` — cover
art, title, countdown badge, place count, action menu — and answers "what am I dreaming about". List
is one dense row per trip with the dates and the status legible in a vertical scan, the companion
avatars as an `AvatarStack`, and the same action menu at the row's end; it answers "where was that
thing". Below `md` the switch is hidden and the layout is always the row, because a two-column grid of
cover art on a 360px screen is a squeezed desktop, which `docs/SPEC.md` §2 rules out by name.

**The archived section is a disclosure at the foot of the list** — a real button with `aria-expanded`
and a `Chip` carrying the count, collapsed by default, its open state the second field of the same
`planned.trips-view` record. An archived section with nothing in it is **not rendered at all** rather
than rendered empty, because a fold that opens onto nothing is a broken promise.

**The day detail is a floating panel, not a dialog.** It must not trap focus or block the map, since
its whole purpose is to be read while the route stays visible. Focus is managed explicitly — opening
moves focus to the panel's heading, closing returns it to the day header that opened it — it
minimises to a slim bar that keeps its title and its close control, it closes on `Escape`, and it
self-closes with a message if its day is removed by a collaborator while it is open.

**Resizing is not a mouse-only affordance.** Each rail's inner edge carries a handle with
`role="separator"`, `aria-orientation="vertical"`, `aria-valuenow`, `aria-valuemin`, `aria-valuemax`
and an accessible name, which drags with a pointer and moves with arrow keys, `Home` and `End` in
16px steps. Resizing is **not** animated: a handle that lags the pointer feels broken, and a width
change is a layout property, which `DESIGN.md` forbids animating anyway.

**The undo control names what it will reverse** — "Undo moving Café Sacher to day 3" — in both its
accessible name and its tooltip, because an unlabelled undo is a dare. It is present only when the
ring is non-empty; its empty state is its absence, and that is a decision rather than an oversight.

**The reminder control is a `RadioGroup`**, not a row of buttons: one tab stop with arrow-key
movement is what a radio group is for and what a button row would lose. Presets none / 1 / 3 / 9, plus
a custom option revealing a numeric input bounded 1–30, and beneath it one line naming the **actual
date** the reminder would be sent, computed by the same anchor function the sweep uses. A preset in
days is arithmetic the reader should not have to do.

**A cover must never be able to block a trip from existing.** An upload failure names the file and
offers "continue without a cover". An invitation that fails for one person is reported per person and
does not un-create the trip.

**The design contract (`docs/SPEC.md` §2) applies per surface, per phase**, and is not restated in
each: tokens only; rest, hover, focus-visible, active, disabled and loading named for every control;
designed empty, skeleton and error states drawn on `--color-surface-2`; motion 150–260 ms on
`--ease-out-quint` or a sibling, transform and opacity only, `prefers-reduced-motion` honoured; full
parity in light and dark with dark shadows re-declared; 360, 1280 and 2560; keyboard end to end;
WCAG 2.2 AA; `tabular-nums` on every figure; zero console errors and zero layout shift after paint.

## 📝 Edge Cases & Failure Scenarios

| Case                                                                               | Behaviour                                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A shared `/trips?view=list` link opened by a reader whose stored mode is grid      | Opens in list. The URL is truth; storage supplies only the default for an in-app navigation that carries no `view`                                                                                                  |
| A cold load of a bookmarked `/trips` carrying no `view`                            | Stays in grid. The same honest contract `01-S3` states for the remembered tab, and preferable to a page that paints one layout and swaps to another                                                                 |
| Switching the view mode                                                            | Re-renders and makes **zero** requests to the endpoint behind `loadTrips`. This is asserted as a request count, because it is the measurement that fails if `loaderDeps` is left forwarding the whole search object |
| A stored view-mode value the code no longer knows                                  | Resolves to grid rather than throwing; the versioned payload is discarded whole                                                                                                                                     |
| The archived fold on a workspace with nothing archived                             | Not rendered                                                                                                                                                                                                        |
| The elapsed fraction on a trip that has not started, or has ended                  | Clamped to `0..1` — zero before the start date, one after the end date — and computed on the server from `serverToday()`, so it is pinned by `x-pt-server-today` in development and a baseline is stable            |
| Both dates set, then the start date is moved                                       | The end date moves to preserve the duration; the duration field stays derived and not editable. Moving the **end** date changes the duration                                                                        |
| Neither date set, a duration typed                                                 | The trip is created with that many **undated** days through the day repository; no duration is stored                                                                                                               |
| An end date before its start                                                       | Refused inline, and refused again by the server — the existing `datesOutOfOrder` refinement, which already ships                                                                                                    |
| A cover upload that fails                                                          | Names the file and offers to continue without a cover. The trip is created                                                                                                                                          |
| One initial member of four whose invitation fails                                  | Reported for that person; the trip and the other three memberships stand                                                                                                                                            |
| A currency code the runtime's ISO-4217 set does not contain                        | Refused by the three-letter uppercase validator that already ships (`trip-lifecycle.ts:134-137`); the nine curated favourites stay pinned first and the curated list is not widened                                 |
| A custom reminder value outside 1–30                                               | Refused inline with the bound named, and refused again by the `0..30` validator at the boundary. The column's own 365 cap is untouched                                                                              |
| A trip with no start date and a chosen reminder                                    | The choice is stored; the resolved-date line says the reminder starts working once a departure date is set; the sweep skips the row until it is                                                                     |
| A trip is archived while its reminder is set                                       | Reminders stop, because the sweep reads unarchived trips only. Restoring resumes them. Nothing is scheduled and nothing is cancelled — the archive **is** the switch                                                |
| A rail dragged wider than the viewport allows                                      | Clamped to the readable band by the pure clamp in `plan-layout.ts`, which takes the viewport as an argument rather than reading one                                                                                 |
| A stored rail width restored on a hydrated frame                                   | Applied as a CSS custom property in a layout effect, behind the splash, on a panel that floats above a full-bleed canvas — so it repaints an overlay and reflows no document content                                |
| A navigation into the planner that resolves immediately                            | The splash is not shown at all. It waits on `[data-map-ready]`, the same marker the e2e settle already reads, so the splash and the test agree on what "ready" means                                                |
| An undo whose row is already gone                                                  | The server function raises, the ring reports the reason in a toast and drops the entry. Undo never invents a row and never retries                                                                                  |
| A foreign order landing while the ring is non-empty                                | The ring is cleared. An inverse computed against a state somebody else has replaced is not an undo                                                                                                                  |
| A day detail whose day is removed by a collaborator while it is open               | It closes itself with a message rather than rendering a panel about nothing                                                                                                                                         |
| `countTripPeople` given a list mixing the caller's trip ids and a foreign tenant's | An entry for the caller's trips only, and **no entry — not a zero** — for the foreign ones, so the shape of the answer cannot be read as proof that a foreign id exists                                             |
| A member with no workspace profile in a companion count                            | Counted. The count is of memberships and guests, not of renderable avatars; the avatar stack drops what it cannot name, which is `01-S6a`'s established behaviour                                                   |

## 📝 Risks & Impact Review

**Blast radius.** Four of the six phases edit screens that are D1-live and in daily use:
`trips/index.tsx`, `dashboard.tsx`, the creation dialog and `plan-screen.tsx`. Every one is
**extended, never recreated** — `README.md`'s rule, and the specific failure mode each phase is most
likely to produce. `plan-screen.tsx` is the sharpest: it is 1923 lines, four stages from earlier waves
have landed in it, and Phase 4 both extracts from it and adds to it in the same change.

**The one line that bites if it is missed.** `loaderDeps: ({ search }) => search` at
`trips/index.tsx:46` forwards everything. Narrowing it is part of Phase 1 and the zero-request
assertion is what fails if it is not done — a layout toggle that quietly costs a D1 read per click is
exactly the kind of regression that passes review and shows up on the bill.

**Compatibility.** `BACKWARD_COMPATIBILITY.md` §1 (schema) — untouched, no migration in any phase.
§2 (server-function outputs and inputs) — three payloads widen and two validators gain fields, all
additive. §4 (route paths) — no route added, moved or removed. §5 (locale catalogue) — every new key
lands in all 23 locales in the change that introduces it, which the parity test enforces.

**Rollback.** Every phase is additive at the data layer and reverts cleanly; none writes a column
another phase then depends on. Phase 4's extraction is the only change that moves shipped code, and
it is a module split behind unchanged exports that `pnpm typecheck` verifies before anything runs.
Phase 6 is the only phase that changes what the product **does** on its own — it lets a reader turn
off a reminder they are currently receiving — and that is the feature.

**The dependency that is outside this spec.** Phase 1 needs `src/server/repos/trip-guests.ts`, which
`01-S6b` (#119) creates. #119's spec is merged and its implementation is not open. Phases 2–6 do not
need it. This is stated rather than routed around: the phase order already puts Phase 1 first, and if
#119 slips, Phases 2 and 3 are startable without it.

**Risk label.** `risk-high` carries over from the PRD and stays right — not because any one phase is
dangerous, but because six phases edit the four screens the product is used through, and the planner
extraction touches the largest module in the repository.

## 📋 Resolved assumptions (autonomous defaults)

Written by `om-auto-write-spec` without a human in the loop. Each is the most reversible answer to a
question #104 left open; override any of them on this PR before it merges.

| #      | Question                                                                                                                                                         | Resolution                                                                                                                                                                                                       | Rationale                                                                                                                                                                                                                                                          |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Q1** | #104 is a PRD covering ten stages, seven of which have shipped with their own specs in this directory. What is one spec for it?                                  | One spec at the PRD's altitude, scoped to the **six unshipped stages**, stating what they share and asserting the acceptance contract; per-stage detail stays in the frozen plan. **⚠ NEEDS HUMAN CONFIRMATION** | Re-specifying seven shipped stages would duplicate seven merged specs; specifying all ten at stage depth would duplicate `01-trips-core.md`. The remainder is the only scope that is neither. Gated because it decides what the document _is_.                     |
| **Q2** | The repo convention is that the FR issue is the implementation ticket for its merged spec. Applied to #104 that would ask one run to build six stages on one PR. | It does not apply here. The implementation tickets are **#120–#125**, one per phase, each built with `om-auto-implement-spec` against this spec's phase plus its own stage text. **⚠ NEEDS HUMAN CONFIRMATION**  | #104 is a PRD with sub-issues that already exist and already carry the stage text; `autofix` on #104 would produce an unreviewable change across the four screens the product is used through. Gated because it changes how the pipeline is driven for this issue. |
| **Q3** | The frozen plan has ten stages; the tracker has `01-S8` and `01-S9` each split across two issues.                                                                | Phases follow the **issues** — six phases, matching #120, #121, #122, #123, #124, #125.                                                                                                                          | The issues are what a run is started from and what a PR references; a phase that spans two tickets cannot be closed by either.                                                                                                                                     |
| **Q4** | The frozen plan routes every remaining stage's evidence into `e2e/trips-core.visual.spec.ts`, which does not exist.                                              | One behaviour-asserting `test.describe` per stage, named for the stage, appended to `e2e/trips-core.spec.ts`; console `fatal` empty; no screenshot baselines.                                                    | ADR 0016 retired the visual gate after the plan was frozen. `e2e/trips-core.spec.ts` already carries seven such blocks and is what the gate runs. The same resolution `01-S6b`'s spec took.                                                                        |
| **Q5** | Phase 1 needs `countTripPeople` on a module `01-S6b` (#119) creates and has not built yet.                                                                       | Stated as a hard dependency on #119; the function stays in `trip-guests.ts` and is not re-homed.                                                                                                                 | `docs/SPEC.md` §8 — one concept, one owner. Putting the guest count in `trips.ts` to unblock a week would put it in the module that does not own guests, and moving it later is a second change nobody schedules.                                                  |
| **Q6** | The frozen plan measures `plan-screen.tsx` at 1437 lines and calls the chrome extraction part of the stage; it is 1923 lines at `521d329b`.                      | The extraction is **required**, not optional, and Phase 4 is where it happens.                                                                                                                                   | Four stages have landed in the module since the measurement. Adding four behaviours without moving anything out would make the next stage that opens it worse off, which is the plan's own argument, only stronger.                                                |
| **Q7** | `trip-form.tsx` already exists as the shared field set — the plan describes creating it.                                                                         | Phase 2 **widens** it in place. No second field set, no move.                                                                                                                                                    | The module's own comment reserves the widening for `01-S8` and says to do it there. Recreating it would be the defect `README.md`'s extend-never-recreate rule names.                                                                                              |
| **Q8** | Does this spec enumerate every copy key for six phases?                                                                                                          | It fixes the keys for the controls it decides — the view switch, the archive fold, the strip, the duration, the cover, the reminder — and leaves the rest to each phase, under the namespace convention below.   | Inventing the full string set for six stages would produce keys the implementation then has to contradict. The keys below are the ones whose _wording_ is a product decision rather than a label.                                                                  |

## 📋 Visual change expected

| Route                     | State                                                                       | Themes      | Viewports       | Phase |
| ------------------------- | --------------------------------------------------------------------------- | ----------- | --------------- | ----- |
| `/trips`                  | Grid mode with the mode switch present                                      | light, dark | 360, 1280, 2560 | 1     |
| `/trips`                  | List mode — dense rows, dates, status, companion avatars, action menu       | light, dark | 1280, 2560      | 1     |
| `/trips`                  | Archived disclosure open, with its count chip and in-place row actions      | light, dark | 360, 1280       | 1     |
| `/trips`                  | List-mode skeleton (row height, not card height)                            | light, dark | 1280            | 1     |
| `/dashboard`              | Prominent card with the progress bar and the nights/places/companions strip | light, dark | 360, 1280, 2560 | 1     |
| `/trips` (dialog)         | Creation dialog at the full field set, dates set — duration derived         | light, dark | 360, 1280       | 2     |
| `/trips` (dialog)         | Creation dialog with neither date set — duration editable                   | light, dark | 360, 1280       | 2     |
| `/trips` (dialog)         | Currency combobox open, favourites pinned above the ISO-4217 list           | light, dark | 1280            | 2     |
| `/trips` (sheet)          | Edit sheet rendering the same field set                                     | light, dark | 360, 1280       | 2     |
| `/trips` (dialog)         | Cover control at rest, with an image chosen, and mid-upload                 | light, dark | 360, 1280       | 3     |
| `/trips` (dialog)         | Cover upload failed, offering "continue without a cover"                    | light, dark | 1280            | 3     |
| `/trips` (dialog)         | Initial-members picker open, and its resolved empty state                   | light, dark | 1280            | 3     |
| `/trips/$tripId/plan`     | First-open splash over the workspace                                        | light, dark | 1280, 2560      | 4     |
| `/trips/$tripId/plan`     | Both rails at non-default widths, handles focused                           | light, dark | 1280, 2560      | 4     |
| `/trips/$tripId/plan`     | Rails as full-screen overlays behind their two controls                     | light, dark | 360             | 4     |
| `/trips/$tripId/plan`     | Day detail open over the map, and minimised to its bar                      | light, dark | 1280, 2560      | 5     |
| `/trips/$tripId/plan`     | Day detail empty state for a day with nothing on it                         | light, dark | 1280            | 5     |
| `/trips/$tripId/plan`     | Undo control present, naming the edit it will reverse                       | light, dark | 1280            | 5     |
| `/trips` (dialog / sheet) | Reminder radio group, custom value revealed, resolved-date line             | light, dark | 360, 1280       | 6     |
| `/trips` (dialog / sheet) | Reminder control on an undated trip, with its explanation                   | light, dark | 1280            | 6     |

The seven shipped stages' surfaces are unchanged. `/trips/$tripId/people`, the day timeline, the note
editor and the dashboard's reference column and clock are not touched by any phase here.

## 📋 Copy

Every key lands in all 23 locales in the change that introduces it (`docs/SPEC.md` §9, the
`i18n-messages` skill). Namespace `shell` (`src/lib/i18n/messages/<locale>/shell.ts`), beside the
existing `trips.*`, `dashboard.*`, `newTrip.*` and `tripActions.*` keys, except the planner keys,
which go to `trips` (`.../trips.ts`) beside the existing `plan.*` keys.

| Key                             | `en`                                                                          | Phase |
| ------------------------------- | ----------------------------------------------------------------------------- | ----- |
| `trips.view.label`              | How to read this list                                                         | 1     |
| `trips.view.grid`               | Covers                                                                        | 1     |
| `trips.view.list`               | List                                                                          | 1     |
| `trips.archive.label`           | Archived                                                                      | 1     |
| `trips.archive.show`            | Show archived trips                                                           | 1     |
| `trips.archive.hide`            | Hide archived trips                                                           | 1     |
| `dashboard.hero.progress`       | {percent}% of the way through                                                 | 1     |
| `dashboard.hero.nights`         | Nights                                                                        | 1     |
| `dashboard.hero.companions`     | Travelling with you                                                           | 1     |
| `dashboard.hero.companionsNone` | Just you, so far                                                              | 1     |
| `newTrip.summary`               | What this trip is                                                             | 2     |
| `newTrip.summaryHint`           | One or two lines. It sits under the title everywhere the trip is listed.      | 2     |
| `newTrip.duration`              | How many days                                                                 | 2     |
| `newTrip.durationHint`          | Set the dates instead and this follows them.                                  | 2     |
| `newTrip.durationDerived`       | {days} days, from the dates above                                             | 2     |
| `newTrip.currencySearch`        | Search currencies                                                             | 2     |
| `newTrip.currencyCommon`        | The ones you use                                                              | 2     |
| `newTrip.currencyAll`           | Everything else                                                               | 2     |
| `newTrip.cover`                 | Cover image                                                                   | 3     |
| `newTrip.coverHint`             | Drop one here, paste one, or choose a file.                                   | 3     |
| `newTrip.coverChoose`           | Choose a file                                                                 | 3     |
| `newTrip.coverRemove`           | Remove the cover                                                              | 3     |
| `newTrip.coverUploading`        | Uploading {file}                                                              | 3     |
| `newTrip.coverFailed`           | {file} did not upload                                                         | 3     |
| `newTrip.coverContinue`         | Continue without a cover                                                      | 3     |
| `newTrip.members`               | Who is coming                                                                 | 3     |
| `newTrip.membersHint`           | They can change the plan. Make somebody a viewer if they should only read it. | 3     |
| `newTrip.membersViewer`         | Viewer                                                                        | 3     |
| `newTrip.membersAllOnTrip`      | Everyone in this workspace is already on it                                   | 3     |
| `newTrip.membersInviteHint`     | Invite somebody to the workspace first, then add them here.                   | 3     |
| `newTrip.membersFailed`         | {name} was not added. The trip was created.                                   | 3     |
| `plan.rail.resize`              | Resize the {rail} panel                                                       | 4     |
| `plan.rail.openPlan`            | Open the plan                                                                 | 4     |
| `plan.rail.openPlaces`          | Open the places                                                               | 4     |
| `plan.splash.loading`           | Laying out {title}                                                            | 4     |
| `plan.dayDetail.open`           | Open the detail for {day}                                                     | 5     |
| `plan.dayDetail.minimise`       | Minimise this day                                                             | 5     |
| `plan.dayDetail.restore`        | Open this day again                                                           | 5     |
| `plan.dayDetail.close`          | Close                                                                         | 5     |
| `plan.dayDetail.empty.title`    | Nothing on this day yet                                                       | 5     |
| `plan.dayDetail.empty.body`     | Drop a place on the map, or write a note.                                     | 5     |
| `plan.dayDetail.gone`           | This day is no longer on the trip                                             | 5     |
| `plan.undo.action`              | Undo {what}                                                                   | 5     |
| `plan.undo.addPlace`            | adding {name}                                                                 | 5     |
| `plan.undo.schedule`            | moving {name} to {day}                                                        | 5     |
| `plan.undo.reorder`             | reordering {day}                                                              | 5     |
| `plan.undo.remove`              | removing {name}                                                               | 5     |
| `plan.undo.failed`              | That could not be undone                                                      | 5     |
| `plan.undo.failedBody`          | Somebody may have changed it since.                                           | 5     |
| `newTrip.reminder`              | Remind me before I go                                                         | 6     |
| `newTrip.reminderNone`          | Don't remind me                                                               | 6     |
| `newTrip.reminderDays`          | {days} days before                                                            | 6     |
| `newTrip.reminderDay`           | The day before                                                                | 6     |
| `newTrip.reminderCustom`        | Something else                                                                | 6     |
| `newTrip.reminderCustomLabel`   | Days before departure                                                         | 6     |
| `newTrip.reminderResolved`      | You'll hear from us on {date}                                                 | 6     |
| `newTrip.reminderNoDate`        | Set a departure date and this starts working                                  | 6     |
| `newTrip.reminderOutOfRange`    | Choose between 1 and 30 days                                                  | 6     |

## 📋 Phasing

Six phases, six pull requests, six issues. Each leaves the app working and is independently
revertible. The order is the frozen plan's dependency order.

| Phase | Stage    | Issue | What ships                                                                  | Depends on |
| ----- | -------- | ----- | --------------------------------------------------------------------------- | ---------- |
| 1     | `01-S7`  | #120  | Two view modes, the prominent card's strip, the archived fold               | #119       |
| 2     | `01-S8a` | #121  | The widened trip form: field set, dates and duration, currency, reminder UI | Phase 1    |
| 3     | `01-S8b` | #122  | The cover control and initial members on creation                           | Phase 2    |
| 4     | `01-S9a` | #123  | Extracted workspace chrome, resizable rails, narrow overlays, the splash    | —          |
| 5     | `01-S9b` | #124  | The day detail over the map, and the undo ring                              | Phase 4    |
| 6     | `01-S10` | #125  | The reminder's semantics: presets, the `0..30` bound, the resolved date     | Phase 2    |

Phase 4 has no dependency inside this spec and may run in parallel with Phases 1–3; it touches no
file any of them touch.

## 📋 Implementation Plan

Each step names its verification. The per-stage owned paths and the full component and frame
inventories are in `docs/plans/01-trips-core.md` under the matching stage, and are not repeated.

### Phase 1 — `01-S7`, reading the list two ways (#120)

**Step 1 — the view-mode module.** `src/routes/_app/-lib/view-mode.ts`: the vocabulary, the
`planned.trips-view` declaration with `area: 'local'` holding the mode and the fold state, and the
search-parameter resolution rule. _Verified by:_ `-lib/__tests__/view-mode.test.ts` — an unknown
stored value resolves to grid; the declaration names `area: 'local'` (the case that fails if the mode
is ever given a session lifetime and stops satisfying `TRP-01`); a URL that already carries `view` is
returned unchanged; it is one exported declaration, so the skeleton, the switch and the `beforeLoad`
seed cannot read two different keys.

**Step 2 — `countTripPeople`.** On `src/server/repos/trip-guests.ts`: members plus guests per trip in
two grouped queries over `(organization_id, trip_id)`. _Verified by:_ a `describe('trip people
counts')` block appended to `tenant-isolation.test.ts` — a list mixing A's and B's trip ids returns
entries for A's only and no entry for B's; B's rows are byte-identical afterwards.

**Step 3 — the two loaders.** `loadTrips` returns the archived trips as their own array, the
companion count per card and the caller's favourite; `loadDashboard` adds the companion count and the
elapsed fraction computed from `serverToday()`. _Verified by:_ the `-server` suite — the fraction is
clamped to `0..1`, is zero before the start and one after the end, and takes today as an argument
rather than reading a clock, which is the signature that fails to compile if the computation moves
into the component.

**Step 4 — `view` in the URL, and `loaderDeps` narrowed.** `view: z.enum(['grid','list']).optional()`
joins `searchSchema`; `loaderDeps` narrows to `status`, `q`, `scope`; the `beforeLoad` seed reads the
stored mode under the `typeof window !== 'undefined'` guard `01-S3` established and redirects once
with `replace: true`. _Verified by:_ the e2e block — switching the mode makes **zero** requests to the
endpoint behind `loadTrips`.

**Step 5 — the list row and the switch.** `-ui/trip-list-row.tsx`, the mode switch hidden below `md`,
and a rows skeleton at the row's own height that reads the mode from the search parameter. _Verified
by:_ the route's test and the e2e block — the page never swaps shape after hydration, and layout
shift is asserted after settle.

**Step 6 — the archived fold and the prominent card.** The disclosure with `aria-expanded` and its
count chip, not rendered when empty, its rows carrying `01-S1`'s role-filtered menu; the hero's
`Progress` bar (only while a trip is under way) and the three-figure strip. _Verified by:_ the e2e
block — the fold's open state survives a reload, the restore and delete items are owner-only, and
console `fatal` is empty.

**Step 7 — the copy and the gate.** The `trips.view.*`, `trips.archive.*` and `dashboard.hero.*` keys
in all 23 locales, then `node .ai/scripts/agent-kit-check.mjs`, `pnpm typecheck`, `pnpm lint`,
`pnpm test`, `bash .ai/scripts/check-generated.sh`, `pnpm build`, `pnpm e2e`.

### Phase 2 — `01-S8a`, one widened trip form (#121)

**Step 8 — the currency list.** `src/lib/currency-list.ts`: the nine pinned favourites imported from
`src/lib/money.ts` (which is **not** edited — `04-budget-and-currencies.md` reads it), the runtime's
`Intl.supportedValuesOf('currency')` set, and the search over both. _Verified by:_
`src/lib/__tests__/currency-list.test.ts` — the favourites come first and are not duplicated below; a
runtime that does not supply the set degrades to the favourites rather than throwing.

**Step 9 — the field set.** `trip-form.tsx` widened in place: summary, the duration field, the
currency combobox, the reminder control's markup. _Verified by:_
`-ui/__tests__/trip-form.test.tsx` — both dates set derives the duration and disables it; neither set
makes it editable; moving the start moves the end; moving the end changes the duration; an end before
its start is refused inline.

**Step 10 — the boundary.** `createTripInputSchema` gains `summary`, `durationDays` and
`reminderDays`; `updateTripInputSchema` gains `reminderDays`; a submitted duration with no dates
creates that many undated days through the day repository. _Verified by:_ the `-server` suite — a
duration and a date range together is refused; the day run matches the duration; `strictObject`
rejects an unknown key.

**Step 11 — the copy and the gate.** The `newTrip.summary*`, `newTrip.duration*` and
`newTrip.currency*` keys in all 23 locales; the full gate; one `01-S8a` block in
`e2e/trips-core.spec.ts`.

### Phase 3 — `01-S8b`, the cover and the initial members (#122)

**Step 12 — the cover control.** One region that is a real `button` and a drop target, accepting
drop, paste and the file picker; an object-URL preview; upload on submit through the existing file
path (object first, quota second, compensating delete on failure). _Verified by:_ the form's test —
the keyboard path reaches the file picker; a failed upload offers "continue without a cover" and the
submit still succeeds.

**Step 13 — initial members.** A `MultiCombobox` over the workspace's members with a per-person
viewer option, added after the trip exists, each failure reported per person. _Verified by:_ the
`-server` suite — one failing invitation of four leaves the trip and the other three; the picker's
resolved empty state points at workspace invitations rather than showing an empty dropdown.

**Step 14 — the copy and the gate.** The `newTrip.cover*` and `newTrip.members*` keys in all 23
locales; the full gate; one `01-S8b` block.

### Phase 4 — `01-S9a`, the workspace chrome (#123)

**Step 15 — the pure layout module.** `-ui/plan-layout.ts`: the `planned.planner-layout` (`local`,
keyed, limit 8) and `planned.planner-days` (`session`, keyed, limit 8) declarations and the width
clamp, which takes the viewport as an argument. _Verified by:_ `__tests__/plan-layout.test.ts` — the
two areas are asserted by name, which is the test that fails if the unfolded-day record is ever given
a `local` lifetime; the clamp is total over out-of-range input.

**Step 16 — the extraction.** The chrome moves from `plan-screen.tsx` to `plan-workspace.tsx`; the
optimistic arrangement, the selection reducer and the writes stay. _Verified by:_ `pnpm typecheck`
and the shipped planner tests — `components/planner/__tests__` green **unchanged**, which is the
no-regression gate for the fold-aware camera padding and the optimistic drag.

**Step 17 — the resize handles.** `rail.tsx` accepts a width and publishes a handle with
`role="separator"`, its three ARIA values and an accessible name; pointer drag, arrow keys, `Home`
and `End` in 16px steps; the width applied as a custom property in a layout effect and fed to the
camera padding. _Verified by:_ `rails.test.tsx` — the ARIA values track the width, the keyboard steps
move it, and the handle is absent below the workspace breakpoint.

**Step 18 — the splash and the narrow overlays.** The splash waits on `[data-map-ready]`, is skipped
on an immediate resolution, and never outlives the data by more than its exit; below the breakpoint
the rails are full-screen `Sheet` overlays behind a Plan control and a Places control. _Verified by:_
the e2e block at 360 — both overlays open and dismiss by control, `Escape` and outside tap, console
`fatal` empty.

**Step 19 — the copy and the gate.** The `plan.rail.*` and `plan.splash.*` keys in all 23 locales;
the full gate; one `01-S9a` block.

### Phase 5 — `01-S9b`, the day detail and the undo ring (#124)

**Step 20 — the undo ring.** `-ui/plan-undo.ts`, pure: a bounded in-memory ring of inverse calls, its
bound a named constant beside the reason for it, cleared when a foreign order lands. _Verified by:_
`__tests__/plan-undo.test.ts` — the four covered edits produce correct inverses, the bound evicts
oldest-first, a foreign order clears it, and a stale inverse drops rather than retries.

**Step 21 — the day detail.** `-ui/day-detail.tsx` as a `GlassPanel` with explicit focus management,
a minimised bar, `Escape` to close, a designed empty state, a declared region for `DOC-08`'s weather
badge, and self-closing when its day disappears. _Verified by:_ the component's test — focus moves to
the heading on open and returns to the day header on close; it does **not** trap focus; a removed day
closes it with a message.

**Step 22 — the undo control.** At the head of the itinerary rail, present only when the ring is
non-empty, naming the edit it will reverse in both its accessible name and its tooltip, issuing the
inverse through the existing planner server function. _Verified by:_ the e2e block — undoing a
reorder restores the order, and a failed undo surfaces a toast and drops the entry.

**Step 23 — the copy and the gate.** The `plan.dayDetail.*` and `plan.undo.*` keys in all 23 locales;
the full gate; one `01-S9b` block.

### Phase 6 — `01-S10`, the reminder (#125)

**Step 24 — the semantics.** The preset vocabulary (none / 1 / 3 / 9 and custom 1–30) in the form's
reminder control, and the resolved-date line computed by the **same anchor function the sweep uses**
(`src/server/catalog/reminders.ts`), not a second arithmetic. _Verified by:_
`-server/__tests__/trip-reminder.test.ts` — the rendered date and the sweep's due instant agree for
the same row.

**Step 25 — the bound, and the absence of a scheduler.** `updateTripFn`'s and `createTripFn`'s
`reminderDays` narrowed to an integer `0..30` with the `error` parameter carrying the field's
message; the repository's 365 cap untouched. _Verified by:_ the same file — `31` and `-1` are
refused, `0` is accepted and means off, and the module imports **no** reminder module, asserted
structurally so a scheduler call added later fails the test rather than passing review.

**Step 26 — the undated trip.** The control renders enabled with its explanation and stores the
choice; the sweep's `start_date IS NOT NULL` predicate skips the row until a date exists. _Verified
by:_ the e2e block — choosing a preset on an undated trip persists across a reload and the resolved
line says what it is waiting for.

**Step 27 — the copy and the gate.** The `newTrip.reminder*` keys in all 23 locales; the full gate;
one `01-S10` block. **Trips core is then closed:** eleven `TRP-*` rows, ten stages, `TRP-02` and
`TRP-05` deliberately partial with their deferrals recorded in the stages that own them.
