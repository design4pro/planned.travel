import { useEffect, useId, useRef, useState } from 'react'
import { Link as LinkIcon } from 'lucide-react'
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Input,
  SimpleSelect,
  Skeleton,
  SwitchField,
} from '#/components/ui'
import { useLocale, useTranslate } from '#/lib/i18n'
import { formatDate } from '#/lib/format'
import {
  createInviteLinkFn,
  replaceInviteLinkFn,
  revealInviteLinkFn,
  updateInviteLinkFn,
} from '../-server/invite'
import { ConfirmDialog } from './people-screen'
import type { InviteAnswer, InviteRefusal } from '../-server/invite'
import type { TripInviteRole, TripInviteView } from '#/server/repos/invites'
import type { MessageKey } from '#/lib/i18n'

const REFUSAL = {
  archived: 'trips.invite.refusal.archived',
  notOwner: 'trips.invite.refusal.notOwner',
  changed: 'trips.invite.refusal.changed',
  creatorGone: 'trips.invite.creatorGone',
  unavailable: 'trips.invite.refusal.notOwner',
} as const satisfies Record<InviteRefusal, MessageKey>

export function InviteLinkPanel({
  tripId,
  initial,
  archived = false,
}: {
  readonly tripId: string
  readonly initial: TripInviteView | null
  readonly archived?: boolean
}) {
  const t = useTranslate()
  const locale = useLocale()
  const id = useId()
  const [invite, setInvite] = useState(initial)
  const [secret, setSecret] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [copying, setCopying] = useState(false)
  const [ready, setReady] = useState(true)
  const [error, setError] = useState<MessageKey | null>(null)
  const [notice, setNotice] = useState<MessageKey | null>(null)
  const [dialog, setDialog] = useState<'replace' | 'upgrade' | null>(null)
  const lock = useRef(false)
  const mounted = useRef(true)
  const epoch = useRef(0)
  const heading = useRef<HTMLHeadingElement>(null)
  const copy = useRef<HTMLButtonElement>(null)
  const replace = useRef<HTMLButtonElement>(null)
  const input = useRef<HTMLInputElement>(null)
  const create = useRef<HTMLButtonElement>(null)
  const returnToCopy = useRef(false)

  // Local component state is the only owner of a revealed credential. A changed loader snapshot
  // invalidates it before re-authorising; no URL enters router data, query caches or storage.
  useEffect(() => {
    mounted.current = true
    const generation = ++epoch.current
    setInvite(initial)
    setSecret(null)
    setError(null)
    setReady(true)
    if (initial?.state === 'active') {
      void revealInviteLinkFn({ data: { tripId } })
        .then((answer) => {
          if (!mounted.current || epoch.current !== generation) return
          if (answer.ok) {
            setInvite(answer.invite)
            setSecret(answer.invite?.state === 'active' ? answer.secret : null)
            setReady(true)
          } else {
            setInvite(null)
            setError(REFUSAL[answer.reason])
            setReady(false)
          }
        })
        .catch(() => {
          if (mounted.current && epoch.current === generation) {
            setError('trips.invite.error.title')
            setReady(false)
          }
        })
    }
    return () => {
      mounted.current = false
      ++epoch.current
    }
  }, [tripId, initial])

  function apply(answer: InviteAnswer<{ secret?: string | null }>) {
    if (!answer.ok) return false
    setInvite(answer.invite)
    setSecret(
      answer.invite?.state === 'active' ? (answer.secret ?? null) : null,
    )
    setReady(true)
    return true
  }

  async function refresh(): Promise<boolean> {
    setSecret(null)
    const answer = await revealInviteLinkFn({ data: { tripId } })
    if (!mounted.current) return false
    if (!answer.ok) {
      setInvite(null)
      setReady(false)
      setError(REFUSAL[answer.reason])
      return false
    }
    return apply(answer)
  }

  async function run(
    work: () => Promise<InviteAnswer<{ secret?: string | null }>>,
    success: MessageKey,
    focus: 'copy' | 'replace' | 'stay',
  ) {
    if (lock.current) return
    const previousFocus = document.activeElement
    lock.current = true
    ++epoch.current
    setBusy(true)
    setError(null)
    setNotice(null)
    try {
      const answer = await work()
      if (!mounted.current) return
      if (!answer.ok) {
        setSecret(null)
        setDialog(null)
        if (
          answer.reason === 'changed' ||
          answer.reason === 'archived' ||
          answer.reason === 'creatorGone'
        ) {
          await refresh()
          setNotice(REFUSAL[answer.reason])
        } else {
          setInvite(null)
          setReady(false)
          setError(REFUSAL[answer.reason])
        }
      } else {
        apply(answer)
        const current =
          answer.invite?.state !== 'active' ||
          Boolean(answer.secret) ||
          (await refresh())
        setDialog(null)
        if (current) setNotice(success)
      }
    } catch {
      // The write may have committed. Re-read before offering any new mutation; never replay intent.
      setSecret(null)
      setDialog(null)
      setReady(false)
      try {
        if (await refresh()) setNotice('trips.invite.announce.recovered')
      } catch {
        setError('trips.invite.error.title')
      }
    } finally {
      lock.current = false
      if (mounted.current) {
        setBusy(false)
        requestAnimationFrame(() => {
          if (focus === 'copy') (copy.current ?? heading.current)?.focus()
          else if (focus === 'replace')
            (replace.current ?? heading.current)?.focus()
          else if (!previousFocus?.isConnected) heading.current?.focus()
        })
      }
    }
  }

  async function retry() {
    if (lock.current) return
    lock.current = true
    setBusy(true)
    setError(null)
    try {
      await refresh()
    } catch {
      setError('trips.invite.error.title')
    } finally {
      lock.current = false
      setBusy(false)
      requestAnimationFrame(() => heading.current?.focus())
    }
  }

  async function copyLink() {
    if (lock.current || !secret) return
    lock.current = true
    setCopying(true)
    let copied = false
    try {
      await navigator.clipboard.writeText(
        `${window.location.origin}/join/${secret}`,
      )
      copied = true
      setNotice('trips.invite.copied')
    } catch {
      setNotice('trips.invite.copyFailed')
      input.current?.focus()
      input.current?.select()
    } finally {
      lock.current = false
      setCopying(false)
      if (copied) requestAnimationFrame(() => copy.current?.focus())
    }
  }

  const active = invite?.state === 'active'
  const editable = active || invite?.state === 'off'
  const role = invite?.role ?? 'viewer'
  const controlsPending = busy || (active && !secret)
  const changeRole = (next: string) => {
    if (
      controlsPending ||
      lock.current ||
      !invite ||
      (next !== 'editor' && next !== 'viewer')
    )
      return
    if (next === 'editor' && role === 'viewer') {
      setDialog('upgrade')
      return
    }
    void update({ role: next }, 'trips.invite.announce.roleViewer')
  }
  function update(
    patch: { role?: TripInviteRole; enabled?: boolean },
    message: MessageKey,
  ) {
    if (!invite) return
    return run(
      () =>
        updateInviteLinkFn({
          data: { tripId, expectedRotation: invite.rotation, ...patch },
        }),
      message,
      'stay',
    )
  }

  let dialogBody: MessageKey = 'trips.invite.replace.body'
  if (dialog === 'upgrade') dialogBody = 'trips.invite.role.upgrade.body'
  else if (!active) dialogBody = 'trips.invite.replace.deadBody'

  return (
    <section
      aria-labelledby={`${id}-title`}
      className="animate-rise min-w-0 rounded-xl bg-surface-2 p-5 sm:p-6"
    >
      <h2
        id={`${id}-title`}
        tabIndex={-1}
        ref={heading}
        className="text-title-sm font-semibold text-ink"
      >
        {t('trips.invite.title')}
      </h2>
      <p className="mt-2 text-body-sm text-ink-3">
        {t('trips.invite.description')}
      </p>
      <div
        role="status"
        aria-live="polite"
        className="mt-3 min-h-5 text-caption text-ink-2"
      >
        {notice ? t(notice) : ''}
      </div>
      {error ? (
        <div className="mt-4 flex flex-col gap-3">
          <Alert tone="danger" id={`${id}-error`}>
            {t(error)}
          </Alert>
          <Button
            variant="secondary"
            loading={busy}
            onClick={() => void retry()}
          >
            {t('trips.invite.error.retry')}
          </Button>
        </div>
      ) : null}
      {!ready && !error ? <Skeleton className="mt-4 h-24 w-full" /> : null}
      {ready ? (
        <div className="mt-4 flex min-w-0 flex-col gap-5" aria-busy={busy}>
          {!invite && !archived ? (
            <>
              <EmptyState
                size="sm"
                icon={<LinkIcon aria-hidden />}
                title={t('trips.invite.empty.title')}
                description={t('trips.invite.empty.body')}
              />
              <Button
                ref={create}
                loading={busy}
                onClick={() =>
                  void run(
                    () => createInviteLinkFn({ data: { tripId } }),
                    'trips.invite.announce.created',
                    'copy',
                  )
                }
              >
                {t('trips.invite.action.create')}
              </Button>
              <p className="text-caption text-ink-3">
                {t('trips.people.invite.emptyHint')}
              </p>
            </>
          ) : null}
          {active ? (
            <div className="flex min-w-0 flex-col gap-2">
              <label
                htmlFor={`${id}-url`}
                className="text-label font-medium text-ink"
              >
                {t('trips.invite.link.label')}
              </label>
              <Input
                id={`${id}-url`}
                ref={input}
                readOnly
                dir="ltr"
                value={secret ? `${window.location.origin}/join/${secret}` : ''}
                aria-busy={!secret}
                className="min-w-0 font-mono"
              />
              <Button
                ref={copy}
                variant="secondary"
                size="sm"
                loading={busy || copying || !secret}
                onClick={() => void copyLink()}
              >
                {t('trips.invite.copy')}
              </Button>
            </div>
          ) : null}
          {editable ? (
            <>
              <Field label={t('trips.people.invite.role')}>
                <SimpleSelect
                  value={role}
                  aria-disabled={controlsPending}
                  onValueChange={changeRole}
                  options={[
                    { value: 'viewer', label: t('trips.people.role.viewer') },
                    { value: 'editor', label: t('trips.people.role.editor') },
                  ]}
                />
              </Field>
              <SwitchField
                checked={active}
                aria-disabled={controlsPending}
                label={t('trips.invite.switch.label')}
                description={t(
                  active
                    ? 'trips.invite.switch.onHint'
                    : 'trips.invite.switch.offHint',
                )}
                onCheckedChange={(enabled) => {
                  if (!controlsPending && !lock.current)
                    void update(
                      { enabled },
                      enabled
                        ? 'trips.invite.announce.newLink'
                        : 'trips.invite.announce.off',
                    )
                }}
              />
              {invite?.state === 'off' ? (
                <p className="text-body-sm text-ink-2">
                  {t('trips.invite.off.body')}
                </p>
              ) : null}
            </>
          ) : null}
          {invite?.state === 'stale' ? (
            <p className="text-body-sm text-ink-2">{t('trips.invite.stale')}</p>
          ) : null}
          {invite?.state === 'creator-gone' ? (
            <p className="text-body-sm text-ink-2">
              {t('trips.invite.creatorGone')}
            </p>
          ) : null}
          {archived || invite?.state === 'archived' ? (
            <p className="text-body-sm text-ink-2">
              {t('trips.invite.archived')}
            </p>
          ) : null}
          {invite && invite.state !== 'archived' ? (
            <Button
              ref={replace}
              variant="ghost"
              size="sm"
              loading={controlsPending}
              onClick={() => {
                returnToCopy.current = !active
                setDialog('replace')
              }}
            >
              {t('trips.invite.replace.action')}
            </Button>
          ) : null}
          {invite ? (
            <div className="text-caption text-ink-3">
              <p>
                {invite.useCount === 0
                  ? t('trips.invite.uses.never')
                  : t('trips.invite.uses', { count: invite.useCount })}
              </p>
              {invite.lastUsedAt ? (
                <p>
                  {t('trips.invite.lastUsed', {
                    when:
                      formatDate(
                        new Date(invite.lastUsedAt).toISOString(),
                        locale,
                      ) ?? '',
                  })}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
      <ConfirmDialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!busy && !open) setDialog(null)
        }}
        title={t(
          dialog === 'upgrade'
            ? 'trips.invite.role.upgrade.title'
            : 'trips.invite.replace.title',
        )}
        body={t(dialogBody)}
        confirm={t(
          dialog === 'upgrade'
            ? 'trips.invite.role.upgrade.confirm'
            : 'trips.invite.replace.confirm',
        )}
        pendingLabel={
          dialog === 'replace' ? t('trips.invite.replace.pending') : undefined
        }
        confirmVariant={dialog === 'upgrade' ? 'primary' : 'danger'}
        cancel={t('trips.people.cancel')}
        busy={busy}
        failure={null}
        onConfirm={() => {
          if (!invite) return
          if (dialog === 'upgrade')
            void update({ role: 'editor' }, 'trips.invite.announce.roleEditor')
          else
            void run(
              () =>
                replaceInviteLinkFn({
                  data: { tripId, role, expectedRotation: invite.rotation },
                }),
              'trips.invite.announce.newLink',
              returnToCopy.current ? 'copy' : 'replace',
            )
        }}
        onCloseAutoFocus={(event) => {
          if (returnToCopy.current) {
            event.preventDefault()
            requestAnimationFrame(() =>
              (copy.current ?? replace.current ?? heading.current)?.focus(),
            )
            returnToCopy.current = false
          }
        }}
      />
    </section>
  )
}
