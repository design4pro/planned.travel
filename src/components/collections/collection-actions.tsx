import { useEffect, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { MoreHorizontal } from 'lucide-react'
import { useTranslate } from '#/lib/i18n'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
} from '#/components/ui'
import { useWorkspaceClaim } from '#/lib/workspace-claim-store'
import { CollectionExitGuard } from './collection-exit-guard'
import { CollectionEditDialog } from './collection-edit-dialog'
import { CollectionDeleteDialog } from './collection-delete-dialog'
import type {
  CollectionDraft,
  CollectionEditProps,
  EditableCollection,
} from './collection-edit-dialog'
import type { CollectionDeleteProps } from './collection-delete-dialog'

export function CollectionActions({
  canManage,
  collection,
  update,
  summary,
  remove,
  onSaved,
  onDeleted,
  exists,
  readCurrent,
  expiresAt,
}: {
  expiresAt?: string
  readCurrent: CollectionEditProps['readCurrent']
  canManage: boolean
  collection: CollectionEditProps['collection']
  update: CollectionEditProps['update']
  summary: CollectionDeleteProps['summary']
  remove: CollectionDeleteProps['remove']
  onSaved: CollectionEditProps['onSaved']
  onDeleted: CollectionDeleteProps['onDeleted']
  exists?: CollectionDeleteProps['exists']
}) {
  const t = useTranslate()
  const trigger = useRef<HTMLButtonElement>(null)
  const [dialog, setDialog] = useState<'edit' | 'delete' | null>(null)
  const [draft, setDraft] = useState<{
    values: CollectionDraft
    baseline: EditableCollection
  }>()
  const [busy, setBusy] = useState(false)
  const { stale } = useWorkspaceClaim()
  useEffect(() => {
    if (!canManage || stale) {
      setDraft(undefined)
      setDialog(null)
      setBusy(false)
    }
  }, [canManage, stale])
  useEffect(() => {
    if (!expiresAt) return
    let timer: ReturnType<typeof setTimeout>
    function checkExpiry() {
      const remaining = Date.parse(expiresAt ?? '') - Date.now()
      if (remaining <= 0) {
        setDraft(undefined)
        setDialog(null)
        setBusy(false)
      } else if (Number.isFinite(remaining)) {
        timer = setTimeout(checkExpiry, Math.min(remaining, 2_147_483_647))
      }
    }
    checkExpiry()
    return () => clearTimeout(timer)
  }, [expiresAt])
  if (!canManage || stale) return null
  const dirty = Boolean(
    draft &&
    (draft.values.name !== draft.baseline.name ||
      (draft.values.description ?? '') !== (draft.baseline.description ?? '') ||
      draft.values.colour !== draft.baseline.colour),
  )
  const returnFocus = () => trigger.current?.focus()
  return (
    <>
      <CollectionExitGuard
        collectionId={collection.id}
        expiresAt={expiresAt}
        returnFocus={returnFocus}
        dirty={dirty}
        busy={busy}
        onDiscard={() => {
          setDraft(undefined)
          setDialog(null)
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <IconButton
            ref={trigger}
            label={t('modules.collections.actions.trigger', {
              name: collection.name,
            })}
            icon={<MoreHorizontal aria-hidden />}
          />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          onCloseAutoFocus={(event) => {
            if (dialog) event.preventDefault()
          }}
        >
          <DropdownMenuItem onSelect={() => setDialog('edit')}>
            {t('modules.collections.actions.edit')}
          </DropdownMenuItem>
          <DropdownMenuItem destructive onSelect={() => setDialog('delete')}>
            {t('modules.collections.actions.delete')}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {dialog === 'edit' ? (
        <CollectionEditDialog
          collection={collection}
          onBusyChange={setBusy}
          initialDraft={draft?.values}
          initialBaseline={draft?.baseline}
          onDraftChange={(values, baseline) => setDraft({ values, baseline })}
          onDiscard={() => setDraft(undefined)}
          readCurrent={readCurrent}
          update={update}
          onClose={() => setDialog(null)}
          onSaved={onSaved}
          returnFocus={returnFocus}
        />
      ) : null}
      {dialog === 'delete' ? (
        <CollectionDeleteDialog
          collection={collection}
          summary={summary}
          exists={exists}
          remove={remove}
          onClose={() => setDialog(null)}
          onDeleted={async () => {
            flushSync(() => setDraft(undefined))
            await onDeleted()
          }}
          returnFocus={returnFocus}
        />
      ) : null}
    </>
  )
}
