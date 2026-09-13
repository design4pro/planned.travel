# Index-usable airport type-ahead

| Field              | Value |
| ------------------ | ----- |
| **Status**         | draft |
| **Issue**          | #194  |
| **Spec PR**        | none  |
| **Implementation** | none  |

## 📝 TLDR

Every keystroke in the endpoint type-ahead reads all 9,057 rows of `airports`. The four indexes the
table already carries cannot serve the read, because SQLite's `LIKE` optimization needs an index
whose collation matches the comparison and all four are `BINARY`. Giving the prefix columns
`COLLATE NOCASE` indexes turns the same query into a four-way indexed probe without changing one
line of SQL, one returned row, or one ordering. This is a schema-and-migration change with a query
plan assertion behind it, for every traveller typing into the airport box.

## 📝 Problem Statement

`searchAirports` (`src/server/catalog/airports.ts`) backs the endpoint type-ahead through
`src/server/fns/transports.ts:510`. It is on a per-keystroke path, and D1 bills rows read.

Replaying the shipped migration `drizzle/0008_sharp_purple_man.sql` against the committed 9,057-row
artefact `public/atlas/airports-iata.v1.txt` and running `EXPLAIN QUERY PLAN` over the exact SQL
the module emits:

```
SCAN airports
USE TEMP B-TREE FOR ORDER BY
```

No index is touched. The cause is collation. With `case_sensitive_like` off — SQLite's default, and
the behaviour the suite's own "folds case over ASCII" case pins — `LIKE 'term%'` can only be
converted into an indexed range scan when the index's collation is `NOCASE`. All four indexes
(`airports_iata_unq`, `airports_icao_unq`, `airports_name_idx`, `airports_city_idx`) are the default
`BINARY`, so none of them qualifies.

Two consequences, both measured rather than argued:

- **The read costs 9,057 rows per keystroke** where a typical 3–4 character term matches 13 to 205
  of them.
- **`airports_name_idx` and `airports_city_idx` are pure write cost.** They serve no read at all
  today; they are paid for on every artefact load and return nothing.

Two comments in the repository assert the opposite and are, as written, false. The module docstring
says "A leading wildcard cannot use an index, and this is a table of tens of thousands of rows
queried on every keystroke", implying the trailing-wildcard form does use one. The schema comment
says "the type-ahead matches a prefix of the code, the name or the city; the two codes are covered
by their unique indexes above". Neither is true before this change, and both become true after it.

## 📝 Proposed Solution

**Change the indexes, not the query.** The read's SQL, its result set, its ordering and its cap all
stay exactly as they are. The change is four index definitions in `src/server/db/schema.ts` and the
migration `pnpm db:generate` writes from them:

| Index                      | Today                | After                                | Why                                                                                        |
| -------------------------- | -------------------- | ------------------------------------ | ------------------------------------------------------------------------------------------ |
| `airports_iata_unq`        | `UNIQUE (iata_code)` | unchanged                            | Enforces the constraint and serves `findAirportByCode`'s exact lookup. Must stay `BINARY`. |
| `airports_icao_unq`        | `UNIQUE (icao_code)` | unchanged                            | Same.                                                                                      |
| `airports_name_idx`        | `(name)`             | `(name COLLATE NOCASE)`              | Recollated so the name-prefix probe can use it. Nothing reads it today.                    |
| `airports_city_idx`        | `(city)`             | `(city COLLATE NOCASE)`              | Recollated so the city-prefix probe can use it. Nothing reads it today.                    |
| `airports_iata_prefix_idx` | —                    | **new** `(iata_code COLLATE NOCASE)` | Serves the partial-code tier (`LH` → `LHR`), which the unique index cannot.                |
| `airports_icao_prefix_idx` | —                    | **new** `(icao_code COLLATE NOCASE)` | Same for ICAO.                                                                             |

Verified against the real artefact, the unchanged `searchAirports` SQL then plans as:

```
MULTI-INDEX OR
  INDEX 1  SEARCH airports USING INDEX airports_iata_prefix_idx (iata_code>? AND iata_code<?)
  INDEX 2  SEARCH airports USING INDEX airports_icao_prefix_idx (icao_code>? AND icao_code<?)
  INDEX 3  SEARCH airports USING INDEX airports_name_idx (name>? AND name<?)
  INDEX 4  SEARCH airports USING INDEX airports_city_idx (city>? AND city<?)
USE TEMP B-TREE FOR ORDER BY
```

and `findAirportByCode` keeps `SEARCH airports USING INDEX airports_iata_unq (iata_code=?)`.

### Alternatives considered, and why they lost

