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
| `02-places-and-maps.md` | open | 1 |
| `03-reservations-and-transport.md` | open | 1 |
| `04-budget-and-currencies.md` | open | 2 |
| `05-packing-and-todos.md` | open | 3 |
| `06-documents-and-media.md` | **verified** | — |
| `07-collaboration-and-sharing.md` | **verified** | — |
| `08-product-modules.md` | open | 3 |
| `09-account-and-settings.md` | open | 2 |
| `10-administration.md` | **verified** | — |
| `11-boundaries-and-blockers.md` | **verified** | — |
| `12-verification-protocol.md` | **verified** | — |
| `README.md` | **verified** | — |

## `02-places-and-maps.md`

- 02-S3 rests on a false claim that the camera behaviour is untested; six of the seven invariants it plans to write already exist, so executing the stage as written produces duplicate tests in files the plan never mentions. _(line 875)_

## `03-reservations-and-transport.md`

- Five of the plan's six schema requirements have no owner anywhere in the plan set: they are filed to "the wave-0 foundations schema stage", whose own absorption clause covers only wave-1 filers. As written, 03-S2 has no `transport_legs` table and 03-S4 cannot compile `markReservationsImported`. _(line 236)_

## `04-budget-and-currencies.md`

- 04-S6 gives `expense_ticket_lines.amount_minor` the parent's SOURCE currency, then writes the sum of those lines into `expenses.amount_minor`, which is the TRIP currency column. On a foreign receipt this stores a source-currency figure in an accounting-currency column and derives `expense_shares.share_minor` (also accounting currency) from it. No conversion step is stated anywhere in the stage. _(line 2104)_
- 04-S1 overloads `user_settings.currency` as the display-currency preference with an `'XXX'` sentinel, and asserts the one existing consumer "is unaffected". The shipped settings screen labels that exact column "New trips start in this currency" and binds the raw value into a SimpleSelect whose option list cannot contain `XXX`, so the sentinel is neither intercepted nor renderable. _(line 469)_

## `05-packing-and-todos.md`

- "formatWeight is the only renderer ... and stays that way" is false at HEAD: src/components/modules/lists/lists-board.tsx:136 defines a private duplicate that already disagrees with the shared one on the same screen, and no stage removes it. _(line 69)_
- "Every list write already mirrors ... as patch('trip', tripId, { listsChangedAt })" is false — every item-level write mirrors as patch('packing-item', …) with field payloads — and the plan-level convention built on that falsehood binds every stage's item writes to the coarser stamp. _(line 26)_
- Applying a template — the whole point of 05-S2/LST-04 — produces a list that renders in the read-only "Legacy group" state 05-S1 introduces, because applyTemplateToTrip writes category strings and no stage in wave 4 may touch the repository to adopt them. _(line 807)_

## `08-product-modules.md`

- 08-S3 asserts `getTrip` raises NotFoundError for a foreign trip id; it returns `null`. The stage's headline tenant-isolation case cannot pass as written. _(line 932)_
- 08-S4 states `getCollection` "resolves through `requireById` and throws"; it calls `findById` and returns `null`. _(line 1316)_
- 08-S4's "point of the block" tenant case requires `setCollectionPlaceLabels` to reject a foreign label id; the shipped function silently drops it and resolves. _(line 1320)_

## `09-account-and-settings.md`

- 09-S8 claims ACC-04 has no dependants; BKG-01 declares dependsOn ACC-04, and the sibling plan records the same edge _(line 2640)_
- Three of the four rows in 09-S8's deferral table name a destination that does not own the behaviour, is scheduled in a different wave, or is itself BLOCKED _(line 2605)_

