# Choose a language before you sign in

| Field              | Value                                         |
| ------------------ | --------------------------------------------- |
| **Status**         | ready                                         |
| **Issue**          | none                                          |
| **Spec PR**        | none                                          |
| **Implementation** | none                                          |
| **Plan**           | 09-S5 (docs/plans/09-account-and-settings.md) |

## 📝 TLDR

Plan stage `09-S5` (`docs/plans/09-account-and-settings.md`, reference row `ACC-06`, "Speaking more than one language") was
written as **BLOCKED**: no message runtime, and the work owned by another plan. Both blockers are gone. The runtime, the
twenty-three catalogues, server-side negotiation, the right-to-left layout and the signed-in language picker all exist, and the
plan itself says its re-planned stage "must not re-specify what is already there". Checked against the repository, **one**
behaviour of the row is missing: **choosing a language before signing in.** A visitor on a sign-in, registration or marketing page
can only read the language their browser's `Accept-Language` header names, or English, and has no control to change it. This
spec closes exactly that, in three tickets:

1. **09-S5a - the visitor's language, remembered and read before first paint.** A first-party cookie `planned.locale`, one server
   function that sets it, one new step in the negotiation chain (after the stored settings, before `Accept-Language`), and the
   signed-in picker's save rewriting the cookie so signing out does not flip the language back. Amends `docs/SPEC.md` §9 rules 3
   and 7, adds a glossary entry and one line to the privacy page.
2. **09-S5b - the switcher.** A compact language control in the marketing header and in the auth shell's header, opening the
   **existing** `LanguagePicker` in a popover, committing through the **existing** commit helper (lifted, not copied), and
   re-rendering the page in the new language without a reload.
3. **09-S5c - carry the choice into the account.** At sign-up, a visitor who chose a language gets that language as their own
   setting on the new personal workspace, so the account does not open in English after a registration form read in Polish.

Nothing else on the row is specified here, because nothing else is missing (see the evidence table).

## 📝 Visual change expected

