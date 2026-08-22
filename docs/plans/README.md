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

## The fourteen files

Every file in this directory is listed here. There are no others, and nothing outside this list may
be added without amending this table first.

| File                               | Scope — one line each                                                                                                                        |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `TEMPLATE.md`                      | The stage block every plan copies: eleven required headings in a fixed order, plus the definition of done every stage inherits unchanged.    |
| `00-foundations.md`                | The shared files no feature stage may claim — schema, worker entry, wrangler bindings, tokens, `components/ui`, generated route tree.        |
| `01-trips-core.md`                 | Trip lifecycle, creation, membership and guests, day model, day notes, the merged day timeline and the planner workspace shell.              |
| `02-places-and-maps.md`            | Place creation and the place form, search and import paths, markers and clustering, map styles, layers and route overlays.                   |
| `03-reservations-and-transport.md` | Reservation records and the booking desk, transport records and legs, airport and station pickers, transit search, transport in the day.     |
| `04-budget-and-currencies.md`      | Budget entries, expense splitting and settlements, per-expense currency with frozen rates, display currency and budget reporting.            |
| `05-packing-and-todos.md`          | Packing lists and categories, quantity and check state, filters and progress, templates and the shared template library, todo lists.         |
| `06-documents-and-media.md`        | File upload and storage in R2, starring and the trash lifecycle, multi-target file links, PDF export, calendar output, per-day weather.      |
| `07-collaboration-and-sharing.md`  | Realtime trip sync and the wire contract, chat, notes, polls, presence, the collab panel, public share links and trip invite links.          |
| `08-product-modules.md`            | The optional product modules — world-map atlas, travel journal, leave planner, saved collections — and the entitlement gate that sells them. |
| `09-account-and-settings.md`       | Account, security and passkeys, appearance, notification preferences and the notification write path, locale, PWA install, in-app help.      |
| `10-administration.md`             | The workspace console: member and invitation administration, workspace-wide defaults, the audit write path and audit reading.                |
| `11-boundaries-and-blockers.md`    | The ten rows that do not port to hosted multi-tenant, their named hosted equivalents, and every row blocked by the SPEC §3 freeze.           |
| `12-verification-protocol.md`      | How a stage proves itself: the command gate, unit and isolation tests, the e2e/visual evidence format, viewports, themes and console rules.  |

### Filename scheme

`NN-kebab-area.md` — a two-digit ordinal that fixes reading order, then a lowercase kebab-case area
name, then `.md`. `TEMPLATE.md` is the only file exempt from the ordinal. One plan per area; a plan
never spawns a second file, it grows another stage.

---

## The naming rule that binds every plan file

`docs/SPEC.md` §1 is a clean-room rule, and it binds documents in this directory exactly as it binds
code. Every plan file obeys all five of these:

1. The upstream project is called **"the reference product"**. Its name, wordmark and logo appear
   nowhere in this repository — not in prose, not in a heading, not in a filename, not in a URL.
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

**`00-foundations.md` governs all six.** A feature stage that needs a new column, a new binding, a
new token or a new primitive does not write it — it states the requirement under its **Data and
migration**, **Quota** or **UI** heading, and that requirement becomes a foundations stage that must
land in an earlier wave. A stage whose **Owned paths** list contains any of the six is malformed and
is rejected before it is scheduled.

---

## Wave order

A **wave** is a set of rows that may be built concurrently because none of them depends on another
in the same wave. It is not a sprint and not a release: a wave may take several runs, and a run may
carry stages from one wave only.

The waves below are derived from the `dependsOn` edges in
`.claude/ultrabuild/recon/gap-rows.json`. Every one of the 89 row ids appears exactly once, and no
row sits in a wave earlier than or equal to any row it depends on.

### Why the raw edge set cannot be sorted as given

