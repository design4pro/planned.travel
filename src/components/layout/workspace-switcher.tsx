import { useId, useRef, useState } from 'react'
import { flushSync } from 'react-dom'
import { useRouter } from '@tanstack/react-router'
import { Plus } from 'lucide-react'
import { toast } from 'sonner'
import {
  authClient,
  thrownToAuthFailure,
  toAuthFailure,
} from '#/lib/auth/client'
import { Spinner } from '#/components/ui'
import { useTranslate } from '#/lib/i18n'
import { MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem } from './menu'

import { foldWorkspaceName } from './workspace-name'

import type { ShellOrganization } from './session'

/** Better Auth answers a `set-active` for a workspace the caller does not belong to with this. */
const FORBIDDEN = 403
/** The session ended between opening the menu and choosing; the shell's guard sends the reader to sign in. */
const UNAUTHORIZED = 401

/**
 * Brings the screen in line with the session's active workspace, after it moved.
 *
 * The workspace is not in the URL: it is `session.activeOrganizationId`. Goes to `/dashboard`
 * first and only then drops every cached loader result. The order is the point: invalidating on
 * `/trips/abc` would re-run that loader against the new workspace and throw not-found for a trip
 * the reader can no longer see, while `/dashboard` means the same thing in every workspace.
 * Used by the switch and by creating a workspace, which activates the one it made.
 */
export function useWorkspaceResync() {
  const router = useRouter()

  return async () => {
    // A cached `/dashboard` of the previous workspace would otherwise show, stale, under the new
    // workspace's name while it reloads. `replace` keeps Back from returning to a trip that
    // belongs to the workspace just left.
    router.clearCache()
    await router.navigate({ to: '/dashboard', replace: true })
    await router.invalidate()
  }
}

/**
 * The switch itself, owned by a component that outlives the menu.
 *
 * The checked item follows `activeId`, which only moves once the router has re-read the shell.
 * Choosing one activates it and then re-syncs the screen (see {@link useWorkspaceResync}).
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
  organizations,
  onSettled,
}: {
  activeId: string | null
  organizations: ReadonlyArray<ShellOrganization>
  onSettled: () => void
}): { pendingId: string | null; switchTo: (organizationId: string) => void } {
  const t = useTranslate()
  const resync = useWorkspaceResync()
  const switching = useRef(false)
  const [pendingId, setPendingId] = useState<string | null>(null)

  async function run(organizationId: string): Promise<void> {
    if (organizationId === activeId || switching.current) return
    const chosen = organizations.find((item) => item.id === organizationId)
    if (!chosen) return
    const chosenName = chosen.name
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
      // Commit the close, including Radix's modal cleanup, before announcing outside the menu.
      flushSync(() => {
        setPendingId(null)
        onSettled()
      })
    }
    toast.success(
      t('shell.workspace.switched', { name: `\u2068${chosenName}\u2069` }),
    )
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
  onCreate,
}: {
  organizations: ReadonlyArray<ShellOrganization>
  activeId: string | null
  pendingId: string | null
  onSwitch: (organizationId: string) => void
  /** Raised when "Create workspace" is chosen; the dialog it opens belongs to the caller. */
  onCreate: () => void
}) {
  const t = useTranslate()
  const labelId = useId()

  const nameCounts = new Map<string, number>()
  for (const organization of organizations) {
    const name = foldWorkspaceName(organization.name)
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1)
  }

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
              className="min-h-11"
              disabled={pendingId !== null && pendingId !== organization.id}
              onSelect={(event) => {
                // Choosing the active workspace changes nothing, so the menu may close as usual.
                if (organization.id !== activeId) event.preventDefault()
              }}
            >
              <span className="min-w-0 flex-1">
                <span className="block break-words">
                  <bdi>{organization.name}</bdi>
                </span>
                {(nameCounts.get(foldWorkspaceName(organization.name)) ?? 0) >
                1 ? (
                  <span className="block text-micro text-ink-3 [overflow-wrap:anywhere]">
                    <span dir="ltr">{organization.slug}</span>
                  </span>
                ) : null}
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
      {/* Visible and enabled for every role and plan: a refusal is explained in the dialog. */}
      <MenuItem disabled={pendingId !== null} onSelect={onCreate}>
        <Plus aria-hidden className="size-4 text-ink-4" />
        {t('shell.workspace.create')}
      </MenuItem>
      {/* Always mounted, so the text change is what a screen reader announces. */}
      <div role="status" className="sr-only">
        {pendingId === null ? '' : t('ui.status.loading')}
      </div>
    </>
  )
}
