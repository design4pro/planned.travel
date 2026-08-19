/**
 * Readiness checks for the storage bindings the app cannot serve without.
 *
 * The probes are injected rather than read off `env` inside the checker, so the
 * decision logic (criticality, timeouts, roll-up status) is unit-testable and
 * the binding wiring stays in one obvious place (`bindingProbes`).
 */

export type HealthStatus = 'ok' | 'degraded' | 'down'

export type CheckOutcome = 'ok' | 'fail' | 'timeout'

export interface CheckResult {
  name: string
  /** `critical` failures take the whole Worker to `down`. */
  critical: boolean
  outcome: CheckOutcome
  durationMs: number
  detail?: string
}

export interface HealthReport {
  status: HealthStatus
  environment: string
  ts: string
  durationMs: number
  checks: Array<CheckResult>
}

export interface HealthProbe {
  name: string
  critical: boolean
  run: () => Promise<unknown>
}

export interface CheckReadinessOptions {
  environment?: string
  /** Per-probe budget. The endpoint must answer fast even when a store hangs. */
  timeoutMs?: number
  now?: () => number
}

const DEFAULT_TIMEOUT_MS = 1500

class ProbeTimeoutError extends Error {
  constructor(name: string, timeoutMs: number) {
    super(`${name} did not answer within ${timeoutMs}ms`)
    this.name = 'ProbeTimeoutError'
  }
}

function withTimeout<T>(name: string, timeoutMs: number, promise: Promise<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new ProbeTimeoutError(name, timeoutMs)), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error: unknown) => {
        clearTimeout(timer)
        reject(error instanceof Error ? error : new Error(String(error)))
      },
    )
  })
}

async function runProbe(
  probe: HealthProbe,
  timeoutMs: number,
  now: () => number,
): Promise<CheckResult> {
  const startedAt = now()
  try {
    await withTimeout(probe.name, timeoutMs, Promise.resolve(probe.run()))
    return {
      name: probe.name,
      critical: probe.critical,
      outcome: 'ok',
      durationMs: now() - startedAt,
    }
  } catch (error) {
    const timedOut = error instanceof ProbeTimeoutError
    return {
      name: probe.name,
      critical: probe.critical,
      outcome: timedOut ? 'timeout' : 'fail',
      durationMs: now() - startedAt,
      detail: error instanceof Error ? error.message : String(error),
    }
  }
}

export function rollUpStatus(checks: Array<CheckResult>): HealthStatus {
  let status: HealthStatus = 'ok'
  for (const check of checks) {
    if (check.outcome === 'ok') continue
    if (check.critical) return 'down'
    status = 'degraded'
  }
  return status
}

/** Runs every probe in parallel and rolls the results up into one status. */
export async function checkReadiness(
  probes: Array<HealthProbe>,
  options: CheckReadinessOptions = {},
): Promise<HealthReport> {
  const now = options.now ?? (() => Date.now())
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const startedAt = now()
  const checks = await Promise.all(probes.map((probe) => runProbe(probe, timeoutMs, now)))
  return {
    status: rollUpStatus(checks),
    environment: options.environment ?? 'unknown',
    ts: new Date(now()).toISOString(),
    durationMs: now() - startedAt,
    checks,
  }
}

/** `ok`/`degraded` still serve traffic; `down` must fail a load-balancer check. */
export function healthHttpStatus(status: HealthStatus): number {
  return status === 'down' ? 503 : 200
}

export interface HealthEnvBindings {
  DB: { prepare: (query: string) => { first: <T>() => Promise<T | null> } }
  KV: { get: (key: string) => Promise<string | null> }
  SESSIONS: { get: (key: string) => Promise<string | null> }
  FILES: { head: (key: string) => Promise<unknown> }
  TILES: { head: (key: string) => Promise<unknown> }
  TILES_ARCHIVE_KEY?: string
}

/** Key both KV namespaces probe. Absent keys are a valid `null` answer. */
export const HEALTH_PROBE_KEY = 'health:probe'

/**
 * The real probes.
 *
 * D1 is exercised with a non-domain `SELECT 1` — the one statement in the
 * codebase outside `server/repos`, deliberately, because a liveness probe must
 * not depend on any tenant table existing.
 */
export function bindingProbes(env: HealthEnvBindings): Array<HealthProbe> {
  return [
    {
      name: 'd1',
      critical: true,
      run: () => env.DB.prepare('SELECT 1 AS ok').first<{ ok: number }>(),
    },
    {
      name: 'kv-sessions',
      critical: true,
      run: () => env.SESSIONS.get(HEALTH_PROBE_KEY),
    },
    {
      name: 'kv-cache',
      critical: false,
      run: () => env.KV.get(HEALTH_PROBE_KEY),
    },
    {
      name: 'r2-files',
      critical: false,
      run: () => env.FILES.head(HEALTH_PROBE_KEY),
    },
    {
      name: 'r2-tiles',
      critical: false,
      run: () => env.TILES.head(env.TILES_ARCHIVE_KEY ?? HEALTH_PROBE_KEY),
    },
  ]
}
