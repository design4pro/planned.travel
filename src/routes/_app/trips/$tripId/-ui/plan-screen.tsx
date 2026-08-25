/**
 * The planner.
 *
 * One full-bleed map with the trip floating over it: the itinerary on the left, the
 * places on the right, the category filter across the top. Both rails fold away, and
 * folding one is *told to the camera* — the `fitBounds` padding shrinks with the rail,
 * which is what stops a pin from hiding behind glass the moment a panel opens.
 *
 * The screen owns three things the components below it deliberately do not:
 *
 * 1. **The optimistic arrangement.** `order` is the board's live state; every drag
 *    computes the next one with `movePlanItem`, renders it immediately, and rolls back
 *    to the previous one if the write fails. The loader's own order wins the moment it
 *    lands, so the optimistic copy can never drift.
 * 2. **Selection, in both directions.** A reducer, because "click a pin, highlight and
 *    scroll to its row" and "hover a row, ring its pin" are the same three pieces of
 *    state read from two ends. Hovering highlights; activating a row is what moves the
 *    camera — easing the map on every hover would be unusable.
 * 3. **The writes.** Every drag and every menu item lands on a server function that
 *    calls a repository. Nothing here builds a query, and each mutation is validated
 *    again on the server, because the client is never trusted with an order it did not
 *    have to earn.
 */

import * as React from 'react'
import { useRouter } from '@tanstack/react-router'
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core'
import { Crosshair, Layers, ListTree, Plus, X } from 'lucide-react'
import { toast } from 'sonner'

import { cn } from '#/lib/cn'
import {
  Button,
  GlassPanel,
  IconButton,
  SectionLabel,
  Sheet,
  SheetBody,
  SheetContent,
  SheetHeader,
  SheetTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '#/components/ui'
import {
  CategoryFilterBar,
  CoverageNotice,
  DayRoutes,
  FitBounds,
  FIT_MAX_ZOOM,
  FIT_MAX_ZOOM_UNMAPPED,
  MapAttribution,
  MapCanvas,
  MAP_CONTROLS_WIDTH,
  MapControls,
  PlaceMarkers,
  useArchiveCoverage,
  useMapInstance,
} from '#/components/map'
import {
  boundsForPoints,
  cameraMotion,
  expandBounds,
  prefersReducedMotion,
  tripLengthMetres,
} from '#/lib/map'
import {
  DaySection,
  DragPreview,
  IDEAS_CONTAINER,
  IdeasList,
  PlannerRail,
  initialSelection,
  itemsIn,
  movePlanItem,
  selectionReducer,
  usePlanDnd,
} from '#/components/planner'
import { pluralise } from '../../../-lib/format'
import {
  DeleteDialog,
  PlaceDialog,
  StopMenu,
  TimingDialog,
  draftFromPlace,
  emptyDraft,
  emptyTiming,
  messageOf,
} from './plan-actions'
import {
  filterRows,
  formatMetres,
  mapCategories,
  mapPlacesOf,
  orderFromPayload,
  planModel,
  routeDaysOf,
} from './plan-model'
import {
  createPlanPlaceFn,
  deletePlanPlaceFn,
  rankIdeasFn,
  reorderPlanFn,
  schedulePlaceFn,
  unschedulePlaceFn,
  updatePlanPlaceFn,
  updateStopFn,
} from '../-server/plan'

import type { MapPlace } from '#/components/map'
import type { LngLat, MapBounds } from '#/lib/map'
import type {
  PlacesScope,
  PlanChange,
  PlanOrder,
  PlanTarget,
  PlannerRow,
} from '#/components/planner'
import type { PlanBoardPayload } from '../-server/plan'
import type { PlaceFormValues, TimingDraft } from './plan-actions'

/* -------------------------------------------------------------------------------------------------
 * Layout constants
 * ---------------------------------------------------------------------------------------------- */

/** Rail widths, in pixels, so the camera padding and the CSS cannot disagree. */
const RAIL = { left: 344, right: 328, collapsed: 44, gutter: 16 } as const

/** Room the floating chrome needs kept clear above and below the pins. */
const CHROME = { top: 76, bottom: 76, mobileBottom: 132 } as const

/**
 * Where the zoom/locate/compass column is pinned, in pixels from the right edge.
 *
 * Three cases, because the column has to step aside for the places rail: it sits in
 * the gutter to the left of an open rail, tucks back to the map's own gutter when
 * that rail is folded, and moves up to the top-right on a phone, where a 150px-tall
 * toolbar at the bottom would sit straight through the action bar.
 *
 * Numbers rather than classes, because the camera needs them as numbers and the CSS
 * gets the very same ones through `--plan-controls`. Their width comes from
 * `MAP_CONTROLS_WIDTH`, published by the component that draws the column. Without
 * both halves in the camera's padding the map happily parks the easternmost cluster
 * underneath the geolocate button, and on the flagship trip the easternmost cluster
 * is Tokyo, so it happened every time.
 */
const CONTROLS = { mobile: 12, beside: 368, folded: 16 } as const

/** How much of the right edge the control column occupies, in one layout. */
function controlsInset(right: number): number {
  return right + MAP_CONTROLS_WIDTH + RAIL.gutter
}

/** Zoom a "take me there" from the rail settles on, if the map is further out. */
const FOCUS_ZOOM = 14.5

/**
 * The frame a trip with nothing mapped opens on.
 *
 * Not `WORLD_BOUNDS`: Mercator stretches the last few degrees toward the poles
 * without limit, so fitting ±85° spends most of the container on empty ice and
 * leaves the inhabited world postage-stamp sized. This is the part of the world
 * somebody might actually book a trip to, which fits a letterbox honestly.
 */
const UNPLANNED_WORLD_BOUNDS: MapBounds = {
  west: -168,
  south: -56,
  east: 178,
  north: 72,
}

/**
 * The mobile bottom stack, declared once.
 *
 * On a phone three things share the bottom edge: the action bar, the data credit
 * above it, and the coverage note above that. Publishing the two offsets as custom
 * properties keeps them in one place rather than as matching magic numbers in three
 * class strings — and the credit is a legal obligation, so "it ended up behind the
 * bar on a phone" is exactly the drift a repeated literal produces.
 */
type PlanVars = React.CSSProperties &
  Record<'--plan-bar' | '--plan-note' | '--plan-controls', string>
const PLAN_VARS: PlanVars = {
  /** Clears the action bar: 12px inset plus its own height. */
  '--plan-bar': 'calc(5.5rem + var(--safe-bottom))',
  /** Clears the credit pill above it. */
  '--plan-note': 'calc(7.75rem + var(--safe-bottom))',
  /** Where the control column sits on a phone. Overridden per layout below. */
  '--plan-controls': `${CONTROLS.mobile}px`,
}

/* -------------------------------------------------------------------------------------------------
 * Viewport
 * ---------------------------------------------------------------------------------------------- */

/**
 * True on a viewport wide enough for two floating rails.
 *
 * The rails and the mobile sheet render the *same* rows, and `@dnd-kit` keys its
 * draggables by row id, so mounting both at once would register every id twice.
 * Hence a real media-query read rather than two CSS-hidden copies.
 *
 * It starts `true` so a desktop first paint is already correct; the rails also carry
 * `hidden lg:flex`, which keeps them invisible during the single pre-effect frame on a
 * phone. Either way nothing reflows: the rails are absolute overlays.
 */
function useIsWide(): boolean {
  const [wide, setWide] = React.useState(true)

  React.useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)')
    const read = (): void => setWide(query.matches)
    read()
    query.addEventListener('change', read)
    return () => {
      query.removeEventListener('change', read)
    }
  }, [])

  return wide
}

