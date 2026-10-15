/**
 * The read side of a trip export: the list and the download.
 *
 * Everything but the bucket is real: a migrated SQLite database and the real repositories. The bucket
 * is the shared fake, which stores bodies and upload times, so a real object of another workspace
 * can sit in the very bucket this workspace reads from and the test can say what happens to it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  NotFoundError,
  addTripMember,
  createTrip,
  updateTrip,
} from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'
import { exportObjectKey } from '#/server/storage/export-artifacts'
import { fakeBucket } from '#/server/storage/__tests__/fake-bucket'

import type { FakeBucket } from '#/server/storage/__tests__/fake-bucket'
import type { SeededTenant } from '#/server/repos/__tests__/harness'

/** `./context` imports `cloudflare:workers` at module scope, which plain Node cannot resolve. */
vi.mock('../context', () => ({
  appScope: () => {
    throw new Error('appScope is not reached: this suite hands the scope in.')
  },
  filesBucket: () => {
    throw new Error(
      'filesBucket is not reached: this suite hands the bucket in.',
    )
  },
}))

const {
  downloadTripExport,
  downloadTripExportInputSchema,
  listTripExports,
  listTripExportsInputSchema,
} = await import('../exports')

const NOW = Date.parse('2026-10-15T12:00:00.000Z')
const DAY = 24 * 60 * 60 * 1000

const sandbox = "sandbox; default-src 'none'; style-src 'unsafe-inline'"

function object(body: string, ageMs: number) {
  return { body, uploaded: new Date(NOW - ageMs) }
}

let tenant: SeededTenant
let tripId: string
let bucket: FakeBucket

function key(taskId: string, extension: 'html' | 'pdf', trip = tripId) {
  return exportObjectKey(tenant.organizationId, trip, taskId, extension)
}

beforeEach(async () => {
  const harness = await createHarness()
  tenant = await harness.seedTenant('exports')
  const trip = await createTrip(tenant.scope, {
    title: 'Lisbon in spring',
    visibility: 'private',
  })
  tripId = trip.id
  bucket = fakeBucket({
    [key('task-old', 'html')]: object('<p>old</p>', DAY),
    [key('task-new', 'html')]: object('<p>new</p>', 60_000),
    [key('task-new', 'pdf')]: object('%PDF-new', 60_000),
    // The PDF of an artifact whose page has not arrived yet is not an export.
    [key('task-running', 'pdf')]: object('%PDF-running', 1_000),
    // Past its seven days.
    [key('task-stale', 'html')]: object('<p>stale</p>', 8 * DAY),
  })
})

async function readerOf(role: 'viewer' | 'editor') {
  const userId = await tenant.addUser(`Export ${role}`)
  await addTripMember(tenant.scope, { tripId, userId, role })
  return tenant.scopeFor(userId)
}

describe('listing a trip’s exports', () => {
  it('lists the finished, unexpired exports newest first, preferring the PDF', async () => {
    const answer = await listTripExports(tenant.scope, bucket, { tripId }, NOW)

    expect(answer.artifacts.map((a) => [a.taskId, a.format])).toEqual([
      ['task-new', 'pdf'],
      ['task-old', 'html'],
    ])
    expect(answer.canRequest).toBe(true)
  })

  it('lets a viewer list, and says they cannot request', async () => {
    const viewer = await readerOf('viewer')

    const answer = await listTripExports(viewer, bucket, { tripId }, NOW)

    expect(answer.artifacts).toHaveLength(2)
    expect(answer.canRequest).toBe(false)
  })

  it('lets an editor request', async () => {
    const editor = await readerOf('editor')

    expect(
      (await listTripExports(editor, bucket, { tripId }, NOW)).canRequest,
    ).toBe(true)
  })

  it('lets a workspace member with no trip role read an organization-visible trip, without the request', async () => {
    await updateTrip(tenant.scope, tripId, { visibility: 'organization' })
    const stranger = tenant.scopeFor(await tenant.addUser('On no trip'))

    const answer = await listTripExports(stranger, bucket, { tripId }, NOW)

    expect(answer.artifacts).toHaveLength(2)
    expect(answer.canRequest).toBe(false)
  })

  it('does not list a trip whose id starts with the same characters', async () => {
    const lookalike = `${tripId}2`
    bucket.objects.set(key('task-lookalike', 'html', lookalike), {
      ...object('<p>other trip</p>', 1_000),
    })

    const answer = await listTripExports(tenant.scope, bucket, { tripId }, NOW)

    expect(answer.artifacts.map((a) => a.taskId)).not.toContain(
      'task-lookalike',
    )
  })

  it('answers an unknown trip as not found', async () => {
    await expect(
      listTripExports(tenant.scope, bucket, { tripId: 'no-such-trip' }, NOW),
    ).rejects.toBeInstanceOf(NotFoundError)
  })

  it('reads nothing from the bucket when the trip is not visible', async () => {
    const stranger = tenant.scopeFor(await tenant.addUser('Not on the trip'))

    await expect(
      listTripExports(stranger, bucket, { tripId }, NOW),
    ).rejects.toBeInstanceOf(NotFoundError)
    expect(bucket.listCalls).toEqual([])
  })
})

