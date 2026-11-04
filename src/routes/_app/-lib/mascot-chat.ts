type ChatEntity = {
  kind: 'trip' | 'reservation' | 'itinerary-item'
  id: string
}
type ChatAdapter = {
  // The adapter must prevent opening after the signal is aborted.
  open: (input: {
    source: 'dashboard-mascot'
    entity?: ChatEntity
    signal: AbortSignal
  }) => Promise<void>
}
type Result = 'opened' | 'unavailable' | 'cancelled'

export function createChatLauncher(adapter?: ChatAdapter) {
  let pending: Promise<Result> | null = null
  let cancelAttempt: ((result: Result) => void) | null = null
  let available = Boolean(adapter)
  return {
    open(entity?: ChatEntity): Promise<Result> {
      if (pending) return pending
      if (!adapter || !available) return Promise.resolve('unavailable')
      const controller = new AbortController()
      let finish: (result: Result) => void = () => {}
      const interrupted = new Promise<Result>((resolve) => {
        finish = resolve
      })
      cancelAttempt = (result) => {
        controller.abort()
        finish(result)
      }
      const timer = setTimeout(() => {
        controller.abort()
        finish('unavailable')
      }, 10_000)
      let operation: Promise<Result>
      try {
        operation = adapter
          .open({
            source: 'dashboard-mascot',
            entity,
            signal: controller.signal,
          })
          .then(
            () => 'opened',
            () => 'unavailable',
          )
      } catch {
        operation = Promise.resolve('unavailable')
      }
      pending = Promise.race([operation, interrupted]).finally(() => {
        clearTimeout(timer)
        pending = null
        cancelAttempt = null
      })
      return pending
    },
    setAvailable(value: boolean): void {
      available = value && Boolean(adapter)
      if (!available) cancelAttempt?.('unavailable')
    },
    cancel(): void {
      cancelAttempt?.('cancelled')
    },
  }
}
