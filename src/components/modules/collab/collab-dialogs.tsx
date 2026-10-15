/**
 * The two dialogs behind the collaboration board: a shared note and a poll.
 *
 * A poll's options are minted here as a list the traveller can grow and shrink,
 * because two options is the minimum a vote makes sense with and twelve is more
 * than any group needs. Duplicate wording is refused: a tie between two options
 * that say the same thing is not a result.
 */
import { useEffect, useId, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

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
  IconButton,
  Input,
  SwitchField,
  Textarea,
} from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { SwatchPicker } from '../shared/swatch-picker'
import { createNoteFn, updateNoteFn } from '#/server/fns/collab-notes'
import { createPollFn } from '#/server/fns/collab-polls'
import { useAction } from '../shared'
import { pollOptionsError } from './poll-options'

import type { NoteData } from './types'

const MAX_OPTIONS = 12

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
}: {
  tripId: string
  /** Absent for a new note. */
  note?: NoteData
  /** Categories already used on this trip, offered as a datalist. */
  categories: ReadonlyArray<string>
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const t = useTranslate()
  const editing = note !== undefined
  const formId = useId()
  const listId = useId()

  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('')
  const [colour, setColour] = useState('')
  const [pinned, setPinned] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }
    setTitle(note?.title ?? '')
    setBody(note?.body ?? '')
    setCategory(note?.category ?? '')
    setColour(note?.colour ?? '')
    setPinned(note?.isPinned ?? false)
  }, [open, note])

  const create = useAction(createNoteFn, {
    success: t('modules.collab.note.toast.shared'),
    description: t('modules.collab.note.toast.sharedBody'),
    failure: t('modules.collab.note.toast.shareFailed'),
  })
  const update = useAction(updateNoteFn, {
    success: t('modules.collab.note.toast.updated'),
    failure: t('modules.collab.note.toast.updateFailed'),
  })
  const action = editing ? update : create

  const trimmed = title.trim()
  const canSave = trimmed.length > 0 && !action.pending

  async function submit(): Promise<void> {
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
    <Dialog open={open} onOpenChange={onOpenChange}>
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

/* --------------------------------------------------------------- poll dialog */

export function PollDialog({
  tripId,
  open,
  onOpenChange,
}: {
  tripId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const formId = useId()

  const t = useTranslate()

  const [question, setQuestion] = useState('')
  const [options, setOptions] = useState<Array<string>>(['', ''])
  const [allowMultiple, setAllowMultiple] = useState(false)
  const [touched, setTouched] = useState(false)

  useEffect(() => {
    if (!open) {
      return
    }
    setQuestion('')
    setOptions(['', ''])
    setAllowMultiple(false)
    setTouched(false)
  }, [open])

  const create = useAction(createPollFn, {
    success: t('modules.collab.poll.toast.opened'),
    description: t('modules.collab.poll.toast.openedBody'),
    failure: t('modules.collab.poll.toast.openFailed'),
  })

  const optionsProblem = pollOptionsError(options)
  const optionsError = optionsProblem === null ? undefined : t(optionsProblem)
  const questionError =
    question.trim().length === 0 ? 'Ask the group something.' : undefined
  const canSave =
    optionsError === undefined && questionError === undefined && !create.pending

  function setOption(index: number, value: string): void {
    setOptions((current) =>
      current.map((entry, position) => (position === index ? value : entry)),
    )
  }

  async function submit(): Promise<void> {
    setTouched(true)
    if (!canSave) {
      return
    }
    const result = await create.run({
      data: {
        tripId,
        question: question.trim(),
        options: options
          .map((value) => value.trim())
          .filter((value) => value.length > 0),
        allowMultiple,
      },
    })
    if (result !== null) {
      onOpenChange(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        <DialogHeader>
          <DialogTitle>{t('modules.collab.poll.dialog.addTitle')}</DialogTitle>
          <DialogDescription>
            When the group cannot agree on a restaurant, put it to a vote and
            let the answer settle itself.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <form
            id={formId}
            className="flex flex-col gap-4"
            onSubmit={(event) => {
              event.preventDefault()
              void submit()
            }}
          >
            {create.error === null ? null : (
              <Alert tone="danger" title={t('modules.form.saveError')}>
                {create.error}
              </Alert>
            )}

            <Field
              label={t('modules.collab.poll.field.question')}
              required
              error={touched ? questionError : undefined}
            >
              <Input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder={t('modules.collab.poll.field.questionPlaceholder')}
                maxLength={200}
                autoComplete="off"
                required
              />
            </Field>

            <fieldset className="min-w-0">
              <legend className="mb-2 text-label font-medium text-ink">
                {t('modules.collab.poll.field.optionsLegend')}
              </legend>
              <ul className="flex flex-col gap-2">
                {options.map((option, index) => (
                  <li key={index} className="flex min-w-0 items-center gap-2">
                    <span className="w-5 shrink-0 text-center text-caption tabular-nums text-ink-4">
                      {index + 1}
                    </span>
                    <Input
                      value={option}
                      onChange={(event) => setOption(index, event.target.value)}
                      placeholder={
                        index === 0
                          ? t('modules.collab.poll.example.first')
                          : index === 1
                            ? t('modules.collab.poll.example.second')
                            : t('modules.collab.poll.example.third')
                      }
                      maxLength={120}
                      autoComplete="off"
                      aria-label={t('modules.collab.poll.field.option', {
                        n: index + 1,
                      })}
                      className="min-w-0 flex-1"
                    />
                    <IconButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      label={t('modules.collab.poll.action.removeOption', {
                        n: index + 1,
                      })}
                      icon={<Trash2 aria-hidden />}
                      disabled={options.length <= 2}
                      onClick={() =>
                        setOptions((current) =>
                          current.filter((_, position) => position !== index),
                        )
                      }
                    />
                  </li>
                ))}
              </ul>
              {touched && optionsError !== undefined ? (
                <p className="mt-2 text-caption text-danger">{optionsError}</p>
              ) : null}
              <Button
                type="button"
                variant="subtle"
                size="sm"
                shape="pill"
                className="mt-3"
                disabled={options.length >= MAX_OPTIONS}
                onClick={() => setOptions((current) => [...current, ''])}
              >
                <Plus aria-hidden />
                {t('modules.collab.poll.action.addOption')}
              </Button>
            </fieldset>

            <SwitchField
              label={t('modules.collab.poll.field.multi')}
              description={t('modules.collab.poll.field.multiHint')}
              checked={allowMultiple}
              onCheckedChange={setAllowMultiple}
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
            loading={create.pending}
            loadingLabel={t('modules.collab.poll.action.opening')}
          >
            {t('modules.collab.poll.action.open')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
