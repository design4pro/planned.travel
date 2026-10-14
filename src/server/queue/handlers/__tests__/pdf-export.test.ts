/**
 * The `pdf-export` handler, driven the way the consumer drives it.
 *
 * The database is real (a migrated in-memory SQLite, reached through the handler's database seam,
 * as `trip-copy` is), so "the requester is still in the workspace and the trip still exists" is read
 * from rows rather than asserted against a stub. The bindings are fakes that record what the handler
 * asked of them, in order, because the order is the contract: the PDF, then the printable page, then
 * the pointer, and only then the housekeeping.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  createTrip,
  deleteTrip,
  getMembership,
  removeMember,
  updateTrip,
} from '#/server/repos'
import {
  createHarness,
  subscribeTenant,
} from '#/server/repos/__tests__/harness'
import { createLogger, createMemorySink } from '#/server/observability/logger'
import { exportObjectKey } from '#/server/storage/export-artifacts'
import { fakeBucket } from '#/server/storage/__tests__/fake-bucket'
import { createPdfExportHandler, renderExportDocument } from '../pdf-export'
import {
  TaskConfigurationError,
  TaskPermanentError,
  pdfExportPayloadSchema,
} from '../../types'

import type { Locale } from '#/lib/i18n'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { LogRecord } from '#/server/observability/logger'
import type { FakeBucket } from '#/server/storage/__tests__/fake-bucket'
import type {
  ExportDocument,
  PdfExportPayload,
  TaskBindings,
  TaskContext,
} from '../../types'

/* -------------------------------------------------------------------- setup */

const NOW = Date.parse('2026-10-14T12:00:00.000Z')
const DAY_MS = 24 * 60 * 60 * 1000
const APP_URL = 'https://planned.travel'

const DOCUMENT: ExportDocument = {
  title: 'Lisbon',
  subtitle: '10 Apr - 14 Apr',
  sections: [
    {
      heading: 'Days',
      rows: [{ label: 'Day 1', value: 'Alfama', meta: '09:00' }],
    },
    {
      heading: 'Reservations',
      rows: [{ label: 'Hotel', value: 'Casa do Largo' }],
    },
  ],
}

let harness: Harness
let tenant: SeededTenant
let tripId: string

beforeEach(async () => {
  harness = await createHarness()
  tenant = await harness.seedTenant('alpha')
  await subscribeTenant(tenant.scope, 'crew', 5)
  tripId = (await createTrip(tenant.scope, { title: 'Lisbon' })).id
})

afterEach(() => {
  vi.restoreAllMocks()
  harness.close()
})

interface Rig {
  readonly context: TaskContext
  readonly bucket: FakeBucket
  /** Every effect, in the order it happened. */
  readonly events: Array<string>
  readonly emails: Array<{
    to: Array<string>
    subject: string
    html: string
    text: string
  }>
  readonly pointers: Map<string, string>
  readonly records: Array<LogRecord>
}

