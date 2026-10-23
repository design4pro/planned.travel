import { ABSENT } from '#/lib/absence'
import { NotFoundError } from '#/server/repos'

import type { OrAbsent } from '#/lib/absence'

/**
 * Runs a read and answers `null` when the repository reports the row missing.
 *
 * Only `NotFoundError` is mapped. Auth, forbidden and tenant-isolation failures keep throwing so
 * they reach the error boundary, and so does everything unexpected: the repository raises the same
 * error for another workspace's id and for a nonexistent one, which is what keeps the two
 * indistinguishable to the reader.
 *
 * Resolve the session scope before calling this and pass the read as a closure: a not-found raised
 * while resolving the caller is not an absent row and must not be reported as one.
 */
export async function nullWhenMissing<Row>(
  read: () => Promise<Row>,
): Promise<Row | null> {
  try {
    return await read()
  } catch (cause) {
    if (cause instanceof NotFoundError) return null
    throw cause
  }
}

/**
 * A whole trip-tab payload: the payload flagged found, or {@link ABSENT} when the trip itself is
 * missing.
 *
 * The read runs as one unit, so the mapping names the trip: a not-found raised by another row the
 * read touches (an expense deleted between two queries) is a real failure of a trip the reader can
 * open, and keeps throwing so the screen offers a retry instead of claiming the trip is gone.
 */
export async function orAbsent<Payload extends object>(
  tripId: string,
  read: () => Promise<Payload>,
): Promise<OrAbsent<Payload>> {
  try {
    return { ...(await read()), found: true }
  } catch (cause) {
    if (
      cause instanceof NotFoundError &&
      cause.entity === 'trip' &&
      cause.id === tripId
    ) {
      return ABSENT
    }
    throw cause
  }
}
