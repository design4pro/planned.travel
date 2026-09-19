# Promotion codes on subscribe and plan change, and a free-unlock pool on staging

| Field              | Value |
| ------------------ | ----- |
| **Status**         | in-progress |
| **Issue**          | #599  |
| **Spec PR**        | #600  |
| **Implementation** | none  |

## 📝 TLDR

An organization's owner or admin can already type a promotion code, but only on Polar's hosted
checkout, which is the first purchase. A workspace that already subscribes changes plan through a
server-side `PATCH /v1/subscriptions/{id}` and has nowhere to enter one. This spec adds an optional
promotion-code field to `/settings/billing`. The server resolves the code to a Polar discount,
checks it against the plan being bought, and attaches it: to the checkout on a first purchase, and
to the subscription on a plan change or on the current plan. A code Polar would refuse gets a
translated, specific error, and the plan stays unchanged. Separately, and first, an operator script
seeds a pool of single-use 100%-off codes in the **sandbox** Polar organization, so testers on
staging can unlock Solo or Crew without a card. The script refuses to run against production.

## 📝 Problem Statement

- `buildCheckoutParams()` (`src/server/billing/checkout.ts:306`) sets `allow_discount_codes: true`,
  so the first purchase already takes a code, on Polar's page. Nothing in our code knows a code was
  used.
- `changePlan()` (`src/server/billing/checkout.ts:638`) patches a live subscription with
  `{ product_id, proration_behavior }` and then `{ seats, proration_behavior }`. It never sends a
  `discount_id`, and `planSelectionInput` (`:75`) cannot carry a code. So a subscribing customer
  cannot redeem a promotion at all. Neither the win-back nor the upgrade offer we would want to run
  can be delivered, and support's only option today is to edit the subscription by hand in the
  Polar dashboard.
- Staging runs against the separate sandbox organization (`POLAR_SERVER=sandbox`, docs/DEPLOY.md
  §9.1, §9.3). A tester who needs a paid module walks a full checkout with a sandbox test card and,
  after the 14-day trial, a renewal. No shared, repeatable way exists to put a staging workspace on
  Solo or Crew, which is also what §9.11's unwalked acceptance matrix needs.
- Vocabulary: the brief's "pakiety" (packages) are the paid **plans** `solo` and `crew`
  (`src/lib/plans.ts:28`). **Pack** in `CONTEXT.md` is a packing list and is unrelated.

## 📝 Proposed Solution

Three independently shippable pieces, in this order:

1. **Staging pool (operations only, no app change).** A Node script,
   `scripts/billing/seed-sandbox-discounts.mjs`, creates and tops up a pool of 100%-off codes in
   the sandbox organization. It uses an operator-held token, never the Worker's. Because the first
   purchase already accepts codes on Polar's page, the pool is usable on staging the day the script
   lands.
2. **Server: a code travels with a plan selection.** `planSelectionInput` gains an optional
   `discountCode`. A new owner module, `src/server/billing/discounts.ts`, resolves it to a Polar
   discount and decides whether it applies to the selected product. `createCheckoutSession()`
   sends the resulting `discount_id` on the checkout. `changePlan()` sends it on the subscription
   PATCH, including the new "same plan, code only" case that today returns `surface: 'unchanged'`.
   A refused code is an expected outcome, not an exception: `startPlanChange` returns
   `{ surface: 'discount_rejected', reason }`.
3. **UI: the field.** A collapsed "Have a promotion code?" disclosure above the plan grid on
   `/settings/billing`. Whatever it holds is sent with the next plan choice. When a subscription
   exists, an **Apply to current plan** button sends the code with the current selection.

### Alternatives considered, and why they lost

- **Send every coded change through a hosted checkout.** Polar's checkout creates a subscription.
  It does not modify one, so a subscriber would end up with two.
- **Let Polar be the only validator, and map its `422` to "code rejected".** Polar only sees a
  `discount_id`, never the code. We have to resolve code to id ourselves in any case, and once we
  hold the discount object, checking dates, redemptions and products locally lets us name the
  reason instead of showing one generic refusal.
- **Store the codes in our D1 and apply our own arithmetic.** Polar is Merchant of Record
  (docs/SPEC.md §5 Billing surface). The discounted amount has to be the one on its invoice, so a
  second price engine is ruled out.
- **Put 100%-off codes in production behind a staging-only flag.** A leaked production code costs
  real revenue. Sandbox isolation costs nothing, because the sandbox is a different Polar account.

## 📝 Architecture

