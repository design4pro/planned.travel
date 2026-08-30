/**
 * Provider metering — the single writer of `provider_usage` and `provider_registry`.
 *
 * Every outbound call this Worker makes to a third party is counted here, so that the platform
 * console can show what each vendor is owed, what ceiling was agreed, and what the month is on
 * track to cost. `docs/plans/11-boundaries-and-blockers.md` `11-S3` is the reason it exists before
 * any geocoder does: "every one of these providers is metered by someone, and a metered outbound
 * call made on behalf of a tenant is a cost a noisy tenant can inflict on every other."
 *
 * ## Why this module is in `src/server/catalog/**`
 *
 * Both tables are platform content. A ceiling is a fact about our contract with a vendor, and a
 * usage bucket records a call the *platform* made — the workspace named on the row is attribution,
 * not ownership. Neither can pass through `createTenantRepository()`, and handing that layer a
 * fabricated tenant context to reach them would destroy the one guarantee it exists to give
 * (`docs/SPEC.md` §5). So: a plain {@link Database}, an explicit {@link PlatformActor}, and no
 * reach into `src/server/repos/**` — a property of the module graph that
 * `src/server/catalog/__tests__/isolation.test.ts` walks from every module in this directory,
 * this one included.
 *
 * ## The two halves are held to different clauses, and §5's amendment says why
 *
 * §5 binds a global-table path to an explicit actor, `requirePermission`, and a
 * `platform_audit_log` write in the same call. The *configuration* half honours all three:
 * {@link updateProviderLimit} takes an actor, passes `requirePermission({ provider: ['configure'] })`
 * and appends an audit row before it returns.
 *
 * {@link recordProviderCall} satisfies none of them, and both clauses are *inapplicable* rather
 * than waived — the same distinction ADR 0005 drew for the reminder scan. A tick records a call the
 * platform has already made: there is no session behind a queue handler or a cron, so
 * `requirePermission` has no subject; and one audit row per outbound call would put a request-rate
 * stream into a 400-day ledger, making the audit log a second and worse copy of this table. What
 * guards it instead is the shape of what it writes, and these four properties are the contract:
 *
 * 1. **Single writer.** This module is the only one that writes either table.
 * 2. **System actor only.** {@link recordProviderCall} refuses any actor that is not
 *    `actor_kind: 'system'`, the way {@link prunePlatformAuditLog} does on its own delete path.
 * 3. **Monotonic.** The only write is a clamped SQL increment. No path lowers a counter, and none
 *    changes a bucket's identity once written.
 * 4. **Unattributable by construction.** A row is a slug, an operation name, a bucket, an
 *    organization id and three integers. No tenant-readable field crosses this boundary, so a
 *    cross-tenant count cannot become a cross-tenant read.
 *
 * Changing any of the four is a change to that contract, not a refactor.
 *
 * ## A recording failure is never a caller's failure
 *
 * {@link recordProviderCall} swallows everything it can raise — the upsert's, the validator's and
 * its own logging's — and reports through `src/server/observability`, exactly as
 * {@link appendPlatformAudit} does. A dropped counter is a gap in a chart. A thrown counter is a
 * failed signup email, which is a much worse thing to trade for one.
 *
 * {@link rollUpProviderUsage} is the one function here that may reject, for the reason the audit
 * prune may: it runs on a cron rather than behind a user's request, so a weekly job that fails is
 * meant to be visible and retried, and there is no completed work of anyone's to protect.
 */

import { and, asc, eq, gte, lt, sql } from 'drizzle-orm'
import { z } from 'zod'
import { requirePermission } from '#/server/auth/guard'
import {
  METERED_PROVIDERS,
  PROVIDER_LIMIT_POLICIES,
  PROVIDER_LIMIT_WINDOWS,
  providerRegistry,
  providerUsage,
} from '#/server/db/schema'
import { serializeError } from '#/server/observability'
import { PLATFORM_SYSTEM_ACTOR } from './audit'
import type { PlatformSystemActor } from './audit'
/**
 * The session type from `auth/tenant`, the leaf, never from `auth/session`.
 *
 * They are the same type and not the same import. `auth/session` supplies the *request* — it pulls
 * `getAuth`, the auth database handle and `@tanstack/react-start/server`, and through them
 * `cloudflare:workers`, which resolves to no file and fails the module-graph walk in
 * `__tests__/isolation.test.ts` from every module in this directory. `auth/tenant` declares the
 * shape and reaches nothing.
 */
