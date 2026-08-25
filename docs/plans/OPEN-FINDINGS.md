# Open findings, per plan

Generated from `.claude/ultrabuild/items.json` by the /ultrabuild orchestrator. **This file is not
hand-written and not audited** — it is a register, so a run executing one of these plans knows what
its own auditors had not yet resolved.

A plan marked **verified** passed an adversarial audit with zero blocking findings. A plan with open
findings is still usable — each finding is specific and names the stage it belongs to — but the run
that executes it should resolve them first.

| plan                               | status       | open blocking |
| ---------------------------------- | ------------ | ------------- |
| `00-foundations.md`                | **verified** | —             |
| `01-trips-core.md`                 | **verified** | —             |
| `02-places-and-maps.md`            | **verified** | —             |
| `03-reservations-and-transport.md` | **verified** | —             |
| `04-budget-and-currencies.md`      | **verified** | —             |
| `05-packing-and-todos.md`          | **verified** | —             |
| `06-documents-and-media.md`        | **verified** | —             |
| `07-collaboration-and-sharing.md`  | **verified** | —             |
| `08-product-modules.md`            | **verified** | —             |
| `09-account-and-settings.md`       | **verified** | —             |
| `10-administration.md`             | **verified** | —             |
| `11-boundaries-and-blockers.md`    | **verified** | —             |
| `12-verification-protocol.md`      | **verified** | —             |
| `13-community-gallery.md`          | **verified** | —             |
| `14-dashboard-mascot.md`           | **verified** | —             |
| `README.md`                        | **verified** | —             |

Plans 03 and 08 were re-verified in the plans-for-plugins run: 03's `transport` entity-kind error
and unpassable 03-S6 isolation case are rewritten against HEAD, and 08-S1's citations are
re-measured. Plans 13 and 14 were authored and audited in that same run.

## Non-blocking notes for executing runs

- Eleven plans authored by the original planning run (`00`, `01`, `02`, `04`, `06`, `07`, `09`,
  `11`, `12`, `14`) plus `TEMPLATE.md` still cite `.claude/ultrabuild/recon/gap-rows.json`, an
  artifact that exists nowhere on disk or in git history; plans `03` and `13` were cleaned in the
  plans-for-plugins run (zero hits). Treat the remaining citations as historical — the materialised
  wave table in `docs/plans/README.md` is the surviving record. Tracked as
  `plans-cite-lost-gap-rows` in `.claude/ultrabuild/knowledge/backlog.json`.
- `README.md` (round-8 audit): the wave-table footnote ("Row detail … stays in gap-rows.json") and
  the "Extend, never recreate" bullet citing `repo-data.md`/`repo-ui.md`/`repo-platform.md` still
  speak of the lost recon store in the present tense. Read them as historical provenance, not as
  readable files.
