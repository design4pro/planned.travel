import { useEffect, useRef } from 'react'
import type { RefObject } from 'react'
import { AppFrame } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { useTranslate } from '#/lib/i18n'

export function DashboardRefreshError({ error }: { error: unknown }) {
  return (
    <AppFrame>
      <DashboardRefreshErrorPanel error={error} />
    </AppFrame>
  )
}

export function DashboardRefreshErrorPanel({
  error,
  onRetry,
  containerRef,
}: {
  error: unknown
  onRetry?: () => void
  containerRef?: RefObject<HTMLDivElement | null>
}) {
  const localContainer = useRef<HTMLDivElement>(null)
  const container = containerRef ?? localContainer
  const t = useTranslate()
  useEffect(() => {
    if (document.activeElement === document.body) container.current?.focus()
  }, [])
  return (
    <div
      ref={container}
      tabIndex={-1}
      role="group"
      aria-label={t('shell.dashboard.error')}
    >
      <ErrorPanel
        error={error}
        title={t('shell.dashboard.error')}
        onRetry={onRetry}
      />
    </div>
  )
}
