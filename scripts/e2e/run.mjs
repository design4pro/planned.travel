#!/usr/bin/env node
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

/** Run both required suites sequentially, even if the first finds a regression. */
export async function runSuites(run = execute) {
  const native = await run(['exec', 'e2e', 'run'])
  const browser = await run([
    'exec',
    'e2e',
    'run',
    '--config',
    'e2e.browser.config.ts',
  ])
  return native || browser
}

function execute(args) {
  return new Promise((resolve) => {
    const child = spawn('pnpm', args, { stdio: 'inherit' })
    child.once('error', () => resolve(1))
    child.once('exit', (code, signal) => resolve(signal ? 1 : (code ?? 1)))
  })
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length > 2) {
    console.error(
      'Use pnpm e2e:native <e2e flags> or pnpm e2e:browser <e2e flags> for a filtered run.',
    )
    process.exitCode = 2
  } else {
    process.exitCode = await runSuites()
  }
}
