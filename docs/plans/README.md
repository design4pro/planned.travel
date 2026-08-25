# planned.travel — implementation plans

`docs/` is described in `docs/SPEC.md` §6 as "spec + architecture notes". This directory adds the
third kind of document: **staged implementation plans**, one per product area, that carve the 89-row
feature gap in `.claude/ultrabuild/recon/gap-rows.json` into stages small enough for one agent to own
end to end.

A plan is not a design document and not a backlog. It is a sequence of **stages**, each of which
names its owned paths, its data change, its server functions, its UI, its quota, its tenant-isolation
test and its verification — so that two agents working two stages in the same wave can never write
the same file. The stage shape is fixed by `TEMPLATE.md` and is not negotiable per plan.

---

## The fifteen files

Every file in this directory is listed here. There are no others, and nothing outside this list may
be added without amending this table first.

| File                               | Scope — one line each                                                                                                                                        |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `TEMPLATE.md`                      | The stage block every plan copies: eleven required headings in a fixed order, plus the definition of done every stage inherits unchanged.                    |
| `00-foundations.md`                | The shared files no feature stage may claim — schema, worker entry, wrangler bindings, tokens, `components/ui`, generated route tree; its stages are wave 0. |
| `01-trips-core.md`                 | Trip lifecycle, creation, membership and guests, day model, day notes, the merged day timeline and the planner workspace shell.                              |
| `02-places-and-maps.md`            | Place creation and the place form, search and import paths, markers and clustering, map styles, layers and route overlays.                                   |
| `03-reservations-and-transport.md` | Reservation records and the booking desk, transport records and legs, airport and station pickers, transit search, transport in the day.                     |
| `04-budget-and-currencies.md`      | Budget entries, expense splitting and settlements, per-expense currency with frozen rates, display currency and budget reporting.                            |
| `05-packing-and-todos.md`          | Packing lists and categories, quantity and check state, filters and progress, templates and the shared template library, todo lists.                         |
| `06-documents-and-media.md`        | File upload and storage in R2, starring and the trash lifecycle, multi-target file links, PDF export, calendar output, per-day weather.                      |
| `07-collaboration-and-sharing.md`  | Realtime trip sync and the wire contract, chat, notes, polls, presence, the collab panel, public share links and trip invite links.                          |
| `08-product-modules.md`            | The optional product modules — world-map atlas, travel journal, leave planner, saved collections — and the entitlement gate that sells them.                 |
| `09-account-and-settings.md`       | Account, security and passkeys, appearance, notification preferences and the notification write path, locale, PWA install, in-app help.                      |
| `10-administration.md`             | The workspace console: member and invitation administration, workspace-wide defaults, the audit write path and audit reading.                                |
| `11-boundaries-and-blockers.md`    | The ten rows that do not port to hosted multi-tenant, their named hosted equivalents, and every row blocked by the SPEC §3 freeze.                           |
| `12-verification-protocol.md`      | How a stage proves itself: the command gate, unit and isolation tests, the e2e/visual evidence format, viewports, themes and console rules.                  |
| `13-content-studio.md`             | The operator content plane: Studio roles and audit, content stores with versioned translations, the block editor and media library, the public site as data, announcements, and managed legal documents with acceptance. Waves 7-11, above the matrix set. |

### Filename scheme

`NN-kebab-area.md` — a two-digit ordinal that fixes reading order, then a lowercase kebab-case area
name, then `.md`. `TEMPLATE.md` is the only file exempt from the ordinal. One plan per area; a plan
never spawns a second file, it grows another stage.

---

## The naming rule that binds every plan file

`docs/SPEC.md` §1 is a clean-room rule, and it binds documents in this directory exactly as it binds
code. Every file this plan set creates — the fifteen above — obeys all five of these:

1. The upstream project is called **"the reference product"**. Its name, wordmark and logo appear in
   none of these files: not in prose, not in a heading, not in a filename, not in a URL. (`SPEC.md`
   §1 names the project once in order to forbid it; that clause is the contract, not a plan file,
   and nothing here may quote it.)
2. A page of its public wiki is cited as `` `wiki: <Page-Name>` `` and nothing else. **No URL.** The
   citation exists so a reader knows which behaviour was studied, not so they can fetch the page.
