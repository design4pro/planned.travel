import { useRef, useState } from 'react'
import { MoreHorizontal } from 'lucide-react'
import { useTranslate } from '#/lib/i18n'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  IconButton,
} from '#/components/ui'
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
}: {
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
  if (!canManage) return null
  const returnFocus = () => trigger.current?.focus()
  return (
    <>
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
          initialDraft={draft?.values}
          initialBaseline={draft?.baseline}
          onDraftChange={(values) =>
            setDraft((previous) => ({
              values,
              baseline: previous?.baseline ?? collection,
            }))
          }
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
          onDeleted={onDeleted}
          returnFocus={returnFocus}
        />
      ) : null}
    </>
  )
}
