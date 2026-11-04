import { createFileRoute } from '@tanstack/react-router'
import { ErrorPanel } from '#/components/layout/error-state'
import { useTranslate } from '#/lib/i18n'
import { Route as AdminRoute } from './route'
import { ConsolePanels } from './-ui/console-panels'

export const Route = createFileRoute('/_app/admin/members')({
  component: Room,
  errorComponent: RoomError,
})

function Room() {
  const data = AdminRoute.useLoaderData()
  const t = useTranslate()
  if (data === null) return null
  return <section id="workspace-console-room" tabIndex={-1} aria-label={t('shell.admin.nav.members')}><h2 className="mb-4 font-display text-subtitle font-bold">{t('shell.admin.nav.members')}</h2><ConsolePanels data={data} room="members" /></section>
}

function RoomError({ error }: { error: unknown }) {
  const t = useTranslate()
  return <ErrorPanel error={error} title={t('shell.admin.members.error')} />
}
