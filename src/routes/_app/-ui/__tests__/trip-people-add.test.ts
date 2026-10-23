import { beforeEach, describe, expect, it, vi } from 'vitest'

import { addPeople } from '../trip-people-add'

const add = vi.hoisted(() => vi.fn())

vi.mock('../../trips/$tripId/-server/people', () => ({ addTripMemberFn: add }))

const ana = { userId: 'u-ana', name: 'Ana', role: 'editor' as const }
const ben = { userId: 'u-ben', name: 'Ben', role: 'viewer' as const }

beforeEach(() => {
  add.mockReset()
})

describe('addPeople', () => {
  it('adds each person in order with the chosen role and reports nobody when all land', async () => {
    add.mockResolvedValue({ ok: true })

    expect(await addPeople('trip-1', [ana, ben])).toEqual([])

    expect(add.mock.calls).toEqual([
      [{ data: { tripId: 'trip-1', userId: 'u-ana', role: 'editor' } }],
      [{ data: { tripId: 'trip-1', userId: 'u-ben', role: 'viewer' } }],
    ])
  })

  it('names the refusals it has a sentence for and keeps going', async () => {
    add
      .mockResolvedValueOnce({ ok: false, reason: 'not-in-workspace' })
      .mockResolvedValueOnce({ ok: false, reason: 'already-on-trip' })

    expect(await addPeople('trip-1', [ana, ben])).toEqual([
      { userId: 'u-ana', name: 'Ana', reason: 'not-in-workspace' },
      { userId: 'u-ben', name: 'Ben', reason: 'already-on-trip' },
    ])
  })

  it('reports a refusal it has no sentence for as unconfirmed, not guessed at', async () => {
    add.mockResolvedValue({ ok: false, reason: 'last-owner' })

    expect(await addPeople('trip-1', [ana])).toEqual([
      { userId: 'u-ana', name: 'Ana', reason: 'unconfirmed' },
    ])
  })

  it('never throws: a call that threw may have landed, so it is unconfirmed', async () => {
    add.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({
      ok: true,
    })

    expect(await addPeople('trip-1', [ana, ben])).toEqual([
      { userId: 'u-ana', name: 'Ana', reason: 'unconfirmed' },
    ])
    expect(add).toHaveBeenCalledTimes(2)
  })
})
