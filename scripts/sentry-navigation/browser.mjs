import * as Sentry from '@sentry/react'
import { RouterProvider } from '@tanstack/react-router'
import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { getRouter } from '#/router'
import { createMetadataReporter } from './observe.mjs'

const { record: report } = createMetadataReporter(window.reportProbe)
const client = Sentry.getClient()
client.on('beforeEnvelope', ([header, items]) => {
  report({
    kind: 'envelope',
    id: header.event_id ?? null,
    trace: items[0]?.[1]?.contexts?.trace?.trace_id ?? null,
    op: items[0]?.[1]?.contexts?.trace?.op ?? null,
    types: items.map(([item]) => item.type),
  })
})
client.on('afterSendEvent', (event, response) => {
  report({
    kind: 'sdk-response',
    id: event.event_id,
    status: response?.statusCode ?? null,
  })
})
client.on('spanEnd', (span) => {
  report({
    kind: 'span',
    trace: span.spanContext().traceId,
    sampled: (span.spanContext().traceFlags & 1) === 1,
  })
})
const router = getRouter()
createRoot(document.getElementById('root')).render(
  createElement(RouterProvider, { router }),
)

export const probe = {
  transaction(padding) {
    const span = Sentry.startInactiveSpan({
      name: 'synthetic-navigation',
      op: 'diagnostic',
      parentSpan: null,
      forceTransaction: true,
    })
    span.setAttribute('synthetic.padding', 'x'.repeat(padding))
    const trace = span.spanContext().traceId
    const sampled = (span.spanContext().traceFlags & 1) === 1
    span.end()
    return { trace, sampled, createdAt: Date.now() }
  },
  navigate: () => router.navigate({ to: '/destination' }),
  flush: () => Sentry.flush(3000),
  async control(url, count) {
    const dropped = []
    const prefix = crypto.randomUUID().replaceAll('-', '').slice(0, 24)
    const transport = Sentry.makeFetchTransport({
      url,
      recordDroppedEvent: (reason, category) =>
        dropped.push({ reason, category }),
    })
    const send = (index) =>
      transport.send([
        { event_id: prefix + index.toString(16).padStart(8, '0') },
        [
          [
            { type: 'transaction' },
            { type: 'transaction', transaction: 'synthetic-control' },
          ],
        ],
      ])
    const results = await Promise.all(
      Array.from({ length: count }, (_, index) => send(index + 1)),
    )
    // A response must update the SDK's backoff before this subsequent envelope is considered.
    results.push(await send(count + 1))
    return {
      prefix,
      dropped,
      statuses: results.map((result) => result?.statusCode ?? null),
    }
  },
}
