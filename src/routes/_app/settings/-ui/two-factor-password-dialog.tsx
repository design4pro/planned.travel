import { useEffect, useRef, useState } from 'react'
import {
  Button,
  CodeInput,
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
  RadioGroup,
  RadioGroupItem,
} from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { authRequestFailure } from '#/lib/auth/client'
import { TwoFactorFeedback, useTwoFactorFeedback } from './two-factor-feedback'
import type { AuthFailure, FactorProof } from '#/lib/auth/client'

/** Password and possession are collected anew for each intent and cleared on close. */
export function TwoFactorPasswordDialog({
  action,
  title,
  body,
  confirm,
  pending,
  cancel,
  danger = false,
  disabled = false,
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
  disabled?: boolean
  onConfirm: (
    password: string,
    proof: FactorProof,
  ) => Promise<AuthFailure | null>
  focusReplacement: () => void
}) {
  const t = useTranslate()
  const mounted = useRef(true)
  const titleRef = useRef<HTMLHeadingElement>(null)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const [open, setOpen] = useState(false)
  const [password, setPassword] = useState('')
  const [proof, setProof] = useState<FactorProof>({ kind: 'totp', code: '' })
  const [invalid, setInvalid] = useState<'password' | 'proof' | null>(null)
  const [busy, setBusy] = useState(false)
  const succeeded = useRef(false)
  const field = useRef<HTMLInputElement>(null)
  const proofField = useRef<HTMLInputElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const feedback = useTwoFactorFeedback()
  useEffect(() => {
    if (!busy && invalid === 'password') field.current?.focus()
    if (!busy && invalid === 'proof') proofField.current?.focus()
  }, [busy, invalid])
  function close() {
    setOpen(false)
    setPassword('')
    setProof({ kind: 'totp', code: '' })
  }
  async function submit() {
    if (busy || feedback.wait || !password || !proof.code) return
    titleRef.current?.focus()
    setBusy(true)
    setInvalid(null)
    feedback.setFailure(null)
    try {
      const failure = await onConfirm(password, proof)
      if (!mounted.current) return
      if (failure === null) {
        succeeded.current = true
        close()
      } else if (failure.code === 'INVALID_PASSWORD') {
        setPassword('')
        setInvalid('password')
        field.current?.focus()
      } else if (
        ['INVALID_CODE', 'INVALID_BACKUP_CODE', 'FACTOR_PROOF_USED'].includes(
          failure.code ?? '',
        )
      ) {
        setProof({ ...proof, code: '' })
        setInvalid('proof')
        proofField.current?.focus()
      } else {
        if (failure.status !== 429) {
          setPassword('')
          setProof({ ...proof, code: '' })
        }
        feedback.reject(failure, 'password')
      }
    } catch (cause) {
      if (!mounted.current) return
      feedback.reject(authRequestFailure(cause), 'password')
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
          setInvalid(null)
          feedback.setFailure(null)
          succeeded.current = false
        }
      }}
    >
      <DialogTrigger asChild>
        <Button
          ref={trigger}
          variant="secondary"
          disabled={disabled}
          className="h-auto min-h-10 whitespace-normal"
        >
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
            <DialogTitle ref={titleRef} tabIndex={-1}>
              {title}
            </DialogTitle>
            <DialogDescription>{body}</DialogDescription>
          </DialogHeader>
          <DialogBody className="flex flex-col gap-4">
            <p>{t('settings.twoFactor.security.effect')}</p>
            <p role="status" aria-live="polite">
              {busy ? pending : ''}
            </p>
            <TwoFactorFeedback failure={feedback.failure} />
            <Field
              label={t('settings.twoFactor.password.label')}
              error={
                invalid === 'password'
                  ? t('settings.twoFactor.password.invalid')
                  : undefined
              }
            >
              <Input
                disabled={busy}
                ref={field}
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </Field>
            <Field label={t('auth.twoFactor.methods')}>
              <RadioGroup
                disabled={busy}
                aria-label={t('auth.twoFactor.methods')}
                value={proof.kind}
                onValueChange={(kind) => {
                  if (kind !== 'totp' && kind !== 'backup') return
                  setProof({ kind, code: '' })
                  setInvalid(null)
                }}
              >
                <RadioGroupItem
                  value="totp"
                  label={t('auth.twoFactor.totp.tab')}
                />
                <RadioGroupItem
                  value="backup"
                  label={t('auth.twoFactor.backup.label')}
                />
              </RadioGroup>
            </Field>
            <Field
              label={t(
                proof.kind === 'totp'
                  ? 'settings.twoFactor.code.label'
                  : 'auth.twoFactor.backup.label',
              )}
              hint={t('settings.twoFactor.security.currentStep')}
              error={
                invalid === 'proof'
                  ? t('settings.twoFactor.security.invalidProof')
                  : undefined
              }
            >
              {proof.kind === 'totp' ? (
                <CodeInput
                  disabled={busy}
                  ref={proofField}
                  maxLength={6}
                  value={proof.code}
                  onChange={(event) =>
                    setProof({
                      kind: 'totp',
                      code: event.target.value.replace(/\D/g, ''),
                    })
                  }
                />
              ) : (
                <Input
                  disabled={busy}
                  ref={proofField}
                  autoComplete="off"
                  value={proof.code}
                  onChange={(event) =>
                    setProof({ kind: 'backup', code: event.target.value })
                  }
                />
              )}
            </Field>
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              disabled={busy}
              onClick={close}
            >
              {cancel ?? t('modules.action.cancel')}
            </Button>
            <Button
              type="submit"
              variant={danger ? 'danger' : undefined}
              loading={busy}
              loadingLabel={pending}
              disabled={
                !password ||
                !proof.code ||
                (proof.kind === 'totp' && !/^[0-9]{6}$/.test(proof.code)) ||
                !!feedback.wait
              }
            >
              {confirm}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
