# planned.travel - Global Place Catalogue

Contract companion to `docs/SPEC.md` (product contract), `docs/ACCESS.md` (roles, permission
statements, audit and impersonation) and `docs/ARCHITECTURE.md` (deployed shape). This document
owns the **global catalogue**: its tables, its closed field dictionary, the amenities vocabulary,
the provenance policy, the dedupe rule, the record lifecycle, and the MCP tool server through
which an agent reaches all of it.

Everything here is a contract, not a suggestion. A value that is called _closed_ is closed: it
changes by editing this file in a round that owns this file, and the schema, the Zod inputs and
the tests follow the edit. A builder who needs one more amenity key, one more `kind`, one more
lifecycle transition or one more MCP tool has found a change to this document, not a change to
make in passing.

Nothing in the catalogue is tenant data, and nothing in it is written by a machine acting alone.
Those two sentences generate most of the rules below.

---

## 1. Scope and status

|                |                                                                                                                                                                                                                                                                             |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Owns           | The eight global tables, the tenant-scoped `pack_entitlements`, the catalogue field dictionary, provenance, dedupe, lifecycle, the MCP tool and transport contract, the Firecrawl request contract, catalogue retention, the thirteen catalogue audit action names of §8.4. |
| Does not own   | Platform role definitions, permission statements, impersonation, and the `platform_audit_log` columns, indexes and retention - those are `docs/ACCESS.md`. Secrets, cron registration and vendor runbooks - those are `docs/DEPLOY.md`. Visual tokens - `docs/DESIGN.md`.   |
| Implemented in | Phase C (model + curator console), phase D (scrape pipeline), phase E (MCP server), phase F (public surface), phase G (sale). Nothing in this document exists on disk yet; it is written so that each of those phases has one answer to build against instead of five.      |

**Clean room.** Every table, column, enum value, amenity key and tool name in this document is
ours. The reference product informed _what a catalogue of camping places has to record_; not one
line of its schema, copy or vocabulary is reproduced here.

---

## 2. Data model

### 2.1 Global versus tenant, and why the distinction is structural

`docs/SPEC.md` §5 states that every domain row is scoped by `organization_id` and names exactly
one exception. These eight tables are that exception. They hold **platform content** - places we
curate and packs we sell - and they carry no `organization_id` because no workspace owns them.

Saying it in our own words, because it is the rule most likely to be broken by a builder in a
hurry: **a global table must never be pushed through `createTenantRepository()`, and must never
be reached through `src/server/repos/base.ts`.** That layer exists so that _forgetting the tenant
filter is not expressible_. Handing it a fabricated, empty or placeholder tenant context in order
to reach a global row does not bend the guarantee, it destroys it - because from that moment the
existence of a tenant filter in the generated SQL no longer proves anything about isolation.
There is no clever context value that makes it acceptable. Reaching for `createTenantRepository()`
here is a defect, not a shortcut.

The eight tables get a different isolation invariant of equal force, and exactly one door:

> **`src/server/catalog/repo.ts` is the only write path to the global catalogue.**

Every mutation in that file takes an explicit platform actor, passes `requirePermission` before it
touches a row, and writes a `platform_audit_log` entry in the same call. The actor is a value, not
an ambient session, so a caller that has no actor cannot invent one by omission:

```ts
/** Who is acting on the global catalogue. Never derived from a request; always passed. */
export type PlatformActorKind = 'human' | 'agent' | 'system'

export interface PlatformActor {
  /** `null` only when `actorKind` is `'system'` (cron, queue handler, webhook). */
  userId: string | null
  actorKind: PlatformActorKind
  /** Platform role of `userId`. A NULL column value reads as `'user'`. */
  role: PlatformRole
}
```

`PlatformRole` is `'admin' | 'curator' | 'user'`, defined by `docs/ACCESS.md` and stored in the
`user.role` column that Better Auth's `admin` plugin adds. The plugin declares that column
`required: false` with no database default, so rows that predate the migration read `NULL`;
**`NULL` is coerced to `'user'` at the boundary and never treated as "unset, therefore allow"**.

Reads use the same door. A row that is not `published` needs a platform permission. A `published`
row is readable by an entitled tenant, and - with no session at all - only through the
column-whitelisted projections in `src/server/public/**`.

`pack_entitlements` is deliberately _not_ in the global set. Which workspace bought which pack is
tenant data: it is scoped by `organization_id`, lives in `src/server/repos/packs.ts`, and stays on
the existing `createTenantRepository()`. **The pack is global; the right to use it is not.**

### 2.2 Shared conventions

Every table below follows the conventions already stated at the head of `src/server/db/schema.ts`
and uses its helper vocabulary: `pk()`, `createdAt()`, `updatedAt()`, `timestamps()`,
`enumCheck()`, `latLngChecks()`, `minor()`, `geo()`, `sortOrder()`, `currency()`. In particular:

- Primary keys are time-sortable text from `newId()`, so the primary key doubles as a cursor.
- Instants are epoch-millisecond integers; calendar dates are `YYYY-MM-DD` text; `MM-DD` season
  markers are text. The three are never mixed.
- Money is `minor()` plus an ISO-4217 `currency()`. There are no floating-point amounts.
- Every enum-like column carries a `CHECK` generated by `enumCheck()` from an exported tuple, so
  the database rejects an unknown value even when application code is bypassed.
- **Every foreign key has an index, and every query has a driving index.** The index lists below
  are the complete set, not examples. The indexes that back a keyset-paginated list are trailed by
  `id`, and §8.6 names them one by one - a text primary key is not implicitly appended to a
  secondary index the way a rowid is, so keyset pagination needs it spelled out.
- Two predicates in this document cannot be served by a B-tree at all: set containment on the
  `amenities` and `country_codes` JSON arrays, and substring matching on free text. Saying "every
  filtered column is indexed" would therefore be false. What is true, and what §8.6 states as an
  enforceable plan, is that **no query is allowed to run without a driving index and a bounded
  candidate window** - those two predicates are only ever residual filters applied inside that
  window, never the thing that finds the rows.
- Global tables carry no `organization_id`, so there is no leading tenant column on their
  composite indexes; the leading column is whatever the hot filter is.

`PLACE_SOURCES` in `src/server/db/schema.ts` gains one more member, `'catalog'`, so a tenant
`places` row copied out of the catalogue records where it came from. That is a one-value addition
to an existing tuple, and it is the only change this document makes to the tenant schema.

### 2.3 `catalog_sources` - global

One row per site we scrape. Credit text lives here as the _default_ for new links; the frozen
per-place copy lives on `catalog_place_sources` (§5.3).

| Column                      | Type                | Null | Notes                                                                                                     |
| --------------------------- | ------------------- | ---- | --------------------------------------------------------------------------------------------------------- |
| `id`                        | `pk()`              | no   |                                                                                                           |
| `slug`                      | `text`              | no   | URL-safe key, e.g. `grupa-biwakowa`. `uniqueIndex`.                                                       |
| `name`                      | `text`              | no   | Human name of the source, used as the default `source_name`.                                              |
| `homepage`                  | `text`              | no   | Absolute `https://` origin.                                                                               |
| `adapter`                   | `text`              | no   | `enumCheck` against `CATALOG_ADAPTERS`.                                                                   |
| `enabled`                   | `integer` (boolean) | no   | Default `true`. A disabled source is never scheduled.                                                     |
| `licence`                   | `text`              | no   | `enumCheck` against `CATALOG_LICENCES` (§5.4). Default licence applied to links created from this source. |
| `attribution`               | `text`              | no   | Default credit string copied onto each new link.                                                          |
| `licence_note`              | `text`              | yes  | Free text: the clause, permission email or terms URL the licence rests on.                                |
| `robots_checked_at`         | `integer` ts        | yes  | Last time the adapter re-read `robots.txt`.                                                               |
| `crawl_delay_seconds`       | `integer`           | no   | Default `2`. Passed to Firecrawl as `delay` (§11.4).                                                      |
| `max_pages_per_run`         | `integer`           | no   | Default `500`. Hard ceiling per run.                                                                      |
| `last_run_at`               | `integer` ts        | yes  |                                                                                                           |
| `created_at` / `updated_at` | `timestamps()`      | no   |                                                                                                           |

Indexes: `uniqueIndex(slug)` · `index(enabled, last_run_at, id)` · `index(adapter)`.
Checks: `enumCheck(adapter)` · `enumCheck(licence)` · `nonNegativeCheck(crawl_delay_seconds)` ·
`nonNegativeCheck(max_pages_per_run)`.

`CATALOG_ADAPTERS` is closed: `grupa_biwakowa` · `camper_system` · `stayfree`.

### 2.4 `catalog_runs` - global

One row per scrape execution, whether started by cron, by the console, or by the `sources_run`
MCP tool.

| Column                       | Type                                       | Null | Notes                                                                                                                       |
| ---------------------------- | ------------------------------------------ | ---- | --------------------------------------------------------------------------------------------------------------------------- |
| `id`                         | `pk()`                                     | no   |                                                                                                                             |
| `source_id`                  | `text` FK → `catalog_sources.id` (cascade) | no   |                                                                                                                             |
| `trigger`                    | `text`                                     | no   | `enumCheck` against `CATALOG_RUN_TRIGGERS` = `cron` · `console` · `mcp`.                                                    |
| `status`                     | `text`                                     | no   | `enumCheck` against `CATALOG_RUN_STATUSES` = `queued` · `running` · `succeeded` · `failed` · `cancelled`. Default `queued`. |
| `firecrawl_job_id`           | `text`                                     | yes  | The `id` returned by `/v2/crawl`; the webhook correlates on it. `uniqueIndex`.                                              |
| `discovered`                 | `integer`                                  | no   | Default `0`.                                                                                                                |
| `created`                    | `integer`                                  | no   | Default `0`. New `catalog_places` rows.                                                                                     |
| `updated`                    | `integer`                                  | no   | Default `0`. Existing places re-linked or refreshed.                                                                        |
| `duplicates`                 | `integer`                                  | no   | Default `0`. Soft matches parked for review (§6.4).                                                                         |
| `failed`                     | `integer`                                  | no   | Default `0`.                                                                                                                |
| `error`                      | `text`                                     | yes  | Terminal error message when `status = 'failed'`.                                                                            |
| `started_at` / `finished_at` | `integer` ts                               | yes  |                                                                                                                             |
| `created_at` / `updated_at`  | `timestamps()`                             | no   |                                                                                                                             |

Indexes: `index(source_id, created_at)` · `index(status, created_at)` ·
`uniqueIndex(firecrawl_job_id)`.
Checks: `enumCheck(trigger)` · `enumCheck(status)` · `nonNegativeCheck` on all five counters.

**How a run reaches `failed`, without depending on being told.** Firecrawl's documentation
contradicts itself about failure webhooks: the `/v2/crawl` and `/v2/batch/scrape` API references
declare `failed` in the `webhook.events` enum and name `crawl.failed` / `batch_scrape.failed`,
while the two webhook guide pages list only `started`, `page` and `completed` for those families
(§11.3). We subscribe to `failed` and handle it, and we assume nothing from it. The terminal
status is established by us, on a path that is complete on its own:

1. When `/v2/crawl` is accepted, the queue handler stores `firecrawl_job_id`, sets `status` to
   `running`, stamps `started_at`, and enqueues a `catalog.run.poll` task on `TASKS` with a delay.
2. Each poll reads `GET /v2/crawl/{id}`, whose `status` is `scraping` · `completed` · `failed`
   (with `cancelled` as a further terminal state). `scraping` re-enqueues the next poll;
   `completed` closes the run as `succeeded`; anything else closes it as `failed` with the
   endpoint's `error` copied into `error`.
3. A run whose `started_at` is more than **6 hours** old and that still has no terminal status is
   closed as `failed` with `error = 'no terminal crawl status within 6 h'`, and polling stops. This
   is the watchdog that covers a job Firecrawl loses entirely, and it is the reason the `failed`
   status and the `error` column are reachable at all.

The `completed` webhook, when it arrives, closes the run the same way and cancels nothing - the
next poll simply finds a run already terminal and returns. A `crawl.failed` delivery, if the API
reference is the page that turns out to be right, closes it as `failed` with the envelope's
`error`. All three paths are idempotent because all three write the same terminal row, so
whichever arrives first wins and the others are no-ops. That is what lets us subscribe to an event
whose existence the vendor documents inconsistently: if it never fires, step 3 closes the run
anyway; if it fires, it only ever arrives earlier.

### 2.5 `catalog_ingest` - global

The raw third-party record, exactly as received, before any of it becomes a catalogue fact. This
is the only table that ever holds a third-party payload, and §12 says how long it holds it.

