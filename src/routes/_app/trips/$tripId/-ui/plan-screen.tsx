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
import { useKeyedPreference } from '#/lib/local-preference'
import { plannerDaysPreference, isDayExpanded } from './plan-layout'
import { PlanWorkspace, usePlanWorkspace } from './plan-workspace'
import { useRouter } from '@tanstack/react-router'
import { DndContext, DragOverlay, closestCenter } from '@dnd-kit/core'
import { Crosshair, X } from 'lucide-react'
import { toast } from 'sonner'

import { directionOf, useLocale, useTranslate } from '#/lib/i18n'
import { cn } from '#/lib/cn'
import { GlassPanel, IconButton, SectionLabel } from '#/components/ui'
import {
  CategoryFilterBar,
  CoverageNotice,
  DayRoutes,
  FitBounds,
  FIT_MAX_ZOOM,
  FIT_MAX_ZOOM_UNMAPPED,
  MapAttribution,
  MapCanvas,
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
  initialSelection,
  isLegItemId,
  itemsIn,
  journeyName,
  noteItemId,
  selectionReducer,
  usePlanDnd,
} from '#/components/planner'
import { pluralise } from '../../../-lib/format'
import {
  DeleteDialog,
  DropTimeDialog,
  PlaceDialog,
  StopMenu,
  TimingDialog,
  draftFromPlace,
  emptyDraft,
  emptyTiming,
  messageOf,
  refreshOnFailure,
} from './plan-actions'
import {
  filterRows,
  formatMetres,
  mapCategories,
  mapPlacesOf,
  routeDaysOf,
} from './plan-model'
import { planBoard } from './plan-board'
import { journeyWritesFor } from './plan-transport-model'
import { planMoveOutcome, refusalCopy, reorderPayload } from './plan-move'
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
import {
  createDayNoteFn,
  deleteDayNoteFn,
  updateDayNoteFn,
} from '../-server/day-notes'
import { reorderDayTransportsFn } from '../-server/plan-transports'
import { PlannerAddPlace, reportPlaceWriteFailure } from './planner-add-place'
import { useDialogOwnership } from './use-dialog-ownership'
import { useTripWeather } from './use-trip-weather'
import { PlannerMapLayer, usePlannerDrop } from './planner-map-layer'
import { PlannerDayTools } from './planner-day-tools'
import { BookingDialog } from '#/components/modules/book'
import {
  NoteDeleteDialog,
  NoteDialog,
  draftFromNote,
  emptyNote,
} from './note-dialog'

import type { MapPlace } from '#/components/map'
import type { LngLat, MapBounds } from '#/lib/map'
import type {
  PlacesScope,
  PlanChange,
  PlanOrder,
  PlanTarget,
  PlannerNote,
  PlannerRow,
} from '#/components/planner'
import type { PlanNotesPayload } from '../-server/day-notes'
import type { PlanBoardPayload } from '../-server/plan'
import type { PlanTransportsPayload } from '../-server/plan-transports'
import type { PlaceDraft, PlaceFormValues, TimingDraft } from './plan-actions'
import type { JourneyRestatement } from './plan-transport-model'
import type { NoteDraft } from './note-dialog'
import type { PlaceWriteReport } from './planner-add-place'

/* -------------------------------------------------------------------------------------------------
 * Layout constants
 * ---------------------------------------------------------------------------------------------- */

/** Zoom a "take me there" from the rail settles on, if the map is further out. */
const FOCUS_ZOOM = 14.5

/** Lowers the "drop its time?" dialog while leaving the question it asked readable. */
function closed<T extends { readonly open: boolean }>(
  current: T | null,
): T | null {
  return current === null ? null : { ...current, open: false }
}

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
  | { readonly kind: 'create'; readonly draft?: PlaceDraft }
  | { readonly kind: 'edit'; readonly placeId: string }
  | { readonly kind: 'timing'; readonly itemId: string }
  | { readonly kind: 'delete'; readonly placeId: string }
  | { readonly kind: 'note-create'; readonly dayId: string }
  | { readonly kind: 'note-edit'; readonly noteId: string }
  | { readonly kind: 'note-delete'; readonly noteId: string }
  /** The booking desk's own dialog, as a stay whose first night is this day. */
  | { readonly kind: 'stay'; readonly dayId: string }
  | null

