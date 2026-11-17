import { describe, expect, it } from 'vitest'
import { runSuites } from '../run.mjs'

describe('the combined e2e verdict', () => {
  it.each([
    [0, 0, 0],
    [1, 0, 1],
    [0, 1, 1],
    [3, 1, 3],
  ])(
    'runs both suites and preserves failure (%i, %i)',
    async (native, browser, expected) => {
      const calls = []
      const results = [native, browser]
      const exit = await runSuites(async (args) => {
        calls.push(args)
        return results.shift()
      })
      expect(calls).toEqual([
        ['exec', 'e2e', 'run'],
        ['exec', 'e2e', 'run', '--config', 'e2e.browser.config.ts'],
      ])
      expect(exit).toBe(expected)
    },
  )
})
