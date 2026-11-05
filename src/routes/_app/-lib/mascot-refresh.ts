import {
  subscribeWorkspaceClaim,
  workspaceClaimState,
} from '#/lib/workspace-claim-store'

type DashboardRouter = {
  invalidate: (options: { sync: true }) => Promise<void>
  state: { matches: ReadonlyArray<{ routeId: string; status: string }> }
}

export async function refreshMascotDashboard(
  router: DashboardRouter,
): Promise<boolean> {
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
  if (workspaceClaimState().organizationId !== organizationId) return false
  await router.invalidate({ sync: true })
  return (
    router.state.matches.some(
      (match) =>
        match.routeId === '/_app/dashboard' && match.status === 'success',
    ) && router.state.matches.every((match) => match.status === 'success')
  )
}
