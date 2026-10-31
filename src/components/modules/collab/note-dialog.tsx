/** The dialog behind the notes board: create or edit a shared note. */
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
  SwitchField,
  Textarea,
} from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { SwatchPicker } from '../shared/swatch-picker'
import { createNoteFn, updateNoteFn } from '#/server/fns/collab-notes'
import { useAction } from '../shared'

import type { NoteData } from './types'

/**
 * A note's colour is stored on the row, so the palette travels as a hex string the
 * database can hold. Each option is paired with the token class that paints the
 * swatch, so nothing on screen is drawn from the literal.
 */

/* --------------------------------------------------------------- note dialog */

export function NoteDialog({
  tripId,
  note,
  categories,
  open,
  onOpenChange,
  turnedOff = false,
  canWrite,
}: {
  tripId: string
  /** Absent for a new note. */
  note?: NoteData
  /** Categories already used on this trip, offered as a datalist. */
  categories: ReadonlyArray<string>
  open: boolean
  onOpenChange: (open: boolean) => void
  turnedOff?: boolean
  canWrite: boolean
}) {
  const t = useTranslate()
  const off = useRef(turnedOff)
  off.current = turnedOff
  const editing = note !== undefined
  const formId = useId()
  const listId = useId()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('')
  const [colour, setColour] = useState('')
  const [pinned, setPinned] = useState(false)

  const initialNote = useRef(note)
  initialNote.current = note
  useEffect(() => {
    const snapshot = initialNote.current
    if (!open) {
      return
    }
    setTitle(snapshot?.title ?? '')
    setBody(snapshot?.body ?? '')
    setCategory(snapshot?.category ?? '')
    setColour(snapshot?.colour ?? '')
    setPinned(snapshot?.isPinned ?? false)
  }, [open, note?.id])

  const create = useAction(createNoteFn, {
    success: () =>
      t(
        off.current
          ? 'trips.collab.sections.savedHidden'
          : 'modules.collab.note.toast.shared',
      ),
    description: () =>
      off.current ? '' : t('modules.collab.note.toast.sharedBody'),
    failure: t('modules.collab.note.toast.shareFailed'),
  })
  const update = useAction(updateNoteFn, {
    success: () =>
      t(
        off.current
          ? 'trips.collab.sections.savedHidden'
          : 'modules.collab.note.toast.updated',
      ),
    failure: t('modules.collab.note.toast.updateFailed'),
  })
  const action = editing ? update : create

  const trimmed = title.trim()
  const canSave = canWrite && trimmed.length > 0 && !action.pending

  async function submit(): Promise<void> {
    if (!canWrite) return
    const payload = {
      tripId,
      title: trimmed,
      body,
      category,
      colour,
      isPinned: pinned,
    }
    const result = editing
      ? await update.run({ data: { ...payload, noteId: note.id } })
      : await create.run({ data: payload })
    if (result !== null) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open && canWrite} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>
            {editing
              ? t('modules.collab.note.dialog.editTitle')
              : t('modules.collab.note.dialog.addTitle')}
          </DialogTitle>
          <DialogDescription>
            {t('modules.collab.note.dialog.body')}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          {turnedOff ? (
            <p className="mb-4 text-caption text-ink-3">
              {t('trips.collab.sections.turnedOff')}
            </p>
          ) : null}
          <form
            id={formId}
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              if (canSave) {
                void submit()
              }
            }}
          >
            {action.error === null ? null : (
              <Alert tone="danger" title={t('modules.form.saveError')}>
                {action.error}
              </Alert>
            )}

            <Field label={t('modules.collab.note.field.title')} required>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder={t('modules.collab.note.field.titlePlaceholder')}
                maxLength={160}
                autoComplete="off"
                required
              />
            </Field>

            <Field label={t('modules.collab.note.field.body')}>
              <Textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder={t('modules.collab.note.field.bodyPlaceholder')}
                maxLength={8000}
                rows={4}
                autoResize
                maxRows={12}
              />
            </Field>

            <Field
              label={t('modules.field.category')}
              hint={t('modules.collab.note.field.categoryHint')}
            >
              <Input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder={t('modules.collab.note.field.categoryPlaceholder')}
                maxLength={60}
                list={categories.length === 0 ? undefined : listId}
                autoComplete="off"
              />
              {categories.length === 0 ? null : (
                <datalist id={listId}>
                  {categories.map((value) => (
                    <option key={value} value={value} />
                  ))}
                </datalist>
              )}
            </Field>

            <SwatchPicker
              value={colour}
              onChange={setColour}
              legend={t('modules.colour.legend')}
            />

            <SwitchField
              label={t('modules.collab.note.field.pin')}
              description={t('modules.collab.note.field.pinHint')}
              checked={pinned}
              onCheckedChange={setPinned}
            />
          </form>
        </DialogBody>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            shape="pill"
            onClick={() => onOpenChange(false)}
          >
            {t('modules.action.cancel')}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            shape="pill"
            disabled={!canSave}
            loading={action.pending}
            loadingLabel={t('modules.collab.note.action.saving')}
          >
            {editing
              ? t('modules.collab.note.action.save')
              : t('modules.collab.note.action.share')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
