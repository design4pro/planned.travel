/**
 * The workspace claim's pure half and the tab's store.
 *
 * The server only ever compares what `parseWorkspaceClaim` returns, so its three answers are the
 * contract. The store is the part a regression would break quietly: a tab that marks itself stale
 * on a late answer, or never recovers, looks fine until two tabs are open.
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { encodePublicFailure } from '#/lib/errors'
import type { MessageKey } from '#/lib/i18n'
import En from '#/lib/i18n/messages/en/shell'

import {
  WORKSPACE_CHANGED_KEY,
  isWorkspaceChanged,
  parseWorkspaceClaim,
} from '../workspace-claim'
import {
  beginWorkspaceSwitch,
  dismissWorkspaceNotice,
  endWorkspaceSwitch,
  markWorkspaceStale,
  reopenWorkspaceNotice,
  resetWorkspaceClaim,
  resumeWorkspaceClaim,
  setWorkspaceClaim,
  subscribeWorkspaceClaim,
  workspaceClaimState,
} from '../workspace-claim-store'

afterEach(() => {
  resetWorkspaceClaim()
  vi.unstubAllGlobals()
})

describe('WORKSPACE_CHANGED_KEY', () => {
  it('is a key of the catalogue, so the browser can resolve what the server throws', () => {
    const key: MessageKey = WORKSPACE_CHANGED_KEY
    expect(Object.keys(En).map((name) => `shell.${name}`)).toContain(key)
  })
})

describe('parseWorkspaceClaim', () => {
  it('reads a missing header as absent, which is allowed', () => {
    expect(parseWorkspaceClaim(null)).toEqual({ status: 'absent' })
    expect(parseWorkspaceClaim(undefined)).toEqual({ status: 'absent' })
  })

  it('reads an id of the alphabet Better Auth generates as valid', () => {
    expect(parseWorkspaceClaim('V1StGXR8_Z5jdHi6B-myT')).toEqual({
      status: 'valid',
      organizationId: 'V1StGXR8_Z5jdHi6B-myT',
    })
  })

  it.each(['', ' ', 'org a', 'org,b', 'org/b', '<b>', 'a'.repeat(65)])(
    'reads %j as malformed, not as absent',
    (raw) => {
      expect(parseWorkspaceClaim(raw)).toEqual({ status: 'malformed' })
    },
  )
})

describe('isWorkspaceChanged', () => {
  it('recognises the refusal as it crosses the redaction boundary', () => {
    const cause = new Error(
      encodePublicFailure({ kind: 'refusal', message: WORKSPACE_CHANGED_KEY }),
    )
    expect(isWorkspaceChanged(cause)).toBe(true)
  })

  it('recognises the bare key, the way a client-side throw carries it', () => {
    expect(isWorkspaceChanged(new Error(WORKSPACE_CHANGED_KEY))).toBe(true)
  })

  it.each([
    [
      'another refusal',
      encodePublicFailure({ kind: 'refusal', message: 'No.' }),
    ],
    [
      'a diagnostic',
      encodePublicFailure({ kind: 'unexpected', reference: 'r1' }),
    ],
    ['a near miss', `${WORKSPACE_CHANGED_KEY}.`],
  ])('does not take %s for it', (_name, message) => {
    expect(isWorkspaceChanged(new Error(message))).toBe(false)
  })

  it('does not take a non-error for it', () => {
    expect(isWorkspaceChanged(undefined)).toBe(false)
    expect(isWorkspaceChanged({ message: WORKSPACE_CHANGED_KEY })).toBe(false)
  })
})

describe('the tab store', () => {
  it('starts with no claim, so a call made before the shell loaded carries none', () => {
    expect(workspaceClaimState()).toEqual({
      organizationId: null,
      stale: false,
      noticeOpen: false,
      switching: false,
    })
  })

  it('marks the tab stale and opens the notice when its own claim was refused', () => {
    setWorkspaceClaim('org_a')
    markWorkspaceStale('org_a')

    expect(workspaceClaimState()).toMatchObject({
      organizationId: 'org_a',
      stale: true,
      noticeOpen: true,
    })
  })

  it('ignores a refusal of a claim the tab has already moved on from', () => {
    setWorkspaceClaim('org_a')
    setWorkspaceClaim('org_b')
    markWorkspaceStale('org_a')

    expect(workspaceClaimState()).toMatchObject({
      stale: false,
      noticeOpen: false,
    })
  })

  it('closes the notice without clearing the stale state, so the next call opens it again', () => {
    setWorkspaceClaim('org_a')
    markWorkspaceStale('org_a')
    dismissWorkspaceNotice()

    expect(workspaceClaimState()).toMatchObject({
      stale: true,
      noticeOpen: false,
    })

    reopenWorkspaceNotice()
    expect(workspaceClaimState().noticeOpen).toBe(true)
  })

  it('recovers on a navigation: resuming lets the shell be read, and the new claim ends the stale state', () => {
    setWorkspaceClaim('org_a')
    markWorkspaceStale('org_a')

    resumeWorkspaceClaim()
    expect(workspaceClaimState()).toMatchObject({
      organizationId: 'org_a',
      stale: false,
      noticeOpen: false,
    })

    setWorkspaceClaim('org_b')
    expect(workspaceClaimState().organizationId).toBe('org_b')
  })

  it('keeps the switching window open across a navigation that reads the shell, until the switch ends', () => {
    setWorkspaceClaim('org_a')
    beginWorkspaceSwitch()
    expect(workspaceClaimState().switching).toBe(true)

    // A link followed mid-switch reads the shell too; that must not end the switcher's window.
    setWorkspaceClaim('org_b')
    expect(workspaceClaimState()).toMatchObject({
      organizationId: 'org_b',
      switching: true,
    })

    endWorkspaceSwitch()
    expect(workspaceClaimState().switching).toBe(false)
  })

  it('closes the switching window when the switch ends without a new shell', () => {
    setWorkspaceClaim('org_a')
    beginWorkspaceSwitch()
    endWorkspaceSwitch()

    expect(workspaceClaimState()).toMatchObject({
      organizationId: 'org_a',
      switching: false,
    })
  })

  it('does not notify when nothing changed', () => {
    setWorkspaceClaim('org_a')
    const listener = vi.fn()
    const unsubscribe = subscribeWorkspaceClaim(listener)

    resumeWorkspaceClaim()
    setWorkspaceClaim('org_a')
    expect(listener).not.toHaveBeenCalled()

    setWorkspaceClaim('org_b')
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
  })

  it('never writes on the server, where module scope is shared by every request', () => {
    vi.stubGlobal('window', undefined)
    setWorkspaceClaim('org_a')

    expect(workspaceClaimState().organizationId).toBeNull()
  })
})
