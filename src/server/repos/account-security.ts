/**
 * Closed account-auth repository (ADR 0049), never tenant content. Production callers:
 * auth/account-authority.ts, auth/factor-management.ts and auth/account-security-cleanup.ts.
 * The last caller has only bounded pending-work discovery and account-bound cleanup operations.
 */
import { and, asc, eq, gt, sql } from 'drizzle-orm'
import type { SQLWrapper } from 'drizzle-orm'
import { SQLiteAsyncDialect } from 'drizzle-orm/sqlite-core'
import {
  accountSecurity,
  account,
  twoFactor,
  factorProposal,
  factorBudget,
  factorReplay,
  securityCleanup,
  securityFence,
  securityOperation,
  securityRoomCleanup,
  session,
  sessionAuthority,
  user,
  verificationAuthority,
} from '#/server/db/auth-schema'
import type {
  AccountAuthDatabase as Database,
  AccountAuthScope,
  ProofRevision,
} from '#/server/auth/account-authority-lib/scope'
import type { BatchStatement } from './batch'

export class AccountAuthorityError extends Error {
  constructor() {
    super('Account authority could not be established.')
  }
}

export interface FactorReservation {
  domain: 'active' | 'proposal'
  version: number
  recoveryAt: number
}

export async function factorSnapshot(scope: AccountAuthScope) {
  const [identity] = await scope.db
    .select({ enabled: user.twoFactorEnabled })
    .from(user)
    .where(eq(user.id, scope.userId))
  const credentials = await scope.db
    .select({ id: account.id, password: account.password })
    .from(account)
    .where(
      and(
        eq(account.userId, scope.userId),
        eq(account.providerId, 'credential'),
      ),
    )
    .limit(2)
  const factors = await scope.db
    .select()
    .from(twoFactor)
    .where(eq(twoFactor.userId, scope.userId))
    .limit(2)
  if (!identity || credentials.length > 1 || factors.length > 1)
    throw new AccountAuthorityError()
  return {
    enabled: identity.enabled,
    credential: credentials.at(0) ?? null,
    factor: factors.at(0) ?? null,
  }
}

export type FactorSnapshot = Awaited<ReturnType<typeof factorSnapshot>>

/** Reserve before crypto so concurrent and crashed attempts still spend the account allowance. */
export async function reserveFactorAttempt(
  scope: AccountAuthScope,
  revision: number,
  domain: FactorReservation['domain'],
  now: number,
): Promise<FactorReservation | null> {
  await scope.db
    .run(sql`insert into factor_budget (user_id, domain, version, attempts, recovery_at)
    select ${scope.userId}, ${domain}, 0,
      case when ${domain} = 'active' then coalesce((select case when locked_until > ${now} then 8 when locked_until is not null then 0 else min(failed_verification_count, 8) end from two_factor where user_id = ${scope.userId}), 0) else 0 end,
      case when ${domain} = 'active' then coalesce((select case when locked_until > ${now} then locked_until else ${now} + 900000 end from two_factor where user_id = ${scope.userId}), ${now} + 900000) else ${now} + 900000 end
    where exists(select 1 from account_security where user_id = ${scope.userId} and revision = ${revision} and deletion_id is null)
    on conflict(user_id, domain) do nothing`)
  const [reserved] = await scope.db
    .update(factorBudget)
    .set({
      version: sql`${factorBudget.version} + 1`,
      attempts: sql`case when ${factorBudget.recoveryAt} <= ${now} then 1 else ${factorBudget.attempts} + 1 end`,
      recoveryAt: sql`case when ${factorBudget.recoveryAt} <= ${now} or ${factorBudget.attempts} = 7 then ${now} + 900000 else ${factorBudget.recoveryAt} end`,
    })
    .where(
      and(
        eq(factorBudget.userId, scope.userId),
        eq(factorBudget.domain, domain),
        sql`(${factorBudget.attempts} < 8 or ${factorBudget.recoveryAt} <= ${now}) and ${factorBudget.version} < ${Number.MAX_SAFE_INTEGER - 1}`,
        sql`exists(select 1 from account_security where user_id = ${scope.userId} and revision = ${revision} and deletion_id is null)`,
      ),
    )
    .returning({
      version: factorBudget.version,
      recoveryAt: factorBudget.recoveryAt,
    })
  return reserved ? { domain, ...reserved } : null
}

export async function factorRetryAfter(
  scope: AccountAuthScope,
  domain: FactorReservation['domain'],
  now: number,
): Promise<number> {
  const [budget] = await scope.db
    .select({ recoveryAt: factorBudget.recoveryAt })
    .from(factorBudget)
    .where(
      and(
        eq(factorBudget.userId, scope.userId),
        eq(factorBudget.domain, domain),
      ),
    )
  return Math.max(1, Math.ceil(((budget?.recoveryAt ?? now) - now) / 1000))
}

export async function resetFactorAttempts(
  scope: AccountAuthScope,
  revision: number,
  reservation: FactorReservation,
): Promise<void> {
  await scope.db
    .update(factorBudget)
    .set({
      attempts: 0,
      recoveryAt: 0,
      version: sql`${factorBudget.version} + 1`,
    })
    .where(
      and(
        eq(factorBudget.userId, scope.userId),
        eq(factorBudget.domain, reservation.domain),
        eq(factorBudget.version, reservation.version),
        sql`exists(select 1 from account_security where user_id = ${scope.userId} and revision = ${revision} and deletion_id is null)`,
      ),
    )
}

export async function stageFactorProposal(
  scope: AccountAuthScope,
  input: {
    digest: string
    operationId: string
    payload: string
    expiresAt: number
    now: number
  },
): Promise<void> {
  await scope.db
    .run(sql`insert into factor_proposal (digest, operation_id, user_id, payload, expires_at)
    select ${input.digest}, id, user_id, ${input.payload}, min(expires_at, ${input.expiresAt}) from account_security_operation
    where id = ${input.operationId} and user_id = ${scope.userId} and kind in ('enable', 'replace')
    and committed_at is null and refused_at is null and claim is null and expires_at > ${input.now}
    and not exists(select 1 from factor_proposal where operation_id = ${input.operationId})`)
  if (!(await readFactorProposal(scope, input.operationId, input.digest)))
    throw new AccountAuthorityError()
}

