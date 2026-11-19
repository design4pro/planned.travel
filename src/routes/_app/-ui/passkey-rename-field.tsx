import { useEffect, useRef, useState } from 'react'

import { Button, Field, Input } from '#/components/ui'
import { useI18n } from '#/lib/i18n'

import type { KeyboardEvent } from 'react'

/** The server refuses a longer name; the input stops it before the request. */
const MAX_NAME_LENGTH = 64

/**
 * The name input of the one row in rename mode. It owns the draft text and the keys; the request,
 * the list and the focus handed back to the row's Rename control belong to the manager.
 *
 * - Enter and Save commit. Escape and Cancel discard the draft. Explicit actions return focus
 *   to the row's Rename control if focus is still in the editor when they complete.
 * - Moving focus outside the editor in the active document saves a changed, non-empty name
 *   and leaves focus where the person moved it. With an error showing, only explicit actions
 *   decide so the person can still reach Sign in again and retry without retyping.
 * - `attention` is bumped by the manager each time the field must take focus again (the Rename
 *   control pressed, or a failed save started by a key).
 */
export function PasskeyRenameField({
  inputId,
  initial,
  saving,
  error,
  attention,
  onSubmit,
  onCancel,
}: {
  inputId?: string
  /** The stored name, or an empty string for a passkey that has none. */
  initial: string
  saving: boolean
  error: string | null
  attention: number
  onSubmit: (value: string, explicit: boolean) => void
  onCancel: (explicit: boolean) => void
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useState(initial)
  const inputRef = useRef<HTMLInputElement>(null)
  // An explicit action and a subsequent blur must never submit the same draft twice.
  const settled = useRef(false)

  useEffect(() => {
    settled.current = false
    inputRef.current?.focus()
    // Only a new `attention` brings the field back; the other props are read as they are then.
  }, [attention])

  // A save that failed leaves the field open: it may decide again.
  useEffect(() => {
    if (!saving) settled.current = false
  }, [saving])

  function decide(explicit: boolean): void {
    if (settled.current || saving) return
    const value = draft.trim()
    if (!explicit && error !== null) return
    settled.current = true
    if (value === '' || value === initial) {
      onCancel(explicit)
      return
    }
    onSubmit(value, explicit)
  }

  function cancel(): void {
    if (settled.current || saving) return
    settled.current = true
    onCancel(true)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      // Enter that ends an IME composition (ja, ko, zh) only confirms the text.
      // WebKit reports `isComposing: false` there, with key code 229.
      if (event.nativeEvent.isComposing || event.keyCode === 229) return
      event.preventDefault()
      decide(true)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      cancel()
    }
  }

  return (
    <Field
      data-part="passkey-rename-field"
      htmlFor={inputId}
      label={t('settings.passkeys.rename.fieldLabel')}
      error={error}
      className="mt-2"
      onBlur={(event) => {
        if (
          event.relatedTarget === null &&
          !event.currentTarget.ownerDocument.hasFocus()
        )
          return
        if (event.currentTarget.contains(event.relatedTarget)) return
        decide(false)
      }}
    >
      <Input
        ref={inputRef}
        data-part="passkey-rename-input"
        size="lg"
        value={draft}
        readOnly={saving}
        loading={saving}
        maxLength={MAX_NAME_LENGTH}
        dir="auto"
        enterKeyHint="done"
        autoComplete="off"
        placeholder={t('settings.passkeys.rename.placeholder')}
        onChange={(event) => {
          setDraft(event.currentTarget.value)
        }}
        onKeyDown={onKeyDown}
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={saving}
          onPointerDown={(event) => {
            // Some browsers blur the input without focusing the clicked button.
            event.preventDefault()
          }}
          onClick={cancel}
        >
          {t('settings.passkeys.rename.cancel')}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={saving}
          onPointerDown={(event) => {
            event.preventDefault()
          }}
          onClick={() => {
            decide(true)
          }}
        >
          {t('settings.passkeys.rename.save')}
        </Button>
      </div>
    </Field>
  )
}
