import { HeadContent, Scripts, createRootRouteWithContext } from '@tanstack/react-router'
import { TanStackDevtools } from '@tanstack/react-devtools'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'
import { AppToaster } from '#/components/layout/app-toaster'
import { TooltipProvider } from '#/components/ui'
import { RootErrorBoundary } from '#/components/layout/error-state'
import { RootNotFound } from '#/components/layout/not-found'
import { themeBootstrapScript } from '#/lib/theme'

import appCss from '../styles/styles.css?url'

import type { QueryClient } from '@tanstack/react-query'
import type { ReactNode } from 'react'

/** Everything the router hands to every route. Extended per-layout via `beforeLoad`. */
export interface RouterContext {
  queryClient: QueryClient
}

const SITE_URL = 'https://planned.travel'
const SITE_NAME = 'planned.travel'
const TITLE = 'planned.travel — plan every trip together'
const DESCRIPTION =
  'Collaborative trip planning with interactive maps, shared itineraries, budgets, packing lists, reservations, a travel journal and a world map of everywhere you have been.'

/**
 * Both faces in one request, discovered in `<head>` rather than behind the app
 * stylesheet, so the display font is ready before the hero paints.
 */
const FONTS_HREF =
  'https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=MuseoModerno:wght@400;500;700;800&display=swap'

/** The brand mark, inlined so the tab icon costs no request and never 404s. */
const FAVICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28">' +
  '<rect width="28" height="28" rx="9" fill="#16150f"/>' +
  '<circle cx="8.6" cy="20.2" r="2.4" fill="#f8f7f4"/>' +
  '<path d="M18.6 5.6a3.6 3.6 0 0 1 3.6 3.6c0 2.6-3.6 6-3.6 6s-3.6-3.4-3.6-6a3.6 3.6 0 0 1 3.6-3.6Z" fill="#f8f7f4"/>' +
  '<circle cx="18.6" cy="9.2" r="1.25" fill="#16150f"/>' +
  '</svg>'

const FAVICON_HREF = `data:image/svg+xml,${encodeURIComponent(FAVICON_SVG)}`

export const Route = createRootRouteWithContext<RouterContext>()({
  head: () => ({
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
      { name: 'theme-color', content: '#faf9f7', media: '(prefers-color-scheme: light)' },
      { name: 'theme-color', content: '#121211', media: '(prefers-color-scheme: dark)' },
      { property: 'og:type', content: 'website' },
      { property: 'og:site_name', content: SITE_NAME },
      { property: 'og:title', content: TITLE },
      { property: 'og:description', content: DESCRIPTION },
      { property: 'og:url', content: SITE_URL },
      { property: 'og:locale', content: 'en' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { name: 'twitter:title', content: TITLE },
      { name: 'twitter:description', content: DESCRIPTION },
    ],
    links: [
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      { rel: 'stylesheet', href: FONTS_HREF },
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
  return (
    // The bootstrap script below writes `data-theme`/`color-scheme` onto <html>
    // before React hydrates, which is exactly the mismatch we want to allow.
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        {/* First thing in <head>: commits the right palette with frame one. */}
        <script
          suppressHydrationWarning
          dangerouslySetInnerHTML={{ __html: themeBootstrapScript }}
        />
        <HeadContent />
      </head>
      <body>
        {/* One provider for the whole app, which is what the primitive asks for:
            without an ancestor here every `<Tooltip>` outside the three
            components that carry their own provider throws on first render —
            taking the route's server render down with it. Mounted at the root it
            also does the job it exists for, letting the second hint in a toolbar
            appear instantly instead of waiting out the delay again. */}
        <TooltipProvider delayDuration={250} skipDelayDuration={200}>
          {children}
        </TooltipProvider>
        <AppToaster />
        {import.meta.env.DEV ? (
          <TanStackDevtools
            config={{ position: 'bottom-right' }}
            plugins={[
              { name: 'TanStack Router', render: <TanStackRouterDevtoolsPanel /> },
              { name: 'TanStack Query', render: <ReactQueryDevtoolsPanel /> },
            ]}
          />
        ) : null}
        <Scripts />
      </body>
    </html>
  )
}