3. **No sentence, table name, column name, enum value, class name or UI string is reproduced from
   it.** Not paraphrased-with-the-same-words either. If a plan needs to name a thing, it names it in
   planned.travel's own vocabulary, using the tables that already exist in `src/server/db/schema.ts`.
4. Plans describe **behaviour and outcome**, never an implementation to be transcribed. "The day
   timeline interleaves places, notes and transport legs in time-then-order sequence" is a
   behavioural statement. A field list copied off a wiki page is not.
5. The row ids (`TRP-01`, `MAP-09`, …) are **our own** recon identifiers, minted in
   `.claude/ultrabuild/recon/gap-rows.json`. They are safe to cite anywhere and are the preferred way
   for one plan to point at a feature owned by another.

The reference product is AGPL-3.0 with an asserted trademark. Reading it to learn _what_ a feature
does is sanctioned; carrying its text into this repository is not.

---

## Shared-file protocol

These six paths are **never claimed by a feature stage**, in any plan, in any wave:

| Path                      | Why it is shared                                                                              |
| ------------------------- | --------------------------------------------------------------------------------------------- |
| `src/server/db/schema.ts` | Every table lives in one module; two stages adding columns in parallel corrupt each other.    |
| `src/server/worker.ts`    | The Worker entry re-exports the Durable Object, the queue consumer and the cron handler.      |
| `wrangler.jsonc`          | Bindings, migrations, limits and triggers — one file, one deployment, one owner.              |
| `src/styles/tokens.css`   | The whole token contract of `docs/DESIGN.md`. A second writer produces a silent visual drift. |
| `src/components/ui/**`    | The design-system primitives. A duplicate primitive is a defect, not a merge conflict.        |
| `src/routeTree.gen.ts`    | Generated. Never hand-edited; produced by `pnpm generate-routes` after a route file lands.    |

**`00-foundations.md` governs all six, and its stages are wave 0.** A feature stage that needs a new
column, a new binding, a new token or a new primitive does not write it — it states the requirement
under its **Data and migration**, **Quota** or **UI** heading, and that requirement becomes a
foundations stage in wave 0, which closes before wave 1 opens. A stage whose **Owned paths** list
contains any of the six is malformed and is rejected before it is scheduled.

`src/routeTree.gen.ts` is the one entry with a mechanical exception: a stage that adds a route file
runs `pnpm generate-routes` and the regenerated tree travels with that stage's diff. It is still
never hand-edited and never listed under **Owned paths**.

---

## Wave order

A **wave** is a set of stages that may be built concurrently because none of them depends on another
in the same wave. It is not a sprint and not a release: a wave may take several runs, and a run may
carry stages from one wave only.

### Wave 0 is foundations, and carries no gap row

The 89 rows occupy waves 1 to 6. Wave 0 sits above all of them and belongs entirely to
`00-foundations.md`, because a row that needs a schema change, a quota metric or one of the four
missing write paths **cannot sit in the same wave as the stage that supplies it** — same-wave stages
run concurrently, so the supplier would not have landed. Without wave 0 the shared-file rule above
would be unsatisfiable for every wave-1 row that needs a schema change: `MNY-01` needs a per-trip
cost-category entity that does not exist, and `MNY-07` needs a rate source and the columns to freeze
into. Neither could point at an earlier wave, because there was none.

Wave 0 carries these concerns. `00-foundations.md` mints the stage ids and may split any of them:

| Concern                        | What lands in wave 0                                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Schema and migrations          | Every additive table and column a wave-1…6 stage asked for, in one `pnpm db:generate` series. Additive only: a rollback must keep working against the new schema.                                                                                                                                                                                                                                                                                        |
| Quota metrics                  | Any metric a later stage needs in `resolveLimits()` (`src/server/billing/limits.ts`) or `PLAN_QUOTAS` (`src/server/db/types.ts`), plus its case in `src/server/billing/__tests__/limits.test.ts`.                                                                                                                                                                                                                                                        |
| The four unwritten write paths | Four consumers already read data that nothing in production writes: `notify()` in `src/server/repos/notifications.ts`, `recordAudit()` in `src/server/repos/audit.ts`, `recomputeTravelStats()` in `src/server/repos/atlas.ts` and `scheduleReminder()` in `src/server/queue/reminders.ts`. Each is a wave-0 stage: the notification centre, the audit list, the atlas statistics panel and the `*/15` reminder sweep are all downstream of one of them. |
| Tokens and primitives          | Any token missing from `src/styles/tokens.css` and any genuinely new primitive in `src/components/ui`. A stage that would add a second implementation of an existing primitive is rejected instead.                                                                                                                                                                                                                                                      |
| Bindings and the Worker entry  | Any binding a later stage needs in `wrangler.jsonc`, together with its re-export from `src/server/worker.ts`. A new binding is also a cost-model change and is argued as one.                                                                                                                                                                                                                                                                            |

