/**
 * Unscoped exception: findLiveTripInviteByDigestUnscoped takes Database for a digest point lookup.
 * Its sole production caller is src/server/public/trip-invite.ts. It returns coordinates only
 * (link id, workspace, trip, granted role, rotation, creator), never tenant content, the secret or
 * the digest. Everything after it reads through a scope built from a verified workspace membership.
 */
/**
 * The trip invite link: one rotating link per trip that puts members of the trip's workspace on the
 * trip (`.ai/specs/2026-10-08-the-trip-invite-link.md`).
 *
 * The secret is derived, never stored: `src/server/security/secret.ts` computes it from the link id
 * and its `rotation`, and the row keeps only the SHA-256 digest. So the owner can copy the same link
 * again, every read here returns no secret field, and only {@link revealTripInviteSecret} - behind
 * the trip's `owner` role - hands one out. A new digest always comes with a new rotation.
 *
 * ## Who can write
 *
 * Every verb is a trip owner's: {@link requireTrip}, then the owner assert, then the archived check,
 * inside the repository so it holds for a route, a seed script and a queue consumer alike. The one
 * exception is {@link touchTripInvite}, which a successful join calls under the joiner's own scope.
 *
 * ## Concurrency
 *
 * D1 has no interactive transaction. Create is insert-if-absent on the unique `trip_id` index, so a
 * double tap or a second owner gets the existing link back. Replace and update are compare-and-set on
 * `rotation` in the `UPDATE`'s own `WHERE`, so a concurrent replace or switch is reported
 * (`changed`) and never overwritten. A role change keeps the rotation (the copies already sent stay
 * valid), so two role changes made at once are last-write-wins.
 *
 * ## The takeover rule
 *
 * `created_by` and `rotated_at` move only inside {@link rotate}, together with a new rotation and a
 * new digest: replace and switch-on. A link whose creator is gone therefore never returns with its
 * old secret, and a role change or a switch-off takes nothing over.
 *
 * ## Liveness
 *
 * A link resolves only while its creator is still an owner of the trip and a member of the link's
 * workspace and is not banned, both memberships older than `rotated_at` (a creator who was removed
 * and re-added does not bring back copies already forwarded), the trip is not archived, the link is
 * not switched off and its stored role is still in {@link TRIP_INVITE_ROLES}. The unscoped finder and
 * the scoped state read share one predicate, {@link creatorStillLive}. Demoting an owner and promoting
 * them again leaves the same membership row, so that one case does revive the link: the person is an
 * owner again, and any owner can replace it.
 */

import { and, eq, exists, inArray, sql } from 'drizzle-orm'
import { z } from 'zod'
import { member, user, ORGANIZATION_ROLES } from '#/server/db/auth-schema'
import {
  TRIP_INVITE_ROLES,
  newId,
  tripInviteLinks,
  tripMembers,
  trips,
} from '#/server/db/schema'
import {
  TRIP_INVITE_PURPOSE,
  deriveSecret,
  hashSecret,
} from '#/server/security/secret'
import { allOf, createTenantRepository, tenantFilter } from './base'
import { NotFoundError } from './context'
import { TripArchivedError, assertTripRole, requireTrip } from './trips'
import { idSchema } from './validation'
import type { SQL } from 'drizzle-orm'
import type { Database } from '#/server/db/types'
import type { TenantScope } from './base'

export const tripInviteLinksRepository = createTenantRepository(
  tripInviteLinks,
  'trip invite link',
)

export type TripInviteRole = (typeof TRIP_INVITE_ROLES)[number]

const tripInviteRoleSchema = z.enum(TRIP_INVITE_ROLES)

/** What an owner sees of a link: derived from the row, the trip and the creator's standing. */
export type TripInviteState =
  'active' | 'off' | 'stale' | 'creator-gone' | 'archived'

/** The non-secret fields of a link. There is no `token` and no `secret` here, on purpose. */
export interface TripInviteView {
  readonly id: string
  readonly tripId: string
  readonly role: TripInviteRole
  readonly rotation: number
  readonly createdBy: string
  readonly rotatedAt: Date
  readonly disabledAt: Date | null
  readonly lastUsedAt: Date | null
  readonly useCount: number
  readonly state: TripInviteState
}

