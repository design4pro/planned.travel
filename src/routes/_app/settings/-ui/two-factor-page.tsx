import { useEffect, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import {
  Alert,
  Badge,
  Button,
  Card,
  CodeInput,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
  Input,
  Skeleton,
} from '#/components/ui'
import {
  authClient,
  toAuthFailure,
  authRequestFailure,
  factorAvailability,
  registerFactorOperation,
  prepareFactor,
  commitFactorOperation,
  cancelFactorOperation,
  factorOperationStatus,
} from '#/lib/auth/client'
import { useTranslate } from '#/lib/i18n'
import { extractSetupKey } from '../-lib/two-factor'
import { TwoFactorKey } from './two-factor-key'
import { TwoFactorCodes } from './two-factor-codes'
import { TwoFactorPasswordDialog } from './two-factor-password-dialog'
import { TwoFactorFeedback, useTwoFactorFeedback } from './two-factor-feedback'
import type { MessageKey } from '#/lib/i18n'
import type {
  AuthFailure,
  FactorOperation,
  FactorProof,
  FactorRegistration,
  FactorOutcome,
} from '#/lib/auth/client'

const STEP_KEYS = [
  'settings.twoFactor.steps.password',
  'settings.twoFactor.steps.key',
  'settings.twoFactor.steps.confirm',
] as const

/** Secrets belong to this mounted screen, independently of the loader's public status. */
export function TwoFactorSettings({
  twoFactorEnabled,
}: {
  twoFactorEnabled: boolean
}) {
  const t = useTranslate()
  const router = useRouter()
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])
  const [enabled, setEnabled] = useState(twoFactorEnabled)
  const [loaderEnabled, setLoaderEnabled] = useState(twoFactorEnabled)
  if (loaderEnabled !== twoFactorEnabled) {
    setLoaderEnabled(twoFactorEnabled)
    setEnabled(twoFactorEnabled)
  }
  const on = enabled
  const [credential, setCredential] = useState<boolean | null>(null)
  const [step, setStep] = useState(0)
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [setup, setSetup] = useState<{
    uri: string
    proposalId: string
    registration: FactorRegistration
    expiresAt: number
  } | null>(null)
  const registration = useRef<FactorRegistration | null>(null)
  const pendingIntent = useRef<{
    operation: FactorOperation
    intent: string
  } | null>(null)
  const [available, setAvailable] = useState<boolean | null>(null)
  const [recovery, setRecovery] = useState<string | null>(null)
  const [needsSignIn, setNeedsSignIn] = useState(false)
  const [notice, setNotice] = useState<MessageKey | null>(null)
  useEffect(() => {
    let active = true
    void factorAvailability()
      .then((result) => {
        if (!active) return
        setAvailable(result.available)
        if (result.recovery) setRecovery(result.recovery.id)
      })
      .catch(() => {
        if (active) setAvailable(false)
      })
    return () => {
      active = false
    }
  }, [])
  const [codes, setCodes] = useState<Array<string> | null>(null)
  const [alreadyOn, setAlreadyOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const [restart, setRestart] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const field = useRef<HTMLInputElement>(null)
  const feedback = useTwoFactorFeedback()
  useEffect(() => {
    if (on || codes) return
    let active = true
    void authClient
      .listAccounts()
      .then(({ data, error }) => {
        if (active)
          setCredential(
            error
              ? true
              : (data?.some((account) => account.providerId === 'credential') ??
                  true),
          )
      })
      .catch(() => {
        if (active) setCredential(true)
      })
    return () => {
      active = false
    }
  }, [on, codes])
  useEffect(() => {
    heading.current?.focus()
  }, [step, on, credential, codes, recovery, needsSignIn, available])
  function clearSetup() {
    setPassword('')
    setCode('')
    setSetup(null)
    setInvalid(false)
  }
  function showOn() {
    clearSetup()
    setEnabled(true)
    setAlreadyOn(true)
    feedback.setFailure(null)
  }
  function showCodes(values: Array<string>) {
    clearSetup()
    setEnabled(true)
    setCodes(values)
    feedback.setFailure(null)
  }
  function reject(failure: AuthFailure) {
    if (failure.code === 'TWO_FACTOR_ALREADY_ENABLED') {
      showOn()
      return
    }
    if (
      failure.code === 'INVALID_PASSWORD' ||
      failure.code === 'INVALID_CODE'
    ) {
      if (step === 0) setPassword('')
      setInvalid(true)
      field.current?.focus()
      return
    }
    if (step === 0 && failure.status !== 429 && failure.status !== 0)
      setPassword('')
    feedback.reject(failure, step === 2 ? 'code' : 'password')
  }
  function applyOutcome(result: FactorOutcome, recovered = false) {
    if (!mounted.current) return
    if (result.status !== 'committed' || result.enabled === null) return
    registration.current = null
    pendingIntent.current = null
    setRecovery(null)
    clearSetup()
    setStep(0)
    setEnabled(result.enabled)
    setCredential(null)
    if (result.backupCodes && !recovered) showCodes(result.backupCodes)
    else {
      setCodes(null)
      setNotice(
        recovered && result.operation !== 'disable'
          ? 'settings.twoFactor.security.codesLost'
          : 'settings.twoFactor.security.changed',
      )
    }
    if (result.cleanupPending) setNotice('settings.security.other.pending')
    if (recovered) setNeedsSignIn(true)
    else void router.invalidate().catch(() => undefined)
    window.setTimeout(() => {
      if (mounted.current) heading.current?.focus()
    }, 0)
  }
  async function begin(operation: FactorOperation) {
    if (!mounted.current) throw new Error('FactorViewClosed')
    if (recovery) throw new Error('FactorOutcomePending')
    if (registration.current?.operation === operation)
      return registration.current
    if (registration.current) {
      const cancelled = await cancelFactorOperation(registration.current)
      if (cancelled.status !== 'refused')
        throw new Error('FactorOutcomePending')
    }
    if (!mounted.current) throw new Error('FactorViewClosed')
    if (pendingIntent.current?.operation !== operation)
      pendingIntent.current = { operation, intent: crypto.randomUUID() }
    const value = await registerFactorOperation(
      operation,
      pendingIntent.current.intent,
    )
    if (!mounted.current) throw new Error('FactorViewClosed')
    registration.current = value
    return value
  }
  async function failed(cause: unknown): Promise<AuthFailure | null> {
    if (!mounted.current) return null
    const failure = authRequestFailure(cause)
    if (
      failure.status === 0 ||
      failure.status >= 500 ||
      failure.code === 'PASSWORD_ATTEMPTS_RESULT_UNKNOWN' ||
      failure.code === 'FACTOR_OUTCOME_UNKNOWN'
    ) {
      if (registration.current) {
        setRecovery(registration.current.id)
        setRestart(false)
        clearSetup()
        return null
      }
    }
    if (
      failure.code === 'FACTOR_STATE_CHANGED' ||
      failure.code === 'FACTOR_SETUP_EXPIRED'
    ) {
      clearSetup()
      setStep(0)
      if (registration.current) {
        const previous = registration.current
        try {
          await cancelFactorOperation(previous)
          registration.current = null
          pendingIntent.current = null
        } catch {
          setRecovery(previous.id)
        }
      }
      try {
        const session = await authClient.getSession({
          query: { disableCookieCache: true },
        })
        if (!mounted.current) return null
        if (session.error || !session.data) setNeedsSignIn(true)
        else setEnabled(session.data.user.twoFactorEnabled === true)
      } catch {
        setNeedsSignIn(true)
      }
      setNotice(
        failure.code === 'FACTOR_SETUP_EXPIRED'
          ? 'settings.twoFactor.security.expired'
          : 'settings.twoFactor.security.stale',
      )
      return null
    }
    if (
      failure.code === 'FACTOR_FRESH_SESSION_REQUIRED' ||
      failure.code === 'PASSWORD_ATTEMPTS_LOCKED' ||
      failure.status === 401
    ) {
      setNeedsSignIn(true)
      return null
    }
    return failure
  }
  async function enable() {
    if (busy || feedback.wait || !password) return
    heading.current?.focus()
    setBusy(true)
    setInvalid(false)
    feedback.setFailure(null)
    try {
      const value = await begin('enable')
      const result = await prepareFactor(value, password)
      if (!mounted.current) return
      extractSetupKey(result.totpURI)
      setSetup({
        uri: result.totpURI,
        proposalId: result.proposalId,
        registration: value,
        expiresAt: result.expiresAt,
      })
      setPassword('')
      setStep(1)
    } catch (cause) {
      const failure = await failed(cause)
      if (failure) reject(failure)
    } finally {
      setBusy(false)
    }
  }
  async function submitCode() {
    if (busy || feedback.wait || !/^[0-9]{6}$/.test(code) || !setup) return
    heading.current?.focus()
    setBusy(true)
    setInvalid(false)
    feedback.setFailure(null)
    try {
      const result = await commitFactorOperation(setup.registration, {
        proposalId: setup.proposalId,
        code,
      })
      if (!mounted.current) return
      if (result.status === 'committed') applyOutcome(result)
      else setRecovery(setup.registration.id)
    } catch (cause) {
      const failure = await failed(cause)
      if (failure) reject(failure)
    } finally {
      setBusy(false)
    }
  }
  async function change(
    operation: 'disable' | 'backup',
    password: string,
    proof: FactorProof,
  ): Promise<AuthFailure | null> {
    try {
      const value = await begin(operation)
      const result = await commitFactorOperation(value, { password, proof })
      if (!mounted.current) return null
      if (result.status === 'committed') applyOutcome(result)
      else setRecovery(value.id)
      return null
    } catch (cause) {
      return failed(cause)
    }
  }
  async function replaceAuthenticator(
    password: string,
    proof: FactorProof,
  ): Promise<AuthFailure | null> {
    try {
      const value = await begin('replace')
      const result = await prepareFactor(value, password, proof)
      if (!mounted.current) return null
      extractSetupKey(result.totpURI)
      setSetup({
        uri: result.totpURI,
        proposalId: result.proposalId,
        registration: value,
        expiresAt: result.expiresAt,
      })
      setStep(1)
      return null
    } catch (cause) {
      return failed(cause)
    }
  }
  async function checkStatus() {
    if (!recovery || busy) return
    setBusy(true)
    try {
      const result = await factorOperationStatus(recovery)
      if (!mounted.current) return
      if (result.status === 'committed') applyOutcome(result, true)
      else if (result.status === 'refused') {
        registration.current = null
        pendingIntent.current = null
        setRecovery(null)
        clearSetup()
        setStep(0)
        setNotice('settings.twoFactor.security.stale')
        try {
          const session = await authClient.getSession({
            query: { disableCookieCache: true },
          })
          if (!mounted.current) return
          if (!session.data || session.error) setNeedsSignIn(true)
          else setEnabled(session.data.user.twoFactorEnabled === true)
        } catch {
          setNeedsSignIn(true)
        }
      }
    } catch (cause) {
      feedback.reject(authRequestFailure(cause), 'password')
    } finally {
      setBusy(false)
    }
  }
  async function cancelSetup() {
    if (busy) return
    setBusy(true)
    try {
      if (registration.current) {
        const result = await cancelFactorOperation(registration.current)
        if (!mounted.current) return
        if (result.status === 'committed') {
          applyOutcome(result, true)
          return
        }
        if (result.status !== 'refused') {
          setRecovery(registration.current.id)
          return
        }
      }
      registration.current = null
      pendingIntent.current = null
      clearSetup()
      setStep(0)
      setRestart(false)
    } catch (cause) {
      const failure = await failed(cause)
      if (failure) reject(failure)
    } finally {
      setBusy(false)
    }
  }
  let recoveryMessage: MessageKey = 'settings.twoFactor.security.unavailable'
  if (needsSignIn) recoveryMessage = 'settings.twoFactor.security.fresh'
  if (recovery) recoveryMessage = 'settings.security.other.unknown'
  let content
  if (recovery || needsSignIn || available === false)
    content = (
      <Card className="flex flex-col gap-4 p-5">
        <h3 ref={heading} tabIndex={-1} className="font-display text-title">
          {t('settings.twoFactor.title')}
        </h3>
        <p>{t(recoveryMessage)}</p>
        <TwoFactorFeedback failure={feedback.failure} />
        {recovery ? (
          <Button loading={busy} onClick={() => void checkStatus()}>
            {t('settings.security.other.check')}
          </Button>
        ) : null}
        {needsSignIn ? (
          <Button
            loading={busy}
            onClick={() => {
              setBusy(true)
              void authClient
                .signOut()
                .then(({ error }) => {
                  if (!error) window.location.assign('/login')
                  else feedback.reject(toAuthFailure(error), 'password')
                })
                .catch((cause: unknown) =>
                  feedback.reject(authRequestFailure(cause), 'password'),
                )
                .finally(() => setBusy(false))
            }}
          >
            {t('auth.login.submit')}
          </Button>
        ) : null}
        {available === false ? (
          <Button onClick={() => window.location.reload()}>
            {t('settings.passkeys.error.retry')}
          </Button>
        ) : null}
      </Card>
    )
  else if (available === null)
    content = <Skeleton className="h-64 rounded-xl" />
  else if (codes)
    content = (
      <TwoFactorCodes
        codes={codes}
        onDone={() => {
          setCodes(null)
          void router.invalidate().catch(() => undefined)
        }}
      />
    )
  else if (on && !setup)
    content = (
      <Card className="flex flex-col gap-4 p-5">
        <h3 ref={heading} tabIndex={-1} className="font-display text-title">
          {t('settings.twoFactor.on.title')}
        </h3>
        <Badge>{t('settings.twoFactor.on.badge')}</Badge>
        <p>{t('settings.twoFactor.on.body')}</p>
        {alreadyOn ? (
          <Alert tone="info" title={t('auth.error.twoFactorOn.title')}>
            {t('auth.error.twoFactorOn.detail')}
          </Alert>
        ) : null}
        <TwoFactorPasswordDialog
          action={t('settings.twoFactor.replace.action')}
          title={t('settings.twoFactor.replace.title')}
          body={t('settings.twoFactor.replace.body')}
          confirm={t('settings.twoFactor.replace.confirm')}
          pending={t('settings.twoFactor.replace.pending')}
          onConfirm={(password, proof) => change('backup', password, proof)}
          focusReplacement={() => heading.current?.focus()}
        />
        <TwoFactorPasswordDialog
          action={t('settings.twoFactor.security.replace')}
          title={t('settings.twoFactor.security.replace')}
          body={t('settings.twoFactor.security.effect')}
          confirm={t('settings.twoFactor.password.submit')}
          pending={t('settings.twoFactor.setup.pending')}
          onConfirm={replaceAuthenticator}
          focusReplacement={() => heading.current?.focus()}
        />
        <TwoFactorPasswordDialog
          action={t('settings.twoFactor.off.action')}
          title={t('settings.twoFactor.off.title')}
          body={t('settings.twoFactor.off.body')}
          confirm={t('settings.twoFactor.off.confirm')}
          pending={t('settings.twoFactor.off.pending')}
          cancel={t('settings.twoFactor.off.cancel')}
          danger
          onConfirm={(password, proof) => change('disable', password, proof)}
          focusReplacement={() => heading.current?.focus()}
        />
      </Card>
    )
  else if (credential === null && !setup)
    content = <Skeleton className="h-64 rounded-xl" />
  else if (!credential && !setup)
    content = (
      <Card className="flex flex-col gap-4 p-5">
        <h3 ref={heading} tabIndex={-1} className="font-display text-title">
          {t('settings.twoFactor.nopassword.title')}
        </h3>
        <p>{t('settings.twoFactor.nopassword.body')}</p>
        <Button asChild>
          <a href="/forgot-password">
            {t('settings.twoFactor.nopassword.action')}
          </a>
        </Button>
      </Card>
    )
  else
    content = (
      <Card className="flex flex-col gap-5 p-5">
        <ol
          aria-label={t('settings.twoFactor.steps.label')}
          className="grid gap-3 sm:grid-cols-3"
        >
          {STEP_KEYS.map((key, index) => {
            let state = t('settings.twoFactor.steps.state.todo')
            if (index < step) state = t('settings.twoFactor.steps.state.done')
            if (index === step)
              state = t('settings.twoFactor.steps.state.current')
            return (
              <li
                key={key}
                aria-current={index === step ? 'step' : undefined}
                className="text-label"
              >
                <span aria-hidden>{index + 1}. </span>
                {t(key)}
                <span className="sr-only">{state}</span>
              </li>
            )
          })}
        </ol>
        <h3 ref={heading} tabIndex={-1} className="font-display text-title">
          {t(STEP_KEYS[step])}
        </h3>
        <TwoFactorFeedback failure={feedback.failure} />
        {step === 0 ? (
          <form
            data-sentry-block
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void enable()
            }}
          >
            <Field
              label={t('settings.twoFactor.password.label')}
              hint={t('settings.twoFactor.password.hint')}
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
            <Button
              className="h-auto min-h-11 whitespace-normal py-2"
              type="submit"
              loading={busy}
              loadingLabel={t('settings.twoFactor.password.pending')}
              disabled={!password || !!feedback.wait}
            >
              {t('settings.twoFactor.password.submit')}
            </Button>
          </form>
        ) : null}
        {step === 1 && setup ? (
          <div className="flex flex-col gap-4">
            <p>{t('settings.twoFactor.key.intro')}</p>
            <TwoFactorKey uri={setup.uri} />
            <Button
              className="h-auto min-h-11 whitespace-normal py-2"
              onClick={() => {
                setStep(2)
                setInvalid(false)
                feedback.setFailure(null)
              }}
            >
              {t('settings.twoFactor.key.next')}
            </Button>
            <Button
              className="h-auto min-h-11 whitespace-normal py-2"
              variant="ghost"
              onClick={() => setRestart(true)}
            >
              {t('settings.twoFactor.key.startOver')}
            </Button>
          </div>
        ) : null}
        {step === 2 ? (
          <form
            data-sentry-block
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void submitCode()
            }}
          >
            <Field
              label={t('settings.twoFactor.code.label')}
              hint={t('settings.twoFactor.security.currentStep')}
              error={invalid ? t('settings.twoFactor.code.invalid') : undefined}
            >
              <CodeInput
                ref={field}
                value={code}
                maxLength={6}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, ''))
                }
              />
            </Field>
            <Button
              className="h-auto min-h-11 whitespace-normal py-2"
              type="submit"
              loading={busy}
              loadingLabel={t('settings.twoFactor.code.pending')}
              disabled={!/^\d{6}$/.test(code) || !!feedback.wait}
            >
              {t(
                setup?.registration.operation === 'replace'
                  ? 'settings.twoFactor.security.replace'
                  : 'settings.twoFactor.code.submit',
              )}
            </Button>
          </form>
        ) : null}
      </Card>
    )
  return (
    <div className="flex flex-col gap-5">
      <Button asChild variant="ghost" className="self-start">
        <a href="/settings/security">
          <ArrowLeft aria-hidden data-mirror-rtl />
          {t('settings.twoFactor.back')}
        </a>
      </Button>
      <div>
        <h2 className="font-display text-title">
          {t('settings.twoFactor.title')}
        </h2>
        <p className="mt-2 text-label text-ink-3">
          {t('settings.twoFactor.description')}
        </p>
      </div>
      <p role="status" aria-live="polite">
        {notice ? t(notice) : ''}
      </p>
      {content}
      <Dialog open={restart} onOpenChange={setRestart}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            if (step === 0) {
              event.preventDefault()
              heading.current?.focus()
            }
          }}
        >
          <DialogHeader>
            <DialogTitle>{t('settings.twoFactor.key.startOver')}</DialogTitle>
            <DialogDescription>
              {t('settings.twoFactor.key.startOverHint')}
            </DialogDescription>
          </DialogHeader>
          <DialogBody />
          <DialogFooter>
            <Button
              className="h-auto min-h-11 whitespace-normal py-2"
              variant="secondary"
              onClick={() => setRestart(false)}
            >
              {t('modules.action.cancel')}
            </Button>
            <Button
              className="h-auto min-h-11 whitespace-normal py-2"
              loading={busy}
              onClick={() => void cancelSetup()}
            >
              {t('settings.twoFactor.key.startOver')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
