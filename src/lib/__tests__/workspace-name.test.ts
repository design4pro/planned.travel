import { describe, expect, it } from 'vitest'

import { hasVisibleCharacter } from '../workspace-name'

describe('hasVisibleCharacter', () => {
  it.each([
    ['a zero-width space', '​'],
    ['a zero-width joiner', '‍'],
    ['a zero-width non-joiner', '‌'],
    ['a byte order mark', '﻿'],
    ['several invisible characters in a row', '​‍﻿'],
    ['a combining mark with nothing to combine with', '́'],
    ['spaces and a zero-width space', '  ​  '],
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
    ['a name with an invisible character beside a visible one', '​A'],
  ])('accepts %s', (_label, name) => {
    expect(hasVisibleCharacter(name)).toBe(true)
  })
})
