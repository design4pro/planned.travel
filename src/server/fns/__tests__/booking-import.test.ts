/**
 * The confirmation import's three verbs, driven against real tables.
 *
 * The three exported plain functions are what these tests hold, rather than the `createServerFn`
 * wrappers around them: outside a Start build a server function runs its handler and discards the
 * return value, and every claim here is about what a verb *answers*. The wrappers add one line
 * each — the scope, the queue and the store — and `../__tests__/atlas.test.ts` covers that shape
 * where it has something to prove.
 *
 * Everything else is real: a migrated SQLite database from the Drizzle schema, two real tenants,
 * real repositories, the real geocoding proxy over a stub vendor. Three modules are replaced
 * because they read the Worker environment at module scope through `cloudflare:workers`, which
 * does not resolve in the `server` project: `./context`, `#/server/auth/env` and
 * `#/server/geo/bindings`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  NotFoundError,
  TripRoleError,
  addTripMember,
  countTripPlaces,
  createPlace,
  createTrip,
  getFile,
  getPlace,
  getReservation,
  listTripAccommodations,
  listTripDays,
  listTripPlaces,
  listTripReservations,
  recordFile,
  requireTrip,
  updateOrganizationSettings,
} from '#/server/repos'
import { geocodeRuntime } from '#/server/geo/bindings'
import { createHarness, captureError } from '#/server/repos/__tests__/harness'
import { stagedImportKey } from '#/server/queue/handlers/booking-import'

import type { MockInstance } from 'vitest'
import type * as Repos from '#/server/repos'
import type { RepositoryError } from '#/server/repos'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type {
  StagedImport,
  StagedReservation,
} from '#/server/queue/handlers/booking-import'
import type { TaskEnvelope, TaskQueue } from '#/server/queue/types'
import type { ConfirmBookingImportPorts } from '../booking-import'

/* ------------------------------------------------------------------ mocking */

/**
 * State the module mocks read at call time. It lives in `vi.hoisted` because `vi.mock` factories
 * are lifted above every import, so a plain `let` would still be in its temporal dead zone.
 */
const stubs = vi.hoisted(() => ({
  /** When `false`, the deployment holds no geocoding credential. */
  geocodingConfigured: true,
  /** When `true`, the stay an accommodation row would get is refused at its write. */
  failStayWrite: false,
  /** Every patch the confirm's `announce` port was handed. */
  mirrored: [] as Array<unknown>,
  /** How many lookups the geocoding vendor was asked for. */
  vendorCalls: 0,
  /**
   * The proxy's cache and its tallies, in memory.
   *
   * Cleared between tests on purpose: the proxy serves a cached answer even on a deployment
   * holding no credential, which is the behaviour its own suite asserts — and an entry surviving
   * into the next test here would make the refusal case pass for the wrong reason.
   */
  geoEntries: new Map<string, string>(),
  candidate: {
    id: 'osm:way:1',
    name: 'Hotel Roma',
    address: 'Via del Corso 1, Rome',
    city: 'Rome',
    countryCode: 'IT',
    lat: 41.9028,
    lng: 12.4964,
  },
}))

/**
 * The geocoding runtime, with both stores in memory and the vendor a stub.
 *
 * The proxy itself is **not** replaced: the pin path this module owns is the first production
 * caller of `forwardGeocode`, and the property under test — a refused lookup leaves a place with
 * no coordinates and does not fail the import — is only visible through the real one.
 */
vi.mock('#/server/geo/bindings', () => {
  const entries = stubs.geoEntries
  const store = {
    get: (key: string) => Promise.resolve(entries.get(key) ?? null),
    put: (key: string, value: string) => {
      entries.set(key, value)
      return Promise.resolve()
    },
  }
  const vendor = {
    slug: 'stub',
    retention: 'permanent' as const,
    attribution: [{ name: 'Stub', url: 'https://example.test/' }],
  }
  return {
    geocodeRuntime: (options: {
      organizationId: string
      ceiling: number
    }): unknown => ({
      cache: store,
      counters: store,
      vendor,
      provider: stubs.geocodingConfigured
        ? {
            ...vendor,
            forward: () => {
              stubs.vendorCalls += 1
              return Promise.resolve([stubs.candidate])
            },
            reverse: () => Promise.resolve([]),
          }
        : null,
      outbound: {
        db: null,
        waitUntil: () => undefined,
        logger: {
          debug: () => undefined,
          info: () => undefined,
          warn: () => undefined,
          error: () => undefined,
        },
        now: () => new Date('2026-09-11T10:00:00Z'),
      },
      organizationId: options.organizationId,
      ceiling: options.ceiling,
      now: () => new Date('2026-09-11T10:00:00Z'),
    }),
  }
})

/** One seam in the real repositories: `createAccommodation` refuses when asked to. */
vi.mock('#/server/repos', async (importOriginal) => {
  const real = await importOriginal<typeof Repos>()
  return {
    ...real,
    createAccommodation: async (
      ...args: Parameters<typeof real.createAccommodation>
    ) => {
      if (stubs.failStayWrite) {
        throw new Error('the stay write failed')
      }
      return real.createAccommodation(...args)
    },
  }
})

/**
 * `./context` is the module that reads `TRIP_ROOM`, `FILES` and `KV`. Every test below hands the
 * scope, the store and the confirm's ports in directly, so nothing here is reached.
 */
vi.mock('../context', () => ({
  appScope: () => {
    throw new Error('appScope is not reached: these tests hand the scope in.')
  },
  importStore: () => {
    throw new Error('importStore is not reached: these tests hand it in.')
  },
}))

/** Only the server-function wrappers reach for the queue binding, and none of them run here. */
vi.mock('#/server/auth/env', () => ({
  taskQueue: () => {
    throw new Error('taskQueue is not reached: these tests hand the queue in.')
  },
}))

