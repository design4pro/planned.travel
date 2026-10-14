import { describe, expect, it } from 'vitest'

import { splitShares } from '#/lib/money'

import { draftFor, draftForDeparted, draftToInputs } from '../split-editor'

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

describe('the draft of an expense that names someone who left the trip', () => {
  // 10.01 over three: the odd cent went to the first row, Ada, then Cy, who has since left.
  const STORED_EQUAL = [
    { userId: 'ada', shareMinor: 334, weight: 1 },
    { userId: 'cy', shareMinor: 334, weight: 1 },
    { userId: 'bo', shareMinor: 333, weight: 1 },
  ]

  it('hands the odd cent out as it was stored, whatever order the people come in', () => {
    const draft = draftForDeparted(
      [{ userId: 'ada' }, { userId: 'bo' }],
      [{ userId: 'cy' }],
      1_001,
      'EUR',
      'equal',
      STORED_EQUAL,
    )

    const computed = splitShares(1_001, 'equal', draftToInputs(draft, 'EUR'))
    expect(
      Object.fromEntries(computed.map((row) => [row.userId, row.shareMinor])),
    ).toEqual({ ada: 334, cy: 334, bo: 333 })
  })

  it('is the plain draft when nobody has left', () => {
    const people = [{ userId: 'ada' }, { userId: 'bo' }]

    expect(
      draftForDeparted(people, [], 1_001, 'EUR', 'equal', STORED_EQUAL),
    ).toEqual(draftFor(people, 1_001, 'EUR', 'equal', STORED_EQUAL))
  })
})