**The issue's own suggested direction — recollate all four indexes and restructure the read into a
`UNION ALL` of four ranked, individually-`LIMIT`ed probes.** Rejected on two counts, both measured.

1. _The restructuring is not needed._ The issue states that "SQLite will not drive a four-column
   `OR` plus an expression `ORDER BY` off any index". It does: given `NOCASE` indexes, the planner
   answers the unchanged query with a `MULTI-INDEX OR` over all four (shown above). The premise the
   restructuring rests on does not hold, so the restructuring is complexity bought for nothing —
   and a `UNION ALL` with a per-branch `LIMIT` would additionally change _which_ twenty rows come
   back inside a tier, because an index returns rows in its own column's order and the spec's
   ordering inside a tier is by `name`.
2. _Recollating the two unique indexes is a regression, not a fix._ A `NOCASE` index cannot serve a
   `BINARY` comparison. Measured: with `airports_iata_unq` recollated, `findAirportByCode`'s
   `iata_code = ?` drops from `SEARCH airports USING INDEX airports_iata_unq (iata_code=?)` to
   `SCAN airports`. Repairing that needs `COLLATE NOCASE` added to every equality comparison — in
   `findAirportByCode` and in the rank `case`'s two exact-code tiers — and it also silently tightens
   what the `UNIQUE` constraint rejects: `lhr` and `LHR` stop being two permissible rows.

**Recollate all four and add `COLLATE NOCASE` to the comparisons.** The smaller index footprint —
four indexes rather than six — is real, and a case-insensitive uniqueness constraint on an airport
code is arguably the more correct constraint. It lost on `BACKWARD_COMPATIBILITY.md` §1, which is
additive-only and names "removing an index the previous Worker's query plans depend on" as breaking.
The migration runs before the new Worker is uploaded, so between those two moments the live Worker's
`findAirportByCode` would be planning against an index whose collation its comparison no longer
matches — a scan on every code resolution for the length of a deployment. The chosen design never
removes an index any live query plan depends on, which is what makes it deployable in one PR rather
than expand-and-contract across two.

**Leave `airports_name_idx` and `airports_city_idx` `BINARY` and add two more `NOCASE` indexes
beside them.** Strictly additive, but it leaves eight indexes on the table, two of them provably
dead, and the dead weight on every artefact load is half of what the issue is about.

## 📝 Architecture

No new module, no new boundary, no new contract. The concept — "the airport prefix read is served by
an index" — is owned by two files that must change together (docs/SPEC.md §8):

- `src/server/db/schema.ts` — the six index definitions and the comment above them.
- `drizzle/<generated>.sql` — generated by `pnpm db:generate`, never hand-edited
  (`BACKWARD_COMPATIBILITY.md` §1).

`src/server/catalog/airports.ts` changes only in its docstring, which currently asserts an index use
that does not exist. `src/server/fns/transports.ts` does not change: the server function's input,
output and Zod schema are untouched.

The `src/server/catalog` exception to the tenant-scoped repository rule (docs/SPEC.md §6) is neither
widened nor narrowed — `airports` still carries no `organization_id`, the read still takes a plain
`Database`, and `__tests__/isolation.test.ts` still walks the module graph unchanged.

## 📝 Data Model

`airports` keeps every column, type, nullability and `CHECK` it has. Only indexes change.

```ts
// src/server/db/schema.ts — the (t) => [...] block
uniqueIndex('airports_iata_unq').on(t.iataCode),
uniqueIndex('airports_icao_unq').on(t.icaoCode),
// The type-ahead matches a prefix of the code, the name or the city. SQLite can only turn
// `LIKE 'term%'` into an indexed range scan when the index collation matches the comparison,
// and with `case_sensitive_like` off that means NOCASE — which is why the prefix probes get
// their own indexes and do not ride the unique ones. The unique indexes stay BINARY: they
// serve `findAirportByCode`'s exact lookup, which compares with the column's own collation.
index('airports_iata_prefix_idx').on(sql`${t.iataCode} COLLATE NOCASE`),
index('airports_icao_prefix_idx').on(sql`${t.icaoCode} COLLATE NOCASE`),
index('airports_name_idx').on(sql`${t.name} COLLATE NOCASE`),
index('airports_city_idx').on(sql`${t.city} COLLATE NOCASE`),
```

The exact drizzle spelling for a collated index expression is an implementation detail for Step 1 to
settle against the installed drizzle-kit; what the generated SQL must contain is
`CREATE INDEX ... ON \`airports\` (\`col\` COLLATE NOCASE)`for those four, and no`DROP` of either
unique index.

