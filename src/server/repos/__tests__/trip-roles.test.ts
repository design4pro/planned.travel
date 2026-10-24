/**
 * The one list of trip roles that may write (#1028), and the pure role-to-boolean read of it.
 *
 * Every writer hands the list to `assertTripRole` and every write control reads the helper, so a
 * change of who may write is a change here and in this test, nowhere else.
 */

import { describe, expect, it } from 'vitest'

import { MONEY_WRITE_ROLES } from '../expenses'
import { TRIP_WRITE_ROLES, canWritePlan, isTripWriteRole } from '../trips'

describe('TRIP_WRITE_ROLES', () => {
  it('is exactly the owner and the editor', () => {
    expect([...TRIP_WRITE_ROLES].sort()).toEqual(['editor', 'owner'])
  })

  it('is the list the money writers read', () => {
    expect(MONEY_WRITE_ROLES).toBe(TRIP_WRITE_ROLES)
  })
})

describe('isTripWriteRole', () => {
  it.each(['owner', 'editor'])('admits %s', (role) => {
    expect(isTripWriteRole(role)).toBe(true)
  })

  it.each(['viewer', 'Owner', 'admin', ''])('refuses %j', (role) => {
    expect(isTripWriteRole(role)).toBe(false)
  })

  it('refuses no membership', () => {
    expect(isTripWriteRole(null)).toBe(false)
  })
})

describe('canWritePlan', () => {
  it('composes the role read with the archive check', () => {
    expect(canWritePlan({ isArchived: false }, 'owner')).toBe(true)
    expect(canWritePlan({ isArchived: false }, 'editor')).toBe(true)
    expect(canWritePlan({ isArchived: false }, 'viewer')).toBe(false)
    expect(canWritePlan({ isArchived: false }, null)).toBe(false)
    expect(canWritePlan({ isArchived: true }, 'owner')).toBe(false)
    expect(canWritePlan({ isArchived: true }, 'editor')).toBe(false)
  })
})
