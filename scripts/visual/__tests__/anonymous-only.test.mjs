/**
 * The `--auth` trap, in two halves.
 *
 * The first half is the guard itself: `--auth` on a screen only a signed-out visitor ever sees
 * photographs the redirect target and reports it as valid (issue #101). The second is drift — the
 * list of such screens lives in this repository's routes, not in the script, so a route that gains
 * or loses its signed-in redirect must fail here until the script's list is updated with it.
 */

import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

import {
  ANONYMOUS_ONLY_ROUTES,
  anonymousOnlyRefusal,
} from '../anonymous-only.mjs'

describe('anonymousOnlyRefusal', () => {
  it('refuses an anonymous-only screen and names the fix', () => {
    const refusal = anonymousOnlyRefusal('http://localhost:3010/login')
    expect(refusal).toBeTypeOf('string')
    expect(refusal).toContain('--auth')
    expect(refusal).toContain('http://localhost:3010/login')
    expect(refusal).toContain('src/routes/(auth)/login.tsx')
    // The fix, spelled out: this URL is captured without the flag.
    expect(refusal).toMatch(/drop `?--auth`?/i)
    expect(anonymousOnlyRefusal('http://localhost:3010/register')).toContain(
      'src/routes/(auth)/register.tsx',
    )
  })

  it('keys on the pathname, so query, trailing slash and origin do not defeat it', () => {
    for (const url of [
      'http://localhost:3010/login/',
      'http://localhost:3010/login?redirect=/trips/1',
      'http://127.0.0.1:3010/login/?redirect=%2Ftrips%2F1#top',
      'https://demo.liketrek.com/register',
    ]) {
      expect(anonymousOnlyRefusal(url), url).toBeTypeOf('string')
    }
  })

  it('says nothing about a screen a signed-in visitor can legitimately reach', () => {
    for (const url of [
      'http://localhost:3010/dashboard',
      // Redirects to `/trips/1/plan`, which is not this trap.
      'http://localhost:3010/trips/1',
      'http://localhost:3010/accept-invitation/inv_123',
      'http://localhost:3010/verify-email',
      'http://localhost:3010/forgot-password',
      'http://localhost:3010/reset-password',
      'http://localhost:3010/two-factor',
      // Not the sign-in screen, whatever it shares a prefix with.
      'http://localhost:3010/logins',
      'http://localhost:3010/login/extra',
      'http://localhost:3010/settings/register-device',
    ]) {
      expect(anonymousOnlyRefusal(url), url).toBeUndefined()
    }
  })
})

/* ------------------------------------------------------------------ drift */

const AUTH_ROUTES_DIR = 'src/routes/(auth)'

/** The shape that creates the trap: a route that throws a redirect at a signed-in visitor. */
const SIGNED_IN_REDIRECT =
  /if\s*\(\s*[\w.]*\bsignedIn\s*\)\s*\{?\s*throw\s+redirect\s*\(/

/**
 * Every routable `.tsx` under `dir`, as a repository-relative path — the same form
 * `ANONYMOUS_ONLY_ROUTES` records it in, so the two lists compare directly.
 *
 * `-lib`, `-ui` and `-server` are skipped: TanStack excludes a leading `-` from routing, so nothing
 * under them is a route and none of it can carry the redirect that makes the trap.
 */
function routeFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (entry.name.startsWith('-')) return []
    const path = `${dir}/${entry.name}`
    if (entry.isDirectory()) return routeFiles(path)
    return entry.name.endsWith('.tsx') ? [path] : []
  })
}

/** `createFileRoute('/(auth)/login')` is the route's own statement of its pathname. */
function declaredPathname(source) {
  const match = /createFileRoute\(\s*['"]([^'"]+)['"]\s*\)/.exec(source)
  return match?.[1].replace('/(auth)', '') ?? undefined
}

/** Both sides are sorted before comparing, so file order alone is never reported as drift. */
function byRoute(a, b) {
  return a.route.localeCompare(b.route)
}

describe('drift against the routes', () => {
  it('lists exactly the (auth) routes that redirect a signed-in visitor', () => {
    const guarded = routeFiles(AUTH_ROUTES_DIR)
      .map((route) => ({ route, source: readFileSync(route, 'utf8') }))
      .filter(({ source }) => SIGNED_IN_REDIRECT.test(source))
      .map(({ route, source }) => ({
        pathname: declaredPathname(source),
        route,
      }))

    // A regex that matched nothing, or a directory that moved, would otherwise agree with an empty
    // list and report no drift at all. If the guard was extracted into a shared helper, this is the
    // assertion that fires: teach SIGNED_IN_REDIRECT the new shape rather than deleting the check.
    expect(
      guarded.length,
      `no route under ${AUTH_ROUTES_DIR} matches ${SIGNED_IN_REDIRECT} — the guard moved, so this test can no longer see the trap`,
    ).toBeGreaterThan(0)
    expect([...ANONYMOUS_ONLY_ROUTES].sort(byRoute)).toEqual(
      guarded.sort(byRoute),
    )
  })
})
