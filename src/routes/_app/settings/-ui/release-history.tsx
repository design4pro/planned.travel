import { useEffect, useRef, useState } from 'react'
import { Button, Card, Skeleton } from '#/components/ui'
import { useI18n } from '#/lib/i18n'
import { directionOf } from '#/lib/i18n/locales'
import { formatDate, formatNumber } from '#/lib/format'
import type {
  ReleaseHistoryInput,
  ReleaseHistoryPage,
} from '#/server/fns/-lib/release-history'

type Load = (input: ReleaseHistoryInput) => Promise<ReleaseHistoryPage>

/** Read-only list state lives here; storage and locale resolution remain in the shared repository. */
export function ReleaseHistory({ load }: { load: Load }) {
  const { t, locale } = useI18n()
  const [page, setPage] = useState<ReleaseHistoryPage>({
    items: [],
    nextCursor: null,
  })
  const [pending, setPending] = useState(true)
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState<number | null>(null)
  const heading = useRef<HTMLHeadingElement>(null)
  const older = useRef<HTMLButtonElement>(null)
  const retry = useRef<HTMLButtonElement>(null)
  const appended = useRef<HTMLHeadingElement>(null)
  const focus = useRef<'heading' | 'older' | 'appended' | 'retry' | null>(null)
  const firstAppended = useRef<string | null>(null)
  const busy = useRef(false)
  const generation = useRef(0)

  useEffect(() => {
    let active = true
    const current = ++generation.current
    setPending(true)
    setFailed(false)
    setPage({ items: [], nextCursor: null })
    setLoaded(null)
    busy.current = true
    void load({ locale })
      .then((result) => {
        if (active && current === generation.current) setPage(result)
      })
      .catch(() => {
        if (active && current === generation.current) setFailed(true)
      })
      .finally(() => {
        if (active && current === generation.current) {
          setPending(false)
          busy.current = false
        }
      })
    return () => {
      active = false
    }
  }, [locale, load])

  useEffect(() => {
    if (pending || !focus.current) return
    const target = focus.current
    focus.current = null
    if (target === 'retry') retry.current?.focus()
    else if (target === 'appended') appended.current?.focus()
    else if (target === 'older') older.current?.focus()
    else heading.current?.focus()
  }, [pending, page])

  async function readMore(isRetry: boolean) {
    if (busy.current) return
    busy.current = true
    const current = generation.current
    const cursor = page.nextCursor
    setLoaded(null)
    setPending(true)
    try {
      const result = await load({ locale, ...(cursor ? { cursor } : {}) })
      if (current !== generation.current) return
      firstAppended.current = result.items[0]?.version ?? null
      setPage((previous) => ({
        items: cursor ? [...previous.items, ...result.items] : result.items,
        nextCursor: result.nextCursor,
      }))
      setFailed(false)
      if (cursor) {
        setLoaded(result.items.length)
        focus.current = 'heading'
        if (result.items.length) focus.current = 'appended'
        if (result.nextCursor) focus.current = 'older'
      } else if (isRetry) focus.current = 'heading'
    } catch {
      if (current === generation.current) {
        focus.current = 'retry'
        setFailed(true)
      }
    } finally {
      if (current === generation.current) {
        busy.current = false
        setPending(false)
      }
    }
  }

  let announcement = ''
  if (pending) announcement = t('settings.releases.loading')
  else if (loaded !== null)
    announcement = t('settings.releases.loaded', {
      count: loaded,
      value: formatNumber(loaded, locale),
    })

  return (
    <section
      aria-labelledby="release-history-title"
      className="max-w-prose space-y-6"
    >
      <header>
        <h2
          id="release-history-title"
          ref={heading}
          tabIndex={-1}
          className="font-display text-title font-bold text-ink focus-ring"
        >
          {t('settings.releases.title')}
        </h2>
        <p className="mt-1 text-body text-ink-3">
          {t('settings.releases.description')}
        </p>
      </header>
      <p role="status" aria-live="polite" className="sr-only">
        {announcement}
      </p>
      {pending && page.items.length === 0 && !failed && (
        <ReleaseHistorySkeleton />
      )}
      {!pending && !failed && page.items.length === 0 && (
        <Card>
          <h3 className="text-label font-semibold text-ink">
            {t('settings.releases.empty.title')}
          </h3>
          <p className="mt-2 text-body text-ink-3">
            {t('settings.releases.empty.body')}
          </p>
        </Card>
      )}
      <div className="space-y-6" aria-busy={pending}>
        {page.items.map((item) => {
          const shipped = new Date(item.shippedAt).toISOString()
          const updated = item.updatedAt
            ? new Date(item.updatedAt).toISOString()
            : null
          return (
            <article
              key={item.version}
              lang={item.contentLocale}
              dir={directionOf(item.contentLocale)}
              className="rounded-xl border border-edge bg-surface p-5 sm:p-6"
            >
              <header className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
                <h3
                  ref={
                    item.version === firstAppended.current
                      ? appended
                      : undefined
                  }
                  tabIndex={-1}
                  className="text-subtitle font-semibold text-ink focus-ring"
                  lang={locale}
                  dir={directionOf(locale)}
                >
                  {t('settings.releases.version', { version: item.version })}
                </h3>
                <p
                  className="text-caption text-ink-3"
                  lang={locale}
                  dir={directionOf(locale)}
                >
                  <time dateTime={shipped}>
                    {t('settings.releases.shipped', {
                      date: formatDate(shipped, locale) ?? '',
                    })}
                  </time>
                </p>
              </header>
              {item.usedFallback && (
                <p
                  lang={locale}
                  dir={directionOf(locale)}
                  className="mt-3 text-caption text-ink-3"
                >
                  {t('settings.releases.fallback')}
                </p>
              )}
              <h4 className="mt-4 wrap-anywhere text-label font-semibold text-ink">
                {item.title}
              </h4>
              <div className="mt-2 space-y-3 text-body leading-relaxed text-ink-2">
                {item.summary.map((text, index) => (
                  <p key={index} className="wrap-anywhere">
                    {text}
                  </p>
                ))}
              </div>
              {(['features', 'fixes'] as const).map(
                (group) =>
                  item[group].length > 0 && (
                    <div key={group} className="mt-5">
                      <h4
                        lang={locale}
                        dir={directionOf(locale)}
                        className="text-label font-semibold text-ink"
                      >
                        {t(
                          group === 'features'
                            ? 'settings.releases.features'
                            : 'settings.releases.fixes',
                        )}
                      </h4>
                      <ul className="mt-2 list-disc space-y-2 ps-5 text-body leading-relaxed text-ink-2">
                        {item[group].map((text, index) => (
                          <li key={index} className="ps-1 wrap-anywhere">
                            {text}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ),
              )}
              {updated && (
                <p
                  lang={locale}
                  dir={directionOf(locale)}
                  className="mt-5 text-caption text-ink-3"
                >
                  <time dateTime={updated}>
                    {t('settings.releases.updated', {
                      date: formatDate(updated, locale) ?? '',
                    })}
                  </time>
                </p>
              )}
            </article>
          )
        })}
      </div>
      {failed && (
        <div
          role="alert"
          className="space-y-3 rounded-xl border border-edge bg-surface p-5"
        >
          <p className="text-body text-ink-2">
            {t(
              page.items.length
                ? 'settings.releases.olderError'
                : 'settings.releases.error',
            )}
          </p>
          <Button
            ref={retry}
            variant="secondary"
            disabled={pending}
            onClick={() => void readMore(true)}
          >
            {t('settings.releases.retry')}
          </Button>
        </div>
      )}
      {page.nextCursor && !failed && (
        <Button
          ref={older}
          variant="secondary"
          disabled={pending}
          onClick={() => void readMore(false)}
        >
          {t('settings.releases.older')}
        </Button>
      )}
    </section>
  )
}

function ReleaseHistorySkeleton() {
  return (
    <div aria-hidden="true" className="space-y-6">
      {[0, 1].map((key) => (
        <Card key={key} className="space-y-4">
          <Skeleton className="h-6 w-36" />
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-20 w-full" />
        </Card>
      ))}
    </div>
  )
}
