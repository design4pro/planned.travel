# Recognise a block opener without reading the block

| Field              | Value       |
| ------------------ | ----------- |
| **Status**         | implemented |
| **Issue**          | #141        |
| **Spec PR**        | #397        |
| **Implementation** | #400        |

Refs: `design4pro/planned.travel#141`.

## 📝 TLDR

`src/lib/markdown/parse.ts` answers the question "does the line at this index open a block?" by
parsing the whole block — recursively, including every inline of a quote, heading, list or table —
and then throwing the result away. The boolean costs a parse, and that cost is currently paid for
with an amortisation argument in a doc comment plus a regression test that guards it. This spec
splits **recognition** from **reading**: one small shape function per block form states that form's
opening condition once, `blockKindAt` runs them in grammar order and returns a payload-free kind,
and `readBlockAt` switches on that kind. The block tree `parse` produces is unchanged for every
input; the amortisation argument is deleted because the property it defends becomes true by
construction.

## 📝 Problem Statement

`readBlockAt` (`src/lib/markdown/parse.ts:226`) states the block grammar once — the order of its
branches _is_ the grammar — and two callers ask it the same question:

- `parseBlocks` (`parse.ts:181`) wants the block.
- `startsBlock` (`parse.ts:478`) wants only a boolean: whether the paragraph or list item running
  into this line has to stop short of it. It is `readBlockAt(...) !== null`.

Stating the grammar once is the right property, and it was won deliberately: commit `a34c3ec6`
("state the markdown block openers once") introduced a `BlockOpener` union precisely because the
dispatcher and the lookahead had drifted into two copies of the same ordered list, so a form added
to one and missed in the other would have parsed but never ended the paragraph above it. Commit
`d6313fc9` then collapsed `openerAt` into `readBlockAt` to get one reader and one exhaustiveness
check — and in doing so made the lookahead pay for a full parse per boundary line.

What that costs today, all of it visible in the file:

1. **A doc comment carrying an amortisation proof** (`parse.ts:216-221`): two sentences arguing that
   a discarded block is bounded to a constant — a reader whose opening line does not match returns
   early, one that does match ends the enclosing run at once, and a quote is the only block that
   holds blocks, capping nesting at two, so "a block is read at most four times". The argument is
   correct. It is also load-bearing: nothing in the code enforces it, so a future block form that
   nests would silently invalidate it.
2. **A regression test defending that argument**
   (`src/lib/markdown/__tests__/parse.test.ts:389-399`, `reads a boundary block a bounded number of
times`), whose own comment says a body alternating between multi-line readers "would blow the
   default timeout if that ever stopped holding".
3. **Wasted work on every boundary**: recognising `> quoted` as a block opener runs `parseBlocks`
   over the quote body and `parseInline` over every one of its inlines, and then discards the tree.

The `BlockOpener` union was the right idea; its payloads were the flaw — the `table` variant carried
a whole `BlockRead`, which is what made the union feel like it was paying for itself and made
collapsing it look like a simplification.

**Who has this problem.** The maintainers of the markdown subset, and every future reviewer of it.
There is no user-visible symptom: the parser is fast enough at the sizes notes reach. The cost is
that a small, closed, security-relevant module carries a hand-written complexity proof and a test
whose only job is to catch that proof going stale — a maintenance liability out of proportion to the
~25 lines of parsing it protects.

## 📝 Proposed Solution

Give each block form **one function that states its opening condition**, and build both callers on
top of those.

```ts
/** A fence's marker and info string, or `null` when the line opens no fence. */
function fenceAt(line: string): { marker: string; info: string } | null

/** A heading's level and text, or `null` — including for the 4+ hashes the subset excludes. */
function headingAt(line: string): { level: 1 | 2 | 3; text: string } | null

/** The header and delimiter cells of the table the line at `index` opens, or `null`. */
function tableShapeAt(
  lines: ReadonlyArray<string>,
  index: number,
): { headerCells: Array<string>; delimiterCells: Array<string> } | null
```

The remaining three forms are already single regex tests (`THEMATIC_BREAK`, `QUOTE`, `BULLET` /
`ORDERED`) and need no helper. On top of them:

