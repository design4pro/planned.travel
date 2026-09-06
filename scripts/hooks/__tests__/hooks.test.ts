// The Claude Code hooks in .claude/hooks/ as black boxes: JSON on stdin, exit 2 = blocked.
// Agent mode is CEZ_TASK_ID (cezar) or GITHUB_ACTIONS; without either a developer keeps pnpm and env.
// The om-* skills mutate GitHub through .ai/trackers/github.md (`gh api`), stage with `git add -A`,
// write `Closes #n` and run `pnpm exec`, so none of those is blocked under cezar; what is blocked
// there is the pinned stack (`pnpm add`) and the environment dump. Under GitHub Actions the review
// job reads untrusted PR content with a write token, so every gh mutation stays blocked there.
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const HOOKS = resolve(__dirname, '../../../.claude/hooks')
const AGENT = { CEZ_TASK_ID: '0123456789ab-test' }
const ACTIONS = { GITHUB_ACTIONS: 'true' }

function hook(
  name: string,
  toolInput: Record<string, string>,
  env: Record<string, string> = {},
  cwd?: string,
) {
  const { PATH, HOME } = process.env
  const r = spawnSync('bash', [join(HOOKS, name)], {
    input: JSON.stringify({ tool_input: toolInput }),
    encoding: 'utf8',
    env: {
      PATH: PATH ?? '',
      HOME: HOME ?? '',
      ...(cwd ? { CLAUDE_PROJECT_DIR: cwd } : {}),
      ...env,
    } as unknown as NodeJS.ProcessEnv, // a hook gets a clean env (CI sets GITHUB_ACTIONS); the repo augments ProcessEnv with app variables
    cwd,
  })
  return { status: r.status, stderr: r.stderr }
}
const bash = (command: string, env = {}) =>
  hook('git-guardrails.sh', { command }, env)