const {
  ImportFormatError,
  bookingImportJobId,
  bookingImportView,
  confirmBookingImport,
  confirmBookingImportInputSchema,
  startBookingImport,
  startBookingImportInputSchema,
} = await import('../booking-import')

/**
 * The confirm's two ports. The room mirror records what it was given, because "one patch for the
 * batch" is a claim about a call count; the geocoding runtime is the mocked one above, over the
 * real proxy.
 */
const ports: ConfirmBookingImportPorts = {
  announce: (tripId, fields) => {
    stubs.mirrored.push({
      entity: { kind: 'trip', id: tripId },
      op: 'upsert',
      fields,
    })
    return Promise.resolve()
  },
  geocoding: geocodeRuntime,
}

/* -------------------------------------------------------------------- fakes */

/** The `TASKS` binding, recording what it was sent. */
function queueDouble(): TaskQueue & {
  readonly sent: Array<{
    readonly body: TaskEnvelope
    readonly options?: { delaySeconds?: number }
  }>
} {
  const sent: Array<{
    body: TaskEnvelope
    options?: { delaySeconds?: number }
  }> = []
  return {
    sent,
    send: (body, options) => {
      sent.push(
        options === undefined
          ? { body: body as TaskEnvelope }
          : { body: body as TaskEnvelope, options },
      )
      return Promise.resolve()
    },
    sendBatch: () => Promise.resolve(),
  }
}

/** The slice of KV the staged record lives in, in memory. */
function memoryStore(): {
  readonly entries: Map<string, string>
  get: (key: string) => Promise<string | null>
  put: (key: string, value: string) => Promise<void>
  delete: (key: string) => Promise<void>
} {
  const entries = new Map<string, string>()
  return {
    entries,
    get: (key) => Promise.resolve(entries.get(key) ?? null),
    put: (key, value) => {
      entries.set(key, value)
      return Promise.resolve()
    },
    delete: (key) => {
      entries.delete(key)
      return Promise.resolve()
    },
  }
}

/* ---------------------------------------------------------------- the world */

const NOW = Date.parse('2026-09-11T10:00:00Z')

/** A staged row the extractor could plausibly have produced. */
function stagedRow(
  overrides: Partial<StagedReservation> = {},
): StagedReservation {
  return {
    externalId: null,
    title: 'Hotel Roma',
    kind: 'lodging',
    startsAt: '2026-03-04T14:00:00Z',
    endsAt: '2026-03-07T10:00:00Z',
    allDay: false,
    floating: false,
    location: 'Via del Corso 1, Rome',
    notes: null,
    reference: 'ABC123',
    ...overrides,
  }
}

interface World {
  readonly tenant: SeededTenant
  readonly tripId: string
  readonly fileId: string
  readonly jobId: string
}

let harness: Harness
let alpha: World
let beta: World
let store: ReturnType<typeof memoryStore>

async function seedWorld(tenant: SeededTenant, label: string): Promise<World> {
  const trip = await createTrip(tenant.scope, {
    title: `Rome ${label}`,
    // A zone that is neither UTC nor the runtime's, so a resolution that used the wrong one shows.
    timezone: 'Asia/Tokyo',
    startDate: '2026-03-01',
    endDate: '2026-03-10',
  })
  const file = await recordFile(tenant.scope, {
    tripId: trip.id,
    storageKey: `files/${tenant.organizationId}/confirmation.pdf`,
    filename: 'confirmation.pdf',
    contentType: 'application/pdf',
    sizeBytes: 20_480,
  })
  return {
    tenant,
    tripId: trip.id,
    fileId: file.id,
    jobId: bookingImportJobId(trip.id, file.id),
  }
}

/** Writes a staged record the way the queue handler writes one. */
async function stage(
  world: World,
  overrides: Partial<StagedImport> = {},
): Promise<StagedImport> {
  const reservations = overrides.reservations ?? [stagedRow()]
  const staged: StagedImport = {
    jobId: world.jobId,
    tripId: world.tripId,
    orgId: world.tenant.organizationId,
    requestedBy: world.tenant.ownerUserId,
    createdAt: NOW,
    format: 'document',
    count: reservations.length,
    ...overrides,
    reservations,
  }
  await store.put(stagedImportKey(staged.jobId), JSON.stringify(staged))
  return staged
}

beforeEach(async () => {
  harness = await createHarness()
  alpha = await seedWorld(await harness.seedTenant('alpha'), 'alpha')
  beta = await seedWorld(await harness.seedTenant('beta'), 'beta')
  store = memoryStore()
  stubs.geocodingConfigured = true
  stubs.failStayWrite = false
  stubs.mirrored.length = 0
  stubs.vendorCalls = 0
  stubs.geoEntries.clear()
})

/* -------------------------------------------------------------------- start */

