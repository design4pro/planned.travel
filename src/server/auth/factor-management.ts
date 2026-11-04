import {
  APIError,
  createAuthEndpoint,
  sessionMiddleware,
} from 'better-auth/api'
import { z } from 'zod'
import { setSessionCookie } from 'better-auth/cookies'
import {
  constantTimeEqual,
  generateRandomString,
  symmetricDecrypt,
  symmetricEncrypt,
} from 'better-auth/crypto'
import {
  changeInput,
  commitInput,
  factorIntent,
  operationKind,
  prepareInput,
  proposalPayload,
} from './factor-management-lib/contracts'
import {
  matchCurrentStep,
  newBackupCodes,
  setupUri,
} from './factor-management-lib/proof'
import type {
  FactorCommit,
  FactorReservation,
  FactorSnapshot,
} from '#/server/repos/account-security'
import { hashSecret } from '#/server/security/secret'
import {
  commitRevocation,
  commitFactor,
  factorSnapshot,
  factorStepUsed,
  reserveFactorAttempt,
  factorRetryAfter,
  stageFactorProposal,
  readFactorProposal,
  refuseFactorOperation,
  acceptedSession,
  operationFor,
  pendingRegistration,
  receiptStatus,
  registerRevocation,
} from '#/server/repos/account-security'
import type { BetterAuthPlugin } from 'better-auth'
import type { AccountAuthDatabase as Database } from '#/server/auth/account-authority-lib/scope'
import type { createAccountAuthority } from './account-authority'
import type { AccountAuthScope } from './account-authority-lib/scope'

type EndpointContext = Parameters<typeof setSessionCookie>[0]

const intent = z.string().uuid()
const operationInput = z
  .object({ id: z.string().uuid(), intent, confirm: z.literal(true) })
  .strict()
const receiptPattern = /^([0-9a-f-]{36})\.([0-9a-f-]{36})$/

function refused(): never {
  throw APIError.from('FORBIDDEN', {
    code: 'ACCOUNT_SECURITY_REFUSED',
    message: 'settings.security.other.refused',
  })
}

function outcomeOf(
  operation: NonNullable<Awaited<ReturnType<typeof receiptStatus>>>,
  now: number,
) {
  let status: 'unknown' | 'refused' | 'committed' = 'committed'
  if (operation.committedAt === null)
    status =
      operation.refusedAt !== null || operation.expiresAt <= now
        ? 'refused'
        : 'unknown'
  return {
    status,
    cleanupPending: operation.cleanupPending,
    ...(operation.kind !== 'revoke-others'
      ? { operation: operation.kind, enabled: operation.factorEnabled }
      : {}),
  }
}

