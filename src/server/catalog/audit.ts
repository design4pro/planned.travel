/**
 * Platform audit log — an append-only record of what happened *to the platform*, as opposed to what
 * happened inside a workspace.
 *
 * This module is the single writer of `platform_audit_log` (SPEC §5, docs/ACCESS.md §4). Rows are
 * never updated, and the only delete path is {@link prunePlatformAuditLog} for the retention cron.
 * An audit write must never be the reason a user's action fails, so callers append *after* the
 * mutation has committed and every function here swallows its own failure: a rejected append is a
 * logging incident raised through `src/server/observability`, never a `500` handed to the caller and
 * never a rollback of work that already succeeded.
 *
 * Two things this file deliberately does not do, both of them SPEC §5's carve-out in practice:
 *
 * - It takes a plain {@link Database} and an explicit {@link PlatformActor}, never a `TenantScope`.
 *   `platform_audit_log` carries no `organization_id`, so the tenant layer — whose whole purpose is
 *   to make a forgotten tenant filter inexpressible — cannot reach it, and handing that layer a
 *   fabricated context to get here would destroy the one guarantee it exists to give. Nothing in
 *   `src/server/catalog/**` may import the tenant repository factory or the `src/server/repos`
 *   barrel, and the test beside this file greps the whole directory for both. The one symbol it
 *   does take from that directory is {@link AUDIT_ACTION_PATTERN}, a regex, so that the two logs
 *   cannot drift into two spellings of one vocabulary (§4.2).
 * - It decides no authorisation. `requirePermission` in `src/server/auth/guard.ts` is the only place
 *   that answers "may this actor do this", and it performs no audit write of its own — a denied
 *   request changed nothing, and a log of attempts is a different table from a log of changes.
 */

import { lt } from 'drizzle-orm'
import { z } from 'zod'
import { resolvePlatformRole } from '#/server/auth/access'
import { PLATFORM_AUDIT_ACTIONS, platformAuditLog } from '#/server/db/schema'
import { serializeError } from '#/server/observability'
import { AUDIT_ACTION_PATTERN } from '#/server/repos/audit'
import type { PlatformActor } from '#/server/auth/guard'
import type {
  Database,
  NewPlatformAuditLogEntry,
  PlatformAuditAction,
  PlatformAuditChanges,
  PlatformAuditEntityType,
} from '#/server/db/types'
import type { LogFields, Logger } from '#/server/observability'

/* -------------------------------------------------------------------------------------------------
 * The vocabulary
 * ---------------------------------------------------------------------------------------------- */

/**
 * The fifteen three-segment `platform.<entity>.<verb>` actions of docs/ACCESS.md §4.2, frozen.
 *
 * The list is closed: a sixteenth platform action is an amendment to §4.2's table, made in the
 * commit that adds the code writing it. `platform.share.revoked` is here now even though the
 * moderation screen that writes it is Faza F, because the §1.1 statement dictionary is closed in
 * this phase and a name that arrives later cannot be added without amending the document.
 *
 * The sixteen two-segment catalogue actions (`catalog_place.*`, `catalog_ingest.*`, `place_pack.*`,
 * `catalog_source.*`) belong to `src/server/catalog/repo.ts` in Faza C and are deliberately absent.
 */
export const PLATFORM_ACTIONS = Object.freeze({
  USER_CREATED: 'platform.user.created',
  USER_UPDATED: 'platform.user.updated',
  USER_ROLE_CHANGED: 'platform.user.role_changed',
  USER_BANNED: 'platform.user.banned',
  USER_UNBANNED: 'platform.user.unbanned',
  USER_DELETED: 'platform.user.deleted',
  USER_PASSWORD_SET: 'platform.user.password_set',
  USER_EMAIL_SET: 'platform.user.email_set',
  USER_IMPERSONATION_STARTED: 'platform.user.impersonation_started',
  USER_IMPERSONATION_ENDED: 'platform.user.impersonation_ended',
  SESSION_REVOKED: 'platform.session.revoked',
  SESSION_REVOKED_ALL: 'platform.session.revoked_all',
  TOKEN_ISSUED: 'platform.token.issued',
  TOKEN_REVOKED: 'platform.token.revoked',
  SHARE_REVOKED: 'platform.share.revoked',
} as const satisfies Readonly<Record<string, PlatformAuditAction>>)

