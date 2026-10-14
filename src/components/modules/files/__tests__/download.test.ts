import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { downloadTripFileFn } from '#/server/fns/files'
import { downloadTripFile } from '../download'

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
  it.each(['text/html', 'image/svg+xml'])(
    'hands the object URL a generic binary for a stored %s, so no same-origin URL carries markup',
    async (storedType) => {
      expect((await download(storedType)).type).toBe('application/octet-stream')
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
