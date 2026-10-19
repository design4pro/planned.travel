# Account and settings

Eight rows of the 89-row matrix live here, plus the one Extensibility row that survives the hosted
multi-tenant boundary. Seven of the eight are `ACC-*`; the eighth, `ACC-08`, is excluded and is
argued in `docs/plans/11-boundaries-and-blockers.md` rather than planned here.

This is the cheapest high-visibility slice in the repository, and the reason is specific: two shipped
screens carry dead affordances whose server halves are already complete, so the work is a route and a
screen rather than a subsystem.

## What this area is on disk today

Measured at HEAD, not recalled:

- **The settings shell exists and is good.** `src/routes/_app/settings/route.tsx` renders a
  persistent section index beside an `<Outlet />`, and `src/routes/_app/-ui/settings-nav.tsx`
  declares six sections whose `to` values are a literal union checked against the generated route
  tree. Each section owns its own loader, so opening Appearance never waits on the member list.
- **Six sections ship.** Profile (`settings/index.tsx`, 384 lines) saves six regional overrides;
  Appearance (217 lines) saves theme, reduce-motion and map style; Security (231 lines) reads
  `loadSecurity`; Notifications (5.6K) writes a real switch matrix; Workspace and Billing read D1.
- **The auth layer is finished and is ours.** All seven `(auth)` routes are complete. Passkeys are a
  **first-party** WebAuthn server plugin at `src/server/auth/passkey/{plugin,webauthn,cose,cbor,bytes}.ts`,
  not a library plugin: it exposes `/passkey/register/options`, `/passkey/register/verify`,
  `/passkey/authenticate/options`, `/passkey/authenticate/verify`, `/passkey/list` and
  `/passkey/delete`. Two-factor is the library's `twoFactor()` plugin, configured at
  `src/server/auth/index.ts:222-232` with six-digit thirty-second codes, ten backup codes and an
  eight-attempt lockout.
- **`src/lib/auth/client.ts` is the browser half**, and it drives the passkey **authentication**
  ceremony by hand because there is no generated client for a first-party plugin. It has no
  registration ceremony.

### The two dead affordances, quoted from the screen that carries them

- `src/routes/_app/settings/security.tsx:163` renders `<a href="/passkeys">Manage passkeys</a>`.
  There is no `/passkeys` route in `src/routeTree.gen.ts`. A reader can sign **in** with a passkey
  (`signInWithPasskey`, used at `login.tsx:139`) but can never register one.
- `src/routes/_app/settings/security.tsx:144` sends "Turn on" to `/two-factor`, which is
  `src/routes/(auth)/two-factor.tsx` — the **sign-in challenge**. It asks for a code from an
  authenticator that has never been enrolled. Measured: `grep` for `enableTwoFactor`, `getTotpUri`
  and `generateBackupCodes` across `src/` returns nothing.
- A third, milder one: the Password row (`security.tsx:112`) sends "Change password" to
  `/reset-password`, which without a token renders "This link is incomplete"
  (`src/routes/(auth)/reset-password.tsx:72-75`).

### The repair convention this plan adopts, and why

All three affordances are wave-1 work owned by three different rows — `ACC-03`, `ACC-02` and
`ACC-01` — and `README.md` forbids two same-wave stages naming one file. `security.tsx` is one file.

So every wave-1 stage here **repairs the destination rather than the link**. `/passkeys` becomes a
real route; `/two-factor` learns that a fully signed-in visitor wants enrolment and redirects to it;
`/reset-password` learns that a signed-in visitor with no token wants an in-app change and redirects
to it. `src/routes/_app/settings/security.tsx` is therefore claimed by exactly one stage in the whole
plan — `09-S3`, the only one whose copy on that screen stops being true when its work lands — and
`09-S1` and `09-S2` do not touch it at all.

This is not a workaround. The defect in each case is that a promised destination does not deliver,
and the redirect idiom is already the repository's own: `src/routes/(auth)/login.tsx:43-44` runs
`beforeLoad: async () => { const config = await loadAuthConfig() … }` and redirects a signed-in
visitor away from the sign-in screen. `loadAuthConfig` (`src/routes/(auth)/-server/config.ts`)
already returns `signedIn`, so both redirecting stages **read** that module and neither edits it.

### User-visible copy language, fixed once for the whole plan

**English, `en-GB`.** It is not a preference. Measured at the commit this plan was written against,
`src/lib/format.ts:35` pins `const LOCALE = 'en-GB'` and the frozen CLDR month table at `:38` is the
`en-GB` set; the module's header states there is exactly one date formatter in the product and a
second must not be added. Sentence case in headings and buttons, no exclamation marks, no second
person plural, and the same vocabulary the shipped screens use — "workspace" for an organization row,
"trip" for a `trips` row, "traveller" for a member.

**The citation is a line number and line numbers move, so here is the invariant behind it.** That
module is being re-shaped by the localisation work `docs/SPEC.md` §8 governs: measured on disk while
this revision was written, `src/lib/format.ts` has become a module whose every function takes a
trailing `locale` defaulting to `en`, which its own header at `:13-17` says "resolves to `en-GB`, the
tag this module has always pinned — so every existing caller's output is unchanged to the byte". The
sentence "there is exactly one date formatter in the product; do not add a second one" survives that
rewrite verbatim (`:8-9`). So the rule every stage below obeys is stated against the invariant rather
than the constant: **English source copy, `en-GB` output, formatted through that one module and never
through an `Intl` object a stage constructs itself.** A stage that finds `LOCALE` gone has found the
locale work landed, not a wrong plan — it should check the header, not the line.

Every stage below restates this under **UI**, so no stage has to invent one. `ACC-06` would make the
language a runtime choice; `09-S5` records why this plan does not build it, and until it lands
`en-GB` is the only language these eight stages write.

### Where this plan's English copy lives

`docs/SPEC.md` §8 rule 9 makes the copy ours to author, and the **Ownership** line of its catalogue
section assigns the file it is authored in: _One item owns `messages/en/<namespace>.ts` for its own
screens._ Seven of the eight stages below put English sentences on a screen under `src/routes/_app`,
which §8 rule 8 puts squarely in scope, so this plan has to name that file and say who writes into
it. A plan that fixes the copy _language_ and leaves the copy _file_ unassigned has answered half the
question.

**Measured on disk, not recalled.** The message layer already exists.
`src/lib/i18n/catalogue.ts` aggregates with `import.meta.glob('./messages/*/*.ts')` and merges one
locale's namespace files into a single flat bag whose keys are `<namespace>.<key>`.
`src/lib/i18n/types.ts:48-57` derives the key union from `import type` of all ten **`en`** namespace
files, and `:54` already reads `import type Settings from './messages/en/settings'` — for a file that
does not exist. It typechecks only because `src/lib/i18n/messages/namespaces.d.ts` declares a
wildcard fallback that contributes no keys, and that file's own header says to delete it once all ten
exist. Exactly one namespace file is written today: `src/lib/i18n/messages/en/ui.ts`, the design
system's own copy, read through `useUiCopy()` in `src/components/ui/copy.ts`. And
`grep -rln 'messages/en/' docs/plans` matches exactly two files — this one and `OPEN-FINDINGS.md`,
the register that recorded the omission this section closes — so no sibling plan claims
`messages/en/settings.ts` and this plan is the one that has to.

**The namespace is `settings`, for all seven.** `src/lib/i18n/types.ts:115-126` freezes the ten
names and §8 says an eleventh is a contract change rather than a builder's choice; `settings` is the
one that names this area. One file therefore serves account, security, preference and handbook copy,
and what makes that correct rather than a compromise is a property of the runtime: **a namespace is a
unit of ownership and code-splitting, not an access boundary.** `catalogue.ts` merges every namespace
of the active locale before a screen reads a key, so `src/components/layout/user-menu.tsx` renders
`t('settings.help.menuLabel')` without this plan claiming `messages/en/shell.ts` — a file the app
shell's own work will need and that this plan has no business owning. The other eight namespaces —
`shell`, `auth`, `trips`, `modules`, `costs`, `atlas`, `journal`, `marketing` — are named by no stage
here.

**Who writes into it, and under which prefix.** Keys inside the file are unqualified, so
`'passkeys.title'` in `messages/en/settings.ts` is `t('settings.passkeys.title')` on a screen. The
prefixes are disjoint, so no two stages can author the same key:

| Stage   | Wave | Disposition | Prefix in the file | What it covers                                                                                        |
| ------- | ---- | ----------- | ------------------ | ----------------------------------------------------------------------------------------------------- |
| `09-S1` | 1    | `new`       | `passkeys.*`       | `/passkeys` — the header, the list, the badges, and the empty, skeleton, error and unsupported states |
| `09-S2` | 1    | `append`    | `twoFactor.*`      | `/settings/two-factor` — the wizard steps, the recovery-code sheet, regenerate, turn off              |
| `09-S3` | 1    | `append`    | `account.*`        | `/settings/password`, the profile identity block, the deletion dialog, the Security rows it rewords   |
| `09-S6` | 1    | `append`    | `help.*`           | `/help` and `/help/{slug}` — the chrome, the eight articles, and the user-menu entry                  |
| `09-S7` | 2    | `append`    | `notification.*`   | the preference matrix, the inbox, and the stored `titleKey`/`bodyKey` messages                        |
| `09-S8` | 3    | `append`    | `preferences.*`    | the settings index, the regional section, appearance and the responsive shell                         |

**Why `append`, and why appending in the same wave as the stage that mints the file is safe.**
`scripts/ultrabuild/check-plan-collisions.mjs` counts `edit`, `new`, `create`, `delete`, `replace`
and `rewrite` as exclusive and treats `append` as the documented cooperative pattern — the same one
fifteen stages across these plans already use on
`src/server/repos/__tests__/tenant-isolation.test.ts`. Three of the five appending stages here sit in
wave 1 beside `09-S1`, so their order is not guaranteed, and the rule that makes that safe is set
down rather than assumed: **the file's shape is fixed**, by §8 and by the one namespace file that
already exists — a header docstring, `import type { NamespaceMessages } from '../../types'`, then
`const messages = { … } as const satisfies NamespaceMessages` and `export default messages`
(`src/lib/i18n/messages/en/ui.ts`, its first and last lines). A stage that finds the file absent
creates it in that shape carrying only its own prefix; a stage that finds it present adds its block
and touches no other block, reorders nothing and reformats nothing. Neither outcome depends on which
agent ran first.

**Two stages author no key, and each says why rather than being quietly absent.**

- `09-S4` ships `public/manifest.webmanifest`. A web app manifest is a static JSON document the
  browser fetches once per origin, before any React tree exists; it cannot read the catalogue, and
  serving a different one per language is a routing change §8 does not ask for. Its `name`,
  `short_name` and `description` reuse `SITE_NAME` and `DESCRIPTION` from `src/routes/__root.tsx`,
  and the stage renders no sentence inside the application at all.
- `09-S5` is blocked and ships no screen.

**The stored-notification keys belong to `09-S7`, and that is the case that matters beyond screens.**
`src/server/repos/notifications.ts` deliberately stores `titleKey`, `bodyKey` and a `params` record
instead of a rendered sentence, and `src/lib/i18n/provider.tsx:95` already exports
`useStoredTranslate()` for exactly that shape. `00-S2` in `00-foundations.md` writes those key strings
from its dispatch call sites; `09-S7` authors the English messages they name, under
`settings.notification.event.*`, because it owns both rendering sites — the inbox and the preference
matrix. A key a dispatcher writes and nobody authors renders as `null`, and this paragraph exists so
that cannot happen by omission.

**What this hands the translation work, stated rather than discovered.** `09-S6` is the heavy one:
eight articles of prose become message keys rather than string literals in
`src/routes/_app/help/-content/articles.ts`, on the order of two hundred keys against the roughly
forty each other stage adds. Every one of the twenty-two non-`en` catalogues owns its own
`messages/<tag>/settings.ts` whole, so nothing here collides with them — but this namespace will be
the largest in the product and the plan says so now rather than letting a translation run discover
it. If the handbook is ever ruled out of scope the way `src/routes/legal/**` long-form prose already
is by §8 rule 8, that is an amendment to §8 and an entry in
`docs/plans/11-boundaries-and-blockers.md`, not a choice a stage may make on its own; so this plan
plans for the compliant case and names its cost.

**One consequence for the command gate, so no stage reads it as its own bug.**
`src/lib/i18n/__tests__/parity.test.ts` fails for every `en` key that has no translation yet, which
is by construction until the per-tag translation work lands: it is already red on this branch for the
whole of `messages/en/ui.ts`. A stage here adds English keys and therefore adds parity failures, and
it must **not** write into `messages/<tag>/` to silence them — §8 gives those directories wholly to
the translation items, so an English-side stage doing that is an ownership violation. Each stage runs
`pnpm test`, records the parity count before and after its own change, and owns every failure that is
not that suite.

### The rows, their waves and their stages

| Row      | Stage   | Wave | Moves                             |
| -------- | ------- | ---- | --------------------------------- |
| `ACC-03` | `09-S1` | 1    | partial → done                    |
| `ACC-02` | `09-S2` | 1    | partial → done                    |
| `ACC-01` | `09-S3` | 1    | partial → done                    |
| `ACC-07` | `09-S4` | 1    | absent → done                     |
| `ACC-06` | `09-S5` | 1    | partial → partial, **BLOCKED**    |
| `EXT-04` | `09-S6` | 1    | absent → done                     |
| `ACC-05` | `09-S7` | 2    | partial → done                    |
| `ACC-04` | `09-S8` | 3    | partial → partial, **stays open** |

Two rows do not reach **done**, and both say so in the same words as the stage that owns them.
`ACC-06` is blocked outright (`09-S5`). `ACC-04` is the interesting one: `09-S8` closes five of the
nine behaviours the row names, closes the temperature unit as "no separate preference" (ADR 0038)
and defers the other three, because the surface each of those three would govern belongs to another
plan or does not exist yet. The ledger records
`partial → partial` because that is what the stage records; a plan whose summary table and whose
stage disagree about a row is a plan that has stopped being readable.

The wave column is `README.md`'s table, unchanged. `ACC-08` is not in it: it is excluded on
architectural grounds and on the dependency freeze, and both arguments live in
`docs/plans/11-boundaries-and-blockers.md` (`11-S1` for the conflict-authority argument, `11-S2` entry 4 for the
absent client-side database). Its named hosted equivalent is `ACC-07`, which `09-S4` builds.

### What this plan takes from other plans rather than rebuilding

- **The notification write path.** `00-S2` in `00-foundations.md` (wave 0) mints
  `src/server/notifications/dispatch.ts` and gives it two production callers. `09-S7` is the reading
  and preference half and depends on it; it does not write a second dispatcher.
- **The audit trail.** `00-S3` mints `src/server/audit/trail.ts`. `09-S3` calls it.
- **Currency.** `09-S8` shows a currency override. The money work is `04-budget-and-currencies.md`:
  `04-S1` (`MNY-07`, wave 1) owns the frozen-rate columns and `src/server/repos/rates.ts`, `04-S5`
  owns re-basing a trip's accounting currency, and `01-S8` (wave 5) will widen the currency list into
  `src/lib/currency-list.ts`. `09-S8` reads `CURRENCY_OPTIONS` from `src/lib/money.ts` and writes
  nothing about rates, conversion or re-basing.
- **Dashboard widget selection.** `TRP-05` (`01-S5`, wave 2) owns the widgets and their per-user
  visibility over `src/lib/local-preference.ts` (`01-S3`). `09-S8` surfaces that store in settings
  and does not mint a second one.

---

## Stage 09-S1 — A passkey you can add, name and take away

### Stage id

`09-S1` · Wave 1 · effort **M**. The first of the two dead-affordance repairs, and the only one whose
target route does not exist at all.

> Built as `.ai/specs/implemented/2026-10-11-a-passkey-you-can-add-name-and-take-away.md`, whose Problem Statement lists where the code and this block disagree (the visual spec, the headless claim below, `settings.ts` already existing). Its Amendment records where the build departs from this block, among them the delete rule: an account without a password is held to a fresh session, not waved through (the "accepts the request without a password" bullet under the plugin changes).

### Reference rows

- `ACC-03` partial → **done**. All three tickets are built (09-S1a, 09-S1b, 09-S1c); the last one closes the row.

Sourced from `wiki: Passkeys` for the behaviours: enrolment from inside the product, a human-readable
name per credential, renaming without leaving the list, a delete that re-confirms identity, a badge
distinguishing a credential the platform syncs from one bound to the device in front of you, and the
date each was last used to sign in.

**Agreement with the row, and the correction it needs.** The row is accurate that `/passkeys` is a
dead link on a shipped screen. It is also accurate that the server half is complete, and the measured
detail matters more than the row says: `toPublicPasskey` (`src/server/auth/passkey/plugin.ts:486-496`)
already returns `name`, `deviceType`, `backedUp`, `createdAt` and `lastUsedAt`, so the synced badge,
the this-device badge and the last-used date are **presentation over data that already ships**. What
is genuinely missing is three things: a browser-side registration ceremony, a rename endpoint, and a
delete that asks for a password. Everything else is a screen.

Rows unblocked: none. `ACC-03` has no dependants in `gap-rows.json`.

### Owned paths

- `src/routes/_app/passkeys.tsx` — new. The route file. `_app` is a pathless layout — measured:
  `src/routes/_app/dashboard.tsx` produces `path: '/dashboard'` at `src/routeTree.gen.ts:110-113` —
  so this file's URL is exactly `/passkeys`, which is the href `security.tsx:163` already promises.
- `src/routes/_app/-ui/passkey-manager.tsx` — new. The list, the enrol button, the rename affordance,
  the delete dialog and all three list states.
- `src/lib/auth/client.ts` — edit. Adds the registration ceremony and the three list operations
  beside the sign-in ceremony that is already there.
- `src/lib/auth/__tests__/passkey-client.test.ts` — new.
- `src/server/auth/passkey/plugin.ts` — edit. Adds `/passkey/rename`, adds a password check to
  `/passkey/delete`, and adds the per-user ceiling described under **Quota**.
- `src/server/auth/passkey/__tests__/plugin-endpoints.test.ts` — new.
- `src/lib/i18n/messages/en/settings.ts` — new. This plan's English catalogue file, minted here
  because this is the lowest-numbered stage in the plan, carrying only the `passkeys.*` prefix. The
  area brief's **Where this plan's English copy lives** fixes the file's shape, the prefix table and
  why five later stages append to it rather than claiming a namespace of their own.
- `e2e/account-and-settings.visual.spec.ts` — new. This plan's own spec file, minted here because
  this is the lowest-numbered stage in the plan; every later stage appends to it.
- `e2e/__screenshots__/account-and-settings.visual.spec.ts/` — new. Its baseline directory.

`src/routes/_app/settings/security.tsx` is deliberately **not** claimed. Its link already names this
route, so making the route exist is the whole repair; claiming the file would collide with `09-S3`,
which owns it in this same wave.

### Data and migration

**None.** The `passkey` table already exists — it is declared by the plugin itself
(`src/server/auth/passkey/plugin.ts:96-121`) and materialised in `src/server/db/auth-schema.ts` with
`id`, `name`, `userId`, `credentialId`, `publicKey` (never returned), `algorithm`, `counter`,
`deviceType`, `backedUp`, `transports`, `aaguid`, `createdAt` and `lastUsedAt`. No column, no index,
no migration, and nothing is filed for a wave-0 foundations schema stage.

The table is **auth-owned and user-keyed**: it carries no `organization_id`, because a credential
authenticates a person rather than granting access to a workspace. That is the correct shape and this
stage does not change it. It is also why **Tenant isolation test** below reads the way it does.

### Server (repo, server function, Zod)

**No repository, and no server function.** SQL for this table lives where it already lives: behind
Better Auth's adapter, inside `src/server/auth/passkey/plugin.ts`. Nothing under `src/server/repos`
is added or changed, and no `createServerFn` is minted — the screen talks to the auth endpoints the
same way `login.tsx` already does.

**No new auth plugin is added.** Not a package plugin, not a first-party one. `src/server/auth/index.ts`
is untouched; the `passkey()` registration at `:255-259` stays exactly as it is. This stage edits the
existing plugin's endpoint list and nothing else about the auth configuration.

**The Better Auth client call this stage uses.** `authClient` is created by `createAuthClient` from
`better-auth/react` at `src/lib/auth/client.ts:30-33`. Because our WebAuthn support is first-party,
Better Auth generates **no** `authClient.passkey.*` namespace for it — measured: the client is
configured with `twoFactorClient()` and `organizationClient()` and nothing else. So the calls are the
ones the module already establishes: `postToAuth('/passkey/register/options', …)` and
`postToAuth('/passkey/register/verify', …)`, the same helper that `signInWithPasskey` uses at
`:174-176` and `:265`, sending `credentials: 'include'` against `AUTH_BASE_PATH`. Session reads use
`authClient.useSession()`. Anyone reading this stage expecting `authClient.passkey.addPasskey()`
should stop and re-read `src/lib/auth/client.ts`: that method does not exist in this repository.

**What `src/lib/auth/client.ts` gains**, mirroring the existing sign-in ceremony function for function:

- `registerPasskey(name)`: POST the options, narrow them with a type guard exactly as
  `isAuthenticationOptions` (`:163-176`) does, call `navigator.credentials.create({ publicKey })`,
  check the result is a `PublicKeyCredential` whose `response` is an `AuthenticatorAttestationResponse`,
  base64url-encode `rawId`, `clientDataJSON` and `attestationObject`, POST the verify, return the same
  `PasskeyResult` union the module already exports — including the `{ ok: false, aborted: true }` arm
  for `NotAllowedError` and `AbortError`, because a dismissed platform sheet is not an error worth a
  red alert.
- `listPasskeys()`, `renamePasskey(id, name)`, `deletePasskey(id, password)`: thin `postToAuth`
  wrappers returning normalised `AuthFailure` values through the existing `passkeyFailure` reducer.
- `isPasskeySupported()` already exists at `:141-149` and already checks `navigator.credentials.get`.
  It gains a sibling `isPasskeyEnrolmentSupported()` that checks `navigator.credentials.create`,
  because a browser can support one and not the other, and both are called from an effect rather than
  during render so the server-rendered markup never promises an unavailable affordance.

**What `src/server/auth/passkey/plugin.ts` gains:**

- `POST /passkey/rename`, `use: [sessionMiddleware]`, body `z.object({ id: z.string().min(1), name: z.string().trim().min(1).max(64) })`.
  It re-reads the record and compares `record.userId` to `ctx.context.session.user.id` before writing,
  the same guard `/passkey/delete` already applies at `:420-424`; a mismatch is `NOT_FOUND`, never
  `FORBIDDEN`, so the endpoint does not confirm that somebody else's credential id exists.
- `POST /passkey/delete` gains `password: z.string().min(1)` and verifies it before deleting, through
  the context's own credential checker. Removing a second factor is exactly the operation an attacker
  on a borrowed session wants, so it re-proves identity. If the account has no password credential —
  possible, because social sign-in is enabled and account linking is on — the endpoint accepts the
  request without a password and says so in its response, and the screen asks for confirmation rather
  than a password in that case. The stage does not invent a password for a passwordless account.
- A per-user ceiling on registration, described under **Quota**.

**Zod v4 throughout**, matching the plugin's existing bodies: `z.strictObject` where the shape is
closed, the `error` parameter for messages, `z.string().trim()` rather than a post-parse trim.

**Authorisation is decided in the endpoint, from the session, never from the body.** Every one of the
six endpoints already runs `sessionMiddleware`, and the user id used for every read and write is
`ctx.context.session.user.id`. A well-formed credential id from the client is not an authorised one:
`/passkey/rename` and `/passkey/delete` both fetch by id and then compare the owner. Nothing slow
runs inline — the whole ceremony is CPU-bound signature verification in `webauthn.ts`.

### UI (route, components)

