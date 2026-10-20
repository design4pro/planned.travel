/**
 * Session-less erasure catalog (SPEC §5, ADR 0043).
 * Discovery stays ids-only, keyset-paged and read-only. The participation backfill is the sole
 * production importer until the engine lands. Worker-only scrub primitives additionally require an
 * explicit system PlatformActor before every query. They erase global auth leftovers, revoke and
 * anonymise staff tokens, anonymise provider attribution and count the remaining platform places.
 * Invitations retain an explicit organization predicate. No tenant content table is read or written;
 * user/member/anchor and the platform audit ledger are never mutated here. The engine must supply
 * verified job identity, durable session cleanup and its permission/audit boundary when wiring them.
 * Catalog code never imports the tenant repository layer.
 */

import { and, asc, count, eq, gt, inArray, or, sql } from 'drizzle-orm'
import { z } from 'zod'
import {
  invitation,
  organization,
  session,
  verification,
} from '#/server/db/auth-schema'
import {
  workspaceParticipants,
  staffApiTokens,
  providerRegistry,
} from '#/server/db/schema'
import type { PlatformActor } from '#/server/auth/guard'

import type { Database } from '#/server/db/types'

/** The most rows one page returns, whatever the caller asks for. */
export const ERASURE_CATALOG_MAX_PAGE_SIZE = 100

/** A workspace a person took part in, and the erasure (if any) already running for them there. */
export interface HeldWorkspace {
  readonly organizationId: string
  readonly erasureId: string | null
}

/** One page of a keyset-paged listing. `next` is the cursor for the page after, `null` at the end. */
export interface CatalogPage<TItem> {
  readonly items: ReadonlyArray<TItem>
  readonly next: string | null
}

export interface PageOptions {
  /** Exclusive keyset cursor: the last organization id of the previous page. */
  readonly after?: string | null
  /** Clamped to {@link ERASURE_CATALOG_MAX_PAGE_SIZE}. */
  readonly limit?: number
}

function clampedLimit(limit: number | undefined): number {
  const requested = limit ?? ERASURE_CATALOG_MAX_PAGE_SIZE
  return Math.min(
    Math.max(Math.floor(requested), 1),
    ERASURE_CATALOG_MAX_PAGE_SIZE,
  )
}

/**
 * The workspaces whose participation anchor names `userId`, including those the person has left.
 * Ordered by organization id, so the cursor is the last id of the page.
 */
export async function listWorkspacesHoldingUser(
  db: Database,
  userId: string,
  options: PageOptions = {},
): Promise<CatalogPage<HeldWorkspace>> {
  const limit = clampedLimit(options.limit)
  const rows = await db
    .select({
      organizationId: workspaceParticipants.organizationId,
      erasureId: workspaceParticipants.erasureId,
    })
    .from(workspaceParticipants)
    .where(
      and(
        eq(workspaceParticipants.userId, userId),
        options.after
          ? gt(workspaceParticipants.organizationId, options.after)
          : undefined,
      ),
    )
    .orderBy(asc(workspaceParticipants.organizationId))
    .limit(limit + 1)

  const items = rows.slice(0, limit)
  const last = items.at(-1)
  return {
    items,
    next: rows.length > limit && last ? last.organizationId : null,
  }
}

/**
 * Every organization id, in id order, for the one-off participation backfill: a message handles the
 * next organization after its cursor and hands the cursor on.
 */
export async function listOrganizationIds(
  db: Database,
  options: PageOptions = {},
): Promise<CatalogPage<string>> {
  const limit = clampedLimit(options.limit)
  const rows = await db
    .select({ id: organization.id })
    .from(organization)
    .where(options.after ? gt(organization.id, options.after) : undefined)
    .orderBy(asc(organization.id))
    .limit(limit + 1)

  const items = rows.slice(0, limit).map((row) => row.id)
  const last = items.at(-1)
  return { items, next: rows.length > limit && last ? last : null }
}

const erasureSystemActor = z.object({
  actorKind: z.literal('system'),
  userId: z.null(),
  role: z.null(),
  tokenId: z.null(),
})
const erasureUserId = z
  .string()
  .min(1)
  .refine((value) => !value.startsWith('erased_'))
const erasureEmail = z.email().transform((value) => value.trim().toLowerCase())
const formerMember = z.string().regex(/^erased_[A-Za-z0-9_-]+$/)

