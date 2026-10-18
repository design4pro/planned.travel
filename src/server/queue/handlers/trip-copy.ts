/**
 * `trip-copy` — the half of a trip copy that scales with the source (PRD #104 decisions 4a, 4b, 6, 9).
 *
 * `copyTripFn` mints the target trip inside one round trip and returns; everything that grows with
 * the source's inventory happens here, because `places` is `UNLIMITED` on every paid tier and
 * duplicating a twenty-thousand-place trip is an unbounded write.
 *
 * ## What the envelope may and may not decide
 *
 * The envelope names the organization, the two trips and the requester, and nothing else. The scope
 * is **rebuilt, never carried**: the organization comes from the envelope, the role is read from
 * `member` inside that tenant through a lowest-privilege probe, and every statement the copy then
 * runs is `tenantFilter()`-bound to the same organization — so a forged message can only copy rows
 * its own tenant already holds. This is the posture `travel-stats` set, for the same reasons.
 *
 * ## Permanent, transient, and what each leaves behind
 *
 * Three failures can never succeed on retry, and all three end with the half-built target deleted:
 * the requester is no longer a member, one of the two trips is gone, and the `places` ceiling was
 * crossed by a concurrent write after the copy was admitted. Everything else — a D1 error, a
 * registered copier throwing — is transient: the handler rethrows, the queue redelivers, and the
 * next attempt clears whatever this one wrote into the target and copies again.
 *
 * ## Why the stamp is cleared last
 *
 * `copy_pending_at` is this handler's final write, after the statistics envelopes and the completion
 * notification. Clearing it as the copy's own last pass would make a crash between the clear and the
 * notification unrecoverable: the redelivery would find a null stamp, return early, and the reader
 * would never learn the copy finished. Both repeated effects are idempotent — the `travel-stats`
 * envelopes carry `00-S4`'s deterministic `(user, year)` ids, and the completion notification is
 * folded on the entity through `listForEntity` — so a redelivery costs a second copy and never a
 * second inbox row.
 */

import { drizzle } from 'drizzle-orm/d1'
import { isOrganizationRole } from '#/server/auth/tenant'
import {
  NotFoundError,
  QuotaExceededError,
  copyTripContents,
  createScope,
  deleteTrip,
  finishTripCopy,
  getMembership,
  listForEntity,
  listTripMembers,
  notify,
  requireTrip,
} from '#/server/repos'
import { copyObject } from '#/server/storage/objects'
import { storageKeyFor } from '#/server/fns/file-policy'
import { coverUrlFor, fileIdOfStorageKey } from '#/lib/trip-cover'
import { QUEUE_BATCH_MAX, enqueueTasks } from '../jobs'
import { recomputeDelaySeconds, travelStatsTaskId } from './travel-stats'
import {
  ALL_TIME_STAT_YEAR,
  TaskConfigurationError,
  TaskPermanentError,
  isCalendarStatYear,
} from '../types'
import { serializeError } from '#/server/observability'

import type { Database, Trip } from '#/server/db/types'
import type { FinishTripCopyInput, TenantScope } from '#/server/repos'
import type { EnqueueInput } from '../jobs'
import type {
  TaskContext,
  TaskHandler,
  TaskMetrics,
  TripCopyPayload,
} from '../types'
import type { DatabaseFor } from './travel-stats'

/**
 * The notification key a finished copy writes, and the one `listForEntity` folds on.
 *
 * A notification stores the catalogue key without its namespace or its `.title`/`.body` suffix —
 * the renderer adds both — so this single constant is what is written and what is looked for.
 */
export const TRIP_COPIED_KEY = 'trip.copied'

/** The key a copy that could not finish writes to the requester's inbox. */
export const TRIP_COPY_FAILED_KEY = 'trip.copyFailed'

/** The envelope id for one copy. Deterministic on the target, which the producer has just minted. */
export function tripCopyTaskId(targetTripId: string): string {
  return `trip-copy:${targetTripId}`
}

/**
 * The scope the copy runs under: the envelope's organization, the requester, and the role that
 * requester actually holds there.
 *
 * The role is never taken from the message. Reading it needs a scope of its own, so the membership
 * read is made at the lowest privilege there is — `getMembership` is a tenant-filtered `findOne`
 * that asserts no role, so the probe can only ever see the row that decides the real one.
 */
