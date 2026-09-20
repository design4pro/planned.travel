import { describe, expect, it } from 'vitest'

import { formatCoordinate, parsePosition } from '../position'

/**
 * The parser behind "paste a position" (stage `02-S5`).
 *
 * Its whole value is refusing to guess: a silent swap or a misread hemisphere is a
 * wrong answer that looks right, so every refusal the spec names has a case here,
 * next to the notations that must read.
 */

const FUSHIMI = { lat: 34.9671, lng: 135.7727 }
const OPERA_HOUSE = { lat: -33.8568, lng: -151.2153 }

describe('parsePosition — the four notations', () => {
  it.each([
    '34.9671, 135.7727',
    '34.9671,135.7727',
    '34.9671 135.7727',
    '  34.9671,\n135.7727  ',
    '+34.9671, +135.7727',
  ])('reads the decimal pair %j', (text) => {
    expect(parsePosition(text)).toEqual(FUSHIMI)
  })

  it.each([
    '34.9671 N, 135.7727 E',
    'N34.9671 E135.7727',
    '34.9671°N 135.7727°E',
    '34.9671n,135.7727e',
    'n 34.9671, e 135.7727',
  ])('reads the hemisphere-lettered pair %j', (text) => {
    expect(parsePosition(text)).toEqual(FUSHIMI)
  })

  it.each([
    'geo:34.9671,135.7727',
    'GEO:34.9671,135.7727,12;u=35',
    'geo:34.9671,135.7727;crs=wgs84',
    'geo:34.9671,135.7727;crs=WGS84;u=10',
  ])('reads the geo: URI %j', (text) => {
    expect(parsePosition(text)).toEqual(FUSHIMI)
  })

  it('converts degrees-minutes-seconds and rounds to six decimals', () => {
    expect(parsePosition(`34°58'01.6"N 135°46'21.7"E`)).toEqual({
      lat: 34.967111,
      lng: 135.772694,
    })
    expect(parsePosition('34° 58′ 1.6″ N, 135° 46′ 21.7″ E')).toEqual({
      lat: 34.967111,
      lng: 135.772694,
    })
  })

  it('reads degrees and decimal minutes without seconds', () => {
    expect(parsePosition(`34°58.027'N 135°46.362'E`)).toEqual({
      lat: 34.967117,
      lng: 135.7727,
    })
  })

  it('lands every notation of one place within 1e-4 of the decimal pair', () => {
    for (const text of [
      `34°58'01.6"N 135°46'21.7"E`,
      `34°58.027'N 135°46.362'E`,
      'geo:34.9671,135.7727',
      '34.9671 N, 135.7727 E',
    ]) {
      const position = parsePosition(text)
      expect(position?.lat).toBeCloseTo(FUSHIMI.lat, 4)
      expect(position?.lng).toBeCloseTo(FUSHIMI.lng, 4)
    }
  })

  it.each([
    '-33.8568, -151.2153',
    '33.8568 S, 151.2153 W',
    'S33.8568 W151.2153',
    `33°51'24.48"S 151°12'55.08"W`,
    'geo:-33.8568,-151.2153',
  ])('reads the south-west position %j', (text) => {
    expect(parsePosition(text)).toEqual(OPERA_HOUSE)
  })
})

describe('parsePosition — hemisphere letters', () => {
  it('lets a letter flip the sign', () => {
    expect(parsePosition('51.5 S, 0.12 W')).toEqual({ lat: -51.5, lng: -0.12 })
  })

  it.each(['-51.5 N, 0.12 E', '-51.5 S, 0.12 W', '51.5 N, -0.12 W'])(
    'refuses a sign and a letter together: %j',
    (text) => {
      expect(parsePosition(text)).toBeNull()
    },
  )

  it('refuses letters on one half only', () => {
    expect(parsePosition('51.5 N, 0.12')).toBeNull()
    expect(parsePosition('51.5, 0.12 E')).toBeNull()
  })
})

