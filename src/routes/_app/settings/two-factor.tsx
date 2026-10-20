import { createFileRoute } from '@tanstack/react-router'
import { Skeleton } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { loadSecurity } from '../-server/settings'
import { RouteError } from './-ui/route-error'
import { TwoFactorSettings } from './-ui/two-factor-page'

export const Route = createFileRoute('/_app/settings/two-factor')({
  loader: () => loadSecurity(),
  pendingComponent: () => <Skeleton className="h-96 rounded-xl" />,
  errorComponent: TwoFactorError,
  component: TwoFactorPage,
})
function TwoFactorError({ error }: { error: unknown }) {
  const t = useTranslate()
  return <RouteError error={error} title={t('settings.twoFactor.error')} />
}
function TwoFactorPage() {
  const data = Route.useLoaderData()
  return <TwoFactorSettings twoFactorEnabled={data.twoFactorEnabled} />
}