function rig(
  options: {
    readonly orgId?: string
    readonly bucket?: FakeBucket
    readonly withPdf?: boolean
    readonly withoutDb?: boolean
    readonly listFails?: boolean
    readonly deleteFails?: boolean
    /** `null` leaves `APP_URL` unset; omitted uses the default origin. */
    readonly appUrl?: string | null
  } = {},
): Rig {
  const events: Array<string> = []
  const emails: Rig['emails'] = []
  const pointers = new Map<string, string>()
  const sink = createMemorySink()
  const bucket =
    options.bucket ?? fakeBucket({}, { pageSize: 2, now: () => new Date(NOW) })

  const files = {
    put: async (key: string, value: unknown, putOptions?: unknown) => {
      events.push(`put:${key}`)
      return bucket.put(key, value as ReadableStream, putOptions as never)
    },
    get: bucket.get,
    head: async () => null,
    list: async (listOptions: Parameters<FakeBucket['list']>[0]) => {
      events.push('list')
      if (options.listFails === true) throw new Error('list is down')
      return bucket.list(listOptions)
    },
    delete: async (keys: string | Array<string>) => {
      events.push('delete')
      if (options.deleteFails === true) throw new Error('delete is down')
      return bucket.delete(keys)
    },
  }

  const env = {
    APP_NAME: 'planned.travel',
    ...(options.appUrl === null ? {} : { APP_URL: options.appUrl ?? APP_URL }),
    ...(options.withPdf === false
      ? {}
      : {
          BROWSER_RENDERING_API_TOKEN: 'token',
          CLOUDFLARE_ACCOUNT_ID: 'acc_1',
        }),
    FILES: files,
    KV: {
      get: async () => null,
      put: async (key: string, value: string) => {
        events.push(`kv:${key}`)
        pointers.set(key, value)
      },
      delete: async () => undefined,
      list: async () => ({ keys: [], list_complete: true }),
    },
    TASKS: {
      send: async (body: unknown) => {
        events.push('email')
        const envelope = body as { payload: Rig['emails'][number] }
        emails.push(envelope.payload)
      },
      sendBatch: async () => undefined,
    },
    // Present but never dereferenced: the handler builds its Drizzle handle through the injected
    // seam, so only the guard reads this.
    ...(options.withoutDb === true ? {} : { DB: {} }),
  } as unknown as TaskBindings

  const context: TaskContext = {
    env,
    logger: createLogger({ level: 'debug', sink }),
    now: () => NOW,
    attempt: 1,
    taskId: 'task-under-test',
    orgId: options.orgId ?? tenant.organizationId,
    callProvider: (_label, send) => send(),
  }
  return {
    context,
    bucket,
    events,
    emails,
    pointers,
    records: sink.records,
  }
}

function run(payload: Partial<PdfExportPayload>, rigged: Rig) {
  return createPdfExportHandler(() => harness.db)(
    {
      tripId,
      requestedBy: tenant.ownerUserId,
      document: DOCUMENT,
      ...payload,
    },
    rigged.context,
  )
}

/** A Browser Rendering answer, and the body the handler sent to it. */
function pdfProvider() {
  return vi
    .spyOn(globalThis, 'fetch')
    .mockImplementation(
      async () => new Response(new ArrayBuffer(8), { status: 200 }),
    )
}

function htmlOf(rigged: Rig, taskId = 'task-under-test'): string {
  return (
    rigged.bucket.objects.get(
      exportObjectKey(tenant.organizationId, tripId, taskId, 'html'),
    )?.body ?? ''
  )
}

function seedArtifacts(
  orgId: string,
  forTrip: string,
  ages: ReadonlyArray<number>,
): Record<string, { body: string; uploaded: Date }> {
  return Object.fromEntries(
    ages.flatMap((age, index) =>
      (['html', 'pdf'] as const).map((format) => [
        exportObjectKey(orgId, forTrip, `old-${index}`, format),
        { body: `${format}!`, uploaded: new Date(NOW - age * DAY_MS) },
      ]),
    ),
  )
}

/* -------------------------------------------------------------------- tests */

describe('the artifact the handler writes', () => {
  it('writes the PDF, then the printable page, then the pointer, then prunes', async () => {
    pdfProvider()
    const rigged = rig()

    const metrics = await run({}, rigged)

    const base = `exports/${tenant.organizationId}/${tripId}/task-under-test`
    expect(rigged.events).toEqual([
      `put:${base}.pdf`,
      `put:${base}.html`,
      'kv:export:task-under-test',
      'list',
    ])
    expect(metrics.format).toBe('pdf')
    expect(
      JSON.parse(rigged.pointers.get('export:task-under-test') ?? ''),
    ).toMatchObject({
      key: `${base}.pdf`,
      format: 'pdf',
      orgId: tenant.organizationId,
      tripId,
    })
  })

  it('points at the page when no PDF was rendered', async () => {
    const rigged = rig({ withPdf: false })

    const metrics = await run({}, rigged)

    const key = `exports/${tenant.organizationId}/${tripId}/task-under-test.html`
    expect(metrics.format).toBe('html')
    expect(
      JSON.parse(rigged.pointers.get('export:task-under-test') ?? ''),
    ).toMatchObject({ key, format: 'html' })
  })

  it('asks for a tagged PDF', async () => {
    const spy = pdfProvider()

    await run({}, rig())

    const sent = JSON.parse(String(spy.mock.calls[0]?.[1]?.body)) as {
      pdfOptions: Record<string, unknown>
    }
    expect(sent.pdfOptions).toMatchObject({ format: 'A4', tagged: true })
  })

  it('takes the organization from the envelope and the trip from the re-checked trip', async () => {
    const rigged = rig({ withPdf: false })

    await run({}, rigged)

    expect([...rigged.bucket.objects.keys()]).toEqual([
      `exports/${tenant.organizationId}/${tripId}/task-under-test.html`,
    ])
  })
})

