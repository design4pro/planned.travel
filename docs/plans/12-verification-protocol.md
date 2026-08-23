# Verification protocol

`docs/SPEC.md` §7 item 4 says a feature "is visually verified in a real browser, light and dark,
desktop and mobile". It names no tool, no viewport, no evidence format and no place to put the
result, so every plan that has ever asserted it has asserted something unfalsifiable.

This file makes that item runnable. It is the answer to one question — **what does a stage actually
execute, and what does it leave behind, so that a reader who was not there can re-run it and get the
same answer?** — and it binds every stage in every file listed in `README.md`.

It is not a plan. It carries no `gap-rows.json` row, owns no source file, and adds no stage of its
own. `TEMPLATE.md` fixes the shape of a stage; this file fixes what the stage's **Verification**
heading has to contain and what the words in it mean.

---

## 1. The container rule for stage blocks

Fixed here rather than in `TEMPLATE.md` because three separate audits of that file found it
undefined, and an undefined container is why a plan can end up as a flat run of `###` headings with
no boundary a reader or a parser can see.

**Every stage is opened by a level-two heading:**

```md
## Stage 04-S2 — Freeze the rate a converted amount was computed at
```

`## Stage <stage-id> — <title>`. The id is the `<NN>-S<k>` form `TEMPLATE.md` mints; the title is a
sentence fragment naming the outcome, not the mechanism.

**The eleven headings of the stage block stay at `###`, in `TEMPLATE.md`'s order, and no other
heading appears at that level inside a stage:**

`Stage id` · `Reference rows` · `Owned paths` · `Data and migration` ·
`Server (repo, server function, Zod)` · `UI (route, components)` · `Quota` ·
`Tenant isolation test` · `Verification` · `Definition of done` · `Blockers`.

Two consequences, both deliberate:

- Consecutive stages can never run together. The next `##` closes the previous stage, so a stage's
  extent is a scan for the next level-two heading and never a guess about which `### Stage id` began
  a new block.
- `### Stage id` is kept even though the container heading already carries the id. It restates the
  id — **character for character**, so a mismatch is a one-line diff and not a reading exercise —
  and adds the wave the stage may start in and the S/M/L/XL effort roll-up, which have nowhere else
  to live.

A plan file's **Area brief** sits above the first `## Stage` heading and uses `###` freely; the rule
binds what is inside a stage block, not what is before the first one.

---

## 2. What a stage may run, and what does not exist

### There is no `test:e2e` script, and no stage may write one

Measured in `package.json`: the scripts are `dev`, `generate-routes`, `build`, `preview`, `lint`,
`format`, `check`, `deploy`, `typecheck`, `test`, `test:watch`, `db:generate`, `db:migrate:local`,
`db:migrate:remote`, `cf-typegen`. **There is no `test:e2e`, no `test:visual`, no
`playwright` script and no `e2e` script.** `pnpm test` is `vitest run` and runs no browser.

`docs/SPEC.md` §3 freezes `package.json`, so a stage cannot add one either. Every plan therefore
writes the Playwright invocation out in full, and a stage whose Verification block cites a script
name that is not in the list above is rejected before it is scheduled — the name is the tell that
nobody ran it.

### The dev server

`pnpm dev` is `vite dev --port 3000`, and `playwright.config.ts` defaults `baseURL` to
`http://localhost:3000` and starts `pnpm dev` itself when no external URL is given
(`reuseExistingServer: !isCI`). That is the documented, one-command path and a stage may state it as
such:

```sh
pnpm dev                       # vite dev --port 3000
pnpm exec playwright test      # config's webServer starts/reuses it on 3000
```

