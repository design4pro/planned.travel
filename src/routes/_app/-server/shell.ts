/**
 * What the application chrome needs before any module renders: who is signed
 * in, which workspace they are looking at, and how loud their inbox is.
 *
 * `_app/route.tsx` calls this once in `beforeLoad`, which is what stops a child
 * loader from ever running for an anonymous visitor.
 */
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'

import { getAuth } from '#/server/auth'
import { authDb } from '#/server/auth/db'
import {
  firstOrganizationIdFor,
  membershipRoleFor,
} from '#/server/auth/provisioning'
import { getSession } from '#/server/auth/session'
import { isOrganizationRole, roleSatisfies } from '#/server/auth/tenant'
import { getDb } from '#/server/db/client'
import { countUnread, createScope, getOrganization } from '#/server/repos'

import type { OrganizationRole } from '#/server/auth/tenant'
import type {
  ShellOrganization,
  ShellSession,
} from '#/components/layout/session'

export interface ShellPayload {
  readonly session: ShellSession
  readonly unreadCount: number
  readonly role: OrganizationRole
}

/** Narrows Better Auth's organization list without trusting its shape. */
function toShellOrganizations(value: unknown): Array<ShellOrganization> {
  if (!Array.isArray(value)) {
    return []
  }
  const mapped: Array<ShellOrganization> = []
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) {
      continue
    }
    const record: Record<string, unknown> = { ...entry }
    const { id, name, slug } = record
    if (
      typeof id === 'string' &&
      typeof name === 'string' &&
      typeof slug === 'string'
    ) {
      mapped.push({ id, name, slug })
    }
  }
  return mapped
}

/**
 * The workspaces this person belongs to. A failure here must never take the
 * whole shell down, so the active workspace stands in on its own.
 */
async function listShellOrganizations(
  active: ShellOrganization,
): Promise<Array<ShellOrganization>> {
  try {
    const raw = await getAuth().api.listOrganizations({
      headers: getRequest().headers,
    })
    const mapped = toShellOrganizations(raw)
    return mapped.length === 0 ? [active] : mapped
  } catch {
    return [active]
  }
}

export const loadShell = createServerFn({ method: 'GET' }).handler(
  async (): Promise<ShellPayload | null> => {
    const session = await getSession()
    if (!session) {
      return null
    }

    const auth = authDb()
    // A session minted before the workspace existed still carries a null active
    // organization; fall back to the oldest membership rather than failing.
    const organizationId =
      session.session.activeOrganizationId ??
      (await firstOrganizationIdFor(auth, session.user.id))

    if (organizationId === null) {
      throw new Error(
        'Your account is not attached to a workspace yet. Sign out and back in to finish setting it up.',
      )
    }

    const role = await membershipRoleFor(auth, {
      userId: session.user.id,
      organizationId,
    })
    if (!isOrganizationRole(role)) {
      throw new Error('Your membership of this workspace has been removed.')
    }

    const scope = createScope(getDb(), {
      userId: session.user.id,
      organizationId,
      role,
    })

    const [organization, unreadCount] = await Promise.all([
      getOrganization(scope),
      countUnread(scope, session.user.id),
    ])

    const active: ShellOrganization = {
      id: organization.id,
      name: organization.name,
      slug: organization.slug,
    }

    return {
      role,
      unreadCount,
      session: {
        user: {
          id: session.user.id,
          name: session.user.name,
          email: session.user.email,
          image: session.user.image,
          isAdmin: roleSatisfies(role, 'admin'),
        },
        organization: active,
        organizations: await listShellOrganizations(active),
      },
    }
  },
)
