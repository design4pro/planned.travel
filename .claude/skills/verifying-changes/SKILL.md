---
name: verifying-changes
description: The canonical verification ladder for this repo and how to read its feedback loops (vitest, the Playwright journeys, the blind A/B pair, dev-server pitfalls). Use before claiming any change works, and when a test failure looks confusing.
---

## Before the ladder: provision the checkout

**In a fresh checkout or a `git worktree`, run `pnpm worktree:bootstrap` before anything else.**
Four fixtures are gitignored and per-checkout — `node_modules`, `.dev.vars`, a migrated local D1,
and the basemap in the local R2 simulator — so `git worktree add` carries none of them. Missing
`.dev.vars` is the one that hurts: Better Auth throws on the first request that touches a session,
`/login` answers 500, every authenticated spec skips rather than fails, and the whole application
behind the gate is unreachable. Diagnosing that from a red suite costs an hour; the command costs a
minute and is idempotent, so running it when it was not needed is free.

It picks a free port in 3001-3009 (3000 belongs to the main checkout, 3030-3040 to automated
rounds), copies `.dev.vars` and the basemap from the main checkout when it has them, migrates,
seeds the demo workspace, and prints the sign-in. `bash scripts/worktree/bootstrap.sh --check`
reports what is missing without writing anything. The SessionStart hook runs it with `--if-needed`,
so a checkout that is already provisioned costs milliseconds. Flags and profiles:
`scripts/worktree/README.md`.

## The ladder

