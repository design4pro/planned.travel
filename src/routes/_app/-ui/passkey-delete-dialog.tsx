import { useEffect, useId, useRef, useState } from 'react'

import {
  Alert,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
} from '#/components/ui'
import { deletePasskey } from '#/lib/auth/client'
import { useI18n } from '#/lib/i18n'
import { PasswordInput } from '../../(auth)/-ui/form'
import {
  PASSKEY_NOT_FOUND,
  SIGN_OUT_FAILED,
  deleteFailure,
} from '../-lib/passkey-errors'
import { SignInAgain } from './passkey-sign-in-again'

import type { FormEvent } from 'react'
import type { PasskeySummary } from '#/lib/auth/client'
import type { PasskeyNotice } from '../-lib/passkey-errors'

/**
 * A character the catalogue never contains. The message is translated with it in place of the name,
 * then split on it, so the name can sit in its own `bdi` and a Latin-script name stays readable
 * inside Arabic text without the message layer growing a markup syntax.
 */
const NAME_SLOT = ''

/** A catalogue sentence with the passkey's name in an element that sets its own direction. */
function NamedSentence({ sentence, name }: { sentence: string; name: string }) {
  const [before, ...rest] = sentence.split(NAME_SLOT)
  if (rest.length === 0) return before
  return (
    <>
      {before}
      {rest.map((after, index) => (
        <span key={index}>
          <bdi dir="auto" className="[overflow-wrap:anywhere]">
            {name}
          </bdi>
          {after}
        </span>
      ))}
    </>
  )
}

/** A refusal on screen, and which element takes focus because of it. */
interface Refusal {
  readonly notice: PasskeyNotice
  readonly dismissOnly?: boolean
  readonly focus: 'password' | 'alert' | 'signIn'
}

/**
 * The question asked before a passkey is removed. An account with a password is asked for it; one
 * without is asked for a plain confirmation, and the server then holds it to a fresh session. The
 * hint only chooses what is drawn: `/passkey/delete` decides what it needs for itself.
 *
 * The dialog owns the request and its refusals; the manager owns the list and where focus goes
 * once the dialog has closed (`onCloseAutoFocus`), because after a removal the opener row is gone.
 * Mounted once per opening (the manager keys it), so the password and the refusals never outlive it.
 */
