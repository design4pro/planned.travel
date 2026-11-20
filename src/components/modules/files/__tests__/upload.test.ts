import { afterEach, expect, it, vi } from 'vitest'
import { uploadFile } from '../upload'

vi.mock('#/server/fns/files', () => ({
  uploadTripFileFn: { url: '/upload' },
}))

afterEach(() => vi.unstubAllGlobals())

it('keeps the authored role refusal from a stale tab upload', async () => {
  const message =
    'A viewer may not change this trip; requires one of: owner, editor.'
  class RequestStub extends EventTarget {
    upload = new EventTarget()
    status = 200
    responseText = JSON.stringify({ ok: false, code: 'FORBIDDEN', message })
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
  ).resolves.toEqual({ ok: false, code: 'FORBIDDEN', message })
})

it('aborts the pending XHR when its caller cancels', async () => {
  const abort = vi.fn()
  class RequestStub extends EventTarget {
    upload = new EventTarget()
    open() {}
    setRequestHeader() {}
    send() {}
    abort() {
      abort()
      this.dispatchEvent(new Event('abort'))
    }
  }
  vi.stubGlobal('XMLHttpRequest', RequestStub)
  const controller = new AbortController()
  const pending = uploadFile({
    tripId: 'trip-1',
    file: new File(['cover'], 'cover.png', { type: 'image/png' }),
    signal: controller.signal,
  })
  controller.abort()
  await expect(pending).resolves.toMatchObject({ ok: false, code: 'aborted' })
  expect(abort).toHaveBeenCalledOnce()
})
