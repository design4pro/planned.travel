/**
 * Reads for the workspace-wide screens: the dashboard, the trip index, the
 * inbox and the admin console.
 *
 * Every handler resolves a tenant scope first and then composes repository
 * calls; the DTOs below are deliberately JSON-only so nothing depends on a
 * `Date` surviving the wire.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
  RepositoryError,
  countAuditActions,
  countPlacesPerTrip,
  countUnread,
  createTrip,
  getAtlasSummary,
  getDashboardSummary,
  getOrganization,
  listAuditLog,
  listCollectionsWithCounts,
  listJourneysWithCounts,
  listMemberProfiles,
  listNotifications,
  listPendingInvitations,
  listTrips,
  markAllRead,
  markRead,
  notificationsRepository,
  resolveQuotas,
} from '#/server/repos'
import { roleSatisfies } from '#/server/auth/tenant'
import { serverToday } from '#/server/clock'
import { appScope } from './context'
import { isoOfRequired } from './serialise'

import type { JsonRecord } from '#/server/db/schema'
import type { Notification, Reservation, Trip } from '#/server/db/types'

/* ------------------------------------------------------------------- shapes */

/**
 * An uncapped ceiling, in a form that survives the server-function boundary.
 *
 * `resolveQuotas()` counts "no cap" as `Infinity` because that is what the arithmetic
 * needs; `JSON.stringify` renders it as `null`. Converting here means the value the
 * client receives on a navigation is the same one the server rendered, rather than a
 * silently different number.
 */
function overTheWire(limit: number): number | null {
  return Number.isFinite(limit) ? limit : null
}

export interface TripCard {
  readonly id: string
  readonly title: string
  readonly slug: string
  readonly summary: string | null
  readonly destination: string | null
  readonly status: string
  readonly startDate: string | null
  readonly endDate: string | null
  readonly currency: string
  readonly countryCodes: ReadonlyArray<string>
  readonly coverImageUrl: string | null
  readonly accentColour: string | null
  readonly isFavourite: boolean
  readonly isArchived: boolean
  readonly placeCount: number
  readonly updatedAt: string
}

export interface ReservationCard {
  readonly id: string
  readonly tripId: string
  readonly title: string
  readonly type: string
  readonly status: string
  readonly provider: string | null
  readonly location: string | null
  readonly startDate: string | null
  readonly startTime: string | null
  readonly endDate: string | null
  readonly endTime: string | null
  readonly guests: number | null
  readonly priceMinor: number | null
  readonly currency: string | null
  readonly confirmationNumber: string | null
  readonly notes: string | null
  readonly url: string | null
}

export interface StatusCount {
  readonly status: string
  readonly value: number
}

export interface DashboardPayload {
  readonly today: string
  readonly upNext: TripCard | null
  readonly upcoming: ReadonlyArray<TripCard>
  readonly mine: ReadonlyArray<TripCard>
  readonly reservations: ReadonlyArray<ReservationCard>
  readonly tripTotals: {
    readonly total: number
    readonly archived: number
    readonly favourites: number
    readonly byStatus: ReadonlyArray<StatusCount>
  }
  readonly counts: {
    readonly places: number
    readonly reservations: number
    readonly members: number
    readonly files: number
    readonly unreadNotifications: number
    readonly visitedCountries: number
    readonly bucketList: number
  }
  readonly storage: {
    readonly usedBytes: number
    readonly limitBytes: number
  }
  readonly atlas: {
    readonly countryCount: number
    readonly regionCount: number
    readonly visitCount: number
    readonly byContinent: ReadonlyArray<{
      readonly continent: string
      readonly countryCount: number
    }>
    readonly countryCodes: ReadonlyArray<string>
    readonly bucketAchieved: number
    readonly bucketTotal: number
  }
}

