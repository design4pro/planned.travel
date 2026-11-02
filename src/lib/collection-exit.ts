// Client-only registration: draft values stay with the mounted collection editor.
let confirmExit: (() => Promise<boolean>) | undefined

export function registerCollectionExit(
  confirm: () => Promise<boolean>,
): () => void {
  confirmExit = confirm
  return () => {
    if (confirmExit === confirm) confirmExit = undefined
  }
}

/** Ask before mutating the session; router interception would be too late. */
export function requestCollectionExit(): Promise<boolean> {
  return confirmExit?.() ?? Promise.resolve(true)
}
