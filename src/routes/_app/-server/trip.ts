/**
 * Reads for one trip: the workspace header, and one handler per module tab.
 *
 * Every handler starts from `requireTrip`, so a trip id from another tenant
 * becomes a 404 before any child row is touched — the repository layer's
 * guarantee, surfaced at the route boundary.
 */
import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import {
  countTripReservationsByStatus,
  createPlace,
  getMemberBalances,
  getStorageUsage,
  getTripItinerary,
  getTripSpendSummary,
  getTripStorageBytes,
  listBudgetItems,
  listCategories,
  listMessages,
  listNotes,
  listPolls,
  listReactions,
  listSettlements,
  listTripDays,
  listTripExpenses,
  listTripFiles,
  listTripListsWithProgress,
  listTripMembers,
  listTripPlacesWithTags,
  listTripReservations,
  listTripTransports,
  listUnscheduledPlaces,
  listUserProfiles,
  listVotes,
  postMessage,
  requireTrip,
  resolveQuotas,
  summariseTripTransports,
  totalTripDistanceMetres,
  totalTripReservationsMinor,
  listItems,
} from '#/server/repos'
import { appScope } from './context'
import { isoOf, isoOfRequired, todayIso } from './serialise'
import { toReservationCard } from './overview'

import type { TenantScope } from '#/server/repos'
import type { PollOption } from '#/server/db/schema'
import type { ReservationCard } from './overview'
import { resolveTimeZone } from '#/lib/time'

const tripInput = z.object({ tripId: z.string().trim().min(1).max(64) })

/* ------------------------------------------------------------------ shapes */

export interface PersonChip {
  readonly userId: string
  readonly name: string
  readonly email: string
  readonly image: string | null
  readonly role: string
}

export interface TripDetail {
  readonly id: string
  readonly title: string
  readonly slug: string
  readonly summary: string | null
  readonly description: string | null
  readonly destination: string | null
  readonly status: string
  readonly visibility: string
  readonly startDate: string | null
  readonly endDate: string | null
  readonly timezone: string | null
  readonly currency: string
  readonly countryCodes: ReadonlyArray<string>
  readonly coverImageUrl: string | null
  readonly accentColour: string | null
  readonly budgetTargetMinor: number | null
  readonly isFavourite: boolean
  readonly isArchived: boolean
}

export interface TripHeaderPayload {
  readonly today: string
  readonly trip: TripDetail
  readonly people: ReadonlyArray<PersonChip>
  readonly dayCount: number
}

/* ------------------------------------------------------------------ header */

async function loadPeople(
  tripId: string,
  scope: TenantScope,
): Promise<Array<PersonChip>> {
  const members = await listTripMembers(scope, tripId)
  const profiles = await listUserProfiles(
    scope,
    members.map((row) => row.userId),
  )
  const byUser = new Map(profiles.map((row) => [row.userId, row]))

  return members.map((row) => {
    const profile = byUser.get(row.userId)
    return {
      userId: row.userId,
      name: profile?.name ?? 'Removed traveller',
      email: profile?.email ?? '',
      image: profile?.image ?? null,
      role: row.role,
    }
  })
}

export const loadTripHeader = createServerFn({ method: 'GET' })
  .validator(tripInput)
  .handler(async ({ data }): Promise<TripHeaderPayload> => {
    const scope = await appScope()
    const trip = await requireTrip(scope, data.tripId)

    const [people, days] = await Promise.all([
      loadPeople(trip.id, scope),
      listTripDays(scope, trip.id),
    ])

    return {
      today: todayIso(),
      dayCount: days.length,
      people,
      trip: {
        id: trip.id,
        title: trip.title,
        slug: trip.slug,
        summary: trip.summary,
        description: trip.description,
        destination: trip.destination,
        status: trip.status,
        visibility: trip.visibility,
        startDate: trip.startDate,
        endDate: trip.endDate,
        timezone: trip.timezone,
        currency: trip.currency,
        countryCodes: trip.countryCodes ?? [],
        coverImageUrl: trip.coverImageUrl,
        accentColour: trip.accentColour,
        budgetTargetMinor: trip.budgetTargetMinor,
        isFavourite: trip.isFavourite,
        isArchived: trip.isArchived,
      },
    }
  })

