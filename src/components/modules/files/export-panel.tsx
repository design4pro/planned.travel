/**
 * The "Export the trip" panel on the Files screen: the exports a trip has, and a Download for each.
 *
 * The list is read after hydration, so the page itself never waits on a bucket listing and the reader
 * sees a skeleton, an empty state or an error of the panel's own. Requests reserve a unit and return before the artifact exists; polling follows its completion marker. Times are shown in the reader's own zone, in the same
 * `{date}, {time}` form the printable page's footer uses.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { FileDown } from 'lucide-react'

import { formatStorageSize } from '#/components/layout/storage-size'
import {
  Alert,
  Badge,
  Button,
  CheckboxField,
  Spinner,
  EmptyState,
  Skeleton,
  toast,
} from '#/components/ui'
import { cn } from '#/lib/cn'
import { zoneClockTime } from '#/lib/clock-zones'
import { formatDate, formatRelative } from '#/lib/format'
import { readPublicFailure } from '#/lib/errors'
import { useLocale, useTranslate } from '#/lib/i18n'
import { dayKeyIn, resolveTimeZone } from '#/lib/time'
import { listTripExportsFn, requestTripExportFn } from '#/server/fns/exports'
import { EXPORT_TTL_SECONDS } from '#/server/storage/export-artifacts'
import { useAction } from '../shared/use-action'
import { ModulePanel, ModuleRow } from '../shared/panel'
import { downloadTripExport } from './export-download'

import type { Locale } from '#/lib/i18n'
import type { TripExportList } from '#/server/fns/exports'

type ListState =
  | { readonly status: 'loading' }
  | { readonly status: 'error' }
  | {
      readonly status: 'ready'
      readonly list: TripExportList
      /** When the list arrived: the age column is measured from it, not from every render. */
      readonly at: number
    }

type Artifact = TripExportList['artifacts'][number]

const KEPT_DAYS = EXPORT_TTL_SECONDS / 86_400

/** One height for a skeleton row and a real one, so the list arriving moves nothing. */
const ROW = 'h-32 sm:h-24 flex-col items-start sm:flex-row sm:items-center'

