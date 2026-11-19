import { execFileSync } from 'node:child_process'
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

/**
 * `pnpm lint` has to stay runnable while an agent run is in flight. Every scratch directory a run
 * writes is gitignored, and under ESLint each one also had to be named in the config's ignore list
 * - a missing entry turned the gate red on the machine that wrote the directory (#203), for a
 * reason that had nothing to do with the change under test.
 *
 * oxlint reads `.gitignore` itself, the nested `.ai/cezar/.gitignore` included (ADR 0028), so that
 * list is gone and this file pins the premise instead: a file dropped into a gitignored directory
 * is never linted. The other half is `ignorePatterns` in `.oxlintrc.json`, which still names the
 * tracked paths that are not ours to lint, including vendored skills.
 *
 * Its failure mode is silence in both directions: nothing notices a directory that is linted when
 * it should not be until the tool that writes it runs, and nothing notices an ignore that grew too
 * wide until a real error goes unreported. So each case pins a boundary rather than a path. The
 * answers come from the real binary (`--debug=files` prints the files a run would lint, then
 * exits), and the scratch paths are written for the run - a path that does not exist is linted by
 * nobody and would pass either way.
 */
const root = fileURLToPath(new URL('.', import.meta.url))

const IGNORED = [
  // The QA round's throwaway spec and the per-run config driving it, written by instruction
  // (`.ai/browsers/playwright.md`) into a directory named for the run.
  '.ai/qa/artifacts_20260909-231500-9999/copy-trip.qa.spec.ts',
  '.ai/qa/artifacts_20260909-231500-9999/qa.config.ts',
  '.ai/tmp/om-auto-fix-pr/1234/prettier.config.js',
  // Every directory entry in `.ai/cezar/.gitignore`. A worktree is a whole second copy of the
  // repository, so its case is spelled as application source to prove the ignore beats the
  // `src/**` the last case insists stays linted.
  '.ai/cezar/tmp/transform-cache/entry.ts',
  '.ai/cezar/dispatch/order.ts',
  '.ai/cezar/attachments/pasted.ts',
  '.ai/cezar/drafts/draft.ts',
  '.ai/cezar/runs/run.ts',
  '.ai/cezar/worktrees/lint-ignores-probe/src/routes/index.tsx',
  // Agent tooling, not application source. Hypothetical: the hooks themselves are shell today.
  '.claude/hooks/probe.ts',
  '.agents/skills/lint-ignores-probe/template.ts',
] as const

/** Not tracked either, but not gitignored: the shared config the QA browser descriptor writes. */
const WRITTEN_AND_LINTED = ['.ai/qa/playwright.config.ts'] as const

const SOURCE_FILES = [
  'src/routes/index.tsx',
  'src/server/repos/trips.ts',
] as const

let fixture: string | undefined
let linted: Set<string>

beforeAll(() => {
  // Other tooling tests inspect the checkout while this suite runs.
  fixture = mkdtempSync(join(tmpdir(), 'planned-travel-lint-ignores-'))
  // The validation runner puts TMPDIR under a gitignored directory in the checkout.
  execFileSync('git', ['init', '--quiet', '--template='], {
    cwd: fixture,
    timeout: 10_000,
  })
  for (const path of ['.oxlintrc.json', '.gitignore', '.ai/cezar/.gitignore']) {
    const target = resolve(fixture, path)
    mkdirSync(dirname(target), { recursive: true })
    copyFileSync(resolve(root, path), target)
  }
  for (const path of [...IGNORED, ...WRITTEN_AND_LINTED, ...SOURCE_FILES]) {
    const target = resolve(fixture, path)
    mkdirSync(dirname(target), { recursive: true })
    writeFileSync(target, 'export const probe = 1\n')
  }
  const output = execFileSync(
    resolve(root, 'node_modules/.bin/oxlint'),
    ['--debug=files'],
    {
      cwd: fixture,
      encoding: 'utf8',
      timeout: 30_000,
    },
  )
  linted = new Set(
    output
      .split('\n')
      .filter(Boolean)
      .map((line) => line.replace(/^\.\//, '')),
  )
}, 60_000)

afterAll(() => {
  if (fixture) rmSync(fixture, { recursive: true, force: true })
})

describe('pnpm lint ignores', () => {
  it.each(IGNORED)('does not walk %s', (path) => {
    expect(linted.has(path)).toBe(false)
  })

  it.each([
    ...SOURCE_FILES,
    // One level up from the per-run QA scratch: only the `artifacts_*` directories are out.
    ...WRITTEN_AND_LINTED,
  ])('still lints %s', (path) => {
    expect(linted.has(path)).toBe(true)
  })
})
