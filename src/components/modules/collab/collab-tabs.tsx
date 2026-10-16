import { useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { ScrollArea, Tabs, TabsList, TabsTrigger } from '#/components/ui'
import { COLLAB_SECTIONS, activeCollabSection } from '#/lib/collab-sections'
import type { CollabSectionId } from '#/lib/collab-sections'
import { COLLAB_TABS_STICKY_CLASS } from '#/lib/atlas/layout'
import { cn } from '#/lib/cn'
import { useLocale, useTranslate } from '#/lib/i18n'
import { COLLAB_SECTION_PRESENTATION } from './sections'

/** CSS owns the breakpoint; panels remain mounted through tab and viewport changes. */
export function CollabTabs({
  visible,
  children,
}: {
  visible: ReadonlyArray<CollabSectionId>
  children: ReactNode
}) {
  const t = useTranslate()
  const locale = useLocale()
  const [selected, setSelected] = useState<CollabSectionId | null>(null)
  const ordered = COLLAB_SECTIONS.filter(({ id }) => visible.includes(id)).map(
    ({ id }) => id,
  )
  const active = activeCollabSection(ordered, selected)
  if (selected !== null && selected !== active) setSelected(active ?? null)
  const root = useRef<HTMLDivElement>(null)
  const bar = useRef<HTMLDivElement>(null)
  const positions = useRef<Partial<Record<CollabSectionId, number>>>({})
  function select(value: string) {
    const next = ordered.find((id) => id === value)
    if (!next || next === active) return
    if (active) positions.current[active] = window.scrollY
    setSelected(next)
    requestAnimationFrame(() => {
      // DOM visibility distinguishes the mobile control without a media query.
      if (!bar.current?.getClientRects().length) return
      const panel = root.current?.querySelector<HTMLElement>(
        `[data-collab-section="${next}"]`,
      )
      if (!panel) return
      const remembered = positions.current[next]
      if (remembered !== undefined)
        window.scrollTo({ top: remembered, behavior: 'instant' })
      if (
        panel.getBoundingClientRect().top <
        bar.current.getBoundingClientRect().bottom
      ) {
        panel.scrollIntoView({ block: 'start', behavior: 'instant' })
      }
    })
  }
  return (
    <Tabs
      ref={root}
      value={active}
      onValueChange={select}
      dir={locale === 'ar' ? 'rtl' : 'ltr'}
      className="min-w-0"
    >
      <div
        ref={bar}
        className={cn(
          'sticky z-20 bg-surface xl:hidden',
          COLLAB_TABS_STICKY_CLASS,
        )}
      >
        <ScrollArea axis="horizontal" viewportClassName="p-1">
          <TabsList
            aria-label={t('trips.collab.sections.tabsLabel')}
            className="w-max min-w-full flex-nowrap"
          >
            {ordered.map((id) => {
              const { label, icon: Icon } = COLLAB_SECTION_PRESENTATION[id]
              return (
                <TabsTrigger key={id} value={id} icon={<Icon />}>
                  {t(label)}
                </TabsTrigger>
              )
            })}
          </TabsList>
        </ScrollArea>
      </div>
      {children}
    </Tabs>
  )
}
