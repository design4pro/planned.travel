/**
 * Which language the document is written in, decided once per request.
 *
 * `docs/SPEC.md` §9 rule 3 fixes both the order — user setting → workspace setting →
 * visitor cookie → `Accept-Language` → `en` — and the place: on the server,
 * before first paint,
 * so `<html lang>` and `<html dir>` are part of the first bytes and no screen
 * ever renders twice to correct itself. `src/routes/__root.tsx` calls
 * {@link negotiateRequestLocale} from its `loader` (never `beforeLoad`, which is
 * not dehydrated and re-runs in the browser where there is no request to read)
 * and hands the answer to the shell.
 *
 * **The anonymous path costs nothing.** `docs/SPEC.md` §5 keeps D1 out of the
 * critical path for marketing pages, and this function runs on every one of
 * them. Better Auth answers `null` when there is no session cookie, so an anonymous request to `/` or `/pricing` reaches
 * {@link LocaleRequestSource.storedLocale} — the only member that touches the
 * database — never at all. That short-circuit is a guarantee, not an
 * optimisation, which is why the reads are injected: a test can prove the D1
 * side was not called rather than assert on a query count.
 *
 * **Negotiation never fails a page.** A settings read that throws — a signed-in
 * caller whose workspace cannot be resolved, a D1 hiccup — drops through to
 * the visitor cookie, `Accept-Language` and then to `en`. A document in the wrong
 * language is a defect; a document that does not render at all is a worse one.
 */
import { createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { z } from 'zod'

import { directionOf, LOCALE_TAGS, negotiate } from '#/lib/i18n'
import { parseVisitorLocaleCookie } from '#/lib/i18n/visitor-locale'
import { getSession } from '#/server/auth/session'
import { getEffectiveSettings } from '#/server/repos'
import { appScope } from './context'
import { writeVisitorLocaleCookie } from './-lib/visitor-locale'

import type { Direction, Locale } from '#/lib/i18n'
import type { AuthSession } from '#/server/auth/session'

/** What the shell puts on `<html>`, and what the message layer loads. */
export interface NegotiatedLocale {
  /** One of the twenty-three shipped tags. Never a stored value verbatim. */
  readonly locale: Locale
  /** The writing direction of that locale's script. */
  readonly dir: Direction
  /** Presentation hint only, never an authorisation decision. */
  readonly signedIn: boolean
}

/**
 * The things a request can say about language, each behind a call so the
 * expensive one stays unevaluated when the cheap one has already answered.
 */
export interface LocaleRequestSource {
  /** The caller's session, or `null` when the request is anonymous. */
  readonly session: () => Promise<AuthSession | null>
  /**
   * `getEffectiveSettings`' merge of the traveller's override over the
   * workspace default — the one place that precedence is written down
   * (`src/server/repos/settings.ts`). Called only for a real session.
   */
  readonly storedLocale: () => Promise<string | null>
  /** The `Accept-Language` header, verbatim. Never a normalised copy. */
  readonly acceptLanguage: () => string | null
  /** The bounded and canonicalised visitor cookie, or null when absent. */
  readonly visitorLocale: () => string | null
}

/**
 * Runs §9 rule 3's chain over one request's inputs.
 *
 * A stored tag is passed to `negotiate` rather than trusted: `en-GB` was the
 * legacy column default and free text was writable before the picker existed, so
 * `resolveLocaleTag` canonicalises it and an unresolvable value falls to the
 * visitor cookie and then the header, exactly as an absent one does.
 *
 * There is no separate `workspace` argument because the first two steps of the
 * chain have already been taken by the time this sees them — the repository's
 * merge *is* "override, else workspace default", and duplicating the precedence
 * here would be a second opinion about it.
 */
export async function negotiateLocaleFrom(
  source: LocaleRequestSource,
): Promise<NegotiatedLocale> {
  const session = await source.session()
  const locale = negotiate({
    user: await storedLocaleForCaller(source, session),
    visitor: source.visitorLocale(),
    acceptLanguage: source.acceptLanguage(),
  })
  return { locale, dir: directionOf(locale), signedIn: session !== null }
}

/** The caller's stored preference, or `null` for anyone who has none. */
async function storedLocaleForCaller(
  source: LocaleRequestSource,
  session: AuthSession | null,
): Promise<string | null> {
  if (session === null) {
    return null
  }
  try {
    return await source.storedLocale()
  } catch {
    return null
  }
}

/** Production's wiring: the real session, the real merge, the real header. */
const requestSource: LocaleRequestSource = {
  session: getSession,
  storedLocale: async () =>
    (await getEffectiveSettings(await appScope())).locale,
  acceptLanguage: () => getRequestHeader('accept-language') ?? null,
  visitorLocale: () =>
    parseVisitorLocaleCookie(getRequestHeader('cookie') ?? null),
}

/**
 * The locale for this request. Takes no input, so there is nothing to validate
 * and nothing a client could assert about itself: the answer is derived from the
 * session cookie and the request headers, both of which the server owns.
 */
export const negotiateRequestLocale = createServerFn({ method: 'GET' }).handler(
  async (): Promise<NegotiatedLocale> => negotiateLocaleFrom(requestSource),
)

/** Anonymous, same-origin preference write. Global CSRF middleware covers this POST. */
export const saveVisitorLanguage = createServerFn({ method: 'POST' })
  .validator(z.object({ locale: z.enum(LOCALE_TAGS) }))
  .handler(async ({ data }) => {
    writeVisitorLocaleCookie(data.locale)
    return { locale: data.locale }
  })