/** A view and, only while the link resolves right now, the secret that opens it. */
export interface TripInviteWritten {
  readonly invite: TripInviteView
  readonly secret: string | null
}

export type TripInviteReplaced =
  | ({ readonly ok: true } & TripInviteWritten)
  | {
      readonly ok: false
      readonly reason: 'changed'
      readonly invite: TripInviteView
    }

export type TripInviteUpdated =
  | ({ readonly ok: true } & TripInviteWritten)
  | {
      readonly ok: false
      readonly reason: 'changed' | 'creatorGone'
      readonly invite: TripInviteView
    }

const keySchema = z.string().min(1)
const rotationSchema = z.number().int().nonnegative()

const createInput = z.strictObject({
  role: tripInviteRoleSchema,
  key: keySchema,
})
export type CreateTripInviteInput = z.input<typeof createInput>

const replaceInput = z.strictObject({
  role: tripInviteRoleSchema,
  expectedRotation: rotationSchema,
  key: keySchema,
})
export type ReplaceTripInviteInput = z.input<typeof replaceInput>

const updateInput = z.strictObject({
  role: tripInviteRoleSchema.optional(),
  enabled: z.boolean().optional(),
  expectedRotation: rotationSchema,
  key: keySchema,
})
export type UpdateTripInviteInput = z.input<typeof updateInput>

/* -------------------------------------------------------------------------------------------------
 * Liveness
 * ---------------------------------------------------------------------------------------------- */

/** Not banned right now: a ban with no expiry, or one that has not expired, refuses. */
function notBanned(now: Date): SQL {
  return sql`not (coalesce(${user.banned}, 0) = 1 and (${user.banExpires} is null or ${user.banExpires} > ${now.getTime()}))`
}

/**
 * The link's creator is an owner of its trip and a member of its workspace, unbanned, both
 * memberships no newer than the link's `rotated_at`. Correlated on the outer `trip_invite_links` row
 * and matched on that row's own `organization_id`, because `trip_id` is not a composite foreign key.
 */
function creatorStillLive(db: Database, now: Date): SQL {
  return allOf(
    exists(
      db
        .select({ present: sql`1` })
        .from(tripMembers)
        .where(
          and(
            eq(tripMembers.tripId, tripInviteLinks.tripId),
            eq(tripMembers.organizationId, tripInviteLinks.organizationId),
            eq(tripMembers.userId, tripInviteLinks.createdBy),
            eq(tripMembers.role, 'owner'),
            sql`${tripInviteLinks.rotatedAt} >= ${tripMembers.createdAt}`,
          ),
        ),
    ),
    exists(
      db
        .select({ present: sql`1` })
        .from(member)
        .innerJoin(user, eq(user.id, member.userId))
        .where(
          and(
            eq(member.organizationId, tripInviteLinks.organizationId),
            eq(member.userId, tripInviteLinks.createdBy),
            inArray(member.role, [...ORGANIZATION_ROLES]),
            sql`${tripInviteLinks.rotatedAt} >= ${member.createdAt}`,
            notBanned(now),
          ),
        ),
    ),
  )
}

/** The narrow answer of the digest lookup: coordinates, never content, secret or digest. */
export interface LiveTripInvite {
  readonly id: string
  readonly organizationId: string
  readonly tripId: string
  readonly role: TripInviteRole
  readonly rotation: number
  readonly createdBy: string
}

/**
 * The single credential-to-tenant lookup for a trip invite link. A dead link of any kind - unknown
 * digest, switched off, role outside the allowed set, archived trip, creator no longer an owner of
 * the trip, no longer a member of the workspace, banned, or no longer the secret the current key
 * derives - is the same `null`, from one statement and one derivation.
 */
