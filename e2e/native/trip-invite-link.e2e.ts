import { randomInt } from 'node:crypto'
import { describe, expect, test } from 'e2e'

// Distinct benchmark-range addresses keep each rate-limit probe isolated.
function ownAddress() {
  return {
    'cf-connecting-ip': `198.18.${randomInt(0, 256)}.${randomInt(1, 255)}`,
  }
}

describe('a trip invite link that does not work', () => {
  test('returns 404 without caching, referring or indexing its secret', async ({
    app,
  }) => {
    const response = await fetch(
      `${app.baseUrl}/join/not-a-link-anyone-minted`,
      { headers: ownAddress(), redirect: 'manual' },
    )
    const html = await response.text()

    expect(response.status).toBe(404)
    expect(response.headers.get('cache-control')).toContain('no-store')
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow')
    expect(html).toContain('<meta name="robots" content="noindex, nofollow"')
  })

  test('rate-limits repeated misses without caching or indexing the refusal', async ({
    app,
  }) => {
    const headers = ownAddress()
    let refused: Response | undefined
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const response = await fetch(
        `${app.baseUrl}/join/no-such-link-${attempt}`,
        { headers, redirect: 'manual' },
      )
      // Consume each response so the HTTP connection can be reused.
      await response.arrayBuffer()
      if (response.status === 429) {
        refused = response
        break
      }
    }

    expect(refused?.status).toBe(429)
    expect(Number(refused?.headers.get('retry-after'))).toBeGreaterThan(0)
    expect(refused?.headers.get('cache-control')).toContain('no-store')
    expect(refused?.headers.get('x-robots-tag')).toBe('noindex, nofollow')
  })
})
