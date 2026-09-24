/**
 * Locale negotiation, and the bytes it puts on the wire.
 *
 * Two things are proved here, because §8.3 is only kept if both are true: that
 * the chain picks the right language, and that the document actually goes out
 * carrying it.
 *
 * **The chain.** `negotiateLocaleFrom` takes its three inputs as callbacks
 * rather than reaching for the session, the repository and the header itself,
 * which is what lets this file assert what `docs/SPEC.md` §5 promises — that an
 * anonymous request to a marketing page never reaches D1. A query counter would
 * only show that no query *ran*; a spy on the settings read shows the branch was
 * never taken, which is the claim.
 *
 * **The bytes.** The second half renders the real root route through a real
 * router and asserts on the HTML string, because `<html>` already carries
 * `suppressHydrationWarning` — a `lang` that disagreed between the server and
 * the client would be swallowed in silence, so "no console warning" proves
 * nothing here and only the served markup does.
 *
 * Three modules are replaced, and each for a reason that is a property of the
 * environment rather than of the code:
 *
 * - `#/server/auth/session` and `../context` reach a Worker binding through
 *   `cloudflare:workers`, which does not resolve in this project's Node
 *   environment. Nothing under test comes from either; production's wiring of
 *   them is three one-line adapters, and what is worth testing is the chain they
 *   feed.
 * - `negotiateRequestLocale` is replaced *only* for the document half. Outside a
 *   Start build there is no extracted RPC pair, so calling a server function
 *   runs its handler and then discards the return value — measured here, and the
 *   same behaviour `atlas.test.ts` documents. The stub stands in for the
 *   framework's transport and for nothing else: the handler's own logic is what
 *   the first half drives directly.
 */