Port 3000 is not guaranteed to be ours on a developer machine, and a suite pointed at a stranger's
server produces failures that look like product defects. When the port is in doubt, resolve it and
pass it explicitly rather than probing by hand:

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)     # add --start only if the pool is empty
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test
```

`PLAYWRIGHT_BASE_URL` is read by `playwright.config.ts` and suppresses the `webServer` block
entirely. Without it the config waits on 3000 until the global timeout.

### The Playwright projects, as declared

Three, and only these three names are valid after `--project=`:

| Project         | Engine and viewport                                      | What it is for                                                                                               |
| --------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `setup`         | Desktop Chrome, `e2e/auth.setup.ts` only                 | Signs the demo account in once and caches the session at `e2e/.auth/demo.json`. Both others depend on it.    |
| `chromium`      | `devices['Desktop Chrome']`, viewport pinned to 1440x900 | The desktop half. Every desktop baseline.                                                                    |
| `mobile-safari` | `devices['iPhone 15']` — WebKit, touch, 393x659 viewport | The mobile half. Safe-area insets, `100dvh` and momentum scrolling behave differently here and nowhere else. |

Both browser projects send `x-pt-server-today: 2026-08-20` on every request, matching `BASELINE_DAY`
in `e2e/helpers/shoot.ts`. Comparison settings live in `expect.toHaveScreenshot`:
`maxDiffPixelRatio: 0.002`, `threshold: 0.2`, `animations: 'disabled'`, `caret: 'hide'`,
`scale: 'css'`. §5 governs what a stage may do with those numbers, which is nothing.

The commands a stage cites, in the order it runs them:

```sh
# once, or whenever /atlas starts redirecting to /login
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup

# the stage's own spec, both engines
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/<module>.visual.spec.ts

# one engine, when triaging a failure that only appears there
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/<module>.visual.spec.ts --project=mobile-safari

# record the stage's own new baselines - never another stage's
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/<module>.visual.spec.ts --update-snapshots
```

A cached session does not expire loudly. It redirects to `/login`, and a run against a stale one
reports the login screen as the product. `--project=setup` is the whole fix and costs one command.

### The interaction frames

`scripts/ultrabuild/capture.mjs` takes the frames a human or a blind critic looks at. It is a real
file in this repository, it drives Chromium through `@playwright/test`, and it deliberately writes
**nothing** under `e2e/__screenshots__`:

```sh
node scripts/ultrabuild/capture.mjs \
  --url "http://localhost:$PORT/<route>" \
  --out ".claude/ultrabuild/shots/<slug>/round-<n>/<stage-id>" \
  --label B \
  --viewports 360x800,1280x900,2560x1440 \
  --themes light,dark \
  --auth \
  [--map] [--state <name>] [--hover '<selector>'] [--click '<selector>'] [--settle 800]