/** One of the fifteen names in {@link PLATFORM_ACTIONS}. */
export type PlatformActionName = (typeof PLATFORM_ACTIONS)[keyof typeof PLATFORM_ACTIONS]

/**
 * docs/ACCESS.md §4.2's prefix table: everything before the verb fixes the `entity_type` written
 * beside it, so §4.4's timeline query never has to guess which prefix belongs to which table.
 *
 * Eight rows, and the reason there are eight rather than thirty-one is that the mapping is a
 * property of the *prefix*: `catalog_place.published` and `catalog_place.retired` are the same
 * entity seen twice. Callers never pass an `entity_type` — {@link entityTypeForAction} derives it,
 * which is what makes "the prefix names the entity" true of the rows and not only of the document.
 */
export const PLATFORM_AUDIT_ENTITY_BY_PREFIX = Object.freeze({
  catalog_place: 'catalog_place',
  catalog_ingest: 'catalog_ingest',
  place_pack: 'place_pack',
  catalog_source: 'catalog_source',
  'platform.user': 'user',
  'platform.session': 'session',
  'platform.token': 'staff_api_token',
  'platform.share': 'share_link',
} as const satisfies Readonly<Record<string, PlatformAuditEntityType>>)

/**
 * The four verbs docs/ACCESS.md §4.3 audits "without exception".
 *
 * They are the ones nobody would think to check afterwards, so a rejected append for one of them is
 * retried once and then raised at the highest severity the logger has. The action still stands:
 * reversing a completed ban because a log write failed is the worse of the two failures.
 */
export const ALWAYS_AUDITED_ACTIONS = Object.freeze([
  PLATFORM_ACTIONS.USER_BANNED,
  PLATFORM_ACTIONS.USER_UNBANNED,
  PLATFORM_ACTIONS.USER_IMPERSONATION_STARTED,
  PLATFORM_ACTIONS.USER_IMPERSONATION_ENDED,
] as const)

/** The platform acting on its own behalf — cron, matcher, prune (docs/ACCESS.md §4.1). */
export const PLATFORM_SYSTEM_ACTOR: PlatformActor = Object.freeze({
  userId: null,
  actorKind: 'system',
  role: null,
  tokenId: null,
})

/** Retention window, docs/ACCESS.md §4.3: thirteen months, so a full financial year plus a month. */
export const PLATFORM_AUDIT_RETENTION_DAYS = 400

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * `typeof PLATFORM_AUDIT_ENTITY_BY_PREFIX` is an object literal type, so TypeScript gives it an
 * implicit index signature and this widening needs no cast. Reading through it is how a prefix that
 * the table does not declare becomes `undefined` at runtime rather than a lie at compile time.
 */
const entityTypeByPrefix: Readonly<Record<string, PlatformAuditEntityType | undefined>> =
  PLATFORM_AUDIT_ENTITY_BY_PREFIX

/**
 * The `entity_type` docs/ACCESS.md §4.2 pairs with an action.
 *
 * Two prefix forms and no third: a `platform.*` action's prefix is its first two segments, every
 * other action's prefix is its first. Underscores are ordinary characters on both sides of that
 * split — they occur inside an entity name (`catalog_place`) and inside a compound verb
 * (`role_changed`) — so the segment count decides, never the underscore.
 */
export function entityTypeForAction(action: PlatformAuditAction): PlatformAuditEntityType {
  const segments = action.split('.')
  const prefix = segments[0] === 'platform' ? `${segments[0]}.${segments[1]}` : segments[0]
  const entityType = entityTypeByPrefix[prefix]
  if (entityType === undefined) {
    throw new Error(`no entity_type is declared for action prefix "${prefix}"`)
  }
  return entityType
}

/* -------------------------------------------------------------------------------------------------
 * Inputs
 * ---------------------------------------------------------------------------------------------- */

const identifierSchema = z.string().trim().min(1).max(64)

const changeSideSchema = z.record(z.string(), z.unknown()).nullable()

