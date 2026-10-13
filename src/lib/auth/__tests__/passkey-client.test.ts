import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  deletePasskey,
  isPasskeyEnrolmentSupported,
  listPasskeys,
  registerPasskey,
  renamePasskey,
} from '../client'

/**
 * jsdom has no WebAuthn, so the three classes the ceremony narrows on are stubbed with the
 * smallest thing that satisfies an `instanceof`, and `navigator.credentials` is a spy.
 */
class FakeAttestationResponse {
  clientDataJSON = Uint8Array.from([1, 2, 3]).buffer
  attestationObject = Uint8Array.from([0xfb, 0xff, 0xbf]).buffer
  getTransports: () => Array<string> = () => []
}

class FakePublicKeyCredential {
  id = 'credential-id'
  rawId = Uint8Array.from([0xff]).buffer
  type = 'public-key'
  response: unknown = new FakeAttestationResponse()
}

const create = vi.fn()

const SERVER_OPTIONS = {
  challenge: 'AQID',
  rp: { id: 'localhost', name: 'planned.travel' },
  user: { id: 'dXNlci0x', name: 'ada@example.com', displayName: 'Ada' },
  pubKeyCredParams: [{ type: 'public-key', alg: -7 }],
  timeout: 300000,
  attestation: 'none',
  excludeCredentials: [
    {
      id: '-_-_',
      type: 'public-key',
      transports: ['internal', 'carrier-pigeon'],
    },
  ],
  authenticatorSelection: {
    residentKey: 'required',
    requireResidentKey: true,
    userVerification: 'preferred',
  },
}

const PASSKEY = {
  id: 'pk_1',
  name: null,
  deviceType: 'multiDevice',
  backedUp: true,
  aaguid: null,
  createdAt: '2026-10-12T09:00:00.000Z',
  lastUsedAt: null,
}

