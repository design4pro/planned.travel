# Review round — `om-auto-review-pr 308 --autofix`

**When:** 2026-09-07T23:05:00Z
**Range:** `bfaeb7da..2d85569f` (7 Steps, 7 commits)
**Verdict in:** request changes (1 major, 7 minors, 4 nits)
**Verdict out:** every actionable finding closed, declined, or filed

## Why the review was posted as a comment

GitHub refuses `REQUEST_CHANGES` on a self-authored pull request
(`Can not request changes on your own pull request`). The full report was posted as a review comment
instead, verbatim and in the `om-code-review` structure. It carries the same weight here: the autofix
loop ran against it and the PR did not go ready until the major was closed.

## The major, and how it was closed

**The consumption seam had no test at any level, and the e2e docblock claimed to be its guard.**

The review was right, and right about the mechanism: every canvas read in `basemap-preference.spec.ts`
happens on a freshly opened document, so `AppShell`'s publish effect always lands before
`MapCanvas`'s bootstrap resolves its dynamic import. The map is _constructed_ with the correct style
and the swap effect at `map-canvas.tsx:675` never has to fire. Deleting the basemap from `styleKey()`
left both `pnpm test` and `bash .ai/scripts/e2e.sh` green.

Three cases in `map-canvas.test.tsx` (`c413844c`), and each was mutation-checked rather than assumed:

| Mutation                                                                    | Result                                                          |
| --------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `const base = \`${theme}\`` — basemap dropped from the key                  | **3 failed** / 24 passed                                        |
| `if (appliedRef.current === key) return` deleted — the over-eager direction | **1 failed** (`expected [...] to have a length of 2 but got 3`) |
| unmutated                                                                   | 27 passed                                                       |

The e2e docblock now says what that file really proves — the column reaches a style document across a
page load — and points at the unit cases for the seam.

## The minors

| #   | Finding                                                                                                               | Outcome                                                                                                                                                                                                                                                                                                                   |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `.trim()` widened the accepted set: `' '` parsed to `''`, the sentinel that clears the column                         | **Fixed** (`844bd4fd`). Trim dropped; the accepted set is now exactly the spec's bare union. The validator is the module's own exported `appearanceInput` — the `regionalSettingsInput` idiom — with five cases beside the regional ones. The whitespace case fails against the trimmed schema, which is why it is there. |
| 2   | A failed save left the picker showing a pick the write refused, against the spec's Edge Cases table                   | **Fixed** (`fdb88c70`). `persist` answers whether the column moved; the picker puts itself back when it did not.                                                                                                                                                                                                          |
| 3   | The e2e teardown ran unguarded in `finally` and could replace the assertion error; the write wait accepted any status | **Fixed** (`2cb86543`, `a1e5b7af`). The teardown is annotated rather than thrown, so a dirty row is still reported. The status is asserted after the wait rather than filtered inside it — as a filter it can only ever time out, as an expectation it names the status.                                                  |
| 4   | `AppearancePayload.mapStyle` and `.workspaceMapStyle` have no reader left                                             | **Filed, not deleted** — issue #311. `BACKWARD_COMPATIBILITY.md` §2 requires a removed return-shape field to stay populated for one release; a browser on the previous bundle reads both during a deploy.                                                                                                                 |
| 5   | `resolveBasemap` returns a `poiLabels` no production caller reads, and a test asserts it                              | **Fixed** (`fdb88c70`), as a comment rather than a deletion: the field is a claim about the table, not about wiring, and the comment says so.                                                                                                                                                                             |
| 6   | `server/repos` imports a client module that owns mutable state, for one string array                                  | **Declined.** The safety argument holds — `publishBasemap` is the only writer and returns early off the browser — and splitting the ids into a fourth module to make the isolation structural rather than conditional is a change to the shape of the map library, not to this feature. Worth doing; not here.            |
| 7   | The row's hint was not programmatically associated with the group                                                     | **Fixed** (`fdb88c70`). The hint has an id, the group points at it, and `aria-busy` says the save is in flight rather than leaving `disabled` to imply it.                                                                                                                                                                |

## The nits

