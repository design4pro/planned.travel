# Turn two-factor on from settings, instead of being sent to the sign-in challenge

| Field              | Value                                         |
| ------------------ | --------------------------------------------- |
| **Status**         | ready                                         |
| **Issue**          | none                                          |
| **Spec PR**        | none                                          |
| **Implementation** | none                                          |
| **Plan**           | 09-S2 (docs/plans/09-account-and-settings.md) |

## 📝 TLDR

Plan stage `09-S2` (`docs/plans/09-account-and-settings.md`, reference row `ACC-02`) repairs a dead affordance. On
`/settings/security` the two-factor row says "Turn on" and links to `/two-factor`, which is the **sign-in challenge**
(`src/routes/(auth)/two-factor.tsx`): it asks a signed-in person for a code from an authenticator they have never enrolled. The
server half is finished (the `twoFactor()` plugin is configured, the browser client carries `twoFactorClient()`), and nothing in
`src/` calls an enrolment endpoint. This stage gives the destination a real screen, `/settings/two-factor`, and teaches
`/two-factor` to send a fully signed-in visitor there. It ships as **four tickets, each a full path from the library call to the
screen or, for the first, to a test through the real auth handler**:

1. **09-S2a - refuse a re-enrolment that would destroy a working second factor.** A server-side `hooks.before` on
   `POST /two-factor/enable`. The library overwrites the secret and the backup codes of an account that already has the factor on
   and keeps it marked verified, so the person's authenticator stops matching and no self-service way back exists. The endpoint is
   live today. Risk-high (authentication).
2. **09-S2b - turn two-factor on, see that it is on, replace the backup codes, turn it off.** The route, the redirect, the
   three-step enrolment with the **typed** key, the one-time backup-code panel, the "on" status view, "Replace backup codes" and
   "Turn off" with the password, the honest "set a password first" panel, and the journey for the two redirects. Risk-high.
3. **09-S2c - add it to another device.** "Show setup key again", asking for the password again and reusing the key display the
   previous ticket built.
4. **09-S2d - a scannable code.** A hand-rolled matrix-code encoder (the dispositioned exception to the dependency freeze) and the
   rendering of its output inside the one key display, so it appears wherever the key does.

No schema change, no migration, no repository, no SQL, no quota, no package added, no binding. The two-factor rows are written
entirely by the library's own adapter calls and are keyed on the user, not on a workspace.

**Reference row `ACC-02` stays `partial` (`partial` to `partial`).** The reference product's behaviour is "turn off by proving the
password **and** a current code" and "show the backup codes you already have". The installed library supports neither from the
browser (Resolved assumption 1), so this stage ships turn-off by password and a replace-not-show backup-code flow. Turn-off with a
code is deferred as a security decision, and the rest is filed as follow-ups.

This spec describes the work that is **left** at HEAD. It departs from the plan's stage block wherever the code the plan cites has
moved or the library behaves otherwise than the plan assumed; every departure is a row of the Resolved assumptions table.
Neighbouring work is named here by what it ships, never by stage id: the backlog reads any mention of a stage id in a spec as that
stage being specified already.

## 📝 Visual change expected

`/settings/two-factor` (new), light and dark, 360x800, 1280x900 and 2560x1440:

- 09-S2b: the screen with two-factor off, step 1 (password) empty, with a field error, and busy; step 2 (typed key, "not on yet"
  notice); step 3 (code) empty, with a field error and busy; the rate-limited state (429) at step 1 and at step 3; the backup-code
  panel with the acknowledgement unticked and ticked; the "on" status view with its two actions; the replace-backup-codes and
  turn-off dialogs empty, with a password error, and busy; the replaced backup-code panel; the "set a password first" panel; the
  "already on" view; the route's loading skeleton; the route's error state; the screen in a non-English locale and in Arabic
  (right-to-left).
- 09-S2c: the "on" view with the third action, the password dialog, the setup key shown again.
- 09-S2d: the key display with the matrix beside the typed key at each width, in the enrolment step and in the setup-key view; the
  same display with an input too long for the encoder (typed key only, with the explanatory line).
- `/two-factor` (the sign-in challenge) does not change by a pixel for a visitor without a session.
- `/settings/security` does not change by a pixel except one sentence: the "on" hint (Resolved assumption 9).

## 📝 Problem Statement

### What a person meets today

1. Settings > Security shows "Two-factor authentication: Off" and a "Turn on" button (`src/routes/_app/settings/security.tsx`). The
   button is a plain anchor to `/two-factor`.
2. `/two-factor` asks for "a code from your authenticator app" and offers a backup-code tab. The person has no authenticator entry
   to read a code from, and no way to make one: **no screen in the product starts an enrolment**.
3. With two-factor already on, "Manage" goes to the same screen, which asks for a code and then hands off to `/dashboard`.

The `auth` routes are complete and are not wrong; the link is. The repair convention the plan adopts is to fix the **destination**:
`/two-factor` learns that a fully signed-in visitor wants enrolment and redirects, so `security.tsx` is not edited here.

### The plan's claims, checked against the repository and the installed library

Measured at HEAD with better-auth 1.7.1 (`node_modules/better-auth/dist/plugins/two-factor/`):