export async function readFactorProposal(
  scope: AccountAuthScope,
  operationId: string,
  digest: string,
) {
  const [proposal] = await scope.db
    .select()
    .from(factorProposal)
    .where(
      and(
        eq(factorProposal.userId, scope.userId),
        eq(factorProposal.operationId, operationId),
        eq(factorProposal.digest, digest),
      ),
    )
  return proposal ?? null
}

export async function refuseFactorOperation(
  scope: AccountAuthScope,
  id: string,
  now: number,
): Promise<void> {
  await atomic(scope.db, [
    scope.db.run(
      sql`update account_security_operation set refused_at = ${now} where id = ${id} and user_id = ${scope.userId} and claim is null and committed_at is null and refused_at is null`,
    ),
    scope.db.run(
      sql`delete from factor_proposal where operation_id = ${id} and user_id = ${scope.userId} and exists(select 1 from account_security_operation where id = ${id} and user_id = ${scope.userId} and refused_at is not null)`,
    ),
  ])
}

/** The native backup verifier shares the same encrypted-set CAS as management. */
export async function consumeNativeBackup(
  scope: AccountAuthScope,
  proof: ProofRevision,
  snapshot: NonNullable<FactorSnapshot['factor']>,
  encryptedCodes: string,
) {
  const [changed] = await scope.db
    .update(twoFactor)
    .set({ backupCodes: encryptedCodes })
    .where(
      and(
        eq(twoFactor.userId, scope.userId),
        eq(twoFactor.id, snapshot.id),
        eq(twoFactor.secret, snapshot.secret),
        eq(twoFactor.backupCodes, snapshot.backupCodes),
        sql`exists(select 1 from account_security where user_id = ${scope.userId} and revision = ${proof.revision} and deletion_id is null)`,
      ),
    )
    .returning()
  return changed ?? null
}

export interface FactorCommit {
  id: string
  intent: string
  kind: 'enable' | 'replace' | 'disable' | 'backup'
  sessionId: string
  token: string
  receiptDigest: string
  claim: string
  now: number
  expected: FactorSnapshot
  proposed: { id: string; secret: string; backupCodes: string } | null
  proposalDigest?: string
  reservations: Array<FactorReservation>
  replay: Array<{ digest: string; step: number }>
  newSession: { id: string; token: string; expiresAt: number }
}

/** Only the winning claim may publish factor authority, proof consumption or a replacement session. */
export async function commitFactor(
  scope: AccountAuthScope,
  input: FactorCommit,
): Promise<boolean> {
  if (
    !input.expected.credential?.password ||
    input.reservations.length < 1 ||
    input.reservations.length > 2 ||
    input.replay.length > 2
  )
    throw new AccountAuthorityError()
  if (
    (input.kind === 'enable' || input.kind === 'replace') &&
    !input.proposalDigest
  )
    throw new AccountAuthorityError()
  if (
    (input.kind === 'disable') !== (input.proposed === null) ||
    (input.kind === 'enable') === input.expected.enabled ||
    (input.kind !== 'enable' && !input.expected.factor?.verified)
  )
    throw new AccountAuthorityError()
  const { id, claim, now, expected, proposed } = input
  const credential = expected.credential
  if (!credential?.password) throw new AccountAuthorityError()
  const clock = sql`max(${now}, cast(unixepoch('subsec') * 1000 as integer))`
  const winning = sql`exists(select 1 from account_security_operation where id = ${id} and user_id = ${scope.userId} and claim = ${claim} and committed_at is null and refused_at is null)`
  const factorMatches = expected.factor
    ? sql`exists(select 1 from two_factor f where f.user_id = ${scope.userId} and f.id = ${expected.factor.id} and f.secret = ${expected.factor.secret} and f.backup_codes = ${expected.factor.backupCodes} and f.verified = ${expected.factor.verified ? 1 : 0})`
    : sql`not exists(select 1 from two_factor where user_id = ${scope.userId})`
  const reservations = input.reservations.map(
    (entry) =>
      sql`exists(select 1 from factor_budget b where b.user_id = ${scope.userId} and b.domain = ${entry.domain} and b.version = ${entry.version} and b.recovery_at = ${entry.recoveryAt} and b.recovery_at > ${clock})`,
  )
  const replay = input.replay.map(
    (entry) =>
      sql`not exists(select 1 from factor_replay r where r.user_id = ${scope.userId} and r.secret_digest = ${entry.digest} and r.step >= ${entry.step})`,
  )
  const proposal = input.proposalDigest
    ? sql`exists(select 1 from factor_proposal p where p.operation_id = ${id} and p.user_id = ${scope.userId} and p.digest = ${input.proposalDigest} and p.expires_at > ${clock})`
    : sql`1 = 1`
  const statements: [BatchStatement, ...Array<BatchStatement>] = [
    scope.db.run(sql`update account_security_operation set claim = ${claim}
      where id = ${id} and user_id = ${scope.userId} and session_id = ${input.sessionId} and intent = ${input.intent} and kind = ${input.kind} and receipt_digest = ${input.receiptDigest}
      and claim is null and committed_at is null and refused_at is null and expires_at > ${clock}
      and exists(select 1 from account_security a join session_authority m on m.user_id = a.user_id and m.revision = a.revision join session s on s.id = m.session_id join user u on u.id = a.user_id
        where a.user_id = ${scope.userId} and a.revision = account_security_operation.revision and a.deletion_id is null and a.revision < ${Number.MAX_SAFE_INTEGER - 1} and a.trust_revision < ${Number.MAX_SAFE_INTEGER - 1}
        and s.id = ${input.sessionId} and s.token = ${input.token} and s.impersonated_by is null and s.created_at > ${clock} - 300000 and s.created_at <= ${clock} and s.expires_at > ${clock}
        and u.two_factor_enabled = ${expected.enabled ? 1 : 0} and (u.banned = 0 or (u.ban_expires is not null and u.ban_expires <= ${clock})))
      and exists(select 1 from account c where c.user_id = ${scope.userId} and c.provider_id = 'credential' and c.id = ${credential.id} and c.password = ${credential.password})
      and exists(select 1 from account_security_fence where id = 1 and cutover = 1 and ready = 1 and anchor_backfill_run_id is not null and value < ${Number.MAX_SAFE_INTEGER - 1})
      and ${factorMatches} and ${proposal} and ${and(...reservations, ...replay)}`),
    scope.db.run(
      sql`delete from two_factor where user_id = ${scope.userId} and ${winning}`,
    ),
  ]
  if (proposed)
    statements.push(
      scope.db
        .run(sql`insert into two_factor (id, user_id, secret, backup_codes, verified, failed_verification_count, locked_until)
    select ${proposed.id}, ${scope.userId}, ${proposed.secret}, ${proposed.backupCodes}, 1, 0, null where ${winning}`),
    )
  statements.push(
    scope.db.run(
      sql`update user set two_factor_enabled = ${proposed ? 1 : 0}, updated_at = ${clock} where id = ${scope.userId} and ${winning}`,
    ),
    scope.db.run(
      sql`update account_security_fence set value = value + 1 where id = 1 and ${winning}`,
    ),
    scope.db.run(
      sql`update account_security set revision = revision + 1, trust_revision = trust_revision + 1, last_fence = (select value from account_security_fence where id = 1) where user_id = ${scope.userId} and ${winning}`,
    ),
    scope.db
      .run(sql`insert into session (id, token, user_id, active_organization_id, ip_address, user_agent, impersonated_by, created_at, updated_at, expires_at)
      select ${input.newSession.id}, ${input.newSession.token}, user_id, active_organization_id, ip_address, user_agent, null, ${clock}, ${clock}, ${input.newSession.expiresAt}
      from session where id = ${input.sessionId} and user_id = ${scope.userId} and ${winning}`),
    scope.db
      .run(sql`insert into session_authority (session_id, user_id, revision, method, proof_at)
      select ${input.newSession.id}, user_id, revision, 'factor-management', ${clock} from account_security where user_id = ${scope.userId} and ${winning}`),
  )
  for (const entry of input.replay)
    statements.push(
      scope.db
        .run(sql`insert into factor_replay (user_id, secret_digest, step) select ${scope.userId}, ${entry.digest}, ${entry.step} where ${winning}
    on conflict(user_id, secret_digest) do update set step = excluded.step`),
    )
  for (const entry of input.reservations)
    statements.push(
      scope.db.run(
        sql`update factor_budget set attempts = 0, recovery_at = 0, version = version + 1 where user_id = ${scope.userId} and domain = ${entry.domain} and version = ${entry.version} and ${winning}`,
      ),
    )
  statements.push(
    scope.db.run(
      sql`delete from factor_proposal where operation_id = ${id} and user_id = ${scope.userId} and ${winning}`,
    ),
    scope.db.run(
      sql`update account_security_operation set committed_at = ${clock}, factor_enabled = ${proposed ? 1 : 0}, cleanup_pending = 1, rooms_pending = 1 where id = ${id} and user_id = ${scope.userId} and claim = ${claim} and committed_at is null and refused_at is null`,
    ),
  )
  await atomic(scope.db, statements)
  const outcome = await operationFor(scope, id)
  return outcome?.claim === claim && outcome.committedAt !== null
}

