import { beforeEach, describe, expect, it, vi } from 'vitest'
import * as repos from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'
import { loadOlderMessages } from '../collab-payloads'
import { olderMessagesSchema } from '../collab-inputs'
import { THREAD_PAGE_SIZE } from '#/lib/collab'
import type { Harness } from '#/server/repos/__tests__/harness'

let harness: Harness
beforeEach(async () => {
  harness = await createHarness()
})
describe('the older-page handler', () => {
  it('pages oldest first at the fixed size, reading reactions for exactly that page', async () => {
    const { scope } = await harness.seedTenant('history')
    const trip = await repos.createTrip(scope, {
      title: 'History',
      startDate: '2026-10-01',
      endDate: '2026-10-02',
      currency: 'EUR',
    })
    for (let i = 0; i < THREAD_PAGE_SIZE + 2; i++)
      await repos.postMessage(scope, { tripId: trip.id, body: `message ${i}` })
    const newest = await repos.listMessages(scope, trip.id, { limit: 1 })
    const cursor = newest.items[0]!.id
    await repos.setTripCollabSections(scope, trip.id, {
      section: 'conversation',
      on: false,
    })
    const spy = vi.spyOn(repos, 'listReactions')
    const page = await loadOlderMessages(scope, { tripId: trip.id, cursor })
    expect(page.messages).toHaveLength(THREAD_PAGE_SIZE)
    expect(page.exhausted).toBe(false)
    const ids = page.messages.map((m) => m.id)
    expect(ids).toEqual([...ids].sort())
    expect(spy).toHaveBeenLastCalledWith(scope, [...ids].reverse())
    const last = await loadOlderMessages(scope, {
      tripId: trip.id,
      cursor: ids[0]!,
    })
    expect(last.messages).toHaveLength(1)
    expect(last.exhausted).toBe(true)
    const oldest = last.messages[0]!
    await repos.toggleReaction(scope, trip.id, oldest.id, '👍')
    expect(
      (await loadOlderMessages(scope, { tripId: trip.id, cursor: ids[0]! }))
        .messages[0]?.reactions,
    ).toEqual([{ emoji: '👍', count: 1, userIds: [scope.ctx.userId] }])
  })
  it('refuses foreign and private trips before either child read', async () => {
    const a = await harness.seedTenant('a')
    const b = await harness.seedTenant('b')
    const trip = await repos.createTrip(b.scope, {
      title: 'Private',
      startDate: '2026-10-01',
      endDate: '2026-10-02',
      currency: 'EUR',
      visibility: 'private',
    })
    const user = await b.addUser('outsider')
    const messages = vi.spyOn(repos, 'listMessages')
    const reactions = vi.spyOn(repos, 'listReactions')
    for (const scope of [a.scope, b.scopeFor(user)]) {
      await expect(
        loadOlderMessages(scope, { tripId: trip.id, cursor: '~' }),
      ).rejects.toMatchObject({ name: 'NotFoundError' })
    }
    expect(messages).not.toHaveBeenCalled()
    expect(reactions).not.toHaveBeenCalled()
  })
  it('rejects a page size and malformed cursors', () => {
    expect(
      olderMessagesSchema.safeParse({ tripId: 't', cursor: 'c', limit: 100 })
        .success,
    ).toBe(false)
    for (const cursor of ['', ' ', 'x'.repeat(65)])
      expect(
        olderMessagesSchema.safeParse({ tripId: 't', cursor }).success,
      ).toBe(false)
  })
})
