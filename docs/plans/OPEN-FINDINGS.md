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
| `04-budget-and-currencies.md` | **verified** | — |
| `05-packing-and-todos.md` | **verified** | — |
| `06-documents-and-media.md` | **verified** | — |
| `07-collaboration-and-sharing.md` | **verified** | — |
| `08-product-modules.md` | open | 3 |
| `09-account-and-settings.md` | **verified** | — |
| `10-administration.md` | **verified** | — |
| `11-boundaries-and-blockers.md` | **verified** | — |
| `12-verification-protocol.md` | **verified** | — |
| `README.md` | **verified** | — |

## `03-reservations-and-transport.md`

- 03-S7 mints a duplicate TASKS accessor: `taskQueue()` already exists, is exported, and is already used with `enqueueTask`. The stage's 'must not be reimplemented' measurement missed the one producer helper that exists. _(line 2347)_

## `08-product-modules.md`

- Area brief and 08-S3's Stage id both claim "three" files move out of src/routes/_app/-ui/ and that 08-S3 owns all of them, contradicting the plan's own consolidated move table, which lists TWO moves and assigns world-map.tsx to 08-S2. Both stages are Wave 1, so an implementer following the area brief has 08-S3 and 08-S2 both moving src/routes/_app/-ui/world-map.tsx concurrently — the same-wave exclusive collision the wave rule exists to prevent, and one check-plan-collisions.mjs cannot see because only 08-S2 declares the path. _(line 348)_
- 08-S1's Data and migration section justifies "no index" with a vacay_user_years composite index that does not exist. The shipped indexes are (plan_id, user_id, year) unique — organization_id absent entirely — plus (organization_id, plan_id) and (organization_id, user_id, year). No index over (organization_id, plan_id, user_id, year) exists, and none leads with organization_id while carrying all three of plan_id, user_id and year. The conclusion survives by accident (the org+plan prefix covers the predicate); the stated reason is false and carries no file:line citation. _(line 288)_
- Two stages assert that organization_id is "the leading column of EVERY composite index" on tables where it is not, and 08-S4 uses that assertion as its tenant-safety argument ("A label row therefore cannot be written into another workspace even by a handler that forgot to check"). journey_entries and collection_labels each carry composite indexes led by a non-tenant column. The safety conclusion is separately supported by createTenantRepository stamping organization_id on insert, but the premise is a false, uncited claim about shipped schema — and the strong wording appears alongside five correct uses of the weaker "a composite index", so it reads as measured when it was not. _(line 922)_

