import { useEffect, useRef } from 'react'
import { useRouter } from '@tanstack/react-router'
import { AppFrame } from '#/components/layout/app-frame'
import { ErrorPanel } from '#/components/layout/error-state'
import { useTranslate } from '#/lib/i18n'

export function DashboardRefreshError({ error }: { error: unknown }) {
  const container = useRef<HTMLDivElement>(null)
  const t = useTranslate()
  const router = useRouter()
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
        <ErrorPanel
          error={error}
          title={t('shell.dashboard.error')}
          onRetry={() => {
            const focused = document.activeElement
            void router.invalidate({ sync: true }).then(
              () => {
                requestAnimationFrame(() => {
                  if (
                    document.activeElement === document.body ||
                    document.activeElement === focused
                  ) {
                    document
                      .querySelector<HTMLButtonElement>(
                        '[data-dashboard-mascot-launcher]',
                      )
                      ?.focus()
                  }
                })
              },
              () => undefined,
            )
          }}
        />
      </div>
    </AppFrame>
  )
}
