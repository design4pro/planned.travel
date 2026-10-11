# Install planned.travel as an app, with a service worker that caches only what never changes

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
desktop's dock. The stage is also "honest about what it caches": it ships a service worker, and that worker caches exactly one
thing, the content-hashed JavaScript and CSS the build already names `assets/<name>-<hash>.<ext>`, and answers no navigation, no
`/api/` request and no document. Nothing is stored that belongs to a person or a workspace, and the app is **not** usable offline
(that is `ACC-08`, excluded in `docs/plans/11-boundaries-and-blockers.md`).

The plan was written before the code and its build design does not survive contact with the build. Measured by building it (see
Problem Statement), `vite-plugin-pwa` is already a devDependency but, added to `vite.config.ts` as the plan describes, **generates
no service worker at all** in this TanStack Start + Cloudflare build, and the plan's `registerType: 'autoUpdate'` does nothing with
`injectRegister: false`. A workaround exists, but it leans on plugin internals and, with the plan's glob, precaches 563 files
(~8.7 MB) on every visitor's first load. A specialist verdict (Resolved assumption 1) replaces that with a hand-written,
import-free `public/sw.js` of about thirty lines. The plan's `black-translucent` iOS status bar is dropped for the same reason
(Resolved assumption 2): white clock text over the near-white light header.

It ships as **two tickets, each a complete path**:

1. **09-S4a - installable.** `public/manifest.webmanifest`, four PNG icons drawn by a committed script from the brand mark, the
   head links and meta in `src/routes/__root.tsx`, the guard tests, and one Playwright test that the real server serves the
   manifest and the icons. Risk-low. After it, a Chromium browser is expected to offer installation; that is checked by hand (Visual change expected) and, if a browser will not offer it without a worker, the ticket's PR says so and the check moves to the second ticket.
2. **09-S4b - the caching worker.** `public/sw.js`, the client-only registrar mounted from the root, their tests, the Playwright
   assertion that no worker is registered under `vite dev`, and the amendment of the plan text this spec departs from.
   Risk-medium (a worker that misbehaves touches every visit; the rollback is one file, Risks).

No schema change, no migration, no repository, no SQL, no server function, no quota, no package added or edited, no binding, no
`wrangler.jsonc` change, no catalogue key. `package.json` and `pnpm-lock.yaml` are not touched (`docs/SPEC.md` §3).

This spec describes the work that is **left** at HEAD and departs from the plan wherever the build or the code contradicts it;
every departure is a row of the Resolved assumptions table. Neighbouring work is named here by what it ships, never by stage id:
the backlog reads any mention of a stage id in a spec as that stage being specified already.

## 📝 Visual change expected

Nothing changes in a browser tab, and the proof is a before/after pair: `/dashboard` and `/` (the marketing landing), light and
dark, 360x800, 1280x900 and 2560x1440, taken with `scripts/visual/capture.mjs` before and after each ticket, must be identical
apart from timing. What changes is outside the tab:

- 09-S4a: the name under the home-screen icon (`planned`), the icon itself (the brand mark, four PNGs), the standalone window
  (no browser chrome), the splash and title-bar colour (`#faf9f7`), and the browser's install affordance appearing.
- 09-S4b: nothing visible. Hashed scripts and styles come from the browser's Cache API on repeat visits instead of a revalidating
  request.

No tool in this repository can photograph an installed window. The PR for 09-S4a attaches the four icons themselves (they are
files), and records one manual check: Chrome DevTools, Application, Manifest, on a production build served locally, shows no
errors and offers "Install". The ticket that first runs it records the result in its PR. When `pnpm preview` cannot be run without
a Cloudflare login, that ticket's PR says so instead of claiming the check, and the check becomes a requirement of the second
ticket's PR. When that ticket cannot run it either, the slicer files a follow-up for a manual check on staging, and the ACC-07 row
is not marked done until it passes. When a browser offers no install without a worker, the first ticket's PR says "installable once the worker ships"
and does not claim installability. Nothing in this spec is called installable in a browser nobody has tried it in.

## 📝 Problem Statement

`public/` holds only `atlas/` (two data files). There is no manifest, no icon the platforms can read (the favicon is an inline
SVG data URL, the `FAVICON_SVG` constant in `src/routes/__root.tsx`), no apple touch icon, and no service worker. `__root.tsx` already ships half of the
installable story: `application-name`, `apple-mobile-web-app-title` (`planned`), `color-scheme`, a per-scheme `theme-color` pair
(`#faf9f7` / `#121211`) and `viewport-fit=cover`; the shell pads every top edge with `pt-safe` (`top-nav.tsx:55`,
`marketing/chrome.tsx:47`, `(auth)/-ui/auth-shell.tsx:320`).

