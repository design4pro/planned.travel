/**
 * Taking a trip into the calendar app a traveller already uses.
 *
 * Phase 1 of the calendar spec: a snapshot, saved as an `.ics` file. The panel says so in its own
 * words (it does not update) rather than leaving the reader to find out when the trip changes.
 */
import { lazy, Suspense, useState } from 'react'
import { CalendarArrowDown } from 'lucide-react'

import { Alert, Button } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { ModulePanel, useAction } from '../shared'
import { downloadTripCalendar } from './calendar-download'

const LiveCalendar = lazy(() =>
  import('./calendar-live').then((module) => ({
    default: module.CalendarLive,
  })),
)

export interface CalendarPanelProps {
  readonly tripId: string
  /** Whether the trip has a start date; without one only dated bookings and journeys appear. */
  readonly hasDates: boolean
}

export function CalendarPanel({ tripId, hasDates }: CalendarPanelProps) {
  const t = useTranslate()
  const [liveMounted, setLiveMounted] = useState(false)
  const unavailable = t('modules.files.calendar.download.error')
  // No `invalidate`: a download changes nothing the loader read.
  const download = useAction(downloadTripCalendar, {
    failure: t('modules.files.toast.downloadFailed'),
    fallback: unavailable,
    invalidate: false,
  })

  return (
    <ModulePanel label={t('modules.files.calendar.title')}>
      <div className="flex flex-col items-start gap-3">
        <p className="text-body text-ink-2">
          {t('modules.files.calendar.description')}
        </p>
        <Button
          variant="secondary"
          size="sm"
          shape="pill"
          icon={<CalendarArrowDown aria-hidden strokeWidth={2.5} />}
          // The label wraps inside the card: a long translation must not scroll the page sideways.
          className="h-auto min-h-8 max-w-full py-1.5 text-start whitespace-normal"
          loading={download.pending}
          onClick={() => void download.run({ tripId, unavailable })}
        >
          {t('modules.files.calendar.download.action')}
        </Button>
        <p className="text-caption text-ink-3">
          {t('modules.files.calendar.download.hint')}
        </p>
        {hasDates ? null : (
          <Alert tone="info">{t('modules.files.calendar.undated')}</Alert>
        )}
        {liveMounted ? (
          <Suspense
            fallback={
              <Button
                variant="secondary"
                size="sm"
                loading
                aria-label={t('modules.files.calendar.live.action')}
                autoFocus
              >
                {t('modules.files.calendar.live.action')}
              </Button>
            }
          >
            <LiveCalendar key={tripId} tripId={tripId} initialOpen />
          </Suspense>
        ) : (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setLiveMounted(true)}
          >
            {t('modules.files.calendar.live.action')}
          </Button>
        )}
        <p className="text-caption text-ink-3">
          {t('modules.files.calendar.timesNote')}
        </p>
      </div>
    </ModulePanel>
  )
}
