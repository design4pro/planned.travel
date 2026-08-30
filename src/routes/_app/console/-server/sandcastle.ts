/**
 * The sandcastle screen's server surface.
 *
 * A forwarder, and deliberately nothing more. `src/server/fns/sandcastle.ts` owns the read —
 * the guard, the binding and the schema — and this exists for the reason every `-server/` module in
 * this directory exists: a route module is a client module, and importing that function directly
 * would put its module graph, `cloudflare:workers` with it, into the browser build. Measured elsewhere in this directory, not assumed: that import fails `pnpm build`
 * with `Rolldown failed to resolve import "cloudflare:workers"`.
 *
 * Nothing is shaped here. The screen renders the registry's own view types, and the two derivations
 * it needs are pure and live in `../-lib/sandcastle.ts`, where they are tested.
 *
 * **This is the only `createServerFn` on the path, and the function it forwards to is a plain
 * `async function` for that reason.** A `createServerFn` nested inside another one's handler is
 * compiled to an RPC stub that the build never registers, and throws `Server function info not
 * found` in the deployed Worker — see the header of `#/server/fns/sandcastle`.
 */

import { createServerFn } from '@tanstack/react-start'

import { readSandcastleRegistry } from '#/server/fns/sandcastle'

import type { SandcastleRegistryView } from '#/server/fns/sandcastle'

export type { SandcastleRegistryView }

export const loadSandcastleRegistry = createServerFn({ method: 'GET' }).handler(
  async (): Promise<SandcastleRegistryView> => readSandcastleRegistry(),
)
