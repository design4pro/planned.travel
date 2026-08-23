# 00 — Foundations

Wave 0. This file owns the six files no feature stage may claim, the rituals that keep them
consistent, and the five stages that must land before wave 1 opens.

## Area brief

Foundations is not a product area and closes no row of the 89-row matrix in
`.claude/ultrabuild/recon/gap-rows.json`. It exists because two kinds of work belong to nobody and
therefore break everybody:

1. **Six shared files.** Every plan eventually needs a column, a binding, a token, a primitive or a
   route. Each of those lives in one file that the whole repository reads. Two stages editing one of
   them in the same wave corrupt each other's diff, and the corruption is silent — both agents pass
   `pnpm typecheck` against their own copy.
2. **Four write paths whose consumers already ship.** Measured in `repo-data.md` §7.2 and re-checked
   at HEAD: `notify()` in `src/server/repos/notifications.ts`, `recordAudit()` in
   `src/server/repos/audit.ts`, `recomputeTravelStats()` in `src/server/repos/atlas.ts` and
   `scheduleReminder()` in `src/server/queue/reminders.ts` have zero callers outside their own module
   and the dev seeder. Four finished screens — the notification centre and its bell, the audit table
   on `/admin`, the atlas statistics panel and the `*/15` reminder sweep — read data that nothing in
   production writes. Those are not screen gaps. They are missing write paths, and each one gates
   rows in a plan that does not own the repository the write belongs to.

To those this file adds the wave-0 schema stage, because a wave-1 stage that needs a column cannot
sit in the same wave as the migration that supplies it.

Every claim below that begins "measured" was read off the working tree at HEAD, not inferred from
recon prose. Where a measurement contradicts a row in `gap-rows.json`, the contradiction is stated
with its evidence, per the last rule of `README.md`.

The evidence format every **Verification** section below assumes is owned by
`12-verification-protocol.md`; the sections here name only the screens, viewports, themes and
interaction states that stage must photograph, never the procedure.

The clean-room rule of `README.md` binds every word here: the reference product is never named, its
pages are cited as `` `wiki: <Page-Name>` `` with no URL, and nothing is carried across from it.

## The six shared files

Each file has exactly one owner per wave, and that owner is a stage in this file. A feature stage
that needs a change to one of them writes the requirement under its own **Data and migration**,
**UI** or **Quota** heading and stops; the requirement is then minted as a stage here. A stage whose
**Owned paths** list contains one of these six is malformed and is rejected before it is scheduled.

