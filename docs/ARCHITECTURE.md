# planned.travel — Architecture

Engineering companion to `docs/SPEC.md` (product contract) and `docs/DESIGN.md` (visual
contract). This document describes what is actually deployed: one Cloudflare Worker, the
bindings it holds, where every millisecond and every cent goes, and the specific levers that
take the system from the 10-user first release to five figures of users without a rewrite.

Cloudflare list prices and platform allowances quoted here were taken from
`developers.cloudflare.com/workers/platform/pricing/` in **August 2026**. Re-check them before
committing to a budget; the shape of the model outlives the numbers.

Billing is **Polar.sh**, which is Merchant of Record. The Stripe path still mounted in
`src/server/billing/**` and at `/api/stripe/webhook` is superseded and is replaced wholesale in
**phase A**; wherever this document names a billing route, a webhook or a provider behaviour it
describes the Polar one (`docs/SPEC.md` §1 and §3, `docs/DEPLOY.md` §6 and §9).

---

## 1. Shape of the system

```
                    ┌──────────────────── Cloudflare edge (300+ PoPs) ────────────────────┐
  Browser ────────► │  TLS · HTTP/3 · zone cache · static assets (free, never billed)     │
                    └──────────────────────────────┬─────────────────────────────────────┘
                                                   │ cache miss / dynamic
                                    ┌──────────────▼──────────────┐
                                    │  Worker: planned-travel     │
                                    │  TanStack Start SSR         │
                                    │  + server functions         │
                                    │  + /api/* route handlers    │
                                    │  placement: smart           │
                                    └──┬───┬───┬────┬────┬────┬───┘
                                       │   │   │    │    │    │
                     D1 ◄──────────────┘   │   │    │    │    └──────────► Queues (TASKS)
                     (relational, primary) │   │    │    │                  └─► consumer
                     KV (cache) ◄──────────┘   │    │    └──► R2 FILES         (same Worker)
                     KV (SESSIONS) ◄───────────┘    │         R2 TILES
                                                    └──► Durable Object TripRoom (one per trip)
```

One Worker serves everything: marketing pages, the authenticated app, server functions, the
Better Auth endpoints, the billing webhook, the tile endpoint, the queue consumer and the cron
triggers — three registered today, a fourth from phase D (§2.4). There is no second service to
keep in step, and no cold-start tier: every request runs in V8 isolates that are already warm at
the PoP that answered the TLS handshake.

`placement: smart` is set in `wrangler.jsonc`. A request that makes five sequential D1 calls
pays the Worker→D1 round trip five times; Smart Placement moves the isolate close to the D1
primary so those five hops are LAN-local and the user pays one WAN crossing instead of five.
It is the single biggest latency lever for the authenticated app, and it costs nothing.

---

## 2. Request lifecycle

### 2.1 A document request (`GET /trips/abc/plan`)

1. **Edge.** TLS terminates at the nearest PoP. Static assets (`/assets/*`) are served from
   the assets store and are never billed and never invoke the Worker.
2. **Worker entry.** `main` is `@tanstack/react-start/server-entry`. TanStack Start matches the
   file route from `src/routeTree.gen.ts` and runs the route chain.
3. **Session.** The auth layer reads the session cookie and resolves it against the `SESSIONS`
   KV namespace (`src/server/auth/secondary-storage.ts`). A KV hot read at the edge is
   sub-millisecond and costs one KV read, versus a D1 round trip plus a row read.
4. **Tenant context.** `src/server/auth/tenant-context.ts` resolves the active organization and
   membership, producing the `TenantScope` that every repository call requires.
5. **Loaders.** Route loaders call server functions in `src/server/fns/**`, which validate input
   with Zod and call repositories in `src/server/repos/**`. Repositories are the only place SQL
   exists; each one filters on `organization_id` from the scope it was handed.
6. **Render.** React 19 renders to a stream. The HTML shell flushes before loaders settle, so
   first paint does not wait on the slowest query.
7. **Response.** The structured logger emits one JSON line per request (`requestId`, `route`,
   `method`, `durationMs`, `outcome`) into Workers Observability, sampled at 100%.

Budget for a warm authenticated document request: **~12 ms CPU**, 1 KV read, 3–8 D1 queries
(batched where they are independent), one 200 with a streamed body.

### 2.2 A server function call (`POST /_serverFn/...`)

Same path from step 3, minus rendering. Mutations follow one shape: validate → `assertQuota`
→ write D1 in the smallest possible transaction → invalidate the KV cache keys the write
touched → enqueue anything slow → return the new state. Budget: **~4 ms CPU**, 1 KV read,
1–4 D1 statements.

### 2.3 A tile range request (`GET /api/tiles/basemap.pmtiles`, `Range: bytes=…`)

