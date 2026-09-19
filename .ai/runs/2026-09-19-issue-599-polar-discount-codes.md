# Execution plan — promotion codes on subscribe and plan change, and a staging unlock pool

Issue: #599
Source doc: .ai/specs/2026-09-19-polar-discount-codes.md
Spec PR: #600 (merged, design-only)
Branch: feat/issue-599-polar-discount-codes

## Goal

A workspace owner or admin can type a Polar promotion code on `/settings/billing`; the server resolves
it to a Polar discount, checks it against the plan being bought and attaches it to the checkout (first
purchase) or the subscription (plan change, or the current plan). A refused code is a translated,
specific error and the plan is unchanged. An operator script seeds single-use 100%-off codes in the
**sandbox** organization only.

## Scope

- `scripts/billing/seed-sandbox-discounts.mjs` (new) and its test.
- `src/server/billing/mapping.ts` — `polarDiscountSchema`, `polarDiscountListSchema`, the nullable
  `discount` slice on `polarSubscriptionSchema`.
- `src/server/billing/discounts.ts` (new) — `resolveDiscount()`, `fit()`, KV cache, limiter, budget.
- `src/server/billing/checkout.ts` — `discountCode` input, checkout body, idempotency key, PATCH order,
  `discount_applied` / `discount_rejected` outcomes.
- `src/server/billing/types.ts`, `runtime.cloudflare.ts` — the lookup budget and the caller IP.
- `src/routes/_app/-server/billing.ts` — `startPlanChange` returns `PlanChangeResult`.
- `src/routes/_app/settings/billing.tsx` — the disclosure, the field, the apply button, the alerts.
- Copy in all 23 locales.
- `docs/DEPLOY.md` §9.2, §9.8, §9.11 row 9, new §9.12.

## Decisions

1. All three phases ship on this one PR: Q3 was confirmed by a human on #599 as "one spec/ticket,
   shipped together under this issue".
2. Step 3 (the sandbox measurement gate) cannot be run by this autonomous run: it has no permission to
   drive the Polar sandbox. The spec's design holds whatever (a), (c) and (d) answer — it keeps the
   paged lookup without `query`, keeps the subscription read and the `discount_id: null`, and keeps the
   `{ discount_id }`-first PATCH order. (b) is Polar's own documented behaviour and Q1 was confirmed
   against it. The measurements are recorded in DEPLOY.md §9.8 as an operator walk owed before the
   production rollout, and listed in the PR's Resolved assumptions.
3. Step 11's staging walk is likewise owed by a human; the §9.11 row lands unwalked.
4. The review pass (`om-auto-review-pr`) flagged the skipped step-3 gate as a major that needs a human
   waiver. The applied default, pending that confirmation: the PR may merge to `develop`, and the
   promotion-code field does not reach production until DEPLOY.md §9.8 (a)–(d) and §9.11 row 9 are
   walked and recorded. Its other findings were fixed in 77e851b02, 679a5f48a and f4e165aa8.

## Non-goals

- Storing or showing the active discount (Q4), `/register?code=` (Q5), an admin UI, referral schemes.

## Implementation Plan

### Phase 1: Staging pool

- 1.1 Seed script with `--dry-run`, and its unit tests.
- 1.2 DEPLOY.md §9.12 runbook and the §9.2 note.

### Phase 2: Server

- 2.1 Step 3 gate recorded as an owed sandbox walk in DEPLOY.md §9.8.
- 2.2 Discount wire schemas and their tests.
- 2.3 `discounts.ts` with `fit()`, cache, limiter, budget, and tests.
- 2.4 `checkout.ts` — input, checkout, PATCH order, outcomes, and tests.
- 2.5 `startPlanChange` returns `PlanChangeResult`.
- 2.6 DEPLOY.md §9.2 scope and §9.8 rows.

### Phase 3: UI

- 3.1 Copy keys in all 23 locales.
- 3.2 `billing.tsx` field, apply button, rejection handling, alerts, and component tests.
- 3.3 §9.11 row 9.

## Risks

- Money path (`risk-high`): a human reviews the PR; the §9.8 measurements and the §9.11 walk are owed
  before production.
- The Worker token needs `discounts:read`; without it only coded requests fail, as a config error.

## Progress

PR: #617

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Staging pool

- [x] 1.1 Seed script with `--dry-run`, and its unit tests — c9b896d61
- [x] 1.2 DEPLOY.md §9.12 runbook and the §9.2 note — a0842e6f9

### Phase 2: Server

- [x] 2.1 Step 3 gate recorded as an owed sandbox walk in DEPLOY.md §9.8 — 93f86401d
- [x] 2.2 Discount wire schemas and their tests — 5dd62bd7a
- [x] 2.3 `discounts.ts` with `fit()`, cache, limiter, budget, and tests — 283db7cfb
- [x] 2.4 `checkout.ts` — input, checkout, PATCH order, outcomes, and tests — 1b89068ec
- [x] 2.5 `startPlanChange` returns `PlanChangeResult` — 1b89068ec
- [x] 2.6 DEPLOY.md §9.2 scope and §9.8 rows — 93f86401d

### Phase 3: UI

- [x] 3.1 Copy keys in all 23 locales — 390da6a59
- [x] 3.2 `billing.tsx` field, apply button, rejection handling, alerts, and component tests — 179e514e7
- [x] 3.3 §9.11 row 9 — 4cda8b0b3 (row landed unwalked; the staging walk is owed by a human, Decision 3)
