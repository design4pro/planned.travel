import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { useTranslate } from '#/lib/i18n'
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogBody,
  DialogFooter,
  Field,
  Input,
  Textarea,
} from '#/components/ui'
import { SwatchPicker } from '#/components/modules/shared/swatch-picker'
import { REQUIRED_SWATCHES } from '#/lib/swatches'

export interface EditableCollection {
  id: string
  name: string
  description: string | null
  colour: string
}
export interface CollectionEditProps {
  collection: EditableCollection
  update: (input: {
    collectionId: string
    name: string
    description: string
    colour: string
  }) => Promise<unknown>
  onClose: () => void
  onSaved: () => Promise<void>
  returnFocus: () => void
}
export function CollectionEditDialog({
  collection,
  update,
  onClose,
  onSaved,
  returnFocus,
}: CollectionEditProps) {
  const t = useTranslate()
  const [name, setName] = useState(collection.name)
  const [description, setDescription] = useState(collection.description ?? '')
  const [colour, setColour] = useState(collection.colour)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [nameError, setNameError] = useState<string>()
  const input = useRef<HTMLInputElement>(null)
  const lock = useRef(false)
  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (lock.current) return
    const trimmed = name.trim()
    if (!trimmed || trimmed.length > 200) {
      setNameError(
        !trimmed
          ? t('modules.collections.edit.nameRequired')
          : t('modules.collections.edit.nameTooLong', { count: 200 }),
      )
      input.current?.focus()
      return
    }
    lock.current = true
    setBusy(true)
    setError(false)
    setNameError(undefined)
    try {
      await update({
        collectionId: collection.id,
        name: trimmed,
        description,
        colour,
      })
      await onSaved()
      toast.success(t('modules.collections.edit.saved'))
      onClose()
    } catch {
      setError(true)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  let submitLabel = t('modules.collections.edit.submit')
  if (busy) submitLabel = t('modules.collections.edit.saving')
  else if (error) submitLabel = t('modules.collections.edit.retry')
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !lock.current) onClose()
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocus()
        }}
        hideClose={busy}
      >
        <form
          onSubmit={save}
          className="flex min-h-0 flex-col"
          aria-busy={busy}
        >
          <DialogHeader>
            <DialogTitle>{t('modules.collections.edit.title')}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <Field
              label={t('modules.collections.edit.name')}
              error={nameError}
              required
              disabled={busy}
            >
              <Input
                ref={input}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </Field>
            <Field
              label={t('modules.collections.edit.description')}
              disabled={busy}
            >
              <Textarea
                value={description}
                maxLength={20000}
                onChange={(event) => setDescription(event.target.value)}
              />
            </Field>
            <fieldset disabled={busy}>
              <SwatchPicker
                value={colour}
                onChange={setColour}
                legend={t('modules.collections.edit.colour')}
                swatches={REQUIRED_SWATCHES}
              />
            </fieldset>
            {error ? (
              <Alert
                tone="danger"
                title={t('modules.collections.edit.errorTitle')}
              >
                {t('modules.collections.edit.error')}
              </Alert>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              aria-disabled={busy}
              onClick={() => {
                if (!lock.current) onClose()
              }}
            >
              {t('modules.collections.edit.cancel')}
            </Button>
            <Button type="submit" aria-disabled={busy}>
              {submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