export function toTripCard(trip: Trip, placeCount: number): TripCard {
  return {
    id: trip.id,
    title: trip.title,
    slug: trip.slug,
    summary: trip.summary,
    destination: trip.destination,
    status: trip.status,
    startDate: trip.startDate,
    endDate: trip.endDate,
    currency: trip.currency,
    countryCodes: trip.countryCodes ?? [],
    coverImageUrl: trip.coverImageUrl,
    accentColour: trip.accentColour,
    isFavourite: trip.isFavourite,
    isArchived: trip.isArchived,
    placeCount,
    updatedAt: isoOfRequired(trip.updatedAt),
  }
}

export function toReservationCard(row: Reservation): ReservationCard {
  return {
    id: row.id,
    tripId: row.tripId,
    title: row.title,
    type: row.type,
    status: row.status,
    provider: row.provider,
    location: row.location,
    startDate: row.startDate,
    startTime: row.startTime,
    endDate: row.endDate,
    endTime: row.endTime,
    guests: row.guests,
    priceMinor: row.priceMinor,
    currency: row.currency,
    confirmationNumber: row.confirmationNumber,
    notes: row.notes,
    url: row.url,
  }
}

/* ---------------------------------------------------------------- dashboard */

export const loadDashboard = createServerFn({ method: 'GET' }).handler(
  async (): Promise<DashboardPayload> => {
    const scope = await appScope()
    const today = serverToday()

    const [summary, atlas, quotas] = await Promise.all([
      getDashboardSummary(scope, { today }),
      getAtlasSummary(scope, scope.ctx.userId),
      resolveQuotas(scope),
    ])

    const shown = [...summary.upcomingTrips, ...summary.myTrips]
    const placeCounts = await countPlacesPerTrip(scope, [
      ...new Set(shown.map((trip) => trip.id)),
    ])

    const card = (trip: Trip): TripCard =>
      toTripCard(trip, placeCounts.get(trip.id) ?? 0)
    const first = summary.upcomingTrips.at(0)

    return {
      today,
      upNext: first === undefined ? null : card(first),
      upcoming: summary.upcomingTrips.slice(1).map(card),
      mine: summary.myTrips.map(card),
      reservations: summary.upcomingReservations.map(toReservationCard),
      tripTotals: {
        total: summary.trips.total,
        archived: summary.trips.archived,
        favourites: summary.trips.favourites,
        byStatus: Object.entries(summary.trips.byStatus).map(
          ([status, value]) => ({
            status,
            value,
          }),
        ),
      },
      counts: summary.counts,
      storage: {
        usedBytes: summary.storageBytes,
        limitBytes: quotas.limits.storage_bytes,
      },
      atlas: {
        countryCount: atlas.countryCount,
        regionCount: atlas.regionCount,
        visitCount: atlas.visitCount,
        byContinent: atlas.byContinent,
        countryCodes: atlas.countryCodes,
        bucketAchieved: atlas.bucketList.achieved,
        bucketTotal: atlas.bucketList.total,
      },
    }
  },
)

/* -------------------------------------------------------------- trip index */

const tripFilterSchema = z.object({
  status: z
    .enum(['draft', 'planning', 'booked', 'active', 'completed', 'archived'])
    .optional(),
  search: z.string().trim().min(1).max(120).optional(),
  archived: z.boolean().optional(),
  favourite: z.boolean().optional(),
})

export interface TripsPayload {
  readonly today: string
  readonly trips: ReadonlyArray<TripCard>
  readonly totals: {
    readonly total: number
    readonly archived: number
    readonly favourites: number
    readonly byStatus: ReadonlyArray<StatusCount>
  }
  readonly tripLimit: number
}

