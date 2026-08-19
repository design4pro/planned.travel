/**
 * Stripe price ids for the tests.
 *
 * `src/lib/plans.ts` reads its price ids from `import.meta.env` at module
 * evaluation time, because they are public values inlined into both bundles by
 * Vite. A test run has no `.env`, so without this module every paid plan would
 * look unconfigured and `requirePrice()` would refuse to price anything.
 *
 * **Import this module before anything that reaches `#/lib/plans`.** ES module
 * evaluation follows declaration order, so a side-effect import placed first is
 * what guarantees the catalogue sees the ids.
 */

import { vi } from 'vitest'

export const TEST_PRICE_IDS = {
  soloMonthly: 'price_test_solo_monthly',
  soloYearly: 'price_test_solo_yearly',
  crewMonthly: 'price_test_crew_monthly',
  crewYearly: 'price_test_crew_yearly',
} as const

vi.stubEnv('VITE_STRIPE_PRICE_SOLO_MONTHLY', TEST_PRICE_IDS.soloMonthly)
vi.stubEnv('VITE_STRIPE_PRICE_SOLO_YEARLY', TEST_PRICE_IDS.soloYearly)
vi.stubEnv('VITE_STRIPE_PRICE_CREW_MONTHLY', TEST_PRICE_IDS.crewMonthly)
vi.stubEnv('VITE_STRIPE_PRICE_CREW_YEARLY', TEST_PRICE_IDS.crewYearly)
