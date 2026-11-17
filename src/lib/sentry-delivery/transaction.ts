import { z } from 'zod'
import { scrubEvent, scrubTelemetry } from '#/lib/sentry-scrub'
import type { BrowserOptions } from '@sentry/react'

export type TransportOptions = Parameters<
  NonNullable<BrowserOptions['transport']>
>[0]
export type SdkTransport = ReturnType<NonNullable<BrowserOptions['transport']>>
export type TransactionEnvelope = Parameters<SdkTransport['send']>[0]
export const MAX_TRANSACTION_BYTES = 512 * 1024
export const TRANSACTION_LIFETIME = 30_000
export const MAX_TRANSACTION_ATTEMPTS = 3
const eventId = z.string().regex(/^[a-f0-9]{32}$/)
const text = z.string().max(2048)
const headerSchema = z
  .object({
    event_id: eventId,
    sent_at: z
      .string()
      .max(64)
      .refine((value) => Number.isFinite(Date.parse(value))),
    sdk: z
      .object({
        name: text.optional(),
        version: text.optional(),
        integrations: z.array(text).max(100).optional(),
        packages: z
          .array(z.object({ name: text, version: text }).strict())
          .max(100)
          .optional(),
      })
      .strict()
      .optional(),
    trace: z
      .object({
        trace_id: text.optional(),
        public_key: text.optional(),
        sample_rate: text.optional(),
        release: text.optional(),
        environment: text.optional(),
        transaction: text.optional(),
        replay_id: text.optional(),
        sampled: text.optional(),
        sample_rand: text.optional(),
        org_id: text.optional(),
      })
      .strict()
      .optional(),
  })
  .strict()
const itemSchema = z.object({ type: z.literal('transaction') }).passthrough()
const payloadSchema = z
  .object({
    type: z.literal('transaction'),
    event_id: eventId.optional(),
    request: z
      .object({
        url: z.string().optional(),
        headers: z.record(z.string(), z.string()).optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough()

/** Only SDK-filtered, single JSON transactions can enter the write-ahead store. */
export function readTransaction(body: unknown) {
  if (typeof body !== 'string' || body.length > MAX_TRANSACTION_BYTES)
    return null
  if (new TextEncoder().encode(body).byteLength > MAX_TRANSACTION_BYTES)
    return null
  const lines = body.split('\n')
  if (lines.length !== 3) return null
  try {
    const header = scrubTelemetry(headerSchema.parse(JSON.parse(lines[0])))
    const item = itemSchema.parse(JSON.parse(lines[1]))
    const payload = payloadSchema.parse(JSON.parse(lines[2]))
    if (payload.event_id !== undefined && payload.event_id !== header.event_id)
      return null
    const scrubbed = scrubEvent(payload)
    const safeBody = [
      JSON.stringify(header),
      JSON.stringify(item),
      JSON.stringify(scrubbed),
    ].join('\n')
    if (new TextEncoder().encode(safeBody).byteLength > MAX_TRANSACTION_BYTES)
      return null
    const envelope: TransactionEnvelope = [header, [[item, scrubbed]]]
    return { id: header.event_id, body: safeBody, envelope }
  } catch {
    return null
  }
}

/** Persist only the transaction delay, never response headers or endpoint credentials. */
export function transactionBackoff(response: Response, now: number): number {
  // The installed SDK returns413 before updating any rate limits.
  if (response.status === 413) return 0
  const limits = response.headers.get('x-sentry-rate-limits')
  if (limits) {
    let until = 0
    for (const limit of limits.split(',')) {
      const [seconds, categories] = limit.trim().split(':', 2)
      if (categories && !categories.split(';').includes('transaction')) continue
      const parsed = Number.parseInt(seconds, 10)
      until = Math.max(
        until,
        now + (Number.isFinite(parsed) ? parsed : 60) * 1000,
      )
    }
    return until
  }
  const retryAfter = response.headers.get('retry-after')
  if (retryAfter) {
    const seconds = Number.parseInt(retryAfter, 10)
    if (Number.isFinite(seconds)) return now + seconds * 1000
    const date = Date.parse(retryAfter)
    return Number.isFinite(date) ? date : now + 60_000
  }
  return response.status === 429 ? now + 60_000 : 0
}
