/**
 * The settings section index, and the frame every settings section renders in.
 *
 * Kept out of the route file so the seven sections can share it without
 * importing from each other's route modules.
 *
 * The index carries message *keys* rather than sentences. A `SECTIONS` array of
 * English strings cannot be translated at module scope — `t()` needs the
 * catalogue the request negotiated — and a literal key checked against
 * `MessageKey` is what makes a typo here a compile error instead of a nav item
 * that renders its own key.
 */
import { Link } from '@tanstack/react-router'
import {
  Bell,
  Building2,
  CreditCard,
  Languages,
  Palette,
  ShieldCheck,
  UserRound,
} from 'lucide-react'

import { Card } from '#/components/ui'
import { cn } from '#/lib/cn'
import { useTranslate } from '#/lib/i18n'

import type { MessageKey } from '#/lib/i18n'
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * `to` is a param-free literal from the router's own path union, so each entry
 * type-checks against the generated route tree rather than against a string.
 */
interface SettingsSectionLink {
  readonly to:
    | '/settings'
    | '/settings/language'
    | '/settings/appearance'
    | '/settings/security'
    | '/settings/notifications'
    | '/settings/organization'
    | '/settings/billing'
  readonly label: MessageKey
  readonly description: MessageKey
  readonly icon: LucideIcon
  /** Only the index entry must match exactly; the rest own their subtrees. */
  readonly exact?: boolean
}

const SECTIONS: ReadonlyArray<SettingsSectionLink> = [
  {
    to: '/settings',
    label: 'settings.nav.profile',
    description: 'settings.nav.profile.hint',
    icon: UserRound,
    exact: true,
  },
  {
    to: '/settings/language',
    label: 'settings.nav.language',
    description: 'settings.nav.language.hint',
    icon: Languages,
  },
  {
    to: '/settings/appearance',
    label: 'settings.nav.appearance',
    description: 'settings.nav.appearance.hint',
    icon: Palette,
  },
  {
    to: '/settings/security',
    label: 'settings.nav.security',
    description: 'settings.nav.security.hint',
    icon: ShieldCheck,
  },
  {
    to: '/settings/notifications',
    label: 'settings.nav.notifications',
    description: 'settings.nav.notifications.hint',
    icon: Bell,
  },
  {
    to: '/settings/organization',
    label: 'settings.nav.workspace',
    description: 'settings.nav.workspace.hint',
    icon: Building2,
  },
  {
    to: '/settings/billing',
    label: 'settings.nav.billing',
    description: 'settings.nav.billing.hint',
    icon: CreditCard,
  },
]

const ITEM_CLASS = cn(
  'group flex items-center gap-2.5 rounded-lg px-3 py-2.5 whitespace-nowrap focus-ring',
  'transition-colors duration-base ease-out-quint',
  'text-ink-2 hover:bg-hover hover:text-ink',
  'data-[status=active]:bg-surface data-[status=active]:text-ink data-[status=active]:shadow-card',
  'lg:whitespace-normal',
)

const ICON_CLASS =
  'size-4 shrink-0 text-ink-4 transition-colors duration-base ease-out-quint group-data-[status=active]:text-brand'

function ItemBody({
  label,
  description,
}: {
  label: string
  description: string
}) {
  return (
    <span className="min-w-0">
      <span className="block truncate text-label font-semibold">{label}</span>
      <span className="hidden truncate text-caption text-ink-3 lg:block">
        {description}
      </span>
    </span>
  )
}

export function SettingsNav() {
  const t = useTranslate()

  return (
    <nav aria-label={t('settings.nav.label')} className="min-w-0">
      <ul className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0">
        {SECTIONS.map((section) => (
          <li key={section.to} className="shrink-0 lg:min-w-0 lg:shrink">
            <Link
              to={section.to}
              activeOptions={{ exact: section.exact ?? false }}
              className={ITEM_CLASS}
            >
              <section.icon aria-hidden className={ICON_CLASS} />
              <ItemBody
                label={t(section.label)}
                description={t(section.description)}
              />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export interface SettingsSectionProps {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  className?: string
}

/** The card every settings section sits in, so all seven are framed identically. */
export function SettingsSection({
  title,
  description,
  actions,
  children,
  className,
}: SettingsSectionProps) {
  return (
    <Card padding="none" className={cn('flex min-w-0 flex-col', className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-edge-faint px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <h2 className="font-display text-subtitle font-bold tracking-tight text-ink">
            {title}
          </h2>
          {description === undefined ? null : (
            <p className="mt-1 text-caption text-ink-3">{description}</p>
          )}
        </div>
        {actions === undefined ? null : (
          <div className="shrink-0">{actions}</div>
        )}
      </div>
      <div className="min-w-0 px-5 py-5 sm:px-6">{children}</div>
    </Card>
  )
}

/** A label/value/control row inside a settings section. */
export function SettingsRow({
  label,
  hint,
  control,
  className,
}: {
  label: ReactNode
  hint?: ReactNode
  control: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-2 py-4 first:pt-0 last:pb-0 not-last:border-b not-last:border-edge-faint',
        'sm:flex-row sm:items-center sm:justify-between sm:gap-6',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-label font-medium text-ink">{label}</p>
        {hint === undefined ? null : (
          <p className="mt-0.5 text-caption leading-relaxed text-ink-3">
            {hint}
          </p>
        )}
      </div>
      {/* One fixed width, not a min/max range: a column of controls whose widths
          follow their own longest option lands on four different left edges, and
          the eye reads that as a broken grid before it reads any of the labels. */}
      <div className="shrink-0 sm:w-64">{control}</div>
    </div>
  )
}