Implemented in `src/routes/api/tiles/$.ts` and `-lib/`. MapLibre reads a Protomaps archive by
issuing hundreds of small range requests against one multi-gigabyte object, so this path is
built to never pay R2 twice:

1. Validate the key (`-lib/archive.ts`). Only `[A-Za-z0-9][A-Za-z0-9 ._,@()-]*` segments, at
   most 6 deep, 512 bytes total, with a known map-data extension, resolve at all. Everything
   else is a 404 that never touches the bucket.
2. Resolve the archive. `basemap.pmtiles` is an alias for the `TILES_ARCHIVE_KEY` var; any
   other path is used as the R2 key verbatim.
3. Load object metadata (size + entity tag) from the Cache API, falling back to one R2 `head`.
   This is what makes a _new_ range cheap: the size is needed to clamp an open-ended or suffix
   range and to answer `If-None-Match`, and without the cached metadata every range would cost
   a `head` on top of its read.
4. Answer conditionals before reading bytes: `If-None-Match` → 304; `HEAD` → 200 with
   `Content-Length` (RFC 9110 §14.2 defines range handling for `GET` only, so `Range` on `HEAD`
   is ignored); stale `If-Range` → downgrade to a full 200.
5. Parse and resolve the range set (`-lib/range.ts`): clamp to the object size, drop specs that
   start past the end, 416 with `Content-Range: bytes */size` when none survive, coalesce
   overlapping and adjacent intervals, reject more than 8 specs (§14.2 permits this) and
   multi-range sets over 8 MiB.
6. Look up the coalesced range in the Cache API. Key:
   `/api/tiles/<resolved key>?__bytes=<start>-<end>[,…]`. A hit returns the bytes with
   `x-tiles-cache: hit` and no R2 op at all. Because ranges are coalesced _before_ they become a
   cache key, `bytes=0-99,50-149` and `bytes=0-149` share one entry.
7. On a miss, read from R2 (one `get` per coalesced interval), respond 206 with `Content-Range`
   — or `multipart/byteranges` for a true multi-range set — and write the slice back to the
   cache in `waitUntil` if it is ≤ 24 MiB.

Budget for a cache hit: **~1.5 ms CPU**, zero R2 operations. Full archives above 24 MiB stream
straight through from R2 and are never cached, so a rogue full-archive request cannot evict the
slices that matter.

### 2.4 Realtime, background and scheduled paths

- **WebSocket upgrade** → `TRIP_ROOM` Durable Object, one object per trip (§5).
- **Queue producer** → `src/server/queue/jobs.ts` writes a validated, idempotency-keyed
  envelope to `TASKS`; the consumer batches 10 messages with a 5 s timeout, 5 retries, 10 s
  retry delay, and a dead-letter queue.
- **Billing webhook** → `/api/polar/webhook` from phase A; until then the mounted route is the
  superseded `/api/stripe/webhook`. The shape does not change with the provider: verify the
  `v1,` signature on WebCrypto — HMAC-SHA256 over `{webhook-id}.{webhook-timestamp}.{raw body}`,
  with the 300 s timestamp tolerance §9 states — then claim `webhook-id` in `KV`, make one small
  inline D1 write, enqueue everything else to `TASKS`, and return 200. Nothing that calls a
  third party or writes more than one row happens inline (`docs/DEPLOY.md` §9.5 and §9.7).
  That is the target shape, not a description of the mounted handler, which breaks the rule
  on one event; the note under the §9 table says where and why.
- **Cron** → three triggers are registered in `wrangler.jsonc` today: `*/15 * * * *` reminder
  sweep, `0 3 * * *` nightly D1 export to R2, `17 4 * * 1` weekly retention prune. The `staging`
  environment overrides that list with `0 3 * * *` alone. A fourth, `0 4 * * 1` for the weekly
  catalogue scrape, is registered in **phase D** — in the top-level `triggers.crons` list _and_
  in the `env.staging` override, because a deploy replaces the whole array — and is deliberately
  absent from `wrangler.jsonc` and unwired in `src/server/worker.ts` until its
  `switch (controller.cron)` branch exists (`docs/SPEC.md` §5). It is unrelated to the
  `17 4 * * 1` prune that runs seventeen minutes later the same morning.

### 2.5 The three paths beside the tenant repository

`src/server/repos/**` is the tenant-scoped path §2.1 and §2.2 take, and it remains the only
place tenant SQL lives. `docs/SPEC.md` §6 puts three siblings beside it, each with its own
entry rule. None exists on disk yet; each lands with its phase.

- `src/server/catalog/**` (phase C) — the global catalogue tables. They carry no
  `organization_id`, so they cannot pass through a tenant repository at all, which is why this
  is the single stated exception to the SQL rule. Its SQL is guarded instead by an explicit
  platform actor, `requirePermission`, and a `platform_audit_log` write in the same call.
