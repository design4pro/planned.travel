/**
 * The one coupling in `settle.ts` that fails silently.
 *
 * `settle()` retries on a failure whose text reads as a navigation, because a
 * route that hydrates into a redirect tears its own execution context down and
 * that is not a defect. `settleOnce()` appends a hydration diagnostic to that
 * same text when the wait times out — and the diagnostic names DOM nodes, which
 * on this product are liable to be called `navigation` something.
 *
 * So the two are one contract: whatever the diagnostic says, a hard timeout must
 * stay hard. Getting that wrong is invisible in CI — the shard does not fail, it
 * spends its budget three times over and then fails the same way, which is the
 * failure mode #466 is about.
 *
 * These cases compose the real functions rather than restating their patterns.
 * A test that re-declared the regular expression would keep passing on exactly
 * the edit that lets the two drift apart.
 */

import { describe, expect, test } from 'vitest'
import { readsAsTransient, scrubbedOfRetryTriggers } from '../settle'

/**
 * A hydration timeout as Playwright words it, before anything is appended.
 *
 * Deliberately free of both retry patterns: every case below that comes out
 * transient has to have been made so by the diagnostic, not by the message it
 * was appended to.
 */
const TIMEOUT = 'page.waitForFunction: Timeout 10000ms exceeded.'

/** What `settleOnce()` builds and then throws. */
function annotated(detail: string): string {
  return `${TIMEOUT}\nhydration: ${scrubbedOfRetryTriggers(detail)}`
}

describe('a hydration diagnostic can never buy itself a retry', () => {
  test.each([
    ['a node named after its source file', 'last is nav from navigation.tsx'],
    ['a class the design system really uses', 'last is div#navigation-rail'],
    ['the pattern in caps', 'last is section from NAVIGATION'],
    [
      'the other retry trigger, quoted back',
      'Execution context was destroyed while reading the tree',
    ],
  ])('%s', (_case, detail) => {
    expect(readsAsTransient(annotated(detail))).toBe(false)
  })

  test('scrubbing cannot splice a fresh trigger out of two fragments', () => {
    expect(readsAsTransient(annotated('navinavigationgation'))).toBe(false)
  })

  test('the diagnostic still survives scrubbing well enough to read', () => {
    const detail = '412 elements under #root, 1 without a fiber; last is nav'
    expect(annotated(detail)).toContain('412 elements under #root')
    expect(annotated(detail)).toContain('1 without a fiber')
  })
})

describe('a genuinely transient failure is still retried', () => {
  test.each([
    ['the context torn down by a redirect', 'Execution context was destroyed'],
    [
      'a navigation reported mid-evaluate',
      'frame was detached by a navigation',
    ],
  ])('%s', (_case, message) => {
    expect(readsAsTransient(message)).toBe(true)
  })

  test('and stays retried once a scrubbed diagnostic is appended to it', () => {
    const transient = 'Execution context was destroyed'
    expect(readsAsTransient(`${transient}\nhydration: last is div#root`)).toBe(
      true,
    )
  })
})