describe('downloading an export', () => {
  const download = (taskId: string, scope = () => tenant.scope) =>
    downloadTripExport(scope(), bucket, { tripId, taskId }, NOW)

  it('streams the PDF as an attachment with the fixed headers', async () => {
    const response = await download('task-new')

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('%PDF-new')
    expect(response.headers.get('content-type')).toBe('application/pdf')
    expect(response.headers.get('content-length')).toBe('8')
    expect(response.headers.get('cache-control')).toBe('private, no-store')
    expect(response.headers.get('x-content-type-options')).toBe('nosniff')
    expect(response.headers.get('content-disposition')).toBe(
      "attachment; filename*=UTF-8''Lisbon%20in%20spring-2026-10-15.pdf",
    )
    expect(response.headers.get('content-security-policy')).toBeNull()
  })

  it('streams the printable page sandboxed, typed by the extension and not the object', async () => {
    bucket.objects.set(key('task-old', 'html'), {
      ...object('<p>old</p>', DAY),
      contentType: 'application/x-evil',
    })

    const response = await download('task-old')

    expect(response.status).toBe(200)
    expect(await response.text()).toBe('<p>old</p>')
    expect(response.headers.get('content-type')).toBe(
      'text/html; charset=utf-8',
    )
    expect(response.headers.get('content-security-policy')).toBe(sandbox)
    expect(response.headers.get('content-disposition')).toMatch(
      /^attachment; filename\*=UTF-8''.*\.html$/u,
    )
  })

  it('lets a viewer download', async () => {
    const viewer = await readerOf('viewer')

    const response = await download('task-new', () => viewer)

    expect(response.status).toBe(200)
  })

  it.each([
    ['a malformed id', '../task-new'],
    ['an id with a slash', 'a/b'],
    ['an id that never existed', 'task-nope'],
    ['an expired export', 'task-stale'],
    ['an export whose page has not been written', 'task-running'],
  ])('answers %s with the one 404', async (_name, taskId) => {
    const response = await download(taskId)

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: 'missing' })
    expect(response.headers.get('cache-control')).toBe('private, no-store')
  })

  it('answers the 404 when the object is gone between the listing and the read', async () => {
    const racing: FakeBucket = {
      ...bucket,
      get: async (requested) => {
        bucket.objects.delete(requested)
        return bucket.get(requested)
      },
    }

    const response = await downloadTripExport(
      tenant.scope,
      racing,
      { tripId, taskId: 'task-new' },
      NOW,
    )

    expect(response.status).toBe(404)
  })

  it('reads only the key built from the caller’s workspace and the resolved trip', async () => {
    const reads: Array<string> = []
    const watched = {
      ...bucket,
      get: async (requested: string) => {
        reads.push(requested)
        return bucket.get(requested)
      },
    }

    await downloadTripExport(
      tenant.scope,
      watched,
      { tripId, taskId: 'task-new' },
      NOW,
    )

    expect(reads).toEqual([key('task-new', 'pdf')])
  })

  it('refuses a viewer’s neighbour who is not on a private trip before it reads anything', async () => {
    const stranger = tenant.scopeFor(await tenant.addUser('Not on the trip'))

    await expect(download('task-new', () => stranger)).rejects.toBeInstanceOf(
      NotFoundError,
    )
    expect(bucket.listCalls).toEqual([])
  })
})

describe('the input schemas', () => {
  it('refuse a value that names a workspace', () => {
    expect(
      downloadTripExportInputSchema.safeParse({
        tripId,
        taskId: 'task-new',
        organizationId: 'someone-else',
      }).success,
    ).toBe(false)
    expect(
      listTripExportsInputSchema.safeParse({ tripId, organizationId: 'x' })
        .success,
    ).toBe(false)
  })

  it('trim and bound the ids', () => {
    expect(
      downloadTripExportInputSchema.parse({ tripId: ' t ', taskId: ' a ' }),
    ).toEqual({ tripId: 't', taskId: 'a' })
    expect(
      downloadTripExportInputSchema.safeParse({
        tripId,
        taskId: 'a'.repeat(129),
      }).success,
    ).toBe(false)
  })
})
