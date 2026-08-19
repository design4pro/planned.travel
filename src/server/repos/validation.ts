/**
 * Shared Zod v4 primitives for repository inputs.
 *
 * Every repository input is parsed before it reaches a query builder — the client is never trusted,
 * per `docs/SPEC.md` §6. Keeping the primitives here means "what is a valid ISO date" is answered
 * once for the whole data layer.
 */

import { z } from 'zod'

/** A generated identifier from `newId()`, or any Better Auth id. */
export const idSchema = z.string().trim().min(1).max(64)

export const optionalIdSchema = idSchema.nullish()

/** Free text that must actually contain something. */
export const titleSchema = z.string().trim().min(1).max(200)

export const shortTextSchema = z.string().trim().max(200)

export const longTextSchema = z.string().trim().max(20_000)

/** URL-safe slug; repositories derive one with {@link slugify} when the caller omits it. */
export const slugSchema = z
  .string()
  .trim()
  .min(1)
  .max(80)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must be a lowercase hyphenated slug')

/** Calendar date, `YYYY-MM-DD`, validated for real calendar existence. */
export const dateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'must be an ISO calendar date (YYYY-MM-DD)')
  .refine((value) => {
    const parsed = new Date(`${value}T00:00:00.000Z`)
    return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(value)
  }, 'must be a real calendar date')

/** Wall-clock time of day, `HH:MM`. */
export const timeSchema = z
  .string()
  .regex(/^(?:[01]\d|2[0-3]):[0-5]\d$/, 'must be a 24-hour time (HH:MM)')

/** Millisecond instant, accepted either as a `Date` or as an epoch number. */
export const instantSchema = z.union([
  z.date(),
  z
    .number()
    .int()
    .nonnegative()
    .transform((ms) => new Date(ms)),
])

export const currencySchema = z
  .string()
  .trim()
  .length(3)
  .regex(/^[A-Z]{3}$/, 'must be an ISO-4217 alphabetic code')

export const countryCodeSchema = z
  .string()
  .trim()
  .length(2)
  .regex(/^[A-Z]{2}$/, 'must be an ISO-3166-1 alpha-2 code')

export const colourSchema = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, 'must be a hex colour')

/** Money in the minor unit of its currency. Never a float. */
export const minorAmountSchema = z.number().int().min(0).max(Number.MAX_SAFE_INTEGER)

export const signedMinorAmountSchema = z.number().int()

export const latitudeSchema = z.number().min(-90).max(90)
export const longitudeSchema = z.number().min(-180).max(180)

export const sortOrderSchema = z.number().finite()

export const positiveIntSchema = z.number().int().positive()
export const nonNegativeIntSchema = z.number().int().min(0)

export const yearSchema = z.number().int().min(1900).max(2200)

/** Standard list controls understood by every repository `list*` function. */
export const paginationSchema = z.object({
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
  cursor: z.string().trim().min(1).max(64).nullish(),
})

export type Pagination = z.infer<typeof paginationSchema>

/**
 * Derives a URL-safe slug. Repositories call this when the caller has not supplied one so that
 * every human-named entity gets a stable, readable path segment.
 */
export function slugify(value: string, fallback = 'untitled'): string {
  const slug = value
    .normalize('NFKD')
    .replaceAll(/[\u0300-\u036f]/gu, '')
    .toLowerCase()
    .replaceAll(/[^a-z0-9]+/gu, '-')
    .replaceAll(/^-+|-+$/gu, '')
    .slice(0, 80)
    .replaceAll(/-+$/gu, '')
  return slug.length > 0 ? slug : fallback
}

/** Strips `undefined` values so a patch never blanks a column the caller did not mention. */
export function definedOnly<T extends Record<string, unknown>>(patch: T): Partial<T> {
  const result: Partial<T> = {}
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) {
      result[key as keyof T] = value as T[keyof T]
    }
  }
  return result
}

/** Absolute http(s) URL. Kept as a regex so the repository layer never depends on a URL parser. */
export const urlSchema = z
  .string()
  .trim()
  .min(1)
  .max(2000)
  .regex(/^https?:\/\/\S+$/, 'must be an http(s) URL')
