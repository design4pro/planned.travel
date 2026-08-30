import { describe, expect, it } from 'vitest'

import { NAMESPACES } from '../types'

import type { MessageKey, Namespace, TranslationOf } from '../types'

/**
 * The two things about `../types` that a screen depends on and no other test
 * covers: the eleven namespaces are the eleven `docs/SPEC.md` §9 fixes, and the key
 * union derived from the English files is *closed*.
 *
 * Closed is the whole point. §8.2 forbids a runtime fallback to English, which
 * only works if a key that nobody authored is rejected at compile time — so if
 * `MessageKey` ever widened to `string`, every guarantee in this directory
 * would evaporate silently and every existing test would still pass. The
 * assignments below are the check: each one is a type-level proposition whose
 * value is `true` only while the proposition holds, so a regression is a
 * `pnpm typecheck` failure that names this file, and the `expect` keeps the
 * proposition from being dead code the linter would strip.
 */

/**
 * The eleven namespaces, written out as a type rather than read back from
 * `NAMESPACES`. `satisfies` fails on a namespace this object forgets, and
 * excess-property checking fails on one it invents, so the object and the
 * `Namespace` union prove each other — and the assertion below then ties the
 * shipped array to both.
 */
const SPEC_NAMESPACES = {
  shell: true,
  auth: true,
  trips: true,
  modules: true,
  costs: true,
  atlas: true,
  journal: true,
  marketing: true,
  settings: true,
  console: true,
  ui: true,
} as const satisfies Record<Namespace, true>

describe('the eleven namespaces', () => {
  it('are exactly the ones docs/SPEC.md §9 fixes', () => {
    expect([...NAMESPACES].sort()).toEqual(Object.keys(SPEC_NAMESPACES).sort())
  })

  it('keep the order §9 lists them in, so a catalogue reads in that order', () => {
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
      'console',
      'ui',
    ])
  })

  it('name each namespace once', () => {
    expect(new Set(NAMESPACES).size).toBe(NAMESPACES.length)
  })

  it('cannot be extended at run time — a twelfth is a contract change', () => {
    expect(Object.isFrozen(NAMESPACES)).toBe(true)
  })
})

describe('the key union English derives', () => {
  it('rejects a key no English namespace file authored', () => {
    const rejectsAnInventedKey: 'shell.no-such-key-was-ever-authored' extends MessageKey
      ? false
      : true = true
    expect(rejectsAnInventedKey).toBe(true)
  })

  it('rejects an unqualified key, so two namespaces cannot collide', () => {
    const rejectsAnUnqualifiedKey: 'nav.trips' extends MessageKey
      ? false
      : true = true
    expect(rejectsAnUnqualifiedKey).toBe(true)
  })

  it('is derived from files that exist, not from a placeholder', () => {
    // `messages/namespaces.d.ts` declares each English namespace as an empty
    // record so a half-landed catalogue still typechecks. This asserts the
    // fallback is a fallback: with real files on disk, the union has members.
    const unionHasMembers: [MessageKey] extends [never] ? false : true = true
    expect(unionHasMembers).toBe(true)
  })
})

describe('the shape a translated namespace file is checked against', () => {
  it('demands every key its English source carries', () => {
    const missesAKey: { readonly 'nav.trips': string } extends TranslationOf<{
      readonly 'nav.trips': 'Trips'
      readonly 'nav.atlas': 'Atlas'
    }>
      ? false
      : true = true
    expect(missesAKey).toBe(true)
  })

  it('lets a translation say something different at every key', () => {
    const translation = {
      'nav.trips': 'Wyjazdy',
      unread: {
        one: '{count} nieprzeczytana',
        other: '{count} nieprzeczytanych',
      },
    } satisfies TranslationOf<{
      readonly 'nav.trips': 'Trips'
      readonly unread: {
        readonly one: '{count} unread'
        readonly other: '{count} unread'
      }
    }>
    expect(translation['nav.trips']).toBe('Wyjazdy')
  })
})
