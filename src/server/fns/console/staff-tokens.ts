/**
 * The MCP-credential half of a platform role change (docs/ACCESS.md §5).
 *
 * §5's first sentence is the whole argument: "a static bearer token carries its owner's whole
 * platform role with no scopes of any kind", which is why `staff_api_tokens` rows are issued to
 * `curator` accounts only. A role change moves the authority the token carries without touching the
 * token, so the credential sitting in somebody's `~/.claude.json` silently becomes something nobody
 * issued — full platform authority if the account was promoted to `admin`, and authority the account
 * no longer holds anywhere else if it was demoted. §5 answers both the same way: the token "is
 * revoked by that role change, in the same call, audited as `platform.token.revoked`".
 *
 * Revocation stamps `revoked_at` and never deletes the row. That is not tidiness: the `token_id`
 * column of `platform_audit_log` is a foreign key with `on delete restrict`, and every past `agent`
 * row joins through it to answer "which agent did this, on whose authority, with which credential".
 * A deleted token row would either refuse the delete or take that answer with it.
 *
 * **Where this statement lives, and where it belongs.** SPEC §6 puts all SQL in `server/repos` with
 * `server/catalog` as the single stated exception, and SPEC §5 names `src/server/catalog/repo.ts` as
 * the door for the eight global tables that are not the audit log. That file is Faza C's and does
 * not exist, and this revocation cannot wait for it: `staff_api_tokens` ships in this phase, and a
 * role change that leaves a live credential behind is the defect §5 was written to prevent. So the
 * statement is here, in the directory that owns the action, written against a `Database` handle it
 * is given rather than one it reaches for — the same shape `./session-keys` has, and the shape that
 * makes it a one-import move into `catalog/repo.ts` the day that file exists. The move is reported
 * with this item rather than performed from it.
 *
 * Nothing here reaches a binding, a request or the auth instance, which is what lets
 * `__tests__/console.test.ts` drive it against the real table built from the real Drizzle schema.
 */

import { and, eq, isNull } from 'drizzle-orm'

import { staffApiTokens } from '#/server/db/schema'

import type { PlatformRole } from '#/server/auth/access'
import type { Database } from '#/server/db/types'

/**
 * A credential that was live and is not any more.
 *
 * Neither `token_hash` nor anything derived from it is carried. The hash is the verifier, the
 * plaintext is shown once and never stored, and a row kept for 400 days is the last place either
 * belongs. `token_prefix` is the non-secret display fragment the console renders, which is what
 * makes a `platform.token.revoked` row legible to a human reading it a year later.
 */
export interface RevokedStaffToken {
  readonly id: string
  readonly name: string
  readonly tokenPrefix: string
  readonly expiresAt: Date
  readonly revokedAt: Date
}

/**
 * Revokes every live credential an account holds, in one statement, and says which they were.
 *
 * The predicate is `user_id = ? and revoked_at is null`, which is exactly
 * `staff_api_tokens_user_revoked_idx`. An already-revoked row is left alone, so a repeated call is a
 * no-op and writes no second audit row — worth having, because the caller runs this after a mutation
 * that has already committed and a retry is the sane recovery from a failure here.
 *
 * Expiry is not in the predicate. An expired-but-unrevoked row still *claims* to be live, and after
 * a role change no such claim should stand; stamping it costs one row and removes the need for a
 * reader to compare two columns to know what a credential's state was.
 *
 * `UPDATE … RETURNING` rather than a read followed by a write: one statement cannot interleave with
 * a token issued between the two halves, and D1 supports it. The returned `revoked_at` is typed
 * nullable because the column is, and is read back rather than assumed so the audit row records the
 * instant the database stored.
 */
export async function revokeStaffApiTokensOf(
  db: Database,
  userId: string,
  revokedAt: Date,
): Promise<ReadonlyArray<RevokedStaffToken>> {
  const rows = await db
    .update(staffApiTokens)
    .set({ revokedAt })
    .where(
      and(eq(staffApiTokens.userId, userId), isNull(staffApiTokens.revokedAt)),
    )
    .returning({
      id: staffApiTokens.id,
      name: staffApiTokens.name,
      tokenPrefix: staffApiTokens.tokenPrefix,
      expiresAt: staffApiTokens.expiresAt,
      revokedAt: staffApiTokens.revokedAt,
    })

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    tokenPrefix: row.tokenPrefix,
    expiresAt: row.expiresAt,
    revokedAt: row.revokedAt ?? revokedAt,
  }))
}

/**
 * The audit `changes` view of a credential: what it was, who held it, and whether it was live.
 *
 * Both sides of a `platform.token.revoked` entry are built from this, so `before` and `after` carry
 * the same key set and the only keys that move are `ownerRole` and `revokedAt` — which is precisely
 * the sentence the row exists to record.
 */
export function staffTokenAuditState(
  token: RevokedStaffToken,
  ownerRole: PlatformRole,
  revokedAt: Date | null,
): Record<string, unknown> {
  return {
    name: token.name,
    tokenPrefix: token.tokenPrefix,
    ownerRole,
    expiresAt: token.expiresAt.toISOString(),
    revokedAt: revokedAt?.toISOString() ?? null,
  }
}
