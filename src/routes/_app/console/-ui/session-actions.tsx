/**
 * Ending one session, from the row that describes it.
 *
 * Separate from {@link UserActions} because it is aimed at a *session* rather than at an account:
 * the audit vocabulary records it as `platform.session.revoked` with the session's own id in
 * `entity_id`, and the refusal it can meet is its own — `target-beyond-cap`, raised when the account
 * holds more sessions than one call can enumerate and the named one was not among them. That
 * sentence tells the operator to revoke every session instead, which is a different control, so it
 * is shown in the dialog rather than flashed past in a toast.
 */

import { useCallback, useState } from 'react'
import { LogOut } from 'lucide-react'
import { toast } from 'sonner'

import { IconButton } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { revokePlatformSessionFn } from '#/server/fns/console/sessions'
import { ConsoleActionDialog } from './action-dialog'

export interface RevokeSessionButtonProps {
  readonly userId: string
  readonly sessionId: string
  /** The device the session belongs to, for the confirmation copy. */
  readonly describedAs: string
  readonly onRevoked: () => Promise<void> | void
}

export function RevokeSessionButton({
  userId,
  sessionId,
  describedAs,
  onRevoked,
}: RevokeSessionButtonProps) {
  const t = useTranslate()
  const [open, setOpen] = useState(false)

  const revoke = useCallback(async (): Promise<void> => {
    await revokePlatformSessionFn({ data: { userId, sessionId } })
    await onRevoked()
    toast.success(t('console.session.revoke.done'), {
      description: t('console.session.revoke.done.body'),
    })
  }, [onRevoked, sessionId, t, userId])

  return (
    <>
      <IconButton
        icon={<LogOut />}
        label={t('console.session.revoke.label', { device: describedAs })}
        variant="danger"
        size="sm"
        onClick={() => {
          setOpen(true)
        }}
      />
      <ConsoleActionDialog
        open={open}
        onOpenChange={setOpen}
        title={t('console.session.revoke.title')}
        description={t('console.session.revoke.body', { device: describedAs })}
        confirmLabel={t('console.session.revoke.confirm')}
        confirmVariant="danger"
        onConfirm={revoke}
      />
    </>
  )
}
