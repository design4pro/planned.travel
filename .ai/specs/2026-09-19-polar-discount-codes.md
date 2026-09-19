# Promotion codes on subscribe and plan change, and a free-unlock pool on staging

| Field              | Value |
| ------------------ | ----- |
| **Status**         | draft |
| **Issue**          | #599  |
| **Spec PR**        | none  |
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
       fit(): starts_at ≤ now < ends_at, redemptions_count < max_redemptions,
              products empty or ∋ productId
       → { ok: true, discountId } | { ok: false, reason }
    no subscription → createCheckoutSession(... discount_id)
    subscription    → product changed: PATCH { product_id, discount_id, proration_behavior }
                      product same:    PATCH { discount_id }            (code only, or before seats)
                      then seats PATCH as today (seats variant cannot carry a discount)
```

A rejection is decided **before any Polar write**, and every rejected attempt counts against a
limiter (below).

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
  bounds nothing against guessing. `discounts.ts` counts **rejected** attempts in KV per user and
  per organization (`billing:discount-attempts:u:<userId>` and `…:o:<orgId>`, 10 per rolling hour,
  TTL 3600 s). Past the cap it returns `discount_rejected: 'rate_limited'` without calling Polar.
  KV's eventual consistency makes the cap soft (a burst across colos can exceed it slightly), which
  is acceptable for a guard whose job is to make enumeration slow and visible. It is not a hard
  quota.
- **Product change with an existing discount.** A plan change that carries no code first reads the
  subscription (`GET /v1/subscriptions/{id}`, covered by the `subscriptions:read` scope we already
  hold, and `polarSubscriptionSchema` gains the nullable `discount` slice) and, when that discount is
  product-restricted and does not include the new product, sends `{ discount_id: null }` in the
  same product PATCH. So a Solo-only `forever` code can never ride along onto Crew. Step 4 checks
  in the sandbox whether Polar enforces this itself. If it does, this becomes a documented no-op
  guarded by a test.
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
      readonly reason: 'invalid' | 'not_applicable' | 'rate_limited'
    }
```

The customer sees three reasons only. `invalid` covers unknown, expired, not yet started and
exhausted. Telling those apart would let a stranger learn which production codes exist and which
are still live. The precise reason goes to the log (`billing.discount.rejected`, with
organization id, user id and discount id when one resolved, never the typed code).
`not_applicable` means the discount exists and is live but is restricted to products that do not
include the selected one.

A Polar `422` is mapped to `discount_rejected: 'not_applicable'` **inside `changePlan()`**, only
around the one call that carries `discount_id`, and only when a code-only PATCH (`{ discount_id }`)
is the call that failed. Then no product or seat change has happened yet, and the function returns
the union member. A `422` on a product PATCH that also carried a discount cannot be attributed to
the code, so it still goes through `customerFacing()` unchanged as today's readable error. For that
reason, when the product changes **and** a code was given, the code is sent first as its own
`{ discount_id }` PATCH, and the product PATCH follows only if that succeeded. `customerFacing()`
itself does not change.

A code-only apply returns a new surface, `discount_applied`, whose URL comes from a new helper
`discountAppliedUrl(appUrl)` → `/settings/billing?discount=applied`. `applied` and
`planChangedUrl()` keep their meaning for a changed plan.

Polar calls (DEPLOY.md §9.8 gains two rows):

| Call                           | Body / query                                       | Scope                 |
| ------------------------------ | -------------------------------------------------- | --------------------- |
| `GET /v1/discounts/`           | `limit=100`, `page=n`, at most 10 pages            | `discounts:read`      |
| `GET /v1/discounts/{id}`       | — (KV hit path, confirms it still fits)            | `discounts:read`      |
| `POST /v1/checkouts/`          | existing body + `discount_id`                      | `checkouts:write`     |
| `PATCH /v1/subscriptions/{id}` | `{ product_id?, discount_id, proration_behavior }` | `subscriptions:write` |

