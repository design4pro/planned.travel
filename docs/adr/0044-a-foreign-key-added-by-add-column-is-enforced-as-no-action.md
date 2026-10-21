# 0044. A foreign key added by `ADD COLUMN` is enforced as `NO ACTION`

Status: accepted
Date: 2026-10-21
Issue: #192 (spec `.ai/specs/implemented/2026-09-19-deployed-on-delete-rules.md`)
Records: #184, #186

## Context

`src/server/db/schema.ts` declares `onDelete: 'set null'` on four foreign keys, and D1
enforces `NO ACTION` on all four:

- `day_accommodations.reservation_id`
- `expenses.cost_category_id`
- `reservations.expense_id`
- `transports.arrival_day_id`

Each arrived by `ALTER TABLE … ADD COLUMN`, and the `ADD COLUMN` drizzle-kit writes carries the
`REFERENCES` clause with no `ON DELETE` one (`drizzle/0006_mighty_nehzno.sql`,
`drizzle/0008_sharp_purple_man.sql`). That is the generator's limit and not the engine's: SQLite
accepts `ADD COLUMN x text REFERENCES p(id) ON DELETE SET NULL`, and `pragma_foreign_key_list`
reports `SET NULL` afterwards. But `drizzle/` is generated and never hand-edited
(`BACKWARD_COMPATIBILITY.md`), and a table rebuild of four tenant tables to replace code that
already works is the least reversible way out, so the clause stays absent.

The consequence is that deleting a row one of these columns points at _fails_ with
`FOREIGN KEY constraint failed` on the deployed database instead of unlinking the pointer. The
test database does not show it: the repository harness builds its DDL from `schema.ts`, where
the `set null` is real. For a while the divergence was written down in seven places, wrongly in
five, and two schema-suite cases asserted an engine unlink that D1 never performs.

## Decision

The deployed rule is `NO ACTION`, and the code that deletes a parent keeps the rule the schema
promises.

1. **Every deleter nulls first.** Before a repository deletes a row a register column points at,
   it nulls that column for the matching rows of the same tenant, through the tenant-scoped base
   repository. Today that is `unlinkReservationsFromExpense` (called by `deleteExpense`),
   `unlinkAccommodationsFromReservation` (called by `deleteReservation`) and
   `unlinkTransportsFromDays` (called by the day deleters). `expenses.cost_category_id` has no
   deleter yet; the stage that first deletes a cost category (`04-S2`) must move or delete that
   category's expenses before it deletes the category, in the same batch.
2. **One register.** `DEPLOYED_WITHOUT_ON_DELETE` in
   `src/server/db/__tests__/migrations-match-schema.test.ts` lists the columns, as
   `table.column`. It is the one owner of the divergence.
3. **One doc-comment shape.** The column's doc comment in `schema.ts` states that D1 enforces
   `NO ACTION` and `set null` holds only on a schema-built database, names the function that keeps
   the rule (or the stage that owes it), and points at this ADR. It never says the engine
   unlinks, and never blames SQLite for the missing `ON DELETE` clause.
4. **One testing rule.** Engine-level delete behaviour on a register column is asserted only on
   `createHarness({ ddl: 'migrations' })`, where the constraint is the deployed one, and by the
   register. A case on the default harness proves nothing about D1 and does not assert an unlink.

## Consequences

- A column that is added by `ADD COLUMN` with a `set null` or `cascade` declaration turns
  `migrations-match-schema.test.ts` red until it is added to the register. Adding it commits the
  author to a code-side unlink, a doc comment in the shape above and a test for the deleter on the
  migrated DDL.
- An entry that stops diverging (a future table rebuild, or a drizzle-kit release that writes the
  clause) turns the same file red and is removed from the register. Its doc comment then no longer
  applies. This ADR is not superseded by that, because the rule still governs whatever entries
  remain.
- A new deleter for any of these parents that skips the unlink fails in production and nowhere in
  the default suite. The register and the doc comments are how a reader finds out before writing
  it.
- Nothing changes at runtime, and no migration is written.
