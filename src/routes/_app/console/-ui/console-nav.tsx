/**
 * The console's section index.
 *
 * Modelled on `src/routes/_app/-ui/settings-nav.tsx`, down to the `data-[status=active]` treatment,
 * so the two administrative shells in the product read as one design rather than two.
 *
 * **`to` is a local literal union, and that is deliberate.** The product's own navigation model in
 * `src/components/layout/nav-model.ts` declares a closed four-member destination union, and both the
 * segmented control in the top bar and the bottom bar on a phone consume it; widening that union to
 * fit a console section would widen what the product's own navigation accepts, for no product
 * reason. The union below is this file's, it type-checks against the generated route tree exactly as
 * the settings one does, and nothing outside this directory can be changed by editing it.
 *
 * **Sections a role cannot reach are absent rather than disabled.** `docs/ACCESS.md` §2.3 puts
 * `user:*` and `session:*` in the `admin` column alone, so a `curator` has no accounts surface at
 * all — not a greyed one. A disabled tab advertises a capability and then refuses it, which is the
 * shape of an upsell rather than of a permission model.
 */

import { Link } from '@tanstack/react-router'
import { LayoutDashboard, Users } from 'lucide-react'

import { cn } from '#/lib/cn'

import type { ConsoleAccess } from '../-server/access'
import type { LucideIcon } from 'lucide-react'

/** `to` is a param-free literal from the router's own path union. */
interface ConsoleSectionLink {
  readonly to: '/console' | '/console/users'
  readonly label: string
  readonly description: string
  readonly icon: LucideIcon
  /** Only the index entry must match exactly; the rest own their subtrees. */
  readonly exact?: boolean
  /** Which standing this section needs. */
  readonly needs: 'curate' | 'users'
}

const SECTIONS: ReadonlyArray<ConsoleSectionLink> = [
  {
    to: '/console',
    label: 'Overview',
    description: 'The platform at a glance',
    icon: LayoutDashboard,
    exact: true,
    needs: 'curate',
  },
  {
    to: '/console/users',
    label: 'Accounts',
    description: 'Roles, suspensions and sessions',
    icon: Users,
    needs: 'users',
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

export function ConsoleNav({ access }: { access: ConsoleAccess }) {
  const visible = SECTIONS.filter((section) =>
    section.needs === 'users' ? access.canManageUsers : access.canCurate,
  )

  return (
    <nav aria-label="Console sections" className="min-w-0">
      <ul className="scrollbar-none -mx-1 flex gap-2 overflow-x-auto px-1 lg:mx-0 lg:flex-col lg:gap-1 lg:overflow-visible lg:px-0">
        {visible.map((section) => (
          <li key={section.to} className="shrink-0 lg:min-w-0 lg:shrink">
            <Link
              to={section.to}
              activeOptions={{ exact: section.exact ?? false }}
              className={ITEM_CLASS}
            >
              <section.icon aria-hidden className={ICON_CLASS} />
              <span className="min-w-0">
                <span className="block truncate text-label font-semibold">
                  {section.label}
                </span>
                <span className="hidden truncate text-caption text-ink-3 lg:block">
                  {section.description}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