`product_id` and `discount_id` are both members of Polar's `SubscriptionUpdateBase` variant, and
`seats` is its own variant with its own call. The Polar OpenAPI description of
`SubscriptionUpdateBase.discount_id` reads: "Update the subscription to apply a new discount. If set
to `null`, the discount will be removed. The change will be applied on the next billing cycle." So a
code does not reduce the prorated invoice of the change it accompanies. Step 4 confirms this in the
sandbox before any copy promises it, and Q1 asks a human to accept it.

The PATCH order for a change with a code is: `{ discount_id }` → `{ product_id, proration_behavior
}` (when the product changes) → `{ seats, proration_behavior }` (when seats change). A seats-only
resize with a code therefore still attaches the code.

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
  `reason` (`invalid`, `not_applicable`, `rate_limited`). Focus moves to the input, and the field expands if it was collapsed. No redirect
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

| Key                                                | `en` text                                           |
| -------------------------------------------------- | --------------------------------------------------- |
| `settings.billing.discount.toggle`                 | Have a promotion code?                              |
| `settings.billing.discount.label`                  | Promotion code                                      |
| `settings.billing.discount.hint`                   | Applied to the plan you choose next.                |
| `settings.billing.discount.applyCurrent`           | Apply to current plan                               |
| `settings.billing.discount.invalidFormat`          | Codes are 3 to 64 letters and digits.               |
| `settings.billing.discount.rejected.invalid`       | That code isn't valid. Check it and try again.      |
| `settings.billing.discount.rejected.rateLimited`   | Too many codes tried. Try again in an hour.         |
| `settings.billing.discount.rejected.notApplicable` | That code doesn't apply to this plan.               |
| `settings.billing.discount.nextRenewal`            | Your promotion code applies from your next renewal. |
| `settings.billing.discount.appliedTitle`           | Promotion code applied                              |

## 📝 Edge Cases & Failure Scenarios

| Case                                                       | Behaviour                                                                                                                                                                                                                                                                        |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Code-only `{ discount_id }` PATCH answers `422`            | `discount_rejected: not_applicable`. It is the first write, so no product or seat change happened. The `finally` eviction runs as today.                                                                                                                                         |
| Code attached, then the product PATCH fails                | The subscription carries the new discount on the old plan (it applies from the next renewal either way), and today's readable error is shown. The customer can retry the plan change without the code.                                                                           |
| Seats-only resize with a code                              | `{ discount_id }` PATCH, then the seats PATCH. Both are covered by a test.                                                                                                                                                                                                       |
| Solo-restricted discount in force, move to Crew, no code   | The product PATCH carries `discount_id: null`, so the restricted discount does not follow the customer onto a product it excludes.                                                                                                                                               |
| Two workspaces redeem a `max_redemptions: 1` code at once  | `fit()` passes both. Whether the second PATCH succeeds depends on Polar's own enforcement on PATCH, which step 4 measures. If Polar does not enforce it, the race is accepted and documented in §9.12: the codes are business-issued, and at worst one extra redemption happens. |
| Code valid, seats PATCH fails after product+discount PATCH | Same as today's partial-change path: the first response is persisted, eviction runs, and the error is readable.                                                                                                                                                                  |
| Discount lookup `429`                                      | Existing "Polar is rate-limiting us… Nothing was changed" message. Plan untouched.                                                                                                                                                                                               |
| Token lacks `discounts:read` (`403`)                       | `BillingConfigError`. The customer sees the existing "billing is not connected" copy, and the missing scope is named only in the log (`billing.discount.lookup_forbidden`).                                                                                                      |
| More than 1,000 discounts in the organization              | Lookup stops after 10 pages → `invalid`, and `billing.discount.lookup_truncated` is logged so the operator knows to archive old codes.                                                                                                                                           |
| Same code, second workspace, `max_redemptions: 1`          | `invalid` (logged as `exhausted`), read from `redemptions_count` before any PATCH.                                                                                                                                                                                               |
| Code only, no subscription                                 | There is no "current plan" to apply to, so the **Apply** button is not rendered. The code rides on the next checkout.                                                                                                                                                            |
| Code on a `trialing` subscription                          | PATCH as usual. Polar applies it from the first paid cycle, which for a trial is the next billing cycle.                                                                                                                                                                         |
| Subscription already has a discount                        | The new `discount_id` replaces it (Polar semantics). The copy says the code applies from the next renewal and no more.                                                                                                                                                           |
| Plan change without a code                                 | Byte-for-byte today's request: no `discount_id` key is sent, so an existing discount is kept.                                                                                                                                                                                    |
| Checkout reused from KV within 60 s                        | Only when the discount id matches, because it is part of the idempotency key.                                                                                                                                                                                                    |
| Brute-force code guessing                                  | 10 rejected attempts per user and per organization per hour, then `rate_limited` with no Polar call. Rejections are logged, and customers see only `invalid`.                                                                                                                    |
| Same wrong code repeated                                   | Served from the 60 s miss cache, with no Polar call. It still counts against the limiter.                                                                                                                                                                                        |
| Script pointed at production                               | Exits non-zero before any request, with the reason.                                                                                                                                                                                                                              |

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
- **Enumeration.** Every registered user owns an organization, so role is no bound. The KV
  limiter, the merged `invalid` reason and the miss cache together make guessing slow, silent and
  cheap for us. The limiter is soft (KV is eventually consistent), and that is stated rather than
  hidden.
