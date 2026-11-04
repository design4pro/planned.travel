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
  onDismiss,
  onPromptFocus,
  onPromptBlur,
}: {
  trip: Pick<TripCard, 'id' | 'startDate' | 'endDate'> | null
  today: string
  adapter?: Adapter
  available?: boolean
  reduceMotion?: boolean
  prompt?: { id: string; tripId: string; startDate: string } | null
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
  const promptFocused = useRef(false)
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

  return (
    <div className={cn('relative min-h-48 sm:min-h-36', !state && 'mx-6 mb-6')}>
      <button
        ref={trigger}
        type="button"
        aria-label={t('shell.dashboard.mascot.openChat')}
        aria-expanded={panel}
        aria-controls={panelId}
        aria-busy={busy}
        onFocus={(event) => revealFocusedControl(event.currentTarget)}
        onClick={() => void openChat()}
        className={cn(
          'absolute start-0 top-0 flex min-h-11 w-28 scroll-mb-24 flex-col items-center focus-visible:outline-2 focus-visible:outline-offset-2',
          !state &&
            buttonVariants({ variant: 'secondary', shape: 'pill', size: 'sm' }),
        )}
      >
        {state ? (
          <svg
            aria-hidden="true"
            viewBox="0 0 100 100"
            width="64"
            height="64"
            data-band={state.band}
            data-moving={ready || undefined}
            data-paused={paused || undefined}
            data-reduced={reduceMotion || undefined}
            data-hidden={!visible || undefined}
          >
            <g className="origin-center rtl:scale-x-[-1]">
              <path
                d="M20 66 L5 54 L13 74 L4 84 L29 75"
                fill="#dce6e4"
                stroke="#42595a"
                strokeWidth="2"
              />
              <path
                d="M20 66 Q29 38 59 42 Q76 43 80 58 Q79 74 55 77 Q32 81 20 66Z"
                fill="#f5f7f4"
                stroke="#42595a"
                strokeWidth="2"
              />
              <path
                d="M35 52 Q46 39 67 47 Q55 66 31 65 Z"
                fill="#b8ceca"
                stroke="#42595a"
                strokeWidth="2"
              />
              <path
                d="M62 46 Q63 30 76 29 Q87 30 87 42 Q77 39 62 46Z"
                fill="#203c3e"
              />
              <path d="M84 44 L98 48 L83 52Z" fill="#d05240" />
              <circle cx="78" cy="41" r="2" fill="#fff" />
              <path
                d="M47 76 L45 86 M59 76 L62 86"
                stroke="#d05240"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
              {state.band === 'travelling' ? (
                <path
                  d="M28 60 V26 L45 30 L28 37"
                  fill="#f6c95c"
                  stroke="#42595a"
                  strokeWidth="2"
                />
              ) : null}
              {state.band === 'eager' ? (
                <path
                  d="M37 53 L27 27 L54 46"
                  fill="#b8ceca"
                  stroke="#42595a"
                  strokeWidth="2"
                />
              ) : null}
              {state.band === 'settled' ? (
                <path
                  d="M75 39 Q78 42 81 39"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2"
                />
              ) : null}
              {state.band === 'drifting' ? (
                <path
                  d="M14 24 Q20 18 26 24 M18 17 Q22 13 26 17"
                  fill="none"
                  stroke="#b8ceca"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              ) : null}
              <path
                d="M36 84 H68"
                stroke="#42595a"
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
                  fill="#f6c95c"
                />
                <text
                  x="18"
                  y="29"
                  textAnchor="middle"
                  fill="#203c3e"
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
          <span className="text-xs">
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
            'absolute start-0 top-24 min-h-11 w-28 scroll-mb-24 whitespace-normal',
          )}
        >
          {t('shell.dashboard.mascot.pause')}
        </button>
      ) : null}
      <div className="min-h-48 ps-32 sm:min-h-36">
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
            {promptDetails ? (
              <p>
                {t('shell.dashboard.mascot.reservation', {
                  date:
                    formatDate(prompt.startDate, locale) ?? prompt.startDate,
                })}
              </p>
            ) : null}
            <a
              className="inline-flex min-h-11 min-w-11 scroll-mb-32 items-center underline focus-visible:outline-2 focus-visible:outline-offset-2"
              onFocus={(event) => revealFocusedControl(event.currentTarget)}
              href={`/trips/${encodeURIComponent(prompt.tripId)}/book`}
            >
              {t('shell.dashboard.mascot.openReservation')}
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
