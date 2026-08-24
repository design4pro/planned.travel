/**
 * What the application chrome needs before any module renders: who is signed
 * in, which workspace they are looking at, and how loud their inbox is.
 *
 * `_app/route.tsx` calls this once in `beforeLoad`, which is what stops a child
 * loader from ever running for an anonymous visitor.
 *
 * The two states it cannot render around — a session with no workspace, and a
 * membership revoked while the tab was open — are thrown, and their sentences
 * are resolved here against the catalogue rather than written as English
 * literals (`docs/SPEC.md` §8.6). See {@link shellFailure} for why the locale on
 * that path comes from `Accept-Language`.
 */
import { createServerFn } from '@tanstack/react-start'
import { getRequest, getRequestHeader } from '@tanstack/react-start/server'

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
import { createTranslator, loadCatalogue, negotiate } from '#/lib/i18n'

import type { MessageKey } from '#/lib/i18n'
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

/**
 * A fatal shell state, in the reader's language.
 *
 * `Accept-Language` is the only signal available on this path, and deliberately
 * so: both callers have already failed to resolve a workspace, and
 * `getEffectiveSettings` — where the stored preference lives — needs the very
 * tenant scope that could not be built. §8.3's chain ends at the header and then
 * at `en`, which is exactly what is left.
 */
async function shellFailure(key: MessageKey): Promise<Error> {
  const locale = negotiate({
    acceptLanguage: getRequestHeader('accept-language') ?? null,
  })
  return new Error(createTranslator(locale, await loadCatalogue(locale))(key))
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
      throw await shellFailure('shell.session.noWorkspace')
    }

    const role = await membershipRoleFor(auth, {
      userId: session.user.id,
      organizationId,
    })
    if (!isOrganizationRole(role)) {
      throw await shellFailure('shell.session.membershipRemoved')
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
