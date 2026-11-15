import { createHash } from 'node:crypto'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { expect, it } from 'vitest'

it('vendors every upstream file byte-for-byte and keeps complete skill hashes', () => {
  const manifest = JSON.parse(
    readFileSync('scripts/agents/skills-upstream.json', 'utf8'),
  )
  const lock = JSON.parse(readFileSync('skills-lock.json', 'utf8'))
  expect(readFileSync('docs/agents/cezar.md', 'utf8')).toContain(manifest.sha)
  for (const file of manifest.files) {
    const bytes = readFileSync(file.path)
    expect(
      createHash('sha1')
        .update(`blob ${bytes.length}\0`)
        .update(bytes)
        .digest('hex'),
      file.path,
    ).toBe(file.localSha ?? file.sha)
  }
  expect(lock.version).toBe(2)
  const skills = new Set(manifest.files.map((file) => file.path.split('/')[2]))
  expect(skills.size).toBeGreaterThan(0)
  expect([...skills].sort()).toEqual(
    Object.entries(lock.skills)
      .filter(([, skill]) => skill.source === 'open-mercato/skills')
      .map(([name]) => name)
      .sort(),
  )
  for (const name of skills) {
    const root = `.agents/skills/${name}`
    const files = readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((file) => file.isFile())
      .map((file) => `${file.parentPath}/${file.name}`.slice(root.length + 1))
      .sort((a, b) => Buffer.compare(Buffer.from(a), Buffer.from(b)))
    const hash = createHash('sha256')
    for (const file of files) {
      // skills CLI lock schema v2 frames each path and normalized byte length.
      const raw = readFileSync(`${root}/${file}`)
      const content = raw.includes(0)
        ? raw
        : Buffer.from(raw.toString('latin1').replaceAll('\r\n', '\n'), 'latin1')
      hash.update(file)
      hash.update('\0')
      hash.update(String(content.length))
      hash.update('\0')
      hash.update(content)
    }
    expect(lock.skills[name].computedHash, name).toBe(hash.digest('hex'))
  }
})

it('keeps only Open Mercato and Impeccable in the installed skill directory', () => {
  const lock = JSON.parse(readFileSync('skills-lock.json', 'utf8'))
  const upstream = Object.entries(lock.skills)
    .filter(([, skill]) => skill.source === 'open-mercato/skills')
    .map(([name]) => name)
  const installed = readdirSync('.agents/skills', { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  expect(installed).toEqual([...upstream, 'impeccable'].sort())
  expect(existsSync('.claude')).toBe(false)
  expect(existsSync('CLAUDE.local.md')).toBe(false)
})
