/**
 * The queue handler's own seam: the branch in front of the parse, and the order of the two things
 * that must never swap places — the meter, then the model.
 *
 * Driven directly with a fake `FILES`, a fake `KV`, a stub converter and a stub model, so nothing
 * here opens a socket and nothing here needs a database. The ceiling arrives through the seam the
 * handler declares for it, which is what lets a refusal be asserted without a subscription row.
 */

import { describe, expect, it, vi } from 'vitest'
import { createLogger, createMemorySink } from '#/server/observability'
import { rateMeterKey } from '#/server/metering/rate'
import { createBookingImportHandler, stagedImportKey } from '../booking-import'

import type { StagedImport } from '../booking-import'
import type {
  BookingImportPayload,
  TaskBindings,
  TaskContext,
} from '../../types'

const NOW = Date.parse('2026-09-11T10:00:00.000Z')
const ORG = 'org_a'
const TASK_ID = 'booking-import:trip_1:file_1'

const CALENDAR = [
  'BEGIN:VCALENDAR',
  'BEGIN:VEVENT',
  'UID:evt-1',
  'SUMMARY:Hotel Roma',
  'DTSTART:20260304T140000Z',
  'DTEND:20260307T100000Z',
  'END:VEVENT',
  'END:VCALENDAR',
].join('\r\n')

interface HarnessOptions {
  readonly source?: string
  readonly size?: number
  readonly missing?: boolean
  readonly ceiling?: number
  readonly spent?: number
  readonly conversion?: { data?: string; format?: string; error?: string }
  readonly answer?: unknown
  readonly staged?: StagedImport
  readonly withoutAi?: boolean
}

function harness(options: HarnessOptions = {}) {
  const store = new Map<string, string>()
  if (options.spent !== undefined) {
    store.set(
      rateMeterKey('extraction_calls_per_month', ORG, '2026-09'),
      String(options.spent),
    )
  }
  if (options.staged !== undefined) {
    store.set(stagedImportKey(TASK_ID), JSON.stringify(options.staged))
  }

  const source = options.source ?? 'Hotel Roma, check-in 4 March'
  const toMarkdown = vi.fn(async () => options.conversion ?? { data: source })
  const run = vi.fn(
    async () => options.answer ?? { response: '{"bookings":[]}' },
  )

  const env = {
    KV: {
      get: async (key: string) => store.get(key) ?? null,
      put: async (key: string, value: string) => {
        store.set(key, value)
      },
      delete: async (key: string) => {
        store.delete(key)
      },
    },
    FILES: {
      get: async () =>
        options.missing === true
          ? null
          : {
              body: new Response(source).body,
              size: options.size ?? source.length,
            },
    },
    ...(options.withoutAi === true ? {} : { AI: { toMarkdown, run } }),
  } as unknown as TaskBindings

  const context: TaskContext = {
    env,
    logger: createLogger({ level: 'error', sink: createMemorySink() }),
    now: () => NOW,
    attempt: 1,
    taskId: TASK_ID,
    orgId: ORG,
    callProvider: async (_label, send) => send(),
  }

  const handler = createBookingImportHandler({
    ceilingFor: async () => options.ceiling ?? 100,
  })

  return {
    handler,
    context,
    store,
    toMarkdown,
    run,
    staged: () => {
      const raw = store.get(stagedImportKey(TASK_ID))
      return raw === undefined ? null : (JSON.parse(raw) as StagedImport)
    },
    meter: () =>
      store.get(rateMeterKey('extraction_calls_per_month', ORG, '2026-09')) ??
      null,
  }
}

function payload(
  overrides: Partial<BookingImportPayload> = {},
): BookingImportPayload {
  return {
    tripId: 'trip_1',
    requestedBy: 'user_1',
    sourceKey: 'trips/org_a/trip_1/file_1-stay.pdf',
    sourceName: 'stay.pdf',
    format: 'document',
    ...overrides,
  }
}

const ONE_BOOKING = {
  response: JSON.stringify({
    bookings: [
      {
        kind: 'lodging',
        title: 'Hotel Roma',
        startsAt: '2026-03-04T14:00:00Z',
        location: 'Rome',
        reference: 'ABC123',
      },
    ],
  }),
}

