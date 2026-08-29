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
])

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
