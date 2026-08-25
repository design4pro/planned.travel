/**
 * The addressable state of `/console/users`, in a leaf module so it can be driven by a test.
 *
 * It lives beside the screen rather than inside it because `users.index.tsx` imports its own server
 * functions, and those reach `cloudflare:workers` — a test that imported the route to reach this
 * schema could not be loaded by either Vitest project. This file imports Zod and nothing else.
 */

import { z } from 'zod'

/**
 * Every control on the accounts screen writes here rather than into component state, so a filtered,
 * sorted page is a URL somebody can send to the admin next to them and the back button walks the
 * reader's own history. Nothing carries a `.default()`: a default in the schema is re-serialised
 * into the address on every navigation, and `/console/users` would immediately become
 * `/console/users?sort=createdAt&dir=desc&page=1`. The defaults live where they are used instead.
 *
 * **It is total: no address can make the route throw.** A `validateSearch` that rejects is a `500`
 * on a `GET` somebody typed, and what reaches the error panel is `ZodError`'s own
 * `JSON.stringify(issues)` — the bracketed `origin`/`code`/`minimum` array, measured on this screen
 * for `?page=abc`. A query string is user input arriving through the most forgiving channel the
 * product has, so every field falls back to its own absence instead: an unreadable `page` is no
 * page, an invented `sort` is the default sort, and the screen renders. The controls rewrite the
 * address on the next interaction, so the nonsense does not persist either.
 *
 * **The pair `role` + `status` is resolved rather than refused**, for the same reason.
 * `auth.api.listUsers` builds at most one filter clause beside the search clause and would silently
 * drop the second, so `consoleUsersQuerySchema` on the wire refuses the pair outright — which is
 * right for a server-function boundary and wrong for an address bar, where the refusal arrives as a
 * `500` on a link. Here the role narrows and the status is dropped, which is the same answer the two
 * controls give each other when a person uses them: they clear one another, and the toolbar says
 * "one at a time" underneath.
 */
export const consoleUsersSearchSchema = z
  .object({
    q: z.string().trim().max(120).optional().catch(undefined),
    /** Which column the search text is matched against; `list-users` accepts exactly one. */
    in: z.enum(['email', 'name']).optional().catch(undefined),
    role: z.enum(['admin', 'curator']).optional().catch(undefined),
    status: z.enum(['active', 'suspended']).optional().catch(undefined),
    sort: z
      .enum(['createdAt', 'updatedAt', 'name', 'email'])
      .optional()
      .catch(undefined),
    dir: z.enum(['asc', 'desc']).optional().catch(undefined),
    page: z.number().int().min(1).max(4_000).optional().catch(undefined),
  })
  .catch({})
  .transform((search) =>
    search.role === undefined || search.status === undefined
      ? search
      : { ...search, status: undefined },
  )

export type ConsoleUsersSearch = z.infer<typeof consoleUsersSearchSchema>

/** Which column the accounts table sorts on when the address does not say. */
export const CONSOLE_USERS_DEFAULT_SORT = 'createdAt'

/** Which direction it sorts in when the address does not say. Newest first. */
export const CONSOLE_USERS_DEFAULT_DIRECTION = 'desc'
