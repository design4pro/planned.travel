# Choose a language before you sign in

| Field              | Value                                         |
| ------------------ | --------------------------------------------- |
| **Status**         | ready                                         |
| **Issue**          | none                                          |
| **Spec PR**        | #1159                                         |
| **Implementation** | none                                          |
| **Plan**           | 09-S5 (docs/plans/09-account-and-settings.md) |

## 📝 TLDR

Plan stage `09-S5` (`docs/plans/09-account-and-settings.md`, reference row `ACC-06`, "Speaking more than one language") was
written as **BLOCKED**: no message runtime, and the work owned by another plan. Both blockers are gone. The runtime, the
twenty-three catalogues, server-side negotiation, the right-to-left layout and the signed-in language picker all exist, and the
plan itself says its re-planned stage "must not re-specify what is already there". Checked against the repository, **one**
behaviour of the row is missing: **choosing a language before signing in.** At specification time, a visitor on a sign-in, registration or marketing page
could only read the language their browser's `Accept-Language` header named, or English, and had no control to change it; and the
account they then created opened in English whatever they were reading. This spec closes exactly that, in three tickets, built in
this order:

1. **09-S5a - the visitor's language, remembered and read before first paint.** A first-party cookie `planned.locale`, one server
   function that sets it, one new step in the negotiation chain (after the stored settings, before `Accept-Language`), a
   `signedIn` flag the root loader now carries, and the signed-in picker's save rewriting the cookie so signing out does not flip
   the language back. Amends `docs/SPEC.md` §9 rules 3 and 7, adds a glossary entry and a factual line to the privacy page.
2. **09-S5b - the switcher.** A compact language control in the marketing header and in the auth shell's header, shown to signed-out
   visitors only, opening the **existing** `LanguagePicker` in a popover, committing through the **existing** commit helper (lifted,
   not copied), and re-rendering the page in the new language without a reload.