- **Shared Polar rate limit.** Lookups use the token every tenant shares (DEPLOY.md §9.8: 100
  requests/minute in sandbox). The miss cache, the limiter and the 10-page cap bound what one tenant
  can spend on it.

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
   script, where the printed codes are shared (outside the repository), and how to detach a
   discount (`PATCH { discount_id: null }`). Add a line under §9.2 saying the Worker token never
   gets `discounts:write`.

**Phase 2 — Server**

3. `mapping.ts`: add `polarDiscountSchema` and `polarDiscountListSchema`, with fixture-based tests
   in `mapping.test.ts` (percentage, fixed, product-restricted, null dates).
4. **Gate — sandbox measurements before any Phase 2 code is written**, recorded in DEPLOY.md
   §9.8. (a) Does `GET /v1/discounts/?query=<code>` match on `code`? If so, it becomes the narrowing
   filter and the exact `code` match stays. (b) Does a `{ discount_id }` PATCH take effect only
   from the next cycle, as the schema says? (c) Does Polar refuse a PATCH with an expired, exhausted
   or product-excluded discount (`422`)? (d) Does Polar drop or keep a product-restricted discount
   when `product_id` moves to an excluded product? The answers decide the edge-case rows marked
   "step 4". A different answer to (b) reopens Q1.
5. `discounts.ts`: `resolveDiscount(runtime, code, productId)` returning `{ ok, discountId } |
{ ok: false, reason }`, with a pure `fit(discount, productId, now)` and the KV cache. Tests in
   `__tests__/discounts.test.ts` use the existing `harness.ts` fake runtime: each internal reason and
   its collapse to `invalid`, the case-insensitive match, the 10-page cap, the 60 s miss cache, the
   limiter (the 11th rejection returns `rate_limited` with zero Polar calls), and `403` →
   `BillingConfigError`.
6. `checkout.ts`: add `discountCode` to `planSelectionInput`. In `createCheckoutSession`, resolve
   and pass `discount_id` into `buildCheckoutParams` (new optional input) and into
   `checkoutIdempotencyKey`. In `changePlan`, resolve before any PATCH, then PATCH in the order
   `{ discount_id }` → product → seats, and map a `422` on the discount PATCH to
   `not_applicable`. On a product change without a code, send `discount_id: null` when the
   subscription's discount excludes the new product. Add `discountAppliedUrl()` and the
   `discount_applied` surface. Extend `checkout.test.ts`: the checkout body carries `discount_id`;
   without a code no `discount_id` key is sent anywhere; a rejection makes zero PATCH calls; the
   PATCH order holds for product+code, seats-only+code and product+seats+code; a `422` on the
   discount PATCH returns `not_applicable` with no product PATCH; a restricted discount is cleared
   on a move to an excluded product; code-only returns `discount_applied`; and the idempotency key
   differs by discount.