| Route / state                                                                                                                              | Change                                                                                                                                                  |
| ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/`, `/pricing` (marketing header)                                                                                                         | A language control between the theme toggle and the sign-in link. Closed, open (popover with 23 languages), pending (spinner on the chip being written) |
| `/login`, `/register`, `/forgot-password`, `/reset-password`, `/two-factor`, `/verify-email`, `/accept-invitation/$id` (auth shell header) | The same control beside the theme toggle, at every width; below `lg` it sits in the row that carries the wordmark                                       |
| Any of the above in `ar`                                                                                                                   | The control and its popover mirror; the popover opens toward the start edge; the chip grid reads right-to-left                                          |
| `/settings/language`                                                                                                                       | No visual change                                                                                                                                        |

Light and dark, 360px, 1280px and 2560px, per ADR 0016 (the blind A/B pair from `scripts/visual/capture.mjs`, no baselines). The
control has a declared non-resting state (open) and a pending state; the plan's frame set for this row is owed once, in 09-S5b.

## 📝 Problem Statement

### What a person meets today

A traveller whose browser says English opens a link a Polish colleague sent, lands on `/register`, and reads English with no way
to change it. A traveller whose browser says Polish sees Polish on the same page, registers, and is then shown **English**
everywhere inside the product, because the personal workspace is created with `organization_settings.locale = 'en'` and no personal
override (`src/server/repos/settings.ts:205`, `src/server/auth/provisioning.ts:155`). The only language control in the product is
`/settings/language`, behind the sign-in the visitor has not passed.

### The plan's claims, checked against the repository

The reference row asks for four behaviours. Three are done; one is not.

| ACC-06 behaviour                                               | State       | Evidence                                                                                                                                                                                                                                                  |
| -------------------------------------------------------------- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Runtime, twenty-three languages, parity                        | done        | `src/lib/i18n/` (catalogue, negotiate, plural, interpolate, provider), `src/lib/i18n/messages/<tag>/<namespace>.ts`, `src/lib/i18n/__tests__/parity.test.ts`, `e2e/i18n-runtime-parity.spec.ts`                                                           |
| Resolve the language through a chain, server-side              | done        | `src/server/fns/locale.ts` (`negotiateLocaleFrom`: stored user, else workspace, else `Accept-Language`, else `en`), called from the root `loader` in `src/routes/__root.tsx`; `<html lang dir>` server-rendered                                           |
| Right-to-left layout                                           | done        | `ar` has `dir: 'rtl'` in `src/lib/i18n/locales.ts`; `__root.tsx` wraps the tree in a direction provider; logical properties and `rtl:` mirrors in `auth-shell.tsx`                                                                                        |
| Choose a language **after** signing in, apply without a reload | done        | `src/routes/_app/settings/language.tsx`, `src/components/settings/language-picker.tsx`, `saveLanguagePreference` in `src/routes/_app/-server/settings.ts`, `commitLanguage` in `src/routes/_app/settings/-lib/language-commit.ts` (`router.invalidate()`) |
| Choose a language **before** signing in                        | **missing** | No control in `src/routes/(auth)/**`, `src/routes/index.tsx`, `src/routes/pricing.tsx`, `src/components/marketing/**` or `src/components/layout/**`. `src/lib/i18n/negotiate.ts` is pure and reads no cookie                                              |

One fact decides the cookie's place in the chain. `organization_settings.locale` is `NOT NULL DEFAULT 'en'`
(`src/server/db/schema.ts:2680`), and `getEffectiveSettings` (`src/server/repos/settings.ts:334`) therefore always answers for a
signed-in caller. The `Accept-Language` step is reached **only by anonymous requests**. A new step placed after the stored
settings can therefore never override a signed-in person's saved language, and never needs to be told apart from one.

Another: `user_settings` is unique on `(organization_id, user_id)` (`schema.ts:2755`). A person's "own language" is a row per
workspace they belong to, not one row per person. This spec does not change that (see Out of scope).

## 📝 Proposed Solution

### What the stage owns and what it does not

Owned (the paths each ticket may touch are in the Implementation Plan): the visitor cookie and its negotiation step, the switcher,
the lifted commit helper, the sign-up seeding. **Not** owned, and not touched: the runtime and catalogues (done), the settings
shell (09-S8 owns the settings route tree; `/settings/language` is not edited, except that its save also rewrites the cookie), the
workspace default language on `/settings/organization`, and `src/routes/legal/**` (SPEC §9 rule 8 keeps long-form legal prose in
English; the switcher appears wherever `MarketingHeader` does, and the legal pages' existing English-only notice is unchanged).

### The chain (09-S5a)

`docs/SPEC.md` §9 rule 3 becomes: **user setting → workspace setting → visitor cookie → `Accept-Language` → `en`.**

- `negotiate()` in `src/lib/i18n/negotiate.ts` gains one optional input, `visitor`, between `workspace` and `acceptLanguage`. It
  stays pure: the caller passes the cookie's value in. The value is passed through the same `resolveLocaleTag` canonicalisation as a
  stored tag and is never trusted as-is; an unresolvable value is treated as absent, exactly as a bad `Accept-Language` is.
- `LocaleRequestSource` in `src/server/fns/locale.ts` gains a fourth injected member, `visitorLocale: () => string | null`, reading
  the cookie from the request. It is read from the request headers only, so the guarantee that an anonymous request never touches
  D1 (`locale.ts` header comment, SPEC §5) holds, and a test can prove the stored read was not called.
- Because a signed-in caller always resolves at step one or two, the cookie matters to anonymous requests only. It is consulted for
  everyone because the function is one chain, not two.

### The cookie

| Attribute | Value                                                                                                           |
| --------- | --------------------------------------------------------------------------------------------------------------- |
| Name      | `planned.locale` (the product's cookie prefix is `planned`, `src/server/auth/index.ts` `advanced.cookiePrefix`) |
| Value     | one of the twenty-three tags, nothing else                                                                      |
| Flags     | `HttpOnly`, `Secure` outside local development, `SameSite=Lax`, `Path=/`                                        |
| Lifetime  | 365 days, rewritten on every explicit choice                                                                    |

It is `HttpOnly` because nothing in the browser needs to read it: the page learns the language from the root loader, which is what
the switcher re-runs. No script, no `localStorage` copy. It identifies nobody and carries no personal data, so it is a functional
preference cookie of the same kind as the theme preference, and the privacy page's cookie list gets one line saying so (no consent
banner is added; the page already states there are no advertising or analytics cookies).

The constant, the parser (`parseVisitorLocaleCookie(header: string | null): string | null`) and the attribute set live in one
module, `src/lib/i18n/visitor-locale.ts`, so the writer, the reader and the sign-up seeding cannot disagree about the name. It is
pure and imports nothing server-only.

### Setting it (09-S5a)

One server function in `src/server/fns/locale.ts`, beside `negotiateRequestLocale` (that file is the single owner of "which language
this request speaks"):

```ts
export const saveVisitorLanguage = createServerFn({ method: 'POST' })
  .validator(z.object({ locale: localeSchema }))   // the 23-tag z.enum; no '' here, there is nothing to clear
  .handler(async ({ data }) => { setCookie(...); return { locale: data.locale } })
```

- It needs no session and writes no row. It is a POST, so the CSRF middleware in `src/start.ts` applies unchanged.
- `saveLanguagePreference` (`src/routes/_app/-server/settings.ts`) additionally sets the same cookie to the language now **in
  force** after its write (the stored override, or the workspace default when the override was cleared), by calling an exported
  `writeVisitorLocaleCookie(locale)` from the same module. This is what keeps a signed-out screen in the language the person just
  chose in settings. It does not change that function's return value or its validator.
- A workspace-default change on `/settings/organization` does not touch the cookie. A person whose workspace default later changes
  may see the old language on the signed-out pages until their next explicit choice. That is accepted (Edge cases).

### The switcher (09-S5b)

One component, `LanguageSwitcher`, in `src/components/layout/language-switcher.tsx` (beside `theme-toggle.tsx`, which it
resembles: a trigger with a state-bearing accessible name and a `Popover` from `#/components/ui/popover`). It is presentational and
takes its save as a prop, like `LanguagePicker`; the route-level wrappers decide what saving means.

- **Trigger**: a globe icon and, from `sm`, the active language's native name (`localeDescriptor(locale).nativeName`); below `sm`
  the icon only. The accessible name is `shell.language.trigger`, interpolating the native name. Hit area at least 44px.
- **Panel**: the existing `LanguagePicker` with `label` = the existing `settings.language.label`. `followWorkspaceLabel` becomes
  **optional**; when it is absent the picker renders the twenty-three languages and no "follow the workspace" chip (a visitor has no
  workspace). Nothing else in the picker changes; its radio-group semantics, roving focus and pending state are reused as they are.
  Under the list, one line of hint text, `shell.language.hint`.
- **Commit**: `commitLanguage` (and `localeInForce`) are lifted, unchanged in behaviour, from
  `src/routes/_app/settings/-lib/language-commit.ts` to `src/lib/i18n/commit-language.ts` (it imports only types from
  `#/lib/i18n`), and its tests move with it. `/settings/language` imports it from the new place. The visitor path calls it with
  `save` = `saveVisitorLanguage` (mapped to `{ locale }`) and `workspace` = the language in force before the click. Its three
  outcomes keep their meaning: `rejected` (nothing changed; the picker keeps its selection; the existing
  `settings.language.saveFailed` / `saveFailedBody` toast), `switched` (the page is already speaking the new language) and `stale`
  (the cookie was written but the catalogue chunk failed; the existing `settings.language.reload.title` / `reload.body`).
- **After a successful switch** the popover closes, focus returns to the trigger (whose name now carries the new language), and a
  polite live region announces `shell.language.announce`. No toast: the page itself changing language is the confirmation, and a
  toast in the new language over a page that just re-rendered is noise.
- **Where it mounts**: `MarketingHeader` (`src/components/marketing/chrome.tsx`), between `ThemeToggle` and the sign-in link; and
  `AuthShell`'s header (`src/routes/(auth)/-ui/auth-shell.tsx`), beside `ThemeToggle`, at every width. It is **not** mounted inside
  the signed-in shell: there the settings screen owns the choice.
- **Re-render**: the root loader is re-run with `router.invalidate()` exactly as the settings picker does; `staleTime` stays
  infinite. A form half-filled on `/register` keeps its values (the route does not remount; only the catalogue and `<html lang dir>`
  change). A test proves it.

### Carrying the choice into the account (09-S5c)

Sign-up is the one moment where the language a person was reading and the language of the account they are creating can diverge.

- `databaseHooks.user.create.after` (`src/server/auth/index.ts`) already provisions the personal workspace. It reads the
  `planned.locale` cookie from the creating request's headers (`parseVisitorLocaleCookie`, then `resolveLocaleTag`) and, when the
  result is a shipped tag **other than `en`**, passes it as `ownerLocale` into `provisionPersonalOrganization` and on to
  `createOrganizationFor` (`src/server/auth/provisioning.ts`), which adds **one more statement to the same `db.batch`**: a
  `user_settings` row for `(new organization, new user)` with `locale` set. Atomic with the organization and the membership, so a
  failure leaves no half-seeded account.
- **Skipped when the creating request carries a session**: a platform admin creating an account from the console is not the new
  person, and their cookie must not decide the new person's language.
- **Only an explicit choice seeds.** The header alone does not: a Polish `Accept-Language` with no cookie gives no seeded row, as
  today. This is the narrower, more reversible reading; widening it later is one line. (Resolved assumption 6.)
- The workspace default (`organization_settings`) is not seeded: that row is an administrator's decision, it stays `en` until its
  owner changes it, and a workspace that later has other members must not take its founder's language by accident.
- **An existing account's stored language always wins.** Signing in never writes a setting from a cookie: a stale cookie on a shared
  device must not overwrite the next person's saved language. The cookie is simply ignored for a signed-in caller (the chain
  resolves at step one or two). A returning person on a new device who picks a language on the sign-in screen and then sees their
  saved one is the accepted cost; the picker in settings is one click away.

### Alternatives considered, and why they lost

| Alternative                                                       | Why not                                                                                                                                                                                                    |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mark 09-S5 `Delivered:` and drop the pre-sign-in choice           | Ships no slice; the row's own wiki sentence says "before and after signing in"; a 23-locale product whose sign-in screen cannot be read by a visitor whose browser is mis-set has a defect, not a non-goal |
| A language in the URL (`/pl/login`)                               | Changes the whole route tree and every link, canonical and share card; the cookie reuses the chain and the root loader unchanged                                                                           |
| `localStorage` plus a client re-render                            | The server renders `<html lang dir>` before first paint (SPEC §9 rule 3); a client-only choice is a locale flash and a hydration mismatch, the exact defect the rule forbids                               |
| A second, header-sized picker                                     | SPEC §9 rule 7 and the decomposition rule: one picker; the switcher hosts it                                                                                                                               |
| Overwrite an account's stored language from the cookie at sign-in | A stale cookie on a shared device would rewrite the next person's setting                                                                                                                                  |
| Seed from `Accept-Language` at sign-up as well                    | Wider than the row asks; a person who never chose is not told they did. Left as a one-line follow-up                                                                                                       |

## 📝 Architecture

| Concept                                                   | Owner module                                                                                       | Notes                                                                       |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| The chain (pure)                                          | `src/lib/i18n/negotiate.ts`                                                                        | gains `visitor`                                                             |
| The cookie's name, attributes, parser (pure)              | `src/lib/i18n/visitor-locale.ts` (new)                                                             | one definition for reader, writer and seeder                                |
| Which language this request speaks, and the cookie writer | `src/server/fns/locale.ts`                                                                         | `negotiateRequestLocale`, `saveVisitorLanguage`, `writeVisitorLocaleCookie` |
| The commit state machine                                  | `src/lib/i18n/commit-language.ts` (lifted)                                                         | one owner for settings and for the switcher                                 |
| The one picker                                            | `src/components/settings/language-picker.tsx`                                                      | `followWorkspaceLabel` optional                                             |
| The header control                                        | `src/components/layout/language-switcher.tsx` (new)                                                | hosts the picker; mounts in two shells                                      |
| Sign-up seeding                                           | `src/server/auth/provisioning.ts` (`createOrganizationFor`), `src/server/auth/index.ts` (the hook) | one statement in an existing batch                                          |

Dependencies: none added (SPEC §3 freeze holds). `components/ui` is untouched except for reading `Popover`; the switcher is in
`components/layout` and does not import from `server/`; the route-level wrappers pass the server function in.

## 📝 Data Model

**No schema change and no migration.** The cookie is not stored. The seeded `user_settings` row uses the existing table and the
existing nullable `locale` column. `user_settings` and `organization_settings` are tenant-scoped; the seed writes into the
organization created in the same batch for the user created in the same request.

## 📝 API Contracts

| Function / hook                                           | Input                                                                  | Output                                                   | Auth                       |
| --------------------------------------------------------- | ---------------------------------------------------------------------- | -------------------------------------------------------- | -------------------------- |
| `saveVisitorLanguage` (new, POST)                         | `{ locale }`, the 23-tag `z.enum`; anything else is a validation error | `{ locale }`; sets `planned.locale`                      | none (anonymous allowed)   |
| `saveLanguagePreference` (existing)                       | unchanged                                                              | unchanged; also sets the cookie to the language in force | session, as today          |
| `negotiateRequestLocale` (existing, GET)                  | none                                                                   | `{ locale, dir }`                                        | reads the cookie as step 3 |
| `negotiate({ user, workspace, visitor, acceptLanguage })` | `visitor` new, optional                                                | a shipped tag                                            | pure                       |
| `createOrganizationFor(..., { ownerLocale? })`            | `ownerLocale` new, optional                                            | unchanged                                                | auth hook only             |

## 📝 UI/UX

- The control is a **chrome control, quiet by default**: ghost icon-button styling like the theme toggle, same height, same focus
  ring, no new colour or token.
- The popover holds a 23-item radio group. It is the settings picker's own chip grid, so the arrow-key roving, `aria-checked`,
  pending spinner and native-script labels (`lang` attribute per chip, `dir` per script) are inherited, not rebuilt. It scrolls
  inside the popover when the viewport is short (360x640 landscape); at 360px wide it is a single column that fits the safe area.
- Below `sm` the trigger is the icon alone with the full accessible name; the visible text is dropped, not truncated.
- `prefers-reduced-motion`: the popover's open animation uses the existing popover tokens, which already honour it.
- **Right-to-left**: the trigger is first in the DOM order of the control group and sits at the end edge in `ar`; the popover
  `align="end"` is a logical alignment. No `left`/`right` utilities are introduced (SPEC §9 rule 4).
- The hint line is plain text under the grid, not a tooltip.

## 📝 Copy

New keys, all in the `shell` namespace, `en` text below. The implementation lands each key in all 23 locales in the same change
(`i18n-messages` skill, parity test). The picker's label and the three outcome sentences reuse existing `settings.language.*` keys
and are not new.

| Key                       | `en`                                                                                                           |
| ------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `shell.language.trigger`  | `Language: {language}. Change language`                                                                        |
| `shell.language.hint`     | `Remembered on this device. An account that already has a language of its own uses that one once you sign in.` |
| `shell.language.announce` | `Language changed to {language}`                                                                               |

`{language}` is the native name of the language, interpolated as an already-formatted string (SPEC §9 "Numbers inside messages"
applies to numbers only; names are data from `localeDescriptor`). Privacy page text is English by design (rule 8) and is not a
catalogue key.

## 📝 Edge Cases & Failure Scenarios

| Case                                                                   | Behaviour                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cookie holds an unshipped tag, free text, `__proto__`, or is over-long | Treated as absent; the chain falls to `Accept-Language`, then `en`. Never throws, never reaches the `Locale` type unvalidated                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| `saveVisitorLanguage` rejects (network, 4xx)                           | `rejected`: the picker keeps the previous selection and the page keeps its language; the existing "was not changed" toast                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Cookie written but the new catalogue chunk fails to load               | `stale`: the saved-but-not-switched sentences with a reload action, as in settings                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Cookies blocked in the browser                                         | The POST succeeds, the next request carries no cookie, the page stays in the header language. The switcher cannot know; this is the platform's behaviour and the same as any cookie preference. No error is invented                                                                                                                                                                                                                                                                                                                                                 |
| Signed-in person opens a marketing page                                | The chain resolves at the stored settings; the cookie is ignored; the switcher is present on the marketing header and its change writes the **cookie only** — it would not change their account, which the next signed-in request ignores the cookie for. To avoid a control that appears to work and does not, the marketing header shows the switcher **only to signed-out visitors** (the header already knows the session state used for its sign-in link; if it does not, the root loader supplies `signedIn`). A signed-in person changes language in settings |
| Signed-out screen after a settings change                              | Shows the language in force at the last explicit save (cookie rewritten by `saveLanguagePreference`)                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Workspace default changes later                                        | Cookie is not touched; accepted drift on signed-out pages only                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| Two tabs                                                               | The second tab re-reads the cookie on its next navigation or `invalidate`; no cross-tab broadcast                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| Half-filled `/register` form, then a language change                   | Values kept; validation messages re-render in the new language on the next validation                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Sign-up through Google/Apple                                           | The callback request carries the cookie (top-level GET, `SameSite=Lax`) and seeds the same way; an unresolved cookie seeds nothing                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| Admin creates an account from the console                              | The request carries a session: no seeding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| Sign-up hook runs twice (retry)                                        | `provisionPersonalOrganization` is already idempotent for an existing membership; the seed rides inside the creating batch only, so a retry adds nothing                                                                                                                                                                                                                                                                                                                                                                                                             |
| `ar` chosen                                                            | `<html dir="rtl">` on the next render; the control and popover mirror                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

## ✅ Acceptance criteria

**09-S5a**

1. `negotiate()` orders user, workspace, visitor, `Accept-Language`, `en`; unit tests cover each step winning and each falling
   through, including an unshipped visitor value and `constructor` / `__proto__`.
2. An anonymous request with `planned.locale=pl` and `Accept-Language: de` renders `<html lang="pl">`; the stored-settings read is
   not called (injected-source test proves it).
3. A signed-in caller with a stored language is unaffected by the cookie.
4. `saveVisitorLanguage` rejects a tag outside the twenty-three and `''`; accepts each shipped tag; sets the cookie with exactly
   the attributes in the table (header assertion), and writes no database row.
5. `saveLanguagePreference` sets the cookie to the language in force, including after the override is cleared (the workspace
   default is then the cookie's value).
6. `docs/SPEC.md` §9 rules 3 and 7 are amended in the same PR; `CONTEXT.md` gains **Visitor language**; the privacy page cookie
   list gains one sentence. The grep for the changed terms (below) finds no document still saying the chain has four steps or
   that the picker is settings-only.

**09-S5b**

7. The switcher renders in `MarketingHeader` (signed-out only) and in `AuthShell`'s header at 360, 1280 and 2560px; it is absent in
   the signed-in shell.
8. Choosing a language re-renders the page in it without a full reload, sets `<html lang dir>`, keeps `/register` form values, and
   survives a reload.
9. `LanguagePicker` renders no "follow the workspace" chip when `followWorkspaceLabel` is omitted and renders it unchanged when
   given; the existing picker tests pass untouched.
10. `commitLanguage` is imported from `src/lib/i18n/commit-language.ts` by both consumers and its tests moved with it, no behaviour
    change.
11. Keyboard: Tab reaches the trigger in header order; Enter/Space opens; arrows move within the group; Escape closes and returns
    focus to the trigger; the trigger's name carries the active language; the live region announces the change once.
12. `ar`: the control and popover mirror; no physical-direction utility is introduced.
13. The three `shell.language.*` keys exist in all 23 locales; the parity test passes.

**09-S5c**

14. A sign-up with `planned.locale=pl` creates a `user_settings` row for the new `(organization, user)` with `locale = 'pl'`, in
    the same batch as the organization and membership; with no cookie, with `en`, or with an unshipped value, no row is written.
15. A sign-up request that carries a session does not seed.
16. Signing in to an existing account never writes `user_settings`.
17. Tenant isolation: the seeded row's `organization_id` is the organization created in that batch, and a test shows no other
    organization's settings are read or written.

## 📝 Risks & Impact Review

| Risk                                                                      | Severity | Mitigation                                                                                                                                                                                                                |
| ------------------------------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Cookie value reaches the `Locale` type unvalidated                        | medium   | One parser plus `resolveLocaleTag`; property-style tests with prototype names and long input                                                                                                                              |
| Sign-up hook change breaks account creation                               | high     | The seed is one extra statement inside an existing batch; guarded by "result is a shipped tag other than `en`"; a throwing parse falls to "no seed"; hook tests cover it. Risk-high label on 09-S5c (authentication path) |
| An admin's cookie seeds another person's account                          | medium   | Skip when the request has a session; test                                                                                                                                                                                 |
| Shared cache serves one visitor's language to another                     | medium   | The root route already sends `vary: accept-language, cookie` (`__root.tsx`); an assertion pins it so the cookie step cannot ship without it                                                                               |
| Header control that does nothing for a signed-in person                   | low      | Rendered for signed-out visitors only                                                                                                                                                                                     |
| Hydration mismatch from a client-chosen language                          | medium   | Language is decided by the server from the cookie; the client only re-runs the loader                                                                                                                                     |
| Files owned elsewhere: `__root.tsx`, 09-S8's settings shell, SPEC §9 text | low      | `__root.tsx` is not edited (the loader already calls `negotiateRequestLocale`); `/settings/language` gets an import-path change and nothing else; SPEC §9 is amended in the same PR with its own paragraph                |

### Out of scope

- Seeding a language from `Accept-Language` at sign-up; the create-workspace dialog seeding a workspace default; a workspace's
  default language for guests.
- `user_settings` being per workspace rather than per person (a language chosen in one workspace is not carried to another): a
  pre-existing property of the table, noted here so it is not mistaken for this stage's defect. A follow-up for a person-level
  language is for a product decision.
- Translating `src/routes/legal/**` prose.
- Any change to the runtime, catalogues, formatter, or right-to-left layout (done).

### Blockers

None. The plan's two blockers are resolved by the existing implementation (SPEC §9 is the decision; `src/lib/i18n/` is the build).

### Reference-row disposition

`ACC-06` moves **partial → done** when 09-S5b is merged (09-S5a and 09-S5c complete the picture). Nothing in `gap-rows.json`
depends on it.

## 📋 Phasing

| Ticket | Slice                                                                             | Depends on | Risk      |
| ------ | --------------------------------------------------------------------------------- | ---------- | --------- |
| 09-S5a | cookie, negotiation step, `saveVisitorLanguage`, settings save rewrites it, docs  | none       | risk-low  |
| 09-S5b | lift `commitLanguage`, picker optional chip, `LanguageSwitcher`, two mounts, copy | 09-S5a     | risk-low  |
| 09-S5c | sign-up seeding                                                                   | 09-S5a     | risk-high |

Each ticket is a full path: 09-S5a from the header to a rendered `<html lang>` under a test; 09-S5b from a click to a re-rendered
page; 09-S5c from a request with a cookie to a row.

## 📋 Implementation Plan

### Phase 1 - the visitor's language (09-S5a)

1. `src/lib/i18n/visitor-locale.ts` (name, attributes, `parseVisitorLocaleCookie`); `negotiate` gains `visitor`; tests.
2. `src/server/fns/locale.ts`: `visitorLocale` source member, `saveVisitorLanguage`, `writeVisitorLocaleCookie`; tests with an
   injected source.
3. `saveLanguagePreference` rewrites the cookie to the language in force; test.
4. `docs/SPEC.md` §9 rules 3 and 7; `CONTEXT.md` **Visitor language**; the privacy page cookie sentence; an assertion that the root
   route's `vary` includes `cookie`.

### Phase 2 - the switcher (09-S5b)

1. Lift `commitLanguage` / `localeInForce` and their tests; update `/settings/language`'s import.
2. `LanguagePicker`: `followWorkspaceLabel` optional; test both shapes.
3. `LanguageSwitcher`, the three `shell.language.*` keys in 23 locales.
4. Mount in `MarketingHeader` (signed-out) and `AuthShell`; journey; frames.

### Phase 3 - carry it into the account (09-S5c)

1. `createOrganizationFor` `ownerLocale` (one statement in the batch); `provisionPersonalOrganization` passes it.
2. The hook: parse the cookie, skip with a session, pass the tag; `provisioning.test.ts` cases.

## Verification

- The gate in `validation.commands` (`.ai/agentic.config.json`) on each ticket's last commit.
- **Server** (`server` project): negotiation order and fall-through; `saveVisitorLanguage` validation, cookie header attributes and
  no D1 call (a server module that reaches `cloudflare:workers` is tested through its injected source or with the bindings mocked,
  per `AGENTS.md`); `provisioning.test.ts` for the seed, the session skip and idempotence; a tenant-isolation case in
  `src/server/repos/__tests__/tenant-isolation.test.ts` is **not** appended (no repository function is added; the seed goes through
  the auth batch) and the isolation of the seeded row is asserted in `provisioning.test.ts` instead.
- **Unit** (`ui` project): `LanguageSwitcher` (open, select, pending, rejected, stale, focus return, live region); `LanguagePicker`
  both shapes; `commitLanguage` (moved tests).
- **E2E** (one journey in `e2e/journeys.spec.ts`; routing and sessions are what ADR 0016 admits): anonymous `/login` with
  `Accept-Language: en`, choose `Polski`, the heading is Polish and `<html lang="pl">`, a reload keeps it, `/register` is Polish,
  sign-out after a settings change keeps the settings language. `watchConsole` attached before navigation. No `toHaveScreenshot`.
- **Review evidence**: the blind A/B pair from `scripts/visual/capture.mjs` at 360x800, 1280x900 and 2560x1440 in light and dark for
  `/`, `/login` and the open popover, plus `ar`; a keyboard and screen-reader pass over the trigger and the group.
- Docs and CI: the terms searched before each PR are "Accept-Language", "negotiat", "language picker", "settings-only", "planned.locale",
  "cookie", "Cookies and browser storage", "visitor". At spec time: `docs/SPEC.md` §9 rules 3 and 7, the privacy page, `CONTEXT.md`
  and the plan itself (`docs/plans/09-account-and-settings.md` 09-S5 stays BLOCKED text until the stage is delivered; the final
  ticket's PR adds the `Delivered:` line).

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                         | Applied default                                                                                                                                   | Why                                                                                                                                                                                                                    |
| --- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | The stage is marked BLOCKED and owns no files. Mark it delivered, or spec a gap? | Spec the one missing behaviour (a language choice before sign-in) and nothing else; the other three ACC-06 behaviours are cited as done           | Decided by product owner sub-agent (confidence medium): the row's own wiki sentence says "before and after signing in"; `grep` finds no control outside signed-in settings; the plan forbids re-specifying what exists |
| 2   | Where the cookie sits in the chain                                               | After the stored settings and before `Accept-Language`; for a signed-in caller it never decides                                                   | Decided by product owner sub-agent (confidence medium): `organization_settings.locale` is `NOT NULL DEFAULT 'en'`, so the header step is reached only by anonymous requests                                            |
| 3   | What "carried into the account" means                                            | Seed the new personal workspace member's `user_settings.locale` at sign-up; an existing account's stored language wins and sign-in writes nothing | Decided by product owner sub-agent (confidence medium): a stale cookie on a shared device must not overwrite the next person's saved setting                                                                           |
| 4   | One picker and one commit path                                                   | The switcher hosts `LanguagePicker`; `commitLanguage` is lifted to `src/lib/i18n/commit-language.ts`; `followWorkspaceLabel` becomes optional     | Decided by product owner sub-agent (confidence medium): SPEC §8 "one concept, one owner"; a second control would be two writers of one concept                                                                         |
| 5   | The SPEC amendment                                                               | The same PR as 09-S5a amends `docs/SPEC.md` §9 rules 3 and 7, adds a glossary entry and a privacy-page sentence                                   | Decided by product owner sub-agent (confidence medium): without it the code contradicts the contract                                                                                                                   |
| 6   | Seed from an explicit choice only, or also from `Accept-Language`                | Explicit choice only (the cookie); the header alone seeds nothing                                                                                 | Applied default: the narrower and more reversible reading, one line to widen; a person who never chose is not told they did                                                                                            |
| 7   | Seed the workspace default too                                                   | No; only the person's own row                                                                                                                     | Applied default: the workspace default is an administrator's decision and a workspace with later members must not take its founder's language by accident                                                              |
| 8   | Cookie flags and storage                                                         | `HttpOnly`, `Secure` (non-dev), `SameSite=Lax`, `Path=/`, 365 days; no `localStorage` copy                                                        | Applied default: nothing in the browser needs to read it, the root loader is the source of truth; a functional preference cookie, same class as the theme preference                                                   |
| 9   | Signed-in people on marketing pages                                              | The switcher renders for signed-out visitors only                                                                                                 | Applied default: for a signed-in caller the cookie is ignored, so a control that writes it would appear to work and not                                                                                                |
| 10  | A success toast for a visitor's switch                                           | None; a polite live region announces it                                                                                                           | Applied default: the page re-rendering in the new language is the confirmation                                                                                                                                         |
| 11  | The admin-created account                                                        | Seeding is skipped when the creating request carries a session                                                                                    | Applied default: the console admin's cookie is not the new person's choice                                                                                                                                             |
