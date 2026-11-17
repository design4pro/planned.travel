import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterEach, expect, it, vi } from 'vitest'
import { markdown } from '../../../src/server/content/__tests__/fixtures'
import { parseReleaseSource } from '../../../src/server/content/git-source'
import { readLocalRelease, syncRelease } from '../sync.mts'

let directory: string | undefined
const originalCwd = process.cwd()
afterEach(() => {
  process.chdir(originalCwd)
  if (directory) rmSync(directory, { recursive: true, force: true })
  directory = undefined
  vi.unstubAllEnvs()
})

it('previews a real immutable Git source by default without invoking a write transport', async () => {
  // A hook's repository identity must never redirect fixture Git into its caller.
  for (const name of execFileSync('git', ['rev-parse', '--local-env-vars'], {
    encoding: 'utf8',
  })
    .trim()
    .split('\n'))
    vi.stubEnv(name, undefined)
  directory = mkdtempSync(join(tmpdir(), 'release-git-'))
  const git = (...args: string[]) =>
    execFileSync('git', args, {
      cwd: directory,
      encoding: 'utf8',
      timeout: 10000,
    }).trim()
  git('init', '-q')
  git('config', 'user.name', 'Fixture')
  git('config', 'user.email', 'fixture@example.test')
  writeFileSync(join(directory, 'CHANGELOG.md'), '# Changelog\n')
  git('add', 'CHANGELOG.md')
  git('commit', '-qm', 'chore: seed fixture')
  const cutoff = git('rev-parse', 'HEAD')
  writeFileSync(
    join(directory, 'CHANGELOG.md'),
    markdown.replace('a'.repeat(40), cutoff),
  )
  git('add', 'CHANGELOG.md')
  git('commit', '-qm', 'docs: fixture release')
  const source = git('rev-parse', 'HEAD')
  process.chdir(directory)
  const transport = vi.fn()
  expect(
    await syncRelease(['--commit', source, '--version', '1.2.0'], transport),
  ).toMatchObject({ status: 'unchanged', sync: 'disabled', cutoffSha: cutoff })
  expect(transport).not.toHaveBeenCalled()
  expect(readLocalRelease(source, '1.2.0').body.features).toEqual([
    'Save a place.',
  ])
})

it('preserves sibling heading/cutoff consumers and refuses historical unsupported prose', () => {
  const source = markdown.replace(
    '<!-- changelog-cutoff: aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa -->',
    '> **Cutoff: `abcdef123` (#100, 2026-11-01T01:02:03Z)**',
  )
  expect(/^# (\d+\.\d+\.\d+) \((\d{4}-\d{2}-\d{2})\)$/m.exec(source)?.[1]).toBe(
    '1.2.0',
  )
  expect(parseReleaseSource(source, '1.2.0').cutoffRef).toBe('abcdef123')
  expect(() =>
    parseReleaseSource(
      source.replace('## Highlights', '## Highlights\n\n> A historical note.'),
      '1.2.0',
    ),
  ).toThrow(/CHANGELOG.md:7:/)
})

it('never treats apply as approval and requires explicit reviewed hash and operation identity', async () => {
  for (const operation of ['apply', 'approve', 'import', 'reconcile']) {
    await expect(
      syncRelease([
        '--operation',
        operation,
        '--commit',
        'a'.repeat(40),
        '--version',
        '1.2.0',
      ]),
    ).rejects.toThrow()
  }
  vi.stubEnv('RELEASE_OPERATOR_COOKIE', 'local-fixture-cookie')
  const transport = vi.fn<typeof fetch>(async () =>
    Response.json({ operationId: 'review-1', status: 'pending-evidence' }),
  )
  await expect(
    syncRelease(
      [
        '--operation',
        'approve',
        '--operation-id',
        'review-1',
        '--commit',
        'a'.repeat(40),
        '--version',
        '1.2.0',
        '--hash',
        'b'.repeat(64),
        '--generation',
        '0',
        '--server',
        'https://app.example.test',
      ],
      transport,
    ),
  ).rejects.toThrow()
  expect(transport).not.toHaveBeenCalled()
  const result = await syncRelease(
    [
      '--operation',
      'approve',
      '--operation-id',
      'review-1',
      '--commit',
      'a'.repeat(40),
      '--version',
      '1.2.0',
      '--hash',
      'b'.repeat(64),
      '--generation',
      '0',
      '--reviewed',
      'b'.repeat(64),
      '--server',
      'https://app.example.test',
    ],
    transport,
  )
  expect(result).toMatchObject({
    status: 'pending-evidence',
    operationId: 'review-1',
  })
  expect(transport.mock.calls[0]?.[1]).toMatchObject({
    redirect: 'error',
    method: 'POST',
  })
})
