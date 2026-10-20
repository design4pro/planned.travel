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
export type CollectionDraft = Pick<
  EditableCollection,
  'name' | 'description' | 'colour'
>

export interface CollectionEditProps {
  initialDraft?: CollectionDraft
  initialBaseline?: EditableCollection
  onDraftChange?: (draft: CollectionDraft) => void
  onDiscard?: () => void
  readCurrent: () => Promise<EditableCollection>
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
  initialDraft,
  initialBaseline,
  onDraftChange,
  onDiscard,
  readCurrent,
  update,
  onClose,
  onSaved,
  returnFocus,
}: CollectionEditProps) {
  const t = useTranslate()
  const [name, setName] = useState(initialDraft?.name ?? collection.name)
  const [description, setDescription] = useState(
    initialDraft?.description ?? collection.description ?? '',
  )
  const [colour, setColour] = useState(
    initialDraft?.colour ?? collection.colour,
  )
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(false)
  const [currentDetails, setCurrentDetails] =
    useState<EditableCollection | null>(null)
  const [nameError, setNameError] = useState<string>()
  const input = useRef<HTMLInputElement>(null)
  const lock = useRef(false)
  const baseline = useRef(initialBaseline ?? collection)
  const needsReconciliation = useRef(Boolean(initialDraft))
  function remember(draft: CollectionDraft) {
    onDraftChange?.(draft)
  }
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
    setNameError(undefined)
    try {
      if (error || needsReconciliation.current) {
        const current = await readCurrent()
        needsReconciliation.current = false
        const matchesDraft =
          current.name === trimmed &&
          (current.description ?? '') === description &&
          current.colour === colour
        if (matchesDraft) {
          await onSaved()
          toast.success(t('modules.collections.edit.saved'))
          onDiscard?.()
          onClose()
          return
        }
        const previous = baseline.current
        if (
          current.name !== previous.name ||
          current.description !== previous.description ||
          current.colour !== previous.colour
        ) {
          await onSaved()
          baseline.current = current
          setCurrentDetails(current)
          setError(true)
          return
        }
      }
      await update({
        collectionId: collection.id,
        name: trimmed,
        description,
        colour,
      })
      await onSaved()
      toast.success(t('modules.collections.edit.saved'))
      onDiscard?.()
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
                onChange={(event) => {
                  setName(event.target.value)
                  remember({ name: event.target.value, description, colour })
                }}
              />
            </Field>
            <Field
              label={t('modules.collections.edit.description')}
              disabled={busy}
            >
              <Textarea
                value={description}
                maxLength={20000}
                onChange={(event) => {
                  setDescription(event.target.value)
                  remember({ name, description: event.target.value, colour })
                }}
              />
            </Field>
            <fieldset disabled={busy}>
              <SwatchPicker
                value={colour}
                onChange={(value) => {
                  setColour(value)
                  remember({ name, description, colour: value })
                }}
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
                {currentDetails ? (
                  <dl className="mt-3 space-y-2 wrap-anywhere">
                    <div>
                      <dt className="font-semibold">
                        {t('modules.collections.edit.name')}
                      </dt>
                      <dd>{currentDetails.name}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">
                        {t('modules.collections.edit.description')}
                      </dt>
                      <dd>{currentDetails.description}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold">
                        {t('modules.collections.edit.colour')}
                      </dt>
                      <dd>{currentDetails.colour}</dd>
                    </div>
                  </dl>
                ) : null}
              </Alert>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              aria-disabled={busy}
              onClick={() => {
                if (!lock.current) {
                  onDiscard?.()
                  onClose()
                }
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
