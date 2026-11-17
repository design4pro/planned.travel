import { describe, expect, it } from 'vitest'
import { keepDiagnostics } from '../e2e-diagnostics.mjs'

describe('diagnostic retention', () => {
  const summary = {
    passed: 1,
    failed: 0,
    flaky: 0,
    skipped: 0,
    interrupted: 0,
    selected: 1,
    executed: 1,
  }
  const passed = { run: { summary } }
  it('does not upload an ordinary successful run', () => {
    expect(keepDiagnostics('success', passed)).toBe(false)
  })
  it('keeps a failure recovered by retry', () => {
    expect(
      keepDiagnostics('success', {
        run: { summary: { ...summary, flaky: 1 } },
      }),
    ).toBe(true)
  })
  it.each(['failure', 'cancelled', 'skipped', undefined])(
    'keeps evidence when tests are %s',
    (outcome) => {
      expect(keepDiagnostics(outcome, passed)).toBe(true)
    },
  )
  it('preserves unexpected failures even if the caller reports success', () => {
    expect(
      keepDiagnostics('success', {
        run: { summary: { ...summary, failed: 1 } },
      }),
    ).toBe(true)
  })
  it.each([undefined, null, {}, { stats: {} }])(
    'keeps evidence for an incomplete report %j',
    (report) => {
      expect(keepDiagnostics('success', report)).toBe(true)
    },
  )
})
