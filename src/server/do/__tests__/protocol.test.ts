import { describe, expect, expectTypeOf, it } from 'vitest'

import { parseServerMessage } from '../protocol'

import type { z } from 'zod'
import type {
  PresenceMember,
  ServerMessage,
  serverMessageSchema,
} from '../protocol'

function member(
  overrides: Partial<PresenceMember['user']> = {},
): PresenceMember {
  return {
    connectionId: 'c-1',
    user: { id: 'u-1', name: 'Ada', initials: 'A', hue: 120, ...overrides },
    joinedAt: 1,
    lastSeenAt: 2,
    focus: null,
  }
}

function frame(value: unknown): string {
  return JSON.stringify(value)
}

const welcome = {
  t: 'welcome',
  protocol: 1,
  connectionId: 'c-1',
  tripId: 't-1',
  version: 7,
  you: member(),
  peers: [member({ id: 'u-2', name: null })],
}

describe('parseServerMessage - a valid frame of each kind', () => {
  const valid: Array<[string, unknown]> = [
    ['welcome', welcome],
    [
      'presence',
      {
        t: 'presence',
        peers: [member(), member({ name: null })],
        joined: 'c-1',
      },
    ],
    ['commit', { t: 'commit', version: 8, entries: [] }],
    [
      'ack',
      { t: 'ack', requestId: 'r-1', version: 8, applied: [], overwrote: [] },
    ],
    ['pong', { t: 'pong' }],
    [
      'error',
      { t: 'error', code: 'protocol-mismatch', message: 'Update the app' },
    ],
  ]

  it.each(valid)('parses %s', (_kind, message) => {
    expect(parseServerMessage(frame(message))).toEqual({
      ok: true,
      value: message,
    })
  })

  it('parses a presence peer whose name is null', () => {
    const result = parseServerMessage(
      frame({ t: 'presence', peers: [member({ name: null })] }),
    )

    expect(result.ok).toBe(true)
  })

  // The shapes the real room sends that a later tightening of the schema would break first.
  it.each([
    ['an avatar URL', { avatarUrl: 'https://example.com/a.png' }],
    ['a null avatar URL', { avatarUrl: null }],
    [
      'the "?" initials of a user without a name',
      { name: null, initials: '?' },
    ],
  ])('parses a presence peer with %s', (_label, user) => {
    const result = parseServerMessage(
      frame({ t: 'presence', peers: [member(user)] }),
    )

    expect(result.ok).toBe(true)
  })

  it.each([
    ['no field', { entity: { kind: 'stop', id: 's-1' } }],
    ['a null field', { entity: { kind: 'stop', id: 's-1' }, field: null }],
    ['a named field', { entity: { kind: 'stop', id: 's-1' }, field: 'title' }],
  ])('parses a presence peer focused with %s', (_label, focus) => {
    const result = parseServerMessage(
      frame({ t: 'presence', peers: [{ ...member(), focus }] }),
    )

    expect(result.ok).toBe(true)
  })

  it('keeps the fields the client does not validate', () => {
    const result = parseServerMessage(
      frame({
        ...welcome,
        commits: [{ version: 1 }],
        snapshot: { version: 1, entities: [], truncated: false },
      }),
    )

    expect(result).toMatchObject({
      ok: true,
      value: { commits: [{ version: 1 }] },
    })
  })
})

describe('parseServerMessage - a frame from a newer server', () => {
  it('still parses a frame with unknown extra fields', () => {
    const result = parseServerMessage(
      frame({
        ...welcome,
        theme: 'dark',
        you: {
          ...member(),
          badge: 'x',
          user: { ...member().user, pronouns: 'x' },
        },
      }),
    )

    expect(result.ok).toBe(true)
  })

  it('still matches a protocol-mismatch error when a new code is added beside it', () => {
    const result = parseServerMessage(
      frame({ t: 'error', code: 'something-new', message: 'm' }),
    )

    expect(result).toMatchObject({ ok: true, value: { code: 'something-new' } })
  })

  it('rejects an unknown message type', () => {
    expect(parseServerMessage(frame({ t: 'teleport' })).ok).toBe(false)
  })
})

describe('parseServerMessage - a frame the client cannot render', () => {
  const malformed: Array<[string, unknown]> = [
    [
      'a presence peer with a numeric name',
      { t: 'presence', peers: [member({ name: 5 as never })] },
    ],
    [
      'a presence peer with a string hue',
      { t: 'presence', peers: [member({ hue: '120' as never })] },
    ],
    [
      'a presence peer without initials',
      { t: 'presence', peers: [member({ initials: undefined })] },
    ],
    [
      'a presence peer with a numeric id',
      { t: 'presence', peers: [member({ id: 1 as never })] },
    ],
    ['a presence frame without peers', { t: 'presence' }],
    ['a welcome without you', { ...welcome, you: undefined }],
    [
      'a welcome with a malformed peer',
      { ...welcome, peers: [member({ name: false as never })] },
    ],
    ['a welcome without a version', { ...welcome, version: undefined }],
    ['a welcome without a protocol', { ...welcome, protocol: undefined }],
    ['a commit without entries', { t: 'commit', version: 1 }],
    [
      'a commit whose entries are not an array',
      { t: 'commit', version: 1, entries: {} },
    ],
    ['an error without a message', { t: 'error', code: 'internal' }],
  ]

  it.each(malformed)('rejects %s', (_label, message) => {
    expect(parseServerMessage(frame(message)).ok).toBe(false)
  })

  it('keeps rejecting invalid JSON and a frame without a type', () => {
    expect(parseServerMessage('{').ok).toBe(false)
    expect(parseServerMessage(frame({ peers: [] })).ok).toBe(false)
  })
})

describe('serverMessageSchema', () => {
  it('describes a subset of what the server sends: every ServerMessage satisfies it', () => {
    expectTypeOf<ServerMessage>().toExtend<
      z.infer<typeof serverMessageSchema>
    >()
  })
})
