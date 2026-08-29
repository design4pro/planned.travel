# planned.travel — Deployment runbook

First deploy, from an empty Cloudflare account to `https://planned.travel` serving traffic.
Every command is copy-pasteable; replace only the `ALL_CAPS` placeholders. Read
`docs/ARCHITECTURE.md` for _why_ these resources exist.

Two rules for this runbook:

- **Resource ids go into `wrangler.jsonc` and are committed.** They are not secrets.
- **Secrets never go into `wrangler.jsonc`.** They are set with `wrangler secret put`, and
  `.dev.vars.example` documents each one with the steps that obtain it. The template and §6 now
  describe the same list with no carve-out: phase A removed the superseded billing pair the
  template used to omit, so every name §6 sets is in the template and every name in the template
  is set here.

**One thing is not finished, and it is the one a first deploy will want to assume is.** §9.11's
sandbox acceptance matrix — eight rows covering subscribe, upgrade, downgrade, cancel, resume,
failed payment, the orders list and the Customer Portal — is **unwalked. Not one row is green.**
No credential was ever issued to a build round: `POLAR_ACCESS_TOKEN` and `POLAR_WEBHOOK_SECRET`
were empty by design, so the rounds that wrote the billing integration made no live API call and
received no live delivery. Everything §9 tells you to configure is correct and everything §9
tells you the Worker does is on disk; what nobody has yet observed is Polar agreeing. Read §9.11
before you ship anything that sells, and treat its checklist line in §16 as the gate it is —
a green `pnpm test` is evidence about our handler, never about the vendor.

---

## 0. Prerequisites

```bash
node --version          # 24.x or newer
pnpm --version          # 10.x or newer
pnpm install --frozen-lockfile
pnpm exec wrangler --version
pnpm exec wrangler login
pnpm exec wrangler whoami   # confirm the account you are about to bill
```

You also need:

- The `planned.travel` zone active in this Cloudflare account (Websites → Add a site, then move
  the nameservers). The Worker can deploy before the zone is active; the custom domain in §8
  cannot be attached until it is.
- **A decision, before any of the rest: does this deploy sell anything?** The Worker deploys,
  serves and signs people up with no payment provider configured at all — every workspace sits on
  `free` and the pricing page has nothing to buy. That is a legitimate first deploy, and it is the
  right one if the zone is not live yet. If the deploy _must_ take money, everything it needs is
  in §6 and §9, and there is exactly one provider to configure.
- A **Polar** organization with the four products of §9.1, plus a _separate_ sandbox
  organization for the acceptance walk in §9.11 — sandbox and production are different accounts
  and their product ids never match. Create both: §9.1 → §9.3 are dashboard configuration that
  needs none of our code, and doing them early costs nothing. Paid plans need the three `POLAR_*`
  secrets of §6 **and** the four `VITE_POLAR_PRODUCT_*` repository variables of §10; either half
  missing is a Worker that serves, signs people up and bills nobody.
- **Before you sell for real: §9.11.** Its eight-row sandbox matrix is the acceptance gate for the
  billing integration and **not one row has been walked** — no credential has been issued to a
  build round, so every row stands unverified. A green `pnpm test` is evidence about our handler,
  not about Polar. Walk it on staging against the sandbox organization before production takes a
  card.
- Only from **phase D**: a Firecrawl account for the weekly catalogue scrape (§15). The product
  deploys, serves and bills without one; §6 states exactly what degrades while it is absent.
- Workers Paid on the account. D1, KV, R2, Queues and SQLite-backed Durable Objects all have
  free allowances, but Queues and the $5 plan floor are what make the production configuration
  in `wrangler.jsonc` (5 retries, 4 consumers, 100% log sampling) legal and sane.

---

## 1. Create the D1 database

```bash
pnpm exec wrangler d1 create planned-travel-db
```

Copy the printed `database_id` into `wrangler.jsonc` → `d1_databases[0].database_id`, replacing
the `00000000-…` placeholder. Then, for staging:

```bash
pnpm exec wrangler d1 create planned-travel-db-staging
```

into `env.staging.d1_databases[0].database_id`.

Verify:

```bash
pnpm exec wrangler d1 list
```

---

## 2. Create the KV namespaces

Two namespaces per environment: the general cache and the session store. Keeping sessions
separate means a cache purge can never sign everyone out.

```bash
pnpm exec wrangler kv namespace create KV
pnpm exec wrangler kv namespace create SESSIONS
pnpm exec wrangler kv namespace create KV_STAGING
pnpm exec wrangler kv namespace create SESSIONS_STAGING
```

Each command prints an `id`. Put them in `wrangler.jsonc`:

| Printed for        | Goes to                                          |
| ------------------ | ------------------------------------------------ |
| `KV`               | `kv_namespaces[]` with `"binding": "KV"`         |
| `SESSIONS`         | `kv_namespaces[]` with `"binding": "SESSIONS"`   |
| `KV_STAGING`       | `env.staging.kv_namespaces[]` binding `KV`       |
| `SESSIONS_STAGING` | `env.staging.kv_namespaces[]` binding `SESSIONS` |

The binding _name_ in the config is what the code reads; the namespace _title_ above is only a
label in the dashboard.

Verify:

```bash
pnpm exec wrangler kv namespace list
```

---

## 3. Create the R2 buckets

```bash
pnpm exec wrangler r2 bucket create planned-travel-files
pnpm exec wrangler r2 bucket create planned-travel-tiles
pnpm exec wrangler r2 bucket create planned-travel-files-staging
```

Staging deliberately shares the production tiles bucket: the basemap is large, immutable and
public, and there is nothing to isolate. Bucket names are already in `wrangler.jsonc`, so
nothing to edit here.

Verify:

```bash
pnpm exec wrangler r2 bucket list
```

---

## 4. Create the queues

The consumer configuration in `wrangler.jsonc` references a dead-letter queue, so both must
exist before the first deploy.

```bash
pnpm exec wrangler queues create planned-travel-tasks
pnpm exec wrangler queues create planned-travel-tasks-dlq
pnpm exec wrangler queues create planned-travel-tasks-staging
pnpm exec wrangler queues create planned-travel-tasks-staging-dlq
```

Verify:

```bash
pnpm exec wrangler queues list
```

---

## 5. Generate and apply migrations

Drizzle generates SQL from `src/server/db/schema.ts` + `auth-schema.ts` into `./drizzle`, which
is the `migrations_dir` D1 reads.

```bash
pnpm db:generate                 # writes drizzle/0000_*.sql
git add drizzle && git commit -m "chore(db): generate initial migration"

pnpm db:migrate:local            # apply to the local Miniflare D1 first
pnpm exec wrangler d1 migrations list planned-travel-db --remote
pnpm db:migrate:remote           # apply to production D1
```

Confirm the schema landed:

```bash
pnpm exec wrangler d1 execute planned-travel-db --remote \
  --command "select name from sqlite_master where type='table' order by name;"
```

You should see **59 domain tables + 9 Better Auth tables** (`user`, `session`, `account`,
`verification`, `organization`, `member`, `invitation`, `passkey`, `two_factor`). Both numbers are
read off the schema rather than remembered: `grep -c 'sqliteTable(' src/server/db/schema.ts` prints
the first and the same command over `auth-schema.ts` prints the second. Migration `0004` moved the
domain count from 57 by adding `staff_api_tokens` and `platform_audit_log`.

**Migration policy: migrations are additive.** Add a column or a table; never rename or drop in
the same release that stops using it. Both the old and the new Worker version must be able to
serve against the schema, because there is a window during a deploy — and during a rollback —
where they do.

**What "the old reader" means, because getting this wrong is what makes the policy sound optional.**
The reader the policy protects is _the previous Worker's SQL_, not the rows in the table. Drizzle
generates a fixed column list into every statement, so a Worker that selects `stripe_customer_id`
fails with `no such column` against a schema that has renamed it — on the first query, whether the
table holds a million rows or none. An empty table removes the _backfill_ problem and the risk of
stranding a paying customer. It does not remove the reader.

**A non-additive migration is therefore allowed, but only on these terms:**

1. It is written down in the register in §12, with the migration number and the release it ships
   in, before it is applied to any environment.
2. That release is marked **rollback-unsafe past that migration**, and §12 carries the recipe for
   getting back across it.
3. A `drizzle-kit` output that recreates a table — `CREATE TABLE __new_<name>` … `DROP TABLE` …
   `RENAME TO` — counts as non-additive by this definition even when no column is dropped, because
   it is a drop and a rebuild. It also emits `PRAGMA foreign_keys=OFF/ON`, which D1 does not
   honour: D1 enforces foreign keys as if `PRAGMA foreign_keys = on` and a query cannot change that
   during a migration; the supported mechanism is `PRAGMA defer_foreign_keys = on`, valid to the
   end of the current transaction. **Read every generated file before committing it.** A pure
   `ALTER TABLE … ADD COLUMN` with no new constraint stays additive and avoids all of this; adding
   a `CHECK` in the same generate is what escalates drizzle-kit to a recreate.

**§12's register is the list.** A migration that is not in it is additive; a migration that is not
additive and not in it is a defect belonging to the round that generated it, and the fix is to add
the row before the release ships, not after someone needs a rollback. Five migrations exist and
two are registered, and the two fail differently — `0001` recreated a table, `0002` renamed three
columns — which is why §12 records the _kind_ of departure and not only the number. The other three
are absent on purpose. `0000` is the initial `CREATE TABLE` set. `0003` is three bare
`ALTER TABLE "subscriptions" ADD COLUMN` statements (`pending_plan`, `pending_interval`,
`pending_effective_at`) with no constraint, which is exactly the shape that stays additive. `0004`
is the same shape at larger scale: two `CREATE TABLE` statements for `staff_api_tokens` and
`platform_audit_log` with their indexes, then five bare column adds on `user` and `session` and one
`CREATE INDEX` — no `__new_`, no `DROP TABLE`, no `RENAME TO`, no `PRAGMA foreign_keys`. Its five
`CHECK` constraints are all inside the `CREATE TABLE` for `platform_audit_log`, which is not what
the paragraph above warns about: the escalation comes from adding a `CHECK` to a table that already
exists, and this one did not exist. Four of the five are the cross-column rules of
`docs/ACCESS.md` §4.1, written as two forward implications and their two converses because each of
§4.1's invariants says "exactly when" and a single implication only carries half of that; the
fifth closes `actor_kind` over its three values. `entity_type` and `action` carry none,
deliberately — §4.1 types those columns as plain text and keeps their vocabularies in §4.2, so a
ninth entity or a thirty-second action costs an amendment to that table rather than a recreate of
an append-only log. Both are narrowed with Drizzle's `$type` instead, which emits no SQL and
therefore appears nowhere in this file; a value outside either list fails `pnpm typecheck` at the
insert, and that is the whole of the guarantee for those two columns.

`0004` matches `docs/ACCESS.md` §4.1 line for line, including the one line that used to differ.
`platform_audit_log.token_id` ships as `ON DELETE restrict`, and §4.1's type column says
`on delete restrict` as well; §5 there carries the reasoning. The wording it replaced was
`on delete set null`, which named an outcome this table cannot produce: SQLite re-evaluates
`CHECK` constraints on the implicit `UPDATE` that `SET NULL` performs, and §4.1's two token rules
demand a non-`NULL` `token_id` on exactly the rows able to name one, so the parent `DELETE` was
refused either way - and refused against a constraint the caller never mentioned. Both files now
name the behaviour that was already happening, so there is nothing here for a deploy operator to
reconcile between them.

What `restrict` costs operationally: a `staff_api_tokens` row that any `platform_audit_log` row
attributes to cannot be hard-deleted. Nothing tries. `docs/ACCESS.md` §5 revokes a credential by
stamping `revoked_at` and never deleting the row, which is what keeps "which agent did this, on
whose authority, with which token" answerable in one indexed query.

---

## 6. Set every secret

**This section and `.dev.vars.example` describe the same secret list, with no carve-out.** The
template on disk carries every name below, including all six of the newer ones —
`POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET`, `POLAR_SERVER`, `FIRECRAWL_API_KEY`,
`FIRECRAWL_WEBHOOK_SECRET`, `MCP_TOKEN_PEPPER` — each with the acquisition steps for it, and its
header now claims completeness rather than an omission. Phase A is what closed the gap: the
superseded billing pair the template used to leave to this section is gone from the code that read
it, so there is nothing left for the two files to disagree about.

- Read `.dev.vars.example` for the **local** shape of every name below and for what each one buys.
  It is the file you copy to `.dev.vars` at the end of this section, and every entry is accurate.
  Its last section adds two names that are not secrets and are not set here — `APP_URL` and
  `TILES_ARCHIVE_KEY`, which exist only to override the `wrangler.jsonc` vars locally.
- `docs/SPEC.md` §5 says the complete secret list lives in `.dev.vars.example`. That is now true
  without qualification.

**One provider, and it is Polar.** There is no second billing path in the Worker and no
configuration in which one is live and the other is not:

| What the Worker reads             | Where it is read                                                                  | What happens when it is unset                                                                                                                                                                                                                                                                                                                                                                                              |
| --------------------------------- | --------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POLAR_ACCESS_TOKEN`              | `src/server/billing/polar.ts`, through `src/server/billing/runtime.cloudflare.ts` | The first **Upgrade** or **Manage billing** click throws `BillingConfigError`, whose message names the exact `wrangler secret put` command.                                                                                                                                                                                                                                                                                |
| `POLAR_WEBHOOK_SECRET`            | `src/server/billing/runtime.cloudflare.ts`, verified in `polar.ts`                | The webhook rejects every delivery, so nothing a customer pays for reaches D1. Do not go looking in the route file: `src/routes/api/polar/webhook.ts` names no binding of its own — it builds the runtime, hands the request to `handlePolarWebhook()`, and the accessor `polarWebhookSecret()` returns an empty string when the secret is unset, which `verifyWebhookSignature()` turns into a `400` rather than a `500`. |
| `POLAR_SERVER`                    | the same accessor; `resolvePolarOrigin()` in `polar.ts` validates it              | `BillingConfigError`, naming the command. Its domain is exactly `sandbox \| production` — anything else, including an empty string or a URL, raises the same error rather than guessing an origin.                                                                                                                                                                                                                         |
| four `VITE_POLAR_PRODUCT_*` (§10) | `src/lib/plans.ts`, inlined at **build** time                                     | `requirePrice()` throws, so the pricing page renders with nothing to buy. A build with them unset succeeds and deploys; nothing fails, there is simply nothing to sell.                                                                                                                                                                                                                                                    |

Secrets and build variables are two different failures with the same symptom. A deploy that sets
all three `POLAR_*` secrets and skips the four repository variables serves happily, signs people
up, and bills nobody.

For production:

```bash
# Required — the Worker is not correctly configured without these
openssl rand -base64 32 | pnpm exec wrangler secret put BETTER_AUTH_SECRET
pnpm exec wrangler secret put EMAIL_API_KEY               # transactional email provider

