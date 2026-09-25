import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
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
 * tracked paths that are not ours to lint, `.claude` among them.
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
] as const

/** Not tracked either, but not gitignored: the shared config the QA browser descriptor writes. */
const WRITTEN_AND_LINTED = ['.ai/qa/playwright.config.ts'] as const

/** What this file created, deepest last, so `afterAll` removes exactly that and nothing else. */
const created: string[] = []

const write = (path: string) => {
  const file = resolve(root, path)
  if (existsSync(file)) return
  let top = dirname(file)
  while (!existsSync(dirname(top))) top = dirname(top)
  created.push(existsSync(top) ? file : top)
  mkdirSync(dirname(file), { recursive: true })
  writeFileSync(file, 'export const probe = 1\n')
}

let linted: Set<string>

beforeAll(() => {
  for (const path of [...IGNORED, ...WRITTEN_AND_LINTED]) write(path)
  const run = spawnSync(
    resolve(root, 'node_modules/.bin/oxlint'),
    ['--debug=files'],
    {
      cwd: root,
      encoding: 'utf8',
    },
  )
  expect(run.status).toBe(0)
  linted = new Set(
    run.stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => line.replace(/^\.\//, '')),
  )
}, 60_000)

afterAll(() => {
  for (const path of created.reverse())
    rmSync(path, { recursive: true, force: true })
})

describe('pnpm lint ignores', () => {
  it.each(IGNORED)('does not walk %s', (path) => {
    expect(linted.has(path)).toBe(false)
  })

  it.each([
    'src/routes/index.tsx',
    'src/server/repos/trips.ts',
    // One level up from the per-run QA scratch: only the `artifacts_*` directories are out.
    ...WRITTEN_AND_LINTED,
  ])('still lints %s', (path) => {
    expect(linted.has(path)).toBe(true)
  })
})
