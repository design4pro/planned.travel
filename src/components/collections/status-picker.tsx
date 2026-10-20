import { useRef, useState } from 'react'
import { useTranslate } from '#/lib/i18n'
import { cn } from '#/lib/cn'
import {
  Alert,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '#/components/ui'
import { badgeVariants } from '#/components/ui/badge'
import { COLLECTION_STATUS_TONE, toneFor } from '#/routes/_app/-lib/tone'
import { COLLECTION_PLACE_STATUSES, STATUS_KEYS } from './status-copy'
import type { PlaceStatus } from './status-copy'

export function StatusPicker({
  place,
  setStatus,
  onSaved,
  readCurrent,
}: {
  place: { id: string; name: string; status: PlaceStatus }
  setStatus: (input: {
    collectionPlaceId: string
    status: PlaceStatus
  }) => Promise<unknown>
  readCurrent: () => Promise<PlaceStatus>
  onSaved: (status: PlaceStatus) => Promise<void>
}) {
  const t = useTranslate()
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState<PlaceStatus | null>(null)
  const [open, setOpen] = useState(false)
  const lock = useRef(false)
  const committed = useRef(false)
  async function save(status: PlaceStatus) {
    if (lock.current || status === place.status) return
    lock.current = true
    setOpen(false)
    setBusy(true)
    setFailed(null)
    committed.current = false
    try {
      await setStatus({ collectionPlaceId: place.id, status })
      committed.current = true
      await onSaved(status)
    } catch {
      setFailed(status)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  async function retry() {
    if (lock.current || !failed) return
    lock.current = true
    setBusy(true)
    try {
      const current = committed.current ? failed : await readCurrent()
      if (!committed.current && current === place.status) {
        lock.current = false
        await save(failed)
        return
      }
      await onSaved(current)
      setFailed(null)
    } catch {
      setFailed(failed)
    } finally {
      lock.current = false
      setBusy(false)
    }
  }
  return (
    <div className="flex flex-col items-end gap-2">
      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          if (!lock.current) setOpen(next)
        }}
      >
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-busy={busy}
            aria-disabled={busy}
            aria-label={t('modules.collections.statusPicker.trigger', {
              place: place.name,
              status: t(STATUS_KEYS[place.status]),
            })}
            className={cn(
              badgeVariants({
                tone: toneFor(COLLECTION_STATUS_TONE, place.status),
                size: 'sm',
              }),
              'min-h-6 focus-ring transition-opacity duration-[180ms] ease-out-quint motion-reduce:transition-none hover:opacity-80 active:opacity-70',
              busy && 'opacity-60',
            )}
          >
            {t(STATUS_KEYS[place.status])}
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent>
          <DropdownMenuLabel>
            {t('modules.collections.statusPicker.legend', {
              place: place.name,
            })}
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={place.status}
            onValueChange={(value) => {
              const status = COLLECTION_PLACE_STATUSES.find(
                (item) => item === value,
              )
              if (status) void save(status)
            }}
          >
            {COLLECTION_PLACE_STATUSES.map((status) => (
              <DropdownMenuRadioItem key={status} value={status}>
                {t(STATUS_KEYS[status])}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {failed ? (
        <Alert
          tone="danger"
          className="w-full"
          actions={
            <Button size="sm" aria-disabled={busy} onClick={() => void retry()}>
              {t('modules.collections.statusPicker.retry')}
            </Button>
          }
        >
          {t('modules.collections.statusPicker.error', { place: place.name })}
        </Alert>
      ) : null}
    </div>
  )
}
