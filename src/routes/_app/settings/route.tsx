import { Outlet, createFileRoute } from '@tanstack/react-router'

import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { NotFoundPanel } from '#/components/layout/not-found'
import { PageHeader } from '#/components/layout/page-header'
import { SettingsNav } from '../-ui/settings-nav'

/**
 * The settings shell: one persistent index of sections on the left, the section
 * itself on the right. Each section owns its own loader, so opening Appearance
 * never waits on the workspace member list.
 */
export const Route = createFileRoute('/_app/settings')({
  notFoundComponent: () => (
    <AppFrame>
      <NotFoundPanel />
    </AppFrame>
  ),
  errorComponent: ({ error }) => (
    <AppFrame>
      <ErrorPanel error={error} title="Settings did not load" />
    </AppFrame>
  ),
  component: SettingsLayout,
})

function SettingsLayout() {
  return (
    <AppFrame>
      <AppSections>
        <PageHeader
          eyebrow="Account"
          title="Settings"
          description="Everything about you, your workspace and how planned.travel behaves"
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
