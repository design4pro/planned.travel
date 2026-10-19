import * as React from 'react'
import { Link, createFileRoute } from '@tanstack/react-router'
import {
  ArrowRight,
  Check,
  MailCheck,
  UserRoundX,
  Users,
  X,
} from 'lucide-react'

import { Badge, Button, Separator } from '#/components/ui'
import { authClient, toAuthFailure } from '#/lib/auth/client'
import { formatDate } from '#/lib/format'
import { useI18n, useTranslate } from '#/lib/i18n'
import { describeFailure } from './-lib/errors'
import { DEFAULT_REDIRECT, loginHrefFor } from './-lib/redirect'
import { roleCopy } from './-lib/roles'
import { loadInvitation } from './-server/invitation'
import { AuthShell } from './-ui/auth-shell'
import { AuthPanel, EmailSentence, FormAlert } from './-ui/form'

import type { AuthMessage } from './-lib/errors'
import type { InvitationSummary } from './-server/invitation'

export const Route = createFileRoute('/(auth)/accept-invitation/$invitationId')(
  {
    loader: ({ params }) =>
      loadInvitation({ data: { invitationId: params.invitationId } }),
    component: AcceptInvitationPage,
  },
)

/** The workspace card at the heart of every state on this screen. */
function InvitationDetails({ invitation }: { invitation: InvitationSummary }) {
  const { t, locale } = useI18n()
  // Formatted by the pinned formatter, never by the platform: `docs/SPEC.md`
  // §8.5 treats a workerd/WebKit divergence in a date as a defect, and this one
  // is server-rendered and then hydrated.
  const expires = formatDate(invitation.expiresAt, locale)
  const role = roleCopy(invitation.role)

  return (
    <div className="rounded-lg border border-edge-faint bg-surface-2 p-5">
      <div className="flex items-start gap-3.5">
        <span className="grid size-11 shrink-0 place-items-center rounded-md bg-accent text-accent-on">
          <Users className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-subtitle font-bold tracking-tight text-ink">
            {invitation.organizationName}
          </p>
          <p className="mt-0.5 truncate text-caption text-ink-3">
            <EmailSentence
              text={t('auth.invitation.invitedAs', { email: invitation.email })}
              email={invitation.email}
            />
          </p>
        </div>
      </div>

      <Separator className="my-4" />

      <dl className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-caption text-ink-3">
            {t('auth.invitation.role')}
          </dt>
          <dd className="min-w-0">
            <Badge tone="brand">{role ? t(role.badge) : invitation.role}</Badge>
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="shrink-0 text-caption text-ink-3">
            {t('auth.invitation.means')}
          </dt>
          <dd className="text-end text-caption text-ink-2">
            {role
              ? t(role.meaning)
              : t('auth.invitation.role.other', { role: invitation.role })}
          </dd>
        </div>
        {invitation.invitedByEmail ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="shrink-0 text-caption text-ink-3">
              {t('auth.invitation.invitedBy')}
            </dt>
            <dd dir="ltr" className="min-w-0 truncate text-caption text-ink-2">
              {invitation.invitedByEmail}
            </dd>
          </div>
        ) : null}
        {expires ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="shrink-0 text-caption text-ink-3">
              {t('auth.invitation.expires')}
            </dt>
            {/* `numeral` for tabular figures, and deliberately NOT
                `data-numeric`: that attribute pins a run to `direction: ltr`,
                which is right for a code or a time range glued together by
                neutral characters and wrong for a formatted date. An Arabic
                date is Arabic prose — `23 يونيو 2026` reads right to left — so
                pinning it reversed the reading order to year-month-day. It
                takes the paragraph's direction, like the sentence it is. */}
            <dd className="text-caption text-ink-2 numeral">{expires}</dd>
          </div>
        ) : null}
      </dl>
    </div>
  )
}

