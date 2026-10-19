/**
 * Turning a typed promotion code into a Polar discount we may attach, or a reason we may not.
 *
 * Spec: `.ai/specs/2026-09-19-polar-discount-codes.md`. Four rules shape the file:
 *
 * 1. **Polar owns the discount; we only decide whether to send its id.** Polar is Merchant of
 *    Record, so there is no price arithmetic here — `fit()` checks the bounds Polar publishes on
 *    the discount (start, end, redemptions, products) so a refusal can be named before any write.
 * 2. **A code is found by paging.** `GET /v1/discounts/` filters by name, not by code, so the
 *    lookup pages the catalogue (100 a page, at most ten pages) and matches `code`
 *    case-insensitively. A hit is cached for ten minutes, a miss for one.
 * 3. **Guessing is slow, silent and cheap for us.** Every registered user owns an organization and
 *    accounts are free, so the role check bounds nothing. Every coded attempt, accepted or not, is
 *    counted per user, per organization and per client address; paged lookups share one global
 *    per-minute budget, so no number of identities can drain the Polar rate limit the rest of
 *    billing runs on. Both caps are soft — KV is eventually consistent — which is enough for a
 *    guard whose job is to make enumeration slow and visible.
 * 4. **The customer sees four reasons, the log sees the precise one.** Unknown, expired, not yet
 *    started and exhausted all read as `invalid`, so a stranger cannot learn which codes exist and
 *    which are still live. The typed code itself is never logged.
 */

import { polarDiscountListSchema, polarDiscountSchema } from './mapping'
import { PolarApiError } from './polar'
import { BillingConfigError } from './types'

import type { PolarDiscount } from './mapping'
import type { BillingIdentity, BillingRuntime } from './types'

export const DISCOUNTS_PATH = '/v1/discounts/'

export const DISCOUNT_PAGE_SIZE = 100
/** Ten pages of a hundred. A code past the thousandth discount is refused and logged. */
export const DISCOUNT_MAX_PAGES = 10

export const DISCOUNT_HIT_TTL_SECONDS = 600
/** Short, so a code created in the dashboard is redeemable within a minute. */
export const DISCOUNT_MISS_TTL_SECONDS = 60

/** Coded attempts, accepted or rejected, per user, per organization and per address. */
export const DISCOUNT_ATTEMPTS_PER_HOUR = 10
const ATTEMPT_WINDOW_SECONDS = 3600
const LOOKUP_BUDGET_TTL_SECONDS = 120

/**
 * A fifth of the environment's Polar limit (DEPLOY.md §9.2: 500 a minute in production, 100 in
 * the sandbox). An unrecognised server gets the tighter figure; `createPolarClient()` refuses one
 * anyway, so it can only matter to a lookup that would fail regardless.
 */
export function discountLookupBudgetFor(server: string | undefined): number {
  return server === 'production' ? 100 : 20
}

/** What the customer is told. */
export type DiscountRejectionReason =
  'invalid' | 'not_applicable' | 'rate_limited' | 'busy'

/** What the log is told: the customer's four, with `invalid` split into its causes. */
export type DiscountFitFailure =
  'not_started' | 'expired' | 'exhausted' | 'not_applicable'

type PreciseReason =
  DiscountFitFailure | 'unknown' | 'truncated' | 'rate_limited' | 'busy'

export type DiscountResolution =
  | { readonly ok: true; readonly discount: PolarDiscount }
  | { readonly ok: false; readonly reason: DiscountRejectionReason }

/** A code as every key and comparison sees it. */
export function normalizeDiscountCode(code: string): string {
  return code.trim().toUpperCase()
}

/** True when the discount is not restricted, or its restriction names the product. */
export function appliesToProduct(
  discount: Pick<PolarDiscount, 'products'>,
  productId: string,
): boolean {
  return (
    discount.products.length === 0 ||
    discount.products.some((product) => product.id === productId)
  )
}

/**
 * Whether a discount may be attached for this product right now, or the precise reason not.
 *
 * A `null` bound is no bound: an open-ended marketing code has no `ends_at` and no
 * `max_redemptions`, and it fits.
 */
export function fit(
  discount: PolarDiscount,
  productId: string,
  now: Date,
): DiscountFitFailure | null {
  const at = now.getTime()
  if (discount.starts_at != null && Date.parse(discount.starts_at) > at) {
    return 'not_started'
  }
  if (discount.ends_at != null && at >= Date.parse(discount.ends_at)) {
    return 'expired'
  }
  if (
    discount.max_redemptions != null &&
    discount.redemptions_count >= discount.max_redemptions
  ) {
    return 'exhausted'
  }
  if (!appliesToProduct(discount, productId)) return 'not_applicable'
  return null
}

