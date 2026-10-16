/** A reload remembers an unfinished request for at most one polling window. */
export const EXPORT_POLL_WINDOW_MS = 90_000
export interface PendingExport {
  readonly taskId: string
  readonly queuedAt: number
}
type StoragePort = Pick<Storage, 'getItem' | 'removeItem'>
const keyFor = (tripId: string) => `trip-export-pending:${tripId}`

export function readPendingExport(
  storage: StoragePort | null,
  tripId: string,
  now: number,
): PendingExport | null {
  if (storage === null) return null
  try {
    const raw = storage.getItem(keyFor(tripId))
    if (raw === null) return null
    const entry: unknown = JSON.parse(raw)
    if (
      typeof entry === 'object' &&
      entry !== null &&
      'taskId' in entry &&
      'queuedAt' in entry &&
      typeof entry.taskId === 'string' &&
      /^[A-Za-z0-9-]{1,128}$/.test(entry.taskId) &&
      typeof entry.queuedAt === 'number' &&
      Number.isFinite(entry.queuedAt) &&
      entry.queuedAt <= now &&
      now - entry.queuedAt < EXPORT_POLL_WINDOW_MS
    ) {
      return { taskId: entry.taskId, queuedAt: entry.queuedAt }
    }
    storage.removeItem(keyFor(tripId))
  } catch {
    // Storage can be disabled; the current page still follows the request.
  }
  return null
}

export function writePendingExport(
  storage: Pick<Storage, 'setItem' | 'removeItem'> | null,
  tripId: string,
  pending: PendingExport | null,
): void {
  if (storage === null) return
  try {
    if (pending === null) storage.removeItem(keyFor(tripId))
    else storage.setItem(keyFor(tripId), JSON.stringify(pending))
  } catch {
    // An unavailable store must not turn a successful request into a failure.
  }
}