/* -------------------------------------------------------------------- plan */

export interface PlanStop {
  readonly assignmentId: string
  readonly placeId: string
  readonly name: string
  readonly address: string | null
  readonly city: string | null
  readonly categoryId: string | null
  readonly startTime: string | null
  readonly endTime: string | null
  readonly durationMinutes: number | null
  readonly reservationStatus: string
  readonly transportMode: string | null
  readonly notes: string | null
  readonly participantUserIds: ReadonlyArray<string>
}

export interface PlanDay {
  readonly dayId: string
  readonly dayNumber: number
  readonly date: string | null
  readonly title: string | null
  readonly stops: ReadonlyArray<PlanStop>
  readonly notes: ReadonlyArray<{
    readonly id: string
    readonly body: string
    readonly time: string | null
  }>
  readonly accommodations: ReadonlyArray<{
    readonly id: string
    readonly name: string
    readonly address: string | null
    readonly checkInTime: string | null
    readonly checkOutTime: string | null
  }>
}

export interface PlanPlace {
  readonly id: string
  readonly name: string
  readonly city: string | null
  readonly address: string | null
  readonly categoryId: string | null
  readonly durationMinutes: number
  readonly isVisited: boolean
  readonly lat: number | null
  readonly lng: number | null
  readonly tags: ReadonlyArray<{ readonly id: string; readonly name: string }>
}

export interface CategoryChip {
  readonly id: string
  readonly name: string
  readonly colour: string
  readonly slug: string
  /** `lucide-react` icon name in kebab case, e.g. `bed-double`. */
  readonly icon: string
}

export interface PlanPayload {
  readonly days: ReadonlyArray<PlanDay>
  readonly unscheduled: ReadonlyArray<PlanPlace>
  readonly inventory: ReadonlyArray<PlanPlace>
  readonly categories: ReadonlyArray<CategoryChip>
  readonly scheduledCount: number
}

export const loadTripPlan = createServerFn({ method: 'GET' })
  .validator(tripInput)
  .handler(async ({ data }): Promise<PlanPayload> => {
    const scope = await appScope()
    const trip = await requireTrip(scope, data.tripId)

    const [itinerary, unscheduled, inventory, categories] = await Promise.all([
      getTripItinerary(scope, trip.id),
      listUnscheduledPlaces(scope, trip.id),
      listTripPlacesWithTags(scope, trip.id),
      listCategories(scope),
    ])

    const tagsByPlace = new Map(
      inventory.map((place) => [
        place.id,
        place.tags.map((tag) => ({ id: tag.id, name: tag.name })),
      ]),
    )

    const days: Array<PlanDay> = itinerary.map((entry) => ({
      dayId: entry.day.id,
      dayNumber: entry.day.dayNumber,
      date: entry.day.date,
      title: entry.day.title,
      stops: entry.stops.map((stop) => ({
        assignmentId: stop.assignment.id,
        placeId: stop.place.id,
        name: stop.place.name,
        address: stop.place.address,
        city: stop.place.city,
        categoryId: stop.place.categoryId,
        startTime: stop.assignment.startTime,
        endTime: stop.assignment.endTime,
        durationMinutes: stop.assignment.durationMinutes,
        reservationStatus: stop.assignment.reservationStatus,
        transportMode: stop.assignment.transportMode,
        notes: stop.assignment.notes,
        participantUserIds: stop.participantUserIds,
      })),
      notes: entry.notes.map((note) => ({
        id: note.id,
        body: note.body,
        time: note.time,
      })),
      accommodations: entry.accommodations.map((stay) => ({
        id: stay.id,
        name: stay.name,
        address: stay.address,
        checkInTime: stay.checkInTime,
        checkOutTime: stay.checkOutTime,
      })),
    }))

    return {
      days,
      categories: categories.map((row) => ({
        id: row.id,
        name: row.name,
        colour: row.colour,
        slug: row.slug,
        icon: row.icon,
      })),
      scheduledCount: days.reduce((total, day) => total + day.stops.length, 0),
      unscheduled: unscheduled.map((place) => ({
        id: place.id,
        name: place.name,
        city: place.city,
        address: place.address,
        categoryId: place.categoryId,
        durationMinutes: place.durationMinutes,
        isVisited: place.isVisited,
        lat: place.lat,
        lng: place.lng,
        tags: tagsByPlace.get(place.id) ?? [],
      })),
      inventory: inventory.map((place) => ({
        id: place.id,
        name: place.name,
        city: place.city,
        address: place.address,
        categoryId: place.categoryId,
        durationMinutes: place.durationMinutes,
        isVisited: place.isVisited,
        lat: place.lat,
        lng: place.lng,
        tags: place.tags.map((tag) => ({ id: tag.id, name: tag.name })),
      })),
    }
  })

