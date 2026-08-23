import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { Direction } from 'radix-ui'
import { AppToaster } from '#/components/layout/app-toaster'
import { TooltipProvider } from '#/components/ui'
import { RootErrorBoundary } from '#/components/layout/error-state'
import { RootNotFound } from '#/components/layout/not-found'
import { FONT_PRECONNECT_ORIGINS, FONT_STYLESHEET_HREF } from '#/lib/fonts'
import { DEFAULT_LOCALE, I18nProvider, loadCatalogue } from '#/lib/i18n'
import { themeBootstrapScript } from '#/lib/theme'
import { negotiateRequestLocale } from '#/server/fns/locale'

import appCss from '../styles/styles.css?url'

import type { QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import type { Catalogue, Direction as TextDirection, Locale } from '#/lib/i18n'

/** Everything the router hands to every route. Extended per-layout via `beforeLoad`. */
export interface RouterContext {
  queryClient: QueryClient
}

const SITE_URL = 'https://planned.travel'
const SITE_NAME = 'planned.travel'
const TITLE = 'planned.travel — plan every trip together'
const DESCRIPTION =
  'Collaborative trip planning with interactive maps, shared itineraries, budgets, packing lists, reservations, a travel journal and a world map of everywhere you have been.'

/** The brand mark, inlined so the tab icon costs no request and never 404s. */
const FAVICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">' +
  '<rect width="28" height="28" rx="9" fill="#16150f"/>' +
  '<circle cx="8.6" cy="20.2" r="2.4" fill="#f8f7f4"/>' +
  '<path d="M18.6 5.6a3.6 3.6 0 0 1 3.6 3.6c0 2.6-3.6 6-3.6 6s-3.6-3.4-3.6-6a3.6 3.6 0 0 1 3.6-3.6Z" fill="#f8f7f4"/>' +
  '<circle cx="18.6" cy="9.2" r="1.25" fill="#16150f"/>' +
  '</svg>'

const FAVICON_HREF = `data:image/svg+xml,${encodeURIComponent(FAVICON_SVG)}`

/** What the shell needs before it can write a single byte of the document. */
interface ShellData {
  readonly locale: Locale
  readonly dir: TextDirection
  readonly messages: Catalogue
}

/** The language every request falls back to when negotiation cannot answer. */
const SOURCE_LANGUAGE: ShellData = {
  locale: DEFAULT_LOCALE,
  dir: 'ltr',
  messages: {},
}

export const Route = createRootRouteWithContext<RouterContext>()({
  /**
   * `docs/SPEC.md` §8.3: one negotiation, on the server, before first paint.
   *
   * It has to be `loader` rather than `beforeLoad` — loader data is dehydrated
   * into the SSR stream and read back during hydration, while `beforeLoad`
   * context is not, so the same code in `beforeLoad` would run again in the
   * browser, where there is no request whose `Accept-Language` to read, and
   * answer differently on the two sides of the wire.
   *
   * The catalogue is loaded here too, and travels with the locale: the provider
   * takes an already-resolved bag of messages, so the first render is in the
   * negotiated language and there is no second pass to correct it. On the
   * client — after the language picker writes and calls `router.invalidate()` —
   * this same loader runs again and imports exactly one locale's chunk.
   *
   * Nothing in here may throw. The shell renders inside the router's error
   * boundary but *outside* every match, so a root loader that rejects leaves it
   * with no data at all and takes the whole document with it. English is a
   * worse answer than the reader's language; it is a far better one than a
   * blank page.
   */
  loader: async (): Promise<ShellData> => {
    try {
      const { locale, dir } = await negotiateRequestLocale()
      return { locale, dir, messages: await loadCatalogue(locale) }
    } catch {
      return SOURCE_LANGUAGE
    }
  },
  /**
   * The negotiated language is a property of the request, not of the route, so
   * re-running this on every client navigation would spend an RPC to be told
   * the same thing. `router.invalidate()` reloads an invalidated match whatever
   * its staleness, which is exactly the seam the picker uses to switch language.
   */
  staleTime: Number.POSITIVE_INFINITY,
  /** The document carries one visitor's language; no shared cache may reuse it. */
  headers: () => ({ vary: 'accept-language, cookie' }),
  head: ({ loaderData }) => ({
    meta: [
      { charSet: 'utf-8' },
      {
        name: 'viewport',
        // `viewport-fit=cover` is what makes the safe-area tokens mean anything.
        content: 'width=device-width, initial-scale=1, viewport-fit=cover',
      },
      { title: TITLE },
      { name: 'description', content: DESCRIPTION },
      { name: 'application-name', content: SITE_NAME },
      { name: 'apple-mobile-web-app-title', content: 'planned' },
      { name: 'format-detection', content: 'telephone=no' },
      { name: 'color-scheme', content: 'light dark' },
      {
        name: 'theme-color',
        content: '#faf9f7',
        media: '(prefers-color-scheme: light)',
      },
      {
        name: 'theme-color',
        content: '#121211',
        media: '(prefers-color-scheme: dark)',
      },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: SITE_URL },
      // The same tag `<html lang>` carries, so a share card and a screen reader
      // are told one story. `loaderData` is absent only while the loader is
      // still in flight, which on the server it never is.
      { property: 'og:locale', content: loaderData?.locale ?? DEFAULT_LOCALE },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
    ],
    links: [
      // Both origins warmed before the stylesheet is parsed, then the one
      // request that carries every script the product can render. The URL and
      // the origins are data in `src/lib/fonts.ts`; there is exactly one copy of
      // them in the repo, because it and the stacks in `tokens.css` have to name
      // the same eight families or a script silently loses its face.
      ...FONT_PRECONNECT_ORIGINS.map(({ href, crossOrigin }) => ({
        rel: 'preconnect',
        href,
        crossOrigin,
      })),
      { rel: 'stylesheet', href: FONT_STYLESHEET_HREF },
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', href: FAVICON_HREF, type: 'image/svg+xml' },
      { rel: 'canonical', href: SITE_URL },
    ],
  }),
  errorComponent: RootErrorBoundary,
  notFoundComponent: RootNotFound,
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: ReactNode }) {
  // The shell renders outside `matchContext`, so the route-relative
  // `useLoaderData()` has no match to read and throws here. `Route.useLoaderData`
  // names the root route explicitly and works.
  const { locale, dir, messages } = Route.useLoaderData()

  return (
    // The bootstrap script below writes `data-theme`/`color-scheme` onto <html>
    // before React hydrates, which is exactly the mismatch we want to allow.
    // `lang` and `dir` are *not* in that category: they are server-rendered from
    // the negotiated locale and must match byte for byte after hydration.
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        {/* First thing in <head>: commits the right palette with frame one. */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeBootstrapScript }}
        />
        <HeadContent />
      </head>
      <body>
        {/* The catalogue is already resolved, so `t()` is synchronous and the
            first render is in the reader's language. */}
        <I18nProvider locale={locale} messages={messages}>
          {/* Radix reads direction from here rather than from the DOM: without
              it, roving focus, arrow-key axes and popover side/align stay
              left-to-right under mirrored CSS, so in `ar` the arrow keys walk
              backwards through a toolbar that is visibly the other way round. */}
          <Direction.DirectionProvider dir={dir}>
            {/* One provider for the whole app, which is what the primitive asks
                for: without an ancestor here every `<Tooltip>` outside the three
                components that carry their own provider throws on first render —
                taking the route's server render down with it. Mounted at the root
                it also does the job it exists for, letting the second hint in a
                toolbar appear instantly instead of waiting out the delay again. */}
            <TooltipProvider delayDuration={250} skipDelayDuration={200}>
              {children}
            </TooltipProvider>
            <AppToaster />
            {import.meta.env.DEV ? (
              <TanStackDevtools
                config={{ position: 'bottom-right' }}
                plugins={[
                  {
                    name: 'TanStack Router',
                    render: <TanStackRouterDevtoolsPanel />,
                  },
                  {
                    name: 'TanStack Query',
                    render: <ReactQueryDevtoolsPanel />,
                  },
                ]}
              />
            ) : null}
          </Direction.DirectionProvider>
        </I18nProvider>
        <Scripts />
      </body>
    </html>
  )
}
