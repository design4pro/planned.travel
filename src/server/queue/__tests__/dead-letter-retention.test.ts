/**
 * The dead-letter retention deleter, driven through the object-store port with a fake bucket. What
 * matters is which keys survive a run: only `dead-letter/` objects past the period go, a rerun finds
 * nothing left to do, and a bad configuration value can never widen the deletion.
 */

import { describe, expect, it } from 'vitest'

import {
  DEAD_LETTER_RETENTION_DAYS_DEFAULT,
  pruneDeadLetters,
  resolveDeadLetterRetentionDays,
} from '../dead-letter-retention'
import { createLogger, createMemorySink } from '../../observability/logger'
import { fakeBucket } from '#/server/storage/__tests__/fake-bucket'

const DAY = 24 * 60 * 60 * 1000
const NOW = new Date('2026-10-18T04:17:00.000Z')

const ago = (days: number): Date => new Date(NOW.getTime() - days * DAY)

function harness() {
  const sink = createMemorySink()
  return { sink, logger: createLogger({ sink, now: () => NOW.getTime() }) }
}

describe('pruneDeadLetters', () => {
  it('deletes dead letters past the period and keeps newer ones', async () => {
    const bucket = fakeBucket({
      'dead-letter/2026-09-01/old.json': { body: '{}', uploaded: ago(47) },
      'dead-letter/2026-10-10/edge.json': { body: '{}', uploaded: ago(14) },
      'dead-letter/2026-10-17/new.json': { body: '{}', uploaded: ago(1) },
    })
    const { logger } = harness()

    const result = await pruneDeadLetters(bucket, logger, {
      now: NOW,
      retentionDays: 14,
    })

    expect(result).toMatchObject({ listed: 3, deleted: 1, drained: true })
    expect([...bucket.remaining].sort()).toEqual([
      'dead-letter/2026-10-10/edge.json',
      'dead-letter/2026-10-17/new.json',
    ])
  })

  it('is a no-op on a rerun', async () => {
    const bucket = fakeBucket({
      'dead-letter/2026-09-01/old.json': { body: '{}', uploaded: ago(47) },
      'dead-letter/2026-10-17/new.json': { body: '{}', uploaded: ago(1) },
    })
    const { logger } = harness()
    await pruneDeadLetters(bucket, logger, { now: NOW, retentionDays: 14 })
    const callsAfterFirst = bucket.calls.length

    const second = await pruneDeadLetters(bucket, logger, {
      now: NOW,
      retentionDays: 14,
    })

    expect(second.deleted).toBe(0)
    expect(bucket.calls.length).toBe(callsAfterFirst)
    expect(bucket.remaining.size).toBe(1)
  })

  it('reads every page of a listing larger than one page', async () => {
    const seeded: Record<string, { body: string; uploaded: Date }> = {}
    for (let index = 0; index < 7; index += 1) {
      seeded[`dead-letter/2026-08-0${index + 1}/old-${index}.json`] = {
        body: '{}',
        uploaded: ago(60 + index),
      }
    }
    seeded['dead-letter/2026-10-17/new.json'] = {
      body: '{}',
      uploaded: ago(1),
    }
    const bucket = fakeBucket(seeded, { pageSize: 3 })
    const { logger } = harness()

    const result = await pruneDeadLetters(bucket, logger, {
      now: NOW,
      retentionDays: 14,
    })

    expect(result).toMatchObject({ listed: 8, deleted: 7, drained: true })
    expect(bucket.listCalls.length).toBe(3)
    expect([...bucket.remaining]).toEqual(['dead-letter/2026-10-17/new.json'])
  })

  it('never lists or deletes outside the dead-letter prefix', async () => {
    const bucket = fakeBucket({
      'dead-letter/2026-09-01/old.json': { body: '{}', uploaded: ago(47) },
      'trips/org-a/trip-1/file-1-photo.jpg': { body: 'x', uploaded: ago(900) },
      'exports/org-a/trip-1/task.pdf': { body: 'x', uploaded: ago(900) },
    })
    const { logger } = harness()

    await pruneDeadLetters(bucket, logger, { now: NOW, retentionDays: 14 })

    expect(
      bucket.listCalls.every((call) => call.prefix === 'dead-letter/'),
    ).toBe(true)
    expect([...bucket.remaining].sort()).toEqual([
      'exports/org-a/trip-1/task.pdf',
      'trips/org-a/trip-1/file-1-photo.jpg',
    ])
  })

  it('stops at the page cap and reports that it did not drain', async () => {
    const seeded: Record<string, { body: string; uploaded: Date }> = {}
    for (let index = 0; index < 6; index += 1) {
      seeded[`dead-letter/2026-08-01/old-${index}.json`] = {
        body: '{}',
        uploaded: ago(60),
      }
    }
    const bucket = fakeBucket(seeded, { pageSize: 2 })
    const { logger, sink } = harness()

    const result = await pruneDeadLetters(bucket, logger, {
      now: NOW,
      retentionDays: 14,
      maxPages: 2,
    })

    expect(result).toMatchObject({ deleted: 4, drained: false })
    expect(bucket.remaining.size).toBe(2)
    expect(sink.records.at(-1)).toMatchObject({ drained: false, deleted: 4 })
  })

  it('logs counts only, never a key', async () => {
    const bucket = fakeBucket({
      'dead-letter/2026-09-01/secret-id.json': {
        body: '{}',
        uploaded: ago(47),
      },
    })
    const { logger, sink } = harness()

    await pruneDeadLetters(bucket, logger, { now: NOW, retentionDays: 14 })

    expect(JSON.stringify(sink.records)).not.toContain('secret-id')
    expect(sink.records.at(-1)).toMatchObject({
      listed: 1,
      deleted: 1,
      retentionDays: 14,
    })
  })
})

describe('resolveDeadLetterRetentionDays', () => {
  it('reads a number or a numeric string', () => {
    expect(resolveDeadLetterRetentionDays(30)).toBe(30)
    expect(resolveDeadLetterRetentionDays('7')).toBe(7)
  })

  it.each([undefined, '', 'soon', 0, -3, '0', '-1', Number.NaN])(
    'falls back to the default for %s so a bad value never widens the deletion',
    (value) => {
      expect(resolveDeadLetterRetentionDays(value as never)).toBe(
        DEAD_LETTER_RETENTION_DAYS_DEFAULT,
      )
    },
  )

  it('states a default of 14 days, the lifetime of the KV summary', () => {
    expect(DEAD_LETTER_RETENTION_DAYS_DEFAULT).toBe(14)
  })
})
