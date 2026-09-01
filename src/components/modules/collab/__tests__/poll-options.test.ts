import { describe, expect, it } from 'vitest'

import { pollOptionsError } from '../poll-options'

describe('pollOptionsError', () => {
  it('accepts two distinct options', () => {
    expect(pollOptionsError(['Den', 'Narisawa'])).toBeNull()
  })

  it('refuses fewer than two things to choose between', () => {
    expect(pollOptionsError(['Den'])).toBe('modules.collab.poll.error.tooFew')
    expect(pollOptionsError([])).toBe('modules.collab.poll.error.tooFew')
  })

  it('does not count a blank row towards the minimum', () => {
    expect(pollOptionsError(['Den', '  '])).toBe(
      'modules.collab.poll.error.tooFew',
    )
  })

  it('refuses two options that say the same thing', () => {
    expect(pollOptionsError(['Den', 'Den'])).toBe(
      'modules.collab.poll.error.duplicate',
    )
  })

  it('treats case and surrounding space as the same wording', () => {
    expect(pollOptionsError(['Den', ' den '])).toBe(
      'modules.collab.poll.error.duplicate',
    )
  })

  it('accepts blanks alongside enough real options, because they are dropped', () => {
    expect(pollOptionsError(['Den', 'Narisawa', ''])).toBeNull()
  })

  it('accepts a longer list of distinct options', () => {
    expect(pollOptionsError(['One', 'Two', 'Three', 'Four'])).toBeNull()
  })
})
