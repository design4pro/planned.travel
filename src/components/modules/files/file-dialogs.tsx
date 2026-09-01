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
import { useTranslate } from '#/lib/i18n'
import { useAction } from '../shared'

import type { MessageKey, Translate } from '#/lib/i18n'
import type { FileData } from './types'

const KIND_LABEL: Record<string, MessageKey> = {
  document: 'modules.files.kind.document',
  image: 'modules.files.kind.photo',
  ticket: 'modules.files.kindChoice.ticket',
  receipt: 'modules.files.kind.receipt',
  map: 'modules.files.kindChoice.map',
}

function kindOptions(
  t: Translate,
): ReadonlyArray<{ value: string; label: string }> {
  return FILE_KIND_VALUES.map((value) => ({
    value,
    label: t(KIND_LABEL[value] ?? 'modules.files.kind.other'),
  }))
}

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
  const t = useTranslate()
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
    success: t('modules.files.toast.updated'),
    failure: t('modules.files.toast.updateFailed'),
  })

  const trimmed = filename.trim()
  const nameError =
    trimmed.length === 0
      ? t('modules.files.error.nameEmpty')
      : trimmed.length > 160
        ? t('modules.error.titleLong')
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
          <DialogTitle>{t('modules.files.dialog.title')}</DialogTitle>
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
              <Alert tone="danger" title={t('modules.form.saveError')}>
                {save.error}
              </Alert>
            )}

            <Field label={t('modules.field.name')} required error={nameError}>
              <Input
                value={filename}
                onChange={(event) => setFilename(event.target.value)}
                maxLength={200}
                autoComplete="off"
                required
              />
            </Field>

            <Field
              label={t('modules.lists.field.kind')}
              hint={t('modules.files.field.kindHint')}
            >
              <SimpleSelect
                options={[...kindOptions(t)]}
                value={kind}
                onValueChange={setKind}
                ariaLabel={t('modules.files.field.kindAria')}
              />
            </Field>

            <Field label={t('modules.files.field.description')}>
              <Textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder={t('modules.files.field.descriptionPlaceholder')}
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
            {t('modules.action.cancel')}
          </Button>
          <Button
            type="submit"
            form={formId}
            variant="primary"
            shape="pill"
            disabled={!canSave}
            loading={save.pending}
            loadingLabel={t('modules.files.action.saving')}
          >
            {t('modules.files.action.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
