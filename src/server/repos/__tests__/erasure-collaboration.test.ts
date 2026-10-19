import { afterEach, beforeEach, expect, it } from 'vitest'
import {
  collabMessages,
  collabMessageReactions,
  collabNotes,
  collabPolls,
  collabPollVotes,
  checkIns,
  notifications,
} from '#/server/db/schema'
import { createErasureScope } from '#/server/erasure/scope'
import { createTenantRepository, createTenantTableAccess } from '../base'
import { eraseUserCollaboration } from '../collab-erasure'
import { createTrip } from '../trips'
import { createHarness } from './harness'
import type { Harness } from './harness'

let harness: Harness
beforeEach(async () => {
  harness = await createHarness()
})
afterEach(() => harness.close())
it('clears all messages including deleted bodies, keeps replies and poll totals, removes reactions, locations and both inbox copies only in its workspace', async () => {
  const a = await harness.seedTenant('a')
  const b = await harness.seedTenant('b')
  const messages = createTenantRepository(collabMessages, 'message')
  const reactions = createTenantTableAccess(collabMessageReactions, 'reaction')
  const notes = createTenantRepository(collabNotes, 'note')
  const polls = createTenantRepository(collabPolls, 'poll')
  const votes = createTenantRepository(collabPollVotes, 'vote')
  const locations = createTenantRepository(checkIns, 'check-in')
  const inbox = createTenantRepository(notifications, 'notification')
  const parents: string[] = []
  for (const tenant of [a, b]) {
    const trip = await createTrip(tenant.scope, { title: 'Trip', slug: 'trip' })
    const parent = await messages.insert(tenant.scope, {
      tripId: trip.id,
      userId: 'person',
      body: 'secret',
      deletedAt: new Date(1),
    })
    parents.push(parent.id)
    await messages.insert(tenant.scope, {
      tripId: trip.id,
      userId: 'other',
      body: 'reply',
      replyToId: parent.id,
    })
    for (let i = 0; i < 105; i++) {
      await messages.insert(tenant.scope, {
        tripId: trip.id,
        userId: 'person',
        body: 'text',
      })
      await reactions.insert(tenant.scope, {
        messageId: parent.id,
        userId: 'person',
        emoji: String(i),
      })
    }
    await notes.insert(tenant.scope, {
      tripId: trip.id,
      createdBy: 'person',
      title: 'Note',
      body: 'keep',
    })
    const poll = await polls.insert(tenant.scope, {
      tripId: trip.id,
      createdBy: 'person',
      question: 'Which?',
      options: [{ id: 'yes', label: 'Yes' }],
    })
    for (const userId of ['person', 'second'])
      await votes.insert(tenant.scope, {
        pollId: poll.id,
        userId,
        optionId: 'yes',
      })
    await locations.insert(tenant.scope, {
      tripId: trip.id,
      userId: 'person',
      name: 'Here',
      checkedInAt: new Date(),
    })
    for (const [recipientUserId, senderUserId] of [
      ['person', 'other'],
      ['other', 'person'],
      ['other', 'second'],
    ]) {
      await inbox.insert(tenant.scope, {
        recipientUserId,
        senderUserId,
        titleKey: 'title',
        bodyKey: 'body',
      })
    }
  }
  const scope = createErasureScope(harness.db, a.organizationId)
  await eraseUserCollaboration(scope, 'person', 'erased_first')
  await eraseUserCollaboration(scope, 'second', 'erased_second')
  await eraseUserCollaboration(scope, 'person', 'erased_first')
  const rows = await messages.findMany(a.scope)
  expect(rows.filter((r) => r.userId === 'erased_first')).toHaveLength(106)
  expect(
    rows
      .filter((r) => r.userId === 'erased_first')
      .every((r) => r.body === '' && r.deletedAt !== null),
  ).toBe(true)
  expect(rows.find((r) => r.body === 'reply')?.replyToId).toBe(parents[0])
  expect(await reactions.count(a.scope)).toBe(0)
  expect((await notes.findMany(a.scope))[0]).toMatchObject({
    createdBy: 'erased_first',
    body: 'keep',
  })
  expect((await polls.findMany(a.scope))[0]?.createdBy).toBe('erased_first')
  expect((await votes.findMany(a.scope)).map((r) => r.userId).sort()).toEqual([
    'erased_first',
    'erased_second',
  ])
  expect(await locations.count(a.scope)).toBe(0)
  expect(await inbox.count(a.scope)).toBe(0)
  expect((await messages.requireById(b.scope, parents[1] ?? '')).body).toBe(
    'secret',
  )
  expect(await reactions.count(b.scope)).toBe(105)
  expect((await notes.findMany(b.scope))[0]?.createdBy).toBe('person')
  expect((await polls.findMany(b.scope))[0]?.createdBy).toBe('person')
  expect((await votes.findMany(b.scope)).map((r) => r.userId).sort()).toEqual([
    'person',
    'second',
  ])
  expect(await locations.count(b.scope)).toBe(1)
  expect(await inbox.count(b.scope)).toBe(3)
})
