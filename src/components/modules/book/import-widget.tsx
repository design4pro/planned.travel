/**
 * The global import widget.
 *
 * It renders the jobs in the register — `./import-jobs` owns them, and polls them once however many
 * components show them — and sends the reader's two actions back: Check again, and Dismiss. Closing
 * the dialog that started an import, walking to another trip and reloading the page all leave the
 * work running and still visible here, because the widget is mounted in the application shell.
 */
import { useEffect, useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { FileSearch } from 'lucide-react'

import { Button, Card, Progress } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { isDismissible, useBookImports } from './import-jobs'

/** Long enough for the done state to be read and clicked, short enough not to be furniture. */
export const DONE_LINGER_MS = 12_000

/**
 * The shell's import notifier.
 *
 * Mounted once, last in the authenticated shell's subtree in `src/routes/_app/route.tsx`. It
 * renders nothing at all until a job is registered, so every screen in the product pays one empty
 * component for it — in the render and in the bundle: the job module imports the server only
 * dynamically, on the first ask, so its schema graph stays out of the shell's chunk.
 *
 * `userId` is the register's owner, a `bookImportsOwner` of the shell's account and
 * workspace, so it comes from the shell's session rather than from a read of its own — see
 * `bookImportsKey`.
 */
export function BookImportWidget({ userId }: { readonly userId: string }) {
  const t = useTranslate()
  const navigate = useNavigate()
  const { entries, jobs } = useBookImports(userId)
  const [dismissed, setDismissed] = useState<ReadonlyArray<string>>([])

  const shown = entries.filter((entry) => !dismissed.includes(entry.job.jobId))
  const working = shown.filter((entry) => entry.status === 'working')
  const stalled = shown.filter((entry) => entry.status === 'stalled')
  const ready = shown.filter((entry) => entry.status === 'ready')
  const refused = shown.filter((entry) => entry.status === 'refused')
  const settled = shown.length - working.length

  const first = ready.at(0)
  const done = working.length === 0 && stalled.length === 0 && ready.length > 0

  /*
   * The done state dismisses itself; the failed state does not. A failure nobody saw is a failure
   * that gets reported as lost data, so it stays until a reader takes it away — and a reader who
   * has already opened the review does not need the badge that told them to.
   */
  useEffect(() => {
    if (!done || first === undefined) {
      return
    }
    const timer = window.setTimeout(() => {
      setDismissed((previous) => [
        ...previous,
        ...ready.map((entry) => entry.job.jobId),
      ])
    }, DONE_LINGER_MS)
    return () => {
      window.clearTimeout(timer)
    }
    // The ready set is identified by its first job: the list is rebuilt on every register read, and
    // re-arming the timer on each one would keep the done state on screen indefinitely.
  }, [done, first?.job.jobId])

  if (shown.length === 0) {
    return null
  }

  const failure = refused.at(0)
  const reading = working.at(0)
  const total = shown.length

  return (
    /*
     * Above the "Report a problem" actor, not beside it.
     *
     * That actor is anchored to this same corner and mirrors with the text direction, and
     * `src/routes/__root.tsx` already writes down what happens when two floating controls share
     * pixels: one of them cannot be clicked. At `lg:bottom-6` it covered the Review button
     * outright, which the blind pair caught. The terms are the actor's own, as `#sentry-feedback`
     * in `src/styles/styles.css` sets them: its row starts at `1px + 4rem + var(--safe-bottom)`
     * below `lg` and at 0 above it, and it is a 2.5rem pill inside a 1rem inset. So clearing it is
     * that row plus 3.5rem, plus 1rem of air.
     */
    <div
      aria-live="polite"
      data-part="book-import-widget"
      className="fixed end-4 bottom-[calc(var(--safe-bottom)+8.5rem)] z-dropdown w-[min(20rem,calc(100vw-2rem))] lg:bottom-[4.5rem]"
    >
      <Card
        padding="sm"
        className="flex min-w-0 flex-col gap-3 shadow-elevated"
      >
        <p className="flex min-w-0 items-center gap-2">
          <FileSearch aria-hidden className="size-4 shrink-0 text-ink-3" />
          <span className="min-w-0 truncate text-label font-semibold text-ink">
            {t('modules.book.import.widget.title')}
          </span>
        </p>

        {failure !== undefined ? (
          <p className="min-w-0 text-caption text-danger">
            {t('modules.book.import.widget.failed', {
              filename: failure.job.filename,
            })}
          </p>
        ) : done ? (
          <p className="text-caption text-ink-2">
            {t('modules.book.import.widget.done', {
              count: ready.reduce((sum, entry) => sum + entry.count, 0),
            })}
          </p>
        ) : stalled.length > 0 ? (
          <p className="text-caption text-ink-2">
            {t('modules.book.import.widget.stalled')}
          </p>
        ) : (
          <>
            <Progress
              value={settled}
              max={total}
              size="sm"
              tone="brand"
              label={t('modules.book.import.widget.working', {
                done: settled,
                total,
              })}
            />
            {reading === undefined ? null : (
              <p className="min-w-0 truncate text-caption text-ink-3">
                {t('modules.book.import.widget.file', {
                  filename: reading.job.filename,
                })}
              </p>
            )}
          </>
        )}

        <div className="flex items-center justify-end gap-2">
          {stalled.length > 0 && failure === undefined ? (
            <Button
              variant="secondary"
              size="sm"
              shape="pill"
              onClick={() => {
                jobs.recheck()
              }}
            >
              {t('modules.book.import.widget.check')}
            </Button>
          ) : null}
          {/* A stalled job is dismissible too, unless rows are still on offer: see `isDismissible`. */}
          {shown.some(isDismissible) ? (
            <Button
              variant="ghost"
              size="sm"
              shape="pill"
              onClick={() => {
                jobs.dismiss()
              }}
            >
              {t('modules.book.import.widget.dismiss')}
            </Button>
          ) : null}
          {first === undefined ? null : (
            <Button
              variant="primary"
              size="sm"
              shape="pill"
              onClick={() => {
                void navigate({
                  to: '/trips/$tripId/book',
                  params: { tripId: first.job.tripId },
                  search: { import: first.job.jobId },
                })
              }}
            >
              {t('modules.book.import.widget.review')}
            </Button>
          )}
        </div>
      </Card>
    </div>
  )
}
