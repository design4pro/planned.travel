/**
 * The pre-departure reminder sweep — the quarter-hourly cron's only job.
 *
 * ADR 0005 chose a scan over a schedule. Nothing registers a reminder when a trip is written:
 * `src/server/catalog/reminders.ts` asks D1 which trips are due right now, and this module turns
 * each answer into a notification through the dispatch layer `00-S2` built. **A scheduler call
 * added to a write path is a defect, not an optimisation** — the scan reads the current rows, so a
 * moved start date is simply a different due instant on the next tick, and there is no stored copy
 * of a date to cancel, rewrite or leak.
 *
 * What the module before this one did instead, and why none of it survives: it built a KV key whose
 * zero-padded due time sorted lexicographically, and `scheduleReminder`/`cancelReminder` had zero
 * callers anywhere in `src/`. The sweep therefore ran every fifteen minutes over an empty index and
 * had never delivered anything. Its unchunked `enqueueTasks` — the landmine
 * `docs/plans/00-foundations.md` records — goes with it: dispatch owns the fan-out now and chunks
 * against the limits each half actually has.
 *
 * ## The four decisions
 *
 * - **The marker is KV, and losing it is survivable.** `reminded:<orgId>:<tripId>:<dueInstant>` is
 *   written only *after* dispatch returns, so a tick that dies mid-flight retries rather than
 *   swallowing the reminder. KV is eventually consistent and can fail outright; when it does, the
 *   sweep proceeds and the queue's own idempotency key — the envelope id — is what stops a second
 *   email. The in-app row is the part that can duplicate, which is the cheaper of the two failures.
 * - **The scope belongs to a real member, never to the sweep.** There is no session behind a cron,
 *   so the identity is resolved from the trip: the owner membership if the trip has one, any member
 *   otherwise, and a trip with no members is skipped rather than reminded as nobody. See
 *   {@link scopeForTrip} for the one fabricated value in the path and what bounds it.
 * - **The event carries no actor.** A reminder excludes nobody, and `dispatch` drops the actor from
 *   the recipient set — an actor here would silently deny the trip's owner their own reminder.
 * - **Failures isolate per trip.** One workspace whose membership rows are broken must not cost
 *   every other workspace its morning.
 */

import { drizzle } from 'drizzle-orm/d1'

import { isOrganizationRole } from '#/server/auth/tenant'
import { listDueTripReminders, reminderDueAt } from '#/server/catalog/reminders'
import { dispatch } from '#/server/notifications/dispatch'
import { serializeError } from '#/server/observability'
import {
  createScope,
  getMembership,
  listTripMembers,
  requireTrip,
} from '#/server/repos'

import type {
  DueTripReminder,
  ReminderScanOptions,
} from '#/server/catalog/reminders'
import type { Database } from '#/server/db/types'
import type { DispatchDeps } from '#/server/notifications/dispatch'
import type { Logger } from '#/server/observability'
import type { TenantScope } from '#/server/repos'
import type { TaskBindings } from './types'

/* -------------------------------------------------------------------------------------------------
 * Names
 * ---------------------------------------------------------------------------------------------- */

export const REMINDER_MARKER_PREFIX = 'reminded:'

/**
 * How long a marker outlives the window it closes.
 *
 * The window itself is 24 hours, so anything past a day is only insurance against a clock or a
 * redelivery far out of order. Thirty days is the same order as the queue's own dead-letter
 * retention and costs one small KV value per reminder actually sent.
 */
export const REMINDER_MARKER_TTL_SECONDS = 30 * 24 * 60 * 60

/**
 * The notification kind — one name doing all four of this event's jobs at once.
 *
 * It is the `eventType` the preference table is keyed by, so switching "Departure reminders" off
 * in notification settings switches off exactly these; it is the catalogue key the sentence
 * renders from (`shell.notification.trip.starting_soon.*`, shipped in all twenty-three locales
 * and already taking `{tripTitle}` and a plural `{days}`), so `titleKey`/`bodyKey` are simply left
 * to default to it; and it is the switch the settings matrix draws. `docs/SPEC.md` §8: one
 * concept, one owner.
 *
 * What this replaced, and why none of it survives: a separate `trip.reminder` kind, with a second
 * constant overriding the copy key back to this one. No screen, no bulk write and no seed has ever
 * written a `trip.reminder` preference row, so the opt-out was looked up under a name nothing
 * could set and suppressed nothing — the override was working around that, not the catalogue gap
 * it named.
 */
export const REMINDER_EVENT_KIND = 'trip.starting_soon'

/**
 * The `entityId` the notification and its queue envelope are keyed by.
 *
 * The due instant is *inside* the id, and that is the whole re-fire story. `dispatch` builds its
 * envelope as `notify:<kind>:<entityId>:<recipientUserId>` and the consumer acks a redelivery of an
 * id it has already completed, so an id of the trip alone would collapse two genuinely different
 * reminders — the one for the old start date and the one for the new — into a single delivery. A
 * moved date is a new instant, therefore a new id, therefore a reminder that actually arrives.
 *
 * It costs the in-app row a compound `entity_id`, which is the honest trade: `notifications`
 * carries no foreign key on that column, nothing in `src/` queries notifications by it, and
 * `actionUrl` is what the reader actually follows.
 */