const SKELETON_ROWS = 3
// The artifact is ready only after the queue writes its completion marker.
export const EXPORT_POLL_MS = 3000
export const EXPORT_POLL_WINDOW_MS = 90_000

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
  const noticeAfter = useRef('')
  const latest = useRef(0)
  const requestGeneration = useRef(0)
  const [includeReferences, setIncludeReferences] = useState(false)
  const [pending, setPending] = useState<{
    taskId: string
    slow: boolean
  } | null>(null)
  const [quota, setQuota] = useState<{
    limit: number
    resetsOn: string
  } | null>(null)
  const requestRef = useRef<HTMLButtonElement>(null)
  const pendingRef = useRef<HTMLDivElement>(null)
  const returnFocus = useRef(false)
  const [requestFocusDue, setRequestFocusDue] = useState(false)
  const exportRequest = useAction(requestTripExportFn, {
    invalidate: false,
    failure: t('modules.files.export.error.request'),
    fallback: t('modules.files.export.error.requestBody'),
  })

  const load = useCallback(async () => {
    latest.current += 1
    const request = latest.current
    try {
      const list = await listTripExportsFn({ data: { tripId } })
      if (!Array.isArray(list.artifacts)) {
        throw new Error('The list did not come back in a form we can show.')
      }
      if (request === latest.current) {
        setState({ status: 'ready', list, at: Date.now() })
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
    setPending(null)
    setQuota(null)
    setState({ status: 'loading' })
    void load()
    return () => {
      latest.current += 1
      requestGeneration.current += 1
    }
  }, [load])

  // Focus comes back once the control is enabled again, and only if the reader has not moved on.
  // The notice is spoken after that, because a screen reader cuts the sentence it is reading off
  // when focus moves.
  useEffect(() => {
    const target = focusAfter.current
    if (target === null || downloading !== null) {
      return
    }
    focusAfter.current = null
    const active = document.activeElement
    if (active === null || active === document.body) {
      ;(controls.current.get(target) ?? headingRef.current)?.focus()
    }
    // Replaces "Downloading ..." with the outcome sentence, or with nothing when it went well.
    setNotice(noticeAfter.current)
    noticeAfter.current = ''
  })

  // Focus changes only for the request and its completion, never for an ordinary poll.
  useEffect(() => {
    if (requestFocusDue && !exportRequest.pending) {
      if (
        document.activeElement === document.body ||
        document.activeElement === pendingRef.current
      ) {
        requestRef.current?.focus()
      }
      setRequestFocusDue(false)
    }
    if (pending !== null && !pending.slow && returnFocus.current) {
      pendingRef.current?.focus()
      returnFocus.current = false
      setNotice(t('modules.files.export.pending'))
    }
    if ((pending === null || pending.slow) && returnFocus.current) {
      if (
        document.activeElement === pendingRef.current ||
        document.activeElement === document.body
      ) {
        requestRef.current?.focus()
      }
      returnFocus.current = false
    }
  }, [pending, t, exportRequest.pending, requestFocusDue])

  useEffect(() => {
    if (pending === null || state.status !== 'ready') return
    if (
      state.list.artifacts.some(
        (artifact) => artifact.taskId === pending.taskId,
      )
    ) {
      const active = document.activeElement
      if (active === pendingRef.current || active === document.body) {
        requestRef.current?.focus()
        returnFocus.current = true
      }
      setPending(null)
      setNotice(t('modules.files.export.ready'))
    }
  }, [state, pending, t])

  useEffect(() => {
    if (pending === null || pending.slow) return
    let poll: ReturnType<typeof setInterval> | undefined
    let deadline: ReturnType<typeof setTimeout> | undefined
    const stop = () => {
      clearInterval(poll)
      clearTimeout(deadline)
    }
    const start = () => {
      stop()
      if (document.visibilityState === 'hidden') return
      poll = setInterval(() => {
        void load()
      }, EXPORT_POLL_MS)
      deadline = setTimeout(() => {
        stop()
        returnFocus.current = true
        setPending((previous) =>
          previous === null ? null : { ...previous, slow: true },
        )
        setNotice(t('modules.files.export.slow'))
      }, EXPORT_POLL_WINDOW_MS)
    }
    document.addEventListener('visibilitychange', start)
    start()
    return () => {
      stop()
      document.removeEventListener('visibilitychange', start)
    }
  }, [pending?.taskId, pending?.slow, load, t])

  async function askForExport() {
    setQuota(null)
    const generation = requestGeneration.current
    const result = await exportRequest.run({
      data: { tripId, notify: false, includeReferences },
    })
    if (generation !== requestGeneration.current) return
    if (result === null) {
      setRequestFocusDue(true)
      return
    }
    if (!result.ok) {
      setRequestFocusDue(true)
      setQuota(result)
      return
    }
    returnFocus.current = true
    setPending({ taskId: result.taskId, slow: false })
  }

  function retry() {
    setState({ status: 'loading' })
    headingRef.current?.focus()
    void load()
  }

  async function download(
    artifact: Artifact,
    canRequest: boolean,
    name: string,
  ) {
    setDownloading(artifact.taskId)
    // The button's own name hides the spinner's "working" text, so say it in the status region.
    setNotice(t('modules.files.status.downloadingOf', { name }))
    focusAfter.current = artifact.taskId
    let result: Awaited<ReturnType<typeof downloadTripExport>> | null = null
    try {
      result = await downloadTripExport({
        tripId,
        taskId: artifact.taskId,
        format: artifact.format,
      })
    } catch (cause) {
      // A refusal the server authored (no access any more) is shown. Anything else - offline, a
      // dropped stream, a platform error page - is a diagnostic, so only the title is shown.
      const failure = readPublicFailure(cause)
      toast.error(
        t('modules.files.toast.downloadFailed'),
        failure.kind !== 'unexpected' && failure.message !== undefined
          ? { description: failure.message }
          : undefined,
      )
    }

    if (result?.kind === 'missing') {
      noticeAfter.current = t(
        canRequest
          ? 'modules.files.export.error.missing'
          : 'modules.files.export.error.missingViewer',
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

        {state.status === 'ready' && state.list.canRequest ? (
          <div className="flex flex-col items-start gap-3 px-5 py-4">
            <Button
              ref={requestRef}
              data-part="export-request"
              loading={exportRequest.pending}
              disabled={
                exportRequest.pending || (pending !== null && !pending.slow)
              }
              onClick={() => void askForExport()}
            >
              {t('modules.files.export.request')}
            </Button>
            <CheckboxField
              checked={includeReferences}
              onCheckedChange={(checked) =>
                setIncludeReferences(checked === true)
              }
              label={t('modules.files.export.includeReferences')}
              description={t('modules.files.export.includeReferencesHint')}
            />
            {quota === null ? null : (
              <Alert tone="danger">
                {t('modules.files.export.quota', {
                  count: quota.limit,
                  date: formatDate(quota.resetsOn, locale) ?? quota.resetsOn,
                })}
              </Alert>
            )}
          </div>
        ) : null}
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

        {state.status === 'ready' &&
        state.list.artifacts.length === 0 &&
        pending === null ? (
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

        {state.status === 'ready' &&
        (state.list.artifacts.length > 0 || pending !== null) ? (
          <div role="list">
            {pending === null ||
            state.list.artifacts.some(
              (artifact) => artifact.taskId === pending.taskId,
            ) ? null : (
              <div
                ref={pendingRef}
                tabIndex={-1}
                role="listitem"
                data-state={pending.slow ? 'slow' : 'pending'}
                className={cn(ROW, 'flex gap-3 px-5 py-3 scroll-mt-24')}
              >
                {pending.slow ? null : (
                  <Spinner label={null} aria-hidden="true" />
                )}
                <span className="line-clamp-2 text-caption text-ink-2">
                  {t(
                    pending.slow
                      ? 'modules.files.export.slow'
                      : 'modules.files.export.pending',
                  )}
                </span>
                {pending.slow ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      headingRef.current?.focus()
                      void load()
                    }}
                  >
                    {t('modules.files.export.refresh')}
                  </Button>
                ) : null}
              </div>
            )}
            {state.list.artifacts.map((artifact) => {
              const when = madeAt(artifact.createdAt, locale, t)
              const age = formatRelative(
                new Date(artifact.createdAt).toISOString(),
                state.at,
                locale,
              )
              const { canRequest } = state.list
              return (
                <ModuleRow
                  key={artifact.taskId}
                  role="listitem"
                  className={cn(ROW, 'justify-between')}
                >
                  <div className="flex w-full min-w-0 flex-col gap-1 sm:w-auto sm:flex-1">
                    <span className="text-caption font-medium text-ink">
                      {t('modules.files.export.artifact', { date: when })}
                    </span>
                    <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-caption tabular-nums text-ink-3">
                      <Badge tone="neutral" size="sm">
                        {t(
                          artifact.format === 'pdf'
                            ? 'modules.files.export.format.pdf'
                            : 'modules.files.export.format.html',
                        )}
                      </Badge>
                      <span>
                        {formatStorageSize(artifact.sizeBytes, locale)}
                        {age === null ? '' : ` · ${age}`}
                      </span>
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
                    onClick={() =>
                      void download(
                        artifact,
                        canRequest,
                        t('modules.files.export.artifact', { date: when }),
                      )
                    }
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
