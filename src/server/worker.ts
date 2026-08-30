/**
 * The Worker entry point.
 *
 * TanStack Start's own entry (`@tanstack/react-start/server-entry`) exports only
 * `fetch`. A Worker, though, is the union of everything `wrangler.jsonc`
 * declares: this project also declares a Durable Object class, a queue consumer
 * and three cron triggers, and the runtime can only find those if the entry
 * module exports them. Miniflare is blunt about the omission — a missing
 * `TripRoom` export fails isolate startup outright, so `vite dev` never serves a
 * request.
 *
 * Hence this module rather than the default entry: it re-creates Start's fetch
 * handler and exports it alongside the class, the consumer and the scheduler.
 */

import * as Sentry from '@sentry/cloudflare'
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { PLATFORM_SYSTEM_ACTOR, prunePlatformAuditLog } from './catalog/audit'
import { rollUpProviderUsage } from './catalog/provider-usage'
import { createDb } from './db/client'
import { consumeTaskBatch } from './queue/consumer'
import {
  SandcastleRegistry as UninstrumentedSandcastleRegistry,
  TripRoom as UninstrumentedTripRoom,
} from './do'
import { sweepReminders } from './queue/reminders'
import { sentryOptions, workerLogger } from './observability/sentry'

// Type-only, so nothing resolves `cloudflare:workers` at runtime - the node test project cannot.
// The branded class from that module is what Sentry's wrapper is declared against; the global
// `DurableObject` from `@cloudflare/workers-types` is a different, unbranded description.
import type { DurableObject as BrandedDurableObject } from 'cloudflare:workers'
import type { TaskBindings } from './queue/types'

/**
 * Re-exported so `durable_objects.bindings[].class_name` resolves.
 *
 * Wrapped, because a Durable Object is its own isolate: `withSentry` below covers the Worker's
 * handlers and sees nothing that happens inside the room. Without this, a throw in the collaborative
 * editing path - the one place in this application where several people share state - is the one
 * class of failure Sentry would never hear about.
 */
export const TripRoom = Sentry.instrumentDurableObjectWithSentry(
  (env: Cloudflare.Env) => sentryOptions(env),
  // The same structural bridge `taskEnv` below performs, in the other direction and for the same
  // reason. `TripRoom` is declared against narrow views of its own inputs - `TripRoomState`,
  // `TripRoomEnv`, `TripRoomSocket` - which is what lets it be constructed with fakes in a plain
  // Node test. Sentry's wrapper is declared against the real `DurableObjectState` and `Env`. Both
  // descriptions are of the same runtime object, and the runtime satisfies each; only the two
  // static descriptions cannot see that about each other. This assertion is the one place they meet.
  UninstrumentedTripRoom as unknown as new (
    state: DurableObjectState,
    env: Cloudflare.Env,
  ) => BrandedDurableObject<Cloudflare.Env>,
)

/**
 * Re-exported for the same reason as `TripRoom`, and wrapped for a sharper one: the registry is
 * the only thing standing between two sandcastle fleets and the same issue. A silent throw in its
 * claim path degrades into exactly the concurrent double-build it exists to prevent, and an AFK
 * loop by definition has nobody watching the terminal it would have printed to.
 */
export const SandcastleRegistry = Sentry.instrumentDurableObjectWithSentry(
  (env: Cloudflare.Env) => sentryOptions(env),
  UninstrumentedSandcastleRegistry as unknown as new (
    state: DurableObjectState,
    env: Cloudflare.Env,
  ) => BrandedDurableObject<Cloudflare.Env>,
)

const fetchHandler = createStartHandler(defaultStreamHandler)

/**
 * `Cloudflare.Env` is the generated binding surface; `TaskBindings` is the
 * narrow structural view the queue and cron code was written against. The real
 * bindings satisfy it structurally, so this is the one place the two meet.
 */
function taskEnv(env: Cloudflare.Env): TaskBindings {
  return env
}

/**
 * The three expressions `wrangler.jsonc` registers, and there are exactly three on production
 * (docs/DEPLOY.md §11). The weekly retention slot now carries the 400-day `platform_audit_log`
 * prune as well as the backup and export retention it was registered for; a fourth expression for
 * that prune would falsify that count, so it joins the existing one rather than adding one.
 */
const REMINDER_CRON = '*/15 * * * *'
const BACKUP_CRON = '0 3 * * *'
const RETENTION_CRON = '17 4 * * 1'

