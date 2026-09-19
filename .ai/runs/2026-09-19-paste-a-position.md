# Execution plan: paste a position, and have both coordinate fields fill

Source doc: .ai/specs/2026-09-18-paste-a-position.md
Issue: #555
Spec PR: #584

## Goal

Pasting a position into either coordinate field of `PlaceDialog` fills both fields, in any of four
notations, shows the pair it read in a reserved hint line and moves focus to longitude. A paste that
does not parse is an ordinary paste.

## Scope

- `src/lib/geo/position.ts` (new) and its unit tests.
- `PlaceDialog` in `src/routes/_app/trips/$tripId/-ui/plan-actions.tsx` and a component test.
- One key, `trips.plan.place.pastedPosition`, in all 23 locales.
- One `test.describe` appended to `e2e/places-and-maps.spec.ts`.
- Spec lifecycle bookkeeping: `Status: in-progress`, the spec index.

## Non-goals

Everything in the spec's Out of scope: no server work, no `components/ui` primitive, nothing under
`src/lib/map` or `src/components/map`, no files owned by `02-S4`, no translation of `PlaceDialog`'s
existing hardcoded English.

## Implementation Plan

### Phase 1: paste a position into the place form

1. The parser, test-first (spec step 1).
2. The copy in 23 locales (spec step 2).
3. The paste behaviour and its component test (spec step 3).
4. The journey (spec step 4).
5. Spec bookkeeping and the full gate (spec step 5).

## Risks

- A silent wrong answer (swap, misread hemisphere, `geo:0,0?q=`): each has a named refusal and test.
- WebKit may not carry `clipboardData` through a constructed `ClipboardEvent`; the journey skips
  `mobile-safari` for that case with the reason stated if so.

## Progress

PR: #635

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: paste a position into the place form

- [x] 1.1 The parser, test-first — 22400544a
- [x] 1.2 The copy in 23 locales — 01a5f50c6
- [x] 1.3 The paste behaviour and its component test — 01a5f50c6
- [x] 1.4 The journey — bb1e053c2
- [x] 1.5 Spec bookkeeping and the full gate — 950466281
