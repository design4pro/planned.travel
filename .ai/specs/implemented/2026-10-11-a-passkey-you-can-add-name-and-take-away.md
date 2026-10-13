# Passkeys: add one, name it and take it away

| Field              | Value                                         |
| ------------------ | --------------------------------------------- |
| **Status**         | implemented                                   |
| **Issue**          | none                                          |
| **Spec PR**        | #1140                                         |
| **Implementation** | #1185, #1202, #1207                           |
| **Plan**           | 09-S1 (docs/plans/09-account-and-settings.md) |

## 📝 TLDR

Plan stage `09-S1` (reference row `ACC-03`, partial to done) repairs a dead link. `src/routes/_app/settings/security.tsx:194` sends
"Manage passkeys" to `/passkeys`, and no such route exists (`src/routeTree.gen.ts` has none). A traveller can **sign in** with a
passkey (`signInWithPasskey`, `login.tsx`) but can never **register** one, rename one, or remove one. The server half is mostly
there: the first-party WebAuthn plugin (`src/server/auth/passkey/plugin.ts`) already has registration options and verify, a list and
a delete, and the list already returns `name`, `deviceType`, `backedUp`, `createdAt` and `lastUsedAt`. What is missing is a
browser-side registration ceremony, a rename endpoint, a delete that re-proves identity, a ceiling and rate limits on what a person
can create, and the screen.

The stage repairs the **destination, not the link**: `/passkeys` becomes a real route and `security.tsx` is not touched (it belongs
to stage `09-S3` in the same wave). It ships as **three tickets that are each a full path from the auth endpoint to the screen**:

1. **09-S1a - see your passkeys and add one.** The route, the list (skeleton, empty, error, unsupported), the registration ceremony in
   `src/lib/auth/client.ts`, the never-persisted fallback name every unnamed row shows, the per-user ceiling, a fresh-session rule and an
   impersonation veto on registration, and the registration rate limits.
2. **09-S1b - name a passkey.** `POST /passkey/rename` (with its rate limit and the same impersonation veto) and the inline rename (a new
   row opens in rename mode).
3. **09-S1c - take a passkey away.** `/passkey/delete` re-proves identity (password, or a fresh session when the account has none),
   `requiresPassword` on the list response (its only reader is the dialog), refuses an impersonated session, the delete dialog, the
   delete rate limit.

## 📝 Problem Statement

Measured at HEAD (the plan was written earlier; where it and the code disagree, this section is the current truth):

- `/passkeys` does not exist. `security.tsx:194` is `<a href="/passkeys">` (plan said `:163`). The security row says "Manage
  passkeys" and lands on the not-found panel of the app shell.
- `src/lib/auth/client.ts` has the **authentication** ceremony only (`signInWithPasskey`, `isPasskeySupported`, `postToAuth`,
  `passkeyFailure`, `toTransports`, base64url codecs). `postToAuth` always sends `POST`. `/passkey/list` is a **`GET`** endpoint
  (`plugin.ts:395`), so the plan's "thin `postToAuth` wrappers" cannot read it without a method parameter. There is no
  `authClient.passkey.*` namespace: Better Auth generates none for a first-party plugin.
- `plugin.ts` endpoints: `register/options`, `register/verify` (optional `name` 1 to 64 chars), `authenticate/options`,
  `authenticate/verify`, `list` (`limit: 50`), `delete` (body `{ id }`, owner check, nothing else). There is **no rename**, **no
  password or freshness check on delete**, **no ceiling** on credentials per user, and **no rate-limit rule** for any
  `/passkey/register/*`, `/passkey/delete` or rename path (`rateLimit.customRules` at `src/server/auth/index.ts:318-328` lists only
  `/passkey/authenticate/verify`), so they fall under the default 100 per 60 s.
- `toPublicPasskey` (`plugin.ts:486`) returns `id`, `name`, `deviceType`, `backedUp`, `aaguid`, `createdAt`, `lastUsedAt` and never the
  public key. Registration uses `attestation: 'none'`, so `aaguid` says nothing a person recognises; **no aaguid-to-name table
  exists** in the repository, and this stage does not build one.
- `src/lib/i18n/messages/en/settings.ts` **already exists** (637 lines) and already holds `security.passkeys.{label,hint,action}`
  (`:253-256`). The plan's "new file, English only" is out of date: the 23-locale catalogue is complete, so every key this stage adds
  lands in all 23 locales in the same change (`i18n-messages` skill; the parity test is green and must stay green).
- The plan's visual spec (`e2e/account-and-settings.visual.spec.ts`, `e2e/__screenshots__/`, `scripts/ultrabuild/capture.mjs`) does not
  exist: ADR 0016 removed baselines and pixel comparison; `scripts/visual/capture.mjs` takes the frames a person reads at review and
  `docs/plans/12-verification-protocol.md` (brought to HEAD) governs.
- The plan's claim that "WebAuthn cannot complete headlessly" is wrong for Chromium: the CDP `WebAuthn` domain provides a virtual
  authenticator through `context.newCDPSession(page)`.
- Better Auth facts this design leans on, all in `node_modules/better-auth/dist`: `ctx.context.internalAdapter.findCredentialAccount`,
  `ctx.context.password.verify`, `ctx.context.adapter.count`, `ctx.context.sessionConfig.freshAge` (unset in `index.ts`, so the library
  default of 24 h applies, `context/create-context.mjs:148`; sessions themselves last 30 days, `index.ts:47`), and a plugin-level
  `rateLimit` array that the limiter applies (`api/rate-limiter/index.mjs:251-258`). The library's own account deletion uses the same
  rule this stage adopts for delete: a password when the account has one, session age otherwise (`api/routes/update-user.mjs:335-338`).

The problem is therefore a missing screen plus three missing server guards, on a surface where a mistake is a security mistake:
adding a sign-in factor is how an attacker on a borrowed or impersonated session keeps access after it ends, and removing one is how
they take it from its owner.

## 📝 Proposed Solution

### What the stage owns and what it does not

Owns: `src/routes/_app/passkeys.tsx`, `src/routes/_app/-ui/passkey-manager.tsx`, the passkey additions to `src/lib/auth/client.ts`,
the endpoint changes in `src/server/auth/passkey/plugin.ts`, `src/routes/_app/-lib/passkey-errors.ts`, the `passkeys.*` block of
`messages/*/settings.ts` (23 files), the allow-list additions to `src/routes/_app/settings/-lib/__tests__/copy-rules.test.ts`, a **Passkey**
entry in `CONTEXT.md`, a sentence in `docs/ACCESS.md` §6.4, the tests below and `e2e/account-and-settings.spec.ts`.

Does **not** touch: `src/routes/_app/settings/security.tsx` (stage `09-S3`), `src/server/auth/index.ts` (`09-S3` edits it; the rate-limit
rules live in the plugin, see Resolved assumption 2; the one exception is the client-address fix of the Rate limits paragraph, if its proof fails), `src/routes/(auth)/*` (`09-S2` and `09-S3` repair `/two-factor` and
`/reset-password`), `src/routes/_app/-ui/settings-nav.tsx` (`09-S8`), the `passkey` table (no migration, no column).

### Neighbouring work

`09-S2` (two-factor enrolment) and `09-S3` (password, email, deletion) share the wave and the `settings.*` catalogue file, each under its
own prefix (`twoFactor.*`, `account.*`); this stage writes only `passkeys.*` and appends a block without reordering or reformatting any
other. `09-S8` will give the settings shell a section for this screen; until then the screen is reached from Security and has a back link.

### Phase boundaries (tickets)

| Ticket | A person can...                                              | Server change                                                                                                                     | Screen change                                                                          |
| ------ | ------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| 09-S1a | open `/passkeys`, see their passkeys, add one on this device | ceiling of 20; fresh-session rule and impersonation veto on registration; rate rules for `register/options` and `register/verify` | route, list states, add button, status region, fallback name, `requestAuth` + ceremony |
| 09-S1b | name a passkey, rename it later                              | `POST /passkey/rename` with its impersonation veto and rate rule                                                                  | new row opens in rename mode; per-row Rename                                           |
| 09-S1c | remove a passkey, proving it is them                         | list returns `requiresPassword`; `/passkey/delete` password or fresh session, impersonation veto, rate rule                       | delete dialog (password field or plain confirmation)                                   |

Order is a, b, c. a mints `e2e/account-and-settings.spec.ts` and the `passkeys.*` block; b and c append to both.

### Server: `src/server/auth/passkey/plugin.ts`

No repository and no server function are added: SQL for this table lives behind Better Auth's adapter inside the plugin, the
`passkey` table has no `organization_id` (a credential authenticates a person, not a workspace), and the screen talks to the auth
endpoints like `login.tsx` does. `src/server/repos` and `createServerFn` are not involved.