The `dependsOn` field is a recon judgement, not a validated DAG, and it does not sort as it stands.
It contains **nine mutual pairs** — A depends on B and B depends on A — which no topological order
can satisfy. Each pair is broken in the direction that puts the **entity and its write path** before
the **surface that renders or enriches it**, because that is the only direction in which the earlier
row is independently shippable.

Two further edges are re-pointed so that the four rows the most others hang off — **COL-01**,
**ACC-05**, **TRP-11** and **MNY-07** — lead the sequence in wave 1.

| Edge in the file  | Disposition | Reason                                                                                                                        |
| ----------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `TRP-04 → TRP-02` | cut         | The reminder engine and its schedule must exist before a creation dialog can offer reminder presets.                          |
| `TRP-06 → DOC-08` | cut         | The planner workspace is the container; per-day weather is a badge rendered inside a day row it already has.                  |
| `TRP-09 → TRP-08` | cut         | Day notes are an entity with its own write path; the merged timeline is what later renders them alongside places.             |
| `TRP-08 → BKG-10` | cut         | Same shape one level up: the timeline shell first, transports slotted into it second.                                         |
| `BKG-06 → BKG-07` | cut         | The transport record is the entity; the airport and station-chain pickers enrich its endpoint fields.                         |
| `MAP-01 → MAP-02` | cut         | Manual place creation is the create-place write path. Until search lands, its address field degrades to coordinates.          |
| `BKG-02 → DOC-04` | cut         | Reservation CRUD is the entity; the multi-target file link picker is an attachment surface on top of it.                      |
| `LST-01 → LST-04` | cut         | A list must exist before a template can seed one or be saved from one.                                                        |
| `COL-02 → COL-09` | cut         | The collab panel is the container; the upcoming-assignments widget (COL-09) is one of the surfaces it hosts.                  |
| `ACC-05 → COL-01` | cut         | The notification write path is a D1 write plus a centre that already reads it. Live push over the trip room is an enrichment. |
| `TRP-11 → ADM-02` | reversed    | Trip membership and the invitation machinery are the model; workspace member administration is the console built over it.     |

Nothing else is changed. Every other edge in the file is honoured exactly as written.

### The table

Read it as: _this row may start once every wave above it is closed._ Row detail — name, status,
evidence, effort — stays in `gap-rows.json`; it is deliberately not duplicated here, both to keep one
source of truth and because those summaries are recon prose about the reference product.

