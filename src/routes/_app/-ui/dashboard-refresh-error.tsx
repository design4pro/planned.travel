import { useEffect, useRef } from 'react'
import { AppFrame } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { useTranslate } from '#/lib/i18n'

export function DashboardRefreshError({ error }: { error: unknown }) {
  const container = useRef<HTMLDivElement>(null)
  const t = useTranslate()
  useEffect(() => {
    container.current?.focus()
  }, [])
  return (
    <AppFrame>
      <div
        ref={container}
        tabIndex={-1}
        role="group"
        aria-label={t('shell.dashboard.error')}
      >
        <ErrorPanel error={error} title={t('shell.dashboard.error')} />
      </div>
    </AppFrame>
  )
}
