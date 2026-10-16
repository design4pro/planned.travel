import { describe, expect, it } from 'vitest'
import { scrubEvent, scrubTelemetry } from '../sentry-scrub'

describe('calendar credential telemetry redaction', () => {
  it('scrubs requests, transactions, spans, logs and breadcrumbs including encoded handoff URLs', () => {
    const secret = 'S'.repeat(32)
    const url = `https://app.example/api/feed/${secret}.ics`
    const data = {
      request: { url },
      transaction: url,
      breadcrumbs: [{ message: url }],
      spans: [{ description: url, data: { url } }],
      body: url,
      attributes: { url: encodeURIComponent(url) },
    }
    expect(JSON.stringify(scrubEvent(data))).not.toContain(secret)
    expect(JSON.stringify(scrubTelemetry({ description: url }))).not.toContain(
      secret,
    )
    expect(scrubTelemetry({ body: 'safe' })).toEqual({ body: 'safe' })
  })
})
