import { useState } from 'react'
import { MapPin } from 'lucide-react'
import { Alert, Button } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { ModulePanel, useAction } from '../shared'
import { downloadTripPlaces } from './places-download'

export function PlacesPanel({
  tripId,
  hasPlaces,
}: {
  readonly tripId: string
  readonly hasPlaces: boolean
}) {
  const t = useTranslate()
  const [downloaded, setDownloaded] = useState(false)
  const unavailable = t('modules.files.places.error')
  const download = useAction(downloadTripPlaces, {
    failure: t('modules.files.toast.downloadFailed'),
    fallback: unavailable,
    invalidate: false,
    onSuccess: () => setDownloaded(true),
  })
  let status = ''
  if (!hasPlaces) status = t('modules.files.places.empty')
  else if (download.pending) status = t('modules.files.places.pending')
  else if (downloaded) status = t('modules.files.places.done')

  return (
    <ModulePanel label={t('modules.files.places.title')}>
      <div className="flex flex-col items-start gap-3">
        <p className="text-body text-ink-2">
          {t('modules.files.places.description')}
        </p>
        <Button
          variant="secondary"
          size="sm"
          shape="pill"
          icon={<MapPin aria-hidden />}
          className="h-auto min-h-8 max-w-full py-1.5 text-start whitespace-normal"
          disabled={!hasPlaces}
          loading={download.pending}
          onClick={() => {
            setDownloaded(false)
            void download.run({ tripId, unavailable })
          }}
        >
          {t('modules.files.places.action')}
        </Button>
        <p role="status" className="text-caption text-ink-3">
          {status}
        </p>
        {download.error ? <Alert tone="danger">{download.error}</Alert> : null}
      </div>
    </ModulePanel>
  )
}