/* -------------------------------------------------------------------------------------------------
 * Map behaviour
 * ---------------------------------------------------------------------------------------------- */

interface MapBehaviourProps {
  readonly cameraToken: number
  readonly cameraTarget: string | null
  readonly places: ReadonlyArray<MapPlace>
  readonly picking: boolean
  readonly onPick: (position: LngLat) => void
  readonly onBackgroundClick: () => void
}

/**
 * Camera moves and map clicks.
 *
 * Lives inside `MapCanvas` because that is where the map instance is, and it renders
 * nothing: a component is simply the cheapest way to get one effect into the map's
 * context without threading the instance back up through the screen.
 *
 * The camera is driven by a monotonic token rather than by the selected id, so
 * selecting the same row twice takes the reader there twice while a re-render never
 * moves the map at all. Every move goes through `cameraMotion()`, which collapses to a
 * single frame when the reader has asked for reduced motion.
 */
function MapBehaviour({
  cameraToken,
  cameraTarget,
  places,
  picking,
  onPick,
  onBackgroundClick,
}: MapBehaviourProps) {
  const map = useMapInstance()

  const placesRef = React.useRef(places)
  placesRef.current = places
  const targetRef = React.useRef(cameraTarget)
  targetRef.current = cameraTarget

  React.useEffect(() => {
    if (map === null || cameraToken === 0) return
    const target = targetRef.current
    if (target === null) return
    const place = placesRef.current.find((entry) => entry.id === target)
    if (place === undefined) return

    map.easeTo({
      center: [place.lng, place.lat],
      zoom: Math.max(map.getZoom(), FOCUS_ZOOM),
      ...cameraMotion(),
    })
  }, [cameraToken, map])

  const pickingRef = React.useRef(picking)
  pickingRef.current = picking
  const onPickRef = React.useRef(onPick)
  onPickRef.current = onPick
  const onBackgroundRef = React.useRef(onBackgroundClick)
  onBackgroundRef.current = onBackgroundClick

  React.useEffect(() => {
    if (map === null) return
    const handler = (event: { lngLat: { lng: number; lat: number } }): void => {
      if (pickingRef.current) {
        onPickRef.current([event.lngLat.lng, event.lngLat.lat])
        return
      }
      // Markers are DOM overlays, so a click that reaches the canvas is a click on
      // the map itself — which is the gesture for "never mind".
      onBackgroundRef.current()
    }
    map.on('click', handler)
    return () => {
      map.off('click', handler)
    }
  }, [map])

  React.useEffect(() => {
    if (map === null) return
    const canvas = map.getCanvas()
    canvas.style.cursor = picking ? 'crosshair' : ''
    return () => {
      canvas.style.cursor = ''
    }
  }, [map, picking])

  return null
}

/* -------------------------------------------------------------------------------------------------
 * Screen
 * ---------------------------------------------------------------------------------------------- */

type DialogState =
  | { readonly kind: 'create' }
  | { readonly kind: 'edit'; readonly placeId: string }
  | { readonly kind: 'timing'; readonly itemId: string }
  | { readonly kind: 'delete'; readonly placeId: string }
  | null

export interface PlanScreenProps {
  readonly payload: PlanBoardPayload
  /** Shown in the itinerary rail's footer, where a page header would have been. */
  readonly tripTitle: string
}

