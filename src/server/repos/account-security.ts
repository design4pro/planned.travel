/**
 * Closed account-auth repository (ADR 0048), never tenant content. Production callers:
 * auth/account-authority.ts, auth/factor-management.ts and auth/account-security-cleanup.ts.
 * The last caller has only bounded pending-work discovery and account-bound cleanup operations.
 */
import { and, asc, eq, gt, sql } from 'drizzle-orm'
import {
  accountSecurity,
  securityCleanup,
  securityFence,
  securityOperation,
  securityRoomCleanup,
  session,
  sessionAuthority,
  user,
  verificationAuthority,
} from '#/server/db/auth-schema'
import type { AccountAuthDatabase as Database } from '#/server/auth/account-authority-lib/scope'
import type { AccountAuthScope, ProofRevision } from '#/server/auth/account-authority-lib/scope'
import type { BatchStatement } from './batch'

export class AccountAuthorityError extends Error {
  constructor() { super('Account authority could not be established.') }
}

async function atomic(db: Database, statements: [BatchStatement, ...Array<BatchStatement>]): Promise<void> {
  if (!('batch' in db) || typeof db.batch !== 'function') throw new AccountAuthorityError()
  await db.batch(statements)
}

/** Primary binding only, never a replica/KV handle; a missing active singleton fails closed. */
export async function readEntryFence(db: Database, expand: boolean): Promise<number> {
  if (expand) await db.run(sql`insert into account_security_fence (id, value, ready, cutover) select 1, 0, 0, 0 where not exists(select 1 from account_security) on conflict(id) do nothing`)
  const [row] = await db.select().from(securityFence).where(eq(securityFence.id, 1))
  if (!row || (expand && (row.cutover || row.value !== 0)) || (!expand && !row.ready) || !Number.isSafeInteger(row.value) || row.value < 0 || row.value >= Number.MAX_SAFE_INTEGER) throw new AccountAuthorityError()
  const [invalid] = await db.select({ userId: accountSecurity.userId }).from(accountSecurity).where(gt(accountSecurity.lastFence, row.value)).limit(1)
  if (invalid) throw new AccountAuthorityError()
  if (!expand && !row.cutover) await db.update(securityFence).set({ cutover: true }).where(eq(securityFence.id, 1))
  return row.value
}

export async function initializeAccount(scope: AccountAuthScope): Promise<void> {
  await scope.db.insert(accountSecurity).values({ userId: scope.userId, revision: 0, trustRevision: 0, lastFence: 0 }).onConflictDoNothing()
}

export async function readAccountProof(scope: AccountAuthScope, entryFence: number, expand: boolean): Promise<ProofRevision> {
  if (expand) await initializeAccount(scope)
  const [row] = await scope.db.select({ revision: accountSecurity.revision, trustRevision: accountSecurity.trustRevision, lastFence: accountSecurity.lastFence }).from(accountSecurity).where(eq(accountSecurity.userId, scope.userId))
  if (!row || !Object.values(row).every((value) => Number.isSafeInteger(value) && value >= 0) || row.lastFence > entryFence) throw new AccountAuthorityError()
  return row
}

export async function recordSessionProof(scope: AccountAuthScope, sessionId: string, proof: ProofRevision, method: string, now: number): Promise<void> {
  await scope.db.run(sql`insert into session_authority (session_id, user_id, revision, method, proof_at)
    select s.id, s.user_id, a.revision, ${method}, ${now} from session s join account_security a on a.user_id = s.user_id
    where s.id = ${sessionId} and s.user_id = ${scope.userId} and a.revision = ${proof.revision}
    on conflict(session_id) do nothing`)
  const [row] = await scope.db.select({ revision: sessionAuthority.revision }).from(sessionAuthority).where(and(eq(sessionAuthority.sessionId, sessionId), eq(sessionAuthority.userId, scope.userId)))
  if (!row || row.revision !== proof.revision) throw new AccountAuthorityError()
}

