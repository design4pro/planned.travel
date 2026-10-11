/**
 * What the create-collection server function accepts: a collection is always shared with the
 * workspace, so `private` and `public` are refused rather than quietly dropped.
 */
import { describe, expect, it } from 'vitest'

import { createCollectionSchema } from '../library-wire'

const VALID = { name: 'Someday', description: '', colour: '#336699' }

describe('createCollectionSchema', () => {
  it('accepts a collection with no visibility and leaves the default to the column', () => {
    const parsed = createCollectionSchema.parse(VALID)

    expect(parsed.visibility).toBeUndefined()
  })

  it('still accepts the default from a tab loaded before the deploy', () => {
    expect(
      createCollectionSchema.safeParse({ ...VALID, visibility: 'organization' })
        .success,
    ).toBe(true)
  })

  it.each(['private', 'public', 'everyone', ''])(
    'refuses visibility %j',
    (visibility) => {
      expect(
        createCollectionSchema.safeParse({ ...VALID, visibility }).success,
      ).toBe(false)
    },
  )

  it('still refuses a colour that is not a hex value', () => {
    expect(
      createCollectionSchema.safeParse({ ...VALID, colour: 'blue' }).success,
    ).toBe(false)
  })
})
