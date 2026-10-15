/**
 * The "Export the trip" panel on the Files screen: the exports a trip has, and a Download for each.
 *
 * The list is read after hydration, so the page itself never waits on a bucket listing and the reader
 * sees a skeleton, an empty state or an error of the panel's own. Requesting an export is a later
 * slice; this panel only reads what exists. Times are shown in the reader's own zone, in the same
 * `{date}, {time}` form the printable page's footer uses.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { FileDown } from 'lucide-react'

import { formatStorageSize } from '#/components/layout/storage-size'
import {
  Alert,
  Badge,
  Button,
  EmptyState,
  Skeleton,
  toast,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import { zoneClockTime } from '#/lib/clock-zones'
import { formatDate, formatRelative } from '#/lib/format'
import { useLocale, useTranslate } from '#/lib/i18n'
import { dayKeyIn, resolveTimeZone } from '#/lib/time'
import { listTripExportsFn } from '#/server/fns/exports'
import { EXPORT_TTL_SECONDS } from '#/server/storage/export-artifacts'
import { ModulePanel, ModuleRow } from '../shared/panel'
import { downloadTripExport } from './export-download'

import type { Locale } from '#/lib/i18n'
import type { TripExportList } from '#/server/fns/exports'

type ListState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | { readonly status: 'ready'; readonly list: TripExportList }

type Artifact = TripExportList['artifacts'][number]

const KEPT_DAYS = EXPORT_TTL_SECONDS / 86_400

/** One height for a skeleton row and a real one, so the list arriving moves nothing. */
const ROW = 'min-h-16 flex-col items-start sm:flex-row sm:items-center'

const SKELETON_ROWS = 3

function browserZone(): string {
  return resolveTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone)
}

function madeAt(
  createdAt: number,
  locale: Locale,
  t: ReturnType<typeof useTranslate>,
): string {
  const zone = browserZone()
  const date = dayKeyIn(new Date(createdAt).toISOString(), zone)
  return t('modules.files.export.madeAt', {
    date: formatDate(date, locale) ?? date,
    time: zoneClockTime(zone, createdAt, locale) ?? '',
  })
}

function ExportSkeleton() {
  return (
    <div data-testid="export-skeleton" aria-busy="true">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <ModuleRow key={index} className={cn(ROW, 'justify-between')}>
          <div className="flex w-full min-w-0 flex-col gap-2">
            <Skeleton className="h-4 w-48 max-w-full" />
            <Skeleton className="h-3.5 w-32 max-w-full" />
          </div>
          <Skeleton className="h-9 w-28" radius="lg" />
        </ModuleRow>
      ))}
    </div>
  )
}