### The cuts were made in round 3 and are consumed here, not re-derived

The `dependsOn` edges originally contained **nine mutual pairs** — A depends on B and B depends on A
— which no topological order can satisfy. Round 3 cut exactly one edge per pair, recorded each cut
with a reason in `.claude/ultrabuild/recon/gap-cuts.json`, and applied the result to
`gap-rows.json`. **This file consumes that record.** It does not re-cut the graph, does not re-point
an edge, and does not add a disposition of its own: the table below is a plain longest-path level
over `gap-rows.json` exactly as it stands on disk, which is acyclic and sorts into six waves.

Each cut kept the edge pointing from the dependent surface to the record or host it needs, which is
the only direction in which the earlier row is independently shippable.

| Edge removed      | Surviving edge    | Reason recorded in `gap-cuts.json`                                                            |
| ----------------- | ----------------- | --------------------------------------------------------------------------------------------- |
| `TRP-02 → TRP-04` | `TRP-04 → TRP-02` | Pre-departure reminders need a trip that already has dates.                                   |
| `TRP-09 → TRP-08` | `TRP-08 → TRP-09` | The day-note record and its write path precede the merged timeline that orders notes.         |
| `MAP-01 → MAP-02` | `MAP-02 → MAP-01` | Manual place creation is the primitive; every import path writes the same rows through it.    |
| `BKG-02 → DOC-04` | `DOC-04 → BKG-02` | A reservation must exist before a file can be linked to it.                                   |
| `BKG-06 → BKG-07` | `BKG-07 → BKG-06` | The transport record must exist before its endpoint pickers can edit it.                      |
| `TRP-08 → BKG-10` | `BKG-10 → TRP-08` | The merged day timeline is the host surface; inline transport rows are placed into it.        |
| `LST-01 → LST-04` | `LST-04 → LST-01` | A packing list must exist before a template can be applied to it or saved from it.            |
| `TRP-06 → DOC-08` | `DOC-08 → TRP-06` | The planner workspace is the host surface; the per-day weather badge is placed into it.       |
| `COL-02 → COL-09` | `COL-09 → COL-02` | The collab panel is the host surface; the upcoming-assignments widget is one of its children. |

`X → Y` reads "X depends on Y". Any further change to the edge set is a change to `gap-rows.json`
and `gap-cuts.json` first, and to this file second — never the other way round.

### What leads, and on what measurement

Both rankings below are counted over `gap-rows.json` as it stands, with the nine cuts already
applied. Every claim that a row is high-leverage names one of them.

**Transitive in-degree** — how many of the 89 rows reach this row through any chain of `dependsOn`:

| Row      | COL-01 | ACC-05 | ADM-02 | TRP-11 | MNY-01 |
| -------- | ------ | ------ | ------ | ------ | ------ |
| Reachers | 20     | 16     | 10     | 8      | 8      |

**Direct in-degree** — how many rows name this row in their own `dependsOn`:

| Row        | DOC-01 | TRP-11 | ACC-05 | MNY-07 | BKG-06 | LST-01 |
| ---------- | ------ | ------ | ------ | ------ | ------ | ------ |
| Dependants | 6      | 5      | 4      | 4      | 4      | 4      |

Only **COL-01** and **ACC-05** lead on both readings, and they are the two rows whose slip moves the
most other work. They chain: `ACC-05 → COL-01`, so realtime sync lands in wave 1 and the notification
matrix in wave 2, and `ADM-02 → ACC-05 → COL-01` puts member administration in wave 3.

Two rows are called out early for a reason **the edge set does not support**, and are named that way
rather than credited with an in-degree they do not have:

- **MNY-07 as a schema precondition.** Its transitive in-degree is 6 and its direct in-degree 4 —
  respectable, not leading. It leads `04-budget-and-currencies.md` because the frozen-rate columns
  and the rate source have to be settled before any downstream money surface can show a converted
  amount, and a rate frozen wrongly is not repairable by a later stage.