function scopeFor(
  db: Database,
  organizationId: string,
  userId: string,
  role: string,
): TenantScope {
  return createScope(db, {
    userId,
    organizationId,
    // An unrecognised value in the column resolves to the least privilege, never to "unset,
    // therefore permissive".
    role: isOrganizationRole(role) ? role : 'member',
    impersonatedBy: null,
  })
}

/**
 * The target's cover key, minted by the same `storageKeyFor` every other object in this product
 * goes through — so the copy's key carries the organization in its second segment and stays inside
 * the namespace `trip-purge` checks before it deletes anything.
 *
 * A cover key is `trips/<org>/<trip>/<fileId>-<filename>` and only the trip segment changes, so the
 * source's own last segment is split back into the two parts the minter takes. `null` for a key that
 * does not have that shape or names another organization: a key this handler cannot place inside the
 * target's own namespace is one it declines to copy rather than guess at.
 */
export function coverKeyFor(
  organizationId: string,
  targetTripId: string,
  sourceKey: string,
): string | null {
  const segments = sourceKey.split('/')
  const name = segments.at(3)
  if (
    segments.length !== 4 ||
    segments.at(0) !== 'trips' ||
    segments.at(1) !== organizationId ||
    name === undefined
  ) {
    return null
  }
  const separator = name.indexOf('-')
  if (separator <= 0) {
    return null
  }
  return storageKeyFor({
    organizationId,
    tripId: targetTripId,
    fileId: name.slice(0, separator),
    filename: name.slice(separator + 1),
  })
}

/**
 * Duplicates the source's cover object, and answers with what the target should record.
 *
 * **A cover failure is tolerated** (spec Q6): a missing cover is cosmetic, and deleting a fully
 * copied trip over it — or retrying an entire inventory copy for it — are both larger harms than
 * the loss. Logged once; the copy completes and the tile falls back to the shipped `CoverArt`.
 */
async function copyCover(
  context: TaskContext,
  source: Trip,
  targetTripId: string,
): Promise<FinishTripCopyInput> {
  const sourceKey = source.coverImageKey
  if (sourceKey === null || sourceKey === '') {
    return {}
  }
  const targetKey = coverKeyFor(context.orgId, targetTripId, sourceKey)
  if (targetKey === null) {
    context.logger.warn('a trip cover key was not copied', {
      tripId: targetTripId,
      reason: 'unrecognised key shape',
    })
    return {}
  }

  // The target's own URL, never the source's: the cover route reads the key off the trip it is asked
  // about, so a copied URL would show the source's picture, or a 404 once the source is gone. Both
  // inputs are checked before any byte moves, so a refusal leaves no object behind.
  const fileId = fileIdOfStorageKey(targetKey)
  const origin = context.env.APP_URL
  if (fileId === null || origin === undefined || origin === '') {
    context.logger.warn('a trip cover was not copied', {
      tripId: targetTripId,
      reason: fileId === null ? 'no file id in the key' : 'no app origin',
    })
    return {}
  }

  try {
    await copyObject(context.env.FILES, sourceKey, targetKey)
    return {
      coverImageKey: targetKey,
      coverImageUrl: coverUrlFor(origin, targetTripId, fileId),
    }
  } catch (cause) {
    context.logger.warn('a trip cover was not copied', {
      tripId: targetTripId,
      ...serializeError(cause),
    })
    return {}
  }
}

/**
 * Fans `travel-stats` envelopes out to the target trip's members, for the years the copy moved.
 *
 * The recipient set is the **trip's** members and not the workspace (decision 9): a private trip is
 * invisible to a non-member, so its statistics must be too. For a fresh copy that set is one person,
 * which is why this is cheap — the chunk loop is there for the producer's shape, not its current
 * cardinality.
 *
 * `src/routes/_app/-server/trip-lifecycle.ts` has a fan-out of its own and this is not it: a queue
 * handler cannot import a route module, which is the layering that keeps `createServerFn` out of the
 * consumer's module graph. The two share `travelStatsTaskId`, which is the part that has to agree.
 *
 * A queue refusal never fails the copy: D1 already holds the rows, and a stale statistics panel is a
 * much smaller harm than a copy that dead-letters after it succeeded.
 */
