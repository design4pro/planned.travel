/**
 * Every state `/join/<secret>` can be in, one card each.
 *
 * Presentation only: the page decides which view it has, and `-lib/view.ts` decided it on the
 * server. The sign-in links carry the secret in `?redirect=`, which is the point of the page: the
 * visitor comes back to the same link afterwards.
 */
import * as React from 'react'
import { ArrowRight, LinkIcon, TriangleAlert, UserRoundX } from 'lucide-react'

import {
  MarketingFooter,
  MarketingHeader,
  SkipToContent,
} from '#/components/marketing'
import {
  Alert,
  Avatar,
  Button,
  Card,
  Separator,
  Skeleton,
} from '#/components/ui'
import { authClient } from '#/lib/auth/client'
import { formatDateRange } from '#/lib/format'
import { useI18n } from '#/lib/i18n'
import { loginHrefFor } from '../../(auth)/-lib/redirect'

import type { MessageKey } from '#/lib/i18n'
import type { InviteView } from '../-lib/view'

type Invited = Extract<InviteView, { state: 'invited' }>
type Member = Extract<InviteView, { state: 'member' }>
type NeedsWorkspace = Extract<InviteView, { state: 'needs-workspace' }>

const ROLE_KEYS: Record<Invited['role'], MessageKey> = {
  editor: 'trips.people.role.editor',
  viewer: 'trips.people.role.viewer',
}

/** The frame every state shares: guest chrome, one `main`, the card in the middle. */
export function JoinFrame({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-canvas">
      <SkipToContent />
      <MarketingHeader minimal />
      <main
        id="main"
        className="mx-auto flex w-full max-w-lg flex-1 flex-col justify-center px-4 py-10 sm:px-6"
      >
        {children}
      </main>
      <MarketingFooter minimal />
    </div>
  )
}

