/**
 * Writes one {@link SeedTrip} through the repositories.
 *
 * A single generic pass covers all six trips: the flagship simply supplies every optional collection
 * and the draft supplies none. Everything goes through `src/server/repos`, so tenant scoping, Zod
 * validation, slug reservation, quota guards, the day-run invariant and the split arithmetic are all
 * exercised rather than bypassed — which is the point of seeding this way instead of writing SQL.
 *
 * Cross-references in the dataset are by `key`; this module resolves each one to a generated id as it
 * goes, and a reference that does not resolve is dropped rather than written as a dangling column.
 */

import {
  addTripMember,
  collabMessageReactionsAccess,
  collabMessagesRepository,
  castVote,
  createAccommodation,
  createAssignment,
  createBudgetItem,
  createCollabNote,
  createExpense,
  createList,
  createListItem,
  createDayNote,
  createPlace,
  createPoll,
  createReservation,
  createSettlement,
  createTransport,
  createTrip,
  listTripDays,
  listTripMembers,
  packingItemsRepository,
  recordFile,
  resolveTags,
  setAssignmentParticipants,
  setPlaceTags,
  updateDay,
  updateTripMember,
} from '#/server/repos'
import { SEED_ANCHOR_INSTANT, minutesBeforeAnchor } from './dataset'
import type { TenantScope } from '#/server/repos'
import type { PersonKey, SeedSplit, SeedTrip } from './types'

/** Row counts produced by one trip, used for the seed report and the verification query. */
export interface TripCounts {
  readonly tripId: string
  readonly days: number
  readonly dayNotes: number
  readonly places: number
  readonly stops: number
  readonly accommodations: number
  readonly transports: number
  readonly reservations: number
  readonly budgetItems: number
  readonly expenses: number
  readonly expenseShares: number
  readonly settlements: number
  readonly lists: number
  readonly listItems: number
  readonly messages: number
  readonly reactions: number
  readonly notes: number
  readonly polls: number
  readonly votes: number
  readonly files: number
  readonly members: number
}

export interface TripApplyContext {
  /** The workspace owner's scope; every structural write is attributed to them. */
  readonly owner: TenantScope
  /** One scope per traveller, so authored content carries the right name. */
  readonly scopes: ReadonlyMap<PersonKey, TenantScope>
  /** Slug of every category available in the workspace, mapped to its id. */
  readonly categoryIds: ReadonlyMap<string, string>
  /** Colour each traveller is drawn in, from the workspace people list. */
  readonly colours: ReadonlyMap<PersonKey, string>
}

/** Scope for a person, falling back to the owner when a dataset key is unknown. */
function scopeFor(context: TripApplyContext, person: PersonKey): TenantScope {
  return context.scopes.get(person) ?? context.owner
}

function userIdFor(context: TripApplyContext, person: PersonKey): string {
  return scopeFor(context, person).ctx.userId
}

/** Maps dataset split rows onto the participant shape `createExpense` validates. */
function participantsFor(
  context: TripApplyContext,
  splits: ReadonlyArray<SeedSplit>,
): Array<{
  userId: string
  weight?: number
  shareMinor?: number
  percentage?: number
}> {
  return splits.map((split) => ({
    userId: userIdFor(context, split.person),
    ...(split.weight === undefined ? {} : { weight: split.weight }),
    ...(split.shareMinor === undefined ? {} : { shareMinor: split.shareMinor }),
    ...(split.percentage === undefined ? {} : { percentage: split.percentage }),
  }))
}

/**
 * Creates the trip and every child row the dataset supplies, in dependency order.
 *
 * The caller guarantees the trip does not already exist — `applySeed` deletes a stale one first — so
 * this function never has to reconcile, only build.
 */
