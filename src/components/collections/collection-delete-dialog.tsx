import { useEffect, useRef, useState } from 'react'
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
  Skeleton,
} from '#/components/ui'

export interface DeleteSummary {
  name: string
  places: number
  labels: number
  requiresName: boolean
}
export interface CollectionDeleteProps {
  collection: { id: string; name: string }
  summary: (input: { collectionId: string }) => Promise<DeleteSummary>
  remove: (input: {
    collectionId: string
    confirmName?: string
  }) => Promise<unknown>
  onClose: () => void
  onDeleted: () => Promise<void>
  returnFocus: () => void
  exists?: () => Promise<boolean>
}
export function CollectionDeleteDialog({
  collection,
  summary,
  remove,
  onClose,
  onDeleted,
  returnFocus,
  exists,
}: CollectionDeleteProps) {
  const t = useTranslate()
  const [data, setData] = useState<DeleteSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [failed, setFailed] = useState(false)
  const [nameNeeded, setNameNeeded] = useState(false)
  const [confirmName, setConfirmName] = useState('')
  const [busy, setBusy] = useState(false)
  const lock = useRef(false)
  const input = useRef<HTMLInputElement>(null)
  const alert = useRef<HTMLDivElement>(null)
  async function read() {
    setLoading(true)
    setLoadError(false)
    try {
      const next = await summary({ collectionId: collection.id })
      setData(next)
      return next
    } catch {
      setLoadError(true)
      return null
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    let active = true
    void summary({ collectionId: collection.id })
      .then((next) => {
        if (active) setData(next)
      })
      .catch(() => {
        if (active) setLoadError(true)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [collection.id, summary])
  useEffect(() => {
    if (nameNeeded && !loading) input.current?.focus()
  }, [nameNeeded, loading])
  useEffect(() => {
    if (failed && !loading && !nameNeeded) alert.current?.focus()
  }, [failed, loading, nameNeeded])
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (
      lock.current ||
      !data ||
      loading ||
      loadError ||
      (data.requiresName && confirmName !== data.name)
    )
      return
    lock.current = true
    setBusy(true)
    setFailed(false)
    try {
      await remove({ collectionId: collection.id, confirmName })
      await onDeleted()
    } catch {
      const next = await read()
      if (!next && exists) {
        try {
          if (!(await exists())) {
            await onDeleted()
            return
          }
        } catch {
          setLoadError(true)
        }
      }
      setFailed(true)
      setNameNeeded(Boolean(next?.requiresName && confirmName !== next.name))
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open && !lock.current) onClose()
      }}
    >
      <DialogContent
        aria-describedby={undefined}
        hideClose={busy}
        onCloseAutoFocus={(event) => {
          event.preventDefault()
          returnFocus()
        }}
      >
        <form
          onSubmit={submit}
          className="flex min-h-0 flex-col"
          aria-busy={busy || loading}
        >
          <DialogHeader>
            <DialogTitle>
              {t('modules.collections.delete.title', {
                name: data?.name ?? collection.name,
              })}
            </DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            {loading ? (
              <div role="status">
                <span className="sr-only">
                  {t('modules.collections.delete.loading')}
                </span>
                <Skeleton className="h-16 w-full" />
              </div>
            ) : null}
            {loadError ? (
              <Alert
                tone="danger"
                title={t('modules.collections.delete.loadErrorTitle')}
                actions={
                  <Button type="button" onClick={() => void read()}>
                    {t('modules.collections.delete.retry')}
                  </Button>
                }
              >
                {t('modules.collections.delete.loadError')}
              </Alert>
            ) : null}
            {data && !loading && !loadError ? (
              <>
                <ul className="space-y-2 text-body text-ink-2">
                  {data.places > 0 ? (
                    <li>
                      {t('modules.collections.delete.places', {
                        count: data.places,
                      })}
                    </li>
                  ) : null}
                  {data.labels > 0 ? (
                    <li>
                      {t('modules.collections.delete.labels', {
                        count: data.labels,
                      })}
                    </li>
                  ) : null}
                </ul>
                <p className="text-body text-ink-2">
                  {t('modules.collections.delete.irreversible')}
                </p>
                {data.requiresName ? (
                  <>
                    <p className="break-words font-semibold">
                      <bdi>{data.name}</bdi>
                    </p>
                    <Field
                      label={t('modules.collections.delete.nameLabel')}
                      hint={t('modules.collections.delete.typeName')}
                      disabled={busy}
                    >
                      <Input
                        ref={input}
                        autoComplete="off"
                        autoCapitalize="off"
                        autoCorrect="off"
                        spellCheck={false}
                        value={confirmName}
                        onChange={(event) => setConfirmName(event.target.value)}
                      />
                    </Field>
                  </>
                ) : null}
              </>
            ) : null}
            {failed ? (
              <Alert ref={alert} tabIndex={-1} tone="danger">
                {nameNeeded
                  ? t('modules.collections.delete.nameNeeded')
                  : t('modules.collections.delete.error')}
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
              {t('modules.collections.delete.cancel')}
            </Button>
            <Button
              type="submit"
              variant="danger"
              disabled={
                !data ||
                loading ||
                loadError ||
                (data.requiresName && confirmName !== data.name)
              }
              aria-disabled={busy}
            >
              {busy
                ? t('modules.collections.delete.deleting')
                : t('modules.collections.delete.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
