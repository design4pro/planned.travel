/**
 * The loader behind a trip's collaboration screen.
 *
 * It resolves the trip first - `requireTrip` turns an id from another tenant, or a private trip
 * the caller cannot see, into a 404 before any child row is read - and then composes the three
 * sections' payload builders and the trip's people in one round.
 */
import { createServerFn } from '@tanstack/react-start'

import {
  CollabSectionsError,
  canWritePlan,
  countMessages,
  requireTrip,
  setTripCollabSections,
  tripRoleFor,
} from '#/server/repos'
import {
  collabSectionChangeSchema,
  resolveCollabSections,
} from '#/lib/collab-sections'
import { mirrorToRoom, patch } from '#/server/fns/context'
import type { OrAbsent } from '#/lib/absence'
import type { CollabSections } from '#/lib/collab-sections'
import { resolveTimeZone } from '#/lib/time'
import {
  notesPayload,
  pollsPayload,
  threadPayload,
} from '#/server/fns/collab-payloads'
import { ABSENT } from '#/lib/absence'
import { nullWhenMissing } from '#/server/fns/-lib/absence'
import { appScope } from '../../../-server/context'
import { loadPeople, tripInput } from '../../../-server/trip'

import type { MessageRow, NoteRow, PollRow } from '#/server/fns/collab-payloads'
import type { PersonChip } from '../../../-server/trip'

export interface CollabPayload {
  readonly sections: CollabSections
  readonly canConfigure: boolean
  readonly messages: ReadonlyArray<MessageRow>
  /**
   * Every message of the conversation, not only the window in `messages`; null while the
   * conversation section is switched off, when no count is read.
   */
  readonly messageCount: number | null
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
  .handler(async ({ data }): Promise<OrAbsent<CollabPayload>> => {
    const scope = await appScope()
    const trip = await nullWhenMissing(() => requireTrip(scope, data.tripId))
    if (trip === null) return ABSENT

    const sections = resolveCollabSections(trip.collabModules)
    const role = await tripRoleFor(scope, trip.id, scope.ctx.userId)

    const [messages, messageCount, notes, polls, people] = await Promise.all([
      threadPayload(scope, trip),
      sections.conversation ? countMessages(scope, trip.id) : null,
      notesPayload(scope, trip),
      pollsPayload(scope, trip),
      loadPeople(trip.id, scope),
    ])

    return {
      found: true,
      sections,
      canConfigure: canWritePlan(trip, role),
      people,
      viewerUserId: scope.ctx.userId,
      timeZone: resolveTimeZone(trip.timezone),
      messages,
      messageCount,
      notes,
      polls,
    }
  })

export type CollabSectionWrite =
  | { readonly ok: true; readonly sections: CollabSections }
  | { readonly ok: false; readonly reason: 'last-section' }

export const setCollabSectionFn = createServerFn({ method: 'POST' })
  .validator(collabSectionChangeSchema)
  .handler(async ({ data }): Promise<CollabSectionWrite> => {
    const scope = await appScope()
    let sections: CollabSections
    try {
      sections = await setTripCollabSections(scope, data.tripId, {
        section: data.section,
        on: data.on,
      })
    } catch (cause) {
      if (cause instanceof CollabSectionsError) {
        return { ok: false, reason: 'last-section' }
      }
      throw cause
    }
    await mirrorToRoom(scope, data.tripId, [
      patch('trip', data.tripId, { collabSectionsChangedAt: Date.now() }),
    ])
    return { ok: true, sections }
  })