async function atomic(
  db: Database,
  statements: [BatchStatement, ...Array<BatchStatement>],
): Promise<void> {
  if (!('batch' in db) || typeof db.batch !== 'function')
    throw new AccountAuthorityError()
  try {
    const client: unknown = Reflect.get(db, '$client')
    if (
      typeof client === 'object' &&
      client !== null &&
      'prepare' in client &&
      typeof client.prepare === 'function' &&
      'batch' in client &&
      typeof client.batch === 'function'
    ) {
      // Drizzle D1 batch expects `.stmt`; SQLiteRaw only supplies SQL (unlike sqlite-proxy).
      const native = client as Pick<D1Database, 'prepare' | 'batch'>
      const dialect = new SQLiteAsyncDialect()
      const prepared = statements.map((statement) => {
        if (!('getSQL' in statement) || typeof statement.getSQL !== 'function')
          throw new AccountAuthorityError()
        const query = dialect.sqlToQuery(
          (statement as BatchStatement & SQLWrapper).getSQL(),
        )
        return native.prepare(query.sql).bind(...query.params)
      })
      await native.batch(prepared)
      return
    }
    await db.batch(statements)
  } catch {
    throw new AccountAuthorityError()
  }
}

/** Primary binding only, never a replica/KV handle; a missing active singleton fails closed. */
export async function readEntryFence(
  db: Database,
  expand: boolean,
): Promise<{ fence: number; enforced: boolean }> {
  if (expand)
    await db.run(
      sql`insert into account_security_fence (id, value, ready, cutover) select 1, 0, 0, 0 where not exists(select 1 from account_security) on conflict(id) do nothing`,
    )
  const [row] = await db
    .select({
      value: securityFence.value,
      ready: securityFence.ready,
      cutover: securityFence.cutover,
      anchorBackfillRunId: securityFence.anchorBackfillRunId,
      valid: sql<boolean>`not exists(select 1 from account_security a where a.last_fence > ${securityFence.value})`,
    })
    .from(securityFence)
    .where(eq(securityFence.id, 1))
  if (
    !row ||
    (expand && !row.cutover && row.value !== 0) ||
    (!row.cutover && !expand && (!row.ready || !row.anchorBackfillRunId)) ||
    !Number.isSafeInteger(row.value) ||
    row.value < 0 ||
    row.value >= Number.MAX_SAFE_INTEGER
  )
    throw new AccountAuthorityError()
  if (!row.valid) throw new AccountAuthorityError()
  if (!expand && !row.cutover) {
    const changed = await db
      .update(securityFence)
      .set({ cutover: true })
      .where(
        and(
          eq(securityFence.id, 1),
          eq(securityFence.ready, true),
          sql`${securityFence.anchorBackfillRunId} is not null`,
          sql`not exists(select 1 from user u left join account_security a on a.user_id = u.id where a.user_id is null)`,
          sql`not exists(select 1 from session s join user u on u.id = s.user_id left join session_authority m on m.session_id = s.id where s.expires_at > cast(unixepoch('subsec') * 1000 as integer) and (u.banned = 0 or (u.ban_expires is not null and u.ban_expires <= cast(unixepoch('subsec') * 1000 as integer))) and m.session_id is null)`,
        ),
      )
      .returning({ id: securityFence.id })
    if (changed.length !== 1) throw new AccountAuthorityError()
  }
  return { fence: row.value, enforced: row.cutover || !expand }
}