/** `{ before, after }` — the fields that moved, on both sides (docs/ACCESS.md §4.1). */
const changesSchema: z.ZodType<PlatformAuditChanges> = z.object({
  before: changeSideSchema,
  after: changeSideSchema,
})

/**
 * The actor, validated into exactly the four shapes `platform_audit_log`'s `CHECK` constraints
 * accept, so a malformed attribution is refused here rather than by SQLite three frames later.
 *
 * `role` stays a free string on the two identified kinds because it is `user.role` verbatim — a
 * comma-joined column, per `src/server/auth/guard.ts` — and is narrowed to one of the three names
 * by `resolvePlatformRole` on the way into the row.
 */
const platformActorSchema = z.discriminatedUnion('actorKind', [
  z.object({
    actorKind: z.literal('human'),
    userId: identifierSchema,
    role: z.string().nullable(),
    tokenId: z.null(),
  }),
  z.object({
    actorKind: z.literal('agent'),
    userId: identifierSchema,
    role: z.string().nullable(),
    tokenId: identifierSchema,
  }),
  z.object({
    actorKind: z.literal('system'),
    userId: z.null(),
    role: z.null(),
    tokenId: z.null(),
  }),
])

/**
 * Three rules on one field, each of which the other two cannot express:
 * {@link AUDIT_ACTION_PATTERN} is the *shape* (imported, never re-declared — §4.2), `max(64)` is
 * §4.1's column bound, and the enum is the *closed list*. A name that is well-shaped and undeclared
 * is exactly the failure the vocabulary exists to prevent.
 *
 * The enum is the whole table's vocabulary rather than this phase's fifteen, because this module is
 * `platform_audit_log`'s single writer for the life of the product and the runtime rule guards the
 * *table*. The narrower rule — which names this phase's callers may spell — is a property of the
 * boundary type below, where a compiler can enforce it.
 */
const actionSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .regex(AUDIT_ACTION_PATTERN, 'must be a lowercase dotted action')
  .pipe(z.enum(PLATFORM_AUDIT_ACTIONS))

const platformAuditEntrySchema = z.object({
  action: actionSchema,
  /** The row the action touched. `null` only for an action whose entity does not exist yet. */
  entityId: identifierSchema.nullable(),
  changes: changesSchema.nullish(),
  /** The request IP, verbatim. */
  ip: z.string().trim().min(1).nullish(),
  /** The request's `User-Agent` header, verbatim, and nothing else. */
  userAgent: z.string().trim().min(1).nullish(),
})

/**
 * What a caller hands {@link appendPlatformAudit}.
 *
 * Every field is derived from {@link platformAuditEntrySchema} so the two cannot drift — except
 * `action`, which is narrowed from the schema's `string` input to the fifteen frozen names. That
 * narrowing is the point: a runtime enum is the wrong layer to catch a mistyped verb *here*, because
 * §4.3 requires this writer to swallow its own failures. Spell `platform.user.bannd` and the schema
 * rejects it, the rejection is reported to the logger, and the caller — whose ban has already
 * committed — returns success with no row behind it. The compiler is the only layer that can fail
 * loudly, so {@link PLATFORM_ACTIONS} is load-bearing at the call site rather than advisory.
 *
 * Faza C's `repo.ts` widens this union to the sixteen catalogue names in the commit that writes them;
 * {@link actionSchema} already accepts them, so that is one line here and no change to the validator.
 */
export type PlatformAuditEntryInput = Omit<z.input<typeof platformAuditEntrySchema>, 'action'> & {
  readonly action: PlatformActionName
}

/* -------------------------------------------------------------------------------------------------
 * The append
 * ---------------------------------------------------------------------------------------------- */

function buildRow(actor: PlatformActor, entry: PlatformAuditEntryInput): NewPlatformAuditLogEntry {
  const parsedActor = platformActorSchema.parse(actor)
  const parsed = platformAuditEntrySchema.parse(entry)
  return {
    actorUserId: parsedActor.userId,
    actorKind: parsedActor.actorKind,
    actorRole: parsedActor.actorKind === 'system' ? null : resolvePlatformRole(parsedActor.role),
    tokenId: parsedActor.tokenId,
    action: parsed.action,
    entityType: entityTypeForAction(parsed.action),
    entityId: parsed.entityId,
    changes: parsed.changes ?? null,
    ip: parsed.ip ?? null,
    userAgent: parsed.userAgent ?? null,
  }
}

