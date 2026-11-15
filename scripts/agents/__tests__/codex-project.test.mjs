import { execFileSync } from 'node:child_process'
import { it, expect } from 'vitest'

it('isolates Codex state, worktrees, arguments and skill sources', () => {
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
        env: { ...process.env, PYTHONDONTWRITEBYTECODE: '1' },
      },
    ),
  ).not.toThrow()
}, 35_000)
