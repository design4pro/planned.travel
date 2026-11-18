import { spawnSync } from 'node:child_process'
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
    expect(workflow).toContain('from: ci-preflight.fail, to: failed')
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
          join(primary, 'scripts/agents'),
          task,
        ])
          mkdirSync(path, { recursive: true })
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
