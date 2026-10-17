/**
 * That the two queue-path call sites actually go through the meter, and that a refusal lands the
 * way each of them designed for.
 *
 * The wiring is the thing worth pinning. `context.callProvider` is a required field precisely so a
 * handler cannot quietly stop being counted, but "required" only stops the *compiler* case: a
 * handler could hold the field and still call `fetch` directly, and nothing about a working system
 * would look different — the mail would send, the export would render, and the console would
 * under-report what the vendor is about to bill for. So these tests assert on the label the meter
 * was given, not merely that a request went out.
 *
 * The two refusal paths are opposite on purpose, and both are asserted here because the asymmetry
 * is a decision rather than an accident: a blocked PDF degrades to the print-ready HTML the caller
 * already writes, and a blocked email has no fallback at all and must surface.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTrip } from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'
import { createLogger, createMemorySink } from '#/server/observability'
import { ProviderBlockedError } from '#/server/metering/errors'
import { handleEmail } from '../email'
import { createPdfExportHandler } from '../pdf-export'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { ProviderCallLabel } from '#/server/metering/outbound'
import type { ExportDocument, TaskBindings, TaskContext } from '../../types'

const NOW = Date.parse('2026-08-30T18:55:12.345Z')

const DOCUMENT: ExportDocument = {
  title: 'Lisbon',
  sections: [{ heading: 'Days', rows: [{ label: 'Day 1', value: 'Alfama' }] }],
}

interface Recorded {
  readonly label: ProviderCallLabel
}

function harness(
  options: {
    readonly blockOn?: string
    readonly orgId?: string
    readonly env?: Partial<TaskBindings>
  } = {},
) {
  const recorded: Array<Recorded> = []
  const stored = new Map<string, unknown>()

  const env = {
    EMAIL_API_KEY: 'key',
    EMAIL_FROM: 'planned.travel <no-reply@planned.travel>',
    EMAIL_API_URL: 'https://api.resend.com/emails',
    APP_NAME: 'planned.travel',
    BROWSER_RENDERING_API_TOKEN: 'token',
    CLOUDFLARE_ACCOUNT_ID: 'acc_1',
    FILES: {
      put: async (key: string, value: unknown) => {
        stored.set(key, value)
      },
      list: async () => ({ objects: [], truncated: false }),
      delete: async () => undefined,
    },
    KV: { put: async () => undefined },
    // Never dereferenced: the pdf-export handler is built over the harness database below.
    DB: {},
    ...options.env,
  } as unknown as TaskBindings

  const context: TaskContext = {
    env,
    logger: createLogger({ level: 'error', sink: createMemorySink() }),
    now: () => NOW,
    attempt: 1,
    taskId: 'task_1',
    orgId: options.orgId ?? 'org_1',
    callProvider: async <T>(
      label: ProviderCallLabel,
      send: () => Promise<T>,
    ) => {
      recorded.push({ label })
      if (options.blockOn === label.provider) {
        throw new ProviderBlockedError({
          provider: label.provider,
          operation: label.operation,
          callLimit: 10,
          used: 10,
          limitWindow: 'month',
        })
      }
      return send()
    },
  }

  return { context, recorded, stored }
}

describe('email', () => {
  it('sends through the meter, labelled as the provider it is', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }))
    const { context, recorded } = harness()

    try {
      await handleEmail(
        { to: ['traveller@example.com'], subject: 'Hi', html: '<p>Hi</p>' },
        context,
      )
    } finally {
      fetchSpy.mockRestore()
    }

    expect(recorded).toEqual([
      { label: { provider: 'resend', operation: 'email.send' } },
    ])
  })

  it('preserves one event identity on redelivery and distinguishes separate matching notices', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }))
    const { context } = harness()
    const first = {
      to: ['owner@example.com'],
      subject: 'Passkey added',
      html: '<p>Added</p>',
      tag: 'auth-passkey-added',
      eventId: crypto.randomUUID(),
    }
    const second = { ...first, eventId: crypto.randomUUID() }
    try {
      await handleEmail(first, context)
      await handleEmail(first, { ...context, attempt: 2 })
      await handleEmail(second, context)
      const identities = fetchSpy.mock.calls.map(([, init]) =>
        new Headers(init?.headers).get('idempotency-key'),
      )
      expect(identities).toEqual([first.eventId, first.eventId, second.eventId])
      expect(identities[0]).not.toBe(identities[2])
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('keeps the previous identity for old queued messages without an event id', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 200 }))
    const { context } = harness()
    try {
      await handleEmail(
        {
          to: ['owner@example.com'],
          subject: 'Hi',
          html: '<p>Hi</p>',
          tag: 'auth',
        },
        context,
      )
      expect(
        new Headers(fetchSpy.mock.calls[0]?.[1]?.headers).get(
          'idempotency-key',
        ),
      ).toBe('auth:Hi:owner@example.com')
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('propagates provider failure so the queue can retry the same event', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('{}', { status: 503 }))
    const { context } = harness()
    try {
      await expect(
        handleEmail(
          {
            to: ['owner@example.com'],
            subject: 'Hi',
            html: '<p>Hi</p>',
            eventId: crypto.randomUUID(),
          },
          context,
        ),
      ).rejects.toThrow()
    } finally {
      fetchSpy.mockRestore()
    }
  })

  it('surfaces a refusal rather than swallowing it — there is no fallback delivery path', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { context } = harness({ blockOn: 'resend' })

    try {
      await expect(
        handleEmail(
          { to: ['traveller@example.com'], subject: 'Hi', html: '<p>Hi</p>' },
          context,
        ),
      ).rejects.toBeInstanceOf(ProviderBlockedError)
      // Refused before the vendor was reached, which is the point of gating before the call.
      expect(fetchSpy).not.toHaveBeenCalled()
    } finally {
      fetchSpy.mockRestore()
    }
  })
})

describe('pdf export', () => {
  // The handler re-checks the requester and the trip before it renders, so these cases run against
  // a real tenant, through the handler's database seam (as `trip-copy` is built).
  let db: Harness
  let tenant: SeededTenant
  let tripId: string

  beforeEach(async () => {
    db = await createHarness()
    tenant = await db.seedTenant('alpha')
    tripId = (await createTrip(tenant.scope, { title: 'Lisbon' })).id
  })

  afterEach(() => {
    db.close()
  })

  const handlePdfExport = (
    payload: Parameters<ReturnType<typeof createPdfExportHandler>>[0],
    context: TaskContext,
  ) => createPdfExportHandler(() => db.db)(payload, context)

  it('renders through the meter, labelled as the provider it is', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(new ArrayBuffer(8), { status: 200 }))
    const { context, recorded } = harness({ orgId: tenant.organizationId })

    try {
      const metrics = await handlePdfExport(
        { tripId, requestedBy: tenant.ownerUserId, document: DOCUMENT },
        context,
      )
      expect(metrics.format).toBe('pdf')
    } finally {
      fetchSpy.mockRestore()
    }

    expect(recorded).toEqual([
      { label: { provider: 'browser-rendering', operation: 'pdf.render' } },
    ])
  })

  /**
   * The designed degradation. `renderPdf` has returned `null` for an unconfigured token since
   * before it was metered, so a refusal reuses that path and the export still completes — which is
   * what makes `browser-rendering` the safe provider to cap.
   */
  it('falls back to the HTML artifact when the provider is over its ceiling', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    const { context, stored } = harness({
      blockOn: 'browser-rendering',
      orgId: tenant.organizationId,
    })

    try {
      const metrics = await handlePdfExport(
        { tripId, requestedBy: tenant.ownerUserId, document: DOCUMENT },
        context,
      )

      expect(metrics.format).toBe('html')
      expect(fetchSpy).not.toHaveBeenCalled()
      expect([...stored.keys()].some((key) => key.endsWith('.html'))).toBe(true)
      expect([...stored.keys()].some((key) => key.endsWith('.pdf'))).toBe(false)
    } finally {
      fetchSpy.mockRestore()
    }
  })
})
