# Pin the mobile-safari viewport explicitly instead of describing it in prose

| Field              | Value       |
| ------------------ | ----------- |
| **Status**         | implemented |
| **Issue**          | #151        |
| **Spec PR**        | #375        |
| **Implementation** | #379        |

Source issue: [#151](https://github.com/design4pro/planned.travel/issues/151) — "Pin the
mobile-safari viewport explicitly instead of describing it in prose". Filed by the sandcastle
deep-review (run 20260829-1) while reviewing #102. Every claim below was re-verified against
`develop` at `944b4103` rather than taken from the issue, and **the issue's stated harm did not
survive that check** — the harm is real, but it is a different one, and it is larger (see
**Problem Statement**).

## 📝 TLDR

`playwright.config.ts` pins the `chromium` project's viewport as code (`1440x900`, line 174) and
lets the `mobile-safari` project inherit its geometry invisibly from `devices['iPhone 15']`, with a
two-line comment restating what that geometry currently is. Neither line earns its place: the first
restates a value the code could simply hold, and the second is factually stale about the repository.
This spec deletes the comment, adds `viewport: { width: 393, height: 659 }` to the `mobile-safari`
project's `use` after the descriptor spread, and writes one clause into journey 7 saying the phone
geometry it measures against is pinned in the config. The pinned value equals today's descriptor
byte-for-byte, so no test changes behaviour. Test configuration only: no route, no schema, no locale
key, no user-facing pixel.

## 📝 Problem Statement

### What is actually at risk

`e2e/journeys.spec.ts:502-743` — journey 7, "a finger reaches the same facts on a phone", its doc
comment at `:502-539` and its body at `:540-743` — is the only reason the `mobile-safari` project
exists, and its assertions are **calibrated to a specific pixel geometry**, in numbers written into
the test and its doc comment:

| The number                       | Where                              | What it is                                                                                                                                                                                                     |
| -------------------------------- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| "a 393px handset"                | `e2e/journeys.spec.ts:507`, `:514` | The width the composition argument is made at                                                                                                                                                                  |
| "about 570 usable pixels of map" | `e2e/journeys.spec.ts:514`         | Viewport height minus the shell chrome — derived from 659, not from 852                                                                                                                                        |
| "wants five hundred and forty"   | `e2e/journeys.spec.ts:515-516`     | The panel's full height. It fits inside those 570, but consumes so much of them that no side of the country is left free — so the placement gives up height and takes an edge, which is the `squeezed` fitting |
| "measured at 0,595 98x64"        | `e2e/journeys.spec.ts:532`         | The dev-toolbar badge over the "Trips" tab. **595 + 64 = 659** — its box bottom _is_ the viewport                                                                                                              |
| `setViewportSize({ 360, 640 })`  | `e2e/journeys.spec.ts:691`         | A second, explicit width the same test drops to for the fold assertion                                                                                                                                         |

The badge row is the proof: the badge measurement is only true at a viewport height of exactly 659.
No code in this repository sets that number. It is named only in prose — the `mobile-safari` comment
this spec deletes (`playwright.config.ts:181`), journey 7's file header (`e2e/journeys.spec.ts:34`),
`e2e/helpers/settle.ts:195,352` and ADR 0016 — and prose cannot constrain a value. The geometry
itself is read at run time out of `playwright-core`'s `devices['iPhone 15']`, a table upstream
regenerates — the descriptor's own
user-agent string on `1.62.1` reads `Version/26.5`, so these entries demonstrably track Safari
releases rather than sitting frozen. `package.json` carries `"@playwright/test": "^1.62.1"` and
dependabot opens a minor-and-patch bump against this repository routinely (#294 is open now).

So the failure mode is: a version bump moves the iPhone 15 viewport, journey 7 silently starts
asserting a composition argument against a geometry the argument was not made about, and the diff a
reviewer reads is one line of `pnpm-lock.yaml`. The test either goes red for a reason no one can
locate in the diff, or — worse — stays green while covering a layout the design system never
reasoned about.

### The issue's own premise, which did not survive verification

The issue argues from screenshot baselines: "a version bump that changes the iPhone 15 descriptor
silently re-frames every `*mobile-safari-*.png` baseline with no reviewable diff", and points at
`e2e/visual.spec.ts` for the per-test `setViewportSize` literals (`360x640`, `2560x900`).

**Neither exists.** ADR 0016 (`docs/adr/0016-journeys-replace-the-visual-gate.md`, accepted
2026-09-03) removed `toHaveScreenshot`, `e2e/__screenshots__`, `snapshotPathTemplate`,
`pnpm e2e:update` and the whole visual gate; `e2e/visual.spec.ts` went with it in `91471d5b`.
`find . -name '*.png'` outside `node_modules` returns no baseline of any kind, and `e2e/` now holds
`auth.setup.ts`, `basemap-preference.spec.ts`, `csrf.spec.ts`, `helpers/`,
`i18n-runtime-parity.spec.ts`, `journeys.spec.ts` and `trips-core.spec.ts`. The surviving
`setViewportSize` literals are `360x640` and `360x900`, both in `journeys.spec.ts`.

This is stated rather than quietly worked around because it changes what the fix is worth. The
issue's version of the harm — stale photographs — is closed already, by deleting the photographs.
The version that is live is the one above, and it is **more** load-bearing than the issue claims,
because a pixel baseline going wrong is at least visible as a failing comparison, whereas an
assertion re-framed under an unchanged doc comment is not visible at all.

### The comment, which is also already wrong

```ts
// Includes `defaultBrowserType: 'webkit'`, touch and a 393x659 viewport;
// its 393x852 is the device `screen`, which is never captured.
```

Line 1 restates a value the code could simply hold, which is the issue's objection and is correct.
Line 2 says the `screen` "is never captured" — a sentence about the visual gate that ADR 0016
deleted. **Nothing** is captured by Playwright now. The comment is a worked example of its own
problem: prose that describes a value it does not control, next to prose that describes a mechanism
that no longer exists.

### Why one item (docs/SPEC.md §8)

The concept is _"the phone geometry the journeys are calibrated to"_, and it is true in two places
at once: the `mobile-safari` project's `use` block, which supplies it, and journey 7's doc comment
and measurements, which spend it. Half of this landing — pinning the number without saying where the
393px handset in the comment comes from, or annotating the test without pinning the number — leaves
the repository still unable to answer "what happens on a playwright bump" from either file.
**Owner module: `playwright.config.ts`**, which owns the geometry; `e2e/journeys.spec.ts` gains one
clause pointing at it and nothing else.

## 📝 Resolved assumptions (autonomous defaults)

This spec was written unattended. Each answer below is the most reversible reading; override any of
them on the PR before merge.

| #   | Question                                                                                  | Applied default                                                                                                                                    | Why                                                                                                                                                                                                                                                                                                    |
| --- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Q1  | Does the comment "collapse to nothing", as the issue directs, or is it replaced?          | **Replaced by the short comment block quoted in Architecture**, which names _why_ the number is pinned, never what the descriptor currently holds. | The issue's objection is to prose that restates a value the code can hold — and that objection is fully honoured, because the replacement asserts nothing about `devices['iPhone 15']`. `659` is not a self-explaining number, and the reason it must not move is not derivable from the config alone. |
| Q2  | Pin `screen` (`393x852`), `deviceScaleFactor` or the user-agent too?                      | **No.** Only `viewport`; everything else keeps coming from the spread.                                                                             | Viewport is what the layout, `100dvh` and every journey-7 measurement resolve against. Nothing in `e2e/**` or `src/**` reads `window.screen`, and pinning a user-agent would freeze the WebKit persona the project exists to exercise.                                                                 |
| Q3  | Touch `e2e/journeys.spec.ts` at all?                                                      | **Yes — one clause**, in journey 7's existing doc comment, and no assertion or literal changes.                                                    | §8: the concept is true in both files. Without it the pin looks arbitrary from the config and the `393px handset` looks like a coincidence from the test. Bounded to a clause so it stays a surgical change.                                                                                           |
| Q4  | Add a drift assertion — a test that `devices['iPhone 15'].viewport` still equals the pin? | **No.**                                                                                                                                            | It would re-couple exactly what the pin decouples, and go red on a legitimate upstream bump that changes nothing about this product. After the pin the descriptor's viewport is simply not consulted; a divergence is the pin working, not a defect.                                                   |
| Q5  | Pin the `setup` project's `Desktop Chrome` viewport for symmetry?                         | **No.** Out of scope.                                                                                                                              | `setup` signs in and writes storage state; it asserts no layout, so no number of its is load-bearing. Pinning it would be speculative symmetry.                                                                                                                                                        |
| Q6  | Is a re-run or re-baselining of the suite required?                                       | **No re-baselining exists to do**; the gate runs the suite anyway.                                                                                 | Verified: `devices['iPhone 15'].viewport` on `playwright-core@1.62.1` is `{ width: 393, height: 659 }`, byte-for-byte the pinned value, so every journey runs at the identical geometry. And there is no stored pixel to re-record (ADR 0016).                                                         |
| Q7  | The issue is labelled `feature`; is it one?                                               | **Recorded, not corrected here.** The spec PR carries `documentation`; the implementation PR should carry `refactor`.                              | It ships no capability — it moves a value from an upstream table into this repository. Relabelling someone else's issue is not this skill's mutation to make; naming it is enough for the human who grooms it.                                                                                         |

None carries a security, tenancy or product-decision risk. The change touches no runtime code, no
D1 schema, no locale key and no surface listed in `BACKWARD_COMPATIBILITY.md`.

## 📝 Proposed Solution

Three edits, one commit.

1. **Pin the viewport.** `viewport: { width: 393, height: 659 }` in the `mobile-safari` project's
   `use`, after the `...devices['iPhone 15']` spread so it wins, exactly as `chromium` does in the
   project above it (`:174`).
2. **Delete the two-line comment** and put in its place the short comment block quoted in
   **Architecture**, saying the pin is deliberate and what depends on it.
3. **One clause in journey 7's doc comment** pointing at the config as the owner of the 393px
   handset it argues about.

### Alternatives considered

- **Pin, and delete the comment outright** (the issue's literal direction). Rejected under Q1 for
  one reason: `1440x900` is a round number a reader accepts without explanation, and `393x659` is
  not — a reader who does not know it is load-bearing is a reader who "tidies" it to `393x852` to
  match the device, or to `390x844` for an older phone, and takes journey 7's fitting assertions
  with them. The comment that remains says nothing the descriptor could falsify.
- **A drift test asserting pin == descriptor.** Rejected under Q4: it rebuilds the coupling the pin
  removes, and converts a harmless upstream bump into a red suite.
- **A shared `PHONE_VIEWPORT` constant imported by config and journeys.** Rejected: `journeys.spec.ts`
  never names 659 in code — the number lives in prose and in derived measurements — so the constant
  would have exactly one consumer, and `playwright.config.ts` would gain an import for it. An
  abstraction for a single use, which CLAUDE.md forbids.
- **Switch the project to a newer device descriptor** (`iPhone 15 Pro`, and so on). Rejected: it is
  the same silent re-framing this spec exists to prevent, performed deliberately once. If the
  product wants a different reference phone, that is a change to journey 7's composition argument
  and belongs in its own item with its own measurements.

## 📝 Architecture

### `playwright.config.ts` — edited

| Site                             | Change                                                                                                                                                                                        |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `:181-182`, the two-line comment | Deleted. Line 1 restates the descriptor; line 2 describes a capture mechanism ADR 0016 removed.                                                                                               |
| `:183`, the `use` block          | Expanded to the multi-line form `chromium` already uses, gaining `viewport: { width: 393, height: 659 }` after the spread and before `extraHTTPHeaders`, with the comment block quoted below. |

The resulting project, in full:

```ts
{
  name: 'mobile-safari',
  dependencies: ['setup'],
  use: {
    ...devices['iPhone 15'],
    // Pinned rather than inherited: journey 7's composition argument is measured
    // against this exact geometry (`e2e/journeys.spec.ts`), so a playwright bump
    // must not move it under the test. Everything else — WebKit, touch, the
    // device scale and the user agent — still comes from the descriptor.
    viewport: { width: 393, height: 659 },
    extraHTTPHeaders: clockPin,
  },
},
```

Property order matters and is the same order `chromium` uses: the spread first, the override after.
Playwright merges `use` shallowly, so `viewport` replaces the descriptor's key outright and leaves
`screen`, `deviceScaleFactor`, `isMobile`, `hasTouch`, `userAgent` and `defaultBrowserType`
untouched.

### `e2e/journeys.spec.ts` — edited

One clause, in numbered item 2 of journey 7's doc comment, where the composition argument states its
width — "A 393px handset leaves about 570 usable pixels of map" (`:514`) — recording that the
geometry is pinned in `playwright.config.ts` and not inherited. The phrase also occurs earlier, in
the block's opening paragraph (`:507`); item 2 is where the number is spent, so that is where the
clause belongs. No assertion, no locator, no literal and no `setViewportSize` call changes — the
`360x640` fold assertion at `:691` and the `360x900` impersonation width at `:1445` are per-test
overrides of a different kind and stay exactly as they are.

### Files this spec does **not** touch

`package.json` and `pnpm-lock.yaml` (no dependency moves), the `setup` and `chromium` projects, every
other file under `e2e/`, all of `src/**`, `drizzle/**`, the locale catalogue, and
`BACKWARD_COMPATIBILITY.md`.

## 📝 Data Model

None. No table, column, migration, KV key or R2 object is involved.

## 📝 API Contracts

None. `playwright.config.ts` is consumed by the Playwright runner and by nothing this repository
ships; no server function, route, HTTP surface or exported type changes. The nearest thing to a
contract here is the geometry each project runs at, and this change makes that contract explicit for
the first time rather than altering it.

## 📝 UI/UX

None. No screen, flow, state or accessibility surface changes.

## 📝 Visual change expected

**None.** This is test configuration; no route renders differently in light or dark, on desktop or
mobile. Per docs/SPEC.md §7.4 and its "Who owns the visual judgement" section, an item that owns no
screen is judged
on its code, its tests and its stated contract, so the blind A/B pair is not the evidence here. The
evidence is `bash .ai/scripts/e2e.sh` green with an unchanged `mobile-safari` result set — the
positive claim being that pinning the value the suite already ran at changes nothing.

## 📝 Copy

**None.** No user-facing string is added, changed or removed, so no key enters the 23-locale
catalogue. The only new text is a source comment in `playwright.config.ts`, which is developer-facing
and correctly hardcoded in English (docs/SPEC.md §9 governs what the product renders, not what its
configuration explains).

## 📝 Edge Cases & Failure Scenarios

| Scenario                                                            | Behaviour after this change                                                                                                                                          |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The suite runs today, on `playwright-core@1.62.1`                   | Identical. The pin is byte-for-byte the descriptor's current value, verified.                                                                                        |
| A dependabot bump changes `devices['iPhone 15'].viewport`           | Journey 7 keeps running at `393x659`. The bump's diff no longer silently re-frames it. **This is the whole point.**                                                  |
| A bump changes the descriptor's `screen`, UA or `deviceScaleFactor` | Still inherited, still silent — deliberately, per Q2. None of journey 7's measurements resolves against any of them.                                                 |
| Someone "tidies" the pin to `393x852` to match the device screen    | Journey 7's `data-fit` and tab-bar assertions go red, in a diff that shows the viewport line. That is the reviewable failure the current arrangement cannot produce. |
| Journey 7 sets `360x640` mid-test (`:691`)                          | Unchanged. A per-test `setViewportSize` overrides the project viewport for the rest of the test, exactly as it overrides the descriptor's today.                     |
| The `setup` project                                                 | Unchanged — `Desktop Chrome`, unpinned (Q5). It asserts no layout, and its storage state is geometry-independent.                                                    |
| A future phone journey lands in another spec file                   | It runs at the pinned geometry, which is now readable in the config instead of inferable from playwright-core.                                                       |
| The product decides to target a different reference phone           | A deliberate, reviewable one-line change with journey 7's measurements re-derived beside it — which is what the comment tells the person making it.                  |

## 📝 Risks & Impact Review

- **Blast radius.** One config file, one doc comment in one test file. No runtime code, no bundle, no
  migration, no locale key. `pnpm build`, `pnpm typecheck`, `pnpm lint` and `pnpm test` cannot be
  affected; `bash .ai/scripts/e2e.sh` runs the same geometry it runs today.
- **Behavioural risk: none, and it is measurable rather than asserted.** The pinned pair equals the
  installed descriptor's pair. Re-verify at implementation time with
  `node --input-type=module -e "const { devices } = await import('@playwright/test'); console.log(JSON.stringify(devices['iPhone 15'].viewport))"`
  and paste the output in the PR; if it is not `{"width":393,"height":659}`, the lockfile moved since
  this spec was written and the pin, the journey-7 measurements and the comment all have to be
  reconciled in the same PR rather than the number being copied over.
- **Compatibility.** `BACKWARD_COMPATIBILITY.md` protects no test-configuration surface, and nothing
  outside Playwright reads this file.
- **The residual gap, stated rather than left to be found.** The rest of the descriptor is still
  inherited, so a bump can still change the user agent or the device scale factor under the suite
  without a reviewable diff. That is accepted (Q2): no assertion depends on those, and pinning them
  would freeze the WebKit persona the project exists to exercise. If one ever starts to depend on
  them, it is a new item with its own reason.
- **Rollback.** One revert, and the suite returns to inheriting the geometry. No data or schema state
  to undo.

## 📋 Phasing

One phase, one step. §8 forbids splitting it: the config pin and the clause that explains it are the
same concept in two files, and either half alone leaves the repository unable to answer "what happens
on a playwright bump" from either file.

## 📋 Implementation Plan

### Phase 1 — the geometry becomes code

1. **Pin the viewport and settle the prose.** Delete `playwright.config.ts:181-182`, expand the
   `mobile-safari` `use` block to the multi-line form with
   `viewport: { width: 393, height: 659 }` after the spread and the comment block from
   **Architecture**; add the pointing clause to journey 7's doc comment in `e2e/journeys.spec.ts`.
   _Verify:_ the descriptor read above prints `{"width":393,"height":659}` (paste it in the PR);
   `rg 'never captured' playwright.config.ts` returns nothing; then the full gate —
   `.ai/agentic.config.json` → `validation.commands`, all seven in order, with
   `bash .ai/scripts/e2e.sh` green and the `mobile-safari` project reporting the same passes and
   skips as `develop`.

### Out of scope, recorded so it is not re-derived

- Pinning `screen`, `deviceScaleFactor` or the user agent (Q2), and pinning the `setup` project (Q5).
- Any drift assertion tying the pin back to the descriptor (Q4).
- Changing the reference phone, or any of journey 7's measurements, assertions or `setViewportSize`
  literals.
- Anything about ADR 0016's position that no pixel is compared to a stored one.
- Re-labelling issue #151 from `feature` to `refactor` (Q7) — named for the human who grooms it.
