import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createScope } from '../base'
import { createCategory } from '../categories'
import { createHarness } from './harness'
import { createPlace, updatePlace } from '../places'
import { addTripMember, createTrip } from '../trips'
import {
  readPlacePhoto,
  updateLegacyPlacePhoto,
  listTripPlacePhotos,
  resolvePhotoChoice,
} from '../place-photos'
import type { Harness, SeededTenant } from './harness'

const legacy = 'https://example.test/legacy.jpg'
const replacement = 'https://example.test/replacement.jpg'

describe.each(['schema', 'migrations'] as const)(
  'place photo owner (%s)',
  (ddl) => {
    let harness: Harness
    let tenant: SeededTenant
    let tripId: string
    let placeId: string

    beforeEach(async () => {
      harness = await createHarness({ ddl })
      tenant = await harness.seedTenant('photos')
      tripId = (
        await createTrip(tenant.scope, { title: 'Lisbon', slug: 'lisbon' })
      ).id
      placeId = (
        await createPlace(tenant.scope, {
          tripId,
          name: 'Castle',
          imageUrl: legacy,
        })
      ).id
    })
    afterEach(() => harness.close())

    it('guards direct owner writes and refuses foreign categories before changing either row', async () => {
      const foreign = await harness.seedTenant('foreign-owner-call')
      const category = await createCategory(foreign.scope, {
        name: 'Foreign category',
      })
      await expect(
        updateLegacyPlacePhoto(foreign.scope, placeId, { imageUrl: null }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      await expect(
        updateLegacyPlacePhoto(tenant.scope, placeId, {
          imageUrl: replacement,
          categoryId: category.id,
        }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      expect(await readPlacePhoto(tenant.scope, tripId, placeId)).toMatchObject(
        { version: 0, imageUrl: legacy },
      )
    })

    it('chooses explicit, saved default and local fallback without treating legacy as owned', () => {
      const explicit = Symbol('verified-explicit')
      const savedDefault = Symbol('verified-default')
      const old = Symbol('legacy')
      expect(
        resolvePhotoChoice({
          explicit,
          savedDefault,
          legacy: old,
          compatibility: false,
        }),
      ).toBe(explicit)
      expect(
        resolvePhotoChoice({ savedDefault, legacy: old, compatibility: false }),
      ).toBe(savedDefault)
      expect(
        resolvePhotoChoice({ legacy: old, compatibility: false }),
      ).toBeNull()
      expect(
        resolvePhotoChoice({
          explicit,
          savedDefault,
          legacy: old,
          compatibility: true,
        }),
      ).toBe(old)
    })

    for (const change of ['archive', 'role', 'departure', 'delete'] as const) {
      it(`rechecks ${change} inside the atomic write`, async () => {
        const db = new Proxy(harness.db, {
          get(target, key, receiver) {
            if (key !== 'batch') return Reflect.get(target, key, receiver)
            return (...args: Array<unknown>) => {
              if (change === 'archive')
                harness.sqlite
                  .prepare('UPDATE trips SET is_archived = 1 WHERE id = ?')
                  .run(tripId)
              if (change === 'role')
                harness.sqlite
                  .prepare(
                    "UPDATE trip_members SET role = 'viewer' WHERE trip_id = ?",
                  )
                  .run(tripId)
              if (change === 'departure')
                harness.sqlite
                  .prepare('DELETE FROM member WHERE user_id = ?')
                  .run(tenant.ownerUserId)
              if (change === 'delete')
                harness.sqlite
                  .prepare('DELETE FROM places WHERE id = ?')
                  .run(placeId)
              const batch: unknown = Reflect.get(target, key, receiver)
              if (typeof batch !== 'function')
                throw new Error('Missing atomic batch')
              return Reflect.apply(batch, target, args)
            }
          },
        })
        const scope = createScope(db, tenant.scope.ctx)
        await expect(
          updatePlace(scope, placeId, { imageUrl: replacement }),
        ).rejects.toMatchObject({ code: 'PHOTO_CONFLICT' })
        expect(
          harness.sqlite
            .prepare('SELECT count(*) AS n FROM place_photo_selections')
            .get(),
        ).toMatchObject({ n: 0 })
        if (change !== 'delete')
          expect(
            harness.sqlite
              .prepare('SELECT image_url FROM places WHERE id = ?')
              .get(placeId),
          ).toMatchObject({ image_url: legacy })
      })
    }

    it('lets organization-visible nonmembers read without granting write permission', async () => {
      harness.sqlite
        .prepare("UPDATE trips SET visibility = 'organization' WHERE id = ?")
        .run(tripId)
      const reader = tenant.scopeFor(await tenant.addUser('Reader'))
      expect((await readPlacePhoto(reader, tripId, placeId)).imageUrl).toBe(
        legacy,
      )
      await expect(
        updatePlace(reader, placeId, { imageUrl: null }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    })

    it('resolves old rows without metadata or writes and preserves omitted photo fields', async () => {
      harness.statements.length = 0
      expect(await readPlacePhoto(tenant.scope, tripId, placeId)).toMatchObject(
        { imageUrl: legacy, source: 'legacy', version: 0 },
      )
      expect(
        harness.statements.some((statement) =>
          /^\s*(insert|update|delete)/i.test(statement),
        ),
      ).toBe(false)
      await updatePlace(tenant.scope, placeId, { name: 'Fortress' })
      expect(await readPlacePhoto(tenant.scope, tripId, placeId)).toMatchObject(
        { imageUrl: legacy, version: 0 },
      )
    })

    it('serializes old URL changes and explicit null, returning the legacy caller result', async () => {
      expect(
        (await updatePlace(tenant.scope, placeId, { imageUrl: replacement }))
          .imageUrl,
      ).toBe(replacement)
      expect(await readPlacePhoto(tenant.scope, tripId, placeId)).toMatchObject(
        { imageUrl: replacement, version: 1 },
      )
      await updatePlace(tenant.scope, placeId, { imageUrl: null })
      expect(await readPlacePhoto(tenant.scope, tripId, placeId)).toMatchObject(
        { imageUrl: null, source: 'fallback', version: 2 },
      )
      await updatePlace(tenant.scope, placeId, { description: 'Unrelated' })
      expect(
        (await readPlacePhoto(tenant.scope, tripId, placeId)).version,
      ).toBe(2)
    })

    it('allows exactly one concurrent conditional change and keeps metadata aligned with the place', async () => {
      const results = await Promise.allSettled([
        updatePlace(tenant.scope, placeId, {
          imageUrl: replacement,
          expectedPhotoVersion: 0,
        }),
        updatePlace(tenant.scope, placeId, {
          imageUrl: null,
          expectedPhotoVersion: 0,
        }),
      ])
      expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1)
      const winner = results.find((r) => r.status === 'fulfilled')
      expect(await readPlacePhoto(tenant.scope, tripId, placeId)).toMatchObject(
        {
          version: 1,
          imageUrl:
            winner?.status === 'fulfilled' ? winner.value.imageUrl : undefined,
        },
      )
    })

    it('hides foreign tenants, wrong trips, private nonmembers and departed members', async () => {
      const foreign = await harness.seedTenant('foreign-photos')
      const otherTrip = await createTrip(tenant.scope, {
        title: 'Porto',
        slug: 'porto',
      })
      const outsider = tenant.scopeFor(await tenant.addUser('Outsider'))
      for (const [scope, id] of [
        [foreign.scope, tripId],
        [tenant.scope, otherTrip.id],
        [outsider, tripId],
      ] as const) {
        await expect(readPlacePhoto(scope, id, placeId)).rejects.toMatchObject({
          code: 'NOT_FOUND',
        })
      }
      await expect(
        listTripPlacePhotos(foreign.scope, tripId),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      await expect(
        updatePlace(foreign.scope, placeId, { imageUrl: null }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      harness.sqlite
        .prepare('DELETE FROM member WHERE user_id = ?')
        .run(tenant.ownerUserId)
      await expect(
        readPlacePhoto(tenant.scope, tripId, placeId),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
      await expect(
        updatePlace(tenant.scope, placeId, { imageUrl: null }),
      ).rejects.toMatchObject({ code: 'NOT_FOUND' })
    })

    it('lets viewers read, editors write and archived readers retain their photo', async () => {
      const viewerId = await tenant.addUser('Viewer')
      const editorId = await tenant.addUser('Editor')
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
      const viewer = tenant.scopeFor(viewerId)
      const editor = tenant.scopeFor(editorId)
      expect((await readPlacePhoto(viewer, tripId, placeId)).imageUrl).toBe(
        legacy,
      )
      await expect(
        updatePlace(viewer, placeId, { imageUrl: null }),
      ).rejects.toMatchObject({ code: 'FORBIDDEN' })
      await updatePlace(editor, placeId, { imageUrl: replacement })
      harness.sqlite
        .prepare('UPDATE trips SET is_archived = 1 WHERE id = ?')
        .run(tripId)
      expect((await readPlacePhoto(viewer, tripId, placeId)).imageUrl).toBe(
        replacement,
      )
      await expect(
        updatePlace(editor, placeId, { imageUrl: null }),
      ).rejects.toThrow()
      expect(
        (await readPlacePhoto(tenant.scope, tripId, placeId)).version,
      ).toBe(1)
    })
  },
)