| Plan claim                                                                                     | What is true                                                                                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `enable` is a two-step handshake and abandoning it cannot lock anyone out                      | **True for a new enrolment.** `enable` writes the encrypted secret and codes and returns `{ totpURI, backupCodes }`; `twoFactorEnabled` flips on the first valid `verify-totp`; a sign-in against an unverified secret is refused.                                                                                                                  |
| (not stated)                                                                                   | **`enable` on an account that is already on overwrites the secret and the codes and keeps `verified: true`** (`index.mjs` `verified: existingTwoFactor.verified === true \|\| ...`). The old authenticator entry dies at once. Nothing server-side prevents it. This is the reason for 09-S2a.                                                      |
| The enrolment endpoints fall under the global 100 per minute rule                              | **False.** The plugin declares `/two-factor/*` at **3 requests per 10 seconds** per IP and path; `src/server/auth/index.ts` overrides only `verify-totp` (10 per minute) and `verify-backup-code` (5 per 5 minutes). `enable`, `get-totp-uri`, `generate-backup-codes` and `disable` are 3 per 10 seconds, and the 429 carries `X-Retry-After: 10`. |
| The 8-attempt lockout bounds the screen                                                        | **Sign-in only.** The lockout and the per-challenge attempt counter run only on a sign-in verification. A wrong code at the enrolment confirm is limited only by the 10-per-minute rule.                                                                                                                                                            |
| "Show recovery codes", password-gated                                                          | **Not possible from the browser.** No endpoint returns an existing set (it is stored encrypted; `viewBackupCodes` is server-only and checks no password). `generate-backup-codes` returns a **new** set and invalidates the old one, and requires the factor to be on.                                                                              |
| An "empty" state when no recovery codes were ever generated                                    | **Unreachable as described.** `enable` always generates ten. A set runs out only as codes are spent at sign-in, and the browser cannot learn how many are left.                                                                                                                                                                                     |
| Turn off by "the password and a current code"                                                  | **Password only.** `disable` takes `{ password }`, deletes the row, sets the flag false and replaces **only the current session**.                                                                                                                                                                                                                  |
| A fifteen-minute server enrolment window; the screen expires the secret it shows after fifteen | **There is no server window**; the secret is durable from `enable`. A browser timer protects nothing the library does not already (Resolved assumption 3).                                                                                                                                                                                          |
| Password re-entry is the re-authentication                                                     | **True, and it excludes accounts with no password.** `allowPasswordless` is not set, so all four password-gated endpoints check the account's _credential_ row. A Google- or Apple-only account (social sign-in and account linking are on) is told its password is wrong.                                                                          |
| (not stated)                                                                                   | **The code is asked only after email-and-password sign-in** (the plugin's hook matches `/sign-in/email`, `/sign-in/username`, `/sign-in/phone-number`). Google, Apple and passkey sign-ins never ask for it. The existing hint "A code from your authenticator app is required on every new sign-in" is therefore untrue for them.                  |
| `twoFactor()` is configured at `src/server/auth/index.ts:222-232`                              | Moved: it is at `:421-430` today. Digits 6, period 30, ten backup codes of length 10, lockout 8 attempts / 900 s. Unchanged otherwise.                                                                                                                                                                                                              |
| Verification: `scripts/ultrabuild`, `e2e/account-and-settings.visual.spec.ts`, pixel baselines | **History.** ADR 0016 removed screenshot comparison; `scripts/ultrabuild` is gone. The gate is `validation.commands`; Playwright keeps only what a lower layer cannot produce (routing, sessions, hydration); visual judgement is the blind A/B pair from `scripts/visual/capture.mjs`.                                                             |
| New keys are authored in `en` only; the 22 other locales belong to a translation item          | **Stale.** The rule now (`AGENTS.md`, `i18n-messages`) is that a new `en` key lands in all 23 locale files in the same change.                                                                                                                                                                                                                      |
| The term is "recovery codes"                                                                   | The sign-in screen already says **"backup code"** (`auth.twoFactor.backup.*`). One thing gets one name (`docs/SPEC.md` §8): this stage says "backup codes" everywhere.                                                                                                                                                                              |

The consequence for the design is that the stage is smaller on the manage side than the plan, and larger on the safety side.

## 📝 Proposed Solution

### What the stage owns and what it does not

**Owns** (by ticket):

- 09-S2a: `src/server/auth/two-factor-guard.ts` (new; the owner of "when may `enable` run"), the `hooks.before` wiring in
  `src/server/auth/index.ts` (the one edit in that file), its test under `src/server/auth/__tests__/`, the refusal's error code in
  `src/routes/(auth)/-lib/errors.ts` and its two `auth.error.*` keys in all 23 locales.
- 09-S2b: `src/routes/_app/settings/two-factor.tsx` (route), `src/routes/_app/settings/-ui/two-factor-*.tsx` (components, among
  them `TwoFactorKey`, **the one key display**: typed key, copy, open-in-app link, and later the matrix; every screen that shows the
  key mounts it), `src/routes/_app/settings/-lib/two-factor-*.ts` (pure helpers), the `beforeLoad` in
  `src/routes/(auth)/two-factor.tsx`, lifting `CodeInput` from `src/routes/(auth)/-ui/form.tsx` to
  `src/components/ui/code-input.tsx` (exported from the `ui` index; the old export removed, no re-export; its one consumer
  updated), the `twoFactor.*` keys in `src/lib/i18n/messages/en/settings.ts` and the rewording of `security.twoFactor.onHint` in all
  23 locales, a `Backup code` term in `CONTEXT.md`, an entry in `APP_ROUTES` (`e2e/helpers/routes.ts`) and one journey in
  `e2e/journeys.spec.ts`.
- 09-S2c: the "Show setup key again" dialog, which mounts `TwoFactorKey`, and its keys.
- 09-S2d: `src/lib/matrix-code/encode.ts` and its test, the SVG component, and its mounting **inside `TwoFactorKey`** (one edit, so
  the enrolment step and the setup-key view both get it).

Two edits cross the area's ownership and are deliberate (Resolved assumption 13): the `hooks.before` line in
`src/server/auth/index.ts` and the reworded `security.twoFactor.onHint` value. Both are additive or a value change, and no other
stage is named here by id.

**Does not own, and does not touch**: `src/routes/_app/settings/security.tsx` (the link stays; the redirect repairs it),
`src/routes/(auth)/-server/config.ts` (read, not edited), the settings shell and nav, any billing or tenant code, `package.json`,
`pnpm-lock.yaml`, `wrangler.jsonc`.

### Neighbouring work

- The passkey management screen is another stage in the same wave. This stage neither needs it nor links to it.
- The change-your-password screen is another stage. The "set a password first" panel links to `/forgot-password`, which already
  ends in a password on the account, and does not wait for it.
- The only session control on `/settings/security` today is "Sign out" (its hint says other devices stay signed in). There is no
  "sign out other devices" control, so no copy in this stage points at one; it is a named follow-up (Out of scope).

### The redirect (09-S2b)

`src/routes/(auth)/two-factor.tsx` gains `beforeLoad: async () => { const config = await loadAuthConfig(); if (config.signedIn)
throw redirect({ href: '/settings/two-factor' }) }`, the idiom `src/routes/(auth)/login.tsx:43-44` already uses to keep a signed-in
visitor off the sign-in screen. `signedIn` is true only for a full session. A person in the middle of sign-in holds the
two-factor cookie and **no** session, so `signedIn` is false and the challenge renders unchanged. That is what keeps enrolment
and challenge two screens rather than one. The `?redirect=` search param of the challenge is not forwarded: a signed-in visitor
has nothing to be sent on to.

### The guard (09-S2a)

`two-factor-guard.ts` exports a `createAuthMiddleware` hook (the same API `room-eviction.ts` uses) whose matcher is
`context.path === '/two-factor/enable'`. It:

1. resolves the session itself (`getSessionFromCtx`; `ctx.context.session` is not populated in a `before` hook). No session:
   returns `undefined`, and the endpoint's own `sessionMiddleware` answers 401;
2. reads the user row and the `twoFactor` row **fresh through `ctx.context.adapter.findOne`**, keyed on the session's user id and
   nothing else (no hand-written SQL), never from session data;
3. throws `APIError.from('BAD_REQUEST', { code: 'TWO_FACTOR_ALREADY_ENABLED', message: ... })` (`APIError` from `better-auth/api`,
   the form the plugin itself uses for `TWO_FACTOR_NOT_ENABLED`; status 400) when `user.twoFactorEnabled === true` **or** the row
   exists with `verified === true` (the exact condition in the library that causes the overwrite). `toAuthFailure` in
   `src/lib/auth/client.ts` surfaces `code`, and the test asserts that;
4. otherwise **returns `undefined`**, so the endpoint runs with its original context. An **unverified** row (an abandoned
   enrolment) must pass, so "Start over" can re-roll the secret; sign-in ignores such a row, so letting it through is safe.

`src/server/auth/index.ts` already carries `hooks: { after: roomEvictionHook }`; the edit adds `before: twoFactorEnableGuard` and
keeps the `after` hook (the two coexist under one `hooks` object). `two_factor` is a per-user auth table with no `organization_id`,
never reached through a `TenantScope`; the guard reads auth tables through the library adapter, keyed only on the session's user
id, like `src/server/auth/provisioning.ts` does, so `docs/SPEC.md` §6 (SQL in `server/repos`) is not engaged.

The guard is **check-then-act, not atomic**: `enable` reads the row again after the guard, so an `enable` racing a `verify-totp`
from a second tab can still overwrite a factor that has just turned on (Risks).

The screen also checks before it calls (Resolved assumption 4): the guard is the control, the check is the courtesy that turns the
refusal into a designed "already on" view.

### The enrolment, three steps in one screen (09-S2b)

The route loader is `loadSecurity` (existing; returns `twoFactorEnabled`), so the first paint knows whether it is enrolling or
managing. The component decides, in this order:

1. **A backup-code panel is open** (state held by the screen, independent of loader data): show the panel. This comes first so a
   router invalidation after the factor turns on cannot unmount the codes before they were stored.
2. **`twoFactorEnabled`**: the "on" status view.
3. **Off, and the account has no password** (`authClient.listAccounts()` has no `providerId === 'credential'` entry): the panel
   "Set a password first". While the call is in flight: the card skeleton. If the call **fails**: fall through to the wizard, where
   the server's own `INVALID_PASSWORD` answer still applies. Only `providerId` is read; no other account data is rendered. This
   `list-accounts` read is the **only** call the screen makes on mount.
4. **Off, with a password**: the wizard.

The screen title is the `h2` under the settings shell's page heading; each step, the backup-code panel and the "on" view title is an
`h3`. The wizard is an ordered list of three steps. The current step is marked `aria-current="step"`, and each item carries visually
hidden state text ("Done", "Current step", "Not started", the `steps.state.*` keys) so the state is not colour or icon alone. Focus
moves to the new step's heading whenever the step changes.

1. **Prove it is you.** A password field (`autocomplete="current-password"`), then `authClient.twoFactor.enable({ password })`.
   Before the call the screen re-reads the session (`authClient.getSession()`, bypassing the cookie cache) and, if
   `twoFactorEnabled` is already true, renders the "on" view with the already-on notice instead of calling. The button carries
   `loading` and a `loadingLabel`. The password stays in state across a **429 or a network failure** (so the person does not retype
   it) and is dropped on **success or a definitive refusal** (`INVALID_PASSWORD` clears the field and focuses it).
2. **Add it to your authenticator.** `TwoFactorKey` (below) and "I have added it". "Start over" returns to step 1 and warns that a
   key already added to an app stops working (the next `enable` re-rolls the secret, which is only possible while the factor is off,
   and asks for the password again).
3. **Confirm a code.** `CodeInput` and `authClient.twoFactor.verifyTotp({ code })`, **never** with `trustDevice`. `INVALID_CODE` is
   a field error on the code input, not a page alert. On success the screen opens the backup-code panel. If the call fails at the
   **network** level the outcome is unknown: the screen re-reads the session once (a read, not a retry of the call); if the factor
   is now on it opens the panel with the codes it already holds in memory, and otherwise it stays on step 3 with the `code.unclear`
   alert and the typed code kept.

**`TwoFactorKey`, the one key display.** Shown at step 2 and in the setup-key dialog (09-S2c), and the place the matrix goes
(09-S2d). It renders: the key as **text** in a `<p dir="ltr">` grouped in fours for reading (not an input: a read-only input is a
poor name-and-value pair on a screen reader, and the key is not edited); a "Copy key" button that copies the key **without the
spaces**; an "Open in your authenticator app" link whose `href` is the returned `otpauth://` URI (on a phone this is the way in,
because the person cannot scan the screen they are holding; Resolved assumption 8); and one always-mounted polite live region that
announces "Key copied" or the copy failure. Its container is wrapped in `data-sentry-block` (see below). The step says in words that
two-factor is **not on yet**.

**The backup-code panel.** An inline `Card`, never a `Dialog` or a sheet (so nothing can be dismissed by Escape or a backdrop click).
The ten codes returned by `enable`, in a list, with "Copy all", "Download as a text file" (a `Blob` and an object URL, revoked a
second after the click, one code per line and no prose so no English sits in a downloaded file; the file name is the product name
plus `backup-codes.txt`), and a checkbox "I have stored these backup codes". "Done" carries `aria-disabled` and
`aria-describedby` pointing at the line "Tick the box to continue" until the box is ticked, so a keyboard user can still reach it
and learns why it does nothing; "Done" clears the codes from state, calls `router.invalidate()` and moves focus to the "on" view
heading. While the panel is open and the box is unticked, leaving is guarded by `beforeunload` and a TanStack Router blocker
(`useBlocker`) that opens a confirm dialog (stay / leave). A person who leaves anyway has a working factor and no codes; "Replace
backup codes" is the way back, and the panel says so. Its container is wrapped in `data-sentry-block`.

**What the screen never does.** Call `enable` or `get-totp-uri` on mount, render or retry; keep the key, the URI, the backup codes
or the password anywhere but component state (not a URL, search param, router or loader data, query cache, `localStorage`,
`sessionStorage`, IndexedDB, console, Sentry breadcrumb, **Session Replay recording**); send the key to any remote service; claim the
lockout protects the confirm step; say a code is asked "on every sign-in" or "always".

**Session Replay.** Replay runs for 10 % of sessions and every error session (`src/client.tsx`), and `src/lib/sentry-replay.ts`
masks text and input values only. The `href` of the open-in-app link carries the whole secret, and attribute masking is not
documented to cover `href`. So the key display, the setup-key dialog body and the backup-code panel are each wrapped in
`data-sentry-block`, which removes the subtree from the recording.

### The "on" view, the two actions and turning it off (09-S2b), the third action (09-S2c)

A status `Card` with an "On" `Badge`, one sentence on what two-factor does (a code is asked after signing in **with email and
password**, unless that browser is trusted; Resolved assumption 9), and the actions:

- **Replace backup codes** (09-S2b): a dialog asking for the password and stating that **the current set stops working now**, then
  `authClient.twoFactor.generateBackupCodes({ password })`, then the backup-code panel above.
- **Turn off two-factor** (09-S2b): a `danger` `Dialog` asking for the password only. `authClient.twoFactor.disable({ password })`,
  then `router.invalidate()` and a toast. The copy says that the person's other signed-in devices stay signed in. It names no
  control to sign them out (none exists today).
- **Show setup key again** (09-S2c): a dialog asking for the password, then `authClient.twoFactor.getTotpUri({ password })`, then
  `TwoFactorKey` with a "Done" that discards it. It never calls `enable`.

Each action asks for the password again; the wizard never keeps a password to make a later call quietly. Every dialog overrides
`onCloseAutoFocus` so focus lands on the heading of whatever replaced the trigger (the panel, the wizard's first step, the "on"
view), not on a trigger that has unmounted.

### Errors, and the rate limit

Failures are handled **on the screen first**, then by `describeFailure` (`src/routes/(auth)/-lib/errors.ts`, imported across the
route trees, Resolved assumption 5) for everything else:

- `INVALID_PASSWORD` is a field error on the password input (`password.invalid`), `INVALID_CODE` a field error on the code input
  (`code.invalid`);
- a **429** is handled locally, **not** by `describeFailure` (which maps it to the sign-in rate-limit copy). The wait is per
  endpoint: the four password-gated calls are 3 per 10 seconds, the confirm step (`verify-totp`) is 10 per 60 seconds and its 429
  carries `X-Retry-After: 60`. The screen uses `rateLimited.password` (about ten seconds) and `rateLimited.code` (up to a minute),
  keeps what the person typed and re-enables the button after the matching wait. A test asserts that the sign-in rate-limit copy
  never appears on this screen;
- `TWO_FACTOR_ALREADY_ENABLED` (new, 09-S2a) is the "on" view with the already-on notice, built from `auth.error.twoFactorOn.*`;
- everything else is an `Alert tone="danger"` or `warning` with "Try again" as a **user action**, never an automatic retry.

Every failure first passes through `toAuthFailure` (`src/lib/auth/client.ts`). The password-guessing exposure of the four
password-gated endpoints (about 72 attempts a minute per IP, no lockout) exists today without any screen; it is named under Risks
and filed as a follow-up, not fixed here.

### The scannable code (09-S2d)

`src/lib/matrix-code/encode.ts` is the hand-rolled **restricted subset** the blocked-capability register already dispositions
(`docs/plans/11-boundaries-and-blockers.md`, entry 6 of its stage on frozen dependencies): byte mode only, **one fixed
error-correction level (M)**, the smallest symbol version that fits, versions 1 to 10 (213 bytes at level M), output a
`ReadonlyArray<ReadonlyArray<boolean>>`. It imports nothing and renders nothing. An input longer than the largest capacity throws a
named error rather than truncating; the screen catches it and shows the typed key alone, with a line saying the code could not be
drawn. The SVG component draws the matrix as token-coloured `rect`s (`--color-ink` on `--color-surface`, the dark ramp re-declared,
a four-module quiet zone) with `role="img"` and an accessible name that says the same key is available as text, **without a
position word** ("below", "beside"), because the layout moves it at other widths. It is mounted once, inside `TwoFactorKey`, so
the enrolment step and the setup-key dialog both get it with no further edit. A stage that finds itself widening this subset has
left it and must stop.

### Alternatives considered, and why they lost

- **Edit `security.tsx` to link straight to the new route.** Rejected by the plan's repair convention (one stage owns that file) and
  needless: the redirect repairs every link and bookmark to `/two-factor` at once.
- **Make `allowPasswordless` true so a social-only account can enrol.** Rejected: the session alone would then enrol, re-key or
  disable the factor (a stolen cookie, an impersonating operator), and the factor would be decorative, because a Google or Apple
  sign-in never asks for a code.
- **A fifteen-minute display timer.** Rejected (Resolved assumption 3).
- **Read the remaining-codes count on the server.** Deferred to a follow-up: `viewBackupCodes` checks no password, so a server
  function around it is its own risk-high piece of auth code.
- **Add an npm QR package.** Rejected by the dependency freeze (`docs/SPEC.md` §3).

## 📝 Architecture

| Concept                                   | Owner                                                                                                                    |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| When `enable` may run                     | `src/server/auth/two-factor-guard.ts`, wired once in `src/server/auth/index.ts`                                          |
| The second factor itself                  | The library's `twoFactor()` plugin and its `two_factor` table. No repository, no SQL of ours                             |
| Failure text for an auth call             | `src/routes/(auth)/-lib/errors.ts` (`describeFailure`), imported by the new screen; no copy of it in the `settings` file |
| Showing the setup key (typed, copy, link) | `TwoFactorKey` in `src/routes/_app/settings/-ui/`; the enrolment step, the setup-key dialog and the matrix all mount it  |
| The six-digit control                     | `src/components/ui/code-input.tsx` (lifted from the sign-in form kit; one definition, two consumers)                     |
| The enrolment screen and its helpers      | `src/routes/_app/settings/two-factor.tsx`, `-ui/two-factor-*.tsx`, `-lib/two-factor-*.ts`                                |
| Turning an `otpauth://` URI into a matrix | `src/lib/matrix-code/encode.ts` (pure); the SVG drawing is a presentational component beside the screen                  |
| The English copy                          | `src/lib/i18n/messages/en/settings.ts`, prefix `twoFactor.`; the two refusal keys in `en/auth.ts`                        |

Layering: `components/ui` never fetches or imports `server/`; the screen calls `authClient` directly (as the sign-in screens do), so
the tests mock `#/lib/auth/client`. Pure helpers (`secretOf(totpURI)`, `groupKey(secret)`, `backupCodesFile(codes)`) take and return
values and are unit-tested without a DOM.

## 📝 Data Model

None. The `two_factor` table (`src/server/db/auth-schema.ts`) and `user.two_factor_enabled` exist and are written by the library.
No column, index or migration; nothing is filed for the foundations stage.

## 📝 API Contracts

No product server function is added. The browser calls the library's endpoints through the existing client:

| Call                                                     | Endpoint                                 | Used by | Guard in front                                             |
| -------------------------------------------------------- | ---------------------------------------- | ------- | ---------------------------------------------------------- |
| `authClient.twoFactor.enable({ password })`              | `POST /two-factor/enable`                | 09-S2b  | **09-S2a**: refused when the factor is working             |
| `authClient.twoFactor.verifyTotp({ code })`              | `POST /two-factor/verify-totp`           | 09-S2b  | 10 per minute (existing); no `trustDevice`                 |
| `authClient.twoFactor.disable({ password })`             | `POST /two-factor/disable`               | 09-S2b  | password; 3 per 10 s                                       |
| `authClient.listAccounts()`                              | `GET /list-accounts`                     | 09-S2b  | session; only `providerId` is read; the only call on mount |
| `authClient.getSession()`                                | `GET /get-session`                       | 09-S2b  | session; the pre-check before `enable`                     |
| `authClient.twoFactor.getTotpUri({ password })`          | `POST /two-factor/get-totp-uri`          | 09-S2c  | password; 3 per 10 s                                       |
| `authClient.twoFactor.generateBackupCodes({ password })` | `POST /two-factor/generate-backup-codes` | 09-S2b  | password and the factor on; 3 per 10 s                     |

The new refusal: `POST /two-factor/enable` for an account whose factor is working answers 400 with code `TWO_FACTOR_ALREADY_ENABLED`
and changes no row. The redirect uses the existing `loadAuthConfig`.

## 📝 UI/UX

**Route.** `/settings/two-factor`, a child of the settings shell, default SSR, loader `loadSecurity`. A new route file means
`pnpm generate-routes`; `src/routeTree.gen.ts` is never hand-edited. The settings index highlights no section for a sub-page, so the
screen opens with a back link to Security. It has a `pendingComponent` (the card outline at its final height) and an
`errorComponent` through `RouteError`, like its siblings.

**Components, reused not rebuilt.** `Card`, `Button`, `Field`, `Input`, `Alert`, `Badge`, `Dialog`, `Skeleton`, `Checkbox`,
`Tooltip`, the lifted `CodeInput`. No new design-system component beyond `CodeInput`'s move.

**States.** Loading: the skeleton. Error: the route's `RouteError`. Per step: idle, busy, field error, alert. 429: a warning `Alert`
with the wait for that call. Already on: the status view with the already-on notice. No password: the panel. No "empty" state exists for backup codes (the count is
unknowable, Resolved assumption 1).

**Responsive and touch.** The typed key reads at 360px (it wraps by group, never scrolls sideways); the open-in-app link is
prominent below `md`; every target is at least 24 by 24 CSS pixels with the 44px phone sizing the buttons already carry.

**Motion.** Step changes are opacity and transform only, 150-260 ms on the existing ease token; `prefers-reduced-motion: reduce`
collapses them to opacity. Nothing animates the backup codes in per item.

**Accessibility.** The step list is an ordered list with `aria-current="step"` and hidden state text per item; headings are `h2`
(screen) and `h3` (steps, panel, "on" view); focus moves to the new step's heading on every swap, to the first invalid field on an
error, to the panel heading when the panel opens and to the "on" view heading after "Done" or a turn-off; errors are bound to their
inputs with `aria-describedby`; the key is visible text with a visible label; one always-mounted polite live region announces the
copy results (success and failure); dialogs trap focus and override `onCloseAutoFocus` as above; the matrix has an accessible name
with no position word and the typed key is always on screen, never a hidden fallback; the password field is `current-password`
and the code field `one-time-code` (from `CodeInput`); "Done" uses `aria-disabled` plus `aria-describedby`, not a native
`disabled`, so it stays reachable; the "back to Security" arrow carries `data-mirror-rtl` so it mirrors in Arabic; contrast is WCAG
2.2 AA in both themes; the backup codes are plain text in a list so a screen reader reads them and a person can select them.

**Copy language.** English source copy, `en-GB`, sentence case, no exclamation marks, "workspace" and "traveller" as the shipped
screens use them, and **"backup codes"**, never "recovery codes". The recovery of an account is a separate concept this stage does
not touch.

## 📝 Copy

Keys are written in `src/lib/i18n/messages/en/settings.ts` **without** the `settings.` prefix, so `'twoFactor.title'` is read as
`t('settings.twoFactor.title')`. Every key lands in all 23 locale files in the same change as the first component that reads it
(`i18n-messages` skill; the parity test fails otherwise, and the settings `copy-rules` test fails on a key nothing reads). The
shared secret, the backup codes and the `otpauth://` URI are data, never keys. The keys below are the full set; the tickets split
them as marked.

**09-S2a** (in `auth.ts`, read by `describeFailure`):

| Key (en)                   | Text                                                                                                               |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `error.twoFactorOn.title`  | Two-factor is already on                                                                                           |
| `error.twoFactorOn.detail` | Setting it up again would stop your current authenticator working, so nothing was changed. You can manage it here. |

**09-S2b** (all under `twoFactor.` in `settings.ts`, plus the reworded `security.twoFactor.onHint`):

| Key                                              | Text                                                                                                                                                                                                                 |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `back`                                           | Back to security                                                                                                                                                                                                     |
| `title` / `description`                          | Two-factor authentication / Add a second step when you sign in with your email and password.                                                                                                                         |
| `error`                                          | We could not load your two-factor settings.                                                                                                                                                                          |
| `steps.label`                                    | Set up two-factor                                                                                                                                                                                                    |
| `steps.password` / `steps.key` / `steps.confirm` | Confirm it is you / Add it to your authenticator / Enter a code                                                                                                                                                      |
| `steps.state.done` / `.current` / `.todo`        | Done / Current step / Not started (visually hidden)                                                                                                                                                                  |
| `password.label` / `password.hint`               | Your password / We ask again before changing how you sign in.                                                                                                                                                        |
| `password.submit` / `password.pending`           | Continue / Setting up                                                                                                                                                                                                |
| `password.invalid`                               | That password is not right.                                                                                                                                                                                          |
| `key.intro`                                      | You need an authenticator app on your phone. Add this key to it, then come back to this page. Two-factor is not on yet.                                                                                              |
| `key.label` / `key.copy` / `key.copied`          | Setup key / Copy key / Key copied                                                                                                                                                                                    |
| `key.copyFailed`                                 | Your browser would not copy the key. Select it and copy it by hand.                                                                                                                                                  |
| `key.open`                                       | Open in your authenticator app                                                                                                                                                                                       |
| `key.startOver` / `key.startOverHint`            | Start over / Starting over makes a new key. A key you already added to an app will stop working.                                                                                                                     |
| `key.next`                                       | I have added it                                                                                                                                                                                                      |
| `code.label` / `code.hint`                       | Code from the app / The six digits the app shows now.                                                                                                                                                                |
| `code.submit` / `code.pending`                   | Turn on two-factor / Checking                                                                                                                                                                                        |
| `code.invalid`                                   | That code did not match. Check the time on your phone and enter the newest code the app shows.                                                                                                                       |
| `code.unclear`                                   | We could not tell whether that worked. Enter the newest code to try again.                                                                                                                                           |
| `rateLimited.title`                              | Too many tries in a short time                                                                                                                                                                                       |
| `rateLimited.password` / `rateLimited.code`      | Wait about ten seconds, then try again. Nothing you typed was lost. / Wait up to a minute, then try again. Nothing you typed was lost.                                                                               |
| `codes.title` / `codes.body`                     | Your backup codes / Each code works once if you lose your phone. They are shown only now, so keep them somewhere safe.                                                                                               |
| `codes.copyAll` / `codes.copied`                 | Copy all / Backup codes copied                                                                                                                                                                                       |
| `codes.download`                                 | Download as a text file                                                                                                                                                                                              |
| `codes.copyFailed`                               | Your browser would not copy them. Select the codes and copy them by hand.                                                                                                                                            |
| `codes.stored` / `codes.done`                    | I have stored these backup codes / Done                                                                                                                                                                              |
| `codes.gate`                                     | Tick the box to continue.                                                                                                                                                                                            |
| `codes.lost`                                     | If you leave this page first you can make a new set from this screen, and the old one will stop working.                                                                                                             |
| `codes.leave.title` / `codes.leave.body`         | Leave without keeping your codes? / Your backup codes are shown only once. If you leave now you can make a new set from this screen, and the old one will stop working.                                              |
| `codes.leave.stay` / `codes.leave.go`            | Stay here / Leave                                                                                                                                                                                                    |
| `on.title` / `on.badge`                          | Two-factor is on / On                                                                                                                                                                                                |
| `on.body`                                        | We ask for a code from your authenticator app when you sign in with your email and password, unless you chose to trust that browser. Signing in with Google, Apple or a passkey does not ask for one.                |
| `off.action` / `off.title`                       | Turn off two-factor / Turn off two-factor?                                                                                                                                                                           |
| `off.body`                                       | Anyone with your password will be able to sign in without a code. Your other signed-in devices stay signed in.                                                                                                       |
| `off.confirm` / `off.pending` / `off.cancel`     | Turn off / Turning off / Keep it on                                                                                                                                                                                  |
| `off.done`                                       | Two-factor is off                                                                                                                                                                                                    |
| `replace.action` / `replace.title`               | Replace backup codes / Replace your backup codes?                                                                                                                                                                    |
| `replace.body`                                   | You will get a new set. The set you have now stops working as soon as you continue.                                                                                                                                  |
| `replace.confirm` / `replace.pending`            | Replace / Replacing                                                                                                                                                                                                  |
| `replace.done`                                   | New backup codes ready                                                                                                                                                                                               |
| `nopassword.title` / `nopassword.body`           | Set a password first / Two-factor needs a password on this account. The next page asks for your email and sends a link to set one. Setting a password signs you out everywhere, so sign in again and come back here. |
| `nopassword.action`                              | Set a password                                                                                                                                                                                                       |
| `security.twoFactor.onHint` (reworded)           | A code from your authenticator app is asked when you sign in with your email and password, unless you trusted that browser.                                                                                          |

**09-S2c**: `setup.action` Show setup key again; `setup.title` Setup key; `setup.body` Add this key to another device. The key already
on your other devices keeps working; `setup.done` Done; `setup.confirm` / `setup.pending` Show key / Checking.

**09-S2d**: `key.matrixLabel` Setup code. The same key is available as text; `key.matrixFailed` We could not draw a code for this
key. Type it into your authenticator app instead.

The "already on" notice reuses `auth.error.twoFactorOn.*` (09-S2a); this stage adds no second pair for it.

## 📝 Edge Cases & Failure Scenarios

| Scenario                                                             | Behaviour                                                                                                                                     |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Second tab: factor turned on in tab A, tab B still shows step 1      | B's pre-check sees it on and shows the "on" view; if the pre-check is raced, 09-S2a refuses with `TWO_FACTOR_ALREADY_ENABLED`, no row changes |
| Abandoned enrolment (closed at step 2 or 3)                          | The row stays unverified, sign-in is unaffected; next visit shows step 1; `enable` re-rolls the secret                                        |
| Wrong password at step 1                                             | Field error on the password input; nothing is stored in state                                                                                 |
| Wrong code at step 3 (repeatedly)                                    | Field error each time; the 10-per-minute rule applies; the sign-in lockout does not, and the copy does not claim it                           |
| 429 on a password-gated call                                         | Warning alert with the ten-second wait; typed values (including the password) kept; the button re-enables after the wait; no automatic retry  |
| 429 on the confirm step                                              | Warning alert with the up-to-a-minute wait; the typed code kept; the button re-enables after the wait; no automatic retry                     |
| Network drop on `enable` after the server wrote                      | Unknown outcome: the person sees the error, presses "Try again", which re-rolls the unverified secret. Never an automatic retry               |
| Network drop on `verify-totp`                                        | The screen re-reads the session once. On: the backup-code panel opens with the codes held in memory. Still off: `code.unclear`, code kept     |
| Tried to leave with the backup-code panel open and the box unticked  | `beforeunload` and the router blocker ask first; staying keeps the panel                                                                      |
| Closed the tab on the backup-code panel anyway                       | Factor on, codes unseen; the "on" view offers "Replace backup codes"                                                                          |
| Google- or Apple-only account                                        | The "set a password first" panel; the server would refuse without a password anyway                                                           |
| `listAccounts` fails                                                 | The wizard renders; the server's `INVALID_PASSWORD` is the answer                                                                             |
| Clipboard refused                                                    | `codes.copyFailed` or `key.copyFailed` in the live region; the text stays selectable                                                          |
| Password-only account loses its phone and its backup codes           | No self-service or operator path back exists (Risks); the person is not locked out while the factor is only enrolled, not on                  |
| `otpauth://` link with no authenticator installed                    | The browser does nothing; the typed key is the way in                                                                                         |
| URI longer than the encoder's capacity                               | The typed key alone, with the explanatory line (09-S2d)                                                                                       |
| Signed-in visitor on `/two-factor?redirect=...`                      | Redirected to `/settings/two-factor`; the param is dropped                                                                                    |
| Mid-sign-in visitor (two-factor cookie, no session) on `/two-factor` | The challenge renders unchanged                                                                                                               |
| Signed-out visitor on `/settings/two-factor`                         | Redirected to `/login?redirect=...` by the `_app` guard                                                                                       |
| Impersonated session                                                 | Acts on the impersonated account like any other settings action (`docs/ACCESS.md` §6.4); the library endpoints decide                         |
| Arabic                                                               | Logical properties only; the key and the codes stay left-to-right (`dir="ltr"`) inside the right-to-left layout                               |

## ✅ Acceptance criteria

09-S2a:

1. `POST /two-factor/enable` for an account with `twoFactorEnabled` true, or with a `verified` row, answers 400
   `TWO_FACTOR_ALREADY_ENABLED`, and the row's secret and backup codes are byte-identical afterwards; a code from the old secret still
   verifies.
2. The same call with no row, and with an **unverified** row, succeeds; after `disable` it succeeds again.
3. A call with no session is answered by the endpoint's own 401, not by the hook.
4. `roomEvictionHook` still runs as the `after` hook. No SQL of ours reads the table. `describeFailure` maps the new code to the two
   `auth.error.twoFactorOn.*` keys, present in 23 locales; the client's `toAuthFailure` surfaces `TWO_FACTOR_ALREADY_ENABLED`.
5. The test drives the real handler, and its cases do not hit the plugin's 3-per-10-seconds rule on `/two-factor/enable`: each case
   uses a distinct `x-forwarded-for` or a fresh KV. No `rateLimit` setting in `src/server/auth/index.ts` is relaxed to make it pass.

09-S2b:

6. A signed-in visitor on `/two-factor` lands on `/settings/two-factor`; a visitor with no session stays on the challenge; a
   signed-out visitor on `/settings/two-factor` lands on `/login`.
7. With the factor off and a password on the account, the three steps turn it on; at no point is the key, the URI, the password or a
   backup code present in the URL, storage, loader data or console, and the subtrees that show the key or the codes carry
   `data-sentry-block` (Session Replay).
8. Step 3 never sends `trustDevice`; `INVALID_CODE` is a field error; "Done" on the panel is inert (`aria-disabled`, described by
   `codes.gate`) until the box is ticked and then clears the codes from state.
9. A router invalidation while the panel is open does not unmount it, and leaving with the box unticked is guarded.
10. With the factor on, the screen shows the status view and never the wizard; "Replace backup codes" asks for the password, states
    that the old set stops working and shows the new set once; "Turn off" asks for the password only and, on success, shows the
    wizard's first step again.
11. A 429 keeps what was typed (the password included) and shows the wait for that call (ten seconds, or up to a minute at the
    confirm step); nothing retries by itself; `list-accounts` is the only call made on mount; the sign-in rate-limit copy never
    appears on this screen.
12. An account with no credential account sees the panel with a link "Set a password" to `/forgot-password`; a `listAccounts` failure
    shows the wizard.
13. No string on the screen says a code is needed "on every sign-in" or "always"; `security.twoFactor.onHint` is reworded in 23
    locales and mentions trusted browsers.
14. `CodeInput` lives in `src/components/ui`, the sign-in challenge uses it unchanged, and `grep -rn CodeInput src` finds no import
    from the form kit.
15. `/settings/two-factor` is in `APP_ROUTES` and the authenticated route walk passes with a silent console.
16. Accessibility, each asserted in a `ui` test: the current step has `aria-current="step"` and hidden state text; focus is on the
    new heading after each swap, on the first invalid field after an error, on the panel heading when it opens; the screen title is
    an `h2` and the step, panel and "on" view titles `h3`; the typed key is a `<p dir="ltr">`, not an input; the live region is
    mounted before the first copy; the dialogs return focus to the replacing heading; the back arrow carries `data-mirror-rtl`.

09-S2c:

17. "Show setup key again" calls `getTotpUri` and never `enable`, asks for the password, and shows the key through `TwoFactorKey`.

09-S2d:

18. The encoder returns a square matrix whose side is `17 + 4 * version`, chooses the smallest version that fits, throws a named
    error one byte past version 10 at level M, and passes the known-answer vectors. A rendering is read correctly by a phone
    authenticator (recorded in the PR).
19. The matrix has an accessible name with no position word and the typed key is on screen in every case; the matrix appears in the
    enrolment step and in the setup-key view with no edit outside `TwoFactorKey`.

## 📝 Risks & Impact Review

- **Authentication change (09-S2a, 09-S2b).** Both are `risk-high` and `security`: they gate a working second factor. The guard is
  server-side and tested through the real handler; the screen is courtesy on top.
- **Existing exposure, not made worse and not fixed here.** The four password-gated endpoints take roughly 72 password guesses a
  minute per IP with no lockout, and the counter is not atomic. A stolen session can try passwords through them. The slicer files a
  follow-up.
- **Social and passkey sign-in skip the code.** The factor protects password sign-in only. The copy says so. Whether the other doors
  should ask is a product decision for a follow-up.
- **The guard is check-then-act.** `enable` reads the row again after the guard, so an `enable` racing a `verify-totp` in a second tab
  can still overwrite a factor that has just turned on. The window is milliseconds and needs two tabs and a stolen or open session;
  it is not closed here (it needs a library change or a transaction we do not own).
- **No unique index on `two_factor.user_id`.** Two `enable` calls at once can create two rows. Existing library behaviour; named,
  not fixed.
- **No way back for a password-only account that loses both phone and codes.** There is no self-service or operator path into such
  an account. Whether an operator-assisted reset is built is a person's decision (Out of scope).
- **Trusted devices outlive a factor change.** The sign-in challenge offers "Trust this device for 30 days"; `disable` clears the
  trust record only on the current browser, so after turning the factor back on, browsers trusted earlier skip the code for up to 30
  days. The copy says "unless you chose to trust that browser"; clearing trusted devices on a change is a follow-up.
- **Session Replay.** The setup key rides in an `href` that attribute masking does not clearly cover; the key display, the setup-key
  dialog body and the backup-code panel are blocked from the recording (`data-sentry-block`).
- **Per-IP limits depend on the client address.** The "per IP" figures assume the Worker sees a single-value `x-forwarded-for`; if it
  does not, better-auth shares one bucket per path across all users and the limits are tighter than stated. Not verified here (needs a
  running Worker); the screen's 429 handling holds either way.
- **Closing the panel loses the codes.** Unavoidable (they are shown once); a leave guard asks first and the recovery is "Replace backup
  codes".
- **A hand-rolled encoder can be subtly wrong.** Known-answer vectors plus a real phone scan; the typed key is always the working
  path, so a bug degrades to friction, not lock-out.
- **Moving `CodeInput`** touches the sign-in challenge. Its test and the `(auth)` copy-rules test cover it.
- **Rate limit.** The 3-per-10-seconds rule makes quick retries fail; the 429 state is designed for it.

### Out of scope

- Showing the backup codes a person already has, and a count of those left (the server-side `viewBackupCodes` plus a password check);
  the empty state that count would make reachable.
- Requiring a current code to turn off (a server hook; a security decision).
- Asking for the code on Google, Apple or passkey sign-in.
- A hardened rate limit or lockout for the password-gated endpoints.
- Email or SMS one-time codes, trusted-device management (including clearing trusted devices when the factor changes), a "sign out
  other devices" control and signing out other devices on a factor change.
- An operator-assisted way back for a password-only account that lost its phone and codes (a person decides).
- The change-password and passkey-management screens.

### Blockers

None. The matrix-code encoder is the one capability absent from the pinned dependency set, and it is already dispositioned as
a hand-rolled restricted subset; the typed key keeps the feature working if the encoder is late. No package, no binding, no
third-party service.

### Reference-row disposition

`ACC-02` stays `partial` (`partial` to `partial`) with named follow-ups (show existing codes / count; a code on turn-off, deferred as a
security decision; clearing trusted devices; sign out other devices). It is closed by the follow-ups, not by this stage.

## 📋 Phasing

| Ticket | Delivers                                                            | Blocked by |
| ------ | ------------------------------------------------------------------- | ---------- |
| 09-S2a | The server-side guard and its test                                  | none       |
| 09-S2b | Turn on (typed key), the on view, replace codes, turn off, redirect | 09-S2a     |
| 09-S2c | Show setup key again                                                | 09-S2b     |
| 09-S2d | The scannable code (inside `TwoFactorKey`)                          | 09-S2b     |

09-S2c and 09-S2d are independent of each other, and each works in either order because both reach the key through `TwoFactorKey`
(09-S2b); 09-S2d should not rank below 09-S2c, because typing the key by hand is the roughest edge 09-S2b leaves.

## 📋 Implementation Plan

### Phase 1 - the guard (09-S2a)

1. `src/server/auth/two-factor-guard.ts` and its wiring in `src/server/auth/index.ts` (add `before`, keep `after`).
2. A test in `src/server/auth/__tests__/` through the real `auth.handler`, using the harness `auth-handler-closure.test.ts`
   builds: enabled account refused with the secret and codes unchanged and the old code still verifying; no row allowed; unverified
   row allowed; allowed again after `disable`; no session left to the endpoint's 401. Each case uses a distinct `x-forwarded-for` or
   a fresh KV (the 3-per-10-seconds rule would otherwise answer 429); no `rateLimit` setting is relaxed.
3. `TWO_FACTOR_ALREADY_ENABLED` in `describeFailure`, two keys in `en/auth.ts`, 23 locales.

### Phase 2 - turn it on, see it, turn it off (09-S2b)

1. Lift `CodeInput` to `src/components/ui/code-input.tsx`, export it, update `two-factor.tsx`, add a small test.
2. The `beforeLoad` in `src/routes/(auth)/two-factor.tsx`; the route, its components (`TwoFactorKey` first, then the wizard, the
   backup-code panel, the "on" view with its replace and turn-off dialogs, the no-password panel) and helpers; `pnpm generate-routes`.
3. Copy: `twoFactor.*` keys and the `onHint` rewording in 23 locales; a `Backup code` entry in `CONTEXT.md`.
4. `APP_ROUTES` entry and the journey.

### Phase 3 - second device (09-S2c)

The "Show setup key again" dialog, its call, its keys; it mounts `TwoFactorKey`.

### Phase 4 - the scannable code (09-S2d)

`encode.ts` with vectors, the SVG component, its mounting inside `TwoFactorKey` (one edit), the two keys.

## Verification

- The gate in `validation.commands` (`.ai/agentic.config.json`) on every phase's last commit. The parity count is recorded before and
  after each ticket; a ticket owns every failure that is not a missing translation it was told to add.
- **Server** (`server` project), 09-S2a: the real-handler test above. This is the tenancy-equivalent test: `two_factor` has no
  `organization_id` and is never reached through a `TenantScope`, so nothing is appended to
  `src/server/repos/__tests__/tenant-isolation.test.ts`; the boundary that applies is a person against their own session, and the
  test asserts that an enabled account's secret cannot be overwritten.
- **Unit** (`ui` project): `secretOf`, `groupKey` and `backupCodesFile`; the wizard and the "on" view with `#/lib/auth/client`
  mocked (as `workspace-switcher.test.tsx` does): the three steps, `INVALID_PASSWORD`, `INVALID_CODE`, the 429 state through
  `describeFailure`, the pre-check refusal, the no-password panel and the `listAccounts` failure, the panel's gating and clearing,
  the invalidation that does not unmount the panel, the leave guard, the 429 waits per call (and that the sign-in rate-limit copy never
  appears), the focus and heading assertions, no call but `list-accounts` on mount; the lifted `CodeInput`. The encoder: published known-answer
  vectors (the format-information table, a worked Reed-Solomon example), version selection, the capacity error, matrix size.
- **E2E** (Playwright, one journey in `e2e/journeys.spec.ts`, because it is routing and sessions): signed-in on `/two-factor` lands on
  `/settings/two-factor`; no session on `/two-factor` stays on the challenge; no session on `/settings/two-factor` lands on
  `/login`. `/settings/two-factor` is added to `APP_ROUTES`. `watchConsole` attached before navigation; no new tolerated warning.
  No `toHaveScreenshot`, no new baseline (ADR 0016).
- **Review evidence**: the blind A/B pair from `scripts/visual/capture.mjs` for each ticket's screens at 360x800, 1280x900 and
  2560x1440 in light and dark, e.g. `node scripts/visual/capture.mjs --url "http://localhost:$PORT/settings/two-factor" --out <dir>
--label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth`, plus a screen-reader and keyboard pass over the
  three steps. The scan of the rendered matrix with a phone authenticator is recorded in 09-S2d's PR.
- Docs and CI: the terms searched before each PR are "two-factor", "two factor", "2fa", "backup code", "recovery code",
  "/two-factor", "CodeInput". At spec time the only non-plan documents are `docs/SPEC.md` (the route tree line, unchanged) and
  `CONTEXT.md` (gains `Backup code`).

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                                                                           | Applied default                                                                                                                                                                                                                                                                 | Why                                                                                                                                                                                                                                                                                                          |
| --- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | The plan promises "show recovery codes", an empty state and turn-off with a code. What ships?                                      | Only what the library does from the browser: replace (never show) backup codes, no empty state, turn-off by password, "show setup key again". One follow-up for the remaining-codes count; the code-on-turn-off is a security decision, also a follow-up                        | Decided by product owner sub-agent (confidence high): no browser call returns the existing set or a count; a server function around `viewBackupCodes` is risk-high auth code this slice does not need; "replace" covers the real need                                                                        |
| 2   | One word for the codes                                                                                                             | "Backup codes" everywhere, including a `Backup code` glossary entry                                                                                                                                                                                                             | Decided by product owner sub-agent (confidence high): the sign-in screen already says "backup code"; one thing, one name                                                                                                                                                                                     |
| 3   | The 15-minute display expiry                                                                                                       | Dropped. "Start over" is offered while the factor is off and asks for the password again                                                                                                                                                                                        | Decided by product owner sub-agent (confidence medium): the secret is durable server-side from `enable` and the factor is off until a code proves it; the timer protects almost nothing and costs a state, copy and friction                                                                                 |
| 4   | A working factor can be overwritten by `enable`                                                                                    | A server-side `hooks.before` guard (own ticket, first), plus the screen's pre-check as courtesy; the unverified row still passes                                                                                                                                                | Decided by security and tenancy sub-agent (confidence high): the old secret and codes die at once and no self-service way back exists; a control only in the interface is not access control; the endpoint is live today                                                                                     |
| 5   | `CodeInput` and `describeFailure` live in `(auth)`; the screen is in `_app`                                                        | Lift `CodeInput` to `src/components/ui` (no re-export); leave `describeFailure` and its `auth.error.*` keys where they are and import across                                                                                                                                    | Decided by software architect sub-agent (confidence medium): `CodeInput` is a pure control; the form kit is for sessionless screens; duplicating either gives one concept two owners; the only precedent for importing `(auth)/-lib/errors` is server-side, so the import is a deliberate first for a screen |
| 6   | Slicing                                                                                                                            | Four tickets: guard; turn on / on view / replace codes / turn off; second device (setup key again); scannable code. The "on" view, replace and turn-off are in the first screen ticket; one `TwoFactorKey` display serves the later two                                         | Decided by product owner and software architect sub-agents (confidence medium): "Manage" and "Turn on" both land on the new route, so the first screen ticket must handle "on" or it would call `enable` on a working factor; the encoder is its own risk                                                    |
| 7   | Accounts with no password                                                                                                          | `authClient.listAccounts()` detects a missing `credential` account and shows a "set a password first" panel linking to `/forgot-password`; `allowPasswordless` stays unset; a failed detection falls through to the wizard                                                      | Decided by security and tenancy and product owner sub-agents (confidence high): without it the person is told their password is wrong; passwordless enrolment lets a session alone re-key the factor and the factor would never be asked for                                                                 |
| 8   | An "open in your authenticator app" link                                                                                           | Included beside the typed key, as an anchor to the `otpauth://` URI                                                                                                                                                                                                             | Applied default: a phone cannot scan its own screen and the typed key is the only other way in; no code, no dependency, the URI is already in state                                                                                                                                                          |
| 9   | The existing hint says a code is required on every new sign-in                                                                     | Reworded to "when you sign in with your email and password", in 23 locales, in the screen ticket; the new copy says Google, Apple and passkey sign-ins do not ask                                                                                                               | Decided by product owner and security and tenancy sub-agents (confidence high): the plugin's challenge fires only on password sign-in; the claim is untrue today                                                                                                                                             |
| 10  | Test layers                                                                                                                        | `ui` tests with the auth client mocked, encoder vectors, a real-handler test for the guard, one Playwright journey for the redirects, blind A/B frames, no baselines                                                                                                            | Decided by software architect sub-agent (confidence high): ADR 0016 admits e2e only for routing and sessions; a real-endpoint enrolment test would fight the 3-per-10-seconds limit and test the library                                                                                                     |
| 11  | The plan's source-and-line claims and pixel verification                                                                           | Replaced by today's lines, the gate, ADR 0016 and the A/B pair; i18n keys land in 23 locales                                                                                                                                                                                    | Verified against the repository: `scripts/ultrabuild` and the visual spec do not exist; the i18n rule moved                                                                                                                                                                                                  |
| 12  | The password-guessing exposure of the four gated endpoints, and sign-in doors that skip the code                                   | Named under Risks and Out of scope; the slicer files follow-ups                                                                                                                                                                                                                 | Decided by security and tenancy sub-agent (confidence high): it exists today without any screen and fixing it needs auth-config work this stage does not own                                                                                                                                                 |
| 13  | The stage touches files another area owns: `hooks.before` in `src/server/auth/index.ts`, and the `security.twoFactor.onHint` value | Both edits are made here. The first adds one `before` entry beside the existing `after`; the second changes one catalogue value in 23 locales. Neither touches `security.tsx`, and the neighbouring account-management work is named by what it ships, not by stage id          | Decided by software architect and product owner sub-agents (confidence medium): tickets are built one at a time, so the overlap is a merge-order matter; the hook and the untrue hint are this stage's repair and cannot be left to a stage that does not know about them                                    |
| 14  | Failure handling for the password-gated calls and the confirm step                                                                 | `INVALID_PASSWORD`, `INVALID_CODE` and 429 are handled on the screen before `describeFailure`; the 429 wait is per call (ten seconds, or up to a minute at the confirm step); the password is kept across a 429 or network failure and dropped on success or definitive refusal | Decided by security and tenancy and accessibility sub-agents (confidence high): `describeFailure` maps 429 to the sign-in copy, which would be wrong here; the confirm step's limit is 10 per 60 seconds, not 3 per 10                                                                                       |
| 15  | The setup key in Session Replay, and a leave guard for the backup codes                                                            | The key display, the setup-key dialog body and the backup-code panel are wrapped in `data-sentry-block`; the panel is guarded by `beforeunload` and a router blocker while the box is unticked                                                                                  | Decided by security and tenancy and traveller sub-agents (confidence high): the secret rides in an `href` that attribute masking does not clearly cover; the codes are shown once                                                                                                                            |
| 16  | No-password panel wording and the claims in `on.body` / `off.body`                                                                 | "Set a password" is a link to `/forgot-password` (the next page asks for the email); the copy says setting one signs the person out everywhere; `on.body` says "unless you chose to trust that browser"; `off.body` names no sign-out control                                   | Decided by security and tenancy and traveller sub-agents (confidence high): there is no "sign out other devices" control today; a trusted browser skips the code for 30 days; the button cannot promise an email it does not send                                                                            |
| 17  | Accessibility structure                                                                                                            | `h2` screen / `h3` sections; inline panel, never a Dialog or sheet; the key is `<p dir="ltr">`, not an input; always-mounted polite live region; "Done" is `aria-disabled` with `aria-describedby`; dialogs override `onCloseAutoFocus`; back arrow mirrors                     | Decided by accessibility specialist sub-agent (confidence high): each is a testable acceptance criterion (AC 16)                                                                                                                                                                                             |