What the plan says to do, and what building it showed (two throwaway `pnpm build` runs, `vite.config.ts` reverted):

1. **The plugin generates nothing as configured.** With `VitePWA({ strategies: 'generateSW', injectRegister: false,
manifest: false, ... })` added to `plugins`, `pnpm build` exits 0, prints no `PWA v1.3.0` line and `dist/` contains no `sw.js`. The
   plugin's `closeBundle` generates only `if (!ctx.viteConfig.build.ssr)` (`node_modules/vite-plugin-pwa/dist/index.js:422`) and
   its context is overwritten by every `configResolved`; this build resolves three configs (root, `dist/client`, then the SSR
   environment with `build.ssr = true`), so the last one wins and both environments skip.
2. **A workaround generates one** (`outDir: 'dist/client'` plus a first-party plugin calling the plugin's `api.generateSW()` from
   the client environment's `closeBundle`), and then reports `precache 563 entries (8887.43 KiB)`. Every visitor, signed out on a
   phone connection included, would download ~8.7 MB in the background on first load, most of it screens they never open (the
   platform console, the atlas, maplibre at 981 KB plus its 470 KB worker).
3. **`registerType: 'autoUpdate'` is inert** with `injectRegister: false`: the plugin sets `skipWaiting`/`clientsClaim` only when
   `injectRegister` is `auto` or unset (`index.js:873-876`); the emitted worker has no `clientsClaim`.
4. **`generateSW` defaults `navigateFallback: 'index.html'`**, which would replace streamed, per-tenant documents with a shell
   that does not exist. It would have to be unset explicitly.
5. **`apple-mobile-web-app-status-bar-style: black-translucent`** draws the page under iOS's status bar with always-white text;
   behind it is the header at `bg-canvas/85`, near-white in light theme (~1.05:1).
6. The plan's verification names `e2e/account-and-settings.visual.spec.ts`, baselines under `e2e/__screenshots__/` and
   `scripts/ultrabuild/`; none exists. ADR 0016 removed screenshot comparison, and `scripts/ultrabuild` is gone.

What is true in the plan and kept: `docs/SPEC.md` §3 freezes `package.json`; the plugin's toolbox (`workbox-build`,
`workbox-window`) is transitive and not hoisted (`node_modules/workbox-build` does not exist), so nothing in `src/` or `public/`
can import it (`docs/plans/11-boundaries-and-blockers.md`, the frozen-dependency register, entry 4); `injectManifest` is therefore
impossible; the worker must never answer a navigation; `/api/tiles/*` answers `206` ranges that the Cache API cannot store and is
already cached at the edge (`src/routes/api/tiles/-lib/serve.ts`); no worker may exist under `vite dev`, which is what the e2e
gate and every capture run against.

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

### 09-S4b - the caching worker

**`public/sw.js`**, hand-written, import-free (about thirty lines, no `importScripts`), served from the site root so its scope is
`/`:

- `install` calls `skipWaiting()`; `activate` deletes every cache whose name is not the current one (`pt-assets-v1`), then
  `clients.claim()`. Taking over open tabs is safe because every version behaves the same and the cache holds only immutable files.
- `fetch` calls `respondWith` **only** when all of these hold: the method is `GET`; the request is not a navigation
  (`request.mode !== 'navigate'`) and has no `Range` header; the URL is same-origin; and the path matches
  `^/assets/.+-[A-Za-z0-9_-]{8}\.(js|css|woff2)$`, the shape of Vite's hashed output (`maplibre-gl-DBpNYYPa.js`,
  `fit-bounds-CKRTiAqP.css`). Anything else is not intercepted at all, so the browser handles it exactly as it does today. A
  build that renamed its chunks would make the pattern stop matching, and the worker would then cache nothing: the failure
  direction is "no caching", never "stale file".
- For a matching request: cache first; on a miss, fetch, and store a `response.clone()` only when `status === 200`,
  `type === 'basic'`, `redirected === false` and the `Content-Type` matches the extension (`text/javascript` or `application/javascript` for `.js`,
  `text/css` for `.css`, `font/woff2` for `.woff2`, each with or without a charset parameter; never `text/html`). The Worker answers an unknown path with its full document pipeline, and a
  redirect (an auth guard, a host redirect) can come back as a `200` HTML page; none of those may ever sit in the cache under an
  immutable-looking key. The store and the eviction run inside `event.waitUntil`: after storing, delete the oldest entries
  beyond 200 (insertion order from `cache.keys()`; a hit does not refresh the order, so a hot chunk can be evicted, which costs
  one re-fetch and is acceptable at this cap). A response that is not stored is still returned.
