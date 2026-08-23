import { describe, expect, expectTypeOf, it } from 'vitest'

import {
  createCatalogueLoader,
  createStoredTranslator,
  createTranslator,
} from '../catalogue'
import { NAMESPACES } from '../types'

import type { NamespaceImporter, NamespaceModule } from '../catalogue'
import type { Catalogue, Namespace } from '../types'

/**
 * The loader is exercised against fixtures rather than against the shipped
 * catalogue, and that is not a shortcut. The nine content items own
 * `messages/en/<namespace>.ts` and the six translation items own
 * `messages/<tag>/`; none of those files exist while this module is being
 * built, so a test that read them would prove nothing today and would silently
 * change meaning every time one landed. What is actually this module's to
 * guarantee — that a locale's namespace files are merged under qualified keys,
 * that the other twenty-two locales are never evaluated, and that a locale is
 * evaluated once however many callers ask — is a property of the loader, and
 * fixtures measure it directly.
 */

function recordingModules(evaluated: Array<string>): {
  readonly modules: Readonly<Record<string, NamespaceImporter>>
  readonly paths: ReadonlyArray<string>
} {
  const paths = [
    './messages/ar/shell.ts',
    './messages/de/settings.ts',
    './messages/de/shell.ts',
    './messages/pl/settings.ts',
    './messages/pl/shell.ts',
    './messages/pl/ui.ts',
  ]
  const modules: Record<string, NamespaceImporter> = {}
  for (const path of paths) {
    modules[path] = (): Promise<NamespaceModule> => {
      evaluated.push(path)
      return Promise.resolve({ default: { 'a.key': path } })
    }
  }
  return { modules, paths }
}

describe('the catalogue loader', () => {
  it('merges a locale under keys qualified by their namespace', async () => {
    const { loadCatalogue } = createCatalogueLoader({
      './messages/pl/shell.ts': () =>
        Promise.resolve({ default: { 'nav.trips': 'Wyjazdy' } }),
      './messages/pl/settings.ts': () =>
        Promise.resolve({ default: { 'language.label': 'Język' } }),
    })

    expect(await loadCatalogue('pl')).toEqual({
      'shell.nav.trips': 'Wyjazdy',
      'settings.language.label': 'Język',
    })
  })

  /**
   * The point of the thunks. If the glob held modules instead of importers, a
   * cold isolate would compile every catalogue in the product to render one.
   * Each fixture records its own evaluation, so "the other locales were not
   * evaluated" is measured rather than assumed.
   */
  it('evaluates the requested locale and no other', async () => {
    const evaluated: Array<string> = []
    const { modules } = recordingModules(evaluated)
    const { loadCatalogue } = createCatalogueLoader(modules)

    expect(evaluated).toEqual([])

    await loadCatalogue('pl')
    expect([...evaluated].sort()).toEqual([
      './messages/pl/settings.ts',
      './messages/pl/shell.ts',
      './messages/pl/ui.ts',
    ])

    await loadCatalogue('ar')
    expect(evaluated).toContain('./messages/ar/shell.ts')
    expect(evaluated).not.toContain('./messages/de/shell.ts')
  })

  it('evaluates a locale once, however many callers ask for it', async () => {
    const evaluated: Array<string> = []
    const { modules } = recordingModules(evaluated)
    const { loadCatalogue, peekCatalogue } = createCatalogueLoader(modules)

    const [first, second] = await Promise.all([
      loadCatalogue('de'),
      loadCatalogue('de'),
    ])

    expect(evaluated).toHaveLength(2)
    expect(first).toBe(second)
    expect(peekCatalogue('de')).toBe(first)
    expect(peekCatalogue('ar')).toBeUndefined()

    const third = await loadCatalogue('de')
    expect(third).toBe(first)
    expect(evaluated).toHaveLength(2)
  })

  it('returns an empty catalogue for a locale whose files have not landed', async () => {
    // The catalogue grows monotonically as fifteen items write their
    // namespaces. A locale with nothing yet is a gap for the parity gate to
    // report, never a reason to fail a render.
    const { loadCatalogue } = createCatalogueLoader({})
    expect(await loadCatalogue('sv')).toEqual({})
  })

  it('reads the shipped glob lazily, one thunk per file', async () => {
    // The production loader is built over `import.meta.glob`, whose entries are
    // importers rather than modules; nothing is evaluated by importing it.
    const { loadCatalogue, peekCatalogue } = await import('../catalogue')
    expect(peekCatalogue('en')).toBeUndefined()
    const catalogue = await loadCatalogue('en')
    expect(typeof catalogue).toBe('object')
    expect(peekCatalogue('en')).toBe(catalogue)
  })
})

describe('the namespace list', () => {
  it('is exactly the ten namespaces the spec fixes, in its order', () => {
    expect(NAMESPACES).toEqual([
      'shell',
      'auth',
      'trips',
      'modules',
      'costs',
      'atlas',
      'journal',
      'marketing',
      'settings',
      'ui',
    ])
  })

  it('is the same ten the key type is derived from', () => {
    expectTypeOf<Namespace>().toEqualTypeOf<
      | 'shell'
      | 'auth'
      | 'trips'
      | 'modules'
      | 'costs'
      | 'atlas'
      | 'journal'
      | 'marketing'
      | 'settings'
      | 'ui'
    >()
  })
})

/**
 * `createTranslator` is `createStoredTranslator` plus a signature — it holds no
 * rendering logic of its own — so the rendering is measured here, on the
 * function whose keys are strings. `t()` itself cannot be called from a test at
 * all until an English namespace file exists: `MessageKey` is derived from
 * those ten files and is `never` while none of them have landed, which is
 * exactly the guarantee §8.2 asks for and is checked by `tsc`, not by vitest.
 */
describe('the renderer both translators share', () => {
  const catalogue: Catalogue = {
    'shell.nav.trips': 'Wyjazdy',
    'shell.greeting': 'Cześć, {name}',
    'shell.unread': {
      one: '{count} nieprzeczytana',
      few: '{count} nieprzeczytane',
      many: '{count} nieprzeczytanych',
      other: '{count} nieprzeczytanych',
    },
  }
  const render = createStoredTranslator('pl', catalogue)

  it('renders a key with no parameters', () => {
    expect(render('shell.nav.trips')).toBe('Wyjazdy')
  })

  it('substitutes the parameters a message declares', () => {
    expect(render('shell.greeting', { name: 'Ada' })).toBe('Cześć, Ada')
  })

  it('picks the plural branch the locale calls for', () => {
    expect(render('shell.unread', { count: 1 })).toBe('1 nieprzeczytana')
    expect(render('shell.unread', { count: 3 })).toBe('3 nieprzeczytane')
    expect(render('shell.unread', { count: 5 })).toBe('5 nieprzeczytanych')
  })

  it('answers null for a key the catalogue does not carry', () => {
    // A stored row written against a key that has since been deleted is a data
    // problem; the caller decides what to show, and it is never English.
    expect(render('shell.deleted.long.ago')).toBeNull()
  })

  it('binds the catalogue it was given, not a shared one', () => {
    expect(createStoredTranslator('de', {})('shell.nav.trips')).toBeNull()
    expect(createTranslator('pl', catalogue)).toBeTypeOf('function')
  })
})
