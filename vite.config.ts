import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { cloudflare } from '@cloudflare/vite-plugin'

const config = defineConfig({
  resolve: { tsconfigPaths: true },
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
  ],
})

export default config
