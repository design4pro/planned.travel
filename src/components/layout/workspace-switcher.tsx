import { useId, useRef } from 'react'
import { useRouter } from '@tanstack/react-router'
import { toast } from 'sonner'
import {
  authClient,
  thrownToAuthFailure,
  toAuthFailure,
} from '#/lib/auth/client'
import { useTranslate } from '#/lib/i18n'
import { MenuLabel, MenuRadioGroup, MenuRadioItem } from './menu'

import type { ShellOrganization } from './session'

/** Better Auth answers a `set-active` for a workspace the caller does not belong to with this. */
const FORBIDDEN = 403

/**
 * The workspaces a reader belongs to, as a radio list inside the account menu.
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
 */
export function WorkspaceSwitcher({
  organizations,
  activeId,
}: {
  organizations: ReadonlyArray<ShellOrganization>
  activeId: string | null
}) {
  const router = useRouter()
  const t = useTranslate()
  const labelId = useId()
  const switching = useRef(false)

  async function resync(): Promise<void> {
    await router.navigate({ to: '/dashboard' })
    await router.invalidate()
  }

  async function switchTo(organizationId: string): Promise<void> {
    if (organizationId === activeId || switching.current) return
    switching.current = true
    try {
      const failure = await authClient.organization
        .setActive({ organizationId })
        .then(({ error }) => (error ? toAuthFailure(error) : null))
        .catch(thrownToAuthFailure)

      if (failure) {
        toast.error(t('shell.workspace.switchFailed'), {
          description: t('shell.workspace.switchFailedBody'),
        })
        if (failure.status === FORBIDDEN) await resync()
        return
      }
      await resync()
    } finally {
      switching.current = false
    }
  }

  if (organizations.length === 0) return null

  return (
    <>
      <MenuLabel id={labelId}>{t('shell.workspace.label')}</MenuLabel>
      <div className="max-h-64 overflow-y-auto overscroll-contain">
        <MenuRadioGroup
          aria-labelledby={labelId}
          value={activeId ?? ''}
          onValueChange={(organizationId) => {
            void switchTo(organizationId)
          }}
        >
          {organizations.map((organization) => (
            <MenuRadioItem key={organization.id} value={organization.id}>
              <span className="min-w-0 truncate">{organization.name}</span>
            </MenuRadioItem>
          ))}
        </MenuRadioGroup>
      </div>
    </>
  )
}
