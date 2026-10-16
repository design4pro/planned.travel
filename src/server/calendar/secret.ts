import { nanoid } from 'nanoid'

/** A bearer credential, returned once and never persisted. */
export function mintFeedSecret(): string {
  return nanoid(32)
}

/** The only representation of a feed credential stored in D1. */
export async function hashFeedSecret(secret: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(secret))
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}
