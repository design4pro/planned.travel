import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Download } from 'lucide-react'
import {
  Alert,
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogTitle,
  IconButton,
  KbdSequence,
  Skeleton,
} from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { fetchTripFileBytes, saveBlob } from './download'
import type { FileData } from './types'

type Preview =
  | { status: 'loading' }
  | { status: 'error'; missing: boolean }
  | { status: 'ready'; blob: Blob; url: string; image: boolean }

export function FilePreview({
  tripId,
  file,
  files,
  onClose,
}: {
  readonly tripId: string
  readonly file: FileData
  readonly files: ReadonlyArray<FileData>
  readonly onClose: () => void
}) {
  const t = useTranslate()
  const [selected, setSelected] = useState(file)
  const [preview, setPreview] = useState<Preview>({ status: 'loading' })
  const [attempt, setAttempt] = useState(0)
  const title = useRef<HTMLHeadingElement>(null)
  const busy = useRef(true)
  const touch = useRef<{ x: number; y: number } | null>(null)
  const close = useRef(onClose)
  close.current = onClose
  const images = files.filter((entry) =>
    entry.contentType.toLowerCase().startsWith('image/'),
  )
  const index = images.findIndex((entry) => entry.id === selected.id)
  const gallery = preview.status === 'ready' && preview.image && index >= 0

  useEffect(() => {
    let live = true
    let url: string | undefined
    busy.current = true
    setPreview({ status: 'loading' })
    void fetchTripFileBytes({ tripId, fileId: selected.id })
      .then((blob) => {
        if (!live) return
        const type = blob.type.split(';')[0]?.trim().toLowerCase() ?? ''
        const image = type.startsWith('image/')
        if (!image && type !== 'application/pdf' && type !== 'text/plain') {
          saveBlob(blob, selected.filename)
          close.current()
          return
        }
        url = URL.createObjectURL(blob)
        busy.current = false
        setPreview({ status: 'ready', blob, url, image })
      })
      .catch((error: unknown) => {
        if (!live) return
        busy.current = false
        setPreview({
          status: 'error',
          missing:
            typeof error === 'object' &&
            error !== null &&
            'status' in error &&
            error.status === 410,
        })
      })
    return () => {
      live = false
      if (url !== undefined) URL.revokeObjectURL(url)
    }
  }, [tripId, selected, attempt])

  function navigate(next: number) {
    if (busy.current || !gallery || next === index) return
    const target = images[next]
    if (target === undefined) return
    title.current?.focus({ preventScroll: true })
    busy.current = true
    setPreview({ status: 'loading' })
    setSelected(target)
  }

  function renderError() {
    title.current?.focus({ preventScroll: true })
    setPreview({ status: 'error', missing: false })
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        size={
          selected.contentType.toLowerCase().startsWith('image/')
            ? 'full'
            : 'xl'
        }
        aria-describedby={undefined}
        onKeyDown={(event) => {
          if (!gallery) return
          const positions: Record<string, number> = {
            ArrowLeft: index - 1,
            ArrowRight: index + 1,
            Home: 0,
            End: images.length - 1,
          }
          const next = positions[event.key]
          if (next === undefined) return
          event.preventDefault()
          navigate(next)
        }}
      >
        <DialogHeader>
          <DialogTitle
            ref={title}
            tabIndex={-1}
            className="break-words outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            {selected.filename}
          </DialogTitle>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            {index >= 0 ? (
              <>
                <span aria-live="polite">
                  {t('modules.files.preview.position', {
                    current: index + 1,
                    total: images.length,
                  })}
                </span>
                <KbdSequence keys={['←', '→', 'Home', 'End']} />
              </>
            ) : null}
            <IconButton
              icon={<Download />}
              label={t('modules.files.preview.download', {
                name: selected.filename,
              })}
              disabled={preview.status !== 'ready'}
              onClick={() => {
                if (preview.status === 'ready')
                  saveBlob(preview.blob, selected.filename)
              }}
            />
          </div>
        </DialogHeader>
        <DialogBody>
          {preview.status === 'loading' ? (
            <div role="status" aria-label={t('modules.files.preview.loading')}>
              <Skeleton className="h-[55dvh] w-full" />
            </div>
          ) : null}
          {preview.status === 'error' ? (
            <Alert
              tone="danger"
              title={t(
                preview.missing
                  ? 'modules.files.preview.missing'
                  : 'modules.files.preview.failed',
              )}
              actions={
                <Button
                  onClick={() => {
                    title.current?.focus({ preventScroll: true })
                    setAttempt((value) => value + 1)
                  }}
                >
                  {t('modules.files.calendar.retry')}
                </Button>
              }
            />
          ) : null}
          {preview.status === 'ready' && preview.image ? (
            <img
              src={preview.url}
              loading="eager"
              alt={selected.filename}
              className="mx-auto max-h-[60dvh] max-w-full touch-pan-y object-contain"
              onError={renderError}
              onPointerDown={(event) => {
                if (event.pointerType !== 'touch') return
                event.currentTarget.setPointerCapture(event.pointerId)
                touch.current = { x: event.clientX, y: event.clientY }
              }}
              onPointerCancel={() => {
                touch.current = null
              }}
              onPointerUp={(event) => {
                const start = touch.current
                touch.current = null
                if (start === null) return
                const dx = event.clientX - start.x
                const dy = event.clientY - start.y
                if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy))
                  navigate(index + (dx < 0 ? 1 : -1))
              }}
            />
          ) : null}
          {preview.status === 'ready' && !preview.image ? (
            <iframe
              title={selected.filename}
              src={preview.url}
              className="h-[60dvh] w-full border-0"
              onError={renderError}
              onLoad={(event) => {
                // Keyboard events inside a document do not bubble to the dialog.
                event.currentTarget.contentDocument?.addEventListener(
                  'keydown',
                  (key) => {
                    if (key.key === 'Escape') close.current()
                  },
                )
              }}
            />
          ) : null}
          {index >= 0 && images.length > 1 ? (
            <div className="mt-3 flex justify-between">
              <IconButton
                icon={<ChevronLeft className="rtl:rotate-180" />}
                label={t('modules.files.preview.previous')}
                disabled={!gallery || index === 0}
                onClick={() => navigate(index - 1)}
              />
              <IconButton
                icon={<ChevronRight className="rtl:rotate-180" />}
                label={t('modules.files.preview.next')}
                disabled={!gallery || index === images.length - 1}
                onClick={() => navigate(index + 1)}
              />
            </div>
          ) : null}
        </DialogBody>
      </DialogContent>
    </Dialog>
  )
}
