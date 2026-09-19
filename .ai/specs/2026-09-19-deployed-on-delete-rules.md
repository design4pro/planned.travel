# Document the ON DELETE rule D1 enforces, not the one schema.ts declares

| Field              | Value |
| ------------------ | ----- |
| **Status**         | draft |
| **Issue**          | #192  |
| **Spec PR**        | none  |
| **Implementation** | none  |

## 📝 TLDR

Four foreign keys in `src/server/db/schema.ts` declare `onDelete: 'set null'`, but D1 enforces
`NO ACTION` on all four. Each arrived by `ALTER TABLE … ADD COLUMN`, and drizzle-kit's `ADD COLUMN`
leaves out the `ON DELETE` clause. On production, deleting the parent row fails. It does not unlink
anything. The code already handles this: every deleter that exists today clears the pointer itself.
The documentation and two tests still claim the opposite. The doc comment on `reservations.expenseId`
says the engine unlinks the booking "with no code of ours running", and two schema-suite cases prove
that unlink on a harness built from `schema.ts`, a database nobody deploys.

This spec records the rule once, in an ADR. It rewrites the misleading doc comments to state the
deployed rule and name the code that keeps it, and it deletes the two tests that assert behaviour D1
does not have. Nothing changes at runtime. No migration, no schema change, no new copy. The audience
is engineers: the person reading `schema.ts` to learn the delete contract, and the next stage that
first deletes one of these parents.

## 📝 Problem Statement

- `reservations.expenseId` (`src/server/db/schema.ts:1333-1341`) says: "a deleted cost line then
  unlinks the booking with no code of ours running". `drizzle/0008_sharp_purple_man.sql:67` ships
  ``ALTER TABLE `reservations` ADD `expense_id` text REFERENCES expenses(id);``, with no `ON DELETE`,
  so SQLite applies `NO ACTION`. The issue names `0009_lumpy_black_tom.sql`, but that file was
  regenerated before merge. `0008_sharp_purple_man.sql` is the migration on `develop`. The code that
  actually keeps the rule is `deleteExpense()` (`src/server/repos/expenses.ts:490-503`), which calls
  `unlinkReservationsFromExpense()` (`src/server/repos/reservations.ts:416-441`) before it deletes.
- `reservation-schema.test.ts:139`, `'unlinks the booking rather than deleting it when the expense
goes'`, runs a raw `db.delete(expenses)` on the default harness. That harness builds its DDL from
  `schema.ts`, so the test passes only because it runs against a database that was never shipped.
  `accommodation-schema.test.ts:125`, `'keeps the nights when the booking that reserved them is
deleted'`, does the same for `day_accommodations.reservation_id`.
- The same debt is written up separately in four places, and it is wrong in two of them:
  - `transports.arrivalDayId` (`schema.ts:1139-1147`) and `expenses.costCategoryId`
    (`schema.ts:1473-1476`) say "SQLite's `ADD COLUMN` takes no `ON DELETE` clause". That is false.
    SQLite accepts `ADD COLUMN x text REFERENCES p(id) ON DELETE SET NULL`, and
    `pragma_foreign_key_list` then reports `SET NULL`. This run checked it with `sqlite3` 3.x, and
    `reservation-schema.test.ts:21-23` already says the same. The limit is in drizzle-kit, not in
    the engine.
  - `day_accommodations.reservationId` (`schema.ts:1095-1103`) does not mention the deployed rule
    at all.
  - Only the test register, `DEPLOYED_WITHOUT_ON_DELETE` in
    `src/server/db/__tests__/migrations-match-schema.test.ts:35-52`, states the rule completely, and
    a schema reader will not open that file.
- `docs/plans/03-reservations-and-transport.md:1485-1490` makes the same claim as the doc comment:
  "SQLite nulls the column as part of that delete … with no code in this plan running". `03-S4` has
  shipped, but the plan is still the backlog source other stages read.

**Who has the problem.** Engineers and agents who read `schema.ts` or the plan to learn what happens
when a parent row is deleted. Today they are told the database protects them. The first person to
write a new deleter for any of these four parents would get `FOREIGN KEY constraint failed`, a 500,
in production and nowhere in the default test suite.

## 📝 Proposed Solution

1. **One ADR records the rule.** `docs/adr/0024-a-foreign-key-added-by-add-column-is-enforced-as-no-action.md`:
   - **Context:** why the rule exists. drizzle-kit writes no `ON DELETE` on an `ADD COLUMN`, and
     `drizzle/` is generated and never hand-edited (`BACKWARD_COMPATIBILITY.md` §1).
   - **Decision:** what it demands of every deleter. Before a parent row goes, the repository that
     deletes it nulls every column in the register that points at it.
   - **Consequences:** where the register lives (`DEPLOYED_WITHOUT_ON_DELETE`), how a new entry is
     handled, and the testing rule. Any engine-level delete behaviour on these columns is asserted
     only on `createHarness({ ddl: 'migrations' })`.
