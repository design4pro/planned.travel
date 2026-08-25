# Open findings, per plan

Generated from `.claude/ultrabuild/items.json` by the /ultrabuild orchestrator. **This file is not
hand-written and not audited** — it is a register, so a run executing one of these plans knows what
its own auditors had not yet resolved.

A plan marked **verified** passed an adversarial audit with zero blocking findings. A plan with open
findings is still usable — each finding is specific and names the stage it belongs to — but the run
that executes it should resolve them first.

| plan | status | open blocking |
|---|---|---|
| `00-foundations.md` | **verified** | — |
| `01-trips-core.md` | **verified** | — |
| `02-places-and-maps.md` | open | 2 |
| `03-reservations-and-transport.md` | open | 2 |
| `04-budget-and-currencies.md` | open | 3 |
| `05-packing-and-todos.md` | open | 3 |
| `06-documents-and-media.md` | open | 2 |
| `07-collaboration-and-sharing.md` | **verified** | — |
| `08-product-modules.md` | open | 3 |
| `09-account-and-settings.md` | open | 1 |
| `10-administration.md` | **verified** | — |
| `11-boundaries-and-blockers.md` | **verified** | — |
| `12-verification-protocol.md` | **verified** | — |
| `README.md` | **verified** | — |

## `02-places-and-maps.md`

- 02-S7 and 02-S9 both say they "extend" `src/routes/_app/trips/$tripId/-ui/__tests__/plan-model.test.ts`, but that directory does not exist at HEAD and no stage in any plan lists the file under Owned paths. Two stages in different waves would create/edit an undeclared file, invisible to check-plan-collisions.mjs. _(line 1917)_
- 02-S2's Owned paths omits two files the same stage states it writes: `src/server/repos/__tests__/tenant-isolation.test.ts` (append) and `src/lib/map/__tests__/style.test.ts` (extend). Every other stage in this plan that appends to the isolation test declares it; 02-S2 is the sole omission. _(line 568)_

## `03-reservations-and-transport.md`

- `reservations.imported_at` is a wave-0 column no stage is allowed to write: 03-S7 needs it but explicitly claims no repository file, and 03-S4 (the only stage in this plan owning src/server/repos/reservations.ts) never widens the validators. The value is silently stripped — the exact defect 03-S8 documents for a sibling column. _(line 2113)_
- 03-S4 states as its repository deliverable two changes that are already on disk: `reservationFields` already has `assignmentId` and `assertReferences` already guards it. The stage cites line :187 while the refuting code sits at :204-213 of the same function. _(line 1173)_

## `04-budget-and-currencies.md`

- No Playwright invocation anywhere in the plan — no PLAYWRIGHT_BASE_URL, no capture.mjs, no PT_SERVER_TODAY pin, no shot directory — contradicting docs/plans/12-verification-protocol.md §2 and §8 items 2-3, which the acceptance criteria name as the contract for the Verification block. _(line 476)_
- The baseline directory is named in Owned paths by 04-S1 only; 04-S2 through 04-S7 each write baseline PNGs into a path they do not own, contradicting the plan's own brief and failing SPEC §7 item 6. _(line 126)_
- 04-S1's Blockers attributes a cron-trigger disposition to 11-S3 that docs/plans/11-boundaries-and-blockers.md does not contain. _(line 581)_

## `05-packing-and-todos.md`

- "formatWeight is the only renderer ... and stays that way" is false at HEAD: src/components/modules/lists/lists-board.tsx:136 defines a private duplicate that already disagrees with the shared one on the same screen, and no stage removes it. _(line 69)_
- "Every list write already mirrors ... as patch('trip', tripId, { listsChangedAt })" is false — every item-level write mirrors as patch('packing-item', …) with field payloads — and the plan-level convention built on that falsehood binds every stage's item writes to the coarser stamp. _(line 26)_
- Applying a template — the whole point of 05-S2/LST-04 — produces a list that renders in the read-only "Legacy group" state 05-S1 introduces, because applyTemplateToTrip writes category strings and no stage in wave 4 may touch the repository to adopt them. _(line 807)_

## `06-documents-and-media.md`

- 06-S5 states two incompatible answers for what a workspace calendar feed returns, and names no repository read to settle it — on an endpoint whose only credential is the URL _(line 1508)_
- 06-S5's tenant-resolution rules have no offboarding case: a calendar feed keeps serving after its owner is removed from the workspace or the trip _(line 1659)_

## `08-product-modules.md`

- 08-S3 asserts `getTrip` raises NotFoundError for a foreign trip id; it returns `null`. The stage's headline tenant-isolation case cannot pass as written. _(line 932)_
- 08-S4 states `getCollection` "resolves through `requireById` and throws"; it calls `findById` and returns `null`. _(line 1316)_
- 08-S4's "point of the block" tenant case requires `setCollectionPlaceLabels` to reject a foreign label id; the shipped function silently drops it and resolves. _(line 1320)_

## `09-account-and-settings.md`

- Seven stages ship copy on `src/routes/_app` screens — squarely inside docs/SPEC.md §8's declared scope — but no stage names an `src/lib/i18n/messages/en/<namespace>.ts` file, so the plan assigns the English catalogue for its own screens to nobody and the fan-out contract cannot satisfy §8. _(line 64)_