describe('git-guardrails.sh', () => {
  it('blocks destructive git for everyone', () => {
    expect(bash('git reset --hard HEAD~1').status).toBe(2)
    expect(bash('git checkout .').status).toBe(2)
    expect(bash('git status').status).toBe(0)
  })

  it('leaves pnpm and env alone outside agent runs', () => {
    for (const c of ['pnpm add left-pad', 'printenv', 'env']) {
      expect(bash(c).status).toBe(0)
    }
  })

  it.each([
    ['pnpm add left-pad', 'pnpm add|remove|update'],
    ['pnpm add -D vitest@2', 'pnpm add|remove|update'],
    ['pnpm remove zod', 'pnpm add|remove|update'],
    ['pnpm update', 'pnpm add|remove|update'],
    ['pnpm up --latest', 'pnpm add|remove|update'],
    ['pnpm install && pnpm add x', 'pnpm add|remove|update'],
    ['printenv', 'printenv'],
    ['env', 'env dump'],
    ['env | grep TOKEN', 'env dump'],
  ])('agent mode blocks %s', (command, pattern) => {
    const r = bash(command, AGENT)
    expect(r.status).toBe(2)
    expect(r.stderr).toContain(pattern)
  })

  it.each([
    'git add src/x.ts',
    'git add -A',
    'git add .',
    'git commit -m "fix: x\n\nCloses #12"',
    'git commit -m "fix(map): rings (refs #12)"',
    'git push -u origin fix/issue-12-rings',
    'gh issue view 12 --json body',
    'gh pr create --base develop --title x --body-file b.md',
    'gh pr comment 12 -b hi',
    'gh label create review --color 0366d6',
    'gh api repos/x/y/issues/1',
    'gh api --method POST repos/x/y/issues/1/comments -f body=hi',
    'gh api -X PATCH repos/x/y/issues/1 --input body.json',
    'pnpm typecheck',
    'pnpm test',
    'pnpm lint',
    'pnpm install --frozen-lockfile',
    'pnpm exec playwright test',
    'pnpm exec vite dev --port 3030 --strictPort --host 127.0.0.1',
    'npx -y skills@latest --version',
    'bash .ai/scripts/test-env-up.sh',
    'env -i PATH=/bin true',
    'pnpm run build',
  ])('agent mode allows %s', (command) => {
    expect(bash(command, AGENT).status).toBe(0)
  })

  it('treats GITHUB_ACTIONS as agent mode too', () => {
    expect(bash('pnpm add left-pad', ACTIONS).status).toBe(2)
    expect(bash('env', ACTIONS).status).toBe(2)
  })

  // claude-code-review.yml runs with `--permission-mode bypassPermissions` on every pull request,
  // which leaves this hook as the only gate between a crafted diff and `gh pr review --approve`.
  describe('GitHub Actions keeps every gh mutation blocked', () => {
    it.each([
      ['gh issue edit 1 --add-label x', 'gh issue|pr mutation'],
      ['gh pr create --draft', 'gh issue|pr mutation'],
      ['gh pr review 12 --approve', 'gh issue|pr mutation'],
      ['gh pr merge 12', 'gh issue|pr mutation'],
      ['gh issue comment 1 -b hi', 'gh issue|pr mutation'],
      ['gh pr comment 12 -b hi', 'gh issue|pr mutation'],
      ['gh label delete x', 'gh mutation surface'],
      ['gh api --method POST repos/x/y/issues/1/comments', 'gh api non-GET'],
      ['gh api -X PATCH repos/x/y/issues/1', 'gh api non-GET'],
      ['gh api repos/x/y/issues/1/comments -f body=hi', 'gh api non-GET'],
      ['gh api repos/x/y/issues -F title=@f', 'gh api non-GET'],
      ['gh api --input body.json repos/x/y/issues', 'gh api non-GET'],
    ])('blocks %s', (command, pattern) => {
      const r = bash(command, ACTIONS)
      expect(r.status).toBe(2)
      expect(r.stderr).toContain(pattern)
    })

    it.each([
      'gh issue view 12 --json body',
      'gh pr list',
      'gh api repos/x/y/issues/1',
      'gh api --method GET repos/x/y/issues/1 --paginate',
      'git add -A',
      'git commit -m "fix: x\n\nCloses #12"',
      'pnpm exec playwright test',
    ])('allows %s', (command) => {
      expect(bash(command, ACTIONS).status).toBe(0)
    })

    // The review's one job is to post its summary on the pull request.
    describe('the code review exception for gh pr comment', () => {
      const REVIEW = { ...ACTIONS, CLAUDE_REVIEW_PR_COMMENT: '1' }

      it('opens gh pr comment only when the review sets the variable', () => {
        expect(bash('gh pr comment 12 -b hi', ACTIONS).status).toBe(2)
        expect(bash('gh pr comment 12 -b hi', REVIEW).status).toBe(0)
      })

      it.each([
        'gh issue comment 12 -b hi',
        'gh pr create --draft',
        'gh pr edit 12 --add-label x',
        'gh pr review 12 --approve',
        'gh pr merge 12',
        'gh api --method POST repos/x/y/issues/1/comments',
        'gh label delete x',
      ])('leaves %s blocked', (command) => {
        expect(bash(command, REVIEW).status).toBe(2)
      })
    })
  })
})

describe('guard-generated.sh', () => {
  const root = '/repo'
  const edit = (file_path: string, env = {}) =>
    hook('guard-generated.sh', { file_path }, env, undefined)

  it('blocks generated files for everyone', () => {
    expect(edit(`${root}/src/routeTree.gen.ts`).status).toBe(2)
    expect(edit(`${root}/drizzle/0001_x.sql`).status).toBe(2)
    expect(edit(`${root}/src/x.ts`).status).toBe(0)
  })

  it.each([
    '.github/workflows/ci.yml',
    '.claude/settings.json',
    '.husky/pre-commit',
    '.ai/cezar/config.json',
    '.ai/cezar/workflows/issue-autofix.yml',
    '.ai/agentic.config.json',
    '.ai/trackers/github.md',
    '.ai/browsers/playwright.md',
    '.ai/skills/om-fix/SKILL.md',
    '.ai/scripts/e2e.sh',
    '.ai/scripts/test-env-up.sh',
    'scripts/agent/cez-lib.sh',
    '.npmrc',
    'pnpm-workspace.yaml',
  ])('agent mode blocks %s', (rel) => {
    const r = hook(
      'guard-generated.sh',
      { file_path: `${root}/${rel}` },
      { ...AGENT, CLAUDE_PROJECT_DIR: root },
    )
    expect(r.status).toBe(2)
    expect(r.stderr).toContain('configures the agent')
  })

  it('agent mode allows ordinary paths and does not confuse look-alikes', () => {
    for (const rel of [
      'src/x.ts',
      'scripts/seed/seed.mjs',
      'scripts/hooks/__tests__/hooks.test.ts',
      'docs/agents/cezar.md',
      'src/.npmrc-ish.ts',
      '.ai/runs/2026-09-06-rings/PLAN.md',
      '.ai/specs/2026-09-06-rings.md',
      '.ai/analysis/12.md',
      '.ai/qa/test-env.json',
      '.ai/agentic.config.json.bak',
    ]) {
      expect(
        hook(
          'guard-generated.sh',
          { file_path: `${root}/${rel}` },
          { ...AGENT, CLAUDE_PROJECT_DIR: root },
        ).status,
      ).toBe(0)
    }
    expect(
      hook('guard-generated.sh', { file_path: `${root}/.claude/settings.json` })
        .status,
    ).toBe(0)
  })
})