- `src/server/mcp/**` (phase E) — JSON-RPC transport and tool schemas only. Every tool
  authorises through the same `requirePermission` the console uses and reaches data through
  `server/catalog`; it never grows a second authorisation path or a second query layer.
- `src/server/public/**` (phase F) — the only session-less read path in the Worker, and it holds
  no SQL of its own. Every response is a named read-only projection with an explicit column
  whitelist, executed through `server/repos` under the tenant scope derived from the share
  record it resolved, or through `server/catalog` for published global rows.

---

## 3. Binding map

Exactly as configured in `wrangler.jsonc` (production; the `staging` environment mirrors it
with its own ids and a separate files bucket, sharing only the tiles bucket). The mirroring is
of bindings only: `staging` overrides `triggers.crons` with `0 3 * * *` alone, so the reminder
sweep and the retention prune never fire there, and its queue consumer is deliberately tuned
smaller (3 retries, concurrency 2) than production's 5 and 4.

| Binding     | Type                                          | Holds                                                                           | Read by                            | Written by                             |
| ----------- | --------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------- |
| `DB`        | D1 `planned-travel-db`                        | 57 domain tables + 9 Better Auth tables, `migrations_dir: drizzle`              | every repository                   | server functions, queue handlers, cron |
| `KV`        | KV namespace                                  | plan-state cache (60 s TTL), queue idempotency markers, reminder due-time index | entitlements, queue consumer, cron | mutations, webhook, queue              |
| `SESSIONS`  | KV namespace                                  | Better Auth session and rate-limit records, 60 s TTL floor                      | nearly every authenticated request | login, session refresh, logout         |
| `FILES`     | R2 `planned-travel-files`                     | journal photos, imports, generated exports                                      | file routes, PDF/thumbnail jobs    | upload server fn, queue handlers       |
| `TILES`     | R2 `planned-travel-tiles`                     | Protomaps `.pmtiles`, styles, sprites, glyphs                                   | `/api/tiles/*` only                | ops, out of band                       |
| `TRIP_ROOM` | Durable Object (SQLite, `new_sqlite_classes`) | per-trip presence, patch log, tombstones                                        | WebSocket clients, snapshot reads  | collaborative edits                    |
| `TASKS`     | Queue `planned-travel-tasks`                  | email, PDF export, imports, thumbnails, backups                                 | consumer in the same Worker        | server functions, cron                 |

Non-secret configuration lives in `vars` (checked in): `ENVIRONMENT`, `APP_NAME`, `APP_URL`,
`LOG_LEVEL`, `TILES_ARCHIVE_KEY`, `FILES_PUBLIC_BASE`, `EMAIL_FROM`, `EMAIL_API_URL`,
`BACKUP_RETENTION_DAYS`, `TASK_MAX_ATTEMPTS`. Secrets are never in `wrangler.jsonc`; the
complete list, with what each one is for, is `.dev.vars.example`.

---

## 4. Caching strategy and invalidation rules

Four caches, each with an explicit owner and an explicit invalidation trigger. Nothing relies
on a TTL alone to become correct.

| Layer                         | Key                          | TTL                               | Invalidated by                                                                                                         |
| ----------------------------- | ---------------------------- | --------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Browser, immutable assets     | hashed `/assets/*` filename  | 1 year, `immutable`               | a new build (new filename)                                                                                             |
| Browser, tile archive by name | `/api/tiles/<key>`           | 1 year, `immutable`               | never — keys are published, not overwritten                                                                            |
| Browser, tile alias           | `/api/tiles/basemap.pmtiles` | `max-age=3600, s-maxage=31536000` | 1 h in the browser; instantly at the edge when `TILES_ARCHIVE_KEY` changes, because the edge key is the _resolved_ key |
| Cache API, tile slices        | `…/<key>?__bytes=<ranges>`   | follows `Cache-Control` above     | entity-tag mismatch on read (entry dropped), or repointing the alias                                                   |
| Cache API, tile metadata      | `…/<key>?__meta=1`           | 24 h                              | entity-tag mismatch, or a 404 on the object (entry dropped)                                                            |
| KV, plan state                | `billing:plan:<v>:<orgId>`   | 60 s                              | the Polar webhook, explicitly, on every subscription event                                                             |
| KV, session                   | Better Auth session id       | session lifetime, 60 s floor      | logout, password change, session revocation                                                                            |
| KV, queue idempotency         | `task:done:<id>`             | 24 h                              | not invalidated — expiry _is_ the semantics                                                                            |

Three rules that are not negotiable:

