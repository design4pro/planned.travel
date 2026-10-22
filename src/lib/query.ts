import { QueryClient } from '@tanstack/react-query'

import { isWorkspaceChanged } from './workspace-claim'

const ONE_MINUTE = 60_000

/**
 * Pull an HTTP-ish status code off an unknown thrown value. Server functions
 * surface errors as plain objects across the wire, so several shapes are worth
 * probing before we decide whether a retry could ever help.
 */
function statusOf(error: unknown): number | undefined {
  if (typeof error !== 'object' || error === null) return undefined

  const candidate = error as {
    status?: unknown
    statusCode?: unknown
    response?: { status?: unknown } | null
  }

  if (typeof candidate.status === 'number') return candidate.status
  if (typeof candidate.statusCode === 'number') return candidate.statusCode

  const responseStatus = candidate.response?.status
  return typeof responseStatus === 'number' ? responseStatus : undefined
}

/** 4xx means we asked wrongly — hammering the edge will not change the answer. */
export function isRetriableError(error: unknown): boolean {
  // The same call would be refused again: the tab's workspace is not the session's until it reloads.
  if (isWorkspaceChanged(error)) return false
  const status = statusOf(error)
  if (status === undefined) return true
  if (status === 408 || status === 425 || status === 429) return true
  return status < 400 || status >= 500
}

/**
 * One factory used by both the SSR pass and the browser so cache behaviour can
 * never drift between environments. A fresh client per request keeps one
 * visitor's data from leaking into another's render on a shared Worker isolate.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // Long enough to survive a nav round trip, short enough to feel live.
        staleTime: ONE_MINUTE,
        gcTime: 5 * ONE_MINUTE,
        retry: (failureCount, error) => failureCount < 2 && isRetriableError(error),
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
        refetchOnWindowFocus: false,
        refetchOnReconnect: true,
        // Loaders already await their queries; a second network trip on mount
        // would only produce a flash of stale-then-fresh content.
        refetchOnMount: false,
        throwOnError: false,
      },
      mutations: {
        retry: 0,
        networkMode: 'online',
      },
    },
  })
}
