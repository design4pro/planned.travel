# The handbook, inside the product

| Field              | Value                                         |
| ------------------ | --------------------------------------------- |
| **Status**         | ready                                         |
| **Issue**          | none                                          |
| **Spec PR**        | #1175                                         |
| **Implementation** | none                                          |
| **Plan**           | 09-S6 (docs/plans/09-account-and-settings.md) |

## 📝 TLDR

Plan stage `09-S6` (`docs/plans/09-account-and-settings.md`, reference row `EXT-04`) puts a handbook inside planned.travel: a
reading surface at `/help` and `/help/{slug}` with a sidebar that mirrors the table of contents, a filter that narrows it by title,
navigation between articles without a document load, and stable anchors so a shared link lands on its section. It is reachable from
the account menu on every screen. Nothing of it exists today: no `/help` route, no article, no menu entry.

The plan's design is sound and is kept: **articles are typed TypeScript, not parsed markdown.** A discriminated union of content
blocks, each carrying a `settings.help.*` message key, gives the compiler the job a renderer and a sanitiser would otherwise do at run
time, so this stage mints no markdown renderer and adds no dependency. Checked against the repository, the plan is wrong in five places
that matter and this spec corrects them (Problem Statement): its visual gate and capture tooling no longer exist (ADR 0016); the
catalogue has eleven namespaces, not ten; the "code-split away from every other screen" claim holds for the structure module but not
for the prose, which travels in every document's dehydrated message bag; the translations are written in the same change, not by a
later translation run; and several features an account article would describe are specified but not built.

Built in eight tickets, in this order (each blocked by the one before, see Phasing):

1. **The shell and the content model, with one real article** ("Getting started"): routes, sidebar, title filter, the 360px contents
   sheet, states, the block renderer, the account-menu entry, the journey.
   Then, one ticket each and in this order: planning a trip day by day; money and who owes what; packing lists; sharing a trip; your
   account and security; keyboard shortcuts; and last, plans and billing together with the stage's close (the plan's `Delivered:`
   line).

Every article ticket writes its prose, the blocks that render it and its translations into all 23 locales in one change. An article
describes only what the code at its ticket's base does; features that are specified but not yet built are listed in **Pending
paragraphs** and are added by follow-up issues, never promised in the text.

## 📝 Visual change expected

| Route / state                      | Change                                                                                                                                                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Account menu (every `_app` screen) | One new entry, "Handbook", between Billing and the admin entries                                                                                                                                                                 |
| `/help`                            | New. Page header, the contents sidebar with a title filter, the overview of articles; below `lg` the filter sits inline above the cards. On an article, at 360px, the contents become a sticky "Contents" button opening a sheet |
| `/help/{slug}`                     | New. One article in a 68-character measure; headings with a section-link affordance (always visible without hover); blocks: paragraph, list, steps, callout, shortcut, link                                                      |
| `/help` filter with no match       | New. `EmptyState` "Nothing matches that" with a "Clear search" action                                                                                                                                                            |
| `/help/{unknown}`                  | New. A handbook not-found panel (title, body, "Back to the handbook") in the app frame, without the sidebar                                                                                                                      |
| Route pending and error            | New. A skeleton at final heights; `ErrorPanel` "The handbook did not load"                                                                                                                                                       |
| Any of the above in `ar`           | Mirrors: sidebar on the right, anchor affordance at the heading's end, directional icons mirror                                                                                                                                  |

Light and dark, 360px, 1280px and 2560px, per ADR 0016 (the blind A/B pair from `scripts/visual/capture.mjs`, no baselines). Declared
non-resting states: the contents sheet open at 360px, the empty filter, an anchor affordance hovered and its "copied" state.

## 📝 Problem Statement

### What a person meets today

A traveller who wants to know what "Settle up" does, who an editor is, or why a trip will not take a fourth member has nowhere to read it
in the product. `docs/` holds the specification and architecture notes, which are for builders. The one place the product explains itself
is a tooltip or a hint on the screen it belongs to, which cannot say how the screens fit together.

### The plan's claims, checked against the repository

| Plan says                                                                                                                                                                                | Repository today                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No `/help` route exists and `docs/` has no renderer                                                                                                                                      | **True.** `src/routes/_app/` has `settings/`, `trips/`, `collections/`, `journey/` and no `help/`. `grep -rn "'/help"` over `src` finds nothing.                                                                                                                                                                                                                                                                                      |
| `EXT-04` is among five rows blocked on a markdown renderer (`11-boundaries-and-blockers.md`, entry 5); typed blocks remove the need                                                      | **True, and the entry is left stale by this stage.** Nothing in `src/` renders markdown. Typed blocks need no renderer, so entry 5's blocked list is four rows. Ticket 1 amends the table row and the entry (Phasing).                                                                                                                                                                                                                |
| Verification: `e2e/account-and-settings.visual.spec.ts`, `./helpers/shoot.ts`, `scripts/ultrabuild/capture.mjs`, `--update-snapshots` baselines, `auditServerClock`, `maxDiffPixelRatio` | **Gone (ADR 0016).** `e2e/` has `journeys.spec.ts` and per-module specs; `e2e/helpers/` has `routes.ts`, `console.ts`, `settle.ts`, `session.ts`; there is no `shoot.ts`, no `scripts/ultrabuild/`, no baselines. The capture script is `scripts/visual/capture.mjs`. See Verification for what replaces it.                                                                                                                          |
| "ten English namespace files"; `MessageKey` narrowed to `settings.help.${string}` works                                                                                                  | **Eleven** namespaces (`src/lib/i18n/types.ts`), all present; the narrowing is valid because settings keys are qualified `settings.<key>`.                                                                                                                                                                                                                                                                                            |
| The handbook's copy is "code-split away from every other screen"; the only cost is bundle size against a 10 MB Worker ceiling                                                            | **Only the structure module is.** `mergeLocale()` (`src/lib/i18n/catalogue.ts`) merges every namespace of the active locale, and the root `loader` (`src/routes/__root.tsx:84-91`) returns that whole bag, dehydrated into every SSR document. The merged English bag is ~200 KB as JSON (50 KB gzip); 25-35 KB of prose adds 13-18% to every first document load, in every locale. The real cost is payload, not the Worker ceiling. |
| English-side stages must not write `messages/<tag>/`; a later translation run supplies them                                                                                              | **Stale.** `AGENTS.md` and the `i18n-messages` skill require every key in all 23 locales in the same change; `parity.test.ts` fails otherwise.                                                                                                                                                                                                                                                                                        |
| Eight articles describe the product as it is                                                                                                                                             | **Not all of it is built.** Passkeys, turning on two-factor from settings, the trip invite link, installing the app and language-before-sign-in are specs with `Implementation: none`; password, email and deletion (09-S3) has no spec yet.                                                                                                                                                                                          |
| `Kbd` components, `Alert` with `info`/`warning`, `Sheet`, `ScrollArea`, `EmptyState`, `Skeleton`, `PageHeader`, `AppFrame`, `AppSections`, `ErrorPanel` exist                            | **True** (`src/components/ui/*`, `src/components/layout/{app-frame,page-header,not-found,error-state}.tsx`). `RouteError` is settings-local; the help route uses `ErrorPanel` directly.                                                                                                                                                                                                                                               |
| `settings-nav.tsx:26-40` types `to` as a literal union against the route tree                                                                                                            | **True** (`SettingsSectionLink.to`). `HelpLinkTarget` copies the pattern.                                                                                                                                                                                                                                                                                                                                                             |
| `coverage.test.ts` is not mentioned                                                                                                                                                      | **Binding.** It fails when a catalogued key has no whole-literal reader in `src` (`DEAD_KEYS = 9`). A block that spells the full `'settings.help.x'` literal is a reader; computing a key is not.                                                                                                                                                                                                                                     |

