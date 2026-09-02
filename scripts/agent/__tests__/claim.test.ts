// cez-claim.sh as a black box: a temp clone with a bare origin, a fake `gh` on PATH that
// answers the preflight from a fixture and logs every write, CEZ_TASK_ID for the run id.
import { execFileSync } from 'node:child_process'
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

import { beforeEach, describe, expect, it } from 'vitest'

const SCRIPTS = resolve(__dirname, '..')
const N = 42
const RUN = 'run1234567890ab'

type Fixture = {
  state?: string
  labels?: string[]
  blockedBy?: Array<{ number: number; state: string }>
  subIssues?: number
}
type World = ReturnType<typeof world>

function world() {
  const root = mkdtempSync(join(tmpdir(), 'cez-claim-'))
  const origin = join(root, 'origin.git')
  const clone = join(root, 'clone')
  const bin = join(root, 'bin')
  const log = join(root, 'gh.log')
  const fixture = join(root, 'issue.json')
  // A clean env: under a git hook GIT_DIR / GIT_INDEX_FILE would point every call at the repo under test.
  const env = {
    PATH: process.env.PATH ?? '',
    HOME: process.env.HOME ?? '',
  } as unknown as NodeJS.ProcessEnv // the repo augments ProcessEnv with app variables
  const git = (args: string[], cwd = clone) =>
    execFileSync(
      'git',
      ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args],
      { cwd, encoding: 'utf8', env },
    ).trim()

  execFileSync('git', ['init', '--bare', '-q', '-b', 'develop', origin], {
    env,
  })
  execFileSync('git', ['init', '-q', '-b', 'develop', clone], { env })
  git(['remote', 'add', 'origin', origin])
  writeFileSync(join(clone, 'README.md'), 'base\n')
  git(['add', 'README.md'])
  git(['commit', '-q', '-m', 'base'])
  git(['push', '-q', '-u', 'origin', 'develop'])

  mkdirSync(bin)
  writeFileSync(
    join(bin, 'gh'),
    `#!/usr/bin/env bash
args="$*"; printf '%s\\n' "\${args//$'\\n'/ }" >> "$FAKE_GH_LOG"
case "$1 $2" in
  "issue view") cat "$FAKE_ISSUE" ;;
  "pr list") printf '%s' "\${FAKE_PRS:-}" ;;
  api) case "$*" in *--paginate*) printf '%s' "\${FAKE_COMMENT_ID:-}" ;; esac ;;
esac
`,
  )
  chmodSync(join(bin, 'gh'), 0o755)
  mkdirSync(join(clone, '.agent'))
  writeFileSync(join(clone, '.agent', 'issue'), `${N}\n`)

  const setIssue = (f: Fixture) =>
    writeFileSync(
      fixture,
      JSON.stringify({
        state: f.state ?? 'OPEN',
        labels: (f.labels ?? ['run: implement', 'status: ready']).map(
          (name) => ({ name }),
        ),
        blockedBy: {
          nodes: f.blockedBy ?? [],
          totalCount: (f.blockedBy ?? []).length,
        },
        subIssuesSummary: { total: f.subIssues ?? 0, completed: 0 },
      }),
    )
  const claim = (env: Record<string, string> = {}) => {
    const r = execFileSync(
      'bash',
      ['-c', `"${join(SCRIPTS, 'cez-claim.sh')}"; echo "exit=$?"`],
      {
        cwd: clone,
        encoding: 'utf8',
        env: {
          PATH: `${bin}:${process.env.PATH ?? ''}`,
          HOME: process.env.HOME ?? '',
          CEZ_TASK_ID: RUN,
          FAKE_GH_LOG: log,
          FAKE_ISSUE: fixture,
          ...env,
        } as unknown as NodeJS.ProcessEnv,
        stdio: ['ignore', 'pipe', 'pipe'],
      },
    )
    const status = Number(/exit=(\d+)/.exec(r)?.[1])
    const calls = existsSync(log)
      ? readFileSync(log, 'utf8').trim().split('\n')
      : []
    return { status, calls }
  }
  // A branch a previous run pushed for this ticket, cut from the same develop.
  const pushOrphan = (name: string, file: string) => {
    const wt = join(root, `wt-${name.replace(/\//g, '_')}`)
    git(['worktree', 'add', '-q', '-b', name, wt, 'origin/develop'])
    mkdirSync(join(wt, file, '..'), { recursive: true })
    writeFileSync(join(wt, file), 'orphan\n')
    git(['add', file], wt)
    git(['commit', '-q', '-m', `orphan ${file}`], wt)
    git(['push', '-q', 'origin', name], wt)
  }
  return { root, clone, git, setIssue, claim, pushOrphan }
}

let w: World
beforeEach(() => {
  w = world()
})

const edits = (calls: string[]) =>
  calls.filter((c) => c.startsWith('issue edit'))
const comments = (calls: string[]) =>
  calls.filter((c) => c.includes('--method POST') && c.includes('/comments'))

