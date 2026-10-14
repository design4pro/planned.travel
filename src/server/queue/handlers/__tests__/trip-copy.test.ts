/**
 * The `trip-copy` handler, driven the way the consumer drives it.
 *
 * Everything below the handler is real: a fully migrated SQLite database from the Drizzle schema, a
 * real tenant, the real repositories and the real copy. The two seams that are not real are the D1
 * handle — the handler is built through {@link createTripCopyHandler} over the harness's database,
 * which is the seam that exists so a copy can be exercised outside a Worker at all — and the
 * bindings, which are fakes that record what the handler asked them to do.
 *
 * The properties under test are the ones the pass list alone does not give: that the stamp is the
 * **last** write, that a redelivery costs a second copy and never a second inbox row, and that only
 * the three failures which cannot succeed on retry take the target down with them.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  NotFoundError,
  QuotaExceededError,
  createAssignment,
  createDayNote,
  createExpense,
  createPlace,
  createTag,
  createTrip,
  deleteTrip,
  getMembership,
  getTrip,
  listForEntity,
  listTripDays,
  removeMember,
  setPlaceTags,
  startTripCopy,
  tripsRepository,
  updateTrip,
  upsertSubscription,
} from '#/server/repos'
import {
  createHarness,
  subscribeTenant,
} from '#/server/repos/__tests__/harness'
import { createLogger, createMemorySink } from '#/server/observability/logger'
import {
  TRIP_COPIED_KEY,
  TRIP_COPY_FAILED_KEY,
  coverKeyFor,
  createTripCopyHandler,
  tripCopyTaskId,
} from '../trip-copy'
import { TaskConfigurationError, TaskPermanentError } from '../../types'

import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { Trip } from '#/server/db/types'
import type { TaskBindings, TaskContext, TaskMetrics } from '../../types'

/* -------------------------------------------------------------------- setup */

const NOW = Date.parse('2026-09-09T09:00:00.000Z')

interface FakeObject {
  readonly body: string
  readonly contentType?: string
}

/** An R2 stand-in that keeps bodies, so a copy can be proved to be a *second* object. */
function fakeFiles(seed: Record<string, FakeObject> = {}) {
  const objects = new Map<string, FakeObject>(Object.entries(seed))
  return {
    objects,
    get: async (key: string) => {
      const object = objects.get(key)
      if (object === undefined) {
        return null
      }
      return {
        body: new Response(object.body).body as ReadableStream,
        size: object.body.length,
        ...(object.contentType === undefined
          ? {}
          : { httpMetadata: { contentType: object.contentType } }),
      }
    },
    put: async (
      key: string,
      value: ReadableStream | ArrayBuffer | string,
      options?: { httpMetadata?: { contentType?: string } },
    ) => {
      const body =
        typeof value === 'string'
          ? value
          : await new Response(value as BodyInit).text()
      const contentType = options?.httpMetadata?.contentType
      objects.set(
        key,
        contentType === undefined ? { body } : { body, contentType },
      )
      return undefined
    },
    head: async () => null,
    delete: async () => undefined,
    list: async () => ({ objects: [], truncated: false }),
  }
}

/** A queue stand-in that keeps every batch, so the statistics fan-out is observable. */
function fakeTasks() {
  const batches: Array<Array<{ body: unknown }>> = []
  return {
    batches,
    send: async () => undefined,
    sendBatch: async (messages: Array<{ body: unknown }>) => {
      batches.push(messages)
      return undefined
    },
  }
}

/**
 * The binding surface, with the two fakes the assertions read back kept at their own types rather
 * than widened to the port — which is why the bucket and the queue are parameters instead of a
 * `Partial<TaskBindings>` spread.
 */
const APP_URL = 'https://planned.travel'

