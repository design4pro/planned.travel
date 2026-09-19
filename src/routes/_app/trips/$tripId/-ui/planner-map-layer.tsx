/**
 * Dropping a pin on the planner's map, and what it becomes: a prefilled place form.
 *
 * One gesture with three entry points and one exit. A context-click drops at the pointed
 * coordinate; a single-finger press held still drops at the pressed one; and the add menu's
 * **Place it on the map** arms the map, after which a click — or `Enter`, at the centre of the
 * visible map — drops. Every drop then asks the geocoding proxy for the address beneath the point,
 * waits at most {@link LOOKUP_BUDGET_MS} for it behind a provisional pin, and hands the screen a
 * draft for the ordinary create form.
 *
 * Split in two because the map is not where the screen is. `usePlannerDrop` is called once in the
 * screen, which owns the form it opens; `PlannerMapLayer` is a child of `MapCanvas`, which is the
 * only place the map instance exists, and it holds the listeners, the banner and the pin.
 */

import * as React from 'react'
import { Crosshair, MapPin, X } from 'lucide-react'
import { toast } from 'sonner'

import { MapMarker, useMapInstance } from '#/components/map'
import { GlassPanel, IconButton } from '#/components/ui'
import { useLocale, useTranslate } from '#/lib/i18n'
import { reverseGeocodeFn } from '../-server/geocode'
import { emptyDraft } from './plan-actions'
import { placeWriteMessage } from './planner-add-place'

import type { PlaceDraft } from './plan-actions'

/** A press held this long without moving is a drop. */
export const LONG_PRESS_MS = 500
/** How far a press may wander, in CSS pixels, and still be a press rather than a pan. */
export const LONG_PRESS_TOLERANCE_PX = 10
/** How long the form waits for an address before it opens without one. */
export const LOOKUP_BUDGET_MS = 1500

export type DropState = 'idle' | 'armed' | 'dropping'

interface DropPoint {
  readonly lng: number
  readonly lat: number
}

/** Anything MapLibre hands back as a coordinate: an event's `lngLat`, `unproject`, `getCenter`. */
interface WrappableLngLat {
  wrap: () => DropPoint
}

export interface PlannerDrop {
  readonly state: DropState
  /** Whether a drop may be made at all: an editor, on a writable trip, not repositioning. */
  readonly editable: boolean
  /** Whether the map exists, which is when a drop can land. */
  readonly ready: boolean
  /** Where the provisional pin stands: from the drop until the form it opened closes. */
  readonly pin: DropPoint | null
  /** Arms the map; `Escape` or the banner's stop button hands focus back to `returnFocusTo`. */
  readonly arm: (returnFocusTo?: HTMLElement | null) => void
  readonly cancel: () => void
  readonly drop: (point: WrappableLngLat) => void
  /** Called by the layer as it mounts and unmounts. */
  readonly attach: (ready: boolean) => void
}

export interface UsePlannerDropOptions {
  readonly tripId: string
  readonly editable: boolean
  /** Whether the form a drop opened is still open; the provisional pin stands until it closes. */
  readonly formOpen: boolean
  readonly onDropped: (draft: PlaceDraft) => void
}

/** Six decimal places: ~11 cm, finer than any place needs and coarser than float noise. */
function round(value: number): number {
  return Math.round(value * 1e6) / 1e6
}

/** `promise`, or `null` once `ms` have passed; a later answer is dropped on the floor. */
function withinBudget<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(null), ms)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (cause: unknown) => {
        clearTimeout(timer)
        reject(cause)
      },
    )
  })
}

/**
 * The drop's state machine: `idle` → `armed` → `dropping` → the form, and back to `idle`.
 *
 * A trigger while `dropping` is ignored — on Android one long-press fires both the recogniser and
 * `contextmenu`, and the state, not a timing guard, is what makes that one drop. Every exit bumps
 * a sequence number, so an answer that arrives after a cancel, a newer drop or an unmount changes
 * nothing.
 */
