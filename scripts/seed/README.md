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
```

**Why.** A trip's cover art is a *pure hash of its id* — the contour landform and the colour wash are
both derived from it, and the wash walks forward on a collision, so one changed id can recolour cards
whose own id never moved. Left to the schema's generator, `--force` mints a fresh key for every trip
and silently repaints the whole grid. That is what broke the recorded screenshots of `/trips` and
`/dashboard`: every glyph, date, chip and edge was pixel-identical, and only the artwork had moved.
Pinning the key makes a rebuild a no-op as far as the pixels are concerned, so a fresh clone that
seeds from scratch renders the same cards the baselines were photographed against.

**The rules that keep it true.**

- The ids ascend in the order the applier writes them. `order by id` is the cursor a paginated list
  pages on, so renumbering one means renumbering the rest.
- `createTrip` in `src/server/repos/trips.ts` takes the key as an *optional*, Zod-validated input.
  Omit it — as `createTripFn` and therefore every real user does — and the column's own
  `$defaultFn` mints a time-sortable random key exactly as before. Nothing about a user's rows
  changed, and no request body can reach the field.
- Updating a trip can never move its key: `updateTripInput` deliberately does not carry `id`.
- `node scripts/seed/verify.mjs` restates the five ids and checks them against the rows in the
  database, and `src/server/repos/__tests__/trips.test.ts` restates them again against the dataset.
  Editing one without editing both turns the suite red before it turns a screenshot red.
- Because the keys are constants rather than per-workspace values, **one database holds one demo
  workspace.** Seeding a second owner with `--email` into the same D1 file collides on the trips
  table's primary key. That is the deliberate trade: a key derived from the workspace would be stable
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
