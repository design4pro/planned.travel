/**
 * Every state `/join/<secret>` can be in, one card each.
 *
 * Presentation only: the page decides which view it has, and `-lib/view.ts` decided it on the
 * server. The sign-in links carry the secret in `?redirect=`, which is the point of the page: the
 * visitor comes back to the same link afterwards.
 */
import * as React from 'react'
import { ArrowRight, LinkIcon, TriangleAlert, UserRoundX } from 'lucide-react'

import { SIGN_OUT_ENDPOINT } from '#/components/layout/session'
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
import type { JoinAnswer } from '../-lib/join'
import type { InviteView } from '../-lib/view'

type Invited = Extract<InviteView, { state: 'invited' }>
type Member = Extract<InviteView, { state: 'member' }>
type NeedsWorkspace = Extract<InviteView, { state: 'needs-workspace' }>

const ROLE_KEYS: Record<Invited['role'], MessageKey> = {
  editor: 'trips.people.role.editor',
  viewer: 'trips.people.role.viewer',
}

/**
 * A retry that works replaces the card, and the button that was focused goes with it. Set by the
 * retry, read once by the next card to arrive, which moves focus to its heading.
 */
let focusHeadingOnArrival = false

/** What each card is wrapped in: on arrival after a retry, focus goes to the card's heading. */
export function Arrival({ children }: { children: React.ReactNode }) {
  const box = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    if (!focusHeadingOnArrival) return
    focusHeadingOnArrival = false
    const heading = box.current?.querySelector('h1')
    heading?.setAttribute('tabindex', '-1')
    heading?.focus()
  }, [])
  return <div ref={box}>{children}</div>
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
        <div className="animate-rise break-words">{children}</div>
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

type Failure = 'join' | 'busy'

const FAILURE_KEYS: Record<Failure, MessageKey> = {
  join: 'trips.join.error.join',
  busy: 'trips.join.error.busy',
}

function JoinAction({
  onJoin,
  onRetry,
  onJoined,
}: {
  onJoin: () => Promise<JoinAnswer>
  onRetry: () => Promise<void>
  onJoined: (answer: Extract<JoinAnswer, { tripId: string }>) => void
}) {
  const { t } = useI18n()
  const button = React.useRef<HTMLButtonElement>(null)
  const noteId = React.useId()
  const [pending, setPending] = React.useState(false)
  const [failure, setFailure] = React.useState<Failure | null>(null)
  // Counted so a second failure moves focus again, not only the first.
  const [attempt, setAttempt] = React.useState(0)

  // The focus move is the announcement for a failure: the note is described-by, not a live region.
  React.useEffect(() => {
    if (failure) button.current?.focus()
  }, [failure, attempt])

  function fail(next: Failure): void {
    setFailure(next)
    setAttempt((count) => count + 1)
    setPending(false)
  }

  async function join(): Promise<void> {
    setFailure(null)
    setPending(true)
    let answer: JoinAnswer
    try {
      answer = await onJoin()
    } catch {
      fail('join')
      return
    }
    if (answer.outcome === 'busy') {
      fail('busy')
      return
    }
    focusHeadingOnArrival = true
    if (answer.outcome === 'joined' || answer.outcome === 'member') {
      onJoined(answer)
      return
    }
    // A link replaced or switched off while the tab was open, or a workspace left since: the page
    // reads again and the card it gets takes this one's place.
    await onRetry().catch(() => undefined)
    focusHeadingOnArrival = false
    setPending(false)
  }

  return (
    <>
      {failure ? (
        <Alert id={noteId} tone="danger" role="presentation" aria-live="off">
          {t(FAILURE_KEYS[failure])}
        </Alert>
      ) : null}
      <Button
        ref={button}
        variant="primary"
        size="lg"
        block
        loading={pending}
        loadingLabel={t('trips.join.action.joining')}
        aria-describedby={failure ? noteId : undefined}
        onClick={() => void join()}
      >
        {t('trips.join.action.join')}
      </Button>
    </>
  )
}

