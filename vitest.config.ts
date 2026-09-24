import { availableParallelism } from 'node:os'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import viteReact from '@vitejs/plugin-react'

const src = fileURLToPath(new URL('./src/', import.meta.url))

/**
 * Three projects, because the code under test needs different worlds:
 *
 * - `ui` runs component tests in jsdom with the React plugin.
 * - `server` runs repositories, queue handlers and route handlers in plain
 *   Node. Nothing there may import `cloudflare:workers`; bindings arrive as
 *   arguments, which is what makes them fake-able.
 * - `tooling` runs in plain Node as well, but over the policy that lives
 *   outside `src/**` - the agent tooling under `scripts/**`, and the handful
 *   of files elsewhere that decide how the suite itself behaves.
 *
 * `server` collects `.tsx` as well as `.ts` because the transactional email
 * templates under `src/server/email` are React components: they render to a
 * string on the server and never reach a DOM, so they belong in the Node
 * project rather than in jsdom. Vite's esbuild transform picks up
 * `jsx: react-jsx` from `tsconfig.json`, which is all a server-rendered
 * component needs — the React plugin exists for Fast Refresh, which no test has.
 *
 * `tooling` carries real policy - the Sentry sweep's selection thresholds, dedup index and issue
 * body, the label invariants the sweeper enforces, how `capture.mjs` decides a frame was taken on
 * the screen it was asked for - and its failure mode is silence: a parsing bug files a duplicate every
 * week, or stops filing anything, and says nothing either way. Its `.mjs` files are run by `node`
 * and sit in no tsconfig, so tests are the only gate that reaches all of it.
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^#\/(.*)$/, replacement: `${src}$1` },
      { find: /^@\/(.*)$/, replacement: `${src}$1` },
    ],
  },
  test: {
    // Leave one CPU for the coordinator and cap process pressure on larger hosts.
    // Node 24 reads the container CPU quota through availableParallelism().
    // Two, not four: the 4-vCPU VPS runs several agent gates side by side, and
    // three workers per run pushed it into swap.
    maxWorkers: Math.max(1, Math.min(2, availableParallelism() - 1)),
    projects: [
      {
        extends: true,
        plugins: [viteReact()],
        test: {
          name: 'ui',
          environment: 'jsdom',
          globals: false,
          /**
           * Node's own Web Storage, off, so jsdom's survives.
           *
           * From Node 26 `localStorage` and `sessionStorage` are globals by default, and without
           * `--localstorage-file` both read as `undefined`. Vitest's `populateGlobal` skips any key
           * already present on the global unless it is in its own hard-coded window-key list, which
           * these two are not - so jsdom's real `Storage` objects were never copied and every
           * `window.localStorage.clear()` in `src/lib` and `src/components` threw. CI runs Node 24,
           * where the API is flag-gated and off, so this was red on a developer machine only.
           *
           * The flag rather than a hand-rolled polyfill because the storage has to be jsdom's: the
           * preference tests construct `new StorageEvent('storage', { storageArea: … })`, whose
           * WebIDL conversion refuses anything that is not a jsdom `Storage`. Accepted and inert on
           * Node 22 and 24.
           */
          execArgv: ['--no-experimental-webstorage'],
          setupFiles: ['./vitest.setup.dom.ts'],
          include: [
            'src/components/**/*.test.{ts,tsx}',
            'src/lib/**/*.test.{ts,tsx}',
            // Route-level components — the `-ui/` folders a screen mounts but
            // the router does not route to. They are React and need a DOM, and
            // the `server` project below deliberately collects only `.test.ts`
            // under `src/routes/**`, so without this line a component test here
            // is written, committed, and never run by anything.
            'src/routes/**/*.test.tsx',
          ],
          restoreMocks: true,
        },
      },
      {
        extends: true,
        test: {
          name: 'tooling',
          environment: 'node',
          globals: false,
          include: [
            'scripts/**/__tests__/*.test.{ts,mjs}',
            // `.ai/scripts` is the second home for a script that belongs to the
            // pipeline rather than to the application - the validation gate and the
            // e2e entrypoint live there, and `guard-generated.sh` still refuses a
            // GitHub Actions run any write to them. Their test companions run in
            // the same project as `scripts/ci/__tests__`.
            '.ai/scripts/**/__tests__/*.test.mjs',
            // The e2e helpers that carry policy rather than plumbing. The console
            // classifier decides which browser output fails a run, is pure, and
            // used to be graded from inside a Playwright spec — a browser launch
            // to assert a string against a regular expression. `console-policy.ts`
            // imports nothing, so it runs here for free.
            'e2e/helpers/__tests__/*.test.ts',
            // Build config, for the same reason: `vite.config.ts` decides whether
            // the devtools console relay pipes the Worker's own errors into a
            // watching Playwright spec, and nothing but a test holds that gate
            // shut. It sits at the repo root, so no `src/**` glob reaches it.
            'vite.config.test.ts',
            // And `.oxlintrc.json`, for a narrower version of the same reason: its ignore list
            // is what keeps `pnpm lint` on our own sources, and a wrong entry there is silent
            // until somebody notices a file that was never linted.
            'lint-ignores.test.ts',
            // The Claude Code hooks guard GitHub Actions agent runs against tracker mutations
            // and configuration writes. Their failure mode is silence: a hook that stops matching
            // allows instead of erroring, and nothing anywhere says so.
            '.claude/hooks/__tests__/*.test.ts',
            // `.ai/cezar/config.json` is the run's own settings, and the cockpit's Settings
            // panel writes the same keys: clearing a field there deletes it and the next run
            // silently behaves differently. `.ai/` is a dot-directory, so no glob above reaches
            // it - the path has to be named.
            '.ai/scripts/__tests__/*.test.ts',
          ],
          restoreMocks: true,
        },
      },
      {
        extends: true,
        test: {
          name: 'server',
          environment: 'node',
          globals: false,
          setupFiles: ['./vitest.setup.node.ts'],
          globalSetup: ['./vitest.global-setup.server.ts'],
          include: [
            'src/server/**/*.test.{ts,tsx}',
            'src/routes/**/*.test.ts',
            'src/styles/**/*.test.ts',
          ],
          restoreMocks: true,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text-summary', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        // Generated by `tsr generate`.
        'src/routeTree.gen.ts',
        // Declarative schema and token surfaces: no branches to cover.
        'src/server/db/schema.ts',
        'src/server/db/auth-schema.ts',
        'src/**/*.d.ts',
        'src/**/__tests__/**',
        'src/**/*.test.{ts,tsx}',
      ],
      /**
       * Thresholds are per-glob rather than global: they hold the platform
       * modules that carry protocol logic to a real bar without turning every
       * new UI file into a coverage failure.
       */
      thresholds: {
        'src/routes/api/tiles/-lib/**': {
          statements: 85,
          branches: 85,
          functions: 85,
          lines: 85,
        },
      },
    },
  },
})
