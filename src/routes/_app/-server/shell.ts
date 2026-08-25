/**
 * What the application chrome needs before any module renders: who is signed
 * in, which workspace they are looking at, and how loud their inbox is.
 *
 * `_app/route.tsx` calls this once in `beforeLoad`, which is what stops a child
 * loader from ever running for an anonymous visitor.
 *
 * The two states it cannot render around — a session with no workspace, and a
 * membership revoked while the tab was open — are thrown as message *keys*, not
 * as sentences. See {@link shellFailure}.
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
  ShellStateKey,
} from '#/components/layout/session'

export interface ShellPayload {
  readonly session: ShellSession
  readonly unreadCount: number
  readonly role: OrganizationRole
}

/**
 * A fatal shell state, as the key the error boundary will resolve.
 *
 * The sentence used to be composed here, against `Accept-Language` — the only
 * signal this path has, because both callers have already failed to resolve the
 * very workspace the stored language preference hangs off. That put the one
 * screen a blocked traveller sees in a language the document around it may not
 * be in. Throwing the key moves the resolution to
 * `src/components/layout/error-state.tsx`, which renders inside the document's
 * own `I18nProvider` and therefore in the locale §8.3 negotiated before first
 * paint. `Error.message` is the field that survives the server-function
 * boundary, so the key travels as the message and nothing else changes.
 */
function shellFailure(key: ShellStateKey): Error {
  return new Error(key)
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
      throw shellFailure('shell.session.noWorkspace')
    }

    const role = await membershipRoleFor(auth, {
      userId: session.user.id,
      organizationId,
    })
    if (!isOrganizationRole(role)) {
      throw shellFailure('shell.session.membershipRemoved')
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