| Shared file               | Owner                                      | The ritual, exactly                                                                                                                                                                                                                                                                                             |
| ------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/db/schema.ts` | one schema stage per wave                  | Collect every column and table the next wave asked for. Edit the schema module once. Run `pnpm db:generate`, read the SQL it wrote in `drizzle/`, then `pnpm db:migrate:local`. Additive only — see the migration ritual below.                                                                                 |
| `src/routeTree.gen.ts`    | nobody; it is generated                    | Never opened in an editor. A stage that adds or renames a route file runs `pnpm generate-routes` and lets the regenerated tree travel inside its own diff. It is never listed under **Owned paths**, and a hand edit fails the audit.                                                                           |
| `wrangler.jsonc`          | one bindings stage per wave                | Binding, migration-tag, trigger and limit changes are batched into that one stage. A new binding is also a cost-model change and is argued as one before it is written. Local ids stay placeholders; `docs/DEPLOY.md` owns the real ones.                                                                       |
| `src/styles/tokens.css`   | one token stage per wave                   | Collect every missing token from the wave's plans, add them in one edit, declare each in all three places `docs/DESIGN.md` requires: bare `:root`, `@media (prefers-color-scheme: dark)` guarded `:root:not([data-theme="light"])`, and `:root[data-theme="dark"]`. Dark shadows are re-declared, never reused. |
| `src/components/ui/**`    | one primitive stage per wave               | Only genuinely new primitives. Check `src/components/ui/index.ts` first: 42 primitive modules already ship, and a second implementation of one is a defect, not a merge conflict. Extend the existing file rather than adding a sibling.                                                                        |
| `src/server/worker.ts`    | the same bindings stage that owns wrangler | Any new Durable Object class, queue consumer or cron branch must be re-exported here. Measured: the module's own header records that a missing `TripRoom` export fails isolate startup outright, so `vite dev` serves no request at all.                                                                        |

Two operating rules make the table usable:

- **Disjointness is a within-wave rule.** Two stages in the same wave may not name the same file. A
  wave-0 stage owning a file that a wave-2 stage later edits is fine, because waves are sequential.
- **`src/components/ui` never fetches data and never imports from `server/`** (`SPEC.md` §6). A
  primitive that needs a server value takes it as a prop.

Measured inventory of the primitive surface, so no stage re-invents one: `alert`, `avatar`,
`avatar-stack`, `badge`, `button`, `calendar`, `card`, `checkbox`, `chip`, `combobox`,
`context-menu`, `date-picker`, `date-range-picker`, `dialog`, `dropdown-menu`, `empty-state`, `fab`,
`field`, `glass-panel`, `icon-button`, `input`, `kbd`, `pagination`, `popover`, `progress`,
`radio-group`, `scroll-area`, `section-label`, `select`, `separator`, `sheet`, `skeleton`, `slider`,
`sparkline`, `spinner`, `stat-card`, `switch`, `table`, `tabs`, `textarea`, `toast`, `tooltip`, plus
the shared variant helpers in `shared.ts`. Four of them are defined, tested and imported by no
screen — `Fab`, `DateRangePicker`, `MultiCombobox` and `CountBadge` — so a stage that needs one of
those consumes it rather than building it.

## The migration ritual

`ARCHITECTURE.md` §9 row 12 is the constraint the whole ritual serves: `wrangler rollback` must keep
the previous Worker working against the new schema. That means **every generated migration is
additive**.

- A column is added nullable, or with a default. No column is dropped, renamed or narrowed in the
  same stage that stops writing it — the drop is a separate migration, in a later wave, after the
  rollback window has passed.
- A table is added, never replaced. A new composite index leads with `organization_id`, which is the
  convention every existing index already follows.
- Adding a `CHECK` constraint to an existing SQLite table is **not** additive in practice: drizzle-kit
  emits a full table rebuild for it, as `drizzle/0001_aspiring_cargill.sql` shows. Prefer enforcing
  the same invariant in the repository's Zod input, and if a rebuild is genuinely required, say so
  in the stage and review every line of the generated SQL.

The sequence, in this order, is the whole procedure:

1. `pnpm db:generate` — drizzle-kit writes the next numbered file into `drizzle/` and appends an
   entry to `drizzle/meta/_journal.json`.
2. **Read the SQL it wrote.** Confirm it is `ALTER TABLE … ADD COLUMN` and not a `__new_*` rebuild,
   confirm no `DROP`, and confirm the journal entry is the only metadata change.
3. `pnpm db:migrate:local` — applies it to the local D1 through Miniflare. `pnpm db:migrate:remote`
   is a deploy step and belongs to `docs/DEPLOY.md`, never to a build stage.

**The two existing migrations are frozen.** `drizzle/0000_bored_moon_knight.sql` creates all 66
tables and `drizzle/0001_aspiring_cargill.sql` rebuilds `expenses`. Neither is edited, renamed or
regenerated for any reason: they have been applied, and drizzle-kit's snapshots in `drizzle/meta/`
are the only record of what they did. A mistake in them is repaired by a new migration, never by
rewriting history.

## The quota procedure

`ARCHITECTURE.md` §6 puts quota enforcement at the repository boundary and nowhere else, so a new
route or a new queue handler cannot skip it. A stage that creates a countable row follows all four
steps:

1. **Add the metric to `resolveLimits()`** in `src/server/billing/limits.ts`. That function is the
   only implementation of "what may this tenant do", and its authority order — lapsed status, then
   Stripe price id, then the plan catalogue, then the per-tenant ceilings on the subscription row —
   is not re-implemented anywhere else.
2. **If the metric is operational rather than sold, add it to `PLAN_QUOTAS`** in
   `src/server/db/types.ts`, alongside `places`, `files`, `exports`, `collections` and `journeys`.
   The three catalogue metrics (`members`, `trips`, `storage_bytes`) are deliberately absent from
   that table and must stay absent: a tier number for a metric the catalogue also sells is exactly
   how the billing screen and the repositories came to disagree.
3. **Call `assertQuota(scope, metric, currentUsage)` in the repository, before the write.** Measured
   call sites at HEAD, which are the pattern to copy: `trips.ts:315`, `places.ts:269`,
   `collections.ts:300`, `journey.ts:507`, `members.ts:160` and `:276`, and `files.ts:170`/`:171`.
   Usage is a live `COUNT(*)`, never a cached counter. For R2 the order is fixed and inverted:
   write the object, then assert, then delete the object if the assertion throws.
4. **Extend the equivalence test** in `src/server/billing/__tests__/limits.test.ts`. Its
   "the limits reported to the UI are the limits the repositories enforce" block is what catches a
   metric added to the catalogue and forgotten in the resolver. A stage that adds a metric adds its
   case there.

**Silence is not an answer.** A stage that creates no quota-bearing row says so explicitly under its
**Quota** heading and gives the reason — "notification rows are not sold and not metered; what has
to be bounded is fan-out, and the stage bounds it by chunking the recipient set rather than by
assuming a member ceiling" is an answer. An empty **Quota** heading is a rejected stage, because it
is indistinguishable from an author who never asked the question.

## The tenant procedure

`SPEC.md` §5: every domain row is scoped by `organization_id`, and **every** query goes through a
scoped repository that takes an explicit tenant context. There is no raw `db.select()` from a route,
from a server function, or from a component — not once, not for a read, not for a count.

Every new repository function obeys three rules:

- **It is built through `createScope()` and `tenantFilter()`** from `src/server/repos/base.ts`.
  `createScope()` is the only constructor of a `TenantScope`; it runs the context through a Zod
  schema and freezes `{ userId, organizationId, role }`. `tenantFilter()` always starts from
  `eq(table.organizationId, scope.ctx.organizationId)` and callers may only `AND` predicates onto
  it, which makes forgetting the tenant clause inexpressible rather than merely discouraged. For
  whole tables, `createTenantRepository()` and `createTenantTableAccess()` stamp `organization_id`
  on insert and omit it from the caller's payload type.
- **A well-formed id from the client is not an authorised id.** Validating shape with Zod is not
  authorisation. A server function is a public endpoint reachable without the route that renders its
  UI, and `beforeLoad` is UX, never a data boundary. A parent id arriving from the browser is
  re-resolved inside the caller's scope and rejected as `NotFoundError` when it does not belong to
  the tenant — never silently re-scoped onto the caller's own organization.
- **It gains a case in `src/server/repos/__tests__/tenant-isolation.test.ts`.** The case is the
  standing shape used by the existing blocks: in A's scope, ask to read, list, update and delete B's
  new rows by id, and ask to parent a new row onto one of B's rows. Every one is a `NotFoundError`,
  and B's rows are unchanged afterwards. A stage that adds a repository function and no isolation
  case is not done.

**The isolation suite is the one append-only exception to within-wave disjointness.** Almost every
stage in every plan adds a repository function, so almost every stage adds a case here, and forcing
them into different waves would serialise the whole build for the sake of one file. The rule instead
is mechanical: a stage appends its own `describe` block at the end of the file and edits nobody
else's block, so two stages landing in the same wave produce a merge that is resolved by keeping
both. Any stage that needs to _change_ an existing block, rather than add one, states that under its
**Owned paths** and takes the file exclusively for that wave.

**The exception is about disjointness, not about ownership.** The file is still named in the
**Owned paths** of every stage that adds a case, marked `append`, because an auditor diffs a stage's
actual changes against that list and a path outside it fails the audit even when the edit was
legitimate. `tenant-isolation.test.ts` is the only path in this directory that two stages of one wave
may both name; every other file, test files included, is named by exactly one stage per wave. A stage
whose **Verification** section says it edits a test file and whose **Owned paths** does not list that
file is malformed and is rejected before it is scheduled — the two sections are read together.

## Realtime and background work

Two placement rules, both from `ARCHITECTURE.md` §5 and §9, that a stage cannot negotiate:

**Collaborative patches.** A new patch type is declared in `src/server/do/protocol.ts` and nowhere
else. The declared entity kinds today are `trip`, `day`, `stop`, `route`, `reservation`, `expense`,
`packing-item`, `note` and `journal-entry`; a new kind is added to that union, gets its Zod shape in
the same module, and stays inside the existing envelope limits — measured at HEAD: 32 KiB per frame
(`TRIP_ROOM_MAX_MESSAGE_BYTES`), 40 messages per second per connection (`TRIP_ROOM_RATE_LIMIT`), 50
patches per message, 64 fields per patch, 2000 entities per snapshot. Conflict resolution is
last-write-wins per field, ordered by the room's monotonic version. The Durable Object is one per
trip and the trip id is the shard key, so nothing a stage adds may make the room global.

**Heavy work goes to the queue.** PDF rendering, imports, email and thumbnails are enqueued on
`TASKS` through `src/server/queue/jobs.ts`, with an idempotency-keyed envelope, and never run inline
in a server function. Envelopes carry a deterministic id so a redelivery is a no-op.

**A producer that can fan out chunks its own enqueue.** Measured: `enqueueTasks`
(`src/server/queue/jobs.ts:79-94`) carries the comment _"Sends up to 100 messages in one round trip —
the Queues batch limit"_ and then maps **every** input into a single `sendBatch` without chunking.
The limit the comment names is the platform's and is three limits at once: a `sendBatch` array holds
at most 100 messages, each message at most 128 KB, and the whole array at most 256 KB. The helper is
therefore safe only for a caller that already knows its input is short, and the comment reads as a
guarantee it does not make. Any stage whose producer scales with something — one message per
recipient, per member, per file — chunks before it calls, declares the chunk size as a named constant
next to the limit it was derived from, and holds the bound in a unit test rather than in a comment.
Both wave-0 producers do this: `00-S2` for its per-recipient email envelopes, `00-S5` for the sweep it
makes reachable for the first time.

Three measured facts about the background surface that a stage must not walk into blind:

- `TASK_KINDS` (`src/server/queue/types.ts:13-24`) declares eight job kinds and
  `runHandler` (`src/server/queue/consumer.ts:98-124`) has a `case` for every one of them, `thumbnail`
  included — but a `case` is not a handler. The `taskHandlers` registry at `consumer.ts:78` supplies
  three, and `src/server/queue/handlers/` holds exactly three modules: `email.ts`, `pdf-export.ts`
  and `booking-import.ts`. The other five kinds fall through their `case` to `unhandled()`, which
  raises a permanent error and dead-letters the message. So of the three kinds a later plan will
  reach for: **`pdf-export` and `booking-import` are complete handlers with no producer anywhere in
  `src/` and no UI entry point**, and **`thumbnail` has a routed `case`, no handler module and no
  producer** — a distinction worth 20 minutes to whoever assumes the third is like the first two. Wiring a producer to the two finished handlers is cheap movement for
  `06-documents-and-media.md` (DOC-06) and `03-reservations-and-transport.md` (BKG-03); writing a
  second exporter would be a defect.
- The Stripe webhook really does enqueue `billing.subscription.changed`, `billing.invoice.paid` and
  `billing.invoice.payment_failed`, and **none of the three has a handler, so every one of them
  dead-letters today**. That is a billing correctness problem, not a plan-set problem; it is recorded
  here so no stage assumes the billing follow-ups run.
- **The unchunked enqueue has exactly one caller in `src/` today, and it is the sweep**
  (`src/server/queue/reminders.ts:144`; every other producer uses the single-message `enqueueTask`).
  `sweepReminders` (`:119-154`) reads up to `limit` due reminders — the default is 200,
  and `src/server/worker.ts:58` calls it with the default — then hands all of them to `enqueueTasks`
  in one call. Past 100 due reminders in a single tick that batch exceeds the platform cap and the
  whole sweep throws, losing every reminder in the tick rather than the surplus. It has never fired,
  because `scheduleReminder` has no caller and the index is empty. `00-S5` is the stage that fills the
  index, so `00-S5` owns the fix and names the file: a defect becomes reachable in the wave that
  removes the condition hiding it.

## Bindings a later plan assumes and `wrangler.jsonc` does not declare

`wrangler.jsonc` declares seven bindings and all seven are read by non-test code: `DB`, `KV`,
`SESSIONS`, `FILES`, `TILES`, `TRIP_ROOM`, `TASKS`. The table below is every binding a later plan
might assume beyond those.

**Each row is a decision to report, not an action to take.** No stage in this file adds one. Adding
a binding changes the cost model and, for the first two, adds a per-request external dependency;
that argument belongs to a human, and the report is the deliverable.

| Assumed binding                           | Which plan would assume it                 | Measured state at HEAD                                                                                                                                                                                          | Disposition                                                                                                                      |
| ----------------------------------------- | ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `BROWSER` (Browser Rendering)             | `06-documents-and-media.md`, DOC-06        | Not declared. `src/server/queue/handlers/pdf-export.ts:193` already renders through the REST API when `BROWSER_RENDERING_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set, and writes print HTML to R2 otherwise. | **Report only.** The REST path works without a binding; a binding is a later optimisation, priced against browser-hours.         |
| `AI` (Workers AI)                         | `03-reservations-and-transport.md`, BKG-04 | Not declared, and BKG-04 is already out of scope in `11-boundaries-and-blockers.md`.                                                                                                                            | **Report only.** The deterministic `booking-import` handler already exists and is the sanctioned path.                           |
| A consumer for `planned-travel-tasks-dlq` | any plan that cares whether a job was lost | The dead-letter queue is named as `dead_letter_queue` on the consumer, but no consumer is declared for it, so dead-lettered messages accumulate unread.                                                         | **Report only.** Naming it is an operations decision with its own alerting; `ARCHITECTURE.md` §9 already alerts on DLQ depth.    |
| A fourth cron trigger for FX rates        | `04-budget-and-currencies.md`, MNY-07      | Three crons are declared; measured in `src/server/worker.ts`, only `*/15 * * * *` does work — `0 3 * * *` and `17 4 * * 1` hit a branch that logs `cron has no handler yet` and returns.                        | **Report only.** A rate refresh can ride the existing `*/15` sweep or a KV TTL; a fourth trigger is not required to ship MNY-07. |

Two related constraints that are not bindings but block the same plans, recorded here so they are
reported once rather than rediscovered per stage:

- **No FX rate source exists in the dependency set or in `src/`.** MNY-07 needs one, and the rate
  provider must permit use by a paid, subscription-funded product. That is a licence question with a
  cost, not a code question; it is reported, and `11-boundaries-and-blockers.md` carries the
  disposition.
- **The dependency freeze is absolute.** No stage in this file installs a package: the pinned set in
  `SPEC.md` §3 is complete, and neither `package.json` nor `pnpm-lock.yaml` is edited by anything in
  this directory. A genuinely missing package is recorded
  under a stage's **Blockers** heading with a disposition of defer, substitute, hand-roll or drop.

## The stage register

Wave 0's stages are minted below. The per-wave shared-file stages for waves 1 to 6 are minted here
when the wave opens, taking the next free `00-S<k>` id, and this table is where they are recorded —
so that at any moment there is exactly one answer to "who owns the schema module this wave".

| Wave | Schema stage               | Bindings + worker stage                                                                                                         | Token stage                                                      | Primitive stage                                                                          |
| ---- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 0    | `00-S1`                    | none required — no wave-1 plan has filed a binding requirement, and the table above says why none should be taken speculatively | none required — no wave-1 plan has filed a token requirement yet | none required — the 42 shipped primitive modules cover every wave-1 surface named so far |
| 1–6  | minted when the wave opens | minted when the wave opens                                                                                                      | minted when the wave opens                                       | minted when the wave opens                                                               |

A wave with no filed requirement mints no stage. An empty stage is worse than a missing one: it
invites an agent to invent work in the one file where invention is most expensive.

## How a stage block is delimited

Three separate audits of `TEMPLATE.md` found that it fixes the eleven headings but never says what
contains them, so consecutive stages read as a flat run of `###` with no boundary between them. The
container rule is fixed here, and every plan file in this directory follows it:

- **A stage block opens with `## Stage <stage-id> — <title>`.** That heading is the delimiter; the
  stage runs until the next `##`.
- **The eleven headings inside a stage block stay at `###`,** in the order `TEMPLATE.md` fixes:
  Stage id, Reference rows, Owned paths, Data and migration, Server (repo, server function, Zod), UI
  (route, components), Quota, Tenant isolation test, Verification, Definition of done, Blockers.
- **No `###` appears outside a stage block.** Every `###` in a plan file is therefore one of the
  eleven, which makes the rule checkable by eye and by `grep`. Prose sections use `##` and lean on
  tables and lists for their internal structure.

## Stage 00-S1 — Wave-0 schema stage: the expense currency precondition and migration 0002

### Stage id

`00-S1` · Wave 0 · effort **M**. The wave-0 instance of the schema stage: it owns
`src/server/db/schema.ts` and `drizzle/` for the whole of wave 0, and it is the last wave-0 stage to
close, because it collects every column wave 1 asked for into one `pnpm db:generate` run.

### Reference rows

Closes none. Wave 0 carries no gap row; each row stays with the plan that owns its surface.

This stage is the currency precondition, and it unblocks six rows in three plans:

- `MNY-06` (`04-budget-and-currencies.md`, wave 2) — trip currency as the accounting base, and the
  re-basing that must re-anchor frozen rates. Direct dependant of MNY-07.
- `TRP-05` (`01-trips-core.md`, wave 2) — the dashboard currency converter. Direct dependant.
- `COL-10` (`07-collaboration-and-sharing.md`, wave 2) — the public guest viewer, whose amounts
  resolve sharer-currency-then-trip-currency. Direct dependant.
- `ACC-04` (`09-account-and-settings.md`, wave 3) — the per-user display currency in regional
  settings. Direct dependant.
- `MNY-02` (wave 2) and `MNY-03` (wave 3) — the expense ledger and the settle-up surface. Neither
  names MNY-07 in its `dependsOn`; they are blocked through the data, not the edge set. Both render
  a source amount beside a base amount, and MNY-03 records settlement payments "under the same
  rule", which is impossible while a settlement row cannot hold a source currency at all.

**Contradiction with the matrix, stated with evidence.** `MNY-07`'s recorded evidence, and
`scripts/seed/README.md` lines 252–267, both say `expenses.originalCurrency` and `expenses.currency`
collide on one SQL column and discard the source currency on write. **Measured at HEAD, that
collision is already repaired.** `src/server/db/schema.ts:85` defines the helper as
`const currency = (name = 'currency') => text(name, { length: 3 })`, line 794 reads
`originalCurrency: currency('original_currency')`, and `drizzle/0001_aspiring_cargill.sql:14` creates
`original_currency text(3)` on the rebuilt table. `expenses` therefore already holds
`original_amount_minor`, `original_currency` and `exchange_rate`. The precondition survives, because
the same three-column shape is **missing from `settlements`**, which carries only `currency` — and a
settlement paid in a foreign currency is exactly the case MNY-03 must record. The seed README is
stale prose and is corrected by this stage.

### Owned paths

- `src/server/db/schema.ts` — edit. The shared schema module, held by this stage for all of wave 0.
- `drizzle/` — new files only: the generated migration and its snapshot, plus the journal entry.
  `0000_bored_moon_knight.sql` and `0001_aspiring_cargill.sql` are not touched.
- `src/server/repos/expenses.ts` — edit. The Zod input for the settlement writer gains the three
  optional source fields and the non-negative guard the schema deliberately does not add.
- `scripts/seed/README.md` — edit. Replaces the stale collision note with the measurement above.
- `src/server/repos/__tests__/repositories.test.ts` — edit. The expenses repository's cases live in
  this file's `describe('money')` block (measured: the block is one `it` at line 252, and the module
  is imported at line 47); the two cases named under **Verification** are appended there as a second
  `it` inside that block. No other wave-0 stage names this file, so it is held exclusively for the
  wave and the append-only exception below does not apply to it.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. One new `describe` block for the
  case named below, under the append-only exception in the tenant procedure above.

### Data and migration

One migration, `0002`, additive, generated not hand-written.

Adds to `settlements`, all nullable, no default, no new CHECK:

| Column                  | Type      | Why nullable                                                         |
| ----------------------- | --------- | -------------------------------------------------------------------- |
| `original_amount_minor` | `integer` | Absent on every settlement paid in the trip currency, which is most. |
| `original_currency`     | `text(3)` | ISO-4217, same `currency('original_currency')` helper as `expenses`. |
| `exchange_rate`         | `real`    | The rate frozen at save time; null means no conversion happened.     |

No CHECK constraint is added, deliberately: drizzle-kit emits a full table rebuild for a constraint
change on SQLite, as `0001` shows, and a rebuild is a poor trade for an invariant the repository's
Zod input can hold. The non-negative guard on `original_amount_minor` therefore lives in
`src/server/repos/expenses.ts`, matching the `expenses_original_amount_chk` semantics without the
rebuild.

Backfills nothing. Existing settlement rows are, by construction, denominated in the trip currency
and the three new columns stay null for them.

No new index: every query against `settlements` already leads with `organization_id` through
`settlements_org_trip_idx`, and none of the three new columns is a filter.

Money stays integer minor units plus a `text(3)` currency. No float amounts, no second convention.

Before this stage closes, it also absorbs any **Data and migration** requirement filed by a wave-1
stage in plans 01–11, so that wave 1 opens against one migration rather than eleven.

### Server (repo, server function, Zod)

- **Repository.** `src/server/repos/expenses.ts`. The settlement writer's input gains
  `originalAmountMinor`, `originalCurrency` and `exchangeRate`, all optional; when any is present all
  three must be, and `originalAmountMinor` must be a non-negative integer. Built on the existing
  tenant-scoped access in that module; SQL stays here.
- **Server function.** None. This stage exposes no new endpoint — the surfaces that will write these
  columns belong to MNY-03 and MNY-06.
- **Zod.** v4 idiom, `z.strictObject()` with the `error` parameter, a refinement asserting the
  all-three-or-none rule, and `z.iso.date()` untouched on `settledOn`. No `z.string().email()`; the
  v4 top-level format functions are the house style for anything new.
- **Authorisation.** Unchanged and unaffected: the settlement writer already resolves its trip inside
  the caller's scope, and a foreign trip id is a `NotFoundError` rather than a re-scoped write.
- Nothing slow, nothing enqueued, no realtime patch: a settlement already mirrors to the trip room
  under the existing `expense` entity kind, and no new kind is needed.

### UI (route, components)

None. This stage ships no route, no component and no visible change; the columns it adds are written
by MNY-03 and read by MNY-02 and COL-10 in later waves. `pnpm generate-routes` is not run because no
route file changes.

No token is required, so no token stage is minted for wave 0 on this stage's account.

### Quota

Creates no countable row. It adds three columns to a table whose rows are already created by an
existing write path, and that path consumes no metric — settlements are not sold, not metered, and
bounded by the trip's own expense volume, which is metered upstream. No entry is added to
`resolveLimits()` and none to `PLAN_QUOTAS`, and therefore no case is added to
`src/server/billing/__tests__/limits.test.ts`.

### Tenant isolation test

The settlement writer already has coverage; this stage extends it rather than adding a block. In A's
scope, record a settlement carrying the three new source fields onto B's trip — `NotFoundError`, and
B's settlement rows are byte-identical afterwards. Then read A's own new row back in B's scope by id
— `NotFoundError`. Functions covered: the settlement writer and reader in
`src/server/repos/expenses.ts`, exercised through the same `createScope()` fixtures the file already
builds.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Migration review is part of the gate and is not optional: read `drizzle/0002_*.sql` and confirm it
  is three `ALTER TABLE settlements ADD COLUMN` statements, that no `__new_settlements` rebuild
  appears, that no `DROP` appears, and that `drizzle/meta/_journal.json` gained exactly one entry.
  Then `pnpm db:migrate:local` and confirm it applies against a database that already carries `0000`
  and `0001`.
- Unit tests, in `src/server/repos/__tests__/repositories.test.ts` inside its existing
  `describe('money')` block, against the same `createHarness`/`subscribeTenant` fixtures the block
  already uses: one case holding the all-three-or-none rule — a settlement carrying two of the three
  source fields is rejected, one carrying all three round-trips with the rate intact — and one
  holding that a settlement with none of them round-trips unchanged, so the columns are provably
  optional and `getMemberBalances` still clears to zero.
- Browser evidence: none, and the reason is that nothing renders differently. The costs screen is
  re-checked at 360px and 1440px in both themes only to prove the migration changed no existing
  surface — a regression check, not evidence of a feature.
- Console must be silent.

### Definition of done

The six repository-wide items from `docs/SPEC.md` §7 apply unchanged: `pnpm build` succeeds; `pnpm
lint` and `pnpm typecheck` are clean with no suppressions; new logic has tests and `pnpm test`
passes; the change is verified in a real browser in light and dark, desktop and mobile; nothing is
left behind — no TODO, no placeholder copy, no `console.log`, no commented-out code; and no file
outside **Owned paths** is touched.

The `SPEC.md` §2 visual clauses are ticked per surface the stage ships. This stage ships no surface,
so each is ticked against the regression check described above rather than against new UI:

- [ ] Spacing on the 4px grid from `--space-*` — unchanged, verified by the regression check.
- [ ] Hover, focus-visible, active, disabled and loading on every interactive element — unchanged.
- [ ] Every list has a designed empty, skeleton and error state — unchanged.
- [ ] Motion 150–260ms on `--ease-out-quint` or a sibling, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured — unchanged.
- [ ] Light and dark parity with dark shadows re-declared — unchanged.
- [ ] 360px to 2560px, small designed rather than squeezed — unchanged.
- [ ] Keyboard reachable end to end, sensible focus order, accessible names, WCAG 2.2 AA in both
      themes — unchanged.
- [ ] Zero console errors or warnings, zero layout shift after paint.

### Blockers

None for this stage. The FX rate source MNY-07 also needs is **not** a blocker here: this stage adds
the columns a rate is frozen into, which is independent of where the rate comes from. The rate
source is reported as a decision in the bindings section above and dispositioned in
`11-boundaries-and-blockers.md`.

## Stage 00-S2 — In-app notification dispatch

### Stage id

`00-S2` · Wave 0 · effort **M**. The first of the four write paths whose consumers already ship.

### Reference rows

Closes none. It supplies the write half of `ACC-05` (`09-account-and-settings.md`, wave 2), which
keeps the row: the event-by-channel preference matrix, the four channel columns and the inline
accept/decline of an actionable notification are that row's work and are not done here.

What this stage does is make the notification centre and its unread badge show rows that a real
action produced. Measured: `notify()` and `notifyMany()` in `src/server/repos/notifications.ts` have
no caller in `src/` outside the dev seeder, so every row on `/notifications` today was seeded.

Rows unblocked, by id. Direct dependants of ACC-05: `TRP-04`, `LST-01`, `ADD-04`, `ADM-02`.
Transitively, sixteen rows reach ACC-05 and inherit the unblock: `TRP-02`, `TRP-04`, `TRP-06`,
`TRP-11`, `LST-01`, `LST-02`, `LST-03`, `LST-04`, `LST-05`, `ADD-04`, `ADM-01`, `ADM-02`, `ADM-03`,
`BKG-05`, `COL-11`, `DOC-08`. That count is why this is a wave-0 stage and not a line item inside
`09-account-and-settings.md`.

### Owned paths

- `src/server/notifications/dispatch.ts` — new. The composition layer: recipients, preference
  filtering, in-app write, email hand-off. Contains no SQL.
- `src/server/notifications/__tests__/dispatch.test.ts` — new.
- `src/server/fns/collab.ts` — edit. First production caller: a posted trip message notifies the
  other trip members.
- `src/server/fns/costs.ts` — edit. Second production caller: an expense that splits onto other
  members notifies them.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. The three cases under **Tenant
  isolation test** below, as one new `describe` block, under the append-only exception in the tenant
  procedure above.

Two callers, not one, deliberately: a single call site is indistinguishable from a fixture, and both
of these write paths already ship end to end, so neither waits on a feature row.

### Data and migration

None. `notifications` and `notification_preferences` already exist in `src/server/db/schema.ts` with
every column this needs, and the enums are already CHECK-constrained: types `info | action |
navigate`, scopes `trip | organization | user | system`, channels `in_app | email | push | webhook`.
No column, no index, no migration.

### Server (repo, server function, Zod)

- **Repository.** No new SQL. The stage composes functions that already exist in
  `src/server/repos/notifications.ts` — `notify`, `notifyMany`, `filterEnabledRecipients`,
  `isChannelEnabled` — and reads membership through `listTripMembers` in `src/server/repos/trips.ts`
  and `listUserProfiles` in `src/server/repos/members.ts`.
- **The dispatch function.** `dispatch(scope, event)` in the new module: resolves the recipient set
  from the trip's membership under the caller's scope, removes the actor, de-duplicates it, filters
  it per channel through `filterEnabledRecipients`, writes the in-app rows with `notifyMany`, and for
  recipients whose email channel is enabled enqueues `email` tasks through `enqueueTasks`
  (`src/server/queue/jobs.ts`). Both halves are chunked; the sizes and the reason are under **Quota**
  below, because bounding the fan-out is what this stage does instead of metering it.
- **One email envelope per recipient, not one envelope carrying the recipient list.** The payload
  schema would allow the second — `emailPayloadSchema.to` is `z.array(...).min(1).max(50)`
  (`src/server/queue/types.ts:31`) — and it is the wrong shape twice over. Measured: `handleEmail`
  (`src/server/queue/handlers/email.ts:40`) posts `to: payload.to` as a single provider message, so
  fifty travellers would each read the other forty-nine addresses; and its provider idempotency key
  (`:33`) is built from `payload.to.join(',')`, so adding one recipient changes the key and re-sends
  to everybody already served. One envelope per recipient costs more messages and is the only shape
  that is both private and idempotent per person. Its deterministic id is
  `notify:<eventKind>:<entityId>:<recipientUserId>`, so a redelivery sends one message to one person.
- **Channels with no transport.** `push` and `webhook` have no provider and no binding. Dispatch
  writes the in-app row, emits one structured log line naming the channel it could not serve, and
  returns. It never throws for a missing transport, and it never silently drops the in-app row.
- **Failure isolation.** A dispatch failure must never turn a successful save into a failed one. The
  call sites wrap it exactly as `mirrorToRoom` is wrapped in `src/server/fns/context.ts`: the error
  is logged with `serializeError` and the write still returns.
- **Zod.** A `z.strictObject()` event schema with `kind`, `tripId`, an entity reference, the
  translation keys and their params, using the `error` parameter for messages. It validates the
  caller, not the client: no recipient list ever arrives from the browser, so there is nothing to
  trust. `notify()` re-validates the row shape on the way in, and that redundancy is kept.
- **Authorisation, and the one call the obvious reading omits.** Decided in the repository, in the
  caller's scope. Measured: `listTripMembers` (`src/server/repos/trips.ts:403-411`) is
  `tripMembersRepository.findMany` under `tenantFilter`, so a `tripId` belonging to another tenant
  returns `[]`. It does **not** raise. Fanning out over that empty list would succeed silently and
  be indistinguishable on screen from a trip whose only member is the actor, which is precisely the
  failure this stage exists to prevent. So `dispatch` resolves the trip first, through
  `requireTrip(scope, tripId)` — `src/server/repos/trips.ts:152`, which is
  `tripsRepository.requireById` and is documented at `:148-151` as rejecting an id belonging to
  another organization with `NotFoundError` — and only then reads the membership. Recipients are
  always derived server-side from that membership; no recipient list ever arrives from the browser.
- Nothing slow runs inline: the only external call is the email provider, and it happens in the
  queue handler.

### UI (route, components)

None, and that is the point of the stage: `src/routes/_app/notifications.tsx` and the bell in the app
shell already run `loadNotifications`, `countUnread`, `readNotification` and `readAllNotifications`
against D1. They currently render seeded rows and will render real ones with no code change.

No new route file, so `pnpm generate-routes` is not run. No new token, no new primitive.

### Quota

**Creates no quota-bearing row, explicitly.** Notification rows are not sold by the plan catalogue
and are not an operational metric in `PLAN_QUOTAS`; adding one would meter a side effect of work the
tenant already paid for elsewhere. Nothing is added to `resolveLimits()`, nothing to `PLAN_QUOTAS`,
and therefore no case to `src/server/billing/__tests__/limits.test.ts`.

Fan-out still has to be bounded, and the bound is this stage's own work rather than a limit it may
lean on. Measured: `notifyMany` (`src/server/repos/notifications.ts:140`) evaluates
`z.array(idSchema).max(500).parse(...)` over the raw recipient array **before** it de-duplicates.
That is a rejecting validator, not a cap — a 501st recipient throws a `ZodError` and writes no row
at all, so on a large workspace it would turn a successful trip message into a failed one. Nor is
there one member number to size against. Three exist and they disagree: `membershipLimit: 100` in
the Better Auth organization plugin (`src/server/auth/index.ts:237`), which is the only one enforced
at the point a membership is written; the fallback `SEAT_LIMIT_CEILING = 100_000`
(`src/server/billing/limits.ts:82`), which applies when a plan sells no seat limit; and the largest
published plan's `seats: 10` (`src/lib/plans.ts:335`). A dispatch sized against any one of them is
sized against a number the other two contradict.

So `dispatch` bounds itself and depends on none of the three. It de-duplicates the resolved recipient
set and then chunks **both** of its writes, each against the limit that half actually has, with both
sizes declared as named constants in the dispatch module beside the line they were derived from:

- **In-app rows: 500 per `notifyMany` call**, mirroring the `z.array(idSchema).max(500)` validator at
  `src/server/repos/notifications.ts:140`. Chunking turns that rejecting validator into a cap without
  editing it.
- **Email envelopes: 25 per `enqueueTasks` call.** The count is derived, not chosen. A `sendBatch`
  array holds at most 100 messages and at most 256 KB in total; `dispatch` caps the notification body
  it renders at 8 KiB, which with the envelope's own fields is under 9 KiB per message, and
  `256 KB ÷ 9 KiB ≈ 28`, so 25 clears the byte cap with margin and clears the 100-message cap four
  times over. The byte limit binds first here, which is why sizing against the message count alone —
  the number the helper's own comment names — would have been sized against the wrong limit.

No recipient is dropped, no member ceiling is assumed, and both bounds are unit tests rather than
comments: an event with 501 distinct recipients writes 501 in-app rows across two `notifyMany` calls
and enqueues 501 envelopes across 21 `enqueueTasks` calls, no call exceeds its constant, no
serialised batch exceeds 256 KB, and nothing throws.

### Tenant isolation test

Added to `src/server/repos/__tests__/tenant-isolation.test.ts`. Three cases, and the middle one is
written against what the repository actually does rather than against what it ought to do:

- In A's scope, dispatch an event for one of B's trips — `NotFoundError`, raised by the
  `requireTrip` call named under **Server**, not by `listTripMembers`, and B's `notifications` table
  is unchanged.
- `dispatch` takes no recipient list, so "dispatch to one of B's users" is not an expressible input;
  the case is made one level down, against `notifyMany` directly. Measured:
  `notifications.recipient_user_id` is a `userRef()` text column with no foreign key
  (`src/server/db/schema.ts:1727` — the convention every domain table follows so the domain schema
  never imports the auth schema), and `filterEnabledRecipients`
  (`src/server/repos/notifications.ts:299-318`) is **opt-out** — it removes only users with an
  explicit `is_enabled = false` row. A foreign user id handed to `notifyMany` is therefore written,
  under A's organization, not dropped. The test asserts exactly that, and the assertion is the reason
  the layer above must derive recipients from `listTripMembers` and never from a request body. It
  also asserts the half that is isolated: an opt-out B recorded in B's organization is invisible from
  A's scope and does not suppress A's row.
- Read the rows A's own dispatch produced from B's scope: `notificationsRepository.requireById` —
  `NotFoundError`, and `listNotifications` in B returns none of them.

Functions covered: `dispatch`, and through it `notifyMany`, `filterEnabledRecipients`, `requireTrip`
and `listTripMembers`.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Unit tests in `src/server/notifications/__tests__/dispatch.test.ts`, each holding one invariant:
  the actor never notifies themselves; a recipient with an explicit `in_app` opt-out row receives no
  row; **a recipient with no preference row at all does receive one**, because absence means enabled
  — `isChannelEnabled` returns `row?.isEnabled ?? true` (`src/server/repos/notifications.ts:277-296`)
  so travellers opt out and never in, and a test written the other way round would encode the
  opposite product; a recipient whose `email` preference is on produces exactly one enqueued envelope
  with the deterministic id addressed to that recipient alone; a queue that rejects does not propagate
  the rejection to the caller; a channel with no transport logs once and writes the in-app row anyway.
- The fan-out bound, in the same file, as one test per half against a stubbed repository and a
  stubbed queue: 501 distinct recipients produce two `notifyMany` calls of at most 500 ids and 21
  `enqueueTasks` calls of at most 25 envelopes; every recipient appears in exactly one in-app chunk
  and exactly one envelope; and the serialised body of each enqueue call measures under 256 KB. That
  last assertion is the one that fails against an unchunked producer, which is why it measures bytes
  rather than counting messages.
- Browser evidence: `/notifications` and the shell bell, at 360px and 1440px, in light and dark,
  photographed **after** a second member posts a trip message — the state that is the point of the
  stage is the unread badge incrementing and the new row appearing at the head of the list, not the
  resting screen. The empty state must still be reachable by clearing the list.
- Console must be silent, including during the fan-out.

### Definition of done

The six items from `docs/SPEC.md` §7 apply unchanged, as listed in `00-S1`.

The `SPEC.md` §2 clauses are ticked against the notification centre and the bell, which this stage
puts into real use for the first time:

- [ ] Spacing on the 4px grid from `--space-*`.
- [ ] Hover, focus-visible, active, disabled and loading on every interactive element, including the
      mark-read control on a row that is mid-request.
- [ ] Designed empty state, skeleton and error state on the notification list.
- [ ] Motion 150–260ms on `--ease-out-quint` or a sibling, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured, including the badge count change.
- [ ] Light and dark parity with dark shadows re-declared.
- [ ] 360px to 2560px, small designed rather than squeezed.
- [ ] Keyboard reachable end to end, accessible name on the bell that states the unread count, WCAG
      2.2 AA in both themes.
- [ ] Zero console errors or warnings, zero layout shift after paint — the badge uses tabular
      numerals so its width does not jump.

### Blockers

- **`push` and `webhook` channels have no transport.** No provider is in the pinned dependency set
  and no binding exists. Disposition: **defer**. The preference matrix in `ACC-05` may render them,
  but dispatch does not pretend to serve them, and the row moves its unserved half to
  `11-boundaries-and-blockers.md`.
- **Email delivery needs `EMAIL_API_KEY`.** The handler is written and the secret is documented in
  `.dev.vars.example`; without it the handler declines loudly rather than silently. Not a blocker for
  the in-app path, which is what the four consumers read.

## Stage 00-S3 — Audit recording

### Stage id

`00-S3` · Wave 0 · effort **S**. The second unwritten write path.

### Reference rows

Closes none. It supplies the write half of `ADM-04` (`10-administration.md`, wave 1) — the
chronological audit table with actor, action key, resource, IP and JSON detail — which keeps the row
and owns the reading surface, the paging and the filters.

Measured: `recordAudit` and `recordAuditMany` in `src/server/repos/audit.ts` have no caller outside
`src/server/repos/__tests__/`, so every `audit_log` row today comes from the dev seeder — and it does
not even use them, inserting through `auditLogRepository.insert` directly at
`src/routes/api/dev/-seed/apply.ts:672`. `loadAdmin` in `src/routes/_app/-server/overview.ts` renders
`listAuditLog` and `countAuditActions` on `/admin` against a trail no production write path appends
to.

Rows unblocked: `ADM-04` directly. `ADM-01` (the admin console shell, wave 4) and `ADM-03` (the
permission matrix, wave 5) both read the same table and inherit a trail with real rows in it; neither
names ADM-04 in its `dependsOn`, so they are named as beneficiaries and not as dependants.

### Owned paths

- `src/server/audit/trail.ts` — new. A non-throwing wrapper around `recordAudit` that also captures
  the request's IP and user agent.
- `src/server/audit/__tests__/trail.test.ts` — new.
- `src/server/fns/files.ts` — edit. Audits file upload and file deletion.
- `src/server/fns/reservations.ts` — edit. Audits reservation create, update and delete.
- `src/routes/_app/-server/settings.ts` — edit. Audits a change to the workspace defaults.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. The case under **Tenant isolation
  test** below, as one new `describe` block, under the append-only exception in the tenant procedure
  above.

Three call-site files, chosen because all three write paths already ship end to end and none is owned
by another wave-0 stage.

### Data and migration

None. `audit_log` exists with `actor_user_id`, `action`, `entity_type`, `entity_id`, `metadata`, `ip`
and `user_agent`, and its repository already validates the action key against
`/^[a-z0-9]+(?:[._][a-z0-9]+)*$/`. No column, no index, no migration.

### Server (repo, server function, Zod)

- **Repository.** No new SQL. `recordAudit` and `recordAuditMany` already exist and already stamp
  `actorUserId` from the scope, which is the reason a caller cannot attribute an action to somebody
  else.
- **The trail helper.** `trail(scope, input)`: resolves `ip` from `cf-connecting-ip` and `userAgent`
  from `user-agent` via `getRequest()` from `@tanstack/react-start/server` — the idiom this repo
  already uses in `src/server/auth/session.ts:48` — then calls `recordAudit`. Measured constraint,
  from the comment block in `src/server/clock.ts`: `getRequest()` **throws** when no request is in
  scope, which is the case in unit tests and in a queue handler. `trail()` therefore treats a missing
  request as "no IP, no user agent" rather than as an error.
- **Never fails the action it records.** An audit write is observability, not the transaction. Any
  throw from `recordAudit` is caught, logged once with `serializeError`, and swallowed; the user's
  save still succeeds. This is the same contract `mirrorToRoom` holds in `src/server/fns/context.ts`.
- **Action keys.** Dotted, lowercase, entity-first: `file.uploaded`, `file.deleted`,
  `reservation.created`, `reservation.updated`, `reservation.deleted`, `workspace.defaults_changed`.
  The regex in `recordAuditInput` already rejects anything else at the boundary.
- **Zod.** `recordAuditInput` already validates the shape; `trail()` adds no second schema and does
  not widen it. The metadata record stays a flat `Record<string, string | number | boolean | null>`,
  so an audit entry can never smuggle a nested payload into a JSON column.
- **Authorisation.** The actor is the scope, never the client. Nothing about who acted is taken from
  the request body.

### UI (route, components)

None. `/admin` already renders the audit table, gated on `shell.session.user.isAdmin`, and will
render real entries with no code change. No new route file, so `pnpm generate-routes` is not run. No
new token, no new primitive.

### Quota

**Creates no quota-bearing row, explicitly.** Audit entries are a compliance record, not a sold
resource; metering them would give a tenant an incentive to act in ways that produce fewer of them,
which is precisely backwards. Growth is bounded instead by `pruneAuditLog(scope, before)`, which
already exists in the repository and is the retention lever. Nothing is added to `resolveLimits()`,
nothing to `PLAN_QUOTAS`, no case to `src/server/billing/__tests__/limits.test.ts`.

### Tenant isolation test

Added to `src/server/repos/__tests__/tenant-isolation.test.ts`: in A's scope, record an audit entry
naming one of B's entities as its `entity_id` — the entry is written into A and never appears in a
`listAuditLog` or `listEntityHistory` call made in B's scope. In B's scope, ask for the entry A wrote,
by id — `NotFoundError`. Then confirm `countAuditActions` in B counts only B's rows. Functions
covered: `trail`, `recordAudit`, `listAuditLog`, `listEntityHistory`, `countAuditActions`.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Unit tests in `src/server/audit/__tests__/trail.test.ts`: an entry carries the actor from the scope
  and not from the input; a throw inside `recordAudit` does not propagate; no request in scope yields
  a row with null IP and null user agent rather than an exception; a malformed action key is rejected
  at the boundary.
- Browser evidence: `/admin` at 360px and 1440px in light and dark, photographed after performing an
  audited action in another tab — the state that is the point of the stage is a new row at the head
  of the table with the actor, the action key and the resource resolved, not the resting screen.
- Console must be silent.

### Definition of done

The six items from `docs/SPEC.md` §7 apply unchanged, as listed in `00-S1`.

The `SPEC.md` §2 clauses are ticked against the audit table on `/admin`:

- [ ] Spacing on the 4px grid from `--space-*`.
- [ ] Hover, focus-visible, active, disabled and loading on every interactive element, including the
      paging controls.
- [ ] Designed empty state, skeleton and error state on the audit list — the empty state must read as
      "nothing has happened yet", not as a failure.
- [ ] Motion 150–260ms on `--ease-out-quint` or a sibling, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured.
- [ ] Light and dark parity with dark shadows re-declared.
- [ ] 360px to 2560px, where the table becomes a designed stacked layout on a phone rather than a
      horizontally scrolled desktop table.
- [ ] Keyboard reachable end to end, accessible names on the paging controls, WCAG 2.2 AA in both
      themes.
- [ ] Zero console errors or warnings, zero layout shift after paint; timestamps and counts use
      tabular numerals.

### Blockers

None.

## Stage 00-S4 — Travel-statistics recomputation

### Stage id

`00-S4` · Wave 0 · effort **M**. The third unwritten write path.

### Reference rows

Closes none. It supplies the write half of `ADD-06` (`08-product-modules.md`, wave 2) — distinct
countries and cities, trips all-time and this year, places, travel days, the six-continent breakdown
and the consecutive-year streak — which keeps the row and owns the panel.

Measured: `upsertTravelStats` and `recomputeTravelStats` in `src/server/repos/atlas.ts` are called
only by the dev seeder, and `listTravelStats` is read by `src/routes/_app/-server/library.ts`. The
consequence on screen is specific and bad: marking a country visited updates the map immediately and
leaves every number in the statistics panel frozen at its seeded value.

Rows unblocked: `ADD-06` directly. `ADD-05` (the atlas map itself, wave 1) is ADD-06's parent and is
not blocked by this stage; it is named because its write functions are where the recompute is
triggered from.

One constraint travels with the unblock, and `ADD-06` inherits it: seven of the row's ten figures are
workspace-wide, not per-traveller. The measurement and what it forces on the panel's labelling are
under **Server** below, and the row's copy is bound by it.

### Owned paths

- `src/server/queue/handlers/travel-stats.ts` — new. Recomputes one traveller's rows.
- `src/server/queue/handlers/__tests__/travel-stats.test.ts` — new.
- `src/server/queue/types.ts` — edit. Adds the `travel-stats` kind, its payload schema, and `DB` to
  the handler binding surface.
- `src/server/queue/consumer.ts` — edit. Registers the handler.
- `src/server/fns/atlas.ts` — edit. The two visited-country write functions enqueue a recompute; the
  two bucket-list ones deliberately do not, for the reason under **Server**.
- `src/server/fns/__tests__/atlas.test.ts` — edit. The enqueue assertions under **Verification**
  belong beside the existing coverage of the four atlas write functions; the file already installs
  the `AsyncLocalStorage` context those functions need, and standing up a second harness for the same
  four functions would be a duplicate, not an isolation. No other wave-0 stage names this file.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. The case under **Tenant isolation
  test** below, as one new `describe` block, under the append-only exception in the tenant procedure
  above.

### Data and migration

None. `travel_stats` exists with every column the panel reads, keyed by `user_id` and `stat_year`,
where `stat_year = 0` is the all-time roll-up. No column, no index, no migration.

### Server (repo, server function, Zod)

- **What the row actually aggregates, measured — the stage's premise depends on getting this
  right.** `recomputeTravelStats(scope, userId, statYear)` (`src/server/repos/atlas.ts:792-896`)
  writes one row keyed `(organization_id, user_id, stat_year)` — the unique index at
  `src/server/db/schema.ts:1515` — but the row being per-traveller does not make its contents
  per-traveller. Read the predicates: `tripCount` (`atlas.ts:813`), `dayCount` (`:821-823`),
  `placeCount` (`:827-831`), `cityCount` (`:834-838`), `spendMinor` (`:841-844`) and the
  `currency`/`lastTripId` lifted from `tripRows[0]` (`:892-893`) are bound by `tenantFilter()` and by
  nothing else, so every member of a workspace gets the same seven numbers. Only three figures
  differ between two travellers in one workspace: `countryCount` and `byContinent`, from
  `listVisitedCountries(scope, userId)` (`:845`), and `regionCount`, which counts `visited_regions`
  filtered by `userId` (`:890`). This is deliberate, and the repository already argues it at
  `atlas.ts:366-370`: a per-country trip figure filtered by trip membership would not sum to the
  workspace trip count printed above the map, and two figures on one panel that disagree read as a
  bug rather than as a distinction. The stage adopts that reading rather than fighting it, and
  `ADD-06` labels the seven workspace figures as the workspace's — never as "your trips".
- **Repository.** No new SQL. `recomputeTravelStats` already rebuilds the row from five aggregate
  queries, and `upsertTravelStats` (`atlas.ts:764-786`) already writes it through `definedOnly`, so
  a field the recompute omits keeps its stored value instead of resetting to zero.
- **Two columns the recompute cannot derive, and what happens to each.** `travel_stats.year_streak`
  and `travel_stats.distance_metres` (`schema.ts:1509`, `:1505`) are accepted by
  `upsertTravelStatsInput` (`atlas.ts:130`, `:127`) and never passed by `recomputeTravelStats`. The
  seeder states this in its own words at `src/routes/api/dev/-seed/dataset/workspace.ts:206` and
  writes them in a second call (`src/routes/api/dev/-seed/apply.ts:536-537`). Because
  `upsertTravelStats` uses `definedOnly`, both survive every recompute at their seeded value, which
  is exactly how a frozen number hides behind numbers that move. The streak is therefore derived in
  the handler: read the year rows with `listTravelStats(scope, userId)` (`atlas.ts:742-750`), count
  consecutive years with a non-zero `tripCount` back from the newest, and pass the result as
  `yearStreak` on the all-time upsert. That needs no repository edit, because the input already
  accepts the field. `distance_metres` has no source at all — no transport leg carries a distance
  today — and the stage does **not** invent one. It is reported as a decision under **Blockers**;
  `ADD-06` either omits the figure or files its own row for it, because a panel printing a permanent
  zero is worse than a panel that omits the line.
- **Why a queue and not inline.** Five aggregate queries on a busy tenant is exactly the shape
  `ARCHITECTURE.md` §5 sends to `TASKS`. The atlas write functions enqueue one `travel-stats` task
  and return; the map updates optimistically as it does today, and the panel catches up on its next
  read. The envelope id is deterministic per user and year, so a burst of country toggles collapses
  rather than fanning out.
- **Measured obstacle, and its fix.** `TaskBindings` in `src/server/queue/types.ts:228-241` declares
  `KV`, `FILES`, `TASKS` and an optional `TRIP_ROOM`, and **no `DB`**, so no queue handler can reach
  D1 today. The `DB` binding already exists on the Worker and the consumer runs in the same Worker,
  so this is a type-surface change in `types.ts`, not a `wrangler.jsonc` change. No binding stage is required, and none is
  minted.
- **Scope inside a handler.** `createScope()` needs `{ userId, organizationId, role }`. The envelope
  carries the organization id and the user id; the role is resolved with `getMembership` from
  `src/server/repos/members.ts` before the scope is built, and a message whose user is no longer a
  member is a permanent failure, not a retry — it dead-letters with a named reason rather than
  looping five times.
- **Zod.** `z.strictObject({ userId, statYear })` added to the task envelope union in `types.ts`,
  with `statYear` an integer, either `0` or a four-digit year, using the `error` parameter.
- **Authorisation.** The handler never trusts the envelope beyond its shape: the organization id in
  the envelope is used to build the scope, and every query the repository then runs is
  `tenantFilter()`-bound to that same organization, so a forged envelope can only recompute rows it
  already owns.
- **Which years, and which writes.** Measured: `src/server/fns/atlas.ts` exposes exactly four write
  functions — `markCountryVisitedFn` (`:441`), `unmarkCountryVisitedFn` (`:485`),
  `addCountryToBucketListFn` (`:547`) and `removeCountryFromBucketListFn` (`:585`). Only the first
  two change an input of the stat row, and only its per-traveller third. `bucket_list_items` feeds no
  column of `travel_stats` (`schema.ts:1491-1520`), so the two bucket-list functions enqueue nothing;
  enqueueing from them would buy a consumer invocation whose only measurable effect is cost. The two
  visited-country functions enqueue the all-time roll-up (`statYear = 0`) and, when the write carries
  a `visitedOn` date, that date's year.
- **The seven workspace figures move on writes this stage does not own, and that is stated rather
  than hidden.** A trip, day, place or expense write changes `tripCount`, `dayCount`, `placeCount`,
  `cityCount` and `spendMinor` for _every_ member's row at once, and those write paths belong to
  `01-trips-core.md` and `04-budget-and-currencies.md`. This stage does not reach into them. It ships
  the task kind, the handler and the deterministic envelope id so that those plans enqueue one task
  per affected member and year, and it records the requirement here so neither plan invents a second
  recompute. The deterministic id is what keeps that fan-out affordable: repeated envelopes for the
  same `(user, year)` collapse. Until those plans land, the workspace figures still refresh on the
  next visited-country write — a delay rather than a freeze, and strictly better than today, where
  nothing in production recomputes at all.

### UI (route, components)

None. `src/routes/_app/atlas.tsx` and `AtlasPanel` already render `listTravelStats` through
`loadAtlas`. No new route file, so `pnpm generate-routes` is not run. No new token, no new primitive.

### Quota

**Creates no quota-bearing row, explicitly.** `travel_stats` is a derived cache: one row per user per
year, upserted rather than appended, so its cardinality is bounded by membership times years and
cannot grow with usage. Metering a derived row would charge a tenant twice for the trips it already
pays for. Nothing is added to `resolveLimits()`, nothing to `PLAN_QUOTAS`, no case to
`src/server/billing/__tests__/limits.test.ts`.

The cost that does matter is D1 rows-read, because D1 bills on rows scanned: the recompute is five
aggregates and must stay off the read path. Keeping it in the queue is that control.