function Details({ rows }: { rows: ReadonlyArray<[string, string]> }) {
  return (
    <dl className="flex flex-col gap-3">
      {rows.map(([label, value]) => (
        <div key={label} className="flex items-start justify-between gap-4">
          <dt className="shrink-0 text-caption text-ink-3">{label}</dt>
          <dd className="min-w-0 break-words text-end text-label font-medium text-ink">
            {value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function SignInAction({ path, label }: { path: string; label: MessageKey }) {
  const { t } = useI18n()
  return (
    <Button
      variant="primary"
      size="lg"
      block
      iconAfter={<ArrowRight data-mirror-rtl />}
      asChild
    >
      <a href={loginHrefFor(path)}>{t(label)}</a>
    </Button>
  )
}

function InvitedCard({ view, path }: { view: Invited; path: string }) {
  const { t, locale } = useI18n()
  const dates = formatDateRange(view.startDate, view.endDate, locale)
  const rows: Array<[string, string]> = [
    [t('trips.join.trip.label'), view.tripTitle],
    [t('trips.join.role.label'), t(ROLE_KEYS[view.role])],
  ]
  if (dates) rows.push([t('trips.join.dates.label'), dates])
  if (view.destination)
    rows.push([t('trips.join.destination.label'), view.destination])

  return (
    <Card padding="lg" className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <Avatar
          aria-hidden="true"
          size="lg"
          name={view.inviterName}
          src={view.inviterImage}
        />
        <h1 className="min-w-0 break-words font-display text-title font-bold tracking-tight text-ink">
          {t('trips.join.title.invited', { inviter: view.inviterName })}
        </h1>
      </div>
      <Details rows={rows} />
      <Separator />
      <p className="text-label text-ink-2">
        {t('trips.join.requirement', { inviter: view.inviterName })}
      </p>
      {view.signedIn ? null : (
        <>
          <p className="text-caption text-ink-3">
            {t('trips.join.newHere', { inviter: view.inviterName })}
          </p>
          <SignInAction path={path} label="trips.join.action.signIn" />
        </>
      )}
    </Card>
  )
}

function MemberCard({ view }: { view: Member }) {
  const { t } = useI18n()
  const [pending, setPending] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const tripPath = `/trips/${view.tripId}`

  async function openInWorkspace(): Promise<void> {
    setFailed(false)
    setPending(true)
    const outcome = await authClient.organization
      .setActive({ organizationId: view.organizationId })
      .then(({ error }) => error)
      .catch(() => new Error('switch'))
    if (outcome) {
      setFailed(true)
      setPending(false)
      return
    }
    // A document load: the app shell reads the active workspace from the session on the server.
    window.location.assign(tripPath)
  }

  return (
    <Card padding="lg" className="flex flex-col gap-5">
      <h1 className="font-display text-title font-bold tracking-tight text-ink">
        {t('trips.join.member.title')}
      </h1>
      {failed ? (
        <Alert tone="danger">{t('trips.join.error.switch')}</Alert>
      ) : null}
      {view.switchWorkspace ? (
        <Button
          variant="primary"
          size="lg"
          block
          loading={pending}
          loadingLabel={t('trips.join.action.openIn.pending')}
          onClick={() => void openInWorkspace()}
        >
          {t('trips.join.action.openIn')}
        </Button>
      ) : (
        <Button variant="primary" size="lg" block asChild>
          <a href={tripPath}>{t('trips.join.action.open')}</a>
        </Button>
      )}
    </Card>
  )
}

function NeedsWorkspaceCard({
  view,
  path,
}: {
  view: NeedsWorkspace
  path: string
}) {
  const { t } = useI18n()
  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <span className="grid size-10 place-items-center rounded-md bg-warning-soft text-warning">
        <UserRoundX className="size-5" aria-hidden="true" />
      </span>
      <h1 className="font-display text-title font-bold tracking-tight text-ink">
        {t('trips.join.needsWorkspace.title')}
      </h1>
      <p className="text-label text-ink-2">
        {t('trips.join.needsWorkspace.body', { inviter: view.inviterName })}
      </p>
      <p className="break-words text-caption text-ink-3">
        {t('trips.join.needsWorkspace.signedInAs', {
          email: view.email,
          inviter: view.inviterName,
        })}
      </p>
      <p className="text-caption text-ink-3">
        {t('trips.join.needsWorkspace.acceptFirst')}
      </p>
      <Button variant="secondary" size="lg" block asChild>
        <a href={loginHrefFor(path)}>
          {t('trips.join.needsWorkspace.otherAccount')}
        </a>
      </Button>
    </Card>
  )
}

/** The one card a dead link, a banned visitor and a wrong link all get. */
export function UnavailableCard({
  signedIn,
  path,
}: {
  signedIn: boolean
  path: string
}) {
  const { t } = useI18n()
  return (
    <Card variant="inset" padding="lg" className="flex flex-col gap-4">
      <span className="grid size-10 place-items-center rounded-md bg-surface-inset text-ink-3">
        <LinkIcon className="size-5" aria-hidden="true" />
      </span>
      <h1 className="font-display text-title font-bold tracking-tight text-ink">
        {t('trips.join.unavailable.title')}
      </h1>
      <p className="text-label text-ink-2">
        {t('trips.join.unavailable.body')}
      </p>
      {signedIn ? (
        <Button variant="secondary" size="lg" block asChild>
          <a href="/trips">{t('trips.join.unavailable.trips')}</a>
        </Button>
      ) : (
        <SignInAction path={path} label="trips.join.unavailable.signIn" />
      )}
    </Card>
  )
}

/** The page is busy, or the read failed: the same card, with a way to try again. */
export function RetryCard({
  busy,
  onRetry,
}: {
  busy: boolean
  onRetry: () => void
}) {
  const { t } = useI18n()
  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <span className="grid size-10 place-items-center rounded-md bg-warning-soft text-warning">
        <TriangleAlert className="size-5" aria-hidden="true" />
      </span>
      <h1 className="font-display text-title font-bold tracking-tight text-ink">
        {t('trips.join.error.title')}
      </h1>
      {busy ? <Alert tone="warning">{t('trips.join.error.busy')}</Alert> : null}
      <Button variant="secondary" size="lg" block onClick={onRetry}>
        {t('trips.join.error.retry')}
      </Button>
    </Card>
  )
}

/** The outline of the invited card, so the page does not jump when the answer arrives. */
export function JoinSkeleton() {
  const { t } = useI18n()
  return (
    <Card padding="lg" className="flex flex-col gap-5" aria-busy="true">
      <p role="status" className="sr-only">
        {t('trips.join.loading')}
      </p>
      <Skeleton className="h-7 w-3/4" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-11 w-full" />
    </Card>
  )
}

export function JoinCard({
  view,
  path,
  onRetry,
}: {
  view: InviteView
  /** This page's own path, so a sign-in comes back to it. */
  path: string
  onRetry: () => void
}) {
  switch (view.state) {
    case 'invited':
      return <InvitedCard view={view} path={path} />
    case 'member':
      return <MemberCard view={view} />
    case 'needs-workspace':
      return <NeedsWorkspaceCard view={view} path={path} />
    case 'unavailable':
      return <UnavailableCard signedIn={view.signedIn} path={path} />
    case 'busy':
      return <RetryCard busy onRetry={onRetry} />
  }
}