/** Auth invitation rows have a tenant key; unlike global credentials, another workspace stays intact. */
export async function eraseWorkspaceInvitations(
  db: Database,
  actor: PlatformActor,
  organizationId: string,
  email: string,
): Promise<void> {
  erasureSystemActor.parse(actor)
  const org = z.string().min(1).parse(organizationId)
  const address = erasureEmail.parse(email)
  await db
    .delete(invitation)
    .where(
      and(
        eq(invitation.organizationId, org),
        sql`lower(${invitation.email}) = ${address}`,
      ),
    )
}

/**
 * Global auth leftovers only: user/member/anchor and sent invitations are left for the final cascade.
 * Installed Better Auth stores reset-password, 2fa and trust-device identities as exact values;
 * revoke-unproven-account-access keys contain the id. OTP keys contain the whole email, and our
 * passkey plugin stores a JSON userId. Never use substring matching: ids and emails can overlap.
 * The required manifest callback saves impersonated-session tokens for the engine's KV cleanup
 * before their only D1 reference disappears. No token or personal value may be logged.
 */
export async function eraseAccountAuthLeftovers(
  db: Database,
  actor: PlatformActor,
  identity: { readonly userId: string; readonly email: string },
  prepareSessionRemoval: (tokens: ReadonlyArray<string>) => Promise<void>,
): Promise<void> {
  erasureSystemActor.parse(actor)
  const userId = erasureUserId.parse(identity.userId)
  const email = erasureEmail.parse(identity.email)
  for (;;) {
    const sessions = await db
      .select({ id: session.id, token: session.token })
      .from(session)
      .where(eq(session.impersonatedBy, userId))
      .limit(40)
    if (sessions.length === 0) break
    await prepareSessionRemoval(sessions.map((row) => row.token))
    await db.delete(session).where(
      and(
        eq(session.impersonatedBy, userId),
        inArray(
          session.id,
          sessions.map((row) => row.id),
        ),
      ),
    )
  }
  await db.delete(verification).where(
    or(
      inArray(verification.identifier, [
        userId,
        `revoke-unproven-account-access:${userId}`,
        `reset-password:${userId}`,
        `passkey-challenge:${userId}`,
      ]),
      sql`lower(${verification.identifier}) = ${email}`,
      inArray(
        sql`lower(${verification.identifier})`,
        ['email-verification', 'sign-in', 'forget-password'].map(
          (type) => `${type}-otp-${email}`,
        ),
      ),
      eq(verification.value, userId),
      sql`(case when json_valid(${verification.value}) then json_extract(${verification.value}, '$.userId') else null end) = ${userId}`,
    ),
  )
}

/** Revoke credentials held by the person; erasing an issuer alone never revokes another holder. */
export async function erasePlatformUserReferences(
  db: Database,
  actor: PlatformActor,
  userId: string,
  formerMemberId: string,
): Promise<void> {
  erasureSystemActor.parse(actor)
  const person = erasureUserId.parse(userId)
  const replacement = formerMember.parse(formerMemberId)
  await db
    .update(staffApiTokens)
    .set({
      userId: replacement,
      revokedAt: sql`coalesce(${staffApiTokens.revokedAt}, ${Date.now()})`,
    })
    .where(eq(staffApiTokens.userId, person))
  await db
    .update(staffApiTokens)
    .set({ createdBy: replacement })
    .where(eq(staffApiTokens.createdBy, person))
  await db
    .update(providerRegistry)
    .set({ updatedBy: replacement })
    .where(eq(providerRegistry.updatedBy, person))
}

/** Counts for verifyErasure({ platform }); the append-only platform ledger is deliberately excluded. */
export async function countPlatformUserReferences(
  db: Database,
  actor: PlatformActor,
  userId: string,
): Promise<Array<{ readonly place: string; readonly count: number }>> {
  erasureSystemActor.parse(actor)
  const person = erasureUserId.parse(userId)
  const [holder] = await db
    .select({ value: count() })
    .from(staffApiTokens)
    .where(eq(staffApiTokens.userId, person))
  const [issuer] = await db
    .select({ value: count() })
    .from(staffApiTokens)
    .where(eq(staffApiTokens.createdBy, person))
  const [provider] = await db
    .select({ value: count() })
    .from(providerRegistry)
    .where(eq(providerRegistry.updatedBy, person))
  return [
    { place: 'staff_api_tokens.user_id', count: holder?.value ?? 0 },
    { place: 'staff_api_tokens.created_by', count: issuer?.value ?? 0 },
    { place: 'provider_registry.updated_by', count: provider?.value ?? 0 },
  ]
}