export function PasskeyDeleteDialog({
  passkey,
  displayName,
  open,
  requiresPassword,
  onOpenChange,
  onRemoved,
  onReconcile,
  onCloseAutoFocus,
}: {
  passkey: PasskeySummary
  /** The passkey's own name, or the display-only fallback. */
  displayName: string
  open: boolean
  requiresPassword: boolean
  onOpenChange: (open: boolean) => void
  onRemoved: () => void
  onReconcile: (outcome: 'unavailable' | 'unknown') => void
  onCloseAutoFocus: (event: Event) => void
}) {
  const { t } = useI18n()
  const formId = useId()
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
  const requestInFlight = useRef(false)
  const [announcement, setAnnouncement] = useState(0)
  const [refusal, setRefusal] = useState<Refusal | null>(null)
  // The list's hint can be stale (a password set in another tab): a password refusal draws the
  // field instead of leaving the person with a refusal and nowhere to answer it.
  const [askPassword, setAskPassword] = useState(requiresPassword)
  const passwordRef = useRef<HTMLInputElement>(null)
  const alertRef = useRef<HTMLDivElement>(null)
  const signInRef = useRef<HTMLButtonElement>(null)

  // `loading` disables the confirm button and drops focus; a refusal hands it to the element that
  // says what happened, so it never rests on <body>.
  useEffect(() => {
    if (refusal === null || pending) return
    const target = {
      password: passwordRef,
      alert: alertRef,
      signIn: signInRef,
    }[refusal.focus]
    target.current?.focus()
  }, [refusal, pending])

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (requestInFlight.current || refusal?.dismissOnly) return
    requestInFlight.current = true
    setPending(true)
    setRefusal(null)
    const result = await deletePasskey(
      passkey.id,
      askPassword ? password : undefined,
    )
    requestInFlight.current = false
    setPending(false)
    if (result.ok) {
      setPassword('')
      onRemoved()
      return
    }
    if (
      result.failure.status === 0 ||
      result.failure.code === PASSKEY_NOT_FOUND
    ) {
      setPassword('')
      onReconcile(result.failure.status === 0 ? 'unknown' : 'unavailable')
      return
    }
    const refused = deleteFailure(result.failure)
    if (refused.target === 'password') {
      setAskPassword(true)
      setAnnouncement((current) => current + 1)
    }
    if (refused.dismissOnly) setPassword('')
    setRefusal({
      notice: refused.notice,
      focus: refused.target,
      dismissOnly: refused.dismissOnly,
    })
  }

  const passwordRefusal = refusal?.focus === 'password' ? refusal : null
  const alertRefusal =
    refusal !== null && passwordRefusal === null ? refusal : null
  const showPassword = !refusal?.dismissOnly && askPassword
  const hasVisibleBody = showPassword || alertRefusal !== null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // A request in flight owns the dialog: dismissing it would hide the answer.
        if (requestInFlight.current) return
        onOpenChange(next)
      }}
    >
      <DialogContent
        size="sm"
        hideClose
        data-part="passkey-delete-dialog"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader
          className={
            hasVisibleBody ? 'pe-5 sm:pe-6' : 'border-b-0 pe-5 sm:pe-6'
          }
        >
          <DialogTitle>{t('settings.passkeys.delete.title')}</DialogTitle>
          <DialogDescription>
            <NamedSentence
              sentence={t('settings.passkeys.delete.body', { name: NAME_SLOT })}
              name={displayName}
            />{' '}
            {t('settings.passkeys.delete.savedEntry')}
            {!refusal?.dismissOnly && !askPassword ? (
              <span className="mt-2 block text-body text-ink-2">
                {t('settings.passkeys.delete.confirmOnly')}
              </span>
            ) : null}
          </DialogDescription>
        </DialogHeader>
        <DialogBody className={hasVisibleBody ? undefined : 'py-0'}>
          <form
            id={formId}
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              void submit(event)
            }}
          >
            <p role="status" aria-atomic="true" className="sr-only">
              {pending ? (
                <span>{t('settings.passkeys.delete.removing')}</span>
              ) : null}
              {passwordRefusal === null ? null : (
                <span key={announcement}>{t(passwordRefusal.notice.key)}</span>
              )}
            </p>
            {showPassword ? (
              <>
                <Field
                  label={t('settings.passkeys.delete.password')}
                  announceError={false}
                  hint={
                    passwordRefusal === null
                      ? t('settings.passkeys.delete.passwordHint')
                      : undefined
                  }
                  error={
                    passwordRefusal === null
                      ? null
                      : t(passwordRefusal.notice.key)
                  }
                >
                  <PasswordInput
                    ref={passwordRef}
                    showLabel={t('auth.password.show')}
                    hideLabel={t('auth.password.hide')}
                    enterKeyHint="done"
                    required
                    autoComplete="current-password"
                    readOnly={pending}
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value)
                    }}
                  />
                </Field>
                <a
                  href={pending ? undefined : '/forgot-password'}
                  className="self-start rounded-sm text-label font-medium text-brand underline decoration-brand/30 underline-offset-4 focus-ring hover:decoration-brand"
                >
                  {t('auth.login.forgot')}
                </a>
              </>
            ) : null}
            {alertRefusal === null ? null : (
              <Alert
                ref={alertRef}
                tabIndex={-1}
                tone="danger"
                actions={
                  alertRefusal.notice.signInAgain ? (
                    <SignInAgain
                      buttonRef={signInRef}
                      onFailed={() => {
                        setRefusal({ notice: SIGN_OUT_FAILED, focus: 'signIn' })
                      }}
                    />
                  ) : undefined
                }
              >
                {t(alertRefusal.notice.key)}
              </Alert>
            )}
          </form>
        </DialogBody>
        <DialogFooter>
          <Button
            type="button"
            variant="secondary"
            disabled={pending}
            onClick={() => {
              onOpenChange(false)
            }}
          >
            {refusal?.dismissOnly
              ? t('ui.action.close')
              : t('settings.passkeys.delete.cancel')}
          </Button>
          {refusal?.dismissOnly ? null : (
            <Button
              type="submit"
              form={formId}
              variant="danger"
              loading={pending}
              loadingLabel={t('settings.passkeys.delete.removing')}
            >
              {t('settings.passkeys.delete.confirm')}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