- **TRP-11 because membership gates sharing tiers across three other areas.** The edge set puts it in
  wave 4 (`TRP-11 → ADM-02 → ACC-05 → COL-01`) and the table below leaves it there — the wave column
  is mechanical and this file does not move rows. The call-out is a reading priority for whoever
  writes `01-trips-core.md`, not a reordering.

_Errata on MNY-07's recorded evidence:_ that row cites `scripts/seed/README.md` for a collision
between `expenses.originalCurrency` and `expenses.currency` on one SQL column. Measured at HEAD, the
collision is already repaired — `src/server/db/schema.ts:794` reads
`originalCurrency: currency('original_currency')` and `drizzle/0001_aspiring_cargill.sql` creates the
column. `04-budget-and-currencies.md` should plan the missing FX rate source, not a schema repair.

### The table

Read it as: _this stage may start once every wave above it is closed._ All 89 row ids appear exactly
once, and no row sits in a wave earlier than or equal to a row it depends on. Row detail — name,
status, evidence, effort — stays in `gap-rows.json`; it is deliberately not duplicated here, both to
keep one source of truth and because those summaries are recon prose about the reference product.

| Wave | Plan                               | Rows                                                                  | n   |
| ---- | ---------------------------------- | --------------------------------------------------------------------- | --- |
| 0    | `00-foundations.md`                | no gap row — the five wave-0 concerns above                           | —   |
| 1    | `01-trips-core.md`                 | TRP-03 TRP-07 TRP-09 TRP-10                                           | 4   |
| 1    | `02-places-and-maps.md`            | MAP-01 MAP-05 MAP-06 MAP-10                                           | 4   |
| 1    | `03-reservations-and-transport.md` | BKG-06                                                                | 1   |
| 1    | `04-budget-and-currencies.md`      | MNY-01 MNY-05 MNY-07                                                  | 3   |
| 1    | `06-documents-and-media.md`        | DOC-01                                                                | 1   |
| 1    | `07-collaboration-and-sharing.md`  | COL-01 COL-02 COL-06                                                  | 3   |
| 1    | `08-product-modules.md`            | ADD-02 ADD-05 ADD-07 ADD-09                                           | 4   |
| 1    | `09-account-and-settings.md`       | ACC-01 ACC-02 ACC-03 ACC-06 ACC-07 EXT-04                             | 6   |
| 1    | `10-administration.md`             | ADM-04                                                                | 1   |
| 1    | `11-boundaries-and-blockers.md`    | ACC-08 ADD-01 ADM-05 BKG-04 BKG-09 DOC-05 EXT-01 EXT-02 EXT-03 MAP-04 | 10  |
| 2    | `01-trips-core.md`                 | TRP-01 TRP-05 TRP-08                                                  | 3   |
| 2    | `02-places-and-maps.md`            | MAP-02 MAP-07                                                         | 2   |
| 2    | `03-reservations-and-transport.md` | BKG-07 BKG-08                                                         | 2   |
| 2    | `04-budget-and-currencies.md`      | MNY-02 MNY-04 MNY-06                                                  | 3   |
| 2    | `06-documents-and-media.md`        | DOC-03 DOC-06                                                         | 2   |
| 2    | `07-collaboration-and-sharing.md`  | COL-03 COL-07 COL-08 COL-10                                           | 4   |
| 2    | `08-product-modules.md`            | ADD-03 ADD-06 ADD-08                                                  | 3   |
| 2    | `09-account-and-settings.md`       | ACC-05                                                                | 1   |
| 3    | `02-places-and-maps.md`            | MAP-08                                                                | 1   |
| 3    | `03-reservations-and-transport.md` | BKG-02 BKG-10                                                         | 2   |
| 3    | `04-budget-and-currencies.md`      | MNY-03                                                                | 1   |
| 3    | `05-packing-and-todos.md`          | LST-01                                                                | 1   |
| 3    | `06-documents-and-media.md`        | DOC-02 DOC-07                                                         | 2   |
| 3    | `07-collaboration-and-sharing.md`  | COL-04 COL-05 COL-09                                                  | 3   |
| 3    | `08-product-modules.md`            | ADD-04 ADD-10                                                         | 2   |
| 3    | `09-account-and-settings.md`       | ACC-04                                                                | 1   |
| 3    | `10-administration.md`             | ADM-02                                                                | 1   |
| 4    | `01-trips-core.md`                 | TRP-11                                                                | 1   |
| 4    | `02-places-and-maps.md`            | MAP-09                                                                | 1   |
| 4    | `03-reservations-and-transport.md` | BKG-01 BKG-03                                                         | 2   |
| 4    | `05-packing-and-todos.md`          | LST-03 LST-04 LST-05                                                  | 3   |
| 4    | `06-documents-and-media.md`        | DOC-04                                                                | 1   |
| 4    | `10-administration.md`             | ADM-01                                                                | 1   |
| 5    | `01-trips-core.md`                 | TRP-02 TRP-06                                                         | 2   |
| 5    | `02-places-and-maps.md`            | MAP-03                                                                | 1   |
| 5    | `05-packing-and-todos.md`          | LST-02                                                                | 1   |
| 5    | `07-collaboration-and-sharing.md`  | COL-11                                                                | 1   |
| 5    | `10-administration.md`             | ADM-03                                                                | 1   |
| 6    | `01-trips-core.md`                 | TRP-04                                                                | 1   |
| 6    | `03-reservations-and-transport.md` | BKG-05                                                                | 1   |
| 6    | `06-documents-and-media.md`        | DOC-08                                                                | 1   |