1. **Usage counters are never cached.** `src/server/billing/entitlements.ts` caches _plan
   state_ (which plan, which status, how many seats) because only Polar changes it, and counts
   _usage_ live on every check. A cached count would let a tenant burst past a quota inside the
   cache window, which is the one thing the quota system exists to prevent.
2. **Invalidate on the write path, in the same request.** A mutation that changes cached state
   deletes the key before it returns. KV is eventually consistent (up to ~60 s globally), so
   any read-your-own-write path must read D1, not the cache.
3. **`immutable` is a promise about the key, not the content.** Tile archives are published as
   new keys (`basemaps/planet-2026-08.pmtiles`) and the alias is repointed. Overwriting a key
   that has already been served with `immutable` is a bug, not a deployment step.

---

## 5. One Durable Object per trip

`TRIP_ROOM` is addressed by trip id, so trip _n_ gets its own single-threaded object with its
own SQLite storage and its own WebSocket set. Concretely, from `src/server/do/protocol.ts`:

- 32 KiB maximum frame; 40 messages per second per connection rate limit.
- 5-minute alarm interval for housekeeping; a room idles out after 7 days.
- Patch log capacity and tombstone TTL are bounded, so an object's storage cannot grow without
  limit from edit history alone.

Why this shape prevents global contention:

- **The blast radius of a hot trip is one trip.** Fifty people editing one itinerary saturate
  one object's message loop. Every other trip is a different object, on different hardware,
  with a different queue. There is no shared lock, no shared table, no shared write path.
- **Serialisation is free correctness.** Concurrent edits to the same day arrive at one
  single-threaded actor, so last-writer-wins is decided in one place rather than by racing D1
  transactions. Conflict handling is a code path, not a retry loop.
- **Fan-out is local.** A patch is broadcast from the object holding the sockets. No pub/sub
  bus, no cross-region hop, no queue in the interactive path.
- **Cost tracks activity, not connections.** With WebSocket hibernation, an idle room bills
  nothing for duration. Cloudflare bills WebSocket _messages_ at one request per 20 messages,
  so a chatty room is 20× cheaper than the naive count suggests.
- **Durable D1 writes stay off the interactive path.** The room is the working copy; D1 is the
  durable record, written in coalesced batches. A collaboration burst becomes DO SQLite row
  writes (same unit price as D1) rather than a D1 write storm.

The scaling property to keep: **trip id is the shard key, and it is already in every realtime
address.** Growing from 10 to 10 000 concurrent trips adds objects; it does not add
coordination.

---

## 6. Quota enforcement at the repository boundary

Enforcement lives in `src/server/repos/base.ts` (`resolveQuotas`, `assertQuota`) and
`src/server/billing/entitlements.ts`, and nowhere else. Every repository that creates a row a
plan can run out of calls `assertQuota(scope, metric, currentUsage)` _before_ it writes; the
call throws `QuotaExceededError`, which the server-function layer maps to a 402/409 with a
human message naming the metric and the ceiling.

### One resolver, one answer

`resolveLimits()` in **`src/server/billing/limits.ts`** is the only implementation of "what may
this tenant do". Both sides go through it — `resolveQuotas()` is a thin adapter that reads the
subscription row and hands it over, and the billing domain (`entitlements`, `currentLimits`,
`assertWithinLimit`, `hasFeature`) calls it through `effectiveLimitsFor()`. Neither side does
arithmetic of its own, because when they did they disagreed: `/settings/billing` derived its
numbers from the marketing catalogue and told a paying workspace it was three seats over a limit
it was nowhere near, while `/files` and the repositories enforced the row's real ceilings.

**Authority order.** Later steps override earlier ones:

| #   | Source                                                      | What it decides                                                                                                                                                                                                                                                                                                                                                                                                   |
| --- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | `subscriptions.status`                                      | A row that no longer entitles (`canceled`, `unpaid`, `paused`, `incomplete…`) resolves to Free **with no escapes**: a lapsed subscription grandfathers nothing.                                                                                                                                                                                                                                                   |
| 1   | `provider_product_id`                                       | The plan. It is what the customer is charged for: the Polar product id, a UUID, since the interval is a property of the product. Phase A renamed it from `stripe_price_id` in migration `0002`, along with the other two provider columns and their indexes (`docs/DEPLOY.md` §9.10). A row with no product id, or one this deployment no longer sells, falls back to the legacy `plan` tier plus the seat count. |
| 2   | The catalogue in `src/lib/plans.ts`                         | That plan's own limits — seats (narrowed to the seats purchased), trips, storage, every module switch. `PLAN_QUOTAS[tier]` in `src/server/db/types.ts` supplies **only** the operational metrics the catalogue does not sell: places, files, exports, collections, journeys.                                                                                                                                      |
| 3   | `seat_limit`, `storage_limit_bytes`, then `quota_overrides` | The last word. This is the deliberate escape hatch that grandfathers a customer above the plan they pay for, and it stays.                                                                                                                                                                                                                                                                                        |

