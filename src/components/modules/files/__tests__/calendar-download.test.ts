import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { downloadTripIcsFn } from '#/server/fns/calendar'
import { downloadTripCalendar } from '../calendar-download'

// The real module reaches `cloudflare:workers`; this suite is about what the browser does with
// the response, not about the handler that makes it.
vi.mock('#/server/fns/calendar', () => ({ downloadTripIcsFn: vi.fn() }))
// `saveBlob` lives beside the attachment download, which imports its own server function.
vi.mock('#/server/fns/files', () => ({ downloadTripFileFn: vi.fn() }))

const UNAVAILABLE = 'Nie udało się przygotować pliku.'

let saved: Array<string>

beforeEach(() => {
  saved = []
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: () => 'blob:test',
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: () => {},
  })
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
    this: HTMLAnchorElement,
  ) {
    saved.push(this.download)
  })
})

afterEach(() => {
  vi.mocked(downloadTripIcsFn).mockReset()
  vi.restoreAllMocks()
})

function answer(init: ResponseInit): void {
  vi.mocked(downloadTripIcsFn).mockResolvedValue(
    new Response('BEGIN:VCALENDAR', init),
  )
}

describe('downloadTripCalendar', () => {
  it('saves the file under the name the server gave it', async () => {
    answer({
      headers: {
        'content-disposition':
          "attachment; filename*=UTF-8''lisbon-in-spring.ics",
      },
    })

    const result = await downloadTripCalendar({
      tripId: 'trip-1',
      unavailable: UNAVAILABLE,
    })

    expect(result.filename).toBe('lisbon-in-spring.ics')
    expect(saved).toEqual(['lisbon-in-spring.ics'])
    expect(downloadTripIcsFn).toHaveBeenCalledWith({
      data: { tripId: 'trip-1' },
    })
  })

  it('falls back to a plain name when the header is missing or cannot be decoded', async () => {
    answer({})
    expect(
      (
        await downloadTripCalendar({
          tripId: 'trip-1',
          unavailable: UNAVAILABLE,
        })
      ).filename,
    ).toBe('trip.ics')

    answer({
      headers: {
        'content-disposition': "attachment; filename*=UTF-8''%E0%A4%A",
      },
    })
    expect(
      (
        await downloadTripCalendar({
          tripId: 'trip-1',
          unavailable: UNAVAILABLE,
        })
      ).filename,
    ).toBe('trip.ics')
  })

  it('throws, and saves nothing, when the answer is not a file', async () => {
    answer({ status: 404 })

    await expect(
      downloadTripCalendar({ tripId: 'trip-1', unavailable: UNAVAILABLE }),
    ).rejects.toThrow(UNAVAILABLE)
    expect(saved).toEqual([])
  })
})