function InvitedCard({
  view,
  path,
  onJoin,
  onRetry,
  onJoined,
}: {
  view: Invited
  path: string
  onJoin: () => Promise<JoinAnswer>
  onRetry: () => Promise<void>
  onJoined: (answer: Extract<JoinAnswer, { tripId: string }>) => void
}) {
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
      {view.signedIn ? (
        <JoinAction onJoin={onJoin} onRetry={onRetry} onJoined={onJoined} />
      ) : (
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

/** Opens the trip, switching to its workspace first when the active one is not it. */
function OpenTripAction({
  tripId,
  organizationId,
  switchWorkspace,
  path,
}: {
  tripId: string
  organizationId: string
  switchWorkspace: boolean
  path: string
}) {
  const { t } = useI18n()
  const [pending, setPending] = React.useState(false)
  const [failed, setFailed] = React.useState(false)
  const tripPath = `/trips/${tripId}`

  async function openInWorkspace(): Promise<void> {
    setFailed(false)
    setPending(true)
    const outcome = await authClient.organization
      .setActive({ organizationId })
      .then(({ error }) => error)
      .catch(() => new Error('switch'))
    // The session ended while the card was open: trying again cannot work, signing in can.
    if (outcome && 'status' in outcome && outcome.status === 401) {
      window.location.assign(loginHrefFor(path))
      return
    }
    if (outcome) {
      setFailed(true)
      setPending(false)
      return
    }
    // A document load: the app shell reads the active workspace from the session on the server.
    window.location.assign(tripPath)
  }

  return (
    <>
      {failed ? (
        <Alert tone="danger">{t('trips.join.error.switch')}</Alert>
      ) : null}
      {switchWorkspace ? (
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
    </>
  )
}

function MemberCard({ view, path }: { view: Member; path: string }) {
  const { t } = useI18n()
  return (
    <Card padding="lg" className="flex flex-col gap-5">
      <h1 className="font-display text-title font-bold tracking-tight text-ink">
        {t('trips.join.member.title')}
      </h1>
      <OpenTripAction
        tripId={view.tripId}
        organizationId={view.organizationId}
        switchWorkspace={view.switchWorkspace}
        path={path}
      />
    </Card>
  )
}

/** What the traveller sees after their own tap, whether the answer was joined or member. */
function JoinedCard({
  answer,
  path,
}: {
  answer: Extract<JoinAnswer, { tripId: string }>
  path: string
}) {
  const { t } = useI18n()
  return (
    <Card padding="lg" className="flex flex-col gap-5">
      <h1 className="font-display text-title font-bold tracking-tight text-ink">
        {t('trips.join.joined.title')}
      </h1>
      <p className="text-label text-ink-2">{t('trips.join.joined.body')}</p>
      <OpenTripAction
        tripId={answer.tripId}
        organizationId={answer.organizationId}
        switchWorkspace={answer.switchWorkspace}
        path={path}
      />
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
  const [pending, setPending] = React.useState(false)
  const [failed, setFailed] = React.useState(false)

  // The sign-in page sends a signed-in visitor straight back here, so the session has to end first.
  async function signInAsSomeoneElse(): Promise<void> {
    setFailed(false)
    setPending(true)
    const ended = await fetch(SIGN_OUT_ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    })
      .then((response) => response.ok)
      .catch(() => false)
    if (!ended) {
      setFailed(true)
      setPending(false)
      return
    }
    // A document load, so nothing of the old session survives in the client.
    window.location.assign(loginHrefFor(path))
  }

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
      {failed ? (
        <Alert tone="danger">{t('shell.account.signOutFailed')}</Alert>
      ) : null}
      <Button
        variant="secondary"
        size="lg"
        block
        loading={pending}
        loadingLabel={t('shell.account.signingOut')}
        onClick={() => void signInAsSomeoneElse()}
      >
        {t('trips.join.needsWorkspace.otherAccount')}
      </Button>
      <Button variant="ghost" size="lg" block asChild>
        <a href="/trips">{t('trips.join.unavailable.trips')}</a>
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
  onRetry: () => Promise<void>
}) {
  const { t } = useI18n()
  const [pending, setPending] = React.useState(false)
  // Counted so a second busy answer is announced again, not swallowed as the same message.
  const [attempt, setAttempt] = React.useState(0)

  async function retry(): Promise<void> {
    setPending(true)
    focusHeadingOnArrival = true
    await onRetry().catch(() => undefined)
    setAttempt((count) => count + 1)
    setPending(false)
  }

  return (
    <Card padding="lg" className="flex flex-col gap-4">
      <span className="grid size-10 place-items-center rounded-md bg-warning-soft text-warning">
        <TriangleAlert className="size-5" aria-hidden="true" />
      </span>
      <h1 className="font-display text-title font-bold tracking-tight text-ink">
        {t('trips.join.error.title')}
      </h1>
      {busy ? (
        <Alert key={attempt} tone="warning">
          {t('trips.join.error.busy')}
        </Alert>
      ) : null}
      <Button
        variant="secondary"
        size="lg"
        block
        loading={pending}
        loadingLabel={t('trips.join.loading')}
        onClick={() => void retry()}
      >
        {t('trips.join.error.retry')}
      </Button>
    </Card>
  )
}

/** The outline of the invited card, so the page does not jump when the answer arrives. */
export function JoinSkeleton() {
  const { t } = useI18n()
  return (
    <>
      <h1 className="sr-only">{t('trips.join.page.title')}</h1>
      <p role="status" className="sr-only">
        {t('trips.join.loading')}
      </p>
      <Card padding="lg" className="flex flex-col gap-5">
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-11 w-full" />
      </Card>
    </>
  )
}

export function JoinCard({
  view,
  path,
  onRetry,
  onJoin,
}: {
  view: InviteView
  /** This page's own path, so a sign-in comes back to it. */
  path: string
  onRetry: () => Promise<void>
  /** Submits the join for this page's link. */
  onJoin: () => Promise<JoinAnswer>
}) {
  const [joined, setJoined] = React.useState<Extract<
    JoinAnswer,
    { tripId: string }
  > | null>(null)
  if (joined)
    return (
      <Arrival key="joined">
        <JoinedCard answer={joined} path={path} />
      </Arrival>
    )
  return (
    <Arrival key={view.state}>
      {cardFor(view, path, onRetry, onJoin, setJoined)}
    </Arrival>
  )
}

function cardFor(
  view: InviteView,
  path: string,
  onRetry: () => Promise<void>,
  onJoin: () => Promise<JoinAnswer>,
  onJoined: (answer: Extract<JoinAnswer, { tripId: string }>) => void,
): React.ReactNode {
  switch (view.state) {
    case 'invited':
      return (
        <InvitedCard
          view={view}
          path={path}
          onJoin={onJoin}
          onRetry={onRetry}
          onJoined={onJoined}
        />
      )
    case 'member':
      return <MemberCard view={view} path={path} />
    case 'needs-workspace':
      return <NeedsWorkspaceCard view={view} path={path} />
    case 'unavailable':
      return <UnavailableCard signedIn={view.signedIn} path={path} />
    case 'busy':
      return <RetryCard busy onRetry={onRetry} />
  }
}
