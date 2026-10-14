import { describe, expect, it } from 'vitest'

import { draftFor, draftToInputs } from '../split-editor'

const STORED = [
  { userId: 'u1', shareMinor: 2_000, weight: 1 },
  { userId: 'u9', shareMinor: 4_000, weight: 2 },
]

describe('the draft of a stored split', () => {
  it('has no row for a stored share whose person it was not given', () => {
    const draft = draftFor([{ userId: 'u1' }], 6_000, 'EUR', 'shares', STORED)

    expect(draft.rows.map((row) => row.userId)).toEqual(['u1'])
  })

  it('keeps a stored share for someone who left the trip when they are given a row', () => {
    const draft = draftFor(
      [{ userId: 'u1' }, { userId: 'u9' }],
      6_000,
      'EUR',
      'shares',
      STORED,
    )

    expect(draftToInputs(draft, 'EUR')).toEqual([
      { userId: 'u1', weight: 1 },
      { userId: 'u9', weight: 2 },
    ])
  })
})
