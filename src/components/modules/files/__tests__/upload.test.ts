import { afterEach, expect, it, vi } from 'vitest'
import { uploadFile } from '../upload'

vi.mock('#/server/fns/files', () => ({
  uploadTripFileFn: { url: '/upload' },
}))

afterEach(() => vi.unstubAllGlobals())

it('keeps the authored role refusal from a stale tab upload', async () => {
  const message = 'Only an owner or editor may change this trip.'
  class RequestStub extends EventTarget {
    upload = new EventTarget()
    status = 200
    responseText = JSON.stringify({ ok: false, code: 'forbidden', message })
    open() {}
    setRequestHeader() {}
    send() {
      this.dispatchEvent(new Event('load'))
    }
  }
  vi.stubGlobal('XMLHttpRequest', RequestStub)
  await expect(
    uploadFile({
      tripId: 'trip-1',
      file: new File(['ticket'], 'ticket.pdf', { type: 'application/pdf' }),
    }),
  ).resolves.toEqual({ ok: false, code: 'forbidden', message })
})
