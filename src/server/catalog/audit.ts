/**
 * Platform audit log — an append-only record of what happened *to the platform*, as opposed to what
 * happened inside a workspace.
 *
 * This module is the single writer of `platform_audit_log` (SPEC §5, docs/ACCESS.md §4). Rows are
 * never updated, and the only delete path is {@link prunePlatformAuditLog} for the retention cron.
 * An audit write must never be the reason a user's action fails, so callers append *after* the
 * mutation has committed and {@link appendPlatformAudit} swallows every failure it can raise — the
 * insert's, the validator's, and its own logging: a rejected append is a logging incident raised
 * through `src/server/observability`, never a `500` handed to the caller and never a rollback of
 * work that already succeeded. The prune is the one function here that may reject, because it runs
 * on a cron rather than behind a user's request: a weekly job that fails is meant to be visible and
 * retried, and there is no completed work of anyone's to protect.
 *
 * Two things this file deliberately does not do, both of them SPEC §5's carve-out in practice:
 *
 * - It takes a plain {@link Database} and an explicit {@link PlatformActor}, never a `TenantScope`.
 *   `platform_audit_log` carries no `organization_id`, so the tenant layer — whose whole purpose is
 *   to make a forgotten tenant filter inexpressible — cannot reach it, and handing that layer a
 *   fabricated context to get here would destroy the one guarantee it exists to give. Nothing in
 *   `src/server/catalog/**` *reaches* `src/server/repos/**` — not the tenant repository factory,
 *   not the barrel, not a deep module, not a relative path, and not through a module two hops
 *   away. That is a property of the module graph rather than of any file's text, so the guard
 *   beside this file walks the graph from every module in this directory, tests included, instead
 *   of grepping it: a grep can express a naming rule and cannot express reachability, and two
 *   successive spellings of it passed while the graph was growing. The shared dotted-action rule
 *   the two logs must not drift apart on (§4.2) comes from {@link AUDIT_ACTION_PATTERN} in
 *   `src/server/db/audit-action.ts`, a leaf module that imports nothing: reading it from the tenant
 *   log instead would satisfy §4.2 and quietly pull the tenant repository factory — which that
 *   module calls at evaluation time — into this file's module graph.
 * - It decides no authorisation. `requirePermission` in `src/server/auth/guard.ts` is the only place
 *   that answers "may this actor do this", and it performs no audit write of its own — a denied
 *   request changed nothing, and a log of attempts is a different table from a log of changes.
 */

import { and, desc, eq, inArray, lt } from 'drizzle-orm'
import { z } from 'zod'
import { resolvePlatformRole } from '#/server/auth/access'
import { AUDIT_ACTION_PATTERN } from '#/server/db/audit-action'
import {
  PLATFORM_AUDIT_ACTIONS,
  PLATFORM_AUDIT_ENTITY_TYPES,
  platformAuditLog,
} from '#/server/db/schema'
import { serializeError } from '#/server/observability'
import type { PlatformActor } from '#/server/auth/guard'
import type {
  Database,
  NewPlatformAuditLogEntry,
  PlatformAuditAction,
  PlatformAuditChanges,
  PlatformAuditEntityType,
  PlatformAuditLogEntry,
} from '#/server/db/types'
import type { LogFields, Logger } from '#/server/observability'

/* -------------------------------------------------------------------------------------------------
 * The vocabulary
 * ---------------------------------------------------------------------------------------------- */

/**
 * The console's own actions of docs/ACCESS.md §4.2, frozen: the fifteen three-segment
 * `platform.<entity>.<verb>` names, and the two `provider.*` names the metering screen writes.
 *
 * The list is closed: an eighteenth action here is an amendment to §4.2's table, made in the
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
  PROVIDER_LIMIT_CHANGED: 'provider.limit_changed',
  PROVIDER_POLICY_CHANGED: 'provider.policy_changed',
} as const satisfies Readonly<Record<string, PlatformAuditAction>>)

/** One of the seventeen names in {@link PLATFORM_ACTIONS}. */
export type PlatformActionName =
  (typeof PLATFORM_ACTIONS)[keyof typeof PLATFORM_ACTIONS]