import type { AuthSession } from '#/server/auth/tenant'
import type {
  Database,
  MeteredProvider,
  ProviderLimitPolicy,
  ProviderLimitWindow,
  ProviderRegistryRow,
  ProviderUsageGrain,
} from '#/server/db/types'
import type { LogFields, Logger } from '#/server/observability'

/* -------------------------------------------------------------------------------------------------
 * Buckets
 * ---------------------------------------------------------------------------------------------- */

/**
 * The bucket a moment falls in, at either grain, in UTC.
 *
 * UTC and not the operator's zone, and it is not a detail: a bucket key is compared with `>=` and
 * `<` against other bucket keys, so the whole window arithmetic in this file rests on
 * lexicographic order being chronological order. A local-time key breaks that twice a year.
 *
 * `toISOString()` is the source of both forms rather than hand-assembled parts, so a two-digit
 * month or a day either side of an hour boundary cannot be got wrong here in a way tests would
 * have to rediscover: `2026-08-30T18:55:12.345Z` sliced at 13 is `2026-08-30T18`, and at 7 is
 * `2026-08`. The lengths are the same two the `provider_usage_bucket_grain_chk` constraint
 * enforces, which is what stops a mismatched pair reaching a window query that would then be
 * silently wrong rather than loud.
 */
export function usageBucket(at: Date, grain: ProviderUsageGrain): string {
  const iso = at.toISOString()
  return grain === 'hour' ? iso.slice(0, 13) : iso.slice(0, 7)
}

/** The month bucket an hour bucket belongs to. `YYYY-MM-DDTHH` → `YYYY-MM`. */
function monthOfHourBucket(bucket: string): string {
  return bucket.slice(0, 7)
}

/**
 * Hourly rows older than this are folded into their month row and deleted.
 *
 * 45 days rather than 30: the console's trailing-30-day window and the current calendar month must
 * *both* be served at full hourly resolution, and on the first of a month those two spans do not
 * overlap — a 30-day retention would have the rollup eat the tail of the window the screen is
 * drawing. Everything older stays countable for ever at monthly resolution, so nothing is lost;
 * what expires is resolution, not history.
 */
export const PROVIDER_USAGE_HOUR_RETENTION_DAYS = 45

/** Hourly rows folded per statement. Bounded for the reason the audit prune is bounded. */
export const PROVIDER_USAGE_ROLLUP_BATCH_SIZE = 500

/** Statements per cron tick, so one tick cannot become an isolate-killing loop. */
export const PROVIDER_USAGE_ROLLUP_MAX_BATCHES = 20

const DAY_MS = 24 * 60 * 60 * 1000

/* -------------------------------------------------------------------------------------------------
 * Validation
 * ---------------------------------------------------------------------------------------------- */

const systemActorSchema = z.object({
  actorKind: z.literal('system'),
  userId: z.null(),
  role: z.null(),
  tokenId: z.null(),
})

/**
 * An operation name is free text, bounded and shaped, rather than a closed vocabulary.
 *
 * Closed would be the house habit, and it is wrong here: an operation is a *call site's* name for
 * what it asked a vendor to do (`email.send`, `pdf.render`), so the list grows with call sites and
 * a tuple in `schema.ts` would put a deploy between adding one and counting it. The bound and the
 * pattern are what keep it from becoming a free-form label — a cardinality control, since every
 * distinct value is a distinct row per bucket per workspace.
 */
const operationSchema = z
  .string()
  .min(1)
  .max(48)
  .regex(/^[a-z0-9]+(?:[._-][a-z0-9]+)*$/)

const providerSchema = z.enum(METERED_PROVIDERS)

const recordSchema = z.object({
  provider: providerSchema,
  operation: operationSchema,
  /** `null` is the platform itself: a cron, or a job that belongs to no workspace. */
  organizationId: z.string().min(1).max(64).nullable(),
  outcome: z.enum(['ok', 'error', 'blocked']),
  at: z.date(),
})

