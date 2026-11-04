type Entry = { source: string; id: string; occurrence: string; expires: number }

export function isDismissed(
  entries: ReadonlyArray<Entry>,
  source: string,
  id: string,
  occurrence: string,
  now: number,
): boolean {
  return entries.some(
    (entry) =>
      entry.source === source &&
      entry.id === id &&
      entry.occurrence === occurrence &&
      entry.expires > now,
  )
}

export function dismissOccurrence(
  entries: ReadonlyArray<Entry>,
  source: string,
  id: string,
  occurrence: string,
  now: number,
): Array<Entry> {
  return [
    ...entries.filter(
      (entry) =>
        entry.expires > now &&
        !(
          entry.source === source &&
          entry.id === id &&
          entry.occurrence === occurrence
        ),
    ),
    { source, id, occurrence, expires: now + 86_400_000 },
  ].slice(-50)
}

type StorageAccess = Pick<Storage, 'getItem' | 'setItem'>

function storageKey(user: string, workspace: string): string {
  return `planned.mascot.dismissed:${JSON.stringify([user, workspace])}`
}

export function readSuppression(
  storage: StorageAccess,
  user: string,
  workspace: string,
  now: number,
): Array<Entry> {
  try {
    const value: unknown = JSON.parse(
      storage.getItem(storageKey(user, workspace)) ?? '[]',
    )
    if (!Array.isArray(value)) return []
    return value
      .filter(
        (entry): entry is Entry =>
          typeof entry === 'object' &&
          entry !== null &&
          typeof entry.source === 'string' &&
          typeof entry.id === 'string' &&
          typeof entry.occurrence === 'string' &&
          typeof entry.expires === 'number' &&
          Number.isFinite(entry.expires) &&
          entry.expires > now,
      )
      .slice(-50)
      .map(({ source, id, occurrence, expires }) => ({
        source,
        id,
        occurrence,
        expires,
      }))
  } catch {
    return []
  }
}

export function writeSuppression(
  storage: StorageAccess,
  user: string,
  workspace: string,
  entries: ReadonlyArray<Entry>,
): void {
  try {
    storage.setItem(
      storageKey(user, workspace),
      JSON.stringify(
        entries.slice(-50).map(({ source, id, occurrence, expires }) => ({
          source,
          id,
          occurrence,
          expires,
        })),
      ),
    )
  } catch {
    // Keep the current dashboard entry usable when storage is blocked.
  }
}

export function clearAllSuppression(
  storage: Pick<Storage, 'length' | 'key' | 'removeItem'>,
): void {
  try {
    for (let i = storage.length - 1; i >= 0; i--) {
      const key = storage.key(i)
      if (key?.startsWith('planned.mascot.dismissed:')) storage.removeItem(key)
    }
  } catch {
    // Browser storage can be blocked.
  }
}

export function clearBrowserSuppression(): void {
  try {
    clearAllSuppression(sessionStorage)
  } catch {
    // Accessing browser storage can itself fail.
  }
}
