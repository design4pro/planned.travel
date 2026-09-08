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

> **Rewritten in part by ADR 0016.** This file was written over a visual gate that compared every
> screen against a committed PNG. That gate is gone: no pixel in this repo is compared to a stored
> one, `e2e/__screenshots__/` no longer exists, and `e2e/helpers/shoot.ts` was split into five
> modules with the baseline machinery cut out. Sections 2, 4 and 6 have been brought to HEAD and
> section 5 (which governed `maxDiffPixelRatio`) is deleted. Sections 3 and 7 still argue in terms
> of "frames" and "baselines": read "frame" there as a capture in a blind A/B pair, and treat any
> claim about what a _comparison_ enforces as historical. What remains true throughout is the part
> that was never about pixels - a stage owes named frames at named widths in both themes, in the
> state its change is about, and owes a clean console.

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
`format`, `check`, `deploy`, `deploy:staging`, `typecheck`, `test`, `test:watch`, `e2e`,
`db:generate`, `db:migrate:local`, `db:migrate:remote`, `db:migrate:remote:staging`, `cf-typegen`,
`worktree:bootstrap`, `prepare`, `sentry-triage`. **There is no `test:e2e`, no `test:visual` and no
`playwright` script**; `pnpm e2e` is the whole suite and `pnpm test` is `vitest run`, which runs no
browser. A stage that wants one spec file writes the `playwright` invocation out in full.

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
bash .ai/scripts/e2e.sh                       # takes a free port from the 3030-3040 pool
```

That is the validation gate's own e2e step: it brings the environment up (or reuses a healthy
one) through `.ai/scripts/test-env-up.sh`, reads `baseUrl` out of `.ai/qa/test-env.json` and
passes it to the suite as `PLAYWRIGHT_BASE_URL`. Extra arguments go through to `pnpm e2e`.
Tear down with `sh .ai/scripts/test-env-down.sh`.

`PLAYWRIGHT_BASE_URL` is read by `playwright.config.ts` and suppresses the `webServer` block
entirely. Without it the config waits on 3000 until the global timeout. Outside CI the config also
_refuses_ a base URL outside 3030-3040 unless `PLAYWRIGHT_ALLOW_ANY_PORT=1` is set, because four
consecutive rounds ran the suite against somebody else's server and reported the result as evidence.

### The Playwright projects, as declared

Three, and only these three names are valid after `--project=`:

| Project         | Engine and viewport                                      | What it is for                                                                                               |
| --------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `setup`         | Desktop Chrome, `e2e/auth.setup.ts` only                 | Signs the demo account in once and caches the session at `e2e/.auth/demo.json`. Both others depend on it.    |
| `chromium`      | `devices['Desktop Chrome']`, viewport pinned to 1440x900 | The desktop half, and the one project for any claim no browser is really involved in.                        |
| `mobile-safari` | `devices['iPhone 15']` — WebKit, touch, 393x659 viewport | The mobile half. Safe-area insets, `100dvh` and momentum scrolling behave differently here and nowhere else. |

Both browser projects send `x-pt-server-today: 2026-08-20` on every request. That value is
`FIXTURE_DAY` in `playwright.config.ts`, and it is pinned for a reason that outlived the baselines:
the Worker selects rows by comparing fixture dates against its own `new Date()`, so unpinned, the
seeded workspace's dashboard rail empties for good after 2026-10-12 and `trips-core.spec.ts` starts
skipping - a suite going green by covering less, on a morning nobody touched it. Two vitest guards
read the literal out of the config so the pin cannot drift in silence.

There are no comparison settings, because nothing is compared. `expect.timeout` is 5 s and that is
the whole of the `expect` block.

The commands a stage cites, in the order it runs them:

```sh
# once, or whenever /atlas starts redirecting to /login
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup

# the stage's own spec, both engines
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/<module>.spec.ts

