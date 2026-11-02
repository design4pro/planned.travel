import { useEffect, useRef, useState } from 'react'
import { Skeleton } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'

export function PdfPreview({
  blob,
  name,
  onError,
}: {
  readonly blob: Blob
  readonly name: string
  readonly onError: () => void
}) {
  const container = useRef<HTMLDivElement>(null)
  const failure = useRef(onError)
  failure.current = onError
  const [loading, setLoading] = useState(true)
  const t = useTranslate()
  useEffect(() => {
    let live = true
    let dispose: (() => void) | undefined
    const target = container.current
    setLoading(true)
    void import('./preview-pdf')
      .then(({ previewPdf }) => {
        if (!live || !target) return
        dispose = previewPdf(
          blob,
          target,
          () => setLoading(false),
          () => failure.current(),
        )
      })
      .catch(() => {
        if (live) failure.current()
      })
    return () => {
      live = false
      dispose?.()
    }
  }, [blob])
  return (
    <div
      role="document"
      aria-label={name}
      tabIndex={0}
      className="h-[60dvh] overflow-auto outline-none focus-visible:ring-2 focus-visible:ring-brand"
    >
      {loading ? (
        <div role="status" aria-label={t('modules.files.preview.loading')}>
          <Skeleton className="h-[55dvh] w-full" />
        </div>
      ) : null}
      <div ref={container} />
    </div>
  )
}