export async function findLiveTripInviteByDigestUnscoped(
  db: Database,
  digest: string,
  key: string,
  now = new Date(),
): Promise<LiveTripInvite | null> {
  const [row] = await db
    .select({
      id: tripInviteLinks.id,
      organizationId: tripInviteLinks.organizationId,
      tripId: tripInviteLinks.tripId,
      role: tripInviteLinks.role,
      rotation: tripInviteLinks.rotation,
      createdBy: tripInviteLinks.createdBy,
    })
    .from(tripInviteLinks)
    .innerJoin(
      trips,
      and(
        eq(trips.id, tripInviteLinks.tripId),
        eq(trips.organizationId, tripInviteLinks.organizationId),
        eq(trips.isArchived, false),
      ),
    )
    .where(
      allOf(
        eq(tripInviteLinks.token, digest),
        sql`${tripInviteLinks.disabledAt} is null`,
        inArray(tripInviteLinks.role, [...TRIP_INVITE_ROLES]),
        creatorStillLive(db, now),
      ),
    )
    .limit(1)
  if (!row) return null
  const role = tripInviteRoleSchema.safeParse(row.role)
  if (!role.success) return null
  // The digest alone still matches a copy sent before the derivation key was rotated. Deriving the
  // secret again from the link and the current key is what makes a key rotation fail closed for
  // every caller of this lookup, not only for one that remembers to check.
  const derived = await deriveSecret(
    TRIP_INVITE_PURPOSE,
    key,
    row.id,
    row.rotation,
  )
  if ((await hashSecret(derived)) !== digest) return null
  return { ...row, role: role.data }
}

/* -------------------------------------------------------------------------------------------------
 * Reads
 * ---------------------------------------------------------------------------------------------- */

type TripInviteRow = typeof tripInviteLinks.$inferSelect

interface Loaded {
  readonly row: TripInviteRow
  readonly live: boolean
  readonly archived: boolean
}

/** The caller is an owner of a trip they may see; the archived flag comes back for the state. */
async function requireOwnedTrip(
  scope: TenantScope,
  tripId: string,
): Promise<{ readonly id: string; readonly archived: boolean }> {
  const id = idSchema.parse(tripId)
  const trip = await requireTrip(scope, id)
  await assertTripRole(scope, id, ['owner'])
  return { id, archived: trip.isArchived }
}

/** Like {@link requireOwnedTrip}, and an archived trip refuses every write. */
async function requireWritableOwnedTrip(
  scope: TenantScope,
  tripId: string,
): Promise<string> {
  const { id, archived } = await requireOwnedTrip(scope, tripId)
  if (archived) throw new TripArchivedError()
  return id
}

async function loadLink(
  scope: TenantScope,
  tripId: string,
  archived: boolean,
): Promise<Loaded | null> {
  const [found] = await scope.db
    .select({
      row: tripInviteLinks,
      live: sql<boolean>`${creatorStillLive(scope.db, new Date())}`.mapWith(
        Boolean,
      ),
    })
    .from(tripInviteLinks)
    .where(
      tenantFilter(scope, tripInviteLinks, eq(tripInviteLinks.tripId, tripId)),
    )
    .limit(1)
  return found ? { row: found.row, live: found.live, archived } : null
}

/** The panel state, most specific first: an archived trip says why before anything else does. */
function stateOf(loaded: Loaded, stale: boolean): TripInviteState {
  if (loaded.archived) return 'archived'
  if (loaded.row.disabledAt !== null) return 'off'
  if (!loaded.live) return 'creator-gone'
  return stale ? 'stale' : 'active'
}

/** The panel state, and the secret only when the link resolves right now. */
async function present(
  loaded: Loaded,
  key: string,
): Promise<TripInviteWritten> {
  const { row } = loaded
  const secret = await deriveSecret(
    TRIP_INVITE_PURPOSE,
    key,
    row.id,
    row.rotation,
  )
  const role = tripInviteRoleSchema.safeParse(row.role)
  // A stored role outside the narrowed set can only be a hand-made row: it is dead, and shown as
  // the least privileged role until a replace writes a valid one.
  const stale = !role.success || (await hashSecret(secret)) !== row.token
  const state = stateOf(loaded, stale)
  return {
    invite: {
      id: row.id,
      tripId: row.tripId,
      role: role.success ? role.data : 'viewer',
      rotation: row.rotation,
      createdBy: row.createdBy,
      rotatedAt: row.rotatedAt,
      disabledAt: row.disabledAt,
      lastUsedAt: row.lastUsedAt,
      useCount: row.useCount,
      state,
    },
    secret: state === 'active' ? secret : null,
  }
}

