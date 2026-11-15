import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { expect, it } from 'vitest'

it.each(['extra-file', 'extra-directory', 'symlink', 'edited-file'])(
  'preserves local work and refuses installation before network access: %s',
  (kind) => {
    const root = mkdtempSync(join(tmpdir(), 'skill-update-guard-'))
    try {
      const path = '.agents/skills/om-example/SKILL.md'
      mkdirSync(join(root, '.agents/skills/om-example'), { recursive: true })
      mkdirSync(join(root, 'scripts/agents'), { recursive: true })
      const original = Buffer.from('# Example\n')
      writeFileSync(join(root, path), original)
      writeFileSync(
        join(root, 'scripts/agents/skills-upstream.json'),
        JSON.stringify({
          sha: 'a'.repeat(40),
          files: [
            {
              path,
              mode: '100644',
              sha: createHash('sha1')
                .update(`blob ${original.length}\0`)
                .update(original)
                .digest('hex'),
            },
          ],
        }),
      )
      if (kind === 'extra-file')
        writeFileSync(
          join(root, '.agents/skills/om-example/notes.md'),
          'Local notes',
        )
      if (kind === 'extra-directory')
        mkdirSync(join(root, '.agents/skills/om-local'))
      if (kind === 'symlink')
        symlinkSync('SKILL.md', join(root, '.agents/skills/om-example/link.md'))
      if (kind === 'edited-file')
        writeFileSync(join(root, path), '# Local edit\n')
      const before = readFileSync(join(root, path), 'utf8')
      const result = spawnSync(
        process.execPath,
        [resolve('scripts/agents/sync-skills.mjs')],
        {
          cwd: root,
          env: { ...process.env, PATH: '/nonexistent' },
          encoding: 'utf8',
          timeout: 10_000,
        },
      )
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain('Refusing to')
      expect(result.stderr).not.toContain('spawnSync git')
      expect(readFileSync(join(root, path), 'utf8')).toBe(before)
      if (kind === 'extra-file')
        expect(
          readFileSync(
            join(root, '.agents/skills/om-example/notes.md'),
            'utf8',
          ),
        ).toBe('Local notes')
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  },
)