**Route.** `/passkeys`, file `src/routes/_app/passkeys.tsx`. Default SSR: the list is a small
authenticated read and streaming it is strictly better than a client-side spinner. The route's
`loader` does **not** call the auth endpoint — the endpoints are cookie-authenticated HTTP handlers,
and a loader is isomorphic — so the list is fetched from an effect on mount with a declared pending
state, which is the same shape `login.tsx` uses for its passkey affordance. Adding a route file means
running **`pnpm generate-routes`**; `src/routeTree.gen.ts` is never hand-edited and never listed
above.

**Components, reused not rebuilt.** `Card`, `Button`, `IconButton`, `Badge`, `Dialog`, `Input`,
`Field`, `Alert`, `EmptyState`, `Skeleton`, `Spinner`, `SectionLabel` and `Tooltip`, all from
`src/components/ui`. `PageHeader` and `AppFrame`/`AppSections` from `src/components/layout`, so the
screen sits in the app shell the rest of the product uses. The one new product component is
`src/routes/_app/-ui/passkey-manager.tsx`; it fetches through the client module and holds no SQL and
no `server/` import.

**The screen.** A header explaining what a passkey replaces, one primary "Add a passkey" button, and
a list of credentials. Each row: the credential's name (or a derived fallback naming the platform
family from `aaguid` when the reader never typed one), a `Badge` reading **Synced** when `backedUp`
is true and **This device** when `deviceType` is `singleDevice`, the added date, and the last-used
date rendered with `formatDate` from `src/routes/_app/-lib/format.ts` and `tabular-nums` because it
changes. Rename is inline: the name becomes an `Input` in place, commits on Enter or blur, reverts on
Escape, and shows an inline `Spinner` while the write is in flight. Delete opens a `Dialog` that
names the credential and asks for the password.

**States, named rather than promised.**

- **Empty** — no credentials yet. `EmptyState` on `--color-surface-2`, a `Fingerprint` glyph, the
  heading "No passkeys yet", the body "Add one and you can sign in with your fingerprint, your face
  or a security key instead of typing a password.", and the same primary button as the header so the
  empty state is itself the affordance.
- **Skeleton** — three `Skeleton` rows on `--color-surface-2` at the row's exact height, so the list
  does not jump when it resolves. Zero layout shift is the acceptance, not an aspiration.
- **Error** — the list request failed. An `Alert` with `tone="danger"` on `--color-surface-2`, the
  normalised `AuthFailure.message` when the server sent one and a written fallback when it did not,
  and a "Try again" `Button` that re-runs the fetch. A `429` is called out by name: "Too many
  attempts. Try again in a minute."
- **Unsupported** — `isPasskeyEnrolmentSupported()` is false. The button is `disabled` with a
  `Tooltip` naming the reason, rather than absent, so the screen explains itself.
- **In flight** — the add button carries `loading` and `loadingLabel="Waiting for your device"` for
  the whole ceremony, because the platform sheet can sit open for thirty seconds.

**Motion.** A newly added row enters at 220ms on `--ease-out-quint`, opacity and transform only,
staggered 24ms when several render at once and capped at eight. `prefers-reduced-motion: reduce`
collapses it to opacity. The dialog uses the primitive's own motion; this stage adds none of its own.

**Tokens.** None missing. Surfaces, ink, edges, radii, shadows and easings all exist in
`src/styles/tokens.css`; nothing is hard-coded and nothing is filed for a foundations token stage.

**Copy language: English, `en-GB`**, sentence case, as fixed in the area brief above.

**Where those strings are authored.** In `src/lib/i18n/messages/en/settings.ts` under the
`passkeys.*` prefix — the file this stage mints. No screen in this stage carries a bare English
literal: every string above, including the empty state's two sentences, the four badge words and the
`429` line, is `t('settings.passkeys.<key>')` through `useTranslate()`
(`src/lib/i18n/provider.tsx:85`). The wording quoted in this stage is the English **source** for
those keys, not markup.

### Quota

**No countable row, and a fixed ceiling instead.** A passkey is not a metered entity: the table has
no `organization_id`, so `resolveLimits()` in `src/server/billing/limits.ts` and `PLAN_QUOTAS` in
`src/server/db/types.ts` have nothing to resolve it against, and `assertQuota` cannot be called
without a `TenantScope`. Adding a metric for it would be adding a plan dimension nobody sells.

Unbounded credential rows are still a storage vector on a shared deployment, so
`/passkey/register/verify` counts the user's existing credentials and refuses past **twenty** with a
`BAD_REQUEST` and a written message. Twenty is chosen against the numbers already in the file: both
`/passkey/register/options` and `/passkey/list` read at `limit: 50` (`:145`, `:401`), so the ceiling
sits comfortably below the read window and the exclude-list stays complete. The check runs **before**
the write, which is the same ordering rule `assertQuota` obeys.

### Tenant isolation test

**No case is appended to `src/server/repos/__tests__/tenant-isolation.test.ts`, and the reason is
structural rather than an omission.** That file's contract is organization-to-organization: A asks, in
A's scope, for B's rows by id and must get `NotFoundError`. The `passkey` table has no
`organization_id` column and is never reached through a `TenantScope` — it is Better Auth's adapter,
inside `src/server/auth`, and `src/server/repos/base.ts` cannot express a query against it. A case
asserting an organization boundary on a table with no organization column is a test that cannot fail,
and adding one would dilute the file that catches the failures that matter.

The equivalent boundary here is **user to user**, and it is tested — in
`src/server/auth/passkey/__tests__/plugin-endpoints.test.ts`, which this stage owns:

- user A calls `/passkey/list` and sees only A's credentials, never B's;
- user A calls `/passkey/delete` with B's credential id and receives `NOT_FOUND`, and B's row is
  present and unchanged afterwards;
- user A calls `/passkey/rename` with B's credential id and receives `NOT_FOUND`, and B's `name` is
  unchanged afterwards;
- user A calls `/passkey/delete` with A's own id and a wrong password and receives `BAD_REQUEST`, and
  the row survives;
- a registration ceremony whose stored challenge belongs to a different user is refused, which is the
  guard already at `:186-196` and is held here so a later edit cannot quietly drop it.

### Verification

**How this is run.** `docs/plans/12-verification-protocol.md` owns the procedure: §2 the commands
and the three project names, §3 the frame set and the declared-state rule, §4 the spec-file split
this stage's file obeys, §5 the pixel budget, §6 the two assertions every stage owes. This block
names only what is specific to `/passkeys`.

**The command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**The Playwright run, written out in full.** There is no `test:e2e`, no `test:visual` and no
`playwright` script, and `docs/SPEC.md` §3 freezes `package.json` so none may be added:

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)   # --start only when the pool is empty
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/account-and-settings.visual.spec.ts
```

Both browser projects run: `chromium` at 1440x900 and `mobile-safari` on WebKit at 393x659. Those
are the gate's viewports and are separate from the evidence widths below — the gate proves nothing
changed, the frames prove the thing is good. `--project=setup` is re-run whenever a cached session
starts redirecting to `/login`; without `PLAYWRIGHT_BASE_URL` the config waits on port 3000 until the
global timeout. Baselines are recorded with `--update-snapshots` on the run that mints them, and
only for the frames this stage's own `test.describe` block produces; `maxDiffPixelRatio` stays at
`0.002` and `threshold` at `0.2` — neither is raised, per §5, and a failing comparison is either the
renderer's or the product's.

**Unit tests, by file and invariant.**

- `src/lib/auth/__tests__/passkey-client.test.ts` — base64url round-trips a byte sequence containing
  `+`, `/` and a padding remainder; a `NotAllowedError` from a stubbed `navigator.credentials.create`
  becomes `{ ok: false, aborted: true }` rather than a failure; a non-OK verify response becomes an
  `AuthFailure` carrying the server's status and message; an unknown transport string is dropped
  rather than passed through, matching `toTransports` at `:127-135`.
- `src/server/auth/passkey/__tests__/plugin-endpoints.test.ts` — the five isolation cases above, plus
  the twenty-credential ceiling refusing the twenty-first and leaving twenty rows.
- **No test is added for `src/lib/i18n/messages/en/settings.ts`, and none would say anything.** The
  file is data whose shape `as const satisfies NamespaceMessages` already checks, and a key this
  stage's screens name but the file does not carry is a `pnpm typecheck` error that names the key,
  because `src/lib/i18n/types.ts` derives `MessageKey` from the file itself. What this stage does
  record is the parity count: `src/lib/i18n/__tests__/parity.test.ts` is red by construction until
  the per-tag work lands, so the stage notes the count before and after its own change and owns
  every `pnpm test` failure that is not that suite.

**Browser evidence.** Route `/passkeys`, both themes, at **360px, 1280px and 2560px** — six resting
frames. Two declared non-resting states, because the point of this stage is an interaction and a
resting screenshot is not evidence about it:

- `--state enrolling`, reached with `--click '[data-part="passkey-add"]'`, which photographs the
  button's `loading` state while the ceremony is pending. WebAuthn cannot complete headlessly, so the
  spec stubs `navigator.credentials.create` with a never-resolving promise via `page.addInitScript`
  and photographs the loading state that stub produces.
- `--state empty`, reached with `page.route()` returning an empty list for `/api/auth/passkey/list`,
  which is also how the error state is reached (`--state list-error`, the same route returning a 500).

Every selector is a `data-part` attribute this stage publishes, not a class name, and the stage
verifies each with `page.locator(sel).count() === 1` against a running dev server **before** it files
a frame; a selector that resolves to nothing makes `capture.mjs` throw at `--click` and costs a round.

Frames are taken by `scripts/ultrabuild/capture.mjs` with `PT_SERVER_TODAY=2026-08-20` — the value is
`BASELINE_DAY` in `e2e/helpers/shoot.ts:1014` and not a free choice — with `--auth`, and land under
`.claude/ultrabuild/shots/<slug>/round-<n>/09-S1/`.

**The spec file.** `e2e/account-and-settings.visual.spec.ts`, minted here, importing `visit`,
`settle`, `shoot`, `applyTheme`, `useSession` and `watchConsole` from `./helpers/shoot.ts`. A second
implementation of any of them is a defect. The spec declares its own route table and calls
`auditServerClock(page, <that table>)` once in a `describe` of its own, because that is the only check
that reads the declaration against the streamed payload and nothing else audits a module spec's
routes. `/passkeys` prints no clock-derived string of a shape outside `RELATIVE_TIME_SITES`: the two
dates it shows are absolute, formatted by `formatDate`, so the route declares `relativeTime: false`
and `e2e/helpers/shoot.ts` is **not** claimed.

**Console must be silent.** `watchConsole(page, route)` is attached before navigation and the
returned report's `fatal` list is asserted empty at the end of every test, including the ones that
only take a frame. `TOLERATED_CONSOLE_WARNINGS` is not extended by this stage.

**Layout shift after paint.** A `PerformanceObserver` for `layout-shift` is installed as an init
script, `visit()` and `settle()` run, `performance.now()` is the mark, the list resolves and the add
dialog opens, and the sum of entries after the mark with `hadRecentInput === false` must be `0`. The
entry type is Chromium-only — `observe()` does not throw in WebKit, it silently records nothing — so
the assertion is gated on `supportedEntryTypes` and the skip is reported as a skip, never as a pass.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test`
passes; the feature is verified in a real browser in light and dark, desktop and mobile; nothing is
left behind — no TODO, no placeholder copy, no `console.log`, no commented-out code; and no file
outside **Owned paths** is touched.

On top of those, the `docs/SPEC.md` §2 visual clauses, ticked per surface this stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each drawn
      on `--color-surface-2` rather than on the raw canvas.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Checked at 360px, 1280px and 2560px, and the small layout is designed rather than a squeezed
      desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

**None.** No package outside the `docs/SPEC.md` §3 pinned set is needed: WebAuthn is a platform API in
the browser and the verification is already written in this repository across `webauthn.ts`,
`cose.ts`, `cbor.ts` and `bytes.ts`. No binding is added to `wrangler.jsonc`. No third-party service
is involved. No row in another plan gates this one.

---

## Stage 09-S2 — Turning two-factor on, instead of being challenged by it

### Stage id

`09-S2` · Wave 1 · effort **M**. The second dead-affordance repair. Its target route exists but shows
the wrong screen, which is the harder of the two failures to notice and the more annoying to hit.

### Reference rows

- `ACC-02` partial → **done**.

Sourced from `wiki: Two-Factor-Authentication` for the behaviours: enrol by scanning a code or typing
the secret, confirm with a code from the app before the factor becomes real, receive a set of
one-time recovery codes, regenerate that set later, and turn the factor off by proving the password
and a current code.

**Agreement with the row.** It is right that `src/routes/(auth)/two-factor.tsx` is a complete
verification screen, that the plugin is configured with lockout, and that "Turn on" at
`security.tsx:144-146` lands on that challenge. It is also right that nothing in `src/` calls the
enrolment endpoints.

**Two corrections the row does not carry, both measured in the installed library at 1.7.1.**

1. **Enrolment is a two-step handshake and the library already enforces it.** `/two-factor/enable`
   writes the encrypted secret and the backup codes and returns `{ totpURI, backupCodes }`, but it
   does **not** set `twoFactorEnabled` unless `skipVerificationOnEnable` is configured — measured at
   `node_modules/better-auth/dist/plugins/two-factor/index.mjs:138-149`, and our configuration does
   not set that option. The flag is flipped by `/two-factor/verify-totp` when the stored row is not
   yet verified (`.../two-factor/totp/index.mjs:205-217`), and a sign-in attempt against an
   unverified secret is refused (`:183`). So an abandoned enrolment cannot lock anybody out, and the
   screen can be honest about that rather than guessing.
2. **There is no server-side enrolment window.** The upstream behaviour the row describes as a
   fifteen-minute window has no equivalent in the installed library: the secret is durable from the
   moment `enable` returns. What this stage ships instead is stated plainly under **UI** — the screen
   expires the secret it is _displaying_ after fifteen minutes and restarts enrolment, which re-rolls
   the secret because `enable` overwrites the existing row (`index.mjs:153-158`). The security
   property that matters — the factor is not active until a code proves it — comes from the library,
   not from a timer.

Rows unblocked: none. `ACC-02` has no dependants in `gap-rows.json`.

### Owned paths

- `src/routes/_app/settings/two-factor.tsx` — new. The route file; URL `/settings/two-factor`, a
  child of the existing settings shell.
- `src/routes/_app/settings/-ui/two-factor-enrolment.tsx` — new. The enrolment wizard, the recovery
  code sheet, the regenerate action and the turn-off dialog.
- `src/routes/(auth)/two-factor.tsx` — edit. Adds the `beforeLoad` that sends a fully signed-in
  visitor to the enrolment screen. The challenge itself is not touched.
- `src/lib/matrix-code/encode.ts` — new. The scannable-code encoder described in `11-S2` entry 6.
- `src/lib/matrix-code/__tests__/encode.test.ts` — new.
- `src/lib/i18n/messages/en/settings.ts` — append. The `twoFactor.*` keys and nothing else. `09-S1`
  mints the file in this same wave; if it has not landed when this stage runs, this stage creates it
  in the shape the area brief fixes, carrying only its own prefix.
- `e2e/account-and-settings.visual.spec.ts` — append. This stage's own `test.describe` block, named
  for the stage id and title.
- `e2e/__screenshots__/account-and-settings.visual.spec.ts/` — append. Its own frames in the shared
  baseline directory; `playwright.config.ts`'s `snapshotPathTemplate` keys every file by test name,
  so two stages appending to one spec cannot overwrite each other's pixels.

`src/server/auth/index.ts` is **not** claimed — see **Server** below for why nothing there needs to
change — and neither is `src/routes/_app/settings/security.tsx`, which `09-S3` owns in this same wave.

### Data and migration

**None.** The `two_factor` table already exists in `src/server/db/auth-schema.ts` and is written
entirely by the library's own adapter calls. `user.twoFactorEnabled` already exists and is already
read: `loadSecurity` returns it (`src/routes/_app/-server/settings.ts:251`) and the Security screen
already renders it as an On/Off `Badge`. No column, no index, no migration, nothing filed for
foundations.

### Server (repo, server function, Zod)

**No repository and no SQL.** Nothing under `src/server/repos` is added or changed. The two-factor
rows are auth-owned and user-keyed, exactly as the passkey rows are in `09-S1`.

**No new auth plugin is added.** `twoFactor()` is already registered at `src/server/auth/index.ts:222-232`
with `totpOptions: { digits: 6, period: 30 }`, `backupCodeOptions: { amount: 10, length: 10 }` and an
eight-attempt, fifteen-minute lockout; `twoFactorClient()` is already in the browser client at
`src/lib/auth/client.ts:30-33`. This stage adds neither, changes neither, and does not touch
`src/server/auth/index.ts` at all.

**The Better Auth client calls this stage uses**, all five on the `twoFactor` namespace the installed
`twoFactorClient()` contributes — the endpoint list is measured in
`node_modules/better-auth/dist/plugins/two-factor/client.d.mts` under `pathMethods`:

| Call                                                     | Endpoint                                 | What it returns                       |
| -------------------------------------------------------- | ---------------------------------------- | ------------------------------------- |
| `authClient.twoFactor.enable({ password })`              | `POST /two-factor/enable`                | `{ totpURI, backupCodes }`            |
| `authClient.twoFactor.verifyTotp({ code })`              | `POST /two-factor/verify-totp`           | activates the factor on first success |
| `authClient.twoFactor.getTotpUri({ password })`          | `POST /two-factor/get-totp-uri`          | `{ totpURI }`, for re-adding a device |
| `authClient.twoFactor.generateBackupCodes({ password })` | `POST /two-factor/generate-backup-codes` | a fresh set of ten                    |
| `authClient.twoFactor.disable({ password })`             | `POST /two-factor/disable`               | clears the factor                     |

Every failure goes through `toAuthFailure` from `src/lib/auth/client.ts:56-67`, so the screen branches
on a code, detects `429` by status, and renders a message the server already made safe. No second
failure shape is invented.

**One server function, and only because a route decision needs a server answer.** The `beforeLoad`
added to `src/routes/(auth)/two-factor.tsx` calls the existing `loadAuthConfig`
(`src/routes/(auth)/-server/config.ts`), which already returns `signedIn`, and redirects to
`/settings/two-factor` when it is true. That module is **read, not edited**. The idiom is the
repository's own: `src/routes/(auth)/login.tsx:43-44` does exactly this to keep a signed-in visitor
off the sign-in screen. A mid-sign-in visitor has a two-factor cookie and **no** session, so
`signedIn` is false and the challenge renders unchanged — which is what keeps the enrolment flow
genuinely distinct from the challenge rather than merged with it.

**Zod.** The redirect needs no validator. The screen's own inputs — a six-digit code and a password —
are validated on the client for shape only, reusing `totpSchema` from `src/routes/(auth)/-lib/schemas.ts`
rather than declaring a second one, and are validated for real by the library endpoints. Shape is not
permission, and none of these calls trusts a client-supplied identity: every endpoint runs under
`sessionMiddleware` and acts on `ctx.context.session.user.id`.

**Authorisation.** Decided by the library endpoint, from the session cookie. `enable`, `getTotpUri`,
`generateBackupCodes` and `disable` all require the account password when the account has one
(`index.mjs:106-113`), which is the re-authentication this stage relies on rather than reimplementing.

**Rate limiting is already configured and is deliberately not widened.** `src/server/auth/index.ts:167-168`
carries per-endpoint rules for `/two-factor/verify-totp` (ten per minute) and
`/two-factor/verify-backup-code` (five per five minutes). The enrolment endpoints fall under the
global rule at `:159-161` — one hundred per minute — which is appropriate for an authenticated
password-gated call and needs no change. Stating this is the point: a stage that "hardens" the rate
limits would have to claim `src/server/auth/index.ts`, which `09-S3` owns in this same wave.

**The matrix-code encoder, and its bound.** `11-S2` entry 6 records the missing capability and fixes
the disposition as **hand-roll a restricted subset**. `src/lib/matrix-code/encode.ts` implements
exactly that bound and no more: byte mode only, one fixed error-correction level, the smallest symbol
version that fits the enrolment URI, and a `ReadonlyArray<ReadonlyArray<boolean>>` matrix as output.
It renders nothing and imports nothing. A pure function with published test vectors is unusually
cheap to prove correct, which is why the subset is drawn there.

### UI (route, components)

**Route.** `/settings/two-factor`, file `src/routes/_app/settings/two-factor.tsx`, a child of the
existing `src/routes/_app/settings/route.tsx` shell, so it inherits the section index and the page
header with no change to either. Default SSR; its loader is `loadSecurity`, which already exists and
already returns `twoFactorEnabled`, so the screen knows on the first paint whether it is enrolling or
managing. A new route file means **`pnpm generate-routes`**; `src/routeTree.gen.ts` is never
hand-edited and is not listed under **Owned paths**.

The screen opens with a back link to Security, because the settings index highlights no section for a
sub-page and a reader must always know the way out.

**Components, reused not rebuilt.** `Card`, `Button`, `Field`, `Input`, `Alert`, `Badge`, `Dialog`,
`Skeleton`, `Kbd`, `SectionLabel`, `Separator`, `Tooltip` and the existing `CodeInput` from
`src/routes/(auth)/-ui/form.tsx`, which is the same six-digit control the challenge screen uses — a
second code input would be a defect. One new product component,
`src/routes/_app/settings/-ui/two-factor-enrolment.tsx`, which renders the SVG for the matrix the
encoder returns as token-coloured rectangles (`--color-ink` on `--color-surface`, and the dark ramp
re-declared rather than inverted) so it themes with everything else and never ships as an image file.

**The enrolment flow, three steps in one screen.**

1. **Prove it is you.** A password field, then `enable`. The button carries `loading` and
   `loadingLabel="Setting up"`.
2. **Add it to your app.** The matrix beside the typed secret, always both, because the typed secret
   is the documented path for anyone who cannot scan and it must never be a hidden fallback. A
   "Copy secret" button with a `Tooltip` and a confirmed state. The step states in words that the
   factor is not on yet.
3. **Confirm the code.** `CodeInput`, then `verifyTotp`. On success the recovery codes are revealed
   once, with "Copy all" and "Download as a text file" — the download is a `Blob` and an object URL,
   revoked after the click, needing no package — and a checkbox the reader must tick to acknowledge
   they have been stored before the screen closes the sheet.

**The management view**, when `twoFactorEnabled` is already true: a status `Card`, "Show recovery
codes" (password-gated, via `getTotpUri` for a replacement device and `generateBackupCodes` for a
fresh set, each stating that the old set stops working), and "Turn off two-factor" as a `danger`
`Dialog` requiring the password.

**States, named rather than promised.**

- **Empty** — no recovery codes have ever been generated for an enabled factor, which is reachable
  for an account enrolled before this screen existed. `EmptyState` on `--color-surface-2` with a
  `ShieldAlert` glyph, the heading "No recovery codes", the body "Generate a set now — without one, a
  lost phone means a lost account.", and the generate button as the action.
- **Skeleton** — the route's `pendingComponent` renders the card outline at its final height on
  `--color-surface-2`, matching the shape `SecurityPending` already establishes at
  `security.tsx:214-231`.
- **Error** — `Alert` `tone="danger"` on `--color-surface-2` naming the failure, with a retry that
  re-runs the last call. `INVALID_CODE` is rendered inline on the code field rather than as a page
  alert, because it is a field-level mistake. `ACCOUNT_TEMPORARILY_LOCKED` gets its own copy naming
  the fifteen-minute lockout the configuration actually sets.
- **Expired display** — fifteen minutes after the secret was shown, the matrix is replaced by a
  panel offering to start again, and the pending secret on screen is discarded from React state.

**Motion.** Step transitions are 220ms on `--ease-out-quint`, opacity and transform only. The
recovery-code reveal is a 220ms fade with a 24ms stagger across the ten codes, capped as the token
contract requires. `prefers-reduced-motion: reduce` collapses both to opacity.