| Column                      | Type                                       | Null    | Notes                                                                                                                 |
| --------------------------- | ------------------------------------------ | ------- | --------------------------------------------------------------------------------------------------------------------- |
| `id`                        | `pk()`                                     | no      |                                                                                                                       |
| `run_id`                    | `text` FK → `catalog_runs.id` (cascade)    | no      |                                                                                                                       |
| `source_id`                 | `text` FK → `catalog_sources.id` (cascade) | no      |                                                                                                                       |
| `external_id`               | `text`                                     | no      | The source's own identifier, or a stable hash of its URL when it has none.                                            |
| `source_url`                | `text`                                     | no      | Absolute URL of the page the record came from.                                                                        |
| `payload`                   | `text` json                                | **yes** | Raw extraction. Nullable _only_ because retention nulls it (§12); it is NOT NULL at insert.                           |
| `checksum`                  | `text`                                     | no      | SHA-256 of the canonicalised payload. Re-seeing the same checksum is a no-op.                                         |
| `status`                    | `text`                                     | no      | `enumCheck` against `CATALOG_INGEST_STATUSES` = `pending` · `promoted` · `rejected` · `duplicate`. Default `pending`. |
| `matched_place_id`          | `text` FK → `catalog_places.id` (set null) | yes     | Set for `promoted` and `duplicate`.                                                                                   |
| `reject_reason`             | `text`                                     | yes     | Required by the repo when `status = 'rejected'`.                                                                      |
| `payload_purged_at`         | `integer` ts                               | yes     | Stamped by the retention prune when `payload` is nulled.                                                              |
| `created_at` / `updated_at` | `timestamps()`                             | no      |                                                                                                                       |

Indexes: `uniqueIndex(source_id, external_id, checksum)` (idempotency, and the `source_id`
foreign-key index by its leading column) · `index(run_id, status, id)` ·
`index(status, created_at, id)` · `index(matched_place_id)` · `index(source_id, created_at, id)`.
The last one lists one source's ingest rows newest-first (§8.6); a bare `index(source_id,
external_id)` would be a prefix of the unique index above and would earn nothing.
Checks: `enumCheck(status)`.

### 2.6 `catalog_places` - global

The catalogue record itself. Its column list is the closed field dictionary in §3 and is not
repeated here. Its constraint and index set is:

Indexes, each one paired here with the query that justifies it, because ten indexes on one table
is a claim that has to be earned:

| Index                                   | Serves                                                                                         |
| --------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `uniqueIndex(slug)`                     | Public URL lookup, and slug uniqueness at publication (§7.2).                                  |
| `uniqueIndex(dedupe_key)`               | The hard dedupe stage (§6.3). Enforcement, not access.                                         |
| `index(geohash, id)`                    | The 150 m radius candidate search (§6.4), and the bbox cover when no `status` is given (§8.6). |
| `index(status, geohash, id)`            | The bbox cover inside one status - the common agent and public case (§8.6).                    |
| `index(name_normalised, id)`            | The `q` prefix range (§8.6) and the name lookup inside the soft match.                         |
| `index(country_code, kind, status, id)` | Country-anchored search, with `kind` and `status` narrowing as leading columns (§8.6).         |
| `index(kind, status, id)`               | Kind-anchored search when no country is given (§8.6).                                          |
| `index(status, updated_at, id)`         | The console's review queue: "what changed in this status, newest first".                       |
| `index(published_at, id)`               | "Recently published", for the public index and the pack builder.                               |
| `index(verified_by)`                    | Foreign key.                                                                                   |

The trailing `id` on the seven pagination indexes is deliberate. `catalog_places.id` is a text
primary key, so SQLite implements it as a separate unique index and appends the hidden rowid - not
`id` - to every other index. Without the trailing column, keyset pagination on `id` degenerates
into a sort of the whole matched set; with it, every page in §8.6 is an index walk.

Ten indexes is a read-heavy trade taken deliberately: `catalog_places` is written by one weekly
scrape and by curators in ones and twos, and read by the console, the agents, the public pack
pages and every map viewport. The write amplification lands on the cheapest path we have.

Checks: `enumCheck(kind)` · `enumCheck(status)` · `enumCheck(licence)` ·
`latLngChecks('catalog_places_lat_chk', lat, lng)` · `nonNegativeCheck(price_minor)` ·
`nonNegativeCheck(capacity)` · a `country_code` length-2 column · `check` that
`season_from` and `season_to` are either both null or both set.

`lat` and `lng` come from `geo()`, which declares them nullable; the catalogue narrows that with
`.notNull()` because a place without coordinates is not a place we can sell (§7.2). `geo()` gives
us the column pair and `latLngChecks()` gives us the WGS-84 bounds check; the additional
`notNull()` is the catalogue's own stricter contract.

### 2.7 `catalog_place_sources` - global

Where each fact on a place came from. This table is the enforcement point of the provenance
policy: it is a many-to-many join _carrying its own licence and credit_, because one place is
routinely listed by two or three sites under different terms.

| Column          | Type                                       | Null         | Notes                                                                                                                                 |
| --------------- | ------------------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| `place_id`      | `text` FK → `catalog_places.id` (cascade)  | no           | Part of the composite PK.                                                                                                             |
| `source_id`     | `text` FK → `catalog_sources.id` (cascade) | no           | Part of the composite PK.                                                                                                             |
| `external_id`   | `text`                                     | no           | The source's identifier for this place.                                                                                               |
| `source_url`    | `text`                                     | **NOT NULL** | The page a reader can open to check us. Non-negotiable (§5.2).                                                                        |
| `source_name`   | `text`                                     | **NOT NULL** | The credit string as it must be displayed, frozen at capture time so renaming a source never silently rewrites published attribution. |
| `licence`       | `text`                                     | no           | `enumCheck` against `CATALOG_LICENCES`. The terms _this_ link is under.                                                               |
| `attribution`   | `text`                                     | no           | The credit text this link requires.                                                                                                   |
| `first_seen_at` | `createdAt()`                              | no           |                                                                                                                                       |
| `last_seen_at`  | `integer` ts                               | no           | Refreshed by every run that still finds the record.                                                                                   |
| `updated_at`    | `updatedAt()`                              | no           |                                                                                                                                       |

Primary key: `primaryKey({ columns: [place_id, source_id] })`.
Indexes: `index(source_id)` · `index(place_id, last_seen_at)` ·
`uniqueIndex(source_id, external_id)`.
Checks: `enumCheck(licence)`.

### 2.8 `place_packs` - global

The sellable bundle.

| Column                      | Type                   | Null | Notes                                                                                     |
| --------------------------- | ---------------------- | ---- | ----------------------------------------------------------------------------------------- |
| `id`                        | `pk()`                 | no   |                                                                                           |
| `slug`                      | `text`                 | no   | `uniqueIndex`. Public URL segment.                                                        |
| `name`                      | `text`                 | no   |                                                                                           |
| `description`               | `text`                 | no   | Our copy. Never a third party's.                                                          |
| `cover_image_url`           | `text`                 | yes  | R2 key for **our own** artwork (§5.5).                                                    |
| `country_codes`             | `text` json `string[]` | no   | ISO-3166-1 alpha-2, used for faceting the public index.                                   |
| `status`                    | `text`                 | no   | `enumCheck` against `PACK_STATUSES` = `draft` · `published` · `retired`. Default `draft`. |
| `price_minor`               | `minor('price_minor')` | no   |                                                                                           |
| `currency`                  | `currency()`           | no   |                                                                                           |
| `polar_product_id`          | `text`                 | yes  | `uniqueIndex`. Required before publication (§7.3).                                        |
| `place_count`               | `integer`              | no   | Default `0`. Denormalised for the index page; recomputed inside `packs_set_places`.       |
| `published_at`              | `integer` ts           | yes  |                                                                                           |
| `created_at` / `updated_at` | `timestamps()`         | no   |                                                                                           |

Indexes: `uniqueIndex(slug)` · `uniqueIndex(polar_product_id)` · `index(status, published_at, id)`.
Checks: `enumCheck(status)` · `nonNegativeCheck(price_minor)` · `nonNegativeCheck(place_count)`.

### 2.9 `place_pack_places` - global

| Column       | Type                                       | Null | Notes                                                                                                                                                                       |
| ------------ | ------------------------------------------ | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pack_id`    | `text` FK → `place_packs.id` (cascade)     | no   | Part of the composite PK.                                                                                                                                                   |
| `place_id`   | `text` FK → `catalog_places.id` (restrict) | no   | Part of the composite PK. `restrict` is the database-level backstop for §7.2's no-delete rule: even a hand-written `DELETE` cannot pull a place out from under a sold pack. |
| `sort_order` | `sortOrder()`                              | no   | Fractional, so reordering never rewrites siblings.                                                                                                                          |
| `created_at` | `createdAt()`                              | no   |                                                                                                                                                                             |

Primary key: `primaryKey({ columns: [pack_id, place_id] })`.
Indexes: `index(place_id)` · `index(pack_id, sort_order)`.

### 2.10 `staff_api_tokens` - global

MCP bearer tokens. **Permissions come from the owner's platform role, not from per-token
scopes** - one authorisation model, not two (§8.2).

| Column                      | Type                    | Null | Notes                                                                                |
| --------------------------- | ----------------------- | ---- | ------------------------------------------------------------------------------------ |
| `id`                        | `pk()`                  | no   |                                                                                      |
| `user_id`                   | `userRef('user_id')`    | no   | Owner. Its `user.role` is the token's authority.                                     |
| `name`                      | `text`                  | no   | What the operator called it, shown in the console list.                              |
| `token_hash`                | `text`                  | no   | `uniqueIndex`. Lowercase hex `HMAC-SHA256(key = MCP_TOKEN_PEPPER, message = token)`. |
| `token_prefix`              | `text`                  | no   | First 12 characters of the plaintext, for identification in a list. Not a secret.    |
| `last_used_at`              | `integer` ts            | yes  |                                                                                      |
| `last_used_ip`              | `text`                  | yes  |                                                                                      |
| `expires_at`                | `integer` ts            | no   | Mandatory. The console offers 30 / 90 / 365 days and nothing unbounded.              |
| `revoked_at`                | `integer` ts            | yes  |                                                                                      |
| `created_by`                | `userRef('created_by')` | no   | The `admin` who issued it.                                                           |
| `created_at` / `updated_at` | `timestamps()`          | no   |                                                                                      |

Indexes: `uniqueIndex(token_hash)` · `index(user_id, revoked_at)` · `index(expires_at)` ·
`index(created_by)`.

The plaintext token is `pt_mcp_` plus 32 random bytes in base64url, generated with
`crypto.getRandomValues`, shown exactly once at creation and never stored. Verification is a
constant-time compare of the HMAC digest. Rotating `MCP_TOKEN_PEPPER` invalidates every issued
token at once, which is the intended emergency lever.

### 2.11 `pack_entitlements` - **tenant-scoped**

Not global. This one carries `organization_id`, lives in `src/server/repos/packs.ts`, and goes
through `createTenantRepository()` like every other tenant table.

| Column                      | Type                                    | Null | Notes                                                                                       |
| --------------------------- | --------------------------------------- | ---- | ------------------------------------------------------------------------------------------- |
| `id`                        | `pk()`                                  | no   |                                                                                             |
| `organization_id`           | `orgRef()`                              | no   | Tenant discriminator, cascade on organization delete.                                       |
| `pack_id`                   | `text` FK → `place_packs.id` (restrict) | no   |                                                                                             |
| `polar_order_id`            | `text`                                  | no   | `uniqueIndex`. The order that paid for it; also the idempotency key on the billing webhook. |
| `granted_at`                | `integer` ts                            | no   |                                                                                             |
| `revoked_at`                | `integer` ts                            | yes  | Set on refund. Revocation is a state change, never a delete.                                |
| `revoke_reason`             | `text`                                  | yes  |                                                                                             |
| `created_at` / `updated_at` | `timestamps()`                          | no   |                                                                                             |

Indexes: `uniqueIndex(organization_id, pack_id)` · `index(organization_id, revoked_at)` ·
`uniqueIndex(polar_order_id)` · `index(pack_id)`.

### 2.12 The audit table this document depends on but does not own

`docs/SPEC.md` §5 requires a `platform_audit_log` write inside every catalogue mutation, and in
the same breath calls the eight-table global list _closed_. `platform_audit_log` is a ninth global
table: it carries no `organization_id`, and the existing `audit_log`
(`src/server/db/schema.ts:1782`) is a different, tenant-scoped table with no `actor_kind` and no
before/after payload. **This document names the tension rather than resolving it silently** - see
the finding in §13.1.

**Its columns, its indexes and its retention are specified in `docs/ACCESS.md` §4.1, and this
document does not restate them.** An earlier revision of this section printed a second column table
of its own. Two column lists for one table is precisely how a schema acquires two spellings, and
the spelling that would have won is not the one written in a file about camping places.
`docs/ACCESS.md` §4.1 owns the column list; the normative shape is there, and only there.