## 📝 Proposed Solution

### What the stage owns and what it does not

Owns: the `/help` routes and their content and UI modules, the `settings.help.*` block of the catalogue (English and the 22 translations),
the account-menu entry, one journey, one edit of `docs/plans/11-boundaries-and-blockers.md` and the stage's `Delivered:` line. Does not
own: a markdown renderer (none is minted), any repository, server function, table or migration, any other stage's spec or screen.

### The content model

```ts
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

A block carries a key, never a sentence, so every article is translated by the ordinary mechanism and a mistyped or unauthored key is a
`pnpm typecheck` failure. `HelpLinkTarget` is a union of param-free literal route paths plus `{ article: HelpSlug; anchor?: string }`, so a
cross-reference is type-checked. `keys` on a `shortcut` are what is printed on the cap (`Esc`, `Shift`, `Enter`) and are not translated
(the rule `src/lib/i18n/messages/en/ui.ts` already states). `anchor` is a URL fragment: a lowercase hyphenated slug of the heading's
**English source text**, stored beside the heading, so a shared link survives a copy edit that only changes capitalisation and is the same
fragment in every language. A test derives it and asserts it.

`-content/articles.ts` spells every key as a whole `'settings.help.…'` literal. That is what `coverage.test.ts` counts as a reader, and it
is why the structure module and the catalogue cannot drift apart without a red test.

### Where the prose lives (Resolved assumption 1)

All handbook copy - chrome and prose - lives under the single prefix `settings.help.` in `messages/<locale>/settings.ts`, in all 23
locales, authored one article per ticket. A twelfth namespace, an English-only handbook and a lazily loaded catalogue slice were
considered and rejected for now: the first changes the shared runtime and `docs/SPEC.md` §9, the second breaks §9 rule 6 for 22 locales,
and the third is a larger change than the cost justifies today. The decision is reversible by a rename of one prefix, and its trigger is
recorded as a **payload budget**: the implementation PR of tickets 1 and 8 measures the merged bag as JSON (raw and gzip) for `en` and
`ja`, and if `help` keys add more than **20%** to either, the PR files an issue to move the prefix into a lazily loaded `help` namespace
(a SPEC §9 amendment) instead of widening the budget.

### Routes

`src/routes/_app/help/route.tsx` (the frame: the contents beside an `<Outlet />`, and `notFoundComponent`), `index.tsx` (`/help`, the
overview) and `$slug.tsx` (`/help/{slug}`; the loader looks the parameter up in the slug index and throws `notFound()` on a miss, so an
arbitrary string never renders an empty article). **`pendingComponent` and `errorComponent` are declared on the two leaf routes**, as
`settings/*.tsx` and `console/*.tsx` do: a pending child never renders its parent's `pendingComponent` (TanStack uses
`route.options.pendingComponent ?? router.options.defaultPendingComponent`, and `src/router.tsx` sets no default), and a child match in
the error state with no `errorComponent` of its own renders the generic one, not the layout's. `notFoundComponent` stays on the layout; it
replaces the layout's content, so the not-found state has no contents beside it (the same as `settings/route.tsx`). It is a handbook panel
(`EmptyState` with `settings.help.notFound.*` keys and a "Back to the handbook" action), not `NotFoundPanel`, whose body talks about a moved
or deleted trip and whose only actions are the dashboard and the trips list.

**Page structure.** `/help` renders the `PageHeader` (the only `<h1>`: "Using planned.travel"); `/help/{slug}` renders no `PageHeader` and
the article title is its only `<h1>`, so a phone reader does not open every article under the same repeated header. Both routes set a
route `head` title from the translated title (WCAG 2.4.2); if the shell has no seam for a translated title (every `_app` route inherits the
root `TITLE` today), ticket 1 files the app-wide gap as one issue and references it rather than adding nine more pages with the same title. `src/routeTree.gen.ts` is
regenerated with `pnpm generate-routes`, never edited. Default SSR; the content is in the bundle so the first paint is complete.
Navigation between articles uses `<Link>`: a client transition, no document load. The route is under `_app`, so a signed-out visitor
lands on `/login`; there is nothing tenant-specific in it and no `TenantScope` is taken.

### The sidebar and the filter

The contents are **one flat ordered list** (eight articles do not need groups, and the article type has no section field), in a
`<nav aria-label>` named by `settings.help.contents.label` and distinct from the app navigation; the current article carries
`aria-current="page"`. Above it, a `role="search"` landmark holds a labelled `Input` that filters **by title only** - the scope a reader can predict - over the **rendered** (translated) titles, using the
locale's own case folding (`toLocaleLowerCase(locale)`) and Unicode decomposition with combining marks stripped, so `uber` finds "Über" and
`istanbul` finds "İstanbul". Debounce 150 ms; the result count is announced through an always-mounted `aria-live="polite"` region (so its
first change is announced); Escape clears and "Clear search" clears, and both return focus to the input. The filter state is component
state, not a URL parameter. On `/help` the filter narrows the overview cards as well as the contents, and **below `lg` it renders inline above the cards** (search landmark, count region and empty state included), since `/help` has no Contents button.

**Below `lg`** the contents are not a squeezed column. On `/help/{slug}` a "Contents" button, sticky below the top navigation so it stays
reachable at the foot of a long article, opens a `Sheet` (`side="start"` through `useSheetDirection`, never a physical edge) whose
`SheetTitle` is `settings.help.contents` and which carries a description or `aria-describedby={undefined}` (Radix warns in the console
otherwise, and the console must stay silent). `/help` shows no Contents button: its cards already are the contents. Choosing an article in
the sheet closes it and moves focus to the new article's `<h1>` (not back to the button); on desktop focus stays on the chosen link.
**Escape in the sheet:** Radix registers Escape on the document in the capture phase, so the input's own handler never runs first;
`SheetContent` therefore sets `onEscapeKeyDown` to `preventDefault()` while the filter has text, the first Escape clears the filter and
returns focus to the input, and the next closes the sheet. A unit test proves the order.

### The article

One column at a 68-character measure; `--font-display` headings, `--font-ui` body. `steps` is an ordered list with `tabular-nums`. Details that are accessibility contracts, not styling:

- **Headings and deep links.** Each heading carries its `id`, `tabIndex={-1}` and
  `scroll-mt-[calc(var(--nav-h)+var(--impersonation-h))]`, plus below `lg` the height of the sticky Contents bar (published as `--help-contents-h`) (there is no global `scroll-padding-top`; `legal.tsx` is the precedent), and every
  focusable element in an article carries the same offset so Shift+Tab does not park focus under the sticky header. On a client
  transition to `#anchor`, focus moves to that heading.
- **The section-link affordance** is an `<a href="#{anchor}">` placed beside the heading text, not inside it, so a headings list reads only the
  heading. Its name includes the section: `settings.help.anchor.copy` is "Copy link to {section}". It is visible at rest wherever there is no
  hover (`(hover: none)`, and below `lg`), is at least 24x24 CSS px, and sits at the inline end (so in `ar` at the left). Activating it
  updates the address bar to the fragment and copies the URL; "Link copied" is announced through an always-mounted polite region and the
  affordance shows a check for two seconds; a clipboard failure announces `settings.help.anchor.failed` instead. It does not reuse
  `CopyValue` (`src/components/modules/shared/controls.tsx`), whose label is hardcoded English.
- **`callout`** renders `Alert` with `role="note"` and `aria-live="off"` (Alert makes `info` and `warning` live regions by default, and an
  article mounting on a client transition would be read out); `create-workspace-dialog.tsx` is the precedent for the override.
- **`shortcut`** renders one `Kbd` per key with the key name as text and a visible separator that is not `aria-hidden`. It does **not** use
  `KbdSequence`, whose glyph map turns `Shift`/`Enter` into symbols with no text name. A unit test asserts the accessible text contains
  "Shift" and "Enter".
- Each article ends with a "Next: {title}" link when another article follows (`settings.help.next`). **Images are not in the block union**: screenshots of a product in development are stale within a week, and the `steps`,
  `shortcut` and `callout` blocks cannot go out of date silently. A `figure` member and `public/help/` are a later decision.

### States

- **Empty:** the filter matched nothing - `EmptyState` on `--color-surface-2`.
- **Skeleton:** each leaf route's `pendingComponent`, sidebar rows and three paragraph bars at the article's measure and final heights. The
  loaders are synchronous over static content, so a unit test, not an e2e assertion, covers it.
- **Error:** each leaf route's `errorComponent` renders `ErrorPanel` titled by `settings.help.error`. An unknown slug is `notFound()`, not
  an error.
- **Not found:** the layout's `notFoundComponent` (above).

Motion: a 220 ms cross-fade between articles on `--ease-out-quint`, and a row stagger of 20 ms steps capped at eight rows with a 160 ms row
duration (seven steps plus the duration stay under 400 ms), opacity and transform only. Under `prefers-reduced-motion: reduce` the global
rule (`src/styles/styles.css`) removes the animation, so the end state is shown at once; a transform is opted in with
`data-motion-transform` as elsewhere.

### The articles, and the rule that keeps them true

The eight slugs, titles and level-2 headings are fixed here so each ticket has a contract; the paragraphs under them are written against the
code at that ticket's base. **The rule (Resolved assumption 2):** an article describes only what the code at its ticket's base does. Each
article PR carries a list mapping every claim to the `path:line` or screen that proves it, and review checks that list. An article never
mentions a missing feature: no "coming soon", no callout about it, no heading with nothing under it. Vocabulary is `CONTEXT.md`'s, including
its _Avoid_ lines (a reservation is not "a booking"; a stay is not "accommodation"); nothing is carried across from any other product's
documentation, in wording or structure.

| #   | Slug                         | Level-2 headings (anchor = slug of the English text)                                                         | Written against                                                                                |
| --- | ---------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| 1   | `getting-started`            | Your workspace and your trips · Starting a trip · Finding your way around · Where to go next                 | `src/components/layout/nav-model.ts`, `user-menu.tsx`, the trips list                          |
| 2   | `planning-a-trip-day-by-day` | Days and stops · Adding a place · Moving things between days · Notes · Reservations and transport in the day | `src/routes/_app/trips/$tripId/plan.tsx`, `-ui/plan-screen.tsx`                                |
| 3   | `money-and-who-owes-what`    | Recording an expense · Splitting it · Currencies · Settling up · Who can change costs                        | `costs.tsx`, `-costs/`, `CONTEXT.md` (Budget currency, Settlement)                             |
| 4   | `packing-lists`              | Packs and to-dos · Ticking things off · Copying a trip                                                       | `lists.tsx`, `CONTEXT.md` (Pack, Trip copy)                                                    |
| 5   | `sharing-a-trip`             | Trip members and their roles · Guests · Who can see a trip · Leaving a trip                                  | `people.tsx`, `-ui/people-screen.tsx`, `CONTEXT.md` (Trip member, Visibility)                  |
| 6   | `your-account-and-security`  | Your profile · Language, appearance and notifications · Signing in and security · Your workspace             | `src/routes/_app/settings/{index,security,language,appearance,notifications,organization}.tsx` |
| 7   | `keyboard-shortcuts`         | Writing in a conversation · Moving things in the planner · The map and its lists                             | see the shortcut list below                                                                    |
| 8   | `plans-and-billing`          | Reading your plan and its limits · Changing plan · Managing payment                                          | `settings/billing.tsx`, `src/lib/plans.ts`                                                     |

The tenant-facing keyboard shortcuts that exist at HEAD, and the whole list for article 7: in a conversation thread `Enter` sends,
`Shift`+`Enter` adds a line, `Esc` cancels an edit or a reply (`src/components/modules/collab/thread.tsx`); in the planner `Esc` first
cancels a pick in progress and then clears the selection (`plan-screen.tsx`), and a keyboard drag is armed and dropped from the keyboard
(`planner-map-layer.tsx`, `src/components/planner/__tests__/keyboard-drag.test.tsx`); in the atlas countries list and the map filter bars the
arrow keys, `Home`, `End` and, in the countries list, `PageUp`/`PageDown` move (`src/components/atlas/countries-list.tsx`,
`src/components/map/use-roving-focus.ts`). No global shortcut and no command palette exists and none is invented; the operator-only
impersonation shortcut stays out; standard combobox and calendar keys are not presented as product shortcuts. The ticket re-greps the
handlers and lists what it finds.

Article-specific limits: **Plans and billing** describes how to read the plan, change it and manage payment in the product, with no
prices, refund or cancellation terms and no promise about tax or invoices (the billing screen is the only place figures appear; a
commercial statement a ticket thinks it needs goes to a person and the ticket proceeds without it). **Your account and security**
describes what `security.tsx` does today and makes no security or compliance claim (encryption, certification).

### Pending paragraphs

Features whose specs are merged but not built are not written about. Each is one follow-up paragraph plus its keys, owned by this spec, so
no other stage's spec or file list is touched and the help content has one owner (`docs/SPEC.md` §8).

| Feature                               | Plan stage / spec                                                  | Article                     | Anchor (new heading or existing)        |
| ------------------------------------- | ------------------------------------------------------------------ | --------------------------- | --------------------------------------- |
| Passkeys                              | 09-S1, `2026-10-11-a-passkey-you-can-add-name-and-take-away.md`    | `your-account-and-security` | `signing-in-and-security`               |
| Turning on two-factor from settings   | 09-S2, `2026-10-11-turn-on-two-factor-from-settings.md`            | `your-account-and-security` | `signing-in-and-security`               |
| Password, email, photo and leaving    | 09-S3 (no spec yet)                                                | `your-account-and-security` | `your-profile`                          |
| Installing the app                    | 09-S4, `2026-10-11-installable-and-honest-about-what-it-caches.md` | `getting-started`           | `finding-your-way-around`               |
| Choosing a language before signing in | 09-S5, `2026-10-11-choose-a-language-before-you-sign-in.md`        | `your-account-and-security` | `language-appearance-and-notifications` |
| The trip invite link                  | 07-S10, `2026-10-08-the-trip-invite-link.md`                       | `sharing-a-trip`            | `trip-members-and-their-roles`          |
| Keeping a list as a template          | `2026-10-04-keep-a-list-as-a-template.md`                          | `packing-lists`             | `packs-and-to-dos`                      |
| Packing groups as records             | `2026-10-04-packing-groups-become-records.md`                      | `packing-lists`             | `packs-and-to-dos`                      |
| Showing where the money went          | `2026-10-04-show-where-the-money-went.md`                          | `money-and-who-owes-what`   | `recording-an-expense`                  |
| Switching collaboration sections      | `2026-10-05-switch-collaboration-sections-per-trip.md`             | `sharing-a-trip`            | `who-can-see-a-trip`                    |
| The whole-trip conversation composer  | `2026-10-05-the-whole-trip-conversation.md`                        | `keyboard-shortcuts`        | `writing-in-a-conversation`             |

The table is the list known when this spec was written. Ticket 8 **rebuilds it** from every spec under `.ai/specs/` at `ready` or
`in-progress` whose design changes what one of the eight articles describes (grep the specs for the screens and terms of each article),
so a spec merged after this one is not missed. It re-checks each row against the code: a feature that has merged by then is written into its article in that ticket; for a row
whose feature has not, it files one issue titled `09-S6 follow-up: handbook paragraph for <feature>`, `Blocked by` the feature's
implementation issue when it has one. It also files one further issue proposing a review rule, that a pull request which changes
behaviour an article describes updates that article's `settings.help.*` paragraph in the same change (the "Docs and CI" rule in
`CODE_REVIEW.md` covers agent-layer documents only, and nothing else keeps an article true after merge); the rule itself is not written
in this stage. These issues sit outside the eight-ticket cap.

### Alternatives considered, and why they lost

- **A markdown renderer.** Rejected: Help is first-party, reviewed content compiled with the app, so it can be typed rather than parsed.
  A parser buys a sanitiser question and an untrusted-input surface for content nobody outside the repository writes.
- **Help content in D1.** Rejected: a tenant-scoped write path, an editing surface, a quota question and a migration per revision, to
  solve what a pull request already solves.
- **English-only prose (the legal precedent).** Rejected: `docs/SPEC.md` §9 rule 6, and reversing it later means authoring ~4,400 entries.
- **A twelfth `help` namespace now.** Rejected for now; the budget in "Where the prose lives" says when it comes back.
- **A public (signed-out) handbook.** Not done: the articles talk about screens only a signed-in reader can open, and sign-in is the plan's
  stated product decision. Revisit if the marketing site wants it.

## 📝 Architecture

| Concern                          | Owner (one concept, one owner, `docs/SPEC.md` §8)                                                     |
| -------------------------------- | ----------------------------------------------------------------------------------------------------- |
| Block union, article type, slugs | `src/routes/_app/help/-content/types.ts`, `index.ts` (ordered contents, slug index, title projection) |
| The articles' structure          | `src/routes/_app/help/-content/articles.ts`                                                           |
| The articles' words              | `src/lib/i18n/messages/<locale>/settings.ts`, prefix `help.`                                          |
| Rendering a block                | `src/routes/_app/help/-ui/article-body.tsx`                                                           |
| The contents and the filter      | `src/routes/_app/help/-ui/help-sidebar.tsx`                                                           |
| The entry point                  | `src/components/layout/user-menu.tsx` (one `MenuItem`, `settings.help.menu`)                          |
| Filter text normalisation        | a pure function in `-content/index.ts`, unit-tested                                                   |

The `-content/` and `-ui/` directories are dash-prefixed non-route folders, the convention `src/routes/_app/-lib/`, `-server/` and
`-ui/` already use. `components/ui` is reused, not edited: `Card`, `Input`, `Badge`, `Alert`, `Kbd`, `SectionLabel`, `Separator`,
`ScrollArea`, `EmptyState`, `Skeleton`, `Button`, `Sheet`; `PageHeader`, `AppFrame`, `AppSections`, `ErrorPanel`. No
component fetches data or imports from `server/`. The account-menu entry's label key lives in `settings.help.*` (not `shell.*`) so the
handbook is one owner and the single prefix stays movable.

## 📝 Data Model

None, and deliberately. Articles are modules, not rows: no table, no column, no migration, no seed.

## 📝 API Contracts

None. No repository, no server function, no SQL, no Zod schema: there is no input. The slug is a route parameter validated against the
content index; a miss is `notFound()`. Authorisation is the shell's existing session guard; every article is the same for every reader, so
no `TenantScope` is taken, no quota metric is consumed, and no case is appended to
`src/server/repos/__tests__/tenant-isolation.test.ts` (a test asserting an organization boundary over a static array could not fail).

## 📝 UI/UX

- `/help`: `PageHeader` (eyebrow, title, description), the contents, and an overview list of the articles as `Card`s with title and summary.
- `/help/{slug}`: the article with a "Next: {title}" link at its foot when one follows.
- Every interactive element has hover, `:focus-visible`, active and disabled states; the contents button, the anchor affordance and the
  filter are reachable by keyboard in reading order; focus returns to the Contents button when the sheet is dismissed without choosing an article.
- Spacing on the 4px grid from `--space-*`; no new tokens; WCAG 2.2 AA contrast in both themes, dark shadows re-declared; the small layout is
  designed (the article is the page; contents behind a sheet), and the page clears the floating "Report a problem" actor below `lg` the way
  `AppFrame` already does.
- `ar` is a designed right-to-left layout: logical properties only, the anchor affordance at the inline end.

## 📝 Copy

All keys are under `settings.help.` in `messages/en/settings.ts` (written as `help.…` inside that file) and land in all 23 locales per the
`i18n-messages` skill, translated from our English. Copy language is English, `en-GB` source, sentence case.

| Key                                                                                                                                           | English                                                                   |
| --------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| `settings.help.menu`                                                                                                                          | Handbook                                                                  |
| `settings.help.eyebrow`                                                                                                                       | Handbook                                                                  |
| `settings.help.title`                                                                                                                         | Using planned.travel                                                      |
| `settings.help.description`                                                                                                                   | How the screens fit together, in plain words.                             |
| `settings.help.search.label`                                                                                                                  | Find an article by title                                                  |
| `settings.help.search.placeholder`                                                                                                            | Search by title                                                           |
| `settings.help.search.count`                                                                                                                  | `{count} articles` (plural: `one` "1 article")                            |
| `settings.help.search.clear`                                                                                                                  | Clear search                                                              |
| `settings.help.empty.title`                                                                                                                   | Nothing matches that                                                      |
| `settings.help.empty.body`                                                                                                                    | Try a shorter word, or clear the search to see every article.             |
| `settings.help.contents`                                                                                                                      | Contents                                                                  |
| `settings.help.next`                                                                                                                          | Next: {title}                                                             |
| `settings.help.anchor.copy`                                                                                                                   | Copy link to {section}                                                    |
| `settings.help.anchor.copied`                                                                                                                 | Link copied                                                               |
| `settings.help.anchor.failed`                                                                                                                 | The link could not be copied. The address bar now points at this section. |
| `settings.help.contents.label`                                                                                                                | Handbook contents                                                         |
| `settings.help.notFound.title`                                                                                                                | That article does not exist                                               |
| `settings.help.notFound.body`                                                                                                                 | The link may be old or mistyped. The handbook has the current list.       |
| `settings.help.notFound.back`                                                                                                                 | Back to the handbook                                                      |
| `settings.help.error`                                                                                                                         | The handbook did not load                                                 |
| `settings.help.article.<slug>.title` / `.summary` and every heading, paragraph, step, callout, list item and link label of the eight articles | written by tickets 1-8                                                    |

About 200 keys in total (the plan's estimate); each article ticket adds about 25-30. The wording of the articles is the tickets' work and
is reviewed as copy; this spec fixes the chrome strings above.

## 📝 Edge Cases & Failure Scenarios

| Case                                                   | Behaviour                                                                                                                                         |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `/help/not-an-article`                                 | `notFound()`; the layout's handbook not-found panel replaces the contents, with a "Back to the handbook" action.                                  |
| `/help/{slug}#missing-anchor`                          | The article opens at the top; no error.                                                                                                           |
| Deep link to `#anchor` on first load and on navigation | The heading is scrolled into view below the sticky header (`scroll-mt`), and focus moves to the heading on first load and on a client transition. |
| Filter with only whitespace                            | Treated as empty: the full contents.                                                                                                              |
| Filter in `tr` / `de` / `ar`                           | Locale case folding and diacritic stripping; right-to-left text filters the same way.                                                             |
| Reader changes language while on an article            | The existing language commit re-renders titles; the anchor (English-derived) is unchanged, so the URL still resolves.                             |
| Two articles of different length                       | No layout shift after paint when navigating between them (measured).                                                                              |
| Signed out                                             | Redirect to `/login` by the `_app` guard; no article is served.                                                                                   |
| `prefers-reduced-motion: reduce`                       | The global reduce rule removes the animation; the end state shows at once.                                                                        |
| A block key with no English message / no translation   | Typecheck / parity failure, never a runtime fallback to English.                                                                                  |
| Clipboard unavailable when copying the link            | The address bar still moves to the fragment, and the polite region announces `settings.help.anchor.failed`.                                       |

## ✅ Acceptance criteria

1. The account menu lists "Handbook" on every `_app` screen and opens `/help`; the entry is in all 23 locales.
2. `/help` lists the articles that exist; `/help/{slug}` renders each with the article title as its only `<h1>` (the page header is on `/help` only), a route `head` title from the translated title (or, when the shell has no seam for one, a reference to the filed app-wide page-title issue), and one level-2 heading before any level-3.
3. The sidebar mirrors the contents; the current article has `aria-current="page"`; moving between articles does not load a document.
4. The filter matches the translated title by case- and diacritic-insensitive substring, announces the count politely, clears on Escape and returns focus to the input, and
   shows the empty state for no match. In the sheet the first Escape clears a non-empty filter and the next closes the sheet.
5. At 360px an article's contents open in a sheet from a sticky "Contents" button (none on `/help`, where the filter sits inline above the cards); choosing an article closes the sheet and focuses its `<h1>`; a deep-linked heading clears the sticky Contents bar; no horizontal scroll.
6. `/help/{unknown}` shows the handbook not-found panel with a way back; each leaf route has its own pending and error component; a unit test covers the skeleton at final heights.
7. Every heading's anchor is unique within its article, equals the derivation of its English text, and `/help/{slug}#{anchor}` lands on it.
8. Every internal `link` block resolves to an existing article (and anchor when given); a broken one fails `pnpm typecheck` or `content.test.ts`.
9. Every `settings.help.*` key is referenced by a block or the chrome, resolves to a non-empty message, and the `DEAD_KEYS` count in
   `coverage.test.ts` is unchanged.
10. Each article ticket's PR carries its claim-to-source list, and the article names no unbuilt feature.
11. Keyboard-only: tab from the filter through the contents into the article and back with focus visible at every stop; no trap. The section-link affordance is visible without hover, at least 24x24 px, and named with its section; a `callout` is `role="note"`; a `shortcut` keeps text key names.
12. Light and dark, `ar`, 360/1280/2560px reviewed as blind A/B pairs; console silent on every journey; layout shift after paint is 0.
13. `package.json`, `pnpm-lock.yaml` and `wrangler.jsonc` are unchanged; no markdown renderer is added.
14. The payload budget is measured and quoted in the PR of tickets 1 and 8.

## 📝 Risks & Impact Review

| Risk                                                | Severity | Mitigation                                                                                                         |
| --------------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------ |
| An article states something the product does not do | medium   | The tied-to-base rule, the claim list per PR, a review check; omit rather than promise.                            |
| ~200 keys inflate every document's message bag      | medium   | Measured budget (20%) with the `help` namespace as the named, mechanical follow-up.                                |
| 22 translations of prose are low quality            | medium   | One article per ticket keeps each reviewable; parity forbids English in a translation; native-script review at PR. |
| Parallel tickets conflict in 23 `settings.ts` files | low      | Tickets run as a chain (Phasing), each appending its own `help.<article>.*` block in the contents order.           |
| Anchors drift when English copy changes             | low      | Anchors are stored, not computed; the test checks the derivation, so a drift is an explicit edit.                  |
| The page is a dead end for a signed-out visitor     | low      | Product decision recorded; revisit with marketing.                                                                 |

Security and tenancy: no authentication, tenant scoping, role, sharing, money or stored-file change. No secret, no third-party service, no
binding, no dependency.

### Out of scope

A markdown renderer; images and a `figure` block; full-text search; a public handbook; versioned or per-plan articles; an in-product editor;
pending paragraphs for unbuilt features (follow-up issues); operator documentation; the translation of `src/routes/legal/**` (stays English).

### Blockers

None. No row in another plan gates this one. `11-boundaries-and-blockers.md` entry 5 is answered by this spec, not inherited.

### Reference-row disposition

`EXT-04` absent → done when ticket 8 lands. No dependants.

## 📋 Phasing

Eight tickets, each blocked by the one before it. The product owner's draft ran tickets 2-8 in parallel after ticket 1; they are chained
here because every article ticket appends to `settings.ts` in 23 locales, which is the same hunk in every parallel pull request, and the
pipeline merges one spec ticket at a time anyway. A chain also makes the stage's close (ticket 8) the last thing that merges.

| Ticket | Scope                                                                | Keys (about) |
| ------ | -------------------------------------------------------------------- | ------------ |
| 1      | Shell, content model, "Getting started", menu entry, journey, doc 11 | 45           |
| 2      | Planning a trip day by day                                           | 28           |
| 3      | Money and who owes what                                              | 26           |
| 4      | Packing lists                                                        | 18           |
| 5      | Sharing a trip                                                       | 26           |
| 6      | Your account and security                                            | 28           |
| 7      | Keyboard shortcuts                                                   | 16           |
| 8      | Plans and billing; Pending paragraphs sweep; the `Delivered:` line   | 24           |

## 📋 Implementation Plan

### Phase 1 - the shell and the first article (ticket 1)

1. `-content/types.ts` (block union, `HelpKey`, `HelpLinkTarget`, article type), `-content/index.ts` (ordered contents, slug index, title projection, filter normaliser), `-content/articles.ts` with `getting-started`; `-content/__tests__/content.test.ts` (invariants below).
2. `-ui/article-body.tsx` + test, `-ui/help-sidebar.tsx` + `help-sidebar.test.tsx` (+ sheet), the three route files with `pendingComponent` and `errorComponent` on the two leaves; `pnpm generate-routes`.
3. The `UserMenu` entry; the chrome keys and `getting-started` keys in 23 locales (`i18n-messages` skill).
4. `e2e/helpers/routes.ts`: add `help` (`/help`) and `help-article` (`/help/getting-started`) to `APP_ROUTES`; one journey in `e2e/journeys.spec.ts` (Verification).
5. `docs/plans/11-boundaries-and-blockers.md`: remove `EXT-04` from the entry-5 row and heading (four rows), note that typed blocks need no renderer; the grep "a change updates every document that states what it changes" over `EXT-04`, `markdown renderer`, `help browser`.
6. Measure and quote the payload budget.
7. Add a **Handbook** entry to `CONTEXT.md` (the word the menu, the eyebrow and the search use for what the URL calls `/help`; _Avoid_: "help centre", "docs"), so the eight article tickets and the translators use one term.
8. File one follow-up issue (outside the cap) for the neighbouring hardcoded English this ticket touches but must not copy: the "Platform console" entry in `user-menu.tsx` and the label in `src/components/modules/shared/controls.tsx` (`CopyValue`). The new entry uses `t('settings.help.menu')`.
9. If the shell has no seam for a translated route title, file the app-wide page-title gap as one issue and reference it (Routes).
10. `getting-started`'s "Where to go next" links only to routes in this ticket; each later article ticket appends a `link` block to its own article there (a label and a description key).

### Phases 2-7 - one article each (tickets 2-7)

For each: the article's blocks in `articles.ts`, its keys in 23 locales, the claim-to-source list in the PR, a `link` block from
`getting-started`'s "Where to go next" to it, and (ticket 7) the shortcut re-grep. `content.test.ts` already covers structure, so the ticket
adds only the article. **Ticket 2** also extends the journey with the layout-shift assertion (navigating between two articles of different
length; Chromium only, gated on `supportedEntryTypes`, following `e2e/places-and-maps.spec.ts:510-533`) and a check that "Next: {title}"
navigates without a document load, because ticket 1 has only one article to move between.

### Phase 8 - plans and billing, the sweep and the close (ticket 8)

The last article; **rebuild** the Pending paragraphs table from every `ready` or `in-progress` spec that touches an article's topics, then write
each row whose feature has merged or file its follow-up issue; file the review-rule issue; the plan's `Delivered:` line under
`## Stage 09-S6` (and `EXT-04` moves absent → done wherever the plan tabulates rows); re-measure and quote the payload budget.

## Verification

- The gate in `validation.commands` (`.ai/agentic.config.json`) on each ticket's last commit.
- **Unit.** Each test sits with the module that owns the behaviour (`src/routes/**/*.test.ts` runs in the `server` project, `*.test.tsx` in `ui`).
  `-ui/__tests__/article-body.test.tsx` - each block kind renders its role and accessible name; a `callout` is `role="note"` with
  `aria-live="off"`; a `shortcut` renders one `Kbd` per key with its text name ("Shift", "Enter" in the accessible text, no glyphs); the
  affordance's accessible name includes its section, it is an anchor to the fragment, and a clipboard failure announces
  `settings.help.anchor.failed`. `-ui/__tests__/help-sidebar.test.tsx` - the 150 ms debounce, the always-mounted count region, Escape and
  "Clear search" return focus to the input, in the sheet the first Escape clears and the second closes, choosing an article closes the sheet
  and focuses the `<h1>`, the empty state, and the pending skeleton of each leaf route. `content.test.ts` -
  the normaliser (case- and diacritic-insensitive, `tr` "İ"/"ı", `de` "Ü", `ar`) and slugs unique; every article once in the contents and no slug in
  the contents without an article; heading anchors unique within an article and equal to the derivation of the English source text; every
  internal link resolves to an existing article and, when given, a heading; no empty article; one level-2 before any level-3; every
  `settings.help.*` key in `messages/en/settings.ts` is referenced by a block or the chrome; every key a block names resolves to a
  non-empty message.
- **Catalogue:** `pnpm test` parity and `coverage.test.ts` unchanged (`DEAD_KEYS = 9`).
- **E2E** (one journey in `e2e/journeys.spec.ts`; routing and sessions are what ADR 0016 admits): the two new `APP_ROUTES` entries are
  walked in both themes by "a member reaches every screen behind the session"; a journey opens the account menu, goes to the Handbook, tabs
  from the filter into the article and back with focus visible, follows an article link without a document load, loads
  `/help/getting-started#<anchor>` and asserts that the heading's top is at or below the bottom of the lowest sticky element (the header, and at 360px also the Contents bar) and that `document.activeElement` is the heading
  (in the viewport alone would pass while it sat under the sticky header), and loads `/help/nope` and sees the handbook not-found panel
  with its way back.
  `watchConsole` attached before navigation; no addition to the tolerated console warnings; no `toHaveScreenshot`. Run:
  `PLAYWRIGHT_BASE_URL=http://localhost:$PORT pnpm exec playwright test --project=setup` then the same with `e2e/journeys.spec.ts -g help`
  (port from `bash .ai/scripts/e2e.sh` / `test-env-up.sh`; exit 75 is "not executed, environment").
