/**
 * The browser entry point.
 *
 * TanStack Start generates one of these when the file is absent, and the generated one does exactly
 * what the bottom of this file does. It exists here for the four lines above it: `Sentry.init` has
 * to run before hydration, because an error thrown while React is hydrating is one of the failures
 * most worth hearing about and there is no earlier hook.
 *
 * Until this file existed, a crash in the browser was invisible. `RootErrorBoundary` rendered a
 * panel and told nobody, and nothing listened for an unhandled rejection - so the only failures the
 * project could see were the ones that happened on the server.
 */

import * as Sentry from '@sentry/react'
import { StartClient } from '@tanstack/react-start/client'
import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'

import { scrubEvent } from '#/lib/sentry-scrub'

/**
 * A DSN is public by design - it ships in this bundle and is visible to anyone who reads it. It is
 * a build-time variable rather than a secret for that reason, and the browser could not read a
 * Worker secret in any case.
 */
const dsn = import.meta.env.VITE_SENTRY_DSN

if (typeof dsn === 'string' && dsn.length > 0) {
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_ENVIRONMENT,
    // The same value the Worker reports, so one deploy is one release rather than two unrelated
    // halves. See `src/server/observability/sentry.ts`.
    release: import.meta.env.VITE_SENTRY_RELEASE,
    sendDefaultPii: false,
    beforeSend: scrubEvent,
    // Errors only, for now. Tracing on the client needs the router instance to name routes, which
    // this entry does not hold, and untagged spans would cost quota to say "some URL was slow".
    tracesSampleRate: 0,
  })
}

hydrateRoot(
  document,
  <StrictMode>
    <StartClient />
  </StrictMode>,
)
