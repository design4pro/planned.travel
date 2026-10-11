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
2. **09-S2b - turn two-factor on, see that it is on, turn it off.** The route, the redirect, the three-step enrolment with the
   **typed** key, the one-time backup-code sheet, the "on" status view, "Turn off" with the password, the honest "set a password
   first" panel, and the journey for the two redirects. Risk-high.
3. **09-S2c - add it to another device, and replace the backup codes.** "Show setup key again" and "Replace backup codes", each
   asking for the password again.
4. **09-S2d - a scannable code.** A hand-rolled matrix-code encoder (the dispositioned exception to the dependency freeze) and the
   rendering of its output beside the typed key.

No schema change, no migration, no repository, no SQL, no quota, no package added, no binding. The two-factor rows are written
entirely by the library's own adapter calls and are keyed on the user, not on a workspace.

**Reference row `ACC-02` goes to `done` only for what the library can do.** The reference product's behaviour is "turn off by
proving the password **and** a current code" and "show the backup codes you already have". The installed library supports neither
from the browser (Resolved assumption 1), so this stage ships turn-off by password and a replace-not-show backup-code flow, and
files the rest as follow-ups.

This spec describes the work that is **left** at HEAD. It departs from the plan's stage block wherever the code the plan cites has
moved or the library behaves otherwise than the plan assumed; every departure is a row of the Resolved assumptions table.
Neighbouring work is named here by what it ships, never by stage id: the backlog reads any mention of a stage id in a spec as that
stage being specified already.

## 📝 Visual change expected

`/settings/two-factor` (new), light and dark, 360x800, 1280x900 and 2560x1440:

- 09-S2b: the screen with two-factor off, step 1 (password) empty, with a field error, and busy; step 2 (typed key, "not on yet"
  notice); step 3 (code) empty, with a field error and busy; the rate-limited state (429); the backup-code sheet with the
  acknowledgement unticked and ticked; the "on" status view; the turn-off dialog empty, with a password error, and busy; the
  "set a password first" panel; the route's loading skeleton; the route's error state; the screen in a non-English locale and in
  Arabic (right-to-left).
- 09-S2c: the "on" view with the two new actions, the password dialog for each, the setup key shown again, the replaced backup-code
  sheet.
- 09-S2d: step 2 with the matrix beside the typed key at each width; the same step with an input too long for the encoder (typed
  key only, with the explanatory line).
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
- 09-S2b: `src/routes/_app/settings/two-factor.tsx` (route), `src/routes/_app/settings/-ui/two-factor-*.tsx` (components),
  `src/routes/_app/settings/-lib/two-factor-*.ts` (pure helpers), the `beforeLoad` in `src/routes/(auth)/two-factor.tsx`, lifting
  `CodeInput` from `src/routes/(auth)/-ui/form.tsx` to `src/components/ui/code-input.tsx` (exported from the `ui` index; the old
  export removed, no re-export; its one consumer updated), the `twoFactor.*` keys in `src/lib/i18n/messages/en/settings.ts`
  and the rewording of `security.twoFactor.onHint` in all 23 locales, a `Backup code` term in `CONTEXT.md`, an entry in
  `APP_ROUTES` (`e2e/helpers/routes.ts`) and one journey in `e2e/journeys.spec.ts`.
- 09-S2c: the management actions in the same route's components, their keys.
- 09-S2d: `src/lib/matrix-code/encode.ts` and its test, the SVG component, the one-line insertion into the enrolment step.

**Does not own, and does not touch**: `src/routes/_app/settings/security.tsx` (the link stays; the redirect repairs it),
`src/routes/(auth)/-server/config.ts` (read, not edited), the settings shell and nav, any billing or tenant code, `package.json`,
`pnpm-lock.yaml`, `wrangler.jsonc`.

### Neighbouring work

- The passkey management screen is another stage in the same wave. This stage neither needs it nor links to it.
- The change-your-password screen is another stage. The "set a password first" panel links to `/forgot-password`, which already
  ends in a password on the account, and does not wait for it.