describe('the prune', () => {
  it('deletes every object of an artifact past seven days, and keeps only the newest five of the rest', async () => {
    const bucket = fakeBucket(
      seedArtifacts(tenant.organizationId, tripId, [9, 6, 5, 4, 3, 2, 1]),
      { pageSize: 2, now: () => new Date(NOW) },
    )
    const rigged = rig({ bucket, withPdf: false })

    await run({}, rigged)

    const kept = [...bucket.objects.keys()].map((key) => key.split('/').pop())
    // `old-0` is nine days old and goes whatever the count. Of the seven that remain (the six
    // younger ones and the page just written) the newest five stay: `old-1` and `old-2` go.
    expect(kept.sort()).toEqual([
      'old-3.html',
      'old-3.pdf',
      'old-4.html',
      'old-4.pdf',
      'old-5.html',
      'old-5.pdf',
      'old-6.html',
      'old-6.pdf',
      'task-under-test.html',
    ])
  })

  it('deletes nothing with fewer than six artifacts and none stale', async () => {
    const bucket = fakeBucket(
      seedArtifacts(tenant.organizationId, tripId, [4, 3, 2, 1]),
      { now: () => new Date(NOW) },
    )
    const rigged = rig({ bucket, withPdf: false })

    await run({}, rigged)

    expect(bucket.calls).toEqual([])
  })

  it('leaves the job successful, with a warning, when the listing rejects', async () => {
    const rigged = rig({ listFails: true, withPdf: false })

    await expect(run({}, rigged)).resolves.toMatchObject({ format: 'html' })

    expect(
      rigged.records.find((r) => r.msg === 'export prune failed'),
    ).toMatchObject({ level: 'warn', tripId })
  })

  it('leaves the job successful, with a warning, when a delete rejects', async () => {
    const bucket = fakeBucket(
      seedArtifacts(tenant.organizationId, tripId, [30]),
      { now: () => new Date(NOW) },
    )
    const rigged = rig({ bucket, deleteFails: true, withPdf: false })

    await expect(run({}, rigged)).resolves.toMatchObject({ format: 'html' })

    expect(rigged.records.some((r) => r.msg === 'export prune failed')).toBe(
      true,
    )
  })

  it('never touches anything outside the one organization-and-trip prefix', async () => {
    const other = await harness.seedTenant('bravo')
    const otherTrip = (await createTrip(other.scope, { title: 'Porto' })).id
    const neighbours = {
      ...seedArtifacts(other.organizationId, otherTrip, [30, 1]),
      ...seedArtifacts(other.organizationId, tripId, [30]),
      ...seedArtifacts(tenant.organizationId, `${tripId}2`, [30]),
    }
    const bucket = fakeBucket(
      { ...seedArtifacts(tenant.organizationId, tripId, [30]), ...neighbours },
      { pageSize: 2, now: () => new Date(NOW) },
    )

    await run({}, rig({ bucket, withPdf: false }))

    for (const key of Object.keys(neighbours)) {
      expect(bucket.objects.has(key)).toBe(true)
    }
    expect(
      bucket.objects.has(
        exportObjectKey(tenant.organizationId, tripId, 'old-0', 'html'),
      ),
    ).toBe(false)
  })
})

