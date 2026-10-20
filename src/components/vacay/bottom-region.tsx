import { useEffect, useRef } from 'react'
import { Alert, Button } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'

export function BottomRegion({
  message,
  failure,
  retry,
  onHeight,
}: {
  message: string
  failure: string | null
  retry?: () => void
  onHeight: (height: number) => void
}) {
  const t = useTranslate()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const previous = document.documentElement.style.scrollPaddingBottom
    const observer = new ResizeObserver(() => {
      const height = node.getBoundingClientRect().height
      onHeight(height)
      document.documentElement.style.scrollPaddingBottom = `${height + 160}px`
    })
    observer.observe(node)
    return () => {
      observer.disconnect()
      document.documentElement.style.scrollPaddingBottom = previous
    }
  }, [onHeight])
  return (
    <div
      ref={ref}
      data-part="vacay-bottom-region"
      className="pointer-events-none fixed inset-x-4 bottom-[calc(var(--safe-bottom)+8.5rem)] z-30 mx-auto max-w-lg lg:bottom-22"
    >
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto rounded-lg bg-surface text-ink shadow-popover"
      >
        {message ? (
          <p id="vacay-day-status" className="p-3 text-caption">
            {message}
          </p>
        ) : null}
      </div>
      {failure ? (
        <Alert
          tone="danger"
          className="pointer-events-auto mt-2"
          actions={
            retry ? (
              <Button variant="secondary" onClick={retry}>
                {t('modules.vacay.day.retry')}
              </Button>
            ) : undefined
          }
        >
          {failure}
        </Alert>
      ) : null}
    </div>
  )
}