**Error codes.** Every refusal this stage adds carries a stable `code` next to the English `message` (`ctx.error('BAD_REQUEST', { code,
message })`), because the screen branches on the code and renders catalogue text; it never renders `AuthFailure.message`. The codes:
`PASSKEY_LIMIT_REACHED`, `PASSKEY_PASSWORD_REQUIRED`, `PASSKEY_INVALID_PASSWORD`, `PASSKEY_SESSION_NOT_FRESH`, and (`FORBIDDEN`)
`PASSKEY_IMPERSONATED`. A foreign or missing id is
`NOT_FOUND` with code `PASSKEY_NOT_FOUND` (never `FORBIDDEN`, so the endpoint does not confirm that another person's credential id
exists).

**Guards common to the four mutating endpoints (09-S1a for registration, 09-S1b for rename, 09-S1c for delete).** Evaluated first, before any
read or write:

- _Impersonation veto._ `ctx.context.session.session.impersonatedBy != null` (the `workspace-writes.ts:74` rule: an empty
  string counts as impersonation. `guard.ts:82` reads a session that `tenant.ts` has normalised through `asString`, which turns `''` into `null`,
  so the raw check here is the stricter of the two and these endpoints are never weaker than the existing guard) means `FORBIDDEN` with `PASSKEY_IMPERSONATED`,
  on `register/options`, `register/verify`, `rename` and `delete`. An impersonated session is brand new, so it would pass any freshness rule, and a passkey an
  operator registers outlives the 900-second impersonation with no audit row. That breaks `docs/ACCESS.md` §6.4 ("a debugging instrument, not
  a second set of admin hands"); §6.4 gains a sentence naming passkey registration, rename and removal among the refused actions.
- _Fresh session for registration._ `register/options` and `register/verify` require, for **every** account,
  `Date.now() - session.createdAt < ctx.context.sessionConfig.freshAge * 1000` (the library's knob, `0` disables the check, as in the library),
  otherwise `PASSKEY_SESSION_NOT_FRESH`. A borrowed 30-day session that adds a passkey would otherwise keep access after a password reset,
  because `revokeSessionsOnPasswordReset` revokes sessions and not passkeys.
- _One definition of "has a password"._ `Boolean(account?.password)` where `account = await ctx.context.internalAdapter.findCredentialAccount(user.id)`
  (the library's `shouldRequirePassword`), used for `requiresPassword` on the list **and** for the delete branch. Both land in 09-S1c, beside
  the dialog that is the only reader of the hint, so the definition is written once. A credential account row with a
  null password takes the passwordless (freshness) path and never reaches `password.verify` with a null hash.

**Ceiling (09-S1a).** A constant `MAX_PASSKEYS_PER_USER = 20`, exported from the plugin module. `register/options` and `register/verify` both
count the user's rows with `ctx.context.adapter.count({ model: 'passkey', where: [{ field: 'userId', value: user.id }] })` and refuse at 20 or
more with `PASSKEY_LIMIT_REACHED`. In `register/options` so the person is not walked through the platform sheet and then refused, and **before**
`createVerificationValue`, so a refused call writes no challenge row; in
`register/verify` as the real guard, run **before** `consumeCeremony` and before any attestation verification, so it needs no attestation
fixture to test. 20 sits below the `limit: 50` window of the list and of the exclude list, so both stay complete. Check-then-write is not
atomic: two parallel ceremonies can overshoot by one or two. That is accepted (the ceiling bounds storage, it is not a quota anyone sells) and
stated in the test as a known property, not asserted away.

**Rename (09-S1b).** `POST /passkey/rename`, `use: [sessionMiddleware]`, body `z.strictObject({ id: z.string().min(1), name:
z.string().trim().min(1).max(64) })`. It reads the record by id, compares `record.userId` to `ctx.context.session.user.id` before writing, and
answers `NOT_FOUND` on mismatch. It returns `{ passkey: toPublicPasskey(updated) }`. A rename never clears a name: clearing is not an operation
(Resolved assumption 3).

**Delete (09-S1c).** The body becomes `z.strictObject({ id: z.string().min(1), password: z.string().min(1).optional() })`. The server decides
whether a password is required, from `ctx.context.internalAdapter.findCredentialAccount(user.id)`; it never trusts the body or a flag sent by
the client:

- the account has a password (as defined above): a missing password is `PASSKEY_PASSWORD_REQUIRED`, a wrong one `PASSKEY_INVALID_PASSWORD`
  (both `BAD_REQUEST`), checked with `ctx.context.password.verify({ hash, password })`. `checkPassword` from the library is **not** used: it
  merges "no credential account" and "wrong password" into one error. The row survives either refusal;
- the account has no password (social or passkey-only sign-in, or a credential row with a null password): `Date.now() - session.createdAt` must be under
  `ctx.context.sessionConfig.freshAge * 1000` (the library's knob, never a constant of ours), otherwise `PASSKEY_SESSION_NOT_FRESH` asks the
  person to sign in again. When `freshAge` is `0` the check is off, as in the library.
- ownership is checked before the identity proof is evaluated, so a foreign id is `NOT_FOUND` whatever else was sent.

The order inside the handler is: find the record, check the owner, decide the identity proof, delete. A successful delete returns
`{ deleted: true }` as today.

**List (09-S1c).** `/passkey/list` returns `{ passkeys, requiresPassword }`. `requiresPassword` is `true` exactly when a credential account
with a password exists. It is a hint that decides which dialog the screen draws and nothing else; `/passkey/delete` re-decides on its own.
`toPublicPasskey` is unchanged.

**Rate limits, each ticket adding only its own rule.** The plugin gains a `rateLimit` array (the limiter applies plugin rules,
`rate-limiter/index.mjs:251-258`): 09-S1a adds `/passkey/register/options` 10 per 300 s and `/passkey/register/verify` 10 per 300 s; 09-S1b adds
`/passkey/rename` 5 per 300 s; 09-S1c adds `/passkey/delete` 5 per 300 s. The limiter keys on IP and path, not on the user, so the per-user ceiling
above is still needed. Better Auth reads the client address from `x-forwarded-for` only and falls back to one shared `no-trusted-ip` bucket per
path when it cannot resolve one, which would turn "5 per 300 s" on `/passkey/delete` into a limit for the whole product. 09-S1a's PR therefore
states how the client address resolves behind Cloudflare (the app already reads `cf-connecting-ip`, `src/server/fns/console/context.ts`) and
proves the limiter tells two clients apart, or sets `advanced.ipAddress` in a change it names. The proof uses the header shape production
delivers, not one hand-set `x-forwarded-for` per client (that passes trivially, and under `isTest()` an absent header becomes `127.0.0.1`); a
client that sends its own `X-Forwarded-For` can produce a two-value header, which resolves to the shared bucket, so the recommended fix is
`advanced.ipAddress.ipAddressHeaders: ['cf-connecting-ip']`, matching `src/server/fns/console/context.ts` and `src/server/audit/trail.ts`.
That setting re-keys the existing `customRules` (sign-in, sign-up, password reset, two-factor), so the PR says so and review checks it as a
change to all of those limits. Otherwise `src/server/auth/index.ts` is not touched. The in-memory harness of `auth-handler-closure.test.ts` does not exercise the
limiter by itself: each ticket's test asserts the shape of its rule in the array, and at least one rule per ticket is proven over HTTP through
`auth.handler` (the request past `max` answers `429`), which needs the test to turn `rateLimit.enabled` on for its own instance.

### Browser module: `src/lib/auth/client.ts`

Owner of every passkey call the browser makes; the screen never calls `fetch` itself and `src/lib/auth/client.ts` imports nothing from
`src/server`.

- `postToAuth` is generalised into one private `requestAuth(method, path, body?)` that keeps the existing failure shape (a thrown error
  carrying `authFailure`, with the payload's `code`), and `postToAuth` stays as the POST call sites use it. No second helper beside it.
- `isPasskeyEnrolmentSupported()` mirrors `isPasskeySupported()` and checks `navigator.credentials.create`; it is called from an effect.
- `registerPasskey()` runs the ceremony **without a name**: POST options, narrow with a type guard like `isAuthenticationOptions`,
  `navigator.credentials.create({ publicKey })` with `challenge`, `user.id`, `excludeCredentials` and `pubKeyCredParams` decoded from
  base64url, check the result is a `PublicKeyCredential` with an `AuthenticatorAttestationResponse`, encode `rawId`, `clientDataJSON` and
  `attestationObject` (and `getTransports()` when available), POST verify, return the new passkey. It returns the module's `PasskeyResult`
  family extended with the passkey on success, keeps the `{ ok: false, aborted: true }` arm for `NotAllowedError` and `AbortError`, and
  adds a distinct arm for `InvalidStateError` (the device already holds a passkey for this account, which `excludeCredentials` produces).
- `listPasskeys()`, `renamePasskey(id, name)`, `deletePasskey(id, password?)` return a result union with a normalised `AuthFailure`.

### Screen: `/passkeys`

Route `src/routes/_app/passkeys.tsx`; `_app` is a pathless layout, so the file produces exactly `/passkeys` and the session guard in
`_app/route.tsx` already applies. Default SSR. The loader does **not** call the auth endpoint (a loader is isomorphic, the endpoints are
cookie-authenticated HTTP handlers); `passkey-manager.tsx` fetches from an effect on mount with a declared pending state. `pnpm
generate-routes` regenerates `src/routeTree.gen.ts`, which is never hand-edited. The page composes `AppFrame`, `AppSections` and
`PageHeader` like `notifications.tsx`, with a back link to `/settings/security`. `passkey-manager.tsx` is UI only: no `server/` import, no
server function, no `fetch`.

## 📝 Architecture

| Concept                                                | Owner module                                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------- |
| Passkey endpoints, ceiling, identity proof, rate rules | `src/server/auth/passkey/plugin.ts`                                                                           |
| Browser ceremony, list, rename, delete, support checks | `src/lib/auth/client.ts`                                                                                      |
| The management screen                                  | `src/routes/_app/-ui/passkey-manager.tsx`, route `src/routes/_app/passkeys.tsx`                               |
| Failure to catalogue-key mapping                       | beside the manager (`src/routes/_app/-lib/passkey-errors.ts`), modelled on `src/routes/(auth)/-lib/errors.ts` |
| Copy                                                   | `passkeys.*` in `src/lib/i18n/messages/<locale>/settings.ts`                                                  |

`docs/SPEC.md` §8 is respected: the data stays behind the auth adapter (no repository), `components/ui` is only consumed, the screen
imports nothing from `server/`, and the catalogue prefix is disjoint from every other 09 stage.

## 📝 Data Model

None. The `passkey` table (`src/server/db/auth-schema.ts:188`, declared by the plugin schema at `plugin.ts:96-121`) keeps its shape: `id,
name, userId, credentialId, publicKey, algorithm, counter, deviceType, backedUp, transports, aaguid, createdAt, lastUsedAt`. No column,
no index, no migration. The table is auth-owned and user-keyed, with no `organization_id`.

## 📝 API Contracts

All under `/api/auth`, cookie-authenticated, each behind `sessionMiddleware` except the two sign-in endpoints.

| Endpoint                         | Change                                                                               | Success body                     | Refusals (`code`)                                                                                                                 |
| -------------------------------- | ------------------------------------------------------------------------------------ | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `GET /passkey/list`              | adds `requiresPassword` (09-S1c)                                                     | `{ passkeys, requiresPassword }` | 401 without a session                                                                                                             |
| `POST /passkey/register/options` | impersonation veto; fresh session; refuses at the ceiling before any write; 10/300 s | unchanged                        | `PASSKEY_IMPERSONATED`, `PASSKEY_SESSION_NOT_FRESH`, `PASSKEY_LIMIT_REACHED`                                                      |
| `POST /passkey/register/verify`  | impersonation veto; fresh session; ceiling before consume; 10/300 s                  | `{ passkey }`                    | `PASSKEY_IMPERSONATED`, `PASSKEY_SESSION_NOT_FRESH`, `PASSKEY_LIMIT_REACHED`, existing expiry and verification errors             |
| `POST /passkey/rename` (new)     | impersonation veto; owner check, strict body, 5/300 s                                | `{ passkey }`                    | `PASSKEY_IMPERSONATED`, `PASSKEY_NOT_FOUND`                                                                                       |
| `POST /passkey/delete`           | impersonation veto; optional `password`, fresh-session rule, 5/300 s                 | `{ deleted: true }`              | `PASSKEY_IMPERSONATED`, `PASSKEY_NOT_FOUND`, `PASSKEY_PASSWORD_REQUIRED`, `PASSKEY_INVALID_PASSWORD`, `PASSKEY_SESSION_NOT_FRESH` |

Zod v4 throughout, `z.strictObject` where the shape is closed, the `error` parameter for messages, `z.string().trim()` rather than a
post-parse trim. Authorisation comes from the session, never from the body.

## 📝 UI/UX

### Page (09-S1a)

`PageHeader` (eyebrow "Account", title "Passkeys", one sentence on what a passkey is for), a back link to Security, one primary **Add a
passkey** button, **one** status region (`role="status"`, mounted empty on the first render and never mounted conditionally) beside it, and
the list. Every outcome message below ("Passkey added", "No passkey was added", the exists and failed lines, "Name saved", "Passkey removed") is
written into that one region. Reused components, none rebuilt: `Card`, `Button`,
`IconButton`, `Badge`, `Dialog`, `Input`, `Field`, `Alert`, `EmptyState`, `Skeleton`, `Spinner`. Dates are `formatDate(iso, locale)` from
`src/routes/_app/-lib/format.ts` (the one date formatter), on a `tabular-nums` span for the last-used date.

The list is a `ul` of `li` rows labelled by an `h2` ("Your passkeys", under the `PageHeader` `h1`; the `EmptyState` title is an `h3` below it),
`aria-busy` while loading (as `skeleton.tsx` expects). Each **row**:
name (or the display-only fallback, below, rendered with `dir="auto"` so a Latin-script name sits correctly inside Arabic text), a `Badge`
**Synced** when `backedUp`, a `Badge` **On one device only** when `deviceType` is `singleDevice`, "Added {date}", "Last used {date}" or "Not
used to sign in yet", and the row actions (a per-row Rename and Remove, each named with the passkey). `deviceType` is the authenticator's
report about syncing, not "the device in your hand", so the badge says what it knows and nothing about "this device". A credential that is
`multiDevice` but not `backedUp` shows neither badge; each badge has a text label, never colour alone.

**States, all drawn on `--color-surface-2`:**

- **Skeleton** - three `Skeleton` rows at the row's exact height, so the list does not move when it resolves (layout shift 0).
- **Empty** - `EmptyState` with a `Fingerprint` glyph, "No passkeys yet", one sentence on signing in with a fingerprint, face or security
  key, and the same primary button as the header.
- **Error** - `Alert tone="danger"` with catalogue text chosen by failure code, and a **Try again** button that re-runs the fetch and then
  moves focus to the list heading (`tabIndex={-1}`) so it is not lost when the alert unmounts. `429` is "Too many attempts. Try again in a few
  minutes." (the plugin windows are 300 s) and maps the same way in the add, rename and delete paths, not only here. A `401` on **any** request
  (list, add, rename, delete) means the session ended: it shows `passkeys.error.sessionEnded` with the **Sign in again** action (below) instead
  of a Try again that can never succeed. The generic failure body is advice only, because the title already says what failed.
- **Unsupported** - an explanatory line under the Add button, linked to it with `aria-describedby`, and the button disabled. Not a
  `Tooltip`: `Button` sets a native `disabled`, so the button cannot take focus or pointer events and a Radix tooltip never opens for anyone
  (`src/components/ui/button.tsx`), and `tooltip.tsx` says a tooltip is never the only place a fact appears. Until the support check (an
  effect) resolves the button is disabled with **no** explanation, so a supported browser never flashes the unsupported line.
- **Enrolling** - the button carries `loading` and `loadingLabel` ("Waiting for your device") for the whole ceremony **and** the verify call,
  so a second tap cannot start a second ceremony. `loading` makes the button natively disabled, which drops keyboard focus; every outcome
  (success, dismissed, exists, limit, failed) therefore puts focus back on the Add button, and from 09-S1b a success puts it on the new row's
  rename input instead. When the Add button is disabled at that moment (the limit outcome, an unsupported browser after a removal), focus goes
  to the list heading (`tabIndex={-1}`), never to `<body>`. The stale outcome is the exception: it moves focus to **Sign in again** (below).
- **Failed** - verify failures, an expired challenge or a dropped connection after the sheet closed: "The passkey was not added. Try again." in
  the status region in the danger tone.
- **Session not fresh or ended** - two different sentences, never swapped. `PASSKEY_SESSION_NOT_FRESH` (registration here, removal in 09-S1c)
  means the session is valid but too old: registration writes `passkeys.add.stale` ("For your safety, sign in again to continue.") into the
  status region, removal `passkeys.delete.stale` in the dialog. A `401` means the session is gone: `passkeys.error.sessionEnded` ("Your session
  has ended. Sign in again to continue."). Both offer the same **Sign in again** button, which moves focus to itself when it appears, shows
  `loading` while it posts to `SIGN_OUT_ENDPOINT` (`src/components/layout/session.ts`) and then goes to `/login?redirect=/passkeys`. A plain
  "sign in again" is a loop otherwise: `login.tsx` redirects a signed-in visitor straight back. A `401` during rename shows the same session-ended
  line and action beside the row.
- **Dismissed or timed out sheet** - a quiet neutral line "No passkey was added" in the polite status region, cleared when the reader tries
  again. Not a danger Alert and not a toast.
- **Already enrolled on this device** (`InvalidStateError`) - its own message "This device already has a passkey for your account".
- **At the ceiling** - "You have reached the limit of {value} passkeys. Remove one to add another." stays on screen, tied to the disabled
  button with `aria-describedby` exactly like the unsupported line; it is never only a passing status message.

### Naming (09-S1b)

The ceremony runs first and sends **no name**; the new row opens in rename mode and the status region announces "Passkey added". The input sits
in a `Field` with a **visible** label ("Name this passkey"; its accessible name contains that visible text, WCAG 2.5.3), a visible placeholder
("Name it, like Work phone"), `enterKeyHint="done"`, `maxLength={64}` and `dir="auto"`; only one row is in rename mode at a time, so the shared
label is never duplicated on the page. Every row carries a **Rename
{name}** control (`IconButton`, at least 24px, named per row) that moves focus into the input; Enter, Escape and a successful save return focus
to that control; a failed save keeps focus in the input and shows the error through `Field`'s `error`. Enter commits; blur commits only a non-empty changed value; Escape reverts; an empty value
or Escape sends no request and leaves `name` null. A spinner shows while the rename saves; a failed rename keeps the typed text and says so
inline. The input is a full-width tap target of at least 44px high and the design does not depend on focus opening the keyboard after the sheet
closes (iOS will not).

**The fallback name (shipped by 09-S1a, because every passkey a registers is unnamed).** A passkey with no name shows the **display-only
fallback** "Passkey · added {date}", built at render time from a catalogue key and `formatDate`, in the reader's locale. It is never saved, never
put in the verify body or any request body, and replaced by an aaguid-derived name only if a future stage owns such a table.

### Removing (09-S1c)

A **Remove {name}** `IconButton` per row opens a `Dialog` that names the passkey; the sentence that names it is the `DialogDescription`. When
`requiresPassword` is true it carries a password `Field` (`autocomplete="current-password"`, `required`, with `passkeys.delete.passwordHint` as its
hint; `Field` sets neither `required` nor `aria-required` on the control, so the `Input` itself carries the native `required` attribute) and the
confirm button; when false it asks for a plain confirmation (`passkeys.delete.confirmOnly`). The confirm button is `loading` with a loading label
("Removing the passkey") and Cancel is disabled while the request runs. Refusals are inline and mapped from the codes: `PASSKEY_PASSWORD_REQUIRED`
(`passkeys.delete.passwordRequired`) and `PASSKEY_INVALID_PASSWORD` (`passkeys.delete.wrongPassword`) through the password `Field`'s `error`;
**every other refusal** is one `Alert` inside the dialog (focusable with `tabIndex={-1}`), in both variants: `PASSKEY_SESSION_NOT_FRESH`
(`passkeys.delete.stale`, with the same **Sign in again** action), a `401` (`passkeys.error.sessionEnded`, same action), a `429`
(`passkeys.error.rateLimited`), and `PASSKEY_NOT_FOUND`, `PASSKEY_IMPERSONATED` or a network failure (`passkeys.delete.failed`); the dialog stays
open. After any refusal focus moves to the password field, or to that alert, so it never rests on `<body>` after the button's `loading`. `Escape` cancels and focus returns to the row's trigger. After a successful removal, focus moves
to the header Add button (never the empty state's duplicate; the list heading when that button is disabled), implemented with `onCloseAutoFocus` and
`preventDefault()` because the opener row is gone, and the status region announces "Passkey removed". If the last passkey of a person who also has no password is removed, nothing else
changes: sign-in by social provider still works, and the stage does not invent a password for a passwordless account.

### Motion and tokens

A newly added row enters at 220ms on `--ease-out-quint`, opacity and transform only, staggered 24ms when several render at once and capped at
eight; `prefers-reduced-motion: reduce` collapses it to opacity. The dialog uses the primitive's own motion. No token is missing; nothing is
hard-coded. Layout uses logical properties only (the catalogue includes Arabic), and the row actions mirror correctly in RTL.

## 📝 Visual change expected

Routes and states, light and dark, 360x800, 1280x900 and 2560x1440:

- `/passkeys`: skeleton, empty, list with several rows (a synced one, an on-one-device one, one with a name, one unnamed with the fallback, one
  never used), a row in rename mode, the unsupported line, the limit line, the error alert (and its 401 variant with Sign in again), the enrolling button, the dismissed and failed status lines, the delete dialog
  with a password field and the same dialog as a plain confirmation (the second reached by mocking `requiresPassword: false`), and the page
  in a non-English locale and in Arabic (right to left).
- `/settings/security` does not change by a pixel; its "Manage passkeys" link now lands on a real screen.

## 📝 Copy

All keys go to `src/lib/i18n/messages/en/settings.ts`, written **without** the `settings.` prefix and read as `settings.passkeys.*`, and land
in all 23 locales in the same change (`i18n-messages` skill). No file other than `messages/<tag>/settings.ts` is edited for copy; each other
09 stage's block is left as found. Numbers arrive as `{value}`, already formatted (`settings.ts` header); no key is plural on `count`. A key a
component does not read fails `coverage.test.ts`, so a ticket lands exactly the keys its components read. The English source:

| Key                                | Text                                                                                                       | Ticket |
| ---------------------------------- | ---------------------------------------------------------------------------------------------------------- | ------ |
| `passkeys.page.eyebrow`            | Account                                                                                                    | a      |
| `passkeys.page.title`              | Passkeys                                                                                                   | a      |
| `passkeys.page.description`        | A passkey lets you sign in with your fingerprint, your face or a security key instead of typing anything.  | a      |
| `passkeys.page.back`               | Back to security                                                                                           | a      |
| `passkeys.list.label`              | Your passkeys                                                                                              | a      |
| `passkeys.add.action`              | Add a passkey                                                                                              | a      |
| `passkeys.add.loading`             | Waiting for your device                                                                                    | a      |
| `passkeys.add.added`               | Passkey added                                                                                              | a      |
| `passkeys.add.dismissed`           | No passkey was added                                                                                       | a      |
| `passkeys.add.exists`              | This device already has a passkey for your account                                                         | a      |
| `passkeys.add.failed`              | The passkey was not added. Try again.                                                                      | a      |
| `passkeys.add.stale`               | For your safety, sign in again to continue.                                                                | a      |
| `passkeys.error.sessionEnded`      | Your session has ended. Sign in again to continue.                                                         | a      |
| `passkeys.signInAgain`             | Sign in again                                                                                              | a      |
| `passkeys.add.limit`               | You have reached the limit of {value} passkeys. Remove one to add another.                                 | a      |
| `passkeys.add.unsupported`         | This browser cannot create passkeys. Try another browser or device.                                        | a      |
| `passkeys.empty.title`             | No passkeys yet                                                                                            | a      |
| `passkeys.empty.body`              | Add one and you can sign in with your fingerprint, your face or a security key instead of typing anything. | a      |
| `passkeys.row.fallbackName`        | Passkey · added {date}                                                                                     | a      |
| `passkeys.row.added`               | Added {date}                                                                                               | a      |
| `passkeys.row.lastUsed`            | Last used {date}                                                                                           | a      |
| `passkeys.row.neverUsed`           | Not used to sign in yet                                                                                    | a      |
| `passkeys.badge.synced`            | Synced                                                                                                     | a      |
| `passkeys.badge.singleDevice`      | On one device only                                                                                         | a      |
| `passkeys.error.title`             | Your passkeys did not load                                                                                 | a      |
| `passkeys.error.retry`             | Try again                                                                                                  | a      |
| `passkeys.error.rateLimited`       | Too many attempts. Try again in a few minutes.                                                             | a      |
| `passkeys.error.generic`           | Check your connection and try again.                                                                       | a      |
| `passkeys.rename.action`           | Rename {name}                                                                                              | b      |
| `passkeys.rename.fieldLabel`       | Name this passkey                                                                                          | b      |
| `passkeys.rename.placeholder`      | Name it, like Work phone                                                                                   | b      |
| `passkeys.rename.saving`           | Saving the name                                                                                            | b      |
| `passkeys.rename.saved`            | Name saved                                                                                                 | b      |
| `passkeys.rename.failed`           | The name was not saved                                                                                     | b      |
| `passkeys.delete.action`           | Remove {name}                                                                                              | c      |
| `passkeys.delete.title`            | Remove this passkey?                                                                                       | c      |
| `passkeys.delete.body`             | You will no longer be able to sign in with {name}.                                                         | c      |
| `passkeys.delete.password`         | Password                                                                                                   | c      |
| `passkeys.delete.passwordHint`     | Enter your password to confirm.                                                                            | c      |
| `passkeys.delete.confirmOnly`      | Your account has no password. Confirm that you want to remove this passkey.                                | c      |
| `passkeys.delete.confirm`          | Remove passkey                                                                                             | c      |
| `passkeys.delete.cancel`           | Cancel                                                                                                     | c      |
| `passkeys.delete.wrongPassword`    | That password is not right.                                                                                | c      |
| `passkeys.delete.stale`            | For your safety, sign in again before removing a passkey.                                                  | c      |
| `passkeys.delete.removed`          | Passkey removed                                                                                            | c      |
| `passkeys.delete.failed`           | The passkey was not removed. Try again.                                                                    | c      |
| `passkeys.delete.removing`         | Removing the passkey                                                                                       | c      |
| `passkeys.delete.passwordRequired` | Enter your password to remove this passkey.                                                                | c      |

`{name}` is the passkey's own name or the fallback; user-typed names are rendered as text, never as markup, and wherever `{name}` sits inside a
sentence (`delete.body`, the row actions) it is wrapped in a `dir="auto"` element (`bdi`). The server's English `message`
is never shown. The word "passkey" follows `auth.ts` (`passkey.action`) and `settings.ts` (`security.passkeys.*`); "Synced" is new vocabulary, introduced here.
`signInAgain` is the action label shared by the registration, list and delete stale-session states; `passkeys.add.stale` is the registration
sentence, `passkeys.delete.stale` the removal one. `passkeys.add.added` is written into the status region by 09-S1a (and from 09-S1b the focus
moves to the rename input). The copy gate `src/routes/_app/settings/-lib/__tests__/copy-rules.test.ts` is extended in 09-S1a by adding
`passkeys.tsx`, `passkey-manager.tsx` **and `passkey-errors.ts`** (the code-to-key table that reads `add.limit`, `add.exists`, `error.rateLimited`,
`delete.wrongPassword` and the stale keys) to its walked sources and to its "reads every source it is meant to" list, exactly as
`basemap-picker.tsx` was added; otherwise the keys read only there look like dead copy to its orphan check (`coverage.test.ts` walks all of
`src` and would stay green).

## 📝 Edge Cases & Failure Scenarios

| Case                                                                  | Behaviour                                                                                                                                               |
| --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser without `navigator.credentials.create`                        | Button disabled, explanatory line; no flash before the effect runs.                                                                                     |
| Platform sheet dismissed or times out                                 | Quiet status line; no error colour, no toast.                                                                                                           |
| Device already holds a passkey for this account                       | Its own message; not the generic error and not the dismissed case.                                                                                      |
| Second tap during the ceremony or verify                              | Button is `loading` and disabled for the whole span.                                                                                                    |
| Account at 20 passkeys                                                | `register/options` refuses with `PASSKEY_LIMIT_REACHED`; the screen shows the limit sentence; no sheet opens.                                           |
| Two ceremonies in parallel at 19                                      | May end at 21; accepted and documented (no atomic count-and-insert in the adapter).                                                                     |
| List request fails or returns 429                                     | Error alert with Try again; 429 says so by name.                                                                                                        |
| Rename to an empty string, Escape, or blur unchanged                  | No request; name stays as it was (null stays null).                                                                                                     |
| Rename of another person's credential id                              | `NOT_FOUND`; the other row is unchanged.                                                                                                                |
| Rename request fails                                                  | Text stays, inline "The name was not saved".                                                                                                            |
| Delete with a wrong password / no password on a password account      | `BAD_REQUEST` with the matching code; the row survives; the dialog says so inline and stays open.                                                       |
| Delete on a passwordless account with a session older than `freshAge` | `PASSKEY_SESSION_NOT_FRESH`; the row survives; the dialog asks the person to sign in again.                                                             |
| Delete of another person's credential id                              | `NOT_FOUND` whatever else was sent; the other row is unchanged.                                                                                         |
| Delete the passkey just used to sign in                               | Allowed; the session stays valid, the next sign-in uses another factor.                                                                                 |
| Session expired while the page is open                                | The list or an action answers 401; the screen shows `passkeys.error.sessionEnded` and the Sign in again action (not the "for your safety" line).        |
| Operator impersonating the member                                     | Registration, rename and delete answer `PASSKEY_IMPERSONATED`; the screen shows `add.failed`, `rename.failed` and `delete.failed` respectively.         |
| Registration on a session older than `freshAge`                       | `PASSKEY_SESSION_NOT_FRESH`; the screen offers Sign in again (sign-out, then `/login?redirect=/passkeys`).                                              |
| Removing a passkey that already opened sessions                       | Those sessions stay: a session does not record the credential that created it. A lost device's sessions are ended through session revocation, not here. |
| 23 locales, Arabic                                                    | All keys exist in every locale; logical CSS properties; `data-mirror-rtl` on directional icons.                                                         |

## ✅ Acceptance criteria

09-S1a:

1. `/passkeys` answers, hydrates and is console-silent for a signed-in member; an anonymous visitor is redirected by the `_app` guard.
2. `GET /passkey/list` returns only the caller's passkeys, and `toPublicPasskey` is unchanged (no public key in any response).
3. `register/options` and `register/verify` refuse at 20 credentials with `PASSKEY_LIMIT_REACHED`; `register/options` writes no challenge row when it
   refuses; `register/verify` refuses **before** the challenge is consumed or any attestation is verified, so a 21st request leaves 20 rows.
4. `register/options` and `register/verify` refuse an impersonated session with `PASSKEY_IMPERSONATED` (no row, no challenge written) and a stale
   session, for every account, with `PASSKEY_SESSION_NOT_FRESH`; a fresh session passes. `docs/ACCESS.md` §6.4 names the refusal.
5. `registerPasskey()` turns `NotAllowedError` and `AbortError` into `{ ok: false, aborted: true }`, `InvalidStateError` into its own arm, a non-OK
   verify into an `AuthFailure` with the server's status and code, and an unknown transport string is dropped.
6. Skeleton, empty, error (a named 429 and a 401 with `passkeys.error.sessionEnded` and Sign in again), unsupported, enrolling, dismissed, failed,
   exists, stale and limit states exist and are keyboard reachable; every outcome returns focus to the Add button, or to the list heading when
   that button is disabled, and the stale outcome to Sign in again; `passkeys.add.stale` shows only for `PASSKEY_SESSION_NOT_FRESH`; the one
   status region exists from first render; the limit and unsupported lines are `aria-describedby` of the disabled button; the layout shift
   after paint is 0 (Chromium).
7. A passkey without a name renders `passkeys.row.fallbackName` (display-only, with `dir="auto"`), and that text appears in no request body.
8. The `rateLimit` array carries `register/options` and `register/verify` (10 per 300 s each); one of them answers `429` past `max` over HTTP through
   `auth.handler`; `src/server/auth/index.ts` is unchanged unless the client-address proof in the Rate limits paragraph fails, and the PR says how the address resolves.
9. All `passkeys.*` keys of ticket a exist in 23 locales; `coverage.test.ts` and `parity.test.ts` stay green and the settings copy gate walks the
   three new sources (`passkeys.tsx`, `passkey-manager.tsx`, `passkey-errors.ts`).

09-S1b:

10. `POST /passkey/rename` trims, requires 1 to 64 characters, refuses any other field, refuses an impersonated session (`impersonatedBy` of `''`
    included), and answers `NOT_FOUND` for another user's id with that user's `name` unchanged; its `rateLimit` rule (5 per 300 s) is in the array.
11. A newly added row opens in rename mode with focus in a `Field` with a visible label; empty, Escape and an unchanged blur send no request;
    each row has a Rename control named with the passkey; focus returns to it after Enter, Escape or a saved name.

09-S1c:

12. `GET /passkey/list` also returns `requiresPassword` (true for a password account, false for a social-only account and for a credential row with
    a null password), and `POST /passkey/delete` on a password account without or with a wrong password is `BAD_REQUEST`
    (`PASSKEY_PASSWORD_REQUIRED`, `PASSKEY_INVALID_PASSWORD`) and the row survives; with the right password it deletes.
13. On a passwordless account (including a null-password credential row) a session younger than `freshAge` deletes and an older one is refused with
    `PASSKEY_SESSION_NOT_FRESH`; an impersonated session is refused with `PASSKEY_IMPERSONATED` and the row survives.
14. Another user's id is `NOT_FOUND` for delete and that user's row is byte-identical afterwards; its `rateLimit` rule (5 per 300 s) is in the array.
15. The dialog shows a password field (native `required` on the input) when `requiresPassword` is true and a plain confirmation otherwise, disables
    Cancel and shows a loading label while it works, returns focus to the trigger on cancel, shows every non-password refusal in one in-dialog alert
    that takes focus, moves focus to the password field after a password refusal, and after a removal to the header Add button (the list heading when
    it is disabled).

## 📝 Risks & Impact Review

- **Risk-high: authentication (a sign-in factor is added, renamed and removed).** The stage is claimed on the security and tenancy specialist's approving
  verdict recorded in Resolved assumptions 1, 2 and 12 and in the panel table (`SDLC.md` § Delegated decisions); the implementation PRs carry
  `risk-high` and `security`. The identity proof is decided on the server, never from the client's hint; an impersonated session cannot register,
  rename or remove a passkey.
- **Tenancy.** The `passkey` table is user-keyed with no `organization_id`: the isolation boundary here is user to user, and it is tested in
  `src/server/auth/passkey/__tests__/plugin-endpoints.test.ts`. No case is appended to `tenant-isolation.test.ts`: its contract is
  organization to organization, the table is never reached through a `TenantScope`, and a case there could not fail.
- **Quota.** A passkey is not a metered entity (no `organization_id`, nothing for `resolveLimits()` to resolve); the fixed ceiling of 20 and the
  rate rules are the whole storage control.
- **Rate limits are per IP and path**, not per user; a determined attacker behind many addresses is bounded by the password check itself and by
  the 24-hour freshness window for passwordless accounts.
- **Registration needs a fresh session but not a password.** A session cookie stolen within `freshAge` of sign-in can add a passkey that survives a
  password reset, and the owner gets no email when a passkey is added or removed. Accepted for this stage; a notification email, or the
  password on registration for accounts that have one, is a follow-up (filed when the stage ships), not part of it.
- **Parallel sessions on a passwordless account** can remove passkeys within the freshness window; accepted, same rule as the library's own
  account deletion.
- **Passkeys already used to open sessions.** Removing a passkey does not end those sessions (see Edge Cases); a person who lost a device ends them
  through session revocation, which is outside this stage.

### Out of scope

An aaguid-to-device-name table; a "last passkey" lockout guard (the product has other factors, and a person is never left without one by
design); passkey sign-in analytics; the settings-shell entry for this page (`09-S8`); the two-factor and password destinations (`09-S2`,
`09-S3`); editing `security.tsx`.

### Blockers

None. No dependency outside the `docs/SPEC.md` §3 pinned set; no binding in `wrangler.jsonc`; no third-party service; no row in another plan
gates this one.

### Reference-row disposition

`ACC-03` partial to **done** when ticket c merges.

## 📋 Phasing

Three tickets, in order a, b, c. Each ships a server change, the screen part that uses it and their tests; none is a horizontal layer. The
slicer cuts exactly these three (at most eight is the limit; this stage needs three).

## 📋 Implementation Plan

### Phase 1 - see your passkeys and add one (09-S1a)

1. `plugin.ts`: the impersonation veto and the fresh-session rule on both registration endpoints, `MAX_PASSKEYS_PER_USER` and the count guard in
   `register/options` (before `createVerificationValue`) and `register/verify` (before `consumeCeremony`), the plugin `rateLimit` array with the
   two registration rules, error codes; `plugin-endpoints.test.ts` (list isolation, ceiling, impersonated, fresh and stale, one rule over HTTP).
   `docs/ACCESS.md` §6.4 gains its sentence.
2. `client.ts`: `requestAuth`, `isPasskeyEnrolmentSupported`, `registerPasskey`, `listPasskeys`; `passkey-client.test.ts`.
3. `passkeys.tsx`, `passkey-manager.tsx` (including the fallback name for unnamed rows), `passkey-errors.ts`, the ticket-a keys in 23 locales, the
   `copy-rules.test.ts` allow-list, `pnpm generate-routes`; component tests.
4. `e2e/account-and-settings.spec.ts` minted: the page answers, hydrates, console silent; Chromium-only serial walk that adds a passkey with a
   virtual authenticator.
5. `CONTEXT.md`: a **Passkey** entry (it has none today).

### Phase 2 - name a passkey (09-S1b)

1. `plugin.ts`: `POST /passkey/rename` with the impersonation veto and its `rateLimit` rule; test cases (owner, strict body, trim, 64 limit, foreign
   id and the other user's name unchanged, impersonated).
2. `client.ts`: `renamePasskey`; test.
3. Manager: rename mode; ticket-b keys in 23 locales; component tests; the spec walk gains rename.

### Phase 3 - take a passkey away (09-S1c)

1. `plugin.ts`: `requiresPassword` on the list (the one `hasPassword` definition), delete with `password?`, impersonation veto, fresh-session rule,
   codes, the `delete` rate rule; endpoint tests (`requiresPassword` true and false, wrong, missing, right password, null-password credential row,
   passwordless fresh and stale, impersonated, foreign id).
2. `client.ts`: `deletePasskey`; test.
3. Manager: delete dialog; ticket-c keys in 23 locales; tests; the spec walk gains remove and the `finally` cleanup.

## Verification

- The gate in `validation.commands` (`.ai/agentic.config.json`) on every phase's last commit. `pnpm test` includes the parity test: record the
  parity count before and after, and do not write into any locale directory other than `messages/<tag>/settings.ts`.
- Unit and endpoint:
  - `src/lib/auth/__tests__/passkey-client.test.ts` (the `ui` project): base64url round trip with `+`, `/` and a padding remainder;
    `NotAllowedError` and `AbortError` become `aborted`; `InvalidStateError` has its own arm; a non-OK verify becomes an `AuthFailure` with
    status and code; an unknown transport is dropped; `requestAuth` keeps `credentials: 'include'` and uses `GET` for the list.
  - `src/server/auth/passkey/__tests__/plugin-endpoints.test.ts` (the `server` project), on the pattern of
    `src/server/auth/__tests__/auth-handler-closure.test.ts`: a real in-memory `betterAuth` over `authSchema`, real cookies, passkey rows
    seeded through the adapter; the instance includes the admin plugin, as that file's does, so the adapter keeps `impersonatedBy`. Cases, each in
    the ticket named in Phasing: list shows only the caller's rows (a); `requiresPassword` true and false (c); ceiling (a; seed 20, the 21st
    `register/options` and `register/verify` are `PASSKEY_LIMIT_REACHED` and 20 rows remain, and `register/options` wrote no challenge row; no
    attestation fixture is needed because the guard runs first, but the `register/verify` body must still pass the endpoint's Zod credential
    schema, so the test sends a syntactically valid credential with dummy strings); impersonated sessions (a session row with `impersonatedBy` set,
    and one case with `impersonatedBy` of `''`) are refused on all four mutating endpoints with nothing written; registration with a fresh and with a stale session; `requiresPassword` and
    the delete branch agree for a credential row with a null password; a registration whose stored challenge belongs to another user is refused (the guard at `plugin.ts:186-196`, held here so a later
    edit cannot drop it); rename (own id, foreign id, empty and 65-character names, extra field); delete (foreign id `NOT_FOUND` and the other row
    intact, wrong password, missing password on a password account, right password, passwordless with a fresh session, passwordless with a stale
    session); the plugin `rateLimit` array holds the rules its ticket adds, and at least one is proven over HTTP (the request past `max` answers `429`)
    with `rateLimit.enabled` on for that test instance. The module under test must not reach `cloudflare:workers` (AGENTS.md): the test
    mocks `../env` and `../db` the way `auth-handler-closure.test.ts` does.
  - Manager component tests (`ui` project): the unsupported line is a described-by sibling, never a tooltip; Escape, empty and unchanged blur send no
    request; the fallback is not in any request body; the dialog shows the password field or the plain confirmation from `requiresPassword`;
    focus returns after cancel and after removal; a `multiDevice`-not-`backedUp` credential shows no badge; no literal prop or JSX text (the copy
    gate).
- Tenant isolation: not appended to `tenant-isolation.test.ts`, for the structural reason in Risks; the user-to-user equivalent is the endpoint
  test above.
- Browser, per `docs/plans/12-verification-protocol.md` and ADR 0016 (no baselines, no pixel comparison; the plan's Verification block predates
  both): `e2e/account-and-settings.spec.ts`, shared route tables in `e2e/helpers/routes.ts` not edited. Everyone: `/passkeys` answers, hydrates, says
  nothing in the console (`watchConsole`), and the layout shift after paint is 0 (Chromium; `test.skip` on `mobile-safari`). One Chromium-only
  `test.describe.configure({ mode: 'serial' })` walk: `WebAuthn.enable` over `context.newCDPSession(page)` and `WebAuthn.addVirtualAuthenticator`
  (`ctap2`, `internal`, resident key, user verified), add a passkey, name it, rename it, remove it with the demo password
  (`DEMO_PASSWORD` from `e2e/helpers/session.ts`, never logged), and remove the authenticator and any created passkey in `finally`. The base URL
  must use the `localhost` hostname because the relying-party id is `localhost` (`src/server/auth/env.ts`); the walk fails loudly, not skips, when
  it does not. Name the describe among the fixture writers in `playwright.config.ts`'s `workers` comment. Run `PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm
exec playwright test --project=setup` then `... pnpm exec playwright test e2e/account-and-settings.spec.ts`, with the port from `bash .ai/scripts/e2e.sh`.
- Frames, the blind A/B pair a person reads at review, from `scripts/visual/capture.mjs`: `PT_SERVER_TODAY=2026-08-20 node scripts/visual/capture.mjs
--url "http://localhost:$PORT/passkeys" --out "<scratchpad>/shots/09-S1" --label B --viewports 360x800,1280x900,2560x1440 --themes light,dark --auth`
  and the declared states `--state empty`, `--state list-error`, `--state rename` and `--state delete` (reached with `page.route()` fakes of
  `/api/auth/passkey/list`, which `capture.mjs` cannot do: the states that need data the demo account lacks (rows, the 401 variant, the delete
  dialog) are screenshotted by the spec's own walk with `page.route()` fakes into the scratchpad, while `capture.mjs` takes the resting frames
  and `--state empty`, which the demo account reaches by having no passkeys). Every selector is a `data-part` this stage publishes
  (`passkey-add`, `passkey-list`, `passkey-row`, `passkey-rename`, `passkey-delete`, `passkey-status`), verified to resolve to exactly one element
  before a frame is filed.
- Definition of done: the `docs/SPEC.md` §7 checklist item by item in each PR body, and the §2 quality clauses (4px grid; hover, focus-visible,
  active, disabled and loading states; designed empty, loading and error states on `--color-surface-2`; motion 150 to 260 ms on
  `--ease-out-quint`, transform and opacity only, reduced motion honoured; light and dark parity; 360 to 2560 px with the dialog as the
  primitive's bottom sheet on a phone; keyboard end to end; WCAG 2.2 AA contrast; zero console errors).
- Documentation: the implementer greps `/passkeys`, `Manage passkeys`, `passkey/delete`, `passkey/list`, `ACC-03`, `messages/en/settings` and
  `copy-rules` across `docs/` and `.ai/`, updates every document that states what this stage changes (the plan's own `09-S1` block gets a
  one-line pointer to this spec's departures; `docs/ACCESS.md` §6.4 names passkey registration, rename and removal among the refused actions for an impersonated session; §2.6's statement that
  the `passkey` endpoints stay open stays true), and names
  the terms searched in the PR template's last box.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                                                      | Applied default                                                                                                                                                                                                                                                                                                                                                                                 | Why                                                                                                                                                                                                                                                                                                          |
| --- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | How does `/passkey/delete` re-prove identity for an account with and without a password?                      | A password account must send the password (missing and wrong are distinct `BAD_REQUEST` codes); a passwordless account must hold a session younger than `ctx.context.sessionConfig.freshAge`, else `PASSKEY_SESSION_NOT_FRESH`. The server decides which, never the client.                                                                                                                     | Decided by security and tenancy sub-agent (confidence high): the library's own account deletion uses the same rule; a plain confirmation does not stop a 30-day borrowed session; refusing passwordless users would leave a lost passkey unrevokable.                                                        |
| 2   | Where do the rate limits go, and what are they?                                                               | In the plugin's own `rateLimit` array, each ticket adding its own rule: `register/options` and `register/verify` 10/300 s, `rename` 5/300 s, `delete` 5/300 s. `src/server/auth/index.ts` is not touched, except for the client-address fix of the Rate limits paragraph if its proof fails. The 20-passkey ceiling counts with `adapter.count`, before any write and before `consumeCeremony`. | Decided by security and tenancy sub-agent (confidence high): the limiter applies plugin rules; `index.ts` belongs to `09-S3` in the same wave; limits are per IP and path so the per-user ceiling is still needed. The `register/options` rule was added on the panel's condition.                           |
| 3   | How is a passkey named, and what does an unnamed one show?                                                    | Ceremony first with no name; the new row opens in rename mode; an empty name is never sent; the unnamed row shows "Passkey · added {date}", built at render time and never persisted. No aaguid table.                                                                                                                                                                                          | Decided by UX sub-agent (confidence high): a name dialog before the platform sheet is one more step on a phone, a user-agent guess is wrong for synced passkeys, and a display-only fallback over a nullable name is reversible.                                                                             |
| 4   | How is the unsupported state shown?                                                                           | An explanatory line under the Add button tied by `aria-describedby`, button disabled; not a Tooltip; no line until the support check has run.                                                                                                                                                                                                                                                   | Decided by UX sub-agent (confidence high): a natively disabled button cannot take focus or pointer events, so a Radix tooltip never opens for anyone, and a tooltip may not be the only place a fact appears.                                                                                                |
| 5   | How is a dismissed sheet shown?                                                                               | A neutral polite status line "No passkey was added", cleared on retry; no error colour, no toast.                                                                                                                                                                                                                                                                                               | Decided by UX sub-agent (confidence high): a screen-reader user otherwise hears only `aria-busy` drop and cannot tell whether a passkey was added.                                                                                                                                                           |
| 6   | Which text does the screen show for a server refusal?                                                         | Catalogue text chosen by the refusal's `code`; the server's English `message` is never rendered; `InvalidStateError` has its own message.                                                                                                                                                                                                                                                       | Decided by UX sub-agent (confidence high): the plugin messages are hard-coded English, and a Polish reader must not see them.                                                                                                                                                                                |
| 7   | Where do the browser wrappers live, and how does the list GET go through `postToAuth`?                        | `src/lib/auth/client.ts`; `postToAuth` is generalised into one private `requestAuth(method, path, body?)` rather than a second helper.                                                                                                                                                                                                                                                          | Decided by software architect sub-agent (confidence medium): the plan's owned paths and the existing codecs and failure reducer live there; `list` is `GET`.                                                                                                                                                 |
| 8   | How does the screen learn whether the account has a password?                                                 | `/passkey/list` returns `requiresPassword`, computed on the server; it is a hint, and delete re-decides.                                                                                                                                                                                                                                                                                        | Decided by software architect sub-agent (confidence medium): the plan forbids a server function here, and a password field for a social-only account would be a dead end.                                                                                                                                    |
| 9   | How is the ceremony proven?                                                                                   | Unit and in-memory endpoint tests, plus one Chromium-only serial journey with a CDP virtual authenticator that adds, names, renames and removes a passkey; `finally` cleans up; WebKit is skipped.                                                                                                                                                                                              | Decided by software architect sub-agent (confidence medium): a stub cannot prove `rpId`, origin, base64url encoding or challenge consumption, which is what ADR 0016 allows Playwright for; the plan's "cannot complete headlessly" is wrong for Chromium.                                                   |
| 10  | Language and catalogue of the new copy?                                                                       | English `en-GB` source, in `messages/en/settings.ts` (which exists) and all 22 other locales in the same change; `security.tsx` is not edited.                                                                                                                                                                                                                                                  | Repository rule (`AGENTS.md`, `i18n-messages` skill): the 23-locale catalogue is complete and the parity test enforces it; the plan's English-only note predates it. Applied without a sub-agent: one defensible answer in the code.                                                                         |
| 11  | One ticket or several?                                                                                        | Three full-path tickets: add, name, remove; each ticket adds only its own rate rule and its own isolation case.                                                                                                                                                                                                                                                                                 | Applied default; the product owner confirmed the slicing and moved the rename rate rule and rename isolation case into ticket b.                                                                                                                                                                             |
| 12  | May an impersonated session register, rename or remove a passkey, and must registration need a fresh session? | No to the first: all four mutating endpoints answer `FORBIDDEN` `PASSKEY_IMPERSONATED`. Yes to the second: registration requires a session younger than `freshAge` for every account, else `PASSKEY_SESSION_NOT_FRESH`.                                                                                                                                                                         | Decided by the security and tenancy panel member (confidence high): an impersonated session is new, so it passes any freshness rule, and a passkey it registers outlives the 900 s impersonation (`docs/ACCESS.md` §6.4); a borrowed 30-day session that adds a passkey keeps access after a password reset. |
| 13  | What does the "single device" badge say?                                                                      | "On one device only", keyed on `deviceType === 'singleDevice'`; no "This device" label.                                                                                                                                                                                                                                                                                                         | Decided by the UX panel member (confidence medium): `deviceType` is the authenticator's report, not the device in the person's hand, and a wrong label could make someone remove the wrong passkey.                                                                                                          |
| 14  | What does a person do when the session is not fresh or has ended?                                             | A **Sign in again** action that signs out and goes to `/login?redirect=/passkeys`, in the registration, list-error and delete states.                                                                                                                                                                                                                                                           | Decided by the UX panel member (confidence medium): `login.tsx` redirects a signed-in visitor straight back, so "sign in again" alone is a loop.                                                                                                                                                             |
| 15  | Where does the code-to-copy table live, and does the copy gate see it?                                        | `src/routes/_app/-lib/passkey-errors.ts`, added with the two screen files to the settings `copy-rules.test.ts` sources.                                                                                                                                                                                                                                                                         | Decided by the architect and product owner panel members (confidence medium): the orphan check only counts `'settings.…'` literals in the files it walks.                                                                                                                                                    |

## Panel verdicts

Reviewed before the PR opened, through `afk-decide`: "approve this spec for unattended slicing and implementation, or what must change?". Two rounds; every round-2 condition is applied in this spec and no specialist answered revise.

| Specialist           | Round 1                 | Conditions applied in this spec                                                                                                                                                                             | Round 2                                                                                                                                         |
| -------------------- | ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| Product owner        | approve with conditions | `passkey-errors.ts` in the copy gate; rename rate rule and isolation case into ticket b; isolation ACs split by ticket; `CONTEXT.md` entry a definite step                                                  | approve with conditions: fallback name moved to ticket a, `requiresPassword` moved to ticket c (applied)                                        |
| Software architect   | approve with conditions | `passkey-errors.ts` in the copy gate; `passkeys.add.added` read by ticket a; the verify body must still pass Zod; rate rules asserted by shape and once over HTTP; placeholders replaced                    | approve (optional edits applied: per-path failure keys, admin plugin in the test instance)                                                      |
| Security and tenancy | approve with conditions | impersonation veto on four endpoints; fresh session for registration; one `hasPassword` definition; ceiling before `createVerificationValue`; `register/options` rule; sessions-stay edge case; ACCESS §6.4 | approve with conditions: `impersonatedBy != null`, empty-string case tested (applied); approves as risk-high / security work                    |
| Accessibility        | approve with conditions | focus after every outcome; per-row Rename; visible Field label; one always-mounted status region; limit line described-by; delete dialog errors and focus; list semantics; `dir="auto"`                     | approve with conditions: focus to the list heading when Add is disabled, stale outcome focus, one in-dialog alert, native `required` (applied)  |
| UX                   | approve with conditions | "On one device only" badge; Sign in again action; `add.failed`; "a few minutes"; delete loading label; per-row Rename name and placeholder; copy gate; honest "Synced" vocabulary note                      | approve with conditions: 401 shows `sessionEnded`, stale lines only for `PASSKEY_SESSION_NOT_FRESH`, delete keys placed, generic body (applied) |

## Amendment

What ships in #1185 (Phase 1, 09-S1a) differs from the design above in these places. Phase 2 (#1145) and Phase 3 (#1146) are listed after these.

1. **The WebAuthn origin check reads the dev port wildcards.** The design assumed dev trusts loopback origins "by port" for the ceremony too. That held for Better Auth's request-origin check only: `assertClientData` compared with an exact `includes`, so every ceremony on a port other than `APP_URL`'s answered `400 WebAuthn origin is not trusted`. `isTrustedOrigin` in `src/server/auth/passkey/webauthn.ts` now reads a `scheme://host:*` entry as the same scheme and hostname on any port, and refuses any origin that is not in its serialised form. Production's list (`trustedOrigins()`) has no wildcard, and `src/server/auth/__tests__/trusted-origins.test.ts` pins it. The change reaches passkey sign-in as well as registration, because the check is shared.
2. **`MAX_PASSKEYS_PER_USER` lives in `src/lib/auth/passkey-limit.ts`**, re-exported by the plugin: the screen cannot import server code.
3. **`advanced.ipAddress.ipAddressHeaders: ['cf-connecting-ip']`** in `src/server/auth/index.ts`. Without it Better Auth saw no client address behind Cloudflare and every rate limit shared one bucket. This re-keys every existing limit (sign-in, sign-up, password reset, two-factor), which is the intended behaviour.
4. **The Add button is drawn twice when the list is empty** (the header's and the empty state's action), the same component with the same states. The header one owns the focus return.
5. **Outcomes re-read the list.** Any registration outcome other than a dismissed sheet reads the list again and keeps it when the read fails, so a reply lost after the row was written, or a second tab, cannot leave the screen stale. A new row is never added twice.
6. **A server limit refusal is announced** in the status region (visually hidden: the standing limit line is the visible text), and a failed sign-out keeps the Sign in again action mounted.
7. **The ceiling is advisory under a burst.** The count and the write are separate statements, so a burst overshoots by at most what the registration rate limit lets one address start in its window (10 per 300 s). A post-write recount was weighed and not built: nothing in the harness can produce a valid attestation to test it, and the ceiling bounds storage, not an entitlement.

Phase 2 (09-S1b, #1145) differs from the design in these places:

8. **The rename field is its own module.** `src/routes/_app/-ui/passkey-rename-field.tsx` owns the draft text and the keys (Enter, Escape, blur); `passkey-manager.tsx` owns the one row in rename mode, the request and the focus handed back to the Rename control. The copy gate walks the new file.
9. **A blur does not take focus back.** Enter and Escape return focus to the row's Rename control; a name saved by a blur leaves focus where the person moved it. An empty or unchanged value, on any of the three, closes rename mode without a request.
10. **The impersonation veto is one helper.** `assertNotImpersonated` in `plugin.ts` is called by both registration endpoints and by rename; the delete endpoint of 09-S1c calls it too.
11. **Failed saves by status.** `renameFailureNotice` maps a `401` to `passkeys.error.sessionEnded` with Sign in again beside the row, a `429` to `passkeys.error.rateLimited`, anything else to `passkeys.rename.failed`. A save that fails after another row took rename mode says so in the status region instead. `passkeys.rename.saving` is announced there while a save runs.
12. **A lost reply opens rename mode too.** When the registration reply is lost and the reloaded list holds the new row, that row (the newest) opens in rename mode like any added one.
13. **A failed save leaves the field open, reachable and filled.** The design (lines "a failed rename reverts the text" and the Rename-request-fails row) and the ticket's acceptance criterion said the text reverts. Build review (WCAG 2.2 3.3.7, Redundant Entry, level A: a retry after a `429` or a dropped connection must not mean typing the name again) overturned that: the typed text stays in the field, and the stored name is still drawn in the row above it. A blur never decides while the field shows an error (it neither saves nor closes), so Sign in again beside the row can be reached; Enter and Escape still decide. A failure after a blur does not move focus back into the input, and focus is handed back after a key-started save only while it is still in the field. Every failure is also announced in the status region (visually hidden, no second Sign in again), the Rename control pressed while its own row saves does not reopen the field, an Enter that ends an IME composition (`isComposing`, or key code 229 in WebKit) does not commit, a failed sign-out from the row puts focus back on that button, and the update is scoped to the caller's `userId` as well as the passkey id.

Phase 3 (09-S1c, #1146) differs from the design in these places:

14. **One definition of "has a password".** `findPasswordHash` in `plugin.ts` returns the credential account's hash only when it is truthy. The list's `requiresPassword` and the delete branch both read it, so a credential row with a null password is a passwordless account for both and takes the fresh-session path; it never reaches `password.verify`.
15. **Delete order.** Impersonation veto, then the passkey lookup and ownership check (`NOT_FOUND` for another user's id, the row untouched), then the identity proof (`PASSKEY_PASSWORD_REQUIRED` and `PASSKEY_INVALID_PASSWORD` for a password account, `PASSKEY_SESSION_NOT_FRESH` for a passwordless one), then a delete scoped by id and `userId`. The freshness check is the one `assertFreshSession` that registration uses.
16. **A missing hint asks for the password.** The client reads `requiresPassword !== false`, so a list reply without the field draws the password field; the server decides what it needs either way.
17. **The delete dialog is its own module** (`passkey-delete-dialog.tsx`) and owns the request, the password and the refusals; the manager owns the list and where focus goes once it has closed. `SignInAgain` moved to `passkey-sign-in-again.tsx` so both read it. The passkey's name sits in a `bdi dir="auto"` inside the translated sentence (a sentinel character is split out of the message, because the catalogue has no markup). The copy gate walks both new files.
18. **Removing lifts the ceiling line.** A removed passkey clears the standing "limit reached" line, so "Remove one to add another" holds without a reload.
