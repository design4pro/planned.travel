import { execFileSync, spawnSync } from 'node:child_process'
import {
  copyFileSync,
  readFileSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  mkdirSync,
  writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import {
  issueFromTask,
  mayContinue,
  claimWork,
  reusableEvidence,
  policyDigest,
  creationReservation,
} from '../pipeline-control.mjs'

describe('pipeline control', () => {
  it.each([
    'ready',
    'hold',
    'foreign',
    'incomplete',
    'missing-primary',
    'wrong-identity',
  ])(
    'uses the workspace preflight from a distinct task cwd and fences %s',
    (scenario) => {
      const scratch = realpathSync(
        mkdtempSync(join(tmpdir(), 'workspace-preflight-')),
      )
      const primary = join(scratch, 'primary')
      const task = join(scratch, 'task')
      const env = {
        PATH: process.env.PATH,
        HOME: scratch,
        GIT_CONFIG_GLOBAL: '/dev/null',
        GIT_CONFIG_NOSYSTEM: '1',
        CEZ_RUN_ID: 'fixture-run',
      }
      const git = (...args) =>
        execFileSync('git', args, { env, encoding: 'utf8' })
      try {
        mkdirSync(primary)
        git('init', '-q', primary)
        git(
          '-C',
          primary,
          '-c',
          'user.name=Fixture',
          '-c',
          'user.email=fixture@example.invalid',
          'commit',
          '-q',
          '--allow-empty',
          '-m',
          'Fixture',
        )
        git('-C', primary, 'worktree', 'add', '-q', '--detach', task)
        for (const path of ['.ai/scripts', '.ai/cezar/runs', 'scripts/agents'])
          mkdirSync(join(primary, path), { recursive: true })
        mkdirSync(join(task, '.ai/scripts'), { recursive: true })
        writeFileSync(
          join(task, '.ai/agentic.config.json'),
          JSON.stringify({ baseBranch: 'develop' }),
        )
        // A relative invocation would execute this old task-local helper instead.
        writeFileSync(
          join(task, '.ai/scripts/pipeline-control.mjs'),
          'console.log("OLD_TASK_HELPER")',
        )
        writeFileSync(
          join(task, '.ai/scripts/backlog-status.mjs'),
          'throw new Error("OLD_TASK_BACKLOG")',
        )
        const source = readFileSync(
          new URL('../pipeline-control.mjs', import.meta.url),
          'utf8',
        )
        writeFileSync(join(primary, '.ai/scripts/pipeline-control.mjs'), source)
        copyFileSync(
          new URL('../pr-merge.mjs', import.meta.url),
          join(primary, '.ai/scripts/pr-merge.mjs'),
        )
        writeFileSync(
          join(primary, '.ai/scripts/pr-state.mjs'),
          'export const readPrState = () => { throw new Error("Unexpected PR read") }',
        )
        writeFileSync(
          join(primary, 'scripts/agents/close-fixed-issues.mjs'),
          'export const parseCloseLinks = () => []',
        )
        const evidence =
          scenario === 'incomplete'
            ? { number: 42 }
            : {
                number: 42,
                ready: scenario !== 'hold',
                state: scenario === 'hold' ? 'BLOCKED' : 'READY',
                reason: 'fixture human hold',
              }
        writeFileSync(
          join(primary, '.ai/scripts/backlog-status.mjs'),
          `
import { writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
export const runStore = () => ${JSON.stringify(join(primary, '.ai/cezar'))}
export const isAlive = () => false
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  writeFileSync(${JSON.stringify(join(primary, 'backlog-call.json'))}, JSON.stringify({ cwd: process.cwd(), runId: process.env.CEZ_RUN_ID }))
  console.log(JSON.stringify(${JSON.stringify(evidence)}))
}
`,
        )
        writeFileSync(
          join(primary, '.ai/cezar/runs.json'),
          JSON.stringify([{ id: 'fixture-run', task: 'Implement issue #42.' }]),
        )
        writeFileSync(
          join(primary, '.ai/cezar/runs/fixture-run.handoff.md'),
          '',
        )
        if (scenario === 'foreign') {
          mkdirSync(join(primary, '.ai/cezar/claims'))
          writeFileSync(
            join(primary, '.ai/cezar/claims/issue-42.json'),
            JSON.stringify({ runId: 'foreign-owner' }),
          )
        }
        if (scenario === 'missing-primary')
          rmSync(join(primary, '.ai/scripts/pipeline-control.mjs'))
        if (scenario === 'wrong-identity') {
          // The common Git directory is valid, but a primary checkout is itself not a task.
          // Place a linked module outside that common directory to exercise source identity fencing.
          const outside = join(scratch, '.ai/scripts')
          mkdirSync(outside, { recursive: true })
          writeFileSync(join(outside, 'pipeline-control.mjs'), source)
          writeFileSync(
            join(outside, 'backlog-status.mjs'),
            readFileSync(join(primary, '.ai/scripts/backlog-status.mjs')),
          )
          copyFileSync(
            new URL('../pr-merge.mjs', import.meta.url),
            join(outside, 'pr-merge.mjs'),
          )
          writeFileSync(
            join(outside, 'pr-state.mjs'),
            'export const readPrState = () => null',
          )
          mkdirSync(join(scratch, 'scripts/agents'), { recursive: true })
          writeFileSync(
            join(scratch, 'scripts/agents/close-fixed-issues.mjs'),
            'export const parseCloseLinks = () => []',
          )
        }
        const workflow = readFileSync(
          new URL(
            '../../cezar/workflows/implement-ticket.yml',
            import.meta.url,
          ),
          'utf8',
        )
        const command = workflow
          .split('  - id: preflight\n')[1]
          .split('  - id: preflight-ready')[0]
          .match(/command: (.+)/)[1]
        const result =
          scenario === 'wrong-identity'
            ? spawnSync(
                process.execPath,
                [
                  join(scratch, '.ai/scripts/pipeline-control.mjs'),
                  'workspace-preflight',
                ],
                { cwd: task, env, encoding: 'utf8' },
              )
            : spawnSync('sh', ['-c', command], {
                cwd: task,
                env,
                encoding: 'utf8',
              })
        if (
          ['incomplete', 'missing-primary', 'wrong-identity'].includes(scenario)
        ) {
          expect(result.status).not.toBe(0)
          expect(result.stdout).not.toContain('PIPELINE_CONTINUE=1')
          return
        }
        expect(result.status, result.stderr).toBe(0)
        expect(result.stdout).toContain(
          `PIPELINE_CONTINUE=${scenario === 'ready' ? 1 : 0}`,
        )
        expect(
          JSON.parse(readFileSync(join(primary, 'backlog-call.json'), 'utf8')),
        ).toEqual({ cwd: task, runId: 'fixture-run' })
        if (scenario === 'foreign')
          expect(
            JSON.parse(
              readFileSync(
                join(primary, '.ai/cezar/claims/issue-42.json'),
                'utf8',
              ),
            ).runId,
          ).toBe('foreign-owner')
      } finally {
        rmSync(scratch, { recursive: true, force: true })
      }
    },
  )

  it('allows restart by the owner but refuses a second run and keeps stages separate', () => {
    const store = mkdtempSync(join(tmpdir(), 'pipeline-claim-'))
    try {
      expect(claimWork(store, 'issue-7', 'run-a')).toBe(true)
      expect(claimWork(store, 'issue-7', 'run-a')).toBe(true)
      expect(claimWork(store, 'issue-7', 'run-b')).toBe(false)
      expect(claimWork(store, 'pr-7', 'run-b')).toBe(true)
      expect(() => claimWork(store, '../issue-8', 'run-b')).toThrow()
    } finally {
      rmSync(store, { recursive: true, force: true })
    }
  })

  it('serializes new-issue creation and refuses foreign release', () => {
    const store = mkdtempSync(join(tmpdir(), 'creation-reservation-'))
    try {
      expect(creationReservation(store, 'run-a')).toBe(true)
      expect(creationReservation(store, 'run-a')).toBe(true)
      expect(creationReservation(store, 'run-b')).toBe(false)
      expect(creationReservation(store, 'run-b', true)).toBe(false)
      expect(creationReservation(store, 'run-b')).toBe(false)
      expect(creationReservation(store, 'run-a', true)).toBe(true)
      expect(creationReservation(store, 'run-b')).toBe(true)
      expect(creationReservation(store, 'run-a', true)).toBe(false)
      expect(() => creationReservation(store, '../owner')).toThrow()
    } finally {
      rmSync(store, { recursive: true, force: true })
    }
  })

  it('invalidates evidence when head, base or policy changes', () => {
    const current = { head: 'abc', base: 'def', policy: 'v1' }
    const record = {
      ...current,
      kind: 'review',
      result: 'passed',
      source: 'report',
    }
    expect(reusableEvidence(record, current)).toBe(true)
    for (const key of Object.keys(current))
      expect(reusableEvidence(record, { ...current, [key]: 'new' })).toBe(false)
    expect(reusableEvidence({ ...record, result: 'pending' }, current)).toBe(
      false,
    )
    expect(reusableEvidence(null, current)).toBe(false)
  })
  it('invalidates review evidence when a routed policy changes', () => {
    const root = mkdtempSync(join(tmpdir(), 'policy-evidence-'))
    try {
      for (const directory of [
        '.ai',
        'scripts/agents',
        '.agents/policies',
        '.agents/reviewers',
        '.agents/workflows',
      ])
        mkdirSync(join(root, directory), { recursive: true })
      for (const path of [
        '.ai/agentic.config.json',
        'AGENTS.md',
        '.agents/policy.json',
        'scripts/agents/skills-upstream.json',
        'SDLC.md',
        'CODE_REVIEW.md',
        'BACKWARD_COMPATIBILITY.md',
        '.agents/policies/security.md',
      ])
        writeFileSync(join(root, path), 'initial')
      const record = {
        kind: 'review',
        result: 'passed',
        source: 'report',
        head: 'same-head',
        base: 'same-base',
        policy: policyDigest(root),
      }
      writeFileSync(
        join(root, '.agents/policies/security.md'),
        'changed policy',
      )
      expect(
        reusableEvidence(record, {
          head: record.head,
          base: record.base,
          policy: policyDigest(root),
        }),
      ).toBe(false)
    } finally {
      rmSync(root, { recursive: true, force: true })
    }
  })

  it.each([
    ['implement-ticket', 'confirm-merge'],
    ['pr-autopilot', 'confirm'],
  ])('reconciles closing issues before completing %s', (name, confirm) => {
    const workflow = readFileSync(
      new URL(`../../cezar/workflows/${name}.yml`, import.meta.url),
      'utf8',
    )
    expect(workflow).toContain(`from: ${confirm}.pass, to: reconcile-issues`)
    expect(workflow).toContain('from: reconcile-issues.reconciled, to: done')
    expect(workflow).toContain('from: reconcile-issues.blocked, to: failed')
    expect(workflow).toContain('atomic issue ownership protocol')
  })

  it.each([
    ['implement-ticket', 'merge'],
    ['pr-autopilot', 'prepare'],
  ])('checks the PR before %s enters native CI waiting', (name, owner) => {
    const workflow = readFileSync(
      new URL(`../../cezar/workflows/${name}.yml`, import.meta.url),
      'utf8',
    )
    expect(workflow).toContain(`from: ${owner}.ready, to: ci-preflight`)
    expect(workflow).toContain('pipeline-control.mjs" ci-preflight')
    expect(workflow).toContain('from: ci-preflight.pass, to: ci')
    expect(workflow).toContain('from: ci-preflight.fail, to: cleanup')
    expect(workflow).toContain('from: ci.green, to: verify-ci')
  })

  it.each([
    { mode: 'ci-preflight', workflow: 'pr-autopilot' },
    { mode: 'ci-preflight', workflow: 'implement-ticket' },
    { mode: 'ci-preflight', pr: { isDraft: true }, error: 'Ready for review' },
    {
      mode: 'ci-preflight',
      pr: { headRefOid: 'stale' },
      error: 'exact worktree head',
    },
    {
      mode: 'ci-preflight',
      pr: { baseRefName: 'main' },
      error: 'configured base',
    },
    {
      mode: 'ci-preflight',
      workflow: 'implement-ticket',
      fork: true,
      error: 'same-repository PR',
    },
    {
      mode: 'ci-preflight',
      workflow: 'triage',
      error: 'Unsupported Cezar delivery workflow',
    },
    { mode: 'ci', snapshot: { ci: { state: 'green' } } },
    { mode: 'merge', error: 'active autonomous Cezar graph' },
    {
      mode: 'ci',
      snapshot: { head: 'changed', ci: { state: 'green' } },
      error: 'passing checks on the exact',
    },
    { mode: 'confirm-merge', pr: { state: 'OPEN' }, error: 'must be MERGED' },
    {
      mode: 'confirm-merge',
      pr: { state: 'MERGED', mergeCommit: { oid: 'merge' } },
    },
  ])(
    'verifies the delivery target in $mode ($workflow, $error)',
    ({
      mode,
      workflow = 'pr-autopilot',
      pr = {},
      snapshot = {},
      fork = false,
      error,
    }) => {
      const root = realpathSync(mkdtempSync(join(tmpdir(), 'pipeline-ci-')))
      try {
        const primary = join(root, 'primary')
        const task = join(root, 'task')
        const store = join(primary, '.ai/cezar')
        const helper = join(primary, '.ai/scripts/pipeline-control.mjs')
        for (const path of [
          join(primary, '.ai/scripts'),
          join(store, 'runs'),
          join(store, 'claims'),
          join(primary, 'scripts/ci'),
          join(primary, 'scripts/agents'),
          task,
        ])
          mkdirSync(path, { recursive: true })
        writeFileSync(
          join(primary, 'scripts/ci/validation.mjs'),
          "process.exitCode = process.argv[2] === '--check-delivery' ? 0 : 1\n",
        )
        copyFileSync(
          new URL('../pipeline-control.mjs', import.meta.url),
          helper,
        )
        writeFileSync(
          join(primary, '.ai/agentic.config.json'),
          '{"baseBranch":"develop"}',
        )
        writeFileSync(
          join(primary, '.ai/scripts/backlog-status.mjs'),
          `export const runStore = () => ${JSON.stringify(store)}; export const isAlive = () => false`,
        )
        copyFileSync(
          new URL('../pr-merge.mjs', import.meta.url),
          join(primary, '.ai/scripts/pr-merge.mjs'),
        )
        writeFileSync(
          join(primary, '.ai/scripts/pr-state.mjs'),
          `
        export function readPrState(repo, number) {
          if (repo !== 'owner/repo' || number !== 42) throw new Error('Wrong PR target')
          return JSON.parse(process.env.PR_FIXTURE_SNAPSHOT)
        }
      `,
        )
        writeFileSync(
          join(primary, 'scripts/agents/close-fixed-issues.mjs'),
          'export const parseCloseLinks = () => []',
        )
        writeFileSync(
          join(store, 'runs.json'),
          JSON.stringify([{ id: 'fixture', task: '42', workflow }]),
        )
        const number = workflow === 'implement-ticket' ? 7 : 42
        const claim = join(store, 'claims', `pr-${number}.json`)
        writeFileSync(claim, '{"runId":"fixture"}')
        const foreignClaim = join(store, 'claims', 'pr-99.json')
        writeFileSync(foreignClaim, '{"runId":"another"}')
        if (mode === 'confirm-merge' && !error) {
          for (const path of [
            '.ai/agentic.config.json',
            'AGENTS.md',
            '.agents/policy.json',
            'scripts/agents/skills-upstream.json',
            'SDLC.md',
            'CODE_REVIEW.md',
            'BACKWARD_COMPATIBILITY.md',
          ]) {
            mkdirSync(join(task, path, '..'), { recursive: true })
            writeFileSync(join(task, path), 'fixture')
          }
          for (const path of ['policies', 'reviewers', 'workflows'])
            mkdirSync(join(task, '.agents', path))
        }
        writeFileSync(
          join(root, 'git'),
          `#!/bin/sh
case "$*" in
  'rev-parse HEAD') printf '%s\n' 'exact-head' ;;
  'branch --show-current') printf '%s\n' 'cez/generated-branch' ;;
  *) exit 9 ;;
esac
`,
          { mode: 0o700 },
        )
        writeFileSync(
          join(root, 'gh'),
          `#!/bin/sh
case "$*" in
  'repo view --json nameWithOwner') printf '%s\n' '{"nameWithOwner":"owner/repo"}' ;;
  'pr list --repo owner/repo --head cez/generated-branch --state open --limit 100 --json number,headRefName,headRefOid,baseRefName,isCrossRepository') printf '%s\n' "$PR_FIXTURE_LIST" ;;
  "pr view $PR_FIXTURE_NUMBER --repo owner/repo --json number,state,isDraft,headRefOid,baseRefName,mergeCommit") printf '%s\n' "$PR_FIXTURE" ;;
  *) exit 9 ;;
esac
`,
          { mode: 0o700 },
        )
        const result = spawnSync(process.execPath, [helper, mode], {
          cwd: task,
          encoding: 'utf8',
          env: {
            PATH: root,
            CEZ_RUN_ID: 'fixture',
            PR_FIXTURE_NUMBER: String(number),
            PR_FIXTURE: JSON.stringify({
              number,
              state: 'OPEN',
              isDraft: false,
              headRefOid: 'exact-head',
              baseRefName: 'develop',
              ...pr,
            }),
            PR_FIXTURE_SNAPSHOT: JSON.stringify({
              number,
              state: 'OPEN',
              draft: false,
              head: 'exact-head',
              base: 'develop',
              ...snapshot,
            }),
            PR_FIXTURE_LIST: JSON.stringify([
              {
                number: 7,
                headRefName: 'cez/generated-branch',
                headRefOid: 'exact-head',
                baseRefName: 'develop',
                isCrossRepository: fork,
              },
            ]),
          },
        })
        expect(result.status, result.stderr).toBe(error ? 1 : 0)
        if (error) expect(result.stderr).toContain(error)
        else if (mode === 'ci-preflight')
          expect(result.stdout).toContain(`PR #${number} is ready for CI`)
        if (mode === 'confirm-merge' && !error) {
          expect(
            readFileSync(join(store, 'runs/fixture.handoff.md'), 'utf8'),
          ).toContain('"outcome":"merged"')
          expect(() => readFileSync(claim)).toThrow()
        } else {
          expect(readFileSync(claim, 'utf8')).toBe('{"runId":"fixture"}')
        }
        expect(readFileSync(foreignClaim, 'utf8')).toBe('{"runId":"another"}')
      } finally {
        rmSync(root, { recursive: true, force: true })
      }
    },
  )

  it.each([
    ['implement-ticket', 'approve', 'confirm-merge'],
    ['pr-autopilot', 'merge', 'confirm'],
  ])(
    'executes the exact verified develop merge as a check in %s',
    (name, merge, confirm) => {
      const workflow = readFileSync(
        new URL(`../../cezar/workflows/${name}.yml`, import.meta.url),
        'utf8',
      )
      const node = workflow.split(`  - id: ${merge}\n`)[1].split('  - id: ')[0]
      expect(node).toContain('type: check')
      expect(node).toContain('pipeline-control.mjs" merge')
      expect(workflow).toContain(`from: verify-ci.pass, to: ${merge}`)
      expect(workflow).toContain(`from: ${merge}.pass, to: ${confirm}`)
      expect(workflow).toContain(`from: ${merge}.fail, to: cleanup`)
      expect(workflow).toContain(`from: ${confirm}.pass, to: reconcile-issues`)
    },
  )

  it('accepts only issue tasks and never interpolates free text into Bash', () => {
    expect(issueFromTask('Implement issue #123.')).toBe(123)
    expect(issueFromTask('#123')).toBe(123)
    expect(issueFromTask('')).toBeNull()
    expect(() => issueFromTask('Implement issue #123; exit 0')).toThrow()
    expect(() => issueFromTask('99999999999999999999')).toThrow()
  })

  it('stops on anchored evidence and fails closed for a missing issue or empty STOP', () => {
    expect(mayContinue('ISSUE: #7\nSTOP: Already delivered\n')).toBe(false)
    expect(mayContinue('ISSUE: #7\nA quoted `STOP:` is not a stop.')).toBe(true)
    expect(() => mayContinue('No evidence')).toThrow()
    expect(() => mayContinue('ISSUE: #7\nSTOP:')).toThrow()
    expect(() => mayContinue('ISSUE: #7\nISSUE: #8')).toThrow()
  })

  it('routes STOP around validation, PR and merge without starting an agent', () => {
    const workflow = readFileSync(
      new URL('../../cezar/workflows/implement-ticket.yml', import.meta.url),
      'utf8',
    )
    expect(workflow).toContain('version: 2')
    for (const node of [
      'preflight',
      'after-implement',
      'before-pr',
      'before-merge',
    ]) {
      expect(workflow).toContain(`from: ${node}-ready.false, to: noop`)
      expect(workflow).toContain(`ref: ${node}.output`)
    }
    expect(workflow).toContain('from: after-implement-ready.true, to: gate')
    expect(workflow).toContain('from: before-pr-ready.true, to: pr')
    expect(workflow).toContain('from: before-merge-ready.true, to: merge')
  })

  it('settles merge outcomes without treating a blocked PR as success', () => {
    const workflow = readFileSync(
      new URL('../../cezar/workflows/implement-ticket.yml', import.meta.url),
      'utf8',
    )
    const merge = workflow
      .split('  - id: merge\n')[1]
      .split('  - id: after-implement\n')[0]
    expect(merge).toContain('verdicts: [merged, blocked, skipped, ready]')
    expect(merge).not.toContain('CEZ:DONE')
    expect(merge).toContain('CEZ:VERDICT merged')
    expect(merge).toContain('CEZ:VERDICT blocked')
    expect(merge).toContain('CEZ:VERDICT skipped')
    expect(workflow).toContain('from: merge.merged, to: confirm-merge')
    expect(workflow).toContain('from: merge.blocked, to: failed')
    expect(workflow).toContain('from: merge.skipped, to: noop')
    expect(workflow).toContain('from: merge.failed, to: failed')
    expect(workflow).not.toContain('from: merge.done, to: done')
  })
})
