import { describe, expect, it } from 'vitest'

import { ORGANIZATION_PLANS } from '#/server/db/schema'
import { ORGANIZATION_ROLES } from '#/server/db/auth-schema'
import { consoleTranslate as t } from '#/lib/i18n/__tests__/console-translate'
import { describePlan, describeWorkspaceRole } from '../workspace'

/**
 * The account screen is the one place in the product where the workspace vocabulary and the platform
 * one appear together, and `docs/SPEC.md` §5 forbids conflating them. These assertions are about the
 * cheaper half of that: a value the column can hold and this module cannot name would be printed raw
 * beside one that is named properly, which reads as a bug in the data rather than a gap in a table.
 */
describe('describeWorkspaceRole', () => {
  it('names every role `member.role` can hold', () => {
    for (const role of ORGANIZATION_ROLES) {
      expect(
        describeWorkspaceRole(t, role),
        `${role} has no label, so the workspaces table would print the column value`,
      ).not.toBe(role)
    }
  })

  it('prints a role it does not know rather than blanking the cell', () => {
    expect(describeWorkspaceRole(t, 'guest')).toBe('guest')
  })
})

describe('describePlan', () => {
  it('names every tier `subscriptions.plan` can hold', () => {
    for (const plan of ORGANIZATION_PLANS) {
      expect(describePlan(t, plan)).not.toBe(plan)
    }
  })

  it('reads no subscription row as the free plan', () => {
    // A workspace that has never been through checkout has no `subscriptions` row at all, and it is
    // on the free plan's quotas — not on "no plan", which is not a state the product has.
    expect(describePlan(t, null)).toBe('Free')
  })

  it('prints a tier it does not know as it was stored', () => {
    expect(describePlan(t, 'enterprise')).toBe('enterprise')
  })
})
