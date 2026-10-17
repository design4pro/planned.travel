/**
 * What this application refuses to send to Sentry, in one place.
 *
 * There are two Sentry SDKs here - `@sentry/cloudflare` in the Worker and `@sentry/react` in the
 * browser - and the rule about a user's session and query strings is the same one in both. Written
 * twice it would be right twice on the day it was written and drift afterwards, which is the kind
 * of divergence nobody notices until an incident: the half that was updated looks fine, and the
 * half that was not is the half that leaked.
 *
 * It lives under `src/lib` and imports no SDK, so both runtimes can reach it without the browser
 * pulling in the Cloudflare SDK. The event is described structurally and the function is generic in
 * it, so each SDK's `beforeSend` still gets its own event type back.
 *
 * `sendDefaultPii: false` is set on both clients as well. This is not a duplicate of that: the flag
 * is a request to the SDK, and this is the part that does not depend on the SDK's interpretation of
 * it, or on that interpretation staying the same across a major version.
 */

/** Headers that carry a session or a credential. */
const FORBIDDEN_HEADERS = new Set([
  'cookie',
  'set-cookie',
  'authorization',
  'proxy-authorization',
  // The previous page's URL: from a sign-in page it carries the `?redirect=` query.
  'referer',
])

/**
 * A path segment after `/join/` is a credential, so it is replaced whatever its shape: a malformed
 * one is still somebody's attempt at a link, and this needs nothing from the secret module.
 */
const JOIN_PATH = /\/join\/[^\s/?#&"'<>]+/gi

/**
 * The same path URL-encoded at any depth (`%2F`, `%252F`, ...), as it appears in a `redirect` or
 * `callbackURL` value. The segment ends at a delimiter that is itself encoded at that depth.
 */
const ENCODED_JOIN_PATH =
  /%(?:25)*2fjoin%(?:25)*2f(?:[^\s&"'<>?#%]|%(?!(?:25)*(?:2f|3f|23|26)))+/gi

/**
 * Span attributes the tracing integration fills from the matched route's parameters
 * (`url.path.params.token`): the bare secret, without the `/join/` prefix the patterns look for.
 */
const ROUTE_TOKEN_KEY = /(?:^|\.)(?:params|parameter)\.token$/

/** The part of a Sentry event this module has an opinion about. */
export interface ScrubbableEvent {
  request?: {
    headers?: Record<string, string>
    url?: string
    query_string?: unknown
    cookies?: unknown
    data?: unknown
  }
}

/**
 * Strip the session, the credentials and the query string from an outgoing event.
 *
 * The path of a URL is the useful half for debugging and the query string is the dangerous half:
 * this application puts trip ids, invitation tokens and search terms there.
 */
export function scrubEvent<TEvent extends ScrubbableEvent>(
  event: TEvent,
): TEvent {
  event = scrubTelemetry(event)
  const request = event.request
  if (request === undefined) {
    return event
  }

  const headers = request.headers
  const safeHeaders =
    headers === undefined
      ? undefined
      : Object.fromEntries(
          Object.entries(headers).filter(
            ([name]) => !FORBIDDEN_HEADERS.has(name.toLowerCase()),
          ),
        )

  return {
    ...event,
    request: {
      ...request,
      headers: safeHeaders,
      url: request.url === undefined ? undefined : request.url.split('?')[0],
      query_string: undefined,
      cookies: undefined,
      data: undefined,
    },
  }
}

/** Every URL-bearing Sentry channel uses this scrub, including channels that bypass beforeSend. */
export function scrubTelemetry<T>(value: T): T {
  function walk(item: unknown): unknown {
    if (typeof item === 'string')
      return item
        .replace(/\/api\/feed\/[^\s?#"'<>]+/g, '/api/feed/[redacted]')
        .replace(/%2fapi%2ffeed%2f[^\s&"'<>]+/gi, '%2Fapi%2Ffeed%2F[redacted]')
        .replace(JOIN_PATH, '/join/[redacted]')
        .replace(ENCODED_JOIN_PATH, '%2Fjoin%2F[redacted]')
    if (Array.isArray(item)) {
      const result = item.map(walk)
      return result.some((entry, index) => entry !== item[index])
        ? result
        : item
    }
    if (
      item !== null &&
      typeof item === 'object' &&
      Object.getPrototypeOf(item) === Object.prototype
    ) {
      const entries = Object.entries(item)
      const result = entries.map(
        ([key, entry]) =>
          [key, ROUTE_TOKEN_KEY.test(key) ? '[redacted]' : walk(entry)] as const,
      )
      return result.some((entry, index) => entry[1] !== entries[index][1])
        ? Object.fromEntries(result)
        : item
    }
    return item
  }
  // This walk preserves the structure and types; only string values have their secret segment removed.
  return walk(value) as T
}