- Nothing under `/api/`, no `.html`, no `/_serverFn/`, no document, no cross-origin request (the font CDN included) is ever
  matched. This is what keeps streaming SSR and the tile route's `206` ranges untouched.

**`src/components/layout/service-worker.tsx`** (`ServiceWorkerRegistrar`), a client-only component that renders nothing, mounted
once in `RootDocument` beside `<AppToaster />`. Its effect does nothing unless `import.meta.env.PROD` is true and
`'serviceWorker' in navigator`; then, after `load` (immediately when the document is already complete), it calls
`navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })` and swallows a rejection. It writes nothing to
the console, with or without support. There is no client logger in the repository and a Sentry issue per private-mode browser
would be noise (Resolved assumption 5). Under `vite dev` nothing registers, which keeps every baseline-less capture, the e2e gate
and development assets clear of a cache.

The file lives in `public/` (not `src/`) because a worker script must be served at the root scope under a stable name. `public/`
is copied into `dist/client` unchanged, and the platform serves it with `cache-control: public, max-age=0, must-revalidate`; a
browser re-checks the script on navigation (`updateViaCache: 'none'` makes that explicit).

**Rollback.** Ship a `public/sw.js` whose only job is, in `activate`, to delete every cache whose name starts with `pt-` and call
`registration.unregister()`. The registrar keeps registering `/sw.js` on every load, so the replacement reaches every client on its
next visit; that it re-registers a worker which immediately unregisters is expected, and stops when the registrar is removed in a
later change. This is why the registrar is never removed before the worker is.

## 📝 Architecture

| Concept                                                    | Owner                                                                                                                  |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| The installable identity (name, colours, start URL, icons) | `public/manifest.webmanifest`; the head links that announce it: `src/routes/__root.tsx`                                |
| The brand mark as pixels                                   | `scripts/render-app-icons.mjs` -> `public/icons/*.png`; the inline SVG favicon in `__root.tsx` is the source it copies |
| What the browser may cache across visits                   | `public/sw.js`, alone. No other file decides a cache rule                                                              |
| When the worker is registered                              | `src/components/layout/service-worker.tsx`, alone                                                                      |

Seams: the registrar (React, client) and the worker (a script the browser runs) share exactly one fact, the URL `/sw.js`; the
worker and the server share none (it never sees a request the Worker would answer). `src/components/ui` is untouched; nothing
imports from `src/server`. `vite.config.ts`, `wrangler.jsonc`, `package.json` and `pnpm-lock.yaml` are not edited.
`vite-plugin-pwa` stays an installed, unused devDependency (it was unused before this stage). Removing it is a dependency edit the
freeze reserves to a person, so it is left as a follow-up for the slicer to file.

## 📝 Data Model

None. No table, column, migration or KV key; the stage stores nothing server-side. The only state is the browser's Cache API entry
`pt-assets-v1` and the worker registration, both per browser profile.

## 📝 API Contracts