export async function initializeAccount(
  scope: AccountAuthScope,
): Promise<void> {
  await scope.db
    .insert(accountSecurity)
    .values({
      userId: scope.userId,
      revision: 0,
      trustRevision: 0,
      lastFence: 0,
    })
    .onConflictDoNothing()
}

export async function readAccountProof(
  scope: AccountAuthScope,
  entryFence: number,
  expand: boolean,
): Promise<ProofRevision> {
  if (expand) await initializeAccount(scope)
  const [row] = await scope.db
    .select({
      revision: accountSecurity.revision,
      trustRevision: accountSecurity.trustRevision,
      lastFence: accountSecurity.lastFence,
      deletionId: accountSecurity.deletionId,
    })
    .from(accountSecurity)
    .where(eq(accountSecurity.userId, scope.userId))
  if (
    !row ||
    row.deletionId !== null ||
    ![row.revision, row.trustRevision, row.lastFence].every(
      (value) => Number.isSafeInteger(value) && value >= 0,
    ) ||
    row.lastFence > entryFence
  )
    throw new AccountAuthorityError()
  return {
    revision: row.revision,
    trustRevision: row.trustRevision,
    lastFence: row.lastFence,
  }
}

export async function acceptedSession(
  scope: AccountAuthScope,
  token: string,
  now: number,
): Promise<typeof session.$inferSelect | null> {
  try {
    const [row] = await scope.db
      .select({ session })
      .from(session)
      .innerJoin(
        sessionAuthority,
        and(
          eq(sessionAuthority.sessionId, session.id),
          eq(sessionAuthority.userId, session.userId),
        ),
      )
      .innerJoin(
        accountSecurity,
        and(
          eq(accountSecurity.userId, session.userId),
          eq(accountSecurity.revision, sessionAuthority.revision),
        ),
      )
      .innerJoin(user, eq(user.id, session.userId))
      .where(
        and(
          eq(session.token, token),
          eq(session.userId, scope.userId),
          sql`${accountSecurity.deletionId} is null`,
          sql`typeof(${session.expiresAt}) = 'integer'`,
          gt(session.expiresAt, new Date(now)),
          sql`${session.createdAt} <= ${now}`,
          sql`(${user.banned} = 0 or (${user.banExpires} is not null and ${user.banExpires} <= ${now}))`,
          sql`typeof(${accountSecurity.revision}) = 'integer' and ${accountSecurity.revision} >= 0 and ${accountSecurity.revision} < ${Number.MAX_SAFE_INTEGER} and typeof(${sessionAuthority.proofAt}) = 'integer' and ${sessionAuthority.proofAt} >= 0 and ${sessionAuthority.proofAt} <= ${now} and ${sessionAuthority.method} in ('native', 'legacy', 'factor-management')`,
        ),
      )
    return row?.session ?? null
  } catch {
    throw new AccountAuthorityError()
  }
}

export async function verificationProof(
  db: Database,
  identifier: string,
  digest: string,
  trust: boolean,
  now: number,
): Promise<{ userId: string; proof: ProofRevision } | null> {
  const [row] = await db
    .select({
      userId: verificationAuthority.userId,
      revision: verificationAuthority.revision,
      trustRevision: verificationAuthority.trustRevision,
      lastFence: accountSecurity.lastFence,
    })
    .from(verificationAuthority)
    .innerJoin(
      accountSecurity,
      eq(accountSecurity.userId, verificationAuthority.userId),
    )
    .where(
      and(
        eq(verificationAuthority.identifier, digest),
        gt(verificationAuthority.expiresAt, now),
        sql`${accountSecurity.deletionId} is null`,
        sql`typeof(${verificationAuthority.revision}) = 'integer' and ${verificationAuthority.revision} >= 0 and ${verificationAuthority.revision} < ${Number.MAX_SAFE_INTEGER} and typeof(${verificationAuthority.trustRevision}) = 'integer' and ${verificationAuthority.trustRevision} >= 0 and ${verificationAuthority.trustRevision} < ${Number.MAX_SAFE_INTEGER} and typeof(${verificationAuthority.expiresAt}) = 'integer'`,
        sql`exists(select 1 from verification v where v.identifier = ${identifier} and v.value = ${verificationAuthority.userId} and v.expires_at > ${now})`,
        trust
          ? and(
              eq(
                verificationAuthority.trustRevision,
                accountSecurity.trustRevision,
              ),
              eq(verificationAuthority.factorVerified, true),
            )
          : eq(verificationAuthority.revision, accountSecurity.revision),
      ),
    )
  return row
    ? {
        userId: row.userId,
        proof: {
          revision: row.revision,
          trustRevision: row.trustRevision,
          lastFence: row.lastFence,
        },
      }
    : null
}

export async function registerRevocation(
  scope: AccountAuthScope,
  input: {
    id: string
    sessionId: string
    intent: string
    receiptDigest: string
    revision: number
    expiresAt: number
    kind?: FactorCommit['kind'] | 'revoke-others'
  },
): Promise<void> {
  const now = sql`max(${Date.now()}, cast(unixepoch('subsec') * 1000 as integer))`
  await scope.db
    .run(sql`insert into account_security_operation (id, user_id, session_id, intent, receipt_digest, revision, expires_at, committed_at, claim, attempted_at, cleanup_pending, rooms_pending, rooms_recorded, kind)
    select ${input.id}, s.user_id, s.id, ${input.intent}, ${input.receiptDigest}, a.revision, min(${input.expiresAt}, s.created_at + 300000), null, null, 0, 0, 0, 0, ${input.kind ?? 'revoke-others'}
    from session s join account_security a on a.user_id = s.user_id join session_authority m on m.session_id = s.id and m.revision = a.revision
    where s.id = ${input.sessionId} and s.user_id = ${scope.userId} and a.revision = ${input.revision}
    and s.impersonated_by is null and s.created_at > ${now} - 300000 and s.created_at <= ${now} and s.expires_at > ${now}
    and not exists(select 1 from account_security_operation duplicate where duplicate.user_id = s.user_id and duplicate.intent = ${input.intent})
    and not exists(select 1 from account_security_operation o where o.user_id = s.user_id and o.session_id = s.id and o.committed_at is null and o.refused_at is null and o.expires_at > ${now})`)
  const operation = await operationFor(scope, input.id)
  if (
    !operation ||
    operation.receiptDigest !== input.receiptDigest ||
    operation.intent !== input.intent ||
    operation.kind !== (input.kind ?? 'revoke-others') ||
    operation.sessionId !== input.sessionId ||
    operation.revision !== input.revision ||
    operation.claim !== null ||
    operation.committedAt !== null ||
    operation.refusedAt !== null ||
    operation.expiresAt <= Date.now()
  )
    throw new AccountAuthorityError()
}