```

It prints one JSON object — `{ files, console, warnings }` — and that object is the stage's evidence.
What it already handles, so no stage re-derives it: the theme is selected with
`page.emulateMedia({ colorScheme })` and nothing else; `--map` waits for the two-sided
`[data-map-ready]` predicate again after every resize and every theme change; the clock header is
scoped to the app origin by hand rather than set context-wide; entrance motion is stopped before the
shutter; a frame whose measured `window.innerWidth` is not the one asked for is refused rather than
filed; and `--auth` refuses to file a frame that landed on `/login`.

Frames go under `.claude/ultrabuild/shots/<slug>/round-<n>/<stage-id>/` and nowhere else — not the
repository root, not `docs/`. Scratch scripts go in the session scratchpad and are deleted after
they have served their purpose.

---

## 3. The frame set every stage owes

### Fixed: two themes at three widths

**Light and dark at 360px, 1280px and 2560px.** Six frames per surface, and a stage that ships two
surfaces owes twelve. No stage negotiates this set down, and a stage that wants a seventh frame —
a tablet width, an intermediate breakpoint where its layout changes — adds it and says why.

The three widths are chosen against `docs/SPEC.md` §2's "Responsive 360px → 2560px": 360 is the
narrow end and the one where a squeezed desktop is exposed, 2560 is the wide end and the one where a
layout that only knows how to stretch is exposed, and 1280 is the ordinary laptop nobody checks
because it is assumed to work.

These are the **evidence** widths and are separate from the gate's own. The `chromium` project
compares at 1440x900 and `mobile-safari` at 393x659; those two are what `--update-snapshots` records
and what a regression is measured against. Neither replaces the other: the gate proves nothing
changed, the frame set proves the thing is good.

### A stage whose point is a non-resting state must declare that state

A resting screenshot of a screen is not evidence about a hover tooltip, an open dialog, an error
surface or a loading skeleton. Every blind pair in one earlier run photographed a route at rest, and
a map-overlay item was accepted at high confidence without the critic ever seeing the hover tooltip
that was the entire request.

So: **if the stage's outcome is a state the screen is not in when it loads, the stage names that
state, and names the selector that reaches it.**

- The selector is written into the stage's Verification block, and it is passed to
  `--hover` / `--click`, or reached by the stage's own spec before its `toHaveScreenshot`.
- **The selector must have been verified to exist against a running server**, and the stage says how
  it was verified — `pnpm exec playwright test e2e/<module>.visual.spec.ts` passing is a
  verification; a `page.locator(sel).count()` that returned 1 is a verification; reading the JSX and
  believing it is not. A selector that resolves to nothing makes `capture.mjs` throw at
  `--hover`/`--click`, and a stage that discovers that during capture has spent a round on it.
- Prefer a stable attribute the product already publishes over a class name or an nth-child path.
  `[data-part="…"]`, `[data-state="open"]`, `role` plus accessible name all survive a restyle; a
  Tailwind class does not, and a selector that breaks on a restyle turns a future stage's green run
  red for a reason that is not its own.
- The state gets its own frame set, named with `--state <name>` so the file names say what they are.
  The resting set is still owed — a hover state is judged against the rest state it changes from.

Loading and error states are usually not reachable by hovering anything. Reach them the way the
product does: a stage that ships a skeleton renders it behind a route that is genuinely pending or
behind the component's own pending prop in a spec, and a stage that ships an error surface reaches
it with `page.route()` returning a failure for the request the surface reports on. If neither is
reachable without a fixture the stage does not own, that is a blocker to record, not a frame to skip
quietly.

---

## 4. The spec-file split rule

### Measured, at HEAD

`e2e/visual.spec.ts` is 2,994 lines and 118 KB. `pnpm exec playwright test --list` reports **137
tests in 2 files** — 68 per browser project plus the `setup` test — and
`e2e/__screenshots__/visual.spec.ts/` holds **52 baseline PNGs** (13 routes × 2 themes × 2
projects). Every module still to be built would append to that one file.

### The rule

**A module plan adds `e2e/<module>.visual.spec.ts`. It never appends to `e2e/visual.spec.ts`.**

`<module>` is the plan's area name in the same kebab-case as its plan file, so
`04-budget-and-currencies.md` produces `e2e/budget-and-currencies.visual.spec.ts`. One spec file per
plan file, not one per stage: stages within a plan share the file and are told apart by their
`test.describe` block, whose name is the stage id and title.

`e2e/visual.spec.ts` stays where it is and keeps what it has. It is not split retroactively — its 52
baselines are approved frames and moving a spec file moves its baseline directory, which would
re-record all 52 for no design reason. It is simply frozen against growth.

### Why the split is safe, and it is a property of the config rather than a hope

`playwright.config.ts` sets

```
snapshotPathTemplate: '{snapshotDir}/{testFileName}/{arg}-{projectName}{ext}'
```

so a new spec file gets its own baseline directory — `e2e/__screenshots__/<module>.visual.spec.ts/`
— and **cannot collide with or disturb an existing baseline**. Two stages in the same wave, in two
different plans, writing two different spec files, cannot touch each other's pixels. That is the
same disjointness `README.md` requires of **Owned paths**, obtained mechanically.

A stage's **Owned paths** lists its spec file and its baseline directory explicitly:

```
e2e/budget-and-currencies.visual.spec.ts                     new
e2e/__screenshots__/budget-and-currencies.visual.spec.ts/    new
```

### The shared helpers, which are reused and never re-implemented

`e2e/helpers/shoot.ts` is the one implementation of everything below. A new spec imports from
`./helpers/shoot.ts`; **a second implementation of any of these in a module spec is a defect, not a
convenience.**

| Helper                                                                                                   | What it settles                                                                                                                                                                |
| -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `visit(page, route, theme)`                                                                              | Cross-origin fonts unblocked, theme emulated, clock fixed at `FROZEN_NOW`, navigate, assert status < 400, then `settle()`.                                                     |
| `settle(page, route)`                                                                                    | The nine-step wait: ready selector, `document.fonts.ready`, hydration, DOM quiet, images decoded, dev chrome hidden, pointer and scroll reset, map idle, two animation frames. |
| `settleMap(page, route, census)` / `readMapCensus(page)`                                                 | The two-sided `[data-map-ready]` predicate. A bare wait on `="true"` hangs.                                                                                                    |
| `settleMutations(page)`                                                                                  | The DOM-quiet window, with its floor and its give-up cap.                                                                                                                      |
| `shoot(page, route, theme)`                                                                              | Pins the relative-time region, picks full-page vs viewport-after-resize, applies the mask, takes the baseline.                                                                 |
| `captureMode(route)` / `fitViewportToDocument(page, route)`                                              | Why a map route is captured at a grown viewport instead of full-page.                                                                                                          |
| `applyTheme(page, theme)` and `THEMES`                                                                   | `page.emulateMedia({ colorScheme })` and nothing else. Never write `data-theme`; never drive the app's theme menu.                                                             |
| `useSession` / `hasSession` / `AUTH_STATE`                                                               | The cached demo session, and skipping with an actionable reason when there is none.                                                                                            |
| `watchConsole(page, route)` + `classifyConsoleMessage(...)` + `TOLERATED_CONSOLE_WARNINGS`               | The console verdict. §6 governs it.                                                                                                                                            |
| `RouteCase`, `PUBLIC_ROUTES`, `APP_ROUTES`, `PINNED_YEAR`                                                | The route declaration: `name`, `path`, `ready`, and the `map` / `relativeTime` flags that must match reality in both directions.                                               |
| `BASELINE_DAY`, `FROZEN_NOW`, `reportServerCalendar`, `shiftServerToday`, `crossedBoundaries`, `holdsOn` | The clock seams, and the diagnosis printed when a fixture date has crossed one.                                                                                                |

A stage that needs a helper none of these provides adds it **to `e2e/helpers/`** — a new module such
as `e2e/helpers/<module>.ts` if it is module-specific, or `e2e/helpers/shoot.ts` if it genuinely
belongs to the shared settle — and lists it under **Owned paths**. `e2e/helpers/shoot.ts` is not one
of the six shared paths in `README.md`, so a stage may claim it; but two stages in the same wave may
not both claim it, and the second one to want it declares a module-local helper instead.

A stage's route also declares its flags honestly. `settleMap()` fails a route that renders a
`[data-map-ready]` marker without declaring `map: true` **and** a route that declares one and renders
none, so neither half can rot in silence. The same is true of `relativeTime`.

---

## 5. Raising `maxDiffPixelRatio` is forbidden

`playwright.config.ts` sets `maxDiffPixelRatio: 0.002` — about 0.2% of a 1440x900 viewport, which is
the budget for cross-platform font antialiasing and nothing else. A shifted card, a wrong colour, a
missing row and a re-flowed paragraph all cost far more than that.

**No stage raises it. Not globally, not per project, not per call.** That includes the
`toHaveScreenshot` option of the same name, `maxDiffPixels`, and widening `threshold` past 0.2. A
diff of, say, 3,798 pixels against a budget of 1,322 is not a budget that is too tight; it is a real
difference of about three times the budget, and a stage that widens the budget to absorb it has
deleted the only mechanism that would have caught the next one.

When a comparison fails, exactly two remedies are legitimate:

1. **Pin the renderer**, if the difference is the engine's and not the product's. §7.3 names the one
   precondition that has to land for this to be possible, and until it does the honest report is
   "this baseline is not trustworthy on a second machine", not a wider budget.
2. **Fix the source of the difference** — the product changed, and either the change is right and
   the baseline is re-recorded with `--update-snapshots`, or the change is wrong and the code is
   fixed. Re-recording is a decision a stage states and argues, never a reflex: the re-recorded
   frames travel in the stage's diff and an auditor reads them.

A third thing is legitimate and is not a remedy: **excluding a region that is genuinely the clock's
to decide**, via the `relativeTime` declaration and `pinRelativeTime()`, which pins the string first
so the excluded rectangle is a constant on every run and every calendar day. That machinery exists
and is narrow. Widening a mask to cover a component that merely regressed is the same defect as
widening the ratio, wearing different clothes.

---

## 6. What every Verification block must assert

`TEMPLATE.md`'s `### Verification` heading names the screens and the states. This section fixes what
the words in it have to mean. Both assertions below are required of **every** stage, and a stage
whose Verification block omits either is incomplete.