| Wave | Plan                               | Rows                                                                  | n   |
| ---- | ---------------------------------- | --------------------------------------------------------------------- | --- |
| 1    | `01-trips-core.md`                 | TRP-03 TRP-07 TRP-09 TRP-10 TRP-11                                    | 5   |
| 1    | `02-places-and-maps.md`            | MAP-01 MAP-05 MAP-06 MAP-10                                           | 4   |
| 1    | `03-reservations-and-transport.md` | BKG-06                                                                | 1   |
| 1    | `04-budget-and-currencies.md`      | MNY-01 MNY-05 MNY-07                                                  | 3   |
| 1    | `06-documents-and-media.md`        | DOC-01                                                                | 1   |
| 1    | `07-collaboration-and-sharing.md`  | COL-01 COL-02 COL-06                                                  | 3   |
| 1    | `08-product-modules.md`            | ADD-02 ADD-05 ADD-07 ADD-09                                           | 4   |
| 1    | `09-account-and-settings.md`       | ACC-01 ACC-02 ACC-03 ACC-05 ACC-06 ACC-07 EXT-04                      | 7   |
| 1    | `10-administration.md`             | ADM-04                                                                | 1   |
| 1    | `11-boundaries-and-blockers.md`    | ACC-08 ADD-01 ADM-05 BKG-04 BKG-09 DOC-05 EXT-01 EXT-02 EXT-03 MAP-04 | 10  |
| 2    | `01-trips-core.md`                 | TRP-01 TRP-04 TRP-05 TRP-06 TRP-08                                    | 5   |
| 2    | `02-places-and-maps.md`            | MAP-02 MAP-07                                                         | 2   |
| 2    | `03-reservations-and-transport.md` | BKG-07 BKG-08                                                         | 2   |
| 2    | `04-budget-and-currencies.md`      | MNY-02 MNY-04 MNY-06                                                  | 3   |
| 2    | `05-packing-and-todos.md`          | LST-01                                                                | 1   |
| 2    | `06-documents-and-media.md`        | DOC-03 DOC-06                                                         | 2   |
| 2    | `07-collaboration-and-sharing.md`  | COL-03 COL-07 COL-08 COL-10 COL-11                                    | 5   |
| 2    | `08-product-modules.md`            | ADD-03 ADD-04 ADD-06 ADD-08                                           | 4   |
| 2    | `10-administration.md`             | ADM-02 ADM-03                                                         | 2   |
| 3    | `01-trips-core.md`                 | TRP-02                                                                | 1   |
| 3    | `02-places-and-maps.md`            | MAP-08                                                                | 1   |
| 3    | `03-reservations-and-transport.md` | BKG-02 BKG-10                                                         | 2   |
| 3    | `04-budget-and-currencies.md`      | MNY-03                                                                | 1   |
| 3    | `05-packing-and-todos.md`          | LST-02 LST-03 LST-04 LST-05                                           | 4   |
| 3    | `06-documents-and-media.md`        | DOC-02 DOC-07 DOC-08                                                  | 3   |
| 3    | `07-collaboration-and-sharing.md`  | COL-04 COL-05 COL-09                                                  | 3   |
| 3    | `08-product-modules.md`            | ADD-10                                                                | 1   |
| 3    | `09-account-and-settings.md`       | ACC-04                                                                | 1   |
| 3    | `10-administration.md`             | ADM-01                                                                | 1   |
| 4    | `02-places-and-maps.md`            | MAP-09                                                                | 1   |
| 4    | `03-reservations-and-transport.md` | BKG-01 BKG-03 BKG-05                                                  | 3   |
| 4    | `06-documents-and-media.md`        | DOC-04                                                                | 1   |
| 5    | `02-places-and-maps.md`            | MAP-03                                                                | 1   |

Wave totals: **39 · 26 · 18 · 5 · 1 = 89**.

`EXT-04` (the in-app help browser) is the one Extensibility row that survives the hosted-multi-tenant
boundary, so it is planned in `09-account-and-settings.md` alongside the other account-adjacent
surfaces. The other three Extensibility rows are out of scope and belong to
`11-boundaries-and-blockers.md`, together with the seven out-of-scope rows from other areas.

### Re-deriving the table

The table is mechanical. To re-check it after `gap-rows.json` changes, apply the eleven dispositions
above and take the longest-path level of each row:

```sh
node -e '
const rows = require("./.claude/ultrabuild/recon/gap-rows.json")
const cut = new Set(["TRP-04>TRP-02","TRP-06>DOC-08","TRP-09>TRP-08","TRP-08>BKG-10","BKG-06>BKG-07","MAP-01>MAP-02","BKG-02>DOC-04","LST-01>LST-04","COL-02>COL-09","ACC-05>COL-01","TRP-11>ADM-02"])
const extra = { "ADM-02": ["TRP-11"] }
const by = Object.fromEntries(rows.map((r) => [r.id, r]))
const deps = (id) => [...(by[id].dependsOn ?? []).filter((d) => !cut.has(id + ">" + d)), ...(extra[id] ?? [])]
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
  by any stage. A feature that cannot be built without a package outside the pinned set is recorded
  under that stage's **Blockers** heading with a disposition, and the row moves to
  `11-boundaries-and-blockers.md`. It is never planned as if the package were available.
- **A stage is sized to one agent and one run.** If a stage needs more than one migration, more than
  one route file, or touches more than one product area, it is two stages.