describe('guard-read.sh', () => {
  const root = mkdtempSync(join(tmpdir(), 'guard-read-'))
  mkdirSync(join(root, 'src'), { recursive: true })
  mkdirSync(join(root, '.ai', 'cezar', 'runs'), { recursive: true })
  mkdirSync(join(root, '.e2e-tiles'), { recursive: true })
  mkdirSync(join(root, '.ai', 'qa'), { recursive: true })
  mkdirSync(join(root, '.ai', 'runs', 'x'), { recursive: true })
  writeFileSync(join(root, '.dev.vars'), 'SECRET=1')
  writeFileSync(join(root, '.dev.vars.example'), 'SECRET=')
  writeFileSync(join(root, 'src', 'a.ts'), '')
  writeFileSync(join(root, '.ai', 'qa', 'test-env.env'), 'TEST_DEMO_PASSWORD=x')
  writeFileSync(join(root, '.ai', 'qa', 'test-env.json'), '{}')
  writeFileSync(join(root, '.ai', 'runs', 'x', 'HANDOFF.md'), '')
  const read = (
    input: Record<string, string>,
    env: Record<string, string> = AGENT,
  ) => hook('guard-read.sh', input, env, root)

  it('is inert outside agent runs', () => {
    expect(read({ file_path: '/etc/passwd' }, {}).status).toBe(0)
  })

  it('allows reads inside the worktree, including files that do not exist yet', () => {
    expect(read({ file_path: join(root, 'src/a.ts') }).status).toBe(0)
    expect(read({ file_path: 'src/new.ts' }).status).toBe(0)
    expect(read({ path: root, pattern: '**/*.ts' }).status).toBe(0)
    expect(read({ file_path: join(root, '.dev.vars.example') }).status).toBe(0)
    expect(read({ file_path: '.ai/qa/test-env.json' }).status).toBe(0)
    expect(read({ file_path: '.ai/runs/x/HANDOFF.md' }).status).toBe(0)
    expect(read({ path: root, pattern: '.ai/runs/**/HANDOFF.md' }).status).toBe(
      0,
    )
  })

  it.each([
    ['/etc/passwd', 'outside the worktree'],
    ['../other/file', 'outside the worktree'],
    ['src/../../x', 'outside the worktree'],
    ['.dev.vars', 'environment file'],
    ['.env.local', 'environment file'],
    ['.e2e-tiles/basemap.pmtiles', 'basemap cache'],
    ['.ai/cezar/runs/x.json', 'cezar run state'],
    ['.ai/cezar/runs.json', 'cezar run state'],
    ['.ai/qa/test-env.env', 'test-env credential file'],
    ['.git/config', 'git internals'],
  ])('denies %s', (file_path, reason) => {
    const r = read({ file_path })
    expect(r.status).toBe(2)
    expect(r.stderr).toContain(reason)
  })

  it('denies Glob patterns that escape or name a secret', () => {
    expect(read({ pattern: '../**/*.ts' }).status).toBe(2)
    expect(read({ path: root, pattern: '**/.dev.vars' }).status).toBe(2)
    expect(read({ path: root, pattern: '*.env.local' }).status).toBe(2)
    expect(read({ path: root, pattern: '.ai/qa/test-env.env' }).status).toBe(2)
  })
})
