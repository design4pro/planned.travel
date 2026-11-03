import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { accountSecurity, securityFence, securityOperation, session, sessionAuthority, user } from '#/server/db/auth-schema'
import { createAccountAuthority } from '#/server/auth/account-authority'
import {
  acceptedSession, cleanupPage, commitRevocation, finishCleanupReference,
  noteCleanupAttempt, operationFor, readEntryFence, recordCleanupReference,
  recordSessionProof, registerRevocation, setCleanupState,
} from '../account-security'
import { createHarness } from './harness'
import type { Harness } from './harness'
import type { AccountAuthScope } from '#/server/auth/account-authority-lib/scope'

let harness: Harness
let first: AccountAuthScope
let second: AccountAuthScope
const now = Date.now()

async function addSession(scope: AccountAuthScope, id: string) {
  await harness.db.insert(session).values({ id, token: `fixture-${id}`, userId: scope.userId, createdAt: new Date(now - 1000), updatedAt: new Date(now - 1000), expiresAt: new Date(now + 600000) })
  await recordSessionProof(scope, id, { revision: 0, trustRevision: 0, lastFence: 0 }, 'native', now - 1000)
}
async function registration(scope: AccountAuthScope, id: string, sessionId: string) {
  await registerRevocation(scope, { id, sessionId, intent: id, receiptDigest: `fixture-digest-${id}`, revision: 0, expiresAt: now + 300000 })
}
async function footprint() {
  return { fence: await harness.db.select().from(securityFence), accounts: await harness.db.select().from(accountSecurity), sessions: await harness.db.select().from(session), proofs: await harness.db.select().from(sessionAuthority), operations: await harness.db.select().from(securityOperation) }
}
async function commit(scope: AccountAuthScope, id: string, sessionId: string) {
  return commitRevocation(scope, { id, sessionId, token: `fixture-${sessionId}`, intent: id, claim: crypto.randomUUID(), now })
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
})
afterEach(() => harness.close())

describe('account revocation through the atomic repository interface', () => {
  it('retains the current token and separates accounts and their workspaces', async () => {
    await registration(first, 'op', 'current')
    expect(await commit(first, 'op', 'current')).toBe(true)
    expect(await acceptedSession(first, 'fixture-current', now) !== null).toBe(true)
    expect(await acceptedSession(first, 'fixture-other', now) === null).toBe(true)
    expect(await acceptedSession(second, 'fixture-unrelated', now) !== null).toBe(true)
    expect(await acceptedSession(second, 'fixture-current', now) === null).toBe(true)
    expect(await operationFor(second, 'op')).toBeNull()
    expect((await cleanupPage(first, 1, '', 200)).map((row) => row.id)).toEqual(['other'])
    expect(await cleanupPage(second, 1, '', 200)).not.toContainEqual(expect.objectContaining({ id: 'other' }))
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
    harness.sqlite.exec("create trigger fixture_failure before update on account_security begin select raise(abort, 'fixture failure'); end")
    const before = await footprint()
    await expect(commit(first, 'op', 'current')).rejects.toThrow()
    expect(await footprint()).toEqual(before)
  })

  it('refuses a driver without atomic batching before writing', async () => {
    await registration(first, 'op', 'current')
    const db = new Proxy(harness.db, { get: (target, key, receiver) => key === 'batch' ? undefined : Reflect.get(target, key, receiver) })
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
    await harness.db.update(securityFence).set({ ready: true, cutover: true, value: 1 })
    await harness.db.update(accountSecurity).set({ lastFence: 1 })
    await expect(readEntryFence(harness.db, true)).rejects.toThrow()
    await harness.db.update(securityFence).set({ value: 0 })
    await expect(readEntryFence(harness.db, false)).rejects.toThrow()
    await harness.db.delete(securityFence)
    await expect(readEntryFence(harness.db, false)).rejects.toThrow()
    await expect(readEntryFence(harness.db, true)).rejects.toThrow()
    expect(await harness.db.select().from(user)).toHaveLength(2)
  })
})
