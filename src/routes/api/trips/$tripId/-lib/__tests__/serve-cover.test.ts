/**
 * Who `GET /api/trips/:tripId/cover` serves a trip's cover to, and what it serves.
 *
 * The route is an HTTP authorisation boundary over workspace bytes, so every case is a way of asking
 * that must be refused with the *same* answer as a trip that is not there, plus the one way that is
 * served. The session layer is stubbed; the repositories are real, over the migrated in-memory
 * database, so "the trip is readable" is the shipped predicate and not a stand-in for it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { addTripMember, createTrip, updateTrip } from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'

import { serveTripCover } from '../serve-cover'

import type { TenantContext } from '#/server/auth/session'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'

const stubs = vi.hoisted(() => ({
  signedIn: true,
  ctx: null as TenantContext | null,
  db: null as unknown,
}))

vi.mock('#/server/auth/session', async () => {
  const { AuthRequirementError, isAuthRequirementError } =
    await import('#/server/auth/tenant')
  return {
    isAuthRequirementError,
    getSession: async () =>
      stubs.signedIn
        ? { user: { name: 'Ada', email: 'ada@example.test' } }
        : null,
    requireOrg: async () => {
      if (stubs.ctx === null) {
        throw new AuthRequirementError(
          'no-active-organization',
          'Choose a workspace before continuing.',
        )
      }
      return stubs.ctx
    },
  }
})

vi.mock('#/server/db/client', () => ({ getDb: () => stubs.db }))

interface StoredObject {
  readonly body: string
  readonly contentType: string
}

/** A bucket that records every key it was asked for, so "never read" is assertable. */
function fakeBucket(objects: Record<string, StoredObject>) {
  const reads: Array<string> = []
  return {
    reads,
    get: async (key: string) => {
      reads.push(key)
      const stored = objects[key]
      if (stored === undefined) {
        return null
      }
      return {
        body: new Blob([stored.body]).stream(),
        size: stored.body.length,
        httpMetadata: { contentType: stored.contentType },
      }
    },
  }
}

function ask(tripId: string, query = ''): Request {
  return new Request(`https://planned.travel/api/trips/${tripId}/cover${query}`)
}