export async function applyTrip(
  context: TripApplyContext,
  trip: SeedTrip,
): Promise<TripCounts> {
  const owner = context.owner

  const created = await createTrip(owner, {
    // The dataset owns this key on purpose — see `SeedTrip.id`. Everything else the seed writes
    // still takes a generated one, because nothing else is drawn from its own identifier.
    id: trip.id,
    title: trip.title,
    slug: trip.slug,
    summary: trip.summary,
    description: trip.description ?? null,
    destination: trip.destination,
    countryCodes: [...trip.countryCodes],
    startDate: trip.startDate ?? null,
    endDate: trip.endDate ?? null,
    timezone: trip.timezone ?? null,
    currency: trip.currency,
    status: trip.status,
    visibility: trip.visibility,
    accentColour: trip.accentColour,
    budgetTargetMinor: trip.budgetTargetMinor ?? null,
    ...(trip.reminderDays === undefined
      ? {}
      : { reminderDays: trip.reminderDays }),
    isFavourite: trip.isFavourite ?? false,
    isArchived: trip.isArchived ?? false,
  })
  const tripId = created.id

  /* -------------------------------------------------------------------------------- travellers */

  const existingMembers = await listTripMembers(owner, tripId)
  const memberByUser = new Map(existingMembers.map((row) => [row.userId, row]))
  let members = existingMembers.length

  for (const traveller of trip.travellers) {
    const userId = userIdFor(context, traveller.person)
    const existing = memberByUser.get(userId)
    const colour = colourFor(context, traveller.person)
    if (existing) {
      await updateTripMember(owner, existing.id, {
        role: traveller.role,
        colour,
        joinedAt: created.createdAt,
      })
      continue
    }
    await addTripMember(owner, {
      tripId,
      userId,
      role: traveller.role,
      colour,
      joinedAt: created.createdAt,
    })
    members += 1
  }

  /* --------------------------------------------------------------------------------------- days */

  const dayRows = await listTripDays(owner, tripId)
  const dayIdByNumber = new Map(dayRows.map((row) => [row.dayNumber, row.id]))
  const dayDateByNumber = new Map(
    dayRows.map((row) => [row.dayNumber, row.date]),
  )

  let dayNotes = 0
  for (const day of trip.days ?? []) {
    const dayId = dayIdByNumber.get(day.dayNumber)
    if (dayId === undefined) {
      continue
    }
    await updateDay(owner, dayId, { title: day.title, notes: day.notes })
    for (const [index, pin] of (day.pins ?? []).entries()) {
      await createDayNote(owner, {
        tripId,
        dayId,
        body: pin.body,
        time: pin.time ?? null,
        ...(pin.icon === undefined ? {} : { icon: pin.icon }),
        sortOrder: index,
      })
      dayNotes += 1
    }
  }

  /* ------------------------------------------------------------------------------------- places */

  const placeIdByKey = new Map<string, string>()
  for (const [index, place] of (trip.places ?? []).entries()) {
    const row = await createPlace(owner, {
      tripId,
      name: place.name,
      categoryId: context.categoryIds.get(place.categorySlug) ?? null,
      description: place.description ?? null,
      notes: place.notes ?? null,
      lat: place.lat,
      lng: place.lng,
      address: place.address,
      city: place.city,
      countryCode: place.countryCode,
      website: place.website ?? null,
      openingHours: place.openingHours ?? null,
      rating: place.rating ?? null,
      durationMinutes: place.durationMinutes,
      transportMode: place.transportMode,
      priceMinor: place.priceMinor ?? null,
      currency: place.currency ?? null,
      source: 'manual',
      isVisited: place.isVisited ?? false,
      sortOrder: index,
    })
    placeIdByKey.set(place.key, row.id)

    if (place.tags && place.tags.length > 0) {
      const tags = await resolveTags(owner, [...place.tags])
      await setPlaceTags(
        owner,
        row.id,
        tags.map((tag) => tag.id),
      )
    }
  }

  /* -------------------------------------------------------------------------------------- stops */

  let stops = 0
  const orderByDay = new Map<number, number>()
  for (const stop of trip.stops ?? []) {
    const dayId = dayIdByNumber.get(stop.dayNumber)
    const placeId = placeIdByKey.get(stop.placeKey)
    if (dayId === undefined || placeId === undefined) {
      continue
    }
    const orderIndex = orderByDay.get(stop.dayNumber) ?? 0
    orderByDay.set(stop.dayNumber, orderIndex + 1)

    const assignment = await createAssignment(owner, {
      tripId,
      dayId,
      placeId,
      orderIndex,
      startTime: stop.startTime ?? null,
      endTime: stop.endTime ?? null,
      durationMinutes: stop.durationMinutes ?? null,
      transportMode: stop.transportMode ?? null,
      notes: stop.notes ?? null,
      ...(stop.reservationStatus === undefined
        ? {}
        : { reservationStatus: stop.reservationStatus }),
    })
    stops += 1

    const participants =
      stop.participants ?? trip.travellers.map((traveller) => traveller.person)
    await setAssignmentParticipants(
      owner,
      assignment.id,
      participants.map((person) => userIdFor(context, person)),
    )
  }

  /* ----------------------------------------------------------------------------- accommodations */

  let accommodations = 0
  for (const stay of trip.accommodations ?? []) {
    const startDayId = dayIdByNumber.get(stay.startDay)
    const endDayId = dayIdByNumber.get(stay.endDay)
    if (startDayId === undefined || endDayId === undefined) {
      continue
    }
    await createAccommodation(owner, {
      tripId,
      startDayId,
      endDayId,
      placeId:
        stay.placeKey === undefined
          ? null
          : (placeIdByKey.get(stay.placeKey) ?? null),
      name: stay.name,
      address: stay.address,
      checkInTime: stay.checkInTime ?? null,
      checkInEndTime: stay.checkInEndTime ?? null,
      checkOutTime: stay.checkOutTime ?? null,
      confirmationNumber: stay.confirmationNumber,
      priceMinor: stay.priceMinor,
      currency: stay.currency,
      notes: stay.notes ?? null,
    })
    accommodations += 1
  }

  /* --------------------------------------------------------------------------------- transports */

  const transportIdByKey = new Map<string, string>()
  for (const [index, transport] of (trip.transports ?? []).entries()) {
    const row = await createTransport(owner, {
      tripId,
      dayId:
        transport.dayNumber === undefined
          ? null
          : (dayIdByNumber.get(transport.dayNumber) ?? null),
      mode: transport.mode,
      status: transport.status,
      title: transport.title,
      carrier: transport.carrier ?? null,
      serviceNumber: transport.serviceNumber ?? null,
      bookingCode: transport.bookingCode ?? null,
      seat: transport.seat ?? null,
      departureName: transport.departureName,
      departureCode: transport.departureCode ?? null,
      departureLat: transport.departureLat,
      departureLng: transport.departureLng,
      departureDate: transport.departureDate,
      departureTime: transport.departureTime,
      departureTimezone: transport.departureTimezone,
      arrivalName: transport.arrivalName,
      arrivalCode: transport.arrivalCode ?? null,
      arrivalLat: transport.arrivalLat,
      arrivalLng: transport.arrivalLng,
      arrivalDate: transport.arrivalDate,
      arrivalTime: transport.arrivalTime,
      arrivalTimezone: transport.arrivalTimezone,
      distanceMetres: transport.distanceMetres,
      priceMinor: transport.priceMinor,
      currency: transport.currency,
      notes: transport.notes ?? null,
      sortOrder: index,
    })
    transportIdByKey.set(transport.key, row.id)
  }

  /* ------------------------------------------------------------------------------- reservations */

  const reservationIdByKey = new Map<string, string>()
  for (const [index, booking] of (trip.reservations ?? []).entries()) {
    const dayId =
      booking.startDay === undefined
        ? null
        : (dayIdByNumber.get(booking.startDay) ?? null)
    const endDayId =
      booking.endDay === undefined
        ? null
        : (dayIdByNumber.get(booking.endDay) ?? null)
    const row = await createReservation(owner, {
      tripId,
      dayId,
      endDayId,
      placeId:
        booking.placeKey === undefined
          ? null
          : (placeIdByKey.get(booking.placeKey) ?? null),
      transportId:
        booking.transportKey === undefined
          ? null
          : (transportIdByKey.get(booking.transportKey) ?? null),
      type: booking.type,
      status: booking.status,
      title: booking.title,
      provider: booking.provider ?? null,
      location: booking.location ?? null,
      url: booking.url ?? null,
      confirmationNumber: booking.confirmationNumber ?? null,
      startDate:
        booking.startDay === undefined
          ? null
          : (dayDateByNumber.get(booking.startDay) ?? null),
      startTime: booking.startTime ?? null,
      endDate:
        booking.endDay === undefined
          ? null
          : (dayDateByNumber.get(booking.endDay) ?? null),
      endTime: booking.endTime ?? null,
      guests: booking.guests ?? null,
      priceMinor: booking.priceMinor ?? null,
      currency: booking.currency ?? null,
      notes: booking.notes ?? null,
      sortOrder: index,
    })
    reservationIdByKey.set(booking.key, row.id)
  }

  /* ---------------------------------------------------------------------------- budget and money */

  const budgetIdByKey = new Map<string, string>()
  for (const [index, item] of (trip.budgetItems ?? []).entries()) {
    const row = await createBudgetItem(owner, {
      tripId,
      category: item.category,
      name: item.name,
      plannedAmountMinor: item.plannedAmountMinor,
      currency: item.currency,
      persons: item.persons ?? null,
      days: item.days ?? null,
      note: item.note ?? null,
      sortOrder: index,
    })
    budgetIdByKey.set(item.key, row.id)
  }

  const expenseIdByKey = new Map<string, string>()
  let expenseShares = 0
  for (const expense of trip.expenses ?? []) {
    const { expense: row, shares } = await createExpense(owner, {
      tripId,
      dayId:
        expense.dayNumber === undefined
          ? null
          : (dayIdByNumber.get(expense.dayNumber) ?? null),
      placeId:
        expense.placeKey === undefined
          ? null
          : (placeIdByKey.get(expense.placeKey) ?? null),
      budgetItemId:
        expense.budgetItemKey === undefined
          ? null
          : (budgetIdByKey.get(expense.budgetItemKey) ?? null),
      category: expense.category,
      title: expense.title,
      amountMinor: expense.amountMinor,
      currency: expense.currency,
      originalAmountMinor: expense.originalAmountMinor ?? null,
      originalCurrency: expense.originalCurrency ?? null,
      exchangeRate: expense.exchangeRate ?? null,
      spentOn: expense.spentOn,
      paidBy:
        expense.paidBy === null ? null : userIdFor(context, expense.paidBy),
      splitMethod: expense.splitMethod,
      notes: expense.notes ?? null,
      participants: participantsFor(context, expense.participants),
    })
    expenseIdByKey.set(expense.key, row.id)
    expenseShares += shares.length
  }

  let settlements = 0
  for (const settlement of trip.settlements ?? []) {
    await createSettlement(owner, {
      tripId,
      fromUserId: userIdFor(context, settlement.from),
      toUserId: userIdFor(context, settlement.to),
      amountMinor: settlement.amountMinor,
      currency: settlement.currency,
      method: settlement.method,
      settledOn: settlement.settledOn,
      note: settlement.note,
    })
    settlements += 1
  }

  /* -------------------------------------------------------------------------------------- lists */

  let lists = 0
  let listItems = 0
  for (const [listIndex, list] of (trip.lists ?? []).entries()) {
    const listRow = await createList(owner, {
      tripId,
      name: list.name,
      kind: list.kind,
      colour: list.colour,
      icon: list.icon,
      ownerUserId:
        list.owner === undefined ? null : userIdFor(context, list.owner),
      weightLimitGrams: list.weightLimitGrams ?? null,
      sortOrder: listIndex,
    })
    lists += 1

    for (const [itemIndex, item] of list.items.entries()) {
      const itemRow = await createListItem(owner, {
        listId: listRow.id,
        name: item.name,
        category: item.category,
        description: item.description ?? null,
        ...(item.quantity === undefined ? {} : { quantity: item.quantity }),
        weightGrams: item.weightGrams ?? null,
        assignedTo:
          item.assignedTo === undefined
            ? null
            : userIdFor(context, item.assignedTo),
        dueDate: item.dueDate ?? null,
        ...(item.priority === undefined ? {} : { priority: item.priority }),
        sortOrder: itemIndex,
      })
      listItems += 1
      if (item.isDone === true) {
        // `setListItemDone` stamps `doneAt` from the wall clock, and that column is the only value
        // in a packed row that two runs of this fixture would disagree about. The repository's own
        // update is used instead — still tenant-scoped, still validated — with the fixture's today.
        await packingItemsRepository.requireUpdate(owner, itemRow.id, {
          isDone: true,
          doneAt: SEED_ANCHOR_INSTANT,
        })
      }
    }
  }

  /* ---------------------------------------------------------------------------------- collab */

  const messageIdByKey = new Map<string, string>()
  let messages = 0
  let reactions = 0
  for (const message of trip.messages ?? []) {
    const authorScope = scopeFor(context, message.author)
    const createdAt = minutesBeforeAnchor(message.minutesAgo)
    // `postMessage` cannot backdate a row, and a chat where every bubble shares one timestamp does not
    // read as a conversation — so the repository's insert is used directly, still tenant-scoped.
    const row = await collabMessagesRepository.insert(authorScope, {
      tripId,
      userId: authorScope.ctx.userId,
      body: message.body,
      replyToId:
        message.replyTo === undefined
          ? null
          : (messageIdByKey.get(message.replyTo) ?? null),
      createdAt,
      updatedAt: createdAt,
    })
    messageIdByKey.set(message.key, row.id)
    messages += 1

    for (const reaction of message.reactions ?? []) {
      // Direct, like the message above: the seed's Marrakech trip is archived before its chat is
      // written, and `toggleReaction` refuses every write to an archived trip.
      const reactor = scopeFor(context, reaction.person)
      await collabMessageReactionsAccess.insert(reactor, {
        messageId: row.id,
        userId: reactor.ctx.userId,
        emoji: reaction.emoji,
      })
      reactions += 1
    }
  }

  let notes = 0
  for (const note of trip.notes ?? []) {
    await createCollabNote(scopeFor(context, note.author), {
      tripId,
      title: note.title,
      body: note.body,
      category: note.category,
      colour: note.colour,
      isPinned: note.isPinned ?? false,
      sortOrder: note.sortOrder,
    })
    notes += 1
  }

  let polls = 0
  let votes = 0
  for (const poll of trip.polls ?? []) {
    const pollRow = await createPoll(scopeFor(context, poll.author), {
      tripId,
      question: poll.question,
      options: poll.options.map((option) => ({
        id: option.id,
        label: option.label,
      })),
      allowMultiple: poll.allowMultiple ?? false,
    })
    polls += 1
    for (const vote of poll.votes) {
      await castVote(
        scopeFor(context, vote.person),
        tripId,
        pollRow.id,
        vote.optionId,
      )
      votes += 1
    }
  }

  /* -------------------------------------------------------------------------------------- files */

  let files = 0
  for (const file of trip.files ?? []) {
    await recordFile(scopeFor(context, file.uploadedBy), {
      tripId,
      placeId:
        file.placeKey === undefined
          ? null
          : (placeIdByKey.get(file.placeKey) ?? null),
      reservationId:
        file.reservationKey === undefined
          ? null
          : (reservationIdByKey.get(file.reservationKey) ?? null),
      transportId:
        file.transportKey === undefined
          ? null
          : (transportIdByKey.get(file.transportKey) ?? null),
      expenseId:
        file.expenseKey === undefined
          ? null
          : (expenseIdByKey.get(file.expenseKey) ?? null),
      storageKey: file.storageKey,
      filename: file.filename,
      contentType: file.contentType,
      sizeBytes: file.sizeBytes,
      kind: file.kind,
      description: file.description,
      width: file.width ?? null,
      height: file.height ?? null,
    })
    files += 1
  }

  return {
    tripId,
    days: dayRows.length,
    dayNotes,
    places: placeIdByKey.size,
    stops,
    accommodations,
    transports: transportIdByKey.size,
    reservations: reservationIdByKey.size,
    budgetItems: budgetIdByKey.size,
    expenses: expenseIdByKey.size,
    expenseShares,
    settlements,
    lists,
    listItems,
    messages,
    reactions,
    notes,
    polls,
    votes,
    files,
    members,
  }
}

/** Colour a traveller is drawn in, taken from the workspace people list. */
function colourFor(context: TripApplyContext, person: PersonKey): string {
  return context.colours.get(person) ?? '#256256'
}
