import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { Building2, ShieldCheck } from 'lucide-react'
import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { PageHeader } from '#/components/layout/page-header'
import { Button, Card, EmptyState } from '#/components/ui'
import { useI18n, useTranslate } from '#/lib/i18n'
import { loadAdmin } from '../-server/overview'
import { formatDate } from '../-lib/format'
import { HeaderSkeleton, RowsSkeleton, StatsSkeleton } from '../-ui/scaffold'
import { ConsoleTabs } from './-ui/console-tabs'
import { planLabel } from './-ui/console-panels'

export const Route = createFileRoute('/_app/admin')({
  loader: () => loadAdmin(),
  pendingComponent: AdminPending,
  errorComponent: AdminError,
  component: AdminPage,
})

function AdminError({ error }: { error: unknown }) {
  const t = useTranslate()
  return (
    <AppFrame>
      <ErrorPanel error={error} title={t('shell.admin.error')} />
    </AppFrame>
  )
}

function AdminPage() {
  const data = Route.useLoaderData()
  const { t, locale } = useI18n()
  if (data === null)
    return (
      <AppFrame>
        <Card variant="dashed" padding="none" className="bg-surface-2">
          <EmptyState
            size="lg"
            icon={<ShieldCheck />}
            title={t('shell.admin.denied.title')}
            description={t('shell.admin.denied.body')}
            action={
              <Button asChild variant="primary" shape="pill">
                <Link to="/dashboard">{t('shell.admin.denied.action')}</Link>
              </Button>
            }
          />
        </Card>
      </AppFrame>
    )
  const plan = planLabel(data.plan, t)
  return (
    <AppFrame>
      <AppSections>
        <PageHeader
          eyebrow={t('shell.admin.eyebrow')}
          title={data.organization.name}
          description={t('shell.admin.description', {
            plan,
            date:
              formatDate(data.organization.createdAt, locale) ??
              t('shell.admin.createdUnknown'),
          })}
          actions={
            <>
              <Button asChild variant="secondary" size="sm" shape="pill">
                <Link to="/settings/organization">
                  <Building2 aria-hidden />
                  {t('shell.admin.workspaceSettings')}
                </Link>
              </Button>
              <Button asChild variant="primary" size="sm" shape="pill">
                <Link to="/settings/billing">{t('shell.admin.billing')}</Link>
              </Button>
            </>
          }
        />
        <ConsoleTabs />
        <Outlet />
      </AppSections>
    </AppFrame>
  )
}

function AdminPending() {
  return (
    <AppFrame>
      <AppSections>
        <HeaderSkeleton />
        <StatsSkeleton />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem] xl:gap-8">
          <Card variant="inset" padding="none">
            <RowsSkeleton rows={6} />
          </Card>
          <Card variant="inset" padding="none">
            <RowsSkeleton rows={4} />
          </Card>
        </div>
      </AppSections>
    </AppFrame>
  )
}
