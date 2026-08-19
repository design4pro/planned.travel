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
import { loadSecurity } from '../-server/settings'
import { formatDate } from '../-lib/format'
import { SettingsRow, SettingsSection } from '../-ui/settings-nav'

export const Route = createFileRoute('/_app/settings/security')({
  loader: () => loadSecurity(),
  pendingComponent: SecurityPending,
  errorComponent: ({ error }) => (
    <ErrorPanel error={error} title="Security did not load" />
  ),
  component: SecurityPage,
})

function SecurityPage() {
  const data = Route.useLoaderData()
  const router = useRouter()
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
      toast.error('Could not sign you out', {
        description: 'Check your connection and try again.',
      })
      setSigningOut(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      {data.emailVerified ? null : (
        <Alert
          tone="warning"
          title="Your email address is not verified yet"
          actions={
            <Button asChild variant="secondary" size="sm" shape="pill">
              {/* The verification flow lives outside the authenticated tree. */}
              <a href="/verify-email">Send the link again</a>
            </Button>
          }
        >
          Password resets and trip invitations are sent to {data.email}.
          Verifying it is what proves the address is yours.
        </Alert>
      )}

      <SettingsSection
        title="Sign-in"
        description="How you prove it is you. Two-factor and passkeys are both stronger than a password alone."
      >
        <div className="flex flex-col">
          <SettingsRow
            label={
              <span className="inline-flex items-center gap-2">
                <MailCheck aria-hidden className="size-4 text-ink-4" />
                Email address
              </span>
            }
            hint={data.email}
            control={
              <div className="flex sm:justify-end">
                <Badge
                  tone={data.emailVerified ? 'success' : 'warning'}
                  size="lg"
                  icon={data.emailVerified ? <BadgeCheck /> : <TriangleAlert />}
                >
                  {data.emailVerified ? 'Verified' : 'Unverified'}
                </Badge>
              </div>
            }
          />

          <SettingsRow
            label={
              <span className="inline-flex items-center gap-2">
                <KeyRound aria-hidden className="size-4 text-ink-4" />
                Password
              </span>
            }
            hint="Change it whenever you like — you will be sent a one-time link rather than asked for the old one."
            control={
              <div className="flex sm:justify-end">
                <Button asChild variant="secondary" size="sm" shape="pill">
                  <a href="/reset-password">Change password</a>
                </Button>
              </div>
            }
          />

          <SettingsRow
            label={
              <span className="inline-flex items-center gap-2">
                <ShieldCheck aria-hidden className="size-4 text-ink-4" />
                Two-factor authentication
              </span>
            }
            hint={
              data.twoFactorEnabled
                ? 'A code from your authenticator app is required on every new sign-in.'
                : 'Add a six-digit code from an authenticator app on top of your password.'
            }
            control={
              <div className="flex items-center gap-2 sm:justify-end">
                <Badge
                  tone={data.twoFactorEnabled ? 'success' : 'neutral'}
                  size="lg"
                >
                  {data.twoFactorEnabled ? 'On' : 'Off'}
                </Badge>
                <Button
                  asChild
                  variant={data.twoFactorEnabled ? 'ghost' : 'secondary'}
                  size="sm"
                  shape="pill"
                >
                  <a href="/two-factor">
                    {data.twoFactorEnabled ? 'Manage' : 'Turn on'}
                  </a>
                </Button>
              </div>
            }
          />

          <SettingsRow
            label={
              <span className="inline-flex items-center gap-2">
                <Fingerprint aria-hidden className="size-4 text-ink-4" />
                Passkeys
              </span>
            }
            hint="Sign in with the fingerprint reader, Face ID or a security key instead of typing anything."
            control={
              <div className="flex sm:justify-end">
                <Button asChild variant="secondary" size="sm" shape="pill">
                  <a href="/passkeys">Manage passkeys</a>
                </Button>
              </div>
            }
          />
        </div>
      </SettingsSection>

      <SettingsSection
        title="This session"
        description="The browser you are reading this in."
      >
        <div className="flex flex-col">
          <SettingsRow
            label="Signed in as"
            hint={data.email}
            control={
              <p className="text-label tabular-nums text-ink-3 sm:text-right">
                {data.sessionExpiresAt === null
                  ? 'No expiry recorded'
                  : `Expires ${formatDate(data.sessionExpiresAt) ?? 'soon'}`}
              </p>
            }
          />
          <SettingsRow
            label="Sign out"
            hint="Ends this session and returns you to the sign-in page. Other devices stay signed in."
            control={
              <div className="flex sm:justify-end">
                <Button
                  variant="danger"
                  size="sm"
                  shape="pill"
                  loading={signingOut}
                  loadingLabel="Signing out"
                  onClick={() => {
                    void signOut()
                  }}
                >
                  <LogOut aria-hidden />
                  Sign out
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
  return (
    <div aria-busy="true" className="flex flex-col gap-6">
      <span className="sr-only">Loading</span>
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
