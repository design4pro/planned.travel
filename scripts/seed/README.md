# Demo data

A rich, believable demo workspace for `rafal@planned.travel`: six trips in six different states, one
of them fully furnished, plus the journal, atlas, vacation planner, collections and inbox that hang off
them. Without it every screen renders an empty state and nothing can be judged against the design bar.
The same owner also belongs to a second, minimal workspace with one trip of its own, so the workspace
switcher in the account menu has somewhere to go.

There is no `pnpm seed` script; the commands below are the interface. `pnpm worktree:bootstrap`
runs the seed for you as its last step, and is the shorter road on a checkout that has none of the
local fixtures yet.

## Run it

The dev server must be running. Then:

```sh
node scripts/seed/seed.mjs --url http://localhost:3030
```

Every flag `seed.mjs` accepts; `--help` prints the same list and anything else is a hard error:

| Flag                         | Effect                                                                                                                        |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `--force`, `-f`              | Rebuild the demo workspace even though it has already been seeded.                                                            |
| `--email <address>`, `-e`    | Workspace owner to seed. Defaults to `rafal@planned.travel`.                                                                  |
| `--url <origin>`, `-u`       | Dev-server origin. Defaults to `$SEED_URL`, then the probe list below.                                                        |
| `--password <secret>`, `-p`  | Password the owner account should have. Defaults to `$DEMO_PASSWORD`, then `$E2E_PASSWORD`, then the committed fixture below. |
| `--keep-password`            | Never overwrite a password that is already set.                                                                               |
| `--today <YYYY-MM-DD>`, `-t` | Tell the Worker what day it is, for the duration of this one request.                                                         |
| `--status`, `-s`             | Report whether the workspace is seeded. Writes nothing.                                                                       |

### `--today` is a falsification tool, not a configuration knob

The fixture is anchored: every date in it is an offset from `SEED_ANCHOR_DAY` in
`src/routes/api/dev/-seed/dataset/anchor.ts`, and no clock reaches a written row — the only
`Date.now()` under `-seed/` is the stopwatch that times the run for the report. The two column
defaults that would otherwise smuggle one in are supplied by the fixture itself:
`src/routes/api/dev/-seed/fixture-rows.ts` hands the seed a primary key and a row instant derived
from the anchor, so the id a trip's cover drawing is hashed from is the same id on every run. That
is a claim, and `--today` is how it gets tested instead of trusted. The flag sends the day as the
`x-pt-server-today` header; `serverToday()` and `serverNow()` in `src/server/clock.ts` read it, guarded by
`import.meta.env.DEV` so the production build folds the whole path away. `serverNow()` is the instant the
weather policy reads (`src/server/weather/bindings.ts`), so the cached days below are forecast, recorded
or estimate relative to the fixture day and not to the wall clock.

Seed the same dataset under three widely separated days and the rows written must be
byte-identical:

```sh
node scripts/seed/seed.mjs --url http://localhost:3030 --force --today 2026-08-20
node scripts/seed/seed.mjs --url http://localhost:3030 --force --today 2026-09-01
node scripts/seed/seed.mjs --url http://localhost:3030 --force --today 2026-11-15
```

`--force` is not optional in that loop. The completion marker makes a second run a no-op, so a
three-clock proof run without it writes nothing twice and proves nothing three times.

### Always pass `--url`, and the reason is not tidiness

**Ports 3030–3040 are reserved for automated rounds.** The reservation is enforced in
`playwright.config.ts`, which throws rather than run the visual suite against a port outside that
range — a rule added after four consecutive rounds photographed the wrong server, one of them a
different worktree's application. That file also names the only sanctioned way to start a server
for those rounds:

```sh
pnpm exec vite dev --port 3030 --strictPort
```

`pnpm dev` hardcodes `--port 3000`, so it is never the way to start a server for a reserved-range
round.

The seeder has no equivalent guard, and it cannot have one: it is an HTTP client, so every origin
that answers `/api/dev/seed` looks alike to it. `DEFAULT_PORTS` in `seed.mjs` probes the developer
range first and then part of the reserved one, and takes the first origin that answers — which on
a machine running two checkouts is a **write** to whichever server replied, not necessarily yours.
So:

- **Pass `--url http://localhost:3030`** (or export `SEED_URL`) whenever a reserved server is what
  you mean to seed. `-u` is not optional in that situation, and the reserved range is exactly the
  one that is shared between worktrees.
- `--status` is the cheap way to confirm you are talking to the right database before `--force`
  rebuilds one.
- Bare `node scripts/seed/seed.mjs` is only correct on a single-checkout machine.

## Verify it

```sh
node scripts/seed/verify.mjs
```

Reads the data back out of local D1 through `wrangler d1 execute` and checks the four things that
would silently ruin the demo: row counts per table, that every trip still carries the primary key the
dataset declares, that every expense's shares sum to exactly its amount, and that each trip's
balances add up to minus its unclaimed spend and nothing else. It exits non-zero when any of them
fails. Add `--remote` to point it at the deployed database.

Ad-hoc queries work the same way — note that local D1 caps a compound `SELECT` at a handful of terms,
so batch `UNION ALL` counters in fives:

```sh
pnpm exec wrangler d1 execute planned-travel-db --local --command \
  "SELECT 'trips' AS t, COUNT(*) AS n FROM trips
   UNION ALL SELECT 'places', COUNT(*) FROM places
   UNION ALL SELECT 'expenses', COUNT(*) FROM expenses
   UNION ALL SELECT 'expense_shares', COUNT(*) FROM expense_shares
   UNION ALL SELECT 'reservations', COUNT(*) FROM reservations;"
```

## How it works, and why it is built this way

The seed runs **inside the Worker**, at `POST /api/dev/seed`, and the script above is only the trigger.
That is not a workaround: the D1 binding, the Drizzle client and the tenant repositories only all exist
inside the Worker runtime, and going through the repositories is the whole point.

Every tenant row is written by a function in `src/server/repos`. Nothing here writes SQL against a
tenant table, stamps an `organization_id` by hand, or reaches around a Zod schema (the auth tables belong
to the auth module: `bootstrap.ts` writes the `user` and `account` rows, and the second workspace's
`organization` and `member` rows, through `authDb()`, the seam `src/server/auth/provisioning.ts` uses
too) — so seeding exercises tenant scoping, input
validation, slug reservation, the contiguous day-run invariant, the plan quota guards and the split
arithmetic exactly as a real user would. A dataset that survives that is worth trusting as a fixture.

```
src/routes/api/dev/seed.ts          the dev-only route
src/routes/api/dev/-seed/
  types.ts                          the shape of the dataset
  dataset/flagship.ts               Tokyo & Kyoto — the fully furnished trip
  dataset/trips.ts                  in progress, completed, archived, draft
  dataset/workspace.ts              people, atlas, journal, collections, vacay, inbox
  apply-trip.ts                     one generic pass that writes any trip
  apply.ts                          orchestration, idempotence, the report
  weather-cache.ts                  the weather cache entries and the spent allowance (KV)
  dataset/second-workspace.ts       the second workspace's name, slug and one trip
  bootstrap.ts                      owner lookup by email + the collaborator user rows
                                    + `ensureSecondWorkspace`
scripts/seed/seed.mjs               trigger
scripts/seed/verify.mjs             read-back and consistency checks
```

### The weather cache

After the rows are written the route also writes the weather the planner reads from KV
(`-seed/weather-cache.ts`), so the weather journey (`e2e/trip-weather.spec.ts`) needs no provider stub:
Lisbon day 1 is a recorded day, days 4 and 5 are forecasts, Tokyo day 1 is an estimate, and the
workspace's weather allowance for the fixture month is spent, so every other located day is
unavailable without a call going out. The report's `weather` field counts what was written (`entries`, `allowanceWindow`, `allowance`).

Directories prefixed with `-` are ignored by the router, so nothing under `-seed/` becomes a route.

### Production safety

Both handlers on the route check `import.meta.env.DEV` before anything else and return the same plain
404 an unmatched URL returns. Vite replaces that flag with a literal at build time, so in a production
bundle the guard is `if (true) return notFound()`, and the seed is reached through a dynamic `import()`
inside the _other_ branch — which means the dataset and the applier are never pulled into the deployed
Worker at all. There is no configuration under which a production request reaches a write path.

