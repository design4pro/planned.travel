import { describe, expect, it } from 'vitest'

import { interpolate, resolveMessage } from '../interpolate'

import type { PluralMessage } from '../types'

describe('interpolation', () => {
  it('substitutes every occurrence of a token', () => {
    expect(interpolate('Current language: {name}', { name: 'Polski' })).toBe(
      'Current language: Polski',
    )
    expect(interpolate('{a} then {b} then {a}', { a: '1', b: '2' })).toBe(
      '1 then 2 then 1',
    )
  })

  it('stringifies numbers without reformatting them', () => {
    // Locale-aware number shaping lives behind the pinned formatters in
    // `src/lib/format.ts`; a second one here would be a second opinion.
    expect(interpolate('{count} trips', { count: 1200.5 })).toBe('1200.5 trips')
    expect(interpolate('{count} trips', { count: 0 })).toBe('0 trips')
  })

  it('leaves a template alone when it has no tokens', () => {
    expect(interpolate('Language')).toBe('Language')
    expect(interpolate('Language', { name: 'unused' })).toBe('Language')
  })

  it('leaves an unknown token visible rather than blanking it', () => {
    expect(interpolate('Hello {who}', { name: 'Ada' })).toBe('Hello {who}')
  })

  it('ignores braces that are not tokens', () => {
    expect(interpolate('{ name }', { name: 'Ada' })).toBe('{ name }')
    expect(interpolate('a { b } c', { b: 'x' })).toBe('a { b } c')
  })

  it('treats an inherited property name as an unknown token', () => {
    // A params bag is an ordinary object literal, so `params.constructor`
    // answers with the `Object` constructor rather than `undefined`. Presence is
    // decided by `Object.hasOwn`, or a `{constructor}` token would stringify a
    // native function into the middle of a sentence.
    for (const name of ['constructor', 'toString', 'valueOf', '__proto__']) {
      expect(interpolate(`Hi {${name}}`, { name: 'Ada' })).toBe(`Hi {${name}}`)
    }
    // …and an own property of that name still substitutes normally.
    expect(interpolate('Hi {constructor}', { constructor: 'Ada' })).toBe(
      'Hi Ada',
    )
  })
})

describe('resolving a message', () => {
  const trips: PluralMessage = {
    one: '{count} trip',
    few: '{count} trips (few)',
    many: '{count} trips (many)',
    other: '{count} trips',
  }

  it('passes a plain string straight through', () => {
    expect(resolveMessage('Language', 'en')).toBe('Language')
  })

  it('picks the plural branch for the locale', () => {
    expect(resolveMessage(trips, 'en', { count: 1 })).toBe('1 trip')
    expect(resolveMessage(trips, 'en', { count: 4 })).toBe('4 trips')
    expect(resolveMessage(trips, 'pl', { count: 3 })).toBe('3 trips (few)')
    expect(resolveMessage(trips, 'pl', { count: 5 })).toBe('5 trips (many)')
    expect(resolveMessage(trips, 'ja', { count: 1 })).toBe('1 trips')
  })

  it('falls back to `other` when the locale needs a branch that is absent', () => {
    // Arabic asks for `zero` and `two`; a catalogue that has not authored them
    // still renders a sentence rather than `undefined`.
    expect(resolveMessage(trips, 'ar', { count: 0 })).toBe('0 trips')
    expect(resolveMessage(trips, 'ar', { count: 2 })).toBe('2 trips')
    expect(resolveMessage(trips, 'ar', { count: 3 })).toBe('3 trips (few)')
  })

  it('uses `other` when no count is given at all', () => {
    expect(resolveMessage(trips, 'pl')).toBe('{count} trips')
  })
})
