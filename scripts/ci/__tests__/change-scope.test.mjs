/**
 * `scope` decides whether the e2e shards run on a pull request, and its failure mode is silence: a
 * pattern that matches too much skips the journeys on a change that breaks a screen, and nothing
 * goes red. So the cases that matter most are the ones that must still run them.
 */

import { describe, expect, it } from 'vitest'

import { scope } from '../change-scope.mjs'

describe('scope', () => {
  it('skips the journeys for a spec pull request (PR #518)', () => {
    const { e2e, reason } = scope([
      '.ai/specs/2026-09-15-reveal-code-in-place.md',
      '.ai/specs/README.md',
    ])
    expect(e2e).toBe(false)
    expect(reason).toContain('2')
  })

  it.each([
    'docs/adr/0020-something.md',
    'docs/plans/diagram.svg',
    '.ai/cezar/config.json',
    '.claude/skills/verifying-changes/SKILL.md',
    'CONTEXT.md',
    'scripts/worktree/README.md',
  ])('treats %s as documentation', (path) => {
    expect(scope([path]).e2e).toBe(false)
  })

  it.each([
    'src/routes/index.tsx',
    'e2e/journeys.spec.ts',
    'public/robots.txt',
    'package.json',
    'pnpm-lock.yaml',
    'wrangler.jsonc',
    'drizzle/0042_x.sql',
    '.github/workflows/ci.yml',
    '.github/actions/e2e-env/action.yml',
    'scripts/seed/seed.mjs',
    'scripts/ci/change-scope.mjs',
  ])('runs the journeys for %s', (path) => {
    expect(scope([path]).e2e).toBe(true)
  })

  it.each(['src/lib/notes.md', 'e2e/helpers/README.md', 'public/changelog.md'])(
    'runs the journeys for markdown inside a tree the app or the suite is built from: %s',
    (path) => {
      expect(scope([path]).e2e).toBe(true)
    },
  )

  it('runs the journeys when one file among the documentation is code, and names it', () => {
    const { e2e, reason } = scope([
      'docs/SPEC.md',
      'src/start.ts',
      'CONTEXT.md',
    ])
    expect(e2e).toBe(true)
    expect(reason).toContain('src/start.ts')
  })

  it('runs the journeys when the diff lists no files', () => {
    expect(scope([]).e2e).toBe(true)
  })
})
