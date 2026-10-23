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

/** {@link nullWhenMissing} for a whole payload: the payload flagged found, or {@link ABSENT}. */
export async function orAbsent<Payload extends object>(
  read: () => Promise<Payload>,
): Promise<OrAbsent<Payload>> {
  const payload = await nullWhenMissing(read)
  return payload === null ? ABSENT : { ...payload, found: true }
}
