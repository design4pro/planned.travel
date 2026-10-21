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
  thrownToAuthFailure,
  toAuthFailure,
} from '#/lib/auth/client'
import { useTranslate } from '#/lib/i18n'
import { extractSetupKey } from '../-lib/two-factor'
import { TwoFactorKey } from './two-factor-key'
import { TwoFactorCodes } from './two-factor-codes'
import { TwoFactorPasswordDialog } from './two-factor-password-dialog'
import { TwoFactorFeedback, useTwoFactorFeedback } from './two-factor-feedback'
import type { AuthFailure } from '#/lib/auth/client'

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
  const [enabled, setEnabled] = useState(twoFactorEnabled)
  const on = enabled || twoFactorEnabled
  const [credential, setCredential] = useState<boolean | null>(null)
  const [step, setStep] = useState(0)
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [setup, setSetup] = useState<{
    uri: string
    codes: Array<string>
  } | null>(null)
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
  }, [step, on, credential, codes])
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
  async function enable() {
    if (busy || feedback.wait || !password) return
    setBusy(true)
    setInvalid(false)
    feedback.setFailure(null)
    try {
      const session = await authClient.getSession({
        query: { disableCookieCache: true },
      })
      if (session.error) {
        reject(toAuthFailure(session.error))
        return
      }
      if (!session.data) {
        reject(toAuthFailure(null))
        return
      }
      if (session.data.user.twoFactorEnabled) {
        showOn()
        return
      }
      const result = await authClient.twoFactor.enable({ password })
      if (result.error) {
        reject(toAuthFailure(result.error))
        return
      }
      if (!result.data || !('totpURI' in result.data)) {
        reject(toAuthFailure(null))
        return
      }
      extractSetupKey(result.data.totpURI)
      setSetup({ uri: result.data.totpURI, codes: result.data.backupCodes })
      setPassword('')
      setStep(1)
    } catch (cause) {
      reject(thrownToAuthFailure(cause))
    } finally {
      setBusy(false)
    }
  }
  async function confirm() {
    if (busy || feedback.wait || !/^\d{6}$/.test(code) || !setup) return
    setBusy(true)
    setInvalid(false)
    feedback.setFailure(null)
    try {
      const result = await authClient.twoFactor.verifyTotp({ code })
      if (result.error) {
        const failure = toAuthFailure(result.error)
        if (failure.status !== 0) {
          reject(failure)
          return
        }
      } else {
        showCodes(setup.codes)
        return
      }
    } catch {
      /* A lost response may follow a committed verification; reconcile once below. */
    }
    try {
      const session = await authClient.getSession({
        query: { disableCookieCache: true },
      })
      if (!session.error && session.data?.user.twoFactorEnabled) {
        showCodes(setup.codes)
        setBusy(false)
        return
      }
    } catch {
      /* An unavailable read leaves the outcome unknown. */
    }
    feedback.setFailure({
      titleKey: 'auth.error.offline.title',
      detailKey: 'settings.twoFactor.code.unclear',
      tone: 'warning',
    })
    setBusy(false)
  }
  // A successful confirm returns from the try block; release its busy state on the next screen.
  async function submitCode() {
    try {
      await confirm()
    } finally {
      setBusy(false)
    }
  }
  async function replace(value: string): Promise<AuthFailure | null> {
    const result = await authClient.twoFactor.generateBackupCodes({
      password: value,
    })
    if (result.error) return toAuthFailure(result.error)
    if (!result.data) return toAuthFailure(null)
    showCodes(result.data.backupCodes)
    return null
  }
  async function showKey(value: string) {
    const result = await authClient.twoFactor.getTotpUri({ password: value })
    if (result.error) return toAuthFailure(result.error)
    if (!result.data) return toAuthFailure(null)
    extractSetupKey(result.data.totpURI)
    return { uri: result.data.totpURI }
  }
  let content
  if (codes)
    content = (
      <TwoFactorCodes
        codes={codes}
        onDone={() => {
          setCodes(null)
          void router.invalidate().catch(() => undefined)
        }}
      />
    )
  else if (on)
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
          onConfirm={replace}
          focusReplacement={() => heading.current?.focus()}
        />
        <TwoFactorPasswordDialog
          action={t('settings.twoFactor.setup.action')}
          title={t('settings.twoFactor.setup.title')}
          body={t('settings.twoFactor.setup.body')}
          confirm={t('settings.twoFactor.setup.confirm')}
          pending={t('settings.twoFactor.setup.pending')}
          done={t('settings.twoFactor.setup.done')}
          onConfirm={showKey}
          focusReplacement={() => heading.current?.focus()}
        />
      </Card>
    )
  else if (credential === null)
    content = <Skeleton className="h-64 rounded-xl" />
  else if (!credential)
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
              hint={t('settings.twoFactor.code.hint')}
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
              {t('settings.twoFactor.code.submit')}
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
              onClick={() => {
                clearSetup()
                feedback.setFailure(null)
                setStep(0)
                setRestart(false)
              }}
            >
              {t('settings.twoFactor.key.startOver')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
