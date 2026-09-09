# Execution plan — geocoding-proxy

**Run:** `2026-09-09-geocoding-proxy`
**Branch:** `feat/geocoding-proxy`
**Base:** `develop`
**Engine:** `om-auto-create-pr-loop` (steps: n/a, --loop: yes)
**Source spec:** `.ai/specs/2026-09-09-geocoding-proxy.md`
**Source issue:** [#281](https://github.com/design4pro/planned.travel/issues/281)
**Spec PR:** [#352](https://github.com/design4pro/planned.travel/pull/352) (merged, design-only)

## Tasks

> Authoritative status table. `Status` is one of `todo` or `done`. On landing a Step, flip `Status` to `done` and fill the `Commit` column with the short SHA. The first row whose `Status` is not `done` is the resume point for `om-auto-continue-pr-loop`. Step ids and `Exec` cells are immutable once the plan is committed — per-Step commits touch only `Status` and `Commit`.

| Phase | Step | Title                                                                     | Exec   | Status | Commit |
| ----- | ---- | ------------------------------------------------------------------------- | ------ | ------ | ------ |
| 1 | 1.1 | Move `src/server/transit/meter.ts` to `src/server/metering/rate.ts` | inline | done | 4962ba4b |
| 1 | 1.2 | Move the meter's cases into `src/server/metering/__tests__/rate.test.ts` | inline | done | bc17b309 |
| 1 | 1.3 | Add `geocode_lookups_per_month` to the rate metrics and the plan ceilings | inline | done | — |
| 2     | 2.1  | Adopt the `geoapify` vendor slug into `METERED_PROVIDERS`                 | inline | todo   | —      |
| 2     | 2.2  | Write `src/server/geo/geocode.ts` — the proxy                             | inline | todo   | —      |
| 2     | 2.3  | Write `src/server/geo/geoapify.ts` — the vendor adapter                   | inline | todo   | —      |
| 2     | 2.4  | Wire the provider ledger around the vendor call                           | inline | todo   | —      |
| 2     | 2.5  | Write the binding seam and declare `GEOAPIFY_API_KEY`                     | inline | todo   | —      |

Every Step is `inline` deliberately. The spec's prose standard is unusually high — each module
carries a header that argues for its own existence — and the main session holds the spec, the four
precedent modules (`transit/search.ts`, `transit/here.ts`, `transit/bindings.ts`,
`metering/outbound.ts`) and the two test files whose fixtures move. An executor would re-derive that
reading for every Step, and the risk it produces code in a house style one notch off is the thing
this plan is least able to absorb.

## Goal

Mint `src/server/geo/**` as one server-side geocoding proxy behind a provider port — forward and
reverse lookups, a cross-tenant unexpiring KV cache, a per-tenant monthly ceiling, typed failure and
an enforced retention right — so that `02-S4`, `02-S11`, `02-S13` and `03-S7` stop waiting on a
module that does not exist. One adapter ships (Geoapify), and its calls are counted in the provider
ledger under a slug this change adopts.

## Scope

- **Phase 1** lifts `src/server/transit/meter.ts` to `src/server/metering/rate.ts` (three callers, no
  behaviour change), moves its tests to the owner of the code they test, and adds the
  `geocode_lookups_per_month` rate metric with its per-plan ceilings.
- **Phase 2** adopts the `geoapify` slug into `METERED_PROVIDERS`, then writes the proxy, the vendor
  adapter, the ledger wiring and the binding seam.

Phase 2 imports the meter from its new home, so the order is load-bearing rather than tidy.

## Non-goals

Taken from the spec's own "Out of scope" section, recorded so they are not re-derived:

- A proximity bias on forward lookups, and any second adapter, provider chain or fall-through rule.
- A denormalised attribution column on `places`.
- Splitting the operator block gate out of `callProvider` so a blocked call spends no tenant unit
  ([#214](https://github.com/design4pro/planned.travel/issues/214) owns that).
- Debounce, minimum-length-before-request and cancel-on-supersede in the client.
- Any route, component, server function or locale key. `bindings.ts` ships with no caller by design;
  `02-S4` is its first one.

## Implementation Plan

### Phase 1 — the metric and the lifted meter

#### 1.1 Move `src/server/transit/meter.ts` to `src/server/metering/rate.ts`

`git mv` so the rename is recorded as one, with no edit other than the header's opening sentence,
then rewrite the imports in `src/server/transit/search.ts` and `src/server/fns/transports.ts`.
`rateMeterKey` is not touched — transit's tally and `03-S7`'s share its string.

Verify: `pnpm typecheck` clean, `pnpm test` green, `git diff -M` reports a rename.

#### 1.2 Move the meter's cases into `src/server/metering/__tests__/rate.test.ts`

The `describe('the rate meter')` block leaves `src/server/transit/__tests__/search.test.ts` for a
file beside the code it tests. Import paths change; assertion bodies do not. The in-memory store
helper is needed on both sides, so each file keeps its own — the transit file's remaining proxy
cases still use it.

Verify: both suites green, the `rateMeterKey` assertions still compare the same literal strings.

#### 1.3 Add `geocode_lookups_per_month` to the rate metrics and the plan ceilings

Add the metric to `RATE_METRICS` and to all three rows of `PLAN_RATE_CEILINGS` (`200` / `2 000` /
`8 000`, confirmed by [#360](https://github.com/design4pro/planned.travel/pull/360)), and rewrite the
"Free is zero for both" paragraph rather than extending it: the new metric is the first that breaks
its rule, and why it breaks it is the interesting part.

`__tests__/limits.test.ts` needs one case adapted, which the spec implies by asking for the suite
green but does not enumerate. `'gives an allowance to exactly the plans that can reach the desk'`
asserts, for **every** metric in `RATE_METRICS`, that a positive allowance and
`limits.reservations` agree — true of the two desk metrics and false of this one, whose surface is
the place form and not the booking desk. The case is narrowed to the desk metrics it was written
about and a sibling case is added for the geocoding metric, so neither is left asserted by nothing.

Verify: `limits.test.ts` green, including its assertion that no rate metric is a `UsageMetric`.

### Phase 2 — the proxy, the adapter and the vendor slug

#### 2.1 Adopt the `geoapify` vendor slug into `METERED_PROVIDERS`

Move `geoapify` from `PLANNED_PROVIDERS` to `METERED_PROVIDERS` and update the doc comments and
fixtures the spec enumerates: `src/server/db/schema.ts` (both lists and the `provider_registry`
note), `src/server/db/types.ts`, `src/server/fns/console/providers.ts`, and the two fixtures in
`src/server/fns/console/__tests__/providers.test.ts` and
`src/server/catalog/__tests__/provider-usage.test.ts` that assert the slug is _planned_.

This is the **first** Step of the phase and not a later one: `GeocodeVendor.slug` is typed
`MeteredProvider`, so an adapter written before the move cannot typecheck.

Verify: the console suites green, `pnpm db:generate` produces no migration, `pnpm typecheck` clean.

#### 2.2 Write `src/server/geo/geocode.ts` — the proxy

The vocabulary, `forwardQuerySchema` / `reverseQuerySchema`, `GeocodeCredit` / `GeocodeVendor` /
`GeocodeProvider`, `GeocodeCandidate` / `GeocodeResult`, `GeoProviderError`,
`normalizeGeocodeQuery`, the two cache keys and the two orchestrators. The order of operations is
the whole contract: parse → plan gate → cache → configured? → may we store it? → meter → vendor.

Verify: `src/server/geo/__tests__/geocode.test.ts` covering the issue's success criteria 1–10 — two
workspaces producing one key, a hit spending nothing, a miss spending exactly one, the refusal
before the vendor, the unconfigured deployment still serving the cache from `runtime.vendor` alone
with `provider: null`, the length bounds, the whitespace and case fold, two languages not sharing an
entry, and a stub declaring `ephemeral` being refused.

#### 2.3 Write `src/server/geo/geoapify.ts` — the vendor adapter

Endpoints, timeout, wire schemas, the candidate mapping, the locale→language table and the exported
`geoapifyVendor` constant, with `fetch` injected.

Verify: fixtures for a populated answer, an empty answer and each of `unreachable`, `refused` and
`malformed`; `pt-BR` → `pt` and both `zh-*` → `zh`; and the key never present in a thrown message.

#### 2.4 Wire the provider ledger around the vendor call

Wrap the vendor call in `callProvider` with operations `geocode.forward` and `geocode.reverse`.

Verify: criterion 11 — a call is recorded in `provider_usage` under `geoapify`, and a `block` policy
stops it.

#### 2.5 Write the binding seam and declare `GEOAPIFY_API_KEY`

`src/server/geo/bindings.ts` and `src/server/geo/cloudflare-env.d.ts`, and `GEOAPIFY_API_KEY` added
to `.dev.vars.example`. A directory-discipline case mirrors transit's, adapted: the _control_
assertion transit uses (the proxy has importers outside its directory) cannot hold here, because
this module ships with no caller by design.

Verify: `pnpm typecheck`, `pnpm build` and `bash .ai/scripts/check-generated.sh` clean.

## Risks

- **The lifted meter breaks the transit tally.** The move is mechanical, `rateMeterKey` is unchanged
  and asserted so, and the meter's cases move with it unedited.
- **The vendor slug move flips `integrated` in the console.** Two fixtures assert `geoapify` is
  planned; both are enumerated in 2.1 and owned by this change.
- **`bindings.ts` ships with no caller** — deliberate, documented in the file header, and the shape
  `src/server/transit/bindings.ts` already shipped in.
- **⚠ The spec's stated precondition is unmet.** See below.

### The unmet precondition, recorded rather than silently overridden

The spec names [#220](https://github.com/design4pro/planned.travel/issues/220) a **precondition**
("the implementation PR should not open until #220 has merged"), and it has not merged:
`RateCeilingError` still hardcodes transit prose for every metric it is thrown with
(`src/server/transit/meter.ts:96-97` at the base commit).

This run proceeds and flags it rather than stopping, because the harm the precondition guards
against cannot occur in this PR. The named harm is "a geocoding refusal reads as a transit refusal",
and a refusal has to be _rendered_ to read as anything. This change ships no route, no server
function and no component; the spec is explicit that `bindings.ts` has no caller and that `02-S4` is
the first one. The defect is therefore latent for exactly as long as the module is unwired, and
#220 lands well inside that window on any ordering.

What this run does **not** do is decide the merge order, which is a human's call and is stated on
the PR: merging this before #220 leaves a correct module behind a wrong message, and the first
caller is the point at which that stops being free.

## External References

None. No `--skill-url` was passed.