describe('startBookingImport', () => {
  it('enqueues one envelope whose id names the trip and the file', async () => {
    const queue = queueDouble()

    const started = await startBookingImport(alpha.tenant.scope, queue, {
      tripId: alpha.tripId,
      fileId: alpha.fileId,
      index: 0,
    })

    expect(started.jobId).toBe(`booking-import:${alpha.tripId}:${alpha.fileId}`)
    expect(started.jobId.length).toBeLessThanOrEqual(128)
    expect(queue.sent).toHaveLength(1)
    expect(queue.sent[0]?.body.id).toBe(started.jobId)
    // Enqueued without a delay at all rather than with a delay of zero.
    expect(queue.sent[0]?.options).toBeUndefined()
  })

  it('takes the storage key, the filename, the media type and the format off the stored row', async () => {
    const queue = queueDouble()

    await startBookingImport(alpha.tenant.scope, queue, {
      tripId: alpha.tripId,
      fileId: alpha.fileId,
      index: 0,
    })

    expect(queue.sent[0]?.body.payload).toEqual({
      tripId: alpha.tripId,
      requestedBy: alpha.tenant.ownerUserId,
      sourceKey: `files/${alpha.tenant.organizationId}/confirmation.pdf`,
      sourceName: 'confirmation.pdf',
      contentType: 'application/pdf',
      format: 'document',
    })
  })

  /**
   * The format decides which reader runs, so it is derived from the name the upload stored and
   * never from anything a request carries. A `.ics` reported as a PDF is still read as a calendar.
   */
  it('reads the format from the stored filename and not from the reported media type', async () => {
    const queue = queueDouble()
    const file = await recordFile(alpha.tenant.scope, {
      tripId: alpha.tripId,
      storageKey: `files/${alpha.tenant.organizationId}/booking.ics`,
      filename: 'booking.ics',
      contentType: 'application/pdf',
      sizeBytes: 1_024,
    })

    await startBookingImport(alpha.tenant.scope, queue, {
      tripId: alpha.tripId,
      fileId: file.id,
      index: 0,
    })

    expect(queue.sent[0]?.body.payload).toMatchObject({ format: 'ics' })
  })

  it('staggers the files of one drop by the extraction budget', async () => {
    const queue = queueDouble()

    await startBookingImport(alpha.tenant.scope, queue, {
      tripId: alpha.tripId,
      fileId: alpha.fileId,
      index: 3,
    })

    expect(queue.sent[0]?.options).toEqual({ delaySeconds: 60 })
  })

  /**
   * The stagger has one owner: the answer hands the client the delay the task was enqueued with, so
   * the client's stall budget starts when the job does without restating the rule.
   */
  it('answers with the delay each file was enqueued with', async () => {
    const queue = queueDouble()

    const first = await startBookingImport(alpha.tenant.scope, queue, {
      tripId: alpha.tripId,
      fileId: alpha.fileId,
      index: 0,
    })
    const fourth = await startBookingImport(alpha.tenant.scope, queue, {
      tripId: alpha.tripId,
      fileId: alpha.fileId,
      index: 3,
    })

    expect(first.delaySeconds).toBe(0)
    expect(fourth.delaySeconds).toBe(60)
    expect(fourth.delaySeconds).toBe(queue.sent[1]?.options?.delaySeconds)
  })

  it('refuses a stored file no reader can read, and enqueues nothing', async () => {
    const queue = queueDouble()
    const file = await recordFile(alpha.tenant.scope, {
      tripId: alpha.tripId,
      storageKey: `files/${alpha.tenant.organizationId}/voucher.pkpass`,
      filename: 'voucher.pkpass',
      contentType: 'application/vnd.apple.pkpass',
      sizeBytes: 2_048,
    })

    expect(
      await captureError(() =>
        startBookingImport(alpha.tenant.scope, queue, {
          tripId: alpha.tripId,
          fileId: file.id,
          index: 0,
        }),
      ),
    ).toBeInstanceOf(ImportFormatError)
    expect(queue.sent).toEqual([])
  })

  it('refuses another workspace’s file, and enqueues nothing', async () => {
    const queue = queueDouble()

    expect(
      await captureError(() =>
        startBookingImport(alpha.tenant.scope, queue, {
          tripId: alpha.tripId,
          fileId: beta.fileId,
          index: 0,
        }),
      ),
    ).toBeInstanceOf(NotFoundError)
    expect(queue.sent).toEqual([])
  })

  it('refuses a file of this workspace that belongs to another trip', async () => {
    const queue = queueDouble()
    const other = await createTrip(alpha.tenant.scope, { title: 'Lisbon' })

    expect(
      await captureError(() =>
        startBookingImport(alpha.tenant.scope, queue, {
          tripId: other.id,
          fileId: alpha.fileId,
          index: 0,
        }),
      ),
    ).toBeInstanceOf(NotFoundError)
    expect(queue.sent).toEqual([])
  })

  it('accepts a request that names no position in the drop', () => {
    expect(
      startBookingImportInputSchema.parse({
        tripId: alpha.tripId,
        fileId: alpha.fileId,
      }).index,
    ).toBe(0)
  })

  /*
   * The reading is paid for at the enqueue, so the role is asked for at the enqueue.
   *
   * A `viewer` passes `requireTrip` — that is what a viewer is — and used to reach the queue on
   * that alone. Everything after it is spend: the handler takes an `extraction_calls_per_month`
   * unit and hands the document to Workers AI, and nothing between here and there asks again. The
   * refusal at `confirmBookingImport` is real but far too late; a viewer could drain a workspace's
   * whole monthly allowance a file at a time and only then be told they may not keep the rows.
   */
  it('refuses a trip viewer before the reading is paid for, and enqueues nothing', async () => {
    const queue = queueDouble()
    const viewerId = await alpha.tenant.addUser('viewer')
    await addTripMember(alpha.tenant.scope, {
      tripId: alpha.tripId,
      userId: viewerId,
      role: 'viewer',
    })
    const viewer = alpha.tenant.scopeFor(viewerId)

    // The trip is theirs to read: the refusal below is about writing, not about reach.
    expect((await requireTrip(viewer, alpha.tripId)).id).toBe(alpha.tripId)

    const error = await captureError(() =>
      startBookingImport(viewer, queue, {
        tripId: alpha.tripId,
        fileId: alpha.fileId,
        index: 0,
      }),
    )

    expect(error).toBeInstanceOf(TripRoleError)
    expect((error as RepositoryError).code).toBe('FORBIDDEN')
    expect(queue.sent).toEqual([])
  })

  it('lets a trip editor start one, so the refusal is about the role and nothing else', async () => {
    const queue = queueDouble()
    const editorId = await alpha.tenant.addUser('editor')
    await addTripMember(alpha.tenant.scope, {
      tripId: alpha.tripId,
      userId: editorId,
      role: 'editor',
    })

    await startBookingImport(alpha.tenant.scopeFor(editorId), queue, {
      tripId: alpha.tripId,
      fileId: alpha.fileId,
      index: 0,
    })

    expect(queue.sent).toHaveLength(1)
  })
})

