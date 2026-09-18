/**
 * #490: an om-auto-fix-pr run pushes while it works, and a new head is the one thing the per-head
 * marker lets through. What keeps that push from arming a second run onto the same pull request
 * is the run's `in-progress` hold, taken before the trigger label comes off. This pins the hold
 * against exactly that state - live bot thread, head moved past the marker, no trigger label -
 * so the guard cannot be weakened without this going red.
 */

import { describe, expect, it } from 'vitest'

import { decide } from '../review-threads-label.mjs'

const state = (labels) => ({
  threads: [{ isResolved: false, isOutdated: false, author: 'claude' }],
  labels,
  baseRef: 'develop',
  integrationBranch: 'develop',
  headSha: 'a5a4ecee0000',
  markerSha: '4b4b2e480000',
})

describe('decide during an autofix run (#490)', () => {
  it('stands down on a moved head while the run holds in-progress', () => {
    const { act, reason } = decide(state(['in-progress']))
    expect(act).toBe('skip')
    expect(reason).toContain('in-progress')
  })

  it('would arm that same head once nothing holds it', () => {
    expect(decide(state([])).act).toBe('label')
  })
})