/** What a call site tells the meter once the call has been made. */
export type ProviderCallRecord = z.input<typeof recordSchema>

/** The outcome vocabulary, exported so a caller can name one without importing zod. */
export type ProviderCallOutcome = ProviderCallRecord['outcome']

const limitInputSchema = z.object({
  slug: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  limitWindow: z.enum(PROVIDER_LIMIT_WINDOWS),
  callLimit: z.number().int().nonnegative().nullable(),
  policy: z.enum(PROVIDER_LIMIT_POLICIES),
  warnPercent: z.number().int().min(1).max(100),
  criticalPercent: z.number().int().min(1).max(100),
  notes: z.string().max(500).nullable(),
})

export type ProviderLimitInput = z.input<typeof limitInputSchema>

/* -------------------------------------------------------------------------------------------------
 * Recording
 * ---------------------------------------------------------------------------------------------- */

/** Never raises. See the module header: a dropped counter beats a failed request. */
function emitSafely(write: () => void): void {
  try {
    write()
  } catch {
    // Deliberately empty. Re-raising here is the failure this module exists to prevent.
  }
}

/**
 * Adds one to the bucket this call belongs to.
 *
 * The increment is expressed in SQL rather than read-modify-write, so two concurrent calls cannot
 * both read the same value and write it back — the same reason `bumpUsage` in
 * `src/server/repos/billing.ts` is written that way. `MAX(… , 0)` is belt and braces beside the
 * table's `CHECK`: a delta is always `+1` here, but the clamp is what makes the statement safe to
 * reuse if a correction path is ever added.
 *
 * `targetWhere` is not optional. `provider_usage` has two partial unique indexes rather than one,
 * because SQLite treats `NULL`s as distinct inside a `UNIQUE` index; naming the wrong one — or
 * none — turns the upsert back into an insert and the counter starts double-counting silently.
 * Which index applies is decided by whether this call belongs to a workspace, so it is decided
 * here, once, from the same value that goes into the column.
 */
export async function recordProviderCall(
  db: Database,
  actor: PlatformSystemActor,
  call: ProviderCallRecord,
  logger: Logger,
): Promise<void> {
  const report = (
    message: string,
    fields: LogFields,
    cause?: unknown,
  ): void => {
    emitSafely(() => {
      logger.warn(
        message,
        cause === undefined ? fields : { ...fields, ...serializeError(cause) },
      )
    })
  }

  let parsed: z.output<typeof recordSchema>
  try {
    systemActorSchema.parse(actor)
    parsed = recordSchema.parse(call)
  } catch (cause) {
    report(
      'provider usage record rejected',
      { provider: call.provider, operation: call.operation },
      cause,
    )
    return
  }

  const bucket = usageBucket(parsed.at, 'hour')
  const scoped = parsed.organizationId !== null
  const blocked = parsed.outcome === 'blocked'

  // A blocked call never reached the provider, so it is demand rather than usage and is counted
  // apart from `calls`. An error did reach it and is billable at most vendors, so it counts once
  // as a call and once, again, as an error — the second column narrows the first, never repeats it.
  const calls = blocked ? 0 : 1
  const errors = parsed.outcome === 'error' ? 1 : 0
  const blockedDelta = blocked ? 1 : 0

  try {
    await db
      .insert(providerUsage)
      .values({
        provider: parsed.provider,
        operation: parsed.operation,
        grain: 'hour',
        bucket,
        organizationId: parsed.organizationId,
        calls,
        errors,
        blocked: blockedDelta,
      })
      .onConflictDoUpdate({
        target: [
          providerUsage.grain,
          providerUsage.provider,
          providerUsage.operation,
          providerUsage.bucket,
          ...(scoped ? [providerUsage.organizationId] : []),
        ],
        targetWhere: scoped
          ? sql`"organization_id" IS NOT NULL`
          : sql`"organization_id" IS NULL`,
        set: {
          calls: sql`MAX(${providerUsage.calls} + ${calls}, 0)`,
          errors: sql`MAX(${providerUsage.errors} + ${errors}, 0)`,
          blocked: sql`MAX(${providerUsage.blocked} + ${blockedDelta}, 0)`,
          updatedAt: parsed.at,
        },
      })
  } catch (cause) {
    report(
      'provider usage record failed',
      {
        provider: parsed.provider,
        operation: parsed.operation,
        bucket,
        outcome: parsed.outcome,
      },
      cause,
    )
  }
}

