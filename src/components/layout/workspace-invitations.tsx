import { useEffect, useRef, useState } from 'react'
import {
  Badge,
  Button,
  Card,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  SimpleSelect,
} from '#/components/ui'
import { useI18n } from '#/lib/i18n'
import { formatDate } from '#/lib/format'
import type { MessageKey } from '#/lib/i18n'

export type InvitationRole = 'owner' | 'admin' | 'member'
export type InvitationAction = 'invite' | 'resend' | 'revoke'
export type InvitationActionInput =
  { email: string; role: InvitationRole } | { invitationId: string }
export type InvitationOutcome =
  | { ok: true; delivered: boolean; invitationId: string }
  | { ok: false; reason: string }
export interface PendingWorkspaceInvitation {
  readonly id: string
  readonly email: string
  readonly role: string | null
  readonly expiresAt: string
  readonly inviterName: string | null
  readonly inviterEmail: string | null
}
const ROLE_KEYS: Record<InvitationRole, MessageKey> = {
  member: 'settings.role.member',
  admin: 'settings.role.admin',
  owner: 'settings.role.owner',
}
const ERROR_KEYS: Record<string, MessageKey | undefined> = {
  'already-member': 'settings.workspace.invite.existing',
  'invitation-exists': 'settings.workspace.invite.duplicate',
  quota: 'settings.workspace.seatsFull.title',
}