export function ExportPanel({ tripId }: { readonly tripId: string }) {
  const t = useTranslate()
  const locale = useLocale()
  const [state, setState] = useState<ListState>({ status: 'loading' })
  const [downloading, setDownloading] = useState<string | null>(null)
  const [notice, setNotice] = useState('')
  const headingRef = useRef<HTMLDivElement>(null)
  const controls = useRef(new Map<string, HTMLButtonElement>())
  const focusAfter = useRef<string | null>(null)
  const latest = useRef(0)

  const load = useCallback(async () => {
    latest.current += 1
    const request = latest.current
    try {
      const list = await listTripExportsFn({ data: { tripId } })
      if (request === latest.current) {
        setState({ status: 'ready', list })
      }
    } catch {
      // A failed re-read keeps the rows the reader already has.
      if (request === latest.current) {
        setState((previous) =>
          previous.status === 'ready' ? previous : { status: 'error' },
        )
      }
    }
  }, [tripId])

  useEffect(() => {
    void load()
    return () => {
      latest.current += 1
    }
  }, [load])

  // Focus comes back once the control is enabled again, and only if the reader has not moved on.
  useEffect(() => {
    const target = focusAfter.current
    if (target === null || downloading !== null) {
      return
    }
    focusAfter.current = null
    const active = document.activeElement
    if (active !== null && active !== document.body) {
      return
    }
    ;(controls.current.get(target) ?? headingRef.current)?.focus()
  })

  function retry() {
    setState({ status: 'loading' })
    headingRef.current?.focus()
    void load()
  }

  async function download(artifact: Artifact, canRequest: boolean) {
    setDownloading(artifact.taskId)
    setNotice('')
    focusAfter.current = artifact.taskId
    let result: Awaited<ReturnType<typeof downloadTripExport>> | null = null
    try {
      result = await downloadTripExport({ tripId, taskId: artifact.taskId })
    } catch {
      toast.error(t('modules.files.toast.downloadFailed'))
    }

    if (result?.kind === 'missing') {
      setNotice(
        t(
          canRequest
            ? 'modules.files.export.error.missing'
            : 'modules.files.export.error.missingViewer',
        ),
      )
      await load()
    } else if (result?.kind === 'failed') {
      toast.error(t('modules.files.toast.downloadFailed'), {
        description: t('modules.files.error.downloadFailed', {
          status: result.status,
        }),
      })
    } else if (result?.kind === 'shape') {
      toast.error(t('modules.files.toast.downloadFailed'), {
        description: t('modules.files.error.downloadShape'),
      })
    }
    setDownloading(null)
  }

  const now = Date.now()

  return (
    <div data-part="export-panel" className="min-w-0">
      <ModulePanel
        label={t('modules.files.export.label')}
        flush
        headingProps={{ ref: headingRef, tabIndex: -1 }}
      >
        <p className="px-5 pt-4 text-caption text-ink-3">
          {t('modules.files.export.description')}{' '}
          {t('modules.files.export.kept', { count: KEPT_DAYS })}
        </p>
        <div
          role="status"
          aria-live="polite"
          className="px-5 text-caption text-ink-2"
        >
          {notice}
        </div>

        {state.status === 'loading' ? <ExportSkeleton /> : null}

        {state.status === 'error' ? (
          <div className="p-5">
            <Alert
              tone="danger"
              actions={
                <Button size="sm" onClick={retry}>
                  {t('modules.files.export.retry')}
                </Button>
              }
            >
              {t('modules.files.export.error.list')}
            </Alert>
          </div>
        ) : null}

        {state.status === 'ready' && state.list.artifacts.length === 0 ? (
          <EmptyState
            icon={<FileDown />}
            title={t('modules.files.export.empty.title')}
            description={t(
              state.list.canRequest
                ? 'modules.files.export.empty.body'
                : 'modules.files.export.empty.bodyViewer',
            )}
          />
        ) : null}

        {state.status === 'ready' && state.list.artifacts.length > 0 ? (
          <div role="list">
            {state.list.artifacts.map((artifact) => {
              const when = madeAt(artifact.createdAt, locale, t)
              const age = formatRelative(
                new Date(artifact.createdAt).toISOString(),
                now,
                locale,
              )
              const { canRequest } = state.list
              return (
                <ModuleRow
                  key={artifact.taskId}
                  role="listitem"
                  className={cn(ROW, 'justify-between')}
                >
                  <div className="flex min-w-0 flex-col gap-0.5">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 truncate text-caption font-medium text-ink">
                        {t('modules.files.export.artifact', { date: when })}
                      </span>
                      <Badge tone="neutral" size="sm">
                        {t(
                          artifact.format === 'pdf'
                            ? 'modules.files.export.format.pdf'
                            : 'modules.files.export.format.html',
                        )}
                      </Badge>
                    </span>
                    <span className="text-caption tabular-nums text-ink-3">
                      {formatStorageSize(artifact.sizeBytes, locale)}
                      {age === null ? '' : ` · ${age}`}
                    </span>
                  </div>
                  <Button
                    ref={(node) => {
                      if (node === null) {
                        controls.current.delete(artifact.taskId)
                      } else {
                        controls.current.set(artifact.taskId, node)
                      }
                    }}
                    size="sm"
                    loading={downloading === artifact.taskId}
                    disabled={downloading !== null}
                    aria-label={t(
                      artifact.format === 'pdf'
                        ? 'modules.files.export.downloadLabelPdf'
                        : 'modules.files.export.downloadLabelHtml',
                      { date: when },
                    )}
                    onClick={() => void download(artifact, canRequest)}
                  >
                    {t('modules.files.export.download')}
                  </Button>
                </ModuleRow>
              )
            })}
          </div>
        ) : null}
      </ModulePanel>
    </div>
  )
}
