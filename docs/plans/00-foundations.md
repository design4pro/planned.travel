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

| Shared file               | Owner                                      | The ritual, exactly                                                                                                                                                                                                                                                                                        |
| ------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/server/db/schema.ts` | one schema stage per wave                  | Collect every column and table the next wave asked for. Edit the schema module once. Run `pnpm db:generate`, read the SQL it wrote in `drizzle/`, then `pnpm db:migrate:local`. Additive only — see the migration ritual below.                                                                            |
| `src/routeTree.gen.ts`    | nobody; it is generated                    | Never opened in an editor. A stage that adds or renames a route file runs `pnpm generate-routes` and lets the regenerated tree travel inside its own diff. It is never listed under **Owned paths**, and a hand edit fails the audit.                                                                      |
| `wrangler.jsonc`          | one bindings stage per wave                | Binding, migration-tag, trigger and limit changes are batched into that one stage. A new binding is also a cost-model change and is argued as one before it is written. Local ids stay placeholders; `docs/DEPLOY.md` owns the real ones.                                                                  |
| `src/styles/tokens.css`   | one token stage per wave                   | Collect every missing token from the wave's plans, add them in one edit, declare each in all three places `DESIGN.md` requires: bare `:root`, `@media (prefers-color-scheme: dark)` guarded `:root:not([data-theme="light"])`, and `:root[data-theme="dark"]`. Dark shadows are re-declared, never reused. |
| `src/components/ui/**`    | one primitive stage per wave               | Only genuinely new primitives. Check `src/components/ui/index.ts` first: 42 primitive modules already ship, and a second implementation of one is a defect, not a merge conflict. Extend the existing file rather than adding a sibling.                                                                   |
| `src/server/worker.ts`    | the same bindings stage that owns wrangler | Any new Durable Object class, queue consumer or cron branch must be re-exported here. Measured: the module's own header records that a missing `TripRoom` export fails isolate startup outright, so `vite dev` serves no request at all.                                                                   |

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

**Every applied migration is frozen.** Measured at HEAD, `drizzle/` holds six:
`0000_bored_moon_knight.sql` creates all 66 tables, `0001_aspiring_cargill.sql` rebuilds `expenses`,
and `0002_locale_normalisation.sql` through `0005_lucky_iron_man.sql` followed them. None is edited,
renamed or regenerated for any reason: they have been applied, and drizzle-kit's snapshots in
`drizzle/meta/` are the only record of what they did. A mistake in them is repaired by a new
migration, never by rewriting history.

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

**`enqueueTasks` holds the message-count bound; a producer holds the byte bound.** The limit is the
platform's and is three limits at once: a `sendBatch` array holds at most 100 messages, each message
at most 128 KB, and the whole array at most 256 KB. `enqueueTasks` (`src/server/queue/jobs.ts`) owns
the first: it cuts its input into batches of at most `QUEUE_BATCH_MAX` (100) and sends them in order,
one after another, so a producer hands it every envelope it has and does not loop. It cannot own the
other two, which depend on what a producer puts in a message. Any stage whose producer scales with
something — one message per recipient, per member, per file — and whose messages are large cuts its
input before it calls, declares the chunk size as a named constant next to the limit it was derived
from, and holds the bound in a unit test rather than in a comment. `00-S2` does this for its
per-recipient email envelopes (a byte bound), and the rewritten `00-S5` sweep inherits it by
dispatching through `00-S2`'s chunked path rather than enqueueing directly. _(Before this, the helper
mapped every input into one `sendBatch` and each producer carried its own slice loop — #208.)_

**`enqueueDetached` owns the follow-up producer's shell.** A producer that enqueues after a write D1
already holds (`travel-stats` fan-out, `trip-purge`) builds its envelopes in a thunk and hands them to
`enqueueDetached` (`src/server/queue/enqueue-detached.ts`), with its own logger, message and context.
The helper holds the one lazy `#/server/auth/env` import, skips the binding when there is nothing to
send, and catches and logs a refusal once with `serializeError`, so the write never fails. A producer
that rethrows after compensating (`trip-copy`) is outside it.

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
- The billing webhook really does enqueue `billing.subscription.changed`
  (`src/server/billing/webhook.ts:394`, `:527`) and `billing.invoice.paid` (`:472`), and **neither
  has a handler, so both dead-letter today**. `billing.invoice.payment_failed` is declared and
  routed but never enqueued anywhere in `src/`, so it is dead in both directions. That is a billing
  correctness problem, not a plan-set problem; it is recorded here so no stage assumes the billing
  follow-ups run. The state-critical half is unaffected — the webhook upserts the subscription and
  invalidates entitlements synchronously before it enqueues — so what dead-letters is tenant-facing
  follow-up, not billing state. Disposition, decided: no wave-0 stage is minted for it. It is a
  wave-1 candidate that becomes cheap once `00-S2` ships, because a `billing.*` handler is then one
  `dispatch` call to the organization's admins.
- **The unchunked enqueue had exactly one caller in `src/` when this was measured, and it was the
  sweep** (`src/server/queue/reminders.ts:144`; every other producer used the single-message
  `enqueueTask`). `sweepReminders` (`:119-154`) read up to `limit` due reminders — the default is 200,
  and `src/server/worker.ts:65` called it with the default — then handed all of them to `enqueueTasks`
  in one call. Past 100 due reminders in a single tick that batch exceeded the platform cap and the
  whole sweep threw, losing every reminder in the tick rather than the surplus. It never fired,
  because `scheduleReminder` had no caller and the index was empty. Decided during grilling: `00-S5`
  replaced the schedule-at-write design outright, so the sweep dispatches through `00-S2`'s chunked
  path instead. `enqueueTasks` has since taken the message-count bound itself (#208), so no caller
  can reach the cap by passing it a long list.

## Bindings a later plan assumes and `wrangler.jsonc` does not declare

`wrangler.jsonc` declares seven bindings and all seven are read by non-test code: `DB`, `KV`,
`SESSIONS`, `FILES`, `TILES`, `TRIP_ROOM`, `TASKS`. The table below is every binding a later plan
might assume beyond those.

**Each row is a decision to report, not an action to take.** No stage in this file adds one. Adding
a binding changes the cost model and, for the first two, adds a per-request external dependency;
that argument belongs to a human, and the report is the deliverable.

**Ratified during grilling: all four dispositions stood as report-only, and three still do.** No
binding, no DLQ consumer and no fourth cron is taken in wave 0 — that part is unchanged, and none of
the four was ever a wave-0 requirement. The one decision the table cannot close — which FX rate
provider, under a licence that permits a paid product — stays open in
`11-boundaries-and-blockers.md` and must be taken by a human before wave 2, because MNY-07 sits in
wave 1.

**The `AI` row has since been decided the other way, and the row below says so rather than being
quietly left standing.** ADR 0012 (2026-08-30) binds Workers AI for confirmation extraction and
supersedes the `BKG-04` disposition in `11-S1` that this table's own justification rested on. It
changes nothing about wave 0: the filer is `03-S7` in wave 5, so the supplier is a wave-4 bindings
stage, and the report-only reasoning above was always about what wave 0 takes speculatively rather
than about what a later wave may decide on evidence. What it does change is that the argument this
table asked a human for has been made, and where.

| Assumed binding                           | Which plan would assume it                 | Measured state at HEAD                                                                                                                                                                                                                                                         | Disposition                                                                                                                                                                                                |
| ----------------------------------------- | ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `BROWSER` (Browser Rendering)             | `06-documents-and-media.md`, DOC-06        | Not declared. `src/server/queue/handlers/pdf-export.ts:193` already renders through the REST API when `BROWSER_RENDERING_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set, and writes print HTML to R2 otherwise.                                                                | **Report only.** The REST path works without a binding; a binding is a later optimisation, priced against browser-hours.                                                                                   |
| `AI` (Workers AI)                         | `03-reservations-and-transport.md`, BKG-04 | Not declared. BKG-04's out-of-scope disposition in `11-S1` was **superseded by ADR 0012** on 2026-08-30. The deterministic `booking-import` handler still exists and is still tried first, but it is now the first branch rather than the whole path.                          | **Taken, and filed.** ADR 0012 binds Workers AI. `03-S7` (wave 5) filed the requirement onto a wave-4 bindings stage; that area has since migrated, so it ships as issue #177, not as a stage minted here. |
| A consumer for `planned-travel-tasks-dlq` | any plan that cares whether a job was lost | The dead-letter queue is named as `dead_letter_queue` on the consumer, but no consumer is declared for it, so dead-lettered messages accumulate unread.                                                                                                                        | **Report only.** Naming it is an operations decision with its own alerting; `ARCHITECTURE.md` §9 already alerts on DLQ depth.                                                                              |
| A fourth cron trigger for FX rates        | `04-budget-and-currencies.md`, MNY-07      | Three crons are declared; measured in `src/server/worker.ts:63-101`, `*/15 * * * *` runs the sweep, `17 4 * * 1` already prunes `platform_audit_log` (and warns that its backup-retention half is unwritten), and only `0 3 * * *` is a pure `cron has no handler yet` branch. | **Report only.** A rate refresh can ride the existing `*/15` sweep or a KV TTL; a fourth trigger is not required to ship MNY-07.                                                                           |

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

| Wave | Schema stage               | Bindings + worker stage                                                                                                         | Token stage                                                                                 | Primitive stage                                                                          |
| ---- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 0    | `00-S1`                    | none required — no wave-1 plan has filed a binding requirement, and the table above says why none should be taken speculatively | `--color-data-1` … `--color-data-8` shipped by #1502 for `04-S2`; chips use `surface-inset` | none required — the 42 shipped primitive modules cover every wave-1 surface named so far |
| 0    | `00-S6` (follow-up)        | none required                                                                                                                   | none required                                                                               | none required                                                                            |
| 1–6  | minted when the wave opens | minted when the wave opens                                                                                                      | minted when the wave opens                                                                  | minted when the wave opens                                                               |

A wave with no filed requirement mints no stage. An empty stage is worse than a missing one: it
invites an agent to invent work in the one file where invention is most expensive.

**One requirement was filed after `00-S1` closed, and the register owes it a stage.** The grilling of
`01-trips-core.md` (2026-08-28, decision 5) moved the trip favourite off the trip row and onto a
per-person table, `trip_favourites`, after `00-S1`'s migration (`drizzle/0006_mighty_nehzno.sql`) had
been generated. It is a wave-1 stage's requirement (`01-S1`) and therefore a wave-0 one to satisfy, so
the register mints a **wave-0 follow-up schema stage** for it — `00-S6`, one additive table, nothing
else — before wave 1 opens; `01-S1` does not open until it has landed. The table's shape is in
`01-S1`'s **Data and migration** and repeated in `00-S6` below.

**A second requirement was filed after that, and the register deliberately mints nothing for it.**
The grilling of `03-reservations-and-transport.md` (2026-08-30) took ADR 0012 and `03-S7` filed the
`AI` binding onto the **wave-4 bindings stage** of this file, in the ritual the shared-file table
prescribes. Before that wave could open, the area migrated to the tracker as PRD #167, and its
foundations filings were minted there instead: the binding, the extraction ceiling and one additive
column ship as issue **#177**, and the two schema bands that area needs as **#168** and **#172**.

The register therefore records the requirement and mints **no** wave-4 bindings stage for it. That is
the rule above applied rather than bent — a wave with no filed requirement mints no stage, and this
wave no longer has one, because the filer left. It is written down because the alternative is a
reader opening wave 4, finding a binding requirement in this file's history and minting a stage that
would collide with #177 in `wrangler.jsonc`, which is the one file where a collision is most
expensive. A migrated area files onto the tracker, not onto this register.

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

## Stage 00-S1 — Wave-0 schema stage: the expense currency precondition and the settlements migration

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
collision is already repaired.** `src/server/db/schema.ts:153` defines the helper as
`const currency = (name = 'currency') => text(name, { length: 3 })`, line 987 reads
`originalCurrency: currency('original_currency')`, and `drizzle/0001_aspiring_cargill.sql:14` creates
`original_currency text(3)` on the rebuilt table. `expenses` therefore already holds
`original_amount_minor`, `original_currency` and `exchange_rate`. The precondition survives, because
the same three-column shape is **missing from `settlements`**, which carries only `currency` — and a
settlement paid in a foreign currency is exactly the case MNY-03 must record. The seed README is
stale prose and is corrected by this stage.

### Owned paths

- `src/server/db/schema.ts` — edit. The shared schema module, held by this stage for all of wave 0.
- `drizzle/` — new files only: the generated migration and its snapshot, plus the journal entry.
  The six applied migrations, `0000_bored_moon_knight.sql` through `0005_lucky_iron_man.sql`, are
  not touched.
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

One migration, at the next free number (`0006` at HEAD), additive, generated not hand-written.

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
- **Who computes the rate — decided, and binding on the writing surface.** The repository rule above
  is the storage invariant only. The surface that writes these columns (MNY-03, and any later
  writer) computes `exchangeRate` server-side with `impliedRate()` from `src/lib/money.ts`, exactly
  as the expense path does in `src/server/fns/costs.ts:283-304`: the client supplies the amount
  pair, a source currency equal to the settlement currency normalises the whole triple to `null`,
  and a client-supplied rate is never trusted — an amount pair and a rate that disagree would put a
  lie under the row. This is what keeps expenses and settlements "under the same rule", and it keeps
  the frozen figure independent of the FX-provider decision that `11-boundaries-and-blockers.md`
  still holds open. `04-budget-and-currencies.md` carries it under MNY-03's **Server** heading.
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
- Migration review is part of the gate and is not optional: read the file `pnpm db:generate` just
  wrote (the next free number — `0006` at HEAD) and confirm it
  is three `ALTER TABLE settlements ADD COLUMN` statements, that no `__new_settlements` rebuild
  appears, that no `DROP` appears, and that `drizzle/meta/_journal.json` gained exactly one entry.
  Then `pnpm db:migrate:local` and confirm it applies against a database that already carries every
  previously applied migration (`0000`–`0005` at HEAD).
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
no caller in `src/` at all — even the dev seeder bypasses them, inserting through
`notificationsRepository.insert` (`src/routes/api/dev/-seed/apply.ts:719`) — so every row on
`/notifications` today was seeded.

Rows unblocked, by id. Direct dependants of ACC-05: `TRP-04`, `LST-01`, `ADD-04`, `ADM-02`.
Transitively, sixteen rows reach ACC-05 and inherit the unblock: `TRP-02`, `TRP-04`, `TRP-06`,
`TRP-11`, `LST-01`, `LST-02`, `LST-03`, `LST-04`, `LST-05`, `ADD-04`, `ADM-01`, `ADM-02`, `ADM-03`,
`BKG-05`, `COL-11`, `DOC-08`. That count is why this is a wave-0 stage and not a line item inside
`09-account-and-settings.md`.

### Owned paths

- `src/server/notifications/dispatch.ts` — new. The composition layer: recipients, preference
  filtering, in-app write, email hand-off. Contains no SQL.
- `src/server/notifications/__tests__/dispatch.test.ts` — new.
- `src/server/fns/collab-thread-writes.ts` — edit (the writer was `fns/collab.ts` until #907). First production caller: a posted trip message notifies the
  other trip members.
- `src/server/fns/costs.ts` — edit. Second production caller: an expense that splits onto other
  members notifies them.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. The three cases under **Tenant
  isolation test** below, as one new `describe` block, under the append-only exception in the tenant
  procedure above.

Two callers, not one, deliberately: a single call site is indistinguishable from a fixture, and both
of these write paths already ship end to end, so neither waits on a feature row.

The pair was re-argued against the reference during grilling and stands. The trip-message event has
direct reference parity (the reference ships a collaboration-message notification). The expense-split
event is a deliberate extension beyond the reference, which ships no expense notification at all —
per `docs/agents/reference.md`, a feature the reference lacks is not evidence we should lack it, and
a charge landing on a member's share is notification-worthy on its face. The tempting third
candidate, a reservation-change event with reference parity, is rejected for wave 0 on disjointness:
its call site lives in `src/server/fns/reservations.ts`, which `00-S3` owns this wave; it joins as a
wave-1+ caller once `00-S3` closes.

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
- **The actor is optional, and a system event excludes nobody.** Decided during grilling, for the
  rewritten `00-S5`. A dispatch caused by a person names that person and never notifies them; a
  system dispatch — the reminder sweep, a future billing follow-up — names no actor, and the
  exclusion step is skipped. For a caller with no request principal the module documents the
  `00-S4` pattern as its contract: resolve a real membership (`getMembership`, then `createScope`)
  and dispatch under that scope with no actor, so no synthetic principal exists anywhere and every
  repository contract holds unchanged.
- **One email envelope per recipient, not one envelope carrying the recipient list.** The payload
  schema would allow the second — `emailPayloadSchema.to` is `z.array(...).min(1).max(50)`
  (`src/server/queue/types.ts:31`) — and it is the wrong shape twice over. Measured: `handleEmail`
  (`src/server/queue/handlers/email.ts:40`) posts `to: payload.to` as a single provider message, so
  fifty travellers would each read the other forty-nine addresses; and its provider idempotency key
  is the envelope id (`eventId ?? taskId`), so one shared envelope would have to change id whenever
  the recipient list changed and would re-send to everybody already served. One envelope per
  recipient costs more messages and is the only shape that is both private and idempotent per
  person. Its deterministic id is
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
  One invariant recorded for the future: no guest representation exists today — `trip_members` roles
  are `owner`/`editor`/`viewer` and a share-token viewer has no user row — so every resolvable
  recipient has an inbox. If a guest membership shape ever lands, `dispatch`'s recipient derivation
  is the single chokepoint where guests are filtered from every channel, and that filter belongs
  here, never per call site.
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
the Better Auth organization plugin (`src/server/auth/index.ts:403`), which is the only one enforced
at the point a membership is written; the fallback `SEAT_LIMIT_CEILING = 100_000`
(`src/server/billing/limits.ts:77`), which applies when a plan sells no seat limit; and the largest
published plan's `seats: 10` (`src/lib/plans.ts:345`). A dispatch sized against any one of them is
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
  the number `QUEUE_BATCH_MAX` names — would have been sized against the wrong limit.

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
  (`src/server/db/schema.ts:1920` — the convention every domain table follows so the domain schema
  never imports the auth schema), and `filterEnabledRecipients`
  (`src/server/repos/notifications.ts:299-321`) is **opt-out** — it removes only users with an
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
`src/routes/api/dev/-seed/apply.ts:742`. `loadAdmin` in `src/routes/_app/-server/overview.ts` renders
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

The choice was re-argued against the reference during grilling and stands, with one split recorded
so no later plan mistakes it for finished work. The reference keeps a single, security-first audit
trail — sign-ins and failures, credential changes, role changes, invitations, trip lifecycle,
settings. This product splits that catalogue in two: platform-security events already land in
`platform_audit_log` (the ban tripwire in `src/server/auth/index.ts` and the platform console's
self-auditing endpoints, retention-pruned by the weekly cron), while the tenant trail this stage
feeds also serves `listEntityHistory`, a per-entity capability the reference does not have. The
tenant-security events still missing — member role change, invitation, removal — cannot be audited
here because `changeMemberRole`, `createInvitation` and `removeMember` have no production caller
yet, measured (`changeMemberRole` gained one, and its `member.role_changed` entry, in #995;
#1008 adds the production `removeMember` path with atomic `member.removed`/`member.left` audit entries);
each gains its audit write in the stage that ships its write path (the ADM/ACC
rows), and trip lifecycle audits ride TRP-03. Of the three call sites below,
`workspace.defaults_changed` has direct reference parity; the file and reservation events are the
entity-history half.

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
which is precisely backwards. Growth is bounded instead by `pruneAuditLog(scope, now)`, which
derives the 400-day retention cutoff internally and runs in bounded tenant-scoped batches from
the weekly retention slot (#1064). Nothing is added to `resolveLimits()`,
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

One constraint travels with the unblock, and `ADD-06` inherits it: most of the row's ten figures are
workspace-wide rather than per-traveller, and _how many_ depends on which row is being read — seven
of ten on the all-time row, eight of ten on a year row, because `countryCount` changes sides between
them. The measurement and what it forces on the panel's labelling are under **Server** below, and the
row's copy is bound by it. The distance figure — decided during grilling — is derived from transport
legs and is workspace-scoped on both row kinds; its labelling is bound under **Server** below.

### Owned paths

- `src/server/queue/handlers/travel-stats.ts` — new. Recomputes one traveller's rows.
- `src/server/queue/handlers/__tests__/travel-stats.test.ts` — new.
- `src/server/repos/atlas.ts` — edit. `recomputeTravelStats` gains the distance aggregate decided
  during grilling: `SUM(transports.distance_metres)` under `tenantFilter()`, year rows filtered by
  the year of `departure_date`. No other function in the module changes, and no other wave-0 stage
  names this file.
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

**Amended in the grilling of `01-trips-core.md` (2026-08-28, decision 9): the trip-derived figures
are scoped by trip membership, not by the workspace.** That grilling made a trip private to its
members unless it opts into workspace visibility (ADR 0007), and a private trip's places, days,
countries and spend must not appear in the statistics of a person who cannot open the trip. So the
`tripRows` predicate in `recomputeTravelStats` — and with it `tripCount`, `dayCount`, `placeCount`,
`cityCount`, `spendMinor`, the year-row `countryCount`, `currency`/`lastTripId`, the year streak and
the transport-leg distance — gains one `EXISTS` on `trip_members` for the row's `user_id`, so every
figure on a person's row answers "the trips I am a member of", which is also what a traveller means
by "my trips". The measurements in the bullets below describe the code as it stands at HEAD and are
kept because they are true of HEAD; where a bullet says a figure is "workspace-wide" or "identical
for every member", read it as the state this stage **changes**, and `ADD-06`'s labelling — "your
trips", never "the workspace's" — follows the amended scope. Two consequences: the recipient set of a
trip write's `travel-stats` envelopes is the **trip's members** (which `01-S1` sends), and a
membership change (`01-S6`) is itself a statistics write and enqueues the envelope for the person
added or removed.

- **What the row actually aggregates, measured — the stage's premise depends on getting this
  right.** `recomputeTravelStats(scope, userId, statYear)` (`src/server/repos/atlas.ts:792-896`)
  writes one row keyed `(organization_id, user_id, stat_year)` — the unique index at
  `src/server/db/schema.ts:1708` — but the row being per-traveller does not make its contents
  per-traveller. Read the predicates: `tripCount` (`atlas.ts:813`), `dayCount` (`:821-823`),
  `placeCount` (`:827-831`), `cityCount` (`:834-838`), `spendMinor` (`:841-844`) and the
  `currency`/`lastTripId` lifted from `tripRows[0]` (`:892-893`) are bound by `tenantFilter()` and by
  nothing else, so every member of a workspace gets the same seven numbers on every row.
- **The remaining three do not split cleanly, and the exception is the one an implementer will get
  wrong: `countryCount` is per-traveller on the all-time row and workspace-scoped on a year row.**
  Measured at `atlas.ts:889`, the field is `yearCodes === null ? countries.length : yearCodes.size`.
  On the all-time row (`statYear = 0`) `yearCodes` is `null` and the figure is the length of
  `listVisitedCountries(scope, userId)` (`:845`), which is the traveller's own list. On a year row
  `yearCodes` is the set built at `:860-867` from `trips.country_codes` over `tripRows`, and
  `tripRows` (`:805-814`) is `tenantFilter()`-bound and carries no `userId` predicate — so a year's
  country count is the workspace's distinct countries for that year and is byte-identical for every
  member. `byContinent` is per-traveller on both kinds: it is built at `:869-880` from
  `scopedCountries`, which is the traveller's visited list, intersected with `yearCodes` on a year
  row. `regionCount` (`:890`) is per-traveller on the all-time row and belongs to no year at all,
  which is the property worth stating because the panel will otherwise print it as a yearly figure.
  _Amended by #139:_ this stage measured it as a lifetime figure repeated unchanged on every year
  row, and the recompute now writes it onto the all-time row only — a year row carries an explicit
  `0`. The reading `ADD-06` is bound to is unchanged; what changed is that the stored column no
  longer contradicts it.
- **What that leaves, and what it binds `ADD-06` to.** The per-traveller set is
  `{countryCount, regionCount, byContinent}` on the all-time row and `{byContinent}` on a year row —
  `regionCount` left that set with #139 and is a constant `0` on a year row. The switch is
  deliberate and the repository argues it in place at `atlas.ts:848-859`:
  reading the lifetime visited list for a year row printed the same total on every year — "2026: 12
  countries, 2025: 12 countries, 12 all time" — which reads as a broken aggregate rather than as a
  history, and the year's own trips already name their countries. `atlas.ts:366-370` makes the
  matching argument for the per-country trip tally: a figure filtered by trip membership would not
  sum to the workspace trip count printed above the map, and two figures on one panel that disagree
  read as a bug rather than as a distinction. The stage adopts both readings rather than fighting
  them, and `ADD-06`'s copy is bound accordingly: the seven always-workspace figures are labelled as
  the workspace's and never as "your trips"; a year row's country count is labelled the same way;
  only the all-time row may say "countries you have visited"; and a year row's region line either
  carries a lifetime qualifier or is dropped from year rows, because "regions in 2026" is a number
  this repository does not compute.
- **Repository.** No new SQL. `recomputeTravelStats` already rebuilds the row from five aggregate
  queries, and `upsertTravelStats` (`atlas.ts:764-786`) already writes it through `definedOnly`, so
  a field the recompute omits keeps its stored value instead of resetting to zero.
- **Two columns the recompute cannot derive, and what happens to each.** `travel_stats.year_streak`
  and `travel_stats.distance_metres` (`schema.ts:1702`, `:1698`) are accepted by
  `upsertTravelStatsInput` (`atlas.ts:130`, `:127`) and never passed by `recomputeTravelStats`. The
  seeder states this in its own words at `src/routes/api/dev/-seed/dataset/workspace.ts:216` and
  writes them in a second call (`src/routes/api/dev/-seed/apply.ts:603-604`). Because
  `upsertTravelStats` uses `definedOnly`, both survive every recompute at their seeded value, which
  is exactly how a frozen number hides behind numbers that move. The streak is therefore derived in
  the handler: read the year rows with `listTravelStats(scope, userId)` (`atlas.ts:742-750`), count
  consecutive years with a non-zero `tripCount` back from the newest, and pass the result as
  `yearStreak` on the all-time upsert. That needs no repository edit, because the input already
  accepts the field. It is a **workspace** streak, and `ADD-06` labels it as one: a year row's
  `tripCount` is `tenantFilter()`-bound and identical for every member, so consecutive years of
  travel are the workspace's consecutive years, not the traveller's. `distance_metres` — the
  original draft reported it sourceless; re-measured during grilling, the source exists:
  `transports.distance_metres` (`schema.ts:867`) is written by the leg form
  (`src/server/fns/transports.ts:116`, `0` normalised to `null`) and `departure_date` supplies the
  year predicate. The recompute therefore derives it: a sixth aggregate in `recomputeTravelStats`,
  `SUM(transports.distance_metres)` bound by `tenantFilter()` and nothing else — a **workspace**
  figure on both row kinds, like the seven above — with the year row summing legs whose
  `departure_date` falls in that year, and a null sum written as `0`, so a seeded value is replaced
  by truth rather than hiding behind it. The figure is the sum of distances travellers chose to
  record, and `ADD-06`'s label is bound to say so — "distance recorded on transport legs", never
  "distance travelled". Deriving a distance for legs that carry coordinates but no recorded figure
  is deliberately not done here; that decision rides the MAP-08 routing choice, which will produce
  segment distances anyway.
- **Why a queue and not inline.** Five aggregate queries on a busy tenant is exactly the shape
  `ARCHITECTURE.md` §5 sends to `TASKS`. The atlas write functions enqueue one `travel-stats` task
  and return; the map updates optimistically as it does today, and the panel catches up on its next
  read. The envelope id is deterministic per user and year, so a burst of country toggles collapses
  rather than fanning out.
- **Measured obstacle, and its fix.** `TaskBindings` in `src/server/queue/types.ts:234-281` declares
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
  two change an input of the stat row, and only through `visited_countries`: on the all-time row that
  moves `countryCount` and `byContinent`, and on a year row it moves `byContinent` alone, since a
  year's `countryCount` comes from `trips` and not from the visited list. `bucket_list_items` feeds
  no column of `travel_stats` (`schema.ts:1684-1712`), so the two bucket-list functions enqueue
  nothing; enqueueing from them would buy a consumer invocation whose only measurable effect is cost.
  The two visited-country functions enqueue the all-time roll-up (`statYear = 0`) and, when the write
  carries a `visitedOn` date, that date's year — the year envelope is still worth sending, because
  the year row's continent breakdown is exactly what that write changed.
- **The workspace figures move on writes this stage does not own, and that is stated rather than
  hidden.** A trip, day, place or expense write changes `tripCount`, `dayCount`, `placeCount`,
  `cityCount` and `spendMinor` for _every_ member's row at once — and a trip write that changes
  `trips.country_codes` or `trips.start_date` also moves every member's year-row `countryCount`, by
  the derivation at `atlas.ts:860-867`. A transport-leg write moves the `distanceMetres` sum the
  same way. Those write paths belong to `01-trips-core.md`, `04-budget-and-currencies.md` and
  `03-reservations-and-transport.md`. This stage does not reach into them. It ships
  the task kind, the handler and the deterministic envelope id so that those plans enqueue one task
  per affected **trip member** and year (decision 9 above), and it records the requirement here so
  neither plan invents a second recompute. The deterministic id is what keeps that fan-out affordable: repeated envelopes for the
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

Run the recompute in A's scope with a user id that belongs only to B — twice: once for the all-time
row (`statYear = 0`) and once for a year in which A's own trips have `start_date` and non-empty
`country_codes`. Both rows are written under A's organization, never under B's, and B's own stats
rows are unchanged — that is the isolation claim, and it is asserted whole. The rows' _contents_ are
asserted in three parts, because a blanket "zero counts" assertion is unsatisfiable and would fail on
its first run, and because the per-traveller set is not the same on the two row kinds:

- per-traveller on **both** row kinds — `byContinent` is empty, and `regionCount` is zero on the
  all-time row, because `visited_countries` and `visited_regions` are filtered by organization
  **and** user, so B's rows are invisible from A's scope. _Amended by #139:_ the year row's
  `regionCount` is zero too, but it is no longer evidence of isolation — a year row carries a
  constant `0` whatever the traveller visited — so that one assertion is kept as a statement of the
  year-scoping rule and labelled as such in the test, not counted toward the isolation claim;
- `countryCount` is asserted **per row kind**, and this is the assertion the intuitive reading gets
  wrong. On the all-time row it is zero, because it is `countries.length` over B's invisible visited
  list. On the year row it equals the number of distinct upper-cased codes across A's own trips that
  started in that year (`atlas.ts:860-867`, `:889`) and is therefore **non-zero by construction** —
  it is derived from `trips`, which is `tenantFilter()`-bound only. Asserting zero there is the
  assertion that cannot pass, and it is named here so that nobody writes it and then edits the
  repository to make it pass;
- the eight always-workspace figures — `tripCount`, `dayCount`, `placeCount`, `cityCount`,
  `spendMinor`, `currency`, `lastTripId`, and the `distanceMetres` sum decided during grilling —
  equal A's own row for the same `statYear`, because they are `tenantFilter()`-bound only.
  Asserting them equal to A's row rather than to zero is what makes the test express the real
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
  recompute replaces a seeded `distance_metres` with the measured sum — legs with a recorded
  distance sum into the all-time row and their `departure_date` year's row, a leg with no recorded
  distance contributes nothing, and a workspace with none writes `0` rather than preserving
  fiction; a user who is no
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

- None. The distance blocker the original draft carried here is withdrawn: re-measured during
  grilling, `transports.distance_metres` exists with a shipping write path, and the recompute now
  derives the figure as described under **Server**. What remains deferred — deriving a distance for
  legs whose coordinates are recorded but whose distance is not — is not a blocker of this stage; it
  rides the MAP-08 routing decision that `11-boundaries-and-blockers.md` holds open.

## Stage 00-S5 — Reminder scheduling

### Stage id

`00-S5` · Wave 0 · effort **M**. The fourth unwritten write path. Within wave 0 it closes after
`00-S2` (it dispatches through that stage's module) and after `00-S4` (whose `TaskBindings` edit
gives the queue surface its `DB` handle) — recorded under **Blockers**, because wave-0 stages are
otherwise unordered.

### Reference rows

Closes none. It supplies the write half of `TRP-04` (`01-trips-core.md`, wave 6) — pre-departure
reminders with the 1/3/9-day presets and a custom 1–30-day choice anchored to the trip's start date —
which keeps the row and owns the preference UI.

Measured, then re-decided during grilling. `src/server/queue/reminders.ts` ships a complete
schedule-at-write design — a KV index keyed by a 13-digit due time, `scheduleReminder` and
`cancelReminder`, and a sweep wired to the `*/15 * * * *` cron at `src/server/worker.ts:65` — and
none of it has ever fired: `scheduleReminder` and `cancelReminder` have zero callers, so the sweep
runs every fifteen minutes over an empty index. The original draft of this stage gave that design
its callers. Grilling replaced the design, for three measured defects the draft had inherited rather
than chosen:

- the KV record froze its recipients' e-mail addresses at scheduling time (`reminderRecordSchema.to`,
  `reminders.ts:25-34`), so a member added after the trip was created would never be reminded, a
  member who left still would be, and a preference changed between scheduling and firing was ignored;
- the sweep produced `email` tasks only — no in-app row, bypassing the dispatch module `00-S2`
  builds and the preference matrix ACC-05 will ship, of which the trip reminder is a row;
- the cancel/re-schedule machinery — orphaned-key hazards, a `previous` anchor threaded through
  every future edit path, a standing cross-plan obligation on TRP-03 — existed only to avoid a
  periodic D1 scan that is cheap.

The reference product runs the scan model: a daily pass over trips whose start date is
`reminder_days` ahead, delivered through the ordinary notification pipeline, where an edited trip
needs no cancellation because the next pass simply sees the new dates. This stage ships that model.

`trips.reminder_days` exists at `src/server/db/schema.ts:547`, `NOT NULL DEFAULT 3`, with a
non-negative CHECK — the preference is already stored and already ignored. No new column is needed:
sent-state lives in a self-expiring KV marker, decided during grilling and described under **Data
and migration**.

Rows unblocked: `TRP-04` directly.

### Owned paths

- `src/server/catalog/reminders.ts` — new. The cross-tenant scan for due trips. Raw SQL is
  sanctioned here and only here: `server/catalog` is the single stated exception to the
  scoped-repository rule, and the precedent is `prunePlatformAuditLog` in
  `src/server/catalog/audit.ts`, the other cron-driven cross-tenant reader.
- `src/server/queue/reminders.ts` — rewrite. `reminderKey`, `scheduleReminder`, `cancelReminder`,
  `dueReminders` and the record schema are removed with the design that needed them — measured,
  nothing in `src/` imports them. The module keeps its name and the one export the worker already
  calls, `sweepReminders(bindings, logger, scheduledTime)`, rebuilt as described under **Server** —
  so `src/server/worker.ts`, a shared file this stage may not own, needs no edit.
- `src/server/queue/__tests__/reminders.test.ts` — new. No test file covers the module today,
  measured.
- `src/server/repos/__tests__/tenant-isolation.test.ts` — append. The case under **Tenant isolation
  test** below, as one new `describe` block, under the append-only exception in the tenant procedure
  above.

Gone from the original draft, deliberately: `src/server/queue/reminder-sync.ts` (there is nothing to
sync), the edit to `src/routes/_app/-server/overview.ts` (creation schedules nothing — the next scan
sees the new trip on its own), and the TRP-03 cross-plan obligation (an edited, archived or deleted
trip needs no cancellation; the next scan sees the row as it now is, and a deleted trip is simply
absent).

### Data and migration

None. The scan reads `trips` columns that already exist (`start_date`, `reminder_days`), and
sent-state is a KV marker, not a column: `reminded:<orgId>:<tripId>:<dueInstant>`, written after a
successful dispatch, with an `expirationTtl` of ~30 days. A moved start date yields a new due
instant, hence a new key, hence a fresh reminder — the reference behaves the same way — while a
re-tick inside the window finds the marker and skips. KV's eventual consistency (~60 s) against a
15-minute tick is not a real double-send window, and the e-mail handler's deterministic idempotency
key is the second layer. No column, no index, no migration.

### Server (repo, server function, Zod)

- **The scan, in `src/server/catalog/reminders.ts`.** `dueTripReminders(db, now)`: one query over
  `trips` — `start_date IS NOT NULL AND reminder_days > 0 AND is_archived = 0`
  (`src/server/db/schema.ts:548`; an archived trip is not reminded, which the retired design needed
  a cancel call to achieve) with `start_date` in the `[date(now), date(now) + 31 days]` range, an
  indexed range over the column TRP-04's 1–30-day ceiling bounds — then the due instant is computed
  in code as 08:00 UTC on
  `start_date − reminder_days` and filtered to `dueAt ≤ now < dueAt + 24h`. The 24-hour grace bound
  means a dead cron loses at most reminders older than a day rather than re-sending history.
  Returns `{ tripId, organizationId, dueAt }` rows only — no addresses, no member data, nothing a
  stale copy could mis-send.
- **Why the anchor is 08:00 UTC, restated.** `trips` carries no timezone column, so a per-trip local
  anchor is not expressible; 08:00 UTC lands in the morning across Europe and before midday in the
  Americas, and a reminder hours early is harmless while one after departure is worthless.
  `reminder_days = 0` means no reminder, honoured by the scan's `reminder_days > 0` predicate. The
  anchor function is exported from the catalog module, pure and deliberately not time-dependent, and
  it is what every test asserts the due instant against.
- **The sweep.** `sweepReminders` reads the due rows, and per trip: checks the KV marker and skips
  when present; resolves the trip's **owner membership** and builds a scope from it — the `00-S4`
  handler pattern, `getMembership` then `createScope`, a real member and never a synthetic
  principal, so every repository contract holds unchanged; hands `00-S2`'s dispatch a system event —
  no actor, so nobody is excluded — carrying the trip reference and the due instant; and writes the
  marker only after dispatch returns. A trip whose owner membership is gone falls back to any
  current member; a trip with no members is skipped, because there is nobody to remind. Recipients,
  channels and preferences are wholly dispatch's business, resolved fresh at fire time: in-app rows
  for everyone not opted out, one e-mail envelope per e-mail-enabled recipient, chunked under
  `00-S2`'s bounds.
- **Idempotency across the pair.** The dispatch envelope ids carry the due instant —
  `notify:trip.reminder:<tripId>:<dueInstant>:<recipientUserId>` — so a reminder re-sent for a
  postponed trip is a new id and a redelivered one is a no-op. The KV marker dedupes the tick; the
  envelope id dedupes the queue.
- **Failure isolation.** A failing trip logs once with `serializeError` and does not fail the sweep
  for the remaining trips; its marker stays unwritten, so the next tick inside the grace window
  retries it. A KV failure degrades to the queue-level idempotency rather than blocking the tick.
- **Zod.** The catalog row and the system event are `z.strictObject()` with the `error` parameter.
  Nothing here accepts client input at all: the scan is a cron, the event is server-built, and the
  preference UI that writes `reminder_days` belongs to TRP-04.
- **Authorisation.** The scan is the sanctioned catalog exception and reads only scheduling fields.
  Everything member-shaped happens inside a real member's scope, `tenantFilter()`-bound; a forged
  marker key could at worst suppress a reminder inside its own organization, never send one across
  tenants.

### UI (route, components)

None. The reminder preference control belongs to `TRP-04`, and the trip edit surface that would
carry it belongs to `TRP-03` — which, after the redesign, owes this stage nothing: no anchor
threading, no cancel call. No new route file, so `pnpm generate-routes` is not run. No new token, no
new primitive.

### Quota

**Creates no quota-bearing row, explicitly.** A reminder is a dispatch through `00-S2`, whose
fan-out bounds already govern it, plus one KV marker per fired reminder — self-expiring, and bounded
by trips with a near-future start date; trips are already a metered metric, so metering reminders
would meter the same thing twice. Nothing is added to `resolveLimits()`, nothing to `PLAN_QUOTAS`,
no case to `src/server/billing/__tests__/limits.test.ts`.

Cost, measured against `ARCHITECTURE.md` §8: one indexed D1 range scan per 15-minute tick —
rows-read proportional to trips starting in the next month, not to tenants — plus one KV read and at
most one KV write per due trip. At ten users that is nothing; at ten thousand it is still one query
whose result set tracks near-future travel, which is the quantity the product exists to hold.

### Tenant isolation test

Added to `src/server/repos/__tests__/tenant-isolation.test.ts`: seed a due trip in A and a due trip
in B; run the sweep once. Every in-app row produced for A's trip carries A's organization id and is
invisible from B's scope — `requireById` from B is `NotFoundError` — and symmetrically for B's. The
scope the sweep builds for A's trip belongs to A's owner member, so `notifyMany` under it can only
write under A, which is the assertion that the sweep's per-trip scope construction cannot leak.
Functions covered: `sweepReminders`, `dueTripReminders`, and through dispatch `notifyMany`,
`filterEnabledRecipients` and `getMembership`.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Unit tests in `src/server/queue/__tests__/reminders.test.ts`, against an in-memory KV double and a
  stubbed dispatch: the anchor function puts the due instant at 08:00 UTC on
  `start_date − reminder_days`; a trip due in the window dispatches once and writes its marker; a
  second tick in the same window dispatches nothing; moving the start date produces a new due
  instant and a second dispatch under a new envelope id; `reminder_days = 0` and a null `start_date`
  never surface from the scan; a due instant older than the 24-hour grace is skipped; a trip with no
  members is skipped without a marker — deliberate: the next window re-evaluates it, and membership
  arriving later revives it; an archived trip never surfaces from the scan; a dispatch failure
  leaves the marker unwritten and does not fail the sweep for the next trip; a KV failure does not
  fail the tick.
- One test across the catalog seam: `dueTripReminders` against a database holding due trips in two
  organizations returns both organizations' rows — it is the one sanctioned cross-tenant read — and
  returns scheduling fields only.
- Browser evidence: `/notifications` and the shell bell at 360px and 1440px, in light and dark,
  photographed after a seeded due trip's sweep tick — the state that is the point is a reminder row
  produced by the cron path through the same centre `00-S2` lights up. The trip creation dialog is
  no longer part of this stage's evidence: creation runs no reminder code.
- Console must be silent.

### Definition of done

The six items from `docs/SPEC.md` §7 apply unchanged, as listed in `00-S1`.

The `SPEC.md` §2 clauses are ticked against the notification centre rendering a reminder row — the
only surface whose content this stage changes:

- [ ] Spacing on the 4px grid from `--space-*`.
- [ ] Hover, focus-visible, active, disabled and loading on every interactive element of the
      reminder row, including its mark-read control mid-request.
- [ ] Empty, skeleton and error states unchanged and still reachable.
- [ ] Motion 150–260ms on `--ease-out-quint` or a sibling, transform and opacity only,
      `prefers-reduced-motion: reduce` honoured.
- [ ] Light and dark parity with dark shadows re-declared.
- [ ] 360px to 2560px, small designed rather than squeezed.
- [ ] Keyboard reachable end to end, WCAG 2.2 AA in both themes.
- [ ] Zero console errors or warnings, zero layout shift after paint.

### Blockers

- **E-mail delivery needs `EMAIL_API_KEY`.** The `email` handler is written; without the secret it
  declines loudly. Not a blocker for the in-app half, which now fires for reminders too.
- **No per-trip timezone column exists.** The 08:00 UTC anchor is the stated consequence. Changing
  it later is an additive column and a changed anchor function, not a rewrite.
- **Intra-wave ordering.** This stage lands after `00-S2` (its dispatch module and the
  optional-actor event contract) and after `00-S4` (the `DB` handle on `TaskBindings`).

## Stage 00-S6 — Wave-0 follow-up schema stage: the per-person favourite

### Stage id

`00-S6` · Wave 0 · effort **S**. Minted by the stage register above after `00-S1` had closed, for the
one requirement filed too late for it (decision 5 of the grilling of `01-trips-core.md`,
2026-08-28). It owns `src/server/db/schema.ts` and `drizzle/` until it closes, and it is the last
wave-0 stage: wave 1 does not open before it lands.

### Reference rows

Closes none. It supplies the table `01-S1` (`01-trips-core.md`, wave 1) writes and `01-S7` (wave 5)
reads: a favourite is one person's bookmark on a trip they may read, private to that person
(`CONTEXT.md`, **Favourite**). The reference product has no trip favourite at all; ours existed as
`trips.is_favourite`, one flag shared by every member, which the grilling found to be the wrong shape
and which this stage leaves in place, dead and documented, because dropping a column is a table
rebuild on SQLite.

Rows unblocked: `TRP-03` (`01-S1`) directly — it cannot open without this table.

### Owned paths

- `src/server/db/schema.ts` — append. One new table, `tripFavourites`, added at the end of the trips
  cluster, and a doc comment on `trips.isFavourite` saying the favourite lives in `trip_favourites`
  from `01-S1` on and that the column is written and read by nothing. Nothing existing is reshaped.
- `drizzle/` — append. New files only: the generated migration (`0007` at HEAD) and its snapshot, plus
  the journal entry. `0000` through `0006` are not touched.

**Why `append` and not `edit`, stated so the checker's answer is read correctly.** `00-S1` claims both
paths exclusively in wave 0 and has **closed** — its migration is `drizzle/0006_mighty_nehzno.sql` on
`develop` — so the two stages never run together; `scripts/ultrabuild/check-plan-collisions.mjs` cannot
see closure and would report the pair as a same-wave clobber. The claims are therefore written as the
cooperative disposition, which is also what they are in fact: one table appended to a module nobody
else has open, and new files in a directory nothing rewrites. The register's rule — one owner of the
schema module per wave — holds in time: `00-S1` until it closed, `00-S6` from then until wave 1 opens.

No repository module, no server function, no test file: the module that reads and writes the table is
`src/server/repos/trip-favourites.ts`, owned by `01-S1`, and its isolation cases are `01-S1`'s. A
table with no reader is exactly what a schema stage ships.

### Data and migration

One migration, at the next free number (`0007` at HEAD), additive, generated not hand-written.

`trip_favourites`, following the conventions every existing domain table follows:

| Column            | Type                   | Null     | Notes                                            |
| ----------------- | ---------------------- | -------- | ------------------------------------------------ |
| `id`              | `text` PK              | not null | `pk()`, `newId()` default                        |
| `organization_id` | `text`                 | not null | `orgRef()`, `ON DELETE CASCADE`                  |
| `trip_id`         | `text` → `trips.id`    | not null | `ON DELETE CASCADE`                              |
| `user_id`         | `text`                 | not null | `userRef()`, no Drizzle FK, as every user column |
| `created_at`      | `integer` timestamp_ms | not null | `timestamps()`                                   |

Indexes: `trip_favourites_org_user_idx` on `(organization_id, user_id)` — leading `organization_id`,
as every composite index in this schema does, and the read the trip list makes — and
`trip_favourites_trip_user_unq`, unique on `(trip_id, user_id)`, so a double click cannot write two
stars. No `CHECK`: there is no enum column. Backfills nothing: the shared flag was never a person's
choice, so there is nothing true to copy from it. A rollback is safe because the previous Worker never
reads the table.

### Server (repo, server function, Zod)

None. Stated rather than skipped: the writer, the reader and their Zod inputs are `01-S1`'s, in
`src/server/repos/trip-favourites.ts`, and are specified there.

### UI (route, components)

None. No route, no component, no token; `pnpm generate-routes` is not run.

### Quota

Creates no countable row. A favourite is a bookmark on a trip the tenant already pays for; nothing is
added to `resolveLimits()` or `PLAN_QUOTAS`, and no case to `src/server/billing/__tests__/limits.test.ts`.
Its cardinality is bounded by members times trips, both of which are already bounded.

### Tenant isolation test

None in this stage, because it adds no repository function. `01-S1` appends the `describe` block that
covers `trip-favourites.ts` to `src/server/repos/__tests__/tenant-isolation.test.ts` and the per-person
cases to its `member-isolation.test.ts`, in the wave the functions exist.

### Verification

- Gate, in order: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`.
- Migration review is part of the gate and is not optional: read the file `pnpm db:generate` just
  wrote (the next free number — `0007` at HEAD) and confirm it is one `CREATE TABLE trip_favourites`
  and two `CREATE INDEX` statements, that no `__new_` rebuild of any table appears, that no `DROP`
  appears, and that `drizzle/meta/_journal.json` gained exactly one entry. Then
  `pnpm db:migrate:local` and confirm it applies against a database that already carries `0000`–`0006`.
- Unit tests: none added — there is no logic. `pnpm test` must still pass in full, which is what proves
  the schema module still typechecks against every existing repository.
- Browser evidence: none, and the reason is that nothing renders differently. The trips index is
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

None. No package, no binding, no third-party service. **Intra-wave ordering:** this stage opens after
`00-S1` has closed (it has — `drizzle/0006_mighty_nehzno.sql`) and must close before wave 1 opens,
because `01-S1` writes the table on its first day.
