import { describe, expect, it } from 'vitest'
import { verifyRelease } from '../release-smoke.mjs'

const sha = 'a'.repeat(40)

describe('release health receipt', () => {
  it('binds the version, landing and tile checks to the expected SHA', async () => {
    const calls = []
    const receipt = await verifyRelease({
      url: 'https://staging.planned.travel',
      expectedSha: sha,
      headers: { authorization: 'test' },
      fetcher: async (url, options) => {
        calls.push({ url, options })
        return url.endsWith('/api/version')
          ? { status: 200, json: async () => ({ sha, id: 'worker-1' }) }
          : { status: url.endsWith('.pmtiles') ? 206 : 200 }
      },
    })

    expect(receipt).toMatchObject({ sha, version: 'worker-1', smoke: true })
    expect(calls.map(({ url }) => new URL(url).pathname)).toEqual([
      '/api/version',
      '/',
      '/api/tiles/basemap.pmtiles',
    ])
    expect(calls[2].options.headers).toMatchObject({
      authorization: 'test',
      Range: 'bytes=0-15',
    })
  })

  it('rejects the wrong deployed SHA and an unhealthy tile endpoint', async () => {
    const fetcher = async (url) =>
      url.endsWith('/api/version')
        ? {
            status: 200,
            json: async () => ({ sha: 'b'.repeat(40), id: 'worker-1' }),
          }
        : { status: 200 }
    await expect(
      verifyRelease({
        url: 'https://planned.travel',
        expectedSha: sha,
        fetcher,
      }),
    ).rejects.toThrow('Wrong deployed SHA')

    await expect(
      verifyRelease({
        url: 'https://planned.travel',
        expectedSha: sha,
        fetcher: async (url) =>
          url.endsWith('/api/version')
            ? { status: 200, json: async () => ({ sha, id: 'worker-1' }) }
            : { status: 200 },
      }),
    ).rejects.toThrow('Tile range unavailable')
  })
})