# Required for paid plans — the billing path the Worker actually calls (§9)
pnpm exec wrangler secret put POLAR_ACCESS_TOKEN          # polar_oat_…      — §9.2
pnpm exec wrangler secret put POLAR_WEBHOOK_SECRET        # endpoint secret  — §9.4
printf production | pnpm exec wrangler secret put POLAR_SERVER   # sandbox | production — §9.3
# …and the four VITE_POLAR_PRODUCT_* repository variables of §10, which are build-time
# and are not secrets. Both halves, or the pricing page has nothing to buy.

# Optional — each feature degrades cleanly when its secret is absent
pnpm exec wrangler secret put GOOGLE_CLIENT_ID
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET
pnpm exec wrangler secret put APPLE_CLIENT_ID
pnpm exec wrangler secret put APPLE_CLIENT_SECRET
pnpm exec wrangler secret put APPLE_APP_BUNDLE_IDENTIFIER
pnpm exec wrangler secret put CLOUDFLARE_ACCOUNT_ID       # nightly D1 backup
pnpm exec wrangler secret put CLOUDFLARE_API_TOKEN        # scoped: D1:read
pnpm exec wrangler secret put D1_DATABASE_ID              # the id from §1
pnpm exec wrangler secret put BROWSER_RENDERING_API_TOKEN # PDF export
pnpm exec wrangler secret put FIRECRAWL_API_KEY           # catalogue scrape — phase D, §15.1
pnpm exec wrangler secret put FIRECRAWL_WEBHOOK_SECRET    # crawl callbacks  — phase D, §15.2
openssl rand -base64 32 | pnpm exec wrangler secret put MCP_TOKEN_PEPPER  # phase E, §14.3
```

`POLAR_SERVER` is not a credential, and the general rule (the two rules at the head of this
runbook, and the header of `.dev.vars.example`) is that non-secret configuration belongs in the
`vars` block of `wrangler.jsonc`. It is kept here on purpose, and `docs/SPEC.md` §5 fixes the
exception: one file then switches the whole billing environment, and because sandbox and
production are separate Polar accounts, the environment selector and the token it pairs with must
never be able to drift apart across two files. Its value domain is exactly
`sandbox | production` — no URL, no `test`, no empty string.

What each optional secret costs when it is unset:

| Secret                     | Tier                                                                     | Degradation when unset                                                                                                                                                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `FIRECRAWL_API_KEY`        | Optional (phase D)                                                       | The weekly scrape cron logs `scrape disabled: no api key` and returns without enqueueing. No `catalog_runs` row is opened and no `catalog_ingest` row is written. Everything already `published` keeps serving; the catalogue simply stops growing.                                                                 |
| `FIRECRAWL_WEBHOOK_SECRET` | Optional (phase D), but **required whenever `FIRECRAWL_API_KEY` is set** | `/api/firecrawl/webhook` answers `401` to every delivery, so crawl results never land and each run stalls at `running` until its timeout sweeps it to `failed`. Setting the key without the secret is the one combination that fails silently-but-expensively: Firecrawl bills the crawl and we discard the result. |
| `MCP_TOKEN_PEPPER`         | Optional (phase E)                                                       | `/api/mcp` answers `503` to every request and the console hides **Issue token** entirely, because a token digest computed without the pepper would not match one computed with it. The console and the catalogue are unaffected; only the agent surface disappears.                                                 |

⚠️ **`MCP_TOKEN_PEPPER` rotates like `BETTER_AUTH_SECRET`, and with the same blast radius.**
Rotating `BETTER_AUTH_SECRET` logs everyone out; rotating `MCP_TOKEN_PEPPER` invalidates **every
issued staff API token at once**, because the stored digest is keyed by it (§14.3). There is no
partial rotation and no grace period — every agent integration breaks in the same second, and
every token has to be reissued and redistributed by hand. Rotate it only in response to a
suspected compromise of the token table, and tell the token holders first.

**Historical note, so a rollback is not walked blind.** Releases before phase A read a
`STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` pair and mounted a `/api/stripe/webhook` route.
Both secrets and that route are gone from the code, and §12's register says what a rollback onto
one of those releases would need. Do not set the old pair on a current Worker: nothing reads it,
`wrangler secret list` will show it forever, and it is one more name to confuse with the three
above.

Repeat with `--env staging` for the staging Worker, with the **sandbox** Polar organization
throughout: its own `POLAR_ACCESS_TOKEN`, its own `POLAR_WEBHOOK_SECRET`, and
`POLAR_SERVER=sandbox`. A production token in staging is not a degraded configuration, it is
a live charge.

Verify — the list must show every required name, and no secret values are ever printed back:

```bash
pnpm exec wrangler secret list
pnpm exec wrangler secret list --env staging
```

For local development, copy `.dev.vars.example` to `.dev.vars` and fill in test values.
`.dev.vars` is gitignored.

---

## 7. The basemap archive

`/api/tiles/*` serves a Protomaps `.pmtiles` archive out of the `TILES` bucket by HTTP range.
This is the one asset the product cannot build for itself, and the one place where a production
deploy differs materially from local development:

- **Local dev** uses a regional extract of the flagship trip's corridor — about 500 MB.
- **Production** either carries the whole planet in R2, or a set of regional extracts. §7.3
  states the trade-off in real numbers; pick one before the first deploy.

Nothing else has to be uploaded. The style declares neither `glyphs` nor `sprite` (see the
header of `src/lib/map/style.ts`): labels are rasterised in the browser with TinySDF in the
product's own UI font, and the cartography is label-only. `tileEndpoints()` still builds
`glyphs/` and `sprites/` URLs for the day a real pack lands in R2, but there is no pack to
publish today, and declaring one we cannot serve costs a failed request per glyph range.

### 7.1 Pin an upstream build

Protomaps publishes dated planet builds at `https://build.protomaps.com/<YYYYMMDD>.pmtiles`.
The dates rotate: only the last few builds stay up, and older dates 404. Verified on
2026-08-19 — `20260818` and `20260811` answered `200`, `20260812` and `20260801` answered `404`.

So: choose a build, record its date in the R2 object key and in this runbook's deploy log, and
keep the artefact you produced. Re-fetching last month's build is not an option.

```bash
# Confirm the build exists and see how big it is before committing to it.
curl -sI https://build.protomaps.com/20260818.pmtiles | grep -iE 'content-length|last-modified'
# content-length: 137387555600      → 137.4 GB
# last-modified: Tue, 18 Aug 2026 09:05:41 GMT
```

The archive carries its own provenance, which is what a rollback argument is made of. After
extracting (or downloading), read it back:

```bash
pmtiles show japan-20260818.pmtiles
# min zoom / max zoom, the bounds, and the metadata block, including:
#   planetiler:osm:osmosisreplicationtime = 2026-08-18T04:00:00Z
#   version (Protomaps basemap schema)    = 4.15.2
```

`pmtiles` is the `go-pmtiles` CLI: <https://github.com/protomaps/go-pmtiles/releases>. Put the
binary on `PATH`; nothing else in this repo depends on it.

### 7.2 Produce a regional extract

`pmtiles extract` reads the remote planet archive **over HTTP range requests** and writes only
the tiles inside the bbox. There is no full-planet download, and no scratch disk the size of the
planet — the run that produced the local dev archive fetched 503 MB in total:

```bash
# The corridor the flagship trip lives in: Tokyo → Kyoto, lon 134.2–140.9, lat 33.6–36.8.
pmtiles extract https://build.protomaps.com/20260818.pmtiles japan-20260818.pmtiles \
  --bbox=134.2,33.6,140.9,36.8 \
  --maxzoom=14
# extract.go: fetching 13 dirs, 13 chunks, 10 requests
# extract.go: Region tiles 73409, result tile entries 50827
# extract.go: fetching 50827 tiles, 276 chunks, 50 requests
# → japan-20260818.pmtiles, 503,617,057 bytes, zoom 0–14
```

`--maxzoom=14` is deliberate, and it is the knob that decides whether an extract is 500 MB or
several gigabytes: each extra level quadruples the number of tiles inside the bbox. Zoom 14 is
about a city block. The map still zooms to 19 (`MAP_MAX_ZOOM`) — the style declares no `maxzoom`
on its source, so MapLibre takes the ceiling from the archive's own header and overzooms the z14
tiles for the last five levels. Vector geometry scales without blurring, so what is lost is
detail that was never in the tile rather than sharpness.

### 7.3 Choose: whole planet, or a set of extracts

|               | Whole planet in R2                          | Regional extracts                               |
| ------------- | ------------------------------------------- | ----------------------------------------------- |
| Size          | 137.4 GB (`20260818`, measured above)       | ~0.5 GB per city-scale corridor at z14          |
| R2 storage    | ≈ **$2.06 / month** at $0.015 / GB-month    | ≈ $0.008 / month per extract — inside free tier |
| Egress        | $0 — R2 never charges for egress            | $0                                              |
| Coverage      | Every trip, everywhere, no thought required | Only inside each bbox                           |
| Configuration | One `TILES_ARCHIVE_KEY`, set once           | One key per region, chosen per trip             |
| Upload        | Multipart, hours of transfer                | Minutes                                         |

Storage arithmetic, in full: 137.4 GB × $0.015 = $2.06 per month; the first 10 GB-month is free,
so the invoice reads about **$1.91**. R2 rounds usage up to the next GB-month. Reads are Class B
operations ($0.36 per million, first 10 million free): a warm archive mostly answers out of the
Cloudflare cache in front of R2 — `/api/tiles/*` sets `s-maxage` for a year on a resolved key and
reports `x-tiles-cache: hit` when it did — so tile traffic converts into R2 operations only on
cache misses. Confirm both rates against <https://developers.cloudflare.com/r2/pricing/> before
quoting them at anybody; this runbook was written against the August 2026 price list.

**Recommendation: ship the planet.** Two dollars a month is cheaper than the alternative's only
real cost, which is code: with regional archives, something has to decide _which_ archive a
given trip needs. The route already serves any key explicitly
(`/api/tiles/basemaps/japan-20260818.pmtiles`, immutable for a year), and `useArchiveCoverage()`
already reads the live archive's header bounds and tells the reader when a trip falls outside
them — that is how the coverage notice on `/plan` works. But nothing chooses an archive per trip
today. Adding regional selection means: a lookup from trip bounds to archive key, a way to pass
that key into `tileEndpoints({ archive })` at style-build time, and a rebuild of every extract on
every OSM refresh. Do that only if the planet's storage cost is genuinely a problem.

### 7.4 Upload it

Keys are **versioned and never overwritten** — the endpoint serves a named key with
`immutable` caching for a year, so a rewritten key would be served stale for a year:

```
basemaps/planet-20260818.pmtiles
basemaps/japan-20260818.pmtiles
```

That dated form is what `wrangler.jsonc` now ships, for production and for the `staging` env
block, and the two must not drift: an undated key like `basemaps/planet.pmtiles` cannot be
refreshed without serving a year of stale tiles to everyone who already fetched it, and it leaves
§7.5 with no previous key to flip back to.

A **local** checkout keeps working unchanged. Miniflare has its own bucket under
`.wrangler/state`, holding whatever you put there with
`wrangler r2 object put planned-travel-tiles/<key> --file=… --local`, and `.dev.vars` names that
object in `TILES_ARCHIVE_KEY` — overriding the deployed value exactly the way it already
overrides `APP_URL`. So the object you already have stays valid: re-point local dev by editing
that one line, never by renaming or overwriting an object.

Wrangler handles one object at a time, up to **315 MB**:

```bash
pnpm exec wrangler r2 object put \
  planned-travel-tiles/basemaps/japan-20260818.pmtiles \
  --file=./japan-20260818.pmtiles \
  --content-type=application/octet-stream \
  --remote
```

Anything bigger — which includes both the 503 MB regional extract and the 137 GB planet — needs
an S3-compatible client, because it needs **multipart**. R2's multipart rules: parts of 5 MiB to
5 GiB, at most 10,000 parts, every part except the last exactly the same size, and an incomplete
upload is aborted after 7 days. At 137,387,555,600 bytes the smallest legal part is
137,387,555,600 ÷ 10,000 ≈ 13.1 MiB; 256 MiB parts give 512 of them, which is comfortable and
resumable.

Create an R2 API token (R2 → Manage API Tokens → Object Read & Write), then:

```bash
export AWS_ACCESS_KEY_ID=R2_ACCESS_KEY_ID
export AWS_SECRET_ACCESS_KEY=R2_SECRET_ACCESS_KEY
export AWS_DEFAULT_REGION=auto

# 8 MiB is the CLI's default part size: 137,387,555,600 / 8 MiB = 16,377.9, so 16,378
# parts — over R2's 10,000-part limit. AWS CLI v2 would not fail on that; it silently
# scales multipart_chunksize up until the count fits (~16 MiB here). Set it anyway, so
# the part size is one you chose and can reason about when an upload has to resume.
aws configure set default.s3.multipart_threshold 256MB
aws configure set default.s3.multipart_chunksize 256MB

aws s3 cp ./planet-20260818.pmtiles \
  s3://planned-travel-tiles/basemaps/planet-20260818.pmtiles \
  --endpoint-url https://CLOUDFLARE_ACCOUNT_ID.r2.cloudflarestorage.com \
  --content-type application/octet-stream \
  --cli-write-timeout 0 --cli-read-timeout 0
```

`aws s3 cp` switches to multipart on its own once the file passes the threshold; setting the chunk
size explicitly is what makes the part count a number you chose rather than one the CLI derived. `rclone copyto` with `--s3-chunk-size 256M` does the same job
and resumes better on a flaky line. Verify what landed:

```bash
pnpm exec wrangler r2 object get \
  planned-travel-tiles/basemaps/planet-20260818.pmtiles --remote --pipe | head -c 127 | xxd | head -2
# Expect the bytes to start with the ASCII magic `PMTiles` and version 3.
```

### 7.5 Point the alias — and roll back by flipping it

`basemap.pmtiles` is the only mutable URL in the system. It resolves to `TILES_ARCHIVE_KEY`:

```jsonc
// wrangler.jsonc — production, then the `staging` env block
"vars": { "TILES_ARCHIVE_KEY": "basemaps/planet-20260818.pmtiles" }
```

```bash
pnpm run deploy                                   # production
CLOUDFLARE_ENV=staging pnpm run deploy            # staging
```

The environment is chosen at **build** time, not at deploy time. `@cloudflare/vite-plugin`
resolves `CLOUDFLARE_ENV` against the `env` blocks in `wrangler.jsonc`, writes the flattened
result to `dist/server/wrangler.json`, and points wrangler at it through
`.wrangler/deploy/config.json`. That generated file carries no `env` block, so
`wrangler deploy --env staging` after a build does **not** deploy staging — it silently
re-deploys the production configuration under the production Worker name. Verify before you
trust it: `CLOUDFLARE_ENV=staging pnpm build` then check the emitted config reads
`"name": "planned-travel-staging"` and `"ENVIRONMENT": "staging"`.

That deploy _is_ the rollover. The edge cache key carries the **resolved** object key, so a
repoint takes effect immediately with no purge, and browsers revalidate the alias hourly
(`max-age=3600`) while keeping the year-long copy of any named key they were given.

Rollback is the same flip in reverse: set `TILES_ARCHIVE_KEY` back to the previous key and
deploy. Keep the previous archive in the bucket until the new one has served a full day —
storage is $0.015/GB-month, and a bad basemap with no rollback target is a much more expensive
kind of cheap. Then smoke-test with §11's tile checks (`206` on a range, `x-tiles-cache: hit` on
the repeat, `416` on an unsatisfiable range) and open `/plan` on the flagship trip: the coverage
notice reads the new archive's header bounds, so it will say so if the new archive is smaller
than you thought.

### 7.6 Refreshing the OSM data

OpenStreetMap changes continuously; a Protomaps build is a snapshot, and its
`planetiler:osm:osmosisreplicationtime` is the moment it froze.

- **Cadence: quarterly is plenty**, with an out-of-band refresh when something the product
  actually points at has moved — a new metro line, a renamed airport terminal, a country's
  border. Roads and coastlines do not move on a sprint boundary, and every refresh is a
  multi-hour upload.
- Each refresh is §7.1 → §7.4 → §7.5 with a new date, never an overwrite of the old key.
- Record, next to the key: the upstream build date, the OSM replication time from
  `pmtiles show`, the Protomaps schema version (`4.15.2` at the time of writing), and — for a
  regional archive — the bbox and `--maxzoom`. A basemap you cannot reproduce is a basemap you
  cannot fix.
- Regional archives are refreshed as a _set_. Half a continent at last quarter's snapshot and
  half at this one is a seam a reader can see.

### 7.7 Attribution is not optional

OpenStreetMap data is licensed under the **ODbL 1.0**, which requires that any produced work
credit OpenStreetMap and its contributors. The archive states this itself — its metadata carries
`attribution: © OpenStreetMap` — and we satisfy it in the product with `<MapAttribution />`,
which renders "OpenStreetMap · Protomaps" as real links to
<https://www.openstreetmap.org/copyright> and <https://protomaps.com> on every map surface, in
the product's own type rather than MapLibre's control. The strings live in `MAP_ATTRIBUTION` in
`src/lib/map/style.ts`, and the same list is fed to MapLibre's own attribution for any consumer
that reads the style document directly.

If a map surface is ever added, `MapAttribution` goes on it. There is no compliant configuration
of this product without visible OSM credit.

---

## 8. First deploy and the custom domain

```bash
pnpm generate-routes     # refresh src/routeTree.gen.ts
pnpm lint && pnpm typecheck && pnpm test
pnpm run deploy          # = pnpm build && wrangler deploy
```

`wrangler deploy` prints the version id and the bindings it uploaded. Confirm the list matches
§3 of `docs/ARCHITECTURE.md`: `DB`, `KV`, `SESSIONS`, `FILES`, `TILES`, `TRIP_ROOM`, `TASKS`.

Attach the domain. `workers_dev` is `false`, so until this step there is no public hostname.

**Dashboard (no config change):** Workers & Pages → `planned-travel` → Settings → Domains &
Routes → Add → Custom domain → `planned.travel`. Repeat for `www.planned.travel` if you want the
redirect handled by the Worker.

**Or checked into `wrangler.jsonc`, which is preferable because it is reviewable:**

```jsonc
"routes": [
  { "pattern": "planned.travel", "custom_domain": true },
  { "pattern": "www.planned.travel", "custom_domain": true }
]
```

then `pnpm run deploy` again. Cloudflare creates the DNS record and issues the certificate;
allow a few minutes for the certificate.

Staging:

```bash
CLOUDFLARE_ENV=staging pnpm run deploy
```

The env var is read by the Vite build, not by `wrangler deploy` — see §7.5 for why
`wrangler deploy --env staging` would deploy production instead.

`env.staging` has `workers_dev: true`, so it is reachable immediately at
`planned-travel-staging.ACCOUNT_SUBDOMAIN.workers.dev`; attach `staging.planned.travel` the
same way when you want the real hostname.

---

## 9. Polar wiring — the billing configuration the Worker calls

This is the billing wiring of the current release. Phase A replaced the previous provider's
integration wholesale — the endpoint, the signature scheme, the event names, the checkout call and
the portal call are all different, and none of the old steps has a residual role. `docs/SPEC.md`
§1 records the vendor change itself.

Where each part now stands:

- **§9.1 → §9.3 and §9.4 are live configuration.** The code that reads them is deployed:
  `src/server/billing/polar.ts` builds the client, `src/routes/api/polar/webhook.ts` is the
  mounted route, and `src/lib/plans.ts` resolves the four product ids. Nothing here is
  preparation for a later phase.
- **§9.4 step B — the production endpoint — is now a step to take**, not one to defer. The reason
  it used to wait was that the route did not exist; it does.
- **§9.11 is the acceptance gate, and it is unwalked.** All eight rows stand unverified: the
  rounds that wrote the integration ran with `POLAR_ACCESS_TOKEN` and `POLAR_WEBHOOK_SECRET`
  deliberately empty, so no live call was made and no live delivery received. Walk it in the
  sandbox against staging before production sells. Until it is walked, the honest statement is
  the one §9.11 repeats: **the code is written and the matrix is unwalked.**

Read §9.1 → §9.10 once before touching the dashboard.

### 9.1 Two organizations, four products, one setting that is not a default

**Sandbox and production are separate accounts.** <https://sandbox.polar.sh> needs its own user
account and its own organization, created the same way as the production one. Nothing is shared:
not the login, not the access token, not the webhook secret, and — the one that bites — **not
the product ids**. Every product UUID differs between the two environments. A sandbox id pasted
into a production variable does not fail loudly; it produces a checkout for a product that does
not exist in that account.

| Environment | Dashboard                  | API base URL                      |
| ----------- | -------------------------- | --------------------------------- |
| Sandbox     | `https://sandbox.polar.sh` | `https://sandbox-api.polar.sh/v1` |
| Production  | `https://polar.sh`         | `https://api.polar.sh/v1`         |

**The product shape is decided: one product per plan-interval. Four products, one price each.**

This is not a preference. In Polar's model the billing interval is a property of the _product_ —
`Product.recurring_interval`, `Product.recurring_interval_count`, `Product.is_recurring` — and
not of a price. A single modern product therefore cannot carry both a monthly and a yearly
price; two intervals on one product exists only in Polar's legacy recurring-price shape, which a
new organization does not get. So:

| Product name                    | Plan   | `recurring_interval` | Repository variable (§10)         |
| ------------------------------- | ------ | -------------------- | --------------------------------- |
| `planned.travel Solo — monthly` | `solo` | `month`              | `VITE_POLAR_PRODUCT_SOLO_MONTHLY` |
| `planned.travel Solo — yearly`  | `solo` | `year`               | `VITE_POLAR_PRODUCT_SOLO_YEARLY`  |
| `planned.travel Crew — monthly` | `crew` | `month`              | `VITE_POLAR_PRODUCT_CREW_MONTHLY` |
| `planned.travel Crew — yearly`  | `crew` | `year`               | `VITE_POLAR_PRODUCT_CREW_YEARLY`  |

Create all four in **both** organizations. Currency and amount come from `src/lib/plans.ts`; the
`free` plan has no product, because Polar never sees a free workspace.

Confirm the ids you are about to publish, from the environment you think you are in:

```bash
POLAR_API=https://sandbox-api.polar.sh/v1        # or https://api.polar.sh/v1
curl -sS "$POLAR_API/products/?is_archived=false&limit=100" \
  -H "Authorization: Bearer $POLAR_ACCESS_TOKEN" |
  python3 -c 'import json,sys; [print(p["id"], p["recurring_interval"], p["name"]) for p in json.load(sys.stdin)["items"]]'
```

**The one organization setting that is not a default: set _Grace period for benefit revocation_
to `After 21 days` in the production organization _and_ in the sandbox one.**

Polar dashboard → **Settings** → **Subscriptions** → **Grace period for benefit revocation**. The
options are `Immediately` (the default), `After 2 days`, `After 7 days`, `After 14 days` and
`After 21 days`. With `Immediately`, benefits are revoked the moment a subscription leaves
`active`, so the **first** failed renewal drops the workspace to Free the same minute — before
the customer has read the dunning email, and while Polar is still going to retry the charge four
more times. Those retries are delayed 2, 5, 7 and 7 days: 2, 7, 14 and 21 days cumulative from
the first failure, the window §9.11 row 6 walks. `After 21 days` is the option that matches that
schedule exactly — access is held for precisely as long as Polar keeps trying, and it ends when
Polar gives up. Any shorter setting revokes a paying customer's access while their card is still
being retried, which is the worst-looking failure this product can produce and the hardest to
explain afterwards.

Three properties of this setting are what make it easy to leave on the default in production:

- It is a **per-organization dashboard setting**. It is not in `wrangler.jsonc`, not a secret, not
  in a repository variable and not in any file this repo deploys, so nothing about it is carried
  by `wrangler deploy` and nothing about it is verified by CI. Setting it in the sandbox
  organization has no effect whatsoever on production.
- It has no `wrangler` read-back. Confirming it means opening the production Polar dashboard and
  looking at the field — which is exactly why it is a line in §16's closing checklist rather than
  a step someone remembers.
- Three things elsewhere in this runbook are simply **false** if production is left on
  `Immediately`: §9.9's failed-payment recovery path (there is no `past_due` window to recover
  in), §9.11 row 6 (its premise is `past_due` keeps access), and the `past_due` banner the
  product renders. None of them is false in a way any test catches, because the setting lives in
  the vendor's dashboard and not in our code.

### 9.2 The Organization Access Token

Polar dashboard → **Settings** → scroll to **Developers** → **New Token**. Give it a name, an
expiry, and exactly these scopes — nothing broader, because this token can issue refunds and
edit products:

| Scope                     | Why we need it                                                                         |
| ------------------------- | -------------------------------------------------------------------------------------- |
| `checkouts:write`         | `POST /v1/checkouts/` — the subscribe and pack-purchase flows (§9.8).                  |
| `customer_sessions:write` | `POST /v1/customer-sessions/` — the **Manage billing** action (§9.8).                  |
| `orders:read`             | `GET /v1/orders/` for the read-only history, and both halves of the invoice call.      |
| `subscriptions:read`      | Re-reading a subscription after a webhook, instead of trusting the payload alone.      |
| `subscriptions:write`     | `PATCH /v1/subscriptions/{id}` — plan change, cancel, uncancel (§9.11 rows 2–5).       |
| `products:read`           | Resolving product ids on the pricing page and validating §10's four variables at boot. |
| `webhooks:write`          | Creating the endpoint from the CLI (§9.4) and redelivering an event (§9.7).            |
| `webhooks:read`           | Reading delivery history when a webhook is misbehaving (§9.7).                         |

The token is presented as `Authorization: Bearer polar_oat_…`. It is server-side only: it lives
in `POLAR_ACCESS_TOKEN`, is read through the same failing-loudly accessor as every other secret,
and never reaches a browser bundle. Polar's API is rate limited per organization at **500
requests/minute in production and 100/minute in sandbox**; over the limit it answers `429` with a
`Retry-After` header, which is the header to obey rather than a fixed backoff. The sandbox limit
is the tighter one, so a matrix walk that polls in a loop will hit `429` there first — that is a
rate limit, not an integration bug.

### 9.3 `POLAR_SERVER`

One secret selects the whole billing environment. Its value domain is exactly two strings:

| `POLAR_SERVER` | Base URL every server-side call is built on |
| -------------- | ------------------------------------------- |
| `sandbox`      | `https://sandbox-api.polar.sh/v1`           |
| `production`   | `https://api.polar.sh/v1`                   |

Anything else — a URL, `test`, `live`, an empty string — is a configuration error and must fail
at boot rather than default. `sandbox` is not the safe default: a Worker that silently falls back
to sandbox looks healthy and bills nobody.

### 9.4 Create the webhook endpoint

**Two endpoints, two organizations, two base URLs, created at two different times.** An endpoint
belongs to the organization whose access token created it, and the URL it points at has to be the
Worker that organization talks to. Cross the two and every delivery fails: a production URL
registered in the sandbox organization sends sandbox events to the production Worker, which
verifies them against the production signing secret and rejects them. Ten consecutive non-2xx
deliveries disable the endpoint (§9.7), so a wrong URL costs an hour and an email to every
organization member.

| Step                          | Organization | API base (§9.3)                   | URL to register                                        |
| ----------------------------- | ------------ | --------------------------------- | ------------------------------------------------------ |
| **A** — staging first         | Sandbox      | `https://sandbox-api.polar.sh/v1` | the staging Worker's own origin + `/api/polar/webhook` |
| **B** — when production sells | Production   | `https://api.polar.sh/v1`         | `https://planned.travel/api/polar/webhook`             |

**Step A's origin is whichever one staging actually answers on.** §8 attaches
`staging.planned.travel` only when you want the real hostname; until then `env.staging` has
`workers_dev: true` and the deployed Worker is
`https://planned-travel-staging.ACCOUNT_SUBDOMAIN.workers.dev`. Register the origin that resolves
today — §9.7 disables an endpoint after ten deliveries to a host that redirects or does not
resolve, so a hostname you have not attached yet is worse than a `workers.dev` one. When you do
attach the custom hostname, move the endpoint with
`PATCH /v1/webhooks/endpoints/{id}` and `{"url": "https://staging.planned.travel/api/polar/webhook"}`
rather than creating a second endpoint; two endpoints on one organization deliver every event
twice. The command below uses the custom hostname; substitute your `workers.dev` origin if that is
the one live.

**Order matters, and the rule is the same one it always was: register an endpoint only against a
Worker that answers it.** Step A is the endpoint §9.11 walks against, so do it first and walk the
matrix on staging. **Run step B only once `/api/polar/webhook` is deployed and answering on
`https://planned.travel`** — an endpoint pointed at a URL that 404s spends its ten deliveries and
disables itself.

Dashboard: **Settings → Webhooks → Add endpoint**, in the organization the step names. Or by API.

**Step A — sandbox. `POLAR_ACCESS_TOKEN` must be the _sandbox_ token of §9.2:**

```bash
POLAR_API=https://sandbox-api.polar.sh/v1

curl -sS -X POST "$POLAR_API/webhooks/endpoints" \
  -H "Authorization: Bearer $POLAR_ACCESS_TOKEN" \
  -H 'content-type: application/json' \
  -d '{
        "url": "https://staging.planned.travel/api/polar/webhook",
        "name": "planned.travel staging",
        "format": "raw",
        "events": ["subscription.created","subscription.active","subscription.updated",
                   "subscription.canceled","subscription.uncanceled","subscription.cycled",
                   "subscription.past_due","subscription.revoked","subscription.paused",
                   "subscription.resumed","order.created","order.updated","order.paid",
                   "order.refunded","checkout.created","checkout.updated","checkout.expired"]
      }'
```

**Step B — production. `POLAR_ACCESS_TOKEN` must be re-exported as the _production_ token of
§9.2.** There are two ways to get this wrong and they fail very differently. Forget the
token and keep the sandbox one: against `https://api.polar.sh/v1` it is not a credential of that
organization, so the call answers `401` and nothing happens — the cheap failure. Forget the _base
URL_ instead, and run this block with the sandbox token still exported and `$POLAR_API` still
pointing at `https://sandbox-api.polar.sh/v1`: it succeeds, and quietly adds a second sandbox
endpoint aimed at the production Worker, which then receives sandbox events signed with the
sandbox secret and rejects all of them. That is the expensive one, because it looks like a
successful step. The block below writes the production base URL literally for exactly that reason:

```bash
curl -sS -X POST "https://api.polar.sh/v1/webhooks/endpoints" \
  -H "Authorization: Bearer $POLAR_ACCESS_TOKEN" \
  -H 'content-type: application/json' \
  -d '{
        "url": "https://planned.travel/api/polar/webhook",
        "name": "planned.travel",
        "format": "raw",
        "events": ["subscription.created","subscription.active","subscription.updated",
                   "subscription.canceled","subscription.uncanceled","subscription.cycled",
                   "subscription.past_due","subscription.revoked","subscription.paused",
                   "subscription.resumed","order.created","order.updated","order.paid",
                   "order.refunded","checkout.created","checkout.updated","checkout.expired"]
      }'
```

Read back what you just created — `GET <base>/webhooks/endpoints` against the same base URL the
create used — and confirm the `url` belongs to the environment that base URL does. Step B writes
its base URL literally rather than re-exporting `POLAR_API`, so the shell keeps whatever §9.1 set;
everything after §9.4 — the delivery reads of §9.7, the four calls of §9.8, the matrix of §9.11 —
is sandbox work, and a `POLAR_API` left pointing at production turns §9.8's `POST /checkouts/`
into a real production checkout.

Three things about the create call that are easy to get wrong:

- **`/v1/webhooks/endpoints` has no trailing slash**, unlike `/v1/checkouts/`,
  `/v1/customer-sessions/` and `/v1/orders/`. Polar's paths are not uniform; copy them exactly.
- **`format` must be `"raw"`.** The enum is `raw | discord | slack`; the other two reshape the
  body into a chat message and our verifier would be signing something else entirely.
- **The secret can be chosen, but not over the API — so the two creation paths differ in what you
  do next.** The API create body accepts exactly `url`, `name`, `format`, `events` and
  `organization_id`, and no `secret`; Polar generates one and returns it on the `201` response
  object, so with the `curl` above you read the secret out of the response, put it in
  `POLAR_WEBHOOK_SECRET` (§6) and redeploy. The **dashboard** flow is the one that lets you supply
  a value: its **Add endpoint** form has a _Set a secret_ step where, in Polar's own words, "you
  can set your own or generate a random one" — so if you would rather mint the secret first
  (`openssl rand -base64 32`), set `POLAR_WEBHOOK_SECRET` and then create the endpoint around it,
  create it in the dashboard, not with this call. Afterwards neither path can assign one:
  `PATCH /v1/webhooks/endpoints/{id}` accepts `url`, `name`, `format`, `events` and `enabled` only,
  and `PATCH /v1/webhooks/endpoints/{id}/secret` takes no request body at all — it _regenerates_,
  and the old value stops verifying the moment it returns, so redeploy in the same window. A
  self-chosen secret has no `whsec_` prefix and that changes nothing: §9.5's key is the raw UTF-8
  bytes of the value exactly as it stands in the dashboard, prefix or no prefix.

  Verified against Polar's published API document at <https://polar.sh/docs/openapi.json>
  (`info.version` `2026-04`) and the dashboard steps at
  <https://polar.sh/docs/integrate/webhooks/endpoints>, both re-checked 2026-08-22. Polar has
  retired the `docs.polar.sh` HTML host — it `301`s to `polar.sh/docs/…` — and its API-reference
  pages are version-namespaced, so a citation like
  <https://polar.sh/docs/api-reference/2026-04/webhooks/create-webhook-endpoint> resolves while the
  same path without `2026-04` returns `404`. Re-date these links when Polar cuts a new API version.

### 9.5 Verifying the signature by hand

Polar implements **Standard Webhooks**. We verify it ourselves on WebCrypto — no SDK — so the
scheme has to be written out exactly.

Every delivery carries three headers, all lowercase:

```
webhook-id:         <event id>                 unique per event — our idempotency key
webhook-timestamp:  1755763200                 unix seconds
webhook-signature:  v1,Base64Sig= v1,Base64Sig2=
```

The signed content is the three parts joined by dots, with the body as **raw bytes exactly as
received** — never `JSON.stringify(await request.json())`, which reorders nothing but reformats
everything:

```
{webhook-id}.{webhook-timestamp}.{raw body}
```

The signature is **HMAC-SHA256**, **base64**-encoded, and carried as `v1,<sig>`.
`webhook-signature` is a **space-delimited list**, because Standard Webhooks allows a sender to
carry several signatures on one delivery — a rotation overlap, or more than one scheme version. A
verifier must therefore accept the message if _any_ `v1,` entry matches, and must skip entries
whose version prefix is not `v1`. Compare in constant time. Polar itself publishes no overlap
window: an endpoint holds exactly one secret and `PATCH /v1/webhooks/endpoints/{id}/secret`
replaces it outright (§9.4), so treat a reset as an immediate cutover and redeploy
`POLAR_WEBHOOK_SECRET` in the same maintenance window. Parsing the list is what keeps the verifier
correct if that ever changes.

> ⚠️ **The base64-secret gotcha. Read this before writing the verifier.**
>
> The Standard Webhooks specification says the HMAC key is the secret with its `whsec_` prefix
> stripped and the remainder base64-**decoded**. Polar does not hand the library a spec-shaped
> secret. Its own SDK computes `Buffer.from(secret, "utf-8").toString("base64")` and passes
> _that_ to the Standard Webhooks class, which then strips a prefix that base64 no longer has and
> decodes it back. The two operations cancel.
>
> **The effective HMAC key is the raw UTF-8 bytes of the secret exactly as it appears in the
> Polar dashboard, prefix included.** In a Worker:
> `crypto.subtle.importKey('raw', new TextEncoder().encode(env.POLAR_WEBHOOK_SECRET), …)`.
> Do **not** base64-decode it. Do **not** strip `whsec_` or `polar_whs_`.
>
> Getting this wrong fails **100 %** of deliveries in both environments, with no partial success
> to hint at the cause, and it looks exactly like a wrong secret. Any snippet copied from a
> generic Standard Webhooks tutorial has the spec behaviour and will be wrong here.
>
> It is also fragile in the other direction: this is Polar compensating for its own double
> encoding, not a documented contract. If Polar ever fixes it, our verifier is the thing that
> breaks. That is why §9.11 row 1 asserts on a real delivery rather than on a fixture, and why
> the verifier gets a unit test with a captured payload rather than only a live check.

**Timestamp tolerance: 300 seconds (5 minutes), in both directions.** Reject a delivery whose
`webhook-timestamp` is more than 300 s in the past or more than 300 s in the future. That number
is ours, not Polar's: the Standard Webhooks specification only says the timestamp must be
"within some allowable tolerance" and names no value, and Polar publishes none. 300 s is the
constant the reference JavaScript implementation hardcodes, and it is already the window
`docs/ARCHITECTURE.md` states for this endpoint — keep the three in step.

### 9.6 The events we subscribe to

Seventeen, and no others. Anything else that arrives is acknowledged with `200` and ignored, so
that turning a new event on in the dashboard can never become an outage.

| Group        | Events                                                                                                                                                                                                                                                    |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Subscription | `subscription.created` · `subscription.active` · `subscription.updated` · `subscription.canceled` · `subscription.uncanceled` · `subscription.cycled` · `subscription.past_due` · `subscription.revoked` · `subscription.paused` · `subscription.resumed` |
| Order        | `order.created` · `order.updated` · `order.paid` · `order.refunded`                                                                                                                                                                                       |
| Checkout     | `checkout.created` · `checkout.updated` · `checkout.expired`                                                                                                                                                                                              |

Two negatives worth writing down, because both are habits carried over from the previous
provider and both would silently subscribe to nothing:

- **There is no `subscription.deleted`.** The terminal event is `subscription.revoked`.
- **There is no `invoice.*` event of any kind** — no `invoice.paid`, no
  `invoice.payment_failed`. Money moves on `order.paid`; a failed renewal surfaces as
  `subscription.past_due`.

`subscription.updated` is a documented catch-all: Polar fires it alongside `active`, `canceled`,
`uncanceled`, `cycled`, `past_due`, `revoked`, `paused` and `resumed`. Handle the specific event
for state transitions and treat `updated` as the reconciliation path, or every transition is
processed twice.

Polar documents an exact ordering for four sequences, and only these four. Assert on order for
them; assert on final _state_ for everything else, because no ordering is promised:

| Sequence             | Events, in order                                                                                                  | End state                                    |
| -------------------- | ----------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| Cancel at period end | `subscription.updated` → `subscription.canceled`                                                                  | still `active`, `cancel_at_period_end: true` |
| …then at period end  | `subscription.updated` → `subscription.revoked`                                                                   | `canceled`                                   |
| Immediate revocation | `subscription.updated` → `subscription.canceled` → `subscription.revoked`                                         | `canceled`                                   |
| Renewal              | `subscription.cycled` → `subscription.updated` → `order.created` (`pending`), then `order.updated` → `order.paid` | `active`, new period                         |
| Resume from pause    | `subscription.updated` → `subscription.resumed` → `order.created`                                                 | `active`, new period                         |

`subscription.cycled` is the renewal signal Polar tells integrators to use, in preference to
inspecting `order.billing_reason`: it fires on every new billing period whether or not the
payment succeeds, and also when a trial converts. Read `status` to tell those apart.

### 9.7 Delivery operations

| Property             | Value                                                                                                                                         | Consequence for us                                                                                                                                                                                                                                                                             |
| -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Request timeout      | **10 s**                                                                                                                                      | Hard ceiling.                                                                                                                                                                                                                                                                                  |
| Recommended response | **under 2 s**, vendor-endorsed, with the work handed to a background worker — Polar states it "may lower the timeout threshold in the future" | This is exactly the shape `src/server/billing/webhook.ts` has: **verify the signature → claim `webhook-id` in KV → one small inline D1 write → enqueue the rest to `TASKS` → return `200`**. Nothing that talks to a third party, renders an email or writes more than one row belongs inline. |
| Retries              | up to **10**, exponential backoff                                                                                                             | A redelivery must be a no-op. The KV claim on `webhook-id` is what makes it one.                                                                                                                                                                                                               |
| Auto-disable         | after **10 consecutive non-2xx** deliveries the endpoint is disabled and every organization member is emailed                                 | Re-enable it by hand: dashboard → Settings → Webhooks → the endpoint → enable, or `PATCH /v1/webhooks/endpoints/{id}` with `{"enabled": true}`. Fix the cause first; a re-enable against a still-broken endpoint spends the ten again.                                                         |
| Redirects            | `301`, `302`, `307` … are treated as **failures** and are never followed                                                                      | Register the final URL. An apex-to-`www` redirect, or `http://` in the endpoint URL, disables the endpoint in ten deliveries and looks like Polar being down.                                                                                                                                  |

**Redelivery is a real endpoint, and it is how idempotency gets tested:**

```bash
# $POLAR_API here and through §9.8 is whichever base §9.1 set — sandbox while §9.11 is being
# walked. Echo it before anything that writes; §9.4 step B deliberately does not change it.

# Recent attempts, newest first — read the response code and body Polar actually got.
curl -sS "$POLAR_API/webhooks/deliveries?limit=20" -H "Authorization: Bearer $POLAR_ACCESS_TOKEN"

# Send the same event again. EVENT_ID is the `webhook_event.id` on a delivery above.
curl -sS -X POST "$POLAR_API/webhooks/events/EVENT_ID/redeliver" \
  -H "Authorization: Bearer $POLAR_ACCESS_TOKEN"
```

A correct handler answers the redelivery `200` and changes nothing: no second row, no second
email, no second entitlement flip. The same button exists on the dashboard's delivery overview.

> ⚠️ **Cloudflare Bot Fight Mode blocks Polar's deliveries with `403`, and the obvious fix does
> not work.** Polar states it explicitly: adding its IP addresses to an IP Allow List, or writing
> custom WAF rules, **will not resolve it**. The remedy is to turn the feature off — Cloudflare
> dashboard → **Security → Bots → Bot Fight Mode → off** for the `planned.travel` zone. Do this
> before the first real delivery; the symptom is ten consecutive `403`s and a disabled endpoint.
>
> Separately, for any firewall, reverse proxy or allowlist that is _not_ Bot Fight Mode, these
> are Polar's delivery addresses (identical for sandbox and production):
> `3.134.238.10`, `3.129.111.220`, `52.15.118.168`, and the ranges `74.220.50.0/24` and
> `74.220.58.0/24` (added 2025-10-27).

### 9.8 The four API calls the product makes

Paths verified against Polar's published OpenAPI document. Trailing slashes are load-bearing.

**Checkout** — `POST /v1/checkouts/`

```bash
curl -sS -X POST "$POLAR_API/checkouts/" \
  -H "Authorization: Bearer $POLAR_ACCESS_TOKEN" \
  -H 'content-type: application/json' \
  -d '{
        "products": ["PRODUCT_UUID"],
        "external_customer_id": "ORGANIZATION_ID",
        "success_url": "APP_ORIGIN/settings/billing?checkout=complete",
        "metadata": { "organizationId": "ORGANIZATION_ID", "plan": "solo" }
      }'
```

`products` is **required** and is an **array of product UUIDs**, not a price id and not a single
string; the first entry is preselected. `external_customer_id` is the tenant's
`organizationId` — Polar links an existing customer with that external id or creates one — which
is what makes the order list below scope to a workspace without us storing a mapping first.
`success_url` supports the `checkout_id={CHECKOUT_ID}` placeholder. `metadata` allows at most 50
pairs, keys ≤ 40 characters and values ≤ 500. `APP_ORIGIN` here and in the `return_url` below is
an `ALL_CAPS` placeholder like the others: replace it with the origin of the Worker the
organization behind `$POLAR_API` talks to. While the sandbox matrix of §9.11 is being walked that
is **whichever origin staging actually answers on** — the same rule as §9.4 step A, so
`https://planned-travel-staging.ACCOUNT_SUBDOMAIN.workers.dev` until §8 attaches the custom
hostname and `https://staging.planned.travel` after it. For the production organization it is
`https://planned.travel`. Paste the production origin into a sandbox checkout and the redirect
leaves the Worker that received the events; paste a hostname staging has not been given yet and
the customer lands on a name that does not resolve, with the payment already taken. The product
itself never writes the host down: it builds every return URL from the `APP_URL` var, which
`wrangler.jsonc` sets per environment.

**Customer Portal** — `POST /v1/customer-sessions/`

```bash
curl -sS -X POST "$POLAR_API/customer-sessions/" \
  -H "Authorization: Bearer $POLAR_ACCESS_TOKEN" \
  -H 'content-type: application/json' \
  -d '{ "external_customer_id": "ORGANIZATION_ID",
        "return_url": "APP_ORIGIN/settings/billing?portal=complete" }'
```

The body is one of two variants: `{ "customer_id": … }` or `{ "external_customer_id": … }`. The
`201` response carries `token`, `expires_at` and **`customer_portal_url`** — redirect the browser
to that URL. Mint a fresh session at the moment the member clicks **Manage billing**; the token
is short-lived, so a stored URL is a support ticket waiting to happen. The stable, unauthenticated
fallback is `https://polar.sh/<org-slug>/portal`, where the customer signs in with an emailed
one-time code.

**Order history** — `GET /v1/orders/?external_customer_id=…`

```bash
curl -sS "$POLAR_API/orders/?external_customer_id=ORGANIZATION_ID&limit=100&sorting=-created_at" \
  -H "Authorization: Bearer $POLAR_ACCESS_TOKEN"
```

`external_customer_id` is a first-class filter, so the read-only list on `/settings/billing`
scopes to the active organization with no local customer-id mapping. Pagination is `page` /
`limit` (default 10, max 100) with `{ items, pagination: { total_count, max_page } }`.
`OrderStatus` is `draft | pending | paid | refunded | partially_refunded | void`.

**Invoice** — `POST` to generate, then `GET` for the URL

```bash
curl -sS -X POST "$POLAR_API/orders/ORDER_ID/invoice" -H "Authorization: Bearer $POLAR_ACCESS_TOKEN"   # 202
curl -sS      "$POLAR_API/orders/ORDER_ID/invoice" -H "Authorization: Bearer $POLAR_ACCESS_TOKEN"   # 200 {"url": …}
```

The order matters, and so does the timing:

- `GET` **before** a successful `POST` returns **`404`** — Polar's own wording is "if the invoice
  is not generated, you will receive a `404` error". A UI that starts with the `GET` shows an
  error for every order nobody has downloaded yet.
- `POST` returns **`202 Accepted`**, not `200`: generation is asynchronous. A `GET` fired
  immediately afterwards can _still_ `404`. Do not promise a URL on the next call. The reliable
  readiness signal is the order's `is_invoice_generated` boolean, delivered on `order.updated`;
  `invoice_number` is `null` until the invoice is finalised.
- `POST` returns **`409`** when the order's status makes it ineligible.
- The receipt is a different document at a different path: `GET /v1/orders/{id}/receipt`, which
  returns its own presigned URL. Invoice ≠ receipt; the billing list labels them separately.

### 9.9 No in-app invoice form — settled, with its consequences

`/settings/billing` ships a **Manage billing** action and a **read-only** order and invoice list.
It does not ship a form for billing name, VAT number or billing address. `docs/SPEC.md` §5
settles this; here is what it means for whoever runs the deploy:

- **Polar is Merchant of Record.** It is the seller of record, it determines the tax, and it
  issues the legal invoice — worldwide, everywhere it sells (globally, excluding countries under
  US sanctions). Our copy of a billing address is not the one on the document an accountant
  reads.
- **An invoice is frozen the moment it is generated.** Polar's own warning: "Once the invoice is
  generated, it's permanent and cannot be modified." Billing details are editable only _before_
  generation, through `PATCH /v1/orders/{id}` — which exposes exactly `billing_name` and
  `billing_address`, and where "country and state fields cannot be updated". A form of ours would
  be an editable field that stops being editable at an instant the member cannot see.
- **Corrections go through the hosted portal**, where the customer edits the details and
  regenerates the document in the same place it is produced.
- **A payment-method change is portal-only in practice.** Mutating a payment method requires a
  _customer session_ token; an Organization Access Token cannot do it at all. So the operational
  consequence is unavoidable and should be designed for rather than apologised for: **every
  failed-payment recovery path ends in the hosted Polar portal.** The dunning email, the
  `past_due` banner and the **Manage billing** button all converge on one destination, and the
  entitlement does not come back until the customer has been there. This whole path presupposes
  that there **is** a `past_due` window to recover in, which is a production dashboard setting
  and not a property of our code: §9.1's grace period must read `After 21 days` in the production
  organization, or the recovery this section describes never gets a chance to run. Polar cannot even turn the
  portal off — it guarantees invoice access, self-service cancellation and PCI-compliant card
  updates by keeping it always available.

### 9.10 What phase A did not change, and the one rename it did

**The status tuple stays at eight values.** Polar's `SubscriptionStatus` enum is exactly
`incomplete`, `incomplete_expired`, `trialing`, `active`, `past_due`, `canceled`, `unpaid`,
`paused`. That is value-for-value the tuple already in `src/lib/plans.ts` and in the
`subscriptions_status_chk` constraint, `incomplete` and `incomplete_expired` included. It is
settled here in writing so that nobody tidies away the two values that look inherited. They are
superseded in provenance only: both were members of the previous provider's tuple _and_ are
members of Polar's own enum, so narrowing the tuple would make a legitimate webhook fail its
`CHECK` constraint. Phase A did not narrow it, and nothing later may. Verified against the live
OpenAPI (`https://polar.sh/docs/openapi.json`, `info.version` 2026-04): `SubscriptionStatus` is
exactly those eight values.

**The three provider columns were renamed, and that rename is migration `0002`.** Phase A moved
them rather than leaving three inherited names holding Polar ids:

| Was                      | Is now                     | Holds                                                                          |
| ------------------------ | -------------------------- | ------------------------------------------------------------------------------ |
| `stripe_customer_id`     | `provider_customer_id`     | the Polar customer id                                                          |
| `stripe_subscription_id` | `provider_subscription_id` | the Polar subscription id                                                      |
| `stripe_price_id`        | `provider_product_id`      | the Polar **product** id — a UUID, since §9.1 puts the interval on the product |

The two indexes over those columns move with them, because their names carry the old one:
`subscriptions_stripe_subscription_unq` → **`subscriptions_provider_subscription_unq`** (unique)
and `subscriptions_stripe_customer_idx` → **`subscriptions_provider_customer_idx`**.

`drizzle/0002_calm_daredevil.sql` is three `ALTER TABLE "subscriptions" RENAME COLUMN` statements
plus a `DROP INDEX` and a `CREATE [UNIQUE] INDEX` for each of the two indexes.

**What the empty table did and did not buy, corrected.** An earlier revision of this section
justified the rename with "there is no old reader to protect". That was wrong, and the correction
matters because §5 and §12 are written on the other reading. The `subscriptions` table does carry
no rows in any deployed environment — nothing has been sold, the local demo row is rewritten by
the seed on every run, and no Polar subscription exists because §9.11 has not been walked. So:

- **There is no data risk.** No backfill, no dual-write window, no paying customer stranded on a
  column that moved underneath them. That much the empty table genuinely buys, and it is why the
  rename was the right call rather than a two-release dance over three names nobody was reading.
- **There is still a reader risk, and it is not the rows.** The reader §5 protects is the previous
  Worker's SQL. Drizzle bakes a fixed column list into every statement, so a Worker rolled back
  past `0002` issues `select … "stripe_customer_id" …` against a schema that no longer has that
  column and fails with `no such column` on its first billing query — with an empty table exactly
  as with a full one. §12 registers that window and carries the recipe for crossing it.

So the honest statement is: `0002` is a **deliberate, registered exception** to §5's additive
policy, taken because the cost was one rollback window on a pre-revenue release and the benefit
was not shipping three misleading column names into every future migration. It is not a precedent.
The moment a production row exists the data argument expires too, and any further column move is
additive or it does not happen.

Read the generated SQL before committing it — for this migration and every other one. `drizzle-kit`
asks which old column each new one came from and it cannot ask in a non-TTY, so a rename is run in
a real terminal, the three prompts answered against the exact target names above, and the file
confirmed to say `RENAME COLUMN` and not a `__new_` table recreate. A recreate would rebuild the
table and emit `PRAGMA foreign_keys=OFF/ON`, which D1 does not honour (§5). The same escalation is
triggered by adding a `CHECK` constraint in the same generate as a column, so add columns bare and
let Zod at the repository boundary do the enforcing, or accept a recreate knowingly and register
it in §12.

### 9.11 Sandbox acceptance matrix

> **Status: pending operator. Not one of the eight rows has been walked.** The code round that
> built the Polar integration ran with `POLAR_ACCESS_TOKEN` and `POLAR_WEBHOOK_SECRET` **empty by
> design** — no credential was issued to it, so it could make no live API call, receive no live
> delivery, and complete no checkout. Every row below therefore stands **unverified**, row 6
> included: its fake-runtime unit test is evidence about our handler, not the sandbox walk this
> table asks for. Nothing in this repository or in these documents claims otherwise. A green
> `pnpm test` says our code does what we think Polar does; only the walk says Polar agrees, and
> the two are the same statement only after an operator has made it. The strongest offline
> evidence available without a credential — a Standard Webhooks signature vector computed by an
> implementation other than the verifier it checks, and a test that every path needing a secret
> raises `BillingConfigError` when it is unset — is worth having and is still not a green row.
>
> **To clear this block:** issue the sandbox Organization Access Token (§9.2), set both secrets on
> the staging Worker (§6), then walk the table. Record the outcome per row here and tick §16.

Eight rows. All eight are walked in the **sandbox** organization, against a staging Worker with
`POLAR_SERVER=sandbox`, before phase A is called done. Set up once, then work down the table.

**Setup, once:**

```bash
export POLAR_API=https://sandbox-api.polar.sh/v1
export POLAR_ACCESS_TOKEN=polar_oat_…          # the sandbox token, §9.2
pnpm exec wrangler tail --env staging --format pretty   # watch deliveries land
```

- The four sandbox products of §9.1 exist and their ids are in the staging build's
  `VITE_POLAR_PRODUCT_*` variables.
- The sandbox webhook endpoint of §9.4 points at the staging Worker and is **enabled**.
- **Settings → Subscriptions → Grace period for benefit revocation** is `After 21 days` — set
  per §9.1, which is where both organizations get it. This is required, not optional: Polar's
  default is `Immediately`, which revokes benefits the moment a subscription leaves `active`, so
  without it row 6's premise is false in the vendor's own configuration rather than in our code.
  Confirm the **sandbox** organization's setting here and the **production** one in §16 — the two
  are independent, and a green matrix walk says nothing about production's value.
- **Test card `4242 4242 4242 4242`, any future expiry, any 3-digit CVC, any postcode.** That
  is the documented success card for the sandbox and the only one these eight rows need.
- Use one throwaway workspace per row where the table says so, because `external_customer_id`
  is the `organizationId` and a second subscription on the same workspace confuses the state.
- **Sandbox email limitation.** Customer-facing mail — order confirmations, renewal reminders,
  failed-payment notices, the portal's one-time sign-in code — is delivered **only to members of
  the sandbox organization**. Rows 6 and 8 depend on that mail, so sign the test workspace up
  with an address that is a member of the sandbox organization; `you+row8@example.com`
  sub-addressing is accepted and keeps the rows apart in the inbox.

Read the columns as: what you do → what Polar must send → what our side must show.

| #     | What is verified                                                                  | Exact setup and the call that drives it                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | Events to expect                                                                                                                                                                                                                                                                                | Pass condition                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----- | --------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **Subscribe** — Solo, monthly _and_ yearly                                        | Two fresh workspaces. In each, `/pricing` → **Solo** → monthly in the first, yearly in the second. The button posts `POST /v1/checkouts/` with `products: ["<Solo monthly id>"]` / `["<Solo yearly id>"]` and `external_customer_id` = `organizationId` (§9.8). Pay with `4242 4242 4242 4242`.                                                                                                                                                                                                                                                                                               | `checkout.created`, `checkout.updated`, `subscription.created`, `subscription.active`, `order.created`, `order.updated`, `order.paid`. Polar publishes no ordering for subscription _creation_ (only for the four sequences in §9.6), so assert the **set** and the end state, never the order. | One `subscriptions` row per workspace, `status = 'active'`, `plan = 'solo'`, `current_period_end` one month out in the first and one year out in the second. The Solo modules unlock and the KV key `billing:plan:<v>:<orgId>` is invalidated, not merely expired.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **2** | **Upgrade** Solo → Crew, effective immediately, prorated by Polar                 | Take workspace 1 from row 1. `PATCH /v1/subscriptions/{id}` with `{"product_id": "<Crew monthly id>", "proration_behavior": "invoice"}` — `invoice` updates the subscription at once and bills the prorated difference right away; `prorate` also switches at once but carries the difference to the next invoice. Proration is computed per second.                                                                                                                                                                                                                                          | `subscription.updated`, and with `invoice` an immediate `order.created` → `order.updated` → `order.paid` for the difference.                                                                                                                                                                    | Crew entitlements are live **before the next page load**, `plan = 'crew'`, and the amount charged is a part-period difference rather than a full month. If you upgrade monthly → yearly instead, note that Polar auto-promotes `prorate` to `invoice`, because there is no next cycle to defer to.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| **3** | **Downgrade** Crew → Solo, effective at period end, entitlements held until then  | The same subscription. `PATCH /v1/subscriptions/{id}` with `{"product_id": "<Solo monthly id>", "proration_behavior": "next_period"}`.                                                                                                                                                                                                                                                                                                                                                                                                                                                        | `subscription.updated` only. No order — nothing is billed now.                                                                                                                                                                                                                                  | The response and every later read carry a non-null **`pending_update`** describing the scheduled change. `status` stays `active`, `plan` stays `crew`, and **Crew entitlements survive to `current_period_end`**. The UI says "Solo from <date>", not "Solo". Submitting another update supersedes the pending one and applies immediately, which is the failure this row exists to catch.                                                                                                                                                                                                                                                                                                                                                                                   |
| **4** | **Cancel** at period end, then fall back to Free                                  | Workspace 2 from row 1. `PATCH /v1/subscriptions/{id}` with `{"cancel_at_period_end": true}`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | Immediately, in this documented order: `subscription.updated` → `subscription.canceled`. At period end: `subscription.updated` → `subscription.revoked`.                                                                                                                                        | After the first pair: `status` still `active`, `cancel_at_period_end` true, entitlements **unchanged**. Treating `subscription.canceled` as "revoke now" is the classic bug and this row is the one that catches it. The Free fallback is driven by `subscription.revoked`, whose subscription data carries status `canceled`.                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **5** | **Resume** before the period ends                                                 | The row-4 subscription, still inside its period. `PATCH /v1/subscriptions/{id}` with `{"cancel_at_period_end": false}` — the same field with the opposite value is the documented uncancel.                                                                                                                                                                                                                                                                                                                                                                                                   | `subscription.uncanceled`, with its `subscription.updated` twin. Polar publishes no ordering for this pair, so assert state, not order.                                                                                                                                                         | `cancel_at_period_end` back to `false`, `canceled_at` cleared, `status` `active`, entitlements untouched throughout, and the "ends on <date>" notice gone from `/settings/billing`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **6** | **Failed payment**: `past_due` keeps access during dunning, revocation removes it | **No hand-walkable sandbox recipe exists, and this row is deliberately not walked by hand.** Polar retries a failed renewal on a fixed schedule at 2, 7, 14 and 21 days from the first failure, and the sandbox exposes no clock control and no "force a decline on renewal" lever, so the terminal state is three weeks away. This row is therefore **covered by a unit test against a fake billing runtime**, not by a click-through: feed the handler a captured `subscription.past_due` payload, then a captured `subscription.revoked` payload, and assert on the entitlement each time. | `subscription.past_due` on the first failure. `subscription.revoked` when retries are exhausted.                                                                                                                                                                                                | While `past_due`: entitlements **held** — which is only true because §9.1 sets the organization grace period to `After 21 days` in _both_ organizations; with Polar's default of `Immediately` they are revoked at once, in whichever organization was left on it. The banner points at **Manage billing**, and only the hosted portal can fix the card (§9.9). On revocation: entitlements dropped, workspace on Free. **Key the entitlement loss to the `subscription.revoked` event, not to a status string.** Polar's own pages disagree about the terminal status — the failed-payments page says the subscription "moves to `canceled`", while `unpaid` is a real member of the enum — so treat `canceled` _and_ `unpaid` as revoked and let the event be the trigger. |
| **7** | **Read-only orders list**, with a downloadable invoice for any paid order         | Workspace 1, which now has several paid orders from rows 1–2. Open `/settings/billing`; the list is `GET /v1/orders/?external_customer_id=<organizationId>&limit=100&sorting=-created_at`. Click **Invoice** on a paid order: `POST /v1/orders/{id}/invoice`, then `GET /v1/orders/{id}/invoice`.                                                                                                                                                                                                                                                                                             | `order.updated` when generation completes, carrying `is_invoice_generated: true`.                                                                                                                                                                                                               | Only this workspace's orders appear, and the server function derives `external_customer_id` from the session's active organization rather than from anything the client sent — a client-supplied id must be ignored outright, because the Organization Access Token would happily return another tenant's orders if it were passed through. The first `POST` returns `202`, so the UI shows a _generating_ state and settles on a link; it must not show an error for the `404` a too-eager `GET` produces. An order that has never been generated shows **Generate**, not a broken link. Amounts are tabular and the currency matches the order.                                                                                                                            |
| **8** | **Customer Portal** through a minted customer session                             | Workspace 1. Click **Manage billing**; the server calls `POST /v1/customer-sessions/` with `{"external_customer_id": "<organizationId>", "return_url": "…/settings/billing?portal=complete"}` and redirects to the `customer_portal_url` on the `201`.                                                                                                                                                                                                                                                                                                                                        | None — this path is synchronous. Any change made _inside_ the portal (a cancel, a plan switch) comes back as the row-4 or row-2 events.                                                                                                                                                         | The browser lands **already signed in** — no one-time code — on the portal for this organization's customer and no other. The subscription, the orders and the payment-method surface are all present. Clicking back returns to `/settings/billing?portal=complete`. Mint a second session and confirm it is a _new_ token: a cached `customer_portal_url` must not be reused after `expires_at`.                                                                                                                                                                                                                                                                                                                                                                            |

Rows 1–5, 7 and 8 are walked by hand and their evidence is the `wrangler tail` transcript plus a
screenshot of `/settings/billing`. Row 6's evidence is a passing test. Phase A is not done until
all eight are green and a redelivery (§9.7) of any row-1 event changes nothing.

Until then, the honest statement of where phase A stands is: **the code is written and the matrix
is unwalked.** Say that, in those terms, in the deploy log and in any release note. A row is green
when an operator has run it and written the evidence down here — never because the code that would
satisfy it exists.

---

## 10. Continuous deployment

`.github/workflows/ci.yml` runs on every pull request: install, route-tree freshness, lint,
typecheck, tests with coverage, build. `.github/workflows/deploy.yml` runs on `main`: build,
apply D1 migrations, deploy, smoke-check.

Configure the repository once. Product ids are public and are inlined into both bundles at build
time, so they belong in repository **variables**, never secrets. Locally the same names go in
`.env.local`, which is gitignored.

| Kind     | Name                              | Value                                                            | Status                                             |
| -------- | --------------------------------- | ---------------------------------------------------------------- | -------------------------------------------------- |
| Secret   | `CLOUDFLARE_API_TOKEN`            | token with _Edit Cloudflare Workers_ + _D1 Edit_ on this account | required                                           |
| Secret   | `CLOUDFLARE_ACCOUNT_ID`           | account id from the dashboard sidebar                            | required                                           |
| Variable | `VITE_POLAR_PRODUCT_SOLO_MONTHLY` | product UUID from §9.1                                           | **required to sell** — `src/lib/plans.ts` reads it |
| Variable | `VITE_POLAR_PRODUCT_SOLO_YEARLY`  | product UUID from §9.1                                           | **required to sell**                               |
| Variable | `VITE_POLAR_PRODUCT_CREW_MONTHLY` | product UUID from §9.1                                           | **required to sell**                               |
| Variable | `VITE_POLAR_PRODUCT_CREW_YEARLY`  | product UUID from §9.1                                           | **required to sell**                               |

**One set of build-time names, and it is the Polar one.** `src/lib/plans.ts` resolves every
purchasable price from the four variables above and `requirePrice()` throws when one is empty, so
a build with them unset renders a pricing page with nothing to buy. Both `.github/workflows/ci.yml`
and `.github/workflows/deploy.yml` pass exactly these four into the build — which is why they are
repository variables here rather than `.env.local` entries — and `.dev.vars.example` documents the
same four and no others. **Act:** create the four products in Polar (§9.1) and set the four
variables in the repository, not only locally. An unset variable there is a green CI run that
ships an unpurchasable pricing page.

**Closed, and recorded so it is not reopened.** Before phase A this section carried a five-part
"known divergence" between the runbook and the shipped code: four `VITE_STRIPE_PRICE_*` build
variables, both workflows naming them, a superseded billing client and route, a template that had
already moved ahead of the code, and the `stripe` package itself. All five are closed. The package
left `package.json` in phase A's dependency round — `grep -c stripe pnpm-lock.yaml` returns `0` —
and the rest went with the code over the three rounds that followed; `grep -ril stripe src/`
returns nothing. There is now one provider, one set of build-time names, and no divergence to
enumerate. The three provider **columns** moved in the same phase: §9.10 has the rename and §12
has what it costs a rollback.

Without the two repository **secrets** the deploy workflow logs a warning and skips rather than
failing, so a fork stays green. The product **variables** behave differently and more quietly: a
build with them unset succeeds, deploys, and renders a pricing page whose buttons cannot reach a
checkout. Nothing fails; there is simply nothing to buy. That is why §11's click-through, and not
CI, is what proves billing works.

---

## 11. Smoke verification

Run all of these after the first deploy, and after any deploy that touches the platform layer.

```bash
BASE=https://planned.travel

# 1. The front door renders server-side.
curl -sS -o /dev/null -w 'landing %{http_code} %{time_total}s\n' "$BASE/"

# 2. Auth endpoints answer. Unauthenticated: 200 with a null session.
curl -sS -w '\nsession %{http_code}\n' "$BASE/api/auth/get-session"

# 3. Tile metadata: 200, a strong ETag, and range support advertised.
curl -sSI "$BASE/api/tiles/basemap.pmtiles" | \
  grep -Ei 'HTTP/|etag|accept-ranges|content-length|cache-control'

# 4. A range read: expect 206 and Content-Range.
curl -sS -D - -o /dev/null -H 'Range: bytes=0-15' \
  "$BASE/api/tiles/basemap.pmtiles" | grep -Ei 'HTTP/|content-range|x-tiles-cache'

# 5. Repeat the same range: x-tiles-cache should now say hit.
curl -sS -D - -o /dev/null -H 'Range: bytes=0-15' \
  "$BASE/api/tiles/basemap.pmtiles" | grep -i 'x-tiles-cache'

# 6. Conditional request: expect 304.
ETAG=$(curl -sSI "$BASE/api/tiles/basemap.pmtiles" | tr -d '\r' | awk '/^[Ee]tag:/{print $2}')
curl -sS -o /dev/null -w 'conditional %{http_code}\n' \
  -H "If-None-Match: $ETAG" "$BASE/api/tiles/basemap.pmtiles"

# 7. Unsatisfiable range: expect 416.
curl -sS -o /dev/null -w 'unsatisfiable %{http_code}\n' \
  -H 'Range: bytes=999999999999-' "$BASE/api/tiles/basemap.pmtiles"

# 8. Key validation: expect 404, never a bucket listing or a 500.
curl -sS -o /dev/null -w 'traversal %{http_code}\n' \
  "$BASE/api/tiles/%2e%2e/secret.pmtiles"
```

Then watch live traffic while clicking through sign-up, creating a trip and opening the map:

```bash
pnpm exec wrangler tail --format pretty
```

Expected in the log stream: one JSON line per request with `requestId`, `route`, `durationMs`
and `outcome`; no unhandled exceptions; no `tile cache operation failed` warnings.

**If this deploy sells, one more click, and it is the only proof that billing works.** No curl
can stand in for it: the eight checks above pass identically on a Worker with no payment provider
configured at all, and so does CI (§10). On staging, against the **sandbox** organization: sign
in, open `/pricing`, choose **Solo → monthly**, and complete the checkout with the sandbox test
card `4242 4242 4242 4242`, any future expiry, any 3-digit CVC. Three things must all be true
afterwards — `wrangler tail` shows the webhook delivery answered `200`, `/settings/billing` shows
the active plan, and the Solo modules have unlocked. A `BillingConfigError` in the tail means
`POLAR_ACCESS_TOKEN` is unset; a checkout button that goes nowhere means the four
`VITE_POLAR_PRODUCT_*` variables were missing from the build; a completed payment that never
changes the plan means the webhook endpoint or `POLAR_WEBHOOK_SECRET` is wrong. Each of those is a
§6, §9 or §10 step, not a bug. This click is row 1 of §9.11, and walking it here does not tick the
other seven.

Finally confirm the background paths:

```bash
# Queue consumer and DLQ depth.
pnpm exec wrangler queues info planned-travel-tasks
pnpm exec wrangler queues info planned-travel-tasks-dlq   # must stay empty

# Cron triggers actually registered on the Worker.
curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/planned-travel/schedules" |
  python3 -c 'import json,sys; [print(s["cron"]) for s in json.load(sys.stdin)["result"]["schedules"]]'

# …and for staging, whose array is a different array (§15.3):
curl -sS -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
  "https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/workers/scripts/planned-travel-staging/schedules" |
  python3 -c 'import json,sys; [print(s["cron"]) for s in json.load(sys.stdin)["result"]["schedules"]]'
```

Expect exactly three on production today — `*/15 * * * *` reminder sweep, `0 3 * * *` nightly
export, `17 4 * * 1` weekly prune — and exactly one on staging, `0 3 * * *`. The `0 4 * * 1`
catalogue scrape joins both in phase D and must **not** appear before then (§15.3).

**Use this read-back, not `wrangler deployments list`.** That command lists Worker _versions_ —
id, author, source, deployment time — and never prints a cron expression, so it cannot tell you
whether a schedule is registered, missing or stale. There is no `wrangler` subcommand that
prints registered schedules; the three things that do show them are the read-back above, the
dashboard at **Workers & Pages → planned-travel → Settings → Triggers → Cron Triggers**, and the
tail of a successful `wrangler deploy`, which prints `Deployed planned-travel triggers` followed
by one `schedule: <expression>` line per registered cron. The deploy output is a record of what
that deploy just wrote; the read-back is the only way to ask what is registered right now,
including after a deploy someone else ran. The API token needs the same _Edit Cloudflare
Workers_ grant §10 already gives it.

---

## 12. Rollback

```bash
pnpm exec wrangler deployments list          # find the previous version id
pnpm exec wrangler rollback VERSION_ID
```

Rollback reverts code, not data. **That is only safe across migrations that are additive**, and §5
says why: the reader a rollback strands is the previous Worker's SQL, not the rows. An additive
migration leaves every column the old Worker names still present, so it serves. A rename or a drop
does not, and no amount of empty table changes that — the failure is `no such column` on the first
query.

So `wrangler rollback` alone is correct for any release whose migrations are all additive, which
is every release except the ones in the register below. If a migration must be undone in the
normal case, write a new **forward** migration that removes what the previous one added; never
edit an applied migration file.

### Register of non-additive migrations

Every migration that departs from §5's additive rule is listed here, with what it costs and how to
cross it. A migration absent from this table is a plain `ALTER TABLE … ADD COLUMN` or a
`CREATE TABLE` and needs nothing from this section. Adding a row is part of shipping the
migration, not part of the incident.

Two different departures, and they fail differently, so the table names which one each is:

- **Reader-unsafe** — the old Worker's SQL no longer matches the schema. A rollback across it
  fails on the first query, with any number of rows including zero.
- **Table recreate** — `drizzle-kit` rebuilt the table (`CREATE TABLE __new_<name>` … `DROP TABLE`
  … `RENAME TO`). The old reader may survive it, but the forward application is a copy under
  `PRAGMA foreign_keys=OFF/ON`, which D1 does not honour (§5), and a hand-written `CHECK`
  constraint that the regenerated schema no longer carries would be lost silently.

| Migration               | Departure      | What it did                                                                                                                                                                                                                                                           | Crossing it                                                                                                                                                                                         |
| ----------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `0001_aspiring_cargill` | table recreate | Rebuilt `expenses` to give `original_currency` its own column. Previously the shared `currency()` builder hardcoded the name, so `currency` and `originalCurrency` both mapped to one SQL column and the source currency of a foreign receipt was silently discarded. | Rollback is safe for the reader: it only gained a column, so the older Worker's statements still resolve. The recreate matters going forward, not backward — read §5 before generating another one. |
| `0002_calm_daredevil`   | reader-unsafe  | Renamed `stripe_customer_id` → `provider_customer_id`, `stripe_subscription_id` → `provider_subscription_id`, `stripe_price_id` → `provider_product_id`, and swapped the two indexes over them (§9.10).                                                               | **Not safe on code alone.** A Worker from before the phase-A release selects the three old names. Move the schema back first, or do not roll back past it.                                          |

**Crossing `0002`, if it is ever necessary.** In order, and only with the billing screen expected
to be down for the duration:

1. Prefer rolling **forward**. A fix deployed on the current schema costs one deploy; a schema
   reversal costs a migration, a rollback, and a second migration to get back.
2. If the rollback is unavoidable, reverse the three columns and the two indexes in D1 _before_
   the old Worker starts serving — three `ALTER TABLE "subscriptions" RENAME COLUMN` statements
   in the opposite direction, then drop and recreate the two indexes under their old names. Apply
   it with `pnpm exec wrangler d1 execute planned-travel-db --remote --file=…`, not as a
   `drizzle/` migration, because it is a temporary state the repository must not carry.
3. Roll the Worker back. Verify with §11's click-through, not with the eight curl checks — none of
   them touches billing.
4. Getting forward again is the same three renames in the original direction, and then the normal
   deploy. `d1_migrations` already lists `0002` as applied and must not be edited; the renames are
   data-plane statements, not migrations.

**The cheap alternative, and it is usually the right one.** The `subscriptions` table is the only
table `0002` touched, and pre-revenue it is empty or holds one seeded demo row. Dropping and
re-creating it from the old schema is faster than the rename dance and loses nothing that exists.
That stops being true the day the first production row is written, which is also the day this
register stops being a formality.

---

## 13. Routine operations

```bash
# Live logs, filtered to errors.
pnpm exec wrangler tail --status error