| Concept                               | Owner (docs/SPEC.md §8)                                 | New / changed |
| ------------------------------------- | ------------------------------------------------------- | ------------- |
| Code → Polar discount resolution, fit | `src/server/billing/discounts.ts`                       | new           |
| Polar `Discount` wire schema          | `src/server/billing/mapping.ts` (`polarDiscountSchema`) | new export    |
| Carrying the code on a selection      | `planSelectionInput`, `src/server/billing/checkout.ts`  | changed       |
| Checkout body                         | `buildCheckoutParams()`                                 | changed       |
| Subscription PATCH                    | `changePlan()`                                          | changed       |
| Readable outcome to the browser       | `startPlanChange`, `src/routes/_app/-server/billing.ts` | changed       |
| The field and the rejection copy      | `src/routes/_app/settings/billing.tsx`                  | changed       |
| Staging pool                          | `scripts/billing/seed-sandbox-discounts.mjs`            | new           |
| Runbook, token scopes, acceptance row | `docs/DEPLOY.md` §9.2, §9.11 (+ new §9.12)              | changed       |

Flow for a plan choice with a code:

```
billing.tsx ──startPlanChange({ planId, interval, seats, discountCode })──▶ -server/billing.ts
  guarded(changePlan)
    resolvePlanSelection()                       (unchanged; clamps seats, prices product)
    resolveDiscount(runtime, code, productId)    (discounts.ts)
       ├─ KV hit  billing:discount:<CODE> → discount id → GET /v1/discounts/{id}
       └─ miss    GET /v1/discounts/?limit=100&page=n, match `code` case-insensitively
       fit(): (starts_at null or starts_at ≤ now), (ends_at null or now < ends_at),
              (max_redemptions null or redemptions_count < max_redemptions),
              products empty or ∋ productId
       → { ok: true, discountId } | { ok: false, reason }
    no subscription → createCheckoutSession(... discount_id)
    subscription    → code also fits the current product (or product unchanged):
                        PATCH { discount_id }                   (first, alone)
                        then, product changed: PATCH { product_id, proration_behavior }
                      code excludes the current product (e.g. a Crew-only code, Solo → Crew):
                        PATCH { product_id, discount_id, proration_behavior }   (combined)
                      then, seats changed:   PATCH { seats, proration_behavior }
                      (seats variant cannot carry a discount)
```

A rejection is decided **before any Polar write**, with one exception: a `422` on the code-only
`{ discount_id }` PATCH (API Contracts). Every coded attempt, accepted or rejected, that `422`
included, counts against the per-caller limiter (below). `discounts.ts` counts it in
`resolveDiscount()`, so the `422` path needs no second count and only logs
`billing.discount.rejected`.

- The code never reaches Polar's checkout as free text. We send `discount_id`, and
  `allow_discount_codes` stays `true`, so a customer who types a code on Polar's page instead keeps
  working exactly as today.
- `checkoutIdempotencyKey()` includes the resolved discount id. Otherwise a checkout URL cached
  for the same plan without a code would be reused and silently drop the code.
- The lookup needs `discounts:read` on the Worker's `POLAR_ACCESS_TOKEN` (added to the §9.2 scope
  table). A token missing it answers `403`. `discounts.ts` maps that to the existing
  `BillingConfigError` path, so the customer sees "billing is not connected" rather than "code
  rejected", and the log line names the missing scope for the operator.
- The resolved `code → id` pair is cached in the existing KV cache (`runtime.cache`) for 10
  minutes. A miss is cached for 60 seconds (`billing:discount-miss:<CODE>`), so repeating a wrong
  code does not cost another paged lookup on the one Polar token every tenant shares. The trade-off
  is that a code created in the dashboard can take up to a minute to become redeemable.