function reply(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

const fetchMock = vi.fn<typeof fetch>()

beforeEach(() => {
  create.mockReset()
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
  vi.stubGlobal('PublicKeyCredential', FakePublicKeyCredential)
  vi.stubGlobal('AuthenticatorAttestationResponse', FakeAttestationResponse)
  Object.defineProperty(navigator, 'credentials', {
    configurable: true,
    value: { create },
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
  Reflect.deleteProperty(navigator, 'credentials')
})

/** Queues the options reply, lets the authenticator answer, then queues the verify reply. */
function arrange(credential: unknown, verify: Response) {
  fetchMock.mockResolvedValueOnce(reply(200, SERVER_OPTIONS))
  create.mockResolvedValueOnce(credential)
  fetchMock.mockResolvedValueOnce(verify)
}

function sentBody(call: number): unknown {
  const init = fetchMock.mock.calls[call][1]
  return typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
}

describe('isPasskeyEnrolmentSupported', () => {
  it('is true when the browser can create credentials', () => {
    expect(isPasskeyEnrolmentSupported()).toBe(true)
  })

  it('is false when navigator.credentials.create is missing', () => {
    Object.defineProperty(navigator, 'credentials', {
      configurable: true,
      value: {},
    })
    expect(isPasskeyEnrolmentSupported()).toBe(false)
  })

  it('is false without PublicKeyCredential', () => {
    vi.stubGlobal('PublicKeyCredential', undefined)
    expect(isPasskeyEnrolmentSupported()).toBe(false)
  })
})

describe('registerPasskey', () => {
  it('runs options, the ceremony and verify, and returns the new passkey', async () => {
    arrange(new FakePublicKeyCredential(), reply(200, { passkey: PASSKEY }))

    const result = await registerPasskey()

    expect(result).toEqual({ ok: true, passkey: PASSKEY })
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/auth/passkey/register/options',
    )
    expect(fetchMock.mock.calls[1][0]).toBe('/api/auth/passkey/register/verify')
    expect(fetchMock.mock.calls[1][1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
    })
  })

  it('decodes base64url into bytes for the ceremony, + and / included', async () => {
    arrange(new FakePublicKeyCredential(), reply(200, { passkey: PASSKEY }))

    await registerPasskey()

    const { publicKey } = create.mock.calls[0][0] as {
      publicKey: {
        challenge: ArrayBuffer
        user: { id: ArrayBuffer }
        excludeCredentials: Array<{ id: ArrayBuffer }>
      }
    }
    expect([...new Uint8Array(publicKey.challenge)]).toEqual([1, 2, 3])
    expect(new TextDecoder().decode(publicKey.user.id)).toBe('user-1')
    // '-_-_' is the url alphabet for '+/+/', the three bytes 0xfb 0xff 0xbf.
    expect([...new Uint8Array(publicKey.excludeCredentials[0].id)]).toEqual([
      0xfb, 0xff, 0xbf,
    ])
  })

  it('encodes the credential back, including a padding remainder', async () => {
    const credential = new FakePublicKeyCredential()
    arrange(credential, reply(200, { passkey: PASSKEY }))

    await registerPasskey()

    expect(sentBody(1)).toEqual({
      credential: {
        id: 'credential-id',
        // 0xff alone is '/w==' in base64, '_w' in base64url: no padding, no '/'.
        rawId: '_w',
        type: 'public-key',
        response: {
          clientDataJSON: 'AQID',
          attestationObject: '-_-_',
        },
      },
    })
  })

  it('sends the transports the authenticator reports, and no name', async () => {
    const credential = new FakePublicKeyCredential()
    const response = new FakeAttestationResponse()
    response.getTransports = () => ['internal', 'hybrid']
    credential.response = response
    arrange(credential, reply(200, { passkey: PASSKEY }))

    await registerPasskey()

    const body = sentBody(1) as {
      name?: unknown
      credential: { response: { transports?: Array<string> } }
    }
    expect(body.credential.response.transports).toEqual(['internal', 'hybrid'])
    expect(body).not.toHaveProperty('name')
  })

  it('drops a transport the platform does not understand from the exclude list', async () => {
    arrange(new FakePublicKeyCredential(), reply(200, { passkey: PASSKEY }))

    await registerPasskey()

    const { publicKey } = create.mock.calls[0][0] as {
      publicKey: { excludeCredentials: Array<{ transports?: Array<string> }> }
    }
    expect(publicKey.excludeCredentials[0].transports).toEqual(['internal'])
  })

  it.each(['NotAllowedError', 'AbortError'])(
    'turns %s into an aborted result',
    async (name) => {
      fetchMock.mockResolvedValueOnce(reply(200, SERVER_OPTIONS))
      create.mockRejectedValueOnce(new DOMException('dismissed', name))

      expect(await registerPasskey()).toEqual({ ok: false, aborted: true })
      expect(fetchMock).toHaveBeenCalledTimes(1)
    },
  )

  it('gives InvalidStateError its own arm', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, SERVER_OPTIONS))
    create.mockRejectedValueOnce(
      new DOMException('exists', 'InvalidStateError'),
    )

    expect(await registerPasskey()).toEqual({
      ok: false,
      aborted: false,
      alreadyEnrolled: true,
    })
  })

  it('carries the status and code of a refused verify', async () => {
    arrange(
      new FakePublicKeyCredential(),
      reply(400, { code: 'PASSKEY_LIMIT_REACHED', message: 'The limit.' }),
    )

    expect(await registerPasskey()).toEqual({
      ok: false,
      aborted: false,
      alreadyEnrolled: false,
      failure: {
        code: 'PASSKEY_LIMIT_REACHED',
        status: 400,
        message: 'The limit.',
      },
    })
  })

  it('carries the code of a refused options call and never opens the sheet', async () => {
    fetchMock.mockResolvedValueOnce(
      reply(403, { code: 'PASSKEY_IMPERSONATED', message: 'No.' }),
    )

    const result = await registerPasskey()

    expect(result).toMatchObject({
      ok: false,
      failure: { code: 'PASSKEY_IMPERSONATED', status: 403 },
    })
    expect(create).not.toHaveBeenCalled()
  })

  it('reports a dropped connection as a failure with status 0', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    expect(await registerPasskey()).toMatchObject({
      ok: false,
      aborted: false,
      failure: { status: 0 },
    })
  })

  it('reports options the server shaped wrongly as a failure, not a crash', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { challenge: 'AQID' }))

    expect(await registerPasskey()).toMatchObject({ ok: false, aborted: false })
    expect(create).not.toHaveBeenCalled()
  })

  it('treats a credential that is not a PublicKeyCredential as aborted', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, SERVER_OPTIONS))
    create.mockResolvedValueOnce(null)

    expect(await registerPasskey()).toEqual({ ok: false, aborted: true })
  })

  it('reports a verify reply without a passkey as a failure', async () => {
    arrange(new FakePublicKeyCredential(), reply(200, {}))

    expect(await registerPasskey()).toMatchObject({ ok: false, aborted: false })
  })
})

