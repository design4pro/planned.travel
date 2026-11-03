import { AsyncLocalStorage } from 'node:async_hooks'
import { requestHandler } from '@tanstack/react-start/server'
import { beforeEach, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  scope: vi.fn(),
  rates: vi.fn(),
  cache: { get: vi.fn(), put: vi.fn() },
  outbound: vi.fn(),
}))
vi.mock('../context', () => ({ appScope: mocks.scope }))
vi.mock('cloudflare:workers', () => ({ env: { KV: mocks.cache } }))
vi.mock('#/server/metering/bindings', () => ({
  requestOutboundRuntime: mocks.outbound,
}))
vi.mock('#/server/rates/public-rates', () => ({ getPublicRates: mocks.rates }))
const { getPublicRatesFn, publicRatesInput } = await import('../public-rates')
async function call(data: unknown) {
  const key = Symbol.for('tanstack-start:start-storage-context')
  const globals = globalThis as Record<symbol, unknown>
  globals[key] ??= new AsyncLocalStorage()
  const storage = globals[key] as AsyncLocalStorage<{
    startOptions: Record<string, never>
    request: Request
  }>
  const request = new Request('https://app.example/_serverFn/rates', {
    method: 'POST',
  })
  return requestHandler(async () => {
    await storage.run({ startOptions: {}, request }, () =>
      getPublicRatesFn({ data: data as { refresh?: boolean } }),
    )
    return new Response(null, { status: 204 })
  })(request, {})
}
beforeEach(() => {
  vi.clearAllMocks()
  mocks.scope.mockResolvedValue({ ctx: { organizationId: 'server-workspace' } })
  mocks.rates.mockResolvedValue({ status: 'unavailable', reason: 'expired' })
})
it.each(['anonymous', 'expired', 'removed-member', 'stale-workspace'])(
  'refuses %s before touching cache or metering',
  async (reason) => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      mocks.scope.mockRejectedValue(new Error(reason))
      expect((await call({})).status).toBe(500)
      expect(mocks.rates).not.toHaveBeenCalled()
      expect(mocks.outbound).not.toHaveBeenCalled()
      expect(mocks.cache.get).not.toHaveBeenCalled()
    } finally {
      quiet.mockRestore()
    }
  },
)
it('refuses caller attribution and unknown input fields at the wire schema', () => {
  expect(() =>
    publicRatesInput.parse({ organizationId: 'foreign', amount: 100 }),
  ).toThrow()
  expect(() => publicRatesInput.parse({ refresh: 'yes' })).toThrow()
})
it('takes attribution only from the current authenticated scope', async () => {
  await call({ refresh: true })
  expect(mocks.rates).toHaveBeenCalledWith(
    expect.objectContaining({ cache: mocks.cache }),
    'server-workspace',
    true,
  )
})