/** The customer-facing collapse: only a product restriction keeps its own name. */
export function customerReason(reason: PreciseReason): DiscountRejectionReason {
  if (reason === 'not_applicable') return 'not_applicable'
  if (reason === 'rate_limited') return 'rate_limited'
  if (reason === 'busy') return 'busy'
  return 'invalid'
}

/* --------------------------------------------------------------------- keys */

export function discountHitKey(code: string): string {
  return `billing:discount:${code}`
}

export function discountMissKey(code: string): string {
  return `billing:discount-miss:${code}`
}

/** The per-user attempt counter; an erasure purges it by this name. */
export function discountAttemptsUserKey(userId: string): string {
  return `billing:discount-attempts:u:${userId}`
}

function attemptKeys(identity: BillingIdentity): ReadonlyArray<string> {
  const keys = [
    discountAttemptsUserKey(identity.userId),
    `billing:discount-attempts:o:${identity.organizationId}`,
  ]
  const ip = identity.clientIp ?? null
  if (ip !== null && ip !== '') keys.push(`billing:discount-attempts:ip:${ip}`)
  return keys
}

export function lookupBudgetKey(now: Date): string {
  return `billing:discount-lookups:${Math.floor(now.getTime() / 60_000)}`
}

/* ------------------------------------------------------------------ counters */

async function readCount(
  runtime: BillingRuntime,
  key: string,
): Promise<number> {
  const raw = await runtime.cache.get(key)
  const count = raw === null ? 0 : Number.parseInt(raw, 10)
  return Number.isFinite(count) ? count : 0
}

/**
 * Count one coded attempt against every key it belongs to, or refuse it when any is spent.
 * A refused attempt is not counted again: the cap is already reached. Each counted attempt
 * re-arms the key's TTL, so the window is an hour after the last counted attempt rather than a
 * rolling hour — stricter than the spec's wording, never looser.
 */
async function takeAttempt(
  runtime: BillingRuntime,
  identity: BillingIdentity,
): Promise<boolean> {
  const keys = attemptKeys(identity)
  const counts = await Promise.all(keys.map((key) => readCount(runtime, key)))
  if (counts.some((count) => count >= DISCOUNT_ATTEMPTS_PER_HOUR)) return false

  await Promise.all(
    keys.map((key, index) =>
      runtime.cache.put(key, String((counts[index] ?? 0) + 1), {
        expirationTtl: ATTEMPT_WINDOW_SECONDS,
      }),
    ),
  )
  return true
}

/** Spend one paged lookup from this minute's global budget, or report it spent. */
async function takeLookup(runtime: BillingRuntime): Promise<boolean> {
  const key = lookupBudgetKey(runtime.now())
  const used = await readCount(runtime, key)
  if (used >= runtime.discountLookupBudget) return false
  await runtime.cache.put(key, String(used + 1), {
    expirationTtl: LOOKUP_BUDGET_TTL_SECONDS,
  })
  return true
}

/* -------------------------------------------------------------------- lookup */

class LookupBudgetSpent extends Error {
  override readonly name = 'LookupBudgetSpent'
}

class LookupTruncated extends Error {
  override readonly name = 'LookupTruncated'
}

/**
 * Every Polar call here goes through this: a `403` is a token without `discounts:read`, which is
 * a deployment problem and not a customer's, so it becomes `BillingConfigError` and the log names
 * the missing scope. Everything else — a `429` included — propagates unchanged to the caller's
 * existing readable error.
 */
async function discountRequest(
  runtime: BillingRuntime,
  identity: BillingIdentity,
  run: () => Promise<unknown>,
): Promise<unknown> {
  try {
    return await run()
  } catch (cause) {
    if (cause instanceof PolarApiError && cause.status === 403) {
      runtime.logger.error('billing.discount.lookup_forbidden', {
        organizationId: identity.organizationId,
        missingScope: 'discounts:read',
      })
      throw new BillingConfigError(
        'POLAR_ACCESS_TOKEN lacks the discounts:read scope (DEPLOY.md §9.2).',
      )
    }
    throw cause
  }
}

