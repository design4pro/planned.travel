# Open findings, per plan

Generated from `.claude/ultrabuild/items.json` by the /ultrabuild orchestrator. **This file is not
hand-written and not audited** — it is a register, so a run executing one of these plans knows what
its own auditors had not yet resolved.

A plan marked **verified** passed an adversarial audit with zero blocking findings. A plan with open
findings is still usable — each finding is specific and names the stage it belongs to — but the run
that executes it should resolve them first.

| plan | status | open blocking |
| --- | --- | --- |
| `00-foundations.md` | **verified** | — |
| `01-trips-core.md` | **verified** | — |
| `02-places-and-maps.md` | **verified** | — |
| `03-reservations-and-transport.md` | **verified** | — |
| `04-budget-and-currencies.md` | **verified** | — |
| `05-packing-and-todos.md` | **verified** | — |
| `06-documents-and-media.md` | **verified** | — |
| `07-collaboration-and-sharing.md` | **verified** | — |
| `08-product-modules.md` | **verified** | — |
| `09-account-and-settings.md` | **verified** | — |
| `10-administration.md` | **verified** | — |
| `11-boundaries-and-blockers.md` | **verified** | — |
| `12-verification-protocol.md` | **verified** | — |
| `13-community-gallery.md` | **verified** | — |
| `14-dashboard-mascot.md` | **verified** | — |
| `README.md` | **verified** | — |

Plans 03 and 08 were re-verified in the plans-for-plugins run: 03's `transport` entity-kind error
and unpassable 03-S6 isolation case are rewritten against HEAD, and 08-S1's citations are
re-measured. Plans 13 and 14 were authored and audited in that same run.

## Non-blocking notes for executing runs

- `03-reservations-and-transport.md` and `13-community-gallery.md` still cite
  `.claude/ultrabuild/recon/gap-rows.json` (03: ten places, including a verification one-liner),
  an artifact that exists nowhere on disk or in git history. Treat those citations as historical;
  the materialised wave table in `docs/plans/README.md` is the surviving source. Tracked as
  `plans-cite-lost-gap-rows` in `.claude/ultrabuild/knowledge/backlog.json`.
- `13-community-gallery.md`: the cross-plan collision table omits 07-S2 (wave 1) as a claimant of
  `src/routes/_app/trips/$tripId/collab.tsx`; 13-S1 calls the sibling claims on
  `src/server/repos/index.ts` "all appends" while 01-S6 and 07-S10 mark theirs "edit"; 13-S4's
  thread empty state names copy but no illustration. Re-check these three while executing plan 13.