export async function acceptedSession(scope: AccountAuthScope, token: string, now: number): Promise<typeof session.$inferSelect | null> {
  const [row] = await scope.db.select({ session }).from(session)
    .innerJoin(sessionAuthority, and(eq(sessionAuthority.sessionId, session.id), eq(sessionAuthority.userId, session.userId)))
    .innerJoin(accountSecurity, and(eq(accountSecurity.userId, session.userId), eq(accountSecurity.revision, sessionAuthority.revision)))
    .innerJoin(user, eq(user.id, session.userId))
    .where(and(eq(session.token, token), eq(session.userId, scope.userId), gt(session.expiresAt, new Date(now)), sql`(${user.banned} = 0 or (${user.banExpires} is not null and ${user.banExpires} <= ${now}))`, sql`typeof(${accountSecurity.revision}) = 'integer' and ${accountSecurity.revision} >= 0 and ${accountSecurity.revision} < ${Number.MAX_SAFE_INTEGER} and typeof(${sessionAuthority.proofAt}) = 'integer' and ${sessionAuthority.proofAt} >= 0 and ${sessionAuthority.proofAt} <= ${now} and ${sessionAuthority.method} in ('native', 'legacy')`))
  return row?.session ?? null
}

export async function recordVerificationProof(scope: AccountAuthScope, digest: string, proof: ProofRevision, expiresAt: number): Promise<void> {
  await scope.db.run(sql`insert into verification_authority (identifier, user_id, revision, trust_revision, expires_at)
    select ${digest}, a.user_id, a.revision, a.trust_revision, ${expiresAt} from account_security a
    where a.user_id = ${scope.userId} and a.revision = ${proof.revision} and a.trust_revision = ${proof.trustRevision}
    on conflict(identifier) do nothing`)
  const [row] = await scope.db.select().from(verificationAuthority).where(and(eq(verificationAuthority.identifier, digest), eq(verificationAuthority.userId, scope.userId)))
  if (!row || row.revision !== proof.revision || row.trustRevision !== proof.trustRevision) throw new AccountAuthorityError()
}

export async function verificationProof(db: Database, digest: string, trust: boolean, now: number): Promise<{ userId: string; proof: ProofRevision } | null> {
  const [row] = await db.select({ userId: verificationAuthority.userId, revision: verificationAuthority.revision, trustRevision: verificationAuthority.trustRevision, lastFence: accountSecurity.lastFence }).from(verificationAuthority)
    .innerJoin(accountSecurity, eq(accountSecurity.userId, verificationAuthority.userId))
    .where(and(eq(verificationAuthority.identifier, digest), gt(verificationAuthority.expiresAt, now), trust ? eq(verificationAuthority.trustRevision, accountSecurity.trustRevision) : eq(verificationAuthority.revision, accountSecurity.revision)))
  return row ? { userId: row.userId, proof: { revision: row.revision, trustRevision: row.trustRevision, lastFence: row.lastFence } } : null
}

export async function registerRevocation(scope: AccountAuthScope, input: { id: string; sessionId: string; intent: string; receiptDigest: string; revision: number; expiresAt: number }): Promise<void> {
  await scope.db.run(sql`insert into account_security_operation (id, user_id, session_id, intent, receipt_digest, revision, expires_at, committed_at, claim, attempted_at, cleanup_pending, rooms_pending, rooms_recorded)
    select ${input.id}, s.user_id, s.id, ${input.intent}, ${input.receiptDigest}, a.revision, ${input.expiresAt}, null, null, 0, 0, 0, 0
    from session s join account_security a on a.user_id = s.user_id join session_authority m on m.session_id = s.id and m.revision = a.revision
    where s.id = ${input.sessionId} and s.user_id = ${scope.userId} and a.revision = ${input.revision}
    and s.impersonated_by is null and s.created_at > ${input.expiresAt - 600000} and s.expires_at > ${input.expiresAt - 300000}
    and not exists(select 1 from account_security_operation o where o.user_id = s.user_id and o.session_id = s.id and o.committed_at is null and o.expires_at > ${input.expiresAt - 300000})`)
  if (!await operationFor(scope, input.id)) throw new AccountAuthorityError()
}

