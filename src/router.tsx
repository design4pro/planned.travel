import * as Sentry from '@sentry/react'
import { QueryClientProvider } from '@tanstack/react-query'
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { createQueryClient } from './lib/query'
import { routeTree } from './routeTree.gen'

import type { ReactNode } from 'react'

/**
 * One router per request on the server, one for the lifetime of the tab in the
 * browser. The query client is created alongside it — sharing a single client
 * across requests on a warm Worker isolate would leak one visitor's cache into
 * another's SSR pass.
 *
 * The client is handed to routes two ways, and both are needed: as router
 * `context` so loaders can `ensureQueryData` before a route renders, and through
 * `QueryClientProvider` so `useQuery` in components resolves the same cache.
 */
export function getRouter() {
  const queryClient = createQueryClient()

  const router = createTanStackRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    defaultPreloadStaleTime: 0,
    Wrap: ({ children }: { children: ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  })

  /**
   * Routing spans, added here because this is the only place that holds the router.
   *
   * Guarded on `import.meta.env.SSR` rather than on `router.isServer`: both are correct at runtime,
   * but only the build-time constant lets Rollup drop the branch *and* the import from the Worker
   * bundle. `@sentry/react` is a browser SDK - it has no business being evaluated in workerd, where
   * the Worker already runs `@sentry/cloudflare`.
   *
   * `addIntegration` rather than an `integrations` entry in `Sentry.init`, because the router does
   * not exist yet when the client entry initialises. It is a no-op when no client was configured.
   */
  if (!import.meta.env.SSR) {
    Sentry.addIntegration(
      Sentry.tanstackRouterBrowserTracingIntegration(router),
    )
  }

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
