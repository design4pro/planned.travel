import type { E2EConfig } from 'e2e'
import { web } from '@e2e-dev/web'
import { openrouter } from '@openrouter/ai-sdk-provider'

export default {
  // OpenRouter reads OPENROUTER_API_KEY from the environment; the key never lives in the repository.
  agents: {
    default: {
      model: openrouter('openai/gpt-6-luna-fast'),
      system: 'You are a thorough QA agent. Verify every outcome.',
    },
  },
  targets: [
    {
      engine: web(),
      app: {
        // Port 0 asks the run for a free port, so parallel tasks never collide.
        url: 'http://127.0.0.1:0',
        command: {
          executable: 'pnpm',
          // `pnpm dev` hardcodes --port 3000, so call vite directly.
          args: [
            'exec',
            'vite',
            'dev',
            '--host',
            '127.0.0.1',
            '--port',
            '{port}',
            '--strictPort',
          ],
          // E2E=1 turns off the devtools console relay and makes the server stop when its worktree is removed (vite.config.ts).
          env: { PORT: '{port}', E2E: '1' },
          // Vite plus the Cloudflare plugin (workerd) is slow on a cold start.
          startupTimeout: 180_000,
        },
      },
    },
  ],
} satisfies E2EConfig