7. `-server/billing.ts`: `startPlanChange` returns `PlanChangeResult`. `customerFacing()` is
   unchanged. Update what `scripts/check-server-fn-manifest.mjs` checks if it records shapes.
8. DEPLOY.md: add `discounts:read` to the §9.2 scope table and the two lookup rows to §9.8.

**Phase 3 — UI**

9. Add the copy keys to all 23 locales (the `i18n-messages` skill). The parity test goes green.
10. `billing.tsx`: the disclosure, the input, client-side format validation, `discountCode` on
    `choosePlan`, **Apply to current plan**, `discount_rejected` handling with focus management,
    the `?discount=applied` search param and alert, and the renewal sentence on `?plan=changed`.
    Component tests: the field is hidden without `canManage`, an invalid format sends nothing, each
    of the three rejection reasons shows its message and focuses the input, **Apply** is absent
    with no subscription, and `discount_applied` navigates to `?discount=applied`.
11. Add §9.11 row 9 (sandbox walk: 100% staging code on a plan change, then on a first checkout)
    to the acceptance matrix, and walk it on staging before the phase is called done.

## Resolved assumptions (autonomous defaults)

| #   | Question                                                                                                                                                                              | Applied default                                                                                                                                                                                    | Why                                                                                                                                                                                                                                              | Confirm?                   |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| Q1  | A code sent with a plan change: must it discount the prorated invoice of that change, or is "from the next renewal" (Polar's documented `discount_id` behaviour on PATCH) acceptable? | Accept Polar's behaviour: the code applies from the next renewal, and the copy says so. No workaround such as scheduling the change or refunding the difference.                                   | It is the only behaviour Polar offers without us doing price arithmetic, which the Merchant-of-Record rule forbids. It is still a pricing promise to customers.                                                                                  | ⚠ NEEDS HUMAN CONFIRMATION |
| Q2  | How is a typed code turned into a Polar `discount_id`, given `GET /v1/discounts/` filters by name only?                                                                               | Page the list (100 per page, at most 10 pages) and match `code` case-insensitively, caching hits in KV for 10 minutes. Step 4 checks whether `query` also matches codes and narrows with it if so. | It needs no naming convention that a dashboard user could break silently, and the bounds are explicit and logged.                                                                                                                                | ok                         |
| Q3  | Should the brief's two capabilities (staging pool, in-app code entry) be separate specs?                                                                                              | One spec, with the pool as Phase 1: a script plus docs that ships and is usable alone, through Polar's own checkout field, on its own PR as soon as this spec merges.                              | Both use the same Polar discount model and runbook. The review noted that Phase 1 is low-risk ops while Phases 2–3 are a `risk-high` money path, so bundling puts the staging unblock behind the money-path review. A human may prefer to split. | ⚠ NEEDS HUMAN CONFIRMATION |
| Q4  | Should the active discount be stored in D1 and shown on our billing page?                                                                                                             | No. Nothing is stored, and the Customer Portal and invoices show it.                                                                                                                               | Least new surface: no migration and no second source of truth for a Polar-owned value.                                                                                                                                                           | ok                         |
| Q5  | Should `/register` or marketing links carry a code (`?code=`)?                                                                                                                        | No, deferred. Registration does not choose a plan today, so the first purchase happens on `/settings/billing`, where the new field is.                                                             | It keeps the scope to the ask's two moments (first purchase, plan change) without new public routes.                                                                                                                                             | ok                         |
| Q6  | How big is the staging pool, and how is it handed out?                                                                                                                                | 20 single-use codes, topped up by re-running the script. The operator shares them outside the repository.                                                                                          | Single-use caps the damage of a leaked list. Top-up keeps it idempotent.                                                                                                                                                                         | ok                         |
| Q7  | Add a rate limiter against code guessing?                                                                                                                                             | Yes: a soft KV limiter (10 rejected attempts per user and per organization per hour), a 60 s miss cache, and customer reasons collapsed to `invalid` / `not_applicable` / `rate_limited`.          | Every registered user owns an organization, so role is no bound. Without this, one tenant could enumerate live production codes and drain the shared Polar rate limit.                                                                           | ok                         |