/**
 * The non-secret state of a trip's link, or `null` when it has none. `key` is the derivation key:
 * `stale` means the secret it derives no longer matches the stored digest.
 */
export async function readTripInvite(
  scope: TenantScope,
  tripId: string,
  key: string,
): Promise<TripInviteView | null> {
  keySchema.parse(key)
  const { id, archived } = await requireOwnedTrip(scope, tripId)
  const loaded = await loadLink(scope, id, archived)
  return loaded ? (await present(loaded, key)).invite : null
}

/** The secret of a link that resolves right now, to a trip owner; `null` otherwise. */
export async function revealTripInviteSecret(
  scope: TenantScope,
  tripId: string,
  key: string,
): Promise<string | null> {
  keySchema.parse(key)
  const { id, archived } = await requireOwnedTrip(scope, tripId)
  const loaded = await loadLink(scope, id, archived)
  return loaded ? (await present(loaded, key)).secret : null
}

/* -------------------------------------------------------------------------------------------------
 * Writes
 * ---------------------------------------------------------------------------------------------- */

/**
 * Creates the trip's link, or returns the existing one unchanged: a double tap or a second owner
 * gets the same link and never a dead URL. Create never bumps a rotation.
 */
export async function createTripInvite(
  scope: TenantScope,
  tripId: string,
  input: CreateTripInviteInput,
): Promise<TripInviteWritten> {
  const values = createInput.parse(input)
  const trip = await requireWritableOwnedTrip(scope, tripId)

  const id = newId()
  const secret = await deriveSecret(TRIP_INVITE_PURPOSE, values.key, id, 0)
  await scope.db
    .insert(tripInviteLinks)
    .values({
      id,
      organizationId: scope.ctx.organizationId,
      tripId: trip,
      token: await hashSecret(secret),
      rotation: 0,
      role: values.role,
      createdBy: scope.ctx.userId,
      rotatedAt: new Date(),
    })
    .onConflictDoNothing({ target: tripInviteLinks.tripId })
  const loaded = await loadLink(scope, trip, false)
  if (!loaded) throw new NotFoundError('trip invite link', trip)
  return present(loaded, values.key)
}

/**
 * Takes the link over with a new secret: a new rotation and digest, the actor as creator, switched
 * on. The only place `created_by` or `rotated_at` change, and always together with the digest,
 * compare-and-set on the rotation the caller saw.
 */
async function rotate(
  scope: TenantScope,
  loaded: Loaded,
  input: { role: TripInviteRole; expectedRotation: number; key: string },
): Promise<TripInviteReplaced> {
  const { row } = loaded
  const rotation = row.rotation + 1
  const secret = await deriveSecret(
    TRIP_INVITE_PURPOSE,
    input.key,
    row.id,
    rotation,
  )
  const [changed] = await scope.db
    .update(tripInviteLinks)
    .set({
      token: await hashSecret(secret),
      rotation,
      role: input.role,
      createdBy: scope.ctx.userId,
      rotatedAt: new Date(),
      disabledAt: null,
    })
    .where(
      tenantFilter(
        scope,
        tripInviteLinks,
        eq(tripInviteLinks.id, row.id),
        eq(tripInviteLinks.rotation, input.expectedRotation),
      ),
    )
    .returning()
  if (!changed) {
    const current = await loadLink(scope, row.tripId, false)
    return {
      ok: false,
      reason: 'changed',
      invite: (await present(current ?? loaded, input.key)).invite,
    }
  }
  // The actor is an owner who just wrote it, so the rewritten link is live.
  return {
    ok: true,
    ...(await present(
      { row: changed, live: true, archived: false },
      input.key,
    )),
  }
}

async function requireLink(
  scope: TenantScope,
  tripId: string,
): Promise<Loaded> {
  const loaded = await loadLink(scope, tripId, false)
  if (!loaded) throw new NotFoundError('trip invite link', tripId)
  return loaded
}

