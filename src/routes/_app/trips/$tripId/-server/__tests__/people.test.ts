/**
 * The people module's seam: what it shapes, what it announces, and what it refuses to explain.
 *
 * The authorisation invariants are not here — they are inside the repository writers and are held
 * by `src/server/repos/__tests__/trip-people.test.ts`. What this file covers is the part only this
 * layer can get wrong: the payload it composes, the notification it writes, the statistics it
 * enqueues, and the two refusals it turns into a code the screen has copy for.
 *
 * **The refusal mapping is asserted on {@link attempted} rather than through a handler.** Outside a
 * Start build a `createServerFn` handler's return value is discarded on a direct call — the same
 * framework property `plan-reorder.test.ts` records — so a case driving `removeTripMemberFn` can
 * only assert that it did not throw and that the row survived. Both halves are here: the mapping as
 * itself, and the handlers proving they reach it.
 *
 * Everything below the mocks is real: a fully migrated SQLite database from the Drizzle schema, real
 * repositories, the real fan-out.
 */
import { AsyncLocalStorage } from 'node:async_hooks'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  NotFoundError,
  RepositoryError,
  TripGuestLimitError,
  TripGuestMergeTargetError,
  TripGuestNameTakenError,
  addTripMember,
  createTrip,
  createTripGuest,
  getMembership,
  listTripGuests,
  listNotifications,
  listTripMembers,
  registerGuestRelinker,
  removeMember,
  updateTrip,
} from '#/server/repos'
import {
  captureError,
  createHarness,
  memberUserIds,
} from '#/server/repos/__tests__/harness'

import type * as Repos from '#/server/repos'
import type { Harness, SeededTenant } from '#/server/repos/__tests__/harness'
import type { TenantScope, TripParticipant } from '#/server/repos'
import type { TaskEnvelopeOf } from '#/server/queue/types'

/* ------------------------------------------------------------------ mocking */

const stubs = vi.hoisted(() => ({
  /** The scope `appScope()` resolves to. */
  scope: null as TenantScope | null,
  /** Every envelope the fan-out handed the binding, flattened across batches. */
  sent: [] as Array<unknown>,
  /** When true, `notify()` fails the way an unreachable D1 would. */
  notifyRejects: false,
}))

vi.mock('../../../../-server/context', async () => {
  const { AuthRequirementError } = await import('#/server/auth/tenant')
  return {
    appScope: async (): Promise<unknown> => {
      if (stubs.scope === null) {
        throw new AuthRequirementError(
          'unauthenticated',
          'You need to sign in to continue.',
        )
      }
      return stubs.scope
    },
  }
})

/**
 * The `TASKS` binding. `#/server/auth/env` imports `cloudflare:workers` at module scope, a specifier
 * that does not resolve in the plain-Node project this suite runs in, so it is replaced wholesale.
 */
vi.mock('#/server/auth/env', () => ({
  taskQueue: () => ({
    sendBatch: async (messages: Array<{ body: unknown }>) => {
      stubs.sent.push(...messages.map((message) => message.body))
      return undefined
    },
  }),
}))

/**
 * The repository, as itself, with one seam: `notify` can be made to fail.
 *
 * A failing notification is a real state — D1 refusing one insert after taking another — and the
 * claim being tested is that the add still succeeds through it. Every other export is the shipped
 * one, so the writers under test keep their own guards.
 */
vi.mock('#/server/repos', async (importOriginal) => {
  const actual = await importOriginal<typeof Repos>()
  return {
    ...actual,
    notify: async (
      ...args: Parameters<typeof actual.notify>
    ): ReturnType<typeof actual.notify> => {
      if (stubs.notifyRejects) {
        throw new Error('D1_ERROR: the notification was not written')
      }
      return actual.notify(...args)
    },
  }
})

/* ------------------------------------------------------------ start context */

interface StartContext {
  readonly startOptions: Record<string, never>
  readonly request: Request
}

const startStorage = ((): AsyncLocalStorage<StartContext> => {
  const key = Symbol.for('tanstack-start:start-storage-context')
  const globals = globalThis as Record<symbol, unknown>
  globals[key] ??= new AsyncLocalStorage<StartContext>()
  return globals[key] as AsyncLocalStorage<StartContext>
})()

function startContext(): StartContext {
  return {
    startOptions: {},
    request: new Request('https://planned.travel/_serverFn/people', {
      method: 'POST',
    }),
  }
}

