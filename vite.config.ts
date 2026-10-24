import { existsSync } from 'node:fs'
import { relative } from 'node:path'

import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { sentryVitePlugin } from '@sentry/vite-plugin'

import { FIXTURE_DAY } from './e2e/fixture-day'

/**
 * Source maps exist only for the build that is going to upload them.
 *
 * Sentry needs real maps to turn a bundled frame into a `src/` file and line, and without that the
 * error reports are worth very little. But a map that ships is the application's source published
 * to anyone who asks, so this build generates them only when it also has somewhere to send them,
 * emits them as `'hidden'` (no `sourceMappingURL` comment, so no browser ever requests one), and
 * has the plugin delete them again once the upload succeeds. A local `pnpm build` has no token,
 * generates nothing, and therefore cannot leak anything through `pnpm deploy`.
 *
 * Sentry resolves a frame through the debug id it injects into the bundle, not through the
 * comment, so `'hidden'` costs it nothing.
 */
const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN
const uploadsSourceMaps =
  sentryAuthToken !== undefined && sentryAuthToken !== ''

/**
 * The devtools console relay is a developer affordance, and under Playwright it is a hazard.
 *
 * `consolePiping` streams the Worker's own console output into whatever browser page is attached,
 * prefixed `%c[Server]%c`. A seeded sign-up's auth email dead-letters under e2e (`EMAIL_API_KEY` is
 * never set there), `logger.error` writes two `console.error` lines, and the relay drops them into
 * whichever spec happens to have a page open at that moment - where `classifyConsoleMessage()`
 * fails the run on someone else's background error. Which spec catches it is a lottery, so the red
 * moves from run to run.
 *
 * Off under e2e, plugin default (`enabled: true`) everywhere else, so `pnpm dev` keeps the relay.
 */
const isE2E = process.env.E2E === '1'

/**
 * The day an e2e build believes it is, folded in at compile time (`src/server/clock.ts`).
 *
 * CI serves the browser suite from a build, where the `x-pt-server-today` header branch is gone
 * by design. With `E2E_BUILD` unset this emits the literal `undefined` and the branch leaves the
 * bundle, so a deployed Worker still has no way to be told what day it is.
 */
const isE2EBuild = process.env.E2E_BUILD === '1'
const e2eServerToday = isE2EBuild ? JSON.stringify(FIXTURE_DAY) : 'undefined'

/**
 * Server-function ids an e2e build can be read by, in the dev server's own shape.
 *
 * A build names each function by a SHA-256 of its entry; `callsServerFn` in
 * `e2e/helpers/server-fn.ts` finds a call by decoding the function's name out of its URL, which
 * only the dev-server id carries. Only for `E2E_BUILD=1`: the deployed bundle keeps the hashes,
 * and `pnpm build`'s manifest check (`scripts/check-server-fn-manifest.mjs`) keeps reading them.
 */
function readableServerFnId({
  filename,
  functionName,
}: {
  filename: string
  functionName: string
}): string {
  const file = relative(import.meta.dirname, filename)
  return Buffer.from(JSON.stringify({ file, export: functionName })).toString(
    'base64url',
  )
}

/**
 * An automated dev server outlives the checkout it was started for, and the port window is finite.
 *
 * `.ai/scripts/test-env-up.sh` starts this server with `nohup` on a port from 3030-3040 — the only
 * range `playwright.config.ts` accepts outside CI — and deliberately leaves it running so the next
 * step of the same run reuses it. Nothing then ties its lifetime to the checkout: when the run's
 * worktree is removed (`git worktree remove`, or an `om-*` skill deleting its scratch directory),
 * the process keeps its deleted working directory open and keeps the port for as long as the host
 * is up. Eleven such orphans exhaust the window, and from then on every run's e2e gate on that
 * host fails with "no free port in 3030-3040" whatever branch it is testing (issue #327).
 *
 * So the server watches for its own root disappearing and shuts itself down the way
 * `test-env-down.sh` would: `SIGTERM` to itself, which is the signal Vite's CLI already handles by
 * closing the server — and, through it, the workerd children the Cloudflare plugin spawned. A
 * `process.exit()` here would leave those behind.
 *
 * Only under `E2E=1`, which is to say only for a server an automated run started: a human running
 * `pnpm dev` sits on port 3000, exhausts nothing, and should not have their editor's file
 * shuffling decide when their server stops.
 *
 * `exists` and `stop` are injected so the gate can be graded without deleting a directory or
 * signalling the test runner; nothing but the test passes them.
 */