export function WorkspaceInvitations({
  invitations,
  roles,
  now,
  onAction,
  reload,
}: {
  invitations: ReadonlyArray<PendingWorkspaceInvitation>
  roles: ReadonlyArray<InvitationRole>
  now: number
  onAction: (
    action: InvitationAction,
    input: InvitationActionInput,
  ) => Promise<InvitationOutcome>
  reload: () => Promise<void>
}) {
  const { t, locale } = useI18n()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<InvitationRole>('member')
  const [busy, setBusy] = useState(false)
  const [needsReload, setNeedsReload] = useState(false)
  const [message, setMessage] = useState<MessageKey | null>(null)
  const [fieldError, setFieldError] = useState<MessageKey | null>(null)
  const [revoke, setRevoke] = useState<PendingWorkspaceInvitation | null>(null)
  const emailRef = useRef<HTMLInputElement>(null)
  const focusAfterReload = useRef(false)
  useEffect(() => {
    if (!busy && !needsReload && focusAfterReload.current) {
      focusAfterReload.current = false
      emailRef.current?.focus()
    }
  }, [busy, needsReload, fieldError])
  async function refresh() {
    setBusy(true)
    try {
      await reload()
      setNeedsReload(false)
    } catch {
      setNeedsReload(true)
    } finally {
      setBusy(false)
    }
  }
  async function act(action: InvitationAction, input: InvitationActionInput) {
    setBusy(true)
    setFieldError(null)
    setMessage(null)
    setRevoke(null)
    try {
      const result = await onAction(action, input)
      if (result.ok) {
        if (action === 'invite') setEmail('')
        let key: MessageKey = 'settings.workspace.invite.delivery'
        if (action === 'revoke') key = 'settings.workspace.invite.revoked'
        else if (result.delivered) key = 'settings.workspace.invite.sent'
        setMessage(key)
      } else {
        const key =
          ERROR_KEYS[result.reason] ?? 'settings.workspace.invite.failed'
        if (action === 'invite') {
          setFieldError(key)
          focusAfterReload.current = true
        } else setMessage(key)
      }
    } catch {
      setMessage('settings.workspace.invite.failed')
    }
    // Reconcile before another mutation, including an unknown response or a stale refusal.
    try {
      await reload()
      setNeedsReload(false)
    } catch {
      setNeedsReload(true)
    } finally {
      setBusy(false)
    }
  }
  return (
    <Card className="space-y-4">
      <h2 className="text-heading-sm">
        {t('settings.workspace.invitations.title')}
      </h2>
      {roles.length > 0 ? (
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(event) => {
            event.preventDefault()
            void act('invite', { email, role })
          }}
        >
          <Field
            className="min-w-0 flex-1"
            label={t('settings.security.email.label')}
            error={fieldError ? t(fieldError) : undefined}
          >
            <Input
              ref={emailRef}
              type="email"
              required
              maxLength={320}
              value={email}
              disabled={busy || needsReload}
              onChange={(event) => {
                setEmail(event.target.value)
                setFieldError(null)
              }}
            />
          </Field>
          <Field label={t('settings.workspace.members.role')}>
            <SimpleSelect
              ariaLabel={t('settings.workspace.members.role')}
              value={role}
              disabled={busy || needsReload}
              options={roles.map((value) => ({
                value,
                label: t(ROLE_KEYS[value]),
              }))}
              onValueChange={(value) => {
                if (
                  value === 'owner' ||
                  value === 'admin' ||
                  value === 'member'
                )
                  setRole(value)
              }}
            />
          </Field>
          <Button
            type="submit"
            disabled={busy || needsReload}
            loading={busy}
            loadingLabel={t('ui.status.loading')}
          >
            {t('settings.workspace.invite.invite')}
          </Button>
        </form>
      ) : null}
      <div role="status" aria-live="polite">
        {message ? t(message) : null}
      </div>
      {needsReload ? (
        <div role="alert">
          <p>{t('settings.workspace.invite.failed')}</p>
          <Button
            disabled={busy}
            onClick={() => {
              void refresh()
            }}
          >
            {t('settings.workspace.invite.reload')}
          </Button>
        </div>
      ) : null}
      {invitations.length === 0 ? (
        <p className="text-body text-ink-3">
          {t('settings.workspace.invitations.emptyTitle')}
        </p>
      ) : (
        <ul className="divide-y divide-edge-faint">
          {invitations.map((row) => {
            const expired = Date.parse(row.expiresAt) <= now
            const permitted = roles.includes(row.role as InvitationRole)
            return (
              <li
                key={row.id}
                className="flex flex-wrap items-center gap-3 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="break-all text-label">{row.email}</p>
                  <p className="text-caption text-ink-3">
                    {t('settings.workspace.invite.by', {
                      name: row.inviterName ?? row.inviterEmail ?? '—',
                    })}
                  </p>
                  <p className="text-caption text-ink-3">
                    {t('settings.workspace.invitations.expires', {
                      date:
                        formatDate(row.expiresAt, locale) ??
                        t('settings.workspace.invitations.expiresSoon'),
                    })}
                  </p>
                </div>
                <Badge>
                  {row.role && row.role in ROLE_KEYS
                    ? t(ROLE_KEYS[row.role as InvitationRole])
                    : row.role}
                </Badge>
                {expired ? (
                  <Badge tone="warning">
                    {t('settings.workspace.invite.expired')}
                  </Badge>
                ) : null}
                {permitted ? (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={busy || needsReload}
                    onClick={() => {
                      void act('resend', { invitationId: row.id })
                    }}
                  >
                    {t('settings.workspace.invite.resend')}
                  </Button>
                ) : null}
                {!expired && roles.length > 0 ? (
                  <Button
                    size="sm"
                    variant="danger"
                    disabled={busy || needsReload}
                    onClick={() => setRevoke(row)}
                  >
                    {t('settings.workspace.invite.revoke')}
                  </Button>
                ) : null}
              </li>
            )
          })}
        </ul>
      )}
      <Dialog
        open={revoke !== null}
        onOpenChange={(open) => {
          if (!open) setRevoke(null)
        }}
      >
        <DialogContent hideClose>
          <DialogHeader>
            <DialogTitle>{t('settings.workspace.invite.confirm')}</DialogTitle>
            <DialogDescription>{revoke?.email}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setRevoke(null)}>
              {t('shell.admin.members.role.promote.cancel')}
            </Button>
            <Button
              variant="danger"
              onClick={() => {
                if (revoke) void act('revoke', { invitationId: revoke.id })
              }}
            >
              {t('settings.workspace.invite.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