```ts
type BlockKind =
  'fence' | 'thematicBreak' | 'heading' | 'quote' | 'list' | 'table'

function blockKindAt(
  lines: ReadonlyArray<string>,
  index: number,
  quotable: boolean,
): BlockKind | null {
  const line = lines[index]

  if (fenceAt(line) !== null) return 'fence'
  if (THEMATIC_BREAK.test(line)) return 'thematicBreak'
  if (headingAt(line) !== null) return 'heading'
  if (quotable && QUOTE.test(line)) return 'quote'
  if (BULLET.test(line) || ORDERED.test(line)) return 'list'
  return tableShapeAt(lines, index) === null ? null : 'table'
}
```

`startsBlock` becomes `blockKindAt(lines, index, quotable) !== null`. `readBlockAt` calls
`blockKindAt` once and switches on the kind, each case calling the same shape function to get the
payload it needs. Nothing parses a block to recognise one.

Two properties fall out of this shape rather than being argued for:

- **The grammar order is still stated once**, now in `blockKindAt` rather than in `readBlockAt`
  (which becomes an unordered switch). Adding a block form is still one edit for recognition.
- **Each form's opening condition is also stated once.** This is the part the filing issue's
  sketch left open — it has the readers "re-exec their own regex", which would put
  `FENCE.exec` + `isValidInfo` in two places and `HEADING.exec` + `headingLevel` in two more. Two
  copies of a condition drift the same way two copies of an order drift, and the exhaustiveness
  check over `BlockKind | null` catches a missing _kind_, never a diverging _condition_. Extending
  the issue's own `tableShapeAt` idea to the other two compound branches costs two small functions
  and removes the drift surface entirely.

### The four-hash fall-through stops being a subtlety

`readBlockAt` today has one branch that matches and then declines: a run of four or more hashes
matches `HEADING` but yields a `null` level, and control falls out of the `if` into the quote, list
and table branches below rather than returning (`parse.ts:242-254`). That fall-through is real and
observable — `#### a | b` followed by `--- | ---` parses as a **table** today, verified against the
current parser — and reproducing it was the most delicate part of a hand-written cascade.

With `headingAt` it is not delicate at all: `headingAt` returns `null` for four hashes, so
`blockKindAt`'s cascade simply continues to the next line of the function. The behaviour is
preserved by the ordinary control flow rather than by a comment warning the next maintainer not to
return early.

### Alternatives considered

- **Restore `BlockOpener` with payloads.** Rejected: this is what the file had, and the `table`
  variant carrying a `BlockRead` is precisely the flaw. A payload-carrying union also makes the
  recogniser's cost depend on which branch matched, which is the property being removed.
- **Leave it and keep the amortisation argument.** Rejected: the argument is a proof that lives in a
  comment and is enforced by one test. Removing the need for a proof beats maintaining the proof.
- **Segment the line stream into block chunks in one forward pass, then parse each chunk** — how
  CommonMark itself is structured. This deletes `startsBlock` outright rather than making it cheap.
  It is the stronger design and it is **out of scope here**: it restructures `parseBlocks`,
  `readList` and `readParagraph` together, and the filing issue says explicitly that it is worth its
  own ticket. This spec is the smaller, fully reversible step, and it does not block the larger one —
  a one-pass segmenter would consume `blockKindAt` unchanged.

## 📝 Architecture

One module changes: `src/lib/markdown/parse.ts`. Nothing is added to or removed from its exported
surface — `blockKindAt`, `fenceAt`, `headingAt` and `tableShapeAt` are module-private, like
`readBlockAt` and `startsBlock` before them. `src/lib/markdown/render.tsx`, the module's only
consumer, is untouched: it reads `MarkdownBlock`, which does not change.

The **owner module of the concept** (docs/SPEC.md §8) is `src/lib/markdown/parse.ts`. The concept —
the ordered list of block openers, and each opener's condition — is true in more than one place
inside that file and must stay true in all of them, and this change is what keeps each statement
single. Its test file `src/lib/markdown/__tests__/parse.test.ts` belongs to the same owner. No other
file touches either concept, so this is one work item over two files.

### Call graph after the change