Two consequences worth stating out loud. First, **the published number is the enforced number**:
the Free plan sells two trips at a time and two is what `assertQuota` allows — the old fudge of
advertising 2 and allowing 3 cannot survive a screen that renders what is enforced. Second, a
ceiling column can raise a count but can never unlock a module, because the columns cannot
express one.

The resolver returns the same answer in two shapes: `limits` is catalogue-shaped (`null` is
unlimited, JSON-safe for the client) and `metrics` is column-shaped (`UNLIMITED`, keyed by
`USAGE_METRICS`). `METRIC_FOR_QUOTA` pairs them, and
`src/server/billing/__tests__/limits.test.ts` asserts over a real database that for every row
shape in the wild — free, priced, tier-only legacy, `quota_overrides`, ceilings above the plan —
the limits `entitlements()` reports are identical to the ones `resolveQuotas()` enforces. That
equivalence is the invariant; it is what stops the two from drifting apart again.

The two plan vocabularies are bridged in that one file too: the `plan` column carries a coarse
tier (`free | starter | pro | business`) under a CHECK constraint and predates the catalogue,
which sells `free | solo | crew`. `planIdFromRow()` translates one way, `TIER_FOR_PLAN` the
other, and `ceilingsForPlan()` is what every sanctioned write path — the billing webhook via
`rowValuesFromRecord()` (the Polar webhook handler; the call site survived the provider change
unmoved, which is why the rename reached the column names and not this seam), and the demo seed —
stamps onto the ceiling columns, so a freshly written row always agrees with its own plan.

Two reasons this sits at the repository boundary rather than in the route:

- **It cannot be bypassed.** A new server function, a queue handler, an import job and a future
  public API all reach data through the same repositories, so they inherit the ceiling for free.
- **It is the noisy-neighbour control.** Quotas are what stop one tenant's 50 000-place import
  from consuming the D1 write budget everyone else shares. Tenant isolation (`organization_id`
  on every query) is correctness; quotas are capacity.

For storage, the order matters: `src/server/repos/files.ts` writes the R2 object first, then
asserts the quota, and deletes the object if the assertion throws. R2 has no transaction to
join, so the compensating delete is the transaction.

---

## 7. Provisioning today, and the levers to thousands

### 7.1 Today (first release, 10 users)

Everything is already the scalable shape; nothing is provisioned _for_ scale:

- One D1 database, one KV pair, two R2 buckets, one queue with a DLQ, one DO class.
- Queue consumer: `max_batch_size 10`, `max_concurrency 4`, `max_retries 5`.
- Workers Observability at 100% head sampling — affordable precisely because volume is low.
- Cron sweeps every 15 minutes; nightly D1 export to R2 with 30-day retention.
- No read replicas, no sharding, no Hyperdrive.

At this size the interesting number is not throughput, it is that **the 10-user configuration
and the 10 000-user configuration differ only in numbers, never in topology.**

### 7.2 The levers, in the order they should be pulled

| #   | Lever                                               | Pull it when                                                                              | What it buys                                                      | Cost of pulling                                   |
| --- | --------------------------------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------- |
| 1   | Raise queue `max_concurrency` / `max_batch_size`    | consumer lag > 60 s, or DLQ receives its first non-bug message                            | linear background throughput to ~thousands of msg/s               | one line in `wrangler.jsonc`                      |
| 2   | Widen KV read caching to more hot reads             | D1 rows read > 1 B/month, or repeated identical reads visible in logs                     | KV reads at $0.50/M replace D1 reads plus latency                 | a cache key + an invalidation call per write path |
| 3   | Longer tile cache lifetimes, versioned keys         | R2 Class B ops climbing while tile p95 is flat                                            | R2 ops trend to zero; the archive is served from cache            | publish new keys instead of overwriting           |
| 4   | Move more work into `TripRoom`                      | interactive writes to one trip exceed ~10/s                                               | D1 write pressure becomes per-trip DO SQLite writes               | a patch type in `src/server/do/protocol.ts`       |
| 5   | Push heavy work to Queues                           | any request p95 > 500 ms because of inline work                                           | request latency decouples from job duration                       | a task kind + a handler                           |
| 6   | D1 read replication (Sessions API, `withSession()`) | read p95 dominated by cross-region latency; read:write ratio > 20:1                       | regional reads at no extra cost, bounded staleness                | thread a session through read paths               |
| 7   | Shard D1 by tenant cohort                           | one database approaches its size ceiling (10 GB at time of writing) or write p95 degrades | write capacity multiplies by shard count                          | a shard resolver in `src/server/db/client.ts`     |
| 8   | Hyperdrive + Postgres for the relational core       | see triggers below                                                                        | a real single-writer database with connection pooling at the edge | a migration project — weeks, not hours            |

