/**
 * The four counts and the six newest accounts the console overview opens with, in one call.
 *
 * Composed here rather than by having the loader invoke `listPlatformUsersFn` five times, and the
 * difference is measurable rather than stylistic: each of those calls opens its own console call,
 * which is one session resolution against KV apiece (`docs/ARCHITECTURE.md` §2.1 budgets one per
 * server function). One `openConsoleCall` in front of five `listUsers` queries is one KV read and
 * five D1 statements, which is the shape that section describes for a screen rather than five
 * screens' worth of it.
 *
 * It is composition of the existing console machinery and not a second implementation of it: the
 * guard, the platform api handle and the read log line are the same four functions
 * `src/server/fns/console/users.ts` uses, imported rather than restated. What is *not* restated is
 * the list read itself — the overview asks only for counts and for one small page, so it never needs
 * the search, sort and filter surface `listPlatformUsersFn` owns, and the users screen still goes
 * through that function.
 *
 * **`total` and nothing else, from a `limit: 1` query.** `auth.api.listUsers` runs `countTotalUsers`
 * with the same predicate it lists under, so a one-row page is the cheapest way to ask "how many".
 * Asking for zero rows is not available: the endpoint reads `Number(ctx.query?.limit) || void 0`, so
 * a limit of `0` is falsy and becomes "no limit at all" — the whole table.
 *
 * **A curator gets no counts, and asks for none.** `user:list` is `admin`-only
 * (`docs/ACCESS.md` §2.1), so this function is reached only when the caller holds it; the overview
 * route decides from `ConsoleAccess.canManageUsers` whether to call it, and a curator's overview is
 * the catalogue half alone. The guard is still the boundary — a curator that reached this anyway is
 * refused by `openConsoleCall` before a row is read.
 */

import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'

import { platformApi } from '#/server/fns/console/bindings'
import { openConsoleCall, recordConsoleRead } from '#/server/fns/console/context'
import {
  platformUserSchema,
  toConsoleUser,
} from '#/server/fns/console/projections'

import type { ConsoleUser } from '#/server/fns/console/projections'
import type { ConsoleCall } from '#/server/fns/console/context'

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

/**
 * The number of accounts matching one filter, without carrying the rows back.
 *
 * `contains` rather than `eq` on the role column: `user.role` is a comma-joined string for a
 * multi-role account and Better Auth splits it the same way, so an exact match would miss
 * `curator,user` — the same reasoning `listPlatformUsersFn` records for its own filter.
 */
async function countUsers(
  call: ConsoleCall,
  filter: Record<string, unknown>,
): Promise<number> {
  const result = await platformApi().listUsers({
    query: { ...filter, limit: 1 },
    headers: call.headers,
  })
  return result.total
}

export const loadConsoleOverview = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ConsoleOverview> => {
    const call = await openConsoleCall({ user: ['list'] })

    const [total, admins, curators, suspended, newest] = await Promise.all([
      countUsers(call, {}),
      countUsers(call, {
        filterField: 'role',
        filterOperator: 'contains',
        filterValue: 'admin',
      }),
      countUsers(call, {
        filterField: 'role',
        filterOperator: 'contains',
        filterValue: 'curator',
      }),
      countUsers(call, {
        filterField: 'banned',
        filterOperator: 'eq',
        filterValue: true,
      }),
      platformApi().listUsers({
        query: {
          sortBy: 'createdAt',
          sortDirection: 'desc',
          limit: NEWEST_LIMIT,
          offset: 0,
        },
        headers: call.headers,
      }),
    ])

    const rows = z.array(platformUserSchema).parse(newest.users)

    recordConsoleRead(call, 'users', { returned: rows.length, total })

    return {
      counts: { total, admins, curators, suspended },
      newest: rows.map(toConsoleUser),
    }
  },
)