export function PlanScreen({ payload, tripTitle }: PlanScreenProps) {
  const router = useRouter()
  const wide = useIsWide()
  const editable = payload.editable

  /* ------------------------------------------------------------------ state */

  const serverOrder = React.useMemo(() => orderFromPayload(payload), [payload])
  const [order, setOrder] = React.useState<PlanOrder>(serverOrder)

  // The server's arrangement always wins. An optimistic order lives only for as long
  // as its write is in the air.
  React.useEffect(() => {
    setOrder(serverOrder)
  }, [serverOrder])

  const [selection, dispatch] = React.useReducer(
    selectionReducer,
    initialSelection,
  )
  const [query, setQuery] = React.useState('')
  const [categoryIds, setCategoryIds] = React.useState<ReadonlyArray<string>>([])
  const [leftCollapsed, setLeftCollapsed] = React.useState(false)
  const [rightCollapsed, setRightCollapsed] = React.useState(false)
  const [pending, setPending] = React.useState<ReadonlySet<string>>(new Set())
  const [dialog, setDialog] = React.useState<DialogState>(null)
  const [saving, setSaving] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [picking, setPicking] = React.useState<PlannerRow | null>(null)
  const [sheet, setSheet] = React.useState<'itinerary' | 'places' | null>(null)
  const [coverageHidden, setCoverageHidden] = React.useState(false)
  /**
   * Which slice the places rail lists.
   *
   * `all` by default, because on a trip where every place already has a day the
   * unplanned pile is empty — and a rail that is a quarter of the planner's width
   * has to earn that width on the common case, not the empty one. `unplanned`
   * stays one tap away, and it is still the drop target that unschedules a stop.
   */
  const [placeScope, setPlaceScope] = React.useState<PlacesScope>('all')

  /* ------------------------------------------------------------------ model */

  const model = React.useMemo(() => planModel(payload, order), [payload, order])

  const scheduledRows = React.useMemo(
    () => model.days.flatMap((day) => day.rows),
    [model.days],
  )

  const filters = React.useMemo(() => ({ query, categoryIds }), [query, categoryIds])
  const visibleIdeas = React.useMemo(
    () => filterRows(model.ideas, filters),
    [model.ideas, filters],
  )
  const visibleStops = React.useMemo(
    () => filterRows(scheduledRows, filters),
    [scheduledRows, filters],
  )
  /**
   * The rail's rows in `all` scope: every stop in day order, then the places with
   * no day yet. Scheduled first, so the list reads as the trip and the loose ends
   * collect at the bottom where they can be dragged onto a day.
   */
  const visiblePlaces = React.useMemo(
    () => [...visibleStops, ...visibleIdeas],
    [visibleStops, visibleIdeas],
  )
  const scopeCounts = React.useMemo(
    () => ({
      all: scheduledRows.length + model.ideas.length,
      unplanned: model.ideas.length,
    }),
    [scheduledRows.length, model.ideas.length],
  )

  const mapPlaces = React.useMemo(
    () =>
      mapPlacesOf([...visibleStops, ...visibleIdeas], model.dayNumberByPlace),
    [visibleStops, visibleIdeas, model.dayNumberByPlace],
  )

  const allPoints = React.useMemo<Array<LngLat>>(
    () =>
      mapPlacesOf(
        [...scheduledRows, ...model.ideas],
        model.dayNumberByPlace,
      ).map((place) => [place.lng, place.lat]),
    [scheduledRows, model.ideas, model.dayNumberByPlace],
  )

  /**
   * The camera the map is *created* with.
   *
   * Framing the trip at construction rather than easing to it afterwards is the
   * difference between a map that opens on the trip and a map that opens on Europe
   * and then flies to Japan. Held in a ref so a later render — a filter, a drag —
   * never re-frames the reader's own view; `FitBounds` owns every move after this.
   */
  const initialBoundsRef = React.useRef<MapBounds | null>(null)
  if (initialBoundsRef.current === null) {
    const tight = allPoints.length > 0 ? boundsForPoints(allPoints) : null
    // Expanded before it reaches the map: a trip with one mapped place is a
    // rectangle of zero area, and `fitBounds` on that snaps to maximum zoom — a
    // street corner where the reader expected a neighbourhood.
    //
    // Nothing mapped at all is framed on the world, as a *rectangle* rather than a
    // centre and a zoom: the map has to fit the whole thing into whatever shape the
    // container is, and a fixed zoom that shows every continent on a 1440px desktop
    // shows Europe and Africa on a 390px phone — which is the wrong-place-entirely
    // reading this frame exists to avoid.
    initialBoundsRef.current =
      tight === null ? UNPLANNED_WORLD_BOUNDS : expandBounds(tight)
  }
  const initialBounds = initialBoundsRef.current

  const routeDays = React.useMemo(() => routeDaysOf(model.days), [model.days])
  const walked = React.useMemo(() => tripLengthMetres(routeDays), [routeDays])
  const categories = React.useMemo(
    () => mapCategories(model.categories),
    [model.categories],
  )

  const categoryById = React.useMemo(
    () => new Map(model.categories.map((entry) => [entry.id, entry])),
    [model.categories],
  )
  const categoryFor = React.useCallback(
    (categoryId: string | null) =>
      categoryId === null ? undefined : categoryById.get(categoryId),
    [categoryById],
  )

  const placeById = React.useMemo(
    () => new Map(payload.places.map((place) => [place.id, place])),
    [payload.places],
  )
  const dayIdByPlace = React.useMemo(() => {
    const index = new Map<string, string>()
    for (const day of model.days) {
      for (const row of day.rows) index.set(row.placeId, day.dayId)
    }
    return index
  }, [model.days])

  const activeDayNumber = React.useMemo(() => {
    if (selection.dayId === null) return null
    return (
      model.days.find((day) => day.dayId === selection.dayId)?.dayNumber ?? null
    )
  }, [model.days, selection.dayId])

  const placeOfItem = React.useCallback(
    (itemId: string) => model.rowsByItem.get(itemId)?.placeId ?? null,
    [model.rowsByItem],
  )

  /* ------------------------------------------------------------------ camera */

  /** Where the control column is pinned in the current layout, in pixels. */
  const controlsRight = wide
    ? rightCollapsed
      ? CONTROLS.folded
      : CONTROLS.beside
    : CONTROLS.mobile

  /**
   * The mobile stack plus this layout's control offset, in one style object — the
   * offset is the only one of the three that changes as rails fold.
   */
  const planVars: PlanVars = {
    ...PLAN_VARS,
    '--plan-controls': `${controlsRight}px`,
  }

  const padding = React.useMemo(() => {
    if (!wide) {
      return {
        top: CHROME.top,
        bottom: CHROME.mobileBottom,
        left: RAIL.gutter * 2,
        right: controlsInset(controlsRight),
      }
    }
    return {
      top: CHROME.top,
      bottom: CHROME.bottom,
      left: (leftCollapsed ? RAIL.collapsed : RAIL.left) + RAIL.gutter * 2,
      // Whichever reaches further into the map: the rail, or the control column
      // parked in the gutter beside it.
      right: Math.max(
        (rightCollapsed ? RAIL.collapsed : RAIL.right) + RAIL.gutter * 2,
        controlsInset(controlsRight),
      ),
    }
  }, [controlsRight, leftCollapsed, rightCollapsed, wide])

  /* ------------------------------------------------------------------ writes */

  const markPending = React.useCallback(
    (itemId: string, busy: boolean): void => {
      setPending((current) => {
        const next = new Set(current)
        if (busy) next.add(itemId)
        else next.delete(itemId)
        return next
      })
    },
    [],
  )

  const applyChange = React.useCallback(
    async (change: PlanChange): Promise<void> => {
      switch (change.kind) {
        case 'reorder':
          await reorderPlanFn({
            data: {
              tripId: payload.tripId,
              days: change.days.map((day) => ({
                dayId: day.dayId,
                assignmentIds: [...day.assignmentIds],
              })),
            },
          })
          return
        case 'schedule':
          await schedulePlaceFn({
            data: {
              tripId: payload.tripId,
              placeId: change.placeId,
              dayId: change.dayId,
              index: change.index,
            },
          })
          return
        case 'unschedule':
          await unschedulePlaceFn({
            data: {
              tripId: payload.tripId,
              assignmentId: change.assignmentId,
            },
          })
          return
        case 'rank-ideas':
          await rankIdeasFn({
            data: { tripId: payload.tripId, placeIds: [...change.placeIds] },
          })
          return
      }
    },
    [payload.tripId],
  )

  /**
   * Applies a move optimistically, then writes it.
   *
   * The rollback restores the arrangement the board had *before* this move rather
   * than recomputing an inverse, which is the only version that stays correct when
   * two drags overlap.
   */
  const commitMove = React.useCallback(
    (itemId: string, target: PlanTarget): void => {
      if (!editable) return

      const result = movePlanItem(order, itemId, target, { placeOfItem })
      if (!result.ok) {
        if (result.reason === 'duplicate') {
          const name = model.rowsByItem.get(itemId)?.name ?? 'That place'
          toast.error(`${name} is already on that day`, {
            description:
              'A place can only appear once per day. Move it to another day instead.',
          })
        }
        return
      }

      const previous = order
      setOrder(result.order)
      markPending(itemId, true)

      void applyChange(result.change)
        .then(() => router.invalidate())
        .catch((cause: unknown) => {
          setOrder(previous)
          toast.error('That move did not save', {
            description: messageOf(cause, 'Try it again in a moment.'),
          })
        })
        .finally(() => {
          markPending(itemId, false)
        })
    },
    [
      applyChange,
      editable,
      markPending,
      model.rowsByItem,
      order,
      placeOfItem,
      router,
    ],
  )

  /* ---------------------------------------------------------------- dragging */

  /**
   * The board's drag wiring — sensors, announcements, the drop resolution.
   *
   * Lives in `usePlanDnd` rather than here because a keyboard drag is four events
   * and four announcements deep, and none of that is reachable from a test that
   * would first have to stand up a map, a router and a trip.
   */
  const dnd = usePlanDnd({
    order,
    rowsByItem: model.rowsByItem,
    days: model.days,
    onMove: commitMove,
  })

  const draggingRow =
    dnd.draggingId === null ? undefined : model.rowsByItem.get(dnd.draggingId)

  /* -------------------------------------------------------------- selection */

  const selectRow = React.useCallback(
    (row: PlannerRow): void => {
      dispatch({
        type: 'row-click',
        placeId: row.placeId,
        dayId: dayIdByPlace.get(row.placeId) ?? null,
      })
    },
    [dayIdByPlace],
  )

  const hoverRow = React.useCallback(
    (row: PlannerRow, hovering: boolean): void => {
      dispatch(
        hovering
          ? {
              type: 'hover-in',
              placeId: row.placeId,
              dayId: dayIdByPlace.get(row.placeId) ?? null,
            }
          : { type: 'hover-out', placeId: row.placeId },
      )
    },
    [dayIdByPlace],
  )

  /** The hover card's second line: which day this pin is on, and when. */
  const metaFor = React.useCallback(
    (place: MapPlace): string => {
      if (place.dayNumber === null) return 'Not scheduled yet'
      const time = model.rowsByPlace.get(place.id)?.time
      return time === null || time === undefined
        ? `Day ${place.dayNumber}`
        : `Day ${place.dayNumber} · ${time}`
    },
    [model.rowsByPlace],
  )

  const selectPin = React.useCallback(
    (place: MapPlace): void => {
      dispatch({
        type: 'pin-click',
        placeId: place.id,
        dayId: dayIdByPlace.get(place.id) ?? null,
      })
    },
    [dayIdByPlace],
  )

  // A pin reports its own arrival but only a bare `null` on departure, so the id it
  // is leaving has to be remembered here — dispatching a blank one would be silently
  // ignored by the reducer's own out-of-order guard and the ring would stick.
  const hoveredPin = React.useRef<string | null>(null)
  const hoverPin = React.useCallback((place: MapPlace | null): void => {
    if (place === null) {
      const left = hoveredPin.current
      hoveredPin.current = null
      if (left !== null) dispatch({ type: 'hover-out', placeId: left })
      return
    }
    hoveredPin.current = place.id
    dispatch({ type: 'hover-in', placeId: place.id })
  }, [])

  // Clicking a pin scrolls its row into view. Queried rather than held in a ref
  // registry: one selector against the rail beats forty refs that all have to be
  // kept in step with an optimistic reorder.
  const railRef = React.useRef<HTMLDivElement | null>(null)
  React.useEffect(() => {
    const placeId = selection.placeId
    if (placeId === null) return
    const row = railRef.current?.querySelector(
      `[data-planner-place=${JSON.stringify(placeId)}]`,
    )
    row?.scrollIntoView({
      block: 'nearest',
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
    })
  }, [selection.placeId])

  // Escape lets go of everything, which is the one keyboard gesture a map screen
  // always owes the reader.
  React.useEffect(() => {
    const onKeyDown = (event: KeyboardEvent): void => {
      if (event.key !== 'Escape') return
      // A keyboard drag owns Escape while it is in flight: `@dnd-kit` cancels the
      // drag from the document and marks the event handled. Clearing the selection
      // as well would take the reader's place on the map away as the price of
      // backing out of a move they never completed.
      if (dnd.draggingId !== null || event.defaultPrevented) return
      if (picking !== null) {
        setPicking(null)
        return
      }
      dispatch({ type: 'clear' })
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [dnd.draggingId, picking])

  /* ------------------------------------------------------------------ forms */

  const closeDialog = React.useCallback((): void => {
    setDialog(null)
    setFormError(null)
  }, [])

  const runWrite = React.useCallback(
    async (
      work: () => Promise<unknown>,
      options: { readonly fallback: string; readonly success?: string },
    ): Promise<boolean> => {
      setSaving(true)
      setFormError(null)
      try {
        await work()
        await router.invalidate()
        if (options.success !== undefined) toast.success(options.success)
        return true
      } catch (cause) {
        setFormError(messageOf(cause, options.fallback))
        return false
      } finally {
        setSaving(false)
      }
    },
    [router],
  )

  const submitPlace = React.useCallback(
    (values: PlaceFormValues): void => {
      const editing = dialog?.kind === 'edit' ? dialog.placeId : null

      void runWrite(
        async () => {
          if (editing === null) {
            await createPlanPlaceFn({
              data: { tripId: payload.tripId, ...values },
            })
            return
          }
          await updatePlanPlaceFn({
            data: {
              tripId: payload.tripId,
              placeId: editing,
              name: values.name,
              city: values.city,
              address: values.address,
              categoryId: values.categoryId,
              durationMinutes: values.durationMinutes,
              rating: values.rating,
              lat: values.lat,
              lng: values.lng,
              isVisited: values.isVisited,
            },
          })
        },
        {
          fallback: 'The place could not be saved. Try again in a moment.',
          success: editing === null ? 'Place added' : 'Place updated',
        },
      ).then((ok) => {
        if (ok) closeDialog()
      })
    },
    [closeDialog, dialog, payload.tripId, runWrite],
  )

  const submitTiming = React.useCallback(
    (values: TimingDraft): void => {
      if (dialog?.kind !== 'timing') return
      const assignmentId = dialog.itemId

      void runWrite(
        () =>
          updateStopFn({
            data: {
              tripId: payload.tripId,
              assignmentId,
              startTime: values.startTime,
              endTime: values.endTime,
              durationMinutes: values.durationMinutes,
              notes: values.notes,
              reservationStatus: values.reservationStatus,
            },
          }),
        {
          fallback: 'The times could not be saved. Try again in a moment.',
          success: 'Times saved',
        },
      ).then((ok) => {
        if (ok) closeDialog()
      })
    },
    [closeDialog, dialog, payload.tripId, runWrite],
  )

  const confirmDelete = React.useCallback((): void => {
    if (dialog?.kind !== 'delete') return
    const placeId = dialog.placeId

    void runWrite(
      () => deletePlanPlaceFn({ data: { tripId: payload.tripId, placeId } }),
      {
        fallback: 'The place could not be deleted. Try again in a moment.',
        success: 'Place deleted',
      },
    ).then((ok) => {
      if (ok) {
        dispatch({ type: 'forget', placeId })
        closeDialog()
      }
    })
  }, [closeDialog, dialog, payload.tripId, runWrite])

  const savePosition = React.useCallback(
    (position: LngLat): void => {
      const row = picking
      if (row === null) return
      const place = placeById.get(row.placeId)
      if (place === undefined) return
      setPicking(null)

      void runWrite(
        () =>
          updatePlanPlaceFn({
            data: {
              tripId: payload.tripId,
              placeId: place.id,
              name: place.name,
              city: place.city ?? '',
              address: place.address ?? '',
              categoryId: place.categoryId ?? '',
              durationMinutes: place.durationMinutes,
              rating: place.rating ?? 0,
              lng: Number(position[0].toFixed(6)),
              lat: Number(position[1].toFixed(6)),
              isVisited: place.isVisited,
            },
          }),
        {
          fallback: 'The pin could not be moved. Try again in a moment.',
          success: `${place.name} pinned`,
        },
      ).then((ok) => {
        if (ok) {
          dispatch({
            type: 'pin-click',
            placeId: place.id,
            dayId: dayIdByPlace.get(place.id) ?? null,
          })
        }
      })
    },
    [dayIdByPlace, payload.tripId, picking, placeById, runWrite],
  )

  /* ------------------------------------------------------------- row actions */

  const rowActions = React.useCallback(
    (row: PlannerRow): React.ReactNode => {
      if (!editable) return undefined
      return (
        <StopMenu
          row={row}
          days={payload.days}
          disabled={pending.has(row.itemId)}
          onEditPlace={() =>
            setDialog({ kind: 'edit', placeId: row.placeId })
          }
          onEditTiming={() => {
            if (row.assignmentId !== null) {
              setDialog({ kind: 'timing', itemId: row.assignmentId })
            }
          }}
          onPickPosition={() => {
            setPicking(row)
            setSheet(null)
          }}
          onMoveToDay={(dayId) =>
            // The same code path a drag takes, so the menu and the pointer cannot
            // disagree about what "move to day 4" means.
            commitMove(row.itemId, {
              container: dayId,
              index: (itemsIn(order, dayId) ?? []).length,
            })
          }
          onUnschedule={() =>
            commitMove(row.itemId, {
              container: IDEAS_CONTAINER,
              index: 0,
            })
          }
          onDelete={() => setDialog({ kind: 'delete', placeId: row.placeId })}
        />
      )
    },
    [commitMove, editable, order, payload.days, pending, placeOfItem],
  )

  /* ------------------------------------------------------------------ panels */

  const itinerary = (
    <div ref={railRef} className="flex flex-col gap-1">
      {model.days.length === 0 ? (
        <div className="px-2 py-6 text-center">
          <SectionLabel as="h3" className="justify-center">
            No days yet
          </SectionLabel>
          <p className="mt-2 text-caption text-ink-3">
            Give {tripTitle} a departure and a return date and one column per day
            appears here, ready for the places you have collected.
          </p>
        </div>
      ) : (
        model.days.map((day) => (
          <DaySection
            key={day.dayId}
            day={day}
            categoryFor={categoryFor}
            active={day.dayId === selection.dayId}
            selectedPlaceId={selection.placeId}
            hoveredPlaceId={selection.hoverId}
            pendingItemIds={pending}
            draggable={editable}
            onFocusDay={() =>
              dispatch({
                type: 'focus-day',
                dayId: selection.dayId === day.dayId ? null : day.dayId,
              })
            }
            onSelectRow={selectRow}
            onHoverRow={hoverRow}
            rowActions={rowActions}
          />
        ))
      )}
    </div>
  )

  const ideas = (
    <IdeasList
      scope={placeScope}
      onScopeChange={setPlaceScope}
      scopeCounts={scopeCounts}
      rows={placeScope === 'all' ? visiblePlaces : visibleIdeas}
      total={placeScope === 'all' ? scopeCounts.all : model.ideas.length}
      categoryFor={categoryFor}
      query={query}
      onQueryChange={setQuery}
      selectedPlaceId={selection.placeId}
      hoveredPlaceId={selection.hoverId}
      pendingItemIds={pending}
      draggable={editable}
      onSelectRow={selectRow}
      onHoverRow={hoverRow}
      rowActions={rowActions}
    />
  )

  const addButton = editable ? (
    <Button
      variant="primary"
      shape="pill"
      size="sm"
      block
      icon={<Plus strokeWidth={2.5} />}
      onClick={() => setDialog({ kind: 'create' })}
    >
      Add a place
    </Button>
  ) : null

  const railFooter = (
    <div className="flex flex-col gap-1">
      <p className="text-caption tabular-nums text-ink-2">
        {pluralise(model.scheduledCount, 'stop')} ·{' '}
        {pluralise(model.days.length, 'day')}
        {walked > 0 ? ` · ${formatMetres(walked)} between stops` : ''}
      </p>
      <p className="text-caption text-ink-4">
        {editable
          ? 'Pins carry the day they belong to. Drag a row to move it.'
          : 'This trip is archived, so the plan is read-only.'}
      </p>
    </div>
  )

  /* ------------------------------------------------------------------ render */

  return (
    <DndContext
      // dnd-kit numbers its contexts from a module-level counter, so the id it
      // hands to `aria-describedby` depends on how many contexts have mounted
      // before this one — which differs between the server (always the first)
      // and a client that arrived here through a redirect. Naming it makes the
      // accessibility wiring identical in both, and the tree hydrates clean.
      id="plan-board"
      sensors={dnd.sensors}
      collisionDetection={closestCenter}
      onDragStart={dnd.onDragStart}
      onDragEnd={dnd.onDragEnd}
      onDragCancel={dnd.onDragCancel}
      accessibility={{
        announcements: dnd.announcements,
        screenReaderInstructions: dnd.screenReaderInstructions,
      }}
    >
      <div
        style={planVars}
        className={cn(
          'relative isolate w-full overflow-hidden',
          // The map owns the whole viewport slice below the two navigation bars,
          // minus the mobile tab bar and the device's own safe areas.
          'h-[calc(100svh-var(--safe-top)-var(--impersonation-h)-var(--nav-h)-2.75rem-var(--subnav-h)-4rem-var(--safe-bottom))]',
          'lg:h-[calc(100svh-var(--safe-top)-var(--impersonation-h)-var(--nav-h)-var(--subnav-h))]',
        )}
      >
        <MapCanvas
          label={`Map of ${tripTitle}`}
          bounds={initialBounds}
          padding={padding}
          className="absolute inset-0"
          graticule={{ step: 2, majorEvery: 5 }}
        >
          <CategoryFilterBar
            categories={categories}
            selected={categoryIds}
            onChange={setCategoryIds}
            counts={model.stopCountByCategory}
            total={scheduledRows.length + model.ideas.length}
          />

          <DayRoutes days={routeDays} activeDay={activeDayNumber} />

          <PlaceMarkers
            places={mapPlaces}
            categories={categories}
            selectedId={selection.placeId ?? selection.hoverId}
            onSelect={selectPin}
            onHoverChange={hoverPin}
            metaFor={metaFor}
          />

          <MapBehaviour
            cameraToken={selection.cameraToken}
            cameraTarget={selection.cameraTarget}
            places={mapPlaces}
            picking={picking !== null}
            onPick={savePosition}
            onBackgroundClick={() => dispatch({ type: 'clear' })}
          />

          {/* A vertical toolbar is ~150px tall, which on a phone would sit straight
              through the action bar and the credit. So on a narrow screen it moves
              to the top-right, under the filter bar; on a wide one it returns to the
              bottom-right and steps aside for the places rail.

              Both offsets come from `--plan-controls`, which is set from the very
              same `CONTROLS` numbers the camera padding reserves. */}
          <MapControls
            position="bottom-right"
            className={cn(
              'top-20 right-(--plan-controls) bottom-auto',
              'lg:top-auto lg:right-(--plan-controls) lg:bottom-10',
            )}
          />

          <PlanCoverage
            points={allPoints}
            padding={padding}
            fitKey={`${leftCollapsed}:${rightCollapsed}:${wide}`}
            hidden={coverageHidden}
            onDismiss={() => setCoverageHidden(true)}
          />

          {/* ODbL: OpenStreetMap and Protomaps are credited on the map itself, in
              the product's own type, at a size that can actually be read — and
              lifted clear of the mobile action bar rather than hidden under it. */}
          <MapAttribution className="right-auto bottom-(--plan-bar) left-1/2 -translate-x-1/2 lg:bottom-2" />
        </MapCanvas>

        {/* -------------------------------------------------------- desktop */}

        {wide ? (
          <>
            <PlannerRail
              side="left"
              label="Itinerary"
              meta={String(model.scheduledCount)}
              collapsed={leftCollapsed}
              onCollapsedChange={setLeftCollapsed}
              footer={leftCollapsed ? undefined : railFooter}
              className={cn(
                'absolute top-4 bottom-4 left-4 hidden animate-overlay-in lg:flex',
                leftCollapsed ? 'w-11' : 'w-86',
              )}
            >
              {itinerary}
            </PlannerRail>

            <PlannerRail
              side="right"
              label="Places"
              meta={String(
                placeScope === 'all' ? scopeCounts.all : scopeCounts.unplanned,
              )}
              collapsed={rightCollapsed}
              onCollapsedChange={setRightCollapsed}
              toolbar={rightCollapsed ? undefined : addButton}
              className={cn(
                'absolute top-4 right-4 bottom-4 hidden animate-overlay-in lg:flex',
                rightCollapsed ? 'w-11' : 'w-82',
              )}
            >
              {ideas}
            </PlannerRail>
          </>
        ) : (
          /* --------------------------------------------------------- mobile */
          <GlassPanel
            radius="2xl"
            padding="sm"
            className="absolute inset-x-3 bottom-3 flex items-center gap-2 pb-safe lg:hidden"
          >
            <div className="min-w-0 flex-1">
              <SectionLabel as="h2">{tripTitle}</SectionLabel>
              <p className="mt-0.5 truncate text-caption tabular-nums text-ink-2">
                {pluralise(model.scheduledCount, 'stop')} ·{' '}
                {pluralise(model.days.length, 'day')} ·{' '}
                {pluralise(model.ideas.length, 'idea')}
              </p>
            </div>
            <Button
              variant="secondary"
              shape="pill"
              size="sm"
              icon={<ListTree />}
              onClick={() => setSheet('itinerary')}
            >
              Days
            </Button>
            <Button
              variant="primary"
              shape="pill"
              size="sm"
              icon={<Layers />}
              onClick={() => setSheet('places')}
            >
              Places
            </Button>
          </GlassPanel>
        )}

        {/* ------------------------------------------------- picking banner */}

        {picking === null ? null : (
          <GlassPanel
            radius="full"
            padding="xs"
            role="status"
            aria-live="polite"
            className="absolute top-20 left-1/2 flex max-w-[calc(100%-7rem)] -translate-x-1/2 items-center gap-2 pr-1 pl-3"
          >
            <Crosshair
              size={14}
              strokeWidth={2}
              aria-hidden="true"
              className="shrink-0 text-brand"
            />
            <span className="min-w-0 truncate text-caption text-ink-2">
              Tap the map to place{' '}
              <span className="font-semibold text-ink">{picking.name}</span>
            </span>
            <IconButton
              icon={<X />}
              label="Stop placing this pin"
              size="xs"
              variant="ghost"
              onClick={() => setPicking(null)}
            />
          </GlassPanel>
        )}
      </div>

      {/* ------------------------------------------------------ mobile sheet */}

      <Sheet
        open={sheet !== null}
        onOpenChange={(open) => setSheet(open ? (sheet ?? 'itinerary') : null)}
        // Only the grab handle drags the sheet, so a row inside it can be dragged
        // without the sheet running away with the gesture.
        handleOnly
      >
        <SheetContent side="bottom" className="max-h-[86dvh]">
          <SheetHeader className="pr-14">
            <SheetTitle>Plan</SheetTitle>
          </SheetHeader>
          <SheetBody className="px-3 py-3">
            <Tabs
              value={sheet ?? 'itinerary'}
              onValueChange={(value) =>
                setSheet(value === 'places' ? 'places' : 'itinerary')
              }
            >
              <TabsList className="w-full">
                <TabsTrigger value="itinerary" className="flex-1">
                  Itinerary
                </TabsTrigger>
                <TabsTrigger value="places" className="flex-1">
                  Places
                </TabsTrigger>
              </TabsList>
              <TabsContent value="itinerary">{itinerary}</TabsContent>
              <TabsContent value="places">
                <div className="flex flex-col gap-3">
                  {addButton}
                  {ideas}
                </div>
              </TabsContent>
            </Tabs>
          </SheetBody>
        </SheetContent>
      </Sheet>

      {/* ------------------------------------------------------- drag overlay */}

      <DragOverlay dropAnimation={null}>
        {draggingRow === undefined ? null : (
          <DragPreview
            row={draggingRow}
            category={categoryFor(draggingRow.categoryId)}
          />
        )}
      </DragOverlay>

      {/* ------------------------------------------------------------ dialogs */}

      <PlaceDialog
        open={dialog?.kind === 'create' || dialog?.kind === 'edit'}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
        mode={dialog?.kind === 'edit' ? 'edit' : 'create'}
        categories={model.categories}
        days={payload.days}
        initial={
          dialog?.kind === 'edit'
            ? (() => {
                const place = placeById.get(dialog.placeId)
                return place === undefined ? emptyDraft : draftFromPlace(place)
              })()
            : emptyDraft
        }
        saving={saving}
        error={formError}
        onSubmit={submitPlace}
      />

      <TimingDialog
        open={dialog?.kind === 'timing'}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
        placeName={
          dialog?.kind === 'timing'
            ? (model.rowsByItem.get(dialog.itemId)?.name ?? 'This stop')
            : 'This stop'
        }
        dayLabel={
          dialog?.kind === 'timing'
            ? `Day ${model.rowsByItem.get(dialog.itemId)?.dayNumber ?? 1}`
            : ''
        }
        initial={
          dialog?.kind === 'timing'
            ? timingFor(payload, dialog.itemId)
            : emptyTiming
        }
        saving={saving}
        error={formError}
        onSubmit={submitTiming}
      />

      <DeleteDialog
        open={dialog?.kind === 'delete'}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
        placeName={
          dialog?.kind === 'delete'
            ? (placeById.get(dialog.placeId)?.name ?? 'this place')
            : 'this place'
        }
        dayCount={
          dialog?.kind === 'delete'
            ? payload.days.filter((day) =>
                day.stops.some((stop) => stop.placeId === dialog.placeId),
              ).length
            : 0
        }
        saving={saving}
        error={formError}
        onConfirm={confirmDelete}
      />
    </DndContext>
  )
}

/** The stored timing of one stop, for the dialog to open on. */
function timingFor(payload: PlanBoardPayload, assignmentId: string): TimingDraft {
  for (const day of payload.days) {
    for (const stop of day.stops) {
      if (stop.assignmentId !== assignmentId) continue
      return {
        startTime: stop.startTime ?? '',
        endTime: stop.endTime ?? '',
        durationMinutes: stop.durationMinutes ?? 0,
        notes: stop.notes ?? '',
        reservationStatus: stop.reservationStatus,
      }
    }
  }
  return emptyTiming
}

/**
 * The coverage note, inside the map's own context.
 *
 * `useArchiveCoverage` reads the archive header off the map context, so the question
 * "does the published basemap reach this trip" can only be asked from in here. The
 * answer also decides how far in the opening frame is allowed to go: outside the
 * archive the ground is our own generalised coastlines, which are honest across a
 * region and a lie across a city, so a trip with no tiles opens at regional scale.
 */
function PlanCoverage({
  points,
  padding,
  fitKey,
  hidden,
  onDismiss,
}: {
  readonly points: ReadonlyArray<LngLat>
  readonly padding: Record<'top' | 'right' | 'bottom' | 'left', number>
  readonly fitKey: string
  readonly hidden: boolean
  readonly onDismiss: () => void
}) {
  const coverage = useArchiveCoverage(points)

  // No tiles under the trip means the ground is our own generalised coastline,
  // which draws a real shoreline across a region and nothing at all across a
  // city. Capping the fit is what keeps the frame honest — and it is what makes
  // the notice's promise ("the coastlines … are all real") true rather than a
  // claim about an empty rectangle.
  const unmapped = coverage.status === 'outside' || coverage.status === 'partial'

  return (
    <>
      {/* The screen's only `FitBounds`. Two of them would race on mount and the
          loser would silently decide the camera. The cap belongs in `fitKey`
          because coverage is only known once the archive header lands: the first
          frame is drawn uncapped, and re-keying is what re-frames it once the
          answer arrives. */}
      <FitBounds
        points={points}
        padding={padding}
        maxZoom={unmapped ? FIT_MAX_ZOOM_UNMAPPED : FIT_MAX_ZOOM}
        fitKey={`${fitKey}:${unmapped ? 'unmapped' : 'mapped'}`}
      />
      {hidden ? null : (
        <CoverageNotice
          coverage={coverage}
          onDismiss={onDismiss}
          className="bottom-(--plan-note) lg:bottom-12"
        />
      )}
    </>
  )
}
