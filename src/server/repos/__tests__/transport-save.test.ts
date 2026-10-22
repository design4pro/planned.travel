/**
 * Saving a Transport together with its Legs, at the repository seam.
 *
 * `saveTransport` is the one writer behind the Transport dialog: it creates or updates the record
 * and replaces the chain in a single batch, so the half-saved states the dialog used to recover
 * from (a record with no chain, a second record from a retried press) cannot be reached. What it
 * does not do is decide days: the record's day pair is whatever the caller sends.
 *
 * The cross-workspace cases are asserted in `tenant-isolation.test.ts`, as for every writer.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { mintId } from '#/lib/ids'
import { NotFoundError } from '../context'
import { createDay, listTripDays } from '../days'
import { listFilesForEntity, recordFile } from '../files'
import { createReservation, listTripReservations } from '../reservations'
import { TripRoleError, addTripMember, createTrip } from '../trips'
import {
  deleteTransport,
  getTransport,
  listTransportLegs,
  listTripLegs,
  listTripTransports,
  saveSearchedConnection,
  saveTransport,
  transportsRepository,
} from '../transports'
import { captureError, createHarness } from './harness'
import type { Day } from '#/server/db/types'
import type { RepositoryError } from '../context'
import type { Harness, SeededTenant } from './harness'

const OSAKA = { name: 'Shin-Osaka', code: 'OSA', timezone: 'Asia/Tokyo' }
const NAGOYA = { name: 'Nagoya', code: 'NGO', timezone: 'Asia/Tokyo' }
const TOKYO = { name: 'Tokyo', code: 'TYO', timezone: 'Asia/Tokyo' }
const HONOLULU = { name: 'Honolulu', code: 'HNL', timezone: 'Pacific/Honolulu' }
const LONDON = { name: 'Heathrow', code: 'LHR', timezone: 'Europe/London' }
const NEW_YORK = { name: 'JFK', code: 'JFK', timezone: 'America/New_York' }

const NO_CHAIN = { stations: [], legs: [] }

describe('saving a transport with its legs', () => {
  let harness: Harness
  let tenant: SeededTenant
  let tripId: string
  let days: Array<Day>

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('save')
    const trip = await createTrip(tenant.scope, {
      title: 'Sanyo line',
      startDate: '2026-04-10',
      endDate: '2026-04-13',
      currency: 'JPY',
    })
    tripId = trip.id
    days = await listTripDays(tenant.scope, trip.id)
  })

  /** Every row the trip holds, so a refusal can be shown to have written nothing at all. */
  async function snapshot() {
    return {
      transports: await listTripTransports(tenant.scope, tripId),
      legs: await listTripLegs(tenant.scope, tripId),
    }
  }

  it('creates the record and its legs in one call, endpoints taken from the outer stations', async () => {
    const saved = await saveTransport(tenant.scope, {
      tripId,
      transportId: 'draft-1',
      intent: 'create',
      record: {
        title: 'Osaka to Tokyo',
        mode: 'train',
        bookingCode: 'ABC123',
        departureName: 'typed and then overwritten',
      },
      chain: {
        stations: [OSAKA, NAGOYA, TOKYO],
        legs: [
          { serviceNumber: 'Hikari 500', departureTime: '09:00' },
          { serviceNumber: 'Nozomi 24', arrivalTime: '12:40' },
        ],
      },
    })

    expect(saved.transport.id).toBe('draft-1')
    expect(saved.legs.map((leg) => [leg.fromName, leg.toName])).toEqual([
      ['Shin-Osaka', 'Nagoya'],
      ['Nagoya', 'Tokyo'],
    ])
    const record = await getTransport(tenant.scope, 'draft-1')
    expect(record?.bookingCode).toBe('ABC123')
    expect(record?.departureName).toBe('Shin-Osaka')
    expect(record?.departureCode).toBe('OSA')
    expect(record?.departureTime).toBe('09:00')
    expect(record?.arrivalName).toBe('Tokyo')
    expect(record?.arrivalTime).toBe('12:40')
    expect(record?.arrivalTimezone).toBe('Asia/Tokyo')
  })

  it('creates an unchained transport with the endpoints the caller typed', async () => {
    const saved = await saveTransport(tenant.scope, {
      tripId,
      transportId: 'draft-2',
      intent: 'create',
      record: {
        title: 'Airport train',
        mode: 'train',
        departureName: 'Narita',
        arrivalName: 'Shinjuku',
      },
      chain: NO_CHAIN,
    })

    expect(saved.legs).toEqual([])
    expect(saved.transport.departureName).toBe('Narita')
    expect(saved.transport.arrivalName).toBe('Shinjuku')
    expect(await listTripLegs(tenant.scope, tripId)).toEqual([])
  })

  /**
   * The dialog mints a new record's id in the browser with the shared generator, so equal-order
   * undated transports must list by creation and not by a random tail. The ids are minted in
   * distinct milliseconds: within one the order is the random tail and asserts nothing (#462).
   */
  it('lists undated transports of equal order in the order their dialog ids were minted', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-22T12:00:00.000Z'))
    const minted: Array<string> = []
    for (let i = 0; i < 6; i += 1) {
      minted.push(mintId())
      vi.advanceTimersByTime(1)
    }
    vi.useRealTimers()

    // Saved out of order and titled against it, so neither the write order nor the title can
    // stand in for the id.
    for (const index of [3, 0, 5, 1, 4, 2]) {
      await saveTransport(tenant.scope, {
        tripId,
        transportId: minted[index],
        intent: 'create',
        record: { title: `Idea ${minted.length - index}`, mode: 'train' },
        chain: NO_CHAIN,
      })
    }

    const listed = await listTripTransports(tenant.scope, tripId)
    expect(listed.map((row) => row.id)).toEqual(minted)
  })

  /**
   * The writer decides no day. A chained journey's days are whatever the caller sends for the
   * record, whatever the legs say: the dialog derives them from the outer legs before it sends.
   */
  it('keeps the record’s day pair exactly as sent, whatever the legs name', async () => {
    const saved = await saveTransport(tenant.scope, {
      tripId,
      transportId: 'draft-3',
      intent: 'create',
      record: {
        title: 'Night train',
        mode: 'train',
        dayId: days[1].id,
        arrivalDayId: days[2].id,
      },
      chain: {
        stations: [OSAKA, TOKYO],
        legs: [{ departureDayId: days[0].id, arrivalDayId: days[3].id }],
      },
    })

    expect(saved.transport.dayId).toBe(days[1].id)
    expect(saved.transport.arrivalDayId).toBe(days[2].id)
    expect(saved.legs[0].departureDayId).toBe(days[0].id)
    expect(saved.legs[0].arrivalDayId).toBe(days[3].id)
  })

  it('writes no day for a record sent with none, even when its legs have days', async () => {
    const saved = await saveTransport(tenant.scope, {
      tripId,
      transportId: 'draft-4',
      intent: 'create',
      record: { title: 'Undated idea', mode: 'train' },
      chain: {
        stations: [OSAKA, TOKYO],
        legs: [{ departureDayId: days[0].id }],
      },
    })

    expect(saved.transport.dayId).toBeNull()
    expect(saved.transport.arrivalDayId).toBeNull()
  })

  describe('an existing transport', () => {
    beforeEach(async () => {
      await saveTransport(tenant.scope, {
        tripId,
        transportId: 'existing',
        intent: 'create',
        record: {
          title: 'Osaka to Tokyo',
          mode: 'train',
          bookingCode: 'ABC123',
          seat: '11A',
        },
        chain: {
          stations: [OSAKA, NAGOYA, TOKYO],
          legs: [{ departureTime: '09:00' }, { arrivalTime: '12:40' }],
        },
      })
    })

    it('replaces the record and the chain in one call, endpoints following the new outer stations', async () => {
      const saved = await saveTransport(tenant.scope, {
        tripId,
        transportId: 'existing',
        intent: 'edit',
        record: { title: 'Osaka to Nagoya', mode: 'train', seat: '12B' },
        chain: {
          stations: [OSAKA, NAGOYA],
          legs: [{ departureTime: '10:00', arrivalTime: '11:00' }],
        },
      })

      expect(saved.legs).toHaveLength(1)
      expect(await listTransportLegs(tenant.scope, 'existing')).toHaveLength(1)
      expect(saved.transport.title).toBe('Osaka to Nagoya')
      expect(saved.transport.seat).toBe('12B')
      expect(saved.transport.arrivalName).toBe('Nagoya')
      expect(saved.transport.arrivalTime).toBe('11:00')
      expect(await listTripTransports(tenant.scope, tripId)).toHaveLength(1)
    })

    it('removes the legs when sent an empty chain, and keeps the typed endpoints', async () => {
      const saved = await saveTransport(tenant.scope, {
        tripId,
        transportId: 'existing',
        intent: 'edit',
        record: {
          title: 'Osaka to Tokyo',
          mode: 'train',
          departureName: 'Osaka',
          arrivalName: 'Tokyo',
        },
        chain: NO_CHAIN,
      })

      expect(saved.legs).toEqual([])
      expect(await listTransportLegs(tenant.scope, 'existing')).toEqual([])
      expect(saved.transport.departureName).toBe('Osaka')
      expect(saved.transport.arrivalName).toBe('Tokyo')
    })

    it('leaves the stored zones alone when the record names none and the chain is empty', async () => {
      const saved = await saveTransport(tenant.scope, {
        tripId,
        transportId: 'existing',
        intent: 'edit',
        record: { title: 'Osaka to Tokyo', mode: 'train' },
        chain: NO_CHAIN,
      })

      expect(saved.transport.departureTimezone).toBe('Asia/Tokyo')
    })
  })

  /** The same draft pressed twice carries the same id, so the second press is an edit. */
  it('does not create a second transport when the same draft is saved twice', async () => {
    const draft = {
      tripId,
      transportId: 'pressed-twice',
      intent: 'create' as const,
      record: { title: 'Osaka to Tokyo', mode: 'train' as const },
      chain: {
        stations: [OSAKA, NAGOYA, TOKYO],
        legs: [{}, {}],
      },
    }

    await saveTransport(tenant.scope, draft)
    await saveTransport(tenant.scope, draft)

    expect(await listTripTransports(tenant.scope, tripId)).toHaveLength(1)
    expect(await listTripLegs(tenant.scope, tripId)).toHaveLength(2)
  })

  /**
   * The intent is the dialog's own statement of what it means to do. Without it a save could only
   * tell an edit from a create by whether the id was found, and a Transport deleted in another
   * tab was found nowhere: its edit came back as a create under the old id.
   */
  describe('the intent of a save', () => {
    const CHAINED = {
      stations: [OSAKA, NAGOYA, TOKYO],
      legs: [{ departureTime: '09:00' }, { arrivalTime: '12:40' }],
    }

    async function seedLinkedTransport(transportId: string) {
      await saveTransport(tenant.scope, {
        tripId,
        transportId,
        intent: 'create',
        record: { title: 'Osaka to Tokyo', mode: 'train' },
        chain: CHAINED,
      })
      await createReservation(tenant.scope, {
        tripId,
        transportId,
        title: 'Seat reservation',
      })
      await recordFile(tenant.scope, {
        tripId,
        transportId,
        storageKey: `files/${transportId}/ticket.pdf`,
        filename: 'ticket.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      })
    }

    /** What may still point at, or be left of, a Transport that is gone. */
    async function leftOver(transportId: string) {
      return {
        row: await getTransport(tenant.scope, transportId),
        legs: await listTransportLegs(tenant.scope, transportId),
        reservations: (
          await listTripReservations(tenant.scope, { tripId })
        ).filter((reservation) => reservation.transportId === transportId)
          .length,
        files: (await listFilesForEntity(tenant.scope, { transportId })).length,
      }
    }

    it('refuses an edit of a transport deleted in the meantime and brings nothing back', async () => {
      await seedLinkedTransport('deleted-in-tab-b')
      await deleteTransport(tenant.scope, 'deleted-in-tab-b')

      const error = await captureError(() =>
        saveTransport(tenant.scope, {
          tripId,
          transportId: 'deleted-in-tab-b',
          intent: 'edit',
          record: { title: 'Saved from tab A', mode: 'train' },
          chain: CHAINED,
        }),
      )

      expect(error).toEqual(new NotFoundError('transport', 'deleted-in-tab-b'))
      expect(await leftOver('deleted-in-tab-b')).toEqual({
        row: null,
        legs: [],
        reservations: 0,
        files: 0,
      })
      expect(await snapshot()).toEqual({ transports: [], legs: [] })
    })

    it('refuses an edit of a deleted transport sent with no chain, too', async () => {
      await seedLinkedTransport('deleted-unchained')
      await deleteTransport(tenant.scope, 'deleted-unchained')

      const error = await captureError(() =>
        saveTransport(tenant.scope, {
          tripId,
          transportId: 'deleted-unchained',
          intent: 'edit',
          record: { title: 'Saved from tab A', mode: 'train' },
          chain: NO_CHAIN,
        }),
      )

      expect(error).toBeInstanceOf(NotFoundError)
      expect(await snapshot()).toEqual({ transports: [], legs: [] })
    })

    /** The existence check comes first, so the row is not confirmed by a timing or day refusal. */
    it('answers not-found, and not an ordering refusal, for an edit of a transport that is not there', async () => {
      const error = await captureError(() =>
        saveTransport(tenant.scope, {
          tripId,
          transportId: 'never-existed',
          intent: 'edit',
          record: {
            title: 'Inverted',
            mode: 'flight',
            dayId: days[2].id,
            arrivalDayId: days[0].id,
            departureDate: '2026-04-16',
            departureTime: '09:00',
            arrivalDate: '2026-04-16',
            arrivalTime: '03:00',
          },
          chain: { stations: [LONDON, NEW_YORK], legs: [{}] },
        }),
      )

      expect(error).toBeInstanceOf(NotFoundError)
      expect(await snapshot()).toEqual({ transports: [], legs: [] })
    })

    it('creates a transport for the intent create', async () => {
      await saveTransport(tenant.scope, {
        tripId,
        transportId: 'fresh',
        intent: 'create',
        record: { title: 'Osaka to Tokyo', mode: 'train' },
        chain: CHAINED,
      })

      expect((await snapshot()).transports.map((row) => row.id)).toEqual([
        'fresh',
      ])
    })

    it('treats a create of an id the caller already wrote as an edit of that row', async () => {
      await seedLinkedTransport('written-once')

      await saveTransport(tenant.scope, {
        tripId,
        transportId: 'written-once',
        intent: 'create',
        record: { title: 'Renamed by the second press', mode: 'train' },
        chain: CHAINED,
      })

      const { transports } = await snapshot()
      expect(transports.map((row) => row.title)).toEqual([
        'Renamed by the second press',
      ])
      expect(
        await listTransportLegs(tenant.scope, 'written-once'),
      ).toHaveLength(2)
    })

    /**
     * The row is there when the save reads it and gone when the batch runs: the read is taken
     * from the real table and the other tab's delete lands right after it. The refusal has to be
     * the same one the up-front check gives, not the raw foreign-key failure of the legs.
     */
    describe('when the transport is deleted between the read and the write', () => {
      async function deleteAfterTheRead(transportId: string) {
        const read = transportsRepository.findById
        vi.spyOn(transportsRepository, 'findById').mockImplementationOnce(
          async (scope, id) => {
            const row = await read(scope, id)
            await deleteTransport(scope, transportId)
            return row
          },
        )
      }

      it('answers not-found for a chained edit instead of a foreign-key failure', async () => {
        await seedLinkedTransport('raced')
        await deleteAfterTheRead('raced')

        const error = await captureError(() =>
          saveTransport(tenant.scope, {
            tripId,
            transportId: 'raced',
            intent: 'edit',
            record: { title: 'Saved from tab A', mode: 'train' },
            chain: CHAINED,
          }),
        )

        expect(error).toBeInstanceOf(NotFoundError)
        expect(await leftOver('raced')).toEqual({
          row: null,
          legs: [],
          reservations: 0,
          files: 0,
        })
      })

      it('answers not-found for an unchained edit', async () => {
        await seedLinkedTransport('raced-bare')
        await deleteAfterTheRead('raced-bare')

        const error = await captureError(() =>
          saveTransport(tenant.scope, {
            tripId,
            transportId: 'raced-bare',
            intent: 'edit',
            record: { title: 'Saved from tab A', mode: 'train' },
            chain: NO_CHAIN,
          }),
        )

        expect(error).toBeInstanceOf(NotFoundError)
        expect((await leftOver('raced-bare')).row).toBeNull()
      })
    })
  })

  /**
   * D1 runs a batch as one transaction. A trigger that refuses the second leg stands in for any
   * statement of the batch failing after the record was already written.
   */
  describe('when a statement of the write fails', () => {
    beforeEach(() => {
      harness.sqlite.exec(`
        CREATE TRIGGER refuse_second_leg BEFORE INSERT ON transport_legs
        WHEN NEW.position = 1
        BEGIN SELECT RAISE(ABORT, 'refused'); END
      `)
    })

    it('leaves neither the record nor a leg behind for a new transport', async () => {
      const error = await captureError(() =>
        saveTransport(tenant.scope, {
          tripId,
          transportId: 'doomed',
          intent: 'create',
          record: { title: 'Osaka to Tokyo', mode: 'train' },
          chain: { stations: [OSAKA, NAGOYA, TOKYO], legs: [{}, {}] },
        }),
      )

      expect(error).not.toBeNull()
      expect(await snapshot()).toEqual({ transports: [], legs: [] })
    })

    it('leaves an existing transport and its chain exactly as they were', async () => {
      await saveTransport(tenant.scope, {
        tripId,
        transportId: 'kept',
        intent: 'create',
        record: { title: 'Osaka to Tokyo', mode: 'train' },
        chain: { stations: [OSAKA, TOKYO], legs: [{}] },
      })
      const before = await snapshot()

      const error = await captureError(() =>
        saveTransport(tenant.scope, {
          tripId,
          transportId: 'kept',
          intent: 'edit',
          record: { title: 'Renamed', mode: 'train' },
          chain: { stations: [OSAKA, NAGOYA, TOKYO], legs: [{}, {}] },
        }),
      )

      expect(error).not.toBeNull()
      expect(await snapshot()).toEqual(before)
    })
  })

  describe('a write the repository refuses before it starts', () => {
    it('writes nothing for a leg that lands before it departs', async () => {
      const error = await captureError(() =>
        saveTransport(tenant.scope, {
          tripId,
          transportId: 'inverted-leg',
          intent: 'create',
          record: { title: 'BA 117', mode: 'flight' },
          chain: {
            stations: [LONDON, NEW_YORK],
            legs: [
              {
                departureDate: '2026-04-16',
                departureTime: '09:00',
                arrivalDate: '2026-04-16',
                arrivalTime: '03:00',
              },
            ],
          },
        }),
      )

      expect((error as RepositoryError).code).toBe('TIME_ORDER')
      expect(await snapshot()).toEqual({ transports: [], legs: [] })
    })

    it('judges the record in the zones of its outer stations', async () => {
      const saved = await saveTransport(tenant.scope, {
        tripId,
        transportId: 'westbound',
        intent: 'create',
        record: { title: 'NH 184', mode: 'flight' },
        chain: {
          stations: [TOKYO, HONOLULU],
          legs: [
            {
              departureDate: '2026-04-16',
              departureTime: '21:00',
              arrivalDate: '2026-04-16',
              arrivalTime: '09:00',
            },
          ],
        },
      })

      expect(saved.transport.arrivalTime).toBe('09:00')
    })

    it('writes nothing for a record that lands before it departs', async () => {
      const error = await captureError(() =>
        saveTransport(tenant.scope, {
          tripId,
          transportId: 'inverted-record',
          intent: 'create',
          record: {
            title: 'BA 117',
            mode: 'flight',
            departureDate: '2026-04-16',
            departureTime: '09:00',
            departureTimezone: LONDON.timezone,
            arrivalDate: '2026-04-16',
            arrivalTime: '03:00',
            arrivalTimezone: NEW_YORK.timezone,
          },
          chain: NO_CHAIN,
        }),
      )

      expect((error as RepositoryError).code).toBe('TIME_ORDER')
      expect(await snapshot()).toEqual({ transports: [], legs: [] })
    })

    it('writes nothing for an arrival day before the departure day', async () => {
      const error = await captureError(() =>
        saveTransport(tenant.scope, {
          tripId,
          transportId: 'backwards',
          intent: 'create',
          record: {
            title: 'Backwards',
            mode: 'train',
            dayId: days[2].id,
            arrivalDayId: days[0].id,
          },
          chain: { stations: [OSAKA, TOKYO], legs: [{}] },
        }),
      )

      expect((error as RepositoryError).code).toBe('DAY_ORDER')
      expect(await snapshot()).toEqual({ transports: [], legs: [] })
    })

    it('writes nothing for a leg day that belongs to another trip', async () => {
      const other = await createTrip(tenant.scope, { title: 'Kyushu' })
      const foreignDay = await createDay(tenant.scope, {
        tripId: other.id,
        dayNumber: 1,
      })

      const error = await captureError(() =>
        saveTransport(tenant.scope, {
          tripId,
          transportId: 'cross-trip',
          intent: 'create',
          record: { title: 'Cross-trip', mode: 'train' },
          chain: {
            stations: [OSAKA, TOKYO],
            legs: [{ departureDayId: foreignDay.id }],
          },
        }),
      )

      expect(error).toBeInstanceOf(NotFoundError)
      expect(await snapshot()).toEqual({ transports: [], legs: [] })
    })

    it('writes nothing for a chain that is not N stations and N−1 legs', async () => {
      const error = await captureError(() =>
        saveTransport(tenant.scope, {
          tripId,
          transportId: 'lopsided',
          intent: 'create',
          record: { title: 'Lopsided', mode: 'train' },
          chain: { stations: [OSAKA, NAGOYA, TOKYO], legs: [{}] },
        }),
      )

      expect(error).not.toBeNull()
      expect(await snapshot()).toEqual({ transports: [], legs: [] })
    })
  })

  it('refuses a transport id that belongs to another trip of the same workspace, for either intent', async () => {
    const other = await createTrip(tenant.scope, { title: 'Kyushu' })
    await saveTransport(tenant.scope, {
      tripId: other.id,
      transportId: 'kyushu-ferry',
      intent: 'create',
      record: { title: 'Ferry', mode: 'ferry' },
      chain: NO_CHAIN,
    })

    for (const intent of ['create', 'edit'] as const) {
      const error = await captureError(() =>
        saveTransport(tenant.scope, {
          tripId,
          transportId: 'kyushu-ferry',
          intent,
          record: { title: 'Moved', mode: 'ferry' },
          chain: { stations: [OSAKA, TOKYO], legs: [{}] },
        }),
      )

      expect(error).toBeInstanceOf(NotFoundError)
    }
    expect((await getTransport(tenant.scope, 'kyushu-ferry'))?.title).toBe(
      'Ferry',
    )
    expect(await listTransportLegs(tenant.scope, 'kyushu-ferry')).toEqual([])
  })

  it('refuses a viewer and admits an editor on the same trip', async () => {
    const viewerId = await tenant.addUser('A viewer')
    const editorId = await tenant.addUser('An editor')
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
    const draft = {
      tripId,
      record: { title: 'Osaka to Tokyo', mode: 'train' as const },
      chain: { stations: [OSAKA, TOKYO], legs: [{}] },
    }

    expect(
      await captureError(() =>
        saveTransport(tenant.scopeFor(viewerId), {
          ...draft,
          transportId: 'viewer-draft',
          intent: 'create',
        }),
      ),
    ).toBeInstanceOf(TripRoleError)
    expect(await snapshot()).toEqual({ transports: [], legs: [] })

    const saved = await saveTransport(tenant.scopeFor(editorId), {
      ...draft,
      transportId: 'editor-draft',
      intent: 'create',
    })
    expect(saved.legs).toHaveLength(1)
  })

  /**
   * A found connection is saved by the same writer, so it is one batch as well: the record is no
   * longer written first and the chain second, with a readable row left behind when the second
   * half never lands.
   */
  describe('a found connection saved through the same writer', () => {
    const CONNECTION = {
      mode: 'train' as const,
      title: 'Osaka to Tokyo',
      priceMinor: 14_000,
      currency: 'JPY',
      stations: [OSAKA, NAGOYA, TOKYO],
      legs: [
        { serviceNumber: 'Hikari 500', departureTime: '09:00' },
        { serviceNumber: 'Nozomi 24', arrivalTime: '12:40' },
      ],
    }

    function refuseSecondLeg() {
      harness.sqlite.exec(`
        CREATE TRIGGER refuse_second_leg BEFORE INSERT ON transport_legs
        WHEN NEW.position = 1
        BEGIN SELECT RAISE(ABORT, 'refused'); END
      `)
    }

    it('mints the id on the server and takes the endpoints from the outer stations', async () => {
      const saved = await saveSearchedConnection(tenant.scope, {
        ...CONNECTION,
        tripId,
      })

      expect(saved.transport.id).not.toBe('')
      expect(saved.transport.title).toBe('Osaka to Tokyo')
      expect(saved.transport.status).toBe('pending')
      expect(saved.transport.priceMinor).toBe(14_000)
      expect(saved.transport.currency).toBe('JPY')
      expect(saved.transport.departureName).toBe('Shin-Osaka')
      expect(saved.transport.departureTime).toBe('09:00')
      expect(saved.transport.arrivalName).toBe('Tokyo')
      expect(saved.transport.arrivalTime).toBe('12:40')
      expect(saved.legs).toHaveLength(2)
    })

    it('leaves neither the record nor a leg behind when a statement of the first save fails', async () => {
      refuseSecondLeg()

      const error = await captureError(() =>
        saveSearchedConnection(tenant.scope, { ...CONNECTION, tripId }),
      )

      expect(error).not.toBeNull()
      expect(await snapshot()).toEqual({ transports: [], legs: [] })
    })

    it('leaves a saved journey and its chain as they were when a re-search fails', async () => {
      const first = await saveSearchedConnection(tenant.scope, {
        ...CONNECTION,
        tripId,
        stations: [OSAKA, TOKYO],
        legs: [{ serviceNumber: 'Nozomi 24' }],
      })
      const before = await snapshot()
      refuseSecondLeg()

      const error = await captureError(() =>
        saveSearchedConnection(tenant.scope, {
          ...CONNECTION,
          tripId,
          transportId: first.transport.id,
        }),
      )

      expect(error).not.toBeNull()
      expect(await snapshot()).toEqual(before)
    })

    it('refuses a transport id that names no journey of the caller instead of creating one under it', async () => {
      const error = await captureError(() =>
        saveSearchedConnection(tenant.scope, {
          ...CONNECTION,
          tripId,
          transportId: 'made-up-by-the-client',
        }),
      )

      expect(error).toBeInstanceOf(NotFoundError)
      expect(await snapshot()).toEqual({ transports: [], legs: [] })
    })
  })
})
