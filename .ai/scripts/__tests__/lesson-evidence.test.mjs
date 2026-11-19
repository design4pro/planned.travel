import { describe, expect, it } from 'vitest'
import { summarizeDeliveryRuns } from '../lesson-evidence.mjs'

const now = new Date('2026-11-18T12:00:00Z')
const step = (id, status) => ({ id, status, output: 'raw output' })
const run = (overrides = {}) => ({
  id: '11111111-aaaa-4444-8888-222222222222',
  workflow: 'pr-autopilot',
  status: 'done',
  finishedAt: '2026-11-18T11:00:00Z',
  prNumber: 1939,
  task: 'raw task',
  error: 'raw error',
  steps: [],
  ...overrides,
})

describe('Cezar retrospective evidence', () => {
  it('flags a settled continuation whose native merge checks never ran', () => {
    const evidence = summarizeDeliveryRuns(
      [
        run({
          steps: [
            step('preflight', 'failed'),
            step('ci', 'pending'),
            step('confirm', 'pending'),
            step('continue-1', 'done'),
            step('arbitrary text', 'done'),
          ],
        }),
      ],
      now,
    )
    expect(evidence.runs[0]).toMatchObject({
      pr: 1939,
      nativeDelivery: 'unverified',
      continuationCount: 1,
      steps: [
        { id: 'preflight', status: 'failed' },
        { id: 'ci', status: 'pending' },
        { id: 'confirm', status: 'pending' },
      ],
    })
    expect(JSON.stringify(evidence)).not.toMatch(/raw|arbitrary text/)
  })

  it('distinguishes native CI delivery from confirmation after a continuation', () => {
    const steps = [
      'ci',
      'verify-ci',
      'approve',
      'confirm-merge',
      'reconcile-issues',
    ].map((id) => step(id, 'done'))
    const clean = run({ workflow: 'implement-ticket', steps })
    const resumed = run({
      workflow: 'implement-ticket',
      steps: [...steps, step('continue-1', 'done')],
    })
    expect(
      summarizeDeliveryRuns([clean, resumed], now).runs.map(
        (row) => row.nativeDelivery,
      ),
    ).toEqual(['ci-to-confirm', 'confirm-only'])
  })

  it('bounds duplicated steps and treats their result as ambiguous', () => {
    const evidence = summarizeDeliveryRuns(
      [
        run({
          steps: [
            ...Array.from({ length: 300 }, () => step('confirm', 'done')),
            step('reconcile-issues', 'done'),
          ],
        }),
      ],
      now,
    )
    expect(evidence.runs[0].nativeDelivery).toBe('unverified')
    expect(evidence.runs[0].steps).toEqual([
      { id: 'confirm', status: 'ambiguous' },
      { id: 'reconcile-issues', status: 'done' },
    ])
  })

  it('excludes active and out-of-window runs and bounds the report', () => {
    const repeated = Array.from({ length: 35 }, (_, index) =>
      run({ id: `11111111-aaaa-4444-8888-${String(index).padStart(12, '0')}` }),
    )
    const evidence = summarizeDeliveryRuns(
      [
        ...repeated,
        run({ status: 'running' }),
        run({ status: 'failed', autoResumeAt: '2026-11-18T12:10:00Z' }),
        run({ finishedAt: '2026-11-01T11:00:00Z' }),
        run({ workflow: 'other workflow' }),
        run({ finishedAt: '2026-11-19T11:00:00Z' }),
      ],
      now,
    )
    expect(evidence.eligible).toBe(35)
    expect(evidence.runs).toHaveLength(30)
  })
})
