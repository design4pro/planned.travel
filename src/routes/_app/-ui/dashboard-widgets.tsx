import { useCallback, useEffect, useState } from 'react'
import { PanelRight, SlidersHorizontal } from 'lucide-react'

import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Sheet,
  SheetBody,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  useSheetDirection,
} from '#/components/ui'
import {
  DASHBOARD_WIDGET_IDS,
  dashboardWidgetPreference,
} from '#/lib/clock-zones'
import { useI18n } from '#/lib/i18n'
import { useLocalPreference } from '#/lib/local-preference'

import type { DashboardWidgetId } from '#/lib/clock-zones'
import type { MessageKey } from '#/lib/i18n'
import type { ReactNode } from 'react'

/**
 * The dashboard's reference column: which widgets it holds, where it sits at
 * each breakpoint, and the menu that folds them away.
 *
 * ## Why the existing rail panels are widgets too
 *
 * The stage's Definition of Done says the column collapses when every widget is
 * switched off. `/dashboard` already shipped a right rail holding the bookings
 * list, the trip pipeline and the storage meter, so if the clock were the only
 * thing the menu governed, switching it off would leave three panels standing in
 * a column the ticket says is gone. All four are therefore one widget set. Their
 * bodies are untouched — only where they are mounted moved.
 *
 * ## Why the menu lives in the header and not in the column
 *
 * Because the column can be emptied. A menu inside it would go with the last
 * widget and leave the reader no way of bringing anything back.
 */

/** Each widget's own heading, reused so the menu and the panel never disagree. */
const WIDGET_LABEL: Record<DashboardWidgetId, MessageKey> = {
  clock: 'shell.dashboard.clock.label',
  bookings: 'shell.dashboard.bookings.label',
  tripMix: 'shell.dashboard.pipeline.label',
  storage: 'shell.dashboard.storage.label',
}

export interface DashboardWidgets {
  /** The widgets to draw, in the column's own order. */
  readonly shown: ReadonlyArray<DashboardWidgetId>
  readonly isShown: (id: DashboardWidgetId) => boolean
  readonly toggle: (id: DashboardWidgetId) => void
  /** The pinned zones exactly as stored, `null` when never chosen. */
  readonly zones: ReadonlyArray<string> | null
  readonly setZones: (next: ReadonlyArray<string>) => void
}

/**
 * The one record behind the column, read as a browser preference.
 *
 * It satisfies `local-preference.ts`'s first rule — a stored preference is never
 * the sole source of a layout-affecting first paint — by defaulting to *every*
 * widget shown. The server and the hydrating client therefore draw the column
 * the route has always drawn, and a reader who folded something away sees it
 * fold in the commit after rather than seeing the page assemble itself.
 */
export function useDashboardWidgets(): DashboardWidgets {
  const [record, write] = useLocalPreference(dashboardWidgetPreference)

  const isShown = useCallback(
    (id: DashboardWidgetId) => record.shown.includes(id),
    [record.shown],
  )

  const toggle = useCallback(
    (id: DashboardWidgetId) => {
      // Rebuilt from the canonical order rather than appended to, so a widget
      // switched off and on again comes back where it was rather than last.
      const next = DASHBOARD_WIDGET_IDS.filter((widget) =>
        widget === id
          ? !record.shown.includes(id)
          : record.shown.includes(widget),
      )
      write({ ...record, shown: next })
    },
    [record, write],
  )

  const setZones = useCallback(
    (next: ReadonlyArray<string>) => {
      write({ ...record, zones: next })
    },
    [record, write],
  )

  return {
    shown: DASHBOARD_WIDGET_IDS.filter(isShown),
    isShown,
    toggle,
    zones: record.zones,
    setZones,
  }
}

/**
 * The visibility menu. Selecting an item does not close the menu: a reader
 * deciding what the column holds is making several decisions, not one.
 */
export function DashboardWidgetsMenu({
  widgets,
}: {
  widgets: DashboardWidgets
}) {
  const { t } = useI18n()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          shape="pill"
          data-part="dashboard-widgets-menu"
        >
          <SlidersHorizontal aria-hidden />
          {t('shell.dashboard.widgets.choose')}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-56">
        <DropdownMenuLabel>
          {t('shell.dashboard.widgets.label')}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {DASHBOARD_WIDGET_IDS.map((id) => (
          <DropdownMenuCheckboxItem
            key={id}
            checked={widgets.isShown(id)}
            onCheckedChange={() => {
              widgets.toggle(id)
            }}
            onSelect={(event) => {
              event.preventDefault()
            }}
          >
            {t(WIDGET_LABEL[id])}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * Whether the widgets belong in the sheet rather than in the column.
 *
 * A real media-query read rather than two CSS-hidden copies, for the reason
 * `plan-screen.tsx` gives for the same shape: the column and the sheet draw the
 * *same* widgets, so mounting both would put two of every `data-part` in the
 * document and run the clock's timer twice.
 *
 * It starts `false` so a desktop first paint is already correct, and the column
 * also carries `hidden md:block`, which keeps it invisible during the single
 * pre-effect frame on a phone.
 */
export function useWidgetsInSheet(): boolean {
  const [inSheet, setInSheet] = useState(false)

  useEffect(() => {
    const query = window.matchMedia('(max-width: 767px)')
    const read = (): void => {
      setInSheet(query.matches)
    }
    read()
    query.addEventListener('change', read)
    return () => {
      query.removeEventListener('change', read)
    }
  }, [])

  return inSheet
}

/**
 * The column itself, and the row it becomes on a middle-sized screen.
 *
 * At `xl` it is the grid's second track, sticky under the app nav so it stays
 * beside whatever the reader has scrolled to. Between `md` and `xl` the grid is
 * a single column, so `order-first` puts these above the trip list as a row of
 * widgets — a 900px screen has room for the widgets but not for a permanent
 * second column.
 */
export function DashboardWidgetsColumn({ children }: { children: ReactNode }) {
  return (
    <aside
      data-part="dashboard-widgets-column"
      className="order-first hidden min-w-0 md:block xl:sticky xl:top-24 xl:order-none xl:self-start"
    >
      <div className="grid min-w-0 gap-6 md:grid-cols-2 xl:grid-cols-1">
        {children}
      </div>
    </aside>
  )
}

/**
 * The phone's way in: a compact trigger in the dashboard header opening the
 * same widgets in the shipped bottom sheet, which brings its own drag-to-dismiss,
 * focus trap and `Escape`.
 *
 * The body is mounted only while the sheet is open, so a phone pays for no
 * widget it is not looking at.
 */
export function DashboardWidgetsSheet({ children }: { children: ReactNode }) {
  const { t } = useI18n()
  const direction = useSheetDirection('bottom')

  return (
    <Sheet direction={direction}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          shape="pill"
          data-part="dashboard-widgets-trigger"
        >
          <PanelRight aria-hidden data-mirror-rtl />
          {t('shell.dashboard.widgets.label')}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" data-part="dashboard-widgets-sheet">
        <SheetHeader className="pe-14">
          <SheetTitle>{t('shell.dashboard.widgets.label')}</SheetTitle>
          <SheetDescription>
            {t('shell.dashboard.widgets.description')}
          </SheetDescription>
        </SheetHeader>
        <SheetBody>
          <div className="flex min-w-0 flex-col gap-6">{children}</div>
        </SheetBody>
      </SheetContent>
    </Sheet>
  )
}
