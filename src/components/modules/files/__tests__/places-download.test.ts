import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { encodePublicFailure } from '#/lib/errors'
import { downloadTripPlacesFn } from '#/server/fns/places-download'
import { downloadTripPlaces } from '../places-download'

// The real module reaches `cloudflare:workers`; this suite is about what the browser does with
// the response, not about the handler that makes it.
vi.mock('#/server/fns/places-download', () => ({
  downloadTripPlacesFn: vi.fn(),
}))
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
  vi.mocked(downloadTripPlacesFn).mockReset()
  vi.restoreAllMocks()
})

function answer(init: ResponseInit): void {
  vi.mocked(downloadTripPlacesFn).mockResolvedValue(
    new Response('{"type":"FeatureCollection","features":[]}', init),
  )
}

describe('downloadTripPlaces', () => {
  it('saves the file under the name the server gave it', async () => {
    answer({
      headers: {
        'content-disposition':
          "attachment; filename*=UTF-8''lisbon-in-spring-places.geojson",
      },
    })

    const result = await downloadTripPlaces({
      tripId: 'trip-1',
      unavailable: UNAVAILABLE,
    })

    expect(result.filename).toBe('lisbon-in-spring-places.geojson')
    expect(saved).toEqual(['lisbon-in-spring-places.geojson'])
    expect(downloadTripPlacesFn).toHaveBeenCalledWith({
      data: { tripId: 'trip-1' },
    })
  })

  it('falls back to a plain name when the header is missing or cannot be decoded', async () => {
    answer({})
    expect(
      (
        await downloadTripPlaces({
          tripId: 'trip-1',
          unavailable: UNAVAILABLE,
        })
      ).filename,
    ).toBe('trip-places.geojson')

    answer({
      headers: {
        'content-disposition': "attachment; filename*=UTF-8''%E0%A4%A",
      },
    })
    expect(
      (
        await downloadTripPlaces({
          tripId: 'trip-1',
          unavailable: UNAVAILABLE,
        })
      ).filename,
    ).toBe('trip-places.geojson')
  })

  it('throws, and saves nothing, when the answer is not a file', async () => {
    answer({ status: 404 })

    await expect(
      downloadTripPlaces({ tripId: 'trip-1', unavailable: UNAVAILABLE }),
    ).rejects.toThrow(UNAVAILABLE)
    expect(saved).toEqual([])
  })
})

it('localises native network and blob failures rather than showing browser diagnostics', async () => {
  vi.mocked(downloadTripPlacesFn).mockRejectedValueOnce(
    new TypeError('Failed to fetch'),
  )
  await expect(
    downloadTripPlaces({ tripId: 'trip-1', unavailable: UNAVAILABLE }),
  ).rejects.toThrow(UNAVAILABLE)
  const response = new Response('{}')
  vi.spyOn(response, 'blob').mockRejectedValueOnce(
    new TypeError('NetworkError when attempting to fetch resource.'),
  )
  vi.mocked(downloadTripPlacesFn).mockResolvedValueOnce(response)
  await expect(
    downloadTripPlaces({ tripId: 'trip-1', unavailable: UNAVAILABLE }),
  ).rejects.toThrow(UNAVAILABLE)
  expect(saved).toEqual([])
})

it('preserves an intentional structured server refusal', async () => {
  const refusal = new Error(
    encodePublicFailure({
      kind: 'refusal',
      message: 'Ta podróż jest niedostępna.',
    }),
  )
  vi.mocked(downloadTripPlacesFn).mockRejectedValueOnce(refusal)
  await expect(
    downloadTripPlaces({ tripId: 'trip-1', unavailable: UNAVAILABLE }),
  ).rejects.toBe(refusal)
})
