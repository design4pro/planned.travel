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
import { describeFailure } from './-lib/errors'
import { DEFAULT_REDIRECT, loginHrefFor } from './-lib/redirect'
import { loadInvitation } from './-server/invitation'
import { AuthShell } from './-ui/auth-shell'
import { AuthPanel, FormAlert } from './-ui/form'

import type { AuthMessage } from './-lib/errors'
import type { InvitationSummary } from './-server/invitation'

export const Route = createFileRoute('/(auth)/accept-invitation/$invitationId')(
  {
    loader: ({ params }) =>
      loadInvitation({ data: { invitationId: params.invitationId } }),
    component: AcceptInvitationPage,
  },
)

/** Role names as the product says them, not as the database spells them. */
const ROLE_COPY: Record<string, string> = {
  owner: 'Owner — full control, including billing',
  admin: 'Admin — manage trips, members and settings',
  member: 'Member — plan trips alongside everyone else',
}

function roleDescription(role: string): string {
  return ROLE_COPY[role] ?? `${role} — access set by the workspace owner`
}

function formatExpiry(iso: string | null): string | null {
  if (!iso) return null
  const when = new Date(iso)
  if (Number.isNaN(when.getTime())) return null
  return when.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

/** The workspace card at the heart of every state on this screen. */
function InvitationDetails({ invitation }: { invitation: InvitationSummary }) {
  const expires = formatExpiry(invitation.expiresAt)
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
            Invited as {invitation.email}
          </p>
        </div>
      </div>

      <Separator className="my-4" />

      <dl className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <dt className="text-caption text-ink-3">Your role</dt>
          <dd className="min-w-0">
            <Badge tone="brand">{invitation.role}</Badge>
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="shrink-0 text-caption text-ink-3">Means</dt>
          <dd className="text-right text-caption text-ink-2">
            {roleDescription(invitation.role)}
          </dd>
        </div>
        {invitation.invitedByEmail ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="shrink-0 text-caption text-ink-3">Invited by</dt>
            <dd className="min-w-0 truncate text-caption text-ink-2">
              {invitation.invitedByEmail}
            </dd>
          </div>
        ) : null}
        {expires ? (
          <div className="flex items-center justify-between gap-3">
            <dt className="shrink-0 text-caption text-ink-3">Expires</dt>
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
        eyebrow="Invitation declined"
        heading="No problem — nothing was shared"
        description="The workspace owner has been told, and this link can no longer be used."
      >
        <AuthPanel>
          <Button variant="secondary" size="lg" block asChild>
            <Link to={DEFAULT_REDIRECT}>Go to your dashboard</Link>
          </Button>
        </AuthPanel>
      </AuthShell>
    )
  }

  /* ------------------------------------------------ not signed in yet */

  if (view.state === 'anonymous') {
    return (
      <AuthShell
        eyebrow="Workspace invitation"
        heading="Sign in to see your invitation"
        description="Invitations are tied to the email address they were sent to, so we need to know who you are before we can show you this one."
        footer={
          <>
            No account yet?{' '}
            <a
              href={`/register?redirect=${encodeURIComponent(invitationPath)}`}
              className="rounded-sm font-semibold text-brand underline decoration-brand/35 underline-offset-4 focus-ring hover:decoration-brand"
            >
              Create one with the invited address
            </a>
          </>
        }
      >
        <AuthPanel>
          <p className="text-body text-ink-2">
            Use the address the invitation was sent to. We will bring you
            straight back here afterwards.
          </p>
          <Button
            variant="primary"
            size="lg"
            block
            className="mt-6"
            iconAfter={<ArrowRight />}
            asChild
          >
            <a href={loginHrefFor(invitationPath)}>Sign in to continue</a>
          </Button>
        </AuthPanel>
      </AuthShell>
    )
  }

  /* -------------------------------------------- signed in as the wrong person */

  if (view.state === 'mismatch') {
    return (
      <AuthShell
        eyebrow="Workspace invitation"
        heading="This invitation is for another address"
        description="You are signed in as someone else, so this one is not yours to accept."
        footer={
          <Link
            to="/login"
            className="rounded-sm font-semibold text-brand underline decoration-brand/35 underline-offset-4 focus-ring hover:decoration-brand"
          >
            Back to sign in
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
                Signed in as {view.signedInAs}
              </p>
              <p className="mt-1 text-caption text-ink-3">
                Sign out and back in with the address the invitation was sent
                to, or ask for a new invitation to this account.
              </p>
            </div>
          </div>
          <Button
            variant="secondary"
            size="lg"
            block
            className="mt-6"
            iconAfter={<ArrowRight />}
            asChild
          >
            <a href={loginHrefFor(invitationPath)}>Switch account</a>
          </Button>
        </AuthPanel>
      </AuthShell>
    )
  }

  /* ---------------------------------------------- email not confirmed yet */

  if (view.state === 'unverified') {
    return (
      <AuthShell
        eyebrow="Workspace invitation"
        heading="Confirm your email to join"
        description="Workspaces only accept confirmed addresses, so nobody can be added by a typo."
        footer={
          <Link
            to="/verify-email"
            className="rounded-sm font-semibold text-brand underline decoration-brand/35 underline-offset-4 focus-ring hover:decoration-brand"
          >
            Resend the confirmation email
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
                {view.signedInAs} is not confirmed yet
              </p>
              <p className="mt-1 text-caption text-ink-3">
                Open the confirmation link in your inbox, then return to this
                page. The invitation will be waiting.
              </p>
            </div>
          </div>
          <Button variant="primary" size="lg" block className="mt-6" asChild>
            <Link to="/verify-email">Confirm my email</Link>
          </Button>
        </AuthPanel>
      </AuthShell>
    )
  }

  /* ------------------------------------------------ withdrawn or expired */

  if (view.state === 'unavailable') {
    return (
      <AuthShell
        eyebrow="Workspace invitation"
        heading="This invitation is no longer available"
        description="Invitations last seven days, and they retire the moment they are used or withdrawn."
        footer={
          <Link
            to={DEFAULT_REDIRECT}
            className="rounded-sm font-semibold text-brand underline decoration-brand/35 underline-offset-4 focus-ring hover:decoration-brand"
          >
            Go to your dashboard
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
                Nothing to accept here
              </p>
              <p className="mt-1 text-caption text-ink-3">
                Ask whoever invited you to send a fresh invitation, and this
                page will show it straight away.
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
      eyebrow="Workspace invitation"
      heading={`Join ${view.invitation.organizationName}`}
      description="Accepting adds you to this workspace and shares its trips, budgets and lists with you."
      wide
    >
      <AuthPanel>
        <FormAlert message={failure} onDismiss={() => setFailure(null)} />
        <InvitationDetails invitation={view.invitation} />

        <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
          <Button
            variant="primary"
            size="lg"
            block
            icon={<Check />}
            loading={accepting}
            loadingLabel="Joining the workspace"
            disabled={busy && !accepting}
            onClick={() => void accept()}
          >
            Accept invitation
          </Button>
          <Button
            variant="secondary"
            size="lg"
            block
            icon={<X />}
            loading={declining}
            loadingLabel="Declining"
            disabled={busy && !declining}
            onClick={() => void decline()}
          >
            Decline
          </Button>
        </div>

        <p className="mt-4 text-caption text-ink-4">
          You can leave a workspace at any time from its settings, and nothing
          you create outside it is ever shared.
        </p>
      </AuthPanel>
    </AuthShell>
  )
}
