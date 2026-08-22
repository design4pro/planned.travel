import { describe, expect, it } from 'vitest'

import { LOCALE_TAGS } from '../locales'
import { negotiate, parseAcceptLanguage, resolveLocaleTag } from '../negotiate'

/**
 * Names that live on `Object.prototype` and therefore answer a plain object
 * index with something that is not a locale and is not `undefined` either. Any
 * of them can arrive as an `Accept-Language` entry, and any of them can be
 * written into `user_settings.locale` or `organization_settings.locale`.
 */
const PROTOTYPE_KEYS = [
  'constructor',
  '__proto__',
  'toString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
] as const

describe('normalising a stored tag', () => {
  it('accepts a canonical tag as it stands', () => {
    expect(resolveLocaleTag('pl')).toBe('pl')
    expect(resolveLocaleTag('pt-BR')).toBe('pt-BR')
    expect(resolveLocaleTag('zh-Hant')).toBe('zh-Hant')
  })

  it('is case-insensitive, because headers and databases are not tidy', () => {
    expect(resolveLocaleTag('PL')).toBe('pl')
    expect(resolveLocaleTag('pt-br')).toBe('pt-BR')
    expect(resolveLocaleTag('ZH-HANS')).toBe('zh-Hans')
  })

  it('truncates an off-spec region tag to the language we ship', () => {
    // `organization_settings.locale` still defaults to `en-GB` for every
    // workspace created before the picker existed.
    expect(resolveLocaleTag('en-GB')).toBe('en')
    expect(resolveLocaleTag('en-US')).toBe('en')
    expect(resolveLocaleTag('pl-PL')).toBe('pl')
    expect(resolveLocaleTag('de-AT')).toBe('de')
    expect(resolveLocaleTag('ar-EG')).toBe('ar')
    expect(resolveLocaleTag('es-419')).toBe('es')
  })

  it('keeps the script subtag when truncating Chinese', () => {
    expect(resolveLocaleTag('zh-Hant-TW')).toBe('zh-Hant')
    expect(resolveLocaleTag('zh-Hans-CN')).toBe('zh-Hans')
  })

  it('follows the explicit alias table where truncation cannot reach', () => {
    expect(resolveLocaleTag('pt-PT')).toBe('pt-BR')
    expect(resolveLocaleTag('pt')).toBe('pt-BR')
    expect(resolveLocaleTag('zh')).toBe('zh-Hans')
    expect(resolveLocaleTag('zh-TW')).toBe('zh-Hant')
    expect(resolveLocaleTag('zh-HK')).toBe('zh-Hant')
    expect(resolveLocaleTag('in-ID')).toBe('id')
  })

  it('refuses anything it cannot honestly serve', () => {
    expect(resolveLocaleTag('gr')).toBeNull()
    expect(resolveLocaleTag('br')).toBeNull()
    expect(resolveLocaleTag('nb-NO')).toBeNull()
    expect(resolveLocaleTag('klingon')).toBeNull()
    expect(resolveLocaleTag('*')).toBeNull()
    expect(resolveLocaleTag('')).toBeNull()
    expect(resolveLocaleTag('   ')).toBeNull()
    expect(resolveLocaleTag(null)).toBeNull()
    expect(resolveLocaleTag(undefined)).toBeNull()
  })

  it('does not mistake an inherited property name for a locale', () => {
    // The lookup tables are `Map`s precisely so this cannot happen. Indexed as
    // object literals they answered `constructor` with the `Object` constructor
    // and `__proto__` with `Object.prototype`, neither of which `?? null`
    // treats as a miss — so a header could make this function return a
    // function, and the settings columns could persist it.
    for (const key of PROTOTYPE_KEYS) {
      expect(resolveLocaleTag(key)).toBeNull()
      expect(resolveLocaleTag(`${key}-GB`)).toBeNull()
      expect(resolveLocaleTag(key.toUpperCase())).toBeNull()
    }
  })

  it('never returns anything but a shipped tag or null', () => {
    const probes = [
      ...PROTOTYPE_KEYS,
      'en-GB',
      'zh-Hant-TW',
      '-',
      '--',
      '-en',
      'en-',
      'en--GB',
      '   pl   ',
      'klingon',
    ]
    for (const probe of probes) {
      const resolved = resolveLocaleTag(probe)
      if (resolved !== null) {
        expect(LOCALE_TAGS).toContain(resolved)
      }
    }
  })

  it('refuses a tag longer than any real one, without walking it', () => {
    // Truncation drops one subtag per pass, so an unbounded tag turns one
    // request header into a measurable slice of the Worker's CPU budget. The
    // budget below is loose enough to survive a loaded machine and still two
    // orders of magnitude under the uncapped walk of an input this size.
    const started = performance.now()
    expect(resolveLocaleTag(`en${'-x'.repeat(100_000)}`)).toBeNull()
    expect(resolveLocaleTag('e'.repeat(200_000))).toBeNull()
    expect(performance.now() - started).toBeLessThan(500)
    // A tag at the bound is still normalised on its merits.
    expect(resolveLocaleTag(`en-${'a'.repeat(60)}`)).toBe('en')
  })
})

