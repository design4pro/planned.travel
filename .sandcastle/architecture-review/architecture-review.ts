// One-shot architecture review — analysis only, no commits.
//
//   pnpm exec tsx .sandcastle/architecture-review/architecture-review.ts
//
// Runs a single agent over a fresh worktree and prints the <report> block.
// Sandbox: noSandbox() so the host's Claude CLI auth is used (the docker()
// path needs CLAUDE_CODE_OAUTH_TOKEN / ANTHROPIC_API_KEY in .sandcastle/.env).

import * as sandcastle from '@ai-hero/sandcastle'
import { noSandbox } from '@ai-hero/sandcastle/sandboxes/no-sandbox'

const result = await sandcastle.run({
  sandbox: noSandbox(),
  name: 'architecture-review',
  maxIterations: 1,
  agent: sandcastle.claudeCode('claude-opus-5'),
  promptFile: './.sandcastle/architecture-review/prompt.md',
})

const report = result.stdout.match(/<report>([\s\S]*?)<\/report>/)?.[1]

if (report === undefined) {
  console.error('No <report> block found in agent output. Full stdout follows:')
  console.error(result.stdout)
  process.exit(1)
}

console.log(report.trim())
