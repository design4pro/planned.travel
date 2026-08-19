type LogLevel = 'info' | 'warn' | 'error'

type LogFields = Record<string, string | number | boolean | null | undefined>

/**
 * Structured, single-line JSON logging for Workers Observability
 * (see docs/SPEC.md §5). Never log tokens, secrets or password material —
 * pass identifiers only.
 */
export function logAuth(
  level: LogLevel,
  event: string,
  fields: LogFields = {},
): void {
  const line = JSON.stringify({
    scope: 'auth',
    level,
    event,
    at: new Date().toISOString(),
    ...fields,
  })

  if (level === 'error') {
    console.error(line)
    return
  }
  if (level === 'warn') {
    console.warn(line)
    return
  }
  console.info(line)
}
