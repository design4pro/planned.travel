/// <reference types="@cloudflare/workers-types" />

/**
 * The `AI` binding, declared here rather than in `worker-configuration.d.ts`.
 *
 * That file is the authoritative home for bindings and `vars` — `../auth/cloudflare-env.d.ts` says
 * so, and re-declaring one of its members here would *override* rather than extend it. `AI` is not
 * one of its members: the checked-in copy predates this binding, and regenerating it with
 * `pnpm cf-typegen` is not available as a fix. Measured on this tree, a fresh `wrangler types` run
 * rewrites `TRIP_ROOM` as `DurableObjectNamespace<import('./src/server/worker').TripRoom>`, which
 * makes the module that declares `TripRoom` depend on a type derived from itself; `Cloudflare.Env`
 * then resolves empty and `pnpm typecheck` reports 19 errors on bindings nobody touched — `DB`,
 * `FILES`, `SESSIONS`, `TASKS` and `TRIP_ROOM` among them. Regenerating is therefore its own repair
 * on its own paths, and it is reported on PRD #167 rather than taken here.
 *
 * Adding a member the generated file does not carry is the safe half of that rule: nothing is
 * weakened, and the declaration disappears the day the generated one is correct again.
 *
 * Non-optional, unlike the secrets the sibling augmentations declare. A secret may legitimately be
 * absent — an unconfigured OAuth provider is a provider that is simply off — but `wrangler.jsonc`
 * declares this binding in both deployed environments, and `src/server/ai/__tests__/binding.test.ts`
 * holds it to that. A binding that is guaranteed and typed as optional only teaches its callers to
 * write a fallback for a case that cannot happen.
 */
declare namespace Cloudflare {
  interface Env {
    /** Workers AI — docs/adr/0012-workers-ai-for-confirmation-extraction.md. */
    AI: Ai
  }
}
