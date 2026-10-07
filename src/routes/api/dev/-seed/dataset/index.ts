/**
 * The whole demo dataset, in one place.
 *
 * Order matters for trips: the applier walks `trips` in sequence, and later entities (notifications,
 * journeys, the audit trail) reference earlier trips by slug.
 *
 * That sequence is also the id sequence. Every trip declares its own primary key (see `SeedTrip.id`)
 * and those keys ascend in the order below, so `order by id` — the cursor a paginated list uses —
 * still returns the demo trips newest-first even though nothing about them is time-stamped any more.
 */

import { planById, priceFor } from '#/lib/plans'
import { ceilingsForPlan } from '#/server/billing/limits'
import { flagshipTrip } from './flagship'
import { supportingTrips } from './trips'
import type { BillingInterval, PlanId } from '#/lib/plans'
import type { SubscriptionRecord } from '#/server/billing/types'
import type { SeedTrip } from '../types'

export {
  auditTrail,
  bucketList,
  collections,
  extraCategories,
  journeys,
  notificationPreferences,
  notifications,
  people,
  travelStats,
  vacay,
  visitedCountries,
  visitedRegions,
} from './workspace'

export {
  SEED_ANCHOR_DAY,
  SEED_ANCHOR_INSTANT,
  SEED_ANCHOR_YEAR,
  anchorYearDay,
  day,
  daysFromAnchor,
  historic,
  instantOn,
  minutesBeforeAnchor,
} from './anchor'

export { flagshipTrip } from './flagship'
export { secondWorkspace } from './second-workspace'
export {
  dolomitesTrip,
  lisbonTrip,
  marrakechTrip,
  patagoniaTrip,
  portoTrip,
} from './trips'

/** Every trip the seed writes, flagship first — and in ascending id order. */
export const trips: ReadonlyArray<SeedTrip> = [flagshipTrip, ...supportingTrips]

/**
 * Bumped whenever the dataset changes in a way that should re-seed a workspace that already carries
 * the marker. The applier stores it in `app_settings` under `demo.seed`, alongside the anchor the
 * rows were written against.
 *
 * 3 — two changes reached this version from two branches and both are in effect. Every date became
 * an offset from `SEED_ANCHOR_DAY` and the applier stopped reading the wall clock, so the rows a
 * workspace holds no longer depend on the day it was seeded; and every trip gained a fixed primary
 * key, so a workspace seeded under version 2 still holds generated ones and has to be rebuilt
 * before its cover art matches the recorded screenshots.
 *
 * 4 — a sixth trip, `Porto, one long lunch`, with exactly one mapped place, so the planner's
 * single-place opening camera has a fixture to be asserted against (issue #440). A workspace seeded
 * under version 3 does not hold it.
 *
 * 5 — a second workspace, `Wolak Family Trips`, with the demo owner as its owner and one trip of its
 * own, so the workspace switcher has somewhere to go (issue #640). The first workspace is untouched;
 * a database seeded under version 4 has only that one and does not hold it.
 */
export const DATASET_VERSION = 5

/**
 * Workspace defaults the demo assumes: English, sterling, London, Monday weeks.
 *
 * `locale` is a *language* tag from the twenty-three of `docs/SPEC.md` §8 — the language the
 * workspace's screens are written in — not a regional-format tag. It read `en-GB`, which is not one
 * of the twenty-three, so the seeded workspace disagreed with the column's own contract and the
 * demo exercised a normalisation path no shipped workspace should ever need. The British *formats*
 * this dataset wants live in `defaultCurrency`, `timezone`, `dateFormat` and `weekStartsOn`, all
 * unchanged.
 */
export const organizationSettings = {
  defaultCurrency: 'GBP',
  locale: 'en',
  timezone: 'Europe/London',
  weekStartsOn: 1,
  dateFormat: 'dd MMM yyyy',
  distanceUnit: 'metric',
  mapStyle: 'auto',
} as const

/**
 * The demo workspace is a real **Crew** subscription: ten seats bought, four of them
 * filled, billed monthly. Crew is the plan that sells what this dataset needs —
 * unlimited trips and a shared workspace — so the seed is not fighting a ceiling it
 * pretends not to have.
 *
 * Only the *plan* is declared here. The tier column, the seat and storage ceilings, the
 * currency and the unit amount are all derived by `rowValuesFromRecord()`, exactly as a
 * billing webhook would derive them. Hand-stamping tier-shaped ceilings next to a
 * catalogue price is what made the demo tell `/settings/billing` one story and `/files`
 * another; there is now no way for the seed to write a row that disagrees with itself.
 */
export const subscription = {
  planId: 'crew',
  interval: 'monthly',
  status: 'active',
  seats: 10,
  providerCustomerId: 'demo-customer-planned-travel',
  providerSubscriptionId: 'demo-subscription-planned-travel',
} as const satisfies {
  planId: PlanId
  interval: BillingInterval
  status: SubscriptionRecord['status']
  seats: number
  providerCustomerId: string
  providerSubscriptionId: string
}

/**
 * The provider product id for the demo plan, when this deployment has one configured.
 *
 * Never a made-up id: one the catalogue does not know is worse than none at all,
 * because it is the first thing the resolver consults and it would resolve to nothing.
 * The value comes from the catalogue itself, so it is whatever the deployment's
 * `VITE_POLAR_PRODUCT_*` variables configured. With none configured the tier column and
 * the seat count carry the plan instead, which is the legacy path every pre-catalogue
 * row already takes.
 */
export function demoProviderProductId(): string | null {
  const price = priceFor(planById(subscription.planId), subscription.interval)
  return price === null || price.productId === '' ? null : price.productId
}

/**
 * The demo subscription as the billing domain sees it, ready for
 * `rowValuesFromRecord()` — the one function that knows which columns a plan occupies.
 */
export function demoSubscriptionRecord(
  organizationId: string,
  period: { readonly start: Date; readonly end: Date },
): SubscriptionRecord {
  return {
    organizationId,
    planId: subscription.planId,
    status: subscription.status,
    interval: subscription.interval,
    seats: subscription.seats,
    providerCustomerId: subscription.providerCustomerId,
    providerSubscriptionId: subscription.providerSubscriptionId,
    providerProductId: demoProviderProductId(),
    currentPeriodStart: period.start,
    currentPeriodEnd: period.end,
    cancelAtPeriodEnd: false,
    trialEndsAt: null,
    canceledAt: null,
    ceilings: ceilingsForPlan(subscription.planId, subscription.seats),
  }
}
