import { describe, expect, it } from 'vitest'
import { judgeChecks, readPrState, waitForPr } from '../pr-state.mjs'

const check = (name, conclusion = 'success') => ({
  name,
  status: 'completed',
  conclusion,
  app: { id: 1 },
})
const evidence = (over = {}) => ({
  checks: [check('unit')],
  statuses: [],
  runs: [{ status: 'completed', conclusion: 'success' }],
  required: [{ context: 'unit', app_id: 1 }],
  readable: true,
  ...over,
})

describe('PR CI evidence', () => {
  const reader = ({
    changeHead = false,
    changeBase = false,
    hiddenApps = false,
    requiredApp = 1,
    hiddenRules = false,
  } = {}) => {
    let pulls = 0
    const calls = []
    const read = (args) => {
      calls.push(args)
      const path = args.at(-1)
      if (path.endsWith('/pulls/7')) {
        const refreshed = pulls++ > 0
        return {
          head: { sha: changeHead && refreshed ? 'new' : 'head' },
          base: {
            ref: changeBase && refreshed ? 'main' : 'develop',
            sha: 'base',
          },
          state: 'open',
          labels: [],
          draft: false,
          mergeable: true,
        }
      }
      if (path.includes('/check-runs')) {
        if (hiddenApps) throw new Error('403')
        return [
          { check_runs: [check('unit')] },
          { check_runs: [check('external')] },
        ]
      }
      if (path.includes('/statuses?')) return [[]]
      if (path.includes('/actions/runs?'))
        return [
          {
            workflow_runs: [
              {
                head_sha: 'head',
                event: 'pull_request',
                workflow_id: 1,
                status: 'completed',
                conclusion: 'success',
              },
            ],
          },
        ]
      if (path.includes('/rules/branches/')) {
        if (hiddenRules) throw new Error('403')
        return [
          [
            {
              type: 'required_status_checks',
              parameters: {
                required_status_checks: [
                  { context: 'unit', integration_id: requiredApp },
                ],
              },
            },
          ],
        ]
      }
      if (path.includes('/protection/')) throw new Error('403')
      if (path.includes('/reviews?'))
        return [[{ user: { login: 'reviewer' }, state: 'APPROVED' }]]
      throw new Error(`Unexpected path ${path}`)
    }
    return { read, calls }
  }

  it('paginates all evidence sources and maps the required integration identity', () => {
    const { read, calls } = reader()
    const result = readPrState('owner/repo', 7, read)
    expect(result.ci.state).toBe('green')
    expect(result.ci.checks).toBe(2)
    expect(result.review).toBe('approved')
    expect(calls.filter((c) => c.includes('--paginate'))).toHaveLength(5)
    expect(
      readPrState('owner/repo', 7, reader({ requiredApp: 2 }).read).ci.state,
    ).toBe('pending')
  })

  it('refuses green on a changed head, hidden app checks or unknown requirements', () => {
    const retargeted = readPrState(
      'owner/repo',
      7,
      reader({ changeBase: true }).read,
    )
    expect(retargeted.base).toBe('main')
    expect(retargeted.ci.state).toBe('pending')
    const changed = readPrState(
      'owner/repo',
      7,
      reader({ changeHead: true }).read,
    )
    expect(changed.head).toBe('new')
    expect(changed.ci.state).toBe('pending')
    expect(
      readPrState('owner/repo', 7, reader({ hiddenApps: true }).read).ci.state,
    ).toBe('unknown')
    expect(
      readPrState('owner/repo', 7, reader({ hiddenRules: true }).read).ci.state,
    ).toBe('unknown')
  })

  it('requires named checks and their required app, including external checks', () => {
    expect(judgeChecks(evidence()).state).toBe('green')
    expect(
      judgeChecks(evidence({ required: [{ context: 'external' }] })).state,
    ).toBe('pending')
    expect(
      judgeChecks(evidence({ required: [{ context: 'unit', app_id: 2 }] }))
        .state,
    ).toBe('pending')
    expect(
      judgeChecks(
        evidence({ checks: [check('unit'), check('external', 'failure')] }),
      ).state,
    ).toBe('red')
  })

  it('never declares partial, unreadable, or empty evidence green', () => {
    expect(judgeChecks(evidence({ runs: [{ status: 'queued' }] })).state).toBe(
      'pending',
    )
    expect(judgeChecks(evidence({ readable: false })).state).toBe('unknown')
    expect(
      judgeChecks(
        evidence({ runs: [{ status: 'completed', conclusion: null }] }),
      ).state,
    ).toBe('unknown')
    expect(
      judgeChecks(evidence({ checks: [], required: [], runs: [] })).state,
    ).toBe('pending')
    expect(
      judgeChecks(evidence({ checks: [check('unit', 'neutral')] })).state,
    ).toBe('green')
    expect(
      judgeChecks(evidence({ checks: [check('unit', 'cancelled')] })).state,
    ).toBe('red')
  })

  it('includes legacy commit statuses and treats unknown conclusions as unknown', () => {
    expect(
      judgeChecks(
        evidence({
          required: [{ context: 'vendor' }],
          statuses: [{ context: 'vendor', state: 'success' }],
        }),
      ).state,
    ).toBe('green')
    expect(
      judgeChecks(evidence({ checks: [check('unit', 'new-provider-value')] }))
        .state,
    ).toBe('unknown')
  })

  it('waits for the new head and ends on timeout or unreadable evidence', async () => {
    let now = 0
    let calls = 0
    const snapshots = [
      { state: 'OPEN', head: 'old', ci: { state: 'pending' } },
      { state: 'OPEN', head: 'new', ci: { state: 'green' } },
    ]
    const result = await waitForPr(() => snapshots[Math.min(calls++, 1)], {
      timeoutMs: 10,
      pollMs: 1,
      now: () => now,
      sleep: async () => {
        now++
      },
    })
    expect(result.head).toBe('new')
    expect(calls).toBe(2)
    const timeout = await waitForPr(() => snapshots[0], {
      timeoutMs: 1,
      pollMs: 1,
      now: () => now,
      sleep: async () => {
        now++
      },
    })
    expect(timeout.timedOut).toBe(true)
    expect(
      (await waitForPr(() => ({ ci: { state: 'unknown' }, state: 'OPEN' }))).ci
        .state,
    ).toBe('unknown')
  })
})