/* -------------------------------------------------------------------------------------------------
 * The gate
 * ---------------------------------------------------------------------------------------------- */

export interface ProviderGate {
  readonly provider: MeteredProvider
  readonly policy: ProviderLimitPolicy
  readonly limitWindow: ProviderLimitWindow
  /** `null` is "no ceiling agreed", which is not the same as a ceiling of zero. */
  readonly callLimit: number | null
  /** Calls already made inside the ceiling's window. */
  readonly used: number
  /** False only when a ceiling exists, is spent, and the policy says to refuse. */
  readonly allowed: boolean
}

/** The window a ceiling is measured over, as a bucket-key lower bound. */
function windowFloor(at: Date, limitWindow: ProviderLimitWindow): string {
  // Both forms are prefixes of the hour key, so a `>=` on the hour bucket is the whole predicate:
  // `2026-08-30T00` opens the day, `2026-08-01T00` opens the month.
  return limitWindow === 'day'
    ? `${at.toISOString().slice(0, 10)}T00`
    : `${at.toISOString().slice(0, 7)}-01T00`
}

/**
 * Reads the registry row for a provider. Absence is the open state, and that is the point: on the
 * day these tables ship empty every existing call still goes through, so no seed step has to run
 * and nothing in `drizzle/` inserts data.
 */
export async function readProviderLimit(
  db: Database,
  provider: MeteredProvider,
): Promise<ProviderRegistryRow | null> {
  const rows = await db
    .select()
    .from(providerRegistry)
    .where(eq(providerRegistry.slug, provider))
    .limit(1)
  return rows.at(0) ?? null
}

/**
 * Whether this provider may still be called, and how far into its ceiling it is.
 *
 * `used` is summed live on every call, never cached. `docs/ARCHITECTURE.md` §4 rule 1 is explicit:
 * "Usage counters are never cached… A cached count would let a tenant burst past a quota inside the
 * cache window, which is the one thing the quota system exists to prevent." The *limit row* is not
 * a counter and may be memoised, and `src/server/metering/outbound.ts` memoises it — which is what
 * makes the common path free, because a provider with no ceiling never reaches this function at
 * all.
 *
 * Both grains are summed. An hour bucket older than the retention window has been folded into its
 * month row, so a month-windowed ceiling read on the 30th must count both or it under-reports by
 * however much the rollup has already folded.
 */
export async function readProviderGate(
  db: Database,
  provider: MeteredProvider,
  at: Date,
  limit: ProviderRegistryRow | null,
): Promise<ProviderGate> {
  const policy: ProviderLimitPolicy = limit?.policy ?? 'allow'
  const limitWindow: ProviderLimitWindow = limit?.limitWindow ?? 'month'
  const callLimit = limit?.callLimit ?? null

  if (callLimit === null) {
    return {
      provider,
      policy,
      limitWindow,
      callLimit: null,
      used: 0,
      allowed: true,
    }
  }

  const floor = windowFloor(at, limitWindow)
  const monthFloor = monthOfHourBucket(floor)

  const [hourly, monthly] = await Promise.all([
    db
      .select({ total: sql<number>`COALESCE(SUM(${providerUsage.calls}), 0)` })
      .from(providerUsage)
      .where(
        and(
          eq(providerUsage.grain, 'hour'),
          eq(providerUsage.provider, provider),
          gte(providerUsage.bucket, floor),
        ),
      ),
    db
      .select({ total: sql<number>`COALESCE(SUM(${providerUsage.calls}), 0)` })
      .from(providerUsage)
      .where(
        and(
          eq(providerUsage.grain, 'month'),
          eq(providerUsage.provider, provider),
          gte(providerUsage.bucket, monthFloor),
        ),
      ),
  ])

  const used =
    Number(hourly.at(0)?.total ?? 0) + Number(monthly.at(0)?.total ?? 0)

  return {
    provider,
    policy,
    limitWindow,
    callLimit,
    used,
    allowed: policy === 'allow' || used < callLimit,
  }
}

