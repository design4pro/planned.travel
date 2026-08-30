import { describe, expect, it } from 'vitest'

import { resolvePlatformRole } from '#/server/auth/access'
import { consoleTranslate as t } from '#/lib/i18n/__tests__/console-translate'
import {
  PLATFORM_ROLE_ORDER,
  PLATFORM_ROLE_VOCABULARY,
  displayPlatformRole,
} from '../vocabulary'

import type { ShellPlatformRole } from '#/components/layout/session'

/**
 * `user.role` is a comma-joined string with no `CHECK` behind it, so the console has to resolve it
 * rather than compare it. The server already does that in `resolvePlatformRole`; this reads the same
 * column for rendering, and the two answering differently would put an `Admin` badge on a row whose
 * actions the guard refuses - or, worse, the reverse.
 */
describe('displayPlatformRole', () => {
  const columns: ReadonlyArray<string | null> = [
    null,
    '',
    'user',
    'admin',
    'curator',
    'curator,user',
    'user,admin',
    'admin,curator',
    ' admin , user ',
    'owner',
    'ADMIN',
    'administrator',
  ]

  it('agrees with the guard on every shape the column can hold', () => {
    for (const column of columns) {
      expect(
        displayPlatformRole(column),
        `the console and the guard must read "${String(column)}" the same way`,
      ).toBe(resolvePlatformRole(column))
    }
  })

  it('takes the strongest name a multi-role column carries', () => {
    expect(displayPlatformRole('curator,admin')).toBe('admin')
    expect(displayPlatformRole('user,curator')).toBe('curator')
  })

  it('reads an unrecognised value as no standing rather than as unset', () => {
    // The failure mode this exists to stop is "unset, therefore permissive"
    // (docs/ACCESS.md §1.3): a typo in the column must lose authority, never gain it.
    expect(displayPlatformRole('administrator')).toBe('user')
    expect(displayPlatformRole('ADMIN')).toBe('user')
  })
})

describe('the role vocabulary', () => {
  it('describes all three roles and no fourth', () => {
    expect(PLATFORM_ROLE_ORDER).toEqual(['admin', 'curator', 'user'])
    expect(Object.keys(PLATFORM_ROLE_VOCABULARY).sort()).toEqual([
      'admin',
      'curator',
      'user',
    ])
  })

  it('never paints a role in the danger tone', () => {
    // docs/SPEC.md §2, and the reference screen this console is measured against: one saturated red
    // doing duty as both a primary action and a job title leaves nothing to signal real danger.
    // `--color-danger` belongs to suspension, revocation and deletion here, and to nothing else.
    for (const role of PLATFORM_ROLE_ORDER) {
      expect(PLATFORM_ROLE_VOCABULARY[role].tone).not.toBe('danger')
      expect(PLATFORM_ROLE_VOCABULARY[role].tone).not.toBe('warning')
    }
  })

  it('says what every role may do and what it may not', () => {
    for (const role of PLATFORM_ROLE_ORDER) {
      const descriptor = PLATFORM_ROLE_VOCABULARY[role]
      // The summary is a catalogue key now, so what is checked is that the key resolves to a
      // sentence — a key nobody authored would render as the key itself.
      expect(t(descriptor.summaryKey)).not.toBe(descriptor.summaryKey)
      // A `user` holds nothing, so its `holds` list is empty by design - but every role has to be
      // explicit about at least one thing it cannot do, or the account screen answers only the half
      // of the question nobody came with.
      expect(
        descriptor.withheld.length,
        `${role} must name at least one thing it cannot do`,
      ).toBeGreaterThan(0)
    }
    expect(PLATFORM_ROLE_VOCABULARY.user.holds).toEqual([])
    expect(PLATFORM_ROLE_VOCABULARY.admin.holds.length).toBeGreaterThan(0)
  })

  it('is keyed by the same union the shell carries', () => {
    const roles: ReadonlyArray<ShellPlatformRole> = PLATFORM_ROLE_ORDER
    expect(roles).toHaveLength(3)
  })
})
