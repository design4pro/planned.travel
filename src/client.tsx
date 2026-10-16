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
 *
 * Everything here is inside the DSN guard, and the guard is a build-time constant - so a build
 * without a DSN drops the whole block, and with it Replay and the tracing machinery, rather than
 * shipping a few hundred kilobytes that would never send anything.
 */

import * as Sentry from '@sentry/react'
import { StartClient } from '@tanstack/react-start/client'
import { StrictMode } from 'react'
import { hydrateRoot } from 'react-dom/client'

import { scrubEvent, scrubTelemetry } from '#/lib/sentry-scrub'

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
    beforeSendTransaction: scrubTelemetry,
    beforeSendSpan: scrubTelemetry,
    beforeSendLog: scrubTelemetry,
    enableLogs: true,
    // A tenth of sessions, and every session that hit an error - the second is the one that pays
    // for itself, because it is the recording somebody will actually want to watch.
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1,
    // Routing spans are added in `src/router.tsx`, which is the only place holding the router.
    tracesSampleRate:
      import.meta.env.VITE_ENVIRONMENT === 'production' ? 0.1 : 1,
  })
}

/**
 * After the entry, never inside it: the recorder is ~38 kB gzipped and nothing it records has
 * happened yet at this point. `replaysOnErrorSampleRate` still captures the session that hit an
 * error, because the buffer starts as soon as this resolves.
 */
if (typeof dsn === 'string' && dsn.length > 0) {
  void import('#/lib/sentry-replay').then((replay) => {
    replay.startSessionReplay()
  })
}

hydrateRoot(
  document,
  <StrictMode>
    <StartClient />
  </StrictMode>,
)
