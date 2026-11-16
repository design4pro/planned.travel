import { execFileSync } from 'node:child_process'
import { it, expect } from 'vitest'

it.each(['normal', 'inherited-hook'])(
  'isolates Codex state, worktrees, arguments and skill sources: %s',
  (context) => {
    const env = { ...process.env, PYTHONDONTWRITEBYTECODE: '1' }
    if (context === 'inherited-hook') {
      env.GIT_DIR = '/nonexistent/parent-hook.git'
      env.GIT_COMMON_DIR = '/nonexistent/parent-common.git'
      env.GIT_INDEX_FILE = '/nonexistent/parent-hook.index'
    }
    // Hook repository paths must never redirect fixture Git commands into the parent checkout.
    for (const name of execFileSync('git', ['rev-parse', '--local-env-vars'], {
      encoding: 'utf8',
    })
      .trim()
      .split('\n'))
      delete env[name]
    expect(() =>
      execFileSync(
        'python3',
        [
          '-m',
          'unittest',
          'discover',
          '-s',
          'scripts/agents/__tests__',
          '-p',
          '*_test.py',
        ],
        {
          cwd: process.cwd(),
          stdio: 'pipe',
          timeout: 30_000,
          env,
        },
      ),
    ).not.toThrow()
  },
  35_000,
)
