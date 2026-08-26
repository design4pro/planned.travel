# 14 — Dashboard mascot

## Area brief

An original animated character living on the dashboard hero — the hosted equivalent of the
reference product's hero-slot mascot widget, delivered as a permanent first-class feature. The
character reacts to the traveller's own trip data: unhurried when departure is far, visibly keener
as it nears, a distinct countdown mode with a flap-style day counter inside the final week, a
travelling pose while the trip runs, and a completely static designed pose for anyone who asked
for reduced motion.

**The scope is deliberately small, and this plan keeps it that way.** One stage, one screen, zero
new tables, zero new columns, zero new bindings, zero new routes, zero new server functions, zero
new modules, zero new dependencies. Everything the character needs is already on the dashboard
loader's wire, and the plan's job is to say precisely how a purely client-side decoration ships
without violating the motion rules, the hydration rules or the clean-room rule. A stage that finds
itself wanting a table, a queue or a settings column has left this plan's scope and is wrong, not
ambitious.

The plugin **runtime** is not ported, only the widget's value. The boundary rows `EXT-01`,
`EXT-02` and `EXT-03` in `11-boundaries-and-blockers.md` remain excluded exactly as written there:
no plugin host, no widget slots, no manifest, no per-widget permission grants. This is the
hosted-equivalent doctrine `11-boundaries-and-blockers.md` and `13-community-gallery.md` already
apply, applied to one more behaviour. Behaviour is sourced from `wiki: Plugins`; no code, no
strings and no visual design cross from the reference.

#### The character, commissioned here — original to planned.travel

The clean-room rule covers the character itself. The reference ships a mascot with its own name,
its own silhouette and its own prop vocabulary; none of that is described, ported or approximated
here. This plan commissions our own:

- **Name: Nomi** — a proper noun, never translated, never rendered on screen (it lives in this
  plan and in source comments; the UI shows the character, not the name).
- **Silhouette: a young Arctic tern** — the bird that travels farther than any animal on Earth,
  which is the planned.travel joke. A compact teardrop body, a long forked tail, a small scarf in
  `--color-brand`, drawn as inline SVG in the editorial-modern language of `docs/DESIGN.md`: soft
  rounded forms, token colours only, confident and quiet rather than cartoon-loud.
- **Personality: an unhurried flight-planner.** Studies the horizon when departure is far, allows
  itself a nap only when there is plenty of time, perks up through the final month, hops with
  undisguised excitement in countdown week, and flies a tiny pennant while the trip is underway.
  Behavioural beats (excitement scaling with proximity, a countdown tag in the final week, a
  distinct in-trip look, napping only when time is plentiful) are sourced from `wiki: Plugins` as
  behaviour; every visual answer to them is our own.

#### The motion-rule reconciliation, stated as a design decision rather than slipped past

`docs/DESIGN.md`'s motion rules say 150–260ms on `--ease-out-quint`, nothing over 400ms. An
ambient character necessarily loops for longer than 400ms — a bob cycle or a blink cadence lives
in seconds. This plan does not pretend otherwise, and it does not quietly break the rule. The
decision, recorded here for the auditor and the executing run alike:

- **Discrete UI transitions obey the rule without exception.** Every pose change, the flap tile's
  entrance flip, the pause control's own states: 150–260ms, `--ease-out-quint` or a sibling token
  (`src/styles/tokens.css:691-697`), transform and opacity only.
- **The ambient loop is a decorative animated illustration, not a UI transition**, and it is
  admitted under four hard conditions that keep the spirit of the rule: (1) transform and opacity
  only — never a layout-affecting property; (2) it reserves fixed space, so the hero has zero
  layout shift with or without it; (3) it is pausable by the reader through a real, keyboard-
  reachable control, and pauses itself when the tab is hidden; (4) under
  `prefers-reduced-motion: reduce` it collapses to a completely static designed pose — not a
  slower loop, no loop at all.