/* ---------------------------------------------------------------------- get */

describe('bookingImportView', () => {
  it('answers `working` while nothing is staged', async () => {
    expect(
      await bookingImportView(alpha.tenant.scope, store, {
        tripId: alpha.tripId,
        jobId: alpha.jobId,
      }),
    ).toEqual({ status: 'working' })
  })

  /**
   * The case a KV key being guessable makes real: the entry resolves, and the answer is the same
   * one a caller gets for a job that does not exist. Telling the two apart would make a job id a
   * probe for another workspace's imports.
   */
  it('answers `working` for a record staged by another workspace, though the key resolves', async () => {
    const staged = await stage(beta)
    expect(store.entries.has(stagedImportKey(staged.jobId))).toBe(true)

    expect(
      await bookingImportView(alpha.tenant.scope, store, {
        tripId: alpha.tripId,
        jobId: staged.jobId,
      }),
    ).toEqual({ status: 'working' })
  })

  it('answers `working` for a record of this workspace staged against another trip', async () => {
    const other = await createTrip(alpha.tenant.scope, { title: 'Lisbon' })
    const staged = await stage(alpha, { tripId: other.id })

    expect(
      await bookingImportView(alpha.tenant.scope, store, {
        tripId: alpha.tripId,
        jobId: staged.jobId,
      }),
    ).toEqual({ status: 'working' })
  })

  it('answers `working` for a record written in a shape it cannot read', async () => {
    await store.put(stagedImportKey(alpha.jobId), '{"jobId":"only that"}')

    expect(
      await bookingImportView(alpha.tenant.scope, store, {
        tripId: alpha.tripId,
        jobId: alpha.jobId,
      }),
    ).toEqual({ status: 'working' })
  })

  it('answers a refusal as a code and a ceiling, and forwards no server sentence', async () => {
    await stage(alpha, {
      reservations: [],
      count: 0,
      refusal: { code: 'ceiling', ceiling: 100 },
    })

    const view = await bookingImportView(alpha.tenant.scope, store, {
      tripId: alpha.tripId,
      jobId: alpha.jobId,
    })

    expect(view).toEqual({
      status: 'refused',
      refusal: { code: 'ceiling', ceiling: 100 },
    })
    expect(JSON.stringify(view)).not.toContain('message')
  })

  it('maps a staged row to the booking the confirm would write, in the trip’s zone', async () => {
    await stage(alpha, {
      reservations: [
        stagedRow({ priceMinor: 42_000, currency: 'EUR' }),
        stagedRow({
          title: 'Dinner',
          kind: 'activity',
          startsAt: '2026-03-05T19:30:00',
          endsAt: null,
          floating: true,
          needsReview: true,
        }),
      ],
    })

    const view = await bookingImportView(alpha.tenant.scope, store, {
      tripId: alpha.tripId,
      jobId: alpha.jobId,
    })

    expect(view.status).toBe('ready')
    expect(view.staged?.count).toBe(2)
    expect(view.staged?.written).toEqual([])
    // 14:00 UTC is 23:00 in Tokyo, which is the trip's zone and not the runtime's.
    expect(view.staged?.drafts[0]).toEqual({
      index: 0,
      type: 'accommodation',
      title: 'Hotel Roma',
      location: 'Via del Corso 1, Rome',
      reference: 'ABC123',
      startDate: '2026-03-04',
      startTime: '23:00',
      endDate: '2026-03-07',
      endTime: '19:00',
      priceMinor: 42_000,
      currency: 'EUR',
      needsReview: false,
    })
    // A floating source already states the destination's wall clock, so it is not moved at all.
    expect(view.staged?.drafts[1]).toMatchObject({
      index: 1,
      type: 'activity',
      startDate: '2026-03-05',
      startTime: '19:30',
      priceMinor: null,
      currency: null,
      needsReview: true,
    })
  })

  it('offers only the rows a previous confirm did not write', async () => {
    await stage(alpha, {
      reservations: [stagedRow(), stagedRow({ title: 'Dinner' })],
      written: [{ index: 0, reservationId: 'res_written' }],
    })

    const view = await bookingImportView(alpha.tenant.scope, store, {
      tripId: alpha.tripId,
      jobId: alpha.jobId,
    })

    expect(view.staged?.written).toEqual([0])
  })
})

/* ------------------------------------------------------------------ confirm */

