import { describe, expect, it } from 'vitest'

import { COUNTRY_NAMES } from '../country-names'
import { CONTINENTS, COUNTRY_CONTINENTS, continentOf } from '../continents'

import type { Continent } from '../continents'

const CODES = Object.keys(COUNTRY_NAMES)

describe('the continent table', () => {
  it('files every country the atlas can name', () => {
    const unfiled = CODES.filter(
      (code) => COUNTRY_CONTINENTS[code] === undefined,
    )
    expect(unfiled).toEqual([])
    // Guards the assertion above against a table that empties itself.
    expect(CODES.length).toBeGreaterThan(240)
  })

  it('files nothing the atlas cannot name', () => {
    const orphans = Object.keys(COUNTRY_CONTINENTS).filter(
      (code) => COUNTRY_NAMES[code] === undefined,
    )
    expect(orphans).toEqual([])
  })

  it('uses one spelling per continent and only the ones the panel knows', () => {
    const used = new Set(Object.values(COUNTRY_CONTINENTS))
    expect([...used].sort()).toEqual([...CONTINENTS].sort())
  })

  it('is keyed by upper-case alpha-2 codes and sorted by code', () => {
    const keys = Object.keys(COUNTRY_CONTINENTS)
    for (const key of keys) {
      expect(key).toMatch(/^[A-Z]{2}$/)
    }
    expect(keys).toEqual([...keys].sort())
  })

  it('is frozen, so no caller can teach it a seventh spelling of Europe', () => {
    expect(Object.isFrozen(COUNTRY_CONTINENTS)).toBe(true)
  })
})

describe('continentOf', () => {
  it('answers for every named country, and never with an empty string', () => {
    for (const code of CODES) {
      const answer = continentOf(code)
      expect(answer).not.toBeNull()
      // The roll-up groups on this value: `''` would render as a nameless
      // seventh continent cell with a real count in it.
      expect(answer).not.toBe('')
      expect(CONTINENTS).toContain(answer as Continent)
    }
  })

  it('normalises case and surrounding space', () => {
    expect(continentOf('jp')).toBe('Asia')
    expect(continentOf(' Fr ')).toBe('Europe')
    expect(continentOf('Br')).toBe('South America')
  })

  it('returns null rather than a group name for anything it does not know', () => {
    expect(continentOf('ZZ')).toBeNull()
    expect(continentOf('')).toBeNull()
    expect(continentOf('   ')).toBeNull()
    expect(continentOf('EU')).toBeNull()
  })

  it('puts the transcontinental cases where UN M49 puts them', () => {
    expect(continentOf('RU')).toBe('Europe')
    expect(continentOf('TR')).toBe('Asia')
    expect(continentOf('CY')).toBe('Asia')
    expect(continentOf('GE')).toBe('Asia')
    expect(continentOf('AZ')).toBe('Asia')
    expect(continentOf('KZ')).toBe('Asia')
  })

  it('files the polar dependencies as Antarctica rather than with their sovereign', () => {
    for (const code of ['AQ', 'BV', 'GS', 'HM', 'TF']) {
      expect(continentOf(code)).toBe('Antarctica')
    }
  })

  it('files overseas territories with the landmass they sit on', () => {
    expect(continentOf('GF')).toBe('South America')
    expect(continentOf('RE')).toBe('Africa')
    expect(continentOf('YT')).toBe('Africa')
    expect(continentOf('GP')).toBe('North America')
    expect(continentOf('PF')).toBe('Oceania')
    expect(continentOf('GL')).toBe('North America')
    expect(continentOf('HK')).toBe('Asia')
  })
})