export function stopWhenRootIsRemoved({
  intervalMs = 30_000,
  exists = existsSync,
  stop = () => process.kill(process.pid, 'SIGTERM'),
}: {
  intervalMs?: number
  exists?: (path: string) => boolean
  stop?: () => void
} = {}): Plugin {
  return {
    name: 'planned-travel:stop-when-root-is-removed',
    apply: 'serve',
    configureServer(server) {
      const root = server.config.root
      const timer = setInterval(() => {
        if (exists(root)) return
        clearInterval(timer)
        server.config.logger.warn(
          `[stop-when-root-is-removed] ${root} no longer exists; stopping the dev server so it stops holding its port.`,
        )
        stop()
      }, intervalMs)
      // The HTTP server keeps the loop alive on its own; this timer should never be the reason
      // the process lingers.
      timer.unref()
      // A restart is not a new process: `configureServer` runs again, with a fresh plugin
      // instance, every time Vite restarts in place — and `@cloudflare/vite-plugin` restarts on
      // an edit to `wrangler.jsonc` or `.dev.vars`, both ordinary surface under automation. The
      // timer belongs to the server that installed it, so a restart that leaves it running stacks
      // one more poller on the same root; when that root then goes away they each `stop()`, and
      // the second `SIGTERM` lands after Vite's own `process.once('SIGTERM')` handler has already
      // torn itself down — killing the process outright and orphaning the workerd children this
      // whole plugin exists to take down cleanly.
      server.httpServer?.once('close', () => clearInterval(timer))
    },
  }
}

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  build: { sourcemap: uploadsSourceMaps ? 'hidden' : false },
  define: { __E2E_SERVER_TODAY__: e2eServerToday },
  /**
   * `.claude/` sits inside the repo root, and `.claude/worktrees/` holds full git worktrees —
   * 3.2 GB and ~95k files at the time of writing, including another checkout's `node_modules`
   * and its Playwright reports. Chokidar walks all of it, and every file that checkout's test
   * runs write comes back to us as a page reload; the dev server then churns until it dies,
   * which it did repeatedly with exit code 144. None of it is application source, so none of
   * it should reach the watcher.
   */
  server: {
    watch: {
      ignored: [
        '**/.claude/**',
        '**/.ai/cezar/**',
        '**/.agent/**',
        '**/playwright-report/**',
        '**/test-results/**',
      ],
    },
  },
  plugins: [
    devtools(isE2E ? { consolePiping: { enabled: false } } : undefined),
    ...(isE2E ? [stopWhenRootIsRemoved()] : []),
    /**
     * `remoteBindings: false` keeps `vite dev` credential-free, and that is a requirement
     * rather than a preference: `.github/actions/e2e-env` boots this very server on a runner
     * that holds no Cloudflare login, and so does a contributor who has cloned the repo and
     * not run `wrangler login`.
     *
     * The plugin opens a remote proxy session for every binding whose *type* has no local
     * simulator, whatever the binding's own `remote` flag says - and `wrangler.jsonc` now
     * declares `AI`, which is exactly such a type. Left on, the session is opened at boot and
     * the plugin aborts with "necessary to set a CLOUDFLARE_API_TOKEN" before a single route
     * is served. Nothing calls `AI` yet (`src/server/ai/bindings.ts` is the whole surface), so
     * the proxy buys nothing today and costs every credential-free boot.
     *
     * This is a dev-server switch and nothing else: a deployed Worker always talks to the real
     * service. The stage that adds the first `AI` caller is the one that has to decide how it
     * is exercised locally, and can turn this back on for itself.
     */
    cloudflare({ viteEnvironment: { name: 'ssr' }, remoteBindings: false }),
    tailwindcss(),
    tanstackStart(
      isE2EBuild
        ? { serverFns: { generateFunctionId: readableServerFnId } }
        : undefined,
    ),
    viteReact(),
    // Last on purpose: it reads the bundle other plugins produced, so it has to run after them.
    // Inert without a token - `disable` short-circuits it before it looks for anything to upload.
    sentryVitePlugin({
      disable: !uploadsSourceMaps,
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: sentryAuthToken,
      telemetry: false,
      sourcemaps: {
        // Only the client maps. `dist/client` is served as static assets, so a map left there is
        // the front end's source published to anyone who asks. `dist/server` is not served - it is
        // the Worker bundle - and wrangler's own `upload_source_maps` wants those maps so the
        // Cloudflare dashboard can un-minify a stack too. Deleting both would quietly take that away.
        filesToDeleteAfterUpload: ['./dist/client/**/*.map'],
      },
      // The plugin's default is to log an upload failure and let the build succeed. That is the
      // wrong default here: the expected failure is an expired or mis-scoped token, which is
      // permanent, and it would ship a release whose every future stack trace is unreadable while
      // the deploy stays green. Fail instead, loudly.
      //
      // The cost is that a Sentry outage blocks a deploy. If that ever bites during an incident,
      // the lever is one line - drop this handler, or unset SENTRY_AUTH_TOKEN for that run.
      errorHandler: (error) => {
        throw error
      },
    }),
  ],
})

export default config
