import type { WorkspaceDeletion } from '#/server/db/types'

type RecoveryRow = Pick<
  WorkspaceDeletion,
  'id' | 'state' | 'requestedAt' | 'updatedAt'
>

export interface WorkspaceDeletionRecoveryPorts {
  now: () => Date
  listStale: (now: Date) => Promise<ReadonlyArray<RecoveryRow>>
  advance: (id: string) => Promise<unknown>
  /** Emit workspace-deletion.stuck at error severity, without workspace content. */
  stuck: (id: string) => void
}

/** The production quarter-hour slot advances directly; it never depends on a queue message. */
export async function recoverWorkspaceDeletions(
  ports: WorkspaceDeletionRecoveryPorts,
) {
  const now = ports.now()
  const rows = (await ports.listStale(now))
    .filter(
      (row) =>
        row.state !== 'done' &&
        row.state !== 'refused' &&
        now.getTime() - row.updatedAt.getTime() > 15 * 60_000,
    )
    .slice(0, 5)
  return Promise.allSettled(
    rows.map(async (row) => {
      if (now.getTime() - row.requestedAt.getTime() > 7 * 86_400_000)
        ports.stuck(row.id)
      return ports.advance(row.id)
    }),
  )
}