The **action vocabulary** runs the other way, and this is the one part of the audit surface this
document owns. The catalogue's thirteen action names are defined in the last column of §8.4, they
are used in §5.4 and §7.2, and `docs/ACCESS.md` §4.2 reproduces them from there. Naming an action
is naming the mutation that emits it, and the mutations are specified here; a file describing the
permission model cannot invent a verb for a transition it does not define.

What this document does own besides those names is the four claims the catalogue makes _about_ that
table. Each has to hold against what `docs/ACCESS.md` §4.1 defines, and each is checkable:

1. **One row per mutation, in the same call.** Every transition in §7.2 and every mutating tool in
   §8.4 appends exactly one entry (§8.3). Reads append none, and §8.3 says why.
2. **MCP mutations are `agent` mutations.** A mutation arriving over the transport in §8 is
   recorded with `actor_kind: 'agent'`, attributed to the token owner's `user_id`, with the token
   itself identified in the row the way `docs/ACCESS.md` §4.1 prescribes. This document names no
   column for the token: naming one would be the second column list all over again.
3. **The action strings are `entity_type.verb_in_past_tense`.** Every action used in §7.2 and §8.4
   is spelled that way and satisfies the regex `docs/ACCESS.md` §4.2 imports from
   `src/server/repos/audit.ts:36`. The catalogue emits four `entity_type` values:
   `catalog_place`, `place_pack` and `catalog_source` are three of the examples
   `docs/ACCESS.md` §4.1 already gives for that column, and `catalog_ingest` is a fourth in the
   same shape - that list is prefixed "e.g." and is illustrative, so adding a table name to it is
   not a contract change. If a later round closes the list, `catalog_ingest` belongs in it.
4. **Each half has one owner, and they are different files.** Where this document and that one
   can be read as disagreeing about the _shape_ of the table - its columns, its indexes, its
   retention - `docs/ACCESS.md` §4.1 wins and this document is the one that gets corrected. Where
   they can be read as disagreeing about the _spelling of a catalogue action_, the thirteen names
   in §8.4 win and `docs/ACCESS.md` §4.2 is the one that gets corrected. Both halves are stated
   again at the foot of §8.4 because that is where they are most likely to be needed.

An earlier revision of this section proposed a `token_id` column, on the reasoning that "every
action this revoked token ever took" should be a join rather than a string match over free text.
There is nothing left to propose: `docs/ACCESS.md` §4.1 already declares `token_id` and
`actor_role` as real columns of `platform_audit_log`, and `user_agent` there carries a
`User-Agent` header and nothing else. §8.3 and §8.4 of this document are written against that
column list. `docs/ACCESS.md` §4.1 is where the column list lives and where any further column is
added or removed; read it there rather than inferring it from anything in this section.

---

## 3. Closed field dictionary: `catalog_places`

Closed means closed. Every column is listed; a column not listed does not exist; a value not
listed is rejected by a `CHECK`, by Zod, or by both.

| Column            | SQL type                       | Null         | Allowed values / shape                                                                                                                      |
| ----------------- | ------------------------------ | ------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `id`              | `text` (`pk()`)                | no           | `newId()`. Time-sortable, 25 chars.                                                                                                         |
| `kind`            | `text`                         | no           | **Exactly four**: `campsite` · `motorhome_stopover` · `wild_camping` · `service_point`.                                                     |
| `name`            | `text`                         | no           | 1-160 chars after trimming. The place's own name as the operator writes it.                                                                 |
| `name_normalised` | `text`                         | no           | Derived, never entered. Output of the normalisation in §6.2; 1-60 chars.                                                                    |
| `slug`            | `text`                         | no           | `^[a-z0-9]+(?:-[a-z0-9]+)*$`, 1-80 chars. Unique. Public URL segment.                                                                       |
| `summary`         | `text`                         | yes          | **The curator's own text.** 0-600 chars. `NULL` until a curator writes it; NOT NULL is enforced at publication, not at insert (§5.1, §7.2). |
| `lat`             | `real` (`geo()`)               | no           | `-90 … 90`, enforced by `latLngChecks()`. WGS-84.                                                                                           |
| `lng`             | `real` (`geo()`)               | no           | `-180 … 180`, enforced by `latLngChecks()`. WGS-84.                                                                                         |
| `geohash`         | `text`                         | no           | Derived. Exactly 7 characters from the base-32 geohash alphabet `0123456789bcdefghjkmnpqrstuvwxyz` (§6.1).                                  |
| `dedupe_key`      | `text`                         | no           | Derived. `"<geohash>:<name_normalised>"`. `uniqueIndex` (§6.3).                                                                             |
| `address`         | `text`                         | yes          | Street line as published by the operator.                                                                                                   |
| `city`            | `text`                         | yes          |                                                                                                                                             |
| `region`          | `text`                         | yes          | Province / voivodeship / state, unnormalised.                                                                                               |
| `country_code`    | `text` length 2                | no           | ISO-3166-1 alpha-2, uppercase.                                                                                                              |
| `website`         | `text`                         | yes          | Absolute `https://` or `http://` URL.                                                                                                       |
| `phone`           | `text`                         | yes          | E.164 where the source gives enough to build it, otherwise as published.                                                                    |
| `email`           | `text`                         | yes          | Single address; a list is rejected.                                                                                                         |
| `amenities`       | `text` json `string[]`         | no           | Default `[]`. Every element is a key from the frozen vocabulary in §4. Unknown key → rejected. Sorted and de-duplicated on write.           |
| `season_from`     | `text`                         | yes          | `MM-DD`. Null together with `season_to` means "open all year, or unknown - see `year_round_access`".                                        |
| `season_to`       | `text`                         | yes          | `MM-DD`. May be earlier than `season_from` for a season that crosses the new year.                                                          |
| `price_minor`     | `integer` (`minor()`)          | yes          | Indicative nightly price per pitch in the minor unit. Non-negative. `NULL` means unknown, `0` means free.                                   |
| `currency`        | `text` length 3 (`currency()`) | yes          | ISO-4217. NOT NULL whenever `price_minor` is not null; a `CHECK` enforces the pair.                                                         |
| `capacity`        | `integer`                      | yes          | Pitches or bays. Non-negative.                                                                                                              |
| `status`          | `text`                         | no           | **Exactly four**: `ingested` · `review` · `published` · `retired`. Default `ingested` (§7).                                                 |
| `licence`         | `text`                         | **NOT NULL** | One of `CATALOG_LICENCES` (§5.4). The effective, most restrictive licence across all links.                                                 |
| `attribution`     | `text`                         | **NOT NULL** | Rendered credit line. Accumulates every source's required credit (§5.4).                                                                    |
| `published_at`    | `integer` ts                   | yes          | Set on entry to `published`, cleared on leaving it.                                                                                         |
| `verified_at`     | `integer` ts                   | yes          | When a human last checked the record against reality.                                                                                       |
| `verified_by`     | `userRef('verified_by')`       | yes          | Who. NOT NULL whenever `verified_at` is set.                                                                                                |
| `created_at`      | `createdAt()`                  | no           |                                                                                                                                             |
| `updated_at`      | `updatedAt()`                  | no           |                                                                                                                                             |

There is **no `image_url` column, and no photo column of any name.** That absence is a provenance
control, not an oversight (§5.5).

The four `kind` values, in our own words:

| `kind`               | Means                                                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| `campsite`           | A staffed or gated site that sells overnight pitches and runs its own sanitary block.                                   |
| `motorhome_stopover` | A designated motorhome parking place for one or two nights, typically unstaffed, usually with a service point attached. |
| `wild_camping`       | A tolerated or explicitly permitted informal spot with little or no built infrastructure.                               |
| `service_point`      | A servicing installation with no overnight pitch: fill, empty, and drive on.                                            |

The four `status` values are defined by the lifecycle in §7 and nowhere else.

---

## 4. Frozen amenities vocabulary

`amenities` is a JSON array of stable `snake_case` keys. The list below is the whole vocabulary.
**A term is added only by editing this section**, in a round that owns this file; the schema's Zod
enum and the console's filter chips are generated from it. Any key not on this list is rejected at
the boundary, so a scrape adapter cannot quietly widen the vocabulary by emitting a new string.

Keys describe **facts about the place**, never opinions about it, and never sentences copied from
a listing. "Applies to" is guidance for the console's kind-aware editor; the database does not
restrict a key to a kind, because a service point occasionally does have a toilet.

### 4.1 Motorhome service

The terms a campsite-only vocabulary would omit, and the reason `service_point` is a `kind` at
all.

| Key                    | Meaning                                                     | Applies to                        |
| ---------------------- | ----------------------------------------------------------- | --------------------------------- |
| `fresh_water_fill`     | Filling point sized for a motorhome fresh-water tank.       | stopover, service point, campsite |
| `drinking_water`       | Potable tap water fit for drinking.                         | all                               |
| `grey_water_disposal`  | Drain accepting sink and shower waste water.                | stopover, service point, campsite |
| `black_water_disposal` | Disposal point for chemical or cassette WC waste.           | stopover, service point, campsite |
| `cassette_rinse`       | Dedicated rinsing tap beside the WC disposal point.         | stopover, service point, campsite |
| `electric_hookup`      | Mains electrical hook-up post serving the pitch or bay.     | campsite, stopover                |
| `lpg_refill`           | LPG or propane refill, or bottle exchange.                  | stopover, service point, campsite |
| `compressed_air`       | Tyre inflation point.                                       | stopover, service point           |
| `vehicle_wash`         | Bay where a vehicle may be washed.                          | campsite, stopover, service point |
| `self_service_247`     | Service installation usable around the clock without staff. | stopover, service point           |
| `height_barrier`       | Access restricted by a height barrier.                      | campsite, stopover, service point |

### 4.2 Sanitary

| Key                   | Meaning                                          | Applies to                        |
| --------------------- | ------------------------------------------------ | --------------------------------- |
| `toilets`             | Flushing toilets in a built block.               | campsite, stopover, service point |
| `pit_toilet`          | Dry or pit toilet, no plumbing.                  | wild camping, stopover            |
| `showers`             | Enclosed showers.                                | campsite, stopover                |
| `hot_water`           | Hot water at the showers or sinks.               | campsite, stopover                |
| `dish_washing`        | Sinks provided for washing up.                   | campsite, stopover                |
| `laundry`             | Washing machine available to guests.             | campsite                          |
| `accessible_sanitary` | Sanitary facilities usable by a wheelchair user. | campsite, stopover                |
| `baby_changing`       | Baby changing table in the sanitary block.       | campsite                          |

### 4.3 Pitch and access

| Key                 | Meaning                                                 | Applies to                        |
| ------------------- | ------------------------------------------------------- | --------------------------------- |
| `hardstanding`      | Firm gravel or paved pitches that stay usable when wet. | campsite, stopover                |
| `grass_pitches`     | Pitches on grass.                                       | campsite, wild camping            |
| `shaded_pitches`    | Meaningful tree cover over the pitches.                 | campsite, wild camping            |
| `level_pitches`     | Pitches level enough to park without ramps.             | campsite, stopover                |
| `unpaved_approach`  | The final approach road is unsurfaced.                  | all                               |
| `year_round_access` | Reachable and open outside the summer season.           | all                               |
| `night_arrival`     | Arrival possible outside reception hours.               | campsite, stopover                |
| `gated`             | The site closes behind a gate or barrier at night.      | campsite, stopover                |
| `night_lighting`    | The site is lit after dark.                             | campsite, stopover, service point |

### 4.4 Site facilities

| Key                | Meaning                                               | Applies to                        |
| ------------------ | ----------------------------------------------------- | --------------------------------- |
| `reception`        | Staffed reception during posted hours.                | campsite                          |
| `shop`             | On-site shop selling groceries or basics.             | campsite                          |
| `restaurant`       | On-site restaurant or food service.                   | campsite                          |
| `bar`              | On-site bar.                                          | campsite                          |
| `communal_kitchen` | Shared indoor cooking facilities.                     | campsite                          |
| `covered_shelter`  | Roofed communal space or lean-to.                     | campsite, wild camping            |
| `picnic_tables`    | Fixed tables and benches.                             | campsite, wild camping            |
| `bbq_area`         | Designated barbecue area.                             | campsite, wild camping            |
| `campfire_allowed` | Open fires permitted, in a ring or a designated spot. | campsite, wild camping            |
| `fire_ring`        | A built fire ring or hearth.                          | wild camping, campsite            |
| `playground`       | Children's play equipment.                            | campsite                          |
| `swimming_pool`    | Pool on the site.                                     | campsite                          |
| `waste_bins`       | General waste collection.                             | campsite, stopover, service point |
| `recycling`        | Separated recycling containers.                       | campsite, stopover, service point |
| `wifi`             | Guest wi-fi.                                          | campsite, stopover                |
| `ev_charging`      | Electric-vehicle charging point.                      | campsite, stopover, service point |

### 4.5 Setting

