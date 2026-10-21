import { useState } from 'react'
import { Button } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { extractSetupKey, groupSetupKey } from '../-lib/two-factor'
import { TwoFactorMatrix } from './two-factor-matrix'

/** One display owns every representation of the secret and its Replay boundary. */
export function TwoFactorKey({ uri }: { uri: string }) {
  const t = useTranslate()
  const key = extractSetupKey(uri)
  const [announcement, setAnnouncement] = useState('')
  async function copy() {
    try {
      await navigator.clipboard.writeText(key)
      setAnnouncement(t('settings.twoFactor.key.copied'))
    } catch {
      setAnnouncement(t('settings.twoFactor.key.copyFailed'))
    }
  }
  return (
    <div data-sentry-block className="flex min-w-0 flex-col gap-4">
      <p className="text-label font-medium">
        {t('settings.twoFactor.key.label')}
      </p>
      <TwoFactorMatrix uri={uri} />
      <p
        dir="ltr"
        className="break-words rounded-lg bg-surface-2 p-4 font-mono text-xl tracking-wider"
      >
        {groupSetupKey(key)}
      </p>
      <div className="flex flex-wrap gap-3">
        <Button
          className="h-auto min-h-11 whitespace-normal py-2"
          variant="secondary"
          onClick={() => void copy()}
        >
          {t('settings.twoFactor.key.copy')}
        </Button>
        <Button
          className="h-auto min-h-11 whitespace-normal py-2"
          asChild
          variant="secondary"
        >
          <a href={uri}>{t('settings.twoFactor.key.open')}</a>
        </Button>
      </div>
      <p role="status" aria-live="polite" className="text-caption text-ink-3">
        {announcement}
      </p>
    </div>
  )
}