export async function operationFor(scope: AccountAuthScope, id: string) {
  const [row] = await scope.db
    .select()
    .from(securityOperation)
    .where(
      and(
        eq(securityOperation.id, id),
        eq(securityOperation.userId, scope.userId),
      ),
    )
  return row ?? null
}

export async function commitRevocation(
  scope: AccountAuthScope,
  input: {
    id: string
    sessionId: string
    token: string
    intent: string
    claim: string
    now: number
  },
): Promise<boolean> {
  const { id, sessionId, token, intent, claim, now } = input
  const effectiveNow = sql`max(${now}, cast(unixepoch('subsec') * 1000 as integer))`
  const winning = sql`exists(select 1 from account_security_operation o where o.id = ${id} and o.user_id = ${scope.userId} and o.claim = ${claim} and o.committed_at is null)`
  await atomic(scope.db, [
    scope.db.run(sql`update account_security_operation set claim = ${claim}
      where id = ${id} and user_id = ${scope.userId} and session_id = ${sessionId} and intent = ${intent}
      and kind = 'revoke-others' and refused_at is null and claim is null and committed_at is null and expires_at > ${effectiveNow}
      and exists(select 1 from account_security a join session_authority m on m.user_id = a.user_id and m.revision = a.revision
        join session s on s.id = m.session_id where a.user_id = ${scope.userId} and a.revision = account_security_operation.revision and a.deletion_id is null and a.revision < ${Number.MAX_SAFE_INTEGER - 1}
        and s.id = ${sessionId} and s.token = ${token} and s.impersonated_by is null
        and exists(select 1 from user u where u.id = s.user_id and (u.banned = 0 or (u.ban_expires is not null and u.ban_expires <= ${effectiveNow})))
        and s.created_at > ${effectiveNow} - 300000 and s.created_at <= ${effectiveNow} and s.expires_at > ${effectiveNow})
      and exists(select 1 from account_security_fence where id = 1 and cutover = 1 and ready = 1 and anchor_backfill_run_id is not null and value < ${Number.MAX_SAFE_INTEGER - 1})`),
    scope.db.run(
      sql`update account_security_fence set value = value + 1 where id = 1 and ${winning}`,
    ),
    scope.db
      .run(sql`update account_security set revision = revision + 1, last_fence = (select value from account_security_fence where id = 1)
      where user_id = ${scope.userId} and ${winning}`),
    scope.db
      .run(sql`update session_authority set revision = (select revision from account_security where user_id = ${scope.userId})
      where session_id = ${sessionId} and user_id = ${scope.userId} and ${winning}`),
    scope.db
      .run(sql`update account_security_operation set committed_at = ${effectiveNow}, cleanup_pending = 1, rooms_pending = 1
      where id = ${id} and user_id = ${scope.userId} and claim = ${claim} and committed_at is null`),
  ])
  const outcome = await operationFor(scope, id)
  return outcome !== null && outcome.committedAt !== null
}

/** Preserves original session rows while any durable cleanup intent still needs them. */
export async function cleanupPage(
  scope: AccountAuthScope,
  revision: number,
  after: string,
  limit: number,
) {
  if (limit < 1 || limit > 200) throw new AccountAuthorityError()
  return scope.db
    .select({ id: session.id, token: session.token })
    .from(session)
    .leftJoin(sessionAuthority, eq(sessionAuthority.sessionId, session.id))
    .where(
      and(
        eq(session.userId, scope.userId),
        gt(session.id, after),
        sql`(${sessionAuthority.revision} is null or ${sessionAuthority.revision} < ${revision})`,
      ),
    )
    .orderBy(asc(session.id))
    .limit(limit)
}

export async function recordCleanupReference(
  scope: AccountAuthScope,
  operationId: string,
  sessionId: string,
  encryptedToken: string,
): Promise<void> {
  await atomic(scope.db, [
    scope.db
      .run(sql`insert into account_security_cleanup (id, operation_id, encrypted_token)
      select s.id, o.id, ${encryptedToken} from session s join account_security_operation o on o.user_id = s.user_id
      left join session_authority m on m.session_id = s.id
      where s.id = ${sessionId} and s.user_id = ${scope.userId} and o.id = ${operationId} and o.committed_at is not null
      and (m.revision is null or m.revision <= o.revision) on conflict(id) do nothing`),
    scope.db
      .delete(session)
      .where(
        and(
          eq(session.id, sessionId),
          eq(session.userId, scope.userId),
          sql`exists(select 1 from account_security_cleanup c join account_security_operation o on o.id = c.operation_id where c.id = ${sessionId} and o.user_id = ${scope.userId})`,
        ),
      ),
  ])
}

export async function pendingCleanupReferences(
  scope: AccountAuthScope,
  operationId: string,
) {
  return scope.db
    .select({
      id: securityCleanup.id,
      encryptedToken: securityCleanup.encryptedToken,
    })
    .from(securityCleanup)
    .innerJoin(
      securityOperation,
      and(
        eq(securityOperation.id, securityCleanup.operationId),
        eq(securityOperation.userId, scope.userId),
      ),
    )
    .where(eq(securityCleanup.operationId, operationId))
    .orderBy(asc(securityCleanup.attemptedAt), asc(securityCleanup.id))
    .limit(200)
}

export async function noteCleanupReferenceAttempt(
  scope: AccountAuthScope,
  operationId: string,
  id: string,
  now: number,
): Promise<void> {
  await scope.db
    .update(securityCleanup)
    .set({ attemptedAt: now })
    .where(
      and(
        eq(securityCleanup.id, id),
        eq(securityCleanup.operationId, operationId),
        sql`exists(select 1 from account_security_operation where id = ${operationId} and user_id = ${scope.userId})`,
      ),
    )
}

