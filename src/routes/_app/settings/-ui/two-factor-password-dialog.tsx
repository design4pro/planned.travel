import { useEffect, useRef, useState } from 'react'
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
import { TwoFactorKey } from './two-factor-key'
import type { AuthFailure } from '#/lib/auth/client'

/** Each action asks anew; only a successful action may replace the opener. */
export function TwoFactorPasswordDialog({
  action,
  title,
  body,
  confirm,
  pending,
  onConfirm,
  focusReplacement,
  done,
}: {
  action: string
  title: string
  body: string
  confirm: string
  pending: string
  onConfirm: (password: string) => Promise<AuthFailure | { uri: string } | null>
  done?: string
  focusReplacement: () => void
}) {
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  const [uri, setUri] = useState<string | null>(null)
  const doneButton = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (uri) doneButton.current?.focus()
  }, [uri])
  const [password, setPassword] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [busy, setBusy] = useState(false)
  const succeeded = useRef(false)
  const field = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const feedback = useTwoFactorFeedback()
  function close() {
    setOpen(false)
    setPassword('')
    setUri(null)
  }
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
      } else if ('uri' in failure) {
        setPassword('')
        setUri(failure.uri)
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
        if (!value) close()
        else {
          setOpen(true)
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
            {uri ? (
              <TwoFactorKey uri={uri} />
            ) : (
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
            )}
          </DialogBody>
          <DialogFooter>
            {uri ? (
              <Button ref={doneButton} type="button" onClick={close}>
                {done}
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="secondary"
                  disabled={busy}
                  onClick={close}
                >
                  {t('modules.action.cancel')}
                </Button>
                <Button
                  type="submit"
                  loading={busy}
                  loadingLabel={pending}
                  disabled={!password || !!feedback.wait}
                >
                  {confirm}
                </Button>
              </>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
