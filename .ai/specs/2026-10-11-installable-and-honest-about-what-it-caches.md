# Install planned.travel as an app, and let the browser keep its hashed assets for a year

| Field              | Value                                         |
| ------------------ | --------------------------------------------- |
| **Status**         | ready                                         |
| **Issue**          | none                                          |
| **Spec PR**        | #1158                                         |
| **Implementation** | none                                          |
| **Plan**           | 09-S4 (docs/plans/09-account-and-settings.md) |

## 📝 TLDR

Plan stage `09-S4` (`docs/plans/09-account-and-settings.md`, reference row `ACC-07`) makes planned.travel installable: a web
application manifest, an icon set, a standalone window and theme colours, so a traveller can put it on a phone's home screen or a
desktop's dock. The stage is also "honest about what it caches": `docs/ARCHITECTURE.md` §4 already lists "Browser, immutable
assets" (hashed `/assets/*` filename, 1 year, `immutable`) as a cache layer, and the platform today answers those files with its
default `max-age=0, must-revalidate`, so every repeat visit revalidates every chunk. One `public/_headers` file with one rule
gives `/assets/*` the header `Cache-Control: public, max-age=31536000, immutable` and makes the documented promise true. **No
service worker is built**, and the app is not usable offline (that is `ACC-08`, excluded in
`docs/plans/11-boundaries-and-blockers.md`).

The plan's build design does not survive the build: `vite-plugin-pwa`, added to `vite.config.ts` as the plan describes,
**generates no service worker at all** here, and a workaround precaches 563 files (~8.7 MB) on every first load (Problem
Statement). Only that `generateSW` design asked for a worker; a specialist verdict (Resolved assumption 21) replaces it with the
header file. The plan's `black-translucent` iOS status bar is dropped separately (Resolved assumption 2).

It ships as **two tickets, each a complete path**:

1. **09-S4a - installable.** `public/manifest.webmanifest`, four PNG icons drawn by a committed script from the brand mark, the
   head links and meta in `src/routes/__root.tsx`, the guard tests, and one Playwright test that the real server serves the
   manifest and the icons. Risk-low. After it, a Chromium browser is expected to offer installation; that is checked by hand
   (Visual change expected). If a browser will not offer installation without a service worker, the ticket's PR says so and the
   slicer files a separate follow-up; the second ticket does not carry that check.
2. **09-S4b - the cache header.** `public/_headers`, its guard test, the measurement of the header `/assets/*` gets today, and the
   amendment of the plan text this spec departs from. Risk-low (the rollback is deleting one file).

No schema change, no migration, no repository, no SQL, no server function, no quota, no package added or edited, no binding, no
`wrangler.jsonc` or `vite.config.ts` change, no catalogue key. `package.json` and `pnpm-lock.yaml` are not touched
(`docs/SPEC.md` §3).

This spec describes the work that is **left** at HEAD and departs from the plan wherever the build or the code contradicts it;
every departure is a row of the Resolved assumptions table. Neighbouring work is named here by what it ships, never by stage id:
the backlog reads any mention of a stage id in a spec as that stage being specified already.

## 📝 Visual change expected

Nothing changes in a browser tab, and the proof for 09-S4a is a before/after pair: `/dashboard` and `/` (the marketing landing),
light and dark, 360x800, 1280x900 and 2560x1440, taken with `scripts/visual/capture.mjs` before and after the ticket, must be
identical apart from timing. What changes is outside the tab:

- 09-S4a: the name under the home-screen icon (`planned`), the icon itself (the brand mark, four PNGs), the standalone window
  (no browser chrome), the splash and title-bar colour (`#faf9f7`), and the browser's install affordance appearing.
- 09-S4b: nothing visible, so no capture pair. Hashed scripts and styles come from the browser's HTTP cache on repeat visits
  instead of a revalidating request; the evidence is the measured `Cache-Control` (Acceptance criterion 11).

No tool in this repository can photograph an installed window. The PR for 09-S4a attaches the four icons themselves (they are
files), and records one manual check: Chrome DevTools, Application, Manifest, on a production build served locally, shows no
errors and offers "Install". The ticket that first runs it records the result in its PR. When `pnpm preview` cannot be run without
a Cloudflare login, that ticket's PR says so instead of claiming the check, the slicer files a follow-up for a manual check on
staging, and the ACC-07 row is not marked done until it passes. When a browser offers no install without a service worker, the PR
says so and does not claim installability; the slicer files a separate follow-up. Nothing in this spec is called installable in a
browser nobody has tried it in.

## 📝 Problem Statement

`public/` holds only `atlas/` (two data files). There is no manifest, no icon the platforms can read (the favicon is an inline
SVG data URL, the `FAVICON_SVG` constant in `src/routes/__root.tsx`), no apple touch icon, and no `_headers` file. `__root.tsx`
already ships half of the installable story: `application-name`, `apple-mobile-web-app-title` (`planned`), `color-scheme`, a
per-scheme `theme-color` pair (`#faf9f7` / `#121211`) and `viewport-fit=cover`; the shell pads every top edge with `pt-safe`
(`top-nav.tsx:55`, `marketing/chrome.tsx:47`, `(auth)/-ui/auth-shell.tsx:320`).

What the plan says to do, and what building it showed (two throwaway `pnpm build` runs, `vite.config.ts` reverted):

1. **The plugin generates nothing as configured.** With `VitePWA({ strategies: 'generateSW', injectRegister: false,
manifest: false, ... })` added to `plugins`, `pnpm build` exits 0, prints no `PWA v1.3.0` line and `dist/` contains no `sw.js`. The
   plugin's `closeBundle` generates only `if (!ctx.viteConfig.build.ssr)` (`node_modules/vite-plugin-pwa/dist/index.js:422`) and
   its context is overwritten by every `configResolved`; this build resolves three configs (root, `dist/client`, then the SSR
   environment with `build.ssr = true`), so the last one wins and both environments skip. A workaround (`outDir: 'dist/client'`
   plus a first-party plugin calling `api.generateSW()`) then reports `precache 563 entries (8887.43 KiB)`: every visitor would
   download ~8.7 MB in the background on first load.
