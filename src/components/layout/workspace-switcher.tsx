import { useId, useRef, useState } from 'react'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  authClient,
  thrownToAuthFailure,
  toAuthFailure,
} from '#/lib/auth/client'
import { Spinner } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { MenuLabel, MenuRadioGroup, MenuRadioItem } from './menu'

import type { ShellOrganization } from './session'

/** Better Auth answers a `set-active` for a workspace the caller does not belong to with this. */
const FORBIDDEN = 403
/** The session ended between opening the menu and choosing; the shell's guard sends the reader to sign in. */
const UNAUTHORIZED = 401

/**
 * The switch itself, owned by a component that outlives the menu.
 *
 * The workspace is not in the URL: it is `session.activeOrganizationId`, so switching is a mutation
 * and the checked item follows `activeId`, which only moves once the router has re-read the shell.
 * Choosing one activates it, goes to `/dashboard`, and only then drops every cached loader result.
 * The order is the point: invalidating on `/trips/abc` would re-run that loader against the new
 * workspace and throw not-found for a trip the reader can no longer see, while `/dashboard` means
 * the same thing in every workspace.
 *
 * Better Auth clears the session's active workspace *before* it refuses a non-member, so a 403 is
 * not "nothing changed": the next request falls back to the oldest membership. The screen is
 * re-synced after the toast, exactly as for a success, rather than left showing the old workspace.
 * A 401 is re-synced too: the shell's `beforeLoad` then redirects to sign in.
 *
 * The guard and the pending id live here, not in the list: the menu's content unmounts whenever the
 * menu closes (Escape, an outside click), and a guard that went with it would let a reopened menu
 * start a second switch while the first is still running. `onSettled` runs once the screen has been
 * re-synced.
 */
export function useWorkspaceSwitch({
  activeId,
  onSettled,
}: {
  activeId: string | null
  onSettled: () => void
}): { pendingId: string | null; switchTo: (organizationId: string) => void } {
  const router = useRouter()
  const t = useTranslate()
  const switching = useRef(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function resync(): Promise<void> {
    // A cached `/dashboard` of the previous workspace would otherwise show, stale, under the new
    // workspace's name while it reloads. `replace` keeps Back from returning to a trip that
    // belongs to the workspace just left.
    router.clearCache()
    await router.navigate({ to: '/dashboard', replace: true })
    await router.invalidate()
  }

  async function run(organizationId: string): Promise<void> {
    if (organizationId === activeId || switching.current) return
    switching.current = true
    setPendingId(organizationId)
    try {
      const failure = await authClient.organization
        .setActive({ organizationId })
        .then(({ error }) => (error ? toAuthFailure(error) : null))
        .catch(thrownToAuthFailure)

      if (failure) {
        // The session was moved or ended, which "check your connection" would misdescribe.
        const mustResync =
          failure.status === FORBIDDEN || failure.status === UNAUTHORIZED
        toast.error(
          t('shell.workspace.switchFailed'),
          mustResync
            ? undefined
            : { description: t('shell.workspace.switchFailedBody') },
        )
        if (mustResync) await resync()
        return
      }
      await resync()
    } finally {
      switching.current = false
      setPendingId(null)
      onSettled()
    }
  }

  return {
    pendingId,
    switchTo: (organizationId) => {
      void run(organizationId)
    },
  }
}

/**
 * The workspaces a reader belongs to, as a radio list inside the account menu.
 *
 * The menu stays open while a switch is in flight, as the sign-out item does: the chosen item shows
 * a spinner and the others are disabled. The pending state is announced by a status region inside
 * the menu: an item's own children are presentational to a screen reader, and the open menu is
 * modal, so a region outside it would be hidden from assistive technology.
 */
export function WorkspaceSwitcher({
  organizations,
  activeId,
  pendingId,
  onSwitch,
}: {
  organizations: ReadonlyArray<ShellOrganization>
  activeId: string | null
  pendingId: string | null
  onSwitch: (organizationId: string) => void
}) {
  const t = useTranslate()
  const labelId = useId()

  if (organizations.length === 0) return null

  return (
    <>
      <MenuLabel id={labelId}>{t('shell.workspace.label')}</MenuLabel>
      <div className="max-h-64 overflow-y-auto overscroll-contain">
        <MenuRadioGroup
          aria-labelledby={labelId}
          aria-busy={pendingId !== null}
          value={activeId ?? ''}
          onValueChange={onSwitch}
        >
          {organizations.map((organization) => (
            <MenuRadioItem
              key={organization.id}
              value={organization.id}
              disabled={pendingId !== null && pendingId !== organization.id}
              onSelect={(event) => {
                // Choosing the active workspace changes nothing, so the menu may close as usual.
                if (organization.id !== activeId) event.preventDefault()
              }}
            >
              <span className="min-w-0 break-words" dir="auto">
                {organization.name}
              </span>
              {pendingId === organization.id ? (
                <span className="absolute end-2.5 flex items-center">
                  <Spinner size="sm" label={null} />
                </span>
              ) : null}
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </div>
      {/* Always mounted, so the text change is what a screen reader announces. */}
      <div role="status" className="sr-only">
        {pendingId === null ? '' : t('ui.status.loading')}
      </div>
    </>
  )
}
