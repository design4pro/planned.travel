import { createServer } from 'node:http'
import { createHash } from 'node:crypto'

/** Loopback-only, bounded and discard-only: keep the envelope id, never its payload. */
export async function startCollector({
  origin,
  port = 0,
  maxBytes = 131_072,
  maxRequests = 1024,
  status = 204,
  rateLimit = '',
  delay = 0,
} = {}) {
  if (!/^http:\/\/127\.0\.0\.1:\d+$/.test(origin)) {
    throw new Error('Collector requires a loopback fixture origin')
  }
  let expired = false
  const records = []
  const rejections = []
  const timers = new Set()
  const policy = { status, rateLimit, delay }
  let requests = 0
  const server = createServer((request, response) => {
    response.setHeader('Access-Control-Allow-Origin', origin)
    response.setHeader('Access-Control-Allow-Headers', '*')
    response.setHeader(
      'Access-Control-Expose-Headers',
      'X-Sentry-Rate-Limits, Retry-After',
    )
    const finish = (code, reason) => {
      if (reason && rejections.length < maxRequests)
        rejections.push({ status: code, reason })
      response.writeHead(code)
      response.end()
    }
    if (request.headers.origin && request.headers.origin !== origin)
      return finish(403, 'origin')
    if (request.url?.split('?')[0] !== '/api/1/envelope/')
      return finish(404, 'endpoint')
    if (request.method === 'OPTIONS') return finish(204)
    if (request.method !== 'POST') return finish(405, 'method')
    if (++requests > maxRequests) return finish(429, 'request_limit')
    const digest = createHash('sha256')
    let bytes = 0
    let header = ''
    let id = null
    let parsed = false
    let oversized = false
    request.on('data', (chunk) => {
      bytes += chunk.length
      if (bytes > maxBytes) {
        oversized = true
        header = ''
        return
      }
      digest.update(chunk)
      if (parsed) return
      const newline = chunk.indexOf(10)
      header += chunk
        .subarray(0, newline < 0 ? chunk.length : newline)
        .toString('utf8')
      if (header.length > 1024) {
        header = ''
        parsed = true
      } else if (newline >= 0) {
        try {
          const candidate = JSON.parse(header).event_id
          if (typeof candidate === 'string' && /^[a-f0-9]{32}$/.test(candidate))
            id = candidate
        } catch {
          /* Malformed headers have no correlation id. */
        }
        parsed = true
        header = ''
      }
    })
    request.on('error', () => response.destroy())
    request.on('end', () => {
      if (oversized) return finish(413, 'body_limit')
      const record = {
        id,
        bytes,
        sha256: digest.digest('hex'),
        received: true,
        status: policy.status,
        finished: false,
      }
      records.push(record)
      const { status: code, rateLimit: limit, delay: wait } = policy
      response.once('finish', () => {
        record.finished = true
      })
      const timer = setTimeout(
        () => {
          timers.delete(timer)
          if (limit) response.setHeader('X-Sentry-Rate-Limits', limit)
          if (code === 429) response.setHeader('Retry-After', '60')
          finish(code)
        },
        Math.min(1000, Math.max(0, wait)),
      )
      timers.add(timer)
    })
  })
  server.requestTimeout = 5000
  server.headersTimeout = 5000
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  const close = async () => {
    clearTimeout(lifetime)
    for (const timer of timers) clearTimeout(timer)
    server.closeAllConnections()
    await new Promise((resolve) => server.close(resolve))
  }
  const lifetime = setTimeout(() => {
    expired = true
    void close()
  }, 480_000)
  lifetime.unref()
  return {
    url: `http://127.0.0.1:${server.address().port}/api/1/envelope/`,
    records,
    rejections,
    get expired() {
      return expired
    },
    policy,
    close,
  }
}
