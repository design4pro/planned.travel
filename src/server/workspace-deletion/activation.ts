/**
 * Release latch. Keep closed until each environment records the consumer revision and completed
 * deployment time and retires all unfenced Workers and their in-flight destructive execution.
 * A source merge and the presence of handlers are not deployment evidence. See #1742.
 */
export function workspaceDeletionActivated(): boolean {
  return false
}
