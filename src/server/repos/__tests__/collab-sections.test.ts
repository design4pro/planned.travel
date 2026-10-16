import { beforeEach, describe, expect, it } from 'vitest'
import { CollabSectionsError, setTripCollabSections } from '../collab'
import { NotFoundError } from '../context'
import {
  addTripMember,
  archiveTrip,
  canWritePlan,
  createTrip,
  tripRoleFor,
  tripsRepository,
  TripArchivedError,
  TripRoleError,
  updateTrip,
} from '../trips'
import { AUTHORED_ERROR_NAMES } from '#/server/errors/public'
import { createHarness } from './harness'
import type { SeededTenant } from './harness'
import type { TenantScope } from '../base'

let tenant: SeededTenant
let tripId: string
let editor: TenantScope
let viewer: TenantScope
let reader: TenantScope

beforeEach(async () => {
  tenant = await (await createHarness()).seedTenant('sections')
  const trip = await createTrip(tenant.scope, {
    title: 'Lisbon',
    startDate: '2026-10-01',
    endDate: '2026-10-03',
  })
  tripId = trip.id
  const editorId = await tenant.addUser('Editor')
  const viewerId = await tenant.addUser('Viewer')
  reader = tenant.scopeFor(await tenant.addUser('Reader'))
  await addTripMember(tenant.scope, {
    tripId,
    userId: editorId,
    role: 'editor',
  })
  await addTripMember(tenant.scope, {
    tripId,
    userId: viewerId,
    role: 'viewer',
  })
  editor = tenant.scopeFor(editorId)
  viewer = tenant.scopeFor(viewerId)
})

async function expectUnchanged(
  scope: TenantScope,
  error: abstract new (...args: never[]) => Error,
) {
  const before = await tripsRepository.requireById(tenant.scope, tripId)
  await expect(
    setTripCollabSections(scope, tripId, { section: 'polls', on: false }),
  ).rejects.toBeInstanceOf(error)
  expect(await tripsRepository.requireById(tenant.scope, tripId)).toEqual(
    before,
  )
}

describe('setTripCollabSections', () => {
  it('lets the owner store a whole resolved record and round-trip a section back on', async () => {
    expect(
      await setTripCollabSections(tenant.scope, tripId, {
        section: 'polls',
        on: false,
      }),
    ).toEqual({ conversation: true, notes: true, polls: false })
    expect(
      (await tripsRepository.requireById(tenant.scope, tripId)).collabModules,
    ).toEqual({ conversation: true, notes: true, polls: false })
    expect(
      await setTripCollabSections(tenant.scope, tripId, {
        section: 'polls',
        on: true,
      }),
    ).toEqual({ conversation: true, notes: true, polls: true })
  })

  it('lets an editor switch a section', async () => {
    expect(
      await setTripCollabSections(editor, tripId, {
        section: 'notes',
        on: false,
      }),
    ).toEqual({ conversation: true, notes: false, polls: true })
  })

  it('refuses a viewer without touching the row', async () =>
    expectUnchanged(viewer, TripRoleError))
  it('hides a private trip from a nonmember before checking role', async () =>
    expectUnchanged(reader, NotFoundError))

  it('refuses an organization-visible nonmember for role and gives no plan-write permission', async () => {
    await updateTrip(tenant.scope, tripId, { visibility: 'organization' })
    await expectUnchanged(reader, TripRoleError)
    const trip = await tripsRepository.requireById(tenant.scope, tripId)
    expect(
      canWritePlan(trip, await tripRoleFor(reader, tripId, reader.ctx.userId)),
    ).toBe(false)
  })

  it('refuses an archived trip before checking role', async () => {
    await archiveTrip(tenant.scope, tripId)
    await expectUnchanged(tenant.scope, TripArchivedError)
    await expectUnchanged(viewer, TripArchivedError)
    await expectUnchanged(reader, NotFoundError)
  })

  it('refuses the last enabled section and leaves the whole row unchanged', async () => {
    await setTripCollabSections(tenant.scope, tripId, {
      section: 'notes',
      on: false,
    })
    await setTripCollabSections(tenant.scope, tripId, {
      section: 'conversation',
      on: false,
    })
    await expectUnchanged(tenant.scope, CollabSectionsError)
    expect(AUTHORED_ERROR_NAMES.has(new CollabSectionsError().name)).toBe(false)
  })
})