describe('the scope re-check', () => {
  async function expectNothingWritten(rigged: Rig) {
    expect(rigged.events).toEqual([])
    expect(rigged.bucket.objects.size).toBe(0)
    expect(rigged.emails).toEqual([])
  }

  it('is permanent when the requester has left the workspace, before anything is written or sent', async () => {
    const leaverId = await tenant.addUser('Leaver')
    await removeMember(
      tenant.scope,
      (await getMembership(tenant.scope, leaverId))?.id ?? '',
    )
    const rigged = rig()

    await expect(
      run({ requestedBy: leaverId, notify: 'leaver@example.com' }, rigged),
    ).rejects.toBeInstanceOf(TaskPermanentError)
    await expectNothingWritten(rigged)
  })

  it('is permanent when the trip is gone', async () => {
    await deleteTrip(tenant.scope, tripId)
    const rigged = rig()

    await expect(
      run({ notify: 'owner@example.com' }, rigged),
    ).rejects.toBeInstanceOf(TaskPermanentError)
    await expectNothingWritten(rigged)
  })

  it("is permanent for another organization's trip", async () => {
    const other = await harness.seedTenant('bravo')
    const otherTrip = (await createTrip(other.scope, { title: 'Porto' })).id
    const rigged = rig()

    await expect(run({ tripId: otherTrip }, rigged)).rejects.toBeInstanceOf(
      TaskPermanentError,
    )
    await expectNothingWritten(rigged)
  })

  it('is permanent when the requester is in the workspace but not on the private trip', async () => {
    await updateTrip(tenant.scope, tripId, { visibility: 'private' })
    const colleagueId = await tenant.addUser('Colleague')
    const rigged = rig()

    await expect(
      run(
        { requestedBy: colleagueId, notify: 'colleague@example.com' },
        rigged,
      ),
    ).rejects.toBeInstanceOf(TaskPermanentError)
    await expectNothingWritten(rigged)
  })

  it('lets a workspace member export a trip the whole workspace may read', async () => {
    await updateTrip(tenant.scope, tripId, { visibility: 'organization' })
    const colleagueId = await tenant.addUser('Colleague')
    const rigged = rig({ withPdf: false })

    await run({ requestedBy: colleagueId }, rigged)

    expect(rigged.bucket.objects.size).toBe(1)
  })

  it('is a configuration failure when the database binding is missing', async () => {
    const rigged = rig({ withoutDb: true })

    await expect(run({}, rigged)).rejects.toBeInstanceOf(TaskConfigurationError)
    await expectNothingWritten(rigged)
  })
})

