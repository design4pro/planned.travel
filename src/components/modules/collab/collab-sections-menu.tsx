import { useId, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import {
  Button,
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  Spinner,
  toast,
} from '#/components/ui'
import { COLLAB_SECTIONS, enabledCollabSections } from '#/lib/collab-sections'
import type { CollabSectionId, CollabSections } from '#/lib/collab-sections'
import { useTranslate } from '#/lib/i18n'
import { readPublicFailure } from '#/lib/errors'
import { COLLAB_SECTION_PRESENTATION } from './sections'

export function CollabSectionsMenu({
  sections,
  write,
  refresh,
  onWritingChange,
}: {
  sections: CollabSections
  write: (
    section: CollabSectionId,
    on: boolean,
  ) => Promise<{ readonly ok: boolean }>
  refresh: () => Promise<unknown>
  onWritingChange: (writing: boolean) => void
}) {
  const t = useTranslate()
  const footer = useId()
  const locked = useRef(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const escapeClose = useRef(false)
  const [pending, setPending] = useState<CollabSectionId | null>(null)
  const last = enabledCollabSections(sections).length === 1

  async function toggle(id: CollabSectionId): Promise<void> {
    if (locked.current || (last && sections[id])) return
    locked.current = true
    setPending(id)
    onWritingChange(true)
    try {
      const result = await write(id, !sections[id])
      if (!result.ok)
        toast.error(t('trips.collab.sections.failed'), {
          description: t('trips.collab.sections.failedBody'),
        })
    } catch (cause) {
      const failure = readPublicFailure(cause)
      toast.error(t('trips.collab.sections.failed'), {
        description:
          failure.kind === 'unexpected'
            ? t('trips.collab.sections.failedBody')
            : (failure.message ?? t('trips.collab.sections.failedBody')),
      })
    } finally {
      try {
        await refresh()
      } catch {
        toast.error(t('trips.collab.sections.failed'), {
          description: t('trips.collab.sections.failedBody'),
        })
      } finally {
        setPending(null)
        locked.current = false
        onWritingChange(false)
      }
    }
  }

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) escapeClose.current = false
      }}
    >
      <DropdownMenuTrigger asChild>
        <Button
          ref={trigger}
          variant="secondary"
          className="min-h-11"
          data-part="collab-sections-trigger"
        >
          {t('trips.collab.sections.trigger')}
          <ChevronDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        loop
        onEscapeKeyDown={() => {
          escapeClose.current = true
        }}
        onCloseAutoFocus={(event) => {
          if (escapeClose.current) {
            escapeClose.current = false
            event.preventDefault()
            if (trigger.current?.isConnected)
              trigger.current.focus({ preventScroll: true })
          }
          requestAnimationFrame(() => {
            const button = trigger.current
            if (!button || document.activeElement !== button) return
            const rect = button.getBoundingClientRect()
            if (!rect.width || !rect.height) return
            const x = (rect.left + rect.right) / 2
            const obscured = [rect.top + 1, rect.bottom - 1].some(
              (y) => !button.contains(document.elementFromPoint(x, y)),
            )
            if (obscured)
              button.scrollIntoView({ block: 'center', behavior: 'instant' })
          })
        }}
      >
        <DropdownMenuLabel>
          {t('trips.collab.sections.menuLabel')}
        </DropdownMenuLabel>
        {COLLAB_SECTIONS.map(({ id }) => {
          const { label, icon: Icon } = COLLAB_SECTION_PRESENTATION[id]
          const lastOn = last && sections[id]
          return (
            <DropdownMenuCheckboxItem
              key={id}
              checked={sections[id]}
              aria-disabled={pending !== null || lastOn}
              aria-describedby={lastOn ? footer : undefined}
              className="aria-disabled:cursor-default aria-disabled:opacity-60"
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={() => void toggle(id)}
            >
              <span className="flex items-center gap-2">
                <Icon aria-hidden className="size-4 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{t(label)}</span>
                {pending === id ? (
                  <span aria-hidden className="ms-auto shrink-0">
                    <Spinner label={null} />
                  </span>
                ) : null}
              </span>
            </DropdownMenuCheckboxItem>
          )
        })}
        <p id={footer} className="px-2 py-2 text-caption text-ink-3">
          {t('trips.collab.sections.keepOne')}
        </p>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