# Ad-hoc D1 query (read-only by habit; every write should be a migration).
pnpm exec wrangler d1 execute planned-travel-db --remote --command "select count(*) from trips;"

# Point the basemap at a new archive: upload the new key (§7), edit TILES_ARCHIVE_KEY, deploy.
# No cache purge is needed — the edge key is the resolved object key.

# Rotate a secret. Set the new value, deploy, then revoke the old one upstream.
pnpm exec wrangler secret put POLAR_ACCESS_TOKEN          # the billing credential (§6, §9.2)
pnpm exec wrangler secret put POLAR_WEBHOOK_SECRET        # rotate in the dashboard first (§9.4)

# Nightly backups land in the FILES bucket under backups/.
pnpm exec wrangler r2 object get planned-travel-files/backups/LATEST_KEY --file ./restore.sql --remote
```

---

## 14. Platform roles and MCP tokens

Two role vocabularies coexist and are never conflated (`docs/SPEC.md` §5). **Organization roles**
— `owner`, `admin`, `member` — describe standing inside one workspace and are unchanged by
anything here. **Platform roles** — `admin`, `curator`, `user` — describe standing on the product
itself, come from Better Auth's `admin` plugin, and are what this section grants.

The plugin registration, the five columns it adds (`user.role`, `user.banned`, `user.ban_reason`,
`user.ban_expires`, `session.impersonated_by`) and the console that uses them land in **phase B**.
§14.1 is what you run the first time, by hand, because there is no console yet and no admin to
open one with. It is executable the moment phase B's migration has added the `role` column and
not a step earlier — before that migration the `update` below fails with _no such column_, which
is the correct outcome and not something to work around.

### 14.1 Grant the first `admin` by hand

`defaultRole` is `user`, so a freshly migrated database contains no platform administrator, and
nothing in the product can create one — that is the point of a default that is only ever raised
deliberately. Bootstrap exactly one account, from the machine that holds the Cloudflare
credentials.

Register the account through the product first (`/register`), verify its email, then:

```bash
# 1. Find the id. Never guess it, and never match on name.
pnpm exec wrangler d1 execute planned-travel-db --remote \
  --command "select id, email, role from \"user\" where email = 'ops@planned.travel';"