### Idempotence

Running it twice does not duplicate rows. Three mechanisms, in order of how often they fire:

1. **A completion marker.** `app_settings['demo.seed']` records the dataset version, and it is written
   only after a run finishes completely. A second run sees it and returns in a couple of milliseconds
   having touched nothing.
2. **Rebuild by slug.** A run that _is_ going to write addresses each trip, journey and collection by
   its slug and deletes a stale one first, cascading its children away. So a run that crashed half way
   leaves no marker and the next run repairs rather than duplicates. Notifications and audit entries
   are keyed by message key and action and rebuilt the same way, because a rebuilt journey or
   collection has a new id and the old rows would otherwise be left pointing at nothing.
3. **Upserts everywhere else.** Settings, subscription, usage counters, categories, moods, visited
   countries and regions, vacation entitlements, holidays and day marks all go through repository
   functions that were already find-or-create.

Verified by running it four times: second run skipped in 3 ms, and three consecutive `--force` runs
produced byte-identical row counts across all 57 counters.

### Trip ids are fixed on purpose

Every trip in the dataset declares its own primary key, and the seed writes that key verbatim:

```
demo-trip-01-tokyo-and-kyoto
demo-trip-02-lisbon-long-weekend
demo-trip-03-dolomites-hut-to-hut
demo-trip-04-marrakech-riad-week
demo-trip-05-patagonia-traverse
demo-trip-06-porto-one-lunch
```

**Why.** A trip's cover art is a _pure hash of its id_ — the contour landform and the colour wash are
both derived from it, and the wash walks forward on a collision, so one changed id can recolour cards
whose own id never moved. Left to the schema's generator, `--force` mints a fresh key for every trip
and silently repaints the whole grid. That is what broke the recorded screenshots of `/trips` and
`/dashboard`: every glyph, date, chip and edge was pixel-identical, and only the artwork had moved.
Pinning the key makes a rebuild a no-op as far as the pixels are concerned, so a fresh clone that
seeds from scratch renders the same cards the baselines were photographed against.

**The rules that keep it true.**

- The ids ascend in the order the applier writes them. `order by id` is the cursor a paginated list
  pages on, so renumbering one means renumbering the rest.
- `createTrip` in `src/server/repos/trips.ts` takes the key as an _optional_, Zod-validated input.
  Omit it — as `createTripFn` and therefore every real user does — and the column's own
  `$defaultFn` mints a time-sortable random key exactly as before. Nothing about a user's rows
  changed, and no request body can reach the field.
- Updating a trip can never move its key: `updateTripInput` deliberately does not carry `id`.
- `node scripts/seed/verify.mjs` restates the six ids and checks them against the rows in the
  database, and `src/server/repos/__tests__/trips.test.ts` restates them again against the dataset.
  Editing one without editing both turns the suite red before it turns a screenshot red.
- Because the keys are constants rather than per-workspace values, **one database holds one demo
  workspace of six trips.** (The second workspace's one trip has a key of its own,
  `demo-trip-07-sopot-family-weekend`.) Seeding a second owner with `--email` into the same D1 file
  collides on the trips table's primary key. That is the deliberate trade: a key derived from the workspace would be stable
  across `--force` but not across a fresh database, which is precisely the failure being fixed here.
- Only trips are pinned. Everything else the seed writes still takes a generated key, because
  nothing else is drawn from its own identifier.

Each run prints the ids it wrote, under each trip's slug, so two runs can be compared by eye:

```
  Trips
    tokyo-and-kyoto
      id  demo-trip-01-tokyo-and-kyoto
      days 12 · dayNotes 11 · places 38 · …
```

## The people

`rafal@planned.travel` is the workspace owner and is resolved **by email**, never by a hardcoded id.
The seed creates the account when it is absent, and reconciles its password when it is present. Three
collaborators are created so splits, assignments, votes and chat have real names behind them:

|       | Name        | Email                  | Role   |
| ----- | ----------- | ---------------------- | ------ |
| owner | Rafal Wolak | `rafal@planned.travel` | owner  |
|       | Mika Tanaka | `mika@planned.travel`  | admin  |
|       | Jonas Berg  | `jonas@planned.travel` | member |
|       | Priya Raman | `priya@planned.travel` | member |

The three collaborators are created **without a credential account**, so they exist as people in the
workspace but cannot sign in. A demo fixture has no business minting passwords for four people. Only
`rafal@planned.travel` can log in.

### The owner's password

The owner is the one exception, because without a signable account the entire product behind the
login page is unreachable — to you on a fresh clone, and to the Playwright suite.

|          |                        |
| -------- | ---------------------- |
| Email    | `rafal@planned.travel` |
| Password | `planned-demo-2026`    |

That password is a **fixture for a local database, not a secret**: it is written down on purpose so
`node scripts/seed/seed.mjs` is the only step between cloning and reaching `/dashboard`. Override it
with `--password`, `$DEMO_PASSWORD` or `$E2E_PASSWORD`.

What the seed does with it:

| State                                    | Result                                                                                                                                                                                  |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No account                               | Created through Better Auth's own sign-up API, so the hash matches what the login form verifies and the `user.create` hook provisions the personal organization. Marked email-verified. |
| Account exists, password already matches | Left untouched. The stored hash is verified first, so re-running the seed is free.                                                                                                      |
| Account exists, different password       | Reset to the seed password, and reported as `reset`. Pass `--keep-password` to keep yours instead.                                                                                      |

This reconciliation happens **before** the `demo.seed` marker check, so a run that writes no data
still fixes the password — which is the run you will make most often.

None of it exists in a production build: `/api/dev/seed` is behind `import.meta.env.DEV`, which Vite
replaces with a literal, so the whole path is compiled out. The password is hashed by
`better-auth/crypto`, the same function the credential provider uses when no custom hasher is
configured — hand-rolling a hash would produce a row the login form rejects.

The workspace is put on the **Crew** plan first — ten seats bought, four of them filled, billed
monthly — because the Free plan seats one person and caps trips at two. Only the plan is declared in
the dataset: the tier column, the seat and storage ceilings, the currency and the unit amount are all
derived by `rowValuesFromRecord()`, the same translation the billing webhook uses, so the row cannot
end up describing a plan it is not on.

The three provider columns on that row — `provider_customer_id`, `provider_subscription_id` and
`provider_product_id` — carry local placeholders and nothing real. The seed contacts no payment
provider and mints no customer; the customer and subscription ids are fixed demo strings, and the
product id is resolved from the catalogue in `src/lib/plans.ts` so the row agrees with whatever this
build sells. That is what makes the seeded workspace exercise the same read path as a paid one —
`resolveQuotas()` reads `provider_product_id` exactly as it does in production — without any
credential being present. The ceiling is raised through the billing repository, so the membership
writes that follow still pass through the same quota guard rather than around it.

## What gets written

| Trip                  | Status      | Dates          | Currency | Travellers |
| --------------------- | ----------- | -------------- | -------- | ---------- |
| Tokyo & Kyoto         | `booked`    | 9–20 Oct 2026  | JPY      | 4          |
| Lisbon, slowly        | `active`    | 17–23 Aug 2026 | EUR      | 3          |
| Dolomites, hut to hut | `completed` | 13–20 Jun 2026 | EUR      | 3          |
| Marrakech riad week   | `archived`  | 8–15 Nov 2025  | MAD      | 2          |
| Patagonia traverse    | `draft`     | —              | USD      | 1          |
| Porto, one long lunch | `planning`  | —              | EUR      | 1          |

Lisbon is the one trip with all three trip roles: Rafal owns it, Priya edits it and Jonas only views it (the account the costs-tab role journeys sign in as a viewer; Priya is their editor).

The flagship carries 12 days (each with a title, notes and an accommodation covering it), 38 places
across nine categories with real coordinates, addresses, opening hours and ratings, 38 stops in
geographic order, 8 transport legs (long-haul flights, a Romancecar, a Shinkansen, transfers), 12
reservations spanning confirmed/pending/cancelled, 29 expenses, 2 packing lists with 32 items, a
14-message conversation with reactions and threaded replies, 2 shared notes, a poll with four votes,
and 9 file rows.