const {
  addTripGuestFn,
  addTripMemberFn,
  attempted,
  leaveTripFn,
  mergeGuestIntoMember,
  readTripPeople,
  removeTripGuestFn,
  removeTripMemberFn,
  renameTripGuestFn,
  setTripRoleFn,
  setTripVisibilityFn,
  setTripVisibilityInput,
} = await import('../people')

/** Runs a handler inside a request context, the way the runtime does. */
async function inRequest<T>(run: () => Promise<T>): Promise<T> {
  return startStorage.run(startContext(), run)
}

/** The envelopes as themselves, so a payload can be read without a cast at every assertion. */
function envelopes(): Array<TaskEnvelopeOf<'travel-stats'>> {
  return stubs.sent as Array<TaskEnvelopeOf<'travel-stats'>>
}

/* -------------------------------------------------------------------- setup */

interface Fixture {
  readonly tripId: string
  /** On the trip as an `editor`. */
  readonly editorId: string
  /** On the trip as a `viewer`. */
  readonly viewerId: string
  /** In the workspace, not on the trip. */
  readonly outsiderId: string
}

let harness: Harness
let tenant: SeededTenant
let owner: TenantScope
let fixture: Fixture

beforeEach(async () => {
  harness = await createHarness()
  tenant = await harness.seedTenant('planner')
  owner = tenant.scope
  stubs.scope = owner
  stubs.sent = []
  stubs.notifyRejects = false

  const editorId = await tenant.addUser('An editor')
  const viewerId = await tenant.addUser('A reader')
  const outsiderId = await tenant.addUser('Not on this trip')

  const trip = await createTrip(owner, {
    title: 'Vienna in October',
    startDate: '2026-10-05',
    endDate: '2026-10-07',
    currency: 'EUR',
  })
  await addTripMember(owner, {
    tripId: trip.id,
    userId: editorId,
    role: 'editor',
  })
  await addTripMember(owner, {
    tripId: trip.id,
    userId: viewerId,
    role: 'viewer',
  })

  fixture = { tripId: trip.id, editorId, viewerId, outsiderId }
})

/** The membership row of one user on the fixture's trip. */
async function memberIdOf(userId: string): Promise<string> {
  const row = (await listTripMembers(owner, fixture.tripId)).find(
    (entry) => entry.userId === userId,
  )
  if (row === undefined) {
    throw new Error(`${userId} is not on the trip.`)
  }
  return row.id
}

/* --------------------------------------------------------------- the payload */

describe('readTripPeople', () => {
  it('offers the workspace minus the people already on the trip', async () => {
    // The subject is *who* is offered, so the two non-owners are asserted as a set. The order
    // between them is not something the read model promises: `listTripMembers` orders by
    // `[created_at, id]`, the fixture writes both memberships inside one millisecond, and the tie
    // then falls to the random tail of `newId()` — which decided this assertion at random until
    // #472. Owner-first *is* promised, so that half stays an ordered claim.
    const payload = await readTripPeople(owner, fixture.tripId)
    const participants = memberUserIds(payload.participants)

    expect(participants).toHaveLength(3)
    expect(participants[0]).toBe(tenant.ownerUserId)
    expect(new Set(participants.slice(1))).toEqual(
      new Set([fixture.editorId, fixture.viewerId]),
    )
    expect(payload.invitable.map((person) => person.userId)).toEqual([
      fixture.outsiderId,
    ])
  })

  it('hands a non-owner no roster at all', async () => {
    // Not "the roster, filtered": a reader who cannot invite is not told who else is in the
    // workspace. The list is the answer to "who can I add", and for them there is none.
    const payload = await readTripPeople(
      tenant.scopeFor(fixture.editorId),
      fixture.tripId,
    )

    expect(payload.viewerRole).toBe('editor')
    expect(payload.invitable).toEqual([])
    expect(memberUserIds(payload.participants)).toHaveLength(3)
  })

  it('drops somebody who has left the workspace from both lists', async () => {
    // The trip membership row survives; the workspace one does not — `removeMember` takes the
    // `member` row and nothing cascades to `trip_members`. `listUserProfiles` then answers nothing
    // for them, and a nameless row is worse than no row.
    const workspaceRow = await getMembership(owner, fixture.viewerId)
    await removeMember(owner, workspaceRow?.id ?? '')

    const payload = await readTripPeople(owner, fixture.tripId)

    expect(memberUserIds(payload.participants)).toEqual([
      tenant.ownerUserId,
      fixture.editorId,
    ])
    expect(payload.invitable.map((person) => person.userId)).toEqual([
      fixture.outsiderId,
    ])
  })

  it('carries no email address anywhere on the wire', async () => {
    // The harness gives every seeded user `<id>@example.test`, so the whole class is one substring.
    // Asserted on the serialised payload rather than field by field, because what matters is that
    // no projection anywhere in it kept the address.
    const payload = await readTripPeople(owner, fixture.tripId)

    expect(JSON.stringify(payload)).not.toContain('@example.test')
  })

  it('reports a stored `public` rather than deriving two positions from three', async () => {
    // Nothing in the product writes `'public'` yet, so it is written through the repository, which
    // takes all three values — it is this module's validator that has two positions. The card has
    // to report it: deriving `visibility === 'organization'` would render a public trip as "only
    // the people listed here can see this trip", which is the opposite of true, and the owner's
    // first flip would then write the downgrade the validator exists to refuse.
    await updateTrip(owner, fixture.tripId, { visibility: 'public' })

    expect((await readTripPeople(owner, fixture.tripId)).visibility).toBe(
      'public',
    )
  })

  it('answers a non-member of an organization-visible trip with a null role', async () => {
    await updateTrip(owner, fixture.tripId, { visibility: 'organization' })

    const payload = await readTripPeople(
      tenant.scopeFor(fixture.outsiderId),
      fixture.tripId,
    )

    expect(payload.viewerRole).toBeNull()
    expect(payload.invitable).toEqual([])
    expect(memberUserIds(payload.participants)).toHaveLength(3)
  })
})