# 2. Raise it. The double quotes around the table name are not optional — user is a
#    reserved word in enough dialects that leaving it bare is a habit worth not having.
pnpm exec wrangler d1 execute planned-travel-db --remote \
  --command "update \"user\" set role = 'admin' where email = 'ops@planned.travel';"

# 3. Read it back. One row, role = admin.
pnpm exec wrangler d1 execute planned-travel-db --remote \
  --command "select id, email, role from \"user\" where role is not null;"
```

Two things about that column:

- **`user.role` has no database default.** The plugin declares it `required: false` with no
  `defaultValue` and applies `defaultRole` at signup, so the migration that adds the column
  leaves every pre-existing row `NULL`. A `NULL` role means `user` — the guard coalesces it —
  which is why step 3 filters on `role is not null` and expects exactly the one row you just
  wrote.
- **A role change may not reach a live session.** Sessions are cached in KV, so sign out and back
  in after the grant rather than wondering why the console still refuses.

**When there is no admin at all, the recovery is this same `update`.** The steps above are the
whole instrument: run against `--remote`, read back with step 3, sign in. It works from a database
restore that predates any earlier grant, because it writes the `role` column rather than depending
on one.

Better Auth's `admin` plugin does carry a second route - `adminUserIds: [...]`, whose members pass
every permission check regardless of `role` - and this runbook does **not** offer it, for reasons
`docs/ACCESS.md` §1.4 sets out in full. Two of them are operational and belong here: our guard
never consults the list, and all fifteen of the plugin's HTTP paths answer `404`, so an id added to
it opens no console screen and no MCP tool. What it would still do is satisfy the plugin's internal
check inside the `auth.api.*` calls the console makes after our guard has already approved them -
it grants nothing while the code is correct and everything the moment a server function is written
without the guard call. Beyond that it is invisible: no query finds it, no audit row explains it,
`actor_role` records the account as a plain `user`, and it is removable only by a deploy. The
`update` above is greppable, readable back with one query, visible in the console's own user list,
attributable on every row that account writes, and reversible by the statement that set it.

### 14.2 Create a `curator`

Once one `admin` exists, every other platform role is granted from the console (phase B), which
writes a `platform_audit_log` row naming the actor, the target and the before/after value. A
curator gets the catalogue, packs, sources and share moderation, and nothing that touches users
or sessions.

The same `wrangler d1 execute` shape works before the console exists, and is the documented
fallback if the console is ever the thing that is broken:

```bash
pnpm exec wrangler d1 execute planned-travel-db --remote \
  --command "update \"user\" set role = 'curator' where email = 'curator@planned.travel';"
