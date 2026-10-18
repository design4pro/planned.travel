import { expect, test } from '@playwright/test'

/**
 * 07-S10d - what a browser, a proxy and a crawler actually receive for `/join/<secret>`.
 *
 * Only dead links are exercised here: no link can be minted until the owner's panel (07-S10b)
 * exists. The budget test spends the per-address miss budget on purpose, and only `/join/*` reads
 * it, so no other journey notices.
 */
/**
 * The handler keys its budgets on `cf-connecting-ip`, which a local server takes from the request,
 * so each test (and each browser project) spends a budget of its own instead of sharing one.
 */
function ownAddress(): { 'cf-connecting-ip': string } {
  const octet = () => Math.floor(Math.random() * 254) + 1
  return { 'cf-connecting-ip': `198.51.100.${octet()}` }
}

test.describe('07-S10d - a trip invite link that does not work', () => {
  test('answers 404 with the headers that keep the secret out of caches, referrers and indexes', async ({
    request,
  }) => {
    const response = await request.get('/join/not-a-link-anyone-minted', {
      headers: ownAddress(),
      maxRedirects: 0,
    })

    expect(response.status()).toBe(404)
    const headers = response.headers()
    expect(headers['cache-control']).toContain('no-store')
    expect(headers['referrer-policy']).toBe('no-referrer')
    expect(headers['x-robots-tag']).toBe('noindex, nofollow')

    const html = await response.text()
    expect(html).toContain('<meta name="robots" content="noindex, nofollow"')
  })

  test('turns a run of misses from one address into a 429 with Retry-After, still not cacheable or indexable', async ({
    request,
  }) => {
    // The miss budget is 20 a minute (docs/ACCESS.md §3.6); 30 attempts cross it with room to spare.
    const headersOut = ownAddress()
    let refused = null
    for (let attempt = 0; attempt < 30 && !refused; attempt += 1) {
      const response = await request.get(`/join/no-such-link-${attempt}`, {
        headers: headersOut,
        maxRedirects: 0,
      })
      if (response.status() === 429) refused = response
    }

    expect(refused).not.toBeNull()
    const headers = refused!.headers()
    expect(Number(headers['retry-after'])).toBeGreaterThan(0)
    expect(headers['cache-control']).toContain('no-store')
    expect(headers['x-robots-tag']).toBe('noindex, nofollow')
  })
})