1. Fast loop while working: `pnpm typecheck`, `pnpm lint`, single vitest files.
2. Before committing: full `pnpm test`.
3. Before a PR: `pnpm build`, then `pnpm generate-routes && git diff --exit-code -- src/routeTree.gen.ts` (CI rejects a stale route tree). A build leaves that file alone: `tsr.config.json` mirrors the Start `Register` footer the vite plugin appends, so the plugin and `tsr generate` write the same bytes (issue #82). If a build or a dev server ever does dirty it, the config has drifted from the plugin — fix the config rather than committing the rewrite; CI re-asserts this after `pnpm build`, and the cezar ladder after the e2e dev server starts.
4. UI touched: `pnpm e2e` locally, and **look at the screens**. Nothing compares a pixel any more (ADR 0016): the journeys assert that a screen answers, renders, hydrates, says nothing in the console and can be acted on, and CI runs exactly the same twenty declarations on the PR. What catches a screen that changed *shape* is the blind A/B pair — `node scripts/visual/capture.mjs`, the last bullet of "Probing the running app" below — and it only catches it if somebody runs it and reads it. For a refactor with no intended visual change (a Tailwind bump, a token retune, an edit to a shared layout) that pair is the only thing standing between the change and `develop`.
5. In a cezar worktree, the whole ladder has one entrypoint (`scripts/agent/cez-ladder.sh` wraps it): `TARGET_BRANCH=<integration branch> bash scripts/agent/validate.sh --json-out <path>` — always runs route-tree gate + typecheck + lint + vitest, and adds the Playwright suite when the diff touches UI paths (`--force-e2e`/`--skip-e2e` override). It prepares the e2e env itself via `setup-e2e.sh --if-needed` and runs Playwright with `E2E_WORKERS` workers (default 4; the suite is parallel-safe — see the `workers` comment in `playwright.config.ts`). Each worktree takes its own port from the 3030-3040 pool (`cez-port.sh`), so parallel runs never collide.
6. CI runs `verify` and the journeys on **every** PR, including from a fork — the journeys need no basemap and therefore no R2 credential. Two shards (`e2e · critical journeys (k/2)`) start alongside `verify`; read results in the `e2e · merged report` job, whose `playwright-report` artifact is the one HTML report for both shards, carrying the traces and videos of anything that failed.

## Reading failures (hard-won facts — trust them)

- A Playwright or vitest failure whose message is a **TIMEOUT, with no pixel count and no assertion diff**, is evidence about machine load, not about the code. Rerun; never change code in response to one. The discriminator is the **duration**, not the failure count: a spec that takes 31s under full-suite load and 4.6s alone is contention, and specs have failed two identical full runs in a row and passed the third. Require three consecutive full-suite failures before calling one broken.
- A **whole route suite failing on one repeated error shape** (e.g. HTTP 504 "Outdated Optimize Dep", or every authenticated spec skipping) is a statement about the dev server, never about the diff. Clear `node_modules/.vite`, restart the server, rerun.
- **In dev, the browser console also carries the server's log.** `@tanstack/devtools-vite` relays it, prefixed `%c[Server]%c` and linked through `/__tsd/open-source`, so a console-watching spec can go red on something that happened in the Worker rather than on its own page — and on something another spec, or the seed, caused. The sandbox case, seen once per run: `setup-e2e.sh` writes a `.dev.vars` with no `EMAIL_API_KEY`, so the auth emails the seed's sign-ups enqueue throw `TaskConfigurationError`, and the consumer's `task completed`/`task dead-lettered` pair lands in whichever page is open when the queue drains. It is environmental, it moves between specs run to run, and it is not the diff. Rerun; the discriminator is a console entry whose stack is the Worker's, not the app's.
- **Anything that deletes or moves source must restart the dev server before the gate runs.** A server that already loaded a module answers HTTP 500 on unrelated routes after the file goes away — measured as five failures across `/pricing`, `/login`, `/legal/terms` and `/trips` while typecheck, lint, vitest and build were all clean.
- **A whole page of red can be one root cause.** `pinDemoLanguage()` (setup project, `e2e/helpers/session.ts`) puts the demo traveller back on the workspace default, because `user_settings.locale` is a real column any probe that clicks a chip on `/settings/language` writes to. When it cannot, it prints `[shoot] could not pin the demo traveller's language` once, far above the failure list — grep for it before blaming every authenticated route.
- A **fresh checkout or `git worktree` has no `.wrangler/state`**, so the local R2 basemap is missing and every atlas page renders the BASEMAP UNAVAILABLE fallback. This no longer fails anything — measured on the branch that retired the baselines, the six atlas journeys are green with an empty `.e2e-tiles/`, because the land, water and borders they click on come from Natural Earth in the bundle. It still makes a blind pair worthless for an atlas screen. `pnpm worktree:bootstrap` provisions it; failing that, `bash scripts/agent/setup-e2e.sh` loads the archive into the local R2 simulator.
- Authenticated specs hold the demo session in `e2e/.auth/demo.json`. A stale session does not fail — it **redirects to /login and specs skip**. Refresh with `pnpm exec playwright test --project=setup`.
- `.dev.vars` is gitignored, so a fresh `git worktree add` lacks it; without it Better Auth returns 500 on /login and every authenticated spec skips. Same root cause as the line above, same fix: `pnpm worktree:bootstrap`, which copies it from the main checkout and points `APP_URL` at the port this worktree actually serves.
- `playwright.config.ts` refuses to run non-CI against ports outside 3030–3040 — that guard exists because runs have photographed the wrong worktree. Don't fight it.
- **Console noise that is not the application**: a message whose own stack frame is a Vite dev-server namespace (`/@vite/`, `/@react-refresh`, `/@id/`, `/@fs/`), and `504 (Outdated Optimize Dep)` from `/node_modules/.vite/deps/`. Neither can occur in a build and neither is a defect. `classifyConsoleMessage()` in `e2e/helpers/console-policy.ts` is the suite's own version of this judgement and is deliberately narrow — a warning the app writes itself stays fatal even when it quotes one of these. Since ADR 0016 the console is the whole net a journey casts, so that table is load-bearing: adding an entry to it removes coverage, and no entry may be something the application said.
- `pnpm check` (prettier) fails repo-wide on a few hundred pre-existing files and is deliberately **not** part of any gate. Keep the files you touch prettier-clean and never reformat the repo as a side effect. The `Edit`/`Write` hook formats what those tools touch; a file written through a shell heredoc is not covered, and hand-written markdown is never clean (prettier rewrites table padding and `*emphasis*` to `_emphasis_`) — run `pnpm exec prettier --write` on it yourself.

## Probing the running app

Driving the app by hand is how a change gets checked before it has a spec. These are the seams that make a probe lie.

- **Theme**: `page.emulateMedia({ colorScheme })` and nothing else. Do not write `data-theme` and do not drive the app's own theme control — the dark values sit behind `@media (prefers-color-scheme: dark)` guarded as `:root:not([data-theme="light"])`, so emulation is the whole job. `applyTheme()` in `e2e/helpers/routes.ts` is the reference.
- **A page with a MapLibre canvas is ready** when at least one `[data-map-ready]` marker exists and none reads `"false"`. `MapCanvas` publishes `false` from its first render. Wait again after every resize and every theme change.
- **Radix Select**: `focus()` + `Space` opens it — neither Playwright's `.click()` nor a raw `mouse.down`/`up` reliably does. Once open, Radix marks the rest of the document `aria-hidden`, so role locators stop matching the trigger; read `aria-expanded` and option counts through raw DOM queries in `page.evaluate`, never `getByRole`.
- **`getComputedStyle` read immediately after focusing or disabling a `src/components/ui` primitive returns the mid-transition value** — `transitionBase` transitions colour, background, border and outline — which reads exactly like a broken utility. Wait ~400ms before asserting a state colour.
- **vitest swallows `console.log` from a test body.** To surface a measurement, assert the value against a sentinel and read it back out of the `AssertionError`.
- **Forcing a loader's error or pending branch**: base64-decode the `/_serverFn/<id>` path segment, match the `export` name, and `route.abort()` (error) or delay before `route.continue()` (pending). A blanket abort on `**/_serverFn/**` kills `loadShell` first and lands you on the root boundary instead of the route's own. Never hand-forge the payload: it is seroval, and a fabricated `{"t":2,"s":0}` deserialises to `undefined`, which looks exactly like a broken null check. A loader only crosses the wire on a **client** navigation — a `page.goto` runs it during SSR, where `page.route` never fires. For the dashboard's empty state, pin `x-pt-server-today` far in the future instead: the rail empties honestly, with no payload surgery.
- **A form's submitting state is only observable if the endpoint is slowed** — sign-in resolves in ~120ms locally, so a click-then-read reports `disabled: false` and no spinner. `page.route(…, delay then continue)` makes it readable.
- **Locale**: for a signed-in traveller the stored preference beats `Accept-Language`, so reaching a locale in the live app means writing it through `/settings/language`. A probe that clicks a chip must `goto(…, { waitUntil: 'networkidle' })` and `scrollIntoViewIfNeeded()` first — a visible chip is not a hydrated one, the click silently reaches no handler, and `documentElement.lang` never changes. Restore the fixture (`locale-chip-workspace`) and re-read `lang` before finishing. The `(auth)` screens are the exception: they are fully server-negotiated, so one request with `Accept-Language: ar` mirrors them with no session at all.
- **Setting `document.documentElement.dir` by hand is not an RTL probe.** Radix emits its own `dir` from `DirectionProvider`, which still holds the server-negotiated direction, so the page chrome mirrors while every Radix-owned shelf, tab row and select stays LTR. Pin the real locale.
- **Per-script font checks**: `getComputedStyle(el).fontFamily` is always `Geist` here, because the `:lang()` rules re-order the *tail* of the stack. Use CDP `CSS.getPlatformFontsForNode`.
- **Measuring copy overflow** (the usual question for a translation): scan `main *, header *, nav *` for `scrollWidth > clientWidth + 1`, but filter to **leaf nodes** and to `.truncate`, and print `textContent`. Unfiltered, the count is dominated by Skeleton shimmers, whose `::before` sweep is wider than the box and moves run to run, and by seeded English data. English is not the pass mark either — it already overflows the regional Select trigger on `/settings` — so the bar is "clips no row English does not". A candidate string can be sized before it is written: sample the target element's computed style into a canvas 2d context (including `letterSpacing`, applying `textTransform` yourself) and `measureText`; the number equals the element's `scrollWidth` to the pixel.
- **All of the above are already closed by one script.** `node scripts/visual/capture.mjs --url <url> --out <dir> --label <A|B> --viewports 1440x900,360x800 --themes light,dark [--auth] [--map]` owns the theme, the map-ready wait after every resize and theme change, the motion suppression, the filename and a flat-frame check, and prints one JSON object (`requestedUrl`, `files`, `console`, `warnings`, `captureValid`) — `captureValid: false` with exit 2 means the frames are of a broken dev server, not of your change. It writes only into the directory you give it, outside the repository. `--auth` reuses the demo session and **refuses outright** — exit 2, no frame filed — in two cases where a spec would merely skip: when `e2e/.auth/demo.json` is missing (run the `setup` project first), and when the URL is a screen only a signed-out visitor ever sees, which with `--auth` would photograph the redirect target under that screen's filename. The refusal names the fix and `scripts/visual/anonymous-only.mjs` owns which screens those are (`/login` and `/register` at the time of writing, re-derived from `src/routes/(auth)/` by a unit test so the list cannot drift). Every frame also reports the URL the browser landed on, which is how a redirect that list does **not** know about — a role-gated route, say — shows up at all.

## Reading the blind pair

There is no diff view any more: `playwright-report/` carries traces and videos of failures, not
expected/actual/diff triplets. The visual judgement is `scripts/visual/capture.mjs` (last bullet above) and a
human comparing two frames, at review.

- The pair photographs **three widths across two themes**, in the state your change is about — not
  two viewports at rest, which is what the retired baselines did. Ask for the widths your change
  actually touches; `2xl:` and the `sm`..`lg` band were design zones no baseline could ever see.
- **Nothing runs it for you.** The baselines fired on every commit; this fires when somebody types
  the command. A refactor with no intended visual change is the case the baselines were best at and
  the pair is worst at, because nobody thinks to run it. If you changed a token, a shared layout or a
  dependency that renders anything, run it.
- Artefacts that are not defects, in a frame or a blind pair:
  - the mobile bottom nav is `fixed … bottom-0`, so a `fullPage` capture paints it partway down the
    image, apparently overlapping whatever is there;
  - at 360px the floating action button covers the fourth mobile-nav tab in **every** locale
    including English, so a fourth label that looks clipped is not a translation defect;
  - forcing `dir="rtl"` over English copy reorders a formatted date (`19 Aug 2026` paints as
    `Aug 2026 19`) — UAX#9 on a mixed run, which a real `ar` reader never sees;
  - page chrome and map disagreeing about the theme is a capture that changed the theme without
    waiting for the map to repaint, not a product that fails to repaint it.
