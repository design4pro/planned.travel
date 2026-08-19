/**
 * Where to send someone once they are authenticated.
 *
 * The `?redirect=` parameter is attacker-controlled — `_app/route.tsx` puts a
 * legitimate one there, but nothing stops a phishing link supplying its own — so
 * it is narrowed to a same-origin path before it is ever navigated to.
 */

/** Landing surface for a session with no particular destination in mind. */
export const DEFAULT_REDIRECT = '/dashboard'

/**
 * Whether the path carries a control character or raw whitespace.
 *
 * A legitimate destination arrives percent-encoded, so an unescaped newline, tab
 * or space is either a mistake or an attempt to smuggle something into a header.
 * Tested by code point rather than by pattern, because a literal control
 * character inside a regular expression is unreadable at review time.
 */
function hasUnsafeCharacter(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index)
    if (code <= 0x20 || code === 0x7f) return true
  }
  return false
}

/**
 * A same-origin path, or the default.
 *
 * Rejects anything that could leave the origin: absolute URLs, protocol-relative
 * `//host` paths, and the backslash variants some parsers normalise to slashes.
 */
export function safeRedirect(value: string | undefined | null): string {
  if (typeof value !== 'string' || value.length === 0) return DEFAULT_REDIRECT
  if (!value.startsWith('/')) return DEFAULT_REDIRECT
  if (value.startsWith('//') || value.startsWith('/\\')) return DEFAULT_REDIRECT
  if (hasUnsafeCharacter(value)) return DEFAULT_REDIRECT
  // A sign-in loop is never the intended destination.
  if (value === '/login' || value.startsWith('/login?')) return DEFAULT_REDIRECT
  return value
}

/** The sign-in href that will come back to `target` once authenticated. */
export function loginHrefFor(target: string): string {
  const safe = safeRedirect(target)
  return safe === DEFAULT_REDIRECT
    ? '/login'
    : `/login?redirect=${encodeURIComponent(safe)}`
}
