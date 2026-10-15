/**
 * Who writes a trip's conversation, notes and polls, at the repository seam (#913).
 *
 * An owner and an editor post, edit, react, vote and moderate; a viewer, and a workspace member who
 * only reads an organization-visible trip, read. An archived trip refuses everybody. Each writer is
 * asked in the order the boundary needs: the row is on the trip the request names (`NotFoundError`
 * if not), the trip is visible (`NotFoundError`), still open (`TripArchivedError`), and the caller's
 * role is enough (`TripRoleError`) - and only then the write.
 */

import { beforeEach, describe, expect, it } from 'vitest'

import {
  collabMessagesRepository,
  listMessages,
  listNotes,
  listPolls,
  postMessage,
} from '../collab'
import { NotFoundError } from '../context'
import {
  TripArchivedError,
  TripRoleError,
  addTripMember,
  archiveTrip,
  createTrip,
  updateTrip,
} from '../trips'
import {
  allWriters,
  collabRows,
  creatingWriters,
  rowWriters,
  seedCollabRows,
} from './collab-writers'
import { captureError, createHarness } from './harness'
import type { TenantScope } from '../base'
import type { CollabRowIds } from './collab-writers'
import type { Harness, SeededTenant } from './harness'

describe('who writes a trip’s conversation, notes and polls', () => {
  let harness: Harness
  let tenant: SeededTenant
  let tripId: string
  let rows: CollabRowIds
  let owner: TenantScope
  let editor: TenantScope
  let viewer: TenantScope
  let reader: TenantScope

  beforeEach(async () => {
    harness = await createHarness()
    tenant = await harness.seedTenant('collab-roles')
    const editorId = await tenant.addUser('An editor')
    const viewerId = await tenant.addUser('A viewer')
    const readerId = await tenant.addUser('A reader who is not on the trip')

    const trip = await createTrip(tenant.scope, {
      title: 'Lisbon, together',
      slug: 'lisbon-together',
      startDate: '2026-04-10',
      endDate: '2026-04-13',
    })
    tripId = trip.id
    await addTripMember(tenant.scope, {
      tripId,
      userId: editorId,
      role: 'editor',
    })
    await addTripMember(tenant.scope, {
      tripId,
      userId: viewerId,
      role: 'viewer',
    })
    await updateTrip(tenant.scope, tripId, { visibility: 'organization' })

    owner = tenant.scope
    editor = tenant.scopeFor(editorId)
    viewer = tenant.scopeFor(viewerId)
    reader = tenant.scopeFor(readerId)
    rows = await seedCollabRows(owner, tripId)
  })

  describe('a viewer', () => {
    it('is refused every writer with the role refusal, and changes nothing', async () => {
      const before = await collabRows(owner)

      for (const [label, write] of allWriters(viewer, tripId, rows)) {
        expect(await captureError(write), label).toBeInstanceOf(TripRoleError)
      }
      expect(await collabRows(owner)).toEqual(before)
    })

    it('still reads the conversation, the notes and the polls', async () => {
      expect((await listMessages(viewer, tripId)).items).toHaveLength(1)
      expect(await listNotes(viewer, tripId)).toHaveLength(1)
      expect(await listPolls(viewer, tripId)).toHaveLength(1)
    })
  })

  describe('a workspace member who only reads an organization-visible trip', () => {
    it('is refused every writer with the role refusal, and changes nothing', async () => {
      const before = await collabRows(owner)

      for (const [label, write] of allWriters(reader, tripId, rows)) {
        expect(await captureError(write), label).toBeInstanceOf(TripRoleError)
      }
      expect(await collabRows(owner)).toEqual(before)
    })
  })

  describe.each([
    ['an owner', () => owner],
    ['an editor', () => editor],
  ])('%s', (_name, scopeOf) => {
    it('keeps every action they have today', async () => {
      const scope = scopeOf()

      for (const [label, write] of creatingWriters(scope, tripId)) {
        await expect(write(), label).resolves.toBeDefined()
      }
      // Each row writer gets rows of its own: closing a poll would otherwise end the vote after it.
      for (
        let index = 0;
        index < rowWriters(scope, tripId, rows).length;
        index += 1
      ) {
        const own = await seedCollabRows(scope, tripId)
        const entry = rowWriters(scope, tripId, own)[index]
        if (entry === undefined) {
          throw new Error('The writer list changed under the loop.')
        }
        await entry[1]()
      }
    })
  })

  describe('an archived trip', () => {
    it('refuses every writer, the owner’s included, and changes nothing', async () => {
      await archiveTrip(owner, tripId)
      const before = await collabRows(owner)

      for (const scope of [owner, editor, viewer]) {
        for (const [label, write] of allWriters(scope, tripId, rows)) {
          expect(await captureError(write), label).toBeInstanceOf(
            TripArchivedError,
          )
        }
      }
      expect(await collabRows(owner)).toEqual(before)
    })
  })

  describe('a row of another trip', () => {
    let otherTripId: string
    let otherRows: CollabRowIds

    beforeEach(async () => {
      const other = await createTrip(owner, {
        title: 'Faro, another time',
        slug: 'faro-another-time',
        startDate: '2026-06-01',
        endDate: '2026-06-02',
      })
      otherTripId = other.id
      await addTripMember(owner, {
        tripId: otherTripId,
        userId: editor.ctx.userId,
        role: 'editor',
      })
      otherRows = await seedCollabRows(owner, otherTripId)
    })

    it('is not found when its id is paired with a trip the caller can write', async () => {
      const before = await collabRows(owner)

      for (const scope of [owner, editor]) {
        for (const [label, write] of rowWriters(scope, tripId, otherRows)) {
          expect(await captureError(write), label).toBeInstanceOf(NotFoundError)
        }
      }
      expect(await collabRows(owner)).toEqual(before)
    })

    it('is not found for a viewer either, before any role is checked', async () => {
      const before = await collabRows(owner)

      for (const [label, write] of rowWriters(viewer, tripId, otherRows)) {
        expect(await captureError(write), label).toBeInstanceOf(NotFoundError)
      }
      expect(await collabRows(owner)).toEqual(before)
    })

    it('cannot be replied to from this trip', async () => {
      const before = await collabRows(owner)

      expect(
        await captureError(() =>
          postMessage(owner, {
            tripId,
            body: 'A reply across trips',
            replyToId: otherRows.messageId,
          }),
        ),
      ).toBeInstanceOf(NotFoundError)
      expect(await collabRows(owner)).toEqual(before)
    })

    it('can be replied to from its own trip', async () => {
      const reply = await postMessage(editor, {
        tripId: otherTripId,
        body: 'A reply on the same trip',
        replyToId: otherRows.messageId,
      })

      expect(
        (await collabMessagesRepository.requireById(owner, reply.id)).replyToId,
      ).toBe(otherRows.messageId)
    })
  })
})
