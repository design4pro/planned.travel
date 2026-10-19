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
 * **Named refusals have copy; everything else is the generic failure.** `-server/people.ts` answers
 * `{ ok: false, reason }` for exactly the rules this screen can explain, and the reason is a
 * code the screen maps onto a catalogue key — the server never composes a sentence (`docs/SPEC.md`
 * §9). Anything else throws, and `readPublicFailure` decides whether it is authored copy or the
 * generic sentence, the same split `ErrorPanel` makes for a failed load.
 *
 * **A refusal is not worth retrying and an unexpected failure is.** The last-owner rule will refuse
 * the same write again, so that alert carries no Retry; a failure the server could not name might
 * have been the network, so that one does. A refused guest name is the one refusal that renders on
 * the field rather than as an alert, because the fix is an edit to what was typed.
 *
 * **Guests sit beneath the members** (`01-S6b`): a name, a badge, and — for the owner only —
 * rename, merge and remove. Nobody is notified of any of it; a guest has no account.
 */

import { InviteLinkPanel } from './invite-link-panel'
import { useRef, useState } from 'react'
import { useNavigate, useRouter } from '@tanstack/react-router'
import {
  LogOut,
  Pencil,
  UserCheck,
  UserMinus,
  UserPlus,
  UserRound,
} from 'lucide-react'

import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
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
  Input,
  SimpleSelect,
  SwitchField,
  staggerDelay,
} from '#/components/ui'
import { readPublicFailure } from '#/lib/errors'
import { useTranslate } from '#/lib/i18n'
import { cn } from '#/lib/cn'
import { TripModuleHeader } from '../../../-ui/trip-header'
import {
  addTripGuestFn,
  addTripMemberFn,
  leaveTripFn,
  mergeTripGuestFn,
  removeTripGuestFn,
  removeTripMemberFn,
  renameTripGuestFn,
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
  | { readonly kind: 'guest-add'; readonly displayName: string }
  | {
      readonly kind: 'guest-rename'
      readonly guestId: string
      readonly displayName: string
    }
  | { readonly kind: 'guest-remove'; readonly guestId: string }
  | {
      readonly kind: 'guest-merge'
      readonly guestId: string
      readonly memberId: string
    }

/** What a write answered, reduced to what the screen does next. */
type Answer =
  | {
      readonly ok: true
      /** For a merge, how many rows every relinker moved between them. */
      readonly moved?: number
    }
  | { readonly ok: false; readonly reason: PeopleRefusal }

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
    case 'guest-add':
      return 'guest-add'
    case 'guest-rename':
      return `guest-rename:${write.guestId}`
    case 'guest-remove':
      return `guest-remove:${write.guestId}`
    case 'guest-merge':
      return `guest-merge:${write.guestId}`
  }
}

interface Failure {
  readonly at: Anchor
  readonly message: string
  /** A named refusal answers the same way every time; only an unnamed failure is worth repeating. */
  readonly repeatable: boolean
  /** What Retry sends again, so the word means here what it means in `ErrorPanel`. */
  readonly write: Write
}

type TripMemberParticipant = Extract<TripParticipant, { kind: 'member' }>
type TripGuestParticipant = Extract<TripParticipant, { kind: 'guest' }>