- **Limiter.** Anyone who registers is `owner` of their own organization, so `assertCanManage`
  bounds nothing against guessing, and registration is self-serve and free, so user and
  organization ids are just as cheap to mint. The limiter therefore has two layers:
  - **Per caller.** `discounts.ts` counts **every coded attempt**, accepted or rejected, in KV per
    user, per organization and per client IP (`billing:discount-attempts:u:<userId>`,
    `…:o:<orgId>` and `…:ip:<cf-connecting-ip>`, the address `src/server/audit/trail.ts` already
    reads; 10 per rolling hour each, TTL 3600 s). Past any cap it returns
    `discount_rejected: 'rate_limited'` without calling Polar. The IP key is what a fresh account
    per batch does not reset. Counting accepted attempts too is what bounds a caller who holds one
    valid code (a leaked marketing code, a staging-pool code) and re-applies it: the new
    `discount_id` replaces the old one, so the apply is repeatable, and without the count it would
    cost a by-id lookup and a PATCH each time outside both caps. An honest customer applies one or
    two codes, far under ten.
  - **Global Polar budget.** Every paged `GET /v1/discounts/` request is counted in one KV key per
    minute (`billing:discount-lookups:<epochMinute>`, TTL 120 s), capped at a fifth of the
    environment's Polar limit (DEPLOY.md §9.8): 100 requests a minute in production, 20 in the
    sandbox, picked by `POLAR_SERVER`. The by-id `GET /v1/discounts/{id}` on a KV hit is not
    counted: it only runs for a code already known to exist, so it cannot enumerate, and each one
    precedes a plan change the caller is making, which the per-caller cap already bounds. A lookup that would exceed the budget returns
    `discount_rejected: 'busy'` without calling Polar and logs
    `billing.discount.lookup_budget_exhausted`. This is the bound that holds against many
    identities and many addresses at once: the rest of billing keeps its share of the shared token
    whatever the lookups do. The price is not only an attack-time cost. An unmatched code pages
    through the whole catalogue, up to 10 requests, so ordinary typos spend the budget too: in
    production about 10 full misses a minute across all tenants, in the sandbox about 2. Past that,
    an honest coded request gets `busy` until the minute rolls over, with its own copy ("try again
    in a minute"), not the per-caller "try again in an hour". Uncoded plan changes and checkouts
    never touch the budget. The `billing.discount.lookup_budget_exhausted` log is the signal to
    archive old codes or raise the cap.

  KV's eventual consistency makes both caps soft (a burst across colos can exceed them slightly),
  which is acceptable for a guard whose job is to make enumeration slow and visible and to keep
  lookups from draining the shared rate limit. Neither is a hard quota.

- **Product change with an existing discount.** A product change that carries no code first reads
  the subscription (`GET /v1/subscriptions/{id}`, covered by the `subscriptions:read` scope we
  already hold, and `polarSubscriptionSchema` gains the nullable `discount` slice) and, when that
  discount is product-restricted and does not include the new product, sends `{ discount_id: null }`
  in the same product PATCH. So a Solo-only `forever` code can never ride along onto Crew. This read
  is new: today's `changePlan()` makes no Polar `GET`, so every uncoded product change gains one
  request. A seats-only change without a code keeps the product, needs no read, and is today's
  request unchanged. Step 3 checks in the sandbox whether Polar enforces this itself. If it does,
  the read and the `null` are dropped and the no-op is documented and guarded by a test.
- Nothing here touches `src/server/repos`. No row is written beyond what `changePlan()` already
  persists from Polar's answer.

## 📝 Data Model

No D1 change. The discount lives on Polar's subscription and is not mirrored in our store (see
the Resolved assumptions, Q4). `polarDiscountSchema` in `mapping.ts` parses only what `fit()`
reads: `id`, `code`, `starts_at`, `ends_at`, `max_redemptions`, `redemptions_count`, `products[].id`,
and `type`/`basis_points`/`amounts` for logging.

## 📝 API Contracts

`planSelectionInput` (server-function input, BACKWARD_COMPATIBILITY.md §2, additive):

```ts
discountCode: z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9]{3,64}$/, 'Codes are 3 to 64 letters and digits.')
  .optional(),
```

Polar allows up to 256 characters. We cap at 64 because no human types more, and the cap bounds
what we forward to a paged lookup.

`startPlanChange` output (additive union member, BACKWARD_COMPATIBILITY.md §2):

```ts
type PlanChangeResult =
  | BillingRedirect
  | {
      readonly surface: 'discount_rejected'
      readonly reason: 'invalid' | 'not_applicable' | 'rate_limited' | 'busy'
    }
```

The customer sees four reasons only. `invalid` covers unknown, expired, not yet started and
exhausted. Telling those apart would let a stranger learn which production codes exist and which
are still live. The precise reason goes to the log (`billing.discount.rejected`, with
organization id, user id and discount id when one resolved, never the typed code).
`not_applicable` means the discount exists and is live but is restricted to products that do not
include the selected one. So the collapse hides **which dead state** a code is in, not whether a
guessed code is live: `not_applicable` confirms a live, product-restricted code, exactly as a
successful apply confirms a live unrestricted one. It is kept because it tells an honest customer
to pick another plan rather than retype the code, and it leaks nothing a guess that succeeds would
not. What bounds that is the number of guesses (the limiter below), not the reason taxonomy. `rate_limited` is the caller's own hourly cap; `busy` is the global
lookup budget, which says nothing about the caller and clears within a minute.

A Polar `422` is mapped to `discount_rejected: 'invalid'` **inside `changePlan()`**, only when the
code-only PATCH (`{ discount_id }`) is the call that failed, and it is logged as
`billing.discount.rejected` (the attempt already counted in `resolveDiscount()`). Then no product or seat change has happened yet, and the function returns the
union member. It is `invalid` and not `not_applicable` because that PATCH is only sent when `fit()`
has just passed the code against both the current and the selected product (below), so a product
restriction cannot be the cause; what is left is a code that expired or was exhausted since the
lookup (the redemption race in the edge cases), which the taxonomy above calls `invalid`. The
precise Polar detail goes to the log. A `422` on a product PATCH that also carried a discount cannot
be attributed to the code, so it still goes through `customerFacing()` unchanged as today's
readable error. `customerFacing()` itself does not change.

Which PATCH carries the code depends on whether the code also fits the product the subscription is
on now, which `fit()` answers from the discount it already holds:

- **It does, or the product does not change.** The code is sent first as its own
  `{ discount_id }` PATCH, and the product PATCH follows only if that succeeded. This keeps the
  `422` attributable.
