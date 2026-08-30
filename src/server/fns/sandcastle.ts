/**
 * The console's read of the sandcastle run registry.
 *
 * One question, asked once: what is the agent fleet doing. Which runs are live, on which machine,
 * in which stage, holding which issues; and which branches a run left behind when it died. The
 * registry is a Durable Object (ADR 0009) whose whole purpose is that there is exactly one of it,
 * so this is a straight read of one object rather than a query over rows.
 *
 * **Here rather than under `./console`.** That directory is the account, session and impersonation
 * surface, and its invariants are written for it: fifteen functions, every one validating a payload,
 * every mutation in the audit vocabulary of docs/ACCESS.md §4.2. This is none of those things — no
 * input, no mutation, nothing about an account — and moving it in would mean widening three rules
 * that exist for a different subject. It authorises through the same `requirePermission` either way,
 * which is the part that has to be shared.
 *
 * **Read only, and there is nothing else to offer.** The registry is written by the agent loop
 * through `/api/sandcastle/*` under a bearer token, never by a console session — so `sandcastle`
 * holds one action in the dictionary (docs/ACCESS.md §2.3a) and this file holds one function.
 *
 * **A deployment without the binding is not an error.** It is production, where the binding is
 * deliberately absent (`wrangler.jsonc`) because a second registry would let two fleets each believe
 * they hold the backlog. `coordinator: false` says so, and the screen says it in words; a thrown
 * error would read as "the fleet is broken" when the answer is "this is not where the fleet is
 * coordinated".
 */
import { env } from 'cloudflare:workers'
import { createServerFn } from '@tanstack/react-start'

import { requirePermission } from '#/server/auth/guard'
import { getSession } from '#/server/auth/session'
import {
  readSandcastleState,
  registryStateSchema,
  SANDCASTLE_COORDINATOR_REPO,
} from '#/server/do'

import type { RegistryState, SandcastleRegistryNamespace } from '#/server/do'

/**
 * What the console got back: the fleet, or the fact that this deployment does not coordinate one.
 *
 * A discriminated union rather than a nullable state, because the two cases read identically as
 * "nothing to show" and mean opposite things — an idle fleet and no fleet at all.
 */
export type SandcastleRegistryView =
  | { readonly coordinator: false }
  | { readonly coordinator: true; readonly state: RegistryState }

/**
 * The binding, or `undefined` where there is no coordinator.
 *
 * `wrangler types` writes one `Env` from the top-level config and this binding is declared only
 * under `env.staging`, so it cannot appear on that type without also claiming production has it.
 * The cast states what is true instead: it may be there, and the caller must handle its absence.
 */
function sandcastleRegistry(): SandcastleRegistryNamespace | undefined {
  return (env as { SANDCASTLE_REGISTRY?: SandcastleRegistryNamespace })
    .SANDCASTLE_REGISTRY
}

export const readSandcastleRegistryFn = createServerFn({
  method: 'GET',
}).handler(async (): Promise<SandcastleRegistryView> => {
  requirePermission(await getSession(), { sandcastle: ['read'] })

  const registry = sandcastleRegistry()
  if (registry === undefined) return { coordinator: false }

  const response = await readSandcastleState(
    registry,
    SANDCASTLE_COORDINATOR_REPO,
  )
  if (!response.ok) {
    throw new Error(
      `The sandcastle registry answered ${response.status} to a state read.`,
    )
  }

  // Parsed on the way out of the object as well as on the way in: the schema is the one both sides
  // are written against (`sandcastle-protocol.ts`), so a registry redeployed ahead of this Worker is
  // caught here rather than rendered as a half-populated screen.
  return {
    coordinator: true,
    state: registryStateSchema.parse(await response.json()),
  }
})