| Caller          | Asks                                                            | Cost                                              |
| --------------- | --------------------------------------------------------------- | ------------------------------------------------- |
| `parseBlocks`   | `readBlockAt` — give me the block                               | one recognition pass, then the reader             |
| `readParagraph` | `startsBlock` → `blockKindAt` — does this line end my run?      | regex tests only, plus at most one `tableShapeAt` |
| `readList`      | `startsBlock` → `blockKindAt` — same                            | same                                              |
| `readBlockAt`   | `blockKindAt`, then the shape function for the kind it returned | one repeat of that branch's condition             |
| `readTable`     | `tableShapeAt`                                                  | the same two-line check the recogniser ran        |

### What it costs

On the reading path, each branch's condition now runs twice: once to name the kind, once to get the
payload. For a fence or a heading that is a second `exec` over one line. For a table it is a second
`tableShapeAt`, which calls `splitRow` twice (`parse.ts:380-381`), and `splitRow` is a
character-by-character scan (`parse.ts:427-451`) — so `parseBlocks` on a table line pays four such
scans where it paid two. Against the current cost of parsing a whole block and discarding it, this
is obviously the right trade, but it is a real constant factor and worth stating rather than
implying it is free.

The double call is safe because none of `HEADING`, `FENCE`, `QUOTE`, `BULLET` or `ORDERED`
(`parse.ts:134-140`) carries the `g` or `y` flag, so none of them keeps a `lastIndex` between calls.
A future flag change there would silently break this design, which is a reason to keep the shape
functions as the only callers of those patterns.

### Why the behaviour is identical

The block tree must not change for any input. Branch by branch, each recognition condition is
exactly the condition under which `readBlockAt` returns non-`null` today, because it is literally
the same expression moved into a function both paths call:

- **fence** — `FENCE.exec(line) !== null && isValidInfo(...)`; `readFence` never returns `null` (an
  unclosed fence runs to the end of the body rather than failing).
- **thematicBreak** — `THEMATIC_BREAK.test(line)`, already a pure test.
- **heading** — `HEADING.exec(line) !== null` **and** `headingLevel(hashes) !== null`, with the
  four-hash case falling through as described above.
- **quote** — `quotable && QUOTE.test(line)`; `readQuote` never returns `null`.
- **list** — `BULLET.test(line) || ORDERED.test(line)`; `readList` never returns `null`.
- **table** — today `readBlockAt` returns whatever `readTable` returns, and all five of `readTable`'s
  `null` paths sit at `parse.ts:374-383`, before the row scan begins at `parse.ts:385`; from the
  delimiter check onwards the function has a single exit and always succeeds. So
  `tableShapeAt(lines, i) !== null` holds exactly when `readTable(lines, i) !== null` holds today.
  This equivalence is the load-bearing claim of the whole change.

Every condition being unchanged, `startsBlock` returns the same boolean for every line, so
paragraphs and list items end in the same places. That is a claim about behaviour, and per
docs/SPEC.md §8 a claim is closed by evidence rather than by reading — the parser suite is that
evidence, and the Implementation Plan below states which input it is currently missing.

### Totality