/**
 * Replaces the link's secret; the previous one stops resolving on the next request. A rotation that
 * is not the one the caller saw writes nothing and returns `changed` with the current state.
 */
export async function replaceTripInvite(
  scope: TenantScope,
  tripId: string,
  input: ReplaceTripInviteInput,
): Promise<TripInviteReplaced> {
  const values = replaceInput.parse(input)
  const trip = await requireWritableOwnedTrip(scope, tripId)
  const loaded = await requireLink(scope, trip)
  if (loaded.row.rotation !== values.expectedRotation) {
    return {
      ok: false,
      reason: 'changed',
      invite: (await present(loaded, values.key)).invite,
    }
  }
  return rotate(scope, loaded, values)
}

/**
 * Changes the role or switches the link off or on. A role change touches neither the creator nor the
 * rotation, and a switch-off moves only the rotation (no secret is issued); a switch-on is a replace, so a switched-off link cannot revive copies
 * already sent. A role change on a link whose creator is gone is refused: it has to be replaced.
 */
export async function updateTripInvite(
  scope: TenantScope,
  tripId: string,
  input: UpdateTripInviteInput,
): Promise<TripInviteUpdated> {
  const values = updateInput.parse(input)
  const trip = await requireWritableOwnedTrip(scope, tripId)
  const loaded = await requireLink(scope, trip)
  const { row } = loaded
  if (row.rotation !== values.expectedRotation) {
    return {
      ok: false,
      reason: 'changed',
      invite: (await present(loaded, values.key)).invite,
    }
  }

  if (values.enabled === true && row.disabledAt !== null) {
    const role =
      values.role ?? tripInviteRoleSchema.catch('viewer').parse(row.role)
    return rotate(scope, loaded, {
      role,
      expectedRotation: values.expectedRotation,
      key: values.key,
    })
  }

  const patch: { role?: TripInviteRole; disabledAt?: Date; rotation?: number } =
    {}
  if (values.role !== undefined && values.role !== row.role) {
    if (!loaded.live) {
      return {
        ok: false,
        reason: 'creatorGone',
        invite: (await present(loaded, values.key)).invite,
      }
    }
    patch.role = values.role
  }
  if (values.enabled === false && row.disabledAt === null) {
    patch.disabledAt = new Date()
    // Moves the rotation so a panel that loaded before the switch-off cannot replace the link
    // and quietly switch it on again; the digest and the creator stay as they were.
    patch.rotation = row.rotation + 1
  }
  if (Object.keys(patch).length === 0) {
    return { ok: true, ...(await present(loaded, values.key)) }
  }

  const [changed] = await scope.db
    .update(tripInviteLinks)
    .set(patch)
    .where(
      tenantFilter(
        scope,
        tripInviteLinks,
        eq(tripInviteLinks.id, row.id),
        eq(tripInviteLinks.rotation, values.expectedRotation),
      ),
    )
    .returning()
  if (!changed) {
    const current = await loadLink(scope, trip, false)
    return {
      ok: false,
      reason: 'changed',
      invite: (await present(current ?? loaded, values.key)).invite,
    }
  }
  return {
    ok: true,
    ...(await present(
      { row: changed, live: loaded.live, archived: false },
      values.key,
    )),
  }
}

/**
 * Counts a successful join: `use_count` and `last_used_at`. Called only by a join, never by a read,
 * and under the joiner's own scope, so another workspace's link is a {@link NotFoundError}.
 */
export async function touchTripInvite(
  scope: TenantScope,
  inviteId: string,
): Promise<void> {
  const now = new Date()
  const touched = await scope.db
    .update(tripInviteLinks)
    .set({ useCount: sql`${tripInviteLinks.useCount} + 1`, lastUsedAt: now })
    .where(
      tenantFilter(scope, tripInviteLinks, eq(tripInviteLinks.id, inviteId)),
    )
    .returning({ id: tripInviteLinks.id })
  if (touched.length === 0)
    throw new NotFoundError('trip invite link', inviteId)
}