```

Prefer the console. A hand-written `update` bypasses the audit write, so the row exists with no
record of who created it — which is exactly the question asked first when a catalogue entry turns
out to be wrong. If you do use the fallback, note it in the deploy log yourself.

To demote, set the role back to `'user'`; do not `NULL` it, so that the audit trail and the
column agree.

### 14.3 Issue and revoke an MCP token

The MCP server (`/api/mcp`, phase E) authenticates agents with a bearer token from
`staff_api_tokens`, and authorises them through the same `requirePermission` the console uses. A
token therefore carries its holder's whole platform role — the transport has no scope mechanism
of its own — which is why tokens are issued to `curator` accounts and only an `admin` may issue
one.

**The hashing scheme, decided once so that the console and the MCP server compute the same
digest: HMAC-SHA256, keyed by `MCP_TOKEN_PEPPER`, over the token's raw UTF-8 bytes, stored as
lowercase hex.** Not `SHA-256(pepper ‖ token)`. A keyed MAC is the right primitive for the job:
it is length-extension safe, its "key" and "message" roles are unambiguous, and it takes exactly
one WebCrypto call on both sides. Both sides read `MCP_TOKEN_PEPPER` from the environment through
the failing-loudly accessor; neither has a fallback, because a fallback here means two digests
for one token.

- The plaintext token is shown **once**, at issue time, and is never recoverable afterwards.
- `staff_api_tokens` stores the digest in `token_hash`, the operator's own `name` for the token,
  the non-secret `token_prefix`, the owning `user_id`, a mandatory `expires_at`, and
  `last_used_at` / `last_used_ip` / `revoked_at`. It never stores the token. The full column list
  is docs/CATALOG.md §2.10, and the SQL below is written against exactly those names.
- Revocation is a `revoked_at` stamp, not a delete, so the audit trail survives the token.

Issue (console, phase E): **Console → Access → API tokens → Issue token** → pick the owner, a name
and an expiry → copy the value once. Revoke: the same screen → **Revoke**. Both actions write a
`platform_audit_log` row.

Before that console exists, and as the break-glass path afterwards, revoke straight in D1. `name`
carries no unique index, so identify the token by its `token_prefix` — the first twelve characters
of the plaintext, which the console lists beside the name and which is not a secret. Read before
you write: the `select` names the rows the `update` will touch.

```bash
# Which live tokens exist, and what each one is called.
pnpm exec wrangler d1 execute planned-travel-db --remote \
  --command "select id, name, token_prefix, user_id, expires_at from staff_api_tokens where revoked_at is null;"

