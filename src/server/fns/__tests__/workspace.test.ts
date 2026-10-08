/**
 * Creating a workspace, at the seam that owns the rules: who may, on which plan, how many, and what
 * is written when they may not.
 *
 * Every refusal arm asserts the `organization` and `member` row counts, not only the returned
 * reason: "it said no" and "it wrote nothing" are different claims, and the second is the one that
 * matters (a half-created workspace is an organization nobody can reach). The plain `createWorkspace`
 * is driven rather than the server function, for the reason `stays.test.ts` gives. The harness is a
 * plain SQLite handle behind the Drizzle proxy driver, not the D1 handle `AuthDb` names; they take the
 * same statements, so the one cast sits in `asAuthDb`.
 */
import { and, count, eq } from 'drizzle-orm'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { WORKSPACE_LIMIT } from '#/server/auth/provisioning'
import { AuthRequirementError } from '#/server/auth/tenant'
import { member, organization } from '#/server/db/auth-schema'
import {
  createScope,
  createTrip,
  listTrips,
  resolveQuotas,
} from '#/server/repos'
import {
  captureError,
  createHarness,
  subscribeTenant,
} from '#/server/repos/__tests__/harness'
import { createWorkspace, createWorkspaceInput } from '../workspace-writes'

import type { AuthDb } from '#/server/auth/db'
import type { PlanId } from '#/lib/plans'
import type { OrganizationRole } from '#/server/db/types'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { CreateWorkspacePorts } from '../workspace-writes'

let harness: Harness
let origin: SeededTenant

beforeEach(async () => {
  harness = await createHarness()
  origin = await harness.seedTenant('origin')
})

function asAuthDb(): AuthDb {
  return harness.db as unknown as AuthDb
}

async function counts(): Promise<{ organizations: number; members: number }> {
  const [organizations] = await harness.db
    .select({ n: count() })
    .from(organization)
  const [members] = await harness.db.select({ n: count() }).from(member)
  return { organizations: organizations.n, members: members.n }
}

async function membershipsOf(userId: string): Promise<number> {
  const [row] = await harness.db
    .select({ n: count() })
    .from(member)
    .where(eq(member.userId, userId))
  return row.n
}

/** The caller of `role` inside the origin workspace, on `plan`. */
async function ports(
  options: {
    role?: OrganizationRole
    plan?: PlanId
    impersonated?: boolean
    activate?: CreateWorkspacePorts['activate']
  } = {},
): Promise<CreateWorkspacePorts & { activate: ReturnType<typeof vi.fn> }> {
  const { role = 'owner', plan = 'solo', impersonated = false } = options
  const userId =
    role === 'owner' ? origin.ownerUserId : await origin.addUser('Caller', role)
  if (plan !== 'free') await subscribeTenant(origin.scope, plan)

  const activate = vi.fn(options.activate ?? (async () => undefined))
  return {
    scope: createScope(harness.db, {
      userId,
      organizationId: origin.organizationId,
      role,
    }),
    db: asAuthDb(),
    impersonated,
    countMemberships: () => membershipsOf(userId),
    activate,
  }
}

describe('the input', () => {
  it('trims the name and keeps it between 1 and 60 characters', () => {
    expect(createWorkspaceInput.parse({ name: '  Lisbon  ' })).toEqual({
      name: 'Lisbon',
    })
    expect(createWorkspaceInput.safeParse({ name: '   ' }).success).toBe(false)
    expect(
      createWorkspaceInput.safeParse({ name: 'x'.repeat(61) }).success,
    ).toBe(false)
    expect(
      createWorkspaceInput.safeParse({ name: 'x'.repeat(60) }).success,
    ).toBe(true)
  })

  it.each(['organizationId', 'userId', 'slug'])(
    "rejects an extra %s: the tenant and the slug are never the client's to name",
    (field) => {
      expect(
        createWorkspaceInput.safeParse({ name: 'Trip', [field]: 'forged' })
          .success,
      ).toBe(false)
    },
  )
})

