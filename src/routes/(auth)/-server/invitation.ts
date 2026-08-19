/**
 * Reading a workspace invitation before the recipient has committed to it.
 *
 * Better Auth's `getInvitation` requires a session whose email matches the
 * invitation, and refuses everything else — correct, but it collapses four very
 * different situations into one rejection. This narrows them back apart so the
 * screen can show the right thing: sign in, switch account, ask for a new
 * invitation, or accept.
 */
import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { z } from 'zod'

import { getAuth } from '#/server/auth'
import { getSession } from '#/server/auth/session'

const invitationInput = z.object({
  invitationId: z.string().trim().min(1).max(64),
})

export interface InvitationSummary {
  readonly id: string
  readonly organizationName: string
  readonly role: string
  readonly email: string
  readonly invitedByEmail: string | null
  /** ISO timestamp, so the client owns the formatting and the timezone. */
  readonly expiresAt: string | null
}

export type InvitationView =
  /** Nobody is signed in; the invitation cannot be read yet. */
  | { readonly state: 'anonymous' }
  /** Signed in as the wrong person. */
  | { readonly state: 'mismatch'; readonly signedInAs: string }
  /** Withdrawn, already used, or past its expiry. */
  | { readonly state: 'unavailable' }
  /** The recipient must confirm their address before joining. */
  | { readonly state: 'unverified'; readonly signedInAs: string }
  | { readonly state: 'ready'; readonly invitation: InvitationSummary }

/** Better Auth's `APIError`, read without importing its class into the bundle. */
function errorCode(cause: unknown): string | null {
  if (typeof cause !== 'object' || cause === null) return null
  const body = (cause as { body?: unknown }).body
  if (typeof body !== 'object' || body === null) return null
  const code = (body as { code?: unknown }).code
  return typeof code === 'string' ? code : null
}

function toSummary(value: unknown): InvitationSummary | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  const { id, email, role, organizationName } = record
  if (
    typeof id !== 'string' ||
    typeof email !== 'string' ||
    typeof role !== 'string' ||
    typeof organizationName !== 'string'
  ) {
    return null
  }
  const expiresAt = record.expiresAt
  return {
    id,
    email,
    role,
    organizationName,
    invitedByEmail:
      typeof record.inviterEmail === 'string' ? record.inviterEmail : null,
    expiresAt:
      expiresAt instanceof Date
        ? expiresAt.toISOString()
        : typeof expiresAt === 'string'
          ? expiresAt
          : null,
  }
}

export const loadInvitation = createServerFn({ method: 'GET' })
  .validator(invitationInput)
  .handler(async ({ data }): Promise<InvitationView> => {
    const session = await getSession()
    if (!session) {
      return { state: 'anonymous' }
    }

    try {
      const raw = await getAuth().api.getInvitation({
        query: { id: data.invitationId },
        headers: getRequest().headers,
      })
      const invitation = toSummary(raw)
      return invitation
        ? { state: 'ready', invitation }
        : { state: 'unavailable' }
    } catch (cause) {
      const code = errorCode(cause)
      if (code === 'YOU_ARE_NOT_THE_RECIPIENT_OF_THE_INVITATION') {
        return { state: 'mismatch', signedInAs: session.user.email }
      }
      if (
        code ===
        'EMAIL_VERIFICATION_REQUIRED_BEFORE_ACCEPTING_OR_REJECTING_INVITATION'
      ) {
        return { state: 'unverified', signedInAs: session.user.email }
      }
      return { state: 'unavailable' }
    }
  })
