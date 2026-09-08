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

const HOOKS = resolve(__dirname, '..')
const AGENT = { CEZ_TASK_ID: '0123456789ab-test' }
const ACTIONS = { GITHUB_ACTIONS: 'true' }

function hook(
  name: string,
  toolInput: Record<string, string>,
  env: Record<string, string> = {},
  cwd?: string,
  toolName?: string,
) {
  const { PATH, HOME } = process.env
  const r = spawnSync('bash', [join(HOOKS, name)], {
    // `tool_name` is omitted unless a case names it, so the hooks stay exercised on the shape
    // they see when a harness does not send it: `pattern` is then read as a path, the safe read.
    input: JSON.stringify({
      ...(toolName ? { tool_name: toolName } : {}),
      tool_input: toolInput,
    }),
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
    // Every mode, because this tier is the one that has no audience: nothing a developer,
    // a cezar run or the review job legitimately does needs any of it.
    for (const env of [{}, AGENT, ACTIONS]) {
      expect(bash('git reset --hard HEAD~1', env).status).toBe(2)
      expect(bash('git clean -fd', env).status).toBe(2)
      expect(bash('git branch -D feature/x', env).status).toBe(2)
      expect(bash('git checkout .', env).status).toBe(2)
      expect(bash('git restore .', env).status).toBe(2)
      expect(bash('git status', env).status).toBe(0)
    }
  })

  // `develop` and `main` are staging and production; a force-push to either rewrites what
  // somebody else has already pulled. A feature branch is the author's own and stays open.
  it.each([
    'git push --force origin develop',
    'git push --force origin main',
    'git push -f origin develop',
    'git push -f origin main',
  ])('blocks the force-push %s', (command) => {
    const r = bash(command)
    expect(r.status).toBe(2)
    expect(r.stderr).toContain('force-push to develop/main')
  })

  it('leaves a force-push to a feature branch alone', () => {
    expect(bash('git push --force-with-lease origin fix/issue-12-x').status).toBe(0)
  })

  it('leaves pnpm and env alone outside agent runs', () => {
    for (const c of ['pnpm add left-pad', 'printenv', 'env']) {
      expect(bash(c).status).toBe(0)
    }
  })

  // The pre-commit hook is the fast gate; skipping it is how a red tree reaches a pull request.
  it.each([
    'git commit --no-verify -m "x"',
    'git commit -m "x" --no-verify',
    'git push --no-verify origin HEAD',
    'git commit -n -m "x"',
  ])('blocks %s for everyone', (command) => {
    const r = bash(command)
    expect(r.status).toBe(2)
    expect(r.stderr).toContain('--no-verify')
  })

  // Tier one of the Cloudflare rules, refused in every session: a secret named on a command line
  // is already in the transcript, and a deleted store does not come back - deleting the Worker
  // takes its routes, its Durable Object bindings and the live deployment with it.
  it('blocks secret writes and store deletion in every mode', () => {
    for (const env of [{}, AGENT, ACTIONS]) {
      expect(bash('wrangler secret put BETTER_AUTH_SECRET', env).status).toBe(2)
      expect(bash('pnpm exec wrangler secret list', env).status).toBe(2)
      expect(bash('wrangler d1 delete planned-travel-db', env).status).toBe(2)
      expect(bash('wrangler r2 bucket delete tiles', env).status).toBe(2)
      expect(bash('wrangler kv namespace delete --namespace-id=1', env).status).toBe(2)
      expect(bash('wrangler delete planned-travel', env).status).toBe(2)
    }
  })

  // Tier two: shipping is undone by shipping again, so a developer keeps the ordinary approval
  // prompt and only an unattended run - which has nobody to answer it - is refused.
  //
  // The package-script names are this repository's. money-tracker.online spells the remote
  // migrations `db:migrate:prod` and `db:migrate:staging`; copying that list here would match
  // nothing and leave `pnpm db:migrate:remote` unguarded while looking protected.
  const SHIPPING = [
    'wrangler deploy',
    'npx wrangler deploy',
    './node_modules/.bin/wrangler deploy',
    'wrangler versions upload',
    'wrangler versions deploy',
    'wrangler triggers deploy',
    'wrangler rollback',
    'wrangler d1 execute planned-travel-db --remote --command "DROP TABLE trips"',
    'wrangler d1 migrations apply planned-travel-db --remote',
    'pnpm deploy',
    'pnpm run deploy',
    'pnpm -s run deploy',
    'pnpm deploy:staging',
    'pnpm db:migrate:remote',
    'pnpm db:migrate:remote:staging',
  ]
  it.each(SHIPPING)('blocks %s in an agent run', (command) => {
    expect(bash(command, AGENT).status).toBe(2)
  })
  it.each(SHIPPING)('leaves %s to the prompt outside an agent run', (command) => {
    expect(bash(command).status).toBe(0)
  })

  it('leaves the local database alone in both modes', () => {
    for (const env of [{}, AGENT]) {
      expect(bash('pnpm db:migrate:local', env).status).toBe(0)
      expect(bash('wrangler d1 migrations apply planned-travel-db --local', env).status).toBe(0)
      expect(bash('wrangler d1 migrations list planned-travel-db', env).status).toBe(0)
    }
  })

  // A rule matches the command, not prose about it. This is not hypothetical: the commit that
  // moved these tests was itself refused, because its message named a git command as text.
  it('reads a quoted mention as text, not as an invocation', () => {
    expect(bash('grep -rn "wrangler secret" docs/').status).toBe(0)
    expect(bash('git commit -m "docs: say why wrangler secret put is denied"').status).toBe(0)
    expect(bash(`sed -i '' 's/wrangler secret/x/' docs/DEPLOY.md`).status).toBe(0)
    expect(bash('git commit -m "chore: fix the pnpm deploy script"', AGENT).status).toBe(0)
    expect(bash("git commit -F - <<'EOF'\nchore: document pnpm deploy\nEOF", AGENT).status).toBe(0)
  })

  it('still reads a string a shell will execute as the command', () => {
    expect(bash('bash -c "wrangler deploy"', AGENT).status).toBe(2)
    expect(bash(`sh -c 'wrangler secret put X'`).status).toBe(2)
    expect(bash(`eval "wrangler d1 delete planned-travel-db"`).status).toBe(2)
  })

  // Under GitHub Actions the command is matched raw, with no quote stripping. There the input is
  // an attacker-authored diff, and normalisation would hand it a bypass: `gh pr "review" 12`
  // strips to something no rule matches. A false positive there costs one unposted comment; a
  // false negative costs an approval on a crafted pull request.
  it('does not normalise quotes under GitHub Actions', () => {
    expect(bash('gh pr "review" 12 --approve', ACTIONS).status).toBe(2)
    expect(bash('gh "pr" review 12 --approve', ACTIONS).status).toBe(2)
    expect(bash('wrangler "secret" put X', ACTIONS).status).toBe(2)
    // ...and the trade is deliberate: the same string is read as prose for a cezar run.
    expect(bash('git commit -m "chore: mention wrangler secret put"', AGENT).status).toBe(0)
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
    'pnpm install-skills',
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
    // The hooks and their tests. The tests live here rather than under scripts/ precisely so
    // this rule covers them: a run that cannot edit a guard but can delete the case that pins
    // its behaviour has only been slowed down, not stopped.
    '.claude/hooks/git-guardrails.sh',
    '.claude/hooks/__tests__/hooks.test.ts',
    '.husky/pre-commit',
    '.ai/cezar/config.json',
    '.ai/cezar/workflows/issue-autofix.yml',
    '.ai/agentic.config.json',
    '.ai/trackers/github.md',
    '.ai/browsers/playwright.md',
    '.ai/skills/om-fix/SKILL.md',
    '.ai/scripts/e2e.sh',
    'docs/agents/reference.md',
    'docs/agents/out-of-scope.md',
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
    toolName?: string,
  ) => hook('guard-read.sh', input, env, root, toolName)

  // Tier one. The secret files are refused to every caller, not only to a run: since
  // `.claude/settings.json` became hooks-only this is the only thing enforcing that rule for the
  // file-reading tools.
  it('denies the secret files in every session', () => {
    for (const env of [{}, AGENT, ACTIONS]) {
      expect(read({ file_path: '.dev.vars' }, env).status).toBe(2)
      expect(read({ file_path: '.env.local' }, env).status).toBe(2)
      expect(read({ file_path: '.ai/qa/test-env.env' }, env).status).toBe(2)
      expect(read({ file_path: '.e2e-tiles/basemap.pmtiles' }, env).status).toBe(2)
      // ...and the counter-cases, so the rule cannot quietly widen onto ordinary files.
      expect(read({ file_path: join(root, '.dev.vars.example') }, env).status).toBe(0)
      expect(read({ file_path: join(root, 'src/a.ts') }, env).status).toBe(0)
    }
  })

  // Grep's `pattern` searches file *contents* and is a regex; `process.env` is not a request to
  // read `.env`. Its `glob` input is the path filter, and that is what gets checked.
  it.each(['process.env', 'import.meta.env', 'import.meta.env.VITE_APP_URL', 'c.env.DB'])(
    'allows the Grep content regex %s in every session',
    (pattern) => {
      expect(read({ pattern }, {}, 'Grep').status).toBe(0)
      expect(read({ pattern }, AGENT, 'Grep').status).toBe(0)
    },
  )

  it('checks the Grep glob filter, which is a path', () => {
    expect(read({ pattern: 'SECRET', glob: '**/.dev.vars' }, {}, 'Grep').status).toBe(2)
    expect(read({ pattern: 'SECRET', glob: '**/*.ts' }, {}, 'Grep').status).toBe(0)
  })

  // A harness that sends no `tool_name` leaves `pattern` ambiguous, so its shape decides: a
  // separator or a glob metacharacter makes it a path, and a bare regex stays a content search.
  // Nothing is lost by the second half - the file itself is still refused when it is read.
  it('reads an unlabelled path-shaped pattern as a path', () => {
    expect(read({ path: root, pattern: '**/.dev.vars' }).status).toBe(2)
    expect(read({ pattern: '../**/*.ts' }).status).toBe(2)
    expect(read({ pattern: '*.env.local' }).status).toBe(2)
  })

  it('reads an unlabelled bare pattern as a content search', () => {
    expect(read({ pattern: 'process.env' }).status).toBe(0)
    expect(read({ pattern: 'import.meta.env' }).status).toBe(0)
  })

  // Tier two. Confinement is the agent-run tier: a developer legitimately reads outside the
  // checkout, and another run's state is not this run's business.
  it('confines a run to the worktree in agent runs only', () => {
    expect(read({ file_path: '/etc/passwd' }, {}).status).toBe(0)
    expect(read({ file_path: '.git/config' }, {}).status).toBe(0)
    expect(read({ file_path: '.ai/cezar/runs/x.json' }, {}).status).toBe(0)
    expect(read({ file_path: '/etc/passwd' }, AGENT).status).toBe(2)
    expect(read({ file_path: '.git/config' }, AGENT).status).toBe(2)
    expect(read({ file_path: '/etc/passwd' }, ACTIONS).status).toBe(2)
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
