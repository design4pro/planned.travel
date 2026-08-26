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
import { z } from 'zod'

import { platformCapabilities } from '#/components/layout/session'
import { getAuth } from '#/server/auth'
import { resolvePlatformRole } from '#/server/auth/access'
import { authDb } from '#/server/auth/db'
import {
  firstOrganizationIdFor,
  membershipRoleFor,
} from '#/server/auth/provisioning'
import { getSession } from '#/server/auth/session'
import { isOrganizationRole, roleSatisfies } from '#/server/auth/tenant'
import { getDb } from '#/server/db/client'
import { createLogger } from '#/server/observability'
import { countUnread, createScope, getOrganization } from '#/server/repos'

import type { Logger } from '#/server/observability'
import type { AuthSession, OrganizationRole } from '#/server/auth/tenant'
import type {
  ShellImpersonator,
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

/**
 * Memoised per isolate, the way `src/server/fns/context.ts` holds its own: the
 * logger carries no request state, and the shell is on the path of every
 * authenticated document.
 */
let shellLogger: Logger | undefined

function shellLog(): Logger {
  shellLogger ??= createLogger({ context: { component: 'app-shell' } })
  return shellLogger
}

/** The columns the warning bar needs off the operator's own row, and no others. */
const operatorRowSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).nullable().catch(null),
  email: z.string().trim().min(1).nullable().catch(null),
})

/**
 * The operator behind an impersonated session, named.
 *
 * `session.impersonatedBy` carries an id and nothing else, and the bar has to
 * say who is doing the acting (`docs/ACCESS.md` §6.1) — an opaque id is not an
 * answer to that. The read goes through Better Auth's own adapter rather than a
 * hand-written query, for the same reason `readUserRole` in
 * `src/server/fns/console/bindings.ts` does: the row belongs to the auth schema,
 * which is not tenant data and therefore has no tenant repository to pass
 * through.
 *
 * It costs one extra read, and only on a request that is already impersonated —
 * which is rare by construction and short-lived by §6.2. A failure degrades to
 * the id rather than taking the shell down: a bar that cannot name the operator
 * must still say that there is one.
 *
 * Deliberately not exported, however convenient a direct unit test would be:
 * this module is imported by `_app/route.tsx`, so anything exported from it
 * survives the server-function transform into the client graph, and this
 * function reaches `getAuth()` — which reaches `cloudflare:workers`, which the
 * browser build cannot resolve. Measured, not assumed: exporting it fails
 * `pnpm build` with `Rolldown failed to resolve import "cloudflare:workers"`.
 * The shape of the two branches below is asserted from the source instead.
 *
 * **Both degradations are reported.** They are not the same event and neither is
 * nothing: a row that is missing or malformed is a `warn` about the auth schema,
 * and a read that threw is an `error` about the adapter. Swallowed silently, a
 * lookup that fails on every request renders an opaque user id in the product's
 * loudest warning for the whole life of the session with nothing anywhere to say
 * why. The bar still renders either way — the log is the signal, not the
 * fallback.
 */
async function readOperator(userId: string): Promise<ShellImpersonator> {
  try {
    const context = await getAuth().$context
    const row = await context.adapter.findOne<unknown>({
      model: 'user',
      where: [{ field: 'id', value: userId }],
      select: ['id', 'name', 'email'],
    })
    const parsed = operatorRowSchema.safeParse(row)
    if (!parsed.success) {
      shellLog().warn('impersonation operator row unreadable', {
        operatorUserId: userId,
        found: row !== null && row !== undefined,
        fields: parsed.error.issues
          .map((issue) => issue.path.join('.'))
          .join(','),
      })
      return { id: userId, name: null, email: null }
    }
    return { id: userId, name: parsed.data.name, email: parsed.data.email }
  } catch (cause) {
    shellLog().error('impersonation operator lookup failed', cause, {
      operatorUserId: userId,
    })
    return { id: userId, name: null, email: null }
  }
}

/** Everything the shell's session payload is assembled from, already resolved. */
export interface ShellSessionInput {
  readonly session: AuthSession
  readonly organization: ShellOrganization
  readonly organizations: ReadonlyArray<ShellOrganization>
  readonly organizationRole: OrganizationRole
  /** The operator behind an impersonated session, or `null` for an ordinary one. */
  readonly operator: ShellImpersonator | null
}

/**
 * The whole mapping from B1's widened session onto the chrome's own shape, in
 * one pure function.
 *
 * Separated from the loader around it because this is the part with decisions in
 * it and none of them are visible to the compiler: two role vocabularies that
 * must not be conflated, a comma-joined `user.role` that must not be compared
 * with `===`, and an impersonation marker whose presence is the entire condition
 * for the warning bar. The loader supplies the reads; this decides what they
 * mean, and it is the half worth testing without a request.
 */
export function buildShellSession(input: ShellSessionInput): ShellSession {
  const { session, organizationRole } = input
  // `user.role` stores a comma-joined string for a multi-role account, so the
  // strongest name it carries is what decides — never a `=== 'admin'` here.
  const platformRole = resolvePlatformRole(session.user.role)

  return {
    user: {
      id: session.user.id,
      name: session.user.name,
      email: session.user.email,
      image: session.user.image,
      // Membership of *this workspace*, which is a different vocabulary from
      // the platform role beside it and stays exactly what it was.
      isAdmin: roleSatisfies(organizationRole, 'admin'),
      platformRole,
      ...platformCapabilities(platformRole),
    },
    organization: input.organization,
    organizations: input.organizations,
    // The marker is an id; the operator is the row it names. An ordinary session
    // carries neither, and that is what keeps the bar off every other screen.
    impersonatedBy:
      session.session.impersonatedBy === null ? null : input.operator,
    expiresAt: session.session.expiresAt.toISOString(),
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

    const impersonatedBy = session.session.impersonatedBy

    return {
      role,
      unreadCount,
      session: buildShellSession({
        session,
        organizationRole: role,
        organization: active,
        organizations: await listShellOrganizations(active),
        // Read only on a request that is already impersonated, which is rare by
        // construction: an ordinary session pays nothing for the bar.
        operator:
          impersonatedBy === null ? null : await readOperator(impersonatedBy),
      }),
    }
  },
)
