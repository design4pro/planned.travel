import { nanoid } from 'nanoid'
import { hashSecret } from '#/server/security/secret'

/** A bearer credential, returned once and never persisted. */
export function mintFeedSecret(): string {
  return nanoid(32)
}

/** The only representation of a feed credential stored in D1. */
export function hashFeedSecret(secret: string): Promise<string> {
  return hashSecret(secret)
}
