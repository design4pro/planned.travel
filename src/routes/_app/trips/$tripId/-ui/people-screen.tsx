/**
 * Who is on this trip, and who can find it.
 *
 * **Every control here is a courtesy, never the boundary.** The guards live inside the repository
 * writers (`src/server/repos/trips.ts`): the owner assert with its self-removal exemption, the
 * workspace guard, and the last-owner rule both membership verbs reach. So a control a reader's role
 * cannot exercise is *not rendered* rather than rendered disabled — a disabled control invites
 * somebody to wonder what they are missing — and a stale payload costs a refused write rather than
 * an unauthorised one. `trip-actions.tsx` takes the same posture for the same reason.
 *
 * **Two refusals have copy; everything else is the generic failure.** `-server/people.ts` answers
 * `{ ok: false, reason }` for exactly the two rules this screen can explain, and the reason is a
 * code the screen maps onto a catalogue key — the server never composes a sentence (`docs/SPEC.md`
 * §9). Anything else throws, and `readPublicFailure` decides whether it is authored copy or the
 * generic sentence, the same split `ErrorPanel` makes for a failed load.
 *
 * **A refusal is not worth retrying and an unexpected failure is.** The last-owner rule will refuse
 * the same write again, so that alert carries no Retry; a failure the server could not name might
 * have been the network, so that one does.
 */

import { useRef, useState } from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import { LogOut, UserMinus, UserPlus } from 'lucide-react'

import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Combobox,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  Field,
  IconButton,
  SimpleSelect,
  SwitchField,
  staggerDelay,
} from '#/components/ui'
import { readPublicFailure } from '#/lib/errors'
import { useTranslate } from '#/lib/i18n'
import { cn } from '#/lib/cn'
import { TripModuleHeader } from '../../../-ui/trip-header'
import {
  addTripMemberFn,
  leaveTripFn,
  removeTripMemberFn,
  setTripRoleFn,
  setTripVisibilityFn,
} from '../-server/people'

import type { MessageKey } from '#/lib/i18n'
import type {
  PeopleRefusal,
  TripPeoplePayload,
  TripParticipant,
  TripVisibility,
} from '../-server/people'
import type { TripRole } from '#/server/repos'

/** The three roles, named. The tuple is the order the select offers them in: most able first. */
const ROLES: ReadonlyArray<TripRole> = ['owner', 'editor', 'viewer']

const ROLE_COPY = {
  owner: 'trips.people.role.owner',
  editor: 'trips.people.role.editor',
  viewer: 'trips.people.role.viewer',
} as const satisfies Record<TripRole, MessageKey>

/**
 * The stored value said in words, all three of them.
 *
 * The switch owns two positions and `COL-10`/`COL-11` own the third, so a trip stored at `'public'`
 * renders its sentence and no control at all — for the owner too. Reporting the value is the one
 * honest thing a two-position control can do with a third one.
 */
const VISIBILITY_COPY = {
  private: 'trips.people.visibility.private',
  organization: 'trips.people.visibility.organization',
  public: 'trips.people.visibility.public',
} as const satisfies Record<TripVisibility, MessageKey>

const REFUSAL_COPY = {
  'last-owner': 'trips.people.error.lastOwner',
  'not-in-workspace': 'trips.people.error.notInWorkspace',
} as const satisfies Record<PeopleRefusal, MessageKey>

/** Every write this screen can start, as the thing that is attempted rather than as a callback. */
type Write =
  | { readonly kind: 'add'; readonly userId: string; readonly role: TripRole }
  | {
      readonly kind: 'role'
      readonly memberId: string
      readonly role: TripRole
    }
  | { readonly kind: 'remove'; readonly memberId: string }
  | { readonly kind: 'leave' }
  | {
      readonly kind: 'visibility'
      readonly visibility: 'private' | 'organization'
    }

/**
 * Where a failed write says so.
 *
 * A failure belongs beside the control that caused it, never in a banner over the list — the list is
 * still correct, and clearing it would lose the row the reader was looking at.
 */
type Anchor = string

function anchorOf(write: Write): Anchor {
  switch (write.kind) {
    case 'add':
      return 'invite'
    case 'role':
      return `role:${write.memberId}`
    case 'remove':
      return `remove:${write.memberId}`
    case 'leave':
      return 'leave'
    case 'visibility':
      return 'visibility'
  }
}

interface Failure {
  readonly at: Anchor
  readonly message: string
  /** A named refusal answers the same way every time; only an unnamed failure is worth repeating. */
  readonly repeatable: boolean
}

