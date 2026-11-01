/**
 * `pdf-export` — renders a trip into a print artifact stored in R2.
 *
 * The handler always produces a self-contained, print-styled HTML document
 * (no external fonts, no images, `@page` margins set) and stores it in `FILES`.
 * When a Browser Rendering token is configured it also renders that document to
 * a real PDF through the Cloudflare REST API and stores the PDF alongside. The
 * download link the UI hands the user always points at whichever artifact exists,
 * so the feature works on day one and gets better when the token is added.
 *
 * ## Order is the contract
 *
 * The scope is re-checked first, so a requester who has left the workspace or a trip that is gone
 * ends the job before anything is written or sent. Then the PDF (when one was rendered), then the
 * printable page, then the pointer: the page is written last because it is the marker a listing
 * reads as "this artifact is finished" (`storage/export-artifacts.ts`). The old artifacts are pruned
 * only after that, and a failing prune is a warning, never a failed job: failing it would retry a
 * render that already succeeded and cost the traveller nothing but a second metered call.
 */

import { drizzle } from 'drizzle-orm/d1'
import {
  DEFAULT_LOCALE,
  directionOf,
  isSupportedLocale,
} from '#/lib/i18n/locales'
import { createTranslator, loadCatalogue } from '#/lib/i18n/catalogue'
import { zoneClockTime } from '#/lib/clock-zones'
import { formatDate } from '#/lib/format'
import { FALLBACK_TIME_ZONE, dayKeyIn, resolveTimeZone } from '#/lib/time'
import { isOrganizationRole } from '#/server/auth/tenant'
import { isProviderBlockedError } from '#/server/metering/errors'
import { serializeError } from '#/server/observability'
import {
  NotFoundError,
  createScope,
  getMembership,
  requireTrip,
} from '#/server/repos'
import {
  EXPORT_KEEP_COUNT,
  EXPORT_TTL_SECONDS,
  exportObjectKey,
  exportPointerKey,
  pruneExportArtifacts,
} from '#/server/storage/export-artifacts'
import { assertUpstreamOk } from '../http'
import { enqueueTask } from '../jobs'
import { TaskAbandonedError, TaskConfigurationError } from '../types'
import type { Locale } from '#/lib/i18n'
import type { Database } from '#/server/db/types'
import type { TenantScope } from '#/server/repos'
import type {
  ExportDocument,
  PdfExportPayload,
  TaskContext,
  TaskHandler,
  TaskMetrics,
} from '../types'
import type { DatabaseFor } from './travel-stats'

export interface ExportPointer {
  taskId: string
  tripId: string
  orgId: string
  key: string
  format: 'html' | 'pdf'
  bytes: number
  createdAt: number
}

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (character) => HTML_ESCAPES[character] ?? character,
  )
}

/**
 * User text in its own bidi isolate: its direction follows its own script, while alignment and
 * column spacing stay with the page, so a Latin name on an Arabic page (or the reverse) neither
 * flips sides nor swallows the punctuation around it.
 */
function isolate(value: string): string {
  return `<bdi>${escapeHtml(value)}</bdi>`
}

/**
 * Print stylesheet. Deliberately literal values rather than design tokens: this
 * document leaves our runtime and is rendered by a print engine, so it cannot
 * depend on the app's CSS custom properties.
 */
const PRINT_CSS = `
  @page { size: A4; margin: 18mm 16mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Geist Sans", "Helvetica Neue", Arial, sans-serif;
    color: #131311;
    background: #ffffff;
    font-size: 10.5pt;
    line-height: 1.5;
  }
  /* The page margin is the printer's; opened on a screen the page needs its own. */
  @media screen { body { padding: 16px; } }
  /* A booking URL or a long name must wrap inside the page, not widen the table past it. */
  h1, h2, .subtitle, .note, th, td { overflow-wrap: anywhere; }
  header { border-bottom: 1px solid #e5e2db; padding-bottom: 10mm; margin-bottom: 8mm; }
  h1 { font-size: 26pt; line-height: 1.05; margin: 0 0 3mm; letter-spacing: -0.01em; }
  .subtitle { margin: 0; color: #6e6d65; font-size: 11pt; }
  section { break-inside: avoid; margin-bottom: 7mm; }
  h2 {
    font-size: 8pt;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: #6e6d65;
    margin: 0 0 3mm;
  }
  /* Letter-spacing disconnects cursive scripts, so a right-to-left page keeps its headings joined. */
  html[dir='rtl'] h2 { letter-spacing: 0; }
  .note { color: #6e6d65; margin: 0 0 3mm; }
  table { width: 100%; table-layout: fixed; border-collapse: collapse; }
  th, td { padding: 2.4mm 0; padding-inline-end: 3mm; border-bottom: 1px solid #ece9e3; vertical-align: top; text-align: start; }
  th.label { width: 38%; font-weight: 500; }
  td.value { width: 47%; font-variant-numeric: tabular-nums; }
  td.meta { width: 15%; color: #6e6d65; text-align: end; font-variant-numeric: tabular-nums; }
  footer { margin-top: 10mm; padding-top: 4mm; border-top: 1px solid #e5e2db; color: #6e6d65; font-size: 8pt; }
`

