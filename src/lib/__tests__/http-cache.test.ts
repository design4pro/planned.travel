/**
 * The one reading of a response's caching headers.
 *
 * HERE Platform Terms, Exhibit 2 §1.3 permits caching "only as explicitly allowed by the caching
 * headers (HTTP/1.1 standard)". Every outbound proxy that stores a HERE answer asks this function
 * how long, so the rule is pinned here once, as fixtures, instead of once per proxy.
 */
import { describe, expect, it } from 'vitest'

import {
  KV_MIN_TTL_SECONDS,
  cachingHeadersOf,
  storableLifetimeSeconds,
} from '../http-cache'

import type { CachingHeaders } from '../http-cache'

const NOW = 'Thu, 01 Oct 2026 10:00:00 GMT'

function headers(overrides: Partial<CachingHeaders> = {}): CachingHeaders {
  return {
    cacheControl: null,
    expires: null,
    date: NOW,
    age: null,
    ...overrides,
  }
}

describe('cachingHeadersOf', () => {
  it('reads the four headers that decide storage, and nothing else', () => {
    const read = cachingHeadersOf(
      new Headers({
        'cache-control': 'public, max-age=300',
        expires: 'Thu, 01 Oct 2026 10:05:00 GMT',
        date: NOW,
        age: '12',
        'set-cookie': 'a=b',
      }),
    )
    expect(read).toEqual({
      cacheControl: 'public, max-age=300',
      expires: 'Thu, 01 Oct 2026 10:05:00 GMT',
      date: NOW,
      age: '12',
    })
  })

  it('reads an absent header as null', () => {
    expect(cachingHeadersOf(new Headers())).toEqual({
      cacheControl: null,
      expires: null,
      date: null,
      age: null,
    })
  })
})

describe('storableLifetimeSeconds', () => {
  it('takes the lifetime from max-age', () => {
    expect(
      storableLifetimeSeconds(headers({ cacheControl: 'public, max-age=300' })),
    ).toBe(300)
  })

  it('prefers s-maxage to max-age, because this proxy is a shared cache', () => {
    expect(
      storableLifetimeSeconds(
        headers({ cacheControl: 'max-age=900, s-maxage=120' }),
      ),
    ).toBe(120)
  })

  it('reads directives case-insensitively and ignores spacing', () => {
    expect(
      storableLifetimeSeconds(
        headers({ cacheControl: ' Public ,  MAX-AGE=600 ' }),
      ),
    ).toBe(600)
  })

  it('takes Expires minus Date when no max-age is stated', () => {
    expect(
      storableLifetimeSeconds(
        headers({ expires: 'Thu, 01 Oct 2026 10:10:00 GMT' }),
      ),
    ).toBe(600)
  })

  it('prefers max-age to Expires', () => {
    expect(
      storableLifetimeSeconds(
        headers({
          cacheControl: 'max-age=200',
          expires: 'Thu, 01 Oct 2026 12:00:00 GMT',
        }),
      ),
    ).toBe(200)
  })

  it('subtracts the Age a cache in front of us already used up', () => {
    expect(
      storableLifetimeSeconds(
        headers({ cacheControl: 'max-age=300', age: '100' }),
      ),
    ).toBe(200)
    expect(
      storableLifetimeSeconds(
        headers({ expires: 'Thu, 01 Oct 2026 10:10:00 GMT', age: '100' }),
      ),
    ).toBe(500)
  })

  it.each(['no-store', 'no-cache', 'private'])(
    'is not storable under %s, whatever freshness is also stated',
    (directive) => {
      expect(
        storableLifetimeSeconds(
          headers({ cacheControl: `${directive}, max-age=3600` }),
        ),
      ).toBeNull()
    },
  )

  it('treats a directive that names fields as the whole directive', () => {
    expect(
      storableLifetimeSeconds(
        headers({ cacheControl: 'private="set-cookie", max-age=3600' }),
      ),
    ).toBeNull()
    expect(
      storableLifetimeSeconds(
        headers({ cacheControl: 'no-cache="x-a", max-age=3600' }),
      ),
    ).toBeNull()
  })

  it('is not storable without an explicit freshness lifetime', () => {
    expect(storableLifetimeSeconds(headers())).toBeNull()
    expect(
      storableLifetimeSeconds(headers({ cacheControl: 'public' })),
    ).toBeNull()
  })

  it('does not guess a lifetime from Expires when the response has no Date', () => {
    expect(
      storableLifetimeSeconds(
        headers({ date: null, expires: 'Thu, 01 Oct 2026 12:00:00 GMT' }),
      ),
    ).toBeNull()
  })

  it('reads an Expires that is not a date, or is already past, as stale', () => {
    expect(storableLifetimeSeconds(headers({ expires: '0' }))).toBeNull()
    expect(
      storableLifetimeSeconds(
        headers({ expires: 'Thu, 01 Oct 2026 09:00:00 GMT' }),
      ),
    ).toBeNull()
  })

  it('is not storable when the stated freshness is not a number', () => {
    expect(
      storableLifetimeSeconds(headers({ cacheControl: 'max-age=abc' })),
    ).toBeNull()
    expect(
      storableLifetimeSeconds(headers({ cacheControl: 'max-age=-5' })),
    ).toBeNull()
    expect(
      storableLifetimeSeconds(
        headers({ cacheControl: 'max-age=300', age: 'x' }),
      ),
    ).toBeNull()
  })

  it('is not storable when Age has used the lifetime up', () => {
    expect(
      storableLifetimeSeconds(
        headers({ cacheControl: 'max-age=300', age: '300' }),
      ),
    ).toBeNull()
  })

  it('is not storable below the 60 seconds KV will hold an entry for', () => {
    expect(KV_MIN_TTL_SECONDS).toBe(60)
    expect(
      storableLifetimeSeconds(headers({ cacheControl: 'max-age=59' })),
    ).toBeNull()
    expect(
      storableLifetimeSeconds(headers({ cacheControl: 'max-age=60' })),
    ).toBe(60)
  })
})