# Revoke one token by its prefix.
pnpm exec wrangler d1 execute planned-travel-db --remote \
  --command "update staff_api_tokens set revoked_at = unixepoch() * 1000, updated_at = unixepoch() * 1000 where token_prefix = 'pt_mcp_A1b2C' and revoked_at is null;"

# Revoke everything, immediately, for a suspected leak of the table itself.
pnpm exec wrangler d1 execute planned-travel-db --remote \
  --command "update staff_api_tokens set revoked_at = unixepoch() * 1000, updated_at = unixepoch() * 1000 where revoked_at is null;"
```

Rotating `MCP_TOKEN_PEPPER` (§6) is the heavier hammer: it invalidates every issued token at
once, everywhere, with no grace period, because every stored digest was keyed by the old value.
Reach for the `update` above first; rotate the pepper only when the pepper itself is suspect.

**Where the token goes on the client.** Claude Code's HTTP transport authenticates with a static
header:

```bash
claude mcp add --transport http planned-travel https://planned.travel/api/mcp \
  --header "Authorization: Bearer YOUR_TOKEN_HERE"
```

Project scope writes `.mcp.json`, which is normally committed — so a real token belongs in
user-scope `~/.claude.json`, or behind `headersHelper` so it is minted rather than stored. Never
in a committed `.mcp.json`. A JSON entry with a `url` and no `type` is a configuration error:
Claude Code reads a typeless entry as a stdio server, skips it, and says so.

---

## 15. Firecrawl and the weekly catalogue scrape

Everything in this section belongs to **phase D**. Nothing here is wired today: there is no
`/api/firecrawl/webhook` route, no scrape handler, and no `0 4 * * 1` entry in `wrangler.jsonc`.
The steps are written now so that the secrets in §6 have a documented purpose and so that phase D
has nothing left to decide.

### 15.1 `FIRECRAWL_API_KEY`

<https://www.firecrawl.dev> → account → API keys. It is a plain bearer token used only from queue
handlers, never inline in a request, and never from the browser. §6 states what degrades without
it: the cron logs and returns, and the catalogue simply stops growing.

Crawls run against `POST /v2/crawl` and `POST /v2/batch/scrape`. Two parameters are the difference
between a polite crawler and an impolite one, and they are not the same parameter:

- `robotsUserAgent` (top level) is matched against `robots.txt` only.
- `scrapeOptions.headers` sets the User-Agent actually sent on the wire — the string that
  identifies planned.travel in the target's logs and gives them someone to contact.
- `delay` (top level) is the politeness knob between requests.

`formats` in v2 is a **mixed array** of strings and objects — `["markdown", {"type": "json",
"prompt": "…", "schema": {…}}]` — and the extracted object comes back under `data.json`.

### 15.2 `FIRECRAWL_WEBHOOK_SECRET`

Firecrawl account settings → **Advanced** tab. It is **one account-wide value**, not one per
endpoint: the same secret signs every delivery to every URL on the account. There is no
documented rotation endpoint and no documented rotation procedure — regenerating it from the
settings page is the only lever, and it takes effect for every endpoint at once, so treat a
regeneration as a short outage of every in-flight crawl rather than a routine hygiene task.

Deliveries are verified like this:

```
X-Firecrawl-Signature: sha256=<hex>
```

HMAC-SHA256 over the **raw request body**, hex digest, compared in constant time. Reject a
missing signature, a mismatched digest, or an algorithm prefix that is not `sha256`, with `401`.
The vendor's own troubleshooting note names the usual bug: signing
`JSON.stringify(parsedBody)` instead of the bytes as received.

Two things Firecrawl does **not** give us, which our side has to supply:

- **No timestamp header and no replay window.** The signature covers the body alone. Replay
  protection is ours: claim the job id in KV before acting, exactly as §9.7 does for
  `webhook-id`.
- **No account-wide endpoint disabling.** The failure model is per delivery, and it is milder
  than Polar's: the endpoint must answer `2xx` within **10 seconds**; a failure is retried after
  **1 minute, then 5 minutes, then 15 minutes**; and after those three retries _that delivery_ is
  marked failed and is not attempted again. The endpoint itself stays enabled — do not describe
  this as deactivation, and do not assume a later event will carry the lost one's payload. A run
  that misses its `completed` callback is reconciled by polling the job, which is why phase D
  keeps a polling fallback.

The payload envelope is `{ success, type, id, data, metadata, error }`. The `events` filter takes
short names; the delivered `type` is prefixed per operation. The four we subscribe to are
`started`, `page`, `completed` and `failed` — a subset, not the whole vocabulary, which also
includes `action`, `cancelled` and `check.completed` for the operations we do not use.

### 15.3 The weekly scrape cron, `0 4 * * 1`

**Register it in phase D, and not before.** A schedule that fires into a `switch (controller.cron)`
with no matching branch logs `unrecognised cron expression` once a week forever; worse, it invites
someone to add the branch in a hurry. `wrangler.jsonc` is deliberately untouched by this round.

When phase D lands, the entry goes in **two** places, and both must be complete:

```jsonc
// top level — production
"triggers": {
  "crons": ["*/15 * * * *", "0 3 * * *", "17 4 * * 1", "0 4 * * 1"]
},