Wave totals: **37 · 20 · 14 · 9 · 6 · 3 = 89**.

Two placements are editorial rather than mechanical, and both are stated so a reader does not go
looking for a missing edge:

- The ten out-of-scope rows are gathered in `11-boundaries-and-blockers.md`. They carry no build
  work; the wave is where the _argument_ lands, and it is wave 1 because nothing gates it.
- `EXT-04` (the in-app help browser) is the one Extensibility row that survives the hosted
  multi-tenant boundary, so it is planned in `09-account-and-settings.md` alongside the other
  account-adjacent surfaces rather than with the three out-of-scope Extensibility rows.

### Re-deriving the table

The table is mechanical. `gap-rows.json` already carries the nine cuts, so no disposition is applied
here — this is a plain longest-path level:

```sh
node -e '
const rows = require("./.claude/ultrabuild/recon/gap-rows.json")
const by = Object.fromEntries(rows.map((r) => [r.id, r]))
const deps = (id) => by[id].dependsOn ?? []
const seen = {}
const wave = (id) => (seen[id] ??= deps(id).length ? Math.max(...deps(id).map(wave)) + 1 : 1)
rows.forEach((r) => console.log(wave(r.id), r.id))
'
```

Any change to `gap-rows.json` that alters a wave is a change to this file first and to the affected
plan second — never the other way round.

---

## Rules that apply to every plan in this directory

- **Extend, never recreate.** 57 domain tables, 22 repositories and every product route already
  exist. `.claude/ultrabuild/recon/repo-data.md`, `repo-ui.md` and `repo-platform.md` are the
  inventory. A stage that would write a second implementation of something already on disk is a
  defect, not a plan.
- **The dominant gap is a missing write path, not a missing screen.** Twelve rows have complete
  schema, complete repository and a finished screen, and are held back only by a server function
  that was never exposed. Plans lead with those: they are the cheapest movement on the matrix.
- **Protect what is already ahead of the reference product** — server-side PDF rendering into R2,
  repository-enforced tenant isolation, the hibernating per-trip Durable Object with per-field
  version tracking, and range-aware `.pmtiles` serving. No stage may regress one of these to match
  a reference behaviour.
- **The SPEC §3 dependency freeze is absolute.** `package.json` and `pnpm-lock.yaml` are not edited
  by any stage, and no stage installs a package. A feature that cannot be built without a package
  outside the pinned set is recorded under that stage's **Blockers** heading with a disposition, and
  the row moves to `11-boundaries-and-blockers.md`. It is never planned as if the package were
  available.
- **A stage is sized to one agent and one run.** If a stage needs more than one migration, more than
  one route file, or touches more than one product area, it is two stages.
- **A plan that contradicts a `gap-rows.json` row says so and gives its own evidence.** The matrix is
  a round-3 measurement, not scripture; silently planning around a stale row is how the two
  disagree without anyone noticing.
