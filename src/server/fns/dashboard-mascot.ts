import { createServerFn } from '@tanstack/react-start'
import { serverNow } from '#/server/clock'
import { listMascotNotifications } from '#/server/repos/mascot-notifications'
import { listMascotScheduled } from '#/server/repos/mascot-scheduled'
import { loadMascotCandidates } from './-lib/dashboard-mascot'
import { appScope } from './context'

export const loadDashboardMascot = createServerFn({ method: 'GET' }).handler(
  async () => {
    const scope = await appScope()
    const now = serverNow()
    const result = await loadMascotCandidates({
      notifications: async () =>
        (await listMascotNotifications(scope, now)).map((row) => ({
          source: 'notification' as const,
          id: row.id,
          occurrence: row.createdAt.toISOString(),
          action: row.type === 'action',
        })),
      scheduled: async () => {
        const scheduled = await listMascotScheduled(
          scope,
          now.toISOString().slice(0, 10),
        )
        return {
          ...scheduled,
          candidates: scheduled.candidates.flatMap((row) =>
            row.occurrence === null
              ? []
              : [{ ...row, occurrence: row.occurrence }],
          ),
        }
      },
    })
    return { ...result, nowMs: now.getTime() }
  },
)