async function enqueueTravelStats(
  scope: TenantScope,
  context: TaskContext,
  target: Trip,
): Promise<void> {
  const orgId = context.orgId
  const at = context.now()
  const startYear = Number(target.startDate?.slice(0, 4))
  const years = isCalendarStatYear(startYear)
    ? [ALL_TIME_STAT_YEAR, startYear]
    : [ALL_TIME_STAT_YEAR]

  try {
    const members = await listTripMembers(scope, target.id)
    const envelopes: Array<EnqueueInput<'travel-stats'>> = []
    for (const userId of new Set(members.map((member) => member.userId))) {
      for (const statYear of years) {
        envelopes.push({
          kind: 'travel-stats',
          orgId,
          id: travelStatsTaskId(orgId, userId, statYear, at),
          payload: { userId, statYear },
          delaySeconds: recomputeDelaySeconds(at),
        })
      }
    }
    for (let index = 0; index < envelopes.length; index += QUEUE_BATCH_MAX) {
      await enqueueTasks(
        context.env.TASKS,
        envelopes.slice(index, index + QUEUE_BATCH_MAX),
      )
    }
  } catch (cause) {
    context.logger.warn('travel statistics were not enqueued for a trip copy', {
      tripId: target.id,
      ...serializeError(cause),
    })
  }
}

/**
 * Writes the completion notification, unless this trip already has one.
 *
 * The fold is on the entity rather than on a marker of its own: `listForEntity` exists for exactly
 * this ("used to fold duplicates before sending a new one"), and a redelivery that redid the copy
 * must still leave the requester with one row rather than two.
 */
async function notifyCopied(
  scope: TenantScope,
  target: Trip,
  requestedBy: string,
  counts: { days: number; places: number; dropped: number },
): Promise<boolean> {
  const existing = await listForEntity(scope, 'trip', target.id)
  if (existing.some((row) => row.titleKey === TRIP_COPIED_KEY)) {
    return false
  }
  await notify(scope, {
    recipientUserId: requestedBy,
    type: 'navigate',
    scope: 'trip',
    entityType: 'trip',
    entityId: target.id,
    titleKey: TRIP_COPIED_KEY,
    titleParams: { tripTitle: target.title },
    bodyKey: TRIP_COPIED_KEY,
    bodyParams: {
      tripTitle: target.title,
      days: counts.days,
      places: counts.places,
      dropped: counts.dropped,
    },
    actionUrl: `/trips/${target.id}`,
  })
  return true
}

/**
 * The permanent classes, named rather than inferred.
 *
 * `NotFoundError` is either trip having gone since the copy was admitted, and `QuotaExceededError`
 * is the `places` ceiling crossed by a concurrent write — neither is a different answer on the fifth
 * attempt. Everything else is transient by default, which is the safe direction: a copy retried
 * needlessly costs one more pass, a copy abandoned wrongly costs the reader their plan.
 */
function isPermanentCopyFailure(error: unknown): boolean {
  return error instanceof NotFoundError || error instanceof QuotaExceededError
}

/**
 * Deletes the half-built target and tells the requester, which is what every permanent failure does.
 *
 * The delete cascades, so nothing the failed attempt wrote survives it. Both steps are guarded: a
 * cleanup that throws would turn a permanent failure into a retried one, and the message is already
 * on its way to the dead-letter record that carries the real cause.
 */
async function discardTarget(
  scope: TenantScope,
  context: TaskContext,
  targetTripId: string,
  requestedBy: string,
  title: string | null,
): Promise<void> {
  try {
    await deleteTrip(scope, targetTripId)
  } catch (cause) {
    context.logger.warn('a failed trip copy could not be cleaned up', {
      tripId: targetTripId,
      ...serializeError(cause),
    })
  }
  if (title === null) {
    return
  }
  try {
    await notify(scope, {
      recipientUserId: requestedBy,
      type: 'info',
      scope: 'trip',
      entityType: 'trip',
      entityId: targetTripId,
      titleKey: TRIP_COPY_FAILED_KEY,
      titleParams: { tripTitle: title },
      bodyKey: TRIP_COPY_FAILED_KEY,
      bodyParams: { tripTitle: title },
    })
  } catch (cause) {
    context.logger.warn('a failed trip copy was not announced', {
      tripId: targetTripId,
      ...serializeError(cause),
    })
  }
}

