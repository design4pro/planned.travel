import { describe, expect, it, vi } from 'vitest'

import { BASEMAP_IDS } from '#/lib/map/basemap'
import {
  appearanceInput,
  regionalSettingsInput,
} from '../../../-server/settings'
import { languageSettingsFrom, regionalOverridesInput } from '../preferences'

import type { AuthSession } from '#/server/auth/session'

/**
 * The two narrowings `/settings` and `/settings/language` depend on.
 *
 * Both are claims about a *boundary*, so both are testable without a database:
 * what a payload is allowed to contain, and what a pair of rows resolves to.
 *
 * The two adapters below are replaced for the reason
 * `src/server/repos/__tests__/settings-locale.test.ts` replaces them: a schema
 * and a projection live beside their server function, and that module reaches a
 * Worker binding through `cloudflare:workers`, which does not resolve in this
 * project's Node environment. Neither adapter is under test here — the tenant
 * scope belongs to the handlers, and what is measured is what the handlers are
 * handed and what they are allowed to send.
 */
vi.mock('#/server/auth/session', () => ({
  getSession: async (): Promise<AuthSession | null> => null,
}))

vi.mock('#/routes/_app/-server/context', () => ({
  appScope: async (): Promise<never> => {
    throw new Error('appScope is not reachable from this test')
  },
}))

const ORGANIZATION = { locale: 'en', defaultCurrency: 'GBP' }

describe('the language screen reads two rows and resolves them', () => {
  it('answers the override, the workspace tag and the currency', () => {
    expect(
      languageSettingsFrom({ locale: 'pl', currency: 'PLN' }, ORGANIZATION),
    ).toEqual({ override: 'pl', workspace: 'en', currency: 'PLN' })
  })

  it('reads no override as following the workspace', () => {
    expect(
      languageSettingsFrom({ locale: null, currency: null }, ORGANIZATION),
    ).toEqual({ override: null, workspace: 'en', currency: 'GBP' })
  })

  it('canonicalises a region-tagged row the picker never wrote', () => {
    // `organization_settings.locale` defaulted to `en-GB` before the picker
    // existed, and free text was writable on both columns.
    const resolved = languageSettingsFrom(
      { locale: 'ja-JP', currency: null },
      { locale: 'en-GB', defaultCurrency: 'GBP' },
    )
    expect(resolved.override).toBe('ja')
    expect(resolved.workspace).toBe('en')
  })

  it('treats an unrenderable override as no override at all', () => {
    // A tag with no catalogue must not select a chip that does not exist, and
    // must not be offered back to the write as if it were a choice.
    const resolved = languageSettingsFrom(
      { locale: 'xx-YY', currency: null },
      ORGANIZATION,
    )
    expect(resolved.override).toBeNull()
  })

  it('falls back to the source locale when neither row resolves', () => {
    const resolved = languageSettingsFrom(
      { locale: null, currency: null },
      { locale: 'not-a-tag', defaultCurrency: 'USD' },
    )
    expect(resolved.workspace).toBe('en')
  })

  it('prefers the traveller’s currency over the workspace default', () => {
    expect(
      languageSettingsFrom({ locale: null, currency: 'JPY' }, ORGANIZATION)
        .currency,
    ).toBe('JPY')
  })
})

describe('the profile form cannot write the language column', () => {
  const submission = {
    timezone: 'Europe/Warsaw',
    currency: 'PLN',
    dateFormat: 'dd MMM yyyy',
    weekStartsOn: 1,
    distanceUnit: 'metric' as const,
  }

  it('carries the five regional overrides and nothing else', () => {
    expect(Object.keys(regionalOverridesInput.shape).sort()).toEqual([
      'currency',
      'dateFormat',
      'distanceUnit',
      'timezone',
      'weekStartsOn',
    ])
  })

  it('is the six-field input minus its locale', () => {
    // Stated against the wider schema rather than as a second list, so the two
    // cannot drift into disagreeing about what a regional field is.
    const wide = Object.keys(regionalSettingsInput.shape)
      .filter((field) => field !== 'locale')
      .sort()
    expect(Object.keys(regionalOverridesInput.shape).sort()).toEqual(wide)
    expect(wide).not.toContain('locale')
  })

  it('drops a locale a client sends anyway', () => {
    const parsed = regionalOverridesInput.parse({
      ...submission,
      locale: 'pl',
    })
    expect('locale' in parsed).toBe(false)
    expect(parsed).toEqual(submission)
  })

  it('still clears an override with the empty-string sentinel', () => {
    const parsed = regionalOverridesInput.parse({
      timezone: '',
      currency: '',
      dateFormat: '',
      weekStartsOn: null,
      distanceUnit: '',
    })
    expect(parsed.weekStartsOn).toBeNull()
    expect(parsed.distanceUnit).toBe('')
  })

  it('refuses a weekday outside the week and a unit it does not know', () => {
    expect(() =>
      regionalOverridesInput.parse({ ...submission, weekStartsOn: 7 }),
    ).toThrow()
    expect(() =>
      regionalOverridesInput.parse({ ...submission, distanceUnit: 'leagues' }),
    ).toThrow()
  })
})

describe('the appearance form cannot write a map style off the catalogue', () => {
  it('accepts every id the catalogue ships', () => {
    for (const id of BASEMAP_IDS) {
      expect(appearanceInput.parse({ mapStyle: id }).mapStyle).toBe(id)
    }
  })

  it('accepts the empty sentinel, which is what clears the column', () => {
    expect(appearanceInput.parse({ mapStyle: '' }).mapStyle).toBe('')
  })

  it('leaves the column alone when the patch does not mention it', () => {
    const parsed = appearanceInput.parse({ reduceMotion: true })
    expect(parsed.mapStyle).toBeUndefined()
    expect('mapStyle' in parsed).toBe(false)
  })

  it('refuses whitespace rather than reading it as the sentinel', () => {
    // A trim here would make `' '` parse to `''` and silently clear a member's
    // override. The accepted set has to be the catalogue plus the sentinel and
    // nothing between them.
    expect(() => appearanceInput.parse({ mapStyle: ' ' })).toThrow()
    expect(() =>
      appearanceInput.parse({ mapStyle: ' planned-dark ' }),
    ).toThrow()
  })

  it('refuses an id no map could resolve', () => {
    expect(() => appearanceInput.parse({ mapStyle: 'planned-neon' })).toThrow()
  })
})
