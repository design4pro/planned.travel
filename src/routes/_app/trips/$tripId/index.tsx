import { createFileRoute, redirect } from '@tanstack/react-router'

import {
  DEFAULT_TRIP_TAB,
  TRIP_TAB_ROUTES,
  readRememberedTripTab,
} from '#/lib/trip-tab'

/**
 * A trip has no landing page of its own — the plan *is* the trip. Redirecting in
 * `beforeLoad` keeps `/trips/:id` a valid, shareable address without ever
 * painting an intermediate screen.
 *
 * Which tab it lands on is the reader's own memory, read **only in the
 * browser**. `beforeLoad` runs on the Worker for a cold load and in the browser
 * for a client navigation, and neither storage object exists in the first case:
 * a cold load of `/trips/<id>` therefore lands on the plan and a client
 * navigation lands on the remembered tab. That is the honest behaviour — the
 * alternative reads a preference the server could not have seen, which is a
 * hydration mismatch dressed as a feature.
 */
export const Route = createFileRoute('/_app/trips/$tripId/')({
  beforeLoad: ({ params }) => {
    const tab =
      typeof window === 'undefined'
        ? DEFAULT_TRIP_TAB
        : readRememberedTripTab(params.tripId)
    throw redirect({ to: TRIP_TAB_ROUTES[tab], params, replace: true })
  },
})