**Tokens.** None missing; nothing filed for a foundations token stage. Every code and every count is
`tabular-nums`.

**Copy language: English, `en-GB`**, sentence case, as fixed in the area brief above.

**Where those strings are authored.** In `src/lib/i18n/messages/en/settings.ts` under the
`twoFactor.*` prefix, appended per the area brief's table. Every wizard step, the recovery-code
sheet, the regenerate confirmation and the turn-off dialog read `t('settings.twoFactor.<key>')`. The
recovery codes and the shared secret are data, never keys, and the scannable code's payload is a URI
the authenticator parses — none of the three is translated.

### Quota

**No countable row.** The factor is one row per user in an auth-owned table, and enabling it twice
overwrites rather than accumulates (`index.mjs:153-158`). There is no metric in `resolveLimits()` or
`PLAN_QUOTAS` to consume, no `assertQuota` call site, and nothing added to
`src/server/billing/__tests__/limits.test.ts`. The bound that matters is the library's own lockout,
which is already configured.

### Tenant isolation test

**No case is appended to `src/server/repos/__tests__/tenant-isolation.test.ts`**, for the same
structural reason `09-S1` gives: `two_factor` carries no `organization_id`, is never reached through
a `TenantScope`, and an organization-boundary assertion against it could not fail. Nothing under
`src/server/repos` is added or changed by this stage.

The boundary that does apply is between a person and their own session, and the library enforces it
through `sessionMiddleware` plus the password check. The stage holds two properties in
`src/lib/matrix-code/__tests__/encode.test.ts` and in the spec rather than inventing a repository
test: the enrolment route is unreachable without a session — a signed-out request to
`/settings/two-factor` lands on `/login` through the existing `_app` guard — and the challenge route
is unreachable with one, which is the redirect this stage adds and which the spec asserts directly.

### Verification

**How this is run.** `docs/plans/12-verification-protocol.md` owns the procedure. §3 binds hardest
here: enrolment is four states deep and none of them is the resting one, so every state below is
declared with the selector that reaches it and the way that selector was verified to exist.

**The command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**The Playwright run, written out in full.** There is no `test:e2e`, no `test:visual` and no
`playwright` script, and `docs/SPEC.md` §3 freezes `package.json` so none may be added:

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)   # --start only when the pool is empty
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/account-and-settings.visual.spec.ts -g '09-S2'
```

Both browser projects run: `chromium` at 1440x900 and `mobile-safari` on WebKit at 393x659. Those
are the gate's viewports and are separate from the evidence widths below — the gate proves nothing
changed, the frames prove the thing is good. `--project=setup` is re-run whenever a cached session
starts redirecting to `/login`; without `PLAYWRIGHT_BASE_URL` the config waits on port 3000 until the
global timeout. Baselines are recorded with `--update-snapshots` under the same `-g` filter, so no
earlier stage's frames are re-recorded; `maxDiffPixelRatio` stays at `0.002` and `threshold` at `0.2` — neither is raised, per §5, and a
failing comparison is either the renderer's or the product's.

**Unit tests, by file and invariant.**

- `src/lib/matrix-code/__tests__/encode.test.ts` — published test vectors: a known input produces a
  known module matrix; the chosen symbol version is the smallest that fits; an input one byte longer
  than the largest supported capacity throws a named error rather than truncating; the output matrix
  is square and its side length matches the version formula; a real enrolment URI of the shape
  `otpauth://totp/…` encodes and the matrix's quiet zone is present.
- The redirect is held in the spec rather than in a unit test, because it is a route decision and a
  unit test of `beforeLoad` would test the mock.

**Browser evidence.** Route `/settings/two-factor`, both themes, at **360px, 1280px and 2560px** —
six resting frames in the enrolment state and six in the management state, because they are different
screens and the stage ships both. Declared non-resting states:

- `--state codes-revealed`, reached with `--click '[data-part="two-factor-confirm"]'` after the spec
  stubs `/api/auth/two-factor/verify-totp` with `page.route()` to return success — a real TOTP code
  cannot be produced in a headless run, and stubbing the transport is honest where stubbing the
  screen would not be;
- `--state disable-dialog`, reached with `--click '[data-part="two-factor-disable"]'`;
- `--state list-error`, reached with `page.route()` failing `/api/auth/two-factor/enable`.

Every selector is a `data-part` attribute this stage publishes, verified with
`page.locator(sel).count() === 1` against a running dev server before any frame is filed.

Frames come from `scripts/ultrabuild/capture.mjs` with `PT_SERVER_TODAY=2026-08-20` and `--auth`, and
land under `.claude/ultrabuild/shots/<slug>/round-<n>/09-S2/`.

**The spec file.** Appends a `test.describe('09-S2 — Turning two-factor on…')` block to
`e2e/account-and-settings.visual.spec.ts`, importing the shared helpers from `./helpers/shoot.ts` and
adding none of its own. `/settings/two-factor` prints no clock-derived string, so it declares
`relativeTime: false` and is covered by the spec's single `auditServerClock` call over its own route
table. `e2e/helpers/shoot.ts` is not claimed.

**Console must be silent**, asserted through `watchConsole` on every test including the frame-only
ones, with no addition to `TOLERATED_CONSOLE_WARNINGS`.

**Layout shift after paint** is measured exactly as `09-S1` describes — init-script observer, mark
after `settle()`, exercise the three enrolment steps, assert `0` after the mark — gated on
`supportedEntryTypes` and reported as a skip on WebKit rather than as a pass.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test`
passes; the feature is verified in a real browser in light and dark, desktop and mobile; nothing is
left behind — no TODO, no placeholder copy, no `console.log`, no commented-out code; and no file
outside **Owned paths** is touched.

On top of those, the `docs/SPEC.md` §2 visual clauses, ticked per surface this stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each drawn
      on `--color-surface-2` rather than on the raw canvas.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Checked at 360px, 1280px and 2560px, and the small layout is designed rather than a squeezed
      desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

**One, already dispositioned, and it does not stop the stage.** The scannable enrolment code needs an
encoder that is not in the `docs/SPEC.md` §3 pinned set.

- **What it would do:** turn the `otpauth://totp/…` enrolment URI into a matrix an authenticator app
  can read from the screen.
- **Disposition: hand-roll a restricted subset**, recorded in `11-boundaries-and-blockers.md` as
  entry 6 of `11-S2`. The bound is that entry's, restated under **Server** above, and a stage that
  finds itself widening it has left the subset and must stop.
- **What ships if the encoder is late:** the typed secret, which is on screen beside the matrix in
  every case and is the documented path for a reader who cannot scan. The factor works end to end
  without the matrix, so the encoder is a convenience with a deadline, not a precondition.

No package is installed and neither `package.json` nor `pnpm-lock.yaml` is edited by this stage or by
any other in this file. No binding is added to `wrangler.jsonc`. No third-party service is involved.
No row in another plan gates this one.

---

## Stage 09-S3 — The account itself: a password you can change, an address you can move, a face, and a way out

### Stage id

`09-S3` · Wave 1 · effort **L**. The largest stage in the plan and the only one that touches the auth
configuration. Four missing behaviours on one row, kept together because a row is closed by exactly
one stage.

### Reference rows

- `ACC-01` partial → **done**, with per-workspace self-service identity-provider registration named
  under **Blockers** as dropped rather than deferred.

Sourced from `wiki: Account-Management` for the behaviours: change the password without leaving the
product, move the account to a different email address with both addresses told about it, set a
portrait, and delete the account.

**Agreement with the row.** It is right that the six `(auth)` screens are finished, that per-endpoint
rate limits are configured in KV, and that social sign-in is gated on secrets. It is right that the
Password row sends the reader to `/reset-password`, which without a token renders "This link is
incomplete" (`src/routes/(auth)/reset-password.tsx:69-76`), and that Profile offers no email change,
no portrait and no deletion.

**One correction, and it makes the stage cheaper than the row implies.** The email half is already
written. `src/server/auth/email.ts` declares `auth.email-changed` (`:30-36`) and `auth.delete-account`
(`:37-41`) as full members of the `AuthEmailMessage` union, with rendered subject, HTML and text
bodies and a queue hand-off through `queueAuthEmail`. Neither has a producer anywhere in `src/`.
They are two more of the write paths this repository is short of, and this stage is their caller.

Rows unblocked: none directly. Every account-level surface benefits, but `gap-rows.json` records no
dependant for `ACC-01`.

### Owned paths

- `src/routes/_app/settings/password.tsx` — new. `/settings/password`, the in-app change.
- `src/routes/_app/settings/security.tsx` — edit. The Password row points at the new route, and its
  hint stops promising a one-time link. This is the one wave-1 stage that claims this file, by the
  argument in the area brief; the other two repair their own destinations and leave it alone.
- `src/routes/_app/settings/index.tsx` — edit. The Profile screen gains the portrait, the email
  change and the entrance to deletion. Its six regional overrides are untouched here; `09-S8` owns
  them in wave 3.
- `src/routes/_app/settings/-ui/account-identity.tsx` — new. The portrait uploader and the email
  change, with all their states.
- `src/routes/_app/settings/-ui/delete-account-dialog.tsx` — new.
- `src/routes/(auth)/reset-password.tsx` — edit. Adds the `beforeLoad` that sends a signed-in visitor
  with no token to `/settings/password`. The token path is untouched.
- `src/server/auth/index.ts` — edit. Enables the two `user` capabilities and adds the update guard.
- `src/server/auth/__tests__/account-lifecycle.test.ts` — new.
- `src/server/fns/account.ts` — new. The portrait upload and removal.
- `src/server/fns/__tests__/account.test.ts` — new.
- `src/routes/api/avatar/$userId.ts` — new. The server route that serves a stored portrait.
- `src/server/repos/members.ts` — edit. Adds `deleteWorkspace`, described under **Server**.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. One new `describe` block, under the
  append-only exception the tenant procedure allows.
- `src/lib/i18n/messages/en/settings.ts` — append. The `account.*` keys and nothing else, under the
  same absent-or-present rule as `09-S2`.
- `e2e/account-and-settings.visual.spec.ts` — append.
- `e2e/__screenshots__/account-and-settings.visual.spec.ts/` — append.

**Two files in this list are touched by more than one plan, in different waves, and both are named
here as `check-plan-collisions.mjs` requires.** `src/server/auth/index.ts` and
`src/server/repos/members.ts` are both edited by `10-S1` in wave 3 (`10-administration.md`), which
owns member and invitation administration, and `src/server/repos/members.ts` is edited again by
`10-S4` in wave 5 of the same plan; this stage is wave 1 and shares neither file with either of them
concurrently. The `deleteWorkspace` function this stage mints is the one that stage will find
already present, and the workspace-level affordance for it belongs to that plan rather than to this
one.

`src/routes/_app/-server/settings.ts` is not claimed:
`loadProfile` already returns `user.image` (`:112`, via `requireSessionUser` at `:73-93`), so the
Profile screen already has every field this stage renders.

### Data and migration

**No schema change and no migration.** Every field exists: `user.email`, `user.emailVerified`,
`user.name` and `user.image` are Better Auth columns in `src/server/db/auth-schema.ts`, and the
portrait's bytes live in the `FILES` R2 bucket rather than in a column. Nothing is filed for a wave-0
foundations schema stage.

**The portrait's object key** is `avatars/<organizationId>/<userId>`, fixed rather than generated per
upload. A fixed key means an upload replaces the previous object in place, so the bucket never
accumulates a history nobody asked for and no cleanup job is needed. Cache busting is a `v` query
parameter carrying the user row's `updatedAt` in epoch milliseconds, which is the same instant
convention the rest of the schema uses.

### Server (repo, server function, Zod)

**Repository — `src/server/repos/members.ts`, edited.** One new function:

```
deleteWorkspace(scope: TenantScope): Promise<void>
```

It is minted here because deleting the last account in a workspace has to delete the workspace, and
it is the only correct place for that SQL. Its scoping is the documented exception this module's
header already states: `organization` is the one tenant table whose discriminator **is** its primary
key, so the predicate is `id = scope.ctx.organizationId` and never an id from the caller. The
function asserts the caller's role through `assertCanAdminister` (`src/server/repos/context.ts`) and
refuses unless `countMembers(scope)` returns exactly one, so a workspace with other people in it can
never be removed by one member leaving. The delete itself is a single row: every domain table's
`organization_id` is declared through `orgRef()` with `ON DELETE CASCADE`, so removing the
`organization` row removes all fifty-seven tables' rows for that tenant in one statement, inside D1's
own transactional semantics.

A workspace-level "delete this workspace" affordance is **not** shipped by this stage.
`10-administration.md` owns the workspace console (`ADM-02`, wave 3) and is where such a button
belongs; this stage exposes the function only through account deletion.

Read-only repository calls, none of them widened: `countMembers`, `listMemberProfiles` and
`getMembership` from the same module, and `getStorageUsage` from `src/server/repos/files.ts`. Each is
already built on `tenantFilter()`.

**Server functions — `src/server/fns/account.ts`, new.**

- `uploadAvatarFn` — `createServerFn({ method: 'POST' })` taking `FormData`, returning a `Response`
  the browser can render verbatim as `{ ok: false, code, message }` on refusal. It follows
  `uploadTripFileFn` (`src/server/fns/files.ts:114-160`) step for step: obtain the scope with
  `appScope()`, resolve the content type through `src/server/fns/file-policy.ts` (read, not edited)
  against an image allow-list of PNG, JPEG and WebP, refuse above **2 MiB**, `put` the object under
  the fixed key, and only then update the user row. The order is object first, row second, with a
  compensating `delete` if the row update throws — the same ordering `files.ts` uses and for the same
  reason.
- `removeAvatarFn` — `createServerFn({ method: 'POST' })`, deletes the object and clears `user.image`.
- **The row update is server-side, deliberately.** The obvious shape — return the URL and let the
  browser call `authClient.updateUser({ image })` — would let any client set `user.image` to any URL,
  including a third party's tracking pixel rendered in every member list. So the server function
  writes the field itself through the auth API with the request's own headers, and
  `src/server/auth/index.ts` gains a `databaseHooks.user.update.before` guard that rejects an `image`
  value which is not a same-origin `/api/avatar/…` path. The guard is what makes the endpoint safe;
  the server-side write is what makes it convenient.

**Server route — `src/routes/api/avatar/$userId.ts`, new.** Declares only `server: { handlers: { GET } }`,
which is what keeps the handler and the bucket binding out of the client bundle — the idiom
`src/routes/api/tiles/$.ts:58-66` already establishes. It requires a session, resolves the caller's
scope, and serves the object only when the requested user shares a workspace with the caller,
answering `404` otherwise so the endpoint never confirms that an unrelated account exists. Headers:
the stored content type, and `cache-control: private, max-age=300`, because a portrait is
workspace-internal and nothing shared may hold a copy. A new route file means **`pnpm generate-routes`**;
`src/routeTree.gen.ts` is never hand-edited and is not listed under **Owned paths**.

**The auth configuration — `src/server/auth/index.ts`, edited.** Three additions, no new plugin:

- `user.changeEmail.enabled: true` with `sendChangeEmailVerification`, which calls `queueAuthEmail`
  with the `auth.email-changed` message that already exists. Better Auth sends the confirmation to
  the **current** address, which is the property that stops a borrowed session from silently moving
  an account away from its owner, and the copy says so.
- `user.deleteUser.enabled: true` with `sendDeleteAccountVerification` over the existing
  `auth.delete-account` message, plus a `beforeDelete` hook that runs the workspace resolution
  described below and throws a written error when it refuses.
- The `databaseHooks.user.update.before` image guard.

Nothing else in that file changes: `twoFactor()`, `organization()` and `passkey()` keep their
configuration exactly as it stands (`organization()` carries `disableOrganizationDeletion: true` since
#999, and `deleteWorkspace` deletes through repository SQL, never through the plugin's
`organization/delete`), and no plugin is added or removed.

**Deletion, stated as rules rather than as code**, because getting it wrong is unrecoverable:

> **Superseded in part by `.ai/specs/2026-10-08-erase-a-persons-data.md` (#811).** Rules 2 to 4 below are the
> workspace half of one shared erasure engine: `beforeDelete` calls that engine and carries no workspace logic of
> its own, and the engine's refusals (sole owner of a team, live subscription on a workspace it would delete) apply
> to this path too. Two corrections the spec makes: the R2 prefix in rule 2 (`<organizationId>/`) matches no key
> the product writes (the real prefixes are `trips/<organizationId>/`, `exports/<organizationId>/` and
> `avatars/<organizationId>/`), and the rules never say what happens to a workspace's subscription (the spec
> blocks the erasure until it is cancelled). `deleteWorkspace` is also built earlier, by the spec's workspace-deletion
> slice, which puts it in `src/server/repos/members.ts` where this stage and plan 10 expect it; whichever lands first adds
> it and the other consumes it. The rest of this stage (the dialog, the two confirmations) stands.