| Key                | Meaning                                  | Applies to             |
| ------------------ | ---------------------------------------- | ---------------------- |
| `lake_access`      | Direct access to a lake shore.           | campsite, wild camping |
| `river_access`     | Direct access to a river bank.           | campsite, wild camping |
| `sea_access`       | Direct access to a sea beach.            | campsite, wild camping |
| `forest_setting`   | The place sits inside woodland.          | campsite, wild camping |
| `mountain_setting` | The place sits in mountain terrain.      | campsite, wild camping |
| `viewpoint`        | The place is itself a notable viewpoint. | wild camping, stopover |
| `no_facilities`    | No built facilities of any kind.         | wild camping           |

### 4.6 Rules and payment

| Key                  | Meaning                                          | Applies to                            |
| -------------------- | ------------------------------------------------ | ------------------------------------- |
| `dogs_allowed`       | Dogs accepted.                                   | all                                   |
| `tents_allowed`      | Tents accepted.                                  | campsite, wild camping                |
| `caravans_allowed`   | Towed caravans accepted.                         | campsite, stopover                    |
| `motorhomes_allowed` | Motorhomes accepted.                             | campsite, stopover                    |
| `booking_required`   | Arrival without a reservation is refused.        | campsite                              |
| `permit_required`    | A permit or landowner consent is needed to stay. | wild camping                          |
| `max_stay_limited`   | A posted maximum-stay limit applies.             | stopover, wild camping                |
| `quiet_hours`        | Posted quiet hours are enforced.                 | campsite, stopover                    |
| `free_of_charge`     | No charge for the overnight stay or the service. | stopover, wild camping, service point |
| `card_payment`       | Card accepted.                                   | campsite, stopover, service point     |
| `cash_only`          | Cash is the only accepted payment.               | campsite, stopover, service point     |
| `payment_machine`    | Unattended automatic payment terminal.           | stopover, service point               |

Sixty-three keys - eleven motorhome service, eight sanitary, nine pitch and access, sixteen site
facilities, seven setting, twelve rules and payment. `free_of_charge` and `card_payment` are not
contradictory (a free site may still
sell electricity by card); `cash_only` and `card_payment` are, and the repo rejects the pair.

---

## 5. Provenance policy

This section is written as schema rules a builder can enforce, not as advice a builder can weigh.
Where a rule can be expressed as `NOT NULL`, an absent column or a gate in the repository, it is
expressed that way, because a policy that lives only in a code review is a policy that survives
until the first busy week.

### 5.1 Facts only

**We record facts and we write our own prose.** From a third-party page we take: the place's
name, its coordinates, its address and administrative fields, its contact details (website,
phone, email), its amenities as mapped onto §4's closed vocabulary, its season, its indicative
price and its capacity. Those are facts about a physical place. We take nothing else.

We never store, and have nowhere to store:

- **Third-party prose.** No description, no review text, no marketing copy, no user comment. The
  extraction schema handed to Firecrawl (§11.2) has no free-text field that could receive one -
  every field it declares is a fact with a type, and `summary` is not among them.
- **Third-party photographs.** See §5.5.

`catalog_places.summary` is **the curator's own text**, written inside our console or through
`catalog_upsert_place` by a `curator`-role actor. It is enforced as such structurally: the
promotion projection that turns a `catalog_ingest.payload` into a `catalog_places` row is an
explicit whitelist of the fact columns above, and `summary` is not in it. A promoted row therefore
arrives with `summary IS NULL` by construction, whatever the payload contained, and a test asserts
that a payload carrying a `summary`-shaped string still produces a row with `summary IS NULL`.

### 5.2 Every fact is traceable

`catalog_place_sources.source_url` is **NOT NULL** and `catalog_place_sources.source_name` is
**NOT NULL**. There is no path that creates a link row without both. A place with no link row is a
place we cannot show anyone where we got it from, and §7.2 refuses to publish it.

### 5.3 Every record carries its terms

`catalog_places.licence` is **NOT NULL** and `catalog_places.attribution` is **NOT NULL**, both
with `enumCheck` on the licence. Each link row carries its own `licence` and `attribution` too, so
the place-level values are always derivable and never guessed.

### 5.4 Which licence wins when the sources disagree

A place routinely carries two or three links under different terms. The rule is: **the most
restrictive licence wins, and attribution accumulates.**

`CATALOG_LICENCES` is closed, ordered here from most to least restrictive. The rank is the
contract; the ordering is not alphabetical and is not to be re-sorted.

| Rank | Value                    | What it is                                                                                                      |
| ---- | ------------------------ | --------------------------------------------------------------------------------------------------------------- |
| 1    | `operator_permission`    | Written permission from the site operator. Bilateral, narrowest, may not permit onward redistribution.          |
| 2    | `cc_by_sa_4_0`           | Creative Commons Attribution-ShareAlike 4.0.                                                                    |
| 3    | `odbl_1_0`               | Open Database Licence 1.0 (the OpenStreetMap terms).                                                            |
| 4    | `cc_by_4_0`              | Creative Commons Attribution 4.0.                                                                               |
| 5    | `facts_only`             | Uncopyrightable facts read from a public listing; no expressive content reproduced. We still credit the source. |
| 6    | `public_domain_official` | Public-sector open data released without conditions.                                                            |
| 7    | `cc0_1_0`                | CC0 1.0. No conditions.                                                                                         |

Rules, enforced inside `src/server/catalog/repo.ts` in the same call that writes a link row:

1. `catalog_places.licence` is recomputed on **every** insert, update or delete of a
   `catalog_place_sources` row for that place, and is set to the **lowest-numbered rank** present
   across its links. It is never set by hand and `catalog_upsert_place` ignores any value a caller
   passes for it.
2. `catalog_places.attribution` is the concatenation of every link's `attribution`, de-duplicated,
   ordered by `first_seen_at`, joined with `·`. Adding a source can only ever lengthen it.
   **Attribution is never reduced by adding a source.**
3. If the recomputation moves the place to a _more_ restrictive rank while its status is
   `published`, the row is returned to `review` in the same transaction and a
   `catalog_place.licence_escalated` audit entry records the old and new licence. A published
   record must never sit under terms that were evaluated against a weaker licence.
4. A licence value outside the table is rejected by `enumCheck` at the database, so a new source
   with unusual terms is a decision recorded in this section, not a string an adapter invents.

### 5.5 No photographs, structurally

`catalog_places` has no image column of any name. A third-party photograph cannot be stored
because there is nowhere to put it - which is a stronger guarantee than a rule saying we should
not. Pack artwork (`place_packs.cover_image_url`) is an R2 key for an asset we commissioned or
licensed ourselves, and the console's upload path is the only writer of it.

### 5.6 Publication gate

`review → published` is refused unless **all four** are present, and the check is re-run at the
moment of the transition rather than trusted from an earlier one:

1. `catalog_places.licence` is not null.
2. `catalog_places.attribution` is not null and not blank.
3. At least one `catalog_place_sources` row exists for the place with `source_url` not null.
4. That same row has `source_name` not null.

A published place therefore always answers "who says so, and under what terms" - which is the
whole point of the policy, and the reason it is expressed as `NOT NULL` columns and a gate rather
than as a paragraph.

### 5.7 Etiquette when we fetch

`robots.txt` is honoured; we never set Firecrawl's `ignoreRobotsTxt`. Every request identifies us
(§11.4). `catalog_sources.crawl_delay_seconds` throttles each source, `max_pages_per_run` caps it,
and an adapter aborts a run after five consecutive extraction failures rather than hammering a
site that has changed shape.

---

## 6. Dedupe rule

Two stages, deliberately different in strength: a **hard** stage the database enforces, and a
**soft** stage that only ever produces a suggestion for a human.

### 6.1 Geohash precision 7, and its real cell size

**Precision 7.** Seven base-32 characters, 35 bits, split 18 bits of longitude and 17 of latitude.

|                   | Degrees   | Metres at the equator | Metres at 52°N (central Poland) |
| ----------------- | --------- | --------------------- | ------------------------------- |
| Cell height (lat) | 0.001373° | **152.9 m**           | 152.9 m                         |
| Cell width (lng)  | 0.001373° | **152.9 m**           | **94.1 m** (× cos 52°)          |

So a precision-7 cell is about **153 m × 153 m** at the equator and about **153 m tall by 94 m
wide** where we actually operate. Precision 6 would be roughly 1.2 km × 0.6 km - far too coarse,
it would collide unrelated sites across a whole village. Precision 8 would be roughly 38 m × 19 m,
far too fine: it would split the same campsite's two listings whenever their coordinates disagree
by a car park. Precision 7 is the only digit that sits sensibly beside the 150 m radius of the
soft stage, and that pairing is the reason it was chosen.

### 6.2 Name normalisation

Deterministic, pure, and testable on fixtures:

1. Unicode NFKD, then drop combining marks (`ł` → `l` by an explicit map, since NFKD does not
   decompose it).
2. Lowercase.
3. Replace every run of characters outside `[a-z0-9]` with a single `-`.
4. Remove, from the start and the end only, any token in the closed generic-word list:
   `camping` · `kemping` · `campingplatz` · `campsite` · `pole` · `namiotowe` · `stellplatz` ·
   `wohnmobilstellplatz` · `aire` · `agroturystyka` · `osrodek` · `nr`.
5. Collapse repeated `-`, trim leading and trailing `-`.
6. Truncate to 60 characters at a `-` boundary.

The generic-word list is closed and is edited here, in this document, together with the fixture
that pins its behaviour. It exists because "Camping Nr 12 Zalew" and "Zalew" are the same place
under two listings, and step 4 is what makes them agree.

### 6.3 Hard stage - `dedupe_key` and the unique index

```
dedupe_key = geohash7(lat, lng) + ':' + name_normalised
```

stored in the `dedupe_key` column, `NOT NULL`, under
`uniqueIndex('catalog_places_dedupe_key_unq')`. This is the stage the database enforces: a second
row with the same normalised name in the same 153 × 94 m cell **cannot be inserted**, whatever the
calling code believes. `catalog_upsert_place` recomputes `dedupe_key` from `lat`, `lng` and `name`
on every write - a caller cannot supply it, and moving a place's coordinates re-derives it. A
constraint violation surfaces as the `-31003` conflict error carrying the id of the row that
already holds the key, so the caller can merge rather than retry.

### 6.4 Soft stage - the 150 m radius search

Separate, weaker, and advisory. Before creating a new place from an ingest row, the matcher runs a
**150 m radius candidate search**:

1. Compute the bounding box of ±150 m around the incoming coordinates.
2. Enumerate every precision-7 geohash cell that intersects that box and query
   `WHERE geohash IN (…)` against `index(geohash, id)`. **The cell set is derived from the box, not
   hard-coded.** At the equator it is 3 rows × 3 columns; at 52°N, where a cell is only 94 m wide,
   150 m reaches into the second column and the set is 3 rows × 5 columns = 15 cells. A hard-coded
   3 × 3 neighbourhood is a bug at Polish latitudes and will silently miss matches.
3. Filter the candidates by exact haversine distance ≤ 150 m in TypeScript.
4. Score each survivor by name similarity - Sørensen-Dice on bigrams of `name_normalised` - and
   keep those scoring ≥ 0.72.

The soft stage **never writes a place row and never merges anything.**

**When the radius search finds a candidate whose `dedupe_key` differs**, that is the interesting
case, and it is handled by refusing to decide: the ingest row is written with
`status = 'duplicate'` and `matched_place_id` pointing at the candidate, the run's `duplicates`
counter increments, and the row lands in the `/console/ingest` review queue with the raw payload
shown beside the candidate record and the differing fields highlighted. A curator then either
**merges** - which adds a `catalog_place_sources` row to the existing place, refreshes
`last_seen_at`, recomputes licence and attribution per §5.4, and creates no new place - or
**rejects the match**, which promotes the ingest row as a new place under its own `dedupe_key`. A
machine may not resolve a soft match; `catalog_promote_ingest` is the only tool that can, and it
requires a platform permission.

### 6.5 The cell-boundary failure mode

The hard stage is a prefix comparison, so it inherits a prefix comparison's blind spot. **Two
records ten metres apart on opposite sides of a cell edge fall in different cells, produce
different `dedupe_key` values, and the unique index never fires.** The database happily accepts
both, and nothing about the constraint being satisfied indicates that the data is clean. The same
blind spot appears in the other axis: two records in the _same_ cell whose names normalise
differently ("zalew-wapienny" against "zalew") also slip past.

This is exactly why the soft stage exists and why it is a _separate_ stage rather than a tighter
version of the first. The unique index guarantees we never store the same key twice; only the
radius search notices that two different keys describe the same field by a lake. Neither stage is
sufficient alone, and increasing the geohash precision makes the boundary problem worse, not
better.

---

## 7. Record lifecycle

```
ingested ──→ review ──→ published
   ▲           ▲   ▲        │
   └───────────┘   └────────┘
               review ←── retired ←── published
```

Four states, and the only entrance to `published` is from `review`.

### 7.1 The rule that generates the table