export async function operationFor(scope: AccountAuthScope, id: string) {
  const [row] = await scope.db.select().from(securityOperation).where(and(eq(securityOperation.id, id), eq(securityOperation.userId, scope.userId)))
  return row ?? null
}

export async function commitRevocation(scope: AccountAuthScope, input: { id: string; sessionId: string; token: string; intent: string; claim: string; now: number }): Promise<boolean> {
  const { id, sessionId, token, intent, claim, now } = input
  const winning = sql`exists(select 1 from account_security_operation o where o.id = ${id} and o.user_id = ${scope.userId} and o.claim = ${claim} and o.committed_at is null)`
  await atomic(scope.db, [
    scope.db.run(sql`update account_security_operation set claim = ${claim}
      where id = ${id} and user_id = ${scope.userId} and session_id = ${sessionId} and intent = ${intent}
      and claim is null and committed_at is null and expires_at > ${now}
      and exists(select 1 from account_security a join session_authority m on m.user_id = a.user_id and m.revision = a.revision
        join session s on s.id = m.session_id where a.user_id = ${scope.userId} and a.revision = account_security_operation.revision
        and s.id = ${sessionId} and s.token = ${token} and s.impersonated_by is null
        and s.created_at > ${now - 300_000} and s.created_at <= ${now} and s.expires_at > ${now})
      and exists(select 1 from account_security_fence where id = 1 and value < ${Number.MAX_SAFE_INTEGER - 1})`),
    scope.db.run(sql`update account_security_fence set value = value + 1 where id = 1 and ${winning}`),
    scope.db.run(sql`update account_security set revision = revision + 1, last_fence = (select value from account_security_fence where id = 1)
      where user_id = ${scope.userId} and ${winning}`),
    scope.db.run(sql`update session_authority set revision = (select revision from account_security where user_id = ${scope.userId})
      where session_id = ${sessionId} and user_id = ${scope.userId} and ${winning}`),
    scope.db.run(sql`update account_security_operation set committed_at = ${now}, cleanup_pending = 1, rooms_pending = 1
      where id = ${id} and user_id = ${scope.userId} and claim = ${claim} and committed_at is null`),
  ])
  const outcome = await operationFor(scope, id)
  return outcome !== null && outcome.committedAt !== null
}

/** Preserves original session rows while any durable cleanup intent still needs them. */
export async function hasPendingCleanup(scope: AccountAuthScope): Promise<boolean> {
  const [row] = await scope.db.select({ id: securityOperation.id }).from(securityOperation).where(and(eq(securityOperation.userId, scope.userId), eq(securityOperation.cleanupPending, true))).limit(1)
  return row !== undefined
}

export async function cleanupPage(scope: AccountAuthScope, revision: number, after: string, limit: number) {
  if (limit < 1 || limit > 200) throw new AccountAuthorityError()
  return scope.db.select({ id: session.id, token: session.token }).from(session)
    .leftJoin(sessionAuthority, eq(sessionAuthority.sessionId, session.id))
    .where(and(eq(session.userId, scope.userId), gt(session.id, after), sql`(${sessionAuthority.revision} is null or ${sessionAuthority.revision} < ${revision})`)).orderBy(asc(session.id)).limit(limit)
}

export async function recordCleanupReference(scope: AccountAuthScope, operationId: string, sessionId: string, encryptedToken: string): Promise<void> {
  await atomic(scope.db, [
    scope.db.run(sql`insert into account_security_cleanup (id, operation_id, encrypted_token)
      select s.id, o.id, ${encryptedToken} from session s join account_security_operation o on o.user_id = s.user_id
      left join session_authority m on m.session_id = s.id
      where s.id = ${sessionId} and s.user_id = ${scope.userId} and o.id = ${operationId} and o.committed_at is not null
      and (m.revision is null or m.revision <= o.revision) on conflict(id) do nothing`),
    scope.db.delete(session).where(and(eq(session.id, sessionId), eq(session.userId, scope.userId), sql`exists(select 1 from account_security_cleanup c join account_security_operation o on o.id = c.operation_id where c.id = ${sessionId} and o.user_id = ${scope.userId})`)),
  ])
}