// env.staging — note it does NOT currently mirror the top-level list
"env": {
  "staging": {
    "triggers": { "crons": ["0 3 * * *", "0 4 * * 1"] }
  }
}
```

Four warnings, in the order they bite:

1. **A deploy replaces the whole array.** Cloudflare's wording: "When deploying a Worker with
   Wrangler any previous Cron Triggers are replaced with those specified in the `triggers` array."
   An empty `crons: []` removes all of them; an _undefined_ `triggers` or `crons` leaves the
   deployed ones in place. So the array must always be written out in full — appending one entry
   means restating the others, and forgetting one silently deletes it from production.
2. **The two arrays are not currently parallel, and an environment's array never inherits.**
   Today the top level has three entries and `env.staging` has exactly one, `0 3 * * *`. Because
   `env.staging` declares its own `triggers`, the top-level array never applies to staging.
   Adding the scrape to only one array leaves the other environment without it — or, if the
   staging array is written as a single entry, silently drops staging's nightly export.
3. **Propagation takes up to 15 minutes.** A cron that has not fired two minutes after a deploy
   is not broken. Verify with the `…/schedules` read-back in §11 — the one command that prints
   the expressions actually registered — rather than by waiting for 04:00, and note that
   `wrangler deployments list` will not answer this question: it lists versions, never crons.
4. **The ceiling is per _account_, not per Worker, and phase D is the deploy that reaches it.**
   Cloudflare's limits table reads "Number of Cron Triggers **per account** — 5 on Workers Free,
   250 on Workers Paid" (<https://developers.cloudflare.com/workers/platform/limits/>, read
   2026-08-22; the Cron Triggers page's own _Limits_ line still says "per Worker" — the table is
   the one that binds, and production and staging are two Workers on one account). The
   arithmetic: production registers three today and `env.staging` one, which is four. Phase D adds
   `0 4 * * 1` to both arrays, because neither inherits from the other — so five, then six. Six is
   over the Free ceiling of five, and it is the _staging_ entry that tips it, which is why nobody
   sees it coming while editing the production array. §0 already requires Workers Paid for the
   queue configuration in `wrangler.jsonc`, so on the account this runbook provisions the real
   headroom is 250 and this is a note. It stops being a note the moment phase D is walked against
   a Free account — a fork, a personal test account, a second staging account — and then the
   failure is at deploy time, not at 04:00 on the Monday after.

`0 4 * * 1` is **unrelated to `17 4 * * 1`**, the weekly retention prune that runs seventeen
minutes later the same morning. Neither depends on the other's ordering, neither reads the other's
output, and the seventeen-minute gap is not a dependency window — it exists so that two weekly
jobs do not contend for the same D1 connection at the same instant. Do not merge them, and do not
"tidy" the scrape to `17 4 * * 1`.

Local testing of the handler is a **phase D** step and needs a dev server
(`wrangler dev --test-scheduled`, then a request to `/cdn-cgi/handler/scheduled?cron=0+4+*+*+1`).
It is named here for completeness and is not part of any earlier phase's work.

---

## 16. Closing checklist

Everything above, in the order a first deploy actually needs it. A line that cannot be ticked is
a deploy that is not finished.

**Infrastructure**

- [ ] D1, KV ×2, R2 ×2, the queue and its DLQ exist, and their ids are in `wrangler.jsonc` (§1–§4).
- [ ] Migrations applied to production and staging; the table count reads back (§5).
- [ ] The basemap archive is uploaded under a dated key and `TILES_ARCHIVE_KEY` names it (§7).

**Secrets** (§6) — `wrangler secret list` shows every required name, for both environments

- [ ] `BETTER_AUTH_SECRET`, `EMAIL_API_KEY`.
- [ ] Optional secrets set or knowingly skipped, with §6's degradation table read for each.
- [ ] `FIRECRAWL_API_KEY` and `FIRECRAWL_WEBHOOK_SECRET` are either both set or both unset.

**Billing that works on the day of the deploy** (§6, §9, §10). Tick either the first four lines
or the last one; there is no third outcome.

- [ ] `POLAR_ACCESS_TOKEN`, `POLAR_WEBHOOK_SECRET` and `POLAR_SERVER` are set, for both
      environments, with the sandbox organization's credentials on staging.
- [ ] The four `VITE_POLAR_PRODUCT_*` repository variables hold real product UUIDs from the
      **production** organization (§9.1, §10). Secrets alone do not sell.
- [ ] The production webhook endpoint of §9.4 step B exists and points at
      `https://planned.travel/api/polar/webhook`.
