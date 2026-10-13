import { useState } from 'react'

import { SIGN_OUT_ENDPOINT } from '#/components/layout/session'
import { Button } from '#/components/ui'
import { useI18n } from '#/lib/i18n'

import type { Ref } from 'react'

/**
 * Signing in again from a signed-in session is a loop: `/login` sends a signed-in visitor
 * straight back. So the session is ended first, and the sign-in returns to this screen.
 */
export function SignInAgain({
  buttonRef,
  onFailed,
}: {
  buttonRef?: Ref<HTMLButtonElement>
  onFailed: () => void
}) {
  const { t } = useI18n()
  const [pending, setPending] = useState(false)

  async function signInAgain(): Promise<void> {
    setPending(true)
    try {
      const response = await fetch(SIGN_OUT_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      if (!response.ok) throw new Error(`Sign out failed: ${response.status}`)
      // An untyped href: the sign-in routes live outside this tree.
      window.location.assign(
        `/login?redirect=${encodeURIComponent('/passkeys')}`,
      )
    } catch {
      setPending(false)
      onFailed()
    }
  }

  return (
    <Button
      ref={buttonRef}
      variant="secondary"
      size="sm"
      shape="pill"
      loading={pending}
      loadingLabel={t('settings.passkeys.signInAgain')}
      onClick={() => {
        void signInAgain()
      }}
    >
      {t('settings.passkeys.signInAgain')}
    </Button>
  )
}