Workspace-level: 2 journeys (one published, one draft) with 3 entries and 2 photos, 2 collections with
15 saved places and labels, 12 visited countries across five continents, 9 visited regions, 9
bucket-list items (3 achieved), a 2026 vacation plan with entitlements, three holiday calendars, five
company holidays and 70 day marks, 7 notifications (3 unread) and 7 audit entries.

### The money

The costs screen is the one judged hardest, so the flagship's ledger is arithmetically exact rather
than plausible-looking. Amounts are JPY minor units; four-way splits use figures divisible by four so a
rounding remainder never muddies a demo balance.

```
paid    Rafal 886,310 · Mika 585,120 · Jonas 322,900 · Priya 422,340 · unclaimed 4,800
        = 2,221,470, the trip total
share   Rafal 552,314 · Mika 545,372 · Jonas 579,613 · Priya 544,171
        = 2,221,470
balance Rafal +293,996 · Mika +39,748 · Priya −121,831 · Jonas −216,713   (after one 40,000 transfer)
        = −4,800, exactly the unclaimed receipt
```

Seven receipts are in a foreign currency (GBP, EUR) with the source amount and the rate that produced
the JPY figure. Four split methods are exercised: `equal`, `exact` (two people paying for their own
extra bags), `shares` (2:1:2:1 on luggage hire), and one expense with `paid_by` null so the
"outstanding" tile has a value. The other trips deliberately differ: Dolomites and Marrakech are
settled to exactly zero, Lisbon is mid-trip and unsettled.

## Source currency, as measured

A foreign receipt keeps three things beside the trip-currency amount, and `expenses` carries all
three today: `original_amount_minor`, `original_currency` and `exchange_rate`
(`src/server/db/schema.ts`). Nothing in this directory has to compensate for anything — the dataset
supplies `originalCurrency` on seven receipts, the costs screen reads the field
(`src/components/costs/data.ts`), and a receipt renders as `£596.00 → ¥464,880` the way the
reference demo's does.

The collision this section used to report is repaired and stays repaired. The shared column builder
once hardcoded its SQL name, so `currency` and `originalCurrency` mapped to one column and the
source currency was discarded on write; the builder now takes a name
(`const currency = (name = 'currency') => …`) and migration `0001_aspiring_cargill` rebuilt the
`expenses` table to add the columns. That migration is a table recreate rather than an `ADD COLUMN`,
which is why it has a row in the register in `docs/DEPLOY.md` §12 — and why `0006_mighty_nehzno`,
which gave `settlements` the same three columns, is `ADD COLUMN` only.

No row carries the corruption that the recreate could have written, and that is measured rather
than assumed. `0001`'s copy statement selects `"original_currency"` out of a table that did not have the
column yet, and SQLite's double-quoted-string fallback — on in D1 — resolves an identifier it cannot
bind as a text literal instead of failing, so every row that predated the migration would have been
given the 17-character string `'original_currency'`. Both deployed databases were counted on
2026-08-28:

```sh
# and the same again with `--env staging` against planned-travel-db-staging
pnpm exec wrangler d1 execute planned-travel-db --remote --command \
  "select count(*) as total,
          sum(case when original_currency = 'original_currency' then 1 else 0 end) as corrupted
   from expenses;"

planned-travel-db          [{"total":0,"corrupted":null}]
planned-travel-db-staging  [{"total":0,"corrupted":null}]
```

`corrupted` is `null` because it is a `sum()` over an empty set: `expenses` holds no rows at all in
either database. No corrupted row can appear later either: `0000` and `0001` land in the same
commit, so every database built from this repository applies them back-to-back into an empty table. The guard against
a _later_ migration repeating the mistake is
`src/server/db/__tests__/migration-quoted-identifiers.test.ts`.

`settlements` in this dataset is still trip-currency only, so its three columns are `NULL` on every
seeded row. That is the reading the repository fixes: a settlement with none of the three was paid
in the accounting currency and its implied rate is 1.
