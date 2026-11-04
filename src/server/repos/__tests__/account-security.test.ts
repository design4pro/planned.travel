import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import {
  accountSecurity,
  account,
  twoFactor,
  factorBudget,
  factorReplay,
  factorProposal,
  securityFence,
  securityOperation,
  session,
  sessionAuthority,
  user,
} from '#/server/db/auth-schema'
import { createAccountAuthority } from '#/server/auth/account-authority'
import {
  reserveNativeAccountDeletion,
  factorSnapshot,
  factorRetryAfter,
  readFactorProposal,
  consumeNativeBackup,
  factorStepUsed,
  reserveFactorAttempt,
  resetFactorAttempts,
  commitFactor,
  refuseFactorOperation,
  reservedAccountDeletions,
  acceptedSession,
  cleanupPage,
  commitRevocation,
  finishCleanupReference,
  noteCleanupAttempt,
  operationFor,
  readEntryFence,
  recordCleanupReference,
  insertNativeSession,
  registerRevocation,
  setCleanupState,
} from '../account-security'
import { createHarness } from './harness'
import type { Harness } from './harness'
import type { AccountAuthScope } from '#/server/auth/account-authority-lib/scope'

let harness: Harness
let first: AccountAuthScope
let second: AccountAuthScope
const now = Date.now()

