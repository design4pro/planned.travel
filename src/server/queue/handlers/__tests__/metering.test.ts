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

import { describe, expect, it, vi } from 'vitest'
import { createLogger, createMemorySink } from '#/server/observability'
import { ProviderBlockedError } from '#/server/metering/errors'
import { handleEmail } from '../email'
import { handlePdfExport } from '../pdf-export'
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
    },
    KV: { put: async () => undefined },
    ...options.env,
  } as unknown as TaskBindings

  const context: TaskContext = {
    env,
    logger: createLogger({ level: 'error', sink: createMemorySink() }),
    now: () => NOW,
    attempt: 1,
    taskId: 'task_1',
    orgId: 'org_1',
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
  it('renders through the meter, labelled as the provider it is', async () => {
    const fetchSpy = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(new ArrayBuffer(8), { status: 200 }))
    const { context, recorded } = harness()

    try {
      const metrics = await handlePdfExport(
        { tripId: 'trip_1', requestedBy: 'usr_1', document: DOCUMENT },
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
    const { context, stored } = harness({ blockOn: 'browser-rendering' })

    try {
      const metrics = await handlePdfExport(
        { tripId: 'trip_1', requestedBy: 'usr_1', document: DOCUMENT },
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