# one engine, when triaging a failure that only appears there
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/<module>.spec.ts --project=mobile-safari
```

There is no fourth command. Recording a baseline was the fourth, and there are no baselines.

A cached session does not expire loudly. It redirects to `/login`, and a run against a stale one
reports the login screen as the product. `--project=setup` is the whole fix and costs one command.

### The interaction frames

`scripts/visual/capture.mjs` takes the frames a human or a blind critic looks at. It is a real file
in this repository, it drives Chromium through `@playwright/test`, and since ADR 0016 it is the
**whole** of the visual judgement rather than the half of it that ran at review:

```sh
PT_SERVER_TODAY=2026-08-20 node scripts/visual/capture.mjs \
  --url "http://localhost:$PORT/<route>" \
  --out "<scratchpad>/shots/<slug>/round-<n>/<stage-id>" \
  --label B \
  --viewports 360x800,1280x900,2560x1440 \
  --themes light,dark \
  --auth \
  [--map] [--state <name>] [--hover '<selector>'] [--click '<selector>'] [--settle 800]
```

It prints one JSON object — `{ requestedUrl, files, console, warnings, captureValid }` — and that
object is the stage's evidence. `captureValid: false` with exit 2 means the frames are of a broken
dev server, not of the change.
What it already handles, so no stage re-derives it: the theme is selected with
`page.emulateMedia({ colorScheme })` and nothing else; `--map` waits for the two-sided
`[data-map-ready]` predicate again after every resize and every theme change; entrance motion is
stopped before the shutter; a frame whose measured `window.innerWidth` is not the one asked for is
refused rather than filed; and `--auth` refuses to file a frame that landed on `/login`.

### `PT_SERVER_TODAY` is not a default, and a stage that omits it shoots a different day

The clock pin is the one seam `capture.mjs` does **not** apply on its own, and the environment
variable in the command above is not decoration. Measured in the script: the header is read from
`process.env.PT_SERVER_TODAY` and the `context.route()` interceptor that attaches it is installed
only `if (serverToday)`. Unset, no request carries `x-pt-server-today`, the Worker answers from its
own wall clock, and the two halves of a blind pair can be photographed on two different days - which
is a comparison of two products, not of one change. What the script fixes is the
_scoping_, not the setting: when the value is present it is attached per request and only to the
capture URL's own origin, because setting it context-wide is what made Google Fonts reject the
preflight and photographed every frame in the fallback face.

`2026-08-20` is the value, and it is not a free choice — it is `FIXTURE_DAY` in
`playwright.config.ts`, the same string both browser projects send. A stage that pins the capture to
one day and the suite to another has produced two pictures of two products.

One limit, measured, that decides where a capture may be pointed: `serverToday()` reads the header
inside an `if (import.meta.env.DEV)` branch (`src/server/clock.ts:73-90`), which the production
build folds out. The pin therefore works against `pnpm dev` — which is what `cez-port.sh` allocates
a port for and what the config's `webServer` starts — and does nothing at all against `pnpm preview`
or a deployed Worker. A stage that wants pinned frames captures
against the dev server, and a stage with a reason to capture against a built Worker says in its
evidence that its frames are on the real day.

Frames go **outside the repository** — the session scratchpad, under
`shots/<slug>/round-<n>/<stage-id>/` — and nowhere else: not the repository root, not `docs/`.
Thirty-six findings in one round were about scratch PNGs left at the repository root. Scratch
scripts go in the scratchpad too, and are deleted after they have served their purpose.

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

`e2e/journeys.spec.ts` is 1,568 lines and 67 KB, and carries fourteen `test()` declarations.
`e2e/trips-core.spec.ts` carries three and `e2e/csrf.spec.ts` two, so `pnpm e2e` is nineteen
declarations across two browser projects plus the `setup` test. Every module still to be built
would otherwise append to the first of those files.

### The rule

**A module plan adds `e2e/<module>.spec.ts`. It never appends to `e2e/journeys.spec.ts`.**

`<module>` is the plan's area name in the same kebab-case as its plan file, so
`04-budget-and-currencies.md` produces `e2e/budget-and-currencies.spec.ts`. One spec file per plan
file, not one per stage: stages within a plan share the file and are told apart by their
`test.describe` block, whose name is the stage id and title.

The `.visual.` infix the earlier version of this rule mandated is gone with the gate that justified
it (ADR 0016). `trips-core.visual.spec.ts` was renamed to `trips-core.spec.ts` in the same change,
and `playwright.config.ts` matches `**/*.spec.ts` and nothing else - a `.test.ts` under `e2e/`
belongs to vitest, which is where the pure helpers are graded.

### Why the split is safe

Not a property of any snapshot template any more - there are no snapshots. It is the plainer
property that two plans writing two files touch two disjoint paths, which is the same disjointness
`README.md` requires of **Owned paths**, obtained mechanically. `fullyParallel: true` then runs them
in different workers against one dev server and one D1 file, which is safe because the suite writes
to the fixture from exactly three places, all of them named in the `workers` comment in
`playwright.config.ts`.

A stage's **Owned paths** lists its spec file explicitly, and nothing else under `e2e/` unless it
genuinely adds a helper:

```
e2e/budget-and-currencies.spec.ts                            new
```

### The shared helpers, which are reused and never re-implemented

Five modules under `e2e/helpers/`, one seam each. A new spec imports from them; **a second
implementation of any of these in a module spec is a defect, not a convenience.**

| Module              | What it owns                                                                                                                                                                                                   |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `session.ts`        | The one sign-in a run gets: `useSession` / `hasSession` / `AUTH_STATE`, and `pinDemoLanguage`, which puts the demo traveller back on the workspace default after any probe that writes `user_settings.locale`. |
| `routes.ts`         | The screens and their shape: `RouteCase` (`name`, `path`, `ready`, the `map` flag), `PUBLIC_ROUTES`, `APP_ROUTES`, `PINNED_YEAR`, and `applyTheme` / `THEMES`.                                                 |
| `settle.ts`         | Paint timing and the live map: `settle()`, `settleMutations()` with its floor and cap, `settleMap()` / `readMapCensus()` and the two-sided `[data-map-ready]` predicate, `FROZEN_NOW`, `readCaptureState`.     |
| `console.ts`        | The visit and the verdict: `visit(page, route, theme)` and `watchConsole(page, route)`.                                                                                                                        |
| `admin.ts`          | The two fixtures no product surface can mint for itself: the platform console (`CONSOLE_ROUTES`, `hasPlatformConsole`) and an impersonated session (`beginImpersonation` / `endImpersonationFixture`).         |
| `console-policy.ts` | `classifyConsoleMessage` and `TOLERATED_CONSOLE_WARNINGS`. Pure, imports nothing, and graded by the `tooling` vitest project rather than by a browser. §6 governs it.                                          |

A stage that needs a helper none of these provides adds it **to `e2e/helpers/`** — a new module such
as `e2e/helpers/<module>.ts` if it is module-specific, or the module above whose seam it genuinely
belongs to — and lists it under **Owned paths**. None of the five is one of the six shared paths in
`README.md`, so a stage may claim one; but two stages in the same wave may not both claim the same
one, and the second to want it declares a module-local helper instead.

### The `map` flag is self-policing; nothing else in the table is

`map` is safe to declare and forget. `settleMap()` (`e2e/helpers/settle.ts:130-146`) fails a route
that renders a `[data-map-ready]` marker without declaring `map: true` **and** a route that declares
one and renders none, so neither half can rot in silence. It reads a generic attribute every map
wrapper in the product publishes, so it holds on a module screen the helper has never seen. Both
halves are additionally exercised by `the harness itself` against a document built for them, because
a canvas that never latches is a state no real screen can be asked to enter.

The `relativeTime` declaration, `RELATIVE_TIME_SITES`, `pinRelativeTime()` and `auditServerClock()`
that earlier versions of this section required are **gone**. They existed to hold a clock-derived
string still inside a pixel comparison, and there is no comparison. What survives of that concern is
the day itself: the header pin described in §2, and the two vitest guards that read `FIXTURE_DAY`
out of `playwright.config.ts`. One rule from that machinery is worth keeping as a rule for humans,
because nothing enforces it any more: a console route must not print a date computed from the
browser's clock when the Worker's is what selected the row. The unit tests over
`src/server/fns/console/-lib/providers.ts` are what is left of the enforcement.

---

## 6. What every Verification block must assert

`TEMPLATE.md`'s `### Verification` heading names the screens and the states. This section fixes what
the words in it have to mean. Both assertions below are required of **every** stage, and a stage
whose Verification block omits either is incomplete.

### Zero console errors or warnings

`docs/SPEC.md` §2: "Zero console errors or warnings." The stage's spec attaches `watchConsole(page,
route)` before it navigates and asserts the returned report's `fatal` list is empty at the end of
every test — including the ones that only walk a screen, because a warning that only appears in dark
at 360px is exactly the kind nobody finds by hand. Since ADR 0016 this is the widest net the suite
casts: it is what still fails a run for a defect no assertion was written to catch.

`classifyConsoleMessage()` is the only arbiter, and `TOLERATED_CONSOLE_WARNINGS` is the only
tolerance list. It currently holds two entries, both anchored at the start of the message so a
warning the app writes itself stays fatal even when it quotes one word for word: the headless
software rasteriser's GL driver advisory, scoped to routes that declare a live map; and the resource
loader's unused-preload advisory, scoped by URL to paths only `vite dev` publishes.

**A stage does not add to that list to make its own run green.** Adding an entry removes coverage,
is argued on its own terms, and is asserted in the `the harness itself` describe block in both
directions — that the tolerated form passes and that the same message from a
production-shaped URL still fails. A React hydration mismatch cannot be tolerated at all: React 19
surfaces it as an uncaught error and a `console.error`, and both classify as `fatal` before the list
is consulted.

`capture.mjs` keeps a separate and deliberately wider list — it runs against `vite dev` with an HMR
client the suite never loads. Its `console.fatal` array being empty is the capture's bar; the
suite's is stricter and neither relaxes the other.

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

Each has been diagnosed. **None is fixed here, and none is re-opened here** — where a diagnosis has
since been corrected the correction is recorded with its citations and nothing further is
investigated. They are listed so that a stage knows what its baseline is worth, and so that nobody
spends a round rediscovering one.

### 7.1 The demo fixture's instants come from the day it was seeded, and no pin reaches them

An earlier draft of this section said `applySeed()` places the demo trip at `now - 12 days` to
`now + 18 days` and that every fixture date therefore moves on re-seed. Both halves were wrong, and
the correction is recorded here rather than quietly dropped so the claim is not made a third time.
Measured: `src/routes/api/dev/-seed/apply.ts:275-276` is the demo **subscription's** billing period,
handed to `demoSubscriptionRecord()` at `:274`; no trip is placed there. Every trip date in the
dataset is an absolute ISO literal —
`src/routes/api/dev/-seed/dataset/trips.ts:30-31` (`2026-08-17` → `2026-08-23`), `:537-538`
(`2026-06-13` → `2026-06-20`), `:1069-1070` (`2025-11-08` → `2025-11-15`) and
`.../dataset/flagship.ts:41-42` (`2026-10-09` → `2026-10-20`). Re-seeding on a different day moves
none of them.

The half of the problem that was real is **closed, not deferred**, and a stage should stop treating
it as an open risk. The Worker chooses which rows a dated screen shows through `serverToday()`
(`src/server/clock.ts`), which takes `x-pt-server-today` on a development request;
`playwright.config.ts` sends `BASELINE_DAY` on both browser projects, and `capture.mjs` sends the
same value when `PT_SERVER_TODAY` is set (§2). Absolute dates on one side and a pinned reader on the
other is a fixed comparison. `reportServerCalendar()`, `crossedBoundaries()`, `CALENDAR_SELECTIONS`
and `shiftServerToday()` survive as the **audit** of that pin — a pin that stopped arriving is named
rather than discovered by cropping two pictures — and they are what a red frame on a dated screen is
read with.

What is still seed-time-relative is the set of **instants** `applySeed()` derives from the single
`new Date()` at `apply.ts:232`: the subscription period (`:275-276`), the workspace's `onboardedAt`
(`:264`) and each person's `onboardingCompletedAt` (`:294`), every notification's `createdAt` and
`readAt` (`:640`, `:654`), every audit-log row's `createdAt` (`:671`), the marker's `seededAt`
(`:697`), and the day count `daysUntil(now, tripStart)` interpolates into notification copy
(`:632-637`). Those are epoch-millisecond columns and `serverToday()` answers a calendar day, so the
header pin does not reach them. Neither does `FROZEN_NOW` (`e2e/helpers/shoot.ts:441`), which holds
an in-page `Date.now()` at `2026-06-15T12:00:00.000Z` — two months before `BASELINE_DAY`, because the
two seams pin different things for different reasons.

Where those columns reach pixels: `formatRelative(value, now)` with `now = Date.now()`, at
`src/routes/_app/notifications.tsx:198` and `:260`, and at `src/routes/_app/admin.tsx:67` and `:303`.
`grep -rn formatRelative src/` returns those two call sites and the definition, and nothing else.
Neither `/notifications` nor `/admin` appears in `PUBLIC_ROUTES` (`e2e/helpers/shoot.ts:314-322`) or
`APP_ROUTES` (`:355-362`), and `e2e/__screenshots__/visual.spec.ts/` holds no baseline for either of
them. What those strings render as under the two clocks has consequently never been measured, and
this section does not guess: the recorded fact is that the value is unpinned, and an unpinned value
inside a comparison is a baseline with an expiry date. The defect is **latent today and active the
moment one of those two screens is baselined** — the same shape as §7.2.

**Status: deferred. Blocking for the first stage that baselines `/notifications`, `/admin`, or any
new surface printing a `formatRelative` string.** It is not blocking for the thirteen routes
baselined today, which select rows on absolute dates against a pinned reader. A stage that adds one
of those screens inherits this and records it under **Blockers**; designing the seam is neither this
file's work nor a side effect that stage may take on.

### 7.2 Seven abbreviated-month call sites still ask the platform

`src/lib/format.ts` already closed this for itself, and says why in its own header: `Intl` resolves
`month: 'short'` from whichever ICU the runtime was built against, workerd and WebKit disagree, and
the module now answers from a CLDR en-GB table instead of asking. That is the fixed one.

Seven call sites still construct their own `Intl.DateTimeFormat` with `month: 'short'`:
`src/components/costs/data.ts` (two),
`src/components/modules/transports/transports-timeline.tsx`,
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

**Status: closed by ADR 0016, and worth reading anyway.** There are no baselines, so nothing here
blocks anything. What the diagnosis still says is true of a blind pair: two frames taken on two
machines differ for reasons that are the renderer's, and neither the critic nor the reader can tell
those from the product's. Capture both halves of a pair on one machine, and a stage that meets a
`mobile-safari` difference it cannot attribute reports it under **Blockers** rather than explaining
it away.

---

## 8. What a stage's evidence looks like when it is finished

Five things, and a stage that produces four of them is not done:

1. **The command gate**, run in `TEMPLATE.md`'s order, with the result of each: `pnpm lint`,
   `pnpm typecheck`, `pnpm test`, `pnpm build`.
2. **The Playwright run**, with the exact invocation including `PLAYWRIGHT_BASE_URL`, the projects
   it covered, and the pass/fail count; and, for a spec that declares a `relativeTime` route, the
   `auditServerClock()` result plus any sentences `auditRelativeTime()` reported, read as §4 says.
   A failure whose message is a bare timeout with no pixel count and no assertion diff is evidence
   about machine load, not about the code — it is reported as such and no code changes in response
   to it.
3. **The frame set**: light and dark at 360, 1280 and 2560, plus a declared-state set for any stage
   whose point is a non-resting state, all under
   `.claude/ultrabuild/shots/<slug>/round-<n>/<stage-id>/`, with the selector that reached the state
   and how it was verified to exist, and with the `capture.mjs` invocation quoted in full so the
   `PT_SERVER_TODAY` pin is visible rather than assumed.
4. **The console verdict**: `fatal` empty, and any `tolerated` entry named with the rule that
   excused it.
5. **The layout-shift reading** after the settle mark, per engine, with the WebKit skip stated as a
   skip.

And one thing a stage never leaves behind: a PNG or a scratch script at the repository root. Both
browsers write to a temporary path first, so moving the file to the round's shot directory is a step
that was being taken anyway.
