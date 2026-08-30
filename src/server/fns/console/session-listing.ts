/**
 * Reading one account's sessions — and a module of its own because of who calls it.
 *
 * The verb lives here rather than beside the two revokes in `./sessions`, and the split is a
 * bundling boundary before it is a taxonomy. A module under this directory has to be wholly one
 * kind, because the two kinds fail in opposite directions and each failure is invisible to the
 * other's gate:
 *
 * - A `createServerFn` whose only caller is another server function's handler is compiled to an RPC
 *   stub the build never registers, and throws `Server function info not found` in the deployed
 *   Worker (`scripts/check-server-fn-manifest.mjs` fails the build on it; see the header of
 *   `./users` for the whole account).
 * - A plain server-only function, conversely, cannot sit in a module a *client* component imports.
 *   A server function's handler is stripped from the client twin and its imports go with it; a
 *   plain function's body is not, so its reach into `./context` survives into the browser graph and
 *   the import-protection plugin denies `@tanstack/react-start/server` — the whole client build,
 *   not only the console.
 *
 * `./sessions` is imported by `-ui/session-actions.tsx` and `-ui/user-actions.tsx`, so it is the
 * client-reachable kind and every export in it is a server function. This read has no client caller
 * at all — `loadConsoleAccount` in `src/routes/_app/console/-server/users.ts` is the one — so it is
 * the plain kind, and it is here. `readSessions` is shared with the revoke path, which reaches it
 * from inside a handler and therefore drops it on the client.
 *
 * Reads are not audited (docs/ACCESS.md §4.2).
 */

import { z } from 'zod'

import { readSessionRows } from './bindings'
import { openConsoleCall, recordConsoleRead } from './context'
import { platformSessionSchema, toConsoleSession } from './projections'

import type { ConsoleSession, PlatformSessionRow } from './projections'

const userId = z.string().trim().min(1).max(64)

export const listPlatformSessionsInputSchema = z.object({ userId })

/** What one account holds, and whether the enumeration reached the end of it. */
export interface SessionListing {
  readonly sessions: ReadonlyArray<PlatformSessionRow>
  readonly truncated: boolean
}

/**
 * The account's live sessions, newest first.
 *
 * "Live" is a predicate and not a manner of speaking: `./bindings` excludes rows whose `expiresAt`
 * has passed. With `storeSessionInDatabase` a row is deleted only lazily, on the next `findSession`
 * that resolves it, so an account accumulates one for every device it never comes back to — and
 * without the predicate the console would render sessions that ended weeks ago as current, and
 * `revokePlatformSessionFn` would happily write `platform.session.revoked` for one of them.
 *
 * The enumeration is ordered by `id` so that offset paging is stable; the display order is applied
 * here, afterwards, in memory. Two orders because they answer different questions - one has to be a
 * total order over a paged read, the other has to put the session an operator is looking for at the
 * top - and conflating them is what makes a paged read lose rows.
 */
export async function readSessions(id: string): Promise<SessionListing> {
  const enumeration = await readSessionRows(id)
  const sessions = z
    .array(platformSessionSchema)
    .parse(enumeration.rows)
    .sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime())
  return { sessions, truncated: enumeration.truncated }
}

/**
 * One account's sessions. Not audited.
 *
 * `truncated` leaves with the page rather than being swallowed: a screen that showed six hundred
 * sessions as though they were all of them would be making the same claim a silent `LIMIT` makes,
 * and the operator deciding whether to revoke one session or all of them is exactly the reader who
 * needs to know the difference.
 */
export async function listPlatformSessions(
  input: z.input<typeof listPlatformSessionsInputSchema>,
): Promise<{
  sessions: ReadonlyArray<ConsoleSession>
  truncated: boolean
}> {
  const data = listPlatformSessionsInputSchema.parse(input)

  const call = await openConsoleCall({ session: ['list'] })
  const listing = await readSessions(data.userId)

  recordConsoleRead(call, 'sessions', {
    entityId: data.userId,
    returned: listing.sessions.length,
    truncated: listing.truncated,
  })

  return {
    sessions: listing.sessions.map(toConsoleSession),
    truncated: listing.truncated,
  }
}
