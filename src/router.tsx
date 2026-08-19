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

  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