describe('confirmBookingImport', () => {
  /** Count separate marker updates; imported bookings must already be marked at insertion. */
  function markerStatements(): number {
    return harness.statements.filter((sql) =>
      /update "reservations" set "imported_at"/.test(sql),
    ).length
  }

  it.each([7, 101])(
    'creates all %i accepted rows already marked and deletes the record',
    async (size) => {
      const rows = Array.from({ length: size }, (_unused, index) =>
        stagedRow({ title: `Booking ${index}`, kind: 'activity' }),
      )
      await stage(alpha, { reservations: rows })
      harness.statements.length = 0
      const result = await confirmBookingImport(
        alpha.tenant.scope,
        store,
        {
          tripId: alpha.tripId,
          jobId: alpha.jobId,
          accept: rows.map((_row, index) => index),
        },
        ports,
      )

      expect(result).toEqual({ written: size, failed: 0, remaining: 0 })
      const written = await listTripReservations(alpha.tenant.scope, {
        tripId: alpha.tripId,
      })
      expect(written).toHaveLength(size)
      expect(markerStatements()).toBe(0)
      // ADR 0012's load-bearing consequence: every row a machine wrote says so.
      expect(written.every((row) => row.importedAt instanceof Date)).toBe(true)
      expect(
        new Set(written.map((row) => row.importedAt?.getTime())).size,
      ).toBe(1)
      expect(store.entries.has(stagedImportKey(alpha.jobId))).toBe(false)
      // One patch for the batch, not one per row.
      expect(stubs.mirrored).toHaveLength(1)
    },
  )

  it('names an untitled row from the catalogue, in the workspace’s language', async () => {
    // `titleSchema` is `min(1)`, so an untitled row has to be named by somebody. Naming it in the
    // extraction would have written English into a Polish workspace's data — the confirm is the
    // first place in the chain that has a workspace to ask.
    await updateOrganizationSettings(alpha.tenant.scope, { locale: 'pl' })
    await stage(alpha, { reservations: [stagedRow({ title: '' })] })

    await confirmBookingImport(
      alpha.tenant.scope,
      store,
      { tripId: alpha.tripId, jobId: alpha.jobId, accept: [0] },
      ports,
    )

    const [written] = await listTripReservations(alpha.tenant.scope, {
      tripId: alpha.tripId,
    })
    expect(written.title).toBe('Rezerwacja bez nazwy')
  })

  it('links the confirmed booking to the file the import came from', async () => {
    await stage(alpha)

    await confirmBookingImport(
      alpha.tenant.scope,
      store,
      {
        tripId: alpha.tripId,
        jobId: alpha.jobId,
        accept: [0],
      },
      ports,
    )

    const [written] = await listTripReservations(alpha.tenant.scope, {
      tripId: alpha.tripId,
    })
    expect(
      (await getFile(alpha.tenant.scope, alpha.fileId))?.reservationId,
    ).toBe(written.id)
  })

  /**
   * The partial confirm, which is the whole reason `written` exists. The failing row carries a
   * staged currency the column refuses — the shape a record written by an older build can have —
   * and what matters is what survives it: three bookings, three entries in `written`, and a retry
   * that writes the four that are left and never a fourth copy of the first three.
   *
   * Not an empty title, which is what this used to use: an untitled row is a shape the extraction
   * writes on purpose now, and the confirm names it from the catalogue rather than refusing it.
   */
  it('steps over the row it cannot write, and the retry writes only the rest', async () => {
    const rows = [
      stagedRow({ title: 'One', kind: 'activity' }),
      stagedRow({ title: 'Two', kind: 'activity' }),
      stagedRow({ title: 'Three', kind: 'activity' }),
      stagedRow({
        title: 'Four',
        kind: 'activity',
        priceMinor: 1_000,
        currency: 'EURO',
      }),
      stagedRow({ title: 'Five', kind: 'activity' }),
      stagedRow({ title: 'Six', kind: 'activity' }),
      stagedRow({ title: 'Seven', kind: 'activity' }),
    ]
    await stage(alpha, { reservations: rows })
    const accept = [0, 1, 2, 3, 4, 5, 6]

    const first = await confirmBookingImport(
      alpha.tenant.scope,
      store,
      {
        tripId: alpha.tripId,
        jobId: alpha.jobId,
        accept,
      },
      ports,
    )

    // Six of seven on the first pass: the unwritable row costs itself and nothing behind it.
    expect(first).toEqual({ written: 6, failed: 1, remaining: 1 })
    const held = store.entries.get(stagedImportKey(alpha.jobId))
    expect(held).toBeDefined()
    expect(JSON.parse(held ?? '{}')).toMatchObject({
      written: [0, 1, 2, 4, 5, 6].map((index) => ({ index })),
    })

    const beforeRetry = await listTripReservations(alpha.tenant.scope, {
      tripId: alpha.tripId,
    })
    expect(beforeRetry.every((row) => row.importedAt instanceof Date)).toBe(
      true,
    )
    harness.statements.length = 0
    // The retry, with the same request the client already sent.
    rows[3] = stagedRow({ title: 'Four', kind: 'activity' })
    await stage(alpha, {
      reservations: rows,
      written: JSON.parse(held ?? '{}').written,
    })
    const second = await confirmBookingImport(
      alpha.tenant.scope,
      store,
      {
        tripId: alpha.tripId,
        jobId: alpha.jobId,
        accept,
      },
      ports,
    )

    expect(second).toEqual({ written: 1, failed: 0, remaining: 0 })
    const titles = (
      await listTripReservations(alpha.tenant.scope, { tripId: alpha.tripId })
    ).map((row) => row.title)
    expect(titles).toHaveLength(7)
    expect(new Set(titles).size).toBe(7)
    const afterRetry = await listTripReservations(alpha.tenant.scope, {
      tripId: alpha.tripId,
    })
    expect(afterRetry.every((row) => row.importedAt instanceof Date)).toBe(true)
    for (const previous of beforeRetry) {
      expect(afterRetry.find((row) => row.id === previous.id)).toEqual(previous)
    }
    expect(markerStatements()).toBe(0)
  })

  /*
   * The case that made stepping over necessary rather than merely tidier.
   *
   * `2026-02-30` is ordinary model output, not a contrived value: staging shape-checks the date
   * against `YYYY-MM-DD` and nothing else, and `dateSchema`'s calendar check refuses it at write
   * time — the same way, every time. While the confirm stopped at the first row it could not
   * write, that row was also the lowest pending index on every retry, so rows 1 and 2 here were
   * unreachable no matter how often the reader pressed "Add the rest".
   */
  it('never lets a row that always fails block the rows behind it', async () => {
    await stage(alpha, {
      reservations: [
        stagedRow({
          title: 'Impossible',
          kind: 'activity',
          startsAt: '2026-02-30',
          endsAt: null,
        }),
        stagedRow({ title: 'Second', kind: 'activity' }),
        stagedRow({ title: 'Third', kind: 'activity' }),
      ],
    })
    const request = {
      tripId: alpha.tripId,
      jobId: alpha.jobId,
      accept: [0, 1, 2],
    }

    const first = await confirmBookingImport(
      alpha.tenant.scope,
      store,
      request,
      ports,
    )

    expect(first).toEqual({ written: 2, failed: 1, remaining: 1 })
    expect(
      (await listTripReservations(alpha.tenant.scope, { tripId: alpha.tripId }))
        .map((row) => row.title)
        .sort(),
    ).toEqual(['Second', 'Third'])

    // The retry the partial alert offers. It writes nothing new and — the point — loses nothing
    // either: the record still holds the two that went in, so the reader is left looking at the
    // one row that is genuinely still failing.
    const second = await confirmBookingImport(
      alpha.tenant.scope,
      store,
      request,
      ports,
    )

    expect(second).toEqual({ written: 0, failed: 1, remaining: 1 })
    expect(
      await listTripReservations(alpha.tenant.scope, { tripId: alpha.tripId }),
    ).toHaveLength(2)
    expect(
      JSON.parse(store.entries.get(stagedImportKey(alpha.jobId)) ?? '{}'),
    ).toMatchObject({ written: [{ index: 1 }, { index: 2 }] })
  })

  it('writes no price at all for a row whose price the extractor dropped', async () => {
    await stage(alpha, {
      reservations: [stagedRow({ needsReview: true, kind: 'activity' })],
    })

    await confirmBookingImport(
      alpha.tenant.scope,
      store,
      {
        tripId: alpha.tripId,
        jobId: alpha.jobId,
        accept: [0],
      },
      ports,
    )

    const [written] = await listTripReservations(alpha.tenant.scope, {
      tripId: alpha.tripId,
    })
    expect(written.priceMinor).toBeNull()
    expect(written.currency).toBeNull()
  })

  it('pins a place it created for a stay, and points the booking at it', async () => {
    await stage(alpha)

    await confirmBookingImport(
      alpha.tenant.scope,
      store,
      {
        tripId: alpha.tripId,
        jobId: alpha.jobId,
        accept: [0],
      },
      ports,
    )

    const places = await listTripPlaces(alpha.tenant.scope, {
      tripId: alpha.tripId,
    })
    expect(places).toHaveLength(1)
    expect(places[0]).toMatchObject({
      name: 'Hotel Roma',
      lat: stubs.candidate.lat,
      lng: stubs.candidate.lng,
      countryCode: 'IT',
    })
    const [written] = await listTripReservations(alpha.tenant.scope, {
      tripId: alpha.tripId,
    })
    expect(written.placeId).toBe(places[0]?.id)
  })

  it('writes the place without coordinates when the lookup is refused, and still imports', async () => {
    stubs.geocodingConfigured = false
    await stage(alpha)

    const result = await confirmBookingImport(
      alpha.tenant.scope,
      store,
      {
        tripId: alpha.tripId,
        jobId: alpha.jobId,
        accept: [0],
      },
      ports,
    )

    expect(result).toEqual({ written: 1, failed: 0, remaining: 0 })
    const [place] = await listTripPlaces(alpha.tenant.scope, {
      tripId: alpha.tripId,
    })
    expect(place).toMatchObject({ name: 'Hotel Roma', lat: null, lng: null })
  })

  it('creates no second place when the trip already holds one of that name', async () => {
    const existing = await createPlace(alpha.tenant.scope, {
      tripId: alpha.tripId,
      name: 'Hotel Roma',
    })
    await stage(alpha, { reservations: [stagedRow(), stagedRow()] })

    await confirmBookingImport(
      alpha.tenant.scope,
      store,
      {
        tripId: alpha.tripId,
        jobId: alpha.jobId,
        accept: [0, 1],
      },
      ports,
    )

    expect(await countTripPlaces(alpha.tenant.scope, alpha.tripId)).toBe(1)
    const written = await listTripReservations(alpha.tenant.scope, {
      tripId: alpha.tripId,
    })
    expect(written.map((row) => row.placeId)).toEqual([
      existing.id,
      existing.id,
    ])
    // The place the reader already had is not re-pinned behind their back.
    expect((await getPlace(alpha.tenant.scope, existing.id))?.lat).toBeNull()
  })

  it('writes nothing twice when the same confirm arrives again', async () => {
    await stage(alpha, {
      reservations: [stagedRow({ kind: 'activity' })],
      written: [{ index: 0, reservationId: 'res_already' }],
    })

    const result = await confirmBookingImport(
      alpha.tenant.scope,
      store,
      {
        tripId: alpha.tripId,
        jobId: alpha.jobId,
        accept: [0],
      },
      ports,
    )

    expect(result).toEqual({ written: 0, failed: 0, remaining: 0 })
    expect(
      await listTripReservations(alpha.tenant.scope, { tripId: alpha.tripId }),
    ).toEqual([])
    expect(stubs.mirrored).toEqual([])
  })

  /*
   * The confirm creates a place and pins it through the geocoder before the reservation write, and
   * only that write asks the trip role; its refusal is caught per row, so a viewer used to see a
   * result with failed rows after the places quota and the geocoding allowance were spent.
   */
  it('refuses a trip viewer before any place is created or the geocoder is called', async () => {
    const staged = await stage(alpha, {
      reservations: [stagedRow({ kind: 'lodging' })],
    })
    const viewerId = await alpha.tenant.addUser('viewer')
    await addTripMember(alpha.tenant.scope, {
      tripId: alpha.tripId,
      userId: viewerId,
      role: 'viewer',
    })
    const viewer = alpha.tenant.scopeFor(viewerId)
    const placesBefore = await countTripPlaces(alpha.tenant.scope, alpha.tripId)

    const error = await captureError(() =>
      confirmBookingImport(
        viewer,
        store,
        { tripId: alpha.tripId, jobId: alpha.jobId, accept: [0] },
        ports,
      ),
    )

    expect(error).toBeInstanceOf(TripRoleError)
    expect((error as RepositoryError).code).toBe('FORBIDDEN')
    expect(await countTripPlaces(alpha.tenant.scope, alpha.tripId)).toBe(
      placesBefore,
    )
    expect(stubs.vendorCalls).toBe(0)
    expect(
      await listTripReservations(alpha.tenant.scope, { tripId: alpha.tripId }),
    ).toEqual([])
    expect(store.entries.get(stagedImportKey(alpha.jobId))).toBe(
      JSON.stringify(staged),
    )
    expect(stubs.mirrored).toEqual([])
  })

  it('lets a trip editor confirm the same import, so the refusal is about the role only', async () => {
    await stage(alpha, { reservations: [stagedRow({ kind: 'lodging' })] })
    const editorId = await alpha.tenant.addUser('editor')
    await addTripMember(alpha.tenant.scope, {
      tripId: alpha.tripId,
      userId: editorId,
      role: 'editor',
    })

    const result = await confirmBookingImport(
      alpha.tenant.scopeFor(editorId),
      store,
      { tripId: alpha.tripId, jobId: alpha.jobId, accept: [0] },
      ports,
    )

    expect(result).toEqual({ written: 1, failed: 0, remaining: 0 })
    expect(await countTripPlaces(alpha.tenant.scope, alpha.tripId)).toBe(1)
    expect(stubs.vendorCalls).toBe(1)
    // `settle` logs a refused link instead of throwing, so only the row shows the editor's write held.
    const [written] = await listTripReservations(alpha.tenant.scope, {
      tripId: alpha.tripId,
    })
    expect(
      (await getFile(alpha.tenant.scope, alpha.fileId))?.reservationId,
    ).toBe(written.id)
  })

  it('answers not found, not a role refusal, to a user who cannot see the trip', async () => {
    await stage(alpha, { reservations: [stagedRow({ kind: 'lodging' })] })

    const error = await captureError(() =>
      confirmBookingImport(
        beta.tenant.scope,
        store,
        { tripId: alpha.tripId, jobId: alpha.jobId, accept: [0] },
        ports,
      ),
    )

    expect(error).toBeInstanceOf(NotFoundError)
    expect(stubs.vendorCalls).toBe(0)
  })

  it('refuses a job id staged by another workspace, and writes nothing', async () => {
    const staged = await stage(beta)
    const before = await listTripReservations(beta.tenant.scope, {
      tripId: beta.tripId,
    })

    expect(
      await captureError(() =>
        confirmBookingImport(
          alpha.tenant.scope,
          store,
          {
            tripId: alpha.tripId,
            jobId: staged.jobId,
            accept: [0],
          },
          ports,
        ),
      ),
    ).toBeInstanceOf(NotFoundError)

    expect(
      await listTripReservations(alpha.tenant.scope, { tripId: alpha.tripId }),
    ).toEqual([])
    expect(
      await listTripReservations(beta.tenant.scope, { tripId: beta.tripId }),
    ).toEqual(before)
    // And the record it could not claim is still there for the workspace that owns it.
    expect(store.entries.has(stagedImportKey(staged.jobId))).toBe(true)
  })

  it('ignores an index the staged record does not hold', async () => {
    await stage(alpha, { reservations: [stagedRow({ kind: 'activity' })] })

    const result = await confirmBookingImport(
      alpha.tenant.scope,
      store,
      {
        tripId: alpha.tripId,
        jobId: alpha.jobId,
        accept: [0, 0, 41],
      },
      ports,
    )

    expect(result).toEqual({ written: 1, failed: 0, remaining: 0 })
    expect(
      await listTripReservations(alpha.tenant.scope, { tripId: alpha.tripId }),
    ).toHaveLength(1)
  })

  it('keeps the record when a confirm accepts nothing, so no row is silently dropped', async () => {
    const staged = await stage(alpha, {
      reservations: [stagedRow({ kind: 'activity' }), stagedRow()],
    })

    const result = await confirmBookingImport(
      alpha.tenant.scope,
      store,
      { tripId: alpha.tripId, jobId: alpha.jobId, accept: [] },
      ports,
    )

    expect(result).toEqual({ written: 0, failed: 0, remaining: 0 })
    // Two rows nobody has decided about are still reviewable: "nothing outstanding" is not the
    // same claim as "everything written", and only the second one may delete the record.
    expect(store.entries.has(stagedImportKey(staged.jobId))).toBe(true)
    expect(
      await listTripReservations(alpha.tenant.scope, { tripId: alpha.tripId }),
    ).toEqual([])
  })

  it('refuses a request naming more rows than a record can hold', () => {
    expect(() =>
      confirmBookingImportInputSchema.parse({
        tripId: alpha.tripId,
        jobId: alpha.jobId,
        accept: [500],
      }),
    ).toThrow()
  })

  it('writes a booking of every kind a confirm can be handed', async () => {
    await stage(alpha, {
      reservations: [
        stagedRow({ kind: 'flight', title: 'LH123' }),
        stagedRow({ kind: 'transport', title: 'Rome Termini' }),
        stagedRow({ kind: 'activity', title: 'Borghese' }),
        stagedRow({ kind: 'other', title: 'Something else' }),
      ],
    })

    await confirmBookingImport(
      alpha.tenant.scope,
      store,
      {
        tripId: alpha.tripId,
        jobId: alpha.jobId,
        accept: [0, 1, 2, 3],
      },
      ports,
    )

    const written = await listTripReservations(alpha.tenant.scope, {
      tripId: alpha.tripId,
    })
    expect(written.map((row) => row.type).sort()).toEqual([
      'activity',
      'other',
      'transport',
      'transport',
    ])
    // Only a stay reaches the map; nothing else invents a place.
    expect(await countTripPlaces(alpha.tenant.scope, alpha.tripId)).toBe(0)
  })

  it('records the booking’s price as a cost line on the trip', async () => {
    await stage(alpha, {
      reservations: [
        stagedRow({ kind: 'activity', priceMinor: 42_000, currency: 'EUR' }),
      ],
    })

    await confirmBookingImport(
      alpha.tenant.scope,
      store,
      {
        tripId: alpha.tripId,
        jobId: alpha.jobId,
        accept: [0],
      },
      ports,
    )

    const [written] = await listTripReservations(alpha.tenant.scope, {
      tripId: alpha.tripId,
    })
    expect(written.priceMinor).toBe(42_000)
    expect(written.expenseId).not.toBeNull()
    expect(await getReservation(alpha.tenant.scope, written.id)).not.toBeNull()
  })
})

