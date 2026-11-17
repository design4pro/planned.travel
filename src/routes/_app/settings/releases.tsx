import { createFileRoute } from '@tanstack/react-router'
import { useI18n } from '#/lib/i18n'
import { loadReleaseHistory } from '#/server/fns/release-history'
import { ReleaseHistory } from './-ui/release-history'
import type { ReleaseHistoryInput } from '#/server/fns/-lib/release-history'

export const Route = createFileRoute('/_app/settings/releases')({
  component: ReleasesPage,
})
const load = (data: ReleaseHistoryInput) => loadReleaseHistory({ data })
function ReleasesPage() {
  const { locale } = useI18n()
  return <ReleaseHistory key={locale} load={load} />
}
