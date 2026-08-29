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
import { createDb } from './db/client'
import { consumeTaskBatch } from './queue/consumer'
import { TripRoom as UninstrumentedTripRoom } from './do'
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
    _ctx: ExecutionContext,
  ): Promise<void> {
    const logger = workerLogger(env, { context: { component: 'queue' } })
    await consumeTaskBatch(batch, taskEnv(env), logger)
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
        // This slot has two jobs, and only one of them is written.
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
        // Written: the 400-day prune of `platform_audit_log` (docs/ACCESS.md §4.3). It is the only
        // delete path that table has, it selects by `created_at` alone, it acts as an explicit
        // `system` actor, and it logs its own row count — so there is nothing to report here that
        // the writer has not already emitted.
        await prunePlatformAuditLog(
          createDb(env.DB),
          PLATFORM_SYSTEM_ACTOR,
          logger,
          {
            now: new Date(controller.scheduledTime),
          },
        )
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
