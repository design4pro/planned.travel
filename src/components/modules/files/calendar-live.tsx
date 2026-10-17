import { useEffect, useId, useRef, useState } from 'react'
import {
  Alert,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Skeleton,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
} from '#/components/ui'
import { useLocale, useTranslate } from '#/lib/i18n'
import { FEED_TRIP_CAP } from '#/lib/calendar/feeds'
import { formatRelative } from '#/lib/format'
import {
  loadCalendarFeedsFn,
  enableCalendarFeedFn,
  revokeCalendarFeedFn,
  rotateCalendarFeedFn,
} from '#/server/fns/calendar'
import { ConfirmDialog } from '../shared/controls'
import type { ConfirmRequest } from '../shared/controls'

type Feed = Awaited<ReturnType<typeof loadCalendarFeedsFn>>
type Revealed = Awaited<ReturnType<typeof enableCalendarFeedFn>>

/** The secret exists only in this mounted dialog session; state reloads never recover it. */
export function CalendarLive({
  tripId,
  initialOpen = false,
}: {
  tripId: string
  initialOpen?: boolean
}) {
  const t = useTranslate()
  const locale = useLocale()
  const id = useId()
  const [open, setOpen] = useState(initialOpen)
  const [loaded, setLoaded] = useState(false)
  const [selectedScope, setSelectedScope] = useState<'trip' | 'workspace'>(
    'trip',
  )
  const [feeds, setFeeds] = useState<Record<'trip' | 'workspace', Feed>>({
    trip: null,
    workspace: null,
  })
  const [links, setLinks] = useState<
    Record<'trip' | 'workspace', Revealed | null>
  >({ trip: null, workspace: null })
  const [copies, setCopies] = useState({ trip: false, workspace: false })
  const feed = feeds[selectedScope]
  const revealed = links[selectedScope]
  function setFeed(value: Feed) {
    setFeeds((current) => ({ ...current, [selectedScope]: value }))
  }
  function setRevealed(value: Revealed | null) {
    setLinks((current) => ({ ...current, [selectedScope]: value }))
  }
  function setCopied(value: boolean) {
    setCopies((current) => ({ ...current, [selectedScope]: value }))
  }
  const input =
    selectedScope === 'workspace'
      ? { tripId, scope: selectedScope }
      : { tripId }
  const [pending, setPending] = useState(false)
  const [rotating, setRotating] = useState(false)
  const [error, setError] = useState('')
  const [announcement, setAnnouncement] = useState('')
  const [confirmation, setConfirmation] = useState<
    'close' | 'off' | 'rotate' | null
  >(null)
  const [focusVersion, setFocusVersion] = useState(0)
  const focusReveal = useRef(false)
  const focusCreate = useRef(false)
  const focusTarget = useRef<HTMLElement | null>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const create = useRef<HTMLButtonElement>(null)
  const address = useRef<HTMLDivElement>(null)
  const alert = useRef<HTMLDivElement>(null)
  const beforeGuard = useRef<HTMLElement | null>(null)
  const clock = useRef(Date.now())
  const generation = useRef(0)
  const lastLoad = useRef(0)

  function focus(element: HTMLElement | null) {
    focusTarget.current = element
    setFocusVersion((value) => value + 1)
  }
  useEffect(() => {
    if (
      focusCreate.current &&
      create.current &&
      !pending &&
      confirmation === null
    ) {
      create.current.focus()
      focusCreate.current = false
      focusTarget.current = create.current
    }
  }, [focusVersion, pending, confirmation])
  useEffect(() => {
    if (!focusCreate.current) focusTarget.current?.focus()
  }, [focusVersion])
  useEffect(() => {
    if (!open) return
    setLoaded(false)
    let active = true
    const current = ++generation.current
    async function reload() {
      clock.current = Date.now()
      const request = ++lastLoad.current
      try {
        const state = await loadCalendarFeedsFn({ data: input })
        if (
          active &&
          current === generation.current &&
          request === lastLoad.current
        ) {
          setFeeds((currentFeeds) => ({
            ...currentFeeds,
            [selectedScope]: state,
          }))
          setLoaded(true)
        }
      } catch {
        if (active && request === lastLoad.current) {
          setError(t('modules.files.calendar.error.load'))
          setLoaded(true)
        }
      }
    }
    void reload()
    const onFocus = () => {
      void reload()
    }
    window.addEventListener('focus', onFocus)
    return () => {
      active = false
      generation.current++
      window.removeEventListener('focus', onFocus)
    }
  }, [open, tripId, selectedScope, t])
  useEffect(() => {
    if (error) focus(alert.current)
    else if (revealed) focus(address.current)
  }, [error, revealed])

  function close() {
    setConfirmation(null)
    setOpen(false)
    setLinks({ trip: null, workspace: null })
    setCopies({ trip: false, workspace: false })
    setAnnouncement('')
    setError('')
    setLoaded(false)
  }
  function changeOpen(next: boolean) {
    if (pending) return
    if (
      !next &&
      ((links.trip && !copies.trip) || (links.workspace && !copies.workspace))
    ) {
      beforeGuard.current =
        document.activeElement instanceof HTMLElement
          ? document.activeElement
          : null
      setConfirmation('close')
    } else if (!next) close()
    else setOpen(true)
  }
  async function reloadAfterChange() {
    clock.current = Date.now()
    const request = ++lastLoad.current
    try {
      const state = await loadCalendarFeedsFn({ data: input })
      if (request === lastLoad.current) {
        setFeeds((currentFeeds) => ({
          ...currentFeeds,
          [selectedScope]: state,
        }))
        setLoaded(true)
      }
      return { ok: true, state } as const
    } catch {
      if (request === lastLoad.current) {
        setFeed(null)
        setLoaded(false)
        setError(t('modules.files.calendar.error.load'))
      }
      return { ok: false } as const
    }
  }
  async function enable(action: 'enable' | 'rotate' = 'enable') {
    if (action === 'rotate' && !feed) return
    setRotating(action === 'rotate')
    lastLoad.current++
    setPending(true)
    setError('')
    setCopied(false)
    setAnnouncement('')
    try {
      const link =
        action === 'rotate' && feed
          ? await rotateCalendarFeedFn({ data: { feedId: feed.id } })
          : await enableCalendarFeedFn({ data: input })
      focusReveal.current = action === 'rotate' && confirmation === 'rotate'
      setConfirmation(null)
      setRevealed(link)
      setFeed({
        id: link.feedId,
        tripId: selectedScope === 'trip' ? tripId : null,
        on: true,
        lastServedAt: null,
      })
      await reloadAfterChange()
    } catch {
      setRevealed(null)
      const actual = await reloadAfterChange()
      setConfirmation(null)
      if (actual.ok)
        setError(
          t(
            action === 'rotate'
              ? 'modules.files.calendar.error.rotate'
              : 'modules.files.calendar.error.enable',
          ),
        )
    } finally {
      setPending(false)
      setRotating(false)
    }
  }
  function requestRotation() {
    focusReveal.current = false
    beforeGuard.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null
    if (feed?.lastServedAt != null) setConfirmation('rotate')
    else void enable('rotate')
  }
  async function revoke() {
    if (!feed) return
    lastLoad.current++
    setPending(true)
    setError('')
    try {
      await revokeCalendarFeedFn({ data: { feedId: feed.id } })
      setRevealed(null)
      setCopied(false)
      setConfirmation(null)
      const refreshed = await reloadAfterChange()
      if (refreshed.ok) {
        focusCreate.current = true
        setFocusVersion((value) => value + 1)
      }
    } catch {
      const actual = await reloadAfterChange()
      if (!actual.ok || !actual.state?.on) setRevealed(null)
      if (actual.ok) setError(t('modules.files.calendar.error.off'))
      setConfirmation(null)
    } finally {
      setPending(false)
    }
  }
  async function copy() {
    if (!revealed) return
    setAnnouncement('')
    try {
      await navigator.clipboard.writeText(revealed.url)
      setCopied(true)
      setAnnouncement(t('modules.files.calendar.link.copied'))
    } catch {
      setAnnouncement(t('modules.files.calendar.link.copyFailed'))
      address.current?.focus()
      if (address.current)
        window.getSelection()?.selectAllChildren(address.current)
    }
  }
  let request: ConfirmRequest | null = null
  if (confirmation === 'close')
    request = {
      title: t('modules.files.calendar.closeGuard.title'),
      description: t('modules.files.calendar.closeGuard.body'),
      confirmLabel: t('modules.files.calendar.closeGuard.confirm'),
      onConfirm: close,
    }
  if (confirmation === 'off')
    request = {
      title: t('modules.files.calendar.off.confirmTitle'),
      description: t(
        feed?.lastServedAt
          ? 'modules.files.calendar.off.confirmBody'
          : 'modules.files.calendar.off.confirmBodyUnused',
      ),
      confirmLabel: t('modules.files.calendar.off.confirm'),
      onConfirm: revoke,
    }
  if (confirmation === 'rotate')
    request = {
      title: t('modules.files.calendar.rotate.confirmTitle'),
      description: t('modules.files.calendar.rotate.confirmBody'),
      confirmLabel: t('modules.files.calendar.rotate.confirm'),
      onConfirm: () => enable('rotate'),
    }
  const on = feed?.on === true || revealed !== null
  const when = formatRelative(
    feed?.lastServedAt?.toISOString(),
    clock.current,
    locale,
  )

  return (
    <>
      <Button
        ref={trigger}
        variant="secondary"
        size="sm"
        onClick={() => changeOpen(true)}
      >
        {t('modules.files.calendar.live.action')}
      </Button>
      <Dialog open={open} onOpenChange={changeOpen}>
        <DialogContent
          onCloseAutoFocus={(event) => {
            event.preventDefault()
            trigger.current?.focus()
          }}
        >
          <Tabs
            className="min-h-0"
            value={selectedScope}
            activationMode="manual"
            onValueChange={(value) => {
              if (pending || (value !== 'trip' && value !== 'workspace')) return
              setError('')
              setAnnouncement('')
              setSelectedScope(value)
            }}
          >
            <DialogHeader>
              <DialogTitle>
                {t('modules.files.calendar.live.title')}
              </DialogTitle>
              <DialogDescription>
                <span id={`${id}-warning`}>
                  {selectedScope === 'workspace'
                    ? t('modules.files.calendar.workspace.warning', {
                        count: FEED_TRIP_CAP,
                      })
                    : t('modules.files.calendar.warning')}
                </span>
              </DialogDescription>
            </DialogHeader>
            <TabsList
              className="mx-6 shrink-0"
              aria-label={t('modules.files.calendar.live.title')}
            >
              <TabsTrigger value="trip" disabled={pending}>
                {t('modules.files.calendar.tab.trip')}
              </TabsTrigger>
              <TabsTrigger value="workspace" disabled={pending}>
                {t('modules.files.calendar.tab.workspace')}
              </TabsTrigger>
            </TabsList>
            <TabsContent
              value={selectedScope}
              className="mt-0 min-h-0 overflow-y-auto"
            >
              <div
                className="space-y-4 px-6 py-4"
                aria-busy={pending || !loaded}
              >
                {selectedScope === 'workspace' && (
                  <p className="text-caption text-ink-3">
                    {t('modules.files.calendar.workspace.nameNote')}
                  </p>
                )}
                {error && (
                  <Alert
                    ref={alert}
                    tone="danger"
                    role="alert"
                    tabIndex={-1}
                    className="focus-ring"
                  >
                    {error}
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setError('')
                        void reloadAfterChange()
                      }}
                      disabled={pending}
                    >
                      {t('modules.files.calendar.retry')}
                    </Button>
                  </Alert>
                )}
                {!revealed && (
                  <div className="min-h-36 space-y-3">
                    {!loaded && (
                      <div className="space-y-3">
                        <Skeleton className="h-8 w-full" />
                        <Skeleton className="h-8 w-full" />
                      </div>
                    )}
                    {loaded && !on && (
                      <Button
                        ref={create}
                        aria-describedby={`${id}-warning`}
                        loading={pending}
                        disabled={pending}
                        onClick={() => void enable()}
                      >
                        {t('modules.files.calendar.enable.action')}
                      </Button>
                    )}
                    {loaded && !revealed && on && (
                      <div className="space-y-3">
                        <p>{t('modules.files.calendar.state.on')}</p>
                        <p>
                          {when
                            ? t('modules.files.calendar.state.lastFetched', {
                                when,
                              })
                            : t('modules.files.calendar.state.neverFetched')}
                        </p>
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            disabled={pending}
                            onClick={requestRotation}
                            loading={rotating}
                            loadingLabel={t(
                              'modules.files.calendar.rotate.busy',
                            )}
                          >
                            {t('modules.files.calendar.rotate.action')}
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={pending}
                            onClick={() => {
                              beforeGuard.current =
                                document.activeElement as HTMLElement
                              setConfirmation('off')
                            }}
                          >
                            {t('modules.files.calendar.off.action')}
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {revealed && (
                  <div className="sentry-block space-y-3" data-sentry-block>
                    <p>{t('modules.files.calendar.link.once')}</p>
                    <p id={`${id}-address`}>
                      {t('modules.files.calendar.link.address')}
                    </p>
                    <div
                      ref={address}
                      role="region"
                      aria-labelledby={`${id}-address`}
                      tabIndex={-1}
                      dir="ltr"
                      translate="no"
                      className="rounded-md border p-3 font-mono text-sm break-all select-text focus-ring"
                    >
                      {revealed.url}
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button disabled={pending} onClick={() => void copy()}>
                        {t('modules.files.calendar.link.copy')}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={pending}
                        onClick={requestRotation}
                        loading={rotating}
                        loadingLabel={t('modules.files.calendar.rotate.busy')}
                      >
                        {t('modules.files.calendar.rotate.action')}
                      </Button>
                      <Button
                        variant="secondary"
                        disabled={pending}
                        onClick={() => {
                          beforeGuard.current =
                            document.activeElement as HTMLElement
                          setConfirmation('off')
                        }}
                      >
                        {t('modules.files.calendar.off.action')}
                      </Button>
                    </div>
                    <p aria-live="polite" role="status">
                      {announcement}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="ghost"
                        disabled={pending}
                        onClick={() => {
                          window.location.href = revealed.webcalUrl
                        }}
                      >
                        {t('modules.files.calendar.link.open')}
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={pending}
                        aria-label={`${t('modules.files.calendar.link.google')} (${t('modules.files.calendar.link.newTab')})`}
                        onClick={() =>
                          window.open(
                            `https://calendar.google.com/calendar/r?cid=${encodeURIComponent(revealed.webcalUrl)}`,
                            '_blank',
                            'noopener,noreferrer',
                          )
                        }
                      >
                        {t('modules.files.calendar.link.google')}
                      </Button>
                      <Button
                        variant="ghost"
                        disabled={pending}
                        aria-label={`${t('modules.files.calendar.link.outlook')} (${t('modules.files.calendar.link.newTab')})`}
                        onClick={() =>
                          window.open(
                            `https://outlook.live.com/calendar/0/addfromweb?url=${encodeURIComponent(revealed.url)}&name=${encodeURIComponent(revealed.tripTitle)}`,
                            '_blank',
                            'noopener,noreferrer',
                          )
                        }
                      >
                        {t('modules.files.calendar.link.outlook')}
                      </Button>
                    </div>
                    <p>{t('modules.files.calendar.link.fallback')}</p>
                  </div>
                )}
                <p className="text-caption text-ink-3">
                  {t('modules.files.calendar.link.stays')}
                </p>
                <p className="text-caption text-ink-3">
                  {t('modules.files.calendar.freshness')}
                </p>
              </div>
            </TabsContent>
            <DialogFooter>
              <Button disabled={pending} onClick={() => changeOpen(false)}>
                {t('modules.files.calendar.link.done')}
              </Button>
            </DialogFooter>
          </Tabs>
          <ConfirmDialog
            request={request}
            pending={pending}
            busyLabel={t(
              confirmation === 'rotate'
                ? 'modules.files.calendar.rotate.busy'
                : 'modules.files.calendar.off.busy',
            )}
            cancelLabel={
              confirmation === 'close'
                ? t('modules.files.calendar.closeGuard.cancel')
                : undefined
            }
            onOpenChange={(next) => {
              if (!next && !pending) setConfirmation(null)
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault()
              if (!open) trigger.current?.focus()
              else if (error) alert.current?.focus()
              else if (focusCreate.current) create.current?.focus()
              else if (focusReveal.current) address.current?.focus()
              else beforeGuard.current?.focus()
              focusReveal.current = false
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  )
}