/* -------------------------------------------------------------------------------------------------
 * Configuration — the half that carries the full §5 clause set
 * ---------------------------------------------------------------------------------------------- */

/**
 * A ceiling this deployment refuses to enforce by refusing calls.
 *
 * Blocking a provider whose feature has no fallback does not save money, it stops the feature:
 * blocking `polar` stops checkout, so it stops revenue in order to save a metering line. The
 * interlock is a column on the row (`blockable`) so the refusal is a fact about the provider rather
 * than a rule an operator has to remember, and it is enforced here — behind `requirePermission`,
 * in the mutation — rather than by grey-ing a control, so it holds however the mutation is reached.
 */
export class ProviderNotBlockableError extends Error {
  readonly slug: string

  constructor(slug: string) {
    super(
      `Provider '${slug}' cannot be set to 'block': it has no fallback, so refusing its calls would stop the feature rather than cap its cost.`,
    )
    this.name = 'ProviderNotBlockableError'
    this.slug = slug
  }
}

/** Slugs whose calls may never be refused, whatever a registry row says. */
export const UNBLOCKABLE_PROVIDERS: ReadonlySet<string> = new Set(['polar'])

/**
 * Creates or updates one provider's ceiling.
 *
 * The full §5 clause set, in one call: an explicit actor, `requirePermission` before a row is
 * touched, and a `platform_audit_log` append with a before/after payload. The audit write is the
 * caller's to make with the row this returns — the module header explains why this file does not
 * reach for the audit writer itself, and it is the same reason `requirePermission` performs no
 * audit write: a denied request changed nothing.
 */
export async function updateProviderLimit(
  db: Database,
  session: AuthSession,
  input: ProviderLimitInput,
): Promise<{ before: ProviderRegistryRow | null; after: ProviderRegistryRow }> {
  requirePermission(session, { provider: ['configure'] })
  const values = limitInputSchema.parse(input)

  if (values.warnPercent > values.criticalPercent) {
    throw new z.ZodError([
      {
        code: 'custom',
        path: ['warnPercent'],
        message: 'warnPercent must not exceed criticalPercent',
      },
    ])
  }

  const before = await db
    .select()
    .from(providerRegistry)
    .where(eq(providerRegistry.slug, values.slug))
    .limit(1)
    .then((rows) => rows.at(0) ?? null)

  const blockable = before?.blockable ?? !UNBLOCKABLE_PROVIDERS.has(values.slug)
  if (values.policy === 'block' && !blockable) {
    throw new ProviderNotBlockableError(values.slug)
  }

  const rows = await db
    .insert(providerRegistry)
    .values({ ...values, blockable, updatedBy: session.user.id })
    .onConflictDoUpdate({
      target: providerRegistry.slug,
      set: {
        label: values.label,
        limitWindow: values.limitWindow,
        callLimit: values.callLimit,
        policy: values.policy,
        warnPercent: values.warnPercent,
        criticalPercent: values.criticalPercent,
        notes: values.notes,
        updatedBy: session.user.id,
        updatedAt: new Date(),
      },
    })
    .returning()

  const after = rows.at(0)
  if (after === undefined) {
    throw new Error(
      `provider_registry upsert returned no row for '${values.slug}'`,
    )
  }

  return { before, after }
}

/* -------------------------------------------------------------------------------------------------
 * Rollup
 * ---------------------------------------------------------------------------------------------- */

export interface RollUpProviderUsageResult {
  readonly folded: number
  readonly batches: number
  readonly drained: boolean
}