> **Superseded in part by `.ai/specs/2026-10-17-delete-a-workspace-you-own.md` (#1000).** That spec owns
> `deleteWorkspace`: it asserts `owner` through `assertRole` (not `assertCanAdminister`, which admits `admin`), deletes
> only while the caller is the sole member through one guarded statement, and sits inside one driver
> (`advanceWorkspaceDeletion`) that this stage's rules 1 to 3 reach through the erasure engine. The cascade covers 61
> `orgRef()` tables, not fifty-seven. Rule 3's "not the sole member: only the `member` row goes" is unchanged.
> The workspace-level "delete this workspace" button is no longer plan 10's (`ADM-02`): it is #1000's, in the spec above (Phase 8).

1. The reader confirms by email — Better Auth's own verification round-trip — and then by typing
   their password. Both, not either.
2. `beforeDelete` enumerates the caller's memberships. For every workspace where they are the sole
   member, `deleteWorkspace` runs in that workspace's scope and the R2 objects under
   `<organizationId>/` are removed in batches of up to a thousand keys, capped at ten thousand
   objects per deletion — far above what a single-person workspace can hold under any published
   plan's file quota. A prefix still returning keys at the cap is recorded as one structured log line
   naming the prefix; the remainder is work for the weekly retention trigger declared in
   `wrangler.jsonc`, which `src/server/worker.ts` currently answers with a warning. That handler is
   not this stage's to write and this stage does not pretend it exists.
3. For every workspace where they are **not** the sole member, their `member` row is removed.
4. If they are the **last owner** of a workspace that still has other members, deletion is refused
   with a written message telling them to hand ownership over first. Role changes are `ADM-02`'s
   surface in `10-administration.md` (wave 3); until it ships, the message names the workspace and
   says an owner must be appointed, which is honest rather than a dead link.

**Zod v4 on every input.** `z.strictObject` for the change-password and change-email payloads,
`z.email()` for the address — the v4 top-level format, not `z.string().email()` — and the `error`
parameter for messages. Password length is checked against `MIN_PASSWORD_LENGTH` and
`MAX_PASSWORD_LENGTH` rather than against a second pair of numbers, and each half takes them from the
copy it is allowed to see: the **server** function imports them from `src/server/auth/index.ts:40-41`,
and the **client** form imports them from `src/routes/(auth)/-lib/schemas.ts:16,18`, a module whose
only import is `zod` and whose own comments say each constant is kept in step with the server one. The
client must not reach for `#/server/auth` — that would pull the auth configuration into the browser
bundle — and it must not hardcode `10`, which would be the third copy.

**The Better Auth client calls this stage uses:** `authClient.changePassword({ currentPassword,
newPassword, revokeOtherSessions })`, `authClient.changeEmail({ newEmail, callbackURL })`,
`authClient.deleteUser({ password, callbackURL })` and `authClient.useSession()`. All four are core
methods of the client created at `src/lib/auth/client.ts:30-33`; **no new auth plugin is added** to
reach them, and `src/lib/auth/client.ts` is not edited by this stage — `09-S1` owns it in this wave.

**Authorisation is decided on the server, every time.** `appScope()` for the two server functions and
the avatar route, `sessionMiddleware` inside the library endpoints, and the workspace set for
deletion derived from the caller's own memberships. No workspace id, user id or object key ever
arrives from the browser and is trusted: the avatar key is built from the scope, and
`/api/avatar/$userId` re-checks shared membership before it reads a byte.

Nothing slow runs inline. The two emails are enqueued on `TASKS` by `queueAuthEmail`, which is what
that function already does.

### UI (route, components)

**Routes.** `/settings/password` (new file, inside the settings shell, default SSR) and the edited
`/settings` index. The redirect added to `src/routes/(auth)/reset-password.tsx` reads
`loadAuthConfig` and the route's own `search.token`: signed in **and** no token means the reader
wanted to change a password they still know, so they are sent to `/settings/password`. With a token,
or signed out, the screen renders exactly what it renders today.

**Both halves of that repair are shipped, and the second is not redundant.** Changing the Password
row's href fixes the affordance for anyone who clicks it from now on; the redirect fixes it for the
reset links already sitting in inboxes and for the bookmark somebody made last month, neither of
which this repository can edit. A destination that answers correctly is worth more than a link that
points somewhere better. Running **`pnpm generate-routes`**
is a step of this stage for the two new files.

**Components, reused not rebuilt.** `Card`, `Button`, `Field`, `Input`, `Alert`, `Badge`, `Dialog`,
`Avatar`, `Skeleton`, `Spinner`, `Progress`, `Separator`, `SectionLabel` and `Tooltip` from
`src/components/ui`; and `SettingsRow` and `SettingsSection` from
`src/routes/_app/-ui/settings-nav.tsx`, imported and not edited, so the Profile screen keeps the row
rhythm the other five sections use.

**The strength meter is a requirement this stage files, not a component it reuses, and
`/settings/password` ships without one.** Measured rather than assumed: the meter is
`PasswordStrength` at `src/routes/(auth)/register.tsx:84`, a **module-local function that is not
exported**, sitting beside an equally local `scorePassword` (`:72`) and two local label and fill
tables (`:52-64`). It is the one strength meter in the product and exactly one screen can reach it.
An earlier revision of this stage listed it among the components it reuses; that was not buildable,
and the two shapes that would make it buildable are both refused here:

- **Export it from `src/routes/(auth)/register.tsx`.** That file is in no stage's **Owned paths** in
  any plan — measured with `grep -rn 'register.tsx' docs/plans/*.md`, which returns only this
  sentence's neighbours — so editing it is an ownership violation, and importing one route module's
  internals from another route group is an import direction the repository uses nowhere.
- **Copy the twenty lines into `src/routes/_app/settings/-ui/`.** A second implementation of a thing
  that already ships, which `docs/SPEC.md` §6 and `00-foundations.md`'s primitive rule both call a
  defect rather than a merge conflict.

**The correct fix is the third shape, and it belongs to a stage this plan may not write.** Promote
the meter to `src/components/ui/password-strength.tsx` as a presentation primitive taking `value` and
`minLength` as props — no fetch, no `server/` import, which is what `docs/SPEC.md` §6 requires of
that directory — export it from `src/components/ui/index.ts`, give it a test beside the other 42
primitives' tests, and delete the local copy so `register.tsx` imports it instead of declaring it.
`00-foundations.md:52` reserves `src/components/ui/**` to one primitive stage per wave, and `:43`
states that a feature stage whose **Owned paths** contains one of the six shared files "is malformed
and is rejected before it is scheduled". So this stage does what that ritual prescribes: **it writes
the requirement here and stops.** No wave-1 primitive stage exists at the time of writing, and this
stage does not depend on one.

**What the screen renders instead is the written rule, which is what the product already does on the
same job.** `src/routes/(auth)/reset-password.tsx:139` sets a new password with a `description`
sentence and no meter, and that screen is finished. `/settings/password` carries the same sentence —
"Pick something at least 10 characters long. A short phrase is easier to remember and harder to
guess." — as the `Field` description on the new-password input, so the reader is told the rule before
they type rather than after they submit. The rule itself is enforced twice and neither enforcement
involves the meter: `z.strictObject` on the client and `MIN_PASSWORD_LENGTH` in the server function,
described under **Server** above. When the primitive lands the screen gains it with one import and a
re-record of the two frames that contain that input; nothing else in this stage changes.

**The Profile screen's three new areas.**

- **Portrait.** The current `Avatar` at `size="lg"`, a "Change portrait" button opening the system
  file picker, an instant local preview from an object URL revoked after the upload settles, a
  `Progress` bar while bytes are in flight, and "Remove" as a `ghost` button that asks for
  confirmation inline rather than in a dialog. Drag-and-drop onto the avatar is supported with a
  visible drop target, and the drop target is keyboard-reachable because the button is the real
  affordance and the drop zone is an enhancement.
- **Email address.** The current address with its verified `Badge` — the same pair Security already
  renders — and a "Change" button revealing an inline form. On submit the screen switches to a
  pending state naming the address the confirmation was sent to, and says in one sentence that the
  change takes effect only when that link is opened.
- **Danger zone.** A `Card` with a `danger`-toned border, one sentence on what deletion removes, and
  a button opening `delete-account-dialog.tsx`. The dialog lists, by name, the workspaces that will
  be deleted with the account and the ones the reader will simply leave, requires the password, and
  requires typing the word `delete` — two independent confirmations, because the action is not
  reversible.

**States, named rather than promised.**

- **Empty** — the danger dialog's workspace list when the reader belongs to exactly one personal
  workspace: instead of a list, a single sentence naming it, on `--color-surface-2`. The portrait
  area's empty state is the initials `Avatar` the primitive already renders, with the copy "No
  portrait yet".
- **Skeleton** — Profile's `pendingComponent` already exists and gains rows at the new areas' exact
  heights, drawn on `--color-surface-2`, so nothing shifts when the loader resolves.
- **Error** — every one of the four actions renders its failure inline on the surface that caused it,
  as an `Alert` `tone="danger"` on `--color-surface-2`, with the action's own retry. Four failures
  get written copy rather than a generic message: a wrong current password, an address already in
  use, a file above 2 MiB or of an unaccepted type, and a `429`.
- **Loading** — each button carries `loading` and a `loadingLabel` naming what is happening
  ("Saving", "Sending confirmation", "Uploading", "Deleting account"), and stays mounted while the
  request is in flight so the spinner is visible instead of the control vanishing.

**Motion.** The inline email form and the danger dialog enter at 220ms on `--ease-out-quint` and
leave at 150ms, transform and opacity only. The portrait preview cross-fades at 150ms.
`prefers-reduced-motion: reduce` collapses all three to opacity.

**Tokens.** None missing; nothing is filed for a foundations token stage. The upload's byte counts
and the storage ceiling they are measured against are `tabular-nums`, which is every number on this
stage's surfaces that changes.

**Copy language: English, `en-GB`**, sentence case, as fixed in the area brief above.

**Where those strings are authored.** In `src/lib/i18n/messages/en/settings.ts` under the
`account.*` prefix. That includes the two rows this stage rewords on
`src/routes/_app/settings/security.tsx`, so the hint that stops promising a one-time link stops
promising it in every locale rather than only in English.

### Quota

**One metered write, and one deliberately unmetered one.**

- The portrait is **not** a countable row. It is one object per user at a fixed key, capped at 2 MiB
  and overwritten in place, so a tenant's portrait footprint is bounded by its seat count times the
  cap — a bound the seat quota already sells. No metric is added to `resolveLimits()`
  (`src/server/billing/limits.ts`) or to `PLAN_QUOTAS` (`src/server/db/types.ts`), and nothing is
  added to `src/server/billing/__tests__/limits.test.ts`. The stage says this out loud because the
  alternative — inventing a `portraits` metric nobody sells — is the failure mode the quota rule
  exists to prevent.
- **Storage bytes are still respected.** The upload reads `getStorageUsage(scope)` and
  `resolveQuotas(scope)` before it writes and refuses when the workspace is already at its
  `storage_bytes` ceiling, with a message naming the ceiling. The R2 write happens first and the
  object is deleted if the subsequent check or row update throws, which is the compensating order
  `src/server/repos/files.ts` already uses.
- Account deletion **frees** rows and objects and consumes nothing.

### Tenant isolation test

Appended to `src/server/repos/__tests__/tenant-isolation.test.ts` as one new `describe` block, over
`deleteWorkspace` in `src/server/repos/members.ts`:

- Organization A, in A's scope, calls `deleteWorkspace` and B's `organization` row, B's members and
  B's domain rows are all present and unchanged afterwards. The function takes no id, so the test's
  job is to prove that the id it derives is the scope's and can be nothing else.
- A scope whose role is not `owner` is refused by `assertCanAdminister` with the repository's own
  error, and A's rows survive.
- A scope whose workspace has two members is refused before any delete runs, and both members' rows
  survive.
- After a legitimate delete of A's single-member workspace, a representative row from each of four
  domain tables that referenced it — `trips`, `notifications`, `user_settings`, `audit_log` — is gone
  through the `ON DELETE CASCADE` declared by `orgRef()`, and B's rows in the same four tables are
  untouched. This is the case that proves the cascade is real rather than assumed.

The read-only functions this stage calls — `countMembers`, `listMemberProfiles`, `getMembership`,
`getStorageUsage` — already carry isolation cases in that file and are not re-covered.

### Verification

**How this is run.** `docs/plans/12-verification-protocol.md` owns the procedure. Two of its clauses
bind this stage in particular: §6, because a destructive dialog is exactly where an unhandled
rejection reaches the console, and §5, because a re-record here would be re-recording a screen three
stages share.

**The command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**The Playwright run, written out in full.** There is no `test:e2e`, no `test:visual` and no
`playwright` script, and `docs/SPEC.md` §3 freezes `package.json` so none may be added:

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)   # --start only when the pool is empty
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/account-and-settings.visual.spec.ts -g '09-S3'
```

Both browser projects run: `chromium` at 1440x900 and `mobile-safari` on WebKit at 393x659. Those
are the gate's viewports and are separate from the evidence widths below — the gate proves nothing
changed, the frames prove the thing is good. `--project=setup` is re-run whenever a cached session
starts redirecting to `/login`; without `PLAYWRIGHT_BASE_URL` the config waits on port 3000 until the
global timeout. Baselines are recorded with `--update-snapshots` under the same `-g` filter;
`maxDiffPixelRatio` stays at `0.002` and `threshold` at `0.2` — neither is raised, per §5, and a
failing comparison is either the renderer's or the product's.

**Unit tests, by file and invariant.**

- `src/server/auth/__tests__/account-lifecycle.test.ts` — the `beforeDelete` resolution: sole-member
  workspaces are selected and multi-member ones are not; a last owner of a shared workspace is
  refused with the written message; the image guard rejects an absolute external URL, rejects a
  protocol-relative one, and accepts `/api/avatar/<id>?v=<ms>`.
- `src/server/fns/__tests__/account.test.ts` — a 2 MiB + 1 byte upload is refused before the bucket is
  touched; an unaccepted content type is refused by name; a thrown row update deletes the object it
  just wrote; the object key is built from the scope and is byte-identical for two uploads by the
  same user.
- The isolation cases above, in the shared isolation file.

**Browser evidence.** Routes `/settings` and `/settings/password`, both themes, at **360px, 1280px
and 2560px** — twelve resting frames. Declared non-resting states, because three of this stage's four
outcomes are dialogs or inline forms that a resting frame cannot show:

- `--state delete-dialog`, reached with `--click '[data-part="account-delete"]'`;
- `--state email-change`, reached with `--click '[data-part="account-email-change"]'`;
- `--state avatar-uploading`, reached by a `page.route()` that holds `/api/…/uploadAvatarFn` open, so
  the `Progress` bar and the button's `loading` state are both in the frame;
- `--state list-error`, reached with a `page.route()` failure on the same call.

Every selector is a `data-part` attribute this stage publishes, verified with
`page.locator(sel).count() === 1` against a running dev server before any frame is filed. Frames come
from `scripts/ultrabuild/capture.mjs` with `PT_SERVER_TODAY=2026-08-20` and `--auth`, under
`.claude/ultrabuild/shots/<slug>/round-<n>/09-S3/`.

**The spec file.** Appends a `test.describe` block named for this stage to
`e2e/account-and-settings.visual.spec.ts`, importing the shared helpers from `./helpers/shoot.ts` and
adding none of its own. Both routes print absolute dates only, so both declare `relativeTime: false`
and are covered by the spec's single `auditServerClock` call over its own route table.
`e2e/helpers/shoot.ts` is not claimed.

**Console must be silent**, asserted through `watchConsole` on every test including the frame-only
ones, with no addition to `TOLERATED_CONSOLE_WARNINGS`.

**Layout shift after paint** is measured as `09-S1` describes: init-script observer, mark after
`settle()`, open the email form and the danger dialog, assert `0` after the mark, gated on
`supportedEntryTypes` with the WebKit skip reported as a skip.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test`
passes; the feature is verified in a real browser in light and dark, desktop and mobile; nothing is
left behind — no TODO, no placeholder copy, no `console.log`, no commented-out code; and no file
outside **Owned paths** is touched.

On top of those, the `docs/SPEC.md` §2 visual clauses, ticked per surface this stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each drawn
      on `--color-surface-2` rather than on the raw canvas.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Checked at 360px, 1280px and 2560px, and the small layout is designed rather than a squeezed
      desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

**One, dispositioned as dropped, and it removes a behaviour from the row rather than stopping the
stage.** Per-workspace self-service registration of an identity provider — a tenant storing its own
issuer, domain and client configuration and having it matched by email domain at sign-in — needs an
auth plugin that ships as a separate package and is absent from the `docs/SPEC.md` §3 pinned set.

- **Disposition: drop**, recorded in `11-boundaries-and-blockers.md` as entry 2 of `11-S2`. It is not
  sold. If enterprise sign-in is ever required it lands as deployment-level configuration through the
  generic provider plugin that **is** in the pinned set — a secrets change, not a tenant-editable
  feature.
- **Nothing else on the row is blocked.** The password change, the email change, the portrait and
  the deletion are ordinary work, and social sign-in is already the hosted equivalent of
  arbitrary-provider sign-in at our tier.

No package is installed and neither `package.json` nor `pnpm-lock.yaml` is edited. No binding is added
to `wrangler.jsonc`: the portrait uses the `FILES` R2 binding that already exists and is already read
by `src/server/fns/files.ts`. No third-party service is involved. No row in another plan gates this
one — `00-S3`'s audit trail is a wave-0 stage and is available, but this stage does not require it.

---

## Stage 09-S4 — Installable, and honest about what it caches

### Stage id

`09-S4` · Wave 1 · effort **S**. The smallest stage in the plan, and the one whose build plugin is
already installed.

### Reference rows

- `ACC-07` absent → **done**.

Sourced from `wiki: Offline-Mode-and-PWA` for the installability half only: a web application
manifest, an icon set, a standalone display mode and theme colours.

**Agreement with the row, and the correction that makes it cheap.** The row is right that
`public/` holds exactly one file and that there is no manifest and no service worker. It is also
right that the meta half already ships: `src/routes/__root.tsx:56-61` already sets
`application-name`, `apple-mobile-web-app-title`, `color-scheme` and a **pair** of per-scheme
`theme-color` values, and `:50-53` already sets `viewport-fit=cover`.

The correction is about the dependency. **`vite-plugin-pwa` is already a devDependency at `1.3.0`**
— measured in `package.json` and in `node_modules/vite-plugin-pwa/package.json` — so nothing is
installed and `package.json` is not edited. One narrower fact governs the whole design, and it is
`11-S2` entry 4's measurement: the plugin's service-worker toolbox arrives **transitively** and is
not hoisted, so application code under `src/` cannot import it even though the build plugin can use
it internally. That forbids the `injectManifest` strategy, which would require our own service-worker
source file to import those packages. `generateSW` is therefore not a preference — it is the only
strategy available under the freeze, and every decision below follows from it.

**`ACC-08` is not this stage.** Offline trip bundles, a pending-change queue and a conflict console
are excluded in `docs/plans/11-boundaries-and-blockers.md` — `11-S1` on the grounds that a second conflict
authority would compete with the per-trip Durable Object, and `11-S2` entry 4 on the grounds that the
client-side database it needs is absent. That file names `ACC-07` as the hosted equivalent, and this
stage is it.

Rows unblocked: none. `ACC-07` has no dependants in `gap-rows.json`.

### Owned paths

- `vite.config.ts` — edit. Adds the plugin, configured as below.
- `public/manifest.webmanifest` — new. Hand-authored, not generated.
- `public/icons/icon-192.png` — new.
- `public/icons/icon-512.png` — new.
- `public/icons/icon-maskable-512.png` — new.
- `public/icons/apple-touch-icon-180.png` — new.
- `scripts/render-app-icons.mjs` — new. Renders the four PNGs from the mark that
  `src/routes/__root.tsx:35-41` already inlines as the favicon, using only Node builtins.
- `src/routes/__root.tsx` — edit. The manifest link, the Apple touch icon link, the standalone meta,
  and the registrar mount.
- `src/components/layout/service-worker.tsx` — new. The client-only registration.
- `src/components/layout/__tests__/service-worker.test.tsx` — new.
- `src/components/layout/__tests__/manifest.test.ts` — new. The token-drift guard described below.
- `e2e/account-and-settings.visual.spec.ts` — append.
- `e2e/__screenshots__/account-and-settings.visual.spec.ts/` — append.

`wrangler.jsonc` is **not** claimed and needs no change: it declares no `assets` block today, and
`public/` is already served — measured against a running dev server,
`GET /atlas/country-outlines-50m.v1.txt` answers `200 text/plain`, because `@cloudflare/vite-plugin`
derives the asset configuration from the client build. A file added to `public/` is served by the
same path with no configuration change.

### Data and migration

**None.** No table, no column, no migration, and nothing filed for a wave-0 foundations schema stage.
Installability is a manifest, four images and a build plugin; it stores nothing.

### Server (repo, server function, Zod)

**None of the three.** No repository — this stage writes no row and adds no SQL. No server function —
the manifest and the icons are static assets served by the platform before the Worker runs. No Zod
schema — there is no input to validate, because there is no request this stage handles.

The one server-adjacent property that matters is stated here rather than assumed: the service worker
must never answer a navigation. That is a build-configuration decision, described under **UI**
because `vite.config.ts` is where it is written, and it is the single reason this stage cannot break
streaming SSR.

### UI (route, components)

**No new route**, so `pnpm generate-routes` is not run by this stage. Two edited surfaces: the
document head and the app shell.

**`src/routes/__root.tsx`** gains, in `links`: `{ rel: 'manifest', href: '/manifest.webmanifest' }`
and `{ rel: 'apple-touch-icon', href: '/icons/apple-touch-icon-180.png' }`; and in `meta`:
`mobile-web-app-capable` and `apple-mobile-web-app-status-bar-style: black-translucent`, which is the
value that makes `viewport-fit=cover` and the safe-area tokens mean something in standalone mode. The
inline SVG favicon at `:34-43` stays exactly as it is — it costs no request and never 404s, and the
PNG set exists for the platforms that will not read an SVG. The existing `theme-color` pair is not
touched.

**`public/manifest.webmanifest`, hand-authored.** `manifest: false` is set on the plugin so nothing
generates a second one, because a generated manifest is a manifest nobody reviews. Its fields:
`name` and `short_name` from `SITE_NAME`, `description`, `id: '/'`, `start_url: '/dashboard'`,
`scope: '/'`, `display: 'standalone'`, `orientation: 'any'`, the four icons with `192`, `512`,
`512 maskable` and the Apple touch size, `background_color` and `theme_color`.

**The two colour values, and why they are literals here without breaking the token rule.** A
manifest is JSON and cannot read a CSS custom property. `theme_color` and `background_color` are
therefore the light canvas value `#faf9f7` — the same value `src/styles/tokens.css:27` gives
`--color-canvas` and the same one `__root.tsx:60` already sends as the light `theme-color` meta. A
manifest carries **one** `theme_color`; the per-scheme pair in the document head is what browsers
consult while the app is open, and it stays the source of truth for the running product. The literal
is guarded rather than trusted: `src/components/layout/__tests__/manifest.test.ts` reads both files
and fails if the manifest's `theme_color` is not byte-identical to `--color-canvas` on bare `:root`
in `src/styles/tokens.css`, so a token change that leaves the manifest behind is caught by
`pnpm test` rather than by a reader noticing a wrong splash screen.

**The icons, and how four PNGs exist without an image dependency.** `scripts/render-app-icons.mjs`
draws the mark analytically — a rounded rectangle, a circle and a pin, the same three shapes the
inline favicon uses — supersamples four times for anti-aliasing, and encodes the result as a PNG with
`node:zlib`'s `deflateSync`. Nothing else is imported. The precedent is `scripts/build-country-outlines.mjs`,
which already generates an asset into `public/` from a committed script with Node builtins only. The
script is idempotent: re-running it reproduces the same bytes, so a regenerated icon is a no-op diff.
The maskable variant is the same mark inside the 40% safe zone the maskable spec requires, on a solid
field, so a platform that crops to a circle never clips the pin.

**The service worker, configured so it can only help.** `strategies: 'generateSW'` — forced, as
established above. Then:

- **`injectRegister: false`.** The plugin's other modes write a `<script>` into an HTML entry, and a
  TanStack Start application has no static `index.html` to write into. Registration is therefore
  first-party, in `src/components/layout/service-worker.tsx`: a component mounted in the body from
  `__root.tsx`, which renders nothing, calls `navigator.serviceWorker.register('/sw.js', { scope: '/' })`
  from an effect after `load`, guards on `'serviceWorker' in navigator`, guards on
  `import.meta.env.PROD`, and swallows a rejected registration with a single structured log rather
  than an unhandled rejection in the console.
- **`registerType: 'autoUpdate'`**, so a new deployment takes over on the next load with no prompt UI
  to design and no stale bundle to explain. This is safe **because** nothing but hashed, immutable
  assets is precached; there is no cached HTML that could survive a deployment.
- **No `navigateFallback`, and no `runtimeCaching` entry that matches a navigation.** This is the
  clause that keeps streaming SSR intact. Every navigation goes to the network and is answered by the
  Worker, streamed, with its loader data — exactly as it is today. A service worker that precached an
  application shell would replace a server-rendered document with a cached one, and the reader would
  see yesterday's trip.
- **`workbox.globPatterns: ['assets/**/*.{js,css,woff2,svg}']`**, and explicitly **not** `**/*.html`.
  Content-hashed asset filenames are immutable, so precaching them is a pure win and a precache miss
  falls through to the network rather than failing.
- **Nothing under `/api/` is matched by any rule**, which is how the byte-range tile route stays
  correct. `/api/tiles/*` answers HTTP range requests with `206 Partial Content`, and the Cache API
  cannot store a partial response at all — a `cache.put` of a 206 throws. Worse than useless, it
  would be a second cache layer over one that already exists and is already right: the range-aware
  path in `src/routes/api/tiles/-lib/serve.ts` caches through `caches.default` at the edge, which is
  shared across every reader rather than per-browser. So the service worker never sees a tile
  request, by having no rule that matches one, and the stage asserts this rather than assuming it.
- **`devOptions.enabled: false`.** The service worker is not generated or registered under
  `vite dev`. This matters beyond tidiness: `vite dev` is what `scripts/ultrabuild/resolve-port.sh`
  resolves, what the Playwright gate's `webServer` starts and what every baseline and every capture
  frame is taken against. A service worker caching development assets would poison all three.

**States.** This stage ships no list and no async surface of its own, so there is no empty, skeleton
or error state to design — and that sentence is the answer rather than an omission. The one visible
consequence is the installed window: at 360px the standalone layout must not lose the safe-area
padding, and the frames below prove it.

**Motion.** None added.

**Tokens.** None missing. The two literals in the manifest are the JSON exception argued above, and
they are test-guarded.

**Copy language: English, `en-GB`**, sentence case, as fixed in the area brief above. The manifest's
`name`, `short_name` and `description` are the only user-visible strings this stage adds, and they
reuse `SITE_NAME` and `DESCRIPTION` from `__root.tsx` rather than inventing a second wording.

**This stage authors no catalogue key**, and the area brief's exemption is the reason rather than an
oversight: a web app manifest is static JSON the browser fetches once per origin before any React
tree exists, so it cannot read the catalogue, and this stage renders no sentence inside the
application. `src/lib/i18n/messages/en/settings.ts` is therefore absent from **Owned paths** above.

### Quota

**No countable row.** This stage creates nothing in D1, nothing in R2 and nothing a plan can run out
of. No metric is added to `resolveLimits()` or to `PLAN_QUOTAS`, no `assertQuota` call site is added,
and nothing is added to `src/server/billing/__tests__/limits.test.ts`. The only cost it moves is
build-output size: four PNGs and a service worker, together under 30 KB, against a 10 MB Worker
ceiling.

### Tenant isolation test

**No case is appended to `src/server/repos/__tests__/tenant-isolation.test.ts`, because this stage
adds no repository function and writes no row.** Nothing under `src/server/repos` is touched.

The adjacent property that would be a defect if it were wrong — a cache that outlives a session and
shows one tenant's data to the next reader of the same browser — is prevented by construction rather
than by a test: only immutable, content-hashed, tenant-neutral build assets are precached, no
navigation is ever answered from cache, and no `/api/` response is stored. The spec asserts the first
and third of those directly, in the case listed under **Verification**.

### Verification

**How this is run.** `docs/plans/12-verification-protocol.md` owns the procedure, and this is the one
stage that could break it: §2 records that `vite dev` is what `resolve-port.sh` resolves, what the
gate's `webServer` starts and what every capture frame is taken against, so `devOptions.enabled:
false` is a verification requirement and not only a build preference.

**The command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
`pnpm build` carries more weight here than in any other stage in this plan: it is the only place the
plugin runs, and the stage inspects its output rather than trusting it.

**The Playwright run, written out in full.** There is no `test:e2e`, no `test:visual` and no
`playwright` script, and `docs/SPEC.md` §3 freezes `package.json` so none may be added:

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)   # --start only when the pool is empty
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/account-and-settings.visual.spec.ts -g '09-S4'
```

Both browser projects run: `chromium` at 1440x900 and `mobile-safari` on WebKit at 393x659. Those
are the gate's viewports and are separate from the evidence widths below — the gate proves nothing
changed, the frames prove the thing is good. `--project=setup` is re-run whenever a cached session
starts redirecting to `/login`; without `PLAYWRIGHT_BASE_URL` the config waits on port 3000 until the
global timeout. Baselines are recorded with `--update-snapshots` under the same `-g` filter;
`maxDiffPixelRatio` stays at `0.002` and `threshold` at `0.2` — neither is raised, per §5, and a
failing comparison is either the renderer's or the product's.

**Unit tests, by file and invariant.**

- `src/components/layout/__tests__/manifest.test.ts` — the manifest parses as JSON; `display` is
  `standalone`; `start_url` is within `scope`; the icon list contains a 192 and a 512 entry and one
  `purpose: 'maskable'`; every icon `src` names a file that exists under `public/`; and `theme_color`
  equals `--color-canvas` as declared on bare `:root` in `src/styles/tokens.css`.
- `src/components/layout/__tests__/service-worker.test.tsx` — the component renders nothing; it does
  not call `register` when `serviceWorker` is absent from the navigator; it does not call it when
  `import.meta.env.PROD` is false; a rejected registration does not produce an unhandled rejection.

**Build-output assertions, run as part of the stage rather than eyeballed.** After `pnpm build`: the
client output contains `sw.js` and `manifest.webmanifest`; the generated precache manifest contains
**no** entry ending in `.html`; and it contains no entry beginning `/api/`. These three are the
mechanical form of the three promises above.