/* ------------------------------------------------------------- the refusals */

describe('attempted', () => {
  class LastOwner extends RepositoryError {
    constructor() {
      super('A trip keeps at least one owner.', 'TRIP_LAST_OWNER')
    }
  }
  class NotInWorkspace extends RepositoryError {
    constructor() {
      super('That person is not a member.', 'TRIP_MEMBER_NOT_IN_WORKSPACE')
    }
  }

  it('spreads a success', async () => {
    expect(await attempted(async () => ({ memberId: 'm1' }))).toEqual({
      ok: true,
      memberId: 'm1',
    })
  })

  it('turns the two expected refusals into a code the screen has copy for', async () => {
    expect(
      await attempted(async () => {
        throw new LastOwner()
      }),
    ).toEqual({ ok: false, reason: 'last-owner' })

    expect(
      await attempted(async () => {
        throw new NotInWorkspace()
      }),
    ).toEqual({ ok: false, reason: 'not-in-workspace' })
  })

  it('turns the three guest refusals into codes too', async () => {
    for (const [error, reason] of [
      [new TripGuestNameTakenError('Anna'), 'guest-name-taken'],
      [new TripGuestLimitError(), 'guest-limit'],
      [new TripGuestMergeTargetError(), 'guest-merge-target'],
    ] as const) {
      expect(
        await attempted(async () => {
          throw error
        }),
      ).toEqual({ ok: false, reason })
    }
  })

  it('lets every other failure through untouched', async () => {
    // `FORBIDDEN` and `NOT_FOUND` are states this screen never offers a control for, so they belong
    // in the shared boundary's generic failure rather than in a sentence beside a row.
    const forbidden = new RepositoryError('Not allowed.', 'FORBIDDEN')
    await expect(
      attempted(async () => {
        throw forbidden
      }),
    ).rejects.toBe(forbidden)

    const unexpected = new Error('D1_ERROR')
    await expect(
      attempted(async () => {
        throw unexpected
      }),
    ).rejects.toBe(unexpected)
  })
})

/* -------------------------------------------------------------- the handlers */

