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
  const [downloaded, setDownloaded] = useState<{
    readonly omitted?: number
    readonly total?: number
  } | null>(null)
  const [activeFormat, setActiveFormat] = useState<'geojson' | 'gpx'>('geojson')
  const unavailable = t('modules.files.places.error')
  const download = useAction(downloadTripPlaces, {
    failure: t('modules.files.toast.downloadFailed'),
    fallback: unavailable,
    invalidate: false,
    onSuccess: setDownloaded,
  })
  let status = ''
  if (!hasPlaces) status = t('modules.files.places.empty')
  else if (download.pending) status = t('modules.files.places.pending')
  else if (
    downloaded?.total !== undefined &&
    downloaded.total > 0 &&
    downloaded.omitted === downloaded.total
  )
    status = t('modules.files.places.gpxAllOmitted', {
      count: downloaded.omitted,
    })
  else if (downloaded?.omitted !== undefined)
    status = t('modules.files.places.gpxDone', { count: downloaded.omitted })
  else if (downloaded) status = t('modules.files.places.done')

  return (
    <ModulePanel label={t('modules.files.places.title')}>
      <div className="flex flex-col items-start gap-3">
        <p className="text-body text-ink-2">
          {t('modules.files.places.description')}
        </p>
        <div className="flex max-w-full flex-wrap gap-2">
          {(['geojson', 'gpx'] as const).map((format) => (
            <Button
              key={format}
              variant="secondary"
              size="sm"
              shape="pill"
              icon={<MapPin aria-hidden />}
              className="h-auto min-h-8 max-w-full py-1.5 text-start whitespace-normal"
              disabled={!hasPlaces}
              loading={download.pending && activeFormat === format}
              aria-disabled={download.pending || undefined}
              onClick={() => {
                if (download.pending) return
                setDownloaded(null)
                setActiveFormat(format)
                void download.run({
                  tripId,
                  unavailable,
                  ...(format === 'gpx' ? { format } : {}),
                })
              }}
            >
              {t(
                format === 'gpx'
                  ? 'modules.files.places.gpxAction'
                  : 'modules.files.places.action',
              )}
            </Button>
          ))}
        </div>
        <p role="status" className="text-caption text-ink-3">
          {status}
        </p>
        {download.error ? <Alert tone="danger">{download.error}</Alert> : null}
      </div>
    </ModulePanel>
  )
}
