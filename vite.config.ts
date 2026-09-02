import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'
import { sentryVitePlugin } from '@sentry/vite-plugin'

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

const config = defineConfig({
  resolve: { tsconfigPaths: true },
  build: { sourcemap: uploadsSourceMaps ? 'hidden' : false },
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
    devtools(),
    cloudflare({ viteEnvironment: { name: 'ssr' } }),
    tailwindcss(),
    tanstackStart(),
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
