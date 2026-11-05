import { createFileRoute } from '@tanstack/react-router'
import { ErrorPanel } from '#/components/layout/error-state'
import { useTranslate } from '#/lib/i18n'
import { Route as AdminRoute } from './route'
import { ConsolePanels } from './-ui/console-panels'

export const Route = createFileRoute('/_app/admin/')({
  component: Room,
  errorComponent: RoomError,
})

function Room() {
  const data = AdminRoute.useLoaderData()
  const t = useTranslate()
  if (data === null) return null
  return (
    <section
      id="workspace-console-room"
      tabIndex={-1}
      className="flex min-w-0 flex-col gap-6"
      aria-label={t('shell.admin.nav.overview')}
    >
      <h2 className="font-display text-subtitle font-bold">
        {t('shell.admin.nav.overview')}
      </h2>
      <ConsolePanels data={data} room="overview" />
    </section>
  )
}

function RoomError({ error }: { error: unknown }) {
  const t = useTranslate()
  return <ErrorPanel error={error} title={t('shell.admin.error')} />
}