export function accountSessionManagement(
  db: Database,
  authority: ReturnType<typeof createAccountAuthority>,
  enabled: () => boolean,
  cleanup: () => Promise<void>,
): BetterAuthPlugin {
  function factorError(
    code: string,
    status:
      | 'FORBIDDEN'
      | 'BAD_REQUEST'
      | 'CONFLICT'
      | 'TOO_MANY_REQUESTS'
      | 'SERVICE_UNAVAILABLE' = 'FORBIDDEN',
  ): never {
    throw APIError.from(status, {
      code,
      message: 'settings.security.other.refused',
    })
  }

  async function decryptMaterial(
    ctx: EndpointContext,
    data: string,
  ): Promise<string> {
    try {
      return await symmetricDecrypt({ key: ctx.context.secretConfig, data })
    } catch {
      factorError('FACTOR_UNAVAILABLE', 'SERVICE_UNAVAILABLE')
    }
  }
  async function readMaterial<T>(
    ctx: EndpointContext,
    data: string,
    schema: z.ZodType<T>,
  ): Promise<T> {
    try {
      return schema.parse(JSON.parse(await decryptMaterial(ctx, data)))
    } catch {
      factorError('FACTOR_UNAVAILABLE', 'SERVICE_UNAVAILABLE')
    }
  }

  async function registeredFactor(
    ctx: EndpointContext,
    body: z.infer<typeof factorIntent>,
  ) {
    ctx.setHeader('cache-control', 'no-store')
    if (
      !enabled() ||
      ctx.headers?.get('origin') !== new URL(ctx.context.baseURL).origin
    )
      refused()
    const current = ctx.context.session
    const now = Date.now()
    if (
      !current ||
      current.session.impersonatedBy ||
      !(await authority.checkSession(current))
    )
      refused()
    if (
      current.session.createdAt.getTime() <= now - 300000 ||
      current.session.createdAt.getTime() > now
    )
      factorError('FACTOR_FRESH_SESSION_REQUIRED')
    const { scope, proof } = await authority.bind(current.user.id)
    const cookie = ctx.context.createAuthCookie('account_security_receipt', {
      path: '/api/auth/account-security',
    })
    const receipt = await ctx.getSignedCookie(cookie.name, ctx.context.secret)
    if (!receipt || receiptPattern.exec(receipt)?.[1] !== body.id) refused()
    const operation = await operationFor(scope, body.id)
    if (
      !operation ||
      operation.sessionId !== current.session.id ||
      operation.intent !== body.intent ||
      operation.kind !== body.operation ||
      operation.receiptDigest !== (await hashSecret(receipt))
    )
      refused()
    if (operation.committedAt !== null)
      return { scope, proof, current, operation }
    if (operation.refusedAt !== null || operation.expiresAt <= now)
      factorError('FACTOR_SETUP_EXPIRED')
    if (operation.revision !== proof.revision)
      factorError('FACTOR_STATE_CHANGED', 'CONFLICT')
    return { scope, proof, current, operation }
  }

  async function checkPassword(
    ctx: EndpointContext,
    snapshot: FactorSnapshot,
    password: string,
  ) {
    if (
      !snapshot.credential?.password ||
      !(await ctx.context.password.verify({
        hash: snapshot.credential.password,
        password,
      }))
    )
      factorError('INVALID_PASSWORD', 'BAD_REQUEST')
  }

  async function reserve(
    scope: AccountAuthScope,
    revision: number,
    domain: FactorReservation['domain'],
  ) {
    const reservation = await reserveFactorAttempt(
      scope,
      revision,
      domain,
      Date.now(),
    )
    if (!reservation) {
      throw new APIError(
        'TOO_MANY_REQUESTS',
        {
          code: 'ACCOUNT_TEMPORARILY_LOCKED',
          message: 'settings.security.other.refused',
        },
        {
          'retry-after': String(
            await factorRetryAfter(scope, domain, Date.now()),
          ),
        },
      )
    }
    return reservation
  }

  async function currentProof(
    ctx: EndpointContext,
    scope: AccountAuthScope,
    revision: number,
    snapshot: FactorSnapshot,
    proof: z.infer<typeof changeInput>['proof'],
  ) {
    if (!snapshot.enabled || !snapshot.factor?.verified)
      factorError('FACTOR_STATE_CHANGED', 'CONFLICT')
    const reservation = await reserve(scope, revision, 'active')
    if (proof.kind === 'backup') {
      const codes = await readMaterial(
        ctx,
        snapshot.factor.backupCodes,
        z.array(z.string()).max(10),
      )
      if (!codes.some((code) => constantTimeEqual(code, proof.code)))
        factorError('INVALID_BACKUP_CODE', 'BAD_REQUEST')
      return { reservations: [reservation], replay: [] }
    }
    const secret = await decryptMaterial(ctx, snapshot.factor.secret)
    const step = await matchCurrentStep(secret, proof.code)
    if (step === null) factorError('INVALID_CODE', 'BAD_REQUEST')
    const digest = await hashSecret(secret)
    if (await factorStepUsed(scope, digest, step))
      factorError('FACTOR_PROOF_USED', 'BAD_REQUEST')
    return { reservations: [reservation], replay: [{ digest, step }] }
  }

  async function finishFactor(
    ctx: EndpointContext,
    request: Awaited<ReturnType<typeof registeredFactor>>,
    input: Pick<
      FactorCommit,
      'expected' | 'proposed' | 'reservations' | 'replay' | 'proposalDigest'
    >,
    codes?: Array<string>,
  ) {
    const { scope, current, operation } = request
    if (operation.committedAt !== null) return outcomeOf(operation, Date.now())
    const kind = operationKind.parse(operation.kind)
    if (kind === 'revoke-others') refused()
    const next = {
      id: crypto.randomUUID(),
      token: generateRandomString(32),
      expiresAt: current.session.expiresAt.getTime(),
    }
    const won = await commitFactor(scope, {
      ...input,
      id: operation.id,
      intent: operation.intent,
      kind,
      receiptDigest: operation.receiptDigest,
      sessionId: current.session.id,
      token: current.session.token,
      claim: crypto.randomUUID(),
      now: Date.now(),
      newSession: next,
    })
    if (!won) {
      await refuseFactorOperation(scope, operation.id, Date.now())
      const settled = await operationFor(scope, operation.id)
      if (settled?.committedAt !== null && settled)
        return outcomeOf(settled, Date.now())
      factorError('FACTOR_STATE_CHANGED', 'CONFLICT')
    }
    const replacement = await acceptedSession(scope, next.token, Date.now())
    if (!replacement)
      factorError('FACTOR_OUTCOME_UNKNOWN', 'SERVICE_UNAVAILABLE')
    const updatedUser = {
      ...current.user,
      twoFactorEnabled: input.proposed !== null,
    }
    await setSessionCookie(
      ctx,
      { session: replacement, user: updatedUser },
      !!(await ctx.getSignedCookie(
        ctx.context.authCookies.dontRememberToken.name,
        ctx.context.secret,
      )),
    )
    try {
      await cleanup()
    } catch {
      /* The durable cleanup intent survives this request. */
    }
    const settled = await operationFor(scope, operation.id)
    return {
      status: 'committed' as const,
      operation: kind,
      enabled: input.proposed !== null,
      cleanupPending: settled?.cleanupPending ?? true,
      ...(codes ? { backupCodes: codes } : {}),
    }
  }

  return {
    id: 'account-session-management',
    endpoints: {
      prepareFactor: createAuthEndpoint(
        '/account-security/prepare-factor',
        { method: 'POST', body: prepareInput, use: [sessionMiddleware] },
        async (ctx) => {
          const request = await registeredFactor(ctx, ctx.body)
          if (request.operation.committedAt !== null)
            factorError('FACTOR_STATE_CHANGED', 'CONFLICT')
          const expected = await factorSnapshot(request.scope)
          await checkPassword(ctx, expected, ctx.body.password)
          if (ctx.body.operation === 'enable' && expected.enabled)
            factorError('FACTOR_STATE_CHANGED', 'CONFLICT')
          let possession: {
            reservations: Array<FactorReservation>
            replay: Array<{ digest: string; step: number }>
          } = { reservations: [], replay: [] }
          if (ctx.body.operation === 'replace') {
            if (!ctx.body.proof) factorError('INVALID_CODE', 'BAD_REQUEST')
            possession = await currentProof(
              ctx,
              request.scope,
              request.proof.revision,
              expected,
              ctx.body.proof,
            )
          }
          const secret = generateRandomString(32)
          const codes = newBackupCodes()
          const proposed = {
            id: crypto.randomUUID(),
            secret: await symmetricEncrypt({
              key: ctx.context.secretConfig,
              data: secret,
            }),
            backupCodes: await symmetricEncrypt({
              key: ctx.context.secretConfig,
              data: JSON.stringify(codes),
            }),
          }
          const proposalId = crypto.randomUUID()
          const expiresAt = Math.min(
            request.operation.expiresAt,
            request.current.session.createdAt.getTime() + 300000,
            Date.now() + 300000,
          )
          await stageFactorProposal(request.scope, {
            digest: await hashSecret(proposalId),
            operationId: request.operation.id,
            expiresAt,
            now: Date.now(),
            payload: await symmetricEncrypt({
              key: ctx.context.secretConfig,
              data: JSON.stringify({ expected, proposed, ...possession }),
            }),
          })
          return ctx.json({
            proposalId,
            expiresAt,
            totpURI: setupUri(secret, request.current.user.email),
          })
        },
      ),
      cancelFactor: createAuthEndpoint(
        '/account-security/cancel-factor',
        { method: 'POST', body: factorIntent, use: [sessionMiddleware] },
        async (ctx) => {
          const request = await registeredFactor(ctx, ctx.body)
          await refuseFactorOperation(
            request.scope,
            request.operation.id,
            Date.now(),
          )
          const settled = await operationFor(
            request.scope,
            request.operation.id,
          )
          if (!settled) refused()
          return ctx.json(outcomeOf(settled, Date.now()))
        },
      ),
      commitFactor: createAuthEndpoint(
        '/account-security/commit-factor',
        { method: 'POST', body: commitInput, use: [sessionMiddleware] },
        async (ctx) => {
          const request = await registeredFactor(ctx, ctx.body)
          if (request.operation.committedAt !== null)
            return ctx.json(outcomeOf(request.operation, Date.now()))
          const digest = await hashSecret(ctx.body.proposalId)
          const proposal = await readFactorProposal(
            request.scope,
            request.operation.id,
            digest,
          )
          if (!proposal || proposal.expiresAt <= Date.now())
            factorError('FACTOR_SETUP_EXPIRED')
          const payload = await readMaterial(
            ctx,
            proposal.payload,
            proposalPayload,
          )
          const reservation = await reserve(
            request.scope,
            request.proof.revision,
            'proposal',
          )
          const secret = await decryptMaterial(ctx, payload.proposed.secret)
          const step = await matchCurrentStep(secret, ctx.body.code)
          if (step === null) factorError('INVALID_CODE', 'BAD_REQUEST')
          const codes = await readMaterial(
            ctx,
            payload.proposed.backupCodes,
            z.array(z.string()).length(10),
          )
          return ctx.json(
            await finishFactor(
              ctx,
              request,
              {
                ...payload,
                proposalDigest: digest,
                reservations: [...payload.reservations, reservation],
                replay: [
                  ...payload.replay,
                  { digest: await hashSecret(secret), step },
                ],
              },
              codes,
            ),
          )
        },
      ),
      disableFactor: createAuthEndpoint(
        '/account-security/disable-factor',
        {
          method: 'POST',
          body: changeInput.extend({ operation: z.literal('disable') }),
          use: [sessionMiddleware],
        },
        async (ctx) => {
          const request = await registeredFactor(ctx, ctx.body)
          if (request.operation.committedAt !== null)
            return ctx.json(outcomeOf(request.operation, Date.now()))
          const expected = await factorSnapshot(request.scope)
          await checkPassword(ctx, expected, ctx.body.password)
          const possession = await currentProof(
            ctx,
            request.scope,
            request.proof.revision,
            expected,
            ctx.body.proof,
          )
          return ctx.json(
            await finishFactor(ctx, request, {
              expected,
              proposed: null,
              ...possession,
            }),
          )
        },
      ),
      replaceBackupCodes: createAuthEndpoint(
        '/account-security/replace-backup-codes',
        {
          method: 'POST',
          body: changeInput.extend({ operation: z.literal('backup') }),
          use: [sessionMiddleware],
        },
        async (ctx) => {
          const request = await registeredFactor(ctx, ctx.body)
          if (request.operation.committedAt !== null)
            return ctx.json(outcomeOf(request.operation, Date.now()))
          const expected = await factorSnapshot(request.scope)
          await checkPassword(ctx, expected, ctx.body.password)
          const possession = await currentProof(
            ctx,
            request.scope,
            request.proof.revision,
            expected,
            ctx.body.proof,
          )
          if (!expected.factor) factorError('FACTOR_STATE_CHANGED', 'CONFLICT')
          const codes = newBackupCodes()
          const proposed = {
            id: expected.factor.id,
            secret: expected.factor.secret,
            backupCodes: await symmetricEncrypt({
              key: ctx.context.secretConfig,
              data: JSON.stringify(codes),
            }),
          }
          return ctx.json(
            await finishFactor(
              ctx,
              request,
              { expected, proposed, ...possession },
              codes,
            ),
          )
        },
      ),
      otherDeviceRevocationAvailability: createAuthEndpoint(
        '/account-security/availability',
        { method: 'GET', use: [sessionMiddleware] },
        async (ctx) => {
          ctx.setHeader('cache-control', 'no-store')
          const cookie = ctx.context.createAuthCookie(
            'account_security_receipt',
            { path: '/api/auth/account-security' },
          )
          const receipt = await ctx.getSignedCookie(
            cookie.name,
            ctx.context.secret,
          )
          const id = receipt && receiptPattern.exec(receipt)?.[1]
          const previous =
            id && receipt
              ? await receiptStatus(
                  db,
                  id,
                  await hashSecret(receipt),
                  Date.now(),
                )
              : null
          let ownerMatches = false
          if (previous && id) {
            const { scope } = await authority.bind(ctx.context.session.user.id)
            ownerMatches = (await operationFor(scope, id)) !== null
          }
          return ctx.json({
            available: enabled(),
            recovery:
              previous &&
              id &&
              ownerMatches &&
              (previous.kind === 'revoke-others' ||
                previous.committedAt === null)
                ? { id, ...outcomeOf(previous, Date.now()) }
                : null,
          })
        },
      ),
      registerOtherDeviceRevocation: createAuthEndpoint(
        '/account-security/register-operation',
        {
          method: 'POST',
          body: z
            .object({ intent, operation: operationKind.optional() })
            .strict(),
          use: [sessionMiddleware],
        },
        async (ctx) => {
          if (!enabled()) refused()
          if (
            ctx.headers?.get('origin') !== new URL(ctx.context.baseURL).origin
          )
            refused()
          const current = ctx.context.session
          const now = Date.now()
          if (current.session.impersonatedBy) refused()
          if (
            current.session.createdAt.getTime() <= now - 300_000 ||
            current.session.createdAt.getTime() > now
          ) {
            if (ctx.body.operation && ctx.body.operation !== 'revoke-others')
              factorError('FACTOR_FRESH_SESSION_REQUIRED')
            refused()
          }
          if (!(await authority.checkSession(current))) refused()
          const { scope, proof } = await authority.bind(current.user.id)
          const pending = await pendingRegistration(
            scope,
            current.session.id,
            now,
          )
          if (
            pending &&
            (pending.intent !== ctx.body.intent ||
              pending.kind !== (ctx.body.operation ?? 'revoke-others') ||
              pending.revision !== proof.revision)
          )
            refused()
          const id = pending?.id ?? crypto.randomUUID()
          const receipt = `${id}.${ctx.body.intent.toLowerCase()}`
          await registerRevocation(scope, {
            id,
            sessionId: current.session.id,
            intent: ctx.body.intent,
            receiptDigest: await hashSecret(receipt),
            revision: proof.revision,
            expiresAt: Math.min(
              now + 300_000,
              current.session.createdAt.getTime() + 300_000,
            ),
            kind: ctx.body.operation,
          })
          const cookie = ctx.context.createAuthCookie(
            'account_security_receipt',
            {
              httpOnly: true,
              sameSite: 'strict',
              path: '/api/auth/account-security',
              maxAge: 1200,
            },
          )
          await ctx.setSignedCookie(
            cookie.name,
            receipt,
            ctx.context.secret,
            cookie.attributes,
          )
          ctx.setHeader('cache-control', 'no-store')
          return ctx.json({ id, status: 'registered' as const })
        },
      ),
      commitOtherDeviceRevocation: createAuthEndpoint(
        '/account-security/revoke-other-sessions',
        {
          method: 'POST',
          body: operationInput,
          use: [sessionMiddleware],
        },
        async (ctx) => {
          if (!enabled()) refused()
          if (
            ctx.headers?.get('origin') !== new URL(ctx.context.baseURL).origin
          )
            refused()
          const cookie = ctx.context.createAuthCookie(
            'account_security_receipt',
            { path: '/api/auth/account-security' },
          )
          const receipt = await ctx.getSignedCookie(
            cookie.name,
            ctx.context.secret,
          )
          if (!receipt || receiptPattern.exec(receipt)?.[1] !== ctx.body.id)
            refused()
          const current = ctx.context.session
          if (
            current.session.impersonatedBy ||
            !(await authority.checkSession(current))
          )
            refused()
          const { scope } = await authority.bind(current.user.id)
          const operation = await operationFor(scope, ctx.body.id)
          if (
            !operation ||
            operation.kind !== 'revoke-others' ||
            operation.sessionId !== current.session.id ||
            operation.intent !== ctx.body.intent ||
            operation.receiptDigest !== (await hashSecret(receipt))
          )
            refused()
          if (
            !(await receiptStatus(
              db,
              operation.id,
              operation.receiptDigest,
              Date.now(),
            ))
          )
            refused()
          ctx.setHeader('cache-control', 'no-store')
          if (operation.committedAt !== null)
            return ctx.json({
              status: 'committed' as const,
              cleanupPending: operation.cleanupPending,
            })
          const committed = await commitRevocation(scope, {
            id: operation.id,
            sessionId: current.session.id,
            token: current.session.token,
            intent: ctx.body.intent,
            claim: crypto.randomUUID(),
            now: Date.now(),
          })
          if (committed) {
            try {
              await cleanup()
            } catch {
              /* Durable pending intent is recovered by the scheduled sweep. */
            }
          }
          const settled = await operationFor(scope, operation.id)
          return ctx.json({
            status: committed ? ('committed' as const) : ('refused' as const),
            cleanupPending: settled?.cleanupPending ?? committed,
          })
        },
      ),
      otherDeviceRevocationStatus: createAuthEndpoint(
        '/account-security/operation-status',
        {
          method: 'GET',
          query: z.object({ id: z.string().uuid() }).strict(),
        },
        async (ctx) => {
          const cookie = ctx.context.createAuthCookie(
            'account_security_receipt',
            { path: '/api/auth/account-security' },
          )
          const receipt = await ctx.getSignedCookie(
            cookie.name,
            ctx.context.secret,
          )
          if (!receipt || receiptPattern.exec(receipt)?.[1] !== ctx.query.id)
            refused()
          const operation = await receiptStatus(
            db,
            ctx.query.id,
            await hashSecret(receipt),
            Date.now(),
          )
          if (!operation) refused()
          ctx.setHeader('cache-control', 'no-store')
          return ctx.json(outcomeOf(operation, Date.now()))
        },
      ),
    },
  }
}
