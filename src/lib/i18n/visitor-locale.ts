import { resolveLocaleTag } from './negotiate'

/** One first-party preference shared by negotiation and explicit language saves. */
export const VISITOR_LOCALE_COOKIE = 'planned.locale'
export const VISITOR_LOCALE_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  path: '/',
  maxAge: 365 * 24 * 60 * 60,
} as const

/** Duplicate names are ambiguous, even when one of their values is invalid. */
export function parseVisitorLocaleCookie(header: string | null): string | null {
  if (header === null) return null
  let value: string | null = null
  let count = 0
  for (const pair of header.split(';')) {
    const separator = pair.indexOf('=')
    if (
      separator < 0 ||
      pair.slice(0, separator).trim() !== VISITOR_LOCALE_COOKIE
    )
      continue
    count += 1
    value = pair.slice(separator + 1)
  }
  if (count !== 1 || value === null || value.length > 16) return null
  return resolveLocaleTag(value)
}