### Zero console errors or warnings

`docs/SPEC.md` §2: "Zero console errors or warnings." The stage's spec attaches `watchConsole(page,
route)` before it navigates and asserts the returned report's `fatal` list is empty at the end of
every test — including the tests that only take a frame, because a warning that only appears in dark
at 360px is exactly the kind nobody finds by hand.

`classifyConsoleMessage()` is the only arbiter, and `TOLERATED_CONSOLE_WARNINGS` is the only
tolerance list. It currently holds two entries, both anchored at the start of the message so a
warning the app writes itself stays fatal even when it quotes one word for word: the headless
software rasteriser's GL driver advisory, scoped to routes that declare a live map; and the resource
loader's unused-preload advisory, scoped by URL to paths only `vite dev` publishes.

**A stage does not add to that list to make its own run green.** Adding an entry is a change to the
gate's own contract, is argued on its own terms, and is asserted in the `the gate itself` describe
block in both directions — that the tolerated form passes and that the same message from a
production-shaped URL still fails. A React hydration mismatch cannot be tolerated at all: React 19
surfaces it as an uncaught error and a `console.error`, and both classify as `fatal` before the list
is consulted.

`capture.mjs` keeps a separate and deliberately wider list — it runs against `vite dev` with an HMR
client the gate never loads. Its `console.fatal` array being empty is the capture's bar; the gate's
is stricter and neither relaxes the other.

### No layout shift after paint

`docs/SPEC.md` §2: "Zero layout shift after paint." Nothing in `e2e/` or in `capture.mjs` measures
this today, so the stage that first needs it builds the seam. Three things are already measured and
must not be re-derived:

1. **`layout-shift` is a Chromium-only entry type.** Measured against a running dev server on both
   engines: `PerformanceObserver.supportedEntryTypes` includes `layout-shift` in Chromium and does
   not in WebKit — and, crucially, `observe({ type: 'layout-shift' })` **does not throw** in WebKit,
   it silently records nothing. A WebKit score of `0` is therefore "unsupported", never "clean", and
   a spec that asserts it on `mobile-safari` is asserting nothing. The assertion is gated on
   `supportedEntryTypes` and skipped with a stated reason otherwise.

2. **"After paint" means after the settle, not after navigation.** Measured on four public routes at
   1440x900 in Chromium with the accumulator sampled at a mark taken once `document.fonts.ready` had
   resolved, the network was idle and 400 ms had passed: total shift since navigation was `0.00205`
   on `/pricing` (2 entries) and `0.00849` on `/login` (1 entry), while shift **after the mark** was
   `0` on all four over the following 1.5 s. So the budget after the settle mark is genuinely zero
   and genuinely achievable, whereas a budget of zero measured from navigation would fail on pages
   nobody has touched.

3. **Entries with `hadRecentInput` are excluded**, because a shift the user asked for by clicking
   something is not the defect this clause is about.

The shape a stage's spec uses, in its own words:

- install a `PerformanceObserver` for `layout-shift` as an **init script**, before the document
  exists, accumulating `entry.value` for entries where `hadRecentInput` is false;
- `visit()` and `settle()` as normal, then read `performance.now()` as the mark;
- exercise whatever the stage is about — resize, theme change, open the declared state;
- assert the sum of entries after the mark is `0`.

The value is reported in the stage's evidence either way, so a stage that has to skip it on WebKit
says so and does not present the skip as a pass.

### And the rest of the block

The stage still names, as `TEMPLATE.md` requires: the command gate in order (`pnpm lint`,
`pnpm typecheck`, `pnpm test`, `pnpm build`); the unit tests it adds by file and the invariant each
holds; and the specific screens and states its frames cover. This file owns the procedure; the stage
owns the choice of screen.

---

## 7. Three harness preconditions, deferred and already understood

Each has been diagnosed. **None is re-diagnosed here and none is fixed here.** They are recorded so
that a stage knows what its baseline is worth, and so that nobody spends a round rediscovering one.

### 7.1 Demo-fixture dates move with the day the workspace was seeded

`playwright.config.ts` pins the day the Worker _reads_ — `x-pt-server-today: 2026-08-20`, matching
`BASELINE_DAY` — and `visit()` pins the clock inside the page at `FROZEN_NOW`. Neither pins the
**data**. Measured: `applySeed()` in `src/routes/api/dev/-seed/apply.ts` derives its
fixtures from `new Date()` at seed time (`:232`), and places the demo trip at `now - 12 days` to
`now + 18 days` (`:275-276`). Re-seed on a different day and every fixture date moves under a reader
that did not, so a screen selecting rows by comparing a fixture date against `today` renders a
different set of rows.

The diagnosis machinery for this already exists and is what a failure should be read with:
`reportServerCalendar()`, `crossedBoundaries()`, `CALENDAR_SELECTIONS` and `shiftServerToday()`.

**Status: deferred. Blocking for authenticated baselines.** Until the fixture is anchored to an
absolute day rather than to seed time, a baseline of an authenticated route is only trustworthy
against the database it was recorded against. Public-route baselines are unaffected — they select no
rows.

### 7.2 Seven abbreviated-month call sites still ask the platform

`src/lib/format.ts` already closed this for itself, and says why in its own header: `Intl` resolves
`month: 'short'` from whichever ICU the runtime was built against, workerd and WebKit disagree, and
the module now answers from a CLDR en-GB table instead of asking. That is the fixed one.

Seven call sites still construct their own `Intl.DateTimeFormat` with `month: 'short'`:
`src/components/costs/data.ts` (two), `src/components/modules/transports/legs-timeline.tsx`,
`src/components/modules/collab/collab-board.tsx`, `src/components/modules/collab/thread.tsx`,
`src/components/modules/book/bookings-timeline.tsx` and
`src/components/modules/files/file-library.tsx`.

Measured: every one of them renders only under `/trips/$tripId/*`, and none of the thirteen routes in
`PUBLIC_ROUTES` and `APP_ROUTES` is one of those. The defect is therefore **latent today and active
the moment a trip tab is baselined.**

**Status: deferred. Blocking for the first stage that baselines a trip tab.** A stage that adds a
`/trips/$tripId/*` route to a spec inherits this and records it under **Blockers**, because a
September date on such a screen differs between the two projects for a reason that is not the design.

### 7.3 The renderer behind the `mobile-safari` baselines is not pinned by anything in the repo

Measured: `package.json` declares `"@playwright/test": "^1.62.1"` — a caret range;
`pnpm-lock.yaml` resolves it to 1.62.1 today, and that version's `browsers.json` keys chromium to
revision 1234 (151.0.7922.34) and webkit to revision 2336 (26.5). The browser cache on this machine
holds five chromium revisions (1200, 1208, 1217, 1228, 1234) and four webkit ones (2227, 2248, 2272,
2336). Nothing in the repository asserts which is in use: there is no install step in
`package.json`, and `.github/workflows/ci.yml` runs lint, typecheck, `vitest run --coverage` and
build — **no Playwright job at all**, so no automated run ever compares the 52 committed baselines
against a second machine.

Chromium's contribution is at least deterministic: it paints through a software rasteriser, which is
why `shoot.ts` tolerates that rasteriser's GL advisory on map routes. The WebKit half has no
equivalent guarantee recorded.

**Status: deferred. Blocking for treating any baseline as cross-machine truth.** Today the baselines
are a single-machine regression net, which is a real and useful thing; they are not yet a shared
one. A stage may rely on them to prove _it_ changed nothing. A stage may not claim a green comparison
as evidence that the design renders identically anywhere else, and a stage that meets a
`mobile-safari` difference it cannot attribute reports it under **Blockers** and pins nothing — §5
forbids the shortcut.

---

## 8. What a stage's evidence looks like when it is finished

Five things, and a stage that produces four of them is not done:

1. **The command gate**, run in `TEMPLATE.md`'s order, with the result of each: `pnpm lint`,
   `pnpm typecheck`, `pnpm test`, `pnpm build`.
2. **The Playwright run**, with the exact invocation including `PLAYWRIGHT_BASE_URL`, the projects
   it covered, and the pass/fail count. A failure whose message is a bare timeout with no pixel
   count and no assertion diff is evidence about machine load, not about the code — it is reported
   as such and no code changes in response to it.
3. **The frame set**: light and dark at 360, 1280 and 2560, plus a declared-state set for any stage
   whose point is a non-resting state, all under
   `.claude/ultrabuild/shots/<slug>/round-<n>/<stage-id>/`, with the selector that reached the state
   and how it was verified to exist.
4. **The console verdict**: `fatal` empty, and any `tolerated` entry named with the rule that
   excused it.
5. **The layout-shift reading** after the settle mark, per engine, with the WebKit skip stated as a
   skip.

And one thing a stage never leaves behind: a PNG or a scratch script at the repository root. Both
browsers write to a temporary path first, so moving the file to the round's shot directory is a step
that was being taken anyway.