export async function finishCleanupReference(
  scope: AccountAuthScope,
  operationId: string,
  id: string,
): Promise<void> {
  await scope.db
    .delete(securityCleanup)
    .where(
      and(
        eq(securityCleanup.id, id),
        eq(securityCleanup.operationId, operationId),
        sql`exists(select 1 from account_security_operation where id = ${operationId} and user_id = ${scope.userId})`,
      ),
    )
}

export async function setCleanupState(
  scope: AccountAuthScope,
  id: string,
  state: { cleanupPending: boolean },
): Promise<void> {
  await scope.db
    .update(securityOperation)
    .set(state)
    .where(
      and(
        eq(securityOperation.id, id),
        eq(securityOperation.userId, scope.userId),
      ),
    )
}

/** System discovery projects only account/operation ids, bounded to one page per scheduled run. */
export async function pendingOperations(db: Database) {
  return db
    .select({
      id: securityOperation.id,
      userId: securityOperation.userId,
      revision: securityOperation.revision,
      roomsPending: securityOperation.roomsPending,
      roomsRecorded: securityOperation.roomsRecorded,
    })
    .from(securityOperation)
    .where(
      and(
        eq(securityOperation.cleanupPending, true),
        sql`${securityOperation.committedAt} is not null`,
      ),
    )
    .orderBy(asc(securityOperation.attemptedAt), asc(securityOperation.id))
    .limit(1)
}

export async function receiptStatus(
  db: Database,
  id: string,
  digest: string,
  now: number,
) {
  const [row] = await db
    .select({
      committedAt: securityOperation.committedAt,
      refusedAt: securityOperation.refusedAt,
      kind: securityOperation.kind,
      factorEnabled: securityOperation.factorEnabled,
      cleanupPending: securityOperation.cleanupPending,
      expiresAt: securityOperation.expiresAt,
    })
    .from(securityOperation)
    .where(
      and(
        eq(securityOperation.id, id),
        eq(securityOperation.receiptDigest, digest),
        sql`((${securityOperation.committedAt} is null and ${securityOperation.expiresAt} + 900000 > ${now}) or (${securityOperation.committedAt} is not null and ${securityOperation.committedAt} + 900000 > ${now}))`,
      ),
    )
  return row ?? null
}

export async function pendingRegistration(
  scope: AccountAuthScope,
  sessionId: string,
  now: number,
) {
  const [row] = await scope.db
    .select({
      id: securityOperation.id,
      intent: securityOperation.intent,
      kind: securityOperation.kind,
      revision: securityOperation.revision,
    })
    .from(securityOperation)
    .where(
      and(
        eq(securityOperation.userId, scope.userId),
        eq(securityOperation.sessionId, sessionId),
        gt(securityOperation.expiresAt, now),
        sql`${securityOperation.committedAt} is null and ${securityOperation.refusedAt} is null`,
      ),
    )
    .limit(1)
  return row ?? null
}

/** Native adapter deletion only; a pending operation keeps its durable source in the same statement. */
export async function deleteNativeSessionRows(
  db: Database,
  where: ReadonlyArray<{
    field: string
    operator?: string
    value: unknown
    connector?: string
  }>,
): Promise<number> {
  const columns = {
    id: session.id,
    token: session.token,
    userId: session.userId,
  }
  const terms = where.map((term) => {
    if (
      !(term.field in columns) ||
      (term.connector && term.connector !== 'AND')
    )
      throw new AccountAuthorityError()
    const column = columns[term.field as keyof typeof columns]
    if (!term.operator || term.operator === 'eq') {
      if (typeof term.value !== 'string') throw new AccountAuthorityError()
      return eq(column, term.value)
    }
    if (
      term.operator !== 'in' ||
      !Array.isArray(term.value) ||
      term.value.length > 90 ||
      !term.value.every((value): value is string => typeof value === 'string')
    )
      throw new AccountAuthorityError()
    if (term.value.length === 0) return sql`0`
    return sql`${column} in (${sql.join(
      term.value.map((value) => sql`${value}`),
      sql`, `,
    )})`
  })
  if (terms.length === 0) throw new AccountAuthorityError()
  const matching = db
    .select({ id: session.id })
    .from(session)
    .where(and(...terms))
  await atomic(db, [
    db
      .delete(sessionAuthority)
      .where(sql`${sessionAuthority.sessionId} in (${matching})`),
    db
      .delete(session)
      .where(
        and(
          ...terms,
          sql`not exists(select 1 from account_security_operation o where o.user_id = ${session.userId} and o.cleanup_pending = 1)`,
        ),
      ),
  ])
  return 0
}

export async function noteCleanupAttempt(
  scope: AccountAuthScope,
  id: string,
  now: number,
): Promise<void> {
  await scope.db
    .update(securityOperation)
    .set({ attemptedAt: now })
    .where(
      and(
        eq(securityOperation.id, id),
        eq(securityOperation.userId, scope.userId),
      ),
    )
}