### 7.3 The D1 → Hyperdrive/Postgres trigger conditions

D1 is a single-writer SQLite database with a primary region. It is the right choice now and the
first thing to outgrow. Migrate when **two or more** of these are true for a fortnight:

- Sustained `rows_written` above ~20 M/month (approaching the 50 M included allowance), or
  measured write p95 above 200 ms with statements already batched.
- The database is past ~8 GB, i.e. within 20% of its size ceiling, and sharding by tenant cohort
  would split queries that genuinely need to join across shards.
- Queue-driven imports back up behind interactive writes — write contention, not CPU.
- A product requirement appears that SQLite cannot serve well: cross-tenant analytics,
  full-text search over everything, or long multi-statement transactions.

Order of operations if it happens: (1) move the hottest write path to DO SQLite, (2) shard D1,
(3) only then stand up Postgres behind Hyperdrive and dual-write while backfilling. Steps 1 and
2 have bought entire product-years for systems shaped like this one.

---

## 8. Cost model

**Workload assumed per active user per month** — the model's inputs, so they can be argued with:
2 000 Worker requests (250 SSR documents, 750 server-function calls, 1 000 tile ranges),
7.5 s CPU total, 30 000 D1 rows read, 600 D1 rows written, 1 000 KV reads, 60 KV writes,
3 000 realtime messages (billed at 1 request per 20), ~30 s of DO execution time, 20 queued
jobs, 150 MB of files in R2, 2 MB of relational data. Fixed overhead: one ~100 GB planet
`.pmtiles` archive and the $5 Workers Paid minimum.

| Users  | Worker requests | CPU       | D1 rows r/w  | Billable extras                                                                       | **Total / month** |
| ------ | --------------- | --------- | ------------ | ------------------------------------------------------------------------------------- | ----------------- |
| 10     | 0.02 M          | 0.08 M ms | 0.3 M / 6 K  | R2 storage $1.37                                                                      | **≈ $6.40**       |
| 100    | 0.2 M           | 0.8 M ms  | 3 M / 60 K   | R2 storage $1.57                                                                      | **≈ $6.60**       |
| 1 000  | 2 M             | 7.5 M ms  | 30 M / 0.6 M | R2 storage $3.60                                                                      | **≈ $8.60**       |
| 10 000 | 20 M            | 75 M ms   | 300 M / 6 M  | requests $3.00 · CPU $0.90 · D1 storage $11.25 · KV storage $2.00 · R2 storage $23.85 | **≈ $46.10**      |

Rates used: Workers $0.30/M requests over 10 M and $0.02/M CPU-ms over 30 M · D1 $0.001/M rows
read over 25 B, $1.00/M rows written over 50 M, $0.75/GB-mo over 5 GB · KV $0.50/M reads over
10 M, $5.00/M writes over 1 M, $0.50/GB-mo over 1 GB · DO $0.15/M requests over 1 M, $12.50/M
GB-s over 400 000 · Queues $0.40/M operations over 1 M (a message costs 3: write, read, delete)
· R2 $0.015/GB-mo over 10 GB, $4.50/M Class A over 1 M, $0.36/M Class B over 10 M.

What the model actually says:

- **Up to about 1 000 users the bill is the $5 minimum plus map storage.** Compute is noise.
  Optimising CPU before that point is optimising nothing.
- **Storage is the cost driver, not traffic.** At 10 000 users, R2 ($23.85) and D1 storage
  ($11.25) are 76% of the bill. The levers that matter are the file retention policy, thumbnail
  sizes, and whether the basemap needs to be the whole planet: swapping the 100 GB planet
  archive for a 5 GB regional extract removes $1.43/month at every tier.
- **The tile cache is what keeps R2 _operations_ off the bill.** Without it, 10 000 users at
  1 000 range reads each would be 10 M Class B operations per month; with it, they are 10 M
  Worker requests (already counted) and a rounding error of R2 reads.
- **Realtime is nearly free at this scale** because of hibernation and the 20:1 WebSocket
  message ratio: 10 000 users of live collaboration is ~$0.10 of DO requests.
- **Revenue context.** Ten paying customers on the entry paid plan cover the platform bill for
  the first thousand users. But "infrastructure is negligible against the merchant-of-record
  fee" is a claim with a scale attached, and the scale changes the answer by two orders of
  magnitude — so it is set out below rather than asserted.