export default Sentry.withSentry((env: Cloudflare.Env) => sentryOptions(env), {
  /**
   * `fetchHandler` is Start's, and its second parameter is its own `RequestOptions` - not the
   * Worker `env` the runtime passes there. Naming only `request` keeps the two apart; handing the
   * environment to a parameter that expects request options was never intended and is not what
   * wrapping this handler is supposed to preserve.
   */
  fetch: (request: Request): Response | Promise<Response> =>
    fetchHandler(request),

  async queue(
    batch: MessageBatch<unknown>,
    env: Cloudflare.Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    const logger = workerLogger(env, { context: { component: 'queue' } })
    // `ctx` is handed down rather than ignored so the provider meter's deferred writes are kept
    // alive by the context that owns this batch. A queue invocation is not a request, so the
    // ambient `waitUntil` of `cloudflare:workers` is not the one that governs its lifetime.
    await consumeTaskBatch(batch, taskEnv(env), logger, {
      waitUntil: ctx.waitUntil.bind(ctx),
      meterDb: createDb(env.DB),
    })
  },

  async scheduled(
    controller: ScheduledController,
    env: Cloudflare.Env,
    _ctx: ExecutionContext,
  ): Promise<void> {
    const logger = workerLogger(env, {
      context: { component: 'scheduled', route: `cron:${controller.cron}` },
    })
    const bindings = taskEnv(env)

    switch (controller.cron) {
      case REMINDER_CRON:
        await sweepReminders(bindings, logger, controller.scheduledTime)
        return
      case RETENTION_CRON:
        // This slot has three jobs, and one of them is still not written.
        //
        // Not written: the R2 half this expression was registered for. `wrangler.jsonc` documents
        // `17 4 * * 1` as the weekly retention prune of expired backups and export artifacts, and
        // `BACKUP_RETENTION_DAYS` is a declared var nothing acts on. Adding the audit prune beside it
        // must not make that gap invisible in Workers Observability, so the warn the branch carried
        // before this handler existed stays — one line per week, naming the half that is missing.
        //
        // It is emitted *first* for a reason that is not stylistic: the prune is the one function in
        // that module documented as able to reject, so a warn sequenced after it would go missing in
        // exactly the week this slot is unhealthy — the week the signal is worth having.
        logger.warn('cron half has no handler yet', {
          cron: controller.cron,
          pending: 'backup and export artifact retention',
          retentionDays: env.BACKUP_RETENTION_DAYS,
        })
        // Written: the 400-day prune of `platform_audit_log` (docs/ACCESS.md §4.3), and the weekly
        // fold of hourly `provider_usage` rows into their month rows. Each acts as an explicit
        // `system` actor and logs its own row count and `drained` flag, so there is nothing to
        // report here that the two writers have not already emitted.
        //
        // They run together rather than in sequence, and that is not a micro-optimisation. The
        // audit prune is documented as able to reject, so an `await` chain would silently skip
        // whatever followed it in exactly the week this slot is unhealthy — the same argument the
        // warn above is emitted first for. `allSettled` runs both and then rethrows the first
        // rejection, so neither job can hide the other and a failure is still the slot's failure.
        //
        // A fourth cron expression for the rollup was available and refused: this file and
        // `wrangler.jsonc` both state there are exactly three on production, and a new one would
        // have falsified that count to save sharing a slot that already shares.
        {
          const db = createDb(env.DB)
          const now = new Date(controller.scheduledTime)
          const outcomes = await Promise.allSettled([
            prunePlatformAuditLog(db, PLATFORM_SYSTEM_ACTOR, logger, { now }),
            rollUpProviderUsage(db, PLATFORM_SYSTEM_ACTOR, logger, { now }),
          ])
          const failed = outcomes.find(
            (outcome) => outcome.status === 'rejected',
          )
          if (failed !== undefined) {
            throw failed.reason
          }
        }
        return
      case BACKUP_CRON:
        // The `backup` task kind is declared but its handler is not written yet,
        // so enqueueing here would only fill the dead-letter queue. Logged at
        // warn so the gap is visible in Workers Observability rather than silent.
        logger.warn('cron has no handler yet', { cron: controller.cron })
        return
      default:
        logger.warn('unrecognised cron expression', { cron: controller.cron })
        return
    }
  },
})
