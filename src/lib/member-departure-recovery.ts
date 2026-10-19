/** A committed departure must resolve and activate a workspace before leaving the current screen. */
export async function finishDeparture(ports: {
  readonly activationFailed: boolean
  readonly recover: () => Promise<boolean>
  readonly navigate: () => void
}): Promise<boolean> {
  if (ports.activationFailed) {
    try {
      if (!(await ports.recover())) return false
    } catch {
      return false
    }
  }
  ports.navigate()
  return true
}