/* -------------------------------------------------------------- transports */

export interface TransportLeg {
  readonly id: string
  readonly mode: string
  readonly status: string
  readonly title: string
  readonly carrier: string | null
  readonly serviceNumber: string | null
  readonly bookingCode: string | null
  readonly seat: string | null
  readonly departureName: string | null
  readonly departureCode: string | null
  readonly departureDate: string | null
  readonly departureTime: string | null
  readonly arrivalName: string | null
  readonly arrivalCode: string | null
  readonly arrivalDate: string | null
  readonly arrivalTime: string | null
  readonly distanceMetres: number | null
  readonly priceMinor: number | null
  readonly currency: string | null
  readonly notes: string | null
}

export interface TransportsPayload {
  readonly legs: ReadonlyArray<TransportLeg>
  readonly byMode: ReadonlyArray<{
    readonly mode: string
    readonly legs: number
    readonly distanceMetres: number
  }>
  readonly totalDistanceMetres: number
  readonly distanceUnit: 'metric' | 'imperial'
  readonly currency: string
}

export const loadTripTransports = createServerFn({ method: 'GET' })
  .validator(tripInput)
  .handler(async ({ data }): Promise<TransportsPayload> => {
    const scope = await appScope()
    const trip = await requireTrip(scope, data.tripId)

    const [legs, byMode, totalDistanceMetres] = await Promise.all([
      listTripTransports(scope, trip.id),
      summariseTripTransports(scope, trip.id),
      totalTripDistanceMetres(scope, trip.id),
    ])

    return {
      byMode,
      totalDistanceMetres,
      distanceUnit: 'metric',
      currency: trip.currency,
      legs: legs.map((row) => ({
        id: row.id,
        mode: row.mode,
        status: row.status,
        title: row.title,
        carrier: row.carrier,
        serviceNumber: row.serviceNumber,
        bookingCode: row.bookingCode,
        seat: row.seat,
        departureName: row.departureName,
        departureCode: row.departureCode,
        departureDate: row.departureDate,
        departureTime: row.departureTime,
        arrivalName: row.arrivalName,
        arrivalCode: row.arrivalCode,
        arrivalDate: row.arrivalDate,
        arrivalTime: row.arrivalTime,
        distanceMetres: row.distanceMetres,
        priceMinor: row.priceMinor,
        currency: row.currency,
        notes: row.notes,
      })),
    }
  })

/* ------------------------------------------------------------------ book */

export interface BookingsPayload {
  readonly reservations: ReadonlyArray<ReservationCard>
  readonly byStatus: ReadonlyArray<{
    readonly status: string
    readonly value: number
  }>
  readonly committedMinor: number
  readonly currency: string
}

export const loadTripBookings = createServerFn({ method: 'GET' })
  .validator(tripInput)
  .handler(async ({ data }): Promise<BookingsPayload> => {
    const scope = await appScope()
    const trip = await requireTrip(scope, data.tripId)

    const [rows, byStatus, committedMinor] = await Promise.all([
      listTripReservations(scope, { tripId: trip.id }),
      countTripReservationsByStatus(scope, trip.id),
      totalTripReservationsMinor(scope, trip.id),
    ])

    return {
      byStatus,
      committedMinor,
      currency: trip.currency,
      reservations: rows.map(toReservationCard),
    }
  })

/* ------------------------------------------------------------------ lists */

export interface ListItemRow {
  readonly id: string
  readonly name: string
  readonly category: string | null
  readonly quantity: number
  readonly weightGrams: number | null
  readonly isDone: boolean
  readonly assignedTo: string | null
  readonly dueDate: string | null
  readonly priority: string
}

