/**
 * The creation dialog's roster: who it offers, and what it never says about them.
 *
 * Everything below the context mock is real - a fully migrated SQLite database, the real
 * `listMemberProfiles` read. Outside a Start build a `createServerFn` handler's return value is
 * discarded on a direct call, so the answer is asserted on {@link readWorkspaceRoster}, the plain
 * function the handler is a one-line wrapper over (`people.test.ts` records the same split).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createHarness } from '#/server/repos/__tests__/harness'

import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { TenantScope } from '#/server/repos'

const stubs = vi.hoisted(() => ({ scope: null as TenantScope | null }))

vi.mock('../context', () => ({
  appScope: async (): Promise<TenantScope | null> => stubs.scope,
}))

const { readWorkspaceRoster } = await import('../roster')

describe('readWorkspaceRoster', () => {
  let harness: Harness
  let tenant: SeededTenant

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('roster')
    stubs.scope = tenant.scope
  })
  afterEach(() => {
    harness.close()
  })

  it('lists everyone in the workspace but the caller, with exactly an id, a name and an image', async () => {
    const colleague = await tenant.addUser('A colleague')

    const roster = await readWorkspaceRoster(tenant.scope)

    expect(roster).toHaveLength(1)
    expect(roster[0]).toEqual({
      userId: colleague,
      name: 'A colleague',
      image: null,
    })
    expect(Object.keys(roster[0] ?? {}).sort()).toEqual([
      'image',
      'name',
      'userId',
    ])
  })

  it('leaves the caller out whichever member is asking', async () => {
    const colleague = await tenant.addUser('A colleague')

    const roster = await readWorkspaceRoster(tenant.scopeFor(colleague))

    expect(roster.map((person) => person.userId)).toEqual([tenant.ownerUserId])
  })

  it('carries no address, role or date anywhere on the wire', async () => {
    await tenant.addUser('A colleague', 'admin')

    const wire = JSON.stringify(await readWorkspaceRoster(tenant.scope))

    // The harness gives every seeded user `<id>@example.test`, so the whole class is one substring.
    expect(wire).not.toContain('@example.test')
    expect(wire).not.toMatch(/"(email|role|memberId|joinedAt)"/)
  })

  it('answers an empty list when the caller is alone in the workspace', async () => {
    expect(await readWorkspaceRoster(tenant.scope)).toEqual([])
  })

  it('shows a caller in one workspace nothing from another', async () => {
    const other = await harness.seedTenant('elsewhere')
    await other.addUser('Somebody else entirely')
    const colleague = await tenant.addUser('A colleague')

    const roster = await readWorkspaceRoster(tenant.scope)

    expect(roster.map((person) => person.userId)).toEqual([colleague])
    expect(JSON.stringify(roster)).not.toContain('Somebody else entirely')
    expect(JSON.stringify(roster)).not.toContain(other.ownerUserId)
  })
})