describe('addTripMemberFn', () => {
  it('writes the membership, announces it, and moves that one person’s statistics', async () => {
    await inRequest(() =>
      addTripMemberFn({
        data: {
          tripId: fixture.tripId,
          userId: fixture.outsiderId,
          role: 'editor',
        },
      }),
    )

    const added = (await listTripMembers(owner, fixture.tripId)).find(
      (row) => row.userId === fixture.outsiderId,
    )
    expect(added?.role).toBe('editor')

    const inbox = (await listNotifications(owner, fixture.outsiderId)).items
    expect(inbox).toHaveLength(1)
    expect(inbox[0]?.titleKey).toBe('shell.notification.trip.invited.title')
    expect(inbox[0]?.bodyKey).toBe('shell.notification.trip.invited.body')
    expect(inbox[0]?.titleParams).toEqual({ tripTitle: 'Vienna in October' })
    expect(inbox[0]?.bodyParams).toEqual({ actorName: 'Owner planner' })
    expect(inbox[0]?.actionUrl).toBe(`/trips/${fixture.tripId}`)

    // One person, not the trip: nobody else's trip count changed. Two envelopes because the trip
    // moves the all-time roll-up and the year it starts in.
    expect(
      new Set(envelopes().map((envelope) => envelope.payload.userId)),
    ).toEqual(new Set([fixture.outsiderId]))
    expect(
      new Set(envelopes().map((envelope) => envelope.payload.statYear)),
    ).toEqual(new Set([0, 2026]))
  })

  it('still succeeds when the notification fails', async () => {
    // The membership row is the write and D1 has already taken it. Raising would report a failure
    // for an add that happened, and no caller can retry the notification on its own.
    stubs.notifyRejects = true

    await inRequest(() =>
      addTripMemberFn({
        data: {
          tripId: fixture.tripId,
          userId: fixture.outsiderId,
          role: 'viewer',
        },
      }),
    )

    expect(
      (await listTripMembers(owner, fixture.tripId)).map((row) => row.userId),
    ).toContain(fixture.outsiderId)
    expect((await listNotifications(owner, fixture.outsiderId)).items).toEqual(
      [],
    )
    // The fan-out runs after the notification, so a swallowed failure must not have skipped it.
    expect(envelopes().length).toBeGreaterThan(0)
  })

  it('does not catch the owner assert', async () => {
    stubs.scope = tenant.scopeFor(fixture.editorId)

    const error = await captureError(() =>
      inRequest(() =>
        addTripMemberFn({
          data: {
            tripId: fixture.tripId,
            userId: fixture.outsiderId,
            role: 'viewer',
          },
        }),
      ),
    )

    expect(error).toBeInstanceOf(RepositoryError)
    expect((error as RepositoryError).code).toBe('FORBIDDEN')
    expect(
      (await listTripMembers(owner, fixture.tripId)).map((row) => row.userId),
    ).not.toContain(fixture.outsiderId)
  })
})

describe('removeTripMemberFn and leaveTripFn', () => {
  it('moves the statistics of the person who left, and of nobody else', async () => {
    const memberId = await memberIdOf(fixture.viewerId)
    await inRequest(() =>
      removeTripMemberFn({ data: { tripId: fixture.tripId, memberId } }),
    )

    expect(memberUserIds(await readPeople())).toEqual([
      tenant.ownerUserId,
      fixture.editorId,
    ])
    expect(
      new Set(envelopes().map((envelope) => envelope.payload.userId)),
    ).toEqual(new Set([fixture.viewerId]))
  })

  it('refuses a membership that belongs to another trip', async () => {
    const other = await createTrip(owner, {
      title: 'Porto in June',
      currency: 'EUR',
    })
    const strayId = (await listTripMembers(owner, other.id))[0]?.id ?? ''

    const error = await captureError(() =>
      inRequest(() =>
        setTripRoleFn({
          data: { tripId: fixture.tripId, memberId: strayId, role: 'viewer' },
        }),
      ),
    )

    expect(error).toBeInstanceOf(NotFoundError)
  })

  it('lets a viewer take themselves off, and refuses a sole owner the same verb', async () => {
    stubs.scope = tenant.scopeFor(fixture.viewerId)
    await inRequest(() => leaveTripFn({ data: { tripId: fixture.tripId } }))

    stubs.scope = owner
    expect(memberUserIds(await readPeople())).toEqual([
      tenant.ownerUserId,
      fixture.editorId,
    ])

    // The trip's only owner leaving is self-removal, and the last-owner guard runs before the
    // exemption. The handler answers the refusal rather than throwing — which on this path is
    // observable only as "it did not throw, and the row is still there".
    stubs.sent = []
    await inRequest(() => leaveTripFn({ data: { tripId: fixture.tripId } }))

    expect(memberUserIds(await readPeople())).toContain(tenant.ownerUserId)
    // A refused write enqueues nothing: the fan-out sits behind the repository call.
    expect(envelopes()).toEqual([])
  })
})

describe('setTripVisibilityFn', () => {
  it('writes the two positions the switch has', async () => {
    await inRequest(() =>
      setTripVisibilityFn({
        data: { tripId: fixture.tripId, visibility: 'organization' },
      }),
    )

    expect((await readTripPeople(owner, fixture.tripId)).visibility).toBe(
      'organization',
    )
  })

  it('refuses `public` at the validator, before any repository call', async () => {
    const parsed = setTripVisibilityInput.safeParse({
      tripId: fixture.tripId,
      visibility: 'public',
    })

    expect(parsed.success).toBe(false)
    expect((await readTripPeople(owner, fixture.tripId)).visibility).toBe(
      'private',
    )
  })
})