describe('cez-claim.sh preflight', () => {
  it.each([
    ['a closed issue', { state: 'CLOSED' }, 'is not open'],
    [
      'a queued ticket with an open blocker',
      {
        labels: ['run: implement', 'status: queued'],
        blockedBy: [{ number: 5, state: 'OPEN' }],
      },
      'status: queued',
    ],
    [
      'a ready ticket with an open blocker',
      { blockedBy: [{ number: 5, state: 'OPEN' }] },
      'blocked by open #5',
    ],
    [
      'a PRD',
      { labels: ['run: implement', 'status: ready', 'prd'], subIssues: 3 },
      'is a PRD',
    ],
    ['a non-leaf', { subIssues: 2 }, 'has sub-issues'],
  ])('refuses %s: drops run: implement and comments', (_, fixture, reason) => {
    w.setIssue(fixture)
    const { status, calls } = w.claim()
    expect(status).toBe(1)
    expect(edits(calls)).toEqual([
      `issue edit ${N} --repo design4pro/planned.travel --remove-label run: implement`,
    ])
    expect(comments(calls)).toHaveLength(1)
    expect(comments(calls)[0]).toContain('agent-result: refused')
    expect(comments(calls)[0]).toContain(reason)
    expect(existsSync(join(w.clone, '.agent', 'claim.json'))).toBe(false)
  })

  it('refuses without a run: label and removes nothing', () => {
    w.setIssue({ labels: ['status: ready'] })
    const { status, calls } = w.claim()
    expect(status).toBe(1)
    expect(edits(calls)).toEqual([])
    expect(comments(calls)[0]).toContain('carries no `run: implement`')
  })

  it('refuses when an agent PR is already open for the ticket', () => {
    w.setIssue({})
    const { status, calls } = w.claim({ FAKE_PRS: '#77' })
    expect(status).toBe(1)
    expect(comments(calls)[0]).toContain('open agent PR (#77)')
  })

  it('leaves the issue alone while another run holds its lock', () => {
    w.setIssue({})
    const lock = join(
      w.clone,
      '.ai',
      'cezar',
      'tmp',
      'locks',
      `issue-${N}.lock`,
    )
    mkdirSync(lock, { recursive: true })
    writeFileSync(join(lock, 'pid'), String(process.pid))
    const { status, calls } = w.claim()
    expect(status).toBe(1)
    expect(calls).toEqual([])
  })
})

describe('cez-claim.sh claim', () => {
  it('swaps the status and drops run: implement in one edit, then writes the claim comment', () => {
    w.setIssue({ labels: ['run: implement', 'status: needs-human'] })
    const { status, calls } = w.claim()
    expect(status).toBe(0)
    expect(edits(calls)).toEqual([
      `issue edit ${N} --repo design4pro/planned.travel --add-label status: in-progress --remove-label run: implement --remove-label status: needs-human`,
    ])
    expect(comments(calls)[0]).toContain(`agent-claim: ${RUN}`)
    expect(comments(calls)[0]).toContain('agent-heartbeat:')
    const claim = JSON.parse(
      readFileSync(join(w.clone, '.agent', 'claim.json'), 'utf8'),
    )
    expect(claim).toMatchObject({
      issue: N,
      run: RUN,
      previousStatus: 'status: needs-human',
      adopted: null,
    })
    expect(
      existsSync(
        join(w.clone, '.ai', 'cezar', 'tmp', 'locks', `issue-${N}.lock`),
      ),
    ).toBe(false)
  })

  it('adopts a clean orphan branch and skips one that touches a protected path', () => {
    w.setIssue({})
    w.pushOrphan(`claude/issue-${N}-dead0001`, 'src/orphan.ts')
    w.pushOrphan(`claude/issue-${N}-dead0002`, 'scripts/agent/evil.sh')
    const { status } = w.claim()
    expect(status).toBe(0)
    const claim = JSON.parse(
      readFileSync(join(w.clone, '.agent', 'claim.json'), 'utf8'),
    )
    expect(claim.adopted).toBe(`origin/claude/issue-${N}-dead0001`)
    expect(existsSync(join(w.clone, 'src', 'orphan.ts'))).toBe(true)
    expect(existsSync(join(w.clone, 'scripts', 'agent', 'evil.sh'))).toBe(false)
  })

  it('does not adopt a branch that conflicts with develop', () => {
    w.setIssue({})
    w.pushOrphan(`claude/issue-${N}-dead0003`, 'README.md')
    writeFileSync(join(w.clone, 'README.md'), 'develop moved on\n')
    w.git(['commit', '-q', '-am', 'develop moves'])
    w.git(['push', '-q', 'origin', 'develop'])
    const { status } = w.claim()
    expect(status).toBe(0)
    const claim = JSON.parse(
      readFileSync(join(w.clone, '.agent', 'claim.json'), 'utf8'),
    )
    expect(claim.adopted).toBeNull()
    expect(readFileSync(join(w.clone, 'README.md'), 'utf8')).toBe(
      'develop moved on\n',
    )
  })
})
