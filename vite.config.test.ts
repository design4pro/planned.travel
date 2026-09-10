import { afterEach, describe, expect, it, vi } from 'vitest'
import type { TanStackDevtoolsViteConfig } from '@tanstack/devtools-vite'
import type { Plugin, ViteDevServer } from 'vite'

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

/**
 * The names of the plugins `vite.config.ts` produced with `E2E` set to `e2e`.
 *
 * Every mocked factory above returns `[]`, so what survives the flattening is exactly the plugins
 * this file builds itself — which is the question the orphan-exit gate asks.
 */
async function pluginNamesWithE2E(e2e: string | undefined) {
  vi.resetModules()
  vi.stubEnv('E2E', e2e)
  const { default: config } = await import('./vite.config')
  const names: Array<string> = []
  // Hand-rolled rather than `.flat()`: a plugin option nests arrays to an arbitrary depth, and
  // asking the type checker to flatten that recursively is what TS2589 is for.
  const collect = (option: unknown) => {
    if (Array.isArray(option)) {
      option.forEach(collect)
      return
    }
    const name = (option as Plugin | undefined)?.name
    if (name) names.push(name)
  }
  collect(config.plugins)
  return names
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

/**
 * Issue #327: eleven leaked `vite dev` processes had exhausted the 3030-3040 window on the cezar
 * host, and seven of them were serving a worktree that had been deleted out from under them. The
 * gate below is what stops that from accumulating again, and its failure mode is silence — the
 * window narrows one port per orphan, and the first thing anyone sees is an unrelated PR's e2e
 * step failing on a port number.
 */
describe('the dev server that outlives its checkout', () => {
  /** A dev server with the two members the plugin touches, and a `warn` spy to read back. */
  function fakeServer(root: string) {
    const warn = vi.fn()
    return {
      warn,
      server: {
        config: { root, logger: { warn } },
      } as unknown as ViteDevServer,
    }
  }

  async function startedPlugin(
    root: string,
    exists: (path: string) => boolean,
    stop: () => void,
  ) {
    vi.resetModules()
    const { stopWhenRootIsRemoved } = await import('./vite.config')
    const plugin = stopWhenRootIsRemoved({ intervalMs: 1000, exists, stop })
    const { server, warn } = fakeServer(root)
    await (plugin.configureServer as (s: ViteDevServer) => void)(server)
    return { warn }
  }

  afterEach(() => {
    vi.useRealTimers()
  })

  it('stops itself once its root is gone, so the port goes back to the window', async () => {
    vi.useFakeTimers()
    const stop = vi.fn()
    // Present on the first tick, removed by the second: the `git worktree remove` this exists for.
    const exists = vi.fn().mockReturnValueOnce(true).mockReturnValue(false)

    const { warn } = await startedPlugin('/tmp/worktree-327', exists, stop)

    vi.advanceTimersByTime(1000)
    expect(stop).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)
    expect(stop).toHaveBeenCalledTimes(1)
    // Named, because the log line is the only explanation anyone gets for a server that vanished.
    expect(warn.mock.calls[0]?.[0]).toContain('/tmp/worktree-327')

    // And exactly once: the interval is cleared, not left firing at a corpse.
    vi.advanceTimersByTime(10_000)
    expect(stop).toHaveBeenCalledTimes(1)
  })

  it('leaves a server whose checkout is still there alone', async () => {
    vi.useFakeTimers()
    const stop = vi.fn()

    await startedPlugin('/tmp/worktree-327', () => true, stop)

    vi.advanceTimersByTime(60_000)
    expect(stop).not.toHaveBeenCalled()
  })

  it('is installed only under e2e, where a run holds one of the eleven ports', async () => {
    expect(await pluginNamesWithE2E('1')).toContain(
      'planned-travel:stop-when-root-is-removed',
    )
    expect(await pluginNamesWithE2E(undefined)).not.toContain(
      'planned-travel:stop-when-root-is-removed',
    )
  })
})
