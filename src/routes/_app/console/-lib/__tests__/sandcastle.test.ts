import { describe, expect, it } from 'vitest'

import { consoleTranslate as t } from '#/lib/i18n/__tests__/console-translate'
import {
  formatElapsed,
  formatLease,
  orderWip,
  summariseFleet,
} from '../sandcastle'

import type { RegistryState, RunView, WipView } from '#/server/do'

const MINUTE = 60_000
const NOW = 1_800_000_000_000

function run(overrides: Partial<RunView> = {}): RunView {
  return {
    runId: '20260830-1',
    repo: 'design4pro/planned.travel',
    origin: 'local',
    kind: 'afk-loop',
    host: 'laptop',
    integrationBranch: 'sandcastle/run-20260830-1',
    stage: 'implementing',
    status: 'active',
    startedAt: NOW - 30 * MINUTE,
    lastHeartbeatAt: NOW - MINUTE,
    expiresAt: NOW + 4 * MINUTE,
    summary: '',
    issues: ['106', '108'],
    ...overrides,
  }
}

function wip(overrides: Partial<WipView> = {}): WipView {
  return {
    issueId: '106',
    branch: 'sandcastle/issue-106-20260829-1',
    commits: 3,
    runId: '20260829-1',
    updatedAt: NOW - 10 * MINUTE,
    orphaned: false,
    ...overrides,
  }
}

function state(overrides: Partial<RegistryState> = {}): RegistryState {
  return { now: NOW, active: [], recent: [], wip: [], ...overrides }
}

describe('summariseFleet', () => {
  it('counts issues across every live run, not runs', () => {
    const summary = summariseFleet(
      state({
        active: [run(), run({ runId: '20260830-2', issues: ['110'] })],
      }),
    )

    expect(summary).toEqual({
      liveRuns: 2,
      issuesHeld: 3,
      orphanedBranches: 0,
    })
  })

  it('counts only the branches no live run holds', () => {
    // A branch being worked on right now is not waiting for anybody.
    const summary = summariseFleet(
      state({ wip: [wip(), wip({ issueId: '108', orphaned: true })] }),
    )

    expect(summary.orphanedBranches).toBe(1)
  })
})

describe('orderWip', () => {
  it('puts orphans first, then the most recently touched', () => {
    const ordered = orderWip([
      wip({ issueId: '101', updatedAt: NOW - MINUTE }),
      wip({ issueId: '102', orphaned: true, updatedAt: NOW - 90 * MINUTE }),
      wip({ issueId: '103', orphaned: true, updatedAt: NOW - 2 * MINUTE }),
    ])

    expect(ordered.map((entry) => entry.issueId)).toEqual(['103', '102', '101'])
  })

  it('leaves the input alone', () => {
    const input = [
      wip({ issueId: '101' }),
      wip({ issueId: '102', orphaned: true }),
    ]
    orderWip(input)

    expect(input.map((entry) => entry.issueId)).toEqual(['101', '102'])
  })
})

describe('formatElapsed', () => {
  it('coarsens as the duration grows', () => {
    expect(formatElapsed(47_000)).toBe('47s')
    expect(formatElapsed(12 * MINUTE)).toBe('12m')
    expect(formatElapsed(3 * 60 * MINUTE)).toBe('3h')
    expect(formatElapsed(3 * 60 * MINUTE + 12 * MINUTE)).toBe('3h 12m')
    expect(formatElapsed(48 * 60 * MINUTE)).toBe('2d')
    expect(formatElapsed(51 * 60 * MINUTE)).toBe('2d 3h')
  })

  it('never renders a negative duration', () => {
    expect(formatElapsed(-5_000)).toBe('0s')
  })
})

describe('formatLease', () => {
  it('counts down from the registry’s clock, never the browser’s', () => {
    expect(formatLease(t, NOW + 4 * MINUTE, NOW)).toBe('4m left')
  })

  it('says a lapsed lease has lapsed', () => {
    // The sweep runs on a one-minute alarm, so a run can be visibly past its lease for up to a
    // minute before it is reaped. That is a state to show, not a number to negate.
    expect(formatLease(t, NOW - 1000, NOW)).toBe('expired')
  })
})