**Browser evidence.** The manifest is a document-level artefact rather than a screen, so the frames
are of the surface it changes: route `/dashboard`, both themes, at **360px, 1280px and 2560px** — six
frames — which is where the standalone status bar and the safe-area padding are visible. Plus one
declared non-resting state: `--state installable`, at 360px in both themes, captured after the spec
has asserted `link[rel="manifest"]` resolves with `200` and `application/manifest+json`, so the frame
and the assertion describe the same load.

Selectors are verified with `page.locator(sel).count() === 1` against a running dev server before any
frame is filed. Frames come from `scripts/ultrabuild/capture.mjs` with `PT_SERVER_TODAY=2026-08-20`
and `--auth`, under `.claude/ultrabuild/shots/<slug>/round-<n>/09-S4/`.

**The spec file.** Appends a `test.describe` block named for this stage, importing shared helpers
from `./helpers/shoot.ts`. It adds one non-frame test: fetch `/manifest.webmanifest` and each icon
path and assert `200`; and assert that under `vite dev` `navigator.serviceWorker.controller` is
`null`, which is the runnable form of `devOptions.enabled: false`. `/dashboard` is already declared in
`e2e/visual.spec.ts`'s `APP_ROUTES`; this spec's own route table declares it again for its own
`auditServerClock` call, and the existing declaration is not edited. `e2e/helpers/shoot.ts` is not
claimed.

**Console must be silent**, asserted through `watchConsole` on every test. The registration failure
path logs through the structured logger rather than `console`, so a browser without service-worker
support produces no console output at all — which is itself asserted.

**Layout shift after paint.** Measured as `09-S1` describes. It is worth measuring here specifically
because an icon or manifest link added to `<head>` is the classic cause of a late reflow; the
assertion is `0` after the settle mark, gated on `supportedEntryTypes`.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test`
passes; the feature is verified in a real browser in light and dark, desktop and mobile; nothing is
left behind — no TODO, no placeholder copy, no `console.log`, no commented-out code; and no file
outside **Owned paths** is touched.

On top of those, the `docs/SPEC.md` §2 visual clauses, ticked per surface this stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each drawn
      on `--color-surface-2` rather than on the raw canvas.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Checked at 360px, 1280px and 2560px, and the small layout is designed rather than a squeezed
      desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

The three list-shaped clauses are ticked as "no list and no async surface is shipped by this stage",
which is the honest reading; ticking them any other way would be ticking a box nobody looked at.

### Blockers

**None.** The build plugin is present at `1.3.0` and nothing is installed; `package.json` and
`pnpm-lock.yaml` are not edited by this stage or by any other in this file. No binding is added to
`wrangler.jsonc`. No third-party service is involved. No row in another plan gates this one.

One adjacent constraint is recorded so a later reader does not mistake it for an oversight: the
service-worker toolbox cannot be imported from `src/` (`11-S2` entry 4), so any future work wanting a
hand-written service worker — background sync, push delivery, a genuine offline route — is blocked on
that same measurement and is not made available by this stage.

---

## Stage 09-S5 — Speaking more than one language: BLOCKED

### Stage id

`09-S5` · Wave 1 · effort **S**. **BLOCKED.** The effort is for the record this stage ships, not for
the feature: `gap-rows.json` scores the row itself far higher, and none of that work can be started
until the block below is lifted. A blocked stage that quietly carried a large effort roll-up would be
a stage somebody schedules.

### Reference rows

- `ACC-06` partial → **partial**, and the reason it does not move is this stage's whole content.

Sourced from `wiki: Languages` for the behaviours: choose a language before and after signing in,
apply it without a reload, lay the interface out right-to-left where the language requires it, and
resolve which language to use through a defined chain when the reader has expressed no preference.

**What is deferred, and to which stage id: all of it, to a re-planned `09-S5` in the wave after the
block is lifted.** No behaviour on this row is picked off early, because the half-measures are the
expensive kind: a screen translated without a formatter that knows the locale prints English dates
under Japanese labels, and a direction attribute without logical CSS produces a mirrored layout with
un-mirrored icons. Either is worse than one honest language.

Rows unblocked: none. Nothing in `gap-rows.json` depends on `ACC-06`.

### Owned paths

**None.** This stage creates and edits no repository file. Its output is the decision recorded here
and the reconciliation requirement below, so that no other stage in this plan invents a language
mechanism on the way past — which is exactly why every other stage restates the copy language under
its own **UI** heading.

### Data and migration

**No schema change, and one measured reason it would be premature.** The columns already exist:
`user_settings.locale` (`src/server/db/schema.ts:1834`) and `organization_settings.locale` are real,
`src/server/repos/settings.ts` already validates a locale and already resolves the user's over the
workspace's in `getEffectiveSettings`, and `loadProfile` already returns both
(`src/routes/_app/-server/settings.ts:119`, `:128`). Storage is not what is missing.

Nothing is filed for a wave-0 foundations schema stage.

### Server (repo, server function, Zod)

**Nothing is added.** No repository function, no `createServerFn`, no schema. The resolution chain
this row describes would be read-side work over data that is already stored and already scoped, and
designing it before the runtime exists would fix its shape around a mechanism nobody has chosen.

One constraint is recorded because it binds whoever does eventually build it, and it has been
re-measured rather than carried forward. At the commit this plan was written against,
`src/lib/format.ts` pinned `const LOCALE = 'en-GB'` at `:35` and froze the abbreviated month names in
a table at `:38-54`, because the Worker runtime and WebKit disagree about them. On disk while this
revision was written, that module has already taken the shape the constraint implies: every function
carries a trailing `locale` defaulting to `en`, the frozen values have moved into `./format-tables`,
and the header at `:8-9` still says there is exactly one date formatter in the product and a second
must not be added. Either way the rule is the same and it is the reason this stage exists: locale is
threaded **through** that module, never around it, and a divergent platform value is frozen in a
table rather than looked up at runtime. A stage that adds a second formatter has broken the product's
typography before it has translated a word.

### UI (route, components)

**No route and no component.** The one UI consequence to state is what every other stage in this plan
already states: **the user-visible copy language is English, `en-GB`**, sentence case, matching the
one formatter in `src/lib/format.ts`. That is not a placeholder awaiting this row — it is the product's language
until this row ships, and a stage that writes copy in anything else, or that leaves a string
un-written pending translation, has invented a mechanism this stage exists to prevent.

**Tokens.** None needed. Worth recording for whoever unblocks this: the direction half of the row is
already affordable, because the token set and the utility layer support logical properties, so
right-to-left is a document attribute plus discipline rather than a second stylesheet.

### Quota

**No countable row.** This stage writes nothing. No metric, no `assertQuota` call site, no addition to
`src/server/billing/__tests__/limits.test.ts`.

### Tenant isolation test

**No case is appended to `src/server/repos/__tests__/tenant-isolation.test.ts`**, because this stage
adds no repository function and writes no row. The locale columns it discusses are already covered:
`user_settings` and `organization_settings` are tenant-scoped through
`createTenantRepository` in `src/server/repos/settings.ts:42-46`, and `09-S8` adds the isolation case
for the writes it makes to them.

### Verification

**How this would be run, when it is.** `docs/plans/12-verification-protocol.md` owns the procedure,
and it is cited here to say what this stage does not owe and why, rather than to leave the heading
empty. A blocked stage that quoted a command it never runs would be a stage that looks verified.

**The command gate still applies, and it is trivially satisfied:** `pnpm lint`, `pnpm typecheck`,
`pnpm test`, `pnpm build`, all unchanged because no source file is touched.

**No Playwright invocation is owed.** This stage ships no surface and appends no `test.describe`
block, so there is nothing to point a project at. The re-planned stage that unblocks the row owes
the full invocation, both projects, and the frame set named below.

**No unit tests**, because there is no new logic.

**No browser evidence, and that is a claim rather than a gap.** This stage ships no surface, so there
is nothing to photograph; a frame filed under this stage id would be a frame of somebody else's work.
When the block is lifted, the re-planned stage owes the full frame set — both themes at 360px, 1280px
and 2560px, per language shipped, plus a right-to-left layout at all three widths — and it owes a
declared non-resting state for the language switcher itself.

**Console and layout shift** are not asserted here for the same reason: no surface, no assertion.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test`
passes; the feature is verified in a real browser in light and dark, desktop and mobile; nothing is
left behind — no TODO, no placeholder copy, no `console.log`, no commented-out code; and no file
outside **Owned paths** is touched.

The §2 visual clauses are listed unchanged, and every one is ticked as **not applicable: this stage
ships no surface**. That is the honest reading for a stage whose output is a decision; ticking one
any other way would be ticking a box nobody looked at.

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each drawn
      on `--color-surface-2` rather than on the raw canvas.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Checked at 360px, 1280px and 2560px, and the small layout is designed rather than a squeezed
      desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

**Two. The first is the package; the second is that the work has since been given an owner who is
not this plan.** Both are stated so that nobody schedules this stage, and so that nobody reads its
absence as the feature having been forgotten.

**1 — The missing capability: a locale and message runtime.** A message catalogue with plural and
gender selection, and locale-aware routing of every formatted date, number and currency. No such
package is in the `docs/SPEC.md` §3 pinned set, and §3 is unambiguous about the verdict: stop and
report, do not install. Neither `package.json` nor `pnpm-lock.yaml` is edited by this stage or by any
other in this file.

- **Chosen fallback: hand-roll a restricted subset.** It is recorded in
  `docs/plans/11-boundaries-and-blockers.md` as entry 1 of the register in `11-S2`, and the bound is
  that entry's: a typed catalogue module per locale keyed by message id and checked by TypeScript
  rather than at runtime; no message-format parser, so interpolation is named placeholders only and
  plurals go through an explicit category selector over `Intl.PluralRules`; locale threaded through
  the single formatter module with the frozen month table extended per locale; and direction handled
  as a document attribute plus logical CSS properties. How many languages ship is a content decision,
  not a code one — the mechanism is sized so that adding one is adding a data file. A stage that
  finds itself writing a message-format parser has left the subset and must stop.
- The other two dispositions were considered and rejected on the record: **defer** would leave the
  product single-language indefinitely with no stated bound, and **drop** would contradict a row the
  matrix scores as real demand.

**2 — The row now has an owner, and it is not this plan. This is the blocker that matters.**
`gap-rows.json` recorded that the row was being built on `main` rather than on this branch — commits
`bbaec51` and `7e50241` adding `src/lib/i18n/**` (catalogue, negotiation, plural, interpolation,
provider and types), `src/lib/fonts.ts`, and several hundred lines across `src/styles/styles.css` and
`src/styles/tokens.css`. Re-measured while this revision was written, that is understated in two ways
that change what this stage may do:

- **`docs/SPEC.md` has grown a §8 that governs the row directly**, and it settles the questions this
  stage was holding open. It fixes the exact set of twenty-three BCP-47 tags and their native names;
  it makes the message layer, the plural rules and the interpolation **ours**, restating §3's freeze
  rather than waiting for it to be lifted; it fixes server-side negotiation before first paint
  (user → workspace → `Accept-Language` → `en`) with `<html lang>` and `<html dir>` server-rendered;
  it makes `ar` a designed right-to-left layout rather than a flip; it carries the cross-runtime
  formatting rule this stage records under **Server**; and it fixes the catalogue layout as
  `src/lib/i18n/messages/<locale>/<namespace>.ts` over ten named namespaces, saying in as many words
  that the layout is contract rather than a builder's choice.
- **The subsystem is materialising in this checkout, not only on `main`.** `src/lib/i18n/` and the
  re-shaped `src/lib/format.ts` are present and measurable here.

So the chosen fallback in blocker 1 is not a proposal any more — §8 is the decision, and it says
hand-roll. What remains true, and is the whole reason this stage stays **BLOCKED** rather than
becoming buildable, is that the work is owned elsewhere: §8 gives `src/lib/i18n/messages/<tag>/`
wholly to the localisation items, and `src/styles/styles.css` and `src/styles/tokens.css` are shared
paths `00-foundations.md` governs and no feature stage may claim in any wave. A stage in **this**
plan that wrote a catalogue, a negotiator or a token would produce the worst outcome
`README.md` describes: a second implementation of a shipped thing, in files two plans both claim.

The re-planned stage's first act is therefore not code and not design. It is to diff this branch
against `main` and against §8, establish what already exists, and re-specify **only** the gap —
which, on the evidence above, may be nothing more than the language picker §8 rule 7 puts in
settings, and even that must be checked against `09-S8`'s ownership of the settings shell before it
is claimed. **It must not re-specify what is already there.**

---

## Stage 09-S6 — The handbook, inside the product

### Stage id

`09-S6` · Wave 1 · effort **M**. The one Extensibility row that survives the hosted multi-tenant
boundary, planned here because it is account-adjacent and reachable from the same menu as settings.

### Reference rows

- `EXT-04` absent → **done**.

Sourced from `wiki: Documentation-Browser` for the behaviours: a reading surface inside the product,
a sidebar that mirrors the table of contents, a filter that narrows the sidebar by title, navigation
between articles that does not reload the page, and stable anchors so a link to a section lands on
that section.

**Agreement with the row.** It is right that no `/help` route exists and that `docs/` holds the
specification and architecture notes with no renderer. It is right that the bundled-directory probe,
the network fallback and the directory-override environment variable are self-host deployment
details with no hosted equivalent — one deployment serves every tenant, so there is no directory for
an operator to point at.

**Where this stage contradicts a sibling plan, stated rather than worked around.**
`11-boundaries-and-blockers.md`, entry 5 of `11-S2`, lists `EXT-04` among five rows blocked on a
markdown renderer, and says the earliest wave-1 stage that needs one owns the single implementation.
**This stage does not need one, so it does not mint one**, and the reason is a property of the
content rather than a preference:

- The other four rows render **tenant-authored** prose — day notes, shared notes, journal entries and
  the export that renders those bodies. Their text arrives from a browser, so a renderer is the only
  way to display it and a sanitiser question follows immediately. That is exactly why `01-S2` chose
  **defer** for `TRP-09` in this same wave.
- Help articles are **first-party**: written in this repository, reviewed in a pull request, compiled
  with the application. Content that is authored in TypeScript can be _typed_ rather than _parsed_.
  A discriminated union of content blocks gives the compiler the job a parser would otherwise do at
  runtime, removes the untrusted-input surface completely, and makes a broken cross-reference a
  `pnpm typecheck` failure instead of a dead link a reader finds.

The consequence for the sibling plan is small and is named so nobody has to re-derive it: entry 5's
blocked list is four rows, not five, and its "earliest wave-1 stage" now means the earliest stage
that renders tenant-authored prose. Nothing else about that entry changes, and the renderer it
describes is still the right answer for the four rows that do need it.

Rows unblocked: none. `EXT-04` has no dependants in `gap-rows.json`.

### Owned paths

- `src/routes/_app/help/route.tsx` — new. The two-column shell: sidebar beside an `<Outlet />`.
- `src/routes/_app/help/index.tsx` — new. `/help`, the overview and the filter.
- `src/routes/_app/help/$slug.tsx` — new. `/help/{slug}`, one article.
- `src/routes/_app/help/-content/types.ts` — new. The block union and the article type.
- `src/routes/_app/help/-content/articles.ts` — new. The articles themselves.
- `src/routes/_app/help/-content/index.ts` — new. The ordered table of contents, the slug index and
  the title-search projection.
- `src/routes/_app/help/-content/__tests__/content.test.ts` — new.
- `src/routes/_app/help/-ui/help-sidebar.tsx` — new.
- `src/routes/_app/help/-ui/article-body.tsx` — new. Renders the block union.
- `src/routes/_app/help/-ui/__tests__/article-body.test.tsx` — new.
- `src/components/layout/user-menu.tsx` — edit. One entry, so the handbook is reachable from every
  screen rather than only from a link somebody remembers.
- `src/lib/i18n/messages/en/settings.ts` — append. The `help.*` keys: the chrome, the entry above,
  and every sentence of the eight articles, because a block carries a key rather than a string. This
  is the largest block in the file and the area brief says what it costs the translation work.
- `e2e/account-and-settings.visual.spec.ts` — append.
- `e2e/__screenshots__/account-and-settings.visual.spec.ts/` — append.

The dash-prefixed `-content/` and `-ui/` directories are non-route folders under TanStack's own
convention, which this repository already uses throughout `src/routes/_app/-lib/`, `-server/` and
`-ui/`.

### Data and migration

**None, and deliberately so.** Articles are modules, not rows. There is no table, no column, no
migration, and nothing filed for a wave-0 foundations schema stage.

The alternative — help content in D1 — was considered and rejected: it would make documentation a
tenant-scoped write path with an editing surface, a quota question and a migration per revision, to
solve a problem a pull request already solves. Content that ships with the code cannot drift from the
code.

### Server (repo, server function, Zod)

**No repository, no server function, no SQL, and no Zod schema.** There is no input: the content is
static, the filter runs in the browser over an index that is already in the bundle, and the slug is a
route parameter validated by the router against the content index rather than by a validator.

That last point is the only correctness question here and it is answered in the route: `$slug.tsx`
looks the parameter up in the slug index and calls `notFound()` when it misses, so an arbitrary
string in the URL renders the app's existing not-found panel rather than an empty article. This is
route-level, not authorisation, because there is nothing to authorise — every article is the same for
every reader.

**Authorisation.** The route sits under `_app`, so the shell's existing guard applies and a signed-out
visitor lands on `/login`. That is a product decision rather than a security one: the handbook talks
about screens only a signed-in reader can open. Nothing about the content is tenant-specific, so no
`TenantScope` is required and none is taken.

**The content model**, stated because it is the whole design:

```
type HelpKey = Extract<MessageKey, `settings.help.${string}`>

type HelpBlock =
  | { kind: 'paragraph'; text: HelpKey }
  | { kind: 'heading'; level: 2 | 3; text: HelpKey; anchor: string }
  | { kind: 'list'; ordered: boolean; items: ReadonlyArray<HelpKey> }
  | { kind: 'steps'; items: ReadonlyArray<{ title: HelpKey; detail: HelpKey }> }
  | { kind: 'callout'; tone: 'info' | 'warning'; title: HelpKey; text: HelpKey }
  | { kind: 'shortcut'; keys: ReadonlyArray<string>; description: HelpKey }
  | { kind: 'link'; to: HelpLinkTarget; label: HelpKey; description: HelpKey }
```

**A block carries a key, never a sentence**, and `HelpKey` is why that costs nothing in safety:
`MessageKey` is the union `src/lib/i18n/types.ts` derives from the ten English namespace files, so
narrowing it to the `settings.help.` prefix makes a mistyped or unauthored key a `pnpm typecheck`
failure that names the key, and makes a key belonging to another part of the product unassignable to
a block. This is the same compiler-instead-of-parser argument as the union itself, applied to the
copy rather than the structure, and it is what lets the eight articles be translated by the ordinary
mechanism instead of becoming the one screen in the product that is permanently English.

Two fields stay plain strings on purpose. `keys` on a `shortcut` is what is physically printed on
the key — `Esc`, `Ctrl`, `⇧` — which `src/lib/i18n/messages/en/ui.ts` already excludes from
translation by the same argument: a translated legend names a key the reader's hardware does not
have.
`anchor` is a URL fragment rather than copy, and the next paragraph is about it.

`HelpLinkTarget` is a union of the router's own param-free literal paths plus
`{ article: HelpSlug; anchor?: string }`, which is what makes an internal cross-reference
type-checked. The same pattern already exists in this repository:
`src/routes/_app/-ui/settings-nav.tsx:26-40` types its `to` values as a literal union against the
generated route tree rather than as strings, for exactly this reason.

**Anchors are derived once and stored, not computed at render.** Each heading block carries its own
`anchor`, a lowercase hyphenated slug of its **English source** text — resolved from
`src/lib/i18n/messages/en/settings.ts` in the test, never from the key name — so the fragment in a
shared link survives a copy edit that only changes capitalisation, and is the same fragment for a
reader in Japanese as for the person who sent it. A test asserts the derivation rather than trusting
it.

### UI (route, components)

**Routes.** `/help` and `/help/$slug`, under the `_app` shell, with `route.tsx` supplying the
sidebar-plus-outlet frame the same way `src/routes/_app/settings/route.tsx` does. Default SSR: the
content is in the bundle, so the first paint is complete and there is nothing to stream. Three new
route files mean running **`pnpm generate-routes`**; `src/routeTree.gen.ts` is never hand-edited and
is not listed under **Owned paths**.

Navigation between articles uses `<Link>`, so it is a client transition with no document load, which
is the row's "does not reload the page" behaviour obtained from the router this product already runs.

**Components, reused not rebuilt.** `Card`, `Input`, `Badge`, `Alert`, `Kbd`, `SectionLabel`,
`Separator`, `ScrollArea`, `EmptyState`, `Skeleton` and `Button` from `src/components/ui`;
`PageHeader`, `AppFrame` and `AppSections` from `src/components/layout`; `NotFoundPanel` for a bad
slug, which is already the app's answer to that question. Two new product components, both in the
route's own `-ui/` directory, neither fetching data and neither importing from `server/`.

**The sidebar.** The table of contents, grouped by section, with the current article marked by
`aria-current="page"` and the same active treatment the settings index uses. Above it, a search
`Input` inside a `role="search"` landmark with an accessible label, filtering **by title only** —
which is the row's behaviour and is also the honest one: a full-text filter that silently missed a
word in a paragraph would be worse than one whose scope the reader can predict. It filters over the
**rendered** titles rather than the key names, so it searches in whatever language the reader is
reading, and the active locale's bag is already resolved in the browser so that costs nothing.
The filter is
debounced at 150ms, announces its result count through an `aria-live="polite"` region, and clears
with Escape.

At 360px the sidebar is not a squeezed column: the article is the page, and the contents collapse
into a `Sheet` opened by a "Contents" button pinned under the page header — a designed small layout
rather than a narrowed desktop.

**The article.** One column at a comfortable measure — 68 characters, not the container's full width
— with `--font-display` headings, `--font-ui` body, and the type scale's `--text-body` and its paired
line height. Headings render an anchor affordance that appears on hover and on focus-visible and
copies a deep link. `steps` renders as a numbered list with `tabular-nums` on the numerals.
`shortcut` renders with `Kbd`. `callout` renders with `Alert`, which already has both tones.

**Images are deliberately not in the block union**, and this is the one place this stage diverges
visibly from the row's shape. Screenshots of a product under active development are stale the week
they are taken, and a help browser whose pictures show last month's layout undermines the text beside
them. The `steps`, `shortcut` and `callout` blocks carry the weight that screenshots would, and they
cannot go out of date silently — a shortcut that changes changes the union member that names it. If
figures are ever wanted, the union gains a `figure` member and the assets land under `public/help/`;
that is a later decision, recorded here so it reads as a choice rather than an omission.

**States, named rather than promised.**

- **Empty** — the filter matched nothing. `EmptyState` on `--color-surface-2`, the heading "Nothing
  matches that", the body "Try a shorter word, or open the contents to browse everything.", and a
  "Clear search" button as the action.
- **Skeleton** — the route's `pendingComponent`: sidebar rows and three paragraph bars at the
  article's measure, on `--color-surface-2`, at the final heights so nothing shifts. In practice the
  content is in the bundle and this is a single frame, which is the point of shipping it as modules.
- **Error** — the route's `errorComponent` renders `ErrorPanel` with the title "The handbook did not
  load", matching the pattern every settings section already uses. A slug that does not exist is not
  an error: it is `notFound()` and the existing `NotFoundPanel`, with a link back to `/help`.

**Motion.** The article cross-fades at 220ms on `--ease-out-quint` on navigation, opacity and
transform only. Filtered sidebar rows stagger at 20ms, capped at eight.
`prefers-reduced-motion: reduce` collapses both to opacity.

**Tokens.** None missing; nothing filed for a foundations token stage.

