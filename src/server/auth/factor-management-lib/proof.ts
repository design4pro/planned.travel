import { twoFactor } from 'better-auth/plugins/two-factor'
import { constantTimeEqual, generateRandomString } from 'better-auth/crypto'

const nativeTotp = twoFactor({ totpOptions: { digits: 6, period: 30 } })
  .endpoints.generateTOTP

/** A crossing step is refused rather than recording replay authority for the wrong step. */
export async function matchCurrentStep(
  secret: string,
  code: string,
): Promise<number | null> {
  if (!/^[0-9]{6}$/.test(code)) return null
  const step = Math.floor(Date.now() / 30000)
  const expected = await nativeTotp({ body: { secret } })
  return step === Math.floor(Date.now() / 30000) &&
    constantTimeEqual(code, expected.code)
    ? step
    : null
}

export function setupUri(secret: string, email: string): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
  let bits = 0
  let value = 0
  let encoded = ''
  for (const byte of new TextEncoder().encode(secret)) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      bits -= 5
      encoded += alphabet[(value >>> bits) & 31]
    }
  }
  if (bits) encoded += alphabet[(value << (5 - bits)) & 31]
  const params = new URLSearchParams({
    secret: encoded,
    issuer: 'planned.travel',
    digits: '6',
    period: '30',
  })
  return `otpauth://totp/planned.travel:${encodeURIComponent(email)}?${params}`
}

export function newBackupCodes(): Array<string> {
  return Array.from({ length: 10 }, () => {
    const code = generateRandomString(10, 'a-z', '0-9', 'A-Z')
    return `${code.slice(0, 5)}-${code.slice(5)}`
  })
}
