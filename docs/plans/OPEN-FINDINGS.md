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
| `03-reservations-and-transport.md` | open | 2 |
| `04-budget-and-currencies.md` | **verified** | — |
| `05-packing-and-todos.md` | **verified** | — |
| `06-documents-and-media.md` | **verified** | — |
| `07-collaboration-and-sharing.md` | **verified** | — |
| `08-product-modules.md` | open | 1 |
| `09-account-and-settings.md` | **verified** | — |
| `10-administration.md` | **verified** | — |
| `11-boundaries-and-blockers.md` | **verified** | — |
| `12-verification-protocol.md` | **verified** | — |
| `README.md` | **verified** | — |

## `03-reservations-and-transport.md`

- 03-S1 and 03-S2 mirror to a `transport` Durable Object entity kind that does not exist; the real kind is `route`, and `patch('transport', …)` is a TypeScript error _(line 423)_
- 03-S6's tenant-isolation case asserts `updateUserSettings` rejects a foreign member id; the function ensures-and-inserts instead, so the specified test cannot pass _(line 1866)_

## `08-product-modules.md`

- 08-S1's "Measured at HEAD, not recalled" paragraph cites two exported identifiers that do not exist at HEAD and three line numbers that are only valid in another session's uncommitted working tree _(line 214)_