- **Review evidence:** the blind A/B pair from `scripts/visual/capture.mjs` (`PT_SERVER_TODAY=2026-08-20`, `--auth`) for `/help` and one
  article at 360x800, 1280x900 and 2560x1440, light and dark (twelve frames), plus `--click` of the Contents button at 360px, a filter with no
  match, an anchor hovered, and `ar`. `capture.mjs` pins `en-GB` and has no locale flag, so the `ar` frames are made by setting the demo account's
  language to Arabic at `/settings/language` in the `--auth` session, capturing, and restoring it. Selectors are `data-part` attributes this stage publishes, checked to match exactly one element
  before any frame is filed.
- **Definition of done** (`docs/SPEC.md` §7) on each ticket, with the `AGENTS.md` docs grep recorded in the PR.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                                        | Applied default                                                                                                                                                                                                                                                                               | Why                                                                                                                                                                                                                                                                                       |
| --- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Where does the handbook's prose live, given the whole bag ships in every document?              | `settings.help.*`, 23 locales, one article per ticket; measured 20% payload budget with a lazily loaded `help` namespace as the named follow-up                                                                                                                                               | Decided by software architect sub-agent (confidence high): contract-neutral, reversible by a prefix rename; an English-only handbook breaks §9 rule 6 and costs ~4,400 entries to undo. Raw bag growth 13-18% measured against JSON, not TypeScript source.                               |
| 2   | How do the eight articles stay true when some features are unbuilt, and how is the work sliced? | An article describes only what the code at its ticket's base does, with a claim-to-source list per PR; unbuilt features go to a Pending paragraphs table and follow-up issues owned by this spec; all eight articles ship                                                                     | Decided by product owner sub-agent (confidence high): each topic has a working surface now; promising unbuilt features is placeholder copy; editing other stages' merged specs is "Ask First" and would give help two owners. Shortcut list corrected (atlas listbox keys, reply cancel). |
| 3   | Parallel or chained article tickets?                                                            | Chained: ticket n+1 is blocked by ticket n; the close is ticket 8                                                                                                                                                                                                                             | Default applied here, deviating from the product owner's parallel draft: every article ticket edits the same `settings.ts` hunk in 23 locales, so parallel pull requests conflict by construction; the pipeline merges serially anyway.                                                   |
| 4   | Verification, given the plan's visual spec, `shoot.ts` and `ultrabuild` are gone?               | Journeys in `e2e/journeys.spec.ts` + two `APP_ROUTES` entries + blind A/B frames from `scripts/visual/capture.mjs`                                                                                                                                                                            | ADR 0016 and `docs/plans/12-verification-protocol.md`; verified that the named files do not exist.                                                                                                                                                                                        |
| 5   | Does this stage mint a markdown renderer?                                                       | No; typed blocks. Ticket 1 amends `11-boundaries-and-blockers.md` entry 5 to four rows                                                                                                                                                                                                        | First-party content needs no parser or sanitiser; the plan's argument checked against the repository (nothing renders markdown today).                                                                                                                                                    |
| 6   | Is the handbook readable signed out?                                                            | No; under `_app`                                                                                                                                                                                                                                                                              | The plan's stated product decision; the articles describe signed-in screens; reversible by moving the route.                                                                                                                                                                              |
| 7   | What does the filter search and how?                                                            | Title only, over rendered titles, locale case folding and diacritics stripped, 150 ms debounce, Escape clears; component state                                                                                                                                                                | Predictable scope beats a full-text filter that silently misses a word; works in every locale since the active bag is in the browser; no URL parameter is needed for a transient filter.                                                                                                  |
| 8   | Where does the account-menu label live?                                                         | `settings.help.menu`, not `shell.*`                                                                                                                                                                                                                                                           | One owner for handbook copy and a single movable prefix; `useTranslate` reads any namespace (the plan's reasoning, kept).                                                                                                                                                                 |
| 9   | Images in articles?                                                                             | No `figure` block; a later decision                                                                                                                                                                                                                                                           | Screenshots of a product in development go stale; `steps`/`shortcut`/`callout` carry the weight.                                                                                                                                                                                          |
| 10  | Plans-and-billing and account-and-security claims                                               | No prices, refund/cancellation terms, tax or invoice promises; no security or compliance claims                                                                                                                                                                                               | Product owner condition: commercial and compliance statements are a person's; the live billing screen is the only place figures appear.                                                                                                                                                   |
| 11  | Panel round 1                                                                                   | Applied; verdicts in rows 12-19                                                                                                                                                                                                                                                               | Step 5 of `afk-plan-to-spec`.                                                                                                                                                                                                                                                             |
| 12  | Product owner panel: approve this spec for slicing?                                             | Approve with conditions (round 1), applied: five more specs in Pending paragraphs and a rebuild of that table in ticket 8; a review-rule follow-up issue; a flat contents list; the layout-shift assertion moved to ticket 2; numbering and "Where to go next" links fixed                    | Decided by product owner sub-agent (confidence high): the spec covers 09-S6 and nothing outside it; ticket 1 is a real vertical slice.                                                                                                                                                    |
| 13  | Software architect panel                                                                        | Approve with conditions (round 1), applied: `pendingComponent` and `errorComponent` on the leaf routes, `notFoundComponent` on the layout with a handbook panel, tests placed with the module that owns the behaviour, the `ar` capture procedure stated                                      | Decided by software architect sub-agent (confidence high): claims verified against the repository (TanStack `Match.tsx` pending/error resolution; `capture.mjs` pins `en-GB`).                                                                                                            |
| 14  | UX (traveller) panel                                                                            | Approve with conditions (round 1), applied: section-link affordance visible without hover, success and failure feedback keys, handbook not-found copy, one `<h1>` per page, the 360px flow, copy fixes, a `CONTEXT.md` "Handbook" entry, a follow-up issue for neighbouring hardcoded strings | Decided by UX specialist sub-agent (confidence high): a phone reader could otherwise never get a section link, and chrome strings would be invented by the ticket.                                                                                                                        |
| 15  | Accessibility panel                                                                             | Approve with conditions (round 1), applied: Escape order in the sheet, `callout` as `role="note"`, text key names in `shortcut`, the affordance's full contract, `scroll-mt` and focus on deep links, landmark and sheet names, focus rules, route titles, motion tokens                      | Decided by accessibility specialist sub-agent (confidence high): the reused `Sheet`, `Alert` and `Kbd` defaults cause these barriers unless the spec overrides them.                                                                                                                      |
| 16  | Product owner panel, round 2 (does the revision settle each point?)                             | Approve with conditions: all five round-1 points settled; three contradictions fixed in a commit (acceptance criterion 2 now allows the filed page-title issue; focus return qualified; stale `NotFoundPanel` and "Next article" lines corrected)                                             | Decided by product owner sub-agent (confidence high).                                                                                                                                                                                                                                     |
| 17  | Software architect panel, round 2                                                               | Approve with conditions: all four points settled; the stale `NotFoundPanel` mention in Architecture removed                                                                                                                                                                                   | Decided by software architect sub-agent (confidence high).                                                                                                                                                                                                                                |
| 18  | UX (traveller) panel, round 2                                                                   | Approve with conditions: eight points settled; the `/help` filter below `lg` now renders inline above the cards, the deep-link offset includes the sticky Contents bar (`--help-contents-h`), four stale lines reconciled                                                                     | Decided by UX specialist sub-agent (confidence high).                                                                                                                                                                                                                                     |
| 19  | Accessibility panel, round 2                                                                    | Approve with conditions: nine points settled; the sticky-bar offset added and measured at 360px, the row duration raised to 160 ms (the 150-260 ms range), the focus-return sentence qualified                                                                                                | Decided by accessibility specialist sub-agent (confidence high). Every round-2 condition is editorial or a one-line addition and is applied; no point is a standing revise.                                                                                                               |
