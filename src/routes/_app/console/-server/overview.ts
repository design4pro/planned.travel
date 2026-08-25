/**
 * The four counts and the six newest accounts the console overview opens with.
 *
 * **Every one of the five reads goes through `listPlatformUsersFn`**, and none of them composes a
 * platform-API query here. That is the layering `docs/SPEC.md` §6 states — routes call server
 * functions, server functions own the query — and this file used to break it: it opened its own
 * console call, took the `auth.api` handle out of `#/server/fns/console/bindings` and wrote five
 * `listUsers` queries in a route directory, one filter clause at a time. The saving was one KV
 * session read; the cost was a second place where the accounts query is spelled, in a tree whose
 * whole point is that there is one. `listPlatformUsersFn` already carries the search, sort, filter,
 * role and ban vocabulary this needs, already calls `requirePermission` before it reads a row, and
 * already projects what it returns — so the five calls below are the same five questions asked of
 * the function that owns them, concurrently.
 *
 * **`limit: 1`, not `limit: 0`.** `auth.api.listUsers` counts under the same predicate it lists
 * under, so a one-row page is the cheapest way to ask "how many". Zero is not available: the
 * endpoint reads `Number(ctx.query?.limit) || void 0`, so a limit of `0` is falsy and becomes no
 * limit at all — the whole table.
 *
 * **A curator gets no counts, and asks for none.** `user:list` is `admin`-only
 * (`docs/ACCESS.md` §2.1), so this function is reached only when the caller holds it; the overview
 * route decides from `ConsoleAccess.canManageUsers` whether to call it, and a curator's overview is
 * the catalogue half alone. The guard is still the boundary — a curator that reached this anyway is
 * refused inside every call below before a row is read.
 */

import { createServerFn } from '@tanstack/react-start'

import { listPlatformUsersFn } from '#/server/fns/console/users'

import type { ConsoleUser } from '#/server/fns/console/projections'

/** How many accounts the "newest accounts" panel shows. Six fills two rows of three at `xl`. */
const NEWEST_LIMIT = 6

/** The account population, as the overview counts it. */
export interface ConsoleAccountCounts {
  readonly total: number
  readonly admins: number
  readonly curators: number
  readonly suspended: number
}

export interface ConsoleOverview {
  readonly counts: ConsoleAccountCounts
  readonly newest: ReadonlyArray<ConsoleUser>
}

export const loadConsoleOverview = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ConsoleOverview> => {
    const [total, admins, curators, suspended, newest] = await Promise.all([
      listPlatformUsersFn({ data: { limit: 1 } }),
      listPlatformUsersFn({ data: { limit: 1, role: 'admin' } }),
      listPlatformUsersFn({ data: { limit: 1, role: 'curator' } }),
      listPlatformUsersFn({ data: { limit: 1, banned: true } }),
      listPlatformUsersFn({
        data: {
          limit: NEWEST_LIMIT,
          sortBy: 'createdAt',
          sortDirection: 'desc',
        },
      }),
    ])

    return {
      counts: {
        total: total.total,
        admins: admins.total,
        curators: curators.total,
        suspended: suspended.total,
      },
      newest: newest.users,
    }
  },
)
