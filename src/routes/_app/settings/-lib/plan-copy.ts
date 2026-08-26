/**
 * What the billing screen calls each plan, as catalogue keys.
 *
 * `src/lib/plans.ts` is the single source of truth for what a subscription may
 * *do* — its prices, its seat range, its limits and its module switches — and it
 * ships English `name`, `tagline` and `features` strings alongside them, read by
 * the marketing pages and sent to Polar as a product description. English is
 * right in both of those places: a Polar invoice line is an operator's record.
 *
 * It is not right on a settings screen. `docs/SPEC.md` §8.6 admits no
 * untranslated string onto a screen, and the plan comparison put a plan's name,
 * its tagline and four feature bullets straight into the DOM — so an Arabic
 * shell rendered "For families, friends and small teams" in the middle of its
 * own copy. This maps each plan id to the keys that name it instead, which keeps
 * two properties the alternative loses:
 *
 * - The catalogue's numbers stay in `plans.ts` and its words stay in the message
 *   files. A price, a seat ceiling and a storage quota are facts about the
 *   product; "For families, friends and small teams" is a sentence about it.
 * - A misspelled key is a compile error, because these are `MessageKey`
 *   literals rather than strings assembled from a plan id.
 *
 * Counts are written as words — "Two trips at a time", "Up to ten members" — in
 * the same voice `billing.renewal.free` and `billing.hero.singleTraveller`
 * already use. §8's rule that a number a reader sees goes through the formatter
 * governs a number a *row* supplies, which changes with the data; a plan's
 * published allowance is part of the sentence, and a translator writes it in
 * their own language rather than receiving `2` and a separator they cannot move.
 */

import type { MessageKey } from '#/lib/i18n'
import type { PlanId, QuotaKey } from '#/lib/plans'

export interface PlanCopy {
  readonly name: MessageKey
  readonly tagline: MessageKey
  /**
   * The four bullets a comparison card shows, in order. Four because that is
   * what fits the card at every width without the list becoming the card; the
   * full picture is the pricing page's job.
   */
  readonly features: readonly [MessageKey, MessageKey, MessageKey, MessageKey]
}

export const PLAN_COPY: { readonly [K in PlanId]: PlanCopy } = {
  free: {
    name: 'settings.billing.plan.free.name',
    tagline: 'settings.billing.plan.free.tagline',
    features: [
      'settings.billing.plan.free.feature.trips',
      'settings.billing.plan.free.feature.itinerary',
      'settings.billing.plan.free.feature.lists',
      'settings.billing.plan.free.feature.atlas',
    ],
  },
  solo: {
    name: 'settings.billing.plan.solo.name',
    tagline: 'settings.billing.plan.solo.tagline',
    features: [
      'settings.billing.plan.solo.feature.trips',
      'settings.billing.plan.solo.feature.modules',
      'settings.billing.plan.solo.feature.offline',
      'settings.billing.plan.solo.feature.export',
    ],
  },
  crew: {
    name: 'settings.billing.plan.crew.name',
    tagline: 'settings.billing.plan.crew.tagline',
    features: [
      'settings.billing.plan.crew.feature.members',
      'settings.billing.plan.crew.feature.realtime',
      'settings.billing.plan.crew.feature.everything',
      'settings.billing.plan.crew.feature.storage',
    ],
  },
}

/**
 * Every sentence above that spells out a number `src/lib/plans.ts` owns.
 *
 * Writing a plan's allowance as a word — "Two trips at a time", "Up to ten
 * members" — is what lets a translator put the count in their own language
 * instead of receiving a bare `2` and a separator they cannot move. The price of
 * it is a second copy of a fact: `PLANS.free.limits.trips` is `2` and so is that
 * sentence, and nothing in a type notices when one of them changes.
 *
 * This table is that notice. Each row says which key restates which quota of
 * which plan, and `__tests__/plan-copy.test.ts` spells the *live* limit out of
 * `plans.ts` and requires the shipped English to contain that word — so raising
 * the free trip ceiling to three, or rewriting the sentence to claim three,
 * fails there rather than on a customer's screen. A row is what a copy edit that
 * introduces a new number has to add; a claim whose limit no longer has a word
 * fails loudly rather than passing quietly.
 *
 * Only English is guarded, and deliberately: a translation says "zwei" or "十",
 * which no lookup of ours can check, and §8.9 gives that judgement to the
 * translator. What the guard protects is the source every translation is made
 * from.
 */
export interface PlanAllowanceClaim {
  /** The catalogue key whose sentence states the allowance. */
  readonly key: MessageKey
  readonly plan: PlanId
  /** The quota of that plan the sentence is about. */
  readonly quota: QuotaKey
}

export const PLAN_ALLOWANCE_CLAIMS: ReadonlyArray<PlanAllowanceClaim> = [
  { key: 'settings.billing.plan.free.tagline', plan: 'free', quota: 'trips' },
  {
    key: 'settings.billing.plan.free.feature.trips',
    plan: 'free',
    quota: 'trips',
  },
  { key: 'settings.billing.renewal.free', plan: 'free', quota: 'trips' },
  { key: 'settings.billing.hero.freeAllowance', plan: 'free', quota: 'seats' },
  {
    key: 'settings.billing.plan.solo.feature.trips',
    plan: 'solo',
    quota: 'trips',
  },
  {
    key: 'settings.billing.hero.singleTraveller',
    plan: 'solo',
    quota: 'seats',
  },
  {
    key: 'settings.billing.plan.crew.feature.members',
    plan: 'crew',
    quota: 'seats',
  },
  {
    key: 'settings.billing.plan.crew.feature.everything',
    plan: 'crew',
    quota: 'trips',
  },
]
