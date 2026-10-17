import { base64UrlEncode, concatBytes, sha256, utf8Encode } from '../bytes'

/** A small Ed25519 authenticator driving real registration and signature verification. */
export async function createAuthenticator() {
  const keys = await crypto.subtle.generateKey('Ed25519', true, [
    'sign',
    'verify',
  ])
  const publicKey = new Uint8Array(
    await crypto.subtle.exportKey('raw', keys.publicKey),
  )
  const credentialId = crypto.getRandomValues(new Uint8Array(16))
  const id = base64UrlEncode(credentialId)
  const rpHash = await sha256(utf8Encode('localhost'))
  // COSE OKP, EdDSA, Ed25519, x; all lengths here fit one-byte CBOR arguments.
  const cose = concatBytes(
    new Uint8Array([0xa4, 1, 1, 3, 0x27, 0x20, 6, 0x21, 0x58, 32]),
    publicKey,
  )
  const clientData = (type: string, challenge: string) =>
    utf8Encode(
      JSON.stringify({ type, challenge, origin: 'http://localhost:3000' }),
    )

  function registration(challenge: string) {
    const authData = concatBytes(
      rpHash,
      new Uint8Array([0x41, 0, 0, 0, 0]),
      new Uint8Array(16),
      new Uint8Array([0, 16]),
      credentialId,
      cose,
    )
    // {authData: bytes}; attestation:none has no statement to verify.
    const attestation = concatBytes(
      new Uint8Array([0xa1, 0x68]),
      utf8Encode('authData'),
      new Uint8Array([0x58, authData.length]),
      authData,
    )
    return {
      credential: {
        id,
        rawId: id,
        type: 'public-key',
        response: {
          clientDataJSON: base64UrlEncode(
            clientData('webauthn.create', challenge),
          ),
          attestationObject: base64UrlEncode(attestation),
        },
      },
    }
  }

  async function authentication(challenge: string) {
    const client = clientData('webauthn.get', challenge)
    const authData = concatBytes(rpHash, new Uint8Array([1, 0, 0, 0, 1]))
    const signed = concatBytes(authData, await sha256(client))
    const signature = new Uint8Array(
      await crypto.subtle.sign(
        'Ed25519',
        keys.privateKey,
        signed as unknown as ArrayBuffer,
      ),
    )
    return {
      credential: {
        id,
        rawId: id,
        type: 'public-key',
        response: {
          clientDataJSON: base64UrlEncode(client),
          authenticatorData: base64UrlEncode(authData),
          signature: base64UrlEncode(signature),
        },
      },
    }
  }

  return { registration, authentication }
}