describe('the requester’s language', () => {
  it('writes lang and dir from the payload locale, right-to-left for Arabic', async () => {
    const rigged = rig({ withPdf: false })

    await run({ locale: 'ar' }, rigged)

    expect(htmlOf(rigged)).toContain('<html lang="ar" dir="rtl">')
  })

  it.each([undefined, 'xx-unknown', 'EN'])(
    'renders English for %s',
    async (locale) => {
      const rigged = rig({ withPdf: false })

      await run(locale === undefined ? {} : { locale }, rigged)

      expect(htmlOf(rigged)).toContain('<html lang="en" dir="ltr">')
    },
  )

  it('writes the footer from the catalogue, in the locale, with the time through the locale formatters', async () => {
    const english = rig({ withPdf: false })
    await run({}, english)
    const polish = rig({ withPdf: false })
    await run({ locale: 'pl' }, polish)

    expect(htmlOf(english)).toContain(
      '<footer>planned.travel - generated 14 Oct 2026, 12:00 PM</footer>',
    )
    expect(htmlOf(polish)).toContain('wygenerowano 14 paź 2026, 12:00')
    expect(htmlOf(polish)).not.toContain('generated')
  })

  it("reads the footer's date and clock time in the trip's own zone", async () => {
    // 12:00 UTC is 21:00 on the same day in Tokyo, and 05:00 the same day in Los Angeles.
    await updateTrip(tenant.scope, tripId, { timezone: 'Asia/Tokyo' })
    const tokyo = rig({ withPdf: false })
    await run({}, tokyo)
    await updateTrip(tenant.scope, tripId, { timezone: 'Pacific/Kiritimati' })
    const kiritimati = rig({ withPdf: false })
    await run({}, kiritimati)

    expect(htmlOf(tokyo)).toContain('generated 14 Oct 2026, 9:00 PM')
    // UTC+14: 02:00 on the 15th, so the date moves with the clock, never apart from it.
    expect(htmlOf(kiritimati)).toContain('generated 15 Oct 2026, 2:00 AM')
  })

  it('falls back to UTC, date and time together, for a zone the runtime cannot format', async () => {
    await updateTrip(tenant.scope, tripId, { timezone: 'Not/AZone' })
    const rigged = rig({ withPdf: false })

    await run({}, rigged)

    expect(htmlOf(rigged)).toContain('generated 14 Oct 2026, 12:00 PM')
  })

  it("joins the footer's date and time with the locale's own separator", async () => {
    const arabic = rig({ withPdf: false })
    await run({ locale: 'ar' }, arabic)

    expect(htmlOf(arabic)).toMatch(/14 [^،<]+ 2026، /)
  })

  it('writes the email subject, body and link text from the catalogue', async () => {
    const rigged = rig({ withPdf: false })

    await run({ notify: 'owner@example.com', locale: 'pl' }, rigged)

    const [email] = rigged.emails
    expect(email?.subject).toBe('Gotowe: Lisbon')
    expect(email?.html).toContain('Będzie dostępny przez 7 dni.')
    expect(email?.html).toContain('Otwórz: Lisbon')
    expect(email?.text).toBe(
      `Eksport podróży jest gotowy: ${APP_URL}/trips/${tripId}/files?export=task-under-test`,
    )
    expect(email?.html).toContain('dir="ltr"')
  })

  it('says how long the export is kept, in English too', async () => {
    const rigged = rig({ withPdf: false })

    await run({ notify: 'owner@example.com' }, rigged)

    expect(rigged.emails[0]?.subject).toBe('Lisbon is ready')
    expect(rigged.emails[0]?.html).toContain('It is kept for 7 days.')
  })
})

describe('the ready link', () => {
  it('opens the Files screen of the trip with the export marked, both ids URL-encoded', async () => {
    const rigged = rig({ withPdf: false })
    const context: TaskContext = { ...rigged.context, taskId: 'task/1 x&y' }

    await createPdfExportHandler(() => harness.db)(
      {
        tripId,
        requestedBy: tenant.ownerUserId,
        document: DOCUMENT,
        notify: 'owner@example.com',
      },
      context,
    )

    expect(rigged.emails[0]?.text).toBe(
      `Your trip export is ready: ${APP_URL}/trips/${encodeURIComponent(tripId)}/files?export=task%2F1%20x%26y`,
    )
    expect(rigged.emails[0]?.html).not.toContain('/app/trips')
  })

  it('escapes the translated string with the title already in it, so a <script> title is inert', async () => {
    const rigged = rig({ withPdf: false })

    await run(
      {
        notify: 'owner@example.com',
        document: { ...DOCUMENT, title: '<script>alert("x")</script>' },
      },
      rigged,
    )

    const email = rigged.emails[0]
    expect(email?.html).not.toContain('<script>')
    expect(email?.html).toContain(
      'Open &lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;',
    )
  })

  it('cuts a subject made from a 200-character title to the 200 the email payload accepts', async () => {
    const rigged = rig({ withPdf: false })

    await run(
      {
        notify: 'owner@example.com',
        document: { ...DOCUMENT, title: 'L'.repeat(200) },
      },
      rigged,
    )

    expect(rigged.emails[0]?.subject).toHaveLength(200)
  })

  it('refuses before anything is written when an email is asked for and APP_URL is not set', async () => {
    const rigged = rig({ appUrl: null })

    await expect(
      run({ notify: 'owner@example.com' }, rigged),
    ).rejects.toBeInstanceOf(TaskConfigurationError)
    expect(rigged.events).toEqual([])
  })

  it('still writes the export without APP_URL when no email is asked for', async () => {
    const rigged = rig({ appUrl: null, withPdf: false })

    await run({}, rigged)

    expect(rigged.bucket.objects.size).toBe(1)
  })

  it('does not double the slash when APP_URL ends in one', async () => {
    const rigged = rig({ appUrl: `${APP_URL}/`, withPdf: false })

    await run({ notify: 'owner@example.com' }, rigged)

    expect(rigged.emails[0]?.text).toContain(`${APP_URL}/trips/${tripId}/files`)
  })

  it('sends no email without an address', async () => {
    const rigged = rig({ withPdf: false })

    await run({}, rigged)

    expect(rigged.emails).toEqual([])
  })
})

