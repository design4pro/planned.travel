/** Primary authority is supplied by the trusted auth adapter, never a request's role claim. */
import { z } from 'zod'
import { requirePermission } from './guard'
import type { getAuth } from '#/server/auth'
import type { AuthSession } from './tenant'
import type { PlatformActor } from './guard'

export type ReleaseAuthority = {
  session: AuthSession | null
  adapter: Pick<
    Awaited<ReturnType<typeof getAuth>['$context']>['adapter'],
    'findOne'
  >
}
const primaryUserSchema = z.object({
  id: z.string(),
  role: z.string().nullable(),
  banned: z.boolean(),
})

export async function requireReleasePermission(
  authority: ReleaseAuthority,
  action: 'review' | 'publish',
): Promise<PlatformActor> {
  const session = authority.session
  if (
    !session ||
    session.session.userId !== session.user.id ||
    session.session.expiresAt.getTime() <= Date.now()
  ) {
    requirePermission(null, { release: [action] })
    throw new Error('Release authority required.')
  }
  const primary = primaryUserSchema.parse(
    await authority.adapter.findOne({
      model: 'user',
      where: [{ field: 'id', value: session.user.id }],
      select: ['id', 'role', 'banned'],
    }),
  )
  if (primary.id !== session.user.id)
    throw new Error('Release authority mismatch.')
  requirePermission(
    { ...session, user: { ...session.user, ...primary } },
    { release: [action] },
  )
  return {
    userId: primary.id,
    role: primary.role,
    actorKind: 'human',
    tokenId: null,
  }
}
