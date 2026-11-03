import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { eq } from 'drizzle-orm'
import { symmetricEncrypt } from 'better-auth/crypto'
import {
  member,
  securityFence,
  securityCleanup,
  securityOperation,
  securityRoomCleanup,
} from '#/server/db/auth-schema'
import { workspaceParticipants } from '#/server/db/schema'
import { createHarness } from '#/server/repos/__tests__/harness'
import {
  commitRevocation,
  insertNativeSession,
  registerRevocation,
} from '#/server/repos/account-security'
import {
  acknowledgeAccountRoomEviction,
  createAccountAuthority,
} from '../account-authority'
import {
  discoverRoomWorkspaces,
  sweepAccountSecurity,
} from '../account-security-cleanup'
import type { Harness } from '#/server/repos/__tests__/harness'
import type { AccountAuthScope } from '../account-authority-lib/scope'

let harness: Harness
let scope: AccountAuthScope
let workspace: string
let otherWorkspace: string
let now: number
const key = 'test-secret-not-used-outside-this-process'
const id = '12345678-1234-4234-8234-123456789abc'

beforeEach(async () => {
  harness = await createHarness()
  now = Date.now()
  const first = await harness.seedTenant('cleanup-a')
  const second = await harness.seedTenant('cleanup-b')
  workspace = first.organizationId
  otherWorkspace = second.organizationId
  const authority = createAccountAuthority(harness.db, () => false)
  scope = await authority.boundary(
    async () => (await authority.bind(first.ownerUserId)).scope,
  )
  await harness.db.insert(workspaceParticipants).values([
    {
      organizationId: workspace,
      userId: scope.userId,
      createdAt: new Date(now),
    },
    {
      organizationId: otherWorkspace,
      userId: second.ownerUserId,
      createdAt: new Date(now),
    },
  ])
  await harness.db.update(securityFence).set({
    ready: true,
    cutover: true,
    anchorBackfillRunId: 'fixture-complete',
  })
  await add('current')
  await add('other')
  await registerRevocation(scope, {
    id,
    sessionId: 'current',
    intent: id,
    receiptDigest: 'fixture-receipt-digest',
    revision: 0,
    expiresAt: now + 300000,
  })
  expect(
    await commitRevocation(scope, {
      id,
      sessionId: 'current',
      token: 'fixture-current',
      intent: id,
      claim: 'fixture-claim',
      now,
    }),
  ).toBe(true)
})
afterEach(() => harness.close())

async function add(sessionId: string) {
  await insertNativeSession(
    scope,
    {
      id: sessionId,
      token: `fixture-${sessionId}`,
      userId: scope.userId,
      activeOrganizationId: null,
      ipAddress: null,
      userAgent: null,
      impersonatedBy: null,
      createdAt: new Date(now - 1000),
      updatedAt: new Date(now - 1000),
      expiresAt: new Date(now + 600000),
    },
    { revision: 0, trustRevision: 0, lastFence: 0 },
    'native',
    now - 1000,
  )
}
function options(
  overrides: Partial<Parameters<typeof sweepAccountSecurity>[1]> = {},
) {
  return {
    key,
    discoveryDb: harness.db,
    now,
    store: { delete: async () => undefined },
    publish: async () => undefined,
    ...overrides,
  }
}
async function operation() {
  return (await harness.db.select().from(securityOperation))[0]
}

