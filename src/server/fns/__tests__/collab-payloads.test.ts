/**
 * The trip's collaboration screen at the server seam: the three payload builders the loader
 * composes, and the one message writer.
 *
 * The plain functions (`threadPayload`, `notesPayload`, `pollsPayload`, `postTripMessage`) are
 * driven rather than the server functions wrapping them, for the reason `stays.test.ts` gives:
 * outside a Start build a server function discards its answer. Everything else is real - a migrated
 * SQLite database and real repositories - except the two edges a message writer reaches out of the
 * process through: the room mirror and the notification dispatch. Both are recorded into one list,
 * so the order they fire in is an assertion rather than a hope.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  addTripMember,
  castVote,
  closePoll,
  createCollabNote,
  createPoll,
  createTrip,
  postMessage,
  toggleReaction,
} from '#/server/repos'
import { createHarness } from '#/server/repos/__tests__/harness'

import type { Trip } from '#/server/db/types'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { TenantScope } from '#/server/repos'

/* ------------------------------------------------------------------ mocking */

const stubs = vi.hoisted(() => ({
  /** Every outward call a writer made, in the order it made them. */
  calls: [] as Array<{ readonly edge: string; readonly detail: unknown }>,
}))

/** `./context` imports `cloudflare:workers`; these are the pure helpers and a recording room. */
vi.mock('../context', () => ({
  appScope: async (): Promise<never> => {
    throw new Error('the plain functions are driven with an explicit scope')
  },
  mirrorToRoom: async (
    _scope: unknown,
    tripId: string,
    patches: ReadonlyArray<unknown>,
  ): Promise<void> => {
    stubs.calls.push({ edge: 'room', detail: { tripId, patches } })
  },
  notificationDeps: () => ({ queue: 'queue', appUrl: 'https://example.test' }),
  patch: (kind: string, id: string, fields: unknown) => ({
    entity: { kind, id },
    op: 'upsert',
    fields,
  }),
  tombstone: (kind: string, id: string) => ({
    entity: { kind, id },
    op: 'delete',
    fields: {},
  }),
  orNull: (value: string | undefined): string | null => {
    if (value === undefined) {
      return null
    }
    const trimmed = value.trim()
    return trimmed.length === 0 ? null : trimmed
  },
}))

vi.mock('#/server/notifications/dispatch', () => ({
  dispatchQuietly: async (_scope: unknown, event: unknown): Promise<null> => {
    stubs.calls.push({ edge: 'notification', detail: event })
    return null
  },
}))

const { notesPayload, pollsPayload, threadPayload } =
  await import('../collab-payloads')
const { postTripMessage } = await import('../collab-thread-writes')

/* -------------------------------------------------------------------- setup */

let harness: Harness
let tenant: SeededTenant
let scope: TenantScope
let trip: Trip

/** `createdAt` has millisecond resolution; a pause keeps two posts in a known order. */
const tick = (): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, 3))

beforeEach(async () => {
  stubs.calls.length = 0
  harness = await createHarness()
  tenant = await harness.seedTenant('collab')
  scope = tenant.scope
  trip = await createTrip(scope, {
    title: 'Tokyo in spring',
    startDate: '2026-04-10',
    endDate: '2026-04-14',
    currency: 'JPY',
  })
})

/* -------------------------------------------------------------------- cases */

describe('the conversation payload', () => {
  it('reads oldest-first, each message carrying its reactions', async () => {
    const first = await postMessage(scope, {
      tripId: trip.id,
      body: 'Landing at 9',
    })
    await tick()
    const second = await postMessage(scope, {
      tripId: trip.id,
      body: 'See you there',
      replyToId: first.id,
    })
    await tick()
    const third = await postMessage(scope, {
      tripId: trip.id,
      body: 'Bringing snacks',
    })
    await toggleReaction(scope, trip.id, second.id, '👍')

    const messages = await threadPayload(scope, trip)

    expect(messages.map((row) => row.id)).toEqual([
      first.id,
      second.id,
      third.id,
    ])
    expect(messages[1]).toMatchObject({
      userId: scope.ctx.userId,
      body: 'See you there',
      replyToId: first.id,
      editedAt: null,
      reactions: [{ emoji: '👍', count: 1, userIds: [scope.ctx.userId] }],
    })
    expect(messages[0]?.reactions).toEqual([])
    expect(typeof messages[0]?.createdAt).toBe('string')
  })

  it('stops at the newest fifty and still reads them oldest-first', async () => {
    for (let index = 1; index <= 52; index += 1) {
      await postMessage(scope, { tripId: trip.id, body: `message ${index}` })
      // Ids sort by millisecond then a random suffix: same-instant posts have no order.
      await tick()
    }

    const messages = await threadPayload(scope, trip)

    expect(messages).toHaveLength(50)
    expect(messages.at(-1)?.body).toBe('message 52')
  })
})