None: no server function, no route handler, no Zod schema (there is no input to validate and no request this stage handles).
Static contracts it adds: `GET /manifest.webmanifest` (JSON), `GET /icons/*.png` (four files), `GET /sw.js` (JavaScript), all
served by Workers Static Assets before the Worker runs. Tenant isolation: no repository function is added, no row is written,
nothing under `src/server/repos` is touched, so nothing is appended to `src/server/repos/__tests__/tenant-isolation.test.ts`. The
adjacent property that would be a defect (one reader's data shown to the next reader of the same browser) is prevented by
construction and asserted by test: only public, content-hashed build files are cached; no navigation, no `/api/` response and no
document is ever stored (Acceptance criteria 8 and 9).

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

No other user-facing sentence is added (the registrar renders nothing and logs nothing). The 23-locale parity test is unaffected.

## 📝 Edge Cases & Failure Scenarios

- **A browser without service-worker support, a private window, an enterprise policy that blocks workers, an insecure context.**
  The registrar does nothing or its rejected registration is swallowed; the app is exactly what it is today.
- **Registration happens on the first visit.** The worker controls pages only from the next load (`clients.claim()` takes the
  already-open tab as well). Nothing depends on the first load being cached.
- **A deployment while a tab is open.** The new worker activates (`skipWaiting`) and deletes any cache not named `pt-assets-v1`.
  The open tab keeps requesting hashed chunks; a chunk that no longer exists on the server is a 404 today and stays one (the cache
  may even still hold it). Nothing new fails.
- **A response that is not `200`** (a `404` for a vanished chunk, a `206`, a redirect, an opaque cross-origin response) is returned
  and never stored.
- **Storage pressure or Safari clearing script-writable storage after seven idle days.** The cache is rebuilt from the network;
  nothing is lost that was not re-fetchable.
- **The cache grows.** Past 200 entries the oldest are deleted on each store. Hashed chunks from old deployments age out that way.
- **A signed-out launch of the installed app.** `/dashboard` redirects to `/login` through the existing guard.
- **Opening the installed app with no connection.** The traveller sees the browser's own offline or error page, and on iOS the
  standalone window has no reload control, so closing and reopening the app is the only retry. This stage adds no offline page on
  purpose: nothing it caches can render a document, and an offline promise it cannot keep is worse than the browser's honest
  error.
- **Signing in with Google or Apple from the installed app** leaves the window for the provider and returns to it. Whether the
  installed app shares the browser's session on iOS was not verified (Risks).
- **Staging behind Cloudflare Access.** The manifest link carries credentials (above); `/sw.js` is fetched by the page with its
  cookie. If a person is not signed in to Access, nothing loads at all, with or without this stage.
- **`vite dev`.** `public/sw.js` is served by Vite as a plain file; nothing registers it (`import.meta.env.PROD` is false).
- **A worker script that throws or fails to parse.** The browser keeps the previous worker or none; the page is unaffected.

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

8. `public/sw.js` evaluated against a fake worker scope: a navigation request, a non-`GET` request, a request with a `Range`
   header, a cross-origin request, `/api/tiles/x`, `/_serverFn/x`, `/dashboard`, `/index.html` and `/assets/app.js` (no hash) are
   **never** passed to `respondWith`; `/assets/maplibre-gl-DBpNYYPa.js`, `/assets/fit-bounds-CKRTiAqP.css` and
   `/assets/x-CZMhIkTN.js` are.
9. For a matching request: a cache hit returns the stored response without calling `fetch`; a miss calls `fetch` once and stores
   the response only when its status is `200`, its type `basic`, it was not `redirected` and its `Content-Type` matches the
   extension (a `206`, a `404`, an opaque response, a redirected `200`, and a `200` `text/html` for a matching path are returned
   and not stored); the stored value is a clone; the store and the eviction run inside `event.waitUntil`; a rejected `fetch`
   rejects the request's promise (no fabricated response); after storing, the cache never holds more than 200 entries and the
   oldest is the one removed.
10. `activate` deletes every cache named other than `pt-assets-v1` and calls `clients.claim()`; `install` calls `skipWaiting()`.
11. `ServiceWorkerRegistrar` renders nothing; does not call `register` when `import.meta.env.PROD` is false or `serviceWorker` is
    absent from `navigator`; registers `/sw.js` with `{ scope: '/', updateViaCache: 'none' }` after `load` otherwise; a rejected
    registration produces no unhandled rejection and no console output; unmounting before `load` removes the listener.
12. Under `vite dev`, `navigator.serviceWorker.getRegistrations()` is empty and `controller` is `null` after `/dashboard` settles
    (Playwright), `GET /sw.js` answers `200` with a JavaScript content type, and `GET /assets/missing-ABCDEFGH.js` does not
    answer `200` (the fall-through the store rule relies on, pinned against the real server). Production serving of `/sw.js` is
    not provable in the dev server; it is `pnpm build` (AC 13) and the manual preview check.
13. `pnpm build` output contains `sw.js` in `dist/client`. The plan text is amended so no sentence still describes `generateSW`,
    a precache or `black-translucent` as the design, or calls a hand-written worker blocked: the stage block itself, the sentence
    in its Blockers, the push disposition in the notification-preferences stage of the same file (its reasoning is corrected,
    push stays deferred on its other preconditions, and no push handler is added to `public/sw.js`), and the sentence in
    `docs/plans/11-boundaries-and-blockers.md` entry 4 that says generating a service worker through the plugin is available (a
    one-line correction: it is not, in this build, and the toolbox freeze forbids importing it, not writing an import-free
    script), and the sentences that say the manifest's `description` reuses the `DESCRIPTION` constant (the cross-cutting note in
    the same file on stages that author no catalogue key: the manifest reuses `SITE_NAME` and the title constant, and has no
    `description`, with the reason) and that the installability build plugin is "present already" (in
    `docs/plans/11-boundaries-and-blockers.md`: present, and unused for the reason above).
