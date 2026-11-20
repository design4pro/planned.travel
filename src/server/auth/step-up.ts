/** Shared identity proof. Ownership and impersonation checks belong before this interface. */
export async function verifyStepUp(
  ports: {
    passwordHash: string | null
    verify: (input: { hash: string; password: string }) => Promise<boolean>
    createdAt: Date | string | number
    freshAge: number
    now: number
  },
  password?: string,
): Promise<
  'password-required' | 'invalid-password' | 'session-not-fresh' | null
> {
  if (ports.passwordHash !== null) {
    if (password === undefined) return 'password-required'
    return (await ports.verify({ hash: ports.passwordHash, password }))
      ? null
      : 'invalid-password'
  }
  if (ports.freshAge === 0) return null
  return ports.now - new Date(ports.createdAt).getTime() < ports.freshAge * 1000
    ? null
    : 'session-not-fresh'
}
