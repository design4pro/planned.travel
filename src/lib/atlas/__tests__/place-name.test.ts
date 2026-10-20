import { describe, expect, it } from 'vitest'
import { foldPlaceName, placeNameSchema } from '../place-name'

describe('region names', () => {
  it('shares one identity across case, compatibility forms, whitespace and Latin diacritics', () => {
    expect(foldPlaceName(' São  Paulo ')).toBe('sao paulo')
    expect(foldPlaceName('ＳＡＯ\tPaulo\n')).toBe('sao paulo')
    expect(foldPlaceName('İ')).toBe('i')
    expect(placeNameSchema(120).parse(' Bavaria  Upper ')).toBe('Bavaria Upper')
  })
  it.each([
    '\u200b',
    '\u2060',
    '\ufeff',
    '\u00ad',
    '\u202e',
    '\u0000',
    '\ue000',
    '\ud800',
  ])('rejects hidden characters %j before trimming', (character) => {
    expect(placeNameSchema(120).safeParse(`${character}Bavaria`).success).toBe(
      false,
    )
  })
  it('keeps meaningful Indic and Persian marks and joiners', () => {
    expect(foldPlaceName('कान')).not.toBe(foldPlaceName('कन'))
    expect(placeNameSchema(120).parse('نیم\u200cروز')).toContain('\u200c')
    expect(placeNameSchema(120).parse('क्\u200dष')).toContain('\u200d')
  })
  it('bounds the normalized display name and rejects empty names', () => {
    expect(placeNameSchema(120).safeParse('  ').success).toBe(false)
    expect(placeNameSchema(120).safeParse('\ufdfa'.repeat(8)).success).toBe(
      false,
    )
  })
})
