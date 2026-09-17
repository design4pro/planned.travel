# 0022. WebKit runs nightly, not on every pull request

Status: accepted
Date: 2026-09-17
Amends: ADR 0016 (the cost table, and which browser projects a pull request pays for), ADR 0021 (one of the two failure classes it counted as CI-only is no longer caught on a pull request).

## Context

ADR 0016 bought a feedback loop and said what it cost: **~22 min of runner an event, ~6 events a
merge, ~132 min against the ~60 the post-merge net used to cost.** It closed by naming the lever if
that trade stopped being worth it - "the trigger, not the shard count". This decision pulls a third
lever the table did not consider: **which browser projects a pull request pays for.**

The measurement that forced it. The `e2e` job in `ci.yml` invokes Playwright with a shard argument
and no `--project` filter, so `--shard` divides every test from both projects by count. Run
35101667571 instrumented a shard from the inside (`.github/actions/e2e-env/action.yml`) and found
that nothing was being exhausted - `MemAvailable` never fell below 19 GB of 32 GB, the workerd
process count never moved - and that **the split fell along project lines**:

| shard | project         | tests | wall clock                  |
| ----- | --------------- | ----- | --------------------------- |
| 1     | `chromium`      | 52    | 882 s                       |
| 2     | `mobile-safari` | 52    | over the 900 s it was given |

Shard 2 was not leaking and was not sharing a bad dev server. It was WebKit, and it was out of wall
clock. Playwright cut it at `globalTimeout` with `20 did not run`, and CI went red with **nothing
failing**. That is issue #466, and it recurs on any branch that adds a journey, because shard 1 sits
at 98% of the same budget.

So a pull request was paying for the slower half of the suite on every event, on a shared
self-hosted pool, and the most visible return lately was a timeout rather than a caught defect.

## Decision

**`mobile-safari` comes off the pull-request path. It is not deleted.**

1. `playwright.config.ts` declares the project behind `runsWebKit` - `!isCI || E2E_WEBKIT === '1'`.
   A local run is unchanged and still carries both projects. A CI run that did not ask for WebKit
   does not get it, and `--project=mobile-safari` there fails loudly rather than matching nothing.
2. `.github/workflows/e2e-webkit.yml` runs the project nightly at 03:30 UTC against `develop`, in
   two shards, with `workflow_dispatch` for an on-demand run against any ref.
3. The `ci.yml` `e2e` job is untouched. It keeps its two shards, its `globalTimeout` and its
   `timeout-minutes`; the same ~52 chromium tests that used to fill one shard whole now split
   across both.

**This is a move, not a retirement.** WebKit has caught defects Chromium cannot see, and the four
comments naming the project say so in their own words: an `Intl` divergence between WebKit 26.5 and
workerd across the locale catalogue (`e2e/i18n-runtime-parity.spec.ts`), a date-heading hydration
mismatch (`e2e/trips-core.spec.ts`), a module-import page error on every console route
(`e2e/helpers/admin.ts`), and journey 7, which exists for the pinned 393x659 composition alone
(`e2e/journeys.spec.ts`). Each of those comments now also says where the project runs.

## Consequences

### What is given up, stated plainly

**A WebKit-only regression is found within a day, against `develop`, instead of within the hour,
against the branch that caused it.** That is the whole of the trade, and it is the same trade ADR
0016 made in the other direction for the suite as a whole - reversed here for one project, on the
evidence that this project's share of the cost was the larger one and its share of the findings was
not proportional.

**The nightly is a net, not a gate.** It blocks nothing. A failing scheduled run notifies the last
person to touch the workflow file and nobody else, and GitHub disables a schedule after 60 days
without repository activity. Nothing in this decision makes a red WebKit night stop a merge, and
nothing should be read as if it did.

**A locale, date-format or phone-width change is now the developer's own responsibility to check.**
`pnpm e2e --project=mobile-safari` is the direct way, and it is named in the comment on each of the
four sites where it matters.

### The cost, honestly

