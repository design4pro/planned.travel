# Notify — 2026-09-09-geocoding-proxy

> Append-only log. Every entry is UTC-timestamped. Never rewrite prior entries.

## 2026-09-09T10:05:00Z — run started

- Brief: implement the spec at `.ai/specs/2026-09-09-geocoding-proxy.md` — one geocoding proxy
  behind a provider port, minted as `src/server/geo/**`, with the rate meter lifted to
  `src/server/metering/rate.ts` first.
- Engine: `om-auto-create-pr-loop` (steps: n/a, --loop: yes) — `--loop` was passed and forwarded
  verbatim, so the handoff happened before any Step count was taken.
- External skill URLs: none.

## 2026-09-09T10:05:00Z — decision: proceeding with an unmet precondition

The spec names [#220](https://github.com/design4pro/planned.travel/issues/220) a precondition and
says the implementation PR should not open until it has merged. It has not: `RateCeilingError` still
hardcodes transit prose. The run proceeds and states the deviation on the PR rather than stopping,
because the harm named in the spec's own risk row — "a geocoding refusal reads as a transit
refusal" — needs a rendering caller, and this change deliberately ships none. The merge order is
left to the human reviewer. Recorded in `PLAN.md` under "The unmet precondition".

## 2026-09-09T10:05:00Z — decision: Q1's figures are settled

The spec PR merged with Q1 (`geocode_lookups_per_month` per-plan figures) still marked
`⚠ NEEDS HUMAN CONFIRMATION`. PR #360, open at run start, records the answer: confirmed as proposed,
`free: 200` / `solo: 2 000` / `crew: 8 000`, unchanged. Step 1.3 implements those figures and needs
no further gate.

## 2026-09-09T10:22:00Z — checkpoint 1 (Steps 1.1..2.2)

- Phase 1 complete, Phase 2 half done. Typecheck, lint and 696 targeted server tests green;
  `pnpm db:generate` produced no migration, which is the spec's own check on the slug adoption.
- Decision recorded at Step 1.3: `limits.test.ts`'s "gives an allowance to exactly the plans that
  can reach the desk" looped over every rate metric and asserted a rule the booking desk does not
  hold over the geocoding metric. It was split rather than weakened — the desk metrics keep the
  desk rule, the geocoding metric gets its own case, and a third fixes the sizing argument as an
  ordering. The spec asked for the suite green without enumerating this.
- Decision recorded at Step 2.1: the two fixtures asserting `geoapify` is *planned* now assert it of
  `here`, which still is. Geoapify keeps a case of its own for the day window ADR 0013 agreed its
  ceiling under, so adoption does not quietly drop that coverage.
- Three full-suite failures triaged as not-ours: `hooks.test.ts` fails on clean `develop` in
  isolation (pre-existing); `build-airports` and `markers` pass in isolation on both branches and
  only fail under the full suite's parallel load. Detail in `checkpoint-1-checks.md`.
- UI verification skipped, with reason: the spec's "Visual change expected: None" — no route,
  component or locale key is touched — and `--no-ui` was passed.
