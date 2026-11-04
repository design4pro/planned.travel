import { describe, expect, it } from 'vitest'
import {
  promotionDecision,
  rollbackDecision,
  releaseApproved,
  promotionCi,
} from '../release-policy.mjs'

const now = Date.parse('2026-11-03T12:00:00Z')
const sha = 'a'.repeat(40)
const healthy = {
  sha,
  version: 'version-a',
  smoke: true,
  observedFrom: '2026-11-03T11:29:00Z',
  verifiedAt: '2026-11-03T11:59:00Z',
}
const input = {
  sha,
  staging: healthy,
  ci: 'green',
  files: ['src/components/trip.tsx'],
  prs: [{ known: true, labels: ['risk-low'] }],
  now,
}
describe('release gates', () => {
  it('uses completed develop push CI for a promotion, without accepting pending or unreadable checks', () => {
    const workflow = {
      status: 'completed',
      conclusion: 'success',
      head_sha: sha,
      head_branch: 'develop',
      event: 'push',
      path: '.github/workflows/ci.yml',
    }
    const prCi = { state: 'pending', pending: 0 }
    expect(promotionCi(workflow, sha, prCi)).toBe('green')
    expect(promotionCi(workflow, 'b'.repeat(40), prCi)).toBe('unknown')
    expect(promotionCi({ ...workflow, conclusion: 'skipped' }, sha, prCi)).toBe(
      'unknown',
    )
    expect(promotionCi(workflow, sha, { state: 'pending', pending: 1 })).toBe(
      'unknown',
    )
    expect(promotionCi(workflow, sha, { state: 'unknown', pending: 0 })).toBe(
      'unknown',
    )
  })
  it('requires a trusted exact-head release decision and respects its revocation', () => {
    const decision = {
      user: { login: 'owner' },
      body: `/approve-release ${sha}`,
      updated_at: '2026-11-03T12:00:00Z',
    }
    expect(releaseApproved([], [decision], ['owner'], sha)).toBe(true)
    expect(releaseApproved([], [decision], ['other'], sha)).toBe(false)
    expect(releaseApproved([], [decision], ['owner'], 'b'.repeat(40))).toBe(
      false,
    )
    expect(
      releaseApproved(
        [],
        [
          decision,
          {
            ...decision,
            body: `/revoke-release ${sha}`,
            updated_at: '2026-11-03T12:01:00Z',
          },
        ],
        ['owner'],
        sha,
      ),
    ).toBe(false)
  })
  it('requires the exact observed staging SHA and complete CI', () => {
    expect(promotionDecision(input)).toBeNull()
    for (const staging of [
      null,
      { ...healthy, sha: 'b'.repeat(40) },
      { ...healthy, smoke: false },
      { ...healthy, observedFrom: healthy.verifiedAt },
    ])
      expect(promotionDecision({ ...input, staging })).not.toBeNull()
    for (const ci of ['unknown', 'pending', 'skipped', 'red'])
      expect(promotionDecision({ ...input, ci })).not.toBeNull()
  })
  it('checks the whole range including migrations and unknown direct commits', () => {
    expect(
      promotionDecision({
        ...input,
        files: ['drizzle/old.sql', ...input.files],
      }),
    ).not.toBeNull()
    expect(
      promotionDecision({ ...input, prs: [{ known: false, labels: [] }] }),
    ).not.toBeNull()
    expect(
      promotionDecision({
        ...input,
        files: ['drizzle/old.sql'],
        approved: true,
      }),
    ).toBeNull()
    expect(promotionDecision({ ...input, incident: true })).not.toBeNull()
  })
  it('allows one compatible rollback to a recorded healthy version', () => {
    const state = {
      healthy,
      failed: { version: 'bad' },
      schemaCompatible: true,
    }
    expect(rollbackDecision(state)).toBe(true)
    expect(rollbackDecision({ ...state, attempted: true })).toBe(false)
    expect(rollbackDecision({ ...state, schemaCompatible: undefined })).toBe(
      false,
    )
    expect(rollbackDecision({ ...state, incident: true })).toBe(false)
  })
})