3. **09-S5c - carry the language into the account, and close the stage.** At sign-up, the language the visitor was reading (their
   choice, else what their browser asked for) becomes their own setting on the new **personal** workspace, written through the settings
   repository (a workspace they are later invited into starts from that workspace's default, see Edge Cases). The ticket also adds the plan's `Delivered:` line for `09-S5`.

Nothing else on the row is specified here, because nothing else is missing (see the evidence table).

## 📝 Visual change expected

| Route / state                                                                                                                                          | Change                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`, `/pricing` (marketing header), signed out                                                                                                         | A language control between the theme toggle and the sign-in link. Closed, open (popover with 23 languages), pending (spinner on the chip being written) |
| `/login`, `/register`, `/forgot-password`, `/reset-password`, `/two-factor`, `/verify-email`, `/accept-invitation/$id` (auth shell header), signed out | The same control beside the theme toggle; below `lg` it sits in the row that carries the wordmark                                                       |
| The same screens, signed in (`/accept-invitation/$id`, `/verify-email` have signed-in states)                                                          | No control                                                                                                                                              |
| Any of the above in `ar`                                                                                                                               | The control and its popover mirror; the popover opens toward the start edge; the chip grid reads right-to-left                                          |
| `/settings/language`                                                                                                                                   | No visual change                                                                                                                                        |

Light and dark, 360px, 1280px and 2560px, per ADR 0016 (the blind A/B pair from `scripts/visual/capture.mjs`, no baselines). The
control has a declared non-resting state (open) and a pending state; the plan's frame set for this row is owed once, in 09-S5b,
including the marketing header at 360px in `fr`, `de` and `uk`.

## 📝 Problem Statement

### What a person met at specification time

A traveller whose browser says English opens a link a Polish colleague sent, lands on `/register`, and reads English with no way
to change it. A traveller whose browser says Polish sees Polish on the same page, registers, and is then shown **English**
everywhere inside the product, because the personal workspace is created with `organization_settings.locale = 'en'` and no personal
override (`ensureOrganizationSettings`, `src/server/repos/settings.ts:199`; `provisionPersonalOrganization` writes no settings row). The only language control in the product is
`/settings/language`, behind the sign-in the visitor has not passed.

### The plan's claims, checked against the repository

The reference row asks for a runtime and four behaviours. Everything but one is done; the one that is not is the last row.

| ACC-06 behaviour                                               | State       | Evidence                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime, twenty-three languages, parity                        | done        | `src/lib/i18n/` (catalogue, negotiate, plural, interpolate, provider), `src/lib/i18n/messages/<tag>/<namespace>.ts`, `src/lib/i18n/__tests__/parity.test.ts`, `e2e/i18n-runtime-parity.spec.ts`                                                           |
| Resolve the language through a chain, server-side              | done        | `src/server/fns/locale.ts` (`negotiateLocaleFrom`: stored user, else workspace, else visitor cookie (09-S5a), else `Accept-Language`, else `en`), called from the root `loader` in `src/routes/__root.tsx`; `<html lang dir>` server-rendered                                           |
| Right-to-left layout                                           | done        | `ar` has `dir: 'rtl'` in `src/lib/i18n/locales.ts`; `__root.tsx` wraps the tree in a direction provider; logical properties and `rtl:` mirrors in `auth-shell.tsx`                                                                                        |
| Choose a language **after** signing in, apply without a reload | done        | `src/routes/_app/settings/language.tsx`, `src/components/settings/language-picker.tsx`, `saveLanguagePreference` in `src/routes/_app/-server/settings.ts`, `commitLanguage` in `src/lib/i18n/commit-language.ts` (`router.invalidate()`) |
| Choose a language **before** signing in                        | **missing** | No control in `src/routes/(auth)/**`, `src/routes/index.tsx`, `src/routes/pricing.tsx`, `src/components/marketing/**` or `src/components/layout/**`. `src/lib/i18n/negotiate.ts` is pure and reads no cookie                                              |

One fact decides the cookie's place in the chain. `organization_settings.locale` is `NOT NULL DEFAULT 'en'`
(`src/server/db/schema.ts:2680`), and `getEffectiveSettings` (`src/server/repos/settings.ts:334`) therefore always answers for a
signed-in caller. The `Accept-Language` step is reached **only by anonymous requests**. A new step placed after the stored
settings can therefore never override a successfully read saved language, and never needs to be told apart from one. (The one
exception is a stored read that fails: `storedLocaleForCaller` swallows the error and falls through, so the cookie, not
`Accept-Language`, then decides for that request. Benign, and the same fall-through as today.)

Another: `user_settings` is unique on `(organization_id, user_id)` (`schema.ts:2755`). A person's "own language" is a row per
workspace they belong to, not one row per person. This spec does not change that (see Out of scope).

## 📝 Proposed Solution

### What the stage owns and what it does not

Owned (the paths each ticket may touch are in the Implementation Plan): the visitor cookie and its negotiation step, the `signedIn`
flag on the root loader's data, the switcher, the lifted commit helper, the sign-up seeding. **Not** owned, and not touched: the
runtime and catalogues (done), the settings shell (09-S8 owns the settings route tree; `/settings/language` is not edited, except
for an import path and that its save also rewrites the cookie), the workspace default language on `/settings/organization`, and
`src/routes/legal/**` (SPEC §9 rule 8 keeps long-form legal prose in English; the switcher appears wherever `MarketingHeader` does,
and the legal pages' existing English-only notice is unchanged).

### The chain (09-S5a)

`docs/SPEC.md` §9 rule 3 becomes: **user setting → workspace setting → visitor cookie → `Accept-Language` → `en`.**

- `negotiate()` in `src/lib/i18n/negotiate.ts` gains one optional input, `visitor`, between `workspace` and `acceptLanguage`. It
  stays pure: the caller passes the cookie's value in. The value is passed through the same `resolveLocaleTag` canonicalisation as a
  stored tag and is never trusted as-is; an unresolvable value is treated as absent, exactly as a bad `Accept-Language` is.
- `LocaleRequestSource` in `src/server/fns/locale.ts` gains a fourth injected member, `visitorLocale: () => string | null`, reading
  the cookie from the request headers. It is header-only, so the guarantee that an anonymous request never touches D1 (`locale.ts`
  header comment, SPEC §5) holds, and a test can prove the stored read was not called. The existing test fixtures that build a
  `LocaleRequestSource` gain the member, and the stubbed `negotiated` literals in `src/server/fns/__tests__/locale.test.ts` gain `signedIn`.
- `NegotiatedLocale` gains `signedIn: boolean`, taken from the `source.session()` call the function already makes. The root
  loader (`src/routes/__root.tsx`) puts it into `ShellData` (`false` in `SOURCE_LANGUAGE` and in the loader's catch path, the same
  safe fallback as the language). `__root.tsx` is therefore **owned by 09-S5a for this one field**; nothing else in it changes, and
  the `vary: 'accept-language, cookie'` header it already sends stays and is pinned by a test.
- Because a signed-in caller always resolves at step one or two, the cookie matters to anonymous requests only. It is consulted for
  everyone because the function is one chain, not two.
- The stale `§8.x` references in the files 09-S5a, 09-S5b and 09-S5c already open (`locale.ts`, `negotiate.ts`, `__root.tsx`'s
  loader comment, `language.tsx`, `language-picker.tsx`, `auth-shell.tsx`, the `locale.test.ts` header) are corrected to §9 rule 3
  or 7 while those files are open; `__root.tsx` otherwise changes by the one field only.

### The cookie

| Attribute | Value                                                                                                            |
| --------- | ---------------------------------------------------------------------------------------------------------------- |
| Name      | `planned.locale` (the product's cookie prefix is `planned`, `src/server/auth/index.ts` `advanced.cookiePrefix`)  |
| Value     | one of the twenty-three tags, nothing else                                                                       |
| Flags     | `HttpOnly`, `Secure` when the request is HTTPS (the writer reads the request protocol), `SameSite=Lax`, `Path=/` |
| Lifetime  | 365 days, rewritten on every explicit choice                                                                     |

It is `HttpOnly` because nothing in the browser needs to read it: the page learns the language from the root loader, which is what
the switcher re-runs. No script, no `localStorage` copy. It holds a language tag and identifies nobody.

**Unlike the theme preference** (kept in the browser, "never leaves your device", `src/routes/legal/privacy.tsx`), this cookie is
**sent to our servers with every request**, for a year. The privacy page's cookie list gets a sentence that says exactly that, in
plain English: what it is for, that it holds only a language code, that it identifies nobody, that it is sent with each request, and
how long it lasts. The list's intro ("small and necessary") is reworded so it does not call a preference cookie necessary: it says the cookies are small and are used only to make the product work as the person has set it up. Whether a 365-day functional preference cookie needs no consent banner is a legal classification; the 09-S5a PR
body states the page's existing position (no advertising or analytics cookies, so no banner) and flags the classification for a
person to confirm. It does not block the build.

The constant, the parser (`parseVisitorLocaleCookie(header: string | null): string | null`) and the attribute set live in one
module, `src/lib/i18n/visitor-locale.ts`, so the writer, the reader and the sign-up seeding cannot disagree about the name. It is
pure and imports nothing server-only. The parser is written for hostile input: the extracted value is capped at 16 characters
before anything else is done with it; the value is looked up in a `Map` of the shipped tags (never `in`, never an object index, so
`constructor` and `__proto__` are plain misses); and **more than one `planned.locale` pair in the header means absent** (one
deterministic rule, no "first wins" ambiguity).

### Setting it (09-S5a)

One server function in `src/server/fns/locale.ts`, beside `negotiateRequestLocale` (that file is the single owner of "which language
this request speaks"):

```ts
export const saveVisitorLanguage = createServerFn({ method: 'POST' })
  .validator(z.object({ locale: localeSchema })) // the 23-tag z.enum; no '' here, there is nothing to clear
  .handler(async ({ data }) => {
    writeVisitorLocaleCookie(data.locale)
    return { locale: data.locale }
  })
```

- It needs no session and writes no row. It is a POST, so the CSRF middleware in `src/start.ts` applies unchanged (it covers every
  server function, signed in or not, so another site cannot set the cookie). The `z.enum` rules out response splitting. With no
  database call it needs no rate limit.
- `saveLanguagePreference` (`src/routes/_app/-server/settings.ts`) additionally sets the same cookie to the language now **in
  force** after its write (the stored override, or the workspace default when the override was cleared), by calling the exported
  `writeVisitorLocaleCookie(locale)`; the language in force is read with `getEffectiveSettings(scope).locale` after the write (one
  extra settings read, since the handler today returns only the stored override). This is what keeps a signed-out screen in the language the person just chose in settings. It
  does not change that function's return value or its validator. **Consequence, accepted:** on a shared device, the next person to
  open the signed-out pages and to sign up there reads, and is seeded with, the previous person's language. They see it on the
  register screen they are filling in and can change it with the switcher first; the cost is one click, and the alternative (no
  cookie after sign-out) is the language-flips-back defect this removes.
- `saveRegionalSettings` (same file) also writes `locale` but has no UI caller; if the ticket finds one, it rewrites the cookie
  the same way, and a test pins which writers exist.
- A workspace-default change on `/settings/organization` does not touch the cookie. A person whose workspace default later changes
  may see the old language on the signed-out pages until their next explicit choice. That is accepted.

### The switcher (09-S5b)

One component, `LanguageSwitcher`, in `src/components/layout/language-switcher.tsx` (beside `theme-toggle.tsx`, which it
resembles: a trigger with a state-bearing accessible name and a `Popover` from `#/components/ui/popover`). It is presentational and
takes its save as a prop, like `LanguagePicker`; the route-level wrappers decide what saving means.

- **Visibility, one rule, one place.** `LanguageSwitcher` reads `signedIn` from the root route's loader data (the field 09-S5a
  added) **through the router** (`useMatch` / `useRouterState` on the root route id), never by importing `Route` from
  `__root.tsx` (which already imports `components/layout/*`, so that would be an import cycle and a component-to-route
  dependency), and renders nothing when it is `true`. `MarketingHeader` and `AuthShell` mount it unconditionally and neither knows about
  sessions. So `/accept-invitation/$id` and `/verify-email` show it to the signed-out and hide it from the signed-in, and a
  control that writes a cookie the chain will ignore never appears.
- **Trigger**: a globe icon and, from `sm`, the active language's native name (`localeDescriptor(locale).nativeName`); below `sm`
  the icon only. The visible text is the native name, so it is readable in the language the page is in and in the language the
  visitor wants to reach. The accessible name is `shell.language.trigger`, interpolating the native name. **Target: 40px high, the height of
  `ThemeToggle` (`IconButton` `md`, a fixed `size-10` square; icon plus text from `sm` is a sibling component built on the same tokens, not an `IconButton`)**, which is above the 24px minimum of WCAG 2.5.8; the chips in the panel are 44px. At 360px in
  `fr`, `de` and `uk` the header must not scroll horizontally; if it would, the wordmark's suffix (`showSuffix`) is what gives way
  below `sm`, never a target size or the "Start free" button.
- **Panel**: the existing `LanguagePicker` with `label` = the existing `settings.language.label`. `followWorkspaceLabel` becomes
  **optional**, and so do `workspaceDefault` and the `WorkspaceName` it feeds: all three belong to the follow row, which exists
  only when `followWorkspaceLabel` is supplied. When it is absent the picker's item list **is** the twenty-three languages (not a
  rendered list with a hidden head). Index 0 is baked into more than the key handlers today (the module constant `ITEMS` starts
  with the follow row, `columnsIn` starts at `nodes[1]`, `rowStep` special-cases `current === 0`), so the ticket derives the item
  list per render and reworks those three; Home, End, wrap-around and row stepping then work over the list that is shown.
  `LanguagePickerSkeleton` keeps its follow row: only the settings screen renders it. The picker gains an optional `columnMin` so the switcher can ask for narrower columns: the popover is
  `w-[min(calc(100vw-2rem),24rem)]`, `max-h-[min(70svh,32rem)]` with internal scroll, and `columnMin` is set so that **two columns
  fit from 360px**; if a native name would truncate at that width, the grid falls back to one column rather than clipping a name.
  `PopoverContent` is named (`aria-labelledby` the picker's label), and `shell.language.hint` sits **above** the grid, under the
  label, and is referenced by `aria-describedby` so it is heard when focus enters the group.
- **Commit**: `commitLanguage` (and `localeInForce`) are lifted, unchanged in behaviour for the settings screen, from
  `src/routes/_app/settings/-lib/language-commit.ts` to `src/lib/i18n/commit-language.ts` (it imports only types from
  `#/lib/i18n`), and its tests move with it. `/settings/language` imports it from the new place. The visitor path calls it with
  `save` = `saveVisitorLanguage` (mapped to `{ locale }`) and `workspace` = the language in force before the click. Its outcomes
  keep their meaning: `rejected` (nothing changed; the existing `settings.language.saveFailed` / `saveFailedBody` toast), `switched`
  and `stale` (the cookie was written but the catalogue chunk failed; the existing `settings.language.reload.title` /
  `reload.body`). It gains one optional dependency, `applied: () => boolean`, and one outcome, **`unapplied`**: when the caller
  supplies `applied` and it answers `false` after the refresh, the status is `unapplied` instead of `switched`. The visitor path
  supplies `applied` = "the root loader's `locale` now equals the language asked for". The settings path does not supply it and is
  unchanged. `unapplied` covers a browser that did not keep the cookie and a caller who turned out to be signed in; it never claims
  success: no announcement, and a toast with `shell.language.notApplied` in the language **still on screen**.
- **After a successful switch** the popover closes, focus returns to the trigger (whose name now carries the new language), and a
  polite live region announces `shell.language.announce`. The live region lives in `LanguageSwitcher` **outside** the portalled
  popover (it must outlive the popover and be in the DOM before its text is set), the pending state and the result are held in the
  switcher so Escape during a save still announces the outcome, and the sentence is built with `commit.speak` (the translator of
  the **new** language, as `src/routes/_app/settings/language.tsx` does), never with the `t` of the render that began the save,
  which would read an old-language sentence under the new `<html lang>`. No toast on success: the page changing language is the
  confirmation.
- **Where it mounts**: `MarketingHeader` (`src/components/marketing/chrome.tsx`), between `ThemeToggle` and the sign-in link; and
  `AuthShell`'s header (`src/routes/(auth)/-ui/auth-shell.tsx`), beside `ThemeToggle`, at every width. It is **not** mounted inside
  the signed-in shell: there the settings screen owns the choice.
- **Focus on the auth screens.** `AuthShell` moves focus to its `h1` whenever `heading` changes (`auth-shell.tsx`), a rule written
  for "this screen replaced itself". A language switch changes the heading's text too and would pull focus off the trigger. The
  effect is changed so it does nothing when the heading changed **because the locale changed** (the previous locale is held in a
  ref and compared); its behaviour for a real state change is untouched.
- **Fields that show an error when the language changes.** `<html lang>` changes in place, so an error sentence left in the old
  language would be tagged with the wrong language (WCAG 3.1.2). The auth form kit (`src/routes/(auth)/-ui/form.tsx`, whose
  `useAuthSchemas` already rebuilds the schemas per locale) re-validates the fields that currently show an error when the locale
  changes, so every visible message is in the new language. Values are never cleared.
- **Re-render**: the root loader is re-run with `router.invalidate()` exactly as the settings picker does; `staleTime` stays
  infinite. A form half-filled on `/register` keeps its values (the route does not remount; only the catalogue and `<html lang dir>`
  change). A test proves it, and proves that no auth route shows a pending component that unmounts the form during the refresh.

### Carrying the language into the account (09-S5c)

Sign-up is the one moment where the language a person was reading and the language of the account they are creating can diverge.

- **Where.** In `databaseHooks.user.create.after` (`src/server/auth/index.ts`), which takes `(user, context)`. It already provisions
  the personal workspace. Seeding happens **there and nowhere else**: `session.create.before`'s fallback
  (`resolveOrProvisionOrganization`) never seeds, so a sign-in that happens to create a workspace writes no setting.
- **Only a self-registration request seeds.** The hook decides from `context.path`, against an **allowlist**: the email sign-up
  route (`/sign-up/email`) and the social callback, matched **by prefix** (`path.startsWith('/callback/')`): over HTTP Better Call
  sets `context.path` to the concrete pathname (`/callback/google`), so a literal `/callback/:id` pattern would never match and the
  social sign-up would silently never seed. Better Auth 1.7.1 turns an Apple `form_post` callback into a same-site GET, so the
  cookie arrives. The implementing ticket verifies the list against the enabled plugins and decides whether the id-token route
  (`/sign-in/social`), which can also create a user, belongs on it. Any server-side `auth.api.signUpEmail` caller on an allowlisted
  path must not forward another person's request headers, or it is taken off the seeding path; today the only such caller is the
  dev seed (`src/routes/api/dev/-seed/bootstrap.ts`). A `null`
  `context`, an unknown path, or `/admin/create-user` (the console's `createPlatformUser` forwards the admin's own headers and
  cookie, so a session check cannot tell it apart) seeds nothing. The whole path runs in a `try`/`catch` that falls to "no seed",
  so it can never fail a sign-up.
- **No "was the workspace created in this call" gate.** `user.create.after` fires only for a user that was just created, the path
  allowlist limits it to self-registration, `provisionPersonalOrganization` is idempotent and returns the same organization id
  whichever hook created the workspace, and `seedUserLocale` is insert-if-absent (which covers a retry). A gate on "had no
  membership before provisioning" would be wrong: sign-up creates the user and the session in one request, and Better Auth can run
  `session.create.before`'s fallback before this hook has provisioned (the comment on `resolveOrProvisionOrganization` in
  `src/server/auth/provisioning.ts`), so the gate would skip the seed on exactly the commonest path. "Signing in writes nothing"
  holds without it, because the fallback never seeds.
- **What is seeded.** The language the sign-up request resolved anonymously: `negotiate({ user: null, workspace: null, visitor:
<cookie>, acceptLanguage: <header> })`, written only when the result is a shipped tag **other than `en`**. So a visitor who chose
  Polish, and a visitor whose browser asked for Polish and who never touched the switcher, both open the account in Polish; a
  visitor on English gets no row, as today. This is the language the register screen was drawn in: the account carries what they
  were reading. A person who disagrees changes it on `/settings/language`.
- **How it is written (the repository, not the auth layer).** A new function in `src/server/repos/settings.ts`,
  `seedUserLocale(scope, locale)`, insert-if-absent for `(organization, user)` through `userSettingsRepository`, under a scope built
  with `createScope(db, { userId, organizationId, role: 'owner' })` for the organization `provisionPersonalOrganization` returned and
  the user just created (the precedent is `src/server/queue/handlers/billing.ts` and `travel-stats.ts`). The scope's database is the
  plain `Database` handle, built as `platformDb()` (`drizzle(d1())`) is in `src/server/auth/index.ts`; the `authDb` comment in
  `src/server/auth/db.ts` ("without importing the product data layer") is updated because `index.ts` now imports `#/server/repos`,
  and the ticket confirms there is no import cycle. It is called after the
  provisioning batch, best-effort. `src/server/auth/provisioning.ts` is not changed and gains no SQL on a tenant table. The "one
  column, one writer" note in `src/routes/_app/settings/-server/preferences.ts` is updated to name this second writer and why.
- The workspace default (`organization_settings`) is not seeded: that row is an administrator's decision, it stays `en` until its
  owner changes it, and a workspace that later has other members must not take its founder's language by accident.
- **An existing account's stored language always wins.** Signing in never writes a setting from a cookie or a header: a stale cookie
  on a shared device must not overwrite the next person's saved language. The cookie is simply ignored for a signed-in caller (the
  chain resolves at step one or two). A returning person on a new device who picks a language on the sign-in screen and then sees
  their saved one is the accepted cost; the hint says so and settings is one click away.
- **Closing the stage.** This ticket is blocked by 09-S5a and 09-S5b. Its PR adds the plan's line `Delivered: <date> - <evidence>`
  directly under `## Stage 09-S5` and updates the plan's own statement of the row (`ACC-06` partial → done), so the Reconciler
  stops naming the stage.

### Alternatives considered, and why they lost

| Alternative                                                         | Why not                                                                                                                                                                                                                       |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mark 09-S5 `Delivered:` and drop the pre-sign-in choice             | Ships no slice; the row's own wiki sentence says "before and after signing in"; a 23-locale product whose sign-in screen cannot be read by a visitor whose browser is mis-set has a defect, not a non-goal                    |
| A language in the URL (`/pl/login`)                                 | Changes the whole route tree and every link, canonical and share card; the cookie reuses the chain and the root loader unchanged                                                                                              |
| `localStorage` plus a client re-render                              | The server renders `<html lang dir>` before first paint (SPEC §9 rule 3); a client-only choice is a locale flash and a hydration mismatch, the exact defect the rule forbids                                                  |
| A second, header-sized picker                                       | SPEC §9 rule 7 and the decomposition rule: one picker; the switcher hosts it                                                                                                                                                  |
| Overwrite an account's stored language from the cookie at sign-in   | A stale cookie on a shared device would rewrite the next person's setting                                                                                                                                                     |
| Seed from an explicit choice only                                   | Leaves the commonest case (browser says Polish, nothing clicked) opening in English after a Polish registration form, which is the defect the TLDR names                                                                      |
| A raw `user_settings` insert inside `createOrganizationFor`'s batch | Atomic, but it puts SQL on a tenant table outside `server/repos` (SPEC §5, §6; nothing under `src/server/auth` imports the schema today). A best-effort repository call after the batch costs nothing the person would notice |
| Skip seeding when the request "carries a session"                   | The console's `createPlatformUser` forwards the admin's cookie into `createUser`; only `context.path` separates it from a sign-up                                                                                             |

## 📝 Architecture

| Concept                                                   | Owner module                                                                             | Notes                                                                                      |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| The chain (pure)                                          | `src/lib/i18n/negotiate.ts`                                                              | gains `visitor`                                                                            |
| The cookie's name, attributes, parser (pure)              | `src/lib/i18n/visitor-locale.ts` (new)                                                   | one definition for reader, writer and seeder                                               |
| Which language this request speaks, and the cookie writer | `src/server/fns/locale.ts`                                                               | `negotiateRequestLocale` (+ `signedIn`), `saveVisitorLanguage`, `writeVisitorLocaleCookie` |
| What the document knows about the reader                  | `src/routes/__root.tsx` (`ShellData`)                                                    | `signedIn` added; the only edit                                                            |
| The commit state machine                                  | `src/lib/i18n/commit-language.ts` (lifted)                                               | one owner for settings and for the switcher; `unapplied` added                             |
| The one picker                                            | `src/components/settings/language-picker.tsx`                                            | `followWorkspaceLabel` optional, `columnMin` optional                                      |
| The header control                                        | `src/components/layout/language-switcher.tsx` (new)                                      | hosts the picker; owns the visibility rule; mounts in two shells                           |
| Sign-up seeding                                           | `src/server/repos/settings.ts` (`seedUserLocale`), `src/server/auth/index.ts` (the hook) | one repository function, one caller                                                        |

Dependencies: none added (SPEC §3 freeze holds). `components/ui` is untouched except for reading `Popover`; the switcher is in
`components/layout` and does not import from `server/`; the route-level wrappers pass the server function in.

## 📝 Data Model

**No schema change and no migration.** The cookie is not stored. The seeded `user_settings` row uses the existing table and the
existing nullable `locale` column. `user_settings` is tenant-scoped; the seed is written through its repository under a scope for
the organization created in this sign-up and the user created in this sign-up.

## 📝 API Contracts

| Function / hook                                           | Input                                                                            | Output                                                    | Auth                     |
| --------------------------------------------------------- | -------------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------ |
| `saveVisitorLanguage` (new, POST)                         | `{ locale }`, the 23-tag `z.enum`; anything else is a validation error           | `{ locale }`; sets `planned.locale`                       | none (anonymous allowed) |
| `saveLanguagePreference` (existing)                       | unchanged                                                                        | unchanged; also sets the cookie to the language in force  | session, as today        |
| `negotiateRequestLocale` (existing, GET)                  | none                                                                             | `{ locale, dir, signedIn }`; reads the cookie as step 3   | reads the session cookie |
| `negotiate({ user, workspace, visitor, acceptLanguage })` | `visitor` new, optional                                                          | a shipped tag                                             | pure                     |
| `seedUserLocale(scope, locale)` (new, repository)         | a `TenantScope` for the new organization and user; a shipped tag other than `en` | the row (insert-if-absent; an existing row is left alone) | the auth hook only       |
| `commitLanguage(request, deps)` (lifted)                  | `deps.applied?: () => boolean` new, optional                                     | adds the `unapplied` status                               | pure                     |

## 📝 UI/UX

- The control is a **chrome control, quiet by default**: ghost icon-button styling like the theme toggle, same height (40px), same
  focus ring, no new colour or token.
- The popover holds a 23-item radio group: the settings picker's own chip grid, so the arrow-key roving, `aria-checked`, pending
  spinner and native-script labels (`lang` attribute per chip, `dir` per script) are inherited, not rebuilt. It scrolls inside the
  popover when the viewport is short.
- Below `sm` the trigger is the icon alone with the full accessible name; the visible text is dropped, not truncated.
- `prefers-reduced-motion`: the popover's open animation uses the existing popover tokens, which already honour it.
- **Right-to-left**: the control sits at the end edge in `ar`; the popover `align="end"` is a logical alignment. No `left`/`right`
  utilities are introduced (SPEC §9 rule 4).
- The hint is plain text above the grid, not a tooltip.

## 📝 Copy

New keys, in the `shell` namespace, `en` text below. The implementation lands each key in all 23 locales in the same change
(`i18n-messages` skill, parity test). The picker's label and the failure and reload sentences reuse existing `settings.language.*`
keys and are not new.

| Key                         | `en`                                                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `shell.language.trigger`    | `Language: {language}. Change language`                                                                                 |
| `shell.language.hint`       | `Remembered on this device. Once you sign in, the language set in your account applies; you can change it in Settings.` |
| `shell.language.announce`   | `Language changed to {language}`                                                                                        |
| `shell.language.notApplied` | `This browser did not keep your choice. Allow cookies for this site, then choose again.`                                |

`{language}` is the native name of the language, interpolated as a string from `localeDescriptor` (names are data, not numbers).
The privacy-page sentence is English by design (SPEC §9 rule 8) and is not a catalogue key.

## 📝 Edge Cases & Failure Scenarios

| Case                                                                             | Behaviour                                                                                                                                                                                                                                                                                                           |
| -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cookie holds an unshipped tag, free text, `__proto__`, is over-long, or repeated | Treated as absent; the chain falls to `Accept-Language`, then `en`. Never throws, never reaches the `Locale` type unvalidated                                                                                                                                                                                       |
| `saveVisitorLanguage` rejects (network, 4xx)                                     | `rejected`: the picker keeps the previous selection and the page keeps its language; the existing "was not changed" toast                                                                                                                                                                                           |
| Cookie written but the new catalogue chunk fails to load                         | `stale`: the saved-but-not-switched sentences with a reload action, as in settings                                                                                                                                                                                                                                  |
| Cookies blocked in the browser                                                   | The POST succeeds, the next request carries no cookie, the root loader resolves the old language: `unapplied`. No success is announced; the toast tells the person to allow cookies                                                                                                                                 |
| Signed-in person opens a marketing page or `/accept-invitation/$id`              | `signedIn` is `true`: no switcher. They change language in settings                                                                                                                                                                                                                                                 |
| A switcher open when the person signs in in another tab                          | The next `invalidate` resolves `signedIn`; if the switch then resolves to the stored language, it is `unapplied` and says so                                                                                                                                                                                        |
| Signed-out screen after a settings change                                        | Shows the language in force at the last explicit save (cookie rewritten by `saveLanguagePreference`)                                                                                                                                                                                                                |
| Workspace default changes later                                                  | Cookie is not touched; accepted drift on signed-out pages only                                                                                                                                                                                                                                                      |
| Two tabs                                                                         | The second tab re-reads the cookie on its next navigation or `invalidate`; no cross-tab broadcast                                                                                                                                                                                                                   |
| Half-filled `/register` form, then a language change                             | Values kept; fields currently showing an error are re-validated so every visible message is in the new language; focus stays on the trigger                                                                                                                                                                         |
| Sign-up through Google/Apple                                                     | The callback request (`/callback/:id`, same-site GET) carries the cookie and the header and seeds the same way                                                                                                                                                                                                      |
| A person signs up, then accepts an invitation into another workspace             | The seed covers the personal workspace only. `user_settings` is per `(organization, user)`, so the invited workspace has no row for them and shows its workspace default until they choose a language there; the cookie is ignored once signed in. Accepted, the pre-existing per-workspace property (Out of scope) |
| Admin creates an account from the console                                        | `context.path` is not on the allowlist: no seeding, whatever cookie the admin's request carries                                                                                                                                                                                                                     |
| Sign-up hook runs twice (retry)                                                  | `seedUserLocale` is insert-if-absent; a retry adds nothing                                                                                                                                                                                                                                                          |
| A sign-in creates the personal workspace in `session.create.before`              | No seed (the fallback never seeds)                                                                                                                                                                                                                                                                                  |
| First signed-in screen right after sign-up                                       | If the seed has not landed when the first screen renders, that screen uses the workspace default (`en`) and the next navigation shows the seeded language; accepted, because the seed is awaited inline in the hook in the normal case and a failure never blocks sign-up                                           |
| Seeding throws                                                                   | Caught; the sign-up completes with no seeded row; a warning is logged through `logAuth`                                                                                                                                                                                                                             |
| `ar` chosen                                                                      | `<html dir="rtl">` on the next render; the control and popover mirror                                                                                                                                                                                                                                               |

## ✅ Acceptance criteria

**09-S5a**

1. `negotiate()` orders user, workspace, visitor, `Accept-Language`, `en`; unit tests cover each step winning and each falling
   through, including an unshipped visitor value, `constructor` / `__proto__`, an over-long value, and a header with two
   `planned.locale` pairs (absent).
2. An anonymous request with `planned.locale=pl` and `Accept-Language: de` renders `<html lang="pl">`; the stored-settings read is
   not called (injected-source test proves it). The existing `LocaleRequestSource` fixtures gain `visitorLocale`, and the stubbed `negotiated` literals gain `signedIn`.
3. A signed-in caller with a stored language is unaffected by the cookie, and `negotiateRequestLocale` answers `signedIn: true`; an
   anonymous caller gets `false`; the root loader's catch path and `SOURCE_LANGUAGE` give `false`.
4. `saveVisitorLanguage` rejects a tag outside the twenty-three and `''`; accepts each shipped tag; sets the cookie with exactly
   the attributes in the table (header assertion), and writes no database row.
5. `saveLanguagePreference` sets the cookie to the language in force, including after the override is cleared (the workspace
   default is then the cookie's value).
6. `docs/SPEC.md` §9 rules 3 and 7 are amended in the same PR; `CONTEXT.md` gains **Visitor language**; the privacy page cookie
   list gains the factual sentence (sent with every request, holds only a language code, identifies nobody, a year); the stale
   `§8.3` references in `locale.ts` and `negotiate.ts` read §9 rule 3. A test pins `vary: accept-language, cookie` on the root
   route. The grep for the changed terms (below) finds no document still saying the chain has four steps or that the picker is
   settings-only. The PR body flags the cookie's consent classification for a person.

**09-S5b**

7. The switcher renders in `MarketingHeader` and in `AuthShell`'s header at 360, 1280 and 2560px for a signed-out visitor, and is
   absent for a signed-in one, including the signed-in states of `/accept-invitation/$id` and `/verify-email` and the signed-in
   shell.
8. Choosing a language re-renders the page in it without a full reload, sets `<html lang dir>`, keeps `/register` form values,
   shows no pending component that unmounts the form, and survives a reload.
9. `LanguagePicker` renders no "follow the workspace" chip when `followWorkspaceLabel` is omitted and renders it unchanged when
   given. Keyboard tests cover the 23-item shape: Home, End, wrap in both directions, Up from the first row, row stepping, and `ar`.
   The existing picker tests pass untouched.
10. `commitLanguage` is imported from `src/lib/i18n/commit-language.ts` by both consumers and its tests moved with it, with no
    behaviour change for the settings screen; the visitor path reports `unapplied` (not `switched`) when the cookie is not kept and
    when the caller is signed in, with tests for both.
11. Keyboard and focus, tested on `/login` **and** on a marketing page: Tab reaches the trigger in header order; Enter/Space opens;
    arrows move within the group; Escape closes and returns focus to the trigger; after a successful switch focus is on the
    trigger, not on the `h1` or `<body>`; the trigger's name carries the active language. The live region lives outside the popover,
    announces once, in the new language, and still announces when Escape was pressed during the save.
12. The popover has an accessible name, the hint is described-by, the trigger is 40px, the chips 44px; `ar` mirrors the control and
    popover; no physical-direction utility is introduced. At 360px the grid is two columns unless a name would truncate.
13. At 360px in `fr`, `de` and `uk`, light and dark, the marketing header does not scroll horizontally and every target is at least
    24px (the trigger 40px).
14. Fields showing an error when the language changes are re-validated into the new language and no value is cleared.
15. The four `shell.language.*` keys exist in all 23 locales; the parity test passes.

**09-S5c**

16. A sign-up through the real `/sign-up/email` endpoint with `planned.locale=pl` creates a `user_settings` row for the new
    `(organization, user)` with `locale = 'pl'`; with no cookie and `Accept-Language: pl-PL` the same; with `en`, with no signal, or
    with an unshipped value, no row is written. The test drives the endpoint, not `provisionPersonalOrganization` directly.
17. A request to `/admin/create-user` carrying a cookie and a session seeds nothing; a `null` context seeds nothing; a sign-in that
    creates the workspace in `session.create.before` seeds nothing; and, when `session.create.before`'s fallback
    provisions the workspace before `user.create.after` runs (the race, set up deterministically by running `provisionPersonalOrganization` first and then driving the hook), the seed still lands because the hook provisions
    idempotently and seeds into the organization it returns. The seed is **never** moved into `session.create.before`. A concrete `/callback/<provider>` path is tested as
    well as `/sign-up/email`. The seed test needs `user_settings` and the other tenant tables, so it uses a harness that migrates the
    full schema (the in-memory schema of `auth-handler-closure.test.ts` is built from `authSchema` only).
18. Signing in to an existing account never writes `user_settings`.
19. `seedUserLocale` is covered in `src/server/repos/__tests__/tenant-isolation.test.ts`: it writes only the scope's organization,
    and is insert-if-absent. A throwing seed does not fail the sign-up.
20. The plan carries `Delivered:` under `## Stage 09-S5` with evidence, and its statement of `ACC-06` reads done.

## 📝 Risks & Impact Review

| Risk                                                                      | Severity | Mitigation                                                                                                                                                         |
| ------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Cookie value reaches the `Locale` type unvalidated                        | medium   | One parser plus `resolveLocaleTag`; `Map` lookup, length cap, duplicates absent; tests with prototype names and long input                                         |
| Sign-up hook change breaks account creation                               | high     | Seed is best-effort, after provisioning, inside `try`/`catch`, behind an allowlist; `provisioning.ts` untouched. Risk-high label on 09-S5c (authentication path)   |
| An admin's cookie or header seeds another person's account                | medium   | `context.path` allowlist, `null` context seeds nothing; test with the admin path                                                                                   |
| Seeding writes into the wrong tenant                                      | medium   | The scope is built from the organization the same call just created and the user it just created; repository test in `tenant-isolation.test.ts`                    |
| Shared cache serves one visitor's language to another                     | medium   | The root route already sends `vary: accept-language, cookie`; a test pins it                                                                                       |
| A control that appears to work and does not                               | low      | One visibility rule inside the switcher, from the loader's `signedIn`; the `unapplied` outcome refuses to claim success                                            |
| Hydration mismatch from a client-chosen language                          | medium   | Language is decided by the server from the cookie; the client only re-runs the loader                                                                              |
| Cookie consent classification                                             | low      | The page states what the cookie is, plainly; the PR flags the legal classification for a person. It does not block the build                                       |
| Files owned elsewhere: `__root.tsx`, 09-S8's settings shell, SPEC §9 text | low      | `__root.tsx` gains one field in `ShellData`; `/settings/language` gets an import-path change and nothing else; SPEC §9 is amended in 09-S5a with its own paragraph |

### Out of scope

- The create-workspace dialog seeding a workspace default; a workspace's default language for guests.
- `user_settings` being per workspace rather than per person (a language chosen in one workspace is not carried to another, and a
  sign-up seed reaches the personal workspace only, so a person who joins an invited workspace sees its default until they choose):
  a pre-existing property of the table, noted here so it is not mistaken for this stage's defect. A follow-up for a person-level
  language is for a product decision.
- Translating `src/routes/legal/**` prose.
- Any change to the runtime, catalogues, formatter, or right-to-left layout (done).

### Blockers

None. The plan's two blockers are resolved by the existing implementation (SPEC §9 is the decision; `src/lib/i18n/` is the build).

### Reference-row disposition

`ACC-06` moves **partial → done** when 09-S5c merges, which also adds the plan's `Delivered:` line. Nothing in `gap-rows.json`
depends on it.

## 📋 Phasing

| Ticket | Slice                                                                                                      | Blocked by     | Risk      |
| ------ | ---------------------------------------------------------------------------------------------------------- | -------------- | --------- |
| 09-S5a | cookie, negotiation step, `signedIn`, `saveVisitorLanguage`, settings save rewrites it, docs               | none           | risk-low  |
| 09-S5b | lift `commitLanguage`, picker changes, `LanguageSwitcher`, two mounts, focus and re-validation fixes, copy | 09-S5a         | risk-low  |
| 09-S5c | sign-up seeding through the repository, `Delivered:` line                                                  | 09-S5a, 09-S5b | risk-high |

Each ticket is a full path: 09-S5a from a settings save to a signed-out screen rendered in that language (cookie, chain,
`<html lang>`) under a test; 09-S5b from a click to a re-rendered page; 09-S5c from a sign-up request to a row.

## 📋 Implementation Plan

### Phase 1 - the visitor's language (09-S5a)

1. `src/lib/i18n/visitor-locale.ts` (name, attributes, `parseVisitorLocaleCookie`); `negotiate` gains `visitor`; tests.
2. `src/server/fns/locale.ts`: `visitorLocale` source member, `signedIn` on `NegotiatedLocale`, `saveVisitorLanguage`,
   `writeVisitorLocaleCookie`; `src/routes/__root.tsx` carries `signedIn` in `ShellData`; fixtures; tests with an injected source.
3. `saveLanguagePreference` rewrites the cookie to the language in force; test.
4. `docs/SPEC.md` §9 rules 3 and 7; `CONTEXT.md` **Visitor language**; the privacy page sentence; the `§8.3` comment references; a
   test pinning the root `vary`.

### Phase 2 - the switcher (09-S5b)

The prefactor ticket #1172 owns the helper move and tests, optional follow row and `columnMin`,
and auth focus/error re-validation. It preserves settings behaviour and the helper's three existing
outcomes. The switcher ticket #1173 owns `applied` / `unapplied` with their caller and the remaining UI.

1. Lift `commitLanguage` / `localeInForce` and their tests; add `applied` and `unapplied`; update `/settings/language`'s import.
2. `LanguagePicker`: `followWorkspaceLabel` and `columnMin` optional, the item list derived without the follow row; tests for both
   shapes.
3. `LanguageSwitcher` (visibility rule, trigger, named popover, hint, live region, focus return); the four `shell.language.*` keys
   in 23 locales.
4. `AuthShell`'s focus effect ignores locale-driven heading changes; the auth form kit re-validates visible errors on a locale
   change.
5. Mount in `MarketingHeader` and `AuthShell`; journey; frames.

### Phase 3 - carry it into the account (09-S5c)

1. `seedUserLocale` in `src/server/repos/settings.ts` and its `tenant-isolation.test.ts` case; update the note in `preferences.ts`.
2. The hook: allowlist on `context.path`, the anonymous negotiation, best-effort call; tests through
   the real endpoint.
3. The plan's `Delivered:` line and the row's status.

## Verification

- The gate in `validation.commands` (`.ai/agentic.config.json`) on each ticket's last commit.
- **Server** (`server` project): negotiation order and fall-through; `saveVisitorLanguage` validation, cookie header attributes and
  no D1 call (a server module that reaches `cloudflare:workers` is tested through its injected source or with the bindings mocked,
  per `AGENTS.md`); the sign-up seeding through the real auth handler (the three paths, the admin path, `null` context, the
  fallback, the throw); `seedUserLocale` in `tenant-isolation.test.ts`.
- **Unit** (`ui` project): `LanguageSwitcher` (visibility, open, select, pending, rejected, stale, unapplied, focus return, live
  region, Escape during save); `LanguagePicker` both shapes with keyboard; `commitLanguage` (moved tests plus `unapplied`); the
  `AuthShell` focus rule; the form kit's re-validation.
- **E2E** (one journey in `e2e/journeys.spec.ts`; routing and sessions are what ADR 0016 admits): anonymous `/login` with
  `Accept-Language: en`, choose `Polski`, the heading is Polish and `<html lang="pl">`, focus is on the trigger, a reload keeps it,
  `/register` is Polish; a settings change followed by sign-out keeps the settings language; a signed-in visit to a marketing page
  shows no switcher. `watchConsole` attached before navigation. No `toHaveScreenshot`.
- **Review evidence**: the blind A/B pair from `scripts/visual/capture.mjs` at 360x800, 1280x900 and 2560x1440 in light and dark for
  `/`, `/login` and the open popover, plus `ar`, plus the marketing header at 360px in `fr`, `de` and `uk`; a keyboard and
  screen-reader pass over the trigger and the group (how NVDA, JAWS and VoiceOver treat `<html lang dir>` changing in place is
  recorded in the 09-S5b PR; it needs the running app).
- Docs and CI: the terms searched before each PR are "Accept-Language", "negotiat", "language picker", "settings-only", "planned.locale",
  "cookie", "Cookies and browser storage", "visitor", "§8.3". At spec time: `docs/SPEC.md` §9 rules 3 and 7, the privacy page,
  `CONTEXT.md`, the `locale.ts` and `negotiate.ts` comments, and the plan itself.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                                          | Applied default                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Why                                                                                                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The stage is marked BLOCKED and owns no files. Mark it delivered, or spec a gap?                  | Spec the one missing behaviour (a language choice before sign-in) and nothing else; the other three ACC-06 behaviours are cited as done                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Decided by product owner sub-agent (confidence medium): the row's own wiki sentence says "before and after signing in"; `grep` finds no control outside signed-in settings; the plan forbids re-specifying what exists                            |
| 2   | Where the cookie sits in the chain                                                                | After the stored settings and before `Accept-Language`; for a signed-in caller it never decides                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Decided by product owner sub-agent (confidence medium): `organization_settings.locale` is `NOT NULL DEFAULT 'en'`, so the header step is reached only by anonymous requests                                                                       |
| 3   | What "carried into the account" means                                                             | Seed the new personal workspace member's `user_settings.locale` at sign-up; an existing account's stored language wins and sign-in writes nothing                                                                                                                                                                                                                                                                                                                                                                                                                                        | Decided by product owner sub-agent (confidence medium): a stale cookie on a shared device must not overwrite the next person's saved setting                                                                                                      |
| 4   | One picker and one commit path                                                                    | The switcher hosts `LanguagePicker`; `commitLanguage` is lifted to `src/lib/i18n/commit-language.ts`; `followWorkspaceLabel` becomes optional                                                                                                                                                                                                                                                                                                                                                                                                                                            | Decided by product owner sub-agent (confidence medium): SPEC §8 "one concept, one owner"; a second control would be two writers of one concept                                                                                                    |
| 5   | The SPEC amendment                                                                                | The same PR as 09-S5a amends `docs/SPEC.md` §9 rules 3 and 7, adds a glossary entry and a privacy-page sentence                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | Decided by product owner sub-agent (confidence medium): without it the code contradicts the contract                                                                                                                                              |
| 6   | Seed from an explicit choice only, or also from `Accept-Language`                                 | From the language the sign-up request resolved anonymously (cookie, else header), when it is a shipped tag other than `en`                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Decided by traveller sub-agent (confidence medium) in panel round 1, overturning this spec's first default: seeding only an explicit choice left the commonest case (a Polish browser, nothing clicked) opening in English                        |
| 7   | Seed the workspace default too                                                                    | No; only the person's own row                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            | Applied default: the workspace default is an administrator's decision and a workspace with later members must not take its founder's language by accident                                                                                         |
| 8   | Cookie flags, storage and wording                                                                 | `HttpOnly`, `Secure` (non-dev), `SameSite=Lax`, `Path=/`, 365 days; no `localStorage` copy; the privacy page says it is sent with every request                                                                                                                                                                                                                                                                                                                                                                                                                                          | Decided by security and tenancy sub-agent (confidence medium) in panel round 1: unlike the theme preference it leaves the device; its consent classification is flagged for a person in the PR body and does not block                            |
| 9   | Who sees the switcher                                                                             | Signed-out visitors only, decided inside the switcher from `signedIn` on the root loader data; the flag is added in 09-S5a                                                                                                                                                                                                                                                                                                                                                                                                                                                               | Decided by product owner, software architect and traveller sub-agents (confidence medium) in panel round 1: the header and shell know nothing about sessions today; a control that writes a cookie the chain ignores appears to work and does not |
| 10  | A success toast for a visitor's switch                                                            | None; a polite live region in the switcher announces it, built with the new language's translator. A switch that did not take is `unapplied` with a toast                                                                                                                                                                                                                                                                                                                                                                                                                                | Decided by accessibility and traveller sub-agents (confidence medium) in panel round 1: the page changing is the confirmation; `switched` must not be claimed when the loader still resolves the old language                                     |
| 11  | Which sign-up requests seed                                                                       | An allowlist on `context.path` (`/sign-up/email`, the social callback); `null` context, unknown paths and `/admin/create-user` seed nothing                                                                                                                                                                                                                                                                                                                                                                                                                                              | Decided by security and tenancy sub-agent (confidence medium) in panel round 1: the console forwards the admin's headers into `createUser`, so "carries a session" cannot tell it from a sign-up                                                  |
| 12  | How the seed is written                                                                           | `seedUserLocale` in `src/server/repos/settings.ts`, insert-if-absent under a scope for the new organization and user, best-effort after provisioning; `provisioning.ts` untouched                                                                                                                                                                                                                                                                                                                                                                                                        | Decided by product owner, software architect and security and tenancy sub-agents (confidence medium) in panel round 1: SQL on a tenant table belongs in `server/repos`; a best-effort call after the batch can never fail a sign-up               |
| 13  | Gate seeding on "the workspace was created in this call"?                                         | No gate. Seed from `user.create.after` only, on an allowlisted path, idempotently; the `session.create.before` fallback never seeds                                                                                                                                                                                                                                                                                                                                                                                                                                                      | Decided by product owner sub-agent (confidence medium) in panel round 2, replacing the security sub-agent's round-1 gate: the gate would lose the seed to the sign-up race on the commonest path; "sign-in writes nothing" holds without it       |
| 14  | Focus and announcement on the auth screens                                                        | `AuthShell` ignores locale-driven heading changes; live region outside the popover; popover named; hint above the grid and described-by                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Decided by accessibility sub-agent (confidence medium) in panel round 1: WCAG 2.4.3, 4.1.3, 4.1.2, 3.1.2                                                                                                                                          |
| 15  | Visible errors when the language changes                                                          | The auth form kit re-validates the fields currently showing an error; values are never cleared                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Decided by accessibility sub-agent (confidence medium) in panel round 1: WCAG 3.1.2, a message in the old language under the new `<html lang>`                                                                                                    |
| 16  | Who closes the stage                                                                              | 09-S5c, blocked by 09-S5a and 09-S5b, adds the plan's `Delivered:` line and the row's status                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Decided by product owner sub-agent (confidence medium) in panel round 1: one ticket owns the closing edit                                                                                                                                         |
| 17  | Panel round 1 (product owner, software architect, security and tenancy, accessibility, traveller) | All five: **approve with conditions**. Every condition is applied in the revision that follows the first commit of this spec                                                                                                                                                                                                                                                                                                                                                                                                                                                             | Panel verdicts recorded as `afk-plan-to-spec` § 5 requires; no specialist answered revise                                                                                                                                                         |
| 18  | Panel round 2 (product owner, software architect, security and tenancy, accessibility, traveller) | Product owner, accessibility, traveller: **approve**. Software architect: **approve with conditions** (callback path matched by prefix; `signedIn` read through the router, not by importing `__root.tsx`; the scope's plain `Database` handle and the `authDb` comment; a harness that migrates the full schema). Security and tenancy: **approve with conditions** (the ordering clause failed closed, since replaced by the race test of row 19; no server-side sign-up caller forwards another person's headers). All conditions were wording or test-harness points and are applied | Panel verdicts recorded as `afk-plan-to-spec` § 5 requires; nobody answered revise after round 2 and the security reviewer approved with conditions that are now in the text                                                                      |
| 19  | Late round-2 review (product owner, second pass)                                                  | **Approve with conditions**, all applied: the "workspace created in this call" gate is removed (row 13); the race test replaces the ordering clause; the first-render edge case is stated; the privacy intro no longer calls the cookie necessary; the evidence-table sentence agrees with its rows                                                                                                                                                                                                                                                                                      | Panel verdicts recorded as `afk-plan-to-spec` § 5 requires; nobody answered revise                                                                                                                                                                |

## Amendment

### The switcher shipped differently in five places - #1173

- **The wordmark gives up more than its suffix.** The suffix alone was not enough: with the switcher mounted, the marketing
  header measured 372px in `en` at 360px, and the French "Start free" button alone is about 195px. `Wordmark` gained `compact`:
  below `sm` the `.travel` suffix becomes a dot, and below 30rem the word goes and the mark stands alone (the home link keeps its
  `aria-label`). The header no longer scrolls horizontally at 360px in `en`, `fr`, `de` and `uk`. The "Start free" button and
  every target size are unchanged.
- **The popover is named with `aria-label`, not `aria-labelledby`.** The label string lives inside the picker, and the popover
  and the group would otherwise be named from two sources; `settings.language.label` is passed to both.
- **The join page does not carry the switcher.** `MarketingHeader minimal` (used by `/join/$token`) stays the wordmark and the
  theme toggle. `/join/$token` declares a `pendingComponent` with `staleTime: 0`, so a foreground refresh there can replace the
  frame, header included, and lose the pending state, the announcement and focus.
- **A refresh that did not happen is `stale`, and the trigger shows work in flight.** The root loader never rejects: on a failed
  negotiation or catalogue load it answers English with no messages. The switcher treats that as `stale`, not as `unapplied`, so
  it does not tell a person to allow cookies. While a save runs the trigger carries `aria-busy` and a spinner, because Escape
  or an outside click closes the popover and its chip is the only other signal. Focus returns to the trigger after a switch only
  if it is still inside the popover, on the trigger or nowhere; someone who has moved on keeps their place.
- **The header gives up room between 640px and 1280px, and the name shows from `xl`, not `sm`.** Measured against the header
  with the switcher hidden, the name pushed the marketing header past the viewport between 640px and 1024px in 11 locales
  (`fr` by 92px at 640px and 141px at 1024px; `es`, `nl`, `pt-BR`, `uk`, `de`, `pl` and others by 15-38px), because "Pricing",
  "Sign in" and "Start free" are all visible there. The trigger is the icon alone (40px, the name stays in its accessible
  name) until `xl`; "Pricing" shows from `md` instead of `sm` and the landing page's in-page anchors from `xl` instead of
  `lg` (the French header was already 35px too wide at 1024px). After the change no width from 360px to 1280px overflows
  because of the header in any of the 23 locales, and `/login` is clean at every width. Below 22rem the header takes
  `px-3` and `gap-1` and "Start free" `px-2.5`, because the French row was 15px too wide at 320px; every locale's header
  now fits at 320px. Still wider than the screen,
  untouched by this slice: the document at 320px in ten locales, and at 360px in `el`, `ru`, `uk` (#1497).

### The sign-up seed shipped in its own closed leaf, behind an allowlist - #1174

- **`seedUserLocale` lives in `src/server/repos/user-locale-seed.ts`, not `settings.ts`.** The auth layer may reach the
  repository graph only through auth-runtime-free leaf modules (docs/SPEC.md §5, ADR 0043, pinned by
  `src/server/fns/console/__tests__/isolation.test.ts`). `settings.ts` also holds `appSettingsStore` (the global
  `app_settings` writer) and `updateOrganizationSettings`; importing it from the sign-up hook would have put both into the
  console and auth graph. The leaf imports only `./base`, the schema and the locale list, and is the second closed exception
  after `workspace-invitation-acceptance` (#1009).
- **Seeding is allowed on `/sign-up/email` and the `/callback/` prefix only, and only from `context.request`.** The hook cannot
  tell a person registering from an administrator's `createUser` by a session check, because `/admin/create-user` forwards the
  admin's own cookie. An in-process `auth.api.*` call carries `headers` but no `request`, so a server-side caller can never
  seed. The id-token route `/sign-in/social` is off the list; no client of this product sends an `idToken`.
- **The scope role is `member`.** The insert needs no administrator right.
- **The `authDb` comment was already stale.** `organization-invitations.ts` imported `#/server/repos/base` before this change,
  so the repository graph was not a new edge for the auth layer; only `index.ts` importing it directly is new.
