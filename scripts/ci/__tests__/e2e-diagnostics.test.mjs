import { describe, expect, it } from 'vitest'
import { keepDiagnostics } from '../e2e-diagnostics.mjs'

describe('diagnostic retention', () => {
  const passed = { stats: { flaky: 0, unexpected: 0 } }
  it('does not upload an ordinary successful run', () => {
    expect(keepDiagnostics('success', passed)).toBe(false)
  })
  it('keeps a failure recovered by retry', () => {
    expect(
      keepDiagnostics('success', { stats: { flaky: 1, unexpected: 0 } }),
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
      keepDiagnostics('success', { stats: { flaky: 0, unexpected: 1 } }),
    ).toBe(true)
  })
  it.each([undefined, null, {}, { stats: {} }])(
    'keeps evidence for an incomplete report %j',
    (report) => {
      expect(keepDiagnostics('success', report)).toBe(true)
    },
  )
})