- **It does not** (a Crew-only upgrade code while the subscription is on Solo). Attaching it
  alone first could be refused by Polar for the old product, which step 3(c) leaves open, so the
  code rides in the product PATCH, `{ product_id, discount_id, proration_behavior }`, which moves
  to a product the code does fit. A `422` there is today's readable error, as above.

This rule holds whatever step 3 finds, so the order does not wait on the measurement.

A code-only apply returns a new surface, `discount_applied`, whose URL comes from a new helper
`discountAppliedUrl(appUrl)` → `/settings/billing?discount=applied`. `applied` and
`planChangedUrl()` keep their meaning for a changed plan.

Polar calls (DEPLOY.md §9.8 gains three rows):

| Call                           | Body / query                                                                                                               | Scope                 |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `GET /v1/discounts/`           | `limit=100`, `page=n`, at most 10 pages                                                                                    | `discounts:read`      |
| `GET /v1/discounts/{id}`       | — (KV hit path, confirms it still fits)                                                                                    | `discounts:read`      |
| `GET /v1/subscriptions/{id}`   | — (uncoded product change: reads the current discount)                                                                     | `subscriptions:read`  |
| `POST /v1/checkouts/`          | existing body + `discount_id`                                                                                              | `checkouts:write`     |
| `PATCH /v1/subscriptions/{id}` | `{ discount_id }` alone, then `{ product_id, proration_behavior }`; or combined when the code excludes the current product | `subscriptions:write` |

`product_id` and `discount_id` are both members of Polar's `SubscriptionUpdateBase` variant, and
`seats` is its own variant with its own call. The Polar OpenAPI description of
`SubscriptionUpdateBase.discount_id` reads: "Update the subscription to apply a new discount. If set
to `null`, the discount will be removed. The change will be applied on the next billing cycle." So a
code does not reduce the prorated invoice of the change it accompanies. Step 3 confirms this in the
sandbox before any copy promises it, and Q1 asks a human to accept it.

The PATCH order for a change with a code is: `{ discount_id }` → `{ product_id, proration_behavior
}` (when the product changes) → `{ seats, proration_behavior }` (when seats change), except that a
code excluding the current product goes into the product PATCH instead of its own (above). A
seats-only resize with a code therefore still attaches the code.

Script contract (`scripts/billing/seed-sandbox-discounts.mjs`):

- Reads `POLAR_ADMIN_TOKEN` (an operator's own sandbox token with `discounts:read` and
  `discounts:write`) and `POLAR_SERVER` from the shell. It refuses to run unless `POLAR_SERVER` is
  exactly `sandbox`, and it calls only `https://sandbox-api.polar.sh/v1` (through the same
  `resolvePolarOrigin()` rule as the Worker, reimplemented in the script because a `.mjs` script
  cannot import TS source).
- Reads the four sandbox product ids from `--products` or the §10 variables, and targets
  `--count` codes (default 20).
- Each code: `type: percentage`, `basis_points: 10000`, `duration: forever`, `max_redemptions: 1`,
  `products: [the four paid product ids]`, `name: "Staging unlock"`,
  `metadata: { pool: "staging-unlock" }`, and `code: STAGE` followed by 8 random uppercase
  alphanumerics.
- Idempotent: it pages `GET /v1/discounts/` and filters **client-side** for
  `metadata.pool == "staging-unlock"` (the list endpoint has no metadata filter) with
  `redemptions_count < 1`, then creates only the shortfall against `--count`. By default it prints
  **only the codes it just created**, so a code already handed to one tester is never handed to a
  second. `--list-unused` prints the whole unredeemed pool explicitly, for an operator who has lost
  the list. **Codes are never written to the repository.**
