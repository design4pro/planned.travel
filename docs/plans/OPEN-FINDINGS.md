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
| `02-places-and-maps.md` | **verified** | — |
| `03-reservations-and-transport.md` | open | 1 |
| `04-budget-and-currencies.md` | open | 1 |
| `05-packing-and-todos.md` | open | 1 |
| `06-documents-and-media.md` | **verified** | — |
| `07-collaboration-and-sharing.md` | **verified** | — |
| `08-product-modules.md` | open | 3 |
| `09-account-and-settings.md` | **verified** | — |
| `10-administration.md` | **verified** | — |
| `11-boundaries-and-blockers.md` | **verified** | — |
| `12-verification-protocol.md` | **verified** | — |
| `README.md` | **verified** | — |

## `03-reservations-and-transport.md`

- 03-S6 asserts `getEffectiveSettings` "already returns the whole row" and therefore needs no change beyond one validator line. It returns a hand-built object literal, so the new preference never reaches any reader and the stage ships a dead masking feature. _(line 1994)_

## `04-budget-and-currencies.md`

- 04-S2 closes MNY-01 and declares "No behaviour of this row is deferred", but no wave-1 stage can write expenses.cost_category_id. The write path lands in 04-S3 (wave 2), in two modules 04-S1 holds exclusively in wave 1 and explicitly refuses to edit. Three of 04-S2's own claims are therefore unsatisfiable as written. _(line 913)_

## `05-packing-and-todos.md`

- 05-S2 specifies an `overwrite` input, a "Replace it" affordance and a unit test asserting replace semantics, but names no write path for it — and no existing repository function can perform it, while the stage owns no file under src/server/repos. _(line 1091)_

## `08-product-modules.md`

- 08-S3 asserts `getTrip` raises NotFoundError for a foreign trip id; it returns `null`. The stage's headline tenant-isolation case cannot pass as written. _(line 932)_
- 08-S4 states `getCollection` "resolves through `requireById` and throws"; it calls `findById` and returns `null`. _(line 1316)_
- 08-S4's "point of the block" tenant case requires `setCollectionPlaceLabels` to reject a foreign label id; the shipped function silently drops it and resolves. _(line 1320)_