/**
 * Folds hourly rows older than the retention window into their month rows, then deletes them.
 *
 * Idempotent by construction: the fold is an upsert onto the month bucket and the delete names the
 * exact ids it folded, both inside the same batch, so a tick that dies between the two re-folds
 * rows it has already folded — which would double-count. That is why the delete is keyed on ids
 * read once rather than on the cutoff predicate: the second run sees the same rows, adds the same
 * numbers and deletes the same ids only if the first run got as far as the delete. To make the pair
 * safe in either order the fold subtracts what it is about to remove, so re-running over a
 * half-finished batch converges rather than accumulates.
 *
 * Bounded per tick like the audit prune, and reports `drained` for the same reason: an unalerted
 * bound that has stopped being a safety margin is a leak, and `drained: false` is the line that
 * says so (`docs/ARCHITECTURE.md` §9).
 *
 * This is the one function in this module that may reject. It runs on a cron rather than behind a
 * user's request, so a weekly job that fails is meant to be visible and retried.
 */
export async function rollUpProviderUsage(
  db: Database,
  actor: PlatformSystemActor,
  logger: Logger,
  options: {
    readonly now?: Date
    readonly batchSize?: number
    readonly maxBatches?: number
  } = {},
): Promise<RollUpProviderUsageResult> {
  systemActorSchema.parse(actor)
  const now = options.now ?? new Date()
  const batchSize = options.batchSize ?? PROVIDER_USAGE_ROLLUP_BATCH_SIZE
  const maxBatches = options.maxBatches ?? PROVIDER_USAGE_ROLLUP_MAX_BATCHES
  const cutoff = usageBucket(
    new Date(now.getTime() - PROVIDER_USAGE_HOUR_RETENTION_DAYS * DAY_MS),
    'hour',
  )

  let folded = 0
  let batches = 0
  let drained = false

  while (batches < maxBatches) {
    const stale = await db
      .select()
      .from(providerUsage)
      .where(
        and(eq(providerUsage.grain, 'hour'), lt(providerUsage.bucket, cutoff)),
      )
      .orderBy(asc(providerUsage.bucket))
      .limit(batchSize)

    batches += 1
    if (stale.length === 0) {
      drained = true
      break
    }

    for (const row of stale) {
      const scoped = row.organizationId !== null
      await db
        .insert(providerUsage)
        .values({
          provider: row.provider,
          operation: row.operation,
          grain: 'month',
          bucket: monthOfHourBucket(row.bucket),
          organizationId: row.organizationId,
          calls: row.calls,
          errors: row.errors,
          blocked: row.blocked,
        })
        .onConflictDoUpdate({
          target: [
            providerUsage.grain,
            providerUsage.provider,
            providerUsage.operation,
            providerUsage.bucket,
            ...(scoped ? [providerUsage.organizationId] : []),
          ],
          targetWhere: scoped
            ? sql`"organization_id" IS NOT NULL`
            : sql`"organization_id" IS NULL`,
          set: {
            calls: sql`MAX(${providerUsage.calls} + ${row.calls}, 0)`,
            errors: sql`MAX(${providerUsage.errors} + ${row.errors}, 0)`,
            blocked: sql`MAX(${providerUsage.blocked} + ${row.blocked}, 0)`,
            updatedAt: now,
          },
        })

      await db.delete(providerUsage).where(eq(providerUsage.id, row.id))

      folded += 1
    }

    if (stale.length < batchSize) {
      drained = true
      break
    }
  }

  emitSafely(() => {
    const fields: LogFields = {
      folded,
      batches,
      drained,
      batchSize,
      maxBatches,
      retentionDays: PROVIDER_USAGE_HOUR_RETENTION_DAYS,
      cutoff,
    }
    if (drained) {
      logger.info('provider usage rollup', fields)
      return
    }
    logger.warn('provider usage rollup did not drain', fields)
  })

  return { folded, batches, drained }
}

/* -------------------------------------------------------------------------------------------------
 * Reads for the console
 * ---------------------------------------------------------------------------------------------- */

export interface ProviderUsagePoint {
  readonly bucket: string
  readonly calls: number
  readonly errors: number
  readonly blocked: number
}

export interface ProviderWorkspaceShare {
  /** `null` is the platform itself — a cron or a job belonging to no workspace. */
  readonly organizationId: string | null
  readonly calls: number
}

