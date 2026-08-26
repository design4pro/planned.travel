/**
 * The frame every console action is confirmed in, and the one place their failures are read.
 *
 * Seven of the eight actions the console offers are irreversible, end somebody's session, or hand an
 * operator a credential for another person's account, so every one of them is a dialog with an
 * explicit confirm button rather than a menu item that fires on release. That is not ceremony: a
 * menu item cannot carry a loading state, and an action whose only feedback is a toast arriving two
 * seconds later is an action people press twice.
 *
 * **Refusals are shown, not swallowed.** `src/server/fns/console/errors.ts` raises
 * `ConsoleActionError` with a closed seven-code vocabulary and copy that names the way forward -
 * "revoke every session of the account instead", "demote the account first, then restore its role".
 * Those sentences are the point, so a rejection is rendered inside the dialog, beside the button
 * that produced it, and the dialog stays open. A toast that replaces the panel would take the
 * instruction away with it.
 *
 * What reaches the reader goes through `readConsoleFailure()` first, and that is a repair rather
 * than a formality: a Zod validator rejects with `JSON.stringify(issues)` as its message, so before
 * it existed an operator who typed a short password was shown a bracketed array of `origin`, `code`
 * and `minimum` fields with the sentence buried inside it. Measured on this screen, not guessed at.
 */

import { useCallback, useEffect, useState } from 'react'
import { TriangleAlert } from 'lucide-react'

import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui'
import { readConsoleFailure } from '#/components/console'
import { cn } from '#/lib/cn'

import type { ButtonVariant } from '#/components/ui'
import type { ReactNode } from 'react'

export interface ConsoleActionDialogProps {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: string
  readonly description: ReactNode
  /** The form or explanation between the header and the footer. */
  readonly children?: ReactNode
  readonly confirmLabel: string
  readonly confirmVariant?: ButtonVariant
  /** Disables the confirm button - an empty required field, or nothing to change. */
  readonly confirmDisabled?: boolean
  /** Runs the action. Resolving closes the dialog; rejecting keeps it open and shows why. */
  readonly onConfirm: () => Promise<void>
  readonly className?: string
}

export function ConsoleActionDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  confirmVariant = 'primary',
  confirmDisabled = false,
  onConfirm,
  className,
}: ConsoleActionDialogProps) {
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState<string | null>(null)

  // A dialog reopened after a refusal opens on its own terms, not on the last one's error.
  useEffect(() => {
    if (!open) {
      setFailure(null)
      setBusy(false)
    }
  }, [open])

  const confirm = useCallback(async (): Promise<void> => {
    setBusy(true)
    setFailure(null)
    try {
      await onConfirm()
      onOpenChange(false)
    } catch (cause) {
      setFailure(readConsoleFailure(cause))
    } finally {
      setBusy(false)
    }
  }, [onConfirm, onOpenChange])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // A request in flight owns the panel: closing it would leave the operator with no reading
        // of whether the thing they asked for happened.
        if (busy) return
        onOpenChange(next)
      }}
    >
      <DialogContent size="sm" className={className}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <DialogBody className="flex flex-col gap-4">
          {children}
          {failure === null ? null : (
            <p
              role="alert"
              className={cn(
                'flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft',
                'px-3 py-2.5 text-caption leading-relaxed text-danger',
              )}
            >
              <TriangleAlert aria-hidden className="mt-px size-4 shrink-0" />
              <span className="min-w-0">{failure}</span>
            </p>
          )}
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={busy}
            onClick={() => {
              onOpenChange(false)
            }}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={confirmVariant}
            loading={busy}
            loadingLabel={`${confirmLabel}…`}
            disabled={confirmDisabled}
            onClick={() => {
              void confirm()
            }}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
