/** A local-retention partition, never authorization or a serialized session credential. */
interface DeliverySession {
  user: { id: string }
  session: { id: string; impersonatedBy: string | null }
}
interface ConfirmedWorkspace {
  userId: string
  organizationId: string
}
export async function deriveTransactionDeliveryScope(
  session: DeliverySession | null,
  workspace: ConfirmedWorkspace | null,
): Promise<string | null> {
  if (session === null) return 'anonymous'
  if (workspace === null || workspace.userId !== session.user.id) return null
  const identity = JSON.stringify([
    'sentry-delivery-v1',
    session.session.id,
    session.user.id,
    workspace.organizationId,
    session.session.impersonatedBy,
  ])
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(identity),
  )
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}