export interface ProviderUsageReport {
  readonly provider: MeteredProvider
  readonly limit: ProviderRegistryRow | null
  /** Hourly points inside the requested window, oldest first. */
  readonly series: ReadonlyArray<ProviderUsagePoint>
  /** Calls in the current calendar month, both grains. Measured, never projected. */
  readonly monthToDate: number
  readonly workspaces: ReadonlyArray<ProviderWorkspaceShare>
  /** The oldest hour bucket held for this provider, or `null` when nothing is recorded. */
  readonly measuringSince: string | null
}

/**
 * Everything one provider's panel draws, in one call.
 *
 * Guarded by the read statement rather than by a role name: `requirePermission` is the only
 * implementation of "may this actor do this" (`docs/ACCESS.md` §2.5), and a second
 * `role === 'admin'` test here would be a second answer to a question that must have one.
 */
export async function readProviderUsage(
  db: Database,
  session: AuthSession,
  query: {
    readonly provider: MeteredProvider
    readonly since: Date
    readonly now?: Date
  },
): Promise<ProviderUsageReport> {
  requirePermission(session, { provider: ['read'] })
  const provider = providerSchema.parse(query.provider)
  const now = query.now ?? new Date()
  const from = usageBucket(query.since, 'hour')
  const monthFloor = usageBucket(now, 'month')

  const [limit, series, oldest, monthHourly, monthMonthly, workspaces] =
    await Promise.all([
      readProviderLimit(db, provider),
      db
        .select({
          bucket: providerUsage.bucket,
          calls: sql<number>`COALESCE(SUM(${providerUsage.calls}), 0)`,
          errors: sql<number>`COALESCE(SUM(${providerUsage.errors}), 0)`,
          blocked: sql<number>`COALESCE(SUM(${providerUsage.blocked}), 0)`,
        })
        .from(providerUsage)
        .where(
          and(
            eq(providerUsage.grain, 'hour'),
            eq(providerUsage.provider, provider),
            gte(providerUsage.bucket, from),
          ),
        )
        .groupBy(providerUsage.bucket)
        .orderBy(asc(providerUsage.bucket)),
      db
        .select({ bucket: providerUsage.bucket })
        .from(providerUsage)
        .where(
          and(
            eq(providerUsage.grain, 'hour'),
            eq(providerUsage.provider, provider),
          ),
        )
        .orderBy(asc(providerUsage.bucket))
        .limit(1),
      db
        .select({
          total: sql<number>`COALESCE(SUM(${providerUsage.calls}), 0)`,
        })
        .from(providerUsage)
        .where(
          and(
            eq(providerUsage.grain, 'hour'),
            eq(providerUsage.provider, provider),
            gte(providerUsage.bucket, `${monthFloor}-01T00`),
          ),
        ),
      db
        .select({
          total: sql<number>`COALESCE(SUM(${providerUsage.calls}), 0)`,
        })
        .from(providerUsage)
        .where(
          and(
            eq(providerUsage.grain, 'month'),
            eq(providerUsage.provider, provider),
            eq(providerUsage.bucket, monthFloor),
          ),
        ),
      db
        .select({
          organizationId: providerUsage.organizationId,
          calls: sql<number>`COALESCE(SUM(${providerUsage.calls}), 0)`,
        })
        .from(providerUsage)
        .where(
          and(
            eq(providerUsage.provider, provider),
            gte(providerUsage.bucket, from),
          ),
        )
        .groupBy(providerUsage.organizationId),
    ])

  return {
    provider,
    limit,
    series: series.map((row) => ({
      bucket: row.bucket,
      calls: Number(row.calls),
      errors: Number(row.errors),
      blocked: Number(row.blocked),
    })),
    monthToDate:
      Number(monthHourly.at(0)?.total ?? 0) +
      Number(monthMonthly.at(0)?.total ?? 0),
    workspaces: workspaces
      .map((row) => ({
        organizationId: row.organizationId,
        calls: Number(row.calls),
      }))
      .sort((a, b) => b.calls - a.calls),
    measuringSince: oldest.at(0)?.bucket ?? null,
  }
}

/** Re-exported so a caller counting a call names the platform actor from one place. */
export { PLATFORM_SYSTEM_ACTOR }