describe('durable session and room cleanup', () => {
  it('attempts later cleanup keys even when the first 200 references keep failing', async () => {
    const encryptedToken = await symmetricEncrypt({
      key: options().key,
      data: 'fixture-blocked',
    })
    for (let index = 0; index < 201; index++)
      await harness.db.insert(securityCleanup).values({
        id: `blocked-${String(index).padStart(3, '0')}`,
        operationId: id,
        encryptedToken,
      })
    const later = await symmetricEncrypt({
      key: options().key,
      data: 'fixture-healthy',
    })
    await harness.db
      .insert(securityCleanup)
      .values({ id: 'zz-healthy', operationId: id, encryptedToken: later })
    const deleted: Array<string> = []
    const store = {
      delete: async (cacheKey: string) => {
        if (cacheKey.includes('fixture-blocked'))
          throw new Error('fixture unavailable')
        deleted.push(cacheKey)
      },
    }
    await sweepAccountSecurity(harness.db, options({ store }))
    await sweepAccountSecurity(harness.db, options({ store, now: now + 1 }))
    expect(
      deleted.some((cacheKey) => cacheKey.includes('fixture-healthy')),
    ).toBe(true)
    expect(
      (await harness.db.select().from(securityCleanup)).some(
        (row) => row.id === 'zz-healthy',
      ),
    ).toBe(false)
  })

  it('uses retained participation after membership leaves, without seeing another account', async () => {
    await harness.db.delete(member).where(eq(member.userId, scope.userId))
    expect(await discoverRoomWorkspaces(harness.db, scope.userId)).toEqual([
      workspace,
    ])
    const publish = vi.fn(async () => undefined)
    await sweepAccountSecurity(harness.db, options({ publish }))
    expect(publish).toHaveBeenCalledWith(scope.userId, id, [workspace])
    expect((await operation()).cleanupPending).toBe(true)
    expect(
      (await harness.db.select().from(securityRoomCleanup)).map(
        (row) => row.organizationId,
      ),
    ).toEqual([workspace])
    await acknowledgeAccountRoomEviction(
      harness.db,
      id,
      scope.userId,
      otherWorkspace,
    )
    expect((await operation()).roomsPending).toBe(true)
    await acknowledgeAccountRoomEviction(
      harness.db,
      id,
      scope.userId,
      workspace,
    )
    await sweepAccountSecurity(harness.db, options())
    expect((await operation()).cleanupPending).toBe(false)
  })

  it('retries failed KV keys and queue publication independently after restart', async () => {
    const deleted: Array<string> = []
    await expect(
      sweepAccountSecurity(
        harness.db,
        options({
          store: {
            delete: async (token) => {
              deleted.push(token)
              throw new Error('fixture KV failure')
            },
          },
          publish: async () => {
            throw new Error('fixture queue failure')
          },
        }),
      ),
    ).rejects.toThrow()
    const references = await harness.db.select().from(securityCleanup)
    expect(references).toHaveLength(1)
    expect(references[0]?.encryptedToken.includes('fixture-other')).toBe(false)
    expect((await operation()).cleanupPending).toBe(true)
    await sweepAccountSecurity(
      harness.db,
      options({
        store: {
          delete: async (token) => {
            deleted.push(token)
          },
        },
      }),
    )
    expect(
      deleted.filter((token) => token === 'fixture-other').length >= 2,
    ).toBe(true)
    expect(await harness.db.select().from(securityCleanup)).toHaveLength(0)
    expect((await operation()).roomsPending).toBe(true)
  })

  it('still publishes room eviction when one encrypted reference is unreadable', async () => {
    await sweepAccountSecurity(
      harness.db,
      options({
        store: {
          delete: async () => {
            throw new Error('fixture KV failure')
          },
        },
      }),
    )
    await harness.db
      .update(securityCleanup)
      .set({ encryptedToken: 'fixture-corrupt-ciphertext' })
    const publish = vi.fn(async () => undefined)
    await expect(
      sweepAccountSecurity(harness.db, options({ publish })),
    ).rejects.toThrow()
    expect(publish).toHaveBeenCalledWith(scope.userId, id, [workspace])
    expect((await operation()).cleanupPending).toBe(true)
  })

  it('does not mark room discovery complete on a page failure', async () => {
    harness.sqlite.exec('drop table workspace_participants')
    await expect(sweepAccountSecurity(harness.db, options())).rejects.toThrow()
    expect((await operation()).roomsRecorded).toBe(false)
    expect((await operation()).cleanupPending).toBe(true)
  })

  it('refuses the discovery page limit rather than publishing a truncated workspace set', async () => {
    const insertOrg = harness.sqlite.prepare(
      'insert into organization (id, name, slug, created_at, updated_at) values (?, ?, ?, ?, ?)',
    )
    const insertAnchor = harness.sqlite.prepare(
      'insert into workspace_participants (organization_id, user_id, created_at) values (?, ?, ?)',
    )
    harness.sqlite.exec('BEGIN')
    for (let index = 0; index <= 25000; index += 1) {
      const organizationId = `room-${String(index).padStart(5, '0')}`
      insertOrg.run(
        organizationId,
        'Fixture workspace',
        organizationId,
        now,
        now,
      )
      insertAnchor.run(organizationId, scope.userId, now)
    }
    harness.sqlite.exec('COMMIT')
    const publish = vi.fn(async () => undefined)
    await expect(
      sweepAccountSecurity(harness.db, options({ publish })),
    ).rejects.toThrow()
    expect(publish).not.toHaveBeenCalled()
    expect((await operation()).roomsRecorded).toBe(false)
  })
})