describe('parsePosition — ranges', () => {
  it('refuses a latitude past 90 and a longitude past 180', () => {
    expect(parsePosition('90.0001, 0')).toBeNull()
    expect(parsePosition('0, 180.0001')).toBeNull()
    expect(parsePosition('90.0001 N, 0 E')).toBeNull()
    expect(parsePosition('geo:0,180.0001')).toBeNull()
  })

  it('accepts the bounds themselves', () => {
    expect(parsePosition('90, 180')).toEqual({ lat: 90, lng: 180 })
    expect(parsePosition('-90, -180')).toEqual({ lat: -90, lng: -180 })
  })

  it.each([
    `34°60'00"N 135°46'21.7"E`,
    `34°58'60"N 135°46'21.7"E`,
    `34.5°58'N 135°46'E`,
    `34°58.5'30"N 135°46'21.7"E`,
    `90°30'N 0°0'E`,
  ])('refuses the impossible DMS %j', (text) => {
    expect(parsePosition(text)).toBeNull()
  })
})

describe('parsePosition — never swaps', () => {
  it('refuses a pair whose first half is out of latitude range', () => {
    expect(parsePosition('151.2153, -33.8568')).toBeNull()
  })

  it('reads a pair valid both ways as written', () => {
    expect(parsePosition('-60, 70')).toEqual({ lat: -60, lng: 70 })
  })

  it('refuses a lettered pair that arrives longitude-first', () => {
    expect(parsePosition('135.7727 E, 34.9671 N')).toBeNull()
  })
})

describe('parsePosition — geo: URIs', () => {
  it('refuses a query, which is where Android hides the real position', () => {
    expect(parsePosition('geo:0,0?q=34.96,135.77(Fushimi Inari)')).toBeNull()
  })

  it('refuses a coordinate reference system other than WGS 84', () => {
    expect(parsePosition('geo:34.9671,135.7727;crs=nad27')).toBeNull()
  })

  it('refuses a malformed path', () => {
    expect(parsePosition('geo:34.9671')).toBeNull()
    expect(parsePosition('geo:34.9671,135.7727,1,2')).toBeNull()
    expect(parsePosition('geo:34.9671,135.7727;')).toBeNull()
  })
})

describe('parsePosition — everything else', () => {
  it.each([
    'Meet at 12, 30 people',
    '',
    '   ',
    '34.9671',
    '34,9671 135,7727',
    '34.9671, 135.7727, 12',
    'https://maps.google.com/?q=34.9671,135.7727',
  ])('refuses %j', (text) => {
    expect(parsePosition(text)).toBeNull()
  })

  it('refuses a 100,000-character paste inside the default timeout', () => {
    expect(parsePosition('1'.repeat(100_000))).toBeNull()
    expect(parsePosition('1, '.repeat(33_334))).toBeNull()
  })

  it.each([
    '1'.repeat(250) + ',x',
    `N${'1'.repeat(250)}x`,
    `34°${' '.repeat(250)}x`,
    `geo:${'1'.repeat(250)};`,
    `34.${'1'.repeat(248)} x`,
    `34 ${' '.repeat(248)}N x`,
  ])('refuses a near-cap pathological string in linear time (%#)', (text) => {
    expect(text.length).toBeLessThanOrEqual(256)
    const started = performance.now()
    expect(parsePosition(text)).toBeNull()
    expect(performance.now() - started).toBeLessThan(50)
  })
})

describe('formatCoordinate', () => {
  it('keeps at most six decimals and drops trailing zeros', () => {
    expect(formatCoordinate(34.96711111)).toBe('34.967111')
    expect(formatCoordinate(34.9671)).toBe('34.9671')
    expect(formatCoordinate(135.5)).toBe('135.5')
    expect(formatCoordinate(100)).toBe('100')
    expect(formatCoordinate(-33.8568)).toBe('-33.8568')
  })

  it('writes negative zero as 0', () => {
    expect(formatCoordinate(-0)).toBe('0')
    expect(formatCoordinate(-0.0000001)).toBe('0')
  })

  it('never uses exponent notation', () => {
    expect(formatCoordinate(1e-7)).toBe('0')
    expect(formatCoordinate(0.000001)).toBe('0.000001')
  })

  it('writes a string that Number() reads back as the rounded value', () => {
    expect(Number(formatCoordinate(135.7726944))).toBe(135.772694)
  })
})
