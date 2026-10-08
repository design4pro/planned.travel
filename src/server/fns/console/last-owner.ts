/**
 * Which workspaces would be left without an owner if one account were deleted.
 *
 * Better Auth's `organization()` plugin already refuses the three in-product ways to strand a
 * workspace - removing the last owner, the last owner leaving, the last owner demoting themselves
 * (`__tests__/last-owner.test.ts` pins all three on the real instance). The one path it cannot see
 * is `auth.api.removeUser`, which deletes the `user` row and lets `member.user_id ON DELETE CASCADE`
 * take the membership with it: no organization hook runs, and a workspace other people still belong
 * to is left with nobody who can administer its members, its billing or its deletion.
 *
 * This module is the counting and not the refusal itself, and it holds no query: the reads live in
 * `./adapter-reads` (`readWorkspaceOwnership`), where every query in this directory is executed by
 * the tests as itself, and `./target` turns the answer into a {@link ConsoleActionError}.
 *
 * **Counted per workspace, and only for the target's own.** An owner of A is not rescued by the
 * owners of B: a fellow row counts only toward the workspace it names.
 *
 * **A workspace with nobody else in it is not a stranded one.** Every account has a personal
 * workspace it solely owns and nothing in the product deletes a workspace, so refusing every sole
 * owner would refuse nearly every deletion. What this refuses is taking the owner away from people.
 *
 * **Fails closed.** A page that comes back full, or a row that is not a membership, is an answer of
 * "could not tell" rather than a shorter list - a truncated read that decided on what it saw would
 * let the one deletion it exists to stop through.
 */

import { z } from 'zod'

/**
 * How many `member` rows one read may return. The plugin caps a workspace at 100 members and an
 * account at `WORKSPACE_LIMIT` workspaces, so a full page is not an ordinary account.
 */
export const OWNERSHIP_READ_LIMIT = 1000

const membershipSchema = z.object({
  organizationId: z.string(),
  role: z.string(),
})

export type OwnershipRow = z.output<typeof membershipSchema>

export type OwnershipRead =
  | {
      readonly complete: true
      /** Every membership the target holds. */
      readonly own: ReadonlyArray<OwnershipRow>
      /** Everyone else's membership in the workspaces the target owns. */
      readonly others: ReadonlyArray<OwnershipRow>
    }
  | { readonly complete: false }

/**
 * Whether a stored `member.role` makes its holder an owner: the plugin's own rule, which splits on
 * commas and trims, so `admin,owner` is an owner and `co-owner` is not.
 */
export function isOwnerRole(role: string): boolean {
  return role.split(',').some((part) => part.trim() === 'owner')
}

/** Parses a page, or `null` when it is full or holds a row that is not a membership. */
export function readOwnershipPage(
  rows: ReadonlyArray<unknown>,
  limit: number,
): ReadonlyArray<OwnershipRow> | null {
  if (rows.length >= limit) return null
  const parsed: Array<OwnershipRow> = []
  for (const row of rows) {
    const membership = membershipSchema.safeParse(row)
    if (!membership.success) return null
    parsed.push(membership.data)
  }
  return parsed
}

/**
 * The ids of the workspaces the target owns alone and other people still belong to.
 *
 * Pure, so the matrix of cases is a table and not a fixture.
 */
export function findSoleOwnedWorkspaces(
  read: Extract<OwnershipRead, { complete: true }>,
): ReadonlyArray<string> {
  const owned = new Set(
    read.own
      .filter((row) => isOwnerRole(row.role))
      .map((row) => row.organizationId),
  )
  const hasOtherOwner = new Set<string>()
  const hasOtherMember = new Set<string>()

  for (const row of read.others) {
    hasOtherMember.add(row.organizationId)
    if (isOwnerRole(row.role)) hasOtherOwner.add(row.organizationId)
  }

  return [...owned].filter(
    (id) => hasOtherMember.has(id) && !hasOtherOwner.has(id),
  )
}

/** Workspace names a refusal lists before it says "and N more". */
const NAMED_WORKSPACES = 5

/** Longest workspace name a refusal quotes, so a long one cannot crowd out the advice. */
const NAME_LENGTH = 60

/**
 * One workspace name as a refusal quotes it.
 *
 * The name is wrapped in first-strong isolates (U+2068 ... U+2069): the sentence is English in every
 * locale, and an Arabic or Hebrew name inside it would otherwise split the sentence into two runs
 * that display in reverse order.
 */
function quoted(name: string): string {
  const shown =
    name.length > NAME_LENGTH ? `${name.slice(0, NAME_LENGTH - 1)}…` : name
  return `\u2068"${shown}"\u2069`
}

/** The target's own workspace names as one noun phrase for a refusal sentence. */
export function describeWorkspaces(names: ReadonlyArray<string>): string {
  if (names.length === 0) return 'a workspace'
  const listed = names.slice(0, NAMED_WORKSPACES).map(quoted).join(', ')
  const more = names.length - NAMED_WORKSPACES
  return more > 0 ? `${listed} and ${more} more` : listed
}
