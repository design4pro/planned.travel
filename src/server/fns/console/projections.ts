/**
 * What the console is allowed to learn about an account and its sessions, and the shape it learns
 * it in.
 *
 * Better Auth's endpoints return their own row objects, typed loosely enough that a schema change
 * upstream would reach a screen before it reached a compiler. Everything crossing out of this
 * directory is therefore parsed rather than cast: the projections below are the contract, unknown
 * keys are dropped, and a row that cannot satisfy one is a thrown error at the boundary instead of
 * `undefined` rendered as a name.
 *
 * Two omissions are deliberate and are the reason this is a projection rather than a pass-through.
 * A `user` row carries no password — Better Auth keeps credentials on `account` — but it does carry
 * `twoFactorEnabled` and provider linkage that a console has no business republishing, and a
 * `session` row carries its own `token`, which is the live credential: a console screen that
 * rendered it would put a usable session key in an HTML document and in the browser's memory.
 * {@link consoleSessionSchema} keeps the token for the server's own use and
 * {@link toConsoleSession} is what drops it, so the two halves cannot be confused at a call site.
 *
 * Instants leave as ISO-8601 strings. They cross a server-function boundary, where a `Date` is
 * serialised by whatever the transport happens to do this week, and the screens format them
 * themselves.
 */

import { z } from 'zod'

/**
 * A timestamp as Better Auth hands it over: a `Date` from the Drizzle adapter, a number or a string
 * from a KV blob that has been through `JSON.stringify`. All three are the same instant and the
 * caller should not have to know which one it got.
 */
const instant = z
  .union([z.date(), z.string(), z.number()])
  .transform((value) => new Date(value))
  .refine((value) => Number.isFinite(value.getTime()), 'must be a real instant')

const identifier = z.string().trim().min(1).max(64)

/** The `user` row, narrowed to what a console screen renders. */
export const platformUserSchema = z.object({
  id: identifier,
  name: z.string(),
  email: z.string(),
  emailVerified: z.boolean().nullish(),
  image: z.string().nullish(),
  /** Verbatim, and possibly comma-joined: `resolvePlatformRole` is the only sanctioned reader. */
  role: z.string().nullish(),
  banned: z.boolean().nullish(),
  banReason: z.string().nullish(),
  banExpires: instant.nullish(),
  createdAt: instant,
  updatedAt: instant,
})

export type PlatformUserRow = z.infer<typeof platformUserSchema>

/** One account, as it leaves this directory. */
export interface ConsoleUser {
  readonly id: string
  readonly name: string
  readonly email: string
  readonly emailVerified: boolean
  readonly image: string | null
  readonly role: string | null
  readonly banned: boolean
  readonly banReason: string | null
  readonly banExpiresAt: string | null
  readonly createdAt: string
  readonly updatedAt: string
}

export function toConsoleUser(row: PlatformUserRow): ConsoleUser {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified ?? false,
    image: row.image ?? null,
    role: row.role ?? null,
    banned: row.banned ?? false,
    banReason: row.banReason ?? null,
    banExpiresAt: row.banExpires?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/**
 * The audit `changes` view of an account: the fields a console action can move, and nothing else.
 *
 * Used for both sides of every `platform.user.*` entry, so `before` and `after` are always the same
 * key set and a diff never has to guess whether a missing key means "unchanged" or "not recorded".
 */
export function auditUserState(row: PlatformUserRow): Record<string, unknown> {
  return {
    name: row.name,
    email: row.email,
    emailVerified: row.emailVerified ?? false,
    role: row.role ?? null,
    banned: row.banned ?? false,
    banReason: row.banReason ?? null,
    banExpiresAt: row.banExpires?.toISOString() ?? null,
  }
}

/** The `session` row as D1 holds it. `token` is the live credential and never leaves the server. */
export const platformSessionSchema = z.object({
  id: identifier,
  token: z.string().trim().min(1),
  userId: identifier,
  ipAddress: z.string().nullish(),
  userAgent: z.string().nullish(),
  impersonatedBy: z.string().nullish(),
  expiresAt: instant,
  createdAt: instant,
  updatedAt: instant,
})

export type PlatformSessionRow = z.infer<typeof platformSessionSchema>

/**
 * One session, as it leaves this directory.
 *
 * `token` is replaced by `id`: the console needs a handle to revoke by, and `revokeUserSession`
 * takes the token, so the server maps the id back to the token from its own read rather than
 * accepting one from the wire. A client that could name a token could revoke any session in the
 * product, and the guard would have nothing to check it against.
 */
export interface ConsoleSession {
  readonly id: string
  readonly ipAddress: string | null
  readonly userAgent: string | null
  readonly impersonatedBy: string | null
  readonly expiresAt: string
  readonly createdAt: string
  readonly updatedAt: string
}

export function toConsoleSession(row: PlatformSessionRow): ConsoleSession {
  return {
    id: row.id,
    ipAddress: row.ipAddress ?? null,
    userAgent: row.userAgent ?? null,
    impersonatedBy: row.impersonatedBy ?? null,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}