/**
 * docs/ACCESS.md §4.2's prefix table: everything before the verb fixes the `entity_type` written
 * beside it, so §4.4's timeline query never has to guess which prefix belongs to which table.
 *
 * Nine rows, and the reason there are nine rather than thirty-three is that the mapping is a
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
  provider: 'provider',
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

/**
 * A {@link PlatformActor} narrowed to the kind docs/ACCESS.md §4.1 describes as "the platform
 * itself": no user, no role, no credential. The retention prune takes this rather than the wider
 * type, so the compiler refuses a human on the only delete path the table has and the runtime check
 * in {@link prunePlatformAuditLog} answers for callers a compiler cannot reach.
 */
export type PlatformSystemActor = PlatformActor & {
  readonly actorKind: 'system'
}

/** The platform acting on its own behalf — cron, matcher, prune (docs/ACCESS.md §4.1). */
export const PLATFORM_SYSTEM_ACTOR: PlatformSystemActor = Object.freeze({
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
const entityTypeByPrefix: Readonly<
  Record<string, PlatformAuditEntityType | undefined>
> = PLATFORM_AUDIT_ENTITY_BY_PREFIX

/**
 * The `entity_type` docs/ACCESS.md §4.2 pairs with an action.
 *
 * Two prefix forms and no third: a `platform.*` action's prefix is its first two segments, every
 * other action's prefix is its first. Underscores are ordinary characters on both sides of that
 * split — they occur inside an entity name (`catalog_place`) and inside a compound verb
 * (`role_changed`) — so the segment count decides, never the underscore.
 */
export function entityTypeForAction(
  action: PlatformAuditAction,
): PlatformAuditEntityType {
  const segments = action.split('.')
  const prefix =
    segments[0] === 'platform' ? `${segments[0]}.${segments[1]}` : segments[0]
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

/** An IPv6 address with a zone id is the longest thing this column can legitimately hold. */
const IP_MAX_LENGTH = 64

/**
 * The `User-Agent` bound, and it is deliberately not the tenant log's 200.
 *
 * docs/ACCESS.md §4.1 says this column holds the header verbatim, so the bound has to sit above
 * every header a real client sends or it turns ordinary traffic into rewritten evidence: current
 * browser strings run past 200 characters once client-hints-era fragments are appended, and the
 * tenant log's `shortTextSchema` caps a *form field* rather than a request header. 512 leaves that
 * headroom while still bounding the row.
 */
const USER_AGENT_MAX_LENGTH = 512

/** Keys per side of `changes`. A field list this long is a payload, not a diff. */
const CHANGES_MAX_KEYS = 32

/** Length of one key's *name*. Long enough for any field this product has, short enough to bound. */
const CHANGES_MAX_KEY_LENGTH = 64

/** Serialised length of any one value inside `changes`, which is where a long string arrives. */
const CHANGES_MAX_VALUE_LENGTH = 512

/** Serialised length of the whole `{ before, after }` payload, after every value is bounded. */
const CHANGES_MAX_SERIALISED_LENGTH = 16_384

/* -------------------------------------------------------------------------------------------------
 * Bounds
 *
 * Three fields arrive at a size this module does not control — `ip`, `user_agent` and `changes` —
 * and all three land in an append-only table with a 400-day window. Unbounded, one
 * `platform.user.updated` puts a header-sized row somewhere nothing will ever read it from again.
 *
 * Two rules govern how a bound is applied, and both exist because an earlier form of this broke
 * something docs/ACCESS.md states elsewhere:
 *
 * - **Never `NULL`.** §4.1 already gives `NULL` a meaning on both request columns — "the request
 *   sent none" on `user_agent`, `system` on `ip`. Writing a refused value as `NULL` makes the row
 *   assert something about the request that is not true, and the log line that would have explained
 *   it is gone long before the row is.
 * - **Never silently.** Whatever is written in place of an oversized value says so in the value
 *   itself, so a reader thirteen months later can tell a bounded field from one a client sent. The
 *   log line records the measurement as well, but the row does not depend on it.
 *
 * Together those give one behaviour: keep as much of the evidence as the bound allows, mark what
 * was done to it, and report it. A bound never costs the entry — §4.3 says the four ban and
 * impersonation verbs are audited without exception, and an entry dropped because a `User-Agent`
 * was long is exactly the gap that sentence forbids.
 * ---------------------------------------------------------------------------------------------- */

/** Marks a value this module shortened, and carries the length it shortened it from. */
function truncationMark(measured: number): string {
  return `…[truncated from ${measured} characters]`
}

/** Marks a value this module could not keep at all, written in place of the value. */
function refusalMark(reason: string, measured: number | null): string {
  return measured === null
    ? `[refused: ${reason}]`
    : `[refused: ${reason}, ${measured} characters]`
}

/** `value` cut to fit `limit` *including* the mark, so the bound holds on what is actually written. */
function truncateWithMark(value: string, limit: number): string {
  const mark = truncationMark(value.length)
  return `${value.slice(0, Math.max(0, limit - mark.length))}${mark}`
}

/**
 * A field that was measured and found too large, and what was measured — the log line's payload.
 *
 * A bound is never applied silently: it is one structured line naming the field, the reason, the
 * measurement and the limit, at the same severity a failed append of the same action would get.
 */
interface FieldRefusal {
  readonly field: string
  readonly reason: string
  readonly measured: number
  readonly limit: number
  /** Which part of `changes` it is about — `before`, or `before.displayName`. */
  readonly key?: string
  /** How many values the whole-payload bound had to replace, when that is what fired. */
  readonly replaced?: number
}

interface Bounded<T> {
  readonly value: T | null
  readonly refusal: FieldRefusal | null
}

/**
 * `ip` and `user_agent` arrive straight off the wire, so both are attacker-controlled text landing
 * in an append-only table with a 400-day window (docs/ACCESS.md §4.1).
 *
 * A value that trims to nothing is `NULL`, which is what §4.1 already says a missing header records.
 * A value past the bound keeps its head and gains a mark: the head is what identifies the client,
 * and the mark is what stops a shortened header reading, thirteen months later, as one somebody
 * actually sent. `NULL` is not available for that case — it is already spoken for.
 */
function boundRequestField(
  field: string,
  raw: string | null | undefined,
  limit: number,
): Bounded<string> {
  if (raw === null || raw === undefined) {
    return { value: null, refusal: null }
  }
  const trimmed = raw.trim()
  if (trimmed.length === 0) {
    return { value: null, refusal: null }
  }
  if (trimmed.length <= limit) {
    return { value: trimmed, refusal: null }
  }
  return {
    value: truncateWithMark(trimmed, limit),
    refusal: {
      field,
      reason: 'longer-than-column-bound',
      measured: trimmed.length,
      limit,
    },
  }
}

/**
 * `lib.es5.d.ts` types `JSON.stringify` as returning `string`, and it does not: `undefined`, a
 * function and a symbol all serialise to `undefined`. This says so in the signature, which is what
 * lets the caller handle that case without the compiler calling the check impossible.
 */
function serialise(value: unknown): string | undefined {
  return JSON.stringify(value)
}

/** `JSON.stringify` on a cycle, a `BigInt` or a throwing `toJSON` — length is unknowable, so −1. */
function serialisedLength(value: unknown): number {
  try {
    return serialise(value)?.length ?? 0
  } catch {
    return -1
  }
}

interface BoundedValue {
  readonly value: unknown
  readonly refusal: FieldRefusal | null
}

/**
 * One entry of one side of the diff.
 *
 * The key survives whatever happens to its value, and that is docs/ACCESS.md §4.4 in practice: the
 * before/after diff is why this log exists instead of a revision table, so "one field was too long"
 * must not cost the other nineteen — and must not cost the knowledge that this field moved either.
 * A long string keeps its head; anything else is replaced by a mark naming its size.
 */
function boundValue(which: string, key: string, value: unknown): BoundedValue {
  const measured = serialisedLength(value)

  if (measured < 0) {
    return {
      value: refusalMark('unserialisable value', null),
      refusal: {
        field: 'changes',
        key: `${which}.${key}`,
        reason: 'unserialisable-value',
        measured,
        limit: CHANGES_MAX_VALUE_LENGTH,
      },
    }
  }
  if (measured <= CHANGES_MAX_VALUE_LENGTH) {
    return { value, refusal: null }
  }

  return {
    value:
      typeof value === 'string'
        ? truncateWithMark(value, CHANGES_MAX_VALUE_LENGTH)
        : refusalMark('oversized value', measured),
    refusal: {
      field: 'changes',
      key: `${which}.${key}`,
      reason: 'value-longer-than-bound',
      measured,
      limit: CHANGES_MAX_VALUE_LENGTH,
    },
  }
}

interface BoundedSide {
  readonly value: Record<string, unknown>
  readonly refusals: ReadonlyArray<FieldRefusal>
}

/** One side of the diff, key by key, in the order the caller wrote them. */
function boundSide(which: string, side: Record<string, unknown>): BoundedSide {
  const refusals: Array<FieldRefusal> = []
  const named = Object.keys(side).filter((key) => {
    if (key.length <= CHANGES_MAX_KEY_LENGTH) {
      return true
    }
    refusals.push({
      field: 'changes',
      key: `${which}.${key.slice(0, CHANGES_MAX_KEY_LENGTH)}`,
      reason: 'key-name-longer-than-bound',
      measured: key.length,
      limit: CHANGES_MAX_KEY_LENGTH,
    })
    return false
  })

  if (named.length > CHANGES_MAX_KEYS) {
    // The one case where a key is lost rather than marked: there is nowhere to write a mark for a
    // key that is not in the object. A diff with this many fields on one side is a payload.
    refusals.push({
      field: 'changes',
      key: which,
      reason: 'too-many-keys',
      measured: named.length,
      limit: CHANGES_MAX_KEYS,
    })
  }

  const value: Record<string, unknown> = {}
  for (const key of named.slice(0, CHANGES_MAX_KEYS)) {
    const bounded = boundValue(which, key, side[key])
    value[key] = bounded.value
    if (bounded.refusal !== null) {
      refusals.push(bounded.refusal)
    }
  }

  return { value, refusals }
}

/**
 * The last-resort bound: thirty small values are as large as one big one.
 *
 * Values are replaced largest first, so the field most likely to be a payload goes before the fields
 * most likely to be a diff, and every replacement leaves the key behind with a mark on it. Each pass
 * marks one previously-unmarked key, so the loop is bounded by the key count and terminates.
 */
function fitSerialisedBound(
  changes: PlatformAuditChanges,
): Bounded<PlatformAuditChanges> {
  const measured = serialisedLength(changes)
  if (measured >= 0 && measured <= CHANGES_MAX_SERIALISED_LENGTH) {
    return { value: changes, refusal: null }
  }

  const sides: ReadonlyArray<
    readonly [string, Record<string, unknown> | null]
  > = [
    ['before', changes.before],
    ['after', changes.after],
  ]
  const marked = new Set<string>()
  let replaced = 0

  for (;;) {
    const length = serialisedLength(changes)
    if (length >= 0 && length <= CHANGES_MAX_SERIALISED_LENGTH) {
      break
    }

    let biggest: {
      which: string
      side: Record<string, unknown>
      key: string
      size: number
    } | null = null
    for (const [which, side] of sides) {
      if (side === null) {
        continue
      }
      for (const key of Object.keys(side)) {
        if (marked.has(`${which}.${key}`)) {
          continue
        }
        const size = serialisedLength(side[key])
        if (biggest === null || size > biggest.size) {
          biggest = { which, side, key, size }
        }
      }
    }
    if (biggest === null) {
      break
    }

    biggest.side[biggest.key] = refusalMark('payload bound', biggest.size)
    marked.add(`${biggest.which}.${biggest.key}`)
    replaced += 1
  }

  return {
    value: changes,
    refusal: {
      field: 'changes',
      reason: 'payload-longer-than-bound',
      measured,
      limit: CHANGES_MAX_SERIALISED_LENGTH,
      replaced,
    },
  }
}

interface BoundedChanges {
  readonly value: PlatformAuditChanges | null
  readonly refusals: ReadonlyArray<FieldRefusal>
}

/**
 * `changes` is the one field a caller fills with somebody else's text — a profile update carries the
 * name and the email the account typed — so it needs a bound on each key name, on each value, on the
 * key count and on the serialised whole.
 *
 * What it does *not* do is throw the diff away. An earlier form of this dropped the entire payload
 * because one value was too long, which discards the evidence docs/ACCESS.md §4.4 says this log
 * exists to hold, in order to avoid storing it. The offending value is bounded; every other key is
 * written untouched.
 */
function boundChanges(changes: PlatformAuditChanges | null): BoundedChanges {
  if (changes === null) {
    return { value: null, refusals: [] }
  }

  const before =
    changes.before === null ? null : boundSide('before', changes.before)
  const after =
    changes.after === null ? null : boundSide('after', changes.after)
  const fitted = fitSerialisedBound({
    before: before === null ? null : before.value,
    after: after === null ? null : after.value,
  })

  return {
    value: fitted.value,
    refusals: [
      ...(before === null ? [] : before.refusals),
      ...(after === null ? [] : after.refusals),
      ...(fitted.refusal === null ? [] : [fitted.refusal]),
    ],
  }
}

const changeSideSchema = z.record(z.string(), z.unknown()).nullable()

/** `{ before, after }` — the fields that moved, on both sides (docs/ACCESS.md §4.1). */
const changesSchema: z.ZodType<PlatformAuditChanges> = z.object({
  before: changeSideSchema,
  after: changeSideSchema,
})

/**
 * The platform acting on its own behalf: no user, no role, no credential.
 *
 * It is a schema of its own as well as a member of the union below, because the retention prune
 * takes this one rather than the union. SPEC §5 and docs/ACCESS.md §4.3 both say the only delete
 * path this table has runs as an `actor_kind: 'system'` actor, and a function that validates the
 * *shape* of an actor accepts any well-formed human on that path.
 */
const systemActorSchema = z.object({
  actorKind: z.literal('system'),
  userId: z.null(),
  role: z.null(),
  tokenId: z.null(),
})

/**
 * The actor, validated into exactly the three shapes `platform_audit_log`'s `CHECK` constraints
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
  systemActorSchema,
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

/**
 * The entry, validated for *shape*. Size is bounded after this, not in here, and on purpose: a
 * `max()` on these three fields would reject the whole entry, and for the four verbs of §4.3 a lost
 * entry is precisely the gap that section says must not exist. The bounds act on the value and keep
 * the row — see {@link FieldRefusal}.
 */
const platformAuditEntrySchema = z.object({
  action: actionSchema,
  /** The row the action touched. `null` only for an action whose entity does not exist yet. */
  entityId: identifierSchema.nullable(),
  changes: changesSchema.nullish(),
  /** The request IP, verbatim up to {@link IP_MAX_LENGTH} and marked past it. */
  ip: z.string().nullish(),
  /**
   * The request's `User-Agent` header and nothing else, verbatim up to
   * {@link USER_AGENT_MAX_LENGTH} and marked past it.
   */
  userAgent: z.string().nullish(),
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
export type PlatformAuditEntryInput = Omit<
  z.input<typeof platformAuditEntrySchema>,
  'action'
> & {
  readonly action: PlatformActionName
}

/* -------------------------------------------------------------------------------------------------
 * The append
 * ---------------------------------------------------------------------------------------------- */

interface BuiltRow {
  readonly row: NewPlatformAuditLogEntry
  /** The fields a bound had to act on, if any. The row is written with them marked. */
  readonly refusals: ReadonlyArray<FieldRefusal>
}

function buildRow(
  actor: PlatformActor,
  entry: PlatformAuditEntryInput,
): BuiltRow {
  const parsedActor = platformActorSchema.parse(actor)
  const parsed = platformAuditEntrySchema.parse(entry)

  const ip = boundRequestField('ip', parsed.ip, IP_MAX_LENGTH)
  const userAgent = boundRequestField(
    'userAgent',
    parsed.userAgent,
    USER_AGENT_MAX_LENGTH,
  )
  const changes = boundChanges(parsed.changes ?? null)

  return {
    row: {
      actorUserId: parsedActor.userId,
      actorKind: parsedActor.actorKind,
      actorRole:
        parsedActor.actorKind === 'system'
          ? null
          : resolvePlatformRole(parsedActor.role),
      tokenId: parsedActor.tokenId,
      action: parsed.action,
      entityType: entityTypeForAction(parsed.action),
      entityId: parsed.entityId,
      changes: changes.value,
      ip: ip.value,
      userAgent: userAgent.value,
    },
    refusals: [
      ...[ip.refusal, userAgent.refusal].filter(
        (refusal): refusal is FieldRefusal => refusal !== null,
      ),
      ...changes.refusals,
    ],
  }
}

function isAlwaysAudited(action: PlatformActionName): boolean {
  return ALWAYS_AUDITED_ACTIONS.some((candidate) => candidate === action)
}

/**
 * Emits a log line, and never throws — the last link in this module's "never a `500`" promise.
 *
 * A `Logger` writes through a {@link LogSink}, and a sink that throws is the ordinary way a logging
 * backend fails. Left unguarded, the failure path of an audit append would itself reject and hand
 * the caller the error the append exists to avoid, which is the same defect one layer down. There is
 * nowhere left to report to at this point, so the throw is dropped: the caller's work committed, and
 * a logging backend that cannot log is its own alarm.
 */
function emitSafely(write: () => void): void {
  try {
    write()
  } catch {
    // Deliberately empty — see above. Re-raising here is the failure this module exists to prevent.
  }
}

/** The action and the actor, on every failure line, so the gap in the ledger is identifiable. */
function failureFields(
  actor: PlatformActor,
  entry: PlatformAuditEntryInput,
): LogFields {
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
 *
 * `ip`, `user_agent` and `changes` are bounded, and an oversized one costs that *value* rather than
 * the entry or the rest of the diff: it is shortened or replaced by a mark that says so, one line at
 * the same severity records what was measured and why, and the row is written with the mark in
 * place. None of that is optional — an unbounded field is a header-sized row in a table that keeps
 * it for 400 days, a silently shortened one is evidence this module rewrote, and a `NULL` one claims
 * the request sent nothing (docs/ACCESS.md §4.1) when it in fact sent too much.
 */
export async function appendPlatformAudit(
  db: Database,
  actor: PlatformActor,
  entry: PlatformAuditEntryInput,
  logger: Logger,
): Promise<void> {
  const critical = isAlwaysAudited(entry.action)
  const report = (
    message: string,
    fields: LogFields,
    cause?: unknown,
  ): void => {
    emitSafely(() => {
      if (critical) {
        logger.error(message, cause, fields)
      } else {
        logger.warn(
          message,
          cause === undefined
            ? fields
            : { ...fields, ...serializeError(cause) },
        )
      }
    })
  }

  let built: BuiltRow
  try {
    built = buildRow(actor, entry)
  } catch (cause) {
    report(
      'platform audit entry rejected',
      { ...failureFields(actor, entry), attempts: 0 },
      cause,
    )
    return
  }

  // A bounded field is recorded before the insert is attempted, so the line exists even if the
  // append then fails: the two are separate incidents, and the mark left in the row has to be
  // explainable on its own thirteen months later.
  for (const refusal of built.refusals) {
    report('platform audit field bounded', {
      ...failureFields(actor, entry),
      boundedField: refusal.field,
      boundedKey: refusal.key,
      reason: refusal.reason,
      measured: refusal.measured,
      limit: refusal.limit,
      replaced: refusal.replaced,
    })
  }

  const row = built.row

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

  report(
    'platform audit append failed',
    {
      ...failureFields(actor, entry),
      entityType: row.entityType,
      attempts: maxAttempts,
    },
    lastCause,
  )
}

/* -------------------------------------------------------------------------------------------------
 * Reads
 * ---------------------------------------------------------------------------------------------- */

/**
 * One ledger row, exactly as `platform_audit_log` stores it.
 *
 * Deliberately not a projection: this module owns the statement, not the screen. Turning a `Date`
 * into a string, a role into a badge or a `changes` payload into a diff are all presentation, and
 * every one of them belongs above the read rather than inside the only place the table is queried.
 */
export type PlatformAuditEntityRow = Pick<
  PlatformAuditLogEntry,
  | 'id'
  | 'action'
  | 'entityType'
  | 'actorKind'
  | 'actorRole'
  | 'actorUserId'
  | 'createdAt'
  | 'changes'
>

/** How the timeline is asked for. Bounded here so no caller can ask for the whole table. */
export interface PlatformAuditEntityQuery {
  readonly entityType: PlatformAuditEntityType
  readonly entityId: string
  /** Rows to return, 1 to {@link PLATFORM_AUDIT_READ_MAX}. Ask for one more than you show. */
  readonly limit: number
}

/**
 * The ceiling on one timeline page.
 *
 * The table is append-only and only ever grows, so an unbounded read of one entity's history is a
 * statement whose size is decided by how long the product has been running. Fifty is far above what
 * any screen shows and far below what would materialise a page nobody scrolls.
 */
export const PLATFORM_AUDIT_READ_MAX = 50

const auditEntityQuerySchema = z.object({
  entityType: z.enum(PLATFORM_AUDIT_ENTITY_TYPES),
  entityId: z.string().trim().min(1).max(128),
  limit: z.number().int().min(1).max(PLATFORM_AUDIT_READ_MAX),
})

/**
 * docs/ACCESS.md §4.4's timeline query — the read this table exists for.
 *
 * One `select`, one table, no join: `platform_audit_log` filtered by `(entity_type, entity_id)` and
 * ordered newest first, which is precisely what `platform_audit_log_entity_idx` was created to
 * serve. It lives here because SPEC §6 puts every statement against the eleven global tables in this
 * directory and nowhere else, beside {@link appendPlatformAudit} — the append and the timeline are
 * two halves of one table's contract, and splitting them across layers is how the ordering below
 * ends up restated somewhere it can drift.
 *
 * `id` breaks the tie on `created_at`. That column is a millisecond stamp, and two rows written by
 * the same call share it — without the tiebreak the two halves of a password reset swap places
 * between renders of the same page.
 *
 * **It decides no authorisation and writes no row.** `requirePermission` has answered before the
 * caller reached this (SPEC §5), and §4.2 closes the audit vocabulary at thirty-one *mutations* —
 * reads are not among them, so reading the ledger does not append to it.
 */
export async function readPlatformAuditByEntity(
  db: Database,
  query: PlatformAuditEntityQuery,
): Promise<ReadonlyArray<PlatformAuditEntityRow>> {
  const { entityType, entityId, limit } = auditEntityQuerySchema.parse(query)

  return db
    .select({
      id: platformAuditLog.id,
      action: platformAuditLog.action,
      entityType: platformAuditLog.entityType,
      actorKind: platformAuditLog.actorKind,
      actorRole: platformAuditLog.actorRole,
      actorUserId: platformAuditLog.actorUserId,
      createdAt: platformAuditLog.createdAt,
      changes: platformAuditLog.changes,
    })
    .from(platformAuditLog)
    .where(
      and(
        eq(platformAuditLog.entityType, entityType),
        eq(platformAuditLog.entityId, entityId),
      ),
    )
    .orderBy(desc(platformAuditLog.createdAt), desc(platformAuditLog.id))
    .limit(limit)
}

/* -------------------------------------------------------------------------------------------------
 * Retention
 * ---------------------------------------------------------------------------------------------- */

/**
 * Rows per statement. The sibling cron in the same `switch` — `sweepReminders` — is bounded at the
 * same number, and for the same reason: a weekly job must not size its statement off a backlog.
 */
export const PLATFORM_AUDIT_PRUNE_BATCH_SIZE = 200

/**
 * Statements per run: 250 of them, so one weekly invocation removes at most 50 000 rows.
 *
 * The number is a rate, not a size. The prune has to remove at least a week's writes every week or
 * the table grows past its 400-day window for ever, so the ceiling is what decides the busiest
 * platform this schedule can serve: 50 000 a week is a sustained 7 100 audit rows a day, which is
 * far above any volume the console, the catalogue and the MCP surface produce together. The earlier
 * 10 000 was a sustained 1 430 a day, which a bulk catalogue import can exceed on its own.
 *
 * Raising it costs nothing the bound was protecting against, because the bound that matters is
 * {@link PLATFORM_AUDIT_PRUNE_BATCH_SIZE}: each statement still names at most 200 ids, so no single
 * query grows with the backlog. What grows is the number of sequential D1 round trips — 250 of them
 * at a few milliseconds each, on a cron with no user waiting on it, and almost no CPU because only
 * 200 ids are materialised at a time.
 *
 * A run that still hits the cap reports `drained: false`, and docs/ARCHITECTURE.md §9 names that as
 * a number worth alerting on — so {@link prunePlatformAuditLog} raises it at `error` rather than
 * leaving it as one field in a weekly `info` line nobody reads.
 */
export const PLATFORM_AUDIT_PRUNE_MAX_BATCHES = 250

export interface PrunePlatformAuditLogResult {
  /** Rows removed by this run. */
  readonly deleted: number
  /** Statements issued. */
  readonly batches: number
  /** `false` when the run stopped at {@link PLATFORM_AUDIT_PRUNE_MAX_BATCHES} with rows still due. */
  readonly drained: boolean
}

/**
 * Drops entries older than {@link PLATFORM_AUDIT_RETENTION_DAYS} and reports what it removed.
 *
 * The weekly retention cron is the only delete path this table has (docs/ACCESS.md §4.3). It selects
 * by `created_at` and by nothing else — no action, no actor, no entity — because a prune that can
 * filter is a prune that can be asked to remove one inconvenient row. It audits nothing about
 * itself: how many rows it removed is a structured log line, not a row in the table it just pruned.
 *
 * It takes an explicit {@link PlatformActor} like every other write on this path (SPEC §5) and
 * refuses one that is not `actor_kind: 'system'` — {@link PLATFORM_SYSTEM_ACTOR} is the only actor
 * this function has. §4.3 states that property of the only delete path an append-only table has,
 * and a function that validates an actor's *shape* accepts any well-formed human on it. There is no
 * HTTP route here today, so this is defence in depth rather than a live hole; it is asserted
 * because Faza E puts a console surface within reach of everything on this module.
 *
 * The delete is batched. An unbounded `DELETE … RETURNING id` materialises every removed id into the
 * isolate purely to obtain a count, so a backlog from a bulk import or a burst of `agent` rows would
 * size the statement rather than the schedule doing it. Each batch names its own ids through a
 * bounded sub-select, so partial progress survives a failure part-way through and the next tick
 * carries on from there.
 */
export async function prunePlatformAuditLog(
  db: Database,
  actor: PlatformSystemActor,
  logger: Logger,
  options: {
    readonly now?: Date
    readonly batchSize?: number
    readonly maxBatches?: number
  } = {},
): Promise<PrunePlatformAuditLogResult> {
  const parsedActor = systemActorSchema.parse(actor)
  const now = options.now ?? new Date()
  const cutoff = new Date(
    now.getTime() - PLATFORM_AUDIT_RETENTION_DAYS * DAY_MS,
  )
  const batchSize = options.batchSize ?? PLATFORM_AUDIT_PRUNE_BATCH_SIZE
  const maxBatches = options.maxBatches ?? PLATFORM_AUDIT_PRUNE_MAX_BATCHES

  let deleted = 0
  let batches = 0
  let drained = false

  while (batches < maxBatches) {
    const removed = await db
      .delete(platformAuditLog)
      .where(
        inArray(
          platformAuditLog.id,
          db
            .select({ id: platformAuditLog.id })
            .from(platformAuditLog)
            .where(lt(platformAuditLog.createdAt, cutoff))
            .limit(batchSize),
        ),
      )
      .returning({ id: platformAuditLog.id })

    batches += 1
    deleted += removed.length

    if (removed.length < batchSize) {
      drained = true
      break
    }
  }

  emitSafely(() => {
    const fields: LogFields = {
      deleted,
      batches,
      drained,
      batchSize,
      maxBatches,
      retentionDays: PLATFORM_AUDIT_RETENTION_DAYS,
      cutoff: cutoff.toISOString(),
      actorKind: parsedActor.actorKind,
      actorUserId: parsedActor.userId,
    }

    if (drained) {
      logger.info('platform audit retention prune', fields)
      return
    }

    // docs/ARCHITECTURE.md §9: `drained: false` is the signal that the ceiling has stopped being a
    // safety margin and started being a leak — the table is now growing past its retention window
    // and every following week will look the same. Raised at `error` so it is an alertable line
    // rather than a field inside a routine weekly `info`.
    logger.error(
      'platform audit retention prune did not drain',
      undefined,
      fields,
    )
  })

  return { deleted, batches, drained }
}
