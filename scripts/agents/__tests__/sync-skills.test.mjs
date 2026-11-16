import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  chmodSync,
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

it.each([
  'extra-file',
  'extra-directory',
  'symlink',
  'edited-file',
  'unknown-addon',
  'addon-symlink',
  'edited-mode',
])(
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
      if (kind === 'unknown-addon')
        mkdirSync(join(root, '.agents/skills/other-tool'))
      if (kind === 'addon-symlink')
        symlinkSync('om-example', join(root, '.agents/skills/impeccable'))
      if (kind === 'edited-mode') chmodSync(join(root, path), 0o755)
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

it('restores the pin from Git while preserving Impeccable bytes and executable mode', () => {
  const root = mkdtempSync(join(tmpdir(), 'skill-addon-update-'))
  try {
    // Model a parent hook without passing its repository identity to fixture commands.
    const env = {
      ...process.env,
      GIT_DIR: '/nonexistent/parent-hook.git',
      GIT_COMMON_DIR: '/nonexistent/parent-common.git',
      GIT_INDEX_FILE: '/nonexistent/parent-hook.index',
    }
    for (const name of execFileSync('git', ['rev-parse', '--local-env-vars'], {
      encoding: 'utf8',
    })
      .trim()
      .split('\n'))
      delete env[name]
    const upstream = join(root, 'upstream')
    mkdirSync(join(upstream, 'skills/om-example'), { recursive: true })
    writeFileSync(join(upstream, 'skills/om-example/SKILL.md'), '# Example\n')
    const git = (...args) => {
      const result = spawnSync('git', args, {
        cwd: upstream,
        encoding: 'utf8',
        env,
      })
      expect(result.status, result.stderr).toBe(0)
      return result.stdout.trim()
    }
    git('init', '-q')
    git('add', '.')
    git(
      '-c',
      'user.name=Fixture',
      '-c',
      'user.email=fixture@example.invalid',
      '-c',
      'commit.gpgsign=false',
      'commit',
      '-qm',
      'Fixture',
    )
    const sha = git('rev-parse', 'HEAD')
    const path = '.agents/skills/om-example/SKILL.md'
    mkdirSync(join(root, '.agents/skills/om-example'), { recursive: true })
    mkdirSync(join(root, '.agents/skills/impeccable/scripts'), {
      recursive: true,
    })
    mkdirSync(join(root, 'scripts/agents'), { recursive: true })
    mkdirSync(join(root, 'docs/agents'), { recursive: true })
    writeFileSync(join(root, path), '# Example\n')
    writeFileSync(
      join(root, '.agents/skills/impeccable/SKILL.md'),
      '# Impeccable\n',
    )
    const addon = join(root, '.agents/skills/impeccable/scripts/tool')
    writeFileSync(addon, '#!/bin/sh\necho preserved\n', { mode: 0o755 })
    writeFileSync(
      join(root, 'scripts/agents/skills-upstream.json'),
      JSON.stringify({
        sha,
        files: [
          {
            path,
            mode: '100644',
            sha: git('rev-parse', 'HEAD:skills/om-example/SKILL.md'),
          },
        ],
      }),
    )
    writeFileSync(
      join(root, 'docs/agents/cezar.md'),
      `open-mercato/skills@${sha}\n`,
    )
    const result = spawnSync(
      process.execPath,
      [resolve('scripts/agents/sync-skills.mjs')],
      {
        cwd: root,
        encoding: 'utf8',
        timeout: 15_000,
        env: {
          ...env,
          GIT_CONFIG_COUNT: '1',
          GIT_CONFIG_KEY_0: `url.${upstream}.insteadOf`,
          GIT_CONFIG_VALUE_0: 'https://github.com/open-mercato/skills.git',
        },
      },
    )
    expect(result.status, result.stderr).toBe(0)
    expect(readFileSync(addon, 'utf8')).toBe('#!/bin/sh\necho preserved\n')
    expect(spawnSync(addon, [], { encoding: 'utf8' }).stdout.trim()).toBe(
      'preserved',
    )
    expect(
      Object.keys(
        JSON.parse(readFileSync(join(root, 'skills-lock.json'), 'utf8')).skills,
      ),
    ).toEqual(['om-example'])
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
})
