/**
 * What the billing screen calls each plan, as catalogue keys.
 *
 * `src/lib/plans.ts` is the single source of truth for what a subscription may
 * *do* — its prices, its seat range, its limits and its module switches — and it
 * ships English `name`, `tagline` and `features` strings alongside them, read by
 * the marketing pages and sent to Stripe as a product description. English is
 * right in both of those places: a Stripe invoice line is an operator's record.
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
import type { PlanId } from '#/lib/plans'

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
