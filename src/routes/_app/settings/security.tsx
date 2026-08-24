import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import {
  BadgeCheck,
  Fingerprint,
  KeyRound,
  LogOut,
  MailCheck,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import { toast } from 'sonner'

import { ErrorPanel } from '#/components/layout/error-state'
import { SIGN_OUT_ENDPOINT } from '#/components/layout/session'
import { Alert, Badge, Button, Card, Skeleton } from '#/components/ui'
import { useLocale, useTranslate } from '#/lib/i18n'
import { loadSecurity } from '../-server/settings'
import { formatDate } from '../-lib/format'
import { SettingsRow, SettingsSection } from '../-ui/settings-nav'

import type { ReactNode } from 'react'

export const Route = createFileRoute('/_app/settings/security')({
  loader: () => loadSecurity(),
  pendingComponent: SecurityPending,
  errorComponent: SecurityError,
  component: SecurityPage,
})

function SecurityError({ error }: { error: unknown }) {
  const t = useTranslate()
  return <ErrorPanel error={error} title={t('settings.security.error')} />
}

/** A row label with its glyph, so the four sign-in rows scan as one column. */
function RowLabel({
  icon,
  children,
}: {
  icon: ReactNode
  children: ReactNode
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span aria-hidden className="text-ink-4">
        {icon}
      </span>
      {children}
    </span>
  )
}

function SecurityPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
  const t = useTranslate()
  const locale = useLocale()
  const [signingOut, setSigningOut] = useState(false)

  async function signOut(): Promise<void> {
    setSigningOut(true)
    try {
      const response = await fetch(SIGN_OUT_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      if (!response.ok) {
        throw new Error(`Sign out failed with ${response.status}`)
      }
      await router.invalidate()
      // An untyped href: the sign-in routes live outside this tree.
      window.location.assign('/login')
    } catch {
      toast.error(t('settings.security.signOut.failed'), {
        description: t('settings.security.signOut.failedBody'),
      })
      setSigningOut(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {data.emailVerified ? null : (
        <Alert
          tone="warning"
          title={t('settings.security.unverified.title')}
          actions={
            <Button asChild variant="secondary" size="sm" shape="pill">
              {/* The verification flow lives outside the authenticated tree. */}
              <a href="/verify-email">
                {t('settings.security.unverified.action')}
              </a>
            </Button>
          }
        >
          {t('settings.security.unverified.body', { email: data.email })}
        </Alert>
      )}

      <SettingsSection
        title={t('settings.security.signin.title')}
        description={t('settings.security.signin.description')}
      >
        <div className="flex flex-col">
          <SettingsRow
            label={
              <RowLabel icon={<MailCheck className="size-4" />}>
                {t('settings.security.email.label')}
              </RowLabel>
            }
            hint={data.email}
            control={
              <div className="flex sm:justify-end">
                <Badge
                  tone={data.emailVerified ? 'success' : 'warning'}
                  size="lg"
                  icon={data.emailVerified ? <BadgeCheck /> : <TriangleAlert />}
                >
                  {data.emailVerified
                    ? t('settings.security.email.verified')
                    : t('settings.security.email.unverified')}
                </Badge>
              </div>
            }
          />

          <SettingsRow
            label={
              <RowLabel icon={<KeyRound className="size-4" />}>
                {t('settings.security.password.label')}
              </RowLabel>
            }
            hint={t('settings.security.password.hint')}
            control={
              <div className="flex sm:justify-end">
                <Button asChild variant="secondary" size="sm" shape="pill">
                  <a href="/reset-password">
                    {t('settings.security.password.action')}
                  </a>
                </Button>
              </div>
            }
          />

          <SettingsRow
            label={
              <RowLabel icon={<ShieldCheck className="size-4" />}>
                {t('settings.security.twoFactor.label')}
              </RowLabel>
            }
            hint={
              data.twoFactorEnabled
                ? t('settings.security.twoFactor.onHint')
                : t('settings.security.twoFactor.offHint')
            }
            control={
              <div className="flex items-center gap-2 sm:justify-end">
                <Badge
                  tone={data.twoFactorEnabled ? 'success' : 'neutral'}
                  size="lg"
                >
                  {data.twoFactorEnabled
                    ? t('settings.security.twoFactor.on')
                    : t('settings.security.twoFactor.off')}
                </Badge>
                <Button
                  asChild
                  variant={data.twoFactorEnabled ? 'ghost' : 'secondary'}
                  size="sm"
                  shape="pill"
                >
                  <a href="/two-factor">
                    {data.twoFactorEnabled
                      ? t('settings.security.twoFactor.manage')
                      : t('settings.security.twoFactor.enable')}
                  </a>
                </Button>
              </div>
            }
          />

          <SettingsRow
            label={
              <RowLabel icon={<Fingerprint className="size-4" />}>
                {t('settings.security.passkeys.label')}
              </RowLabel>
            }
            hint={t('settings.security.passkeys.hint')}
            control={
              <div className="flex sm:justify-end">
                <Button asChild variant="secondary" size="sm" shape="pill">
                  <a href="/passkeys">
                    {t('settings.security.passkeys.action')}
                  </a>
                </Button>
              </div>
            }
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title={t('settings.security.session.title')}
        description={t('settings.security.session.description')}
      >
        <div className="flex flex-col">
          <SettingsRow
            label={t('settings.security.session.label')}
            hint={data.email}
            control={
              <p className="text-label tabular-nums text-ink-3 sm:text-end">
                {data.sessionExpiresAt === null
                  ? t('settings.security.session.noExpiry')
                  : t('settings.security.session.expires', {
                      date:
                        formatDate(data.sessionExpiresAt, locale) ??
                        t('settings.security.session.expiresSoon'),
                    })}
              </p>
            }
          />
          <SettingsRow
            label={t('settings.security.signOut.label')}
            hint={t('settings.security.signOut.hint')}
            control={
              <div className="flex sm:justify-end">
                <Button
                  variant="danger"
                  size="sm"
                  shape="pill"
                  loading={signingOut}
                  loadingLabel={t('settings.security.signOut.pending')}
                  onClick={() => {
                    void signOut()
                  }}
                >
                  <LogOut aria-hidden data-mirror-rtl />
                  {t('settings.security.signOut.label')}
                </Button>
              </div>
            }
          />
        </div>
      </SettingsSection>
    </div>
  )
}

function SecurityPending() {
  const t = useTranslate()
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">{t('ui.status.loading')}</span>
      <Card className="space-y-5">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="flex items-center justify-between gap-6">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-40" radius="sm" />
              <Skeleton className="h-2.5 w-64" radius="sm" />
            </div>
            <Skeleton className="h-8 w-28 shrink-0" radius="full" />
          </div>
        ))}
      </Card>
    </div>
  )
}
