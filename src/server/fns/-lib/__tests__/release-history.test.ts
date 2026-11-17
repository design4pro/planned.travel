import { expect, it } from 'vitest'
import {
  releaseHistoryInput,
  encodeReleaseCursor,
  decodeReleaseCursor,
} from '../release-history'

it('validates only the read projection selectors and uses a bounded opaque cursor', () => {
  expect(releaseHistoryInput.parse({ locale: 'pl' })).toEqual({
    locale: 'pl',
    limit: 20,
  })
  const cursor = { shippedAt: 1000, version: '1.2.3' }
  expect(decodeReleaseCursor(encodeReleaseCursor(cursor))).toEqual(cursor)
  for (const value of ['', 'invalid', 'a'.repeat(513)]) {
    expect(() =>
      releaseHistoryInput.parse({ locale: 'en', cursor: value }),
    ).toThrow()
  }
  for (const selector of [
    'organizationId',
    'role',
    'collection',
    'status',
    'published',
    'target',
  ]) {
    expect(() =>
      releaseHistoryInput.parse({ locale: 'en', [selector]: 'production' }),
    ).toThrow()
  }
  for (const data of [
    { locale: 'unknown' },
    { locale: 'en', limit: 0 },
    { locale: 'en', limit: 51 },
  ]) {
    expect(() => releaseHistoryInput.parse(data)).toThrow()
  }
})
