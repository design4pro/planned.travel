# planned.travel — Architecture

Engineering companion to `docs/SPEC.md` (product contract) and `DESIGN.md` (visual
contract). This document describes what is actually deployed: one Cloudflare Worker, the
bindings it holds, where every millisecond and every cent goes, and the specific levers that
take the system from the 10-user first release to five figures of users without a rewrite.

Cloudflare list prices and platform allowances quoted here were taken from
`developers.cloudflare.com/workers/platform/pricing/` in **August 2026**. Re-check them before
committing to a budget; the shape of the model outlives the numbers.

Billing is **Polar.sh**, which is Merchant of Record. Phase A replaced the superseded Stripe
integration wholesale and removed it: the client is `src/server/billing/polar.ts`, the mounted
route is `/api/polar/webhook` (`src/routes/api/polar/webhook.ts`), and `grep -ril stripe src/`
returns nothing. Wherever this document names a billing route, a webhook or a provider behaviour
it describes the Polar one, in the present tense (`docs/SPEC.md` §1 and §3, `docs/DEPLOY.md` §6
and §9).

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
4. **Tenant context.** `src/server/auth/tenant.ts` resolves the active organization and
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

A call from the authenticated shell also carries the workspace the tab is showing, in the
`x-planned-workspace` header (the _workspace claim_, `src/lib/workspace-claim-middleware.ts`).
`requireOrg` compares it with the session's effective workspace before the role check and any data
access, and a mismatch is refused as `workspace-changed` (403) with nothing written, so a tab left
open before another tab switched workspace cannot write into the workspace it is not showing. The
claim only narrows access: the tenant context still comes from the session alone. The trip room
socket states the same claim as `?workspace=` on its URL, because a browser cannot set a header on a
WebSocket (#979, §5).

### 2.3 A tile range request (`GET /api/tiles/basemap.pmtiles`, `Range: bytes=…`)

Implemented in `src/routes/api/tiles/$.ts` and `-lib/`. MapLibre reads a Protomaps archive by
issuing hundreds of small range requests against one multi-gigabyte object, so this path is
built to never pay R2 twice:

1. Validate the key (`-lib/archive.ts`). Only `[A-Za-z0-9][A-Za-z0-9 ._,@()-]*` segments, at
   most 6 deep, 512 bytes total, with a known map-data extension, resolve at all. Everything
   else is a 404 that never touches the bucket.
2. Resolve the archive. `basemap.pmtiles` is an alias for the `TILES_ARCHIVE_KEY` var; any
   other path is used as the R2 key verbatim. A named key that is not in the bucket is a 404 —
   the caller asked for something that does not exist. The alias resolving to nothing published
   is a **204**: an absent archive is a deployment state the map has a designed screen for
   (`BasemapNotice`), not a mistake the caller made, and answering it with an error status put a
   console error on every map screen in every checkout that has no archive. See `notPublished()`
   in `-lib/serve.ts`.
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
  envelope to `TASKS`; the consumer batches 10 messages with a 5 s timeout, 5 retries and a
  10 s retry delay, and records a terminal failure itself — a summary in `KV` under
  `task:dead:`, the full body in `FILES` under `dead-letter/` — before acking the message. An
  expected refusal (a trip export or copy whose requester has left the workspace, or whose trip
  is gone) is the exception: it is acked as abandoned with one `info` line of ids and a reason
  code, and writes neither, because the envelope holds the whole trip.
  `planned-travel-tasks-dlq` is named on the consumer as a backstop for a Worker that dies
  before settling a message, so it stays empty in normal operation and is not the signal.
- **Billing webhook** → `/api/polar/webhook`, mounted at `src/routes/api/polar/webhook.ts`.
  Verify the `v1,` signature on WebCrypto — HMAC-SHA256 over
  `{webhook-id}.{webhook-timestamp}.{raw body}`, with the 300 s timestamp tolerance §9 states —
  then claim `webhook-id` in `KV`, make one small inline D1 write, enqueue everything else to
  `TASKS`, and return 200. Nothing that calls a third party or writes more than one row happens
  inline (`docs/DEPLOY.md` §9.5 and §9.7). **Invalidation and the queue hand-off are two separate
  conditions, and neither implies the other** — the difference is deliberate rather than an
  oversight, and neither of them is "every delivery".
  `invalidateEntitlements()` has six call sites in `src/server/billing/webhook.ts`, and the rule
  they follow is _every branch that could have changed what this tenant may do_. That includes the
  two branches that write no row at all — a refund, and a subscription for a product this
  deployment does not sell — because both mean the cached answer may now be stale. It excludes two
  branches that resolve an organization and deliberately leave the key warm: `order.paid` against a
  subscription that was already healthy, and a retrying order against a row that is neither
  `active` nor `trialing`. Both of those return without touching D1, so there is nothing a warm
  entry could now be wrong about, and a delete would only buy a cold read.
  The `billing.*` task is narrower again. The `subscription.*` branch enqueues only when
  `movedState()` says the row actually moved, comparing plan, status, seats, interval and
  `cancel_at_period_end`, because Polar sends the catch-all `subscription.updated` beside the
  specific event with no ordering guarantee and an unconditional enqueue would notify twice for one
  real change. `order.paid` enqueues the receipt on every delivery it can attribute to a row.
  `order.created` and `order.updated` enqueue only on the dunning path — an order that is not
  `paid` and carries a `next_payment_attempt_at`, against a row that was healthy — which is also
  the only shape a failed payment has: **Polar has no `order.payment_failed` event.** Its order
  events are `created`, `updated`, `paid`, `refunded`, `voided` and `unvoided`, and a failed
  payment is an unpaid order with a retry scheduled on it. `order.refunded` and `checkout.updated`
  at `succeeded` enqueue nothing — the latter attaches the Polar customer so the billing screen
  works the instant the browser returns, and leaves the notification to the `subscription.created`
  already on its way with the whole subscription on it.
  A delivery that names an organization which no longer exists (a workspace deleted with
  `deleteWorkspace` while its provider subscription ran out its paid period) is answered 2xx as
  `ignored`: `subscription.*` and `checkout.updated` ask `organizationExists()` before they write, so no
  row is created, no cache entry is dropped and nothing is enqueued, and Polar does not retry into a
  foreign-key failure. Order events find no row to move, so they already end the same way.
- **Transactional email** → ten React Email templates in `src/server/email/templates/`, rendered
  by `renderEmailBody()` (`src/server/email/render.ts`) into `{ html, text }`, described by
  `src/server/auth/email.ts`, and POSTed to the Resend-compatible endpoint by
  `src/server/queue/handlers/email.ts` with a provider-side idempotency key. The renderer is
  behind a dynamic `import()` because its workerd build statically pulls ~540 kB of
  `prettier/standalone`, `prettier/plugins/html` and `html-to-text`, and this module is reachable
  from Better Auth and therefore from every authenticated request.
  **Known departure from the inline rule, recorded rather than implied:** `queueAuthEmail()`
  awaits the render _before_ it enqueues, so React's streaming renderer runs inside the request
  that triggered the mail. Only delivery is queued today. `docs/SPEC.md` §3 carries this as
  follow-up **F1**, with the reason it is not a one-line move, alongside **F2** — `queueAuthEmail()`
  has six dispatch sites: three Better Auth hooks in `src/server/auth/index.ts`, successful
  passkey registration and actual removal in `src/server/auth/passkey/plugin.ts`, and the workspace
  invitation lifecycle in `src/server/fns/workspace-invitations.ts`. The latter opts into propagated
  queue failures so the console distinguishes a saved invitation from a delivered email. **Six** of eleven
  kinds (`auth.email-changed`, `auth.delete-account` and the four `billing.*`) have no dispatch
  site and are exercised only by `src/server/email/__tests__/templates.test.tsx`.
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
entry rule. These are architectural paths; some surfaces remain planned. Bounded
`…Unscoped` repo functions take a plain `Database` only under SPEC §5 FU-3; this does not add
another catalog member.

- `src/server/catalog/**` (phase C) — the global catalogue tables. SPEC §5 lists twelve: eleven carry no
  `organization_id`; `provider_usage` uses it only for attribution. Catalog is one of the three
  closed exceptions outside repos (SPEC §6; the others are the `…Unscoped` shape and the identity-table SQL of `src/server/auth/provisioning.ts`), with exactly four members (these tables, bounded reminder discovery,
  the erasure catalog (ids-only discovery and system-actor cleanup) and ids-only tenant audit retention discovery). Platform-content access uses an explicit
  platform actor, `requirePermission`, and a `platform_audit_log` write in the same call, with
  the bounded shape-based exceptions stated in SPEC §5.
- `src/server/mcp/**` (phase E) — JSON-RPC transport and tool schemas only. Every tool
  authorises through the same `requirePermission` the console uses and reaches data through
  `server/catalog`; it never grows a second authorisation path or a second query layer.
- `src/server/public/**` (phase F) — bearer-resolved public reads without a session; it holds
  no SQL of its own. Every response is a named read-only projection with an explicit column
  whitelist, executed through `server/repos` under the tenant scope derived from the share, feed or trip invite link
  record it resolved (the feed scope is built only by repo `openFeedScope` from its adjacent
  branded `ResolvedFeed`), or through `server/catalog` for published global rows.

Erasure primitives (`repos/trips-erasure.ts`, `expenses-erasure.ts`, `collab-erasure.ts`) take a
workspace-bound reserved owner scope from `erasure/scope.ts`. No request entry point can reach
that factory, including through imports. Writes run in bounded chunks through the tenant base;
`prepareTenantInsert` stamps the workspace for a conditional batch insert, preserving column
defaults and encoders. Promotion, its PII-free notice, departing membership removal and creator
anonymisation commit together. Selection is repeated in that batch; no surviving successor means
no notice or finalisation, retaining the original retry anchors. Both ordinary membership writers
also test the current database role, preserving the new sole owner against stale leave/demotion. No production caller or engine is connected in #1056.

Trip removal requires an awaited `prepareTripRemoval` callback that durably saves the complete,
idempotent cleanup plan before D1 cascades: attachment and cover keys, export-prefix discovery,
and room reset. Cleanup executes only after confirmed deletion; queue acceptance is not completion.
A failure to prepare leaves the rows available for retry. The cascade atomically rechecks solo
classification; a collaborator joining during preparation causes a refusal and reclassification on retry. The engine owns that integration (#1060).
Surviving upload keys are returned for metadata rewrite, including already-anonymised rows on retry.

---

## 3. Binding map

Exactly as configured in `wrangler.jsonc` (production; the `staging` environment mirrors it
with its own ids and a separate files bucket, sharing only the tiles bucket). The mirroring is
of bindings only: `staging` overrides `triggers.crons` with `0 3 * * *` alone, so the reminder
sweep and the retention prune never fire there, and its queue consumer is deliberately tuned
smaller (3 retries, concurrency 2) than production's 5 and 4.

| Binding     | Type                                          | Holds                                                                           | Read by                            | Written by                             |
| ----------- | --------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------- | -------------------------------------- |
| `DB`        | D1 `planned-travel-db`                        | 67 domain tables + 9 Better Auth tables, `migrations_dir: drizzle`              | every repository                   | server functions, queue handlers, cron |
| `KV`        | KV namespace                                  | plan-state cache (60 s TTL), queue idempotency markers, reminder due-time index, approximate public rate-limit counters | entitlements, queue consumer, cron, public limiter | mutations, webhook, queue, public limiter |
| `SESSIONS`  | KV namespace                                  | Better Auth session and rate-limit records, 60 s TTL floor                      | nearly every authenticated request | login, session refresh, logout         |
| `FILES`     | R2 `planned-travel-files`                     | journal photos, imports, generated exports                                      | file routes, PDF/thumbnail jobs    | upload server fn, queue handlers       |
| `TILES`     | R2 `planned-travel-tiles`                     | Protomaps `.pmtiles`, styles, sprites, glyphs                                   | `/api/tiles/*` only                | ops, out of band                       |
| `TRIP_ROOM` | Durable Object (SQLite, `new_sqlite_classes`) | per-trip presence, patch log, tombstones                                        | WebSocket clients, snapshot reads  | collaborative edits                    |
| `TASKS`     | Queue `planned-travel-tasks`                  | email, PDF export, imports, thumbnails, backups                                 | consumer in the same Worker        | server functions, cron                 |

Non-secret configuration lives in `vars` (checked in): `ENVIRONMENT`, `APP_NAME`, `APP_URL`,
`LOG_LEVEL`, `TILES_ARCHIVE_KEY`, `FILES_PUBLIC_BASE`, `EMAIL_FROM`, `EMAIL_API_URL`,
`BACKUP_RETENTION_DAYS`, `TASK_MAX_ATTEMPTS`, and `DEAD_LETTER_RETENTION_DAYS` (optional, unset means 14; add it to `vars` to change it). Secrets are never in `wrangler.jsonc`; the
complete list, with what each one is for, is `.dev.vars.example`.

---

## 4. Caching strategy and invalidation rules

Four caches, each with an explicit owner and an explicit invalidation trigger. Nothing relies
on a TTL alone to become correct.

| Layer                         | Key                              | TTL                               | Invalidated by                                                                                                                              |
| ----------------------------- | -------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Browser, immutable assets     | hashed `/assets/*` filename      | 1 year, `immutable`               | a new build (new filename)                                                                                                                  |
| Browser, tile archive by name | `/api/tiles/<key>`               | 1 year, `immutable`               | never — keys are published, not overwritten                                                                                                 |
| Browser, tile alias           | `/api/tiles/basemap.pmtiles`     | `max-age=3600, s-maxage=31536000` | 1 h in the browser; instantly at the edge when `TILES_ARCHIVE_KEY` changes, because the edge key is the _resolved_ key                      |
| Cache API, tile slices        | `…/<key>?__bytes=<ranges>`       | follows `Cache-Control` above     | entity-tag mismatch on read (entry dropped), or repointing the alias                                                                        |
| Cache API, tile metadata      | `…/<key>?__meta=1`               | 24 h                              | entity-tag mismatch, or a 404 on the object (entry dropped)                                                                                 |
| KV, plan state                | `billing:plan:<version>:<orgId>` | 60 s                              | **two writers, both explicit** — the Polar webhook on every subscription event, and `changePlan()` in the same request that made the change |
| KV, session                   | Better Auth session id           | session lifetime, 60 s floor      | logout, password change, session revocation                                                                                                 |
| KV, queue idempotency         | `task:done:<id>`                 | 24 h                              | not invalidated — expiry _is_ the semantics                                                                                                 |

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

### The plan-state key has two writers, and both are named

`billing:plan:<version>:<orgId>` is built by `planStateCacheKey()` in
`src/server/billing/entitlements.ts`, and the `<version>` segment is the module-private
`PLAN_STATE_CACHE_VERSION` constant in the same file — **not** a literal to copy into a second
place. It is bumped whenever `CachedPlanState` changes shape **or meaning**, so a warm entry written by
older code is ignored rather than misread. It has moved several times as the cached shape grew —
this table named `v2` when it was first written, a later bump added the scheduled plan change, and
the bump after that carried an identical shape with a different meaning — the release in which
that field can finally be non-null. **Read the constant rather than this sentence.** The current
value is deliberately written in exactly one place, and this document is not it; an earlier
revision of this paragraph quoted the resolved key here, which made the sentence beside it false
the moment it did.
`/usr/bin/grep -n 'const PLAN_STATE_CACHE_VERSION' src/server/billing/entitlements.ts` prints the
declaration; the only other line that mentions it is the one directly below, where the key is
assembled.

Only one function deletes the key — `invalidateEntitlements()`, also in `entitlements.ts` — and
exactly two paths call it:

| Writer            | Where                                                                                                | When                                                                                                                                                                                                                                                                             |
| ----------------- | ---------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| The Polar webhook | `src/server/billing/webhook.ts`, six call sites across its subscription, order and checkout branches | Asynchronously, on every delivery that could have changed what the tenant may do — including the two branches that write no row, and excluding the two that resolve an organization and change nothing (§2.4). This is the reconciler and it runs on its own schedule, not ours. |
| `changePlan()`    | `src/server/billing/checkout.ts`, through the local `evictPlanState()` helper, in a `finally`        | Synchronously, inside the request that made the change — an in-app upgrade, downgrade or seat resize, which we apply with `PATCH /v1/subscriptions/{id}` rather than through a hosted flow.                                                                                      |

The second writer is not a duplicate of the first, and rule 2 above is why. `changePlan()` mutates
entitlement state inside our own request, so it owes the whole write shape §2.2 sets out: write D1
from the provider's answer, _then_ delete the key that answer makes stale. Two failure modes were
walked to get here and both are worth keeping written down:

- **Evicting without writing is inert.** The next read misses, re-reads the same unchanged row and
  re-caches it for another TTL, so the customer sees the old plan until the webhook lands.
- **Writing without evicting is worse than stale.** `effectiveLimitsFor()` derives the ceilings
  from that row, so a Solo→Crew upgrade Polar has already billed would leave `assertWithinLimit`
  refusing the seats the customer is paying for.

`evictPlanState()` swallows its own failure and logs it, because by the time it runs Polar has
taken the money: a KV fault must not be reported to a customer as a billing failure, and the 60 s
TTL plus the webhook's own invalidation close the window behind it.

---

## 5. One Durable Object per trip

`TRIP_ROOM` is addressed by trip id, so trip _n_ gets its own single-threaded object with its
own SQLite storage and its own WebSocket set. Concretely, from `src/server/do/protocol.ts`:

- A socket from a stale tab (the `?workspace=` claim names another workspace than the session's) is
  not forwarded to the object: the Worker accepts the upgrade and closes it at once with code 4001
  and the reason `Workspace changed` (`TRIP_ROOM_WORKSPACE_CHANGED_*`). A refused upgrade would be
  unreadable to a browser socket, so the tab could only show "reconnecting". The tab moves to
  `workspace-changed`, stops retrying and offers "Open the current workspace".
- 32 KiB maximum frame; 40 messages per second per connection rate limit.
- 5-minute alarm interval for housekeeping; a room idles out after 7 days.
- Deleting a trip resets its room after the D1 deletion commits: sockets close and stored entity,
  commit-log and presence state is erased. A room failure is logged without failing deletion;
  idle expiry remains the backstop.
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
call throws `QuotaExceededError`. The failure-redaction middleware sends the browser one constant,
`code: 'QUOTA_EXCEEDED'`, beside the usual reference (`src/lib/errors.ts`); the metric, the
ceiling, the plan and the message stay on the server. A screen that owns a quota-limited write
resolves the code to a localised sentence and a way to the billing page.

Trip exports reserve their monthly unit before checking that same ceiling. After trip access and
owner/editor role checks, `src/server/repos/exports.ts` atomically bumps `usage_records` for the
explicit `YYYY-MM` period and checks the returned post-increment value. A refusal releases that
unit once; a failure after reservation, through enqueue, releases the reserved month's unit.
Accepted requests remain counted even if their queued job later fails. There is no export table
to count, and R2 retention deliberately removes old artifacts. The request function returns a
structured quota answer with the limit, usage and restart date so the panel can translate it.

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
| 1   | `provider_product_id`                                       | The plan. It is what the customer is charged for: the Polar product id, a UUID, since the interval is a property of the product. Phase A renamed it from `stripe_price_id` in migration `0003`, along with the other two provider columns and their indexes (`docs/DEPLOY.md` §9.10). A row with no product id, or one this deployment no longer sells, falls back to the legacy `plan` tier plus the seat count. |
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
| 1   | Raise queue `max_concurrency` / `max_batch_size`    | consumer lag > 60 s, or `task:dead:` records its first non-bug failure                    | linear background throughput to ~thousands of msg/s               | one line in `wrangler.jsonc`                      |
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

The per-user figures below are _assumptions_, and since the provider meter landed they have a
measured counterpart for the third-party half of the bill: `/console/providers` reports calls per
active workspace per month from `provider_usage`, which is the same arithmetic this section does by
hand. Where the two disagree about a metered vendor, the meter is the one that has seen the traffic.

**Workload assumed per active user per month** — the model's inputs, so they can be argued with:
2 000 Worker requests (250 SSR documents, 750 server-function calls, 1 000 tile ranges),
7.5 s CPU total, 30 000 D1 rows read, 600 D1 rows written, 1 000 KV reads, 60 KV writes,
3 000 realtime messages (billed at 1 request per 20), ~30 s of DO execution time, 20 queued
jobs, 150 MB of files in R2, 2 MB of relational data. Fixed overhead: one ~100 GB planet
`.pmtiles` archive and the $5 Workers Paid minimum.

**Three of those inputs are calls to somebody else's meter**, and they are listed separately
because they behave differently from everything above: 100 geocoding lookups (address
completion debounces per keystroke, and dropping a pin reverse-geocodes), 20 public-transit
connection searches, and 5 confirmation files handed to the importer — one document conversion
and one model call each. They are argued in ADR 0011, 0012 and 0013, and priced under
**Metered outbound calls** below rather than in the table, because their cost does not scale
with users the way every Cloudflare line does.

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

Outbound rates, on the same terms and to be re-checked the same way: **Workers AI** 10 000
Neurons/day free on both the Free and Paid plans, then $0.011 per 1 000 Neurons, and
`toMarkdown()` is "free for most format conversions" — image conversion is the exception and
may invoke a model — taken from `developers.cloudflare.com/workers-ai/platform/pricing` and
`/workers-ai/features/markdown-conversion` in **August 2026**. **HERE** Public Transit v8:
30 000 requests/month free, then $0.75 per 1 000 (ADR 0011). **Geoapify**: 3 000 credits/day
free with commercial production use permitted under attribution, first paid tier $59/month for
10 000/day (ADR 0013).

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

**Metered outbound calls, and what the caches are worth.** Everything above is
Cloudflare's own meter, where the marginal request is a fraction of a cent and the bill is
dominated by storage. ADR 0011, 0012 and 0013 added three dependencies that are not: each one
is a call to a third party at a published per-call rate, and the ceilings that bound them live
in `resolveLimits()` beside every other ceiling — §6 — rather than as constants inside a
feature module.

Two columns, because the caches are the argument. **Cold** is every user-initiated call
reaching the provider, which is the ceiling. **Cached** applies an assumed hit rate — 70% for
geocoding, 0% for transit, 0% for extraction — and those numbers are assumptions to argue
with, not measurements. They differ because the keys differ: a geocoding key is an address
string, shared across every tenant and stored permanently under ADR 0013's storage right, so
it accumulates; a transit key names the **member** whose Request fetched the answer, because
HERE's Platform Terms forbid one Request serving more than one End User (§6.4 l, §6.4 h; ADR
0011 as amended, ADR 0019), so it is never shared and is stored only when HERE's caching
headers permit and for the lesser of their lifetime and 24 hours; and a confirmation file is
unique to the traveller who uploaded it, so there is nothing to cache at all.

Transit's cached column equals its cold one **until somebody records the caching headers a
live HERE Public Transit v8 response carries**, as ADR 0019 does for routing. A response with
no permitting header is not cached at all, and one that does permit it can only absorb the
same member repeating the same search inside the lifetime, which is a smaller hit rate than
the 40% a shared key was assumed to earn. Nothing here is measured, but every call that does
leave the Worker is recorded in the provider ledger under the `here` slug (#214), so
`/console/providers` shows the real figure once a workspace searches.

| Dependency         | Calls / user / mo | Free allowance / mo | Rate above it    | 1 000 users, cached | 10 000 users, cached | 10 000 users, cold |
| ------------------ | ----------------- | ------------------- | ---------------- | ------------------- | -------------------- | ------------------ |
| Geoapify geocoding | 100               | 90 000 credits      | $59/mo per tier  | $0                  | $59.00               | beyond tier 1      |
| HERE transit       | 20                | 30 000 requests     | $0.75 / 1 000    | $0                  | $127.50              | $127.50            |
| Workers AI         | 5 files ≈ 575 N   | 300 000 Neurons     | $0.011 / 1 000 N | $3.03               | $59.95               | $59.95             |
| **Total**          |                   |                     |                  | **$3.03**           | **$246.45**          | **> $246**         |

One extraction is taken as ~3 000 input and ~500 output tokens against
`@cf/meta/llama-3.1-8b-instruct` (25 608 and 75 147 Neurons per million), so ~115 Neurons a
file and ~575 a user; a cheaper quantised model roughly halves it. Geoapify's cold row has no
figure because ADR 0013 records only the **first** paid tier — a million lookups a month needs
a larger one, and its price is a number to fetch before it is needed, not to guess here.

What that table says, and it is the reason this section exists:

- **Below about a thousand users the outbound bill is still nothing**, exactly like the
  Cloudflare bill. Under 100 users all three sit inside their free allowances.
- **At ten thousand users the outbound calls are more than five times the entire Cloudflare
  bill** — $246 against $46 — and the Workers AI line alone ($59.95) exceeds it. This is what
  "a per-use binding is a larger change to the economics than its unit price suggests" means
  in numbers: it inverts which meter matters.
- **The caches are worth real money on exactly one line.** Geocoding's cache is what keeps the
  tier from escalating. Transit has no cache worth pricing: it used to halve ($127.50 to
  $67.50) while one workspace's answer served another's, and the Platform Terms do not allow
  that, so its meter grows with members searching rather than with distinct routes. Extraction
  has none and never will, so it is the line that grows purely linearly and the one whose
  per-tenant ceiling is therefore load-bearing rather than defensive. Transit's ceiling is
  load-bearing now too: ten members of one workspace repeating a route each spend a unit.
- **Two of the three are elastic under a ceiling and one is not.** A noisy tenant can be
  refused a search or an extraction; the refusal is a designed state, not a failure. That is
  why ADR 0011 and 0012 both put the limit in `resolveLimits()` — the published number is the
  enforced number, for an outbound call exactly as for a row.

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

All fourteen rows describe code that is on disk right now, rows 8 and 9 included: phase A
replaced the superseded provider integration wholesale, so the Polar handler those two rows
describe is the mounted one. Every row is present tense and can be checked against the file it
names. What rows 8 and 9 cannot yet claim is a _walk_ — `docs/DEPLOY.md` §9.11's eight-row sandbox
matrix is unwalked and no credential has been issued, so their evidence is our tests, not Polar's
agreement. The note under the table says which of their properties is a design target the code
still owes.

| #   | Failure                                           | Blast radius                              | Detection                                                                                          | Mitigation in the code today (rows 8 and 9: phase A)                                                                                                                                                                                                                                                                                                              |
| --- | ------------------------------------------------- | ----------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | D1 unavailable or timing out                      | all authenticated reads and writes        | `checkReadiness` probe (`src/server/observability/health.ts`); error-rate spike on `outcome=error` | read-only queries are auto-retried by D1 (up to 2); writes are wrapped in explicit idempotent retries; the marketing pages never touch D1 so the front door stays up                                                                                                                                                                                              |
| 2   | KV read returns stale data                        | one tenant sees a stale plan for ≤ 60 s   | plan mismatch between webhook log and quota decision                                               | 60 s TTL plus explicit invalidation from the webhook; usage never cached; entitlement downgrades take effect on the next check, never mid-request                                                                                                                                                                                                                 |
| 3   | R2 object missing or replaced under a live key    | map degrades to no basemap                | `x-tiles-cache` miss rate; 204 rate on the alias, 404 rate on a named key                          | metadata is dropped when a read finds the object gone; slices are dropped on entity-tag mismatch, so a replaced archive can never be served half-old, half-new                                                                                                                                                                                                    |
| 4   | Cache API `put`/`match` failure                   | one uncached read, higher R2 op count     | `tile cache operation failed` warning line                                                         | every cache call is wrapped; a fault degrades to an R2 read and never fails the request                                                                                                                                                                                                                                                                           |
| 5   | A trip room gets hot (many editors, huge patches) | one trip                                  | DO CPU/duration metrics; client-visible rate-limit errors                                          | 32 KiB frames, 40 msg/s per connection, bounded patch log and tombstone TTL; the object is the only thing that slows down                                                                                                                                                                                                                                         |
| 6   | Durable Object evicted mid-session                | one trip's clients reconnect              | reconnect rate                                                                                     | clients re-handshake and resnapshot via `partysocket`; D1 holds the durable record, so the worst case is replaying recent patches                                                                                                                                                                                                                                 |
| 7   | Queue consumer failing on a poison message        | one job kind                              | retry count, then a `task dead-lettered` log line and a key under `task:dead:`                     | 5 retries with 10 s delay, then the consumer records the failure itself — a summary in `KV` under `task:dead:`, the full body in `FILES` under `dead-letter/` — and acks; envelopes carry idempotency keys, so redelivery is safe; the KV summary expires after 14 days, and the weekly retention slot deletes the R2 body once it is older than `DEAD_LETTER_RETENTION_DAYS` (14 when unset) — the key has no organization segment, so no per-workspace purge reaches it |
| 8   | Third-party outage (Polar, email provider)        | billing changes and notifications delayed | job failure logs, then `task:dead:` records                                                        | Third-party calls happen in queue handlers rather than inline; webhooks are idempotent by event id; Polar retries on its side, up to ten times with exponential backoff, and we retry on ours. One inline provider read survives on the plan-change path and the note below names it                                                                              |
| 9   | Polar webhook replay or forgery                   | billing state                             | signature failures in logs                                                                         | The `{webhook-id}.{webhook-timestamp}.{raw body}` signature is verified with WebCrypto (HMAC-SHA256) inside a 300 s tolerance; the event id is claimed in KV before any state change, and released again if a handler throws so the provider's retry is free to try once more                                                                                     |
| 10  | Runaway range request (huge or many-part)         | one request's CPU and memory              | 400/416 rate on `/api/tiles/*`                                                                     | ≤ 8 range specs, ≤ 8 MiB assembled multipart, ≤ 24 MiB cached per entry, everything above streams without buffering                                                                                                                                                                                                                                               |
| 11  | Quota bypass attempt via a new code path          | one tenant over its ceiling               | quota-exceeded counters versus plan                                                                | quotas live at the repository boundary, so a new route or job cannot skip them                                                                                                                                                                                                                                                                                    |
| 12  | Bad deploy                                        | everything                                | smoke check in `deploy.yml`; error rate in Observability                                           | `wrangler rollback` (`docs/DEPLOY.md` §12). Migrations are additive, so the previous version keeps working against the new schema — **with the named exceptions §12 registers.** Migration `0003` renamed three columns, so a rollback past the phase-A release needs the schema moved back first; the register in §12 is what says which windows are safe        |
| 13  | Secret missing or rotated wrongly                 | the feature that needs it                 | first request throws a named error                                                                 | every secret is read through an accessor that fails loudly with the exact `wrangler secret put` command to run                                                                                                                                                                                                                                                    |
| 14  | Cron trigger missed or overlapping                | reminders late by one tick                | reminder lag in logs                                                                               | the reminder index is idempotent: the sweep enqueues by due-time prefix with deterministic ids, so a double sweep sends one email                                                                                                                                                                                                                                 |

**The one property row 9 still owes, and where it lives.** §2.4 states the inline rule: nothing
that calls a third party or writes more than one row happens inline. The mounted Polar handler
keeps it — every branch makes at most one small D1 write, deletes the plan-state key when what the
tenant may do could have changed, and hands whatever follows to `TASKS`, which for the subscription
branches means a `billing.*` task when `movedState()` says the row moved and nothing when it did
not (§2.4). The exception is not in the webhook at all; it is `changePlan()` in
`src/server/billing/checkout.ts`, which is a _request_ path rather than a webhook one and calls
`PATCH /v1/subscriptions/{id}` inline on purpose, so the billing screen is already correct when the
customer is redirected back. That trade is deliberate and bounded: one provider call, one D1 write
from the answer, one KV delete, no fan-out (§4).

Two properties rows 8 and 9 assert are verified offline and not in the vendor's sandbox: the 300 s
tolerance and the KV claim on the event id are covered by
`src/server/billing/__tests__/webhook.test.ts`, including a Standard Webhooks signature vector
computed out of band so that both halves of the check are not our own implementation. That is the
strongest evidence available without a credential, and `docs/DEPLOY.md` §9.11 is explicit that it
is still not a green row.

### Numbers worth alerting on

- Worker error rate > 0.5% over 5 minutes.
- Document request p95 > 800 ms, server function p95 > 400 ms.
- `x-tiles-cache: miss` ratio > 20% once the archive is warm.
- Queue consumer lag > 60 s, or any `task dead-lettered` log line — equivalently, any new key
  under the `task:dead:` KV prefix. Alerting on the depth of `planned-travel-tasks-dlq` instead
  misses almost every failure: `consumeTaskBatch` settles every terminal failure itself and acks
  it, so the platform queue stays empty in normal operation whether or not jobs are dying (§2.4).
  Watch it as well, though, at a much lower rate: `deadLetter()` writes KV and R2 _before_ the ack
  and neither it nor the `queue()` handler catches, so a storage outage leaves the message
  unsettled and it does reach the DLQ after `max_retries` — the one failure mode the `task:dead:`
  listing cannot see, because the record it counts is the write that failed. `docs/DEPLOY.md` §11
  has the commands that read both.
- D1 write p95 > 200 ms, or `rows_written` > 20 M/month (lever 7 territory).
- D1 database size > 8 GB (lever 7/8 territory).
- Tenant `audit_log` weekly prune reporting `drained: false` at error level. Its 400-day window
  (`TENANT_AUDIT_RETENTION_DAYS`, owner confirms) shares one 250-batch cap across all workspaces,
  with 200 ids per delete. Alert on this signal and inspect `deleted`, `batches`, `organizations`
  before raising the bound; the trip history, overview activity and action-count chart lose
  activity older than this window once the prune runs.
- `platform_audit_log` weekly prune reporting `drained: false`. The prune is deliberately bounded
  so one cron tick cannot become an isolate-killing statement, which means a platform writing more
  audit rows per week than the ceiling removes never catches up and the table grows past its
  400-day window for ever. `drained: false` is the signal that the bound has stopped being a safety
  margin and started being a leak; unalerted, it is a line in a log nobody reads until the table is
  the largest thing in D1.
- `provider_usage` weekly rollup reporting `drained: false`, for the same reason and with the same
  shape: hourly rows that stop being folded into their month rows accumulate fastest in exactly the
  weeks nobody is watching.
- Any metered provider at or above 90% of a published ceiling, and any `blocked` count above zero.
  The first is the warning; the second is money or mail already refused, and it should never be the
  console that tells you first.
- `provider gate unavailable; allowing the call` in the logs. The gate fails open on purpose — a
  metering read must not stop transactional email — so this line is the only evidence that a
  ceiling is not being enforced while it is not being enforced.

## 10. Chrome geometry and stacking order

Moved here from the former `docs/DESIGN.md` when that file became a descriptive design record. These are
engineering invariants about layers, offsets and a third-party stylesheet, not visual language:
`DESIGN.md` keeps the token contract and the two rules a designer needs (The Composed Offset Rule
and The Single Reservation Rule), and the reasoning that produced them lives here.

The bands are `--z-map-overlay 30`, `--z-map-surface 35`, `--z-nav 40`, `--z-dropdown 50`,
`--z-overlay 60`, `--z-modal 70`, `--z-popover 75`, `--z-toast 80`, `--z-impersonation 90`.
`--z-impersonation` is the top of the stack, one band above `--z-toast`: `docs/ACCESS.md` §6.1
requires that nothing can cover the control which ends an impersonated session, and a toast is the
layer most likely to try.

**A portalled popper is ranked against the whole document, not against the panel that opened it.**
Radix renders the select listbox, the popover and the two menus into `document.body`, so their
z-index meets the dialog scrim (`--z-overlay`) and the dialog surface (`--z-modal`) at the root
stacking context. On `--z-dropdown` they lost: a select opened inside a dialog painted under the
scrim and a click on an option landed on the scrim instead. `--z-popover` is their own band above
`--z-modal` — a popper is logically above whatever opened it — and it is a _new_ band rather than a
raised `--z-dropdown` because that token also carries in-page elevation for `GlassPanel`'s floating
map chrome and for a list item being dragged, neither of which may outrank an open dialog.
`src/styles/__tests__/popper-stacking.test.ts` holds both halves of that split.

**A band binds nothing until the library inside it is bound.** Our toasts are `sonner`'s, and
`sonner` pins its own container at `z-index: 999999999` — so for as long as `--z-toast` was
merely declared, the tier above it described a layer nothing occupied while the real toast
layer sat over the End impersonation control. `src/styles/styles.css` therefore carries
`:root [data-sonner-toaster] { z-index: var(--z-toast) }`: one specificity step above the
library's own selector, so it wins without `!important` and without depending on which
stylesheet the browser saw last. `src/styles/__tests__/toast-stacking.test.ts` reads both files
and fails if `sonner` restacks itself. A z token that a third-party stylesheet ignores is
decoration, and this is the one band where that is a safety property rather than a nicety.

**The top edge of the viewport is the shell's. The bottom edge is not, and reserving it there a
second time is a regression.** `--impersonation-h` is the top one, and it has to be the shell's
because nothing below the shell knows the bar exists. Below `lg` the mobile tab bar is `fixed`,
so it displaces nothing and covers the last row of whatever is behind it — but the two things
that clear it already exist, one per kind of screen: the content well pads for it
(`AppFrame` ships `pb-[calc(var(--safe-bottom)+8.5rem)] lg:pb-16` and says so in its own
docblock), and a full-bleed slice stops at its top edge by arithmetic, out of `MOBILE_TAB_BAR`.
A third reservation around `<Outlet />` stacks on both: a second 65px box beneath the 136px the
content well already pads leaves 71 + 65 = 136px of canvas visible below the bar instead of the
71px gutter that clears the feedback actor, on every non-bleed authenticated screen at 360 and 768. It
shipped once, and every full-page mobile baseline in the suite was re-recorded around it before
it was caught.

What the shell does own at that edge is scroll geometry, which no padding on an ancestor can
supply: `html:has([data-app-shell])` carries `scroll-padding-bottom` of the bar's whole box, so
the browser stops short of it when it scrolls a focused field or an anchor into view. The
selector is scoped because only this document has a tab bar — the marketing tree and the auth
tree have no bottom chrome to clear.

It shipped because a full-height screenshot composites a `position: fixed` element into the
middle of a tall page, so a correctly-cleared bar photographs as if it were covering cards. That
frame is not evidence about a fixed element in a scrolling viewport, and a capture artefact read
as a defect produced a real one.

Every chrome expression in the product is assembled from the inset lists in
`src/lib/atlas/layout.ts` for the same reason `--impersonation-h` is a token: a hand-written
`calc()` that forgets a hairline is a screen that overflows its own viewport by a pixel per
term, and it does it silently. `documentHeight()` and `tripDocumentHeight()` sum the header, the
slice and the row the slice leaves the fixed bar — which the shell's `min-h-svh` stretches over
rather than pads for — and the tests beside that file assert both land on exactly one viewport
at both breakpoints, with the impersonation bar present and absent.
