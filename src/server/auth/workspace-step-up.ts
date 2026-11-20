import { verifyStepUp } from './step-up'

/** KV read/modify/write may undercount concurrent requests across colos; this is no atomic ceiling. */
export async function verifyWorkspaceStepUp(
  ports: Parameters<typeof verifyStepUp>[0] & {
    userId: string
    increment: (key: string, ttl: number) => number | Promise<number>
  },
  password?: string,
) {
  // A missing password consumes no password verification attempt.
  if (ports.passwordHash !== null && password !== undefined) {
    const attempts = await ports.increment(
      `workspace-delete:password:${ports.userId}`,
      300,
    )
    if (attempts > 5) return 'rate-limited' as const
  }
  return verifyStepUp(ports, password)
}
