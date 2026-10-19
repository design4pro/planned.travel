import { useRef, useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import type { MessageKey } from '#/lib/i18n'

export type DepartureOutcome =
  | { readonly ok: true }
  | {
      readonly ok: false
      readonly reason:
        'last-owner' | 'not-permitted' | 'not-found' | 'impersonated' | 'failed'
    }
export const DEPARTURE_COPY: Record<
  Extract<DepartureOutcome, { ok: false }>['reason'],
  MessageKey
> = {
  'last-owner': 'settings.workspace.departure.lastOwner',
  'not-permitted': 'settings.workspace.departure.notPermitted',
  'not-found': 'settings.workspace.departure.notFound',
  impersonated: 'settings.workspace.departure.impersonated',
  failed: 'settings.workspace.departure.failed',
}

/** A deliberate confirmation; an uncertain response requires reconciliation before another write. */
export function MemberDepartureControl({
  name,
  workspace,
  self,
  onConfirm,
}: {
  readonly name: string
  readonly workspace: string
  readonly self: boolean
  readonly onConfirm: () => Promise<DepartureOutcome>
}) {
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [refusal, setRefusal] = useState<keyof typeof DEPARTURE_COPY | null>(
    null,
  )
  const cancel = useRef<HTMLButtonElement>(null)
  const action = self
    ? 'settings.workspace.departure.leave'
    : 'settings.workspace.departure.remove'
  async function confirm() {
    setPending(true)
    try {
      const outcome = await onConfirm()
      if (outcome.ok) setOpen(false)
      else setRefusal(outcome.reason)
    } catch {
      setRefusal('failed')
    } finally {
      setPending(false)
    }
  }
  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => {
          setOpen(true)
        }}
      >
        {t(action)}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(next) => {
          if (!pending) setOpen(next)
        }}
      >
        <DialogContent
          size="sm"
          onOpenAutoFocus={(event) => {
            event.preventDefault()
            cancel.current?.focus()
          }}
          onEscapeKeyDown={(event) => {
            if (pending) event.preventDefault()
          }}
          onInteractOutside={(event) => {
            if (pending) event.preventDefault()
          }}
        >
          <DialogHeader>
            <DialogTitle>
              {t('settings.workspace.departure.title', { workspace })}
            </DialogTitle>
            <DialogDescription>
              {t('settings.workspace.departure.body', { name, workspace })}
            </DialogDescription>
          </DialogHeader>
          {refusal ? (
            <div role="alert" tabIndex={-1} ref={(node) => node?.focus()}>
              <Alert tone="warning" title={t(DEPARTURE_COPY[refusal])} />
            </div>
          ) : null}
          <DialogFooter>
            <Button
              ref={cancel}
              variant="secondary"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              {t('settings.workspace.departure.cancel')}
            </Button>
            {refusal ? (
              <Button
                variant="primary"
                onClick={() => window.location.reload()}
              >
                {t('settings.workspace.departure.reload')}
              </Button>
            ) : (
              <Button
                variant="danger"
                disabled={pending}
                onClick={() => void confirm()}
              >
                {t(pending ? 'settings.workspace.departure.pending' : action)}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
