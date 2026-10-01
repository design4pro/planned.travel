/**
 * Payload builders shared by the board's tests: the three loader reads, with nothing in them
 * a case does not name.
 */
import type { PlanNotesPayload } from '../../-server/day-notes'
import type {
  PlanBoardDay,
  PlanBoardPayload,
  PlanBoardPlace,
  PlanBoardStop,
} from '../../-server/plan'
import type {
  PlanTransport,
  PlanTransportsPayload,
} from '../../-server/plan-transports'

export function notes(
  entries: PlanNotesPayload['notes'],
  canWrite = true,
): PlanNotesPayload {
  return { tripId: 't1', canWrite, notes: entries }
}

export const note = (
  id: string,
  dayId: string,
  sortOrder: number,
  extra: Partial<PlanNotesPayload['notes'][number]> = {},
): PlanNotesPayload['notes'][number] => ({
  id,
  dayId,
  body: `Note ${id}`,
  detail: null,
  time: null,
  icon: 'sticky-note',
  sortOrder,
  ...extra,
})

export const stop = (
  assignmentId: string,
  placeId: string,
  position: number,
  startTime: string | null = null,
): PlanBoardStop => ({
  assignmentId,
  placeId,
  position,
  startTime,
  endTime: null,
  durationMinutes: null,
  reservationStatus: 'none',
  notes: null,
})

export const place = (id: string): PlanBoardPlace => ({
  id,
  name: `Place ${id}`,
  address: null,
  city: null,
  categoryId: 'c1',
  imageUrl: null,
  website: null,
  description: null,
  rating: null,
  lat: 35.71,
  lng: 139.79,
  isVisited: false,
  durationMinutes: 60,
})

export const day = (
  dayId: string,
  dayNumber: number,
  stops: ReadonlyArray<PlanBoardStop>,
  title: string | null = `Day ${dayNumber}`,
): PlanBoardDay => ({
  dayId,
  dayNumber,
  date: null,
  title,
  stops,
  stays: [],
})

/** A board carrying exactly the places its days point at. */
export function board(days: ReadonlyArray<PlanBoardDay>): PlanBoardPayload {
  const placeIds = [
    ...new Set(days.flatMap((entry) => entry.stops.map((one) => one.placeId))),
  ]
  return {
    tripId: 't1',
    editable: true,
    archived: false,
    days,
    places: placeIds.map((id) => place(id)),
    unscheduledIds: [],
    categories: [],
    currency: 'JPY',
    bookingDays: [],
  }
}

export const journey = (
  id: string,
  extra: Partial<PlanTransport> = {},
): PlanTransport => ({
  kind: 'transport',
  id,
  mode: 'train',
  status: 'confirmed',
  serviceNumber: 'Nozomi 21',
  fromName: 'Tokyo',
  toName: 'Kyoto',
  departureDayId: 'd1',
  arrivalDayId: 'd1',
  departureTime: null,
  arrivalTime: null,
  priceMinor: null,
  currency: null,
  position: 0,
  ...extra,
})

export const transports = (
  entries: ReadonlyArray<PlanTransport> = [],
): PlanTransportsPayload => ({ tripId: 't1', transports: entries })
