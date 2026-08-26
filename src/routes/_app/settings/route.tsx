import { Outlet, createFileRoute } from '@tanstack/react-router'

import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { NotFoundPanel } from '#/components/layout/not-found'
import { PageHeader } from '#/components/layout/page-header'
import { useTranslate } from '#/lib/i18n'
import { SettingsNav } from '../-ui/settings-nav'
import { RouteError } from './-ui/route-error'

/**
 * The settings shell: one persistent index of sections on the left, the section
 * itself on the right. Each section owns its own loader, so opening Appearance
 * never waits on the workspace member list.
 *
 * The boundaries are named components rather than inline arrows because their
 * copy comes from `t()`, and a hook cannot be called from a render prop.
 */
export const Route = createFileRoute('/_app/settings')({
  notFoundComponent: () => (
    <AppFrame>
      <NotFoundPanel />
    </AppFrame>
  ),
  errorComponent: SettingsError,
  component: SettingsLayout,
})

function SettingsError({ error }: { error: unknown }) {
  const t = useTranslate()
  return (
    <AppFrame>
      <RouteError error={error} title={t('settings.page.error')} />
    </AppFrame>
  )
}

function SettingsLayout() {
  const t = useTranslate()

  return (
    <AppFrame>
      <AppSections>
        <PageHeader
          eyebrow={t('settings.page.eyebrow')}
          title={t('settings.page.title')}
          description={t('settings.page.description')}
        />

        <div className="grid gap-6 lg:grid-cols-[15.5rem_minmax(0,1fr)] lg:gap-8">
          <SettingsNav />
          <div className="min-w-0">
            <Outlet />
          </div>
        </div>
      </AppSections>
    </AppFrame>
  )
}