describe('confirmBookingImport — the stay an accommodation row becomes', () => {
  let warn: MockInstance<typeof console.warn>

  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    warn.mockRestore()
  })

  /** The stay warnings the confirm logged, by message, in order. */
  function stayWarnings(): ReadonlyArray<string> {
    return warn.mock.calls
      .map(([line]) => String(line))
      .flatMap((line) =>
        [
          'booking import stay range not resolved',
          'booking import stay not written',
        ].filter((message) => line.includes(`"${message}"`)),
      )
  }

  async function confirmFirst(world: World) {
    return confirmBookingImport(
      world.tenant.scope,
      store,
      { tripId: world.tripId, jobId: world.jobId, accept: [0] },
      ports,
    )
  }

  /** The booking a confirm wrote was kept, marked, and is no longer offered for another try. */
  async function expectBookingKeptForReview(world: World) {
    const bookings = await listTripReservations(world.tenant.scope, {
      tripId: world.tripId,
    })
    expect(bookings).toHaveLength(1)
    expect(bookings[0].importedAt).toBeInstanceOf(Date)
    expect(store.entries.has(stagedImportKey(world.jobId))).toBe(false)
  }

  it('writes the run of nights beside the booking, linked to it, in the trip’s zone', async () => {
    // 14:00Z on the 4th is 23:00 in Tokyo; 10:00Z on the 7th is 19:00.
    await stage(alpha)

    const result = await confirmFirst(alpha)

    expect(result).toEqual({ written: 1, failed: 0, remaining: 0 })
    const [booking] = await listTripReservations(alpha.tenant.scope, {
      tripId: alpha.tripId,
    })
    const days = await listTripDays(alpha.tenant.scope, alpha.tripId)
    const dayOn = (date: string) => days.find((day) => day.date === date)?.id
    const stays = await listTripAccommodations(alpha.tenant.scope, alpha.tripId)
    expect(stays).toHaveLength(1)
    expect(stayWarnings()).toEqual([])
    expect(stays[0]).toMatchObject({
      startDayId: dayOn('2026-03-04'),
      endDayId: dayOn('2026-03-07'),
      name: 'Hotel Roma',
      address: 'Via del Corso 1, Rome',
      checkInTime: '23:00',
      checkOutTime: '19:00',
      reservationId: booking.id,
    })
  })

  it('writes no stay for a booking that is not one', async () => {
    await stage(alpha, { reservations: [stagedRow({ kind: 'activity' })] })

    await confirmFirst(alpha)

    expect(
      await listTripAccommodations(alpha.tenant.scope, alpha.tripId),
    ).toEqual([])
  })

  it.each([
    {
      range: 'lies outside the trip',
      startsAt: '2026-04-01T01:00:00Z',
      endsAt: '2026-04-03T01:00:00Z',
    },
    {
      range: 'ends after the trip does',
      startsAt: '2026-03-09T01:00:00Z',
      endsAt: '2026-03-12T01:00:00Z',
    },
    {
      range: 'ends before it starts',
      startsAt: '2026-03-07T01:00:00Z',
      endsAt: '2026-03-04T01:00:00Z',
    },
  ])(
    'keeps the booking for review and invents no stay when the range $range',
    async ({ startsAt, endsAt }) => {
      await stage(alpha, { reservations: [stagedRow({ startsAt, endsAt })] })

      const result = await confirmFirst(alpha)

      expect(result).toEqual({ written: 1, failed: 0, remaining: 0 })
      await expectBookingKeptForReview(alpha)
      expect(
        await listTripAccommodations(alpha.tenant.scope, alpha.tripId),
      ).toEqual([])
      // Told apart from a refused write, which is a different thing to go and look at.
      expect(stayWarnings()).toEqual(['booking import stay range not resolved'])
    },
  )

  it('keeps the booking for review when the stay write is refused, and never writes it twice', async () => {
    stubs.failStayWrite = true
    await stage(alpha)

    const result = await confirmFirst(alpha)

    expect(result).toEqual({ written: 1, failed: 0, remaining: 0 })
    await expectBookingKeptForReview(alpha)
    expect(
      await listTripAccommodations(alpha.tenant.scope, alpha.tripId),
    ).toEqual([])
    expect(stayWarnings()).toEqual(['booking import stay not written'])
  })
})
