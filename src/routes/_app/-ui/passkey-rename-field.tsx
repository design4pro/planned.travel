import { useEffect, useRef, useState } from 'react'

import { Field, Input } from '#/components/ui'
import { useI18n } from '#/lib/i18n'

import type { KeyboardEvent } from 'react'

/** The server refuses a longer name; the input stops it before the request. */
const MAX_NAME_LENGTH = 64

/**
 * The name input of the one row in rename mode. It owns the draft text and the keys; the request,
 * the list and the focus handed back to the row's Rename control belong to the manager.
 *
 * - Enter commits, Escape reverts. A blur commits only a non-empty value that differs from the
 *   stored name. An empty or unchanged value never reaches `onSubmit`: a rename cannot clear a name,
 *   and a passkey that was unnamed stays unnamed.
 * - `viaKey` tells the manager whether to hand focus back to the Rename control: after Enter or
 *   Escape yes, after a blur no, because the person has already moved on.
 * - `attention` is bumped by the manager each time the field must take focus again (the Rename
 *   control pressed, or a failed save). A failed save also brings `error`, and the text reverts.
 */
export function PasskeyRenameField({
  initial,
  saving,
  error,
  attention,
  onSubmit,
  onCancel,
}: {
  /** The stored name, or an empty string for a passkey that has none. */
  initial: string
  saving: boolean
  error: string | null
  attention: number
  onSubmit: (value: string, viaKey: boolean) => void
  onCancel: (viaKey: boolean) => void
}) {
  const { t } = useI18n()
  const [draft, setDraft] = useState(initial)
  const inputRef = useRef<HTMLInputElement>(null)
  // Set once Enter or Escape has decided, so the blur that follows the input unmounting (some
  // browsers fire one) cannot decide a second time.
  const settled = useRef(false)

  useEffect(() => {
    settled.current = false
    if (error !== null) setDraft(initial)
    inputRef.current?.focus()
    // Only a new `attention` brings the field back; the other props are read as they are then.
  }, [attention])

  function decide(viaKey: boolean): void {
    if (settled.current || saving) return
    const value = draft.trim()
    settled.current = true
    if (value === '' || value === initial) {
      onCancel(viaKey)
      return
    }
    onSubmit(value, viaKey)
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault()
      decide(true)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      if (settled.current || saving) return
      settled.current = true
      onCancel(true)
    }
  }

  return (
    <Field
      data-part="passkey-rename-field"
      label={t('settings.passkeys.rename.fieldLabel')}
      error={error}
      className="mt-2"
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
        onBlur={() => {
          decide(false)
        }}
      />
    </Field>
  )
}
