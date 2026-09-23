import { describe, expect, it } from 'vitest'
import { decideMerge, runSelection } from '../auto-merge-develop.mjs'

const headSha = 'a'.repeat(40)
const baseSha = 'b'.repeat(40)
const labels = (names) => names.map((name) => ({ name }))
const pr = {
  number: 81,
  state: 'open',
  draft: false,
  title: 'Fix trip form',
  body: 'Closes #42',
  user: { login: 'implementer' },
  labels: labels(['risk-low', 'skip-qa']),
  head: { sha: headSha, repo: { full_name: 'design4pro/planned.travel' } },
  base: {
    sha: baseSha,
    ref: 'develop',
    repo: { full_name: 'design4pro/planned.travel' },
  },
  mergeable: true,
  mergeable_state: 'clean',
}
const issue = { number: 42, state: 'open', labels: labels(['risk-low']) }
const review = {
  user: { login: 'reviewer-app[bot]' },
  state: 'APPROVED',
  commit_id: headSha,
  body: `Reviewed SHA: ${headSha}`,
  submitted_at: '2026-09-23T09:00:00Z',
}
const checks = [
  'lint · typecheck · build',
  'unit tests',
  'e2e · merged report',
  'merge-gate',
].map((name) => ({
  name,
  head_sha: headSha,
  app: { id: 15368 },
  conclusion: 'success',
  started_at: '2026-09-23T09:00:00Z',
}))
const ready = {
  pr,
  issues: [issue],
  reviews: [review],
  checks,
  threads: [],
  comparison: { status: 'ahead', behind_by: 0 },
  qaComments: [],
  reviewDecision: 'APPROVED',
  trustedReviewers: ['reviewer-app[bot]'],
  trustedQaReviewers: ['qa-maintainer'],
}
const decide = (changes = {}) => decideMerge({ ...ready, ...changes })

describe('auto-merge develop admission', () => {
  it('accepts a reviewed, current, low-risk PR', () => {
    expect(decide()).toEqual({
      number: 81,
      headSha,
      baseSha,
      eligible: true,
      reasons: [],
    })
  })
  it.each([[[]], [['risk-low', 'risk-medium']], [['risk-high']]])(
    'rejects PR risk labels %j',
    (risk) => {
      expect(decide({ pr: { ...pr, labels: labels(risk) } }).eligible).toBe(
        false,
      )
    },
  )
  it('rejects high risk on the linked issue alone', () => {
    expect(
      decide({ issues: [{ ...issue, labels: labels(['risk-high']) }] })
        .eligible,
    ).toBe(false)
  })
  it('rejects a closing reference to a pull request', () => {
    expect(
      decide({ issues: [{ ...issue, pull_request: { url: 'example' } }] })
        .eligible,
    ).toBe(false)
  })
  it('does not merge security work labeled as medium risk', () => {
    expect(
      decide({
        issues: [{ ...issue, labels: labels(['risk-medium', 'security']) }],
      }).eligible,
    ).toBe(false)
  })
  it.each([
    'blocked',
    'do-not-merge',
    'changes-requested',
    'qa-failed',
    'in-progress',
  ])('rejects the %s hold', (name) => {
    expect(
      decide({ pr: { ...pr, labels: labels(['risk-low', name]) } }).eligible,
    ).toBe(false)
    expect(
      decide({
        issues: [{ ...issue, labels: labels(['risk-low', name]) }],
      }).eligible,
    ).toBe(false)
  })
  it('does not ignore needs-qa on the issue', () => {
    expect(
      decide({
        issues: [{ ...issue, labels: labels(['risk-low', 'needs-qa']) }],
      }).eligible,
    ).toBe(false)
  })
  it('rejects missing or unlinked implementation issues', () => {
    expect(decide({ pr: { ...pr, body: 'Refs #42' } }).eligible).toBe(false)
    expect(decide({ issues: [] }).eligible).toBe(false)
  })
  it('rejects draft, fork, and main promotion', () => {
    expect(decide({ pr: { ...pr, draft: true } }).eligible).toBe(false)
    expect(
      decide({
        pr: { ...pr, head: { ...pr.head, repo: { full_name: 'fork/repo' } } },
      }).eligible,
    ).toBe(false)
    expect(
      decide({ pr: { ...pr, base: { ...pr.base, ref: 'main' } } }).eligible,
    ).toBe(false)
  })
  it('requires a trusted independent approval for the current SHA', () => {
    expect(
      decide({ reviews: [{ ...review, commit_id: baseSha }] }).eligible,
    ).toBe(false)
    expect(decide({ reviews: [{ ...review, user: pr.user }] }).eligible).toBe(
      false,
    )
    expect(decide({ reviews: [{ ...review, body: '' }] }).eligible).toBe(false)
    expect(
      decide({ reviews: [{ ...review, state: 'COMMENTED' }] }).eligible,
    ).toBe(false)
  })
  it('blocks a later change request and unresolved threads', () => {
    const changes = {
      ...review,
      state: 'CHANGES_REQUESTED',
      submitted_at: '2026-09-23T10:00:00Z',
    }
    expect(decide({ reviews: [review, changes] }).eligible).toBe(false)
    expect(decide({ reviewDecision: 'CHANGES_REQUESTED' }).eligible).toBe(false)
    expect(
      decide({ threads: [{ isResolved: false, isOutdated: false }] }).eligible,
    ).toBe(false)
  })
  it('requires QA evidence for the current SHA whenever needs-qa is set', () => {
    const qaPr = {
      ...pr,
      labels: labels(['risk-low', 'needs-qa', 'qa-approved']),
    }
    expect(decide({ pr: qaPr }).eligible).toBe(false)
    expect(
      decide({
        pr: qaPr,
        qaComments: [
          {
            user: { login: 'qa-maintainer' },
            body: `QA-approved SHA: ${headSha}`,
          },
        ],
      }).eligible,
    ).toBe(true)
    expect(
      decide({
        pr: qaPr,
        qaComments: [
          {
            user: { login: 'qa-maintainer' },
            body: `QA-approved SHA: ${baseSha}`,
          },
        ],
      }).eligible,
    ).toBe(false)
  })
  it('rejects a failed, stale, or missing required check and stale base', () => {
    expect(
      decide({
        checks: checks.map((check) => ({ ...check, head_sha: baseSha })),
      }).eligible,
    ).toBe(false)
    expect(decide({ checks: checks.slice(1) }).eligible).toBe(false)
    expect(
      decide({ checks: checks.map((check) => ({ ...check, app: { id: 1 } })) })
        .eligible,
    ).toBe(false)
    expect(
      decide({
        checks: [
          {
            ...checks[0],
            conclusion: 'failure',
            started_at: '2026-09-23T10:00:00Z',
          },
          ...checks,
        ],
      }).eligible,
    ).toBe(false)
    expect(
      decide({ comparison: { status: 'diverged', behind_by: 1 } }).eligible,
    ).toBe(false)
  })
})

