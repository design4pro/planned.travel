import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createTranslator, loadCatalogue } from '#/lib/i18n'
import { downloadTripFileFn } from '#/server/fns/files'
import { downloadTripFile, fetchTripFileBytes } from '../download'

// The real module reaches `cloudflare:workers`; this suite is about what the browser does with
// the response, not about the handler that makes it.
vi.mock('#/server/fns/files', () => ({ downloadTripFileFn: vi.fn() }))

const EN = createTranslator('en', await loadCatalogue('en'))

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
  const response = new Response('bytes', {
    headers: { 'content-type': storedType },
  })
  // Match the browser, where the Response blob and the save Blob share a realm.
  vi.spyOn(response, 'blob').mockResolvedValue(
    new Blob(['bytes'], { type: storedType }),
  )
  vi.mocked(downloadTripFileFn).mockResolvedValue(response)
  await downloadTripFile(INPUT, EN)
  const [blob] = blobs
  if (blob === undefined) {
    throw new Error('No object URL was made.')
  }
  return blob
}

describe('downloadTripFile', () => {
  it.each([
    [404, '{"error":"That file is not on this trip."}', 'missingTripFile'],
    [
      410,
      '{"error":"The stored copy of this file is missing."}',
      'missingCopy',
    ],
    [404, '{"error":"internal details"}', 'downloadFailed'],
    [502, '{"error":42}', 'downloadFailed'],
    [502, '<html>internal details</html>', 'downloadFailed'],
  ] as const)('localizes HTTP %s with body %s', async (status, body, key) => {
    const t = createTranslator('pl', await loadCatalogue('pl'))
    vi.mocked(downloadTripFileFn).mockResolvedValue(
      new Response(body, { status }),
    )
    await expect(downloadTripFile(INPUT, t)).rejects.toMatchObject({
      status,
      message: t(`modules.files.error.${key}`, { status }),
    })
    expect(blobs).toEqual([])
  })

  it('localizes an unexpected result', async () => {
    const t = createTranslator('pl', await loadCatalogue('pl'))
    vi.mocked(downloadTripFileFn).mockResolvedValue({} as Response)
    await expect(downloadTripFile(INPUT, t)).rejects.toThrow(
      t('modules.files.error.downloadShape'),
    )
  })

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
    expect(await downloadTripFile(INPUT, EN)).toEqual({
      filename: INPUT.filename,
    })
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
