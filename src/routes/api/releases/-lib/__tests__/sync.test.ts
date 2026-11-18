import { expect, it, vi } from 'vitest'
import { serveReleaseSync } from '../sync'

it('requires same-origin JSON and bounds streamed input before invoking the operator module', async () => {
  const run = vi.fn(async () => ({
    operationId: 'one',
    status: 'pending-evidence' as const,
  }))
  const request = (body: string, origin = 'https://app.example.test') =>
    new Request('https://app.example.test/api/releases/sync', {
      method: 'POST',
      headers: { origin, 'content-type': 'application/json' },
      body,
    })
  expect(
    (await serveReleaseSync(request('{}', 'https://evil.test'), run)).status,
  ).toBe(403)
  expect((await serveReleaseSync(request('x'.repeat(17000)), run)).status).toBe(
    413,
  )
  expect((await serveReleaseSync(request('{'), run)).status).toBe(400)
  expect(run).not.toHaveBeenCalled()
  const response = await serveReleaseSync(request('{"operationId":"one"}'), run)
  expect(response.headers.get('cache-control')).toBe('no-store')
  expect(await response.json()).toMatchObject({
    operationId: 'one',
    status: 'pending-evidence',
  })
  expect(run).toHaveBeenCalledExactlyOnceWith({ operationId: 'one' })
})