14. Both tickets: the gate in `validation.commands` passes on the last commit, `package.json` and `pnpm-lock.yaml` have no diff,
    and `/dashboard` and `/` are visually unchanged (the capture pair).

## 📝 Risks & Impact Review

| Risk                                                                                                                                                                                                                                                                                                                                                                                                                        | Severity | Mitigation                                                                                                                                                                                                    |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A worker bug serves a wrong file to every visitor                                                                                                                                                                                                                                                                                                                                                                           | Medium   | Cache-first only for hashed, immutable URLs; any other request is not intercepted; the matcher fails towards "no caching"; the kill-switch worker (one file) reaches clients through the registrar            |
| A cache outlives a session and shows one tenant's data to the next reader of the browser                                                                                                                                                                                                                                                                                                                                    | Low      | Only public build files are stored; no document, no `/api/`, no `/_serverFn/`, no cross-origin response; asserted by AC 8 and 9                                                                               |
| The strict hash pattern stops matching after a Vite upgrade                                                                                                                                                                                                                                                                                                                                                                 | Low      | Fails safe (nothing cached). A test pins the shapes measured today, so an upgrade that changes them turns the test red rather than silently dropping the benefit                                              |
| `skipWaiting`/`clients.claim` replace the worker under an open tab                                                                                                                                                                                                                                                                                                                                                          | Low      | Every version has the same behaviour and the cache holds immutable files                                                                                                                                      |
| iOS standalone window has no back button and no status-bar tint; the plan's `black-translucent` is dropped                                                                                                                                                                                                                                                                                                                  | Low      | The shell has its own navigation; `default` status bar keeps the clock legible in both themes. Not verified on a real iOS device, because no project in this repository runs an installed app; the PR says so |
| Leaving the standalone window: Google and Apple sign-in, email verification, reset and invite links, the Polar checkout, portal and invoices, booking links and map attribution all hand the traveller to another page or to the system browser; on iOS the installed app may not share the browser's session, so a second sign-in is possible                                                                              | Medium   | Not designed here and not verified on a device. The slicer files a follow-up to check social sign-in and email links in an installed app on iOS and Android                                                   |
| The product already promises offline maps ("Can I use the map without a signal?", `marketing.landing.faq.offline.a`; "Download regions before you fly", `marketing.pricing.feature.solo.offlineDetail`; `settings.billing.plan.solo.feature.offline`) and no download feature exists (`offlineMaps` is only a plan flag); an installed icon invites the expectation that it works from the landing                          | Medium   | This stage adds no offline claim and no offline behaviour and does not touch that copy. The slicer files a follow-up: change the copy or build the feature                                                    |
| Dark-theme parity: a dark-OS launch shows the manifest's single `#faf9f7` splash before the `#121211` app paints; the title and status bar follow the operating system's scheme through the `theme-color` media pair, not the traveller's in-app choice (`themeBootstrapScript` never updates that meta), so Dark chosen on a light OS gets a light bar above a dark app, more visible in a standalone window than in a tab | Low      | Named, not fixed. The slicer files a follow-up to keep `theme-color` in step with the in-app theme. The per-scheme pair is not "the source of truth for the running product"                                  |
| Landscape on a notched phone draws the shell under the sensor housing (no side safe-area padding outside the auth shell)                                                                                                                                                                                                                                                                                                    | Low      | Pre-existing, not changed by this stage; follow-up                                                                                                                                                            |
| Icons drawn by a script look wrong                                                                                                                                                                                                                                                                                                                                                                                          | Low      | The PR attaches the four PNGs; a person judges them; the script is rerunnable and the test compares pixels, not bytes                                                                                         |
| `name`/`short_name` in the manifest drift from `__root.tsx`                                                                                                                                                                                                                                                                                                                                                                 | Low      | AC 2 turns the test red on drift                                                                                                                                                                              |
| Staging behind Access rejects the manifest request                                                                                                                                                                                                                                                                                                                                                                          | Low      | `crossOrigin: 'use-credentials'`                                                                                                                                                                              |
| Backward compatibility                                                                                                                                                                                                                                                                                                                                                                                                      | None     | Additive static files and one root component; no export, route, schema, event or contract changes (`BACKWARD_COMPATIBILITY.md`)                                                                               |

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