describe('renderExportDocument', () => {
  const render = (document: ExportDocument = DOCUMENT, locale: Locale = 'en') =>
    renderExportDocument(document, { locale, footer: 'made by us' })

  it('has one top heading and one section heading per section', () => {
    const html = render()

    expect(html.match(/<h1>/g)).toHaveLength(1)
    expect(html.match(/<h2>/g)).toHaveLength(DOCUMENT.sections.length)
  })

  it('makes every label cell a row header', () => {
    const html = render()

    expect(html.match(/<th scope="row" class="label">/g)).toHaveLength(2)
    expect(html).not.toContain('<td class="label">')
  })

  it('has no low-contrast grey and end-aligns the meta cells', () => {
    const html = render()

    expect(html).not.toContain('#89877f')
    expect(html).toMatch(/td\.meta \{[^}]*text-align: end/)
    expect(html).toMatch(/th, td \{[^}]*text-align: start/)
  })

  it('does not letter-space a right-to-left page, where it would break the joined letters', () => {
    expect(render(DOCUMENT, 'ar')).toMatch(
      /html\[dir='rtl'\] h2 \{[^}]*letter-spacing: 0/,
    )
  })

  it('escapes every user-entered value, including after interpolation', () => {
    const hostile = `<b>"&'</b>`
    const html = renderExportDocument(
      {
        title: hostile,
        subtitle: hostile,
        sections: [
          {
            heading: hostile,
            note: hostile,
            rows: [{ label: hostile, value: hostile, meta: hostile }],
          },
        ],
      },
      { locale: 'en', footer: hostile },
    )

    expect(html).not.toContain('<b>')
    expect(html.match(/&lt;b&gt;&quot;&amp;&#39;&lt;\/b&gt;/g)).toHaveLength(9)
  })

  it('writes the language and direction of the locale it is given', () => {
    expect(render(DOCUMENT, 'ar')).toContain('<html lang="ar" dir="rtl">')
    expect(render(DOCUMENT, 'en')).toContain('<html lang="en" dir="ltr">')
  })
})

describe('pdfExportPayloadSchema', () => {
  const base = {
    tripId: 'trip_1',
    requestedBy: 'usr_1',
    document: DOCUMENT,
  }

  it('accepts a payload with and without the locale', () => {
    expect(pdfExportPayloadSchema.safeParse(base).success).toBe(true)
    expect(
      pdfExportPayloadSchema.safeParse({ ...base, locale: 'pl' }).success,
    ).toBe(true)
  })

  it('accepts a locale this build does not know, so a later build never dead-letters', () => {
    expect(
      pdfExportPayloadSchema.safeParse({ ...base, locale: 'xx-YY' }).success,
    ).toBe(true)
  })

  it('refuses a locale that is not a short string', () => {
    expect(
      pdfExportPayloadSchema.safeParse({ ...base, locale: 'x'.repeat(17) })
        .success,
    ).toBe(false)
  })
})
