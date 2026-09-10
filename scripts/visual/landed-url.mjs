/**
 * Did the capture photograph the screen it was asked for?
 *
 * The failure this answers is one frame, of screen B, filed under the name of screen A, with nothing
 * anywhere recording that the two differ — a wrong-page frame the blind critic then judges as the
 * product (issue #101). `capture.mjs` already holds both URLs; it simply never compared them.
 *
 * This module knows nothing about this repository's routes, which is the point. It replaced a list
 * of the two screens `--auth` must not be pointed at, plus a drift test that re-derived that list
 * from `src/routes/(auth)/` with a regex over route sources — a second, fragile model of the router,
 * maintained so a two-line constant stayed honest. A comparison has nothing to drift, so a redirect
 * nobody listed — a role-gated route, a screen not yet written — warns for free.
 */

/**
 * The screen an absolute URL names, normalised.
 *
 * Trailing slashes are stripped and an empty result becomes `/`, so `/login/` and `/login` are one
 * screen. Query, hash, host and port are deliberately ignored: `?redirect=` and `#top` do not change
 * which screen rendered, and ignoring the origin is what lets a local capture and the reference demo
 * compare as the same screen.
 *
 * Exported because `capture.mjs`'s stale-session guard asks the same question of the same URLs, and
 * a second copy of this rule there would be one claim in two places (docs/SPEC.md §8).
 */
export const pathnameOf = (u) => new URL(u).pathname.replace(/\/+$/, '') || '/'

/**
 * Why the frame just filed is not of the screen that was asked for, or `undefined` when it is.
 *
 * The sentence carries both fixes unconditionally — point `--url` at the landing, or drop `--auth`
 * when the screen only renders for a signed-out visitor — so this function needs no knowledge of the
 * caller's flags. A legitimate redirect (a route with no screen of its own sending you to its
 * default tab) still warns: it is true, and it is answered in one word by whoever quotes it. An
 * allowlist of the legitimate ones would be the deleted list again, inverted.
 */
export function landedUrlWarning({ requestedUrl, landedUrl }) {
  const requested = pathnameOf(requestedUrl)
  const landed = pathnameOf(landedUrl)
  if (requested === landed) return undefined

  return (
    `${requested} redirected to ${landed} — every frame filed under this label photographs ` +
    `${landed}, not ${requested}, and the filename does not say so. If ${landed} is the screen you ` +
    `meant, point --url at it; if ${requested} only ever renders for a signed-out visitor, capture ` +
    `it without --auth.`
  )
}
