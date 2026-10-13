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
  Input,
} from '#/components/ui'
import { deletePasskey } from '#/lib/auth/client'
import { useI18n } from '#/lib/i18n'
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
  onCloseAutoFocus,
}: {
  passkey: PasskeySummary
  /** The passkey's own name, or the display-only fallback. */
  displayName: string
  open: boolean
  requiresPassword: boolean
  onOpenChange: (open: boolean) => void
  onRemoved: () => void
  onCloseAutoFocus: (event: Event) => void
}) {
  const { t } = useI18n()
  const formId = useId()
  const [password, setPassword] = useState('')
  const [pending, setPending] = useState(false)
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
    if (pending) return
    setPending(true)
    setRefusal(null)
    const result = await deletePasskey(
      passkey.id,
      askPassword ? password : undefined,
    )
    setPending(false)
    // A passkey that is already gone (another tab, or a removal whose reply was lost) is what was
    // asked for: the row leaves instead of a "not removed" that every retry would repeat.
    if (result.ok || result.failure.code === PASSKEY_NOT_FOUND) {
      onRemoved()
      return
    }
    const refused = deleteFailure(result.failure)
    if (refused.target === 'password') setAskPassword(true)
    setRefusal({ notice: refused.notice, focus: refused.target })
  }

  const passwordRefusal = refusal?.focus === 'password' ? refusal : null
  const alertRefusal =
    refusal !== null && passwordRefusal === null ? refusal : null

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // A request in flight owns the dialog: dismissing it would hide the answer.
        if (pending) return
        onOpenChange(next)
      }}
    >
      <DialogContent
        size="sm"
        hideClose
        data-part="passkey-delete-dialog"
        onCloseAutoFocus={onCloseAutoFocus}
      >
        <DialogHeader>
          <DialogTitle>{t('settings.passkeys.delete.title')}</DialogTitle>
          <DialogDescription>
            <NamedSentence
              sentence={t('settings.passkeys.delete.body', { name: NAME_SLOT })}
              name={displayName}
            />
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <form
            id={formId}
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              void submit(event)
            }}
          >
            {askPassword ? (
              <Field
                label={t('settings.passkeys.delete.password')}
                hint={t('settings.passkeys.delete.passwordHint')}
                error={
                  passwordRefusal === null
                    ? null
                    : t(passwordRefusal.notice.key)
                }
              >
                <Input
                  ref={passwordRef}
                  type="password"
                  required
                  autoComplete="current-password"
                  readOnly={pending}
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value)
                  }}
                />
              </Field>
            ) : (
              <p className="text-body text-ink-2">
                {t('settings.passkeys.delete.confirmOnly')}
              </p>
            )}
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
            {t('settings.passkeys.delete.cancel')}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="danger"
            loading={pending}
            loadingLabel={t('settings.passkeys.delete.removing')}
          >
            {t('settings.passkeys.delete.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
