import * as React from 'react'
import { Layers, ListTree } from 'lucide-react'
import { TRIP_SLICE_HEIGHT_CLASS } from '#/lib/atlas/layout'
import { MEDIA_LG_UP } from '#/lib/breakpoints'
import { useTranslate } from '#/lib/i18n'
import { cn } from '#/lib/cn'
import { MAP_CONTROLS_WIDTH } from '#/components/map'
import { PlannerRail } from '#/components/planner'
import {
  Button,
  GlassPanel,
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
import type { RailWidths } from './plan-layout'
import { RAIL, plannerLayoutPreference } from './plan-layout'
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
const CONTROLS = { mobile: 12, besideGap: 8, folded: 16 } as const

/** How much of the right edge the control column occupies, in one layout. */
function controlsInset(right: number): number {
  return right + MAP_CONTROLS_WIDTH + RAIL.gutter
}

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
 * The complement of the rails' `lg:` variant, in the same unit.
 *
 * The two halves of this decision are this query and `hidden lg:flex` / `lg:hidden`
 * on the surfaces below. A `px` query would agree with `lg` only at a 16px root
 * font size, which is why the figure comes from `#/lib/breakpoints`.
 */
const RAILS_VISIBLE_QUERY = MEDIA_LG_UP

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
    const query = window.matchMedia(RAILS_VISIBLE_QUERY)
    const read = (): void => setWide(query.matches)
    read()
    query.addEventListener('change', read)
    return () => {
      query.removeEventListener('change', read)
    }
  }, [])

  return wide
}

export function usePlanWorkspace(
  tripId: string,
  direction: 'ltr' | 'rtl' = 'ltr',
) {
  const wide = useIsWide()
  const [leftCollapsed, setLeftCollapsed] = React.useState(false)
  const [rightCollapsed, setRightCollapsed] = React.useState(false)
  const [sheet, setSheet] = React.useState<'itinerary' | 'places' | null>(null)
  const [restored, setRestored] = React.useState(false)
  const [widths, resolveWidths] = React.useState(
    plannerLayoutPreference.fallback,
  )
  React.useLayoutEffect(() => {
    resolveWidths(plannerLayoutPreference.read(tripId))
    setRestored(true)
  }, [tripId])
  const setWidths = (next: RailWidths) => {
    resolveWidths(next)
    plannerLayoutPreference.write(tripId, next)
  }
  let controlsRight: number = CONTROLS.mobile
  if (wide)
    controlsRight = rightCollapsed
      ? CONTROLS.folded
      : widths.right + RAIL.gutter * 2 + CONTROLS.besideGap
  const planVars: PlanVars = {
    ...PLAN_VARS,
    visibility: restored ? undefined : 'hidden',
    '--plan-controls': `${controlsRight}px`,
  }
  const padding = React.useMemo(() => {
    let start = RAIL.gutter * 2
    let end = controlsInset(controlsRight)
    if (wide) {
      start += leftCollapsed ? RAIL.collapsed : widths.left
      end = Math.max(
        (rightCollapsed ? RAIL.collapsed : widths.right) + RAIL.gutter * 2,
        end,
      )
    }
    return {
      top: CHROME.top,
      bottom: wide ? CHROME.bottom : CHROME.mobileBottom,
      left: direction === 'rtl' ? end : start,
      right: direction === 'rtl' ? start : end,
    }
  }, [wide, leftCollapsed, rightCollapsed, widths, controlsRight, direction])

  return {
    wide,
    leftCollapsed,
    setLeftCollapsed,
    rightCollapsed,
    setRightCollapsed,
    sheet,
    setSheet,
    widths,
    setWidths,
    padding,
    planVars,
  }
}