2. **`apple-mobile-web-app-status-bar-style: black-translucent`** draws the page under iOS's status bar with always-white text;
   behind it is the header at `bg-canvas/85`, near-white in light theme (~1.05:1).
3. The plan's verification names `e2e/account-and-settings.visual.spec.ts`, baselines under `e2e/__screenshots__/` and
   `scripts/ultrabuild/`; none exists. ADR 0016 removed screenshot comparison, and `scripts/ultrabuild` is gone.
4. **The documented browser cache for hashed assets is not what the platform sends.** `docs/ARCHITECTURE.md` §4 (the cache-layer
   table) says "Browser, immutable assets | hashed `/assets/*` filename | 1 year, `immutable`". Workers Static Assets answers a
   file with `Cache-Control: public, max-age=0, must-revalidate` and an `ETag` unless a `_headers` file says otherwise
   (<https://developers.cloudflare.com/workers/static-assets/headers/>), and the repository has no such file. The generated
   `dist/server/wrangler.json` has `assets.directory ../client` and no `run_worker_first`, so the assets layer answers those
   requests before the Worker runs. This is the documented default, not a measurement; the 09-S4b ticket measures it first.

Kept from the plan: `docs/SPEC.md` §3 freezes `package.json`, so `vite-plugin-pwa` stays installed and unused. Not kept: any
worker. The `ACC-07` row covers installability only (`docs/plans/09-account-and-settings.md`, the "Sourced from
`wiki: Offline-Mode-and-PWA`" sentence; `docs/plans/11-boundaries-and-blockers.md`, "Hosted equivalent: ACC-07").

## 📝 Proposed Solution

### 09-S4a - installable

**`public/manifest.webmanifest`**, hand-authored (a generated manifest is one nobody reviews), served as a static asset by the
platform before the Worker runs:

| Member                            | Value                                                                                                                    |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| `name`                            | `planned.travel` (the `SITE_NAME` in `__root.tsx`)                                                                       |
| `short_name`                      | `planned` (what `apple-mobile-web-app-title` already says; `planned.travel` is truncated on home screens)                |
| `lang`                            | `en`                                                                                                                     |
| `id`, `scope`                     | `/`                                                                                                                      |
| `start_url`                       | `/dashboard` (a signed-out launch lands on `/login` through the existing guard; the marketing page is not an app start)  |
| `display`                         | `standalone`                                                                                                             |
| `theme_color`, `background_color` | `#faf9f7`                                                                                                                |
| `icons`                           | `/icons/icon-192.png` (192, `any`), `/icons/icon-512.png` (512, `any`), `/icons/icon-maskable-512.png` (512, `maskable`) |

A manifest is JSON and cannot read a CSS custom property, so `theme_color` is a literal, and a literal is guarded rather than
trusted (Acceptance criterion 3). A manifest carries one `theme_color`; the per-scheme pair already in the head is what the
browser consults while the app is open, and it follows the operating system's scheme, not the in-app theme choice (a known
limit, Risks). `orientation` is omitted on purpose: the default is `any`, and locking an orientation would fail WCAG 2.2 1.3.4
(Orientation, AA). There is no `description` member: it is optional, Chromium shows it only in its richer install sheet (which
also wants `screenshots`, not shipped), and it would put an untranslated English sentence on install surfaces in a 23-locale
product (`docs/SPEC.md` §9 rule 6). `name` and `short_name` are the brand's name. `any` and `maskable` are separate entries, never
`"any maskable"`.

**`src/routes/__root.tsx`** gains, in `links`: `{ rel: 'manifest', href: '/manifest.webmanifest', crossOrigin:
'use-credentials' }` and `{ rel: 'apple-touch-icon', href: '/icons/apple-touch-icon-180.png' }`; and in `meta`:
`{ name: 'mobile-web-app-capable', content: 'yes' }`. `crossOrigin: 'use-credentials'` because staging sits behind Cloudflare
Access (`wrangler.jsonc`): a manifest fetched without credentials is redirected to the Access login and the browser reports a
failed manifest; on production it is same-origin and the attribute makes the browser send the session cookie with a request for
a static file, which is harmless. **Not added**:
`apple-mobile-web-app-status-bar-style` (Resolved assumption 2) and `apple-mobile-web-app-capable` (Chromium reports it as
deprecated through the console, and the console is the net: any warning fails every journey, ADR 0016; iOS reads the manifest's
`display` from 16.4). The inline SVG favicon stays exactly as it is: it costs no request and never 404s; the PNGs exist for the
platforms that will not read an SVG. The existing `theme-color` pair and `viewport-fit=cover` are not touched.

**The icons**, `public/icons/`: `icon-192.png`, `icon-512.png`, `icon-maskable-512.png`, `apple-touch-icon-180.png`.
`scripts/render-app-icons.mjs` draws the mark that the inline favicon already carries (a rounded square `#16150f`, a dot and a pin
in `#f8f7f4` with a dark hole) analytically, supersamples it, and writes the PNGs with `node:zlib` only (the precedent is
`scripts/build-country-outlines.mjs`: a committed script writes a committed asset with Node built-ins; no image package may be
added). `icon-192` and `icon-512` keep the favicon's rounded corners on a transparent field; `icon-maskable-512` and
`apple-touch-icon-180` are full-bleed solid squares (a platform applies its own mask, and a transparent corner becomes black on
iOS), the mark scaled so it sits inside the centred circle of radius 40% of the icon's width, and every pixel outside that circle
is the solid `#16150f` field. `--out <dir>` (default `public/icons`) lets the test
render into a scratch directory. Re-running the script on the same Node reproduces the same pixels; it does not promise identical
bytes across Node versions (the deflate implementation differs), which is why the test compares decoded pixels.

### 09-S4b - the cache header

**`public/_headers`**, one rule and nothing else:

```
/assets/*
  Cache-Control: public, max-age=31536000, immutable
```

- **Why `/assets/*` may be called immutable.** Vite names every script and stylesheet it emits `assets/<name>-<hash>.<ext>`
  (561 `.js` and 2 `.css` in `dist/client/assets` at spec time), the hash derived from the content, so the name changes when the
  file does: the promise `docs/ARCHITECTURE.md` §4 rule 3 states ("`immutable` is a promise about the key, not the content").
  The rule matches public build output only, never a document, an `/api/` or `/_serverFn/` response or a tile.
- **It applies to the static-assets layer and nothing else.** `_headers` is applied to responses served from the asset directory,
  not to responses generated by Worker code, even when the URL matches
  (<https://developers.cloudflare.com/workers/static-assets/headers/>). A request for an `/assets/` path that is not in the
  directory (a vanished chunk) is answered by the Worker, as today, and never carries `immutable`; so are documents, API
  responses and the tile route's `206` ranges (`src/routes/api/tiles/-lib/serve.ts` sets its own headers). That is a documented
  property of the platform; nothing in this repository can run a deployed assets layer, so no test is invented and the ticket's
  measurement checks it where it can run (Acceptance criterion 11).
- **The file travels with the build.** Vite copies `public/` into `dist/client`: a throwaway `pnpm build` with the file present
  at spec time left a byte-identical `dist/client/_headers`, as `public/atlas/` already lands in `dist/client/atlas`. Under
  `vite dev` the header is not applied (the Cloudflare Vite plugin reads `public/_headers` in dev only behind its experimental
  `headersAndRedirectsDevModeSupport`, which `vite.config.ts` does not enable), so development, every capture and the e2e gate
  see no change.
- **Rollback is deleting the file.** Nothing is registered or stored by the app. A browser that holds a year-long copy holds a
  file whose name is its content hash, correct for as long as the name exists; a new deployment names new files, and a tab left
  open across one gets the same 404 for a gone chunk as today.

**The ticket first measures what `/assets/*` gets today**, before adding the file: with `pnpm preview` (or staging), `curl -sI`
one existing hashed asset and one missing path such as `/assets/missing-ABCDEFGH.js`, and record both `Cache-Control` values;
after the file, record them again. Expected: the existing asset moves from `max-age=0, must-revalidate` to
`public, max-age=31536000, immutable`; the missing path never shows `immutable`. When the ticket cannot run `pnpm preview` or reach
staging, its PR says so. The ACC-07 row's done-ness does not depend on this measurement.

**Why a header and not a worker.** The `ACC-07` row asks for installability only, and only the plan's own `generateSW` design
asked for a worker, which this spec overturns. `docs/ARCHITECTURE.md` §4 already owns "what the browser may keep of `/assets/*`";
the header makes its sentence true without a second owner of that rule, a registrar, a worker lifecycle or a kill switch. A
service worker becomes a new spec when an offline route, push or background sync is actually scheduled; none is, and none is
filed here.

## 📝 Architecture

| Concept                                                    | Owner                                                                                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| The installable identity (name, colours, start URL, icons) | `public/manifest.webmanifest`; the head links that announce it: `src/routes/__root.tsx`                                |
| The brand mark as pixels                                   | `scripts/render-app-icons.mjs` -> `public/icons/*.png`; the inline SVG favicon in `__root.tsx` is the source it copies |
| What the browser may keep of the hashed build output       | `docs/ARCHITECTURE.md` §4 (the cache-layer table) states it; `public/_headers` implements it. No other file decides it |

Seams: `public/_headers` and the Worker share nothing: the platform applies the file to the static-assets layer, before the Worker
runs, and the Worker's own responses (the tile route among them) set their own headers. `src/components/ui` is untouched; nothing
imports from `src/server`. `vite.config.ts`, `wrangler.jsonc`, `package.json` and `pnpm-lock.yaml` are not edited.
`vite-plugin-pwa` stays an installed, unused devDependency (it was unused before this stage). Removing it is a dependency edit the
freeze reserves to a person, so it is left as a follow-up for the slicer to file. `docs/ARCHITECTURE.md` §4 is not edited: its
sentence becomes true.

## 📝 Data Model

None. No table, column, migration or KV key; the stage stores nothing server-side, and nothing in the browser beyond its ordinary
HTTP cache.

## 📝 API Contracts

None: no server function, no route handler, no Zod schema (there is no input to validate and no request this stage handles).
Static contracts it adds: `GET /manifest.webmanifest` (JSON), `GET /icons/*.png` (four files), both served by Workers Static
Assets before the Worker runs; and one response header on `GET /assets/*`, `Cache-Control: public, max-age=31536000, immutable`,
applied by the same layer. Tenant isolation: no repository function is added, no row is written, nothing under
`src/server/repos` is touched, so nothing is appended to `src/server/repos/__tests__/tenant-isolation.test.ts`. The adjacent
property that would be a defect (one reader's data kept for, or shown to, the next reader of the same browser) is prevented by
construction: the header reaches public, content-hashed build files only, and never a document, an `/api/` response or a
server-function response, because those are produced by the Worker, to which `_headers` does not apply. The file's content and
the absence of unhashed files under `public/assets/` are asserted by test (Acceptance criteria 8 and 10).

## 📝 UI/UX

**No new route and no new component that draws.** The installed window opens `/dashboard` in `display: standalone`, so there is no
browser back button: the shell's own navigation (`TopNav`, `MobileNav`) is the only way around. Every route family has its own way
back (`TopNav`/`MobileNav` in the `_app` shell, `MarketingHeader` on the legal pages, and the not-found and error panels link to
`/dashboard` and `/`). Places that leave the window (Google and Apple sign-in, email links, the Polar checkout and portal, booking
links, map attribution) are the platform's behaviour and are named as a risk, not designed here. The safe-area padding on every
top edge is already in place (`pt-safe`), and the status bar uses iOS's default style, so the top inset resolves to 0 there and
nothing is padded twice. Side insets are a pre-existing gap: only the auth shell uses `px-safe`; `TopNav`, the marketing chrome
and `AppFrame` pad top and bottom only, so a notched phone held in landscape draws the shell under the sensor housing, in a
browser tab and in the installed window alike. Not fixed here; a follow-up (Follow-ups).

**There is no install button.** Browsers show their own affordance (Chromium's address-bar icon, Safari's Share sheet "Add to
Home Screen"); iOS offers no programmatic prompt at all, and a button that exists only on some engines is a second thing to keep
honest. Not built; the slicer may file it if a person wants one.

**States.** No list, no async surface, no empty, skeleton or error state of its own: that sentence is the answer, not an omission.
Motion: none added. Tokens: none missing; the two literals in the manifest and the two in the icon script are the JSON/PNG
exception argued above and are test-guarded.

## 📝 Copy

**This stage authors no catalogue key.** A web app manifest is static JSON the browser fetches before any React tree exists, so it
cannot read the catalogue, and the document head already sets its own English constants (`TITLE`, `DESCRIPTION`,
`apple-mobile-web-app-title`) the same way. The strings the stage adds, English, sentence case, `en-GB` spelling, and the only
user-visible ones:

| Where                 | Text             | Source                                    |
| --------------------- | ---------------- | ----------------------------------------- |
| manifest `name`       | `planned.travel` | `SITE_NAME`                               |
| manifest `short_name` | `planned`        | the existing `apple-mobile-web-app-title` |

No other user-facing sentence is added. The 23-locale parity test is unaffected.

## 📝 Edge Cases & Failure Scenarios

- **A file that is not content-hashed under `/assets/`.** It would be kept for a year under a name that never changes. Vite emits
  none today; one appears only through a committed file under `public/assets/` or a build option that drops the hash, and a test
  fails on both (Acceptance criterion 10).
- **A missing `/assets/` path, or a chunk gone after a deployment.** Answered by the Worker, not the static-assets layer, so the
  rule does not apply: the same 404 as today, never `immutable`.
- **`_headers` is not applied** (a platform change, a deploy path that ignores the file). The assets are served as they are
  today, revalidated on every visit; nothing breaks, and the ticket's measurement shows it.
- **Staging behind Cloudflare Access.** The manifest link carries credentials (above); hashed assets are fetched with the page's
  cookie as before.
- **A signed-out launch of the installed app.** `/dashboard` redirects to `/login` through the existing guard.
- **Opening the installed app with no connection.** The traveller sees the browser's own offline or error page, and on iOS the
  standalone window has no reload control, so closing and reopening the app is the only retry. This stage adds no offline page on
  purpose: an offline promise it cannot keep is worse than the browser's honest error.
- **Signing in with Google or Apple from the installed app** leaves the window for the provider and returns to it. Whether the
  installed app shares the browser's session on iOS was not verified (Risks).

## ✅ Acceptance criteria

09-S4a:

1. `public/manifest.webmanifest` parses as JSON with the members of the table above; `display` is `standalone`; `start_url`
   lies within `scope`; `icons` holds a `192`, a `512` and one `purpose: 'maskable'` entry; every icon `src` names a file that
   exists under `public/`; there is no `orientation` member (WCAG 2.2 1.3.4) and no `description` member.
2. The manifest's `name` equals the file's `SITE_NAME` and its `short_name` equals the `apple-mobile-web-app-title` content in
   `src/routes/__root.tsx`.
3. The manifest's `theme_color` and `background_color` equal `--color-canvas` as declared on bare `:root` in
   `src/styles/tokens.css`, and the light `theme-color` meta in `__root.tsx`.
4. `scripts/render-app-icons.mjs` run with `--out <scratch>` writes four PNGs of 192x192, 512x512, 512x512 and 180x180; the `any`
   icons have a fully transparent corner pixel and the maskable and Apple icons an opaque one; the pixel at the small dot's centre
   is `#f8f7f4` and the background `#16150f`; in the maskable and Apple icons every pixel outside the centred circle of radius
   0.4 times the width is exactly `#16150f`, so a platform mask can never clip the pin or the dot; the committed files in
   `public/icons/` decode to the same pixels as a fresh render; the script's two colours equal the favicon's in `__root.tsx`.
5. `__root.tsx`'s head contains the manifest link (with `crossOrigin: 'use-credentials'`), the Apple touch icon link and
   `mobile-web-app-capable`, and contains neither `apple-mobile-web-app-status-bar-style` nor `apple-mobile-web-app-capable`.
6. Against the real dev server, `GET /manifest.webmanifest` and each of the four icon paths answer `200`, the manifest with a JSON
   content type (the match is on `json`, so `application/manifest+json` and `application/json` both pass) and the icons
   `image/png`; `/dashboard` contains exactly one `link[rel="manifest"]`; the console stays silent. This test runs against `vite
dev`, so it cannot prove how production serves the same files; that half is `pnpm build` (AC 7) and the manual preview check
   (Visual change expected).
7. `pnpm build` output contains `manifest.webmanifest` and `icons/*.png` in `dist/client`.

09-S4b:

8. `public/_headers` exists, and a tooling test reads and parses it: exactly one rule, whose path is `/assets/*`, with exactly one
   header, `Cache-Control: public, max-age=31536000, immutable`; no other rule, header or non-comment line.
9. `pnpm build` copies it to `dist/client/_headers` (a throwaway build at spec time: byte-identical). `pnpm test` runs before
   `pnpm build` in the gate, so no test reads `dist/`; the same tooling test instead fails when `vite.config.ts` sets `publicDir`
   or `copyPublicDir` (the two ways Vite stops copying `public/`), and the ticket's PR lists `dist/client` after the gate.
10. The same tooling test fails if anything is committed under `public/assets/` (it would be copied to `dist/client/assets/`
    unhashed and get a year-long `immutable` header), or if `vite.config.ts` sets `assetsDir`, `entryFileNames`,
    `chunkFileNames` or `assetFileNames` (the options that decide whether `/assets/` names carry a hash).
11. The 09-S4b PR records the `Cache-Control` of one existing hashed asset and of one missing `/assets/` path, before and after the
    file, from `pnpm preview` or staging, or says it could not run either. After the file the existing asset reads
    `public, max-age=31536000, immutable` and the missing path does not read `immutable` (a documented property of the platform:
    `_headers` applies to the static-assets layer only). Whether the measurement ran does not decide whether the ACC-07 row is
    done.
12. The plan text is amended so no sentence still describes `generateSW`, a precache, a service worker as this stage's design or
    `black-translucent`, or calls a hand-written worker blocked: the 09-S4 block of `docs/plans/09-account-and-settings.md`
    describes no worker at all (it names `public/_headers` for the cache, drops the `vite.config.ts` edit and the registrar, and
    says `vite-plugin-pwa` stays installed and unused), its Blockers sentence included (the toolbox freeze blocks importing the
    toolbox, not an import-free script; a future worker is a new spec); the push disposition in the notification-preferences
    stage of the same file (its reasoning is corrected: `09-S4` delivers no service worker, so "a service worker with a push
    handler" stays a precondition of push without being called blocked by the toolbox freeze; push stays deferred on its other
    preconditions and no push handler is added); the sentence in `docs/plans/11-boundaries-and-blockers.md` entry 4 that says
    generating a service worker through the plugin is available (a one-line correction: it is not, in this build); the sentence
    that says the manifest's `description` reuses the `DESCRIPTION` constant (the cross-cutting note in the same file on stages
    that author no catalogue key: the manifest reuses `SITE_NAME` and the title constant, and has no `description`, with the
    reason); and the sentence that says the installability build plugin is "present already" (in
    `docs/plans/11-boundaries-and-blockers.md`: present, and unused for the reason above). `docs/ARCHITECTURE.md` is not edited.

Both tickets:

13. The gate in `validation.commands` passes on the last commit and `package.json`, `pnpm-lock.yaml`, `wrangler.jsonc` and
    `vite.config.ts` have no diff; for 09-S4a, `/dashboard` and `/` are visually unchanged (the capture pair).

## 📝 Risks & Impact Review

| Risk                                                                                                                                                                                                                                                                                                                                                                                                                        | Severity | Mitigation                                                                                                                                                                                                                 |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A file that is not content-hashed is served from `/assets/` with a year-long `immutable` header and stays stale in browsers                                                                                                                                                                                                                                                                                                 | Medium   | The rule is `/assets/*` only, where Vite emits hashed names; a test fails on a committed file under `public/assets/` and on a Vite option that drops the hash (AC 10); `docs/ARCHITECTURE.md` §4 rule 3 states the promise |
| The header reaches something that belongs to a person or a workspace and the browser keeps it                                                                                                                                                                                                                                                                                                                               | Low      | `_headers` applies to the static-assets layer only; documents, `/api/`, `/_serverFn/` and tiles are Worker responses and never match; the file holds one rule (AC 8)                                                       |
| `_headers` is not applied, or is applied to a Worker response                                                                                                                                                                                                                                                                                                                                                               | Low      | Not applied: today's revalidating behaviour, nothing breaks. Applied to a Worker response: contradicts the platform documentation; the ticket's before/after measurement of an existing and a missing path shows it        |
| iOS standalone window has no back button and no status-bar tint; the plan's `black-translucent` is dropped                                                                                                                                                                                                                                                                                                                  | Low      | The shell has its own navigation; `default` status bar keeps the clock legible in both themes. Not verified on a real iOS device, because no project in this repository runs an installed app; the PR says so              |
| Leaving the standalone window: Google and Apple sign-in, email verification, reset and invite links, the Polar checkout, portal and invoices, booking links and map attribution all hand the traveller to another page or to the system browser; on iOS the installed app may not share the browser's session, so a second sign-in is possible                                                                              | Medium   | Not designed here and not verified on a device. The slicer files a follow-up to check social sign-in and email links in an installed app on iOS and Android                                                                |
| The product already promises offline maps ("Can I use the map without a signal?", `marketing.landing.faq.offline.a`; "Download regions before you fly", `marketing.pricing.feature.solo.offlineDetail`; `settings.billing.plan.solo.feature.offline`) and no download feature exists (`offlineMaps` is only a plan flag); an installed icon invites the expectation that it works from the landing                          | Medium   | This stage adds no offline claim and no offline behaviour and does not touch that copy. The slicer files a follow-up: change the copy or build the feature                                                                 |
| Dark-theme parity: a dark-OS launch shows the manifest's single `#faf9f7` splash before the `#121211` app paints; the title and status bar follow the operating system's scheme through the `theme-color` media pair, not the traveller's in-app choice (`themeBootstrapScript` never updates that meta), so Dark chosen on a light OS gets a light bar above a dark app, more visible in a standalone window than in a tab | Low      | Named, not fixed. The slicer files a follow-up to keep `theme-color` in step with the in-app theme. The per-scheme pair is not "the source of truth for the running product"                                               |
| Landscape on a notched phone draws the shell under the sensor housing (no side safe-area padding outside the auth shell)                                                                                                                                                                                                                                                                                                    | Low      | Pre-existing, not changed by this stage; follow-up                                                                                                                                                                         |
| Icons drawn by a script look wrong                                                                                                                                                                                                                                                                                                                                                                                          | Low      | The PR attaches the four PNGs; a person judges them; the script is rerunnable and the test compares pixels, not bytes                                                                                                      |
| `name`/`short_name` in the manifest drift from `__root.tsx`                                                                                                                                                                                                                                                                                                                                                                 | Low      | AC 2 turns the test red on drift                                                                                                                                                                                           |
| Staging behind Access rejects the manifest request                                                                                                                                                                                                                                                                                                                                                                          | Low      | `crossOrigin: 'use-credentials'`                                                                                                                                                                                           |
| Backward compatibility                                                                                                                                                                                                                                                                                                                                                                                                      | None     | Additive static files and head entries in one route module; no export, route, schema, event or contract changes (`BACKWARD_COMPATIBILITY.md`)                                                                              |

## 📋 Follow-ups for the slicer

Filed as separate issues by `afk-to-tickets`, not built by either ticket:

1. Remove the unused `vite-plugin-pwa` devDependency (a dependency edit, `docs/SPEC.md` §3 reserves it to a person).
2. An install button (Chromium `beforeinstallprompt`, an instruction for iOS), if a person wants one.
3. Keep `theme-color` in step with the in-app theme choice, and revisit the single-scheme manifest splash.
4. The offline-maps promise in the marketing and billing copy: change the copy or build the feature.
5. A check, in an installed app on iOS and Android, of Google and Apple sign-in, email links, and that the session and the chosen
   language (a cookie, `src/lib/i18n/negotiate.ts`) are the browser's.
6. Side safe-area padding for `TopNav`, the marketing chrome and `AppFrame` (landscape on a notched phone). The inset values are
   physical, so the padding stays physical (`px-safe`), a stated exception to the logical-properties rule: a `ps-`/`pe-` translation
   would put the inset on the wrong side in `ar`.

## 📋 Phasing

| Ticket | Delivers                                                                         | Blocked by | Risk |
| ------ | -------------------------------------------------------------------------------- | ---------- | ---- |
| 09-S4a | Manifest, icons and their script, head links and meta, guard tests, the e2e test | none       | low  |
| 09-S4b | `public/_headers`, its guard test, the header measurement, the plan amendment    | 09-S4a     | low  |

09-S4b waits for 09-S4a because its plan amendment describes the finished stage. Each stands alone: 09-S4a is a complete,
installable app; 09-S4b makes the documented cache promise true.

## 📋 Implementation Plan

### Phase 1 - installable (09-S4a)

1. `scripts/render-app-icons.mjs` and `public/icons/*.png` (run the script, commit the output); the tooling test
   `scripts/__tests__/render-app-icons.test.mjs` (drives the script as a program, as `build-airports.test.mjs` does).
2. `public/manifest.webmanifest`.
3. `src/routes/__root.tsx`: the two links and the one meta.
4. `src/components/layout/__tests__/manifest.test.ts` (AC 1, 2, 3, 5).
5. `e2e/installable.spec.ts`, one declaration, kept to `chromium` with the `test.skip(({ browserName }) => browserName !==
'chromium', ...)` of `e2e/csrf.spec.ts:42-44` (`playwright.config.ts` adds `mobile-safari` outside pull requests, and ADR
   0022 runs `chromium` alone on them): the manifest and the four icons answer 200 with the right content types, `/dashboard` has
   one manifest link, `watchConsole` attached before navigation, no new tolerated warning. It adds to the nineteen declarations
   ADR 0016 counts. The ADR's bar is that the failure mode cannot be produced in a lower layer: here it is the browser itself
   fetching the manifest link (with credentials) and the icons through the real server and reporting any problem on the console,
   which `watchConsole` fails on; the status and content-type assertions ride in the same declaration. If headless Chromium
   reports no manifest problem on the console, the declaration does not meet the bar: the ticket drops it, keeps the unit and
   tooling tests, and its PR says so.
6. Docs grep (below), then the gate.

### Phase 2 - the cache header (09-S4b)

1. Measure first (AC 11): `Cache-Control` of an existing hashed asset and a missing `/assets/` path, before the file.
2. `public/_headers`; `scripts/__tests__/static-headers.test.mjs` (a tooling test reading `public/_headers`, the `public/assets/`
   directory and the text of `vite.config.ts`) covering AC 8 to 10. No e2e declaration: the header is not applied under `vite
dev` and a file's content is a lower-layer fact, so ADR 0016's bar is not met.
3. Measure again with the new build (AC 11); after the gate, list `dist/client` and record that `_headers` is there (AC 9).
4. Amend the plan text as AC 12 lists: `docs/plans/09-account-and-settings.md` (the 09-S4 block: `Owned paths`, the reference-row
   and `Server` paragraphs, `UI`, `Quota`, `Verification` and `Blockers`, in an `Amendment` note; the push disposition of the
   notification-preferences stage; the cross-cutting note on stages that author no catalogue key) and entry 4 and the "present
   already" sentence of `docs/plans/11-boundaries-and-blockers.md`. Neither plan file is frozen (`docs/plans/README.md`).
5. Docs grep, then the gate.

## Verification

- The gate in `validation.commands` (`.ai/agentic.config.json`) on each ticket's last commit, including `pnpm build`, after which
  the implementer lists `dist/client` and records that `manifest.webmanifest`, `icons/` and (09-S4b) `_headers` are there.
- **Unit** (`ui` project): `manifest.test.ts`. **Tooling**: `render-app-icons.test.mjs`, `static-headers.test.mjs`.
- **E2E**: one declaration in `e2e/installable.spec.ts` (09-S4a), per ADR 0016's bar; run with the full command (no script exists
  for one file, and none may be added):
  `PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/installable.spec.ts --project=chromium`, the port from
  `.ai/scripts/test-env-up.sh`, `--project=setup` first when a cached session redirects to `/login`. No `toHaveScreenshot`, no new
  baseline.
- **Review evidence**: for 09-S4a the capture pair for `/dashboard` and `/` before and after (`PT_SERVER_TODAY=2026-08-20 node
scripts/visual/capture.mjs --url "http://localhost:$PORT/dashboard" --out <dir> --label B --viewports 360x800,1280x900,2560x1440
--themes light,dark --auth`), the four icons attached to its PR, and the manual DevTools manifest check; for 09-S4b the
  before/after `Cache-Control` values.
- Docs and CI: the terms searched before each PR are "manifest", "webmanifest", "service worker", "sw.js", "PWA", "installable",
  "vite-plugin-pwa", "generateSW", "precache", "black-translucent", "ACC-07", "apple-touch-icon", "public/", "\_headers",
  "immutable" and "Cache-Control", and "install" in the message catalogue (`src/lib/i18n/messages/`). At spec time the documents
  that state these are `docs/plans/09-account-and-settings.md` (the stage block, the push disposition of the
  notification-preferences stage and the cross-cutting note on stages that author no catalogue key, all amended in 09-S4b) and
  `docs/plans/11-boundaries-and-blockers.md` (entry 4 and the "present already" sentence, corrected in 09-S4b); each is re-grepped
  as a whole before the PR, and `docs/plans/README.md` (the wave table) is unchanged. `docs/ARCHITECTURE.md` §4 (the "Browser,
  immutable assets" row at line 239, rule 3) already states the cache promise: the change makes it true and edits nothing there. A
  grep of `docs/` for "immutable" and "must-revalidate" at spec time found no sentence saying `/assets/*` is uncached or cached
  differently (the other hits are tile archives, R2 and the content studio's own keys). The catalogue's only "install" is
  `marketing.landing.faq.phone.a` ("there is nothing to install"), left as is (Resolved assumption 17).

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                                                                               | Applied default                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | What service worker, if any, does the stage ship, given the plugin generates nothing as configured and precaches 8.7 MB when forced to | Superseded by row 21: none. The first design (a hand-written, import-free `public/sw.js` with a registrar) is not built; `vite-plugin-pwa` is left installed and unused; no `vite.config.ts` change                                                                                                                                                                                                                                                                                                                                                                                                               | Decided by software architect sub-agent (confidence medium) in panel rounds 1 and 2, then overturned in the specification review (rows 21 and 22). What survives of the reasoning: both plugin routes depend on an undocumented internals workaround and the plan's glob downloads 8.7 MB on a first visit                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 2   | Which iOS status-bar style                                                                                                             | None: no `apple-mobile-web-app-status-bar-style` meta (iOS `default`); the plan's `black-translucent` is dropped                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Decided by accessibility specialist sub-agent (confidence medium): `black-translucent` always draws white glyphs over `bg-canvas/85`, near-white in light theme (~1.05:1, ~1.15:1 under the impersonation bar); the bar cannot follow the in-app `data-theme`; `default` is legible in both themes and changes nothing. Strictly iOS draws the bar, so WCAG 1.4.3 is the test of intent, not a literal clause. Not verified on a device                                                                                                                                                                                                                                                                                                                                               |
| 3   | The plan's `generateSW`, `autoUpdate`, `globPatterns`, `devOptions`                                                                    | Superseded by rows 1 and 21; not built                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Verified against the repository and by two throwaway builds: the plugin skips generation when the SSR environment resolves last, `autoUpdate` is inert with `injectRegister: false`, and the default `navigateFallback` would be wrong                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 4   | Which URLs a worker may cache, how much, and what may be stored                                                                        | Not applicable (no worker; row 21). The cache rule is the path `/assets/*`, where Vite emits content-hashed names, guarded by AC 10                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | The worker's hash pattern, 200-entry cap and store rule (panel rounds 1 and 2) went with the worker; `_headers` matches on a path, and the failure direction is the platform's own default                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| 5   | What the registrar does with a rejected registration                                                                                   | Not applicable: there is no registrar                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Row 21                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| 6   | `start_url`, `id`, `scope`, `short_name`                                                                                               | `/dashboard`, `/`, `/`, `planned`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Applied default: the marketing page is not an app start and a signed-out launch is already redirected by the guard; `planned` is what `apple-mobile-web-app-title` already says                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 7   | Manifest request credentials                                                                                                           | `crossOrigin: 'use-credentials'` on the manifest link                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Applied default: staging is behind Cloudflare Access (`wrangler.jsonc`) and an anonymous manifest fetch there is redirected and reported as failed; on production the attribute sends the session cookie with a request for a static file, which is harmless (corrected after the security and tenancy review, which found "no effect" was wrong)                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 8   | `apple-mobile-web-app-capable` and `mobile-web-app-capable`                                                                            | Only `mobile-web-app-capable: yes`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Applied default: Chromium reports the Apple name as deprecated through the console and any console warning fails every journey (ADR 0016); iOS 16.4 reads the manifest's `display`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 9   | Verification the plan wrote in pixel language                                                                                          | Unit and tooling tests, one `chromium` Playwright declaration (09-S4a), the capture pair for 09-S4a, the measured `Cache-Control` for 09-S4b, no baselines                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Verified against the repository: `scripts/ultrabuild` and `e2e/account-and-settings.visual.spec.ts` do not exist; ADR 0016 removed screenshot comparison and bars a declaration whose failure mode a lower layer reproduces; `docs/plans/12-verification-protocol.md` applies                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 10  | Slicing                                                                                                                                | Two tickets: installable, then the cache header                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Applied default: the installable half is a complete, shippable app and the header is a one-file, separately reversible change; the plan amendment describes the finished stage, so it lands with the second                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 11  | Icon bytes versus pixels                                                                                                               | The test compares decoded pixels; no cross-version byte promise                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Applied default: the script is the only encoder, but Node versions deflate differently, so a byte comparison would fail on an unrelated Node upgrade                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 12  | An install button, offline pages, push, background sync, a service worker                                                              | Not built                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Applied default: the stage is the hosted equivalent of `ACC-07` only; offline trip bundles and a change queue are excluded (`ACC-08`, `docs/plans/11-boundaries-and-blockers.md`); iOS has no programmatic prompt; a worker is a new spec when an offline route, push or background sync is scheduled                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 13  | Catalogue keys                                                                                                                         | None; the manifest strings are English constants                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Applied default: a manifest cannot read the catalogue and `__root.tsx` already holds its own English head constants                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 14  | The manifest's `description`                                                                                                           | Dropped                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Decided by accessibility specialist and traveller sub-agents (confidence medium, both): it is optional, Chromium shows it only in a richer install sheet that also wants `screenshots`, and it would be an untranslated English sentence on install surfaces in a 23-locale product (`docs/SPEC.md` §9 rule 6); `name` and `short_name` are brand marks and stay                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 15  | The manifest's `orientation`                                                                                                           | Omitted, and a test asserts it stays absent                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Decided by accessibility specialist sub-agent (confidence medium): locking an orientation fails WCAG 2.2 1.3.4 (AA)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 16  | Follow-ups that this stage names and does not build                                                                                    | Listed under Follow-ups for the slicer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Panel round 1 (product owner, traveller, accessibility): each is real, out of this slice, and a person or a later ticket owns it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 17  | The landing FAQ says "there is nothing to install"                                                                                     | Left unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Applied default (traveller sub-agent asked for the reasoning): installing is optional, nothing is downloaded to use the site, and the sentence stays true; no catalogue edit                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 18  | The plan's claim that entry 4 of the blocked register "stays true" and that any hand-written worker is blocked                         | Corrected in the plan text by the second ticket (AC 12); push stays deferred and no push handler is added                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Decided by product owner and software architect sub-agents (confidence medium): the freeze blocks importing the toolbox, not an import-free script; the register sentence about generating a worker through the plugin is disproved by the build                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 19  | Panel round 1 (product owner, software architect, security and tenancy, accessibility, traveller)                                      | All five: **approve with conditions**. Every condition applied in the commit that follows the first commit of this spec: the store rule (status, type, redirect, content type, clone, `waitUntil`), a pinned missing-asset case, spelled-out rollback, no `description`, no `orientation`, a pixel-level safe-zone check, the plan-text amendments widened, the e2e kept to `chromium`, and the leaving-the-window, offline-promise, dark-parity and notch risks. The worker-related conditions (store rule, pinned missing-asset case as a worker test, rollback) are superseded by row 21; the rest stand       | Panel verdicts recorded as `afk-plan-to-spec` § 5 requires; nobody answered revise                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 20  | Panel round 2 (product owner, software architect, security and tenancy, accessibility, traveller)                                      | Product owner, security and tenancy, accessibility, traveller: **approve** (ESCALATE no). Software architect: **approve with conditions** (the `description` sentence in the plan's cross-cutting note was missing from the amendment list), applied as a commit; two nits (the "present already" sentence, a staging check when no preview runs) and two notes (the `.js` content-type match accepts `text/javascript` and `application/javascript` with or without a charset; the physical safe-area inset) applied. The worker-related notes (the content-type match) are superseded by row 21; the rest stand | Panel verdicts recorded as `afk-plan-to-spec` § 5 requires; no standing revise                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 21  | Service worker or `public/_headers` for the cache                                                                                      | `public/_headers`, one rule giving `/assets/*` `Cache-Control: public, max-age=31536000, immutable`; no worker, registrar or `vite.config.ts` change; 09-S4b measures today's header first (AC 11)                                                                                                                                                                                                                                                                                                                                                                                                                | Decided by product-owner sub-agent (confidence high): `ACC-07` (`docs/plans/09-account-and-settings.md`, `docs/plans/11-boundaries-and-blockers.md`) covers installability only and only the plan's own `generateSW` design asked for a worker, which this spec already overturns; `docs/ARCHITECTURE.md` §4 already names "Browser, immutable assets: hashed `/assets/*` filename, 1 year, `immutable`" as a cache layer, so the file makes the documented promise true instead of adding a second owner of "what the browser may cache". It needs no registrar, hash pattern, entry cap, lifecycle handling, fake-scope tests or kill-switch worker, and is undone by deleting a file. A worker becomes a new spec only when an offline route, push or background sync is scheduled |
| 22  | Panel rounds 1 and 2 approved the worker design; what happened to it                                                                   | Overturned in the specification review (round 3 of the verdict, the PR review): the worker, its registrar and their tests are removed from the spec; the rest of both rounds stands                                                                                                                                                                                                                                                                                                                                                                                                                               | Panel verdicts record what each reviewer saw: a worker to be made safe, not whether one was needed. The review asked that question against the `ACC-07` row and the architecture document and the product owner answered it (row 21); rows 19 and 20 are kept as the record                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
