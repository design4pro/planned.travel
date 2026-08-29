/**
 * The screens `--auth` must not be pointed at, and why the list is short.
 *
 * `src/routes/(auth)/login.tsx` and `register.tsx` throw a 302 from `beforeLoad` when the session is
 * signed in, and `safeRedirect(undefined)` is `/dashboard`. So `capture.mjs --auth --url .../login`
 * photographs the dashboard, files it under the name of the sign-in screen, and reports
 * `captureValid: true` with no warnings — a wrong-page frame the blind critic then judges as the
 * product (issue #101). The script's other auth check is the mirror image (asked for an app route,
 * LANDED on `/login`) and cannot see this one.
 *
 * Scoped by pathname rather than by route group, because the group is not the trap:
 * `accept-invitation/<id>` and `verify-email` are `(auth)` routes that legitimately render for a
 * signed-in visitor, and `forgot-password`, `reset-password` and `two-factor` carry no signed-in
 * redirect at all. Scoped by pathname rather than "landed somewhere else", because a legitimate
 * redirect exists: `/trips/<id>` sends an authenticated visitor to `/trips/<id>/plan`.
 *
 * The list is a claim about `src/routes/(auth)/`, so it drifts. `__tests__/anonymous-only.test.mjs`
 * re-derives it from the routes themselves and fails if a guard is added or removed without this
 * file being updated.
 */

/** Pathname → the route whose signed-in redirect makes `--auth` photograph the wrong screen. */
export const ANONYMOUS_ONLY_ROUTES = [
  { pathname: '/login', route: 'src/routes/(auth)/login.tsx' },
  { pathname: '/register', route: 'src/routes/(auth)/register.tsx' },
]

/**
 * The pathname of a URL, tolerating a bare pathname.
 *
 * A trailing slash is dropped so `/login/` and `/login` are one screen; the query string and the
 * origin are discarded, which is what makes `/login?redirect=/trips/1` and the reference host's
 * `/login` both reachable by this check.
 */
function pathnameOf(target) {
  const raw = URL.canParse(target)
    ? new URL(target).pathname
    : String(target).split(/[?#]/)[0]
  return raw.length > 1 ? raw.replace(/\/+$/, '') : raw
}

/** The anonymous-only route a URL points at, or `undefined` for every other screen. */
export function anonymousOnlyRoute(target) {
  const pathname = pathnameOf(target)
  return ANONYMOUS_ONLY_ROUTES.find((entry) => entry.pathname === pathname)
}

/**
 * Why this capture must be refused, or `undefined` to proceed.
 *
 * `auth` is the caller's `--auth` flag: without it, photographing `/login` is the normal and correct
 * thing to do and this says nothing.
 */
export function anonymousOnlyRefusal(target, { auth = false } = {}) {
  if (!auth) return undefined
  const entry = anonymousOnlyRoute(target)
  if (!entry) return undefined

  return (
    `--auth was asked for but ${target} only ever renders for a signed-out visitor. ` +
    `${entry.route} throws a 302 from beforeLoad when the session is signed in, so the frame ` +
    `filed would be of wherever it sends you — the dashboard, unless ?redirect= says otherwise — ` +
    `under the name of ${entry.pathname}, and nothing downstream could tell. Drop --auth for this ` +
    `URL: an anonymous capture is how ${entry.pathname} is photographed.`
  )
}
