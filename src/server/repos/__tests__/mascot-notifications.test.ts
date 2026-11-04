import { afterEach, describe, expect, it } from 'vitest'
import { notifications } from '#/server/db/schema'
import { listMascotNotifications } from '../mascot-notifications'
import { createHarness } from './harness'
import type { Harness } from './harness'

let harness: Harness | undefined
afterEach(() => harness?.close())

describe('mascot notification candidates', () => {
  it('filters tenant, recipient, state and time before limiting and projects no content', async () => {
    harness = await createHarness()
    const tenant = await harness.seedTenant('mascot')
    const other = await tenant.addUser('Other')
    const foreign = await harness.seedTenant('foreign')
    const now = new Date('2026-01-08T12:00:00.000Z')
    const row = (
      id: string,
      recipientUserId: string,
      organizationId: string,
      createdAt: Date,
    ) => ({
      id,
      recipientUserId,
      organizationId,
      createdAt,
      updatedAt: createdAt,
      titleKey: 'secret',
      bodyKey: 'secret',
      actionUrl: 'https://example.com',
    })
    const rows = [
      ...Array.from({ length: 51 }, (_, i) =>
        row(
          `valid-${String(i).padStart(2, '0')}`,
          tenant.ownerUserId,
          tenant.organizationId,
          new Date(now.getTime() - i),
        ),
      ),
      row('other-recipient', other, tenant.organizationId, now),
      row('other-tenant', tenant.ownerUserId, foreign.organizationId, now),
      row(
        'too-old',
        tenant.ownerUserId,
        tenant.organizationId,
        new Date(now.getTime() - 7 * 86_400_000 - 1),
      ),
      row(
        'future',
        tenant.ownerUserId,
        tenant.organizationId,
        new Date(now.getTime() + 1),
      ),
      {
        ...row('read', tenant.ownerUserId, tenant.organizationId, now),
        isRead: true,
      },
      {
        ...row('answered', tenant.ownerUserId, tenant.organizationId, now),
        type: 'action',
        response: 'accepted',
      },
    ]
    for (const item of rows) await harness.db.insert(notifications).values(item)
    const result = await listMascotNotifications(tenant.scope, now)
    expect(result).toHaveLength(50)
    expect(result.map((item) => item.id)).toEqual(
      Array.from(
        { length: 50 },
        (_, i) => `valid-${String(i).padStart(2, '0')}`,
      ),
    )
    expect(Object.keys(result[0]).sort()).toEqual(['createdAt', 'id', 'type'])
  })
})
