// Policies remain reachable without a second skill installation.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { describe, expect, it } from 'vitest'

const read = (path) => readFileSync(path, 'utf8')

describe('portable agent policy', () => {
  it('routes chained skills to local policy and preserves safety boundaries', () => {
    const router = read('AGENTS.md')
    expect(router).toContain('.agents/policies/<name>.md')
    expect(router).toContain('including a chained invocation')
    expect(router).toContain('.agents/policies/security.md')
    const policy = read('.agents/policies/security.md')
    for (const rule of [
      'not an OS sandbox',
      'Never rewrite branch history',
      'Never write Cloudflare secrets',
      'expected SHA',
      'verified run ownership',
      'Never use REST DELETE',
      'stop once',
      'Never switch tools',
    ]) {
      expect(policy).toContain(rule)
    }
  })

  it('attaches every local skill policy to an installed Open Mercato skill', () => {
    for (const name of readdirSync('.agents/policies').filter((name) =>
      name.startsWith('om-'),
    )) {
      expect(
        existsSync(`.agents/skills/${name.slice(0, -3)}/SKILL.md`),
        name,
      ).toBe(true)
      expect(read(`.agents/policies/${name}`), name).toContain(
        '.agents/policies/security.md',
      )
    }
  })

  it('keeps workflow references and candidate schedules resolvable', () => {
    for (const file of readdirSync('.ai/cezar/workflows')) {
      const workflow = read(`.ai/cezar/workflows/${file}`)
      expect(workflow, file).not.toMatch(
        /afk-|\.claude\/|allowedTools:|prompt:.*\/backlog\b|skill:\s*(?!om-)/,
      )
      for (const [, path] of workflow.matchAll(
        /(?:Read |read |`)(\.agents\/[A-Za-z0-9/_.-]+\.md)/g,
      )) {
        expect(existsSync(path), `${file}: ${path}`).toBe(true)
      }
    }
    for (const item of JSON.parse(read('docs/agents/cezar-automations.json'))) {
      expect(item.enabled).toBe(false)
      expect(existsSync(`.ai/cezar/workflows/${item.task.workflow}.yml`)).toBe(
        true,
      )
    }
  })

  it.each([
    [
      'scripts/agents/close-fixed-issues.mjs',
      ['--apply'],
      'Legacy --apply is retired',
    ],
    [
      'scripts/agents/release-leaked-claims.mjs',
      ['--since', '2026-11-01T00:00:00Z', '--prs', '1'],
      'Legacy claim release is retired',
    ],
  ])(
    'refuses legacy tracker mutation before calling GitHub: %s',
    (script, args, message) => {
      const result = spawnSync(process.execPath, [script, ...args], {
        encoding: 'utf8',
        timeout: 10_000,
        env: { ...process.env, PATH: '/nonexistent' },
      })
      expect(result.status).not.toBe(0)
      expect(result.stderr).toContain(message)
      expect(result.stderr).not.toContain('spawnSync gh')
    },
  )
})