### Tenant isolation test

Added to `src/server/repos/__tests__/tenant-isolation.test.ts`, with assertions that follow the
measured split above rather than the intuitive one.

Run the recompute in A's scope with a user id that belongs only to B. The row is written under A's
organization, never under B's, and B's own stats rows are unchanged — that is the isolation claim,
and it is asserted whole. The row's _contents_ are asserted in two halves, because a blanket "zero
counts" assertion is unsatisfiable and would fail on its first run:

- the three per-traveller figures — `countryCount`, `regionCount`, `byContinent` — are zero, because
  `visited_countries` and `visited_regions` are filtered by organization **and** user, and B's rows
  are invisible from A's scope;
- the seven workspace figures — `tripCount`, `dayCount`, `placeCount`, `cityCount`, `spendMinor`,
  `currency`, `lastTripId` — equal A's own all-time row, because they are `tenantFilter()`-bound
  only. Asserting them equal to A's row rather than to zero is what makes the test express the real
  boundary.

Then read the row back from B's scope. `getTravelStats(scopeB, aUserId, 0)` returns `null`: measured,
it is `travelStatsRepository.findOne` with return type `TravelStat | null`
(`src/server/repos/atlas.ts:752-761`), so the assertion is `toBeNull()` and not a rejection, and
`listTravelStats(scopeB, aUserId)` is empty. The throwing path is asserted separately through
`travelStatsRepository.requireById(scopeB, rowIdWrittenInA)` (`src/server/repos/base.ts:298`), which
is where `NotFoundError` actually comes from. Functions covered: `recomputeTravelStats`,
`upsertTravelStats`, `getTravelStats`, `listTravelStats`.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Unit tests in `src/server/queue/handlers/__tests__/travel-stats.test.ts`: a handled message writes
  the row for the year its own envelope names, and the all-time and year envelopes together leave two
  rows; the same message delivered twice leaves one row per year with the same numbers; the streak
  the handler computes matches a hand-built year history, including a gap year that ends the run; a
  recompute leaves `distance_metres` at its stored value rather than zeroing it; a user who is no
  longer a member fails permanently rather than retrying; the handler never reads outside the
  envelope's organization.
- Unit tests appended to `src/server/fns/__tests__/atlas.test.ts`, with the `TASKS` binding stubbed
  the way that file already stubs the runtime around a server function: `markCountryVisitedFn` and
  `unmarkCountryVisitedFn` each
  enqueue the all-time envelope, plus the year envelope when `visitedOn` is supplied, both with the
  deterministic ids; the two bucket-list functions enqueue nothing; and a queue rejection does not
  fail the user's write.
- Browser evidence: `/atlas` at 360px and 1440px in light and dark, photographed **after** marking a
  country visited and letting the consumer run — the state that is the point of the stage is the
  statistics panel's numbers moving in step with the map, which is precisely what does not happen
  today.
- Console must be silent.

### Definition of done

The six items from `docs/SPEC.md` §7 apply unchanged, as listed in `00-S1`.

The `SPEC.md` §2 clauses are ticked against the atlas statistics panel:

- [ ] Spacing on the 4px grid from `--space-*`.
- [ ] Hover, focus-visible, active, disabled and loading on every interactive element, including the
      mark-visited control while its recompute is in flight.
- [ ] Designed empty state for a traveller with no trips yet, skeleton while the panel loads, and an
      error state that offers a retry.
- [ ] Motion 150–260ms on `--ease-out-quint` or a sibling, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured.
- [ ] Light and dark parity with dark shadows re-declared, including over the map canvas.
- [ ] 360px to 2560px, small designed rather than squeezed.
- [ ] Keyboard reachable end to end, accessible names on every statistic, WCAG 2.2 AA in both themes.
- [ ] Zero console errors or warnings, zero layout shift after paint; every statistic uses tabular
      numerals, because all of them change.

### Blockers

- **`travel_stats.distance_metres` has no source.** No transport leg records a distance, so the
  recompute cannot derive the column and the seeder is the only thing that has ever filled it
  (`src/routes/api/dev/-seed/dataset/workspace.ts:206`). Disposition: **report**. This stage invents
  no distance model; `ADD-06` omits the figure until a row owns it, and
  `11-boundaries-and-blockers.md` carries the disposition.

## Stage 00-S5 — Reminder scheduling

### Stage id

`00-S5` · Wave 0 · effort **M**. The fourth unwritten write path.

### Reference rows

Closes none. It supplies the write half of `TRP-04` (`01-trips-core.md`, wave 6) — pre-departure
reminders with the 1/3/9-day presets and a custom 1–30-day choice anchored to the trip's start date —
which keeps the row and owns the preference UI.

Measured: `src/server/queue/reminders.ts` is complete. It builds a KV key whose 13-digit zero-padded
due time sorts lexicographically, `sweepReminders` is wired to the `*/15 * * * *` cron in
`src/server/worker.ts`, and the sweep turns due records into `email` tasks with a deterministic id so
a double sweep sends one message. **`scheduleReminder` and `cancelReminder` have zero callers**, so
the sweep runs every fifteen minutes over an empty index. `trips.reminder_days` exists at
`src/server/db/schema.ts:354`, `NOT NULL DEFAULT 3`, with a non-negative CHECK — so the preference is
already stored and already ignored.

Rows unblocked: `TRP-04` directly.

### Owned paths

- `src/server/queue/reminder-sync.ts` — new. Turns a trip into a scheduled reminder, or removes one.
- `src/server/queue/__tests__/reminder-sync.test.ts` — new. Also carries the sweep seam test named
  under **Verification**; no test file covers `src/server/queue/reminders.ts` today, measured.
- `src/server/queue/reminders.ts` — edit, and the edit is one chunk loop and nothing else. Measured:
  `sweepReminders` (`:119-154`) hands up to `limit` envelopes — default 200, and `src/server/worker.ts:58`
  passes the default — to `enqueueTasks`, which does not chunk, so a tick with more than 100 due
  reminders exceeds the 100-message `sendBatch` cap and throws away the whole tick. The bug is
  unreachable today only because `scheduleReminder` has no caller. This stage is what gives it one,
  so this stage fixes it rather than shipping a landmine and a note: the sweep enqueues in chunks of
  at most 100, deletes only the keys whose chunk was accepted, and reports `enqueued` as the number
  actually sent. Nothing else in the module changes; `scheduleReminder`, `cancelReminder`,
  `reminderKey` and `dueReminders` are used as they stand.
- `src/routes/_app/-server/overview.ts` — edit. `createTripFn` (`:556`) schedules on creation, with
  `previous: null` — the only anchor a creation can honestly claim, and the reason `null` is a value
  the type demands rather than an argument the call site may leave out.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. The case under **Tenant isolation
  test** below, as one new `describe` block, under the append-only exception in the tenant procedure
  above.

### Data and migration

None. The reminder index lives in KV, not D1, and `trips.reminder_days` already exists. No column, no
index, no migration.

### Server (repo, server function, Zod)

- **Repository.** No new SQL, and the reader is named rather than left to the implementer's choice,
  because the two candidates behave differently. The trip is resolved with
  `requireTrip(scope, tripId)` (`src/server/repos/trips.ts:152`), which raises `NotFoundError` for an
  id outside the tenant — **not** `getTrip` (`:223`), whose return type is `Trip | null`, and **not**
  `listTripMembers` (`:403-411`), which returns `[]` for a foreign trip and would let a cross-tenant
  id fall through as "a trip with no members". Membership then comes from `listTripMembers` and the
  addresses from `listUserProfiles` in `src/server/repos/members.ts`.
- **Why the signature carries the previous anchor, and what breaks without it.** Measured:
  `reminderKey` (`src/server/queue/reminders.ts:38-41`) builds
  `reminder:<due13>:<orgId>:<kind>:<id>`, so the due time is _inside_ the key and is its leading
  variable segment, and `cancelReminder` (`:66-71`) takes `{ dueAt, orgId, entity }` and rebuilds
  that same string. Cancelling therefore needs the **old** due time. It cannot be read back out of
  the trip row, which by then holds the new dates, and it cannot be found in KV either: because the
  due time sorts ahead of the org and the entity, there is no prefix that selects "the key for this
  trip" — only a full scan of the index would find it, which is precisely the scan the whole design
  exists to avoid. A sync function that receives only a trip id can create keys and can never remove
  the one it replaced.
- **The sync function.** `syncTripReminder(scope, kv, input)`, where `input` is
  `{ tripId: string; previous: TripReminderAnchor | null }` and
  `TripReminderAnchor` is `{ startDate: string | null; reminderDays: number }` — the two trip columns
  the key depends on and nothing else. `previous` is a **required property typed as nullable**, never
  an optional one: an omitted optional compiles and silently means "cancel nothing", which is the
  orphaned-key bug wearing a default. `null` is the honest answer at creation and it has to be typed
  out. The body then does exactly three things: read the trip through `requireTrip` in the caller's
  scope; when `previous` yields a due instant, `cancelReminder` for the key that anchor implies; then
  `scheduleReminder` for the new one, unless the new anchor yields nothing to schedule. Cancel before
  schedule is required rather than defensive — the module's own header at `:52-56` says a re-register
  under a new due time leaves the old key behind, and an orphan sends a second reminder on the old
  date.
- **One anchor function, used by both keys.** `reminderDueAt(anchor): number | null`, exported from
  `src/server/queue/reminder-sync.ts` beside `syncTripReminder`, and pure: 08:00 UTC on
  `startDate − reminderDays`, `null` when `startDate` is null
  or `reminderDays` is `0`. It is deliberately **not** time-dependent — it does not return `null` for
  an instant in the past, because the key being cancelled is usually in the past and must still be
  reconstructible. Whether the new instant is already behind us is a separate decision made in
  `syncTripReminder`, which skips the schedule and still performs the cancel. One function for both
  sides is what guarantees the cancel and the schedule can never disagree about the anchor rule, and
  it is what the unit tests assert the key against.