export async function pendingCleanupReferences(scope: AccountAuthScope, operationId: string) {
  return scope.db.select({ id: securityCleanup.id, encryptedToken: securityCleanup.encryptedToken }).from(securityCleanup)
    .innerJoin(securityOperation, and(eq(securityOperation.id, securityCleanup.operationId), eq(securityOperation.userId, scope.userId)))
    .where(eq(securityCleanup.operationId, operationId)).orderBy(asc(securityCleanup.id)).limit(200)
}

export async function finishCleanupReference(scope: AccountAuthScope, operationId: string, id: string): Promise<void> {
  await scope.db.delete(securityCleanup).where(and(eq(securityCleanup.id, id), eq(securityCleanup.operationId, operationId), sql`exists(select 1 from account_security_operation where id = ${operationId} and user_id = ${scope.userId})`))
}

export async function setCleanupState(scope: AccountAuthScope, id: string, state: { cleanupPending?: boolean; roomsPending?: boolean }): Promise<void> {
  await scope.db.update(securityOperation).set(state).where(and(eq(securityOperation.id, id), eq(securityOperation.userId, scope.userId)))
}

/** System discovery projects only account/operation ids, bounded to one page per scheduled run. */
export async function pendingOperations(db: Database) {
  return db.select({ id: securityOperation.id, userId: securityOperation.userId, revision: securityOperation.revision, roomsPending: securityOperation.roomsPending, roomsRecorded: securityOperation.roomsRecorded }).from(securityOperation)
    .where(and(eq(securityOperation.cleanupPending, true), sql`${securityOperation.committedAt} is not null`)).orderBy(asc(securityOperation.attemptedAt), asc(securityOperation.id)).limit(1)
}

export async function receiptStatus(db: Database, id: string, digest: string, now: number) {
  const [row] = await db.select({ committedAt: securityOperation.committedAt, cleanupPending: securityOperation.cleanupPending, expiresAt: securityOperation.expiresAt }).from(securityOperation)
    .where(and(eq(securityOperation.id, id), eq(securityOperation.receiptDigest, digest), sql`(${securityOperation.expiresAt} > ${now} or (${securityOperation.committedAt} is not null and ${securityOperation.committedAt} + 900000 > ${now}))`))
  return row ?? null
}

export async function pendingRegistration(scope: AccountAuthScope, sessionId: string, now: number): Promise<boolean> {
  const [row] = await scope.db.select({ id: securityOperation.id }).from(securityOperation).where(and(eq(securityOperation.userId, scope.userId), eq(securityOperation.sessionId, sessionId), gt(securityOperation.expiresAt, now), sql`${securityOperation.committedAt} is null`)).limit(1)
  return row !== undefined
}

/** Native adapter deletion only; a pending operation keeps its durable source in the same statement. */
export async function deleteNativeSessionRows(db: Database, where: ReadonlyArray<{ field: string; operator?: string; value: unknown; connector?: string }>): Promise<number> {
  const columns = { id: session.id, token: session.token, userId: session.userId }
  const terms = where.map((term) => {
    if (!(term.field in columns) || (term.connector && term.connector !== 'AND')) throw new AccountAuthorityError()
    const column = columns[term.field as keyof typeof columns]
    if (!term.operator || term.operator === 'eq') {
      if (typeof term.value !== 'string') throw new AccountAuthorityError()
      return eq(column, term.value)
    }
    if (term.operator !== 'in' || !Array.isArray(term.value) || term.value.length > 90 || !term.value.every((value): value is string => typeof value === 'string')) throw new AccountAuthorityError()
    if (term.value.length === 0) return sql`0`
    return sql`${column} in (${sql.join(term.value.map((value) => sql`${value}`), sql`, `)})`
  })
  if (terms.length === 0) throw new AccountAuthorityError()
  const matching = db.select({ id: session.id }).from(session).where(and(...terms))
  await atomic(db, [
    db.delete(sessionAuthority).where(sql`${sessionAuthority.sessionId} in (${matching})`),
    db.delete(session).where(and(...terms, sql`not exists(select 1 from account_security_operation o where o.user_id = ${session.userId} and o.cleanup_pending = 1)`)),
  ])
  return 0
}

