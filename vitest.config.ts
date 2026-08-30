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
 * - `tooling` runs the agent tooling in plain Node as well, but over
 *   `.sandcastle/**` and `scripts/**` rather than `src/**`.
 *
 * `server` collects `.tsx` as well as `.ts` because the transactional email
 * templates under `src/server/email` are React components: they render to a
 * string on the server and never reach a DOM, so they belong in the Node
 * project rather than in jsdom. Vite's esbuild transform picks up
 * `jsx: react-jsx` from `tsconfig.json`, which is all a server-rendered
 * component needs — the React plugin exists for Fast Refresh, which no test has.
 *
 * `tooling` is one project for two directories because it is one world. None of that code was
 * tested at all before the Sentry sweep, it carries real policy - selection thresholds, the dedup
 * index, the issue body, which screens `capture.mjs` refuses to photograph signed in - and its
 * failure mode is silence: a parsing bug files a duplicate every week, or stops filing anything,
 * and says nothing either way. `pnpm typecheck` sees `.sandcastle` but not `scripts`, whose files
 * are plain `.mjs` run by `node` and so in no tsconfig, while the claim they make about
 * `src/routes/` drifts. Tests are the only gate that reaches all of it.
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^#\/(.*)$/, replacement: `${src}$1` },
      { find: /^@\/(.*)$/, replacement: `${src}$1` },
    ],
  },
  test: {
    projects: [
      {
        extends: true,
        plugins: [viteReact()],
        test: {
          name: 'ui',
          environment: 'jsdom',
          /**
           * A shared worker, and a jsdom built once inside it rather than once per file.
           *
           * This project is two thirds of the suite's CPU, and almost none of that is the
           * assertions: a hundred and nine files each stood up a fresh jsdom, and on the two-vCPU
           * runner the gate is CPU-bound, so that fixed cost *is* the wall clock. Measured over
           * the whole project: 137 CPU-seconds as it was, 117 on `threads` alone, 53 with both -
           * a 61% cut, and the same 106 passing files either way.
           *
           * `threads` is set here and not in the other two projects because it is not a general
           * improvement: `server` measured *worse* on threads (65 CPU-seconds against 86), and
           * `tooling` is small enough that neither shows.
           *
           * `isolate: false` is the half with a price, and it is a standing one. Files in this
           * project now share a module registry and a DOM, so a test that leaves `document`,
           * `window` or a module-level singleton dirty can fail its neighbour instead of itself.
           * `restoreMocks` handles spies and nothing else. It is switched on here only because
           * this project measured clean; `server` did not - `isolate: false` there fails eleven
           * assertions in `src/server/billing/__tests__/mapping.test.ts`, which is real leakage
           * and the reason this is a per-project setting rather than a top-level one.
           */
          pool: 'threads',
          isolate: false,
          globals: false,
          setupFiles: ['./vitest.setup.dom.ts'],
          include: [
            'src/components/**/*.test.{ts,tsx}',
            'src/lib/**/*.test.{ts,tsx}',
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
            '.sandcastle/**/__tests__/*.test.ts',
            'scripts/**/__tests__/*.test.mjs',
          ],
          /**
           * The loop creates full git worktrees under `.sandcastle/worktrees/`, each a copy of this
           * checkout - the same hazard `vite.config.ts` describes for the dev server's watcher.
           * Collecting them would run every one of these tests once per worktree.
           */
          exclude: ['.sandcastle/worktrees/**', '.sandcastle/logs/**'],
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
