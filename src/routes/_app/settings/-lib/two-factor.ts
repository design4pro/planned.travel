/** Accept only the authenticator URI format we can safely expose as a link. */
export function extractSetupKey(uri: string): string {
  const parsed = new URL(uri)
  const secret = parsed.searchParams.get('secret')
  if (
    parsed.protocol !== 'otpauth:' ||
    parsed.hostname !== 'totp' ||
    !secret ||
    !/^[A-Z2-7]+=*$/.test(secret)
  ) {
    throw new Error('Invalid authenticator key')
  }
  return secret
}

export function groupSetupKey(key: string): string {
  return key.match(/.{1,4}/g)?.join(' ') ?? ''
}

export function backupCodesFile(codes: ReadonlyArray<string>): string {
  return `${codes.join('\n')}\n`
}
