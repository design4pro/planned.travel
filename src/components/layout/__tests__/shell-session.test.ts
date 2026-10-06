// @vitest-environment node
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it, vi } from 'vitest'

import type {
  ShellOrganization,
  ShellSession,
} from '#/components/layout/session'
import type { AuthSession } from '#/server/auth/tenant'

/**
 * The shell's own mapping, without a request.
 *
 * `src/routes/_app/-server/shell.ts` reaches Better Auth, D1 and the Cloudflare
 * request scope through six modules that cannot be evaluated outside a Worker, so
 * they are replaced wholesale. Nothing here calls the loader: the subject is
 * `buildShellSession`, the pure half where the decisions live — which vocabulary
 * each role flag comes from, and whether the warning bar has anything to render.
 */
vi.mock('#/server/auth', () => ({ getAuth: () => ({}) }))
vi.mock('#/server/auth/db', () => ({ authDb: () => ({}) }))
vi.mock('#/server/auth/provisioning', () => ({
  firstOrganizationIdFor: async () => null,
  membershipRoleFor: async () => null,
}))
vi.mock('#/server/auth/session', () => ({ getSession: async () => null }))
vi.mock('#/server/db/client', () => ({ getDb: () => ({}) }))
vi.mock('#/server/repos', () => ({
  countUnread: async () => 0,
  createScope: () => ({}),
  getOrganization: async () => null,
}))

const { buildShellSession } = await import('#/routes/_app/-server/shell')

const ORGANIZATION: ShellOrganization = {
  id: 'org_1',
  name: 'Nowak Travel',
  slug: 'nowak-travel',
}

const EXPIRES = new Date('2026-08-25T10:15:00.000Z')

/** A session in the shape `normaliseSession` produces, with B1's five fields. */
function authSession(overrides: {
  role?: string | null
  impersonatedBy?: string | null
}): AuthSession {
  return {
    user: {
      id: 'usr_target',
      email: 'kasia@example.com',
      name: 'Kasia Nowak',
      emailVerified: true,
      image: null,
      twoFactorEnabled: false,
      role: overrides.role ?? null,
      banned: false,
      banReason: null,
      banExpires: null,
    },
    session: {
      id: 'ses_1',
      token: 'tok_1',
      userId: 'usr_target',
      activeOrganizationId: ORGANIZATION.id,
      expiresAt: EXPIRES,
      impersonatedBy: overrides.impersonatedBy ?? null,
    },
  }
}

function build(
  overrides: { role?: string | null; impersonatedBy?: string | null },
  organizationRole: 'owner' | 'admin' | 'member' = 'member',
): ShellSession {
  return buildShellSession({
    session: authSession(overrides),
    organization: ORGANIZATION,
    organizations: [ORGANIZATION],
    organizationRole,
    operator:
      overrides.impersonatedBy == null
        ? null
        : {
            id: overrides.impersonatedBy,
            name: 'Rafal Wolak',
            email: 'ops@example.com',
          },
  })
}