/**
 * The printable page. Pure: the locale and the already-translated footer are arguments, so nothing
 * here reads the catalogue or the clock. `lang` and `dir` come from the closed set of supported
 * locales, never from the document.
 */
export function renderExportDocument(
  document: ExportDocument,
  meta: { locale: Locale; footer: string },
): string {
  const sections = document.sections
    .map((section) => {
      const rows = section.rows
        .map(
          (row) =>
            `<tr><th scope="row" class="label">${isolate(row.label)}</th><td class="value">${isolate(
              row.value,
            )}</td><td class="meta">${isolate(row.meta ?? '')}</td></tr>`,
        )
        .join('')
      const note =
        section.note === undefined
          ? ''
          : `<p class="note">${isolate(section.note)}</p>`
      // An empty `<table>` is announced as a table with no rows, so a section with none has none.
      const table = rows === '' ? '' : `<table>${rows}</table>`
      return `<section><h2>${isolate(section.heading)}</h2>${note}${table}</section>`
    })
    .join('')

  const subtitle =
    document.subtitle === undefined
      ? ''
      : `<p class="subtitle">${isolate(document.subtitle)}</p>`

  return `<!doctype html>
<html lang="${meta.locale}" dir="${directionOf(meta.locale)}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(document.title)}</title>
<style>${PRINT_CSS}</style></head>
<body>
<header><h1>${isolate(document.title)}</h1>${subtitle}</header>
<main>${sections}</main>
<footer>${escapeHtml(meta.footer)}</footer>
</body></html>`
}

/** The scope the re-check runs under: the envelope's organization, the requester, their real role. */
function scopeFor(
  db: Database,
  organizationId: string,
  userId: string,
  role: string,
): TenantScope {
  return createScope(db, {
    userId,
    organizationId,
    // An unrecognised value resolves to the least privilege, never to "unset, therefore permissive".
    role: isOrganizationRole(role) ? role : 'member',
    impersonatedBy: null,
  })
}

/**
 * Re-checks, before anything is written or emailed, that the requester is still in the workspace
 * and the trip is still readable to them. Reads for authorisation only: the document stays the one
 * the request built. The organization is the envelope's, never the payload's.
 *
 * A member row or trip that is gone cannot come back on retry, so both are abandoned: the consumer
 * acks them without a dead letter. Anything else (a D1 hiccup) rethrows, and the queue redelivers.
 */
async function recheckScope(
  db: Database,
  context: TaskContext,
  payload: PdfExportPayload,
): Promise<{ tripId: string; timeZone: string }> {
  const probe = scopeFor(db, context.orgId, payload.requestedBy, 'member')
  const membership = await getMembership(probe, payload.requestedBy)
  if (membership === null) {
    throw new TaskAbandonedError(
      'requester-left',
      `User ${payload.requestedBy} is no longer a member of ${context.orgId}; the trip export is abandoned`,
    )
  }
  const scope = scopeFor(
    db,
    context.orgId,
    payload.requestedBy,
    membership.role,
  )
  try {
    const trip = await requireTrip(scope, payload.tripId)
    return { tripId: trip.id, timeZone: resolveTimeZone(trip.timezone) }
  } catch (cause) {
    if (cause instanceof NotFoundError) {
      throw new TaskAbandonedError(
        'trip-gone',
        `Trip ${payload.tripId} is gone; there is nothing left to export`,
        { cause },
      )
    }
    throw cause
  }
}

const SECONDS_PER_DAY = 24 * 60 * 60

/**
 * The footer's `{when}`: the date and the clock time of the instant, both read in the trip's own
 * zone (UTC when the trip has none, or the runtime cannot format it), so the two halves are never
 * in different zones. The join is the catalogue's, not a literal here.
 */
