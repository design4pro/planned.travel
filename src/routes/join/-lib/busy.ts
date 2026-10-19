/**
 * The document answer for a budget refusal.
 *
 * The router derives a document's status from its own state (200, 404 or 500) and ignores
 * `setResponseStatus`, and headers a server function sets are merged into the document only after
 * the route's middleware has run. So `loadInvite` answers a refused visitor with a 200 view and
 * notes the wait against the request it ran for; the route's middleware reads the note once the
 * page has rendered and turns the response into the 429 a browser, a proxy and a monitor should
 * see. The body is kept: it is the page that says the page is busy.
 */
const waits = new WeakMap<Request, number>()

/** Remembers that `request` was refused, and for how many seconds. */
export function noteBusy(request: Request, retryAfter: number): void {
  waits.set(request, retryAfter)
}

export function answerBusy(request: Request, response: Response): Response {
  const retryAfter = waits.get(request)
  if (retryAfter === undefined || response.status !== 200) return response
  const headers = new Headers(response.headers)
  headers.set('retry-after', String(retryAfter))
  return new Response(response.body, { status: 429, headers })
}
