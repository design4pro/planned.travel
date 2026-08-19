import { createFileRoute, redirect } from '@tanstack/react-router'

/**
 * A trip has no landing page of its own — the plan *is* the trip. Redirecting in
 * `beforeLoad` keeps `/trips/:id` a valid, shareable address without ever
 * painting an intermediate screen.
 */
export const Route = createFileRoute('/_app/trips/$tripId/')({
  beforeLoad: ({ params }) => {
    throw redirect({ to: '/trips/$tripId/plan', params, replace: true })
  },
})