export function reminderEntityId(tripId: string, dueAt: number): string {
  return `${tripId}:${dueAt}`
}

/** The once-per-window marker. Scoped by organization so two tenants can never share one. */
export function reminderMarkerKey(due: DueTripReminder): string {
  return `${REMINDER_MARKER_PREFIX}${due.organizationId}:${due.tripId}:${due.dueAt}`
}

/* -------------------------------------------------------------------------------------------------
 * Ports
 * ---------------------------------------------------------------------------------------------- */

/** The D1 binding as `TaskBindings` declares it, without the `undefined`. */
type D1Handle = NonNullable<TaskBindings['DB']>

/**
 * How a D1 binding becomes a Drizzle handle.
 *
 * Injectable for the same mechanical reason `queue/handlers/travel-stats.ts` states: `createDb`
 * reads the ambient Worker environment at module scope, so importing it here would drag
 * `cloudflare:workers` into a graph the `server` Vitest project runs in plain Node.
 */
export type DatabaseFor = (binding: D1Handle) => Database

export interface ReminderSweepOptions {
  readonly databaseFor?: DatabaseFor
  readonly scan?: ReminderScanOptions
}

export interface ReminderSweepResult {
  /** Rows the window returned, due or not. */
  readonly scanned: number
  /** Rows whose due instant fell inside this tick's window. */
  readonly due: number
  /** Trips that dispatched and got a marker. */
  readonly notified: number
  /** Already marked, no member to remind, or an anchor that moved under the scan. */
  readonly skipped: number
  /** Trips whose reminder threw. Counted, logged, and never propagated. */
  readonly failed: number
}

const EMPTY_SWEEP: ReminderSweepResult = {
  scanned: 0,
  due: 0,
  notified: 0,
  skipped: 0,
  failed: 0,
}

type ReminderStore = TaskBindings['KV']

/* -------------------------------------------------------------------------------------------------
 * The marker
 * ---------------------------------------------------------------------------------------------- */

/**
 * Has this trip already been reminded for this instant?
 *
 * A KV read that fails answers "no". That is the deliberate direction: the alternative — treating an
 * unreadable marker as "probably sent" — turns a KV outage into a silently skipped morning for every
 * workspace, and the envelope id already stops the email half from going twice.
 */
async function alreadyReminded(
  kv: ReminderStore,
  logger: Logger,
  due: DueTripReminder,
): Promise<boolean> {
  try {
    return (await kv.get(reminderMarkerKey(due))) !== null
  } catch (cause) {
    logger.warn(
      'reminder marker could not be read; falling back to queue idempotency',
      {
        tripId: due.tripId,
        organizationId: due.organizationId,
        ...serializeError(cause),
      },
    )
    return false
  }
}

/** Closes the window. A failure here costs a possible duplicate in-app row, never the reminder. */
async function markReminded(
  kv: ReminderStore,
  logger: Logger,
  due: DueTripReminder,
): Promise<void> {
  try {
    await kv.put(reminderMarkerKey(due), String(due.dueAt), {
      expirationTtl: REMINDER_MARKER_TTL_SECONDS,
    })
  } catch (cause) {
    logger.warn(
      'reminder marker could not be written; the next tick may repeat the inbox row',
      {
        tripId: due.tripId,
        organizationId: due.organizationId,
        ...serializeError(cause),
      },
    )
  }
}

/* -------------------------------------------------------------------------------------------------
 * The scope
 * ---------------------------------------------------------------------------------------------- */

/**
 * The user a probe read acts as before a real member is known.
 *
 * The one fabricated value in this path, and what bounds it is that both reads made through the
 * probe — `listTripMembers` and `getMembership` — are `tenantFilter()`-bound on `organization_id`
 * and compare no user id at all, so the probe can see exactly the rows the organization already
 * owns and nothing that depends on who is asking. The scope every subsequent read runs under is
 * built from a member the probe found, at the role that member actually holds. It is never used to
 * write.
 */
const PROBE_USER_ID = 'system'

/**
 * The tenant scope one due trip's reminder runs under, or `null` when nobody can receive it.
 *
 * Owner first, then any member, because a reminder should be attributed to the person who owns the
 * trip when there is one — and because "any member" is the only honest fallback for a trip whose
 * owner has since left the workspace. `getMembership` is the least-privilege read there is: a
 * tenant-filtered `findOne` that asserts no role, so the probe can only ever see the row that
 * decides the real one. A trip member with no workspace membership is skipped rather than trusted.
 */
