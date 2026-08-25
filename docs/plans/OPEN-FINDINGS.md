# Open findings, per plan

Generated from `.claude/ultrabuild/items.json` by the /ultrabuild orchestrator. **This file is
not hand-written and not audited** — it is a register, so that a run executing one of these
plans knows what its own auditors had not yet resolved.

A plan marked **verified** passed an adversarial audit with zero blocking findings. A plan with
open findings is still usable — the findings are specific, and each names the stage it belongs
to — but the run that executes it should resolve them first.

| plan | status | open blocking |
|---|---|---|
| `00-foundations.md` | **verified** | — |
| `01-trips-core.md` | open | 4 |
| `02-places-and-maps.md` | open | 1 |
| `03-reservations-and-transport.md` | open | 2 |
| `04-budget-and-currencies.md` | open | 3 |
| `05-packing-and-todos.md` | open | 3 |
| `06-documents-and-media.md` | open | 2 |
| `07-collaboration-and-sharing.md` | **verified** | — |
| `08-product-modules.md` | open | 1 |
| `09-account-and-settings.md` | open | 2 |
| `10-administration.md` | open | 2 |
| `11-boundaries-and-blockers.md` | **verified** | — |
| `12-verification-protocol.md` | **verified** | — |
| `README.md` | **verified** | — |

## `01-trips-core.md`

- Three stages prescribe `scope.db.batch()`, which does not exist on `TenantScope['db']` and will not typecheck; the repo's one batching implementation, `runBatch()`, is ignored — including inside the very function 01-S4 widens. _(line 1596)_
- 01-S1 specifies `copyTrip` copying a whole itinerary inline in a POST request path and asserts "Nothing in this stage is slow", contradicting `src/server/repos/batch.ts`'s own header rule and TEMPLATE.md's queue rule. The copy is unbounded on the paid tiers. _(line 467)_
- A cross-plan obligation that 00-S5 explicitly assigns to this plan — `cancelReminder` on the archive and delete paths — is not carried by any stage. 01-S1 owns TRP-03 and never mentions it. _(line 467)_
- 01-S2 and 01-S6 file their schema requirements to the schema stage of their own wave, which under 00-foundations.md's stated convention collects the *next* wave's needs. Both stages would run against a schema that does not yet have what they need. _(line 769)_

## `02-places-and-maps.md`

- 02-S2 plans a hand-rolled radio group for the basemap picker and does not name `RadioGroup`/`RadioCard` from src/components/ui, in the same bullet that invokes the "a second implementation is a defect" rule. A builder following this text will duplicate an existing, unused primitive. _(line 656)_

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

- 08-S9 cites its MAP-02 dependency as wave 2 when it is wave 6 and BLOCKED, then closes ADD-10 as done anyway _(line 2967)_

## `09-account-and-settings.md`

- 09-S3 plans to reuse `PasswordStrength`, which is a non-exported module-local function in a file no stage owns — the stage cannot be built without an ownership violation or a duplicate primitive _(line 977)_
- The Cross-plan collisions section misattributes the wave-less `04-S2` to 04-budget-and-currencies.md, which states its wave correctly; the real source is a fenced example in 12-verification-protocol.md that the collision script parses as a stage _(line 2868)_

## `10-administration.md`

- 10-S4's permission matrix permits `member.invite` to be lowered to `member`, while 10-S1's invite input accepts any role including `owner` — a privilege-escalation path the stage's own invariants block does not cover. _(line 1446)_
- 10-S4 enumerates seven `assertCanAdminister` call sites in members.ts and asserts the helper's remaining callers are "the four audit reads" — wrong at wave 5, because 09-S3 (wave 1) adds an eighth in the same file, which 10-S4 itself names as a shared path. _(line 1291)_

