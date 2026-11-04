import { createServer } from 'node:http'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

export const FIXTURE_SENTRY_DSN = 'http://public@127.0.0.1:4318/1'
const collectorURL = 'http://127.0.0.1:4318'
export const MAX_ENVELOPE_BYTES = 1024 * 1024
export const REQUEST_TIMEOUT_MS = 5000
const allowedHeaders = [
  'content-type',
  'sentry-trace',
  'baggage',
  'x-pt-server-today',
]

function fixtureOrigin(baseURL: string) {
  const url = new URL(baseURL)
  if (
    url.protocol !== 'http:' ||
    !['localhost', '127.0.0.1'].includes(url.hostname) ||
    url.username ||
    url.password
  ) {
    throw new Error(
      'The Sentry fixture requires a local HTTP application origin',
    )
  }
  return url.origin
}

/** Explicit fixture identity, never CI detection, opts a browser run into local delivery. */
export function feedbackWebServers(dsn: string | undefined, baseURL: string) {
  if (dsn === undefined) return []
  if (dsn !== FIXTURE_SENTRY_DSN)
    throw new Error('Unexpected E2E Sentry fixture DSN')
  const origin = fixtureOrigin(baseURL)
  return [
    {
      command: 'node scripts/ci/sentry-fixture.ts',
      env: { E2E_SENTRY_DSN: dsn, PLAYWRIGHT_BASE_URL: origin },
      url: `${collectorURL}/health`,
      reuseExistingServer: false,
      timeout: 15_000,
      gracefulShutdown: { signal: 'SIGTERM' as const, timeout: 2000 },
    },
  ]
}

/** A delivery fixture only: no payload parsing, retention, logging or forwarding. */
export function createFeedbackCollector(baseURL: string) {
  const origin = fixtureOrigin(baseURL)
  const server = createServer(
    {
      headersTimeout: REQUEST_TIMEOUT_MS,
      requestTimeout: REQUEST_TIMEOUT_MS,
      connectionsCheckingInterval: 1000,
    },
    (request, response) => {
      const finish = (status: number) => {
        response.setHeader('Connection', 'close')
        response.writeHead(status).end()
      }
      const deadline = setTimeout(() => finish(408), REQUEST_TIMEOUT_MS)
      response.once('close', () => clearTimeout(deadline))
      request.once('error', () => response.destroy())
      request.once('aborted', () => response.destroy())

      if (request.url === '/health' && request.method === 'GET')
        return finish(200)
      if (request.url?.split('?')[0] !== '/api/1/envelope/') return finish(404)
      if (!['POST', 'OPTIONS'].includes(request.method ?? ''))
        return finish(405)
      if (request.headers.origin !== origin) return finish(403)
      response.setHeader('Access-Control-Allow-Origin', origin)
      response.setHeader('Vary', 'Origin')
      if (request.method === 'OPTIONS') {
        const headers = String(
          request.headers['access-control-request-headers'] ?? '',
        )
          .split(',')
          .map((value) => value.trim().toLowerCase())
          .filter(Boolean)
        if (
          request.headers['access-control-request-method'] !== 'POST' ||
          headers.some((value) => !allowedHeaders.includes(value))
        )
          return finish(403)
        response.setHeader('Access-Control-Allow-Methods', 'POST')
        response.setHeader(
          'Access-Control-Allow-Headers',
          allowedHeaders.join(', '),
        )
        return finish(204)
      }
      let size = 0
      request.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > MAX_ENVELOPE_BYTES && !response.writableEnded) finish(413)
      })
      request.on('end', () => {
        if (!response.writableEnded) finish(204)
      })
    },
  )
  server.setTimeout(REQUEST_TIMEOUT_MS, (socket) => socket.destroy())
  return server
}

if (
  process.argv[1] &&
  pathToFileURL(resolve(process.argv[1])).href === import.meta.url
) {
  if (process.argv[2] === '--dsn') {
    process.stdout.write(`${FIXTURE_SENTRY_DSN}\n`)
  } else {
    const [config] = feedbackWebServers(
      process.env.E2E_SENTRY_DSN,
      process.env.PLAYWRIGHT_BASE_URL ?? '',
    )
    if (!config)
      throw new Error('The Sentry fixture must be explicitly configured')
    const server = createFeedbackCollector(config.env.PLAYWRIGHT_BASE_URL)
    server.on('error', () => {
      console.error('Cannot start local Sentry fixture')
      process.exitCode = 1
    })
    server.listen(4318, '127.0.0.1')
    const stop = () => {
      server.close()
      server.closeAllConnections()
    }
    process.once('SIGTERM', stop)
    process.once('SIGINT', stop)
  }
}
