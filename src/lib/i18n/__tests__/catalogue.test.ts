import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from 'vitest'

import { LOCALE_TAGS } from '../locales'

import type { MessageKey, TranslateArgs } from '../types'

describe('the catalogue loader', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    for (const tag of LOCALE_TAGS) {
      vi.doUnmock(`../messages/${tag}`)
    }
    vi.resetModules()
  })

  it('offers one literal importer per shipped locale', async () => {
    const { CATALOGUE_LOADERS } = await import('../catalogue')
    expect(Object.keys(CATALOGUE_LOADERS).sort()).toEqual(
      [...LOCALE_TAGS].sort(),
    )
    for (const tag of LOCALE_TAGS) {
      expect(typeof CATALOGUE_LOADERS[tag]).toBe('function')
    }
  })

  /**
   * The point of the thunks. If the map held modules instead of importers, a
   * cold isolate would compile all twenty-three catalogues to render one, and
   * the SSR bundle would pay for twenty-two languages nobody asked for.
   *
   * Every catalogue is mocked with a factory that records its own evaluation,
   * so "the other twenty-two were not evaluated" is measured rather than
   * assumed.
   */
  it('evaluates the requested locale and no other', async () => {
    const evaluated: Array<string> = []
    for (const tag of LOCALE_TAGS) {
      vi.doMock(`../messages/${tag}`, () => {
        evaluated.push(tag)
        return { messages: { 'language.label': `label:${tag}` } }
      })
    }

    const { loadCatalogue } = await import('../catalogue')
    expect(evaluated).toEqual([])

    await loadCatalogue('pl')
    expect(evaluated).toEqual(['pl'])

    await loadCatalogue('ar')
    expect(evaluated).toEqual(['pl', 'ar'])
  })

  it('evaluates a locale once, however many callers ask for it', async () => {
    const evaluated: Array<string> = []
    for (const tag of LOCALE_TAGS) {
      vi.doMock(`../messages/${tag}`, () => {
        evaluated.push(tag)
        return { messages: { 'language.label': `label:${tag}` } }
      })
    }

    const { loadCatalogue, peekCatalogue } = await import('../catalogue')
    const [first, second] = await Promise.all([
      loadCatalogue('de'),
      loadCatalogue('de'),
    ])

    expect(evaluated).toEqual(['de'])
    expect(first).toBe(second)
    expect(peekCatalogue('de')).toBe(first)
    expect(peekCatalogue('sv')).toBeUndefined()
  })

  it('loads the real messages for a locale', async () => {
    const { loadCatalogue } = await import('../catalogue')
    const messages = await loadCatalogue('pl')
    expect(messages['language.label']).toBe('Język')
  })
})

describe('the translator', () => {
  it('renders a key with no parameters', async () => {
    const { createTranslator } = await import('../catalogue')
    const { messages } = await import('../messages/en')
    const t = createTranslator('en', messages)
    expect(t('language.label')).toBe('Language')
  })

  it('substitutes the parameters the key declares', async () => {
    const { createTranslator } = await import('../catalogue')
    const { messages } = await import('../messages/pl')
    const t = createTranslator('pl', messages)
    expect(t('language.current', { name: 'Polski' })).toBe(
      'Bieżący język: Polski',
    )
  })

  it('renders each locale in its own language, never English', async () => {
    const { createTranslator, loadCatalogue } = await import('../catalogue')
    for (const tag of LOCALE_TAGS) {
      const messages = await loadCatalogue(tag)
      const t = createTranslator(tag, messages)
      const label = t('language.label')
      expect(label.length).toBeGreaterThan(0)
      if (tag !== 'en') {
        expect(label).not.toBe('Language')
      }
    }
  })
})

/**
 * `docs/SPEC.md` §8.2 wants a missing key to be a compile error rather than a
 * runtime fallback to English. These assertions are erased at run time and
 * checked by `tsc --noEmit`, which is where that guarantee actually lives.
 */
describe('the key type', () => {
  it('is the English catalogue and nothing wider', () => {
    expectTypeOf<MessageKey>().toEqualTypeOf<
      'language.current' | 'language.description' | 'language.label'
    >()
  })

  it('demands the parameters a message declares, and only those', () => {
    expectTypeOf<TranslateArgs<'language.label'>>().toEqualTypeOf<[]>()
    expectTypeOf<TranslateArgs<'language.current'>>().toEqualTypeOf<
      [params: { readonly name: string | number }]
    >()
  })
})