function generatedWhen(
  generatedAt: number,
  locale: Locale,
  timeZone: string,
  t: ReturnType<typeof createTranslator>,
): string {
  const zone =
    zoneClockTime(timeZone, generatedAt, locale) === null
      ? FALLBACK_TIME_ZONE
      : timeZone
  const date = dayKeyIn(new Date(generatedAt).toISOString(), zone)
  return t('modules.files.export.madeAt', {
    date: formatDate(date, locale) ?? date,
    time: zoneClockTime(zone, generatedAt, locale) ?? '',
  })
}

/**
 * Builds the handler over a database seam. {@link handlePdfExport} is the one the consumer
 * registers; a test builds its own against the harness. The seam exists for the reason it does in
 * `trip-copy`: `src/server/db/client.ts` reads the ambient Worker environment at module scope, and
 * `consumer.ts` imports every handler, so the default is the Drizzle handle over the Worker's D1.
 */
export function createPdfExportHandler(
  databaseFor: DatabaseFor = (binding) => drizzle(binding),
): TaskHandler<'pdf-export'> {
  return async function pdfExport(
    payload: PdfExportPayload,
    context: TaskContext,
  ): Promise<TaskMetrics> {
    const binding = context.env.DB
    if (binding === undefined) {
      throw new TaskConfigurationError(
        'DB binding is not available to the queue consumer; a trip export cannot run',
      )
    }
    const { tripId, timeZone } = await recheckScope(
      databaseFor(binding),
      context,
      payload,
    )

    // A relative link in an email goes nowhere, so a notification without an origin is a
    // configuration error found before anything is rendered or written.
    const appUrl = context.env.APP_URL?.replace(/\/+$/, '')
    if (payload.notify !== undefined && !appUrl) {
      throw new TaskConfigurationError(
        'APP_URL is not set; the trip export email would carry a link that cannot open',
      )
    }

    const locale = isSupportedLocale(payload.locale)
      ? payload.locale
      : DEFAULT_LOCALE
    const t = createTranslator(locale, await loadCatalogue(locale))
    const generatedAt = context.now()
    const html = renderExportDocument(payload.document, {
      locale,
      footer: t('modules.files.export.doc.footer', {
        app: context.env.APP_NAME ?? 'planned.travel',
        when: generatedWhen(generatedAt, locale, timeZone, t),
      }),
    })

    // The PDF first and the page last: the page is the marker a listing reads as "finished".
    const pdf = await renderPdf(html, context)
    const pdfKey = exportObjectKey(context.orgId, tripId, context.taskId, 'pdf')
    const htmlKey = exportObjectKey(
      context.orgId,
      tripId,
      context.taskId,
      'html',
    )
    if (pdf !== null) {
      await context.env.FILES.put(pdfKey, pdf, {
        httpMetadata: {
          contentType: 'application/pdf',
          cacheControl: 'private, max-age=0',
        },
      })
    }
    await context.env.FILES.put(htmlKey, html, {
      httpMetadata: {
        contentType: 'text/html; charset=utf-8',
        cacheControl: 'private, max-age=0',
      },
    })

    const pointer: ExportPointer =
      pdf === null
        ? {
            taskId: context.taskId,
            tripId,
            orgId: context.orgId,
            key: htmlKey,
            format: 'html',
            bytes: new TextEncoder().encode(html).byteLength,
            createdAt: generatedAt,
          }
        : {
            taskId: context.taskId,
            tripId,
            orgId: context.orgId,
            key: pdfKey,
            format: 'pdf',
            bytes: pdf.byteLength,
            createdAt: generatedAt,
          }
    await context.env.KV.put(
      exportPointerKey(context.taskId),
      JSON.stringify(pointer),
      { expirationTtl: EXPORT_TTL_SECONDS },
    )

    if (payload.notify !== undefined) {
      await enqueueTask(context.env.TASKS, {
        kind: 'email',
        orgId: context.orgId,
        id: `export-ready:${context.taskId}`,
        payload: readyEmail(
          t,
          locale,
          payload.notify,
          payload.document.title,
          `${appUrl}/trips/${encodeURIComponent(tripId)}/files?export=${encodeURIComponent(context.taskId)}`,
        ),
      })
    }

    const pruned = await pruneOldExports(context, tripId)

    context.logger.info('trip export written', {
      tripId,
      key: pointer.key,
      format: pointer.format,
      bytes: pointer.bytes,
      pruned,
      locale,
    })

    return {
      format: pointer.format,
      bytes: pointer.bytes,
      sections: payload.document.sections.length,
    }
  }
}

