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
  countAuditActions,
  countPlacesPerTrip,
  countUnread,
  createTrip,
  getAtlasSummary,
  getDashboardSummary,
  getOrganization,
  listActionable,
  listAuditLog,
  listCollectionsWithCounts,
  listJourneysWithCounts,
  listMemberProfiles,
  listNotifications,
  listPendingInvitations,
  listTrips,
  markAllRead,
  markRead,
  resolveQuotas,
} from '#/server/repos'
import { appScope } from './context'
import { isoOfRequired, todayIso } from './serialise'

import type { JsonRecord } from '#/server/db/schema'
import type { Reservation, Trip } from '#/server/db/types'

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
    const today = todayIso()

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
    const today = todayIso()

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
  readonly items: ReadonlyArray<NotificationCard>
  readonly nextCursor: string | null
  readonly unreadCount: number
  readonly actionableCount: number
}

export const loadNotifications = createServerFn({ method: 'GET' })
  .validator(z.object({ unreadOnly: z.boolean().optional() }))
  .handler(async ({ data }): Promise<NotificationsPayload> => {
    const scope = await appScope()
    const userId = scope.ctx.userId

    const [page, unreadCount, actionable] = await Promise.all([
      listNotifications(scope, userId, {
        unreadOnly: data.unreadOnly,
        limit: 50,
      }),
      countUnread(scope, userId),
      listActionable(scope, userId),
    ])

    return {
      nextCursor: page.nextCursor,
      unreadCount,
      actionableCount: actionable.length,
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

export const readNotification = createServerFn({ method: 'POST' })
  .validator(z.object({ notificationId: z.string().trim().min(1).max(64) }))
  .handler(async ({ data }): Promise<{ readonly unreadCount: number }> => {
    const scope = await appScope()
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

export const loadAdmin = createServerFn({ method: 'GET' }).handler(
  async (): Promise<AdminPayload> => {
    const scope = await appScope()

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
      getDashboardSummary(scope, { today: todayIso() }),
      resolveQuotas(scope),
      listMemberProfiles(scope),
      listPendingInvitations(scope),
      listAuditLog(scope, { limit: 25 }),
      countAuditActions(scope, { limit: 8 }),
      listCollectionsWithCounts(scope),
      listJourneysWithCounts(scope),
    ])

    return {
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
