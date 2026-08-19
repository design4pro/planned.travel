import { Link } from '@tanstack/react-router'
import { Bell } from 'lucide-react'
import { cn } from '#/lib/cn'
import { transitionBase } from './kit'

export interface NotificationBellProps {
  /** 0 hides the marker entirely — an empty tray should look empty. */
  unreadCount?: number
  className?: string
}

export function NotificationBell({ unreadCount = 0, className }: NotificationBellProps) {
  const hasUnread = unreadCount > 0
  const shown = unreadCount > 9 ? '9+' : String(unreadCount)

  return (
    <Link
      to="/notifications"
      aria-label={
        hasUnread ? `Notifications, ${unreadCount} unread` : 'Notifications, none unread'
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
            'numeral absolute -right-0.5 -top-0.5 grid min-w-4 place-items-center rounded-full bg-brand px-1 text-[0.5625rem] font-bold leading-4 text-brand-on',
            'ring-2 ring-canvas',
          )}
        >
          {shown}
        </span>
      ) : null}
    </Link>
  )
}