export interface ListCard {
  readonly id: string
  readonly name: string
  readonly kind: string
  readonly colour: string | null
  readonly ownerUserId: string | null
  readonly weightLimitGrams: number | null
  readonly itemCount: number
  readonly doneCount: number
  readonly weightGrams: number
  readonly items: ReadonlyArray<ListItemRow>
}

export interface ListsPayload {
  readonly lists: ReadonlyArray<ListCard>
  readonly people: ReadonlyArray<PersonChip>
  readonly itemCount: number
  readonly doneCount: number
}

export const loadTripLists = createServerFn({ method: 'GET' })
  .validator(tripInput)
  .handler(async ({ data }): Promise<ListsPayload> => {
    const scope = await appScope()
    const trip = await requireTrip(scope, data.tripId)

    const [progress, people] = await Promise.all([
      listTripListsWithProgress(scope, trip.id),
      loadPeople(trip.id, scope),
    ])

    const items = await Promise.all(
      progress.map((list) => listItems(scope, list.id)),
    )

    const lists: Array<ListCard> = progress.map((list, index) => ({
      id: list.id,
      name: list.name,
      kind: list.kind,
      colour: list.colour,
      ownerUserId: list.ownerUserId,
      weightLimitGrams: list.weightLimitGrams,
      itemCount: list.itemCount,
      doneCount: list.doneCount,
      weightGrams: list.weightGrams,
      items: (items[index] ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        weightGrams: item.weightGrams,
        isDone: item.isDone,
        assignedTo: item.assignedTo,
        dueDate: item.dueDate,
        priority: item.priority,
      })),
    }))

    return {
      lists,
      people,
      itemCount: lists.reduce((total, list) => total + list.itemCount, 0),
      doneCount: lists.reduce((total, list) => total + list.doneCount, 0),
    }
  })

/* ------------------------------------------------------------------ costs */

export interface ExpenseRow {
  readonly id: string
  readonly title: string
  readonly category: string
  readonly amountMinor: number
  readonly currency: string
  readonly originalAmountMinor: number | null
  readonly originalCurrency: string | null
  readonly spentOn: string
  readonly paidBy: string | null
  readonly splitMethod: string
  readonly notes: string | null
}

export interface BalanceRow {
  readonly userId: string
  readonly paidMinor: number
  readonly shareMinor: number
  readonly balanceMinor: number
}

export interface CostsPayload {
  readonly currency: string
  readonly plannedMinor: number
  readonly spentMinor: number
  readonly budgetTargetMinor: number | null
  readonly expenseCount: number
  readonly byCategory: ReadonlyArray<{
    readonly category: string
    readonly plannedMinor: number
    readonly spentMinor: number
    readonly expenseCount: number
  }>
  readonly expenses: ReadonlyArray<ExpenseRow>
  readonly balances: ReadonlyArray<BalanceRow>
  readonly settlements: ReadonlyArray<{
    readonly id: string
    readonly fromUserId: string
    readonly toUserId: string
    readonly amountMinor: number
    readonly currency: string
    readonly method: string
    readonly settledOn: string
  }>
  readonly budgetItems: ReadonlyArray<{
    readonly id: string
    readonly name: string
    readonly category: string
    readonly plannedAmountMinor: number
    readonly currency: string
  }>
  readonly people: ReadonlyArray<PersonChip>
  readonly viewerUserId: string
}

