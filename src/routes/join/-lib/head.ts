/**
 * What a `/join/<secret>` response says about itself, before any trip is looked up.
 *
 * The URL is the credential, so the document keeps it out of every cache, index and `Referer`, and
 * its title, description and share tags are the same generic ones for a live link and a dead one:
 * a crawler or a link preview learns nothing about whether a link exists.
 */
import { createTranslator } from '#/lib/i18n'

import type { Catalogue, Locale } from '#/lib/i18n'

export const JOIN_HEADERS = {
  'cache-control': 'private, no-store',
  'referrer-policy': 'no-referrer',
  'x-robots-tag': 'noindex, nofollow',
  vary: 'accept-language, cookie',
} as const

interface ShellMatch {
  readonly loaderData?: unknown
}

/** The negotiated language the root loader hands every route, or `null` while it is in flight. */
function shellOf(
  matches: ReadonlyArray<ShellMatch>,
): { locale: Locale; messages: Catalogue } | null {
  const data = matches[0]?.loaderData as
    { locale?: Locale; messages?: Catalogue } | undefined
  return data?.locale && data.messages
    ? { locale: data.locale, messages: data.messages }
    : null
}

/**
 * The root already writes `og:*` and `twitter:*` tags from its own constants, so this route sets
 * only the ones that must not stay: a title and description that name no trip, and the robots and
 * referrer policy. It never writes a trip-specific tag.
 */
export function joinHead(matches: ReadonlyArray<ShellMatch>) {
  const shell = shellOf(matches)
  const meta: Array<Record<string, string>> = [
    { name: 'robots', content: 'noindex, nofollow' },
    { name: 'referrer', content: 'no-referrer' },
  ]
  if (shell) {
    const t = createTranslator(shell.locale, shell.messages)
    const title = t('trips.join.page.title')
    const description = t('trips.join.page.description')
    meta.push(
      { title },
      { name: 'description', content: description },
      { property: 'og:title', content: title },
      { property: 'og:description', content: description },
      { name: 'twitter:title', content: title },
      { name: 'twitter:description', content: description },
    )
  }
  return { meta }
}
