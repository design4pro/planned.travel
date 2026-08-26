import { describe, expect, it } from 'vitest'

import { DEFAULT_LOCALE } from '#/lib/i18n'
import { roleCopy } from '../roles'
import { authTranslator } from './translator'

/**
 * The invitation screen renders whatever `roleCopy` hands back, so the two
 * things worth proving are that a known role resolves to real sentences and
 * that a role the server invented cannot smuggle anything but `null` through —
 * including the names every plain object inherits, which is the shape of the
 * bug this module exists to make impossible.
 */

const t = authTranslator(DEFAULT_LOCALE)

describe('roleCopy', () => {
  it.each(['owner', 'admin', 'member'])(
    'names %s and says what it may do',
    (role) => {
      const copy = roleCopy(role)
      expect(copy).not.toBeNull()
      // `t()` returns the key unchanged when the catalogue has no entry, so a
      // resolved sentence is one that does not look like the key it came from.
      expect(t(copy?.badge ?? 'auth.invitation.role')).not.toContain('auth.')
      expect(t(copy?.meaning ?? 'auth.invitation.role')).not.toContain('auth.')
    },
  )

  it.each([
    'constructor',
    'toString',
    '__proto__',
    'hasOwnProperty',
    'valueOf',
    'guest',
    '',
  ])('answers null for %p', (role) => {
    expect(roleCopy(role)).toBeNull()
  })

  it('never hands back a function for an inherited name', () => {
    expect(typeof roleCopy('constructor')).toBe('object')
  })
})