/** The handler `consumer.ts` registers, over the Worker's own D1 binding. */
export const handlePdfExport = createPdfExportHandler()

/**
 * The "ready" email, in the requester's language. The sentence is escaped **after** the title has
 * been interpolated into it, so a title carrying markup stays text however the catalogue words it.
 */
function readyEmail(
  t: ReturnType<typeof createTranslator>,
  locale: Locale,
  to: string,
  title: string,
  url: string,
) {
  const body = t('modules.files.export.email.body', {
    count: EXPORT_TTL_SECONDS / SECONDS_PER_DAY,
    title,
  })
  const action = t('modules.files.export.email.action')
  const limit = t('modules.files.export.limit', { count: EXPORT_KEEP_COUNT })
  return {
    to: [to],
    // A title may be 200 characters; the email payload's subject is capped at the same 200.
    subject: cutSubject(t('modules.files.export.email.subject', { title })),
    html: `<div lang="${locale}" dir="${directionOf(locale)}"><p>${escapeHtml(body)}</p><p>${escapeHtml(limit)}</p><p><a href="${escapeHtml(url)}">${escapeHtml(action)}</a></p></div>`,
    text: t('modules.files.export.email.text', { body, limit, url }),
    tag: 'export-ready',
  }
}

const SUBJECT_MAX = 200

/** The email payload caps a subject at 200 UTF-16 units; a cut never leaves half an emoji behind. */
function cutSubject(subject: string): string {
  const cut = subject.slice(0, SUBJECT_MAX)
  return /[\uD800-\uDBFF]$/.test(cut) ? cut.slice(0, -1) : cut
}

/** Housekeeping after the artifact is durable: a failure is logged and never fails the job. */
async function pruneOldExports(
  context: TaskContext,
  tripId: string,
): Promise<number> {
  try {
    return await pruneExportArtifacts(
      context.env.FILES,
      context.orgId,
      tripId,
      {
        now: context.now(),
      },
    )
  } catch (cause) {
    context.logger.warn('export prune failed', {
      tripId,
      ...serializeError(cause),
    })
    return 0
  }
}

/**
 * Renders the document with Cloudflare Browser Rendering when the token exists.
 * Returns `null` when rendering is not configured — the HTML artifact stands on
 * its own, and the caller records `format: 'html'`.
 *
 * It also returns `null` when the provider's metering ceiling has been reached and its policy is
 * to block. That is deliberately the *same* answer as "not configured" rather than a new failure
 * mode: this function has had a designed fallback since before it was metered, so a capped export
 * degrades to the print-ready HTML the caller already knows how to write, and nobody's export
 * fails. Of the three metered providers this is the only one where blocking costs the user nothing
 * but fidelity, which is what makes it the safe one to cap.
 */
async function renderPdf(
  html: string,
  context: TaskContext,
): Promise<ArrayBuffer | null> {
  const token = context.env.BROWSER_RENDERING_API_TOKEN
  const accountId = context.env.CLOUDFLARE_ACCOUNT_ID
  if (token === undefined || token.length === 0) return null
  if (accountId === undefined || accountId.length === 0) {
    throw new TaskConfigurationError(
      'BROWSER_RENDERING_API_TOKEN is set but CLOUDFLARE_ACCOUNT_ID is missing',
    )
  }

  let response: Response
  try {
    response = await context.callProvider(
      { provider: 'browser-rendering', operation: 'pdf.render' },
      () =>
        fetch(
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/pdf`,
          {
            method: 'POST',
            headers: {
              authorization: `Bearer ${token}`,
              'content-type': 'application/json',
            },
            body: JSON.stringify({
              html,
              pdfOptions: {
                format: 'A4',
                printBackground: true,
                tagged: true,
              },
            }),
          },
        ),
    )
  } catch (cause) {
    if (isProviderBlockedError(cause)) {
      context.logger.warn('pdf rendering skipped: provider over its ceiling', {
        provider: cause.provider,
        callLimit: cause.callLimit,
        used: cause.used,
      })
      return null
    }
    throw cause
  }

  await assertUpstreamOk(response, 'Browser Rendering PDF')
  return response.arrayBuffer()
}