function fakeEnv(
  files: ReturnType<typeof fakeFiles> = fakeFiles(),
  options: { readonly withoutDb?: boolean } = {},
) {
  return {
    KV: {
      get: async () => null,
      put: async () => undefined,
      delete: async () => undefined,
      list: async () => ({ keys: [], list_complete: true }),
    },
    FILES: files,
    APP_URL: APP_URL as string | undefined,
    TASKS: fakeTasks(),
    // Present but never dereferenced: the handler builds its Drizzle handle through the injected
    // seam, so only the guard reads this. Its absence is the deployment defect that guard exists for.
    ...(options.withoutDb === true ? {} : { DB: {} as TaskBindings['DB'] }),
  }
}

function context(orgId: string, env: TaskBindings = fakeEnv()): TaskContext {
  return {
    env,
    logger: createLogger({ level: 'error', sink: createMemorySink() }),
    now: () => NOW,
    attempt: 1,
    taskId: 'task-under-test',
    orgId,
    // This handler makes no outbound call; a pass-through is the whole of what it needs.
    callProvider: (_label, send) => send(),
  }
}

let harness: Harness
let tenant: SeededTenant

/** The shipped handler, over the harness database rather than a D1 binding. */
function copy(
  payload: {
    sourceTripId: string
    targetTripId: string
    requestedBy: string
  },
  ctx: TaskContext,
): Promise<TaskMetrics> {
  return createTripCopyHandler(() => harness.db)(payload, ctx)
}

beforeEach(async () => {
  harness = await createHarness()
  tenant = await harness.seedTenant('alpha')
  await subscribeTenant(tenant.scope, 'crew', 5)
})

afterEach(() => {
  harness.close()
})

/**
 * A two-day trip carrying one of everything the copy reproduces — a tagged place, an assignment and
 * a note on each day — plus one expense, which is the record and must stay behind.
 */
async function seedSource(): Promise<Trip> {
  const trip = await createTrip(tenant.scope, {
    title: 'Lisbon',
    destination: 'Lisbon, Portugal',
    currency: 'EUR',
    countryCodes: ['PT'],
    startDate: '2026-04-10',
    endDate: '2026-04-11',
  })
  const tag = await createTag(tenant.scope, { name: 'Viewpoint' })

  for (const [index, day] of (
    await listTripDays(tenant.scope, trip.id)
  ).entries()) {
    const place = await createPlace(tenant.scope, {
      tripId: trip.id,
      name: `Miradouro ${index + 1}`,
      city: 'Lisbon',
    })
    await setPlaceTags(tenant.scope, place.id, [tag.id])
    await createAssignment(tenant.scope, {
      tripId: trip.id,
      dayId: day.id,
      placeId: place.id,
    })
    await createDayNote(tenant.scope, {
      tripId: trip.id,
      dayId: day.id,
      body: `Day ${index + 1}: buy the transit pass.`,
    })
  }

  await createExpense(tenant.scope, {
    tripId: trip.id,
    title: 'Transit pass',
    amountMinor: 640,
    spentOn: '2026-04-10',
  })
  return trip
}

/** The synchronous half, exactly as `copyTripFn` runs it. */
async function startCopy(source: Trip): Promise<string> {
  return startTripCopy(tenant.scope, source.id, {
    title: 'Lisbon again',
    startDate: '2026-06-01',
    endDate: '2026-06-02',
  })
}

/* -------------------------------------------------------------------- tests */

