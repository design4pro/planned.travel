import { createFileRoute } from '@tanstack/react-router'
// Loads the Start module augmentation that adds `server` to route options.
import type {} from '@tanstack/react-start'
import { env } from 'cloudflare:workers'

import { serveSandcastleCoordinator } from './-lib/coordinator'

import type { SandcastleCoordinatorBindings } from './-lib/coordinator'

/**
 * `/api/sandcastle/*` — the door into the sandcastle run registry, where every run claims the
 * GitHub issues it is about to work on.
 *
 * **Staging is the only coordinator.** The `SANDCASTLE_REGISTRY` binding is declared in
 * `env.staging` alone (`wrangler.jsonc`, and docs/adr/0009 for why): a coordinator is worth having
 * only if there is exactly one of it, and a second registry would let two fleets each believe they
 * hold the backlog. On production and in local dev the binding is absent and every route answers
 * 503, so "this deployment is not the coordinator" is an ordinary, exercised branch rather than a
 * configuration accident.
 *
 * A shim over `-lib/coordinator.ts`, which holds the decisions and is testable under node. This
 * module exists to read the bindings and nothing else. Declaring only `server` keeps both — and
 * the namespace — out of the client bundle.
 */

const handler = ({
  request,
  params,
}: {
  request: Request
  params: { _splat?: string }
}): Promise<Response> =>
  serveSandcastleCoordinator(
    env as SandcastleCoordinatorBindings,
    request,
    params._splat,
  )

export const Route = createFileRoute('/api/sandcastle/$')({
  server: { handlers: { GET: handler, POST: handler } },
})
