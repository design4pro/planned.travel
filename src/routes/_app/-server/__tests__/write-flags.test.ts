import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { addTripMember, archiveTrip, createTrip } from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'

import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { TenantScope } from '#/server/repos'
import type * as ReactStart from '@tanstack/react-start'

/**
 * What the lists and files screens learn about the reader's write permission (#1091): the loader
 * answers it from the trip role and the archived state with `canWritePlan`, the one answer the plan
 * and the desks give. This is only the affordance: the guards live in the writers themselves.
 */
const stubs = vi.hoisted(() => ({ scope: null as TenantScope | null }))

// `cloudflare:workers` does not resolve in the Node test project, so the context module is
// replaced by the scope the case seeded.
vi.mock('#/routes/_app/-server/context', () => ({
  appScope: async () => stubs.scope,
}))

// Outside a Start build the wrapper discards return values; keep the registered handler callable.
vi.mock('@tanstack/react-start', async (importOriginal) => ({
  ...(await importOriginal<typeof ReactStart>()),
  createServerFn: () => {
    const builder = {
      validator: () => builder,
      handler: (handler: unknown) => handler,
    }
    return builder
  },
}))

vi.mock('#/server/billing/runtime.cloudflare', () => ({ billingRuntime: {} }))
vi.mock('#/server/transit/bindings', () => ({ transitRuntime: {} }))
vi.mock('#/server/auth/env', () => ({ authSecret: () => 'test-secret' }))

const { loadTripLists, loadTripFiles } = await import('../trip')

type Read = (input: { data: { tripId: string } }) => Promise<unknown>

const reads: ReadonlyArray<readonly [string, Read]> = [
  ['lists', loadTripLists as unknown as Read],
  ['files', loadTripFiles as unknown as Read],
]

describe.each(reads)('the trip %s read', (_name, read) => {
  let harness: Harness
  let tenant: SeededTenant
  let tripId: string
  let viewerId: string
  let editorId: string

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('write-flags')
    tripId = (await createTrip(tenant.scope, { title: 'Portugal' })).id
    viewerId = await tenant.addUser('A viewer')
    editorId = await tenant.addUser('An editor')
    await addTripMember(tenant.scope, {
      tripId,
      userId: viewerId,
      role: 'viewer',
    })
    await addTripMember(tenant.scope, {
      tripId,
      userId: editorId,
      role: 'editor',
    })
  })
  afterEach(() => harness.close())

  async function payloadFor(scope: TenantScope): Promise<unknown> {
    stubs.scope = scope
    return read({ data: { tripId } })
  }

  it('carries the write flag on for an owner and an editor of a live trip, off for a viewer', async () => {
    expect(await payloadFor(tenant.scope)).toMatchObject({
      canWrite: true,
      archived: false,
    })
    expect(await payloadFor(tenant.scopeFor(editorId))).toMatchObject({
      canWrite: true,
      archived: false,
    })
    expect(await payloadFor(tenant.scopeFor(viewerId))).toMatchObject({
      canWrite: false,
      archived: false,
    })
  })

  it('carries the write flag off, and the archived reason, for every reader of an archived trip', async () => {
    await archiveTrip(tenant.scope, tripId)

    for (const scope of [
      tenant.scope,
      tenant.scopeFor(editorId),
      tenant.scopeFor(viewerId),
    ]) {
      expect(await payloadFor(scope)).toMatchObject({
        canWrite: false,
        archived: true,
      })
    }
  })
})
