import { Link } from '@tanstack/react-router'
import { Bell } from 'lucide-react'
import { cn } from '#/lib/cn'
import { formatNumber } from '#/lib/format'
import { useI18n } from '#/lib/i18n'
import { transitionBase } from './kit'

export interface NotificationBellProps {
  /** 0 hides the marker entirely — an empty tray should look empty. */
  unreadCount?: number
  className?: string
}

/** Above this the exact figure stops being useful and starts being wide. */
const OVERFLOW_AT = 9

/**
 * The inbox entry point, and the one number in the chrome that changes while a
 * page is open.
 *
 * Two things keep it from shifting the bar. The marker is out of flow, so its
 * content can never push the bell's 36px box around; and its box is a fixed
 * `size-4` square rather than a `min-w` that grows, so switching from `en` to
 * `de` (`1.234`) or to `ar` — which carries the `latn` numbering system as a
 * bare tag, so `1,234` and never Arabic-Indic digits — repaints the same
 * geometry. `tabular-nums` holds the glyph advance steady between 1 and 9.
 *
 * The figure is also spoken, because a coloured dot is not an accessible name:
 * the link's label carries the count in the reader's own language and grouping.
 */
export function NotificationBell({ unreadCount = 0, className }: NotificationBellProps) {
  const { t, locale } = useI18n()
  const hasUnread = unreadCount > 0
  const unread = formatNumber(unreadCount, locale)
  const shown =
    unreadCount > OVERFLOW_AT
      ? t('ui.badge.overflow', { max: formatNumber(OVERFLOW_AT, locale) })
      : unread

  return (
    <Link
      to="/notifications"
      aria-label={
        hasUnread
          ? t('shell.bell.unread', { count: unreadCount, unread })
          : t('shell.bell.none')
      }
      className={cn(
        'relative inline-flex size-9 shrink-0 items-center justify-center rounded-full text-ink-3 focus-ring',
        transitionBase,
        'hover:bg-hover hover:text-ink active:bg-active aria-[current=page]:bg-surface-2 aria-[current=page]:text-ink',
        className,
      )}
    >
      <Bell aria-hidden className="size-[18px]" />
      {hasUnread ? (
        <span
          aria-hidden
          className={cn(
            'absolute -top-0.5 -end-0.5 grid size-4 place-items-center rounded-full',
            'bg-brand text-micro leading-none font-bold tabular-nums text-brand-on',
            'ring-2 ring-canvas',
          )}
        >
          {/* The isolation goes on an inner span, never on the positioned box.
              Measured in Chromium: `inset-inline-end` resolves against the
              element's *own* `direction`, and the `[data-numeric]` rule in
              `src/styles/styles.css` sets `direction: ltr` — so the attribute on
              this box turned `-end-0.5` back into `right: -2px` and parked the
              badge on the physical right of the bell in an RTL document. The
              isolation is still wanted, because "9+" in an Arabic paragraph puts
              its neutral `+` on the wrong side of the digit. */}
          <span data-numeric>{shown}</span>
        </span>
      ) : null}
    </Link>
  )
}
