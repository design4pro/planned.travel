import { mkdtemp, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { drizzle } from 'drizzle-orm/d1'
import { eq } from 'drizzle-orm'
import { getPlatformProxy } from 'wrangler'
import { expect, inject, it } from 'vitest'
import { user, securityFence, account, twoFactor, securityOperation, factorProposal } from '#/server/db/auth-schema'
import { createAccountAuthority } from '#/server/auth/account-authority'
import {
  insertNativeSession,
  factorSnapshot,
  reserveFactorAttempt,
  commitFactor,
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
      await db.insert(account).values({ id: 'factor-credential', issuer: 'credential', accountId: userId, providerId: 'credential', userId, password: 'fixture-hash', createdAt: new Date(now), updatedAt: new Date(now) })
      await db.insert(twoFactor).values({ id: 'active-factor', userId, secret: 'fixture-encrypted-secret', backupCodes: 'fixture-encrypted-set', verified: true })
      await db.update(user).set({ twoFactorEnabled: true }).where(eq(user.id, userId))
      await registerRevocation(scope, { id: 'factor-change', sessionId: 'current', intent: 'disable', kind: 'disable', receiptDigest: 'receipt', revision: 1, expiresAt: now + 300000 })
      const reservation = await reserveFactorAttempt(scope, 1, 'active', now)
      if (!reservation) throw new Error('Fixture reservation refused')
      const input = { id: 'factor-change', sessionId: 'current', token: 'fixture-current', intent: 'disable', kind: 'disable' as const, receiptDigest: 'receipt', claim: 'factor-winner', now, expected: await factorSnapshot(scope), proposed: null, reservations: [reservation], replay: [{ digest: 'fixture-digest', step: Math.floor(now / 30000) }], newSession: { id: 'rotated', token: 'fixture-rotated', expiresAt: now + 600000 } }
      let faultAt = 0
      let statementCount = 1
      const faultDriver = new Proxy(platform.env.DB, {
        get(target, property) {
          if (property === 'batch') return async (statements: Array<D1PreparedStatement>) => {
            statementCount = statements.length
            const batch = [...statements]
            if (faultAt >= 0) batch.splice(faultAt, 0, target.prepare('select abs(-9223372036854775808)'))
            return target.batch(batch)
          }
          const value: unknown = Reflect.get(target, property)
          return typeof value === 'function' ? value.bind(target) : value
        },
      })
      const faultScope = { ...scope, db: drizzle(faultDriver) }
      const tables = ['user', 'account', 'two_factor', 'session', 'session_authority', 'account_security', 'account_security_fence', 'account_security_operation', 'factor_budget', 'factor_replay', 'factor_proposal']
      const footprint = () => Promise.all(tables.map((table) => platform.env.DB.prepare(`select * from ${table} order by rowid`).raw()))
      const proposalReservation = await reserveFactorAttempt(scope, 1, 'proposal', now)
      if (!proposalReservation) throw new Error('Fixture proposal reservation refused')
      await db.insert(factorProposal).values({ digest: 'proposal-digest', operationId: input.id, userId, payload: 'encrypted-fixture', expiresAt: now + 300000 })
      const replacement = { ...input, kind: 'replace' as const, proposalDigest: 'proposal-digest', proposed: { id: 'replacement-factor', secret: 'new-encrypted-secret', backupCodes: 'new-encrypted-set' }, reservations: [...input.reservations, proposalReservation], replay: [...input.replay, { digest: 'new-secret-digest', step: Math.floor(now / 30000) }] }
      for (const variant of [input, replacement]) {
        await db.update(securityOperation).set({ kind: variant.kind }).where(eq(securityOperation.id, input.id))
        const before = await footprint()
        for (faultAt = 0; faultAt <= statementCount; faultAt++) {
          await expect(commitFactor(faultScope, variant)).rejects.toThrow('Account authority could not be established.')
          expect(await footprint()).toEqual(before)
        }
      }
      await db.update(securityOperation).set({ kind: 'disable' }).where(eq(securityOperation.id, input.id))
      faultAt = -1
      expect(await commitFactor(faultScope, input)).toBe(true)
      expect(await acceptedSession(scope, 'fixture-current', Date.now())).toBeNull()
      expect(await acceptedSession(scope, 'fixture-rotated', Date.now())).not.toBeNull()

    })
  } finally {
    await platform.dispose()
    await rm(directory, { recursive: true, force: true })
  }
}, 60000)
