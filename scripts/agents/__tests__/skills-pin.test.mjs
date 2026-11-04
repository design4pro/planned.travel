import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, realpathSync } from 'node:fs'
import { expect, it } from 'vitest'

it('vendors every upstream file byte-for-byte and keeps complete skill hashes and links', () => {
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
  const skills = new Set(manifest.files.map((file) => file.path.split('/')[2]))
  expect(skills.size).toBe(74)
  for (const name of skills) {
    const root = `.agents/skills/${name}`
    expect(realpathSync(`.claude/skills/${name}`)).toBe(realpathSync(root))
    const files = readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((file) => file.isFile())
      .map((file) => `${file.parentPath}/${file.name}`.slice(root.length + 1))
      .sort((a, b) => a.localeCompare(b))
    const hash = createHash('sha256')
    for (const file of files) {
      hash.update(file)
      hash.update(readFileSync(`${root}/${file}`))
    }
    expect(lock.skills[name].computedHash, name).toBe(hash.digest('hex'))
  }
})