/** Only members are rendered: the `guest` variant is `01-S6b`'s and nothing produces one yet. */
type TripMemberParticipant = Extract<TripParticipant, { kind: 'member' }>

export interface PeopleScreenProps {
  readonly data: TripPeoplePayload
}

export function PeopleScreen({ data }: PeopleScreenProps) {
  const t = useTranslate()
  const router = useRouter()
  const navigate = useNavigate()

  const [busy, setBusy] = useState<Anchor | null>(null)
  const [failure, setFailure] = useState<Failure | null>(null)
  const [removing, setRemoving] = useState<TripMemberParticipant | null>(null)
  const [leaving, setLeaving] = useState(false)

  /** Where focus goes after a removal, so it is never dropped on the detached row. */
  const membersHeading = useRef<HTMLHeadingElement>(null)

  const members = data.participants.filter(
    (person): person is TripMemberParticipant => person.kind === 'member',
  )
  const isOwner = data.viewerRole === 'owner'
  const soleOwner =
    members.filter((person) => person.role === 'owner').length === 1

  async function send(write: Write): Promise<PeopleRefusal | null> {
    switch (write.kind) {
      case 'add': {
        const answer = await addTripMemberFn({
          data: { tripId: data.tripId, userId: write.userId, role: write.role },
        })
        return answer.ok ? null : answer.reason
      }
      case 'role': {
        const answer = await setTripRoleFn({
          data: {
            tripId: data.tripId,
            memberId: write.memberId,
            role: write.role,
          },
        })
        return answer.ok ? null : answer.reason
      }
      case 'remove': {
        const answer = await removeTripMemberFn({
          data: { tripId: data.tripId, memberId: write.memberId },
        })
        return answer.ok ? null : answer.reason
      }
      case 'leave': {
        const answer = await leaveTripFn({ data: { tripId: data.tripId } })
        return answer.ok ? null : answer.reason
      }
      case 'visibility': {
        await setTripVisibilityFn({
          data: { tripId: data.tripId, visibility: write.visibility },
        })
        return null
      }
    }
  }

  /** What happens once the loader has been read again, per verb. */
  function settle(write: Write): void {
    switch (write.kind) {
      case 'add':
        setPicked(null)
        return
      case 'remove':
        setRemoving(null)
        membersHeading.current?.focus()
        return
      case 'leave':
        // Leaving is the one write whose answer is a page the reader can no longer read.
        void navigate({ to: '/trips' })
        return
      case 'role':
      case 'visibility':
        return
    }
  }

  async function run(write: Write): Promise<void> {
    const at = anchorOf(write)
    setBusy(at)
    setFailure(null)
    try {
      const refused = await send(write)
      if (refused !== null) {
        setFailure({ at, message: t(REFUSAL_COPY[refused]), repeatable: false })
        return
      }
      await router.invalidate()
      settle(write)
    } catch (cause) {
      const failed = readPublicFailure(cause)
      setFailure({
        at,
        message: failed.message ?? t('shell.error.body'),
        repeatable: true,
      })
    } finally {
      setBusy(null)
    }
  }

  const [picked, setPicked] = useState<string | null>(null)
  const [joiningAs, setJoiningAs] = useState<TripRole>('editor')

  function failureAt(at: Anchor): React.ReactNode {
    if (failure === null || failure.at !== at) return null

    return (
      <Alert
        tone="danger"
        size="sm"
        actions={
          failure.repeatable ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              shape="pill"
              onClick={() => setFailure(null)}
            >
              {t('shell.error.retry')}
            </Button>
          ) : undefined
        }
        onDismiss={() => setFailure(null)}
      >
        {failure.message}
      </Alert>
    )
  }

  const roleOptions = ROLES.map((value) => ({
    value,
    label: t(ROLE_COPY[value]),
  }))

  return (
    <>
      <TripModuleHeader
        title={t('trips.people.title')}
        description={t('trips.people.description')}
      />

      {/* Above `lg` the members sit left and the aside right; below it the columns stack with the
          aside first, because on a phone the reason this page was opened is to add somebody. The
          aside is therefore first in the DOM and placed into the second column, so the reading
          order and the tab order agree at every width. */}
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
        <aside className="flex flex-col gap-6 lg:col-start-2 lg:row-start-1">
          {isOwner ? (
            <Card>
              <CardHeader>
                <CardTitle>{t('trips.people.invite.title')}</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                {data.invitable.length === 0 ? (
                  <EmptyState
                    size="sm"
                    icon={<UserPlus aria-hidden />}
                    title={t('trips.people.invite.empty')}
                    description={t('trips.people.invite.emptyHint')}
                  />
                ) : (
                  <>
                    <Combobox
                      options={data.invitable.map((person) => ({
                        value: person.userId,
                        label: person.name,
                      }))}
                      value={picked}
                      onChange={setPicked}
                      clearable
                      searchPlaceholder={t('trips.people.invite.placeholder')}
                      ariaLabel={t('trips.people.invite.title')}
                    />
                    <Field label={t('trips.people.invite.role')}>
                      <SimpleSelect
                        options={roleOptions}
                        value={joiningAs}
                        onValueChange={(value) =>
                          setJoiningAs(asRole(value, 'editor'))
                        }
                      />
                    </Field>
                    <Button
                      type="button"
                      shape="pill"
                      className="self-start"
                      disabled={picked === null}
                      loading={busy === 'invite'}
                      loadingLabel={t('trips.people.invite.action')}
                      icon={<UserPlus aria-hidden />}
                      onClick={() => {
                        if (picked === null) return
                        void run({
                          kind: 'add',
                          userId: picked,
                          role: joiningAs,
                        })
                      }}
                    >
                      {t('trips.people.invite.action')}
                    </Button>
                  </>
                )}
                {failureAt('invite')}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>{t('trips.people.visibility.title')}</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {isOwner && data.visibility !== 'public' ? (
                <SwitchField
                  label={t('trips.people.visibility.switch')}
                  description={t(VISIBILITY_COPY[data.visibility])}
                  checked={data.visibility === 'organization'}
                  disabled={busy === 'visibility'}
                  onCheckedChange={(next) =>
                    void run({
                      kind: 'visibility',
                      visibility: next ? 'organization' : 'private',
                    })
                  }
                />
              ) : (
                <p className="text-label leading-relaxed text-ink-3">
                  {t(VISIBILITY_COPY[data.visibility])}
                </p>
              )}
              {failureAt('visibility')}
            </CardContent>
          </Card>

          {/* The link-sharing card lands here. `COL-10` and `COL-11`
              (docs/plans/07-collaboration-and-sharing.md) are the tickets that fill it; until then
              this column reserves the space and renders nothing, because a card announcing a feature
              that does not exist is the placeholder copy `docs/SPEC.md` §7 bans. */}
        </aside>

        <section className="lg:col-start-1 lg:row-start-1">
          <Card padding="none">
            <CardHeader className="px-5 py-4">
              <CardTitle ref={membersHeading} tabIndex={-1} as="h2">
                {t('trips.people.members.title')}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {members.length === 0 ? (
                <p className="text-label leading-relaxed text-ink-3">
                  {t('trips.people.members.empty')}
                </p>
              ) : (
                <ul className="flex flex-col gap-1">
                  {members.map((person, index) => (
                    <MemberRow
                      key={person.memberId}
                      person={person}
                      index={index}
                      isSelf={person.userId === data.viewerUserId}
                      isSoleOwner={soleOwner && person.role === 'owner'}
                      canManage={isOwner}
                      roleOptions={roleOptions}
                      busy={busy}
                      failure={failureAt(`role:${person.memberId}`)}
                      onRoleChange={(role) =>
                        void run({
                          kind: 'role',
                          memberId: person.memberId,
                          role,
                        })
                      }
                      onRemove={() => {
                        setFailure(null)
                        setRemoving(person)
                      }}
                      onLeave={() => {
                        setFailure(null)
                        setLeaving(true)
                      }}
                    />
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </section>
      </div>

      <ConfirmDialog
        open={removing !== null}
        onOpenChange={(open) => {
          if (!open) setRemoving(null)
        }}
        title={t('trips.people.remove.title', { name: removing?.name ?? '' })}
        body={t('trips.people.remove.body')}
        confirm={t('trips.people.remove.confirm')}
        cancel={t('trips.people.cancel')}
        busy={busy !== null && removing !== null}
        failure={
          removing === null ? null : failureAt(`remove:${removing.memberId}`)
        }
        onConfirm={() => {
          if (removing === null) return
          void run({ kind: 'remove', memberId: removing.memberId })
        }}
      />

      <ConfirmDialog
        open={leaving}
        onOpenChange={setLeaving}
        title={t('trips.people.leave.title')}
        body={t('trips.people.leave.body')}
        confirm={t('trips.people.leave.confirm')}
        cancel={t('trips.people.cancel')}
        busy={busy === 'leave'}
        failure={failureAt('leave')}
        onConfirm={() => void run({ kind: 'leave' })}
      />
    </>
  )
}

/** Narrows the select's string back to the column's own vocabulary. */
function asRole(value: string, fallback: TripRole): TripRole {
  return ROLES.find((role) => role === value) ?? fallback
}

interface MemberRowProps {
  readonly person: TripMemberParticipant
  readonly index: number
  readonly isSelf: boolean
  readonly isSoleOwner: boolean
  readonly canManage: boolean
  readonly roleOptions: Array<{ value: string; label: string }>
  readonly busy: Anchor | null
  readonly failure: React.ReactNode
  readonly onRoleChange: (role: TripRole) => void
  readonly onRemove: () => void
  readonly onLeave: () => void
}

/**
 * One person on the trip.
 *
 * **A sole owner's row carries neither verb and no role control.** Every role change available there
 * is the demotion `updateTripMember` refuses, and leaving *is* self-removal, which the last-owner
 * guard refuses before the self-removal exemption is reached — so offering either would mean
 * showing a destructive dialog whose only outcome is an error. `people.owner.hint` says why instead,
 * which is the row explaining itself rather than the row going quiet.
 */
function MemberRow({
  person,
  index,
  isSelf,
  isSoleOwner,
  canManage,
  roleOptions,
  busy,
  failure,
  onRoleChange,
  onRemove,
  onLeave,
}: MemberRowProps) {
  const t = useTranslate()
  const pending =
    busy === `role:${person.memberId}` || busy === `remove:${person.memberId}`

  return (
    <li
      style={{ animationDelay: staggerDelay(index) }}
      // The row leaves on opacity: a write in flight dims it, and the loader it invalidates is what
      // takes it away. Reduced motion collapses the entrance to opacity through the global rule in
      // `src/styles/styles.css`.
      className={cn(
        'animate-rise flex flex-col gap-2 rounded-lg px-1 py-2',
        pending && 'opacity-60',
      )}
    >
      <div className="flex min-w-0 items-center gap-3">
        <Avatar src={person.image} name={person.name} size="sm" />
        <span className="min-w-0 flex-1 truncate text-label font-medium text-ink">
          {person.name}
        </span>
        {isSelf ? <Badge tone="neutral">{t('trips.people.you')}</Badge> : null}

        {canManage && !isSoleOwner ? (
          <SimpleSelect
            size="sm"
            className="w-36"
            options={roleOptions}
            value={person.role}
            disabled={pending}
            onValueChange={(value) => onRoleChange(asRole(value, person.role))}
            // A list, not grammar: the control's own label beside the person it belongs to, so a
            // reader never meets several identically-named selects.
            ariaLabel={[t('trips.people.role.label'), person.name].join(' · ')}
          />
        ) : (
          <Badge tone={person.role === 'owner' ? 'brand' : 'neutral'}>
            {t(ROLE_COPY[person.role])}
          </Badge>
        )}

        {isSoleOwner ? (
          <span className="text-caption text-ink-3">
            {t('trips.people.owner.hint')}
          </span>
        ) : isSelf ? (
          <IconButton
            size="sm"
            variant="ghost"
            icon={<LogOut aria-hidden />}
            label={t('trips.people.leave.action')}
            onClick={onLeave}
          />
        ) : canManage ? (
          <IconButton
            size="sm"
            variant="ghost"
            icon={<UserMinus aria-hidden />}
            label={t('trips.people.remove.action', { name: person.name })}
            onClick={onRemove}
          />
        ) : null}
      </div>
      {failure}
    </li>
  )
}

interface ConfirmDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: string
  readonly body: string
  readonly confirm: string
  readonly cancel: string
  readonly busy: boolean
  readonly failure: React.ReactNode
  readonly onConfirm: () => void
}

/** Both destructive confirmations, which differ only in their words and in where they leave you. */
function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirm,
  cancel,
  busy,
  failure,
  onConfirm,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{body}</DialogDescription>
        </DialogHeader>

        {failure === null ? null : <DialogBody>{failure}</DialogBody>}

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            shape="pill"
            onClick={() => onOpenChange(false)}
          >
            {cancel}
          </Button>
          <Button
            type="button"
            variant="danger"
            shape="pill"
            loading={busy}
            loadingLabel={confirm}
            onClick={onConfirm}
          >
            {confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
