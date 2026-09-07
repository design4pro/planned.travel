/**
 * The `plan-area` workflow puts a panel of project subagents in the seat the `plan` workflow
 * gives a human, and the seam between the two is a permission list: a subagent runs under the
 * agent step's `--allowedTools` (cezar passes the list; `--permission-mode dontAsk` denies the
 * rest without a prompt), so a tool named in `.claude/agents/plan-*.md` and absent from the step's
 * list is denied at call time, silently, in the middle of a run. The converse matters as much:
 * the step's `bashAllowlist` (publish, commit, handback) is shared too, so a panel member that
 * holds `Bash` can publish the draft mid-run; none may. Nothing else checks either.
 *
 * The same guard for every workflow: a `scripts/agent/*.sh` a step names must exist and be
 * executable, or the agent reaches for it after the claim has already moved the label.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const ROOT = resolve(__dirname, '../../..')
const read = (rel: string) => readFileSync(join(ROOT, rel), 'utf8')

/** The `key: value` pairs of a Markdown front matter block. */
function frontMatter(md: string): Partial<Record<string, string>> {
  const block = md.match(/^---\n([\s\S]*?)\n---/)
  if (!block) throw new Error('no front matter block')
  const out: Partial<Record<string, string>> = {}
  for (const line of block[1].split('\n')) {
    const kv = line.match(/^([a-zA-Z-]+):\s*(.*)$/)
    if (kv) out[kv[1]] = kv[2].trim()
  }
  return out
}

const list = (csv: string) =>
  csv
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

/** `allowedTools: [A, B]` of the agent step in a workflow file. */
function allowedTools(yml: string): string[] {
  const m = yml.match(/allowedTools:\s*\[([^\]]*)\]/)
  if (!m) throw new Error('no allowedTools list')
  return list(m[1])
}

const WORKFLOW = read('.ai/cezar/workflows/plan-area.yml')
const SKILL = read('.claude/skills/plan-area/SKILL.md')
const AGENTS_DIR = join(ROOT, '.claude/agents')
const AGENTS = readdirSync(AGENTS_DIR).filter((f) => /^plan-.*\.md$/.test(f))
const agentName = (file: string) => file.replace(/\.md$/, '')

describe('plan-area: the panel and its workflow agree', () => {
  it('has a panel', () => {
    expect(AGENTS.length).toBeGreaterThan(0)
  })

  it.each(AGENTS)(
    '%s names itself, has a job and uses only allowed tools',
    (file) => {
      const fm = frontMatter(readFileSync(join(AGENTS_DIR, file), 'utf8'))
      expect(fm.name).toBe(agentName(file))
      expect((fm.description ?? '').length).toBeGreaterThan(40)
      const tools = list(fm.tools ?? '')
      expect(tools.length).toBeGreaterThan(0)
      const allowed = allowedTools(WORKFLOW)
      for (const t of tools)
        expect(allowed, `${file} names tool ${t}`).toContain(t)
      expect(
        tools,
        `${file} holds Bash, and with it the step's allowlist`,
      ).not.toContain('Bash')
      if (fm.model) expect(['sonnet', 'opus', 'haiku']).toContain(fm.model)
    },
  )

  it('the agent step may dispatch subagents and runs the skill', () => {
    expect(allowedTools(WORKFLOW)).toContain('Agent')
    expect(WORKFLOW).toContain("prompt: '/plan-area {{task}}'")
  })

  it('the skill and the panel name each other', () => {
    for (const file of AGENTS) expect(SKILL).toContain(`\`${agentName(file)}\``)
    const named = new Set(
      [...SKILL.matchAll(/`(plan-[a-z-]+)`/g)]
        .map((m) => m[1])
        .filter((n) => n !== 'plan-area' && n !== 'plan-feature'),
    )
    for (const n of named)
      expect(AGENTS, `skill names ${n}`).toContain(`${n}.md`)
  })

  it('the cockpit wrapper points at the project skill', () => {
    expect(read('.ai/skills/plan-area/SKILL.md')).toContain('/plan-area')
  })
})

describe('every workflow names scripts that exist and run', () => {
  const dir = join(ROOT, '.ai/cezar/workflows')
  it.each(readdirSync(dir).filter((f) => f.endsWith('.yml')))('%s', (file) => {
    const yml = readFileSync(join(dir, file), 'utf8')
    // The om-* workflows (ADR 0018) name no scripts/agent/ entry: their agent step is a skill
    // and their only command is the worktree bootstrap, so an empty list is legitimate there.
    const scripts = [
      ...yml.matchAll(
        /^\s*(?:-|command:)\s+(?:bash\s+)?(scripts\/(?:agent|worktree)\/[\w.-]+)/gm,
      ),
    ].map((m) => m[1])
    for (const s of scripts) {
      expect(existsSync(join(ROOT, s)), s).toBe(true)
      expect(
        statSync(join(ROOT, s)).mode & 0o111,
        `${s} is executable`,
      ).not.toBe(0)
    }
  })
})
