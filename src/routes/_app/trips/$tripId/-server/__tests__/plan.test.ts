/**
 * The planner's board read, over every caller a trip can have.
 *
 * `editable` is what every write control on the board is drawn from, so the question asserted here
 * is the one PRD #104 decision 6 answers: an owner and an editor write the plan, a viewer reads it,
 * and a stranger learns nothing. `archived` rides beside it because the rail explains which of the
 * two reasons took the controls away.
 *
 * The read is driven as a plain function for the reason `day-notes.test.ts` records: outside a
 * Start build a handler's return value is discarded, so nothing could be asserted through it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  RepositoryError,
  addTripMember,
  archiveTrip,
  createTrip,
} from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'

import type { SeededTenant } from '#/server/repos/__tests__/harness'
import type { TenantScope } from '#/server/repos'

vi.mock('../../../../-server/context', () => ({
  appScope: (): never => {
    throw new Error('The board read is driven with an explicit scope.')
  },
}))

const { readPlanBoard } = await import('../plan')

/** Asserts that `run` rejects, and returns the error so the caller can name its class. */
async function captureError(run: () => Promise<unknown>): Promise<Error> {
  try {
    await run()
  } catch (error) {
    if (error instanceof Error) {
      return error
    }
    throw error
  }
  throw new Error('Expected the call to reject, but it resolved.')
}

let tenant: SeededTenant
let owner: TenantScope
let editor: TenantScope
let viewer: TenantScope
let stranger: TenantScope
let tripId: string

beforeEach(async () => {
  const harness = await createHarness()
  tenant = await harness.seedTenant('planner')
  owner = tenant.scope

  const editorId = await tenant.addUser('A co-planner')
  const viewerId = await tenant.addUser('A reader')
  const strangerId = await tenant.addUser('Nobody on this trip')
  editor = tenant.scopeFor(editorId)
  viewer = tenant.scopeFor(viewerId)
  stranger = tenant.scopeFor(strangerId)

  const trip = await createTrip(owner, {
    title: 'Vienna in October',
    startDate: '2026-10-05',
    endDate: '2026-10-07',
    currency: 'EUR',
  })
  await addTripMember(owner, {
    tripId: trip.id,
    userId: editorId,
    role: 'editor',
  })
  await addTripMember(owner, {
    tripId: trip.id,
    userId: viewerId,
    role: 'viewer',
  })
  tripId = trip.id
})

describe('readPlanBoard', () => {
  it('lets an owner write the plan', async () => {
    const payload = await readPlanBoard(owner, tripId)

    expect(payload).toMatchObject({ editable: true, archived: false })
  })

  it('lets an editor write the plan', async () => {
    const payload = await readPlanBoard(editor, tripId)

    expect(payload).toMatchObject({ editable: true, archived: false })
  })

  it('gives a viewer the whole board and no write', async () => {
    const payload = await readPlanBoard(viewer, tripId)

    expect(payload).toMatchObject({ editable: false, archived: false })
    expect(payload.days).toHaveLength(3)
  })

  it('refuses a non-member with not-found, and tells them nothing else', async () => {
    const error = await captureError(() => readPlanBoard(stranger, tripId))

    expect(error).toBeInstanceOf(RepositoryError)
    expect((error as RepositoryError).code).toBe('NOT_FOUND')
  })

  it('lets a workspace member read an organization-visible trip, and write none of it', async () => {
    // Organization visibility grants the read, never a role on the trip.
    const shared = await createTrip(owner, {
      title: 'Porto in June',
      startDate: '2026-06-01',
      endDate: '2026-06-02',
      visibility: 'organization',
    })

    const payload = await readPlanBoard(stranger, shared.id)

    expect(payload).toMatchObject({ editable: false, archived: false })
  })

  it('takes writes away from everyone on an archived trip, and says it is the archive', async () => {
    await archiveTrip(owner, tripId)

    for (const scope of [owner, editor, viewer]) {
      const payload = await readPlanBoard(scope, tripId)
      expect(payload).toMatchObject({ editable: false, archived: true })
    }
  })
})