- The existing sessions control on `/settings/security` is reused as a pointer in copy (other devices stay signed in), not changed.

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
   returns, and the endpoint's own `sessionMiddleware` answers 401;
2. reads the user row and the `twoFactor` row **fresh through `ctx.context.internalAdapter` / `ctx.context.adapter`** (no
   hand-written SQL), never from session data;
3. throws a named error (`TWO_FACTOR_ALREADY_ENABLED`, status 400, the library's own style for `TWO_FACTOR_NOT_ENABLED`) when
   `user.twoFactorEnabled === true` **or** the row exists with `verified === true` (the exact condition in the library that causes the
   overwrite);
4. otherwise returns. An **unverified** row (an abandoned enrolment) must pass, so "Start over" can re-roll the secret.

`src/server/auth/index.ts` already carries `hooks: { after: roomEvictionHook }`; the edit adds `before: twoFactorEnableGuard` and
keeps the `after` hook. `two_factor` is a per-user auth table with no `organization_id`, never reached through a `TenantScope`;
`docs/SPEC.md` §6 is not engaged as long as no raw SQL is written.

The screen also checks before it calls (Resolved assumption 4): the guard is the control, the check is the courtesy that turns the
refusal into a designed "already on" view.

### The enrolment, three steps in one screen (09-S2b)

The route loader is `loadSecurity` (existing; returns `twoFactorEnabled`), so the first paint knows whether it is enrolling or
managing. The component decides, in this order:

1. **A backup-code sheet is open** (state held by the screen, independent of loader data): show the sheet. This comes first so a
   router invalidation after the factor turns on cannot unmount the codes before they were stored.
2. **`twoFactorEnabled`**: the "on" status view.
3. **Off, and the account has no password** (`authClient.listAccounts()` has no `providerId === 'credential'` entry): the panel
   "Set a password first". While the call is in flight: the card skeleton. If the call **fails**: fall through to the wizard, where
   the server's own `INVALID_PASSWORD` answer still applies. Only `providerId` is read; no other account data is rendered.
4. **Off, with a password**: the wizard.

The wizard is an ordered list of three steps; the current step is marked `aria-current="step"` and focus moves to its heading when
it changes:

1. **Prove it is you.** A password field (`autocomplete="current-password"`), then `authClient.twoFactor.enable({ password })`.
   Before the call the screen re-reads the session (`authClient.getSession()`) and, if `twoFactorEnabled` is already true,
   renders the "on" view instead of calling. The button carries `loading` and a `loadingLabel`. The password is dropped from
   state as soon as the request returns.
2. **Add it to your authenticator.** The typed key in a read-only field, grouped in fours for reading, with a "Copy key" button
   whose confirmed state is announced by a live region; an "Open in your authenticator app" link whose `href` is the returned
   `otpauth://` URI (on a phone this is the way in, because the person cannot scan the screen they are holding; Resolved assumption
   8). The step says in words that two-factor is **not on yet**. 09-S2d inserts the matrix beside the key. "Start over" returns to
   step 1 (the next `enable` re-rolls the secret, which is only possible while the factor is off, and asks for the password again).
3. **Confirm a code.** `CodeInput` and `authClient.twoFactor.verifyTotp({ code })`, **never** with `trustDevice`. `INVALID_CODE` is
   a field error on the code input, not a page alert. On success the screen opens the backup-code sheet.

**The backup-code sheet.** The ten codes returned by `enable`, in a list, with "Copy all", "Download as a text file" (a `Blob` and an
object URL, revoked after the click, one code per line and no prose so no English sits in a downloaded file; the file name is the
product name plus `backup-codes.txt`), and a checkbox "I have stored these backup codes". "Done" is disabled until it is ticked;
"Done" clears the codes from state and calls `router.invalidate()`, which brings up the "on" view. A person who closes the tab
before ticking has a working factor and no codes; "Replace backup codes" (09-S2c) is the way back, and the sheet says so.

**What the screen never does.** Call `enable` or `get-totp-uri` on mount, render or retry; keep the key, the URI, the backup codes
or the password anywhere but component state (not a URL, search param, router or loader data, query cache, `localStorage`,
`sessionStorage`, IndexedDB, console, Sentry breadcrumb); send the key to any remote service; claim the lockout protects the
confirm step; say a code is asked "on every sign-in".

### The "on" view and turning it off (09-S2b), the two actions (09-S2c)

A status `Card` with an "On" `Badge`, one sentence on what two-factor does (a code is asked after signing in **with email and
password**; Resolved assumption 9), and the actions:

- **Turn off two-factor** (09-S2b): a `danger` `Dialog` asking for the password only. `authClient.twoFactor.disable({ password })`,
  then `router.invalidate()` and a toast. The copy says that other signed-in devices stay signed in and points to the sessions
  control on `/settings/security`.
- **Show setup key again** (09-S2c): a dialog asking for the password, then `authClient.twoFactor.getTotpUri({ password })`, then the
  same step-2 display (typed key, copy, link, and the matrix once 09-S2d has landed) with a "Done" that discards it. It never calls
  `enable`.
- **Replace backup codes** (09-S2c): a dialog asking for the password and stating that **the current set stops working now**, then
  `authClient.twoFactor.generateBackupCodes({ password })`, then the same sheet as above.

Each action asks for the password again; the wizard never keeps a password to make a later call quietly.

### Errors, and the rate limit

Every failure goes through `toAuthFailure` (`src/lib/auth/client.ts`) and `describeFailure` (`src/routes/(auth)/-lib/errors.ts`,
imported across the route trees, Resolved assumption 5). `INVALID_PASSWORD` is a field error on the password input,
`INVALID_CODE` on the code input; `TWO_FACTOR_ALREADY_ENABLED` (new, 09-S2a) is the "already on" view; everything else is an
`Alert tone="danger"` or `warning` with "Try again" as a **user action**, never an automatic retry. The 429 state says to wait
about ten seconds, keeps what the person typed and re-enables the button after the wait. The password-guessing exposure of the four
password-gated endpoints (about 72 attempts a minute per IP, no lockout) exists today without any screen; it is named under Risks
and filed as a follow-up, not fixed here.

### The scannable code (09-S2d)

`src/lib/matrix-code/encode.ts` is the hand-rolled **restricted subset** the blocked-capability register already dispositions
(`docs/plans/11-boundaries-and-blockers.md`, entry 6 of its stage on frozen dependencies): byte mode only, **one fixed
error-correction level (M)**, the smallest symbol version that fits, versions 1 to 10 (213 bytes at level M), output a
`ReadonlyArray<ReadonlyArray<boolean>>`. It imports nothing and renders nothing. An input longer than the largest capacity throws a
named error rather than truncating; the screen catches it and shows the typed key alone, with a line saying the code could not be
drawn. The SVG component draws the matrix as token-coloured `rect`s (`--color-ink` on `--color-surface`, the dark ramp re-declared,
a four-module quiet zone) with `role="img"` and an accessible name that says the same key is typed below. A stage that finds itself
widening this subset has left it and must stop.

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

| Call                                                     | Endpoint                                 | Used by | Guard in front                                 |
| -------------------------------------------------------- | ---------------------------------------- | ------- | ---------------------------------------------- |
| `authClient.twoFactor.enable({ password })`              | `POST /two-factor/enable`                | 09-S2b  | **09-S2a**: refused when the factor is working |
| `authClient.twoFactor.verifyTotp({ code })`              | `POST /two-factor/verify-totp`           | 09-S2b  | 10 per minute (existing); no `trustDevice`     |
| `authClient.twoFactor.disable({ password })`             | `POST /two-factor/disable`               | 09-S2b  | password; 3 per 10 s                           |
| `authClient.listAccounts()`                              | `GET /list-accounts`                     | 09-S2b  | session; only `providerId` is read             |
| `authClient.getSession()`                                | `GET /get-session`                       | 09-S2b  | session; the pre-check before `enable`         |
| `authClient.twoFactor.getTotpUri({ password })`          | `POST /two-factor/get-totp-uri`          | 09-S2c  | password; 3 per 10 s                           |
| `authClient.twoFactor.generateBackupCodes({ password })` | `POST /two-factor/generate-backup-codes` | 09-S2c  | password and the factor on; 3 per 10 s         |

The new refusal: `POST /two-factor/enable` for an account whose factor is working answers 400 with code `TWO_FACTOR_ALREADY_ENABLED`
and changes no row. The redirect uses the existing `loadAuthConfig`.

## 📝 UI/UX

**Route.** `/settings/two-factor`, a child of the settings shell, default SSR, loader `loadSecurity`. A new route file means
`pnpm generate-routes`; `src/routeTree.gen.ts` is never hand-edited. The settings index highlights no section for a sub-page, so the
screen opens with a back link to Security. It has a `pendingComponent` (the card outline at its final height) and an
`errorComponent` through `RouteError`, like its siblings.

**Components, reused not rebuilt.** `Card`, `Button`, `Field`, `Input`, `Alert`, `Badge`, `Dialog`, `Skeleton`, `Checkbox`,
`EmptyState`, `Tooltip`, the lifted `CodeInput`. No new design-system component beyond `CodeInput`'s move.

**States.** Loading: the skeleton. Error: the route's `RouteError`. Per step: idle, busy, field error, alert. 429: a warning `Alert`
with the wait. Already on: the status view. No password: the panel. No "empty" state exists for backup codes (the count is
unknowable, Resolved assumption 1).

**Responsive and touch.** The typed key reads at 360px (it wraps by group, never scrolls sideways); the open-in-app link is
prominent below `md`; every target is at least 24 by 24 CSS pixels with the 44px phone sizing the buttons already carry.

**Motion.** Step changes are opacity and transform only, 150-260 ms on the existing ease token; `prefers-reduced-motion: reduce`
collapses them to opacity. Nothing animates the backup codes in per item.

**Accessibility.** The step list is an ordered list with `aria-current="step"`; focus moves to the new step's heading; errors are
bound to their inputs with `aria-describedby` and the first invalid field takes focus; the key field has a visible label; the
copy confirmation is a polite live region; the dialogs trap and restore focus (the existing `Dialog`); the matrix has an accessible
name and the typed key is always on screen, never a hidden fallback; the secret and code fields carry `autocomplete="off"` except
the password (`current-password`) and the code (`one-time-code`, from `CodeInput`); contrast is WCAG 2.2 AA in both themes; the
backup codes are plain text in a list so a screen reader reads them and a person can select them.

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

| Key (en)                   | Text                                                                                                        |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `error.twoFactorOn.title`  | Two-factor is already on                                                                                    |
| `error.twoFactorOn.detail` | Setting it up again would stop your current authenticator working. Open the security settings to manage it. |

**09-S2b** (all under `twoFactor.` in `settings.ts`, plus the reworded `security.twoFactor.onHint`):

| Key                                              | Text                                                                                                                                                                                      |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `back`                                           | Back to security                                                                                                                                                                          |
| `title` / `description`                          | Two-factor authentication / Add a second step when you sign in with your email and password.                                                                                              |
| `error`                                          | We could not load your two-factor settings.                                                                                                                                               |
| `steps.label`                                    | Set up two-factor                                                                                                                                                                         |
| `steps.password` / `steps.key` / `steps.confirm` | Confirm it is you / Add it to your authenticator / Enter a code                                                                                                                           |
| `password.label` / `password.hint`               | Your password / We ask again before changing how you sign in.                                                                                                                             |
| `password.submit` / `password.pending`           | Continue / Setting up                                                                                                                                                                     |
| `key.intro`                                      | Add this key to an authenticator app on your phone. Two-factor is not on yet.                                                                                                             |
| `key.label` / `key.copy` / `key.copied`          | Setup key / Copy key / Key copied                                                                                                                                                         |
| `key.open`                                       | Open in your authenticator app                                                                                                                                                            |
| `key.startOver`                                  | Start over                                                                                                                                                                                |
| `key.next`                                       | I have added it                                                                                                                                                                           |
| `code.label` / `code.hint`                       | Code from the app / The six digits the app shows now.                                                                                                                                     |
| `code.submit` / `code.pending`                   | Turn on two-factor / Checking                                                                                                                                                             |
| `code.invalid`                                   | That code did not match. Check the time on your phone and try the next one.                                                                                                               |
| `password.invalid`                               | That password is not right.                                                                                                                                                               |
| `rateLimited.title` / `rateLimited.body`         | Too many tries in a short time / Wait about ten seconds, then try again. Nothing you typed was lost.                                                                                      |
| `codes.title` / `codes.body`                     | Your backup codes / Each code works once if you lose your phone. They are shown only now, so keep them somewhere safe.                                                                    |
| `codes.copyAll` / `codes.copied`                 | Copy all / Backup codes copied                                                                                                                                                            |
| `codes.download`                                 | Download as a text file                                                                                                                                                                   |
| `codes.copyFailed`                               | Your browser would not copy them. Select the codes and copy them by hand.                                                                                                                 |
| `codes.stored` / `codes.done`                    | I have stored these backup codes / Done                                                                                                                                                   |
| `codes.lost`                                     | If you close this page first you can make a new set from this screen, and the old one will stop working.                                                                                  |
| `on.title` / `on.badge`                          | Two-factor is on / On                                                                                                                                                                     |
| `on.body`                                        | We ask for a code from your authenticator app when you sign in with your email and password. Signing in with Google, Apple or a passkey does not ask for one.                             |
| `off.action` / `off.title`                       | Turn off two-factor / Turn off two-factor?                                                                                                                                                |
| `off.body`                                       | Anyone with your password will be able to sign in without a code. Your other signed-in devices stay signed in; sign them out from security settings.                                      |
| `off.confirm` / `off.pending` / `off.cancel`     | Turn off / Turning off / Keep it on                                                                                                                                                       |
| `off.done`                                       | Two-factor is off                                                                                                                                                                         |
| `nopassword.title` / `nopassword.body`           | Set a password first / Two-factor needs a password on this account. We will email you a link to set one; doing so signs you out everywhere, and you can come back here after you sign in. |
| `nopassword.action`                              | Email me a link                                                                                                                                                                           |
| `alreadyOn.title` / `alreadyOn.body`             | Two-factor is already on / It was turned on in another window. It is shown here.                                                                                                          |
| `security.twoFactor.onHint` (reworded)           | A code from your authenticator app is asked when you sign in with your email and password.                                                                                                |

**09-S2c**: `setup.action` Show setup key again; `setup.title` Setup key; `setup.body` Add this key to another device. The key already
on your other devices keeps working; `setup.done` Done; `replace.action` Replace backup codes; `replace.title` Replace your backup
codes?; `replace.body` You will get a new set. The set you have now stops working as soon as you continue; `replace.confirm` /
`replace.pending` Replace / Replacing; `replace.done` New backup codes ready.

**09-S2d**: `key.matrixLabel` Setup code. The same key is typed below; `key.matrixFailed` We could not draw a code for this key. Type it
into your authenticator app instead.

## 📝 Edge Cases & Failure Scenarios

| Scenario                                                             | Behaviour                                                                                                                                     |
| -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| Second tab: factor turned on in tab A, tab B still shows step 1      | B's pre-check sees it on and shows the "on" view; if the pre-check is raced, 09-S2a refuses with `TWO_FACTOR_ALREADY_ENABLED`, no row changes |
| Abandoned enrolment (closed at step 2 or 3)                          | The row stays unverified, sign-in is unaffected; next visit shows step 1; `enable` re-rolls the secret                                        |
| Wrong password at step 1                                             | Field error on the password input; nothing is stored in state                                                                                 |
| Wrong code at step 3 (repeatedly)                                    | Field error each time; the 10-per-minute rule applies; the sign-in lockout does not, and the copy does not claim it                           |
| 429 on any password-gated call                                       | Warning alert with the ten-second wait; typed values kept; the button re-enables after the wait; no automatic retry                           |
| Network drop on `enable` after the server wrote                      | Unknown outcome: the person sees the error, presses "Try again", which re-rolls the unverified secret. Never an automatic retry               |
| Network drop on `verify-totp`                                        | The person is told it is unknown; reloading shows "on" (and then no sheet) or step 1; "Replace backup codes" is the way to get a set          |
| Closed the tab on the backup-code sheet                              | Factor on, codes unseen; the "on" view offers "Replace backup codes"                                                                          |
| Google- or Apple-only account                                        | The "set a password first" panel; the server would refuse without a password anyway                                                           |
| `listAccounts` fails                                                 | The wizard renders; the server's `INVALID_PASSWORD` is the answer                                                                             |
| Clipboard refused                                                    | `codes.copyFailed`; the codes stay selectable                                                                                                 |
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
   `auth.error.twoFactorOn.*` keys, present in 23 locales.

09-S2b:

5. A signed-in visitor on `/two-factor` lands on `/settings/two-factor`; a visitor with no session stays on the challenge; a
   signed-out visitor on `/settings/two-factor` lands on `/login`.
6. With the factor off and a password on the account, the three steps turn it on; at no point is the key, the URI, the password or a
   backup code present in the URL, storage, loader data or console.
7. Step 3 never sends `trustDevice`; `INVALID_CODE` is a field error; "Done" on the sheet is disabled until the box is ticked and
   clears the codes from state.
8. A router invalidation while the sheet is open does not unmount it.
9. With the factor on, the screen shows the status view and never the wizard; "Turn off" asks for the password only and, on success,
   shows the wizard's first step again.
10. A 429 keeps what was typed and shows the wait; nothing retries by itself; no endpoint is called on mount.
11. An account with no credential account sees the panel and a link to `/forgot-password`; a `listAccounts` failure shows the
    wizard.
12. No string on the screen says a code is needed "on every sign-in"; `security.twoFactor.onHint` is reworded in 23 locales.
13. `CodeInput` lives in `src/components/ui`, the sign-in challenge uses it unchanged, and `grep -rn CodeInput src` finds no import
    from the form kit.
14. `/settings/two-factor` is in `APP_ROUTES` and the authenticated route walk passes with a silent console.

09-S2c:

15. "Show setup key again" calls `getTotpUri` and never `enable`; "Replace backup codes" calls `generateBackupCodes`, states that the
    old set stops working, and shows the new set once through the same sheet. Each asks for the password again.

09-S2d:

16. The encoder returns a square matrix whose side is `17 + 4 * version`, chooses the smallest version that fits, throws a named
    error one byte past version 10 at level M, and passes the known-answer vectors. A rendering is read correctly by a phone
    authenticator (recorded in the PR).
17. The matrix has an accessible name and the typed key is on screen in every case.

## 📝 Risks & Impact Review

- **Authentication change (09-S2a, 09-S2b).** Both are `risk-high` and `security`: they gate a working second factor. The guard is
  server-side and tested through the real handler; the screen is courtesy on top.
- **Existing exposure, not made worse and not fixed here.** The four password-gated endpoints take roughly 72 password guesses a
  minute per IP with no lockout, and the counter is not atomic. A stolen session can try passwords through them. The slicer files a
  follow-up.
- **Social and passkey sign-in skip the code.** The factor protects password sign-in only. The copy says so. Whether the other doors
  should ask is a product decision for a follow-up.
- **Closing the sheet loses the codes.** Unavoidable (they are shown once); the recovery is "Replace backup codes".
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
- Email or SMS one-time codes, trusted-device management, signing out other devices on a factor change.
- The change-password and passkey-management screens.

### Blockers

None. The matrix-code encoder is the one capability absent from the pinned dependency set, and it is already dispositioned as
a hand-rolled restricted subset; the typed key keeps the feature working if the encoder is late. No package, no binding, no
third-party service.

### Reference-row disposition

`ACC-02` moves `partial` to `partial` with two named follow-ups (show existing codes / count, a code on turn-off). It is closed by
the follow-ups, not by this stage.

## 📋 Phasing

| Ticket | Delivers                                             | Blocked by |
| ------ | ---------------------------------------------------- | ---------- |
| 09-S2a | The server-side guard and its test                   | none       |
| 09-S2b | Turn on (typed key), the on view, turn off, redirect | 09-S2a     |
| 09-S2c | Show setup key again; replace backup codes           | 09-S2b     |
| 09-S2d | The scannable code                                   | 09-S2b     |

09-S2c and 09-S2d are independent of each other; 09-S2d should not rank below 09-S2c, because typing the key by hand is the roughest
edge 09-S2b leaves.

## 📋 Implementation Plan

### Phase 1 - the guard (09-S2a)

1. `src/server/auth/two-factor-guard.ts` and its wiring in `src/server/auth/index.ts` (add `before`, keep `after`).
2. A test in `src/server/auth/__tests__/` through the real `auth.handler`, using the harness `auth-handler-closure.test.ts`
   builds: enabled account refused with the secret and codes unchanged and the old code still verifying; no row allowed; unverified
   row allowed; allowed again after `disable`.
3. `TWO_FACTOR_ALREADY_ENABLED` in `describeFailure`, two keys in `en/auth.ts`, 23 locales.

### Phase 2 - turn it on, see it, turn it off (09-S2b)

1. Lift `CodeInput` to `src/components/ui/code-input.tsx`, export it, update `two-factor.tsx`, add a small test.
2. The `beforeLoad` in `src/routes/(auth)/two-factor.tsx`; the route, its components and helpers; `pnpm generate-routes`.
3. Copy: `twoFactor.*` keys and the `onHint` rewording in 23 locales; a `Backup code` entry in `CONTEXT.md`.
4. `APP_ROUTES` entry and the journey.

### Phase 3 - second device and new codes (09-S2c)

The two password dialogs, their calls, the shared key display and sheet, their keys.

### Phase 4 - the scannable code (09-S2d)

`encode.ts` with vectors, the SVG component, the insertion into step 2 and the setup dialog, the two keys.

## Verification

- The gate in `validation.commands` (`.ai/agentic.config.json`) on every phase's last commit. The parity count is recorded before and
  after each ticket; a ticket owns every failure that is not a missing translation it was told to add.
- **Server** (`server` project), 09-S2a: the real-handler test above. This is the tenancy-equivalent test: `two_factor` has no
  `organization_id` and is never reached through a `TenantScope`, so nothing is appended to
  `src/server/repos/__tests__/tenant-isolation.test.ts`; the boundary that applies is a person against their own session, and the
  test asserts that an enabled account's secret cannot be overwritten.
- **Unit** (`ui` project): `secretOf`, `groupKey` and `backupCodesFile`; the wizard and the "on" view with `#/lib/auth/client`
  mocked (as `workspace-switcher.test.tsx` does): the three steps, `INVALID_PASSWORD`, `INVALID_CODE`, the 429 state through
  `describeFailure`, the pre-check refusal, the no-password panel and the `listAccounts` failure, the sheet's gating and clearing,
  the invalidation that does not unmount the sheet, no call on mount; the lifted `CodeInput`. The encoder: published known-answer
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

| #   | Question                                                                                         | Applied default                                                                                                                                                                                                                                          | Why                                                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The plan promises "show recovery codes", an empty state and turn-off with a code. What ships?    | Only what the library does from the browser: replace (never show) backup codes, no empty state, turn-off by password, "show setup key again". One follow-up for the remaining-codes count; the code-on-turn-off is a security decision, also a follow-up | Decided by product owner sub-agent (confidence high): no browser call returns the existing set or a count; a server function around `viewBackupCodes` is risk-high auth code this slice does not need; "replace" covers the real need                     |
| 2   | One word for the codes                                                                           | "Backup codes" everywhere, including a `Backup code` glossary entry                                                                                                                                                                                      | Decided by product owner sub-agent (confidence high): the sign-in screen already says "backup code"; one thing, one name                                                                                                                                  |
| 3   | The 15-minute display expiry                                                                     | Dropped. "Start over" is offered while the factor is off and asks for the password again                                                                                                                                                                 | Decided by product owner sub-agent (confidence medium): the secret is durable server-side from `enable` and the factor is off until a code proves it; the timer protects almost nothing and costs a state, copy and friction                              |
| 4   | A working factor can be overwritten by `enable`                                                  | A server-side `hooks.before` guard (own ticket, first), plus the screen's pre-check as courtesy; the unverified row still passes                                                                                                                         | Decided by security and tenancy sub-agent (confidence high): the old secret and codes die at once and no self-service way back exists; a control only in the interface is not access control; the endpoint is live today                                  |
| 5   | `CodeInput` and `describeFailure` live in `(auth)`; the screen is in `_app`                      | Lift `CodeInput` to `src/components/ui` (no re-export); leave `describeFailure` and its `auth.error.*` keys where they are and import across                                                                                                             | Decided by software architect sub-agent (confidence medium): `CodeInput` is a pure control; the form kit is for sessionless screens; duplicating either gives one concept two owners; cross-tree imports have precedent                                   |
| 6   | Slicing                                                                                          | Four tickets: guard; turn on / on view / turn off; second device and new codes; scannable code. The "on" view and turn-off are in the first screen ticket                                                                                                | Decided by product owner and software architect sub-agents (confidence medium): "Manage" and "Turn on" both land on the new route, so the first screen ticket must handle "on" or it would call `enable` on a working factor; the encoder is its own risk |
| 7   | Accounts with no password                                                                        | `authClient.listAccounts()` detects a missing `credential` account and shows a "set a password first" panel linking to `/forgot-password`; `allowPasswordless` stays unset; a failed detection falls through to the wizard                               | Decided by security and tenancy and product owner sub-agents (confidence high): without it the person is told their password is wrong; passwordless enrolment lets a session alone re-key the factor and the factor would never be asked for              |
| 8   | An "open in your authenticator app" link                                                         | Included beside the typed key, as an anchor to the `otpauth://` URI                                                                                                                                                                                      | Applied default: a phone cannot scan its own screen and the typed key is the only other way in; no code, no dependency, the URI is already in state                                                                                                       |
| 9   | The existing hint says a code is required on every new sign-in                                   | Reworded to "when you sign in with your email and password", in 23 locales, in the screen ticket; the new copy says Google, Apple and passkey sign-ins do not ask                                                                                        | Decided by product owner and security and tenancy sub-agents (confidence high): the plugin's challenge fires only on password sign-in; the claim is untrue today                                                                                          |
| 10  | Test layers                                                                                      | `ui` tests with the auth client mocked, encoder vectors, a real-handler test for the guard, one Playwright journey for the redirects, blind A/B frames, no baselines                                                                                     | Decided by software architect sub-agent (confidence high): ADR 0016 admits e2e only for routing and sessions; a real-endpoint enrolment test would fight the 3-per-10-seconds limit and test the library                                                  |
| 11  | The plan's source-and-line claims and pixel verification                                         | Replaced by today's lines, the gate, ADR 0016 and the A/B pair; i18n keys land in 23 locales                                                                                                                                                             | Verified against the repository: `scripts/ultrabuild` and the visual spec do not exist; the i18n rule moved                                                                                                                                               |
| 12  | The password-guessing exposure of the four gated endpoints, and sign-in doors that skip the code | Named under Risks and Out of scope; the slicer files follow-ups                                                                                                                                                                                          | Decided by security and tenancy sub-agent (confidence high): it exists today without any screen and fixing it needs auth-config work this stage does not own                                                                                              |