- [ ] §11's test-card click-through completes on staging: checkout succeeds, the webhook is
      answered `200`, and `/settings/billing` shows the plan. Nothing shorter proves this.
- [ ] _Or_: this deploy sells nothing on purpose. No `POLAR_*` configuration, every workspace on
      `free`, and that decision is written in the deploy log rather than discovered later.

**Polar organization configuration** (§9) — dashboard state no test can read back

- [ ] The three `POLAR_*` secrets belong to the organization the environment is meant to talk to.
- [ ] `POLAR_SERVER` is `production` on production and `sandbox` on staging — and the token beside
      it belongs to the _same_ organization.
- [ ] Four products exist in production and four in sandbox; the two sets of ids are not confused.
- [ ] The access token carries exactly the eight scopes of §9.2.
- [ ] **Settings → Subscriptions → Grace period for benefit revocation** reads `After 21 days` in
      the **production** organization — read off the production dashboard, not inferred from the
      sandbox one (§9.1). Polar's default is `Immediately`, nothing in this repo sets it, and no
      test detects it.
- [ ] The same setting reads `After 21 days` in the **sandbox** organization (§9.1), so §9.11's
      row 6 tests the shape production actually runs.
- [ ] The **sandbox** webhook endpoint of §9.4 step A exists, is the only one on that organization,
      and points at `/api/polar/webhook` on the origin the staging Worker answers on today —
      `https://staging.planned.travel` once §8's custom hostname is attached, its `workers.dev`
      origin before that. `format` is `raw`, and it subscribes to the seventeen events of §9.6.
      Step B — the production endpoint — is a phase-A line, not one to tick today.
- [ ] Bot Fight Mode is **off** for the zone (§9.7).
- [ ] The verifier keys its HMAC with the raw UTF-8 bytes of the secret — §9.5's gotcha — and has
      a unit test with a captured payload.
- [ ] A redelivered event changes nothing (§9.7).
- [ ] All eight rows of §9.11 pass in the sandbox, row 6 by its unit test. **This is the line
      that is not ticked today** — the matrix is unwalked and no credential has been issued to a
      build round, so no row is green. Nothing about a production deploy that sells is finished
      before it is.

**Repository configuration** (§10)

- [ ] `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set as repository secrets.
- [ ] All four `VITE_POLAR_PRODUCT_*` variables are set, or none of them is and the deploy sells
      nothing on purpose. Never half a set: a build with two of four offers one plan and breaks
      the other with no error.
- [ ] `.dev.vars.example` was the source for every local secret value; §6 and the template agree
      name for name, with no carve-out (§6).

**Platform access** (§14)

- [ ] Exactly one `admin` exists, granted by hand, and §14.1's read-back query returns exactly
      that one row.
- [ ] `adminUserIds` does not appear in `src/server/auth/index.ts` at all - absent, not `[]` with
      a comment beside it. Every recovery goes through §14.1's SQL grant, which is `docs/ACCESS.md`
      §8.1's, and a unit test fails on the key's presence rather than on its contents.
- [ ] No MCP token is issued before phase E, and `MCP_TOKEN_PEPPER` is set before the first one is.

**Not yet, on purpose**

- [ ] `wrangler.jsonc` still lists three crons and staging still lists one — `0 4 * * 1` is absent
      from both until phase D (§15.3), confirmed with §11's `…/schedules` read-back rather than
      with `wrangler deployments list`, which never prints a cron.
- [ ] Rolling back past the phase-A release needs §12's register read first — migration `0002`
      renamed three columns, so `wrangler rollback` on its own is not enough across that window.

**Verification** (§11)

- [ ] All eight smoke checks pass, `wrangler tail` is clean, and the DLQ is empty. None of the
      eight says anything about billing — that is the click-through in the billing block above.

**Error reporting** (§17)

- [ ] `SENTRY_DSN` is set for both environments, or the deploy knowingly reports nothing and that
      decision is in the deploy log. Half-configured is the bad outcome: a DSN on the Worker and
      none in the browser reports the server's failures and silently drops every client crash.
- [ ] A deliberate error on staging appears in Sentry within a minute, tagged
      `environment: staging`, and **its top frame names a `src/` file at a real line**. A minified
      frame means the source-map upload did not happen, and every report from that release is worth
      much less than it looks.

## 17. Sentry — error monitoring

Everything above makes the application run. This section is how anyone finds out when it stops.

The Worker's structured logs (§13) go to Workers Observability, which is a live tail: it answers
"what is happening now" for somebody already watching. Sentry answers the other question — "what
has been failing, to how many people, since when" — and it is the question a backlog is built from.

One Sentry **project**, not two. Both environments send to the same DSN and are told apart by the
`environment` tag, which the Worker reads from the `ENVIRONMENT` var in `wrangler.jsonc` and the
browser from `VITE_ENVIRONMENT`. Two projects would split one bug into two unrelated issues the
first time something reached production through staging.

### 17.1 Create the project and get the DSN

1. Create the Sentry organization if there is not one already, and note its slug — that is
   `SENTRY_ORG`.
2. Create **one** project. Platform: _Cloudflare Workers_. Note its slug — that is
   `SENTRY_PROJECT`.
3. **Settings → Projects → \<project\> → Client Keys (DSN)** — copy the DSN. It looks like
   `https://<key>@<org>.ingest.sentry.io/<project-id>`.

A DSN is public by design: the browser half of the reporting ships it in the client bundle, where
anyone can read it. It is not a credential and does not need to be treated as one.

### 17.2 Set it on both environments

```bash
pnpm exec wrangler secret put SENTRY_DSN                 # production
pnpm exec wrangler secret put SENTRY_DSN --env staging   # staging
```

Then, as **repository variables** (Settings → Secrets and variables → Actions → Variables), the
public half that Vite inlines into both bundles:

```
VITE_SENTRY_DSN   = <the same DSN>
SENTRY_ORG        = <org slug>
SENTRY_PROJECT    = <project slug>
```

`VITE_ENVIRONMENT` and `VITE_SENTRY_RELEASE` are not configured by hand — both deploy workflows set
them, to the environment being deployed and to `github.sha`. The release is read by _both_ bundles,
so one deploy is one Sentry release rather than two halves nothing relates.

Leaving all of this unset is a supported state. The Worker runs unchanged and reports nothing, and
the SDK is tree-shaken out of the client bundle entirely.

### 17.2b What is switched on, and what it costs

| Product             | Where                           | Note                                                                                                            |
| ------------------- | ------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| Error monitoring    | Worker, Durable Object, browser | Issues come from `captureException` only, so one failure is one issue                                           |
| Logs                | both                            | `enableLogs`; every structured log line the Worker already emits is mirrored, at its own level                  |
| Tracing             | both                            | 10% on production, 100% on staging. Routing spans come from the TanStack Router integration in `src/router.tsx` |
| Application metrics | Worker                          | `server_fn.failure` counted by kind, and `operation.duration` from anything timed with `Logger.track()`         |
| Session replay      | browser                         | 10% of sessions, 100% of sessions that hit an error                                                             |

**Session replay masks everything by default and that is deliberate.** A replay records the DOM,
and this DOM holds trip contents, member lists and billing state. `maskAllText`, `maskAllInputs` and
`blockAllMedia` are set in `src/lib/sentry-replay.ts`, so what is recorded is layout, timing and
interaction — what somebody _did_ before it broke, not what they wrote. Unmasking a particular
element is a deliberate act (`data-sentry-unmask`); nothing does it today, and adding one should be
reviewed as a privacy change rather than a debugging convenience.

The recorder is ~124 kB and is loaded _after_ hydration, from its own chunk. Registering it inline
in the client entry put it on the critical path, where every visitor paid for it before first paint
to record a session that had not happened yet.

### 17.3 The source-map token

Without source maps every frame in a Sentry issue points at a bundled chunk offset instead of a
`src/` file, which is most of what makes a report actionable. Cloudflare's own `upload_source_maps`
does not help here — it feeds the Cloudflare dashboard, not Sentry.

Create an **organization auth token**: **Settings → Auth Tokens → Create New Token**, with
`project:releases` and `org:read`. Store it as the repository **secret** `SENTRY_AUTH_TOKEN`.

What the build does with it, and what it does without it:

| `SENTRY_AUTH_TOKEN`   | Source maps                                          | Upload                                  |
| --------------------- | ---------------------------------------------------- | --------------------------------------- |
| unset (local, a fork) | not generated                                        | nothing attempted                       |
| set                   | generated `hidden`, client maps deleted after upload | uploaded; **a failure fails the build** |

The build failing on a bad token is deliberate. The expected failure is an expired or mis-scoped
token, which is permanent and otherwise silent — it would ship a release whose every future stack
trace is unreadable while the deploy stays green. If a Sentry outage ever blocks an urgent deploy,
unset the secret for that run; `vite.config.ts` says so at the `errorHandler`.

Client maps are deleted after upload because `dist/client` is served as static assets and a map
left there is the front end's source published to anyone who asks. Server maps are kept — that half
is the Worker bundle, is not served, and wrangler uploads it to Cloudflare for its own traces.

### 17.4 Verify

Deploy staging, then reach a route that throws. Within a minute the issue should be in Sentry with:

- `environment: staging` and a `release` equal to the deployed commit sha;
- a `cf_version` tag naming the Cloudflare version that served the request;
- **a top stack frame naming a file under `src/`, at a plausible line.** This is the check that
  matters. A minified frame means §17.3 did not happen.

Then trigger a client-side error and confirm a second issue arrives from the browser. The two halves
fail independently and only one of them is exercised by a server-side test.

### 17.5 What the reports are for

Sentry is not only a dashboard. Recurring, high-impact issues are turned into triaged GitHub tickets
by `pnpm sandcastle:sentry` — see `docs/agents/triage-labels.md`. That routine needs a **separate**,
read-only Sentry token from the one in §17.3: different scopes, different blast radius, rotated
independently.
