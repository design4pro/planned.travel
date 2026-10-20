import { useRef, useState } from 'react'
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Field,
  Input,
} from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { thrownToAuthFailure } from '#/lib/auth/client'
import { TwoFactorFeedback, useTwoFactorFeedback } from './two-factor-feedback'
import type { AuthFailure } from '#/lib/auth/client'

/** Each action asks anew; only a successful action may replace the opener. */
export function TwoFactorPasswordDialog({
  action,
  title,
  body,
  confirm,
  pending,
  cancel,
  danger = false,
  onConfirm,
  focusReplacement,
}: {
  action: string
  title: string
  body: string
  confirm: string
  pending: string
  cancel?: string
  danger?: boolean
  onConfirm: (password: string) => Promise<AuthFailure | null>
  focusReplacement: () => void
}) {
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [busy, setBusy] = useState(false)
  const succeeded = useRef(false)
  const field = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const feedback = useTwoFactorFeedback()
  async function submit() {
    if (busy || feedback.wait || !password) return
    setBusy(true)
    setInvalid(false)
    feedback.setFailure(null)
    try {
      const failure = await onConfirm(password)
      if (failure === null) {
        succeeded.current = true
        setPassword('')
        setOpen(false)
      } else if (failure.code === 'INVALID_PASSWORD') {
        setPassword('')
        setInvalid(true)
        field.current?.focus()
      } else {
        if (failure.status !== 429 && failure.status !== 0) setPassword('')
        feedback.reject(failure, 'password')
      }
    } catch (cause) {
      feedback.reject(thrownToAuthFailure(cause), 'password')
    } finally {
      setBusy(false)
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (busy) return
        setOpen(value)
        if (!value) setPassword('')
        else {
          setInvalid(false)
          feedback.setFailure(null)
          succeeded.current = false
        }
      }}
    >
      <DialogTrigger asChild>
        <Button ref={trigger} variant="secondary">
          {action}
        </Button>
      </DialogTrigger>
      <DialogContent
        onCloseAutoFocus={(event) => {
          if (succeeded.current && !trigger.current?.isConnected) {
            event.preventDefault()
            focusReplacement()
          }
        }}
      >
        <form
          data-sentry-block
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{body}</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <TwoFactorFeedback failure={feedback.failure} />
            <Field
              label={t('settings.twoFactor.password.label')}
              error={
                invalid ? t('settings.twoFactor.password.invalid') : undefined
              }
            >
              <Input
                ref={field}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setOpen(false)
                setPassword('')
              }}
            >
              {cancel ?? t('modules.action.cancel')}
            </Button>
            <Button
              type="submit"
              variant={danger ? 'danger' : undefined}
              loading={busy}
              loadingLabel={pending}
              disabled={!password || !!feedback.wait}
            >
              {confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
