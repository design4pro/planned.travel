/**
 * A trip's guests — the record, the refusal of duplicates, the bound, and the merge into a member.
 *
 * `01-S6b`. The cross-organization half of the same question is in `tenant-isolation.test.ts`, and
 * the between-members half in `member-isolation.test.ts`. This file holds the trip's own rules about
 * its guests: what the owner may add, what a name collides with, where the list stops, and what a
 * merge moves — or, when a relinker throws, does not.
 */

import { eq } from 'drizzle-orm'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { member } from '#/server/db/auth-schema'
import { tripGuests, trips } from '#/server/db/schema'
import type { RepositoryError } from '../context';
import { NotFoundError } from '../context'
import {
  MAX_TRIP_GUESTS,
  TripGuestLimitError,
  TripGuestMergeTargetError,
  TripGuestNameTakenError,
  createTripGuest,
  listTripGuests,
  listTripParticipants,
  mergeTripGuest,
  registerGuestRelinker,
  removeTripGuest,
  renameTripGuest,
} from '../trip-guests'
import { addTripMember, createTrip } from '../trips'
import { captureError, createHarness, subscribeTenant } from './harness'
import type { Harness, SeededTenant } from './harness'
import type { TenantScope } from '../base'

describe('a trip’s guests', () => {
  let harness: Harness
  let alpha: SeededTenant
  let tripId: string
  /** Unregisters every relinker a case registered, so the module-level registry never leaks. */
  const unregister: Array<() => void> = []

  beforeEach(async () => {
    harness = await createHarness()
    alpha = await harness.seedTenant('alpha')
    await subscribeTenant(alpha.scope, 'crew', 5)
    const trip = await createTrip(alpha.scope, {
      title: 'Lisbon in spring',
      startDate: '2026-04-10',
      endDate: '2026-04-12',
      currency: 'EUR',
    })
    tripId = trip.id
  })

  afterEach(() => {
    for (const release of unregister.splice(0)) release()
    vi.restoreAllMocks()
  })

  async function addGuest(displayName: string): Promise<string> {
    return (await createTripGuest(alpha.scope, { tripId, displayName })).id
  }

  /** The names on the trip, as stored. */
  async function names(): Promise<Array<string>> {
    return (await listTripGuests(alpha.scope, tripId)).map(
      (guest) => guest.displayName,
    )
  }

  /** Whether any statement since the mark wrote to `trip_guests` with an insert. */
  function insertedSince(mark: number): boolean {
    return harness.statements
      .slice(mark)
      .some((statement) => /^insert into "trip_guests"/i.test(statement))
  }

  describe('listTripGuests', () => {
    it('answers the guests in name order', async () => {
      await addGuest('Zofia')
      await addGuest('Anna')
      await addGuest('Marek')

      expect(await names()).toEqual(['Anna', 'Marek', 'Zofia'])
    })

    it('answers [] for a trip in another organization', async () => {
      await addGuest('Anna')
      const beta = await harness.seedTenant('beta')

      expect(await listTripGuests(beta.scope, tripId)).toEqual([])
    })
  })

  describe('createTripGuest', () => {
    it('stores the name trimmed and records who added it', async () => {
      const guest = await createTripGuest(alpha.scope, {
        tripId,
        displayName: '  Anna  ',
      })

      expect(guest.displayName).toBe('Anna')
      expect(guest.createdBy).toBe(alpha.ownerUserId)
    })

    it('refuses a duplicate in another case and with padding, before the index is reached', async () => {
      const before = harness.statements.length
      await addGuest('Anna')
      // The probe sees the first insert, so its silence below means something.
      expect(insertedSince(before)).toBe(true)
      const mark = harness.statements.length

      const refusal = await captureError(() => addGuest('  anna  '))

      expect(refusal).toBeInstanceOf(TripGuestNameTakenError)
      expect((refusal as RepositoryError).code).toBe('TRIP_GUEST_NAME_TAKEN')
      // "The index is never reached": no insert was sent at all, so the refusal is the rule's and
      // not the unique index's.
      expect(insertedSince(mark)).toBe(false)
      expect(await names()).toEqual(['Anna'])
    })

    it('folds beyond ASCII, which SQLite’s lower() would not', async () => {
      await addGuest('ÉLODIE')

      expect(await captureError(() => addGuest('élodie'))).toBeInstanceOf(
        TripGuestNameTakenError,
      )
    })

    it('accepts the fiftieth guest and refuses the fifty-first, naming the bound', async () => {
      for (let index = 1; index < MAX_TRIP_GUESTS; index += 1) {
        await addGuest(`Guest ${index}`)
      }
      await addGuest('The fiftieth')
      expect(await listTripGuests(alpha.scope, tripId)).toHaveLength(50)

      const refusal = await captureError(() => addGuest('One too many'))

      expect(refusal).toBeInstanceOf(TripGuestLimitError)
      expect((refusal as TripGuestLimitError).limit).toBe(50)
      expect((refusal as RepositoryError).code).toBe('TRIP_GUEST_LIMIT')
      expect(await listTripGuests(alpha.scope, tripId)).toHaveLength(50)
    })

    it('refuses an editor, and writes nothing', async () => {
      const editorId = await alpha.addUser('Editor')
      await addTripMember(alpha.scope, {
        tripId,
        userId: editorId,
        role: 'editor',
      })

      const refusal = await captureError(() =>
        createTripGuest(alpha.scopeFor(editorId), {
          tripId,
          displayName: 'Anna',
        }),
      )

      expect((refusal as RepositoryError).code).toBe('FORBIDDEN')
      expect(await names()).toEqual([])
    })
  })

  describe('renameTripGuest and removeTripGuest', () => {
    it('refuses a rename onto another guest’s name', async () => {
      await addGuest('Anna')
      const marekId = await addGuest('Marek')

      expect(
        await captureError(() => renameTripGuest(alpha.scope, marekId, 'ANNA')),
      ).toBeInstanceOf(TripGuestNameTakenError)
      expect(await names()).toEqual(['Anna', 'Marek'])
    })

    it('lets a guest take their own name in another case', async () => {
      const annaId = await addGuest('Anna')

      await renameTripGuest(alpha.scope, annaId, 'ANNA')

      expect(await names()).toEqual(['ANNA'])
    })

    it('removes one guest and leaves the others', async () => {
      const annaId = await addGuest('Anna')
      await addGuest('Marek')

      await removeTripGuest(alpha.scope, annaId)

      expect(await names()).toEqual(['Marek'])
    })
  })

  describe('listTripParticipants', () => {
    it('puts the guests after the members, in name order, with the discriminant intact', async () => {
      await addGuest('Zofia')
      const annaId = await addGuest('Anna')

      const participants = await listTripParticipants(alpha.scope, tripId)

      expect(participants.map((row) => row.kind)).toEqual([
        'member',
        'guest',
        'guest',
      ])
      expect(participants[1]).toEqual({
        kind: 'guest',
        guestId: annaId,
        displayName: 'Anna',
        colour: null,
      })
    })

    it('answers the guests of a trip whose members have all gone', async () => {
      await addGuest('Anna')
      // The owner's workspace membership goes, so the member half drops them. A guest has no
      // profile to lose and stays.
      await harness.db.delete(member).where(eq(member.userId, alpha.ownerUserId))

      const participants = await listTripParticipants(alpha.scope, tripId)

      expect(participants.map((row) => row.kind)).toEqual(['guest'])
    })
  })

  describe('mergeTripGuest', () => {
    let memberUserId: string
    let annaId: string

    beforeEach(async () => {
      memberUserId = await alpha.addUser('Anna, now with an account')
      await addTripMember(alpha.scope, {
        tripId,
        userId: memberUserId,
        role: 'editor',
      })
      annaId = await addGuest('Anna')
    })

    /**
     * A fake relinker whose statement renames the trip, so a test can see whether it ran. `calls`
     * records the order relinkers were asked to plan in.
     */
    function renamingRelinker(
      title: string,
      count: number,
      calls: Array<string>,
    ) {
      return async (scope: TenantScope) => {
        calls.push(title)
        return {
          count,
          statements: [
            scope.db.update(trips).set({ title }).where(eq(trips.id, tripId)),
          ],
        }
      }
    }

    async function tripTitle(): Promise<string | undefined> {
      const rows = await harness.db
        .select({ title: trips.title })
        .from(trips)
        .where(eq(trips.id, tripId))
      return rows.at(0)?.title
    }

    it('runs every relinker in registration order in one batch, removes the guest, and answers the counts', async () => {
      const calls: Array<string> = []
      unregister.push(
        registerGuestRelinker('first', renamingRelinker('First', 2, calls)),
        registerGuestRelinker('second', renamingRelinker('Second', 3, calls)),
      )
      const batch = vi.spyOn(
        harness.db as unknown as {
          batch: (...args: Array<unknown>) => unknown
        },
        'batch',
      )

      const relinked = await mergeTripGuest(
        alpha.scope,
        tripId,
        annaId,
        memberUserId,
      )

      expect(calls).toEqual(['First', 'Second'])
      expect(relinked).toEqual({ first: 2, second: 3 })
      // One round trip: both relinkers' statements and the guest's delete, in that order — so the
      // second relinker's write is the one that stands.
      expect(batch).toHaveBeenCalledTimes(1)
      expect(batch.mock.calls[0]?.[0]).toHaveLength(3)
      expect(await tripTitle()).toBe('Second')
      expect(await names()).toEqual([])
    })

    it('answers an empty report when no relinker is registered', async () => {
      expect(
        await mergeTripGuest(alpha.scope, tripId, annaId, memberUserId),
      ).toEqual({})
      expect(await names()).toEqual([])
    })

    it('refuses a target who is not on the trip, and runs nothing', async () => {
      const calls: Array<string> = []
      unregister.push(
        registerGuestRelinker('first', renamingRelinker('First', 1, calls)),
      )
      const outsider = await alpha.addUser('In the workspace, not on the trip')

      const refusal = await captureError(() =>
        mergeTripGuest(alpha.scope, tripId, annaId, outsider),
      )

      expect(refusal).toBeInstanceOf(TripGuestMergeTargetError)
      expect(calls).toEqual([])
      expect(await names()).toEqual(['Anna'])
    })

    it('leaves the guest and every row in place when a relinker throws', async () => {
      const calls: Array<string> = []
      unregister.push(
        registerGuestRelinker('first', renamingRelinker('First', 1, calls)),
        registerGuestRelinker('broken', async () => {
          throw new Error('relinker failed')
        }),
      )

      const refusal = await captureError(() =>
        mergeTripGuest(alpha.scope, tripId, annaId, memberUserId),
      )

      expect(refusal.message).toBe('relinker failed')
      expect(await tripTitle()).toBe('Lisbon in spring')
      expect(await names()).toEqual(['Anna'])
    })

    it('does not find a guest of another trip', async () => {
      const other = await createTrip(alpha.scope, { title: 'Porto' })
      const foreignGuest = await createTripGuest(alpha.scope, {
        tripId: other.id,
        displayName: 'Anna',
      })

      expect(
        await captureError(() =>
          mergeTripGuest(alpha.scope, tripId, foreignGuest.id, memberUserId),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(
        await harness.db
          .select({ id: tripGuests.id })
          .from(tripGuests)
          .where(eq(tripGuests.id, foreignGuest.id)),
      ).toHaveLength(1)
    })

    it('throws on a second relinker registered under one name', () => {
      unregister.push(
        registerGuestRelinker('twice', async () => ({
          count: 0,
          statements: [],
        })),
      )

      expect(() =>
        registerGuestRelinker('twice', async () => ({
          count: 0,
          statements: [],
        })),
      ).toThrow(/already registered/)
    })
  })
})
