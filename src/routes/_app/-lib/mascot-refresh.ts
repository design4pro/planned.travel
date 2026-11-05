import {
  subscribeWorkspaceClaim,
  workspaceClaimGeneration,
  workspaceClaimState,
} from '#/lib/workspace-claim-store'

export async function refreshMascotDashboard<T>(
  read: () => Promise<T>,
): Promise<T | null> {
  const organizationId = workspaceClaimState().organizationId
  while (workspaceClaimState().switching) {
    await new Promise<void>((resolve) => {
      const unsubscribe = subscribeWorkspaceClaim(() => {
        if (!workspaceClaimState().switching) {
          unsubscribe()
          resolve()
        }
      })
    })
  }
  const current = workspaceClaimState()
  if (current.stale || current.organizationId !== organizationId) return null
  const generation = workspaceClaimGeneration()
  const result = await read()
  const next = workspaceClaimState()
  if (
    next.stale ||
    next.switching ||
    next.organizationId !== organizationId ||
    workspaceClaimGeneration() !== generation
  )
    return null
  return result
}