export function PlanWorkspace({
  layout,
  tripTitle,
  itinerary,
  ideas,
  addButton,
  railFooter,
  scheduledCount,
  placesCount,
  mobileSummary,
  resizeLeftLabel,
  resizeRightLabel,
  titleRef,
  children,
}: {
  readonly layout: ReturnType<typeof usePlanWorkspace>
  readonly tripTitle: string
  readonly itinerary: React.ReactNode
  readonly ideas: React.ReactNode
  readonly addButton: React.ReactNode
  readonly railFooter: React.ReactNode
  readonly scheduledCount: string
  readonly placesCount: string
  readonly mobileSummary: string
  readonly resizeLeftLabel: string
  readonly resizeRightLabel: string
  /** A focus target that is always mounted, for when the panels are collapsed or closed. */
  readonly titleRef?: React.Ref<HTMLHeadingElement>
  readonly children: React.ReactNode
}) {
  const t = useTranslate()
  const {
    wide,
    leftCollapsed,
    setLeftCollapsed,
    rightCollapsed,
    setRightCollapsed,
    sheet,
    setSheet,
    widths,
    setWidths,
    planVars,
  } = layout
  const root = React.useRef<HTMLDivElement>(null)
  React.useLayoutEffect(() => {
    root.current?.style.setProperty(
      '--plan-left',
      `${leftCollapsed ? RAIL.collapsed : widths.left}px`,
    )
    root.current?.style.setProperty(
      '--plan-right',
      `${rightCollapsed ? RAIL.collapsed : widths.right}px`,
    )
  }, [widths, leftCollapsed, rightCollapsed])
  return (
    <>
      <div
        ref={root}
        data-plan-loaded=""
        style={planVars}
        className={cn(
          'relative isolate w-full overflow-hidden',
          TRIP_SLICE_HEIGHT_CLASS.base,
          TRIP_SLICE_HEIGHT_CLASS.lg,
        )}
      >
        <h1 ref={titleRef} tabIndex={-1} className="sr-only outline-none">
          {tripTitle}
        </h1>
        {children}
        {/* -------------------------------------------------------- desktop */}

        {wide ? (
          <>
            <PlannerRail
              side="left"
              resize={{
                width: widths.left,
                min: RAIL.min,
                max: RAIL.max,
                step: RAIL.step,
                label: resizeLeftLabel,
                onChange: (left) => setWidths({ ...widths, left }),
              }}
              label={t('trips.plan.title')}
              meta={scheduledCount}
              collapsed={leftCollapsed}
              onCollapsedChange={setLeftCollapsed}
              footer={leftCollapsed ? undefined : railFooter}
              className={cn(
                'absolute top-4 bottom-4 start-4 hidden animate-overlay-in lg:flex',
                'w-(--plan-left)',
              )}
            >
              {itinerary}
            </PlannerRail>

            <PlannerRail
              side="right"
              resize={{
                width: widths.right,
                min: RAIL.min,
                max: RAIL.max,
                step: RAIL.step,
                label: resizeRightLabel,
                onChange: (right) => setWidths({ ...widths, right }),
              }}
              label={t('trips.plan.places')}
              meta={placesCount}
              collapsed={rightCollapsed}
              onCollapsedChange={setRightCollapsed}
              toolbar={rightCollapsed ? undefined : addButton}
              className={cn(
                'absolute top-4 end-4 bottom-4 hidden animate-overlay-in lg:flex',
                'w-(--plan-right)',
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
              {/* Not a heading: the page's `h1` above already carries this exact
                  name, and on a phone — the only width this bar exists at — a
                  second one would announce the trip twice. */}
              <SectionLabel>{tripTitle}</SectionLabel>
              <p className="mt-0.5 truncate text-caption tabular-nums text-ink-2">
                {mobileSummary}
              </p>
            </div>
            <Button
              variant="secondary"
              shape="pill"
              size="sm"
              icon={<ListTree />}
              onClick={() => setSheet('itinerary')}
            >
              {t('trips.plan.workspace.days')}
            </Button>
            <Button
              variant="primary"
              shape="pill"
              size="sm"
              icon={<Layers />}
              onClick={() => setSheet('places')}
            >
              {t('trips.plan.places')}
            </Button>
          </GlassPanel>
        )}
      </div>
      <Sheet
        open={sheet !== null}
        onOpenChange={(open) => setSheet(open ? (sheet ?? 'itinerary') : null)}
        // Only the grab handle drags the sheet, so a row inside it can be dragged
        // without the sheet running away with the gesture.
        handleOnly
      >
        <SheetContent side="bottom" className="max-h-[86dvh]">
          <SheetHeader className="pe-14">
            <SheetTitle>{t('shell.trip.tab.plan')}</SheetTitle>
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
                  {t('trips.plan.title')}
                </TabsTrigger>
                <TabsTrigger value="places" className="flex-1">
                  {t('trips.plan.places')}
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
    </>
  )
}