/** The fixture trip's participants, as the screen would receive them. */
async function readPeople(): Promise<ReadonlyArray<TripParticipant>> {
  return (await readTripPeople(owner, fixture.tripId)).participants
}

/* ------------------------------------------------------------------- guests */

describe('guests', () => {
  async function guestNames(): Promise<Array<string>> {
    return (await listTripGuests(owner, fixture.tripId)).map(
      (guest) => guest.displayName,
    )
  }

  it('carries the guests after the members, and names the bound', async () => {
    await createTripGuest(owner, { tripId: fixture.tripId, displayName: 'Anna' })

    const payload = await readTripPeople(owner, fixture.tripId)

    expect(payload.participants.at(-1)).toMatchObject({
      kind: 'guest',
      displayName: 'Anna',
    })
    expect(payload.guestLimit).toBe(50)
  })

  it('adds, renames and removes a guest, notifying nobody and moving no statistics', async () => {
    await inRequest(() =>
      addTripGuestFn({ data: { tripId: fixture.tripId, displayName: 'Anna' } }),
    )
    const guestId = (await listTripGuests(owner, fixture.tripId))[0]?.id ?? ''

    await inRequest(() =>
      renameTripGuestFn({
        data: { tripId: fixture.tripId, guestId, displayName: 'Hanna' },
      }),
    )
    expect(await guestNames()).toEqual(['Hanna'])

    await inRequest(() =>
      removeTripGuestFn({ data: { tripId: fixture.tripId, guestId } }),
    )
    expect(await guestNames()).toEqual([])
    expect(envelopes()).toEqual([])
  })

  it('answers a duplicate as a refusal rather than a failure, and writes nothing', async () => {
    await createTripGuest(owner, { tripId: fixture.tripId, displayName: 'Anna' })

    // The handler's answer is discarded outside a Start build; "did not throw, and there is still
    // one Anna" is what is observable here, and `attempted` above holds the mapping itself.
    await inRequest(() =>
      addTripGuestFn({
        data: { tripId: fixture.tripId, displayName: ' ANNA ' },
      }),
    )

    expect(await guestNames()).toEqual(['Anna'])
  })

  it('does not catch the owner assert', async () => {
    stubs.scope = tenant.scopeFor(fixture.editorId)

    const error = await captureError(() =>
      inRequest(() =>
        addTripGuestFn({
          data: { tripId: fixture.tripId, displayName: 'Anna' },
        }),
      ),
    )

    expect((error as RepositoryError).code).toBe('FORBIDDEN')
    expect(await guestNames()).toEqual([])
  })

  it('refuses a guest that belongs to another trip', async () => {
    const other = await createTrip(owner, { title: 'Porto in June' })
    const stray = await createTripGuest(owner, {
      tripId: other.id,
      displayName: 'Anna',
    })

    const error = await captureError(() =>
      inRequest(() =>
        removeTripGuestFn({
          data: { tripId: fixture.tripId, guestId: stray.id },
        }),
      ),
    )

    expect(error).toBeInstanceOf(NotFoundError)
    expect(await listTripGuests(owner, other.id)).toHaveLength(1)
  })

  describe('the merge', () => {
    it('resolves the member, merges, and reports what each relinker moved', async () => {
      const guest = await createTripGuest(owner, {
        tripId: fixture.tripId,
        displayName: 'Anna',
      })
      const unregister = registerGuestRelinker('probe', async () => ({
        count: 4,
        statements: [],
      }))
      try {
        const memberId = await memberIdOf(fixture.editorId)

        expect(
          await mergeGuestIntoMember(owner, {
            tripId: fixture.tripId,
            guestId: guest.id,
            memberId,
          }),
        ).toEqual({ memberId, relinked: { probe: 4 } })
      } finally {
        unregister()
      }
      expect(await guestNames()).toEqual([])
    })

    it('answers a membership of another trip as the merge-target refusal', async () => {
      const guest = await createTripGuest(owner, {
        tripId: fixture.tripId,
        displayName: 'Anna',
      })
      const other = await createTrip(owner, { title: 'Porto in June' })
      const strayId = (await listTripMembers(owner, other.id))[0]?.id ?? ''

      expect(
        await attempted(() =>
          mergeGuestIntoMember(owner, {
            tripId: fixture.tripId,
            guestId: guest.id,
            memberId: strayId,
          }),
        ),
      ).toEqual({ ok: false, reason: 'guest-merge-target' })
      expect(await guestNames()).toEqual(['Anna'])
    })
  })
})
