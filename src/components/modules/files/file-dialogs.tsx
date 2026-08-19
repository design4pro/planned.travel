/**
 * Renaming and describing one attachment.
 *
 * The name is what a traveller will scan for at a check-in desk, so it is editable
 * — a browser's own "Screenshot 2026-04-16 at 09.41.22.png" is not a filename
 * anybody can find twice. The kind decides which filter the file sits under and
 * which glyph it gets, and the description is the one line explaining why it was
 * kept.
 */
import { useEffect, useId, useState } from 'react'

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
  SimpleSelect,
  Textarea,
} from '#/components/ui'
import { formatStorage } from '#/lib/plans'
import { FILE_KIND_VALUES, isFileKind } from '#/server/fns/file-policy'
import { updateTripFileFn } from '#/server/fns/files'
import { useAction } from '../shared'

import type { FileData } from './types'

const KIND_OPTIONS: ReadonlyArray<{ value: string; label: string }> =
  FILE_KIND_VALUES.map((value) => ({
    value,
    label:
      value === 'document'
        ? 'Document'
        : value === 'image'
          ? 'Photo'
          : value === 'ticket'
            ? 'Ticket or pass'
            : value === 'receipt'
              ? 'Receipt'
              : value === 'map'
                ? 'Map or route'
                : 'Other',
  }))

export function FileDetailsDialog({
  tripId,
  file,
  open,
  onOpenChange,
}: {
  tripId: string
  file: FileData
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const formId = useId()

  const [filename, setFilename] = useState(file.filename)
  const [kind, setKind] = useState(file.kind)
  const [description, setDescription] = useState(file.description ?? '')

  useEffect(() => {
    if (!open) {
      return
    }
    setFilename(file.filename)
    setKind(file.kind)
    setDescription(file.description ?? '')
  }, [open, file])

  const save = useAction(updateTripFileFn, {
    success: 'File updated',
    failure: 'The file was not updated',
  })

  const trimmed = filename.trim()
  const nameError =
    trimmed.length === 0
      ? 'A file needs a name you can find it by.'
      : trimmed.length > 160
        ? 'Keep the name under 160 characters.'
        : undefined
  const canSave = nameError === undefined && !save.pending

  async function submit(): Promise<void> {
    const result = await save.run({
      data: {
        tripId,
        fileId: file.id,
        filename: trimmed,
        kind: isFileKind(kind) ? kind : 'other',
        description,
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
          <DialogTitle>File details</DialogTitle>
          <DialogDescription>
            {formatStorage(file.sizeBytes)} · {file.contentType}
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
            {save.error === null ? null : (
              <Alert tone="danger" title="That did not save">
                {save.error}
              </Alert>
            )}

            <Field label="Name" required error={nameError}>
              <Input
                value={filename}
                onChange={(event) => setFilename(event.target.value)}
                maxLength={200}
                autoComplete="off"
                required
              />
            </Field>

            <Field
              label="Kind"
              hint="Decides which filter it sits under and which glyph it gets."
            >
              <SimpleSelect
                options={[...KIND_OPTIONS]}
                value={kind}
                onValueChange={setKind}
                ariaLabel="Kind of file"
              />
            </Field>

            <Field label="Description">
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Insurance policy — covers the whole party, claims line on page 2."
                maxLength={2000}
                rows={3}
                autoResize
                maxRows={6}
              />
            </Field>
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
            loading={save.pending}
            loadingLabel="Saving the file"
          >
            Save details
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
