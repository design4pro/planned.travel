# Execution plan — block-opener-recognition

Source doc: .ai/specs/2026-09-10-block-opener-recognition.md
Issue: #141
Spec PR: #397 (merged)
Engine: om-auto-create-pr (steps: 5, --loop: no)

## Goal

Split block **recognition** from block **reading** in `src/lib/markdown/parse.ts`, so the
paragraph/list boundary check (`startsBlock`) stops parsing a whole block — recursively, including
every inline — just to learn a boolean. One shape function per compound block form states that
form's opening condition once, `blockKindAt` runs them in grammar order and returns a payload-free
`BlockKind`, and `readBlockAt` switches on that kind. The block tree `parse` produces is unchanged
for every input, and the amortisation argument in the `readBlockAt` doc comment is deleted because
the property it defends becomes true by construction.

## Scope

- `src/lib/markdown/parse.ts` — add `tableShapeAt`, `fenceAt`, `headingAt`, `blockKindAt` and the
  `BlockKind` union; rewrite `readTable` to call `tableShapeAt`; rewrite `readBlockAt` as a switch;
  rewrite `startsBlock` as `blockKindAt(...) !== null`; move the grammar-order paragraph onto
  `blockKindAt` and delete the amortisation paragraph.
- `src/lib/markdown/__tests__/parse.test.ts` — two new tests for the four-hash fall-through; the
  doc comment on `reads a boundary block a bounded number of times` rewritten to state the
  post-change property.

All four new functions stay module-private (spec Q4). The exported surface of `parse.ts` is
unchanged, so `src/lib/markdown/render.tsx` is untouched.

## Non-goals

Taken from the spec's alternatives and resolved assumptions: the one-pass CommonMark-style
segmenter that would delete `startsBlock` outright (its own ticket, #141 records it); restoring a
payload-carrying `BlockOpener` union; deleting the `reads a boundary block a bounded number of
times` test (spec Q3 declines the issue's request and keeps it, rewriting only its doc comment);
exporting the new functions for direct unit testing (spec Q4); re-verifying the grammar's order
against CommonMark (spec Q6); any change to `render.tsx`, to the exported types, or to a
dependency.

## Risks

- **A silent behaviour change in the paragraph/list boundary** is the real risk, and the suite as
  it stands does not close it: the four-hash fall-through is the one input class whose behaviour
  distinguishes a correct cascade from one that returns `null` at a non-heading `HEADING` match,
  and no current test exercises it. Step 3 adds those tests and requires them to pass on
  `origin/develop` as well, as a positive control. No existing assertion may be edited to fit the
  new code — an assertion that needs editing means the cascade diverged.
- **The double call on the reading path** (recognise, then read) re-runs each branch's condition
  once. Safe because none of `HEADING`, `FENCE`, `QUOTE`, `BULLET` or `ORDERED` carries `g` or `y`,
  so none keeps a `lastIndex` between calls.
- **Rollback** is a revert: a pure refactor of a pure function, no schema, no contract, no locale,
  no route. `src/lib` is listed under **Not protected** in `BACKWARD_COMPATIBILITY.md`.

## Implementation Plan

### Phase 1: recognition without reading

1. Extract `tableShapeAt` from the top of `readTable`, keeping the row scan untouched.
2. Add `fenceAt`, `headingAt`, `blockKindAt` and `BlockKind`, and wire both callers
   (`startsBlock`, `readBlockAt`) in the same step — `noUnusedLocals` leaves no green intermediate.
3. Add the two tests the four-hash fall-through never had, and confirm they pass on
   `origin/develop` too.
4. Delete the amortisation argument; move the grammar-order paragraph onto `blockKindAt`; rewrite
   the doc comment on the boundary-lookahead test.
5. Run the full validation gate.

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: recognition without reading

- [ ] 1.1 Extract `tableShapeAt` from `readTable`
- [ ] 1.2 Add `fenceAt`, `headingAt`, `blockKindAt`, `BlockKind` and wire both callers
- [ ] 1.3 Add the two four-hash fall-through tests
- [ ] 1.4 Delete the amortisation argument and rewrite the surviving doc comments
- [ ] 1.5 Run the full validation gate