function isAlwaysAudited(action: PlatformActionName): boolean {
  return ALWAYS_AUDITED_ACTIONS.some((candidate) => candidate === action)
}

/** The action and the actor, on every failure line, so the gap in the ledger is identifiable. */
function failureFields(actor: PlatformActor, entry: PlatformAuditEntryInput): LogFields {
  return {
    action: entry.action,
    entityId: entry.entityId,
    actorKind: actor.actorKind,
    actorUserId: actor.userId,
    actorRole: actor.role,
    tokenId: actor.tokenId,
  }
}

/**
 * Appends one row to `platform_audit_log`, and never throws.
 *
 * Call it **after** the mutation has committed. SPEC §5 asks for the entry "in the same call" as the
 * change, and docs/ACCESS.md §4.3 is precise about what that means: the same call, not the same
 * transaction. The row change commits, then the entry is appended, and a rejected append is logged
 * rather than raised — a caller whose work already succeeded is never handed a failure for it.
 *
 * Two severities, because the four verbs in {@link ALWAYS_AUDITED_ACTIONS} are audited "without
 * exception": for those the insert is attempted twice and a second failure is reported at `error`,
 * the highest level `Logger` has (there is no `fatal`). Everything else is attempted once and
 * reported at `warn`.
 */
export async function appendPlatformAudit(
  db: Database,
  actor: PlatformActor,
  entry: PlatformAuditEntryInput,
  logger: Logger,
): Promise<void> {
  const critical = isAlwaysAudited(entry.action)
  const report = (message: string, cause: unknown, fields: LogFields): void => {
    if (critical) {
      logger.error(message, cause, fields)
    } else {
      logger.warn(message, { ...fields, ...serializeError(cause) })
    }
  }

  let row: NewPlatformAuditLogEntry
  try {
    row = buildRow(actor, entry)
  } catch (cause) {
    report('platform audit entry rejected', cause, {
      ...failureFields(actor, entry),
      attempts: 0,
    })
    return
  }

  const maxAttempts = critical ? 2 : 1
  let lastCause: unknown
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await db.insert(platformAuditLog).values(row)
      return
    } catch (cause) {
      lastCause = cause
    }
  }

  report('platform audit append failed', lastCause, {
    ...failureFields(actor, entry),
    entityType: row.entityType,
    attempts: maxAttempts,
  })
}

/* -------------------------------------------------------------------------------------------------
 * Retention
 * ---------------------------------------------------------------------------------------------- */

/**
 * Drops entries older than {@link PLATFORM_AUDIT_RETENTION_DAYS} and returns how many went.
 *
 * The weekly retention cron is the only delete path this table has (docs/ACCESS.md §4.3). It selects
 * by `created_at` and by nothing else — no action, no actor, no entity — because a prune that can
 * filter is a prune that can be asked to remove one inconvenient row. It runs as
 * {@link PLATFORM_SYSTEM_ACTOR} and audits nothing about itself: how many rows it removed is a
 * structured log line, not a row in the table it just pruned.
 */
export async function prunePlatformAuditLog(
  db: Database,
  logger: Logger,
  options: { readonly now?: Date } = {},
): Promise<number> {
  const now = options.now ?? new Date()
  const cutoff = new Date(now.getTime() - PLATFORM_AUDIT_RETENTION_DAYS * DAY_MS)

  const removed = await db
    .delete(platformAuditLog)
    .where(lt(platformAuditLog.createdAt, cutoff))
    .returning({ id: platformAuditLog.id })

  logger.info('platform audit retention prune', {
    deleted: removed.length,
    retentionDays: PLATFORM_AUDIT_RETENTION_DAYS,
    cutoff: cutoff.toISOString(),
    actorKind: PLATFORM_SYSTEM_ACTOR.actorKind,
  })

  return removed.length
}