export const loadTrips = createServerFn({ method: 'GET' })
  .validator(tripFilterSchema)
  .handler(async ({ data }): Promise<TripsPayload> => {
    const scope = await appScope()
    const today = serverToday()

    const [rows, summary, quotas] = await Promise.all([
      listTrips(scope, {
        status: data.status,
        search: data.search,
        archived: data.archived ?? false,
        favourite: data.favourite,
        limit: 100,
      }),
      getDashboardSummary(scope, { today }),
      resolveQuotas(scope),
    ])

    const placeCounts = await countPlacesPerTrip(
      scope,
      rows.map((trip) => trip.id),
    )

    return {
      today,
      trips: rows.map((trip) =>
        toTripCard(trip, placeCounts.get(trip.id) ?? 0),
      ),
      totals: {
        total: summary.trips.total,
        archived: summary.trips.archived,
        favourites: summary.trips.favourites,
        byStatus: Object.entries(summary.trips.byStatus).map(
          ([status, value]) => ({
            status,
            value,
          }),
        ),
      },
      tripLimit: quotas.limits.trips,
    }
  })

/* ------------------------------------------------------------------- inbox */

export interface NotificationCard {
  readonly id: string
  readonly type: string
  readonly scope: string
  readonly titleKey: string
  readonly titleParams: JsonRecord | null
  readonly bodyKey: string
  readonly bodyParams: JsonRecord | null
  readonly actionUrl: string | null
  readonly entityType: string | null
  readonly entityId: string | null
  readonly response: string | null
  readonly isRead: boolean
  readonly createdAt: string
}

export interface NotificationsPayload {
  /**
   * The instant the page was read, so the rows' relative times are composed
   * against one clock. Read on the server and carried on the payload: a
   * `Date.now()` in a component runs twice, once during SSR and once during
   * hydration, and a row sitting on the "45 seconds" or the "7 days" boundary
   * then renders two different strings and React reports a text mismatch.
   */
  readonly now: number
  readonly items: ReadonlyArray<NotificationCard>
  readonly nextCursor: string | null
  readonly unreadCount: number
  /**
   * Rows on this page still waiting for an accept or a decline.
   *
   * Counted from the page rather than from the whole table. `listActionable`
   * takes no limit, so asking it for a `.length` put an unbounded select on
   * every inbox page view — and a repository function that returns every
   * matching row is not a counter. The number the chip shows is now about the
   * list underneath it, which is also what a reader standing next to that list
   * reads it as. An exact workspace-wide figure needs a `countActionable` in
   * `src/server/repos/notifications.ts`, which this item does not own.
   */
  readonly actionableCount: number
}

/** Rows a reader still has to answer: an invitation, a poll, a request. */
function actionableIn(items: ReadonlyArray<Notification>): number {
  return items.filter((row) => row.type === 'action' && row.response === null)
    .length
}

export const loadNotifications = createServerFn({ method: 'GET' })
  .validator(z.object({ unreadOnly: z.boolean().optional() }))
  .handler(async ({ data }): Promise<NotificationsPayload> => {
    const scope = await appScope()
    const userId = scope.ctx.userId

    const [page, unreadCount] = await Promise.all([
      listNotifications(scope, userId, {
        unreadOnly: data.unreadOnly,
        limit: 50,
      }),
      countUnread(scope, userId),
    ])

    return {
      now: Date.now(),
      nextCursor: page.nextCursor,
      unreadCount,
      actionableCount: actionableIn(page.items),
      items: page.items.map((row) => ({
        id: row.id,
        type: row.type,
        scope: row.scope,
        titleKey: row.titleKey,
        titleParams: row.titleParams,
        bodyKey: row.bodyKey,
        bodyParams: row.bodyParams,
        actionUrl: row.actionUrl,
        entityType: row.entityType,
        entityId: row.entityId,
        response: row.response,
        isRead: row.isRead,
        createdAt: isoOfRequired(row.createdAt),
      })),
    }
  })

