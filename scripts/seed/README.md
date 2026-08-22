# Demo data

A rich, believable demo workspace for `rafal@planned.travel`: five trips in five different states, one
of them fully furnished, plus the journal, atlas, vacation planner, collections and inbox that hang off
them. Without it every screen renders an empty state and nothing can be judged against the design bar.

`package.json` is frozen, so there is no `pnpm seed` script. The commands below are the interface.

## Run it

The dev server must be running. Then:

```sh
node scripts/seed/seed.mjs --url http://localhost:3010
```

Every flag `seed.mjs` accepts; `--help` prints the same list and anything else is a hard error:

| Flag | Effect |
| --- | --- |
| `--force`, `-f` | Rebuild the demo workspace even though it has already been seeded. |
| `--email <address>`, `-e` | Workspace owner to seed. Defaults to `rafal@planned.travel`. |
| `--url <origin>`, `-u` | Dev-server origin. Defaults to `$SEED_URL`, then the probe list below. |
| `--password <secret>`, `-p` | Password the owner account should have. Defaults to `$DEMO_PASSWORD`, then `$E2E_PASSWORD`, then the committed fixture below. |
| `--keep-password` | Never overwrite a password that is already set. |
| `--today <YYYY-MM-DD>`, `-t` | Tell the Worker what day it is, for the duration of this one request. |
| `--status`, `-s` | Report whether the workspace is seeded. Writes nothing. |

### `--today` is a falsification tool, not a configuration knob

The fixture is anchored: every date in it is an offset from `SEED_ANCHOR_DAY` in
`src/routes/api/dev/-seed/dataset/anchor.ts`, and no clock reaches a written row — the only
`Date.now()` under `-seed/` is the stopwatch that times the run for the report. The two column
defaults that would otherwise smuggle one in are supplied by the fixture itself:
`src/routes/api/dev/-seed/fixture-rows.ts` hands the seed a primary key and a row instant derived
from the anchor, so the id a trip's cover drawing is hashed from is the same id on every run. That
is a claim, and `--today` is how it gets tested instead of trusted. The flag sends the day as the
`x-pt-server-today` header; `serverToday()` in `src/server/clock.ts` reads it, guarded by
`import.meta.env.DEV` so the production build folds the whole path away.

Seed the same dataset under three widely separated days and the rows written must be
byte-identical:

```sh
node scripts/seed/seed.mjs --url http://localhost:3010 --force --today 2026-08-20
node scripts/seed/seed.mjs --url http://localhost:3010 --force --today 2026-09-01
node scripts/seed/seed.mjs --url http://localhost:3010 --force --today 2026-11-15
```

`--force` is not optional in that loop. The completion marker makes a second run a no-op, so a
three-clock proof run without it writes nothing twice and proves nothing three times.

### Always pass `--url`, and the reason is not tidiness

**Ports 3010–3020 are reserved for automated rounds.** The reservation is enforced in
`playwright.config.ts`, which throws rather than run the visual suite against a port outside that
range — a rule added after four consecutive rounds photographed the wrong server, one of them a
different worktree's application. That file also names the only sanctioned way to start a server
for those rounds:

```sh
pnpm exec vite dev --port 3010 --strictPort
```

`pnpm dev` hardcodes `--port 3000` and `package.json` is frozen, so it cannot be corrected there.

The seeder has no equivalent guard, and it cannot have one: it is an HTTP client, so every origin
that answers `/api/dev/seed` looks alike to it. `DEFAULT_PORTS` in `seed.mjs` probes the developer
range first and then part of the reserved one, and takes the first origin that answers — which on
a machine running two checkouts is a **write** to whichever server replied, not necessarily yours.
So:

- **Pass `--url http://localhost:3010`** (or export `SEED_URL`) whenever a reserved server is what
  you mean to seed. `-u` is not optional in that situation, and the reserved range is exactly the
  one that is shared between worktrees.
- `--status` is the cheap way to confirm you are talking to the right database before `--force`
  rebuilds one.
- Bare `node scripts/seed/seed.mjs` is only correct on a single-checkout machine.

## Verify it

```sh
node scripts/seed/verify.mjs
```

Reads the data back out of local D1 through `wrangler d1 execute` and checks the three things that
would silently ruin the demo: row counts per table, that every expense's shares sum to exactly its
amount, and that each trip's balances add up to minus its unclaimed spend and nothing else. Add
`--remote` to point it at the deployed database.

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

Every row is written by a function in `src/server/repos`. Nothing here writes SQL, stamps an
`organization_id` by hand, or reaches around a Zod schema — so seeding exercises tenant scoping, input
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
  bootstrap.ts                      owner lookup by email + the collaborator user rows