/** The discount a cached id names, or `null` when it is gone or no longer carries the code. */
async function readCachedDiscount(
  runtime: BillingRuntime,
  identity: BillingIdentity,
  code: string,
  discountId: string,
): Promise<PolarDiscount | null> {
  try {
    const discount = polarDiscountSchema.parse(
      await discountRequest(runtime, identity, () =>
        runtime.polar.request({
          method: 'GET',
          path: `${DISCOUNTS_PATH}${discountId}`,
        }),
      ),
    )
    return normalizeDiscountCode(discount.code ?? '') === code ? discount : null
  } catch (cause) {
    if (cause instanceof PolarApiError && cause.status === 404) return null
    throw cause
  }
}

/** Page the catalogue for the code, within the global budget and the ten-page cap. */
async function pageForDiscount(
  runtime: BillingRuntime,
  identity: BillingIdentity,
  code: string,
): Promise<PolarDiscount | null> {
  for (let page = 1; page <= DISCOUNT_MAX_PAGES; page += 1) {
    if (!(await takeLookup(runtime))) throw new LookupBudgetSpent()

    const answer = polarDiscountListSchema.parse(
      await discountRequest(runtime, identity, () =>
        runtime.polar.request({
          method: 'GET',
          path: DISCOUNTS_PATH,
          query: { limit: DISCOUNT_PAGE_SIZE, page },
        }),
      ),
    )

    const match = answer.items.find(
      (discount) => normalizeDiscountCode(discount.code ?? '') === code,
    )
    if (match !== undefined) return match
    if (page >= answer.pagination.max_page || answer.items.length === 0) {
      return null
    }
  }
  throw new LookupTruncated()
}

/** Find the discount behind a code: the ten-minute hit cache first, then the paged catalogue. */
async function findDiscount(
  runtime: BillingRuntime,
  identity: BillingIdentity,
  code: string,
): Promise<PolarDiscount | null> {
  const cachedId = await runtime.cache.get(discountHitKey(code))
  if (cachedId !== null) {
    const cached = await readCachedDiscount(runtime, identity, code, cachedId)
    if (cached !== null) return cached
    await runtime.cache.delete(discountHitKey(code))
  }

  if ((await runtime.cache.get(discountMissKey(code))) !== null) return null

  const found = await pageForDiscount(runtime, identity, code)
  if (found === null) {
    await runtime.cache.put(discountMissKey(code), '1', {
      expirationTtl: DISCOUNT_MISS_TTL_SECONDS,
    })
    return null
  }

  await runtime.cache.put(discountHitKey(code), found.id, {
    expirationTtl: DISCOUNT_HIT_TTL_SECONDS,
  })
  return found
}

/**
 * Log a refused code with its precise reason, and never the code itself. Also used by
 * `changePlan()` for a `422` on the code-only PATCH, whose attempt is already counted here.
 */
export function logDiscountRejection(
  runtime: BillingRuntime,
  identity: BillingIdentity,
  reason: string,
  discountId: string | null,
  providerDetail?: string,
): void {
  runtime.logger.warn('billing.discount.rejected', {
    organizationId: identity.organizationId,
    userId: identity.userId,
    discountId,
    reason,
    providerDetail,
  })
}

/**
 * Resolve a typed code for the product being bought.
 *
 * Every call is one coded attempt and is counted before Polar is asked anything, so the eleventh
 * attempt in an hour — accepted or rejected — makes no Polar call at all.
 */
export async function resolveDiscount(
  runtime: BillingRuntime,
  identity: BillingIdentity,
  typedCode: string,
  productId: string,
): Promise<DiscountResolution> {
  const code = normalizeDiscountCode(typedCode)
  const reject = (
    reason: PreciseReason,
    discountId: string | null = null,
  ): DiscountResolution => {
    logDiscountRejection(runtime, identity, reason, discountId)
    return { ok: false, reason: customerReason(reason) }
  }

  if (!(await takeAttempt(runtime, identity))) return reject('rate_limited')

  let discount: PolarDiscount | null
  try {
    discount = await findDiscount(runtime, identity, code)
  } catch (cause) {
    if (cause instanceof LookupBudgetSpent) {
      runtime.logger.warn('billing.discount.lookup_budget_exhausted', {
        organizationId: identity.organizationId,
        budget: runtime.discountLookupBudget,
      })
      return reject('busy')
    }
    if (cause instanceof LookupTruncated) {
      runtime.logger.error('billing.discount.lookup_truncated', {
        organizationId: identity.organizationId,
        pages: DISCOUNT_MAX_PAGES,
      })
      return reject('truncated')
    }
    throw cause
  }

  if (discount === null) return reject('unknown')

  const failure = fit(discount, productId, runtime.now())
  if (failure !== null) return reject(failure, discount.id)

  return { ok: true, discount }
}
