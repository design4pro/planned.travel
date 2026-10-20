import { useEffect, useRef, useState } from 'react'
import { Alert } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { describeFailure } from '#/routes/(auth)/-lib/errors'
import type { AuthFailure } from '#/lib/auth/client'
import type { AuthMessage } from '#/routes/(auth)/-lib/errors'

export function useTwoFactorFeedback() {
  const [failure, setFailure] = useState<AuthMessage | null>(null)
  const [wait, setWait] = useState(0)
  useEffect(() => {
    if (!wait) return
    const timer = window.setTimeout(() => setWait(0), wait)
    return () => window.clearTimeout(timer)
  }, [wait])
  function reject(error: AuthFailure, call: 'password' | 'code') {
    if (error.status === 429) {
      setWait(call === 'code' ? 60000 : 10000)
      setFailure({
        titleKey: 'settings.twoFactor.rateLimited.title',
        detailKey:
          call === 'code'
            ? 'settings.twoFactor.rateLimited.code'
            : 'settings.twoFactor.rateLimited.password',
        tone: 'warning',
      })
    } else setFailure(describeFailure(error))
  }
  return { failure, setFailure, wait, reject }
}

export function TwoFactorFeedback({
  failure,
}: {
  failure: AuthMessage | null
}) {
  const t = useTranslate()
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (failure) ref.current?.focus()
  }, [failure])
  if (!failure) return null
  return (
    <Alert
      ref={ref}
      tabIndex={-1}
      tone={failure.tone}
      title={t(failure.titleKey)}
    >
      {t(failure.detailKey)}
    </Alert>
  )
}
