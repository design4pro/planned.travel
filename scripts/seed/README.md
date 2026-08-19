# Demo data

A rich, believable demo workspace for `rafal@planned.travel`: five trips in five different states, one
of them fully furnished, plus the journal, atlas, vacation planner, collections and inbox that hang off
them. Without it every screen renders an empty state and nothing can be judged against the design bar.

`package.json` is frozen, so there is no `pnpm seed` script. The commands below are the interface.

## Run it

The dev server must be running (`pnpm dev`). Then:

```sh
node scripts/seed/seed.mjs
```

| Flag | Effect |
| --- | --- |
| `--force`, `-f` | Rebuild the demo workspace even though it has already been seeded. |
| `--email <address>`, `-e` | Workspace owner to seed. Defaults to `rafal@planned.travel`. |
| `--url <origin>`, `-u` | Dev-server origin. Defaults to `$SEED_URL`, then `localhost:3000`–`3005`. |
| `--status`, `-s` | Report whether the workspace is seeded. Writes nothing. |

`vite dev` moves to the next free port when its configured one is taken, so the script probes
`3000`–`3005` rather than assuming `3000`. Pass `--url` if yours is elsewhere.

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

`rafal@planned.travel` already exists and is resolved **by email**, never by a hardcoded id. Three
collaborators are created so splits, assignments, votes and chat have real names behind them:

| | Name | Email | Role |
| --- | --- | --- | --- |
| owner | Rafal Wolak | `rafal@planned.travel` | owner |
| | Mika Tanaka | `mika@planned.travel` | admin |
| | Jonas Berg | `jonas@planned.travel` | member |
| | Priya Raman | `priya@planned.travel` | member |

The three collaborators are created **without a credential account**, so they exist as people in the
workspace but cannot sign in. A demo fixture has no business minting passwords. Only
`rafal@planned.travel` can log in.

The workspace is put on the **Crew** plan first — ten seats bought, four of them filled, billed
monthly — because the Free plan seats one person and caps trips at two. Only the plan is declared in
the dataset: the tier column, the seat and storage ceilings, the currency and the unit amount are all
derived by `rowValuesFromRecord()`, the same translation the Stripe webhook uses, so the row cannot
end up describing a plan it is not on. The ceiling is raised through the billing repository, so the
membership writes that follow still pass through the same quota guard rather than around it.

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

## Known upstream issue

`expenses.original_currency` **does not exist in the database.** In `src/server/db/schema.ts` the
column is declared as:

```ts
currency: currency(),          // → SQL column "currency"
originalCurrency: currency(),  // → SQL column "currency"  ← same name
```

The shared `currency()` builder hardcodes the column name `'currency'`, so both properties map to one
SQL column and the generated migration only ever created one. `original_amount_minor` and
`exchange_rate` persist correctly; the source currency code is silently discarded (`currency` wins, so
no row is corrupted — the trip currency is always what lands).

This is why a foreign receipt currently cannot render as `£596.00 → ¥464,880`, which the reference
demo's costs screen does show. The dataset already supplies `originalCurrency`, so the moment the
schema is fixed the copy becomes correct with no change here. The fix is to give `currency()` a name
parameter and regenerate the migration — both outside this task's file ownership.