/**
 * Marks one row read.
 *
 * The repository's `markRead` is tenant-scoped but not recipient-scoped, so on
 * its own it let any member of a workspace mark a colleague's notification read
 * by posting its id — an inbox is per person, not per workspace. The row is
 * therefore read and its recipient checked before the write, and a row belonging
 * to someone else is refused exactly as a row belonging to another workspace is:
 * as if it were not there. Authorisation is never the client's to decide
 * (`docs/SPEC.md` §5), and the client here only ever holds ids the reader was
 * served.
 *
 * The narrower fix is a `recipientUserId` parameter on the repository function,
 * which this item does not own.
 */
export const readNotification = createServerFn({ method: 'POST' })
  .validator(z.object({ notificationId: z.string().trim().min(1).max(64) }))
  .handler(async ({ data }): Promise<{ readonly unreadCount: number }> => {
    const scope = await appScope()
    const row = await notificationsRepository.requireById(
      scope,
      data.notificationId,
    )
    if (row.recipientUserId !== scope.ctx.userId) {
      throw new RepositoryError(
        'That notification belongs to another member of this workspace.',
        'NOT_THE_RECIPIENT',
      )
    }
    await markRead(scope, data.notificationId)
    return { unreadCount: await countUnread(scope, scope.ctx.userId) }
  })

export const readAllNotifications = createServerFn({ method: 'POST' }).handler(
  async (): Promise<{ readonly unreadCount: number }> => {
    const scope = await appScope()
    await markAllRead(scope, scope.ctx.userId)
    return { unreadCount: 0 }
  },
)

/* ------------------------------------------------------------------- admin */

export interface AdminMemberRow {
  readonly memberId: string
  readonly userId: string
  readonly role: string
  readonly name: string
  readonly email: string
  readonly image: string | null
  readonly joinedAt: string
}

export interface AdminAuditRow {
  readonly id: string
  readonly action: string
  readonly actorUserId: string | null
  readonly entityType: string | null
  readonly entityId: string | null
  readonly createdAt: string
}

export interface AdminPayload {
  /** One clock for the audit trail's relative times; see {@link NotificationsPayload.now}. */
  readonly now: number
  readonly organization: {
    readonly id: string
    readonly name: string
    readonly slug: string
    readonly createdAt: string
  }
  /** The catalogue plan the customer bought, so every screen names it the same way. */
  readonly plan: string
  readonly limits: ReadonlyArray<{
    readonly metric: string
    readonly used: number
    /**
     * `null` where the plan does not cap the metric. The resolver counts an uncapped
     * ceiling as `Infinity`, which `JSON.stringify` turns into `null` on its own — so
     * the boundary states it rather than letting a client-side navigation receive a
     * different value from the one the server rendered.
     */
    readonly limit: number | null
  }>
  readonly members: ReadonlyArray<AdminMemberRow>
  readonly pendingInvitations: number
  readonly audit: ReadonlyArray<AdminAuditRow>
  readonly actionCounts: ReadonlyArray<{
    readonly action: string
    readonly value: number
  }>
}

/**
 * The admin console's read, or `null` when the caller may not have it.
 *
 * `null` rather than a thrown 403, because "you are not an admin here" is a
 * designed screen and not a fault: the route renders the denial state from it,
 * the same way an empty list renders an empty state. What matters is that the
 * decision is made *here*. The component used to gate itself on
 * `session.user.isAdmin` while this loader ran unconditionally, so a plain
 * member who opened `/admin` was served the whole member roster — names and
 * email addresses — the audit trail and every quota figure inside the SSR
 * payload, and then shown a polite panel saying they could not see it. A gate
 * that runs after the data has been sent is not a gate (`docs/SPEC.md` §5:
 * authorisation is never the client's decision).
 *
 * Nine repository reads sit behind this check, so refusing early is also the
 * cheaper path.
 */
