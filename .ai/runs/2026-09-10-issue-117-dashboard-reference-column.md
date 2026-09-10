# Execution plan — issue-117-dashboard-reference-column

Source doc: docs/plans/01-trips-core.md (stage `01-S5`, lines 2430–2716)
Issue: #117 — 01-S5 — The dashboard's reference column, and the clock in it

## Goal

Give `/dashboard` a reference column the reader controls, and put a multi-time-zone
clock in it. Above `xl` the column is sticky and fixed-width; between `md` and `xl`
the widgets become a row; below `md` a header control opens them in the shipped
`Sheet`. A checkbox menu in the header chooses which widgets show, and turning
every one off collapses the column back to a single-column grid.

## Scope

The stage's Owned paths and nothing else:

- `src/lib/clock-zones.ts` — new, pure.
- `src/lib/__tests__/clock-zones.test.ts` — new.
- `src/routes/_app/-ui/timezone-clock.tsx` — new.
- `src/routes/_app/-ui/dashboard-widgets.tsx` — new.
- `src/routes/_app/dashboard.tsx` — edit.
- `e2e/trips-core.spec.ts` — append one `01-S5` block.
- `src/lib/i18n/messages/*/shell.ts` — the new keys, in all 23 locales.

### The one inference this plan records

The stage's Definition of Done says the column "collapses when every widget is
switched off". `/dashboard` already ships a two-column grid whose `<aside>` holds
three panels — next bookings, trip mix, storage meter (`dashboard.tsx:124-133`).
If the clock were the only toggleable widget, switching it off would leave three
panels standing in a column the ticket says is gone. The four therefore form one
widget set: bookings, trip mix, storage and the new clock. Their component bodies
are untouched, exactly as the stage requires — only their mounting moves.

### Where the frozen plan is stale, and what wins

ADR 0016 (`docs/adr/0016-journeys-replace-the-visual-gate.md`) retired the visual
gate. The stage text's `e2e/trips-core.visual.spec.ts`, `e2e/helpers/shoot.ts`,
`RELATIVE_TIME_SITES`, `e2e/__screenshots__/`, `--update-snapshots -g '01-S5'` and
`scripts/ultrabuild/*` no longer exist in the repository. Issue #117's body is the
current restatement of the stage and names `e2e/trips-core.spec.ts`; it wins.

The clock is held still under test by the seam that replaced them: `visit()`
installs `page.clock.setFixedTime(FROZEN_NOW)` (`e2e/helpers/console.ts:130`), which
pins `Date` in the page while leaving timers running. The widget therefore holds
its tick as an epoch **number** read from `Date.now()`, so a tick under the pinned
clock produces an identical value, React bails out of the render, and the settle
helper sees a quiet document. A tick that stored a fresh `Date` object would
re-render on every minute of every gate run for no visible change.

## Non-goals

- The currency converter. Deferred to the stage minted when the rate-provider
  decision lands (`11-S3`), and **not stubbed** — not even as a disabled control.
- Any change to `loadDashboard` or to `src/routes/_app/-server/overview.ts`. No
  repository function, no server function, no Zod schema, no SQL, no migration.
- Any schema change, any new route, any `pnpm generate-routes`.
- Any dependency change — the stack is pinned (docs/SPEC.md §3).
- Any edit to the existing hero, stat row, trip mix, bookings or storage bodies.

## Risks

- **Hydration.** The widget set and the pinned zones come from a `local`
  preference, and a preference must never be the sole source of a layout-affecting
  first paint (`src/lib/local-preference.ts`). The column renders its default set
  on the server and reconciles in the commit after, so the server HTML and the
  hydrating client agree byte for byte.
- **A zone the runtime rejects.** A stored identifier can outlive a runtime
  update. Validation runs on the way in _and_ on the way out, and the row renders
  an `Alert` naming the zone with a remove action rather than throwing inside a
  formatter and taking the dashboard down with it.
- **`Intl.supportedValuesOf` cost.** The zone list is several hundred strings;
  it is read once behind a module-level lazy cache, never per render.

## Implementation Plan

### Phase 1 — the pure module

`src/lib/clock-zones.ts` holds every decision that can be made without a DOM:
validation against `Intl.supportedValuesOf('timeZone')` on the way in and on the
way out, a label derived from the identifier rather than from a city table, a
signed offset correct across half-hour and quarter-hour zones, a sort by offset
then label, the delay to the next minute boundary, and the single
`planned.dashboard-widgets` preference declaration with `area: 'local'`.

### Phase 2 — the copy

Every new user-facing string as a key in `en`, then in all 22 other locales in the
same change (the `i18n-messages` skill; the parity test enforces it).

### Phase 3 — the widgets

`timezone-clock.tsx` draws the clock; `dashboard-widgets.tsx` draws the column, the
`md`–`xl` row, the `Sheet` below `md` and the `DropdownMenu` of `Checkbox` items.

### Phase 4 — the route

`dashboard.tsx` mounts the column and the header control, and its pending
component reserves the column's exact height.

### Phase 5 — verification

One `01-S5` block appended to `e2e/trips-core.spec.ts`, then the full gate.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: The pure module

- [x] 1.1 Write `src/lib/clock-zones.ts` — validation, label, offset, ordering, tick delay, preference declaration — 1121ee77
- [x] 1.2 Write `src/lib/__tests__/clock-zones.test.ts` — mutation-resistant unit tests — 1121ee77

### Phase 2: The copy

- [ ] 2.1 Add the new `shell.dashboard.widgets.*` and `shell.dashboard.clock.*` keys to `en`
- [ ] 2.2 Land the same keys in the other 22 locales

### Phase 3: The widgets

- [ ] 3.1 Write `src/routes/_app/-ui/timezone-clock.tsx`
- [ ] 3.2 Write `src/routes/_app/-ui/dashboard-widgets.tsx` — column, row, sheet, visibility menu

### Phase 4: The route

- [ ] 4.1 Mount the column and the header control in `src/routes/_app/dashboard.tsx`
- [ ] 4.2 Reserve the column's height in the route's pending component

### Phase 5: Verification

- [ ] 5.1 Append the `01-S5` block to `e2e/trips-core.spec.ts`
- [ ] 5.2 Run the full `validation.commands` gate and fix what it finds