describe('parsing Accept-Language', () => {
  it('returns nothing for an absent or empty header', () => {
    expect(parseAcceptLanguage(null)).toEqual([])
    expect(parseAcceptLanguage(undefined)).toEqual([])
    expect(parseAcceptLanguage('')).toEqual([])
    expect(parseAcceptLanguage('   ')).toEqual([])
  })

  it('orders by q-value, best first', () => {
    expect(
      parseAcceptLanguage('fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7, *;q=0.5'),
    ).toEqual(['fr-CH', 'fr', 'en', 'de', '*'])
    expect(parseAcceptLanguage('en;q=0.2, pl;q=0.9, de;q=0.5')).toEqual([
      'pl',
      'de',
      'en',
    ])
  })

  it('keeps the sent order when quality ties', () => {
    expect(parseAcceptLanguage('sv, nl, da')).toEqual(['sv', 'nl', 'da'])
    expect(parseAcceptLanguage('sv;q=0.5, nl;q=0.5')).toEqual(['sv', 'nl'])
  })

  it('drops a tag the client explicitly refused', () => {
    expect(parseAcceptLanguage('de;q=0, pl;q=0.4')).toEqual(['pl'])
  })

  it('survives a malformed header', () => {
    expect(parseAcceptLanguage('pl;q=nonsense, de')).toEqual(['de'])
    expect(parseAcceptLanguage(',,, pl ,,')).toEqual(['pl'])
  })
})

describe('negotiating a locale', () => {
  it('prefers the traveller over the workspace over the header', () => {
    expect(
      negotiate({ user: 'pl', workspace: 'de', acceptLanguage: 'fr' }),
    ).toBe('pl')
  })

  it('falls to the workspace when the user has no override', () => {
    expect(
      negotiate({ user: null, workspace: 'de', acceptLanguage: 'fr' }),
    ).toBe('de')
    expect(negotiate({ workspace: 'de', acceptLanguage: 'fr' })).toBe('de')
  })

  it('normalises the workspace default rather than discarding it', () => {
    // Every existing row reads `en-GB`, which is not one of the twenty-three.
    expect(negotiate({ workspace: 'en-GB', acceptLanguage: 'fr' })).toBe('en')
  })

  it('falls to the header when a stored tag is unknown', () => {
    expect(
      negotiate({
        user: 'klingon',
        workspace: 'sindarin',
        acceptLanguage: 'sv',
      }),
    ).toBe('sv')
  })

  it('honours q-ordering when it reaches the header', () => {
    expect(
      negotiate({
        acceptLanguage: 'xx;q=1.0, cs-CZ;q=0.9, de-DE;q=0.95',
      }),
    ).toBe('de')
  })

  it('skips header tags it does not ship', () => {
    expect(negotiate({ acceptLanguage: 'nb-NO, da, uk-UA' })).toBe('uk')
  })

  it('ends at English, never at nothing', () => {
    expect(negotiate({})).toBe('en')
    expect(negotiate({ user: null, workspace: null, acceptLanguage: '' })).toBe(
      'en',
    )
    expect(negotiate({ acceptLanguage: 'nb, da, fi' })).toBe('en')
  })

  it('returns a shipped locale for a hostile input at every step', () => {
    // Each of the three inputs is attacker-influenced: the header directly, and
    // both settings columns through whatever wrote them. None may make this
    // function hand back a value the rest of the product cannot load a
    // catalogue for.
    for (const key of PROTOTYPE_KEYS) {
      expect(negotiate({ user: key })).toBe('en')
      expect(negotiate({ workspace: key })).toBe('en')
      expect(negotiate({ acceptLanguage: key })).toBe('en')
      expect(negotiate({ acceptLanguage: `${key};q=1.0, pl;q=0.5` })).toBe('pl')
      expect(LOCALE_TAGS).toContain(
        negotiate({ user: key, workspace: key, acceptLanguage: key }),
      )
    }
  })

  it('reads no ambient request state', () => {
    // The function is pure by construction; this pins it, because the moment it
    // reads `getRequest()` or `navigator` it stops working on one of the two
    // sides of the wire (`navigator.language` is hard-coded to `en` in workerd).
    const source = negotiate.toString()
    expect(source).not.toContain('navigator')
    expect(source).not.toContain('getRequest')
  })
})