**Copy language: English, `en-GB`**, sentence case, as fixed in the area brief above. This stage
writes more prose than any other in the plan, so the rule bites hardest here: the articles describe
**our** product in **our** vocabulary — workspace, trip, traveller, plan, atlas, journey — and
nothing is carried across from any other product's documentation, in wording or in structure. The
eight opening articles are: getting started, planning a trip day by day, money and who owes what,
packing lists, sharing a trip, your account and security, keyboard shortcuts, and plans and billing.

**Where those strings are authored.** In `src/lib/i18n/messages/en/settings.ts` under the `help.*`
prefix — and that is the whole of the prose, not only the chrome. A content block carries a
`MessageKey`, never a sentence, which is what keeps `-content/articles.ts` a structure module and
makes the handbook translatable by the same mechanism as every button in the product. It is the
largest single block in that file; the area brief states the cost it hands the translation work.

### Quota

**No countable row.** Nothing is written to D1 or R2, so there is no metric to consume, no
`assertQuota` call site and no addition to `src/server/billing/__tests__/limits.test.ts`. The only
cost is bundle size: eight articles of prose against a 10 MB Worker ceiling, and the content module
is imported by the help routes alone, so it is code-split away from every other screen.

### Tenant isolation test

**No case is appended to `src/server/repos/__tests__/tenant-isolation.test.ts`, because this stage
adds no repository function and writes and reads no row.** Nothing under `src/server/repos` is
touched, and no `TenantScope` is obtained anywhere in the stage.

The property that would matter if this content were tenant-scoped — that one workspace cannot read
another's articles — is vacuous here by construction: every reader sees the same eight articles,
because they are modules in the bundle rather than rows in a database. Stating that is the answer;
adding a test that asserts an organization boundary over a static array would be a test that cannot
fail.

### Verification

**How this is run.** `docs/plans/12-verification-protocol.md` owns the procedure: §4's split rule
puts this stage's tests in this plan's own spec file rather than in `e2e/visual.spec.ts`, and §3
fixes the frame set for both of the routes below.

**The command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**The Playwright run, written out in full.** There is no `test:e2e`, no `test:visual` and no
`playwright` script, and `docs/SPEC.md` §3 freezes `package.json` so none may be added:

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)   # --start only when the pool is empty
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/account-and-settings.visual.spec.ts -g '09-S6'
```

Both browser projects run: `chromium` at 1440x900 and `mobile-safari` on WebKit at 393x659. Those
are the gate's viewports and are separate from the evidence widths below — the gate proves nothing
changed, the frames prove the thing is good. `--project=setup` is re-run whenever a cached session
starts redirecting to `/login`; without `PLAYWRIGHT_BASE_URL` the config waits on port 3000 until the
global timeout. Baselines are recorded with `--update-snapshots` under the same `-g` filter;
`maxDiffPixelRatio` stays at `0.002` and `threshold` at `0.2` — neither is raised, per §5, and a
failing comparison is either the renderer's or the product's.

**Unit tests, by file and invariant.**

- `src/routes/_app/help/-content/__tests__/content.test.ts` — every slug is unique; every article
  appears exactly once in the table of contents and the contents list no slug that has no article;
  every heading anchor is unique within its article and matches the derivation rule applied to the
  English source string the key resolves to; every internal cross-reference resolves to an article
  that exists and, when it carries an anchor, to a heading that exists; no article body is empty;
  every article has exactly one level-2 heading before any level-3 one, so the outline is
  well-formed. Two invariants are about the catalogue rather than the content: every `settings.help.*`
  key authored in `src/lib/i18n/messages/en/settings.ts` is referenced by at least one block, so a key
  orphaned by a rewrite is caught here rather than translated twenty-two times for nothing; and every
  key a block names resolves to a non-empty message, which the type system cannot say.
- `src/routes/_app/help/-ui/__tests__/article-body.test.tsx` — each block kind renders its expected
  role and accessible name; a `shortcut` renders its keys inside `Kbd`; the title filter matches
  case-insensitively and on a substring; the empty result renders the empty state rather than an
  empty list.

**Browser evidence.** Routes `/help` and one article at `/help/{slug}`, both themes, at **360px,
1280px and 2560px** — twelve resting frames. The 360px pair is the one that matters most, because it
is where the sidebar becomes a sheet and where a squeezed desktop would show. Declared non-resting
states:

- `--state contents-open` at 360px, reached with `--click '[data-part="help-contents"]'`, which is
  the collapsed table of contents and is invisible at rest on that width;
- `--state filter-empty`, reached by typing a string that matches nothing into the search input
  before the shutter, so the designed empty state is in a frame rather than only in this document;
- `--state anchor-hover`, reached with `--hover '[data-part="help-anchor"]'`, because the deep-link
  affordance appears on hover and a resting frame is not evidence about it.

Every selector is a `data-part` attribute this stage publishes, verified with
`page.locator(sel).count() === 1` against a running dev server before any frame is filed. Frames come
from `scripts/ultrabuild/capture.mjs` with `PT_SERVER_TODAY=2026-08-20` and `--auth`, under
`.claude/ultrabuild/shots/<slug>/round-<n>/09-S6/`.

**The spec file.** Appends a `test.describe` block named for this stage to
`e2e/account-and-settings.visual.spec.ts`, importing shared helpers from `./helpers/shoot.ts`. It
adds two non-frame tests: keyboard-only navigation from the sidebar into the article and back, with
focus visible at every stop; and a deep link to `/help/{slug}#{anchor}` landing with that heading in
the viewport. Both routes are clock-free, so both declare `relativeTime: false` and are covered by
the spec's single `auditServerClock` call over its own route table. `e2e/helpers/shoot.ts` is not
claimed.

**Console must be silent**, asserted through `watchConsole` on every test including the frame-only
ones, with no addition to `TOLERATED_CONSOLE_WARNINGS`.

**Layout shift after paint** is measured as `09-S1` describes, exercised by navigating between two
articles of different lengths, which is the shift this screen could plausibly produce; the assertion
is `0` after the settle mark, gated on `supportedEntryTypes`.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test`
passes; the feature is verified in a real browser in light and dark, desktop and mobile; nothing is
left behind — no TODO, no placeholder copy, no `console.log`, no commented-out code; and no file
outside **Owned paths** is touched.

On top of those, the `docs/SPEC.md` §2 visual clauses, ticked per surface this stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each drawn
      on `--color-surface-2` rather than on the raw canvas.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Checked at 360px, 1280px and 2560px, and the small layout is designed rather than a squeezed
      desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

**"No placeholder copy" is the clause with teeth here.** Eight articles of real prose is the work; a
stage that ships an outline with a sentence under each heading has shipped placeholder copy and is
not done.

### Blockers

**None**, and the entry in `11-boundaries-and-blockers.md` that names this row is answered rather
than inherited: `11-S2` entry 5 lists `EXT-04` among the rows blocked on a markdown renderer, and the
argument under **Reference rows** above removes it from that list by removing the need. No package is
installed and neither `package.json` nor `pnpm-lock.yaml` is edited. No binding is added to
`wrangler.jsonc`. No third-party service is involved. No row in another plan gates this one.

---

## Stage 09-S7 — Notifications a real action produced, and switches that mean something

### Stage id

`09-S7` · Wave 2 · effort **M**. Wave 2 rather than wave 1 for one reason: it consumes a wave-0 write
path that must have landed first.

### Reference rows

- `ACC-05` partial → **done**, with two of the four channel columns excluded rather than deferred and
  the exclusion argued under **Blockers**.

Sourced from `wiki: Notifications` for the behaviours: a preference matrix of events against delivery
channels, an in-product inbox with an unread count, marking everything read at once, and answering an
actionable notification without leaving the list.

**Agreement with the row.** It is right that `src/routes/_app/settings/notifications.tsx` already
writes a real matrix over `NOTIFICATION_EVENTS` × `CHANNEL_LABELS`, that `/notifications` and the
bell already run `loadNotifications`, `countUnread`, `readNotification` and `readAllNotifications`
against D1, and that `respondToNotification` (`src/server/repos/notifications.ts:183-195`) has no
caller. It is right that only the email channel has any transport, and that one is auth mail.

**The dependency this stage will not build a second time.** The write path is
`00-foundations.md`'s: `00-S2` mints `src/server/notifications/dispatch.ts`, resolves the recipient
set from trip membership under the caller's scope, filters it through `filterEnabledRecipients`,
writes with `notifyMany`, and hands one email envelope per recipient to `TASKS`. It lands in wave 0
with two production callers, `src/server/fns/collab-thread-writes.ts` and `src/server/fns/costs.ts`. **This stage
writes no dispatcher, adds no call site to it, and does not edit either of those files.** It is the
reading and preference half; without `00-S2` its inbox shows seeded rows and its switches govern
nothing, which is precisely why the two are in different waves.

Rows unblocked: four direct dependants of `ACC-05` — `TRP-04`, `LST-01`, `ADD-04`, `ADM-02` — and
twelve more transitively.

### Owned paths

- `src/routes/_app/settings/notifications.tsx` — edit. The matrix: grouping, the honest channel set,
  the per-group bulk toggle and the three list states.
- `src/routes/_app/-lib/notifications.ts` — edit. The event catalogue gains its grouping; the channel
  catalogue loses the column argued under **Blockers**.
- `src/routes/_app/-lib/__tests__/notifications.test.ts` — new.
- `src/routes/_app/notifications.tsx` — edit. The inbox gains the inline answer.
- `src/routes/_app/-server/overview.ts` — edit. Exposes the answer and the actionable list.
- `src/routes/_app/-server/settings.ts` — edit. Adds the bulk preference write.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. One new `describe` block.
- `src/lib/i18n/messages/en/settings.ts` — append. The `notification.*` keys: the matrix, the inbox,
  and the `settings.notification.event.*` messages that the `titleKey` and `bodyKey` values `00-S2`
  stores resolve to. Wave 2, so the file exists by now.
- `e2e/helpers/account-and-settings.ts` — new. The module-local clock helper argued under
  **Verification**, declared here rather than editing the shared `e2e/helpers/shoot.ts`.
- `e2e/account-and-settings.visual.spec.ts` — append.
- `e2e/__screenshots__/account-and-settings.visual.spec.ts/` — append.

**Three files in this list are touched by more than one plan, in different waves, and each is named
here with its sibling stage id as `check-plan-collisions.mjs` requires.**

- `src/routes/_app/-server/overview.ts` — `00-S5` wave 0 (`00-foundations.md`), `01-S1` wave 1 and
  `01-S7` wave 5 (`01-trips-core.md`), `10-S3` wave 4 (`10-administration.md`). This stage is wave 2
  and shares the file with none of them concurrently.
- `src/routes/_app/-server/settings.ts` — `00-S3` wave 0 (`00-foundations.md`), `02-S2` wave 1
  (`02-places-and-maps.md`), `03-S6` wave 4 (`03-reservations-and-transport.md`), and `09-S8` wave 3
  of this plan. Five stages, five distinct waves.
- `src/routes/_app/-lib/notifications.ts` — `05-S1` wave 3 (`05-packing-and-todos.md`), which adds
  its own event to the same catalogue. This stage is wave 2 and lands the grouping that stage's entry
  will slot into.

`src/server/repos/notifications.ts` is deliberately **not** claimed: every function this stage needs
already exists there.

### Data and migration

**None.** `notifications` (`src/server/db/schema.ts:1722-1757`) already carries `type`, `scope`,
`entity_type`, `entity_id`, `action_url`, `response`, `responded_at`, `is_read` and `read_at`, with
CHECK constraints on the three enums, and `notification_preferences` already carries the event,
channel and enabled triple. No column, no index, no migration, nothing filed for foundations.

The absent rows on this row's evidence are not a schema gap: they are a caller gap, and `00-S2`
closes it.

### Server (repo, server function, Zod)

**Repository — `src/server/repos/notifications.ts`, read and not edited.** This stage's writes go
through functions that already exist there, and both are tenant-scoped in the only way this
repository allows:

- `setPreference(scope, { eventType, channel, isEnabled })` — writes `notification_preferences`
  through `createTenantRepository`, which stamps `organization_id` from the scope on insert and omits
  it from the caller's payload type, so a preference row for another workspace is not expressible.
- `respondToNotification(scope, notificationId, response)` (`:183-195`) — `requireUpdate` under
  `tenantFilter`, so an id belonging to another organization raises `NotFoundError` rather than
  updating a row. This is the unreached function the row names, and this stage is its first caller.
- Read side: `listNotifications`, `countUnread`, `listActionable` (`:114-127`) and `listPreferences`,
  all already built on `tenantFilter(scope, …)` with `organization_id` as the leading predicate and
  the leading column of every index on both tables.

No SQL is added anywhere. Nothing outside `src/server/repos` builds a query, and this stage adds no
new repository function — which is worth stating, because "the dominant gap is a missing write path,
not a missing screen" and here even the write path exists.

**Server functions.**

- `respondToNotificationFn` — `createServerFn({ method: 'POST' })` in
  `src/routes/_app/-server/overview.ts`, beside the three notification functions already there.
  Validator: `z.strictObject({ notificationId: z.string().trim().min(1).max(64), response: z.enum(NOTIFICATION_RESPONSES) })`
  with the `error` parameter for messages. It obtains the scope with `appScope()` and calls the
  repository; it returns the updated card so the row can re-render without a full invalidate.
- `loadNotifications` is widened to return the actionable subset alongside the page, from
  `listActionable`, so the inbox does not need a second round trip to know which rows are still
  waiting for an answer.
- `saveNotificationPreferences` — `createServerFn({ method: 'POST' })` in
  `src/routes/_app/-server/settings.ts`, beside the singular `saveNotificationPreference` that
  already exists at `:281-297`. Validator: an array of the same triple, `.min(1).max(64)`, so one
  group toggle is one round trip rather than six. The singular function stays; the plural one calls
  the same repository function per entry inside one handler.

**Authorisation is decided in the handler and the repository, never in the route.** A server function
is a public endpoint reachable without the screen that renders it, so every one of these obtains
`appScope()` first and passes only ids to a `tenantFilter`-backed call. A well-formed notification id
from the client is not an authorised one: `respondToNotification` resolves it under the scope and
raises `NotFoundError` when it belongs elsewhere, which is the behaviour the isolation case below
pins. The recipient is never taken from the body — `listPreferences` and the inbox read
`scope.ctx.userId`.

**Nothing slow runs inline.** No email is sent from these handlers; delivery is `00-S2`'s and it is
enqueued on `TASKS`.

### UI (route, components)

**Routes.** Two existing ones, both edited, neither added: `/settings/notifications` and
`/notifications`. **`pnpm generate-routes` is not run by this stage**, because no route file is
created.

**Components, reused not rebuilt.** `Switch`, `Card`, `Badge`, `Button`, `Alert`, `EmptyState`,
`Skeleton`, `Separator`, `SectionLabel`, `Table` and `Tooltip` from `src/components/ui`;
`SettingsSection` from `src/routes/_app/-ui/settings-nav.tsx`, imported not edited; `FilterBar`,
`Panel`, `RowsSkeleton` and `HeaderSkeleton` from `src/routes/_app/-ui/scaffold.tsx`, which the inbox
already uses and which this stage does not claim. No new product component is added; both screens
gain behaviour inside the files they already occupy.

**The matrix, grouped.** The nine events in `src/routes/_app/-lib/notifications.ts:165-209` are
ungrouped today and read as a wall. They gain four named groups — trips, money, lists and people —
each rendered as a `SectionLabel` header row with a group-level "turn this group off" control that
issues one bulk write. Each event keeps its one-line description, which already exists and is already
good. Every switch shows its own pending state on the switch rather than blocking the table, which is
what the screen already does at `notifications.tsx:54-69` and is kept.

**The inbox, answered in place.** A row whose `type` is `action` and whose `response` is null gains
an Accept and a Decline button in the row itself. Both record the answer through
`respondToNotificationFn`, which also marks the row read, and both roll back optimistically on
failure exactly as the preference toggles do. Two cases are distinguished, because pretending they
are the same is how a button lies:

- A workspace invitation carries an `action_url`. Accept follows it to
  `/accept-invitation/{invitationId}`, which is a complete, shipped screen, and records the answer on
  the way. Decline records `declined` inline and never navigates.
- A trip invitation records the answer inline and nothing else. Writing a `trip_members` row is
  `TRP-11`'s (`01-S6`, `01-trips-core.md`, wave 4) and this stage does not reach into it; until that
  lands, the answer is recorded and the row says which trip it was about.

**States, named rather than promised.**

- **Empty** — the inbox with nothing in it already renders an `EmptyState`; it is redrawn on
  `--color-surface-2` with the heading "Nothing needs you" and the body "New invitations, plan
  changes and money updates will appear here." The matrix's empty state is different in kind: a
  workspace where every switch is off gets an `Alert` `tone="info"` above the table reading "Every
  notification is switched off. You will still see changes when you open a trip.", because a screen
  full of off switches should say what that means.
- **Skeleton** — the inbox already has `RowsSkeleton`; the matrix gains a table-shaped skeleton at the
  final row height on `--color-surface-2`, replacing today's generic card so the columns do not jump
  when the loader resolves.
- **Error** — both screens keep their `errorComponent`. A failed toggle keeps today's rollback plus a
  toast; a failed answer does the same and re-enables both buttons, so a network drop never leaves a
  row that cannot be answered.

**Motion.** An answered row settles at 220ms on `--ease-out-quint`, opacity and transform only, into
its answered state rather than disappearing — a row that vanishes on click is a row the reader cannot
check they clicked correctly. `prefers-reduced-motion: reduce` collapses it to opacity.

**Tokens.** None missing. Unread counts and group counts are `tabular-nums`.

**Copy language: English, `en-GB`**, sentence case, as fixed in the area brief above.

**Where those strings are authored.** In `src/lib/i18n/messages/en/settings.ts` under the
`notification.*` prefix, and two kinds of key sit there. The screens' own copy is read with
`useTranslate()`. The `settings.notification.event.*` messages are read with `useStoredTranslate()`
(`src/lib/i18n/provider.tsx:95`), because they are what the `titleKey` and `bodyKey` columns
`00-S2` writes resolve to at render time — which is also why the event catalogue in
`src/routes/_app/-lib/notifications.ts` carries key names rather than labels.

### Quota

**No countable row, and one bound that is not a quota.** `notifications` and
`notification_preferences` are not sold by the metre: neither appears in `resolveLimits()`
(`src/server/billing/limits.ts`) or in `PLAN_QUOTAS` (`src/server/db/types.ts`), no metric is added,
no `assertQuota` call site is added, and nothing is added to
`src/server/billing/__tests__/limits.test.ts`.

Two bounds already exist and this stage stays inside them rather than adding a third: `notifyMany`
validates its recipient array at `.max(500)` (`src/server/repos/notifications.ts:139`), and `00-S2`
chunks its fan-out for the same reason. The preference bulk write is bounded at sixty-four entries by
its own validator, which is above the nine events times the channels offered and below anything that
could turn one click into a long transaction.

### Tenant isolation test

Appended to `src/server/repos/__tests__/tenant-isolation.test.ts` as one new `describe` block. The
file already carries generic `isolationCase` coverage for both tables (`:680`, `:683`) and one
foreign-id case for `markRead` (`:1083`); this block covers the two functions this stage is the first
caller of, which nothing covers today:

- Organization A, in A's scope, calls `respondToNotification` with B's notification id, for each of
  the accepted responses, and every call raises `NotFoundError`. B's row afterwards still has
  `response` null, `responded_at` null and `is_read` false — the answer is not merely refused, it
  leaves no trace.
- A, in A's scope, calls `setPreference` and the row it creates carries A's `organization_id`; B's
  preference for the same event and channel is unchanged, so two workspaces holding opposite
  preferences for one event do not collide.
- A, in A's scope, calls `listActionable` for a user id that belongs to B and receives an empty list
  rather than B's rows — the case that matters because a user id, unlike a row id, is a plausible
  thing for a caller to hold.
- A's `saveNotificationPreferences` bulk write containing one entry with a foreign event type is
  rejected at the boundary and writes **nothing**, so a partial application is not a reachable state.

Repository functions covered: `respondToNotification`, `setPreference`, `listActionable`.

### Verification

**How this is run.** `docs/plans/12-verification-protocol.md` owns the procedure. §4's relative-time
rules and §7.1's unpinned-instant precondition both land on this stage, because it is the first to
baseline `/notifications`; both are answered below rather than inherited silently.

**The command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**The Playwright run, written out in full.** There is no `test:e2e`, no `test:visual` and no
`playwright` script, and `docs/SPEC.md` §3 freezes `package.json` so none may be added:

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)   # --start only when the pool is empty
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/account-and-settings.visual.spec.ts -g '09-S7'
```

Both browser projects run: `chromium` at 1440x900 and `mobile-safari` on WebKit at 393x659. Those
are the gate's viewports and are separate from the evidence widths below — the gate proves nothing
changed, the frames prove the thing is good. `--project=setup` is re-run whenever a cached session
starts redirecting to `/login`; without `PLAYWRIGHT_BASE_URL` the config waits on port 3000 until the
global timeout. Baselines are recorded with `--update-snapshots` under the same `-g` filter;
`maxDiffPixelRatio` stays at `0.002` and `threshold` at `0.2` — neither is raised, per §5, and a
failing comparison is either the renderer's or the product's.

**Unit tests, by file and invariant.**

- `src/routes/_app/-lib/__tests__/notifications.test.ts` — every event belongs to exactly one group
  and every group has at least one event; the channel catalogue contains only channels with a
  transport, asserted against the list rather than against a comment, so re-adding an undeliverable
  column fails the suite; an absent preference row reads as enabled, which is the repository's rule
  and the screen's assumption at `notifications.tsx:46`; the group-level toggle produces one entry
  per event-and-channel pair in the group and no duplicates.
- The four isolation cases above, in the shared isolation file.

**Browser evidence.** Routes `/settings/notifications` and `/notifications`, both themes, at
**360px, 1280px and 2560px** — twelve resting frames. The 360px matrix is the one to look at hardest:
a table of switches is the classic squeezed desktop, and at that width it is a stacked list of events
each carrying its channel switches, not a horizontally scrolled grid. Declared non-resting states:

- `--state answering`, reached with `--click '[data-part="notification-accept"]'` against a
  `page.route()` that holds the response open, so the row's pending state is in the frame;
- `--state group-off`, reached with `--click '[data-part="notification-group-toggle"]'`, which
  photographs the bulk write's effect and its pending state;
- `--state list-error`, reached with a `page.route()` failure on the preference write, so the toast
  and the rolled-back switch are both visible.

Every selector is a `data-part` attribute this stage publishes, verified with
`page.locator(sel).count() === 1` against a running dev server before any frame is filed. Frames come
from `scripts/ultrabuild/capture.mjs` with `PT_SERVER_TODAY=2026-08-20` and `--auth`, under
`.claude/ultrabuild/shots/<slug>/round-<n>/09-S7/`.

**The spec file, and the clock string it has to hold still.** Appends a `test.describe` block named
for this stage. **`/notifications` prints a relative time** — `formatRelative` at
`src/routes/_app/notifications.tsx:24`, rendered at `:259-261` — and that is a shape
`RELATIVE_TIME_SITES` does not know: its three entries are the trip-card countdown, the dashboard
hero stat and the journey backlog reason. Left alone the string sits inside the comparison and the
frame fails on a morning nobody designed. §7.1 of `docs/plans/12-verification-protocol.md` is the
matching precondition — the instant behind it is one of the seed-time values `applySeed()` derives
from a single `new Date()`, which neither `x-pt-server-today` nor `FROZEN_NOW` reaches — and this
stage is the first in the repository to baseline that screen, so it inherits it.

**The shared table is not claimed, and the measurement says it does not have to be.** Three things,
read in `e2e/helpers/shoot.ts` rather than assumed:

- `shoot()` (`:2146-2165`) pins with `pinRelativeTime(page, route)` and masks with
  `maskFor(page, route)`, and **both** read the module-level `RELATIVE_TIME_SITES` constant
  (`:698`, `:714`). `relativeTimeRegion()` and `relativeTimeRegions()` are module-private, so a
  fourth site declared anywhere else cannot reach the mask. Masking this string would therefore
  require editing `e2e/helpers/shoot.ts` — which `01-S5` (`01-trips-core.md`) claims in this same
  wave, and `README.md` allows one claimant per wave. This stage yields, which is exactly what
  `docs/plans/12-verification-protocol.md` §4 instructs: the second stage to want a shared helper
  declares a module-local one instead.
- **Pinning does not need the shared table, and pinning is the half that matters.** The pin is a
  text rewrite any spec can perform; `e2e/helpers/account-and-settings.ts` exports the site
  descriptor for the notification timestamp and a `pinAccountRelativeTime(page)` that writes the
  fixed string over every match, called immediately **before** `shoot()` — the same ordering
  `shoot()` itself uses, and for the reason its own comment gives at `:2140-2145`: a text change can
  be a layout change, so it must land before the height that decides the viewport is measured.
- **The mask would add nothing geometric here, and the file says why.** The timestamp is a `<p>` —
  a block element filling its column, carrying `tabular-nums` — so its box never depended on the
  string. That is exactly the `journey` case recorded on `RELATIVE_TIME_SITES` at `:568-570`, whose
  baselines did not move when pinning was introduced, "which is the expected answer: its region is a
  block element, so its box never depended on the string in the first place". A pinned block-level
  string is a constant picture on every run and every calendar day, which is the whole property the
  mask exists to buy.

So the stage ships pinning without masking, states that as the cost of yielding the shared file, and
does not pretend the two are equivalent: a future stage that legitimately owns `e2e/helpers/shoot.ts`
may fold the fourth entry in, and nothing here has to change when it does, because the module-local
descriptor carries the same fields the shared ones do.

The spec calls `auditServerClock(page, <its own route table>)` once, and reads
`auditRelativeTime()`'s report rather than discarding it: a non-empty return means the exclusion
covered nothing that run, which is legitimate only when the pinned day sits past the rows carrying
the string, and the stage's evidence says which of the two it is.

**Console must be silent**, asserted through `watchConsole` on every test, with no addition to
`TOLERATED_CONSOLE_WARNINGS`.

**Layout shift after paint** is measured as `09-S1` describes, exercised by answering a row — the
most likely source of a shift on this screen, because the row changes height — with the assertion
`0` after the settle mark, gated on `supportedEntryTypes`.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test`
passes; the feature is verified in a real browser in light and dark, desktop and mobile; nothing is
left behind — no TODO, no placeholder copy, no `console.log`, no commented-out code; and no file
outside **Owned paths** is touched.

On top of those, the `docs/SPEC.md` §2 visual clauses, ticked per surface this stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each drawn
      on `--color-surface-2` rather than on the raw canvas.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Checked at 360px, 1280px and 2560px, and the small layout is designed rather than a squeezed
      desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

### Blockers

**Two, neither of which stops the stage, and both stated before it is scheduled.** A third —
contention with `01-S5` over `e2e/helpers/shoot.ts` — was resolved rather than carried, by measuring
that this stage needs pinning and not masking; the measurement and the yield are under
**Verification**.

**1 — Two of the four channels have no transport, and are excluded rather than deferred.** The schema
offers `in_app | email | push | webhook` (`src/server/db/schema.ts:244`). `00-S2` measured that
`push` and `webhook` have no provider and no binding, and writes the in-app row plus one structured
log line naming the channel it could not serve. The screen must not offer a switch that cannot take
effect — that is precisely the class of defect this plan exists to repair — so the matrix offers
**in-app and email**, and this stage **removes** the push column that
`src/routes/_app/-lib/notifications.ts:214-221` renders today and that has never delivered anything.

- **Push — disposition: defer**, with its preconditions named so it is schedulable rather than
  wished for: a subscription record and its columns (a foundations ask), signing keys held as
  secrets, and a service worker with a push handler. The third arrives with `09-S4`, but `11-S2`
  entry 4 measured that the service-worker toolbox cannot be imported from `src/`, so the handler is
  a hand-written worker and is blocked on that same measurement.
- **Webhook — disposition: drop** at our tier. A per-tenant outbound endpoint is a stored URL we
  fetch on a tenant's behalf, which is a request-forgery surface and an egress cost with no plan
  that sells it. Recorded here so a later reader does not read the enum and conclude it was
  forgotten.

Neither needs a package, so neither is an entry in `11-S2`'s register; both belong in
`11-boundaries-and-blockers.md` as channel decisions and are named here for whoever amends it.

**2 — A dependency on another plan's row, cited with its wave.** `00-S2` (`00-foundations.md`, wave 0) must have landed. Without it the inbox has no production rows and the matrix governs nothing, so
this stage cannot be scheduled before it — which is what the wave column already says and what this
entry makes explicit.

No package is installed and neither `package.json` nor `pnpm-lock.yaml` is edited. No binding is
added to `wrangler.jsonc`. No third-party service is involved.

---

## Stage 09-S8 — The settings shell, and the preferences it was missing

### Stage id

`09-S8` · Wave 3 · effort **L**. Wave 3 because the row depends on two others, and the last stage in
this plan.

### Reference rows

- `ACC-04` partial → **partial**, and the four behaviours that do not close here are named below
  with the target that will close each, except the temperature unit, which ADR 0038 closed as "no
  separate preference". This is the one row in this plan that does not reach **done**,
  and the justification is a rule this plan applies to itself.

Sourced from `wiki: Preferences` and `wiki: Appearance` for the behaviours: regional and display
choices that follow the reader across devices, a choice of colour scheme with a custom accent whose
contrast is checked in front of the reader, an interface density, a text size, and a choice of which
dashboard widgets to see.

**Agreement with the row.** It is right that the shell is good — `src/routes/_app/settings/route.tsx`
with `src/routes/_app/-ui/settings-nav.tsx` gives six sections each owning a loader — that
`settings/index.tsx` saves six regional overrides, and that `appearance.tsx` saves theme,
reduce-motion and map style. It is right about all nine missing items.

**The rule that decides what ships, and it is this plan's own.** Every other stage here exists to
remove an affordance that promises something and delivers nothing. A preference switch whose value
nothing reads is exactly that defect, wearing a different hat. So this stage ships a switch only
where a surface exists to obey it. The rest are disposed of one at a time, and each disposition names
either the stage that owns the obeying surface or, where there is none, the reason there is none:

| Behaviour          | Disposition       | Destination — the stage that owns the surface it must obey             |
| ------------------ | ----------------- | ---------------------------------------------------------------------- |
| Temperature unit   | closed            | `DOC-08` → `06-S7`: coupled to the distance unit, no switch — ADR 0038 |
| Route labels       | defer             | `MAP-09` → `02-S12`, `02-places-and-maps.md`, wave 6                   |
| Blur booking codes | defer             | `BKG-01` → `03-S6`, `03-reservations-and-transport.md`, wave 4         |
| Interface density  | drop at this tier | none, and the absence is the point — read the fourth bullet            |

**Every destination in that table was re-read in the sibling plan that owns it, because an earlier
revision of this table got three of the four wrong** — a row named for the wrong reference row, two
waves taken from `README.md`'s floor rather than from the owning stage, and one destination that is
not a stage at all. The corrected form of each, with the citation that decides it:

- **Temperature unit → closed, with no switch of its own.** This row used to defer the unit onto
  `06-S7`, a stage blocked on a weather provider. `docs/adr/0038-met-norway-and-nasa-power-for-weather.md`
  took the provider decision and `.ai/specs/2026-09-19-per-day-weather.md` owns the concept
  (`docs/SPEC.md` §8): readings are stored in metric and converted at render, using the reader's existing
  `distance_unit` (a user's choice over the workspace's), so `metric` shows °C and `imperial` shows °F.
  The answer is "no separate preference", not "later": no column is requested from the wave-0 schema stage
  and no control is added to `src/lib/display-preferences.ts` or to the settings screen, and the
  `src/lib/display-preferences.ts` this stage creates is unaffected.
- **Route labels → `02-S12`, wave 6, not wave 4.** The `### Stage id` under
  `## Stage 02-S12 — Transport drawn on the map, and only when it is asked for` reads
  ``02-S12` · Wave 6 · effort **L**.`, and that stage is the one that draws the endpoint pills and the
  flight label a label switch would govern. The wave 4 in the earlier revision came from a floor and
  not from the owning plan: `README.md:226` places `MAP-09` in wave 4 and `11-S3`'s table repeats it,
  while `02-places-and-maps.md` schedules the stage two waves later and argues the move in its own
  **Owned paths**. `README.md:190` reads that table as "_this stage may start once every wave above it
  is closed_" and `:178-180` calls its wave column mechanical — a floor rather than an assignment — so
  the owning stage's line wins. One consequence is named rather than assumed: `02-S12`'s **Owned paths**
  do **not** include `src/routes/_app/settings/appearance.tsx`, so shipping the switch means that
  stage claiming the file in wave 6 — which is free, because this plan's last claim on it is wave 3
  and `03-S6`'s is wave 4, and `check-plan-collisions.mjs` accordingly reports no same-wave contention
  on it. That claim is a change to a sibling plan and is reported as one, never written here. `02-S12`
  is not blocked: it draws great-circle arcs and defers road-following lines, so the routing decision
  in `11-S3` gates neither the overlay nor its labels.
- **Blur booking codes → `BKG-01` and `03-S6`, wave 4 — the sibling plan corrected this one and it is
  right on both counts.** The paragraph headed "Where the switch lives, and the disagreement with a
  sibling plan that decides it" in `03-reservations-and-transport.md` names the earlier revision of
  this very table, agrees with the rule that a switch ships in the stage that obeys it, and disagrees
  with the address: `BKG-01` is the row whose own name carries the masked confirmation code, `BKG-06`
  is a transports row that happens to share the field, and a wave-1 switch would have added a control
  to `appearance.tsx` in the wave **before** this stage rebuilds that screen's appearance section.
  `03-S6` states Wave 4 in its own `### Stage id`, already claims `appearance.tsx`,
  `src/routes/_app/-server/settings.ts` and `src/server/repos/settings.ts` in that wave, and files
  `user_settings.mask_confirmation_codes` in its own **Data and migration**. This plan accepts the correction whole: the address changes, the
  rule does not, and no column for it is requested from the wave-0 schema stage here.
- **Interface density → nowhere, so it is dropped at this tier rather than deferred.** Naming "a token
  stage in `00-foundations.md`, wave unscheduled" as a destination, as the earlier revision did, named
  a stage that does not exist — `00-foundations.md` defines exactly five stages, `00-S1` through
  `00-S5`, and none of them is a token stage. Measured twice more before dropping it:
  `grep -rn 'data-density' src/` returns nothing, and `grep -rlni 'density' docs/plans/` matches this
  file and no other, so no stage anywhere in the thirteen plans is waiting to obey such a switch. What
  density needs is not a stage but two amendments — a second spacing scale in `src/styles/tokens.css`
  beside the strict 4px grid at `:503-521`, and a `DESIGN.md` amendment permitting one — and both
  are argued in full under **UI**. It is recorded here as a display decision for whoever next amends
  `docs/plans/11-boundaries-and-blockers.md`, in the same shape `09-S7` uses for the push and webhook
  channels, and this stage ships no control, no column and no "coming soon".

The two deferrals are each a column plus a switch that arrives **with** its surface, in one stage,
so the switch and the thing it governs are always shipped together; density is a decision not to
ship either, and the temperature unit is a decision that no switch is needed. The five behaviours
that do ship here — 12/24-hour time, colour scheme, custom accent with a contrast badge, text scaling
and widget selection — all have a surface that obeys them on the day they land.

**The fourth disposition is this stage's own rule turned on this stage.** An earlier revision of this
plan shipped a density switch that wrote a `data-density` attribute onto the document element "that
the existing utility layer keys off". Measured: `grep -rn 'data-density' src/` returns nothing, so
there is no such layer, and this stage's **Owned paths** contain no stylesheet in which to write
one. That switch would have governed nothing — the precise defect the other seven stages in this
file exist to remove — so it is dropped rather than shipped, and what it would take to revive it is
filed below under **UI** instead of half-built here.

**The currency work this stage depends on and does not duplicate.** The regional section shows an
accounting-currency override, and it must not grow a second opinion about money.
`04-budget-and-currencies.md` owns all of it: `04-S1` (`MNY-07`, wave 1) owns the frozen-rate columns
and `src/server/repos/rates.ts`, `04-S5` (`MNY-06`, wave 2) owns re-basing a trip's accounting
currency as a re-basing rather than a relabel, and `04-S7` owns turning a rate provider on. This
stage writes **no** rate, performs **no** conversion, and re-bases **nothing**: it stores a preferred
currency code and displays it. Its picker reads `CURRENCY_OPTIONS` from `src/lib/money.ts`, which is
a curated list with a reason written above it at `:40-73` and which this stage does not edit; the
fuller ISO-4217 set arrives with `01-S8` (`TRP-02`, `01-trips-core.md`, wave 5) as
`src/lib/currency-list.ts`, and swapping the source is a one-line change in a later run that needs no
change to this screen's shape.

**The widget selection this stage depends on and does not duplicate.** `TRP-05` (`01-S5`,
`01-trips-core.md`, wave 2) owns the dashboard widgets and their per-user visibility over
`src/lib/local-preference.ts` (`01-S3`). This stage renders that same store as a settings surface and
mints no second one; if `01-S5` has not landed, the section is not shipped rather than shipped
against a store this stage invented.

Rows unblocked: **`BKG-01`** — the reservations panel and card — which is the one row in
`.claude/ultrabuild/recon/gap-rows.json` whose `dependsOn` names `ACC-04`. An earlier revision of this
stage claimed the row had no dependants; that was wrong, and one command settles it:
`node -e "const r=require('./.claude/ultrabuild/recon/gap-rows.json');console.log(r.filter(x=>(x.dependsOn||[]).includes('ACC-04')).map(x=>x.id))"`
prints `[ 'BKG-01' ]`.

The edge is scheduled rather than merely acknowledged, and the sibling plan records it in the same
direction: `03-reservations-and-transport.md:100` carries `BKG-01 → ACC-04` in its edge table, naming
the supplier as this plan's `09-S8` in wave 3 and noting that `03-S6` is wave 4. So the dependant
lands one wave after this stage and the two never run together. What `03-S6` takes from here is
concrete: the appearance screen's display section that this stage rebuilds, into which it adds one
`Switch`; and a `getEffectiveSettings` already widened by this stage's fields, so its own
`mask_confirmation_codes` arrives through that one resolution rather than a second one. The ordering
is `03-S6`'s own argument too, under the same paragraph heading, which is why the masking switch
moved to wave 4 instead
of shipping in wave 1 against a screen this stage had not yet rebuilt.

### Owned paths

- `src/routes/_app/settings/index.tsx` — edit. The regional section gains the time format.
- `src/routes/_app/settings/appearance.tsx` — edit. Colour scheme, accent, text scaling, widgets.
- `src/routes/_app/-ui/settings-nav.tsx` — edit. The shell work described under **UI**.
- `src/routes/_app/-server/settings.ts` — edit. The loaders and writers widen.
- `src/server/repos/settings.ts` — edit. `updateUserSettingsInput` widens; no new function.
- `src/lib/display-preferences.ts` — new. The contrast computation, the text-scale vocabulary, and
  the pure resolution each screen shares.
- `src/lib/__tests__/display-preferences.test.ts` — new.
- `src/lib/theme.ts` — edit. The pre-paint bootstrap applies accent and text scale alongside the
  theme it already applies.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. One new `describe` block.
- `src/lib/i18n/messages/en/settings.ts` — append. The `preferences.*` keys. Wave 3, so the file and
  the four wave-1 blocks are already there.
- `e2e/account-and-settings.visual.spec.ts` — append.
- `e2e/__screenshots__/account-and-settings.visual.spec.ts/` — append.

**Four files here are touched by more than one plan, in different waves, and each is named with its
sibling stage id as `check-plan-collisions.mjs` requires.**

- `src/routes/_app/-server/settings.ts` — `00-S3` wave 0 (`00-foundations.md`, which audits a
  workspace-defaults change), `02-S2` wave 1 (`02-places-and-maps.md`), `03-S6` wave 4
  (`03-reservations-and-transport.md`) and `09-S7` wave 2 of this plan. Five stages, five waves, no
  concurrency.
- `src/server/repos/settings.ts` — `02-S2` wave 1 and `03-S6` wave 4, both widening the same
  `updateUserSettingsInput` for their own preference. This stage is wave 3, between them, and adds
  fields rather than reshaping the input, so the three edits compose.
- `src/routes/_app/settings/appearance.tsx` — `02-S2` wave 1 (the map-style preference) and `03-S6`
  wave 4. This stage is wave 3 and adds sections to a screen `02-S2` has already extended.
- `src/routes/_app/-ui/settings-nav.tsx` — `10-S3` wave 4 (`10-administration.md`), which adds its
  own console section to the index, and `02-S10` wave 5 (`02-places-and-maps.md`). This stage is
  wave 3 and lands the responsive shell both will build on.

`src/routes/_app/settings/index.tsx` is also edited by `09-S3` in wave 1 — same plan, earlier wave,
so the two never run together, and the script does not list it as a cross-plan path.
`src/styles/tokens.css` is **not** claimed and no token is added; the density requirement that would
have needed one is filed under **UI** instead of written.

### Data and migration

**Two additive columns on `user_settings`, and they are a foundations requirement rather than this
stage's to write.** `src/server/db/schema.ts` is one of `README.md`'s six shared paths and no feature
stage may claim it, so the requirement is stated here and becomes a wave-0 foundations stage in
`00-foundations.md`:

| Column        | Type      | Null | Default | Constraint                                           |
| ------------- | --------- | ---- | ------- | ---------------------------------------------------- |
| `time_format` | `text`    | yes  | none    | `enumCheck` over `12h \| 24h`                        |
| `text_scale`  | `integer` | yes  | none    | `CHECK ("text_scale" IS NULL OR BETWEEN 90 AND 125)` |

Nullable with no default, deliberately, because that is how every existing override on this table
works: `locale`, `timezone`, `currency`, `week_starts_on`, `date_format`, `distance_unit` and
`map_style` are all nullable, and `getEffectiveSettings` resolves the user's value over the
workspace's. A default in the column would make "not chosen" indistinguishable from "chosen to be the
default" and would break that resolution.

Additive only, as `ARCHITECTURE.md` §9 requires: nothing is dropped, renamed or narrowed, and a
rollback keeps working because the previous Worker simply never selects the three new columns.
`accent_colour` already exists (`schema.ts:1841`) and needs no change. `pnpm db:generate` produces
the next numbered migration in the wave-0 series; it **backfills nothing**, because a null override
is already the correct value for every existing row.

No column is requested here for any of the four dispositions above — **including `density`**, which is
why the table has two rows and not three, and **including `mask_confirmation_codes`**, which `03-S6`
files in its own **Data and migration** for the wave-4 schema stage. Each deferred column arrives with
the stage that ships its switch, and the dropped one arrives never, so no column exists in the schema
for longer than it is unused and no reader of the schema is misled into thinking a preference is
stored that nothing reads.

### Server (repo, server function, Zod)

**Repository — `src/server/repos/settings.ts`, edited.** No new function; `updateUserSettingsInput`
(`:76`) widens by the two new fields plus `accent_colour`, each optional and nullable so that `null`
clears an override and `undefined` leaves it alone — the semantics `updateUserSettings` already has.
`getEffectiveSettings` (`:196`) gains the same fields in its resolution, user over workspace over a
written fallback, in the one place that resolution lives.

**`organization_id` scoping, stated rather than assumed.** `userSettingsRepository` is
`createTenantRepository(userSettings, 'user settings')` (`:46`), which stamps `organization_id` from
the scope on every insert and omits it from the caller's payload type, so a settings row for another
workspace is not expressible; every read is `tenantFilter(scope, …)` with `organization_id` leading,
and `user_settings_org_user_unq` makes the pair unique. No SQL is written outside this module.

**Server functions — `src/routes/_app/-server/settings.ts`, edited.** No new function is added;
four existing ones widen:

- `loadProfile` returns the two new effective values and the two new overrides beside the seven it
  already returns (`:118-135`).
- `saveRegionalSettings` (`:153`) takes `timeFormat` on the same `''`-clears-the-override convention
  its six siblings use.
- `loadAppearance` (`:194`) returns `textScale` and the resolved accent.
- `saveAppearance` (`:212`) takes `accentColour` and `textScale`.

**Zod v4 on every input.** `z.strictObject` for both writers; `z.enum(['12h', '24h'])` rather than a
free string; `z.number().int().min(90).max(125)`
for the scale, matching the CHECK constraint exactly so the boundary and the column agree; the accent
is a hex colour validated by an explicit regular expression rather than by a loose string, with the
`error` parameter carrying the message. Validation is shape, not permission.

**Authorisation.** Every one of the four obtains `appScope()` and writes through the tenant
repository, so the row written is always the caller's own within the caller's workspace. No user id
and no organization id is taken from the request body; `updateUserSettings` derives both from the
scope. A server function is a public endpoint reachable without the settings screen, which is why the
answer is here and not in a `beforeLoad`.

Nothing slow runs inline: these are single-row upserts.

### UI (route, components)

**Routes.** Two existing files, both edited, none added, so **`pnpm generate-routes` is not run by
this stage**.

**Components, reused not rebuilt.** `Card`, `Select`, `RadioGroup`, `Slider`, `Switch`, `Field`,
`Input`, `Badge`, `Alert`, `Button`, `Skeleton`, `Separator`, `SectionLabel`, `PillNav`, `Tooltip`
and `ScrollArea` from `src/components/ui`; `SettingsRow` and `SettingsSection` from
`src/routes/_app/-ui/settings-nav.tsx`, which this stage owns. No new product component: every
control is an existing primitive in an existing section.

**The shell work, which is the other half of the row's name.** `settings-nav.tsx` renders a vertical
index that the grid at `route.tsx:38` places in a `15.5rem` column above the `lg` breakpoint and
stacks below it. Stacked, six full-width cards push the section itself below the fold on a 360px
screen, which is a squeezed desktop by another name. Below `lg` the index becomes a horizontally
scrollable `PillNav` pinned under the page header — the segmented control on a tinted track that
`DESIGN.md` names as one of the product's signature patterns — with the active section's pill
scrolled into view on mount and the scroll container keyboard-scrollable. Above `lg` nothing changes.
The literal-union typing of each entry's `to` (`:26-40`) is preserved exactly; it is what makes the
index type-check against the generated route tree.

**Regional gains one control.** Time format, as a two-option `RadioGroup` with a live sample beside
it rendered by the product's own formatter, so the reader sees `17:30` or `5:30 pm` rather than a
label. The sample uses `src/lib/format.ts` and no second formatter is introduced.

**Appearance gains four controls, and says out loud why a fifth is missing.**

- **Colour scheme.** A row of accent presets drawn from the token set's own brand and accent ramps,
  plus a custom swatch. Each preset is a `radio` in a `RadioGroup` with an accessible name, not a
  bare `div` with a click handler.
- **Custom accent, with the contrast badge in front of the reader.** A colour input and a hex field
  that stay in sync, and a `Badge` computing the WCAG 2.2 contrast ratio of the chosen accent against
  `--color-accent-on` in **both** themes, showing the ratio to one decimal with `tabular-nums` and
  reading **AA**, **AAA** or **Fails AA**. A failing choice is not blocked — it is labelled, and the
  helper text says which theme fails and by how much. The computation is `contrastRatio()` in
  `src/lib/display-preferences.ts`, a pure function over sRGB relative luminance with published test
  vectors.