|                      | Before                              | After                                                  |
| -------------------- | ----------------------------------- | ------------------------------------------------------ |
| PR e2e wall clock    | 2 shards, 882 s and >900 s of tests | **285 s and 235 s of tests** (run 35250473957)         |
| Budget spent         | 98% and past 100% of 900 s          | **32% and 26%** - about 70% of `globalTimeout` unspent |
| PR e2e runner time   | ~22 min an event                    | **~11.7 min** an event (jobs of 6m35s and 5m08s)       |
| Per merge, ~6 events | ~132 min                            | **~70 min**                                            |
| WebKit coverage      | every event, ~6 times a merge       | once a day                                             |

The "after" column is measured, not projected: run 35250473957 is the first CI run of this change,
and it is where #466's "at least ~25% of budget unspent" criterion is answered. The saving is real
and is **not** being spent on frequency this time. It is banked.

### On #466

This resolves the cause, and the measurement #466 asks for is in the table above: run 35250473957
spent 32% and 26% of the 900 s budget, against its criterion of "at least ~25% unspent". The
`ci.yml` comment block that carries the sharding arithmetic - #466's third criterion - now names
those numbers.

It is still left open rather than closed by keyword, for one reason only: #466 asks for no shard to
exceed the budget "on `develop` or on a feature branch", and the run above is a feature branch. The
push run on `develop` after this merges is what finishes it.

### The project is red today, and this decision does not fix it

Measured while making this change, on `develop` at `521d329b`, against the local test environment,
`CI=true` (one worker, two retries, the runner's timeouts): **37 passed, 4 flaky, 2 failed, 9
skipped, 7.0 min.** The same suite under `chromium` was 50 passed, 2 skipped, exit 0.

- `e2e/trips-core.spec.ts:348` - `the delete dialog asks as hard as the server says it must`. Three
  attempts out of three. The test asserts the confirm button is disabled at rest, and under WebKit
  at 393px it resolves enabled; the trip the phone layout puts first is not the one the desktop
  layout puts first, so the unconditional assertion above the branch does not hold. **Reproduced on
  unmodified `develop` with this change stashed**, so it predates it.
- `e2e/journeys.spec.ts:2046` - `a calendar is read, pruned and written to the desk as unchecked imports`.
  Three attempts out of three in the full run, and green when run alone: the import widget's toast,
  fixed at `bottom-[calc(var(--safe-bottom)+8.5rem)]`, and `#sentry-feedback` both intercept the
  pointer at phone width. Order-dependent, and a real interception rather than a timeout.
- One of the four flakes is `pageerror: Importing a module script failed` on `/dashboard` - the exact
  WebKit behaviour `e2e/helpers/admin.ts` already documents.

**So the nightly will be red on its first run.** That is stated here rather than discovered later.
It is also the strongest evidence for this decision's premise: these failures were being masked,
because the shard carrying them was dying on `globalTimeout` before it reached them (#466). Fixing
them is separate work and is tracked as #557; nothing in this ADR should be read as claiming the
coverage it relocates is currently green.

## Alternatives rejected

- **Delete the project outright** (the original shape of issue #552). It is a smaller change and it
  forces a decision on four assertions that have each caught something real. Retiring coverage
  because it is slow, when moving it costs one workflow file, is the wrong order of operations.
- **Filter the CI job with `--project=chromium`** and leave the config alone. Identical arithmetic
  and slightly smaller. Rejected because it leaves the project running by default everywhere except
  one job's command line, which is the kind of behaviour a reader finds last; the config is where
  somebody looks for what a project does.
- **Run WebKit post-merge inside `ci.yml`.** `deploy-staging` and `deploy-production` have
  `e2e-report` in their `needs` (ADR 0021), so a WebKit shard that ran out of wall clock would block
  the staging deploy - #466 again, one branch over, and this time with a deploy behind it.
- **Raise `globalTimeout`, or shard three ways** (the suggestion in #466 itself). Both buy room for
  the next journey and neither changes what a pull request pays for. #552 put the shard count and
  the timeout out of scope for exactly that reason.
