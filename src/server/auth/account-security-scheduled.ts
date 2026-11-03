import { drizzle } from 'drizzle-orm/d1'
import { authSchema } from '#/server/db/auth-schema'
import { enqueueTasks } from '#/server/queue/jobs'
import { backfillLegacyAuthority } from '#/server/repos/account-security'
import { organizationIdsFor } from './provisioning'
import { sweepAccountSecurity } from './account-security-cleanup'

/** Queue publication is retryable because the scheduled sweep owns durable pending intent. */
export async function sweepScheduledAccountSecurity(env: Pick<Cloudflare.Env, 'DB' | 'SESSIONS' | 'TASKS' | 'BETTER_AUTH_SECRET'>, now: number): Promise<void> {
  const db = drizzle(env.DB, { schema: authSchema })
  if (Reflect.get(env, 'ACCOUNT_SECURITY_ENFORCEMENT') !== 'active') await backfillLegacyAuthority(db, now)
  await sweepAccountSecurity(db, {
    key: env.BETTER_AUTH_SECRET,
    store: env.SESSIONS,
    now,
    workspaces: (userId) => organizationIdsFor(db, userId),
    publish: async (userId, accountSecurityOperationId, organizations) => {
      await enqueueTasks(env.TASKS, organizations.map((orgId) => ({ kind: 'trip-room-evict' as const, orgId, payload: { userId, accountSecurityOperationId } })))
    },
  })
}