/** Expand-only bounded backfill; legacy sessions can never be relabelled after a revocation. */
export async function backfillLegacyAuthority(
  db: Database,
  now: number,
): Promise<void> {
  if ((await readEntryFence(db, true)).enforced) return
  const accounts = await db
    .select({ userId: user.id })
    .from(user)
    .leftJoin(accountSecurity, eq(accountSecurity.userId, user.id))
    .where(sql`${accountSecurity.userId} is null`)
    .orderBy(asc(user.id))
    .limit(200)
  for (const account of accounts)
    await db
      .insert(accountSecurity)
      .values({
        userId: account.userId,
        revision: 0,
        trustRevision: 0,
        lastFence: 0,
      })
      .onConflictDoNothing()
  const rows = await db
    .select({
      id: session.id,
      userId: session.userId,
      createdAt: session.createdAt,
    })
    .from(session)
    .leftJoin(sessionAuthority, eq(sessionAuthority.sessionId, session.id))
    .innerJoin(user, eq(user.id, session.userId))
    .where(
      and(
        sql`${sessionAuthority.sessionId} is null`,
        gt(session.expiresAt, new Date(now)),
        sql`(${user.banned} = 0 or (${user.banExpires} is not null and ${user.banExpires} <= ${now}))`,
      ),
    )
    .orderBy(asc(session.id))
    .limit(200)
  for (const row of rows) {
    await db
      .insert(accountSecurity)
      .values({
        userId: row.userId,
        revision: 0,
        trustRevision: 0,
        lastFence: 0,
      })
      .onConflictDoNothing()
    await db.run(sql`insert into session_authority (session_id, user_id, revision, method, proof_at)
      select s.id, s.user_id, 0, 'legacy', s.created_at from session s join account_security a on a.user_id = s.user_id
      where s.id = ${row.id} and a.revision = 0 and a.last_fence = 0 on conflict(session_id) do nothing`)
  }
  await db.run(sql`update account_security_fence set ready = 1 where id = 1 and cutover = 0 and value = 0
    and not exists(select 1 from user u left join account_security a on a.user_id = u.id where a.user_id is null)
    and not exists(select 1 from session s join user u on u.id = s.user_id left join session_authority m on m.session_id = s.id
      where s.expires_at > ${now} and (u.banned = 0 or (u.ban_expires is not null and u.ban_expires <= ${now})) and m.session_id is null)`)
}

/** Native session insertion and its proof are one conditional D1 batch, before any KV/cookie write. */
export async function insertNativeSession(
  scope: AccountAuthScope,
  row: typeof session.$inferSelect,
  proof: ProofRevision,
  method: string,
  now: number,
) {
  await atomic(scope.db, [
    scope.db
      .run(sql`insert into session (id, token, user_id, active_organization_id, ip_address, user_agent, impersonated_by, expires_at, created_at, updated_at)
      select ${row.id}, ${row.token}, a.user_id, ${row.activeOrganizationId}, ${row.ipAddress}, ${row.userAgent}, ${row.impersonatedBy}, ${row.expiresAt.getTime()}, ${row.createdAt.getTime()}, ${row.updatedAt.getTime()}
      from account_security a where a.user_id = ${scope.userId} and a.revision = ${proof.revision} and a.deletion_id is null`),
    scope.db
      .run(sql`insert into session_authority (session_id, user_id, revision, method, proof_at)
      select s.id, s.user_id, a.revision, ${method}, ${now} from session s join account_security a on a.user_id = s.user_id
      where s.id = ${row.id} and s.user_id = ${scope.userId} and a.revision = ${proof.revision} and a.deletion_id is null`),
  ])
  const [created] = await scope.db
    .select()
    .from(session)
    .where(and(eq(session.id, row.id), eq(session.userId, scope.userId)))
  if (!created) throw new AccountAuthorityError()
  return created
}

export async function promotePasswordSession(
  scope: AccountAuthScope,
  sessionId: string,
  proof: ProofRevision,
): Promise<void> {
  await scope.db
    .update(sessionAuthority)
    .set({ method: 'native' })
    .where(
      and(
        eq(sessionAuthority.sessionId, sessionId),
        eq(sessionAuthority.userId, scope.userId),
        eq(sessionAuthority.revision, proof.revision),
        eq(sessionAuthority.method, 'password-pending'),
        sql`exists(select 1 from account_security a where a.user_id = ${scope.userId} and a.revision = ${proof.revision} and a.deletion_id is null)`,
      ),
    )
}

export async function recordRoomTargets(
  scope: AccountAuthScope,
  id: string,
  organizationIds: ReadonlyArray<string>,
): Promise<void> {
  const encoded = JSON.stringify(organizationIds)
  if (new TextEncoder().encode(encoded).length > 1000000)
    throw new AccountAuthorityError()
  await atomic(scope.db, [
    scope.db
      .run(sql`insert into account_security_room_cleanup (operation_id, organization_id)
      select o.id, j.value from account_security_operation o cross join json_each(${encoded}) j
      where o.id = ${id} and o.user_id = ${scope.userId} and o.committed_at is not null and o.rooms_recorded = 0 on conflict do nothing`),
    scope.db.run(sql`update account_security_operation set rooms_recorded = 1,
      rooms_pending = exists(select 1 from account_security_room_cleanup c where c.operation_id = ${id})
      where id = ${id} and user_id = ${scope.userId} and committed_at is not null and rooms_recorded = 0`),
  ])
}

export async function pendingRoomTargets(
  scope: AccountAuthScope,
  id: string,
): Promise<Array<string>> {
  const rows = await scope.db
    .select({ organizationId: securityRoomCleanup.organizationId })
    .from(securityRoomCleanup)
    .innerJoin(
      securityOperation,
      and(
        eq(securityOperation.id, securityRoomCleanup.operationId),
        eq(securityOperation.userId, scope.userId),
      ),
    )
    .where(eq(securityRoomCleanup.operationId, id))
    .orderBy(
      asc(securityRoomCleanup.attemptedAt),
      asc(securityRoomCleanup.organizationId),
    )
    .limit(200)
  return rows.map((row) => row.organizationId)
}

export async function acknowledgeRoomTarget(
  db: Database,
  id: string,
  userId: string,
  organizationId: string,
): Promise<void> {
  await atomic(db, [
    db
      .delete(securityRoomCleanup)
      .where(
        and(
          eq(securityRoomCleanup.operationId, id),
          eq(securityRoomCleanup.organizationId, organizationId),
          sql`exists(select 1 from account_security_operation o where o.id = ${id} and o.user_id = ${userId} and o.committed_at is not null and o.rooms_recorded = 1)`,
        ),
      ),
    db.run(sql`update account_security_operation set rooms_pending = 0 where id = ${id} and user_id = ${userId}
      and committed_at is not null and rooms_recorded = 1 and not exists(select 1 from account_security_room_cleanup where operation_id = ${id})`),
  ])
}

