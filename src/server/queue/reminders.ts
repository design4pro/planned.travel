/**
 * Reminder index.
 *
 * Reminders ("your flight to Lisbon is tomorrow") must fire without a cron job
 * scanning D1 every fifteen minutes. Instead the write path registers a reminder
 * in KV under a key whose prefix sorts by due time, and the cron sweep lists the
 * head of that range. KV returns keys in lexicographic order, so a zero-padded
 * epoch prefix gives a due-date queue for the cost of one list call.
 *
 * Cost at 10 users is a handful of KV writes a day. Cost at 10 000 users is the
 * same shape: one `list` per cron tick per 1 000 due reminders.
 */

import { z } from 'zod'
import { SYSTEM_ORG_ID, enqueueTasks } from './jobs'
import type { EnqueueInput } from './jobs'
import type { TaskBindings, TaskKind } from './types'
import type { Logger } from '../observability/logger'

export const REMINDER_PREFIX = 'reminder:'

/** 13 digits covers epoch milliseconds until the year 33658. */
const DUE_WIDTH = 13

export const reminderRecordSchema = z.object({
  orgId: z.string().min(1).max(64),
  tripId: z.string().min(1).max(64),
  entity: z.object({ kind: z.string().min(1).max(32), id: z.string().min(1).max(64) }),
  dueAt: z.number().int().positive(),
  to: z.array(z.string().email()).min(1).max(20),
  subject: z.string().min(1).max(200),
  html: z.string().min(1).max(100_000),
  text: z.string().max(100_000).optional(),
})

export type ReminderRecord = z.infer<typeof reminderRecordSchema>

export function reminderKey(record: Pick<ReminderRecord, 'dueAt' | 'orgId' | 'entity'>): string {
  const due = String(Math.trunc(record.dueAt)).padStart(DUE_WIDTH, '0')
  return `${REMINDER_PREFIX}${due}:${record.orgId}:${record.entity.kind}:${record.entity.id}`
}

/** Parses the due timestamp back out of a key without reading the value. */
export function reminderDueFromKey(key: string): number | null {
  if (!key.startsWith(REMINDER_PREFIX)) return null
  const due = Number.parseInt(key.slice(REMINDER_PREFIX.length, REMINDER_PREFIX.length + DUE_WIDTH), 10)
  return Number.isFinite(due) ? due : null
}

type ReminderStore = TaskBindings['KV']

/**
 * Registers (or re-registers) a reminder. Writing the same entity twice with a
 * new due time leaves the old key behind, so callers cancel first — the repos
 * that own reservations do exactly that when a date changes.
 */
export async function scheduleReminder(kv: ReminderStore, record: ReminderRecord): Promise<string> {
  const parsed = reminderRecordSchema.parse(record)
  const key = reminderKey(parsed)
  // The key expires shortly after its due time so a missed sweep self-cleans.
  const ttlSeconds = Math.max(60, Math.ceil((parsed.dueAt - Date.now()) / 1000) + 7 * 24 * 60 * 60)
  await kv.put(key, JSON.stringify(parsed), { expirationTtl: ttlSeconds })
  return key
}

export async function cancelReminder(
  kv: ReminderStore,
  record: Pick<ReminderRecord, 'dueAt' | 'orgId' | 'entity'>,
): Promise<void> {
  await kv.delete(reminderKey(record))
}

export interface DueReminder {
  key: string
  record: ReminderRecord
}

/**
 * Reads reminders whose due time has passed. Stops at the first key that is not
 * yet due — the ordering guarantees everything after it is in the future too.
 */
export async function dueReminders(
  kv: ReminderStore,
  now: number,
  limit = 200,
): Promise<Array<DueReminder>> {
  const listed = await kv.list({ prefix: REMINDER_PREFIX, limit: Math.min(limit, 1000) })
  const due: Array<DueReminder> = []
  for (const key of listed.keys) {
    const dueAt = reminderDueFromKey(key.name)
    if (dueAt === null) continue
    if (dueAt > now) break
    const raw = await kv.get(key.name)
    if (raw === null) continue
    let parsed: unknown
    try {
      parsed = JSON.parse(raw)
    } catch {
      continue
    }
    const record = reminderRecordSchema.safeParse(parsed)
    if (!record.success) continue
    due.push({ key: key.name, record: record.data })
    if (due.length >= limit) break
  }
  return due
}

export interface ReminderSweepResult {
  scanned: number
  enqueued: number
  discarded: number
}

/**
 * Cron entry point: turns due reminders into `email` jobs and clears their keys.
 * Sending is the queue's job, so a provider outage retries without re-scanning.
 */
export async function sweepReminders(
  env: TaskBindings,
  logger: Logger,
  now: number,
  limit = 200,
): Promise<ReminderSweepResult> {
  const due = await dueReminders(env.KV, now, limit)
  if (due.length === 0) {
    return { scanned: 0, enqueued: 0, discarded: 0 }
  }

  const inputs: Array<EnqueueInput<TaskKind>> = due.map(({ record }) => ({
    kind: 'email' as const,
    orgId: record.orgId,
    // Deterministic id: a redelivered sweep cannot send the same reminder twice.
    id: `reminder:${record.entity.kind}:${record.entity.id}:${record.dueAt}`,
    payload: {
      to: record.to,
      subject: record.subject,
      html: record.html,
      ...(record.text === undefined ? {} : { text: record.text }),
      tag: 'trip-reminder',
    },
  }))

  await enqueueTasks(env.TASKS, inputs, () => now)
  await Promise.all(due.map(({ key }) => env.KV.delete(key)))

  logger.info('reminder sweep enqueued notifications', {
    scanned: due.length,
    enqueued: inputs.length,
    orgs: new Set(due.map((entry) => entry.record.orgId)).size,
  })

  return { scanned: due.length, enqueued: inputs.length, discarded: 0 }
}

export { SYSTEM_ORG_ID }