scripts/seed/seed.mjs               trigger
scripts/seed/verify.mjs             read-back and consistency checks
```

Directories prefixed with `-` are ignored by the router, so nothing under `-seed/` becomes a route.

### Production safety

Both handlers on the route check `import.meta.env.DEV` before anything else and return the same plain
404 an unmatched URL returns. Vite replaces that flag with a literal at build time, so in a production
bundle the guard is `if (true) return notFound()`, and the seed is reached through a dynamic `import()`
inside the *other* branch — which means the dataset and the applier are never pulled into the deployed
Worker at all. There is no configuration under which a production request reaches a write path.

### Idempotence

Running it twice does not duplicate rows. Three mechanisms, in order of how often they fire:

1. **A completion marker.** `app_settings['demo.seed']` records the dataset version, and it is written
   only after a run finishes completely. A second run sees it and returns in a couple of milliseconds
   having touched nothing.
2. **Rebuild by slug.** A run that *is* going to write addresses each trip, journey and collection by
   its slug and deletes a stale one first, cascading its children away. So a run that crashed half way
   leaves no marker and the next run repairs rather than duplicates. Notifications and audit entries
   are keyed by message key and action and rebuilt the same way, because a rebuilt trip has a new id
   and the old rows would otherwise be left pointing at nothing.
3. **Upserts everywhere else.** Settings, subscription, usage counters, categories, moods, visited
   countries and regions, vacation entitlements, holidays and day marks all go through repository
   functions that were already find-or-create.

Verified by running it four times: second run skipped in 3 ms, and three consecutive `--force` runs
produced byte-identical row counts across all 57 counters.

## The people

`rafal@planned.travel` is the workspace owner and is resolved **by email**, never by a hardcoded id.
The seed creates the account when it is absent, and reconciles its password when it is present. Three
collaborators are created so splits, assignments, votes and chat have real names behind them:

| | Name | Email | Role |
| --- | --- | --- | --- |
| owner | Rafal Wolak | `rafal@planned.travel` | owner |
| | Mika Tanaka | `mika@planned.travel` | admin |
| | Jonas Berg | `jonas@planned.travel` | member |
| | Priya Raman | `priya@planned.travel` | member |

The three collaborators are created **without a credential account**, so they exist as people in the
workspace but cannot sign in. A demo fixture has no business minting passwords for four people. Only
`rafal@planned.travel` can log in.

### The owner's password

The owner is the one exception, because without a signable account the entire product behind the
login page is unreachable — to you on a fresh clone, and to the Playwright suite.

| | |
| --- | --- |
| Email | `rafal@planned.travel` |
| Password | `planned-demo-2026` |

That password is a **fixture for a local database, not a secret**: it is written down on purpose so
`node scripts/seed/seed.mjs` is the only step between cloning and reaching `/dashboard`. Override it
with `--password`, `$DEMO_PASSWORD` or `$E2E_PASSWORD`.

What the seed does with it:

| State | Result |
| --- | --- |
| No account | Created through Better Auth's own sign-up API, so the hash matches what the login form verifies and the `user.create` hook provisions the personal organization. Marked email-verified. |
| Account exists, password already matches | Left untouched. The stored hash is verified first, so re-running the seed is free. |
| Account exists, different password | Reset to the seed password, and reported as `reset`. Pass `--keep-password` to keep yours instead. |

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

| Trip | Status | Dates | Currency | Travellers |
| --- | --- | --- | --- | --- |
| Tokyo & Kyoto | `booked` | 9–20 Oct 2026 | JPY | 4 |
| Lisbon, slowly | `active` | 17–23 Aug 2026 | EUR | 2 |
| Dolomites, hut to hut | `completed` | 13–20 Jun 2026 | EUR | 3 |
| Marrakech riad week | `archived` | 8–15 Nov 2025 | MAD | 2 |
| Patagonia traverse | `draft` | — | USD | 1 |

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

## Resolved: `expenses.original_currency`

For a while the dataset supplied `originalCurrency` on seven foreign receipts and the database
threw it away. The shared column builder in `src/server/db/schema.ts` hardcoded the SQL name, so
`currency` and `originalCurrency` both mapped to one column and only the trip currency landed — no
row was corrupted, but a receipt could never render as `£596.00 → ¥464,880`, which the reference
demo's costs screen does show.

That is fixed. The builder now takes a name (`const currency = (name = 'currency') => …`),
`originalCurrency` maps to `original_currency`, and migration `0001_aspiring_cargill` rebuilt the
`expenses` table to add it. Nothing in this directory changed: the dataset was already correct,
and the costs screen already reads the field (`src/components/costs/data.ts`), so the copy became
correct the moment the column did. That migration is a table recreate rather than an
`ADD COLUMN`, which is why it has a row in the register in `docs/DEPLOY.md` §12.
