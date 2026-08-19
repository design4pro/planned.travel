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
import { cn } from '#/lib/cn'
import { createNoteFn, createPollFn, updateNoteFn } from '#/server/fns/collab'
import { useAction } from '../shared'
import { pollOptionsError } from './poll-options'

import type { NoteData } from './types'

const MAX_OPTIONS = 12

/**
 * A note's colour is stored on the row, so the palette travels as a hex string the
 * database can hold. Each option is paired with the token class that paints the
 * swatch, so nothing on screen is drawn from the literal.
 */
const SWATCHES: ReadonlyArray<{
  value: string
  className: string
  label: string
}> = [
  { value: '', className: 'bg-surface-inset', label: 'No colour' },
  { value: '#256256', className: 'bg-brand', label: 'Pine' },
  { value: '#1d4fd8', className: 'bg-info', label: 'Ink blue' },
  { value: '#8a5305', className: 'bg-warning', label: 'Amber' },
  { value: '#136b45', className: 'bg-success', label: 'Green' },
  { value: '#b22f22', className: 'bg-danger', label: 'Red' },
]

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
    success: 'Note shared',
    description: 'Everyone on the trip can see it now.',
    failure: 'The note was not shared',
  })
  const update = useAction(updateNoteFn, {
    success: 'Note updated',
    failure: 'The note was not updated',
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
            {editing ? 'Edit this note' : 'New shared note'}
          </DialogTitle>
          <DialogDescription>
            Restaurant recommendations, visa rules, the code for the front door
            — anything the whole trip needs to remember in one place.
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
              <Alert tone="danger" title="That did not save">
                {action.error}
              </Alert>
            )}

            <Field label="Title" required>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Front door code"
                maxLength={160}
                autoComplete="off"
                required
              />
            </Field>

            <Field label="Note">
              <Textarea
                value={body}
                onChange={(event) => setBody(event.target.value)}
                placeholder="4821, then the hash key. The key box is to the left of the door."
                maxLength={8000}
                rows={4}
                autoResize
                maxRows={12}
              />
            </Field>

            <Field
              label="Category"
              hint="Groups the board under a filter. Optional."
            >
              <Input
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Logistics"
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

            <fieldset>
              <legend className="mb-2 text-label font-medium text-ink">
                Colour
              </legend>
              <div className="flex flex-wrap gap-2">
                {SWATCHES.map((swatch) => (
                  <button
                    key={swatch.label}
                    type="button"
                    aria-pressed={colour === swatch.value}
                    aria-label={swatch.label}
                    onClick={() => setColour(swatch.value)}
                    className={cn(
                      'size-8 rounded-full border border-edge-faint transition-[box-shadow,transform] duration-base ease-out-quint focus-ring',
                      swatch.className,
                      colour === swatch.value
                        ? 'ring-2 ring-ink ring-offset-2 ring-offset-surface'
                        : 'hover:scale-105 motion-reduce:hover:scale-100',
                    )}
                  />
                ))}
              </div>
            </fieldset>

            <SwitchField
              label="Pin to the top of the board"
              description="Pinned notes come first, whatever else is added."
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
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            shape="pill"
            disabled={!canSave}
            loading={action.pending}
            loadingLabel="Saving the note"
          >
            {editing ? 'Save note' : 'Share note'}
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
    success: 'Poll opened',
    description: 'Everyone on the trip can vote now.',
    failure: 'The poll was not opened',
  })

  const optionsError = pollOptionsError(options)
  const questionError =
    question.trim().length === 0 ? 'Ask the group something.' : undefined
  const canSave =
    optionsError === null && questionError === undefined && !create.pending

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
          <DialogTitle>New poll</DialogTitle>
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
              <Alert tone="danger" title="That did not save">
                {create.error}
              </Alert>
            )}

            <Field
              label="Question"
              required
              error={touched ? questionError : undefined}
            >
              <Input
                value={question}
                onChange={(event) => setQuestion(event.target.value)}
                placeholder="Where are we eating on the last night?"
                maxLength={200}
                autoComplete="off"
                required
              />
            </Field>

            <fieldset className="min-w-0">
              <legend className="mb-2 text-label font-medium text-ink">
                Options
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
                          ? 'Den'
                          : index === 1
                            ? 'Narisawa'
                            : 'Another option'
                      }
                      maxLength={120}
                      autoComplete="off"
                      aria-label={`Option ${index + 1}`}
                      className="min-w-0 flex-1"
                    />
                    <IconButton
                      type="button"
                      variant="ghost"
                      size="sm"
                      label={`Remove option ${index + 1}`}
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
              {touched && optionsError !== null ? (
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
                Add an option
              </Button>
            </fieldset>

            <SwitchField
              label="Let people pick more than one"
              description="Off means one vote each, and changing your mind moves it."
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
            Cancel
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            shape="pill"
            loading={create.pending}
            loadingLabel="Opening the poll"
          >
            Open poll
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
