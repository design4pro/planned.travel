import { useEffect, useId, useState } from 'react'
import {
  Button,
  Popover,
  PopoverAnchor,
  PopoverContent,
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from '#/components/ui'
import { MEDIA_MD_DOWN } from '#/lib/breakpoints'
import { useTranslate } from '#/lib/i18n'
import { ENTRY_KINDS, KIND_COST_LINE } from '#/lib/vacay/entry-kinds'
import { KIND_LABEL, COST_LABEL } from './copy'
import { KindCue } from './day-cell'
import type { EntryKind } from '#/lib/vacay/entry-kinds'

export function DayPicker({
  title,
  anchor,
  kind,
  clearOnly,
  onChoose,
  onClose,
}: {
  title: string
  anchor: HTMLButtonElement
  kind?: EntryKind
  clearOnly: boolean
  onChoose: (kind: EntryKind | null) => void
  onClose: () => void
}) {
  const t = useTranslate()
  const id = useId()
  const [narrow, setNarrow] = useState(false)
  useEffect(() => {
    const media = window.matchMedia(MEDIA_MD_DOWN)
    setNarrow(media.matches)
    const change = () => setNarrow(media.matches)
    media.addEventListener('change', change)
    return () => media.removeEventListener('change', change)
  }, [])
  const restore = (event: Event) => {
    event.preventDefault()
    if (anchor.isConnected) anchor.focus()
  }
  const choices = (
    <div className="flex flex-col gap-1 p-3">
      {clearOnly
        ? null
        : ENTRY_KINDS.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={kind === value}
              onClick={() => onChoose(value)}
              className="flex min-h-11 items-center gap-3 rounded-md px-3 py-2 text-start hover:bg-surface-inset focus-visible:outline-2 focus-visible:outline-current"
            >
              <KindCue kind={value} />
              <span>
                <span className="block text-label font-semibold">
                  {t(KIND_LABEL[value])}
                </span>{' '}
                <span className="block text-caption text-ink-3">
                  {t(COST_LABEL[KIND_COST_LINE[value]])}
                </span>
              </span>
            </button>
          ))}
      {kind ? (
        <Button variant="secondary" onClick={() => onChoose(null)}>
          {t('modules.vacay.day.clear')}
        </Button>
      ) : null}
    </div>
  )
  if (narrow)
    return (
      <Sheet
        open
        onOpenChange={(open) => {
          if (!open) onClose()
        }}
      >
        <SheetContent
          className="md:hidden"
          side="bottom"
          onCloseAutoFocus={restore}
        >
          <SheetTitle className="px-6 pt-4">{title}</SheetTitle>
          <SheetDescription className="sr-only">
            {t('modules.vacay.day.choose')}
          </SheetDescription>
          {choices}
        </SheetContent>
      </Sheet>
    )
  return (
    <Popover
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <PopoverAnchor virtualRef={{ current: anchor }} />
      <PopoverContent
        className="max-md:hidden"
        role="dialog"
        aria-labelledby={id}
        onCloseAutoFocus={restore}
        padding="none"
      >
        <h3 id={id} className="px-6 pt-4 font-semibold">
          {title}
        </h3>
        {choices}
      </PopoverContent>
    </Popover>
  )
}
