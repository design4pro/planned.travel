/**
 * Turning a stored notification row into the sentence a person reads.
 *
 * `src/server/repos/notifications.ts` keeps a notification as `titleKey` +
 * `bodyKey` + a `params` record and never as a rendered sentence, "so a
 * notification written a year ago still renders in the reader's current
 * language". This module is the render half of that bargain, and it is the only
 * path any surface uses: nothing in the product renders a notification through
 * anything else.
 *
 * The primitives it renders through — the key spelling, the params coercion and
 * the "a hole is a miss" rule — live in `#/lib/notification-copy`, because the
 * email `src/server/notifications/dispatch.ts` sends renders the same key pair
 * and `docs/SPEC.md` §6 keeps `src/components` on the browser side of the fence.
 * What stays here is the one thing only a screen has an opinion about: which
 * half of a row may fall back, and to what. They are re-exported so this module
 * remains the single import any surface needs.
 *
 * It is now the only such table in the tree. `src/routes/_app/-lib/notifications.ts`
 * held the English catalogue this module replaced, plus the `NOTIFICATION_EVENTS`
 * and `CHANNEL_LABELS` lists the preferences screen used to draw before it
 * declared its own axes as message keys. Nothing imported any of it, so it was
 * 222 lines of unreachable second catalogue, and it is deleted.
 *
 * This module lives beside the chrome rather than in a route helper because two
 * surfaces read the same rows — the inbox screen and, when a row grows a
 * preview, the bell — and because it is pure, so it can be tested without a
 * session, a request or a browser.
 */

import {
  paramsFrom,
  renderStored,
  renderStoredBody,
  storedKey,
} from '#/lib/notification-copy'

import type { Locale, Translate, TranslateStored } from '#/lib/i18n'
import type { StoredParams } from '#/lib/notification-copy'

export {
  STORED_PREFIX,
  eventOf,
  paramsFrom,
  renderStored,
  renderStoredBody,
  storedKey,
} from '#/lib/notification-copy'
export type { StoredParams } from '#/lib/notification-copy'

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
    storedKey(row.titleKey, 'title'),
    paramsFrom(row.titleParams ?? row.bodyParams, locale),
  )
  const body = renderStoredBody(
    tStored,
    row.bodyKey,
    row.bodyParams ?? row.titleParams,
    locale,
  )

  if (title === null) {
    return {
      title: t('shell.notification.fallback.title'),
      body: body ?? t('shell.notification.fallback.body'),
    }
  }
  return { title, body }
}