import { createElement } from 'react'
import { renderToString } from 'react-dom/server'
import {
  RouterProvider,
  createMemoryHistory,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import * as ToggleGroup from 'radix-ui/toggle-group'
import { describe, expect, it, vi } from 'vitest'

import { SUPPORTED_LOCALES, directionOf } from '#/lib/i18n'
import { createQueryClient } from '#/lib/query'
import { Route as rootRoute } from '#/routes/__root'
import { negotiateLocaleFrom } from '../locale'

import type { Locale } from '#/lib/i18n'
import type { AuthSession } from '#/server/auth/session'
import type * as LocaleModule from '../locale'
import type { LocaleRequestSource, NegotiatedLocale } from '../locale'

vi.mock('#/server/auth/session', () => ({
  getSession: async (): Promise<AuthSession | null> => null,
}))

vi.mock('../context', () => ({
  appScope: async (): Promise<never> => {
    throw new Error('appScope is not reachable from this test')
  },
}))

/**
 * What the framework would have handed back over the wire. Mutable, and hoisted
 * because `vi.mock` factories are lifted above every import, so a plain `let`
 * would still be in its temporal dead zone when the factory below runs.
 */
const wire = vi.hoisted((): { negotiated: NegotiatedLocale } => ({
  negotiated: { locale: 'en', dir: 'ltr' },
}))

vi.mock('../locale', async (importOriginal) => ({
  ...(await importOriginal<typeof LocaleModule>()),
  negotiateRequestLocale: async (): Promise<NegotiatedLocale> =>
    wire.negotiated,
}))

/* ------------------------------------------------------------------- chain */

/** A session, reduced to the one thing this code path reads: that it exists. */
const SIGNED_IN = { user: { id: 'user_1' } } as unknown as AuthSession

interface RequestInputs {
  /** Absent for an anonymous caller. */
  readonly session?: AuthSession | null
  /** What `getEffectiveSettings` would answer for `locale`, or a rejection. */
  readonly stored?: string | null | Error
  readonly acceptLanguage?: string | null
}

/** One request's inputs, with a spy on the only member that costs a query. */
function source(request: RequestInputs): LocaleRequestSource & {
  readonly storedLocale: ReturnType<typeof vi.fn>
} {
  const stored = request.stored ?? null
  return {
    session: vi.fn(async () => request.session ?? null),
    storedLocale: vi.fn(async () => {
      if (stored instanceof Error) {
        throw stored
      }
      return stored
    }),
    acceptLanguage: () => request.acceptLanguage ?? null,
  }
}

describe('negotiateLocaleFrom', () => {
  describe('an anonymous request', () => {
    it('never reads the settings, so no marketing page touches D1', async () => {
      const request = source({ acceptLanguage: 'pl-PL,pl;q=0.9,en;q=0.8' })

      await expect(negotiateLocaleFrom(request)).resolves.toEqual({
        locale: 'pl',
        dir: 'ltr',
      })
      expect(request.storedLocale).not.toHaveBeenCalled()
    })

    it('falls to the source language when the header offers nothing we ship', async () => {
      await expect(
        negotiateLocaleFrom(source({ acceptLanguage: 'is,fo;q=0.8' })),
      ).resolves.toEqual({ locale: 'en', dir: 'ltr' })
    })

    it('falls to the source language when there is no header at all', async () => {
      await expect(negotiateLocaleFrom(source({}))).resolves.toEqual({
        locale: 'en',
        dir: 'ltr',
      })
    })

    it('answers a right-to-left script with its direction', async () => {
      await expect(
        negotiateLocaleFrom(source({ acceptLanguage: 'ar-EG,ar;q=0.9' })),
      ).resolves.toEqual({ locale: 'ar', dir: 'rtl' })
    })

    it('honours the header quality order rather than the written order', async () => {
      await expect(
        negotiateLocaleFrom(source({ acceptLanguage: 'de;q=0.3,ja;q=0.9' })),
      ).resolves.toEqual({ locale: 'ja', dir: 'ltr' })
    })
  })

  describe('a signed-in request', () => {
    it('prefers the stored setting over the header', async () => {
      const request = source({
        session: SIGNED_IN,
        stored: 'ar',
        acceptLanguage: 'pl,en;q=0.8',
      })

      await expect(negotiateLocaleFrom(request)).resolves.toEqual({
        locale: 'ar',
        dir: 'rtl',
      })
      expect(request.storedLocale).toHaveBeenCalledTimes(1)
    })

    it('canonicalises the region-tagged values already in the column', async () => {
      await expect(
        negotiateLocaleFrom(source({ session: SIGNED_IN, stored: 'en-GB' })),
      ).resolves.toEqual({ locale: 'en', dir: 'ltr' })

      await expect(
        negotiateLocaleFrom(source({ session: SIGNED_IN, stored: 'zh-TW' })),
      ).resolves.toEqual({ locale: 'zh-Hant', dir: 'ltr' })
    })

    it('falls to the header when the traveller has set nothing', async () => {
      await expect(
        negotiateLocaleFrom(
          source({ session: SIGNED_IN, stored: null, acceptLanguage: 'uk' }),
        ),
      ).resolves.toEqual({ locale: 'uk', dir: 'ltr' })
    })

    it('falls to the header when the stored value is not a language we ship', async () => {
      await expect(
        negotiateLocaleFrom(
          source({ session: SIGNED_IN, stored: 'xx-YY', acceptLanguage: 'sv' }),
        ),
      ).resolves.toEqual({ locale: 'sv', dir: 'ltr' })
    })

    it('degrades to the header rather than failing the document when the read throws', async () => {
      const request = source({
        session: SIGNED_IN,
        stored: new Error('no active organization'),
        acceptLanguage: 'tr',
      })

      await expect(negotiateLocaleFrom(request)).resolves.toEqual({
        locale: 'tr',
        dir: 'ltr',
      })
      expect(request.storedLocale).toHaveBeenCalledTimes(1)
    })
  })

  it('returns the registry direction for every shipped locale', async () => {
    for (const { tag, dir } of SUPPORTED_LOCALES) {
      await expect(
        negotiateLocaleFrom(source({ session: SIGNED_IN, stored: tag })),
      ).resolves.toEqual({ locale: tag, dir })
    }
  })
})

/* ---------------------------------------------------------------- document */

/**
 * A Radix control that reads the direction context, standing in for every menu,
 * toolbar and tab strip the app renders. `RovingFocusGroup` writes the direction
 * it resolved onto its own element, so the served markup says whether
 * `DirectionProvider` reached it — the difference between arrow keys that follow
 * a mirrored layout and arrow keys that walk backwards through one.
 */
function DirectionProbe() {
  return createElement(
    ToggleGroup.Root,
    { type: 'single', id: 'roving-focus-probe' },
    createElement(ToggleGroup.Item, { value: 'one' }, 'one'),
    createElement(ToggleGroup.Item, { value: 'two' }, 'two'),
  )
}

/** The element `DirectionProbe` rendered, as the document carries it. */
function probeTag(html: string): string {
  const tag = /<[a-z]+[^>]*id="roving-focus-probe"[^>]*>/.exec(html)
  if (tag === null) {
    throw new Error('the direction probe did not render')
  }
  return tag[0]
}

/** The document the root route serves for one negotiated locale. */
async function serveDocument(locale: Locale): Promise<string> {
  wire.negotiated = { locale, dir: directionOf(locale) }

  const index = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: DirectionProbe,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([index]),
    context: { queryClient: createQueryClient() },
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })

  await router.load()
  return renderToString(createElement(RouterProvider, { router }))
}

describe('the served document', () => {
  it('opens in the negotiated language', async () => {
    expect(await serveDocument('pl')).toContain('<html lang="pl" dir="ltr"')
  })

  it('opens right-to-left for Arabic', async () => {
    expect(await serveDocument('ar')).toContain('<html lang="ar" dir="rtl"')
  })

  it('hands the direction to Radix, not only to the CSS', async () => {
    expect(probeTag(await serveDocument('ar'))).toContain('dir="rtl"')
    expect(probeTag(await serveDocument('en'))).toContain('dir="ltr"')
  })

  it('tells a share card the same language the document is in', async () => {
    expect(await serveDocument('ja')).toContain(
      '<meta property="og:locale" content="ja"/>',
    )
  })

  it('requests the fonts once, from the single copy of the URL', async () => {
    const html = await serveDocument('en')

    expect(html.split('fonts.googleapis.com/css2').length - 1).toBe(1)
    // The eight families `src/lib/fonts.ts` names — the four hand-written into
    // the shell before this covered Latin and nothing else.
    expect(html).toContain('Noto+Sans+Arabic')
    expect(html).toContain(
      'rel="preconnect" href="https://fonts.googleapis.com"',
    )
    expect(html).toContain(
      'rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous"',
    )
  })
})
