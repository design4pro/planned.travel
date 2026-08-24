import { describe, expect, it } from 'vitest'

import shell from '#/lib/i18n/messages/en/shell'
import { SHELL_STATE_KEYS, shellStateOf } from '../session'

/**
 * The contract between the two halves of a fatal shell state.
 *
 * `src/routes/_app/-server/shell.ts` throws the message *key* rather than a
 * sentence, because the request that failed has no workspace and therefore no
 * access to the stored language preference — it could only have negotiated
 * against `Accept-Language`, which is not necessarily the language the document
 * around the error boundary is in. The boundary resolves the key instead, inside
 * the provider, and prints it as prose rather than as a monospace diagnostic.
 *
 * Two things have to hold for that to work: the keys must exist in the
 * catalogue, and recognising one must survive the trip across the
 * server-function boundary, where an `Error.message` is what is left of a throw.
 */

describe('a thrown shell state is recognised by the boundary', () => {
  it('names keys the catalogue carries', () => {
    for (const key of SHELL_STATE_KEYS) {
      expect(key.startsWith('shell.')).toBe(true)
      expect(shell).toHaveProperty(key.slice('shell.'.length))
    }
  })

  it('recognises the state on an Error, which is what crosses the wire', () => {
    expect(shellStateOf(new Error('shell.session.noWorkspace'))).toBe(
      'shell.session.noWorkspace',
    )
    expect(shellStateOf(new Error('shell.session.membershipRemoved'))).toBe(
      'shell.session.membershipRemoved',
    )
  })

  it('recognises a bare string, because a throw need not be an Error', () => {
    expect(shellStateOf('shell.session.noWorkspace')).toBe(
      'shell.session.noWorkspace',
    )
  })

  it('leaves an ordinary failure to the diagnostic path', () => {
    expect(shellStateOf(new Error('D1_ERROR: no such column'))).toBeNull()
    expect(shellStateOf(new Error(''))).toBeNull()
    expect(shellStateOf(undefined)).toBeNull()
    expect(shellStateOf(null)).toBeNull()
    expect(shellStateOf({ message: 'shell.session.noWorkspace' })).toBeNull()
  })

  it('does not match a key that merely looks like one', () => {
    expect(shellStateOf(new Error('shell.session'))).toBeNull()
    expect(shellStateOf(new Error('shell.error.title'))).toBeNull()
  })
})