export const loadTripCosts = createServerFn({ method: 'GET' })
  .validator(tripInput)
  .handler(async ({ data }): Promise<CostsPayload> => {
    const scope = await appScope()
    const trip = await requireTrip(scope, data.tripId)

    const [summary, expenses, balances, settlements, budget, people] =
      await Promise.all([
        getTripSpendSummary(scope, trip.id),
        listTripExpenses(scope, trip.id),
        getMemberBalances(scope, trip.id),
        listSettlements(scope, trip.id),
        listBudgetItems(scope, trip.id),
        loadPeople(trip.id, scope),
      ])

    return {
      currency: summary.currency,
      plannedMinor: summary.plannedMinor,
      spentMinor: summary.spentMinor,
      budgetTargetMinor: summary.budgetTargetMinor,
      expenseCount: summary.expenseCount,
      byCategory: summary.byCategory,
      people,
      viewerUserId: scope.ctx.userId,
      expenses: expenses.map((row) => ({
        id: row.id,
        title: row.title,
        category: row.category,
        amountMinor: row.amountMinor,
        currency: row.currency,
        originalAmountMinor: row.originalAmountMinor,
        originalCurrency: row.originalCurrency,
        spentOn: row.spentOn,
        paidBy: row.paidBy,
        splitMethod: row.splitMethod,
        notes: row.notes,
      })),
      balances: balances.map((row) => ({
        userId: row.userId,
        paidMinor: row.paidMinor,
        shareMinor: row.shareMinor,
        balanceMinor: row.balanceMinor,
      })),
      settlements: settlements.map((row) => ({
        id: row.id,
        fromUserId: row.fromUserId,
        toUserId: row.toUserId,
        amountMinor: row.amountMinor,
        currency: row.currency,
        method: row.method,
        settledOn: row.settledOn,
      })),
      budgetItems: budget.map((row) => ({
        id: row.id,
        name: row.name,
        category: row.category,
        plannedAmountMinor: row.plannedAmountMinor,
        currency: row.currency,
      })),
    }
  })

/* ------------------------------------------------------------------ files */

export interface FileRow {
  readonly id: string
  readonly filename: string
  readonly contentType: string
  readonly sizeBytes: number
  readonly kind: string
  readonly description: string | null
  readonly uploadedBy: string
  readonly createdAt: string
}

export interface FilesPayload {
  readonly files: ReadonlyArray<FileRow>
  readonly tripBytes: number
  readonly workspaceBytes: number
  readonly limitBytes: number
  readonly byKind: ReadonlyArray<{
    readonly kind: string
    readonly fileCount: number
    readonly bytes: number
  }>
  readonly people: ReadonlyArray<PersonChip>
}

export const loadTripFiles = createServerFn({ method: 'GET' })
  .validator(tripInput)
  .handler(async ({ data }): Promise<FilesPayload> => {
    const scope = await appScope()
    const trip = await requireTrip(scope, data.tripId)

    const [files, tripBytes, usage, quotas, people] = await Promise.all([
      listTripFiles(scope, trip.id),
      getTripStorageBytes(scope, trip.id),
      getStorageUsage(scope),
      resolveQuotas(scope),
      loadPeople(trip.id, scope),
    ])

    return {
      tripBytes,
      people,
      workspaceBytes: usage.bytes,
      limitBytes: quotas.limits.storage_bytes,
      byKind: usage.byKind,
      files: files.map((row) => ({
        id: row.id,
        filename: row.filename,
        contentType: row.contentType,
        sizeBytes: row.sizeBytes,
        kind: row.kind,
        description: row.description,
        uploadedBy: row.uploadedBy,
        createdAt: isoOfRequired(row.createdAt),
      })),
    }
  })

/* ----------------------------------------------------------------- collab */

export interface MessageRow {
  readonly id: string
  readonly userId: string
  readonly body: string
  readonly replyToId: string | null
  readonly editedAt: string | null
  readonly createdAt: string
  readonly reactions: ReadonlyArray<{
    readonly emoji: string
    readonly count: number
    readonly userIds: ReadonlyArray<string>
  }>
}

export interface NoteRow {
  readonly id: string
  readonly title: string
  readonly body: string | null
  readonly category: string | null
  readonly colour: string | null
  readonly isPinned: boolean
  readonly createdBy: string
  readonly createdAt: string
}

export interface PollRow {
  readonly id: string
  readonly question: string
  readonly options: ReadonlyArray<PollOption>
  readonly allowMultiple: boolean
  readonly isClosed: boolean
  readonly createdBy: string
  readonly totalVotes: number
  readonly tally: ReadonlyArray<{
    readonly optionId: string
    readonly label: string
    readonly votes: number
    readonly userIds: ReadonlyArray<string>
  }>
}

