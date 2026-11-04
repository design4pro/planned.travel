import { useEffect, useRef } from 'react'
import { Link, useRouterState } from '@tanstack/react-router'
import { useTranslate } from '#/lib/i18n'

const rooms = [
  { to: '/admin', label: 'shell.admin.nav.overview', exact: true },
  { to: '/admin/members', label: 'shell.admin.nav.members', exact: false },
  { to: '/admin/audit', label: 'shell.admin.nav.audit', exact: false },
] as const

export function ConsoleTabs() {
  const t = useTranslate()
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const previous = useRef(pathname)
  useEffect(() => {
    if (previous.current !== pathname) {
      previous.current = pathname
      document.getElementById('workspace-console-room')?.focus()
    }
  }, [pathname])
  return <nav aria-label={t('shell.admin.nav.label')} className="min-w-0 overflow-x-auto"><ul className="flex min-w-max border-b border-edge-faint">{rooms.map((room) => <li key={room.to}><Link to={room.to} activeOptions={{ exact: room.exact }} className="focus-ring flex min-h-11 items-center border-b-2 border-transparent px-4 text-label text-ink-2 data-[status=active]:border-brand data-[status=active]:text-ink">{t(room.label)}</Link></li>)}</ul></nav>
}
