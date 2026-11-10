import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useI18n } from '#/lib/i18n'
import { cn } from '#/lib/cn'
import { buttonVariants } from '#/components/ui/button'
import { formatDate } from '#/lib/format'
import { mascotBand } from '../-lib/mascot-state'
import { createChatLauncher } from '../-lib/mascot-chat'
import type { TripCard } from '../-server/overview'

type Adapter = Parameters<typeof createChatLauncher>[0]

export function Mascot({
  trip,
  today,
  adapter,
  available = true,
  reduceMotion = false,
  prompt,
  promptDetails = true,
  partial = false,
  showEmpty = false,
  onRetry,
  onDismiss,
  onPromptFocus,
  onPromptBlur,
}: {
  trip: Pick<TripCard, 'id' | 'startDate' | 'endDate'> | null
  today: string
  adapter?: Adapter
  available?: boolean
  reduceMotion?: boolean
  prompt?: {
    id: string
    tripId?: string
    startDate: string
    source?: 'reservation' | 'event' | 'notification'
    action?: boolean
  } | null
  partial?: boolean
  showEmpty?: boolean
  onRetry?: () => Promise<boolean>
  promptDetails?: boolean
  onDismiss?: () => void
  onPromptFocus?: () => void
  onPromptBlur?: () => void
}) {
  const { t, locale } = useI18n()
  const panelId = useId()
  const launcher = useMemo(() => createChatLauncher(adapter), [adapter])
  const [panel, setPanel] = useState(false)
  const [busy, setBusy] = useState(false)
  const [paused, setPaused] = useState(true)
  const [ready, setReady] = useState(false)
  const [visible, setVisible] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const stage = useRef<HTMLDivElement>(null)
  useLayoutEffect(
    () => () => {
      if (stage.current?.contains(document.activeElement)) {
        queueMicrotask(() =>
          document
            .querySelector<HTMLAnchorElement>('[data-dashboard-create-trip]')
            ?.focus(),
        )
      }
    },
    [],
  )
  const promptFocused = useRef(false)
  const retryFocused = useRef(false)
  useLayoutEffect(() => {
    if (!partial && retryFocused.current) {
      retryFocused.current = false
      trigger.current?.focus()
    }
  }, [partial])
  useEffect(() => {
    if (!prompt && promptFocused.current) {
      promptFocused.current = false
      trigger.current?.focus()
      onPromptBlur?.()
    }
  }, [prompt, onPromptBlur])
  const state = trip
    ? mascotBand({ today, startDate: trip.startDate, endDate: trip.endDate })
    : null

  useLayoutEffect(() => () => launcher.cancel(), [launcher, trip?.id])

  useLayoutEffect(() => {
    launcher.setAvailable(available)
  }, [launcher, available])

  useEffect(() => {
    try {
      const preference = localStorage.getItem('planned.mascot')
      if (
        preference === null ||
        preference === 'playing' ||
        preference === 'paused'
      ) {
        setPaused(preference === 'paused')
        setReady(true)
      }
    } catch {
      setPaused(true)
    }
  }, [launcher])

  useEffect(() => {
    const update = () => setVisible(document.visibilityState === 'visible')
    update()
    document.addEventListener('visibilitychange', update)
    return () => document.removeEventListener('visibilitychange', update)
  }, [])

  useLayoutEffect(() => {
    if (!panel) return
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPanel(false)
        trigger.current?.focus()
      }
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [panel])

  async function openChat() {
    setBusy(true)
    const result = await launcher.open(
      trip ? { kind: 'trip', id: trip.id } : undefined,
    )
    setBusy(false)
    if (result === 'unavailable') setPanel(true)
    if (result === 'opened') setPanel(false)
  }

  function revealFocusedControl(element: HTMLElement) {
    if (typeof document.elementFromPoint !== 'function') return
    const rect = element.getBoundingClientRect()
    const target = document.elementFromPoint(
      rect.left + rect.width / 2,
      rect.top + rect.height / 2,
    )
    if (!target || !element.contains(target)) {
      element.scrollIntoView?.({ block: 'center', behavior: 'instant' })
    }
  }

  function togglePause() {
    const next = !paused
    setPaused(next)
    try {
      localStorage.setItem('planned.mascot', next ? 'paused' : 'playing')
      setReady(true)
    } catch {
      setPaused(true)
    }
  }

  let promptText = ''
  let promptLink = ''
  let promptLabel = ''
  if (prompt?.source === 'notification') {
    promptText = t(
      prompt.action
        ? 'shell.dashboard.mascot.actionNotification'
        : 'shell.dashboard.mascot.notification',
    )
    promptLink = '/notifications'
    promptLabel = t('shell.dashboard.mascot.openInbox')
  } else if (prompt) {
    const date = formatDate(prompt.startDate, locale) ?? prompt.startDate
    const event = prompt.source === 'event'
    promptText = t(
      event
        ? 'shell.dashboard.mascot.event'
        : 'shell.dashboard.mascot.reservation',
      { date },
    )
    promptLink = `/trips/${encodeURIComponent(prompt.tripId ?? '')}/${event ? 'plan' : 'book'}`
    promptLabel = t(
      event
        ? 'shell.dashboard.mascot.openEvent'
        : 'shell.dashboard.mascot.openReservation',
    )
  }

  return (
    <div ref={stage} className="relative" data-mascot-stage="">
      <button
        ref={trigger}
        type="button"
        data-dashboard-mascot-launcher=""
        aria-label={t('shell.dashboard.mascot.openChat')}
        aria-expanded={panel}
        aria-controls={panelId}
        aria-busy={busy}
        onFocus={(event) => revealFocusedControl(event.currentTarget)}
        onClick={() => void openChat()}
        className={cn(
          'pt-mascot-launcher relative flex h-32 w-full max-w-80 scroll-mb-24 flex-col items-start justify-end rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2',
          !state &&
            buttonVariants({ variant: 'secondary', shape: 'pill', size: 'sm' }),
        )}
      >
        {state ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 100 100"
            width="88"
            height="88"
            className="pt-mascot-bird pointer-events-none absolute start-0 top-0"
            data-band={state.band}
            data-moving={ready || undefined}
            data-paused={paused || undefined}
            data-reduced={reduceMotion || undefined}
            data-hidden={!visible || undefined}
          >
            <g className="origin-center rtl:scale-x-[-1]">
              <g className="pt-mascot-reaction">
                <g className="pt-mascot-pose">
                  <path
                    d="M28 64 L4 48 L15 70 L3 88 L33 75"
                    fill="var(--color-inverse-muted)"
                    stroke="var(--color-inverse-muted)"
                    strokeWidth="2"
                  />
                  <path
                    d="M22 66 Q29 40 59 42 Q76 41 82 56 Q82 75 55 78 Q32 80 22 66Z"
                    fill="var(--color-inverse-on)"
                    stroke="var(--color-inverse-muted)"
                    strokeWidth="2"
                  />
                  <path
                    d="M33 55 Q48 43 68 49 Q54 69 32 66 Q45 63 50 57Z"
                    fill="var(--color-inverse-brand)"
                    stroke="var(--color-inverse-muted)"
                    strokeWidth="2"
                  />
                  <path
                    d="M62 46 Q63 30 76 29 Q87 30 87 42 Q77 39 62 46Z"
                    fill="var(--color-inverse)"
                    stroke="var(--color-inverse-on)"
                    strokeWidth="1.5"
                  />
                  <path
                    d="M84 44 L98 48 L83 52Z"
                    fill="var(--color-inverse-brand)"
                  />
                  {state.band !== 'settled' ? (
                    <circle
                      cx="78"
                      cy="41"
                      r="2"
                      fill="var(--color-inverse-on)"
                    />
                  ) : null}
                  <path
                    d="M47 76 L45 86 M59 76 L62 86"
                    stroke="var(--color-inverse-brand)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  />
                  {state.band === 'travelling' ? (
                    <path
                      d="M28 60 V26 L45 30 L28 37"
                      fill="var(--color-inverse-brand)"
                      stroke="var(--color-inverse-muted)"
                      strokeWidth="2"
                    />
                  ) : null}
                  {state.band === 'eager' ? (
                    <path
                      d="M37 53 L27 27 L54 46"
                      fill="var(--color-inverse-brand)"
                      stroke="var(--color-inverse-muted)"
                      strokeWidth="2"
                    />
                  ) : null}
                  {state.band === 'settled' ? (
                    <path
                      d="M75 39 Q78 42 81 39"
                      fill="none"
                      stroke="var(--color-inverse-on)"
                      strokeWidth="2"
                    />
                  ) : null}
                  {state.band === 'drifting' ? (
                    <path
                      d="M14 24 Q20 18 26 24 M18 17 Q22 13 26 17"
                      fill="none"
                      stroke="var(--color-inverse-brand)"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  ) : null}
                  <path
                    d="M61 51 Q72 57 84 48 L86 56 Q73 64 60 57Z M66 58 L58 72 L70 69 L75 60"
                    fill="var(--color-brand)"
                    stroke="var(--color-inverse-brand)"
                    strokeWidth="1.5"
                  />
                </g>
              </g>
              <path
                d="M36 84 H68"
                stroke="var(--color-inverse-muted)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </g>
            {state.days === null ? null : (
              <g>
                <rect
                  x="7"
                  y="12"
                  width="22"
                  height="23"
                  rx="5"
                  fill="var(--color-inverse-brand)"
                />
                <text
                  x="18"
                  y="29"
                  textAnchor="middle"
                  fill="var(--color-inverse)"
                  fontSize="16"
                  fontWeight="bold"
                >
                  {state.days}
                </text>
              </g>
            )}
          </svg>
        ) : (
          t('shell.dashboard.mascot.openChat')
        )}
        {state ? (
          <span className="inline-flex min-h-11 items-center text-xs">
            {t('shell.dashboard.mascot.openChat')}
          </span>
        ) : null}
      </button>
      {state ? (
        <button
          type="button"
          aria-pressed={paused}
          aria-label={t('shell.dashboard.mascot.pause')}
          onFocus={(event) => revealFocusedControl(event.currentTarget)}
          onClick={togglePause}
          className={cn(
            buttonVariants({ variant: 'inverse', shape: 'pill', size: 'sm' }),
            'absolute start-0 top-32 min-h-11 w-28 scroll-mb-24 whitespace-normal',
          )}
        >
          {t('shell.dashboard.mascot.pause')}
        </button>
      ) : null}
      <div className="min-h-48 ps-32 sm:min-h-36">
        <p role="status" aria-live="polite">
          {showEmpty ? t('shell.dashboard.mascot.empty') : ''}
          {partial ? t('shell.dashboard.mascot.sourceUnavailable') : ''}
        </p>
        {prompt ? (
          <div
            className="basis-full"
            onFocus={() => {
              promptFocused.current = true
              onPromptFocus?.()
            }}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                promptFocused.current = false
                onPromptBlur?.()
              }
            }}
          >
            {promptDetails ? <p>{promptText}</p> : null}
            <a
              className="inline-flex min-h-11 min-w-11 scroll-mb-32 items-center underline focus-visible:outline-2 focus-visible:outline-offset-2"
              onFocus={(event) => revealFocusedControl(event.currentTarget)}
              href={promptLink}
            >
              {promptLabel}
            </a>
            <button
              type="button"
              onFocus={(event) => revealFocusedControl(event.currentTarget)}
              onClick={onDismiss}
              className="min-h-11 min-w-11 scroll-mb-32 px-2 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {t('ui.action.dismiss')}
            </button>
          </div>
        ) : null}
      </div>
      {partial ? (
        <div>
          <button
            type="button"
            className="min-h-11 min-w-11 scroll-mb-32 px-2 focus-visible:outline-2 focus-visible:outline-offset-2"
            onFocus={() => {
              retryFocused.current = true
            }}
            onBlur={() => {
              retryFocused.current = false
            }}
            onClick={() => void onRetry?.()}
          >
            {t('shell.dashboard.mascot.retry')}
          </button>
        </div>
      ) : null}
      {panel ? (
        <div
          id={panelId}
          className="mt-2 rounded-xl border border-current/20 p-4"
          role="region"
          aria-label={t('shell.dashboard.mascot.chatUnavailableTitle')}
        >
          <div role="status" aria-live="polite">
            <h2>{t('shell.dashboard.mascot.chatUnavailableTitle')}</h2>
          </div>
          <p className="mt-1 text-sm">
            {t('shell.dashboard.mascot.chatUnavailableBody')}
          </p>
          <a
            className="inline-flex min-h-11 min-w-11 scroll-mb-32 items-center underline focus-visible:outline-2 focus-visible:outline-offset-2"
            onFocus={(event) => revealFocusedControl(event.currentTarget)}
            href="/notifications"
          >
            {t('shell.dashboard.mascot.openInbox')}
          </a>
          <button
            type="button"
            onFocus={(event) => revealFocusedControl(event.currentTarget)}
            onClick={() => {
              setPanel(false)
              trigger.current?.focus()
            }}
            className="min-h-11 min-w-11 scroll-mb-32 px-2 focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            {t('ui.action.close')}
          </button>
        </div>
      ) : null}
    </div>
  )
}
