/**
 * `planRelease` is the judgement: which of the PRs a sweep dispatched still carry a claim that
 * sweep opened and never released. Both mistakes are expensive and opposite. Missing a leak keeps a
 * PR off every queue for a day (#551); releasing a claim that is still live opens the gap #490
 * describes, where a second run walks into a PR another run is working. So the cases below pin both
 * edges: only this skill's claim, only by this account, only inside this sweep, and only when it is
 * the newest lock event on the PR.
 */

import { describe, expect, it } from 'vitest'

import {
  LABEL,
  planRelease,
  releaseComment,
} from '../release-leaked-claims.mjs'

const ME = 'design4pro-agent'
const SINCE = '2026-09-17T11:00:00Z'
const CLAIM =
  '🤖 Claiming this PR — starting `om-auto-review-pr` run. Started: 2026-09-17T11:16:52Z.'

const comment = (body, createdAt, login = ME) => ({
  author: { login },
  body,
  createdAt,
})

const pr = (over = {}) => ({
  number: 549,
  labels: [{ name: LABEL }],
  comments: [comment(CLAIM, '2026-09-17T11:16:53Z')],
  reviews: [],
  ...over,
})

const plan = (p, over = {}) =>
  planRelease(p, { currentUser: ME, since: SINCE, ...over })

describe('planRelease', () => {
  it('releases a claim this sweep opened and never followed with a review (#549)', () => {
    expect(plan(pr())).toEqual({
      number: 549,
      claimedAt: '2026-09-17T11:16:53Z',
      review: null,
    })
  })

  it('recognises the claim-comment text the installed skill prescribes', () => {
    const body =
      '🤖 `om-auto-review-pr` started by @design4pro-agent at 2026-09-17T11:16:52Z.'
    expect(
      plan(pr({ comments: [comment(body, '2026-09-17T11:16:53Z')] })),
    ).not.toBeNull()
  })

  it('still releases when a review landed but the release comment did not', () => {
    const reviews = [
      {
        author: { login: ME },
        state: 'APPROVED',
        submittedAt: '2026-09-17T11:20:00Z',
      },
    ]
    expect(plan(pr({ reviews }))?.review).toEqual({
      state: 'APPROVED',
      submittedAt: '2026-09-17T11:20:00Z',
    })
  })

  it('ignores a review older than the claim', () => {
    const reviews = [
      {
        author: { login: ME },
        state: 'APPROVED',
        submittedAt: '2026-09-17T10:00:00Z',
      },
    ]
    expect(plan(pr({ reviews }))?.review).toBeNull()
  })

  it('leaves a PR alone once the lock was released', () => {
    const comments = [
      comment(CLAIM, '2026-09-17T11:16:53Z'),
      comment(
        '🤖 `om-auto-review-pr` completed: approved. Lock released.',
        '2026-09-17T11:21:00Z',
      ),
    ]
    expect(plan(pr({ comments }))).toBeNull()
  })

  it('leaves a PR alone without the in-progress label', () => {
    expect(plan(pr({ labels: [{ name: 'ci-monitoring' }] }))).toBeNull()
  })

  it('never touches another actor’s claim', () => {
    const comments = [comment(CLAIM, '2026-09-17T11:16:53Z', 'someone-else')]
    expect(plan(pr({ comments }))).toBeNull()
  })

  it('never touches a claim older than this sweep', () => {
    expect(plan(pr(), { since: '2026-09-17T12:00:00Z' })).toBeNull()
  })

  it('never touches a claim another skill took after this sweep’s', () => {
    const comments = [
      comment(CLAIM, '2026-09-17T11:16:53Z'),
      comment(
        '🤖 `om-pr-autopilot` started by @design4pro-agent at 2026-09-17T11:24:52Z.',
        '2026-09-17T11:24:52Z',
      ),
    ]
    expect(plan(pr({ comments }))).toBeNull()
  })

  it('attributes a claim to the skill on its first line, not to one it mentions later', () => {
    const body =
      '🤖 Claiming this PR — starting `om-pr-autopilot` run.\n\nRe-entering the lock `om-auto-review-pr` left.'
    expect(
      plan(pr({ comments: [comment(body, '2026-09-17T11:24:52Z')] })),
    ).toBeNull()
  })

  it('never releases a chain take-over, which its driver releases', () => {
    const body =
      '🤖 `om-auto-review-pr` taking over the chain lock — code review. Started: 2026-09-17T11:30:05Z.'
    expect(
      plan(pr({ comments: [comment(body, '2026-09-17T11:30:05Z')] })),
    ).toBeNull()
  })

  it('never releases a newer claim by the same skill after this sweep released its own', () => {
    const comments = [
      comment(CLAIM, '2026-09-17T11:05:00Z'),
      comment(
        '🤖 `om-auto-review-pr` completed: approved. Lock released.',
        '2026-09-17T11:10:00Z',
      ),
      comment(
        '🤖 `om-auto-review-pr` started by @design4pro-agent at 2026-09-17T11:30:00Z.',
        '2026-09-17T11:30:00Z',
      ),
    ]
    expect(plan(pr({ comments }))).toBeNull()
  })

  it('reads only the first line, so a word further down moves no lock', () => {
    const comments = [
      comment(`${CLAIM}\n\nThe previous run aborted.`, '2026-09-17T11:16:53Z'),
      comment(
        '🤖 `om-auto-review-pr` — CI result\n\nstarted by the push at 11:18',
        '2026-09-17T11:19:00Z',
      ),
    ]
    expect(plan(pr({ comments }))?.claimedAt).toBe('2026-09-17T11:16:53Z')
  })

  it('does not count a pending review, which has no submission time', () => {
    const reviews = [
      { author: { login: ME }, state: 'PENDING', submittedAt: null },
    ]
    expect(plan(pr({ reviews }))?.review).toBeNull()
  })

  it('reads past non-lock robot comments such as the label rationale', () => {
    const comments = [
      comment(CLAIM, '2026-09-17T11:16:53Z'),
      comment(
        '🤖 `om-auto-review-pr` — 🏷️ label rationale\n…',
        '2026-09-17T11:19:00Z',
      ),
    ]
    expect(plan(pr({ comments }))?.claimedAt).toBe('2026-09-17T11:16:53Z')
  })
})

describe('releaseComment', () => {
  it('says plainly that nothing was reviewed, so a reader can act on it', () => {
    const text = releaseComment({
      number: 549,
      claimedAt: '2026-09-17T11:16:53Z',
      review: null,
    })
    expect(text).toMatch(/^🤖 /)
    expect(text).toContain('no review submitted')
    expect(text).toMatch(/Lock released\.$/)
  })

  it('names the review when one was submitted', () => {
    const text = releaseComment({
      number: 549,
      claimedAt: '2026-09-17T11:16:53Z',
      review: { state: 'APPROVED', submittedAt: '2026-09-17T11:20:00Z' },
    })
    expect(text).toContain('APPROVED review submitted at 2026-09-17T11:20:00Z')
  })

  it('is itself a release, so a second pass leaves the PR alone', () => {
    const released = releaseComment(plan(pr()))
    const comments = [
      comment(CLAIM, '2026-09-17T11:16:53Z'),
      comment(released, '2026-09-17T11:23:00Z'),
    ]
    expect(plan(pr({ comments }))).toBeNull()
  })
})