**Nothing reaches sale without a human, or an agent holding a `curator`-role MCP token.**

That is enforced structurally rather than by convention. `review → published` demands the
`catalog:publish` statement. The scrape pipeline - the cron branch, the queue handlers, the
Firecrawl webhook - runs as `{ userId: null, actorKind: 'system', role: 'user' }`, and
`requirePermission` denies `catalog:publish` to a `user` role. No automated path holds an actor
that can publish, so there is no configuration in which an unattended run puts a record on sale.
An agent _can_ publish, but only by presenting a token whose owner is a `curator` or an `admin`,
and every such publication is audited with `actor_kind: 'agent'` and the issuing token
recorded as `docs/ACCESS.md` §4.1 records it.

### 7.2 Transition table

| From        | To          | Who may                                                                           | Validated on the transition                                                                                                                                                                                                                                                                                                | Audit action                   |
| ----------- | ----------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ |
| (new row)   | `ingested`  | `curator`, `admin` (`catalog:write`), via `catalog_promote_ingest` or the console | `kind` in the closed set · `name` non-blank · `lat`/`lng` present and inside WGS-84 bounds · `country_code` two letters · `geohash`, `name_normalised`, `dedupe_key` derived · ≥1 `catalog_place_sources` row with `source_url` and `source_name` · `licence` and `attribution` set per §5.4 · every `amenities` key in §4 | `catalog_place.created`        |
| `ingested`  | `review`    | `curator`, `admin` (`catalog:write`)                                              | The whole record parses against the §3 dictionary, not only the fields the promotion filled: enum values, `MM-DD` season pair, `price_minor`/`currency` pair, amenity keys, slug shape and uniqueness                                                                                                                      | `catalog_place.status_changed` |
| `review`    | `published` | `curator`, `admin` (`catalog:publish`) - human, or agent with a `curator` token   | The §5.6 publication gate, re-evaluated now: `licence`, `attribution`, a link row's `source_url`, that row's `source_name`. Plus `summary` non-blank and authored in-product, coordinates present, `slug` unique. Sets `published_at`.                                                                                     | `catalog_place.published`      |
| `review`    | `ingested`  | `curator`, `admin` (`catalog:write`)                                              | Nothing. Sending a record back is always allowed.                                                                                                                                                                                                                                                                          | `catalog_place.status_changed` |
| `published` | `review`    | `curator`, `admin` (`catalog:publish`)                                            | Nothing. Clears `published_at`. Used for a correction that must not stay live, and automatically by the licence escalation in §5.4 rule 3.                                                                                                                                                                                 | `catalog_place.status_changed` |
| `published` | `retired`   | `curator`, `admin` (`catalog:publish`)                                            | Nothing. Clears `published_at`. Entitlements are untouched; packs keep the join row; public projections stop returning it.                                                                                                                                                                                                 | `catalog_place.retired`        |
| `retired`   | `review`    | `curator`, `admin` (`catalog:write`)                                              | Nothing. This is how a retired record comes back.                                                                                                                                                                                                                                                                          | `catalog_place.status_changed` |
| `ingested`  | `published` | **nobody**                                                                        | Refused. Every record passes through `review`, so the dictionary check and the publication gate are always both evaluated.                                                                                                                                                                                                 | (none)                         |
| `retired`   | `published` | **nobody**                                                                        | Refused. Revival goes through `review` so the publication gate is re-run against the licences that hold _today_, not the ones that held when it was first published.                                                                                                                                                       | (none)                         |
| any         | deleted     | **nobody**                                                                        | There is no hard-delete path. `retired` is terminal in that direction: a place that is wrong, gone or unlicensable is retired, and its provenance, its audit trail and any pack that ever contained it stay intact. `catalog/repo.ts` exposes no delete and no MCP tool offers one.                                        | (none)                         |

The permission column is not six independent decisions. It is one rule, and this is the normative
statement of it:

> **A transition needs `catalog:publish` when either end of it is `published`. Every other
> transition needs `catalog:write`.**

So `review → published`, `published → review` and `published → retired` are all `catalog:publish`,
because each of them changes what the world can buy; `ingested → review`, `review → ingested` and
`retired → review` are `catalog:write`, because they only move a record around the back office.
Taking a live record down is a publication decision exactly as much as putting it up, which is why
`published → review` sits on the publish statement and not on the write statement. §8.4 restates
this rule for `catalog_set_place_status` rather than re-deciding it; if the two ever disagree, this
subsection is the one that is right.

`catalog_set_place_status` is the single entry point for every row of this table; the transition
matrix lives in one exported constant, and an unlisted pair is a rejected input
(`-32602`), not an unhandled case.

### 7.3 Pack lifecycle

`place_packs.status` runs `draft → published → retired` with the same shape. `packs_publish`
validates, on the transition: at least one place in the pack; **every** member place at status
`published`; `polar_product_id` set; `price_minor` and `currency` set; `cover_image_url` set.
Retiring a pack stops new sales and leaves every existing `pack_entitlements` row intact - people
keep what they bought.

---

## 8. MCP tool contract

`src/server/mcp/` owns transport and tool schemas only. It holds no SQL, reaches data exclusively
through `src/server/catalog/repo.ts`, and authorises through **the same `requirePermission` the
console uses**. There is no second authorisation path and no per-token scope system.

### 8.1 Endpoint

`POST https://planned.travel/api/mcp`, handled by `src/routes/api/mcp.ts`.

### 8.2 Authentication

`Authorization: Bearer pt_mcp_…` → `HMAC-SHA256(key = MCP_TOKEN_PEPPER, message = token)` →
lookup on `staff_api_tokens.token_hash` → reject if `revoked_at` is set or `expires_at` has passed
→ load the owner's `user.role` (a `NULL` role reads as `user`) → build the `PlatformActor` with
`actorKind: 'agent'` → hand it to `requirePermission`.

- No token, malformed token, unknown hash, revoked or expired token → **HTTP 401** with
  `WWW-Authenticate: Bearer`. The body is a JSON-RPC error with no `id`.
- Authenticated but lacking the statement → **HTTP 200 with a JSON-RPC error**, code `-31001`,
  message `permission denied`, `data.statement` naming what was required. Not a 403: the transport
  succeeded and the client should read the error, not retry the connection.
- Every accepted request stamps `last_used_at` and `last_used_ip` on the token row.

Error codes we allocate live **outside** the JSON-RPC reserved range `-32768 … -32000`, because
MCP reserves `-32020 … -32099` for its own protocol errors and forbids implementations from
emitting undefined codes in it:

| Code     | Meaning                                                                                      |
| -------- | -------------------------------------------------------------------------------------------- |
| `-31001` | `permission denied`                                                                          |
| `-31002` | `not found`                                                                                  |
| `-31003` | `conflict` - a `dedupe_key` collision; `data.conflictingPlaceId` names the row that holds it |
| `-31004` | `payload too large` - the result could not be reduced under the cut-off in §8.5              |

Validation failures use the standard `-32602` (Invalid params) with the Zod issue list in `data`.

### 8.3 What is audited

**Every mutation writes a `platform_audit_log` entry in the same call**, with
`actor_kind: 'agent'`, the acting `user_id`, the entity type and id, and a before/after `changes`
payload - and with the token identified as `docs/ACCESS.md` §4.1 prescribes for an `agent` row.
The column list is that document's, not this one's (§2.12). An unaudited mutation is a failing
test, not a missing log line.

**Reads are not audited.** A search that returns 200 records is not an event worth a durable row,
and auditing them would bury the mutations that matter under traffic. The compensating controls
are that reads still require a platform permission, still touch `last_used_at`, and still emit a
structured log line through `src/server/observability/**` with the tool name, the actor and the
row count - so a token behaving oddly is visible in Workers Observability without polluting the
audit trail. The table below therefore names an audit action for every mutation and marks the
reads explicitly.

### 8.4 The tools

Twelve tools; the list is closed. Every input is a Zod v4 schema; every `limit` is clamped
(§8.5); every `cursor` is an opaque base64url token encoding the tuple of the **driving index**
the call resolved to, with the row's `id` as its last component (§8.6). For the tools whose
driving index is the primary key that tuple is just the `id`, which works because `newId()` is
time-sortable; for the others it is not, and a cursor is never an `id` alone. A cursor is
meaningless to the client, is not a stable handle, and is rejected with `-32602` if its driving
index does not match the filters it is replayed against.