describe.each(['solo', 'crew'] as const)('on the %s plan', (plan) => {
  it('creates the workspace, makes the caller its only owner and activates it', async () => {
    const before = await counts()
    const given = await ports({ plan, role: 'admin' })

    const result = await createWorkspace(given, { name: 'Family' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(await counts()).toEqual({
      organizations: before.organizations + 1,
      members: before.members + 2,
    })
    const members = await harness.db
      .select({ userId: member.userId, role: member.role })
      .from(member)
      .where(eq(member.organizationId, result.organizationId))
    expect(members).toEqual([{ userId: given.scope.ctx.userId, role: 'owner' }])
    expect(given.activate).toHaveBeenCalledExactlyOnceWith(
      result.organizationId,
    )
  })

  it('adds no member of the workspace it was created from', async () => {
    const colleague = await origin.addUser('Colleague')
    const given = await ports({ plan, role: 'owner' })

    const result = await createWorkspace(given, { name: 'Clients' })

    expect(result.ok).toBe(true)
    if (!result.ok) return
    const rows = await harness.db
      .select()
      .from(member)
      .where(
        and(
          eq(member.organizationId, result.organizationId),
          eq(member.userId, colleague),
        ),
      )
    expect(rows).toEqual([])
  })

  it('starts the new workspace on Free and shows none of the original workspace', async () => {
    await createTrip(origin.scope, {
      title: 'Tokyo in spring',
      startDate: '2026-04-10',
      endDate: '2026-04-14',
      currency: 'JPY',
    })
    const result = await createWorkspace(await ports({ plan }), {
      name: 'Fresh',
    })
    expect(result.ok).toBe(true)
    if (!result.ok) return

    const scope = createScope(harness.db, {
      userId: origin.ownerUserId,
      organizationId: result.organizationId,
      role: 'owner',
    })
    // The original's subscription row is invisible from the new scope: planFor(null) is Free.
    expect((await resolveQuotas(scope)).planId).toBe('free')
    expect(await listTrips(origin.scope)).toHaveLength(1)
    expect(await listTrips(scope)).toEqual([])
  })
})

describe('a refusal writes nothing', () => {
  it('refuses a member with role-required, never the upgrade prompt, on any plan', async () => {
    for (const plan of ['free', 'solo'] as const) {
      const given = await ports({ role: 'member', plan })
      const before = await counts()

      const result = await createWorkspace(given, { name: 'Nope' })

      expect(result).toEqual({ ok: false, reason: 'role-required' })
      expect(await counts()).toEqual(before)
      expect(given.activate).not.toHaveBeenCalled()
    }
  })

  it('refuses an impersonated session by throwing the access veto, with an authored sentence', async () => {
    const given = await ports({ impersonated: true })
    const before = await counts()

    const error = await captureError(() =>
      createWorkspace(given, { name: 'As someone else' }),
    )

    expect(error).toBeInstanceOf(AuthRequirementError)
    if (!(error instanceof AuthRequirementError)) return
    expect(error.reason).toBe('impersonated')
    expect(error.status).toBe(403)
    expect(error.message).not.toBe('')
    expect(await counts()).toEqual(before)
    expect(given.activate).not.toHaveBeenCalled()
  })

  it('refuses an admin of a free workspace with upgrade-required', async () => {
    const given = await ports({ role: 'admin', plan: 'free' })
    const before = await counts()

    const result = await createWorkspace(given, { name: 'Second' })

    expect(result).toEqual({ ok: false, reason: 'upgrade-required' })
    expect(await counts()).toEqual(before)
    expect(given.activate).not.toHaveBeenCalled()
  })

  it('refuses an owner of a free workspace with upgrade-required', async () => {
    const given = await ports({ role: 'owner', plan: 'free' })
    const before = await counts()

    expect(await createWorkspace(given, { name: 'Second' })).toEqual({
      ok: false,
      reason: 'upgrade-required',
    })
    expect(await counts()).toEqual(before)
  })

  it('checks the role before the impersonation, and the impersonation before the plan', async () => {
    const memberOnFree = await ports({
      role: 'member',
      plan: 'free',
      impersonated: true,
    })
    expect(await createWorkspace(memberOnFree, { name: 'x' })).toEqual({
      ok: false,
      reason: 'role-required',
    })

    const ownerOnFree = await ports({
      role: 'owner',
      plan: 'free',
      impersonated: true,
    })
    const error = await captureError(() =>
      createWorkspace(ownerOnFree, { name: 'x' }),
    )
    expect(error).toBeInstanceOf(AuthRequirementError)
  })

  it('refuses at the workspace limit with limit-reached, not the upgrade prompt', async () => {
    const given = await ports({ plan: 'crew' })
    // The caller already belongs to the origin workspace; fill the rest of the allowance.
    for (let index = 1; index < WORKSPACE_LIMIT; index += 1) {
      const other = await harness.seedTenant(`other-${index}`)
      await other.addMembership(given.scope.ctx.userId, 'member')
    }
    expect(await membershipsOf(given.scope.ctx.userId)).toBe(WORKSPACE_LIMIT)
    const before = await counts()

    const result = await createWorkspace(given, { name: 'One too many' })

    expect(result).toEqual({ ok: false, reason: 'limit-reached' })
    expect(await counts()).toEqual(before)
    expect(given.activate).not.toHaveBeenCalled()
  })

  it('still creates one below the limit', async () => {
    const given = await ports({ plan: 'crew' })
    for (let index = 1; index < WORKSPACE_LIMIT - 1; index += 1) {
      const other = await harness.seedTenant(`other-${index}`)
      await other.addMembership(given.scope.ctx.userId, 'member')
    }

    const result = await createWorkspace(given, { name: 'The last one' })

    expect(result.ok).toBe(true)
  })
})

describe('when activation fails after the batch', () => {
  it("throws, and the new workspace stays reachable through the caller's memberships", async () => {
    const given = await ports({
      activate: async () => {
        throw new Error('the session write failed')
      },
    })
    const before = await membershipsOf(given.scope.ctx.userId)

    const error = await captureError(() =>
      createWorkspace(given, { name: 'Written anyway' }),
    )

    expect(error.message).toBe('the session write failed')
    // The batch is already committed: `listOrganizations` reads exactly these rows.
    expect(await membershipsOf(given.scope.ctx.userId)).toBe(before + 1)
    const [created] = await harness.db
      .select({ id: organization.id })
      .from(organization)
      .where(eq(organization.name, 'Written anyway'))
    expect(created.id).toBeTypeOf('string')
  })
})