| Ticket | Delivers                                                                         | Blocked by | Risk   |
| ------ | -------------------------------------------------------------------------------- | ---------- | ------ |
| 09-S4a | Manifest, icons and their script, head links and meta, guard tests, the e2e test | none       | low    |
| 09-S4b | `public/sw.js`, the registrar and its mount, their tests, the plan amendment     | 09-S4a     | medium |

09-S4b waits for 09-S4a only because both edit `src/routes/__root.tsx` (head in one, body in the other) and the tickets are built
one at a time. Each stands alone: 09-S4a is a complete, installable app; 09-S4b adds the cache.

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
   ADR 0016 counts; the failure mode (static asset serving and head rendering through the real pipeline) cannot be produced below
   the browser, which is that ADR's bar.
6. Docs grep (below), then the gate.

### Phase 2 - the caching worker (09-S4b)

1. `public/sw.js`; `src/components/layout/__tests__/service-worker-script.test.ts` reads `public/sw.js`, evaluates it against a
   fake scope with an in-memory `caches`, and covers AC 8 to 10 (a `// @vitest-environment node` docblock keeps `Request` and
   `Response` Node's own). If `pnpm lint` objects to the worker globals in `public/sw.js`, fix it in the file (a declaration
   comment); adding it to `.oxlintrc.json`'s `ignorePatterns` also means updating `lint-ignores.test.ts`.
2. `src/components/layout/service-worker.tsx` and `src/components/layout/__tests__/service-worker.test.tsx` (AC 11); mount in
   `RootDocument`.
3. `e2e/installable.spec.ts`: a second declaration (same `chromium` skip) for AC 12.
4. Amend the plan text as AC 13 lists: `docs/plans/09-account-and-settings.md` (the 09-S4 block: `Owned paths`, `UI`,
   `Verification`, `Blockers`, in an `Amendment` note; the push disposition of the notification-preferences stage; the
   cross-cutting note on stages that author no catalogue key) and entry 4 and the "present already" sentence of
   `docs/plans/11-boundaries-and-blockers.md`. Neither plan file is frozen (`docs/plans/README.md`).
5. Docs grep, then the gate.

## Verification

- The gate in `validation.commands` (`.ai/agentic.config.json`) on each ticket's last commit, including `pnpm build`, after which
  the implementer lists `dist/client` and records that `manifest.webmanifest`, `icons/` and (09-S4b) `sw.js` are there.
- **Unit** (`ui` project): `manifest.test.ts`, `service-worker-script.test.ts`, `service-worker.test.tsx`. **Tooling**:
  `render-app-icons.test.mjs`.
- **E2E**: two declarations in `e2e/installable.spec.ts` (one per ticket), per ADR 0016's bar; run with the full command (no script exists for one
  file, and none may be added):
  `PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test e2e/installable.spec.ts --project=chromium`, the port from
  `.ai/scripts/test-env-up.sh`, `--project=setup` first when a cached session redirects to `/login`. No `toHaveScreenshot`, no new
  baseline.