export interface CollabPayload {
  readonly messages: ReadonlyArray<MessageRow>
  readonly notes: ReadonlyArray<NoteRow>
  readonly polls: ReadonlyArray<PollRow>
  readonly people: ReadonlyArray<PersonChip>
  readonly viewerUserId: string
  /**
   * IANA zone the transcript is read in — the trip's own, falling back to UTC.
   *
   * Every timestamp in the thread is formatted in this zone rather than the
   * browser's. That is the right answer twice over: a shared itinerary is
   * discussed in the destination's wall-clock time, so two travellers in
   * different countries read the same "19:30"; and because the zone travels with
   * the payload, the server and the client format identically and the transcript
   * hydrates without a mismatch.
   */
  readonly timeZone: string
}

export const loadTripCollab = createServerFn({ method: 'GET' })
  .validator(tripInput)
  .handler(async ({ data }): Promise<CollabPayload> => {
    const scope = await appScope()
    const trip = await requireTrip(scope, data.tripId)

    const [page, notes, polls, people] = await Promise.all([
      listMessages(scope, trip.id, { limit: 50 }),
      listNotes(scope, trip.id),
      listPolls(scope, trip.id),
      loadPeople(trip.id, scope),
    ])

    const reactions = await listReactions(
      scope,
      page.items.map((row) => row.id),
    )

    const votes = await Promise.all(
      polls.map((poll) => listVotes(scope, poll.id)),
    )

    return {
      people,
      viewerUserId: scope.ctx.userId,
      timeZone: resolveTimeZone(trip.timezone),
      // The repository pages newest-first; a transcript reads oldest-first.
      messages: [...page.items].reverse().map((row) => ({
        id: row.id,
        userId: row.userId,
        body: row.body,
        replyToId: row.replyToId,
        editedAt: isoOf(row.editedAt),
        createdAt: isoOfRequired(row.createdAt),
        reactions: reactions.get(row.id) ?? [],
      })),
      notes: notes.map((row) => ({
        id: row.id,
        title: row.title,
        body: row.body,
        category: row.category,
        colour: row.colour,
        isPinned: row.isPinned,
        createdBy: row.createdBy,
        createdAt: isoOfRequired(row.createdAt),
      })),
      polls: polls.map((poll, index) => {
        const cast = votes[index] ?? []
        return {
          id: poll.id,
          question: poll.question,
          options: poll.options,
          allowMultiple: poll.allowMultiple,
          isClosed: poll.isClosed,
          createdBy: poll.createdBy,
          totalVotes: cast.length,
          tally: poll.options.map((option) => {
            const forOption = cast.filter((vote) => vote.optionId === option.id)
            return {
              optionId: option.id,
              label: option.label,
              votes: forOption.length,
              userIds: forOption.map((vote) => vote.userId),
            }
          }),
        }
      }),
    }
  })

/* ------------------------------------------------------------- plan writes */

/**
 * Adds a place to the trip's inventory. Coordinates and day assignment come
 * later, from the map: this is the keyboard-only path into an empty plan.
 */
export const createPlaceFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tripId: z.string().trim().min(1).max(64),
      name: z.string().trim().min(1).max(160),
      city: z.string().trim().max(160),
      address: z.string().trim().max(240),
      categoryId: z.string().trim().max(64),
      durationMinutes: z.number().int().min(0).max(10_080),
    }),
  )
  .handler(async ({ data }): Promise<{ readonly placeId: string }> => {
    const scope = await appScope()
    const place = await createPlace(scope, {
      tripId: data.tripId,
      name: data.name,
      city: data.city === '' ? null : data.city,
      address: data.address === '' ? null : data.address,
      categoryId: data.categoryId === '' ? null : data.categoryId,
      durationMinutes: data.durationMinutes,
    })
    return { placeId: place.id }
  })

/* ----------------------------------------------------------- collab writes */

/**
 * Posts a message to the trip's conversation.
 *
 * The transcript is the one panel on the collaboration screen a reader expects
 * to be able to answer from, so the composer writes through the same repository
 * the loader reads — no optimistic local list that can disagree with the server.
 */
export const postMessageFn = createServerFn({ method: 'POST' })
  .validator(
    z.object({
      tripId: z.string().trim().min(1).max(64),
      body: z.string().trim().min(1).max(4000),
    }),
  )
  .handler(async ({ data }): Promise<{ readonly messageId: string }> => {
    const scope = await appScope()
    const message = await postMessage(scope, {
      tripId: data.tripId,
      body: data.body,
    })
    return { messageId: message.id }
  })
