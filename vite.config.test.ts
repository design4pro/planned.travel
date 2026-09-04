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
 * `vite.config.ts` reads `process.env.E2E` once, at module evaluation, so a test that cares about
 * it has to stub the environment and re-evaluate the module.
 */
async function devtoolsConfigWith(e2e: string | undefined) {
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
    expect(await devtoolsConfigWith('1')).toEqual({
      consolePiping: { enabled: false },
    })
  })

  it('keeps the plugin default everywhere else, so `pnpm dev` still relays', async () => {
    expect(await devtoolsConfigWith(undefined)).toBeUndefined()
  })

  it('reads the flag exactly, not truthily', async () => {
    expect(await devtoolsConfigWith('0')).toBeUndefined()
    expect(await devtoolsConfigWith('true')).toBeUndefined()
  })
})