export function usePlannerDrop({
  tripId,
  editable,
  formOpen,
  onDropped,
}: UsePlannerDropOptions): PlannerDrop {
  const t = useTranslate()
  const language = useLocale()

  const [state, setState] = React.useState<DropState>('idle')
  const [pin, setPin] = React.useState<DropPoint | null>(null)
  const [ready, setReady] = React.useState(false)

  const stateRef = React.useRef(state)
  stateRef.current = state
  const sequence = React.useRef(0)
  const returnFocus = React.useRef<HTMLElement | null>(null)
  const onDroppedRef = React.useRef(onDropped)
  onDroppedRef.current = onDropped

  const reset = React.useCallback(() => {
    sequence.current += 1
    setState('idle')
    setPin(null)
  }, [])

  const cancel = React.useCallback(() => {
    reset()
    const target = returnFocus.current
    returnFocus.current = null
    if (target?.isConnected === true) target.focus()
  }, [reset])

  const arm = React.useCallback(
    (returnFocusTo?: HTMLElement | null) => {
      if (!editable || stateRef.current !== 'idle') return
      returnFocus.current = returnFocusTo ?? null
      setState('armed')
    },
    [editable],
  )

  const drop = React.useCallback(
    (point: WrappableLngLat) => {
      if (!editable || stateRef.current === 'dropping') return
      const wrapped = point.wrap()
      const lng = round(wrapped.lng)
      const lat = round(wrapped.lat)

      const ticket = ++sequence.current
      returnFocus.current = null
      stateRef.current = 'dropping'
      setState('dropping')
      setPin({ lng, lat })

      void withinBudget(
        reverseGeocodeFn({ data: { tripId, lat, lng, language } }),
        LOOKUP_BUDGET_MS,
      ).then(
        (answer) => {
          if (ticket !== sequence.current) return
          setState('idle')
          onDroppedRef.current({
            ...emptyDraft,
            lat: String(lat),
            lng: String(lng),
            address: answer?.address ?? '',
          })
        },
        (cause: unknown) => {
          // Not a failed lookup — the proxy's refusals arrive as an empty address. This is a
          // refused request, so the pin is withdrawn and no form is opened for a write that
          // would be refused the same way.
          if (ticket !== sequence.current) return
          reset()
          toast.error(placeWriteMessage(cause, t('trips.plan.drop.error')))
        },
      )
    },
    [editable, language, reset, t, tripId],
  )

  // The provisional pin answers "here" until the form it opened is saved or dismissed; a saved
  // place then arrives through the screen's own markers.
  React.useEffect(() => {
    if (!formOpen) setPin(null)
  }, [formOpen])

  // Losing the right to drop — a trip archived mid-session, the reposition flow taking the click —
  // is an exit like any other.
  React.useEffect(() => {
    if (!editable) reset()
  }, [editable, reset])

  React.useEffect(
    () => () => {
      sequence.current += 1
    },
    [],
  )

  return React.useMemo(
    () => ({
      state,
      editable,
      ready,
      pin,
      arm,
      cancel,
      drop,
      attach: setReady,
    }),
    [state, editable, ready, pin, arm, cancel, drop],
  )
}

export interface PlannerMapLayerProps {
  readonly drop: PlannerDrop
  /** No mapped place yet — the map then names the gesture. */
  readonly empty: boolean
}

/**
 * The drop's listeners, banner, provisional pin and empty-map hint.
 *
 * Exactly one MapLibre listener, `contextmenu`, because it carries the coordinate. The long-press
 * and the keyboard are DOM listeners on the canvas container — one recogniser for mouse, pen and
 * touch, and no edit to the map's own event vocabulary.
 */
