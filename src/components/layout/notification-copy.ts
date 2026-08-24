/**
 * Turning a stored notification row into the sentence a person reads.
 *
 * `src/server/repos/notifications.ts` keeps a notification as `titleKey` +
 * `bodyKey` + a `params` record and never as a rendered sentence, "so a
 * notification written a year ago still renders in the reader's current
 * language". This module is the render half of that bargain, and it is the whole
 * of it: there is no second table of English templates anywhere in the product.
 *
 * It lives beside the chrome rather than in a route helper because two surfaces
 * read the same rows — the inbox screen and, when a row grows a preview, the
 * bell — and because it is pure, so it can be tested without a session, a
 * request or a browser.
 */

import { formatNumber } from '#/lib/format'

import type {
  Locale,
  MessageParams,
  Translate,
  TranslateStored,
} from '#/lib/i18n'

/**
 * The stored `params` column, structurally.
 *
 * Declared here rather than imported from `#/server/db/schema`: this module is
 * application chrome, and `docs/SPEC.md` §6 keeps `src/components` on the
 * browser side of the fence. The shape is the one `jsonRecordSchema` in
 * `src/server/repos/notifications.ts` validates, so a row assigns to it.
 */
export type StoredParams = Record<string, string | number | boolean | null>

/** Where the `shell` namespace keeps the stored templates. */
export const STORED_PREFIX = 'shell.notification.'

/**
 * Params whose value selects a CLDR plural branch as well as being printed.
 *
 * Everything else is substituted verbatim, deliberately: a trip called "2026"
 * must not be regrouped into "2,026" because its title happens to parse as a
 * number. A JSON *number* is unambiguous and is always grouped for the locale,
 * which is §8's rule — a number a reader sees arrives already formatted,
 * because raw substitution prints `1234` with no separator in all twenty-three.
 */
const COUNT_PARAMS = ['count', 'days']

/** Rows written before the `.title`/`.body` suffix was dropped still carry it. */
export function eventOf(key: string): string {
  return key.replace(/\.(?:title|body)$/, '')
}

/**
 * The stored `params` record, in the shape the message layer wants.
 *
 * `null` and booleans are dropped rather than stringified: neither is a word in
 * any language, and a template that needed one then renders with its token still
 * visible — which {@link renderStored} treats as a miss instead of shipping
 * `{actorName}` to a screen.
 */
export function paramsFrom(
  params: StoredParams | null,
  locale: Locale,
): MessageParams {
  const bag: Record<string, string | number> = {}
  let count: number | null = null

  for (const [name, value] of Object.entries(params ?? {})) {
    if (typeof value === 'number') {
      bag[name] = formatNumber(value, locale)
      if (COUNT_PARAMS.includes(name)) count = value
      continue
    }
    if (typeof value !== 'string' || value === '') continue
    if (COUNT_PARAMS.includes(name)) {
      const parsed = Number(value)
      if (value.trim() !== '' && Number.isFinite(parsed)) {
        bag[name] = formatNumber(parsed, locale)
        count = parsed
        continue
      }
    }
    bag[name] = value
  }

  return count === null ? bag : { ...bag, count }
}

/** A resolved sentence, or `null` when the key or a placeholder is missing. */
export function renderStored(
  tStored: TranslateStored,
  key: string,
  params: MessageParams,
): string | null {
  const rendered = tStored(key, params)
  // `interpolate` leaves an unknown token exactly as written, which is visible
  // damage in a sentence. A row with a hole in it degrades to the fallback.
  return rendered === null || rendered.includes('{') ? null : rendered
}

/** The columns this module reads. Narrower than the inbox's own row type. */
export interface StoredNotification {
  readonly titleKey: string
  readonly titleParams: StoredParams | null
  readonly bodyKey: string
  readonly bodyParams: StoredParams | null
}

export interface NotificationCopy {
  readonly title: string
  readonly body: string | null
}

/**
 * One row's sentence pair, in the reader's language.
 *
 * The body falls to `null` rather than to the fallback line when only the title
 * resolved: a heading with no sub-line is a designed state, a heading followed
 * by a generic apology is noise. A title that does not resolve takes the whole
 * row to the fallback, because a row with no heading is not a row.
 */
export function notificationCopy(
  row: StoredNotification,
  options: {
    readonly locale: Locale
    readonly t: Translate
    readonly tStored: TranslateStored
  },
): NotificationCopy {
  const { locale, t, tStored } = options
  const title = renderStored(
    tStored,
    `${STORED_PREFIX}${eventOf(row.titleKey)}.title`,
    paramsFrom(row.titleParams ?? row.bodyParams, locale),
  )
  const body = renderStored(
    tStored,
    `${STORED_PREFIX}${eventOf(row.bodyKey)}.body`,
    paramsFrom(row.bodyParams ?? row.titleParams, locale),
  )

  if (title === null) {
    return {
      title: t('shell.notification.fallback.title'),
      body: body ?? t('shell.notification.fallback.body'),
    }
  }
  return { title, body }
}
