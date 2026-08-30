/**
 * The provider screen's server surface.
 *
 * A forwarder, and deliberately nothing more. `#/server/fns/console/providers` owns the guard, the
 * queries and the audit writes; this exists for the reason every `-server/` module in this
 * directory exists: a route module is a client module, and importing that function directly would
 * pull its module graph — `cloudflare:workers` with it — into the browser build.
 *
 * **These are the only `createServerFn`s on their paths, and the functions they forward to are
 * plain `async function`s for that reason.** A `createServerFn` nested inside another one's handler
 * compiles to an RPC stub the build never registers, and throws `Server function info not found` in
 * the deployed Worker; `scripts/check-server-fn-manifest.mjs` fails `pnpm build` on it.
 */

import { createServerFn } from '@tanstack/react-start'

import {
  readProviders,
  saveProviderLimit,
  saveProviderLimitInput,
} from '#/server/fns/console/providers'

import type {
  ProviderPanel,
  ProvidersView,
  SaveProviderLimitInput,
} from '#/server/fns/console/providers'

export type { ProviderPanel, ProvidersView, SaveProviderLimitInput }

export const loadProviders = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ProvidersView> => readProviders(),
)

export const updateProviderLimitFn = createServerFn({ method: 'POST' })
  // Validated at the boundary, before the handler and before the guard: an unparseable body is a
  // bad request rather than a permission question, and the schema is the server function's own.
  .inputValidator((input: unknown) => saveProviderLimitInput.parse(input))
  .handler(async ({ data }): Promise<ProviderPanel> => saveProviderLimit(data))