**Migration shape.** Two `CREATE INDEX` statements for the new indexes, and a `DROP INDEX` +
`CREATE INDEX` pair for each recollated one. Dropping `airports_name_idx` and `airports_city_idx`
is safe under `BACKWARD_COMPATIBILITY.md` §1 precisely because of this spec's own measurement: the
live Worker's plan for the only query that could use them is `SCAN airports`, so no live plan
depends on them. That sentence belongs in the PR body, because a reviewer reading "DROP INDEX" on a
protected surface is right to stop.

**Storage.** Six indexes over 9,057 rows. The load is `scripts/seed/airports.mjs`, run out of band —
at checkout provisioning and between the migration and the Worker upload in both deploy workflows —
never on a request path.

## 📝 API Contracts

None change. `searchAirports(db, term, options)` and `findAirportByCode(db, code)` keep their
signatures, their return shapes and their documented behaviour, including the two contracts the
module treats as load-bearing: an unknown code resolves to `[]` / `null` and never to an error, and
the cap of `AIRPORT_MATCH_LIMIT` is a ceiling a caller cannot raise.

The server functions in `src/server/fns/transports.ts` are untouched, so
`BACKWARD_COMPATIBILITY.md` §2 does not apply.

## 📝 UI/UX

Nothing changes on screen. The type-ahead returns the same rows in the same order; it returns them
having read between 13 and 1,808 rows instead of 9,057.

### Visual change expected

**None.** This is a backend-only change: no route, component, state or style is touched, in either
theme or at any breakpoint. The endpoint picker renders exactly what it renders today.

### Copy

**None.** No user-facing string is added, changed or removed, so the 23-locale catalogue is not
touched and the i18n parity test is unaffected.

## 📝 Edge Cases & Failure Scenarios

- **A short prefix still reads a lot of rows.** Measured over the artefact: `a` matches 1,128 rows,
  `s` matches 1,808. `MULTI-INDEX OR` reads the matched rows and then sorts them into the cap, so a
  one-character term is a ~1,800-row read rather than a ~9,000-row one. That is a 5× improvement at
  the worst end and ~70× at the typical 3–4 character end, and it is the honest limit of this
  change. Bounding it further is deferred — see below.
- **Case folding is unchanged.** A `NOCASE` index folds ASCII and nothing else, which is exactly
  what `LIKE` already did. `lhr` still finds `LHR`; `ålesund` still does not find `Ålesund`. The
  roughly nine hundred artefact rows carrying a non-ASCII letter are no better and no worse off, and
  the docstring's existing caveat stays true and stays in place.
- **The escaped term still uses the index.** `startsWith` emits `LIKE ? ESCAPE '\'`, and an `ESCAPE`
  clause was the one thing that might have disqualified the optimization. Measured: it does not —
  the plan is identical with and without it. `%` and `_` typed by a traveller remain characters.
- **`NULL` codes are unaffected.** Most of the dataset carries no IATA code. The new prefix indexes
  are non-unique, so they impose nothing on those rows, and the unique indexes keep treating `NULL`s
  as distinct exactly as the schema comment describes.
- **Migration failure.** The migration only creates and drops indexes and holds no data. A failed
  run leaves the table and its rows intact; the rollback is to re-run the previous migration state,
  and the worst observable outcome is the scan the product already has today.
- **Artefact reload after the change.** `scripts/seed/airports.mjs` upserts and then sweeps, so it
  writes six index entries per row instead of four. It is out of band, so no request waits on it.

## 📝 Risks & Impact Review

| Risk                                                                     | Severity | Handling                                                                                                                                                       |
| ------------------------------------------------------------------------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Touching a protected surface (`BACKWARD_COMPATIBILITY.md` §1: D1 schema) | Medium   | Additive apart from two indexes proved unused by the query plan this spec measured. No column, table, type or constraint changes. Stated in the PR body.       |
| A future drizzle-kit regenerates the collated indexes differently        | Low      | `bash .ai/scripts/check-generated.sh` is in the gate and compares generated output.                                                                            |
| The query plan silently regresses later                                  | Medium   | Step 3 ships the `EXPLAIN QUERY PLAN` assertion, so a lost index is a red test rather than a slow month (docs/CATALOG.md, "How this is tested, not asserted"). |
| Deployment window between migration and Worker upload                    | Low      | No index a live plan depends on is removed, so the live Worker's behaviour is unchanged throughout.                                                            |

**Rollback.** One migration that only adds and recreates indexes. Reverting is a follow-up migration
that restores the `BINARY` definitions and drops the two new indexes; no data is at stake and no
read returns anything different in either direction.

**Blast radius.** Two files plus a generated migration and one test file. One server function reads
through the changed path and its contract is untouched.