describe('listPasskeys', () => {
  it('reads with GET, sends the cookie and no body', async () => {
    fetchMock.mockResolvedValueOnce(
      reply(200, { passkeys: [PASSKEY], requiresPassword: true }),
    )

    const result = await listPasskeys()

    expect(result).toEqual({
      ok: true,
      passkeys: [PASSKEY],
      requiresPassword: true,
    })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/passkey/list')
    const init = fetchMock.mock.calls[0][1]
    expect(init).toMatchObject({ method: 'GET', credentials: 'include' })
    expect(init?.body).toBeUndefined()
  })

  it('returns an empty list as a success', async () => {
    fetchMock.mockResolvedValueOnce(
      reply(200, { passkeys: [], requiresPassword: false }),
    )
    expect(await listPasskeys()).toEqual({
      ok: true,
      passkeys: [],
      requiresPassword: false,
    })
  })

  it('passes the password hint through when it is false', async () => {
    fetchMock.mockResolvedValueOnce(
      reply(200, { passkeys: [PASSKEY], requiresPassword: false }),
    )
    expect(await listPasskeys()).toMatchObject({ requiresPassword: false })
  })

  it('asks for the password when the hint is missing or not a boolean', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { passkeys: [] }))
    expect(await listPasskeys()).toMatchObject({ requiresPassword: true })

    fetchMock.mockResolvedValueOnce(
      reply(200, { passkeys: [], requiresPassword: 'no' }),
    )
    expect(await listPasskeys()).toMatchObject({ requiresPassword: true })
  })

  it.each([401, 429, 500])(
    'carries the status %i of a refused list',
    async (status) => {
      fetchMock.mockResolvedValueOnce(reply(status, { message: 'No.' }))

      expect(await listPasskeys()).toEqual({
        ok: false,
        failure: { code: null, status, message: 'No.' },
      })
    },
  )

  it('fails on a body that is not a list', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { passkeys: 'nope' }))
    expect(await listPasskeys()).toMatchObject({ ok: false })
  })
})

describe('renamePasskey', () => {
  it('posts the id and the name with the cookie, and returns the renamed passkey', async () => {
    const renamed = { ...PASSKEY, name: 'Work phone' }
    fetchMock.mockResolvedValueOnce(reply(200, { passkey: renamed }))

    const result = await renamePasskey('pk_1', 'Work phone')

    expect(result).toEqual({ ok: true, passkey: renamed })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/passkey/rename')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
    })
    expect(sentBody(0)).toEqual({ id: 'pk_1', name: 'Work phone' })
  })

  it.each([
    [401, null],
    [403, 'PASSKEY_IMPERSONATED'],
    [404, 'PASSKEY_NOT_FOUND'],
    [429, null],
  ])(
    'carries the status %i and code of a refused rename',
    async (status, code) => {
      fetchMock.mockResolvedValueOnce(
        reply(status, { ...(code ? { code } : {}), message: 'No.' }),
      )

      expect(await renamePasskey('pk_1', 'x')).toEqual({
        ok: false,
        failure: { code, status, message: 'No.' },
      })
    },
  )

  it('reports a dropped connection as a failure with status 0', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    expect(await renamePasskey('pk_1', 'x')).toMatchObject({
      ok: false,
      failure: { status: 0 },
    })
  })

  it('reports a reply without a passkey as a failure, not a crash', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { ok: true }))

    expect(await renamePasskey('pk_1', 'x')).toMatchObject({ ok: false })
  })
})

describe('deletePasskey', () => {
  it('posts the id and the password with the cookie', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { deleted: true }))

    expect(await deletePasskey('pk_1', 'hunter2')).toEqual({ ok: true })
    expect(fetchMock.mock.calls[0][0]).toBe('/api/auth/passkey/delete')
    expect(fetchMock.mock.calls[0][1]).toMatchObject({
      method: 'POST',
      credentials: 'include',
    })
    expect(sentBody(0)).toEqual({ id: 'pk_1', password: 'hunter2' })
  })

  it('sends no password field for a plain confirmation', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, { deleted: true }))

    await deletePasskey('pk_1')

    expect(sentBody(0)).toEqual({ id: 'pk_1' })
  })

  it.each([
    [400, 'PASSKEY_PASSWORD_REQUIRED'],
    [400, 'PASSKEY_INVALID_PASSWORD'],
    [400, 'PASSKEY_SESSION_NOT_FRESH'],
    [403, 'PASSKEY_IMPERSONATED'],
    [404, 'PASSKEY_NOT_FOUND'],
    [401, null],
    [429, null],
  ])(
    'carries the status %i and code %s of a refused delete',
    async (status, code) => {
      fetchMock.mockResolvedValueOnce(
        reply(status, { ...(code ? { code } : {}), message: 'No.' }),
      )

      expect(await deletePasskey('pk_1', 'x')).toEqual({
        ok: false,
        failure: { code, status, message: 'No.' },
      })
    },
  )

  it('reports a dropped connection as a failure with status 0', async () => {
    fetchMock.mockRejectedValueOnce(new TypeError('Failed to fetch'))

    expect(await deletePasskey('pk_1')).toMatchObject({
      ok: false,
      failure: { status: 0 },
    })
  })

  it('does not report success for a reply that does not say it deleted', async () => {
    fetchMock.mockResolvedValueOnce(reply(200, {}))

    expect(await deletePasskey('pk_1')).toMatchObject({ ok: false })
  })
})