/** Trust/challenge records and immutable proof metadata are also committed before KV mirroring. */
export async function insertNativeVerification(
  scope: AccountAuthScope,
  row: {
    id: string
    identifier: string
    value: string
    expiresAt: Date
    createdAt: Date
    updatedAt: Date
  },
  digest: string,
  proof: ProofRevision,
  factorVerified: boolean,
) {
  if (
    row.value !== scope.userId ||
    !/^(trust-device-[A-Za-z0-9_-]{32}|2fa-[A-Za-z0-9_-]{20})$/.test(
      row.identifier,
    )
  )
    throw new AccountAuthorityError()
  await atomic(scope.db, [
    scope.db
      .run(sql`insert into verification (id, identifier, value, expires_at, created_at, updated_at)
      select ${row.id}, ${row.identifier}, ${row.value}, ${row.expiresAt.getTime()}, ${row.createdAt.getTime()}, ${row.updatedAt.getTime()} from account_security a
      where a.user_id = ${scope.userId} and a.revision = ${proof.revision} and a.trust_revision = ${proof.trustRevision} and a.deletion_id is null`),
    scope.db
      .run(sql`insert into verification_authority (identifier, user_id, revision, trust_revision, expires_at, factor_verified)
      select ${digest}, a.user_id, a.revision, a.trust_revision, ${row.expiresAt.getTime()}, ${factorVerified ? 1 : 0} from account_security a
      where a.user_id = ${scope.userId} and a.revision = ${proof.revision} and a.trust_revision = ${proof.trustRevision}
      and exists(select 1 from verification where id = ${row.id}) on conflict(identifier) do nothing`),
  ])
  const [metadata] = await scope.db
    .select({ userId: verificationAuthority.userId })
    .from(verificationAuthority)
    .where(
      and(
        eq(verificationAuthority.identifier, digest),
        eq(verificationAuthority.userId, scope.userId),
        eq(verificationAuthority.revision, proof.revision),
        eq(verificationAuthority.trustRevision, proof.trustRevision),
      ),
    )
  if (!metadata) throw new AccountAuthorityError()
  return row
}

export async function recordAnchorBackfillCompletion(
  db: Database,
  marker: { runId: string; completedAt: string },
  now: number,
): Promise<void> {
  const completedAt = Date.parse(marker.completedAt)
  if (
    !marker.runId ||
    marker.runId.length > 64 ||
    !Number.isFinite(completedAt) ||
    completedAt > now
  )
    throw new AccountAuthorityError()
  await db
    .update(securityFence)
    .set({ anchorBackfillRunId: marker.runId, anchorBackfillAt: completedAt })
    .where(and(eq(securityFence.id, 1), eq(securityFence.cutover, false)))
}

export async function noteRoomPublicationAttempt(
  scope: AccountAuthScope,
  id: string,
  organizations: ReadonlyArray<string>,
  now: number,
): Promise<void> {
  if (organizations.length > 200) throw new AccountAuthorityError()
  await scope.db
    .update(securityRoomCleanup)
    .set({ attemptedAt: now })
    .where(
      and(
        eq(securityRoomCleanup.operationId, id),
        sql`${securityRoomCleanup.organizationId} in (select value from json_each(${JSON.stringify(organizations)}))`,
        sql`exists(select 1 from account_security_operation o where o.id = ${id} and o.user_id = ${scope.userId})`,
      ),
    )
}

/** Called only after native deletion authorization, before its first destructive adapter call. */
export async function reserveNativeAccountDeletion(
  scope: AccountAuthScope,
  id: string,
  now: number,
): Promise<string> {
  await scope.db
    .run(sql`insert into account_security (user_id, revision, trust_revision, last_fence)
    select id, 0, 0, 0 from user where id = ${scope.userId} on conflict(user_id) do nothing`)
  const [existing] = await scope.db
    .select({
      id: accountSecurity.deletionId,
      startedAt: accountSecurity.deletionStartedAt,
    })
    .from(accountSecurity)
    .where(eq(accountSecurity.userId, scope.userId))
  if (existing?.id) {
    if (existing.startedAt === null || existing.startedAt > now - 60000)
      throw new AccountAuthorityError()
    return existing.id
  }
  const changed = await scope.db
    .update(accountSecurity)
    .set({ deletionId: id, deletionStartedAt: now })
    .where(
      and(
        eq(accountSecurity.userId, scope.userId),
        sql`${accountSecurity.deletionId} is null`,
        sql`not exists(select 1 from account_security_operation o where o.user_id = ${scope.userId} and o.cleanup_pending = 1)`,
      ),
    )
    .returning({ id: accountSecurity.deletionId })
  if (changed.length !== 1) throw new AccountAuthorityError()
  return id
}

/** Restart recovery resumes authorized teardown; it never clears a possibly partial reservation. */
export async function reservedAccountDeletions(
  db: Database,
  now: number,
): Promise<Array<string>> {
  const rows = await db
    .select({ userId: accountSecurity.userId })
    .from(accountSecurity)
    .where(
      and(
        sql`${accountSecurity.deletionId} is not null`,
        sql`${accountSecurity.deletionStartedAt} <= ${now - 60000}`,
      ),
    )
    .orderBy(asc(accountSecurity.deletionStartedAt))
    .limit(1)
  return rows.map((row) => row.userId)
}

/** Expiry removes only metadata and completed retry-free receipts, never durable pending work. */
export async function pruneAccountSecurityMetadata(
  db: Database,
  now: number,
): Promise<void> {
  await atomic(db, [
    db.run(
      sql`delete from factor_replay where rowid in (select rowid from factor_replay where step < ${Math.floor(now / 30000) - 1} limit 200)`,
    ),
    db.run(
      sql`delete from factor_proposal where digest in (select digest from factor_proposal where expires_at <= ${now} order by expires_at limit 200)`,
    ),
    db.run(
      sql`delete from verification_authority where identifier in (select identifier from verification_authority where expires_at <= ${now} order by expires_at, identifier limit 200)`,
    ),
    db.run(
      sql`delete from account_security_operation where id in (select id from account_security_operation where cleanup_pending = 0 and expires_at + 900000 <= ${now} and (committed_at is null or committed_at + 900000 <= ${now}) order by expires_at, id limit 200)`,
    ),
  ])
}

export async function factorStepUsed(
  scope: AccountAuthScope,
  digest: string,
  step: number,
): Promise<boolean> {
  const [row] = await scope.db
    .select({ step: factorReplay.step })
    .from(factorReplay)
    .where(
      and(
        eq(factorReplay.userId, scope.userId),
        eq(factorReplay.secretDigest, digest),
      ),
    )
    .limit(1)
  return row !== undefined && row.step >= step
}
