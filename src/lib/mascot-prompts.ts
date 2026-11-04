import { isDismissed } from '#/lib/mascot-suppression'
import { dayKeyIn } from '#/lib/time'

type Notification = {
  source: 'notification'
  id: string
  occurrence: string
  action: boolean
}
type Scheduled = {
  source: 'reservation' | 'event'
  id: string
  tripId: string
  occurrence: string
  instant?: string | null
  zone?: string | null
}
export type MascotCandidate = Notification | Scheduled

function ordinal(value: string): number | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const time = Date.parse(`${value}T00:00:00Z`)
  return Number.isFinite(time) &&
    new Date(time).toISOString().slice(0, 10) === value
    ? time / 86_400_000
    : null
}

function localDay(time: number, zone: string): number | null {
  try {
    return ordinal(dayKeyIn(new Date(time).toISOString(), zone))
  } catch {
    return null
  }
}

export function selectMascotPrompt(input: {
  today: string
  nowMs: number
  candidates: ReadonlyArray<MascotCandidate>
  dismissed: Parameters<typeof isDismissed>[0]
}): MascotCandidate | null {
  const today = ordinal(input.today)
  if (today === null || !Number.isFinite(input.nowMs)) return null
  const eligible = input.candidates.flatMap<{
    candidate: MascotCandidate
    rank: number
    day: number
    time: number
  }>((candidate) => {
    if (
      isDismissed(
        input.dismissed,
        candidate.source,
        candidate.id,
        candidate.occurrence,
        input.nowMs,
      )
    )
      return []
    if (candidate.source === 'notification') {
      if (!/(?:Z|[+-]\d{2}:\d{2})$/i.test(candidate.occurrence)) return []
      const time = Date.parse(candidate.occurrence)
      if (
        !Number.isFinite(time) ||
        time > input.nowMs ||
        time < input.nowMs - 7 * 86_400_000
      )
        return []
      return [
        { candidate, rank: candidate.action ? 1 : 3, day: 0, time: -time },
      ]
    }
    let day = ordinal(candidate.occurrence)
    let current = today
    let time = Number.POSITIVE_INFINITY
    if (
      candidate.instant &&
      candidate.zone &&
      /(?:Z|[+-]\d{2}:\d{2})$/i.test(candidate.instant)
    ) {
      const instant = Date.parse(candidate.instant)
      const eventDay = Number.isFinite(instant)
        ? localDay(instant, candidate.zone)
        : null
      const localToday = localDay(input.nowMs, candidate.zone)
      if (eventDay !== null && localToday !== null) {
        if (instant < input.nowMs) return []
        day = eventDay
        current = localToday
        time = instant
      }
    }
    if (day === null || day < current || day > current + 7) return []
    const offset = day - current
    return [{ candidate, rank: offset === 0 ? 0 : 2, day: offset, time }]
  })
  eligible.sort((a, b) => {
    const order = a.rank - b.rank || a.day - b.day || a.time - b.time
    if (order) return order
    if (a.candidate.source !== b.candidate.source)
      return a.candidate.source < b.candidate.source ? -1 : 1
    if (a.candidate.id === b.candidate.id) return 0
    return a.candidate.id < b.candidate.id ? -1 : 1
  })
  return eligible[0]?.candidate ?? null
}