function AcceptInvitationPage() {
  const view = Route.useLoaderData()
  const { invitationId } = Route.useParams()
  const t = useTranslate()

  const [failure, setFailure] = React.useState<AuthMessage | null>(null)
  const [accepting, setAccepting] = React.useState(false)
  const [declining, setDeclining] = React.useState(false)
  const [declined, setDeclined] = React.useState(false)

  const invitationPath = `/accept-invitation/${invitationId}`

  async function accept(): Promise<void> {
    setFailure(null)
    setAccepting(true)
    const { error } = await authClient.organization.acceptInvitation({
      invitationId,
    })
    if (error) {
      setFailure(describeFailure(toAuthFailure(error)))
      setAccepting(false)
      return
    }
    // A document load: joining changes the active workspace, and the app shell
    // reads that from the session on the server.
    window.location.assign(DEFAULT_REDIRECT)
  }

  async function decline(): Promise<void> {
    setFailure(null)
    setDeclining(true)
    const { error } = await authClient.organization.rejectInvitation({
      invitationId,
    })
    if (error) {
      setFailure(describeFailure(toAuthFailure(error)))
      setDeclining(false)
      return
    }
    setDeclined(true)
    setDeclining(false)
  }

  /* ------------------------------------------------------------- declined */

  if (declined) {
    return (
      <AuthShell
        eyebrow={t('auth.invitation.declined.eyebrow')}
        heading={t('auth.invitation.declined.heading')}
        description={t('auth.invitation.declined.description')}
      >
        <AuthPanel>
          <Button variant="secondary" size="lg" block asChild>
            <Link to={DEFAULT_REDIRECT}>
              {t('auth.invitation.declined.action')}
            </Link>
          </Button>
        </AuthPanel>
      </AuthShell>
    )
  }

  /* ------------------------------------------------ not signed in yet */

  if (view.state === 'anonymous') {
    return (
      <AuthShell
        eyebrow={t('auth.invitation.eyebrow')}
        heading={t('auth.invitation.anonymous.heading')}
        description={t('auth.invitation.anonymous.description')}
        footer={
          <>
            {t('auth.invitation.anonymous.noAccount')}{' '}
            <a
              href={`/register?redirect=${encodeURIComponent(invitationPath)}`}
              className="rounded-sm font-semibold text-brand underline decoration-brand/35 underline-offset-4 focus-ring hover:decoration-brand"
            >
              {t('auth.invitation.anonymous.register')}
            </a>
          </>
        }
      >
        <AuthPanel>
          <p className="text-body text-ink-2">
            {t('auth.invitation.anonymous.body')}
          </p>
          <Button
            variant="primary"
            size="lg"
            block
            className="mt-6"
            iconAfter={<ArrowRight data-mirror-rtl />}
            asChild
          >
            <a href={loginHrefFor(invitationPath)}>
              {t('auth.invitation.anonymous.action')}
            </a>
          </Button>
        </AuthPanel>
      </AuthShell>
    )
  }

  /* -------------------------------------------- signed in as the wrong person */

  if (view.state === 'mismatch') {
    const signedInAs = view.signedInAs
    return (
      <AuthShell
        eyebrow={t('auth.invitation.eyebrow')}
        heading={t('auth.invitation.mismatch.heading')}
        description={t('auth.invitation.mismatch.description')}
        footer={
          <Link
            to="/login"
            className="rounded-sm font-semibold text-brand underline decoration-brand/35 underline-offset-4 focus-ring hover:decoration-brand"
          >
            {t('auth.invitation.mismatch.back')}
          </Link>
        }
      >
        <AuthPanel>
          <div className="flex items-start gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-warning-soft text-warning">
              <UserRoundX className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-label font-semibold text-ink">
                <EmailSentence
                  text={t('auth.invitation.mismatch.title', {
                    email: signedInAs,
                  })}
                  email={signedInAs}
                />
              </p>
              <p className="mt-1 text-caption text-ink-3">
                {t('auth.invitation.mismatch.body')}
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="lg"
            block
            className="mt-6"
            iconAfter={<ArrowRight data-mirror-rtl />}
            asChild
          >
            <a href={loginHrefFor(invitationPath)}>
              {t('auth.invitation.mismatch.action')}
            </a>
          </Button>
        </AuthPanel>
      </AuthShell>
    )
  }

  /* ---------------------------------------------- email not confirmed yet */

  if (view.state === 'unverified') {
    const signedInAs = view.signedInAs
    return (
      <AuthShell
        eyebrow={t('auth.invitation.eyebrow')}
        heading={t('auth.invitation.unverified.heading')}
        description={t('auth.invitation.unverified.description')}
        footer={
          <Link
            to="/verify-email"
            className="rounded-sm font-semibold text-brand underline decoration-brand/35 underline-offset-4 focus-ring hover:decoration-brand"
          >
            {t('auth.invitation.unverified.resend')}
          </Link>
        }
      >
        <AuthPanel>
          <div className="flex items-start gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-brand-subtle text-brand">
              <MailCheck className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-label font-semibold text-ink">
                <EmailSentence
                  text={t('auth.invitation.unverified.title', {
                    email: signedInAs,
                  })}
                  email={signedInAs}
                />
              </p>
              <p className="mt-1 text-caption text-ink-3">
                {t('auth.invitation.unverified.body')}
              </p>
            </div>
          </div>
          <Button variant="primary" size="lg" block className="mt-6" asChild>
            <Link to="/verify-email">
              {t('auth.invitation.unverified.action')}
            </Link>
          </Button>
        </AuthPanel>
      </AuthShell>
    )
  }

  /* ------------------------------------------------ withdrawn or expired */

  if (view.state === 'unavailable') {
    return (
      <AuthShell
        eyebrow={t('auth.invitation.eyebrow')}
        heading={t('auth.invitation.unavailable.heading')}
        description={t('auth.invitation.unavailable.description')}
        footer={
          <Link
            to={DEFAULT_REDIRECT}
            className="rounded-sm font-semibold text-brand underline decoration-brand/35 underline-offset-4 focus-ring hover:decoration-brand"
          >
            {t('auth.invitation.unavailable.dashboard')}
          </Link>
        }
      >
        <AuthPanel>
          <div className="flex items-start gap-3.5">
            <span className="grid size-10 shrink-0 place-items-center rounded-md bg-surface-inset text-ink-3">
              <X className="size-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className="text-label font-semibold text-ink">
                {t('auth.invitation.unavailable.title')}
              </p>
              <p className="mt-1 text-caption text-ink-3">
                {t('auth.invitation.unavailable.body')}
              </p>
            </div>
          </div>
        </AuthPanel>
      </AuthShell>
    )
  }

  /* ---------------------------------------------------------------- ready */

  const busy = accepting || declining

  return (
    <AuthShell
      eyebrow={t('auth.invitation.eyebrow')}
      heading={t('auth.invitation.heading', {
        workspace: view.invitation.organizationName,
      })}
      description={t('auth.invitation.description')}
      wide
    >
      <AuthPanel>
        <FormAlert message={failure} onDismiss={() => setFailure(null)} />
        {failure ? (
          <Button variant="secondary" block asChild className="mb-4">
            <Link to={DEFAULT_REDIRECT}>
              {t('auth.invitation.unavailable.dashboard')}
            </Link>
          </Button>
        ) : null}
        <InvitationDetails invitation={view.invitation} />

        <div className="mt-6 flex flex-col gap-3">
          <Button
            variant="primary"
            size="lg"
            block
            icon={<Check />}
            loading={accepting}
            loadingLabel={t('auth.invitation.accepting')}
            disabled={busy && !accepting}
            onClick={() => void accept()}
          >
            {t('auth.invitation.accept')}
          </Button>
          <Button
            variant="secondary"
            size="lg"
            block
            icon={<X />}
            loading={declining}
            loadingLabel={t('auth.invitation.declining')}
            disabled={busy && !declining}
            onClick={() => void decline()}
          >
            {t('auth.invitation.decline')}
          </Button>
        </div>

        <p className="mt-4 text-caption text-ink-4">
          {t('auth.invitation.reassurance')}
        </p>
      </AuthPanel>
    </AuthShell>
  )
}
