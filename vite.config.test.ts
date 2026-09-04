import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TanStackDevtoolsViteConfig } from '@tanstack/devtools-vite'

/**
 * The arguments `vite.config.ts` handed `devtools()` on its last evaluation.
 *
 * Every plugin factory is stubbed away: this asks one question about one call site, and a real
 * `cloudflare()` or `tanstackStart()` would read `wrangler.jsonc`, scan routes and cost seconds
 * to answer none of it.
 */
const devtoolsArgs: Array<TanStackDevtoolsViteConfig | undefined> = []

vi.mock('@tanstack/devtools-vite', () => ({
  devtools: (args?: TanStackDevtoolsViteConfig) => {
    devtoolsArgs.push(args)
    return []
  },
}))
vi.mock('@tanstack/react-start/plugin/vite', () => ({
  tanstackStart: () => [],
}))
vi.mock('@cloudflare/vite-plugin', () => ({ cloudflare: () => [] }))
vi.mock('@tailwindcss/vite', () => ({ default: () => [] }))
vi.mock('@vitejs/plugin-react', () => ({ default: () => [] }))
vi.mock('@sentry/vite-plugin', () => ({ sentryVitePlugin: () => [] }))

/**
 * The argument `devtools()` was handed with `E2E` set to `e2e`.
 *
 * `vite.config.ts` reads `process.env.E2E` once, at module evaluation, so a test that cares about
 * it has to stub the environment and re-evaluate the module.
 *
 * What this pins is the argument, not what the plugin then resolves it to: `undefined` means "no
 * override", and that it leaves the relay on is the plugin's default
 * (`args?.consolePiping ?? { enabled: true }`), not ours to assert.
 */
async function devtoolsArgsWithE2E(e2e: string | undefined) {
  vi.resetModules()
  devtoolsArgs.length = 0
  vi.stubEnv('E2E', e2e)
  await import('./vite.config')
  expect(devtoolsArgs).toHaveLength(1)
  return devtoolsArgs[0]
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('the devtools console relay', () => {
  it('is off under e2e, where it drops the Worker’s own errors into a watching spec', async () => {
    // The whole argument, not just its `consolePiping` key: the gate is the only reason this call
    // site takes an argument at all, so a second option appearing here should be a deliberate act
    // that comes back and says so.
    expect(await devtoolsArgsWithE2E('1')).toEqual({
      consolePiping: { enabled: false },
    })
  })

  it('keeps the plugin default everywhere else, so `pnpm dev` still relays', async () => {
    expect(await devtoolsArgsWithE2E(undefined)).toBeUndefined()
  })

  it('reads the flag exactly, not truthily', async () => {
    expect(await devtoolsArgsWithE2E('0')).toBeUndefined()
    expect(await devtoolsArgsWithE2E('true')).toBeUndefined()
  })
})
