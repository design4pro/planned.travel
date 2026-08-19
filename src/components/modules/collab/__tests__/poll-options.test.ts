import { describe, expect, it } from 'vitest'

import { pollOptionsError } from '../poll-options'

describe('pollOptionsError', () => {
  it('accepts two distinct options', () => {
    expect(pollOptionsError(['Den', 'Narisawa'])).toBeNull()
  })

  it('refuses fewer than two things to choose between', () => {
    expect(pollOptionsError(['Den'])).toBe(
      'A poll needs at least two things to choose between.',
    )
    expect(pollOptionsError([])).toBe(
      'A poll needs at least two things to choose between.',
    )
  })

  it('does not count a blank row towards the minimum', () => {
    expect(pollOptionsError(['Den', '  '])).toBe(
      'A poll needs at least two things to choose between.',
    )
  })

  it('refuses two options that say the same thing', () => {
    expect(pollOptionsError(['Den', 'Den'])).toBe(
      'Two options say the same thing. Give each one its own wording.',
    )
  })

  it('treats case and surrounding space as the same wording', () => {
    expect(pollOptionsError(['Den', ' den '])).toBe(
      'Two options say the same thing. Give each one its own wording.',
    )
  })

  it('accepts blanks alongside enough real options, because they are dropped', () => {
    expect(pollOptionsError(['Den', 'Narisawa', ''])).toBeNull()
  })

  it('accepts a longer list of distinct options', () => {
    expect(pollOptionsError(['One', 'Two', 'Three', 'Four'])).toBeNull()
  })
})
