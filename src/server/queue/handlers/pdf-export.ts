/**
 * `pdf-export` — renders a trip into a print artifact stored in R2.
 *
 * The handler always produces a self-contained, print-styled HTML document
 * (no external fonts, no images, `@page` margins set) and stores it in `FILES`.
 * When a Browser Rendering token is configured it also renders that document to
 * a real PDF through the Cloudflare REST API and stores the PDF alongside. The
 * download link the UI hands the user always points at whichever artifact exists,
 * so the feature works on day one and gets better when the token is added.
 */

import { assertUpstreamOk } from '../http'
import { enqueueTask } from '../jobs'
import { TaskConfigurationError } from '../types'
import type { ExportDocument, PdfExportPayload, TaskContext, TaskMetrics } from '../types'

/** Export artifacts are kept for a week; the KV pointer expires with them. */
export const EXPORT_TTL_SECONDS = 7 * 24 * 60 * 60

export function exportObjectKey(
  orgId: string,
  tripId: string,
  taskId: string,
  extension: 'html' | 'pdf',
): string {
  return `exports/${orgId}/${tripId}/${taskId}.${extension}`
}

export function exportPointerKey(taskId: string): string {
  return `export:${taskId}`
}

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
  return value.replace(/[&<>"']/g, (character) => HTML_ESCAPES[character] ?? character)
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
  .note { color: #6e6d65; margin: 0 0 3mm; }
  table { width: 100%; border-collapse: collapse; }
  td { padding: 2.4mm 0; border-bottom: 1px solid #ece9e3; vertical-align: top; }
  td.label { width: 38%; font-weight: 500; }
  td.value { width: 47%; font-variant-numeric: tabular-nums; }
  td.meta { width: 15%; color: #9b9a91; text-align: right; font-variant-numeric: tabular-nums; }
  footer { margin-top: 10mm; padding-top: 4mm; border-top: 1px solid #e5e2db; color: #9b9a91; font-size: 8pt; }
`

export function renderExportDocument(
  document: ExportDocument,
  meta: { appName: string; generatedAt: number },
): string {
  const sections = document.sections
    .map((section) => {
      const rows = section.rows
        .map(
          (row) =>
            `<tr><td class="label">${escapeHtml(row.label)}</td><td class="value">${escapeHtml(
              row.value,
            )}</td><td class="meta">${escapeHtml(row.meta ?? '')}</td></tr>`,
        )
        .join('')
      const note = section.note === undefined ? '' : `<p class="note">${escapeHtml(section.note)}</p>`
      return `<section><h2>${escapeHtml(section.heading)}</h2>${note}<table>${rows}</table></section>`
    })
    .join('')

  const subtitle =
    document.subtitle === undefined ? '' : `<p class="subtitle">${escapeHtml(document.subtitle)}</p>`

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(document.title)}</title>
<style>${PRINT_CSS}</style></head>
<body>
<header><h1>${escapeHtml(document.title)}</h1>${subtitle}</header>
${sections}
<footer>${escapeHtml(meta.appName)} · generated ${new Date(meta.generatedAt).toISOString().slice(0, 16).replace('T', ' ')} UTC</footer>
</body></html>`
}

export async function handlePdfExport(
  payload: PdfExportPayload,
  context: TaskContext,
): Promise<TaskMetrics> {
  const generatedAt = context.now()
  const html = renderExportDocument(payload.document, {
    appName: context.env.APP_NAME ?? 'planned.travel',
    generatedAt,
  })

  const htmlKey = exportObjectKey(context.orgId, payload.tripId, context.taskId, 'html')
  await context.env.FILES.put(htmlKey, html, {
    httpMetadata: { contentType: 'text/html; charset=utf-8', cacheControl: 'private, max-age=0' },
  })

  let pointer: ExportPointer = {
    taskId: context.taskId,
    tripId: payload.tripId,
    orgId: context.orgId,
    key: htmlKey,
    format: 'html',
    bytes: new TextEncoder().encode(html).byteLength,
    createdAt: generatedAt,
  }

  const pdf = await renderPdf(html, context)
  if (pdf !== null) {
    const pdfKey = exportObjectKey(context.orgId, payload.tripId, context.taskId, 'pdf')
    await context.env.FILES.put(pdfKey, pdf, {
      httpMetadata: { contentType: 'application/pdf', cacheControl: 'private, max-age=0' },
    })
    pointer = { ...pointer, key: pdfKey, format: 'pdf', bytes: pdf.byteLength }
  }

  await context.env.KV.put(exportPointerKey(context.taskId), JSON.stringify(pointer), {
    expirationTtl: EXPORT_TTL_SECONDS,
  })

  if (payload.notify !== undefined) {
    const url = `${context.env.APP_URL ?? ''}/app/trips/${encodeURIComponent(payload.tripId)}/exports/${encodeURIComponent(context.taskId)}`
    await enqueueTask(context.env.TASKS, {
      kind: 'email',
      orgId: context.orgId,
      id: `export-ready:${context.taskId}`,
      payload: {
        to: [payload.notify],
        subject: `${payload.document.title} is ready to download`,
        html: `<p>Your itinerary export is ready.</p><p><a href="${escapeHtml(url)}">Download ${escapeHtml(payload.document.title)}</a></p>`,
        text: `Your itinerary export is ready: ${url}`,
        tag: 'export-ready',
      },
    })
  }

  context.logger.info('trip export written', {
    tripId: payload.tripId,
    key: pointer.key,
    format: pointer.format,
    bytes: pointer.bytes,
  })

  return { format: pointer.format, bytes: pointer.bytes, sections: payload.document.sections.length }
}

/**
 * Renders the document with Cloudflare Browser Rendering when the token exists.
 * Returns `null` when rendering is not configured — the HTML artifact stands on
 * its own, and the caller records `format: 'html'`.
 */
async function renderPdf(html: string, context: TaskContext): Promise<ArrayBuffer | null> {
  const token = context.env.BROWSER_RENDERING_API_TOKEN
  const accountId = context.env.CLOUDFLARE_ACCOUNT_ID
  if (token === undefined || token.length === 0) return null
  if (accountId === undefined || accountId.length === 0) {
    throw new TaskConfigurationError(
      'BROWSER_RENDERING_API_TOKEN is set but CLOUDFLARE_ACCOUNT_ID is missing',
    )
  }

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/browser-rendering/pdf`,
    {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        html,
        pdfOptions: { format: 'A4', printBackground: true },
      }),
    },
  )
  await assertUpstreamOk(response, 'Browser Rendering PDF')
  return response.arrayBuffer()
}