async function addSession(scope: AccountAuthScope, id: string) {
  await insertNativeSession(
    scope,
    {
      id,
      token: `fixture-${id}`,
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
async function registration(
  scope: AccountAuthScope,
  id: string,
  sessionId: string,
) {
  await registerRevocation(scope, {
    id,
    sessionId,
    intent: id,
    receiptDigest: `fixture-digest-${id}`,
    revision: 0,
    expiresAt: now + 300000,
  })
}
async function footprint() {
  return {
    fence: await harness.db.select().from(securityFence),
    accounts: await harness.db.select().from(accountSecurity),
    sessions: await harness.db.select().from(session),
    proofs: await harness.db.select().from(sessionAuthority),
    operations: await harness.db.select().from(securityOperation),
  }
}
async function commit(scope: AccountAuthScope, id: string, sessionId: string) {
  return commitRevocation(scope, {
    id,
    sessionId,
    token: `fixture-${sessionId}`,
    intent: id,
    claim: crypto.randomUUID(),
    now,
  })
}

beforeEach(async () => {
  harness = await createHarness()
  const a = await harness.seedTenant('account-a')
  const b = await harness.seedTenant('account-b')
  const authority = createAccountAuthority(harness.db, () => false)
  await authority.boundary(async () => {
    first = (await authority.bind(a.ownerUserId)).scope
    second = (await authority.bind(b.ownerUserId)).scope
  })
  await addSession(first, 'current')
  await addSession(first, 'other')
  await addSession(second, 'unrelated')
  await harness.db.update(securityFence).set({
    ready: true,
    cutover: true,
    anchorBackfillRunId: 'fixture-complete',
  })
})
afterEach(() => harness.close())

describe('account revocation through the atomic repository interface', () => {
  it('rechecks session freshness at the winning D1 claim after a request waited in the queue', async () => {
    await registration(first, 'delayed-operation', 'current')
    await harness.db
      .update(session)
      .set({ createdAt: new Date(now - 309000) })
      .where(eq(session.id, 'current'))
    const before = await footprint()
    expect(
      await commitRevocation(first, {
        id: 'delayed-operation',
        sessionId: 'current',
        token: 'fixture-current',
        intent: 'delayed-operation',
        claim: 'delayed-claim',
        now: now - 10000,
      }),
    ).toBe(false)
    expect(await footprint()).toEqual(before)
  })

  it('retains the current token and separates accounts and their workspaces', async () => {
    await registration(first, 'op', 'current')
    expect(await commit(first, 'op', 'current')).toBe(true)
    expect(
      (await acceptedSession(first, 'fixture-current', now)) !== null,
    ).toBe(true)
    expect((await acceptedSession(first, 'fixture-other', now)) === null).toBe(
      true,
    )
    expect(
      (await acceptedSession(second, 'fixture-unrelated', now)) !== null,
    ).toBe(true)
    expect(
      (await acceptedSession(second, 'fixture-current', now)) === null,
    ).toBe(true)
    expect(await operationFor(second, 'op')).toBeNull()
    expect((await cleanupPage(first, 1, '', 200)).map((row) => row.id)).toEqual(
      ['other'],
    )
    expect(await cleanupPage(second, 1, '', 200)).not.toContainEqual(
      expect.objectContaining({ id: 'other' }),
    )
    const before = await footprint()
    await setCleanupState(second, 'op', { cleanupPending: false })
    await noteCleanupAttempt(second, 'op', now)
    await recordCleanupReference(second, 'op', 'other', 'fixture-ciphertext')
    await finishCleanupReference(second, 'op', 'other')
    expect(await footprint()).toEqual(before)
  })

  it('does not repeat committed retries', async () => {
    await registration(first, 'op', 'current')
    expect(await commit(first, 'op', 'current')).toBe(true)
    const before = await footprint()
    expect(await commit(first, 'op', 'current')).toBe(true)
    expect(await footprint()).toEqual(before)
  })

  it('loses CAS without changing even the global fence', async () => {
    await registration(first, 'op', 'current')
    await harness.db.update(accountSecurity).set({ revision: 1 })
    const before = await footprint()
    expect(await commit(first, 'op', 'current')).toBe(false)
    expect(await footprint()).toEqual(before)
  })

  it('rolls back a real statement fault after the winning claim and fence update', async () => {
    await registration(first, 'op', 'current')
    harness.sqlite.exec(
      "create trigger fixture_failure before update on account_security begin select raise(abort, 'fixture failure'); end",
    )
    const before = await footprint()
    await expect(commit(first, 'op', 'current')).rejects.toThrow()
    expect(await footprint()).toEqual(before)
  })

  it('refuses a driver without atomic batching before writing', async () => {
    await registration(first, 'op', 'current')
    const db = new Proxy(harness.db, {
      get: (target, key, receiver) =>
        key === 'batch' ? undefined : Reflect.get(target, key, receiver),
    })
    const before = await footprint()
    await expect(commit({ ...first, db }, 'op', 'current')).rejects.toThrow()
    expect(await footprint()).toEqual(before)
  })

  it('does not grant a foreign session registration', async () => {
    await expect(registration(second, 'op', 'current')).rejects.toThrow()
    expect(await operationFor(first, 'op')).toBeNull()
    expect(await operationFor(second, 'op')).toBeNull()
  })

  it('fails closed on missing or reset authority after cutover', async () => {
    await harness.db.update(securityFence).set({
      ready: true,
      cutover: true,
      value: 1,
      anchorBackfillRunId: 'fixture-complete',
    })
    await harness.db.update(accountSecurity).set({ lastFence: 1 })
    expect((await readEntryFence(harness.db, true)).enforced).toBe(true)
    await harness.db.update(securityFence).set({ value: 0 })
    await expect(readEntryFence(harness.db, false)).rejects.toThrow()
    await harness.db.delete(securityFence)
    await expect(readEntryFence(harness.db, false)).rejects.toThrow()
    await expect(readEntryFence(harness.db, true)).rejects.toThrow()
    expect(await harness.db.select().from(user)).toHaveLength(2)
  })
  it('refuses deletion after revocation wins, retaining durable cleanup', async () => {
    await registration(first, 'op', 'current')
    expect(await commit(first, 'op', 'current')).toBe(true)
    const before = await footprint()
    await expect(
      reserveNativeAccountDeletion(first, 'delete', now),
    ).rejects.toThrow()
    expect(await footprint()).toEqual(before)
  })

  it('refuses revocation after deletion reserves the account and retains restart recovery', async () => {
    await registration(first, 'op', 'current')
    expect(await reserveNativeAccountDeletion(first, 'delete', now)).toBe(
      'delete',
    )
    const before = await footprint()
    expect(await commit(first, 'op', 'current')).toBe(false)
    expect(await footprint()).toEqual(before)
    expect(await reservedAccountDeletions(harness.db, now + 60001)).toEqual([
      first.userId,
    ])
    expect(
      await reserveNativeAccountDeletion(first, 'retry', now + 60001),
    ).toBe('delete')
    expect(await acceptedSession(first, 'fixture-current', now)).toBeNull()
  })
})

describe('factor authority and shared proof reservations', () => {
  async function enabledFactor() {
    await harness.db.insert(account).values({
      id: 'credential-a',
      issuer: 'credential',
      accountId: first.userId,
      providerId: 'credential',
      userId: first.userId,
      password: 'fixture-hash',
      createdAt: new Date(now),
      updatedAt: new Date(now),
    })
    await harness.db.insert(twoFactor).values({
      id: 'factor-a',
      userId: first.userId,
      secret: 'fixture-encrypted-secret',
      backupCodes: 'fixture-encrypted-set',
      verified: true,
    })
    await harness.db
      .update(user)
      .set({ twoFactorEnabled: true })
      .where(eq(user.id, first.userId))
  }
  async function disableInput() {
    await enabledFactor()
    await registerRevocation(first, {
      id: 'factor-operation',
      sessionId: 'current',
      intent: 'disable-intent',
      kind: 'disable',
      receiptDigest: 'fixture-receipt',
      revision: 0,
      expiresAt: now + 300000,
    })
    const reservation = await reserveFactorAttempt(first, 0, 'active', now)
    if (!reservation) throw new Error('Fixture reservation was refused')
    return {
      id: 'factor-operation',
      intent: 'disable-intent',
      kind: 'disable' as const,
      sessionId: 'current',
      token: 'fixture-current',
      receiptDigest: 'fixture-receipt',
      claim: 'winner',
      now,
      expected: await factorSnapshot(first),
      proposed: null,
      reservations: [reservation],
      replay: [
        { digest: 'fixture-secret-digest', step: Math.floor(now / 30000) },
      ],
      newSession: {
        id: 'rotated',
        token: 'fixture-rotated',
        expiresAt: now + 600000,
      },
    }
  }
  it('spends concurrent attempts once, refuses the ninth and recovers exactly at the deadline', async () => {
    const attempts = await Promise.all(
      Array.from({ length: 9 }, () =>
        reserveFactorAttempt(first, 0, 'proposal', now),
      ),
    )
    const accepted = attempts.filter((entry) => entry !== null)
    expect(accepted).toHaveLength(8)
    expect(new Set(accepted.map((entry) => entry.version)).size).toBe(8)
    expect(
      await reserveFactorAttempt(second, 0, 'proposal', now),
    ).not.toBeNull()
    expect(
      await reserveFactorAttempt(first, 0, 'proposal', now + 899999),
    ).toBeNull()
    expect(
      await reserveFactorAttempt(first, 0, 'proposal', now + 900000),
    ).toMatchObject({ version: 9 })
  })
  it('does not let an old success reset a newer failed attempt or another account', async () => {
    const older = await reserveFactorAttempt(first, 0, 'active', now)
    const newer = await reserveFactorAttempt(first, 0, 'active', now)
    if (!older || !newer) throw new Error('Fixture reservation was refused')
    await reserveFactorAttempt(second, 0, 'active', now)
    const before = await harness.db.select().from(factorBudget)
    await resetFactorAttempts(first, 0, older)
    expect(await harness.db.select().from(factorBudget)).toEqual(before)
    await resetFactorAttempts(first, 0, newer)
    expect(
      (
        await harness.db
          .select()
          .from(factorBudget)
          .where(eq(factorBudget.userId, first.userId))
      )[0].attempts,
    ).toBe(0)
    expect(
      (
        await harness.db
          .select()
          .from(factorBudget)
          .where(eq(factorBudget.userId, second.userId))
      )[0].attempts,
    ).toBe(1)
  })
  it('imports a legacy account lock before allowing any reservation', async () => {
    await enabledFactor()
    await harness.db
      .update(twoFactor)
      .set({ failedVerificationCount: 8, lockedUntil: new Date(now + 4000) })
    expect(await reserveFactorAttempt(first, 0, 'active', now)).toBeNull()
    expect(
      await reserveFactorAttempt(first, 0, 'active', now + 3999),
    ).toBeNull()
    expect(
      await reserveFactorAttempt(first, 0, 'active', now + 4000),
    ).not.toBeNull()
  })
  it('changes factor, revisions, current session, replay and cleanup together and isolates another account', async () => {
    const input = await disableInput()
    expect((await factorSnapshot(second)).factor).toBeNull()
    expect((await factorSnapshot(second)).credential).toBeNull()
    const beforeOther = await acceptedSession(second, 'fixture-unrelated', now)
    expect(await commitFactor(first, input)).toBe(true)
    expect((await factorSnapshot(first)).enabled).toBe(false)
    expect((await factorSnapshot(first)).factor).toBeNull()
    expect(
      await acceptedSession(first, 'fixture-current', Date.now()),
    ).toBeNull()
    expect(
      await acceptedSession(first, 'fixture-rotated', Date.now()),
    ).not.toBeNull()
    expect(await acceptedSession(second, 'fixture-unrelated', now)).toEqual(
      beforeOther,
    )
    expect((await harness.db.select().from(factorReplay))[0].step).toBe(
      input.replay[0].step,
    )
    expect(await operationFor(first, input.id)).toMatchObject({
      cleanupPending: true,
      factorEnabled: false,
    })
  })
  it('has exactly one winner for concurrent destructive requests and leaves a lost claim unchanged', async () => {
    const input = await disableInput()
    const before = await footprint()
    expect(await commitFactor(second, input)).toBe(false)
    expect(await footprint()).toEqual(before)
    const results = await Promise.all([
      commitFactor(first, input),
      commitFactor(first, {
        ...input,
        claim: 'other',
        newSession: {
          ...input.newSession,
          id: 'other-rotated',
          token: 'other-rotated-token',
        },
      }),
    ])
    expect(results.filter(Boolean)).toHaveLength(1)
    expect(
      (
        await harness.db
          .select()
          .from(sessionAuthority)
          .where(eq(sessionAuthority.userId, first.userId))
      ).filter((row) => row.revision === 1),
    ).toHaveLength(1)
  })
  it.each(['disable', 'replace', 'enable'] as const)(
    'permits only one authority advance for concurrent %s changes',
    async (kind) => {
      const input = await disableInput()
      if (kind === 'enable') {
        await harness.db
          .delete(twoFactor)
          .where(eq(twoFactor.userId, first.userId))
        await harness.db
          .update(user)
          .set({ twoFactorEnabled: false })
          .where(eq(user.id, first.userId))
      }
      await harness.db
        .update(securityOperation)
        .set({ kind })
        .where(eq(securityOperation.id, input.id))
      await registerRevocation(first, {
        id: 'contender',
        sessionId: 'other',
        intent: 'contender-intent',
        kind,
        receiptDigest: 'other-receipt',
        revision: 0,
        expiresAt: now + 300000,
      })
      const expected = await factorSnapshot(first)
      const proposalReservation = await reserveFactorAttempt(
        first,
        0,
        'proposal',
        now,
      )
      if (!proposalReservation) throw new Error('Missing fixture reservation')
      for (const id of [input.id, 'contender'])
        await harness.db.insert(factorProposal).values({
          digest: `digest-${id}`,
          operationId: id,
          userId: first.userId,
          payload: 'fixture-ciphertext',
          expiresAt: now + 300000,
        })
      const candidate = {
        ...input,
        kind,
        expected,
        proposed:
          kind === 'disable'
            ? null
            : {
                id: 'new-factor',
                secret: 'new-encrypted-secret',
                backupCodes: 'new-encrypted-set',
              },
        proposalDigest: `digest-${input.id}`,
        reservations:
          kind === 'disable' ? input.reservations : [proposalReservation],
      }
      const contenders = [
        candidate,
        {
          ...candidate,
          id: 'contender',
          sessionId: 'other',
          token: 'fixture-other',
          intent: 'contender-intent',
          receiptDigest: 'other-receipt',
          claim: 'contender-claim',
          proposalDigest: 'digest-contender',
          newSession: {
            ...input.newSession,
            id: 'contender-session',
            token: 'contender-token',
          },
        },
      ]
      const results = await Promise.all(
        contenders.map((value) => commitFactor(first, value)),
      )
      expect(results.filter(Boolean)).toHaveLength(1)
      expect(
        (
          await harness.db
            .select()
            .from(accountSecurity)
            .where(eq(accountSecurity.userId, first.userId))
        )[0],
      ).toMatchObject({ revision: 1, trustRevision: 1 })
      expect(
        await acceptedSession(second, 'fixture-unrelated', Date.now()),
      ).not.toBeNull()
    },
  )
  it('arbitrates disable versus a staged replacement and cancellation versus commit', async () => {
    const input = await disableInput()
    await registerRevocation(first, {
      id: 'replacement',
      sessionId: 'other',
      intent: 'replacement-intent',
      kind: 'replace',
      receiptDigest: 'replacement-receipt',
      revision: 0,
      expiresAt: now + 300000,
    })
    const reservation = await reserveFactorAttempt(first, 0, 'proposal', now)
    if (!reservation) throw new Error('Missing fixture reservation')
    await harness.db.insert(factorProposal).values({
      digest: 'replacement-proposal',
      operationId: 'replacement',
      userId: first.userId,
      payload: 'encrypted-fixture',
      expiresAt: now + 300000,
    })
    const replacement = {
      ...input,
      id: 'replacement',
      sessionId: 'other',
      token: 'fixture-other',
      intent: 'replacement-intent',
      kind: 'replace' as const,
      receiptDigest: 'replacement-receipt',
      proposalDigest: 'replacement-proposal',
      proposed: {
        id: 'new-factor',
        secret: 'new-encrypted-secret',
        backupCodes: 'new-encrypted-set',
      },
      reservations: [...input.reservations, reservation],
    }
    const results = await Promise.all([
      commitFactor(first, input),
      commitFactor(first, replacement),
      refuseFactorOperation(first, 'replacement', Date.now()),
    ])
    expect(results.filter((value) => value === true)).toHaveLength(1)
    expect(
      (
        await harness.db
          .select()
          .from(accountSecurity)
          .where(eq(accountSecurity.userId, first.userId))
      )[0].revision,
    ).toBe(1)
    expect(await harness.db.select().from(factorProposal)).toHaveLength(0)
  })

  it('isolates proposal reads, cancellation, budgets, replay and native backup consumption by account', async () => {
    const input = await disableInput()
    await harness.db.insert(factorProposal).values({
      digest: 'isolated-proposal',
      operationId: input.id,
      userId: first.userId,
      payload: 'encrypted-fixture',
      expiresAt: now + 300000,
    })
    expect(
      await readFactorProposal(second, input.id, 'isolated-proposal'),
    ).toBeNull()
    expect(
      await readFactorProposal(first, input.id, 'isolated-proposal'),
    ).not.toBeNull()
    await refuseFactorOperation(second, input.id, now)
    expect((await operationFor(first, input.id))?.refusedAt).toBeNull()
    expect(await factorRetryAfter(second, 'active', now)).toBe(1)
    expect(await factorRetryAfter(first, 'active', now)).toBe(900)
    const factor = input.expected.factor
    if (!factor) throw new Error('Fixture factor missing')
    expect(
      await consumeNativeBackup(
        second,
        { revision: 0, trustRevision: 0, lastFence: 0 },
        factor,
        'other-set',
      ),
    ).toBeNull()
    expect(await commitFactor(first, input)).toBe(true)
    expect(
      await factorStepUsed(
        second,
        input.replay[0].digest,
        input.replay[0].step,
      ),
    ).toBe(false)
    expect(
      await factorStepUsed(first, input.replay[0].digest, input.replay[0].step),
    ).toBe(true)
  })
  it('cascades factor metadata on account erasure without touching another account', async () => {
    const input = await disableInput()
    await harness.db
      .insert(factorProposal)
      .values({
        digest: 'erase-proposal',
        operationId: input.id,
        userId: first.userId,
        payload: 'encrypted-fixture',
        expiresAt: now + 300000,
      })
    for (const scope of [first, second]) {
      await reserveFactorAttempt(scope, 0, 'proposal', now)
      await harness.db
        .insert(factorReplay)
        .values({
          userId: scope.userId,
          secretDigest: 'fixture-digest',
          step: 1,
        })
    }
    await harness.db.delete(user).where(eq(user.id, first.userId))
    expect(await harness.db.select().from(factorProposal)).toHaveLength(0)
    expect(await harness.db.select().from(factorBudget)).toMatchObject([
      { userId: second.userId },
    ])
    expect(await harness.db.select().from(factorReplay)).toMatchObject([
      { userId: second.userId },
    ])
    expect(
      await acceptedSession(second, 'fixture-unrelated', Date.now()),
    ).not.toBeNull()
  })
})