describe('auto-merge develop execution', () => {
  const older = { number: 1, created_at: '2026-09-22T00:00:00Z' }
  const newer = { number: 2, created_at: '2026-09-23T00:00:00Z' }
  const accepted = (number, head = headSha, base = baseSha) => ({
    number,
    headSha: head,
    baseSha: base,
    eligible: true,
    reasons: [],
  })
  it('merges only the oldest eligible PR after a second inspection', () => {
    const inspected = []
    const merged = []
    runSelection([newer, older], {
      apply: true,
      inspect: (item) => {
        inspected.push(item.number)
        return accepted(item.number)
      },
      merge: (result) => merged.push(result),
      log: () => {},
    })
    expect(inspected).toEqual([1, 1])
    expect(merged).toEqual([accepted(1)])
  })
  it.each(['headSha', 'baseSha'])('skips when %s changes', (key) => {
    let reads = 0
    const merged = []
    const errors = []
    runSelection([older], {
      apply: true,
      inspect: () => {
        reads++
        return reads === 1
          ? accepted(1)
          : { ...accepted(1), [key]: 'c'.repeat(40) }
      },
      merge: (result) => merged.push(result),
      log: (message, error) => {
        if (error) errors.push(message)
      },
    })
    expect(merged).toEqual([])
    expect(errors).toHaveLength(1)
  })
  it('fails closed on an API error and in dry-run mode', () => {
    const merged = []
    const errors = []
    runSelection([older], {
      apply: true,
      inspect: () => {
        throw new Error('API unavailable')
      },
      merge: (result) => merged.push(result),
      log: (message, error) => {
        if (error) errors.push(message)
      },
    })
    runSelection([older], {
      apply: false,
      inspect: () => accepted(1),
      merge: (result) => merged.push(result),
      log: () => {},
    })
    expect(merged).toEqual([])
    expect(errors).toHaveLength(1)
  })
})