describe('the notes payload', () => {
  it('is the board in today’s shape', async () => {
    const note = await createCollabNote(scope, {
      tripId: trip.id,
      title: 'Pack the adapter',
      body: 'Type A, 100V',
      category: 'Gear',
      colour: '#ffcc00',
      isPinned: true,
    })

    const notes = await notesPayload(scope, trip)

    expect(notes).toEqual([
      {
        id: note.id,
        title: 'Pack the adapter',
        body: 'Type A, 100V',
        category: 'Gear',
        colour: '#ffcc00',
        isPinned: true,
        createdBy: scope.ctx.userId,
        createdAt: note.createdAt.toISOString(),
      },
    ])
  })
})

describe('the polls payload', () => {
  it('counts each option’s votes and lists who cast them', async () => {
    const other = await tenant.addUser('Ayumi')
    await addTripMember(scope, {
      tripId: trip.id,
      userId: other,
      role: 'editor',
    })
    const poll = await createPoll(scope, {
      tripId: trip.id,
      question: 'Ramen or sushi?',
      options: [
        { id: 'opt-1', label: 'Ramen' },
        { id: 'opt-2', label: 'Sushi' },
      ],
      allowMultiple: false,
    })
    await castVote(scope, trip.id, poll.id, 'opt-1')
    await castVote(tenant.scopeFor(other), trip.id, poll.id, 'opt-1')
    await closePoll(scope, trip.id, poll.id)

    const polls = await pollsPayload(scope, trip)

    expect(polls).toHaveLength(1)
    expect(polls[0]).toMatchObject({
      id: poll.id,
      question: 'Ramen or sushi?',
      allowMultiple: false,
      isClosed: true,
      createdBy: scope.ctx.userId,
      totalVotes: 2,
    })
    const tally = polls[0]?.tally ?? []
    expect(
      tally.map((entry) => [entry.optionId, entry.label, entry.votes]),
    ).toEqual([
      ['opt-1', 'Ramen', 2],
      ['opt-2', 'Sushi', 0],
    ])
    expect([...(tally[0]?.userIds ?? [])].sort()).toEqual(
      [scope.ctx.userId, other].sort(),
    )
    expect(tally[1]?.userIds).toEqual([])
  })

  it('is empty for a trip with no polls', async () => {
    expect(await pollsPayload(scope, trip)).toEqual([])
  })
})

describe('posting a message', () => {
  it('mirrors a trip patch to the room, then notifies the members, in that order', async () => {
    const result = await postTripMessage(scope, {
      tripId: trip.id,
      body: 'Dinner at 7?',
      replyToId: '',
    })

    expect(stubs.calls.map((call) => call.edge)).toEqual([
      'room',
      'notification',
    ])
    expect(stubs.calls[0]?.detail).toMatchObject({
      tripId: trip.id,
      patches: [
        {
          entity: { kind: 'trip', id: trip.id },
          op: 'upsert',
          fields: { chatLastMessageId: result.messageId },
        },
      ],
    })
    expect(stubs.calls[1]?.detail).toMatchObject({
      kind: 'collab.message',
      tripId: trip.id,
      entityType: 'collab_message',
      entityId: result.messageId,
      actorUserId: scope.ctx.userId,
      titleParams: { tripTitle: 'Tokyo in spring' },
      bodyParams: { preview: 'Dinner at 7?' },
      actionUrl: `/trips/${trip.id}/collab`,
    })
  })

  it('writes the message before either edge fires', async () => {
    const result = await postTripMessage(scope, {
      tripId: trip.id,
      body: 'Kept even if the room is down',
      replyToId: '',
    })

    const messages = await threadPayload(scope, trip)
    expect(messages.map((row) => row.id)).toEqual([result.messageId])
  })

  it('refuses a trip of another workspace before writing or announcing anything', async () => {
    const stranger = await harness.seedTenant('stranger')

    await expect(
      postTripMessage(stranger.scope, {
        tripId: trip.id,
        body: 'Not mine',
        replyToId: '',
      }),
    ).rejects.toThrow()
    expect(stubs.calls).toEqual([])
  })
})
