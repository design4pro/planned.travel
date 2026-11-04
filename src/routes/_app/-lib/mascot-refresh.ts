type DashboardRouter = {
  invalidate: (options: { sync: true }) => Promise<void>
  state: { matches: ReadonlyArray<{ routeId: string; status: string }> }
}

export async function refreshMascotDashboard(
  router: DashboardRouter,
): Promise<boolean> {
  await router.invalidate({ sync: true })
  return (
    router.state.matches.some(
      (match) =>
        match.routeId === '/_app/dashboard' && match.status === 'success',
    ) && router.state.matches.every((match) => match.status === 'success')
  )
}
