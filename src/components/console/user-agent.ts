/**
 * A `User-Agent` header, read back as the two things an operator actually recognises.
 *
 * A session row is otherwise identified by a 200-character string that begins `Mozilla/5.0` on every
 * device made since 1994, so a list of them is a list of near-identical paragraphs and the operator
 * revoking one is guessing. The pair below — browser and platform — is what somebody can match
 * against "the laptop I left at the office".
 *
 * Deliberately a small lookup rather than a parser. A user-agent string is attacker-controlled and
 * self-reported: nothing here is a security claim, so ordering a handful of substring tests by
 * specificity is the whole of what the job needs, and a token nobody recognises is reported as
 * unknown instead of guessed at. The order matters twice over — every Chromium browser also says
 * `Chrome`, and every WebKit browser also says `Safari`, so the narrower names are tested first.
 */

const BROWSERS: ReadonlyArray<readonly [token: string, name: string]> = [
  ['Edg/', 'Edge'],
  ['OPR/', 'Opera'],
  ['Firefox/', 'Firefox'],
  ['Chrome/', 'Chrome'],
  ['Safari/', 'Safari'],
]

const PLATFORMS: ReadonlyArray<readonly [token: string, name: string]> = [
  ['iPhone', 'iPhone'],
  ['iPad', 'iPad'],
  ['Android', 'Android'],
  ['Mac OS X', 'macOS'],
  ['Windows', 'Windows'],
  ['CrOS', 'ChromeOS'],
  ['Linux', 'Linux'],
]

function firstMatch(
  value: string,
  table: ReadonlyArray<readonly [string, string]>,
): string | null {
  for (const [token, name] of table) {
    if (value.includes(token)) {
      return name
    }
  }
  return null
}

/** `"Safari on iPhone"`, `"Chrome"`, or `"Unrecognised device"` when nothing matched. */
export function describeUserAgent(userAgent: string | null): string {
  if (userAgent === null || userAgent.trim().length === 0) {
    return 'Unrecognised device'
  }
  const browser = firstMatch(userAgent, BROWSERS)
  const platform = firstMatch(userAgent, PLATFORMS)

  if (browser !== null && platform !== null) return `${browser} on ${platform}`
  if (browser !== null) return browser
  if (platform !== null) return platform
  return 'Unrecognised device'
}