/**
 * Builds the handler over a database seam. {@link handleTripCopy} is the one the consumer registers;
 * a test builds its own against the harness. The seam exists because `src/server/db/client.ts` reads
 * the ambient Worker environment at module scope, and `consumer.ts` — which imports every handler —
 * has to stay loadable in the plain-Node `server` Vitest project.
 */
export function createTripCopyHandler(
  databaseFor: DatabaseFor = (binding) => drizzle(binding),
): TaskHandler<'trip-copy'> {
  return async function tripCopy(
    payload: TripCopyPayload,
    context: TaskContext,
  ): Promise<TaskMetrics> {
    const binding = context.env.DB
    if (binding === undefined) {
      throw new TaskConfigurationError(
        'DB binding is not available to the queue consumer; a trip copy cannot run',
      )
    }

    const { sourceTripId, targetTripId, requestedBy } = payload
    const db = databaseFor(binding)
    const probe = scopeFor(db, context.orgId, requestedBy, 'member')
    const membership = await getMembership(probe, requestedBy)
    if (membership === null) {
      // The requester has left the workspace. The target is theirs and nobody else's, so it goes
      // with them; the notification does not, because an inbox they can no longer reach is not
      // where this is told.
      await discardTarget(probe, context, targetTripId, requestedBy, null)
      throw new TaskPermanentError(
        `User ${requestedBy} is no longer a member of ${context.orgId}; the trip copy is abandoned`,
      )
    }
    const scope = scopeFor(db, context.orgId, requestedBy, membership.role)

    // Read through the same classifier as everything else. A `NotFoundError` here means the target
    // has gone since the copy was admitted, which is permanent and gets the cleanup every permanent
    // path gets; a D1 hiccup is transient and has to rethrow untouched, so the queue redelivers.
    // Converting it wholesale would dead-letter the job without consuming a retry and without
    // clearing `copy_pending_at`, leaving the reader a trip stuck on "Copying" for good.
    const target = await requireTrip(scope, targetTripId).catch(
      async (cause: unknown) => {
        if (!isPermanentCopyFailure(cause)) {
          throw cause
        }
        await discardTarget(scope, context, targetTripId, requestedBy, null)
        throw new TaskPermanentError(
          `Trip ${targetTripId} is gone; there is nothing left to copy into`,
          { cause },
        )
      },
    )
    if (target.copyPendingAt === null) {
      // The stamp is the handler's last write, so a null one means the rows, the statistics
      // envelopes and the notification have all landed. This delivery is a repeat of a finished job.
      context.logger.debug('trip copy already finished; acking redelivery', {
        tripId: targetTripId,
      })
      return { tripId: targetTripId, copied: false }
    }

    try {
      // Read inside the guard: a source that has gone since the copy was admitted is the permanent
      // path rather than an unclassified rejection.
      const source = await requireTrip(scope, sourceTripId)
      const result = await copyTripContents(scope, sourceTripId, targetTripId)
      const cover = await copyCover(context, source, targetTripId)
      await enqueueTravelStats(scope, context, target)
      const notified = await notifyCopied(scope, target, requestedBy, {
        days: result.days,
        places: result.places,
        dropped: result.droppedNotes,
      })
      await finishTripCopy(scope, targetTripId, cover)

      return {
        tripId: targetTripId,
        copied: true,
        days: result.days,
        places: result.places,
        assignments: result.assignments,
        unscheduled: result.unscheduled,
        notes: result.notes,
        droppedNotes: result.droppedNotes,
        copiers: result.extras.length,
        notified,
      }
    } catch (cause) {
      if (!isPermanentCopyFailure(cause)) {
        throw cause
      }
      await discardTarget(
        scope,
        context,
        targetTripId,
        requestedBy,
        target.title,
      )
      throw new TaskPermanentError(
        `Trip ${targetTripId} could not be copied from ${sourceTripId}; the copy was discarded`,
        { cause },
      )
    }
  }
}

/** The handler `consumer.ts` registers, over the Worker's own D1 binding. */
export const handleTripCopy = createTripCopyHandler()
