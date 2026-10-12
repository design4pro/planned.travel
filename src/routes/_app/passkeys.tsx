import { Link, createFileRoute } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'

import { AppFrame, AppSections } from '#/components/layout/app-frame'
import { PageHeader } from '#/components/layout/page-header'
import { Button } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { PasskeyManager } from './-ui/passkey-manager'

/**
 * The passkeys of the signed-in person. `settings/security` already links here; this is the
 * destination. No loader: the passkey endpoints are cookie-authenticated HTTP handlers, so the
 * manager reads them from the browser (docs/SPEC.md §6).
 */
export const Route = createFileRoute('/_app/passkeys')({
  component: PasskeysPage,
})

function PasskeysPage() {
  const t = useTranslate()

  return (
    <AppFrame>
      <AppSections>
        <PageHeader
          eyebrow={t('settings.passkeys.page.eyebrow')}
          title={t('settings.passkeys.page.title')}
          description={t('settings.passkeys.page.description')}
          actions={
            <Button asChild variant="ghost" size="sm" shape="pill">
              <Link to="/settings/security">
                <ArrowLeft aria-hidden data-mirror-rtl />
                {t('settings.passkeys.page.back')}
              </Link>
            </Button>
          }
        />
        <PasskeyManager />
      </AppSections>
    </AppFrame>
  )
}