- **The cancel is cheap and cannot fail on a key that was never written.** Workers KV documents
  `delete()` on a non-existent key as a successful delete, so an anchor that never produced a key —
  `reminderDays = 0`, a trip with no verified addresses — costs one delete operation and no error
  path. When the previous key and the new key are byte-identical the delete is skipped and the put
  alone re-registers the record, which saves a billed KV delete on the common case of an edit that
  moved neither the start date nor the lead time.
- **The alternative that was rejected, and why.** A pointer key — `reminder-ptr:<orgId>:trip:<id>`
  holding the current reminder key — would make the previous key self-recoverable and take the
  burden off every call site. It is not used: KV is eventually consistent, so a trip created and then
  edited inside the propagation window could read a stale pointer or none at all and leave exactly
  the orphan the pointer exists to prevent, at the cost of an extra read and an extra write on every
  sync. The previous anchor read from D1 is strongly consistent and is already in the caller's hand —
  an edit path resolves the trip through `requireTrip` before it updates, so the pre-update row _is_
  the previous anchor and passing it costs nothing.
- **Why the anchor is 08:00 UTC, stated rather than assumed.** `trips` carries no timezone column, so
  a per-trip local anchor is not expressible today; 08:00 UTC is chosen because it lands in the
  morning across Europe and before midday in the Americas, and because a reminder that arrives a few
  hours early is harmless while one that arrives after departure is worthless. A new instant already
  in the past schedules nothing — the next sweep would fire it immediately, which is a reminder
  arriving after the traveller already knew. `reminder_days = 0` means no reminder and is a valid
  stored value under the existing non-negative CHECK, which is why `reminderDueAt` answers `null` for
  it rather than reading it as "the morning of departure".
- **Recipients.** Every trip member with a verified address, resolved server-side.
  `reminderRecordSchema` (`src/server/queue/reminders.ts:25-34`) declares `to` as
  `z.array(z.string().email()).min(1).max(20)`, and both bounds matter. The upper one: a trip with
  more than 20 addressable members sends to the first 20 and logs the truncation rather than letting
  the schema throw. The lower one: with zero verified addresses the record cannot be constructed at
  all, so `syncTripReminder` returns without writing a key instead of calling `scheduleReminder` and
  catching its `ZodError`. Both are unit tests, not comments.
- **Failure isolation.** A KV failure never fails trip creation. It is caught, logged once with
  `serializeError`, and the trip is still created — a missing reminder is a smaller harm than a failed
  save, and the next edit re-syncs.
- **Zod.** `reminderRecordSchema` already validates the record. The sync function's own input is a
  `z.strictObject({ tripId, previous })` with the `error` parameter, where `previous` is
  `z.strictObject({ startDate: z.iso.date().nullable(), reminderDays: z.number().int().min(0) }).nullable()`
  — nullable, not optional, so the validator refuses the same omission the type refuses. The due
  time, the recipients and the body are all derived server-side and none of them is accepted from the
  client. Validating the previous anchor is shape only: it is a server-supplied echo of a row the
  caller just read, never a client value, and a call site that forged it could at worst delete a key
  inside its own organization, because the org segment of the key comes from the scope.
- **Authorisation.** The trip is re-read in the caller's scope; a foreign trip id is a `NotFoundError`
  before any KV key is written, which matters more here than usual because KV is not tenant-scoped by
  construction — the organization id is part of the key and the key is built from the scope, never
  from the request.
- Sending stays in the queue. The sync path enqueues nothing at all — it writes one KV key and
  returns; the `*/15` sweep is the only producer, which is why a provider outage retries without
  re-scanning the index, and it is the only reason the sweep's own batching is this stage's business.

### UI (route, components)

None. The reminder preference control belongs to `TRP-04`, and the trip edit surface that would carry
it belongs to `TRP-03`. No new route file, so `pnpm generate-routes` is not run. No new token, no new
primitive.

**Cross-plan obligation, stated here so it is not discovered late.** `TRP-03` (trip lifecycle: edit,
archive, delete) must call `syncTripReminder` when `start_date` or `reminder_days` changes, and
`cancelReminder` when a trip is archived or deleted. The edit path passes the **pre-update** row's
`{ startDate, reminderDays }` as `previous`, which means it reads the trip before it writes it — it
already does, through the `requireTrip` that authorises the update, so this is an argument to pass
and not a query to add. The archive and delete paths pass that same pre-delete anchor to
`cancelReminder`, for the same reason: after the row is gone the key cannot be rebuilt. Without this,
an edited trip keeps the reminder its old dates implied and sends twice. `01-trips-core.md` carries
it under TRP-03's **Server** heading.

### Quota

**Creates no quota-bearing row, explicitly.** A reminder is a KV key, not a domain row: it is not
sold, not counted by any metric, and self-expiring — `scheduleReminder` sets an `expirationTtl` that
outlives the due time by seven days so a missed sweep self-cleans. Cardinality is bounded by trips,
which is already a metered metric, so metering reminders would meter the same thing twice. Nothing is
added to `resolveLimits()`, nothing to `PLAN_QUOTAS`, no case to
`src/server/billing/__tests__/limits.test.ts`.

Cost, measured against `ARCHITECTURE.md` §8: one KV write per trip creation, and one delete plus one
write per edit that moves the anchor — the delete is skipped when the anchor did not move, which is
the common edit. At ten users that is a handful of operations a day; at ten thousand it is still far
below any KV tier boundary, because the count follows trips and not requests.

### Tenant isolation test

Added to `src/server/repos/__tests__/tenant-isolation.test.ts`: in A's scope, call `syncTripReminder`
for one of B's trips with `previous: null` — `NotFoundError`, and neither a `put` nor a `delete`
reaches KV, because the `requireTrip` rejection precedes every KV operation. Repeat it with a forged
`previous` anchor to show the same thing from the other side: a caller cannot use the previous anchor
as a cross-tenant delete primitive, both because the call never reaches KV and because the key's org
segment is taken from the scope rather than from the input. Then confirm that
the key A's own trip produced contains A's organization id, so a sweep can attribute it, and that
reading B's trip through the same path in A's scope never yields B's member addresses. Functions
covered: `syncTripReminder`, and through it `requireTrip` and `listTripMembers` in
`src/server/repos/trips.ts` and `listUserProfiles` in `src/server/repos/members.ts`. The
`NotFoundError` in that case comes from `requireTrip`; asserting it against `listTripMembers` would
be asserting a rejection that function does not make.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Unit tests in `src/server/queue/__tests__/reminder-sync.test.ts`, against an in-memory KV double
  that records every `put` and `delete` in order, so "cancelled before written" is an assertion about
  the sequence and not about the final state: `reminderDueAt` puts the key's due prefix at 08:00 UTC
  on `start_date − reminder_days`, and returns a value for an anchor in the past rather than `null`,
  which is what makes an old key reconstructible; a sync with `previous: null` writes one key and
  issues no delete; **a re-sync after a date change, given the pre-edit anchor as `previous`, deletes
  exactly the key that anchor implies and then writes the new one, leaving one key in the store** —
  the test that could not be written against a trip-id-only signature, and the reason the signature
  changed; a re-sync whose previous anchor equals the current one issues no delete and re-writes the
  same key; `reminder_days = 0` writes nothing and cancels whatever `previous` implies; a new instant
  already in the past writes nothing but still cancels; a trip with no verified addresses writes
  nothing rather than throwing a `ZodError` out of `scheduleReminder`; a KV rejection does not
  propagate to the caller; and the written record parses against `reminderRecordSchema`, so the sweep
  needs no second parse.
- Two tests across the sweep seam, in the same file. First, the seam itself: schedule a reminder due
  in the past, run `sweepReminders`, assert exactly one `email` envelope with the deterministic id
  and that the key is gone afterwards — the assertion that proves the empty index is no longer empty.
  Second, the chunk bound this stage adds to `sweepReminders`: 250 due reminders in one tick produce
  three `enqueueTasks` calls of at most 100 envelopes each, every key is deleted exactly once, and
  the returned `enqueued` count equals 250. Written against today's unchunked sweep the second test
  fails on the first assertion, which is the point of writing it.
- Browser evidence: the trip creation dialog at 360px and 1440px in light and dark, photographed at
  the moment of submission with the control in its loading state — the point of the stage is that the
  save path grew work without growing its latency or losing its pending affordance.
- Console must be silent.

### Definition of done

The six items from `docs/SPEC.md` §7 apply unchanged, as listed in `00-S1`.

The `SPEC.md` §2 clauses are ticked against the trip creation dialog, the only surface whose behaviour
this stage changes:

- [ ] Spacing on the 4px grid from `--space-*`.
- [ ] Hover, focus-visible, active, disabled and loading on every interactive element; the submit
      control stays disabled and labelled while the save and the schedule are in flight.
- [ ] The dialog's lists keep their designed empty, skeleton and error states.
- [ ] Motion 150–260ms on `--ease-out-quint` or a sibling, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured.
- [ ] Light and dark parity with dark shadows re-declared.
- [ ] 360px to 2560px, where the dialog is a sheet on a phone rather than a shrunken modal.
- [ ] Keyboard reachable end to end, focus trapped in the dialog and returned to the trigger on
      close, WCAG 2.2 AA in both themes.
- [ ] Zero console errors or warnings, zero layout shift after paint.

### Blockers

- **Email delivery needs `EMAIL_API_KEY`.** The `email` handler and the sweep are both written; without
  the secret the handler declines loudly. Not a blocker for scheduling, which is what `TRP-04` needs
  in place, but the row cannot be demonstrated end to end without it.
- **No per-trip timezone column exists.** The 08:00 UTC anchor above is the stated consequence.
  Changing it later is an additive column and a re-sync, not a rewrite, so it is not deferred work
  hiding behind a default — it is a decision with a stated reason.