2. **The doc comments state the deployed rule and point at the ADR.** Every register column's
   comment says `NO ACTION` on D1 and `set null` only on a schema-built database. Where an unlinker
   exists, the comment names it. Where none does (`expenses.costCategoryId`, whose deleter is
   `04-S2`), it names the stage that owes one. The false "SQLite's `ADD COLUMN` takes no
   `ON DELETE` clause" wording is corrected in both places.
3. **The tests assert only what D1 does.** The two harness cases that prove an engine unlink are
   deleted. The divergence itself is already pinned structurally by `migrations-match-schema.test.ts`,
   and the code-side unlink is covered on the migrated DDL by
   `src/server/fns/__tests__/reservations.test.ts:643-726` and
   `src/server/fns/__tests__/stays.test.ts:297-…` (`'deletes only the booking and keeps the nights,
unlinked'`). The two declaration cases whose names claim behaviour are renamed to claim what they
   actually check, which is the declaration.
4. **The plan paragraph gets a note, not a rewrite.** Under the bullet at
   `docs/plans/03-reservations-and-transport.md:1485`, one `> **As deployed:**` blockquote line says
   D1 enforces `NO ACTION`, `deleteExpense` unlinks, and gives the ADR number.

### Alternatives considered

- **Make D1 enforce `SET NULL`.** Rejected for this spec (see Resolved assumptions, A4). SQLite
  cannot alter a constraint in place, so this takes a table rebuild (`__new_` copy, drop, rename) of
  `reservations`, `transports`, `expenses` and `day_accommodations`. That is four large tenant tables
  and a D1 migration with real blast radius, done to replace code that already works and is tested.
  A hand-written `ADD COLUMN … ON DELETE` is not available either, because the columns already exist
  and `drizzle/` is generated.
- **Rebuild the two harness cases on `{ ddl: 'migrations' }` and assert the constraint failure.**
  Rejected. `migrations-match-schema.test.ts` already pins the deployed `NO ACTION` for all four
  columns in one place, and a per-table copy is exactly the duplication #184 removed.
- **A test that fails when a register column's doc comment omits `NO ACTION`.** Rejected as
  machinery for a comment. The ADR and the register's own comment are the enforcement, and review
  catches drift.

## 📝 Architecture

No runtime component changes. Owners, per docs/SPEC.md §8, one concept and one owner:

| Concept                                       | Owner                                                                                                                                                                      |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The rule and its reason                       | `docs/adr/0024-…` (new)                                                                                                                                                    |
| The register of columns deployed without it   | `DEPLOYED_WITHOUT_ON_DELETE`, `migrations-match-schema.test.ts` (exists)                                                                                                   |
| The per-column statement of the deployed rule | the column's doc comment in `src/server/db/schema.ts`                                                                                                                      |
| Keeping the rule at runtime                   | the parent's repository in `src/server/repos` (`unlinkReservationsFromExpense`, `unlinkTransportsFromDays`, `unlinkAccommodationsFromReservation`; `04-S2` for categories) |

The register's doc comment (`migrations-match-schema.test.ts:35-46`) gets one sentence pointing at
the ADR. Its current text is otherwise accurate and stays. The comments on the three unlinkers and
the two `{ ddl: 'migrations' }` describe blocks say the gap is "pinned by
`reservation-schema.test.ts`" / "`accommodation-schema.test.ts` pins both halves"
(`reservations.ts:422`, `itinerary.ts:679`, `reservations.test.ts:640`, `stays.test.ts:294`). Once
the engine cases are gone, those references point at the register in
`migrations-match-schema.test.ts` instead.

## 📝 Data Model

None. No column, index, constraint or migration changes. `pnpm db:generate` must produce no diff.

## 📝 API Contracts

None. No server function, input schema or response changes.

## 📝 UI/UX

None.

## 📝 Visual change expected

None. Backend documentation and tests only. No route or state changes on screen, in light or dark
mode, on desktop or mobile.

## 📝 Copy

None. No user-facing string is added, changed or removed.

## 📝 Edge Cases & Failure Scenarios

- **A fifth register entry lands later.** `migrations-match-schema.test.ts` goes red until the
  column is added to `DEPLOYED_WITHOUT_ON_DELETE`. The ADR tells the author what that entry commits
  them to: a code-side unlink, a doc comment in the ADR's shape, and a migrated-DDL test for the
  deleter.
- **An entry stops diverging** (a future rebuild or a drizzle-kit release that emits the clause). The
  register goes red and the entry is removed. Its doc comment then no longer applies, and the ADR says
  so in its Consequences section. The ADR is not superseded, because the rule still governs whatever
  entries remain.
- **Deleting the harness cases loses coverage.** It does not. Every behaviour they asserted is either
  false on D1 (the engine unlink) or already asserted on the migrated DDL (the unlink performed by
  code, and a stay outliving its booking). Step 3 checks this before deleting.

## 📝 Risks & Impact Review

- **Blast radius:** comments, one ADR, one plan note, and the deletion or renaming of four test cases.
  Nothing is deployed differently, and `BACKWARD_COMPATIBILITY.md` is untouched.
- **Risk:** a deleted case turns out to be the only coverage of something. This is mitigated by the
  explicit coverage check in step 3.
- **Rollback:** revert the PR.