export interface PlanScreenProps {
  readonly payload: PlanBoardPayload
  /** The trip's notes and whether this reader may write them. Loaded beside the board. */
  readonly notes: PlanNotesPayload
  /** The trip's journeys, loaded beside the board — `03-S5`'s third read. */
  readonly transports: PlanTransportsPayload
  /** Shown in the itinerary rail's footer, where a page header would have been. */
  readonly tripTitle: string
}

export function PlanScreen({
  payload,
  notes,
  transports,
  tripTitle,
}: PlanScreenProps) {
  const locale = useLocale()
  const t = useTranslate()
  const router = useRouter()
  const workspace = usePlanWorkspace(payload.tripId, directionOf(locale))
  const { wide, leftCollapsed, rightCollapsed, setSheet, padding } = workspace
  const [unfolded, setUnfolded] = useKeyedPreference(
    plannerDaysPreference,
    payload.tripId,
  )
  const editable = payload.editable
  /** Fetched once the board is on the page; the board never waits for it. */
  const weather = useTripWeather(payload.tripId, payload)

  /* ------------------------------------------------------------------ state */

  /** The three payloads, read once: the server's arrangement and every lookup off it. */
  const board = React.useMemo(
    () => planBoard(payload, notes, transports, locale),
    [payload, notes, transports, locale],
  )
  const {
    serverOrder,
    transportRows,
    notesByItem: noteIndex,
    journeysByItem: journeyIndex,
    timeOfItem,
  } = board
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
  const [categoryIds, setCategoryIds] = React.useState<ReadonlyArray<string>>(
    [],
  )
  const [pending, setPending] = React.useState<ReadonlySet<string>>(new Set())
  const [dialog, setDialog] = React.useState<DialogState>(null)
  const [saving, setSaving] = React.useState(false)
  const [formError, setFormError] = React.useState<string | null>(null)
  const [formErrorAction, setFormErrorAction] =
    React.useState<PlaceWriteReport['action']>(null)
  const [picking, setPicking] = React.useState<PlannerRow | null>(null)
  /** A pin dropped on the map; it opens the create form with a draft. Never while repositioning. */
  const mapDrop = usePlannerDrop({
    tripId: payload.tripId,
    editable: editable && picking === null,
    formOpen: dialog?.kind === 'create',
    onDropped: (draft) => setDialog({ kind: 'create', draft }),
  })
  /**
   * The move a reader is being asked about: it lands only if its own time goes.
   * The whole move is kept, not just the item, because confirming replays it —
   * the drop happens by running the same move again with the time treated as gone.
   *
   * Answering lowers `open` rather than clearing the state, because the dialog stays
   * mounted through its exit animation: dropping the name and the time here would
   * leave it reading "Move  and drop its ?" on the way out, which is what a screen
   * reader re-reading the closing dialog would hear.
   */
  const [dropTime, setDropTime] = React.useState<{
    readonly open: boolean
    readonly itemId: string
    readonly target: PlanTarget
    readonly name: string
    readonly time: string
  } | null>(null)
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

  const model = React.useMemo(() => board.model(order, t), [board, order, t])

  /**
   * What each journey row is called in a sentence — "Tokyo to Kyoto".
   *
   * Composed here because naming a journey needs the catalogue, and neither the drag
   * announcements nor the refusal toasts may reach for one of their own.
   */
  const journeyNames = React.useMemo(
    () =>
      new Map(transportRows.map((row) => [row.itemId, journeyName(t, row)])),
    [transportRows, t],
  )

  const scheduledRows = React.useMemo(
    () => model.days.flatMap((day) => day.rows),
    [model.days],
  )

  const filters = React.useMemo(
    () => ({ query, categoryIds }),
    [query, categoryIds],
  )
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

  const selectedDay = model.days.find((day) =>
    day.rows.some((row) => row.placeId === selection.placeId),
  )?.dayId
  const lastSelection = React.useRef<string | null>(null)
  React.useEffect(() => {
    if (lastSelection.current === selection.placeId) return
    lastSelection.current = selection.placeId
    if (selectedDay === undefined || isDayExpanded(unfolded, selectedDay))
      return
    setUnfolded({
      known: model.days.map((day) => day.dayId),
      open: model.days
        .filter(
          (day) =>
            day.dayId === selectedDay || isDayExpanded(unfolded, day.dayId),
        )
        .map((day) => day.dayId),
    })
  }, [selection.placeId, selectedDay, unfolded, setUnfolded, model.days])

  /* ------------------------------------------------------------------ camera */

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

  /**
   * Restates the journeys departing from these days, against the board as it now reads.
   *
   * A journey's `sort_order` is a *relation* to the day's stops and notes, and
   * `reorderPlanFn` renumbers those without ever consulting a journey — so any write that
   * touches a day has to say again where that day's journeys sit. One rule, two call
   * sites: here, behind every primary write, and the delete handler.
   *
   * Awaited by the caller, so a failure rolls the optimistic order back together with the
   * write it followed. The days are written in parallel because each is a separate run and
   * no day's fractions are measured against another's.
   */
  const restateJourneys = React.useCallback(
    async (change: JourneyRestatement): Promise<void> => {
      await Promise.all(
        journeyWritesFor(change, transportRows).map((write) =>
          reorderDayTransportsFn({
            data: {
              tripId: payload.tripId,
              dayId: write.dayId,
              items: [...write.items],
            },
          }),
        ),
      )
    },
    [payload.tripId, transportRows],
  )

  const applyChange = React.useCallback(
    async (
      change: PlanChange,
      next: PlanOrder,
      itemId: string,
      clearTime: string | null,
    ): Promise<void> => {
      switch (change.kind) {
        case 'reorder':
          // A journey carries no `order_index` of its own, so moving one leaves every stop
          // and note of the day exactly where it was. Its day run *is* the whole write.
          if (!isLegItemId(itemId)) {
            await reorderPlanFn({
              data: reorderPayload(payload.tripId, change, clearTime),
            })
          }
          await restateJourneys({
            kind: 'reorder',
            next,
            dayIds: change.days.map((day) => day.dayId),
          })
          return
        case 'schedule': {
          const { assignmentId } = await schedulePlaceFn({
            data: {
              tripId: payload.tripId,
              placeId: change.placeId,
              dayId: change.dayId,
              index: change.index,
            },
          })
          await restateJourneys({
            kind: 'schedule',
            next,
            placeId: change.placeId,
            assignmentId,
            dayId: change.dayId,
          })
          return
        }
        case 'unschedule':
          await unschedulePlaceFn({
            data: {
              tripId: payload.tripId,
              assignmentId: change.assignmentId,
            },
          })
          await restateJourneys({
            kind: 'unschedule',
            before: order,
            next,
            itemId,
          })
          return
        case 'rank-ideas':
          await rankIdeasFn({
            data: { tripId: payload.tripId, placeIds: [...change.placeIds] },
          })
          return
      }
    },
    [order, payload.tripId, restateJourneys],
  )

  /**
   * What an item is called in a sentence: a place by its name, a note by its
   * headline, a journey by where it goes. `null` for an id the board cannot
   * resolve — which is also the only
   * case in which the reader is told nothing, because an item the board does not
   * have is one the engine refuses as `'unknown'` rather than as anything sayable.
   */
  const nameOfItem = React.useCallback(
    (itemId: string): string | null =>
      model.rowsByItem.get(itemId)?.name ??
      noteIndex.get(itemId)?.body ??
      journeyNames.get(itemId) ??
      null,
    [journeyNames, model.rowsByItem, noteIndex],
  )

  /**
   * Applies a move optimistically, then writes it.
   *
   * Returns the sentence a screen reader should hear when nothing moved, so a
   * refused keyboard drag is spoken rather than silent; `null` when the move went
   * through. The decision itself lives in `plan-move.ts` — everything here is the
   * optimistic swap, the write, and saying what happened.
   *
   * `drop` is the reader's answer to the dialog: run the same move again, this time
   * with the item's own time treated as absent. The resulting write carries the item
   * in `clearTime` as well as in `items`, so there is never a frame in which the row
   * has a time and the wrong position.
   *
   * The rollback restores the arrangement the board had *before* this move rather
   * than recomputing an inverse, which is the only version that stays correct when
   * two drags overlap.
   */
  const runMove = React.useCallback(
    (itemId: string, target: PlanTarget, drop: boolean): string | null => {
      if (!editable) return null

      const outcome = planMoveOutcome(order, itemId, target, {
        placeOfItem,
        timeOfItem,
        dropTime: drop,
      })

      if (outcome.kind === 'refused') {
        const copy = refusalCopy(outcome.reason, itemId)
        const name = nameOfItem(itemId)
        if (copy === null || name === null) return null
        // A journey refused against its own clock names that clock, and `interpolate`
        // leaves a token it was not given exactly as written — so the time travels with
        // the name. The other refusals do not mention it, and an extra value is ignored.
        const time = timeOfItem(itemId)
        const said = time === null ? { name } : { name, time }
        toast.error(t(copy.title, said), { description: t(copy.body) })
        return t(copy.spoken, said)
      }

      if (outcome.kind === 'ask-drop-time') {
        const name = nameOfItem(itemId)
        if (name === null) return null
        setDropTime({ open: true, itemId, target, name, time: outcome.time })
        return t('trips.plan.move.spoken.timed', { name, time: outcome.time })
      }

      const previous = order
      setOrder(outcome.order)
      markPending(itemId, true)

      void applyChange(
        outcome.change,
        outcome.order,
        itemId,
        drop ? itemId : null,
      )
        .then(() => router.invalidate())
        .catch((cause: unknown) => {
          setOrder(previous)
          toast.error(t('trips.plan.move.error.save'), {
            description: messageOf(cause, t('trips.plan.move.error.retry')),
          })
        })
        .finally(() => {
          markPending(itemId, false)
        })

      return null
    },
    [
      applyChange,
      editable,
      markPending,
      nameOfItem,
      order,
      placeOfItem,
      router,
      t,
      timeOfItem,
    ],
  )

  const commitMove = React.useCallback(
    (itemId: string, target: PlanTarget): string | null =>
      runMove(itemId, target, false),
    [runMove],
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
    notesByItem: noteIndex,
    journeyNamesByItem: journeyNames,
    days: model.days,
    onMove: commitMove,
  })

  const draggingRow =
    dnd.draggingId === null ? undefined : model.rowsByItem.get(dnd.draggingId)
  const draggingNote =
    dnd.draggingId === null ? undefined : noteIndex.get(dnd.draggingId)
  const draggingJourney =
    dnd.draggingId === null ? undefined : journeyIndex.get(dnd.draggingId)

  /** What the overlay carries: whichever of the three kinds was picked up. */
  const dragPreview = (): React.ReactNode => {
    if (draggingRow !== undefined) {
      return (
        <DragPreview
          row={draggingRow}
          category={categoryFor(draggingRow.categoryId)}
        />
      )
    }
    if (draggingNote !== undefined) return <DragPreview note={draggingNote} />
    if (draggingJourney !== undefined) {
      return <DragPreview transport={draggingJourney} />
    }
    return null
  }

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

  const { claim: claimWrite, release: releaseDialog } = useDialogOwnership(dialog)

  const closeDialog = React.useCallback((): void => {
    releaseDialog()
    setDialog(null)
    setFormError(null)
    setFormErrorAction(null)
  }, [releaseDialog])

  /**
   * Runs a write and reports whether it landed. The form that was open when it started (if any)
   * owns it: its error slot shows a failure and `closeOnLanded` closes it. When that form is gone,
   * or the write never had one (a pin drop), a failure is a toast and nothing is closed, so the
   * result can never reach a dialog opened while the write was in flight.
   */
  const runWrite = React.useCallback(
    async (
      work: () => Promise<unknown>,
      options: {
        readonly fallback: string
        readonly success?: string
        readonly closeOnLanded?: boolean
      },
    ): Promise<boolean> => {
      const stillOwned = claimWrite()
      setSaving(true)
      setFormError(null)
      setFormErrorAction(null)
      try {
        await work()
        await router.invalidate()
        if (options.success !== undefined) toast.success(options.success)
        if (options.closeOnLanded === true && stillOwned()) closeDialog()
        return true
      } catch (cause) {
        const report = reportPlaceWriteFailure(cause, {
          fallback: options.fallback,
          quota: t('trips.plan.addPlace.quota'),
          seePlans: t('trips.plan.addPlace.quotaAction'),
        })
        if (stillOwned()) {
          setFormError(report.message)
          setFormErrorAction(report.action)
        } else {
          toast.error(report.message)
        }
        return false
      } finally {
        setSaving(false)
      }
    },
    [claimWrite, closeDialog, router, t],
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
          closeOnLanded: true,
        },
      )
    },
    [dialog, payload.tripId, runWrite],
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
          closeOnLanded: true,
        },
      )
    },
    [dialog, payload.tripId, runWrite],
  )

  const confirmDelete = React.useCallback((): void => {
    if (dialog?.kind !== 'delete') return
    const placeId = dialog.placeId
    const itemId = model.rowsByPlace.get(placeId)?.itemId ?? null

    void runWrite(
      async () => {
        await deletePlanPlaceFn({ data: { tripId: payload.tripId, placeId } })
        // Deleting a stop renumbers its day, so the journeys placed against those
        // numbers are restated against the day the delete leaves behind — the second
        // of the rule's two call sites. The delete has landed by then, so a refused
        // restatement still refreshes the board before its error is shown.
        if (itemId !== null) {
          await refreshOnFailure(
            () => restateJourneys({ kind: 'delete', before: order, itemId }),
            () => router.invalidate(),
          )
        }
      },
      {
        fallback: 'The place could not be deleted. Try again in a moment.',
        success: 'Place deleted',
        closeOnLanded: true,
      },
    ).then((landed) => {
      // The place is gone whether or not its dialog still is.
      if (landed) dispatch({ type: 'forget', placeId })
    })
  }, [
    dialog,
    model.rowsByPlace,
    order,
    payload.tripId,
    restateJourneys,
    router,
    runWrite,
  ])

  /* ------------------------------------------------------------------ notes */

  const noteById = React.useMemo(
    () => new Map(notes.notes.map((note) => [note.id, note])),
    [notes.notes],
  )

  const noteDraft = React.useMemo((): NoteDraft => {
    if (dialog?.kind !== 'note-edit') return emptyNote
    const note = noteById.get(dialog.noteId)
    return note === undefined ? emptyNote : draftFromNote(note)
  }, [dialog, noteById])

  const submitNote = React.useCallback(
    (values: NoteDraft): void => {
      const state = dialog
      if (state?.kind !== 'note-create' && state?.kind !== 'note-edit') return

      void runWrite(
        async () => {
          if (state.kind === 'note-create') {
            await createDayNoteFn({
              data: {
                tripId: payload.tripId,
                dayId: state.dayId,
                body: values.body,
                detail: values.detail,
                time: values.time,
                icon: values.icon,
              },
            })
            return
          }
          await updateDayNoteFn({
            data: {
              tripId: payload.tripId,
              noteId: state.noteId,
              body: values.body,
              detail: values.detail,
              time: values.time,
              icon: values.icon,
            },
          })
        },
        {
          fallback: t('trips.plan.note.error.retry'),
          success:
            state.kind === 'note-create'
              ? t('trips.plan.note.toast.created')
              : t('trips.plan.note.toast.updated'),
          closeOnLanded: true,
        },
      )
    },
    [dialog, payload.tripId, runWrite, t],
  )

  const confirmDeleteNote = React.useCallback((): void => {
    if (dialog?.kind !== 'note-delete') return
    const noteId = dialog.noteId

    void runWrite(
      () => deleteDayNoteFn({ data: { tripId: payload.tripId, noteId } }),
      {
        fallback: t('trips.plan.note.error.retry'),
        success: t('trips.plan.note.toast.deleted'),
        closeOnLanded: true,
      },
    )
  }, [dialog, payload.tripId, runWrite, t])

  /**
   * Moves a note one place within its day.
   *
   * The same move a drag makes, so a chevron walks the note past whatever is actually
   * above or below it — a stop as readily as another note — and inherits the whole
   * policy with it: the optimistic swap, the rollback, and the question a row asks
   * before it is moved against its own clock.
   */
  const moveNote = React.useCallback(
    (note: PlannerNote, direction: -1 | 1): void => {
      const items =
        order.days.find((day) => day.dayId === note.dayId)?.itemIds ?? []
      const itemId = noteItemId(note.id)
      const index = items.indexOf(itemId)
      const target = index + direction
      if (index === -1 || target < 0 || target >= items.length) return

      commitMove(itemId, { container: note.dayId, index: target })
    },
    [commitMove, order.days],
  )

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
      ).then((landed) => {
        if (landed) {
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
          onEditPlace={() => setDialog({ kind: 'edit', placeId: row.placeId })}
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
            Give {tripTitle} a departure and a return date and one column per
            day appears here, ready for the places you have collected.
          </p>
        </div>
      ) : (
        model.days.map((day) => (
          <DaySection
            expanded={isDayExpanded(unfolded, day.dayId)}
            onExpandedChange={(expanded) => {
              const known = model.days.map((entry) => entry.dayId)
              const open = known.filter((id) =>
                id === day.dayId ? expanded : isDayExpanded(unfolded, id),
              )
              setUnfolded({ known, open })
            }}
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
            canWriteNotes={notes.canWrite}
            onAddNote={() =>
              setDialog({ kind: 'note-create', dayId: day.dayId })
            }
            onEditNote={(note) =>
              setDialog({ kind: 'note-edit', noteId: note.id })
            }
            onDeleteNote={(note) =>
              setDialog({ kind: 'note-delete', noteId: note.id })
            }
            onMoveNote={moveNote}
            weather={weather.viewOf(day.dayId)}
            weatherUnit={weather.unit}
            dayTools={
              editable
                ? (entry) => (
                    <PlannerDayTools
                      day={entry}
                      onAddPlace={(dayId) =>
                        setDialog({
                          kind: 'create',
                          draft: { ...emptyDraft, dayId },
                        })
                      }
                      onAddStay={(dayId) => setDialog({ kind: 'stay', dayId })}
                    />
                  )
                : undefined
            }
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

  /** What the create form opens on: a draft a gesture filled, or an empty one. */
  const createDraft = dialog?.kind === 'create' ? dialog.draft : undefined

  const addButton = editable ? (
    <PlannerAddPlace
      onCreate={() => setDialog({ kind: 'create' })}
      onArmMap={(returnFocusTo) => {
        // On a phone the sheet covers the map it is about to arm.
        setSheet(null)
        mapDrop.arm(returnFocusTo)
      }}
      mapReady={mapDrop.ready && mapDrop.editable}
    />
  ) : null

  // Archived wins over the role: it is a property of the trip, so it is true for
  // every reader, and it is the reason an owner or an editor would see this too.
  const readOnlyReason = payload.archived
    ? t('trips.plan.readOnly.archived')
    : t('trips.plan.readOnly.role')

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
          : readOnlyReason}
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
      <PlanWorkspace
        key={payload.tripId}
        layout={workspace}
        tripTitle={tripTitle}
        itinerary={itinerary}
        ideas={ideas}
        addButton={addButton}
        railFooter={railFooter}
        scheduledCount={String(model.scheduledCount)}
        placesCount={String(
          placeScope === 'all' ? scopeCounts.all : scopeCounts.unplanned,
        )}
        mobileSummary={`${pluralise(model.scheduledCount, 'stop')} · ${pluralise(model.days.length, 'day')} · ${pluralise(model.ideas.length, 'idea')}`}
        resizeLeftLabel={t('trips.plan.workspace.resizeItinerary')}
        resizeRightLabel={t('trips.plan.workspace.resizePlaces')}
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
              'top-20 end-(--plan-controls) bottom-auto',
              'lg:top-auto lg:end-(--plan-controls) lg:bottom-10',
            )}
          />

          <PlanCoverage
            points={allPoints}
            padding={padding}
            fitKey={`${leftCollapsed}:${rightCollapsed}:${wide}:${workspace.widths.left}:${workspace.widths.right}:${directionOf(locale)}`}
            hidden={coverageHidden}
            onDismiss={() => setCoverageHidden(true)}
          />

          {/* ODbL: OpenStreetMap and Protomaps are credited on the map itself, in
              the product's own type, at a size that can actually be read — and
              lifted clear of the mobile action bar rather than hidden under it. */}
          <MapAttribution className="end-auto bottom-(--plan-bar) left-1/2 -translate-x-1/2 lg:bottom-2" />

          <PlannerMapLayer drop={mapDrop} empty={allPoints.length === 0} />
        </MapCanvas>

        {/* ------------------------------------------------- picking banner */}

        {picking === null ? null : (
          <GlassPanel
            radius="full"
            padding="xs"
            role="status"
            aria-live="polite"
            className="absolute top-20 left-1/2 flex max-w-[calc(100%-7rem)] -translate-x-1/2 items-center gap-2 pe-1 ps-3"
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
              size="sm"
              variant="ghost"
              onClick={() => setPicking(null)}
            />
          </GlassPanel>
        )}
      </PlanWorkspace>

      {/* ------------------------------------------------------ mobile sheet */}

      {/* ------------------------------------------------------- drag overlay */}

      <DragOverlay dropAnimation={null}>{dragPreview()}</DragOverlay>

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
            : (createDraft ?? emptyDraft)
        }
        saving={saving}
        error={formError}
        errorAction={formErrorAction}
        onSubmit={submitPlace}
      />

      <TimingDialog
        open={dialog?.kind === 'timing'}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
        placeName={
          dialog?.kind === 'timing'
            ? (model.rowsByItem.get(dialog.itemId)?.name ??
              t('trips.plan.editor.stopFallback'))
            : t('trips.plan.editor.stopFallback')
        }
        dayLabel={
          dialog?.kind === 'timing'
            ? t('trips.plan.editor.dayNumber', {
                day: model.rowsByItem.get(dialog.itemId)?.dayNumber ?? 1,
              })
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

      <NoteDialog
        open={dialog?.kind === 'note-create' || dialog?.kind === 'note-edit'}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
        mode={dialog?.kind === 'note-edit' ? 'edit' : 'create'}
        initial={noteDraft}
        saving={saving}
        error={formError}
        onSubmit={submitNote}
      />

      <NoteDeleteDialog
        open={dialog?.kind === 'note-delete'}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
        saving={saving}
        error={formError}
        onConfirm={confirmDeleteNote}
      />

      {/*
       * The desk's dialog, not a second form: it owns the stay's validation, both of its writes,
       * the compensation and the ledger line, and its save invalidates the router, so the board's
       * own loader re-reads the new nights.
       */}
      <BookingDialog
        tripId={payload.tripId}
        days={payload.bookingDays}
        currency={payload.currency}
        initialStayDayId={dialog?.kind === 'stay' ? dialog.dayId : undefined}
        open={dialog?.kind === 'stay'}
        onOpenChange={(open) => {
          if (!open) closeDialog()
        }}
      />

      <DropTimeDialog
        open={dropTime?.open === true}
        name={dropTime?.name ?? ''}
        time={dropTime?.time ?? ''}
        onDecline={() => setDropTime(closed)}
        onConfirm={() => {
          if (dropTime === null) return
          setDropTime(closed)
          runMove(dropTime.itemId, dropTime.target, true)
        }}
      />
    </DndContext>
  )
}

/** The stored timing of one stop, for the dialog to open on. */
function timingFor(
  payload: PlanBoardPayload,
  assignmentId: string,
): TimingDraft {
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
  const unmapped =
    coverage.status === 'outside' || coverage.status === 'partial'

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
