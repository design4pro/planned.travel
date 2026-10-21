import { describe, expect, it } from 'vitest'

import { LOCALE_TAGS } from '../locales'
import { negotiate } from '../negotiate'
import { parseVisitorLocaleCookie } from '../visitor-locale'

describe('visitor language cookie', () => {
  it.each(LOCALE_TAGS)('reads %s among unrelated cookies', (tag) => {
    expect(
      parseVisitorLocaleCookie(`other=x; planned.locale=${tag}; last=y`),
    ).toBe(tag)
  })

  it.each([
    null,
    '',
    'other=pl',
    'planned.locale=',
    'planned.locale=is',
    'planned.locale=constructor',
    'planned.locale=__proto__',
    `planned.locale=pl-${'x'.repeat(16)}`,
    'planned.locale=pl; planned.locale=de',
    'planned.locale=bad; planned.locale=pl',
    'planned.locale=pl; planned.locale=',
    'planned.locale=%70%6c',
    `planned.locale=${' '.repeat(17)}pl`,
  ])('ignores absent or hostile input %s', (header) => {
    expect(parseVisitorLocaleCookie(header)).toBeNull()
  })

  it('canonicalises short stored tags through the shared resolver', () => {
    expect(parseVisitorLocaleCookie('planned.locale=PL-pl')).toBe('pl')
    expect(parseVisitorLocaleCookie('planned.locale=zh-TW')).toBe('zh-Hant')
  })
})

describe('visitor step in negotiation', () => {
  it('orders user, workspace, visitor, header, English', () => {
    expect(
      negotiate({
        user: 'ja',
        workspace: 'sv',
        visitor: 'pl',
        acceptLanguage: 'de',
      }),
    ).toBe('ja')
    expect(
      negotiate({
        user: 'bad',
        workspace: 'sv',
        visitor: 'pl',
        acceptLanguage: 'de',
      }),
    ).toBe('sv')
    expect(
      negotiate({ workspace: 'bad', visitor: 'pl', acceptLanguage: 'de' }),
    ).toBe('pl')
    expect(negotiate({ visitor: 'bad', acceptLanguage: 'de' })).toBe('de')
    expect(negotiate({ visitor: 'bad', acceptLanguage: 'is' })).toBe('en')
  })
})
