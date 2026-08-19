# planned.travel — Deployment runbook

First deploy, from an empty Cloudflare account to `https://planned.travel` serving traffic.
Every command is copy-pasteable; replace only the `ALL_CAPS` placeholders. Read
`docs/ARCHITECTURE.md` for _why_ these resources exist.

Two rules for this runbook:

- **Resource ids go into `wrangler.jsonc` and are committed.** They are not secrets.
- **Secrets never go into `wrangler.jsonc`.** They are set with `wrangler secret put` and
  documented in `.dev.vars.example`.

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
- A Stripe account with the four prices from `src/lib/plans.ts` created (solo/crew ×
  monthly/yearly).
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

You should see the 57 domain tables plus the 9 Better Auth tables (`user`, `session`,
`account`, `verification`, `organization`, `member`, `invitation`, `passkey`, `two_factor`).

**Migration policy:** migrations are additive. Add a column or a table; never rename or drop in
the same release that stops using it. Both the old and the new Worker version must be able to
serve against the schema, because there is a window during a deploy — and during a rollback —
where they do.

---

## 6. Set every secret

The full list, with what each one is for and where to obtain it, is `.dev.vars.example`. For
production:

```bash
# Required
openssl rand -base64 32 | pnpm exec wrangler secret put BETTER_AUTH_SECRET
pnpm exec wrangler secret put STRIPE_SECRET_KEY          # sk_live_…
pnpm exec wrangler secret put STRIPE_WEBHOOK_SECRET      # whsec_… — from §9
pnpm exec wrangler secret put EMAIL_API_KEY              # transactional email provider

# Optional — each feature degrades cleanly when its secret is absent
pnpm exec wrangler secret put GOOGLE_CLIENT_ID
pnpm exec wrangler secret put GOOGLE_CLIENT_SECRET
pnpm exec wrangler secret put APPLE_CLIENT_ID
pnpm exec wrangler secret put APPLE_CLIENT_SECRET
pnpm exec wrangler secret put APPLE_APP_BUNDLE_IDENTIFIER
pnpm exec wrangler secret put CLOUDFLARE_ACCOUNT_ID      # nightly D1 backup
pnpm exec wrangler secret put CLOUDFLARE_API_TOKEN       # scoped: D1:read
pnpm exec wrangler secret put D1_DATABASE_ID             # the id from §1
pnpm exec wrangler secret put BROWSER_RENDERING_API_TOKEN # PDF export
```

Repeat with `--env staging` for the staging Worker, using test keys.

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

## 9. Stripe wiring

1. Stripe dashboard → Developers → Webhooks → Add endpoint:
   `https://planned.travel/api/stripe/webhook`.
2. Subscribe to the events the handler processes (`checkout.session.completed`,
   `customer.subscription.created|updated|deleted`, `invoice.paid`,
   `invoice.payment_failed`).
3. Copy the signing secret into `STRIPE_WEBHOOK_SECRET` (§6) and redeploy so the running
   Worker picks it up.
4. Price ids are public and are inlined at build time, so they belong in repository
   **variables**, not secrets:

```
VITE_STRIPE_PRICE_SOLO_MONTHLY   VITE_STRIPE_PRICE_SOLO_YEARLY
VITE_STRIPE_PRICE_CREW_MONTHLY   VITE_STRIPE_PRICE_CREW_YEARLY
```

Locally the same four names go in `.env.local` (gitignored).

Local webhook development:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

---

## 10. Continuous deployment

`.github/workflows/ci.yml` runs on every pull request: install, route-tree freshness, lint,
typecheck, tests with coverage, build. `.github/workflows/deploy.yml` runs on `main`: build,
apply D1 migrations, deploy, smoke-check.

Configure the repository once:

| Kind     | Name                             | Value                                                            |
| -------- | -------------------------------- | ---------------------------------------------------------------- |
| Secret   | `CLOUDFLARE_API_TOKEN`           | token with _Edit Cloudflare Workers_ + _D1 Edit_ on this account |
| Secret   | `CLOUDFLARE_ACCOUNT_ID`          | account id from the dashboard sidebar                            |
| Variable | `VITE_STRIPE_PRICE_SOLO_MONTHLY` | `price_…`                                                        |
| Variable | `VITE_STRIPE_PRICE_SOLO_YEARLY`  | `price_…`                                                        |
| Variable | `VITE_STRIPE_PRICE_CREW_MONTHLY` | `price_…`                                                        |
| Variable | `VITE_STRIPE_PRICE_CREW_YEARLY`  | `price_…`                                                        |

Without the two secrets the deploy workflow logs a warning and skips rather than failing, so a
fork stays green.

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

Finally confirm the background paths:

```bash
# Queue consumer and DLQ depth.
pnpm exec wrangler queues info planned-travel-tasks
pnpm exec wrangler queues info planned-travel-tasks-dlq   # must stay empty

# Cron triggers registered (reminder sweep, nightly export, weekly prune).
pnpm exec wrangler deployments list
```

---

## 12. Rollback

```bash
pnpm exec wrangler deployments list          # find the previous version id
pnpm exec wrangler rollback VERSION_ID
```

Rollback reverts code, not data. Because migrations are additive (§5), the previous version can
serve against the newer schema. If a migration must be undone, write a new forward migration
that removes what the previous one added — never edit an applied migration file.

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
pnpm exec wrangler secret put STRIPE_SECRET_KEY

# Nightly backups land in the FILES bucket under backups/.
pnpm exec wrangler r2 object get planned-travel-files/backups/LATEST_KEY --file ./restore.sql --remote
```