The module's header promises that nothing here throws and that out-of-subset syntax degrades to the
characters that produced it. Dispatching on a kind introduces a shape where the second call could,
in principle, disagree with the first — and that must not become a thrown error, a non-null
assertion, or a hand-written "impossible" branch (which the repository's simplicity rule forbids).
`readBlockAt` already returns `BlockRead | null`, and its `null` already means "this line opens no
block, read it as a paragraph". So the switch re-narrows and falls out of the bottom into that
existing `null`:

```ts
function readBlockAt(
  lines: ReadonlyArray<string>,
  start: number,
  quotable: boolean,
): BlockRead | null {
  const line = lines[start]

  switch (blockKindAt(lines, start, quotable)) {
    case 'fence': {
      const fence = fenceAt(line)
      if (fence !== null)
        return readFence(lines, start, fence.marker, fence.info)
      break
    }

    case 'thematicBreak':
      return { block: { type: 'thematicBreak' }, next: start + 1 }

    case 'heading': {
      const heading = headingAt(line)
      if (heading !== null) {
        return {
          block: {
            type: 'heading',
            level: heading.level,
            children: parseInline(heading.text, true),
          },
          next: start + 1,
        }
      }
      break
    }

    case 'quote':
      return readQuote(lines, start)

    case 'list':
      return readList(lines, start, quotable)

    case 'table':
      return readTable(lines, start)

    case null:
      break
  }

  return null
}
```

Those `break`s are re-narrowing, not error handling: `fenceAt` and `headingAt` are pure functions of
`line`, so on the second call they cannot disagree with the first. TypeScript cannot prove that, so
the branches exist; they are provably dead rather than plausibly reachable. The exhaustiveness check
commit `d6313fc9` wanted is the switch over `BlockKind | null`, and `case null: break` satisfies
`noFallthroughCasesInSwitch` (`tsconfig.json:43`).

## 📝 Data Model

None. No entity, column, migration, queue envelope, Durable Object state or persisted setting is
involved. `parse` is a pure function over a string.

## 📝 API Contracts

None. No server function, route, public projection or config binding changes. Against
`BACKWARD_COMPATIBILITY.md` this change touches no protected surface: it lives entirely inside
`src/lib`, which that document lists under **Not protected** ("Internal module boundaries inside
`src/server`, `src/lib` and `src/components` … Refactor freely with tests"). The exported type
surface (`MarkdownBlock`, `MarkdownInline` and their members) and the `parse` signature are
unchanged, so even the internal consumer sees nothing.

No dependency is added, removed or upgraded — the stack is pinned (docs/SPEC.md §3), and this change
needs nothing that is not already in the file.

## 📝 UI/UX

Nothing unique to specify. The rendered output of `src/lib/markdown/render.tsx` is unchanged because
the block tree feeding it is unchanged.

## 📝 Visual change expected

**None.** No route and no state changes on screen, in either theme or at any viewport. The markdown
subset renders day notes through `src/lib/markdown/render.tsx`, and this change alters neither the
tree that component receives nor the component itself. The blind A/B pair that docs/SPEC.md §7 asks
for as item 4 has nothing to compare here; the correct evidence for this change is the parser suite,
which asserts the tree directly and at finer grain than a screenshot could.

## 📝 Copy

**None.** No new, changed or removed user-facing string, and therefore no key in the 23-locale
catalogue (docs/SPEC.md §9). The i18n parity test is unaffected.

## 📝 Edge Cases & Failure Scenarios

| Case                                                        | Expected behaviour                                                                            | Covered by                                                               |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `#### Four` alone                                           | Read as a paragraph; the subset stops at three                                                | `leaves a fourth level as literal characters…` (existing)                |
| `#### a \| b` over a delimiter row                          | Read as a **table**, via the four-hash fall-through                                           | **no existing test — Step 3 adds one**                                   |
| A paragraph line followed by `#### a \| b` over a delimiter | The paragraph ends and the table starts                                                       | **no existing test — Step 3 adds one**                                   |
| A half-written table (`\| a \| b` with no delimiter row)    | `tableShapeAt` returns `null`, the line joins the paragraph                                   | `degrades a half-written table to a paragraph` (existing)                |
| A ragged table row                                          | Padded or truncated to the header's width by `readTable`, which `tableShapeAt` does not touch | `fits a ragged row to the width the header declared` (existing)          |
| `> > x` inside a quote (`quotable === false`)               | The inner `>` stays text; `blockKindAt` carries `quotable` through unchanged                  | `leaves a nested quote marker as literal characters` (existing)          |
| An unclosed fence at end of body                            | Runs to the end of the body; recognition unaffected                                           | `closes an unclosed fence at the end of the body` (existing)             |
| A fragment somebody stopped halfway through                 | Never throws; the switch falls out to `null` and the line becomes a paragraph                 | `never throws on a fragment somebody stopped halfway through` (existing) |

**The one new failure mode.** If a shape function and its `case` body ever diverge — a future edit
that inlines one of them, or adds a seventh kind and forgets its case — the switch falls out to
`null` and the line silently renders as a **paragraph**. Nothing throws and nothing logs; a user
would see a heading or a table rendered as plain text. This is the price of `readBlockAt` staying
total, and it is bounded by the design: the shape functions are the sole callers of their patterns,
so there is nothing to diverge from as long as that holds. It is stated here rather than left for a
future reader to discover.

## 📝 Risks & Impact Review

- **Blast radius**: two files, one of them a test file, both inside an unprotected internal module.
  No schema, no contract, no locale, no route.
- **The real risk is a silent behaviour change** in the paragraph/list boundary. The suite as it
  stands does **not** close that risk on its own: the four-hash fall-through is the one input class
  whose behaviour distinguishes a correct cascade from one that returns `null` early, and no current
  test exercises it. That is why Step 3 adds tests rather than relying on "every existing test still
  passes", and why no existing test may be edited to fit the new code.
- **Rollback**: revert the commit. No migration, no persisted state, no deployment sequencing — the
  change is a pure refactor of a pure function, so the previous and new Workers produce identical
  output and can run side by side during a deploy.

## 📝 Resolved assumptions (autonomous defaults)

This spec was written by an unattended run, so the open questions were resolved rather than asked.
Each answer is the most reversible option that still ships something working; a human may override
any of them on the spec PR before it merges.

| #   | Question                                                                              | Resolution                                                                                     | Why                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| --- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Should the recogniser return a plain kind union, or one carrying payloads?            | A plain string-literal union, `BlockKind`, with no payloads.                                   | The payloads are the defect the filing issue names; a payload-free union is what makes recognition's cost independent of which branch matched.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| Q2  | Should the readers re-exec their own regex, as the filing issue sketches?             | **No — one shape function per compound branch**, called by both the recogniser and the reader. | The issue's sketch removes the duplicated grammar _order_ but creates duplicated _conditions_ (`isValidInfo`, `headingLevel`), which drift exactly as the two copies of the order drifted before commit `a34c3ec6`, and which the exhaustiveness check cannot catch. This applies the issue's own `tableShapeAt` idea uniformly instead of to one branch. Two extra private functions; same runtime cost. **This deviates from the issue's suggested direction — override if unwanted.**                                                                                                        |
| Q3  | Should `reads a boundary block a bounded number of times` be deleted?                 | **No — kept, with its doc comment rewritten** to state the post-change property.               | The filing issue asks for its deletion, and this is the one place this spec declines. The test is the _only_ one that exercises the boundary lookahead against a mixed corpus: `parses a ten-thousand-character body…` repeats a single paragraph line with no opener in it, and `does not degrade into quadratic scanning…` is inline-level and single-line. Deleting it leaves the lookahead path with no test at all. What the issue objects to is the amortisation _argument_, and that is one comment edit. **This deviates from the issue's suggested direction — override if unwanted.** |
| Q4  | Should the new private functions be exported so they can be unit-tested directly?     | No — all four stay module-private and are tested through `parse`.                              | Smallest new surface. The suite already tests the boundary behaviour they implement, at the level that matters.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| Q5  | Should the follow-up ticket for the one-pass segmenter be filed as part of this work? | No.                                                                                            | Out of scope, and the filing issue already records the idea. Filing it is a separate, cheap action a human can take whenever they want the work.                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| Q6  | Does the grammar's order need re-verifying against CommonMark while it is rewritten?  | No.                                                                                            | The order is being preserved, not chosen. Changing it would be a behaviour change and is out of scope; the subset's deliberate deviations are documented in the module header.                                                                                                                                                                                                                                                                                                                                                                                                                  |

None of these needs human confirmation before the spec is implementable: no security property, data
scoping rule or documented compatibility contract is weakened by any of them. The parser's two
structural security properties — no node type carries raw HTML, and a link is a link only if its
scheme is on the allow-list — live in the inline layer and in `safeHref`, neither of which this spec
touches. Q2 and Q3 are the two places where this spec knowingly departs from the filing issue's
suggested direction, and both are flagged as such above.

## 📋 Phasing

One phase. The change cannot be usefully split: `blockKindAt` without `readBlockAt` switching on it
is dead code, and `readBlockAt` switching on a kind that does not exist yet does not compile. Per
docs/SPEC.md §8, "can half of this land and leave the repository self-consistent?" — no, so it is one
item.

## 📋 Implementation Plan

### Phase 1 — Recognition without reading

**Step 1. Extract `tableShapeAt`.**
Move the five rejection conditions and the two `splitRow` calls at the top of `readTable`
(`parse.ts:374-383`) into `tableShapeAt(lines, index)`, returning `{ headerCells, delimiterCells }`
or `null`. Rewrite `readTable` to call it and return `null` when it returns `null`, keeping the row
scan, `fitRow`, `toRow` and `alignOf` exactly as they are.
_Verify:_ `pnpm test src/lib/markdown` — the whole parser suite passes unchanged. This step is
behaviour-preserving on its own and is a valid stopping point.

**Step 2. Add `fenceAt`, `headingAt`, `blockKindAt` and the `BlockKind` union, and wire both callers
in the same step.**
Write the three new functions, then change `startsBlock` to
`blockKindAt(lines, index, quotable) !== null` and `readBlockAt` to the switch shown in the Totality
section above. These land together because `tsconfig.json:41` sets `"noUnusedLocals": true` — a
`blockKindAt` referenced by nothing is a TS6133 error, so there is no green intermediate state that
adds it without using it.
_Verify:_ `pnpm typecheck` is clean and `pnpm test src/lib/markdown` passes with **every existing
test unmodified**. If any existing assertion needs editing to pass, the cascade has diverged from the
original: fix the cascade, never the test.

**Step 3. Add the tests the fall-through never had.**
The four-hash fall-through is the only input class whose behaviour separates a correct cascade from
one that returns `null` at a non-heading `HEADING` match — `#### Four` on its own parses to a
paragraph either way, because `QUOTE`, `BULLET` and `ORDERED` all require a non-`#` first non-space
character and so can never match it. Only the table branch is reachable by fall-through, and it is
untested. Add, in `parse.test.ts`:

1. `parse('#### a | b\n--- | ---\n1 | 2')` is a `table` whose first header cell is `#### a`.
2. A paragraph line followed by that same table ends the paragraph and starts the table — the
   `startsBlock` form of the same case, which is the one the lookahead actually runs.

_Verify:_ both tests pass on the new code, and — as a positive control that they are testing
something — confirm they also pass on `origin/develop` before the refactor. A test that passes
before and after proves the behaviour was preserved; one that only passes after proves nothing about
preservation.

**Step 4. Delete the amortisation argument.**
Remove the amortisation paragraph from the `readBlockAt` doc comment (`parse.ts:216-221`). **Move**
the surviving "the order of the branches is the grammar, and it is stated once because two callers
ask the same question of it" paragraph (`parse.ts:210-214`) onto `blockKindAt`, updated to name
`blockKindAt` and `readBlockAt` as those callers — after this change `readBlockAt` no longer states
the grammar, it is an unordered switch, and leaving the paragraph there would point the next
maintainer at the wrong function. Give `readBlockAt` a one-line comment saying it dispatches to the
reader for the kind `blockKindAt` returned. Rewrite the doc comment on
`reads a boundary block a bounded number of times` (`parse.test.ts:389-395`) to state the new
property — recognition reads no block, so a boundary block is read exactly once — keeping the test
body as it is.
_Verify:_ `pnpm test src/lib/markdown`; read the diff and confirm no test body or assertion was
removed.

**Step 5. Run the full validation gate and open the PR.**
`node .ai/scripts/agent-kit-check.mjs`, `pnpm typecheck`, `pnpm lint`, `pnpm test`,
`bash .ai/scripts/check-generated.sh`, `pnpm build`, `bash .ai/scripts/e2e.sh` — the list in
`.ai/agentic.config.json`, in that order.
_Verify:_ every command exits zero.

### Acceptance criteria

1. `startsBlock` reaches no reader: `blockKindAt` calls no `parseInline`, no `parseBlocks`, and scans
   no table rows. It contains only `fenceAt`, `THEMATIC_BREAK.test`, `headingAt`, `QUOTE.test`,
   `BULLET.test`, `ORDERED.test` and `tableShapeAt`.
2. The grammar order is stated once, in `blockKindAt`, and each branch's opening condition is stated
   once, in its shape function or its single regex test. `FENCE`, `HEADING`, `CLOSING_HASHES`,
   `DELIMITER_CELL`, `isValidInfo` and `headingLevel` each have exactly one call site.
3. The two new fall-through tests from Step 3 pass both on `origin/develop` and on the branch.
4. Every existing test in `src/lib/markdown/__tests__/parse.test.ts` passes with **no edit to any
   assertion or test body**; the only permitted edit is the doc comment rewritten in Step 4.
5. `src/lib/markdown/__tests__/render.test.tsx` passes untouched.
6. No amortisation or complexity argument remains anywhere in `parse.ts`.
7. The exported surface of `parse.ts` is unchanged, and no dependency changed.
8. The full validation gate is green.