export async function noteCleanupAttempt(scope: AccountAuthScope, id: string, now: number): Promise<void> {
  await scope.db.update(securityOperation).set({ attemptedAt: now }).where(and(eq(securityOperation.id, id), eq(securityOperation.userId, scope.userId)))
}

/** Expand-only bounded backfill; legacy sessions can never be relabelled after a revocation. */
export async function backfillLegacyAuthority(db: Database, now: number): Promise<void> {
  await readEntryFence(db, true)
  const rows = await db.select({ id: session.id, userId: session.userId, createdAt: session.createdAt }).from(session)
    .leftJoin(sessionAuthority, eq(sessionAuthority.sessionId, session.id))
    .innerJoin(user, eq(user.id, session.userId))
    .where(and(sql`${sessionAuthority.sessionId} is null`, gt(session.expiresAt, new Date(now)), eq(user.banned, false)))
    .orderBy(asc(session.id)).limit(200)
  for (const row of rows) {
    await db.insert(accountSecurity).values({ userId: row.userId, revision: 0, trustRevision: 0, lastFence: 0 }).onConflictDoNothing()
    await db.run(sql`insert into session_authority (session_id, user_id, revision, method, proof_at)
      select s.id, s.user_id, 0, 'legacy', s.created_at from session s join account_security a on a.user_id = s.user_id
      where s.id = ${row.id} and a.revision = 0 and a.last_fence = 0 on conflict(session_id) do nothing`)
  }
  await db.run(sql`update account_security_fence set ready = 1 where id = 1 and cutover = 0 and value = 0
    and not exists(select 1 from session s join user u on u.id = s.user_id left join session_authority m on m.session_id = s.id
      where s.expires_at > ${now} and u.banned = 0 and m.session_id is null)`)
}

/** Native session insertion and its proof are one conditional D1 batch, before any KV/cookie write. */
export async function insertNativeSession(scope: AccountAuthScope, row: typeof session.$inferSelect, proof: ProofRevision, method: string, now: number) {
  await atomic(scope.db, [
    scope.db.run(sql`insert into session (id, token, user_id, active_organization_id, ip_address, user_agent, impersonated_by, expires_at, created_at, updated_at)
      select ${row.id}, ${row.token}, a.user_id, ${row.activeOrganizationId}, ${row.ipAddress}, ${row.userAgent}, ${row.impersonatedBy}, ${row.expiresAt.getTime()}, ${row.createdAt.getTime()}, ${row.updatedAt.getTime()}
      from account_security a where a.user_id = ${scope.userId} and a.revision = ${proof.revision}`),
    scope.db.run(sql`insert into session_authority (session_id, user_id, revision, method, proof_at)
      select s.id, s.user_id, a.revision, ${method}, ${now} from session s join account_security a on a.user_id = s.user_id
      where s.id = ${row.id} and s.user_id = ${scope.userId} and a.revision = ${proof.revision}`),
  ])
  const [created] = await scope.db.select().from(session).where(and(eq(session.id, row.id), eq(session.userId, scope.userId)))
  if (!created) throw new AccountAuthorityError()
  return created
}

export async function promotePasswordSession(scope: AccountAuthScope, sessionId: string, proof: ProofRevision): Promise<void> {
  await scope.db.update(sessionAuthority).set({ method: 'native' }).where(and(eq(sessionAuthority.sessionId, sessionId), eq(sessionAuthority.userId, scope.userId), eq(sessionAuthority.revision, proof.revision), eq(sessionAuthority.method, 'password-pending'), sql`exists(select 1 from account_security a where a.user_id = ${scope.userId} and a.revision = ${proof.revision})`))
}

