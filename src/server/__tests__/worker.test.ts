/**
 * The cron switch, and one property of it that is easy to get right once and lose in a refactor.
 *
 * `17 4 * * 1` carries two jobs. The one that is written is the 400-day `platform_audit_log` prune
 * (docs/ACCESS.md §4.3); the one that is not is the R2 retention sweep of expired backups and export
 * artifacts that `wrangler.jsonc` registered the slot for. Only three cron expressions exist on
 * production (docs/DEPLOY.md §11), so the prune joined that slot rather than adding a fourth — and
 * the warning naming the missing half has to survive the prune failing, because the week this slot
 * is unhealthy is the week that signal is worth having. Sequencing decides that, and sequencing is
 * exactly what nothing was pinning.
 *
 * Everything the entry module pulls in for its other exports — the Start handler, the Durable Object
 * class, the D1 client, the queue consumer — is replaced here. This is a test about a `switch`.
 */

import { describe, expect, it, vi } from 'vitest'
import type * as CatalogAudit from '../catalog/audit'
import type * as Observability from '../observability/logger'
import type { LogContext, LogFields, LogRecord } from '#/server/observability'

const harness = vi.hoisted(() => {
  const records: Array<LogRecord> = []
  return {
    records,
    sink: {
      write(record: LogRecord): void {
        records.push(record)
      },
    },
    prune: vi.fn(),
    sweep: vi.fn(),
  }
})

vi.mock('../do', () => ({ TripRoom: class TripRoom {} }))

vi.mock('@tanstack/react-start/server', () => ({
  createStartHandler: () => (): Response => new Response(null),
  defaultStreamHandler: (): Response => new Response(null),
}))

vi.mock('../db/client', () => ({ createDb: () => ({ name: 'platform-db' }) }))

vi.mock('../queue/consumer', () => ({ consumeTaskBatch: vi.fn() }))

vi.mock('../queue/reminders', () => ({ sweepReminders: harness.sweep }))

vi.mock('../catalog/audit', async (importOriginal) => {
  const actual = await importOriginal<typeof CatalogAudit>()
  return { ...actual, prunePlatformAuditLog: harness.prune }
})

vi.mock('../observability/logger', async (importOriginal) => {
  const actual = await importOriginal<typeof Observability>()
  return {
    ...actual,
    loggerFromEnv: (
      _env: unknown,
      options?: { context?: LogContext & LogFields },
    ) =>
      actual.createLogger({
        level: 'debug',
        sink: harness.sink,
        context: options?.context,
      }),
  }
})

const { PLATFORM_SYSTEM_ACTOR } = await import('../catalog/audit')
const worker = (await import('../worker')).default

const RETENTION_CRON = '17 4 * * 1'
const SCHEDULED_AT = Date.UTC(2026, 7, 24, 4, 17)

const env = {
  DB: { binding: 'DB' },
  BACKUP_RETENTION_DAYS: 30,
} as unknown as Cloudflare.Env

function controller(cron: string): ScheduledController {
  return { cron, scheduledTime: SCHEDULED_AT, noRetry: () => undefined }
}

/**
 * The third argument the runtime always passes and this test used to omit.
 *
 * It became load-bearing when the entry was wrapped in `Sentry.withSentry`: the wrapper flushes
 * pending events through `ctx.waitUntil`, because a Worker isolate can be torn down the moment a
 * handler resolves and an unflushed report is a lost one. Omitting it never described how the
 * handler is really called.
 */
function executionContext(): ExecutionContext {
  return {
    waitUntil: () => undefined,
    passThroughOnException: () => undefined,
    props: {},
  } as unknown as ExecutionContext
}

function pendingWarnings(): Array<LogRecord> {
  return harness.records.filter(
    (record) => record.msg === 'cron half has no handler yet',
  )
}

describe('the weekly retention slot', () => {
  it('runs the audit prune as the platform itself, at the tick it was scheduled for', async () => {
    harness.records.length = 0
    harness.prune
      .mockReset()
      .mockResolvedValue({ deleted: 12, batches: 1, drained: true })

    await worker.scheduled(controller(RETENTION_CRON), env, executionContext())

    expect(harness.prune).toHaveBeenCalledTimes(1)
    const [db, actor, logger, options] = harness.prune.mock.calls[0]
    expect(db).toEqual({ name: 'platform-db' })
    expect(actor).toBe(PLATFORM_SYSTEM_ACTOR)
    expect(logger).toBeDefined()
    expect(options).toEqual({ now: new Date(SCHEDULED_AT) })
    // The prune reports its own row count; the branch adds nothing about it.
    expect(
      harness.records.filter((record) =>
        record.msg.includes('retention prune'),
      ),
    ).toEqual([])
  })

  it('names the half of the slot that is still unwritten', async () => {
    harness.records.length = 0
    harness.prune
      .mockReset()
      .mockResolvedValue({ deleted: 0, batches: 1, drained: true })

    await worker.scheduled(controller(RETENTION_CRON), env, executionContext())

    const warnings = pendingWarnings()
    expect(warnings).toHaveLength(1)
    expect(warnings[0]?.level).toBe('warn')
    expect(warnings[0]?.pending).toBe('backup and export artifact retention')
    expect(warnings[0]?.cron).toBe(RETENTION_CRON)
    expect(warnings[0]?.retentionDays).toBe(30)
  })

  it('still names it when the prune rejects, which is the week it matters', async () => {
    // The ordering property, and the whole reason this file exists. Sequenced after the prune, the
    // warning would go missing in precisely the week the slot is unhealthy — a signal that is
    // present only while everything else works is not a signal.
    harness.records.length = 0
    harness.prune.mockReset().mockRejectedValue(new Error('D1 unavailable'))

    await expect(
      worker.scheduled(controller(RETENTION_CRON), env, executionContext()),
    ).rejects.toThrow('D1 unavailable')

    expect(harness.prune).toHaveBeenCalledTimes(1)
    expect(pendingWarnings()).toHaveLength(1)
  })

  it('leaves the other expressions alone', async () => {
    harness.records.length = 0
    harness.prune.mockReset()
    harness.sweep.mockReset().mockResolvedValue(undefined)

    await worker.scheduled(controller('*/15 * * * *'), env, executionContext())
    await worker.scheduled(controller('0 0 31 2 *'), env, executionContext())

    expect(harness.sweep).toHaveBeenCalledTimes(1)
    expect(harness.prune).not.toHaveBeenCalled()
    expect(pendingWarnings()).toEqual([])
    expect(harness.records.map((record) => record.msg)).toContain(
      'unrecognised cron expression',
    )
  })
})