export const loadAdmin = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AdminPayload | null> => {
    const scope = await appScope()
    if (!roleSatisfies(scope.ctx.role, 'admin')) {
      return null
    }

    const [
      organization,
      summary,
      quotas,
      members,
      invitations,
      audit,
      actionCounts,
      collections,
      journeys,
    ] = await Promise.all([
      getOrganization(scope),
      getDashboardSummary(scope, { today: serverToday() }),
      resolveQuotas(scope),
      listMemberProfiles(scope),
      listPendingInvitations(scope),
      listAuditLog(scope, { limit: 25 }),
      countAuditActions(scope, { limit: 8 }),
      listCollectionsWithCounts(scope),
      listJourneysWithCounts(scope),
    ])

    return {
      now: Date.now(),
      organization: {
        id: organization.id,
        name: organization.name,
        slug: organization.slug,
        createdAt: isoOfRequired(organization.createdAt),
      },
      plan: quotas.planId,
      limits: [
        {
          metric: 'trips',
          used: summary.trips.total,
          limit: overTheWire(quotas.limits.trips),
        },
        {
          metric: 'places',
          used: summary.counts.places,
          limit: overTheWire(quotas.limits.places),
        },
        {
          metric: 'members',
          used: summary.counts.members,
          limit: overTheWire(quotas.limits.members),
        },
        {
          metric: 'files',
          used: summary.counts.files,
          limit: overTheWire(quotas.limits.files),
        },
        {
          metric: 'storage_bytes',
          used: summary.storageBytes,
          limit: overTheWire(quotas.limits.storage_bytes),
        },
        {
          metric: 'collections',
          used: collections.length,
          limit: overTheWire(quotas.limits.collections),
        },
        {
          metric: 'journeys',
          used: journeys.length,
          limit: overTheWire(quotas.limits.journeys),
        },
      ],
      members: members.map((row) => ({
        memberId: row.memberId,
        userId: row.userId,
        role: row.role,
        name: row.name,
        email: row.email,
        image: row.image,
        joinedAt: isoOfRequired(row.joinedAt),
      })),
      pendingInvitations: invitations.length,
      audit: audit.items.map((row) => ({
        id: row.id,
        action: row.action,
        actorUserId: row.actorUserId,
        entityType: row.entityType,
        entityId: row.entityId,
        createdAt: isoOfRequired(row.createdAt),
      })),
      actionCounts,
    }
  },
)

/* ------------------------------------------------------------ trip creation */

const createTripSchema = z
  .object({
    title: z.string().trim().min(1).max(120),
    destination: z.string().trim().max(160),
    startDate: z
      .string()
      .trim()
      .regex(/^(\d{4}-\d{2}-\d{2})?$/),
    endDate: z
      .string()
      .trim()
      .regex(/^(\d{4}-\d{2}-\d{2})?$/),
    currency: z.string().trim().length(3).toUpperCase(),
  })
  .refine(
    (value) =>
      value.startDate === '' ||
      value.endDate === '' ||
      value.endDate >= value.startDate,
    {
      /**
       * Defence in depth, and the one English string in this module.
       *
       * `-ui/new-trip-dialog.tsx` computes `datesOutOfOrder` and both disables
       * the save button and names the problem on the Return field, so this
       * refinement is never the sentence a reader sees — it is what stops a
       * hand-rolled request from writing a backwards range. A key here would
       * render as `shell.…` in whatever surfaced it, which is worse than a
       * diagnostic in the source language.
       */
      message: 'The return date cannot be before the departure date.',
      path: ['endDate'],
    },
  )

/**
 * Creates a trip and hands back its id so the caller can navigate straight into
 * the planner. Quota, slug reservation, the owner membership and the day run are
 * all the repository's job — this only validates and forwards.
 */
export const createTripFn = createServerFn({ method: 'POST' })
  .validator(createTripSchema)
  .handler(async ({ data }): Promise<{ readonly tripId: string }> => {
    const scope = await appScope()
    const trip = await createTrip(scope, {
      title: data.title,
      destination: data.destination === '' ? null : data.destination,
      startDate: data.startDate === '' ? null : data.startDate,
      endDate: data.endDate === '' ? null : data.endDate,
      currency: data.currency,
    })
    return { tripId: trip.id }
  })