- The individual keyframe _segments_ inside a loop (a hop's rise, a head turn) still land in the
  150–260ms envelope; only the loop's period exceeds it, and the loop is what conditions 2–4
  govern.

#### What is on disk today, measured at HEAD, not recalled

- **The hero and its countdown already exist.** `src/routes/_app/dashboard.tsx` renders the
  `UpNext` hero (`:141`) as an inverse `Card` with `overflow-hidden` (`:180-183`); it computes
  `startsIn` with `daysUntil(trip.startDate, data.today)` at `:175` and renders the empty-state
  hero when `upNext` is `null` (`:145-173`). The pending skeleton is `DashboardPending` (`:660`).
- **The loader already supplies everything the state machine needs.** `loadDashboard`
  (`src/routes/_app/-server/overview.ts:183`) reads `serverToday()` (`:186`) and returns it as
  `DashboardPayload.today` (`:100`, `:204`); `upNext` (`:101`) is a `TripCard` carrying `status`
  (`:61`), `startDate` (`:62`) and `endDate` (`:63`). `serverToday()` itself is
  `src/server/clock.ts:73`, with the dev-only `x-pt-server-today` pin read at `:81`.
- **The upstream query bounds the state space.** `listUpcomingTrips`
  (`src/server/repos/trips.ts:232-245`) keeps a trip while `endDate >= today`, or — when
  `endDate` is null — while `startDate >= today` (both branches in the `or(...)` at `:240`), and
  orders by `startDate` ascending (`:242`). So an in-progress dated trip sorts first, a finished
  trip never reaches the hero, and an open-ended trip is last seen on its own departure day — the
  state machine still handles the unreachable past-end and started-open-ended inputs totally, but
  those branches are unreachable through this loader and the plan says so instead of designing UI
  for them.
- **The date arithmetic is already written.** `daysUntil` is `src/lib/format.ts:430` (negative
  once started), `daysBetween` is `:443`, `formatNumber` is `:456`.
- **The motion machinery exists.** Tokens at `src/styles/tokens.css:691-697`; the product's
  keyframes live in `src/styles/styles.css:814-943` with the `--animate-*` theme wiring at
  `:188-207`; the global reduced-motion block is `:1061-1090` — it collapses every animation to
  `0.01ms`/one iteration (`:1068-1077`), resets `transform` on `[data-motion-transform]`
  (`:1080-1082`) and keeps indeterminate indicators pulsing via `[data-motion-loop]`
  (`:1086-1089`). The `motion` package is pinned (`package.json:45`, `^13.1.0`) and the shipped
  JS-motion pattern is `src/components/layout/pill-nav.tsx:2,10,25-28`.
- **Why the loops must be CSS keyframes and not `motion`'s rAF loop:** the visual gate captures
  with `animations: 'disabled'` (`playwright.config.ts:90`), which settles CSS animations
  deterministically but — measured in `e2e/helpers/shoot.ts:998-999` — cannot settle a transform
  driven from JavaScript. A rAF-driven ambient loop would make every dashboard baseline
  nondeterministic. So: ambient loops are CSS `@keyframes` appended to `src/styles/styles.css`
  beside the existing `pt-*` set; `motion` is not used by this stage at all.
- **The i18n surface is ready.** `src/lib/i18n/messages/<locale>/shell.ts` exists for all 23
  locales (five namespaces shipped per locale at HEAD: `atlas`, `auth`, `settings`, `shell`,
  `ui`); the dashboard's hero keys are `en/shell.ts:239-265`. The stored-preference precedent for
  a client-only toggle is `THEME_STORAGE_KEY = 'planned.theme'` (`src/lib/theme.ts:18`).
- **The stored reduce-motion setting is not yet wired to the DOM.** `user_settings.reduce_motion`
  exists (`src/server/db/schema.ts:1847`) and is edited on `/settings/appearance`, but at HEAD no
  layout or route applies it — every shipped consumer reads the OS media query
  (`useReducedMotion()`, `pill-nav.tsx:25`). The mascot therefore honours
  `prefers-reduced-motion` the same way the rest of the product does, and does not invent a
  document attribute that nothing else sets. Wiring the stored setting product-wide is
  `09-account-and-settings.md`'s ground, not this plan's.
- **Copy-rules coverage is a hand-written list.** `copy-rules.test.ts` sweeps the shell's route
  files through an explicit `APP_FILES` array
  (`src/components/layout/__tests__/copy-rules.test.ts:39-48`); the new mascot files are added to
  it so an English literal in them fails `pnpm test`.

#### No matrix row, no collisions, and one superseded sentence

No `gap-rows.json` id names a dashboard mascot; the 89-row matrix predates this scope, which is
minted by this plan from the task brief — the same footing as `13-community-gallery.md`.

Owned-path collisions were checked with `node scripts/ultrabuild/check-plan-collisions.mjs`, not
by reading siblings: `src/routes/_app/dashboard.tsx` is claimed by `01-S5` (wave 2) and `01-S7`
(wave 5), so this plan's single stage takes **wave 3**, where the file — and every other exclusive
path below — is unclaimed. One sibling sentence is superseded rather than edited: `01-S7` (wave 5)
observes that `src/routes/_app/-lib/` "has no `__tests__` today; this stage creates it". This
wave-3 stage creates that directory first with `mascot-state.test.ts`; `01-S7`'s observation was
true when written and its own file claim (`view-mode.test.ts`) is untouched.

## Stage 14-S1 — Nomi on the hero: the state machine, the flap countdown and the pause control

### Stage id

`14-S1` · Wave 3 · effort **M**. The plan's only stage: the character, its pure state machine, its
CSS motion, its pause control, its copy in 23 locales and its visual evidence, all on the one
screen that hosts it.

### Reference rows

**No `gap-rows.json` entry exists for this scope** — the matrix predates it and the scope is
minted by this plan from the task brief. `EXT-01`, `EXT-02` and `EXT-03` remain excluded exactly
as `11-boundaries-and-blockers.md` records them: only the hero widget's value is delivered, never
a plugin runtime, a widget slot or a manifest.

Behaviour sourced from `wiki: Plugins`, described in planned.travel's vocabulary: a character on
the dashboard hero reads the next trip's dates; its energy scales with proximity to departure; in
the final week it switches to a countdown mode showing the days remaining on a flap-style tile; it
has a distinct look while the trip is underway; it rests only when departure is comfortably far;
and it holds a single static pose for a reader with reduced motion. No sentence, name, asset or
visual element crosses from the reference.

### Owned paths

- `src/routes/_app/dashboard.tsx` — edit. Mounts the mascot inside the `UpNext` hero card
  (`:180-283`) and nowhere else; every existing section is untouched. Cross-wave sharers, each in
  its own wave: `01-S5` (wave 2), `01-S7` (wave 5).
- `src/routes/_app/-ui/mascot.tsx` — new. The character: inline-SVG art with one designed pose
  per state, the fixed-size stage, the flap day tile, the pause control, the client-side mount
  gate.
- `src/routes/_app/-lib/mascot-state.ts` — new. The pure state machine: `(today, trip) → state`,
  no clock access, no imports beyond types.
- `src/routes/_app/-lib/__tests__/mascot-state.test.ts` — new. Creates the directory; see the
  area brief's supersession note about `01-S7`.
- `src/styles/styles.css` — edit. The `pt-mascot-*` keyframes appended beside the existing set
  (`:814-943`) and one `[data-mascot-paused]` play-state rule. Unclaimed by any stage in any wave
  (measured with `check-plan-collisions.mjs`); not one of `README.md`'s six shared paths.
- `src/components/layout/__tests__/copy-rules.test.ts` — edit. Two entries appended to
  `APP_FILES` (`:39-48`) so the new files are swept for English literals. Unclaimed by any other
  stage.
- `src/lib/i18n/messages/en/shell.ts` — append. The `dashboard.mascot.*` keys and nothing else.
- `src/lib/i18n/messages/<tag>/shell.ts` — append, for each of the 22 non-English tags
  (`ar` … `zh-Hant`): the same keys, translated from our English (`docs/SPEC.md` §8.9).
- `e2e/dashboard-mascot.visual.spec.ts` — new. This plan's module spec, per
  `12-verification-protocol.md` §4.
- `e2e/__screenshots__/dashboard-mascot.visual.spec.ts/` — new. Its baseline directory.
- `e2e/__screenshots__/visual.spec.ts/dashboard-light-chromium-darwin.png` — edit.
- `e2e/__screenshots__/visual.spec.ts/dashboard-dark-chromium-darwin.png` — edit.
- `e2e/__screenshots__/visual.spec.ts/dashboard-light-mobile-safari-darwin.png` — edit.
- `e2e/__screenshots__/visual.spec.ts/dashboard-dark-mobile-safari-darwin.png` — edit. The four
  committed dashboard baselines change because the hero now carries the character; re-recorded
  with Playwright only, following `08-product-modules.md`'s precedent of claiming the PNGs.

No route file is added, so `pnpm generate-routes` is not run. `e2e/helpers/shoot.ts` is **not**
claimed: the reasoning is under Verification, together with the one condition that would change
that.

### Data and migration

No table and no column is needed: the state machine's every input — `today`, `upNext.startDate`,
`upNext.endDate`, `upNext.status` — is already on the dashboard loader's wire
(`src/routes/_app/-server/overview.ts:100-101`, `:61-63`, `:204`), and the pause preference is a
client-side `localStorage` entry following the `planned.theme` precedent (`src/lib/theme.ts:18`),
so `pnpm db:generate` is not run and no migration exists to name.

### Server (repo, server function, Zod)

**No server function, no repository change and no Zod schema is needed, measured at this run's
HEAD against `src/routes/_app/dashboard.tsx` and its loader:** the route's loader is
`loadDashboard` (`src/routes/_app/-server/overview.ts:183`), which already returns
`DashboardPayload.today` (`:100`, filled from `serverToday()` at `:186` and returned at `:204`)
and `upNext` with `status`/`startDate`/`endDate` (`:61-63`) — the identical inputs the hero's own
countdown consumes at `dashboard.tsx:175`. The mascot adds no read, no write and no endpoint, so
there is no input to validate and no authorisation decision to make; the loader's existing
`appScope()` (`overview.ts:185`) already tenant-scopes everything the character sees. Nothing is
enqueued and nothing touches the Durable Object protocol.

### UI (route, components)

- **Route.** `/_app/dashboard` — the existing file, edited, default SSR unchanged. The mascot
  mounts only inside the `UpNext` inverse hero (`dashboard.tsx:180-283`). On the empty hero
  (`upNext === null`, `:145-173`) and on the pending skeleton (`:660`) it does not mount at all —
  the `hidden` state — so the blank-slate invitation keeps its own composition.

- **The state machine**, pure and total, in `src/routes/_app/-lib/mascot-state.ts`, keyed off
  `days = daysUntil(startDate, today)` (`src/lib/format.ts:430`, negative once started) and the
  trip's date range:

  | State        | Condition (evaluated in order)                                  | Behaviour                                                                                                                         |
  | ------------ | --------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
  | `hidden`     | no `upNext` trip                                                | not mounted                                                                                                                       |
  | `drifting`   | `startDate` null                                                | idle ambient only: blink cadence, occasional slow head turn                                                                       |
  | `travelling` | `days ≤ 0`, and `endDate` null or `today ≤ endDate` (inclusive) | in-trip pose: pennant raised, tail up; no counter; a slow contented sway                                                          |
  | `countdown`  | `1 ≤ days ≤ 7`                                                  | excitement: hop cycle, and the **flap day tile** appears, counting the days remaining `7 → 1`                                     |
  | `eager`      | `8 ≤ days ≤ 30`                                                 | anticipation: brisker bob cadence, wing-stretch beat, no naps                                                                     |
  | `settled`    | `days > 30`                                                     | unhurried ambient: blink, long look-around, and the **nap** micro-behaviour (eyes closed, slower sway) — the only state that naps |

  **Day zero has exactly one owner: `travelling`.** The bands are disjoint by construction —
  `travelling` takes `days ≤ 0`, `countdown` starts at `1` — so departure day on any trip with a
  start date is the trip underway, never the countdown: the flap tile counts `7 → 1` and is gone
  on departure morning, and no `0` tile exists anywhere. That agrees with the hero's own stat,
  which on day zero shows the word for today (`shell.dashboard.hero.today` via `startsInValue`,
  `dashboard.tsx:294`), not a numeral. The one input the table leaves — `endDate` set and
  `today > endDate` — returns `drifting` defensively, but the branch is unreachable through this
  loader: `listUpcomingTrips` drops the trip the morning after it ends
  (`src/server/repos/trips.ts:240`). Escalation is monotone — cadence and amplitude step up
  `settled → eager → countdown` — so the character visibly builds anticipation as departure
  nears. The module exports the band constants so the tests and the spec pin the same numbers.

- **Placement and zero layout shift, by construction.** The character occupies a fixed-size,
  absolutely-positioned stage inside the hero card (logical `inset-block-start` /
  `inset-inline-end`, inside the card's existing `overflow-hidden` at `dashboard.tsx:183`),
  clear of the badge row (`:202-219`) and the open-plan button (`:221-227`). It inserts no flow
  content: the hero's flow layout is byte-identical with and without it, which is what makes
  "zero layout shift" a property rather than a hope. One fixed size at `< sm` (small enough to
  clear the title at 360px) and one at `≥ sm`; the walk is a `translateX` excursion inside the
  stage's own box. Under `dir="rtl"` the stage positions itself with logical properties and the
  art mirrors via the `rtl:` scale utility (which compiles to the standalone `scale` property, so
  the reduced-motion `transform` reset cannot un-mirror it); the flap tile's digit sits in an
  inner span so no bidi isolation ever lands on the positioned box itself.

- **SSR and hydration safety, the concrete mechanism.** Three rules, together sufficient:
  (1) the state is a pure function of `data.today` and the trip's dates — both server-computed,
  both on the payload — so SSR and hydration derive the identical state even when the client's
  wall clock has crossed midnight or sits in another timezone; the component and the state module
  contain no `Date.now()` and no `new Date()`, and the unit test reads the shipped source to hold
  that (the `copy-rules.test.ts` technique). This matches the hero's own countdown
  (`dashboard.tsx:175`) and the capture harness's `x-pt-server-today` pin
  (`src/server/clock.ts:81`, `playwright.config.ts:32-34`). (2) The server renders the designed
  static pose for the current state; the markup React hydrates is exactly the markup the server
  sent. (3) Animation mounts client-side only: a `useEffect` after mount sets a `data-` attribute
  on the stage, and only that attribute's CSS enables the keyframes — the class list at hydration
  time is identical to SSR, so no mismatch is possible, and the same effect is where the OS
  reduced-motion query and the stored pause preference are read before anything moves.

- **Motion, all CSS.** Keyframes `pt-mascot-*` in `src/styles/styles.css` beside the existing set
  (`:814-943`): transform and opacity only; every loop's first and last keyframe is the identity
  transform, so both the gate's `animations: 'disabled'` settle (`playwright.config.ts:90`) and
  the reduced-motion collapse (`styles.css:1068-1077`) land the character exactly on its designed
  rest pose. Discrete transitions (pose swap, flap entrance) run 150–260ms on `--ease-out-quint`.
  Base positions use Tailwind translate utilities (the `translate` property, which the
  `[data-motion-transform]` reset at `:1080-1082` deliberately does not touch); motion excursions
  live only in keyframe `transform`, which that reset and the duration collapse kill — so reduced
  motion yields the static designed pose with nothing misplaced. The flap tile's tick JS (the
  entrance flip) is additionally gated on the media query, and the digit renders statically
  without it.

- **Pausable.** An `IconButton` (existing primitive; its `inverse` variant,
  `src/components/ui/icon-button.tsx:32-33`, carries hover/focus-visible/active/disabled on the
  dark hero) with `aria-pressed`, toggling `[data-mascot-paused]` on the stage —
  `animation-play-state: paused`, freezing the character mid-pose rather than unmounting it. The
  choice persists in `localStorage` under `planned.mascot` (the `planned.theme` pattern,
  `src/lib/theme.ts:18`), read post-mount only. The loop also pauses on
  `document.visibilityState === 'hidden'` so a background tab spends nothing.

- **States of every surface.** The stage's own async states are inherited: the pending skeleton
  and the error panel belong to the route (`dashboard.tsx:101-102`) and the mascot simply is not
  there — a decorative character has no skeleton of its own, and this plan resists inventing one.
  The pause control ships rest, hover, focus-visible, active and pressed; it is never disabled
  and never loading (the toggle is synchronous), and that is stated rather than left as an
  unticked box.

- **Accessibility.** The figure and the flap tile are `aria-hidden`: the day figure duplicates
  the hero's own "Starts in" stat (`dashboard.tsx:263-271`), so no information exists only in the
  decoration. The pause control is the one interactive element: keyboard reachable in the hero's
  existing order, accessible name from the catalogue, `aria-pressed` state, WCAG 2.2 AA contrast
  on the inverse surface in both themes.

- **Tokens.** Everything from `src/styles/tokens.css`: art fills from the inverse ramp and
  `--color-brand` (dark re-declares both), spacing on `--space-*`, radii from `--radius-*`,
  motion from `--ease-out-quint`/`--duration*` (`:691-697`). `tabular-nums` on the flap digit.
  No new token is needed; if the executing run disagrees, that is a wave-0 foundations
  requirement to file, never an inline hex.

- **Copy.** Two keys in the `shell` namespace — `dashboard.mascot.pause` and
  `dashboard.mascot.resume` (the pause control's accessible names) — appended to
  `en/shell.ts` and all 22 sibling catalogues in this same stage. No other user-visible string
  exists; the character's name never renders.

### Quota

This stage creates no countable row — it writes no D1 row, no KV entry, no R2 object and no queue
message, only a client-side `localStorage` preference — so no metric, no `assertQuota` call site
and no `resolveLimits()` change is needed.

### Tenant isolation test

No repository function is added or changed and no server function is added, so there is no new
read or write path for organization B to probe and no case is added to
`src/server/repos/__tests__/tenant-isolation.test.ts`; the mascot consumes `loadDashboard`'s
existing payload, whose isolation is already enforced and tested at the repository layer.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- **Unit tests** — `src/routes/_app/-lib/__tests__/mascot-state.test.ts` holds: every band
  boundary exactly (`31 → settled`, `30 → eager`, `8 → eager`, `7 → countdown`, `1 → countdown`,
  `0 → travelling` — departure day has exactly one owner and the flap never shows `0` — and the
  end day `travelling` too, inclusive on both ends, matching `daysUntil`/`daysBetween` semantics
  at `src/lib/format.ts:430,:443`); the day after `endDate` → `drifting` (the defensive branch);
  an open-ended trip on its departure day (`endDate` null, `days = 0`) → `travelling`; null-date
  and null-trip inputs; totality (every input maps to exactly one state, including the
  loader-unreachable inputs); and the no-clock invariant — the shipped source of
  `mascot-state.ts` and `mascot.tsx` contains neither `Date.now` nor `new Date` (asserted by
  reading the files, the `copy-rules.test.ts` technique).
- **i18n**: both `dashboard.mascot.*` keys land in `en` **and all 22 sibling `shell.ts`
  catalogues** in this stage — the 23-locale budget is part of the stage, not a follow-up — and
  `src/lib/i18n/__tests__/parity.test.ts` passes with zero new failures. The two new mascot
  files are in `copy-rules.test.ts`'s sweep, so an English literal in them is a failing test.
- **Module spec** — `e2e/dashboard-mascot.visual.spec.ts` declares `/dashboard` in its own route
  table and calls `auditServerClock` over it once, as `12-verification-protocol.md` §4 requires
  of any module spec declaring an authenticated route. States are reached with the
  `x-pt-server-today` pin (dev-server capture only — the header is read inside the
  `import.meta.env.DEV` branch, `src/server/clock.ts:73-90`), against the seeded October trip
  measured in `e2e/visual.spec.ts:2445-2446` (`2026-10-09 → 2026-10-20`):
  - **`countdown`** — pin `2026-10-05` (4 days out): flap tile visible, hop pose. **This state
    is the point of the feature and is a required capture state.**
  - **`in-trip`** — pin `2026-10-12`: travelling pose, no tile. **Required capture state.**
  - **`reduced-motion`** — `page.emulateMedia({ reducedMotion: 'reduce' })` at the same pins:
    the static designed pose, tile digit rendered statically. **Required capture state.**
  - **`paused`** — the control pressed, plus its hover and focus-visible frames.
  - Ambient bands — pins `2026-09-01` (`settled`, 38 days) and `2026-09-25` (`eager`, 14 days).
    The August fixture trips (`e2e/visual.spec.ts:2429-2431`) may still qualify for the hero at
    the earlier pin; the executing run confirms which trip is `upNext` with
    `reportServerCalendar` and moves the pin within the band rather than trusting this
    paragraph's arithmetic.
    Every named state is captured **in both themes**; the resting set is shot at 360px, 1280px and
    2560px, light and dark, and an `ar` frame at 360px and 1440px proves the logical positioning
    and the mirrored art.
- **The committed gate baselines** — the four claimed dashboard PNGs are re-recorded with
  Playwright (`--update-snapshots`, never another browser). At `BASELINE_DAY = '2026-08-20'`
  (`e2e/helpers/shoot.ts:1150`, sent by `playwright.config.ts:32-34`) the fixture's August trip
  is still running, so the baselines capture the `travelling` pose, settled deterministically to
  its first keyframe by `animations: 'disabled'` (`playwright.config.ts:90`) — which is exactly
  why the loops are CSS and not rAF (`e2e/helpers/shoot.ts:998-999`).
- **No `RELATIVE_TIME_SITES` entry and no `e2e/helpers/shoot.ts` claim**, reasoned rather than
  skipped: the flap digit is the mascot's only clock-derived string, it renders only in
  `countdown` (`1 ≤ days ≤ 7`), and at `BASELINE_DAY` the hero is in-trip — so no committed gate
  baseline contains
  it, and every module-spec frame that does contain it is shot under a fixed pin, making the
  digit deterministic. **The one condition that changes this:** if the executing run finds the
  flap visible at `BASELINE_DAY` (fixture drift), it adds the `RELATIVE_TIME_SITES` entry and
  claims `e2e/helpers/shoot.ts` — free in wave 3; the existing claims are `10-S2` (wave 1) and
  `01-S5` (wave 2).
- **Zero console errors or warnings** in every frame, both themes — a warning is this stage's
  bug. **Zero layout shift**: the spec asserts the hero stat rail's and the heading's bounding
  boxes are identical before and after the mount effect enables the animation, in both themes.

### Definition of done

The six items of `docs/SPEC.md` §7 apply unchanged.

- [ ] Spacing on the 4px grid from `--space-*`. No eyeballed one-off margins.
- [ ] Hover, focus-visible, active and pressed on the pause control; its never-disabled,
      never-loading nature stated above rather than skipped.
- [ ] The mascot's absence states (empty hero, pending, error) resolve to the route's designed
      states; no list is added, so no new empty/skeleton/error surface is owed or invented.
- [ ] Discrete motion 150–260ms on `--ease-out-quint`, transform and opacity only; the ambient
      loop admitted solely under the area brief's four conditions;
      `prefers-reduced-motion: reduce` collapses to the static designed pose.
- [ ] Light and dark parity on the inverse hero, with the dark inverse ramp's re-declared values,
      and with a cover image behind the hero as well as without one.
- [ ] 360px → 2560px, with the small stage a designed size that clears the title at 360px, and
      the `ar` layout mirrored through logical properties.
- [ ] Keyboard reachable end to end, accessible names from the catalogue, WCAG 2.2 AA contrast
      in both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint — asserted, not assumed.

### Blockers

None. No package is needed (`motion` is pinned but deliberately unused here; the animation is CSS
against the existing token set), no binding is touched, no third-party service is involved, and no
row in another plan gates this stage — the wave-3 placement is a collision choice, not a
dependency. The ambient-loop/400ms tension is a recorded design decision in the area brief, not a
blocker.
