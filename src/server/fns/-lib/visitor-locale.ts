import { getRequest, setCookie } from '@tanstack/react-start/server'
import { z } from 'zod'

import { LOCALE_TAGS } from '#/lib/i18n/locales'
import {
  VISITOR_LOCALE_COOKIE,
  VISITOR_LOCALE_COOKIE_OPTIONS,
} from '#/lib/i18n/visitor-locale'
import type { Locale } from '#/lib/i18n/locales'

/** Only validated registry tags reach the response; the protocol comes from the request URL. */
export function writeVisitorLocaleCookie(locale: Locale): void {
  const tag = z.enum(LOCALE_TAGS).parse(locale)
  setCookie(VISITOR_LOCALE_COOKIE, tag, {
    ...VISITOR_LOCALE_COOKIE_OPTIONS,
    secure: new URL(getRequest().url).protocol === 'https:',
  })
}
