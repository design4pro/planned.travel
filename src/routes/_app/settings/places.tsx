import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Card, Skeleton } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { loadTaxonomyFn } from '#/server/fns/taxonomy'
import { TaxonomyEditor } from '../-ui/taxonomy-editor'
import { RouteError } from './-ui/route-error'

export const Route = createFileRoute('/_app/settings/places')({
  loader: () => loadTaxonomyFn({ data: {} }),
  component: PlacesSettings,
  pendingComponent: CategoriesPending,
  errorComponent: CategoriesError,
})
function PlacesSettings() {
  const initial = Route.useLoaderData()
  const { shell } = Route.useRouteContext()
  const router = useRouter()
  return (
    <TaxonomyEditor
      key={shell.session.organization?.id}
      initial={initial}
      canManage={shell.session.user.isAdmin}
      reload={async () => {
        await router.invalidate()
        return loadTaxonomyFn({ data: {} })
      }}
    />
  )
}
function CategoriesPending() {
  const t = useTranslate()
  return (
    <Card aria-busy="true">
      <span className="sr-only">{t('ui.status.loading')}</span>
      <div className="space-y-4">
        {Array.from({ length: 4 }, (_, index) => (
          <Skeleton key={index} className="h-12 w-full" />
        ))}
      </div>
    </Card>
  )
}
function CategoriesError({ error }: { error: unknown }) {
  const t = useTranslate()
  return <RouteError error={error} title={t('settings.taxonomy.loadFailed')} />
}