| Tool                       | Input summary                                                                                                                                                                                                                                                                  | Kind     | `requirePermission`                                                                                                                            | `platform_audit_log` action (`actor_kind: 'agent'`)                                                            |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `catalog_search_places`    | `q?` text · `country_code?` · `kind?` · `status?` · `bbox?` `[w,s,e,n]` · `amenities?` (all must match, ≤ 8 keys) · `cursor?` · `limit?`. Query plan and its bounds: **§8.6**                                                                                                  | read     | `{ catalog: ['read'] }`                                                                                                                        | none - see §8.3                                                                                                |
| `catalog_get_place`        | `id` or `slug` (exactly one) · `include_sources?` · `include_history?`                                                                                                                                                                                                         | read     | `{ catalog: ['read'] }`                                                                                                                        | none - see §8.3                                                                                                |
| `catalog_upsert_place`     | `id?` (update when present) · every writable column of §3 except `status`, `licence`, `attribution`, `geohash`, `name_normalised`, `dedupe_key`, `published_at` (all derived) · `sources[]` each `{ source_slug, external_id, source_url, source_name, licence, attribution }` | mutation | `{ catalog: ['write'] }`                                                                                                                       | `catalog_place.created` / `catalog_place.updated` (+ `catalog_place.licence_escalated` when §5.4 rule 3 fires) |
| `catalog_set_place_status` | `id` · `status` (`review` \| `published` \| `retired` \| `ingested`) · `reason?`                                                                                                                                                                                               | mutation | `{ catalog: ['publish'] }` when either end of the transition is `published`, `{ catalog: ['write'] }` otherwise - the rule stated once in §7.2 | `catalog_place.published` / `catalog_place.retired` / `catalog_place.status_changed`                           |
| `catalog_list_ingest`      | `source_slug?` · `run_id?` · `status?` · `cursor?` · `limit?`                                                                                                                                                                                                                  | read     | `{ catalog: ['read'] }`                                                                                                                        | none - see §8.3                                                                                                |
| `catalog_promote_ingest`   | `ingest_id` · `mode` (`create` \| `merge` \| `reject`) · `target_place_id` (required for `merge`) · `reason` (required for `reject`) · `overrides?` (a partial §3 record)                                                                                                      | mutation | `{ catalog: ['write'] }`                                                                                                                       | `catalog_ingest.promoted` / `catalog_ingest.merged` / `catalog_ingest.rejected`                                |
| `packs_list`               | `status?` · `country_code?` · `cursor?` · `limit?`                                                                                                                                                                                                                             | read     | `{ pack: ['read'] }`                                                                                                                           | none - see §8.3                                                                                                |
| `packs_create`             | `slug` · `name` · `description` · `country_codes[]` · `price_minor` · `currency` · `polar_product_id?`                                                                                                                                                                         | mutation | `{ pack: ['write'] }`                                                                                                                          | `place_pack.created`                                                                                           |
| `packs_set_places`         | `pack_id` · `place_ids[]` in display order, 1-200 entries                                                                                                                                                                                                                      | mutation | `{ pack: ['write'] }`                                                                                                                          | `place_pack.places_set`                                                                                        |
| `packs_publish`            | `pack_id`                                                                                                                                                                                                                                                                      | mutation | `{ pack: ['publish'] }`                                                                                                                        | `place_pack.published`                                                                                         |
| `sources_list`             | `enabled?` · `cursor?` · `limit?`                                                                                                                                                                                                                                              | read     | `{ source: ['read'] }`                                                                                                                         | none - see §8.3                                                                                                |
| `sources_run`              | `source_slug` · `max_pages?` (clamped to the source's `max_pages_per_run`)                                                                                                                                                                                                     | mutation | `{ source: ['run'] }`                                                                                                                          | `catalog_source.run_started`                                                                                   |

`packs_create` and `packs_publish` touch what we sell, and `packs_publish` refuses a pack whose
member places are not all `published` - so the human-or-`curator` rule of §7.1 covers the pack
surface transitively as well as directly.

Every statement named above is drawn from the closed dictionary in `docs/ACCESS.md` §1.1
(`catalog: ['read','write','publish']`, `pack: ['read','write','publish']`,
`source: ['read','run']`) and this document introduces none of its own. `catalog:read` is what
gates the whole back office: a `published` row needs no statement because it is reachable through
the public projections, and everything that is not published, plus every mutation, is behind these
statements. `user` holds none of them, so there is no MCP tool a `user`-role token can call. Where
the two documents ever disagree about a **statement**, `docs/ACCESS.md` §1.1 wins and this table is
the thing that gets corrected - exactly as `docs/ACCESS.md` §4.1 wins on the columns of
`platform_audit_log` (§2.12).

The last column is the exception, and it runs the other way. The thirteen action names above -
`catalog_place.created`, `catalog_place.updated`, `catalog_place.licence_escalated`,
`catalog_place.published`, `catalog_place.retired`, `catalog_place.status_changed`,
`catalog_ingest.promoted`, `catalog_ingest.merged`, `catalog_ingest.rejected`,
`place_pack.created`, `place_pack.places_set`, `place_pack.published` and
`catalog_source.run_started` - are **defined here**, they are the closed catalogue vocabulary, and
`docs/ACCESS.md` §4.2 reproduces them from this table rather than the reverse. They are two
segments, `<entity_type>.<verb_in_past_tense>`, because that is the grammar `src/server/repos/**`
already writes (`place.created`, `trip.created`, `trip.archived`, `trip.hijacked`,
`billing.plan_changed`, `member.added`, `expense.created`, `journey.published`,
`reservation.confirmed`) and one audit surface with two grammars is a surface nobody can grep.

### 8.5 Response caps, as numbers

- **200 records maximum in any single response.** `limit` defaults to `50` and is clamped to
  `200`; a caller asking for more gets 200 records and a `nextCursor`, not an error.
- **262 144 bytes (256 KiB)** is the hard cut-off on the serialised JSON `result`. The server
  assembles the record list, measures the encoded byte length, and if it exceeds the cut-off it
  drops whole records from the tail until it fits, returning a `nextCursor` positioned at the
  first dropped record. It never returns a truncated record and never returns a half-encoded
  string. If a **single** record cannot fit under the cut-off, that is `-31004`.
- **1 048 576 bytes (1 MiB)** is the maximum accepted request body. A larger body is rejected with
  **HTTP 413** before any JSON parsing happens.
- `catalog_get_place` with `include_history` returns at most the **50** most recent audit entries.

### 8.6 The query plan behind `catalog_search_places`

`catalog_search_places` is the tool an agent reaches for first, and it is the one whose filter set
does not map one-to-one onto B-tree indexes. This subsection is its plan, stated as a contract
rather than left to whoever writes the repository: **every execution resolves one driving index,
reads a bounded candidate window through it, and applies everything else as a residual filter
inside that window.** There is no execution that scans `catalog_places`.

#### The driving filter, resolved in a fixed order

First match wins. The order is by selectivity, and it is not negotiated per call:

| #   | Caller supplied | Driving predicate                                                       | Index                                                                 | Cursor tuple            |
| --- | --------------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------- | ----------------------- |
| 1   | `bbox`          | Up to 32 geohash prefix ranges covering the box (below)                 | `index(status, geohash, id)` with `status`, else `index(geohash, id)` | `(geohash, id)`         |
| 2   | `q`, no `bbox`  | `name_normalised >= n AND name_normalised < n \|\| '{'`                 | `index(name_normalised, id)`                                          | `(name_normalised, id)` |
| 3   | `country_code`  | `country_code = ?`, plus `kind` and `status` as further leading columns | `index(country_code, kind, status, id)`                               | `(kind, status, id)`    |
| 4   | `kind` only     | `kind = ?`, plus `status`                                               | `index(kind, status, id)`                                             | `(status, id)`          |
| 5   | `status` only   | `status = ?`, newest first                                              | `index(status, updated_at, id)`                                       | `(updated_at, id)`      |
| 6   | nothing         | `id > ?` - a primary-key walk                                           | primary key                                                           | `(id)`                  |

One rule generates all six cells: **the cursor carries the driving index's columns from the first
one this plan does not pin to a single value, down to and including `id`.** That is the tuple the
index delivers rows in, so it is the only tuple a keyset resume can compare against. Row 1 pins
`status` and therefore carries `(geohash, id)` rather than `(status, geohash, id)`; row 2 pins
nothing, because `q` is a range and not an equality, so it carries `name_normalised` itself; row 5
pins `status` and carries `(updated_at, id)`. The candidate window orders by that same tuple and
resumes with one row-value comparison against it - `where (kind, status, id) > (?, ?, ?)` - which
SQLite has served as a single index range since 3.15.

Rows 3 and 4 keep `kind` and `status` in the tuple even though a caller may pin them, and that is
deliberate: both are **optional** inputs (§8.4), so a cursor whose arity followed them would change
shape between one call and the next. A pinned column simply compares equal and costs nothing; an
unpinned one is the whole reason the cursor exists. An `id`-only cursor is what this rule exists to
forbid. With only `country_code` supplied, the index delivers rows ordered by `(kind, status, id)`
within the country, and `id > ?` is not a range on that: D1 seeks on `country_code` and applies the
`id` test as a residual across the entire group, so page 2 re-reads rows page 1 already returned
**and** permanently skips every row whose `id` sorts below the cursor but whose `(kind, status)`
sorts after it. Row 4 fails identically whenever `status` is omitted. Row 6 may carry an `id` alone
only because there the driving index **is** the primary key and `newId()` is time-sortable.

Row 5 walks its index backwards, so its comparison is `<` and every component of its ordering is
descending. SQLite reads an ascending index in reverse, so that costs nothing and adds no
eleventh index to §3's ten.

Row 6 is a real, cheap plan and not a loophole: a keyset walk of the primary key reads exactly the
rows it returns, in order, with no sort. It is how an agent enumerates the catalogue, and it is
bounded by the same window as everything else.

#### The bbox cover, and the Z-order trap it avoids

A geohash is a Z-order curve, so the naive plan - take the box's lowest and highest cell and issue
one range between them - is wrong in the expensive direction: a box straddling a high-order bit
boundary produces a range covering most of the curve, which is a full scan wearing an index's
clothes. Instead:

1. Choose the largest precision `p` in `3 … 7` whose cells cover the box in **32 cells or fewer**.
   Cell sizes are `1.406°` at `p = 3`, `0.352° × 0.176°` at 4, `0.0439°` at 5,
   `0.010986° × 0.005493°` at 6 and `0.001373°` at 7 (§6.1).
2. Emit one range per covering cell: `geohash >= '<cell>' AND geohash < '<cell>' || '{'`. `{` is
   `0x7B`, the first ASCII character above `z`, and every geohash character is in
   `0123456789bcdefghjkmnpqrstuvwxyz`, so the upper bound is exact and no cell leaks into its
   neighbour.
3. A `bbox` wider than **5° of longitude or 5° of latitude** is rejected with `-32602`. Five
   degrees is about 556 km of latitude and about 343 km of longitude at 52°N - a generous map
   viewport - and it is the figure that makes step 1 always terminate at `p >= 3`: a 5° box needs
   at most 5 × 5 = 25 cells at `p = 3`, inside the 32-cell budget. Without that cap the cover
   would fall back to `p = 1`, whose cells are 45° across, and the "cover" would be the table.

The exact `lat`/`lng` box test is a residual, because a geohash cell overhangs the box at its
edges. The cells find the candidates; the arithmetic decides.

#### The candidate window, which is what makes the residuals safe

Every plan above is issued as a bounded inner query with the residuals applied outside it:

```sql
select * from (
  select * from catalog_places
  where <driving predicate>          -- always an index range
  order by <driving tuple>
  limit 5000                          -- the candidate window
)
where <residual predicates>           -- exact bbox, amenity containment, unindexed narrowing
order by <driving tuple>
limit :limit;                         -- <= 200, per §8.5
```

The inner `limit` is what bounds the work: it caps rows examined, not rows returned, which is the
distinction a single-statement `WHERE … LIMIT 50` gets wrong. **The window is 5 000 rows per
execution.** When the bbox path issues `N` ranges the budget is divided, `ceil(5000 / N)` each, so
the total is unchanged whether the box needs one cell or thirty-two.

When the inner query returns a full window, the tool answers with the records it found, a
`nextCursor` positioned at the last **examined** row, and `partial: true`. That is a normal
result, not an error: a caller that follows the cursor sees every match, and a caller that stops
knows it stopped early. A search never fails because the data was awkwardly distributed.

#### The residual predicates, and why they are exact

- **`amenities`** - `instr(amenities, '"' || ? || '"') > 0`, one term per requested key, ANDed;
  at most 8 keys, more is `-32602`. This is exact rather than approximate because `amenities` is a
  JSON array of `snake_case` keys written sorted and de-duplicated (§3): a key contains no quote,
  so the quoted needle `"fresh_water_fill"` matches a member and nothing else - `"toilets"` cannot
  be found inside `"pit_toilet"`. Set containment has no B-tree form in SQLite; the honest options
  were a join table or a residual, and a residual inside a bounded window costs one table less.
- **Exact `bbox`** - `lat` and `lng` compared against the four bounds, trimming the cell overhang.
- **`status`, `kind`, `country_code`** when the driving index did not already consume them.

#### `q` is a prefix match, deliberately

`q` is normalised by the §6.2 pipeline and matched as a **prefix**, so "zalew" finds
"zalew-wapienny" and "wapienny" does not. Cloudflare's own D1 index guidance is the reason: a
leading `%` in `LIKE '%term%'` defeats a B-tree and forces a scan. Substring and fuzzy matching
are a named follow-up (§13.10) and would need an FTS5 table with the trigram tokenizer - which D1
supports, at a storage and write cost that has to be measured before it is taken, not assumed.

#### The same rule, applied to the other read tools

- **`packs_list`** drives on `index(status, published_at, id)`; `country_code` is a residual
  `instr(country_codes, '"' || ? || '"') > 0` against the same JSON-array shape. `place_packs` is
  a table of tens of rows, so the window is never reached - but the plan is the same one, because
  a second pattern is a second thing to get wrong.
- **`catalog_list_ingest`** drives on `index(run_id, status, id)` when `run_id` is given,
  `index(source_id, created_at, id)` when only `source_slug` is, and
  `index(status, created_at, id)` otherwise.
- **`sources_list`** drives on `index(enabled, last_run_at, id)`. Three sources; the plan is a
  formality, and it is stated so that the formality is what a builder copies.

#### How this is tested, not asserted

Phase E ships one test per row of the driving-filter table that runs `EXPLAIN QUERY PLAN` against
a seeded D1 database and asserts the output contains `SEARCH catalog_places USING INDEX` and does
**not** contain `SCAN catalog_places`. A second test asserts `meta.rows_read` stays under 5 200
(the window plus the residual page) for a search that matches nothing across a 50 000-row fixture.
An index that stops being used is then a red test, not a slow month.

---

## 9. Transport facts, verified

Everything in this section was read from the Model Context Protocol specification at
`modelcontextprotocol.io` on **2026-08-21**, not recalled. Each claim names its rule so a builder
can re-check it against the same page.

### 9.1 Protocol versions we speak

The **current** protocol revision is **`2026-07-28`**. Revisions `2025-11-25` and earlier are the
handshake-based ("legacy") era; `2026-07-28` removed the `initialize` handshake, the GET stream
endpoint and protocol-level sessions, and moved the version onto every request.

The specification's own compatibility matrix says a legacy client talking to a modern-only server
**fails**, and legacy clients have no fall-forward mechanism. Since the point of this server is to
be usable from a client today, ours is **dual-era**. The closed set of versions it returns and
accepts is:

```
2026-07-28   2025-11-25   2025-06-18
```

- `2026-07-28` is what the mandatory `server/discover` RPC reports first in `supported`, and what
  the server echoes in `_meta["io.modelcontextprotocol/serverInfo"]` on every result.
- A modern request carries the version in **both** the `MCP-Protocol-Version` HTTP header and
  `params._meta["io.modelcontextprotocol/protocolVersion"]`, and the two **MUST** match.
- A legacy client's `initialize` selects legacy semantics and the result echoes back whichever of
  `2025-11-25` or `2025-06-18` it asked for.

#### Era resolution, which happens before any validation

Being dual-era is a claim the request pipeline has to honour, and it is easy to write a server
that advertises two eras and then rejects one of them in its first ten lines. The specification
settles how a dual-era server decides: it "selects its behavior from how the client opens" - a
request carrying modern per-request `_meta` is served under this revision, and an `initialize`
request selects legacy semantics. Era is therefore resolved **first**, from the body and the
header together, and only then is the request validated under the rules of the era it belongs to:

| #   | Condition, evaluated in this order                                   | Era resolved                                                                                                                                                                                              |
| --- | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `method === "initialize"`                                            | **Legacy**, whatever headers are present. A legacy `initialize` has no `MCP-Protocol-Version` header - the version is negotiated in `params.protocolVersion` - so this case is checked before the header. |
| 2   | `MCP-Protocol-Version: 2026-07-28`                                   | **Modern.**                                                                                                                                                                                               |
| 3   | `MCP-Protocol-Version: 2025-11-25` or `2025-06-18`                   | **Legacy**, post-handshake. These are the values a legacy client sends on every request after its `initialize`.                                                                                           |
| 4   | `MCP-Protocol-Version` present with any other value                  | Neither. `400` + `-32022` (§9.5).                                                                                                                                                                         |
| 5   | No `MCP-Protocol-Version` header, and the method is not `initialize` | Neither. A required header is missing: `400` + `-32020` (`HeaderMismatch`, §9.5). No version is echoed back, because the client named none. See below.                                                    |

Row 1 carries the whole dual-era guarantee. Resolving the era from the header alone would reject
every legacy `initialize` for a missing header, and a server that cannot be initialised by a legacy
client is not dual-era no matter what its version list says. Row 5 is the only "no header"
rejection, and it is scoped so that it can never swallow row 1.

Row 5 is `-32020` and not `-32022`, and the division is the specification's rather than ours. The
one escape on offer - treating a missing header as `2025-03-26` - is a **MAY** extended only to "a
server that supports clients implementing protocol versions earlier than `2025-06-18`", and our
closed set begins at `2025-06-18`, so it does not reach us: "a server that does not support such
clients **MUST** reject a request without the header per Server Validation", where a missing
required standard header is `400` with `-32020`. `-32022` means an _unsupported_ version and its
payload echoes `data.requested`, so using it here would both misname the fault and report a version
nobody sent - which is exactly the reading that makes a client retry the same request. Row 4, where
a version really was requested and really is unsupported, keeps `-32022`. This rejection is reached
during era resolution rather than under §9.5's modern-era scoping, because a request carrying no
version belongs to no era.

We assign no `Mcp-Session-Id` in either era. The legacy revisions make the session **optional**, so
a legacy client that receives no session id simply operates statelessly - which is what our tools
are anyway, since every one of them is a single synchronous request/response.

### 9.2 Batching is forbidden

The POST body **MUST** be a **single JSON-RPC object** - a request or a notification. Arrays are
not accepted. This is not our restriction: JSON-RPC batching was **removed from the specification
in revision `2025-06-18`** ("Remove support for JSON-RPC batching" is the first entry in that
revision's list of major changes), and `2026-07-28` tightens it further by also forbidding the
client from sending JSON-RPC _responses_ at all. Since every version in our supported set is
`2025-06-18` or later, **an array body is always an error**: HTTP `400` with JSON-RPC `-32600`
(Invalid Request).

### 9.3 Method handling

| Situation                                            | Response                                                                                                                                                                                                                                        |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST` with a valid single request                   | `200` with `Content-Type: application/json`. Our tools are synchronous, so we never open an SSE response stream.                                                                                                                                |
| `POST` whose body is a notification we accept        | **`202 Accepted` with an empty body.**                                                                                                                                                                                                          |
| `POST` whose body is a notification we cannot accept | `400`, body **MAY** be a JSON-RPC error with no `id`.                                                                                                                                                                                           |
| `GET` on the MCP endpoint                            | **`405 Method Not Allowed`.** `2026-07-28` removed the GET stream outright; under the legacy revisions `405` is the documented way to say "no SSE stream here". Both eras land on the same answer, which is why declining SSE costs us nothing. |
| `DELETE` on the MCP endpoint                         | `405`. There are no protocol-level sessions to terminate.                                                                                                                                                                                       |
| `Mcp-Session-Id` on a request                        | Ignored. We never mint one and never echo one.                                                                                                                                                                                                  |
| `Last-Event-ID` on a request                         | Ignored. Streams are not resumable.                                                                                                                                                                                                             |
| An RPC method we do not implement, modern era        | **HTTP `404`** with JSON-RPC `-32601` (Method not found). The JSON-RPC body is what distinguishes us from a legacy HTTP+SSE server that simply does not host this path.                                                                         |
| An RPC method we do not implement, legacy era        | **HTTP `200`** with JSON-RPC `-32601`. The `404` rule is a `2026-07-28` addition; a legacy client is entitled to a transport success carrying an application-level error, and would read a `404` as "wrong URL".                                |

### 9.4 Origin validation is mandatory

Servers **MUST** validate the `Origin` header on every incoming connection to prevent **DNS
rebinding** attacks. Ours validates against an allowlist of our own origins.

- `Origin` present and not on the allowlist → **HTTP `403 Forbidden`**. The body **MAY** be a
  JSON-RPC error response with no `id`; ours is.
- `Origin` absent (the normal case for a CLI client, which is not a browser) → the request
  proceeds to bearer-token authentication.

The status code matters: `403` for a bad Origin, `401` for a bad token, `400` for a malformed or
mis-versioned request. Three different failures, three different codes.

### 9.5 Version and header validation

Every rule in this subsection is scoped to an era by §9.1, and the scoping is load-bearing: the
`2026-07-28` header obligations did not exist in `2025-06-18` or `2025-11-25`, so applying them to
a legacy request would reject traffic the specification says a dual-era server must serve. The
specification agrees explicitly - it tells intermediaries to check that `MCP-Protocol-Version`
"indicates a version that requires header-body validation" before enforcing it.

**Both eras:**

- **Unsupported protocol version → HTTP `400` _carrying_ a JSON-RPC error**, code `-32022`
  (`UnsupportedProtocolVersion`), whose `data.supported` lists our three versions and whose
  `data.requested` echoes theirs. It is `400` **and** a JSON-RPC error, not `400` instead of one:
  the specification's backward-compatibility rules depend on that body being present, because a
  client inspects it to tell a modern server from a legacy one before deciding whether to fall
  back. A bare `400` with an empty body would make well-behaved clients downgrade to `initialize`
  against a server that speaks the modern protocol.

**Modern era (`2026-07-28`) only:**

- `MCP-Protocol-Version` header disagreeing with the body's
  `_meta["io.modelcontextprotocol/protocolVersion"]`, or a missing required header - which for us
  means `MCP-Protocol-Version`, `Mcp-Method` on every request, and `Mcp-Name` on `tools/call` -
  → **HTTP `400` with JSON-RPC `-32020` (`HeaderMismatch`)**. `Mcp-Method` mirrors `method`;
  `Mcp-Name` mirrors `params.name`. A value carried in the `=?base64?…?=` sentinel form is decoded
  before comparison. We annotate no tool parameter with `x-mcp-header`, so no `Mcp-Param-*` header
  is ever expected and any that arrives is ignored.
- A request missing a required `_meta` field (`protocolVersion`, `clientCapabilities`) → `400`
  with `-32602`.
- A request needing a client capability it did not declare → `400` with `-32021`
  (`MissingRequiredClientCapability`). Our tools need none, so this is defined and unreachable.

**Legacy era (`2025-11-25`, `2025-06-18`) only:**

- `Mcp-Method`, `Mcp-Name` and `_meta["io.modelcontextprotocol/protocolVersion"]` carry no
  protocol meaning in these revisions. They are **not required**, and if a client sends them
  anyway they are ignored rather than validated - there is nothing to validate them against.
- `initialize` negotiates the version in the body. We answer with the same version when it is one
  of ours; when it is not, we answer with `2025-11-25`, the newest legacy revision we speak, which
  is the legacy negotiation rule (the client then continues or disconnects). We do not return
  `-32022` to an `initialize`, because a legacy client has no fall-forward mechanism and would
  surface the error rather than retry.
- The version chosen at `initialize` is echoed by the client in `MCP-Protocol-Version` on every
  subsequent request, which is how row 3 of §9.1 recognises it. A mismatch against a version we do
  not speak is the row-4 rejection.

### 9.6 Methods implemented

Modern era: `server/discover`, `tools/list`, `tools/call`, `ping`. Legacy era: `initialize`,
`notifications/initialized`, `tools/list`, `tools/call`, `ping`. We expose no resources, no
prompts, no sampling, no elicitation and no `subscriptions/listen` - the catalogue tools are
synchronous request/response, and every capability we do not advertise is a capability we do not
have to keep correct.

---

## 10. Client configuration

### 10.1 Claude Code - ready to paste

```json
{
  "mcpServers": {
    "planned-travel": {
      "type": "http",
      "url": "https://planned.travel/api/mcp",
      "headers": {
        "Authorization": "Bearer <paste-your-planned-travel-mcp-token-here>"
      }
    }
  }
}
```

The token above is a placeholder and is meant to look like one. A real `pt_mcp_…` value never
appears in this repository, in this document, or in any file that is committed - the same rule
`.dev.vars.example` states for secrets.

**Which file.** Claude Code reads three places, and the choice is a security decision:

| Scope           | File                                                       | Shared                       |
| --------------- | ---------------------------------------------------------- | ---------------------------- |
| Local (default) | `~/.claude.json`, under `projects."<abs path>".mcpServers` | No                           |
| Project         | `.mcp.json` in the repository root                         | **Yes, via version control** |
| User            | `~/.claude.json`, top-level `mcpServers`                   | No                           |

Put the entry in **`~/.claude.json`** (local or user scope). **Do not put a bearer token in
`.mcp.json`** - that file is meant to be committed, and committing it would publish a credential
that carries its owner's entire platform role. If the team wants a shared project entry, use
`headersHelper` to mint the header from a local secret store instead of `headers`.

**CLI equivalent**, which writes the same entry for you:

```bash
claude mcp add --transport http planned-travel https://planned.travel/api/mcp \
  --header "Authorization: Bearer <paste-your-planned-travel-mcp-token-here>"
```

Add `--scope user` to make it available in every project. Claude Code does not trim whitespace
inside `headers.Authorization`, so a stray leading or trailing space in a pasted token produces a
`401` that looks like a server fault.

**Omitting `type` is a configuration error**, not a tolerated shorthand. Claude Code reads an entry
with no `type` as a **stdio** server, skips it, and reports:

```
MCP server "planned-travel" has a "url" but no "type"; add "type": "http" (or "sse" / "ws") to this entry
```

`"type": "streamable-http"` is accepted as an alias for `"http"`, because that is the name the MCP
specification uses for this transport.

### 10.2 Claude Desktop

Claude Desktop's own documented path for a **remote** MCP server is **Settings → Connectors → Add
custom connector**, where you paste `https://planned.travel/api/mcp`. That connector state is held
by the application and is deliberately not written to a configuration file, and the dialog offers
no field for a static bearer header - it expects the server to run an interactive authorisation
flow.

`claude_desktop_config.json` - at `~/Library/Application Support/Claude/claude_desktop_config.json`
on macOS and `%APPDATA%\Claude\claude_desktop_config.json` on Windows - uses the same `mcpServers`
wrapper key, but its documented entry shape is a **stdio** server. To reach our endpoint from
Desktop with a static token today, bridge it:

```json
{
  "mcpServers": {
    "planned-travel": {
      "command": "npx",
      "args": [
        "-y",
        "mcp-remote",
        "https://planned.travel/api/mcp",
        "--header",
        "Authorization: Bearer <paste-your-planned-travel-mcp-token-here>"
      ]
    }
  }
}
```

`mcp-remote` is a client-side tool run by the user's own `npx`. It is not a dependency of this
repository and nothing in §3 of `docs/SPEC.md` is affected by it.

---

## 11. Firecrawl contract

Read from the vendor's current documentation at `docs.firecrawl.dev` on **2026-08-21**, and the
four pages behind §11.3 re-read on **2026-08-22**:
`/api-reference/v2-endpoint/crawl`, `/api-reference/v2-endpoint/batch-scrape`, `/webhooks/overview`
and `/webhooks/events`. Where an earlier internal note disagrees with what follows, this section is
the one that was checked - and where the vendor's own pages disagree with each other, §11.3 says
so instead of choosing quietly.

### 11.1 Which endpoint takes a webhook

`/v2/scrape` has **no `webhook` field**. A single-page scrape is request/response and returns its
result inline. Webhooks are a property of the long-running operations - `/v2/crawl` and
`/v2/batch/scrape` (and Extract, Agent and Monitor, which we do not use). Our pipeline therefore
uses `/v2/crawl` for discovery, because a Worker cannot sit and wait for a crawl, and `/v2/scrape`
inline inside a queue handler for a single detail page.

### 11.2 `formats` is a mixed array

`formats` takes plain strings and objects side by side, and **structured extraction is an object
inside it**, not a sibling field:

```json
{
  "url": "https://example.invalid/campsite/1",
  "formats": [
    "markdown",
    {
      "type": "json",
      "prompt": "Extract only factual fields about this camping place.",
      "schema": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "lat": { "type": "number" },
          "lng": { "type": "number" },
          "country_code": { "type": "string" }
        },
        "required": ["name", "lat", "lng"]
      }
    }
  ]
}
```

The extracted object comes back under `data.json`. Our schema is generated from the §3 field
dictionary and, per §5.1, **declares no free-text field** - so there is no slot a description could
arrive in even if the model wanted to produce one.

### 11.3 Events: the filter vocabulary and the payload vocabulary

Two different vocabularies, and confusing them is a real bug. The webhook object is
`{ url, headers?, metadata?, events? }`. Its `events` **filter** takes the short names; the
delivered payload's `type` carries the **prefixed** names, which are per-operation:

| Short `events` name | Payload `type` on a crawl | Payload `type` on a batch scrape | In the `events` enum of both endpoints? |
| ------------------- | ------------------------- | -------------------------------- | --------------------------------------- |
| `started`           | `crawl.started`           | `batch_scrape.started`           | **yes** - we subscribe                  |
| `page`              | `crawl.page`              | `batch_scrape.page`              | **yes** - we subscribe                  |
| `completed`         | `crawl.completed`         | `batch_scrape.completed`         | **yes** - we subscribe                  |
| `failed`            | `crawl.failed`            | `batch_scrape.failed`            | **yes** - we subscribe, but see below   |

**The fourth row is documented twice by the vendor, differently, and both pages were read.** The
API reference for `POST /v2/crawl` (`/api-reference/v2-endpoint/crawl`) declares the
`webhook.events` enum as exactly
`completed`, `page`, `failed`, `started`, and its own field description reads: "This will trigger
for crawl started (`crawl.started`), every page crawled (`crawl.page`) and when the crawl is
completed (`crawl.completed` or `crawl.failed`)." The API reference for `POST /v2/batch/scrape`
declares the identical enum and names `batch_scrape.failed` in the same sentence. The webhook
guide pages - `docs.firecrawl.dev/webhooks/overview` and `/webhooks/events` - list only `started`,
`page` and `completed` for those two families, and document a `failed` payload solely for Extract
(`extract.failed`) and Agent (`agent.failed`).

Both statements are the vendor's. They cannot both be complete, and this document does not pick
the convenient one:

- **`failed` is safe to send.** It is a member of the request schema's enum on both endpoints, so
  including it in `events` cannot be rejected as an invalid value. There is no version of this
  disagreement in which subscribing costs us anything.
- **`crawl.failed` is not safe to rely on.** A payload type named in one page's field description
  and absent from the two pages that exist to enumerate payload types is not a delivery guarantee.
  A handler must accept it if it arrives and must not be the only thing that closes a run.

So the adapter subscribes to all four names, and the receiver switches on the payload `type` with
a `crawl.failed` / `batch_scrape.failed` branch that closes the run as `failed` and copies the
envelope's `error`. That branch is written, tested against a synthetic delivery, and expected to
sit idle.

**The run's terminal status still does not depend on it.** `catalog_runs.status = 'failed'` is
reached from our side, by the poll-and-watchdog sequence in §2.4, exactly as it would be if the
event did not exist - because on the vendor's other two pages it does not. A `crawl.failed`
delivery is then one more idempotent path to a row those steps would have reached anyway, which is
the property §2.4 already requires of the `completed` delivery. Designing the other way round -
watchdog only if the event turns out to be fictional - would mean discovering in production which
page was right.

Other operations carry further names of their own (Agent adds `cancelled`, Monitor adds
`check.completed`), so code that switches on the payload `type` must not assume the crawl family
is the whole space; an unrecognised `type` is logged and acknowledged with `200`, never treated as
a failure. The payload envelope is `{ success, type, id, data, metadata, error }`, and `id`
correlates to `catalog_runs.firecrawl_job_id`. `success: false` on a page delivery marks that one
page failed; it does not terminate the run, and it increments `catalog_runs.failed`.

### 11.4 Two different user agents, and only one of them is ours

This distinction is the one most likely to be got wrong:

| Field                   | Where it lives                | What it actually does                                                                                                                                                               |
| ----------------------- | ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `robotsUserAgent`       | **top level** of `/v2/crawl`  | Fetches `robots.txt` **as** this agent and matches its allow/disallow rules against it. It changes robots evaluation only. It does **not** set the User-Agent on the page requests. |
| `scrapeOptions.headers` | nested inside `scrapeOptions` | The actual outgoing request headers, including the `User-Agent` that a site's log will record. **This** is where planned.travel identifies itself.                                  |

So identifying ourselves honestly means setting `scrapeOptions.headers["User-Agent"]` to a string
naming planned.travel and a contact URL, and setting `robotsUserAgent` to the same token so that
the rules we obey are the rules written for the agent we present. Setting only `robotsUserAgent`
would leave us obeying rules addressed to a name we never actually send - and it is an
enterprise-tier field, so an adapter must behave correctly when the API ignores it.

`ignoreRobotsTxt` exists and we never set it. `delay` (seconds between scrapes, and it forces
concurrency to 1) carries `catalog_sources.crawl_delay_seconds`; `maxConcurrency` and our own
`max_pages_per_run` cap the rest.

### 11.5 Webhook signature

Every delivery carries:

```
X-Firecrawl-Signature: sha256=<hex>
```

HMAC-SHA256 over the **raw request body**, hex digest, keyed by `FIRECRAWL_WEBHOOK_SECRET` - one
account-wide value, not one per endpoint. Verification rules, all mandatory:

1. Read the body as raw bytes. **Never** re-serialise the parsed JSON to verify -
   `JSON.stringify(parsed)` is the vendor's own named cause of spurious failures.
2. Require the `sha256=` prefix; any other algorithm prefix is a rejection, not a fallback.
3. Compare in **constant time** (`timingSafeEqual`; `nodejs_compat` is on, so `node:crypto` is
   available).
4. A missing or mismatched signature is **HTTP 401**, with no body and no detail about which check
   failed.

Firecrawl sends no timestamp header and no nonce, so the signature alone gives **no replay
protection**. Ours comes from our side: the `(job id, page url, checksum)` triple is claimed in KV
before any write, and a repeat delivery is acknowledged with `200` and does nothing. Delivery
expects a `2xx` within **10 seconds**, with retries at 1, 5 and 15 minutes; after three failed
retries that delivery is marked failed and is not attempted again. That is a per-delivery
outcome - Firecrawl does not document disabling the endpoint, so a failed delivery must not be
described as a deactivation.

---

## 12. Retention

The raw third-party payload in `catalog_ingest.payload` is the only third-party content we ever
hold, and holding it for longer than it is useful contradicts the facts-only minimisation of §5.1.

| Data                                                                                                                           | Window                        | What happens                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------ | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `catalog_ingest.payload` on a row in a terminal status (`promoted`, `rejected`, `duplicate`)                                   | **30 days** from `updated_at` | The column is set to `NULL` and `payload_purged_at` is stamped.                                                                                                  |
| `catalog_ingest.payload` on a row still `pending`                                                                              | **90 days** from `created_at` | Same, and the row's status moves to `rejected` with `reject_reason = 'expired in review'`.                                                                       |
| The `catalog_ingest` row itself - `run_id`, `source_id`, `external_id`, `source_url`, `checksum`, `status`, `matched_place_id` | **400 days**                  | Retained, then deleted. These are our own metadata, not third-party content, and the `checksum` is what keeps re-ingestion idempotent after the payload is gone. |
| `catalog_runs`                                                                                                                 | **400 days**                  | Retained for operational history, then deleted with its remaining ingest rows.                                                                                   |

Thirty days is chosen because it spans four weekly scrape cycles: long enough to diagnose an
adapter regression against the exact bytes that produced a bad record, short enough that we are
not running a mirror of somebody else's site. Once the payload is gone the facts remain, the
provenance link remains, and the checksum still prevents a re-scrape from doing redundant work -
so nothing operational depends on the payload surviving.

The prune runs in the existing weekly retention cron, **`17 4 * * 1`**. That cron is **already
registered** in `wrangler.jsonc` - it is the third entry of `triggers.crons` and today prunes
expired backups and export artifacts - so phase D adds a catalogue branch to a handler that
already runs, and adds no cron for the prune.

The catalogue **scrape** is the different cron, **`0 4 * * 1`**, seventeen minutes earlier. That
one is genuinely absent from `wrangler.jsonc` and stays absent until phase D gives
`src/server/worker.ts` its `switch (controller.cron)` branch, per `docs/SPEC.md` §5 - registering
a trigger whose branch does not exist would schedule a weekly no-op. Ordering between the two is
incidental and neither depends on the other.

One deployment hazard to carry into phase D, because it is invisible until it bites: `wrangler
deploy` **replaces** the whole `crons` array for the environment it deploys, and `env.staging`
declares its own array - today a single entry, `0 3 * * *`, so staging does not even run the
`17 4 * * 1` prune that production runs. Adding `0 4 * * 1` therefore means editing **both**
arrays and restating each one in full; adding it to the top-level array alone leaves staging
without the scrape, and editing the staging array without restating its other entries silently
drops them.

---

## 13. Open contract items

Recorded here so a later round inherits them as decisions to make rather than as silence.

1. **`platform_audit_log` is a ninth global table.** `docs/SPEC.md` §5 declares its eight-table
   global list closed and, three paragraphs later, requires a `platform_audit_log` write inside
   every catalogue mutation. Both cannot be true. This document documents the nine tables it was
   asked to document, and describes `platform_audit_log` in §2.12 as a dependency it does not own.
   A round owning `docs/SPEC.md` must either admit the table to the list or amend the closure
   sentence; `docs/SPEC.md` is not in this item's ownership.
2. **`docs/PACKS-PLAN.md` says the MCP endpoint accepts "an object or a batch".** It does not, and
   cannot: batching was removed from the protocol in revision `2025-06-18`. §9.2 is the correct
   statement and the plan line is superseded.
3. **The protocol-version decision is made here, not inherited.** The plan predates the
   `2026-07-28` revision. §9.1 chooses a dual-era server because the specification's own
   compatibility matrix says a modern-only server cannot serve a legacy client at all. If a later
   round establishes that every client we care about is modern, dropping the legacy branch is a
   simplification worth taking - but it is a decision with evidence, not a default. Whichever way
   it goes, the choice has to be honoured by the pipeline: §9.1 resolves the era from the request
   before §9.5 validates it, because era-blind header validation turns a dual-era claim into a
   modern-only server that merely advertises two more versions.
4. **`2026-07-28` obligations are larger than the plan assumed**: a mandatory `server/discover`
   RPC, `Mcp-Method`/`Mcp-Name` header mirroring with server-side validation and `-32020`,
   per-request `_meta` versioning, and `404` + `-32601` for unknown methods - each of them scoped
   to the modern era only, so the phase E test matrix has two eras in it, not one. The
   hand-written, no-SDK decision still stands; the phase E estimate should account for these.
5. **Claude Desktop cannot take a `type: "http"` entry** in `claude_desktop_config.json`; its
   documented remote path is Settings → Connectors, which has no static-header field. §10.2
   documents the `mcp-remote` bridge instead of asserting a config shape the vendor does not
   document.
6. **Firecrawl's own documentation disagrees with itself about `crawl.failed`.** The `/v2/crawl`
   and `/v2/batch/scrape` API references declare `failed` in the `webhook.events` enum and name
   `crawl.failed` / `batch_scrape.failed` in the field description; `docs.firecrawl.dev/webhooks/overview`
   and `/webhooks/events` list only `started`, `page` and `completed` for those two families and
   document a failure payload solely for Extract and Agent. Both pages were read on 2026-08-22.
   §11.3 records the conflict rather than picking a side: we subscribe to `failed` (it is in the
   request enum, so it costs nothing), we handle the payload if it arrives, and §2.4's poll and
   6-hour watchdog remain the path that actually closes a run. The open item for a later round is
   empirical, not documentary - one deliberately failing crawl in a phase-D staging run settles
   which page is current, and whichever way it lands, the pipeline above already behaves
   correctly.
7. **The MCP token hashing construction is specified as HMAC-SHA256 keyed by the pepper**
   (§2.10), where `docs/PACKS-PLAN.md` says only "SHA-256 with `MCP_TOKEN_PEPPER`". HMAC is the
   correct construction for a keyed digest and is what the schema and tests should implement.
8. **`user.role` has no database default.** Better Auth's `admin` plugin declares the column
   `required: false` with no `defaultValue`, so the migration that adds it leaves pre-existing
   rows `NULL`. §2.1 coerces `NULL` to `'user'` at the boundary; `docs/ACCESS.md` owns the
   normative statement and should say the same thing.
9. **Settled, and recorded here only so the item is not reopened: an `agent`'s token is a
   foreign key.** `docs/ACCESS.md` §4.1 declares `token_id` (`text`, references
   `staff_api_tokens(id)`, `on delete set null`, indexed, non-`NULL` exactly when
   `actor_kind = 'agent'`) and `actor_role` as columns of `platform_audit_log`, and confines
   `user_agent` to a `User-Agent` header. "What did this token ever do" is a join. `docs/ACCESS.md`
   §4.1 is the owner of that column list and the only place it may change; this document states no
   column of its own.
10. **Substring and fuzzy place search is not in this contract.** §8.6 specifies `q` as a prefix
    match on `name_normalised`, because a leading wildcard defeats a B-tree on D1. Full substring
    search needs an FTS5 table with the trigram tokenizer, which D1 supports and which costs
    storage and a write on every place mutation. A later round should measure that against the
    catalogue's real size before adopting it; until then, prefix is the documented behaviour and
    the console's filter chips carry the load that free text otherwise would.