describe('the trip cover route', () => {
  let harness: Harness
  let alpha: SeededTenant
  let tripId: string
  let key: string

  function actAs(
    tenant: SeededTenant,
    userId: string,
    role: TenantContext['role'] = userId === tenant.ownerUserId
      ? 'owner'
      : 'member',
  ): void {
    stubs.ctx = { userId, organizationId: tenant.organizationId, role }
  }

  beforeEach(async () => {
    harness = await createHarness()
    stubs.db = harness.db
    stubs.signedIn = true
    alpha = await harness.seedTenant('cover-route')
    const trip = await createTrip(alpha.scope, { title: 'Lisbon' })
    tripId = trip.id
    key = `trips/${alpha.organizationId}/${tripId}/f1-cover.jpg`
    await updateTrip(alpha.scope, tripId, {
      coverImageKey: key,
      coverImageUrl: `https://planned.travel/api/trips/${tripId}/cover?v=f1`,
    })
    actAs(alpha, alpha.ownerUserId)
  })

  it('serves the image inline, with sniffing off and a private cache', async () => {
    const bucket = fakeBucket({
      [key]: { body: 'jpeg', contentType: 'image/jpeg' },
    })

    const response = await serveTripCover(bucket, ask(tripId, '?v=f1'), tripId)

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('jpeg')
    expect(response.headers.get('content-type')).toBe('image/jpeg')
    expect(response.headers.get('content-disposition')).toBe('inline')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    const cache = response.headers.get('cache-control') ?? ''
    expect(cache).toContain('private')
    expect(cache).not.toContain('public')
  })

  it.each(['image/png', 'image/webp', 'image/avif', 'image/gif'])(
    'serves %s',
    async (contentType) => {
      const bucket = fakeBucket({ [key]: { body: 'x', contentType } })

      const response = await serveTripCover(bucket, ask(tripId), tripId)

      expect(response.status).toBe(200)
      expect(response.headers.get('content-type')).toBe(contentType)
    },
  )

  it('answers 401 with no session', async () => {
    stubs.signedIn = false
    const bucket = fakeBucket({
      [key]: { body: 'x', contentType: 'image/png' },
    })

    const response = await serveTripCover(bucket, ask(tripId), tripId)

    expect(response.status).toBe(401)
    expect(bucket.reads).toEqual([])
  })

  it('answers 403 for a caller with no workspace', async () => {
    stubs.ctx = null
    const bucket = fakeBucket({
      [key]: { body: 'x', contentType: 'image/png' },
    })

    const response = await serveTripCover(bucket, ask(tripId), tripId)

    expect(response.status).toBe(403)
    expect(bucket.reads).toEqual([])
  })

  it('answers a trip of another workspace exactly as a trip that is not there', async () => {
    const beta = await harness.seedTenant('cover-route-beta')
    actAs(beta, beta.ownerUserId)
    const bucket = fakeBucket({
      [key]: { body: 'x', contentType: 'image/png' },
    })

    const foreign = await serveTripCover(bucket, ask(tripId), tripId)
    const missing = await serveTripCover(bucket, ask('nope'), 'nope')

    expect(foreign.status).toBe(404)
    expect(missing.status).toBe(404)
    expect(await foreign.text()).toBe(await missing.text())
    expect(bucket.reads).toEqual([])
  })

  it('answers 404 for a private trip the caller is not on', async () => {
    actAs(alpha, await alpha.addUser('Colleague'))
    const bucket = fakeBucket({
      [key]: { body: 'x', contentType: 'image/png' },
    })

    const response = await serveTripCover(bucket, ask(tripId), tripId)

    expect(response.status).toBe(404)
    expect(bucket.reads).toEqual([])
  })

  it('serves a viewer, and a workspace member of an organization-visible trip', async () => {
    const bucket = fakeBucket({
      [key]: { body: 'x', contentType: 'image/png' },
    })
    const viewer = await alpha.addUser('Viewer')
    await addTripMember(alpha.scope, { tripId, userId: viewer, role: 'viewer' })
    actAs(alpha, viewer)
    expect((await serveTripCover(bucket, ask(tripId), tripId)).status).toBe(200)

    const open = await createTrip(alpha.scope, {
      title: 'Offsite',
      visibility: 'organization',
    })
    const openKey = `trips/${alpha.organizationId}/${open.id}/f2-cover.png`
    await updateTrip(alpha.scope, open.id, {
      coverImageKey: openKey,
      coverImageUrl: `https://planned.travel/api/trips/${open.id}/cover?v=f2`,
    })
    actAs(alpha, await alpha.addUser('Colleague'))
    const openBucket = fakeBucket({
      [openKey]: { body: 'x', contentType: 'image/png' },
    })
    expect(
      (await serveTripCover(openBucket, ask(open.id), open.id)).status,
    ).toBe(200)
  })

  it('answers 404 for a trip with no cover, without reading the bucket', async () => {
    const bare = await createTrip(alpha.scope, { title: 'Bare' })
    const bucket = fakeBucket({})

    const response = await serveTripCover(bucket, ask(bare.id), bare.id)

    expect(response.status).toBe(404)
    expect(bucket.reads).toEqual([])
  })

  it('reads only the key on the trip row, whatever the query says', async () => {
    const other = `trips/${alpha.organizationId}/${tripId}/f9-secret.png`
    const bucket = fakeBucket({
      [key]: { body: 'cover', contentType: 'image/png' },
      [other]: { body: 'secret', contentType: 'image/png' },
      'trips/x/y/z': { body: 'secret', contentType: 'image/png' },
    })

    const response = await serveTripCover(
      bucket,
      ask(
        tripId,
        `?v=${encodeURIComponent('f9-secret.png')}&key=${encodeURIComponent(other)}`,
      ),
      tripId,
    )

    expect(await response.text()).toBe('cover')
    expect(bucket.reads).toEqual([key])
  })

  it('refuses a stored key outside the trip’s own namespace without reading it', async () => {
    const foreignKey = 'trips/other-org/other-trip/f1-cover.jpg'
    await updateTrip(alpha.scope, tripId, { coverImageKey: foreignKey })
    const bucket = fakeBucket({
      [foreignKey]: { body: 'x', contentType: 'image/jpeg' },
    })

    const response = await serveTripCover(bucket, ask(tripId), tripId)

    expect(response.status).toBe(404)
    expect(bucket.reads).toEqual([])
  })

  it.each(['image/svg+xml', 'image/heic', 'text/html', 'application/pdf'])(
    'answers 404 for a stored %s',
    async (contentType) => {
      const bucket = fakeBucket({ [key]: { body: '<svg/>', contentType } })

      const response = await serveTripCover(bucket, ask(tripId), tripId)

      expect(response.status).toBe(404)
    },
  )

  it('answers 404 when the object is gone from the bucket', async () => {
    const response = await serveTripCover(fakeBucket({}), ask(tripId), tripId)

    expect(response.status).toBe(404)
  })
})
