/**
 * The plan-usage figure and the stranded trip (#810).
 *
 * `createUsageReader` is what the billing page and the entitlement maths read the trips figure
 * from, so it has to be worked out the way `createTrip` enforces the quota: through
 * `countTripsAgainstPlan`. The trip rule itself is measured in
 * `src/server/repos/__tests__/trip-quota.test.ts`; this file pins that the reader calls it and so
 * cannot drift back to the bare tenant count.
 *
 * `runtime.cloudflare.ts` reaches Worker bindings through `cloudflare:workers`, which does not
 * resolve in this project's Node environment, and the two metering modules read them too. Nothing
 * here is under test but the usage reader, which uses none of them.
 */

import { and, eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { member } from '#/server/db/auth-schema'
import { createTrip } from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import { createUsageReader } from '../runtime.cloudflare'

vi.mock('cloudflare:workers', () => ({ env: {} }))
vi.mock('#/server/db/client', () => ({ getDb: () => undefined }))
vi.mock('#/server/metering/bindings', () => ({
  requestOutboundRuntime: () => undefined,
}))
vi.mock('#/server/metering/outbound', () => ({ callProvider: () => undefined }))

describe('the plan-usage figure for trips', () => {
  let harness: Harness
  let alpha: SeededTenant

  beforeEach(async () => {
    harness = await createHarness()
    alpha = await harness.seedTenant('alpha')
  })

  afterEach(() => {
    harness.close()
  })

  it('leaves out a trip whose only member has left the workspace', async () => {
    const leaverId = await alpha.addUser('Leaver')
    await createTrip(alpha.scope, { title: 'Owner trip' })
    await createTrip(alpha.scopeFor(leaverId), { title: 'Leaver trip' })
    const reader = createUsageReader(alpha.scope)

    expect((await reader.read(alpha.organizationId)).trips).toBe(2)

    await harness.db
      .delete(member)
      .where(
        and(
          eq(member.organizationId, alpha.organizationId),
          eq(member.userId, leaverId),
        ),
      )

    expect((await reader.read(alpha.organizationId)).trips).toBe(1)
  })
})
