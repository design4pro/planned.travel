/**
 * The loader behind a trip's collaboration screen.
 *
 * It resolves the trip first - `requireTrip` turns an id from another tenant, or a private trip
 * the caller cannot see, into a 404 before any child row is read - and then composes the three
 * sub-features' payload builders and the trip's people in one round.
 */
import { createServerFn } from '@tanstack/react-start'

import { requireTrip } from '#/server/repos'
import { resolveTimeZone } from '#/lib/time'
import {
  notesPayload,
  pollsPayload,
  threadPayload,
} from '#/server/fns/collab-payloads'
import { appScope } from '../../../-server/context'
import { loadPeople, tripInput } from '../../../-server/trip'

import type { MessageRow, NoteRow, PollRow } from '#/server/fns/collab-payloads'
import type { PersonChip } from '../../../-server/trip'

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

    const [messages, notes, polls, people] = await Promise.all([
      threadPayload(scope, trip),
      notesPayload(scope, trip),
      pollsPayload(scope, trip),
      loadPeople(trip.id, scope),
    ])

    return {
      people,
      viewerUserId: scope.ctx.userId,
      timeZone: resolveTimeZone(trip.timezone),
      messages,
      notes,
      polls,
    }
  })