- **Review evidence**: the capture pair for `/dashboard` and `/` before and after each ticket (`PT_SERVER_TODAY=2026-08-20 node
scripts/visual/capture.mjs --url "http://localhost:$PORT/dashboard" --out <dir> --label B --viewports 360x800,1280x900,2560x1440
--themes light,dark --auth`), the four icons attached to the 09-S4a PR, and the manual DevTools manifest check.
- Docs and CI: the terms searched before each PR are "manifest", "webmanifest", "service worker", "sw.js", "PWA", "installable",
  "vite-plugin-pwa", "generateSW", "precache", "black-translucent", "ACC-07", "apple-touch-icon", "public/", and "install" in the
  message catalogue (`src/lib/i18n/messages/`). At spec time the documents that state these are
  `docs/plans/09-account-and-settings.md` (the stage block, the push disposition of the notification-preferences stage and the
  cross-cutting note on stages that author no catalogue key, all amended in 09-S4b), `docs/plans/11-boundaries-and-blockers.md`
  (entry 4 and the "present already" sentence, corrected in 09-S4b); each document is re-grepped as a whole for "manifest",
  "service worker" and "sw.js" before the PR and `docs/plans/README.md` (the
  wave table, unchanged); `docs/SPEC.md` names none. The catalogue's only "install" is `marketing.landing.faq.phone.a` ("there is
  nothing to install"), left as is (Resolved assumption 17).

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                                                                               | Applied default                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| --- | -------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | What service worker, if any, does the stage ship, given the plugin generates nothing as configured and precaches 8.7 MB when forced to | A hand-written, import-free `public/sw.js`: cache-first for same-origin hashed `/assets/` files only, `200`/`basic` only, 200-entry cap, no navigation and no `/api/` ever intercepted; `vite-plugin-pwa` left installed and unused; no `vite.config.ts` change                                                                                                                                                                                                                                                       | Decided by software architect sub-agent (confidence medium): both plugin routes depend on an undocumented internals workaround and the plan's glob downloads 8.7 MB on a first visit; the hand-written file needs no build hack, adds nothing to `package.json`, keeps every invariant of the plan and is reversed by deleting one file and shipping a self-unregistering worker once. Medium only because the browsers' current install criteria for a worker were not verifiable here, which does not change the choice |
| 2   | Which iOS status-bar style                                                                                                             | None: no `apple-mobile-web-app-status-bar-style` meta (iOS `default`); the plan's `black-translucent` is dropped                                                                                                                                                                                                                                                                                                                                                                                                      | Decided by accessibility specialist sub-agent (confidence medium): `black-translucent` always draws white glyphs over `bg-canvas/85`, near-white in light theme (~1.05:1, ~1.15:1 under the impersonation bar); the bar cannot follow the in-app `data-theme`; `default` is legible in both themes and changes nothing. Strictly iOS draws the bar, so WCAG 1.4.3 is the test of intent, not a literal clause. Not verified on a device                                                                                   |
| 3   | The plan's `generateSW`, `autoUpdate`, `globPatterns`, `devOptions`                                                                    | Superseded by row 1; not built                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Verified against the repository and by two throwaway builds: the plugin skips generation when the SSR environment resolves last, `autoUpdate` is inert with `injectRegister: false`, and the default `navigateFallback` would be wrong                                                                                                                                                                                                                                                                                    |
| 4   | Which URLs the worker may cache, how much, and what may be stored                                                                      | Pattern `^/assets/.+-[A-Za-z0-9_-]{8}\.(js\|css\|woff2)$`, cap 200 entries, oldest first; a response is stored only when it is `200`, `basic`, not `redirected`, and its `Content-Type` matches the extension                                                                                                                                                                                                                                                                                                         | Applied default, tightened by the panel (security and tenancy, software architect): Vite's output naming measured today (561 `.js`, 2 `.css`, 8-character hashes); a stricter-than-prefix pattern fails towards "no caching"; the Worker answers an unknown path with its document pipeline, so a redirect or an HTML page for a vanished chunk must never be stored under an immutable key; a reader touches tens of chunks, so 200 holds several deployments' worth                                                     |
| 5   | What the registrar does with a rejected registration                                                                                   | Swallows it, silently                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Applied default: the plan asked for a structured log, but the repository has no client logger, a Sentry issue per private-mode or policy-blocked browser is noise, and the reader can do nothing about it; a broken worker file is caught by the build assertion and the unit tests, not by telemetry                                                                                                                                                                                                                     |
| 6   | `start_url`, `id`, `scope`, `short_name`                                                                                               | `/dashboard`, `/`, `/`, `planned`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | Applied default: the marketing page is not an app start and a signed-out launch is already redirected by the guard; `planned` is what `apple-mobile-web-app-title` already says                                                                                                                                                                                                                                                                                                                                           |
| 7   | Manifest request credentials                                                                                                           | `crossOrigin: 'use-credentials'` on the manifest link                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Applied default: staging is behind Cloudflare Access (`wrangler.jsonc`) and an anonymous manifest fetch there is redirected and reported as failed; on production the attribute sends the session cookie with a request for a static file, which is harmless (corrected after the security and tenancy review, which found "no effect" was wrong)                                                                                                                                                                         |
| 8   | `apple-mobile-web-app-capable` and `mobile-web-app-capable`                                                                            | Only `mobile-web-app-capable: yes`                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    | Applied default: Chromium reports the Apple name as deprecated through the console and any console warning fails every journey (ADR 0016); iOS 16.4 reads the manifest's `display`                                                                                                                                                                                                                                                                                                                                        |
| 9   | Verification the plan wrote in pixel language                                                                                          | Unit and tooling tests, two `chromium` Playwright declarations (one per ticket), the capture pair, no baselines                                                                                                                                                                                                                                                                                                                                                                                                       | Verified against the repository: `scripts/ultrabuild` and `e2e/account-and-settings.visual.spec.ts` do not exist; ADR 0016 removed screenshot comparison; `docs/plans/12-verification-protocol.md` applies                                                                                                                                                                                                                                                                                                                |
| 10  | Slicing                                                                                                                                | Two tickets: installable, then the cache                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | Applied default: the worker is the only risky part and is reversible on its own; the installable half is a complete, shippable app; the order follows the shared edit of `__root.tsx`                                                                                                                                                                                                                                                                                                                                     |
| 11  | Icon bytes versus pixels                                                                                                               | The test compares decoded pixels; no cross-version byte promise                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Applied default: the script is the only encoder, but Node versions deflate differently, so a byte comparison would fail on an unrelated Node upgrade                                                                                                                                                                                                                                                                                                                                                                      |
| 12  | An install button, offline pages, push, background sync                                                                                | Not built                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Applied default: the stage is the hosted equivalent of `ACC-07` only; offline trip bundles and a change queue are excluded (`ACC-08`, `docs/plans/11-boundaries-and-blockers.md`); iOS has no programmatic prompt                                                                                                                                                                                                                                                                                                         |
| 13  | Catalogue keys                                                                                                                         | None; the manifest strings are English constants                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Applied default: a manifest cannot read the catalogue and `__root.tsx` already holds its own English head constants                                                                                                                                                                                                                                                                                                                                                                                                       |
| 14  | The manifest's `description`                                                                                                           | Dropped                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Decided by accessibility specialist and traveller sub-agents (confidence medium, both): it is optional, Chromium shows it only in a richer install sheet that also wants `screenshots`, and it would be an untranslated English sentence on install surfaces in a 23-locale product (`docs/SPEC.md` §9 rule 6); `name` and `short_name` are brand marks and stay                                                                                                                                                          |
| 15  | The manifest's `orientation`                                                                                                           | Omitted, and a test asserts it stays absent                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Decided by accessibility specialist sub-agent (confidence medium): locking an orientation fails WCAG 2.2 1.3.4 (AA)                                                                                                                                                                                                                                                                                                                                                                                                       |
| 16  | Follow-ups that this stage names and does not build                                                                                    | Listed under Follow-ups for the slicer                                                                                                                                                                                                                                                                                                                                                                                                                                                                                | Panel round 1 (product owner, traveller, accessibility): each is real, out of this slice, and a person or a later ticket owns it                                                                                                                                                                                                                                                                                                                                                                                          |
| 17  | The landing FAQ says "there is nothing to install"                                                                                     | Left unchanged                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | Applied default (traveller sub-agent asked for the reasoning): installing is optional, nothing is downloaded to use the site, and the sentence stays true; no catalogue edit                                                                                                                                                                                                                                                                                                                                              |
| 18  | The plan's claim that entry 4 of the blocked register "stays true" and that any hand-written worker is blocked                         | Corrected in the plan text by the second ticket (AC 13); push stays deferred and no push handler is added                                                                                                                                                                                                                                                                                                                                                                                                             | Decided by product owner and software architect sub-agents (confidence medium): the freeze blocks importing the toolbox, not an import-free script; the register sentence about generating a worker through the plugin is disproved by the build                                                                                                                                                                                                                                                                          |
| 19  | Panel round 1 (product owner, software architect, security and tenancy, accessibility, traveller)                                      | All five: **approve with conditions**. Every condition applied in the commit that follows the first commit of this spec: the store rule (status, type, redirect, content type, clone, `waitUntil`), a pinned missing-asset case, spelled-out rollback, no `description`, no `orientation`, a pixel-level safe-zone check, the plan-text amendments widened, the e2e kept to `chromium`, and the leaving-the-window, offline-promise, dark-parity and notch risks                                                      | Panel verdicts recorded as `afk-plan-to-spec` § 5 requires; nobody answered revise                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| 20  | Panel round 2 (product owner, software architect, security and tenancy, accessibility, traveller)                                      | Product owner, security and tenancy, accessibility, traveller: **approve** (ESCALATE no). Software architect: **approve with conditions** (the `description` sentence in the plan's cross-cutting note was missing from the amendment list), applied as a commit; two nits (the "present already" sentence, a staging check when no preview runs) and two notes (the `.js` content-type match accepts `text/javascript` and `application/javascript` with or without a charset; the physical safe-area inset) applied | Panel verdicts recorded as `afk-plan-to-spec` § 5 requires; no standing revise                                                                                                                                                                                                                                                                                                                                                                                                                                            |