**Infrastructure against the Polar fee, at four mixes.** The entry paid plan is Solo at $9/month
(`src/lib/plans.ts`). Polar's Starter rate takes 5% + 50¢ per transaction, so 95¢ of that $9 —
an effective **10.6%**, because on a ticket that small the fixed 50¢ dominates. Platform bills
are the table above, unchanged:

| Paying customers    | Gross / month | Polar fee / month | Platform bill / month | Fee ÷ infrastructure |
| ------------------- | ------------- | ----------------- | --------------------- | -------------------- |
| 10 (of 10 users)    | $90           | $9.50             | $6.40                 | 1.5×                 |
| 10 (of 1 000 users) | $90           | $9.50             | $8.60                 | 1.1×                 |
| 100 (of 100 users)  | $900          | $95               | $6.60                 | 14×                  |
| 1 000 (of 1 000)    | $9 000        | $950              | $8.60                 | **110×**             |

Read it in that order. At the ten-user first release §1 provisions for, the fee and the entire
platform bill are the **same order of magnitude**, and the fee is the larger of the two — so at
launch neither number is worth optimising and the ten-payers-cover-the-bill sentence above is
the whole story. Infrastructure is only **two orders of magnitude** smaller than the fee at a
thousand paying customers, and nowhere below that. What holds at every row is the direction, and
that is the durable claim: the platform bill grows sublinearly and is bounded by the levers in
§7, while the fee grows linearly with revenue and its only levers are commercial ones. So
infrastructure stops being the interesting number the moment the product sells.

The rate is **5% + 50¢ per transaction** on Polar's Starter plan, plus 1.5% on non-US cards and
$15 per dispute, taken from `polar.sh/docs/merchant-of-record/fees` in **August 2026** and to be
re-checked on the same terms as the Cloudflare rates above. Starter is the plan assumed here
because it is what an organization created on or after 27 May 2026 starts on; the 4% + 40¢ Early
Member rate is grandfathered for older organizations only and is lost permanently on the first
upgrade, so it is not a number to plan against.

Two things move the fee, and both are commercial rather than architectural, which is why they are
recorded here as arithmetic and not as a recommendation. **Billing interval:** one 50¢ on a $90
yearly order instead of twelve 50¢ on $9 brings the effective rate from 10.6% to **5.6%**, and the
yearly price already exists in `src/lib/plans.ts`. It moves the fee and not net revenue, though:
that $90 is twelve months sold at a two-month discount, so annual nets $85 a year against
monthly's $96.60. **Polar plan tier:** Pro is 3.8% + 40¢ plus $20/month, so it saves 21¢ on the
same $9 ticket and about 96 Solo subscriptions a month recover its own $20. At the thousand-payer
row that is $742 of transaction fees **plus** the $20 plan fee — **$762** all in, against
Starter's $950, which carries no plan fee because Starter is free.

---

## 9. Failure modes and mitigations

Twelve of these fourteen rows describe code that is deployed right now. Rows 8 and 9 are the
two that do not, and they are marked: they describe the Polar handler **phase A** writes, and
the note under the table says what is mounted in its place today. Every other row is present
tense and can be checked against the file it names.

