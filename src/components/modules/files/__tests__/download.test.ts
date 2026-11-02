import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { downloadTripFileFn } from '#/server/fns/files'
import { downloadTripFile, fetchTripFileBytes } from '../download'

// The real module reaches `cloudflare:workers`; this suite is about what the browser does with
// the response, not about the handler that makes it.
vi.mock('#/server/fns/files', () => ({ downloadTripFileFn: vi.fn() }))

const INPUT = { tripId: 'trip-1', fileId: 'file-1', filename: 'saved-file' }

/** The blobs `URL.createObjectURL` was handed, in call order. */
let blobs: Array<Blob>

beforeEach(() => {
  blobs = []
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    value: (blob: Blob) => {
      blobs.push(blob)
      return 'blob:test'
    },
  })
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    value: () => {},
  })
  // jsdom does not implement navigation, and a click on the synthetic link is not what is asserted.
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

afterEach(() => {
  vi.mocked(downloadTripFileFn).mockReset()
})

async function download(storedType: string): Promise<Blob> {
  vi.mocked(downloadTripFileFn).mockResolvedValue(
    new Response('bytes', { headers: { 'content-type': storedType } }),
  )
  await downloadTripFile(INPUT)
  const [blob] = blobs
  if (blob === undefined) {
    throw new Error('No object URL was made.')
  }
  return blob
}

describe('downloadTripFile', () => {
  it.each([
    'text/html',
    'image/svg+xml',
    'application/gpx+xml',
    'application/gpx+xml; charset=utf-8',
  ])(
    'hands the object URL a generic binary for a stored %s, so no same-origin URL carries markup',
    async (storedType) => {
      const blob = await download(storedType)
      expect(blob.type).toBe('application/octet-stream')
      expect(await blob.text()).toBe('bytes')
    },
  )

  it.each(['application/vnd.apple.pkpass', 'application/pdf'])(
    'leaves a stored %s as it is',
    async (storedType) => {
      expect((await download(storedType)).type).toBe(storedType)
    },
  )

  it('keeps the bytes whatever the type it hands over', async () => {
    expect(await (await download('text/html')).text()).toBe('bytes')
  })
})

describe('fetchTripFileBytes', () => {
  it('returns original SVG bytes without saving or creating a URL', async () => {
    vi.mocked(downloadTripFileFn).mockResolvedValue(
      new Response('<svg/>', { headers: { 'content-type': 'image/svg+xml' } }),
    )
    const blob = await fetchTripFileBytes(INPUT)
    expect(blob.type).toBe('image/svg+xml')
    expect(await blob.text()).toBe('<svg/>')
    expect(blobs).toEqual([])
    expect(HTMLAnchorElement.prototype.click).not.toHaveBeenCalled()
  })
  it('preserves the missing-object status', async () => {
    vi.mocked(downloadTripFileFn).mockResolvedValue(
      new Response('{}', { status: 410 }),
    )
    await expect(fetchTripFileBytes(INPUT)).rejects.toMatchObject({
      status: 410,
    })
  })
  it('keeps the real filename and return value when saving', async () => {
    vi.mocked(downloadTripFileFn).mockResolvedValue(new Response('bytes'))
    let filename = ''
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      filename = this.download
    })
    expect(await downloadTripFile(INPUT)).toEqual({ filename: INPUT.filename })
    expect(filename).toBe(INPUT.filename)
  })
})

it('keeps a saved URL alive until the browser has consumed the click', async () => {
  vi.useFakeTimers()
  const revoke = vi.spyOn(URL, 'revokeObjectURL')
  try {
    await download('application/pdf')
    expect(revoke).not.toHaveBeenCalled()
    vi.advanceTimersByTime(60_000)
    expect(revoke).toHaveBeenCalledWith('blob:test')
  } finally {
    vi.useRealTimers()
  }
})
