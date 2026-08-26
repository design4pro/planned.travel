// Smoke-test of the sandbox e2e path — setup-e2e.sh, Playwright, tiles from
// the local R2 sim. Verification only; nothing is committed.
//
//   pnpm exec tsx .sandcastle/e2e-smoke/e2e-smoke.ts
//
// Mirrors the loop's sandbox configuration (install hook + node_modules and
// .e2e-tiles copied from the host) so a green run here means the real
// implementer sandboxes can run Playwright the same way.

import * as sandcastle from '@ai-hero/sandcastle'
import { docker } from '@ai-hero/sandcastle/sandboxes/docker'

const result = await sandcastle.run({
  sandbox: docker(),
  name: 'e2e-smoke',
  maxIterations: 1,
  agent: sandcastle.claudeCode('claude-opus-5'),
  promptFile: './.sandcastle/e2e-smoke/prompt.md',
  hooks: {
    sandbox: {
      onSandboxReady: [{ command: 'pnpm install --frozen-lockfile' }],
    },
  },
  copyToWorktree: ['node_modules', '.e2e-tiles'],
})

const smoke = result.stdout.match(/<smoke>([\s\S]*?)<\/smoke>/)?.[1]

if (smoke === undefined) {
  console.error('No <smoke> block found in agent output. Full stdout follows:')
  console.error(result.stdout)
  process.exit(1)
}

console.log(smoke.trim())
