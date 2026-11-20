import { expect, it, vi } from 'vitest'
import { createHarness } from '#/server/repos/__tests__/harness'
import {
  deleteWorkspace,
  deleteWorkspaceInput,
} from '../workspace-delete-writes'

it('validates the precondition and proof before a driver can write deletion state', async () => {
  const h = await createHarness({ ddl: 'migrations' })
  try {
    const a = await h.seedTenant('alpha')
    const start = vi.fn(async () => ({
      ok: true as const,
      complete: false as const,
    }))
    const ports = {
      scope: a.scope,
      impersonated: false,
      activated: true,
      proof: async () => null,
      start,
    }
    const input = {
      expectedOrganizationId: a.organizationId,
      name: 'Workspace alpha',
    }
    expect(
      await deleteWorkspace(ports, {
        ...input,
        expectedOrganizationId: 'replacement',
      }),
    ).toEqual({ ok: false, reason: 'workspace-changed' })
    expect(await deleteWorkspace(ports, { ...input, name: 'ALPHA' })).toEqual({
      ok: false,
      reason: 'name-mismatch',
    })
    await expect(
      deleteWorkspace({ ...ports, impersonated: true }, input),
    ).rejects.toMatchObject({ reason: 'impersonated' })
    await expect(
      deleteWorkspace(
        {
          ...ports,
          scope: { ...a.scope, ctx: { ...a.scope.ctx, role: 'admin' } },
        },
        input,
      ),
    ).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(
      await deleteWorkspace({ ...ports, activated: false }, input),
    ).toEqual({ ok: false, reason: 'unavailable' })
    for (const reason of [
      'password-required',
      'invalid-password',
      'session-not-fresh',
      'rate-limited',
    ] as const) {
      expect(
        await deleteWorkspace({ ...ports, proof: async () => reason }, input),
      ).toEqual({
        ok: false,
        reason: reason === 'invalid-password' ? 'password-invalid' : reason,
      })
    }
    expect(start).not.toHaveBeenCalled()
    expect(
      await deleteWorkspace(ports, { ...input, name: ' Workspace alpha ' }),
    ).toEqual({ ok: true, complete: false })
    expect(start).toHaveBeenCalledOnce()
    expect(
      deleteWorkspaceInput.safeParse({ ...input, organizationId: 'foreign' })
        .success,
    ).toBe(false)
    expect(
      deleteWorkspaceInput.safeParse({ ...input, password: '' }).success,
    ).toBe(false)
  } finally {
    h.close()
  }
})