## 📋 Phasing

One phase, one PR. Each step leaves the gate green.

### Phase 1 — record the rule once and stop asserting what D1 does not do

1. **ADR 0024.** Write `docs/adr/0024-a-foreign-key-added-by-add-column-is-enforced-as-no-action.md`
   in the house format (`Status: accepted`, `Date`, `Records: #192, #184, #186`). It covers:
   - Context: the generator's limit, the fact that SQLite would accept the clause, and the ban on
     editing `drizzle/`.
   - Decision: deleters null register columns before deleting.
   - Consequences: the register, the testing rule, the doc-comment shape, and adding or removing an
     entry.
     → verify: the ADR number is still free on `develop` when the step runs (renumber if not), and the
     links resolve.
2. **Doc comments.**
   - `schema.ts`: rewrite `reservations.expenseId` to state `NO ACTION` on D1, `set null` only on a
     schema-built database, `deleteExpense` → `unlinkReservationsFromExpense` as the keeper, and ADR 0024.
   - Add the same statement to `dayAccommodations.reservationId`, with
     `unlinkAccommodationsFromReservation` as the keeper.
   - Correct "SQLite's `ADD COLUMN` takes no/carries no `ON DELETE` clause" to "drizzle-kit's
     `ADD COLUMN` writes no `ON DELETE` clause" in `transports.arrivalDayId` and
     `expenses.costCategoryId`, and add the ADR pointer.
   - Add one ADR pointer sentence to the register's comment.
   - Repoint the four "pinned by `…-schema.test.ts`" references to the register.
   - Add the `> **As deployed:**` note to `docs/plans/03-reservations-and-transport.md` under
     line 1485.
     → verify: `pnpm typecheck`, `pnpm lint`; `grep -rn "no code of ours\|takes no .ON DELETE\|carries no .ON DELETE" src docs`
     returns nothing.
3. **Tests.**
   - Before deleting, confirm that `reservations.test.ts` `'deleting an expense a booking points at,
as deployed'` asserts the booking survives with `expenseId === null`, and that `stays.test.ts`
     `'on the migrated database'` → `'deletes only the booking and keeps the nights, unlinked'`
     asserts the stay survives with `reservationId === null`. If either does not, move that one
     assertion onto its migrated-DDL block first.
   - Then delete `reservation-schema.test.ts` `'unlinks the booking rather than deleting it when the
expense goes'` and `accommodation-schema.test.ts` `'keeps the nights when the booking that
reserved them is deleted'`.
   - Rename `'releases the booking when its ledger line is deleted'` to `'declares the ledger link
set null, which D1 does not enforce (ADR 0024)'`, and `'releases the stay when the booking is
deleted, and never takes it along'` to the equivalent.
   - Update item 3 of both file header docblocks: the divergence is pinned by the register, and the
     code-side unlink is tested on the migrated DDL.
   - Drop any import the deletions leave unused (`eq`, `expenses`, `trips`, and `seedTrip` if nothing
     else calls it).
     → verify: `pnpm test` green, and the two migrated-DDL describe blocks still run.
4. **Gate.** Run every command in `validation.commands` (`.ai/agentic.config.json`), in order. Also
   confirm that `pnpm db:generate` reports no changes.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                                                                                   | Applied default                                        | Why                                                                                                                                                                                                                       |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A1  | Delete the harness case at `reservation-schema.test.ts:139`, or rebuild it on `{ ddl: 'migrations' }` to assert the constraint failure?    | Delete it.                                             | The issue allows either. The deployed `NO ACTION` is already pinned for every table in `migrations-match-schema.test.ts` (#184), and the code-side unlink already runs on the migrated DDL in `reservations.test.ts:643`. |
| A2  | Does the same treatment extend to `accommodation-schema.test.ts:125` (`day_accommodations.reservation_id`), which the issue does not name? | Yes. The same deletion, after the same coverage check. | It is the same debt and the fourth register entry. An ADR that records the rule "once" while one suite still asserts the opposite would record it inaccurately.                                                           |
| A3  | Write the ADR now or wait for another occurrence?                                                                                          | Now.                                                   | The register already holds four entries, not the three the issue counted.                                                                                                                                                 |
| A4  | Make D1 actually enforce `SET NULL` (table rebuild migration)?                                                                             | No. Out of scope.                                      | It is the least reversible option, touches four large tenant tables, and replaces code that already works and is tested. A human can file it separately if wanted.                                                        |
| A5  | Correct the false "SQLite's `ADD COLUMN` takes no `ON DELETE` clause" in the two sibling comments?                                         | Yes.                                                   | The issue's own title asks that the docs not state what is untrue. The fix is comment-only.                                                                                                                               |
| A6  | Rewrite the `03` plan paragraph or annotate it?                                                                                            | Annotate it with one `As deployed` line.               | The plan is the backlog source and still read. A one-line note is the smallest reversible change, and it leaves the stage's reasoning as written.                                                                         |
| A7  | The issue carries `feature` although the work is documentation and tests.                                                                  | Left as is.                                            | Category relabels belong to a human. This run removed only its own trigger label, `spec`.                                                                                                                                 |