async function scopeForTrip(
  db: Database,
  due: DueTripReminder,
): Promise<TenantScope | null> {
  const probe = createScope(db, {
    userId: PROBE_USER_ID,
    organizationId: due.organizationId,
    role: 'member',
  })

  const members = await listTripMembers(probe, due.tripId)
  const candidates = [
    ...members.filter((row) => row.role === 'owner'),
    ...members.filter((row) => row.role !== 'owner'),
  ]

  for (const candidate of candidates) {
    const membership = await getMembership(probe, candidate.userId)
    if (membership === null) continue
    return createScope(db, {
      userId: candidate.userId,
      organizationId: due.organizationId,
      // An unrecognised value in the column resolves to the least privilege, never to
      // "unset, therefore permissive".
      role: isOrganizationRole(membership.role) ? membership.role : 'member',
    })
  }
  return null
}

/* -------------------------------------------------------------------------------------------------
 * One trip
 * ---------------------------------------------------------------------------------------------- */

type Outcome = 'notified' | 'skipped'

async function remindTrip(
  db: Database,
  kv: ReminderStore,
  logger: Logger,
  due: DueTripReminder,
  deps: DispatchDeps,
): Promise<Outcome> {
  if (await alreadyReminded(kv, logger, due)) {
    return 'skipped'
  }

  const scope = await scopeForTrip(db, due)
  if (scope === null) {
    logger.info('a due trip has no member to remind', {
      tripId: due.tripId,
      organizationId: due.organizationId,
    })
    return 'skipped'
  }

  const trip = await requireTrip(scope, due.tripId)
  // The scan and this read are two statements, so the row can move between them. Re-deriving the
  // anchor is what keeps the sentence and the marker describing the same row: a trip whose dates
  // changed in that gap belongs to a different due instant, and the next tick will find it there.
  if (reminderDueAt(trip) !== due.dueAt) {
    logger.info('a due trip’s anchor moved between the scan and the read', {
      tripId: due.tripId,
      organizationId: due.organizationId,
      dueAt: due.dueAt,
    })
    return 'skipped'
  }

  const params = { tripTitle: trip.title, days: trip.reminderDays }
  await dispatch(
    scope,
    {
      kind: REMINDER_EVENT_KIND,
      tripId: due.tripId,
      entityType: 'trip',
      entityId: reminderEntityId(due.tripId, due.dueAt),
      // No `actorUserId`: a reminder excludes nobody, and dispatch drops the actor — naming one
      // would deny that person the reminder for their own trip.
      scope: 'trip',
      // No `titleKey`/`bodyKey`: both default to the kind, which is the shipped catalogue key.
      titleParams: params,
      bodyParams: params,
      actionUrl: `/trips/${due.tripId}`,
    },
    deps,
  )

  await markReminded(kv, logger, due)
  return 'notified'
}

/* -------------------------------------------------------------------------------------------------
 * The sweep
 * ---------------------------------------------------------------------------------------------- */

/**
 * Cron entry point. `src/server/worker.ts` calls it with the tick's `scheduledTime`, which is also
 * the instant every window test and every enqueue timestamp is taken from — a sweep is a pure
 * function of the tick it was scheduled for, so a replayed tick behaves identically.
 */
export async function sweepReminders(
  env: TaskBindings,
  logger: Logger,
  scheduledTime: number,
  options: ReminderSweepOptions = {},
): Promise<ReminderSweepResult> {
  const binding = env.DB
  if (binding === undefined) {
    // Not a throw: the cron has no retry and a missing binding is an operator problem, so the tick
    // reports it and ends rather than filling the log with a stack every fifteen minutes.
    logger.warn('reminder sweep has no DB binding; no trip can be read', {
      scheduledTime,
    })
    return EMPTY_SWEEP
  }

  const databaseFor =
    options.databaseFor ?? ((handle: D1Handle) => drizzle(handle))
  const db = databaseFor(binding)
  const scan = await listDueTripReminders(db, scheduledTime, options.scan)

  if (scan.truncated) {
    logger.warn(
      'reminder scan hit its row bound; trips beyond it were not read this tick',
      { scanned: scan.scanned, due: scan.due.length },
    )
  }

  const deps: DispatchDeps = {
    queue: env.TASKS,
    logger,
    appUrl: env.APP_URL,
    now: () => scheduledTime,
  }

  let notified = 0
  let skipped = 0
  let failed = 0

  for (const due of scan.due) {
    try {
      if ((await remindTrip(db, env.KV, logger, due, deps)) === 'notified') {
        notified += 1
      } else {
        skipped += 1
      }
    } catch (cause) {
      // Per trip, deliberately. A workspace whose rows are broken must not cost every other
      // workspace its morning, and the cron has no retry that would come back for the rest.
      failed += 1
      logger.warn('a reminder failed for one trip', {
        tripId: due.tripId,
        organizationId: due.organizationId,
        dueAt: due.dueAt,
        ...serializeError(cause),
      })
    }
  }

  const result: ReminderSweepResult = {
    scanned: scan.scanned,
    due: scan.due.length,
    notified,
    skipped,
    failed,
  }
  // Only when there was something to do: a `*/15` cron with an empty window is the common case, and
  // a line for every quiet tick is what makes the loud ones hard to find.
  if (scan.due.length > 0) {
    logger.info('reminder sweep finished', { ...result, scheduledTime })
  }
  return result
}