- **Barrel re-export dropped** (`fdb88c70`). No importer used it, and it put a mutable store in the
  graph of every `#/lib/map` consumer.
- **Redundant `aria-hidden` on the swatch dropped** (`fdb88c70`) — `RadioCard`'s icon slot already
  sets it, and `WorkspaceSwatch` already omitted it.
- **`SettingsRow` duplication left alone**, as the review itself suggested: the fix is a `stacked`
  variant on a component the spec put out of scope.
- **Polish gender: declined, because it is not an inconsistency.** The card labels name a _styl_
  (`Automatyczny`, `Spokojny`) and the hints describe a _mapa_ (`Ciepła i jasna`). Each agrees with
  its own subject and both read naturally.

## The full gate, re-run on `2d85569f`

| #   | Command                                 | Result                                                            |
| --- | --------------------------------------- | ----------------------------------------------------------------- |
| 1   | `pnpm typecheck`                        | ✅ pass                                                           |
| 2   | `pnpm lint`                             | ✅ pass                                                           |
| 3   | `pnpm test`                             | ✅ pass — 5610 tests / 232 files (was 5601; +9 from this round)   |
| 4   | `bash .ai/scripts/check-generated.sh`   | ✅ pass                                                           |
| 5   | `pnpm build`                            | ✅ pass — 129 server functions, every reference resolves          |
| 6   | `bash .ai/scripts/e2e.sh`               | ✅ pass — 30 passed, 1 skipped, 0 failed, **twice consecutively** |
| —   | `detect.mjs` on the two touched screens | ✅ exit 0, no findings                                            |

## What the e2e round actually cost, stated rather than buried

The suite went red repeatedly during this round and **none of it was a product defect**, but one of
the causes was a real weakness in this run's own test and is worth recording.

1. **A fixed 15s write wait inside a 120s test** (`2d85569f`). `chooseBasemap` had copied
   `pinDemoLanguage()`'s 15s budget, which is right for that helper — it runs alone in the `setup`
   project. Inside the suite the dev server answers several workers at once, so the test failed on
   the fixture's clock while every assertion it makes was still unexamined. Measured at 15.1s
   standalone against the new 45s ceiling. A ceiling, not an expectation; no assertion moved.
2. **Machine contention, from two sources.** A concurrent `om-auto-fix-pr` run on PR #310 held load
   average above 70 for part of the round, and each red Playwright run wrote videos and traces into
   `test-results/`, which set Spotlight indexing off — load peaked at **126.76** immediately after
   one run. Under that, unrelated specs (`journeys.spec.ts`, `trips-core.spec.ts`) failed on flat
   30s timeouts and passed in isolation in 11-15s.
3. **One bisect result was a false positive, and is recorded as one.** Reverting the barrel
   re-export appeared to fix `trips-core` (8 failed → 10 passed); the confirmation run with the
   removal back in place also passed 10/10. The removal is not implicated; the load was.
4. **`journeys.spec.ts:907` remains the collateral it was.** With the new spec excluded
   (`--grep-invert "the basemap a member picks"`) the suite is 28 passed, 0 failed — the same
   isolation the first gate recorded. Two atlas-heavy specs now load MapLibre on parallel workers
   against one dev server. **For the reviewer:** if this file starts flaking in CI, the answer is to
   serialise the atlas specs, not to loosen either one's assertions.

## Carried forward, unchanged

The three non-blocking items the first gate raised (`poiLabels` precedence, the spec-vs-implementation
validator shape, `workspaceMapStyle` having no reader) were all answered in this round — see the
minors table. The fourth, the `om-integration-tests` per-test-timeout policy tension, stands as
recorded: this repository's own suite contradicts that generic policy five times, and this round adds
a sixth (`WRITE_TIMEOUT_MS`) for the reason `WALK_TIMEOUT_MS`'s own docblock gives.

## CI

Unreadable from this run: the token answers `403 Resource not accessible by personal access token`
for branch protection, `gh pr checks` and the check-runs API. Nothing here claims CI is green — only
that the local gate is. Required checks still gate the merge and must be read by a human or a
differently-scoped token before this lands.