- **Density — not shipped by this stage, and the requirement is filed instead.** The measurement
  first: `grep -rn 'data-density' src/` returns nothing, so nothing in the product keys off such an
  attribute, and this stage owns no stylesheet in which to make one mean something. Nor is the gap
  one line of CSS. `src/styles/tokens.css:503-521` declares a **strict** 4px grid —
  `--space-N === N * 4px`, with the comment at `:503-504` recording that Tailwind's own step is
  aligned to it — so a compact density is either a second spacing scale in the token contract or a
  per-component override layer, and both are amendments to `DESIGN.md`'s grid rather than uses
  of it. `00-foundations.md:44-51` reserves `src/styles/tokens.css` to one token stage per wave and
  says exactly what a feature stage does when it needs one: state the requirement under its own
  heading and stop. So, stated: **a density scale wants (1) a `--density-*` step set in
  `src/styles/tokens.css`, declared in all three places `DESIGN.md` requires, and (2) a
  `DESIGN.md` amendment permitting a second scale beside the 4px grid; the switch, its
  `user_settings.density` column and its `data-density` attribute then ship in one later stage
  together with them.** Until that stage exists there is no density control on this screen — not a
  disabled one, not a "coming soon" one, and no column in the schema pretending otherwise.
- **Text scaling.** A `Slider` from 90% to 125% in five-point steps, applied as a `font-size`
  percentage on the document element. Because the whole type scale is expressed in `rem`, one
  property scales every screen, and because the step is bounded at 125% no layout is asked to survive
  a size nobody designed for. The slider's value is `tabular-nums` and announced through
  `aria-valuetext` as a percentage.
- **Widgets.** The dashboard widget list from `TRP-05`, each with a `Switch`, reading and writing
  `01-S3`'s `src/lib/local-preference.ts`, which this stage imports and does not edit.

**Applied before paint, not after.** `src/lib/theme.ts:30` already carries a bootstrap script that
reads the theme from `localStorage` and writes `data-theme` and `color-scheme` onto the document
element before React hydrates. Accent and text scale join it, from their own keys, mirrored by
the appearance screen on save exactly as the theme control already mirrors its own. Applying them
after hydration instead would produce a visible re-skin on every load, which is the layout shift the
definition of done forbids. The script keeps its `try/catch`, because private browsing can make
`localStorage` access itself throw.

**States, named rather than promised.**

- **Empty** — a reader who has overridden nothing. Each row shows the workspace default as its
  resolved value with a quiet "Workspace default" `Badge`, and the section header carries a
  "Reset all to workspace defaults" button that is `disabled` when there is nothing to reset. That
  is the empty state of a preference screen: not a blank panel, but a legible statement of where the
  value came from.
- **Skeleton** — both screens' `pendingComponent`s are redrawn to the new control heights on
  `--color-surface-2`, so nothing shifts when the loader resolves.
- **Error** — both keep their `errorComponent`. A failed save rolls the control back to its stored
  value, shows an inline `Alert` `tone="danger"` on `--color-surface-2` beside the control that
  failed rather than at the top of the page, and offers a retry.
- **Loading** — every control shows its own pending state on itself and stays interactive-disabled
  rather than the section being blocked, which is the pattern `settings/notifications.tsx` already
  uses.

**Motion.** The text-scale change is the only one that moves layout, and it is applied without a
transition on purpose: animating a reflow is the one thing `DESIGN.md`'s motion rules forbid
outright. The accent change cross-fades the preview swatch at 150ms on `--ease-out-quint`.
`prefers-reduced-motion: reduce` collapses it to none, and the reduce-motion switch already on this
screen keeps its meaning.

**Tokens.** None missing and none added; `src/styles/tokens.css` is not claimed. The accent override
sets the existing `--color-accent`, `--color-accent-hover` and `--color-accent-on` custom properties
on the document element at runtime, which is using the token contract rather than amending it.

**Copy language: English, `en-GB`**, sentence case, as fixed in the area brief above.

**Where those strings are authored.** In `src/lib/i18n/messages/en/settings.ts` under the
`preferences.*` prefix. The contrast badge's three verdicts and the "Workspace default" badge are
keys like any other; the ratio beside them and the time sample are formatter output, not copy, and
neither is a key.

### Quota

**No countable row.** `user_settings` is one row per user per workspace, created by
`ensureUserSettings` and thereafter updated in place, so no quantity grows with use. No metric is
added to `resolveLimits()` (`src/server/billing/limits.ts`) or to `PLAN_QUOTAS`
(`src/server/db/types.ts`), no `assertQuota` call site is added, and nothing is added to
`src/server/billing/__tests__/limits.test.ts`. The seat count already bounds the row count.

### Tenant isolation test

Appended to `src/server/repos/__tests__/tenant-isolation.test.ts` as one new `describe` block, over
`src/server/repos/settings.ts`:

- Organization A, in A's scope, calls `updateUserSettings` with the three new fields; B's
  `user_settings` row for the same user id is unchanged. The same person in two workspaces keeps two
  independent sets of preferences, which is the property `user_settings_org_user_unq` encodes and the
  one a shared-preference bug would silently break.
- A, in A's scope, calls `getUserSettings` for a user who exists only in B and receives the row it
  creates in A's scope, never B's.
- A, in A's scope, calls `getEffectiveSettings` and the workspace half of every resolved value comes
  from A's `organization_settings`, never B's, including the three new fields.
- A, in A's scope, calls `updateOrganizationSettings` and B's workspace defaults are unchanged
  afterwards.

Repository functions covered: `updateUserSettings`, `getUserSettings`, `getEffectiveSettings`,
`updateOrganizationSettings`.

### Verification

**How this is run.** `docs/plans/12-verification-protocol.md` owns the procedure. §5 is the clause to
read before touching a baseline here: text scaling moves type metrics across every screen, so a
re-record is a decision this stage argues in its diff, never a reflex.

**The command gate, in this order:** `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.

**The Playwright run, written out in full.** There is no `test:e2e`, no `test:visual` and no
`playwright` script, and `docs/SPEC.md` §3 freezes `package.json` so none may be added:

```sh
PORT=$(scripts/ultrabuild/resolve-port.sh)   # --start only when the pool is empty
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup
PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test \
  e2e/account-and-settings.visual.spec.ts -g '09-S8'
```

Both browser projects run: `chromium` at 1440x900 and `mobile-safari` on WebKit at 393x659. Those
are the gate's viewports and are separate from the evidence widths below — the gate proves nothing
changed, the frames prove the thing is good. `--project=setup` is re-run whenever a cached session
starts redirecting to `/login`; without `PLAYWRIGHT_BASE_URL` the config waits on port 3000 until the
global timeout. Baselines are recorded with `--update-snapshots` under the same `-g` filter;
`maxDiffPixelRatio` stays at `0.002` and `threshold` at `0.2` — neither is raised, per §5, and a
failing comparison is either the renderer's or the product's.

**Unit tests, by file and invariant.**

- `src/lib/__tests__/display-preferences.test.ts` — `contrastRatio()` reproduces the published values
  for black on white (21:1) and for two mid-tone pairs to one decimal; the AA and AAA thresholds are
  applied at 4.5 and 7 for normal text; a malformed hex is rejected rather than silently treated as
  black; the text-scale vocabulary round-trips through its storage form; a scale outside 90–125 is
  refused at the same boundary the CHECK constraint uses.
- The four isolation cases above, in the shared isolation file.
- The existing `src/server/repos/__tests__` suite for settings is extended rather than replaced where
  `updateUserSettingsInput` widens, so a field added without a test fails review rather than passing
  quietly.

**Browser evidence.** Routes `/settings` and `/settings/appearance`, both themes, at **360px, 1280px
and 2560px** — twelve resting frames. The 360px pair carries the shell work and is the reason this
stage exists as much as the preferences are. Declared non-resting states:

- `--state nav-mobile` at 360px, both themes, which is the collapsed section index and is a different
  component from the desktop one rather than the same one narrowed;
- `--state accent-custom`, reached with `--click '[data-part="appearance-accent-custom"]'`, which
  photographs the contrast badge — the point of the control and invisible at rest;
- `--state accent-fails`, the same surface with a deliberately low-contrast value entered before the
  shutter, so the failing badge is evidence rather than an assertion in this document;
- `--state scale-max`, with the text-scale slider at 125% at 360px, which is where a scaled layout
  breaks if it is going to.

One further check belongs to the deferral rather than to a frame: with the stage's own branch
checked out, `grep -rn 'data-density\|density' src/routes/_app/settings/ src/lib/display-preferences.ts`
must return nothing. A density control that survives review is a switch that governs nothing, and
this is the cheapest way to prove it did not.

Every selector is a `data-part` attribute this stage publishes, verified with
`page.locator(sel).count() === 1` against a running dev server before any frame is filed. Frames come
from `scripts/ultrabuild/capture.mjs` with `PT_SERVER_TODAY=2026-08-20` and `--auth`, under
`.claude/ultrabuild/shots/<slug>/round-<n>/09-S8/`.

**The spec file.** Appends a `test.describe` block named for this stage. Both routes are clock-free
and declare `relativeTime: false`, and are covered by the spec's single `auditServerClock` call over
its own route table. One non-frame test earns its place: set the accent, reload, and assert the
computed value of `--color-accent` on the document element **before** hydration completes, which is
the runnable form of "applied before paint". `e2e/helpers/shoot.ts` is not claimed by this stage.

**Console must be silent**, asserted through `watchConsole` on every test, with no addition to
`TOLERATED_CONSOLE_WARNINGS`.

**Layout shift after paint.** This is the stage where the clause has teeth, because text scale
changes layout by design. The measurement distinguishes the two cases: shift caused by the reader
moving the slider carries `hadRecentInput` and is excluded by the protocol; shift on **load**, after
the settle mark, with a non-default scale already stored, must be `0` — which is what the pre-paint
bootstrap is for and what would fail if it were applied after hydration instead.
Gated on `supportedEntryTypes`, with the WebKit skip reported as a skip.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test`
passes; the feature is verified in a real browser in light and dark, desktop and mobile; nothing is
left behind — no TODO, no placeholder copy, no `console.log`, no commented-out code; and no file
outside **Owned paths** is touched.

On top of those, the `docs/SPEC.md` §2 visual clauses, ticked per surface this stage ships:

- [ ] Spacing is on the 4px grid, from `--space-*`. No eyeballed one-off margins.
- [ ] Every interactive element has hover, focus-visible, active, disabled and loading states.
- [ ] Every list has a designed empty state, a skeleton loading state and an error state, each drawn
      on `--color-surface-2` rather than on the raw canvas.
- [ ] Motion is 150–260ms on `--ease-out-quint` or a sibling token, transform and opacity only, and
      `prefers-reduced-motion: reduce` is honoured.
- [ ] Full parity in light **and** dark theme, with dark shadows re-declared rather than reused.
- [ ] Checked at 360px, 1280px and 2560px, and the small layout is designed rather than a squeezed
      desktop.
- [ ] Keyboard navigable end to end, sensible focus order, accessible names, WCAG 2.2 AA contrast in
      both themes.
- [ ] Zero console errors or warnings, and zero layout shift after paint.

The contrast clause is doubled here: the stage both **obeys** AA and **ships a control that can
produce a failing accent**. Both are true and neither excuses the other — the product's own surfaces
stay AA in both themes with every preset, and a reader who types a failing custom value is told so in
the same breath.

### Blockers

**Three, all stated before the stage is scheduled, none of them a stop.**

**1 — A schema change this stage may not write.** The three `user_settings` columns above are a
`00-foundations.md` wave-0 requirement, because `src/server/db/schema.ts` is a shared path. The stage
cannot begin until they exist. This is a dependency on another plan and is cited as one.

**2 — Two rows in other plans that must have landed.** `MNY-07` (`04-S1`,
`04-budget-and-currencies.md`, wave 1) for the money vocabulary this screen displays without
duplicating, and `TRP-05` (`01-S5`, `01-trips-core.md`, wave 2) for the widget store this screen
surfaces. Both are earlier waves, which is why this stage is wave 3. If `01-S5` slips, the widget
section is not shipped and the row's deferral table gains a fourth line rather than the stage
inventing a second store.

**3 — Four behaviours, dispositioned rather than dropped.** Temperature unit, route labels,
booking-code blurring and interface density are listed with their dispositions and, where there is one,
their owning targets and waves under **Reference rows**. The temperature unit is closed: it follows the
distance unit and has no switch (ADR 0038). Route labels and booking-code blurring are **deferred**, and
the deferral has a shape rather than a hope: each is one nullable column and one control, shipped by the
stage that owns the surface obeying it, so the switch and its effect are never separated by a wave.

Density is the one of the four whose owning stage does **not** yet exist, so it is the one to watch.
Its requirement — a `--density-*` step set in `src/styles/tokens.css` and the `DESIGN.md`
amendment that permits a second scale beside the strict 4px grid — is written out under **UI** in the
form `00-foundations.md:44-51` prescribes, and it is a genuine blocker on the behaviour rather than
on this stage: `ACC-04` therefore closes at `partial`, which is what the row ledger in the area brief
records.

No package is installed and neither `package.json` nor `pnpm-lock.yaml` is edited by this stage or by
any other in this file. No binding is added to `wrangler.jsonc`. No third-party service is involved.

---

## Cross-plan collisions

Run against the whole plan set, filtered to the rows that involve plan 09. The two header lines are a
snapshot: sibling plans are revised in the same round, so `stages`, `owned paths` and the wave-less
list all move without anything in this file changing. **The two things this paste asserts, and the
two an auditor should re-run, are the verdict — no same-wave exclusive collision involving plan 09 —
and the path table under it.**

```
$ node scripts/ultrabuild/check-plan-collisions.mjs 09
plans 13 · stages 91 · owned paths 543

4 stage(s) state no parseable wave and cannot be checked: 11-S1 11-S2 11-S3 04-S2

no same-wave exclusive collisions

touched by more than one plan in different waves (8) — legal; each plan must name the other:
  src/routes/_app/-server/settings.ts
      00-foundations.md  00-S3  wave 0  (edit)
      02-places-and-maps.md  02-S2  wave 1  (edit)
      03-reservations-and-transport.md  03-S6  wave 4  (edit)
      09-account-and-settings.md  09-S7  wave 2  (edit)
      09-account-and-settings.md  09-S8  wave 3  (edit)
  src/routes/_app/-server/overview.ts
      00-foundations.md  00-S5  wave 0  (edit)
      01-trips-core.md  01-S1  wave 1  (edit)
      01-trips-core.md  01-S7  wave 5  (edit)
      09-account-and-settings.md  09-S7  wave 2  (edit)
      10-administration.md  10-S3  wave 4  (edit)
  src/server/repos/settings.ts
      02-places-and-maps.md  02-S2  wave 1  (edit)
      03-reservations-and-transport.md  03-S6  wave 4  (edit)
      09-account-and-settings.md  09-S8  wave 3  (edit)
  src/routes/_app/settings/appearance.tsx
      02-places-and-maps.md  02-S2  wave 1  (edit)
      03-reservations-and-transport.md  03-S6  wave 4  (edit)
      09-account-and-settings.md  09-S8  wave 3  (edit)
  src/routes/_app/-ui/settings-nav.tsx
      02-places-and-maps.md  02-S10  wave 5  (edit)
      09-account-and-settings.md  09-S8  wave 3  (edit)
      10-administration.md  10-S3  wave 4  (edit)
  src/routes/_app/-lib/notifications.ts
      05-packing-and-todos.md  05-S1  wave 3  (edit)
      09-account-and-settings.md  09-S7  wave 2  (edit)
  src/server/auth/index.ts
      09-account-and-settings.md  09-S3  wave 1  (edit)
      10-administration.md  10-S1  wave 3  (edit)
  src/server/repos/members.ts
      09-account-and-settings.md  09-S3  wave 1  (edit)
      10-administration.md  10-S1  wave 3  (edit)
      10-administration.md  10-S4  wave 5  (edit)
```

And the reference check, re-run in the same revision, because a plan that cites a sibling stage id
which no `## Stage` heading defines sends whoever builds it to a file that does not exist:

```
$ node scripts/ultrabuild/check-plan-refs.mjs 09

plan 09: 0 dangling stage reference(s), 0 plan(s) missing a Playwright invocation
```

**Zero dangling references, and no missing Playwright invocation.** Every `NN-Sn` token this file
cites — `00-S1`, `00-S2`, `00-S3`, `00-S5`, `01-S1`, `01-S2`, `01-S3`, `01-S5`, `01-S6`, `01-S7`,
`01-S8`, `02-S2`, `02-S10`, `02-S12`, `03-S6`, `04-S1`, `04-S2`, `04-S5`, `04-S7`, `05-S1`, `06-S7`,
`10-S1`, `10-S3`, `10-S4`, `11-S1`, `11-S2`, `11-S3` and this plan's own eight — is defined by a
`## Stage` heading in the plan whose prefix it carries. Three of those tokens are new in this
revision: `02-S12` and `06-S7` are the corrected destinations in `09-S8`'s disposition table, and
`00-S1` was cited all along and simply missing from this list. The second
count is the one that matters for an area plan: each of the eight stages writes its
`pnpm exec playwright test` line out in full under **Verification**, because `docs/SPEC.md` §3 freezes
`package.json` and there is no `test:e2e` script to hide behind.

**No same-wave exclusive collision involves this plan.** That is the result the plan is written to
produce rather than one it discovered: `security.tsx` was the file three wave-1 rows all wanted, and
the repair-at-the-destination convention in the area brief is what took it down to one claimant.

**Each of the eight cross-wave paths is named in its owning stage, with the sibling stage id**, as
the script's own instruction requires:

| Path                                      | Named in         | Siblings named there                                  |
| ----------------------------------------- | ---------------- | ----------------------------------------------------- |
| `src/routes/_app/-server/settings.ts`     | `09-S7`, `09-S8` | `00-S3` (0), `02-S2` (1), `03-S6` (4); and each other |
| `src/routes/_app/-server/overview.ts`     | `09-S7`          | `00-S5` (0), `01-S1` (1), `01-S7` (5), `10-S3` (4)    |
| `src/routes/_app/-lib/notifications.ts`   | `09-S7`          | `05-S1` (3)                                           |
| `src/server/repos/settings.ts`            | `09-S8`          | `02-S2` (1), `03-S6` (4)                              |
| `src/routes/_app/settings/appearance.tsx` | `09-S8`          | `02-S2` (1), `03-S6` (4)                              |
| `src/routes/_app/-ui/settings-nav.tsx`    | `09-S8`          | `02-S10` (5), `10-S3` (4)                             |
| `src/server/auth/index.ts`                | `09-S3`          | `10-S1` (3)                                           |
| `src/server/repos/members.ts`             | `09-S3`          | `10-S1` (3), `10-S4` (5)                              |

The list grew from five paths to eight between rounds, and not one of the three new rows is a
collision this plan created: `02-places-and-maps.md`, `03-reservations-and-transport.md` and
`05-packing-and-todos.md` were written after the first paste and each claimed a settings file this
plan already claimed in a different wave. That is the arrangement the script calls legal, and the
only obligation it creates is the naming above — which is why the paste is re-run and re-read on
every revision rather than trusted from the round it was first taken in.

`src/server/repos/__tests__/tenant-isolation.test.ts` is claimed by three stages here and by fifteen
across the other plans, always as `append`. That is the documented cooperative pattern and the script
does not count it, correctly: each stage adds its own `describe` block and none rewrites another's.
The same is true of `e2e/account-and-settings.visual.spec.ts`, which `09-S1` mints and every later
stage in this plan appends to — `playwright.config.ts`'s `snapshotPathTemplate` keys every baseline
by test name, so two stages sharing one spec file cannot overwrite each other's pixels.

`src/lib/i18n/messages/en/settings.ts` is the third path of that shape and the newest, so it is worth
reading against the script's output rather than assuming: it is claimed six times in this plan — once
as `new` by `09-S1` and five times as `append` — and by **no sibling plan**, which is why it appears
neither in the collision list nor in the cross-wave table above. The second half of that claim is a
measurement, not an expectation: `grep -rln 'messages/en/' docs/plans` matches exactly two files —
this one and `OPEN-FINDINGS.md`, the register that recorded the omission this section closes. Three
of the five appends are in wave 1 beside the stage that mints the file, and the area brief's
**Where this plan's English copy lives** is what makes that safe — disjoint key prefixes, a file shape
fixed by `docs/SPEC.md` §8 and by `src/lib/i18n/messages/en/ui.ts`, and an explicit rule for the stage
that arrives first. The other nine namespace files are named by no stage here, so nothing this plan
does can stand in the way of the item that owns `messages/en/shell.ts`.

**The script's fourth line — "4 stage(s) state no parseable wave and cannot be checked: 11-S1 11-S2
11-S3 04-S2" — reads as an open risk and is not one.** An earlier revision of this section filed it
as a finding this plan could not fix, and named `04-budget-and-currencies.md` as the source of the
wave-less `04-S2`. That attribution was wrong. Each of the four was traced to the file the parser
actually read it from:

| Stage reported | Read from                                  | What it is                                                                                                                                                                     |
| -------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `04-S2`        | `docs/plans/12-verification-protocol.md`   | Not a stage. A fenced `md` example at `:25-27` illustrating the container rule, whose sample heading is `## Stage 04-S2 — Freeze the rate a converted amount was computed at`. |
| `11-S1`        | `docs/plans/11-boundaries-and-blockers.md` | A real stage whose `### Stage id` line reads ``11-S1` — The ten hosted-model exclusions. Wave 1.` (`:56`).                                                                     |
| `11-S2`        | `docs/plans/11-boundaries-and-blockers.md` | The same shape at `:321`.                                                                                                                                                      |
| `11-S3`        | `docs/plans/11-boundaries-and-blockers.md` | The same shape at `:596`.                                                                                                                                                      |

**The real `04-S2` states its wave correctly.** `04-budget-and-currencies.md:584` opens
`## Stage 04-S2 — Let a trip name its own cost categories` and `:588` reads
``04-S2` · Wave 1 · effort **L**.` — the required form exactly, and
`check-plan-collisions.mjs:90` filters it out of the report for that reason. The `04-S2` that survives
that filter is the fenced one, and the line prints ids without the file each came from (`:93`), which
is what made the wrong attribution easy: `check-plan-collisions.mjs:39` globs `/^\d\d-.*\.md$/`, so
`12-verification-protocol.md` is in the plan set, and `:44` splits on `/^## (?=Stage )/m` without
stripping fenced blocks, so a code sample that shows the container rule is indexed as a stage that
obeys it.

**None of the four can be in a collision, for a reason stronger than the wave.** A stage collides
only through its **Owned paths**, and all four own nothing: `11-S1`, `11-S2` and `11-S3` each write
"None. This stage creates and edits no repository file" under that heading
(`11-boundaries-and-blockers.md:229`, `:532`, `:627`), and the fenced `04-S2` has no owned-paths list
because it is three lines of illustration. So the script's fourth line is an artefact of the parse
plus a formatting difference in one register plan, not an unchecked corner of the wave graph, and
this plan files nothing against it. Fixing the parse would mean editing
`scripts/ultrabuild/check-plan-collisions.mjs`, and re-stating three `### Stage id` lines would mean
editing `11-boundaries-and-blockers.md`; neither is this plan's file, so both are reported and
neither is touched.

All eight stages in this file state their wave in the required
``<id>` · Wave <n> · effort **S|M|L**.` form, which is what makes the "no same-wave exclusive
collisions" line above a result rather than an absence of evidence.

**The one shared path this plan deliberately does not claim** is `e2e/helpers/shoot.ts`. `09-S7`
wanted a fourth `RELATIVE_TIME_SITES` entry in it and `01-S5` claims the same file in the same wave;
rather than contend, `09-S7` measured that it needs pinning and not masking and declared
`e2e/helpers/account-and-settings.ts` instead. The measurement is under that stage's **Verification**
and it is why this file appears in no row above.
