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
  const [open, setOpen] = useState(false)

  const revoke = useCallback(async (): Promise<void> => {
    await revokePlatformSessionFn({ data: { userId, sessionId } })
    await onRevoked()
    toast.success('Session ended', {
      description: 'The device has to sign in again on its next request.',
    })
  }, [onRevoked, sessionId, userId])

  return (
    <>
      <IconButton
        icon={<LogOut />}
        label={`End the session on ${describedAs}`}
        variant="danger"
        size="sm"
        onClick={() => {
          setOpen(true)
        }}
      />
      <ConsoleActionDialog
        open={open}
        onOpenChange={setOpen}
        title="End this session"
        description={`${describedAs} has to sign in again on its next request. If it is the session you are reading this in, you are signed out with it.`}
        confirmLabel="End session"
        confirmVariant="danger"
        onConfirm={revoke}
      />
    </>
  )
}