| #   | Failure                                           | Blast radius                              | Detection                                                                                          | Mitigation in the code today (rows 8 and 9: phase A)                                                                                                                                         |
| --- | ------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | D1 unavailable or timing out                      | all authenticated reads and writes        | `checkReadiness` probe (`src/server/observability/health.ts`); error-rate spike on `outcome=error` | read-only queries are auto-retried by D1 (up to 2); writes are wrapped in explicit idempotent retries; the marketing pages never touch D1 so the front door stays up                         |
| 2   | KV read returns stale data                        | one tenant sees a stale plan for ≤ 60 s   | plan mismatch between webhook log and quota decision                                               | 60 s TTL plus explicit invalidation from the webhook; usage never cached; entitlement downgrades take effect on the next check, never mid-request                                            |
| 3   | R2 object missing or replaced under a live key    | map degrades to no basemap                | `x-tiles-cache` miss rate, 404 rate on `/api/tiles/*`                                              | metadata entry is dropped on a 404; cached slices are dropped on entity-tag mismatch, so a replaced archive can never be served half-old, half-new                                           |
| 4   | Cache API `put`/`match` failure                   | one uncached read, higher R2 op count     | `tile cache operation failed` warning line                                                         | every cache call is wrapped; a fault degrades to an R2 read and never fails the request                                                                                                      |
| 5   | A trip room gets hot (many editors, huge patches) | one trip                                  | DO CPU/duration metrics; client-visible rate-limit errors                                          | 32 KiB frames, 40 msg/s per connection, bounded patch log and tombstone TTL; the object is the only thing that slows down                                                                    |
| 6   | Durable Object evicted mid-session                | one trip's clients reconnect              | reconnect rate                                                                                     | clients re-handshake and resnapshot via `partysocket`; D1 holds the durable record, so the worst case is replaying recent patches                                                            |
| 7   | Queue consumer failing on a poison message        | one job kind                              | retry count, then DLQ depth                                                                        | 5 retries with 10 s delay, then the dead-letter queue; envelopes carry idempotency keys, so redelivery is safe; DLQ diagnostics are kept 14 days                                             |
| 8   | Third-party outage (Polar, email provider)        | billing changes and notifications delayed | job failure logs, DLQ depth                                                                        | **Phase A.** All third-party calls happen in queue handlers, never inline; webhooks are idempotent by event id; Polar retries on its side, up to ten times with exponential backoff, and we retry on ours |
| 9   | Polar webhook replay or forgery                   | billing state                             | signature failures in logs                                                                         | **Phase A.** The `{webhook-id}.{webhook-timestamp}.{raw body}` signature is verified with WebCrypto (HMAC-SHA256) inside a 300 s tolerance; the event id is claimed in KV before any state change |
| 10  | Runaway range request (huge or many-part)         | one request's CPU and memory              | 400/416 rate on `/api/tiles/*`                                                                     | ≤ 8 range specs, ≤ 8 MiB assembled multipart, ≤ 24 MiB cached per entry, everything above streams without buffering                                                                          |
| 11  | Quota bypass attempt via a new code path          | one tenant over its ceiling               | quota-exceeded counters versus plan                                                                | quotas live at the repository boundary, so a new route or job cannot skip them                                                                                                               |
| 12  | Bad deploy                                        | everything                                | smoke check in `deploy.yml`; error rate in Observability                                           | `wrangler rollback` (see `docs/DEPLOY.md`); migrations are additive so the previous version keeps working against the new schema                                                             |
| 13  | Secret missing or rotated wrongly                 | the feature that needs it                 | first request throws a named error                                                                 | every secret is read through an accessor that fails loudly with the exact `wrangler secret put` command to run                                                                               |
| 14  | Cron trigger missed or overlapping                | reminders late by one tick                | reminder lag in logs                                                                               | the reminder index is idempotent: the sweep enqueues by due-time prefix with deterministic ids, so a double sweep sends one email                                                            |

**What rows 8 and 9 look like until phase A lands.** The mounted route is
`src/routes/api/stripe/webhook.ts`, and `verifyStripeEvent()` in `src/server/billing/webhook.ts`
reads the `stripe-signature` header, not `webhook-signature`. Verification goes through the
Stripe SDK's `constructEventAsync()` on `Stripe.createSubtleCryptoProvider()`, because workerd
has no Node `crypto`. Two of the properties those rows claim are already true today and survive
the migration unchanged: the 300 s tolerance (`WEBHOOK_TOLERANCE_SECONDS` in
`src/server/billing/stripe.ts`), and the KV claim on the event id before any state change
(`webhookEventCacheKey()`, claimed in `processStripeEvent()` ahead of dispatch and deleted again
if a handler throws, so the provider's retry is free to try once more).

A third does **not** hold today, and phase A owes it rather than inherits it. §2.4 states the
rule: nothing that calls a third party or writes more than one row happens inline. The mounted
handler breaks it on one event. `checkout.session.completed` calls
`runtime.stripe.subscriptions.retrieve()` inside the request — a deliberate choice, so the
billing screen is already correct when the customer is redirected back — and writes D1 twice on
that path, once through `attachCustomer()` and again through the `upsert()` inside `persist()`.
Everything slower than those writes is already queued: every branch that persists a subscription
record ends by handing a `billing.*` task to `TASKS` and answering immediately, and the other five
event branches make at most one D1 write each — that half of the rule does hold. The two
`checkout.session.completed` sub-paths that write only the customer id and stop enqueue nothing,
having no plan change to follow up on. So read the inline discipline in §2.4 and row 9 as the
shape phase A must build, not as a property to be preserved: the Polar handler has to fold that
provider read into the queued task and land on a single inline write.

What else changes in phase A is the signed string, the header it arrives in, and the provider
whose retry policy row 8 quotes: ten attempts with exponential backoff is Polar's, not Stripe's.
Do not read either row as a description of `src/server/billing/**` as it stands.

### Numbers worth alerting on

- Worker error rate > 0.5% over 5 minutes.
- Document request p95 > 800 ms, server function p95 > 400 ms.
- `x-tiles-cache: miss` ratio > 20% once the archive is warm.
- Queue consumer lag > 60 s, or any DLQ message.
- D1 write p95 > 200 ms, or `rows_written` > 20 M/month (lever 7 territory).
- D1 database size > 8 GB (lever 7/8 territory).
