/**
 * The tenant context's validation boundary.
 *
 * `requireTenantContext` rebuilds the context field by field, so a field the schema or the frozen
 * copy forgets is dropped without an error: `undefined` is a perfectly valid value for it later. The
 * `impersonatedBy` stamp the audit trail reads (docs/ACCESS.md §6.4) is exactly such a field, hence
 * the pins below.
 */
import { describe, expect, it } from 'vitest'

import {
  MissingTenantContextError,
  requireTenantContext,
} from '#/server/repos/context'

const ORDINARY = {
  userId: 'usr_1',
  organizationId: 'org_1',
  role: 'owner',
  impersonatedBy: null,
}

describe('requireTenantContext', () => {
  it('carries an operator id through to the frozen copy', () => {
    const context = requireTenantContext({
      ...ORDINARY,
      impersonatedBy: 'usr_operator',
    })

    expect(context.impersonatedBy).toBe('usr_operator')
    expect(Object.isFrozen(context)).toBe(true)
  })

  it('carries an explicit null through as null, not as undefined', () => {
    expect(requireTenantContext(ORDINARY).impersonatedBy).toBeNull()
  })

  it('refuses a context that leaves the field out, so a forgotten construction is loud', () => {
    const { impersonatedBy: _omitted, ...withoutField } = ORDINARY

    expect(() => requireTenantContext(withoutField)).toThrow(
      MissingTenantContextError,
    )
  })

  it('refuses an operator id that is not a bounded string', () => {
    expect(() =>
      requireTenantContext({ ...ORDINARY, impersonatedBy: '' }),
    ).toThrow(MissingTenantContextError)
    expect(() =>
      requireTenantContext({ ...ORDINARY, impersonatedBy: 'x'.repeat(65) }),
    ).toThrow(MissingTenantContextError)
    expect(() =>
      requireTenantContext({ ...ORDINARY, impersonatedBy: 7 }),
    ).toThrow(MissingTenantContextError)
  })
})
