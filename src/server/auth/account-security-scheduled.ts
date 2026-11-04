import { drizzle } from 'drizzle-orm/d1'
import { authSchema } from '#/server/db/auth-schema'
import { enqueueTasks } from '#/server/queue/jobs'
import {
  retireAccountSecurityMetadata,
  recoverAccountDeletions,
  expandAccountAuthority,
} from './account-authority'
import { readParticipantBackfillMarker } from '#/server/erasure/participant-backfill-marker'
import { sweepAccountSecurity } from './account-security-cleanup'

/** Queue publication is retryable because the scheduled sweep owns durable pending intent. */
export async function sweepScheduledAccountSecurity(
  env: Pick<
    Cloudflare.Env,
    'DB' | 'KV' | 'SESSIONS' | 'TASKS' | 'BETTER_AUTH_SECRET'
  >,
  now: number,
): Promise<void> {
  const db = drizzle(env.DB, { schema: authSchema })
  const results = await Promise.allSettled([
    (async () => {
      if (Reflect.get(env, 'ACCOUNT_SECURITY_ENFORCEMENT') !== 'active')
        await expandAccountAuthority(
          db,
          now,
          await readParticipantBackfillMarker(env.KV),
        )
    })(),
    recoverAccountDeletions(db, now, async (userId) => {
      const { getAuth } = await import('./index')
      await (await getAuth().$context).internalAdapter.deleteUser(userId)
    }),
    retireAccountSecurityMetadata(db, now),
    sweepAccountSecurity(db, {
      key: env.BETTER_AUTH_SECRET,
      store: env.SESSIONS,
      now,
      discoveryDb: drizzle(env.DB),
      publish: async (userId, accountSecurityOperationId, organizations) => {
        await enqueueTasks(
          env.TASKS,
          organizations.map((orgId) => ({
            kind: 'trip-room-evict' as const,
            orgId,
            payload: { userId, accountSecurityOperationId },
          })),
        )
      },
    }),
  ])
  if (results.some((result) => result.status === 'rejected'))
    throw new Error('Account security maintenance remains pending.')
}
