import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, expect, it } from 'vitest'
import { installSnapshot } from '../sync-skills.mjs'

const temporary = []
afterEach(() =>
  temporary
    .splice(0)
    .forEach((path) => rmSync(path, { recursive: true, force: true })),
)
const blob = (text) =>
  createHash('sha1')
    .update(`blob ${Buffer.byteLength(text)}\0`)
    .update(text)
    .digest('hex')
const env = Object.fromEntries(
  Object.entries(process.env).filter(([name]) => !name.startsWith('GIT_')),
)
function fixture(conflict = false) {
  const directory = mkdtempSync(join(tmpdir(), 'planned-skills-sync-test-'))
  temporary.push(directory)
  const checkout = join(directory, 'upstream')
  const root = join(directory, 'stage')
  mkdirSync(checkout)
  const git = (...args) =>
    execFileSync('git', ['-C', checkout, ...args], {
      env,
      encoding: 'utf8',
    }).trim()
  git('init', '--quiet')
  const path = '.agents/skills/om-example/SKILL.md'
  const base =
    '---\nname: om-example\n---\n\n# Example\n\nOriginal upstream guidance.\n'
  mkdirSync(join(checkout, 'skills/om-example'), { recursive: true })
  writeFileSync(join(checkout, 'skills/om-example/SKILL.md'), base)
  git('add', '.')
  git(
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '--quiet',
    '-m',
    'Initial fixture',
  )
  const sha = git('rev-parse', 'HEAD')
  const patched = base + '\nReviewed project repair.\n'
  mkdirSync(join(root, '.agents/skills/om-example'), { recursive: true })
  mkdirSync(join(root, '.agents/skills/impeccable'))
  writeFileSync(
    join(root, '.agents/skills/impeccable/SKILL.md'),
    'Preserve Impeccable',
  )
  writeFileSync(join(root, path), patched)
  mkdirSync(join(root, 'scripts/agents'), { recursive: true })
  writeFileSync(
    join(root, 'scripts/agents/skills-upstream.json'),
    JSON.stringify({
      sha,
      files: [
        {
          path,
          sha: blob(base),
          localSha: blob(patched),
          mode: '100644',
          reason: 'Reviewed repair.',
        },
      ],
    }),
  )
  writeFileSync(
    join(root, 'skills-lock.json'),
    JSON.stringify({
      version: 2,
      skills: { 'om-example': { source: 'open-mercato/skills' } },
    }),
  )
  mkdirSync(join(root, 'docs/agents'), { recursive: true })
  writeFileSync(
    join(root, 'docs/agents/cezar.md'),
    `open-mercato/skills@${sha}\n\n<!-- om-skills-version:start -->\nInstalled fixture.\n<!-- om-skills-version:end -->\n`,
  )
  if (conflict)
    writeFileSync(
      join(checkout, 'skills/om-example/SKILL.md'),
      '# Incompatible replacement\n',
    )
  else
    writeFileSync(
      join(checkout, 'skills/om-example/new.md'),
      'New upstream reference\n',
    )
  git('add', '.')
  git(
    '-c',
    'user.name=Fixture',
    '-c',
    'user.email=fixture@example.invalid',
    'commit',
    '--quiet',
    '-m',
    'Update fixture',
  )
  return { root, checkout, path, patched, latest: git('rev-parse', 'HEAD') }
}

it('stages the selected upstream SHA while preserving reviewed repairs and Impeccable', () => {
  const { root, checkout, path, patched, latest } = fixture()
  expect(installSnapshot(root, checkout, latest)).toBe(1)
  expect(readFileSync(join(root, path), 'utf8')).toBe(patched)
  expect(
    readFileSync(join(root, '.agents/skills/om-example/new.md'), 'utf8'),
  ).toBe('New upstream reference\n')
  expect(
    readFileSync(join(root, '.agents/skills/impeccable/SKILL.md'), 'utf8'),
  ).toBe('Preserve Impeccable')
  const manifest = JSON.parse(
    readFileSync(join(root, 'scripts/agents/skills-upstream.json'), 'utf8'),
  )
  expect(manifest.sha).toBe(latest)
  expect(manifest.files.find((file) => file.path === path).localSha).toBe(
    blob(patched),
  )
  expect(readFileSync(join(root, 'docs/agents/cezar.md'), 'utf8')).toContain(
    latest,
  )
  expect(
    JSON.parse(readFileSync(join(root, 'skills-lock.json'), 'utf8')).skills[
      'om-example'
    ].computedHash,
  ).toMatch(/^[a-f0-9]{64}$/)
})

it('leaves staged installation metadata and skills untouched when a repair conflicts', () => {
  const { root, checkout, path, patched, latest } = fixture(true)
  const before = readFileSync(
    join(root, 'scripts/agents/skills-upstream.json'),
    'utf8',
  )
  expect(() => installSnapshot(root, checkout, latest)).toThrow()
  expect(readFileSync(join(root, path), 'utf8')).toBe(patched)
  expect(
    readFileSync(join(root, 'scripts/agents/skills-upstream.json'), 'utf8'),
  ).toBe(before)
})
