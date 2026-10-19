/**
 * A deleted chat message keeps its row and loses its text (spec `erase-a-persons-data`, phase 7).
 *
 * The row stays because a reply points at it; the body goes because a soft delete that keeps the
 * words is a copy of the person's data nobody can reach any more. Three things are pinned: the
 * delete itself, the per-workspace pass that clears rows deleted before this change (and that it
 * never touches another organisation), and the one-off migration that does the same for the data
 * already in D1.
 */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import {
  clearDeletedMessageBodies,
  collabMessagesRepository,
  deleteMessage,
  editMessage,
  listMessages,
  postMessage,
} from '../collab'
import { NotFoundError } from '../context'
import { createTrip } from '../trips'
import { captureError, createHarness } from './harness'
import type { TenantScope } from '../base'
import type { Harness, SeededTenant } from './harness'

async function tripFor(scope: TenantScope, slug: string): Promise<string> {
  const trip = await createTrip(scope, {
    title: `Trip ${slug}`,
    slug,
    startDate: '2026-04-10',
    endDate: '2026-04-13',
  })
  return trip.id
}

/** A message that was soft-deleted before the body was cleared: both columns set, as D1 holds them. */
async function seedLegacyDeleted(
  scope: TenantScope,
  tripId: string,
  body: string,
) {
  return collabMessagesRepository.insert(scope, {
    tripId,
    userId: scope.ctx.userId,
    body,
    deletedAt: new Date('2026-09-01T10:00:00Z'),
  })
}

describe('deleting a chat message', () => {
  let harness: Harness
  let tenant: SeededTenant
  let tripId: string

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('erase-chat')
    tripId = await tripFor(tenant.scope, 'erase-chat')
  })

  afterEach(() => harness.close())

  it('clears the body and keeps the row', async () => {
    const message = await postMessage(tenant.scope, {
      tripId,
      body: 'My number is 555-0100',
    })

    await deleteMessage(tenant.scope, tripId, message.id)

    const row = await collabMessagesRepository.requireById(
      tenant.scope,
      message.id,
    )
    expect(row.body).toBe('')
    expect(row.deletedAt).not.toBeNull()
    expect((await listMessages(tenant.scope, tripId)).items).toEqual([])
  })

  it('keeps the link of a reply to the deleted message', async () => {
    const parent = await postMessage(tenant.scope, { tripId, body: 'Dinner?' })
    const reply = await postMessage(tenant.scope, {
      tripId,
      body: 'Yes',
      replyToId: parent.id,
    })

    await deleteMessage(tenant.scope, tripId, parent.id)

    const kept = await collabMessagesRepository.requireById(
      tenant.scope,
      reply.id,
    )
    expect(kept.replyToId).toBe(parent.id)
    expect(await collabMessagesRepository.exists(tenant.scope, parent.id)).toBe(
      true,
    )
  })

  it('refuses to edit a deleted message, so a body cannot be written back', async () => {
    const message = await postMessage(tenant.scope, { tripId, body: 'Oops' })
    await deleteMessage(tenant.scope, tripId, message.id)

    const error = await captureError(() =>
      editMessage(tenant.scope, tripId, message.id, 'Back again'),
    )

    expect(error).toBeInstanceOf(NotFoundError)
    expect(
      (await collabMessagesRepository.requireById(tenant.scope, message.id))
        .body,
    ).toBe('')
  })

  it('deleting twice leaves the same row', async () => {
    const message = await postMessage(tenant.scope, { tripId, body: 'Twice' })
    await deleteMessage(tenant.scope, tripId, message.id)

    await deleteMessage(tenant.scope, tripId, message.id)

    expect(
      (await collabMessagesRepository.requireById(tenant.scope, message.id))
        .body,
    ).toBe('')
  })
})

describe('clearing the bodies of messages deleted before', () => {
  let harness: Harness
  let alpha: SeededTenant
  let beta: SeededTenant
  let alphaTrip: string
  let betaTrip: string

  beforeEach(async () => {
    harness = await createHarness()
    alpha = await harness.seedTenant('alpha')
    beta = await harness.seedTenant('beta')
    alphaTrip = await tripFor(alpha.scope, 'alpha-trip')
    betaTrip = await tripFor(beta.scope, 'beta-trip')
  })

  afterEach(() => harness.close())

  it('clears the deleted messages of the workspace and leaves the live ones', async () => {
    const legacy = await seedLegacyDeleted(alpha.scope, alphaTrip, 'old text')
    const live = await postMessage(alpha.scope, {
      tripId: alphaTrip,
      body: 'Hi',
    })

    await expect(clearDeletedMessageBodies(alpha.scope)).resolves.toBe(1)

    expect(
      (await collabMessagesRepository.requireById(alpha.scope, legacy.id)).body,
    ).toBe('')
    expect(
      (await collabMessagesRepository.requireById(alpha.scope, live.id)).body,
    ).toBe('Hi')
  })

  it('is a no-op on a rerun', async () => {
    await seedLegacyDeleted(alpha.scope, alphaTrip, 'old text')
    await clearDeletedMessageBodies(alpha.scope)

    await expect(clearDeletedMessageBodies(alpha.scope)).resolves.toBe(0)
  })

  it('leaves another organisation’s soft-deleted rows unchanged', async () => {
    await seedLegacyDeleted(alpha.scope, alphaTrip, 'alpha text')
    const theirs = await seedLegacyDeleted(beta.scope, betaTrip, 'beta text')

    await clearDeletedMessageBodies(alpha.scope)

    const untouched = await collabMessagesRepository.requireById(
      beta.scope,
      theirs.id,
    )
    expect(untouched.body).toBe('beta text')
    expect(untouched.deletedAt).not.toBeNull()
    expect(
      await captureError(() =>
        collabMessagesRepository.requireById(alpha.scope, theirs.id),
      ),
    ).toBeInstanceOf(NotFoundError)
  })
})

describe('the migration that clears the rows already in D1', () => {
  let harness: Harness

  beforeEach(async () => {
    harness = await createHarness({ ddl: 'migrations' })
  })

  afterEach(() => harness.close())

  it('clears every deleted message body once, keeps live ones, and is idempotent', async () => {
    const alpha = await harness.seedTenant('alpha')
    const beta = await harness.seedTenant('beta')
    const alphaTrip = await tripFor(alpha.scope, 'alpha-trip')
    const betaTrip = await tripFor(beta.scope, 'beta-trip')
    const a = await seedLegacyDeleted(alpha.scope, alphaTrip, 'alpha text')
    const b = await seedLegacyDeleted(beta.scope, betaTrip, 'beta text')
    const live = await postMessage(beta.scope, { tripId: betaTrip, body: 'Hi' })
    const sql = readFileSync(
      join(process.cwd(), 'drizzle', '0020_clear_deleted_message_bodies.sql'),
      'utf8',
    )

    harness.sqlite.exec(sql)
    harness.sqlite.exec(sql)

    expect(
      (await collabMessagesRepository.requireById(alpha.scope, a.id)).body,
    ).toBe('')
    const cleared = await collabMessagesRepository.requireById(beta.scope, b.id)
    expect(cleared.body).toBe('')
    expect(cleared.deletedAt).not.toBeNull()
    expect(
      (await collabMessagesRepository.requireById(beta.scope, live.id)).body,
    ).toBe('Hi')
  })
})
