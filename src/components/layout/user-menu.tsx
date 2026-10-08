import { useRef, useState } from 'react'
import { Link, useRouter } from '@tanstack/react-router'
import {
  ChevronDown,
  CreditCard,
  LogOut,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
} from 'lucide-react'
import { toast } from 'sonner'
import { Avatar, Spinner } from '#/components/ui'
import { cn } from '#/lib/cn'
import { useTranslate } from '#/lib/i18n'
import { CreateWorkspaceDialog } from './create-workspace-dialog'
import { transitionBase } from './kit'
import {
  MenuContent,
  MenuDangerItem,
  MenuItem,
  MenuRoot,
  MenuSeparator,
  MenuTrigger,
} from './menu'
import { SIGN_OUT_ENDPOINT } from './session'
import { useWorkspaceSwitch, WorkspaceSwitcher } from './workspace-switcher'

import type { ShellSession } from './session'

/**
 * Avatar entry point to account-level destinations. Sign out posts to the auth
 * handler and then throws away every cached loader result, so no page can keep
 * rendering the previous person's data.
 */
export function UserMenu({ session }: { session: ShellSession }) {
  const router = useRouter()
  const t = useTranslate()
  const [open, setOpen] = useState(false)
  const [creating, setCreating] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const [signingOut, setSigningOut] = useState(false)
  const { user, organization, organizations } = session
  const { pendingId, switchTo } = useWorkspaceSwitch({
    activeId: organization?.id ?? null,
    onSettled: () => setOpen(false),
  })

  async function signOut(): Promise<void> {
    setSigningOut(true)
    try {
      const response = await fetch(SIGN_OUT_ENDPOINT, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{}',
      })
      if (!response.ok)
        throw new Error(`Sign out failed with ${response.status}`)
      await router.invalidate()
      await router.navigate({ to: '/login', replace: true })
    } catch {
      toast.error(t('shell.account.signOutFailed'), {
        description: t('shell.account.signOutFailedBody'),
      })
    } finally {
      setSigningOut(false)
    }
  }

  return (
    <>
      <MenuRoot open={open} onOpenChange={setOpen}>
        <MenuTrigger
          ref={trigger}
          className={cn(
            'group inline-flex max-w-56 items-center gap-2 rounded-full border border-transparent p-1 text-label font-medium text-ink focus-ring',
            transitionBase,
            'hover:border-edge hover:bg-surface-2 active:bg-surface-inset sm:pe-2.5',
          )}
          aria-label={t('shell.account.menu')}
        >
          <Avatar name={user.name} src={user.image} />
          <span className="hidden min-w-0 truncate sm:block">{user.name}</span>
          <ChevronDown
            aria-hidden
            className="hidden size-4 shrink-0 text-ink-4 transition-transform duration-base ease-out-quint group-data-[state=open]:rotate-180 sm:block"
            data-motion-transform
          />
        </MenuTrigger>

        <MenuContent className="max-h-[var(--radix-dropdown-menu-content-available-height)] max-w-[min(20rem,var(--radix-dropdown-menu-content-available-width))] min-w-64 overflow-y-auto">
          <div className="flex items-center gap-3 px-2.5 py-2.5">
            <Avatar name={user.name} src={user.image} size="lg" />
            <div className="min-w-0">
              <p className="truncate text-label font-semibold text-ink">
                {user.name}
              </p>
              <p className="truncate text-caption text-ink-3">{user.email}</p>
            </div>
          </div>

          <WorkspaceSwitcher
            organizations={organizations}
            activeId={organization?.id ?? null}
            pendingId={pendingId}
            onSwitch={switchTo}
            onCreate={() => setCreating(true)}
          />

          <MenuSeparator />

          <MenuItem asChild>
            <Link to="/settings">
              <Settings aria-hidden className="size-4 text-ink-4" />
              {t('shell.account.settings')}
            </Link>
          </MenuItem>
          <MenuItem asChild>
            <Link to="/settings/billing">
              <CreditCard aria-hidden className="size-4 text-ink-4" />
              {t('shell.account.billing')}
            </Link>
          </MenuItem>
          {user.isAdmin ? (
            <MenuItem asChild>
              <Link to="/admin">
                <ShieldCheck aria-hidden className="size-4 text-ink-4" />
                {t('shell.account.admin')}
              </Link>
            </MenuItem>
          ) : null}

          {/*
          The platform console, kept visibly apart from the workspace panel above it.

          Two different vocabularies live one line from each other here, and `docs/SPEC.md` §5 says
          they must never be conflated: `isAdmin` is this person's membership role in the workspace
          they are currently looking at, and `isPlatformAdmin` / `isCurator` is their standing on
          the product itself. An owner of their own workspace is `isAdmin` and almost certainly
          `platformRole: 'user'`. So the two entries get their own separator band, their own glyph —
          a second ShieldCheck would read as the same destination twice — and labels that name what
          each one governs rather than both saying "Admin".

          `docs/ACCESS.md` §2.3: the entry is not rendered for a `user`, which is nearly everybody.
          Hiding it is a courtesy; the console's own `beforeLoad` guard is the boundary.
        */}
          {user.isPlatformAdmin || user.isCurator ? (
            <>
              <MenuSeparator />
              <MenuItem asChild>
                <Link to="/console">
                  <SlidersHorizontal
                    aria-hidden
                    className="size-4 text-brand"
                  />
                  Platform console
                </Link>
              </MenuItem>
            </>
          ) : null}

          <MenuSeparator />

          <MenuDangerItem
            disabled={signingOut}
            onSelect={(event) => {
              // Keep the menu mounted while the request is in flight so the
              // spinner is visible instead of the menu vanishing mid-action.
              event.preventDefault()
              void signOut()
            }}
          >
            {signingOut ? (
              <Spinner size="sm" label={null} />
            ) : (
              <LogOut aria-hidden data-mirror-rtl className="size-4" />
            )}
            {signingOut
              ? t('shell.account.signingOut')
              : t('shell.account.signOut')}
          </MenuDangerItem>
        </MenuContent>
      </MenuRoot>

      {/* A sibling of the menu, not a child: its content unmounts when an item is chosen. */}
      <CreateWorkspaceDialog
        open={creating}
        onOpenChange={setCreating}
        onCloseAutoFocus={() => trigger.current?.focus()}
      />
    </>
  )
}