/** A merge that went through, as the sentence the guests card reports it with. */
interface MergeReport {
  readonly guestName: string
  readonly memberName: string
  readonly moved: number
}

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
  const [guestName, setGuestName] = useState('')
  const [renaming, setRenaming] = useState<TripGuestParticipant | null>(null)
  const [removingGuest, setRemovingGuest] =
    useState<TripGuestParticipant | null>(null)
  const [merging, setMerging] = useState<TripGuestParticipant | null>(null)
  const [mergeReport, setMergeReport] = useState<MergeReport | null>(null)

  /** Where focus goes after a removal, so it is never dropped on the detached row. */
  const membersHeading = useRef<HTMLHeadingElement>(null)
  /** The same, for a guest who left the list through a removal or a merge. */
  const guestsHeading = useRef<HTMLHeadingElement>(null)
  const guestField = useRef<HTMLInputElement>(null)
  /** {@link removed}'s twin for the two dialogs that take a guest off the list. */
  const guestGone = useRef(false)
  /**
   * Whether the removal dialog is closing on a write that succeeded.
   *
   * A dialog restores focus to whatever opened it, which is right for Cancel and impossible after a
   * removal — the control that opened it left with the row, and the fallback is `<body>`, which
   * sends a keyboard reader back to the top of the page. So the *successful* close, and only that
   * one, hands focus to the heading of the list that just changed.
   *
   * Cleared when the dialog opens rather than when it is read: the close handler can run more than
   * once for a single close, and a flag cleared on the first run leaves the second unguarded — which
   * is how a measured attempt ended on `<body>` anyway, the second run restoring focus to the
   * departing row's button a frame before that row left the page.
   */
  const removed = useRef(false)

  const members = data.participants.filter(
    (person): person is TripMemberParticipant => person.kind === 'member',
  )
  const guests = data.participants.filter(
    (person): person is TripGuestParticipant => person.kind === 'guest',
  )
  const isOwner = data.viewerRole === 'owner'
  const soleOwner =
    members.filter((person) => person.role === 'owner').length === 1

  async function send(write: Write): Promise<Answer> {
    switch (write.kind) {
      case 'add':
        return addTripMemberFn({
          data: { tripId: data.tripId, userId: write.userId, role: write.role },
        })
      case 'role':
        return setTripRoleFn({
          data: {
            tripId: data.tripId,
            memberId: write.memberId,
            role: write.role,
          },
        })
      case 'remove':
        return removeTripMemberFn({
          data: { tripId: data.tripId, memberId: write.memberId },
        })
      case 'leave':
        return leaveTripFn({ data: { tripId: data.tripId } })
      case 'visibility':
        await setTripVisibilityFn({
          data: { tripId: data.tripId, visibility: write.visibility },
        })
        return { ok: true }
      case 'guest-add':
        return addTripGuestFn({
          data: { tripId: data.tripId, displayName: write.displayName },
        })
      case 'guest-rename':
        return renameTripGuestFn({
          data: {
            tripId: data.tripId,
            guestId: write.guestId,
            displayName: write.displayName,
          },
        })
      case 'guest-remove':
        return removeTripGuestFn({
          data: { tripId: data.tripId, guestId: write.guestId },
        })
      case 'guest-merge': {
        const answer = await mergeTripGuestFn({
          data: {
            tripId: data.tripId,
            guestId: write.guestId,
            memberId: write.memberId,
          },
        })
        if (!answer.ok) return answer
        return {
          ok: true,
          moved: Object.values(answer.relinked).reduce(
            (total, count) => total + count,
            0,
          ),
        }
      }
    }
  }

  /** A refusal said in words. Two of them carry what the reader typed, or the bound they met. */
  function refusalCopy(reason: PeopleRefusal, write: Write): string {
    switch (reason) {
      case 'last-owner':
        return t('trips.people.error.lastOwner')
      case 'not-in-workspace':
        return t('trips.people.error.notInWorkspace')
      case 'already-on-trip':
        return t('trips.people.error.alreadyOnTrip')
      case 'guest-name-taken':
        return t('trips.people.error.guestNameTaken', {
          name:
            write.kind === 'guest-add' || write.kind === 'guest-rename'
              ? write.displayName.trim()
              : '',
        })
      case 'guest-limit':
        return t('trips.people.error.guestLimit', { limit: data.guestLimit })
      case 'guest-merge-target':
        return t('trips.people.error.guestMergeTarget')
    }
  }

  /** What happens once the loader has been read again, per verb. */
  function settle(write: Write, answer: Answer): void {
    switch (write.kind) {
      case 'add':
        setPicked(null)
        return
      case 'remove':
        removed.current = true
        setRemoving(null)
        return
      case 'leave':
        // Leaving is the one write whose answer is a page the reader can no longer read.
        void navigate({ to: '/trips' })
        return
      case 'role':
      case 'visibility':
        return
      case 'guest-add':
        setGuestName('')
        // Back to the field for the next name: the submit may have come from the button, and the
        // reload re-renders the card around it, so the keyboard is put there rather than assumed.
        requestAnimationFrame(() => guestField.current?.focus())
        return
      case 'guest-rename':
        setRenaming(null)
        return
      case 'guest-remove':
        guestGone.current = true
        setRemovingGuest(null)
        return
      case 'guest-merge': {
        const member = members.find(
          (person) => person.memberId === write.memberId,
        )
        setMergeReport({
          guestName: merging?.displayName ?? '',
          memberName: member?.name ?? '',
          moved: answer.ok ? (answer.moved ?? 0) : 0,
        })
        guestGone.current = true
        setMerging(null)
        return
      }
    }
  }

  async function run(write: Write): Promise<void> {
    const at = anchorOf(write)
    setBusy(at)
    setFailure(null)
    setMergeReport(null)
    try {
      const answer = await send(write)
      if (!answer.ok) {
        setFailure({
          at,
          message: refusalCopy(answer.reason, write),
          repeatable: false,
          write,
        })
        return
      }
      await router.invalidate()
      settle(write, answer)
    } catch (cause) {
      const failed = readPublicFailure(cause)
      setFailure({
        at,
        message: failed.message ?? t('shell.error.body'),
        repeatable: true,
        write,
      })
    } finally {
      setBusy(null)
    }
  }

  const [picked, setPicked] = useState<string | null>(null)
  const [joiningAs, setJoiningAs] = useState<TripRole>('editor')

  /**
   * A named refusal on a field, which is where a refused name belongs: the fix is an edit to what
   * was typed, and the field keeps its value so the reader adds the distinguishing word.
   */
  function refusalOn(at: Anchor): string | undefined {
    if (failure === null || failure.at !== at || failure.repeatable) {
      return undefined
    }
    return failure.message
  }

  /** {@link failureAt}, for an anchor whose named refusals render on its field instead. */
  function unexpectedAt(at: Anchor): React.ReactNode {
    return failure?.repeatable === true ? failureAt(at) : null
  }

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
              // Sends the same write again, which is what this word means in
              // `ErrorPanel` and so what a reader who has met it there expects.
              onClick={() => void run(failure.write)}
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

  const guestNameFilled = guestName.trim() !== ''
  const addGuestForm = isOwner ? (
    <form
      className="flex w-full flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (!guestNameFilled) return
        void run({ kind: 'guest-add', displayName: guestName })
      }}
    >
      <Field
        label={t('trips.people.guest.add.label')}
        error={refusalOn('guest-add')}
      >
        <Input
          ref={guestField}
          value={guestName}
          maxLength={200}
          autoComplete="off"
          placeholder={t('trips.people.guest.add.placeholder')}
          onChange={(event) => {
            setGuestName(event.target.value)
            // The refusal was about the name as it stood; an edit is the reader answering it.
            if (failure?.at === 'guest-add') setFailure(null)
          }}
        />
      </Field>
      <Button
        type="submit"
        shape="pill"
        className="self-start"
        disabled={!guestNameFilled}
        loading={busy === 'guest-add'}
        loadingLabel={t('trips.people.guest.add.action')}
        icon={<UserPlus aria-hidden />}
      >
        {t('trips.people.guest.add.action')}
      </Button>
      {unexpectedAt('guest-add')}
    </form>
  ) : null

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
            <InviteLinkPanel
              key={data.tripId}
              tripId={data.tripId}
              initial={data.invite}
              archived={data.inviteArchived}
            />
          ) : null}
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
                      // On the trigger as well as in the search box: the
                      // primitive's own "Select…" says nothing about who is
                      // being picked, and this key is the sentence that does.
                      placeholder={t('trips.people.invite.placeholder')}
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

        <section className="flex flex-col gap-6 lg:col-start-1 lg:row-start-1">
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
                        removed.current = false
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

          <Card padding="none">
            <CardHeader className="px-5 py-4">
              <CardTitle ref={guestsHeading} tabIndex={-1} as="h2">
                {t('trips.people.guests.title')}
              </CardTitle>
              <CardDescription>
                {t('trips.people.guests.description')}
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-4 px-5 pb-5">
              {mergeReport === null ? null : (
                <Alert
                  tone="success"
                  size="sm"
                  onDismiss={() => setMergeReport(null)}
                >
                  <p>
                    {t('trips.people.guest.merge.done', {
                      name: mergeReport.guestName,
                      member: mergeReport.memberName,
                    })}
                  </p>
                  {mergeReport.moved === 0 ? (
                    <p className="text-ink-3">
                      {t('trips.people.guest.merge.nothingMoved')}
                    </p>
                  ) : null}
                </Alert>
              )}
              {guests.length === 0 ? (
                <EmptyState
                  size="sm"
                  icon={<UserRound aria-hidden />}
                  title={t('trips.people.guests.empty')}
                  description={t('trips.people.guests.emptyHint')}
                />
              ) : (
                <ul className="flex flex-col gap-1">
                  {guests.map((guest, index) => (
                    <GuestRow
                      key={guest.guestId}
                      guest={guest}
                      index={index}
                      canManage={isOwner}
                      busy={busy}
                      onRename={() => {
                        setFailure(null)
                        setRenaming(guest)
                      }}
                      onMerge={() => {
                        setFailure(null)
                        guestGone.current = false
                        setMerging(guest)
                      }}
                      onRemove={() => {
                        setFailure(null)
                        guestGone.current = false
                        setRemovingGuest(guest)
                      }}
                    />
                  ))}
                </ul>
              )}
              {/* One place in the tree whether the list is empty or not, so the field keeps focus
                  across the first add instead of remounting under the list. */}
              {addGuestForm}
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
        // The panel's own restoration aims at the control that opened it, which after a removal is
        // the row that has just gone. Refused here, and the heading claimed in the same synchronous
        // handler: deferring the focus by a frame hands the window back to that restoration.
        onCloseAutoFocus={(event) => {
          if (!removed.current) return
          event.preventDefault()
          membersHeading.current?.focus()
        }}
      />

      <GuestNameDialog
        // Keyed by the guest so the field starts from their name each time it opens.
        key={`rename:${renaming?.guestId ?? 'closed'}`}
        guest={renaming}
        onOpenChange={(open) => {
          if (!open) setRenaming(null)
        }}
        busy={renaming !== null && busy === `guest-rename:${renaming.guestId}`}
        refusal={
          renaming === null
            ? undefined
            : refusalOn(`guest-rename:${renaming.guestId}`)
        }
        failure={
          renaming === null
            ? null
            : unexpectedAt(`guest-rename:${renaming.guestId}`)
        }
        onEdit={() => setFailure(null)}
        onConfirm={(displayName) => {
          if (renaming === null) return
          void run({
            kind: 'guest-rename',
            guestId: renaming.guestId,
            displayName,
          })
        }}
      />

      <ConfirmDialog
        open={removingGuest !== null}
        onOpenChange={(open) => {
          if (!open) setRemovingGuest(null)
        }}
        title={t('trips.people.guest.remove.title', {
          name: removingGuest?.displayName ?? '',
        })}
        body={t('trips.people.guest.remove.body')}
        confirm={t('trips.people.guest.remove.confirm')}
        cancel={t('trips.people.cancel')}
        busy={
          removingGuest !== null &&
          busy === `guest-remove:${removingGuest.guestId}`
        }
        failure={
          removingGuest === null
            ? null
            : failureAt(`guest-remove:${removingGuest.guestId}`)
        }
        onConfirm={() => {
          if (removingGuest === null) return
          void run({ kind: 'guest-remove', guestId: removingGuest.guestId })
        }}
        onCloseAutoFocus={(event) => {
          if (!guestGone.current) return
          event.preventDefault()
          guestsHeading.current?.focus()
        }}
      />

      <MergeGuestDialog
        key={`merge:${merging?.guestId ?? 'closed'}`}
        guest={merging}
        members={members}
        onOpenChange={(open) => {
          if (!open) setMerging(null)
        }}
        busy={merging !== null && busy === `guest-merge:${merging.guestId}`}
        failure={
          merging === null ? null : failureAt(`guest-merge:${merging.guestId}`)
        }
        onConfirm={(memberId) => {
          if (merging === null) return
          void run({
            kind: 'guest-merge',
            guestId: merging.guestId,
            memberId,
          })
        }}
        onCloseAutoFocus={(event) => {
          if (!guestGone.current) return
          event.preventDefault()
          guestsHeading.current?.focus()
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
      {/* Two groups that wrap rather than one row that truncates: the person is who the row is
          about, so on a narrow viewport the controls drop to their own line instead of squeezing
          the name — which, unwrapped, is the part that disappears first. */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2">
        <div className="flex min-w-0 flex-1 basis-44 items-center gap-3">
          <Avatar src={person.image} name={person.name} size="sm" />
          <span className="min-w-0 truncate text-label font-medium text-ink">
            {person.name}
          </span>
          {isSelf ? (
            <Badge tone="neutral" className="shrink-0">
              {t('trips.people.you')}
            </Badge>
          ) : null}
        </div>

        <div className="ms-auto flex min-w-0 items-center gap-2">
          {canManage && !isSoleOwner ? (
            <SimpleSelect
              size="sm"
              className="w-36 shrink-0"
              options={roleOptions}
              value={person.role}
              disabled={pending}
              onValueChange={(value) =>
                onRoleChange(asRole(value, person.role))
              }
              // A list, not grammar: the control's own label beside the person it belongs to, so a
              // reader never meets several identically-named selects.
              ariaLabel={[t('trips.people.role.label'), person.name].join(
                ' · ',
              )}
            />
          ) : (
            <Badge
              className="shrink-0"
              tone={person.role === 'owner' ? 'brand' : 'neutral'}
            >
              {t(ROLE_COPY[person.role])}
            </Badge>
          )}

          {/* The hint answers a control that is missing, so it is owed only to a reader who would
              otherwise have had it. To everybody else this rule is not news about their own trip. */}
          {isSoleOwner && canManage ? (
            <span className="min-w-0 text-caption text-ink-3">
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
  /** Overrides where focus lands on close. Left out, the dialog restores it to whatever opened it. */
  readonly onCloseAutoFocus?: (event: Event) => void
  readonly pendingLabel?: string
  readonly confirmVariant?: 'danger' | 'primary'
}

/** Both destructive confirmations, which differ only in their words and in where they leave you. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  body,
  confirm,
  cancel,
  busy,
  failure,
  onConfirm,
  onCloseAutoFocus,
  pendingLabel,
  confirmVariant = 'danger',
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm" onCloseAutoFocus={onCloseAutoFocus}>
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
            variant={confirmVariant}
            shape="pill"
            loading={busy}
            loadingLabel={pendingLabel ?? confirm}
            onClick={onConfirm}
          >
            {confirm}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export interface GuestRowProps {
  readonly guest: TripGuestParticipant
  readonly index: number
  readonly canManage: boolean
  readonly busy: Anchor | null
  readonly onRename: () => void
  readonly onMerge: () => void
  readonly onRemove: () => void
}

/**
 * One guest. Every control carries the guest's name in its accessible label, so a screen reader
 * meets "Rename Anna" and "Rename Marek" rather than a column of identical "Rename"s.
 */
export function GuestRow({
  guest,
  index,
  canManage,
  busy,
  onRename,
  onMerge,
  onRemove,
}: GuestRowProps) {
  const t = useTranslate()
  const pending =
    busy === `guest-rename:${guest.guestId}` ||
    busy === `guest-remove:${guest.guestId}` ||
    busy === `guest-merge:${guest.guestId}`
  const name = guest.displayName

  return (
    <li
      style={{ animationDelay: staggerDelay(index) }}
      className={cn(
        'animate-rise flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-lg px-1 py-2',
        pending && 'opacity-60',
      )}
    >
      <div className="flex min-w-0 flex-1 basis-44 items-center gap-3">
        <Avatar name={name} size="sm" />
        <span className="min-w-0 truncate text-label font-medium text-ink">
          {name}
        </span>
        <Badge tone="neutral" className="shrink-0">
          {t('trips.people.guest.badge')}
        </Badge>
      </div>

      {canManage ? (
        <div className="ms-auto flex items-center gap-1">
          <IconButton
            size="sm"
            variant="ghost"
            icon={<Pencil aria-hidden />}
            label={t('trips.people.guest.rename.action', { name })}
            onClick={onRename}
          />
          <IconButton
            size="sm"
            variant="ghost"
            icon={<UserCheck aria-hidden />}
            label={t('trips.people.guest.merge.action', { name })}
            onClick={onMerge}
          />
          <IconButton
            size="sm"
            variant="ghost"
            icon={<UserMinus aria-hidden />}
            label={t('trips.people.guest.remove.action', { name })}
            onClick={onRemove}
          />
        </div>
      ) : null}
    </li>
  )
}

export interface GuestNameDialogProps {
  readonly guest: TripGuestParticipant | null
  readonly onOpenChange: (open: boolean) => void
  readonly busy: boolean
  /** A named refusal, rendered on the field. */
  readonly refusal: string | undefined
  /** An unexpected failure, rendered as an alert with Retry. */
  readonly failure: React.ReactNode
  /** Called as the reader edits, so a refusal about the old value clears. */
  readonly onEdit: () => void
  readonly onConfirm: (displayName: string) => void
}

/** Rename: the add field in a dialog, under the same duplicate rule. */
export function GuestNameDialog({
  guest,
  onOpenChange,
  busy,
  refusal,
  failure,
  onEdit,
  onConfirm,
}: GuestNameDialogProps) {
  const t = useTranslate()
  const [value, setValue] = useState(guest?.displayName ?? '')
  const name = guest?.displayName ?? ''
  const filled = value.trim() !== ''

  return (
    <Dialog open={guest !== null} onOpenChange={onOpenChange}>
      {/* The title and the labelled field say everything; there is no description to point at. */}
      <DialogContent size="sm" aria-describedby={undefined}>
        <form
          onSubmit={(event) => {
            event.preventDefault()
            if (filled) onConfirm(value)
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {t('trips.people.guest.rename.title', { name })}
            </DialogTitle>
          </DialogHeader>

          <DialogBody className="flex flex-col gap-3">
            <Field label={t('trips.people.guest.add.label')} error={refusal}>
              <Input
                value={value}
                maxLength={200}
                autoComplete="off"
                onChange={(event) => {
                  setValue(event.target.value)
                  onEdit()
                }}
              />
            </Field>
            {failure}
          </DialogBody>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              shape="pill"
              onClick={() => onOpenChange(false)}
            >
              {t('trips.people.cancel')}
            </Button>
            <Button
              type="submit"
              shape="pill"
              disabled={!filled}
              loading={busy}
              loadingLabel={t('trips.people.guest.rename.confirm')}
            >
              {t('trips.people.guest.rename.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export interface MergeGuestDialogProps {
  readonly guest: TripGuestParticipant | null
  readonly members: ReadonlyArray<TripMemberParticipant>
  readonly onOpenChange: (open: boolean) => void
  readonly busy: boolean
  readonly failure: React.ReactNode
  readonly onConfirm: (memberId: string) => void
  readonly onCloseAutoFocus: (event: Event) => void
}

/**
 * The irreversible one: "this guest is now…" a member of the trip.
 *
 * The body says it cannot be undone, and once somebody is chosen it names who inherits — the
 * confirm stays disabled until then, so the danger button never fires on nobody.
 */
export function MergeGuestDialog({
  guest,
  members,
  onOpenChange,
  busy,
  failure,
  onConfirm,
  onCloseAutoFocus,
}: MergeGuestDialogProps) {
  const t = useTranslate()
  const [target, setTarget] = useState<string | null>(null)
  const name = guest?.displayName ?? ''
  const heir = members.find((person) => person.memberId === target)

  return (
    <Dialog open={guest !== null} onOpenChange={onOpenChange}>
      <DialogContent size="sm" onCloseAutoFocus={onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>
            {t('trips.people.guest.merge.title', { name })}
          </DialogTitle>
          <DialogDescription>
            {t('trips.people.guest.merge.body', { name })}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-3">
          <Combobox
            options={members.map((person) => ({
              value: person.memberId,
              label: person.name,
            }))}
            value={target}
            onChange={setTarget}
            placeholder={t('trips.people.guest.merge.placeholder')}
            searchPlaceholder={t('trips.people.guest.merge.placeholder')}
            ariaLabel={t('trips.people.guest.merge.placeholder')}
          />
          {/* Always in the tree, so the sentence is announced when a pick fills it. */}
          <p aria-live="polite" className="text-label text-ink-2">
            {heir === undefined
              ? null
              : t('trips.people.guest.merge.inherits', {
                  name,
                  member: heir.name,
                })}
          </p>
          {failure}
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            shape="pill"
            onClick={() => onOpenChange(false)}
          >
            {t('trips.people.cancel')}
          </Button>
          <Button
            type="button"
            variant="danger"
            shape="pill"
            disabled={target === null}
            loading={busy}
            loadingLabel={t('trips.people.guest.merge.confirm')}
            onClick={() => {
              if (target !== null) onConfirm(target)
            }}
          >
            {t('trips.people.guest.merge.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
