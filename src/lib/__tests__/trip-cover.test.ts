import { describe, expect, it } from 'vitest'

import {
  COVER_ACCEPT,
  coverUrlFor,
  fileIdOfStorageKey,
  isCoverContentType,
  tripStoragePrefix,
} from '../trip-cover'

describe('isCoverContentType', () => {
  it.each(['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif'])(
    'accepts %s',
    (type) => {
      expect(isCoverContentType(type)).toBe(true)
    },
  )

  it('is case and parameter insensitive', () => {
    expect(isCoverContentType('IMAGE/PNG; charset=binary')).toBe(true)
  })

  it.each([
    'image/svg+xml',
    'image/heic',
    'image/heif',
    'application/pdf',
    '',
    null,
    undefined,
  ])('refuses %s', (type) => {
    expect(isCoverContentType(type)).toBe(false)
  })

  it('offers the picker the same five types and never SVG or HEIC', () => {
    expect(COVER_ACCEPT.split(',')).toHaveLength(5)
    expect(COVER_ACCEPT).not.toMatch(/svg|heic|heif/u)
  })
})

describe('coverUrlFor', () => {
  it('builds the URL from the origin, the trip and the file id', () => {
    expect(coverUrlFor('https://planned.travel', 'trip1', 'file1')).toBe(
      'https://planned.travel/api/trips/trip1/cover?v=file1',
    )
  })

  it('drops a trailing slash on the origin and escapes the ids', () => {
    expect(coverUrlFor('https://planned.travel/', 'a/b', 'c d')).toBe(
      'https://planned.travel/api/trips/a%2Fb/cover?v=c%20d',
    )
  })
})

describe('fileIdOfStorageKey', () => {
  const id = 'abcdefghi0123456789ABCDEF'

  it('takes the fixed-length id even when it contains a dash', () => {
    const dashed = `abcdefghi0123-56789ABCDEF`
    expect(fileIdOfStorageKey(`trips/o/t/${dashed}-photo-1.jpg`)).toBe(dashed)
    expect(fileIdOfStorageKey(`trips/o/t/${id}-photo.jpg`)).toBe(id)
  })

  it('falls back to the text before the first dash for a shorter id', () => {
    expect(fileIdOfStorageKey('trips/o/t/cover1-gone.jpg')).toBe('cover1')
  })

  it('returns null for a key of another shape', () => {
    expect(fileIdOfStorageKey('cover.jpg')).toBeNull()
    expect(fileIdOfStorageKey('trips/o/t/nodash.jpg')).toBeNull()
  })
})

describe('tripStoragePrefix', () => {
  it('names the trip namespace inside the workspace', () => {
    expect(tripStoragePrefix('org', 'trip')).toBe('trips/org/trip/')
  })
})
