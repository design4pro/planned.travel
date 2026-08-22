/**
 * Polar product ids for the tests.
 *
 * `src/lib/plans.ts` reads its product ids from `import.meta.env` at module
 * evaluation time, because they are public values inlined into both bundles by
 * Vite. A test run has no `.env`, so without this module every paid plan would
 * look unconfigured and `requirePrice()` would refuse to price anything.
 *
 * The values are UUID-shaped because Polar product ids are UUIDs: a fixture that
 * stubbed an obviously fake string would let a validator that rejects one slip
 * through the suite and fail against the real API.
 *
 * **Import this module before anything that reaches `#/lib/plans`.** ES module
 * evaluation follows declaration order, so a side-effect import placed first is
 * what guarantees the catalogue sees the ids.
 */

import { vi } from 'vitest'

export const TEST_PRICE_IDS = {
  soloMonthly: '3f1d9c02-7a64-4b18-9e5c-8d1a2f0b6c31',
  soloYearly: '5b8e4a17-2c93-4f60-8d7a-1e6b3c920f45',
  crewMonthly: '9a2c7e50-64b1-4d83-a15f-7c0e2b48d963',
  crewYearly: 'c47b1d38-0f56-4a29-b3e8-52d9a610f7be',
} as const

vi.stubEnv('VITE_POLAR_PRODUCT_SOLO_MONTHLY', TEST_PRICE_IDS.soloMonthly)
vi.stubEnv('VITE_POLAR_PRODUCT_SOLO_YEARLY', TEST_PRICE_IDS.soloYearly)
vi.stubEnv('VITE_POLAR_PRODUCT_CREW_MONTHLY', TEST_PRICE_IDS.crewMonthly)
vi.stubEnv('VITE_POLAR_PRODUCT_CREW_YEARLY', TEST_PRICE_IDS.crewYearly)
