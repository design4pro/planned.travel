import { describe, expect, it } from 'vitest'

import { hasVisibleCharacter } from '../workspace-name'

describe('hasVisibleCharacter', () => {
  it.each([
    ['a zero-width space', '\u200B'],
    ['a zero-width joiner', '\u200D'],
    ['a zero-width non-joiner', '\u200C'],
    ['a byte order mark', '\uFEFF'],
    ['several invisible characters in a row', '\u200B\u200D\uFEFF'],
    ['a combining mark with nothing to combine with', '\u0301'],
    ['spaces and a zero-width space', '  \u200B  '],
    ['nothing', ''],
  ])('refuses %s', (_label, name) => {
    expect(hasVisibleCharacter(name)).toBe(false)
  })

  it.each([
    ['an ordinary name', 'Lisbon'],
    ['a name in a script without case', '工作区'],
    ['a digit', '2'],
    ['an emoji, which is a symbol', '🌍'],
    ['punctuation', '...'],
    ['a name with an invisible character beside a visible one', '\u200BA'],
  ])('accepts %s', (_label, name) => {
    expect(hasVisibleCharacter(name)).toBe(true)
  })
})
