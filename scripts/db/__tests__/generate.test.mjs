import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, expect, it } from 'vitest'
import { generateMigrations } from '../generate.mjs'
import { releaseVersionTriggers } from '../release-version-triggers.mjs'

let directory
beforeEach(() => {
  directory = mkdtempSync(join(tmpdir(), 'release-generator-'))
})
afterEach(() => rmSync(directory, { recursive: true, force: true }))
const path = () => join(directory, '0001_release.sql')
const create = () =>
  writeFileSync(
    path(),
    'CREATE TABLE `content_versions` (`id` text PRIMARY KEY);',
  )
it('generates trigger DDL once, preserves arguments and remains byte-idempotent', () => {
  const args = ['--name', 'release']
  expect(
    generateMigrations(directory, args, (received) => {
      expect(received).toEqual(args)
      create()
      return 0
    }),
  ).toBe(0)
  const once = readFileSync(path(), 'utf8')
  for (const trigger of releaseVersionTriggers) expect(once).toContain(trigger)
  expect(generateMigrations(directory, [], () => 0)).toBe(0)
  expect(readFileSync(path(), 'utf8')).toBe(once)
})
it.each(['missing', 'tampered'])(
  'refuses %s triggers in an existing migration without rewriting it',
  (kind) => {
    generateMigrations(directory, [], () => {
      create()
      return 0
    })
    const content =
      kind === 'missing'
        ? 'CREATE TABLE `content_versions` (`id` text PRIMARY KEY);'
        : readFileSync(path(), 'utf8').replace('BEFORE UPDATE', 'AFTER UPDATE')
    writeFileSync(path(), content)
    expect(() => generateMigrations(directory, [], () => 0)).toThrow(
      'refusing to rewrite migration history',
    )
    expect(readFileSync(path(), 'utf8')).toBe(content)
  },
)
it('propagates drizzle-kit failure and never supplements failed output', () => {
  expect(
    generateMigrations(directory, [], () => {
      create()
      return 42
    }),
  ).toBe(42)
  expect(readFileSync(path(), 'utf8')).not.toContain('TRIGGER')
})
