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

import { createStartHandler, defaultStreamHandler } from '@tanstack/react-start/server'
import { consumeTaskBatch } from './queue/consumer'
import { sweepReminders } from './queue/reminders'
import { loggerFromEnv } from './observability/logger'

import type { TaskBindings } from './queue/types'

/** Re-exported so `durable_objects.bindings[].class_name` resolves. */
export { TripRoom } from './do'

const fetchHandler = createStartHandler(defaultStreamHandler)

/**
 * `Cloudflare.Env` is the generated binding surface; `TaskBindings` is the
 * narrow structural view the queue and cron code was written against. The real
 * bindings satisfy it structurally, so this is the one place the two meet.
 */
function taskEnv(env: Cloudflare.Env): TaskBindings {
  return env
}

/** Reminder sweep. The other two crons are handled by the branches below. */
const REMINDER_CRON = '*/15 * * * *'
const BACKUP_CRON = '0 3 * * *'
const RETENTION_CRON = '17 4 * * 1'

export default {
  fetch: fetchHandler,

  async queue(batch: MessageBatch<unknown>, env: Cloudflare.Env): Promise<void> {
    const logger = loggerFromEnv(env, { context: { component: 'queue' } })
    await consumeTaskBatch(batch, taskEnv(env), logger)
  },

  async scheduled(controller: ScheduledController, env: Cloudflare.Env): Promise<void> {
    const logger = loggerFromEnv(env, {
      context: { component: 'scheduled', route: `cron:${controller.cron}` },
    })
    const bindings = taskEnv(env)

    switch (controller.cron) {
      case REMINDER_CRON:
        await sweepReminders(bindings, logger, controller.scheduledTime)
        return
      case BACKUP_CRON:
      case RETENTION_CRON:
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
}