describe('the document branch', () => {
  it('stages the extractor’s rows, through the same staging the parsers use', async () => {
    const world = harness({ answer: ONE_BOOKING })

    const metrics = await world.handler(payload(), world.context)

    expect(metrics).toMatchObject({ parsed: 1, staged: 1 })
    expect(world.staged()).toMatchObject({
      format: 'document',
      count: 1,
      orgId: ORG,
      tripId: 'trip_1',
      reservations: [{ title: 'Hotel Roma', kind: 'lodging' }],
    })
  })

  it('spends the meter before the binding is reached', async () => {
    const calls: Array<string> = []
    const world = harness({ answer: ONE_BOOKING })
    const original = world.context.env.KV.put.bind(world.context.env.KV)
    world.context.env.KV.put = async (key, value, init) => {
      calls.push(key.startsWith('rate:') ? 'meter' : 'staged')
      return original(key, value, init)
    }
    world.toMarkdown.mockImplementation(async () => {
      calls.push('convert')
      return { data: 'Hotel Roma' }
    })

    await world.handler(payload(), world.context)

    expect(calls.indexOf('meter')).toBeLessThan(calls.indexOf('convert'))
    expect(world.meter()).toBe('1')
  })

  it('refuses a spent ceiling as `ceiling`, and never calls the model', async () => {
    const world = harness({ ceiling: 100, spent: 100 })

    await expect(world.handler(payload(), world.context)).rejects.toMatchObject(
      {
        code: 'ceiling',
        ceiling: 100,
      },
    )
    expect(world.toMarkdown).not.toHaveBeenCalled()
    expect(world.run).not.toHaveBeenCalled()
  })

  it('refuses a plan whose allowance is zero without touching the counter store', async () => {
    const world = harness({ ceiling: 0 })

    await expect(world.handler(payload(), world.context)).rejects.toMatchObject(
      {
        code: 'ceiling',
        ceiling: 0,
      },
    )
    expect(world.meter()).toBeNull()
  })

  it('records a refusal where the reader’s poll will find it, and still fails the job', async () => {
    const world = harness({ ceiling: 0 })

    await expect(world.handler(payload(), world.context)).rejects.toThrow()

    expect(world.staged()).toMatchObject({
      count: 0,
      reservations: [],
      refusal: { code: 'ceiling', ceiling: 0 },
    })
  })

  it('records an `empty` refusal when the document confirmed no booking', async () => {
    const world = harness({ answer: { response: '{"bookings":[]}' } })

    await expect(world.handler(payload(), world.context)).rejects.toThrow()

    expect(world.staged()?.refusal).toEqual({ code: 'empty' })
  })

  it('records `unreadable` when the conversion answers its error arm', async () => {
    const world = harness({
      conversion: { format: 'error', error: 'unsupported' },
    })

    await expect(world.handler(payload(), world.context)).rejects.toThrow()

    expect(world.staged()?.refusal).toEqual({ code: 'unreadable' })
  })

  it('refuses without the AI binding rather than staging half an import', async () => {
    const world = harness({ withoutAi: true })

    await expect(world.handler(payload(), world.context)).rejects.toThrow(
      /AI binding is not available/,
    )
  })

  it('sends a .txt source straight to the model, with no conversion', async () => {
    const world = harness({
      source: 'Hotel Roma, check-in 4 March',
      answer: ONE_BOOKING,
    })

    await world.handler(
      payload({ sourceName: 'confirmation.txt' }),
      world.context,
    )

    expect(world.toMarkdown).not.toHaveBeenCalled()
    expect(world.run).toHaveBeenCalledTimes(1)
  })
})

describe('the deterministic branches', () => {
  it('spends nothing against the meter for an .ics job', async () => {
    const world = harness({ source: CALENDAR })

    const metrics = await world.handler(
      payload({ format: 'ics', sourceName: 'trip.ics' }),
      world.context,
    )

    expect(metrics).toMatchObject({ parsed: 1, staged: 1 })
    expect(world.meter()).toBeNull()
    expect(world.toMarkdown).not.toHaveBeenCalled()
    expect(world.run).not.toHaveBeenCalled()
  })

  it('spends nothing against the meter for a JSON job', async () => {
    const world = harness({
      source: JSON.stringify([{ title: 'Hotel Roma', start: '2026-03-04' }]),
    })

    await world.handler(
      payload({ format: 'json', sourceName: 'export.json' }),
      world.context,
    )

    expect(world.meter()).toBeNull()
    expect(world.staged()).toMatchObject({ format: 'json', count: 1 })
  })

  it('does not record a refusal for a deterministic parse — its behaviour is unchanged', async () => {
    const world = harness({ source: 'not json at all' })

    await expect(
      world.handler(
        payload({ format: 'json', sourceName: 'export.json' }),
        world.context,
      ),
    ).rejects.toThrow()

    expect(world.staged()).toBeNull()
  })
})

describe('the failures every format shares', () => {
  it('refuses a source that is not in the bucket', async () => {
    const world = harness({ missing: true })

    await expect(world.handler(payload(), world.context)).rejects.toThrow(
      /missing from R2/,
    )
  })

  it('refuses an object past the import ceiling as `too-large`', async () => {
    const world = harness({ size: 6 * 1024 * 1024 })

    await expect(world.handler(payload(), world.context)).rejects.toMatchObject(
      {
        code: 'too-large',
      },
    )
    expect(world.toMarkdown).not.toHaveBeenCalled()
  })
})

describe('redelivery and stored shapes', () => {
  it('overwrites the staged record on a redelivery rather than doubling it', async () => {
    const world = harness({ answer: ONE_BOOKING })

    await world.handler(payload(), world.context)
    const first = world.staged()
    await world.handler(payload(), world.context)

    expect(world.staged()).toEqual(first)
  })

  it('parses a record staged before `written` existed', () => {
    const legacy = {
      jobId: TASK_ID,
      tripId: 'trip_1',
      orgId: ORG,
      requestedBy: 'user_1',
      createdAt: NOW,
      format: 'ics' as const,
      count: 0,
      reservations: [],
    }

    const staged: StagedImport = legacy

    expect(staged.written).toBeUndefined()
    expect(staged.refusal).toBeUndefined()
  })
})