export async function recordRoomTargets(scope: AccountAuthScope, id: string, organizationIds: ReadonlyArray<string>): Promise<void> {
  const encoded = JSON.stringify(organizationIds)
  if (new TextEncoder().encode(encoded).length > 1000000) throw new AccountAuthorityError()
  await atomic(scope.db, [
    scope.db.run(sql`insert into account_security_room_cleanup (operation_id, organization_id)
      select o.id, j.value from account_security_operation o cross join json_each(${encoded}) j
      where o.id = ${id} and o.user_id = ${scope.userId} and o.committed_at is not null and o.rooms_recorded = 0 on conflict do nothing`),
    scope.db.run(sql`update account_security_operation set rooms_recorded = 1,
      rooms_pending = exists(select 1 from account_security_room_cleanup c where c.operation_id = ${id})
      where id = ${id} and user_id = ${scope.userId} and committed_at is not null and rooms_recorded = 0`),
  ])
}

export async function pendingRoomTargets(scope: AccountAuthScope, id: string): Promise<Array<string>> {
  const rows = await scope.db.select({ organizationId: securityRoomCleanup.organizationId }).from(securityRoomCleanup)
    .innerJoin(securityOperation, and(eq(securityOperation.id, securityRoomCleanup.operationId), eq(securityOperation.userId, scope.userId)))
    .where(eq(securityRoomCleanup.operationId, id)).orderBy(asc(securityRoomCleanup.organizationId)).limit(200)
  return rows.map((row) => row.organizationId)
}

export async function acknowledgeRoomTarget(db: Database, id: string, userId: string, organizationId: string): Promise<void> {
  await atomic(db, [
    db.delete(securityRoomCleanup).where(and(eq(securityRoomCleanup.operationId, id), eq(securityRoomCleanup.organizationId, organizationId), sql`exists(select 1 from account_security_operation o where o.id = ${id} and o.user_id = ${userId} and o.committed_at is not null and o.rooms_recorded = 1)`)),
    db.run(sql`update account_security_operation set rooms_pending = 0 where id = ${id} and user_id = ${userId}
      and committed_at is not null and rooms_recorded = 1 and not exists(select 1 from account_security_room_cleanup where operation_id = ${id})`),
  ])
}

/** Trust/challenge records and immutable proof metadata are also committed before KV mirroring. */
export async function insertNativeVerification(scope: AccountAuthScope, row: { id: string; identifier: string; value: string; expiresAt: Date; createdAt: Date; updatedAt: Date }, digest: string, proof: ProofRevision) {
  await atomic(scope.db, [
    scope.db.run(sql`insert into verification (id, identifier, value, expires_at, created_at, updated_at)
      select ${row.id}, ${row.identifier}, ${row.value}, ${row.expiresAt.getTime()}, ${row.createdAt.getTime()}, ${row.updatedAt.getTime()} from account_security a
      where a.user_id = ${scope.userId} and a.revision = ${proof.revision} and a.trust_revision = ${proof.trustRevision}`),
    scope.db.run(sql`insert into verification_authority (identifier, user_id, revision, trust_revision, expires_at)
      select ${digest}, a.user_id, a.revision, a.trust_revision, ${row.expiresAt.getTime()} from account_security a
      where a.user_id = ${scope.userId} and a.revision = ${proof.revision} and a.trust_revision = ${proof.trustRevision}
      and exists(select 1 from verification where id = ${row.id}) on conflict(identifier) do nothing`),
  ])
  const [metadata] = await scope.db.select({ userId: verificationAuthority.userId }).from(verificationAuthority).where(and(eq(verificationAuthority.identifier, digest), eq(verificationAuthority.userId, scope.userId), eq(verificationAuthority.revision, proof.revision), eq(verificationAuthority.trustRevision, proof.trustRevision)))
  if (!metadata) throw new AccountAuthorityError()
  return row
}
