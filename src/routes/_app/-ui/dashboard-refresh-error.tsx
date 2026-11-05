import { useEffect, useRef } from 'react'
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
}: {
  error: unknown
  onRetry?: () => Promise<boolean>
}) {
  const container = useRef<HTMLDivElement>(null)
  const pending = useRef(false)
  const t = useTranslate()
  useEffect(() => {
    if (document.activeElement === document.body) container.current?.focus()
  }, [])
  const retry =
    onRetry === undefined
      ? undefined
      : () => {
          if (pending.current) return
          pending.current = true
          let moved = false
          const track = (event: Event) => {
            if (
              event.target instanceof Node &&
              !container.current?.contains(event.target)
            )
              moved = true
          }
          document.addEventListener('focusin', track, true)
          document.addEventListener('pointerdown', track, true)
          void onRetry().then(
            (ok) => {
              requestAnimationFrame(() => {
                document.removeEventListener('focusin', track, true)
                document.removeEventListener('pointerdown', track, true)
                pending.current = false
                if (ok && !moved)
                  document
                    .querySelector<HTMLButtonElement>(
                      '[data-dashboard-mascot-launcher]',
                    )
                    ?.focus()
                if (!ok && !moved) container.current?.focus()
              })
            },
            () => {
              document.removeEventListener('focusin', track, true)
              document.removeEventListener('pointerdown', track, true)
              pending.current = false
            },
          )
        }
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
        onRetry={retry}
      />
    </div>
  )
}
