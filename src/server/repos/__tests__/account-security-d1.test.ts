import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { getPlatformProxy } from 'wrangler'
import { expect, inject, it } from 'vitest'
import { user, securityFence } from '#/server/db/auth-schema'
import { createAccountAuthority } from '#/server/auth/account-authority'
import {
  insertNativeSession,
  registerRevocation,
  commitRevocation,
  acceptedSession,
} from '../account-security'

it('executes conditional raw statements atomically on the real D1 driver', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'account-security-d1-'))
  const configPath = join(directory, 'wrangler.json')
  await writeFile(
    configPath,
    JSON.stringify({
      name: 'account-security-test',
      compatibility_date: '2026-08-15',
      d1_databases: [
        {
          binding: 'DB',
          database_name: 'test',
          database_id: '00000000-0000-0000-0000-000000000001',
        },
      ],
    }),
  )
  const platform = await getPlatformProxy<{ DB: D1Database }>({
    configPath,
    persist: false,
    remoteBindings: false,
  })
  try {
    for (const ddl of inject('schemaDdl'))
      await platform.env.DB.prepare(ddl).run()
    const db = drizzle(platform.env.DB)
    const now = Date.now()
    const userId = crypto.randomUUID()
    await db
      .insert(user)
      .values({
        id: userId,
        name: 'D1 fixture',
        email: 'd1-fixture@planned.travel',
        createdAt: new Date(now),
        updatedAt: new Date(now),
        banned: false,
      })
    const authority = createAccountAuthority(db, () => false)
    await authority.boundary(async () => {
      const { scope, proof } = await authority.bind(userId)
      for (const id of ['current', 'other'])
        await insertNativeSession(
          scope,
          {
            id,
            token: `fixture-${id}`,
            userId,
            activeOrganizationId: null,
            ipAddress: null,
            userAgent: null,
            impersonatedBy: null,
            createdAt: new Date(now),
            updatedAt: new Date(now),
            expiresAt: new Date(now + 600000),
          },
          proof,
          'native',
          now,
        )
      await db
        .update(securityFence)
        .set({ ready: true, cutover: true, anchorBackfillRunId: 'fixture' })
        .where(eq(securityFence.id, 1))
      await registerRevocation(scope, {
        id: 'operation',
        sessionId: 'current',
        intent: 'intent',
        receiptDigest: 'fixture-receipt',
        revision: 0,
        expiresAt: now + 300000,
      })
      await platform.env.DB.exec(
        "CREATE TRIGGER interrupt_revision BEFORE UPDATE ON account_security BEGIN SELECT RAISE(ABORT, 'fixture failure'); END",
      )
      await expect(
        commitRevocation(scope, {
          id: 'operation',
          sessionId: 'current',
          token: 'fixture-current',
          intent: 'intent',
          claim: 'failed',
          now,
        }),
      ).rejects.toThrow()
      expect(await acceptedSession(scope, 'fixture-other', now)).not.toBeNull()
      await platform.env.DB.exec('DROP TRIGGER interrupt_revision')
      expect(
        await commitRevocation(scope, {
          id: 'operation',
          sessionId: 'current',
          token: 'fixture-current',
          intent: 'intent',
          claim: 'winner',
          now,
        }),
      ).toBe(true)
      expect(
        await acceptedSession(scope, 'fixture-current', now),
      ).not.toBeNull()
      expect(await acceptedSession(scope, 'fixture-other', now)).toBeNull()
    })
  } finally {
    await platform.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}, 60000)
