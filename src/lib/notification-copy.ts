/**
 * Stored notification rows into readable sentences — the primitives both halves
 * of the product share.
 *
 * `src/server/repos/notifications.ts` keeps a notification as `titleKey` +
 * `bodyKey` + a params record and never as a rendered sentence, "so a
 * notification written a year ago still renders in the reader's current
 * language". Two callers have to honour that and neither can reach the other:
 * the inbox and the bell render a stored row for whoever is reading
 * (`src/components/layout/notification-copy.ts`), while dispatch renders the
 * same key pair into an email before the row is even written
 * (`src/server/notifications/dispatch.ts`), and `docs/SPEC.md` §6 keeps
 * `src/components` on the browser side of the fence.
 *
 * So the three things they must agree on live here — how a key is spelled, how a
 * stored params record becomes message params, and what counts as a miss — and
 * each side keeps only its own fallback policy. A copy of them on the other side
 * of the fence is how the email came to print `1234` where the inbox printed
 * `1,234`.
 */

import { formatNumber } from '#/lib/format'

import type { Locale, MessageParams, TranslateStored } from '#/lib/i18n'

/**
 * The stored `params` column, structurally.
 *
 * The shape is the one `jsonRecordSchema` in `src/server/repos/notifications.ts`
 * validates, so a row assigns to it — declared rather than imported because this
 * module is read from the browser side too.
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

/** The catalogue key one half of one event renders through. */
export function storedKey(key: string, half: 'title' | 'body'): string {
  return `${STORED_PREFIX}${eventOf(key)}.${half}`
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

/**
 * The tally an event's body may carry after it, and the param that counts it.
 *
 * `trip.copied` is the one event with one: the notes a shortened range dropped, which is worth a
 * clause only when it is not zero. It cannot be a clause *inside* `.body`, because a message
 * carries a single plural count and that one is already spent on the days — so it is a second
 * message, and the two are joined as a list rather than as grammar.
 */
const BODY_TALLIES: ReadonlyMap<string, string> = new Map([
  ['trip.copied', 'dropped'],
])

/** The middle dot `src/lib/i18n/messages/en/trips.ts` states for a list of tallies. */
const TALLY_JOIN = ' · '

/**
 * The body half of a stored row, with any tally its event carries appended.
 *
 * Both surfaces render through this rather than through {@link renderStored} directly, because the
 * inbox and the email that announces the same row have to say the same thing — the divergence this
 * module exists to prevent.
 */
export function renderStoredBody(
  tStored: TranslateStored,
  key: string,
  stored: StoredParams | null,
  locale: Locale,
): string | null {
  const body = renderStored(
    tStored,
    storedKey(key, 'body'),
    paramsFrom(stored, locale),
  )
  const name = BODY_TALLIES.get(eventOf(key))
  if (body === null || name === undefined) {
    return body
  }
  const count = Number(stored?.[name] ?? 0)
  if (!Number.isFinite(count) || count <= 0) {
    return body
  }
  const tally = renderStored(
    tStored,
    `${STORED_PREFIX}${eventOf(key)}.${name}`,
    { count, [name]: formatNumber(count, locale) },
  )
  return tally === null ? body : `${body}${TALLY_JOIN}${tally}`
}