describe('the shell session', () => {
  it('leaves an ordinary session with nothing for the bar to render', () => {
    const shell = build({})
    expect(shell.impersonatedBy).toBeNull()
    expect(shell.expiresAt).toBe(EXPIRES.toISOString())
  })

  it('carries the impersonator on an impersonated one', () => {
    const shell = build({ impersonatedBy: 'usr_operator' })
    expect(shell.impersonatedBy).toEqual({
      id: 'usr_operator',
      name: 'Rafal Wolak',
      email: 'ops@example.com',
    })
  })

  it('sends the expiry as a string, not as a Date', () => {
    // Typed as a `Date` and delivered as a string across the serialization
    // boundary, the countdown would be one `.getTime()` away from `NaN`.
    const shell = build({ impersonatedBy: 'usr_operator' })
    expect(typeof shell.expiresAt).toBe('string')
    expect(Number.isFinite(Date.parse(shell.expiresAt))).toBe(true)
  })

  it('reads the two role vocabularies from two different columns', () => {
    // The workspace owner with no platform standing: `isAdmin` true because of
    // the membership row, `isPlatformAdmin` false because of `user.role`.
    const owner = build({ role: null }, 'owner')
    expect(owner.user.isAdmin).toBe(true)
    expect(owner.user.platformRole).toBe('user')
    expect(owner.user.isPlatformAdmin).toBe(false)
    expect(owner.user.isCurator).toBe(false)

    // And the disagreement the other way.
    const operator = build({ role: 'admin' }, 'member')
    expect(operator.user.isAdmin).toBe(false)
    expect(operator.user.isPlatformAdmin).toBe(true)
    expect(operator.user.isCurator).toBe(true)
  })

  it('resolves a comma-joined role to the strongest name it carries', () => {
    // `user.role` is a joined string for a multi-role account and Better Auth
    // splits it the same way. `role === 'admin'` would read this as a plain user.
    expect(build({ role: 'curator,user' }).user.platformRole).toBe('curator')
    expect(build({ role: 'user,admin' }).user.isPlatformAdmin).toBe(true)
  })

  it('reads an unknown or absent role as no platform standing at all', () => {
    for (const role of [null, '', 'wizard', 'Admin']) {
      const shell = build({ role })
      expect(shell.user.platformRole, String(role)).toBe('user')
      expect(shell.user.isPlatformAdmin, String(role)).toBe(false)
    }
  })
})

describe('the workspaces the shell carries', () => {
  const SECOND: ShellOrganization = {
    id: 'org_2',
    name: 'Nowak Family',
    slug: 'nowak-family',
  }

  it('carries every workspace through and marks the active one', () => {
    // The switcher renders `organizations` and checks the one equal to `organization`; a payload
    // that dropped an entry would strand the reader out of a workspace they belong to.
    const shell = buildShellSession({
      session: authSession({}),
      organization: SECOND,
      organizations: [ORGANIZATION, SECOND],
      organizationRole: 'member',
      operator: null,
    })

    expect(shell.organizations).toEqual([ORGANIZATION, SECOND])
    expect(shell.organization).toEqual(SECOND)
    expect(
      shell.organizations.filter(
        (entry) => entry.id === shell.organization?.id,
      ),
    ).toEqual([SECOND])
  })
})

describe('naming the operator behind an impersonated session', () => {
  /**
   * Asserted from the source rather than by calling it.
   *
   * `readOperator` cannot be exported: this module is imported by
   * `_app/route.tsx`, so an export survives the server-function transform into
   * the client graph and drags `getAuth()` - and therefore `cloudflare:workers`
   * - into the browser build, which cannot resolve it. Measured, not assumed:
   * `pnpm build` fails with `Rolldown failed to resolve import
   * "cloudflare:workers"`. What is worth pinning is the shape of the two
   * failure paths: a lookup that degrades to an opaque id on every request must
   * leave a signal behind, and the version this replaced had a bare `catch {}`
   * that left none.
   */
  const source = readFileSync(
    join(
      dirname(fileURLToPath(import.meta.url)),
      '..',
      '..',
      '..',
      'routes',
      '_app',
      '-server',
      'shell.ts',
    ),
    'utf8',
  )

  const operatorRead = source.slice(
    source.indexOf('async function readOperator'),
    source.indexOf('export interface ShellSessionInput'),
  )

  it('reports a row it could not read', () => {
    expect(operatorRead.length).toBeGreaterThan(0)
    expect(operatorRead).toContain('shellLog().warn(')
    expect(operatorRead).toContain('operatorUserId: userId')
  })

  it('reports a read that threw as an error, not as a shrug', () => {
    expect(operatorRead).toContain('} catch (cause) {')
    expect(operatorRead).toContain('shellLog().error(')
    // The bare `catch {}` this replaced: no binding, no log, no signal at all.
    expect(operatorRead).not.toMatch(/}\s*catch\s*\{\s*\n\s*return/)
  })

  it('still hands the bar something to render either way', () => {
    // Two degradations, one fallback: a bar that cannot name the operator must
    // still say that there is one.
    expect([
      ...operatorRead.matchAll(
        /return \{ id: userId, name: null, email: null \}/g,
      ),
    ]).toHaveLength(2)
  })
})
