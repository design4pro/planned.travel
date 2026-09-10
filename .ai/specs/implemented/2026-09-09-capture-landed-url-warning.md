# Report the landed URL instead of a list of anonymous-only routes

| Field              | Value       |
| ------------------ | ----------- |
| **Status**         | implemented |
| **Issue**          | #132        |
| **Spec PR**        | #369        |
| **Implementation** | #396        |

Source issue: [#132](https://github.com/design4pro/planned.travel/issues/132) — "Report the landed
URL instead of maintaining a list of anonymous-only routes". Filed by the sandcastle deep-review
(run 12177) while reviewing #101; every claim below was re-verified against `develop` rather than
taken from the issue, and two of its premises did not survive that check (see **Problem
Statement**).

## 📝 TLDR

`scripts/visual/capture.mjs` already prints the URL it was asked for and the URL each frame was
actually taken on, but nothing compares the two — so a redirect files a photograph of the wrong
screen under the right filename and says nothing about it. Two redirects are caught today by a
hardcoded list of anonymous-only routes whose upkeep is a drift test; every role-dependent
redirect is wide open. This spec replaces the list with one universal comparison: when a frame was
taken on a different pathname than the one requested, `warnings` gains an entry. The list, its
drift test and the prose that documents them are then deleted, and the obligation to quote a
warning — which used to live in a file that no longer exists — is written into
`.claude/skills/verifying-changes/SKILL.md`, the one document that still owns how this script is
read. Tooling only: no route, no schema, no locale key, no user-facing pixel.

## 📝 Problem Statement

The harm is a capture that photographs screen B, files it under the name of screen A, and leaves no
record anywhere that the two differ. A blind critic handed that frame reports a defect of the
capture as a defect of the product — the failure mode `capture.mjs` exists to prevent (its own
header comment, lines 5–11). The defect is the **silence**, not any particular field: the script
already holds both URLs and simply never compares them.

Every fact, verified on `develop` at `0d938e1a`:

| Claim                                 | Where                                              | State                                                                                                            |
| ------------------------------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| The requested URL is reported         | `scripts/visual/capture.mjs:374`                   | `requestedUrl` is in the JSON                                                                                    |
| The landed URL is reported, per frame | `scripts/visual/capture.mjs:355`                   | `landedUrl`, read at the shutter                                                                                 |
| Nothing compares them                 | `scripts/visual/capture.mjs`                       | no comparison exists; `warnings` only ever carries a viewport mismatch (`:326`) or a flat frame (`:345`)         |
| The hardcoded list                    | `scripts/visual/anonymous-only.mjs:25`             | two entries — `/login`, `/register`                                                                              |
| Its drift test                        | `scripts/visual/__tests__/anonymous-only.test.mjs` | the `drift against the routes` block re-derives the list from `src/routes/(auth)/` with a regex over the sources |
| The refusal, and its gate             | `scripts/visual/capture.mjs:207-214`               | `--auth` only; `exit 2`, no frame filed                                                                          |
| A role-dependent redirect, uncaught   | `src/routes/_app/console/route.tsx:38-43`          | a `user`-role session asking for `/console` is redirected to `/dashboard`; nothing is recorded                   |
| A legitimate redirect, uncaught       | `src/routes/_app/trips/$tripId/index.tsx:28`       | `/trips/<id>` → `/trips/<id>/<tab>`; nothing is recorded                                                         |
| The stale-session hard error          | `scripts/visual/capture.mjs:292-298`               | `--auth` + landed on `/login` → throw, `exit 1`; evaluated straight after `goto(…, { waitUntil: 'commit' })`     |
| The prose that documents the list     | five sites (below)                                 | all five still describe a refusal                                                                                |

### Two premises of the issue that did not survive verification

Both are stated here rather than quietly worked around, because each changes what the change is
allowed to delete.

1. **"a new vitest project" is neither new nor scripts-only.** The project is `tooling` in
   `vitest.config.ts`, and besides `anonymous-only.test.mjs` it collects **thirteen** other test
   files: the eight under `scripts/**/__tests__/` (including
   `scripts/visual/__tests__/click-through.test.mjs`, the sibling module's test),
   `e2e/helpers/__tests__/console-policy.test.ts`, `vite.config.test.ts`, the two Claude Code hook
   tests under `.claude/hooks/__tests__/`, and `.ai/scripts/__tests__/cezar-config.test.ts`.
   Deleting the project would stop running all of them, silently — the exact failure its own doc
   comment says it exists to prevent. **Only the one test file is deleted.** What the issue is
   actually objecting to is the _drift test_, and the fix for a drift test is to remove the thing
   that drifts, not the runner.

2. **`.sandcastle/pixel-capture-prompt.md` no longer exists.** The whole `.sandcastle/` directory
   was removed in `e55697f6` when cezar replaced the orchestrator (ADR
   `docs/adr/0014-cloud-routines-replace-sandcastle.md`). The issue's argument — "the existing
   contract already forces every `warnings` entry to be quoted in `skippedReason`, so the blindness
   is closed" — therefore rests on a contract with no home. Without giving it one, trading a hard
   refusal for a warning nobody is obliged to read is a strict downgrade for `/login` and
   `/register`. **This spec gives the contract a home** — `.claude/skills/verifying-changes/SKILL.md`
   §"Probing the running app", which is already the document that tells a reader how to run and read
   this script — and makes the script point at it on stderr. That is the load-bearing part of the
   change; the deletions are the cheap part.

### Why one item and not three (docs/SPEC.md §8)

The concept is _"did the capture photograph the screen it was asked for?"_, and it is true in five
places at once:

- `scripts/visual/anonymous-only.mjs` — the list and its four-paragraph rationale
- `scripts/visual/__tests__/anonymous-only.test.mjs` — the drift test
- `scripts/visual/capture.mjs` — the header paragraph at `:22-24`, the usage paragraph at `:45-48`
  ("a redirect the refusal list does not know about"), the import at `:55`, and the refusal block at
  `:207-214` whose comment opens "Both refusals come before anything is created"
- `vitest.config.ts` — the `tooling` doc comment's clause "which screens `capture.mjs` refuses to
  photograph signed in" (`:26-27`)
- `.claude/skills/verifying-changes/SKILL.md:62` — the sentences describing the refusal to whoever
  runs the pair

Half of this landing leaves the repository claiming a refusal the script no longer performs, which
is worse than either end state. **Owner module: `scripts/visual/capture.mjs`**, with the new pure
sibling `scripts/visual/landed-url.mjs` — the same shape `click-through.mjs` already has, and the
one `anonymous-only.mjs` vacates.

## 📝 Resolved assumptions (autonomous defaults)

This spec was written unattended. Each answer below is the most reversible reading of the issue;
override any of them on the PR before merge.

| #   | Question                                                                                 | Applied default                                                                                                                                         | Why                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q1  | Delete the `--auth` refusal for `/login` and `/register`, or keep it beside the warning? | **Delete it**, as the issue asks — but only together with the quoting contract of premise 2.                                                            | The issue is the repository owner's stated direction. The refusal's value is not lost, it is generalised; conditioning the deletion on the contract is what keeps it a net gain.                                                                                                                                                                                                                       |
| Q2  | Delete the vitest project the issue names?                                               | **No** — delete only `scripts/visual/__tests__/anonymous-only.test.mjs`.                                                                                | Premise 1: the `tooling` project runs thirteen other test files. Deleting it would silently unrun them.                                                                                                                                                                                                                                                                                                |
| Q3  | Warn only under `--auth`, or on every capture?                                           | **Every capture**, `--auth` or not.                                                                                                                     | The failure class is "the frame is not of the screen you named", which has nothing to do with the session. Restricting it would rebuild a special case.                                                                                                                                                                                                                                                |
| Q4  | Which URL is compared — the shutter read, or the landing before `--hover` / `--click`?   | **The shutter read** (`files[].landedUrl`) by default; the post-`settle()` landing instead **only when `--click` was given**.                           | A redirect the app makes _after_ hydration is exactly what `capture.mjs:350-351` was written for, and a landing-only comparison would miss it. `--click` is the one navigation the caller intended.                                                                                                                                                                                                    |
| Q5  | One warning per frame, or one per distinct redirect?                                     | **One per distinct redirect**, deduplicated across the eight frames.                                                                                    | Eight identical sentences bury the other warnings. Deduplication is `warnings.includes(w)` — no new structure.                                                                                                                                                                                                                                                                                         |
| Q6  | Does a redirect set `captureValid: false`?                                               | **No.** `captureValid` stays the toolchain verdict it is today.                                                                                         | The frames are valid photographs — of the wrong screen. Conflating the two would make `captureValid` mean two things, and `exit 2` on a legitimate `/trips/<id>` redirect.                                                                                                                                                                                                                             |
| Q7  | Keep the stale-session hard error?                                                       | **Keep it where it is, add a second evaluation before the shutter, and narrow both** to the case where the _requested_ pathname is not itself `/login`. | The issue says to keep it. Kept only where it is, a post-hydration bounce to `/login` would degrade from a hard error to a warning; _moved_ instead of duplicated, a stale session under `--map` / `--hover` / `--click` would hang on `settle` and report a generic timeout instead of the actionable message; left unnarrowed, asking for `/login` with `--auth` would report a false stale session. |
| Q8  | Where does "quote every `warnings` entry" live now?                                      | `.claude/skills/verifying-changes/SKILL.md`. The script's stderr **points at that file** rather than restating the rule.                                | It is the document that already owns how the pair is run and read (CLAUDE.md lists it as a project skill). Two copies of the rule would be one claim in two places (§8); a pointer is not a copy.                                                                                                                                                                                                      |

None carries a security, tenancy or product-decision risk: the change touches no runtime code, no D1
schema, no locale key and no protected surface in `BACKWARD_COMPATIBILITY.md`.

**Two do carry a compatibility risk, and both are exit-code changes to a script other things shell
out to.** Q1 turns `exit 2` into `exit 0` for `--auth` on `/login` and `/register`; Q7 turns `exit 0`
into `exit 1` for a session that bounces to `/login` after hydration. Both are enumerated in **API
Contracts** and carried into **Risks & Impact Review** rather than covered by a blanket claim here.

## 📝 Proposed Solution

One comparison, in one place, replacing a list of two special cases.

1. **`scripts/visual/landed-url.mjs` — new, pure, ~25 lines.** Exports one function:

   ```js
   landedUrlWarning({ requestedUrl, landedUrl }) // → string | undefined
   ```

   It normalises both URLs to a pathname (`new URL(u).pathname`, trailing slashes stripped, empty →
   `/`) and returns `undefined` when they match. Query, hash, port and host are ignored (see the
   narrowings in **Out of scope**). When they differ it returns one sentence naming both pathnames,
   what was therefore filed, and both fixes — point `--url` at the landing, or, if the screen only
   renders for a signed-out visitor, capture it without `--auth`. The sentence carries both fixes
   unconditionally, so the function needs no knowledge of the flags.

2. **`capture.mjs` calls it once per frame.** The URL it compares is the shutter read — the same
   `page.url()` that already becomes `files[].landedUrl` — except when `--click` was given, where
   the post-`settle()` landing is used instead so a deliberate navigation is not reported as a
   redirect. The push sits where the frame is filed, so a frame rejected by the viewport gate never
   contributes one, and deduplication keeps eight frames of the same redirect to one entry.

3. **The refusal and its list go.** `anonymousOnlyRefusal` is unimported, `anonymous-only.mjs` and
   its drift test are deleted, and the five prose sites are settled: four deleted or corrected in
   place, the fifth — `verifying-changes` — rewritten into the new contract.

4. **The stale-session error is narrowed and evaluated twice** — once where it already is, straight
   after `goto`, so a session that is stale at navigation still fails fast with its actionable
   message; and once immediately before `page.screenshot`, which closes the post-hydration bounce
   the first check misses while no PNG exists yet. One predicate, two points, per Q7.

### Alternatives considered

- **Keep the list and add the warning.** Rejected: the list's cost is not the two entries, it is the
  drift test that re-derives them from `src/routes/(auth)/` with a regex over route sources — a
  second, fragile model of the router maintained so a two-line constant stays honest. Once every
  redirect warns, the two entries buy a marginally louder failure for the two screens that already
  had one, at that price.
- **An allowlist of _legitimate_ redirects** (so `/trips/<id>` → `/plan` stays silent). Rejected: it
  is the same hardcoded, drifting list this issue deletes, inverted — and a prose version of it in a
  skill file would be the same list again, drifting more quietly because no test guards it. A true
  warning on a known redirect is answered in one word by whoever quotes it.
- **`exit 2` on any redirect.** Rejected under Q6: it would refuse the legitimate
  `/trips/<id>` capture the current comments explicitly protect (`anonymous-only.mjs:15-17`), at the
  cost of a capture round.
- **Compare inside the existing `warnings` push sites without a module.** Rejected: `capture.mjs`
  runs `need('url')` and `process.exit` at import time, so nothing in it can be unit-tested. A pure
  sibling is the pattern the directory already uses twice.

## 📝 Architecture

### `scripts/visual/landed-url.mjs` — new

The whole module surface:

| Export                                          | Contract                                                                                                                                         |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `landedUrlWarning({ requestedUrl, landedUrl })` | `undefined` when the two normalised pathnames are equal; otherwise a single-sentence warning naming both pathnames and both fixes. Pure, no I/O. |

It knows nothing about this repository's routes — which is the point. There is no list to drift, so
there is nothing for a drift test to guard, and its own unit test asserts behaviour rather than a
claim about `src/routes/`.

Normalisation, kept identical to the rule `anonymous-only.mjs` used so no case regresses:

```js
const pathnameOf = (u) => new URL(u).pathname.replace(/\/+$/, '') || '/'
```

### `scripts/visual/capture.mjs` — edited

| Site                                             | Change                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header comment, `:22-24`                         | Deleted — it exists only to point at the refusal list.                                                                                                                                                                                                                                                                                                                                                                                             |
| Usage comment, `:45-48`                          | Rewritten: every frame reports the URL it was taken on, and a frame taken on a pathname other than the requested one is a `warnings` entry — no list, no exceptions.                                                                                                                                                                                                                                                                               |
| `import … from './anonymous-only.mjs'` (`:55`)   | Deleted; `import { landedUrlWarning } from './landed-url.mjs'` added.                                                                                                                                                                                                                                                                                                                                                                              |
| The refusal block, `:207-214`                    | Deleted, its "Both refusals" comment with it. The two surviving pre-flight refusals (`--auth` with `--enter`; a missing `e2e/.auth/demo.json`) keep their own comments and are otherwise untouched.                                                                                                                                                                                                                                                |
| The stale-session throw, `:292-298`              | **Stays where it is**, narrowed by `pathnameOf(url) !== '/login'` (Q7). It keeps firing straight after `goto`, before `settle`, `--hover` and `--click` — see **Why the throw is evaluated twice** below.                                                                                                                                                                                                                                          |
| After `settle(page, …)`                          | `const landing = page.url()` — read before `quiesce`, `--dismiss`, `--hover` and `--click`. Used only when `--click` was given.                                                                                                                                                                                                                                                                                                                    |
| Immediately **before** `page.screenshot`, `:334` | `const seen = typeof opt.click === 'string' ? landing : page.url()`. **A second** evaluation of the same guard: if `wantsAuth`, `pathnameOf(seen) === '/login'` and `pathnameOf(url) !== '/login'` → throw the same stale-session error. This is the last point before the PNG exists, and `--click` / `--hover` / `--dismiss` have all already run, so `page.url()` here is the same value the filing point reads — nothing navigates in between. |
| Where the frame is filed, `:352-360`             | Push `landedUrlWarning({ requestedUrl: url, landedUrl: seen })` when defined and not already present.                                                                                                                                                                                                                                                                                                                                              |
| After the JSON is printed                        | When `warnings.length`, one stderr line naming `.claude/skills/verifying-changes/SKILL.md` as the rule for what to do with them.                                                                                                                                                                                                                                                                                                                   |

#### Why the throw is evaluated twice, not moved

One predicate (`wantsAuth && pathnameOf(seen) === '/login' && pathnameOf(url) !== '/login'`) at two
points, because each point closes a hole the other cannot.

- **After `goto`** — the fast path, and the reason not to relocate. When the session is already
  stale at navigation, this fires before `settle`, `--hover` and `--click` run, so the operator gets
  the instant, actionable `playwright test --project=setup` message. Relocating it would put
  `settle(page, { map: true })` first, which waits up to 25 s on `waitForFunction` for a
  `[data-map-ready]` element `/login` never renders (`capture.mjs:184-198`), and `--hover` /
  `--click` locators 15 s each (`:310-315`) — the capture would hang and then report a generic
  Playwright timeout instead of the diagnostic the throw exists for, on exactly the captures where
  it is most useful.
- **Before the shutter** — closes the post-hydration bounce the early check misses, which is Q7's
  whole point, and does so while no PNG exists yet.

The residual case, stated rather than left to be found: a session that survives `goto` and bounces
to `/login` **during** `settle` under `--map` still spends the 25 s timeout before any check sees
it. That is a strictly better outcome than today (today it exits 0 and files a login frame under the
requested screen's name), but it is not the fast diagnostic, and closing it would need a navigation
listener rather than a point check — out of scope.

`landedUrl` in each `files[]` entry keeps its current meaning — the shutter read — because it is the
honest record of what the PNG shows. Under `--click` it is therefore the navigated URL while the
comparison used the landing; that is the intended asymmetry, and the usage comment says so.

### `vitest.config.ts` — edited

The `tooling` project stays exactly as it is. One clause of its doc comment (`:26-27`) — "which
screens `capture.mjs` refuses to photograph signed in" — is replaced by "how `capture.mjs` decides a
frame was taken on the screen it was asked for". No `include` glob changes: the new test file
matches `scripts/**/__tests__/*.test.{ts,mjs}` already, and the deleted one simply stops matching.

### `.claude/skills/verifying-changes/SKILL.md` — edited

Line 62's two `--auth` refusal sentences are replaced. The new text keeps the two surviving
refusals, drops the anonymous-only one, and states the contract that premise 2 left homeless, in the
imperative the rest of that skill uses: **every entry in `warnings` is quoted verbatim in whatever
reports the capture; a redirect warning means the frame is a photograph of a different screen than
its filename claims.** "Reading the blind pair" gains one general sentence — some redirects are
legitimate (a route with no screen of its own sends you to its default tab), and a legitimate one is
answered in a word rather than silenced — with **no enumeration of specific paths**, which would be
the deleted list rebuilt in prose where no test guards it.

### Files this spec does **not** touch

`scripts/visual/click-through.mjs` and its test, every `src/**` route, `e2e/**`, `drizzle/**`, the
locale catalogue, `BACKWARD_COMPATIBILITY.md`, and `docs/agents/migration/issues-2026-09-02.json`
(an archive of the tracker migration — it quotes this issue's title and is not a live claim).

## 📝 Data Model

None. No table, column, migration, KV key or R2 object is involved.

## 📝 API Contracts

The only public surface is the JSON object `capture.mjs` prints on stdout. It is consumed by humans
and agents reading it, never parsed by code in this repository.

```jsonc
{
  "requestedUrl": "http://localhost:3030/console",
  "files": [
    {
      "viewport": "1440",
      "theme": "light",
      "landedUrl": "…",
      "path": "…",
      "bytes": 0,
    },
  ],
  "console": { "fatal": [], "notTheApp": [], "toolchainBroken": [] },
  "warnings": [
    "/console redirected to /dashboard — every frame filed under this label photographs /dashboard, not /console. …",
  ],
  "captureValid": true,
}
```

No key is added, removed or retyped: `warnings` is already `string[]` and already carries two other
kinds of entry. The change is additive within an existing field, so nothing that reads today's
output breaks. Exit codes change in exactly two ways, both consequences of Q1 and Q7:

1. `--auth` on `/login` or `/register` no longer exits 2 — it captures, and warns.
2. The stale-session throw is evaluated at the shutter rather than straight after `goto`, so a
   capture whose session survives the initial commit but bounces to `/login` _after_ hydration now
   exits 1 where it exits 0 today. That is the case the throw was written for and currently misses;
   it is called out here rather than left for a caller to discover, because this section is the
   definitive public contract for `capture.mjs`.

No other exit code moves.

## 📝 UI/UX

None. No screen, flow, state or accessibility surface changes.

## 📝 Visual change expected

**None.** This is developer tooling under `scripts/` plus two documents; no route renders
differently in light or dark, on desktop or mobile. Per docs/SPEC.md §7.4 and §8 ("who owns the
visual judgement"), an item that owns no screen is judged on its code, its tests and its stated
contract — so the blind A/B pair is not the evidence here. The evidence is the unit test plus the
live captures of Phase 1, Step 2, whose JSON goes in the PR.

## 📝 Copy

**None.** No user-facing string is added, changed or removed, so no key enters the 23-locale
catalogue. The warning sentence and the stderr notice are developer-facing output of a Node script
that never runs in the app, are never rendered to a user, and are therefore correctly hardcoded in
English (docs/SPEC.md §9 governs what the product renders, not what the toolchain prints).

## 📝 Edge Cases & Failure Scenarios

| Scenario                                                                                              | Behaviour after this change                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--auth --url …/login`, session valid                                                                 | Lands `/dashboard`. Frame filed, warning names both pathnames. **Was**: `exit 2`, no frame. The whole trade of Q1.                                                                          |
| `--auth --url …/login`, session stale                                                                 | Taken on `/login` — the requested screen. No warning, no error, frame filed. Q7's narrowing is what prevents a false "your session is stale".                                               |
| `--auth --url …/dashboard`, session stale at navigation                                               | Unchanged: the throw fires straight after `goto`, before `settle` / `--hover` / `--click`, with its `playwright test --project=setup` fix. Fast, and the message is the diagnostic.         |
| `--auth --url …/dashboard`, session bounces to `/login` _after_ hydration                             | The second evaluation, before the shutter, throws — `exit 1` where today it exits 0 and files a login frame. Under `--map` this costs `settle`'s 25 s timeout first (see Architecture).     |
| `--auth --url …/console`, `user`-role session                                                         | Taken on `/dashboard`. Warning. **Was**: silent — the case that motivated the issue.                                                                                                        |
| A redirect the app makes after hydration, or one an overlay dismissal triggers, **without `--click`** | Warned: the comparison uses the shutter read, which is taken after `settle`, `quiesce` and `--dismiss` (Q4).                                                                                |
| The same redirect **with `--click`** (a flag `--dismiss` may legally accompany)                       | **Not warned** — Q4 compares `landing`, read before `quiesce`, `--dismiss` and the click. The price of not reporting a caller's own navigation as a redirect; recorded in **Out of scope**. |
| `--url …/trips/<id>`                                                                                  | Taken on `/trips/<id>/plan`. Warning, every run. Accepted: it is true, and it is answered in one word by the reader. Reintroducing an allowlist — in code or in prose — is rejected.        |
| `?redirect=`, a trailing slash, or a `#hash` differing                                                | No warning — pathname comparison, normalised.                                                                                                                                               |
| `--click` navigates away from the requested screen                                                    | No warning (Q4 compares the landing instead). `files[].landedUrl` still records where the shutter fired.                                                                                    |
| `--enter` (the reference demo)                                                                        | `enterThrough` runs once before the viewport loop; each frame's `page.goto(url)` still requests the same URL, so nothing changes for the reference half.                                    |
| A viewport measured wrong, frame not filed                                                            | No warning — the push sits after the viewport gate, so `warnings` describes only frames that exist.                                                                                         |
| A redirect to a different **origin** with the same pathname                                           | **Not warned** — a deliberate narrowing, so that `localhost` and the reference host compare as the same screen. Recorded in **Out of scope** rather than left to be rediscovered.           |
| The dev server is broken (`toolchainBroken`)                                                          | Unchanged: `captureValid: false`, `exit 2`. A redirect warning may sit beside it and is harmless.                                                                                           |
| A future route gains a signed-in redirect                                                             | Warned automatically. This is the whole point: no list to update, no drift test to fail, no round lost to a screen nobody had listed.                                                       |

The one failure mode this change cannot close by itself: a reader who does not quote the warning.
That is why premise 2's contract is a Step in the plan and not a footnote.

## 📝 Risks & Impact Review

- **Blast radius.** Two script files, one test file, one config comment, one skill document. No
  runtime code, no bundle, no migration, no locale. `pnpm build` cannot be affected; `pnpm test`
  loses one file and gains another.
- **The regression this trades for.** `/login` and `/register` under `--auth` go from a hard stop to
  a warning. Mitigated by Q8 (the contract in `verifying-changes` plus the stderr pointer) and
  bounded by the fact that both screens are captured without `--auth` in normal use, which is what
  the old refusal told you to do anyway.
- **Warning fatigue.** `/trips/<id>` warns on every capture of a trip. If that proves noisy in
  practice the answer is to capture `/trips/<id>/plan` directly, not to add an allowlist.
- **Compatibility — the exit codes, not the JSON.** `BACKWARD_COMPATIBILITY.md` protects no
  `scripts/**` surface, and the JSON change is additive within an existing array, so nothing that
  reads the output breaks. The real compatibility surface is the **exit status**, and it moves in
  both directions: `2 → 0` for `--auth` on `/login` / `/register` (Q1), and `0 → 1` for a
  post-hydration bounce to `/login` (Q7). The second is a **new failure mode** for anything that
  shells out to `capture.mjs` and branches on its status. Bounded, not dismissed: every invocation
  in this repository is a human or agent one — `.claude/skills/verifying-changes/SKILL.md`,
  `.ai/skills/om-auto-qa-pr/SKILL.md` and the checklist line in `.github/pull_request_template.md`.
  No workflow under `.github/workflows/`, no `package.json` script and no `e2e/**` helper runs it,
  so nothing branches on its status unattended (verified with
  `rg --hidden 'capture\.mjs' -g '!.ai/specs/**'`; re-run it at implementation time). A caller that
  treats non-zero as "capture failed" is correct in both new
  cases: nothing was filed in one, and what would have been filed was the wrong screen in the other.
- **Rollback.** One revert. The deleted module and its test remain in git history, and no data or
  schema state has to be undone.

## 📋 Phasing

One phase. §8 forbids splitting it: `verifying-changes` describing a refusal `capture.mjs` no longer
performs is exactly the "half of this landed" state the rule exists to prevent. The steps below are
individually verifiable and each leaves the repository consistent, but they ship together.

## 📋 Implementation Plan

### Phase 1 — one comparison replaces the list

1. **Add `scripts/visual/landed-url.mjs` and its unit test.** The module per **Architecture**; the
   test (`scripts/visual/__tests__/landed-url.test.mjs`) covers: equal pathnames → `undefined`;
   trailing slash, query and hash differing → `undefined`; a different origin with the same pathname
   → `undefined`; differing pathnames → a string naming both and carrying both fixes.
   _Verify:_ `pnpm test` green — the new file runs in the existing `tooling` project with no config
   change, which also proves Q2's claim that the project was never anonymous-only's private home.

2. **Wire it into `capture.mjs`.** The landing read, the `--click` selection, the deduplicated push,
   the stderr pointer, the stale-session guard narrowed and evaluated at both points, and the
   deleted import, refusal block and header paragraph.
   _Verify:_ `pnpm typecheck`, `pnpm lint`, then four live captures against a running dev server —
   `/dashboard` with `--auth` (no warning), `/console` with a `user`-role session (warning naming
   `/dashboard`), `/login` with `--auth` (frame filed, warning, no `exit 2`), and `/trips/<id>`
   (warning naming the tab). Paste the four JSON objects into the PR: they are this item's evidence
   in place of a blind pair.

3. **Rewrite `.claude/skills/verifying-changes/SKILL.md`.** Line 62's refusal sentences become the
   warning contract — the surviving refusals, the quoting obligation, and what a redirect warning
   means — and "Reading the blind pair" gains the general legitimate-redirect sentence. This is the
   last prose site that still names `anonymous-only.mjs`, which is why it comes **before** the
   deletion rather than after: the module is already unimported after Step 2, so removing the last
   reference to it while the file still exists leaves the repository consistent, whereas deleting
   the file first would leave the skill pointing at a path that does not exist.
   _Verify:_ a reader who has only this document can answer "what do I do when `warnings` is
   non-empty?" without opening the script.

4. **Delete `scripts/visual/anonymous-only.mjs` and `scripts/visual/__tests__/anonymous-only.test.mjs`,
   and correct the `tooling` doc comment in `vitest.config.ts`.**
   _Verify:_ `rg --hidden 'anonymous-only|anonymousOnly|ANONYMOUS_ONLY' -g '!.ai/specs/**' -g '!docs/agents/migration/**'`
   returns nothing — the spec itself and the tracker-migration archive are the two intended
   survivors; `pnpm lint` and `pnpm test` green. **`--hidden` is load-bearing:** without it ripgrep
   skips every dot-directory, so the command sees neither `.claude/` nor `.ai/`, which also makes
   the `!.ai/specs/**` exclusion inert. **And the gate belongs here, not on Step 3:** the
   `.claude/skills/verifying-changes/SKILL.md` reference is cleared by Step 3 and the two script
   files by this step, so "returns nothing" is first satisfiable at this point. Asserting it a step
   earlier — as an earlier draft did — made it unsatisfiable by construction.

5. **Run the full gate.** `.ai/agentic.config.json` → `validation.commands`, in order.
   _Verify:_ all seven commands green.

### Out of scope, recorded so it is not re-derived

- **A redirect that keeps the pathname but drops a query parameter the screen depends on**
  (`/atlas?filter=x` → `/atlas`). Same harm class, but no route in this repository is known to do it,
  and comparing query keys would warn on every URL the app normalises. Revisit with a real case.
- **A redirect to a different origin with the same pathname.** Ignoring host and port is what lets
  `localhost` and the reference demo compare as the same screen; it is a deliberate hole, not an
  oversight.
- **A 404 / `notFoundComponent` render.** A typo in `--url` does not redirect: the not-found screen
  renders at the requested pathname, so a pathname comparison is silent by construction. Closing it
  needs a different signal (a marker in the DOM), which is its own item.
- **Making `warnings` machine-checkable** — a structured `{ code, requested, landed }` entry, or a
  non-zero exit on any warning. The consumer is a reader, and Q6 keeps `captureValid` single-meaning.
- **A redirect triggered by `quiesce` or `--dismiss` in a capture that also passes `--click`.** Q4
  compares `landing` there, read before all three run, so such a redirect is missed. Closing it
  needs a second comparison point whose result has to be told apart from the caller's own
  navigation — a distinction this spec deliberately does not attempt.
- Anything about `--click`, `--hover`, `--enter` or `--dismiss` semantics beyond the Q4 boundary.
- Any change to `e2e/**`, to the journeys, or to ADR 0016's position that no pixel is compared to a
  stored one.