describe('handleTripCopy', () => {
  it('copies the inventory, tells the requester and clears the stamp last', async () => {
    const source = await seedSource()
    const targetId = await startCopy(source)
    const env = fakeEnv()

    const metrics = await copy(
      {
        sourceTripId: source.id,
        targetTripId: targetId,
        requestedBy: tenant.ownerUserId,
      },
      context(tenant.organizationId, env),
    )

    expect(metrics).toMatchObject({
      tripId: targetId,
      copied: true,
      days: 2,
      places: 2,
      assignments: 2,
      unscheduled: 0,
      notes: 2,
      droppedNotes: 0,
      notified: true,
    })

    // The stamp is null only because everything above it landed first.
    const target = await getTrip(tenant.scope, targetId)
    expect(target?.copyPendingAt).toBeNull()

    const inbox = await listForEntity(tenant.scope, 'trip', targetId)
    expect(inbox).toHaveLength(1)
    expect(inbox.at(0)).toMatchObject({
      recipientUserId: tenant.ownerUserId,
      titleKey: TRIP_COPIED_KEY,
      bodyKey: TRIP_COPIED_KEY,
    })
    expect(inbox.at(0)?.bodyParams).toMatchObject({ days: 2, places: 2 })

    // The statistics fan-out reached the queue: the all-time row and the trip's own year.
    const kinds = env.TASKS.batches.flat().map((message) => message.body)
    expect(kinds).toHaveLength(2)
  })

  it('acks a redelivery of a finished copy without writing again', async () => {
    const source = await seedSource()
    const targetId = await startCopy(source)
    const payload = {
      sourceTripId: source.id,
      targetTripId: targetId,
      requestedBy: tenant.ownerUserId,
    }
    await copy(payload, context(tenant.organizationId))

    const env = fakeEnv()
    const metrics = await copy(payload, context(tenant.organizationId, env))

    expect(metrics).toEqual({ tripId: targetId, copied: false })
    // Nothing was enqueued and nothing was written: a null stamp means the job is done.
    expect(env.TASKS.batches).toEqual([])
    expect(await listForEntity(tenant.scope, 'trip', targetId)).toHaveLength(1)
    expect((await listTripDays(tenant.scope, targetId)).length).toBe(2)
  })

  it('redelivered after a crash before the clear, copies again and folds the notification', async () => {
    const source = await seedSource()
    const targetId = await startCopy(source)
    const payload = {
      sourceTripId: source.id,
      targetTripId: targetId,
      requestedBy: tenant.ownerUserId,
    }
    await copy(payload, context(tenant.organizationId))

    // The state a worker that died between the notification and the clear leaves behind: the rows
    // and the inbox row are in, and the stamp is still set.
    await tripsRepository.requireUpdate(tenant.scope, targetId, {
      copyPendingAt: new Date(NOW),
    })

    const metrics = await copy(payload, context(tenant.organizationId))

    // The copy is whole — the second attempt cleared what the first wrote and copied from scratch —
    // and the requester is told once, not twice.
    expect(metrics).toMatchObject({ copied: true, places: 2, notified: false })
    expect(await listForEntity(tenant.scope, 'trip', targetId)).toHaveLength(1)
    expect((await getTrip(tenant.scope, targetId))?.copyPendingAt).toBeNull()
  })

  it('is permanent when the requester has left the workspace, and takes the target with it', async () => {
    const source = await createTrip(tenant.scope, {
      title: 'Lisbon',
      visibility: 'organization',
    })
    const leaverId = await tenant.addUser('Leaver')
    const leaver = tenant.scopeFor(leaverId)
    const targetId = await startTripCopy(leaver, source.id, {
      title: 'Lisbon again',
    })

    const membership = await getMembership(tenant.scope, leaverId)
    await removeMember(tenant.scope, membership?.id ?? '')

    await expect(
      copy(
        {
          sourceTripId: source.id,
          targetTripId: targetId,
          requestedBy: leaverId,
        },
        context(tenant.organizationId),
      ),
    ).rejects.toBeInstanceOf(TaskPermanentError)

    // The half-built trip goes with them; an inbox they can no longer reach gets nothing.
    expect(await getTrip(tenant.scope, targetId)).toBeNull()
    expect(await listForEntity(tenant.scope, 'trip', targetId)).toEqual([])
  })

  it('is permanent when the places ceiling moved under it, and says so in the inbox', async () => {
    const source = await seedSource()
    const targetId = await startCopy(source)
    // A concurrent write crossed the ceiling after the copy was admitted. The synchronous half
    // asserted the projection and passed; the per-chunk re-assert is what catches this.
    await upsertSubscription(tenant.scope, { quotaOverrides: { places: 2 } })

    const error = await copy(
      {
        sourceTripId: source.id,
        targetTripId: targetId,
        requestedBy: tenant.ownerUserId,
      },
      context(tenant.organizationId),
    ).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(TaskPermanentError)
    expect((error as Error).cause).toBeInstanceOf(QuotaExceededError)
    expect(await getTrip(tenant.scope, targetId)).toBeNull()
    expect(
      (await listForEntity(tenant.scope, 'trip', targetId)).at(0),
    ).toMatchObject({
      recipientUserId: tenant.ownerUserId,
      titleKey: TRIP_COPY_FAILED_KEY,
    })
  })

  it('is transient for a database failure, and leaves the target where it is', async () => {
    const source = await seedSource()
    const targetId = await startCopy(source)
    // A failure the next attempt can get past, raised where a copy really can meet one: after the
    // places pass has already written rows.
    harness.sqlite.exec('DROP TABLE place_tags')

    const error = await copy(
      {
        sourceTripId: source.id,
        targetTripId: targetId,
        requestedBy: tenant.ownerUserId,
      },
      context(tenant.organizationId),
    ).catch((cause: unknown) => cause)

    expect(error).not.toBeInstanceOf(TaskPermanentError)
    // Still there, still stamped: the queue redelivers and the next attempt starts from clean.
    expect(
      (await getTrip(tenant.scope, targetId))?.copyPendingAt,
    ).not.toBeNull()
  })

  it('is transient when the *target* read fails for a database reason, not permanent', async () => {
    const source = await seedSource()
    const targetId = await startCopy(source)
    // The read of the target sits outside the guarded `try`, and the same policy has to hold for
    // it: only `NotFoundError`/`QuotaExceededError` are permanent. Converting every rejection
    // would dead-letter this without consuming a retry and without clearing `copy_pending_at` —
    // the reader would be left with a trip stuck on "Copying" that nothing ever comes back for.
    harness.sqlite.exec('DROP TABLE trips')

    const error = await copy(
      {
        sourceTripId: source.id,
        targetTripId: targetId,
        requestedBy: tenant.ownerUserId,
      },
      context(tenant.organizationId),
    ).catch((cause: unknown) => cause)

    expect(error).not.toBeInstanceOf(TaskPermanentError)
  })

  it('is permanent when the target is gone, and clears up after it', async () => {
    const source = await seedSource()
    const targetId = await startCopy(source)
    // The reader deleted the half-built copy while the queue still held the job.
    await deleteTrip(tenant.scope, targetId)

    const error = await copy(
      {
        sourceTripId: source.id,
        targetTripId: targetId,
        requestedBy: tenant.ownerUserId,
      },
      context(tenant.organizationId),
    ).catch((cause: unknown) => cause)

    expect(error).toBeInstanceOf(TaskPermanentError)
    expect((error as Error).cause).toBeInstanceOf(NotFoundError)
    expect(await getTrip(tenant.scope, targetId)).toBeNull()
    // No inbox row: the target's title went with it, and a notification naming nothing is worse
    // than none — which is why `discardTarget` is called here with a null title.
    expect(await listForEntity(tenant.scope, 'trip', targetId)).toEqual([])
  })

  it('copies the cover into the target’s own namespace', async () => {
    const source = await seedSource()
    const sourceKey = `trips/${tenant.organizationId}/${source.id}/cover1-lisbon.jpg`
    await updateTrip(tenant.scope, source.id, {
      coverImageKey: sourceKey,
      coverImageUrl: 'https://cdn.example.com/lisbon.jpg',
    })
    const targetId = await startCopy(source)
    const env = fakeEnv(
      fakeFiles({ [sourceKey]: { body: 'jpeg', contentType: 'image/jpeg' } }),
    )

    await copy(
      {
        sourceTripId: source.id,
        targetTripId: targetId,
        requestedBy: tenant.ownerUserId,
      },
      context(tenant.organizationId, env),
    )

    const targetKey = `trips/${tenant.organizationId}/${targetId}/cover1-lisbon.jpg`
    expect(env.FILES.objects.get(targetKey)).toEqual({
      body: 'jpeg',
      contentType: 'image/jpeg',
    })
    // Two objects, because the source's has to survive its own trip being purged.
    expect(env.FILES.objects.size).toBe(2)
    const target = await getTrip(tenant.scope, targetId)
    expect(target?.coverImageKey).toBe(targetKey)
    // The target's own URL on the app origin, never the source's.
    expect(target?.coverImageUrl).toBe(
      `${APP_URL}/api/trips/${targetId}/cover?v=cover1`,
    )
  })

  it('does not copy a cover when the app origin is not configured', async () => {
    const source = await seedSource()
    const sourceKey = `trips/${tenant.organizationId}/${source.id}/cover1-lisbon.jpg`
    await updateTrip(tenant.scope, source.id, {
      coverImageKey: sourceKey,
      coverImageUrl: `${APP_URL}/api/trips/${source.id}/cover?v=cover1`,
    })
    const targetId = await startCopy(source)
    const env = fakeEnv(
      fakeFiles({ [sourceKey]: { body: 'jpeg', contentType: 'image/jpeg' } }),
    )
    delete env.APP_URL

    await copy(
      {
        sourceTripId: source.id,
        targetTripId: targetId,
        requestedBy: tenant.ownerUserId,
      },
      context(tenant.organizationId, env),
    )

    // Nothing moved, and the copy still finished without a cover.
    expect(env.FILES.objects.size).toBe(1)
    const target = await getTrip(tenant.scope, targetId)
    expect(target?.copyPendingAt).toBeNull()
    expect(target?.coverImageKey).toBeNull()
    expect(target?.coverImageUrl).toBeNull()
  })

  it('tolerates a cover that is not there and finishes the copy anyway', async () => {
    const source = await seedSource()
    await updateTrip(tenant.scope, source.id, {
      coverImageKey: `trips/${tenant.organizationId}/${source.id}/cover1-gone.jpg`,
    })
    const targetId = await startCopy(source)

    const metrics = await copy(
      {
        sourceTripId: source.id,
        targetTripId: targetId,
        requestedBy: tenant.ownerUserId,
      },
      context(tenant.organizationId),
    )

    expect(metrics).toMatchObject({ copied: true, places: 2 })
    const target = await getTrip(tenant.scope, targetId)
    expect(target?.copyPendingAt).toBeNull()
    expect(target?.coverImageKey).toBeNull()
  })

  it('refuses to run without the DB binding rather than acking a copy that never happened', async () => {
    const env = fakeEnv(fakeFiles(), { withoutDb: true })

    await expect(
      copy(
        {
          sourceTripId: 'source',
          targetTripId: 'target',
          requestedBy: tenant.ownerUserId,
        },
        context(tenant.organizationId, env),
      ),
    ).rejects.toBeInstanceOf(TaskConfigurationError)
  })
})

describe('the envelope id and the cover key', () => {
  it('names the target, which the producer has just minted', () => {
    expect(tripCopyTaskId('trip-42')).toBe('trip-copy:trip-42')
  })

  it('re-mints a cover key under the target trip and refuses anything else', () => {
    expect(
      coverKeyFor('org-1', 'trip-b', 'trips/org-1/trip-a/f1-cover.jpg'),
    ).toBe('trips/org-1/trip-b/f1-cover.jpg')
    // Another organization's key, and a key with no `<fileId>-<filename>` segment.
    expect(
      coverKeyFor('org-1', 'trip-b', 'trips/org-2/trip-a/f1-cover.jpg'),
    ).toBeNull()
    expect(
      coverKeyFor('org-1', 'trip-b', 'trips/org-1/trip-a/cover.jpg'),
    ).toBeNull()
    expect(coverKeyFor('org-1', 'trip-b', 'cover.jpg')).toBeNull()
  })
})