- Redeemed pool codes are never deleted by the script, because deleting a discount a subscription
  still carries is not something this spec measures. Every run prints the organization's total
  discount count and warns above 800 (eight of the lookup's ten pages), and §9.12 tells the
  operator to delete redeemed staging codes in the dashboard once their tester's walk is done, so
  the sandbox catalogue does not grow toward the lookup cap.

## 📝 UI/UX

On `/settings/billing`, for a member who `canManage`:

- Above the plan grid, a disclosure button: **Have a promotion code?** Expanded, it shows one
  `Field` + `Input` (label "Promotion code", `autocomplete="off"`, `autocapitalize="characters"`,
  `spellcheck=false`), with the hint "Applied to the plan you choose next." The value is held in
  page state only. It is not a form of its own, and the plan cards' existing buttons submit it.
- When the organization has a live subscription, an **Apply to current plan** button sits beside
  the input. It sends `startPlanChange` with the current plan, interval and seats plus the code.
- Format errors are checked client-side with the same regex and shown inline through `Field`'s
  `error` (`aria-invalid`, `aria-describedby`). The plan buttons stay enabled, and a click with an
  invalid code shows the error and sends nothing.
- A `discount_rejected` result is shown in the same inline error slot, with one message per
  `reason` (`invalid`, `not_applicable`, `rate_limited`, `busy`). Focus moves to the input, and the field expands if it was collapsed. No redirect
  happens and the plan is unchanged.
- Success: a first purchase goes to Polar's checkout with the code already applied. A plan change
  lands on the existing `?plan=changed` alert, whose body gains one sentence when a code was sent:
  "Your promotion code applies from your next renewal." A code-only apply lands on
  `/settings/billing?discount=applied` with a success alert saying the same.
- Hidden for members who cannot manage billing, exactly like the plan buttons.
- WCAG 2.2: the disclosure is a real `<button aria-expanded>`, the input has a visible label,
  the target size is ≥ 24×24 CSS px (2.5.8), and errors are announced through the field's existing
  live error region.

## 📝 Visual change expected

- `/settings/billing` (owner/admin): the new disclosure row above the plan grid in four states:
  collapsed; expanded and empty; expanded with an inline error (format or rejection); pending
  (button spinner, as the plan buttons show today). Light and dark, desktop and 375-px mobile, where
  the input and **Apply** button stack.
- `/settings/billing?plan=changed`: the existing success alert plus the renewal sentence when a
  code was sent.
- `/settings/billing?discount=applied`: a new success alert.
- Members without `canManage`: no visual change.
- Polar's hosted checkout: not ours. It shows the discount line itself.

## 📝 Copy

New keys under `settings.billing.discount.*`. The implementation lands each key in all 23 locales
through the `i18n-messages` skill.

| Key                                                | `en` text                                                |
| -------------------------------------------------- | -------------------------------------------------------- |
| `settings.billing.discount.toggle`                 | Have a promotion code?                                   |
| `settings.billing.discount.label`                  | Promotion code                                           |
| `settings.billing.discount.hint`                   | Applied to the plan you choose next.                     |
| `settings.billing.discount.applyCurrent`           | Apply to current plan                                    |
| `settings.billing.discount.invalidFormat`          | Codes are 3 to 64 letters and digits.                    |
| `settings.billing.discount.rejected.invalid`       | That code isn't valid. Check it and try again.           |
| `settings.billing.discount.rejected.rateLimited`   | Too many codes tried. Try again in an hour.              |
| `settings.billing.discount.rejected.notApplicable` | That code doesn't apply to this plan.                    |
| `settings.billing.discount.rejected.busy`          | Codes can't be checked right now. Try again in a minute. |
| `settings.billing.discount.nextRenewal`            | Your promotion code applies from your next renewal.      |
| `settings.billing.discount.appliedTitle`           | Promotion code applied                                   |

## 📝 Edge Cases & Failure Scenarios

| Case                                                       | Behaviour                                                                                                                                                                                                                                                                                                            |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code-only `{ discount_id }` PATCH answers `422`            | `discount_rejected: invalid`, counted against the per-caller limiter, Polar's detail logged. It is the first write, so no product or seat change happened. The `finally` eviction runs as today.                                                                                                                     |
| Code attached, then the product PATCH fails                | The subscription carries the new discount on the old plan (it applies from the next renewal either way), and today's readable error is shown. The customer can retry the plan change without the code.                                                                                                               |
| Seats-only resize with a code                              | `{ discount_id }` PATCH, then the seats PATCH. Both are covered by a test.                                                                                                                                                                                                                                           |
| Solo-restricted discount in force, move to Crew, no code   | The product PATCH carries `discount_id: null`, so the restricted discount does not follow the customer onto a product it excludes.                                                                                                                                                                                   |
| Two workspaces redeem a `max_redemptions: 1` code at once  | `fit()` passes both. Whether the second PATCH succeeds depends on Polar's own enforcement on PATCH, which step 3 measures. If Polar does not enforce it, the race is accepted and documented in §9.12: the codes are business-issued, and at worst one extra redemption happens.                                     |
| Code valid, seats PATCH fails after product+discount PATCH | Same as today's partial-change path: the first response is persisted, eviction runs, and the error is readable.                                                                                                                                                                                                      |
| Discount lookup `429`                                      | Existing "Polar is rate-limiting us… Nothing was changed" message. Plan untouched.                                                                                                                                                                                                                                   |
| Token lacks `discounts:read` (`403`)                       | `BillingConfigError`. The customer sees the existing "billing is not connected" copy, and the missing scope is named only in the log (`billing.discount.lookup_forbidden`).                                                                                                                                          |
| More than 1,000 discounts in the organization              | Lookup stops after 10 pages → `invalid`, and `billing.discount.lookup_truncated` is logged at error level so the operator knows to archive old codes. A genuine code past the tenth page is then a false negative for a paying customer; the Risks section names it, and §9.12 says how to keep the catalogue small. |
| Same code, second workspace, `max_redemptions: 1`          | `invalid` (logged as `exhausted`), read from `redemptions_count` before any PATCH.                                                                                                                                                                                                                                   |
| Code only, no subscription                                 | There is no "current plan" to apply to, so the **Apply** button is not rendered. The code rides on the next checkout.                                                                                                                                                                                                |
| Code on a `trialing` subscription                          | PATCH as usual. Polar applies it from the first paid cycle, which for a trial is the next billing cycle.                                                                                                                                                                                                             |
| Subscription already has a discount                        | The new `discount_id` replaces it (Polar semantics). The copy says the code applies from the next renewal and no more.                                                                                                                                                                                               |
| Plan change without a code                                 | No `discount_id` key is sent, so an existing discount is kept, with one exception: the product change in the row about a Solo-restricted discount, which reads the subscription first and sends `discount_id: null`. A seats-only change without a code is today's request unchanged.                                |
| Checkout reused from KV within 60 s                        | Only when the discount id matches, because it is part of the idempotency key.                                                                                                                                                                                                                                        |
| Brute-force code guessing                                  | 10 coded attempts, accepted or rejected, per user, per organization and per client IP per hour, then `rate_limited` with no Polar call. Rejections are logged, and customers see only `invalid` or `not_applicable`.                                                                                                 |
| Re-applying one held valid code                            | Each apply counts against the same per-caller cap, so the by-id lookup and PATCH it costs stop after 10 an hour per user, organization and IP.                                                                                                                                                                       |
| Guessing from many fresh accounts and addresses            | The global lookup budget (paged lookups, a fifth of the environment's Polar limit a minute) returns `busy` with no Polar call once spent, and logs `billing.discount.lookup_budget_exhausted`. Honest coded requests are refused too until the minute rolls over. Uncoded billing is unaffected.                     |
| Typos from ordinary customers spend the global budget      | Each unmatched code costs up to 10 paged requests, so a handful of typos in one minute can spend it: honest coded requests then get `busy` ("try again in a minute") until it rolls over. Cached codes and uncoded billing are unaffected.                                                                           |
| Open-ended code (no `ends_at`, no `max_redemptions`)       | `fit()` treats a null bound as no bound, so it fits. Unlimited marketing codes have this shape; the staging pool's codes are single-use (`max_redemptions: 1`), not open-ended.                                                                                                                                      |
| Upgrade code restricted to the target product              | A Crew-only code on a Solo → Crew change fits the selected product but not the current one, so it rides in the combined product PATCH instead of being attached alone first.                                                                                                                                         |
| Same wrong code repeated                                   | Served from the 60 s miss cache, with no Polar call. It still counts against the limiter.                                                                                                                                                                                                                            |
| Script pointed at production                               | Exits non-zero before any request, with the reason.                                                                                                                                                                                                                                                                  |

## 📝 Risks & Impact Review

- **Money path.** This changes what Polar charges. `risk-high`, so a human reviews every phase,
  and §9.11 gains row 9 ("plan change with a 100% code, then renewal is 0.00") walked on the
  sandbox before production.
- **Compatibility** (BACKWARD_COMPATIBILITY.md): §2 changes are additive (an optional input field
  and a new output union member with a single in-repo caller). §5 adds keys in all locales. §7
  adds the `discounts:read` scope to the production and staging Worker tokens, documented in §9.2.
  Without it, only coded requests fail, with a config error. There is no D1 or route change, and
  `?discount=applied` is a new optional search param on an existing route.
- **Rollback.** Phase 1 is a script plus docs. Deleting the codes in the sandbox dashboard
  reverts it. Phases 2–3 revert with the PR. A discount already attached to a subscription stays
  there, and an operator removes it with `PATCH { discount_id: null }` (documented in §9.12).
- **Enumeration.** Every registered user owns an organization, so role is no bound, and accounts
  are free to mint. The per-IP counter, the global lookup budget, the merged `invalid` reason and
  the miss cache together make guessing slow, silent and cheap for us. The merged reason hides
  which dead state a code is in; `not_applicable` still confirms a live product-restricted code,
  as a successful apply confirms a live unrestricted one, so the guess count is the real bound. An attacker rotating both
  accounts and addresses is bounded only by the global budget, so enumeration stays possible at
  that rate; that is stated rather than hidden. Both caps are soft (KV is eventually consistent).
- **Catalogue size.** The lookup reads at most 1,000 discounts. Past that, a genuine code on a
  later page is refused as `invalid`, a false negative for a paying customer that only the
  error-level `billing.discount.lookup_truncated` log reveals. Production codes are created by hand
  and stay far below that; the sandbox grows as testers redeem pool codes, so the script warns at
  800 and the runbook prunes. If step 3 finds that `query` matches on `code`, the lookup narrows
  and the cap stops mattering.
- **Shared Polar rate limit.** Lookups use the token every tenant shares (DEPLOY.md §9.8: 100
  requests/minute in sandbox, 500 in production). The global budget caps paged lookups at a fifth
  of that whatever the number of tenants, so paged lookups never take more than 20% of the limit.
  The by-id confirmation and the PATCH writes of a coded change are not under that global cap: they
  are bounded per caller (10 coded attempts an hour per user, organization and IP), which is the
  same kind of bound, or less, that today's uncoded plan changes have. A caller rotating accounts
  and addresses while holding a valid code is therefore bounded per identity, not globally; that is
  stated rather than hidden. The price of the budget is that coded requests can be refused with
  `busy` while it is spent, which ordinary typos can cause, not only an attack.

### Out of scope

- An in-app admin UI to create or revoke production codes. The Polar dashboard does that.
- Showing the active discount on our billing page, or storing it in D1. The Customer Portal and
  Polar's invoices show it.
- Removing a discount from the app.
- `/register?code=` or any marketing deep link carrying a code.
- Referral, gift and credit schemes.

## 📋 Phasing

- **Phase 1 — Staging pool.** The script, DEPLOY.md §9.12 runbook and §9.2 note. Usable
  immediately through Polar's own checkout field. No Worker change.
- **Phase 2 — Server.** `discounts.ts`, the schema, the input and output contract, checkout and
  PATCH, the idempotency key, DEPLOY.md §9.2 scope and §9.8 rows. Shippable dark: no client sends
  `discountCode` yet.
- **Phase 3 — UI.** The field, the apply button, the copy in 23 locales, the alerts, and §9.11
  row 9.

## 📋 Implementation Plan

**Phase 1 — Staging pool**

1. Add `scripts/billing/seed-sandbox-discounts.mjs` with a `--dry-run` flag. Unit-test the pure
   parts (env guard, shortfall arithmetic, client-side pool filter, code generator alphabet) in
   `scripts/billing/__tests__/seed-sandbox-discounts.test.ts`: production is refused, an empty
   server value is refused, the shortfall equals the target minus the unused pool, and the default
   output lists only newly created codes.
2. Add DEPLOY.md §9.12 "Staging unlock codes": who holds `POLAR_ADMIN_TOKEN`, how to run the
   script, where the printed codes are shared (outside the repository), how to detach a
   discount (`PATCH { discount_id: null }`), and deleting redeemed staging codes once a walk is
   done, prompted by the script's catalogue-size warning above 800. Add a line under §9.2 saying the Worker token never
   gets `discounts:write`.

**Phase 2 — Server**

3. **Gate — sandbox measurements before any Phase 2 code is written**, recorded in DEPLOY.md
   §9.8. (a) Does `GET /v1/discounts/?query=<code>` match on `code`? If so, it becomes the narrowing
   filter and the exact `code` match stays. (b) Does a `{ discount_id }` PATCH take effect only
   from the next cycle, as the schema says? (c) Does Polar refuse a PATCH with an expired, exhausted
   or product-excluded discount (`422`)? (d) Does Polar drop or keep a product-restricted discount
   when `product_id` moves to an excluded product? The answers decide the edge-case rows that name
   step 3. A different answer to (b) reopens Q1.
4. `mapping.ts`: add `polarDiscountSchema` and `polarDiscountListSchema`, with fixture-based tests
   in `mapping.test.ts` (percentage, fixed, product-restricted, null dates).
5. `discounts.ts`: `resolveDiscount(runtime, code, productId)` returning `{ ok, discountId } |
{ ok: false, reason }`, with a pure `fit(discount, productId, now)` and the KV cache. Tests in
   `__tests__/discounts.test.ts` use the existing `harness.ts` fake runtime: each internal reason and
   its collapse to `invalid`, `fit()` with null `starts_at`, `ends_at` and `max_redemptions` (an
   open-ended, unlimited code fits), the case-insensitive match, the 10-page cap, the 60 s miss cache, the
   per-caller limiter (the 11th coded attempt, accepted or rejected, per user, per organization or
   per IP returns `rate_limited` with zero Polar calls; re-applying one valid code counts each
   time; a new user and organization from the same IP do not reset it), the global lookup budget (in the
   sandbox the 21st paged request in a minute is not made and returns `busy`, whoever asks; a
   by-id confirmation is not counted), and `403` → `BillingConfigError`.
6. `checkout.ts`: add `discountCode` to `planSelectionInput`. In `createCheckoutSession`, resolve
   and pass `discount_id` into `buildCheckoutParams` (new optional input) and into
   `checkoutIdempotencyKey`. In `changePlan`, resolve before any PATCH, then PATCH in the order
   `{ discount_id }` → product → seats, or combined product+discount → seats when the code excludes
   the current product, and map a `422` on the code-only PATCH to `invalid` with a
   `billing.discount.rejected` log. On a product change without a code, send `discount_id: null` when the
   subscription's discount excludes the new product. Add `discountAppliedUrl()` and the
   `discount_applied` surface. Extend `checkout.test.ts`: the checkout body carries `discount_id`;
   without a code no `discount_id` key is sent, except the `null` on a product change whose current
   discount excludes the new product; a seats-only change without a code makes no subscription
   read; a rejection makes zero PATCH calls; the
   PATCH order holds for product+code, seats-only+code and product+seats+code; a code restricted
   to the target product goes in one combined product PATCH; a `422` on the code-only PATCH returns
   `invalid`, logs it and makes no product PATCH; a restricted discount is cleared
   on a move to an excluded product; code-only returns `discount_applied`; and the idempotency key
   differs by discount.
7. `-server/billing.ts`: `startPlanChange` returns `PlanChangeResult`. `customerFacing()` is
   unchanged. Update what `scripts/check-server-fn-manifest.mjs` checks if it records shapes.
8. DEPLOY.md: add `discounts:read` to the §9.2 scope table, and the two lookup rows and the
   subscription read to §9.8.

**Phase 3 — UI**

9. Add the copy keys to all 23 locales (the `i18n-messages` skill). The parity test goes green.
10. `billing.tsx`: the disclosure, the input, client-side format validation, `discountCode` on
    `choosePlan`, **Apply to current plan**, `discount_rejected` handling with focus management,
    the `?discount=applied` search param and alert, and the renewal sentence on `?plan=changed`.
    Component tests: the field is hidden without `canManage`, an invalid format sends nothing, each
    of the four rejection reasons shows its message and focuses the input, **Apply** is absent
    with no subscription, and `discount_applied` navigates to `?discount=applied`.
11. Add §9.11 row 9 (sandbox walk: 100% staging code on a plan change, then on a first checkout)
    to the acceptance matrix, and walk it on staging before the phase is called done.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                                                                                                                              | Applied default                                                                                                                                                                                                                                                                                                                                   | Why                                                                                                                                                                                                                                                                                                                                                                         | Confirm?                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- |
| Q1  | A code sent with a plan change: must it discount the prorated invoice of that change, or is "from the next renewal" (Polar's documented `discount_id` behaviour on PATCH) acceptable? | Accept Polar's behaviour: the code applies from the next renewal, and the copy says so. No workaround such as scheduling the change or refunding the difference.                                                                                                                                                                                  | It is the only behaviour Polar offers without us doing price arithmetic, which the Merchant-of-Record rule forbids. It is still a pricing promise to customers.                                                                                                                                                                                                             | ⚠ NEEDS HUMAN CONFIRMATION |
| Q2  | How is a typed code turned into a Polar `discount_id`, given `GET /v1/discounts/` filters by name only?                                                                               | Page the list (100 per page, at most 10 pages) and match `code` case-insensitively, caching hits in KV for 10 minutes. Step 3 checks whether `query` also matches codes and narrows with it if so.                                                                                                                                                | It needs no naming convention that a dashboard user could break silently, and the bounds are explicit and logged.                                                                                                                                                                                                                                                           | ok                         |
| Q3  | Should the brief's two capabilities (staging pool, in-app code entry) be separate specs?                                                                                              | One spec, with the pool as Phase 1: a script plus docs that ships and is usable alone, through Polar's own checkout field, on its own PR as soon as this spec merges.                                                                                                                                                                             | Both use the same Polar discount model and runbook. The review noted that Phase 1 is low-risk ops while Phases 2–3 are a `risk-high` money path, so bundling puts the staging unblock behind the money-path review. A human may prefer to split.                                                                                                                            | ⚠ NEEDS HUMAN CONFIRMATION |
| Q4  | Should the active discount be stored in D1 and shown on our billing page?                                                                                                             | No. Nothing is stored, and the Customer Portal and invoices show it.                                                                                                                                                                                                                                                                              | Least new surface: no migration and no second source of truth for a Polar-owned value.                                                                                                                                                                                                                                                                                      | ok                         |
| Q5  | Should `/register` or marketing links carry a code (`?code=`)?                                                                                                                        | No, deferred. Registration does not choose a plan today, so the first purchase happens on `/settings/billing`, where the new field is.                                                                                                                                                                                                            | It keeps the scope to the ask's two moments (first purchase, plan change) without new public routes.                                                                                                                                                                                                                                                                        | ok                         |
| Q6  | How big is the staging pool, and how is it handed out?                                                                                                                                | 20 single-use codes, topped up by re-running the script. The operator shares them outside the repository.                                                                                                                                                                                                                                         | Single-use caps the damage of a leaked list. Top-up keeps it idempotent.                                                                                                                                                                                                                                                                                                    | ok                         |
| Q7  | Add a rate limiter against code guessing?                                                                                                                                             | Yes: a soft KV limiter (10 coded attempts, accepted or rejected, per user, per organization and per client IP per hour), a global budget of paged lookups at a fifth of the environment's Polar limit per minute (answering `busy`), a 60 s miss cache, and customer reasons collapsed to `invalid` / `not_applicable` / `rate_limited` / `busy`. | Every registered user owns an organization and accounts are free, so neither role nor user and organization ids are a bound. The IP key stops a fresh account per batch; the global budget keeps many accounts on many addresses from draining the shared Polar rate limit, at the price of refusing coded requests while it is spent, which ordinary typos can also cause. | ok                         |