export function PlannerMapLayer({ drop, empty }: PlannerMapLayerProps) {
  const t = useTranslate()
  const map = useMapInstance()
  const dropRef = React.useRef(drop)
  dropRef.current = drop

  const { attach } = drop
  React.useEffect(() => {
    if (map === null) return
    attach(true)
    return () => attach(false)
  }, [attach, map])

  React.useEffect(() => {
    if (map === null) return
    const container = map.getCanvasContainer()
    container.setAttribute('data-part', 'planner-canvas')

    const onContextMenu = (event: {
      lngLat: WrappableLngLat
      preventDefault: () => void
    }): void => {
      if (!dropRef.current.editable) return
      event.preventDefault()
      dropRef.current.drop(event.lngLat)
    }

    let press: {
      readonly id: number
      readonly x: number
      readonly y: number
      readonly timer: ReturnType<typeof setTimeout> | null
    } | null = null

    const release = (): void => {
      if (press?.timer != null) clearTimeout(press.timer)
      press = null
    }

    const at = (x: number, y: number): WrappableLngLat => {
      const box = container.getBoundingClientRect()
      return map.unproject([x - box.left, y - box.top])
    }

    const onPointerDown = (event: PointerEvent): void => {
      if (press !== null) {
        // A second pointer is a pinch, not a press.
        release()
        return
      }
      if (!event.isPrimary || event.button !== 0) return
      if (!dropRef.current.editable) return
      const { clientX: x, clientY: y } = event
      press = {
        id: event.pointerId,
        x,
        y,
        // A held mouse button is the start of a pan; only a finger or a pen holds to drop.
        timer:
          event.pointerType === 'mouse'
            ? null
            : setTimeout(() => {
                press = null
                dropRef.current.drop(at(x, y))
              }, LONG_PRESS_MS),
      }
    }

    const onPointerMove = (event: PointerEvent): void => {
      if (press?.id !== event.pointerId) return
      const moved = Math.hypot(event.clientX - press.x, event.clientY - press.y)
      if (moved > LONG_PRESS_TOLERANCE_PX) release()
    }

    const onPointerUp = (event: PointerEvent): void => {
      if (press?.id !== event.pointerId) return
      const { x, y } = press
      release()
      // Armed, a click — any short press that did not pan — is the drop.
      if (dropRef.current.state === 'armed') dropRef.current.drop(at(x, y))
    }

    const onKeyDown = (event: KeyboardEvent): void => {
      const current = dropRef.current
      if (event.key === 'Escape' && current.state !== 'idle') {
        // The screen's window-level Escape clears the selection unless told otherwise.
        event.preventDefault()
        current.cancel()
        return
      }
      if (event.key === 'Enter' && current.state === 'armed') {
        event.preventDefault()
        current.drop(map.getCenter())
      }
    }

    map.on('contextmenu', onContextMenu)
    container.addEventListener('pointerdown', onPointerDown)
    container.addEventListener('pointermove', onPointerMove)
    container.addEventListener('pointerup', onPointerUp)
    container.addEventListener('pointercancel', release)
    container.addEventListener('keydown', onKeyDown)

    return () => {
      release()
      map.off('contextmenu', onContextMenu)
      container.removeEventListener('pointerdown', onPointerDown)
      container.removeEventListener('pointermove', onPointerMove)
      container.removeEventListener('pointerup', onPointerUp)
      container.removeEventListener('pointercancel', release)
      container.removeEventListener('keydown', onKeyDown)
      container.removeAttribute('data-part')
    }
  }, [map])

  const armed = drop.state === 'armed'
  React.useEffect(() => {
    if (map === null || !armed) return
    const canvas = map.getCanvas()
    canvas.style.cursor = 'crosshair'
    // The map region takes focus, so its arrow keys pan and `Enter` drops.
    canvas.focus()
    return () => {
      canvas.style.cursor = ''
    }
  }, [armed, map])

  return (
    <>
      {drop.pin === null ? null : (
        <MapMarker lng={drop.pin.lng} lat={drop.pin.lat} elevated>
          <span
            role="img"
            aria-label={t('trips.plan.drop.pin')}
            className="grid size-7 place-items-center rounded-full border-2 border-dashed border-accent motion-safe:animate-pop-in"
          >
            <span className="size-3 rounded-full bg-accent ring-3 ring-accent-on" />
          </span>
          {drop.state === 'dropping' ? (
            <span role="status" className="sr-only">
              {t('trips.plan.drop.lookingUp')}
            </span>
          ) : null}
        </MapMarker>
      )}

      {armed ? (
        <GlassPanel
          radius="full"
          padding="xs"
          role="status"
          aria-live="polite"
          className="absolute top-20 left-1/2 z-10 flex max-w-[calc(100%-7rem)] -translate-x-1/2 items-center gap-2 pe-1 ps-3"
        >
          <Crosshair
            size={14}
            strokeWidth={2}
            aria-hidden="true"
            className="shrink-0 text-brand"
          />
          <span className="min-w-0 text-caption text-ink-2">
            {t('trips.plan.drop.armed')}
          </span>
          <IconButton
            icon={<X />}
            label={t('trips.plan.drop.stop')}
            size="sm"
            variant="ghost"
            onClick={drop.cancel}
          />
        </GlassPanel>
      ) : empty && drop.editable && drop.state === 'idle' ? (
        <GlassPanel
          radius="full"
          padding="xs"
          className="pointer-events-none absolute top-20 left-1/2 z-10 flex max-w-[calc(100%-7rem)] -translate-x-1/2 items-center gap-2 px-3"
        >
          <MapPin
            size={14}
            strokeWidth={2}
            aria-hidden="true"
            className="shrink-0 text-ink-3"
          />
          <span className="min-w-0 text-caption text-ink-2">
            {t('trips.plan.drop.hint')}
          </span>
        </GlassPanel>
      ) : null}
    </>
  )
}
