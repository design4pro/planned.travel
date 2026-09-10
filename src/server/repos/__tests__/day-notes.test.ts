/**
 * Day notes: the three fields `01-S2b` gave the row, at the repository boundary.
 *
 * The isolation files own "whose day is this?". What is left here is what a note may *hold*: an
 * icon from a fixed vocabulary rather than any short string, a detail that comes back exactly as it
 * was written, and the column default that an omitted icon must still take.
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { DAY_NOTE_ICONS } from '#/components/planner/types'
import type { DayNoteIcon } from '#/components/planner/types'
import {
  createDayNote,
  listDayNotes,
  listTripDays,
  updateDayNote,
} from '../days'
import { createTrip } from '../trips'
import { createHarness } from './harness'
import type { Harness, SeededTenant } from './harness'

describe('day notes', () => {
  let harness: Harness
  let tenant: SeededTenant
  let tripId: string
  let dayId: string

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('alpha')

    const trip = await createTrip(tenant.scope, {
      title: 'Lisbon in spring',
      startDate: '2026-04-10',
      endDate: '2026-04-12',
    })
    const days = await listTripDays(tenant.scope, trip.id)
    const firstDay = days.at(0)
    if (firstDay === undefined) {
      throw new Error('A dated trip must have a day run.')
    }
    tripId = trip.id
    dayId = firstDay.id
  })

  describe('the icon vocabulary', () => {
    it('rejects a name outside the tuple, before any SQL runs', async () => {
      await expect(
        createDayNote(tenant.scope, {
          tripId,
          dayId,
          body: 'Buy the transit pass.',
          // A perfectly good short string, and not one the picker can send.
          icon: 'skull' as unknown as DayNoteIcon,
        }),
      ).rejects.toThrow()

      expect(await listDayNotes(tenant.scope, dayId)).toEqual([])
    })

    it('takes the column default when the icon is omitted', async () => {
      const note = await createDayNote(tenant.scope, {
        tripId,
        dayId,
        body: 'Buy the transit pass.',
      })

      expect(note.icon).toBe('sticky-note')
    })

    it('rejects an explicit null rather than resetting to the default', async () => {
      // The column is `NOT NULL` with a default, so omission is how a caller takes it. Accepting
      // null would make "no icon" a second spelling of the default and put it in the wire format.
      await expect(
        createDayNote(tenant.scope, {
          tripId,
          dayId,
          body: 'Buy the transit pass.',
          icon: null as unknown as DayNoteIcon,
        }),
      ).rejects.toThrow()

      expect(await listDayNotes(tenant.scope, dayId)).toEqual([])
    })

    it('accepts every name the vocabulary ships', async () => {
      for (const icon of DAY_NOTE_ICONS) {
        const note = await createDayNote(tenant.scope, {
          tripId,
          dayId,
          body: `A note wearing ${icon}.`,
          icon,
        })
        expect(note.icon).toBe(icon)
      }

      expect(await listDayNotes(tenant.scope, dayId)).toHaveLength(
        DAY_NOTE_ICONS.length,
      )
    })
  })

  describe('the detail', () => {
    // A rendering decision must never become a storage decision: the markdown module decides what a
    // detail *means*, and the column holds the bytes it was handed.
    const detail = [
      '## The morning',
      '',
      '- 07:00 espresso at *A Brasileira*',
      '- 08:15 tram 28, **north** end',
      '',
      '> Bring coins.',
      '',
      '```',
      '  indented, and left alone',
      '```',
    ].join('\n')

    it('round-trips byte for byte, newlines included', async () => {
      const note = await createDayNote(tenant.scope, {
        tripId,
        dayId,
        body: 'Morning plan',
        detail,
      })

      expect(note.detail).toBe(detail)
      const [stored] = await listDayNotes(tenant.scope, dayId)
      expect(stored.detail).toBe(detail)
    })

    it('is absent by default and clearable to null', async () => {
      const note = await createDayNote(tenant.scope, {
        tripId,
        dayId,
        body: 'Morning plan',
        detail,
      })

      expect(
        await updateDayNote(tenant.scope, note.id, { detail: null }),
      ).toMatchObject({
        detail: null,
      })

      const plain = await createDayNote(tenant.scope, {
        tripId,
        dayId,
        body: 'One line is enough',
      })
      expect(plain.detail).toBeNull()
    })
  })
})