## 📝 Resolved assumptions (autonomous defaults)

| #   | Question                                                                                          | Resolution                                                                                                                | Why                                                                                                                                                                                            |
| --- | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | Recollate all four existing indexes, or keep the unique ones `BINARY` and add two prefix indexes? | Keep the unique indexes `BINARY`; recollate `name`/`city`; add `airports_iata_prefix_idx` and `airports_icao_prefix_idx`. | The only option that never removes an index a live query plan depends on, and the only one that needs no change to `findAirportByCode`'s comparisons.                                          |
| Q2  | Does the read need the `UNION ALL` restructuring the issue proposes?                              | No. The SQL is unchanged.                                                                                                 | Measured: the unchanged query plans as `MULTI-INDEX OR` over all four indexes. The restructuring's stated premise is false, and its per-branch `LIMIT` would change which rows a tier returns. |
| Q3  | Should the read also bound rows-read for one- and two-character terms?                            | No — deferred, with the measurement recorded here.                                                                        | It needs either a minimum term length (a UX decision, not a performance one) or the per-branch `LIMIT` rejected in Q2. Out of this issue's scope.                                              |
| Q4  | Does the same fix extend to other prefix-search reads in the catalogue?                           | No. This spec owns `airports` only.                                                                                       | `catalog_places` already has its own driving-filter and plan-assertion design in docs/CATALOG.md. Bundling them would be two capabilities in one spec.                                         |
| Q5  | Should the non-ASCII folding gap be closed here?                                                  | No. Explicitly out of scope.                                                                                              | It needs a folded column written at build time — a different schema change with its own artefact rebuild, and the module already documents the gap.                                            |

None of these is marked `⚠ NEEDS HUMAN CONFIRMATION`: the chosen design is additive on the protected
surface, changes no contract, and returns byte-identical results.

## 📋 Phasing

**One phase.** The collation, the indexes, the comments that currently assert the wrong thing and
the test that holds the plan are one concept under docs/SPEC.md §8 — half of it landing would leave
the repository asserting something untrue about itself. There is no useful intermediate state.

## 📋 Implementation Plan

### Phase 1 — the prefix read is served by an index

**Step 1. Collate the indexes in `schema.ts` and generate the migration.**
Change the four index definitions as described in Data Model, add the two new ones, and run
`pnpm db:generate`. Never hand-edit the generated SQL.
_Verification:_ the new `drizzle/*.sql` contains `COLLATE NOCASE` on exactly the four prefix
indexes, contains no `DROP` of `airports_iata_unq` or `airports_icao_unq`, and
`bash .ai/scripts/check-generated.sh` passes.

**Step 2. Correct the two comments that assert index use.**
The `## Prefix, cap, and the two things they protect` paragraph in
`src/server/catalog/airports.ts` and the comment above the indexes in `schema.ts` both claim the
read is index-backed. Rewrite them to say what is now true and why collation is what makes it true.
_Verification:_ `pnpm lint` and `pnpm typecheck` pass; neither comment claims anything the Step 3
test does not assert.

**Step 3. Assert the query plan in `airports.test.ts`.**
Reuse the existing migration-replay fixture — it already replays `drizzle/*.sql` in journal order
and seeds rows. Add one case that runs `EXPLAIN QUERY PLAN` over the SQL `searchAirports` emits and
asserts the output contains `SEARCH airports USING INDEX` and not `SCAN airports`, with one term per
tier (exact IATA, exact ICAO, name prefix, city prefix). Add one case asserting `findAirportByCode`
still plans as `SEARCH airports USING INDEX airports_iata_unq`. Follow the shape already used in
`src/server/repos/__tests__/transports.test.ts:942`, and bind the parameters — an unbound `EXPLAIN`
reports the pessimistic plan and would pass for the wrong reason.
_Verification:_ `pnpm test` passes; reverting Step 1 turns exactly these new cases red.

**Step 4. Confirm the existing behavioural cases are untouched.**
The empty-result-on-unknown-code, cap, wildcard-escaping and ASCII-fold cases must pass unchanged —
the read's outward contract does not change, and a diff to any of them means this change did more
than it claims.
_Verification:_ `pnpm test` shows no edit to those cases in the diff.

**Step 5. Run the gate.**
`validation.commands` in `.ai/agentic.config.json`, in order.
_Verification:_ all seven commands green.

### Deferred, not scheduled

- Bounding rows-read for one- and two-character terms (Q3), which needs a product decision about a
  minimum term length before it is an engineering one.
- Closing the non-ASCII folding gap (Q5), which needs a folded column and an artefact rebuild.
