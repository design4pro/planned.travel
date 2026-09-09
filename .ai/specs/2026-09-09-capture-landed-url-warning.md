# Report the landed URL instead of a list of anonymous-only routes

Source issue: [#132](https://github.com/design4pro/planned.travel/issues/132) — "Report the landed
URL instead of maintaining a list of anonymous-only routes". Filed by the sandcastle deep-review
(run 12177) while reviewing #101; every claim below was re-verified against `develop` rather than
taken from the issue, and two of its premises did not survive that check (see **Problem
Statement**).

## 📝 TLDR

`scripts/visual/capture.mjs` already prints the URL it was asked for and the URL each frame was
actually taken on, but nothing compares the two — so a redirect files a photograph of the wrong
screen under the right filename and reports `captureValid: true`. Two redirects are caught today by
a hardcoded list of anonymous-only routes whose upkeep is a drift test; every role-dependent
redirect is wide open. This spec replaces the list with one universal comparison: when a frame's
landing pathname differs from the requested one, `warnings` gains an entry. The list, its drift
test and the prose that documents them are then deleted, and the obligation to quote a warning —
which used to live in a file that no longer exists — is written into
`.claude/skills/verifying-changes/SKILL.md`, the one document that still owns how this script is
read. Tooling only: no route, no schema, no locale key, no user-facing pixel.

## 📝 Problem Statement

The harm is a capture that photographs screen B, files it under the name of screen A, and tells
everybody downstream that it went fine. A blind critic handed that frame reports a defect of the
capture as a defect of the product — the failure mode `capture.mjs` exists to prevent (its own
header comment, lines 5–11).

Every fact, verified on `develop` at `0d938e1a`:

| Claim                                 | Where                                                  | State                                                                                                    |
| ------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| The requested URL is reported         | `scripts/visual/capture.mjs:375`                       | `requestedUrl` is in the JSON                                                                            |
| The landed URL is reported, per frame | `scripts/visual/capture.mjs:355`                       | `landedUrl`, read at the shutter                                                                         |
| Nothing compares them                 | `scripts/visual/capture.mjs`                           | no comparison exists; `warnings` only ever carries a viewport mismatch (`:326`) or a flat frame (`:345`) |
| The hardcoded list                    | `scripts/visual/anonymous-only.mjs:25`                 | two entries — `/login`, `/register`                                                                      |
| Its drift test                        | `scripts/visual/__tests__/anonymous-only.test.mjs:117` | re-derives the list from `src/routes/(auth)/` with a regex over the route sources                        |
| The refusal, and its gate             | `scripts/visual/capture.mjs:210-214`                   | `--auth` only; `exit 2`, no frame filed                                                                  |
| A role-dependent redirect, uncaught   | `src/routes/_app/console/route.tsx:38-43`              | a `user`-role session asking for `/console` is redirected to `/dashboard`; `captureValid: true`, silent  |
| A legitimate redirect, uncaught       | `src/routes/_app/trips/$tripId/index.tsx:28`           | `/trips/<id>` → `/trips/<id>/<tab>`; `captureValid: true`, silent                                        |
| The stale-session hard error          | `scripts/visual/capture.mjs:292-298`                   | `--auth` + landed on `/login` → throw, `exit 1`                                                          |
| The prose that documents the list     | four sites (below)                                     | all four still describe a refusal                                                                        |

### Two premises of the issue that did not survive verification

Both are stated here rather than quietly worked around, because each changes what the change is
allowed to delete.

1. **"a new vitest project" is neither new nor scripts-only.** The project is `tooling` in
   `vitest.config.ts`, and it also runs the eight other script test files
   (`scripts/__tests__/`, `scripts/ci/__tests__/`, `scripts/sentry-triage/__tests__/`,
   `scripts/visual/__tests__/click-through.test.mjs`), `e2e/helpers/__tests__/`,
   `vite.config.test.ts` and the Claude Code hook tests. Deleting the project would stop running
   all of them, silently — the exact failure its own doc comment says it exists to prevent. **Only
   the one test file is deleted.** What the issue is actually objecting to is the _drift test_, and
   the fix for a drift test is to remove the thing that drifts, not the runner.

2. **`.sandcastle/pixel-capture-prompt.md` no longer exists.** The whole `.sandcastle/` directory
   was removed in `e55697f6` when cezar replaced the orchestrator (ADR
   `docs/adr/0014-cloud-routines-replace-sandcastle.md`). The issue's argument — "the existing
   contract already forces every `warnings` entry to be quoted in `skippedReason`, so the blindness
   is closed" — therefore rests on a contract with no home. Without giving it one, trading a hard
   refusal for a warning nobody is obliged to read is a strict downgrade for `/login` and
   `/register`. **This spec gives the contract a home** — `.claude/skills/verifying-changes/SKILL.md`
   §"Probing the running app", which is already the document that tells a reader how to run and read
   this script — and makes the script say so itself on stderr. That is the load-bearing part of the
   change; the deletions are the cheap part.

### Why one item and not three (docs/SPEC.md §8)

The concept is _"did the capture photograph the screen it was asked for?"_, and it is true in five
places at once:

- `scripts/visual/anonymous-only.mjs` — the list and its four-paragraph rationale
- `scripts/visual/__tests__/anonymous-only.test.mjs` — the drift test
- `scripts/visual/capture.mjs:22-24, 55, 206-214` — the header paragraph, the import, the refusal
- `vitest.config.ts` — the `tooling` doc comment's clause "which screens `capture.mjs` refuses to
  photograph signed in"
- `.claude/skills/verifying-changes/SKILL.md:62` — the sentences describing the refusal to whoever
  runs the pair

Half of this landing leaves the repository claiming a refusal the script no longer performs, which
is worse than either end state. **Owner module: `scripts/visual/capture.mjs`**, with the new pure
sibling `scripts/visual/landed-url.mjs` — the same shape `click-through.mjs` already has, and the
one `anonymous-only.mjs` vacates.

## 📝 Resolved assumptions (autonomous defaults)

This spec was written unattended. Each answer below is the most reversible reading of the issue;
override any of them on the PR before merge.

| #   | Question                                                                                 | Applied default                                                                                                         | Why                                                                                                                                                                               |
| --- | ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Delete the `--auth` refusal for `/login` and `/register`, or keep it beside the warning? | **Delete it**, as the issue asks — but only together with the quoting contract of premise 2.                            | The issue is the repository owner's stated direction. The refusal's value is not lost, it is generalised; conditioning the deletion on the contract is what keeps it a net gain.  |
| Q2  | Delete the vitest project the issue names?                                               | **No** — delete only `scripts/visual/__tests__/anonymous-only.test.mjs`.                                                | Premise 1: the `tooling` project runs eleven other things. Deleting it would silently unrun them.                                                                                 |
| Q3  | Warn only under `--auth`, or on every capture?                                           | **Every capture**, `--auth` or not.                                                                                     | The failure class is "the browser did not land where you pointed it", which has nothing to do with the session. Restricting it would rebuild a special case.                      |
| Q4  | Compare the shutter URL, or the URL the page landed on before `--hover`/`--click`?       | **The landing** — `page.url()` read right after `settle()`. `landedUrl` in the JSON stays the shutter read, unchanged.  | A `--click` that navigates is deliberate and already documented as such (`capture.mjs:351`); warning on it would make the warning routine, and a routine warning is not read.     |
| Q5  | One warning per frame, or one per distinct redirect?                                     | **One per distinct redirect**, deduplicated across the eight frames.                                                    | Eight identical sentences bury the other warnings. Deduplication is `warnings.includes(w)` — no new structure.                                                                    |
| Q6  | Does a redirect set `captureValid: false`?                                               | **No.** `captureValid` stays the toolchain verdict it is today.                                                         | The frames are valid photographs — of the wrong screen. Conflating the two would make `captureValid` mean two things, and `exit 2` on a legitimate `/trips/<id>` redirect.        |
| Q7  | Keep the stale-session hard error?                                                       | **Keep it, narrowed:** it fires only when the _requested_ pathname is not itself `/login`.                              | The issue says to keep it. Unnarrowed, deleting the refusal turns "you asked for `/login` with `--auth`" into a false "your session is stale" — a new bug created by this change. |
| Q8  | Where does "quote every `warnings` entry" live now?                                      | `.claude/skills/verifying-changes/SKILL.md`, plus a one-line stderr notice from the script when it emitted any warning. | It is the document that already owns how the pair is run and read (CLAUDE.md lists it as a project skill). A second copy elsewhere would be a claim in two places (§8).           |

None of these carries a security, tenancy, compatibility or product-decision risk: the change
touches no runtime code, no D1 schema, no locale key and no protected surface in
`BACKWARD_COMPATIBILITY.md`.

## 📝 Proposed Solution

One comparison, in one place, replacing a list of two special cases.

1. **`scripts/visual/landed-url.mjs` — new, pure, ~25 lines.** Exports one function:

   ```js
   redirectWarning({ requestedUrl, landedUrl, wantsAuth }) // → string | undefined
   ```

   It normalises both URLs to a pathname (`new URL(u).pathname`, trailing slashes stripped, empty →
   `/`) and returns `undefined` when they match. Query, hash, port and host are ignored: a
   `?redirect=` that survives a round trip is not a wrong screen, and the reference host and
   `localhost` are the same screen by pathname. When they differ it returns one sentence naming both
   pathnames, what was therefore filed, and the two fixes — point `--url` at the landing, or, under
   `--auth`, capture the screen without the flag.

2. **`capture.mjs` calls it once per frame.** After `settle()`, the landing URL is read into a
   local; the warning is pushed where the frame is filed, so a frame rejected by the viewport gate
   never contributes one. Deduplication keeps eight frames of the same redirect to one entry.

3. **The refusal and its list go.** `anonymousOnlyRefusal` is unimported, `anonymous-only.mjs` and
   its drift test are deleted, and the four prose sites are settled: three deleted, the fourth —
   `verifying-changes` — rewritten into the new contract.

4. **The stale-session error stays, narrowed** per Q7.

### Alternatives considered

- **Keep the list and add the warning.** Rejected: the list's cost is not the two entries, it is the
  drift test that re-derives them from `src/routes/(auth)/` with a regex over route sources — a
  second, fragile model of the router maintained so a two-line constant stays honest. Once every
  redirect warns, the two entries buy a marginally louder failure for the two screens that already
  had one, at that price.
- **An allowlist of _legitimate_ redirects** (so `/trips/<id>` → `/plan` stays silent). Rejected: it
  is the same hardcoded, drifting list this issue deletes, inverted. A true warning on a known
  redirect is answered in one word by whoever quotes it.
- **`exit 2` on any redirect.** Rejected under Q6: it would refuse the legitimate
  `/trips/<id>` capture the current comments explicitly protect (`anonymous-only.mjs:15-17`), at the
  cost of a capture round.
- **Compare inside the existing `warnings` push sites without a module.** Rejected: `capture.mjs`
  runs `need('url')` and `process.exit` at import time, so nothing in it can be unit-tested. A pure
  sibling is the pattern the directory already uses twice.

## 📝 Architecture

### `scripts/visual/landed-url.mjs` — new

The whole module surface:

| Export                                                    | Contract                                                                                                                                      |
| --------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `redirectWarning({ requestedUrl, landedUrl, wantsAuth })` | `undefined` when the two normalised pathnames are equal; otherwise a single-sentence warning naming both pathnames and the fix. Pure, no I/O. |

It knows nothing about this repository's routes — which is the point. There is no list to drift, so
there is nothing for a drift test to guard, and its own unit test asserts behaviour rather than a
claim about `src/routes/`.

Normalisation, kept identical to the rule `anonymous-only.mjs` used so no case regresses:

```js
const pathnameOf = (u) => new URL(u).pathname.replace(/\/+$/, '') || '/'
```

### `scripts/visual/capture.mjs` — edited

| Site                                           | Change                                                                                                                                                                                |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Header comment, lines 22-24                    | Deleted. Replaced by one sentence in the "Prints one JSON object" paragraph: every frame reports its landing, and a landing that is not the requested pathname is a `warnings` entry. |
| `import … from './anonymous-only.mjs'` (`:55`) | Deleted; `import { redirectWarning } from './landed-url.mjs'` added.                                                                                                                  |
| The refusal block (`:206-214`)                 | Deleted. The two remaining pre-flight refusals (`--auth` + `--enter`, missing `e2e/.auth/demo.json`) are untouched.                                                                   |
| The stale-session throw (`:292-298`)           | Guarded by `pathnameOf(url) !== '/login'` (Q7).                                                                                                                                       |
| After `settle(page, …)`                        | `const landing = page.url()` — read before `quiesce`, `--dismiss`, `--hover` and `--click`.                                                                                           |
| Where the frame is filed (`:352-360`)          | `const w = redirectWarning({ requestedUrl: url, landedUrl: landing, wantsAuth })`; push when defined and not already present.                                                         |
| After the JSON is printed                      | When `warnings.length`, one stderr line: the frames are filed, and every warning must be quoted in the result that reports this capture.                                              |

`landedUrl` in each `files[]` entry keeps its current meaning — the shutter read — because it is the
honest record of what the PNG shows, and a `--click` that navigates should still be visible there.

### `vitest.config.ts` — edited

The `tooling` project stays exactly as it is. One clause of its doc comment — "which screens
`capture.mjs` refuses to photograph signed in" — is replaced by "how `capture.mjs` decides a frame
was taken on the screen it was asked for". No `include` glob changes; the deleted test file simply
stops matching.

### `.claude/skills/verifying-changes/SKILL.md` — edited

Line 62's two `--auth` refusal sentences are replaced. The new text keeps the two surviving
refusals (missing `e2e/.auth/demo.json`; `--auth` with `--enter`), drops the anonymous-only one, and
states the contract that premise 2 left homeless, in the imperative the rest of that skill uses:
**every entry in `warnings` is quoted verbatim in whatever reports the capture; a redirect warning
means the frame is a photograph of a different screen than its filename claims.** The existing
"Reading the blind pair" section gains one bullet listing the redirects that are expected today
(`/trips/<id>` → its tab; a role-gated `/console` for a `user` session), so a reader meets them as
known rather than as a discovery.

### Files this spec does **not** touch

`scripts/visual/click-through.mjs` and its test, every `src/**` route, `e2e/**`, `drizzle/**`, the
locale catalogue, `BACKWARD_COMPATIBILITY.md`, and `docs/agents/migration/issues-2026-09-02.json`
(an archive of the tracker migration — it quotes this issue's title and is not a live claim).

## 📝 Data Model

None. No table, column, migration, KV key or R2 object is involved.

## 📝 API Contracts

The only public surface is the JSON object `capture.mjs` prints on stdout. It is consumed by
humans and agents reading it, never parsed by code in this repository.

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
output breaks. Exit codes are unchanged except that `--auth` on `/login` or `/register` no longer
exits 2 — it captures, and warns.

## 📝 UI/UX

None. No screen, flow, state or accessibility surface changes.

## 📝 Visual change expected

**None.** This is developer tooling under `scripts/` plus two documents; no route renders
differently in light or dark, on desktop or mobile. Per docs/SPEC.md §7.4 and §8 ("who owns the
visual judgement"), an item that owns no screen is judged on its code, its tests and its stated
contract — so the blind A/B pair is not the evidence here. The evidence is the unit test plus one
live capture run against `/console` and `/dashboard` (Phase 1, Step 2), whose JSON goes in the PR.

## 📝 Copy

**None.** No user-facing string is added, changed or removed, so no key enters the 23-locale
catalogue. The warning sentence and the stderr notice are developer-facing output of a Node script
that never runs in the app, are never rendered to a user, and are therefore correctly hardcoded in
English (docs/SPEC.md §9 governs what the product renders, not what the toolchain prints).

## 📝 Edge Cases & Failure Scenarios

| Scenario                                               | Behaviour after this change                                                                                                                                          |
| ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--auth --url …/login`, session valid                  | Lands `/dashboard`. Frame filed, warning names both pathnames. **Was**: `exit 2`, no frame. The whole trade of Q1.                                                   |
| `--auth --url …/login`, session stale                  | Lands `/login` — the requested screen. No warning, no error, frame filed. Q7's narrowing is what prevents a false "your session is stale".                           |
| `--auth --url …/dashboard`, session stale              | Lands `/login`. The stale-session throw still fires, with its `playwright test --project=setup` fix. Unchanged.                                                      |
| `--auth --url …/console`, `user`-role session          | Lands `/dashboard`. Warning. **Was**: silent `captureValid: true` — the case that motivated the issue.                                                               |
| `--url …/trips/<id>`                                   | Lands `/trips/<id>/plan`. Warning, every run. Accepted: it is true, and it is answered in one word by the reader. Reintroducing an allowlist is explicitly rejected. |
| `?redirect=`, a trailing slash, or a `#hash` differing | No warning — pathname comparison, normalised.                                                                                                                        |
| `--click` navigates away from the requested screen     | No warning (Q4 compares the landing). `files[].landedUrl` still records where the shutter fired.                                                                     |
| `--enter` (the reference demo)                         | `enterThrough` runs once before the viewport loop; each frame's `page.goto(url)` still requests the same URL, so nothing changes for the reference half.             |
| A viewport measured wrong, frame not filed             | No warning — the push sits after the viewport gate, so `warnings` describes only frames that exist.                                                                  |
| The dev server is broken (`toolchainBroken`)           | Unchanged: `captureValid: false`, `exit 2`. A redirect warning may sit beside it and is harmless.                                                                    |
| A future route gains a signed-in redirect              | Warned automatically. This is the whole point: no list to update, no drift test to fail, no round lost to a screen nobody had listed.                                |

The one failure mode this change cannot close by itself: a reader who does not quote the warning.
That is why premise 2's contract is a Step in the plan and not a footnote.

## 📝 Risks & Impact Review

- **Blast radius.** Two script files, one test file, one config comment, one skill document. No
  runtime code, no bundle, no migration, no locale. `pnpm build` cannot be affected; `pnpm test`
  loses one file and gains another.
- **The regression this trades for.** `/login` and `/register` under `--auth` go from a hard stop to
  a warning. Mitigated by Q8 (the contract in `verifying-changes` plus the stderr notice) and
  bounded by the fact that both screens are captured without `--auth` in normal use, which is what
  the old refusal told you to do anyway.
- **Warning fatigue.** `/trips/<id>` warns on every capture of a trip. If that proves noisy in
  practice the answer is to capture `/trips/<id>/plan` directly, not to add an allowlist.
- **Compatibility.** `BACKWARD_COMPATIBILITY.md` protects no `scripts/**` surface, and the JSON
  change is additive within an existing array. Nothing outside this repository consumes it.
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
   trailing slash, query and hash → `undefined`; differing pathnames → a string naming both; the
   `--auth` variant mentioning the flag; a different origin with the same pathname → `undefined`.
   _Verify:_ `pnpm test` green — the new file runs in the existing `tooling` project with no config
   change, which also proves Q2's claim that the project was never anonymous-only's private home.

2. **Wire it into `capture.mjs`.** The landing read, the deduplicated push, the stderr notice, the
   narrowed stale-session guard, and the deleted import, refusal block and header paragraph.
   _Verify:_ `pnpm typecheck`, `pnpm lint`, then three live captures against a running dev server —
   `/dashboard` with `--auth` (no warning), `/console` with a `user`-role session (warning naming
   `/dashboard`), `/login` with `--auth` (frame filed, warning, no `exit 2`). Paste the three JSON
   objects into the PR: they are this item's evidence in place of a blind pair.

3. **Delete `scripts/visual/anonymous-only.mjs` and `scripts/visual/__tests__/anonymous-only.test.mjs`,
   and correct the `tooling` doc comment in `vitest.config.ts`.**
   _Verify:_ `rg 'anonymous-only|anonymousOnly|ANONYMOUS_ONLY'` returns only
   `docs/agents/migration/issues-2026-09-02.json` (the archive); `pnpm lint` and `pnpm test` green.

4. **Rewrite `.claude/skills/verifying-changes/SKILL.md`.** Line 62's refusal sentences become the
   warning contract — the surviving refusals, the quoting obligation, and what a redirect warning
   means — and "Reading the blind pair" gains the known-redirects bullet.
   _Verify:_ the skill names no file that does not exist (the `rg` from Step 3), and a reader who has
   only this document can answer "what do I do when `warnings` is non-empty?" without opening the
   script.

5. **Run the full gate.** `.ai/agentic.config.json` → `validation.commands`, in order.
   _Verify:_ all seven commands green.

### Out of scope, recorded so it is not re-derived

- Making `warnings` machine-checkable (a structured `{ code, requested, landed }` entry, or a
  non-zero exit on any warning). The consumer is a reader, and Q6 keeps `captureValid` single-meaning.
- Anything about `--click`, `--hover`, `--enter` or `--dismiss` semantics beyond the Q4 boundary.
- Any change to `e2e/**`, to the journeys, or to ADR 0016's position that no pixel is compared to a
  stored one.
